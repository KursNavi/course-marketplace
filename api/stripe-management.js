import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`.replace(/\/$/, '');
  }

  const raw = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://kursnavi.ch';
  return raw.replace(/\/$/, '');
}

async function requireAuthUser(req, supabase) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Ungültiges oder abgelaufenes Token' };
  }
  return { user };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const auth = await requireAuthUser(req, supabase);
    if (auth.error) {
      return res.status(401).json({ error: auth.error });
    }

    const { action } = req.body || {};

    switch (action) {
      case 'create_customer_portal':
        return await handleCustomerPortal(stripe, supabase, auth.user.id, req, res);
      case 'create_connect_account':
        return await handleConnectAccount(stripe, supabase, auth.user, req, res);
      case 'connect_dashboard_link':
        return await handleConnectDashboard(stripe, supabase, auth.user.id, req, res);
      case 'check_connect_status':
        return await handleCheckConnectStatus(stripe, supabase, auth.user.id, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Stripe Management Error:', error);
    return res.status(500).json({
      error: error.message,
      type: error.type || 'unknown',
      code: error.code || null
    });
  }
}

async function loadProfile(supabase, userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_connect_account_id, stripe_connect_onboarding_complete')
    .eq('id', userId)
    .single();
  return { profile, error };
}

async function handleCustomerPortal(stripe, supabase, userId, req, res) {
  const { profile, error } = await loadProfile(supabase, userId);
  if (error || !profile?.stripe_customer_id) {
    return res.status(400).json({ error: 'No customer profile found' });
  }

  const baseUrl = getBaseUrl(req);
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${baseUrl}/`,
  });

  return res.status(200).json({ url: session.url });
}

async function handleConnectAccount(stripe, supabase, authUser, req, res) {
  const userId = authUser.id;
  const userEmail = (authUser.email || '').toLowerCase();

  if (!userEmail) {
    return res.status(400).json({ error: 'Missing account email' });
  }

  const { profile } = await loadProfile(supabase, userId);
  let accountId;

  if (profile?.stripe_connect_account_id) {
    try {
      await stripe.accounts.retrieve(profile.stripe_connect_account_id);
      accountId = profile.stripe_connect_account_id;
    } catch (retrieveError) {
      console.log('Existing Connect account invalid, creating new one:', retrieveError.message);
      accountId = null;
    }
  }

  if (!accountId) {
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
    await supabase
      .from('profiles')
      .update({
        stripe_connect_account_id: accountId,
        stripe_connect_onboarding_complete: false
      })
      .eq('id', userId);
  }

  const baseUrl = getBaseUrl(req);
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard?connect=refresh`,
    return_url: `${baseUrl}/dashboard?connect=success`,
    type: 'account_onboarding',
  });

  return res.status(200).json({ url: accountLink.url, accountId });
}

async function handleConnectDashboard(stripe, supabase, userId, req, res) {
  const requestedAccountId = req.body?.accountId || null;
  const { profile, error } = await loadProfile(supabase, userId);
  if (error || !profile?.stripe_connect_account_id) {
    return res.status(400).json({ error: 'No connect account found' });
  }
  if (requestedAccountId && requestedAccountId !== profile.stripe_connect_account_id) {
    return res.status(403).json({ error: 'Account mismatch' });
  }

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_account_id);
  return res.status(200).json({ url: loginLink.url });
}

async function handleCheckConnectStatus(stripe, supabase, userId, res) {
  const { profile } = await loadProfile(supabase, userId);
  if (!profile?.stripe_connect_account_id) {
    return res.status(400).json({ error: 'No Connect account found', onboardingComplete: false });
  }

  const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
  const onboardingComplete = account.details_submitted === true
    && account.charges_enabled === true
    && account.payouts_enabled === true;

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
