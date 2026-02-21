-- ============================================
-- Neue Kategorien für BZBS-Kurse
-- Ausführen VOR insert_bzbs_courses.sql
-- Erstellt: 2026-02-21
-- ============================================

-- ============================================
-- NEUE LEVEL 2 KATEGORIEN
-- ============================================

-- Technik & Bau (unter Professionell, level1_id = 1)
INSERT INTO taxonomy_level2 (id, level1_id, slug, label_de, sort_order, is_active) VALUES
(21, 1, 'technik_bau', 'Technik & Bau', 6, true);

-- Landwirtschaft (unter Professionell, level1_id = 1)
INSERT INTO taxonomy_level2 (id, level1_id, slug, label_de, sort_order, is_active) VALUES
(22, 1, 'landwirtschaft', 'Landwirtschaft', 7, true);

-- Update sequence
SELECT setval('taxonomy_level2_id_seq', 22, true);

-- ============================================
-- NEUE LEVEL 3 KATEGORIEN
-- ============================================

-- Unter Wirtschaft & Management (level2_id = 1)
-- Administration & Handel
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(55, 1, 'administration', 'Administration & Handel', 4, true);

-- Unter Finanzen & Recht (level2_id = 2)
-- Rechnungswesen & Buchhaltung
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(56, 2, 'rechnungswesen', 'Rechnungswesen & Buchhaltung', 5, true);

-- Unter Bildung & Soziales (level2_id = 3)
-- HR & Personalwesen
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(57, 3, 'hr_personal', 'HR & Personalwesen', 3, true);

-- Unter IT & Digitales (level2_id = 4)
-- Wirtschaftsinformatik
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(58, 4, 'wirtschaftsinformatik', 'Wirtschaftsinformatik', 3, true);

-- Unter Technik & Bau (level2_id = 21)
-- Bauwesen
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(59, 21, 'bauwesen', 'Bauwesen', 1, true);

-- Produktion & Logistik
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(60, 21, 'produktion_logistik', 'Produktion & Logistik', 2, true);

-- Unter Landwirtschaft (level2_id = 22)
-- Agrarwirtschaft
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(61, 22, 'agrarwirtschaft', 'Agrarwirtschaft', 1, true);

-- Hauswirtschaft
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(62, 22, 'hauswirtschaft', 'Hauswirtschaft', 2, true);

-- Naturkunde & Kräuter
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
(63, 22, 'naturkunde', 'Naturkunde & Kräuter', 3, true);

-- Update sequence
SELECT setval('taxonomy_level3_id_seq', 63, true);

-- ============================================
-- NEUE LEVEL 4 KATEGORIEN (Fokus)
-- ============================================

-- Administration & Handel (level3_id = 55)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(91, 55, 'kaufmaennisch', 'Kaufmännische Grundbildung', 1, true),
(92, 55, 'handelsdiplom', 'Handelsdiplom', 2, true);

-- Rechnungswesen & Buchhaltung (level3_id = 56)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(93, 56, 'finanzbuchhaltung', 'Finanzbuchhaltung', 1, true),
(94, 56, 'sachbearbeitung_rw', 'Sachbearbeitung', 2, true);

-- HR & Personalwesen (level3_id = 57)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(95, 57, 'hr_fachausweis', 'HR Fachausweis', 1, true),
(96, 57, 'hr_sachbearbeitung', 'Sachbearbeitung Personal', 2, true);

-- Wirtschaftsinformatik (level3_id = 58)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(97, 58, 'it_business', 'IT-Business Engineering', 1, true),
(98, 58, 'digitale_transformation', 'Digitale Transformation', 2, true);

-- Bauwesen (level3_id = 59)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(99, 59, 'holzbau', 'Holzbau', 1, true),
(100, 59, 'hochbau', 'Hochbau', 2, true),
(101, 59, 'tiefbau', 'Tiefbau', 3, true);

-- Produktion & Logistik (level3_id = 60)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(102, 60, 'prozessoptimierung', 'Prozessoptimierung', 1, true),
(103, 60, 'qualitaetsmanagement', 'Qualitätsmanagement', 2, true),
(104, 60, 'supply_chain', 'Supply Chain', 3, true);

-- Agrarwirtschaft (level3_id = 61)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(105, 61, 'betriebsfuehrung', 'Betriebsführung', 1, true),
(106, 61, 'pflanzenbau', 'Pflanzenbau', 2, true),
(107, 61, 'tierhaltung', 'Tierhaltung', 3, true),
(108, 61, 'direktzahlungen', 'Direktzahlungsberechtigung', 4, true);

-- Hauswirtschaft (level3_id = 62)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(109, 62, 'baeuerliche_hauswirtschaft', 'Bäuerliche Hauswirtschaft', 1, true),
(110, 62, 'ernaehrung_haushalt', 'Ernährung & Haushalt', 2, true);

-- Naturkunde & Kräuter (level3_id = 63)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
(111, 63, 'heilpflanzen', 'Heilpflanzen & Kräuter', 1, true),
(112, 63, 'naturpaedagogik', 'Naturpädagogik', 2, true);

-- Update sequence
SELECT setval('taxonomy_level4_id_seq', 112, true);

-- ============================================
-- REFRESH MATERIALIZED VIEW
-- ============================================
REFRESH MATERIALIZED VIEW v_taxonomy_paths;

-- ============================================
-- VERIFICATION
-- ============================================
-- Nach Ausführung prüfen:
-- SELECT * FROM taxonomy_level2 WHERE id >= 21;
-- SELECT * FROM taxonomy_level3 WHERE id >= 55;
-- SELECT * FROM taxonomy_level4 WHERE id >= 91;
