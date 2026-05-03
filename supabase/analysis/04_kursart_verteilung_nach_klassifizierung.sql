-- Verteilung der Kursarten nach der Klassifizierung (Kontroll-Query)
-- Zweck: Nach dem Ausführen der Klassifizierungs-Migrations prüfen, wie viele Kurse je Kursart zugeordnet sind
-- Eine Query — einzeln in Supabase SQL Editor ausführen
SELECT
    'privat' AS segment,
    privat_kursart AS kursart,
    COUNT(*) AS anzahl
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
WHERE l1.slug = 'privat'
  AND c.status = 'published'
GROUP BY privat_kursart

UNION ALL

SELECT
    'kinder' AS segment,
    kinder_kursart AS kursart,
    COUNT(*) AS anzahl
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
JOIN taxonomy_level3 l3              ON l3.id = cca.level3_id
JOIN taxonomy_level2 l2              ON l2.id = l3.level2_id
JOIN taxonomy_level1 l1              ON l1.id = l2.level1_id
WHERE l1.slug = 'kinder'
  AND c.status = 'published'
GROUP BY kinder_kursart

ORDER BY segment, kursart NULLS FIRST;
