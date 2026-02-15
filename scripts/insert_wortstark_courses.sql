-- =====================================================
-- Wortstark Academy - 2 Kurse (Geschäftskorrespondenz)
-- Provider UUID: 956bf043-2ea0-43a1-abdf-7468c1346685
-- =====================================================

-- Kurs 1: So schreibt man heute – die Brief- und E-Mail-Sprache
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
    '956bf043-2ea0-43a1-abdf-7468c1346685'::uuid,
    'So schreibt man heute – die Brief- und E-Mail-Sprache',
    'Das Tagesseminar vermittelt, wie moderne Geschäftskorrespondenz klar, leserorientiert und effizient gestaltet wird. Im ersten Teil werden Aufbau, Darstellung und zentrale Regeln des Geschäftsbriefs behandelt, ergänzt durch die Funktion wichtiger Briefelemente (z. B. von der Infozeile bis zum PS). Darauf aufbauend geht es um die Eckpfeiler guter Korrespondenz: klare Botschaften, passende Tonalität und eine nachvollziehbare Textlogik.

Ein Schwerpunkt liegt auf dem Einstieg und Ausstieg von Schreiben, damit Anliegen rasch verstanden werden und die nächsten Schritte eindeutig sind. Ein weiterer Block widmet sich der Wirkung von Floskeln: welche Formulierungen Zeit kosten, unpräzise wirken oder unnötig distanzieren – und wie sie durch zeitgemässe Alternativen ersetzt werden können.

Für E-Mails werden konkrete Regeln des E-Mail-Knigge angewendet, um Betreff, Struktur und Stil zu verbessern. Ergänzend wird gezeigt, wie KI und weitere Schreibtools als Unterstützung genutzt werden können, ohne Inhalte unkritisch zu übernehmen. In der Textwerkstatt werden mitgebrachte Praxisbeispiele überarbeitet, sodass Teilnehmende direkt umsetzbare Verbesserungen für den Arbeitsalltag mitnehmen.',
    'Geschäftskorrespondenz, Briefe schreiben, E-Mails schreiben, Business Writing, Textstruktur, Schreibstil, Floskeln vermeiden, E-Mail-Knigge, klare Sprache, Textüberarbeitung, Textwerkstatt, KI im Schreiben',
    ARRAY[
        'Aktuelle Regeln und Standards moderner Geschäftskorrespondenz sicher anwenden',
        'Briefe und E-Mails strukturiert sowie zielorientiert aufbauen',
        'Einstiege und Abschlüsse präzise und handlungsorientiert formulieren',
        'Floskeln erkennen und durch zeitgemässe, klare Alternativen ersetzen',
        'E-Mail-Regeln (Betreff, Struktur, Ton, Effizienz) konsequent umsetzen',
        'Praxistexte systematisch analysieren und überarbeiten',
        'KI- und Schreibtools sinnvoll in den Schreibprozess integrieren'
    ],
    'Keine formalen Voraussetzungen',
    2300.00,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'soft_skills',
    'Kommunikation',
    'Brief- und E-Mail-Sprache',
    NULL,
    '1 Tag (09.00–12.00 und 13.30–17.00)',
    'https://wortstark-academy.ch/firmenkurse/',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 2: Korrespondenz-Refresher für Firmen
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
    '956bf043-2ea0-43a1-abdf-7468c1346685'::uuid,
    'Korrespondenz-Refresher für Firmen',
    'Der halbtägige Korrespondenz-Refresher richtet sich an Teams, die im Arbeitsalltag viel schreiben und ihre Texte schneller, klarer und wirksamer machen möchten. Im Fokus stehen kurze, verständliche Formulierungen statt komplizierter Satzkonstruktionen, eine konsequent empfänger- und zielorientierte Sprache sowie der Verzicht auf abgegriffene Standardfloskeln.

Teilnehmende trainieren insbesondere, wie gelungene Einstiege ohne formelhafte Einleitungen aufgebaut werden und wie E-Mails oder Briefe mit klaren Handlungsaufforderungen enden, damit Anliegen nicht im Ungefähren bleiben.

Ein zentrales Element ist die Arbeit mit eigenen Texten aus dem Berufsalltag: Praxisbeispiele werden analysiert, überarbeitet und so angepasst, dass Ton, Struktur und Aussagekraft zur jeweiligen Situation passen. Ergänzend wird der Einsatz von KI als Schreibpartner behandelt – als Unterstützung für Ideenfindung, Struktur und Varianten, jedoch mit Fokus auf kontrollierte Anwendung statt unkritischem Kopieren.

Das Programm kann inhaltlich an firmeninterne Anforderungen angepasst und bei Bedarf erweitert werden.',
    'Korrespondenz Refresher, Geschäftskorrespondenz, E-Mail Stil, klare Sprache, floskelfrei schreiben, Textoptimierung, Schreiben im Büro, Handlungsaufforderung, Empfängerorientierung, Schreibtraining Firma, KI Schreibtools, Praxistexte überarbeiten',
    ARRAY[
        'Texte klarer, kürzer und verständlicher formulieren',
        'Empfänger- und zielorientierte Korrespondenz konsequent umsetzen',
        'Floskeln identifizieren und durch präzise Alternativen ersetzen',
        'Starke Einstiege ohne formelhafte Standardformulierungen schreiben',
        'Eindeutige Handlungsaufforderungen und klare Abschlüsse formulieren',
        'Eigene Praxistexte strukturiert überarbeiten und verbessern',
        'KI als Schreibpartner kontrolliert und sinnvoll einsetzen'
    ],
    'Keine formalen Voraussetzungen',
    1200.00,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'soft_skills',
    'Kommunikation',
    'Korrespondenz-Refresher',
    NULL,
    '4 Stunden (08.00–12.00)',
    'https://wortstark-academy.ch/korrespondenz-refresher-fuer-firmen/',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;
