-- ============================================
-- INSERT COURSES FOR TJAPUKAI (Felice Limacher)
-- Provider UUID: 1ffbc7e1-c858-467d-99e4-929f804ccb36
-- ============================================
-- Run this script in Supabase SQL Editor

-- 1. Didgeridoo Schnupperunterricht (Probelektion)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Didgeridoo Schnupperunterricht (Probelektion)',
    'In dieser Probelektion erhältst Du einen strukturierten Einstieg ins Didgeridoo-Spiel und einen realistischen Überblick, wie sich das Instrument anfühlt und wie der Lernweg typischerweise aufgebaut ist. Im Mittelpunkt stehen erste Grundlagen: die Blas- und Ansatztechnik, das Herstellen eines stabilen Grundtons sowie ein erster Zugang zum zirkulären Atmen.

Du lernst, worauf es beim Üben ankommt, welche typischen Stolpersteine am Anfang auftreten können und wie Du Deine Fortschritte einschätzen kannst. Die Lektion ist so angelegt, dass sie Dir sowohl ein praktisches Erlebnis am Instrument als auch Orientierung für die nächsten Schritte gibt – egal, ob Du danach im Einzelunterricht weiterlernen oder ein Gruppenformat wählen möchtest.

Zielgruppe sind Personen ohne Vorkenntnisse, die Didgeridoo ausprobieren und einen fundierten Einstieg suchen. Das Format eignet sich auch, wenn Du noch unsicher bist, ob Du ein eigenes Instrument anschaffen möchtest, da der Fokus auf dem Kennenlernen der Spielweise liegt.',
    'Didgeridoo, Schnupperkurs, Probelektion, Grundton, Ansatztechnik, Blastechnik, zirkuläres Atmen, Atemtraining, Einsteiger, Musikunterricht',
    ARRAY['Grundton am Didgeridoo erzeugen und stabil halten', 'Grundlagen von Ansatz und Blastechnik anwenden', 'Erste Übungen zum zirkulären Atmen kennenlernen', 'Nächste Lernschritte und sinnvolle Übe-Routine ableiten'],
    'Keine Vorkenntnisse erforderlich',
    140,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Blasinstrumente',
    NULL,
    'Schwyz',
    1,
    'ca. 100 Minuten',
    'https://www.tjapukai.ch/unterricht/anfaenger/',
    'lead',
    'draft',
    false
);

-- 2. Didgeridoo Einzelunterricht für EinsteigerInnen
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Didgeridoo Einzelunterricht für EinsteigerInnen',
    'Dieser Einzelunterricht vermittelt Dir die Grundlagen des Didgeridoo-Spiels in einem klaren, auf Deinen Fortschritt abgestimmten Ablauf. Zu Beginn werden Basisfragen geklärt (Instrument, Haltung, Luftführung) und eine saubere Blastechnik aufgebaut. Danach arbeitest Du am Erzeugen und Stabilisieren des Grundtons, bevor Du schrittweise Übungen kennenlernst, die in Richtung zirkuläres Atmen führen.

Ergänzend werden erste Ansätze des Spielens „über zusätzliche Ebenen" eingeführt, damit Dein Spiel nicht nur aus einem Ton besteht, sondern dynamischer wird. Der Unterricht ist als Lernserie gedacht: Jede Lektion setzt an Deinem aktuellen Stand an und leitet daraus die nächsten Übe-Schritte ab.

Das Format eignet sich für absolute EinsteigerInnen und für alle, die bewusst im eigenen Tempo lernen möchten. Praktisch ist, dass Du nicht zwingend ein eigenes Instrument besitzen musst: Für die Übephase kann ein Didgeridoo bzw. Übungsinstrument gemietet werden. So kannst Du zuerst die Technik entwickeln und später entscheiden, ob und welches Instrument zu Dir passt.',
    'Didgeridoo, Einzelunterricht, Anfänger, Grundkurs, Grundton, Blastechnik, zirkuläres Atmen, Atemübungen, Instrument mieten, Musik lernen, Pfäffikon',
    ARRAY['Blastechnik und Luftführung sicher anwenden', 'Grundton erzeugen und kontrollieren', 'Übungen zum zirkulären Atmen durchführen', 'Erste Spielvariationen auf zusätzlichen Ebenen ausprobieren'],
    'Keine Vorkenntnisse erforderlich',
    100,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Blasinstrumente',
    NULL,
    'Schwyz',
    1,
    '60–90 Minuten',
    'https://www.tjapukai.ch/unterricht/anfaenger/',
    'lead',
    'draft',
    false
);

