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
    
    // We search for the WHOLE day (00:00 to 23:59)
    const targetDateStr = nextMonth.toISOString().split('T')[0];
    const startOfDay = `${targetDateStr}T00:00:00`;
    const endOfDay = `${targetDateStr}T23:59:59`;

    // 2. Find courses starting on that date
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .gte('start_date', startOfDay)
      .lte('start_date', endOfDay);

    if (courseError) throw new Error(courseError.message);

    if (!courses || courses.length === 0) {
      return res.status(200).json({ message: "No courses found for " + targetDateStr });
    }

    // 3. Process the courses
    let emailsSent = 0;

    for (const course of courses) {
        
        // Find bookings that have NOT been paid out to the teacher yet
        // We look for 'is_paid' being false (which is the default you just set)
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*, profiles:user_id(email, full_name)')
            .eq('course_id', course.id)
            .eq('is_paid', false); // This column now exists!

        if (!bookings || bookings.length === 0) continue;

        // Calculate Money
        const totalRevenue = bookings.length * course.price;
        const payoutAmount = totalRevenue * 0.85;

        // Mark them as PAID in the database so we don't pay again
        const bookingIds = bookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);

        // Generate Student List
        const listHtml = bookings
            .map(b => `<li>${b.profiles?.full_name || 'Student'}</li>`)
            .join('');

        // Send Email to YOU (Teacher)
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