-- Migration: Add Level 4 "Fokus" to taxonomy hierarchy
-- Hierarchy: Type → Area → Specialty → Focus
-- Focus is OPTIONAL — courses can still be categorized without it.

-- ============================================
-- 1. CREATE FOCUS TABLE (Level 4)
-- ============================================

CREATE TABLE IF NOT EXISTS taxonomy_focus (
    id SERIAL PRIMARY KEY,
    specialty_id INT NOT NULL REFERENCES taxonomy_specialties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(specialty_id, name)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_taxonomy_focus_specialty_id ON taxonomy_focus(specialty_id);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE taxonomy_focus ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "taxonomy_focus_select" ON taxonomy_focus FOR SELECT USING (true);

-- Admin write access via service role only (no client-side policies needed)

-- ============================================
-- 3. EXTEND course_categories JUNCTION TABLE
-- ============================================

-- Add category_focus column (nullable — focus is optional)
ALTER TABLE course_categories ADD COLUMN IF NOT EXISTS category_focus TEXT DEFAULT NULL;

-- Index for focus-based queries
CREATE INDEX IF NOT EXISTS idx_course_categories_focus ON course_categories(category_focus);

-- Update composite index to include focus
DROP INDEX IF EXISTS idx_course_categories_composite;
CREATE INDEX idx_course_categories_composite ON course_categories(category_type, category_area, category_specialty, category_focus);

-- Update unique constraint to include focus (drop old, create new)
ALTER TABLE course_categories DROP CONSTRAINT IF EXISTS course_categories_unique;
ALTER TABLE course_categories ADD CONSTRAINT course_categories_unique
    UNIQUE (course_id, category_type, category_area, category_specialty, category_focus);

-- ============================================
-- 4. EXTEND courses TABLE
-- ============================================

-- Add category_focus column to courses table (for primary category)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_focus TEXT DEFAULT NULL;

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON TABLE taxonomy_focus IS 'Level 4 categories: optional focus/sub-specialization under specialties';
COMMENT ON COLUMN course_categories.category_focus IS 'Optional Level 4 focus within a specialty';
COMMENT ON COLUMN courses.category_focus IS 'Primary category Level 4 focus (optional)';
