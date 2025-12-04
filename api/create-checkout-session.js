import Stripe from 'stripe';

export default async function handler(req, res) {
  // 1. Basic Setup
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Check for the Key
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is missing in Vercel.');
    }

    // 3. Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { courseId, courseTitle, coursePrice, userId, courseImage } = req.body;

    // 4. Create Session
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

    // 5. Success
    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('API Error:', error);
    // Send the actual error message back to the frontend
    res.status(500).json({ error: error.message });
  }
}
// forcing a fresh rebuild