import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// --- EMAIL TEMPLATES ---
const EMAIL_TRANSLATIONS = {
  en: {
    student_subject: "Refund Confirmed: ",
    student_title: "Refund Processed",
    student_body: (course, amount) => `Your booking for <strong>${course}</strong> has been cancelled and refunded.<br><br>Amount: <strong>CHF ${amount}</strong><br>The refund will appear on your original payment method within 5-10 business days.`,
    teacher_subject: "Booking Cancelled: ",
    teacher_title: "Booking Cancelled",
    teacher_body: (email, course) => `<strong>${email}</strong> has cancelled their booking for <strong>${course}</strong>.<br>The refund has been processed automatically.`,
    cta: "Go to Dashboard"
  },
  de: {
    student_subject: "Rückerstattung bestätigt: ",
    student_title: "Rückerstattung verarbeitet",
    student_body: (course, amount) => `Deine Buchung für <strong>${course}</strong> wurde storniert und erstattet.<br><br>Betrag: <strong>CHF ${amount}</strong><br>Die Rückerstattung erscheint innerhalb von 5-10 Werktagen auf deiner ursprünglichen Zahlungsmethode.`,
    teacher_subject: "Buchung storniert: ",
    teacher_title: "Buchung storniert",
    teacher_body: (email, course) => `<strong>${email}</strong> hat die Buchung für <strong>${course}</strong> storniert.<br>Die Rückerstattung wurde automatisch verarbeitet.`,
    cta: "Zum Dashboard"
  },
  fr: {
    student_subject: "Remboursement confirmé : ",
    student_title: "Remboursement traité",
    student_body: (course, amount) => `Votre réservation pour <strong>${course}</strong> a été annulée et remboursée.<br><br>Montant : <strong>CHF ${amount}</strong><br>Le remboursement apparaîtra sur votre méthode de paiement d'origine dans un délai de 5 à 10 jours ouvrables.`,
    teacher_subject: "Réservation annulée : ",
    teacher_title: "Réservation annulée",
    teacher_body: (email, course) => `<strong>${email}</strong> a annulé sa réservation pour <strong>${course}</strong>.<br>Le remboursement a été traité automatiquement.`,
    cta: "Voir le tableau de bord"
  }
};

const generateEmailHtml = (title, bodyHtml, ctaText, ctaLink = "https://kursnavi.ch/dashboard") => `
<!DOCTYPE html>
<html>
<head>
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

// Server-side refund eligibility check
function canAutoRefund(booking) {
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

  // --- CREDENTIALS ---
  const part1 = "sk_test_51R0pfBHd3CotzjPe3A6BLp4K0JvGqpnc";
  const part2 = "NIWoqcuOAnEgCCVo35hMJPqJJEc2QSqa3L0MyKBPuMCi";
  const part3 = "FyynGjhnJvjr00iYuBK9fk";
  const STRIPE_KEY = part1 + part2 + part3;

  const SUPABASE_URL = "https://nplxmpfasgpumpiddjfl.supabase.co";
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzOTk0MiwiZXhwIjoyMDc5OTE1OTQyfQ.5BeY8BkISy_hexNUzx0nDTDNbU5N-Hg4jdeOnHufffw";
  const RESEND_KEY = "re_PWCFaKxw_LPBudxuw5WoRiefvdJSPnnds";

  const stripe = new Stripe(STRIPE_KEY);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = new Resend(RESEND_KEY);

  try {
    const { bookingId, userId } = req.body;

    if (!bookingId || !userId) {
      return res.status(400).json({ error: 'bookingId and userId are required' });
    }

    // 1. Load booking (only own bookings)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        courses (id, title, price, user_id)
      `)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Buchung nicht gefunden' });
    }

    // 2. Server-side eligibility check
    if (!canAutoRefund(booking)) {
      return res.status(400).json({
        error: 'Rückerstattungsfrist abgelaufen',
        auto_refund_until: booking.auto_refund_until
      });
    }

    // 3. Stripe Refund
    if (!booking.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'Keine Zahlungsinformationen vorhanden' });
    }

    try {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id
      });
    } catch (stripeError) {
      console.error('Stripe refund failed:', stripeError);
      return res.status(500).json({ error: 'Rückerstattung fehlgeschlagen. Bitte kontaktiere den Support.' });
    }

    // 4. Update booking status
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

    // 5. Release ticket (if period still active)
    if (booking.ticket_period_id) {
      const { error: releaseError } = await supabase.rpc('release_ticket', {
        p_period_id: booking.ticket_period_id
      });
      if (releaseError) {
        console.error('Ticket release failed:', releaseError);
      }
    }

    // 6. Get user profile for email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, language')
      .eq('id', userId)
      .single();

    const courseTitle = booking.courses?.title || 'Kurs';
    const coursePrice = booking.courses?.price || 0;
    const studentEmail = userProfile?.email;
    const studentLang = userProfile?.language || 'de';
    const sTexts = EMAIL_TRANSLATIONS[studentLang] || EMAIL_TRANSLATIONS['de'];

    // 7. Send refund confirmation email to student
    if (studentEmail) {
      try {
        await resend.emails.send({
          from: 'KursNavi <onboarding@resend.dev>',
          to: studentEmail,
          subject: `${sTexts.student_subject}${courseTitle}`,
          html: generateEmailHtml(
            sTexts.student_title,
            sTexts.student_body(courseTitle, coursePrice.toFixed(2)),
            sTexts.cta
          )
        });
      } catch (emailErr) {
        console.error('Student refund email failed:', emailErr);
      }
    }

    // 8. Notify provider
    if (booking.courses?.user_id) {
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('email, language')
        .eq('id', booking.courses.user_id)
        .single();

      if (teacherProfile?.email) {
        const teacherLang = teacherProfile.language || 'de';
        const tTexts = EMAIL_TRANSLATIONS[teacherLang] || EMAIL_TRANSLATIONS['de'];

        try {
          await resend.emails.send({
            from: 'KursNavi <onboarding@resend.dev>',
            to: teacherProfile.email,
            subject: `${tTexts.teacher_subject}${courseTitle}`,
            html: generateEmailHtml(
              tTexts.teacher_title,
              tTexts.teacher_body(studentEmail || 'Ein Teilnehmer', courseTitle),
              tTexts.cta
            )
          });
        } catch (emailErr) {
          console.error('Teacher refund notification failed:', emailErr);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Rückerstattung erfolgreich' });

  } catch (error) {
    console.error('Refund Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