-- 3. Didgeridoo-Basiskurs (Gruppenunterricht)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Didgeridoo-Basiskurs (Gruppenunterricht)',
    'Der Didgeridoo-Basiskurs ist ein Gruppenformat für EinsteigerInnen, die gemeinsam in die Grundlagen des Instruments einsteigen möchten. Inhaltlich deckt der Kurs die zentralen Bausteine ab, die für einen soliden Start wichtig sind: allgemeine Orientierung rund um Didgeridoo-Spiel, eine funktionale Blas- und Ansatztechnik, das Erzeugen des Grundtons sowie erste Übungen, die in Richtung zirkuläres Atmen führen.

Zusätzlich werden Grundlagen vermittelt, wie Du Dein Spiel schrittweise variieren kannst, damit Klang und Rhythmus lebendiger werden. Durch den Gruppenrahmen profitierst Du von gemeinsamem Üben, dem Vergleich unterschiedlicher Lernwege und einer klaren Kursstruktur, die alle Teilnehmenden abholt.

Der Basiskurs eignet sich für Personen ohne Vorkenntnisse und für Interessierte, die lieber in einem kompakten Block lernen als über mehrere Einzeltermine. Auf der Kursseite werden Basiskurs 1 und Basiskurs 2 als separate Angebote geführt; die Durchführungstermine und Kursorte werden jeweils publiziert, sobald sie feststehen.',
    'Didgeridoo, Basiskurs, Gruppenunterricht, Einsteiger, Grundton, Blastechnik, zirkuläres Atmen, Atemtechnik, Workshop, Musikgruppe, Kursblock',
    ARRAY['Grundton am Didgeridoo sicher erzeugen', 'Basiswissen zu Ansatz, Luftführung und Blastechnik anwenden', 'Erste Schritte in Richtung zirkuläres Atmen üben', 'Einfaches Variieren des Spiels über zusätzliche Ebenen verstehen'],
    'Keine Vorkenntnisse erforderlich',
    NULL,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Blasinstrumente',
    NULL,
    'Schwyz',
    1,
    'ca. 3.5–4 Stunden',
    'https://www.tjapukai.ch/unterricht/anfaenger/',
    'lead',
    'draft',
    false
);

-- 4. Didgeridoo Einzelunterricht für mittlere & fortgeschrittene SpielerInnen (Aufbau)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Didgeridoo Einzelunterricht für Fortgeschrittene (Aufbau)',
    'Dieser Aufbau-Unterricht richtet sich an SpielerInnen, die bereits erste Erfahrung am Didgeridoo haben und das zirkuläre Atmen zumindest ansatzweise beherrschen. Der Fokus liegt darauf, Technik und musikalische Ausdrucksmöglichkeiten gezielt zu erweitern.

Du arbeitest an Bauch- und Zwerchfellatmung, verfeinerst Ansatz- und Lippentechnik und entwickelst artikulierte Rhythmen, die Dein Spiel präziser und vielseitiger machen. Ein weiterer Schwerpunkt ist das Erzeugen verschiedener Laute sowie das Spielen „auf zusätzlichen Ebenen", damit sich Klangfarben und Dynamik bewusster steuern lassen.

Das zirkuläre Atmen wird nicht nur wiederholt, sondern systematisch verbessert, sodass längere, stabilere Spielphasen möglich werden. Die Lektionen werden individuell abgestimmt: Inhalt, Tempo und Übeaufgaben orientieren sich an Deinem aktuellen Stand und an dem, was für den nächsten Fortschritt sinnvoll ist. Das Format eignet sich für ambitionierte HobbyspielerInnen ebenso wie für Fortgeschrittene, die ihre Technik konsolidieren und rhythmisch-musikalisch weiterkommen möchten.',
    'Didgeridoo, Aufbaukurs, Fortgeschrittene, zirkuläres Atmen, Zwerchfellatmung, Ansatztechnik, Lippentechnik, Rhythmus, Artikulation, Soundeffekte, Einzelunterricht',
    ARRAY['Bauch- und Zwerchfellatmung gezielt einsetzen', 'Ansatz- und Lippentechnik verfeinern', 'Artikulierte Rhythmen und Lauterzeugung ausbauen', 'Zirkuläres Atmen stabilisieren und verbessern', 'Spiel über zusätzliche Ebenen entwickeln'],
    'Zirkuläres Atmen am Didgeridoo zumindest ansatzweise vorhanden',
    110,
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Blasinstrumente',
    NULL,
    'Schwyz',
    1,
    '50–100 Minuten',
    'https://www.tjapukai.ch/unterricht/mittlere-spieler/',
    'lead',
    'draft',
    false
);

