-- Migration: Neue Kursart-Spalten für Privat & Hobby und Kinder & Jugend
-- Analog zu beruf_saeulen, aber als einzelner TEXT-Wert (nicht Array)
-- da die Kursarten für diese Segmente mutually exclusive sind

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS privat_kursart TEXT
    CHECK (privat_kursart IN ('workshop_event', 'einfuehrungskurs', 'wochenkurs', 'retreat_intensiv')),
  ADD COLUMN IF NOT EXISTS kinder_kursart TEXT
    CHECK (kinder_kursart IN ('feriencamp', 'ferienkurs', 'freizeitkurs', 'kindergeburtstag', 'events_workshops'));

COMMENT ON COLUMN courses.privat_kursart IS
  'Kursformat für Privat & Hobby Kurse: workshop_event | einfuehrungskurs | wochenkurs | retreat_intensiv';
COMMENT ON COLUMN courses.kinder_kursart IS
  'Kursformat für Kinder & Jugend Kurse: feriencamp | ferienkurs | freizeitkurs | kindergeburtstag | events_workshops';
