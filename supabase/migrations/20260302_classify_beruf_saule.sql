-- Klassifizierung bestehender beruflicher Kurse in 3 Säulen (Array-Format)
-- Reihenfolge: 1) Diplome, 2) Quereinstieg, 3) Fachkurse (Catch-All)
-- Nur Kurse mit professioneller Level1-Zuordnung werden klassifiziert
-- Hinweis: beruf_saeulen ist TEXT[] — Mehrfachzuordnung möglich

-- Hilfsfunktion: professionelle Kurs-IDs
-- (wird am Ende wieder entfernt)
CREATE OR REPLACE FUNCTION _temp_prof_course_ids() RETURNS SETOF BIGINT AS $$
  SELECT DISTINCT c.id
  FROM courses c
  JOIN course_category_assignments cca ON cca.course_id = c.id
  JOIN taxonomy_level3 l3 ON l3.id = cca.level3_id
  JOIN taxonomy_level2 l2 ON l2.id = l3.level2_id
  JOIN taxonomy_level1 l1 ON l1.id = l2.level1_id
  WHERE l1.slug = 'professionell'
$$ LANGUAGE sql;

-- 1. DIPLOME & HÖHERE ABSCHLÜSSE
UPDATE courses SET beruf_saeulen = array_append(COALESCE(beruf_saeulen, '{}'), 'diplome')
WHERE id IN (SELECT * FROM _temp_prof_course_ids())
  AND (beruf_saeulen IS NULL OR NOT 'diplome' = ANY(beruf_saeulen))
  AND (
       title ILIKE '%diplom%'
    OR title ILIKE '%eidg.%'
    OR title ILIKE '%eidgenössisch%'
    OR title ILIKE '% HFP%'
    OR title ILIKE '%höhere fachprüfung%'
    OR title ILIKE '%berufsprüfung%'
    OR title ILIKE '% BP %'
    OR title ILIKE 'CAS %'
    OR title ILIKE '% CAS %'
    OR title ILIKE '%CAS-%'
    OR title ILIKE 'DAS %'
    OR title ILIKE '% DAS %'
    OR title ILIKE '%DAS-%'
    OR title ILIKE 'MAS %'
    OR title ILIKE '% MAS %'
    OR title ILIKE '%MAS-%'
    OR title ILIKE '%höhere fachschule%'
    OR title ILIKE '% HF %'
    OR title ILIKE '% HF)'
    OR title ILIKE 'NDS %'
    OR title ILIKE '% NDS %'
    OR title ILIKE '%NDS-%'
    OR title ILIKE '%nachdiplom%'
    OR title ILIKE '%eidg. Fachausweis%'
    OR title ILIKE '%eidg.Fachausweis%'
    OR title ILIKE '%eidgenössisch% Fachausweis%'
    OR title ILIKE '%berufsmaturität%'
    OR title ILIKE '%bachelor%'
    OR title ILIKE '%master %'
    OR title ILIKE '%master-%'
  );

-- 2. QUEREINSTIEG & BERUFSBILDUNG
UPDATE courses SET beruf_saeulen = array_append(COALESCE(beruf_saeulen, '{}'), 'quereinstieg')
WHERE id IN (SELECT * FROM _temp_prof_course_ids())
  AND (beruf_saeulen IS NULL OR NOT 'quereinstieg' = ANY(beruf_saeulen))
  AND (
       title ILIKE '%quereinstieg%'
    OR title ILIKE '%umschulung%'
    OR title ILIKE '% EFZ%'
    OR title ILIKE '% EBA%'
    OR title ILIKE '%berufsausbildung%'
    OR title ILIKE '%grundbildung%'
    OR title ILIKE '%bootcamp%'
    OR title ILIKE '%berufswechsel%'
    OR title ILIKE '%karrierewechsel%'
    OR title ILIKE '%neuorientierung%'
    OR title ILIKE '%nachholbildung%'
    OR title ILIKE '%lehrabschluss%'
  );

-- 3. FACHKURSE & PRAXIS-ZERTIFIKATE (Catch-All)
-- Nur für Kurse die noch KEINE Säule haben
UPDATE courses SET beruf_saeulen = ARRAY['fachkurse']
WHERE id IN (SELECT * FROM _temp_prof_course_ids())
  AND beruf_saeulen IS NULL;

-- Hilfsfunktion aufräumen
DROP FUNCTION IF EXISTS _temp_prof_course_ids();
