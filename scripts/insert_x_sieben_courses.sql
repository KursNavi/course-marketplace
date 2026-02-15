-- ============================================
-- INSERT COURSES FOR X-SIEBEN
-- Provider UUID: a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9
-- ============================================
-- Run this script in Supabase SQL Editor

-- 1. KI Meistern & Effizienz steigern (KI-Akademie)
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'KI Meistern & Effizienz steigern (KI-Akademie)',
    'Die KI-Akademie bietet ein spezialisiertes Portfolio an Weiterbildungen, die darauf abzielen, die Potenziale künstlicher Intelligenz im beruflichen Alltag voll auszuschöpfen. Das Programm reicht von kompakten Einführungen in die Welt der generativen KI bis hin zu intensiven Trainings für Prompt Engineering und die Automatisierung von Geschäftsprozessen. Die Teilnehmenden lernen, wie sie Tools wie ChatGPT, Midjourney oder spezialisierte KI-Assistenten effizient einsetzen, um Texte zu generieren, Daten zu analysieren oder kreative Inhalte zu erstellen.

Ein wesentlicher Fokus liegt auf der Steigerung der individuellen und organisationalen Produktivität durch den gezielten Einsatz von KI-Workflows. Neben den technischen Fertigkeiten werden auch ethische Aspekte, Datenschutz und die strategische Integration von KI in bestehende Unternehmensstrukturen behandelt. Die Kurse sind so konzipiert, dass sowohl Einsteigende ohne technisches Vorwissen als auch fortgeschrittene Anwendende direkt anwendbare Methoden für ihr jeweiliges Fachgebiet erlernen.

Ziel ist es, die Teilnehmenden zu befähigen, als KI-Multiplikatoren in ihren Unternehmen zu agieren und die digitale Transformation aktiv mitzugestalten. Durch praxisnahe Übungen und reale Case Studies wird sichergestellt, dass die erlernten Prompts und Automatisierungen sofort im Arbeitsalltag Zeitersparnis und Qualitätssteigerung bewirken.',
    'KI, Künstliche Intelligenz, ChatGPT, Prompt Engineering, Automatisierung, Effizienz, Digitalisierung, AI Tools, Produktivität, Innovation, Zukunft der Arbeit, Tech-Training',
    ARRAY[
        'Grundverständnis generativer KI und aktueller Sprachmodelle',
        'Beherrschung von Prompt Engineering Techniken für präzise Ergebnisse',
        'Automatisierung repetitiver Aufgaben durch KI-gestützte Workflows',
        'Strategische Implementierung von KI-Tools im Team oder Unternehmen'
    ],
    'Keine formalen Voraussetzungen; grundlegende Computerkenntnisse erforderlich.',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'beruflich',
    'it_digital',
    'AI & Machine Learning',
    NULL,
    NULL,
    'Variabel (meist 1 bis 3 Tage)',
    'https://x-sieben.at/ki-meistern-effizienz-steigern/',
    'lead',
    'published',
    true
);

-- 2. Coaching Akademie – Systemische & Business Ausbildung
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Coaching Akademie – Systemische & Business Ausbildung',
    'Die Coaching Akademie vereint fundierte theoretische Konzepte mit intensiver praktischer Selbsterfahrung, um Teilnehmende auf ihrem Weg zum professionellen Coach zu begleiten. Das Programm umfasst verschiedene Ausbildungsstufen, die auf systemischen Coaching-Ansätzen basieren und speziell auf die Anforderungen der modernen Arbeitswelt zugeschnitten sind. Die Ausbildungsgänge decken das gesamte Spektrum ab – von der Begleitung individueller Veränderungsprozesse bis hin zum Team-Coaching in komplexen Organisationsstrukturen.

Die Teilnehmenden erlernen ein breites Repertoire an Interventionsmethoden, Fragetechniken und Moderationswerkzeugen, um Klienten ressourcen- und lösungsorientiert zu unterstützen. Ein zentraler Bestandteil ist die Entwicklung der eigenen Coach-Identität sowie die Reflexion der professionellen Rolle. Die Lehrgänge bereiten zudem auf anerkannte Zertifizierungen vor, die den hohen Qualitätsstandards im Business-Coaching entsprechen.

