-- ============================================
-- IFFP Kurse - Institut für Finanzplanung
-- Provider UUID: 9feacc90-d14e-4def-b160-d2f2648b6cc2
-- Erstellt: 2026-02-17
-- ============================================

-- Hinweise:
-- - Alle Kurse sind "lead" Typ (Anfrage/Kontakt beim Anbieter)
-- - Preis, Lektionen, Dauer sind "offen" (NULL) da auf Anbieter-Website
-- - Status: 'published' für sofortige Sichtbarkeit
-- - Kategorien basieren auf bestehender Taxonomie (beruflich > finanzen / industrie_bau / hr_recht)

-- ============================================
-- 1. Zert. Vermögensberater/in IAF
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Zert. Vermögensberater/in IAF (Kenntnisnachweis FIDLEG)',
    'Der Lehrgang vermittelt eine strukturierte Grundlage für die Beratung von Privatkundschaft zu Kapitalanlagen im Kontext der Schweizer Regulierung. Im Zentrum stehen Kernprinzipien der Anlageberatung, ein sauberes Vorgehen in der Kundenanalyse sowie das nachvollziehbare Ableiten von Empfehlungen. Du arbeitest dich durch typische Beratungsabläufe – von der Erhebung von Zielen, Risikofähigkeit und Risikobereitschaft bis zur Dokumentation und Begründung von Vorschlägen. Ergänzend werden praxisnahe Fallkonstellationen eingesetzt, damit du Entscheidungen zu Produkten, Portfolio-Logik und Kundengesprächen begründen kannst. Der Kurs eignet sich für Personen, die in Banken, Versicherungen oder vermögensnahen Rollen Kundschaft beraten (oder dies anstreben) und einen formal anschlussfähigen Kompetenznachweis benötigen. Format und Prüfungsvorbereitung sind so angelegt, dass du das Gelernte direkt in Beratungsgesprächen anwenden und sauber protokollieren kannst.',
    ARRAY['Kundenprofil, Ziele und Risikoparameter strukturiert erfassen', 'Anlagevorschläge nachvollziehbar begründen und dokumentieren', 'Regulatorische Anforderungen im Beratungsprozess berücksichtigen', 'Typische Kundensituationen mit Falllogik bearbeiten'],
    'Vermögensberatung, Anlageberatung, FIDLEG, Kenntnisnachweis, Privatkunden, Risikoprofil, Portfolio, Dokumentation, Anlageprozess, Finanzmarkt',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/zert-vermoegensberater-in-iaf',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 2. Versicherungsvermittler/in VBV
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Versicherungsvermittler/in VBV (neues VAG)',
    'Dieser Lehrgang bereitet auf die Qualifikation als Versicherungsvermittler/in gemäss den aktuellen Anforderungen vor und unterstützt dich dabei, Beratungssituationen fachlich korrekt und kundenorientiert zu führen. Inhaltlich geht es um die Grundlagen der Versicherungsvermittlung sowie um die Fähigkeit, Kundensituationen zu analysieren, geeignete Lösungen zu erklären und Risiken transparent darzustellen. Je nach Ausrichtung werden unterschiedliche Profile abgedeckt (z. B. Leben, Nichtleben, Krankenzusatzversicherung oder Allbranche), sodass du die Inhalte auf dein Tätigkeitsfeld ausrichten kannst. Der Aufbau ist so gestaltet, dass du sowohl fachliche Grundlagen als auch anwendungsbezogene Kompetenzen trainierst – etwa das strukturierte Begründen von Empfehlungen, den Umgang mit Einwänden und die saubere Dokumentation. Zielgruppe sind Personen, die neu in die Vermittlung einsteigen oder ihre Qualifikation an das neue Regime anpassen möchten.',
    ARRAY['Versicherungslösungen entlang von Kundenbedarf erklären und begründen', 'Profilbezogenes Fachwissen für die Vermittlung anwenden', 'Beratungs- und Dokumentationspflichten einhalten', 'Kundengespräche strukturiert führen und absichern'],
    'Versicherungsvermittlung, VBV, VAG, Allbranche, Leben, Nichtleben, Krankenzusatzversicherung, Kundenberatung, Dokumentation, Versicherungsprodukte',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/versicherungsvermittler-in-vbv',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 3. Dipl. Finanzberater/in IAF
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Dipl. Finanzberater/in IAF',
    'Der Lehrgang qualifiziert dich für eine umfassende Privatkundenberatung über mehrere Themenfelder hinweg. Du arbeitest entlang eines ganzheitlichen Beratungsprozesses, der Vorsorge, Versicherung, Vermögen, Immobilien, Recht und Steuern miteinander verbindet. Inhaltlich geht es darum, Kundensituationen korrekt zu analysieren, Prioritäten zu setzen und daraus eine nachvollziehbare Beratung zu entwickeln – inklusive klarer Kommunikation, sauberer Begründung und Dokumentation. In Übungen und Fallstudien trainierst du typische Lebenssituationen (z. B. Familienphase, Immobilienkauf, Absicherung, Anlage- und Vorsorgefragen) und lernst, wie du die einzelnen Fachgebiete in ein stimmiges Gesamtbild integrierst. Der Lehrgang richtet sich an Personen in Banken, Versicherungen und verwandten Rollen, die Beratungsverantwortung tragen oder übernehmen möchten und eine strukturierte, praxisnahe Qualifikation suchen.',
    ARRAY['Ganzheitliche Kundenanalyse und Priorisierung von Handlungsfeldern', 'Fachthemen zu Vorsorge, Vermögen, Versicherung und Immobilien verknüpfen', 'Empfehlungen verständlich kommunizieren und sauber dokumentieren', 'Fallbasierte Beratung über Lebensphasen hinweg anwenden'],
    'Finanzberatung, IAF, Privatkunden, Vorsorge, Versicherung, Vermögen, Immobilien, Steuern, Recht, Beratungsprozess',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/dipl-finanzberater-in-iaf',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 4. Intensivtraining für Finanzberater/innen
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Intensivtraining Finanzberater/innen',
    'Das Intensivtraining fokussiert auf die prüfungs- und fallorientierte Anwendung des Finanzberater/innen-Stoffes. Du vertiefst das Zusammenspiel der Fachgebiete und trainierst, wie du unter Zeitdruck strukturierte Lösungen entwickelst: Ausgangslage erfassen, relevante Informationen auswählen, Handlungsoptionen prüfen und eine konsistente Empfehlung formulieren. Ein Schwerpunkt liegt auf typischen Prüfungs- und Beratungssituationen, in denen mehrere Themen gleichzeitig betroffen sind (z. B. Vorsorge und Steuern, Finanzierung und Absicherung, Anlagefragen und Risikoprofil). Du erhältst dadurch Routine im Vorgehen und schärfst die Fähigkeit, Beratung logisch aufzubauen und sauber zu argumentieren. Das Format eignet sich als Vorbereitung vor Leistungsnachweisen oder als kompakter Kompetenz-Boost für Personen, die bereits Grundlagen mitbringen.',
    ARRAY['Fallbearbeitung systematisch strukturieren und priorisieren', 'Fachgebiete in konsistente Empfehlungen überführen', 'Argumentation und Dokumentation unter Zeitdruck verbessern', 'Prüfungsnahe Aufgaben sicherer lösen'],
    'Intensivtraining, Prüfungsvorbereitung, Finanzberatung, Fallstudien, Privatkunden, Vorsorge, Steuern, Vermögen, Versicherung, Immobilien',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/intensivtraining-fuer-finanzberater-innen',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 5. Finanzplaner/in mit eidg. Fachausweis
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Finanzplaner/in mit eidg. Fachausweis',
    'Der Lehrgang richtet sich an Personen, die Privatkundschaft über den gesamten Lebenszyklus bis zur Pensionierung fundiert begleiten möchten. Du lernst, komplexere Kundensituationen zu strukturieren und fachlich korrekt zu beurteilen – inklusive Wechselwirkungen zwischen Vorsorge, Steuern, Vermögen, Versicherungen und weiteren Lebensereignissen. Im Zentrum steht eine finanzplanerische Logik: Ziele definieren, Szenarien vergleichen, Risiken und Chancen sichtbar machen und daraus klare Handlungsempfehlungen ableiten. Praxisnahe Fälle unterstützen dich dabei, Gespräche konsistent aufzubauen und Entscheidungen verständlich zu erklären. Der Lehrgang ist besonders passend für Beratende, die bereits Berührung mit Finanzthemen haben und ihre Kompetenz Richtung ganzheitliche Planung erweitern möchten, inklusive Vorbereitung auf ein anerkanntes Prüfungsziel.',
    ARRAY['Finanzplanerische Szenarien über Lebensphasen modellieren', 'Massnahmen aus Vorsorge, Steuern und Vermögen sinnvoll kombinieren', 'Risiken, Zielkonflikte und Alternativen transparent darstellen', 'Empfehlungen nachvollziehbar kommunizieren und dokumentieren'],
    'Finanzplanung, eidg Fachausweis, Lebenszyklus, Pensionierung, Vorsorgeplanung, Steuerplanung, Vermögensplanung, Szenarien, Privatkunden, Beratung',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/finanzplaner-in-mit-eidg-fachausweis',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 6. Dipl. Immobilienberater/in IAF
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Dipl. Immobilienberater/in IAF',
    'Dieser Lehrgang fokussiert auf die Beratung von Privatpersonen rund um Immobilien und deren Finanzierung. Du beschäftigst dich mit der Logik von Immobilienentscheidungen, lernst typische Kundensituationen zu analysieren und entwickelst Handlungsempfehlungen, die sowohl finanzielle als auch risikobezogene Aspekte berücksichtigen. In praxisnahen Fällen geht es um Themen wie Bewertung und Plausibilisierung von Preisen, Finanzierungsmodelle und Tragbarkeit, Objekt- und Kundenspezifika sowie Absicherung und Risiken. Dadurch wird klarer, welche Informationen im Gespräch relevant sind und wie du sie strukturiert aufbereitest. Das Format eignet sich für Beratende aus Banken, Versicherungen und immobiliennahen Tätigkeiten, die ihre Kompetenz in der Immobilien- und Finanzierungsberatung systematisch ausbauen wollen.',
    ARRAY['Immobilienfälle strukturiert aufnehmen und bewerten', 'Finanzierungsmodelle erklären und Tragbarkeit prüfen', 'Risiken erkennen und passende Absicherung ableiten', 'Beratungsschritte nachvollziehbar dokumentieren'],
    'Immobilienberatung, IAF, Hypothek, Finanzierung, Tragbarkeit, Belehnung, Bewertung, Privatkunden, Risikoanalyse, Wohneigentum',
    NULL,
    'beruflich',
    'industrie_bau',
    'Immobilienbewirtschaftung',
    'beruflich | Industrie, Bau & Immobilien',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/dipl-immobilienberater-in-iaf',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 7. Dipl. Berater/in berufliche Vorsorge IAF
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Dipl. Berater/in berufliche Vorsorge IAF',
    'Der Lehrgang vermittelt Fach- und Anwendungskompetenz für Beratungen rund um die berufliche Vorsorge (BVG) – sowohl für Unternehmen als auch für Versicherte. Du lernst, Vorsorgesituationen zu analysieren, zentrale Stellhebel zu erkennen und fundierte Empfehlungen abzuleiten. Im Vordergrund steht die Fähigkeit, komplexe BVG-Themen verständlich aufzubereiten: Plan- und Leistungslogik, Risiken, Finanzierung, sowie typische Entscheidungsfelder in der Praxis. Zusätzlich werden Beratungssituationen trainiert, in denen Interessenlagen, rechtliche Rahmenbedingungen und ökonomische Konsequenzen zusammenkommen. Zielgruppe sind Personen in Vorsorgeberatung, Broker-Umfeld, Banken/Versicherungen oder HR-nahen Rollen, die BVG-Fragen professionell bearbeiten und Kunden- oder Unternehmensentscheide fundiert begleiten möchten.',
    ARRAY['BVG-Situationen systematisch analysieren und strukturieren', 'Risiken, Leistungen und Finanzierung verständlich erklären', 'Handlungsoptionen für Unternehmen und Versicherte ableiten', 'BVG-Fälle praxisnah bearbeiten und dokumentieren'],
    'BVG, berufliche Vorsorge, Pensionskasse, Vorsorgeberatung, Unternehmen, Versicherte, Risiko, Leistungen, Finanzierung, IAF',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/dipl-berater-in-berufliche-vorsorge-iaf',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 8. CFP® Certified Financial Planner™
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'CFP® Certified Financial Planner™',
    'Der CFP®-Lehrgang zielt darauf ab, Finanzplanung auf international anschlussfähigem Niveau zu strukturieren und anzuwenden. Du vertiefst, wie finanzplanerische Fragestellungen über mehrere Themenfelder hinweg konsistent bearbeitet werden: Zieldefinition, Analyse, Massnahmenplanung, Umsetzung und Nachsteuerung. Besonderes Gewicht liegt auf der Fähigkeit, komplexe Fälle nachvollziehbar aufzubauen und kundengerecht zu erklären – inklusive Abwägungen, Szenarien und Priorisierung. Das Format ist für Personen geeignet, die bereits in der Finanzberatung oder Finanzplanung tätig sind und ihre Methodik, Fallkompetenz und Professionalität weiterentwickeln möchten. Durch die Fall- und Prozesslogik wird das Gelernte unmittelbar in anspruchsvollen Kundensituationen anwendbar.',
    ARRAY['Finanzplanungsfälle strukturiert modellieren und begründen', 'Massnahmen aus mehreren Fachgebieten konsistent kombinieren', 'Szenarien, Zielkonflikte und Prioritäten transparent darstellen', 'Professionelle Fallargumentation und Dokumentation stärken'],
    'CFP, Financial Planning, Finanzplanung, Privatkunden, Szenarien, Fallstudien, Lebenszyklus, Pensionierung, Beratungskompetenz, Zertifizierung',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/cfp-certified-financial-planner',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 9. Dipl. Finanzplanungsexpert(e)/in NDS HF
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Dipl. Finanzplanungsexpert(e)/in NDS HF',
    'Diese Weiterbildung positioniert sich im High-End-Bereich des Financial Planning und richtet sich an Personen, die Privatkundschaft in komplexen Situationen professionell begleiten möchten. Du vertiefst die Fähigkeit, vielschichtige Fallkonstellationen zu strukturieren, Risiken und Zielkonflikte sauber zu modellieren und daraus belastbare Handlungsempfehlungen abzuleiten. Der Fokus liegt auf anspruchsvollen Kundensituationen, in denen mehrere Lebens- und Finanzthemen gleichzeitig betroffen sind und Entscheidungen langfristige Konsequenzen haben. Durch eine konsequente Fall- und Prozesslogik trainierst du, wie du mit Unsicherheiten umgehst, Szenarien bewertest und die Beratung transparent und nachvollziehbar aufbaust. Geeignet für erfahrene Finanzplaner/innen und Beratende mit hoher Fallverantwortung.',
    ARRAY['Komplexe Finanzplanungscases strukturiert bearbeiten', 'Szenarien, Risiken und Zielkonflikte professionell bewerten', 'Empfehlungen mit klarer Logik, Prioritäten und Begründung formulieren', 'Beratungsdokumentation und Umsetzungsplanung auf Expert:innenniveau stärken'],
    'Finanzplanungsexperte, NDS HF, High-End Financial Planning, komplexe Fälle, Szenarien, Risikoanalyse, Privatkunden, Pensionierung, Vermögen, Vorsorge',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/dipl-finanzplanungsexpert-e-in-nds-hf',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 10. Eidg. dipl. KMU-Finanzexpert(e)/in
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'KMU-Finanzexpert(e)/in mit eidg. Diplom',
    'Der Lehrgang richtet sich an Fachpersonen, die KMU beraten und betreuen und dabei finanzielle Fragestellungen strukturiert lösen möchten. Du vertiefst, wie Unternehmenssituationen erfasst, Finanzinformationen interpretiert und daraus fundierte Empfehlungen für Finanzierung, Stabilität und Weiterentwicklung abgeleitet werden. Ziel ist eine kompetente Begleitung von Unternehmer/innen und Entscheidungsträgern – nicht nur mit Kennzahlen, sondern mit verständlicher Beratung, Szenarien und pragmatischen Massnahmen. Typische Themenfelder sind die Beurteilung der finanziellen Lage, das Aufzeigen von Handlungsoptionen, die Einordnung von Risiken sowie die Kommunikation von Empfehlungen an unterschiedliche Stakeholder. Das Format eignet sich für Personen aus Banking, Treuhand, Beratung oder Versicherungsumfeld mit Firmenkundenfokus.',
    ARRAY['KMU-Finanzlagen anhand von Informationen und Indikatoren beurteilen', 'Finanzierungs- und Optimierungsoptionen ableiten und begründen', 'Risiken, Zielkonflikte und Szenarien verständlich kommunizieren', 'Beratung strukturiert planen und dokumentieren'],
    'KMU, Unternehmensfinanzen, eidg Diplom, Finanzierung, Beratung, Kennzahlen, Risiko, Liquidität, Szenarien, Firmenkunden',
    NULL,
    'beruflich',
    'finanzen',
    'Controlling & Reporting',
    'beruflich | Finanzen, Controlling & Treuhand',
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/eidg-dipl-kmu-finanzexpert-e-in',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 11. CAS Management der Unternehmensnachfolge
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'CAS Management der Unternehmensnachfolge',
    'Das CAS vermittelt Kompetenzen, um Unternehmensnachfolgen professionell zu strukturieren und zu begleiten. Du arbeitest dich durch die Logik von Nachfolgeprojekten: Ausgangslage verstehen, Stakeholder und Interessenlagen einordnen, Vorgehenspläne erstellen, Risiken steuern und Entscheide methodisch vorbereiten. Die Weiterbildung verbindet Management-Perspektiven mit fachlichen Schnittstellen (z. B. rechtliche und finanzielle Themen) und legt Wert auf ein Vorgehen, das in realen Projektsituationen funktioniert. Dadurch lernst du, Nachfolgethemen nicht nur inhaltlich zu verstehen, sondern auch als Prozess sauber zu führen – inklusive Kommunikation, Konfliktpotenzial und Umsetzungsschritten. Geeignet für Fachpersonen, die KMU-Kundschaft betreuen, Unternehmer/innen begleiten oder in Beratung/Finance/Legal in Nachfolgekontexten arbeiten.',
    ARRAY['Nachfolgeprojekte methodisch strukturieren und steuern', 'Schnittstellen zwischen Fachthemen und Projektführung koordinieren', 'Stakeholder- und Konfliktdynamiken erkennen und adressieren', 'Umsetzungspläne und Entscheidungsgrundlagen erarbeiten'],
    'Unternehmensnachfolge, CAS, Projektmanagement, KMU, Stakeholder, Konflikt, Strukturierung, Übergabe, Governance, Planung',
    NULL,
    'beruflich',
    'business_mgmt',
    'Unternehmensstrategie & Geschäftsmodelle',
    'beruflich | Business, Management & Leadership',
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/cas-management-der-unternehmensnachfolge',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 12. GwG-Compliance
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'GwG-Compliance',
    'Der Lehrgang vermittelt praxisorientierte Kompetenz zur Bekämpfung von Geldwäscherei und zur Umsetzung zentraler Compliance-Anforderungen im Finanzumfeld. Du lernst, wie Sorgfaltspflichten, Risikobeurteilungen und interne Kontrollmechanismen in Organisationen so aufgesetzt werden, dass sie im Alltag funktionieren und prüfbar sind. Ein Schwerpunkt liegt auf dem Erkennen und Einordnen von Risiken sowie auf dem richtigen Vorgehen bei Auffälligkeiten: von der Abklärung über die interne Eskalation bis zur sauberen Dokumentation. Der Kurs eignet sich für Personen, die in Compliance-, Kontroll- oder kundenbezogenen Rollen tätig sind und Verantwortung für GwG-Prozesse tragen oder übernehmen möchten. Durch die Verbindung von Grundlagen und konkreten Umsetzungsschritten entsteht ein Werkzeugkasten, der in internen Richtlinien, Prozessen und Fallbearbeitungen direkt anwendbar ist.',
    ARRAY['GwG-Risiken erkennen, bewerten und dokumentieren', 'Sorgfaltspflichten und Kontrollschritte in Prozesse übersetzen', 'Vorgehen bei Auffälligkeiten korrekt anwenden', 'Compliance-Anforderungen in der Praxis prüfbar umsetzen'],
    'GwG, Geldwäscherei, Compliance, Sorgfaltspflichten, Risikoanalyse, KYC, Monitoring, Dokumentation, Finanzinstitut, Kontrollen',
    NULL,
    'beruflich',
    'business_mgmt',
    'Governance & Compliance',
    'beruflich | Business, Management & Leadership',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/compliance/gwg-compliance',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 13. FIDLEG-Compliance Basis (Bildungsnachweis)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'FIDLEG-Compliance Basis (Bildungsnachweis)',
    'Diese Weiterbildung dient als Basis-Bildungsnachweis im Kontext des FIDLEG-Beraterregisters und vermittelt die zentralen Anforderungen an konformes Beratungsverhalten. Du beschäftigst dich mit Regeln, Pflichten und praktischen Konsequenzen für den Beratungsalltag: Was muss im Gespräch beachtet werden, wie werden Informationen dokumentiert, und wie lassen sich Interessenkonflikte sowie Risiken sauber adressieren. Der Kurs legt Wert auf die Übersetzung von Regulatorik in konkrete Handlungsroutinen, damit du Vorgaben nicht nur kennst, sondern in Standards, Checklisten und Gesprächslogiken umsetzen kannst. Geeignet für Berater/innen und Rollen im Finanzumfeld, die den Bildungsnachweis für den Neueintrag ins Register benötigen oder ihre Compliance-Fundierung stärken möchten.',
    ARRAY['FIDLEG-Anforderungen für Beratungssituationen anwenden', 'Verhaltensregeln in Gesprächs- und Dokumentationslogik übersetzen', 'Risikohinweise und Informationspflichten korrekt umsetzen', 'Compliance-Fallstricke erkennen und vermeiden'],
    'FIDLEG, Beraterregister, Bildungsnachweis, Compliance, Verhaltensregeln, Informationspflicht, Dokumentation, Interessenkonflikte, Beratung, Regulierung',
    NULL,
    'beruflich',
    'business_mgmt',
    'Governance & Compliance',
    'beruflich | Business, Management & Leadership',
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/compliance/fidleg-compliance-basis-bildungsnachweis',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 14. FIDLEG-Compliance Refresher (Bildungsnachweis)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'FIDLEG-Compliance Refresher (Bildungsnachweis)',
    'Der Refresher dient der Aktualisierung des Bildungsnachweises im Kontext des FIDLEG-Beraterregisters und fokussiert auf die sichere Anwendung der Verhaltensregeln im Beratungsalltag. Du frischt zentrale Anforderungen auf und vertiefst, wie du regulatorische Pflichten in Gesprächsführung, Information, Begründung und Dokumentation korrekt umsetzt. Im Vordergrund steht die Praxis: typische Situationen, in denen Interessenkonflikte, Risikohinweise oder Transparenzpflichten relevant sind, werden entlang klarer Handlungslogik eingeordnet. Dadurch stärkst du die Fähigkeit, Anforderungen nicht nur zu kennen, sondern konsistent umzusetzen und gegenüber internen oder externen Prüfungen nachvollziehbar zu machen. Zielgruppe sind Beratende und Fachpersonen, deren Registereintrag erneuert werden muss oder die ihre Compliance-Routine aktuell halten wollen.',
    ARRAY['FIDLEG-Verhaltensregeln aktuell und praxisnah anwenden', 'Dokumentations- und Informationspflichten sicher erfüllen', 'Typische Compliance-Risiken in Beratungssituationen vermeiden', 'Aktualisierungen in Checklisten und Prozessschritte übertragen'],
    'FIDLEG, Refresher, Beraterregister, Bildungsnachweis, Compliance, Verhaltensregeln, Dokumentation, Transparenz, Interessenkonflikte, Beratung',
    NULL,
    'beruflich',
    'business_mgmt',
    'Governance & Compliance',
    'beruflich | Business, Management & Leadership',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/compliance/fidleg-compliance-refresher-bildungsnachweis',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- SEMINARE / WEBINARE
