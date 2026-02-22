-- ============================================
-- Migration: Add Sport & Fitness category for Professionell
-- ============================================
-- This adds the missing "Sport & Fitness (Berufsausbildung)" category
-- under Professionell (level1_id = 1) which was present in the legacy
-- taxonomy_areas table but missing from the consolidated schema.
-- ============================================

-- ============================================
-- STEP 1: Add Level 2 - Sport & Fitness (Berufsausbildung)
-- ============================================
-- Current max level2 ID is 20, so we use 21
INSERT INTO taxonomy_level2 (id, level1_id, slug, label_de, label_en, sort_order, is_active) VALUES
(21, 1, 'sport_fitness_beruf', 'Sport & Fitness (Berufsausbildung)', 'Sports & Fitness (Professional)', 6, true);

-- Update sequence
SELECT setval('taxonomy_level2_id_seq', GREATEST(21, (SELECT MAX(id) FROM taxonomy_level2)), true);

-- ============================================
-- STEP 2: Add Level 3 - Specialties for Sport & Fitness (Berufsausbildung)
-- ============================================
-- Current max level3 ID is 54, so we start at 55
INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, label_en, sort_order, is_active) VALUES
(55, 21, 'fitness_trainer', 'Fitness Trainer Ausbildung', 'Fitness Trainer Certification', 1, true),
(56, 21, 'personal_trainer', 'Personal Trainer Ausbildung', 'Personal Trainer Certification', 2, true),
(57, 21, 'group_fitness', 'Group Fitness Instructor', 'Group Fitness Instructor', 3, true),
(58, 21, 'functional_training', 'Functional Training', 'Functional Training', 4, true),
(59, 21, 'workout_body_toning', 'Workout & Body Toning', 'Workout & Body Toning', 5, true),
(60, 21, 'ruecken_core_trainer', 'Rücken & Core Trainer', 'Back & Core Trainer', 6, true),
(61, 21, 'outdoor_bootcamp', 'Outdoor & Bootcamp Coach', 'Outdoor & Bootcamp Coach', 7, true),
(62, 21, 'sportmanagement', 'Sportmanagement', 'Sports Management', 8, true),
(63, 21, 'sonstiges_sport_profi', 'Sonstiges Sport (Profi)', 'Other Sports (Professional)', 9, true);

-- Update sequence
SELECT setval('taxonomy_level3_id_seq', GREATEST(63, (SELECT MAX(id) FROM taxonomy_level3)), true);

-- ============================================
-- STEP 3: Add Level 4 - Focus/Modus options (optional)
-- ============================================
-- Current max level4 ID is 90, so we start at 91
INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, label_en, sort_order, is_active) VALUES
-- Fitness Trainer Ausbildung (level3_id = 55)
(91, 55, 'basis_zertifikat', 'Basis-Zertifikat', 'Basic Certificate', 1, true),
(92, 55, 'aufbau_spezialisierung', 'Aufbau & Spezialisierung', 'Advanced & Specialization', 2, true),

-- Personal Trainer Ausbildung (level3_id = 56)
(93, 56, 'grundausbildung', 'Grundausbildung', 'Basic Training', 1, true),
(94, 56, 'advanced_coaching', 'Advanced Coaching', 'Advanced Coaching', 2, true),

-- Group Fitness Instructor (level3_id = 57)
(95, 57, 'indoor_kurse', 'Indoor-Kurse', 'Indoor Classes', 1, true),
(96, 57, 'outdoor_kurse', 'Outdoor-Kurse', 'Outdoor Classes', 2, true),

-- Rücken & Core Trainer (level3_id = 60)
(97, 60, 'praevention', 'Prävention', 'Prevention', 1, true),
(98, 60, 'rehabilitation', 'Rehabilitation', 'Rehabilitation', 2, true);

-- Update sequence
SELECT setval('taxonomy_level4_id_seq', GREATEST(98, (SELECT MAX(id) FROM taxonomy_level4)), true);

-- ============================================
-- INFO: Course Assignments
-- ============================================
-- After running this migration, you need to assign courses to the new categories.
--
-- Example for assigning a course to "Fitness Trainer Ausbildung":
-- INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
-- (YOUR_COURSE_ID, 55, 91, true);  -- level3=55 (Fitness Trainer), level4=91 (Basis-Zertifikat)
--
-- Or without level4:
-- INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
-- (YOUR_COURSE_ID, 55, NULL, true);  -- level3=55 (Fitness Trainer), no specific focus
-- ============================================
