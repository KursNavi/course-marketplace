-- =====================================================================
-- Test zum ENTWURF 20261120090000 (nicht anwenden!). Stand 20.11.2026, v2.
--
-- EIN DO-Block. Entwurf, Szenarien und Rückweg laufen darin; am Ende wird
-- IMMER eine Ausnahme ausgelöst, wodurch PostgreSQL alles zurückrollt.
--
-- Eindeutige Abschlussmeldung:
--   Erfolg (absichtlicher Abschluss-Rollback):
--     SQLSTATE KNT00, Meldung beginnt mit
--     "AI_DRAFT_TEST_OK 16/16 Prüfungen bestanden"
--   Echter Fehler (Prüfung verfehlt ODER unerwarteter Datenbankfehler):
--     SQLSTATE KNTF0, Meldung beginnt mit "AI_DRAFT_TEST_FAIL"
--     (bei unerwarteten Fehlern mit ursprünglichem SQLSTATE in Klammern).
--   Jeder andere Fehlercode (z. B. 42601 Syntax) = Test lief nicht.
--   Erfolg gilt NUR bei KNT00 + Präfix + vollständiger Prüfanzahl.
--
-- Eigene Testdaten (Präfix "ZZ Entwurfstest"), keine vorhandenen Profile
-- oder Kurse werden verändert:
--   1 Profil (Rolle teacher, Paket basic, eigener Slug)
--   1 Kurs dieses Profils (zuerst Entwurf, mit gültiger aktiver Kategorie
--     vor dem Veröffentlichen), 1 Kategoriezuordnung, 1 Termin, 1 Ort
--
-- Zusammensetzen: node scripts/ai-search-draft-sql-test.mjs
-- (ersetzt die Marker durch EXECUTE-Aufrufe der Entwurfs-/Rückwegdateien).
-- Vorher/Nachher-Nachweis: ..._verify.sql (nur lesend).
-- =====================================================================
DO $ai_draft_test$
DECLARE
  c_expected CONSTANT INTEGER := 16;
  v_checks   INTEGER := 0;
  v_ok       TEXT[] := '{}';
  v_profile  UUID;
  v_course   BIGINT;
  v_level3   BIGINT;
  v_vec      vector := array_fill(0.01::real, ARRAY[1024])::vector;
  v_outcome  TEXT;
  v_n        INTEGER;
  v_before   INTEGER;
  v_event    UUID;
  v_loc      UUID;
