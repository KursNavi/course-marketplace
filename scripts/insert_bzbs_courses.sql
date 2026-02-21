-- ============================================
-- BZBS Kurse - Berufs- und Weiterbildungszentrum Buchs
-- Provider UUID: 8a6ea3e7-d3a7-4101-834f-7908f8a09e6f
-- Erstellt: 2026-02-21
-- ============================================

-- WICHTIG: Zuerst add_bzbs_categories.sql ausführen!

-- Hinweise:
-- - Alle Kurse sind "lead" Typ (Anfrage/Kontakt beim Anbieter)
-- - Preis ist pro Semester oder Gesamt (siehe Beschreibung)
-- - Level-Mapping: Einsteiger=beginner, Fortgeschritten=intermediate, Profi=advanced, Gemischt=all_levels
-- - Status: 'published' für sofortige Sichtbarkeit

-- ============================================
-- I. HÖHERE FACHSCHULE (HF)
-- ============================================

-- 1. Dipl. Betriebswirtschafter/in HF
-- Kategorie: Wirtschaft & Management > Unternehmensführung > Strategie & Nachfolge
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Dipl. Betriebswirtschafter/in HF',
    'Dieser Studiengang ist die höchste generalistische Ausbildung auf Stufe Höhere Fachschule. Er vermittelt umfassende Kompetenzen in der strategischen und operativen Unternehmensführung. Die Teilnehmenden werden befähigt, komplexe betriebswirtschaftliche Fragestellungen zu analysieren und nachhaltige Lösungen für KMU oder Grossbetriebe zu entwickeln. Der Fokus liegt auf der Vernetzung von Finanzwesen, Marketing, Personalmanagement und Recht. Dauer: 3 Jahre (6 Semester), ca. 900 Lektionen. Preis: CHF 2''600 pro Semester.',
    ARRAY['Ganzheitliche Unternehmensführung verstehen und anwenden', 'Strategische Projekte planen und erfolgreich umsetzen', 'Führungskompetenzen in Teams und Abteilungen stärken'],
    'Management, Betriebswirtschaft, HF, Führung, Strategie, KMU, Diplom, Buchs',
    'EFZ im kaufmännischen Bereich oder gleichwertig; einschlägige Berufserfahrung.',
    'beruflich',
    'wirtschaft_management',
    'Unternehmensführung',
    'Professionell | Wirtschaft & Management | Unternehmensführung',
    2,  -- Unternehmensführung
    4,  -- Strategie & Nachfolge
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/hoehere-fachschule/dipl-betriebswirtschafter-in-hf',
    'published',
    2600.00,
    NULL,
    NULL
);

-- 2. Dipl. Wirtschaftsinformatiker/in HF
-- Kategorie: IT & Digitales > Wirtschaftsinformatik > IT-Business Engineering
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Dipl. Wirtschaftsinformatiker/in HF',
    'An der Schnittstelle zwischen Business und IT konzipiert dieser Lehrgang Fachkräfte, die Geschäftsprozesse mittels moderner Informations- und Kommunikationstechnologien optimieren. Die Studierenden lernen, IT-Strategien zu entwickeln, Software-Projekte zu leiten und die digitale Transformation in Organisationen voranzutreiben. Es werden sowohl tiefe IT-Kenntnisse als auch betriebswirtschaftliches Know-how vermittelt. Dauer: 3 Jahre (6 Semester), ca. 950 Lektionen. Preis: CHF 2''600 pro Semester.',
    ARRAY['Gestaltung und Management digitaler Geschäftsprozesse', 'Leitung von IT-Projekten unter Berücksichtigung der Wirtschaftlichkeit', 'Analyse und Design von Informationssystemen'],
    'Wirtschaftsinformatik, IT-Management, Digitalisierung, HF, Projektleitung, Software',
    'EFZ in Informatik/Mediamatik oder kaufmännisch mit IT-Praxis.',
    'beruflich',
    'it_digitales',
    'Wirtschaftsinformatik',
    'Professionell | IT & Digitales | Wirtschaftsinformatik',
    58, -- Wirtschaftsinformatik (NEU)
    97, -- IT-Business Engineering (NEU)
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/hoehere-fachschule/dipl-wirtschaftsinformatiker-in-hf',
    'published',
    2600.00,
    NULL,
    NULL
);

