import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getRequiredSanitizedEnv } from './_lib/env.js';
import {
  calculateAutoRefundUntil,
  calculatePayoutEligibleAt,
  sendBookingAutoRefundEmail,
  sendCourseBookingEmails
} from './_lib/course-booking-email.js';
import { getDashboardUrl } from './_lib/base-url.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(getRequiredSanitizedEnv('STRIPE_SECRET_KEY'));
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const dashboardUrl = getDashboardUrl(req);

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
    }

    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadata = session.metadata || {};

    if (!metadata.courseId) {
      return res.status(400).json({ error: 'Session is not a course checkout' });
    }

    if (metadata.userId !== user.id) {
      return res.status(403).json({ error: 'Session does not belong to current user' });
    }

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return res.status(409).json({ error: 'Payment is not completed yet' });
    }

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('stripe_checkout_session_id', session.id)
      .maybeSingle();

    if (existingBooking) {
      return res.status(200).json({ received: true, note: 'Already processed' });
    }

    const courseId = metadata.courseId;
    const eventId = metadata.eventId || null;
    const bookingType = metadata.bookingType || 'platform';

    const { data: course } = await supabase
      .from('courses')
      .select('id, title, city, canton, user_id, ticket_limit_30d')
      .eq('id', courseId)
      .single();

    let eventStartAt = null;
    let eventEndAt = null;
    let eventLocation = null;
    if (eventId) {
      const { data: eventData } = await supabase
        .from('course_events')
        .select('course_id, start_date, end_date, location, city, max_participants, cancelled_at')
        .eq('id', eventId)
        .single();

      if (eventData?.course_id && Number(eventData.course_id) !== Number(courseId)) {
        return res.status(409).json({ error: 'Mismatched event/course metadata' });
      }

      eventStartAt = eventData?.start_date;
      eventEndAt = eventData?.end_date;
      eventLocation = eventData?.location || eventData?.city || null;

      if (bookingType === 'platform') {
        if (eventData?.cancelled_at) {
          try {
            await stripe.refunds.create({ payment_intent: session.payment_intent });
          } catch (refundError) {
            console.error('Stripe refund failed for cancelled event:', refundError);
          }
          return res.status(409).json({ error: 'Event was cancelled and payment has been refunded' });
        }

        const { count: bookedCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'confirmed');

        if (eventData?.max_participants > 0 && bookedCount >= eventData.max_participants) {
          try {
            await stripe.refunds.create({ payment_intent: session.payment_intent });
          } catch (refundError) {
            console.error('Stripe refund failed for full event:', refundError);
          }

          await sendBookingAutoRefundEmail({
            supabase,
            resend,
            dashboardUrl,
            userId: user.id,
            customerEmail: session.customer_details?.email,
            courseTitle: course?.title || metadata.courseTitle || 'Kurs',
            amountTotal: session.amount_total
          });

          return res.status(409).json({ error: 'Event became fully booked and payment has been refunded' });
        }
      }
    }

    let periodId = null;
    if (bookingType !== 'lead' && course?.ticket_limit_30d) {
      const { data: ticketResult, error: ticketError } = await supabase.rpc('reserve_ticket', {
        p_course_id: courseId
      });

      if (ticketError || !ticketResult?.[0]?.success) {
        return res.status(409).json({ error: 'Ticket unavailable' });
      }

      periodId = ticketResult[0].period_id;
    }

    const paidAt = new Date();
    const autoRefundUntil = calculateAutoRefundUntil(paidAt, eventStartAt, bookingType);
    const payoutEligibleAt = calculatePayoutEligibleAt(paidAt, eventEndAt, eventStartAt, bookingType);
    const creditToApply = parseInt(metadata.creditToApplyCents || '0', 10);
    let deductedCreditCents = 0;

    if (creditToApply > 0) {
      const { data: creditResult, error: creditError } = await supabase.rpc('deduct_credit', {
        p_user_id: user.id,
        p_amount_cents: creditToApply,
        p_description: `Buchung: ${course?.title || metadata.courseTitle || 'Kurs'}`
      });

      deductedCreditCents = creditResult?.[0]?.actually_deducted || 0;
      if (creditError || deductedCreditCents < creditToApply) {
        if (deductedCreditCents > 0) {
          await supabase.rpc('add_credit', {
            p_user_id: user.id,
            p_amount_cents: deductedCreditCents,
            p_type: 'cancellation_credit',
            p_description: 'Rückbuchung: Guthaben konnte nicht angewendet werden'
          });
        }
        if (periodId) {
          await supabase.rpc('release_ticket', { p_period_id: periodId });
        }
        try {
          await stripe.refunds.create({ payment_intent: session.payment_intent });
        } catch (refundError) {
          console.error('Stripe refund failed after credit mismatch:', refundError);
        }
        return res.status(409).json({ error: 'Guthabenstand hat sich geändert. Die Zahlung wurde rückerstattet.' });
      }
    }

    const { error: insertError } = await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: courseId,
      event_id: eventId || null,
      status: 'confirmed',
      booking_type: bookingType,
      paid_at: paidAt.toISOString(),
      auto_refund_until: autoRefundUntil?.toISOString() || null,
      payout_eligible_at: payoutEligibleAt?.toISOString() || null,
      stripe_payment_intent_id: session.payment_intent,
      stripe_checkout_session_id: session.id,
      ticket_period_id: periodId,
      guardian_attestation: metadata.guardianAttestation === 'true',
      paid_via_credit: false,
      credit_used_cents: deductedCreditCents
    });

    if (insertError) {
      if (deductedCreditCents > 0) {
        await supabase.rpc('add_credit', {
          p_user_id: user.id,
          p_amount_cents: deductedCreditCents,
          p_type: 'cancellation_credit',
          p_description: 'Rückbuchung: Buchung konnte nicht erstellt werden'
        });
      }
      if (insertError.code === '23505') {
        if (periodId) {
          await supabase.rpc('release_ticket', { p_period_id: periodId });
        }
        return res.status(200).json({ received: true, note: 'Duplicate, ignored' });
      }
      if (periodId) {
        await supabase.rpc('release_ticket', { p_period_id: periodId });
      }
      return res.status(500).json({ error: 'Database insert failed' });
    }

    let providerName = metadata.providerName || 'Kursanbieter';
    if (providerName === 'Kursanbieter' && course?.user_id) {
      const { data: providerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', course.user_id)
        .single();
      if (providerProfile?.full_name) providerName = providerProfile.full_name;
    }

    await sendCourseBookingEmails({
      supabase,
      resend,
      dashboardUrl,
      userId: user.id,
      customerEmail: session.customer_details?.email,
      course,
      bookingType,
      courseTitle: course?.title || metadata.courseTitle || 'Kurs',
      courseDate: eventStartAt ? new Date(eventStartAt).toLocaleDateString('de-CH') : 'TBA',
      courseLocation: eventLocation || course?.city || course?.canton || '',
      providerName,
      amountTotal: session.amount_total
    });

    return res.status(200).json({ received: true, note: 'Processed' });
  } catch (error) {
    console.error('Confirm checkout session failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
