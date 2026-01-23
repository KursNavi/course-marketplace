-- Migration: Create course_categories junction table for multi-category support
-- This allows courses to be found under all their assigned categories (Zweitkategorien)

-- Create the junction table
CREATE TABLE IF NOT EXISTS course_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    category_type TEXT NOT NULL,
    category_area TEXT NOT NULL,
    category_specialty TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Composite index for fast category-based searches
    CONSTRAINT course_categories_unique UNIQUE (course_id, category_type, category_area, category_specialty)
);

-- Indexes for performance
CREATE INDEX idx_course_categories_course_id ON course_categories(course_id);
CREATE INDEX idx_course_categories_type ON course_categories(category_type);
CREATE INDEX idx_course_categories_area ON course_categories(category_area);
CREATE INDEX idx_course_categories_specialty ON course_categories(category_specialty);
CREATE INDEX idx_course_categories_composite ON course_categories(category_type, category_area, category_specialty);
CREATE INDEX idx_course_categories_primary ON course_categories(is_primary) WHERE is_primary = true;

-- Enable Row Level Security
ALTER TABLE course_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read course categories
CREATE POLICY "course_categories_select_policy"
    ON course_categories
    FOR SELECT
    USING (true);

-- RLS Policy: Only authenticated users who own the course can insert categories
CREATE POLICY "course_categories_insert_policy"
    ON course_categories
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_categories.course_id
            AND courses.user_id = auth.uid()
        )
    );

-- RLS Policy: Only authenticated users who own the course can update categories
CREATE POLICY "course_categories_update_policy"
    ON course_categories
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_categories.course_id
            AND courses.user_id = auth.uid()
        )
    );

-- RLS Policy: Only authenticated users who own the course can delete categories
CREATE POLICY "course_categories_delete_policy"
    ON course_categories
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_categories.course_id
            AND courses.user_id = auth.uid()
        )
    );

-- Optional: Add a function to automatically update course_categories when courses are updated
-- This ensures data consistency
CREATE OR REPLACE FUNCTION sync_course_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- This is a placeholder; actual sync logic will be handled in the application
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE course_categories IS 'Junction table storing all categories for a course, enabling search by Zweitkategorien';
COMMENT ON COLUMN course_categories.is_primary IS 'Indicates if this is the primary/main category for the course';