-- 3. Dipl. Techniker/in HF Unternehmensprozesse
-- Kategorie: Technik & Bau > Produktion & Logistik > Prozessoptimierung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Dipl. Techniker/in HF Unternehmensprozesse',
    'Dieser Lehrgang fokussiert auf die Optimierung der Wertschöpfungskette in Industrie- und Dienstleistungsbetrieben. Die Teilnehmenden erwerben Spezialwissen in Logistik, Produktionsplanung, Qualitätsmanagement und Prozessengineering. Ziel ist es, Abläufe effizienter zu gestalten und die Wettbewerbsfähigkeit von Unternehmen durch technisches und organisatorisches Know-how zu steigern. Dauer: 3 Jahre (6 Semester), ca. 1000 Lektionen. Preis: CHF 2''800 pro Semester.',
    ARRAY['Analyse und Optimierung betrieblicher Abläufe', 'Implementierung von Qualitätsmanagementsystemen', 'Leitung von logistischen und produktionstechnischen Abteilungen'],
    'Technik, Prozessmanagement, Logistik, Qualität, HF, Produktion, Engineering',
    'Technisches EFZ und einschlägige Berufspraxis.',
    'beruflich',
    'technik_bau',
    'Produktion & Logistik',
    'Professionell | Technik & Bau | Produktion & Logistik',
    60, -- Produktion & Logistik (NEU)
    102, -- Prozessoptimierung (NEU)
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/hoehere-fachschule/dipl-techniker-in-hf-unternehmensprozesse',
    'published',
    2800.00,
    NULL,
    NULL
);

-- 4. Dipl. Agrotechniker/in HF (Standort Salez)
-- Kategorie: Landwirtschaft > Agrarwirtschaft > Betriebsführung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Dipl. Agrotechniker/in HF (Standort Salez)',
    'Der Lehrgang verbindet landwirtschaftliches Expertenwissen mit moderner Unternehmensführung. Er bereitet auf anspruchsvolle Führungsaufgaben in der Agrarbranche und in vor- oder nachgelagerten Betrieben vor. Die Ausbildung umfasst Pflanzenbau, Tierhaltung sowie Agrarpolitik, Marketing und Betriebswirtschaft auf hohem Niveau. Dauer: 3 Jahre (6 Semester), ca. 1470 Lektionen. Preis: CHF 800 Semestergebühr für Schweizer Wohnhafte.',
    ARRAY['Strategische Führung von Landwirtschaftsbetrieben', 'Entwicklung nachhaltiger landwirtschaftlicher Produktionssysteme', 'Fachberatung und Management in der Agro-Industrie'],
    'Landwirtschaft, Agrotechnik, Salez, Management, Agrarwirtschaft, HF, Natur',
    'Landwirtschaftliches EFZ; Berufsprüfung teilweise integriert.',
    'beruflich',
    'landwirtschaft',
    'Agrarwirtschaft',
    'Professionell | Landwirtschaft | Agrarwirtschaft',
    61, -- Agrarwirtschaft (NEU)
    105, -- Betriebsführung (NEU)
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/landwirtschaft/dipl-agrotechniker-in-hf',
    'published',
    800.00,
    NULL,
    NULL
);

-- ============================================
-- II. EIDG. FACHAUSWEISE & BERUFSPRÜFUNGEN
-- ============================================

