# Plan: Erweitertes Buchungssystem v2

## Kontext

**Projekt:** KursNavi (Schweizer Kursplattform)
**Tech-Stack:** React (Vite), Supabase, Stripe, Vercel

### Aktueller Stand
- Zwei Buchungstypen: `lead` (Anfrage) und `platform` (Direktbuchung mit Event)
- Stripe Checkout + Webhook für Zahlungen
- Refunds aktuell deaktiviert (manuell via Anbieter)
- Events haben `max_participants` für Kapazität
- Cron-Job für Payouts (25-35 Tage vor Kursstart)
- Location-Felder auf Kursebene: `city`, `canton`, `address`
- Location-Felder auf Event-Ebene: `location`, `canton`, `street`, `city`

### Relevante Dateien
- `api/create-checkout-session.js` - Stripe Checkout erstellen
- `api/webhook.js` - Stripe Events verarbeiten, Booking erstellen
- `api/cron.js` - Payout-Logik
- `src/components/TeacherForm.jsx` - Kurs erstellen/bearbeiten
- `src/components/DetailView.jsx` - Kursdetails + Buchungsflow
- `src/components/Dashboard.jsx` - Lernende + Anbieter Dashboard

---

## Zusammenfassung der Entscheidungen

| Thema | Entscheidung |
|-------|--------------|
| Ticket-Limit | Fixe 30-Tage-Periode, Reset bei Ablauf, gilt für `platform` + `platform_flex` gemeinsam |
| Ticket bei Refund | Freigeben (nur wenn Periode noch aktiv) |
| Status-Werte | `confirmed`, `refunded` (MVP-minimal) |
| Overbooking | Webhook-Check + Auto-Refund + Email an User |
| Location | Bestehende Felder `city`/`canton` nutzen, Pflicht bei `lead`/`platform_flex` |
| Refund-Fenster | `platform_flex`: 7 Tage ab Zahlung. `platform`: min(7d ab Zahlung, 7d vor Event), sonst NULL |
| Dedupe | `stripe_checkout_session_id` UNIQUE + User-Event Duplikat-Check |

---

## 1. Buchungsarten

### Werte & Regeln

| Typ | Event-Pflicht | Location-Pflicht (Kursebene) | Zahlung | Ticket-Limit |
|-----|---------------|------------------------------|---------|--------------|
| `lead` | Nein | Ja (`city` oder `canton`) | Keine | Nein |
| `platform` | Ja (min. 1) | Nein (aus Event) | Stripe | Ja |
| `platform_flex` | Nein | Ja (`city` oder `canton`) | Stripe | Ja |

### Doppelte Begrenzung bei `platform`
- **Event-Kapazität** (`max_participants` pro Event) – wie bisher
- **Ticket-Limit** (`ticket_limit_30d` auf Kursebene) – NEU, zusätzlich

Buchung nur wenn **beide** Limits ok sind.

---

## 2. Datenbank-Änderungen

### 2.1 Courses Tabelle

```sql
-- booking_type Constraint erweitern
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_booking_type_check;
ALTER TABLE courses ADD CONSTRAINT courses_booking_type_check
  CHECK (booking_type IN ('lead', 'platform', 'platform_flex'));

-- Ticket-Limit Feld (NULL = unlimited)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ticket_limit_30d INTEGER DEFAULT NULL;
```

### 2.2 Bookings Tabelle

```sql
-- Neue Felder
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_refund_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_type TEXT,
  ADD COLUMN IF NOT EXISTS ticket_period_id UUID;

-- event_id nullable (für flex)
ALTER TABLE bookings ALTER COLUMN event_id DROP NOT NULL;

-- Status: nur confirmed/refunded (MVP)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'refunded'));

-- Idempotenz: Stripe Session ID unique
ALTER TABLE bookings ADD CONSTRAINT bookings_stripe_session_unique
  UNIQUE (stripe_checkout_session_id);

-- Duplikat-Schutz: User kann Event nur einmal buchen
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_user_event_unique
  ON bookings (user_id, event_id)
  WHERE event_id IS NOT NULL AND status = 'confirmed';
```

### 2.3 Neue Tabelle: ticket_periods

```sql
CREATE TABLE IF NOT EXISTS ticket_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sold_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ticket_periods_course ON ticket_periods(course_id);
CREATE INDEX IF NOT EXISTS idx_ticket_periods_active ON ticket_periods(course_id, period_end);
```

