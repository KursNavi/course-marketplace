-- ============================================
-- INSERT COURSES FOR COACHINGZENTRUM OLTEN
-- Provider UUID: 7d243795-2d25-4e94-b180-d1b6441ef8f4
-- ============================================
-- Run this script in Supabase SQL Editor

-- 1. Betriebliche/r Mentor/in mit eidg. Fachausweis
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
    '7d243795-2d25-4e94-b180-d1b6441ef8f4',
    'Betriebliche/r Mentor/in mit eidg. Fachausweis',
    'Dieser Lehrgang bietet eine umfassende Qualifizierung für die professionelle Begleitung von Einzelpersonen in deren Arbeits- und Lernumfeld. Im Zentrum steht die Triade aus Coaching, Mentoring und Training, die es den Absolventen ermöglicht, flexibel auf die Bedürfnisse ihrer Klienten einzugehen. Die Ausbildung ist stark praxisorientiert und vermittelt fundierte Methoden zur Unterstützung von Veränderungsprozessen, zur Kompetenzentwicklung und zur Qualitätssicherung im betrieblichen Kontext.

Teilnehmende reflektieren ihre eigene Rolle und entwickeln eine professionelle Haltung, die für die Begleitung von anspruchsvollen Entwicklungsschritten unerlässlich ist. Der Kurs bereitet gezielt auf die eidgenössische Berufsprüfung vor und integriert die Anforderungen des Schweizerischen Verbands für Coaching und Mentoring (SCA). Durch die modulare Struktur können die Lerninhalte schrittweise vertieft und direkt im eigenen Berufsalltag angewendet werden.

Zielgruppe sind Führungskräfte, HR-Fachleute, Projektleitende sowie Personen in beratenden Funktionen, die eine fundierte und anerkannte Ausbildung in der Prozessbegleitung suchen. Nach Abschluss sind die Teilnehmenden in der Lage, Individuen in komplexen Situationen zu stärken, Potenziale zu entfalten und die betriebliche Leistungsfähigkeit durch gezielte Begleitung zu fördern.',
    'Betrieblicher Mentor, Eidg. Fachausweis, Coaching, Mentoring, Personalentwicklung, Führungskompetenz, Beratung, Business Coaching, Coachingausbildung, Mentoringausbildung, Berufsbildung, Prozessbegleitung, HR Management, Weiterbildung Schweiz',
    ARRAY['Professionelle Gestaltung von Coaching- und Mentoring-Prozessen', 'Anwendung von lösungsorientierten Gesprächstechniken im Business-Kontext', 'Sicherer Umgang mit der Triade Coaching, Mentoring und Training', 'Begleitung von Veränderungs- und Lernprozessen in Organisationen', 'Vorbereitung auf die eidgenössische Berufsprüfung (Fachausweis)'],
    'Eidg. Fähigkeitszeugnis oder gleichwertiger Abschluss sowie mindestens vier Jahre Berufspraxis.',
    14900,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'hr_recht',
    'Personalentwicklung',
    NULL,
    17,
    '17 Kurstage (verteilt auf 16 Monate)',
    'https://www.coachingzentrum.ch/ausbildung/betriebliches-mentoring/',
    'lead',
    'published',
    false
);

-- 2. CAS Coaching
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
    '7d243795-2d25-4e94-b180-d1b6441ef8f4',
    'CAS Coaching',
    'Das Certificate of Advanced Studies (CAS) in Coaching ist eine fundierte wissenschaftlich-praktische Weiterbildung für Personen, die professionelle Coaching-Kompetenzen auf Hochschulniveau erwerben möchten. Der Lehrgang befähigt die Teilnehmenden, Menschen in anspruchsvollen Entwicklungs- und Veränderungsprozessen methodensicher zu unterstützen. Im Fokus stehen systemisch-lösungsorientierte Ansätze sowie die Entwicklung eines stabilen Coaching-Mindsets.

Die Ausbildung ist in drei Module unterteilt, die von den Grundlagen über fortgeschrittene Tools bis hin zum digitalen Coaching führen. Ein wesentlicher Bestandteil ist die Reflexion der eigenen Beratungsrolle und die Schärfung der Wahrnehmung für komplexe Beziehungsdynamiken. Teilnehmende lernen, Ressourcen zu aktivieren und Klienten dabei zu unterstützen, eigene Lösungen für berufliche oder persönliche Herausforderungen zu finden.

