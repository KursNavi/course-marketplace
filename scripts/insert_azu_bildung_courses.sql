-- =====================================================
-- AZU Bildung - 5 Kurse (Berufsbildung & Marketing)
-- Provider UUID: b5f3deb0-c138-4adc-a680-e66ab56c2de8
-- =====================================================

-- Kurs 1: Verkaufsfachleute mit eidg. Fachausweis
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
    'b5f3deb0-c138-4adc-a680-e66ab56c2de8'::uuid,
    'Verkaufsfachleute mit eidg. Fachausweis',
    'Dieser Lehrgang bereitet umfassend auf die anspruchsvollen Aufgaben im modernen Vertrieb und Verkaufsmanagement vor. Die Teilnehmenden erlernen die methodische Planung von Verkaufsmassnahmen, die Optimierung von Distributionswegen sowie die Führung von Verkaufsteams. Ein zentraler Fokus liegt auf der Verkaufsinteraktion und dem Beziehungsmanagement, wobei psychologische Aspekte der Verhandlungsführung ebenso thematisiert werden wie rechtliche Grundlagen im Kaufvertragsrecht.

Die Ausbildung verbindet strategisches Know-how mit operativer Exzellenz, um Absatzzahlen nachhaltig zu steigern und Marktanteile zu sichern. Durch die praxisorientierte Wissensvermittlung sind die Absolventen in der Lage, komplexe Verkaufsstrategien zu entwickeln und diese erfolgreich am Markt umzusetzen.

Der Kurs dient als gezielte Vorbereitung auf die eidgenössische Berufsprüfung und deckt alle prüfungsrelevanten Handlungsfelder ab. Zielgruppe sind Personen im Aussendienst, Key Account Management oder Ladenverkauf, die eine leitende Funktion anstreben oder ihre Kompetenzen formal zertifizieren lassen möchten. Der Abschluss geniesst in der Schweizer Wirtschaft eine hohe Anerkennung und bildet das Fundament für eine Karriere im mittleren Kader.',
    'Verkauf, Aussendienst, Fachausweis, Vertriebsmanagement, Key Account Management, Verhandlungstechnik, Verkaufsplanung, Distribution, Sales, Kaderbildung, Eidgenössischer Abschluss, Marketing, KMU',
    ARRAY[
        'Erstellung und Umsetzung von Verkaufsplänen',
        'Beherrschung von Verkaufstechniken und Verhandlungsführung',
        'Management der Distribution und Logistikprozesse',
        'Anwendung von Marketinggrundlagen im Verkaufskontext',
        'Führung und Motivation von Aussendienstmitarbeitenden'
    ],
    'Eidgenössisches Fähigkeitszeugnis (EFZ) und mindestens 3 Jahre einschlägige Berufspraxis im Verkauf bis zum Zeitpunkt der Prüfung.',
    9400.00,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'marketing',
    'Verkauf',
    NULL,
    NULL,
    '18 Monate (berufsbegleitend)',
    'https://www.azu-bildung.ch/kurse/verkaufsfachleute-mit-eidg-fachausweis',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 2: Marketingfachleute mit eidg. Fachausweis
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
    'b5f3deb0-c138-4adc-a680-e66ab56c2de8'::uuid,
    'Marketingfachleute mit eidg. Fachausweis',
    'Die Weiterbildung zum Marketingfachmann oder zur Marketingfachfrau vermittelt das notwendige Rüstzeug, um Marketingkonzepte professionell zu erarbeiten und Massnahmen im Kommunikationsmix sicher zu steuern. Im Zentrum steht die Fähigkeit, Märkte zu analysieren, Zielgruppen präzise zu definieren und darauf basierend effektive Marketingstrategien zu entwickeln.

Die Teilnehmenden vertiefen ihr Wissen in den Bereichen Werbung, Public Relations, Verkaufsförderung und Direct Marketing. Auch die zunehmende Bedeutung des digitalen Marketings wird im Lehrgang umfassend berücksichtigt.

Die Ausbildung ist stark auf die praktische Anwendung in Schweizer Unternehmen ausgerichtet und bereitet die Studierenden intensiv auf die eidgenössische Berufsprüfung vor. Absolventen dieses Kurses sind in der Lage, Marketingprojekte selbstständig zu leiten, Agenturen zu führen und Budgets effizient zu verwalten.

