-- KI-Suche Phase 1: Monatskontingent und atomare Reservierung (Nachtrag 07).
--
-- WICHTIG: Vorbereitet, NICHT angewendet. Anwendung zuerst auf dem
-- verifizierten Supabase-TESTprojekt (Freigabe E5), nie direkt in Produktion.
--
-- Verbindliche Nutzerentscheidung (07-nachtrag-ki-zugang-kontingent.md):
--  * KI-Suche nur mit echtem eingeloggtem Konto (anonyme Supabase-Sitzungen
--    abweisen — das prueft die Such-API am verifizierten JWT; diese Tabelle
--    erhaelt nur bereits verifizierte Nutzer-IDs).
--  * Hoechstens 10 KI-Suchen je Nutzer und Kalendermonat (Europe/Zurich),
--    auch bei parallelen Tabs/Geraeten. Kein hoeheres Kontingent fuer Pakete.
--  * Verbrauch + aktive Reservierungen duerfen 10 nie ueberschreiten —
--    auch nicht durch einen spaeten Abschluss einer abgelaufenen
--    Reservierung, deren Platz bereits neu vergeben wurde.
--
-- Konsistenzmodell Reservierung/Ablauf/Abschluss:
--  * 'reserved' zaehlt nur bis reserved_until gegen das Limit; danach gilt
--    der Platz als frei und kann neu vergeben werden.
--  * finalize einer NICHT abgelaufenen Reservierung zaehlt endgueltig.
--  * finalize einer ABGELAUFENEN (noch nicht bereinigten) Reservierung
--    prueft unter demselben Nutzer-Monats-Lock erneut: Ist noch Platz,
--    wird sie regulaer abgeschlossen; ist das Limit inzwischen durch einen
--    Ersatzplatz belegt, wird sie 'released' (Ergebnis darf ausgeliefert
--    werden, belastet das Kontingent aber nicht doppelt und ueberschreitet
--    nie die 10).

BEGIN;

CREATE TABLE IF NOT EXISTS ai_search_usage (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID NOT NULL,
  -- Kalendermonat in Europe/Zurich, z. B. '2026-11'. Wird serverseitig
  -- berechnet (Funktion unten), nie vom Client uebergeben.
  month_key       TEXT NOT NULL,
  -- Idempotenz: eine request_id pro bewusstem Suchvorgang. Double-click/
  -- Retry/Reload mit derselben ID erzeugt keine zweite Zeile. Die ID ist
  -- an Nutzer UND Suchinhalt (query_hash) gebunden und darf nicht fuer
  -- veraenderte Inhalte oder fremde Nutzer wiederverwendet werden.
  request_id      UUID NOT NULL UNIQUE,
  query_hash      TEXT NOT NULL,
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

-- Zaehlung unter bereits gehaltenem Lock: completed + nicht abgelaufene reserved.
CREATE OR REPLACE FUNCTION ai_search_quota_used(p_user_id UUID, p_month TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM ai_search_usage
  WHERE user_id = p_user_id
    AND month_key = p_month
    AND (state = 'completed'
         OR (state = 'reserved' AND reserved_until > now()));
$$;

-- ---------------------------------------------------------------------------
-- Atomare Reservierung: Verbrauch + aktive Reservierungen <= Limit
-- ---------------------------------------------------------------------------
-- Rueckgabe:
--   'reserved'         - neue Reservierung angelegt
--   'already_<state>'  - request_id existiert fuer DENSELBEN Nutzer und
--                        DENSELBEN Suchinhalt (idempotenter Retry)
--   'request_mismatch' - request_id existiert, gehoert aber einem anderen
--                        Nutzer oder traegt anderen Suchinhalt: abgelehnt,
--                        keine Belastung, keine fremden Details.
--   'limit_reached'    - Kontingent erschoepft, nichts verbraucht
CREATE OR REPLACE FUNCTION ai_search_quota_reserve(
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
  -- Pro Nutzer+Monat serialisiert (Advisory-Lock): parallele Tabs/Geraete
  -- und gleichzeitige identische Wiederholungen laufen nacheinander.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_month, 0));

  -- Idempotenz NACH dem Sperren pruefen: gleichzeitige identische Anfragen
  -- sehen so zuverlaessig denselben Vorgang statt in die Unique-Verletzung
  -- zu laufen.
  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_row.user_id IS DISTINCT FROM p_user_id
       OR v_row.query_hash IS DISTINCT FROM p_query_hash THEN
      RETURN 'request_mismatch';
    END IF;
    RETURN 'already_' || v_row.state;
  END IF;

  IF ai_search_quota_used(p_user_id, v_month) >= p_limit THEN
    RETURN 'limit_reached';
  END IF;

  BEGIN
    INSERT INTO ai_search_usage (user_id, month_key, request_id, query_hash)
    VALUES (p_user_id, v_month, p_request_id, p_query_hash);
  EXCEPTION WHEN unique_violation THEN
    -- Defensive Doppelabsicherung (sollte unter dem Lock nicht eintreten):
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

-- ---------------------------------------------------------------------------
-- Abschluss: zaehlt endgueltig (auch korrekter Nulltreffer zaehlt).
-- ---------------------------------------------------------------------------
-- Rueckgabe:
--   'completed'        - regulaer abgeschlossen und gezaehlt
--   'released_expired' - Reservierung war abgelaufen und das Limit ist
--                        inzwischen belegt: NICHT gezaehlt (Limit haelt),
--                        Ergebnis darf trotzdem ausgeliefert werden.
--   'not_reserved'     - unbekannte oder bereits finalisierte request_id
CREATE OR REPLACE FUNCTION ai_search_quota_finalize(
  p_request_id UUID,
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
  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF NOT FOUND OR v_row.state <> 'reserved' THEN
    RETURN 'not_reserved';
  END IF;

  -- Unter demselben Nutzer-Monats-Lock wie reserve(): konsistentes Zusammenspiel
  -- von Ablauf, Ersatzvergabe und spaetem Abschluss.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text || v_row.month_key, 0));
  -- Zustand nach dem Sperren erneut lesen (Cleanup koennte dazwischen laufen).
  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF v_row.state <> 'reserved' THEN
    RETURN 'not_reserved';
  END IF;

  IF v_row.reserved_until <= now()
     AND ai_search_quota_used(v_row.user_id, v_row.month_key) >= p_limit THEN
    -- Platz wurde nach Ablauf bereits neu vergeben: nie ueber das Limit.
    UPDATE ai_search_usage
    SET state = 'released', finalized_at = now()
    WHERE request_id = p_request_id;
    RETURN 'released_expired';
  END IF;

  UPDATE ai_search_usage
  SET state = 'completed', finalized_at = now()
  WHERE request_id = p_request_id;
  RETURN 'completed';
END;
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
  SELECT GREATEST(p_limit - ai_search_quota_used(p_user_id, ai_search_month_key()), 0)::INTEGER;
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
REVOKE EXECUTE ON FUNCTION ai_search_quota_used(UUID, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_reserve(UUID, UUID, TEXT, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_finalize(UUID, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_release(UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_remaining(UUID, INTEGER) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_quota_cleanup() FROM anon, authenticated, PUBLIC;

COMMIT;
