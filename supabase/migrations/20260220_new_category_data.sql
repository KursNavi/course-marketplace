-- ============================================
-- Migration: Replace all categories with new structure
-- ============================================
-- Based on the provided category tree with course assignments
-- ============================================

-- ============================================
-- STEP 1: Clear existing data (in correct order due to FK constraints)
-- ============================================

-- Clear course assignments first
DELETE FROM course_category_assignments;

-- Clear courses category references
UPDATE courses SET category_level3_id = NULL, category_level4_id = NULL;

-- Clear taxonomy tables (child tables first)
DELETE FROM taxonomy_level4;
DELETE FROM taxonomy_level3;
DELETE FROM taxonomy_level2;
DELETE FROM taxonomy_level1;

-- Reset sequences
ALTER SEQUENCE taxonomy_level1_id_seq RESTART WITH 1;
ALTER SEQUENCE taxonomy_level2_id_seq RESTART WITH 1;
ALTER SEQUENCE taxonomy_level3_id_seq RESTART WITH 1;
ALTER SEQUENCE taxonomy_level4_id_seq RESTART WITH 1;

-- ============================================
-- STEP 2: Insert Level 1 (Segment)
-- ============================================

INSERT INTO taxonomy_level1 (id, slug, label_de, sort_order, is_active) VALUES
(1, 'professionell', 'Professionell', 1, true),
(2, 'privat', 'Privat', 2, true),
(3, 'kinder', 'Kinder', 3, true);

SELECT setval('taxonomy_level1_id_seq', 3, true);

-- ============================================
-- STEP 3: Insert Level 2 (Themenwelt)
-- ============================================

INSERT INTO taxonomy_level2 (id, level1_id, slug, label_de, sort_order, is_active) VALUES
-- Professionell (level1_id = 1)
(1, 1, 'wirtschaft_management', 'Wirtschaft & Management', 1, true),
(2, 1, 'finanzen_recht', 'Finanzen & Recht', 2, true),
(3, 1, 'bildung_soziales', 'Bildung & Soziales', 3, true),
(4, 1, 'it_digitales', 'IT & Digitales', 4, true),
(5, 1, 'berufssprachen', 'Berufssprachen', 5, true),

-- Privat (level1_id = 2)
(6, 2, 'sprachen', 'Sprachen', 1, true),
(7, 2, 'yoga_achtsamkeit', 'Yoga & Achtsamkeit', 2, true),
(8, 2, 'freizeit_natur', 'Freizeit & Natur', 3, true),
(9, 2, 'kochen_backen', 'Kochen & Backen', 4, true),
(10, 2, 'diy_handwerk', 'DIY & Handwerk', 5, true),
(11, 2, 'musik', 'Musik', 6, true),
(12, 2, 'kunst', 'Kunst', 7, true),
(13, 2, 'soft_skills', 'Soft Skills', 8, true),
(14, 2, 'allgemeinbildung', 'Allgemeinbildung', 9, true),

-- Kinder (level1_id = 3)
(15, 3, 'sport', 'Sport', 1, true),
(16, 3, 'technik_medien', 'Technik & Medien', 2, true),
(17, 3, 'schule_bildung', 'Schule & Bildung', 3, true),
(18, 3, 'musik_kinder', 'Musik', 4, true),
(19, 3, 'outdoor_pfadi', 'Outdoor & Pfadi', 5, true),
(20, 3, 'events_ferien', 'Events & Ferien', 6, true);

SELECT setval('taxonomy_level2_id_seq', 20, true);

-- ============================================
-- STEP 4: Insert Level 3 (Gegenstand)
-- ============================================

INSERT INTO taxonomy_level3 (id, level2_id, slug, label_de, sort_order, is_active) VALUES
-- Wirtschaft & Management (level2_id = 1)
(1, 1, 'projektmanagement', 'Projektmanagement', 1, true),
(2, 1, 'unternehmensfuehrung', 'Unternehmensführung', 2, true),
(3, 1, 'marketing_verkauf', 'Marketing & Verkauf', 3, true),

