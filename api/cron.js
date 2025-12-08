import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// --- EMAIL HELPERS ---
const EMAIL_TRANSLATIONS = {
  en: {
    subject: "Payout Alert: ",
    title: "Payout Processed",
    body: (course, amount, list) => `Hello Teacher,<br>Your course <strong>${course}</strong> is starting soon.<br>Payout Amount: <strong>CHF ${amount}</strong><br><h3>Student List:</h3><ul>${list}</ul>`,
    cta: "Check Bank Details"
  },
  de: {
    subject: "Auszahlung: ",
    title: "Auszahlung bearbeitet",
    body: (course, amount, list) => `Hallo Kursleiter,<br>Dein Kurs <strong>${course}</strong> startet bald.<br>Auszahlungsbetrag: <strong>CHF ${amount}</strong><br><h3>Teilnehmerliste:</h3><ul>${list}</ul>`,
    cta: "Bankdaten prüfen"
  },
  fr: {
    subject: "Paiement : ",
    title: "Paiement traité",
    body: (course, amount, list) => `Bonjour,<br>Votre cours <strong>${course}</strong> commence bientôt.<br>Montant du paiement : <strong>CHF ${amount}</strong><br><h3>Liste des étudiants :</h3><ul>${list}</ul>`,
    cta: "Vérifier les coordonnées"
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
      <a href="https://www.kursnavi.ch/dashboard" class="btn">${ctaText}</a>
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} KursNavi Schweiz.</p></div>
  </div>
</body>
</html>
`;

export default async function handler(req, res) {

  // --- SECURE KEYS ---
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = 'btrespondek@gmail.com'; 

  if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_KEY) {
      return res.status(500).json({ error: "Keys missing in Vercel." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    // 1. Calculate Search Window (Today + 1 Month +/- 5 Days)
    const today = new Date();
    const startWindowDate = new Date(today);
    startWindowDate.setDate(today.getDate() + 25); 
    const startWindow = `${startWindowDate.toISOString().split('T')[0]}T00:00:00`;

    const endWindowDate = new Date(today);
    endWindowDate.setDate(today.getDate() + 35); 
    const endWindow = `${endWindowDate.toISOString().split('T')[0]}T23:59:59`;

    // 2. Find Courses
    const { data: courses } = await supabase.from('courses').select('*').gte('start_date', startWindow).lte('start_date', endWindow);

    if (!courses || courses.length === 0) {
      return res.status(200).json({ message: "No courses found in window." });
    }

    let emailsSent = 0;

    for (const course of courses) {
        
        // 3. Find Unpaid Bookings
        const { data: bookings } = await supabase.from('bookings').select('*').eq('course_id', course.id);

        if (!bookings || bookings.length === 0) continue;

        const unpaidBookings = bookings.filter(b => b.is_paid !== true);
        if (unpaidBookings.length === 0) continue;

        // 4. FETCH TEACHER EMAIL & LANGUAGE
        let teacherEmail = ADMIN_EMAIL; 
        let teacherLang = 'en';

        if (course.user_id) {
            const { data: teacherProfile } = await supabase.from('profiles').select('email, language').eq('id', course.user_id).single();
            if (teacherProfile) {
                if (teacherProfile.email) teacherEmail = teacherProfile.email;
                if (teacherProfile.language) teacherLang = teacherProfile.language;
            }
        }
        
        const t = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS['en'];

        // 5. Fetch Student Names
        const userIds = unpaidBookings.map(b => b.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);

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
        try {
            await resend.emails.send({
                from: 'KursNavi <onboarding@resend.dev>',
                to: teacherEmail, 
                bcc: ADMIN_EMAIL, 
                subject: `${t.subject} ${course.title}`,
                html: generateEmailHtml(t.title, t.body(course.title, payoutAmount, listHtml), t.cta)
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