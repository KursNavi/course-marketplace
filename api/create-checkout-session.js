import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`.replace(/\/$/, '');
  }

  const raw = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://kursnavi.ch';
  return raw.replace(/\/$/, '');
}

function normalizeStripeImageUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return null;

  try {
    const parsedUrl = new URL(trimmedUrl);
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const normalizedPath = parsedUrl.pathname.toLowerCase();

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }

    if (!allowedExtensions.some((extension) => normalizedPath.endsWith(extension))) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function toStripeMetadata(values) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { courseId, courseImage, eventId, guardianAttestation } = req.body;

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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
    const userEmail = (authUser.email || '').toLowerCase();

    // Block providers from booking courses
    if (authUser.user_metadata?.role === 'teacher') {
      return res.status(403).json({ error: 'Kursanbieter können keine Kurse buchen' });
    }

    // 1. Load course to check booking_type and validate
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

    // Free course: skip Stripe, signal client to use book-with-credit directly
    const coursePriceCentsCheck = Math.round((Number(course.price) || 0) * 100);
    if (coursePriceCentsCheck === 0) {
      return res.status(200).json({ free_booking: true });
    }

    // Guardian attestation: server-side enforcement
    if (course.requires_guardian_booking && !guardianAttestation) {
      return res.status(400).json({ error: 'Für diesen Kurs ist die Bestätigung durch eine erziehungsberechtigte Person erforderlich.' });
    }

    let effectiveBookingType = course.booking_type;

    // 2. Event capacity check (only for platform)
    if (course.booking_type === 'platform') {
      if (!eventId) {
        const { data: possibleEvents } = await supabase
          .from('course_events')
          .select('id, start_date')
          .eq('course_id', courseId)
          .is('cancelled_at', null);

        const hasFutureEvents = (possibleEvents || []).some((event) => (
          event?.start_date && new Date(`${event.start_date}T23:59:59`) >= new Date()
        ));

        if (hasFutureEvents) {
          return res.status(400).json({ error: 'Event-ID erforderlich für Direktbuchung' });
        }

        effectiveBookingType = 'platform_flex';
      }

      if (eventId) {
        // Get event with booking count
        const { data: eventData, error: eventError } = await supabase
          .from('course_events')
          .select('id, course_id, max_participants, cancelled_at, start_date')
          .eq('id', eventId)
          .single();

        if (eventError || !eventData) {
          return res.status(400).json({ error: 'Event nicht gefunden' });
        }
        if (Number(eventData.course_id) !== Number(courseId)) {
          return res.status(400).json({ error: 'Event gehört nicht zu diesem Kurs' });
        }

        if (eventData.start_date && new Date(`${eventData.start_date}T23:59:59`) < new Date()) {
          return res.status(400).json({ error: 'Dieser Termin liegt in der Vergangenheit' });
        }

        // Block booking for cancelled events
        if (eventData.cancelled_at) {
          return res.status(400).json({ error: 'Dieser Termin wurde abgesagt' });
        }

        // Count confirmed bookings for this event
        const { count: bookedCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'confirmed');

        if (eventData.max_participants > 0 && bookedCount >= eventData.max_participants) {
          return res.status(400).json({ error: 'Dieser Termin ist ausgebucht' });
        }

        // Duplicate check: User has already booked this event?
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
      }
    }

    // 3. Ticket limit check (for platform + platform_flex)
    if (course.ticket_limit_30d) {
      const { data: availability } = await supabase.rpc('check_ticket_availability', {
        p_course_id: courseId
      });

      if (!availability?.[0]?.available) {
        return res.status(400).json({
          error: 'Kontingent erschöpft. Bitte später erneut versuchen.',
          period_end: availability?.[0]?.period_end
        });
      }
    }

    // 4. Load provider name for transparency
    let providerName = 'Kursanbieter';
    const courseTitle = course.title || 'Kurs';
    if (course.user_id) {
      const { data: providerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', course.user_id)
        .single();
      if (providerProfile?.full_name) providerName = providerProfile.full_name;
    }

    // 5. Get or create Stripe customer
    let customerId;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, credit_balance_cents')
      .eq('id', userId)
      .single();

    // Check credit balance for full-credit bookings
    const creditBalance = profile?.credit_balance_cents || 0;
    const coursePriceCents = Math.round((Number(course.price) || 0) * 100);

    if (creditBalance >= coursePriceCents && coursePriceCents > 0) {
      return res.status(200).json({
        full_credit_available: true,
        credit_balance_cents: creditBalance,
        course_price_cents: coursePriceCents
      });
    }

    // Calculate credit to apply (partial)
    const creditToApply = Math.min(creditBalance, coursePriceCents);
    const stripeAmountCents = coursePriceCents - creditToApply;

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // 6. Create Stripe checkout session with v2 metadata
    const baseUrl = getBaseUrl(req);
    const stripeImageUrl = normalizeStripeImageUrl(courseImage);
    const productData = {
      name: courseTitle,
      description: creditToApply > 0
        ? `Anbieter: ${providerName}. Guthaben verrechnet: CHF ${(creditToApply / 100).toFixed(2)}. Zahlungsabwicklung: KursNavi (LifeSkills360 GmbH).`
        : `Anbieter: ${providerName}. Zahlungsabwicklung: KursNavi (LifeSkills360 GmbH).`,
    };

    if (stripeImageUrl) {
      productData.images = [stripeImageUrl];
    } else if (courseImage) {
      console.warn('Skipping invalid Stripe checkout image URL:', courseImage);
    }

    const sessionMetadata = toStripeMetadata({
      courseId,
      userId,
      eventId: eventId || '',
      bookingType: effectiveBookingType,
      providerName,
      courseTitle,
      guardianAttestation: guardianAttestation ? 'true' : 'false',
      creditToApplyCents: creditToApply
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'chf',
            product_data: productData,
            unit_amount: stripeAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      custom_text: {
        after_submit: {
          message: `Vertragspartner für diesen Kurs ist ${providerName}. Die Buchung erfolgt im eigenen Namen; die buchende Person bleibt Vertragspartnerin und zahlungspflichtig. KursNavi (LifeSkills360 GmbH) wickelt die Zahlung technisch ab.`
        }
      },
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/course/${courseId}`,
      metadata: sessionMetadata,
    });

    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Interner Fehler' });
  }
}
