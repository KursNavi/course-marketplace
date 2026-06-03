-- ============================================================
-- ANALYSE: Veröffentlichte Kurse mit ausschliesslich vergangenen Terminen
-- Erstellt: 2026-06-03 (bugfix/hide-past-course-events)
--
-- Zeigt alle publizierten Kurse, bei denen ALLE Termine
-- bereits in der Vergangenheit liegen:
--   - end_date vorhanden und < heute, ODER
--   - kein end_date und start_date < heute
--
-- Diese Kurse zeigen öffentlich noch alte Termine → der Bugfix
-- blendet sie auf der Detailseite aus (kein Datenverlust).
--
-- Ausführen: Supabase SQL Editor (nur lesen, keine Änderungen)
-- ============================================================

SELECT
    c.id,
    c.title,
    c.booking_type,
    c.status,
    COUNT(ce.id)                                         AS total_events,
    MAX(COALESCE(ce.end_date, ce.start_date))            AS latest_event_date,
    MIN(ce.start_date)                                   AS earliest_start_date
FROM courses c
JOIN course_events ce ON ce.course_id = c.id
WHERE c.status = 'published'
  AND ce.cancelled_at IS NULL
GROUP BY c.id, c.title, c.booking_type, c.status
HAVING
    -- Alle Termine sind vergangen
    MAX(
        CASE
            WHEN ce.end_date IS NOT NULL THEN ce.end_date
            ELSE ce.start_date
        END
    ) < CURRENT_DATE
ORDER BY latest_event_date DESC;
