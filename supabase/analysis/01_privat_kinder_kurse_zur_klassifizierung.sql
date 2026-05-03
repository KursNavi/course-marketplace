-- Alle Privat- und Kinder-Kurse mit Titel + Beschreibung zur Klassifizierung
-- Zweck: Vor der Klassifizierung prüfen, welche Kurse vorhanden sind
-- Eine Query — einzeln in Supabase SQL Editor ausführen
SELECT
    c.id,
    c.title,
    l1.slug           AS segment,
    l2.label_de       AS bereich,
    LEFT(c.description, 250) AS beschreibung_kurz,
    c.privat_kursart,
    c.kinder_kursart,
    c.status
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
WHERE l1.slug IN ('privat', 'kinder')
  AND c.status = 'published'
ORDER BY l1.slug, l2.label_de, c.title;
