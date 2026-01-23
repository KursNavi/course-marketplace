-- Data Migration: Populate course_categories from existing category_paths
-- Run this AFTER creating the course_categories table

-- Insert primary categories from category_type, category_area, category_specialty
INSERT INTO course_categories (course_id, category_type, category_area, category_specialty, is_primary)
SELECT
    id,
    category_type,
    category_area,
    category_specialty,
    true as is_primary
FROM courses
WHERE
    category_type IS NOT NULL
    AND category_area IS NOT NULL
    AND category_specialty IS NOT NULL
ON CONFLICT (course_id, category_type, category_area, category_specialty) DO NOTHING;

-- Insert secondary categories from category_paths JSON array
-- This extracts all entries from the category_paths array and creates separate rows
INSERT INTO course_categories (course_id, category_type, category_area, category_specialty, is_primary)
SELECT
    c.id as course_id,
    cat_path->>'type' as category_type,
    cat_path->>'area' as category_area,
    cat_path->>'specialty' as category_specialty,
    -- Mark as primary if it matches the primary category fields
    CASE
        WHEN
            cat_path->>'type' = c.category_type AND
            cat_path->>'area' = c.category_area AND
            cat_path->>'specialty' = c.category_specialty
        THEN true
        ELSE false
    END as is_primary
FROM
    courses c,
    jsonb_array_elements(COALESCE(c.category_paths, '[]'::jsonb)) as cat_path
WHERE
    cat_path->>'type' IS NOT NULL
    AND cat_path->>'area' IS NOT NULL
    AND cat_path->>'specialty' IS NOT NULL
ON CONFLICT (course_id, category_type, category_area, category_specialty) DO UPDATE
    SET is_primary = EXCLUDED.is_primary OR course_categories.is_primary;

-- Verify the migration
SELECT
    COUNT(*) as total_category_entries,
    COUNT(DISTINCT course_id) as courses_with_categories,
    SUM(CASE WHEN is_primary THEN 1 ELSE 0 END) as primary_categories,
    SUM(CASE WHEN NOT is_primary THEN 1 ELSE 0 END) as secondary_categories
FROM course_categories;

-- Show courses with multiple categories
SELECT
    c.title,
    COUNT(cc.id) as category_count,
    json_agg(
        json_build_object(
            'type', cc.category_type,
            'area', cc.category_area,
            'specialty', cc.category_specialty,
            'is_primary', cc.is_primary
        )
    ) as categories
FROM courses c
LEFT JOIN course_categories cc ON c.id = cc.course_id
GROUP BY c.id, c.title
HAVING COUNT(cc.id) > 1
ORDER BY category_count DESC
LIMIT 10;