Die Ausbildung zeichnet sich durch einen hohen Übungsanteil und die Arbeit an realen Praxisfällen aus. Zielgruppe sind Fach- und Führungskräfte, Berater sowie Personen aus dem Bildungs- und Gesundheitswesen, die Coaching als professionelles Instrument in ihren Arbeitsalltag integrieren oder sich als Coach selbstständig machen wollen. Der Abschluss ist international anerkannt und bietet 15 ECTS-Punkte, die für weiterführende Master-Studiengänge angerechnet werden können.',
    'CAS Coaching, Hochschulzertifikat, Coachingausbildung, Systemisches Coaching, Lösungsorientierung, Personal Coaching, ECTS, Führungskräfteentwicklung, Beratungskompetenz, Weiterbildung Coaching, Olten, Business Coaching, Professionelles Coaching',
    ARRAY['Beherrschung systemisch-lösungsorientierter Coaching-Methoden', 'Aufbau und Steuerung von professionellen Beratungsprozessen', 'Entwicklung einer reflektierten professionellen Identität als Coach', 'Anwendung von Coaching-Tools im digitalen und analogen Umfeld', 'Transfer der Coaching-Expertise in komplexe Organisationsstrukturen'],
    'Abschluss einer Hochschule oder vergleichbare Qualifikation sowie mehrjährige Berufserfahrung.',
    9950,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'soft_skills',
    'Kommunikation',
    NULL,
    15,
    '15 Tage (verteilt auf 12 Monate)',
    'https://www.coachingzentrum.ch/ausbildung/cas-coaching/',
    'lead',
    'published',
    false
);

-- 3. CAS Resilienztraining
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
    '7d243795-2d25-4e94-b180-d1b6441ef8f4',
    'CAS Resilienztraining',
    'In einer immer komplexer werdenden Arbeitswelt mit steigenden Belastungen gewinnt die Förderung der psychischen Widerstandskraft massiv an Bedeutung. Das CAS Resilienztraining vermittelt spezialisiertes Wissen und praktische Fertigkeiten, um die Mental Health und Belastbarkeit von Einzelpersonen und Teams nachhaltig zu stärken. Die Ausbildung kombiniert theoretische Grundlagen der Resilienzforschung mit praxisorientierten Trainingsmethoden.

Teilnehmende werden befähigt, als Resilienz-Coach oder Resilienztrainer komplexe Stress- und Burnout-Präventionskonzepte zu entwickeln und umzusetzen. Der Lehrgang umfasst drei Module: Die Grundlagen der Resilienz, die Vertiefung als Coach sowie die spezifische Anwendung als Trainer. Dabei werden sowohl individuelle Schutzfaktoren als auch organisationale Rahmenbedingungen analysiert.

Die Teilnehmenden erarbeiten sich ein breites Repertoire an Interventionen, um Menschen in Krisen zu begleiten und präventiv die Selbstregulationsfähigkeit zu fördern. Das Studium richtet sich an HR-Verantwortliche, Führungskräfte, Coaches und Fachpersonen aus dem Gesundheitsbereich, die ein fundiertes Konzept zur Gesunderhaltung in Organisationen implementieren möchten. Mit dem Abschluss von 15 ECTS-Punkten erlangen die Absolventen eine anerkannte Qualifikation in einem der wichtigsten Zukunftsthemen der modernen Arbeitswelt.',
    'Resilienz, Resilienztraining, Burnout-Prävention, Mental Health, Stressmanagement, Resilienz-Coach, Betriebliches Gesundheitsmanagement, Widerstandskraft, Psychische Gesundheit, CAS, Coaching, Weiterbildung Resilienz, Gesundheit am Arbeitsplatz',
    ARRAY['Fundiertes Verständnis der Resilienzfaktoren und Stressmechanismen', 'Entwicklung und Durchführung von Resilienztrainings für Gruppen', 'Begleitung von Einzelpersonen zur Steigerung der Widerstandskraft', 'Analyse und Förderung organisationaler Resilienzstrukturen', 'Implementierung von Mental Health Strategien in Unternehmen'],
    'Hochschulabschluss oder äquivalente Ausbildung und Praxiserfahrung im Bereich Coaching, HR oder Beratung.',
    10150,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'soft_skills',
    'Resilienz & Stress',
    NULL,
    16,
    '16 Tage (verteilt auf 12 Monate)',
    'https://www.coachingzentrum.ch/ausbildung/cas-resilienztraining/',
    'lead',
    'published',
    false
);