-- Finanzen & Recht (level2_id = 2)
(4, 2, 'finanzplanung', 'Finanzplanung', 1, true),
(5, 2, 'vorsorge_steuern', 'Vorsorge & Steuern', 2, true),
(6, 2, 'compliance', 'Compliance', 3, true),
(7, 2, 'immobilien', 'Immobilien', 4, true),

-- Bildung & Soziales (level2_id = 3)
(8, 3, 'berufsbildung', 'Berufsbildung', 1, true),
(9, 3, 'coaching_beratung', 'Coaching & Beratung', 2, true),

-- IT & Digitales (level2_id = 4)
(10, 4, 'daten_ki', 'Daten & KI', 1, true),
(11, 4, 'digitale_kollaboration', 'Digitale Kollaboration', 2, true),

-- Berufssprachen (level2_id = 5)
(12, 5, 'business_deutsch', 'Business Deutsch', 1, true),
(13, 5, 'business_englisch', 'Business Englisch', 2, true),
(14, 5, 'business_franzoesisch', 'Business Französisch', 3, true),
(15, 5, 'firmenkurse', 'Firmenkurse', 4, true),

-- Sprachen (level2_id = 6)
(16, 6, 'deutsch', 'Deutsch', 1, true),
(17, 6, 'englisch', 'Englisch', 2, true),
(18, 6, 'franzoesisch', 'Französisch', 3, true),
(19, 6, 'italienisch', 'Italienisch', 4, true),
(20, 6, 'spanisch', 'Spanisch', 5, true),
(21, 6, 'diverse_sprachen', 'Diverse Sprachen', 6, true),

-- Yoga & Achtsamkeit (level2_id = 7)
(22, 7, 'yoga', 'Yoga', 1, true),
(23, 7, 'mental_meditation', 'Mental & Meditation', 2, true),
(24, 7, 'energiearbeit', 'Energiearbeit', 3, true),
(25, 7, 'koerperarbeit', 'Körperarbeit', 4, true),
(26, 7, 'mental_health', 'Mental Health', 5, true),

-- Freizeit & Natur (level2_id = 8)
(27, 8, 'hunde', 'Hunde', 1, true),
(28, 8, 'natur', 'Natur', 2, true),

-- Kochen & Backen (level2_id = 9)
(29, 9, 'kochen_genuss', 'Kochen & Genuss', 1, true),

-- DIY & Handwerk (level2_id = 10)
(30, 10, 'textil', 'Textil', 1, true),
(31, 10, 'technik', 'Technik', 2, true),

-- Musik (level2_id = 11)
(32, 11, 'saiteninstrumente', 'Saiteninstrumente', 1, true),
(33, 11, 'tasteninstrumente', 'Tasteninstrumente', 2, true),
(34, 11, 'blasinstrumente', 'Blasinstrumente', 3, true),
(35, 11, 'gesang', 'Gesang', 4, true),

-- Kunst (level2_id = 12)
(36, 12, 'bildende_kunst', 'Bildende Kunst', 1, true),

-- Soft Skills (level2_id = 13)
(37, 13, 'kommunikation', 'Kommunikation', 1, true),

-- Allgemeinbildung (level2_id = 14)
(38, 14, 'geschichte', 'Geschichte', 1, true),
(39, 14, 'geografie', 'Geografie', 2, true),
(40, 14, 'politik', 'Politik', 3, true),

-- Kinder: Sport (level2_id = 15)
(41, 15, 'schwimmen', 'Schwimmen', 1, true),
(42, 15, 'ballsport', 'Ballsport', 2, true),
(43, 15, 'kampfsport', 'Kampfsport', 3, true),
(44, 15, 'tanz_akrobatik', 'Tanz & Akrobatik', 4, true),

-- Kinder: Technik & Medien (level2_id = 16)
(45, 16, 'informatik_robotik', 'Informatik & Robotik', 1, true),
(46, 16, 'gestaltung', 'Gestaltung', 2, true),
(47, 16, 'science', 'Science', 3, true),

-- Kinder: Schule & Bildung (level2_id = 17)
(48, 17, 'sprachen_kinder', 'Sprachen', 1, true),
(49, 17, 'lernunterstuetzung', 'Lernunterstützung', 2, true),

-- Kinder: Musik (level2_id = 18)
(50, 18, 'kinderchor', 'Kinderchor', 1, true),
(51, 18, 'instrumente_kinder', 'Instrumente', 2, true),

