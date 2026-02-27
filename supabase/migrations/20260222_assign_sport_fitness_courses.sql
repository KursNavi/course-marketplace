-- ============================================
-- Migration: Assign Sport & Fitness courses to new taxonomy
-- ============================================
-- Run AFTER 20260222_add_sport_fitness_professionell.sql
--
-- Level 3 IDs (Sport & Fitness - level2_id = 23):
-- 64 = Fitness Trainer Ausbildung
-- 65 = Personal Trainer Ausbildung
-- 66 = Group Fitness Instructor
-- 67 = Step & Aerobic
-- 68 = Toning & Workout
-- 69 = Kampfsport & Cardio-Formate
-- 70 = Kraft & Ausdauer
-- 71 = Rücken & Core Trainer
-- 72 = Functional Training
-- 73 = Yoga & Pilates
-- 74 = Ernährung & Coaching
-- 75 = Zertifikate & Prüfungsvorbereitung
-- 76 = Business & Selbstständigkeit
--
-- Level 4 IDs:
-- 113-115 = Fitness Trainer (Basis/Advanced/Diplom)
-- 116-117 = Personal Trainer (Grundausbildung/Spezialisierung)
-- 118-119 = Group Fitness (Grundlagen/Programme)
-- 120-121 = Rücken & Core (Antara®/Allgemein)
-- 122-124 = Ernährung (Ausbildung/Workshop/Sporternährung)
-- ============================================

-- Remove existing assignments for these courses
DELETE FROM course_category_assignments
WHERE course_id IN (27,28,29,30,34,35,36,37,38,40,41,42,43,44,45,46,47,48,49,50,51,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,96,97,98,99,100);

-- ============================================
-- Fitness Trainer Ausbildung (level3_id = 64)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
-- Basis (level4 = 113)
(51, 64, 113, true),   -- Fitness- und Bewegungstrainer Basic
(97, 64, 113, true),   -- Fitnessführerschein (online)
(63, 64, 113, true),   -- Basic Heart
(64, 64, 113, true),   -- Basic Moves
-- Advanced (level4 = 114)
(88, 64, 114, true),   -- Fitness- und Bewegungstrainer Advanced
(98, 64, 114, true),   -- Fitness- und Bewegungstrainer Pro
-- Diplom (level4 = 115)
(28, 64, 115, true),   -- Dipl. Fitness Trainer
(27, 64, 115, true),   -- Fitness Trainer mit star Fachausweis
(30, 64, 115, true),   -- Trainer mit Branchenzertifikat
(60, 64, 115, true),   -- Gesundheitstrainer/in mit SVBO-Branchenzertifikat
(61, 64, 115, true),   -- Trainer Fachrichtung Fitness- und Gesundheitstraining
(62, 64, 115, true),   -- Spezialist Bewegungs- und Gesundheitsförderung
(86, 64, NULL, true);  -- Fitness Workshops

-- ============================================
-- Personal Trainer Ausbildung (level3_id = 65)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(29, 65, 116, true),   -- Gesamtlehrgang Personal Trainer
(79, 65, 116, true),   -- Personaltrainer Ausbildung
(59, 65, 117, true);   -- Trainingscoaching Spezialist

-- ============================================
-- Group Fitness Instructor (level3_id = 66)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
-- Grundlagen (level4 = 118)
(43, 66, 118, true),   -- Grundlagen Group Fitness
(66, 66, 118, true),   -- Grundlagen Gruppenfitness
-- Programme (level4 = 119)
(70, 66, 119, true),   -- Gruppenfitness Workshops
(68, 66, 119, true),   -- UPCON Programm
(82, 66, 119, true),   -- P.I.I.T Programm
(71, 66, 119, true),   -- Simply Core Programm
(45, 66, 119, true);   -- M.A.X.® Ausbildungstag

-- ============================================
-- Step & Aerobic (level3_id = 67)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(73, 67, NULL, true),  -- Aerobic Instruktor Ausbildung
(81, 67, NULL, true),  -- Powerstep Instruktor Ausbildung
(89, 67, NULL, true);  -- Cycling Instruktor Ausbildung

