-- ============================================
-- AquaKidz Kurse - Schwimmschule
-- Provider UUID: a731e532-6d5a-4140-8d10-ac11db4680d1
-- Erstellt: 2026-02-18
-- ============================================

-- Hinweise:
-- - Alle Kurse sind "lead" Typ (Anfrage/Kontakt beim Anbieter)
-- - Preis, Lektionen, Dauer sind teilweise "offen" (NULL) da auf Anbieter-Website
-- - Status: 'published' für sofortige Sichtbarkeit
-- - Kategorien: kinder_jugend > fruehkind / freizeit_hobbys / ferien

-- ============================================
-- 1. AquaBaby – Babyschwimmen (ab 10 Wochen)
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
    'a731e532-6d5a-4140-8d10-ac11db4680d1',
    'AquaBaby – Babyschwimmen (ab 10 Wochen)',
    'AquaBaby richtet sich an Babys ab etwa 10 Wochen und eine begleitende Bezugsperson im Wasser. In einem ruhigen, kindgerechten Setting steht die frühe Wassergewöhnung im Vordergrund: Babys erleben Auftrieb, Temperatur, Wassergeräusche und Bewegung als vertraut und sicher. Die Begleitperson lernt, wie sie das Baby stabil hält, sanft führt und spielerische Impulse setzt, ohne zu überfordern. Typisch sind kurze, wiederholte Sequenzen mit Liedern, Grifftechniken, leichten Rotationen und einfachen Bewegungsanreizen, damit sich Vertrauen und Körpergefühl Schritt für Schritt entwickeln. Für Eltern ist der Kurs auch ein praktischer Rahmen, um Sicherheit im Umgang mit dem Baby im Wasser aufzubauen und alltagstaugliche Rituale für Schwimmbadbesuche zu etablieren. Je nach Kursort gelten unterschiedliche Eintrittsregelungen; für Babys ist eine Schwimmwindel obligatorisch. Die Einheit ist als kompakte Lektion konzipiert, damit Konzentration und Belastung dem Alter entsprechen.',
    ARRAY['Wasser als sicheren Raum erleben und positive Routine aufbauen', 'Stabile Halte- und Grifftechniken für Begleitpersonen anwenden', 'Auftrieb und Gleichgewicht spielerisch erfahren', 'Erste altersgerechte Bewegungsimpulse im Wasser unterstützen', 'Grundlagen für sichere Schwimmbadabläufe (Ein-/Ausstieg, Randkontakt) etablieren'],
    'Babyschwimmen, Wassergewöhnung, Eltern-Baby-Kurs, frühkindliche Motorik, Schwimmwindel, Wasservertrauen, Bindung im Wasser, Babyaktivität, Luzern, Zürich',
    'Baby ab ca. 10 Wochen; Schwimmwindel obligatorisch',
    'kinder_jugend',
    'fruehkind',
    'Babyschwimmen',
    'kinder_jugend | Frühkind & Eltern-Kind (0-5)',
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://aquakidz.ch/babyschwimmen/',
    'published',
    NULL,
    NULL,
    30
);

-- ============================================
-- 2. AquaKidz Mini – Eltern-Kind Schwimmen (ab 2 Jahre)
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
    'a731e532-6d5a-4140-8d10-ac11db4680d1',
    'AquaKidz Mini – Eltern-Kind Schwimmen (ab 2 Jahre)',
    'AquaKidz Mini ist ein Eltern-Kind-Angebot für Kinder ab etwa 2 Jahren mit einer Begleitperson im Wasser. Der Kurs verbindet spielerische Wassergewöhnung mit ersten Grundlagen der Wassersicherheit: Kinder lernen, sich im Beckenbereich zu orientieren, den Rand gezielt zu nutzen, Ein- und Ausstiege sicher zu üben und einfache Bewegungsmuster aufzubauen. Die Begleitperson übernimmt dabei eine aktive Rolle – sie unterstützt, motiviert und sorgt für Stabilität, während die Kursleitung kindgerechte Aufgaben und kleine Lernschritte vorgibt. Durch wiederkehrende Abläufe entsteht Verlässlichkeit, was besonders für Kinder im Vorschulalter wichtig ist. Der Kurs eignet sich sowohl für Familien mit wenig Wassererfahrung als auch für Kinder, die bereits gerne planschen, aber mehr Struktur und sichere Technikbausteine brauchen. Die Lektion ist kompakt gehalten, damit Aufmerksamkeit und Energie dem Alter entsprechen. Je nach Kursort gelten organisatorische Regeln (z.B. Begrenzung auf eine Begleitperson).',
    ARRAY['Vertrauen im Wasser aufbauen und sich im Becken sicher bewegen', 'Sichere Ein- und Ausstiege sowie Randverhalten üben', 'Erste koordinative Grundmuster (Gleiten, Treten, Armbewegungen) erleben', 'Regeln und Sicherheitsroutinen im Schwimmbad kennenlernen', 'Begleitpersonen befähigen, sinnvoll zu unterstützen statt zu tragen'],
    'Eltern-Kind-Schwimmen, Kleinkind schwimmen, Wassergewöhnung, Wassersicherheit, Schwimmkurs ab 2, Motorik, Zürich, Schwyz, Rapperswil-Jona, spielerisch lernen',
    'Kind ab ca. 2 Jahre; je Kursort teils nur 1 Begleitperson pro Kind',
    'kinder_jugend',
    'fruehkind',
    'Eltern-Kind-Turnen (Muki/Vaki)',
    'kinder_jugend | Frühkind & Eltern-Kind (0-5)',
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://aquakidz.ch/eltern-kind-kurse/',
    'published',
    NULL,
    NULL,
    30
);

