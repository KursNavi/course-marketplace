import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { courseId, courseTitle, coursePrice, userId, courseImage, userEmail, eventId } = req.body;

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Load course to check booking_type and validate
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, booking_type, ticket_limit_30d, price, user_id')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return res.status(400).json({ error: 'Kurs nicht gefunden' });
    }

    if (course.booking_type === 'lead') {
      return res.status(400).json({ error: 'Dieser Kurs ist nicht online buchbar' });
    }

    // 2. Event capacity check (only for platform)
    if (course.booking_type === 'platform') {
      if (!eventId) {
        return res.status(400).json({ error: 'Event-ID erforderlich für Direktbuchung' });
      }

      // Get event with booking count
      const { data: eventData, error: eventError } = await supabase
        .from('course_events')
        .select('id, max_participants')
        .eq('id', eventId)
        .single();

      if (eventError || !eventData) {
        return res.status(400).json({ error: 'Event nicht gefunden' });
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
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

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
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'chf',
            product_data: {
              name: courseTitle,
              description: `Anbieter: ${providerName}. Zahlungsabwicklung: KursNavi (LifeSkills360 GmbH).`,
              images: courseImage ? [courseImage] : [],
            },
            unit_amount: Math.round(coursePrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      custom_text: {
        after_submit: {
          message: `Vertragspartner für diesen Kurs ist ${providerName}. KursNavi (LifeSkills360 GmbH) wickelt die Zahlung technisch ab.`
        }
      },
      success_url: `${req.headers.origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/course/${courseId}`,
      metadata: {
        courseId,
        userId,
        eventId: eventId || '',
        bookingType: course.booking_type,
        providerName
      },
    });

    res.status(200).json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}