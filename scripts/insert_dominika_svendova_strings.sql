-- ============================================
-- INSERT STRING INSTRUMENT COURSES FOR DOMINIKA SVENDOVA
-- Provider UUID: 379f8434-6747-49fb-9ede-efd350fb7e2d
-- ============================================
-- Run this script in Supabase SQL Editor

-- 4. Gitarre lernen: Von klassischer Technik bis zur Liedbegleitung
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
    'Gitarre lernen: Von klassischer Technik bis zur Liedbegleitung',
    'Dieser Gitarrenunterricht bietet einen umfassenden Einstieg in die Welt der sechs Saiten, wobei der Fokus auf einer soliden technischen Grundlage und der individuellen musikalischen Entfaltung liegt. Dominika Svendova vermittelt sowohl die klassische Fingerstyle-Technik als auch modernes Akkordspiel für die Liedbegleitung. Der Unterricht ist so strukturiert, dass Schülerinnen und Schüler schnell erste Erfolge feiern können, während gleichzeitig auf eine ergonomische Handhaltung und saubere Tonerzeugung geachtet wird.

Das Repertoire ist äusserst vielseitig und umfasst klassische Stücke, Folk, Pop-Songs und Jazz-Elemente. Neben dem reinen Instrumentalspiel werden grundlegende Kenntnisse in Harmonielehre und Rhythmik vermittelt, die es den Lernenden ermöglichen, Musik tiefer zu verstehen und später auch eigene Stücke zu interpretieren oder zu begleiten. Der Kurs richtet sich an Kinder ab ca. 8 Jahren sowie an Erwachsene, die ein neues Hobby entdecken oder bestehende Kenntnisse auffrischen möchten.

Durch den individuellen Ansatz der Lehrperson wird das Lerntempo stets an die Bedürfnisse und Ziele des Schülers angepasst, sei es für das Spiel im stillen Kämmerlein oder für den Auftritt im kleinen Kreis.',
    'Gitarrenunterricht, Gitarre lernen, Akustikgitarre, Klassische Gitarre, Gitarrenlehrerin, Zürich, Winterthur, Musikunterricht, Privatlehrer, Saiteninstrumente, Liedbegleitung, Musikschule, Anfängerkurs Gitarre',
    ARRAY[
        'Beherrschung der grundlegenden Akkorde und Griffwechsel',
        'Entwicklung einer sauberen Anschlagstechnik (Zupfen und Schlagen)',
        'Einführung in das Notenlesen und die Tabulatur-Schrift',
        'Erarbeitung eines abwechslungsreichen Repertoires aus Pop und Klassik',
        'Förderung des Rhythmusgefühls und der Koordination'
    ],
    'Keine formalen Voraussetzungen',
    110.00,
    'mixed',
    ARRAY['Deutsch', 'Englisch', 'Tschechisch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Saiteninstrumente',
    'Gitarre',
    NULL,
    '60 Minuten',
    'https://matchspace-music.ch/ch-de/teachers/dominika-svendova',
    'lead',
    'published',
    true
);

-- 5. E-Gitarre: Rock, Pop und Band-Feeling
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
    'E-Gitarre: Rock, Pop und Band-Feeling',
    'Der E-Gitarrenunterricht bei Dominika Svendova ist der ideale Einstieg für alle, die den elektrischen Sound lieben und in modernen Stilrichtungen wie Rock, Pop, Punk oder Jazz zuhause sein wollen. Im Gegensatz zur klassischen Gitarre steht hier das Spiel mit dem Plektrum, die Arbeit mit Verstärkern und der Einsatz von Effekten im Vordergrund. Der Kurs ist praxisorientiert aufgebaut: Die Schüler lernen, wie sie die E-Gitarre als Leitinstrument in einer Band einsetzen, coole Riffs spielen und erste Soli improvisieren.

Es ist keine Vorbildung auf der akustischen Gitarre nötig; man kann direkt mit dem elektrischen Instrument starten. Besonderes Augenmerk wird auf die Lautstärkeregulierung und die technischen Aspekte des Equipments gelegt, damit der richtige Sound auch im heimischen Übungsraum entsteht. Die Lernenden erarbeiten Songs, die sie selbst gerne hören, was die Motivation hoch hält.

Dominika Svendova nutzt ihre langjährige Erfahrung, um technische Hürden abzubauen und den Weg zum Zusammenspiel mit anderen Musikern zu ebnen. Der Unterricht fördert nicht nur die Fingerfertigkeit, sondern auch das Verständnis für moderne Songstrukturen und das banddienliche Spiel.',
    'E-Gitarre, Rockmusik, E-Gitarrenunterricht, Gitarrenlehrer, Bandcoaching, Musikunterricht Zürich, Plektrumtechnik, Riffs, Gitarrenverstärker, Modern Music, Popgitarre, Musikschule Alato, Privatunterricht',
    ARRAY[
        'Erlernen grundlegender Riffs und Powerchords',
        'Einführung in die Plektrumtechnik und das Solospiel',
        'Verständnis für die Technik: Verstärker, Kabel und Effekte',
        'Anwendung verschiedener Rhythmuspatterns in Rock und Pop',
        'Aufbau eines Repertoires an bekannten modernen Songs'
    ],
    'Keine formalen Voraussetzungen',
    110.00,
    'mixed',
    ARRAY['Deutsch', 'Englisch', 'Tschechisch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Saiteninstrumente',
    'E-Gitarre',
    NULL,
    '60 Minuten',
    'https://www.ms-alato.ch/saiteninstrumente/e-gitarre/',
    'lead',
    'published',
    true
);

