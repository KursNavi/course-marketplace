import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getDashboardUrl } from './_lib/base-url.js';

const EMAIL_TRANSLATIONS = {
  en: {
    student_subject: 'Refund Confirmed: ',
    student_title: 'Refund Processed',
    student_body: (course, amount, percent) => `Your booking for <strong>${course}</strong> has been cancelled and refunded (${percent} %).<br><br>Refund amount: <strong>CHF ${amount}</strong><br>The refund will appear on your original payment method within 5-10 business days.`,
    teacher_subject: 'Booking Cancelled: ',
    teacher_title: 'Booking Cancelled',
    teacher_body: (email, course, percent) => `<strong>${email}</strong> has cancelled their booking for <strong>${course}</strong>.<br>A ${percent} % refund has been processed automatically per the platform refund policy.`,
    cta: 'Go to Dashboard'
  },
  de: {
    student_subject: 'Rückerstattung bestätigt: ',
    student_title: 'Rückerstattung verarbeitet',
    student_body: (course, amount, percent) => `Deine Buchung für <strong>${course}</strong> wurde storniert und erstattet (${percent} %).<br><br>Erstattungsbetrag: <strong>CHF ${amount}</strong><br>Die Rückerstattung erscheint innerhalb von 5–10 Werktagen auf deiner ursprünglichen Zahlungsmethode.`,
    teacher_subject: 'Buchung storniert: ',
    teacher_title: 'Buchung storniert',
    teacher_body: (email, course, percent) => `<strong>${email}</strong> hat die Buchung für <strong>${course}</strong> storniert.<br>Gemäss der Plattform-Rückerstattungsrichtlinie wurde eine ${percent} %-Rückerstattung automatisch verarbeitet.`,
    cta: 'Zum Dashboard'
  },
  fr: {
    student_subject: 'Remboursement confirmé : ',
    student_title: 'Remboursement traité',
    student_body: (course, amount, percent) => `Votre réservation pour <strong>${course}</strong> a été annulée et remboursée (${percent} %).<br><br>Montant remboursé : <strong>CHF ${amount}</strong><br>Le remboursement apparaîtra sur votre méthode de paiement d'origine dans un délai de 5 à 10 jours ouvrables.`,
    teacher_subject: 'Réservation annulée : ',
    teacher_title: 'Réservation annulée',
    teacher_body: (email, course, percent) => `<strong>${email}</strong> a annulé sa réservation pour <strong>${course}</strong>.<br>Un remboursement de ${percent} % a été traité automatiquement selon la politique de remboursement de la plateforme.`,
    cta: 'Voir le tableau de bord'
  },
  it: {
    student_subject: 'Rimborso confermato: ',
    student_title: 'Rimborso elaborato',
    student_body: (course, amount, percent) => `La tua prenotazione per <strong>${course}</strong> è stata annullata e rimborsata (${percent} %).<br><br>Importo rimborsato: <strong>CHF ${amount}</strong><br>Il rimborso comparirà sul metodo di pagamento originale entro 5–10 giorni lavorativi.`,
    teacher_subject: 'Prenotazione annullata: ',
    teacher_title: 'Prenotazione annullata',
    teacher_body: (email, course, percent) => `<strong>${email}</strong> ha annullato la prenotazione per <strong>${course}</strong>.<br>È stato elaborato automaticamente un rimborso del ${percent} % secondo la politica della piattaforma.`,
    cta: 'Vai alla dashboard'
  }
};

