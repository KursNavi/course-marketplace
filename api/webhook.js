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
  // We use the Service Key so we can access Admin features (like finding the teacher's email)
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

    // STEP A: Write to Supabase (Save the Booking)
    const { error: bookingError } = await supabase
      .from('bookings')
      .insert([{ user_id: userId, course_id: courseId }]);

    if (bookingError) {
        console.error('Supabase Write Error:', bookingError);
    }

    // STEP B: Fetch Course Details (AND Teacher ID)
    const { data: course } = await supabase
        .from('courses')
        .select('title, start_date, user_id') // We need user_id to find the teacher
        .eq('id', courseId)
        .single();

    const courseTitle = course ? course.title : 'Your Course';
    const courseDate = course ? course.start_date : 'TBA';

    // STEP C: Send Student Confirmation Email
    try {
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: customerEmail,
            subject: `Booking Confirmed: ${courseTitle}`,
            html: `
              <h1>Booking Confirmation</h1>
              <p>You booked <strong>${courseTitle}</strong> on ${courseDate}.</p>
              <p>See you there!</p>
            `
        });
        console.log('✅ Student email sent.');
    } catch (err) {
        console.error('❌ Student email failed:', err);
    }

    // STEP D: Teacher "Late Booking" Notification
    if (course && course.start_date) {
        const startDate = new Date(course.start_date);
        const today = new Date();
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(today.getMonth() + 1);

        // If the course starts BEFORE 1 month from now...
        if (startDate < oneMonthFromNow) {
            console.log('⚡ Late Booking detected! Notifying Teacher...');

            // 1. Get Teacher Email using Admin Key
            const { data: teacherUser, error: teacherError } = await supabase.auth.admin.getUserById(course.user_id);

            if (teacherUser && teacherUser.user) {
                const teacherEmail = "BTRespondek@gmail.com"; // ⚠️ HARDCODED FOR TESTING ONLY

                // 2. Send Email to Teacher
                try {
                    await resend.emails.send({
                        from: 'KursNavi <onboarding@resend.dev>',
                        to: teacherEmail,
                        subject: `New Last-Minute Booking: ${course.title}`,
                        html: `
                          <h1>New Student!</h1>
                          <p>A student has just booked your course <strong>${course.title}</strong>.</p>
                          <p><strong>Student Email:</strong> ${customerEmail}</p>
                          <p>Since the course starts soon (${courseDate}), please add them to your roster immediately.</p>
                        `
                    });
                    console.log('✅ Teacher notification sent to:', teacherEmail);
                } catch (tError) {
                    console.error('❌ Teacher notification failed:', tError);
                }
            } else {
                console.error('Could not find teacher email:', teacherError);
            }
        }
    }
  }

  res.status(200).json({ received: true });
}