-- Migration: Create taxonomy tables for category management
-- This replaces the hardcoded categories in constants.js

-- ============================================
-- 1. CREATE TABLES
-- ============================================

-- Types (Level 1): beruflich, privat_hobby, kinder_jugend
CREATE TABLE IF NOT EXISTS taxonomy_types (
    id TEXT PRIMARY KEY,
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Areas (Level 2): sport_fitness, musik, business_mgmt, etc.
CREATE TABLE IF NOT EXISTS taxonomy_areas (
    id TEXT PRIMARY KEY,
    type_id TEXT NOT NULL REFERENCES taxonomy_types(id) ON DELETE CASCADE,
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_fr TEXT,
    label_it TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Specialties (Level 3): "Gitarre/Bass", "Marketing", etc.
CREATE TABLE IF NOT EXISTS taxonomy_specialties (
    id SERIAL PRIMARY KEY,
    area_id TEXT NOT NULL REFERENCES taxonomy_areas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(area_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_taxonomy_areas_type_id ON taxonomy_areas(type_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_specialties_area_id ON taxonomy_specialties(area_id);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE taxonomy_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_specialties ENABLE ROW LEVEL SECURITY;

-- Public read access for all
CREATE POLICY "taxonomy_types_select" ON taxonomy_types FOR SELECT USING (true);
CREATE POLICY "taxonomy_areas_select" ON taxonomy_areas FOR SELECT USING (true);
CREATE POLICY "taxonomy_specialties_select" ON taxonomy_specialties FOR SELECT USING (true);

-- Admin write access (via service role only - no client-side policies needed)

-- ============================================
-- 3. SEED DATA: TYPES
-- ============================================

INSERT INTO taxonomy_types (id, label_de, label_en, label_fr, label_it, sort_order) VALUES
('beruflich', 'Berufliche Weiterbildung', 'Professional Development', 'Formation professionnelle', 'Formazione professionale', 1),
('privat_hobby', 'Privat & Hobby', 'Private & Hobby', 'Privé & Loisirs', 'Privato & Hobby', 2),
('kinder_jugend', 'Kinder & Jugendliche', 'Kids & Teens', 'Enfants & Ados', 'Bambini & Adolescenti', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. SEED DATA: AREAS (BERUFLICH)
-- ============================================

INSERT INTO taxonomy_areas (id, type_id, label_de, label_en, label_fr, label_it, sort_order) VALUES
('sport_fitness_beruf', 'beruflich', 'Sport & Fitness (Berufsausbildung)', 'Sports & Fitness (Pro)', 'Sport & Fitness (Pro)', 'Sport & Fitness (Pro)', 1),
('gesundheit_beruf', 'beruflich', 'Gesundheit, Pflege & Prävention', 'Health, Care & Prevention', 'Santé, Soins & Prévention', 'Salute, Cura & Prevenzione', 2),
('bildung_pruefung', 'beruflich', 'Bildung & Prüfungsvorbereitung', 'Education & Exam Prep', 'Éducation & Prép. Examens', 'Istruzione & Prep. Esami', 3),
('business_mgmt', 'beruflich', 'Business, Management & Leadership', 'Business & Management', 'Affaires & Gestion', 'Affari & Gestione', 4),
('hr_recht', 'beruflich', 'HR, Recht & Administration', 'HR, Law & Admin', 'RH, Droit & Admin', 'HR, Diritto & Ammin.', 5),
('finanzen', 'beruflich', 'Finanzen, Controlling & Treuhand', 'Finance & Accounting', 'Finance & Comptabilité', 'Finanza & Contabilità', 6),
('marketing', 'beruflich', 'Verkauf, Marketing & Kommunikation', 'Sales & Marketing', 'Ventes & Marketing', 'Vendite & Marketing', 7),
('it_digital', 'beruflich', 'IT, Digital & Data', 'IT, Digital & Data', 'IT, Numérique & Données', 'IT, Digitale & Dati', 8),
('industrie_bau', 'beruflich', 'Industrie, Bau & Immobilien', 'Industry & Construction', 'Industrie & Construction', 'Industria & Edilizia', 9),
('sprachen_beruf', 'beruflich', 'Sprachen für den Beruf', 'Business Languages', 'Langues des affaires', 'Lingue commerciali', 10),
('soft_skills', 'beruflich', 'Soft Skills & Persönlichkeit', 'Soft Skills', 'Compétences douces', 'Soft Skills', 11)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. SEED DATA: AREAS (PRIVAT_HOBBY)
-- ============================================

INSERT INTO taxonomy_areas (id, type_id, label_de, label_en, label_fr, label_it, sort_order) VALUES
('sport_fitness', 'privat_hobby', 'Sport, Fitness & Bewegung', 'Sports & Fitness', 'Sport & Fitness', 'Sport & Fitness', 1),
('yoga_mental', 'privat_hobby', 'Yoga, Entspannung & Mental', 'Yoga & Mental Health', 'Yoga & Santé mentale', 'Yoga & Salute mentale', 2),
('musik', 'privat_hobby', 'Musik & Bühne', 'Music & Stage', 'Musique & Scène', 'Musica & Palcoscenico', 3),
('kunst_kreativ', 'privat_hobby', 'Kunst, Design & Kreatives', 'Art & Creative', 'Art & Créatif', 'Arte & Creativo', 4),
('kochen_genuss', 'privat_hobby', 'Kochen, Backen & Genuss', 'Cooking & Nutrition', 'Cuisine & Nutrition', 'Cucina & Nutrizione', 5),
('sprachen_privat', 'privat_hobby', 'Sprachen & Reisen', 'Languages & Travel', 'Langues & Voyage', 'Lingue & Viaggi', 6),
('heim_garten', 'privat_hobby', 'Heim, Handwerk & Natur', 'Home & Nature', 'Maison & Nature', 'Casa & Natura', 7),
('alltag_leben', 'privat_hobby', 'Alltag & Persönlichkeit', 'Life & Personality', 'Vie & Personnalité', 'Vita & Personalità', 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. SEED DATA: AREAS (KINDER_JUGEND)
-- ============================================

INSERT INTO taxonomy_areas (id, type_id, label_de, label_en, label_fr, label_it, sort_order) VALUES
('fruehkind', 'kinder_jugend', 'Frühkind & Eltern-Kind (0-5)', 'Early Childhood (0-5)', 'Petite enfance (0-5)', 'Prima infanzia (0-5)', 1),
('schule_lernen', 'kinder_jugend', 'Schule, Nachhilfe & Lernen', 'School & Tutoring', 'École & Soutien', 'Scuola & Tutoraggio', 2),
('freizeit_hobbys', 'kinder_jugend', 'Hobbys, Sport & Kreatives', 'Hobbies & Sports', 'Loisirs & Sports', 'Hobby & Sport', 3),
('technik_medien', 'kinder_jugend', 'Technik, Coding & Medien', 'Tech & Coding', 'Tech & Codage', 'Tech & Coding', 4),
('ferien', 'kinder_jugend', 'Feriencamps & Betreuung', 'Camps', 'Camps', 'Campi', 5),
('eltern', 'kinder_jugend', 'Elternbildung & Familie', 'Parenting', 'Parentalité', 'Genitorialità', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. SEED DATA: SPECIALTIES (BERUFLICH)
-- ============================================

-- sport_fitness_beruf
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('sport_fitness_beruf', 'Fitness Trainer Ausbildung', 1),
('sport_fitness_beruf', 'Personal Trainer Ausbildung', 2),
('sport_fitness_beruf', 'Group Fitness Instructor', 3),
('sport_fitness_beruf', 'Functional Training', 4),
('sport_fitness_beruf', 'Workout & Body Toning', 5),
('sport_fitness_beruf', 'Rücken & Core Trainer', 6),
('sport_fitness_beruf', 'Outdoor & Bootcamp Coach', 7),
('sport_fitness_beruf', 'Sportmanagement', 8),
('sport_fitness_beruf', 'Sonstiges Sport (Profi)', 9)
ON CONFLICT (area_id, name) DO NOTHING;

-- gesundheit_beruf
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('gesundheit_beruf', 'Gesundheitsförderung & Prävention', 1),
('gesundheit_beruf', 'Spezialist Bewegungsförderung', 2),
('gesundheit_beruf', 'Medical Fitness', 3),
('gesundheit_beruf', 'Pflege & Betreuung', 4),
('gesundheit_beruf', 'Medizinische Grundlagen', 5),
('gesundheit_beruf', 'Notfallmedizin & Erste Hilfe', 6),
('gesundheit_beruf', 'Praxisorganisation', 7),
('gesundheit_beruf', 'Soziale Arbeit', 8),
('gesundheit_beruf', 'Komplementärmethoden', 9),
('gesundheit_beruf', 'Sonstiges Gesundheit', 10)
ON CONFLICT (area_id, name) DO NOTHING;

-- bildung_pruefung
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('bildung_pruefung', 'Vorbereitung Berufsprüfung (BP)', 1),
('bildung_pruefung', 'Eidg. Fachausweis Vorbereitung', 2),
('bildung_pruefung', 'Ausbilder / SVEB', 3),
('bildung_pruefung', 'Lerncoaching (Beruflich)', 4),
('bildung_pruefung', 'Erwachsenenbildung', 5),
('bildung_pruefung', 'Sonstige Prüfungsvorbereitung', 6)
ON CONFLICT (area_id, name) DO NOTHING;

-- business_mgmt
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('business_mgmt', 'Unternehmensstrategie & Geschäftsmodelle', 1),
('business_mgmt', 'Projektmanagement klassisch', 2),
('business_mgmt', 'Agiles Projekt- & Produktmanagement', 3),
('business_mgmt', 'Prozessmanagement & Lean', 4),
('business_mgmt', 'Leadership & Teamführung', 5),
('business_mgmt', 'Verkauf & Administration (Fitness/Gewerbe)', 6),
('business_mgmt', 'Change- & Transformationsmanagement', 7),
('business_mgmt', 'Organisationsentwicklung', 8),
('business_mgmt', 'Innovation & Entrepreneurship', 9),
('business_mgmt', 'Nachhaltigkeit & CSR', 10),
('business_mgmt', 'Unternehmensgründung', 11),
('business_mgmt', 'Governance & Compliance', 12),
('business_mgmt', 'Sonstiges Business', 13)
ON CONFLICT (area_id, name) DO NOTHING;

-- hr_recht
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('hr_recht', 'Recruiting & Personalmarketing', 1),
('hr_recht', 'Personaladministration & Lohn', 2),
('hr_recht', 'Arbeitsrecht', 3),
('hr_recht', 'Personalentwicklung', 4),
('hr_recht', 'HR-Strategie', 5),
('hr_recht', 'Diversity & Inclusion', 6),
('hr_recht', 'Office-Management', 7),
('hr_recht', 'Sonstiges HR/Recht', 8)
ON CONFLICT (area_id, name) DO NOTHING;

-- finanzen
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('finanzen', 'Buchhaltung & Abschluss', 1),
('finanzen', 'Controlling & Reporting', 2),
('finanzen', 'Finanzplanung & Budget', 3),
('finanzen', 'Steuern für Unternehmen', 4),
('finanzen', 'Treuhand', 5),
('finanzen', 'Rechnungslegung (OR/Swiss GAAP)', 6),
('finanzen', 'Sonstiges Finanzen', 7)
ON CONFLICT (area_id, name) DO NOTHING;

-- marketing
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('marketing', 'Verkauf & Vertrieb', 1),
('marketing', 'Verhandlungstechnik', 2),
('marketing', 'Marketingstrategie', 3),
('marketing', 'Online-Marketing & Social Media', 4),
('marketing', 'Content & Storytelling', 5),
('marketing', 'SEO/SEA', 6),
('marketing', 'CRM & Automation', 7),
('marketing', 'Eventmarketing', 8),
('marketing', 'Sonstiges Marketing', 9)
ON CONFLICT (area_id, name) DO NOTHING;

-- it_digital
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('it_digital', 'Softwareentwicklung', 1),
('it_digital', 'Webdesign & Webdev', 2),
('it_digital', 'Datenbanken & SQL', 3),
('it_digital', 'Data Science & BI', 4),
('it_digital', 'AI & Machine Learning', 5),
('it_digital', 'Cybersecurity', 6),
('it_digital', 'Cloud & Infrastruktur', 7),
('it_digital', 'Office-Tools (Excel etc.)', 8),
('it_digital', 'Sonstiges IT', 9)
ON CONFLICT (area_id, name) DO NOTHING;

-- industrie_bau
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('industrie_bau', 'Bauleitung & Planung', 1),
('industrie_bau', 'CAD & BIM', 2),
('industrie_bau', 'Energie & Gebäudetechnik', 3),
('industrie_bau', 'Facility Management', 4),
('industrie_bau', 'Logistik & Supply Chain', 5),
('industrie_bau', 'Arbeitssicherheit', 6),
('industrie_bau', 'Immobilienbewirtschaftung', 7),
('industrie_bau', 'Sonstiges Industrie/Bau', 8)
ON CONFLICT (area_id, name) DO NOTHING;

-- sprachen_beruf
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('sprachen_beruf', 'Business Deutsch', 1),
('sprachen_beruf', 'Business Englisch', 2),
('sprachen_beruf', 'Business Französisch', 3),
('sprachen_beruf', 'Fachsprache (Medizin/Recht)', 4),
('sprachen_beruf', 'Präsentieren in Fremdsprache', 5),
('sprachen_beruf', 'Sonstige Berufssprachen', 6)
ON CONFLICT (area_id, name) DO NOTHING;

-- soft_skills
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('soft_skills', 'Kommunikation', 1),
('soft_skills', 'Präsentation & Auftritt', 2),
('soft_skills', 'Zeitmanagement', 3),
('soft_skills', 'Konfliktmanagement', 4),
('soft_skills', 'Resilienz & Stress', 5),
('soft_skills', 'Interkulturelle Kompetenz', 6),
('soft_skills', 'Sonstige Soft Skills', 7)
ON CONFLICT (area_id, name) DO NOTHING;

-- ============================================
-- 8. SEED DATA: SPECIALTIES (PRIVAT_HOBBY)
-- ============================================

-- sport_fitness
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('sport_fitness', 'Fitness & Kraft', 1),
('sport_fitness', 'Ausdauer & Lauf', 2),
('sport_fitness', 'Kampfsport', 3),
('sport_fitness', 'Tanz-Fitness (Zumba etc.)', 4),
('sport_fitness', 'Teamsport', 5),
('sport_fitness', 'Wintersport', 6),
('sport_fitness', 'Wassersport', 7),
('sport_fitness', 'Outdoor & Wandern', 8),
('sport_fitness', 'Sonstiges Sport', 9)
ON CONFLICT (area_id, name) DO NOTHING;

-- yoga_mental
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('yoga_mental', 'Hatha Yoga', 1),
('yoga_mental', 'Vinyasa/Power Yoga', 2),
('yoga_mental', 'Pilates', 3),
('yoga_mental', 'Meditation & Achtsamkeit', 4),
('yoga_mental', 'Atemtraining', 5),
('yoga_mental', 'Energiearbeit', 6),
('yoga_mental', 'Stressbewältigung', 7),
('yoga_mental', 'Sonstiges Yoga/Mental', 8)
ON CONFLICT (area_id, name) DO NOTHING;

-- musik
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('musik', 'Gitarre/Bass', 1),
('musik', 'Klavier/Tasten', 2),
('musik', 'Gesang', 3),
('musik', 'Schlagzeug', 4),
('musik', 'Blasinstrumente', 5),
('musik', 'Streichinstrumente', 6),
('musik', 'Chor/Ensemble', 7),
('musik', 'Musikproduktion & DJ', 8),
('musik', 'Theater & Schauspiel', 9),
('musik', 'Tanz (Standard/Salsa)', 10),
('musik', 'Sonstiges Musik', 11)
ON CONFLICT (area_id, name) DO NOTHING;

-- kunst_kreativ
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('kunst_kreativ', 'Zeichnen & Malen', 1),
('kunst_kreativ', 'Fotografie', 2),
('kunst_kreativ', 'Bildbearbeitung', 3),
('kunst_kreativ', 'Grafikdesign', 4),
('kunst_kreativ', 'Keramik & Töpfern', 5),
('kunst_kreativ', 'Nähen & Textil', 6),
('kunst_kreativ', 'Schmuck & DIY', 7),
('kunst_kreativ', 'Calligraphy & Lettering', 8),
('kunst_kreativ', 'Sonstiges Kreativ', 9)
ON CONFLICT (area_id, name) DO NOTHING;

-- kochen_genuss
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('kochen_genuss', 'Kochkurse Basics', 1),
('kochen_genuss', 'Länderküchen', 2),
('kochen_genuss', 'Vegetarisch/Vegan', 3),
('kochen_genuss', 'Backen & Patisserie', 4),
('kochen_genuss', 'Barista & Kaffee', 5),
('kochen_genuss', 'Wein & Degustation', 6),
('kochen_genuss', 'Ernährungswissen', 7),
('kochen_genuss', 'Sonstiges Kochen', 8)
ON CONFLICT (area_id, name) DO NOTHING;

-- sprachen_privat
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('sprachen_privat', 'Deutsch (Alltag)', 1),
('sprachen_privat', 'Englisch (Alltag)', 2),
('sprachen_privat', 'Französisch (Alltag)', 3),
('sprachen_privat', 'Italienisch (Alltag)', 4),
('sprachen_privat', 'Spanisch (Alltag)', 5),
('sprachen_privat', 'Schweizerdeutsch', 6),
('sprachen_privat', 'Reisevorbereitung', 7),
('sprachen_privat', 'Sonstige Sprachen', 8)
ON CONFLICT (area_id, name) DO NOTHING;

-- heim_garten
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('heim_garten', 'Heimwerken & Reparatur', 1),
('heim_garten', 'Garten & Pflanzen', 2),
('heim_garten', 'Tiere & Hundeschule', 3),
('heim_garten', 'Floristik', 4),
('heim_garten', 'Technik zuhause', 5),
('heim_garten', 'Sonstiges Heim/Natur', 6)
ON CONFLICT (area_id, name) DO NOTHING;

-- alltag_leben
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('alltag_leben', 'Persönlichkeitsentwicklung', 1),
('alltag_leben', 'Beziehung & Kommunikation', 2),
('alltag_leben', 'Finanzen (Privat)', 3),
('alltag_leben', 'Ordnung & Haushalt', 4),
('alltag_leben', 'Spiele & Kultur', 5),
('alltag_leben', 'Sonstiges Alltag', 6)
ON CONFLICT (area_id, name) DO NOTHING;

-- ============================================
-- 9. SEED DATA: SPECIALTIES (KINDER_JUGEND)
-- ============================================

-- fruehkind
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('fruehkind', 'Babyschwimmen', 1),
('fruehkind', 'Eltern-Kind-Turnen (Muki/Vaki)', 2),
('fruehkind', 'Musikgarten & Rhythmik', 3),
('fruehkind', 'Spielgruppen', 4),
('fruehkind', 'Kreatives für Kleinkinder', 5),
('fruehkind', 'Sonstiges Frühkind', 6)
ON CONFLICT (area_id, name) DO NOTHING;

-- schule_lernen
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('schule_lernen', 'Nachhilfe Mathe', 1),
('schule_lernen', 'Nachhilfe Sprachen', 2),
('schule_lernen', 'Nachhilfe Naturwissenschaften', 3),
('schule_lernen', 'Hausaufgabenbetreuung', 4),
('schule_lernen', 'Lerncoaching & Prüfungsvorbereitung', 5),
('schule_lernen', 'Vorbereitung Gymi/Lehre', 6),
('schule_lernen', 'Sonstiges Schule', 7)
ON CONFLICT (area_id, name) DO NOTHING;

-- freizeit_hobbys
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('freizeit_hobbys', 'Kinderturnen & Sport', 1),
('freizeit_hobbys', 'Kampfsport Kinder', 2),
('freizeit_hobbys', 'Tanzen Kinder', 3),
('freizeit_hobbys', 'Musik & Instrumente', 4),
('freizeit_hobbys', 'Malen & Basteln', 5),
('freizeit_hobbys', 'Theater & Zirkus', 6),
('freizeit_hobbys', 'Pfadi & Outdoor', 7),
('freizeit_hobbys', 'Sonstiges Hobbys', 8)
ON CONFLICT (area_id, name) DO NOTHING;

-- technik_medien
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('technik_medien', 'Programmieren & Games', 1),
('technik_medien', 'Robotik & Lego', 2),
('technik_medien', 'Medienkompetenz', 3),
('technik_medien', 'Foto & Video für Kids', 4),
('technik_medien', 'Sonstiges Technik', 5)
ON CONFLICT (area_id, name) DO NOTHING;

-- ferien
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('ferien', 'Sportcamps', 1),
('ferien', 'Kreativcamps', 2),
('ferien', 'Sprachcamps', 3),
('ferien', 'Outdoorlager', 4),
('ferien', 'Tagesbetreuung', 5),
('ferien', 'Sonstiges Ferien', 6)
ON CONFLICT (area_id, name) DO NOTHING;

-- eltern
INSERT INTO taxonomy_specialties (area_id, name, sort_order) VALUES
('eltern', 'Geburtsvorbereitung', 1),
('eltern', 'Erziehung & Entwicklung', 2),
('eltern', 'Erste Hilfe am Kind', 3),
('eltern', 'Familienleben', 4),
('eltern', 'Sonstiges Eltern', 5)
ON CONFLICT (area_id, name) DO NOTHING;

-- ============================================
-- 10. COMMENTS
-- ============================================

COMMENT ON TABLE taxonomy_types IS 'Level 1 categories: beruflich, privat_hobby, kinder_jugend';
COMMENT ON TABLE taxonomy_areas IS 'Level 2 categories: e.g. sport_fitness, musik, business_mgmt';
COMMENT ON TABLE taxonomy_specialties IS 'Level 3 categories: specific course topics like "Gitarre/Bass"';
