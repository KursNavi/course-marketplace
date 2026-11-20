-- =====================================================================
-- ENTWURF – NICHT ANWENDEN ohne ausdrückliche Freigabe (Stand 21.11.2026).
-- Liegt bewusst NICHT in supabase/migrations. Rückweg:
--   supabase/drafts/20261121090000_ai_search_result_store_and_guard_down.sql
--
-- Plan 14, Schritt 3 (14-abschlussstatus-und-live-plan.md):
--  A) Geschützter Ergebniswiederabruf: Ein erfolgreicher ('completed')
--     Suchlauf wird privat, kontogebunden und befristet (24 h) gespeichert.
--     Reload oder verlorene HTTP-Antwort mit derselben Kennung liefern
--     dasselbe Ergebnis – ohne zweite Inferenz und ohne neue Belastung.
--     Speichern und Abrufen prüfen Konto, Suchinhalt (query_hash) und den
--     Zustand 'completed' der Kontingentzeile. Kein Zugriff für anon/
--     authenticated; nur die Serverrolle über die Such-API.
--  B) Missbrauchs-/Parallelitätsbremse ATOMAR in ai_search_quota_reserve
--     (unter dem bestehenden Nutzer-Monats-Lock), mit denselben Grenzwerten
--     wie src/lib/aiSearch/abuseGuard.js:
--       - eine laufende Suche je Konto            → 'too_many_parallel'
--       - höchstens 3 neue Vorgänge je 60 s       → 'rate_limited'
--       - höchstens 5 Fehlschläge je 60 min       → 'cooldown'
--     Idempotente Wiederholungen derselben Kennung werden vorher erkannt und
--     nie gebremst. Kein Modellaufruf findet vor der Reservierung statt.
--
-- Bestehende Daten bleiben unverändert (nur neue Tabelle/Funktionen und
-- Ersatz einer Funktion mit gleicher Signatur).
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) Ergebnisspeicher
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_search_results (
  request_id  UUID PRIMARY KEY REFERENCES public.ai_search_usage(request_id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  query_hash  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS ai_search_results_expires_idx ON public.ai_search_results (expires_at);
CREATE INDEX IF NOT EXISTS ai_search_results_user_idx ON public.ai_search_results (user_id);
-- Für die Bremse (jüngste Vorgänge eines Kontos):
CREATE INDEX IF NOT EXISTS ai_search_usage_user_created_idx ON public.ai_search_usage (user_id, created_at);

ALTER TABLE public.ai_search_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_search_results FROM anon, authenticated;

-- Speichern nur für die eigene, abgeschlossene Kennung mit gleichem Inhalt.
CREATE OR REPLACE FUNCTION public.ai_search_result_store(
  p_request_id UUID, p_user_id UUID, p_query_hash TEXT, p_payload JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ai_search_usage%ROWTYPE;
BEGIN
  -- Grössenschranke gegen Missbrauch des Speichers (Ergebnis ≈ 10–40 kB).
  IF p_payload IS NULL OR octet_length(p_payload::text) > 512000 THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF NOT FOUND
     OR v_row.user_id IS DISTINCT FROM p_user_id
     OR v_row.query_hash IS DISTINCT FROM p_query_hash
     OR v_row.state <> 'completed' THEN
    RETURN FALSE;
  END IF;
  INSERT INTO ai_search_results (request_id, user_id, query_hash, payload)
  VALUES (p_request_id, p_user_id, p_query_hash, p_payload)
  ON CONFLICT (request_id) DO NOTHING;
  RETURN TRUE;
END;
$$;

-- Abruf nur für dasselbe Konto, denselben Inhalt, 'completed' und nicht abgelaufen.
CREATE OR REPLACE FUNCTION public.ai_search_result_fetch(
  p_request_id UUID, p_user_id UUID, p_query_hash TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.payload
  FROM ai_search_results r
  JOIN ai_search_usage u ON u.request_id = r.request_id
  WHERE r.request_id = p_request_id
    AND r.user_id = p_user_id
    AND r.query_hash = p_query_hash
    AND u.user_id = p_user_id
    AND u.state = 'completed'
    AND r.expires_at > now();
$$;

-- Löschung abgelaufener Ergebnisse (späterer Betriebsjob; nicht eingeplant).
CREATE OR REPLACE FUNCTION public.ai_search_result_cleanup()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH removed AS (
    DELETE FROM ai_search_results WHERE expires_at <= now() RETURNING 1
  )
  SELECT count(*)::INTEGER FROM removed;
$$;

-- ---------------------------------------------------------------------
-- B) Reservierung mit atomarer Bremse (gleiche Signatur wie bisher)
-- ---------------------------------------------------------------------
-- Rückgabe zusätzlich zu den bisherigen Werten:
--   'too_many_parallel' | 'rate_limited' | 'cooldown' (nichts reserviert)
CREATE OR REPLACE FUNCTION public.ai_search_quota_reserve(
  p_user_id UUID,
  p_request_id UUID,
  p_query_hash TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month TEXT := ai_search_month_key();
  v_row ai_search_usage%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_month, 0));

  -- Idempotenz zuerst: Wiederholungen derselben Kennung nie bremsen.
  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_row.user_id IS DISTINCT FROM p_user_id
       OR v_row.query_hash IS DISTINCT FROM p_query_hash THEN
      RETURN 'request_mismatch';
    END IF;
    RETURN 'already_' || v_row.state;
  END IF;

  -- Bremse (Grenzwerte = src/lib/aiSearch/abuseGuard.js GUARD_LIMITS).
  -- Laufend = reserviert und jünger als 2 min (Suche läuft höchstens 90 s);
  -- eine abgestürzte Suche sperrt das Konto so nicht bis zum Reservierungsablauf.
  IF EXISTS (
    SELECT 1 FROM ai_search_usage
    WHERE user_id = p_user_id AND state = 'reserved' AND reserved_until > now()
      AND created_at > now() - interval '120 seconds'
  ) THEN
    RETURN 'too_many_parallel';
  END IF;
  IF (SELECT count(*) FROM ai_search_usage
      WHERE user_id = p_user_id AND created_at > now() - interval '60 seconds') >= 3 THEN
    RETURN 'rate_limited';
  END IF;
  IF (SELECT count(*) FROM ai_search_usage
      WHERE user_id = p_user_id AND state = 'released'
        AND created_at > now() - interval '60 minutes') >= 5 THEN
    RETURN 'cooldown';
  END IF;

  IF ai_search_quota_used(p_user_id, v_month) >= p_limit THEN
    RETURN 'limit_reached';
  END IF;

  BEGIN
    INSERT INTO ai_search_usage (user_id, month_key, request_id, query_hash)
    VALUES (p_user_id, v_month, p_request_id, p_query_hash);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
    IF v_row.user_id IS DISTINCT FROM p_user_id
       OR v_row.query_hash IS DISTINCT FROM p_query_hash THEN
      RETURN 'request_mismatch';
    END IF;
    RETURN 'already_' || v_row.state;
  END;

  RETURN 'reserved';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ai_search_result_store(UUID, UUID, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_result_fetch(UUID, UUID, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_result_cleanup() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_quota_reserve(UUID, UUID, TEXT, INTEGER) FROM anon, authenticated, PUBLIC;