Zielgruppe sind Führungskräfte, Personalverantwortliche, Berater und Personen, die eine berufliche Neuorientierung im Bereich Coaching anstreben. Durch die Arbeit in Kleingruppen und die Supervision durch erfahrene Lehrcoaches wird eine hohe Ausbildungsqualität sichergestellt. Absolventen sind in der Lage, professionelle Coaching-Settings eigenständig zu gestalten und nachhaltige Entwicklungsprozesse in Gang zu setzen.',
    'Coaching, Systemisches Coaching, Business Coaching, Personalentwicklung, Führung, Beratung, Kommunikation, Teamentwicklung, Coaching Ausbildung, Zertifizierung, Supervision',
    ARRAY[
        'Erwerb systemischer Coaching-Kompetenzen und Interventionsmethoden',
        'Professionelle Gesprächsführung und lösungsorientierte Fragetechniken',
        'Begleitung von Teams und Einzelpersonen in Veränderungsprozessen',
        'Zertifizierungsvorbereitung für professionelle Coaching-Standards'
    ],
    'Abgeschlossene Berufsausbildung oder Studium; soziale Kompetenz und Reflexionsbereitschaft.',
    NULL,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'business_mgmt',
    'Leadership & Teamführung',
    NULL,
    NULL,
    'Mehrere Monate (berufsbegleitend)',
    'https://x-sieben.at/weiterbildung-uebersicht-coaching-akademie-kurse/',
    'lead',
    'published',
    true
);

-- 3. Marketing, Social Media & Vertrieb – Performance Portfolio
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Marketing, Social Media & Vertrieb – Performance Portfolio',
    'Dieses Ausbildungsportfolio bietet eine ganzheitliche Qualifizierung für die zentralen Wachstumsbereiche moderner Unternehmen. In einer digitalisierten Welt verknüpfen die Lehrgänge strategisches Marketing mit operativem Social Media Management und modernen Vertriebstechniken. Das Angebot umfasst Kurse zu Performance Marketing, SEO/SEA, Content Strategie sowie Eventmanagement und professionellem Verkaufs-Training.

Die Teilnehmenden lernen, wie sie Zielgruppen präzise analysieren, Markenbotschaften effektiv platzieren und messbare Verkaufserfolge erzielen. Ein besonderer Schwerpunkt liegt auf der Verzahnung von Marketing-Automatisierung und persönlichem Vertrieb, um die gesamte Customer Journey optimal zu bespielen. Durch die Vermittlung von aktuellem Know-how in Bereichen wie Influencer Marketing oder Social Selling bleiben die Absolventen am Puls der Zeit.

Die praxisnahe Ausbildung ermöglicht es, eigene Projekte direkt in die Seminare einzubringen und unter Anleitung von Experten Marketingpläne oder Vertriebsstrategien zu entwickeln. Ob für KMU, Start-ups oder Grosskonzerne – das Portfolio bietet massgeschneiderte Lösungen für alle, die ihre Marktpräsenz stärken und den Umsatz nachhaltig steigern wollen. Die Abschlüsse orientieren sich an marktrelevanten Standards und bescheinigen eine umfassende Handlungskompetenz in der Marktkommunikation.',
    'Marketing, Social Media, Vertrieb, Sales, SEO, Content Marketing, Eventmanagement, Online Marketing, Kommunikation, Werbung, Verkaufstraining, Branding, Strategie',
    ARRAY[
        'Entwicklung und Umsetzung integrierter Marketingstrategien',
        'Beherrschung von Social Media Kanälen und Content Creation',
        'Anwendung moderner Vertriebs- und Verhandlungstechniken',
        'Planung und Durchführung professioneller Events und Kampagnen'
    ],
    'Keine formalen Voraussetzungen; Interesse an Kommunikation und digitalen Medien.',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'beruflich',
    'marketing',
    'Online-Marketing & Social Media',
    NULL,
    NULL,
    'Variabel (2 bis 10 Tage oder längere Lehrgänge)',
    'https://x-sieben.at/weiterbildung-uebersicht-marketing-social-media-vertrieb-eventmanagement-akademie-kurse/',
    'lead',
    'published',
    true
);

