-- ============================================================
-- BEREINIGUNG: Veraltete course_locations für Platform-Kurse
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Löscht alte course_locations für Direktbuchungs-Kurse (platform),
-- die konkrete Termine in course_events haben.
-- Diese Kurse haben keinen Standort-Modus — die Termine sind die
-- führende Quelle. Die Datensätze werden beim nächsten Speichern
-- durch den Fix automatisch korrekt neu gespiegelt.
--
-- WICHTIG: Bitte zuerst analyze_platform_stale_locations.sql
-- ausführen, um betroffene Kurse zu sichten.
--
-- Ausführen: Supabase SQL Editor
-- Wirkung: Löscht Zeilen in course_locations — reversibel durch
--          erneutes Speichern des jeweiligen Kurses im TeacherForm.
-- ============================================================

DELETE FROM course_locations
WHERE course_id IN (
    SELECT c.id
    FROM courses c
    WHERE c.booking_type = 'platform'
      AND EXISTS (
          SELECT 1 FROM course_events ce
          WHERE ce.course_id = c.id
            AND ce.start_date IS NOT NULL
      )
);