-- ============================================
-- 3. AquaMixed – Schwimmtraining (ab 7 Jahre)
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
    'a731e532-6d5a-4140-8d10-ac11db4680d1',
    'AquaMixed – Schwimmtraining (ab 7 Jahre)',
    'AquaMixed ist ein Schwimmtraining für Kinder ab etwa 7 Jahren, die ihre Technik und Ausdauer systematisch weiterentwickeln möchten. Der Kurs eignet sich für Kinder, die Schwimmen als gesunde Freizeitaktivität betreiben oder sich perspektivisch auf Vereinsschwimmen vorbereiten wollen, ohne dass der Fokus auf Wettkampfdruck liegt. In den Trainingseinheiten werden Bewegungsabläufe verfeinert, Koordination und Wasserlage verbessert sowie effiziente Technikbausteine schrittweise aufgebaut. Regelmässiges Schwimmen wird dabei als ganzheitliche Sportart verstanden, die Fitness, Konzentration und Wohlbefinden unterstützt. Organisatorisch ist das Training in Kursblöcke gegliedert; es werden Kursperioden mit 10 oder 12 Lektionen ausgewiesen. Die Lektionsdauer ist als Trainingseinheit länger als bei den Kleinkindformaten. Für eine passende Einteilung ist eine solide Grundsicherheit im Wasser sinnvoll.',
    ARRAY['Wasserlage, Atmung und Rhythmus stabilisieren', 'Technikbausteine (z.B. effizienter Beinschlag, Zugmuster) verbessern', 'Ausdauer und Kraft im Wasser altersgerecht aufbauen', 'Selbstständigkeit im Training (Start/Stop, Bahnregeln, Fokus) stärken', 'Sicherheitsbewusstsein und kontrolliertes Üben festigen'],
    'Schwimmtraining, Techniktraining, Ausdauer im Wasser, Kinder ab 7, Vorbereitung Vereinsschwimmen, J+S, Wasserlage, Kraultechnik, Rückenkraul, Schwimmfitness, AquaMixed',
    'Sicher im Wasser; sinnvoll sind absolvierte Grundlagenkurse oder vergleichbare Schwimmkompetenz',
    'kinder_jugend',
    'freizeit_hobbys',
    'Kinderturnen & Sport',
    'kinder_jugend | Hobbys, Sport & Kreatives',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://aquakidz.ch/schwimmtraining/',
    'published',
    NULL,
    NULL,
    45
);

