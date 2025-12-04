import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Look for the NEW variable name
    const secretKey = process.env.VZ_STRIPE_KEY;

    if (!secretKey) {
      // If this fails, we know for a fact something is blocking variables
      throw new Error('STILL MISSING. The new VZ_STRIPE_KEY was not found.');
    }

    // 2. Initialize Stripe
    const stripe = new Stripe(secretKey);
    const { courseId, courseTitle, coursePrice, userId, courseImage } = req.body;

    // 3. Create Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata: { courseId, userId },
    });

    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}