-- Lead-Turnaround: consent-konforme Marketing-Attribution und Anbieterreaktion.
--
-- Die Tabelle bleibt ausschließlich serverseitig beschreibbar. Bestehende
-- Provider dürfen weiterhin nur die eigenen Metadaten lesen; an den RLS-
-- Policies und Grants wird deshalb bewusst nichts erweitert.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS lead_intent TEXT,
  ADD COLUMN IF NOT EXISTS course_topic_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS course_region_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS expected_response_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requester_confirmation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attribution_source TEXT,
  ADD COLUMN IF NOT EXISTS attribution_medium TEXT,
  ADD COLUMN IF NOT EXISTS attribution_campaign TEXT,
  ADD COLUMN IF NOT EXISTS attribution_term TEXT,
  ADD COLUMN IF NOT EXISTS attribution_content TEXT,
  ADD COLUMN IF NOT EXISTS attribution_landing_page TEXT,
  ADD COLUMN IF NOT EXISTS attribution_referrer TEXT,
  ADD COLUMN IF NOT EXISTS attribution_device TEXT,
  ADD COLUMN IF NOT EXISTS attribution_gclid TEXT,
  ADD COLUMN IF NOT EXISTS attribution_gbraid TEXT,
  ADD COLUMN IF NOT EXISTS attribution_wbraid TEXT;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_lead_intent_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_lead_intent_check
  CHECK (lead_intent IS NULL OR lead_intent IN (
    'availability', 'price_details', 'advice'
  ));

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_response_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_response_status_check
  CHECK (response_status IN (
    'pending', 'acknowledged', 'qualified', 'not_qualified', 'contacted'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_id
  ON public.leads (event_id);
CREATE INDEX IF NOT EXISTS idx_leads_provider_response_due
  ON public.leads (provider_id, response_status, expected_response_by)
  WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_leads_attribution_campaign_created
  ON public.leads (attribution_campaign, created_at DESC)
  WHERE attribution_campaign IS NOT NULL;

COMMENT ON COLUMN public.leads.event_id IS
  'Stabile Conversion-ID zur Deduplizierung zwischen Browser, Backend und Werbeplattformen.';
COMMENT ON COLUMN public.leads.expected_response_by IS
  'Kommunizierte Frist, bis wann der Anbieter auf die Anfrage reagieren soll.';
COMMENT ON COLUMN public.leads.response_status IS
  'Vom Anbieter oder KursNavi bestätigter Bearbeitungsstand der Anfrage.';
COMMENT ON COLUMN public.leads.attribution_term IS
  'Technischer Kampagnenparameter; darf keine frei eingegebenen Suchtexte oder andere PII enthalten.';
