import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getDashboardUrl } from './_lib/base-url.js';

// --- EMAIL TEMPLATE ---
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

  // Extract JWT from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const dashboardUrl = getDashboardUrl(req);
  const ADMIN_EMAIL = 'btrespondek@gmail.com';

  try {
    // 1. Verify provider identity via JWT
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
    }
    const userId = authUser.id;

    const { eventId, reason, impersonatedUserId } = req.body;

    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isAdmin = requesterProfile?.role === 'admin';

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }

    // 2. Load event + course (ownership check via course.user_id)
    const { data: event, error: eventError } = await supabase
      .from('course_events')
      .select('*, courses (id, title, price, user_id)')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Termin nicht gefunden' });
    }

    const ownerId = event.courses?.user_id;
    const isOwner = ownerId === userId;
    const isAdminForImpersonatedOwner = isAdmin && impersonatedUserId && ownerId === impersonatedUserId;

    // Ownership check: only the course owner or an admin acting for that owner can cancel
    if (!isOwner && !isAdminForImpersonatedOwner) {
      return res.status(403).json({ error: 'Nicht berechtigt' });
    }

    // Idempotency: already cancelled
    if (event.cancelled_at) {
      return res.status(200).json({ success: true, message: 'Termin war bereits abgesagt', alreadyCancelled: true });
    }

    const courseTitle = event.courses?.title || 'Kurs';
    const eventDate = event.start_date
      ? new Date(event.start_date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Unbekannt';
    const eventLocation = event.location || '';

    // 2. Mark event as cancelled
    const { error: cancelError } = await supabase
      .from('course_events')
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason || null
      })
      .eq('id', eventId);

    if (cancelError) {
      console.error('Event cancel update failed:', cancelError);
      return res.status(500).json({ error: 'Termin konnte nicht abgesagt werden' });
    }

    // 3. Find all confirmed bookings for this event
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'confirmed');

    if (bookingsError) {
      console.error('Bookings query failed:', bookingsError);
    }

    const affectedBookings = bookings || [];
    const refundResults = [];

    // 4. Refund each booking
    for (const booking of affectedBookings) {
      // Skip if already refunded (idempotency)
      if (booking.refunded_at || booking.status === 'refunded') {
        refundResults.push({ bookingId: booking.id, status: 'already_refunded' });
        continue;
      }

      // Stripe refund
      if (booking.stripe_payment_intent_id) {
        try {
          await stripe.refunds.create({
            payment_intent: booking.stripe_payment_intent_id
          });
        } catch (stripeError) {
          // charge_already_refunded is safe to ignore
          if (stripeError.code === 'charge_already_refunded') {
            console.log(`Booking ${booking.id}: already refunded in Stripe`);
          } else {
            console.error(`Stripe refund failed for booking ${booking.id}:`, stripeError);
            refundResults.push({ bookingId: booking.id, status: 'stripe_error', error: stripeError.message });
            continue;
          }
        }
      }

      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error(`Booking update failed for ${booking.id}:`, updateError);
      }

      // Release ticket
      if (booking.ticket_period_id) {
        const { error: releaseError } = await supabase.rpc('release_ticket', {
          p_period_id: booking.ticket_period_id
        });
        if (releaseError) {
          console.error(`Ticket release failed for booking ${booking.id}:`, releaseError);
        }
      }

      refundResults.push({ bookingId: booking.id, status: 'refunded' });
    }

    // 4b. Alert admin if any refunds failed
    const failedRefunds = refundResults.filter(r => r.status === 'stripe_error');
    if (failedRefunds.length > 0) {
      try {
        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: ADMIN_EMAIL,
          subject: `ACHTUNG: ${failedRefunds.length} Refund(s) fehlgeschlagen — ${courseTitle} (${eventDate})`,
          html: generateEmailHtml(
            'Refund-Fehler bei Terminabsage',
            `<p>Beim Absagen des Termins <strong>${courseTitle}</strong> (${eventDate}) konnten folgende Buchungen nicht erstattet werden:</p>
             <ul>${failedRefunds.map(f => `<li>Booking ${f.bookingId}: ${f.error}</li>`).join('')}</ul>
             <p>Bitte manuell im <a href="https://dashboard.stripe.com/payments">Stripe Dashboard</a> erstatten.</p>`,
            'Stripe Dashboard öffnen',
            'https://dashboard.stripe.com/payments'
          )
        });
      } catch (alertErr) {
        console.error('Failed to send refund failure alert:', alertErr);
      }
    }

    // 5. Send emails to affected students
    if (affectedBookings.length > 0) {
      const studentIds = [...new Set(affectedBookings.map(b => b.user_id))];
      const { data: studentProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, language')
        .in('id', studentIds);

      const studentMap = (studentProfiles || []).reduce((m, p) => { m[p.id] = p; return m; }, {});

      for (const booking of affectedBookings) {
        if (booking.refunded_at) continue; // Was already refunded before, no need to notify again

        const student = studentMap[booking.user_id];
        if (!student?.email) continue;

        const coursePrice = event.courses?.price || 0;

        try {
          await resend.emails.send({
            from: 'KursNavi <info@kursnavi.ch>',
            to: student.email,
            subject: `Termin abgesagt: ${courseTitle}`,
            html: generateEmailHtml(
              'Termin abgesagt — Rückerstattung erfolgt',
              `<p>Der Anbieter hat folgenden Termin abgesagt:</p>
               <p><strong>Kurs:</strong> ${courseTitle}<br>
               <strong>Datum:</strong> ${eventDate}${eventLocation ? `<br><strong>Ort:</strong> ${eventLocation}` : ''}</p>
               ${reason ? `<p><strong>Grund:</strong> ${reason}</p>` : ''}
               <p>Deine Buchung wurde automatisch storniert und der Betrag von <strong>CHF ${coursePrice.toFixed(2)}</strong> wird innerhalb von 5–10 Werktagen auf deine ursprüngliche Zahlungsmethode zurückerstattet.</p>
               <p>Wir entschuldigen uns für die Unannehmlichkeiten.</p>`,
              'Zum Dashboard',
              dashboardUrl
            )
          });
        } catch (emailErr) {
          console.error(`Student cancellation email failed for ${student.email}:`, emailErr);
        }
      }
    }

    // 6. Send summary email to provider (use course owner, not the requesting admin)
    const providerId = ownerId || userId;
    const { data: providerProfile } = await supabase
      .from('profiles')
      .select('email, language')
      .eq('id', providerId)
      .single();

    if (providerProfile?.email) {
      const refundedCount = refundResults.filter(r => r.status === 'refunded').length;
      const totalRefundAmount = refundedCount * (event.courses?.price || 0);

      try {
        await resend.emails.send({
          from: 'KursNavi <info@kursnavi.ch>',
          to: providerProfile.email,
          bcc: ADMIN_EMAIL,
          subject: `Termin abgesagt: ${courseTitle} (${eventDate})`,
          html: generateEmailHtml(
            'Terminabsage bestätigt',
            `<p>Du hast folgenden Termin abgesagt:</p>
             <p><strong>Kurs:</strong> ${courseTitle}<br>
             <strong>Datum:</strong> ${eventDate}${eventLocation ? `<br><strong>Ort:</strong> ${eventLocation}` : ''}</p>
             ${reason ? `<p><strong>Grund:</strong> ${reason}</p>` : ''}
             <p><strong>${refundedCount} Buchung(en)</strong> wurden automatisch storniert und erstattet.</p>
             ${totalRefundAmount > 0 ? `<p>Erstatteter Gesamtbetrag: <strong>CHF ${totalRefundAmount.toFixed(2)}</strong></p>` : ''}`,
            'Zum Dashboard',
            dashboardUrl
          )
        });
      } catch (emailErr) {
        console.error('Provider cancellation summary email failed:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Termin abgesagt',
      refundedBookings: refundResults.filter(r => r.status === 'refunded').length,
      totalAffected: affectedBookings.length
    });

  } catch (error) {
    console.error('Cancel Event Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
