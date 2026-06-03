-- ============================================================
-- ANALYSE: course_events mit gemischter "Strasse, Ort"-Adresse
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Zeigt alle Termine, bei denen das location-Feld eine Strasse
-- enthält, die wahrscheinlich fälschlich aus dem Profil-Hauptstandort
-- übernommen wurde (z. B. "Stöckarkerstrasse 93, Braunwald").
--
-- Erkennungsmerkmal: location enthält ein Komma UND
-- der Kanton in course_events stimmt nicht zum PLZ/Ort am Anfang
-- (keine perfekte Erkennung, aber hilfreich für manuelle Prüfung).
--
-- Ausführen: Supabase SQL Editor > nur lesen
-- ============================================================

SELECT
    c.id              AS kurs_id,
    c.title           AS kurs_titel,
    c.booking_type,
    ce.id             AS event_id,
    ce.start_date,
    ce.location       AS event_location,
    ce.canton         AS event_kanton,
    c.address         AS kurs_address,
    c.canton          AS kurs_kanton
FROM courses c
JOIN course_events ce ON ce.course_id = c.id
WHERE ce.location LIKE '%,%'        -- hat ein Komma → wahrscheinlich "Strasse, Ort"
  AND ce.canton IS NOT NULL
  AND ce.canton NOT IN ('Online', 'Ausland')
ORDER BY c.id, ce.start_date;