-- 4. Trainer & Erwachsenenbildung (ISO 17024 & DaF/DaZ)
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Trainer & Erwachsenenbildung (ISO 17024 & DaF/DaZ)',
    'Dieser Bereich widmet sich der professionellen Ausbildung von Lehrenden in der Erwachsenenbildung. Das Angebot umfasst die klassische Trainer-Ausbildung nach internationalem Standard (ISO 17024) sowie spezialisierte Lehrgänge für Deutsch als Fremdsprache (DaF) und Deutsch als Zweitsprache (DaZ). Die Teilnehmenden erwerben fundierte Kenntnisse in Didaktik, Methodik und Seminargestaltung, um Lerninhalte lebendig und zielgruppengerecht zu vermitteln.

Ein Schwerpunkt liegt auf der Moderation von Gruppenprozessen, dem Umgang mit schwierigen Seminarsituationen und dem Einsatz moderner Präsentationsmedien. In den DaF/DaZ-Modulen lernen die angehenden Lehrkräfte zudem die spezifischen sprachwissenschaftlichen und interkulturellen Anforderungen des Sprachunterrichts kennen.

Die Ausbildung legt grossen Wert auf den Transfer in die Praxis: In zahlreichen Übungssequenzen erhalten die Teilnehmenden direktes Feedback auf ihr Auftreten und ihre Lehrmethoden. Ziel ist es, Trainer zu entwickeln, die sowohl fachlich als auch pädagogisch souverän agieren und Lernprozesse nachhaltig fördern können. Die ISO-Zertifizierung bietet zudem einen weltweit anerkannten Kompetenznachweis, der die Qualität der eigenen Trainerleistung objektiv belegt und neue Karrierechancen im Bildungssektor eröffnet.',
    'Trainer Ausbildung, Erwachsenenbildung, ISO 17024, DaF, DaZ, Didaktik, Methodik, Lehrgang, Pädagogik, Moderation, Präsentation, Train-the-Trainer',
    ARRAY[
        'Professionelle Planung und Durchführung von Seminaren',
        'Anwendung vielfältiger didaktischer Methoden und Tools',
        'Qualifizierung als DaF/DaZ-Lehrkraft für den Sprachunterricht',
        'Vorbereitung auf die Zertifizierung als Fachtrainer nach ISO 17024'
    ],
    'Abgeschlossene Fachausbildung oder Studium; Freude an der Arbeit mit Menschen.',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    NULL,
    'Variabel (meist 5 bis 15 Tage)',
    'https://x-sieben.at/weiterbildung-uebersicht-trainerinnen-ausbildung-daf-daz-iso-17024-zertifizierung-kurse/',
    'lead',
    'published',
    true
);

-- 5. Logistik & Materialwirtschaft – Supply Chain Management
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Logistik & Materialwirtschaft – Supply Chain Management',
    'Das Portfolio für Logistik und Materialwirtschaft vermittelt das notwendige Expertenwissen, um globale Lieferketten effizient zu gestalten und Ressourcen optimal zu verwalten. Die Lehrgänge decken alle relevanten Bereiche vom strategischen Einkauf über das Bestandsmanagement bis hin zur Distributionslogistik ab. Teilnehmende lernen, wie sie Logistikprozesse analysieren, Kostenpotenziale identifizieren und moderne Technologien zur Prozessoptimierung einsetzen.

Ein Fokus liegt auf dem Supply Chain Management (SCM), bei dem die gesamte Wertschöpfungskette im Blick behalten wird, um Durchlaufzeiten zu verkürzen und die Lieferfähigkeit zu erhöhen. Die Ausbildung behandelt zudem aktuelle Trends wie grüne Logistik, Digitalisierung der Lagerhaltung und Risikomanagement in globalen Netzwerken.