### 2.4 Datenbank-Funktionen

```sql
-- Aktuelle Periode holen oder erstellen
CREATE OR REPLACE FUNCTION get_or_create_ticket_period(p_course_id UUID)
RETURNS ticket_periods AS $$
DECLARE
  current_period ticket_periods;
  new_period_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO current_period
  FROM ticket_periods
  WHERE course_id = p_course_id
    AND period_end > NOW()
  ORDER BY period_start DESC
  LIMIT 1;

  IF current_period IS NULL THEN
    new_period_start := NOW();
    INSERT INTO ticket_periods (course_id, period_start, period_end, sold_count)
    VALUES (p_course_id, new_period_start, new_period_start + INTERVAL '30 days', 0)
    RETURNING * INTO current_period;
  END IF;

  RETURN current_period;
END;
$$ LANGUAGE plpgsql;

-- Verfügbarkeit prüfen (für UI + Pre-Checkout)
CREATE OR REPLACE FUNCTION check_ticket_availability(p_course_id UUID)
RETURNS TABLE(available BOOLEAN, remaining INTEGER, period_end TIMESTAMPTZ) AS $$
DECLARE
  course_limit INTEGER;
  period ticket_periods;
BEGIN
  SELECT ticket_limit_30d INTO course_limit FROM courses WHERE id = p_course_id;

  IF course_limit IS NULL THEN
    RETURN QUERY SELECT true, NULL::INTEGER, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  period := get_or_create_ticket_period(p_course_id);

  RETURN QUERY SELECT
    (period.sold_count < course_limit),
    (course_limit - period.sold_count),
    period.period_end;
END;
$$ LANGUAGE plpgsql;

-- Ticket reservieren (mit Row Lock)
CREATE OR REPLACE FUNCTION reserve_ticket(p_course_id UUID)
RETURNS TABLE(success BOOLEAN, period_id UUID) AS $$
DECLARE
  course_limit INTEGER;
  period ticket_periods;
BEGIN
  SELECT ticket_limit_30d INTO course_limit FROM courses WHERE id = p_course_id;

  IF course_limit IS NULL THEN
    RETURN QUERY SELECT true, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO period
  FROM ticket_periods
  WHERE course_id = p_course_id AND period_end > NOW()
  ORDER BY period_start DESC
  LIMIT 1
  FOR UPDATE;

  IF period IS NULL THEN
    period := get_or_create_ticket_period(p_course_id);
    -- Re-lock nach Insert
    SELECT * INTO period
    FROM ticket_periods
    WHERE id = period.id
    FOR UPDATE;
  END IF;

  IF period.sold_count >= course_limit THEN
    RETURN QUERY SELECT false, NULL::UUID;
    RETURN;
  END IF;

  UPDATE ticket_periods
  SET sold_count = sold_count + 1
  WHERE id = period.id;

  RETURN QUERY SELECT true, period.id;
END;
$$ LANGUAGE plpgsql;

-- Ticket freigeben bei Refund (nur wenn Periode noch aktiv)
CREATE OR REPLACE FUNCTION release_ticket(p_period_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE ticket_periods
  SET sold_count = GREATEST(0, sold_count - 1)
  WHERE id = p_period_id AND period_end > NOW();

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Auto-Refund Logik

### Berechnung

```javascript
function calculateAutoRefundUntil(paidAt, eventStartAt, bookingType) {
  if (bookingType === 'lead') {
    return null; // Kein Refund für Leads
  }

  const sevenDaysAfterPayment = addDays(paidAt, 7);

  if (bookingType === 'platform_flex') {
    return sevenDaysAfterPayment;
  }

  // platform mit Event
  if (bookingType === 'platform' && eventStartAt) {
    const sevenDaysBeforeEvent = subDays(new Date(eventStartAt), 7);

    // Event in weniger als 7 Tagen → kein Auto-Refund
    if (sevenDaysBeforeEvent <= paidAt) {
      return null;
    }

    return min(sevenDaysAfterPayment, sevenDaysBeforeEvent);
  }

  return null;
}
```

### Server-side Check

```javascript
function canAutoRefund(booking) {
  return (
    booking.status === 'confirmed' &&
    booking.auto_refund_until !== null &&
    new Date() < new Date(booking.auto_refund_until)
  );
}
```

---

## 4. API-Änderungen

### 4.1 POST /api/create-checkout-session

```javascript
export default async function handler(req, res) {
  const { courseId, eventId, userId } = req.body;

  // Kurs laden
  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (!course || course.booking_type === 'lead') {
    return res.status(400).json({ error: 'Kurs nicht buchbar' });
  }

  // 1. Event-Kapazität prüfen (nur für platform)
  if (course.booking_type === 'platform') {
    if (!eventId) {
      return res.status(400).json({ error: 'Event-ID erforderlich' });
    }

    const { data: event } = await supabase
      .from('course_events')
      .select('*, bookings(count)')
      .eq('id', eventId)
      .single();

    const bookedCount = event.bookings?.[0]?.count || 0;
    if (event.max_participants > 0 && bookedCount >= event.max_participants) {
      return res.status(400).json({ error: 'Event ist ausgebucht' });
    }

    // Duplikat-Check: User hat dieses Event bereits gebucht?
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

  // 2. Ticket-Limit prüfen (für platform + platform_flex)
  if (course.ticket_limit_30d) {
    const { data: availability } = await supabase.rpc('check_ticket_availability', {
      p_course_id: courseId
    });

    if (!availability?.[0]?.available) {
      return res.status(400).json({
        error: 'Kontingent erschöpft',
        period_end: availability?.[0]?.period_end
      });
    }
  }

  // 3. Stripe Session erstellen
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: await getOrCreateStripeCustomer(userId),
    line_items: [{
      price_data: {
        currency: 'chf',
        product_data: { name: course.title },
        unit_amount: Math.round(course.price * 100)
      },
      quantity: 1
    }],
    metadata: {
      courseId,
      userId,
      eventId: eventId || '',
      bookingType: course.booking_type
    },
    success_url: `${process.env.BASE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/course/${courseId}`
  });

  return res.status(200).json({ url: session.url });
}
```

### 4.2 POST /api/webhook (checkout.session.completed)

```javascript
case 'checkout.session.completed': {
  const session = event.data.object;
  const { courseId, userId, eventId, bookingType } = session.metadata;

  // Idempotenz: Bereits verarbeitet?
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id')
    .eq('stripe_checkout_session_id', session.id)
    .single();

  if (existingBooking) {
    return res.status(200).json({ received: true, note: 'Already processed' });
  }

  // Event-Daten holen (falls vorhanden)
  let eventStartAt = null;
  if (eventId) {
    const { data: eventData } = await supabase
      .from('course_events')
      .select('start_date')
      .eq('id', eventId)
      .single();
    eventStartAt = eventData?.start_date;
  }

  // Ticket reservieren (mit Lock)
  let periodId = null;
  if (bookingType !== 'lead') {
    const { data: ticketResult } = await supabase.rpc('reserve_ticket', {
      p_course_id: courseId
    });

    if (!ticketResult?.[0]?.success) {
      // Limit erreicht → Auto-Refund
      await stripe.refunds.create({ payment_intent: session.payment_intent });

      // User benachrichtigen
      await sendOverbookingRefundEmail(userId, courseId);

      return res.status(200).json({
        received: true,
        note: 'Ticket unavailable, auto-refunded'
      });
    }
    periodId = ticketResult[0].period_id;
  }

  // Timestamps berechnen
  const paidAt = new Date();
  const autoRefundUntil = calculateAutoRefundUntil(paidAt, eventStartAt, bookingType);
  const payoutEligibleAt = addDays(paidAt, 7);

  // Booking erstellen
  const { error: insertError } = await supabase.from('bookings').insert({
    user_id: userId,
    course_id: courseId,
    event_id: eventId || null,
    status: 'confirmed',
    booking_type: bookingType,
    paid_at: paidAt.toISOString(),
    auto_refund_until: autoRefundUntil?.toISOString() || null,
    payout_eligible_at: payoutEligibleAt.toISOString(),
    stripe_payment_intent_id: session.payment_intent,
    stripe_checkout_session_id: session.id,
    ticket_period_id: periodId
  });

  if (insertError) {
    // Duplikat durch Unique-Constraint? → Idempotent ignorieren
    if (insertError.code === '23505') {
      return res.status(200).json({ received: true, note: 'Duplicate, ignored' });
    }
    throw insertError;
  }

  // Emails senden (angepasst für flex)
  await sendBookingConfirmationEmail(userId, courseId, eventId, bookingType);
  await notifyProviderOfBooking(courseId, userId, eventId, bookingType);

  return res.status(200).json({ received: true });
}
```

### 4.3 POST /api/refund-booking (NEU)

```javascript
export default async function handler(req, res) {
  const { bookingId } = req.body;
  const userId = /* aus Auth */;

  // Booking laden (nur eigene)
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, courses(title)')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .single();

  if (!booking) {
    return res.status(404).json({ error: 'Buchung nicht gefunden' });
  }

  // Server-side Eligibility-Check
  if (!canAutoRefund(booking)) {
    return res.status(400).json({
      error: 'Rückerstattungsfrist abgelaufen',
      auto_refund_until: booking.auto_refund_until
    });
  }

  // Stripe Refund
  try {
    await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id
    });
  } catch (stripeError) {
    console.error('Stripe refund failed:', stripeError);
    return res.status(500).json({ error: 'Rückerstattung fehlgeschlagen' });
  }

  // Status aktualisieren
  await supabase
    .from('bookings')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  // Ticket freigeben (wenn Periode noch aktiv)
  if (booking.ticket_period_id) {
    await supabase.rpc('release_ticket', {
      p_period_id: booking.ticket_period_id
    });
  }

  // Emails
  await sendRefundConfirmationEmail(booking);
  await notifyProviderOfRefund(booking);

  return res.status(200).json({ success: true });
}
```

---

## 5. Frontend-Änderungen

### 5.1 TeacherForm.jsx

**Booking-Type Auswahl:**
```jsx
<RadioGroup value={bookingType} onChange={setBookingType}>
  <Radio value="lead">Anfrage (kein Online-Kauf)</Radio>
  <Radio value="platform">Direktbuchung mit Termin</Radio>
  <Radio value="platform_flex">Direktbuchung flexibel (Termin wird vereinbart)</Radio>