-- ============================================
-- 4. AquaVacation – Ferien-Intensivkurse Schwimmen (ab 4 Jahre)
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
    'a731e532-6d5a-4140-8d10-ac11db4680d1',
    'AquaVacation – Ferien-Intensivkurse Schwimmen (ab 4 Jahre)',
    'AquaVacation umfasst Intensiv-Ferienkurse in den Schulferien für Kinder ab etwa 4 Jahren. Das Format ist als Lernwoche aufgebaut: An fünf aufeinanderfolgenden Tagen wird täglich geübt, sodass Fortschritte direkt aufeinander aufbauen können. Die Standard-Intensivkurse sind mit 5 × 40 Minuten Kurszeit beschrieben und eignen sich für Anfänger wie auch Fortgeschrittene. Die Gruppeneinteilung erfolgt entlang der Schweizer Grundabzeichen; für das erste Level (Krebs) sind keine Voraussetzungen nötig, für höhere Abzeichen wird das vorherige Level vorausgesetzt. Neben den Gruppenkursen werden je nach Woche auch Privatlektionen als Ferienformat erwähnt (5 Lektionen à 30 Minuten) sowie Specials (z.B. Training/Flossen/Mermaid) mit abweichender Kurszeit und klarer Voraussetzung: sicheres Schwimmen & Tauchen. Organisatorisch wird darauf hingewiesen, dass Kursgelder grundsätzlich exklusive Eintrittsgelder sind und kursortspezifische Regeln gelten.',
    ARRAY['Schnelle Stabilisierung von Technik durch tägliches Üben', 'Sicheres Bewegen im Wasser gemäss Kursniveau (Grundabzeichen-System)', 'Abzeichen gezielt vorbereiten, nachholen oder festigen', 'Wasservertrauen, Orientierung und Regelverständnis im Bad stärken', 'Fortgeschrittene: Technik- und Tauchkompetenz für Specials weiterentwickeln'],
    'Ferienkurs Schwimmen, Intensivkurs, Sportferien, Sommerferienkurs, Schwimmabzeichen, Krebs Abzeichen, Schwimmkurs ab 4, tägliches Training, Kinderferienprogramm, Langnau am Albis, Kilchberg',
    'Level 1 (Krebs): keine; höhere Levels: Vorkenntnisse des vorherigen Levels; Specials: sicheres Schwimmen & Tauchen',
    'kinder_jugend',
    'ferien',
    'Sportcamps',
    'kinder_jugend | Feriencamps & Betreuung',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://aquakidz.ch/ferienkurse/',
    'published',
    NULL,
    5,
    40
);

-- ============================================
-- 5. AquaPrivate – Privatkurse Schwimmen (Kinder & Erwachsene)
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
    'a731e532-6d5a-4140-8d10-ac11db4680d1',
    'AquaPrivate – Privatkurse Schwimmen (Kinder & Erwachsene)',
    'AquaPrivate bietet individuell geplanten Privatunterricht im Wasser für Kinder und Erwachsene. Das Format eignet sich besonders, wenn fixe Gruppenkurszeiten nicht passen, wenn eine sehr persönliche Betreuung gewünscht ist oder wenn in der Gruppe ein Lernplateau entsteht. Der Unterricht ist als intensives 1:1-Coaching beschrieben; alternativ sind Halbprivatkurse bis zu drei Teilnehmenden möglich. Dadurch kann die Kursleitung Tempo, Übungsauswahl, Hilfsmittel und Schwierigkeitsgrad direkt an Ziel und Tagesform anpassen. Typische Schwerpunkte reichen von angstfreiem Ankommen im Wasser über sicheres Tauchen bis hin zu Technik-Feinschliff. Auch für Babys wird eine Familien-Privatlektion als geschützter Rahmen beschrieben, in dem nur Bezugsperson, Baby und Trainer im Becken sind. Die Lektion ist kompakt konzipiert; Rückmeldungen erfolgen unmittelbar. Inhalte und Anzahl Termine werden grundsätzlich nach Bedarf vereinbart.',
    ARRAY['Individuelle Schwimmziele präzise definieren und erreichen', 'Technikfehler schnell erkennen und gezielt korrigieren', 'Sicherheitskompetenzen (z.B. Randverhalten, Tauchen, Selbstrettung) stärken', 'Selbstvertrauen durch messbare Fortschritte aufbauen', 'Flexibel an Alltag, Lerntempo und Motivation anpassen'],
    'Privatlektion Schwimmen, Einzelunterricht, Halbprivatkurs, Schwimmcoaching, Technik verbessern, Schwimmangst, Babys Privatlektion, Erwachsene schwimmen lernen, flexible Termine, 1:1 Betreuung, AquaPrivate',
    'Keine formalen Voraussetzungen (Ziele/Level werden im Kursplan abgestimmt)',
    'kinder_jugend',
    'freizeit_hobbys',
    'Kinderturnen & Sport',
    'kinder_jugend | Hobbys, Sport & Kreatives',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://aquakidz.ch/privatkurse/',
    'published',
    NULL,
    NULL,
    30
);

