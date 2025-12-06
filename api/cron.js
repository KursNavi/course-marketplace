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
    // This handles the timezone difference between Switzerland and the Server
    const today = new Date();
    const nextMonthStart = new Date(today);
    nextMonthStart.setMonth(today.getMonth() + 1);
    
    // We look for courses starting in a wider window (Today+1 Month -> Today+1 Month+2 Days)
    const startDateStr = nextMonthStart.toISOString().split('T')[0];
    const startWindow = `${startDateStr}T00:00:00`;
    
    // Add 2 days to the end window to be safe
    const nextMonthEnd = new Date(nextMonthStart);
    nextMonthEnd.setDate(nextMonthEnd.getDate() + 2);
    const endDateStr = nextMonthEnd.toISOString().split('T')[0];
    const endWindow = `${endDateStr}T23:59:59`;

    // 2. Find courses in this window
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .gte('start_date', startWindow) // Start of window
      .lte('start_date', endWindow);  // End of window

    if (courseError) throw new Error(courseError.message);

    if (!courses || courses.length === 0) {
      return res.status(200).json({ 
          message: "No courses found in window.", 
          serverDate: today.toISOString(),
          lookingBetween: `${startWindow} and ${endWindow}`
      });
    }

    // 3. Process the courses
    let emailsSent = 0;

    for (const course of courses) {
        
        // Fetch ALL bookings for this course (We don't filter by 'is_paid' here)
        // We will filter in the code below to handle "NULL" vs "FALSE" safely
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*, profiles:user_id(email, full_name)')
            .eq('course_id', course.id);

        if (!bookings || bookings.length === 0) continue;

        // FILTER: Keep only bookings that are NOT explicitly true
        // This accepts bookings where is_paid is FALSE or NULL (Empty)
        const unpaidBookings = bookings.filter(b => b.is_paid !== true);

        if (unpaidBookings.length === 0) continue;

        // Calculate Money
        const totalRevenue = unpaidBookings.length * course.price;
        const payoutAmount = totalRevenue * 0.85;

        // Mark them as PAID in database
        const bookingIds = unpaidBookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);

        // Generate Student List
        const listHtml = unpaidBookings
            .map(b => `<li>${b.profiles?.full_name || 'Student'}</li>`)
            .join('');

        // Send Email
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: 'btrespondek@gmail.com', 
            subject: `Payout & Student List: ${course.title}`,
            html: `
              <h1>1-Month Reminder</h1>
              <p>Your course <strong>${course.title}</strong> starts on ${course.start_date}.</p>
              <p>Payout processed: <strong>CHF ${payoutAmount}</strong></p>
              <h3>Student List:</h3>
              <ul>${listHtml}</ul>
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