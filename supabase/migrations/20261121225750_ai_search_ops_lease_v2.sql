-- =====================================================================
-- ENTWURF – NICHT ANWENDEN ohne ausdrückliche Freigabe (Stand 22.11.2026).
-- Liegt bewusst NICHT in supabase/migrations. Ersetzt den nie angewendeten
-- Entwurf 20261121160000_ai_search_ops_lease (Rollback-Test 12/12 am
-- 21.11.2026 bestanden, aber ohne Verlängerung/Abbruch/Schreibschutz).
-- Rückweg: supabase/drafts/20261122090000_ai_search_ops_lease_v2_down.sql
-- Rollback-Test: supabase/drafts/tests/20261122090000_ai_search_ops_lease_v2_test.sql
--
-- Laufsperre MIT Besitznachweis für den Betriebsrunner:
--   - acquire: neuer Lauf nur, wenn kein anderer gültiger Lauf existiert.
--     Abgelaufene offene Läufe werden dabei nachvollziehbar als 'expired'
--     abgeschlossen (Übernahme). Serialisiert über festen Advisory-Lock.
--   - renew: kurze Frist (30–300 s) wird vor jedem Arbeitsschritt
--     verlängert, höchstens bis max_until (harte Gesamtgrenze). Abgelaufen,
--     übernommen oder Abbruch angefordert → keine Verlängerung; der Runner
--     muss sofort aufhören. An der Gesamtgrenze läuft die Sperre ab.
--   - request_abort: Abbruch von aussen; nächster Schritt startet nicht.
--   - release: Abschluss nur durch den eigenen, noch gültigen Lauf; war die
--     Frist schon abgelaufen, wird der Lauf als 'expired' protokolliert.
--   - SCHREIBSCHUTZ (Fencing): Alle Schreibzugriffe des Runners laufen über
--     ai_search_ops_fenced_*. Diese prüfen in DERSELBEN Transaktion, dass
--     die Sperre noch gültig ist, und halten die Laufzeile mit FOR SHARE.
--     Eine Übernahme (acquire markiert die Zeile 'expired') muss darauf
--     warten. Nach Ablauf schlägt jeder weitere Schreibversuch mit
--     SQLSTATE KNL01 fehl – ein überlanger Lauf kann also nichts mehr
--     schreiben und nicht mit einem neuen überlappen.
--   - ai_search_ops_cleanup_tick: zeitgesteuerte Ergebnislöschung (wird
--     erst durch den getrennten Entwurf 20261122090100 eingeplant) inkl.
--     Protokollzeile und Aufbewahrung des Laufprotokolls (90 Tage).
-- Nur die Serverrolle darf die Funktionen ausführen. Bestehende Daten und
-- bestehende Funktionen bleiben unverändert (nur neue Objekte).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_search_ops_runs (
  id                 BIGSERIAL PRIMARY KEY,
  holder             UUID NOT NULL,
  modes              TEXT[] NOT NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_until        TIMESTAMPTZ NOT NULL,
  max_until          TIMESTAMPTZ NOT NULL,
  heartbeat_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  renewals           INTEGER NOT NULL DEFAULT 0,
  abort_requested_at TIMESTAMPTZ,
  abort_reason       TEXT,
  finished_at        TIMESTAMPTZ,
  outcome            TEXT CHECK (outcome IN ('ok', 'failed', 'aborted', 'expired', 'lost')),
  summary            JSONB,
  CHECK (lease_until <= max_until)
);

CREATE INDEX IF NOT EXISTS ai_search_ops_runs_open_idx
  ON public.ai_search_ops_runs (lease_until) WHERE finished_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_search_ops_runs_started_idx
  ON public.ai_search_ops_runs (started_at);

ALTER TABLE public.ai_search_ops_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_search_ops_runs FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- Sperre: übernehmen, verlängern, abbrechen, abschliessen
-- ---------------------------------------------------------------------

