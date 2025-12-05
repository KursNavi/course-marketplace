import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 1. Tell Vercel NOT to touch the data (we need the raw signature)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read the raw body
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // --- ⚠️ PASTE YOUR KEYS HERE ⚠️ ---
  
  // 1. STRIPE SECRET KEY (I filled this one for you)
  const STRIPE_KEY = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpncNIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCiFyynGjhnJvjr00iYuBK9fk";
  
  // 2. SUPABASE URL (I filled this one for you)
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";

  // 3. STRIPE WEBHOOK SECRET (PASTE YOUR whsec_... KEY HERE)
  const WEBHOOK_SECRET = "whsec_AXbvHsUIRqwDVylwODNbzwPkBmAqYuUh";

  // 4. SUPABASE SERVICE ROLE KEY (PASTE YOUR service_role KEY HERE)
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  
  // ----------------------------------

  const stripe = new Stripe(STRIPE_KEY);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify the "Letter" came from Stripe
    event = stripe.webhooks.constructEvent(buf, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Get the data we hid in the metadata earlier
    const userId = session.metadata.userId;
    const courseId = session.metadata.courseId;

    console.log(`💰 Payment success! Booking Course: ${courseId} for User: ${userId}`);

    // Write to Supabase using the MASTER KEY (Bypasses all RLS rules)
    const { error } = await supabase
      .from('bookings')
      .insert([{ user_id: userId, course_id: courseId }]);

    if (error) {
        console.error('Supabase Write Error:', error);
        return res.status(500).json({ error: error.message });
    }
  }

  res.status(200).json({ received: true });
}