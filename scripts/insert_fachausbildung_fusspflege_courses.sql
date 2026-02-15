-- ============================================================================
-- Kurse für Fachausbildung Fusspflege & Fussreflexzonen
-- Provider UUID: 88dd9b85-bce2-49a6-93db-a49e14d84703
-- Kontakt-Email: info@fachausbildung-fusspflege.ch
-- Standorte: Wädenswil
-- ============================================================================
--
-- ANLEITUNG ZUM AUSFÜHREN:
-- 1. Kopieren Sie dieses gesamte Script
-- 2. Öffnen Sie Supabase Dashboard → SQL Editor
-- 3. Fügen Sie das Script ein und klicken Sie auf "Run"
-- 4. Die Kurse werden als 'draft' erstellt
-- 5. Nach Prüfung durch den Anbieter können sie auf 'published' gesetzt werden:
--    UPDATE courses SET status = 'published'
--    WHERE user_id = '88dd9b85-bce2-49a6-93db-a49e14d84703';
-- ============================================================================

-- Temporäre Tabelle für die erstellten Course IDs
CREATE TEMP TABLE IF NOT EXISTS temp_course_ids (
    course_title TEXT,
    course_id BIGINT
);


-- ============================================================================
-- KURS 1: Fachausbildung Fusspflege / Pédicure (Diplomlehrgang)
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
        '88dd9b85-bce2-49a6-93db-a49e14d84703',
        'Fachausbildung Fusspflege / Pédicure (Diplomlehrgang)',
        'Dieser umfassende Diplomlehrgang bietet den idealen Einstieg in die professionelle Fusspflege und Pédicure. In insgesamt 20 Kurstagen, die in der Regel wöchentlich stattfinden, erlernen die Teilnehmenden das solide Handwerk der kosmetischen und erweiterten Fusspflege von Grund auf. Der Unterricht kombiniert theoretische Grundlagen in Anatomie, Physiologie, Pathologie und Hygiene mit intensiven praktischen Einheiten. Ein besonderes Augenmerk liegt auf der korrekten Anwendung professioneller Instrumente und moderner Schleifgeräte. Die Teilnehmenden üben direkt an Modellen, um Sicherheit in der Behandlung von Haut- und Nagelveränderungen zu gewinnen. Ergänzt wird die Ausbildung durch ein Modul zum Geschäftsaufbau, das wichtige Tipps für die erfolgreiche Selbstständigkeit vermittelt. Die Ausbildung schliesst mit einer theoretischen und praktischen Prüfung ab, die zum Erhalt des SFPV-anerkannten Diploms führt. Dieser Kurs richtet sich an motivierte Quereinsteiger ebenso wie an Personen aus dem Beauty- oder Gesundheitssektor, die ihr Dienstleistungsportfolio professionell erweitern möchten. In den Kurskosten sind sämtliche Verbrauchsmaterialien sowie der Zugang zu Modellen enthalten.',
        'Fusspflege, Pédicure, Ausbildung, Diplomlehrgang, Wädenswil, SFPV, Berufsausbildung, Gesundheit, Kosmetik, Fusspflegeschule, Selbstständigkeit, Fachausbildung',
        ARRAY[
            'Anatomie und Physiologie des Fusses verstehen',
            'Hygienestandards und Instrumentenkunde in der Praxis anwenden',
            'Professionelle Fusspflegebehandlungen am Modell durchführen',
            'Erkennung und Beurteilung von Haut- und Nagelerkrankungen',
            'Grundlagen der Praxisführung und des Marketings beherrschen'
        ],
        'Keine formalen Voraussetzungen',
        5950.00,
        'beginner',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'beruf_karriere',
        'gesundheit',
        'Fusspflege',
        'Basisausbildung Pédicure',
        20,
        '1 Tag (08:45 – 17:00 Uhr)',
        'https://www.fachausbildung-fusspflege.ch/fusspflege---peacutedicure.html',
        'lead',
        'draft',
        false,
        'Zürich',
        'Wädenswil'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