</RadioGroup>
```

**Validierung:**
```javascript
// Bei Submit
if (bookingType === 'lead' || bookingType === 'platform_flex') {
  if (!city && !canton) {
    setError('Bitte Ort angeben (Stadt oder Kanton)');
    return;
  }
}
if (bookingType === 'platform') {
  if (events.length === 0) {
    setError('Mindestens 1 Termin erforderlich');
    return;
  }
}
```

**Ticket-Limit Feld:**
```jsx
{(bookingType === 'platform' || bookingType === 'platform_flex') && (
  <Input
    type="number"
    label="Max. Buchungen pro 30 Tage"
    placeholder="Leer = unbegrenzt"
    value={ticketLimit30d}
    onChange={setTicketLimit30d}
  />
)}
```

### 5.2 DetailView.jsx

**Für `platform_flex`:**
```jsx
{course.booking_type === 'platform_flex' && (
  <>
    <p className="text-gray-600 mb-4">
      Der genaue Termin wird nach der Buchung direkt mit dem Anbieter vereinbart.
    </p>
    <Button
      onClick={handleCheckout}
      disabled={!ticketAvailable}
    >
      {ticketAvailable
        ? `Jetzt buchen (CHF ${course.price})`
        : 'Derzeit ausgebucht'}
    </Button>
    {ticketLimit && (
      <p className="text-sm text-gray-500 mt-2">
        Noch {remaining} Plätze verfügbar (Reset am {formatDate(periodEnd)})
      </p>
    )}
  </>
)}
```

**Ticket-Verfügbarkeit laden:**
```javascript
useEffect(() => {
  if (course.ticket_limit_30d) {
    supabase.rpc('check_ticket_availability', { p_course_id: course.id })
      .then(({ data }) => {
        setTicketAvailable(data?.[0]?.available ?? true);
        setRemaining(data?.[0]?.remaining);
        setPeriodEnd(data?.[0]?.period_end);
      });
  }
}, [course.id]);
```

### 5.3 Dashboard.jsx (Lernende)

**Buchungsanzeige:**
```jsx
{booking.booking_type === 'platform_flex' ? (
  <span className="text-gray-600">Termin wird vereinbart</span>
) : booking.event ? (
  <span>{formatDate(booking.event.start_date)} – {booking.event.location}</span>
) : null}
```

**Refund-Button:**
```jsx
{canAutoRefund(booking) && (
  <div className="mt-4">
    <Button variant="outline" onClick={() => handleRefund(booking.id)}>
      Buchung stornieren
    </Button>
    <p className="text-sm text-gray-500 mt-1">
      Rückgabe möglich bis {formatDateTime(booking.auto_refund_until)}
    </p>
  </div>
)}
```

### 5.4 Dashboard.jsx (Anbieter)

**Buchungen anzeigen:**
```jsx
<Badge variant={booking.booking_type === 'platform_flex' ? 'secondary' : 'default'}>
  {booking.booking_type === 'platform_flex' ? 'Flexibel' : 'Mit Termin'}