-- 5. Technische/r Kaufmann/frau mit eidg. Fachausweis
-- Kategorie: Wirtschaft & Management > Unternehmensführung > Leadership & Teamführung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Technische/r Kaufmann/frau mit eidg. Fachausweis',
    'Diese Weiterbildung ist die klassische Brücke für Berufsleute aus handwerklichen oder technischen Berufen in das Management. Sie vermittelt die kaufmännischen Grundlagen, die für die Führung eines eigenen Betriebs oder für eine Kaderstelle in einem Industrieunternehmen nötig sind. Themen sind unter anderem Marketing, Recht, Finanzwesen und Führung. Dauer: 3-4 Semester, ca. 480 Lektionen. Preis: CHF 2''450 pro Semester.',
    ARRAY['Erwerb fundierter kaufmännischer Fachkenntnisse', 'Vorbereitung auf Führungsaufgaben an der Schnittstelle Technik/Wirtschaft', 'Befähigung zur Leitung von Projekten und Abteilungen'],
    'Technischer Kaufmann, Management, Fachausweis, Weiterbildung, Führung',
    'Technisches EFZ und Praxisjahre.',
    'beruflich',
    'wirtschaft_management',
    'Unternehmensführung',
    'Professionell | Wirtschaft & Management | Unternehmensführung',
    2,  -- Unternehmensführung
    5,  -- Leadership & Teamführung
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/technische-kaufleute',
    'published',
    2450.00,
    NULL,
    NULL
);

-- 6. Führungsfachmann/-frau mit eidg. Fachausweis (SVF)
-- Kategorie: Wirtschaft & Management > Unternehmensführung > Leadership & Teamführung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Führungsfachmann/-frau mit eidg. Fachausweis (SVF)',
    'Im Zentrum stehen die Führung von Personen und Teams sowie das Management von Abteilungen. Der Lehrgang basiert auf den Modulen der Schweizerischen Vereinigung für Führungsausbildung (SVF) und deckt Selbstkenntnis, Kommunikation, Konfliktmanagement und Personalführung ab. Dauer: 2-3 Semester, ca. 240 Lektionen. Preis: CHF 2''100 pro Semester.',
    ARRAY['Entwicklung der eigenen Führungspersönlichkeit', 'Effektive Teamführung und Konfliktlösung', 'Beherrschung betriebswirtschaftlicher Führungsinstrumente'],
    'Leadership, Führung, SVF, Management, Teamleitung, Fachausweis',
    'Führungserfahrung von Vorteil; Abschluss Sekundarstufe II.',
    'beruflich',
    'wirtschaft_management',
    'Unternehmensführung',
    'Professionell | Wirtschaft & Management | Unternehmensführung',
    2,  -- Unternehmensführung
    5,  -- Leadership & Teamführung
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/fuehrung-und-personal',
    'published',
    2100.00,
    NULL,
    NULL
);

-- 7. HR-Fachmann/-frau mit eidg. Fachausweis
-- Kategorie: Bildung & Soziales > HR & Personalwesen > HR Fachausweis
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'HR-Fachmann/-frau mit eidg. Fachausweis',
    'Spezialisierte Ausbildung für das Personalmanagement. Die Teilnehmenden vertiefen ihr Wissen in Personalmarketing, Gewinnung, Entwicklung, Entlöhnung und Trennung von Mitarbeitenden sowie im Arbeitsrecht und Sozialversicherungen. Dauer: 2-3 Semester, ca. 320 Lektionen. Preis: CHF 2''300 pro Semester.',
    ARRAY['Professionelle Begleitung des gesamten Employee Lifecycles', 'Anwendung von arbeitsrechtlichen Grundlagen', 'Beratung von Linienvorgesetzten in HR-Fragen'],
    'HR, Personalwesen, Recruiting, Arbeitsrecht, Fachausweis, Human Resources',
    'Zertifikat Sachbearbeiter/in Personalwesen und Praxis.',
    'beruflich',
    'bildung_soziales',
    'HR & Personalwesen',
    'Professionell | Bildung & Soziales | HR & Personalwesen',
    57, -- HR & Personalwesen (NEU)
    95, -- HR Fachausweis (NEU)
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/fuehrung-und-personal',
    'published',
    2300.00,
    NULL,
    NULL
);

