-- Spam-Schutz fuer das Anfrageformular: gesalzener Hash der Absender-IP.
--
-- Das bisherige Limit griff nur pro E-Mail-Adresse und Kurs. Mit wechselnder
-- Absenderadresse liess sich ein Anbieter unbegrenzt mit Fake-Anfragen
-- zuspammen. Die zweite Stufe begrenzt Anfragen pro Absender-IP und Stunde.
--
-- Gespeichert wird ausschliesslich der mit LEAD_HASH_SALT gesalzene SHA-256-
-- Hash, nie die rohe IP — dasselbe Verfahren wie bei requester_email_hash.
--
-- Die Tabelle bleibt ausschliesslich serverseitig beschreibbar; an den
-- RLS-Policies und Grants wird bewusst nichts geaendert.
--
-- Hinweis: api/send-lead.js funktioniert auch OHNE diese Migration. Die
-- IP-Stufe wird dann uebersprungen und protokolliert eine Warnung; die
-- E-Mail-Stufe bleibt aktiv. Nach dem Einspielen greift die IP-Stufe
-- automatisch, ohne weiteren Deploy.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS requester_ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_ip_hash_created
  ON public.leads (requester_ip_hash, created_at DESC)
  WHERE requester_ip_hash IS NOT NULL;

COMMENT ON COLUMN public.leads.requester_ip_hash IS
  'Gesalzener SHA-256-Hash der Absender-IP. Dient allein der Missbrauchsbegrenzung; die rohe IP wird nie gespeichert.';