-- ============================================
-- 6. AquaMermaid – Meerjungfrauen Schwimmkurs (ab ca. 7 Jahre)
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
    'a731e532-6d5a-4140-8d10-ac11db4680d1',
    'AquaMermaid – Meerjungfrauen Schwimmkurs (ab ca. 7 Jahre)',
    'AquaMermaid ist ein Meerjungfrauen-Schwimmkurs für Kinder ab etwa 7 Jahren, der sich an Mädchen und Jungen richtet, die sich sicher im Wasser bewegen. Der Kurs kombiniert Erlebnis und Technik: Teilnehmende lernen, sich mit Monoflosse fortzubewegen, kontrolliert zu gleiten, verschiedene Schwimmtechniken passend anzuwenden und Bewegungsabläufe im Wasser zu optimieren. Im Programm enthalten sind auch Sicherheit und Materialkunde, damit der Umgang mit Flosse und Kursmaterial verantwortungsvoll erfolgt. Die Kursstruktur ist als Grund- und Aufbaukurse beschrieben; insgesamt umfasst jeder Mermaidkurs 10 Lektionen. Obwohl keine speziellen Schwimmkenntnisse gefordert sind, wird ausdrücklich erwähnt, dass das Kind sicher schwimmen und tauchen können sollte und idealerweise bereits Grundlagenkurse in einer Schwimmschule absolviert hat. Der Kurs eignet sich damit für Kinder, die ein klares Themenmotiv suchen und gleichzeitig ihre Wasserkompetenz vertiefen möchten.',
    ARRAY['Sicherer Umgang mit Monoflosse und Kursmaterial', 'Effizientes Gleiten und Fortbewegung mit Monoflosse', 'Verbesserung von Koordination, Wasserlage und Bewegungsfluss', 'Anwendung und Verfeinerung passender Schwimmtechniken', 'Sicherheitsroutinen (insb. beim Tauchen/Atmen) festigen'],
    'Meerjungfrauenkurs, Monoflosse, Mermaid schwimmen, Flossenschwimmen, Kinder ab 7, Tauchen, Wasserlage, Schwimmtechnik, AquaMermaid, Spezialkurs Schwimmen',
    'Sicher schwimmen und tauchen; idealerweise absolvierte Grundlagenkurse',
    'kinder_jugend',
    'freizeit_hobbys',
    'Kinderturnen & Sport',
    'kinder_jugend | Hobbys, Sport & Kreatives',
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://aquakidz.ch/aquamermaid-meerjungfrauen-schwimmkurs/',
    'published',
    NULL,
    10,
    NULL
);

-- ============================================
-- 7. AquaBirthday – Geburtstagsparty im Wasser (ab 4 Jahre)
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
    'a731e532-6d5a-4140-8d10-ac11db4680d1',
    'AquaBirthday – Geburtstagsparty im Wasser (ab 4 Jahre)',
    'AquaBirthday ist eine organisierte Geburtstagsparty im Hallenbad Langnau am Albis, standardmässig am Samstag von 13:30 bis 16:30 Uhr, weitere Termine sind nach Absprache möglich. Im Zentrum steht eine betreute Pool-Party mit Programm und Animation; es wird eine Wasserzeit von 1 Stunde genannt. Die Durchführung ist ab mindestens 5 Kindern ab 4 Jahren (inkl. Geburtstagskind) vorgesehen; es müssen nicht alle Gäste schwimmen können. Die Betreuung erfolgt durch Schwimmleiter mit Sicherheitsausbildung, je nach Gruppengrösse ergänzt durch Helfende. Mindestens eine Begleitperson begleitet die Kinder ins Hallenbad; Material für das Programm wird gestellt. Es gibt Pauschalpreise nach Anzahl Kinder sowie eine Mermaid-Variante mit optionaler Kostümmiete; zudem kann ein Mehrzweckraum gegen Aufpreis reserviert werden (z.B. für Kuchen/Snacks). Das Format eignet sich für Familien, die eine klare Organisation, ein Thema und ein sicheres Setting im Wasser wünschen.',
    ARRAY['Sicheres Verhalten im Schwimmbad in einer Gruppe einüben', 'Bewegungsspiele und Wasseraufgaben gemeinsam meistern', 'Angstfrei im Wasser teilnehmen (auch für Nichtschwimmer möglich)', 'Teamgefühl und Selbstvertrauen durch betreute Erfolgserlebnisse stärken', 'Regeln und Rücksichtnahme im öffentlichen Bad erleben'],
    'Kindergeburtstag, Poolparty, Geburtstag im Hallenbad, Langnau am Albis, Wasserparty, Animation, Mermaid Geburtstag, Schwimmbad Party, Kinder ab 4, betreute Aktivität, AquaBirthday',
    'Mind. 5 Kinder ab 4 Jahre; mind. 1 Begleitperson; Schwimmfähigkeit aller Kinder nicht erforderlich',
    'kinder_jugend',
    'ferien',
    'Sportcamps',
    'kinder_jugend | Feriencamps & Betreuung',
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'lead',
    'https://aquakidz.ch/geburtstage/',
    'published',
    360,
    1,
    180
);
