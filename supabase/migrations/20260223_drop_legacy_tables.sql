-- ============================================
-- Migration: Drop legacy tables
-- ============================================
-- This migration removes tables that are no longer needed:
-- 1. course_categories - replaced by course_category_assignments + v_course_full_categories view
-- 2. course_private - address data now stored in courses.address, full location in course_events.location
-- ============================================

-- Drop course_categories table (legacy junction table)
-- Data has been migrated to course_category_assignments
DROP TABLE IF EXISTS course_categories CASCADE;

-- Drop course_private table (legacy private data storage)
-- address field was redundant with courses.address and course_events.location
DROP TABLE IF EXISTS course_private CASCADE;

-- Drop legacy view that depended on course_categories
DROP VIEW IF EXISTS v_course_categories CASCADE;
