-- Übersicht aller beruflichen Kurse mit Säulen-Zuordnung (Array-Format)
-- Zum Prüfen ob Kurse mehreren Säulen zugeordnet werden sollten
SELECT
    c.id,
    c.title,
    LEFT(c.description, 150) AS beschreibung_kurz,
    c.beruf_saeulen,
    c.price,
    tp.level2_label_de AS bereich,
    tp.level3_label_de AS fachgebiet
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
JOIN v_taxonomy_paths tp ON tp.level3_id = cca.level3_id
WHERE c.beruf_saeulen IS NOT NULL
  AND (c.status = 'published' OR c.status IS NULL)
ORDER BY c.title;