Diese Qualifikation ist ideal für Personen, die bereits im Marketing oder in angrenzenden Bereichen tätig sind und ihre Karriere durch einen geschätzten, staatlich anerkannten Abschluss beschleunigen möchten.',
    'Marketing, Kommunikation, Fachausweis, Marktforschung, Public Relations, Werbung, Branding, Marketingstrategie, Produktmanagement, Karriere, KMU, Berufsprüfung, Marketingplan',
    ARRAY[
        'Entwicklung integrierter Marketing- und Kommunikationskonzepte',
        'Durchführung von Marktanalysen und Marktforschungsprojekten',
        'Planung und Kontrolle von Werbemassnahmen und PR-Aktionen',
        'Sicherer Umgang mit Marketing-Kennzahlen und Budgetierung',
        'Koordination von internen und externen Dienstleistern'
    ],
    'EFZ oder Matura und 3 Jahre Berufserfahrung im Marketing; ohne EFZ sind 6 Jahre Praxis erforderlich.',
    9400.00,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'marketing',
    'Marketing-Strategie',
    NULL,
    NULL,
    '18 Monate (berufsbegleitend)',
    'https://www.azu-bildung.ch/kurse/marketingfachleute-mit-eidg-fachausweis',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 3: Technische Kaufleute mit eidg. Fachausweis
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
    'b5f3deb0-c138-4adc-a680-e66ab56c2de8'::uuid,
    'Technische Kaufleute mit eidg. Fachausweis',
    'Dieser Lehrgang schlägt die entscheidende Brücke zwischen technischem Fachwissen und betriebswirtschaftlichem Management. Er richtet sich an Berufsleute aus dem handwerklichen oder industriellen Sektor, die Führungspositionen im kaufmännischen Bereich anstreben.

Die Teilnehmenden erwerben fundierte Kenntnisse in Unternehmensführung, Rechnungswesen, Recht und Personalmanagement. Parallel dazu werden Kompetenzen in Marketing, Supply Chain Management und Projektorganisation aufgebaut.

Das Ziel ist es, technische Zusammenhänge unter ökonomischen Gesichtspunkten zu bewerten und betriebliche Prozesse ganzheitlich zu steuern. Die Ausbildung zum Technischen Kaufmann oder zur Technischen Kauffrau gilt als eine der Generalistenausbildungen in der Schweiz und eröffnet vielfältige Karrierewege in der Produktionsleitung, im technischen Verkauf oder in der Geschäftsführung von KMU.

Der praxisorientierte Unterricht stellt sicher, dass das Gelernte direkt im Arbeitsalltag angewendet werden kann, während gleichzeitig die gezielte Vorbereitung auf die eidgenössische Prüfung erfolgt.',
    'Technischer Kaufmann, Management, BWL für Techniker, Unternehmensführung, Supply Chain, Projektmanagement, Industrie, Gewerbe, Führung, Fachausweis, Logistik, Finanzen',
    ARRAY[
        'Verstehen und Anwenden betriebswirtschaftlicher Steuerungsinstrumente',
        'Führung von Mitarbeitenden und Teams in technischen Betrieben',
        'Management von Beschaffungs-, Produktions- und Logistikketten',
        'Analyse von finanziellen Kennzahlen und Kalkulationen',
        'Rechtliche Absicherung von Geschäftsprozessen'
    ],
    'Abgeschlossene Berufslehre im technisch-handwerklichen Bereich und mindestens 3 Jahre Berufspraxis.',
    13200.00,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'business_mgmt',
    'Leadership',
    NULL,
    NULL,
    '24 Monate (berufsbegleitend)',
    'https://www.azu-bildung.ch/kurse/technische-kaufleute-mit-eidg-fachausweis',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 4: MarKom Basiskurs
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
    'b5f3deb0-c138-4adc-a680-e66ab56c2de8'::uuid,
    'MarKom Basiskurs',
    'Der MarKom Basiskurs bildet das ideale Fundament für alle Personen, die neu in die Welt des Marketings und der Kommunikation einsteigen möchten. Der Kurs vermittelt die grundlegenden Begriffe, Konzepte und Zusammenhänge der Branche und dient als offizieller Startschuss für weiterführende Fachausbildungen.

