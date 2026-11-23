-- =====================================================================
-- Rollback-Test zum ENTWURF 20261124090000 (nachrangige Präfixtreffer).
-- NOCH NICHT AUSGEFÜHRT. Ausführung nur nach Freigabe, nur TESTumgebung.
--
-- EIN DO-Block: Entwurf, Prüfungen und Rückweg laufen darin; am Ende wird
-- IMMER eine Ausnahme ausgelöst → PostgreSQL rollt alles zurück.
--   Erfolg:  SQLSTATE KNT00, Meldung "AI_DRAFT_TEST_OK 9/9 Prüfungen …"
--   Fehler:  SQLSTATE KNTF0, Meldung "AI_DRAFT_TEST_FAIL …"
--
-- AUSSCHLIESSLICH EIGENE TESTDATEN (im Block angelegt, immer zurückgerollt):
-- ein Testanbieter-Profil, drei Entwurfs-Testkurse „ZZ Präfix-Test …“ mit je
-- einem eigenen Abschnitt. Bleibende Wirkung trotz Rollback: nur Zählerstände
-- (Identitäten/Sequenzen von courses, ai_search_jobs, ai_search_chunks).
--
-- Zusammensetzen: node scripts/ai-search-draft-sql-test.mjs lexical_prefix
-- =====================================================================
DO $ai_draft_test$
DECLARE
  c_expected CONSTANT INTEGER := 9;
  v_checks   INTEGER := 0;
  v_profile UUID;
  v_exact BIGINT;
  v_prefix BIGINT;
  v_other BIGINT;
  v_txt TEXT;
  v_pos_exact INTEGER;
  v_pos_prefix INTEGER;
  v_flag BOOLEAN;
  v_count INTEGER;