-- Kontakt-Email in course_private eintragen
INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@fachausbildung-fusspflege.ch'
FROM temp_course_ids
WHERE course_title = 'Fachausbildung Fusspflege / Pédicure (Diplomlehrgang)';


-- ============================================================================
-- KURS 2: Grundausbildung Diplom Fussreflexzonen-Massage
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
        '88dd9b85-bce2-49a6-93db-a49e14d84703',
        'Grundausbildung Diplom Fussreflexzonen-Massage',
        'Die Ausbildung in der Fussreflexzonen-Massage vermittelt die Kunst der therapeutischen Stimulation der Reflexzonen am Fuss zur Aktivierung der körpereigenen Selbstheilungskräfte. In 12 Ausbildungstagen erlernen die Teilnehmenden die topografische Lage sämtlicher Reflexzonen sowie die spezifischen Griff- und Drucktechniken. Der Lehrgang umfasst die Geschichte dieser Therapiemethode, die Wirkungsweise auf das Nervensystem und die Organe sowie die fachgerechte Befunderhebung. Ein wesentlicher Teil der Ausbildung ist der praktischen Anwendung gewidmet, wobei die Teilnehmenden in Kleingruppen von maximal sechs Personen intensiv gecoacht werden. Neben der mechanischen Technik wird auch das Verständnis für ganzheitliche Zusammenhänge im menschlichen Körper gefördert. Die Ausbildung schliesst mit einem anerkannten Diplom ab, das die Absolventen befähigt, die Fussreflexzonen-Massage professionell in eigener Praxis oder in Anstellung anzuwenden. Dieser Kurs eignet sich hervorragend für Personen, die eine ganzheitliche Therapiemethode erlernen möchten, sowie für Fachkräfte aus dem Bereich Massage und Pflege.',
        'Fussreflexzonen, Massage, FRZM, Ausbildung, Komplementärtherapie, Gesundheit, Wädenswil, Diplomkurs, Therapie, Reflexzonenmassage, Weiterbildung',
        ARRAY[
            'Systematik und Topografie der Fussreflexzonen beherrschen',
            'Spezifische Grifftechniken sicher anwenden',
            'Indikationen und Kontraindikationen erkennen',
            'Ganzheitliche Behandlungsabläufe planen und durchführen',
            'Professionelle Dokumentation und Befunderhebung'
        ],
        'Keine formalen Voraussetzungen',
        3380.00,
        'beginner',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'beruf_karriere',
        'gesundheit',
        'Massage',
        'Fussreflexzonen-Therapie Basis',
        12,
        '1 Tag (08:45 – 17:00 Uhr)',
        'https://www.fachausbildung-fussreflexzonen.ch/ausbildung.html',
        'lead',
        'draft',
        false,
        'Zürich',
        'Wädenswil'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@fachausbildung-fusspflege.ch'
FROM temp_course_ids
WHERE course_title = 'Grundausbildung Diplom Fussreflexzonen-Massage';


