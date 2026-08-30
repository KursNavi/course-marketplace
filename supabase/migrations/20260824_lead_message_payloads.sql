-- ============================================================================
-- Lead-Analyse Phase 1 — Schritt 2/5: Anfragetext, verschlüsselt, 60 Tage
-- ============================================================================
-- Der Anfragetext wird bewusst NICHT in leads gespeichert:
--   * leads ist der langfristige statistische Datensatz und für Anbieter über
--     RLS lesbar ("providers_read_own_leads").
--   * Der Text ist personenbezogener Freitext mit kurzer Aufbewahrungsfrist.
--
-- Deshalb eine eigene Tabelle ohne jede RLS-Policy: Damit kommen weder anon
-- noch authenticated an die Zeilen; ausschliesslich die service_role (Backend)
-- kann lesen und schreiben. Die Entschlüsselung passiert nie in der Datenbank,
-- sondern serverseitig in api/_lib/lead-message-crypto.js — der Schlüssel liegt
-- ausschliesslich in LEAD_MESSAGE_ENCRYPTION_KEY und nie in der DB.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_message_payloads (
  -- 1:1 zum Lead. ON DELETE CASCADE: Wird ein Anbieterkonto endgültig gelöscht,
  -- entfernt delete_provider_account() das Profil, darüber kaskadieren die
  -- leads und darüber diese Texte.
  lead_id UUID PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,

  -- AES-256-GCM, kompakt als "v1.<iv>.<authTag>.<ciphertext>" (base64url).
  -- Format und Schlüsselerzeugung: docs/lead-analytics.md
  ciphertext TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Harte Löschfrist. Wird beim Insert vom Backend gesetzt; der Default ist die
  -- Absicherung, falls ein Aufrufer die Spalte vergisst.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 days')
);

-- Räumabfrage des Retention-Laufs.
CREATE INDEX IF NOT EXISTS idx_lead_message_payloads_expires
  ON lead_message_payloads (expires_at);

-- RLS an, aber bewusst OHNE Policies: kein Zugriff für anon/authenticated.
ALTER TABLE lead_message_payloads ENABLE ROW LEVEL SECURITY;

-- Zusätzlich die Tabellenrechte entziehen (Gürtel und Hosenträger): Selbst
-- wenn später versehentlich eine permissive Policy entsteht, fehlt das GRANT.
REVOKE ALL ON lead_message_payloads FROM anon, authenticated;

COMMENT ON TABLE lead_message_payloads IS
  'Verschlüsselter Anfragetext eines Leads, max. 60 Tage. Kein Zugriff für anon/authenticated — nur service_role. Entschlüsselung ausschliesslich serverseitig.';

-- ============================================================================
-- Retention: nur Text und E-Mail-Hash, niemals der Lead
-- ============================================================================
-- Ersetzt die Wirkung des alten cleanup_old_leads(). Drei Schritte:
--   1. Abgelaufene Nachrichtentexte löschen.
--   2. Leads, deren Text abgelaufen ist, bevor die KI sie bewerten konnte, auf
--      'expired_unscored' setzen. Sonst bleiben sie ewig im Arbeitsvorrat des
--      Batches, obwohl die Grundlage für eine Bewertung fehlt.
--   3. requester_email_hash nach 60 Tagen leeren (Datensparsamkeit). Das
--      Rate-Limiting schaut nur 5 Minuten zurück und bleibt unberührt.
-- Der Lead-Datensatz und sein quality_score bleiben in allen drei Schritten
-- vollständig erhalten.

CREATE OR REPLACE FUNCTION cleanup_expired_lead_messages()
RETURNS TABLE (
  deleted_messages INTEGER,
  expired_unscored INTEGER,
  cleared_email_hashes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_expired INTEGER := 0;
  v_cleared INTEGER := 0;
BEGIN
  WITH removed AS (
    DELETE FROM lead_message_payloads
    WHERE expires_at <= now()
    RETURNING lead_id
  )
  SELECT count(*) INTO v_deleted FROM removed;

  WITH marked AS (
    UPDATE leads l
    SET quality_status = 'expired_unscored'
    WHERE l.quality_status IN ('pending', 'failed')
      -- Karenzzeit: api/send-lead.js schreibt Lead und Text in zwei Schritten.
      -- Ohne diese Bedingung könnte ein Lauf genau dazwischen einen frischen
      -- Lead fälschlich als unbewertbar markieren.
      AND l.created_at < now() - INTERVAL '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM lead_message_payloads p WHERE p.lead_id = l.id
      )
    RETURNING l.id
  )
  SELECT count(*) INTO v_expired FROM marked;

  WITH cleared AS (
    UPDATE leads
    SET requester_email_hash = NULL
    WHERE requester_email_hash IS NOT NULL
      AND created_at < now() - INTERVAL '60 days'
    RETURNING id
  )
  SELECT count(*) INTO v_cleared FROM cleared;

  RETURN QUERY SELECT v_deleted, v_expired, v_cleared;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_lead_messages() IS
  'Löscht abgelaufene Anfragetexte, markiert unbewertbar gewordene Leads als expired_unscored und leert alte E-Mail-Hashes. Löscht niemals Lead-Datensätze.';
