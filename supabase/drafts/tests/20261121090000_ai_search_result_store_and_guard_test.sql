-- =====================================================================
-- Rollback-Test zum ENTWURF 20261121090000 (Ergebnisspeicher + Bremse), v1.
-- NOCH NICHT AUSGEFÜHRT. Ausführung nur nach Freigabe, nur TESTumgebung.
--
-- EIN DO-Block: Entwurf, Szenarien und Rückweg laufen darin; am Ende wird
-- IMMER eine Ausnahme ausgelöst → PostgreSQL rollt alles zurück.
--   Erfolg:  SQLSTATE KNT00, Meldung "AI_DRAFT_TEST_OK 31/31 Prüfungen …"
--   Fehler:  SQLSTATE KNTF0, Meldung "AI_DRAFT_TEST_FAIL …" (auch bei
--            unerwarteten Datenbankfehlern, mit Original-SQLSTATE)
--   Anderer Code (z. B. 42601) = Test lief nicht.
--
-- Eigene Testdaten (nur innerhalb des Blocks): drei Anmeldekonten
-- (Präfix zz-ki-rollbacktest-…@example.com, keine Mails), ihre Zeilen in
-- ai_search_usage / ai_search_results. Keine vorhandenen Konten/Daten.
-- Bleibende Wirkung trotz Rollback: verbrauchte Sequenznummern
-- (ai_search_usage.id). Zeitweise Sperren: Advisory-Locks je Testkonto,
-- Tabellen-/Funktions-DDL bis zum Rollback (Sekundenbruchteile).
--
-- Echte Gleichzeitigkeit (zwei Verbindungen) prüft ein DO-Block nicht;
-- hier wird der zweite Abschlussversuch nacheinander geprüft. Der parallele
-- Fall ist in scripts/ai-search-db-tests.mjs vorbereitet (läuft erst, wenn
-- der Entwurf angewendet ist).
--
-- Zusammensetzen: node scripts/ai-search-draft-sql-test.mjs result_store
-- =====================================================================
DO $ai_draft_test$
DECLARE
  c_expected CONSTANT INTEGER := 31;
  v_checks   INTEGER := 0;
  v_ok       TEXT[] := '{}';
  v_user     UUID := gen_random_uuid();
  v_other    UUID := gen_random_uuid();
  v_third    UUID := gen_random_uuid();
  r1 UUID := gen_random_uuid(); r2 UUID := gen_random_uuid(); r3 UUID := gen_random_uuid();
  ra UUID := gen_random_uuid(); rb UUID := gen_random_uuid(); rc UUID := gen_random_uuid();
  rd UUID := gen_random_uuid(); rx UUID := gen_random_uuid(); rt UUID := gen_random_uuid();
  v_payload  JSONB := '{"results":[{"courseId":1}],"criteria":{"terms":["yoga"]}}'::jsonb;
  v_text     TEXT;
  v_n        INTEGER;
  v_rows     INTEGER;
  v_caught   BOOLEAN;