-- Kinder: Outdoor & Pfadi (level2_id = 19)
(52, 19, 'wald_abenteuer', 'Wald & Abenteuer', 1, true),

-- Kinder: Events & Ferien (level2_id = 20)
(53, 20, 'feriencamps', 'Feriencamps', 1, true),
(54, 20, 'events', 'Events', 2, true);

SELECT setval('taxonomy_level3_id_seq', 54, true);

-- ============================================
-- STEP 5: Insert Level 4 (Modus / Fokus)
-- ============================================

INSERT INTO taxonomy_level4 (id, level3_id, slug, label_de, sort_order, is_active) VALUES
-- Projektmanagement (level3_id = 1)
(1, 1, 'klassisch_ipma_prince2', 'Klassisch (IPMA/PRINCE2)', 1, true),
(2, 1, 'agil_scrum_kanban', 'Agil (Scrum/Kanban)', 2, true),
(3, 1, 'prozessmanagement', 'Prozessmanagement', 3, true),

-- Unternehmensführung (level3_id = 2)
(4, 2, 'strategie_nachfolge', 'Strategie & Nachfolge', 1, true),
(5, 2, 'leadership_teamfuehrung', 'Leadership & Teamführung', 2, true),

-- Marketing & Verkauf (level3_id = 3)
(6, 3, 'digital_marketing', 'Digital Marketing', 1, true),
(7, 3, 'sales_verhandlung', 'Sales & Verhandlung', 2, true),

-- Finanzplanung (level3_id = 4)
(8, 4, 'zertifizierung_iaf_cfp', 'Zertifizierung (IAF/CFP)', 1, true),
(9, 4, 'experten_level', 'Experten-Level', 2, true),
(10, 4, 'spezialthemen', 'Spezialthemen', 3, true),

-- Vorsorge & Steuern (level3_id = 5)
(11, 5, 'vorsorgeplanung', 'Vorsorgeplanung', 1, true),
(12, 5, 'steuerrecht_praxis', 'Steuerrecht & Praxis', 2, true),
(13, 5, 'nachfolge_finanzierung', 'Nachfolge-Finanzierung', 3, true),

-- Compliance (level3_id = 6)
(14, 6, 'basis_gwg', 'Basis & GwG', 1, true),
(15, 6, 'refresher_audit', 'Refresher & Audit', 2, true),

-- Immobilien (level3_id = 7)
(16, 7, 'bewirtschaftung_sales', 'Bewirtschaftung & Sales', 1, true),

-- Berufsbildung (level3_id = 8)
(17, 8, 'ausbildung_bb_kurse', 'Ausbildung (BB-Kurse)', 1, true),
(18, 8, 'marketing_refresher', 'Marketing & Refresher', 2, true),

-- Coaching & Beratung (level3_id = 9)
(19, 9, 'prozessbegleitung', 'Prozessbegleitung', 1, true),
(20, 9, 'fachberatung', 'Fachberatung', 2, true),

-- Daten & KI (level3_id = 10)
(21, 10, 'business_intelligence', 'Business Intelligence', 1, true),
(22, 10, 'ki_anwendung', 'KI-Anwendung', 2, true),

-- Digitale Kollaboration (level3_id = 11)
(23, 11, 'transformation_tools', 'Transformation & Tools', 1, true),

-- Business Deutsch (level3_id = 12)
(24, 12, 'fokus_zertifikat_beruf', 'Fokus Zertifikat / Beruf', 1, true),

-- Business Englisch (level3_id = 13)
(25, 13, 'fokus_kommunikation', 'Fokus Kommunikation', 1, true),

-- Business Französisch (level3_id = 14)
(26, 14, 'fokus_kommunikation_fr', 'Fokus Kommunikation', 1, true),

-- Firmenkurse (level3_id = 15)
(27, 15, 'inhouse_training', 'Inhouse Training', 1, true),

-- Deutsch (level3_id = 16)
(28, 16, 'basis_grammatik', 'Basis & Grammatik', 1, true),
(29, 16, 'konversation', 'Konversation', 2, true),

