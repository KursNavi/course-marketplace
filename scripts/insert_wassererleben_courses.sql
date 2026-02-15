-- ============================================================================
-- Kurse für WasserErleben (Iris Augsburger Methode)
-- Provider UUID: 2051d540-43e2-4b51-be1e-1f7c6e769b6f
-- Kontakt-Email: info@wassererleben.ch
-- Standorte: Bern
-- ============================================================================
--
-- ANLEITUNG ZUM AUSFÜHREN:
-- 1. Kopieren Sie dieses gesamte Script
-- 2. Öffnen Sie Supabase Dashboard → SQL Editor
-- 3. Fügen Sie das Script ein und klicken Sie auf "Run"
-- 4. Die Kurse werden als 'draft' erstellt
-- 5. Nach Prüfung durch den Anbieter können sie auf 'published' gesetzt werden:
--    UPDATE courses SET status = 'published'
--    WHERE user_id = '2051d540-43e2-4b51-be1e-1f7c6e769b6f';
-- ============================================================================

-- Temporäre Tabelle für die erstellten Course IDs
CREATE TEMP TABLE IF NOT EXISTS temp_course_ids (
    course_title TEXT,
    course_id BIGINT
);


-- ============================================================================
-- KURS 1: Babyschwimmen ab 10 Wochen (First Flow)
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
        '2051d540-43e2-4b51-be1e-1f7c6e769b6f',
        'Babyschwimmen ab 10 Wochen (First Flow)',
        'Das First Flow Babyschwimmen ermöglicht Säuglingen ab der zehnten Lebenswoche einen sanften und freudvollen Einstieg in die Welt des Wassers. Unter Anwendung der Methode Iris Augsburger wird die natürliche Bewegungsfreude genutzt, um die motorische und kognitive Entwicklung des Kindes ganzheitlich zu unterstützen. Im Zentrum steht die Stärkung der Eltern-Kind-Bindung durch gemeinsame Erlebnisse und gezielte, sinnvolle Übungen im 32 Grad warmen Wasser. Das Programm verzichtet bewusst auf Gruppenzwang und setzt stattdessen auf individuelle Förderung, die das Selbstvertrauen des Babys nachhaltig stärkt. Neben der Kräftigung der Atemmuskulatur und des Immunsystems lernen die Kinder spielerisch, sich sicher im Wasser zu bewegen. Die Kurse finden in kleinen Gruppen statt, was eine ruhige Atmosphäre und maximale Sicherheit garantiert. Für Eltern bietet der Kurs zudem wertvolle Tipps zur Wassergewöhnung und zum sicheren Handling ihres Kindes im nassen Element. Es ist der ideale Weg, um bereits im frühesten Alter die Basis für eine lebenslange Wassersicherheit und Freude an der Bewegung zu legen.',
        'Babyschwimmen, First Flow, Wassergewöhnung, Eltern-Kind-Bindung, Iris Augsburger, Säuglingsschwimmen, Motorikförderung, Immunstärkung, Schweiz, Schwimmkurs Baby, Bern',
        ARRAY[
            'Aufbau von Vertrauen und Sicherheit im Element Wasser',
            'Förderung der Grobmotorik und Koordinationsfähigkeit',
            'Kräftigung der Atemmuskulatur und des Immunsystems',
            'Intensive Stärkung der Bindung zwischen Eltern und Kind',
            'Spielerische Wassergewöhnung ohne Leistungsdruck'
        ],
        'Das Baby muss mindestens 10 Wochen alt und gesund sein (kein Fieber oder Durchfall).',
        NULL,
        'beginner',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'kinder_jugend',
        'sport_fitness',
        'Wassersport',
        NULL,
        8,
        '30 - 45 Minuten pro Lektion',
        'https://www.wassererleben.ch/de/babyschwimmen-ab-10-wochen/',
        'lead',
        'draft',
        false,
        'Bern',
        'Bern'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

-- Kontakt-Email in course_private eintragen
INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@wassererleben.ch'
FROM temp_course_ids
WHERE course_title = 'Babyschwimmen ab 10 Wochen (First Flow)';


