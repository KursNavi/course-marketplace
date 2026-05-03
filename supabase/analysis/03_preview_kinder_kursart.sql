-- DRY RUN: Vorschau der Klassifizierung für Kinder & Jugend Kurse
-- Zweck: Prüfen, welche Kursart jedem Kurs zugeordnet würde — OHNE Änderungen
-- Eine Query — einzeln in Supabase SQL Editor ausführen
SELECT
    c.id,
    c.title,
    LEFT(c.description, 200) AS beschreibung_kurz,
    CASE
        -- kindergeburtstag: höchste Priorität
        WHEN c.title       ILIKE '%geburtstag%'         THEN 'kindergeburtstag'
        WHEN c.description ILIKE '%geburtstag%'         THEN 'kindergeburtstag'
        WHEN c.title       ILIKE '%birthday%'           THEN 'kindergeburtstag'
        WHEN c.description ILIKE '%birthday%'           THEN 'kindergeburtstag'
        WHEN c.title       ILIKE '%geburtstagsfeier%'   THEN 'kindergeburtstag'
        WHEN c.description ILIKE '%geburtstagsfeier%'   THEN 'kindergeburtstag'

        -- feriencamp: Ganztagesbetreuung in Ferien
        WHEN c.title       ILIKE '%feriencamp%'         THEN 'feriencamp'
        WHEN c.description ILIKE '%feriencamp%'         THEN 'feriencamp'
        WHEN c.title       ILIKE '%tagescamp%'          THEN 'feriencamp'
        WHEN c.description ILIKE '%tagescamp%'          THEN 'feriencamp'
        WHEN c.title       ILIKE '%ganztages%'          THEN 'feriencamp'
        WHEN c.description ILIKE '%ganztages%'          THEN 'feriencamp'
        WHEN c.title       ILIKE '%ferienbetreuung%'    THEN 'feriencamp'
        WHEN c.description ILIKE '%ferienbetreuung%'    THEN 'feriencamp'
        WHEN (c.title       ILIKE '%ferien%' OR c.description ILIKE '%ferien%')
         AND (c.title       ILIKE '%betreuung%' OR c.description ILIKE '%betreuung%')
                                                        THEN 'feriencamp'
        WHEN c.title       ILIKE '%tageslager%'         THEN 'feriencamp'
        WHEN c.description ILIKE '%tageslager%'         THEN 'feriencamp'

        -- ferienkurs: Aktivität in Ferien, kein Ganztag
        WHEN c.title       ILIKE '%ferienkurs%'         THEN 'ferienkurs'
        WHEN c.description ILIKE '%ferienkurs%'         THEN 'ferienkurs'
        WHEN c.title       ILIKE '%ferienprogramm%'     THEN 'ferienkurs'
        WHEN c.description ILIKE '%ferienprogramm%'     THEN 'ferienkurs'
        WHEN c.title       ILIKE '%sommerferien%'       THEN 'ferienkurs'
        WHEN c.description ILIKE '%sommerferien%'       THEN 'ferienkurs'
        WHEN c.title       ILIKE '%osterferien%'        THEN 'ferienkurs'
        WHEN c.description ILIKE '%osterferien%'        THEN 'ferienkurs'
        WHEN c.title       ILIKE '%herbstferien%'       THEN 'ferienkurs'
        WHEN c.description ILIKE '%herbstferien%'       THEN 'ferienkurs'
        WHEN c.title       ILIKE '%winterferien%'       THEN 'ferienkurs'
        WHEN c.description ILIKE '%winterferien%'       THEN 'ferienkurs'
        WHEN c.title       ILIKE '%frühlingsferien%'    THEN 'ferienkurs'
        WHEN c.description ILIKE '%frühlingsferien%'    THEN 'ferienkurs'
        WHEN c.title       ILIKE '% ferien %'           THEN 'ferienkurs'

        -- freizeitkurs: regelmässig übers Schuljahr
        WHEN c.description ILIKE '%wöchentlich%'            THEN 'freizeitkurs'
        WHEN c.description ILIKE '%regelmässig%'            THEN 'freizeitkurs'
        WHEN c.title       ILIKE '%semester%'               THEN 'freizeitkurs'
        WHEN c.description ILIKE '%semester%'               THEN 'freizeitkurs'
        WHEN c.title       ILIKE '%schuljahr%'              THEN 'freizeitkurs'
        WHEN c.description ILIKE '%schuljahr%'              THEN 'freizeitkurs'
        WHEN c.description ILIKE '%nach der schule%'        THEN 'freizeitkurs'
        WHEN c.description ILIKE '%nach schule%'            THEN 'freizeitkurs'
        WHEN c.description ILIKE '%nachmittag%'             THEN 'freizeitkurs'
        WHEN c.description ILIKE '%jeden %'                 THEN 'freizeitkurs'
        WHEN c.title       ILIKE '%schwimmkurs%'            THEN 'freizeitkurs'
        WHEN c.description ILIKE '%schwimmkurs%'            THEN 'freizeitkurs'
        WHEN c.title       ILIKE '%babyschwimmen%'          THEN 'freizeitkurs'
        WHEN c.description ILIKE '%babyschwimmen%'          THEN 'freizeitkurs'
        WHEN c.title       ILIKE '%kinderschwimmen%'        THEN 'freizeitkurs'
        WHEN c.description ILIKE '%kinderschwimmen%'        THEN 'freizeitkurs'
        WHEN c.title       ILIKE '%sprachkurs%'             THEN 'freizeitkurs'
        WHEN c.description ILIKE '%sprachkurs%'             THEN 'freizeitkurs'
        WHEN c.description ILIKE '%kursreihe%'              THEN 'freizeitkurs'
        WHEN c.description ILIKE '%aufeinander aufbauend%'  THEN 'freizeitkurs'

        -- events_workshops: Catch-all
        ELSE 'events_workshops'
    END AS vorgeschlagene_kursart
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
WHERE l1.slug = 'kinder'
  AND c.status = 'published'
ORDER BY vorgeschlagene_kursart, c.title;
