-- ============================================
-- Migration: Convert taxonomy to numeric IDs
-- ============================================
-- Problem: Text-IDs like "freizeit_hobbys" appear in UI when labels are missing
-- Solution: Use numeric IDs internally, labels only for display
-- Benefit: Renaming a category doesn't break course assignments
-- ============================================

-- ============================================
-- STEP 1: Create new taxonomy tables with numeric IDs
-- ============================================

-- Types (Level 1) - NEW with numeric ID
CREATE TABLE IF NOT EXISTS taxonomy_types_v2 (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE,                    -- Optional: for URL-friendly references
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    icon TEXT,                           -- Optional: icon name for UI
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Areas (Level 2) - NEW with numeric ID
CREATE TABLE IF NOT EXISTS taxonomy_areas_v2 (
    id SERIAL PRIMARY KEY,
    type_id INT NOT NULL REFERENCES taxonomy_types_v2(id) ON DELETE CASCADE,
    slug TEXT,                           -- Optional: for URL-friendly references
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    icon TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(type_id, slug)
);

-- Specialties (Level 3) - Keep numeric ID, reference new area table
CREATE TABLE IF NOT EXISTS taxonomy_specialties_v2 (
    id SERIAL PRIMARY KEY,
    area_id INT NOT NULL REFERENCES taxonomy_areas_v2(id) ON DELETE CASCADE,
    slug TEXT,
    label_de TEXT NOT NULL,              -- Now has proper label instead of just "name"
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(area_id, slug)
);

-- Focus (Level 4) - Reference new specialty table
CREATE TABLE IF NOT EXISTS taxonomy_focus_v2 (
    id SERIAL PRIMARY KEY,
    specialty_id INT NOT NULL REFERENCES taxonomy_specialties_v2(id) ON DELETE CASCADE,
    slug TEXT,
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(specialty_id, slug)
);

-- ============================================
-- STEP 2: Indexes for performance
-- ============================================

CREATE INDEX idx_taxonomy_areas_v2_type_id ON taxonomy_areas_v2(type_id);
CREATE INDEX idx_taxonomy_specialties_v2_area_id ON taxonomy_specialties_v2(area_id);
CREATE INDEX idx_taxonomy_focus_v2_specialty_id ON taxonomy_focus_v2(specialty_id);

-- ============================================
-- STEP 3: Enable RLS
-- ============================================

ALTER TABLE taxonomy_types_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_areas_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_specialties_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_focus_v2 ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "taxonomy_types_v2_select" ON taxonomy_types_v2 FOR SELECT USING (true);
CREATE POLICY "taxonomy_areas_v2_select" ON taxonomy_areas_v2 FOR SELECT USING (true);
CREATE POLICY "taxonomy_specialties_v2_select" ON taxonomy_specialties_v2 FOR SELECT USING (true);
CREATE POLICY "taxonomy_focus_v2_select" ON taxonomy_focus_v2 FOR SELECT USING (true);

-- ============================================
-- STEP 4: Migrate existing data
-- ============================================

-- 4a. Migrate types
INSERT INTO taxonomy_types_v2 (slug, label_de, label_en, label_fr, label_it, sort_order)
SELECT id, label_de, label_en, label_fr, label_it, sort_order
FROM taxonomy_types
ON CONFLICT DO NOTHING;

-- 4b. Migrate areas (need to look up new type_id)
INSERT INTO taxonomy_areas_v2 (type_id, slug, label_de, label_en, label_fr, label_it, sort_order)
SELECT
    tv2.id AS type_id,
    ta.id AS slug,
    ta.label_de,
    ta.label_en,
    ta.label_fr,
    ta.label_it,
    ta.sort_order
FROM taxonomy_areas ta
JOIN taxonomy_types_v2 tv2 ON tv2.slug = ta.type_id
ON CONFLICT DO NOTHING;

-- 4c. Migrate specialties (need to look up new area_id)
INSERT INTO taxonomy_specialties_v2 (area_id, slug, label_de, sort_order)
SELECT
    av2.id AS area_id,
    LOWER(REGEXP_REPLACE(ts.name, '[^a-zA-Z0-9]+', '_', 'g')) AS slug,
    ts.name AS label_de,
    ts.sort_order
FROM taxonomy_specialties ts
JOIN taxonomy_areas_v2 av2 ON av2.slug = ts.area_id
ON CONFLICT DO NOTHING;

-- 4d. Migrate focus (if exists)
INSERT INTO taxonomy_focus_v2 (specialty_id, slug, label_de, sort_order)
SELECT
    sv2.id AS specialty_id,
    LOWER(REGEXP_REPLACE(tf.name, '[^a-zA-Z0-9]+', '_', 'g')) AS slug,
    tf.name AS label_de,
    tf.sort_order
FROM taxonomy_focus tf
JOIN taxonomy_specialties ts ON ts.id = tf.specialty_id
JOIN taxonomy_areas_v2 av2 ON av2.slug = ts.area_id
JOIN taxonomy_specialties_v2 sv2 ON sv2.area_id = av2.id AND sv2.label_de = ts.name
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 5: Add new columns to courses table
-- ============================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_type_id INT REFERENCES taxonomy_types_v2(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_area_id INT REFERENCES taxonomy_areas_v2(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_specialty_id INT REFERENCES taxonomy_specialties_v2(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_focus_id INT REFERENCES taxonomy_focus_v2(id);

-- ============================================
-- STEP 6: Migrate course category data
-- ============================================

-- Update courses with new numeric IDs
UPDATE courses c SET
    category_type_id = tv2.id
FROM taxonomy_types_v2 tv2
WHERE tv2.slug = c.category_type
AND c.category_type_id IS NULL;

UPDATE courses c SET
    category_area_id = av2.id
FROM taxonomy_areas_v2 av2
WHERE av2.slug = c.category_area
AND c.category_area_id IS NULL;

UPDATE courses c SET
    category_specialty_id = sv2.id
FROM taxonomy_specialties_v2 sv2
JOIN taxonomy_areas_v2 av2 ON av2.id = sv2.area_id
WHERE av2.slug = c.category_area
AND sv2.label_de = c.category_specialty
AND c.category_specialty_id IS NULL;

UPDATE courses c SET
    category_focus_id = fv2.id
FROM taxonomy_focus_v2 fv2
JOIN taxonomy_specialties_v2 sv2 ON sv2.id = fv2.specialty_id
WHERE sv2.id = c.category_specialty_id
AND fv2.label_de = c.category_focus
AND c.category_focus_id IS NULL;

-- ============================================
-- STEP 7: Update course_categories junction table
-- ============================================

ALTER TABLE course_categories ADD COLUMN IF NOT EXISTS type_id INT REFERENCES taxonomy_types_v2(id);
ALTER TABLE course_categories ADD COLUMN IF NOT EXISTS area_id INT REFERENCES taxonomy_areas_v2(id);
ALTER TABLE course_categories ADD COLUMN IF NOT EXISTS specialty_id INT REFERENCES taxonomy_specialties_v2(id);
ALTER TABLE course_categories ADD COLUMN IF NOT EXISTS focus_id INT REFERENCES taxonomy_focus_v2(id);

-- Migrate junction table data
UPDATE course_categories cc SET
    type_id = tv2.id
FROM taxonomy_types_v2 tv2
WHERE tv2.slug = cc.category_type
AND cc.type_id IS NULL;

UPDATE course_categories cc SET
    area_id = av2.id
FROM taxonomy_areas_v2 av2
WHERE av2.slug = cc.category_area
AND cc.area_id IS NULL;

UPDATE course_categories cc SET
    specialty_id = sv2.id
FROM taxonomy_specialties_v2 sv2
JOIN taxonomy_areas_v2 av2 ON av2.id = sv2.area_id
WHERE av2.slug = cc.category_area
AND sv2.label_de = cc.category_specialty
AND cc.specialty_id IS NULL;

-- ============================================
-- STEP 8: Create indexes on new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_courses_category_type_id ON courses(category_type_id);
CREATE INDEX IF NOT EXISTS idx_courses_category_area_id ON courses(category_area_id);
CREATE INDEX IF NOT EXISTS idx_courses_category_specialty_id ON courses(category_specialty_id);
CREATE INDEX IF NOT EXISTS idx_courses_category_focus_id ON courses(category_focus_id);

CREATE INDEX IF NOT EXISTS idx_course_categories_type_id ON course_categories(type_id);
CREATE INDEX IF NOT EXISTS idx_course_categories_area_id ON course_categories(area_id);
CREATE INDEX IF NOT EXISTS idx_course_categories_specialty_id ON course_categories(specialty_id);

-- ============================================
-- STEP 9: Create helper view for easy querying
-- ============================================

CREATE OR REPLACE VIEW v_course_categories AS
SELECT
    c.id AS course_id,
    c.title,
    tv2.id AS type_id,
    tv2.label_de AS type_label,
    av2.id AS area_id,
    av2.label_de AS area_label,
    sv2.id AS specialty_id,
    sv2.label_de AS specialty_label,
    fv2.id AS focus_id,
    fv2.label_de AS focus_label
FROM courses c
LEFT JOIN taxonomy_types_v2 tv2 ON tv2.id = c.category_type_id
LEFT JOIN taxonomy_areas_v2 av2 ON av2.id = c.category_area_id
LEFT JOIN taxonomy_specialties_v2 sv2 ON sv2.id = c.category_specialty_id
LEFT JOIN taxonomy_focus_v2 fv2 ON fv2.id = c.category_focus_id;

-- ============================================
-- STEP 10: Comments
-- ============================================

COMMENT ON TABLE taxonomy_types_v2 IS 'Level 1 categories with numeric IDs - Types';
COMMENT ON TABLE taxonomy_areas_v2 IS 'Level 2 categories with numeric IDs - Areas';
COMMENT ON TABLE taxonomy_specialties_v2 IS 'Level 3 categories with numeric IDs - Specialties';
COMMENT ON TABLE taxonomy_focus_v2 IS 'Level 4 categories with numeric IDs - Focus';
COMMENT ON COLUMN taxonomy_types_v2.slug IS 'URL-friendly identifier, can be null';
COMMENT ON COLUMN courses.category_type_id IS 'References taxonomy_types_v2 - use this instead of category_type';

-- ============================================
-- NOTE: After verifying migration success, run cleanup migration:
-- DROP old columns: category_type, category_area, category_specialty, category_focus
-- DROP old tables: taxonomy_types, taxonomy_areas, taxonomy_specialties, taxonomy_focus
-- RENAME _v2 tables to original names
-- ============================================