-- Englisch (level3_id = 17)
(30, 17, 'basis_grammatik_en', 'Basis & Grammatik', 1, true),
(31, 17, 'konversation_en', 'Konversation', 2, true),

-- Französisch (level3_id = 18)
(32, 18, 'basis_grammatik_fr', 'Basis & Grammatik', 1, true),
(33, 18, 'konversation_fr', 'Konversation', 2, true),

-- Italienisch (level3_id = 19)
(34, 19, 'basis_grammatik_it', 'Basis & Grammatik', 1, true),
(35, 19, 'konversation_it', 'Konversation', 2, true),

-- Spanisch (level3_id = 20)
(36, 20, 'basis_grammatik_es', 'Basis & Grammatik', 1, true),
(37, 20, 'konversation_es', 'Konversation', 2, true),

-- Diverse Sprachen (level3_id = 21)
(38, 21, 'einzelsprachen', 'Einzelsprachen', 1, true),

-- Yoga (level3_id = 22)
(39, 22, 'hatha_flow_vinyasa', 'Hatha / Flow / Vinyasa', 1, true),
(40, 22, 'wasser_yoga', 'Wasser-Yoga', 2, true),
(41, 22, 'yoga_nidra', 'Yoga Nidra', 3, true),

-- Mental & Meditation (level3_id = 23)
(42, 23, 'meditation_achtsamkeit', 'Meditation & Achtsamkeit', 1, true),
(43, 23, 'klang_atemreise', 'Klang- & Atemreise', 2, true),

-- Energiearbeit (level3_id = 24)
(44, 24, 'reiki_chakra', 'Reiki & Chakra', 1, true),

-- Körperarbeit (level3_id = 25)
(45, 25, 'feldenkrais_pilates', 'Feldenkrais & Pilates', 1, true),
(46, 25, 'massage_wellness', 'Massage & Wellness', 2, true),

-- Mental Health (level3_id = 26)
(47, 26, 'resilienz_coaching', 'Resilienz & Coaching', 1, true),

-- Hunde (level3_id = 27)
(48, 27, 'welpen_junghunde', 'Welpen & Junghunde', 1, true),
(49, 27, 'training_plausch', 'Training & Plausch', 2, true),
(50, 27, 'obligatorische_kurse', 'Obligatorische Kurse', 3, true),

-- Natur (level3_id = 28)
(51, 28, 'waldbaden_outdoor', 'Waldbaden & Outdoor', 1, true),
(52, 28, 'garten_floristik', 'Garten & Floristik', 2, true),

-- Kochen & Genuss (level3_id = 29)
(53, 29, 'kochkurse', 'Kochkurse', 1, true),

-- Textil (level3_id = 30) - no focus items

-- Technik (level3_id = 31) - no focus items

-- Saiteninstrumente (level3_id = 32)
(54, 32, 'gitarre', 'Gitarre', 1, true),
(55, 32, 'ukulele', 'Ukulele', 2, true),
(56, 32, 'banjo', 'Banjo', 3, true),

-- Tasteninstrumente (level3_id = 33)
(57, 33, 'klavier', 'Klavier', 1, true),

-- Blasinstrumente (level3_id = 34)
(58, 34, 'querfloete', 'Querflöte', 1, true),
(59, 34, 'blockfloete', 'Blockflöte', 2, true),
(60, 34, 'didgeridoo', 'Didgeridoo', 1, true),

-- Gesang (level3_id = 35)
(61, 35, 'chor_ensemble', 'Chor & Ensemble', 1, true),
(62, 35, 'sologesang', 'Sologesang', 2, true),

-- Bildende Kunst (level3_id = 36)
(63, 36, 'malen_zeichnen', 'Malen & Zeichnen', 1, true),
(64, 36, 'skulpturen', 'Skulpturen', 2, true),

-- Kommunikation (level3_id = 37)
(65, 37, 'auftritt_rhetorik', 'Auftritt & Rhetorik', 1, true),
(66, 37, 'schwierige_gespraeche', 'Schwierige Gespräche', 2, true),
(67, 37, 'korrespondenz', 'Korrespondenz', 3, true),

-- Geschichte (level3_id = 38) - no focus
-- Geografie (level3_id = 39) - no focus
-- Politik (level3_id = 40) - no focus

