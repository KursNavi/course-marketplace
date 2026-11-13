-- KI-Suche Phase 1: Monatskontingent und atomare Reservierung (Nachtrag 07).
--
-- WICHTIG: Vorbereitet, NICHT angewendet. Anwendung zuerst auf dem
-- verifizierten Supabase-TESTprojekt (Freigabe E5), nie direkt in Produktion.
--
-- Verbindliche Nutzerentscheidung (07-nachtrag-ki-zugang-kontingent.md):
--  * KI-Suche nur mit echtem eingeloggtem Konto (anonyme Supabase-Sitzungen
--    abweisen — das prüft die Such-API am verifizierten JWT; diese Tabelle
--    erhaelt nur bereits verifizierte Nutzer-IDs).
--  * Hoechstens 10 KI-Suchen je Nutzer und Kalendermonat (Europe/Zurich),
--    auch bei parallelen Tabs/Geraeten. Kein hoeheres Kontingent fuer Pakete.
--  * Verbrauch + aktive Reservierungen duerfen 10 nie ueberschreiten;
--    atomar, kein Count-then-insert ohne Sperre.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_search_usage (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID NOT NULL,
  -- Kalendermonat in Europe/Zurich, z. B. '2026-11'. Wird serverseitig
  -- berechnet (Funktion unten), nie vom Client uebergeben.
  month_key       TEXT NOT NULL,
  -- Idempotenz: eine request_id pro bewusstem Suchvorgang. Double-click/
  -- Retry/Reload mit derselben ID erzeugt keine zweite Zeile.
  request_id      UUID NOT NULL UNIQUE,
  state           TEXT NOT NULL DEFAULT 'reserved'
                  CHECK (state IN ('reserved','completed','released')),
  -- Befristete Reservierung fuer Crash-Recovery: abgelaufene 'reserved'
  -- werden vom Reconciliation-Cron auf 'released' gesetzt.
  reserved_until  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_search_usage_user_month_idx
  ON ai_search_usage (user_id, month_key, state);

ALTER TABLE ai_search_usage ENABLE ROW LEVEL SECURITY;
-- Nur serverseitig (service_role); die Restanzeige liefert die Such-API.
REVOKE ALL ON ai_search_usage FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Monatsschluessel in Europe/Zurich (Sommer-/Winterzeit korrekt)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_search_month_key(p_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(p_at AT TIME ZONE 'Europe/Zurich', 'YYYY-MM');
$$;

-- ---------------------------------------------------------------------------
-- Atomare Reservierung: Verbrauch + aktive Reservierungen <= Limit
-- ---------------------------------------------------------------------------
-- Rueckgabe:
--   'reserved'        - neue Reservierung angelegt
--   'already_<state>' - request_id existiert bereits (idempotenter Retry)
--   'limit_reached'   - Kontingent erschoepft, nichts verbraucht
CREATE OR REPLACE FUNCTION ai_search_quota_reserve(
  p_user_id UUID,
  p_request_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month TEXT := ai_search_month_key();
  v_existing TEXT;
  v_used INTEGER;
BEGIN
  -- Idempotenter Retry: dieselbe request_id belastet nie doppelt.
  SELECT state INTO v_existing FROM ai_search_usage WHERE request_id = p_request_id;
  IF v_existing IS NOT NULL THEN
    RETURN 'already_' || v_existing;
  END IF;

  -- Pro Nutzer+Monat serialisiert: parallele Tabs/Geraete koennen das Limit
  -- nicht ueberschreiten (Advisory-Lock statt racigem Count-then-insert).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_month, 0));

  SELECT count(*) INTO v_used
  FROM ai_search_usage
  WHERE user_id = p_user_id
    AND month_key = v_month
    AND (state = 'completed'
         OR (state = 'reserved' AND reserved_until > now()));

  IF v_used >= p_limit THEN
    RETURN 'limit_reached';
  END IF;

  INSERT INTO ai_search_usage (user_id, month_key, request_id)
  VALUES (p_user_id, v_month, p_request_id);

  RETURN 'reserved';
END;
$$;

-- Erfolg finalisieren: zaehlt endgueltig (auch korrekter Nulltreffer zaehlt).
CREATE OR REPLACE FUNCTION ai_search_quota_finalize(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_search_usage
  SET state = 'completed', finalized_at = now()
  WHERE request_id = p_request_id AND state = 'reserved'
  RETURNING TRUE;
$$;

-- Echten System-/Providerfehler freigeben: belastet das Kontingent nicht.
-- (Validierungs-/Login-/Limitablehnung reserviert gar nicht erst.)
CREATE OR REPLACE FUNCTION ai_search_quota_release(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_search_usage
  SET state = 'released', finalized_at = now()
  WHERE request_id = p_request_id AND state = 'reserved'
  RETURNING TRUE;
$$;

-- Restkontingent fuer die Anzeige ("Noch 7 von 10 diesen Monat").
CREATE OR REPLACE FUNCTION ai_search_quota_remaining(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(p_limit - count(*), 0)::INTEGER
  FROM ai_search_usage
  WHERE user_id = p_user_id
    AND month_key = ai_search_month_key()
    AND (state = 'completed'
         OR (state = 'reserved' AND reserved_until > now()));
$$;

-- Crash-Recovery: verwaiste Reservierungen freigeben (Reconciliation-Cron).
CREATE OR REPLACE FUNCTION ai_search_quota_cleanup()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH expired AS (
    UPDATE ai_search_usage
    SET state = 'released', finalized_at = now()
    WHERE state = 'reserved' AND reserved_until <= now()
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM expired;
$$;

-- Nur die Serverrolle darf diese Funktionen aufrufen.
REVOKE EXECUTE ON FUNCTION ai_search_quota_reserve(UUID, UUID, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_finalize(UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_release(UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_remaining(UUID, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_cleanup() FROM anon, authenticated, PUBLIC;

COMMIT;