-- 8. Holzbau Vorarbeiter/in mit eidg. Fachausweis
-- Kategorie: Technik & Bau > Bauwesen > Holzbau
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Holzbau Vorarbeiter/in mit eidg. Fachausweis',
    'Ausbildung für Berufsleute im Holzbau, die Führungsaufgaben auf Baustellen übernehmen. Fokus auf Technik, AVOR und Teamführung im Zimmererhandwerk. Dauer: 1 Jahr. Preis: CHF 7''400 gesamt.',
    ARRAY['Baustellenorganisation und AVOR', 'Führung von Montagegruppen'],
    'Holzbau, Vorarbeiter, Bau, Fachausweis, Zimmerer',
    'EFZ Zimmermann/Zimmerin.',
    'beruflich',
    'technik_bau',
    'Bauwesen',
    'Professionell | Technik & Bau | Bauwesen',
    59, -- Bauwesen (NEU)
    99, -- Holzbau (NEU)
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/technik-und-bau/bau',
    'published',
    7400.00,
    NULL,
    NULL
);

-- ============================================
-- III. SACHBEARBEITUNG & HANDEL (ZERTIFIKATE)
-- ============================================

-- 9. Handelsdiplom BZBS
-- Kategorie: Wirtschaft & Management > Administration & Handel > Handelsdiplom
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Handelsdiplom BZBS',
    'Kompakter Einstieg in die kaufmännische Welt für Quereinsteiger. Vermittlung von Basiswissen in Büroorganisation, Korrespondenz, Buchhaltung und Informatik. Dauer: 2 Semester, ca. 264 Lektionen. Preis: CHF 1''850 pro Semester.',
    ARRAY['Erwerb kaufmännischer Grundkompetenzen für administrative Tätigkeiten'],
    'Handelsdiplom, Quereinstieg, Büro, Administration, Wirtschaft',
    'Abgeschlossene Berufslehre beliebig.',
    'beruflich',
    'wirtschaft_management',
    'Administration & Handel',
    'Professionell | Wirtschaft & Management | Administration & Handel',
    55, -- Administration & Handel (NEU)
    92, -- Handelsdiplom (NEU)
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/administration-und-verwaltung',
    'published',
    1850.00,
    NULL,
    NULL
);

-- 10. Sachbearbeiter/in Rechnungswesen kv edupool
-- Kategorie: Finanzen & Recht > Rechnungswesen & Buchhaltung > Sachbearbeitung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Sachbearbeiter/in Rechnungswesen kv edupool',
    'Vertiefte Ausbildung in der Finanzbuchhaltung, Mehrwertsteuer und Sozialversicherungen. Ideal für Personen, die in der Buchhaltung arbeiten möchten. Dauer: 2 Semester, ca. 140 Lektionen. Preis: CHF 2''290 pro Semester.',
    ARRAY['Selbstständige Führung einfacher Buchhaltungen und Abschlüsse'],
    'Buchhaltung, Rechnungswesen, edupool, Finanzen, Sachbearbeiter',
    'Kaufmännische Grundkenntnisse.',
    'beruflich',
    'finanzen_recht',
    'Rechnungswesen & Buchhaltung',
    'Professionell | Finanzen & Recht | Rechnungswesen & Buchhaltung',
    56, -- Rechnungswesen & Buchhaltung (NEU)
    94, -- Sachbearbeitung (NEU)
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/finanz-und-rechnungswesen',
    'published',
    2290.00,
    NULL,
    NULL
);

-- 11. Sachbearbeiter/in Personalwesen kv edupool
-- Kategorie: Bildung & Soziales > HR & Personalwesen > Sachbearbeitung Personal
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Sachbearbeiter/in Personalwesen kv edupool',
    'Fokus auf die administrative Personalarbeit. Grundlagen der Personaladministration und Lohnabrechnung. Dauer: 1 Semester, ca. 120 Lektionen. Preis: CHF 1''950 gesamt.',
    ARRAY['Unterstützung der HR-Leitung in allen administrativen Belangen'],
    'HR, Personaladministration, Lohn, edupool, Sachbearbeiter',
    'Kaufmännische Grundbildung.',
    'beruflich',
    'bildung_soziales',
    'HR & Personalwesen',
    'Professionell | Bildung & Soziales | HR & Personalwesen',
    57, -- HR & Personalwesen (NEU)
    96, -- Sachbearbeitung Personal (NEU)
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/fuehrung-und-personal',
    'published',
    1950.00,
    NULL,
    NULL
);