-- ============================================

-- ============================================
-- 15. Immobilienberatung: Recht und Steuern (Webinar)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Immobilienberatung: Recht und Steuern (Webinar)',
    'Dieses Webinar vermittelt praxisnahes Wissen zu wichtigen rechtlichen und steuerlichen Aspekten rund um Immobilien, damit du Privatkundschaft in typischen und komplexeren Situationen sicher begleiten kannst. Du vertiefst Vertrags- und Eigentumsfragen, Grundlagen aus ZGB/OR und relevante Themen aus dem Sachenrecht, inkl. Grundbuch, Dienstbarkeiten und Pfandrechte. Zusätzlich werden Abläufe im Betreibungs- und Konkursrecht sowie prozessuale Aspekte eingeordnet, die im Immobilienkontext praktisch werden können. Der steuerliche Teil fokussiert auf Auswirkungen beim Kauf, Besitz und Verkauf von Immobilien, inklusive Grundstückgewinnsteuer, Eigenmietwert und relevanter Abzüge. Das Format eignet sich für Beratende aus Finanz- und Immobilienumfeld, die Risiken früh erkennen und rechtlich sowie steuerlich fundierte Handlungsempfehlungen geben möchten.',
    ARRAY['Rechtliche Zusammenhänge verständlich erklären und einordnen', 'Steuerfolgen von Immobilienentscheidungen aufzeigen', 'Risiken beim Erwerb erkennen und präventive Massnahmen empfehlen', 'Beratungsfälle zu Kauf, Besitz und Verkauf strukturiert bearbeiten'],
    'Immobilienrecht, Steuerrecht, Grundstückgewinnsteuer, Grundbuch, Dienstbarkeiten, Kaufvertrag, Mietrecht, Eigenmietwert, Immobilienberatung, Webinar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'industrie_bau',
    'Immobilienbewirtschaftung',
    'beruflich | Industrie, Bau & Immobilien',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['online_live'],
    'lead',
    'https://www.iffp.ch/seminare/immobilien/immobilienberatung-von-privatpersonen-recht-und-steuern',
    'published',
    1490,
    NULL,
    '4½ Tage (9 Termine)'
);

