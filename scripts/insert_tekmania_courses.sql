-- ============================================================================
-- Kurse für TekMania
-- Provider UUID: 776c8735-60a0-45bd-8641-be85f3fdd253
-- Standort: Zürich
-- Kurstyp: Kinder & Jugendliche (Robotik, Programmierung, Animation)
-- ============================================================================
--
-- ANLEITUNG ZUM AUSFÜHREN:
-- 1. Kopieren Sie dieses gesamte Script
-- 2. Öffnen Sie Supabase Dashboard → SQL Editor
-- 3. Fügen Sie das Script ein und klicken Sie auf "Run"
-- 4. Notieren Sie die erstellten course_id's aus den Rückgabewerten
-- 5. Die Kurse werden als 'draft' erstellt - nach Prüfung auf 'published' setzen
--
-- HINWEIS:
-- Alle drei Kurse sind auf MINT-Themen (Robotik, Programmierung, Animation)
-- für Kinder und Jugendliche ausgerichtet. Preis, Anzahl Lektionen und
-- Lektionsdauer sind auf der Website zu finden (Lead-Booking).
--
-- Taxonomie-Kategorien (in DB vorhanden - geprüft):
-- - kinder_jugend > technik_medien > Robotik & Lego
-- - kinder_jugend > technik_medien > Programmieren & Games
-- - kinder_jugend > technik_medien > Foto & Video für Kids (Animation)
-- ============================================================================

-- ============================================================================
-- KURS 1: Adventures in Robotics Lab
-- ============================================================================
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
    '776c8735-60a0-45bd-8641-be85f3fdd253',
    'Adventures in Robotics Lab',
    'In diesem Kurs entdecken Kinder die Welt der modernen Robotik und Mechanik auf spielerische Weise. Unter Verwendung von professionellen LEGO Education Systemen wie SPIKE Essential und SPIKE Prime lernen die Teilnehmenden Schritt für Schritt, wie man Roboter konstruiert und diese anschliessend zum Leben erweckt. Der Unterricht ist konsequent projektorientiert gestaltet, sodass komplexe theoretische Konzepte aus Mathematik und Physik direkt in der praktischen Anwendung greifbar werden. Die Schülerinnen und Schüler bauen Modelle, die verschiedene Sensoren und Motoren nutzen, um Aufgaben autonom zu bewältigen. Dabei werden nicht nur die physikalischen Grundlagen, sondern auch die grundlegende Logik der Programmierung vermittelt. Ein zentraler Aspekt des Kurses ist das „Trial and Error"-Prinzip, welches das logische Denken, die Frustrationstoleranz und die Ausdauer der Kinder nachhaltig stärkt. Die Teilnehmenden arbeiten oft in kleinen Teams zusammen, was die kommunikativen Fähigkeiten und die soziale Interaktion fördert. Jedes Projekt schliesst mit einer spannenden Präsentation oder einem Testlauf des selbst gebauten Roboters ab. Die Zielgruppe umfasst neugierige Kinder, die gerne tüfteln und ein tieferes technisches Verständnis entwickeln möchten. Der Kurs bietet eine ideale Lernumgebung, um MINT-Themen spannend zu vermitteln und die Begeisterung für zukünftige Ingenieurskunst zu wecken.',
    'Robotik, LEGO, SPIKE Prime, Programmierung, MINT, Technik, Kinderkurs, Informatik, Engineering, Konstruktion, Zürich, Sensortechnik, Mechanik, Ferienkurs',
    ARRAY[
        'Grundlagen der Konstruktion und Mechanik verstehen',
        'Programmierung von Motoren und Sensoren erlernen',
        'Logisches Denken durch Problemlösungsstrategien fördern',
        'Teamarbeit bei gemeinsamen Bauprojekten stärken',
        'Anwendung von MINT-Prinzipien in der Praxis'
    ],
    'Keine formalen Voraussetzungen',
    NULL, -- Preis offen (Lead-Booking)
    'all_levels',
    ARRAY['Deutsch', 'Englisch'],
    ARRAY['presence'],
    'kinder_jugend',
    'technik_medien',
    'Robotik & Lego',
    NULL,
    NULL, -- Anzahl Lektionen offen
    NULL, -- Lektionsdauer offen
    'https://www.tekmania.ch/adventures-in-robotics-lab',
    'lead',
    'draft',
    false,
    'Zürich',
    'Zürich'
) RETURNING id;


