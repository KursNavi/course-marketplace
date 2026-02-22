-- Remove legacy taxonomy tables from Supabase
-- The consolidated schema (taxonomy_level1/2/3/4) is now the authoritative source
-- Run this in Supabase SQL Editor AFTER verifying the consolidated schema works

-- IMPORTANT: Review before running!
-- This will permanently delete these tables and their data.

-- First, check what we're about to delete
SELECT 'taxonomy_types' as table_name, COUNT(*) as row_count FROM taxonomy_types
UNION ALL
SELECT 'taxonomy_areas', COUNT(*) FROM taxonomy_areas
UNION ALL
SELECT 'taxonomy_specialties', COUNT(*) FROM taxonomy_specialties
UNION ALL
SELECT 'taxonomy_focus', COUNT(*) FROM taxonomy_focus;

-- Check v2 tables if they exist
SELECT 'taxonomy_types_v2' as table_name, COUNT(*) as row_count FROM taxonomy_types_v2
UNION ALL
SELECT 'taxonomy_areas_v2', COUNT(*) FROM taxonomy_areas_v2
UNION ALL
SELECT 'taxonomy_specialties_v2', COUNT(*) FROM taxonomy_specialties_v2
UNION ALL
SELECT 'taxonomy_focus_v2', COUNT(*) FROM taxonomy_focus_v2;

-- Verify consolidated tables have data
SELECT 'taxonomy_level1' as table_name, COUNT(*) as row_count FROM taxonomy_level1
UNION ALL
SELECT 'taxonomy_level2', COUNT(*) FROM taxonomy_level2
UNION ALL
SELECT 'taxonomy_level3', COUNT(*) FROM taxonomy_level3
UNION ALL
SELECT 'taxonomy_level4', COUNT(*) FROM taxonomy_level4;

-- ============================================
-- DANGEROUS: Uncomment below to actually delete
-- ============================================

-- Drop legacy tables (original schema with text IDs)
-- DROP TABLE IF EXISTS taxonomy_focus CASCADE;
-- DROP TABLE IF EXISTS taxonomy_specialties CASCADE;
-- DROP TABLE IF EXISTS taxonomy_areas CASCADE;
-- DROP TABLE IF EXISTS taxonomy_types CASCADE;

-- Drop v2 tables (intermediate schema with numeric IDs)
-- DROP TABLE IF EXISTS taxonomy_focus_v2 CASCADE;
-- DROP TABLE IF EXISTS taxonomy_specialties_v2 CASCADE;
-- DROP TABLE IF EXISTS taxonomy_areas_v2 CASCADE;
-- DROP TABLE IF EXISTS taxonomy_types_v2 CASCADE;

-- After removal, only these tables should remain:
-- - taxonomy_level1 (types: Beruflich, Hobby, Kinder)
-- - taxonomy_level2 (areas: Wirtschaft & Management, IT & Digitales, etc.)
-- - taxonomy_level3 (specialties: specific course categories)
-- - taxonomy_level4 (focus: detailed specializations)
