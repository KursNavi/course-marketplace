-- ============================================
-- Migration: Fix v_course_full_categories staleness
-- ============================================
-- Problem: v_course_full_categories joins with the MATERIALIZED VIEW
-- v_taxonomy_paths, which can become stale. Additionally, the
-- refresh_taxonomy_paths() function was changed to RETURNS TRIGGER,
-- making it uncallable via RPC (admin API refresh fails silently).
--
-- Fix: Replace v_course_full_categories to join directly with the
-- taxonomy tables (level1/2/3) instead of the materialized view.
-- The taxonomy tables are small (~200 rows), so the performance
-- difference is negligible and this eliminates all staleness issues.
-- ============================================


-- ============================================
-- STEP 1: Recreate v_course_full_categories with direct JOINs
-- ============================================
-- Keep security_invoker = true from the previous migration.
-- Replace the JOIN on v_taxonomy_paths with direct taxonomy table joins.

CREATE OR REPLACE VIEW v_course_full_categories
WITH (security_invoker = true)
AS
SELECT
    c.id AS course_id,
    c.title,
    cca.is_primary,
    l1.id AS level1_id,
    l1.slug AS level1_slug,
    l1.label_de AS level1_label_de,
    l2.id AS level2_id,
    l2.slug AS level2_slug,
    l2.label_de AS level2_label_de,
    l3.id AS level3_id,
    l3.slug AS level3_slug,
    l3.label_de AS level3_label_de,
    l4.id AS level4_id,
    l4.slug AS level4_slug,
    l4.label_de AS level4_label_de
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id
JOIN taxonomy_level3 l3 ON l3.id = cca.level3_id AND l3.is_active
JOIN taxonomy_level2 l2 ON l2.id = l3.level2_id AND l2.is_active
JOIN taxonomy_level1 l1 ON l1.id = l2.level1_id AND l1.is_active
LEFT JOIN taxonomy_level4 l4 ON l4.id = cca.level4_id AND l4.is_active;


-- ============================================
-- STEP 2: Also refresh the materialized view (for any other code
-- that might still reference it directly)
-- ============================================

REFRESH MATERIALIZED VIEW v_taxonomy_paths;


-- ============================================
-- STEP 3: Create a callable version of refresh for the admin API
-- ============================================
-- The trigger version (RETURNS TRIGGER) can't be called via RPC.
-- Create a separate callable function.

CREATE OR REPLACE FUNCTION refresh_taxonomy_paths_manual()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW v_taxonomy_paths;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION refresh_taxonomy_paths_manual() IS 'Manually callable version to refresh v_taxonomy_paths (for admin API)';


-- ============================================
-- STEP 4: Generate slugs for taxonomy entries that are missing them
-- ============================================
-- Specialties and focuses created via the admin UI don't get slugs.
-- Generate slugs from label_de for all entries where slug IS NULL.

UPDATE taxonomy_level3
SET slug = lower(
    regexp_replace(
        regexp_replace(
            replace(replace(replace(replace(replace(
                label_de,
                'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), '&', 'und'),
            '[^a-zA-Z0-9]+', '_', 'g'),
        '^_|_$', '', 'g')
    )
WHERE slug IS NULL AND label_de IS NOT NULL;

UPDATE taxonomy_level4
SET slug = lower(
    regexp_replace(
        regexp_replace(
            replace(replace(replace(replace(replace(
                label_de,
                'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), '&', 'und'),
            '[^a-zA-Z0-9]+', '_', 'g'),
        '^_|_$', '', 'g')
    )
WHERE slug IS NULL AND label_de IS NOT NULL;
