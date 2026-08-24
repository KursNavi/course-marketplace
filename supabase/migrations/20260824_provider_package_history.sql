-- ============================================================================
-- Lead-Analyse Phase 1 — Schritt 3/5: Paketverlauf der Anbieter
-- ============================================================================
-- profiles.package_tier + package_expires_at kennen nur den Ist-Zustand. Für
-- die Basic-Ranking-Penalty wird aber die aktuelle Basic-PHASE gebraucht, und
-- fürs Admin-Panel der vollständige Verlauf.
--
-- Das Paket wird an mindestens vier Stellen geändert:
--   api/admin.js (set-tier), api/confirm-package-checkout.js, api/webhook.js
--   und api/cron.js (Ablauf/Downgrade und Aktivierung vorgebuchter Pakete).
-- Eine Historisierung im Anwendungscode müsste an jeder dieser Stellen gepflegt
-- werden und wäre bei der nächsten neuen Stelle wieder lückenhaft. Deshalb ein
-- Trigger auf profiles: Er greift unabhängig davon, wer die Änderung auslöst.
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_package_history (
  id BIGSERIAL PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_tier TEXT NOT NULL CHECK (package_tier IN ('basic', 'pro', 'premium', 'enterprise')),
  started_at TIMESTAMPTZ NOT NULL,
  -- NULL = laufende Periode.
  ended_at TIMESTAMPTZ,

  -- true bei Zeilen aus dem Backfill: Der echte Beginn ist nicht bekannt und
  -- wird bewusst nicht erfunden. Das Admin-Panel weist solche Startpunkte als
  -- "bekannt seit" aus.
  start_is_estimated BOOLEAN NOT NULL DEFAULT false,

  -- Technische Herkunft, soweit zuverlässig feststellbar: 'db_trigger' für
  -- laufende Änderungen, 'backfill' für die Initialbefüllung.
  -- Eine fachliche Quelle (Stripe / Admin / Cron) ist im Trigger NICHT
  -- zuverlässig ermittelbar — alle Pfade schreiben mit derselben service_role,
  -- und supabase-js kann pro Statement kein set_config setzen. Ein geratener
  -- Wert wäre schlechter als gar keiner, deshalb bleibt es bei der technischen
  -- Quelle.
  change_source TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Verhindert überlappende offene Perioden: pro Anbieter höchstens eine Zeile
-- ohne ended_at. Das ist die Datenbank-Garantie hinter "aktuelle Paketphase".
CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_package_open_period
  ON provider_package_history (provider_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_provider_package_history_provider
  ON provider_package_history (provider_id, started_at DESC);

ALTER TABLE provider_package_history ENABLE ROW LEVEL SECURITY;

-- Anbieter dürfen ihren eigenen Verlauf sehen; schreiben darf nur der Trigger
-- (SECURITY DEFINER) bzw. die service_role.
CREATE POLICY "providers_read_own_package_history"
  ON provider_package_history FOR SELECT
  TO authenticated
  USING (provider_id = auth.uid());

REVOKE ALL ON provider_package_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON provider_package_history FROM authenticated;

-- ----------------------------------------------------------------------------
-- Beginn des aktuellen Pakets direkt am Profil
-- ----------------------------------------------------------------------------
-- Redundant zur offenen Historienzeile, aber die Anbieterübersicht im Admin-
-- Panel und die Penalty-Berechnung brauchen den Wert für tausende Profile in
-- einer Abfrage. Der Trigger hält ihn konsistent.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS package_started_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.package_started_at IS
  'Beginn des aktuell laufenden Pakets. Wird vom Trigger track_package_tier_change() gepflegt und entspricht der offenen Zeile in provider_package_history.';

-- ============================================================================
-- Trigger: jede tatsächliche Paketänderung historisieren
-- ============================================================================
-- Bewusst zwei Trigger:
--
--   BEFORE: setzt profiles.package_started_at im selben Schreibvorgang. Ein
--           nachgelagertes UPDATE auf profiles würde den Trigger erneut
--           auslösen und wäre eine zusätzliche Schreiboperation.
--   AFTER:  schreibt die Historienzeile. Beim INSERT existiert die Profilzeile
--           in einem BEFORE-Trigger noch nicht — der Fremdschlüssel von
--           provider_package_history.provider_id auf profiles.id wäre dann
--           nicht sicher erfüllbar.

CREATE OR REPLACE FUNCTION set_package_started_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(OLD.package_tier, 'basic')) = lower(coalesce(NEW.package_tier, 'basic')) THEN
    -- Kein echter Wechsel (z.B. nur package_reminder_sent aktualisiert).
    RETURN NEW;
  END IF;

  NEW.package_started_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION track_package_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new TEXT;
  v_started TIMESTAMPTZ;
BEGIN
  v_new := lower(coalesce(NEW.package_tier, 'basic'));

  -- Unbekannte Werte nicht historisieren: Der CHECK auf der Historientabelle
  -- würde sonst das Profil-Update mit abbrechen.
  IF v_new NOT IN ('basic', 'pro', 'premium', 'enterprise') THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Nur echte Wechsel eröffnen eine neue Periode.
    IF lower(coalesce(OLD.package_tier, 'basic')) = v_new THEN
      RETURN NULL;
    END IF;
  END IF;

  v_started := coalesce(NEW.package_started_at, now());

  -- Erst die laufende Periode schliessen, dann die neue eröffnen. Der
  -- Unique-Index auf offenen Perioden erzwingt diese Reihenfolge.
  UPDATE provider_package_history
  SET ended_at = v_started
  WHERE provider_id = NEW.id AND ended_at IS NULL;

  INSERT INTO provider_package_history (provider_id, package_tier, started_at, start_is_estimated, change_source)
  VALUES (NEW.id, v_new, v_started, false, 'db_trigger');

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_package_started_at ON profiles;
CREATE TRIGGER trg_set_package_started_at
  BEFORE INSERT OR UPDATE OF package_tier ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_package_started_at();

DROP TRIGGER IF EXISTS trg_track_package_tier_change ON profiles;
CREATE TRIGGER trg_track_package_tier_change
  AFTER INSERT OR UPDATE OF package_tier ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION track_package_tier_change();

COMMENT ON FUNCTION track_package_tier_change() IS
  'Schliesst die offene Paketperiode und eröffnet eine neue, sobald sich profiles.package_tier tatsächlich ändert. Greift für alle Änderungspfade (Stripe, Webhook, Cron-Ablauf, Admin).';

-- ============================================================================
-- Backfill: Startpunkt für bestehende Anbieter
-- ============================================================================
-- Vergangene Paketwechsel sind nirgends protokolliert und werden NICHT erfunden.
-- Jeder bestehende Anbieter bekommt genau eine offene Zeile mit seinem heutigen
-- Paket. Als Beginn dient profiles.created_at — der früheste Zeitpunkt, zu dem
-- das Paket überhaupt bestanden haben kann. start_is_estimated = true macht das
-- im Admin-Panel sichtbar ("bekannt seit").
--
-- Für die Ranking-Penalty ist dieser geschätzte Startpunkt unkritisch: Sie
-- zählt ausschliesslich Leads mit provider_tier_at_lead = 'basic', und dieses
-- Feld existiert erst ab dieser Migration. Alle Altleads tragen NULL und können
-- deshalb nicht fälschlich einer Basic-Phase zugeschlagen werden.

INSERT INTO provider_package_history (provider_id, package_tier, started_at, start_is_estimated, change_source)
SELECT
  p.id,
  lower(coalesce(p.package_tier, 'basic')),
  coalesce(p.created_at, now()),
  true,
  'backfill'
FROM profiles p
WHERE lower(coalesce(p.package_tier, 'basic')) IN ('basic', 'pro', 'premium', 'enterprise')
  AND NOT EXISTS (
    SELECT 1 FROM provider_package_history h
    WHERE h.provider_id = p.id AND h.ended_at IS NULL
  );

UPDATE profiles p
SET package_started_at = h.started_at
FROM provider_package_history h
WHERE h.provider_id = p.id
  AND h.ended_at IS NULL
  AND p.package_started_at IS NULL;