-- 12. Marketing- & Verkaufsfachleute (Basiskurs)
-- Kategorie: Wirtschaft & Management > Marketing & Verkauf > Digital Marketing
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Marketing- & Verkaufsfachleute (Basiskurs)',
    'Einstieg in die Welt des Marketings und des professionellen Verkaufs. Fokus auf Instrumente des Marketing-Mix. Dauer: 1 Semester, ca. 80 Lektionen. Preis: CHF 1''600.',
    ARRAY['Verständnis für Marktmechanismen und Kundenansprache'],
    'Marketing, Verkauf, Akquise, Werbung, Kommunikation',
    'Interesse an Marktkommunikation.',
    'beruflich',
    'wirtschaft_management',
    'Marketing & Verkauf',
    'Professionell | Wirtschaft & Management | Marketing & Verkauf',
    3,  -- Marketing & Verkauf
    7,  -- Sales & Verhandlung
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/marketing-verkauf',
    'published',
    1600.00,
    NULL,
    NULL
);

-- ============================================
-- IV. INFORMATIK & KI
-- ============================================

-- 13. Informatik-Anwender/in SIZ (Gesamtlehrgang)
-- Kategorie: IT & Digitales > Digitale Kollaboration > Transformation & Tools
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Informatik-Anwender/in SIZ (Gesamtlehrgang)',
    'Umfassende Ausbildung in den wichtigsten Office-Programmen (Word, Excel, PowerPoint) sowie Betriebssystemgrundlagen nach SIZ-Standard. Dauer: 2 Semester, ca. 120 Lektionen. Preis: CHF 1''800 (variabel je nach Modulwahl).',
    ARRAY['Effiziente Nutzung der Office-Palette im beruflichen Alltag'],
    'SIZ, Office, Word, Excel, IT-Grundlagen, Computer-Kurs',
    'Keine.',
    'beruflich',
    'it_digitales',
    'Digitale Kollaboration',
    'Professionell | IT & Digitales | Digitale Kollaboration',
    11, -- Digitale Kollaboration
    23, -- Transformation & Tools
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/informatik',
    'published',
    1800.00,
    NULL,
    NULL
);

-- 14. KI in der Praxis (Modulserie)
-- Kategorie: IT & Digitales > Daten & KI > KI-Anwendung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'KI in der Praxis (Modulserie)',
    'Kompakter Kurs zur Anwendung von KI-Tools wie ChatGPT, Midjourney & Co. im Berufsalltag zur Effizienzsteigerung. Dauer: 2 Tage, ca. 16 Lektionen. Preis: CHF 560.',
    ARRAY['Prompting-Techniken beherrschen und KI-Workflows integrieren'],
    'KI, ChatGPT, Prompting, Automation, Künstliche Intelligenz',
    'Sicherer Umgang mit dem PC.',
    'beruflich',
    'it_digitales',
    'Daten & KI',
    'Professionell | IT & Digitales | Daten & KI',
    10, -- Daten & KI
    22, -- KI-Anwendung
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/informatik/ki',
    'published',
    560.00,
    NULL,
    NULL
);

