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
  
  // 1. STRIPE SECRET KEY (From your previous file)
  const STRIPE_KEY = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpncNIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCiFyynGjhnJvjr00iYuBK9fk";
  
  // 2. SUPABASE URL (From your previous file)
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";

  // 3. STRIPE WEBHOOK SECRET (From your previous file)
  const WEBHOOK_SECRET = "whsec_AXbvHsUIRqwDVylwODNbzwPkBmAqYuUh";

  // 4. SUPABASE SERVICE ROLE KEY (From your previous file)
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";

  // 5. RESEND API KEY (⚠️ YOU MUST PASTE THIS FROM YOUR NOTES ⚠️)
  // It starts with "re_..."
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds"; 
  
  // ----------------------------------

  const stripe = new Stripe(STRIPE_KEY);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

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
    
    // Get the customer email directly from Stripe
    const customerEmail = session.customer_details.email;

    console.log(`💰 Payment success! Booking Course: ${courseId} for User: ${userId}`);

    // STEP A: Write to Supabase (The Booking)
    const { error: bookingError } = await supabase
      .from('bookings')
      .insert([{ user_id: userId, course_id: courseId }]);

    if (bookingError) {
        console.error('Supabase Write Error:', bookingError);
        // We do NOT return error here, we try to send the email anyway
    }

    // STEP B: Fetch Course Details (To make the email nice)
    // We need the Title and Start Date to show the user
    const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('title, start_date')
        .eq('id', courseId)
        .single();

    if (courseError) {
        console.error('Error fetching course details:', courseError);
    }

    const courseTitle = course ? course.title : 'Your Course';
    const courseDate = course ? course.start_date : 'Date to be announced';

    // STEP C: Send the Email via Resend
    try {
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>', // Use this default until you verify your domain
            to: customerEmail,
            subject: `Booking Confirmed: ${courseTitle}`,
            html: `
              <h1>Booking Confirmation</h1>
              <p>Thank you for booking <strong>${courseTitle}</strong>!</p>
              <p><strong>Date:</strong> ${courseDate}</p>
              <p>Please bring this email to your class.</p>
              <br />
              <p>Best,<br/>The KursNavi Team</p>
            `
        });
        console.log('✅ Email sent successfully to:', customerEmail);
    } catch (emailError) {
        console.error('❌ Failed to send email:', emailError);
    }
  }

  res.status(200).json({ received: true });
}