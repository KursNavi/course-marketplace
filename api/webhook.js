import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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
  
  // 1. STRIPE SECRET KEY
  const STRIPE_KEY = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpncNIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCiFyynGjhnJvjr00iYuBK9fk";
  
  // 2. SUPABASE URL
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";

  // 3. STRIPE WEBHOOK SECRET
  const WEBHOOK_SECRET = "whsec_AXbvHsUIRqwDVylwODNbzwPkBmAqYuUh";

  // 4. SUPABASE SERVICE ROLE KEY
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";

  // 5. RESEND API KEY (⚠️ PASTE YOUR KEY HERE ⚠️)
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds"; 
  
  // ----------------------------------

  const stripe = new Stripe(STRIPE_KEY);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const courseId = session.metadata.courseId;
    const customerEmail = session.customer_details.email;

    console.log(`💰 Payment success! Booking Course: ${courseId} for User: ${userId}`);

    // STEP A: Write to Supabase
    const { error: bookingError } = await supabase
      .from('bookings')
      .insert([{ user_id: userId, course_id: courseId }]);

    if (bookingError) {
        console.error('Supabase Write Error:', bookingError);
        // If it's a duplicate, we just log it and continue to email
    }

    // STEP B: Fetch Course Details
    const { data: course } = await supabase
        .from('courses')
        .select('title, start_date')
        .eq('id', courseId)
        .single();

    const courseTitle = course ? course.title : 'Your Course';
    const courseDate = course ? course.start_date : 'Date to be announced';

    // STEP C: Send Email (UPDATED LOGIC)
    try {
        // We now ask Resend to give us the error report if there is one
        const { data, error } = await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: customerEmail,
            subject: `Booking Confirmed: ${courseTitle}`,
            html: `<h1>Booking Confirmation</h1><p>You booked <strong>${courseTitle}</strong> on ${courseDate}.</p>`
        });

        if (error) {
            // This is the line that was missing before!
            console.error('❌ RESEND API ERROR:', error); 
        } else {
            console.log('✅ Email successfully sent to:', customerEmail);
            console.log('📄 Resend Receipt ID:', data.id);
        }
        
    } catch (err) {
        console.error('❌ Unexpected Email Crash:', err);
    }
  }

  res.status(200).json({ received: true });
}