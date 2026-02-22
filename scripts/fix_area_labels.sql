-- Fix missing/incorrect label_de values in taxonomy_areas table
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT id, type_id, label_de FROM taxonomy_areas ORDER BY type_id, sort_order;

-- Update areas where label_de equals the slug (id) or is missing
UPDATE taxonomy_areas SET label_de = 'Wirtschaft & Management' WHERE id = 'wirtschaft_management' AND (label_de = id OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_areas SET label_de = 'Landwirtschaft' WHERE id = 'landwirtschaft' AND (label_de = id OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_areas SET label_de = 'Bildung & Soziales' WHERE id = 'bildung_soziales' AND (label_de = id OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_areas SET label_de = 'IT & Digitales' WHERE id = 'it_digitales' AND (label_de = id OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_areas SET label_de = 'Technik & Bau' WHERE id = 'technik_bau' AND (label_de = id OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_areas SET label_de = 'Finanzen & Recht' WHERE id = 'finanzen_recht' AND (label_de = id OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_areas SET label_de = 'Soft Skills & Persönlichkeit' WHERE id = 'soft_skills' AND (label_de = id OR label_de IS NULL OR label_de = '');

-- Also fix any taxonomy_level2 entries if that table exists
UPDATE taxonomy_level2 SET label_de = 'Wirtschaft & Management' WHERE slug = 'wirtschaft_management' AND (label_de = slug OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_level2 SET label_de = 'Landwirtschaft' WHERE slug = 'landwirtschaft' AND (label_de = slug OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_level2 SET label_de = 'Bildung & Soziales' WHERE slug = 'bildung_soziales' AND (label_de = slug OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_level2 SET label_de = 'IT & Digitales' WHERE slug = 'it_digitales' AND (label_de = slug OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_level2 SET label_de = 'Technik & Bau' WHERE slug = 'technik_bau' AND (label_de = slug OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_level2 SET label_de = 'Finanzen & Recht' WHERE slug = 'finanzen_recht' AND (label_de = slug OR label_de IS NULL OR label_de = '');
UPDATE taxonomy_level2 SET label_de = 'Soft Skills & Persönlichkeit' WHERE slug = 'soft_skills' AND (label_de = slug OR label_de IS NULL OR label_de = '');

-- Verify the changes
SELECT id, type_id, label_de FROM taxonomy_areas ORDER BY type_id, sort_order;
