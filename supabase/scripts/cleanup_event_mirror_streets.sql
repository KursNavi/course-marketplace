-- ============================================================
-- BEREINIGUNG: Falsche Strassen in gespiegelten Termin-Standorten
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Setzt street = NULL für alle course_locations, die als Spiegel
-- von course_events angelegt wurden (Kurs hat Termine).
-- In Events-Modus sind course_locations nur ein Kanton-Index
-- für Filter — die Strasse gehört nicht rein.
--
-- Verhindert die Mischadresse "Stöckackerstrasse 93 Braunwald".
--
-- WICHTIG: Bitte zuerst analyze_event_location_canton_mismatch.sql
-- ausführen, um betroffene Kurse zu sichten.
--
-- Ausführen: Supabase SQL Editor
-- Wirkung: Überschreibt street mit NULL in course_locations —
--          kein Datenverlust (Strasse gehört zu course_events.location).
-- ============================================================

UPDATE course_locations
SET street = NULL
WHERE street IS NOT NULL
  AND location_type = 'presence'
  AND course_id IN (
      SELECT ce.course_id
      FROM course_events ce
      WHERE ce.start_date IS NOT NULL
      GROUP BY ce.course_id
  );
