import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createHash } from 'crypto';
import { getEmailConfig, sendEmailOrThrow } from './_lib/email-config.js';

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const VALID_TYPES = ['contact', 'verification', 'category-suggestion'];
const RATE_LIMIT_MINUTES = 5;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, name, email, subject, message, _company } = req.body || {};

  // 1. Type validieren
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Ungültiger Typ' });
  }

  // 2. Honeypot (stille 200 für Bots)
  if (_company) {
    return res.status(200).json({ success: true });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  const emailConfig = getEmailConfig();

  // 3. Auth-Check für geschützte Typen
  let authUser = null;

  if (type === 'verification' || type === 'category-suggestion') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
    }
    authUser = user;
  }

  // 4. Type-spezifische Validierung + E-Mail-Body bauen
  let senderEmail;
  let emailSubject;
  let emailBodyHtml;

  if (type === 'contact') {
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Fehlende Felder: name, email, subject, message' });
    }
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Ungültige E-Mail Adresse' });
    }
    senderEmail = email.trim().toLowerCase();
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    emailSubject = `Kontaktformular: ${subject}`;
    emailBodyHtml = `
      <p>Neue Nachricht über das Kontaktformular:</p>
      <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
        <tr><td style="padding:8px 0; color:#6B7280; width:100px;">Name:</td><td style="padding:8px 0;"><strong>${safeName}</strong></td></tr>
        <tr><td style="padding:8px 0; color:#6B7280;">E-Mail:</td><td style="padding:8px 0;"><strong>${safeEmail}</strong></td></tr>
        <tr><td style="padding:8px 0; color:#6B7280;">Betreff:</td><td style="padding:8px 0;"><strong>${safeSubject}</strong></td></tr>
      </table>
      <div style="background:#F9FAFB; border-left:3px solid ${COLORS.primary}; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
        <p style="margin:0; color:#6B7280; font-size:13px; font-weight:600; margin-bottom:6px;">Nachricht:</p>
        <p style="margin:0;">${safeMessage}</p>
      </div>
    `;
  } else if (type === 'verification') {
    if (!subject || !message) {
      return res.status(400).json({ error: 'Fehlende Felder: subject, message' });
    }
    senderEmail = authUser.email.toLowerCase();
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    emailSubject = subject;
    emailBodyHtml = `
      <p>Neue Verifizierungsanfrage:</p>
      <div style="background:#F9FAFB; border-left:3px solid ${COLORS.primary}; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
        <p style="margin:0;">${safeMessage}</p>
      </div>
      <p style="color:#6B7280; font-size:14px;">Bitte im Admin Panel prüfen.</p>
    `;
  } else if (type === 'category-suggestion') {
    if (!subject || !message) {
      return res.status(400).json({ error: 'Fehlende Felder: subject, message' });
    }
    senderEmail = (email || authUser.email).toLowerCase();
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    emailSubject = subject;
    emailBodyHtml = `
      <p>Neuer Kategorie-Vorschlag:</p>
      <div style="background:#F9FAFB; border-left:3px solid ${COLORS.primary}; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
        <p style="margin:0;">${safeMessage}</p>
      </div>
      <p style="color:#6B7280; font-size:14px;">Eingesendet von: ${escapeHtml(senderEmail)}</p>
    `;
  }

  try {
    // 5. Rate-Limiting via DB
    const salt = process.env.LEAD_HASH_SALT;
    if (!salt) {
      console.error('contact: LEAD_HASH_SALT env var is missing');
      return res.status(500).json({ error: 'Server-Konfigurationsfehler' });
    }

    const emailHash = createHash('sha256')
      .update(senderEmail + salt)
      .digest('hex');

    const { count, error: countError } = await supabase
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_email_hash', emailHash)
      .eq('type', type)
      .gte('created_at', new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString());

    if (!countError && count > 0) {
      return res.status(429).json({ error: 'Bitte warte einige Minuten vor dem nächsten Senden.' });
    }

    // 6. Audit-Record (status: pending)
    const { data: record, error: insertError } = await supabase
      .from('contact_messages')
      .insert({
        type,
        sender_email_hash: emailHash,
        subject: emailSubject,
        user_id: authUser?.id || null,
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('contact: Record konnte nicht erstellt werden', insertError);
    }

    // 7. E-Mail via Resend senden
    try {
      const emailOptions = {
        from: emailConfig.from,
        to: emailConfig.supportEmail,
        subject: emailSubject,
        html: generateEmailHtml(emailSubject, emailBodyHtml, 'Zum Admin Panel', 'https://kursnavi.ch/admin')
      };

      if (type === 'contact') {
        emailOptions.replyTo = senderEmail;
      }

      await sendEmailOrThrow(resend, `contact-${type}`, emailOptions);

      // Audit-Trail: Status → sent
      if (record?.id) {
        await supabase.from('contact_messages').update({ status: 'sent' }).eq('id', record.id);
      }

      return res.status(200).json({ success: true });
    } catch (emailErr) {
      // Audit-Trail: Status → failed
      if (record?.id) {
        await supabase.from('contact_messages').update({ status: 'failed' }).eq('id', record.id);
      }
      throw emailErr;
    }
  } catch (err) {
    console.error('contact error:', err);
    return res.status(500).json({ error: 'Nachricht konnte nicht gesendet werden' });
  }
}
