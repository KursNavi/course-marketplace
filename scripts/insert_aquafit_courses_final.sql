-- ============================================================================
-- Kurse für AquaFit4You / AquaTime - FINALISIERTES SCRIPT
-- Provider UUID: a731e532-6d5a-4140-8d10-ac11db4680d1
-- Kontakt-Email: info@aquafit4you.ch
-- Standorte: Zürich, St. Gallen, Obwalden (als Kantone eingetragen)
-- ============================================================================
--
-- ANLEITUNG ZUM AUSFÜHREN:
-- 1. Kopieren Sie dieses gesamte Script
-- 2. Öffnen Sie Supabase Dashboard → SQL Editor
-- 3. Fügen Sie das Script ein und klicken Sie auf "Run"
-- 4. Die Kurse werden als 'draft' erstellt
-- 5. Nach Prüfung durch den Anbieter können sie auf 'published' gesetzt werden:
--    UPDATE courses SET status = 'published'
--    WHERE user_id = 'a731e532-6d5a-4140-8d10-ac11db4680d1';
-- ============================================================================

-- Temporäre Tabelle für die erstellten Course IDs
CREATE TEMP TABLE IF NOT EXISTS temp_course_ids (
    course_title TEXT,
    course_id BIGINT
);


-- ============================================================================
-- KURS 1: AquaMama – Fitness in der Schwangerschaft
-- ============================================================================
WITH inserted AS (
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
        is_pro,
        canton,
        address
    ) VALUES (
        'a731e532-6d5a-4140-8d10-ac11db4680d1',
        'AquaMama – Fitness in der Schwangerschaft',
        'AquaMama ist ein spezialisiertes Bewegungsprogramm im Wasser, das exakt auf die körperlichen Bedürfnisse während der Schwangerschaft zugeschnitten ist. Das Training nutzt den natürlichen Auftrieb des Wassers, um das mit fortschreitender Schwangerschaft zunehmende Körpergewicht abzufangen und so den Rücken, die Bandscheiben sowie die Gelenke der werdenden Mutter spürbar zu entlasten. Die Übungen kombinieren ein sanftes Herz-Kreislauf-Training mit gezielten Kräftigungseinheiten für den gesamten Körper, wobei ein besonderer Fokus auf der Beweglichkeit und der Vorbereitung auf die Geburt liegt. Durch den Wasserdruck wird zudem der Rückstrom des Blutes zum Herzen unterstützt, was Schwellungen in den Beinen entgegenwirken kann. Neben dem physischen Aspekt bietet das warme Wasser einen Raum für Entspannung und fördert das allgemeine Wohlbefinden sowie die Bindung zum ungeborenen Kind. Der Kurs dient als ideale Ergänzung zur klassischen Geburtsvorbereitung an Land und ermöglicht den Austausch mit anderen Schwangeren in einem geschützten, professionell geleiteten Rahmen.',
        'Schwangerschaft, Aqua-Fitness, Pränatal, Wassergymnastik, Geburtsvorbereitung, Rückenschmerzen, Fitness für Schwangere, Entspannung, Gesundheit, Zürich, St. Gallen, Obwalden, Wasserübungen, Wellness',
        ARRAY[
            'Entlastung der Wirbelsäule und der Gelenke durch den Wasserauftrieb',
            'Sanfte Kräftigung der Rumpf- und Beckenmuskulatur',
            'Förderung der Durchblutung und Reduktion von Wassereinlagerungen',
            'Verbesserung der Atemtechnik und Entspannungsfähigkeit für die Geburt'
        ],
        'Ab der 15. Schwangerschaftswoche empfohlen; Rücksprache mit der Hebamme oder dem Gynäkologen ist sinnvoll.',
        NULL,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'privat_hobby',
        'sport_fitness',
        'Wassersport',
        NULL,
        6,
        '45 - 60 Minuten pro Lektion (fortlaufendes Abo)',
        'https://aquafit4you.ch/aqua-mama/',
        'lead',
        'draft',
        false,
        'Zürich, St. Gallen, Obwalden',
        'Zürich, St. Gallen, Sarnen'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

-- Kontakt-Email in course_private eintragen
INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@aquafit4you.ch'
FROM temp_course_ids
WHERE course_title = 'AquaMama – Fitness in der Schwangerschaft';


-- ============================================================================
-- KURS 2: Kinderschwimmen (Grundlagentests 1-7: Krebs bis Eisbär)
-- ============================================================================
WITH inserted AS (
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
        is_pro,
        canton,
        address
    ) VALUES (
        'a731e532-6d5a-4140-8d10-ac11db4680d1',
        'Kinderschwimmen (Grundlagentests 1-7: Krebs bis Eisbär)',
        'Die Kinderschwimmkurse von AquaTime basieren auf dem bewährten Schweizer Ausbildungssystem von Swimsports.ch und begleiten Kinder spielerisch von der ersten Wassergewöhnung bis hin zum sicheren Schwimmen. In den sieben Grundlagentests – beginnend beim "Krebs" für die Jüngsten bis hin zum "Eisbär" für fortgeschrittene Schwimmer – werden die Kinder stufengerecht gefördert. Im Fokus stehen zunächst das Vertrauen zum Element Wasser, das Tauchen, das Atmen und das Schweben. Mit zunehmendem Niveau werden die technischen Grundlagen der verschiedenen Schwimmstile wie Crawl, Rückencrawl und Brustschwimmen sowie die koordinativen Fähigkeiten systematisch aufgebaut. Der Unterricht findet in Kleingruppen statt, was eine intensive Betreuung und eine hohe Sicherheit gewährleistet. Jede Stufe schliesst mit einem offiziellen Abzeichen ab, das den Lernfortschritt dokumentiert und die Motivation der Kinder steigert.',
        'Kinderschwimmen, Schwimmkurs, Wassergewöhnung, Krebs, Seepferd, Frosch, Pinguin, Tintenfisch, Krokodil, Eisbär, Swimsports, Kinder, Zürich, Schwimmabzeichen',
        ARRAY[
            'Sichere Wassergewöhnung und Abbau von Ängsten',
            'Beherrschung der Kern- und Basiselemente (Atmen, Schweben, Gleiten, Antreiben)',
            'Erlernen technischer Grundlagen in Crawl, Rücken und Brust',
            'Erfolgreicher Abschluss der jeweiligen Teststufen (Abzeichen)'
        ],
        'Stufengerechter Einstieg: Krebs ab ca. 4 Jahren; höhere Stufen erfordern das Bestehen der vorangehenden Tests.',
        NULL,
        'beginner',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'kinder_jugend',
        'freizeit_hobbys',
        'Kinderturnen & Sport',
        NULL,
        10,
        '30 - 45 Minuten pro Lektion (Quartalskurs)',
        'https://aquatime.ch/kinderschwimmen/',
        'lead',
        'draft',
        false,
        'Zürich, St. Gallen, Obwalden',
        'Zürich, St. Gallen, Sarnen'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@aquafit4you.ch'
FROM temp_course_ids
WHERE course_title = 'Kinderschwimmen (Grundlagentests 1-7: Krebs bis Eisbär)';


-- ============================================================================
-- KURS 3: Erwachsenenschwimmen (Technik & Training)
-- ============================================================================
WITH inserted AS (
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
        is_pro,
        canton,
        address
    ) VALUES (
        'a731e532-6d5a-4140-8d10-ac11db4680d1',
        'Erwachsenenschwimmen (Technik & Training)',
        'Dieser Kurs richtet sich an Erwachsene, die ihre Schwimmtechnik von Grund auf lernen oder bestehende Kenntnisse verfeinern möchten. Viele Erwachsene haben den Wunsch, effizienter zu schwimmen, sei es aus gesundheitlichen Gründen, zur Vorbereitung auf einen Triathlon oder um sich im Wasser einfach sicherer zu fühlen. Der Unterricht deckt ein breites Spektrum ab: von der Angstüberwindung für Späteinsteiger bis hin zur Optimierung der Wasserlage und der Atemtechnik beim Crawlschwimmen. Durch gezielte Korrekturen und moderne Trainingsmethoden wird der Wasserwiderstand minimiert und der Vortrieb verbessert, was das Schwimmen deutlich kraftsparender macht. Neben der Technikschulung fliessen auch Elemente der Trainingslehre ein, um die Ausdauer im Wasser zu steigern.',
        'Erwachsenenschwimmen, Crawlkurs, Schwimmtechnik, Ausdauertraining, Sport, Fitness, Schwimmen lernen, Technikoptimierung, Gesundheit, Zürich, Triathlonvorbereitung',
        ARRAY[
            'Verbesserung der Wasserlage und Gleitfähigkeit',
            'Erlernen oder Optimieren der Crawl- und Atemtechnik',
            'Steigerung der Ausdauer und Kraft im Wasser',
            'Abbau von Unsicherheiten in tiefem Wasser'
        ],
        'Keine formalen Voraussetzungen; für Technikkurse sind Grundkenntnisse im Schwimmen von Vorteil.',
        NULL,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'privat_hobby',
        'sport_fitness',
        'Wassersport',
        NULL,
        NULL,
        '45 - 60 Minuten pro Lektion (Blockkurse oder fortlaufend)',
        'https://aquatime.ch/erwachsenenschwimmen/',
        'lead',
        'draft',
        false,
        'Zürich, St. Gallen, Obwalden',
        'Zürich, St. Gallen, Sarnen'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@aquafit4you.ch'
FROM temp_course_ids
WHERE course_title = 'Erwachsenenschwimmen (Technik & Training)';


-- ============================================================================
-- KURS 4: Aqua Yoga
-- ============================================================================
WITH inserted AS (
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
        is_pro,
        canton,
        address
    ) VALUES (
        'a731e532-6d5a-4140-8d10-ac11db4680d1',
        'Aqua Yoga',
        'Aqua Yoga überträgt die klassischen Prinzipien des Yoga in das Element Wasser und schafft dadurch eine völlig neue Erfahrung von Balance und Kraft. Durch den Widerstand des Wassers wird für die Ausführung der Asanas eine deutlich höhere Muskelaktivität benötigt als an Land, während gleichzeitig der Auftrieb dabei hilft, komplexe Halteübungen gelenkschonender durchzuführen. Der Fokus dieses Kurses liegt auf der Verbesserung der Körperwahrnehmung, der Verfeinerung der Körperspannung und der bewussten Verbindung von Bewegung und Atmung. Die Übungen werden im stehtiefen Wasser absolviert, was zusätzliche Sicherheit gibt. Aqua Yoga wirkt besonders harmonisierend auf das Nervensystem und hilft dabei, mentalen Stress abzubauen, während die tiefliegende Muskulatur effektiv gestärkt wird.',
        'Yoga, Wasser-Yoga, Entspannung, Körperwahrnehmung, Achtsamkeit, Aqua-Fitness, Stretching, Balance, Mentale Gesundheit, Gelenkschonend, Ganzkörpertraining, Wellness, Zürich',
        ARRAY[
            'Verbesserung der Balance und Koordination im Wasser',
            'Stärkung der tiefliegenden Stützmuskulatur',
            'Förderung der Flexibilität durch sanftes Stretching',
            'Stressabbau durch bewusste Atemführung'
        ],
        'Keine formalen Voraussetzungen.',
        NULL,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'privat_hobby',
        'sport_fitness',
        'Wassersport',
        NULL,
        NULL,
        '45 - 60 Minuten pro Lektion',
        'https://aquafit4you.ch/aqua-yoga/',
        'lead',
        'draft',
        false,
        'Zürich, St. Gallen, Obwalden',
        'Zürich, St. Gallen, Sarnen'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@aquafit4you.ch'
FROM temp_course_ids
WHERE course_title = 'Aqua Yoga';


-- ============================================================================
-- KURS 5: Privatunterricht Schwimmen (Kinder & Erwachsene)
-- ============================================================================
WITH inserted AS (
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
        is_pro,
        canton,
        address
    ) VALUES (
        'a731e532-6d5a-4140-8d10-ac11db4680d1',
        'Privatunterricht Schwimmen (Kinder & Erwachsene)',
        'Der Privatunterricht bietet die effizienteste Form des Lernens, da die Instruktion zu 100 % auf die individuellen Bedürfnisse und das Tempo des Teilnehmenden ausgerichtet ist. Dieses Format eignet sich hervorragend für Kinder, die in Gruppenkursen schnell abgelenkt sind oder eine besonders intensive Betreuung benötigen, um Ängste zu überwinden. Ebenso profitieren Erwachsene, die gezielt an einem bestimmten Schwimmstil arbeiten oder innerhalb kürzester Zeit sichtbare Fortschritte erzielen möchten. Die Lektionen werden flexibel gestaltet: von der ersten Wassergewöhnung über die Vorbereitung auf spezifische Schwimmtests bis hin zum High-Performance-Coaching für sportlich ambitionierte Schwimmer. Durch das direkte Feedback des Lehrpersonals können technische Fehler sofort korrigiert und Bewegungsabläufe präzise eingeschliffen werden.',
        'Privatunterricht, Schwimmlehrer, Coaching, Einzelunterricht, Schwimmen lernen, Techniktraining, Individuell, Kinder, Erwachsene, Zürich, Wasserangst, Effizienz',
        ARRAY[
            'Individuelle Zielerreichung (z.B. Testabschluss oder Stilverbesserung)',
            'Schnelle Überwindung von Wasserängsten durch 1-zu-1 Betreuung',
            'Präzise technische Korrektur der Schwimmbewegungen',
            'Erhöhung der persönlichen Sicherheit und Effizienz im Wasser'
        ],
        'Keine formalen Voraussetzungen.',
        NULL,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'privat_hobby',
        'sport_fitness',
        'Wassersport',
        NULL,
        NULL,
        '30, 45 oder 60 Minuten nach Vereinbarung',
        'https://aquatime.ch/privatunterricht/',
        'lead',
        'draft',
        false,
        'Zürich, St. Gallen, Obwalden',
        'Zürich, St. Gallen, Sarnen'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@aquafit4you.ch'
FROM temp_course_ids
WHERE course_title = 'Privatunterricht Schwimmen (Kinder & Erwachsene)';


-- ============================================================================
-- KURS 6: Aqua Pilates
-- ============================================================================
WITH inserted AS (
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
        is_pro,
        canton,
        address
    ) VALUES (
        'a731e532-6d5a-4140-8d10-ac11db4680d1',
        'Aqua Pilates',
        'Aqua Pilates kombiniert die präzisen Kräftigungsmethoden des klassischen Pilates mit der dynamischen Kraft des Wassers. Im Zentrum des Trainings steht das "Powerhouse" – die Aktivierung der tiefen Bauch-, Rücken- und Beckenbodenmuskulatur. Durch die Instabilität des Wassers wird der Körper ständig dazu gefordert, kleine Ausgleichsbewegungen zu machen, was die Koordination und die Feinstabilität der Wirbelsäule massiv verbessert. Der Kurs bietet zwei verschiedene Ansätze: Während "AquaPilates CLASSIC" auf die Kräftigung und Haltung abzielt, fokussiert "AquaPilates AI CHI" auf langsame, fliessende Bewegungen zur Förderung der inneren Ruhe und Entspannung. Die Übungen werden kontrolliert und in Verbindung mit einer spezifischen Atemtechnik ausgeführt, was die Konzentrationsfähigkeit schult und zu einer verbesserten Körperhaltung führt.',
        'Pilates, Aqua Pilates, Rumpfstabilität, Beckenboden, Rückentraining, Haltungskorrektur, Core-Training, Kraftausdauer, Ai Chi, Gelenkschonend, Fitness, Gesundheit, Zürich',
        ARRAY[
            'Stärkung des Powerhouse (Rumpfstabilität)',
            'Verbesserung der Körperhaltung und Wirbelsäulenmobilität',
            'Förderung der Konzentration und Atemkontrolle',
            'Steigerung der muskulären Ausdauer'
        ],
        'Keine formalen Voraussetzungen.',
        NULL,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'privat_hobby',
        'sport_fitness',
        'Wassersport',
        NULL,
        NULL,
        '45 - 60 Minuten pro Lektion',
        'https://aquafit4you.ch/aqua-pilates/',
        'lead',
        'draft',
        false,
        'Zürich, St. Gallen, Obwalden',
        'Zürich, St. Gallen, Sarnen'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@aquafit4you.ch'
FROM temp_course_ids
WHERE course_title = 'Aqua Pilates';


-- ============================================================================
-- ZUSAMMENFASSUNG: Übersicht der erstellten Kurse
-- ============================================================================
SELECT
    course_title AS "Kurstitel",
    course_id AS "Course ID (UUID)"
FROM temp_course_ids
ORDER BY course_title;

-- ============================================================================
-- FERTIG!
-- ============================================================================
--
-- Alle 6 Kurse wurden erfolgreich erstellt mit:
-- ✓ Status: 'draft' (bereit zur Prüfung)
-- ✓ Booking Type: 'lead' (Kontaktformular)
-- ✓ Kontakt-Email: info@aquafit4you.ch
-- ✓ Standorte: Zürich, St. Gallen, Obwalden
-- ✓ Taxonomie: Korrekt zugeordnet
--
-- NÄCHSTE SCHRITTE:
-- 1. Prüfen Sie die Kurse im Backend (unter "Meine Kurse")
-- 2. Optional: Bilder für jeden Kurs hochladen
-- 3. Optional: Spezifische Kurstermine über course_events hinzufügen
-- 4. Kurse veröffentlichen:
--    UPDATE courses SET status = 'published'
--    WHERE user_id = 'a731e532-6d5a-4140-8d10-ac11db4680d1' AND status = 'draft';
-- ============================================================================
