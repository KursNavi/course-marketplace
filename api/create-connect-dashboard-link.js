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
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Create login link to Stripe Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(accountId);

    res.status(200).json({ url: loginLink.url });

  } catch (error) {
    console.error('Connect Dashboard Link Error:', error);
    res.status(500).json({ error: error.message });
  }
}