-- 5. Didgeridoo-Aufbaukurs (Gruppenunterricht)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Didgeridoo-Aufbaukurs (Gruppenunterricht)',
    'Der Didgeridoo-Aufbaukurs im Gruppenformat bietet einen kompakten Lernblock für SpielerInnen, die ihre Grundlagen festigen und das Spiel technisch sowie rhythmisch erweitern möchten. Im Zentrum steht die Weiterentwicklung von Atemführung und Spieltechnik, sodass längere, stabilere Spielphasen möglich werden und Rhythmen klarer artikuliert werden können.

Der Kurs ist als Aufbauformat konzipiert und richtet sich an Teilnehmende mit Vorerfahrung, insbesondere wenn das zirkuläre Atmen bereits zumindest ansatzweise vorhanden ist. Durch das gemeinsame Üben entsteht ein Lernrahmen, der Wiederholung, Feedback und das Erleben verschiedener Spielweisen miteinander verbindet.

Der Aufbaukurs ist zeitlich so gestaltet, dass Inhalte in einem zusammenhängenden Ablauf vermittelt und direkt praktisch angewendet werden. Termine und Veranstaltungsorte werden publiziert, sobald sie feststehen. Auf der Kursseite wird der Aufbaukurs zudem als geeignet für Personen mit Fokus auf Atemtraining (u.a. im Kontext von Schnarchen/Schlafapnoe) geführt.',
    'Didgeridoo, Aufbaukurs, Gruppenworkshop, Fortgeschrittene, zirkuläres Atmen, Rhythmus, Artikulation, Atemtechnik, Klanglaute, Workshop, Zürich',
    ARRAY['Zirkuläres Atmen im Spiel stabilisieren', 'Rhythmische Artikulation und Spielkontrolle verbessern', 'Atemführung bewusster einsetzen (Bauch/Zwerchfell)', 'Spielvariationen und Klangmöglichkeiten erweitern'],
    'Zirkuläres Atmen am Didgeridoo zumindest ansatzweise vorhanden',
    NULL,
    'intermediate',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'musik',
    'Blasinstrumente',
    NULL,
    'Schwyz',
    1,
    'ca. 3.5–4 Stunden',
    'https://www.tjapukai.ch/unterricht/mittlere-spieler/',
    'lead',
    'draft',
    false
);

-- 6. Atem-Therapie mit Didgeridoo & WoProC (Schnarchen/Schlafapnoe)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Atem-Therapie mit Didgeridoo & WoProC (Schnarchen/Schlafapnoe)',
    'Dieses Angebot verbindet Didgeridoo-basiertes Atemtraining mit dem Hilfsmittel WoProC und richtet sich an Personen, die Schnarchen oder Schlafapnoe aktiv angehen möchten oder gezielt an ihrer Atemmuskulatur arbeiten wollen. Der Ansatz fokussiert auf das Training und die Kräftigung der Muskulatur im Rachenraum, insbesondere im Bereich des Zungengrunds, sowie auf eine verbesserte Atemkontrolle.

Im Termin werden Technik und Vorgehen so eingeführt, dass Du anschliessend selbstständig weiterüben kannst; zirkuläres Atmen musst Du dafür nicht bereits beherrschen. Ein wichtiger Bestandteil ist das regelmässige Üben zwischen den Terminen: Als Orientierungsgrösse wird eine Praxis mehrmals pro Woche empfohlen, damit Effekte über die Zeit entstehen können.