-- Schwimmen (level3_id = 41)
(68, 41, 'abzeichen_krebs_eisbaer', 'Abzeichen (Krebs-Eisbär)', 1, true),
(69, 41, 'kleinkind_baby', 'Kleinkind & Baby', 2, true),
(70, 41, 'training_specials', 'Training & Specials', 3, true),

-- Ballsport (level3_id = 42)
(71, 42, 'fussball', 'Fussball', 1, true),
(72, 42, 'tennis', 'Tennis', 2, true),

-- Kampfsport (level3_id = 43)
(73, 43, 'judo', 'Judo', 1, true),
(74, 43, 'karate', 'Karate', 2, true),

-- Tanz & Akrobatik (level3_id = 44)
(75, 44, 'ballett', 'Ballett', 1, true),
(76, 44, 'hip_hop', 'Hip Hop', 2, true),
(77, 44, 'zirkus', 'Zirkus', 3, true),

-- Informatik & Robotik (level3_id = 45)
(78, 45, 'robotik_lego', 'Robotik & Lego', 1, true),
(79, 45, 'coding_gaming', 'Coding & Gaming', 2, true),

-- Gestaltung (level3_id = 46)
(80, 46, 'animation_digital_art', 'Animation & Digital Art', 1, true),

-- Science (level3_id = 47)
(81, 47, 'forschen_entdecken', 'Forschen & Entdecken', 1, true),

-- Sprachen Kinder (level3_id = 48)
(82, 48, 'nachhilfe', 'Nachhilfe', 1, true),
(83, 48, 'feriensprachkurse', 'Feriensprachkurse', 2, true),

-- Lernunterstützung (level3_id = 49)
(84, 49, 'lerncoaching_resilienz', 'Lerncoaching & Resilienz', 1, true),
(85, 49, 'mathe', 'Mathe', 2, true),

-- Kinderchor (level3_id = 50) - no focus

-- Instrumente Kinder (level3_id = 51)
(86, 51, 'klavier_kinder', 'Klavier', 1, true),
(87, 51, 'gitarre_kinder', 'Gitarre', 2, true),
(88, 51, 'blockfloete_kinder', 'Blockflöte', 3, true),

-- Wald & Abenteuer (level3_id = 52) - no focus

-- Feriencamps (level3_id = 53)
(89, 53, 'sport_tech_natur', 'Sport / Tech / Natur', 1, true),

-- Events (level3_id = 54)
(90, 54, 'kindergeburtstag', 'Kindergeburtstag', 1, true);

SELECT setval('taxonomy_level4_id_seq', 90, true);

-- ============================================
-- STEP 6: Course Assignments
-- ============================================
-- Format: (course_id, level3_id, level4_id, is_primary)
-- First assignment for a course is primary, rest are secondary

-- Helper: Insert course assignments
-- Courses with single category get is_primary = true
-- Courses with multiple categories: first is primary, rest secondary

-- Projektmanagement - Klassisch (IPMA/PRINCE2) - level3=1, level4=1
-- Courses: 120, 127
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(120, 1, 1, true),
(127, 1, 1, true);

-- Projektmanagement - Agil (Scrum/Kanban) - level3=1, level4=2
-- Courses: 128, 143
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(128, 1, 2, true),
(143, 1, 2, true);

-- Projektmanagement - Prozessmanagement - level3=1, level4=3
-- Course: 121
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(121, 1, 3, true);

-- Unternehmensführung - Strategie & Nachfolge - level3=2, level4=4
-- Courses: 284, 297, 315, 323, 278
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(284, 2, 4, true),
(297, 2, 4, true),
(315, 2, 4, true),
(323, 2, 4, true),
(278, 2, 4, true);

-- Unternehmensführung - Leadership & Teamführung - level3=2, level4=5
-- Courses: 194, 193, 168, 162
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(194, 2, 5, true),
(193, 2, 5, true),
(168, 2, 5, true),
(162, 2, 5, true);

-- Finanzplanung - Zertifizierung (IAF/CFP) - level3=4, level4=8
-- Courses: 294, 289, 291, 290
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(294, 4, 8, true),
(289, 4, 8, true),
(291, 4, 8, true),
(290, 4, 8, true);

