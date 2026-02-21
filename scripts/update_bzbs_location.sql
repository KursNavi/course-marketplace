-- ============================================
-- BZBS Kurse - Standort hinzufügen
-- Ausführen NACH insert_bzbs_courses.sql
-- Erstellt: 2026-02-21
-- ============================================

UPDATE courses
SET
    canton = 'St. Gallen',
    address = 'Buchs SG'
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f';

-- ============================================
-- VERIFICATION
-- ============================================
-- SELECT id, title, canton, address FROM courses
-- WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f';