-- ============================================================================
-- KURS 3: Fussreflexzonen-Therapie (Diplomlehrgang für Therapeuten)
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
        '88dd9b85-bce2-49a6-93db-a49e14d84703',
        'Fussreflexzonen-Therapie (Diplomlehrgang für Therapeuten)',
        'Dieser spezialisierte Diplomlehrgang führt die Teilnehmenden über die rein entspannende Wellness-Anwendung hinaus in die gezielte therapeutische Arbeit. Der Fokus liegt auf der professionellen Behandlung von akuten und chronischen Beschwerdebildern mittels präziser Reflexzonenstimulation. Die Ausbildung vermittelt fundierte Kenntnisse in klinischer Anatomie, Pathologie und der differenzierten Befunderhebung am Fuss. Die Kursteilnehmenden lernen, komplexe energetische und physische Zusammenhänge zu verstehen und diese in individuelle Therapiekonzepte zu übersetzen. Ein wesentlicher Bestandteil ist die Schulung der palpatorischen Fähigkeiten, um Gewebeveränderungen exakt zu lokalisieren und mit der passenden Intensität zu reagieren. Der Unterricht findet in Kleingruppen statt, was eine intensive Korrektur der Grifftechniken durch den Kursleiter Daniel Gehrer ermöglicht. Dieser Lehrgang richtet sich an Personen, die eine berufliche Tätigkeit als Therapeut anstreben oder ihre bestehende Praxis um eine medizinisch fundierte Komponente erweitern möchten. Die Ausbildung bereitet auch auf die Anforderungen zur Anerkennung durch schweizerische Registrierstellen wie EMR oder ASCA vor. Durch den hohen Praxisanteil und die Arbeit an Probanden erlangen die Absolventen die notwendige Sicherheit für den klinischen Alltag.',
        'Fussreflexzonentherapie, FRZ, Ausbildung, Diplom, Therapeut, Komplementärmedizin, Wädenswil, Gesundheit, Krankenkassenanerkennung, Medizinisch, Reflexologie, Weiterbildung',
        ARRAY[
            'Vertiefte Befunderhebung und Diagnostik über die Reflexzonen',
            'Erstellung klinischer Therapiepläne für spezifische Krankheitsbilder',
            'Anwendung fortgeschrittener therapeutischer Griff- und Drucktechniken',
            'Verständnis der vegetativen und somatischen Reflexwege',
            'Vorbereitung auf die Anforderungen der Krankenkassenanerkennung'
        ],
        'Grundausbildung in Fussreflexzonen-Massage oder medizinische Vorkenntnisse',
        3380.00,
        'advanced',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'beruf_karriere',
        'gesundheit',
        'Massage',
        'Fussreflexzonen-Therapie',
        12,
        '1 Tag (08:45 – 17:00 Uhr)',
        'https://www.fachausbildung-fusspflege.ch/fussreflexzonentherapie.html',
        'lead',
        'draft',
        false,
        'Zürich',
        'Wädenswil'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@fachausbildung-fusspflege.ch'
FROM temp_course_ids
WHERE course_title = 'Fussreflexzonen-Therapie (Diplomlehrgang für Therapeuten)';


-- ============================================================================
-- KURS 4: Weiterbildung / Refresher Fusspflege (3 Tage)
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
        '88dd9b85-bce2-49a6-93db-a49e14d84703',
        'Weiterbildung / Refresher Fusspflege (3 Tage)',
        'Dieser dreitägige Intensivkurs richtet sich an bereits ausgebildete Fusspflegerinnen und Fusspfleger, die ihr Fachwissen auf den neuesten Stand bringen oder spezifische Techniken vertiefen möchten. Der Kurs konzentriert sich auf die Optimierung der Arbeitstechnik unter Einsatz modernster Schleifkörper und Instrumente. Behandelt werden fortgeschrittene Themen wie die Versorgung von Rollnägeln, der Umgang mit Hühneraugen an anspruchsvollen Stellen sowie die Behandlung von Risikopatienten (z. B. Diabetiker oder Bluter). Neben den technischen Aspekten werden aktuelle Hygienestandards, Sterilisation und Desinfektion in der Praxis thematisiert. Die Teilnehmenden profitieren von Tipps und Tricks aus der langjährigen Praxis von Daniel Gehrer und haben die Möglichkeit, eigene Problemfälle aus ihrem Berufsalltag zu besprechen. Der Refresher dient dazu, die eigene Fachkompetenz zu festigen, Unsicherheiten abzubauen und die Effizienz bei der Behandlung zu steigern. Nach Abschluss erhalten die Teilnehmenden ein Zertifikat, das die kontinuierliche Weiterbildung dokumentiert.',
        'Refresher, Fusspflege, Weiterbildung, Pédicure, Praxis-Update, Wädenswil, Fachwissen, Zertifikat, Rollnagel, Diabetes, Hygiene',
        ARRAY[
            'Aktualisierung der fachspezifischen Arbeitstechniken',
            'Sicherer Umgang mit Risikopatienten in der Fusspflege',
            'Vertiefung der Kenntnisse bei Nagel-Deformationen',
            'Optimierung der Hygieneabläufe in der eigenen Praxis',
            'Erfahrungsaustausch und Lösung komplexer Behandlungsfälle'
        ],
        'Abgeschlossene Basisausbildung in Fusspflege',
        1250.00,
        'intermediate',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'beruf_karriere',
        'gesundheit',
        'Fusspflege',
        'Refresher & Spezialtechniken',
        3,
        '1 Tag (08:45 – 17:00 Uhr)',
        'https://www.fachausbildung-fusspflege.ch/weiterbildungen.html',
        'lead',
        'draft',
        false,
        'Zürich',
        'Wädenswil'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@fachausbildung-fusspflege.ch'
