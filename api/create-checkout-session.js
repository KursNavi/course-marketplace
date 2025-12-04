import Stripe from 'stripe';

export default async function handler(req, res) {
  // 1. Basic Setup
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. DETECTIVE MODE: Look for the key
    const key = process.env.STRIPE_SECRET_KEY;

    if (!key) {
      // Create a list of all variable names the server CAN see (Security: Don't show values!)
      const visibleKeys = Object.keys(process.env).join(', ');
      
      // Throw a descriptive error
      throw new Error(`DEBUG INFO: Key is missing. The server only sees these variables: [${visibleKeys}]`);
    }

    // 3. Initialize Stripe
    const stripe = new Stripe(key);

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

    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}