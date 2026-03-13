import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getDashboardUrl } from './_lib/base-url.js';

const EMAIL_TEXTS = {
  de: {
    learnerSubject: (courseTitle) => `Kulanzanfrage gesendet: ${courseTitle}`,
    learnerTitle: 'Deine Kulanzanfrage wurde gesendet',
    learnerBody: (courseTitle, providerName, message) => `<p>Wir haben deine Kulanzanfrage fuer <strong>${courseTitle}</strong> an ${providerName} weitergeleitet.</p>
             <p>Der Anbieter kann eine Rueckerstattung von 0 %, 25 %, 50 % oder 100 % bewilligen oder ablehnen.</p>
             ${message ? `<p><strong>Deine Nachricht:</strong><br>${message}</p>` : ''}`,
    providerSubject: (courseTitle) => `Neue Kulanzanfrage: ${courseTitle}`,
    providerTitle: 'Neue Kulanzanfrage eingegangen',
    providerBody: (learnerName, learnerEmail, courseTitle, message) => `<p><strong>${learnerName}</strong> (${learnerEmail || 'keine E-Mail'}) hat eine Kulanzanfrage fuer <strong>${courseTitle}</strong> gestellt.</p>
             ${message ? `<p><strong>Nachricht:</strong><br>${message}</p>` : ''}
             <p>Bitte entscheide im Dashboard ueber 0 %, 25 %, 50 % oder 100 % Rueckerstattung. Kulante Entscheidungen wirken sich in der Regel positiv auf das Kundenerlebnis aus.</p>`,
    cta: 'Zum Dashboard'
  },
  en: {
    learnerSubject: (courseTitle) => `Goodwill request sent: ${courseTitle}`,
    learnerTitle: 'Your goodwill request has been sent',
    learnerBody: (courseTitle, providerName, message) => `<p>We forwarded your goodwill request for <strong>${courseTitle}</strong> to ${providerName}.</p>
             <p>The provider may approve or decline a refund of 0%, 25%, 50% or 100%.</p>
             ${message ? `<p><strong>Your message:</strong><br>${message}</p>` : ''}`,
    providerSubject: (courseTitle) => `New goodwill request: ${courseTitle}`,
    providerTitle: 'New goodwill request received',
    providerBody: (learnerName, learnerEmail, courseTitle, message) => `<p><strong>${learnerName}</strong> (${learnerEmail || 'no email'}) submitted a goodwill request for <strong>${courseTitle}</strong>.</p>
             ${message ? `<p><strong>Message:</strong><br>${message}</p>` : ''}
             <p>Please decide in the dashboard whether to grant 0%, 25%, 50% or 100% refund. A fair solution usually improves the customer experience.</p>`,
    cta: 'Go to Dashboard'
  },
  fr: {
    learnerSubject: (courseTitle) => `Demande de geste commercial envoyee : ${courseTitle}`,
    learnerTitle: 'Votre demande a ete envoyee',
    learnerBody: (courseTitle, providerName, message) => `<p>Nous avons transmis votre demande de geste commercial pour <strong>${courseTitle}</strong> a ${providerName}.</p>
             <p>Le prestataire peut accorder ou refuser un remboursement de 0 %, 25 %, 50 % ou 100 %.</p>
             ${message ? `<p><strong>Votre message :</strong><br>${message}</p>` : ''}`,
    providerSubject: (courseTitle) => `Nouvelle demande de geste commercial : ${courseTitle}`,
    providerTitle: 'Nouvelle demande recue',
    providerBody: (learnerName, learnerEmail, courseTitle, message) => `<p><strong>${learnerName}</strong> (${learnerEmail || "pas d'e-mail"}) a soumis une demande de geste commercial pour <strong>${courseTitle}</strong>.</p>
             ${message ? `<p><strong>Message :</strong><br>${message}</p>` : ''}
             <p>Merci de decider dans le tableau de bord si vous accordez 0 %, 25 %, 50 % ou 100 % de remboursement. Une solution genereuse ameliore generalement l'experience client.</p>`,
    cta: 'Voir le tableau de bord'
  },
  it: {
    learnerSubject: (courseTitle) => `Richiesta di cortesia inviata: ${courseTitle}`,
    learnerTitle: 'La tua richiesta e stata inviata',
    learnerBody: (courseTitle, providerName, message) => `<p>Abbiamo inoltrato la tua richiesta di cortesia per <strong>${courseTitle}</strong> a ${providerName}.</p>
             <p>Il fornitore puo approvare o rifiutare un rimborso dello 0%, 25%, 50% o 100%.</p>
             ${message ? `<p><strong>Il tuo messaggio:</strong><br>${message}</p>` : ''}`,
    providerSubject: (courseTitle) => `Nuova richiesta di cortesia: ${courseTitle}`,
    providerTitle: 'Nuova richiesta ricevuta',
    providerBody: (learnerName, learnerEmail, courseTitle, message) => `<p><strong>${learnerName}</strong> (${learnerEmail || 'nessuna e-mail'}) ha inviato una richiesta di cortesia per <strong>${courseTitle}</strong>.</p>
             ${message ? `<p><strong>Messaggio:</strong><br>${message}</p>` : ''}
             <p>Decidi nella dashboard se concedere un rimborso dello 0%, 25%, 50% o 100%. Una soluzione corretta migliora di solito l'esperienza del cliente.</p>`,
    cta: 'Vai alla dashboard'
  }
};