-- Rückgabe: Laufkennung oder NULL, wenn ein anderer gültiger Lauf existiert.
CREATE OR REPLACE FUNCTION public.ai_search_ops_lease_acquire(
  p_holder UUID,
  p_modes TEXT[],
  p_lease_seconds INTEGER,
  p_max_seconds INTEGER
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF p_holder IS NULL OR p_modes IS NULL OR cardinality(p_modes) = 0 THEN
    RAISE EXCEPTION 'ai_search_ops_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'ai_search_ops_lease_range' USING ERRCODE = '22023';
  END IF;
  IF p_max_seconds IS NULL OR p_max_seconds < p_lease_seconds OR p_max_seconds > 1800 THEN
    RAISE EXCEPTION 'ai_search_ops_max_range' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ai_search_ops_lease', 0));

  -- Übernahme: abgelaufene offene Läufe nachvollziehbar abschliessen. Wartet
  -- auf gerade laufende geschützte Schreibzugriffe (FOR SHARE).
  UPDATE ai_search_ops_runs
  SET finished_at = now(),
      outcome = 'expired',
      summary = COALESCE(summary, '{}'::jsonb)
        || jsonb_build_object('expired_detected_at', now(), 'taken_over_by', p_holder::text)
  WHERE finished_at IS NULL AND lease_until <= now();

  IF EXISTS (SELECT 1 FROM ai_search_ops_runs WHERE finished_at IS NULL) THEN
    RETURN NULL;
  END IF;

  INSERT INTO ai_search_ops_runs (holder, modes, lease_until, max_until)
  VALUES (p_holder, p_modes,
          now() + make_interval(secs => p_lease_seconds),
          now() + make_interval(secs => p_max_seconds))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Rückgabe: {status, lease_until, db_now, capped}
--   status: 'renewed' | 'lost' (fremd/unbekannt/schon beendet) | 'expired'
--           | 'abort_requested'
CREATE OR REPLACE FUNCTION public.ai_search_ops_lease_renew(
  p_run_id BIGINT,
  p_holder UUID,
  p_lease_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run ai_search_ops_runs%ROWTYPE;
  v_until TIMESTAMPTZ;
BEGIN
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'ai_search_ops_lease_range' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_run FROM ai_search_ops_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.holder IS DISTINCT FROM p_holder OR v_run.finished_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'lost', 'db_now', now());
  END IF;
  IF v_run.lease_until <= now() THEN
    UPDATE ai_search_ops_runs
    SET finished_at = now(), outcome = 'expired',
        summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object('expired_detected_at', now(), 'detected_by', 'renew')
    WHERE id = p_run_id;
    RETURN jsonb_build_object('status', 'expired', 'lease_until', v_run.lease_until, 'db_now', now());
  END IF;
  IF v_run.abort_requested_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'abort_requested', 'lease_until', v_run.lease_until, 'db_now', now(), 'reason', v_run.abort_reason);
  END IF;
  -- Nie über max_until hinaus (lease_until <= max_until per CHECK): Wer die
  -- Gesamtgrenze erreicht, läuft ab; 'capped' kündigt das an.
  v_until := LEAST(now() + make_interval(secs => p_lease_seconds), v_run.max_until);
  UPDATE ai_search_ops_runs
  SET lease_until = v_until, heartbeat_at = now(), renewals = renewals + 1
  WHERE id = p_run_id;
  RETURN jsonb_build_object('status', 'renewed', 'lease_until', v_until, 'db_now', now(),
                            'capped', v_until = v_run.max_until);
END;
$$;

