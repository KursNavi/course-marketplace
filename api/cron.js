import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {

  // --- KEYS ---
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds";
  // ------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    // 1. Calculate the Search Window (Next Month + 48 Hours)
    const today = new Date();
    const nextMonthStart = new Date(today);
    nextMonthStart.setMonth(today.getMonth() + 1);
    
    const startDateStr = nextMonthStart.toISOString().split('T')[0];
    const startWindow = `${startDateStr}T00:00:00`;
    
    const nextMonthEnd = new Date(nextMonthStart);
    nextMonthEnd.setDate(nextMonthEnd.getDate() + 2);
    const endWindow = `${nextMonthEnd.toISOString().split('T')[0]}T23:59:59`;

    // 2. Find courses in this window
    const { data: courses } = await supabase
      .from('courses')
      .select('*')
      .gte('start_date', startWindow)
      .lte('start_date', endWindow);

    if (!courses || courses.length === 0) {
      return res.status(200).json({ message: "No courses found." });
    }

    let emailsSent = 0;

    for (const course of courses) {
        
        // SIMPLIFIED QUERY: We removed "profiles:user_id(...)"
        // This prevents the code from breaking if the profile link is bad.
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*')
            .eq('course_id', course.id);

        if (!bookings || bookings.length === 0) continue;

        // Filter for Unpaid (False or Null)
        const unpaidBookings = bookings.filter(b => b.is_paid !== true);

        if (unpaidBookings.length === 0) continue;

        // Calculate Money
        const totalRevenue = unpaidBookings.length * course.price;
        const payoutAmount = totalRevenue * 0.85;

        // Mark as Paid
        const bookingIds = unpaidBookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);

        // Generate List (Using User IDs since we removed the name lookup)
        const listHtml = unpaidBookings
            .map(b => `<li>Student User ID: ${b.user_id}</li>`)
            .join('');

        // Send Email
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: 'btrespondek@gmail.com', 
            subject: `Payout Alert: ${course.title}`,
            html: `
              <h1>1-Month Reminder</h1>
              <p>Your course <strong>${course.title}</strong> starts on ${course.start_date}.</p>
              <p>Payout processed: <strong>CHF ${payoutAmount}</strong></p>
              <h3>Student List:</h3>
              <ul>${listHtml}</ul>
              <p><em>(Note: Student names hidden for this test to ensure delivery)</em></p>
            `
        });
        
        emailsSent++;
    }

    return res.status(200).json({
      success: true,
      message: "Payouts Processed",
      coursesFound: courses.length,
      emailsSent: emailsSent
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}