-- ============================================================================
-- KURS 2: Coding & Gaming Lab
-- ============================================================================
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
    '776c8735-60a0-45bd-8641-be85f3fdd253',
    'Coding & Gaming Lab',
    'Dieser Kurs führt junge Teilnehmende in die faszinierende Welt der Softwareentwicklung und des modernen Game Designs ein. Je nach Alter und individuellem Vorwissen kommen unterschiedliche Werkzeuge zum Einsatz, angefangen bei blockbasierten Sprachen wie Scratch für den einfachen Einstieg bis hin zu textbasierten Programmiersprachen wie Python für Fortgeschrittene. Teilnehmende mit mehr Erfahrung erhalten vertiefte Einblicke in professionelle Entwicklungsumgebungen wie Unity oder die Gestaltung eigener Spielewelten in Roblox unter Verwendung der Sprache Lua. Der Fokus liegt dabei nicht nur auf dem reinen Schreiben von Programmcode, sondern primär auf dem grundlegenden Verständnis von Algorithmen, Datenstrukturen und interaktiven Spielmechaniken. Die Teilnehmenden entwickeln ihre eigenen Spielideen, entwerfen originelle Charaktere und programmieren die gesamte Logik hinter dem Spielgeschehen. Dieser kreative Prozess fördert das abstrakte Denkvermögen und die gestalterische Kraft massgeblich. Durch die kontinuierliche Arbeit an individuellen Projekten lernen die Schülerinnen und Schüler, wie man komplexe Probleme systematisch in kleinere, lösbare Aufgaben unterteilt. Der Kurs bietet eine fundierte Basis für alle, die über den reinen Konsum digitaler Medien hinausgehen und selbst zu Schöpfern innovativer digitaler Welten werden möchten. Die intensive Betreuung erfolgt durch erfahrene Kursleitende, die Spass an zukunftsorientierter Technologie vermitteln.',
    'Programmierung, Coding, Game Design, Python, Scratch, Unity, Roblox, Informatik, Kinderkurs, Softwareentwicklung, C#, Lua, Zürich, App Entwicklung',
    ARRAY[
        'Grundverständnis für Programmierlogik und Algorithmen entwickeln',
        'Erstellen eigener Videospiele und interaktiver Anwendungen',
        'Einführung in Sprachen wie Python, C# oder Lua',
        'Verständnis von User Interface und Game Design',
        'Abstraktes Problemlösungsvermögen trainieren'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch', 'Englisch'],
    ARRAY['presence'],
    'kinder_jugend',
    'technik_medien',
    'Programmieren & Games',
    NULL,
    NULL,
    NULL,
    'https://www.tekmania.ch/coding-gaming-lab',
    'lead',
    'draft',
    false,
    'Zürich',
    'Zürich'
) RETURNING id;


-- ============================================================================
-- KURS 3: Digital Animation Lab
-- ============================================================================
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
    '776c8735-60a0-45bd-8641-be85f3fdd253',
    'Digital Animation Lab',
    'Im Digital Animation Lab lernen Kinder und Jugendliche, wie sie ihre eigenen Geschichten mithilfe modernster Technik in beeindruckende bewegte Bilder verwandeln. Der Kurs deckt ein breites Spektrum an verschiedenen Animationstechniken ab, das von klassischen Stop-Motion-Verfahren bis hin zu zeitgemässer digitaler 2D- und 3D-Animation reicht. Unter Einsatz von professionellen Werkzeugen wie Procreate auf dem iPad oder der 3D-Software Blender erlernen die Teilnehmenden das grundlegende Handwerk des Animierens von der Pike auf. Sie erfahren praxisnah, wie man interessante Charaktere entwirft, stimmungsvolle Hintergründe gestaltet und Bewegungsabläufe physikalisch korrekt sowie flüssig darstellt. Ein wesentlicher Bestandteil des Unterrichts ist das Storyboarding, bei dem die Teilnehmenden lernen, ihre kreativen Visionen strukturiert zu planen und dramaturgisch aufzubereiten. Neben der rein technischen Umsetzung wird auch das Gespür für Timing, Bildkomposition und visuelle Erzählweise gezielt geschult. Das Lab bietet viel Raum für grenzenlose Kreativität, während gleichzeitig der souveräne Umgang mit komplexer Software geübt wird. Die Teilnehmenden produzieren im Verlauf des Kurses eigene Kurzfilme oder animierte Clips, die sie am Ende der Kursdauer stolz präsentieren können. Dieser Kurs ist die ideale Wahl für alle, die eine Leidenschaft für bildende Kunst und Technologie verbinden möchten.',
    'Animation, Digital Art, Procreate, Blender, Stop Motion, 2D Animation, 3D Design, Storytelling, Kinderkurs, Kreativität, Grafikdesign, Zürich, Filmproduktion',
    ARRAY[
        'Grundlagen der Animation und des Storytellings beherrschen',
        'Umgang mit Software wie Procreate oder Blender erlernen',
        'Erstellung von 2D- und 3D-Animationen',
        'Entwicklung und Gestaltung eigener digitaler Charaktere',
        'Verständnis von filmischen Gestaltungsmitteln'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch', 'Englisch'],
    ARRAY['presence'],
    'kinder_jugend',
    'technik_medien',
    'Foto & Video für Kids',
    'Animation',
    NULL,
    NULL,
    'https://www.tekmania.ch/digital-animation-lab',
    'lead',
    'draft',
    false,
    'Zürich',
    'Zürich'
) RETURNING id;


-- ============================================================================
-- WICHTIGE NÄCHSTE SCHRITTE:
-- ============================================================================
--
-- 1. Kontakt-Email ergänzen:
--    Für jeden Kurs muss in der Tabelle `course_private` die Kontakt-Email
--    eingetragen werden (da booking_type = 'lead'):
--
--    INSERT INTO course_private (course_id, contact_email)
--    VALUES ('[COURSE_ID_FROM_ABOVE]', 'info@tekmania.ch');
--
-- 2. Taxonomie (bereits geprüft ✓):
--    Alle Kategorien existieren in der DB:
--    - kinder_jugend > technik_medien > "Robotik & Lego" ✓
--    - kinder_jugend > technik_medien > "Programmieren & Games" ✓
--    - kinder_jugend > technik_medien > "Foto & Video für Kids" ✓
--
-- 3. Optional: Bilder hochladen
--    Für jeden Kurs kann ein Bild über die UI hochgeladen werden, oder
--    direkt ein image_url gesetzt werden.
--
-- 4. Status auf 'published' setzen:
--    Nachdem der Anbieter die Kurse geprüft hat, Status ändern:
--
--    UPDATE courses
--    SET status = 'published'
--    WHERE user_id = '776c8735-60a0-45bd-8641-be85f3fdd253';
--
-- 5. Preise und Details ergänzen (optional):
--    Falls konkrete Preise und Lektionsdetails bekannt werden:
--
--    UPDATE courses
--    SET price = 450.00,
--        session_count = 10,
--        session_length = '90 Minuten'
--    WHERE id = '[COURSE_ID]';
--
-- ============================================================================
