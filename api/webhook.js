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
    student_body_flex: (course, location) => `Great news! You have successfully booked <strong>${course}</strong>.<br><br>Location: <strong>${location}</strong><br>The exact date will be arranged directly with the provider.<br>Your invoice is attached to this email.`,
    teacher_subject: "New Student: ",
    teacher_title: "New Booking Received 🚀",
    teacher_body: (email, course, date) => `<strong>${email}</strong> has just booked a spot in <strong>${course}</strong>.<br>Start Date: ${date}.`,
    teacher_body_flex: (email, course, location) => `<strong>${email}</strong> has just booked a spot in <strong>${course}</strong>.<br>Location: ${location}.<br>Please contact the student to arrange a date.`,
    overbooking_subject: "Automatic Refund - ",
    overbooking_title: "Automatic Refund",
    overbooking_body: (course, price) => `Unfortunately, the course "<strong>${course}</strong>" was already fully booked at the time of your booking.<br><br>The amount of CHF ${price} has been automatically refunded to your original payment method.<br><br>We apologize for the inconvenience.`,
    cta_view: "Go to Dashboard"
  },
  de: {
    student_subject: "Buchung bestätigt: ",
    student_title: "Du bist dabei! 🎉",
    student_body: (course, date) => `Gute Nachrichten! Du hast dich erfolgreich für <strong>${course}</strong> angemeldet.<br><br>Der Kurs beginnt am: <strong>${date}</strong>.<br>Deine Rechnung findest du im Anhang dieser E-Mail.`,
    student_body_flex: (course, location) => `Gute Nachrichten! Du hast dich erfolgreich für <strong>${course}</strong> angemeldet.<br><br>Ort: <strong>${location}</strong><br>Der genaue Termin wird direkt mit dem Anbieter vereinbart.<br>Deine Rechnung findest du im Anhang dieser E-Mail.`,
    teacher_subject: "Neuer Schüler: ",
    teacher_title: "Neue Buchung erhalten 🚀",
    teacher_body: (email, course, date) => `<strong>${email}</strong> hat sich gerade für <strong>${course}</strong> angemeldet.<br>Kursbeginn: ${date}.`,
    teacher_body_flex: (email, course, location) => `<strong>${email}</strong> hat sich gerade für <strong>${course}</strong> angemeldet.<br>Ort: ${location}.<br>Bitte kontaktiere den Teilnehmer, um einen Termin zu vereinbaren.`,
    overbooking_subject: "Automatische Rückerstattung - ",
    overbooking_title: "Automatische Rückerstattung",
    overbooking_body: (course, price) => `Leider war der Kurs "<strong>${course}</strong>" zum Zeitpunkt deiner Buchung bereits ausgebucht.<br><br>Der Betrag von CHF ${price} wurde automatisch auf deine ursprüngliche Zahlungsmethode zurückerstattet.<br><br>Wir entschuldigen uns für die Unannehmlichkeiten.`,
    cta_view: "Zum Dashboard"
  },
  fr: {
    student_subject: "Réservation confirmée : ",
    student_title: "C'est confirmé ! 🎉",
    student_body: (course, date) => `Excellente nouvelle ! Vous êtes inscrit à <strong>${course}</strong>.<br><br>Le cours commence le : <strong>${date}</strong>.<br>Votre facture est jointe à cet e-mail.`,
    student_body_flex: (course, location) => `Excellente nouvelle ! Vous êtes inscrit à <strong>${course}</strong>.<br><br>Lieu : <strong>${location}</strong><br>La date exacte sera convenue directement avec le prestataire.<br>Votre facture est jointe à cet e-mail.`,
    teacher_subject: "Nouvel étudiant : ",
    teacher_title: "Nouvelle réservation 🚀",
    teacher_body: (email, course, date) => `<strong>${email}</strong> vient de réserver une place pour <strong>${course}</strong>.<br>Date de début : ${date}.`,
    teacher_body_flex: (email, course, location) => `<strong>${email}</strong> vient de réserver une place pour <strong>${course}</strong>.<br>Lieu : ${location}.<br>Veuillez contacter l'étudiant pour convenir d'une date.`,
    overbooking_subject: "Remboursement automatique - ",
    overbooking_title: "Remboursement automatique",
    overbooking_body: (course, price) => `Malheureusement, le cours "<strong>${course}</strong>" était déjà complet au moment de votre réservation.<br><br>Le montant de CHF ${price} a été automatiquement remboursé sur votre méthode de paiement d'origine.<br><br>Nous nous excusons pour ce désagrément.`,
    cta_view: "Voir le tableau de bord"
  }
};

