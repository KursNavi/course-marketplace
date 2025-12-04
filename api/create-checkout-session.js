import Stripe from 'stripe';

export default async function handler(req, res) {
  // 1. Basic Setup
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. SAFETY CHECK: Check if the key exists before crashing
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('CRITICAL: STRIPE_SECRET_KEY is missing in Vercel Environment Variables.');
      return res.status(500).json({ error: 'Server configuration error: Missing Stripe Key' });
    }

    // 3. Initialize Stripe INSIDE the function
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { courseId, courseTitle, coursePrice, userId, courseImage } = req.body;

    console.log("Creating session for:", courseTitle); // Debug log

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
            unit_amount: Math.round(coursePrice * 100), // Stripe expects amount in cents (rappen)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata: {
        courseId: courseId,
        userId: userId,
      },
    });

    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('Stripe error:', error);
    // Send the actual error message back to the frontend so we can see it in the console
    res.status(500).json({ error: error.message });
  }
}