-- 4. CAS Agile Teamcoaching und Supervision
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
    '7d243795-2d25-4e94-b180-d1b6441ef8f4',
    'CAS Agile Teamcoaching und Supervision',
    'Dieser Zertifikatslehrgang widmet sich der professionellen Begleitung von Teams in dynamischen und agilen Arbeitsumfeldern. Aufbauend auf vorhandenem Coaching-Know-how lernen die Teilnehmenden, komplexe Gruppenprozesse zu verstehen und zielführend zu steuern. Der Fokus liegt auf der Rolle des Teamcoaches als Facilitator für Veränderung und Zusammenarbeit.

Das Programm behandelt Themen wie Gruppendynamik, Rollenklärung, Konfliktmanagement und die Förderung eines agilen Mindsets innerhalb von Teams. In drei Modulen werden theoretische Modelle mit intensiven Praxiserfahrungen verknüpft – unter anderem in einem mehrtägigen Blockseminar zur Gruppendynamik an einem externen Lernort. Die Teilnehmenden entwickeln die Fähigkeit, Teams in Transformationsprozessen zu unterstützen, kollektive Werte zu schärfen und die Selbstorganisation zu stärken.

Zudem werden Methoden der Supervision vermittelt, um die Qualität der Teamarbeit nachhaltig zu sichern. Zielgruppe sind erfahrene Coaches, Scrum Master, Agile Coaches und Führungskräfte, die ihre Kompetenz in der Begleitung von Gruppen vertiefen wollen. Der Lehrgang bietet einen fundierten Rahmen, um Teams nicht nur oberflächlich zu beraten, sondern tiefgreifende Entwicklungsprozesse anzustossen, die zu höherer Zufriedenheit und Leistungsfähigkeit führen.',
    'Agile Coaching, Teamcoaching, Supervision, Gruppendynamik, Agile Transformation, Facilitation, Teamentwicklung, Change Management, Agile Führung, Teamprozesse, Coachingausbildung, CAS, Olten, Teamführung',
    ARRAY['Sichere Steuerung von komplexen Gruppen- und Teamprozessen', 'Anwendung agiler Coaching-Methoden und Facilitation-Techniken', 'Durchführung professioneller Teamsupervisionen', 'Erkennen und Nutzen gruppendynamischer Phänomene', 'Förderung von Selbstorganisation und agilem Mindset in Teams'],
    'CAS Coaching oder eine vergleichbare Coaching-Grundausbildung sowie Erfahrung in der Arbeit mit Teams.',
    9700,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'business_mgmt',
    'Agiles Projekt- & Produktmanagement',
    NULL,
    16,
    '16 Tage (verteilt auf 6 Monate)',
    'https://www.coachingzentrum.ch/ausbildungen/cas-agile-teamcoaching/',
    'lead',
    'published',
    false
);

-- 5. MAS Coaching, Resilienz und Supervision
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
    '7d243795-2d25-4e94-b180-d1b6441ef8f4',
    'MAS Coaching, Resilienz und Supervision',
    'Der Master of Advanced Studies (MAS) ist die höchste akademische Qualifizierungsstufe in der Coaching-Weiterbildung des Coachingzentrums Olten. Er bietet eine umfassende Professionalisierung der Beratungskompetenz durch die Kombination von drei spezialisierten CAS-Zertifikatslehrgängen und einem abschliessenden Mastermodul. Die Teilnehmenden können ihre Schwerpunkte individuell aus den Bereichen Coaching, Resilienz, Mentoring oder Teamcoaching wählen.

Dieses modulare System ermöglicht eine massgeschneiderte Expertise, die exakt auf die beruflichen Anforderungen und persönlichen Entwicklungsziele zugeschnitten ist. Das Studium vertieft das Verständnis für komplexe Systeme in Organisationen und schärft das Profil als hochqualifizierte Beratungsperson. Im Mastermodul werden die wissenschaftlichen Grundlagen vertieft und in einer Masterthesis ein spezifisches Fachthema theoretisch fundiert und praxisnah bearbeitet.

