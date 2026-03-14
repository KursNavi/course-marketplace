import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getDashboardUrl } from './_lib/base-url.js';
import { getEmailConfig, resolveUserEmail, sendEmailOrThrow } from './_lib/email-config.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    const { bookingId, reason } = req.body;
    const userId = authUser.id;

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, courses (id, title, price, user_id)')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Buchung nicht gefunden' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Buchung ist nicht aktiv' });
    }

    if (booking.refunded_at) {
      return res.status(400).json({ error: 'Buchung wurde bereits erstattet' });
    }

    if (booking.disputed_at) {
      return res.status(400).json({ error: 'Einspruch wurde bereits eingereicht' });
    }

    if (booking.goodwill_status === 'pending') {
      return res.status(400).json({ error: 'Bitte warte zuerst die offene Kulanzanfrage ab' });
    }

    if (booking.is_paid) {
      return res.status(400).json({ error: 'Auszahlung bereits erfolgt. Bitte kontaktiere den Support.' });
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        disputed_at: new Date().toISOString(),
        dispute_reason: reason || null
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Dispute update failed:', updateError);
      return res.status(500).json({ error: 'Einspruch konnte nicht gespeichert werden' });
    }

    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    const courseTitle = booking.courses?.title || 'Kurs';
    const studentEmail = await resolveUserEmail(supabase, userId, studentProfile?.email) || 'Unbekannt';
    const studentName = studentProfile?.full_name || 'Teilnehmer';

    try {
      await sendEmailOrThrow(resend, 'dispute-booking-admin', {
        from: emailConfig.from,
        to: emailConfig.adminEmail,
        subject: `Einspruch: ${courseTitle} - ${studentName}`,
        html: generateEmailHtml(
          'Neuer Einspruch eingegangen',
          `<p><strong>Teilnehmer:</strong> ${studentName} (${studentEmail})</p>
           <p><strong>Kurs:</strong> ${courseTitle}</p>
           <p><strong>Buchungs-ID:</strong> ${bookingId}</p>
           <p><strong>Grund:</strong> ${reason || 'Kein Grund angegeben'}</p>
           <p style="margin-top: 20px; padding: 12px; background: #FEF3C7; border-radius: 8px;">
             Die Auszahlung an den Anbieter ist blockiert, bis der Einspruch geklaert ist.
           </p>`,
          'Im Dashboard pruefen',
          dashboardUrl
        )
      });
    } catch (emailErr) {
      console.error('Admin dispute notification failed:', emailErr);
    }

    if (studentEmail && studentEmail !== 'Unbekannt') {
      try {
        await sendEmailOrThrow(resend, 'dispute-booking-student', {
          from: emailConfig.from,
          to: studentEmail,
          subject: `Einspruch eingereicht: ${courseTitle}`,
          html: generateEmailHtml(
            'Dein Einspruch wurde registriert',
            `<p>Wir haben deinen Einspruch für <strong>${courseTitle}</strong> erhalten.</p>
             <p>Unser Team wird den Fall prüfen und sich innerhalb von 3 Werktagen bei dir melden.</p>
             ${reason ? `<p><strong>Dein Grund:</strong> ${reason}</p>` : ''}`,
            'Zum Dashboard',
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Student dispute confirmation failed:', emailErr);
      }
    }

    return res.status(200).json({ success: true, message: 'Einspruch erfolgreich eingereicht' });
  } catch (error) {
    console.error('Dispute Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
