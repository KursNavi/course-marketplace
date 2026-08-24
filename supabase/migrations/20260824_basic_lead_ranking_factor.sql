-- ============================================================================
-- Lead-Analyse Phase 1 — Schritt 4/5: Basic-Ranking-Penalty
-- ============================================================================
-- Basic-Anbieter, die über die kostenlose Sichtbarkeit bereits genügend
-- qualifizierte Anfragen erhalten haben, werden im Ranking abgestuft.
--
-- Gezählt wird ausschliesslich:
--   * status = 'sent'                     (die Anfrage hat den Anbieter erreicht)
--   * quality_score >= 5                  (echte, bearbeitbare Anfrage)
--   * provider_tier_at_lead = 'basic'     (Snapshot: Lead kam in einer Basic-Phase an)
--   * created_at >= Beginn der AKTUELLEN Basic-Phase
--
-- Der Faktor liegt als Spalte am Profil, weil die öffentlichen Kurslisten die
-- Profile ohnehin schon in einer einzigen Abfrage laden (App.jsx fetchCourses).
-- So kostet die Penalty im Frontend keine einzige zusätzliche Abfrage und kann
-- gar keine N+1-Situation erzeugen.
--
-- Bewusst NUR der Faktor am öffentlich lesbaren Profil, nicht die Leadzahl:
-- profiles ist über "Anyone can read profiles" für alle lesbar. Der Faktor ist
-- eine grobe Vierer-Stufe und für das Ranking im Browser unvermeidbar; die
-- genaue Anzahl qualifizierter Leads bleibt der Admin-API vorbehalten.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS basic_lead_ranking_factor NUMERIC(3,2) NOT NULL DEFAULT 1.00;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_basic_lead_ranking_factor_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_basic_lead_ranking_factor_check
  CHECK (basic_lead_ranking_factor > 0 AND basic_lead_ranking_factor <= 1);

COMMENT ON COLUMN profiles.basic_lead_ranking_factor IS
  'Multiplikator für das öffentliche Ranking. 1.00 für alle Bezahlpakete und für Basic-Anbieter mit bis zu 3 qualifizierten Leads in der aktuellen Basic-Phase. Wird von recompute_basic_lead_ranking_factors() gepflegt.';

-- ----------------------------------------------------------------------------
-- Staffel als eine einzige Quelle der Wahrheit
-- ----------------------------------------------------------------------------
-- 0-3 → 1.00 | 4-6 → 0.90 | 7-10 → 0.80 | ab 11 → 0.70
-- Das Gegenstück im Frontend ist BASIC_LEAD_FACTOR_STEPS in
-- src/lib/basicLeadPenalty.js; beide Stellen sind in docs/lead-analytics.md
-- zusammen dokumentiert.
CREATE OR REPLACE FUNCTION basic_lead_ranking_factor_for(p_count INTEGER)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_count, 0) >= 11 THEN 0.70
    WHEN coalesce(p_count, 0) >= 7  THEN 0.80
    WHEN coalesce(p_count, 0) >= 4  THEN 0.90
    ELSE 1.00
  END::NUMERIC(3,2);
$$;

-- ----------------------------------------------------------------------------
-- Aktuelle Basic-Phase eines Anbieters
-- ----------------------------------------------------------------------------
-- Nur die laufende, offene Periode zählt, und nur wenn sie 'basic' ist. Ein
-- Paketkauf schliesst diese Periode; ab dann ist der Rückgabewert NULL und die
-- Penalty entfällt sofort. Beginnt später erneut eine Basic-Phase, liefert die
-- Funktion deren Startzeitpunkt — die Zählung beginnt damit wieder bei null.
CREATE OR REPLACE FUNCTION current_basic_phase_start(p_provider_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT h.started_at
  FROM provider_package_history h
  WHERE h.provider_id = p_provider_id
    AND h.ended_at IS NULL
    AND h.package_tier = 'basic'
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- Neuberechnung für alle Anbieter (mengenbasiert, kein Schleifen-N+1)
-- ----------------------------------------------------------------------------
-- Läuft nach jedem Scoringlauf. Aktualisiert nur Profile, deren Faktor sich
-- tatsächlich ändert — das hält die Zahl der Schreibvorgänge klein.
CREATE OR REPLACE FUNCTION recompute_basic_lead_ranking_factors()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH open_basic AS (
    -- Alle Anbieter, die aktuell in einer offenen Basic-Phase sind.
    SELECT h.provider_id, h.started_at
    FROM provider_package_history h
    WHERE h.ended_at IS NULL
      AND h.package_tier = 'basic'
  ),
  qualified AS (
    SELECT b.provider_id, count(l.id)::INTEGER AS lead_count
    FROM open_basic b
    LEFT JOIN leads l
      ON l.provider_id = b.provider_id
     AND l.status = 'sent'
     AND l.provider_tier_at_lead = 'basic'
     AND l.quality_score >= 5
     AND l.created_at >= b.started_at
    GROUP BY b.provider_id
  ),
  target AS (
    -- Jedes Profil bekommt einen Zielwert: Basic-Anbieter den Staffelwert,
    -- alle anderen (Pro/Premium/Enterprise) immer 1.00.
    SELECT
      p.id,
      CASE
        WHEN q.provider_id IS NULL THEN 1.00::NUMERIC(3,2)
        ELSE basic_lead_ranking_factor_for(q.lead_count)
      END AS factor
    FROM profiles p
    LEFT JOIN qualified q ON q.provider_id = p.id
  ),
  changed AS (
    UPDATE profiles p
    SET basic_lead_ranking_factor = t.factor
    FROM target t
    WHERE t.id = p.id
      AND p.basic_lead_ranking_factor IS DISTINCT FROM t.factor
    RETURNING p.id
  )
  SELECT count(*) INTO v_updated FROM changed;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION recompute_basic_lead_ranking_factors() IS
  'Berechnet profiles.basic_lead_ranking_factor für alle Anbieter neu. Zählt nur versandte Leads mit quality_score >= 5 und provider_tier_at_lead = basic aus der aktuellen Basic-Phase. Gibt die Anzahl geänderter Profile zurück.';

-- ----------------------------------------------------------------------------
-- Paketkauf: Penalty sofort zurücksetzen
-- ----------------------------------------------------------------------------
-- recompute_basic_lead_ranking_factors() läuft nur monatlich nach dem Scoring.
-- Wer ein Bezahlpaket kauft, darf aber nicht bis zum nächsten Lauf abgestuft
-- bleiben. Der Trigger setzt den Faktor deshalb im selben Schreibvorgang.
CREATE OR REPLACE FUNCTION reset_ranking_factor_on_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(OLD.package_tier, 'basic')) = lower(coalesce(NEW.package_tier, 'basic')) THEN
    RETURN NEW;
  END IF;

  -- Bezahlpaket: keine Penalty. Neue Basic-Phase: Zählung beginnt bei null,
  -- also ebenfalls 1.00. Beide Fälle laufen auf denselben Wert hinaus.
  NEW.basic_lead_ranking_factor := 1.00;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_ranking_factor_on_tier_change ON profiles;
CREATE TRIGGER trg_reset_ranking_factor_on_tier_change
  BEFORE INSERT OR UPDATE OF package_tier ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION reset_ranking_factor_on_tier_change();

COMMENT ON FUNCTION reset_ranking_factor_on_tier_change() IS
  'Setzt basic_lead_ranking_factor bei jedem echten Paketwechsel sofort auf 1.00 — sowohl beim Kauf eines Bezahlpakets als auch beim Start einer neuen Basic-Phase.';
