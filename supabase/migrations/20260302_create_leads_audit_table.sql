-- Audit-Trail für Lead-Anfragen (booking_type='lead')
-- Speichert Meta-Daten für Nachweisbarkeit, keine Klartextnachricht.

-- Enum für Lead-Status
CREATE TYPE lead_status AS ENUM ('pending', 'sent', 'failed');

-- Leads-Tabelle
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_email_hash TEXT NOT NULL,
  status lead_status NOT NULL DEFAULT 'pending'
);

-- Indices für typische Abfragen
CREATE INDEX idx_leads_course_id ON leads(course_id);
CREATE INDEX idx_leads_provider_id ON leads(provider_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- RLS aktivieren
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policy: Service-Role kann alles (API-Backend)
-- (service_role umgeht RLS automatisch, kein expliziter Policy nötig)

-- Policy: Provider sieht nur eigene Leads (Aggregat/Meta)
CREATE POLICY "providers_read_own_leads"
  ON leads FOR SELECT
  TO authenticated
  USING (provider_id = auth.uid());

-- Policy: Kein direkter Insert/Update/Delete durch authentifizierte User
-- Nur das Backend (service_role) darf schreiben.

-- Retention: Funktion zum Löschen alter Leads (>180 Tage)
CREATE OR REPLACE FUNCTION cleanup_old_leads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM leads
  WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
