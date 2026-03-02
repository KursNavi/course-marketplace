-- Guardian-Booking Pflichtfeld: Kinder-Kurse erfordern Buchung durch Erziehungsberechtigte
ALTER TABLE courses ADD COLUMN requires_guardian_booking BOOLEAN NOT NULL DEFAULT false;