-- 15. Web-Design & Digital Marketing
-- Kategorie: Wirtschaft & Management > Marketing & Verkauf > Digital Marketing
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Web-Design & Digital Marketing',
    'Grundlagen der Webseitenerstellung (CMS) und der digitalen Vermarktung (SEO, Social Media). Dauer: 10 Abende, ca. 40 Lektionen. Preis: CHF 1''250.',
    ARRAY['Erstellung einfacher Webseiten und Verständnis für Online-Sichtbarkeit'],
    'Webdesign, SEO, Social Media, WordPress, Digital Marketing',
    'IT-Grundkenntnisse.',
    'beruflich',
    'wirtschaft_management',
    'Marketing & Verkauf',
    'Professionell | Wirtschaft & Management | Marketing & Verkauf',
    3,  -- Marketing & Verkauf
    6,  -- Digital Marketing
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/informatik',
    'published',
    1250.00,
    NULL,
    NULL
);

-- ============================================
-- V. SPRACHEN
-- ============================================

-- 16. Deutsch als Fremdsprache (Niveaus A1 bis C2)
-- Kategorie: Sprachen > Deutsch > Basis & Grammatik
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Deutsch als Fremdsprache (Niveaus A1 bis C2)',
    'Systematische Sprachförderung für fremdsprachige Erwachsene. Vorbereitung auf telc-Zertifikate, die für Einbürgerung oder Beruf nötig sind. Dauer: 1-2 Semester pro Niveau, ca. 96 Lektionen. Preis: CHF 864 pro Semester.',
    ARRAY['Sicherheit in Kommunikation, Grammatik und Hörverstehen auf dem jeweiligen Zielniveau'],
    'Deutsch, DaF, Integration, telc, Sprachkurs, Buchs',
    'Einstufungstest.',
    'privat_hobby',
    'sprachen',
    'Deutsch',
    'Privat | Sprachen | Deutsch',
    16, -- Deutsch
    28, -- Basis & Grammatik
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/sprachen/deutsch',
    'published',
    864.00,
    NULL,
    NULL
);

-- 17. Englisch für Beruf & Freizeit (A1 bis C1)
-- Kategorie: Sprachen > Englisch > Basis & Grammatik
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Englisch für Beruf & Freizeit (A1 bis C1)',
    'Von den Grundlagen bis zum Business-Englisch. Vorbereitung auf Cambridge-Zertifikate möglich. Dauer: 1 Semester, ca. 48 Lektionen. Preis: CHF 750 pro Semester.',
    ARRAY['Aktive Sprachbeherrschung für Reise und Business'],
    'Englisch, Cambridge, Business English, Sprachen',
    'Einstufungstest.',
    'privat_hobby',
    'sprachen',
    'Englisch',
    'Privat | Sprachen | Englisch',
    17, -- Englisch
    30, -- Basis & Grammatik
    'all_levels',
    ARRAY['Englisch', 'Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/sprachen/englisch',
    'published',
    750.00,
    NULL,
    NULL
);

-- 18. Romanische Sprachen (Französisch, Italienisch, Spanisch)
-- Kategorie: Sprachen > Diverse Sprachen > Einzelsprachen
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Romanische Sprachen (Französisch, Italienisch, Spanisch)',
    'Konversations- und Grundkurse in den wichtigsten europäischen Sprachen. Fokus auf Alltagsanwendung. Dauer: 1 Semester, ca. 32 Lektionen. Preis: CHF 680 pro Semester.',
    ARRAY['Aufbau von Wortschatz und Grammatik für den Urlaub oder einfache Geschäftskontakte'],
    'Französisch, Italienisch, Spanisch, Sprachen, Konversation',
    'Keine bis Vorkenntnisse.',
    'privat_hobby',
    'sprachen',
    'Diverse Sprachen',
    'Privat | Sprachen | Diverse Sprachen',
    21, -- Diverse Sprachen
    38, -- Einzelsprachen
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/sprachen',
    'published',
    680.00,
    NULL,
    NULL
);

-- ============================================
-- VI. LANDWIRTSCHAFT & NATUR (SALEZ)
-- ============================================

