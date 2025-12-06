import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
  const STRIPE_KEY = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpncNIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCiFyynGjhnJvjr00iYuBK9fk";
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const WEBHOOK_SECRET = "whsec_AXbvHsUIRqwDVylwODNbzwPkBmAqYuUh";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
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

    console.log(`💰 Payment success! Booking Course: ${courseId}`);

    // 1. Save Booking
    await supabase.from('bookings').insert([{ user_id: userId, course_id: courseId }]);

    // 2. Get Course Info (Title + Start Date + Teacher ID)
    const { data: course } = await supabase
        .from('courses')
        .select('title, start_date, user_id') 
        .eq('id', courseId)
        .single();
    
    const courseTitle = course ? course.title : 'Course';
    const courseDate = course ? course.start_date : 'TBA';

    // 3. Send STUDENT Email
    try {
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: customerEmail,
            subject: `Booking Confirmed: ${courseTitle}`,
            html: `
                <h1>You are booked!</h1>
                <p>Course: <strong>${courseTitle}</strong></p>
                <p>Date: ${courseDate}</p>
            `
        });
        console.log('✅ Student Email Sent.');
    } catch (e) { console.error('Student Email Failed:', e); }

    // 4. Send TEACHER Email (With SMART DATE LOGIC)
    if (course && course.start_date) {
        const startDate = new Date(course.start_date);
        const today = new Date();
        
        // Calculate "1 Month from now"
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(today.getMonth() + 1);

        console.log(`📅 Date Check: Start (${course.start_date}) vs Limit (${oneMonthFromNow.toISOString().split('T')[0]})`);

        // IF course starts SOONER than 1 month...
        if (startDate < oneMonthFromNow) {
            console.log('⚡ Late Booking detected! Sending Teacher Alert...');

            // --- TEACHER EMAIL LOGIC ---
            // In Production, use this:
            // const { data: teacherUser } = await supabase.auth.admin.getUserById(course.user_id);
            // const teacherEmail = teacherUser.user.email;
            
            // For TESTING now, use this:
            const teacherEmail = "btrespondek@gmail.com"; 

            try {
                await resend.emails.send({
                    from: 'KursNavi <onboarding@resend.dev>',
                    to: teacherEmail,
                    subject: `New Last-Minute Student: ${courseTitle}`,
                    html: `
                        <h1>New Student!</h1>
                        <p><strong>${customerEmail}</strong> has joined <strong>${courseTitle}</strong>.</p>
                        <p>This course starts soon (${courseDate}). Please add them to your list!</p>
                    `
                });
                console.log('✅ Teacher Alert Sent.');
            } catch (tError) {
                console.error('❌ Teacher Email Failed:', tError);
            }
        } else {
            console.log('zzz Early booking. No immediate teacher alert needed.');
        }
    }
  }

  res.status(200).json({ received: true });
}