Der Ablauf ist praxisnah: Du arbeitest an Atemführung, Muskelanspannung und Koordination und nutzt die Klangerzeugung am Instrument als Trainingsmedium. Zielgruppe sind Erwachsene, die eine strukturierte, übungsbasierte Methode suchen und bereit sind, die Übungen im Alltag konsequent fortzuführen.',
    'Atemtherapie, Didgeridoo, WoProC, Schnarchen, Schlafapnoe, Atemtraining, Zungengrund, Rachenmuskulatur, Muskeltraining, Gesundheit, Übeplan, Pfäffikon',
    ARRAY['Atemführung und Atemkontrolle gezielt verbessern', 'Grundprinzipien des Didgeridoo-basierten Atemtrainings anwenden', 'Training der Rachen-/Zungengrundmuskulatur verstehen und umsetzen', 'Individuelle Übe-Routine für die Zeit zwischen den Terminen ableiten'],
    'Schnarchen/Schlafapnoe oder Wunsch nach gezieltem Atemmuskel-Training',
    100,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'yoga_mental',
    'Atemtraining',
    NULL,
    'Schwyz',
    1,
    '60–90 Minuten',
    'https://www.tjapukai.ch/unterricht/atem-therapie/',
    'lead',
    'draft',
    false
);

-- 7. Trommelkreis (Rhythmusabend)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Trommelkreis (Rhythmusabend)',
    'Der Trommelkreis ist ein angeleiteter Gruppenabend, der das gemeinsame Trommeln als verbindendes, rhythmusbasiertes Erlebnis in den Mittelpunkt stellt. Im Fokus steht die Schamanentrommel mit ihrem erdenden Klang und ihren Schwingungen; daraus entsteht eine gemeinsame Energie, die als intensiv, zentrierend und transformierend beschrieben wird.

Du musst keine musikalischen Vorkenntnisse oder Trommelerfahrung mitbringen: Die Gruppe wird sorgsam angeleitet, und es stehen Trommeln sowie leicht spielbare Rhythmusinstrumente zur Verfügung. Der Ablauf ist auf das gemeinsame Spielen ausgerichtet – Rhythmus, Wiederholung und Aufmerksamkeit schaffen einen Rahmen, in dem Du innere Ruhe, Präsenz und ein Gefühl von Verbundenheit erleben kannst.

Je nach Witterung findet das Treffen entweder indoor oder draussen statt; in den warmen Monaten ist auch ein Setting am Kanal in Pfäffikon (SZ) mit Lagerfeuer möglich. Das Format eignet sich für alle, die Rhythmus als Ausgleich suchen, sich in einer Gruppe getragen fühlen möchten und Freude an einem klar strukturierten, gleichzeitig offenen Abendformat haben.',
    'Trommelkreis, Schamanentrommel, Rhythmus, Gruppenabend, Trance, Klang, Percussion, Meditation, Wollerau, Pfäffikon, Lagerfeuer, Energiearbeit',
    ARRAY['Grundlegende Rhythmusmuster gemeinsam umsetzen', 'Aufmerksamkeit und Präsenz über wiederholte Rhythmen stärken', 'Gemeinsames Musizieren ohne Vorkenntnisse erleben', 'Eigene Wahrnehmung von Klang und Schwingung reflektieren'],
    'Keine Vorkenntnisse erforderlich',
    40,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'yoga_mental',
    'Energiearbeit',
    NULL,
    'Schwyz',
    1,
    'Abendveranstaltung',
    'https://www.tjapukai.ch/programm/trommelkreis/',
    'lead',
    'draft',
    false
);

-- 8. Klang-Meditation (Klangreise mit Obertönen)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Klang-Meditation (Klangreise mit Obertönen)',
    'Die Klang-Meditation ist ein geführtes Format, in dem obertonreiche Klänge als Zugang zu Entspannung, innerer Ruhe und Wahrnehmung dienen. Du liegst oder sitzt in einer ruhigen Umgebung und lässt Dich von einem Set aus verschiedenen Instrumenten begleiten, darunter Klangschalen, Didgeridoo, Shruti-Box, Obertongesang, Trommelgong, Sansula und Schamanentrommel.

Die Instrumente werden intuitiv ausgewählt und gespielt, abgestimmt auf die Stimmung des Moments. Der Ablauf ist bewusst einfach gehalten: Du musst nichts „leisten", sondern kannst hören, spüren und Dich auf die Wirkung von Klang, Schwingung und Pausen einlassen.