-- Finanzplanung - Experten-Level - level3=4, level4=9
-- Courses: 295, 296
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(295, 4, 9, true),
(296, 4, 9, true);

-- Finanzplanung - Spezialthemen - level3=4, level4=10
-- Courses: 304, 311, 306, 327
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(304, 4, 10, true),
(311, 4, 10, true),
(306, 4, 10, true),
(327, 4, 10, true);

-- Vorsorge & Steuern - Vorsorgeplanung - level3=5, level4=11
-- Courses: 307, 310, 313, 314, 309
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(307, 5, 11, true),
(310, 5, 11, true),
(313, 5, 11, true),
(314, 5, 11, true),
(309, 5, 11, true);

-- Vorsorge & Steuern - Steuerrecht & Praxis - level3=5, level4=12
-- Courses: 308, 319
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(308, 5, 12, true),
(319, 5, 12, true);

-- Vorsorge & Steuern - Nachfolge-Finanzierung - level3=5, level4=13
-- Courses: 321, 320, 317
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(321, 5, 13, true),
(320, 5, 13, true),
(317, 5, 13, true);

-- Compliance - Basis & GwG - level3=6, level4=14
-- Courses: 299, 325, 298
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(299, 6, 14, true),
(325, 6, 14, true),
(298, 6, 14, true);

-- Compliance - Refresher & Audit - level3=6, level4=15
-- Courses: 300, 326, 305
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(300, 6, 15, true),
(326, 6, 15, true),
(305, 6, 15, true);

-- Immobilien - Bewirtschaftung & Sales - level3=7, level4=16
-- Courses: 282, 292, 301, 302
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(282, 7, 16, true),
(292, 7, 16, true),
(301, 7, 16, true),
(302, 7, 16, true);

-- Berufsbildung - Ausbildung (BB-Kurse) - level3=8, level4=17
-- Courses: 185, 186, 187, 188, 189, 190, 191, 192
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(185, 8, 17, true),
(186, 8, 17, true),
(187, 8, 17, true),
(188, 8, 17, true),
(189, 8, 17, true),
(190, 8, 17, true),
(191, 8, 17, true),
(192, 8, 17, true);

-- Berufsbildung - Marketing & Refresher - level3=8, level4=18
-- Courses: 198, 199, 195
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(198, 8, 18, true),
(199, 8, 18, true),
(195, 8, 18, true);

-- Coaching & Beratung - Prozessbegleitung - level3=9, level4=19
-- Courses: 140, 145, 144, 167, 164, 141
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(140, 9, 19, true),
(145, 9, 19, true),
(144, 9, 19, true),
(167, 9, 19, true),
(164, 9, 19, true),
(141, 9, 19, true);

-- Coaching & Beratung - Fachberatung - level3=9, level4=20
-- Courses: 248, 202, 203, 169
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(248, 9, 20, true),
(202, 9, 20, true),
(203, 9, 20, true),
(169, 9, 20, true);

-- Daten & KI - Business Intelligence - level3=10, level4=21
-- Courses: 122, 277
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(122, 10, 21, true),
(277, 10, 21, true);

-- Daten & KI - KI-Anwendung - level3=10, level4=22
-- Course: 161
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(161, 10, 22, true);

-- Digitale Kollaboration - Transformation & Tools - level3=11, level4=23
-- Course: 285
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(285, 11, 23, true);

-- Business Deutsch - Fokus Zertifikat / Beruf - level3=12, level4=24
-- Course: 116
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(116, 12, 24, true);

-- Business Englisch - Fokus Kommunikation - level3=13, level4=25
-- Courses: 113, 118
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(113, 13, 25, true),
(118, 13, 25, true);

-- Business Französisch - Fokus Kommunikation - level3=14, level4=26
-- Courses: 114, 117
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(114, 14, 26, true),
(117, 14, 26, true);

-- Firmenkurse - Inhouse Training - level3=15, level4=27
-- Course: 115
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(115, 15, 27, true);

-- Deutsch - Basis & Grammatik - level3=16, level4=28
-- Course: 103
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(103, 16, 28, true);

-- Deutsch - Konversation - level3=16, level4=29
-- Course: 109
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(109, 16, 29, true);