-- ============================================
-- 16. Immobilienberatung: Bewertung, Finanzierung & Versicherung (Webinar)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Immobilienberatung: Bewertung, Finanzierung & Versicherung (Webinar)',
    'Dieses Webinar baut eine praxisnahe Kompetenzbasis auf, um Kundschaft ganzheitlich zu Immobilienfragen zu beraten – von der Wertermittlung über Finanzierungslogik bis zur Absicherung. Du arbeitest an Bewertungsmethoden und lernst, Wert und Preis sauber zu unterscheiden sowie typische Bewertungsansätze (z. B. Ertrags-/Substanzwert, Verkehrswert, DCF) in Beratungssituationen einzuordnen. Im Finanzierungsteil stehen Belehnungswert, Tragbarkeit, Hypotheken, Amortisation und die Prüfung von Kreditwürdigkeit im Fokus, ergänzt um Aspekte wie Nachhaltigkeit und Vergleich von Angeboten. Der Versicherungsteil behandelt zentrale Deckungen und Risiken (z. B. Gebäude/Haftpflicht, Hypothekenabsicherung, Mietausfall sowie Ereignisrisiken). Ziel ist, Risiken früh zu erkennen und fundierte Empfehlungen aus Bewertung, Finanzierung und Versicherung konsistent abzuleiten.',
    ARRAY['Kundenorientiert zu Bewertung, Finanzierung und Versicherung kommunizieren', 'Probleme und Risiken identifizieren und präventive Massnahmen ableiten', 'Bewertungs- und Finanzierungslogik in Fällen anwenden', 'Absicherungsbedarf strukturiert beurteilen und begründen'],
    'Immobilienbewertung, Finanzierung, Hypothek, Tragbarkeit, Belehnung, DCF, Ertragswert, Gebäudeversicherung, Haftpflicht, Hypothekenabsicherung',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'industrie_bau',
    'Immobilienbewirtschaftung',
    'beruflich | Industrie, Bau & Immobilien',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['online_live'],
    'lead',
    'https://www.iffp.ch/seminare/immobilien/immobilienberatung-von-privatpersonen-bewertung-finanzierung-and-versicherung',
    'published',
    1490,
    NULL,
    '4½ Tage (9 Termine)'
);