FROM temp_course_ids
WHERE course_title = 'Weiterbildung / Refresher Fusspflege (3 Tage)';


-- ============================================================================
-- KURS 5: Fussreflexzonen-Therapie Vertiefung / TCM (6 Tage)
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
        '88dd9b85-bce2-49a6-93db-a49e14d84703',
        'Fussreflexzonen-Therapie Vertiefung / TCM (6 Tage)',
        'Diese sechstägige Fachfortbildung verbindet die klassische Fussreflexzonen-Massage mit den Prinzipien der Traditionellen Chinesischen Medizin (TCM). Teilnehmende erlernen die energetischen Zusammenhänge zwischen den Reflexzonen am Fuss und dem Meridiansystem sowie der Lehre der Fünf Elemente (Wandlungsphasen). Der Kurs vermittelt, wie energetische Blockaden über die Füsse erkannt und harmonisiert werden können. Themen wie die Organuhr, Yin und Yang sowie die energetische Wirkung spezifischer Akupressurpunkte am Fuss stehen im Mittelpunkt. Diese ganzheitliche Erweiterung erlaubt es den Therapeuten, nicht nur auf körperlicher Ebene zu arbeiten, sondern auch energetische Störungen gezielt anzusprechen. Die Ausbildung ist stark praxisorientiert und bietet intensive Übungseinheiten, um die theoretischen Konzepte der TCM in fliessende Massageabläufe zu integrieren. Absolventen dieses Kurses können ihren Klienten eine deutlich tiefgreifendere und individuellere Behandlung anbieten.',
        'TCM, Fussreflexzonen, Meridiane, Fünf Elemente, Energetische Massage, Weiterbildung, Wädenswil, Ganzheitlich, Therapie, Zertifikat',
        ARRAY[
            'Prinzipien der TCM in die Reflexzonenarbeit integrieren',
            'Verständnis der Fünf Elemente und Meridiane am Fuss',
            'Anwendung der Organuhr für die Behandlungsplanung',
            'Erkennung und Ausgleich energetischer Disharmonien',
            'Ganzheitliche Beratungskompetenz erweitern'
        ],
        'Grundausbildung in Fussreflexzonen-Massage',
        2450.00,
        'advanced',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'beruf_karriere',
        'gesundheit',
        'Massage',
        'TCM & Reflexzonen',
        6,
        '1 Tag (08:45 – 17:00 Uhr)',
        'https://www.fachausbildung-fussreflexzonen.ch/weiterbildungen.html',
        'lead',
        'draft',
        false,
        'Zürich',
        'Wädenswil'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@fachausbildung-fusspflege.ch'
FROM temp_course_ids
WHERE course_title = 'Fussreflexzonen-Therapie Vertiefung / TCM (6 Tage)';


