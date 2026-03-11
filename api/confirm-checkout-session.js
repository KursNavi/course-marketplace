import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function calculatePayoutEligibleAt(paidAt, eventEndAt, eventStartAt, bookingType) {
  const DAYS_MS = 24 * 60 * 60 * 1000;

  if (bookingType === 'platform') {
    const eventRef = eventEndAt || eventStartAt;
    if (eventRef) {
      return new Date(new Date(eventRef).getTime() + 2 * DAYS_MS);
    }
    return new Date(new Date(paidAt).getTime() + 14 * DAYS_MS);
  }

  if (bookingType === 'platform_flex') {
    return null;
  }

  return null;
}

function calculateAutoRefundUntil(paidAt, eventStartAt, bookingType) {
  if (bookingType === 'lead') {
    return null;
  }

  const paidDate = new Date(paidAt);
  const sevenDaysAfterPayment = new Date(paidDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (bookingType === 'platform_flex') {
    return sevenDaysAfterPayment;
  }

  if (bookingType === 'platform' && eventStartAt) {
    const eventDate = new Date(eventStartAt);
    const sevenDaysBeforeEvent = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (sevenDaysBeforeEvent <= paidDate) {
      return null;
    }

    return sevenDaysAfterPayment < sevenDaysBeforeEvent ? sevenDaysAfterPayment : sevenDaysBeforeEvent;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
      .select('id, ticket_limit_30d')
      .eq('id', courseId)
      .single();

    let eventStartAt = null;
    let eventEndAt = null;
    if (eventId) {
      const { data: eventData } = await supabase
        .from('course_events')
        .select('course_id, start_date, end_date')
        .eq('id', eventId)
        .single();

      if (eventData?.course_id && Number(eventData.course_id) !== Number(courseId)) {
        return res.status(409).json({ error: 'Mismatched event/course metadata' });
      }

      eventStartAt = eventData?.start_date;
      eventEndAt = eventData?.end_date;
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
      guardian_attestation: metadata.guardianAttestation === 'true'
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(200).json({ received: true, note: 'Duplicate, ignored' });
      }
      return res.status(500).json({ error: 'Database insert failed', details: insertError });
    }

    return res.status(200).json({ received: true, note: 'Processed' });
  } catch (error) {
    console.error('Confirm checkout session failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