Die Teilnehmenden erhalten einen strukturierten Überblick über Marketing, Werbung, Public Relations, Verkauf und Distribution sowie Recht. Es wird aufgezeigt, wie die einzelnen Disziplinen ineinandergreifen, um eine einheitliche Marktpräsenz zu gewährleisten.

Der Stoff ist so aufbereitet, dass er auch ohne spezifische Vorkenntnisse leicht verständlich ist, wobei die Praxisrelevanz stets im Vordergrund steht. Erfolgreiche Absolventen verfügen über das nötige Basiswissen, um in Marketing- oder Verkaufsabteilungen kompetent mitzuarbeiten oder die Zulassung für die Prüfungen zum Marketing- oder Verkaufsfachmann zu erlangen.

Dieser Kurs ist die Eintrittskarte in eine professionelle Laufbahn im kommerziellen Sektor.',
    'MarKom, Marketing-Grundlagen, Kommunikation, Basiskurs, Einstieg Marketing, Werbung, PR, Verkauf, Marketingwissen, Zertifikat, Karriere-Start, KMU, Fachbegriffe',
    ARRAY[
        'Beherrschung der Marketing-Grundbegriffe und des Marketing-Mix',
        'Verständnis der verschiedenen Kommunikationsinstrumente',
        'Grundkenntnisse in PR, Sponsoring und Event-Marketing',
        'Einblick in die Verkaufs- und Distributionsorganisation',
        'Kenntnis der relevanten rechtlichen Rahmenbedingungen'
    ],
    'Keine formalen Voraussetzungen; Interesse an wirtschaftlichen Zusammenhängen wird vorausgesetzt.',
    1950.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'marketing',
    'Marketing-Grundlagen',
    NULL,
    NULL,
    '1 Semester (ca. 4-5 Monate)',
    'https://www.azu-bildung.ch/kurse/markom-basiskurs',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 5: Online Marketing Manager
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
    'b5f3deb0-c138-4adc-a680-e66ab56c2de8'::uuid,
    'Online Marketing Manager',
    'In einer zunehmend digitalisierten Welt ist fundiertes Know-how im Bereich Digital Marketing unverzichtbar. Dieser Lehrgang zum Online Marketing Manager vermittelt praxisnah, wie digitale Kanäle effizient für die Unternehmensziele genutzt werden können.

Die Teilnehmenden lernen, professionelle Online-Marketing-Strategien zu entwickeln, Suchmaschinenoptimierung (SEO) und Suchmaschinenwerbung (SEA) einzusetzen sowie Social Media Kampagnen erfolgreich zu steuern. Ein weiterer Fokus liegt auf dem Content Marketing und dem Einsatz von Analysetools zur Erfolgsmessung (Web Analytics).

Der Kurs zeigt auf, wie man Zielgruppen im Internet punktgenau erreicht und die Conversion-Rate nachhaltig verbessert. Die Ausbildung ist stark hands-on orientiert: Anhand von konkreten Fallbeispielen und Tools wird das Wissen direkt angewendet.

Zielgruppe sind Marketingverantwortliche, Unternehmer und Quereinsteiger, die ihre digitale Kompetenz auf ein professionelles Level heben und die Online-Präsenz ihrer Organisation aktiv gestalten möchten.',
    'Online Marketing, Digital Marketing, SEO, SEA, Social Media, Content Marketing, Google Ads, Analytics, E-Commerce, Digitalisierung, Marketing Manager, Web-Marketing',
    ARRAY[
        'Konzeption und Umsetzung von Online-Marketing-Strategien',
        'Optimierung der Sichtbarkeit durch SEO und Google Ads (SEA)',
        'Professionelles Management von Social Media Kanälen',
        'Erstellung von zielgruppenrelevantem Content',
        'Anwendung von Web-Analyse-Tools zur Erfolgskontrolle'
    ],
    'Grundlegende Marketingkenntnisse (z.B. MarKom) oder entsprechende Berufserfahrung von Vorteil.',
    3450.00,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'marketing',
    'Online-Marketing',
    NULL,
    NULL,
    '1 Semester (berufsbegleitend)',
    'https://www.azu-bildung.ch/kurse/online-marketing-manager',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;
