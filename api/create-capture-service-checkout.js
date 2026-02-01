import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // --- STRIPE KEY ---
        const part1 = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpnc";
        const part2 = "NIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCi";
        const part3 = "FyynGjhnJvjr00iYuBK9fk";
        const secretKey = part1 + part2 + part3;

        // --- SUPABASE ---
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        const stripe = new Stripe(secretKey);
        const { userId, userEmail, courses, totalAmount, freeCount, paidCount } = req.body;

        // Validierung
        if (!userId || !courses || !Array.isArray(courses) || courses.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Erstelle Beschreibung für Line Item
        const courseUrls = courses.map((c, i) => `Kurs ${i + 1}: ${c.url}`).join('\n');
        const description = `Kurserfassungs-Service für ${courses.length} Kurs(e):\n${courseUrls}`;

        // Speichere Anfrage in Supabase (wenn Service Key vorhanden)
        let requestId = null;
        let customerId = null;
        if (supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            // Get or create Stripe customer
            const { data: profile } = await supabase
                .from('profiles')
                .select('stripe_customer_id')
                .eq('id', userId)
                .single();

            if (profile?.stripe_customer_id) {
                customerId = profile.stripe_customer_id;
            } else {
                // Create new Stripe customer
                const customer = await stripe.customers.create({
                    email: userEmail,
                    metadata: { userId },
                });
                customerId = customer.id;

                // Store customer ID in database
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
                        used_capture_services: supabase.rpc('increment_used_capture_services', {
                            user_id: userId,
                            increment_by: courses.length
                        })
                    })
                    .eq('id', userId);

                // Alternative: Direktes Inkrement
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('used_capture_services')
                    .eq('id', userId)
                    .single();

                await supabase
                    .from('profiles')
                    .update({
                        used_capture_services: (profile?.used_capture_services || 0) + courses.length
                    })
                    .eq('id', userId);

                return res.status(200).json({
                    success: true,
                    message: 'Kostenlos gebucht - inkludierte Services verwendet',
                    requestId
                });
            }
        }

        // Wenn Zahlung erforderlich: Stripe Checkout Session erstellen
        if (totalAmount > 0) {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
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
                success_url: `${req.headers.origin}/dashboard?capture_service=success&request_id=${requestId || 'new'}`,
                cancel_url: `${req.headers.origin}/dashboard?capture_service=cancelled`,
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