-- Englisch - Basis & Grammatik - level3=17, level4=30
-- Course: 104
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(104, 17, 30, true);

-- Englisch - Konversation - level3=17, level4=31
-- Course: 110
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(110, 17, 31, true);

-- Französisch - Basis & Grammatik - level3=18, level4=32
-- Course: 105
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(105, 18, 32, true);

-- Französisch - Konversation - level3=18, level4=33
-- Course: 123
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(123, 18, 33, true);

-- Italienisch - Basis & Grammatik - level3=19, level4=34
-- Course: 106
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(106, 19, 34, true);

-- Spanisch - Basis & Grammatik - level3=20, level4=36
-- Course: 107
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(107, 20, 36, true);

-- Diverse Sprachen - Einzelsprachen - level3=21, level4=38
-- Course: 108
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(108, 21, 38, true);

-- Yoga - Hatha / Flow / Vinyasa - level3=22, level4=39
-- Courses: 222, 223, 263
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(222, 22, 39, true),
(223, 22, 39, true),
(263, 22, 39, true);

-- Yoga - Wasser-Yoga - level3=22, level4=40
-- Course: 149
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(149, 22, 40, true);

-- Yoga - Yoga Nidra - level3=22, level4=41
-- Course: 264
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(264, 22, 41, true);

-- Mental & Meditation - Meditation & Achtsamkeit - level3=23, level4=42
-- Courses: 215, 216, 24, 213
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(215, 23, 42, true),
(216, 23, 42, true),
(24, 23, 42, true),
(213, 23, 42, true);

-- Mental & Meditation - Klang- & Atemreise - level3=23, level4=43
-- Course: 22
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(22, 23, 43, true);

-- Energiearbeit - Reiki & Chakra - level3=24, level4=44
-- Courses: 25, 273, 228, 229, 214
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(25, 24, 44, true),
(273, 24, 44, true),
(228, 24, 44, true),
(229, 24, 44, true),
(214, 24, 44, true);

-- Körperarbeit - Feldenkrais & Pilates - level3=25, level4=45
-- Courses: 101, 102, 151, 258
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(101, 25, 45, true),
(102, 25, 45, true),
(151, 25, 45, true),
(258, 25, 45, true);

-- Körperarbeit - Massage & Wellness - level3=25, level4=46
-- Courses: 272, 271, 255
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(272, 25, 46, true),
(271, 25, 46, true),
(255, 25, 46, true);

-- Mental Health - Resilienz & Coaching - level3=26, level4=47
-- Courses: 142, 227
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(142, 26, 47, true),
(227, 26, 47, true);

-- Hunde - Welpen & Junghunde - level3=27, level4=48
-- Courses: 134, 133, 135
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(134, 27, 48, true),
(133, 27, 48, true),
(135, 27, 48, true);

-- Hunde - Training & Plausch - level3=27, level4=49
-- Courses: 137, 138, 139
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(137, 27, 49, true),
(138, 27, 49, true),
(139, 27, 49, true);

-- Hunde - Obligatorische Kurse - level3=27, level4=50
-- Course: 136
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(136, 27, 50, true);

-- Natur - Waldbaden & Outdoor - level3=28, level4=51
-- Courses: 217, 218, 226
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(217, 28, 51, true),
(218, 28, 51, true),
(226, 28, 51, true);

-- Kochen & Genuss - Kochkurse - level3=29, level4=53
-- Course: 26
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(26, 29, 53, true);

-- Saiteninstrumente - Gitarre - level3=32, level4=54
-- Courses: 176, 174, 173, 175
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(176, 32, 54, true),
(174, 32, 54, true),
(173, 32, 54, true),
(175, 32, 54, true);

-- Saiteninstrumente - Ukulele - level3=32, level4=55
-- Courses: 176, 174, 173, 175 (same as Gitarre - secondary)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(176, 32, 55, false),
(174, 32, 55, false),
(173, 32, 55, false),
(175, 32, 55, false);

-- Saiteninstrumente - Banjo - level3=32, level4=56
-- Courses: 176, 174, 173, 175 (same - secondary)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(176, 32, 56, false),
(174, 32, 56, false),
(173, 32, 56, false),
(175, 32, 56, false);