-- ============================================
-- 17. Ehe vs. Konkubinat (Gegenüberstellung)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Ehe vs. Konkubinat (Gegenüberstellung)',
    'Das Seminar ordnet die wichtigsten Unterschiede zwischen Ehe und Konkubinat praxisnah ein, damit du Kundensituationen strukturiert beurteilen und Konsequenzen verständlich erklären kannst. Im Zentrum steht, welche rechtlichen und finanziellen Wirkungen die beiden Lebensformen im Alltag auslösen – insbesondere bei Vermögen, Absicherung, Vorsorge und Nachlassplanung. Du arbeitest anhand typischer Lebenssituationen (z. B. Zusammenzug, Kinder, Immobilie, Trennung, Todesfall) und lernst, wo Risiken entstehen und welche Punkte früh geklärt werden sollten. Ziel ist nicht eine Empfehlung für ein Modell, sondern ein klares Raster für Beratungsgespräche: Welche Fragen sind entscheidend, welche Dokumente oder Regelungen sind sinnvoll, und wie lassen sich Fehlannahmen vermeiden. Geeignet für Beratende, die Paare oder Familien begleiten.',
    ARRAY['Relevante Unterschiede zwischen Ehe und Konkubinat erklären', 'Auswirkungen auf Vermögen, Vorsorge und Nachlass strukturiert einordnen', 'Beratungsgespräche mit klarer Fragenlogik führen', 'Risikofelder erkennen und Handlungsoptionen ableiten'],
    'Ehe, Konkubinat, Vorsorge, Erbrecht, Vermögen, Nachlass, Absicherung, Familienrecht, Beratung, Risikoanalyse',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'hr_recht',
    'Arbeitsrecht',
    'beruflich | HR, Recht & Administration',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/ehe-vs-konkubinat-eine-gegenueberstellung',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 18. Digitalisierung in der Finanzberatung (KI-Tools)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Digitalisierung in der Finanzberatung (KI-Tools)',
    'Dieses Seminar beleuchtet, wie digitale Werkzeuge und KI-Tools den Beratungsalltag verändern und welche Chancen sowie Risiken daraus entstehen. Du erhältst einen strukturierten Rahmen, um Tools sinnvoll einzuordnen: Wo unterstützen sie Analyse, Dokumentation oder Kommunikation – und wo entstehen neue Risiken, etwa bei Datenschutz, Nachvollziehbarkeit oder Fehlinterpretationen. Anhand praxisnaher Beispiele wird diskutiert, wie Prozesse gestaltet werden können, damit Beratung weiterhin konsistent, prüfbar und kundenorientiert bleibt. Ein Schwerpunkt liegt darauf, KI nicht als Blackbox zu behandeln, sondern als Werkzeug, das klare Regeln, Qualitätschecks und Verantwortlichkeiten braucht. Geeignet für Beratende und Fachpersonen im Finanzumfeld, die Digitalisierung aktiv nutzen möchten, ohne Compliance- und Reputationsrisiken zu übersehen.',
    ARRAY['Einsatzfelder von KI-Tools im Beratungsprozess erkennen', 'Risiken (Datenschutz, Qualität, Nachvollziehbarkeit) beurteilen', 'Geeignete Governance- und Qualitätsmechanismen ableiten', 'Digital unterstützte Beratung konsistent und prüfbar gestalten'],
    'Digitalisierung, KI-Tools, Finanzberatung, Governance, Datenschutz, Compliance, Dokumentation, Prozessdesign, Qualitätssicherung, Beratung',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/digitalisierung-in-der-finanzberatung-chancen-and-risiken-von-ki-tools',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 19. VAG 2026: Dossier-Check & Audit-Readiness
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'VAG 2026: Dossier-Check & Audit-Readiness',
    'Das Seminar unterstützt dich dabei, Anforderungen rund um VAG 2026 praxisnah in die Arbeitsroutine zu übertragen. Du arbeitest an der Frage, wie Dossiers aufgebaut sein müssen, damit sie in Kontrollen und Audits nachvollziehbar sind, und welche typischen Schwachstellen in der Praxis auftreten. Im Vordergrund stehen prüfbare Prozesse: Welche Informationen müssen wo dokumentiert sein, wie wird Konsistenz zwischen Beratung, Risikoabklärung und Ablage hergestellt, und welche Kontrollpunkte helfen im Alltag. Du erhältst damit ein strukturiertes Vorgehen, um bestehende Dossiers zu überprüfen und Verbesserungen priorisiert umzusetzen. Geeignet für Personen, die in Vermittlung, Beratung, Compliance oder Qualitätsmanagement Verantwortung tragen und Audit-Sicherheit stärken möchten.',
    ARRAY['VAG-bezogene Anforderungen in Dossierlogik übersetzen', 'Dossiers anhand klarer Kriterien prüfen und verbessern', 'Audit-Risiken erkennen und präventive Massnahmen definieren', 'Prozess- und Dokumentationsstandards konsistent umsetzen'],
    'VAG 2026, Audit, Dossierprüfung, Dokumentation, Compliance, Qualitätsmanagement, Vermittlung, Beratung, Kontrollpunkte, Prozesse',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'business_mgmt',
    'Governance & Compliance',
    'beruflich | Business, Management & Leadership',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/vag-2026-in-der-praxis-dossier-check-and-audit-readiness',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 20. Update Krypto-Assets
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Update Krypto-Assets',
    'Dieses Seminar bietet ein Update für die Einordnung von Krypto-Assets im Beratungs- und Anlagekontext. Du beschäftigst dich damit, welche Eigenschaften und Risiken relevant sind, wie Kundenerwartungen und Risikoprofile sauber abgeglichen werden und wie eine Beratung so dokumentiert wird, dass sie nachvollziehbar bleibt. Ziel ist, Krypto-Themen nicht isoliert zu betrachten, sondern in die Gesamtlogik von Anlageberatung, Diversifikation und Risikomanagement einzubetten. Praktische Fallfragen helfen, typische Missverständnisse zu klären und Beratungsroutinen zu entwickeln, die sowohl fachlich als auch regulatorisch anschlussfähig sind. Geeignet für Beratende und Fachpersonen, die Kundennachfragen kompetent aufnehmen und realistische, nachvollziehbare Empfehlungen formulieren möchten.',
    ARRAY['Krypto-Assets hinsichtlich Risiko und Einsatz im Portfolio einordnen', 'Kundenfragen strukturiert aufnehmen und Erwartungsmanagement betreiben', 'Beratungs- und Dokumentationslogik für Krypto-Fälle anwenden', 'Risiken und Grenzen verständlich kommunizieren'],
    'Krypto, Crypto Assets, Bitcoin, Blockchain, Anlageberatung, Risikoprofil, Portfolio, Diversifikation, Volatilität, Dokumentation',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/update-krypto-assets',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 21. Pensionierung reloaded
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Pensionierung reloaded',
    'Das Seminar vertieft zentrale Fragen rund um moderne Pensionierungsplanung und unterstützt dich dabei, Kundensituationen sauber zu strukturieren. Du lernst, wie du Ziele, Zeitachsen und Szenarien so aufbereitest, dass Entscheidungen nachvollziehbar werden – inklusive Wechselwirkungen zwischen Vorsorge, Vermögen, Steuern und Liquiditätsbedarf. Im Fokus stehen praxisnahe Fragestellungen: welche Stellhebel typischerweise wirken, wie Risiken und Unsicherheiten transparent gemacht werden und wie du Varianten vergleichbar darstellst. Zielgruppe sind Beratende, die Pensionierungsfälle bearbeiten und dabei eine klare Methodik für Analyse, Empfehlung und Kommunikation einsetzen möchten. Das Format eignet sich sowohl als Auffrischung als auch als Vertiefung für Personen mit Beratungspraxis.',
    ARRAY['Pensionierungsfälle mit Szenarien und Zeitachsen strukturieren', 'Wechselwirkungen zwischen Vorsorge, Steuern und Vermögen einordnen', 'Liquiditäts- und Risikofragen verständlich darstellen', 'Handlungsoptionen kundenorientiert begründen'],
    'Pensionierung, Ruhestand, Vorsorge, 2. Säule, 3. Säule, Steuerplanung, Liquidität, Szenarien, Finanzplanung, Beratung',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/pensionierung-reloaded',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 22. Rechtsprechung Steuern
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Rechtsprechung Steuern',
    'Das Seminar liefert ein praxisorientiertes Update zu steuerrelevanter Rechtsprechung und unterstützt dich dabei, Auswirkungen auf Beratung und Fallbearbeitung korrekt einzuordnen. Du lernst, wie du Urteile und Entwicklungen so interpretierst, dass daraus klare Implikationen für Kundensituationen abgeleitet werden können. Im Vordergrund steht die Anwendung: welche Konstellationen häufiger betroffen sind, welche Argumentationslinien in der Praxis relevant werden und wie du Unsicherheiten transparent kommunizierst. Dadurch stärkst du die Fähigkeit, steuerliche Entscheidungen nicht nur fachlich, sondern auch nachvollziehbar im Beratungsprozess zu begründen. Geeignet für Beratende und Fachpersonen, die steuerliche Themen in der Kundenberatung oder in angrenzenden Rollen sicherer bearbeiten wollen.',
    ARRAY['Steuerrechtsprechung auf Beratungsauswirkungen übersetzen', 'Relevante Urteilslogik in Kundensituationen anwenden', 'Risiken, Unsicherheiten und Grenzen verständlich kommunizieren', 'Fallargumentation und Dokumentation verbessern'],
    'Steuerrecht, Rechtsprechung, Urteile, Steuerberatung, Praxisupdate, Argumentation, Risiko, Dokumentation, Beratung, Schweiz',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Steuern für Unternehmen',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/rechtsprechung-steuern',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 23. Ergänzungsleistungen und Vermögen
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Ergänzungsleistungen und Vermögen',
    'Das Seminar ordnet die Schnittstelle zwischen Ergänzungsleistungen und Vermögenssituationen praxisnah ein, damit du Fälle sauber beurteilen und Kundschaft verständlich informieren kannst. Du lernst, welche Faktoren in der Beurteilung relevant sind, wie Vermögen und Einkommen in typischen Konstellationen berücksichtigt werden und wo Missverständnisse häufig entstehen. Ziel ist eine strukturierte Falllogik: Informationen gezielt erheben, Konsequenzen transparent machen und mögliche Handlungsoptionen nachvollziehbar diskutieren. Das Format eignet sich besonders für Beratende, die Kundinnen und Kunden in Vorsorge- oder Sozialversicherungsfragen begleiten und dabei klare Orientierung in komplexen Regeln und Konsequenzen benötigen.',
    ARRAY['Relevante Faktoren bei EL- und Vermögensfragen identifizieren', 'Fälle strukturiert aufnehmen und Konsequenzen erklären', 'Handlungsoptionen nachvollziehbar ableiten und kommunizieren', 'Typische Fallstricke und Missverständnisse vermeiden'],
    'Ergänzungsleistungen, Vermögen, Sozialversicherung, Vorsorge, Anspruch, Fallprüfung, Beratung, Regeln, Konsequenzen, Schweiz',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/ergaenzungsleistungen-und-vermoegen',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 24. Flexible Pensionierungsmodelle
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Flexible Pensionierungsmodelle',
    'Das Seminar vermittelt einen praxisnahen Überblick über flexible Pensionierungsmodelle und deren Einordnung in Beratungssituationen. Du lernst, wie unterschiedliche Varianten strukturiert verglichen werden können und welche Auswirkungen auf Liquidität, Steuern, Vorsorgeleistungen und Risikoprofil typischerweise zu beachten sind. Ziel ist eine klare Methodik, um Kundensituationen zu erfassen, Optionen aufzubereiten und Konsequenzen verständlich zu erklären. Das Format eignet sich für Beratende, die Pensionierungsfälle bearbeiten und dabei nicht nur Standardlösungen, sondern flexiblere Übergänge planen und begründen möchten. Durch die Fokussierung auf Entscheidungslogik wird das Gelernte direkt in Gesprächen einsetzbar.',
    ARRAY['Pensionierungsvarianten strukturiert vergleichen und erklären', 'Auswirkungen auf Vorsorge, Steuern und Liquidität einordnen', 'Risiken, Zielkonflikte und Unsicherheiten transparent machen', 'Empfehlungen kundenorientiert begründen'],
    'Pensionierung, Teilpensionierung, Flexibilisierung, Vorsorge, Steuerfolgen, Liquidität, Szenarien, Beratung, Ruhestand, Planung',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/flexible-pensionierungsmodelle',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 25. Nachhaltige Geldanlagen: Greenwashing vs Rendite
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Nachhaltige Geldanlagen: Greenwashing vs Rendite',
    'Das Seminar ordnet nachhaltige Geldanlagen im Spannungsfeld zwischen Wirkung, Produktlogik und Renditeerwartung ein. Du lernst, wie ESG- und Nachhaltigkeitsbegriffe verständlich erklärt werden können und wo typische Greenwashing-Risiken entstehen. Im Fokus steht die Beratungsfähigkeit: Welche Fragen helfen, Produkte sauber einzuordnen, wie wird Transparenz über Kriterien hergestellt und wie werden Zielkonflikte (z. B. Rendite vs Nachhaltigkeitsanspruch) fair kommuniziert. Dadurch kannst du Kundensituationen strukturierter führen und vermeiden, dass Nachhaltigkeit rein als Marketinglabel behandelt wird. Geeignet für Beratende, die nachhaltige Anlagewünsche professionell aufnehmen und nachvollziehbar in Portfolio- und Produktempfehlungen übersetzen möchten.',
    ARRAY['Nachhaltigkeitsbegriffe und ESG-Logik verständlich erklären', 'Greenwashing-Risiken erkennen und adressieren', 'Kundenbedürfnisse in Kriterien und Entscheidungslogik übersetzen', 'Zielkonflikte transparent kommunizieren und dokumentieren'],
    'ESG, nachhaltige Anlagen, Greenwashing, Anlageberatung, Impact, Kriterien, Transparenz, Portfolio, Rendite, Nachhaltigkeit',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/nachhaltige-geldanlagen-greenwashing-oder-echte-rendite',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 26. Social Media & Selfbranding für Kundengewinnung
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Social Media & Selfbranding für Kundengewinnung',
    'Das Seminar zeigt, wie Social Media und Selfbranding als Werkzeuge moderner Kundengewinnung eingesetzt werden können – mit Fokus auf professionelles Vorgehen und konsistente Kommunikation. Du arbeitest an Grundlagen der Positionierung, an Content-Logik und daran, wie du Vertrauen aufbaust, ohne in reines Marketing abzurutschen. Dabei wird die Verbindung zum Beratungsalltag hergestellt: Welche Themen sind sinnvoll, wie werden Aussagen nachvollziehbar und wie lassen sich Grenzen und Risiken (z. B. Missverständnisse, Compliance, Reputation) berücksichtigen. Zielgruppe sind Beratende und Fachpersonen, die ihre Sichtbarkeit erhöhen und dabei eine klare, wiederholbare Vorgehensweise entwickeln möchten, die zur eigenen Rolle und Zielkundschaft passt.',
    ARRAY['Positionierung und Botschaften für Social Media ableiten', 'Content- und Kanalstrategie für Beratungskontext entwickeln', 'Risiken (Reputation/Compliance) erkennen und vermeiden', 'Kundengewinnung mit konsistenter Kommunikationslogik unterstützen'],
    'Social Media, Selfbranding, Kundengewinnung, Positionierung, Content, LinkedIn, Beratung, Kommunikation, Reputation, Compliance',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'marketing',
    'Online-Marketing & Social Media',
    'beruflich | Verkauf, Marketing & Kommunikation',
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/social-media-and-selfbranding-werkzeuge-moderner-kundengewinnung',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 27. BVG-Sicherheit: Vollversicherung vs teilautonom
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'BVG-Sicherheit: Vollversicherung vs teilautonom',
    'Das Seminar vergleicht zwei zentrale Modelle der beruflichen Vorsorge – Vollversicherung und teilautonome Sammelstiftung – und vermittelt Orientierung für die Einordnung in Beratungssituationen. Du lernst, worin sich Risiko- und Leistungslogik unterscheiden, welche Entscheidungsparameter in der Praxis relevant sind und wie du Vor- und Nachteile sachlich gegenüberstellen kannst. Im Fokus stehen typische Fragen von Unternehmen und Versicherten: Sicherheit, Rendite-/Anlagerisiko, Stabilität und langfristige Konsequenzen von Modellentscheiden. Ziel ist ein verständliches Raster, das komplexe Unterschiede klar kommunizierbar macht und eine fundierte Entscheidungsvorbereitung ermöglicht. Geeignet für Personen mit BVG-Bezug in Beratung, Brokergeschäft, Versicherungs- oder HR-nahen Rollen.',
    ARRAY['Vollversicherung und teilautonome Modelle fachlich sauber unterscheiden', 'Entscheidungsparameter in BVG-Modellfragen strukturieren', 'Vor- und Nachteile verständlich und neutral kommunizieren', 'BVG-Beratungsgespräche mit klarer Vergleichslogik führen'],
    'BVG, Vollversicherung, teilautonom, Sammelstiftung, Pensionskasse, Risiko, Sicherheit, Rendite, Modellvergleich, Vorsorge',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/sicherheit-in-der-beruflichen-vorsorge-vollversicherung-oder-teilautonome-sammelstiftung-zwei-modelle-ein-ziel',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 28. BVG optimieren im Status quo
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'BVG optimieren im Status quo',
    'Dieses Seminar fokussiert auf Optimierungsmöglichkeiten in der beruflichen Vorsorge innerhalb bestehender Rahmenbedingungen. Du lernst, wie du eine Ausgangslage strukturiert erfasst, relevante Stellhebel identifizierst und Verbesserungen so formulierst, dass sie verständlich, realistisch und umsetzungsorientiert sind. Im Mittelpunkt steht die Praxis: Welche Parameter lassen sich typischerweise anpassen, wie werden Auswirkungen auf Unternehmen und Versicherte erklärt, und wie werden Zielkonflikte transparent gemacht. Dadurch entsteht eine Beratungssystematik, die nicht von Idealzuständen ausgeht, sondern konkrete Schritte im Status quo ermöglicht. Geeignet für BVG-nahe Beratungsrollen und Fachpersonen, die Optimierungsvorschläge fachlich sauber und kundenorientiert entwickeln möchten.',
    ARRAY['BVG-Ausgangslagen strukturiert analysieren', 'Optimierungshebel im Status quo erkennen', 'Auswirkungen auf Unternehmen und Versicherte verständlich erklären', 'Massnahmen priorisieren und als Plan kommunizieren'],
    'BVG, Optimierung, Pensionskasse, Status quo, Vorsorgeberatung, Unternehmen, Versicherte, Massnahmen, Analyse, Planung',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/finanzakademie/bvg-optimieren-im-status-quo',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- ZYKLUS ZUR UNTERNEHMENSNACHFOLGE (SEMINARE)
