import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';

export const config = {
  api: {
    bodyParser: false,
  },
};

// --- 1. DESIGN SYSTEM (Branding) ---
const COLORS = {
  primary: '#FA6E28', // Orange
  secondary: '#2563EB', // Blue
  text: '#1F2937',
  gray: '#F3F4F6',
  white: '#FFFFFF'
};

// --- 2. HTML EMAIL TEMPLATE ---
const generateEmailHtml = (title, bodyHtml, ctaText, ctaLink = "https://kursnavi.ch/dashboard") => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: ${COLORS.gray}; padding: 0; margin: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: ${COLORS.gray}; padding-bottom: 40px; }
    .container { max-width: 600px; margin: 0 auto; background-color: ${COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: ${COLORS.white}; padding: 30px 40px; text-align: center; border-bottom: 3px solid ${COLORS.primary}; }
    .header h1 { margin: 0; color: ${COLORS.primary}; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 40px; color: ${COLORS.text}; line-height: 1.6; font-size: 16px; }
    .btn-container { text-align: center; margin-top: 30px; }
    .btn { display: inline-block; background-color: ${COLORS.primary}; color: ${COLORS.white}; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: background 0.3s; }
    .footer { background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
    strong { color: ${COLORS.secondary}; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header"><h1>KursNavi</h1></div>
      <div class="content">
        <h2 style="margin-top: 0; color: ${COLORS.text};">${title}</h2>
        <div style="color: #4B5563;">${bodyHtml}</div>
        <div class="btn-container">
          <a href="${ctaLink}" class="btn">${ctaText}</a>
        </div>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.</p>
        <p>Dies ist eine automatische Nachricht.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// --- 3. TEXTS & TRANSLATIONS ---
const EMAIL_TRANSLATIONS = {
  en: {
    student_subject: "Booking Confirmed: ",
    student_title: "You're in! 🎉",
    student_body: (course, date) => `Great news! You have successfully booked <strong>${course}</strong>.<br><br>The course starts on: <strong>${date}</strong>.<br>Your invoice is attached to this email.`,
    teacher_subject: "New Student: ",
    teacher_title: "New Booking Received 🚀",
    teacher_body: (email, course, date) => `<strong>${email}</strong> has just booked a spot in <strong>${course}</strong>.<br>Start Date: ${date}.`,
    cta_view: "Go to Dashboard"
  },
  de: {
    student_subject: "Buchung bestätigt: ",
    student_title: "Du bist dabei! 🎉",
    student_body: (course, date) => `Gute Nachrichten! Du hast dich erfolgreich für <strong>${course}</strong> angemeldet.<br><br>Der Kurs beginnt am: <strong>${date}</strong>.<br>Deine Rechnung findest du im Anhang dieser E-Mail.`,
    teacher_subject: "Neuer Schüler: ",
    teacher_title: "Neue Buchung erhalten 🚀",
    teacher_body: (email, course, date) => `<strong>${email}</strong> hat sich gerade für <strong>${course}</strong> angemeldet.<br>Kursbeginn: ${date}.`,
    cta_view: "Zum Dashboard"
  },
  fr: {
    student_subject: "Réservation confirmée : ",
    student_title: "C'est confirmé ! 🎉",
    student_body: (course, date) => `Excellente nouvelle ! Vous êtes inscrit à <strong>${course}</strong>.<br><br>Le cours commence le : <strong>${date}</strong>.<br>Votre facture est jointe à cet e-mail.`,
    teacher_subject: "Nouvel étudiant : ",
    teacher_title: "Nouvelle réservation 🚀",
    teacher_body: (email, course, date) => `<strong>${email}</strong> vient de réserver une place pour <strong>${course}</strong>.<br>Date de début : ${date}.`,
    cta_view: "Voir le tableau de bord"
  }
};

// --- 4. PDF INVOICE GENERATOR ---
const generateInvoicePDF = async (invoiceData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // -- Header --
    doc.fontSize(20).text('KursNavi', { align: 'left' });
    doc.fontSize(10).text('Rechnung', { align: 'right' });
    doc.moveDown();
    
    // -- Divider --
    doc.moveTo(50, 90).lineTo(550, 90).strokeColor('#FA6E28').stroke();
    doc.moveDown(2);

    // -- Details --
    doc.fontSize(10).fillColor('#333');
    doc.text(`Rechnungsnummer: INV-${Date.now().toString().slice(-6)}`, 50, 110);
    doc.text(`Datum: ${new Date().toLocaleDateString('de-CH')}`, 50, 125);
    
    doc.text(`Empfänger:`, 300, 110);
    doc.text(`${invoiceData.customerEmail}`, 300, 125);
    
    doc.moveDown(4);

    // -- Table Header --
    const tableTop = 200;
    doc.font('Helvetica-Bold').text('Beschreibung', 50, tableTop);
    doc.text('Betrag (CHF)', 450, tableTop, { align: 'right' });
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#ccc').stroke();

    // -- Table Row --
    const itemTop = tableTop + 30;
    doc.font('Helvetica').text(invoiceData.courseTitle, 50, itemTop);
    doc.text((invoiceData.amount / 100).toFixed(2), 450, itemTop, { align: 'right' });

    // -- Total --
    doc.moveTo(50, itemTop + 30).lineTo(550, itemTop + 30).strokeColor('#000').stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total CHF', 350, itemTop + 45);
    doc.text((invoiceData.amount / 100).toFixed(2), 450, itemTop + 45, { align: 'right' });

    // -- Footer --
    doc.fontSize(8).fillColor('#888');
    doc.text('Vielen Dank für Ihre Buchung bei KursNavi.', 50, 700, { align: 'center' });

    doc.end();
  });
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// --- 5. MAIN HANDLER ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const STRIPE_KEY = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpncNIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCiFyynGjhnJvjr00iYuBK9fk";
  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const WEBHOOK_SECRET = "whsec_y42SCCQu6MAPO9yU3LANjFFaPvMEGW8d"; 
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds"; 

  const stripe = new Stripe(STRIPE_KEY);
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
    const amountTotal = session.amount_total; // in cents

    console.log(`💰 Processing Booking: User ${userId} -> Course ${courseId}`);

    // 1. Save Booking
    const { error: bookingError } = await supabase.from('bookings').insert([{ user_id: userId, course_id: courseId }]);
    if (bookingError) {
        console.error('❌ Database Rejected Booking:', bookingError);
        return res.status(500).json({ error: "Database Insert Failed", details: bookingError });
    }

    // 2. Get Course Info
    const { data: course } = await supabase.from('courses').select('title, start_date, user_id').eq('id', courseId).single();
    const courseTitle = course ? course.title : 'Course';
    const courseDate = course ? new Date(course.start_date).toLocaleDateString('de-CH') : 'TBA';

    // 3. Determine Language
    let studentLang = 'de';
    if (userId) {
        const { data: profile } = await supabase.from('profiles').select('language').eq('id', userId).single();
        if (profile && profile.language) studentLang = profile.language;
    }
    const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS['de'];

    // 4. GENERATE PDF INVOICE
    let pdfBuffer = null;
    try {
        pdfBuffer = await generateInvoicePDF({
            courseTitle: courseTitle,
            amount: amountTotal,
            customerEmail: customerEmail
        });
    } catch (pdfErr) {
        console.error("PDF Generation Failed:", pdfErr);
    }

    // 5. Send STUDENT Email (With Attachment)
    try {
        const emailParams = {
            from: 'KursNavi <onboarding@resend.dev>', // TODO: Verifiziere deine Domain in Resend für "noreply@kursnavi.ch"
            to: customerEmail,
            subject: `${sTexts.student_subject} ${courseTitle}`,
            html: generateEmailHtml(sTexts.student_title, sTexts.student_body(courseTitle, courseDate), sTexts.cta_view),
            attachments: pdfBuffer ? [
                {
                    filename: 'Rechnung_KursNavi.pdf',
                    content: pdfBuffer
                }
            ] : []
        };
        
        await resend.emails.send(emailParams);
        console.log("✅ Student email sent with invoice.");
    } catch (e) { console.error('Student Email Failed:', e); }

    // 6. Send TEACHER Email
    if (course) {
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

  res.status(200).json({ received: true });
}