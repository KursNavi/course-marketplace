import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {

  // --- DEBUGGING THE KEYS ---
  const missingKeys = [];
  
  if (!process.env.SUPABASE_URL) missingKeys.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingKeys.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.RESEND_API_KEY) missingKeys.push("RESEND_API_KEY");

  if (missingKeys.length > 0) {
      return res.status(500).json({ 
          error: "Keys are missing in Vercel.", 
          missing_specifically: missingKeys,
          tip: "Check the spelling in Vercel > Settings > Environment Variables"
      });
  }
  // --------------------------

  // If keys exist, assign them
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    // 1. Calculate Search Window (Today + 1 Month)
    const today = new Date();
    const nextMonthStart = new Date(today);
    nextMonthStart.setMonth(today.getMonth() + 1);
    
    const startWindow = `${nextMonthStart.toISOString().split('T')[0]}T00:00:00`;
    
    const nextMonthEnd = new Date(nextMonthStart);
    nextMonthEnd.setDate(nextMonthEnd.getDate() + 2);
    const endWindow = `${nextMonthEnd.toISOString().split('T')[0]}T23:59:59`;

    // 2. Find Courses
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
        
        // 3. Find Bookings
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*')
            .eq('course_id', course.id);

        if (!bookings || bookings.length === 0) continue;

        // Filter: Keep only unpaid bookings (FALSE or NULL)
        const unpaidBookings = bookings.filter(b => b.is_paid !== true);

        if (unpaidBookings.length === 0) continue;

        // 4. Fetch Student Names
        const userIds = unpaidBookings.map(b => b.user_id);
        
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

        // 5. Generate Email List
        const listHtml = unpaidBookings.map(booking => {
            const profile = profiles?.find(p => p.id === booking.user_id);
            const name = profile?.full_name || 'Guest Student';
            const email = profile?.email || 'No Email';
            return `<li>${name} (${email})</li>`;
        }).join('');

        // 6. Calculate Payout
        const totalRevenue = unpaidBookings.length * course.price;
        const payoutAmount = totalRevenue * 0.85;

        // 7. Mark as Paid
        const bookingIds = unpaidBookings.map(b => b.id);
        await supabase.from('bookings').update({ is_paid: true }).in('id', bookingIds);

        // 8. Send Email
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
            `
        });
        
        emailsSent++;
    }

    return res.status(200).json({
      success: true,
      message: "Payouts Processed (Secure Mode)",
      emailsSent: emailsSent
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}