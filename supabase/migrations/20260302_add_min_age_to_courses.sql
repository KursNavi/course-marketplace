-- Mindestalter-Feld für Kurse (optional, relevant für Kinder-Kurse)
ALTER TABLE courses ADD COLUMN min_age INTEGER NULL;