-- 19. Bäuerin mit eidg. Fachausweis
-- Kategorie: Landwirtschaft > Hauswirtschaft > Bäuerliche Hauswirtschaft
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Bäuerin mit eidg. Fachausweis',
    'Umfassende Ausbildung für die Führung des bäuerlichen Haushalts und die Mitarbeit/Leitung im Landwirtschaftsbetrieb. Beinhaltet Ernährung, Gartenbau, Buchhaltung und Recht. Dauer: 1-2 Jahre, ca. 300 Lektionen (modularer Aufbau). Preis auf Anfrage.',
    ARRAY['Professionelle Haushaltsführung und unternehmerische Begleitung des Hofes'],
    'Bäuerin, Landwirtschaft, Hauswirtschaft, Salez, Fachausweis',
    'Basismodule Hauswirtschaft.',
    'beruflich',
    'landwirtschaft',
    'Hauswirtschaft',
    'Professionell | Landwirtschaft | Hauswirtschaft',
    62, -- Hauswirtschaft (NEU)
    109, -- Bäuerliche Hauswirtschaft (NEU)
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/landwirtschaft',
    'published',
    NULL,
    NULL,
    NULL
);

-- 20. Kräuter-Akademie (Zertifikatslehrgang)
-- Kategorie: Landwirtschaft > Naturkunde & Kräuter > Heilpflanzen & Kräuter
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Kräuter-Akademie (Zertifikatslehrgang)',
    'Fachwissen über Wild- und Heilkräuter, deren Anbau, Ernte und Verarbeitung zu Produkten. Dauer: 1 Jahr (monatliche Samstage), ca. 80 Lektionen. Preis: CHF 2''400 für alle Module.',
    ARRAY['Bestimmung von Pflanzen und Herstellung von Salben, Tees und Tinkturen'],
    'Kräuter, Natur, Heilpflanzen, Salez, Handwerk',
    'Keine.',
    'privat_hobby',
    'landwirtschaft',
    'Naturkunde & Kräuter',
    'Privat | Landwirtschaft | Naturkunde & Kräuter',
    63, -- Naturkunde & Kräuter (NEU)
    111, -- Heilpflanzen & Kräuter (NEU)
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/landwirtschaft/natur',
    'published',
    2400.00,
    NULL,
    NULL
);

-- 21. Landwirtschaftliche Modulausbildung (Direktzahlungs-Kurs)
-- Kategorie: Landwirtschaft > Agrarwirtschaft > Direktzahlungsberechtigung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Landwirtschaftliche Modulausbildung (Direktzahlungs-Kurs)',
    'Kompakter Kurs für Personen, die einen Betrieb übernehmen wollen und den Nachweis für den Erhalt von Direktzahlungen benötigen. Dauer: 1 Jahr (Blockkurse), ca. 360 Lektionen. Preis: CHF 4''500.',
    ARRAY['Grundkenntnisse in Pflanzenbau, Tierhaltung und Agrarrecht'],
    'Landwirtschaft, Quereinstieg, Direktzahlungen, Bauernhof',
    'Nicht-landwirtschaftliches EFZ.',
    'beruflich',
    'landwirtschaft',
    'Agrarwirtschaft',
    'Professionell | Landwirtschaft | Agrarwirtschaft',
    61, -- Agrarwirtschaft (NEU)
    108, -- Direktzahlungsberechtigung (NEU)
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/landwirtschaft',
    'published',
    4500.00,
    NULL,
    NULL
);

-- ============================================
-- VII. PÄDAGOGIK & COACHING
-- ============================================

-- 22. SVEB-Zertifikat Kursleiter/in (Modul 1)
-- Kategorie: Bildung & Soziales > Berufsbildung > Ausbildung (BB-Kurse)
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'SVEB-Zertifikat Kursleiter/in (Modul 1)',
    'Die Basisausbildung für alle, die in der Erwachsenenbildung unterrichten möchten. Fokus auf Methodik und Didaktik. Dauer: 1 Semester, ca. 90 Lektionen. Preis: CHF 3''450.',
    ARRAY['Planung und Durchführung von Lernveranstaltungen für Erwachsene'],
    'SVEB, Erwachsenenbildung, Didaktik, Ausbilder, Coaching',
    'Fachkenntnisse im eigenen Gebiet.',
    'beruflich',
    'bildung_soziales',
    'Berufsbildung',
    'Professionell | Bildung & Soziales | Berufsbildung',
    8,  -- Berufsbildung
    17, -- Ausbildung (BB-Kurse)
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/paedagogik',
    'published',
    3450.00,
    NULL,
    NULL
);