BEGIN
  BEGIN
    -- @@MIGRATION@@

    INSERT INTO auth.users (id, email, aud, role) VALUES
      (v_user,  'zz-ki-rollbacktest-a-' || substr(v_user::text, 1, 8) || '@example.com', 'authenticated', 'authenticated'),
      (v_other, 'zz-ki-rollbacktest-b-' || substr(v_other::text, 1, 8) || '@example.com', 'authenticated', 'authenticated'),
      (v_third, 'zz-ki-rollbacktest-c-' || substr(v_third::text, 1, 8) || '@example.com', 'authenticated', 'authenticated');

    -- ============ S1 Speicherfehler: nichts gezählt, nichts gespeichert ============
    IF ai_search_quota_reserve(v_user, r1, 'h', 10) <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S1a: Reservierung';
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN
      PERFORM ai_search_quota_finalize_and_store(r1, v_user, 'h', jsonb_build_object('x', repeat('a', 600000)), 10);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_caught := TRUE;
    END;
    SELECT count(*) INTO v_n FROM ai_search_results WHERE request_id = r1;
    IF NOT v_caught OR (SELECT state FROM ai_search_usage WHERE request_id = r1) <> 'reserved' OR v_n <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S1b: zu grosse Nutzlast nicht vollständig zurückgerollt';
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN
      PERFORM ai_search_quota_finalize_and_store(r1, v_user, 'h', '[]'::jsonb, 10);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_caught := TRUE;
    END;
    IF NOT v_caught OR (SELECT state FROM ai_search_usage WHERE request_id = r1) <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S1c: ungültige Nutzlast';
    END IF;
    v_checks := v_checks + 1;
    -- Speicherfehler beim INSERT selbst (bereits vorhandene Ergebniszeile) rollt auch die Zählung zurück.
    INSERT INTO ai_search_results (request_id, user_id, query_hash, payload) VALUES (r1, v_user, 'h', '{}'::jsonb);
    v_caught := FALSE;
    BEGIN
      PERFORM ai_search_quota_finalize_and_store(r1, v_user, 'h', v_payload, 10);
    EXCEPTION WHEN unique_violation THEN v_caught := TRUE;
    END;
    IF NOT v_caught OR (SELECT state FROM ai_search_usage WHERE request_id = r1) <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S1d: INSERT-Fehler hat Zählung nicht zurückgerollt';
    END IF;
    v_checks := v_checks + 1;
    DELETE FROM ai_search_results WHERE request_id = r1;
    PERFORM ai_search_quota_release(r1);
    IF ai_search_quota_used(v_user, ai_search_month_key()) <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S1e: Fehlschlag wurde gezählt';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'S1 Speicherfehler: Ausnahme, nichts gezählt/gespeichert'::text;

    -- ============ S2 Erfolg + verlorene Antwort ============
    IF ai_search_quota_reserve(v_user, r2, 'h', 10) <> 'reserved'
       OR ai_search_quota_finalize_and_store(r2, v_user, 'h', v_payload, 10) <> 'completed' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S2a: Abschluss';
    END IF;
    v_checks := v_checks + 1;
    IF (SELECT count(*) FROM ai_search_results WHERE request_id = r2) <> 1
       OR ai_search_quota_used(v_user, ai_search_month_key()) <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S2b: gezählt + gespeichert';
    END IF;
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_rows FROM ai_search_usage WHERE user_id = v_user;
    v_text := ai_search_quota_reserve(v_user, r2, 'h', 10);
    IF v_text <> 'already_completed' OR ai_search_result_fetch(r2, v_user, 'h') IS DISTINCT FROM v_payload
       OR ai_search_quota_used(v_user, ai_search_month_key()) <> 1
       OR (SELECT count(*) FROM ai_search_usage WHERE user_id = v_user) <> v_rows THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL S2c: Wiederabruf %s', v_text);
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'S2 Erfolg gezählt+gespeichert; Wiederabruf ohne Zählung/neue Zeile'::text;

    -- ============ S3 fremdes Konto / anderer Inhalt ============
    IF ai_search_result_fetch(r2, v_other, 'h') IS NOT NULL OR ai_search_result_fetch(r2, v_user, 'anders') IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S3a: fremder Abruf';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_quota_reserve(v_other, r2, 'h', 10) <> 'request_mismatch'
       OR ai_search_quota_finalize_and_store(r2, v_other, 'h', v_payload, 10) <> 'request_mismatch' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S3b: fremde Kennung';
    END IF;
    v_checks := v_checks + 1;

    -- ============ S4 zweiter Abschlussversuch ============
    IF ai_search_quota_finalize_and_store(r2, v_user, 'h', v_payload, 10) <> 'not_reserved'
       OR (SELECT count(*) FROM ai_search_results WHERE request_id = r2) <> 1
       OR ai_search_quota_used(v_user, ai_search_month_key()) <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S4: zweiter Abschluss';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'S3/S4 fremd abgewiesen; zweiter Abschluss zählt/speichert nicht'::text;

    -- ============ S5 Wiederabruf nach > 1 h trotz Abkühlpause ============
    UPDATE ai_search_usage SET created_at = now() - interval '2 hours', finalized_at = now() - interval '2 hours' WHERE request_id = r2;
    UPDATE ai_search_results SET created_at = now() - interval '2 hours', expires_at = now() + interval '22 hours' WHERE request_id = r2;
    -- r1 ist bereits ein Fehlschlag; 4 weitere (je älter als 1 min, damit nicht „pro Minute“ greift).
    INSERT INTO ai_search_usage (user_id, month_key, request_id, query_hash, state, created_at, finalized_at)
    SELECT v_user, ai_search_month_key(), gen_random_uuid(), 'h' || g, 'released', now() - (g || ' minutes')::interval, now()
    FROM generate_series(2, 5) g;
    UPDATE ai_search_usage SET created_at = now() - interval '90 seconds' WHERE request_id = r1;
    IF ai_search_quota_reserve(v_user, rx, 'neu', 10) <> 'cooldown' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S5a: Abkühlpause';
    END IF;
    v_checks := v_checks + 1;
    SELECT count(*) INTO v_rows FROM ai_search_usage WHERE user_id = v_user;
    IF ai_search_quota_reserve(v_user, r2, 'h', 10) <> 'already_completed'
       OR ai_search_result_fetch(r2, v_user, 'h') IS DISTINCT FROM v_payload
       OR (SELECT count(*) FROM ai_search_usage WHERE user_id = v_user) <> v_rows THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S5b: Wiederabruf > 1 h gebremst oder gezählt';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'S5 Wiederabruf nach 2 h trotz Abkühlpause, ohne neue Zeile'::text;

    -- ============ S6 vorübergehende Sperren (Parallel, pro Minute) ============
    IF ai_search_quota_reserve(v_other, ra, 'a', 10) <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S6a';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_quota_reserve(v_other, rb, 'b', 10) <> 'too_many_parallel' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S6b: Parallelgrenze';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_quota_reserve(v_other, ra, 'a', 10) <> 'already_reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S6c: Wiederholung gebremst';
    END IF;
    v_checks := v_checks + 1;
    -- Abgestürzte Reservierung älter als 120 s sperrt nicht mehr.
    UPDATE ai_search_usage SET created_at = now() - interval '150 seconds' WHERE request_id = ra;
    IF ai_search_quota_reserve(v_other, rb, 'b', 10) <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S6d: alte Reservierung sperrt';
    END IF;
    v_checks := v_checks + 1;
    PERFORM ai_search_quota_release(rb);
    IF ai_search_quota_reserve(v_other, rc, 'c', 10) <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S6e';
    END IF;
    v_checks := v_checks + 1;
    PERFORM ai_search_quota_release(rc);
    PERFORM ai_search_quota_release(ra);
    -- rb, rc in den letzten 60 s + eine weitere → 3 → vierte gebremst.
    INSERT INTO ai_search_usage (user_id, month_key, request_id, query_hash, state, finalized_at)
    VALUES (v_other, ai_search_month_key(), gen_random_uuid(), 'z', 'completed', now());
    IF ai_search_quota_reserve(v_other, rd, 'd', 10) <> 'rate_limited' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S6f: Minutengrenze';
    END IF;
    v_checks := v_checks + 1;
    UPDATE ai_search_usage SET created_at = now() - interval '2 minutes' WHERE user_id = v_other;
    IF ai_search_quota_reserve(v_other, rd, 'd', 10) <> 'reserved'
       OR ai_search_quota_finalize_and_store(rd, v_other, 'd', v_payload, 10) <> 'completed' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S6g: Sperre nicht vorübergehend';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'S6 Parallel/Minute vorübergehend; Wiederholung nie gebremst; Absturz sperrt ≤ 2 min'::text;

    -- ============ S7 Abrufbarkeit ≠ Löschung ============
    UPDATE ai_search_results SET expires_at = now() - interval '1 second' WHERE request_id = r2;
    IF ai_search_result_fetch(r2, v_user, 'h') IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S7a: abgelaufenes Ergebnis abrufbar';
    END IF;
    v_checks := v_checks + 1;
    IF (SELECT count(*) FROM ai_search_results WHERE request_id = r2) <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S7b: Ablauf darf nicht selbst löschen';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_result_cleanup(5000) < 1 OR EXISTS (SELECT 1 FROM ai_search_results WHERE request_id = r2)
       OR NOT EXISTS (SELECT 1 FROM ai_search_results WHERE request_id = rd) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S7c: Bereinigung';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_quota_reserve(v_user, r2, 'h', 10) <> 'already_completed' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S7d: Kontingentzeile verändert';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'S7 abgelaufen = nicht abrufbar, aber gespeichert; Bereinigung löscht nur Abgelaufenes'::text;

    -- ============ S8 Kontolöschung und Löschbegehren ============
    IF ai_search_quota_reserve(v_third, rt, 't', 10) <> 'reserved'
       OR ai_search_quota_finalize_and_store(rt, v_third, 't', v_payload, 10) <> 'completed' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S8a';
    END IF;
    v_checks := v_checks + 1;
    DELETE FROM auth.users WHERE id = v_third;
    IF EXISTS (SELECT 1 FROM ai_search_results WHERE user_id = v_third) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S8b: Ergebnis überlebt Kontolöschung';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_result_purge_user(v_other) <> 1 OR EXISTS (SELECT 1 FROM ai_search_results WHERE user_id = v_other) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL S8c: Löschbegehren';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'S8 Kontolöschung kaskadiert; Löschbegehren entfernt alle Ergebnisse'::text;

    -- ============ Rechte ============
    IF has_function_privilege('anon', 'public.ai_search_result_fetch(uuid,uuid,text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.ai_search_quota_finalize_and_store(uuid,uuid,text,jsonb,integer)', 'EXECUTE')
       OR has_table_privilege('authenticated', 'public.ai_search_results', 'SELECT') THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL R: Client-Rechte';
    END IF;
    v_checks := v_checks + 1;

    -- ============ D Rückweg ============
    -- @@ROLLBACK@@

    IF to_regclass('public.ai_search_results') IS NOT NULL
       OR to_regprocedure('public.ai_search_quota_finalize_and_store(uuid,uuid,text,jsonb,integer)') IS NOT NULL
       OR to_regprocedure('public.ai_search_result_fetch(uuid,uuid,text)') IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL D1: Objekte nicht entfernt';
    END IF;
    v_checks := v_checks + 1;
    -- Ohne Bremse: v_user hätte Abkühlpause, reserviert jetzt wieder normal.
    IF ai_search_quota_reserve(v_user, gen_random_uuid(), 'nach-rueckweg', 10) <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL D2: Reservierung nicht zurückgesetzt';
    END IF;
    v_checks := v_checks + 1;
    IF position('too_many_parallel' IN pg_get_functiondef('public.ai_search_quota_reserve(uuid,uuid,text,integer)'::regprocedure)) > 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL D3: Bremse noch aktiv';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'D Rückweg: Speicher/Funktionen entfernt, Reservierung wie vorher'::text;
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
