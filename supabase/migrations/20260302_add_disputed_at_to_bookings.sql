-- Einspruch-Feature: disputed_at Feld für Bookings
-- Wenn gesetzt, wird die Auszahlung blockiert bis Admin entscheidet

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_reason TEXT DEFAULT NULL;
