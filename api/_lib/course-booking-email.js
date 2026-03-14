import PDFDocument from 'pdfkit';
import { getBaseUrl } from './base-url.js';
import { getEmailConfig, resolveUserEmail, sendEmailOrThrow } from './email-config.js';

const COLORS = {
  primary: '#FA6E28',
  secondary: '#2563EB',
  text: '#1F2937',
  gray: '#F3F4F6',
  white: '#FFFFFF'
};

const EMAIL_TRANSLATIONS = {
  en: {
    student_subject: 'Booking Confirmed: ',
    student_title: "You're in!",
    student_body: (course, date, provider) => `Great news! You have successfully booked <strong>${course}</strong>.<br><br>The course starts on: <strong>${date}</strong>.<br>Your invoice is attached to this email.<br><br><small style="color:#6B7280;">Your contractual partner for this course is <strong>${provider}</strong>. KursNavi (LifeSkills360 GmbH) handles the payment processing.</small>`,
    student_body_flex: (course, location, provider) => `Great news! You have successfully booked <strong>${course}</strong>.<br><br>Location: <strong>${location}</strong><br>The exact date will be arranged directly with the provider.<br>Your invoice is attached to this email.<br><br><small style="color:#6B7280;">Your contractual partner for this course is <strong>${provider}</strong>. KursNavi (LifeSkills360 GmbH) handles the payment processing.</small>`,
    teacher_subject: 'New Student: ',
    teacher_title: 'New Booking Received',
    teacher_body: (email, course, date) => `<strong>${email}</strong> has just booked a spot in <strong>${course}</strong>.<br>Start Date: ${date}.`,
    teacher_body_flex: (email, course, location) => `<strong>${email}</strong> has just booked a spot in <strong>${course}</strong>.<br>Location: ${location}.<br>Please contact the student to arrange a date.`,
    overbooking_subject: 'Automatic Refund - ',
    overbooking_title: 'Automatic Refund',
    overbooking_body: (course, price) => `Unfortunately, the course "<strong>${course}</strong>" was already fully booked at the time of your booking.<br><br>The amount of CHF ${price} has been automatically refunded to your original payment method.<br><br>We apologize for the inconvenience.`,
    cta_view: 'Go to Dashboard'
  },
  de: {
    student_subject: 'Buchung bestätigt: ',
    student_title: 'Du bist dabei!',
    student_body: (course, date, provider) => `Gute Nachrichten! Du hast dich erfolgreich für <strong>${course}</strong> angemeldet.<br><br>Der Kurs beginnt am: <strong>${date}</strong>.<br>Deine Rechnung findest du im Anhang dieser E-Mail.<br><br><small style="color:#6B7280;">Dein Vertragspartner für diesen Kurs ist <strong>${provider}</strong>. Du buchst im eigenen Namen und bleibst als buchende Person Vertragspartner/in und zahlungspflichtig, auch wenn die Teilnahme für eine andere Person erfolgt. KursNavi (LifeSkills360 GmbH) wickelt die Zahlung technisch ab.</small>`,
    student_body_flex: (course, location, provider) => `Gute Nachrichten! Du hast dich erfolgreich für <strong>${course}</strong> angemeldet.<br><br>Ort: <strong>${location}</strong><br>Der genaue Termin wird direkt mit dem Anbieter vereinbart.<br>Deine Rechnung findest du im Anhang dieser E-Mail.<br><br><small style="color:#6B7280;">Dein Vertragspartner für diesen Kurs ist <strong>${provider}</strong>. Du buchst im eigenen Namen und bleibst als buchende Person Vertragspartner/in und zahlungspflichtig, auch wenn die Teilnahme für eine andere Person erfolgt. KursNavi (LifeSkills360 GmbH) wickelt die Zahlung technisch ab.</small>`,
    teacher_subject: 'Neuer Schüler: ',
    teacher_title: 'Neue Buchung erhalten',
    teacher_body: (email, course, date) => `<strong>${email}</strong> hat sich gerade für <strong>${course}</strong> angemeldet.<br>Kursbeginn: ${date}.`,
    teacher_body_flex: (email, course, location) => `<strong>${email}</strong> hat sich gerade für <strong>${course}</strong> angemeldet.<br>Ort: ${location}.<br>Bitte kontaktiere den Teilnehmer, um einen Termin zu vereinbaren.`,
    overbooking_subject: 'Automatische Rückerstattung - ',
    overbooking_title: 'Automatische Rückerstattung',
    overbooking_body: (course, price) => `Leider war der Kurs „<strong>${course}</strong>" zum Zeitpunkt deiner Buchung bereits ausgebucht.<br><br>Der Betrag von CHF ${price} wurde automatisch auf deine ursprüngliche Zahlungsmethode zurückerstattet.<br><br>Wir entschuldigen uns für die Unannehmlichkeiten.`,
    cta_view: 'Zum Dashboard'
  },
  fr: {
    student_subject: 'Réservation confirmée : ',
    student_title: "C'est confirmé !",
    student_body: (course, date, provider) => `Excellente nouvelle ! Vous êtes inscrit à <strong>${course}</strong>.<br><br>Le cours commence le : <strong>${date}</strong>.<br>Votre facture est jointe à cet e-mail.<br><br><small style="color:#6B7280;">Votre partenaire contractuel pour ce cours est <strong>${provider}</strong>. KursNavi (LifeSkills360 GmbH) assure le traitement du paiement.</small>`,
    student_body_flex: (course, location, provider) => `Excellente nouvelle ! Vous êtes inscrit à <strong>${course}</strong>.<br><br>Lieu : <strong>${location}</strong><br>La date exacte sera convenue directement avec le prestataire.<br>Votre facture est jointe à cet e-mail.<br><br><small style="color:#6B7280;">Votre partenaire contractuel pour ce cours est <strong>${provider}</strong>. KursNavi (LifeSkills360 GmbH) assure le traitement du paiement.</small>`,
    teacher_subject: 'Nouvel étudiant : ',
    teacher_title: 'Nouvelle réservation',
    teacher_body: (email, course, date) => `<strong>${email}</strong> vient de réserver une place pour <strong>${course}</strong>.<br>Date de début : ${date}.`,
    teacher_body_flex: (email, course, location) => `<strong>${email}</strong> vient de réserver une place pour <strong>${course}</strong>.<br>Lieu : ${location}.<br>Veuillez contacter l'étudiant pour convenir d'une date.`,
    overbooking_subject: 'Remboursement automatique - ',
    overbooking_title: 'Remboursement automatique',
    overbooking_body: (course, price) => `Malheureusement, le cours « <strong>${course}</strong> » était déjà complet au moment de votre réservation.<br><br>Le montant de CHF ${price} a été automatiquement remboursé sur votre méthode de paiement d'origine.<br><br>Nous nous excusons pour ce désagrément.`,
    cta_view: 'Voir le tableau de bord'
  }
};

