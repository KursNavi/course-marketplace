-- ============================================
-- Migration: Cleanup temporary backup tables and restrict taxonomy MV access
-- Date: 2026-03-04
-- ============================================

-- 1) Drop temporary backup tables created during manual taxonomy migration
DROP TABLE IF EXISTS backup_course_category_assignments_20260304;
DROP TABLE IF EXISTS backup_courses_cat_20260304;
DROP TABLE IF EXISTS backup_taxonomy_level3_20260304;
DROP TABLE IF EXISTS backup_taxonomy_level4_20260304;

-- 2) Restrict direct API access to materialized view
-- App no longer depends on direct SELECT from v_taxonomy_paths
-- (v_course_full_categories joins taxonomy tables directly).
DO $$
BEGIN
    BEGIN
        REVOKE ALL ON MATERIALIZED VIEW v_taxonomy_paths FROM anon;
        REVOKE ALL ON MATERIALIZED VIEW v_taxonomy_paths FROM authenticated;
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
        WHEN undefined_object THEN
            NULL;
    END;
END $$;

-- Optional: keep explicit read for service_role (usually implicit)
DO $$
BEGIN
    BEGIN
        GRANT SELECT ON MATERIALIZED VIEW v_taxonomy_paths TO service_role;
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
        WHEN undefined_object THEN
            NULL;
    END;
END $$;