BEGIN
  BEGIN
    -- @@MIGRATION@@

    -- P1: Präfix aus langem Stamm, um ein Zeichen gekürzt
    v_txt := ai_search_prefix_query(ARRAY['fotografieren'])::text;
    IF v_txt IS DISTINCT FROM '''fotograf'':*' THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL P1: %s', v_txt);
    END IF;
    v_checks := v_checks + 1;

    -- P2: kurze Stämme erzeugen kein Präfix
    IF ai_search_prefix_query(ARRAY['beruf', 'nächste', 'yoga']) IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL P2: Präfix für kurzen Stamm';
    END IF;
    v_checks := v_checks + 1;

    -- P3: kein Operator aus Nutzertext (nur Buchstabenstämme)
    IF ai_search_prefix_query(ARRAY['abc:*|xyz', '!!!!!!!!!!']) IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL P3: Sonderzeichen übernommen';
    END IF;
    v_checks := v_checks + 1;

    -- P4: Präfix trifft „fotografisches“, die bisherige Suche nicht
    IF NOT (to_tsvector('german', 'fotografisches Sehen im Fotokurs') @@ ai_search_prefix_query(ARRAY['fotografieren']))
       OR (to_tsvector('german', 'fotografisches Sehen im Fotokurs') @@ websearch_to_tsquery('german', 'fotografieren')) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL P4: Stammverhalten weicht ab';
    END IF;
    v_checks := v_checks + 1;

    -- Testdaten: exakter Treffer, nur Präfix-Treffer, kein Treffer
    INSERT INTO profiles (id, full_name, role, package_tier, slug, city, canton, bio_text)
    VALUES (gen_random_uuid(), 'ZZ Präfix-Test Anbieter', 'teacher', 'basic',
            'zz-prefixtest-' || substr(md5(random()::text), 1, 10), 'Testort', 'Zürich', 'Testprofil')
    RETURNING id INTO v_profile;
    INSERT INTO courses (title, status, user_id, description) VALUES ('ZZ Präfix-Test exakt', 'draft', v_profile, 'x') RETURNING id INTO v_exact;
    INSERT INTO courses (title, status, user_id, description) VALUES ('ZZ Präfix-Test Präfix', 'draft', v_profile, 'x') RETURNING id INTO v_prefix;
    INSERT INTO courses (title, status, user_id, description) VALUES ('ZZ Präfix-Test fremd', 'draft', v_profile, 'x') RETURNING id INTO v_other;
    INSERT INTO ai_search_chunks (course_id, section, chunk_index, char_start, char_end, text, content_hash, source_version)
    VALUES (v_exact, 'description', 0, 0, 40, 'Zzqx fotografieren lernen', 'zz-a', 1),
           (v_prefix, 'description', 0, 0, 40, 'Zzqx fotografisches Sehen', 'zz-b', 1),
           (v_other, 'description', 0, 0, 40, 'Zzqx Töpfern an der Scheibe', 'zz-c', 1);

    -- L1: exakter Testkurs vor dem Präfix-Testkurs, Präfix-Testkurs gekennzeichnet
    SELECT r.pos INTO v_pos_exact
      FROM ai_search_lexical_prefix('fotografieren', ARRAY['fotografieren'], 1000) WITH ORDINALITY AS r(course_id, rank, best_section, best_chunk_index, prefix_only, pos)
      WHERE r.course_id = v_exact;
    SELECT r.pos INTO v_pos_prefix
      FROM ai_search_lexical_prefix('fotografieren', ARRAY['fotografieren'], 1000) WITH ORDINALITY AS r(course_id, rank, best_section, best_chunk_index, prefix_only, pos)
      WHERE r.course_id = v_prefix;
    IF v_pos_exact IS NULL OR v_pos_prefix IS NULL OR v_pos_exact >= v_pos_prefix THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL L1: Reihenfolge exakt %s, Präfix %s', v_pos_exact, v_pos_prefix);
    END IF;
    v_checks := v_checks + 1;

    SELECT prefix_only INTO v_flag FROM ai_search_lexical_prefix('fotografieren', ARRAY['fotografieren'], 1000) WHERE course_id = v_prefix;
    IF v_flag IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L2: Präfix-Treffer nicht gekennzeichnet';
    END IF;
    v_checks := v_checks + 1;

    -- L3: alle exakten Treffer stehen vor allen Präfix-Treffern
    SELECT count(*) INTO v_count FROM (
      SELECT r.prefix_only, lag(r.prefix_only) OVER (ORDER BY r.pos) AS prev
      FROM ai_search_lexical_prefix('fotografieren', ARRAY['fotografieren'], 1000) WITH ORDINALITY AS r(course_id, rank, best_section, best_chunk_index, prefix_only, pos)
    ) s WHERE prev IS TRUE AND prefix_only IS FALSE;
    IF v_count <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L3: exakter Treffer nach Präfix-Treffer';
    END IF;
    v_checks := v_checks + 1;

    -- L4: fremder Testkurs nicht enthalten; ohne Präfix gleiches Ergebnis wie ai_search_lexical
    IF EXISTS (SELECT 1 FROM ai_search_lexical_prefix('fotografieren', ARRAY['fotografieren'], 1000) WHERE course_id = v_other) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L4: fremder Kurs getroffen';
    END IF;
    IF EXISTS (
      (SELECT course_id FROM ai_search_lexical('yoga', 1000) EXCEPT SELECT course_id FROM ai_search_lexical_prefix('yoga', ARRAY['yoga'], 1000))
      UNION ALL
      (SELECT course_id FROM ai_search_lexical_prefix('yoga', ARRAY['yoga'], 1000) EXCEPT SELECT course_id FROM ai_search_lexical('yoga', 1000))
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL L4: ohne Präfix abweichend von ai_search_lexical';
    END IF;
    v_checks := v_checks + 1;

    -- @@ROLLBACK@@

    -- R1: Rückweg entfernt beide Funktionen
    IF to_regprocedure('ai_search_lexical_prefix(text,text[],integer)') IS NOT NULL OR to_regprocedure('ai_search_prefix_query(text[])') IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = 'AI_DRAFT_TEST_FAIL R1: Funktion nach Rückweg vorhanden';
    END IF;
    v_checks := v_checks + 1;
  END;

  IF v_checks <> c_expected THEN
    RAISE EXCEPTION USING ERRCODE = 'KNTF0', MESSAGE = format('AI_DRAFT_TEST_FAIL Anzahl %s/%s', v_checks, c_expected);
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'KNT00', MESSAGE = format('AI_DRAFT_TEST_OK %s/%s Prüfungen, alles zurückgerollt', v_checks, c_expected);
END
$ai_draft_test$;