</Badge>
```

**Ticket-Statistik (wenn Limit gesetzt):**
```jsx
{course.ticket_limit_30d && (
  <div className="text-sm text-gray-600">
    {ticketPeriod.sold_count}/{course.ticket_limit_30d} gebucht
    <br />
    Reset am {formatDate(ticketPeriod.period_end)}
  </div>
)}
```

---

## 6. Payout-Logik (Cron anpassen)

```javascript
// api/cron.js

// 1. platform_flex: Payout nach Refund-Frist (7 Tage nach Zahlung)
const flexBookingsReady = await supabase
  .from('bookings')
  .select('*, courses(*)')
  .eq('booking_type', 'platform_flex')
  .eq('is_paid', false)
  .eq('status', 'confirmed')
  .lte('payout_eligible_at', new Date().toISOString());

// 2. platform: wie bisher (25-35 Tage vor Event)
const eventBookingsReady = await supabase
  .from('bookings')
  .select('*, courses(*), course_events!inner(*)')
  .eq('booking_type', 'platform')
  .eq('is_paid', false)
  .eq('status', 'confirmed')
  .gte('course_events.start_date', addDays(new Date(), 25))
  .lte('course_events.start_date', addDays(new Date(), 35));

// Beide zusammenführen und verarbeiten
const allReadyBookings = [...flexBookingsReady.data, ...eventBookingsReady.data];
// ... Payout-Logik wie bisher
```

---

## 7. Email-Anpassungen

### Buchungsbestätigung (flex)
```
Betreff: Deine Buchung bei [Kursname]