export function calculatePayoutEligibleAt(paidAt, eventEndAt, eventStartAt, bookingType) {
  const DAYS_MS = 24 * 60 * 60 * 1000;

  if (bookingType === 'platform') {
    const eventRef = eventEndAt || eventStartAt;
    if (eventRef) {
      return new Date(new Date(eventRef).getTime() + 2 * DAYS_MS);
    }
    return new Date(new Date(paidAt).getTime() + 14 * DAYS_MS);
  }

  return null;
}

export function calculateAutoRefundUntil(paidAt, eventStartAt, bookingType) {
  if (bookingType === 'lead') {
    return null;
  }

  if (bookingType === 'platform_flex') {
    const paidDate = new Date(paidAt);
    return new Date(paidDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  if (bookingType === 'platform' && eventStartAt) {
    const eventDate = new Date(eventStartAt);
    const fourteenDaysBeforeEvent = new Date(eventDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    return fourteenDaysBeforeEvent > new Date() ? fourteenDaysBeforeEvent : null;
  }

  return null;
}

export function generateEmailHtml(title, bodyHtml, ctaText, ctaLink = `${getBaseUrl()}/dashboard`) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: ${COLORS.gray}; padding: 0; margin: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: ${COLORS.gray}; padding-bottom: 40px; }
    .container { max-width: 600px; margin: 0 auto; background-color: ${COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: ${COLORS.white}; padding: 30px 40px; text-align: center; border-bottom: 3px solid ${COLORS.primary}; }
    .header h1 { margin: 0; color: ${COLORS.primary}; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 40px; color: ${COLORS.text}; line-height: 1.6; font-size: 16px; }
    .btn-container { text-align: center; margin-top: 30px; }
    .btn { display: inline-block; background-color: ${COLORS.primary}; color: ${COLORS.white}; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
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
        <p>&copy; ${new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.</p>
        <p>Dies ist eine automatische Nachricht.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

async function generateInvoicePDF(invoiceData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text('KursNavi', { align: 'left' });
    doc.fontSize(10).text('Rechnung', { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, 90).lineTo(550, 90).strokeColor('#FA6E28').stroke();
    doc.moveDown(2);

    doc.fontSize(10).fillColor('#333');
    doc.text(`Rechnungsnummer: INV-${Date.now().toString().slice(-6)}`, 50, 110);
    doc.text(`Datum: ${new Date().toLocaleDateString('de-CH')}`, 50, 125);
    doc.text(`Leistungserbringer: ${invoiceData.providerName || 'Kursanbieter'}`, 50, 140);
    doc.text('Empfänger:', 300, 110);
    doc.text(`${invoiceData.customerEmail}`, 300, 125);

    const tableTop = 210;
    doc.font('Helvetica-Bold').text('Beschreibung', 50, tableTop);
    doc.text('Betrag (CHF)', 450, tableTop, { align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#ccc').stroke();

    const itemTop = tableTop + 30;
    doc.font('Helvetica').text(invoiceData.courseTitle, 50, itemTop);
    doc.text((invoiceData.amount / 100).toFixed(2), 450, itemTop, { align: 'right' });

    doc.moveTo(50, itemTop + 30).lineTo(550, itemTop + 30).strokeColor('#000').stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total CHF', 350, itemTop + 45);
    doc.text((invoiceData.amount / 100).toFixed(2), 450, itemTop + 45, { align: 'right' });

    doc.fontSize(8).fillColor('#666');
    doc.text(`Vertragspartner: ${invoiceData.providerName || 'Kursanbieter'} (Kursanbieter). Der Kursvertrag besteht zwischen buchender Person und Anbieter.`, 50, 650, { width: 500 });
    doc.text('Zahlungsabwicklung: LifeSkills360 GmbH (KursNavi).', 50, 665);
    doc.fontSize(8).fillColor('#888');
    doc.text('Vielen Dank für Ihre Buchung bei KursNavi.', 50, 700, { align: 'center' });
    doc.end();
  });
}

export async function sendCourseBookingEmails({
  supabase,
  resend,
  dashboardUrl,
  userId,
  customerEmail,
  course,
  bookingType,
  courseTitle,
  courseDate,
  courseLocation,
  providerName,
  amountTotal
}) {
  let studentLang = 'de';
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
    if (profile?.language) studentLang = profile.language;
  }
  const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS.de;
  const emailConfig = getEmailConfig();

  let pdfBuffer = null;
  try {
    pdfBuffer = await generateInvoicePDF({
      courseTitle,
      amount: amountTotal,
      customerEmail,
      providerName
    });
  } catch (pdfErr) {
    console.error('PDF Generation Failed:', pdfErr);
  }

  if (customerEmail) {
    try {
      const emailBody = bookingType === 'platform_flex'
        ? sTexts.student_body_flex(courseTitle, courseLocation, providerName)
        : sTexts.student_body(courseTitle, courseDate, providerName);

      await sendEmailOrThrow(resend, 'course-booking-student', {
        from: emailConfig.from,
        to: customerEmail,
        subject: `${sTexts.student_subject}${courseTitle}`,
        html: generateEmailHtml(sTexts.student_title, emailBody, sTexts.cta_view, dashboardUrl),
        attachments: pdfBuffer ? [{
          filename: 'Rechnung_KursNavi.pdf',
          content: pdfBuffer
        }] : []
      });
    } catch (error) {
      console.error('Student Email Failed:', error);
    }
  }

  if (!course?.user_id) {
    return;
  }

  const { data: teacherProfile } = await supabase
    .from('profiles')
    .select('email, language')
    .eq('id', course.user_id)
    .maybeSingle();

  const teacherEmail = await resolveUserEmail(supabase, course.user_id, teacherProfile?.email);
  const teacherLang = teacherProfile?.language || 'de';
  const tTexts = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS.de;

  if (!teacherEmail) {
    console.warn('[email] course-booking-teacher skipped: missing provider email', {
      courseId: course?.id,
      providerUserId: course?.user_id
    });
    return;
  }

  try {
    const teacherBody = bookingType === 'platform_flex'
      ? tTexts.teacher_body_flex(customerEmail, courseTitle, courseLocation)
      : tTexts.teacher_body(customerEmail, courseTitle, courseDate);

    await sendEmailOrThrow(resend, 'course-booking-teacher', {
      from: emailConfig.from,
      to: teacherEmail,
      subject: `${tTexts.teacher_subject}${courseTitle}`,
      html: generateEmailHtml(tTexts.teacher_title, teacherBody, tTexts.cta_view, dashboardUrl)
    });
  } catch (error) {
    console.error('Teacher Email Failed:', error);
  }
}

export async function sendBookingAutoRefundEmail({
  supabase,
  resend,
  dashboardUrl,
  userId,
  customerEmail,
  courseTitle,
  amountTotal
}) {
  let studentLang = 'de';
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
    if (profile?.language) studentLang = profile.language;
  }

  const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS.de;
  const emailConfig = getEmailConfig();

  if (customerEmail) {
    try {
      await sendEmailOrThrow(resend, 'booking-auto-refund-student', {
        from: emailConfig.from,
        to: customerEmail,
        subject: `${sTexts.overbooking_subject}${courseTitle}`,
        html: generateEmailHtml(
          sTexts.overbooking_title,
          sTexts.overbooking_body(courseTitle, (amountTotal / 100).toFixed(2)),
          sTexts.cta_view,
          dashboardUrl
        )
      });
    } catch (error) {
      console.error('Overbooking email failed:', error);
    }
  }
}
