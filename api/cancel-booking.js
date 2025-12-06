import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {
  // Only allow POST requests (sending data)
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // --- ⚠️ PASTE YOUR KEYS HERE ⚠️ ---

  // 1. SUPABASE URL
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";

  // 2. SUPABASE SERVICE ROLE KEY (The long one starting with eyJ...)
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";

  // 3. RESEND API KEY (The one starting with re_...)
  const RESEND_KEY = "PASTE_YOUR_RESEND_KEY_HERE"; 

  // ----------------------------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  const { courseId, userId, courseTitle, studentEmail } = req.body;

  try {
    // 1. Delete the booking from Supabase
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .match({ course_id: courseId, user_id: userId });

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 2. Send the Cancellation Email
    try {
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: studentEmail,
            subject: `Cancellation Confirmed: ${courseTitle}`,
            html: `
              <h1>Booking Cancelled</h1>
              <p>Your booking for <strong>${courseTitle}</strong> has been successfully cancelled.</p>
              <p>If you have any questions, please reply to this email.</p>
              <br />
              <p>Best,<br/>The KursNavi Team</p>
            `
        });
        console.log('✅ Cancellation email sent to:', studentEmail);
    } catch (emailError) {
        console.error('❌ Email failed (but booking was cancelled):', emailError);
        // We don't stop the process here, because the booking IS cancelled.
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Cancellation Error:', error);
    return res.status(500).json({ error: error.message });
  }
}