-- ============================================

-- ============================================
-- 29. Management der Nachfolge (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Management der Nachfolge (Unternehmensnachfolge)',
    'Dieses Seminar vermittelt Grundlagen, um Nachfolgeprozesse als Projekt strukturiert zu planen, zu steuern und zu überwachen. Du lernst, wie du eine Nachfolgeregelung in sinnvolle Phasen gliederst, Schnittstellen zu Fachthemen erkennst und die Umsetzung organisatorisch sauber begleitest. Im Zentrum stehen Prozess- und Projektmanagement-Elemente, die auf Nachfolgefälle übertragen werden: Methoden zur Problemlösung, klare Prozessdefinitionen, Projektplanung, Kontrolle und Transfer in konkrete Kundensituationen. Ziel ist, Nachfolge nicht als lose Sammlung von Fachfragen zu behandeln, sondern als Führung eines mehrdisziplinären Projekts mit klaren Arbeitsschritten. Geeignet für Unternehmer/innen, GL-Mitglieder von KMU sowie Dienstleister mit KMU-Kundschaft (z. B. Firmenkundenberatung, Treuhand, Steuer- und Rechtsberatung).',
    ARRAY['Nachfolgeprojekte methodisch strukturieren und steuern', 'Prozess- und Projektmanagement auf Nachfolge anwenden', 'Schnittstellen zu Fachthemen erkennen und koordinieren', 'Vorgehen in Phasen nachvollziehbar planen und dokumentieren'],
    'Unternehmensnachfolge, Projektmanagement, Prozessmanagement, KMU, Übergabe, Stakeholder, Planung, Umsetzung, Governance, Seminar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'business_mgmt',
    'Unternehmensstrategie & Geschäftsmodelle',
    'beruflich | Business, Management & Leadership',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/management-der-unternehmensnachfolge',
    'published',
    NULL,
    NULL,
    '8 Stunden (Hybrid)'
);

