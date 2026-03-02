-- Migration: Payout nach Kursdurchführung statt davor
-- Setzt payout_eligible_at für bestehende unpaid platform-Bookings
-- auf COALESCE(end_date, start_date) + 2 Tage

UPDATE bookings b
SET payout_eligible_at = COALESCE(ce.end_date, ce.start_date) + INTERVAL '2 days'
FROM course_events ce
WHERE b.event_id = ce.id
  AND b.booking_type = 'platform'
  AND b.is_paid = false;
