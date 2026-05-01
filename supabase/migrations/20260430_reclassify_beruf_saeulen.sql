-- Migration: Kursformat-Kategorisierung (4 neue Kursarten)
-- Ersetzt die alten 3 Säulen (diplome, fachkurse, quereinstieg)
-- durch 4 neue Kursformat-Kategorien (ausbildung, zertifikatslehrgang, fachkurs, workshop)
--
-- Identifiziert Profi-Kurse via Taxonomy-Join (gleiche Methode wie Original-Script).
-- Reihenfolge: spezifischste Kategorie zuerst, Catch-all zuletzt.
-- VORHER: preview_beruf_saeulen_reklassifizierung.sql ausführen und prüfen!

-- Hilfsfunktion: IDs aller Profi-Kurse via Taxonomy-Join
CREATE OR REPLACE FUNCTION _temp_prof_course_ids() RETURNS SETOF BIGINT AS $$
  SELECT DISTINCT c.id
  FROM courses c
  JOIN course_category_assignments cca ON cca.course_id = c.id
  JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
  JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
  JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
  WHERE l1.slug = 'professionell'
$$ LANGUAGE sql;

-- Schritt 1: Alle bestehenden Werte bei Profi-Kursen zurücksetzen
UPDATE courses
SET beruf_saeulen = NULL
WHERE id IN (SELECT * FROM _temp_prof_course_ids());

-- Schritt 2: 'ausbildung' — Eidg. Abschlüsse, HF, Fachausweis, EFZ/EBA
UPDATE courses
SET beruf_saeulen = ARRAY['ausbildung']
WHERE id IN (SELECT * FROM _temp_prof_course_ids())
  AND (
    title ILIKE '%diplom%'
    OR title ILIKE '%eidg.%'
    OR title ILIKE '%eidgenössisch%'
    OR title ILIKE '% HFP%'
    OR title ILIKE '%höhere fachprüfung%'
    OR title ILIKE '%berufsprüfung%'
    OR title ILIKE '% BP %'
    OR title ILIKE '%höhere fachschule%'
    OR title ILIKE '% HF %'
    OR title ILIKE '% HF)'
    OR title ILIKE '%fachausweis%'
    OR title ILIKE '%berufsmaturit%'
    OR title ILIKE '% EFZ%'
    OR title ILIKE '% EBA%'
    OR title ILIKE '%grundbildung%'
    OR title ILIKE '%bachelor%'
  );

-- Schritt 3: 'zertifikatslehrgang' — CAS, DAS, MAS, NDS, Zertifikat, Lehrgang
UPDATE courses
SET beruf_saeulen = ARRAY['zertifikatslehrgang']
WHERE id IN (SELECT * FROM _temp_prof_course_ids())
  AND beruf_saeulen IS NULL
  AND (
    title ILIKE 'CAS %'
    OR title ILIKE '% CAS %'
    OR title ILIKE '%CAS-%'
    OR title ILIKE 'DAS %'
    OR title ILIKE '% DAS %'
    OR title ILIKE 'MAS %'
    OR title ILIKE '% MAS %'
    OR title ILIKE 'NDS %'
    OR title ILIKE '% NDS %'
    OR title ILIKE '%nachdiplom%'
    OR title ILIKE '%zertifikat%'
    OR title ILIKE '%lehrgang%'
    OR title ILIKE '%zertifizierung%'
  );

-- Schritt 4: 'workshop' — Kurzzeitformate
UPDATE courses
SET beruf_saeulen = ARRAY['workshop']
WHERE id IN (SELECT * FROM _temp_prof_course_ids())
  AND beruf_saeulen IS NULL
  AND (
    title ILIKE '%workshop%'
    OR title ILIKE '%tagesseminar%'
    OR title ILIKE '%tageskurs%'
    OR title ILIKE '%seminar%'
    OR title ILIKE '%infoveranstaltung%'
  );

-- Schritt 5: 'fachkurs' — Catch-all für alle übrigen Profi-Kurse
UPDATE courses
SET beruf_saeulen = ARRAY['fachkurs']
WHERE id IN (SELECT * FROM _temp_prof_course_ids())
  AND beruf_saeulen IS NULL;

-- Hilfsfunktion aufräumen
DROP FUNCTION IF EXISTS _temp_prof_course_ids();