-- 23. Berufsbildner/in-Kurs (5 Tage)
-- Kategorie: Bildung & Soziales > Berufsbildung > Ausbildung (BB-Kurse)
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Berufsbildner/in-Kurs (5 Tage)',
    'Gesetzlich vorgeschriebener Kurs für alle, die Lehrlinge in Betrieben ausbilden. Dauer: 5 Tage, ca. 40 Lektionen. Preis: CHF 650.',
    ARRAY['Umgang mit Jugendlichen, rechtliche Rahmenbedingungen der Lehre'],
    'Berufsbildner, Lehrlingsausbilder, Lehre, Pädagogik',
    'EFZ und 2 Jahre Praxis.',
    'beruflich',
    'bildung_soziales',
    'Berufsbildung',
    'Professionell | Bildung & Soziales | Berufsbildung',
    8,  -- Berufsbildung
    17, -- Ausbildung (BB-Kurse)
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/paedagogik',
    'published',
    650.00,
    NULL,
    NULL
);

-- 24. Personal Coach BZBS (Diplomlehrgang)
-- Kategorie: Bildung & Soziales > Coaching & Beratung > Prozessbegleitung
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Personal Coach BZBS (Diplomlehrgang)',
    'Ausbildung in systemischem Coaching. Befähigung zur Begleitung von Menschen in Veränderungsprozessen. Dauer: 1 Jahr, ca. 160 Lektionen. Preis: CHF 5''680.',
    ARRAY['Anwendung von Coaching-Tools und Gesprächsführungstechniken'],
    'Coaching, Mentoring, Psychologie, Beratung, Personal Coach',
    'Abgeschlossene Ausbildung, Lebenserfahrung.',
    'beruflich',
    'bildung_soziales',
    'Coaching & Beratung',
    'Professionell | Bildung & Soziales | Coaching & Beratung',
    9,  -- Coaching & Beratung
    19, -- Prozessbegleitung
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/personal-und-fuehrung',
    'published',
    5680.00,
    NULL,
    NULL
);

-- 25. Kommunikation & Rhetorik (Seminar)
-- Kategorie: Soft Skills > Kommunikation > Auftritt & Rhetorik
-- ============================================
INSERT INTO courses (
    user_id,
    title,
    description,
    objectives,
    keywords,
    prerequisites,
    category_type,
    category_area,
    category_specialty,
    category,
    category_level3_id,
    category_level4_id,
    level,
    languages,
    delivery_types,
    booking_type,
    provider_url,
    status,
    price,
    session_count,
    session_length
) VALUES (
    '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f',
    'Kommunikation & Rhetorik (Seminar)',
    'Training für wirkungsvolles Auftreten und Gesprächsführung. Dauer: 2 Tage, ca. 16 Lektionen. Preis: CHF 450.',
    ARRAY['Sicherheit in Präsentationen und schwierigen Gesprächen gewinnen'],
    'Rhetorik, Kommunikation, Auftrittskompetenz, Soft Skills',
    'Keine.',
    'beruflich',
    'soft_skills',
    'Kommunikation',
    'Professionell | Soft Skills | Kommunikation',
    37, -- Kommunikation
    65, -- Auftritt & Rhetorik
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.bzbs.ch/weiterbildung/wirtschaft/seminare',
    'published',
    450.00,
    NULL,
    NULL
);

-- ============================================
-- VERIFICATION
-- ============================================
-- Nach Ausführung prüfen:
-- SELECT COUNT(*) FROM courses WHERE user_id = '8a6ea3e7-d3a7-4101-834f-7908f8a09e6f';
-- Erwartet: 25 neue Kurse