-- ============================================
-- 30. Verhandlung und Konfliktlösung (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Verhandlung und Konfliktlösung (Unternehmensnachfolge)',
    'Dieses Seminar baut Kompetenzen auf, um Konflikte in Nachfolgeprozessen früh zu erkennen und konstruktiv zu bearbeiten. Du lernst, wie Konflikte entstehen, welche Dynamiken in Verhandlungen wirken und welche Optionen der Konfliktlösung in der Praxis anwendbar sind. Ein Schwerpunkt liegt auf Methoden der Mediation sowie auf Kommunikations- und Verhandlungstechniken, die in anspruchsvollen Stakeholder-Situationen helfen. Ziel ist, in emotional oder wirtschaftlich sensiblen Übergabesituationen handlungsfähig zu bleiben, Interessenlagen zu strukturieren und tragfähige Lösungen zu fördern. Das Seminar eignet sich für Personen, die Nachfolgeprojekte begleiten und dabei nicht nur fachlich, sondern auch in der Prozess- und Beziehungsebene sicher agieren möchten.',
    ARRAY['Entstehung von Konflikten und Lösungsoptionen verstehen', 'Mediation als Instrument der Konfliktlösung einordnen', 'Verhandlungs- und Kommunikationstechniken praktisch anwenden', 'Stakeholder in Konfliktsituationen wirksam unterstützen'],
    'Verhandlung, Konfliktlösung, Mediation, Kommunikation, Unternehmensnachfolge, Stakeholder, Moderation, Eskalation, Lösung, Seminar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'soft_skills',
    'Konfliktmanagement',
    'beruflich | Soft Skills & Persönlichkeit',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/management-der-unternehmensnachfolge-3',
    'published',
    NULL,
    NULL,
    '8 Stunden (vor Ort Zürich)'
);

-- ============================================
-- 31. Rechnungslegung & Unternehmensbewertung (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Rechnungslegung & Unternehmensbewertung (Unternehmensnachfolge)',
    'Das Seminar unterstützt dich dabei, Rechnungslegung und Unternehmensbewertung im Nachfolgekontext verständlich und anwendungsorientiert zu nutzen. Du lernst, finanzielle Informationen so zu interpretieren, dass sie als Grundlage für Entscheidungsfindung, Preisfindung und Strukturierungsoptionen dienen können. Im Fokus steht nicht nur das Rechnen, sondern die Logik: Welche Informationen sind entscheidend, welche Annahmen treiben Resultate, und wie lassen sich Unsicherheiten transparent machen. Damit kannst du in Nachfolgeprojekten die finanzielle Sicht besser einordnen und Gespräche mit Eigentümern, Käufern, Beratern oder Finanzierungspartnern fundierter führen. Geeignet für Personen, die Nachfolgefälle begleiten und finanzielle Bewertung nicht als Blackbox behandeln möchten.',
    ARRAY['Finanzinformationen im Nachfolgekontext strukturiert interpretieren', 'Grundlogik von Bewertungsansätzen nachvollziehen', 'Bewertungsannahmen und Unsicherheiten transparent darstellen', 'Ergebnisse als Entscheidungsgrundlage kommunizieren'],
    'Rechnungslegung, Unternehmensbewertung, Nachfolge, Bewertung, Kennzahlen, Cashflow, DCF, Preisfindung, Due Diligence, Seminar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Controlling & Reporting',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/rechnungslegung-unternehmensbewertung',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 32. Recht (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Recht (Unternehmensnachfolge)',
    'Das Seminar vermittelt rechtliche Grundkenntnisse, um Nachfolgeprozesse fachlich sicher zu strukturieren und als Projekt zu führen. Du lernst, rechtliche Fragestellungen im Nachfolgeprozess zu verorten, Risiken zu erkennen und Schnittstellen zu anderen Themenfeldern zielgerichtet zu koordinieren. Der Fokus liegt auf einem Vorgehen, das in realen Projektsituationen funktioniert: strukturieren, führen, umsetzen und überwachen. Ziel ist, Nachfolge als mehrdisziplinäre Aufgabe zu verstehen und rechtliche Aspekte so einzubinden, dass Entscheidungen nachvollziehbar vorbereitet werden. Geeignet für Personen mit KMU-Kundschaft oder Verantwortung in Nachfolgeprojekten, die rechtliche Themen nicht isoliert, sondern als Teil eines Gesamtprozesses bearbeiten wollen.',
    ARRAY['Rechtliche Themenfelder im Nachfolgeprozess korrekt verorten', 'Risiken erkennen und Schnittstellen zu Fachthemen koordinieren', 'Nachfolgeprojekte strukturiert führen und überwachen', 'Entscheidungsgrundlagen rechtlich nachvollziehbar vorbereiten'],
    'Nachfolge, Recht, Vertragsrecht, Gesellschaftsrecht, Risiken, Prozess, Projektmanagement, KMU, Umsetzung, Seminar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'hr_recht',
    'Arbeitsrecht',
    'beruflich | HR, Recht & Administration',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/management-der-unternehmensnachfolge-2',
    'published',
    NULL,
    NULL,
    '8 Stunden (Hybrid)'
);