const generateEmailHtml = (title, bodyHtml, ctaText, ctaLink) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F3F4F6; padding: 0; margin: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #F3F4F6; padding-bottom: 40px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: #FFFFFF; padding: 30px 40px; text-align: center; border-bottom: 3px solid #FA6E28; }
    .header h1 { margin: 0; color: #FA6E28; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 40px; color: #1F2937; line-height: 1.6; font-size: 16px; }
    .btn-container { text-align: center; margin-top: 30px; }
    .btn { display: inline-block; background-color: #FA6E28; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
    .footer { background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
    strong { color: #2563EB; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header"><h1>KursNavi</h1></div>
      <div class="content">
        <h2 style="margin-top: 0; color: #1F2937;">${title}</h2>
        <div style="color: #4B5563;">${bodyHtml}</div>
        <div class="btn-container">
          <a href="${ctaLink}" class="btn">${ctaText}</a>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

function isWithinAutoRefundWindow(booking) {
  return (
    booking.status === 'confirmed' &&
    booking.auto_refund_until !== null &&
    new Date() < new Date(booking.auto_refund_until)
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const dashboardUrl = getDashboardUrl(req);

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return res.status(401).json({ error: 'Ungueltiges oder abgelaufenes Token' });
    }

    const { bookingId } = req.body;
    const userId = authUser.id;

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, courses (id, title, price, user_id), course_events (id, start_date)')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Buchung nicht gefunden' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Buchung ist nicht aktiv' });
    }

    if (!isWithinAutoRefundWindow(booking)) {
      return res.status(400).json({
        error: 'Automatische Rückerstattung nicht mehr möglich. Du kannst stattdessen eine Kulanzanfrage an den Anbieter senden.',
        goodwill_available: true
      });
    }

    const refundPercent = 100;

    if (!booking.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'Keine Zahlungsinformationen vorhanden' });
    }

    let refundAmountCents;
    try {
      const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      refundAmountCents = pi.amount_received;

      if (pi.status !== 'succeeded') {
        console.error('PaymentIntent not in succeeded state:', pi.id, pi.status);
        return res.status(400).json({ error: `Zahlung ist im Status "${pi.status}" und kann nicht erstattet werden.` });
      }

      await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id });
    } catch (stripeError) {
      console.error('Stripe refund failed:', stripeError?.type, stripeError?.code, stripeError?.message);

      // If already refunded, proceed with status update
      if (stripeError?.code === 'charge_already_refunded') {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
        refundAmountCents = pi.amount_received;
      } else {
        const detail = stripeError?.message || 'Unbekannter Stripe-Fehler';
        return res.status(500).json({ error: `Rückerstattung fehlgeschlagen: ${detail}` });
      }
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Booking update failed:', updateError);
    }

    if (booking.ticket_period_id) {
      const { error: releaseError } = await supabase.rpc('release_ticket', {
        p_period_id: booking.ticket_period_id
      });
      if (releaseError) {
        console.error('Ticket release failed:', releaseError);
      }
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, language')
      .eq('id', userId)
      .single();

    const courseTitle = booking.courses?.title || 'Kurs';
    const refundAmountCHF = (refundAmountCents / 100).toFixed(2);
    const studentEmail = userProfile?.email;
    const studentLang = userProfile?.language || 'de';
    const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS.de;

    if (studentEmail) {
      try {
        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: studentEmail,
          subject: `${sTexts.student_subject}${courseTitle}`,
          html: generateEmailHtml(
            sTexts.student_title,
            sTexts.student_body(courseTitle, refundAmountCHF, refundPercent),
            sTexts.cta,
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Student refund email failed:', emailErr);
      }
    }

    if (booking.courses?.user_id) {
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('email, language')
        .eq('id', booking.courses.user_id)
        .single();

      if (teacherProfile?.email) {
        const teacherLang = teacherProfile.language || 'de';
        const tTexts = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS.de;

        try {
          await resend.emails.send({
            from: 'KursNavi <info@kursnavi.ch>',
            to: teacherProfile.email,
            subject: `${tTexts.teacher_subject}${courseTitle}`,
            html: generateEmailHtml(
              tTexts.teacher_title,
              tTexts.teacher_body(studentEmail || 'Ein Teilnehmer', courseTitle, refundPercent),
              tTexts.cta,
              dashboardUrl
            )
          });
        } catch (emailErr) {
          console.error('Teacher refund notification failed:', emailErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Rückerstattung erfolgreich',
      refund_percent: refundPercent,
      refund_amount_chf: refundAmountCHF
    });
  } catch (error) {
    console.error('Refund Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