-- Tasteninstrumente - Klavier - level3=33, level4=57
-- Courses: 256, 257
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(256, 33, 57, true),
(257, 33, 57, true);

-- Blasinstrumente - Querflöte - level3=34, level4=58
-- Courses: 171, 170, 172
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(171, 34, 58, true),
(170, 34, 58, true),
(172, 34, 58, true);

-- Blasinstrumente - Blockflöte - level3=34, level4=59
-- Courses: 171, 170, 172 (secondary)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(171, 34, 59, false),
(170, 34, 59, false),
(172, 34, 59, false);

-- Blasinstrumente - Didgeridoo - level3=34, level4=60
-- Courses: 209, 211, 208, 212, 210
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(209, 34, 60, true),
(211, 34, 60, true),
(208, 34, 60, true),
(212, 34, 60, true),
(210, 34, 60, true);

-- Gesang - Chor & Ensemble - level3=35, level4=61
-- Courses: 219, 221
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(219, 35, 61, true),
(221, 35, 61, true);

-- Kommunikation - Auftritt & Rhetorik - level3=37, level4=65
-- Courses: 119, 163
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(119, 37, 65, true),
(163, 37, 65, true);

-- Kommunikation - Schwierige Gespräche - level3=37, level4=66
-- Courses: 197, 200
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(197, 37, 66, true),
(200, 37, 66, true);

-- Kommunikation - Korrespondenz - level3=37, level4=67
-- Courses: 205, 204
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(205, 37, 67, true),
(204, 37, 67, true);

-- Schwimmen - Abzeichen (Krebs-Eisbär) - level3=41, level4=68
-- Courses: 147, 153, 331
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(147, 41, 68, true),
(153, 41, 68, true),
(331, 41, 68, true);

-- Schwimmen - Kleinkind & Baby - level3=41, level4=69
-- Courses: 329, 328, 152
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(329, 41, 69, true),
(328, 41, 69, true),
(152, 41, 69, true);

-- Schwimmen - Training & Specials - level3=41, level4=70
-- Courses: 333, 330, 332
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(333, 41, 70, true),
(330, 41, 70, true),
(332, 41, 70, true);

-- Informatik & Robotik - Robotik & Lego - level3=45, level4=78
-- Course: 177
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(177, 45, 78, true);

-- Informatik & Robotik - Coding & Gaming - level3=45, level4=79
-- Course: 178
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(178, 45, 79, true);

-- Gestaltung - Animation & Digital Art - level3=46, level4=80
-- Course: 179
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(179, 46, 80, true);

-- Sprachen Kinder - Nachhilfe - level3=48, level4=82
-- Course: 111
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(111, 48, 82, true);

-- Sprachen Kinder - Feriensprachkurse - level3=48, level4=83
-- Course: 112
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(112, 48, 83, true);

-- Lernunterstützung - Lerncoaching & Resilienz - level3=49, level4=84
-- Courses: 206, 207
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(206, 49, 84, true),
(207, 49, 84, true);

-- Kinderchor - level3=50, no level4
-- Course: 220
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(220, 50, NULL, true);

-- Events - Kindergeburtstag - level3=54, level4=90
-- Course: 334
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary) VALUES
(334, 54, 90, true);

-- ============================================
-- STEP 7: Update courses table with primary category
-- ============================================

UPDATE courses c
SET
    category_level3_id = cca.level3_id,
    category_level4_id = cca.level4_id
FROM course_category_assignments cca
WHERE cca.course_id = c.id
AND cca.is_primary = true;

-- ============================================
-- STEP 8: Refresh materialized view
-- ============================================

REFRESH MATERIALIZED VIEW v_taxonomy_paths;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this after migration to verify:
-- SELECT 'level1' as tbl, COUNT(*) as cnt FROM taxonomy_level1
-- UNION ALL SELECT 'level2', COUNT(*) FROM taxonomy_level2
-- UNION ALL SELECT 'level3', COUNT(*) FROM taxonomy_level3
-- UNION ALL SELECT 'level4', COUNT(*) FROM taxonomy_level4
-- UNION ALL SELECT 'assignments', COUNT(*) FROM course_category_assignments
-- UNION ALL SELECT 'view_paths', COUNT(*) FROM v_taxonomy_paths;