Die praxisnahen Seminare richten sich an Fachkräfte aus Industrie, Handel und Dienstleistung, die ihre Kompetenzen in der Materialwirtschaft vertiefen oder sich für Leitungsfunktionen qualifizieren möchten. Durch die Kombination von betriebswirtschaftlichen Grundlagen und spezifischem Logistik-Know-how erlangen die Absolventen ein tiefes Verständnis für die Zusammenhänge moderner Warenströme. Dies befähigt sie, massgeblich zur Wettbewerbsfähigkeit ihres Unternehmens beizutragen und komplexe logistische Herausforderungen souverän zu lösen.',
    'Logistik, Materialwirtschaft, Supply Chain, Einkauf, Lagerhaltung, Prozessmanagement, SCM, Versand, Bestandsmanagement, Industrie 4.0, Transport',
    ARRAY[
        'Optimierung von Beschaffungs- und Lagerprozessen',
        'Verständnis und Gestaltung von Supply Chain Netzwerken',
        'Anwendung von Methoden zur Logistik-Kostenrechnung',
        'Einsatz von IT-Systemen in der Materialwirtschaft'
    ],
    'Kaufmännische oder technische Grundausbildung; Erfahrung in der Logistik von Vorteil.',
    NULL,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'beruflich',
    'industrie_bau',
    'Logistik & Supply Chain',
    NULL,
    NULL,
    'Variabel (3 bis 8 Tage)',
    'https://x-sieben.at/weiterbildung-uebersicht-logistik-materialwirtschaft-akademie-kurse/',
    'lead',
    'published',
    true
);

-- 6. Human Resources Management & Recruiting
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Human Resources Management & Recruiting',
    'Dieses Ausbildungssegment bietet eine umfassende Qualifizierung für alle Facetten des modernen Personalwesens. Das Angebot erstreckt sich von HR-Generalisten-Lehrgängen bis hin zu Spezialisierungen im modernen Recruiting, Employer Branding und Talent Management. Die Teilnehmenden erlernen die strategische Planung des Personalbedarfs ebenso wie die operative Umsetzung von Personalentwicklungsmassnahmen.

Ein zentraler Bestandteil ist das Recruiting in Zeiten des Fachkräftemangels: Hier werden innovative Methoden wie Active Sourcing und Social Media Recruiting vermittelt. Zudem werden rechtliche Grundlagen des Arbeitsrechts praxisnah aufbereitet, um Sicherheit in der täglichen Personalarbeit zu gewinnen. Die Lehrgänge betrachten den gesamten Mitarbeiterzyklus (Employee Lifecycle) – vom Onboarding bis zum Offboarding. Auch Themen wie New Work im HR-Kontext, Change Management und Mitarbeiterbindung stehen im Fokus.

Die Ausbildung richtet sich an HR-Einsteiger, Führungskräfte sowie erfahrene Personalverantwortliche, die ihr Wissen aktualisieren und professionalisieren möchten. Ziel ist es, HR als strategischen Partner im Unternehmen zu positionieren und die Arbeitswelt der Zukunft aktiv mitzugestalten. Die Absolventen verfügen über ein breites Instrumentarium, um die besten Talente zu gewinnen und langfristig ans Unternehmen zu binden.',
    'HR, Human Resources, Personalmanagement, Recruiting, Personalentwicklung, Arbeitsrecht, Employer Branding, Talent Management, Onboarding, Change Management, Personalwesen',
    ARRAY[
        'Beherrschung des gesamten HR-Management-Instrumentariums',
        'Modernes Recruiting und Employer Branding Strategien',
        'Grundlagen des Arbeitsrechts und der Personaladministration',
        'Gestaltung von Personalentwicklung und Mitarbeiterbindung'
    ],
    'Keine formalen Voraussetzungen; Berufserfahrung im kaufmännischen Bereich von Vorteil.',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'beruflich',
    'hr_recht',
    'Recruiting & Personalmarketing',
    NULL,
    NULL,
    'Variabel (3 bis 10 Tage)',
    'https://x-sieben.at/weiterbildung-uebersicht-human-resources-akademie-kurse/',
    'lead',
    'published',
    true
);

