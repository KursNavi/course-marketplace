import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  calculateAutoRefundUntil,
  calculatePayoutEligibleAt,
  sendCourseBookingEmails
} from './_lib/course-booking-email.js';
import { getDashboardUrl } from './_lib/base-url.js';
import { restoreRefundedFlexBooking } from './_lib/rebook-flex.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const dashboardUrl = getDashboardUrl(req);

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
    }
    const userId = authUser.id;

    // Block providers from booking courses
    if (authUser.user_metadata?.role === 'teacher') {
      return res.status(403).json({ error: 'Kursanbieter können keine Kurse buchen' });
    }

    const { courseId, eventId, guardianAttestation } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // 1. Load course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, booking_type, ticket_limit_30d, price, user_id, requires_guardian_booking')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      console.error('Course lookup failed:', { courseId, courseError });
      return res.status(400).json({ error: 'Kurs nicht gefunden' });
    }

    if (course.booking_type === 'lead') {
      return res.status(400).json({ error: 'Dieser Kurs ist nicht online buchbar' });
    }

    if (course.requires_guardian_booking && !guardianAttestation) {
      return res.status(400).json({ error: 'Für diesen Kurs ist die Bestätigung durch eine erziehungsberechtigte Person erforderlich.' });
    }

    const coursePriceCents = Math.round((Number(course.price) || 0) * 100);
    const isFreeCourse = coursePriceCents === 0;
    if (coursePriceCents < 0) {
      return res.status(400).json({ error: 'Kurspreis ungültig' });
    }

    // 2. Verify credit balance (skip for free courses)
    const { data: profile } = await supabase
      .from('profiles')
      .select('credit_balance_cents, email')
      .eq('id', userId)
      .single();

    const creditBalance = profile?.credit_balance_cents || 0;
    if (!isFreeCourse && creditBalance < coursePriceCents) {
      return res.status(400).json({ error: 'Nicht genügend Guthaben' });
    }

    const getEventCutoffDate = (value) => {
      if (!value) return null;
      const normalizedValue = String(value).trim();
      if (!normalizedValue) return null;

      const parsed = normalizedValue.includes('T')
        ? new Date(normalizedValue)
        : new Date(`${normalizedValue}T23:59:59`);

      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    // 3. Determine effective booking type
    let effectiveBookingType = course.booking_type;
    let eventStartAt = null;
    let eventEndAt = null;
    let eventLocation = null;

    if (course.booking_type === 'platform') {
      if (!eventId) {
        // Check if there are future events — if not, fallback to flex
        const { data: possibleEvents } = await supabase
          .from('course_events')
          .select('id, start_date')
          .eq('course_id', courseId)
          .is('cancelled_at', null);

        const hasFutureEvents = (possibleEvents || []).some((event) => {
          const cutoff = getEventCutoffDate(event?.start_date);
          return cutoff ? cutoff >= new Date() : false;
        });

        if (hasFutureEvents) {
          return res.status(400).json({ error: 'Event-ID erforderlich für Direktbuchung' });
        }
        effectiveBookingType = 'platform_flex';
      }

      if (eventId) {
        const { data: eventData, error: eventError } = await supabase
          .from('course_events')
          .select('id, course_id, max_participants, cancelled_at, start_date, end_date, location, city')
          .eq('id', eventId)
          .single();

        if (eventError || !eventData) {
          return res.status(400).json({ error: 'Event nicht gefunden' });
        }
        if (Number(eventData.course_id) !== Number(courseId)) {
          return res.status(400).json({ error: 'Event gehört nicht zu diesem Kurs' });
        }
        const eventCutoff = getEventCutoffDate(eventData.start_date);
        if (eventCutoff && eventCutoff < new Date()) {
          return res.status(400).json({ error: 'Dieser Termin liegt in der Vergangenheit' });
        }
        if (eventData.cancelled_at) {
          return res.status(400).json({ error: 'Dieser Termin wurde abgesagt' });
        }

        const { count: bookedCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'confirmed');

        if (eventData.max_participants > 0 && bookedCount >= eventData.max_participants) {
          return res.status(400).json({ error: 'Dieser Termin ist ausgebucht' });
        }

        // Duplicate check
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', userId)
          .eq('event_id', eventId)
          .eq('status', 'confirmed')
          .single();

        if (existingBooking) {
          return res.status(400).json({ error: 'Du hast diesen Termin bereits gebucht' });
        }

        eventStartAt = eventData.start_date;
        eventEndAt = eventData.end_date;
        eventLocation = eventData.location || eventData.city || null;
      }
    }

    // 4. Ticket limit check
    let periodId = null;
    if (course.ticket_limit_30d) {
      const { data: ticketResult, error: ticketError } = await supabase.rpc('reserve_ticket', {
        p_course_id: courseId
      });

      if (ticketError || !ticketResult?.[0]?.success) {
        return res.status(409).json({ error: 'Kontingent erschöpft. Bitte später erneut versuchen.' });
      }
      periodId = ticketResult[0].period_id;
    }

    // 5. Deduct credit atomically (skip for free courses)
    let actuallyDeducted = 0;
    let newBalanceCents = 0;
    if (!isFreeCourse) {
      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credit', {
        p_user_id: userId,
        p_amount_cents: coursePriceCents,
        p_description: `Buchung: ${course.title || 'Kurs'}`
      });

      if (deductError) {
        console.error('Credit deduction failed:', deductError);
        if (periodId) {
          await supabase.rpc('release_ticket', { p_period_id: periodId });
        }
        return res.status(500).json({ error: 'Guthaben-Abzug fehlgeschlagen' });
      }

      actuallyDeducted = deductResult?.[0]?.actually_deducted || 0;
      newBalanceCents = deductResult?.[0]?.new_balance_cents || 0;
      if (actuallyDeducted < coursePriceCents) {
        // Credit was spent concurrently — release ticket and abort
        if (periodId) {
          await supabase.rpc('release_ticket', { p_period_id: periodId });
        }
        // Re-add whatever was deducted
        if (actuallyDeducted > 0) {
          await supabase.rpc('add_credit', {
            p_user_id: userId,
            p_amount_cents: actuallyDeducted,
            p_type: 'cancellation_credit',
            p_description: 'Rückbuchung: Guthaben reichte nicht'
          });
        }
        return res.status(400).json({ error: 'Nicht genügend Guthaben. Bitte versuche es erneut.' });
      }
    }

    // 6. Calculate timestamps
    const paidAt = new Date();
    const autoRefundUntil = calculateAutoRefundUntil(paidAt, eventStartAt, effectiveBookingType);
    const payoutEligibleAt = calculatePayoutEligibleAt(paidAt, eventEndAt, eventStartAt, effectiveBookingType);

    if (effectiveBookingType === 'platform_flex' && !eventId) {
      try {
        const restoredBooking = await restoreRefundedFlexBooking({
          supabase,
          userId,
          courseId,
          bookingType: effectiveBookingType,
          paidAt,
          autoRefundUntil,
          payoutEligibleAt,
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
          ticketPeriodId: periodId,
          guardianAttestation,
          paidViaCredit: !isFreeCourse,
          creditUsedCents: isFreeCourse ? 0 : coursePriceCents
        });

        if (restoredBooking) {
          return res.status(200).json({
            success: true,
            restored_booking: true,
            new_balance_chf: (newBalanceCents / 100).toFixed(2)
          });
        }
      } catch (restoreError) {
        console.error('Flex rebooking pre-insert restore failed:', restoreError);
      }
    }

    // 7. Insert booking
    const { error: insertError } = await supabase.from('bookings').insert({
      user_id: userId,
      course_id: courseId,
      event_id: eventId || null,
      status: 'confirmed',
      booking_type: effectiveBookingType,
      paid_at: paidAt.toISOString(),
      auto_refund_until: autoRefundUntil?.toISOString() || null,
      payout_eligible_at: payoutEligibleAt?.toISOString() || null,
      stripe_payment_intent_id: null,
      stripe_checkout_session_id: null,
      ticket_period_id: periodId,
      guardian_attestation: !!guardianAttestation,
      paid_via_credit: !isFreeCourse,
      credit_used_cents: isFreeCourse ? 0 : coursePriceCents
    });

    if (insertError) {
      console.error('Booking insert failed:', insertError);

      if (insertError.code === '23505' && effectiveBookingType === 'platform_flex' && !eventId) {
        try {
          const restoredBooking = await restoreRefundedFlexBooking({
            supabase,
            userId,
            courseId,
            bookingType: effectiveBookingType,
            paidAt,
            autoRefundUntil,
            payoutEligibleAt,
            stripePaymentIntentId: null,
            stripeCheckoutSessionId: null,
            ticketPeriodId: periodId,
            guardianAttestation,
            paidViaCredit: !isFreeCourse,
            creditUsedCents: isFreeCourse ? 0 : coursePriceCents
          });

          if (restoredBooking) {
            console.info('Restored refunded flex booking before duplicate failure', {
              bookingId: restoredBooking.id,
              userId,
              courseId
            });
            return res.status(200).json({
              success: true,
              restored_booking: true,
              new_balance_chf: (newBalanceCents / 100).toFixed(2)
            });
          }
        } catch (restoreError) {
          console.error('Flex rebooking restore failed:', restoreError);
        }

        if (periodId) {
          await supabase.rpc('release_ticket', { p_period_id: periodId });
        }
        if (!isFreeCourse) {
          await supabase.rpc('add_credit', {
            p_user_id: userId,
            p_amount_cents: coursePriceCents,
            p_type: 'cancellation_credit',
            p_description: 'Rückbuchung: Buchung fehlgeschlagen'
          });
        }
        return res.status(400).json({ error: 'Buchung existiert bereits' });
      }

      // Release ticket + re-credit
      if (periodId) {
        await supabase.rpc('release_ticket', { p_period_id: periodId });
      }
      if (!isFreeCourse) {
        await supabase.rpc('add_credit', {
          p_user_id: userId,
          p_amount_cents: coursePriceCents,
          p_type: 'cancellation_credit',
          p_description: 'Rückbuchung: Buchung fehlgeschlagen'
        });
      }

      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'Buchung existiert bereits' });
      }
      return res.status(500).json({ error: 'Buchung konnte nicht erstellt werden' });
    }

    // 8. Send booking confirmation emails
    let providerName = 'Kursanbieter';
    let providerCity = '';
    if (course.user_id) {
      const { data: providerProfile } = await supabase
        .from('profiles')
        .select('full_name, city, canton')
        .eq('id', course.user_id)
        .single();
      if (providerProfile?.full_name) providerName = providerProfile.full_name;
      providerCity = providerProfile?.city || providerProfile?.canton || '';
    }

    try {
      await sendCourseBookingEmails({
        supabase,
        resend,
        dashboardUrl,
        userId,
        customerEmail: profile?.email || authUser.email,
        course,
        bookingType: effectiveBookingType,
        courseTitle: course.title || 'Kurs',
        courseDate: eventStartAt ? new Date(eventStartAt).toLocaleDateString('de-CH') : 'TBA',
        courseLocation: eventLocation || providerCity,
        providerName,
        amountTotal: coursePriceCents,
        paidWithCredit: true
      });
    } catch (emailErr) {
      console.error('Booking email failed:', emailErr);
    }

    return res.status(200).json({
      success: true,
      new_balance_chf: (newBalanceCents / 100).toFixed(2)
    });
  } catch (error) {
    console.error('Book with credit error:', error);
    return res.status(500).json({ error: error.message || 'Interner Fehler' });
  }
}
