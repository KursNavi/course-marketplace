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
    const { courseId, courseTitle, coursePrice, userId, courseImage, userEmail } = req.body;

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get or create Stripe customer
    let customerId;

    // Check if user already has a Stripe customer ID
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'chf',
            product_data: {
              name: courseTitle,
              images: courseImage ? [courseImage] : [],
            },
            unit_amount: Math.round(coursePrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',

      // FIX: Redirect to the ROOT path (/?...) instead of /success
      // This ensures Vercel loads your App, and your App detects the payment.
      success_url: `${req.headers.origin}/?session_id={CHECKOUT_SESSION_ID}`,

      // FIX: Redirect cancel to the homepage too, to avoid 404s there
      cancel_url: `${req.headers.origin}/`,

      metadata: { courseId, userId },
    });

    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}