// --- 3.1 PAYOUT ELIGIBILITY CALCULATION ---
function calculatePayoutEligibleAt(paidAt, eventStartAt, bookingType) {
  const DAYS_MS = 24 * 60 * 60 * 1000;

  if (bookingType === 'platform' && eventStartAt) {
    // Payout after event completion: event_start + 2 days
    return new Date(new Date(eventStartAt).getTime() + 2 * DAYS_MS);
  }

  // platform_flex or platform without event: 14 days after payment
  return new Date(new Date(paidAt).getTime() + 14 * DAYS_MS);
}

// --- 3.2 AUTO-REFUND CALCULATION ---
function calculateAutoRefundUntil(paidAt, eventStartAt, bookingType) {
  if (bookingType === 'lead') {
    return null;
  }

  const paidDate = new Date(paidAt);
  const sevenDaysAfterPayment = new Date(paidDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (bookingType === 'platform_flex') {
    return sevenDaysAfterPayment;
  }

  // platform with event
  if (bookingType === 'platform' && eventStartAt) {
    const eventDate = new Date(eventStartAt);
    const sevenDaysBeforeEvent = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Event in less than 7 days → no auto-refund
    if (sevenDaysBeforeEvent <= paidDate) {
      return null;
    }

    return sevenDaysAfterPayment < sevenDaysBeforeEvent ? sevenDaysAfterPayment : sevenDaysBeforeEvent;
  }

  return null;
}

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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(process.env.RESEND_API_KEY);

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata || {};

    // Skip if this is a capture_service payment (handled separately below)
    if (metadata.type === 'capture_service') {
      // Will be handled in the capture service section
    } else if (metadata.courseId) {
      // --- COURSE BOOKING HANDLING (v2) ---
      const userId = metadata.userId;
      const courseId = metadata.courseId;
      const eventId = metadata.eventId || null;
      const bookingType = metadata.bookingType || 'platform';
      const customerEmail = session.customer_details?.email;
      const amountTotal = session.amount_total;

      // 1. Idempotency check: Already processed?
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('stripe_checkout_session_id', session.id)
        .single();

      if (existingBooking) {
        return res.status(200).json({ received: true, note: 'Already processed' });
      }

      // 2. Get course and event info
      const { data: course } = await supabase
        .from('courses')
        .select('title, city, canton, user_id, ticket_limit_30d')
        .eq('id', courseId)
        .single();

      let eventStartAt = null;
      let eventLocation = null;
      if (eventId) {
        const { data: eventData } = await supabase
          .from('course_events')
          .select('start_date, location, city')
          .eq('id', eventId)
          .single();
        eventStartAt = eventData?.start_date;
        eventLocation = eventData?.location || eventData?.city;
      }

      const courseTitle = course?.title || 'Kurs';
      const courseLocation = eventLocation || course?.city || course?.canton || '';
      const courseDate = eventStartAt ? new Date(eventStartAt).toLocaleDateString('de-CH') : 'TBA';

      // 3. Reserve ticket (with lock) for platform/platform_flex
      let periodId = null;
      if (bookingType !== 'lead' && course?.ticket_limit_30d) {
        const { data: ticketResult, error: ticketError } = await supabase.rpc('reserve_ticket', {
          p_course_id: courseId
        });

        if (ticketError || !ticketResult?.[0]?.success) {
          // Auto-refund
          try {
            await stripe.refunds.create({ payment_intent: session.payment_intent });
          } catch (refundErr) {
            console.error('Stripe refund failed:', refundErr);
          }

          // Send overbooking email to user
          let studentLang = 'de';
          if (userId) {
            const { data: profile } = await supabase.from('profiles').select('language').eq('id', userId).single();
            if (profile?.language) studentLang = profile.language;
          }
          const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS['de'];

          try {
            await resend.emails.send({
              from: 'KursNavi <info@kursnavi.ch>',
              to: customerEmail,
              subject: `${sTexts.overbooking_subject}${courseTitle}`,
              html: generateEmailHtml(
                sTexts.overbooking_title,
                sTexts.overbooking_body(courseTitle, (amountTotal / 100).toFixed(2)),
                sTexts.cta_view
              )
            });
          } catch (emailErr) {
            console.error('Overbooking email failed:', emailErr);
          }

          return res.status(200).json({ received: true, note: 'Ticket unavailable, auto-refunded' });
        }
        periodId = ticketResult[0].period_id;
      }

      // 4. Calculate timestamps
      const paidAt = new Date();
      const autoRefundUntil = calculateAutoRefundUntil(paidAt, eventStartAt, bookingType);
      const payoutEligibleAt = calculatePayoutEligibleAt(paidAt, eventStartAt, bookingType);

      // 5. Create booking
      const { error: insertError } = await supabase.from('bookings').insert({
        user_id: userId,
        course_id: courseId,
        event_id: eventId || null,
        status: 'confirmed',
        booking_type: bookingType,
        paid_at: paidAt.toISOString(),
        auto_refund_until: autoRefundUntil?.toISOString() || null,
        payout_eligible_at: payoutEligibleAt.toISOString(),
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_session_id: session.id,
        ticket_period_id: periodId
      });

      if (insertError) {
        // Duplicate via unique constraint? → idempotent ignore
        if (insertError.code === '23505') {
          return res.status(200).json({ received: true, note: 'Duplicate, ignored' });
        }
        console.error('Database Rejected Booking:', insertError);
        return res.status(500).json({ error: "Database Insert Failed", details: insertError });
      }

      // 6. Determine language for emails
      let studentLang = 'de';
      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('language').eq('id', userId).single();
        if (profile?.language) studentLang = profile.language;
      }
      const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS['de'];

      // 7. Generate PDF Invoice
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

      // 8. Send STUDENT Email (adapted for flex)
      try {
        const emailBody = bookingType === 'platform_flex'
          ? sTexts.student_body_flex(courseTitle, courseLocation)
          : sTexts.student_body(courseTitle, courseDate);

        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: customerEmail,
          subject: `${sTexts.student_subject}${courseTitle}`,
          html: generateEmailHtml(sTexts.student_title, emailBody, sTexts.cta_view),
          attachments: pdfBuffer ? [{
            filename: 'Rechnung_KursNavi.pdf',
            content: pdfBuffer
          }] : []
        });
      } catch (e) { console.error('Student Email Failed:', e); }

      // 9. Send TEACHER Email
      if (course?.user_id) {
        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('email, language')
          .eq('id', course.user_id)
          .single();

        const teacherEmail = teacherProfile?.email || 'btrespondek@gmail.com';
        const teacherLang = teacherProfile?.language || 'de';
        const tTexts = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS['de'];

        try {
          const teacherBody = bookingType === 'platform_flex'
            ? tTexts.teacher_body_flex(customerEmail, courseTitle, courseLocation)
            : tTexts.teacher_body(customerEmail, courseTitle, courseDate);

          await resend.emails.send({
            from: 'KursNavi <info@kursnavi.ch>',
            to: teacherEmail,
            subject: `${tTexts.teacher_subject}${courseTitle}`,
            html: generateEmailHtml(tTexts.teacher_title, teacherBody, tTexts.cta_view)
          });
        } catch (tError) { console.error('Teacher Email Failed:', tError); }
      }
    }

    // --- PACKAGE UPGRADE HANDLING ---
    else if (metadata.type === 'package_upgrade') {
      const userId = metadata.userId;
      const targetTier = metadata.targetTier;
      const isRenewal = metadata.isRenewal === 'true';
      const currentExpiresAt = metadata.currentExpiresAt || null;
      const customerEmail = session.customer_details?.email;
      const amountTotal = session.amount_total;

      // 1. Idempotency check
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('package_stripe_session_id')
        .eq('id', userId)
        .single();

      if (existingProfile?.package_stripe_session_id === session.id) {
        return res.status(200).json({ received: true, note: 'Package upgrade already processed' });
      }

      // 2. Calculate new expiry date
      let newExpiresAt;
      if (isRenewal && currentExpiresAt) {
        // Extend from current expiry, not from today
        newExpiresAt = new Date(currentExpiresAt);
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);
      } else {
        // Fresh upgrade: 1 year from now
        newExpiresAt = new Date();
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);
      }

      // 3. Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          package_tier: targetTier,
          package_expires_at: newExpiresAt.toISOString(),
          package_stripe_session_id: session.id,
          package_reminder_sent: null, // Reset reminders for new cycle
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update package tier:', updateError);
      }

      // 4. Tier label for emails
      const tierLabels = { pro: 'Pro', premium: 'Premium', enterprise: 'Enterprise' };
      const tierLabel = tierLabels[targetTier] || targetTier;
      const expiryFormatted = newExpiresAt.toLocaleDateString('de-CH');

      // 5. Send confirmation email to user
      try {
        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: customerEmail,
          subject: `Dein KursNavi ${tierLabel} Paket ist aktiv!`,
          html: generateEmailHtml(
            isRenewal ? 'Abo erfolgreich verlängert!' : `Willkommen beim ${tierLabel} Paket!`,
            `<p>Vielen Dank für ${isRenewal ? 'die Verlängerung' : 'dein Upgrade zum'} <strong>${tierLabel}</strong> Paket.</p>
             <p>Dein Abo ist gültig bis: <strong>${expiryFormatted}</strong></p>
             <p>Betrag: <strong>CHF ${(amountTotal / 100).toFixed(2)}</strong></p>`,
            'Zum Dashboard'
          )
        });
      } catch (emailError) {
        console.error('Package upgrade email failed:', emailError);
      }

      // 6. Notify admin
      try {
        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: 'info@kursnavi.ch',
          subject: `Neues ${tierLabel} Paket: ${customerEmail}`,
          html: generateEmailHtml(
            `Neues ${tierLabel} Paket ${isRenewal ? '(Verlängerung)' : '(Upgrade)'}`,
            `<p><strong>Kunde:</strong> ${customerEmail}</p>
             <p><strong>Paket:</strong> ${tierLabel}</p>
             <p><strong>Gültig bis:</strong> ${expiryFormatted}</p>
             <p><strong>Betrag:</strong> CHF ${(amountTotal / 100).toFixed(2)}</p>
             <p><strong>Typ:</strong> ${isRenewal ? 'Verlängerung' : 'Neu-Upgrade'}</p>`,
            'Admin Panel öffnen'
          )
        });
      } catch (adminEmailError) {
        console.error('Admin notification for package upgrade failed:', adminEmailError);
      }
    }
  }

  // --- CAPTURE SERVICE PAYMENT HANDLING ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata || {};

    // Prüfe ob es eine Capture-Service-Zahlung ist
    if (metadata.type === 'capture_service') {
        const userId = metadata.userId;
        const requestId = metadata.requestId;
        const courseCount = parseInt(metadata.courseCount || '0', 10);
        const customerEmail = session.customer_details?.email;

        // 1. Update Request Status
        if (requestId && requestId !== 'new') {
            const { error: updateError } = await supabase
                .from('capture_service_requests')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    stripe_session_id: session.id
                })
                .eq('id', requestId);

            if (updateError) {
                console.error('Failed to update capture_service_requests:', updateError);
            }
        }

        // 2. Update used_capture_services in profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('used_capture_services')
            .eq('id', userId)
            .single();

        const currentUsed = profile?.used_capture_services || 0;

        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                used_capture_services: currentUsed + courseCount
            })
            .eq('id', userId);

        if (profileError) {
            console.error('Failed to update used_capture_services:', profileError);
        }

        // 3. Send Confirmation Email to User
        try {
            await resend.emails.send({
                from: 'KursNavi <info@kursnavi.ch>',
                to: customerEmail,
                subject: 'Kurserfassungs-Service bestätigt',
                html: generateEmailHtml(
                    'Deine Bestellung ist eingegangen! 🎉',
                    `<p>Vielen Dank für deine Bestellung des Kurserfassungs-Services.</p>
                     <p>Wir erfassen <strong>${courseCount} Kurs(e)</strong> für dich mit professioneller SEO-Optimierung, Bild-Bearbeitung und Qualitäts-Check.</p>
                     <p>Unser Team wird sich innerhalb von 2-3 Werktagen bei dir melden.</p>`,
                    'Zum Dashboard'
                )
            });
        } catch (emailError) {
            console.error('Capture service email failed:', emailError);
        }

        // 4. Notify Admin
        try {
            await resend.emails.send({
                from: 'KursNavi <info@kursnavi.ch>',
                to: 'info@kursnavi.ch',
                subject: `🎯 Neuer Erfassungsservice: ${courseCount} Kurse`,
                html: generateEmailHtml(
                    'Neuer Kurserfassungs-Service Auftrag',
                    `<p><strong>Kunde:</strong> ${customerEmail}</p>
                     <p><strong>Anzahl Kurse:</strong> ${courseCount}</p>
                     <p><strong>Request ID:</strong> ${requestId || 'N/A'}</p>
                     <p><strong>Betrag:</strong> CHF ${(session.amount_total / 100).toFixed(2)}</p>`,
                    'Admin Panel öffnen',
                    'https://kursnavi.ch/admin'
                )
            });
        } catch (adminEmailError) {
            console.error('Admin notification failed:', adminEmailError);
        }
    }
  }

  // --- STRIPE CONNECT ACCOUNT UPDATES ---
  if (event.type === 'account.updated') {
    const account = event.data.object;
    const accountId = account.id;

    // Check if account has completed onboarding
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    const detailsSubmitted = account.details_submitted;

    const onboardingComplete = chargesEnabled && payoutsEnabled && detailsSubmitted;

    // Update profile in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_connect_onboarding_complete: onboardingComplete
      })
      .eq('stripe_connect_account_id', accountId);

    if (updateError) {
      console.error('Failed to update Connect onboarding status:', updateError);
    }
  }

  res.status(200).json({ received: true });
}