Das Angebot richtet sich an Menschen, die einen klaren, nicht komplizierten Weg zu Regeneration suchen – als Ausgleich zum Alltag, zur Stressreduktion oder als persönliche Ruhepraxis. Die Klang-Meditation wird gemeinsam von Madeleine Gasmi und Felice Limacher begleitet. Als Veranstaltungsort ist die Ilima Oase in Altendorf (SZ) genannt; die Platzzahl ist begrenzt, daher ist eine Anmeldung vorgesehen.',
    'Klangmeditation, Klangreise, Klangschalen, Didgeridoo, Shruti-Box, Obertongesang, Entspannung, Stressreduktion, Altendorf, Achtsamkeit, Schwingung, Regeneration',
    ARRAY['Obertonreiche Klänge bewusst wahrnehmen und differenzieren', 'Entspannungszustände über Klang und Atmung unterstützen', 'Aufmerksamkeit nach innen (Körperwahrnehmung) lenken', 'Eigene Stresssignale erkennen und regulieren'],
    'Keine Vorkenntnisse erforderlich',
    50,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'yoga_mental',
    'Meditation & Achtsamkeit',
    NULL,
    'Schwyz',
    1,
    'Abendveranstaltung',
    'https://www.tjapukai.ch/programm/klang-meditation/',
    'lead',
    'draft',
    false
);

-- 9. Klangreisen (meditative Instrumentenreise)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Klangreisen (meditative Instrumentenreise)',
    'Klangreisen sind ein Format, das meditative, schwingungsreiche und teils traditionelle Instrumente als „Reisemedium" nutzt. Du wirst mit Klängen von Instrumenten wie Klangschalen, Klangstäben, Didgeridoo, Shruti-Box, Gongs, Trommelgong, Shamanen- bzw. Indianertrommel, Pow Wow, N''Goni und weiteren Klangquellen begleitet.

Die Instrumente werden intuitiv ausgewählt und sollen mit ihren reinen Tönen Geborgenheit, innere Ruhe und Erdung unterstützen. Der Ablauf ist passiv-empfangend: Als Teilnehmende/r brauchst Du nichts weiter zu tun als zu lauschen, zu spüren und zu geniessen. So entsteht ein Raum, in dem tiefe Entspannung möglich wird und sich Regeneration sowie Stressreduktion begünstigen lassen.

Je nach Möglichkeit werden auch Kerzen und Räucherungen eingesetzt, um eine besondere Stimmung zu schaffen. Zielgruppe sind Menschen, die einen klangbasierten Zugang zu Ruhe und Innenwahrnehmung suchen – unabhängig von musikalischer Erfahrung. Termine, Durchführungsorte und Detailablauf sind von den jeweils angekündigten Veranstaltungen abhängig.',
    'Klangreise, Meditation, Gong, Klangschalen, Didgeridoo, Shruti-Box, Entspannung, Stressabbau, Regeneration, Achtsamkeit, Räucherung, Innenwahrnehmung',
    ARRAY['Klang als Ressource für Entspannung nutzen', 'Körperliche und mentale Ruhe über Hören und Spüren fördern', 'Achtsamkeit und Innenwahrnehmung vertiefen', 'Eigene Stressmuster erkennen und Loslassen üben'],
    'Keine Vorkenntnisse erforderlich',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'yoga_mental',
    'Meditation & Achtsamkeit',
    NULL,
    'Schwyz',
    1,
    'Je nach Veranstaltung',
    'https://www.tjapukai.ch/programm/klangreisen/',
    'lead',
    'draft',
    false
);

-- 10. Waldbaden (achtsame Natur- und Sinnesreise)
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Waldbaden (achtsame Natur- und Sinnesreise)',
    'Waldbaden ist ein angeleitetes Naturformat, das Dich auf eine intensive Entdeckungsreise in die Sinnlichkeit des Waldes führt. Du wirst achtsam begleitet und lernst, den Wald aus einer neuen Perspektive zu erleben – nicht als „Spaziergang mit Ziel", sondern als bewusstes Ankommen bei Wahrnehmung, Körpergefühl und Präsenz.

