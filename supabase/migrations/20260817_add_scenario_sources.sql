-- Quellenangaben für Szenarioartikel (theme_world_scenarios.sources)
--
-- Ziel:
--   Jeder Szenario-/Ratgeberartikel einer Themenwelt kann strukturierte
--   Quellenangaben führen, die öffentlich unter dem Artikel als
--   «Quellen & weiterführende Informationen» erscheinen.
--
-- Kanonisches Format (jsonb-Array, Reihenfolge = Anzeigereihenfolge):
--   [
--     {
--       "title":     "Subjektfinanzierung für vorbereitende Kurse",
--       "publisher": "Staatssekretariat für Bildung, Forschung und Innovation SBFI",
--       "url":       "https://www.sbfi.admin.ch/..."
--     }
--   ]
--
--   Genau diese drei Felder. Kein Abrufdatum, keine Citation-ID, keine
--   HTML-Fragmente, keine freien Zusatzobjekte. Der Feldvertrag wird
--   serverseitig in src/lib/scenarioSources.js durchgesetzt
--   (validateScenarioSources), die Admin-API schreibt ausschliesslich den
--   normalisierten Rückgabewert — nie das Rohobjekt aus dem Request.
--
-- Warum jsonb und keine eigene Tabelle:
--   Quellen sind ausschliesslich Beiwerk EINES Artikels. Sie werden nie
--   quer abgefragt, nie geteilt, nie einzeln verlinkt und immer vollständig
--   mit dem Artikel geladen und geschrieben. Eine eigene Tabelle brächte
--   Fremdschlüssel, RLS-Policies, Sortierspalte und einen zweiten Schreibpfad
--   ohne einen einzigen Anwendungsfall, der sie rechtfertigt. Dasselbe Muster
--   nutzt die Tabelle bereits für cta_config.
--
-- Sicherheit dieser Migration:
--   - Rein additiv: eine neue Spalte, keine bestehende Spalte wird verändert,
--     kein Datensatz wird gelöscht oder überschrieben.
--   - NOT NULL DEFAULT '[]' — bestehende Sport- und Yoga-Zeilen erhalten
--     automatisch ein leeres Array und bleiben funktional unverändert.
--     (PostgreSQL 11+ schreibt dafür keine Tabellenkopie, der Default wird als
--     Metadatum hinterlegt.)
--   - Mehrfaches Anwenden ist gefahrlos: IF NOT EXISTS bei der Spalte,
--     DROP IF EXISTS + ADD bei der Constraint.
--   - Keine Änderung an RLS: die Spalte folgt den bestehenden Policies der
--     Tabelle. Öffentlich lesbar ist sie damit genau dann, wenn der Artikel
--     selbst öffentlich lesbar ist (status='published' UND Themenwelt
--     published) — dieselbe Sichtbarkeit wie content_html.

ALTER TABLE public.theme_world_scenarios
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Struktur-Leitplanke auf DB-Ebene: der Wert muss ein JSON-Array sein.
-- Die inhaltliche Prüfung (Pflichtfelder, erlaubte Keys, http(s)-URLs,
-- Höchstzahl) bleibt bewusst in der Anwendungsschicht — dort kann sie der
-- Redaktion verständliche Fehlermeldungen zurückgeben.
ALTER TABLE public.theme_world_scenarios
  DROP CONSTRAINT IF EXISTS scenarios_sources_is_array_check;

ALTER TABLE public.theme_world_scenarios
  ADD CONSTRAINT scenarios_sources_is_array_check
  CHECK (jsonb_typeof(sources) = 'array');

COMMENT ON COLUMN public.theme_world_scenarios.sources IS
  'JSONB-Array redaktioneller Quellenangaben: [{title, publisher, url}]. Reihenfolge = Anzeigereihenfolge. Nur diese drei Keys, nur http(s)-URLs, max. 10 Einträge — durchgesetzt von src/lib/scenarioSources.js. Leeres Array = Artikel zeigt keinen Quellenblock.';
