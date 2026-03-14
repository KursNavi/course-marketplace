import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getDashboardUrl } from './_lib/base-url.js';
import { getEmailConfig, resolveUserEmail, sendEmailOrThrow } from './_lib/email-config.js';

const EMAIL_TEXTS = {
  de: {
    declineLearnerSubject: (courseTitle) => `Kulanzanfrage entschieden: ${courseTitle}`,
    declineLearnerTitle: 'Deine Kulanzanfrage wurde beantwortet',
    declineLearnerBody: (providerName, courseTitle, message) => `<p>${providerName} hat deine Kulanzanfrage für <strong>${courseTitle}</strong> geprüft und keine Rückerstattung bewilligt.</p>
               ${message ? `<p><strong>Nachricht des Anbieters:</strong><br>${message}</p>` : ''}`,
    declineProviderSubject: (courseTitle) => `Kulanzanfrage beantwortet: ${courseTitle}`,
    declineProviderTitle: 'Kulanzanfrage dokumentiert',
    declineProviderBody: (learnerName, courseTitle, message) => `<p>Du hast die Kulanzanfrage von <strong>${learnerName}</strong> für <strong>${courseTitle}</strong> mit <strong>0 % Rückerstattung</strong> beantwortet.</p>
               <p>Hinweis: Kulante Lösungen wirken sich in der Regel positiv auf das Kundenerlebnis aus.</p>
               ${message ? `<p><strong>Deine Nachricht:</strong><br>${message}</p>` : ''}`,
    approveLearnerSubject: (courseTitle) => `Kulanz-Rückerstattung bestätigt: ${courseTitle}`,
    approveLearnerTitle: 'Kulanz-Rückerstattung bewilligt',
    approveLearnerBody: (providerName, courseTitle, percent, amount, message) => `<p>${providerName} hat deine Kulanzanfrage für <strong>${courseTitle}</strong> mit <strong>${percent} % Rückerstattung</strong> bewilligt.</p>
             <p>Erstattungsbetrag: <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Nachricht des Anbieters:</strong><br>${message}</p>` : ''}
             <p>Die Rückerstattung erscheint in der Regel innerhalb von 5–10 Werktagen auf deiner ursprünglichen Zahlungsmethode.</p>`,
    approveProviderSubject: (courseTitle) => `Kulanz-Rückerstattung durchgeführt: ${courseTitle}`,
    approveProviderTitle: 'Kulanzentscheidung ausgeführt',
    approveProviderBody: (learnerName, courseTitle, percent, amount, message) => `<p>Du hast die Kulanzanfrage von <strong>${learnerName}</strong> für <strong>${courseTitle}</strong> mit <strong>${percent} % Rückerstattung</strong> bewilligt.</p>
             <p>Erstattungsbetrag: <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Deine Nachricht:</strong><br>${message}</p>` : ''}`,
    cta: 'Zum Dashboard'
  },
  en: {
    declineLearnerSubject: (courseTitle) => `Goodwill request decided: ${courseTitle}`,
    declineLearnerTitle: 'Your goodwill request has been answered',
    declineLearnerBody: (providerName, courseTitle, message) => `<p>${providerName} reviewed your goodwill request for <strong>${courseTitle}</strong> and did not approve a refund.</p>
               ${message ? `<p><strong>Provider message:</strong><br>${message}</p>` : ''}`,
    declineProviderSubject: (courseTitle) => `Goodwill request answered: ${courseTitle}`,
    declineProviderTitle: 'Goodwill request recorded',
    declineProviderBody: (learnerName, courseTitle, message) => `<p>You answered the goodwill request from <strong>${learnerName}</strong> for <strong>${courseTitle}</strong> with <strong>0% refund</strong>.</p>
               <p>Note: A fair solution usually improves the customer experience.</p>
               ${message ? `<p><strong>Your message:</strong><br>${message}</p>` : ''}`,
    approveLearnerSubject: (courseTitle) => `Goodwill refund confirmed: ${courseTitle}`,
    approveLearnerTitle: 'Goodwill refund approved',
    approveLearnerBody: (providerName, courseTitle, percent, amount, message) => `<p>${providerName} approved your goodwill request for <strong>${courseTitle}</strong> with a <strong>${percent}% refund</strong>.</p>
             <p>Refund amount: <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Provider message:</strong><br>${message}</p>` : ''}
             <p>The refund usually appears on your original payment method within 5-10 business days.</p>`,
    approveProviderSubject: (courseTitle) => `Goodwill refund processed: ${courseTitle}`,
    approveProviderTitle: 'Goodwill decision executed',
    approveProviderBody: (learnerName, courseTitle, percent, amount, message) => `<p>You approved the goodwill request from <strong>${learnerName}</strong> for <strong>${courseTitle}</strong> with a <strong>${percent}% refund</strong>.</p>
             <p>Refund amount: <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Your message:</strong><br>${message}</p>` : ''}`,
    cta: 'Go to Dashboard'
  },
  fr: {
    declineLearnerSubject: (courseTitle) => `Demande commerciale traitee : ${courseTitle}`,
    declineLearnerTitle: 'Votre demande a ete traitee',
    declineLearnerBody: (providerName, courseTitle, message) => `<p>${providerName} a examine votre demande pour <strong>${courseTitle}</strong> et n'a pas accorde de remboursement.</p>
               ${message ? `<p><strong>Message du prestataire :</strong><br>${message}</p>` : ''}`,
    declineProviderSubject: (courseTitle) => `Demande traitee : ${courseTitle}`,
    declineProviderTitle: 'Decision enregistree',
    declineProviderBody: (learnerName, courseTitle, message) => `<p>Vous avez repondu a la demande de <strong>${learnerName}</strong> pour <strong>${courseTitle}</strong> avec <strong>0 % de remboursement</strong>.</p>
               <p>Remarque : une solution genereuse ameliore generalement l'experience client.</p>
               ${message ? `<p><strong>Votre message :</strong><br>${message}</p>` : ''}`,
    approveLearnerSubject: (courseTitle) => `Remboursement commercial confirme : ${courseTitle}`,
    approveLearnerTitle: 'Remboursement commercial approuve',
    approveLearnerBody: (providerName, courseTitle, percent, amount, message) => `<p>${providerName} a approuve votre demande pour <strong>${courseTitle}</strong> avec <strong>${percent} % de remboursement</strong>.</p>
             <p>Montant rembourse : <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Message du prestataire :</strong><br>${message}</p>` : ''}
             <p>Le remboursement apparait generalement sous 5 a 10 jours ouvrables sur votre moyen de paiement initial.</p>`,
    approveProviderSubject: (courseTitle) => `Remboursement commercial execute : ${courseTitle}`,
    approveProviderTitle: 'Decision executee',
    approveProviderBody: (learnerName, courseTitle, percent, amount, message) => `<p>Vous avez approuve la demande de <strong>${learnerName}</strong> pour <strong>${courseTitle}</strong> avec <strong>${percent} % de remboursement</strong>.</p>
             <p>Montant rembourse : <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Votre message :</strong><br>${message}</p>` : ''}`,
    cta: 'Voir le tableau de bord'
  },
  it: {
    declineLearnerSubject: (courseTitle) => `Richiesta di cortesia decisa: ${courseTitle}`,
    declineLearnerTitle: 'La tua richiesta e stata valutata',
    declineLearnerBody: (providerName, courseTitle, message) => `<p>${providerName} ha esaminato la tua richiesta per <strong>${courseTitle}</strong> e non ha approvato alcun rimborso.</p>
               ${message ? `<p><strong>Messaggio del fornitore:</strong><br>${message}</p>` : ''}`,
    declineProviderSubject: (courseTitle) => `Richiesta gestita: ${courseTitle}`,
    declineProviderTitle: 'Decisione registrata',
    declineProviderBody: (learnerName, courseTitle, message) => `<p>Hai risposto alla richiesta di <strong>${learnerName}</strong> per <strong>${courseTitle}</strong> con <strong>0% di rimborso</strong>.</p>
               <p>Nota: una soluzione corretta migliora di solito l'esperienza del cliente.</p>
               ${message ? `<p><strong>Il tuo messaggio:</strong><br>${message}</p>` : ''}`,
    approveLearnerSubject: (courseTitle) => `Rimborso di cortesia confermato: ${courseTitle}`,
    approveLearnerTitle: 'Rimborso di cortesia approvato',
    approveLearnerBody: (providerName, courseTitle, percent, amount, message) => `<p>${providerName} ha approvato la tua richiesta per <strong>${courseTitle}</strong> con un <strong>${percent}% di rimborso</strong>.</p>
             <p>Importo rimborsato: <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Messaggio del fornitore:</strong><br>${message}</p>` : ''}
             <p>Il rimborso appare di solito sul metodo di pagamento originale entro 5-10 giorni lavorativi.</p>`,
    approveProviderSubject: (courseTitle) => `Rimborso di cortesia eseguito: ${courseTitle}`,
    approveProviderTitle: 'Decisione eseguita',
    approveProviderBody: (learnerName, courseTitle, percent, amount, message) => `<p>Hai approvato la richiesta di <strong>${learnerName}</strong> per <strong>${courseTitle}</strong> con un <strong>${percent}% di rimborso</strong>.</p>
             <p>Importo rimborsato: <strong>CHF ${amount}</strong></p>
             ${message ? `<p><strong>Il tuo messaggio:</strong><br>${message}</p>` : ''}`,
    cta: 'Vai alla dashboard'
  }
};

const generateEmailHtml = (title, bodyHtml, ctaText, ctaLink) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const emailConfig = getEmailConfig();
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

    const { bookingId, refundPercent, message } = req.body || {};
    if (!bookingId || ![0, 25, 50, 100].includes(refundPercent)) {
      return res.status(400).json({ error: 'bookingId and refundPercent are required' });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, courses(id, title, user_id, price)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Buchung nicht gefunden' });
    }

    if (booking.courses?.user_id !== authUser.id) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Buchung' });
    }

    if (booking.goodwill_status !== 'pending') {
      return res.status(400).json({ error: 'Für diese Buchung liegt keine offene Kulanzanfrage vor' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Die Buchung ist nicht mehr aktiv' });
    }

    if (booking.disputed_at) {
      return res.status(400).json({ error: 'Für diese Buchung läuft bereits ein Einspruch' });
    }

    if (booking.is_paid) {
      return res.status(400).json({ error: 'Nach erfolgter Auszahlung kann keine Kulanzentscheidung mehr über die Plattform ausgeführt werden' });
    }

    const { data: learnerProfile } = await supabase
      .from('profiles')
      .select('full_name, email, language')
      .eq('id', booking.user_id)
      .single();

    const { data: providerProfile } = await supabase
      .from('profiles')
      .select('full_name, email, language')
      .eq('id', authUser.id)
      .single();

    const courseTitle = booking.courses?.title || 'Kurs';
    const learnerEmail = await resolveUserEmail(supabase, booking.user_id, learnerProfile?.email);
    const learnerName = learnerProfile?.full_name || 'Teilnehmer/in';
    const providerName = providerProfile?.full_name || 'Anbieter';
    const providerEmail = await resolveUserEmail(supabase, authUser.id, providerProfile?.email);
    const decisionMessage = message || null;
    const decidedAt = new Date().toISOString();
    const learnerTexts = EMAIL_TEXTS[learnerProfile?.language || 'de'] || EMAIL_TEXTS.de;
    const providerTexts = EMAIL_TEXTS[providerProfile?.language || 'de'] || EMAIL_TEXTS.de;

    if (refundPercent === 0) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          goodwill_status: 'declined',
          goodwill_decided_at: decidedAt,
          goodwill_decided_by: authUser.id,
          goodwill_decision_message: decisionMessage,
          goodwill_refund_percent: 0
        })
        .eq('id', bookingId);

      if (updateError) {
        return res.status(500).json({ error: 'Entscheidung konnte nicht gespeichert werden' });
      }

      if (learnerEmail) {
        try {
          await sendEmailOrThrow(resend, 'goodwill-decline-learner', {
            from: emailConfig.from,
            to: learnerEmail,
            subject: learnerTexts.declineLearnerSubject(courseTitle),
            html: generateEmailHtml(
              learnerTexts.declineLearnerTitle,
              learnerTexts.declineLearnerBody(providerName, courseTitle, decisionMessage),
              learnerTexts.cta,
              dashboardUrl
            )
          });
        } catch (emailErr) {
          console.error('Learner decline email failed:', emailErr);
        }
      }

      if (providerEmail) {
        try {
          await sendEmailOrThrow(resend, 'goodwill-decline-provider', {
            from: emailConfig.from,
            to: providerEmail,
            subject: providerTexts.declineProviderSubject(courseTitle),
            html: generateEmailHtml(
              providerTexts.declineProviderTitle,
              providerTexts.declineProviderBody(learnerName, courseTitle, decisionMessage),
              providerTexts.cta,
              dashboardUrl
            )
          });
        } catch (emailErr) {
          console.error('Provider decline confirmation email failed:', emailErr);
        }
      }

      return res.status(200).json({ success: true, message: 'Kulanzanfrage abgelehnt' });
    }

    if (!booking.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'Keine Zahlungsinformationen vorhanden' });
    }

    let refundAmountCents = 0;
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      refundAmountCents = Math.round(paymentIntent.amount_received * refundPercent / 100);
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: refundAmountCents
      });
    } catch (stripeError) {
      console.error('Stripe goodwill refund failed:', stripeError);
      return res.status(500).json({ error: 'Rückerstattung über Stripe fehlgeschlagen' });
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'refunded',
        refunded_at: decidedAt,
        goodwill_status: 'approved',
        goodwill_decided_at: decidedAt,
        goodwill_decided_by: authUser.id,
        goodwill_decision_message: decisionMessage,
        goodwill_refund_percent: refundPercent,
        goodwill_refund_amount_cents: refundAmountCents,
        goodwill_refunded_at: decidedAt
      })
      .eq('id', bookingId);

    if (updateError) {
      return res.status(500).json({ error: 'Kulanzentscheidung konnte nicht gespeichert werden' });
    }

    if (booking.ticket_period_id) {
      await supabase.rpc('release_ticket', { p_period_id: booking.ticket_period_id });
    }

    const refundAmountCHF = (refundAmountCents / 100).toFixed(2);

    if (learnerEmail) {
      try {
        await sendEmailOrThrow(resend, 'goodwill-approve-learner', {
          from: emailConfig.from,
          to: learnerEmail,
          subject: learnerTexts.approveLearnerSubject(courseTitle),
          html: generateEmailHtml(
            learnerTexts.approveLearnerTitle,
            learnerTexts.approveLearnerBody(providerName, courseTitle, refundPercent, refundAmountCHF, decisionMessage),
            learnerTexts.cta,
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Learner approval email failed:', emailErr);
      }
    }

    if (providerEmail) {
      try {
        await sendEmailOrThrow(resend, 'goodwill-approve-provider', {
          from: emailConfig.from,
          to: providerEmail,
          subject: providerTexts.approveProviderSubject(courseTitle),
          html: generateEmailHtml(
            providerTexts.approveProviderTitle,
            providerTexts.approveProviderBody(learnerName, courseTitle, refundPercent, refundAmountCHF, decisionMessage),
            providerTexts.cta,
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Provider approval email failed:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Kulanz-Rückerstattung durchgeführt',
      refund_percent: refundPercent,
      refund_amount_chf: refundAmountCHF
    });
  } catch (error) {
    console.error('Respond goodwill refund error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