Inhaltlich wird mit sinnlichen Übungen und spielerischen Impulsen gearbeitet, die Dich unterstützen können, wieder zu fühlen, zu staunen und loszulassen. Der Ansatz betont das Erleben von Verbundenheit: Dich selbst als Teil eines grösseren Ganzen wahrzunehmen und Kontakt mit dem eigenen natürlichen Sein herzustellen, jenseits von Alltagsprägungen.

Die Anleitung erfolgt durch erfahrene „Vertraute der Natur und der Wälder". Das Angebot richtet sich an Menschen, die Ausgleich und Frische suchen und Natur als Ressource für Gelassenheit und Wohlbefinden nutzen möchten. Angaben zu konkreten Terminen, Dauer, Treffpunkt und Preis sind abhängig von der jeweiligen Durchführung.',
    'Waldbaden, Shinrin-Yoku, Achtsamkeit, Naturerlebnis, Sinnesübungen, Stressreduktion, Gelassenheit, Outdoor, Körperwahrnehmung, Entspannung, Wald, Resilienz',
    ARRAY['Sinneswahrnehmung im Naturraum bewusst schärfen', 'Achtsamkeit und Präsenz im Wald entwickeln', 'Übungen zum Loslassen und zur Selbstregulation kennenlernen', 'Natur als Ressource für Wohlbefinden im Alltag verankern'],
    'Keine Vorkenntnisse erforderlich',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'heim_garten',
    'Garten & Pflanzen',
    NULL,
    'Schwyz',
    1,
    'Je nach Veranstaltung',
    'https://www.tjapukai.ch/programm/waldbaden/',
    'lead',
    'draft',
    false
);

-- 11. "Natural"-seelenzentriertes Coaching
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
    canton,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro
) VALUES (
    '1ffbc7e1-c858-467d-99e4-929f804ccb36',
    'Natural Coaching (seelenzentriertes Coaching)',
    '„Natural Coaching" ist ein Coaching-Angebot, das Persönlichkeitsbildung mit einer inneren Forschungsreise verbindet. Methodisch basiert es auf den Grundlagen des seelenzentrierten Coachings (SZC) und kombiniert moderne, weltweit eingesetzte Coaching-Techniken mit Bezügen zu indigenen Weisheiten.

Als tragende Struktur werden die Elemente Feuer, Wasser, Luft und Erde sowie die „Kraft der Mitte" als Orientierungsrahmen genutzt, um eigene Themen zu klären und Entwicklung bewusst zu gestalten. Der Prozess ist darauf ausgerichtet, Kommunikation, Handeln und Selbstwahrnehmung in Richtung Ganzheit und authentisches Tun zu entwickeln.

Das Angebot richtet sich an Menschen, die nicht nur an Symptomen arbeiten wollen, sondern an Haltungen, Mustern und innerer Ausrichtung. Konkrete Themenfelder können je nach Person variieren (z.B. Entscheidungsfindung, Werte, Ausrichtung, Übergänge). Angaben zu Setting (Einzel/Gruppe), Dauer, Anzahl Sessions und Preis sind auf der Kursseite nicht eindeutig ausgewiesen und hängen vom konkreten Coaching-Setup ab.',
    'Coaching, seelenzentriertes Coaching, Persönlichkeitsentwicklung, Wertearbeit, Elemente, Feuer Wasser Luft Erde, Lebensübergang, Selbstführung, Kommunikation, Ganzheit, Naturcoaching, Sinn',
    ARRAY['Eigene Themen strukturiert reflektieren und einordnen', 'Ressourcen und Entwicklungsrichtungen klarer benennen', 'Elemente-orientierte Perspektiven zur Selbstführung nutzen', 'Schritte zu authentischem Handeln im Alltag ableiten'],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'privat_hobby',
    'alltag_leben',
    'Persönlichkeitsentwicklung',
    NULL,
    'Schwyz',
    1,
    'Je nach Coaching-Setup',
    'https://www.tjapukai.ch/programm/naturalcoaching/',
    'lead',
    'draft',
    false
);

-- ============================================
-- VERIFY INSERTED COURSES
-- ============================================
-- SELECT id, title, price, category_area, category_specialty, status
-- FROM courses
-- WHERE user_id = '1ffbc7e1-c858-467d-99e4-929f804ccb36'
-- ORDER BY created_at DESC;
