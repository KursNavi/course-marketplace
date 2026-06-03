-- ============================================================
-- BEREINIGUNG: courses.address und courses.canton aus Events ableiten
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Kurse, bei denen course_events existieren, aber courses.address
-- noch einen alten Wert hat (z. B. "3018 Bern" statt "Braunwald").
-- Aktualisiert address und canton vom frühesten Termin.
--
-- WICHTIG: Führe zuerst cleanup_event_location_strip_street.sql aus,
-- damit die Events-Orte bereits korrekt (ohne Strassen-Prefix) sind.
--
-- Ausführen: Supabase SQL Editor
-- Wirkung: Überschreibt courses.address und courses.canton
-- ============================================================

WITH earliest_event AS (
    SELECT DISTINCT ON (course_id)
        course_id,
        TRIM(
            CASE
                WHEN location LIKE '%,%'
                    THEN SUBSTRING(location FROM POSITION(',' IN location) + 1)
                ELSE location
            END
        ) AS city,
        canton
    FROM course_events
    WHERE start_date IS NOT NULL
      AND canton NOT IN ('Online', 'Ausland')
    ORDER BY course_id, start_date ASC
)
UPDATE courses c
SET
    address = ee.city,
    canton  = ee.canton
FROM earliest_event ee
WHERE c.id = ee.course_id
  AND (c.address IS DISTINCT FROM ee.city OR c.canton IS DISTINCT FROM ee.canton)
  -- Only update courses where address/canton differ from what the events say
  -- (i.e. the courses-table fields are stale)
  AND EXISTS (
      SELECT 1 FROM course_events ce
      WHERE ce.course_id = c.id
        AND ce.start_date IS NOT NULL
  );
