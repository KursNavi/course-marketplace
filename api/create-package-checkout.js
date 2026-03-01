import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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

        const { userId, userEmail, targetTier } = req.body;

        // --- Validation ---
        if (!userId || !userEmail || !targetTier) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const allowedTiers = ['pro', 'premium'];
        if (!allowedTiers.includes(targetTier)) {
            return res.status(400).json({ error: 'Ungültiges Paket. Nur Pro oder Premium buchbar.' });
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
        const prices = { pro: 290, premium: 690 };
        const tierLabels = { pro: 'Pro', premium: 'Premium' };
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

        // --- Determine if this is a renewal ---
        const isRenewal = currentTier === targetTier
            && profile.package_expires_at
            && new Date(profile.package_expires_at) > new Date();

        // --- Create Stripe Checkout Session ---
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer: customerId,
            line_items: [{
                price_data: {
                    currency: 'chf',
                    product_data: {
                        name: `KursNavi ${label} Jahresabo`,
                        description: isRenewal
                            ? `Verlängerung um 1 Jahr ab ${new Date(profile.package_expires_at).toLocaleDateString('de-CH')}`
                            : `${label} Paket – 1 Jahr Laufzeit`,
                    },
                    unit_amount: Math.round(price * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/dashboard?package_upgrade=success`,
            cancel_url: `${req.headers.origin}/dashboard?package_upgrade=cancelled`,
            metadata: {
                type: 'package_upgrade',
                userId,
                targetTier,
                isRenewal: isRenewal ? 'true' : 'false',
                currentExpiresAt: profile.package_expires_at || '',
            },
        });

        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error('Package Checkout Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
