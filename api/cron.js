import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// This tells Vercel this is the main function to run
export default async function handler(req, res) {
  
  // --- KEYS ---
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds";
  // ------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  // 1. Calculate the date: Exactly 1 Month from today
  const today = new Date();
  const targetDate = new Date();
  targetDate.setMonth(today.getMonth() + 1);
  const targetStr = targetDate.toISOString().split('T')[0]; 

  console.log(`🤖 CRON STARTED. Target Date: ${targetStr}`);

  try {
    // 2. Find courses
    const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('start_date', targetStr);

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ error: error.message });
    }

    if (!courses || courses.length === 0) {
        console.log('✅ No courses found for this date.');
        return res.status(200).json({ message: 'No courses starting in exactly 1 month.' });
    }

    console.log(`Found ${courses.length} courses. Processing payouts...`);

    // 3. Process each course
    for (const course of courses) {
        
        // Find unpaid bookings
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*, profiles:user_id(email, full_name)')
            .eq('course_id', course.id)
            .eq('is_paid', false);

        if (!bookings || bookings.length === 0) continue;

        // Calculate Money
        const totalRevenue = bookings.length * course.price;
        const payoutAmount = totalRevenue * 0.85;

        // Mark as Paid
        const bookingIds = bookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);

        // Send Email (Using your email for the test)
        const teacherEmail = "btrespondek@gmail.com"; 
        
        const listHtml = bookings
            .map(b => `<li>${b.profiles?.full_name || 'Student'}</li>`)
            .join('');

        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: teacherEmail,
            subject: `Payout & Student List: ${course.title}`,
            html: `
              <h1>1-Month Reminder</h1>
              <p>Your course <strong>${course.title}</strong> starts on ${targetStr}.</p>
              <p>Payout processed: <strong>CHF ${payoutAmount}</strong></p>
              <h3>Student List:</h3>
              <ul>${listHtml}</ul>
            `
        });
        console.log(`✅ Payout email sent to ${teacherEmail}`);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Crash Error:", err);
    return res.status(500).json({ error: err.message });
  }
}