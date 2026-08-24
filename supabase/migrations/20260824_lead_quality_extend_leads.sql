-- ============================================================================
-- Lead-Analyse Phase 1 — Schritt 1/5: leads-Tabelle erweitern
-- ============================================================================
-- Ausgangslage (20260302_create_leads_audit_table.sql):
--   * course_id war NOT NULL mit ON DELETE CASCADE — beim Löschen eines Kurses
--     verschwand damit auch die Leadhistorie des Anbieters.
--   * cleanup_old_leads() löschte Leads nach 180 Tagen vollständig.
--   * Es gab kein Paket-Snapshot und keine Qualitätsbewertung.
--
-- Diese Migration macht den Lead-Datensatz zum langfristigen statistischen
-- Datensatz. Personenbezogene Anteile (Nachrichtentext, E-Mail-Hash) werden
-- getrennt davon nach 60 Tagen entfernt — siehe Schritt 2/5.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kurslöschung darf die Leadhistorie nicht mehr mitnehmen
-- ----------------------------------------------------------------------------
-- ON DELETE SET NULL statt CASCADE: Der Lead bleibt als Zeile erhalten, die
-- Kurszuordnung geht verloren. Genau das ist gewollt — die Leadzahlen des
-- Anbieters bleiben vollständig, der gelöschte Kurs wird nicht rekonstruiert.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_course_id_fkey;
ALTER TABLE leads ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE leads
  ADD CONSTRAINT leads_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 2. Paket-Snapshot zum Zeitpunkt des Leads
-- ----------------------------------------------------------------------------
-- Der Snapshot ist die einzige belastbare Quelle dafür, in welcher Paketphase
-- ein Lead eingegangen ist. Er wird beim Anlegen des Leads geschrieben.
--
-- Bewusst NULL-fähig und ohne Backfill: Für Leads, die vor dieser Migration
-- entstanden sind, ist das damalige Paket nicht bekannt. Ein geratener Wert
-- würde direkt in die Ranking-Penalty einfliessen. NULL bedeutet deshalb
-- "unbekannt" und zählt in der Penalty-Logik nie mit.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS provider_tier_at_lead TEXT;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_provider_tier_at_lead_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_provider_tier_at_lead_check
  CHECK (provider_tier_at_lead IS NULL
         OR provider_tier_at_lead IN ('basic', 'pro', 'premium', 'enterprise'));

-- ----------------------------------------------------------------------------
-- 3. KI-Qualitätsbewertung
-- ----------------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_score SMALLINT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_scored_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_score_version TEXT;

-- Zählt die Bewertungsversuche, damit ein dauerhaft fehlschlagender Lead den
-- monatlichen Batch nicht bei jedem Lauf erneut blockiert.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_attempts SMALLINT NOT NULL DEFAULT 0;

-- Nur ein kurzer, vom Server erzeugter Fehlercode (z.B. 'invalid_response').
-- Bewusst KEIN Modell-Rohtext und kein Ausschnitt der Anfrage: Diese Spalte
-- ist über die Admin-API sichtbar und darf keine Nutzerinhalte tragen.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_error_code TEXT;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_quality_score_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_quality_score_check
  CHECK (quality_score IS NULL OR (quality_score >= 1 AND quality_score <= 10));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_quality_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_quality_status_check
  CHECK (quality_status IN ('pending', 'scored', 'failed', 'expired_unscored'));

-- Ein bewerteter Lead muss auch einen Score tragen — und umgekehrt.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_quality_scored_consistency;
ALTER TABLE leads
  ADD CONSTRAINT leads_quality_scored_consistency
  CHECK ((quality_status = 'scored' AND quality_score IS NOT NULL)
         OR (quality_status <> 'scored' AND quality_score IS NULL));

-- ----------------------------------------------------------------------------
-- 4. Datensparsamkeit beim E-Mail-Hash
-- ----------------------------------------------------------------------------
-- Das Rate-Limiting in api/send-lead.js schaut exakt 5 Minuten zurück. Der Hash
-- muss also nur kurz vorgehalten werden. Er wird zusammen mit dem
-- Nachrichtentext nach 60 Tagen geleert (siehe Schritt 2/5) — deshalb muss die
-- Spalte NULL zulassen. Der Lead-Datensatz selbst bleibt erhalten.

