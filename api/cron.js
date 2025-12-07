import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {

  // --- SECURE KEYS ---
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = 'btrespondek@gmail.com'; // Your fallback email

  if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_KEY) {
      return res.status(500).json({ error: "Keys missing in Vercel." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    // 1. Calculate Search Window (Today + 1 Month +/- 5 Days)
    const today = new Date();
    const startWindowDate = new Date(today);
    startWindowDate.setDate(today.getDate() + 25); // Start looking 25 days out
    const startWindow = `${startWindowDate.toISOString().split('T')[0]}T00:00:00`;

    const endWindowDate = new Date(today);
    endWindowDate.setDate(today.getDate() + 35); // Stop looking 35 days out
    const endWindow = `${endWindowDate.toISOString().split('T')[0]}T23:59:59`;

    // 2. Find Courses
    const { data: courses } = await supabase
      .from('courses')
      .select('*')
      .gte('start_date', startWindow)
      .lte('start_date', endWindow);

    if (!courses || courses.length === 0) {
      return res.status(200).json({ message: "No courses found in window." });
    }

    let emailsSent = 0;

    for (const course of courses) {
        
        // 3. Find Unpaid Bookings
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*')
            .eq('course_id', course.id);

        if (!bookings || bookings.length === 0) continue;

        const unpaidBookings = bookings.filter(b => b.is_paid !== true);
        if (unpaidBookings.length === 0) continue;

        // 4. FETCH TEACHER EMAIL (New Logic)
        // We look up the profile of the person who OWNS the course (course.user_id)
        let teacherEmail = ADMIN_EMAIL; // Default to you
        
        if (course.user_id) {
            const { data: teacherProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', course.user_id)
                .single();
            
            if (teacherProfile && teacherProfile.email) {
                teacherEmail = teacherProfile.email;
            }
        }

        // 5. Fetch Student Names
        const userIds = unpaidBookings.map(b => b.user_id);
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

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

        // 8. Send Email to the TEACHER
        // Note: In Resend Test Mode, this might fail if 'teacherEmail' isn't you.
        // We wrap it in a try/catch so one failure doesn't stop the whole robot.
        try {
            await resend.emails.send({
                from: 'KursNavi <onboarding@resend.dev>',
                to: teacherEmail, 
                bcc: ADMIN_EMAIL, // You always get a copy secretly
                subject: `Payout Alert: ${course.title}`,
                html: `
                  <h1>Payout Processed</h1>
                  <p>Hello Teacher,</p>
                  <p>Your course <strong>${course.title}</strong> is starting soon.</p>
                  <p>Payout Amount: <strong>CHF ${payoutAmount}</strong></p>
                  <h3>Student List:</h3>
                  <ul>${listHtml}</ul>
                `
            });
            emailsSent++;
        } catch (emailError) {
            console.error(`Failed to send email to ${teacherEmail}:`, emailError);
        }
    }

    return res.status(200).json({
      success: true,
      message: "Payouts Processed",
      emailsSent: emailsSent
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}