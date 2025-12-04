const Stripe = require('stripe');

// This line is the key fix: using module.exports instead of export default
module.exports = async (req, res) => {
  // 1. Basic Setup: Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. SAFETY CHECK: Check if the key exists
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('CRITICAL: STRIPE_SECRET_KEY is missing in Vercel Environment Variables.');
      return res.status(500).json({ error: 'Server configuration error: Missing Stripe Key' });
    }

    // 3. Initialize Stripe
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // 4. Get the data
    const { courseId, courseTitle, coursePrice, userId, courseImage } = req.body;

    console.log("Creating session for:", courseTitle); 

    // 5. Create the Stripe Checkout Session
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
            unit_amount: Math.round(coursePrice * 100), // Stripe expects cents/rappen
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

    // 6. Send the URL
    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
};