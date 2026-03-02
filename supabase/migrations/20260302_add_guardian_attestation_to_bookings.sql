-- Attestation: Buchender bestätigt, 18+ zu sein und ggf. als Erziehungsberechtigte/r zu buchen
ALTER TABLE bookings ADD COLUMN guardian_attestation BOOLEAN NOT NULL DEFAULT false;
