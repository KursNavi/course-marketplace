-- Lead-Analyse Phase 1 — E-Mail-Versand und Zustellung getrennt verfolgen
--
-- leads.status bleibt der fachliche Versand-Auditstatus (sent/failed).
-- Diese zusätzlichen Spalten bilden die Antwort des Versanddienstes und die
-- späteren Resend-Zustellereignisse ab. Alte Leads bleiben bewusst unknown:
-- aus einem historischen Lead-Datensatz lässt sich keine Zustellung ableiten.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_delivery_status TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_provider_message_id TEXT;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_delivery_updated_at TIMESTAMPTZ;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_delivery_error_code TEXT;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_email_delivery_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_email_delivery_status_check
  CHECK (email_delivery_status IN (
    'unknown',
    'pending',
    'accepted',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'failed',
    'suppressed'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_provider_message_id
  ON leads (email_provider_message_id)
  WHERE email_provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_email_delivery_status
  ON leads (provider_id, email_delivery_status, created_at DESC);

COMMENT ON COLUMN leads.email_delivery_status IS
  'E-Mailzustellung: unknown (historisch/nicht nachverfolgbar), pending, accepted (Versanddienst angenommen), delivered, delivery_delayed, bounced, complained, failed oder suppressed.';
COMMENT ON COLUMN leads.email_provider_message_id IS
  'ID der E-Mail beim Versanddienst, ohne Nachrichtentext oder personenbezogenen Anfrageinhalt.';
COMMENT ON COLUMN leads.email_delivery_updated_at IS
  'Zeitpunkt des letzten bekannten E-Mail-Zustands.';
COMMENT ON COLUMN leads.email_delivery_error_code IS
  'Kurzer technischer Zustellfehlercode oder Resend-Ereignistyp, niemals Nachrichtentext.';

-- Die Admin-Leadliste erhält den Zustellstatus zusätzlich zum fachlichen
-- leads.status. Die bestehende Funktion muss wegen des RETURNS TABLE einmal
-- ersetzt werden.
DROP FUNCTION IF EXISTS admin_provider_leads(UUID, INTEGER, INTEGER);

CREATE FUNCTION admin_provider_leads(
  p_provider_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  course_id BIGINT,
  course_title TEXT,
  status TEXT,
  email_delivery_status TEXT,
  email_delivery_updated_at TIMESTAMPTZ,
  email_delivery_error_code TEXT,
  provider_tier_at_lead TEXT,
  quality_score SMALLINT,
  quality_status TEXT,
  quality_scored_at TIMESTAMPTZ,
  quality_score_version TEXT,
  quality_error_code TEXT,
  message_available BOOLEAN,
  message_expires_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.created_at,
    l.course_id,
    co.title,
    l.status::TEXT,
    l.email_delivery_status,
    l.email_delivery_updated_at,
    l.email_delivery_error_code,
    l.provider_tier_at_lead,
    l.quality_score,
    l.quality_status,
    l.quality_scored_at,
    l.quality_score_version,
    l.quality_error_code,
    (mp.lead_id IS NOT NULL AND mp.expires_at > now()) AS message_available,
    mp.expires_at,
    count(*) OVER () AS total_count
  FROM leads l
  LEFT JOIN courses co ON co.id = l.course_id
  LEFT JOIN lead_message_payloads mp ON mp.lead_id = l.id
  WHERE l.provider_id = p_provider_id
  ORDER BY l.created_at DESC, l.id
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION admin_provider_leads(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_provider_leads(UUID, INTEGER, INTEGER) TO service_role;
