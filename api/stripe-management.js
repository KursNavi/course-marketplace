import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { action, ...params } = req.body;

    // Route based on action
    switch (action) {
      case 'create_customer_portal':
        return await handleCustomerPortal(stripe, params, req, res);

      case 'create_connect_account':
        return await handleConnectAccount(stripe, params, req, res);

      case 'connect_dashboard_link':
        return await handleConnectDashboard(stripe, params, res);

      case 'check_connect_status':
        return await handleCheckConnectStatus(stripe, params, res);

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('Stripe Management Error:', error);
    // Return more detailed error info for debugging
    res.status(500).json({
      error: error.message,
      type: error.type || 'unknown',
      code: error.code || null
    });
  }
}

// Handle Customer Portal Session Creation
async function handleCustomerPortal(stripe, params, req, res) {
  const { customerId } = params;

  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID is required' });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${req.headers.origin}/`,
  });

  return res.status(200).json({ url: session.url });
}

// Handle Connect Account Creation and Onboarding
async function handleConnectAccount(stripe, params, req, res) {
  const { userId, userEmail } = params;

  if (!userId || !userEmail) {
    return res.status(400).json({ error: 'Missing userId or userEmail' });
  }

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check if user already has a Connect account
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarding_complete')
    .eq('id', userId)
    .single();

  let accountId;

  if (profile?.stripe_connect_account_id) {
    // Verify the existing account is still valid
    try {
      await stripe.accounts.retrieve(profile.stripe_connect_account_id);
      accountId = profile.stripe_connect_account_id;
    } catch (retrieveError) {
      // Account no longer exists or is invalid - create a new one
      console.log('Existing Connect account invalid, creating new one:', retrieveError.message);
      accountId = null;
    }
  }

  if (!accountId) {
    // Create new Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CH',
      email: userEmail,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: { userId },
    });

    accountId = account.id;

    // Store account ID in database
    await supabase
      .from('profiles')
      .update({
        stripe_connect_account_id: accountId,
        stripe_connect_onboarding_complete: false
      })
      .eq('id', userId);
  }

  // Create account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${req.headers.origin}/dashboard?connect=refresh`,
    return_url: `${req.headers.origin}/dashboard?connect=success`,
    type: 'account_onboarding',
  });

  return res.status(200).json({ url: accountLink.url, accountId });
}

// Handle Connect Dashboard Link
async function handleConnectDashboard(stripe, params, res) {
  const { accountId } = params;

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  const loginLink = await stripe.accounts.createLoginLink(accountId);

  return res.status(200).json({ url: loginLink.url });
}

// Check Connect Account Status and update database
async function handleCheckConnectStatus(stripe, params, res) {
  const { userId } = params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get the user's Connect account ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', userId)
    .single();

  if (!profile?.stripe_connect_account_id) {
    return res.status(400).json({ error: 'No Connect account found', onboardingComplete: false });
  }

  // Retrieve account status from Stripe
  const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);

  // Check if onboarding is complete (details_submitted is the key indicator)
  const onboardingComplete = account.details_submitted === true;

  // Update database
  await supabase
    .from('profiles')
    .update({ stripe_connect_onboarding_complete: onboardingComplete })
    .eq('id', userId);

  return res.status(200).json({
    onboardingComplete,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted
  });
}
