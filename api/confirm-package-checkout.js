import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getRequiredSanitizedEnv } from './_lib/env.js';

const PACKAGE_TIER_ORDER = ['basic', 'pro', 'premium', 'enterprise'];
const PACKAGE_PRICES_CHF = { pro: 290, premium: 690, enterprise: 1490 };

function normalizePackageTier(raw) {
  const value = (raw || '').toString().trim().toLowerCase();
  return PACKAGE_TIER_ORDER.includes(value) ? value : 'basic';
}

function hasActivePackage(expiresAt) {
  return !!expiresAt && new Date(expiresAt) > new Date();
}

function computePackageAmountCents(currentTier, currentExpiresAt, targetTier) {
  const price = PACKAGE_PRICES_CHF[targetTier];
  if (!price) return null;

  const currentIdx = PACKAGE_TIER_ORDER.indexOf(currentTier);
  const targetIdx = PACKAGE_TIER_ORDER.indexOf(targetTier);
  if (currentIdx === -1 || targetIdx === -1 || targetIdx < currentIdx) {
    return null;
  }

  const active = hasActivePackage(currentExpiresAt);
  const isRenewal = currentTier === targetTier && active;
  const isUpgrade = targetIdx > currentIdx && currentTier !== 'basic' && active;

  let finalPrice = price;
  if (isUpgrade) {
    const currentPrice = PACKAGE_PRICES_CHF[currentTier] || 0;
    const remainingMs = new Date(currentExpiresAt) - new Date();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const credit = Math.round((currentPrice / 365) * remainingDays * 100) / 100;
    finalPrice = Math.max(0, price - credit);
  } else if (currentTier === targetTier && !isRenewal) {
    return null;
  }

  return Math.round(finalPrice * 100);
}

function resolvePackageTargetTier(currentTier, currentExpiresAt, requestedTargetTier, amountTotal) {
  const normalizedCurrent = normalizePackageTier(currentTier);
  const normalizedRequested = normalizePackageTier(requestedTargetTier);
  const currentIdx = PACKAGE_TIER_ORDER.indexOf(normalizedCurrent);

  const candidates = PACKAGE_TIER_ORDER
    .filter((tier) => ['pro', 'premium', 'enterprise'].includes(tier))
    .filter((tier) => PACKAGE_TIER_ORDER.indexOf(tier) >= currentIdx)
    .filter((tier) => computePackageAmountCents(normalizedCurrent, currentExpiresAt, tier) === amountTotal);

  if (candidates.includes(normalizedRequested)) {
    return normalizedRequested;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return normalizedRequested;
}

function calculatePackageExpiry(currentTier, currentExpiresAt, targetTier) {
  const isRenewal = currentTier === targetTier && hasActivePackage(currentExpiresAt);
  const newExpiresAt = isRenewal && currentExpiresAt
    ? new Date(currentExpiresAt)
    : new Date();

  newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);
  return { isRenewal, newExpiresAt };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(getRequiredSanitizedEnv('STRIPE_SECRET_KEY'));
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Ungueltiges oder abgelaufenes Token' });
    }

    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadata = session.metadata || {};

    if (metadata.type !== 'package_upgrade') {
      return res.status(400).json({ error: 'Session is not a package checkout' });
    }

    if (metadata.userId !== user.id) {
      return res.status(403).json({ error: 'Session does not belong to current user' });
    }

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return res.status(409).json({ error: 'Payment is not completed yet' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('package_tier, package_expires_at, package_stripe_session_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(400).json({ error: 'Profil nicht gefunden' });
    }

    const currentTier = normalizePackageTier(metadata.currentTier || profile.package_tier);
    const currentExpiresAt = metadata.currentExpiresAt || profile.package_expires_at || null;
    const targetTier = resolvePackageTargetTier(
      currentTier,
      currentExpiresAt,
      metadata.targetTier,
      session.amount_total
    );
    const { newExpiresAt } = calculatePackageExpiry(currentTier, currentExpiresAt, targetTier);

    if (profile.package_stripe_session_id === session.id) {
      if (normalizePackageTier(profile.package_tier) !== targetTier) {
        const { error: correctionError } = await supabase
          .from('profiles')
          .update({ package_tier: targetTier })
          .eq('id', user.id);

        if (correctionError) {
          return res.status(500).json({ error: 'Failed to correct package tier', details: correctionError });
        }
      }

      return res.status(200).json({
        received: true,
        note: 'Already processed',
        targetTier,
        packageExpiresAt: profile.package_expires_at || newExpiresAt.toISOString(),
      });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        package_tier: targetTier,
        package_expires_at: newExpiresAt.toISOString(),
        package_stripe_session_id: session.id,
        package_reminder_sent: null,
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update package tier', details: updateError });
    }

    return res.status(200).json({
      received: true,
      targetTier,
      packageExpiresAt: newExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Confirm package checkout failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
