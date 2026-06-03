-- ============================================================
-- BEREINIGUNG: courses.address / canton für spezifisch betroffene Kurse
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Aktualisiert courses.address und courses.canton nur für die
-- Kurse, bei denen courses.address noch den alten Wert "3018 Bern"
-- enthält, aber die Events in einem anderen Kanton stattfinden.
--
-- Ableitung: erster Termin (chronologisch) pro Kurs.
-- Nach Ausführung von cleanup_frilingue_stale_street_prefix.sql
-- wird hier der bereinigte Ort (ohne "Stöckackerstrasse 93, ") eingetragen.
--
-- Ausführen: Supabase SQL Editor
-- Erst nach cleanup_frilingue_stale_street_prefix.sql ausführen.
-- ============================================================

-- Vorschau: Was wird geändert?
WITH earliest AS (
    SELECT DISTINCT ON (course_id)
        course_id,
        TRIM(
            CASE
                WHEN location LIKE '%,%'
                    THEN SUBSTRING(location FROM POSITION(',' IN location) + 1)
                ELSE location
            END
        ) AS new_address,
        canton AS new_canton
    FROM course_events
    WHERE start_date IS NOT NULL
      AND canton NOT IN ('Online', 'Ausland')
    ORDER BY course_id, start_date ASC
)
SELECT
    c.id,
    c.title,
    c.address  AS address_vorher,
    e.new_address AS address_nachher,
    c.canton   AS canton_vorher,
    e.new_canton  AS canton_nachher
FROM courses c
JOIN earliest e ON e.course_id = c.id
WHERE c.id IN (519, 520, 528, 529, 530, 531, 532, 533, 534, 535, 536, 537, 538, 539)
  AND (c.address IS DISTINCT FROM e.new_address OR c.canton IS DISTINCT FROM e.new_canton);

-- ============================================================
-- ERST NACH PRÜFUNG DES SELECT-ERGEBNISSES AUSFÜHREN:
-- ============================================================

-- WITH earliest AS (
--     SELECT DISTINCT ON (course_id)
--         course_id,
--         TRIM(
--             CASE
--                 WHEN location LIKE '%,%'
--                     THEN SUBSTRING(location FROM POSITION(',' IN location) + 1)
--                 ELSE location
--             END
--         ) AS new_address,
--         canton AS new_canton
--     FROM course_events
--     WHERE start_date IS NOT NULL
--       AND canton NOT IN ('Online', 'Ausland')
--     ORDER BY course_id, start_date ASC
-- )
-- UPDATE courses c
-- SET
--     address = e.new_address,
--     canton  = e.new_canton
-- FROM earliest e
-- WHERE c.id = e.course_id
--   AND c.id IN (519, 520, 528, 529, 530, 531, 532, 533, 534, 535, 536, 537, 538, 539)
--   AND (c.address IS DISTINCT FROM e.new_address OR c.canton IS DISTINCT FROM e.new_canton);
