-- ============================================
-- BZBS Kurse - Kategorien korrekt zuweisen
-- Fügt Einträge in course_category_assignments hinzu
-- Erstellt: 2026-02-21
-- ============================================

-- Lösche alte Zuweisungen für BZBS-Kurse falls vorhanden
DELETE FROM course_category_assignments
WHERE course_id IN (
    SELECT id FROM courses WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f'
);

-- Einfügen der korrekten Kategorien basierend auf Kurstitel
-- Format: (course_id, level3_id, level4_id, is_primary)

-- 1. Dipl. Betriebswirtschafter/in HF -> Unternehmensführung (2) / Strategie & Nachfolge (4)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 2, 4, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Betriebswirtschafter%';

-- 2. Dipl. Wirtschaftsinformatiker/in HF -> Wirtschaftsinformatik (58) / IT-Business Engineering (97)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 58, 97, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Wirtschaftsinformatiker%';

-- 3. Dipl. Techniker/in HF Unternehmensprozesse -> Produktion & Logistik (60) / Prozessoptimierung (102)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 60, 102, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Unternehmensprozesse%';

-- 4. Dipl. Agrotechniker/in HF -> Agrarwirtschaft (61) / Betriebsführung (105)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 61, 105, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Agrotechniker%';

-- 5. Technische/r Kaufmann/frau -> Unternehmensführung (2) / Leadership & Teamführung (5)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 2, 5, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Technische%Kaufm%';

-- 6. Führungsfachmann/-frau SVF -> Unternehmensführung (2) / Leadership & Teamführung (5)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 2, 5, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Führungsfachm%';

-- 7. HR-Fachmann/-frau -> HR & Personalwesen (57) / HR Fachausweis (95)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 57, 95, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%HR-Fachm%';

-- 8. Holzbau Vorarbeiter/in -> Bauwesen (59) / Holzbau (99)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 59, 99, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Holzbau%';

-- 9. Handelsdiplom BZBS -> Administration & Handel (55) / Handelsdiplom (92)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 55, 92, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Handelsdiplom%';

-- 10. Sachbearbeiter/in Rechnungswesen -> Rechnungswesen & Buchhaltung (56) / Sachbearbeitung (94)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 56, 94, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Rechnungswesen%';

-- 11. Sachbearbeiter/in Personalwesen -> HR & Personalwesen (57) / Sachbearbeitung Personal (96)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 57, 96, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Personalwesen%';

-- 12. Marketing- & Verkaufsfachleute -> Marketing & Verkauf (3) / Sales & Verhandlung (7)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 3, 7, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Marketing%Verkauf%';

-- 13. Informatik-Anwender/in SIZ -> Digitale Kollaboration (11) / Transformation & Tools (23)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 11, 23, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%SIZ%';

-- 14. KI in der Praxis -> Daten & KI (10) / KI-Anwendung (22)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 10, 22, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%KI in der Praxis%';

-- 15. Web-Design & Digital Marketing -> Marketing & Verkauf (3) / Digital Marketing (6)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 3, 6, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Web-Design%';

-- 16. Deutsch als Fremdsprache -> Deutsch (16) / Basis & Grammatik (28)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 16, 28, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Deutsch als Fremdsprache%';

-- 17. Englisch für Beruf & Freizeit -> Englisch (17) / Basis & Grammatik (30)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 17, 30, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Englisch für Beruf%';

-- 18. Romanische Sprachen -> Diverse Sprachen (21) / Einzelsprachen (38)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 21, 38, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Romanische Sprachen%';

-- 19. Bäuerin mit eidg. Fachausweis -> Hauswirtschaft (62) / Bäuerliche Hauswirtschaft (109)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 62, 109, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Bäuerin%';

-- 20. Kräuter-Akademie -> Naturkunde & Kräuter (63) / Heilpflanzen & Kräuter (111)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 63, 111, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Kräuter-Akademie%';

-- 21. Landwirtschaftliche Modulausbildung -> Agrarwirtschaft (61) / Direktzahlungsberechtigung (108)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 61, 108, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Landwirtschaftliche Modulausbildung%';

-- 22. SVEB-Zertifikat Kursleiter/in -> Berufsbildung (8) / Ausbildung BB-Kurse (17)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 8, 17, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%SVEB%';

-- 23. Berufsbildner/in-Kurs -> Berufsbildung (8) / Ausbildung BB-Kurse (17)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 8, 17, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Berufsbildner%';

-- 24. Personal Coach BZBS -> Coaching & Beratung (9) / Prozessbegleitung (19)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 9, 19, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Personal Coach%';

-- 25. Kommunikation & Rhetorik -> Kommunikation (37) / Auftritt & Rhetorik (65)
INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
SELECT id, 37, 65, true FROM courses
WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f' AND title LIKE '%Kommunikation%Rhetorik%';

-- Update die courses-Tabelle mit der primary category
UPDATE courses c
SET
    category_level3_id = cca.level3_id,
    category_level4_id = cca.level4_id
FROM course_category_assignments cca
WHERE cca.course_id = c.id
AND cca.is_primary = true
AND c.user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f';

-- ============================================
-- VERIFICATION
-- ============================================
-- SELECT c.title, c.category_level3_id, c.category_level4_id, cca.level3_id, cca.level4_id
-- FROM courses c
-- LEFT JOIN course_category_assignments cca ON cca.course_id = c.id AND cca.is_primary = true
-- WHERE c.user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f';