-- 7. Digitale Bildung – eLearning & Blended Learning Design
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Digitale Bildung – eLearning & Blended Learning Design',
    'In diesem Portfolio dreht sich alles um die Konzeption und Umsetzung moderner Lernformate. Die Kurse richten sich an Bildungsverantwortliche, Trainer und Lehrende, die den Schritt in die digitale Wissensvermittlung gehen möchten. Die Teilnehmenden erlernen, wie sie effektive eLearning-Szenarien entwerfen, Learning Management Systeme (LMS) einsetzen und interaktive Lerninhalte erstellen.

Ein besonderer Fokus liegt auf dem Design von Blended Learning Konzepten, die das Beste aus Präsenzunterricht und Online-Phasen kombinieren. Die Ausbildung vermittelt mediendidaktische Grundlagen ebenso wie technisches Know-how zur Produktion von Lernvideos, Webinaren und Microlearning-Einheiten. Auch der Einsatz von KI zur Content-Erstellung und die Gamifizierung von Lerninhalten werden thematisiert.

Die Praxisnähe wird durch die Arbeit an eigenen Projekten sichergestellt: Die Teilnehmenden entwickeln während der Ausbildung erste eigene digitale Kursmodule. Ziel ist es, die Qualität und Flexibilität betrieblicher oder schulischer Aus- und Weiterbildung durch digitale Werkzeuge massgeblich zu steigern. Absolventen sind in der Lage, zeitgemässe Bildungslösungen zu entwickeln, die den Bedürfnissen moderner Lernender nach zeitlicher und örtlicher Flexibilität gerecht werden.',
    'eLearning, Blended Learning, Digitale Bildung, Instructional Design, LMS, Virtual Classroom, Mediendidaktik, Online-Training, Bildungsmanagement, Content Creation',
    ARRAY[
        'Konzeption didaktisch wertvoller Online-Lernpfade',
        'Erstellung interaktiver digitaler Lerninhalte und Medien',
        'Sicherer Umgang mit LMS und Virtual Classroom Tools',
        'Implementierung von Blended Learning in Organisationen'
    ],
    'Grundlegende IT-Kenntnisse; Erfahrung im Trainings- oder Lehrbereich von Vorteil.',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'beruflich',
    'bildung_pruefung',
    'Erwachsenenbildung',
    NULL,
    NULL,
    'Variabel (3 bis 8 Tage)',
    'https://x-sieben.at/weiterbildung-uebersicht-elearning-blended-learning-akademie-kurse/',
    'lead',
    'published',
    true
);

-- 8. Betriebswirtschaft & Management Essentials
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Betriebswirtschaft & Management Essentials',
    'Dieses Management-Portfolio bietet eine fundierte Ausbildung in den Kernbereichen der Betriebswirtschaft. Die Lehrgänge richten sich sowohl an angehende Führungskräfte als auch an Fachkräfte ohne wirtschaftswissenschaftlichen Hintergrund, die unternehmerisches Denken und Handeln erlernen möchten. Das Spektrum reicht von den Grundlagen der BWL über Controlling und Finanzwesen bis hin zu strategischem Management und Unternehmensführung.

Die Teilnehmenden lernen, Bilanzen zu lesen, Kostenrechnungen zu erstellen und Businesspläne zu entwickeln. Ein weiterer Fokus liegt auf der Entwicklung von Leadership-Skills: Führungstechniken, Konfliktmanagement und strategische Entscheidungsfindung sind zentrale Bestandteile der Fortgeschrittenen-Module. Die praxisorientierte Vermittlung stellt sicher, dass theoretische Modelle direkt auf reale Geschäftssituationen angewendet werden können.

