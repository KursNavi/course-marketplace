-- Migration: Kursformat-Kategorisierung (4 neue Kursarten)
-- Ersetzt die alten 3 Säulen (diplome, fachkurse, quereinstieg)
-- durch 4 neue Kursformat-Kategorien (ausbildung, zertifikatslehrgang, fachkurs, workshop)
--
-- Klassifizierung basiert auf Kurs-Titeln (Keyword-basiert).
-- Reihenfolge: spezifischste Kategorie zuerst, Catch-all zuletzt.

-- Schritt 1: Alle bestehenden Werte zurücksetzen
UPDATE courses
SET beruf_saeulen = NULL
WHERE beruf_saeulen IS NOT NULL;

-- Schritt 2: 'ausbildung' — Diplome, eidg. anerkannte Abschlüsse, HF, MAS, EFZ/EBA
UPDATE courses
SET beruf_saeulen = ARRAY['ausbildung']
WHERE category_type IN ('professionell', 'beruflich')
  AND (
    title ILIKE '%diplom%'
    OR title ILIKE '%ausbildung%'
    OR title ILIKE '% hf %'
    OR title ILIKE '%hfp%'
    OR title ILIKE '% mas%'
    OR title ILIKE '% das %'
    OR title ILIKE '%fachausweis%'
    OR title ILIKE '%efz%'
    OR title ILIKE '%eba%'
    OR title ILIKE '%eidg%'
    OR title ILIKE '%berufsmaturit%'
  );

-- Schritt 3: 'zertifikatslehrgang' — CAS, Zertifikat, Lehrgang (nach ausbildung)
UPDATE courses
SET beruf_saeulen = ARRAY['zertifikatslehrgang']
WHERE category_type IN ('professionell', 'beruflich')
  AND beruf_saeulen IS NULL
  AND (
    title ILIKE '% cas %'
    OR title ILIKE '%cas-%'
    OR title ILIKE '%zertifikat%'
    OR title ILIKE '%lehrgang%'
    OR title ILIKE '%zertifizierung%'
  );

-- Schritt 4: 'workshop' — Kurzzeitformate
UPDATE courses
SET beruf_saeulen = ARRAY['workshop']
WHERE category_type IN ('professionell', 'beruflich')
  AND beruf_saeulen IS NULL
  AND (
    title ILIKE '%workshop%'
    OR title ILIKE '%tagesseminar%'
    OR title ILIKE '%tageskurs%'
    OR title ILIKE '%seminar%'
    OR title ILIKE '%infoveranstaltung%'
  );

-- Schritt 5: 'fachkurs' — Catch-all für alle übrigen beruflichen Kurse
UPDATE courses
SET beruf_saeulen = ARRAY['fachkurs']
WHERE category_type IN ('professionell', 'beruflich')
  AND beruf_saeulen IS NULL;

-- Kontroll-Query (nicht ausführen, nur zur Dokumentation):
-- SELECT beruf_saeulen, count(*) FROM courses
-- WHERE category_type IN ('professionell', 'beruflich')
-- GROUP BY beruf_saeulen ORDER BY count(*) DESC;
