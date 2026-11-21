-- =====================================================================
-- Rollback-Test zum ENTWURF 20261121160000 (Laufsperre Betriebsrunner).
-- NOCH NICHT AUSGEFÜHRT. Ausführung nur nach Freigabe, nur TESTumgebung.
--
-- EIN DO-Block: Entwurf, Prüfungen und Rückweg laufen darin; am Ende wird
-- IMMER eine Ausnahme ausgelöst → PostgreSQL rollt alles zurück.
--   Erfolg:  SQLSTATE KNT00, Meldung "AI_DRAFT_TEST_OK 12/12 Prüfungen …"
--   Fehler:  SQLSTATE KNTF0, Meldung "AI_DRAFT_TEST_FAIL …"
--   Anderer Code (z. B. 42601) = Test lief nicht.
--
-- Eigene Testdaten: nur Zeilen der neu angelegten Tabelle
-- ai_search_ops_runs (innerhalb des Blocks). Keine bestehenden Daten.
-- Bleibende Wirkung trotz Rollback: keine (die Sequenz der neuen Tabelle
-- wird mit zurückgerollt, da sie im Block angelegt wird).
--
-- Zusammensetzen: node scripts/ai-search-draft-sql-test.mjs ops_lease
-- =====================================================================
DO $ai_draft_test$
DECLARE
  c_expected CONSTANT INTEGER := 12;
  v_checks   INTEGER := 0;
  v_ok       TEXT[] := '{}';
  h1 UUID := gen_random_uuid();
  h2 UUID := gen_random_uuid();
  v_id  BIGINT;
  v_id2 BIGINT;
  v_bool BOOLEAN;
  v_caught BOOLEAN;
BEGIN
  BEGIN
    -- @@MIGRATION@@

    v_id := ai_search_ops_lease_acquire(h1, ARRAY['index'], 600);
    IF v_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L1: erste Sperre';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_ops_lease_acquire(h2, ARRAY['cleanup'], 600) IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L2: zweiter Lauf trotz aktiver Sperre';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_ops_lease_release(v_id, h2, 'ok', '{}'::jsonb)
       OR (SELECT finished_at FROM ai_search_ops_runs WHERE id = v_id) IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L3: fremder Halter beendet Lauf';
    END IF;
    v_checks := v_checks + 1;
    IF NOT ai_search_ops_lease_release(v_id, h1, 'ok', '{"jobs":3}'::jsonb)
       OR (SELECT outcome FROM ai_search_ops_runs WHERE id = v_id) IS DISTINCT FROM 'ok'
       OR (SELECT summary->>'jobs' FROM ai_search_ops_runs WHERE id = v_id) IS DISTINCT FROM '3' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L4: eigene Freigabe';
    END IF;
    v_checks := v_checks + 1;
    IF ai_search_ops_lease_release(v_id, h1, 'ok', '{}'::jsonb) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L5: doppelte Freigabe';
    END IF;
    v_checks := v_checks + 1;
    v_id2 := ai_search_ops_lease_acquire(h2, ARRAY['cleanup'], 600);
    IF v_id2 IS NULL OR v_id2 = v_id THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L6: Sperre nach Freigabe nicht frei';
    END IF;
    v_checks := v_checks + 1;
    -- Abgestürzter Lauf: Frist abgelaufen → Sperre frei, ohne Aufräumen.
    UPDATE ai_search_ops_runs SET lease_until = now() - interval '1 second' WHERE id = v_id2;
    v_id := ai_search_ops_lease_acquire(h1, ARRAY['embed'], 600);
    IF v_id IS NULL OR (SELECT finished_at FROM ai_search_ops_runs WHERE id = v_id2) IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L7: abgelaufene Frist sperrt weiter';
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN PERFORM ai_search_ops_lease_acquire(h2, ARRAY['index'], 30);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_caught := TRUE; END;
    IF NOT v_caught THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L8: zu kurze Frist';
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN PERFORM ai_search_ops_lease_acquire(h2, ARRAY['index'], 3600);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_caught := TRUE; END;
    IF NOT v_caught THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L9: zu lange Frist';
    END IF;
    v_checks := v_checks + 1;
    v_caught := FALSE;
    BEGIN PERFORM ai_search_ops_lease_acquire(h2, ARRAY[]::text[], 600);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_caught := TRUE; END;
    IF NOT v_caught THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L10: leere Modusliste';
    END IF;
    v_checks := v_checks + 1;
    v_ok := v_ok || 'L Sperre exklusiv, nur eigener Halter gibt frei, Frist löst Absturz, Grenzen geprüft'::text;

    IF has_function_privilege('anon', 'public.ai_search_ops_lease_acquire(uuid,text[],integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.ai_search_ops_lease_release(bigint,uuid,text,jsonb)', 'EXECUTE')
       OR has_table_privilege('authenticated', 'public.ai_search_ops_runs', 'SELECT') THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL R: Client-Rechte';
    END IF;
    v_checks := v_checks + 1;

    -- @@ROLLBACK@@

    IF to_regclass('public.ai_search_ops_runs') IS NOT NULL
       OR to_regprocedure('public.ai_search_ops_lease_acquire(uuid,text[],integer)') IS NOT NULL
       OR to_regprocedure('public.ai_search_ops_lease_release(bigint,uuid,text,jsonb)') IS NOT NULL THEN
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