-- ============================================
-- Toning & Workout (level3_id = 68)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(44, 68, NULL, true),  -- Dipl. Body Toning & Workout Instructor
(69, 68, NULL, true),  -- Toning Instruktor Ausbildung
(92, 68, NULL, true);  -- Pump Instruktor Ausbildung

-- ============================================
-- Kampfsport & Cardio-Formate (level3_id = 69)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(65, 69, NULL, true),  -- Fitboxe Instruktor Lehrgang
(75, 69, NULL, true),  -- Kick Power Instruktor Lehrgang
(84, 69, NULL, true);  -- Fighttime Instruktor Ausbildung

-- ============================================
-- Kraft & Ausdauer (level3_id = 70)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(56, 70, NULL, true),  -- Kraftspezialist
(57, 70, NULL, true),  -- Ausdauerspezialist
(35, 70, NULL, true),  -- Cardio Coach
(34, 70, NULL, true),  -- Workout Coach
(46, 70, NULL, true);  -- Circuit Training

-- ============================================
-- Rücken & Core Trainer (level3_id = 71)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
-- Antara® (level4 = 120)
(50, 71, 120, true),   -- Antara® Rücken Trainer I
(40, 71, 120, true),   -- Dipl. Antara® Rücken Trainer
(49, 71, 120, true),   -- Dipl. Antara® Beckenboden-Trainer
-- Allgemein (level4 = 121)
(58, 71, 121, true);   -- Haltungsspezialist

-- ============================================
-- Functional Training (level3_id = 72)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(41, 72, NULL, true),  -- Functional Fitness Trainer
(54, 72, NULL, true),  -- Athletikcoach
(36, 72, NULL, true);  -- Sensomotorik

-- ============================================
-- Yoga & Pilates (level3_id = 73)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(67, 73, NULL, true),  -- Power Yoga Instruktor Level 1
(99, 73, NULL, true),  -- Power Yoga Masterclass
(91, 73, NULL, true),  -- Pilates Instruktor Ausbildung
(94, 73, NULL, true);  -- Pilates Masterclass

-- ============================================
-- Ernährung & Coaching (level3_id = 74)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
-- Ausbildung (level4 = 122)
(87, 74, 122, true),   -- Ernährungscoach Ausbildung
-- Workshop (level4 = 123)
(72, 74, 123, true),   -- Ernährungsworkshop: Diagnostik
(76, 74, 123, true),   -- Ernährungsworkshop: Ernährungsberatung
(80, 74, 123, true),   -- Ernährungsworkshop: Ernährung und Krankheiten
(90, 74, 123, true),   -- Ernährungsworkshop: Grundlagen
(78, 74, 123, true),   -- Energiehaushalt
(85, 74, 123, true),   -- Nährstoffe
(74, 74, 123, true),   -- Unerlaubte Substanzen
-- Sporternährung (level4 = 124)
(55, 74, 124, true),   -- Sporternährungscoach
(77, 74, 124, true),   -- Ernährung für den Fettabbau
(93, 74, 124, true),   -- Ernährung für den Muskelaufbau
(83, 74, 124, true);   -- Ernährung vor und während dem Wettkampf

-- ============================================
-- Zertifikate & Prüfungsvorbereitung (level3_id = 75)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(38, 75, NULL, true),  -- Vorbereitungskurs eidg. Fachausweis
(53, 75, NULL, true),  -- Vorbereitungskurs Modulprüfungen
(96, 75, NULL, true),  -- Online-Vorbereitungskurs Modulprüfungen
(100, 75, NULL, true), -- Modulprüfungen Übersicht
(37, 75, NULL, true);  -- Medical Fitness Trainer

-- ============================================
-- Business & Selbstständigkeit (level3_id = 76)
-- ============================================
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(48, 76, NULL, true),  -- Der Weg in die Selbstständigkeit
(42, 76, NULL, true),  -- Verkauf und Administration
(47, 76, NULL, true);  -- Stretching 1zu1

-- ============================================
-- Update courses table with primary category
-- ============================================
UPDATE courses c
SET
    category_level3_id = cca.level3_id,
    category_level4_id = cca.level4_id
FROM course_category_assignments cca
WHERE c.id = cca.course_id
AND cca.is_primary = true
AND c.category_area = 'sport_fitness_beruf';
