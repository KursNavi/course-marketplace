-- =====================================================================
-- ENTWURF v2 – NICHT ANWENDEN ohne ausdrückliche Freigabe (Stand 21.11.2026).
-- Liegt bewusst NICHT in supabase/migrations. Rückweg:
--   supabase/drafts/20261121090000_ai_search_result_store_and_guard_down.sql
-- Rollback-Test (nur eigene Testdaten, erzwungener Rollback):
--   supabase/drafts/tests/20261121090000_ai_search_result_store_and_guard_test.sql
--
-- Plan 14, Schritt 3 – korrigierte Fassung nach Prüfung vom 21.11.2026:
--
--  A) Kontingentabschluss UND Ergebnisspeicherung in EINER Transaktion
--     (ai_search_quota_finalize_and_store). Schlägt das Speichern fehl,
--     wird die ganze Funktion zurückgerollt: die Reservierung bleibt
--     'reserved' (wird danach freigegeben), es entsteht nie eine verbrauchte
--     Suche ohne gespeichertes Ergebnis. Fehler werden als Ausnahme gemeldet,
--     nicht verschluckt. Zwei gleichzeitige Abschlussversuche serialisieren
--     über den Nutzer-Monats-Lock und FOR UPDATE; nur einer zählt.
--
--  B) Abrufbarkeit ≠ Löschung:
--     - Abrufbar 24 h (expires_at); danach liefert ai_search_result_fetch
--       nichts mehr.
--     - Tatsächlich gelöscht wird erst durch ai_search_result_cleanup
--       (Löschablauf, NICHT eingeplant) – bis dahin bleiben abgelaufene
--       Ergebnisse gespeichert, nur nicht mehr abrufbar.
--     - Kontolöschung: user_id verweist mit ON DELETE CASCADE auf
--       auth.users; api/delete-account.js löscht das Anmeldekonto und damit
--       sofort alle gespeicherten Ergebnisse. Zusätzlich
--       ai_search_result_purge_user für Lösch-/Auskunftsbegehren.
--
--  C) Missbrauchs-/Parallelitätsbremse atomar in ai_search_quota_reserve,
--     VORLÄUFIGE TESTEINSTELLUNGEN (= src/lib/aiSearch/abuseGuard.js):
--       - 1 laufender Auftrag je Konto (reserviert, < 120 s) → 'too_many_parallel'
--       - 3 neue Aufträge je 60 s                            → 'rate_limited'
--       - 5 Fehlversuche (released) je 60 min                → 'cooldown'
--     Wiederabrufe/Wiederholungen derselben Kennung werden VOR der Bremse
--     erkannt ('already_*'), legen keine Zeile an und zählen daher nie als
--     neue Anfrage.
--
-- Bestehende Daten bleiben unverändert.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ergebnisspeicher
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_search_results (
  request_id  UUID PRIMARY KEY REFERENCES public.ai_search_usage(request_id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_hash  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS ai_search_results_expires_idx ON public.ai_search_results (expires_at);
CREATE INDEX IF NOT EXISTS ai_search_results_user_idx ON public.ai_search_results (user_id);
CREATE INDEX IF NOT EXISTS ai_search_usage_user_created_idx ON public.ai_search_usage (user_id, created_at);

ALTER TABLE public.ai_search_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_search_results FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- A) Abschluss + Speicherung atomar
-- ---------------------------------------------------------------------
-- Rückgabe:
--   'completed'        - gezählt UND gespeichert (nur dann Ergebnis ausliefern)
--   'rejected_expired' - Reservierung abgelaufen und Limit belegt: nicht
--                        gezählt, nicht gespeichert, nicht ausliefern
--   'not_reserved'     - unbekannt oder bereits abgeschlossen/freigegeben
--                        (z. B. zweiter gleichzeitiger Abschlussversuch)
--   'request_mismatch' - Kennung gehört anderem Konto/Inhalt
-- Ungültige/zu grosse Nutzlast oder Speicherfehler: AUSNAHME → alles zurück.
CREATE OR REPLACE FUNCTION public.ai_search_quota_finalize_and_store(
  p_request_id UUID,
  p_user_id UUID,
  p_query_hash TEXT,
  p_payload JSONB,
  p_limit INTEGER DEFAULT 10
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ai_search_usage%ROWTYPE;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'ai_search_result_invalid' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_payload::text) > 512000 THEN
    RAISE EXCEPTION 'ai_search_result_too_large' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF NOT FOUND THEN
    RETURN 'not_reserved';
  END IF;
  IF v_row.user_id IS DISTINCT FROM p_user_id OR v_row.query_hash IS DISTINCT FROM p_query_hash THEN
    RETURN 'request_mismatch';
  END IF;

  -- Gleicher Lock wie reserve()/finalize(); danach Zeile sperren und neu lesen.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text || v_row.month_key, 0));
  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id FOR UPDATE;
  IF v_row.state <> 'reserved' THEN
    RETURN 'not_reserved';
  END IF;

  IF v_row.reserved_until <= now()
     AND ai_search_quota_used(v_row.user_id, v_row.month_key) >= p_limit THEN
    UPDATE ai_search_usage SET state = 'released', finalized_at = now()
    WHERE request_id = p_request_id;
    RETURN 'rejected_expired';
  END IF;

  UPDATE ai_search_usage SET state = 'completed', finalized_at = now()
  WHERE request_id = p_request_id;
  -- Schlägt dies fehl, wird auch das UPDATE oben zurückgerollt.
  INSERT INTO ai_search_results (request_id, user_id, query_hash, payload)
  VALUES (p_request_id, p_user_id, p_query_hash, p_payload);
  RETURN 'completed';
