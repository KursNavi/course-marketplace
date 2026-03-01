import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createHash } from 'crypto';

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
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { courseId, name, email, message } = req.body || {};

  if (!courseId || !name || !email || !message) {
    return res.status(400).json({ error: 'Fehlende Felder: courseId, name, email, message' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1. Kurs laden
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, user_id, booking_type')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: 'Kurs nicht gefunden' });
    }

    if (course.booking_type !== 'lead') {
      return res.status(400).json({ error: 'Dieser Kurs unterstützt keine Anfragen' });
    }

    // 2. Anbieter-E-Mail holen
    let teacherEmail = null;
    if (course.user_id) {
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', course.user_id)
        .single();
      teacherEmail = teacherProfile?.email;
    }

    if (!teacherEmail) {
      console.error('send-lead: Keine Anbieter-E-Mail gefunden für Kurs', courseId);
      return res.status(500).json({ error: 'Anbieter-E-Mail nicht gefunden' });
    }

    // 3. Audit-Trail: Lead-Record anlegen (status=pending)
    const emailHash = createHash('sha256')
      .update(email.toLowerCase().trim() + (process.env.LEAD_HASH_SALT || ''))
      .digest('hex');

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        course_id: courseId,
        provider_id: course.user_id,
        requester_email_hash: emailHash,
        status: 'pending'
      })
      .select('id')
      .single();

    if (leadError) {
      console.error('send-lead: Lead-Record konnte nicht erstellt werden', leadError);
    }

    // 4. E-Mail an Anbieter senden
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
    const safeTitle = escapeHtml(course.title);

    const bodyHtml = `
      <p>Du hast eine neue Anfrage für deinen Kurs <strong>${safeTitle}</strong> erhalten.</p>
      <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
        <tr><td style="padding:8px 0; color:#6B7280; width:100px;">Name:</td><td style="padding:8px 0;"><strong>${safeName}</strong></td></tr>
        <tr><td style="padding:8px 0; color:#6B7280;">E-Mail:</td><td style="padding:8px 0;"><strong>${safeEmail}</strong></td></tr>
      </table>
      <div style="background:#F9FAFB; border-left:3px solid ${COLORS.primary}; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
        <p style="margin:0; color:#6B7280; font-size:13px; font-weight:600; margin-bottom:6px;">Nachricht:</p>
        <p style="margin:0;">${safeMessage}</p>
      </div>
      <p style="color:#6B7280; font-size:14px;">Du kannst direkt auf diese E-Mail antworten, um mit der interessierten Person in Kontakt zu treten.</p>
    `;

    try {
      await resend.emails.send({
        from: 'KursNavi <info@kursnavi.ch>',
        to: teacherEmail,
        replyTo: email,
        subject: `Neue Kursanfrage: ${course.title}`,
        html: generateEmailHtml('Neue Kursanfrage', bodyHtml, 'Zum Dashboard')
      });

      // Audit-Trail: Status → sent
      if (lead?.id) {
        await supabase.from('leads').update({ status: 'sent' }).eq('id', lead.id);
      }

      return res.status(200).json({ success: true });
    } catch (emailErr) {
      // Audit-Trail: Status → failed
      if (lead?.id) {
        await supabase.from('leads').update({ status: 'failed' }).eq('id', lead.id);
      }
      throw emailErr;
    }
  } catch (err) {
    console.error('send-lead error:', err);
    return res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden' });
  }
}
