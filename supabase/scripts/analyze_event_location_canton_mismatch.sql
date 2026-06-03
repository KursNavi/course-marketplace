-- ============================================================
-- ANALYSE: Kurse mit gemischten Ortsangaben (Event vs. Standort)
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Zeigt Kurse, bei denen die course_locations einen anderen
-- Kanton haben als die zugehörigen course_events.
-- Betrifft alle Buchungsarten (lead, platform_flex, platform).
--
-- Ausführen: Supabase SQL Editor > einmalige Analyse
-- Lesen-only — keine Daten werden verändert.
-- ============================================================

SELECT
    c.id                                AS kurs_id,
    c.title                             AS kurs_titel,
    c.booking_type,
    array_agg(DISTINCT cl.canton)       AS standort_kantone,
    array_agg(DISTINCT ce.canton)       AS termin_kantone,
    array_agg(DISTINCT cl.street)       AS standort_strassen
FROM courses c
JOIN course_locations cl ON cl.course_id = c.id
JOIN course_events ce ON ce.course_id = c.id
WHERE ce.start_date IS NOT NULL
  AND cl.location_type = 'presence'
  AND ce.canton IS NOT NULL
  AND cl.canton IS NOT NULL
GROUP BY c.id, c.title, c.booking_type
HAVING array_agg(DISTINCT cl.canton ORDER BY cl.canton)
    <> array_agg(DISTINCT ce.canton ORDER BY ce.canton)
ORDER BY c.id;
