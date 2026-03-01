-- Migration: Payout nach Kursdurchführung statt davor
-- Setzt payout_eligible_at für bestehende unpaid platform-Bookings
-- auf event_start + 2 Tage (statt paid_at + 7 Tage)

UPDATE bookings b
SET payout_eligible_at = ce.start_date + INTERVAL '2 days'
FROM course_events ce
WHERE b.event_id = ce.id
  AND b.booking_type = 'platform'
  AND b.is_paid = false;
