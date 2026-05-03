-- DRY RUN: Vorschau der Klassifizierung für Privat & Hobby Kurse
-- Zweck: Prüfen, welche Kursart jedem Kurs zugeordnet würde — OHNE Änderungen
-- Eine Query — einzeln in Supabase SQL Editor ausführen
SELECT
    c.id,
    c.title,
    LEFT(c.description, 200) AS beschreibung_kurz,
    CASE
        -- retreat_intensiv: mehrtägig, Vertiefung, Klausur
        WHEN c.title       ILIKE '%retreat%'          THEN 'retreat_intensiv'
        WHEN c.description ILIKE '%retreat%'          THEN 'retreat_intensiv'
        WHEN c.title       ILIKE '%intensivkurs%'     THEN 'retreat_intensiv'
        WHEN c.description ILIKE '%intensivkurs%'     THEN 'retreat_intensiv'
        WHEN c.title       ILIKE '%wochenendseminar%' THEN 'retreat_intensiv'
        WHEN c.description ILIKE '%wochenendseminar%' THEN 'retreat_intensiv'
        WHEN c.title       ILIKE '%mehrtäg%'          THEN 'retreat_intensiv'
        WHEN c.description ILIKE '%mehrtäg%'          THEN 'retreat_intensiv'
        WHEN c.title       ILIKE '%klausur%'          THEN 'retreat_intensiv'
        WHEN c.description ILIKE '%klausur%'          THEN 'retreat_intensiv'

        -- wochenkurs: regelmässig, wöchentlich, Semester
        WHEN c.title       ILIKE '%wöchentlich%'      THEN 'wochenkurs'
        WHEN c.description ILIKE '%wöchentlich%'      THEN 'wochenkurs'
        WHEN c.title       ILIKE '%jede woche%'       THEN 'wochenkurs'
        WHEN c.description ILIKE '%jede woche%'       THEN 'wochenkurs'
        WHEN c.title       ILIKE '%semester%'         THEN 'wochenkurs'
        WHEN c.description ILIKE '%semester%'         THEN 'wochenkurs'
        WHEN c.title       ILIKE '%schuljahr%'        THEN 'wochenkurs'
        WHEN c.description ILIKE '%schuljahr%'        THEN 'wochenkurs'
        WHEN c.description ILIKE '%regelmässig%'      THEN 'wochenkurs'
        WHEN c.description ILIKE '%jeden montag%'     THEN 'wochenkurs'
        WHEN c.description ILIKE '%jeden dienstag%'   THEN 'wochenkurs'
        WHEN c.description ILIKE '%jeden mittwoch%'   THEN 'wochenkurs'
        WHEN c.description ILIKE '%jeden donnerstag%' THEN 'wochenkurs'
        WHEN c.description ILIKE '%jeden freitag%'    THEN 'wochenkurs'

        -- einfuehrungskurs: Einsteiger, Grundkurs, Anfänger
        WHEN c.title       ILIKE '%einführungskurs%'  THEN 'einfuehrungskurs'
        WHEN c.title       ILIKE '%einführung in%'    THEN 'einfuehrungskurs'
        WHEN c.title       ILIKE '%einsteiger%'       THEN 'einfuehrungskurs'
        WHEN c.description ILIKE '%einsteiger%'       THEN 'einfuehrungskurs'
        WHEN c.title       ILIKE '%anfänger%'         THEN 'einfuehrungskurs'
        WHEN c.description ILIKE '%anfänger%'         THEN 'einfuehrungskurs'
        WHEN c.title       ILIKE '%grundkurs%'        THEN 'einfuehrungskurs'
        WHEN c.description ILIKE '%grundkurs%'        THEN 'einfuehrungskurs'
        WHEN c.title       ILIKE '%basiskurs%'        THEN 'einfuehrungskurs'
        WHEN c.description ILIKE '%basiskurs%'        THEN 'einfuehrungskurs'
        WHEN c.title       ILIKE '%grundlagen%'       THEN 'einfuehrungskurs'
        WHEN c.description ILIKE '%für einsteiger%'   THEN 'einfuehrungskurs'
        WHEN c.description ILIKE '%ohne vorkenntnisse%' THEN 'einfuehrungskurs'
        WHEN c.description ILIKE '%kein vorwissen%'   THEN 'einfuehrungskurs'

        -- workshop_event: Catch-all
        ELSE 'workshop_event'
    END AS vorgeschlagene_kursart
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
WHERE l1.slug = 'privat'
  AND c.status = 'published'
ORDER BY vorgeschlagene_kursart, c.title;
