import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getDashboardUrl } from './_lib/base-url.js';

const EMAIL_TRANSLATIONS = {
  en: {
    student_subject: 'Credit Confirmed: ',
    student_title: 'Credit Added',
    student_body: (course, amount) => `Your booking for <strong>${course}</strong> has been cancelled.<br><br>A credit of <strong>CHF ${amount}</strong> has been added to your KursNavi account.<br>The credit will be automatically applied to your next booking.`,
    teacher_subject: 'Booking Cancelled: ',
    teacher_title: 'Booking Cancelled',
    teacher_body: (email, course) => `<strong>${email}</strong> has cancelled their booking for <strong>${course}</strong>.<br>The cancellation was processed automatically per the platform policy.`,
    cta: 'Go to Dashboard'
  },
  de: {
    student_subject: 'Guthaben gutgeschrieben: ',
    student_title: 'Guthaben erhalten',
    student_body: (course, amount) => `Deine Buchung für <strong>${course}</strong> wurde storniert.<br><br>Dir wurde ein Guthaben von <strong>CHF ${amount}</strong> auf deinem KursNavi-Konto gutgeschrieben.<br>Das Guthaben wird automatisch bei deiner nächsten Buchung verrechnet.`,
    teacher_subject: 'Buchung storniert: ',
    teacher_title: 'Buchung storniert',
    teacher_body: (email, course) => `<strong>${email}</strong> hat die Buchung für <strong>${course}</strong> storniert.<br>Die Stornierung wurde automatisch gemäss der Plattform-Richtlinie verarbeitet.`,
    cta: 'Zum Dashboard'
  },
  fr: {
    student_subject: 'Crédit confirmé : ',
    student_title: 'Crédit ajouté',
    student_body: (course, amount) => `Votre réservation pour <strong>${course}</strong> a été annulée.<br><br>Un crédit de <strong>CHF ${amount}</strong> a été ajouté à votre compte KursNavi.<br>Le crédit sera automatiquement déduit lors de votre prochaine réservation.`,
    teacher_subject: 'Réservation annulée : ',
    teacher_title: 'Réservation annulée',
    teacher_body: (email, course) => `<strong>${email}</strong> a annulé sa réservation pour <strong>${course}</strong>.<br>L'annulation a été traitée automatiquement selon la politique de la plateforme.`,
    cta: 'Voir le tableau de bord'
  },
  it: {
    student_subject: 'Credito confermato: ',
    student_title: 'Credito aggiunto',
    student_body: (course, amount) => `La tua prenotazione per <strong>${course}</strong> è stata annullata.<br><br>Un credito di <strong>CHF ${amount}</strong> è stato aggiunto al tuo conto KursNavi.<br>Il credito verrà detratto automaticamente dalla prossima prenotazione.`,
    teacher_subject: 'Prenotazione annullata: ',
    teacher_title: 'Prenotazione annullata',
    teacher_body: (email, course) => `<strong>${email}</strong> ha annullato la prenotazione per <strong>${course}</strong>.<br>L'annullamento è stato elaborato automaticamente secondo la politica della piattaforma.`,
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
        error: 'Automatische Stornierung nicht mehr möglich. Du kannst stattdessen eine Kulanzanfrage an den Anbieter senden.',
        goodwill_available: true
      });
    }

    const coursePriceCents = Math.round((Number(booking.courses?.price) || 0) * 100);
    const creditUsedCents = booking.credit_used_cents || 0;
    let stripePaidCents = 0;

    if (booking.stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
        stripePaidCents = pi.amount_received || 0;
      } catch (stripeError) {
        console.error('PI lookup failed, falling back to stored values:', stripeError?.message);
        stripePaidCents = Math.max(coursePriceCents - creditUsedCents, 0);
      }
    }

    const creditAmountCents = creditUsedCents + stripePaidCents;
    const courseTitle = booking.courses?.title || 'Kurs';
    const { data: refundResult, error: refundError } = await supabase.rpc('refund_booking_to_credit', {
      p_booking_id: bookingId,
      p_user_id: userId,
      p_amount_cents: creditAmountCents,
      p_description: `Stornierung: ${courseTitle}`
    });

    if (refundError) {
      console.error('Atomic booking refund failed:', refundError);
      return res.status(500).json({ error: 'Gutschrift konnte nicht verarbeitet werden.' });
    }
    const refundMeta = refundResult?.[0];
    const alreadyProcessed = !!refundMeta?.already_processed;

    // Release ticket if applicable
    const ticketPeriodId = refundMeta?.ticket_period_id ?? booking.ticket_period_id;
    if (ticketPeriodId && !alreadyProcessed) {
      const { error: releaseError } = await supabase.rpc('release_ticket', {
        p_period_id: ticketPeriodId
      });
      if (releaseError) {
        console.error('Ticket release failed:', releaseError);
      }
    }

    const creditAmountCHF = (creditAmountCents / 100).toFixed(2);
    const newBalanceCents = refundMeta?.new_balance_cents || 0;

    if (alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: 'Buchung war bereits storniert',
        credit_amount_chf: creditAmountCHF,
        new_balance_chf: (newBalanceCents / 100).toFixed(2)
      });
    }

    // Send emails
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, language')
      .eq('id', userId)
      .single();

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
            sTexts.student_body(courseTitle, creditAmountCHF),
            sTexts.cta,
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Student credit email failed:', emailErr);
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
              tTexts.teacher_body(studentEmail || 'Ein Teilnehmer', courseTitle),
              tTexts.cta,
              dashboardUrl
            )
          });
        } catch (emailErr) {
          console.error('Teacher cancellation notification failed:', emailErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Buchung storniert — Guthaben gutgeschrieben',
      credit_amount_chf: creditAmountCHF,
      new_balance_chf: (newBalanceCents / 100).toFixed(2)
    });
  } catch (error) {
    console.error('Refund Error:', error);
    return res.status(500).json({ error: 'Interner Fehler' });
  }
}
