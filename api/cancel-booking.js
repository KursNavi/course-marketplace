import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// --- EMAIL HELPERS ---
const EMAIL_TRANSLATIONS = {
  en: {
    subject: "Cancellation Confirmed: ",
    title: "Booking Cancelled",
    body: (course) => `Your booking for <strong>${course}</strong> has been successfully cancelled.<br>If you have any questions, please reply to this email.`,
    cta: "Return to KursNavi"
  },
  de: {
    subject: "Stornierung bestätigt: ",
    title: "Buchung storniert",
    body: (course) => `Deine Buchung für <strong>${course}</strong> wurde erfolgreich storniert.<br>Falls du Fragen hast, antworte einfach auf diese Email.`,
    cta: "Zurück zu KursNavi"
  },
  fr: {
    subject: "Annulation confirmée : ",
    title: "Réservation annulée",
    body: (course) => `Votre réservation pour <strong>${course}</strong> a été annulée avec succès.<br>Si vous avez des questions, répondez à cet email.`,
    cta: "Retour à KursNavi"
  }
};

const generateEmailHtml = (title, bodyHtml, ctaText) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background-color: #FA6E28; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
    .content { padding: 30px; color: #333333; line-height: 1.6; }
    .btn { display: inline-block; background-color: #FA6E28; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
    .footer { background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>KursNavi</h1></div>
    <div class="content">
      <h2>${title}</h2>
      <p>${bodyHtml}</p>
      <a href="https://www.kursnavi.ch" class="btn">${ctaText}</a>
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} KursNavi Schweiz.</p></div>
  </div>
</body>
</html>
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // --- ⚠️ PASTE YOUR KEYS HERE ⚠️ ---
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds"; 
  // ----------------------------------

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  const { courseId, userId, courseTitle, studentEmail } = req.body;

  try {
    // 1. Delete the booking
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .match({ course_id: courseId, user_id: userId });

    if (deleteError) { throw new Error(deleteError.message); }

    // 2. Determine Language
    // --- UPDATED: Default fallback is 'de' ---
    let lang = 'de';
    if (userId) {
        const { data: profile } = await supabase.from('profiles').select('language').eq('id', userId).single();
        if (profile && profile.language) lang = profile.language;
    }
    const t = EMAIL_TRANSLATIONS[lang] || EMAIL_TRANSLATIONS['de'];

    // 3. Send Email
    try {
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: studentEmail,
            subject: `${t.subject} ${courseTitle}`,
            html: generateEmailHtml(t.title, t.body(courseTitle), t.cta)
        });
        console.log('✅ Cancellation email sent to:', studentEmail);
    } catch (emailError) {
        console.error('❌ Email failed (but booking was cancelled):', emailError);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Cancellation Error:', error);
    return res.status(500).json({ error: error.message });
  }
}