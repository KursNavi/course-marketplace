-- Klassifizierung: privat_kursart für alle Privat & Hobby Kurse setzen
-- VORHER: 02_preview_privat_kursart.sql ausführen und Ergebnis prüfen!
-- VORHER: 20260503_add_privat_kinder_kursart.sql ausführen!
-- Priorität: retreat_intensiv > wochenkurs > einfuehrungskurs > workshop_event (Catch-all)

CREATE OR REPLACE FUNCTION _temp_privat_course_ids() RETURNS SETOF BIGINT AS $$
  SELECT DISTINCT c.id
  FROM courses c
  JOIN course_category_assignments cca ON cca.course_id = c.id
  JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
  JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
  JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
  WHERE l1.slug = 'privat'
$$ LANGUAGE sql;

-- Schritt 0: Alle Werte zurücksetzen
UPDATE courses SET privat_kursart = NULL
WHERE id IN (SELECT * FROM _temp_privat_course_ids());

-- Schritt 1: retreat_intensiv — mehrtägig, Intensiv, Klausur
UPDATE courses SET privat_kursart = 'retreat_intensiv'
WHERE id IN (SELECT * FROM _temp_privat_course_ids())
  AND privat_kursart IS NULL
  AND (
    title       ILIKE '%retreat%'          OR description ILIKE '%retreat%'
    OR title    ILIKE '%intensivkurs%'     OR description ILIKE '%intensivkurs%'
    OR title    ILIKE '%wochenendseminar%' OR description ILIKE '%wochenendseminar%'
    OR title    ILIKE '%mehrtäg%'          OR description ILIKE '%mehrtäg%'
    OR title    ILIKE '%klausur%'          OR description ILIKE '%klausur%'
    OR (title   ILIKE '%wochenende%' AND (title ILIKE '%kurs%' OR title ILIKE '%workshop%'))
  );

-- Schritt 2: wochenkurs — regelmässig, Semester, wöchentlich
UPDATE courses SET privat_kursart = 'wochenkurs'
WHERE id IN (SELECT * FROM _temp_privat_course_ids())
  AND privat_kursart IS NULL
  AND (
    title       ILIKE '%wöchentlich%'      OR description ILIKE '%wöchentlich%'
    OR title    ILIKE '%jede woche%'       OR description ILIKE '%jede woche%'
    OR title    ILIKE '%semester%'         OR description ILIKE '%semester%'
    OR title    ILIKE '%schuljahr%'        OR description ILIKE '%schuljahr%'
    OR description ILIKE '%regelmässig%'
    OR description ILIKE '%jeden montag%'
    OR description ILIKE '%jeden dienstag%'
    OR description ILIKE '%jeden mittwoch%'
    OR description ILIKE '%jeden donnerstag%'
    OR description ILIKE '%jeden freitag%'
    OR title    ILIKE '%laufender kurs%'   OR description ILIKE '%laufender kurs%'
  );

-- Schritt 3: einfuehrungskurs — Einsteiger, Grundkurs, Anfänger
UPDATE courses SET privat_kursart = 'einfuehrungskurs'
WHERE id IN (SELECT * FROM _temp_privat_course_ids())
  AND privat_kursart IS NULL
  AND (
    title       ILIKE '%einführungskurs%'      OR description ILIKE '%einführungskurs%'
    OR title    ILIKE '%einführung in%'
    OR title    ILIKE '%einsteiger%'            OR description ILIKE '%einsteiger%'
    OR title    ILIKE '%anfänger%'              OR description ILIKE '%anfänger%'
    OR title    ILIKE '%grundkurs%'             OR description ILIKE '%grundkurs%'
    OR title    ILIKE '%basiskurs%'             OR description ILIKE '%basiskurs%'
    OR title    ILIKE '%grundlagen%'            OR description ILIKE '%grundlagen%'
    OR description ILIKE '%für einsteiger%'
    OR description ILIKE '%ohne vorkenntnisse%'
    OR description ILIKE '%kein vorwissen%'
    OR description ILIKE '%kein vorwissen nötig%'
  );

-- Schritt 4: workshop_event — Catch-all für alle verbleibenden Privat-Kurse
UPDATE courses SET privat_kursart = 'workshop_event'
WHERE id IN (SELECT * FROM _temp_privat_course_ids())
  AND privat_kursart IS NULL;

DROP FUNCTION IF EXISTS _temp_privat_course_ids();
