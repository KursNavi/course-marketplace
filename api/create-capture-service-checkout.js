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
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
        }

        const stripe = new Stripe(getRequiredSanitizedEnv('STRIPE_SECRET_KEY'));
        const { courses } = req.body;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

        // Validierung
        if (!userId || !courses || !Array.isArray(courses) || courses.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Erstelle Beschreibung für Line Item
        const courseUrls = courses.map((c, i) => `Kurs ${i + 1}: ${c.url}`).join('\n');
        const _description = `Kurserfassungs-Service für ${courses.length} Kurs(e):\n${courseUrls}`;

        const includedByTier = { basic: 0, pro: 0, premium: 5, enterprise: 15 };
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('package_tier, stripe_customer_id')
            .eq('id', userId)
            .single();
        if (profileError || !profile) {
            console.error('Profile lookup error:', profileError);
            return res.status(400).json({ error: 'Profil nicht gefunden' });
        }

        // used_capture_services may not exist yet — default to 0 if column missing
        let usedCaptureServices = 0;
        try {
            const { data: captureData } = await supabase
                .from('profiles')
                .select('used_capture_services')
                .eq('id', userId)
                .maybeSingle();
            usedCaptureServices = Number(captureData?.used_capture_services || 0);
        } catch (_) { /* column may not exist */ }

        const tier = (profile.package_tier || 'basic').toLowerCase();
        const includedServices = includedByTier[tier] || 0;
        const usedServices = usedCaptureServices;
        const availableServices = Math.max(0, includedServices - usedServices);

        const prices = Array.from({ length: courses.length }, (_, i) => (i < 3 ? 75 : 50));
        const freeCount = Math.min(availableServices, courses.length);
        const paidBreakdown = prices.slice(freeCount);
        const paidCount = Math.max(0, courses.length - freeCount);
        const totalAmount = paidBreakdown.reduce((sum, price) => sum + price, 0);

        // Speichere Anfrage in Supabase
        let requestId = null;
        let customerId = null;
        // Get or create Stripe customer
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

        const { data: insertData, error: insertError } = await supabase
            .from('capture_service_requests')
            .insert({
                user_id: userId,
                user_email: userEmail,
                courses: courses,
                total_courses: courses.length,
                free_courses: freeCount,
                paid_courses: paidCount,
                total_amount: totalAmount,
                status: totalAmount === 0 ? 'paid' : 'pending',
                created_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (!insertError && insertData) {
            requestId = insertData.id;
        }

        // Wenn komplett kostenlos: used_capture_services updaten
        if (totalAmount === 0) {
            await supabase
                .from('profiles')
                .update({
                    used_capture_services: usedServices + courses.length
                })
                .eq('id', userId);

            return res.status(200).json({
                success: true,
                message: 'Kostenlos gebucht - inkludierte Services verwendet',
                requestId
            });
        }

        // Wenn Zahlung erforderlich: Stripe Checkout Session erstellen
        if (totalAmount > 0) {
            const baseUrl = getBaseUrl(req);
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                line_items: [
                    {
                        price_data: {
                            currency: 'chf',
                            product_data: {
                                name: `Kurserfassungs-Service (${courses.length} Kurse)`,
                                description: freeCount > 0
                                    ? `${paidCount} kostenpflichtige Kurse (${freeCount} inklusive Services bereits angerechnet)`
                                    : `${courses.length} Kurse zur professionellen Erfassung`,
                            },
                            unit_amount: Math.round(totalAmount * 100), // Cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${baseUrl}/dashboard?capture_service=success&request_id=${requestId || 'new'}`,
                cancel_url: `${baseUrl}/dashboard?capture_service=cancelled`,
                metadata: {
                    userId,
                    requestId: requestId || '',
                    courseCount: courses.length.toString(),
                    freeCount: freeCount.toString(),
                    paidCount: paidCount.toString(),
                    type: 'capture_service'
                },
            });

            return res.status(200).json({ id: session.id, url: session.url });
        }

        // Fallback
        return res.status(200).json({ success: true, message: 'Anfrage verarbeitet' });

    } catch (error) {
        console.error('Capture Service Checkout Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
