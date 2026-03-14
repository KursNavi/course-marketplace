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

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, serviceKey);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const emailConfig = getEmailConfig();
  const dashboardUrl = getDashboardUrl(req);

  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return res.status(401).json({ error: 'Ungueltiges oder abgelaufenes Token' });
    }
    const providerId = authUser.id;

    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, courses(id, title, user_id, price)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Buchung nicht gefunden' });
    }

    if (booking.courses?.user_id !== providerId) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Buchung' });
    }

    if (booking.booking_type !== 'platform_flex') {
      return res.status(400).json({ error: 'Nur für flexible Buchungen verfügbar' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Buchung ist nicht aktiv' });
    }

    if (booking.delivered_at) {
      return res.status(400).json({ error: 'Buchung wurde bereits als durchgeführt markiert' });
    }

    if (booking.refunded_at) {
      return res.status(400).json({ error: 'Buchung wurde bereits erstattet' });
    }

    if (booking.disputed_at) {
      return res.status(400).json({ error: 'Buchung hat einen offenen Einspruch' });
    }

    if (booking.goodwill_status === 'pending') {
      return res.status(400).json({ error: 'Für diese Buchung ist zuerst die offene Kulanzanfrage zu entscheiden' });
    }

    if (booking.is_paid) {
      return res.status(400).json({ error: 'Auszahlung bereits erfolgt' });
    }

    const paidAt = new Date(booking.paid_at);
    const earliestDelivery = new Date(paidAt.getTime() + 48 * 60 * 60 * 1000);
    const now = new Date();

    if (now < earliestDelivery) {
      const hoursLeft = Math.ceil((earliestDelivery - now) / (60 * 60 * 1000));
      return res.status(400).json({
        error: `Durchführung kann frühestens 48 Stunden nach Zahlung bestätigt werden. Noch ${hoursLeft}h verbleibend.`
      });
    }

    const deliveredAt = now;
    const payoutEligibleAt = new Date(deliveredAt.getTime() + 2 * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        delivered_at: deliveredAt.toISOString(),
        delivered_by: providerId,
        payout_eligible_at: payoutEligibleAt.toISOString()
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Delivery update failed:', updateError);
      return res.status(500).json({ error: 'Durchführung konnte nicht gespeichert werden' });
    }

    const courseTitle = booking.courses?.title || 'Kurs';
    try {
      const { data: providerProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', providerId)
        .single();

      const providerEmail = await resolveUserEmail(supabase, providerId, providerProfile?.email);

      await sendEmailOrThrow(resend, 'mark-booking-delivered-admin', {
        from: emailConfig.from,
        to: emailConfig.adminEmail,
        subject: `Durchführung bestätigt: ${courseTitle}`,
        html: generateEmailHtml(
          'Buchung als durchgeführt markiert',
          `<p><strong>Anbieter:</strong> ${providerProfile?.full_name || 'Unbekannt'} (${providerEmail || '-'})</p>
           <p><strong>Kurs:</strong> ${courseTitle}</p>
           <p><strong>Buchungs-ID:</strong> ${bookingId}</p>
           <p><strong>Preis:</strong> CHF ${(booking.courses?.price || 0).toFixed(2)}</p>
           <p style="margin-top: 20px; padding: 12px; background: #D1FAE5; border-radius: 8px;">
             Auszahlung wird am <strong>${payoutEligibleAt.toLocaleDateString('de-CH', { year: 'numeric', month: '2-digit', day: '2-digit' })}</strong> freigegeben.
           </p>`,
          'Im Dashboard prüfen',
          dashboardUrl
        )
      });
    } catch (emailErr) {
      console.error('Admin delivery notification failed:', emailErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Buchung als durchgefuehrt markiert. Auszahlung wird in 2 Tagen freigegeben.',
      payoutEligibleAt: payoutEligibleAt.toISOString()
    });
  } catch (error) {
    console.error('Mark Delivered Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
