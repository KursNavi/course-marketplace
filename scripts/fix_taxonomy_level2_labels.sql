-- Fix taxonomy_level2 labels where label_de equals the slug
-- Run this in Supabase SQL Editor

-- First, check current state
SELECT id, slug, label_de,
       CASE WHEN label_de = slug OR label_de LIKE '%_%' THEN 'NEEDS FIX' ELSE 'OK' END as status
FROM taxonomy_level2
ORDER BY level1_id, sort_order;

-- Fix specific entries where label_de is a slug
UPDATE taxonomy_level2 SET label_de = 'Wirtschaft & Management' WHERE slug = 'wirtschaft_management';
UPDATE taxonomy_level2 SET label_de = 'Landwirtschaft' WHERE slug = 'landwirtschaft';
UPDATE taxonomy_level2 SET label_de = 'Bildung & Soziales' WHERE slug = 'bildung_soziales';
UPDATE taxonomy_level2 SET label_de = 'IT & Digitales' WHERE slug = 'it_digitales';
UPDATE taxonomy_level2 SET label_de = 'Technik & Bau' WHERE slug = 'technik_bau';
UPDATE taxonomy_level2 SET label_de = 'Finanzen & Recht' WHERE slug = 'finanzen_recht';

-- Hobby/Privat categories
UPDATE taxonomy_level2 SET label_de = 'Sport & Fitness' WHERE slug = 'sport_fitness';
UPDATE taxonomy_level2 SET label_de = 'Kunst & Kreativität' WHERE slug = 'kunst_kreativitaet';
UPDATE taxonomy_level2 SET label_de = 'Musik & Instrumente' WHERE slug = 'musik_instrumente';
UPDATE taxonomy_level2 SET label_de = 'Sprachen & Kommunikation' WHERE slug = 'sprachen_kommunikation';
UPDATE taxonomy_level2 SET label_de = 'Kochen & Ernährung' WHERE slug = 'kochen_ernaehrung';
UPDATE taxonomy_level2 SET label_de = 'Handwerk & DIY' WHERE slug = 'handwerk_diy';
UPDATE taxonomy_level2 SET label_de = 'Gesundheit & Wellness' WHERE slug = 'gesundheit_wellness';
UPDATE taxonomy_level2 SET label_de = 'Natur & Garten' WHERE slug = 'natur_garten';
UPDATE taxonomy_level2 SET label_de = 'Tanz & Bewegung' WHERE slug = 'tanz_bewegung';
UPDATE taxonomy_level2 SET label_de = 'Fotografie & Film' WHERE slug = 'fotografie_film';

-- Kinder categories
UPDATE taxonomy_level2 SET label_de = 'Sport & Bewegung' WHERE slug = 'kinder_sport';
UPDATE taxonomy_level2 SET label_de = 'Musik & Instrumente' WHERE slug = 'kinder_musik';
UPDATE taxonomy_level2 SET label_de = 'Kunst & Kreativität' WHERE slug = 'kinder_kunst';
UPDATE taxonomy_level2 SET label_de = 'Schwimmen & Wassersport' WHERE slug = 'kinder_schwimmen';
UPDATE taxonomy_level2 SET label_de = 'Sprachen' WHERE slug = 'kinder_sprachen';
UPDATE taxonomy_level2 SET label_de = 'Wissenschaft & Technik' WHERE slug = 'kinder_wissenschaft';

-- Verify the changes
SELECT id, slug, label_de,
       CASE WHEN label_de = slug OR label_de LIKE '%_%' THEN 'STILL NEEDS FIX' ELSE 'OK' END as status
FROM taxonomy_level2
ORDER BY level1_id, sort_order;