-- ============================================================================
-- KURS 2: Kinderschwimmen ab 4 Jahren (Let's Swim)
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
        '2051d540-43e2-4b51-be1e-1f7c6e769b6f',
        'Kinderschwimmen ab 4 Jahren (Let''s Swim)',
        'In den Let''s Swim Kursen lernen Kinder zwischen 4 und 8 Jahren das Schwimmen auf eine völlig neue, druckfreie Art und Weise. Basierend auf der Methode Iris Augsburger werden alle vier Schwimmtechniken – Delfin, Rücken, Brust und Kraul – von Beginn an parallel geübt, um eine vielseitige und korrekte Bewegungskompetenz zu entwickeln. Anstatt auf das Erreichen von Abzeichen zu fokussieren, steht der individuelle Fortschritt und der Spass im Vordergrund, was zu einem raschen und nachhaltigen Lernerfolg führt. Die Kinder bewegen sich in homogenen Altersgruppen und werden von professionell ausgebildeten Coaches betreut, die als Vorbild agieren und jedes Kind seinen Fähigkeiten entsprechend fördern. Durch die intensive 60-minütige Unterrichtszeit kommen die Teilnehmenden in einen Lernfluss, der ihre Ausdauer, Kraft und Koordination massiv steigert. Die Kurse sind so konzipiert, dass keine Wartezeiten am Beckenrand entstehen, sodass die Kinder die gesamte Lektion über aktiv bleiben. Das Ziel ist es, den Kindern ein gesundes Selbstbewusstsein im Wasser zu vermitteln und sie zu sicheren, kompetenten Schwimmern auszubilden, die sich in jeder Situation im Wasser wohlfühlen.',
        'Kinderschwimmen, Let''s Swim, Schwimmunterricht, Crawl lernen, Brustschwimmen, Iris Augsburger, Wassersicherheit Kinder, Schwimmschule, Sport für Kinder, Schwimmen ohne Abzeichen, Bern',
        ARRAY[
            'Erlernen der Grundtechniken von Kraul, Brust, Rücken und Delfin',
            'Förderung der Ausdauer, Kraft und koordinativen Fähigkeiten',
            'Aufbau von gesundem Selbstvertrauen im tiefen Wasser',
            'Entwicklung einer sicheren und effizienten Schwimmtechnik',
            'Freude an der sportlichen Betätigung ohne Prüfungsdruck'
        ],
        'Keine formalen Voraussetzungen; Alter zwischen 4 und 8 Jahren.',
        NULL,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'kinder_jugend',
        'sport_fitness',
        'Wassersport',
        NULL,
        7,
        '60 Minuten pro Lektion',
        'https://www.wassererleben.ch/de/kinderschwimmen-ab-4-jahren/',
        'lead',
        'draft',
        false,
        'Bern',
        'Bern'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@wassererleben.ch'
FROM temp_course_ids
WHERE course_title = 'Kinderschwimmen ab 4 Jahren (Let''s Swim)';


-- ============================================================================
-- KURS 3: Wassergymnastik für Senior:innen (Drop In)
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
        '2051d540-43e2-4b51-be1e-1f7c6e769b6f',
        'Wassergymnastik für Senior:innen (Drop In)',
        'Drop In bietet innovative Wassergymnastik, die speziell auf die Bedürfnisse und die Lebensfreude von Senior:innen zugeschnitten ist. Das Training im schultertiefen Wasser nutzt den Auftrieb zur Entlastung der Gelenke, während der Wasserwiderstand effektiv zur Kräftigung der Muskulatur und zur Verbesserung der Ausdauer eingesetzt wird. Ein zentrales Element der Kurse ist die eigens komponierte Musik, die den Rhythmus vorgibt und für eine motivierende Atmosphäre sorgt, in der man Raum und Zeit vergisst. Die Intensität der Übungen kann von jeder teilnehmenden Person selbst bestimmt werden, was ein altersgerechtes Training ohne Überforderung ermöglicht. Neben der physischen Komponente, wie der Erhaltung der Mobilität und der Verlangsamung des Alterungsprozesses, steht der soziale Aspekt und das gemeinsame Erfolgserlebnis im Team im Mittelpunkt. Die Übungen schulen zudem die koordinativen Fähigkeiten wie Gleichgewicht und Reaktion, was die Sicherheit im Alltag massiv erhöht. Es sind keine Vorkenntnisse in Aquafit erforderlich; der Kurs heisst alle willkommen, die sich mit Freude und Gleichgesinnten im Element Wasser fit halten möchten.',
        'Wassergymnastik, Senior:innen, Drop In, Aquafit, Mobilitätstraining, Gelenkschonend, Fit im Alter, Iris Augsburger, Gesundheitssport, Wassersport Senioren, Bern',
        ARRAY[
            'Erhaltung und Verbesserung der allgemeinen Mobilität und Beweglichkeit',
            'Gelenkschonende Kräftigung des gesamten Bewegungsapparates',
            'Förderung der koordinativen Fähigkeiten (Gleichgewicht, Reaktion)',
            'Stärkung des Herz-Kreislauf-Systems und der Durchblutung',
            'Steigerung der Lebensfreude durch Bewegung zur Musik in der Gruppe'
        ],
        'Keine formalen Voraussetzungen oder Vorkenntnisse nötig.',
        NULL,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'privat_hobby',
        'sport_fitness',
        'Gesundheit & Wellness',
        NULL,
        NULL,
        '50 Minuten pro Lektion (fortlaufend / Semesterkurse)',
        'https://www.wassererleben.ch/de/wassergymnastikkurse-fuer-seniorinnen/1133/',
        'lead',
        'draft',
        false,
        'Bern',
        'Bern'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@wassererleben.ch'
FROM temp_course_ids
WHERE course_title = 'Wassergymnastik für Senior:innen (Drop In)';


-- ============================================================================
-- ZUSAMMENFASSUNG: Übersicht der erstellten Kurse
-- ============================================================================
SELECT
    course_title AS "Kurstitel",
    course_id AS "Course ID"
FROM temp_course_ids
ORDER BY course_title;

-- ============================================================================
-- FERTIG!
-- ============================================================================
--
-- Alle 3 Kurse wurden erfolgreich erstellt mit:
-- ✓ Status: 'draft' (bereit zur Prüfung)
-- ✓ Booking Type: 'lead' (Kontaktformular)
-- ✓ Kontakt-Email: info@wassererleben.ch
-- ✓ Standort: Bern
-- ✓ Taxonomie: Korrekt zugeordnet nach Iris Augsburger Methode
--
-- NÄCHSTE SCHRITTE:
-- 1. Prüfen Sie die Kurse im Backend (unter "Meine Kurse")
-- 2. Optional: Bilder für jeden Kurs hochladen
-- 3. Optional: Spezifische Kurstermine über course_events hinzufügen
-- 4. Kurse veröffentlichen:
--    UPDATE courses SET status = 'published'
--    WHERE user_id = '2051d540-43e2-4b51-be1e-1f7c6e769b6f' AND status = 'draft';
-- ============================================================================
