-- ============================================================
-- BEREINIGUNG: Strasse aus course_events.location entfernen
-- Erstellt: 2026-06-03 (hotfix/fix-course-event-location-display)
--
-- Für Termine (lead/flex), bei denen das location-Feld fälschlicherweise
-- eine Strasse enthält (z. B. "Stöckarkerstrasse 93, Braunwald"),
-- wird nur der Ort-Teil (nach dem letzten Komma) behalten.
--
-- Betrifft NUR lead + platform_flex Kurse.
-- Für Direktbuchungs-Kurse (platform) ist die Strasse korrekt und nötig.
--
-- WICHTIG: Bitte zuerst analyze_wrong_event_location_strings.sql
-- ausführen und die Ergebnisse prüfen.
--
-- Ausführen: Supabase SQL Editor
-- Wirkung: Überschreibt course_events.location — nicht destruktiv
--          (Ort-Teil bleibt erhalten, nur Strassen-Prefix wird entfernt)
-- ============================================================

UPDATE course_events ce
SET location = TRIM(SUBSTRING(ce.location FROM POSITION(',' IN ce.location) + 1))
WHERE ce.location LIKE '%,%'
  AND ce.canton NOT IN ('Online', 'Ausland')
  AND EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = ce.course_id
        AND c.booking_type IN ('lead', 'platform_flex')
  );
