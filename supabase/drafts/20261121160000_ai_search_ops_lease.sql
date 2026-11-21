-- =====================================================================
-- ENTWURF – NICHT ANWENDEN ohne ausdrückliche Freigabe (Stand 21.11.2026).
-- Liegt bewusst NICHT in supabase/migrations. Rückweg:
--   supabase/drafts/20261121160000_ai_search_ops_lease_down.sql
-- Rollback-Test (erzwungener Rollback, nur eigene Testzeilen):
--   supabase/drafts/tests/20261121160000_ai_search_ops_lease_test.sql
--
-- Laufsperre + Laufprotokoll für den Betriebsrunner
-- (scripts/ai-search-ops.mjs). Verhindert gleichzeitige SCHREIBENDE
-- Betriebsdurchläufe über alle Rechner/Prozesse hinweg:
--   - ai_search_ops_lease_acquire: legt einen Lauf an, wenn kein anderer
--     aktiver Lauf (nicht beendet, Frist nicht abgelaufen) existiert; sonst
--     NULL. Serialisiert über einen festen Advisory-Lock.
--   - Frist (lease_until) begrenzt einen abgestürzten Lauf: danach ist die
--     Sperre automatisch frei, ohne manuelles Aufräumen.
--   - ai_search_ops_lease_release: beendet NUR den eigenen Lauf (Kennung +
--     Halter) und speichert Ergebnis und Zusammenfassung.
-- Nur die Serverrolle darf die Funktionen ausführen. Bestehende Daten
-- bleiben unverändert.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_search_ops_runs (
  id           BIGSERIAL PRIMARY KEY,
  holder       UUID NOT NULL,
  modes        TEXT[] NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_until  TIMESTAMPTZ NOT NULL,
  finished_at  TIMESTAMPTZ,
  outcome      TEXT CHECK (outcome IN ('ok', 'failed', 'aborted')),
  summary      JSONB
);

CREATE INDEX IF NOT EXISTS ai_search_ops_runs_open_idx
  ON public.ai_search_ops_runs (lease_until) WHERE finished_at IS NULL;

ALTER TABLE public.ai_search_ops_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_search_ops_runs FROM anon, authenticated;

-- Rückgabe: Laufkennung oder NULL, wenn ein anderer Lauf aktiv ist.
CREATE OR REPLACE FUNCTION public.ai_search_ops_lease_acquire(
  p_holder UUID,
  p_modes TEXT[],
  p_lease_seconds INTEGER
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
  -- Frist: mindestens 60 s, höchstens 30 min (Runner begrenzt die Laufzeit).
  IF p_lease_seconds IS NULL OR p_lease_seconds < 60 OR p_lease_seconds > 1800 THEN
    RAISE EXCEPTION 'ai_search_ops_lease_range' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ai_search_ops_lease', 0));

  IF EXISTS (
    SELECT 1 FROM ai_search_ops_runs
    WHERE finished_at IS NULL AND lease_until > now()
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO ai_search_ops_runs (holder, modes, lease_until)
  VALUES (p_holder, p_modes, now() + make_interval(secs => p_lease_seconds))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Rückgabe: TRUE, wenn der eigene, noch offene Lauf beendet wurde.
CREATE OR REPLACE FUNCTION public.ai_search_ops_lease_release(
  p_run_id BIGINT,
  p_holder UUID,
  p_outcome TEXT,
  p_summary JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_search_ops_runs
  SET finished_at = now(), outcome = p_outcome, summary = p_summary
  WHERE id = p_run_id AND holder = p_holder AND finished_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ai_search_ops_lease_acquire(UUID, TEXT[], INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_ops_lease_release(BIGINT, UUID, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
