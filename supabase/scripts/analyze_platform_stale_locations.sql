-- ============================================================
-- ANALYSE: Platform-Kurse mit veralteten course_locations
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Zeigt Kurse vom Typ "platform" (Direktbuchung), die
-- course_events haben, aber noch alte course_locations besitzen,
-- die nicht zu den Termin-Orten passen.
--
-- Ausführen: Supabase SQL Editor > einmalige Analyse
-- Lesen-only — keine Daten werden verändert.
-- ============================================================

SELECT
    c.id                      AS kurs_id,
    c.title                   AS kurs_titel,
    c.booking_type,
    c.address                 AS kurs_address,
    c.canton                  AS kurs_kanton,
    cl.street                 AS loc_strasse,
    cl.city                   AS loc_ort,
    cl.canton                 AS loc_kanton,
    ce.location               AS event_ort,
    ce.canton                 AS event_kanton
FROM courses c
JOIN course_locations cl ON cl.course_id = c.id
JOIN course_events ce ON ce.course_id = c.id
WHERE c.booking_type = 'platform'
  AND ce.start_date IS NOT NULL
  AND cl.canton IS NOT NULL
  AND ce.canton IS NOT NULL
  AND cl.canton <> ce.canton
ORDER BY c.id, cl.canton, ce.canton;
