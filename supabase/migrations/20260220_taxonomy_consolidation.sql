-- ============================================
-- Migration: Taxonomy System Consolidation
-- ============================================
-- Goal: Simplify from 8 tables to 4 with clear naming
-- - taxonomy_level1 (was: taxonomy_types + taxonomy_types_v2)
-- - taxonomy_level2 (was: taxonomy_areas + taxonomy_areas_v2)
-- - taxonomy_level3 (was: taxonomy_specialties + taxonomy_specialties_v2)
-- - taxonomy_level4 (was: taxonomy_focus + taxonomy_focus_v2)
--
-- Benefits:
-- 1. Clear naming (Level 1-4 instead of types/areas/specialties/focus)
-- 2. Renaming categories doesn't break course assignments (numeric IDs)
-- 3. Simplified course assignment (only level3_id + optional level4_id)
-- 4. Junction table for Zweitkategorien
-- ============================================

-- ============================================
-- STEP 1: Create new consolidated taxonomy tables
-- ============================================

-- Level 1 (was: Type - beruflich, privat_hobby, kinder_jugend)
CREATE TABLE IF NOT EXISTS taxonomy_level1 (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    icon TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 2 (was: Area - ~27 categories)
CREATE TABLE IF NOT EXISTS taxonomy_level2 (
    id SERIAL PRIMARY KEY,
    level1_id INT NOT NULL REFERENCES taxonomy_level1(id) ON DELETE CASCADE,
    slug TEXT,
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    icon TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(level1_id, slug)
);

-- Level 3 (was: Specialty - ~100+ categories)
CREATE TABLE IF NOT EXISTS taxonomy_level3 (
    id SERIAL PRIMARY KEY,
    level2_id INT NOT NULL REFERENCES taxonomy_level2(id) ON DELETE CASCADE,
    slug TEXT,
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(level2_id, slug)
);

-- Level 4 (was: Focus - optional refinements)
CREATE TABLE IF NOT EXISTS taxonomy_level4 (
    id SERIAL PRIMARY KEY,
    level3_id INT NOT NULL REFERENCES taxonomy_level3(id) ON DELETE CASCADE,
    slug TEXT,
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(level3_id, slug)
);

-- ============================================
-- STEP 2: Indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_taxonomy_level2_level1 ON taxonomy_level2(level1_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_level3_level2 ON taxonomy_level3(level2_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_level4_level3 ON taxonomy_level4(level3_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_level1_active ON taxonomy_level1(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_taxonomy_level2_active ON taxonomy_level2(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_taxonomy_level3_active ON taxonomy_level3(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_taxonomy_level4_active ON taxonomy_level4(is_active) WHERE is_active = true;

-- ============================================
-- STEP 3: Enable RLS with public read access
-- ============================================

ALTER TABLE taxonomy_level1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_level2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_level3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_level4 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taxonomy_level1_select" ON taxonomy_level1;
DROP POLICY IF EXISTS "taxonomy_level2_select" ON taxonomy_level2;
DROP POLICY IF EXISTS "taxonomy_level3_select" ON taxonomy_level3;
DROP POLICY IF EXISTS "taxonomy_level4_select" ON taxonomy_level4;

CREATE POLICY "taxonomy_level1_select" ON taxonomy_level1 FOR SELECT USING (true);
CREATE POLICY "taxonomy_level2_select" ON taxonomy_level2 FOR SELECT USING (true);
CREATE POLICY "taxonomy_level3_select" ON taxonomy_level3 FOR SELECT USING (true);
CREATE POLICY "taxonomy_level4_select" ON taxonomy_level4 FOR SELECT USING (true);

-- ============================================
-- STEP 4: Migrate data from v2 tables
-- ============================================

-- 4a. Migrate Level 1 (types)
INSERT INTO taxonomy_level1 (id, slug, label_de, label_en, label_fr, label_it, icon, sort_order, is_active, created_at, updated_at)
SELECT id, slug, label_de, label_en, label_fr, label_it, icon, sort_order, is_active, created_at, updated_at
FROM taxonomy_types_v2
ON CONFLICT (slug) DO NOTHING;

-- Reset sequence to max id
SELECT setval('taxonomy_level1_id_seq', COALESCE((SELECT MAX(id) FROM taxonomy_level1), 0) + 1, false);

-- 4b. Migrate Level 2 (areas)
INSERT INTO taxonomy_level2 (id, level1_id, slug, label_de, label_en, label_fr, label_it, icon, sort_order, is_active, created_at, updated_at)
SELECT id, type_id, slug, label_de, label_en, label_fr, label_it, icon, sort_order, is_active, created_at, updated_at
FROM taxonomy_areas_v2
ON CONFLICT (level1_id, slug) DO NOTHING;

SELECT setval('taxonomy_level2_id_seq', COALESCE((SELECT MAX(id) FROM taxonomy_level2), 0) + 1, false);

-- 4c. Migrate Level 3 (specialties)
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, label_en, label_fr, label_it, sort_order, is_active, created_at, updated_at)
SELECT id, area_id, slug, label_de, label_en, label_fr, label_it, sort_order, is_active, created_at, updated_at
FROM taxonomy_specialties_v2
ON CONFLICT (level2_id, slug) DO NOTHING;

SELECT setval('taxonomy_level3_id_seq', COALESCE((SELECT MAX(id) FROM taxonomy_level3), 0) + 1, false);

-- 4d. Migrate Level 4 (focus)
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, label_en, label_fr, label_it, sort_order, is_active, created_at, updated_at)
SELECT id, specialty_id, slug, label_de, label_en, label_fr, label_it, sort_order, is_active, created_at, updated_at
FROM taxonomy_focus_v2
ON CONFLICT (level3_id, slug) DO NOTHING;

SELECT setval('taxonomy_level4_id_seq', COALESCE((SELECT MAX(id) FROM taxonomy_level4), 0) + 1, false);

-- ============================================
-- STEP 5: Add new columns to courses table
-- ============================================

-- Primary category assignment (simplified: only level3 + optional level4)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_level3_id INT REFERENCES taxonomy_level3(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_level4_id INT REFERENCES taxonomy_level4(id);

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_courses_category_level3_id ON courses(category_level3_id);
CREATE INDEX IF NOT EXISTS idx_courses_category_level4_id ON courses(category_level4_id);

-- ============================================
-- STEP 6: Migrate course primary categories
-- ============================================

-- Copy from existing v2 IDs (category_specialty_id -> category_level3_id)
UPDATE courses SET
    category_level3_id = category_specialty_id
WHERE category_specialty_id IS NOT NULL
AND category_level3_id IS NULL;

-- Copy focus if exists
UPDATE courses SET
    category_level4_id = category_focus_id
WHERE category_focus_id IS NOT NULL
AND category_level4_id IS NULL;

-- ============================================
-- STEP 7: Create new junction table for Zweitkategorien
-- ============================================

CREATE TABLE IF NOT EXISTS course_category_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    level3_id INT NOT NULL REFERENCES taxonomy_level3(id) ON DELETE CASCADE,
    level4_id INT REFERENCES taxonomy_level4(id) ON DELETE SET NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index that treats NULL level4_id as a distinct value
CREATE UNIQUE INDEX IF NOT EXISTS idx_cca_unique_assignment
ON course_category_assignments(course_id, level3_id, COALESCE(level4_id, 0));

CREATE INDEX IF NOT EXISTS idx_cca_course_id ON course_category_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_cca_level3_id ON course_category_assignments(level3_id);
CREATE INDEX IF NOT EXISTS idx_cca_level4_id ON course_category_assignments(level4_id) WHERE level4_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cca_is_primary ON course_category_assignments(is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE course_category_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cca_select" ON course_category_assignments;
DROP POLICY IF EXISTS "cca_insert" ON course_category_assignments;
DROP POLICY IF EXISTS "cca_delete" ON course_category_assignments;

CREATE POLICY "cca_select" ON course_category_assignments FOR SELECT USING (true);
CREATE POLICY "cca_insert" ON course_category_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "cca_delete" ON course_category_assignments FOR DELETE USING (true);

-- ============================================
-- STEP 8: Migrate existing course_categories to new junction table
-- ============================================

-- Insert from old junction table where we have valid specialty_id
-- Use WHERE NOT EXISTS to handle the unique constraint
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT
    cc.course_id,
    cc.specialty_id AS level3_id,
    cc.focus_id AS level4_id,
    cc.is_primary
FROM course_categories cc
WHERE cc.specialty_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM course_category_assignments cca
    WHERE cca.course_id = cc.course_id
    AND cca.level3_id = cc.specialty_id
    AND COALESCE(cca.level4_id, 0) = COALESCE(cc.focus_id, 0)
);

-- Also ensure primary categories from courses table are in junction
-- First insert missing entries
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT
    c.id AS course_id,
    c.category_level3_id AS level3_id,
    c.category_level4_id AS level4_id,
    true AS is_primary
FROM courses c
WHERE c.category_level3_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM course_category_assignments cca
    WHERE cca.course_id = c.id
    AND cca.level3_id = c.category_level3_id
    AND COALESCE(cca.level4_id, 0) = COALESCE(c.category_level4_id, 0)
);

-- Then update existing entries to mark as primary
UPDATE course_category_assignments cca
SET is_primary = true
FROM courses c
WHERE cca.course_id = c.id
AND cca.level3_id = c.category_level3_id
AND COALESCE(cca.level4_id, 0) = COALESCE(c.category_level4_id, 0)
AND c.category_level3_id IS NOT NULL;

-- ============================================
-- STEP 9: Create Materialized View for fast queries
-- ============================================

DROP MATERIALIZED VIEW IF EXISTS v_taxonomy_paths;

CREATE MATERIALIZED VIEW v_taxonomy_paths AS
SELECT
    l3.id AS level3_id,
    l1.id AS level1_id,
    l1.slug AS level1_slug,
    l1.label_de AS level1_label_de,
    l1.label_en AS level1_label_en,
    l1.label_fr AS level1_label_fr,
    l1.label_it AS level1_label_it,
    l2.id AS level2_id,
    l2.slug AS level2_slug,
    l2.label_de AS level2_label_de,
    l2.label_en AS level2_label_en,
    l2.label_fr AS level2_label_fr,
    l2.label_it AS level2_label_it,
    l3.slug AS level3_slug,
    l3.label_de AS level3_label_de,
    l3.label_en AS level3_label_en,
    l3.label_fr AS level3_label_fr,
    l3.label_it AS level3_label_it
FROM taxonomy_level3 l3
JOIN taxonomy_level2 l2 ON l2.id = l3.level2_id
JOIN taxonomy_level1 l1 ON l1.id = l2.level1_id
WHERE l1.is_active AND l2.is_active AND l3.is_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_taxonomy_paths_level3 ON v_taxonomy_paths(level3_id);
CREATE INDEX IF NOT EXISTS idx_v_taxonomy_paths_level1 ON v_taxonomy_paths(level1_id);
CREATE INDEX IF NOT EXISTS idx_v_taxonomy_paths_level2 ON v_taxonomy_paths(level2_id);
CREATE INDEX IF NOT EXISTS idx_v_taxonomy_paths_level1_slug ON v_taxonomy_paths(level1_slug);
CREATE INDEX IF NOT EXISTS idx_v_taxonomy_paths_level2_slug ON v_taxonomy_paths(level2_slug);

-- ============================================
-- STEP 10: Create View for course categories with full paths
-- ============================================

DROP VIEW IF EXISTS v_course_full_categories;

CREATE VIEW v_course_full_categories AS
SELECT
    c.id AS course_id,
    c.title,
    cca.is_primary,
    tp.level1_id,
    tp.level1_slug,
    tp.level1_label_de,
    tp.level2_id,
    tp.level2_slug,
    tp.level2_label_de,
    tp.level3_id,
    tp.level3_slug,
    tp.level3_label_de,
    l4.id AS level4_id,
    l4.slug AS level4_slug,
    l4.label_de AS level4_label_de
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id
JOIN v_taxonomy_paths tp ON tp.level3_id = cca.level3_id
LEFT JOIN taxonomy_level4 l4 ON l4.id = cca.level4_id AND l4.is_active;

-- ============================================
-- STEP 11: Function to refresh materialized view
-- ============================================

CREATE OR REPLACE FUNCTION refresh_taxonomy_paths()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY v_taxonomy_paths;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 12: Comments for documentation
-- ============================================

COMMENT ON TABLE taxonomy_level1 IS 'Category Level 1 (Type): beruflich, privat_hobby, kinder_jugend';
COMMENT ON TABLE taxonomy_level2 IS 'Category Level 2 (Area): ~27 thematic areas';
COMMENT ON TABLE taxonomy_level3 IS 'Category Level 3 (Specialty): ~100+ specific categories';
COMMENT ON TABLE taxonomy_level4 IS 'Category Level 4 (Focus): Optional refinements';
COMMENT ON TABLE course_category_assignments IS 'Junction table for course-category assignments (primary + secondary)';
COMMENT ON MATERIALIZED VIEW v_taxonomy_paths IS 'Pre-computed full paths for Level 3 categories (for fast queries)';
COMMENT ON VIEW v_course_full_categories IS 'Course categories with full taxonomy path';

COMMENT ON COLUMN courses.category_level3_id IS 'Primary category (Level 3 Specialty) - use this for main classification';
COMMENT ON COLUMN courses.category_level4_id IS 'Optional Level 4 (Focus) for primary category';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Old tables and columns can be dropped after verification:
--
-- DROP TABLE IF EXISTS taxonomy_types CASCADE;
-- DROP TABLE IF EXISTS taxonomy_areas CASCADE;
-- DROP TABLE IF EXISTS taxonomy_specialties CASCADE;
-- DROP TABLE IF EXISTS taxonomy_focus CASCADE;
-- DROP TABLE IF EXISTS taxonomy_types_v2 CASCADE;
-- DROP TABLE IF EXISTS taxonomy_areas_v2 CASCADE;
-- DROP TABLE IF EXISTS taxonomy_specialties_v2 CASCADE;
-- DROP TABLE IF EXISTS taxonomy_focus_v2 CASCADE;
-- DROP TABLE IF EXISTS course_categories CASCADE;
--
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_type;
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_area;
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_specialty;
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_focus;
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_type_id;
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_area_id;
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_specialty_id;
-- ALTER TABLE courses DROP COLUMN IF EXISTS category_focus_id;
-- ============================================
