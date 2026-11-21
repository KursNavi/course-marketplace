-- =====================================================================
-- Rollback-Test zum ENTWURF 20261122090000 (Laufsperre v2 mit
-- Verlängerung, Abbruch, Übernahme und Schreibschutz).
-- NOCH NICHT AUSGEFÜHRT. Ausführung nur nach Freigabe, nur TESTumgebung.
--
-- EIN DO-Block: Entwurf, Prüfungen und Rückweg laufen darin; am Ende wird
-- IMMER eine Ausnahme ausgelöst → PostgreSQL rollt alles zurück.
--   Erfolg:  SQLSTATE KNT00, Meldung "AI_DRAFT_TEST_OK 28/28 Prüfungen …"
--   Fehler:  SQLSTATE KNTF0, Meldung "AI_DRAFT_TEST_FAIL …"
--   Anderer Code (z. B. 42601) = Test lief nicht.
--
-- AUSSCHLIESSLICH EIGENE TESTDATEN (alle im Block angelegt, immer
-- zurückgerollt): ein Testanbieter-Profil, zwei Entwurfs-Testkurse
-- „ZZ Laufsperre-Test …“ (deren Outbox-Jobs entstehen per Trigger), ein
-- eigener Abschnitt mit eigenem Vektor, ein Testkonto
-- zz-ki-leasetest-…@example.com mit drei eigenen, bereits abgelaufenen
-- Ergebniszeilen, Zeilen der neuen Tabelle ai_search_ops_runs.
-- Bestehende Kurse, Abschnitte, Jobs oder Ergebnisse werden weder für
-- Probe-Schreibvorgänge noch für die Bereinigung verwendet. Weil
-- ai_search_result_cleanup alle abgelaufenen Ergebnisse erfasst, bricht der
-- Test VOR jeder Bereinigung ab (Vorbedingung V), falls fremde abgelaufene
-- Ergebnisse existieren.
-- Bleibende Wirkung trotz Rollback: nur Zählerstände (Sequenzen/Identitäten
-- von courses, ai_search_jobs, ai_search_source_version_seq,
-- ai_search_chunks, ai_search_usage) steigen um die Zahl der eigenen
-- Testzeilen – wird im Nachher-Nachweis getrennt benannt.
-- Hinweis: now() steht innerhalb des Blocks still; Abläufe werden durch
-- Setzen von lease_until/expires_at in die Vergangenheit geprüft.
--
-- Zusammensetzen: node scripts/ai-search-draft-sql-test.mjs ops_lease_v2
-- =====================================================================
DO $ai_draft_test$
DECLARE
  c_expected CONSTANT INTEGER := 28;
  v_checks   INTEGER := 0;
  v_ok       TEXT[] := '{}';
  h1 UUID := gen_random_uuid();
  h2 UUID := gen_random_uuid();
  v_run  BIGINT;
  v_run2 BIGINT;
  v_old  BIGINT;
  v_int  INTEGER;
  v_txt  TEXT;
  v_json JSONB;
  v_until TIMESTAMPTZ;
  v_caught BOOLEAN;
  v_count INTEGER;
  v_course BIGINT;
  v_course2 BIGINT;
  v_profile UUID;
  v_user UUID := gen_random_uuid();
  v_chunk BIGINT;
  v_job BIGINT;
  v_vec_a TEXT := '[' || array_to_string(array_fill(0.01::real, ARRAY[1024]), ',') || ']';
  v_vec_b TEXT := '[' || array_to_string(array_fill(0.02::real, ARRAY[1024]), ',') || ']';
  v_version TEXT;
