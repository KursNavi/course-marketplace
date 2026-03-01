-- Migration: Payout nach Kursdurchführung statt davor
-- Setzt payout_eligible_at für bestehende unpaid platform-Bookings
-- auf event_start + 7 Tage (Einspruchsfrist für Teilnehmer)

UPDATE bookings b
SET payout_eligible_at = ce.start_date + INTERVAL '7 days'
FROM course_events ce
WHERE b.event_id = ce.id
  AND b.booking_type = 'platform'
  AND b.is_paid = false;
