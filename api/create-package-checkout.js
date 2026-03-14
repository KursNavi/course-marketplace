import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getRequiredSanitizedEnv } from './_lib/env.js';

function getBaseUrl(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;

    if (forwardedHost) {
        return `${forwardedProto || 'https'}://${forwardedHost}`.replace(/\/$/, '');
    }

    const raw = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://kursnavi.ch';
    return raw.replace(/\/$/, '');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const stripe = new Stripe(getRequiredSanitizedEnv('STRIPE_SECRET_KEY'));
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { targetTier } = req.body;
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authUser) {
            return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
        }
        const userId = authUser.id;
        const userEmail = (authUser.email || '').toLowerCase();

        // --- Validation ---
        if (!userEmail || !targetTier) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const allowedTiers = ['pro', 'premium', 'enterprise'];
        if (!allowedTiers.includes(targetTier)) {
            return res.status(400).json({ error: 'Ungültiges Paket. Nur Pro, Premium oder Enterprise buchbar.' });
        }

        // --- Check current tier (prevent downgrade) ---
        const tierOrder = ['basic', 'pro', 'premium', 'enterprise'];
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('package_tier, stripe_customer_id, package_expires_at')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(400).json({ error: 'Profil nicht gefunden' });
        }

        const currentTier = (profile.package_tier || 'basic').toLowerCase();
        const currentIdx = tierOrder.indexOf(currentTier);
        const targetIdx = tierOrder.indexOf(targetTier);

        // Allow same tier (renewal) or upgrade only
        if (targetIdx < currentIdx) {
            return res.status(400).json({ error: 'Downgrade nicht möglich über Checkout' });
        }

        // --- Server-side prices (tamper-proof) ---
        const prices = { pro: 290, premium: 690, enterprise: 1490 };
        const tierLabels = { pro: 'Pro', premium: 'Premium', enterprise: 'Enterprise' };
        const price = prices[targetTier];
        const label = tierLabels[targetTier];

        // --- Get or create Stripe customer ---
        let customerId;
        if (profile.stripe_customer_id) {
            customerId = profile.stripe_customer_id;
        } else {
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: { userId },
            });
            customerId = customer.id;

            await supabase
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', userId);
        }

        // --- Determine if this is a renewal or upgrade ---
        const hasActivePackage = profile.package_expires_at
            && new Date(profile.package_expires_at) > new Date();
        const isRenewal = currentTier === targetTier && hasActivePackage;
        const isUpgrade = targetIdx > currentIdx && currentTier !== 'basic' && hasActivePackage;

        // --- Proration: credit remaining value of current plan on upgrade ---
        let finalPrice = price;
        let credit = 0;
        let description = '';

        if (isRenewal) {
            description = `Verlängerung um 1 Jahr ab ${new Date(profile.package_expires_at).toLocaleDateString('de-CH')}`;
        } else if (isUpgrade) {
            // Calculate remaining days on current plan
            const now = new Date();
            const expiresAt = new Date(profile.package_expires_at);
            const remainingMs = expiresAt - now;
            const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

            // Daily rate of current plan
            const currentPrice = prices[currentTier] || 0;
            const dailyRate = currentPrice / 365;
            credit = Math.round(dailyRate * remainingDays * 100) / 100; // round to 2 decimals
            finalPrice = Math.max(0, price - credit);

            const currentLabel = tierLabels[currentTier] || currentTier;
            description = credit > 0
                ? `Upgrade ${currentLabel} → ${label} (Restguthaben CHF ${credit.toFixed(2)} verrechnet)`
                : `Upgrade auf ${label} Paket – 1 Jahr Laufzeit`;
        } else {
            description = `${label} Paket – 1 Jahr Laufzeit`;
        }

        // --- Create Stripe Checkout Session ---
        const baseUrl = getBaseUrl(req);
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [{
                price_data: {
                    currency: 'chf',
                    product_data: {
                        name: `KursNavi ${label} Jahresabo`,
                        description,
                    },
                    unit_amount: Math.round(finalPrice * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${baseUrl}/dashboard?package_upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/dashboard?package_upgrade=cancelled`,
            metadata: {
                type: 'package_upgrade',
                userId,
                currentTier,
                targetTier,
                isRenewal: isRenewal ? 'true' : 'false',
                currentExpiresAt: profile.package_expires_at || '',
                credit: credit.toFixed(2),
            },
        });

        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error('Package Checkout Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