Der Abschluss befähigt dazu, anspruchsvolle Mandate in der Organisationsberatung, im Top-Management-Coaching oder in der Supervision zu übernehmen. Absolventen erlangen 60 ECTS-Punkte und erfüllen die Kriterien für anerkannte Fachverbände wie den bso. Zielgruppe sind erfahrene Berufsleute, die eine fundierte, wissenschaftlich abgestützte und praxisorientierte Master-Qualifikation in der Prozessbegleitung anstreben.',
    'MAS Coaching, Master of Advanced Studies, Supervision, Resilienz, Organisationsberatung, Professional Coaching, Masterstudium, Weiterbildung Master, ECTS, bso Anerkennung, Coaching Experte, Olten, Prozessbegleitung',
    ARRAY['Wissenschaftlich fundierte Vertiefung der Beratungsexpertise', 'Integration spezialisierter Fachkenntnisse aus drei CAS-Bereichen', 'Befähigung zur Durchführung komplexer Supervisions- und Coachingmandate', 'Erstellung einer wissenschaftlichen Masterthesis zu einem Praxisthema', 'Erlangung einer umfassenden professionellen Identität als Berater/in'],
    'Hochschulabschluss, Nachweis von drei absolvierten CAS-Lehrgängen (oder Äquivalenz) sowie umfangreiche Praxiserfahrung.',
    NULL,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'soft_skills',
    'Kommunikation',
    NULL,
    67,
    'ca. 67 Präsenztage (über ca. 3.5 Jahre)',
    'https://www.coachingzentrum.ch/ausbildung/mas-coaching-resilienz-und-supervision/',
    'lead',
    'published',
    false
);

-- 6. Supervisor-Coach mit eidg. Diplom
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
    '7d243795-2d25-4e94-b180-d1b6441ef8f4',
    'Supervisor-Coach mit eidg. Diplom',
    'Diese Ausbildung bereitet gezielt auf die Höhere Fachprüfung (HFP) zum Supervisor-Coach mit eidgenössischem Diplom vor. Sie richtet sich an Absolventen des eidg. Fachausweises für betriebliche Mentorinnen und Mentoren oder an Personen mit gleichwertiger Qualifikation, die ihre Beratungskompetenz auf die höchste eidgenössische Stufe heben wollen.

Der Lehrgang ist modular aufgebaut und umfasst ein individuelles Assessment zur Standortbestimmung, ein Vertiefungsmodul zu Transformationsprozessen in Organisationen sowie ein intensives Prüfungstraining. Teilnehmende erweitern ihr Repertoire um fortgeschrittene Interventionsmethoden für Einzel- und Gruppensettings sowie für die Begleitung von Teams in Veränderungsprozessen.

Ein wesentlicher Fokus liegt auf der Entwicklung der persönlichen Berateridentität und der Schärfung der Wahrnehmung für komplexe organisationale Zusammenhänge. Die Ausbildung verbindet theoretische Inputs mit kollegialer Intervision und praktischem Üben unter Supervision. Nach erfolgreichem Abschluss sind die Teilnehmenden anerkannt als Experten für die Qualitätssicherung und Entwicklung von Fachpersonen und Teams in verschiedensten institutionellen Kontexten. Die Ausbildung geniesst eine hohe Anerkennung auf dem Schweizer Arbeitsmarkt und ist subjektfinanziert, was eine Rückerstattung der Kurskosten durch den Bund ermöglicht.',
    'Supervisor-Coach, Eidg. Diplom, Höhere Fachprüfung, HFP, Supervision, Coaching, Organisationsentwicklung, Transformation, Prüfungsvorbereitung, Fachausweis Anschluss, Führungscoaching, Qualitätssicherung, bso',
    ARRAY['Vorbereitung auf die Höhere Fachprüfung (HFP) für das eidg. Diplom', 'Vertiefung der Kompetenzen in Supervision und Teamcoaching', 'Begleitung komplexer Transformationsprozesse in Organisationen', 'Professionalisierung der eigenen Beratungsrolle auf Expertenniveau', 'Beherrschung fortgeschrittener Methoden der Prozessbegleitung'],
    'Eidg. Fachausweis Betriebliche/r Mentor/in oder gleichwertige Ausbildung mit mehrjähriger Praxiserfahrung.',
    7410,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Erwachsenenbildung',
    NULL,
    11,
    '11 Präsenztage (verteilt auf ca. 1.5 Jahre)',
    'https://www.coachingzentrum.ch/ausbildungen/supervisor-coach/',
    'lead',
    'published',
    false
);

-- ============================================
-- VERIFY INSERTED COURSES
-- ============================================
-- SELECT id, title, price, category_area, category_specialty
-- FROM courses
-- WHERE user_id = '7d243795-2d25-4e94-b180-d1b6441ef8f4'
-- ORDER BY created_at DESC;
