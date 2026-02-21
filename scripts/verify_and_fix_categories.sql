-- ============================================
-- BZBS Kurse - Kategorien verifizieren und reparieren
-- Erstellt: 2026-02-21
-- ============================================

-- Schritt 1: Prüfen ob alle Level3/Level4 Kategorien existieren
-- SELECT id, slug, label_de FROM taxonomy_level3 WHERE id IN (55,56,57,58,59,60,61,62,63);
-- SELECT id, slug, label_de FROM taxonomy_level4 WHERE id IN (91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112);

-- Schritt 2: Prüfen ob course_category_assignments korrekt gefüllt sind
-- SELECT c.title, cca.level3_id, cca.level4_id, cca.is_primary
-- FROM courses c
-- JOIN course_category_assignments cca ON cca.course_id = c.id
-- WHERE c.user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f';

-- Schritt 3: Prüfen ob v_course_full_categories die Daten korrekt zurückgibt
-- SELECT * FROM v_course_full_categories
-- WHERE course_id IN (SELECT id FROM courses WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f');

-- Schritt 4: Falls View veraltet ist - Materialized View aktualisieren
REFRESH MATERIALIZED VIEW v_taxonomy_paths;

-- Schritt 5: Sicherstellen, dass die courses-Tabelle auch category_level3_id/level4_id hat
UPDATE courses c
SET
    category_level3_id = cca.level3_id,
    category_level4_id = cca.level4_id
FROM course_category_assignments cca
WHERE cca.course_id = c.id
AND cca.is_primary = true
AND c.user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f'
AND (c.category_level3_id IS NULL OR c.category_level3_id != cca.level3_id);

-- ============================================
-- VERIFICATION QUERIES (zum manuellen Ausführen)
-- ============================================

-- 1. Zeige alle BZBS Kurse mit ihren Kategorien aus der View:
SELECT
    cfc.course_id,
    cfc.title,
    cfc.level1_slug,
    cfc.level2_slug,
    cfc.level3_slug,
    cfc.level4_slug,
    cfc.is_primary
FROM v_course_full_categories cfc
WHERE cfc.course_id IN (
    SELECT id FROM courses WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f'
)
ORDER BY cfc.title;

-- 2. Zeige BZBS Kurse ohne Kategoriezuweisung:
SELECT c.id, c.title, c.category_level3_id, c.category_level4_id
FROM courses c
LEFT JOIN course_category_assignments cca ON cca.course_id = c.id
WHERE c.user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f'
AND cca.course_id IS NULL;
