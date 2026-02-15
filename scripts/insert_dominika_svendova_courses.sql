-- ============================================
-- INSERT COURSES FOR DOMINIKA SVENDOVA (Musikunterricht)
-- Provider UUID: 379f8434-6747-49fb-9ede-efd350fb7e2d
-- ============================================
-- Run this script in Supabase SQL Editor

-- 1. Individueller Querflötenunterricht: Von Klassik bis Moderne
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
    '379f8434-6747-49fb-9ede-efd350fb7e2d',
    'Individueller Querflötenunterricht: Von Klassik bis Moderne',
    'Dieser Kurs bietet eine umfassende Einführung und Vertiefung in das Spiel der Querflöte, angepasst an das jeweilige Alter und Vorwissen. Im Zentrum steht die Entwicklung einer gesunden Blastechnik, einer stabilen Körperhaltung und einer präzisen Fingerfertigkeit. Der Unterricht wird individuell gestaltet, sodass sowohl Kinder, die ihre ersten musikalischen Schritte machen, als auch Erwachsene und Senioren ihre persönlichen Ziele erreichen können.

Das Repertoire erstreckt sich über verschiedene Epochen, von den glanzvollen Werken des Barocks und der Klassik bis hin zu zeitgenössischen Kompositionen und modernen Stilrichtungen. Neben den technischen Grundlagen wird grosser Wert auf die musikalische Gestaltung, die Tonbildung und die Spielfreude gelegt. Schülerinnen und Schüler lernen, Noten zu lesen, Rhythmen zu verstehen und ihren eigenen künstlerischen Ausdruck auf dem Instrument zu finden.

Durch die langjährige pädagogische Erfahrung der Lehrperson wird eine motivierende Lernumgebung geschaffen, in der auch die Vorbereitung auf Prüfungen oder öffentliche Auftritte Platz findet. Der Kurs fördert nicht nur die musikalischen Fähigkeiten, sondern auch die Konzentration und die Feinmotorik in jedem Alter.',
    'Querflöte, Musikunterricht, Flötenstunden, Winterthur, Flötenlehrerin, Klassische Musik, Instrumentlernen, Privatunterricht, Musikpädagogik, Querflöte lernen, ZHdK, Musikschule, Einzelunterricht',
    ARRAY[
        'Beherrschung der grundlegenden Atem- und Ansatztechnik',
        'Entwicklung einer sicheren Fingertechnik und Koordination',
        'Erarbeitung eines vielseitigen Repertoires aus verschiedenen Epochen',
        'Förderung des individuellen musikalischen Ausdrucks und der Dynamik',
        'Verbesserung des Notenlesens und des rhythmischen Verständnisses'
    ],
    'Keine formalen Voraussetzungen',
    110.00,
    'mixed',
    ARRAY['Deutsch', 'Englisch', 'Tschechisch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Blasinstrumente',
    'Querflöte',
    NULL,
    '60 Minuten (auch 30 oder 45 Minuten möglich)',
    'https://matchspace-music.ch/ch-en/teachers/dominika-svendova',
    'lead',
    'published',
    true
);

-- 2. Blockflöte erleben: Spielerischer Einstieg und barocke Meisterschaft
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
    '379f8434-6747-49fb-9ede-efd350fb7e2d',
    'Blockflöte erleben: Spielerischer Einstieg und barocke Meisterschaft',
    'Die Blockflöte ist weit mehr als nur ein Einstiegsinstrument; sie ist ein ernstzunehmendes Soloinstrument mit einer reichen Geschichte. In diesem Kurs wird die gesamte Bandbreite der Blockflötenfamilie erkundet, wobei ein besonderer Fokus auf der barocken Literatur liegt. Für Anfänger, insbesondere Kinder, bietet der Unterricht einen spielerischen Zugang zur Musik, bei dem die Grundlagen der Griffweise und der Tonerzeugung im Vordergrund stehen.

Fortgeschrittene Spielerinnen und Spieler haben die Möglichkeit, tief in die Welt der historischen Aufführungspraxis einzutauchen und anspruchsvolle Sonaten und Konzerte zu erarbeiten. Der Unterricht legt Wert auf eine feine Artikulation, eine saubere Intonation und ein vertieftes Verständnis für die musikalische Rhetorik der Barockzeit. Dominika Svendova nutzt ihre Spezialisierung in Alter Musik, um den Schülern authentische Interpretationsweisen näherzubringen.

