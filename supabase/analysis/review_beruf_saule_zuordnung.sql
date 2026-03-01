-- Übersicht aller beruflichen Kurse mit Säulen-Zuordnung
-- Zum Prüfen ob die automatische Klassifizierung korrekt ist
SELECT
    c.id,
    c.title,
    LEFT(c.description, 120) AS beschreibung_kurz,
    c.beruf_saule AS saule,
    c.price,
    tp.level2_label_de AS bereich,
    tp.level3_label_de AS fachgebiet
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
JOIN v_taxonomy_paths tp ON tp.level3_id = cca.level3_id
WHERE c.beruf_saule IS NOT NULL
  AND (c.status = 'published' OR c.status IS NULL)
ORDER BY c.beruf_saule, c.title;