-- 6. Ukulele: Der fröhliche Einstieg in die Welt der Saiteninstrumente
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
    'Ukulele: Der fröhliche Einstieg in die Welt der Saiteninstrumente',
    'Die Ukulele ist das perfekte Instrument für Menschen jeden Alters, die schnell und unkompliziert Musik machen möchten. In diesem Kurs zeigt Dominika Svendova, warum das "hawaiianische" Instrument so beliebt ist: Es ist leicht zu transportieren, hat einen unverwechselbar fröhlichen Klang und ermöglicht bereits nach wenigen Lektionen das Begleiten ganzer Songs. Der Unterricht deckt eine enorme stilistische Breite ab – von klassischen hawaiianischen Klängen über aktuelle Pop-Hits bis hin zu Jazz-Standards und gemütlicher Lagerfeuermusik.

Schülerinnen und Schüler lernen die wichtigsten Akkorde, verschiedene Schlagmuster (Strumming) und die Grundlagen des Melodiespiels. Aufgrund der geringen Grösse und der weichen Nylonsaiten ist die Ukulele besonders für Kinder ab ca. 6-8 Jahren geeignet, erfreut sich aber auch bei Erwachsenen grosser Beliebtheit als unkompliziertes Begleitinstrument.

Dominika Svendova legt Wert auf einen spielerischen Zugang, bei dem der Spass an der Musik im Vordergrund steht. Der Kurs bietet zudem eine hervorragende Basis, um später auf die grössere Gitarre umzusteigen, da viele musiktheoretische Grundlagen direkt übertragen werden können.',
    'Ukulele lernen, Ukulelenunterricht, Musik für Kinder, Saiteninstrumente, Zürich, Winterthur, Hobby Musik, Musikpädagogik, Ukulelenlehrerin, Einfache Instrumente, Songbegleitung, Hawaiianische Musik',
    ARRAY[
        'Sicherer Griff der Grundakkorde auf der Ukulele',
        'Erlernen verschiedener Schlag- und Rhythmustechniken',
        'Liedbegleitung von einfachen Pop- und Volksliedern',
        'Entwicklung einer stabilen Handhaltung und Koordination',
        'Spass an der spontanen musikalischen Improvisation'
    ],
    'Keine formalen Voraussetzungen',
    110.00,
    'mixed',
    ARRAY['Deutsch', 'Englisch', 'Tschechisch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Saiteninstrumente',
    'Ukulele',
    NULL,
    '60 Minuten',
    'https://www.ms-alato.ch/saiteninstrumente/ukulele/',
    'lead',
    'published',
    true
);

-- 7. Banjo: Rhythmus und Technik für Bluegrass und Folk
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
    'Banjo: Rhythmus und Technik für Bluegrass und Folk',
    'Das Banjo ist mit seinem perkussiven Klang das Herzstück vieler Folk- und Bluegrass-Stile und bietet eine faszinierende Alternative zur klassischen Gitarre. In diesem Unterricht führt Dominika Svendova die Lernenden in die spezifischen Spieltechniken dieses besonderen Instruments ein. Im Fokus stehen dabei das Erlernen der typischen Roll-Patterns für die rechte Hand, die für den treibenden Rhythmus des Banjos charakteristisch sind.

Der Kurs ist darauf ausgelegt, die Schülerinnen und Schüler so schnell wie möglich in die Unabhängigkeit zu führen, damit sie eigene Melodien erarbeiten und in Ensembles mitspielen können. Neben der Technik wird auch die Geschichte des Instruments und seine Verwendung in verschiedenen Stilrichtungen beleuchtet. Der Unterricht wird individuell gestaltet, sodass sowohl Anfänger ohne Vorkenntnisse als auch Umsteiger von der Gitarre schnell Fortschritte machen.

Dominika Svendova vermittelt mit viel Begeisterung, wie man den typischen "Twang" des Banjos erzeugt und dabei eine saubere Intonation bewahrt. Es ist ein Kurs für alle, die ein charakterstarkes Instrument suchen und die Welt der handgemachten Folkmusik entdecken möchten.',
    'Banjounterricht, Banjo lernen, Bluegrass, Folk Musik, Musikunterricht Zürich, Saiteninstrumente, Banjolehrerin, Fingerpicking, Rhythmustechnik, Spezialinstrumente, Musikschule, Privatlehrer',
    ARRAY[
        'Beherrschung der grundlegenden Griffweisen und Akkorde',
        'Erlernen der wichtigsten Fingerpicking-Rolls (Rechte Hand)',
        'Entwicklung eines stabilen Tempos und rhythmischer Präzision',
        'Einführung in die Stilelemente von Folk und Bluegrass',
        'Aufbau eines soliden Repertoires an traditionellen Stücken'
    ],
    'Keine formalen Voraussetzungen',
    110.00,
    'mixed',
    ARRAY['Deutsch', 'Englisch', 'Tschechisch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Saiteninstrumente',
    'Banjo',
    NULL,
    '60 Minuten',
    'https://matchspace-music.ch/ch-de/teachers/dominika-svendova',
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