Hallo [Name],

Deine Buchung wurde erfolgreich abgeschlossen.

Kurs: [Kursname]
Ort: [Stadt, Kanton]
Termin: Wird direkt mit dem Anbieter vereinbart

Der Anbieter wird sich bei dir melden, um einen passenden Termin zu finden.

[Falls Refund möglich:]
Kostenlose Stornierung bis: [Datum/Uhrzeit]
```

### Overbooking-Refund
```
Betreff: Automatische Rückerstattung – [Kursname]

Hallo [Name],

Leider war der Kurs "[Kursname]" zum Zeitpunkt deiner Buchung bereits ausgebucht.

Der Betrag von CHF [Preis] wurde automatisch auf deine ursprüngliche Zahlungsmethode zurückerstattet.

Wir entschuldigen uns für die Unannehmlichkeiten.
```

---

## 8. Migrations-Reihenfolge

1. [x] **DB-Migration:** Tabellen, Spalten, Constraints, Funktionen
2. [x] **API:** Webhook anpassen (neue Felder, Ticket-Logik)
3. [x] **API:** Checkout anpassen (Validierung, Metadata)
4. [x] **API:** Refund-Endpoint implementieren
5. [x] **Frontend:** TeacherForm (Booking-Type, Ticket-Limit)
6. [x] **Frontend:** DetailView (flex-Flow, Availability)
7. [x] **Frontend:** Dashboard (Refund-Button, flex-Anzeige)
8. [x] **API:** Cron/Payout anpassen
9. [x] **Emails:** Templates für flex + Overbooking

---

## 9. Testszenarien

| Szenario | Erwartetes Verhalten |
|----------|----------------------|
| `platform_flex` buchen | Checkout ohne Event-Auswahl, Booking mit `event_id = NULL` |
| Refund innerhalb 7 Tagen | Button aktiv, Stripe Refund, Status `refunded`, Ticket freigegeben |
| Refund nach 7 Tagen | Button nicht sichtbar, API gibt 400 zurück |
| `platform` Event in 5 Tagen | `auto_refund_until = NULL`, kein Refund-Button |
| Ticket-Limit erreicht | Checkout gibt 400, "Kontingent erschöpft" |
| Race Condition (2 User, 1 Slot) | Erster gewinnt, zweiter bekommt Auto-Refund + Email |
| Periode abgelaufen | Neue Periode erstellt, Counter bei 0 |
| User bucht gleiches Event zweimal | Checkout gibt 400, "Bereits gebucht" |