-- Abbruch von aussen (z. B. Betreuer). Rückgabe TRUE, wenn ein offener Lauf
-- markiert wurde. Der Runner beendet sich vor dem nächsten Schritt; geschützte
-- Schreibzugriffe schlagen ab sofort fehl.
CREATE OR REPLACE FUNCTION public.ai_search_ops_request_abort(
  p_run_id BIGINT,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_search_ops_runs
  SET abort_requested_at = COALESCE(abort_requested_at, now()),
      abort_reason = COALESCE(abort_reason, left(COALESCE(p_reason, 'ohne Angabe'), 200))
  WHERE id = p_run_id AND finished_at IS NULL;
  RETURN FOUND;
END;
$$;

-- Rückgabe: 'released' | 'expired' (Frist war abgelaufen; als expired
-- protokolliert, gewünschtes Ergebnis in summary) | 'already_finished' |
-- 'not_owner'
CREATE OR REPLACE FUNCTION public.ai_search_ops_lease_release(
  p_run_id BIGINT,
  p_holder UUID,
  p_outcome TEXT,
  p_summary JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run ai_search_ops_runs%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('ok', 'failed', 'aborted', 'lost') THEN
    RAISE EXCEPTION 'ai_search_ops_outcome' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_run FROM ai_search_ops_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.holder IS DISTINCT FROM p_holder THEN
    RETURN 'not_owner';
  END IF;
  IF v_run.finished_at IS NOT NULL THEN
    -- Bereits (z. B. durch Übernahme) beendet: Zusammenfassung nachtragen,
    -- Ergebnis NICHT überschreiben.
    UPDATE ai_search_ops_runs
    SET summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object('late_summary', COALESCE(p_summary, '{}'::jsonb), 'late_outcome', p_outcome)
    WHERE id = p_run_id;
    RETURN 'already_finished';
  END IF;
  IF v_run.lease_until <= now() THEN
    UPDATE ai_search_ops_runs
    SET finished_at = now(), outcome = 'expired',
        summary = COALESCE(p_summary, '{}'::jsonb) || jsonb_build_object('requested_outcome', p_outcome)
    WHERE id = p_run_id;
    RETURN 'expired';
  END IF;
  UPDATE ai_search_ops_runs
  SET finished_at = now(), outcome = p_outcome, summary = p_summary
  WHERE id = p_run_id;
  RETURN 'released';
END;
$$;

-- ---------------------------------------------------------------------
-- Schreibschutz: interne Prüfung + geschützte Schreibfunktionen
-- ---------------------------------------------------------------------

-- Wirft KNL01, wenn der Lauf nicht (mehr) gültig ist; hält sonst die
-- Laufzeile bis Transaktionsende (FOR SHARE) → Übernahme wartet.
CREATE OR REPLACE FUNCTION public.ai_search_ops_assert_lease(p_run_id BIGINT, p_holder UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM ai_search_ops_runs
  WHERE id = p_run_id AND holder = p_holder AND finished_at IS NULL
    AND lease_until > now() AND abort_requested_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_search_ops_lease_lost' USING ERRCODE = 'KNL01';
  END IF;
END;
$$;

-- Index: Übernahme + Abschluss der Jobs desselben Kurses in EINER Transaktion.
CREATE OR REPLACE FUNCTION public.ai_search_ops_fenced_apply_upsert(
  p_run_id BIGINT, p_holder UUID,
  p_course_id BIGINT, p_source_version BIGINT, p_document JSONB, p_chunks JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outcome TEXT;
BEGIN
  PERFORM ai_search_ops_assert_lease(p_run_id, p_holder);
  v_outcome := ai_search_apply_upsert(p_course_id, p_source_version, p_document, p_chunks);
  UPDATE ai_search_jobs SET status = 'done', processed_at = now()
  WHERE course_id = p_course_id AND source_version <= p_source_version AND status = 'pending';
  RETURN v_outcome;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_search_ops_fenced_apply_delete(
  p_run_id BIGINT, p_holder UUID,
  p_course_id BIGINT, p_source_version BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outcome TEXT;
BEGIN
  PERFORM ai_search_ops_assert_lease(p_run_id, p_holder);
  v_outcome := ai_search_apply_delete(p_course_id, p_source_version);
  UPDATE ai_search_jobs SET status = 'done', processed_at = now()
  WHERE course_id = p_course_id AND source_version <= p_source_version AND status = 'pending';
  RETURN v_outcome;
END;
$$;

-- Index: Fehlversuch zählen (ab p_max_attempts → 'failed').
CREATE OR REPLACE FUNCTION public.ai_search_ops_fenced_job_failure(
  p_run_id BIGINT, p_holder UUID,
  p_job_ids BIGINT[], p_attempts INTEGER, p_error TEXT, p_max_attempts INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM ai_search_ops_assert_lease(p_run_id, p_holder);
  UPDATE ai_search_jobs
  SET attempts = p_attempts,
      last_error = left(COALESCE(p_error, ''), 500),
      status = CASE WHEN p_attempts >= p_max_attempts THEN 'failed' ELSE 'pending' END
  WHERE id = ANY(p_job_ids) AND status = 'pending';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Abgleich: Kurse einreihen, bereits offene nicht doppelt. Rückgabe = neu.
CREATE OR REPLACE FUNCTION public.ai_search_ops_fenced_enqueue(
  p_run_id BIGINT, p_holder UUID,
  p_course_ids BIGINT[], p_priority INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM ai_search_ops_assert_lease(p_run_id, p_holder);
  INSERT INTO ai_search_jobs (course_id, reason, priority)
  SELECT DISTINCT c, 'reconciliation', p_priority
  FROM unnest(COALESCE(p_course_ids, '{}'::bigint[])) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_search_jobs j WHERE j.course_id = c AND j.status = 'pending'
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Embeddings: nur speichern, wenn der Abschnittstext (content_hash)
-- unverändert ist. p_rows = [{"id":…, "content_hash":"…", "embedding":[…]}]
-- Rückgabe {stored, changed}.
CREATE OR REPLACE FUNCTION public.ai_search_ops_fenced_store_embeddings(
  p_run_id BIGINT, p_holder UUID,
  p_model_version TEXT, p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_stored INTEGER;
BEGIN
  PERFORM ai_search_ops_assert_lease(p_run_id, p_holder);
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 200 THEN
    RAISE EXCEPTION 'ai_search_ops_rows' USING ERRCODE = '22023';
  END IF;
  IF p_model_version IS NULL OR p_model_version <> (SELECT active_model_version FROM ai_search_config WHERE id = 1) THEN
    RAISE EXCEPTION 'ai_search_ops_model_version' USING ERRCODE = '22023';
  END IF;
  v_total := jsonb_array_length(p_rows);
  UPDATE ai_search_chunks c
  SET embedding = (r->'embedding')::text::vector, model_version = p_model_version
  FROM jsonb_array_elements(p_rows) AS r
  WHERE c.id = (r->>'id')::bigint AND c.content_hash = r->>'content_hash';
  GET DIAGNOSTICS v_stored = ROW_COUNT;
  RETURN jsonb_build_object('stored', v_stored, 'changed', v_total - v_stored);
END;
$$;

-- Ergebnisbereinigung unter Laufsperre (Runner).
CREATE OR REPLACE FUNCTION public.ai_search_ops_fenced_cleanup(
  p_run_id BIGINT, p_holder UUID, p_batch INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM ai_search_ops_assert_lease(p_run_id, p_holder);
  RETURN ai_search_result_cleanup(LEAST(GREATEST(p_batch, 1), 5000));
END;
$$;

-- ---------------------------------------------------------------------
-- Zeitgesteuerte Löschung (eingeplant erst durch Entwurf 20261122090100)
-- ---------------------------------------------------------------------
-- Löscht abgelaufene Ergebnisse physisch (höchstens p_max_batches ×
-- p_batch je Aufruf), entfernt Laufprotokollzeilen älter als 90 Tage und
-- schreibt eine abgeschlossene Protokollzeile (modes = {cleanup-scheduled}).
-- Unabhängig von der Laufsperre: Löschen von Abgelaufenem ist auch parallel
-- zu einem Runnerlauf unschädlich. Rückgabe = gelöschte Ergebnisse.
CREATE OR REPLACE FUNCTION public.ai_search_ops_cleanup_tick(
  p_batch INTEGER DEFAULT 5000,
  p_max_batches INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch INTEGER := LEAST(GREATEST(COALESCE(p_batch, 5000), 1), 5000);
  v_max INTEGER := LEAST(GREATEST(COALESCE(p_max_batches, 10), 1), 20);
  v_deleted INTEGER := 0;
  v_step INTEGER;
  v_i INTEGER := 0;
  v_pruned INTEGER;
  v_left INTEGER;
BEGIN
  LOOP
    v_step := ai_search_result_cleanup(v_batch);
    v_deleted := v_deleted + v_step;
    v_i := v_i + 1;
    EXIT WHEN v_step < v_batch OR v_i >= v_max;
  END LOOP;

  DELETE FROM ai_search_ops_runs
  WHERE finished_at IS NOT NULL AND started_at < now() - interval '90 days';
  GET DIAGNOSTICS v_pruned = ROW_COUNT;

  SELECT count(*) INTO v_left FROM ai_search_results WHERE expires_at <= now();

  INSERT INTO ai_search_ops_runs (holder, modes, started_at, lease_until, max_until, heartbeat_at, finished_at, outcome, summary)
  VALUES (gen_random_uuid(), ARRAY['cleanup-scheduled'], now(), now(), now(), now(), now(), 'ok',
          jsonb_build_object('deleted', v_deleted, 'expired_left', v_left, 'protocol_pruned', v_pruned));
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ai_search_ops_lease_acquire(UUID, TEXT[], INTEGER, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_lease_renew(BIGINT, UUID, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_request_abort(BIGINT, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_lease_release(BIGINT, UUID, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_assert_lease(BIGINT, UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_fenced_apply_upsert(BIGINT, UUID, BIGINT, BIGINT, JSONB, JSONB) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_fenced_apply_delete(BIGINT, UUID, BIGINT, BIGINT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_fenced_job_failure(BIGINT, UUID, BIGINT[], INTEGER, TEXT, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_fenced_enqueue(BIGINT, UUID, BIGINT[], INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_fenced_store_embeddings(BIGINT, UUID, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_fenced_cleanup(BIGINT, UUID, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_cleanup_tick(INTEGER, INTEGER) FROM anon, authenticated, PUBLIC;
