import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createHash, randomUUID } from 'crypto';
import { getEmailConfig, resolveUserEmail, sendEmailOrThrow } from './_lib/email-config.js';
import { encryptLeadMessage, normalizeLeadMessage } from './_lib/lead-message-crypto.js';
import { providerMessageIdFromSendResult } from './_lib/lead-email-delivery.js';
import { getBaseUrl } from './_lib/base-url.js';

/** Aufbewahrungsfrist des Anfragetextes. Der Lead-Datensatz selbst bleibt. */
const MESSAGE_RETENTION_DAYS = 60;

const COLORS = {
  primary: '#FA6E28',
  secondary: '#2563EB',
  text: '#1F2937',
  gray: '#F3F4F6',
  white: '#FFFFFF'
};

const generateEmailHtml = (title, bodyHtml, ctaText, ctaLink = "https://kursnavi.ch/dashboard") => `
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
        <p>© ${new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.</p>
        <p>Dies ist eine automatische Nachricht.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const VALID_TIERS = ['basic', 'pro', 'premium', 'enterprise'];
const VALID_INTENTS = new Set(['availability', 'price_details', 'advice']);
const INTENT_LABELS = Object.freeze({
  availability: 'Termine und Verfügbarkeit',
  price_details: 'Preis und Details',
  advice: 'Beratung zum Kurs',
});

function cleanText(value, maxLength = 255) {
  if (typeof value !== 'string') return null;
  const cleaned = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function normalizeIntent(value) {
  const intent = cleanText(value, 40);
  return VALID_INTENTS.has(intent) ? intent : null;
}

function normalizeRecipientEmail(value) {
  const normalized = cleanText(value, 320)?.toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizeAttribution(value, consentGranted) {
  if (!consentGranted || !value || typeof value !== 'object') return {};

  return {
    attribution_source: cleanText(value.source, 120),
    attribution_medium: cleanText(value.medium, 120),
    attribution_campaign: cleanText(value.campaign, 180),
    attribution_term: cleanText(value.term, 180),
    attribution_content: cleanText(value.content, 180),
    attribution_landing_page: cleanText(value.landingPage, 500),
    attribution_referrer: cleanText(value.referrer, 500),
    attribution_device: cleanText(value.device, 40),
    attribution_gclid: cleanText(value.gclid, 200),
    attribution_gbraid: cleanText(value.gbraid, 200),
    attribution_wbraid: cleanText(value.wbraid, 200),
  };
}

/**
 * Normalisiert das Paket für den Snapshot am Lead.
 *
 * Gibt null zurück, wenn der Wert unbekannt ist. null bedeutet in der
 * Penalty-Logik "zählt nicht" — besser als ein geratenes 'basic', das den
 * Anbieter fälschlich abstufen würde.
 */
function normalizeTier(tier) {
  const normalized = String(tier || '').trim().toLowerCase();
  return VALID_TIERS.includes(normalized) ? normalized : null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    courseId,
    name,
    email,
    message = '',
    phone = '',
    intent,
    eventId,
    analyticsConsent = false,
    attribution,
  } = req.body || {};

  if (!courseId || !cleanText(name, 160) || !cleanText(email, 320)) {
    return res.status(400).json({ error: 'Fehlende Felder: courseId, name, email' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailConfig = getEmailConfig();

    // 1. Kurs laden
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, user_id, booking_type, category_area, canton')
      .eq('id', courseId)
      .single();

    if (courseError && courseError.code !== 'PGRST116') {
      console.error('send-lead: Kursabfrage fehlgeschlagen', courseError);
      return res.status(500).json({ error: 'Kurs konnte nicht geladen werden' });
    }
    if (!course) {
      return res.status(404).json({ error: 'Kurs nicht gefunden' });
    }

    if (course.booking_type !== 'lead') {
      return res.status(400).json({ error: 'Dieser Kurs unterstützt keine Anfragen' });
    }

    // 2. Anbieter-E-Mail und aktuelles Paket holen
    // package_tier wird für den Snapshot am Lead gebraucht (provider_tier_at_lead).
    let teacherEmail = null;
    let leadEmail = null;
    let providerTier = null;
    if (course.user_id) {
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('email, lead_email, package_tier')
        .eq('id', course.user_id)
        .single();
      teacherEmail = await resolveUserEmail(supabase, course.user_id, teacherProfile?.email);
      leadEmail = normalizeRecipientEmail(teacherProfile?.lead_email) || teacherEmail;
      providerTier = normalizeTier(teacherProfile?.package_tier);
    }

    if (!leadEmail) {
      console.error('send-lead: Keine Anbieter-E-Mail gefunden für Kurs', courseId);
      return res.status(500).json({ error: 'Anbieter-E-Mail nicht gefunden' });
    }

    // 3. Audit-Trail: Lead-Record anlegen (status=pending)
    const salt = process.env.LEAD_HASH_SALT;
    if (!salt) {
      console.error('send-lead: LEAD_HASH_SALT env var is missing');
      return res.status(500).json({ error: 'Server-Konfigurationsfehler' });
    }

    const normalizedEmail = cleanText(email, 320).toLowerCase();
    const normalizedName = cleanText(name, 160);
    const normalizedPhone = cleanText(phone, 80);
    const normalizedIntent = normalizeIntent(intent);
    const normalizedEventId = typeof eventId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)
      ? eventId
      : randomUUID();
    const attributionFields = normalizeAttribution(attribution, analyticsConsent === true);

    const emailHash = createHash('sha256')
      .update(normalizedEmail + salt)
      .digest('hex');

    // 3b. Rate-Limiting: max 1 Lead pro Email+Kurs alle 5 Minuten
    const { count: recentCount, error: rlError } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('requester_email_hash', emailHash)
      .eq('course_id', courseId)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (!rlError && recentCount > 0) {
      return res.status(429).json({ error: 'Bitte warte einige Minuten vor dem nächsten Senden.' });
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        course_id: courseId,
        provider_id: course.user_id,
        requester_email_hash: emailHash,
        event_id: normalizedEventId,
        lead_intent: normalizedIntent,
        course_topic_snapshot: cleanText(course.category_area, 160),
        course_region_snapshot: cleanText(course.canton, 120),
        status: 'pending',
        email_delivery_status: 'pending',
        // Snapshot: In welcher Paketphase ist diese Anfrage eingegangen? Später
        // ist das nicht mehr rekonstruierbar, und die Basic-Ranking-Penalty
        // hängt daran.
        provider_tier_at_lead: providerTier,
        ...attributionFields,
      })
      .select('id')
      .single();

    // Der Lead-Datensatz ist obligatorisch: Er ist der Nachweis der Anfrage und
    // die Grundlage der Leadstatistik. Bisher wurde ein Fehler hier nur
    // protokolliert und die E-Mail trotzdem versendet — dabei entstand eine
    // versandte, aber nirgends erfasste Anfrage. Jetzt wird abgebrochen, BEVOR
    // die E-Mail rausgeht.
    if (leadError || !lead?.id) {
      console.error('send-lead: Lead-Record konnte nicht erstellt werden', leadError);
      return res.status(500).json({ error: 'Anfrage konnte nicht erfasst werden. Bitte versuche es später erneut.' });
    }

    // 3c. Anfragetext verschlüsselt und befristet ablegen.
    // Fehler hier dürfen den Versand NICHT verhindern — der Text ist nur die
    // Grundlage der späteren KI-Bewertung, nicht der Anfrage selbst. Der Lead
    // bleibt bestehen und wird vom Retention-Lauf als 'expired_unscored'
    // markiert, sobald klar ist, dass kein Text mehr kommt.
    const normalizedMessage = normalizeLeadMessage(message);
    if (normalizedMessage) {
      try {
        const expiresAt = new Date(Date.now() + MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const { error: payloadError } = await supabase
          .from('lead_message_payloads')
          .insert({
            lead_id: lead.id,
            ciphertext: encryptLeadMessage(normalizedMessage),
            expires_at: expiresAt.toISOString()
          });
        if (payloadError) throw payloadError;
      } catch (payloadErr) {
        // Bewusst nur Code und Meldung, niemals der Anfragetext.
        console.error('send-lead: Anfragetext konnte nicht gespeichert werden:', payloadErr?.message || 'unknown error');
        await supabase
          .from('leads')
          .update({ quality_error_code: 'payload_write_failed' })
          .eq('id', lead.id);
      }
    }

    // 4. E-Mail an Anbieter senden
    const defaultMessage = normalizedIntent
      ? `Ich interessiere mich für: ${INTENT_LABELS[normalizedIntent]}.`
      : 'Ich interessiere mich für diesen Kurs und freue mich über weitere Informationen.';
    const providerMessage = normalizedMessage || defaultMessage;
    const safeName = escapeHtml(normalizedName);
    const safeEmail = escapeHtml(normalizedEmail);
    const safePhone = normalizedPhone ? escapeHtml(normalizedPhone) : null;
    const safeIntent = normalizedIntent ? escapeHtml(INTENT_LABELS[normalizedIntent]) : null;
    const safeMessage = escapeHtml(providerMessage).replace(/\n/g, '<br>');
    const safeTitle = escapeHtml(course.title);
    const baseUrl = getBaseUrl(req);
    const bodyHtml = `
      <p>Du hast eine neue Anfrage für deinen Kurs <strong>${safeTitle}</strong> erhalten.</p>
      <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
        <tr><td style="padding:8px 0; color:#6B7280; width:100px;">Name:</td><td style="padding:8px 0;"><strong>${safeName}</strong></td></tr>
        <tr><td style="padding:8px 0; color:#6B7280;">E-Mail:</td><td style="padding:8px 0;"><strong>${safeEmail}</strong></td></tr>
        ${safePhone ? `<tr><td style="padding:8px 0; color:#6B7280;">Telefon:</td><td style="padding:8px 0;"><strong>${safePhone}</strong></td></tr>` : ''}
        ${safeIntent ? `<tr><td style="padding:8px 0; color:#6B7280;">Anliegen:</td><td style="padding:8px 0;"><strong>${safeIntent}</strong></td></tr>` : ''}
      </table>
      <div style="background:#F9FAFB; border-left:3px solid ${COLORS.primary}; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
        <p style="margin:0; color:#6B7280; font-size:13px; font-weight:600; margin-bottom:6px;">Nachricht:</p>
        <p style="margin:0;">${safeMessage}</p>
      </div>
      <p style="color:#6B7280; font-size:14px;">Bitte antworte direkt auf diese E-Mail, um mit der interessierten Person Kontakt aufzunehmen.</p>
    `;

    let emailAccepted = false;
    try {
      const sendResult = await sendEmailOrThrow(resend, 'lead-to-provider', {
        from: emailConfig.from,
        to: leadEmail,
        replyTo: normalizedEmail,
        bcc: emailConfig.adminEmail,
        subject: `Neue Kursanfrage: ${course.title}`,
        html: generateEmailHtml('Neue Kursanfrage', bodyHtml, 'Zum Dashboard')
      });
      emailAccepted = true;

      // "accepted" bedeutet: Resend hat die Nachricht angenommen. Eine echte
      // Zustellung wird später über den Resend-Webhook auf "delivered" gesetzt.
      const sentUpdate = {
          status: 'sent',
          email_delivery_status: 'accepted',
          email_provider_message_id: providerMessageIdFromSendResult(sendResult),
          email_delivery_updated_at: new Date().toISOString(),
          email_delivery_error_code: null,
      };
      let sentUpdateError = null;
      // A transient database error must not turn a successfully sent email into
      // a false `failed` lead. Retry once and surface a persistent failure for
      // investigation instead of silently corrupting delivery metrics.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { error: updateError } = await supabase
          .from('leads')
          .update(sentUpdate)
          .eq('id', lead.id);
        if (!updateError) {
          sentUpdateError = null;
          break;
        }
        sentUpdateError = updateError;
      }
      if (sentUpdateError) {
        console.error('send-lead: Versand erfolgreich, Leadstatus konnte nicht gespeichert werden:', sentUpdateError.message);
        throw new Error('Lead status persistence failed');
      }

      let confirmationEmailSent = false;
      try {
        const confirmationBody = `
          <p>Deine Anfrage für <strong>${safeTitle}</strong> wurde an den Anbieter weitergeleitet.</p>
          <p style="background:#F9FAFB; padding:16px; border-radius:8px;">
            Referenz: <strong>${escapeHtml(lead.id)}</strong>
          </p>
          <p style="color:#6B7280; font-size:14px;">Falls du keine Antwort erhältst, antworte auf diese E-Mail oder kontaktiere ${escapeHtml(emailConfig.supportEmail)}. Wir helfen dir gern mit passenden Alternativen.</p>
        `;
        await sendEmailOrThrow(resend, 'lead-confirmation-requester', {
          from: emailConfig.from,
          to: normalizedEmail,
          replyTo: emailConfig.supportEmail,
          subject: `Deine Kursanfrage: ${course.title}`,
          html: generateEmailHtml('Anfrage erfolgreich übermittelt', confirmationBody, 'Weitere Kurse entdecken', `${baseUrl}/search`)
        });
        confirmationEmailSent = true;
        await supabase.from('leads').update({ requester_confirmation_sent_at: new Date().toISOString() }).eq('id', lead.id);
      } catch (confirmationError) {
        console.error('send-lead: Bestätigung an anfragende Person fehlgeschlagen:', confirmationError?.message || 'unknown error');
      }

      return res.status(200).json({
        success: true,
        lead_id: lead.id,
        event_id: normalizedEventId,
        delivery_status: 'accepted',
        confirmation_email_sent: confirmationEmailSent,
      });
    } catch (emailErr) {
      // Audit-Trail: der Versanddienst hat die Nachricht nicht angenommen.
      // Once Resend accepted the message, do not overwrite the durable lead
      // with `failed` merely because the follow-up status update failed.
      if (!emailAccepted) {
        await supabase.from('leads').update({
          status: 'failed',
          email_delivery_status: 'failed',
          email_delivery_updated_at: new Date().toISOString(),
          email_delivery_error_code: 'send_failed',
        }).eq('id', lead.id);
      }
      throw emailErr;
    }
  } catch (err) {
    console.error('send-lead error:', err);
    return res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden' });
  }
}