BEGIN
  -- Innerer Block: JEDER Fehler darin wird als AI_DRAFT_TEST_FAIL (KNTF0)
  -- gemeldet und kann nie mit dem absichtlichen Abschluss verwechselt werden.
  BEGIN
    -- ----------------------------------------------------------------
    -- Entwurf ausführen (nur innerhalb dieses Blocks)
    -- ----------------------------------------------------------------
    -- @@MIGRATION@@

    -- ----------------------------------------------------------------
    -- Eigene Testdaten
    -- ----------------------------------------------------------------
    INSERT INTO profiles (id, full_name, role, package_tier, slug, city, canton, bio_text)
    VALUES (gen_random_uuid(), 'ZZ Entwurfstest Anbieter', 'teacher', 'basic',
            'zz-entwurfstest-' || substr(md5(random()::text), 1, 10), 'Testort', 'Zürich', 'Testprofil')
    RETURNING id INTO v_profile;

    INSERT INTO courses (title, status, user_id, description)
    VALUES ('ZZ Entwurfstest KI-Index', 'draft', v_profile, 'Testtext')
    RETURNING id INTO v_course;

    -- ================================================================
    -- A) Embeddings bei identischem Abschnittstext erhalten
    -- ================================================================
    v_outcome := ai_search_apply_upsert(v_course, 1, '{"content_hash":"h1","title":"t"}'::jsonb,
      '[{"section":"description","chunk_index":0,"char_start":0,"char_end":6,"text":"Text A"},
        {"section":"description","chunk_index":1,"char_start":6,"char_end":12,"text":"Text B"}]'::jsonb);
    IF v_outcome IS DISTINCT FROM 'inserted' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL A0: %s', v_outcome);
    END IF;
    v_checks := v_checks + 1;
    UPDATE ai_search_chunks SET embedding = v_vec, model_version = 'test@1024' WHERE course_id = v_course;

    -- A1: nur Fakten geändert (neuer Hash), Texte gleich → beide Embeddings bleiben
    v_outcome := ai_search_apply_upsert(v_course, 2, '{"content_hash":"h2","title":"t"}'::jsonb,
      '[{"section":"description","chunk_index":0,"char_start":0,"char_end":6,"text":"Text A"},
        {"section":"description","chunk_index":1,"char_start":6,"char_end":12,"text":"Text B"}]'::jsonb);
    SELECT count(*) INTO v_n FROM ai_search_chunks
     WHERE course_id = v_course AND embedding = v_vec AND model_version = 'test@1024';
    IF v_outcome IS DISTINCT FROM 'updated' OR v_n <> 2 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL A1: outcome=%s erhalten=%s (erwartet updated/2)', v_outcome, v_n);
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'A1 Faktenänderung: 2/2 Embeddings erhalten'::text;

    -- A2: A verschoben, B geändert, C neu → nur A behält sein Embedding
    v_outcome := ai_search_apply_upsert(v_course, 3, '{"content_hash":"h3","title":"t"}'::jsonb,
      '[{"section":"description","chunk_index":0,"char_start":0,"char_end":5,"text":"Neu C"},
        {"section":"description","chunk_index":1,"char_start":5,"char_end":11,"text":"Text A"},
        {"section":"objectives","chunk_index":0,"char_start":0,"char_end":15,"text":"Text B geändert"}]'::jsonb);
    IF (SELECT embedding = v_vec AND model_version = 'test@1024' FROM ai_search_chunks WHERE course_id = v_course AND text = 'Text A') IS NOT TRUE
       OR EXISTS (SELECT 1 FROM ai_search_chunks WHERE course_id = v_course AND text <> 'Text A' AND (embedding IS NOT NULL OR model_version IS NOT NULL))
       OR (SELECT count(*) FROM ai_search_chunks WHERE course_id = v_course) <> 3 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL A2a: falsche Übernahme bei verschobenem/geändertem Text';
    END IF;
    v_checks := v_checks + 1;
    IF EXISTS (SELECT 1 FROM ai_search_chunks WHERE course_id = v_course AND (content_hash <> 'h3' OR source_version <> 3)) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL A2b: Abschnittshash/-version nicht aktualisiert';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'A2 nur identischer Text übernommen, Hash/Version aktuell'::text;

    -- A3: veralteter Lauf ändert nichts
    v_outcome := ai_search_apply_upsert(v_course, 2, '{"content_hash":"h2","title":"t"}'::jsonb, '[]'::jsonb);
    IF v_outcome IS DISTINCT FROM 'stale_skipped' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL A3: %s', v_outcome);
    END IF;
    v_checks := v_checks + 1;

    -- A4: Embedding ohne Modellversion wird NICHT übernommen
    UPDATE ai_search_chunks SET embedding = v_vec, model_version = NULL WHERE course_id = v_course AND text = 'Neu C';
    v_outcome := ai_search_apply_upsert(v_course, 4, '{"content_hash":"h4","title":"t"}'::jsonb,
      '[{"section":"description","chunk_index":0,"char_start":0,"char_end":5,"text":"Neu C"}]'::jsonb);
    IF EXISTS (SELECT 1 FROM ai_search_chunks WHERE course_id = v_course AND embedding IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL A4: Embedding ohne Modellversion übernommen';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'A3/A4 Versionsschutz, ohne Modellversion keine Übernahme'::text;

    -- ================================================================
    -- Gültige Kategorie VOR dem Veröffentlichen (Veröffentlichungsschutz
    -- der App: veröffentlichte Kurse brauchen eine aktive Kategorie)
    -- ================================================================
    SELECT l3.id INTO v_level3
    FROM taxonomy_level3 l3
    JOIN taxonomy_level2 l2 ON l2.id = l3.level2_id AND l2.is_active
    JOIN taxonomy_level1 l1 ON l1.id = l2.level1_id AND l1.is_active
    WHERE l3.is_active
    ORDER BY l3.id LIMIT 1;
    INSERT INTO course_category_assignments (course_id, level3_id, is_primary) VALUES (v_course, v_level3, true);
    UPDATE courses SET category_level3_id = v_level3 WHERE id = v_course;
    IF NOT EXISTS (SELECT 1 FROM v_course_full_categories WHERE course_id = v_course AND is_primary) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL K: Testkurs hat vor dem Veröffentlichen keine gültige Kategorie';
    END IF;
    v_checks := v_checks + 1;

    -- ================================================================
    -- B) Aufträge nur bei suchrelevanter Änderung
    -- ================================================================
    SELECT count(*) INTO v_before FROM ai_search_jobs WHERE course_id = v_course;
    UPDATE courses SET title = title WHERE id = v_course;
    UPDATE courses SET instructor_name = 'ZZ Entwurfstest', is_pro = NOT COALESCE(is_pro, false),
                       is_prio = NOT COALESCE(is_prio, false) WHERE id = v_course;
    SELECT count(*) - v_before INTO v_n FROM ai_search_jobs WHERE course_id = v_course;
    IF v_n <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL B1: %s Auftrag/Aufträge bei wertgleichem bzw. ignoriertem UPDATE', v_n);
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'B1 wertgleich + instructor_name/is_pro/is_prio: 0 Aufträge'::text;

    UPDATE courses SET description = 'Testtext neu' WHERE id = v_course;                       -- Inhalt
    UPDATE courses SET price = COALESCE(price, 0) + 1 WHERE id = v_course;                     -- Preis
    UPDATE courses SET status = 'published' WHERE id = v_course;                               -- Status (mit Kategorie)
    UPDATE courses SET instructor_name = 'ZZ Anders', title = 'ZZ Entwurfstest neu' WHERE id = v_course; -- gemischt
    UPDATE courses SET level = CASE WHEN level = 'advanced' THEN 'beginner' ELSE 'advanced' END WHERE id = v_course; -- Niveau
    SELECT count(*) - v_before INTO v_n FROM ai_search_jobs WHERE course_id = v_course;
    IF v_n <> 5 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL B2a: %s statt 5 Aufträge bei echten Änderungen', v_n);
    END IF;
    v_checks := v_checks + 1;
    IF NOT EXISTS (SELECT 1 FROM ai_search_jobs WHERE course_id = v_course AND reason = 'course_upsert' AND priority = 3) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL B2b: Veröffentlichung ohne Priorität 3';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'B2 Inhalt/Preis/Veröffentlichung/gemischt/Niveau: je 1 Auftrag'::text;

    SELECT count(*) INTO v_before FROM ai_search_jobs WHERE course_id = v_course;
    INSERT INTO course_events (course_id, start_date) VALUES (v_course, now() + interval '30 days') RETURNING id INTO v_event;
    UPDATE course_events SET start_date = start_date WHERE id = v_event;                       -- wertgleich
    UPDATE course_events SET start_date = start_date + interval '1 day' WHERE id = v_event;    -- Termin
    DELETE FROM course_events WHERE id = v_event;
    INSERT INTO course_locations (course_id, city) VALUES (v_course, 'Zürich') RETURNING id INTO v_loc;
    UPDATE course_locations SET city = city WHERE id = v_loc;                                  -- wertgleich
    UPDATE course_locations SET city = 'Bern' WHERE id = v_loc;                                -- Ort
    SELECT count(*) - v_before INTO v_n FROM ai_search_jobs WHERE course_id = v_course;
    IF v_n <> 5 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL B3: %s statt 5 Aufträge für Termine/Orte', v_n);
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'B3 Termine/Orte: Einfügen/Ändern/Löschen 5, wertgleich 0'::text;

    -- ================================================================
    -- C) Änderung am EIGENEN Testprofil reiht genau dessen Kurs ein
    -- ================================================================
    SELECT count(*) INTO v_before FROM ai_search_jobs WHERE course_id = v_course AND reason = 'profile_change';
    UPDATE profiles SET bio_text = bio_text WHERE id = v_profile;
    SELECT count(*) - v_before INTO v_n FROM ai_search_jobs WHERE course_id = v_course AND reason = 'profile_change';
    IF v_n <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL C1: %s Aufträge bei wertgleichem Profil', v_n);
    END IF;
    v_checks := v_checks + 1;
    UPDATE profiles SET bio_text = 'Testprofil geändert' WHERE id = v_profile;
    SELECT count(*) - v_before INTO v_n FROM ai_search_jobs WHERE course_id = v_course AND reason = 'profile_change';
    IF v_n <> 1 OR EXISTS (SELECT 1 FROM ai_search_jobs j JOIN courses c ON c.id = j.course_id
                           WHERE j.reason = 'profile_change' AND j.status = 'pending' AND c.user_id <> v_profile
                             AND j.created_at >= now()) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL C2: %s statt 1 Auftrag bzw. fremde Kurse eingereiht', v_n);
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'C Testprofil: wertgleich 0, geändert 1 (nur eigener Kurs)'::text;

    -- ================================================================
    -- D) Rückweg: ursprüngliches Verhalten wiederhergestellt
    -- ================================================================
    -- @@ROLLBACK@@

    SELECT count(*) INTO v_before FROM ai_search_jobs WHERE course_id = v_course;
    UPDATE courses SET title = title WHERE id = v_course;
    SELECT count(*) - v_before INTO v_n FROM ai_search_jobs WHERE course_id = v_course;
    IF v_n <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL D1: Rückweg – wertgleiches UPDATE erzeugt %s statt 1 Auftrag (altes Verhalten)', v_n);
    END IF;
    v_checks := v_checks + 1;
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ai_search_profiles_outbox')
       OR to_regprocedure('public.ai_search_ignored_course_columns()') IS NOT NULL
       OR to_regprocedure('public.ai_search_enqueue_profile_jobs()') IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL D2: Rückweg hat Trigger/Funktionen nicht entfernt';
    END IF;
    v_checks := v_checks + 1;
    IF position('v_kept' IN pg_get_functiondef('public.ai_search_apply_upsert(bigint,bigint,jsonb,jsonb)'::regprocedure)) > 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL D3: Rückweg hat ai_search_apply_upsert nicht zurückgesetzt';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'D Rückweg: altes Verhalten, Trigger/Funktionen entfernt'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'KNTF0' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = SQLERRM;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'KNTF0',
      MESSAGE = format('AI_DRAFT_TEST_FAIL unerwarteter Fehler nach %s/%s Prüfungen [%s] %s', v_checks, c_expected, SQLSTATE, SQLERRM);
  END;

  IF v_checks <> c_expected THEN
    RAISE EXCEPTION USING ERRCODE = 'KNTF0',
      MESSAGE = format('AI_DRAFT_TEST_FAIL Prüfanzahl %s statt %s', v_checks, c_expected);
  END IF;

  -- Absichtlicher Abschluss: rollt alles zurück. Nur dieser Weg erzeugt KNT00.
  RAISE EXCEPTION USING ERRCODE = 'KNT00',
    MESSAGE = format('AI_DRAFT_TEST_OK %s/%s Prüfungen bestanden – absichtlicher Abschluss-Rollback', v_checks, c_expected),
    DETAIL = array_to_string(v_ok, ' | ');
END
$ai_draft_test$;