const generateEmailHtml = (title, bodyHtml, ctaText, ctaLink) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #F3F4F6; padding: 0; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; }
    .header { padding: 28px 36px; border-bottom: 3px solid #FA6E28; text-align: center; }
    .content { padding: 36px; color: #1F2937; line-height: 1.6; }
    .btn { display: inline-block; background: #FA6E28; color: #FFFFFF; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: bold; }
    .footer { padding: 18px; text-align: center; font-size: 12px; color: #9CA3AF; background: #F9FAFB; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin:0;color:#FA6E28;">KursNavi</h1></div>
    <div class="content">
      <h2 style="margin-top:0;">${title}</h2>
      <div>${bodyHtml}</div>
      <p style="margin-top:24px;"><a href="${ctaLink}" class="btn">${ctaText}</a></p>
    </div>
    <div class="footer">Dies ist eine automatische Nachricht.</div>
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

    const { bookingId, message } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, courses (id, title, user_id)')
      .eq('id', bookingId)
      .eq('user_id', authUser.id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Buchung nicht gefunden' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Fuer diese Buchung kann keine Kulanzanfrage mehr gestellt werden' });
    }

    if (booking.refunded_at) {
      return res.status(400).json({ error: 'Diese Buchung wurde bereits erstattet' });
    }

    if (booking.disputed_at) {
      return res.status(400).json({ error: 'Fuer diese Buchung laeuft bereits ein Einspruch' });
    }

    if (booking.is_paid) {
      return res.status(400).json({ error: 'Fuer bereits ausbezahlte Buchungen kann keine Kulanzanfrage mehr ueber die Plattform gestellt werden' });
    }

    if (booking.goodwill_status) {
      return res.status(400).json({ error: 'Fuer diese Buchung wurde bereits eine Kulanzanfrage eingereicht oder bearbeitet' });
    }

    if (isWithinAutoRefundWindow(booking)) {
      return res.status(400).json({ error: 'Fuer diese Buchung ist noch eine automatische Stornierung moeglich' });
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        goodwill_requested_at: new Date().toISOString(),
        goodwill_status: 'pending',
        goodwill_request_message: message || null,
        goodwill_decided_at: null,
        goodwill_decided_by: null,
        goodwill_decision_message: null,
        goodwill_refund_percent: null,
        goodwill_refund_amount_cents: null,
        goodwill_refunded_at: null
      })
      .eq('id', bookingId);

    if (updateError) {
      return res.status(500).json({ error: 'Kulanzanfrage konnte nicht gespeichert werden' });
    }

    const courseTitle = booking.courses?.title || 'Kurs';
    const { data: learnerProfile } = await supabase
      .from('profiles')
      .select('full_name, email, language')
      .eq('id', authUser.id)
      .single();

    const { data: providerProfile } = await supabase
      .from('profiles')
      .select('full_name, email, language')
      .eq('id', booking.courses?.user_id)
      .single();

    const learnerName = learnerProfile?.full_name || 'Teilnehmer/in';
    const learnerEmail = learnerProfile?.email || authUser.email;
    const providerName = providerProfile?.full_name || 'Anbieter';
    const learnerTexts = EMAIL_TEXTS[learnerProfile?.language || 'de'] || EMAIL_TEXTS.de;
    const providerTexts = EMAIL_TEXTS[providerProfile?.language || 'de'] || EMAIL_TEXTS.de;

    if (learnerEmail) {
      try {
        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: learnerEmail,
          subject: learnerTexts.learnerSubject(courseTitle),
          html: generateEmailHtml(
            learnerTexts.learnerTitle,
            learnerTexts.learnerBody(courseTitle, providerName, message),
            learnerTexts.cta,
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Learner goodwill request email failed:', emailErr);
      }
    }

    if (providerProfile?.email) {
      try {
        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: providerProfile.email,
          subject: providerTexts.providerSubject(courseTitle),
          html: generateEmailHtml(
            providerTexts.providerTitle,
            providerTexts.providerBody(learnerName, learnerEmail, courseTitle, message),
            providerTexts.cta,
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Provider goodwill request email failed:', emailErr);
      }
    }

    return res.status(200).json({ success: true, message: 'Kulanzanfrage gesendet' });
  } catch (error) {
    console.error('Request goodwill refund error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