BEGIN
  BEGIN
    -- @@MIGRATION@@

    -- ---------- Vorbedingungen und eigene Testdaten ----------
    SELECT active_model_version INTO v_version FROM ai_search_config WHERE id = 1;
    IF v_version IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL V: keine aktive Modellversion';
    END IF;
    IF EXISTS (SELECT 1 FROM ai_search_results WHERE expires_at <= now()) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL V: fremde abgelaufene Ergebnisse vorhanden – Bereinigung würde sie erfassen, Test nicht ausgeführt';
    END IF;

    INSERT INTO profiles (id, full_name, role, package_tier, slug, city, canton, bio_text)
    VALUES (gen_random_uuid(), 'ZZ Laufsperre-Test Anbieter', 'teacher', 'basic',
            'zz-leasetest-' || substr(md5(random()::text), 1, 10), 'Testort', 'Zürich', 'Testprofil')
    RETURNING id INTO v_profile;
    INSERT INTO courses (title, status, user_id, description)
    VALUES ('ZZ Laufsperre-Test A', 'draft', v_profile, 'Testtext A') RETURNING id INTO v_course;
    INSERT INTO courses (title, status, user_id, description)
    VALUES ('ZZ Laufsperre-Test B', 'draft', v_profile, 'Testtext B') RETURNING id INTO v_course2;
    -- Outbox-Trigger hat je Kurs einen offenen Job angelegt; den von Kurs B
    -- entfernen, damit die geschützte Einreihung einen echten Insert zeigt.
    SELECT id INTO v_job FROM ai_search_jobs WHERE course_id = v_course AND status = 'pending' ORDER BY id LIMIT 1;
    DELETE FROM ai_search_jobs WHERE course_id = v_course2;
    IF v_job IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL V: Outbox-Job des Testkurses fehlt';
    END IF;
    INSERT INTO ai_search_chunks (course_id, section, chunk_index, char_start, char_end, text, content_hash, source_version, model_version, embedding)
    VALUES (v_course, 'description', 0, 0, 10, 'Testtext A', 'zz-hash-a', 1, v_version, v_vec_a::vector)
    RETURNING id INTO v_chunk;
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_user, 'zz-ki-leasetest-' || substr(v_user::text, 1, 8) || '@example.com', 'authenticated', 'authenticated');
    INSERT INTO ai_search_usage (user_id, month_key, request_id, query_hash, state, finalized_at)
    SELECT v_user, ai_search_month_key(), gen_random_uuid(), 'zz' || g, 'completed', now() FROM generate_series(1, 3) g;
    INSERT INTO ai_search_results (request_id, user_id, query_hash, payload, created_at, expires_at)
    SELECT request_id, v_user, query_hash, '{"test":true}'::jsonb, now() - interval '30 hours', now() - interval '6 hours'
    FROM ai_search_usage WHERE user_id = v_user;

    -- ---------- Übernehmen ----------
    v_run := ai_search_ops_lease_acquire(h1, ARRAY['index'], 60, 600);
    IF v_run IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL A1: erste Sperre';
    END IF;
    v_checks := v_checks + 1;
    v_run2 := ai_search_ops_lease_acquire(h2, ARRAY['cleanup'], 60, 600);
    IF v_run2 IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL A2: zweiter Lauf trotz gültiger Sperre';
    END IF;
    v_checks := v_checks + 1;
    v_count := 0;
    BEGIN PERFORM ai_search_ops_lease_acquire(h2, ARRAY['index'], 20, 600);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_count := v_count + 1; END;
    BEGIN PERFORM ai_search_ops_lease_acquire(h2, ARRAY['index'], 60, 3600);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_count := v_count + 1; END;
    BEGIN PERFORM ai_search_ops_lease_acquire(h2, ARRAY[]::text[], 60, 600);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_count := v_count + 1; END;
    IF v_count <> 3 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL A3: Grenzen (%s/3 abgewiesen)', v_count);
    END IF;
    v_checks := v_checks + 1;

    -- ---------- Verlängern ----------
    SELECT lease_until INTO v_until FROM ai_search_ops_runs WHERE id = v_run;
    v_json := ai_search_ops_lease_renew(v_run, h1, 120);
    IF v_json->>'status' IS DISTINCT FROM 'renewed'
       OR (SELECT lease_until FROM ai_search_ops_runs WHERE id = v_run) <= v_until
       OR (SELECT renewals FROM ai_search_ops_runs WHERE id = v_run) <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL N1: Verlängerung %s', v_json);
    END IF;
    v_checks := v_checks + 1;
    v_json := ai_search_ops_lease_renew(v_run, h2, 120);
    IF v_json->>'status' IS DISTINCT FROM 'lost' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL N2: fremder Halter verlängert';
    END IF;
    v_checks := v_checks + 1;
    UPDATE ai_search_ops_runs SET lease_until = now() + interval '10 seconds', max_until = now() + interval '20 seconds' WHERE id = v_run;
    v_json := ai_search_ops_lease_renew(v_run, h1, 300);
    IF v_json->>'status' IS DISTINCT FROM 'renewed'
       OR (SELECT lease_until = max_until FROM ai_search_ops_runs WHERE id = v_run) IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL N3: Gesamtgrenze nicht eingehalten';
    END IF;
    v_checks := v_checks + 1;
    IF (v_json->>'capped')::boolean IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL N4: Kappung nicht gemeldet %s', v_json);
    END IF;
    v_checks := v_checks + 1;

    -- ---------- Geschützte Schreibzugriffe mit gültiger Sperre ----------
    -- Bereinigung: nur eigene abgelaufene Ergebnisse existieren (Vorbedingung V).
    v_int := ai_search_ops_fenced_cleanup(v_run, h1, 2);
    IF v_int IS DISTINCT FROM 2
       OR (SELECT count(*) FROM ai_search_results WHERE user_id = v_user) <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL F1: Bereinigung unter Sperre (%s)', v_int);
    END IF;
    v_checks := v_checks + 1;
    -- Einreihung: Kurs A hat schon einen offenen Job (0 neu), Kurs B keinen (1 neu).
    v_int := ai_search_ops_fenced_enqueue(v_run, h1, ARRAY[v_course, v_course2], 5);
    IF v_int IS DISTINCT FROM 1
       OR (SELECT count(*) FROM ai_search_jobs WHERE course_id = v_course AND status = 'pending') <> 1
       OR (SELECT count(*) FROM ai_search_jobs WHERE course_id = v_course2 AND status = 'pending' AND reason = 'reconciliation') <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL F2: Einreihung/Duplikatschutz (%s)', v_int);
    END IF;
    v_checks := v_checks + 1;
    v_json := ai_search_ops_fenced_store_embeddings(v_run, h1, v_version,
      jsonb_build_array(jsonb_build_object('id', v_chunk, 'content_hash', 'zz-hash-a', 'embedding', v_vec_b::jsonb)));
    IF (v_json->>'stored')::int <> 1 OR (v_json->>'changed')::int <> 0
       OR (SELECT embedding::text FROM ai_search_chunks WHERE id = v_chunk) IS DISTINCT FROM v_vec_b::vector::text THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL F3: Vektor speichern %s', v_json);
    END IF;
    v_checks := v_checks + 1;
    v_json := ai_search_ops_fenced_store_embeddings(v_run, h1, v_version,
      jsonb_build_array(jsonb_build_object('id', v_chunk, 'content_hash', 'veraltet', 'embedding', v_vec_a::jsonb)));
    IF (v_json->>'stored')::int <> 0 OR (v_json->>'changed')::int <> 1
       OR (SELECT embedding::text FROM ai_search_chunks WHERE id = v_chunk) IS DISTINCT FROM v_vec_b::vector::text THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL F4: geänderter Abschnitt überschrieben';
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN PERFORM ai_search_ops_fenced_store_embeddings(v_run, h1, 'anderes-modell@1',
      jsonb_build_array(jsonb_build_object('id', v_chunk, 'content_hash', 'zz-hash-a', 'embedding', v_vec_a::jsonb)));
    EXCEPTION WHEN SQLSTATE '22023' THEN v_caught := TRUE; END;
    IF NOT v_caught THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL F5: fremde Modellversion gespeichert';
    END IF;
    v_checks := v_checks + 1;
    v_int := ai_search_ops_fenced_job_failure(v_run, h1, ARRAY[v_job], 1, 'Testfehler', 5);
    IF v_int IS DISTINCT FROM 1
       OR (SELECT attempts FROM ai_search_jobs WHERE id = v_job) <> 1
       OR (SELECT status FROM ai_search_jobs WHERE id = v_job) IS DISTINCT FROM 'pending'
       OR (SELECT last_error FROM ai_search_jobs WHERE id = v_job) IS DISTINCT FROM 'Testfehler' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL F6: Fehlversuch am eigenen Job';
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN PERFORM ai_search_ops_fenced_cleanup(v_run, h2, 100);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_caught := TRUE; END;
    IF NOT v_caught THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL F7: fremder Halter schreibt';
    END IF;
    v_checks := v_checks + 1;

    -- ---------- Abbruch ----------
    IF ai_search_ops_request_abort(v_run, 'Rollback-Test') IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL B1: Abbruch nicht markiert';
    END IF;
    v_json := ai_search_ops_lease_renew(v_run, h1, 120);
    IF v_json->>'status' IS DISTINCT FROM 'abort_requested' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL B1: Verlängerung trotz Abbruch %s', v_json);
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN PERFORM ai_search_ops_fenced_cleanup(v_run, h1, 100);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_caught := TRUE; END;
    IF NOT v_caught THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL B2: Schreibzugriff nach Abbruch';
    END IF;
    v_checks := v_checks + 1;
    v_txt := ai_search_ops_lease_release(v_run, h1, 'aborted', '{"step":"index"}'::jsonb);
    IF v_txt IS DISTINCT FROM 'released'
       OR (SELECT outcome FROM ai_search_ops_runs WHERE id = v_run) IS DISTINCT FROM 'aborted'
       OR (SELECT finished_at FROM ai_search_ops_runs WHERE id = v_run) IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL R1: Abschluss %s', v_txt);
    END IF;
    v_checks := v_checks + 1;
    v_txt := ai_search_ops_lease_release(v_run, h1, 'ok', '{}'::jsonb);
    IF v_txt IS DISTINCT FROM 'already_finished'
       OR (SELECT outcome FROM ai_search_ops_runs WHERE id = v_run) IS DISTINCT FROM 'aborted' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL R2: doppelter Abschluss überschreibt';
    END IF;
    v_checks := v_checks + 1;
    v_txt := ai_search_ops_lease_release(v_run, h2, 'ok', '{}'::jsonb);
    IF v_txt IS DISTINCT FROM 'not_owner' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL R3: fremder Halter schliesst ab';
    END IF;
    v_checks := v_checks + 1;

    -- ---------- Ablauf: kein Schreiben, keine Verlängerung, Übernahme ----------
    v_run := ai_search_ops_lease_acquire(h1, ARRAY['index', 'embed', 'cleanup'], 60, 600);
    IF v_run IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL E0: Sperre nach Abschluss nicht frei';
    END IF;
    UPDATE ai_search_ops_runs SET lease_until = now() - interval '1 second' WHERE id = v_run;
    v_count := 0;
    BEGIN PERFORM ai_search_ops_fenced_apply_upsert(v_run, h1, v_course, 1, '{}'::jsonb, '[]'::jsonb);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_count := v_count + 1; END;
    BEGIN PERFORM ai_search_ops_fenced_apply_delete(v_run, h1, v_course, 1);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_count := v_count + 1; END;
    BEGIN PERFORM ai_search_ops_fenced_job_failure(v_run, h1, ARRAY[-1]::bigint[], 1, 'x', 5);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_count := v_count + 1; END;
    BEGIN PERFORM ai_search_ops_fenced_enqueue(v_run, h1, ARRAY[v_course], 5);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_count := v_count + 1; END;
    BEGIN PERFORM ai_search_ops_fenced_store_embeddings(v_run, h1, v_version, '[]'::jsonb);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_count := v_count + 1; END;
    BEGIN PERFORM ai_search_ops_fenced_cleanup(v_run, h1, 100);
    EXCEPTION WHEN SQLSTATE 'KNL01' THEN v_count := v_count + 1; END;
    IF v_count <> 6 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL E1: nach Ablauf %s/6 Schreibfunktionen gesperrt', v_count);
    END IF;
    v_checks := v_checks + 1;
    v_json := ai_search_ops_lease_renew(v_run, h1, 120);
    IF v_json->>'status' IS DISTINCT FROM 'expired'
       OR (SELECT outcome FROM ai_search_ops_runs WHERE id = v_run) IS DISTINCT FROM 'expired' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL E2: abgelaufene Sperre verlängert %s', v_json);
    END IF;
    v_checks := v_checks + 1;

    -- Übernahme eines abgelaufenen, noch offenen Laufs.
    v_old := ai_search_ops_lease_acquire(h1, ARRAY['index'], 60, 600);
    UPDATE ai_search_ops_runs SET lease_until = now() - interval '1 second' WHERE id = v_old;
    v_run2 := ai_search_ops_lease_acquire(h2, ARRAY['cleanup'], 60, 600);
    IF v_old IS NULL OR v_run2 IS NULL
       OR (SELECT outcome FROM ai_search_ops_runs WHERE id = v_old) IS DISTINCT FROM 'expired'
       OR (SELECT summary->>'taken_over_by' FROM ai_search_ops_runs WHERE id = v_old) IS DISTINCT FROM h2::text THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL E3: Übernahme nicht nachvollziehbar';
    END IF;
    v_checks := v_checks + 1;
    v_txt := ai_search_ops_lease_release(v_old, h1, 'ok', '{"jobs":7}'::jsonb);
    IF v_txt IS DISTINCT FROM 'already_finished'
       OR (SELECT outcome FROM ai_search_ops_runs WHERE id = v_old) IS DISTINCT FROM 'expired'
       OR (SELECT summary->'late_summary'->>'jobs' FROM ai_search_ops_runs WHERE id = v_old) IS DISTINCT FROM '7' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL E4: später Abschluss %s', v_txt);
    END IF;
    v_checks := v_checks + 1;
    UPDATE ai_search_ops_runs SET lease_until = now() - interval '1 second' WHERE id = v_run2;
    v_txt := ai_search_ops_lease_release(v_run2, h2, 'ok', '{}'::jsonb);
    IF v_txt IS DISTINCT FROM 'expired'
       OR (SELECT outcome FROM ai_search_ops_runs WHERE id = v_run2) IS DISTINCT FROM 'expired'
       OR (SELECT summary->>'requested_outcome' FROM ai_search_ops_runs WHERE id = v_run2) IS DISTINCT FROM 'ok' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL E5: Abschluss nach Ablauf %s', v_txt);
    END IF;
    v_checks := v_checks + 1;

    -- ---------- Zeitgesteuerte Löschung ----------
    INSERT INTO ai_search_ops_runs (holder, modes, started_at, lease_until, max_until, finished_at, outcome)
    VALUES (h1, ARRAY['index'], now() - interval '100 days', now() - interval '100 days',
            now() - interval '100 days', now() - interval '100 days', 'ok')
    RETURNING id INTO v_old;
    v_int := ai_search_ops_cleanup_tick(100, 2);
    -- Nur noch das letzte EIGENE abgelaufene Ergebnis ist vorhanden.
    IF v_int IS DISTINCT FROM 1
       OR EXISTS (SELECT 1 FROM ai_search_results WHERE user_id = v_user)
       OR EXISTS (SELECT 1 FROM ai_search_ops_runs WHERE id = v_old)
       OR NOT EXISTS (SELECT 1 FROM ai_search_ops_runs WHERE modes = ARRAY['cleanup-scheduled'] AND outcome = 'ok'
                      AND (summary->>'deleted')::int = 1 AND (summary->>'expired_left')::int = 0
                      AND (summary->>'protocol_pruned')::int = 1) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL T1: zeitgesteuerte Löschung/Protokoll';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_ops_lease_acquire(h1, ARRAY['index'], 60, 600) IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL T2: Protokollzeile blockiert die Sperre';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'A/N/F/B/R/E/T Sperre exklusiv, Verlängerung bis Gesamtgrenze, Schreibschutz nach Ablauf/Abbruch/Fremdhalter, Übernahme protokolliert, Löschung + Protokollkürzung'::text;

    -- ---------- Rechte ----------
    IF has_function_privilege('anon', 'public.ai_search_ops_lease_acquire(uuid,text[],integer,integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.ai_search_ops_lease_renew(bigint,uuid,integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.ai_search_ops_request_abort(bigint,text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.ai_search_ops_fenced_store_embeddings(bigint,uuid,text,jsonb)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.ai_search_ops_fenced_cleanup(bigint,uuid,integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.ai_search_ops_cleanup_tick(integer,integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.ai_search_ops_assert_lease(bigint,uuid)', 'EXECUTE')
       OR has_table_privilege('authenticated', 'public.ai_search_ops_runs', 'SELECT') THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL R: Client-Rechte';
    END IF;
    v_checks := v_checks + 1;

    -- @@ROLLBACK@@

    IF to_regclass('public.ai_search_ops_runs') IS NOT NULL
       OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname LIKE 'ai\_search\_ops\_%') THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL D: Objekte nicht entfernt';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'R/D Client ohne Rechte; Rückweg entfernt alles'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'KNTF0' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = SQLERRM;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'KNTF0',
      MESSAGE = format('AI_DRAFT_TEST_FAIL unerwarteter Fehler nach %s/%s Prüfungen [%s] %s', v_checks, c_expected, SQLSTATE, SQLERRM);
  END;

  IF v_checks <> c_expected THEN
    RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL Prüfanzahl %s statt %s', v_checks, c_expected);
  END IF;

  RAISE EXCEPTION USING ERRCODE = 'KNT00',
    MESSAGE = format('AI_DRAFT_TEST_OK %s/%s Prüfungen bestanden – absichtlicher Abschluss-Rollback', v_checks, c_expected),
    DETAIL = array_to_string(v_ok, ' | ');
END
$ai_draft_test$;