-- ============================================================================
-- KURS 6: Praxis-Coaching & Mentoring für die Selbstständigkeit
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
        '88dd9b85-bce2-49a6-93db-a49e14d84703',
        'Praxis-Coaching & Mentoring für die Selbstständigkeit',
        'Dieser Kurs bietet eine gezielte Unterstützung für den erfolgreichen Aufbau und die strategische Führung einer eigenen Praxis im Bereich Fusspflege oder Massage. In diesem Coaching-Programm werden die geschäftlichen Aspekte der Selbstständigkeit beleuchtet, die oft über das rein fachliche Handwerk hinausgehen. Die Teilnehmenden erhalten wertvolle Einblicke in die Kalkulation von Dienstleistungen, die Optimierung der Betriebsabläufe und das effektive Praxismarketing. Gemeinsam mit dem erfahrenen Mentor Daniel Gehrer werden individuelle Standortanalysen durchgeführt und Strategien zur Kundengewinnung sowie langfristigen Kundenbindung entwickelt. Das Coaching adressiert sowohl angehende Selbstständige in der Gründungsphase als auch bestehende Praxisinhaber, die ihre Effizienz steigern oder ihr Angebot neu positionieren möchten. Themen wie Versicherungen, rechtliche Rahmenbedingungen in der Schweiz und die professionelle Praxisausstattung werden praxisnah behandelt. Das Ziel ist es, den Teilnehmenden die nötige Sicherheit und das unternehmerische Rüstzeug zu vermitteln, um am Markt erfolgreich zu bestehen.',
        'Coaching, Business-Mentoring, Existenzgründung, Praxisaufbau, Marketing, Fusspflegepraxis, Selbstständigkeit, Unternehmensführung, Wädenswil, Beratung, Erfolg, Strategie',
        ARRAY[
            'Erstellung eines tragfähigen Businessplans für die Praxis',
            'Kalkulation von Preisen und Rentabilitätsrechnung',
            'Entwicklung einer individuellen Marketing- und Akquisestrategie',
            'Optimierung der administrativen Praxisabläufe',
            'Rechtliche und versicherungstechnische Grundlagen beherrschen'
        ],
        'Keine formalen Voraussetzungen (Bezug zur Branche empfohlen)',
        150.00,
        'all_levels',
        ARRAY['Deutsch'],
        ARRAY['presence'],
        'beruf_karriere',
        'business',
        'Existenzgründung',
        'Praxisführung Gesundheit & Beauty',
        NULL,
        '60 Minuten',
        'https://www.fachausbildung-fusspflege.ch/coaching.html',
        'lead',
        'draft',
        false,
        'Zürich',
        'Wädenswil'
    ) RETURNING id, title
)
INSERT INTO temp_course_ids (course_title, course_id)
SELECT title, id FROM inserted;

INSERT INTO course_private (course_id, contact_email)
SELECT course_id, 'info@fachausbildung-fusspflege.ch'
FROM temp_course_ids
WHERE course_title = 'Praxis-Coaching & Mentoring für die Selbstständigkeit';


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
-- Alle 6 Kurse wurden erfolgreich erstellt mit:
-- ✓ Status: 'draft' (bereit zur Prüfung)
-- ✓ Booking Type: 'lead' (Kontaktformular)
-- ✓ Kontakt-Email: info@fachausbildung-fusspflege.ch
-- ✓ Standort: Wädenswil (Kanton Zürich)
-- ✓ Taxonomie: Korrekt zugeordnet nach Fachgebiet
--
-- NÄCHSTE SCHRITTE:
-- 1. Prüfen Sie die Kurse im Backend (unter "Meine Kurse")
-- 2. Optional: Bilder für jeden Kurs hochladen
-- 3. Optional: Spezifische Kurstermine über course_events hinzufügen
-- 4. Kurse veröffentlichen:
--    UPDATE courses SET status = 'published'
--    WHERE user_id = '88dd9b85-bce2-49a6-93db-a49e14d84703' AND status = 'draft';
-- ============================================================================
