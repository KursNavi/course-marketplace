-- ============================================================
-- INSERT: loveissweet.ch — Kurse 5–27
-- Anbieter-UUID: 9d587fd1-815d-4c63-9f9b-2b97c5d1e748
-- Erstellt: 2026-05-26
-- ============================================================
-- Taxonomie-Mapping (verifiziert aus Produktions-DB):
--   Privat & Hobby (level1=2):
--   level3=23  Meditation & Achtsamkeit (yoga_achtsamkeit)
--   level3=100 Backen               (kochen_backen)
--   level3=128 Malen & Zeichnen     (kunst)
--   level3=131 Töpfern & Keramik    (kunst)
--   level3=132 Textiles Gestalten   (kunst)
--   level3=133 Basteln & DIY        (kunst)
--   level3=134 Floristik & Deko     (kunst)
--   level3=135 Genuss & Degustation (kochen_backen)
--   level3=136 Haushalt             (nachhaltigkeit_alltag)
--   level4=212 Stricken
--   level4=213 Makramee
--   level4=214 Punch Needle
--   level4=215 Keramik bemalen
--   level4=216 Ton modellieren
--   level4=217 Handlettering
--   level4=219 Schmuck
--   level4=220 Traumfänger
--   level4=221 Adventskranz
--   level4=222 Trockenblumen
--   level4=223 Cupcakes
--   level4=224 Torten
--   level4=225 Wine Tasting & Kreativworkshop
--   level4=226 Visionboard & Manifestation
--   level4=227 Kakaozeremonie & Kreativität
--   level4=228 Natürliche Reinigungsmittel
--   level4=199 Freies Malen
--
--   Kinder (level1=3): level3/level4 aus check_taxonomy_ids.sql ermitteln
-- ============================================================

