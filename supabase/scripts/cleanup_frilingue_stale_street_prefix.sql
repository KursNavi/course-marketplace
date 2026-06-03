-- ============================================================
-- BEREINIGUNG: Falsche Stöckackerstrasse 93-Prefix aus Termin-Orten
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Entfernt gezielt den fälschlichen "Stöckackerstrasse 93, "-Prefix
-- aus course_events.location. Dieser Prefix stammt aus dem
-- Profil-Hauptstandort, der irrtümlich als Termin-Adresse vorausgefüllt
-- und gespeichert wurde.
--
-- Betroffene Kurse laut Analyse:
--   519 Estavayer Beachcamp
--   520 Mathecamp
--   528 Sprachcamp Braunwald
--   529 friLingue Open Tennis Camp St. Bernhard
--   530 Abenteuercamp St. Bernhard
--   531 Englischcamp Schwarzsee
--   532 Intensivcamp Bilingue Schwarzsee
--   533 St.Bernhard Sprachreise
--   534 Kreativcamp
--   535 Fussballcamp St. Bernhard
--   536 friLeadership Camp
--   537 Ski- und Snowboard Camp Braunwald
--   538 Abenteuer & Sportcamp St. Bernhard
--   539 Friplica – Selbstlerncamp
--
-- NICHT betroffen (legitime Adressen bleiben unverändert):
--   391 T-Bow Workout (Zelgli 3, Oberrohrdorf)
--   508/509/512/514 Erlebnis-Kurse (Grossmatte 4, Eigenthal)
--
-- Ausführen: Supabase SQL Editor
-- Sicher: Nur exakter Prefix "Stöckackerstrasse 93, " wird entfernt.
-- ============================================================

-- Vorschau: Was wird geändert?
-- (Diese SELECT-Query zuerst ausführen, dann UPDATE darunter)
SELECT
    id,
    course_id,
    location AS location_vorher,
    TRIM(SUBSTRING(location FROM LENGTH('Stöckackerstrasse 93, ') + 1)) AS location_nachher,
    canton
FROM course_events
WHERE location LIKE 'Stöckackerstrasse 93, %';

-- ============================================================
-- ERST NACH PRÜFUNG DES SELECT-ERGEBNISSES AUSFÜHREN:
-- ============================================================

-- UPDATE course_events
-- SET location = TRIM(SUBSTRING(location FROM LENGTH('Stöckackerstrasse 93, ') + 1))
-- WHERE location LIKE 'Stöckackerstrasse 93, %';