ALTER TABLE leads ALTER COLUMN requester_email_hash DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. Indizes
-- ----------------------------------------------------------------------------
-- Anbieter + Zeitraum ist die Leitabfrage der gesamten Lead-Analyse.
CREATE INDEX IF NOT EXISTS idx_leads_provider_created
  ON leads (provider_id, created_at DESC);

-- Arbeitsvorrat des monatlichen Scoringlaufs.
CREATE INDEX IF NOT EXISTS idx_leads_quality_pending
  ON leads (created_at)
  WHERE quality_status = 'pending';

-- Zählgrundlage der Basic-Ranking-Penalty: nur versandte, qualifizierte Leads
-- aus einer Basic-Phase. Als Teilindex, weil das die grosse Mehrheit der Zeilen
-- ausschliesst.
CREATE INDEX IF NOT EXISTS idx_leads_qualified_basic
  ON leads (provider_id, created_at)
  WHERE status = 'sent' AND provider_tier_at_lead = 'basic' AND quality_score >= 5;

-- Rate-Limiting-Abfrage (E-Mail-Hash + Kurs + Zeitfenster).
CREATE INDEX IF NOT EXISTS idx_leads_ratelimit
  ON leads (requester_email_hash, course_id, created_at)
  WHERE requester_email_hash IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. Alten 180-Tage-Cleanup entfernen
-- ----------------------------------------------------------------------------
-- cleanup_old_leads() löschte die Lead-Datensätze selbst. Genau das darf nicht
-- mehr passieren, sonst verschwindet die Langzeitstatistik.
--
-- Die Funktion wird nicht ersatzlos entfernt, sondern durch eine bewusst
-- wirkungslose Fassung ersetzt. Grund: Falls die Migration vor dem Code-Deploy
-- eingespielt wird, ruft der noch laufende alte api/cron.js sie weiter auf.
-- Eine wirkungslose Funktion ist dann harmlos; ein DROP würde den Cron mit
-- einem Fehler abbrechen lassen, ein unverändertes DELETE würde Daten
-- vernichten. Der echte Cleanup steckt in cleanup_expired_lead_messages().

CREATE OR REPLACE FUNCTION cleanup_old_leads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Absichtlich ohne Wirkung. Siehe cleanup_expired_lead_messages().
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION cleanup_old_leads() IS
  'VERALTET und wirkungslos. Lead-Datensätze werden nicht mehr gelöscht; sie sind die Langzeitstatistik. Nachrichtentexte und E-Mail-Hashes räumt cleanup_expired_lead_messages() nach 60 Tagen ab. Nur als Kompatibilitätshülle für einen noch nicht aktualisierten Cron erhalten — nach dem Deploy von api/cron.js entfernbar.';

COMMENT ON COLUMN leads.provider_tier_at_lead IS
  'Paket des Anbieters zum Eingangszeitpunkt des Leads. NULL = unbekannt (Lead vor Einführung der Lead-Analyse). NULL zählt in der Basic-Ranking-Penalty nie mit.';
COMMENT ON COLUMN leads.quality_score IS
  'KI-Leadqualität 1-10. NULL solange nicht bewertet.';
COMMENT ON COLUMN leads.quality_status IS
  'pending = noch zu bewerten, scored = bewertet, failed = Bewertung fehlgeschlagen (manuell wiederholbar), expired_unscored = Nachrichtentext lief vor der Bewertung ab.';
COMMENT ON COLUMN leads.quality_error_code IS
  'Kurzer serverseitiger Fehlercode. Enthält niemals Modellantworten oder Ausschnitte der Anfrage.';
COMMENT ON COLUMN leads.requester_email_hash IS
  'Gesalzener Hash für das 5-Minuten-Rate-Limiting. Wird nach 60 Tagen geleert (NULL), der Lead-Datensatz bleibt erhalten.';