END;
$$;

-- Abruf nur für dasselbe Konto, denselben Inhalt, 'completed', nicht abgelaufen.
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

-- ---------------------------------------------------------------------
-- B) Löschablauf (NICHT eingeplant) und Löschung je Konto
-- ---------------------------------------------------------------------
-- Löscht abgelaufene Ergebnisse in Portionen; Rückgabe = Anzahl gelöscht.
CREATE OR REPLACE FUNCTION public.ai_search_result_cleanup(p_batch INTEGER DEFAULT 5000)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH doomed AS (
    SELECT request_id FROM ai_search_results
    WHERE expires_at <= now()
    ORDER BY expires_at
    LIMIT GREATEST(p_batch, 1)
  ), removed AS (
    DELETE FROM ai_search_results r USING doomed d
    WHERE r.request_id = d.request_id
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM removed;
$$;

-- Sofortige Löschung aller gespeicherten Ergebnisse eines Kontos.
CREATE OR REPLACE FUNCTION public.ai_search_result_purge_user(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH removed AS (
    DELETE FROM ai_search_results WHERE user_id = p_user_id RETURNING 1
  )
  SELECT count(*)::INTEGER FROM removed;
$$;

-- ---------------------------------------------------------------------
-- C) Reservierung mit atomarer Bremse (gleiche Signatur wie bisher)
-- ---------------------------------------------------------------------
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

  -- Idempotenz/Wiederabruf zuerst: dieselbe Kennung wird nie gebremst und
  -- legt keine Zeile an (zählt nicht als neue Anfrage).
  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_row.user_id IS DISTINCT FROM p_user_id
       OR v_row.query_hash IS DISTINCT FROM p_query_hash THEN
      RETURN 'request_mismatch';
    END IF;
    RETURN 'already_' || v_row.state;
  END IF;

  -- Vorläufige Testeinstellungen (= abuseGuard.js GUARD_LIMITS).
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

REVOKE EXECUTE ON FUNCTION public.ai_search_quota_finalize_and_store(UUID, UUID, TEXT, JSONB, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_result_fetch(UUID, UUID, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_result_cleanup(INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_result_purge_user(UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_search_quota_reserve(UUID, UUID, TEXT, INTEGER) FROM anon, authenticated, PUBLIC;
