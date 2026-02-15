-- ============================================
-- INSERT COURSES FOR KINDERKOMPETENZCOACHING
-- Provider UUID: 17cd33fc-f180-4f26-b585-06512cc62536
-- ============================================
-- Run this script in Supabase SQL Editor

-- 1. Weiterbildung KinderKompetenzCoach (online)
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '17cd33fc-f180-4f26-b585-06512cc62536',
    'Weiterbildung KinderKompetenzCoach (online)',
    'Die Weiterbildung qualifiziert zur Arbeit als Kindercoach mit einem strukturierten, ganzheitlichen Vorgehen im Einzel- oder Kursformat. Sie ist in 12 Module gegliedert: Von der Reflexion der eigenen Coach-Haltung über Entspannungsverfahren, Stress- und Resilienzarbeit, Selbstwert- und Konfliktkompetenz bis hin zu Lebensfreude, Mentaltraining, Motivation und Zielumsetzung.

Weitere Schwerpunkte sind Kommunikationstraining sowie Elternunterstützung, damit Coaching-Tools auch im Elternkontext nutzbar werden. Ein eigenes Modul widmet sich der Positionierung und dem Selbstmarketing, bevor im Abschlussmodul eine eigene Kinder- oder Jugendcoaching-Sitzung bzw. Seminareinheit didaktisch geplant, präsentiert und im Rahmen einer Prüfungssequenz umgesetzt wird.

Begleitend sind pro Modul Übungs- und Vertiefungszeiten vorgesehen sowie ein individuelles Einzelcoaching/Intensivtraining. Die Inhalte eignen sich sowohl für den Aufbau einer eigenen Praxis als auch als Ergänzung für pädagogische, therapeutische oder trainingsbezogene Tätigkeiten mit Kindern.',
    'Kindercoaching, Coaching-Ausbildung, Resilienz, Stressbewältigung, Entspannung, Selbstwert, Konfliktkompetenz, Mentaltraining, Motivation, Kommunikation, Elternarbeit, Online-Weiterbildung',
    ARRAY['Professionelle Coaching-Haltung reflektieren und anwenden', 'Kindgerechte Entspannungs- und Stressregulationsmethoden einsetzen', 'Resilienzstrategien für Kinder anleiten und transferieren', 'Selbstwert und Selbstvertrauen stärken mit passenden Übungen', 'Konflikt- und Mobbingsituationen strukturiert bearbeiten', 'Mentale Techniken für Fokus, Mut und Leistungsdruck vermitteln', 'Motivation, Ziele und Umsetzungspläne altersgerecht erarbeiten', 'Kommunikationskompetenz (Kind/Eltern) methodisch erweitern', 'Eltern mit Coaching-Tools zur Kinderunterstützung begleiten', 'Eine Coaching-Sitzung bzw. Seminareinheit konzipieren, präsentieren und evaluieren'],
    'Keine formalen Voraussetzungen',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['online'],
    'beruflich',
    'bildung_pruefung',
    'Lerncoaching (Beruflich)',
    NULL,
    36,
    'Modulwochenende: 2 Halbtage (Sa/So 8:30–13:00), Übungseinheit: 90 Min, Einzelcoaching: 30 Min',
    'https://www.kinderkompetenzcoaching.de/weiterbildungsinhalte/',
    'lead',
    'draft',
    false
);

-- 2. Weiterbildung Kinder&JugendKompetenzCoach (online)
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '17cd33fc-f180-4f26-b585-06512cc62536',
    'Weiterbildung Kinder- und JugendKompetenzCoach (online)',
    'Diese Weiterbildung richtet sich an Personen, die Kinder und Jugendliche coachend begleiten und dazu ein breites Methodenset sicher und altersgerecht anwenden möchten – auch im beruflichen Alltag. Die Ausbildung umfasst 12 Module mit Themen wie Coach-Haltung, Entspannung, Stressbewältigung und Resilienz, Selbstwertstärkung, Konflikt- und Mobbingkompetenz, Förderung von Lebensfreude, Mentaltraining, Motivation und Zielarbeit sowie Kommunikation.

Ergänzend werden Tools für die Zusammenarbeit mit Eltern vermittelt, damit Begleitung auch in herausfordernden Familiensituationen möglich wird. Im Modul zur Selbständigkeit stehen Positionierung und Selbstmarketing im Fokus. Den Abschluss bildet eine Prüfungssequenz, in der eine eigene Coaching-Sitzung oder Kinder-/Jugendseminareinheit konzipiert, präsentiert und reflektiert wird.

Gegenüber der KinderKompetenzCoach-Variante beinhaltet jedes Modul zusätzliche Vertiefungstermine, um die Umsetzung mit Jugendlichen gezielt zu trainieren. Pro Modul sind ausserdem Übungs- und individuelle Einzeltrainings vorgesehen.',
    'Jugendcoaching, Kindercoaching, Coaching-Ausbildung, Resilienz, Mentaltraining, Stressmanagement, Selbstwert, Mobbingprävention, Konfliktlösung, Motivation, Kommunikation, Elterncoaching-Tools, Online-Ausbildung',
    ARRAY['Coaching-Methoden altersgerecht für Jugendliche adaptieren', 'Stress- und Emotionsregulation in herausfordernden Phasen anleiten', 'Selbstwert, Identität und Ressourcenarbeit gezielt fördern', 'Konflikte, Gruppendynamiken und Mobbing professionell bearbeiten', 'Mentale Stärke und Leistungsdruck-Kompetenz vermitteln', 'Motivation, Zielklärung und Umsetzungsstrategien trainieren', 'Kommunikation mit Jugendlichen und Eltern situationsgerecht gestalten', 'Übungs- und Vertiefungsformate strukturiert in die Praxis übertragen', 'Eigene Coaching- bzw. Seminareinheit konzipieren, präsentieren und evaluieren'],
    'Keine formalen Voraussetzungen',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['online'],
    'beruflich',
    'bildung_pruefung',
    'Lerncoaching (Beruflich)',
    NULL,
    72,
    'Modulwochenende: 2 Halbtage (Sa/So 8:30–13:00), Vertiefung: 90 Min, Übung: 90 Min, Einzelcoaching: 30 Min',
    'https://www.kinderkompetenzcoaching.de/weiterbildungsinhalte/',
    'lead',
    'draft',
    false
);

-- ============================================
-- VERIFY INSERTED COURSES
-- ============================================
-- SELECT id, title, price, category_area, category_specialty
-- FROM courses
-- WHERE user_id = '17cd33fc-f180-4f26-b585-06512cc62536'
-- ORDER BY created_at DESC;
