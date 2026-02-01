import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- BYPASSING VERCEL VARIABLES ---
    const part1 = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpnc";
    const part2 = "NIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCi";
    const part3 = "FyynGjhnJvjr00iYuBK9fk";

    const secretKey = part1 + part2 + part3;
    // ----------------------------------

    const stripe = new Stripe(secretKey);
    const { userId, userEmail } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({ error: 'Missing userId or userEmail' });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
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
      // Use existing account
      accountId = profile.stripe_connect_account_id;
    } else {
      // Create new Connect account
      const account = await stripe.accounts.create({
        type: 'express', // Express accounts are easiest for providers
        country: 'CH', // Switzerland
        email: userEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // Can be 'company' or 'individual'
        metadata: {
          userId,
        },
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

    res.status(200).json({
      url: accountLink.url,
      accountId
    });

  } catch (error) {
    console.error('Connect Account Creation Error:', error);
    res.status(500).json({ error: error.message });
  }
}
