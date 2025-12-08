import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const config = {
  api: {
    bodyParser: false,
  },
};

// --- EMAIL HELPERS ---
const EMAIL_TRANSLATIONS = {
  en: {
    student_subject: "Booking Confirmed: ",
    student_title: "You are booked!",
    student_body: (course, date) => `You have successfully booked <strong>${course}</strong>.<br>Start Date: ${date}`,
    teacher_subject: "New Student: ",
    teacher_title: "New Student!",
    teacher_body: (email, course, date) => `<strong>${email}</strong> has joined <strong>${course}</strong>.<br>This course starts soon (${date}).`,
    cta_view: "View Dashboard"
  },
  de: {
    student_subject: "Buchung bestätigt: ",
    student_title: "Du bist dabei!",
    student_body: (course, date) => `Du hast dich erfolgreich für <strong>${course}</strong> angemeldet.<br>Startdatum: ${date}`,
    teacher_subject: "Neuer Schüler: ",
    teacher_title: "Neuer Schüler!",
    teacher_body: (email, course, date) => `<strong>${email}</strong> hat sich für <strong>${course}</strong> angemeldet.<br>Kursbeginn: ${date}.`,
    cta_view: "Zum Dashboard"
  },
  fr: {
    student_subject: "Réservation confirmée : ",
    student_title: "C'est confirmé !",
    student_body: (course, date) => `Vous êtes inscrit à <strong>${course}</strong>.<br>Date de début : ${date}`,
    teacher_subject: "Nouvel étudiant : ",
    teacher_title: "Nouvel étudiant !",
    teacher_body: (email, course, date) => `<strong>${email}</strong> a rejoint <strong>${course}</strong>.<br>Début du cours : ${date}.`,
    cta_view: "Voir le tableau de bord"
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
      <a href="https://course-marketplace-nine.vercel.app/dashboard" class="btn">${ctaText}</a>
    </div>
    <div class="footer"><p>© ${new Date().getFullYear()} KursNavi Schweiz.</p></div>
  </div>
</body>
</html>
`;

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // --- KEYS CONFIGURATION ---
  const STRIPE_KEY = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpncNIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCiFyynGjhnJvjr00iYuBK9fk";
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  
  // ⚠️ 1. PASTE YOUR STRIPE SIGNING SECRET (whsec_...) HERE
  // You can find this in Stripe Dashboard > Webhooks > Signing Secret
  const WEBHOOK_SECRET = "whsec_y42SCCQu6MAPO9yU3LANjFFaPvMEGW8d"; 
  
  // ⚠️ 2. PASTE THE 'SERVICE_ROLE' KEY HERE (The one you just found in the Legacy tab)
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds"; 
  // --------------------------

  const stripe = new Stripe(STRIPE_KEY);
  
  // IMPORTANT: We use SERVICE_KEY here to have "God Mode" permissions
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const courseId = session.metadata.courseId;
    const customerEmail = session.customer_details.email;

    console.log(`💰 Processing Booking: User ${userId} -> Course ${courseId}`);

    // 1. Save Booking (With Error Check)
    const { error: bookingError } = await supabase.from('bookings').insert([{ user_id: userId, course_id: courseId }]);

    if (bookingError) {
        console.error('❌ FATAL: Database Rejected Booking:', bookingError);
        // This makes Stripe Logs turn RED if Supabase says no
        return res.status(500).json({ error: "Database Insert Failed", details: bookingError });
    }

    // 2. Get Course Info
    const { data: course } = await supabase.from('courses').select('title, start_date, user_id').eq('id', courseId).single();
    const courseTitle = course ? course.title : 'Course';
    const courseDate = course ? course.start_date : 'TBA';

    // 3. Determine Language
    let studentLang = 'de';
    if (userId) {
        const { data: profile } = await supabase.from('profiles').select('language').eq('id', userId).single();
        if (profile && profile.language) studentLang = profile.language;
    }
    const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS['de'];

    // 4. Send STUDENT Email
    try {
        await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: customerEmail,
            subject: `${sTexts.student_subject} ${courseTitle}`,
            html: generateEmailHtml(sTexts.student_title, sTexts.student_body(courseTitle, courseDate), sTexts.cta_view)
        });
    } catch (e) { console.error('Student Email Failed:', e); }

    // 5. Send TEACHER Email
    if (course && course.start_date) {
        const startDate = new Date(course.start_date);
        const today = new Date();
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(today.getMonth() + 1);

        if (startDate < oneMonthFromNow) {
            const teacherEmail = "btrespondek@gmail.com"; 
            let teacherLang = 'de';
            const tTexts = EMAIL_TRANSLATIONS[teacherLang];

            try {
                await resend.emails.send({
                    from: 'KursNavi <onboarding@resend.dev>',
                    to: teacherEmail,
                    subject: `${tTexts.teacher_subject} ${courseTitle}`,
                    html: generateEmailHtml(tTexts.teacher_title, tTexts.teacher_body(customerEmail, courseTitle, courseDate), tTexts.cta_view)
                });
            } catch (tError) { console.error('Teacher Email Failed:', tError); }
        }
    }
  }

  res.status(200).json({ received: true });
}