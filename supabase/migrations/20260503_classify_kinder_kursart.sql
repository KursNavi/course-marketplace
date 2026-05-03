-- Klassifizierung: kinder_kursart für alle Kinder & Jugend Kurse setzen
-- VORHER: 03_preview_kinder_kursart.sql ausführen und Ergebnis prüfen!
-- VORHER: 20260503_add_privat_kinder_kursart.sql ausführen!
-- Priorität: kindergeburtstag > feriencamp > ferienkurs > freizeitkurs > events_workshops (Catch-all)

CREATE OR REPLACE FUNCTION _temp_kinder_course_ids() RETURNS SETOF BIGINT AS $$
  SELECT DISTINCT c.id
  FROM courses c
  JOIN course_category_assignments cca ON cca.course_id = c.id
  JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
  JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
  JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
  WHERE l1.slug = 'kinder'
$$ LANGUAGE sql;

-- Schritt 0: Alle Werte zurücksetzen
UPDATE courses SET kinder_kursart = NULL
WHERE id IN (SELECT * FROM _temp_kinder_course_ids());

-- Schritt 1: kindergeburtstag — höchste Priorität
UPDATE courses SET kinder_kursart = 'kindergeburtstag'
WHERE id IN (SELECT * FROM _temp_kinder_course_ids())
  AND kinder_kursart IS NULL
  AND (
    title       ILIKE '%geburtstag%'       OR description ILIKE '%geburtstag%'
    OR title    ILIKE '%birthday%'         OR description ILIKE '%birthday%'
    OR title    ILIKE '%geburtstagsfeier%' OR description ILIKE '%geburtstagsfeier%'
  );

-- Schritt 2: feriencamp — Ganztagesbetreuung in Ferien
UPDATE courses SET kinder_kursart = 'feriencamp'
WHERE id IN (SELECT * FROM _temp_kinder_course_ids())
  AND kinder_kursart IS NULL
  AND (
    title       ILIKE '%feriencamp%'       OR description ILIKE '%feriencamp%'
    OR title    ILIKE '%tagescamp%'        OR description ILIKE '%tagescamp%'
    OR title    ILIKE '%ganztages%'        OR description ILIKE '%ganztages%'
    OR title    ILIKE '%ferienbetreuung%'  OR description ILIKE '%ferienbetreuung%'
    OR title    ILIKE '%tageslager%'       OR description ILIKE '%tageslager%'
    OR (
      (title ILIKE '%ferien%' OR description ILIKE '%ferien%')
      AND (title ILIKE '%betreuung%' OR description ILIKE '%betreuung%')
    )
  );

-- Schritt 3: ferienkurs — Aktivität in Ferien ohne Ganztag
UPDATE courses SET kinder_kursart = 'ferienkurs'
WHERE id IN (SELECT * FROM _temp_kinder_course_ids())
  AND kinder_kursart IS NULL
  AND (
    title       ILIKE '%ferienkurs%'       OR description ILIKE '%ferienkurs%'
    OR title    ILIKE '%ferienprogramm%'   OR description ILIKE '%ferienprogramm%'
    OR title    ILIKE '%sommerferien%'     OR description ILIKE '%sommerferien%'
    OR title    ILIKE '%osterferien%'      OR description ILIKE '%osterferien%'
    OR title    ILIKE '%herbstferien%'     OR description ILIKE '%herbstferien%'
    OR title    ILIKE '%winterferien%'     OR description ILIKE '%winterferien%'
    OR title    ILIKE '%frühlingsferien%'  OR description ILIKE '%frühlingsferien%'
    OR title    ILIKE '%pfingstferien%'    OR description ILIKE '%pfingstferien%'
    OR title    ILIKE '% ferien %'
    OR description ILIKE '%in den ferien%'
  );

-- Schritt 4: freizeitkurs — regelmässig übers Schuljahr
UPDATE courses SET kinder_kursart = 'freizeitkurs'
WHERE id IN (SELECT * FROM _temp_kinder_course_ids())
  AND kinder_kursart IS NULL
  AND (
    description ILIKE '%wöchentlich%'
    OR description ILIKE '%regelmässig%'
    OR title    ILIKE '%semester%'         OR description ILIKE '%semester%'
    OR title    ILIKE '%schuljahr%'        OR description ILIKE '%schuljahr%'
    OR description ILIKE '%nach der schule%'
    OR description ILIKE '%nach schule%'
    OR description ILIKE '%nachmittag%'
    OR description ILIKE '%jeden %'
    OR title       ILIKE '%schwimmkurs%'      OR description ILIKE '%schwimmkurs%'
    OR title       ILIKE '%babyschwimmen%'    OR description ILIKE '%babyschwimmen%'
    OR title       ILIKE '%kinderschwimmen%'  OR description ILIKE '%kinderschwimmen%'
    OR title       ILIKE '%sprachkurs%'       OR description ILIKE '%sprachkurs%'
    OR description ILIKE '%kursreihe%'
    OR description ILIKE '%aufeinander aufbauend%'
  );

-- Schritt 5: events_workshops — Catch-all für alle verbleibenden Kinder-Kurse
UPDATE courses SET kinder_kursart = 'events_workshops'
WHERE id IN (SELECT * FROM _temp_kinder_course_ids())
  AND kinder_kursart IS NULL;

DROP FUNCTION IF EXISTS _temp_kinder_course_ids();
