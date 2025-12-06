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
    // 1. Calculate Target Date (1 Month from now)
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    
    // Create the "Start" and "End" of that specific day
    const targetDateStr = nextMonth.toISOString().split('T')[0]; // "2025-01-06"
    const startOfDay = `${targetDateStr}T00:00:00`;
    const endOfDay = `${targetDateStr}T23:59:59`;

    // 2. Find courses within that 24-hour window
    // We use .gte (Greater Than or Equal) and .lte (Less Than or Equal)
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .gte('start_date', startOfDay)
      .lte('start_date', endOfDay);

    if (courseError) {
      throw new Error(`Supabase Error: ${courseError.message}`);
    }

    // DEBUG REPORTING
    if (!courses || courses.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "Script ran, but no courses found.",
        lookingForDate: targetDateStr,
        rangeStart: startOfDay,
        rangeEnd: endOfDay,
        coursesFound: 0 
      });
    }

    // 3. Process the courses found
    let emailsSent = 0;

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

        // Generate List
        const listHtml = bookings
            .map(b => `<li>${b.profiles?.full_name || 'Student'}</li>`)
            .join('');

        // Send Email (Hardcoded to you)
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

    // 4. Success Response
    return res.status(200).json({
      success: true,
      message: "Process Complete",
      coursesFound: courses.length,
      emailsSent: emailsSent
    });

  } catch (error) {
    // This catches crashes and shows them as JSON instead of Error Page
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}