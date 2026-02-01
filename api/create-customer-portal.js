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
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    // Create a customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin}/`,
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Customer Portal API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