DO $$
DECLARE
  v_id              BIGINT;
  v_instructor_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(full_name, ''), split_part(email, '@', 1), 'loveissweet.ch')
  INTO v_instructor_name
  FROM profiles WHERE id = '9d587fd1-815d-4c63-9f9b-2b97c5d1e748';

  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 5: Schmuck Workshop
  -- Basteln & DIY (133) / Schmuck (219)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Schmuck Workshop',
    'Im Schmuck Workshop gestalten Teilnehmende eigene Schmuckstücke wie Armband-Sets, Freundschaftsarmbänder, Brillenketten oder Fussketten. Mit Perlen, Bändern, Verschlüssen und Charms entstehen persönliche Accessoires, auch mit individuellen Botschaften. Der Workshop eignet sich für Anfänger:innen, kreative Schmuckliebhaber:innen sowie Eltern und Kinder ab 8 Jahren. Anleitung, Werkzeuge, Materialien, Snacks und Getränke sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    65, 'CHF 65', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 133, 219, true);
  UPDATE courses SET category_level3_id = 133, category_level4_id = 219 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-06-14', 'Basel', 'Basel-Stadt', '14.00–16.00 Uhr'),
    (v_id, '2026-07-19', 'Basel', 'Basel-Stadt', '14.00–16.00 Uhr'),
    (v_id, '2026-08-30', 'Basel', 'Basel-Stadt', '14.00–16.00 Uhr'),
    (v_id, '2026-09-27', 'Basel', 'Basel-Stadt', '14.00–16.00 Uhr'),
    (v_id, '2026-10-10', 'Basel', 'Basel-Stadt', '14.00–16.00 Uhr'),
    (v_id, '2026-11-28', 'Basel', 'Basel-Stadt', '14.00–16.00 Uhr'),
    (v_id, '2026-12-20', 'Basel', 'Basel-Stadt', '14.00–16.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 6: Handlettering Workshop
  -- Malen & Zeichnen (128) / Handlettering (217)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Handlettering Workshop',
    'In diesem Workshop lernen Teilnehmende Faux Calligraphy und gestalten eigene Schriftzüge ohne Pinsel oder Feder. Der Kurs führt in einfache Techniken, Buchstabenformen, Stile und Materialkunde ein und eignet sich besonders für Anfänger:innen. Mit Übungen und persönlicher Unterstützung entsteht ein eigenes kleines Lettering-Projekt. Enthalten sind ein Lettering-Stift, ein Übungsdossier, Materialien, Snacks und Getränke.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    79, 'CHF 79', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 128, 217, true);
  UPDATE courses SET category_level3_id = 128, category_level4_id = 217 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-06-27', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr'),
    (v_id, '2026-09-12', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 7: Cupcake Deko Workshop
  -- Backen (100) / Cupcakes (223)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Cupcake Deko Workshop',
    'In diesem Workshop dekorieren Teilnehmende sechs Cupcakes mit Frosting und/oder Fondant. Sie lernen, wie Farben eingefärbt, Spritzsack-Techniken angewendet und kleine Blumen oder Motive aus Fondant gestaltet werden. Der Kurs eignet sich für Kinder und Erwachsene ohne Vorkenntnisse, die Freude am Backen, Verzieren und kreativen Gruppenaktivitäten haben. Die selbst dekorierten Cupcakes werden am Ende mitgenommen.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    88, 'CHF 88–95', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 100, 223, true);
  UPDATE courses SET category_level3_id = 100, category_level4_id = 223 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-05-31', 'Basel', 'Basel-Stadt', '09.00–12.00 Uhr'),
    (v_id, '2026-09-06', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr'),
    (v_id, '2026-10-17', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 8: Malen Workshop
  -- Malen & Zeichnen (128) / Freies Malen (199)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Malen Workshop',
    'Im Textured-Art-Malworkshop gestalten Teilnehmende ein eigenes Bild mit Farbe, Struktur und verschiedenen Maltechniken. Der Kurs kann mit Anleitung oder nach eigenen Vorstellungen besucht werden und eignet sich für Anfänger:innen ohne Vorkenntnisse. Im Mittelpunkt stehen ein kreativer Nachmittag, das Ausprobieren von Techniken und das freie Gestalten eines individuellen Kunstwerks. Materialien, Snacks und Getränke sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    85, 'CHF 85', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 128, 199, true);
  UPDATE courses SET category_level3_id = 128, category_level4_id = 199 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-05-31', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr'),
    (v_id, '2026-06-27', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 9: Boho Adventskranz binden
  -- Floristik & Dekoration (134) / Adventskranz (221)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Boho Adventskranz binden',
    'In diesem saisonalen Workshop gestalten Teilnehmende einen Adventskranz im Boho-Stil. Mit Trockenblumen, Naturmaterialien und dekorativen Accessoires entsteht eine moderne Alternative zum klassischen Adventskranz. Der Kurs eignet sich für Kreativbegeisterte, die eine gemütliche Auszeit suchen und ein dekoratives Stück für die Adventszeit oder als Geschenk herstellen möchten. Alle Materialien, Snacks, Getränke und persönliche Betreuung sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    111, 'CHF 111', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 134, 221, true);
  UPDATE courses SET category_level3_id = 134, category_level4_id = 221 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-11-22', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr'),
    (v_id, '2026-11-29', 'Basel', 'Basel-Stadt', '09.00–12.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 10: Visionboard Workshop
  -- Meditation & Achtsamkeit (23) / Visionboard & Manifestation (226)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Visionboard Workshop',
    'Der Visionboard Workshop verbindet Manifestation, Meditation, Visualisierung und kreatives Gestalten. Teilnehmende werden durch eine geführte Meditation zur eigenen Herzensvision begleitet und gestalten daraus ein persönliches Visionboard. Der Kurs eignet sich für Menschen, die Klarheit über Wünsche und Ziele gewinnen, ihre Vision sichtbar machen und achtsam reflektieren möchten. Materialien, Snacks und Getränke sind enthalten; eine Yoga-Matte und warme Socken sollen mitgebracht werden.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    88, 'CHF 88', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 23, 226, true);
  UPDATE courses SET category_level3_id = 23, category_level4_id = 226 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-11-01', 'Basel', 'Basel-Stadt', '13.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 11: Bento Cake Workshop
  -- Backen (100) / Torten (224)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Bento Cake Workshop',
    'In diesem Workshop gestalten Teilnehmende kleine Kuchen im Bento-Style. Sie lernen, Mini-Kuchen mit Fondant, Buttercreme und Früchten zu dekorieren und nach eigenen Vorstellungen zu gestalten. Der Kurs eignet sich für Kinder und Erwachsene ohne Vorkenntnisse, die Freude an kreativer Dessertgestaltung haben. Alle Materialien, Dekoelemente, Snacks und Getränke sind enthalten; der fertige Bento Cake wird mitgenommen.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    85, 'CHF 85', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 100, 224, true);
  UPDATE courses SET category_level3_id = 100, category_level4_id = 224 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-09-06', 'Basel', 'Basel-Stadt', '09.00–12.00 Uhr'),
    (v_id, '2026-11-15', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 12: Makramee Figuren Ring
  -- Textiles Gestalten (132) / Makramee (213)  — keine Fixtermine
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Makramee Figuren Ring',
    'In diesem Workshop gestalten Teilnehmende einen persönlichen Makramee-Figurenring, zum Beispiel als Familienring, Hochzeits- oder Freundschaftsmotiv. Der Kurs führt in den Makramee-Stil ein und zeigt, wie zwei bis maximal drei Figuren gestaltet werden. Grössere Projekte können mit Material und Anleitung zu Hause fertiggestellt werden. Der Workshop eignet sich für Anfänger:innen und alle, die ein persönliches Dekoobjekt oder Geschenk herstellen möchten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    79, 'CHF 79', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 132, 213, true);
  UPDATE courses SET category_level3_id = 132, category_level4_id = 213 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (auf Anfrage)


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 13: Sophie Scarf Schal stricken
  -- Textiles Gestalten (132) / Stricken (212)  — wöchentlich (Mittwochs)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Sophie Scarf Schal stricken',
    'In diesem Strick-Workshop gestalten Teilnehmende einen eigenen Sophie Scarf in ihrer Lieblingsfarbe. Der Kurs vermittelt Grundlagen oder vertieft vorhandenes Wissen und verbindet Stricken mit achtsamer, entspannter Atmosphäre. Enthalten sind Cashmere-Wolle, Leih-Stricknadeln, Kursunterlagen, Snacks und Getränke. Der Workshop eignet sich für Anfänger:innen, Strickbegeisterte und Menschen, die Handarbeit mit Achtsamkeit verbinden möchten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    85, 'CHF 85', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'wochenkurs', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 132, 212, true);
  UPDATE courses SET category_level3_id = 132, category_level4_id = 212 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (Mittwochs, laufend)


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 14: Kakao Zeremonie & Keramik bemalen
  -- Meditation & Achtsamkeit (23) / Kakaozeremonie & Kreativität (227)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Kakao Zeremonie & Keramik bemalen',
    'Dieser Workshop verbindet eine Kakaozeremonie mit intuitivem Keramikbemalen. Teilnehmende beginnen mit einem achtsamen Ritual zum Loslassen und Herzöffnen und gestalten anschliessend ein Keramikstück aus dem kreativen Fluss heraus. Der Kurs eignet sich für Menschen, die eine ruhige, verbindende Auszeit suchen und Selbstausdruck mit handwerklicher Gestaltung verbinden möchten. Vorkenntnisse sind nicht nötig; Tee, Wasser, Kaffee und kleine Snacks sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    88, 'CHF 88', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 23, 227, true);
  UPDATE courses SET category_level3_id = 23, category_level4_id = 227 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (auf Anfrage)


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 15: Trocken-Blumen-Ring Workshop
  -- Floristik & Dekoration (134) / Trockenblumen (222)  — keine Fixtermine
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Trocken-Blumen-Ring Workshop',
    'In diesem Workshop gestalten Teilnehmende einen Trockenblumen-Ring als stilvolles Deko-Element oder handgemachtes Geschenk. Sie lernen, Trockenblumen, Gräser, Bänder und Zubehör harmonisch zu kombinieren und den Ring nach eigenen Vorstellungen zu dekorieren. Der Kurs eignet sich für Anfänger:innen, Floristik- und Dekoliebhaber:innen sowie alle, die Freude an kreativem Gestalten haben. Materialien, Snacks und Getränke sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    85, 'CHF 85', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 134, 222, true);
  UPDATE courses SET category_level3_id = 134, category_level4_id = 222 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (auf Anfrage)


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 16: Keramik bemalen Henna Art
  -- Töpfern & Keramik (131) / Keramik bemalen (215)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Keramik bemalen Henna Art',
    'In diesem Workshop bemalen Teilnehmende einen Teller oder eine Platte im filigranen Henna-Art-Stil. Sie lernen Grundlagen von Linienführung, Ornamenten und Mustern kennen und setzen florale oder orientalisch inspirierte Designs mit Keramikglasuren um. Das Werkstück wird nach dem Workshop glasiert und gebrannt und kann nach rund 2 bis 3 Wochen abgeholt oder gegen Versandkosten zugeschickt werden. Der Kurs eignet sich für Anfänger:innen und kreative Menschen, die ein persönliches Unikat gestalten möchten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    85, 'CHF 85', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 131, 215, true);
  UPDATE courses SET category_level3_id = 131, category_level4_id = 215 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-08-16', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 17: Wine tasting & Bottle painting
  -- Genuss & Degustation (135) / Wine Tasting & Kreativworkshop (225)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Wine tasting & Bottle painting',
    'Dieser Workshop kombiniert eine geführte Weindegustation mit kreativem Bottle Painting. Teilnehmende probieren ausgewählte Weine, erfahren mehr über Aromen, Noten und Pairing und gestalten gleichzeitig eine eigene bemalte Weinflasche. Der Kurs eignet sich für Erwachsene, die einen kreativen Abend mit Genuss, Austausch und einem dekorativen Ergebnis verbinden möchten. Malmaterialien, Snacks, Getränke und eine Flasche Prosecco zum Bemalen sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    89, 'CHF 89', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 135, 225, true);
  UPDATE courses SET category_level3_id = 135, category_level4_id = 225 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-08-20', 'Basel', 'Basel-Stadt', '19.00–22.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 18: Keramik bemalen & Brunch
  -- Töpfern & Keramik (131) / Keramik bemalen (215)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Keramik bemalen & Brunch',
    'Dieser Workshop verbindet Keramikbemalen mit einem gemütlichen Brunch. Teilnehmende bemalen ein Keramikstück ihrer Wahl, etwa Tasse, Schale oder Teller, und lernen Grundlagen zu Glasuren und Gestaltungstechniken kennen. Das Werkstück wird nach dem Workshop glasiert und gebrannt und kann später abgeholt oder gegen Versandkosten zugeschickt werden. Der Kurs eignet sich für kreative Me-Time, Freund:innen, Familie oder als Geschenkidee.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    111, 'CHF 111', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 131, 215, true);
  UPDATE courses SET category_level3_id = 131, category_level4_id = 215 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-08-22', 'Basel', 'Basel-Stadt', '10.00–13.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 19: Traumfänger Workshop
  -- Basteln & DIY (133) / Traumfänger (220)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Traumfänger Workshop',
    'In diesem Workshop gestalten Teilnehmende einen eigenen Traumfänger als Deko-Element oder handgemachtes Geschenk. Mit Ring, Garn, Bändern, Federn und dekorativen Elementen entsteht ein persönliches Stück im verspielten, Boho-, eleganten oder minimalistischen Stil. Der Kurs eignet sich für Anfänger:innen, Kreative und Dekoliebhaber:innen. Alle Materialien, Snacks, Getränke und eine gemütliche Workshop-Atmosphäre sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    95, 'CHF 95', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 133, 220, true);
  UPDATE courses SET category_level3_id = 133, category_level4_id = 220 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-09-13', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 20: Matcha Bowl modellieren
  -- Töpfern & Keramik (131) / Ton modellieren (216)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Matcha Bowl modellieren',
    'In diesem Workshop modellieren Teilnehmende von Hand eine eigene Matcha Bowl aus Ton. Sie lernen Grundlagen des Arbeitens mit Ton, formen die Schale Schritt für Schritt und entscheiden selbst über Form, Struktur und Design. Der Kurs eignet sich für Anfänger:innen, Matcha-Liebhaber:innen und alle, die ein persönliches Keramikstück gestalten möchten. Enthalten sind Ton, Werkzeuge, individuelle Unterstützung, Snacks, Getränke und ein Matcha Iced Latte.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    95, 'CHF 95', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 131, 216, true);
  UPDATE courses SET category_level3_id = 131, category_level4_id = 216 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-08-15', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 21: Punch needle Sticken
  -- Textiles Gestalten (132) / Punch Needle (214)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Punch needle Sticken',
    'In diesem Workshop entdecken Teilnehmende die Punch-Needle-Technik und gestalten eine Baumwolltasche mit einem eigenen Motiv. Zusätzlich werden kleine Projektideen wie Schlüsselanhänger, Untersetzer oder Magnete vorgestellt. Der Kurs eignet sich für Anfänger:innen und kreative Menschen, die eine neue textile Technik ausprobieren und beim Sticken entspannen möchten. Materialien, Snacks und Getränke sind enthalten; optional kann Material vor Ort gekauft werden.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    75, 'CHF 75', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 132, 214, true);
  UPDATE courses SET category_level3_id = 132, category_level4_id = 214 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-10-11', 'Basel', 'Basel-Stadt', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 22: Keramik & Brunch @HOY St. Gallen
  -- Töpfern & Keramik (131) / Keramik bemalen (215)
  -- Standort: St. Gallen
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'Keramik & Brunch @HOY St. Gallen',
    'Dieses Special verbindet Keramikbemalen mit einem Veggie-Brunch in St. Gallen. Im Ticket enthalten sind Material, ein Keramikstück, Anleitung vor Ort, ein Brunchbuffet, ein Getränk nach Wahl, eine Goodiebag, ein TrüFrü-Stand und eine Photobooth. Der Anlass eignet sich für Freundinnen, Familie, Arbeitskolleginnen oder Personen, die beim kreativen Gestalten neue Kontakte knüpfen möchten. Die Plätze sind limitiert.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    115, 'CHF 115', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'St. Gallen', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 131, 215, true);
  UPDATE courses SET category_level3_id = 131, category_level4_id = 215 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Marktplatz 22', 'St. Gallen', 'St. Gallen');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-10-03', 'St. Gallen', 'St. Gallen', '12.00–16.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 23: DIY Workshop natürliches Putzmittel
  -- Haushalt (136) / Natürliche Reinigungsmittel (228)
  -- Standort: Zürich
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    privat_kursart, canton, instructor_name
  ) VALUES (
    'DIY Workshop natürliches Putzmittel',
    'In diesem Workshop stellen Teilnehmende natürliche und giftstofffreie Putzmittel mit ätherischen Ölen selbst her. Ein Wissensvortrag vermittelt Grundlagen zu Schadstoffen in herkömmlichen Reinigungsmitteln, natürlichen Alternativen und einem bewussteren Haushalt. Anschliessend werden eigene DIY-Reinigungsprodukte gemischt und abgefüllt. Der Kurs eignet sich für alle, die nachhaltiger leben und praktische Alternativen für den Alltag kennenlernen möchten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    79, 'CHF 79', 'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'workshop_event', 'Zürich', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 136, 228, true);
  UPDATE courses SET category_level3_id = 136, category_level4_id = 228 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Falkenstrasse 12', 'Zürich', 'Zürich');

  INSERT INTO course_events (course_id, start_date, location, canton, schedule_description) VALUES
    (v_id, '2026-06-13', 'Zürich', 'Zürich', '14.00–17.00 Uhr');


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 24: Oriental Henna Party  [KINDER]
  -- TODO: level3_id und level4_id aus check_taxonomy_ids.sql (kinder) ermitteln
  --       Platzhalter: level3=? (kreativ/events), level4=? (kindergeburtstag)
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    kinder_kursart, min_age, requires_guardian_booking, canton, instructor_name
  ) VALUES (
    'Oriental Henna Party',
    'Die Oriental Henna Party ist ein Kindergeburtstag im Atelier mit Bauchtanz- und Henna-Workshop. Bis zu 8 Kinder ab 4 Jahren bewegen sich mit Bauchtanzgürteln zur Musik, üben ein einfaches Warm-up mit Mini-Choreografie und gestalten oder erhalten Henna-, Glitzer- oder Körperstift-Tattoos. Betreuung, Anleitung, Materialien, Snacks, Wasser, Capri-Sonne und Aufräumservice sind enthalten. Der Termin wird vorab per E-Mail angefragt.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    350, 'CHF 350 (Gesamtpaket bis 8 Kinder)',
    'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'kindergeburtstag', 4, false, 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 130, 231, true);
  UPDATE courses SET category_level3_id = 130, category_level4_id = 231 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (individuell anfragbar)


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 25: Beads Schmuck bastel Party  [KINDER]
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    kinder_kursart, min_age, requires_guardian_booking, canton, instructor_name
  ) VALUES (
    'Beads Schmuck bastel Party',
    'Die Beads Party ist ein Kindergeburtstag in Basel, bei dem bis zu 8 Kinder ab 6 Jahren eigene Armbänder, Ketten oder Schlüsselanhänger gestalten. Mit bunten Perlen, Buchstaben-Beads, Charms und Glitzer entstehen mehrere Schmuckstücke zum Mitnehmen. Betreuung, Anleitung, alle Materialien, Snacks, Wasser, Capri-Sonne und Aufräumservice sind enthalten. Termine sind an Mittwoch- oder Donnerstagnachmittagen auf Anfrage möglich.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    350, 'CHF 350 (Gesamtpaket bis 8 Kinder)',
    'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'kindergeburtstag', 6, false, 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 121, 229, true);
  UPDATE courses SET category_level3_id = 121, category_level4_id = 229 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (Mi/Do Nachmittag auf Anfrage)


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 26: Stofftaschen bemalen Party  [KINDER]
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    kinder_kursart, min_age, requires_guardian_booking, canton, instructor_name
  ) VALUES (
    'Stofftaschen bemalen Party',
    'Bei dieser Kindergeburtstags-Party bemalen bis zu 8 Kinder ab 6 Jahren eigene Stofftaschen mit Textilfarben, Schablonen und Stempeln. Jedes Kind gestaltet ein individuelles Werkstück und nimmt die Tasche am Ende mit nach Hause. Der Anlass eignet sich für Kinder, die gerne malen, basteln und kreativ gestalten. Betreuung, Anleitung, Materialien, eine hochwertige Stofftasche pro Kind, Snacks, Wasser, Capri-Sonne und Aufräumservice sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    350, 'CHF 350 (Gesamtpaket bis 8 Kinder)',
    'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'kindergeburtstag', 6, false, 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 130, 232, true);
  UPDATE courses SET category_level3_id = 130, category_level4_id = 232 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (Mi/Do Nachmittag auf Anfrage)


  -- ══════════════════════════════════════════════════════════════════
  -- Kurs 27: Slime Party  [KINDER]
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO courses (
    title, description, user_id, status, price, price_info,
    booking_type, delivery_types, languages,
    kinder_kursart, min_age, requires_guardian_booking, canton, instructor_name
  ) VALUES (
    'Slime Party',
    'Die Slime Party ist ein Kindergeburtstag in Basel, bei dem bis zu 8 Kinder ab 6 Jahren eigenen Slime herstellen. Gemeinsam wird gemischt, gegossen und mit Farben, Glitzer, Perlen oder Duft gestaltet. Der Workshop eignet sich für Kinder, die gerne basteln, experimentieren und ein eigenes Ergebnis mit nach Hause nehmen möchten. Betreuung, Anleitung, alle Materialien, Snacks, Wasser, Capri-Sonne und Aufräumservice sind enthalten.',
    '9d587fd1-815d-4c63-9f9b-2b97c5d1e748', 'published',
    350, 'CHF 350 (Gesamtpaket bis 8 Kinder)',
    'lead', ARRAY['presence'], ARRAY['Deutsch'],
    'kindergeburtstag', 6, false, 'Basel-Stadt', v_instructor_name
  ) RETURNING id INTO v_id;

  INSERT INTO course_category_assignments (course_id, level3_id, level4_id, is_primary)
  VALUES (v_id, 121, 230, true);
  UPDATE courses SET category_level3_id = 121, category_level4_id = 230 WHERE id = v_id;

  INSERT INTO course_locations (course_id, location_type, street, city, canton)
  VALUES (v_id, 'presence', 'Socinstrasse 2', 'Basel', 'Basel-Stadt');

  -- Keine Fixtermine (Mi/Do Nachmittag auf Anfrage)

END;
$$;

-- ============================================================
-- Verifikation (nach Ausführen):
-- ============================================================
-- SELECT id, title, category_level3_id, category_level4_id,
--        privat_kursart, kinder_kursart, price, canton
-- FROM courses
-- WHERE user_id = '9d587fd1-815d-4c63-9f9b-2b97c5d1e748'
-- ORDER BY id DESC
-- LIMIT 25;
