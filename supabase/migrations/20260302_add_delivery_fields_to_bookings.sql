-- platform_flex: Provider muss Buchung als "durchgeführt" markieren
-- Erst dann wird payout_eligible_at gesetzt (delivered_at + 2 Tage)
ALTER TABLE bookings ADD COLUMN delivered_at TIMESTAMPTZ NULL;
ALTER TABLE bookings ADD COLUMN delivered_by UUID NULL;