Ziel ist es, ein tiefes Verständnis für die wirtschaftlichen Zusammenhänge im Unternehmen zu schaffen und die Teilnehmenden zu befähigen, Verantwortung für Budgets und Teams zu übernehmen. Ob als Vorbereitung auf die Selbstständigkeit oder für den nächsten Karriereschritt im Management – die Lehrgänge vermitteln das notwendige Rüstzeug für eine erfolgreiche Unternehmenssteuerung in einem dynamischen Marktumfeld.',
    'Betriebswirtschaft, BWL, Management, Controlling, Buchhaltung, Strategie, Unternehmensführung, Leadership, Businessplan, Finanzwesen, Management-Training',
    ARRAY[
        'Beherrschung betriebswirtschaftlicher Kennzahlen und Instrumente',
        'Entwicklung strategischer Management-Kompetenzen',
        'Befähigung zur Budgetverantwortung und Kostensteuerung',
        'Ausbau von Leadership- und Führungskompetenzen'
    ],
    'Keine formalen Voraussetzungen; Interesse an wirtschaftlichen Zusammenhängen.',
    NULL,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'beruflich',
    'business_mgmt',
    'Unternehmensstrategie & Geschäftsmodelle',
    NULL,
    NULL,
    'Variabel (3 bis 10 Tage oder längere Lehrgänge)',
    'https://x-sieben.at/weiterbildung-uebersicht-betriebswirtschaft-management-akademie-kurse/',
    'lead',
    'published',
    true
);

-- 9. Individuelles Business & Personal Coaching
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
    'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9',
    'Individuelles Business & Personal Coaching',
    'Das individuelle Coaching-Angebot bietet massgeschneiderte Begleitung für spezifische berufliche und persönliche Herausforderungen. Im Gegensatz zu Gruppen-Seminaren steht hier die individuelle Situation des Klienten im Fokus eines exklusiven 1-zu-1-Settings. Die Anlässe für ein solches Coaching sind vielfältig: Sie reichen von der Vorbereitung auf neue Führungsaufgaben und der Bewältigung von Krisensituationen bis hin zur Karriereplanung und der Steigerung der persönlichen Performance.

In einem vertrauensvollen Rahmen arbeiten erfahrene Coaches gemeinsam mit den Klienten an konkreten Zielen, reflektieren Verhaltensmuster und entwickeln neue Lösungsstrategien. Das Coaching nutzt systemische und lösungsorientierte Ansätze, um Blockaden zu lösen und verborgene Ressourcen zu aktivieren. Die Termine und Inhalte werden flexibel auf den Bedarf und den Terminkalender des Klienten abgestimmt. Dies ermöglicht eine besonders hohe Intensität und Effizienz der Zusammenarbeit.

Ziel ist es, die Selbstreflexionsfähigkeit zu stärken und die individuelle Handlungssouveränität in komplexen Umgebungen nachhaltig zu erhöhen. Ob zur Burnout-Prävention, zur Optimierung des Selbstmanagements oder zur strategischen Neuorientierung – das individuelle Coaching bietet den Raum für tiefgehende Entwicklungsschritte.',
    'Coaching, Einzelcoaching, Karriere, Persönlichkeitsentwicklung, Führungscoaching, Beratung, Burnout-Prävention, Selbstmanagement, Mentoring, Life Coaching',
    ARRAY[
        'Klärung individueller beruflicher und persönlicher Ziele',
        'Entwicklung massgeschneiderter Lösungsstrategien',
        'Stärkung der Führungspersönlichkeit und Entscheidungskraft',
        'Reflexion und Optimierung des eigenen Verhaltens und Wirkens'
    ],
    'Bereitschaft zur Selbstreflexion und aktiven Mitarbeit am eigenen Entwicklungsprozess.',
    NULL,
    'mixed',
    ARRAY['Deutsch'],
    ARRAY['presence', 'online_live'],
    'beruflich',
    'soft_skills',
    'Kommunikation',
    NULL,
    NULL,
    'Einheiten à 60 oder 90 Minuten',
    'https://x-sieben.at/coaching/',
    'lead',
    'published',
    true
);

-- ============================================
-- VERIFY INSERTED COURSES
-- ============================================
-- SELECT id, title, price, category_area, category_specialty
-- FROM courses
-- WHERE user_id = 'a4669b2a-e1d6-4ec5-bd41-8f1149aacbc9'
-- ORDER BY created_at DESC;