-- ============================================
-- 33. Steuern (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Steuern (Unternehmensnachfolge)',
    'Das Seminar ordnet steuerliche Fragestellungen im Nachfolgeprozess praxisnah ein. Du lernst, wie Steuern als Entscheidungsparameter in der Strukturierung und Umsetzung einer Nachfolge wirken und wie du typische Risiken und Zielkonflikte erkennst. Im Mittelpunkt steht die Fähigkeit, steuerliche Überlegungen so zu integrieren, dass sie mit rechtlichen, finanziellen und organisatorischen Aspekten konsistent zusammenspielen. Dadurch kannst du Nachfolgeprojekte fundierter begleiten und in Gesprächen klarer kommunizieren, welche Annahmen und Konsequenzen relevant sind. Geeignet für Personen, die Nachfolgefälle betreuen und steuerliche Sichtweisen in eine saubere Gesamtlogik überführen möchten.',
    ARRAY['Steuerliche Auswirkungen in Nachfolgeszenarien einordnen', 'Risiken und Zielkonflikte früh erkennen und transparent machen', 'Steuerthemen mit Prozess- und Projektlogik verknüpfen', 'Handlungsoptionen nachvollziehbar erläutern'],
    'Nachfolge, Steuern, Strukturierung, KMU, Risiken, Szenarien, Entscheidungslogik, Steuerfolgen, Beratung, Seminar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Steuern für Unternehmen',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/steuern',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 34. Vorsorge (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Vorsorge (Unternehmensnachfolge)',
    'Dieses Seminar behandelt Vorsorgefragen im Nachfolgekontext und unterstützt dich dabei, private und betriebliche Vorsorgeaspekte in die Nachfolgeplanung einzubinden. Du lernst, wie Vorsorge als Teil der Gesamtstruktur wirkt und welche Fragestellungen in typischen Übergabesituationen relevant werden. Der Fokus liegt auf der Integration in den Nachfolgeprozess: Informationen erheben, Risiken sichtbar machen, Optionen vergleichen und Entscheidungen nachvollziehbar vorbereiten. Geeignet für Personen mit KMU-Kundschaft oder Verantwortung in Nachfolgeprojekten, die Vorsorgethemen strukturiert und kundenorientiert einordnen möchten.',
    ARRAY['Vorsorgefragen im Nachfolgeprozess systematisch erfassen', 'Risiken und Konsequenzen für Beteiligte transparent machen', 'Optionen in eine konsistente Nachfolgestruktur integrieren', 'Beratung und Kommunikation anhand klarer Falllogik führen'],
    'Nachfolge, Vorsorge, BVG, Pensionierung, Strukturierung, Risiken, Planung, KMU, Beratung, Seminar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/vorsorge',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 35. Private Finanzplanung (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Private Finanzplanung (Unternehmensnachfolge)',
    'Das Seminar fokussiert auf private Finanzplanung im Umfeld von Unternehmensnachfolgen. Du lernst, wie private Ziele, Vermögensstruktur und Liquiditätsbedarf in die Nachfolgelogik integriert werden, damit Entscheidungen nicht nur unternehmerisch, sondern auch privat stimmig sind. Im Vordergrund steht eine strukturierte Fallbearbeitung: Ausgangslage erfassen, Szenarien bilden, Konsequenzen transparent machen und Massnahmen priorisieren. Dadurch kannst du Nachfolgegespräche ganzheitlicher führen und typische Brüche zwischen Firmen- und Privatperspektive reduzieren. Geeignet für Personen, die Nachfolgefälle begleiten und private Finanzplanung als festen Bestandteil eines konsistenten Gesamtkonzepts nutzen wollen.',
    ARRAY['Private Ziele und Finanzstruktur im Nachfolgefall systematisch erfassen', 'Szenarien für Liquidität, Risiko und Zielkonflikte entwickeln', 'Private und unternehmerische Perspektiven konsistent verbinden', 'Massnahmen priorisieren und verständlich kommunizieren'],
    'Private Finanzplanung, Nachfolge, Vermögen, Liquidität, Szenarien, Risiko, Zielkonflikte, Planung, Beratung, KMU',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/private-finanzplanung',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 36. Finanzierung (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Finanzierung (Unternehmensnachfolge)',
    'Das Seminar behandelt Finanzierungsthemen im Nachfolgeprozess und stärkt deine Fähigkeit, Finanzierungsfragen als Teil einer konsistenten Nachfolgeplanung zu bearbeiten. Du lernst, welche Informationen für die Beurteilung von Finanzierungsoptionen relevant sind, wie Risiken und Tragbarkeit eingeordnet werden und wie du Optionen verständlich vergleichst. Der Fokus liegt auf praxisnaher Entscheidungslogik und darauf, Finanzierung nicht losgelöst, sondern in Verbindung mit rechtlichen, steuerlichen und organisatorischen Fragen zu betrachten. Geeignet für Personen, die Nachfolgeprojekte begleiten und Finanzierung als zentralen Hebel in Strukturierung und Umsetzung professionell adressieren möchten.',
    ARRAY['Finanzierungsoptionen in Nachfolgeszenarien strukturiert einordnen', 'Risiken, Tragbarkeit und Konsequenzen transparent darstellen', 'Optionen vergleichbar machen und Entscheidungsvorlagen erstellen', 'Finanzierung in den Gesamtprozess der Nachfolge integrieren'],
    'Finanzierung, Nachfolge, Tragbarkeit, Risiko, Strukturierung, KMU, Kredit, Optionen, Szenarien, Beratung',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/finanzierung',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 37. Unternehmenstransaktionen (Unternehmensnachfolge)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Unternehmenstransaktionen (Unternehmensnachfolge)',
    'Das Seminar ordnet Unternehmenstransaktionen im Nachfolgekontext ein und stärkt die Fähigkeit, Transaktionslogik in die Nachfolgeplanung einzubetten. Du lernst, wie Transaktionsschritte strukturiert werden, welche Informationsbedarfe typischerweise auftreten und wie Risiken entlang des Prozesses erkannt und adressiert werden. Ziel ist, in Übergabe- und Verkaufssituationen eine klare, nachvollziehbare Prozesslogik zu nutzen, sodass Entscheide fundiert vorbereitet und Kommunikationswege sauber gestaltet werden. Geeignet für Personen, die Nachfolgeprojekte begleiten und Transaktionen als integrierten Bestandteil eines konsistenten Gesamtprozesses verstehen wollen.',
    ARRAY['Transaktionsschritte im Nachfolgeprozess strukturieren', 'Informationsbedarfe und Risiken entlang des Prozesses erkennen', 'Entscheidungsgrundlagen nachvollziehbar vorbereiten', 'Transaktionslogik mit weiteren Fachthemen koordinieren'],
    'Unternehmenstransaktion, Nachfolge, Verkauf, Übergabe, Prozess, Risiken, Due Diligence, Strukturierung, KMU, Seminar',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'business_mgmt',
    'Unternehmensstrategie & Geschäftsmodelle',
    'beruflich | Business, Management & Leadership',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/unternehmensnachfolge/unternehmenstransaktionen',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- COMPLIANCE / WEITERE SEMINARE
-- ============================================

-- ============================================
-- 38. VBV Rezertifizierung (Versicherungsvermittlung)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'VBV Rezertifizierung (Versicherungsvermittlung)',
    'Dieses Angebot unterstützt bei der gezielten Vorbereitung auf die VBV-Rezertifizierung. Der Fokus liegt darauf, relevante Inhalte und Anforderungen strukturiert aufzufrischen und auf typische Nachweis- bzw. Rezertifizierungssituationen auszurichten. Du bekommst Orientierung, welche Themenfelder prioritär sind, wie du dich effizient vorbereitest und wie du dein Wissen so festigst, dass es im Berufsalltag sicher abrufbar bleibt. Geeignet für Versicherungsvermittler/innen, deren Rezertifizierung ansteht und die eine klare, zielgerichtete Begleitung für die Aktualisierung ihres Kompetenznachweises möchten.',
    ARRAY['Relevante Rezertifizierungsthemen identifizieren und priorisieren', 'Wissen strukturiert auffrischen und festigen', 'Vorbereitung effizient planen und umsetzen', 'Sicherheit für Nachweis-/Rezertifizierungssituationen erhöhen'],
    'VBV, Rezertifizierung, Versicherungsvermittlung, VAG, Auffrischung, Kompetenznachweis, Weiterbildung, Vorbereitung, Profil, Beratung',
    NULL,
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/lehrgaenge/finanzberatung-und-planung/versicherungsvermittler-in-vbv',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 39. FIDLEG-Verhaltensregeln Basis (WBT)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'FIDLEG-Verhaltensregeln Basis (WBT)',
    'Dieses Web-Based-Training vermittelt die zentralen Verhaltensregeln im FIDLEG-Kontext als Grundlage für den Bildungsnachweis und die Beratungspraxis. Du arbeitest dich durch Pflichten und Standards, die im Kundengespräch relevant sind, und lernst, wie du regulatorische Anforderungen in eine saubere Beratungs- und Dokumentationsroutine übersetzt. Ein Schwerpunkt liegt auf Verständlichkeit: Welche Informationen müssen wann geliefert werden, wie werden Risiken und Interessenkonflikte adressiert, und wie bleibt die Beratung nachvollziehbar. Das Format eignet sich für Personen, die den Einstieg in die FIDLEG-konforme Beratung absichern und eine strukturierte Wissensbasis aufbauen wollen – flexibel im Selbstlernmodus.',
    ARRAY['FIDLEG-Verhaltensregeln in Beratungssituationen anwenden', 'Informations- und Dokumentationspflichten korrekt umsetzen', 'Interessenkonflikte erkennen und sauber adressieren', 'Prüfbare Routine für FIDLEG-konforme Beratung entwickeln'],
    'FIDLEG, Verhaltensregeln, WBT, Bildungsnachweis, Beraterregister, Compliance, Dokumentation, Informationspflicht, Interessenkonflikt, Selbstlernmodul',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'business_mgmt',
    'Governance & Compliance',
    'beruflich | Business, Management & Leadership',
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['self_study'],
    'lead',
    'https://www.iffp.ch/seminare/compliance/fidleg-verhaltensregeln-basis-wbt',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 40. FIDLEG-Verhaltensregeln Refresher (WBT)
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'FIDLEG-Verhaltensregeln Refresher (WBT)',
    'Dieses Web-Based-Training aktualisiert die FIDLEG-Verhaltensregeln und unterstützt dich dabei, den Bildungsnachweis im Beratungsalltag aktuell zu halten. Du frischt zentrale Pflichten auf und vertiefst die Umsetzung in typischen Gesprächssituationen: Informationspflichten, Risikohinweise, Transparenz und der Umgang mit Interessenkonflikten. Der Fokus liegt auf praxisnahen Routinen, damit die Anforderungen nicht abstrakt bleiben, sondern in klare Vorgehensschritte und dokumentierbare Standards übersetzt werden. Das Format eignet sich für Beratende und Fachpersonen, die ihr Wissen auffrischen, die Konsistenz ihrer Beratung erhöhen und die Anschlussfähigkeit an Register- bzw. Nachweisanforderungen sicherstellen möchten.',
    ARRAY['FIDLEG-Verhaltensregeln auf aktuellem Stand anwenden', 'Dokumentations- und Transparenzpflichten sicher erfüllen', 'Compliance-Risiken in Beratungsgesprächen reduzieren', 'Beratungsprozesse prüfbar und konsistent gestalten'],
    'FIDLEG, Refresher, Verhaltensregeln, WBT, Compliance, Beraterregister, Dokumentation, Transparenz, Interessenkonflikte, Auffrischung',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'business_mgmt',
    'Governance & Compliance',
    'beruflich | Business, Management & Leadership',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['self_study'],
    'lead',
    'https://www.iffp.ch/seminare/compliance/fidleg-verhaltensregeln-refresher-wbt',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- 41. Mathematik für den Beratungsalltag
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
    '9feacc90-d14e-4def-b160-d2f2648b6cc2',
    'Mathematik für den Beratungsalltag',
    'Dieses Seminar stärkt mathematische Grundlagen, die in Finanz- und Beratungsaufgaben täglich gebraucht werden. Im Fokus stehen Zinsen, Renditen und die dahinterliegende Rechenlogik, damit du Ergebnisse nicht nur übernehmen, sondern verstehen und plausibilisieren kannst. Ziel ist, Berechnungen sicher anzuwenden, Resultate richtig zu interpretieren und sie im Kundengespräch verständlich zu erklären. Dadurch reduzierst du Fehlerquellen, erhöhst die Qualität deiner Empfehlungen und gewinnst Sicherheit in Situationen, in denen Zahlen als Entscheidungsbasis dienen. Das Format eignet sich für Personen aus Beratung und Finanzumfeld, die ihre Rechensicherheit erhöhen und typische Berechnungen zuverlässig im Alltag einsetzen möchten.',
    ARRAY['Zins- und Renditeberechnungen sicher anwenden', 'Ergebnisse plausibilisieren und korrekt interpretieren', 'Mathematische Logik verständlich kommunizieren', 'Fehlerquellen in Berechnungen erkennen und vermeiden'],
    'Mathematik, Zins, Rendite, Finanzmathematik, Barwert, Zinseszins, Plausibilisierung, Beratung, Berechnung, Grundlagen',
    'Keine formalen Voraussetzungen',
    'beruflich',
    'finanzen',
    'Finanzplanung & Budget',
    'beruflich | Finanzen, Controlling & Treuhand',
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://www.iffp.ch/seminare/compliance/mathematik-in-der-finanzwelt',
    'published',
    NULL,
    NULL,
    NULL
);

-- ============================================
-- Jetzt course_categories für alle Kurse einfügen
-- (Diese Abfrage fügt die primäre Kategorie in die Junction-Tabelle ein)
-- ============================================

INSERT INTO course_categories (course_id, category_type, category_area, category_specialty, is_primary)
SELECT
    id,
    category_type,
    category_area,
    category_specialty,
    true
FROM courses
WHERE user_id = '9feacc90-d14e-4def-b160-d2f2648b6cc2'
  AND NOT EXISTS (
    SELECT 1 FROM course_categories cc
    WHERE cc.course_id = courses.id
  );

-- ============================================
-- Zusammenfassung der eingefügten Kurse (41 Total):
-- ============================================
-- LEHRGÄNGE (1-14):
-- 1. Zert. Vermögensberater/in IAF (Kenntnisnachweis FIDLEG)
-- 2. Versicherungsvermittler/in VBV (neues VAG)
-- 3. Dipl. Finanzberater/in IAF
-- 4. Intensivtraining Finanzberater/innen
-- 5. Finanzplaner/in mit eidg. Fachausweis
-- 6. Dipl. Immobilienberater/in IAF
-- 7. Dipl. Berater/in berufliche Vorsorge IAF
-- 8. CFP® Certified Financial Planner™
-- 9. Dipl. Finanzplanungsexpert(e)/in NDS HF
-- 10. KMU-Finanzexpert(e)/in mit eidg. Diplom
-- 11. CAS Management der Unternehmensnachfolge
-- 12. GwG-Compliance
-- 13. FIDLEG-Compliance Basis (Bildungsnachweis)
-- 14. FIDLEG-Compliance Refresher (Bildungsnachweis)
--
-- SEMINARE / WEBINARE (15-28):
-- 15. Immobilienberatung: Recht und Steuern (Webinar)
-- 16. Immobilienberatung: Bewertung, Finanzierung & Versicherung (Webinar)
-- 17. Ehe vs. Konkubinat (Gegenüberstellung)
-- 18. Digitalisierung in der Finanzberatung (KI-Tools)
-- 19. VAG 2026: Dossier-Check & Audit-Readiness
-- 20. Update Krypto-Assets
-- 21. Pensionierung reloaded
-- 22. Rechtsprechung Steuern
-- 23. Ergänzungsleistungen und Vermögen
-- 24. Flexible Pensionierungsmodelle
-- 25. Nachhaltige Geldanlagen: Greenwashing vs Rendite
-- 26. Social Media & Selfbranding für Kundengewinnung
-- 27. BVG-Sicherheit: Vollversicherung vs teilautonom
-- 28. BVG optimieren im Status quo
--
-- ZYKLUS UNTERNEHMENSNACHFOLGE (29-37):
-- 29. Management der Nachfolge
-- 30. Verhandlung und Konfliktlösung
-- 31. Rechnungslegung & Unternehmensbewertung
-- 32. Recht (Unternehmensnachfolge)
-- 33. Steuern (Unternehmensnachfolge)
-- 34. Vorsorge (Unternehmensnachfolge)
-- 35. Private Finanzplanung (Unternehmensnachfolge)
-- 36. Finanzierung (Unternehmensnachfolge)
-- 37. Unternehmenstransaktionen
--
-- COMPLIANCE / WEITERE (38-41):
-- 38. VBV Rezertifizierung
-- 39. FIDLEG-Verhaltensregeln Basis (WBT)
-- 40. FIDLEG-Verhaltensregeln Refresher (WBT)
-- 41. Mathematik für den Beratungsalltag
