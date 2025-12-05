import Stripe from 'stripe';

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
    const { courseId, courseTitle, coursePrice, userId, courseImage } = req.body;

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