Gleichzeitig wird die Blockflöte als vielseitiges Instrument für Volksmusik oder moderne Stücke genutzt. Der Kurs ist darauf ausgerichtet, technische Hürden abzubauen und die Freude an der klanglichen Reinheit dieses Instruments zu vermitteln. Die Lernenden werden individuell dort abgeholt, wo sie stehen, um stetige Fortschritte in Technik und Ausdruck zu erzielen.',
    'Blockflöte, Barockmusik, Alte Musik, Blockflötenunterricht, Musiklehrerin, Winterthur, Blockflöte für Kinder, Blockflöte für Erwachsene, Musikalische Grundbildung, Flöte, Einzelunterricht, Musikpädagogik',
    ARRAY[
        'Erlernen der korrekten Griffweise und Handhaltung',
        'Schulung der differenzierten Artikulation und Zungentechnik',
        'Einführung in die historische Aufführungspraxis des Barock',
        'Sichere Intonation in verschiedenen Registern',
        'Aufbau eines Repertoires von einfachen Liedern bis zu Sonaten'
    ],
    'Keine formalen Voraussetzungen',
    110.00,
    'mixed',
    ARRAY['Deutsch', 'Englisch', 'Tschechisch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Blasinstrumente',
    'Blockflöte',
    NULL,
    '60 Minuten',
    'https://matchspace-music.ch/ch-en/teachers/dominika-svendova',
    'lead',
    'published',
    true
);

-- 3. Traversflöte: Die Welt der barocken Klangfarben
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
    '379f8434-6747-49fb-9ede-efd350fb7e2d',
    'Traversflöte: Die Welt der barocken Klangfarben',
    'Dieser Kurs widmet sich der Traversflöte, dem hölzernen Vorläufer der modernen Querflöte, und richtet sich an Neugierige sowie fortgeschrittene Flötisten, die den authentischen Klang des 18. Jahrhunderts entdecken möchten. Die Traversflöte erfordert eine spezifische Herangehensweise an Ansatz, Stimmung und Fingersatz (Gabelgriffe), die im Unterricht detailliert vermittelt werden.

Ein wesentlicher Bestandteil des Kurses ist die Auseinandersetzung mit der historischen Aufführungspraxis: Wie wurden Verzierungen im Barock ausgeführt? Welche Bedeutung haben die unterschiedlichen Artikulationssilben? Dominika Svendova teilt hierbei ihre tiefe Expertise aus ihrem spezialisierten Studium an der ZHdK. Die Lernenden tauchen ein in die Literatur von Komponisten wie Bach, Telemann oder Händel und lernen, deren Werke auf dem Instrument ihrer Zeit zum Klingen zu bringen.

Der Unterricht schult das Gehör für die besonderen Klangfarben und die reine Stimmung des Instruments. Es wird aufgezeigt, wie die mechanischen Besonderheiten der Traversflöte die musikalische Phrasierung beeinflussen. Dieser Kurs bietet eine einzigartige Gelegenheit, Musikgeschichte praktisch zu erleben und das eigene künstlerische Profil durch ein historisches Instrument zu erweitern. Er ist ideal für alle, die eine neue klangliche Dimension abseits der modernen Metallflöte suchen.',
    'Traversflöte, Barocktraverse, Alte Musik, Historische Aufführungspraxis, Barockflöte, Musikstudium, Spezialisierung Musik, Winterthur, Holzflöte, Barockmusik, Fachunterricht, Flöte',
    ARRAY[
        'Erlernen der historischen Griffweise und Gabelgriffe',
        'Anpassung des Ansatzes an die spezifische Bohrung der Holztraverse',
        'Anwendung barocker Verzierungslehre und Artikulation',
        'Verständnis der historischen Tonsysteme und Stimmungen',
        'Erarbeitung authentischer Barockliteratur'
    ],
    'Grundkenntnisse auf der Querflöte oder Blockflöte von Vorteil, aber kein Muss.',
    110.00,
    'advanced',
    ARRAY['Deutsch', 'Englisch', 'Tschechisch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Alte Musik',
    'Traversflöte',
    NULL,
    '60 Minuten',
    'https://www.ms-alato.ch/lehrpersonen/dominika-svendova/',
    'lead',
    'published',
    true
);

-- ============================================
-- VERIFY INSERTED COURSES
-- ============================================
-- SELECT id, title, price, category_area, category_specialty, category_focus
-- FROM courses
-- WHERE user_id = '379f8434-6747-49fb-9ede-efd350fb7e2d'
-- ORDER BY created_at DESC;
