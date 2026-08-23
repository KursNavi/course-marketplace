-- ============================================================
-- Migration: Transaktionaler Listenersatz für Themenwelt-Sub-Entitäten
-- Erstellt: 2026-08-09
-- Branch: feature/dynamic-theme-worlds
-- Release-Blocker 1: Datenverlust beim Speichern von Unterlisten
-- ============================================================
-- PROBLEM
--   api/admin-theme-world-sub.js führte den Listenersatz bisher als
--   ZWEI getrennte Supabase-Aufrufe aus:
--     1. DELETE aller bestehenden Datensätze
--     2. separater INSERT der neuen Liste
--   Schlug Schritt 2 fehl (z.B. Unique-Verletzung, Check-Constraint,
--   Netzwerkabbruch), war Schritt 1 bereits committet — die bisherigen
--   Daten waren dauerhaft verloren.
--
-- LÖSUNG
--   Diese Funktion führt DELETE + INSERT in EINEM Datenbankaufruf und
--   damit in DERSELBEN PostgreSQL-Transaktion aus.
--
-- ATOMARITÄT (warum der Rollback garantiert ist)
--   Ein Funktionsaufruf läuft immer innerhalb genau einer SQL-Anweisung,
--   die ihrerseits innerhalb einer Transaktion läuft (PostgREST/Supabase
--   öffnet pro RPC-Aufruf genau eine Transaktion und committet erst nach
--   fehlerfreiem Abschluss). Tritt an irgendeiner Stelle ein Fehler auf,
--   bricht PostgreSQL die gesamte Transaktion ab und macht ALLE Effekte
--   rückgängig — inklusive des vorangegangenen DELETE.
--
--   Diese Funktion enthält bewusst KEINEN "EXCEPTION WHEN OTHERS"-Handler:
--     - Der ursprüngliche SQLSTATE und die Original-Fehlermeldung bleiben
--       unverändert erhalten (z.B. 23505 unique_violation), was die
--       Fehlerdiagnose im API-Layer und in Tests eindeutig macht.
--     - Es gibt damit keinen Codepfad, der einen Fehler verschlucken und
--       einen Teilzustand committen könnte.
--   Die Funktion enthält ebenso KEIN COMMIT/ROLLBACK/SAVEPOINT — die
--   Transaktionsklammer gehört ausschliesslich dem Aufrufer.
--
-- SICHERHEIT
--   SECURITY DEFINER    — läuft mit den Rechten des Funktionsbesitzers.
--   SET search_path=''  — verhindert search_path-Injection; alle Tabellen
--                         sind vollständig mit public. qualifiziert.
--   Statische CASE-Zweige pro Entitätstyp: es wird NIEMALS ein Tabellen-
--   name aus Clientdaten in SQL eingesetzt. p_entity_type ist strikt
--   gewhitelistet; jeder unbekannte Wert führt zu einer Exception.
--   Zugriffsrechte: REVOKE ALL FROM PUBLIC, anon und authenticated
--   explizit ausgeschlossen, gezielter GRANT nur an service_role.
--
-- FELDER
--   Es werden ausschliesslich die unten explizit benannten Spalten
--   geschrieben. Zusätzliche Schlüssel im JSON werden ignoriert —
--   ein Client kann keine fremden Spalten (z.B. id, created_at) setzen.
--
-- ABGRENZUNG
--   Diese Migration erstellt AUSSCHLIESSLICH eine Funktion und setzt die
--   zugehörigen Rechte. Sie verändert KEINE Tabellenstruktur und KEINE
--   Daten. Ihre Ausführung ist für bestehende Sport-/Yoga-Inhalte ein
--   No-Op.
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_theme_world_subentities(
  p_theme_world_id UUID,
  p_entity_type    TEXT,
  p_items          JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- --------------------------------------------------------
  -- Eingabevalidierung
  -- --------------------------------------------------------
  IF p_theme_world_id IS NULL THEN
    RAISE EXCEPTION 'replace_theme_world_subentities: p_theme_world_id darf nicht NULL sein';
  END IF;

  IF p_entity_type IS NULL THEN
    RAISE EXCEPTION 'replace_theme_world_subentities: p_entity_type darf nicht NULL sein';
  END IF;

  -- Strikte Whitelist. Unbekannte Typen werden abgelehnt, BEVOR
  -- irgendetwas gelöscht wird.
  IF p_entity_type NOT IN (
    'faqs', 'editorial_sections', 'specialties', 'regions', 'trust_items'
  ) THEN
    RAISE EXCEPTION 'replace_theme_world_subentities: unbekannter Entity-Typ "%". Erlaubt: faqs, editorial_sections, specialties, regions, trust_items', p_entity_type;
  END IF;

  -- Fehlende Liste vs. explizit leeres Array sind unterschiedliche Fälle:
  --   NULL / kein Array → Fehler (verhindert unbeabsichtigtes Löschen)
  --   Leeres Array []   → erlaubt (löscht alle Einträge, beabsichtigt)
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'replace_theme_world_subentities: p_items muss ein JSON-Array sein, erhalten: %', COALESCE(jsonb_typeof(p_items), 'null');
  END IF;

  -- Themenwelt muss existieren. Ohne diese Prüfung wäre ein DELETE mit
  -- unbekannter ID ein stiller No-Op statt eines klaren Fehlers.
  IF NOT EXISTS (
    SELECT 1 FROM public.theme_worlds WHERE id = p_theme_world_id
  ) THEN
    RAISE EXCEPTION 'replace_theme_world_subentities: Themenwelt % nicht gefunden', p_theme_world_id;
  END IF;

  -- --------------------------------------------------------
  -- Listenersatz je Typ — statische Zweige, keine dynamische SQL.
  -- DELETE und INSERT stehen im selben Funktionsaufruf und damit in
  -- derselben Transaktion.
  -- --------------------------------------------------------
  IF p_entity_type = 'faqs' THEN

    DELETE FROM public.theme_world_faqs
    WHERE theme_world_id = p_theme_world_id;

    INSERT INTO public.theme_world_faqs (
      theme_world_id,
      question_de, question_en, question_fr, question_it,
      answer_de, answer_en, answer_fr, answer_it,
      sort_order, is_active
    )
    SELECT
      p_theme_world_id,
      e.item->>'question_de',
      e.item->>'question_en',
      e.item->>'question_fr',
      e.item->>'question_it',
      e.item->>'answer_de',
      e.item->>'answer_en',
      e.item->>'answer_fr',
      e.item->>'answer_it',
      COALESCE((e.item->>'sort_order')::INTEGER, (e.ord - 1)::INTEGER),
      COALESCE((e.item->>'is_active')::BOOLEAN, TRUE)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  ELSIF p_entity_type = 'editorial_sections' THEN

    DELETE FROM public.theme_world_editorial_sections
    WHERE theme_world_id = p_theme_world_id;

    INSERT INTO public.theme_world_editorial_sections (
      theme_world_id,
      heading_de, heading_en,
      intro_de, intro_en,
      items_de, items_en,
      is_ordered,
      closing_de, closing_en,
      sort_order, is_active
    )
    SELECT
      p_theme_world_id,
      e.item->>'heading_de',
      e.item->>'heading_en',
      e.item->>'intro_de',
      e.item->>'intro_en',
      -- items_de/items_en sind text[] — Konvertierung aus JSONB-Array
      CASE WHEN jsonb_typeof(e.item->'items_de') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(e.item->'items_de'))
           ELSE NULL END,
      CASE WHEN jsonb_typeof(e.item->'items_en') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(e.item->'items_en'))
           ELSE NULL END,
      COALESCE((e.item->>'is_ordered')::BOOLEAN, FALSE),
      e.item->>'closing_de',
      e.item->>'closing_en',
      COALESCE((e.item->>'sort_order')::INTEGER, (e.ord - 1)::INTEGER),
      COALESCE((e.item->>'is_active')::BOOLEAN, TRUE)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  ELSIF p_entity_type = 'specialties' THEN

    DELETE FROM public.theme_world_specialties
    WHERE theme_world_id = p_theme_world_id;

    INSERT INTO public.theme_world_specialties (
      theme_world_id,
      specialty_label, description_de, icon,
      sort_order, is_active
    )
    SELECT
      p_theme_world_id,
      e.item->>'specialty_label',
      e.item->>'description_de',
      e.item->>'icon',
      COALESCE((e.item->>'sort_order')::INTEGER, (e.ord - 1)::INTEGER),
      COALESCE((e.item->>'is_active')::BOOLEAN, TRUE)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  ELSIF p_entity_type = 'regions' THEN

    DELETE FROM public.theme_world_regions
    WHERE theme_world_id = p_theme_world_id;

    INSERT INTO public.theme_world_regions (
      theme_world_id,
      label_de, anchor_text_de,
      loc_param, delivery_param,
      sort_order, is_active
    )
    SELECT
      p_theme_world_id,
      e.item->>'label_de',
      -- anchor_text_de fällt auf label_de zurück (wie im Import-Pfad)
      COALESCE(e.item->>'anchor_text_de', e.item->>'label_de'),
      -- loc_param/delivery_param dürfen beide NULL sein ("Ganze Schweiz").
      -- Siehe 20260718_relax_regions_params_constraint.sql
      e.item->>'loc_param',
      e.item->>'delivery_param',
      COALESCE((e.item->>'sort_order')::INTEGER, (e.ord - 1)::INTEGER),
      COALESCE((e.item->>'is_active')::BOOLEAN, TRUE)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  ELSIF p_entity_type = 'trust_items' THEN

    DELETE FROM public.theme_world_trust_items
    WHERE theme_world_id = p_theme_world_id;

    INSERT INTO public.theme_world_trust_items (
      theme_world_id,
      item_type, name, description_de,
      logo_url, logo_alt, external_url, rights_note,
      sort_order, is_active
    )
    SELECT
      p_theme_world_id,
      COALESCE(e.item->>'item_type', 'editorial'),
      e.item->>'name',
      e.item->>'description_de',
      e.item->>'logo_url',
      e.item->>'logo_alt',
      e.item->>'external_url',
      e.item->>'rights_note',
      COALESCE((e.item->>'sort_order')::INTEGER, (e.ord - 1)::INTEGER),
      COALESCE((e.item->>'is_active')::BOOLEAN, TRUE)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord);

  END IF;

  -- Jedes Array-Element erzeugt genau eine Zeile (INSERT ... SELECT über
  -- jsonb_array_elements), daher ist die Array-Länge exakt die Anzahl der
  -- eingefügten Datensätze.
  RETURN jsonb_build_object(
    'success',        TRUE,
    'theme_world_id', p_theme_world_id,
    'entity_type',    p_entity_type,
    'count',          jsonb_array_length(p_items)
  );
END;
$$;

COMMENT ON FUNCTION public.replace_theme_world_subentities(UUID, TEXT, JSONB) IS
  'Ersetzt die vollständige Liste einer Themenwelt-Sub-Entität (faqs, editorial_sections, '
  'specialties, regions, trust_items) transaktional: DELETE und INSERT laufen in einem '
  'einzigen Funktionsaufruf und damit in derselben PostgreSQL-Transaktion. Schlägt ein '
  'INSERT fehl, wird auch das DELETE vollständig zurückgerollt — die vorherige Liste '
  'bleibt unverändert erhalten. Ein leeres Array [] löscht die Liste beabsichtigt. '
  'p_entity_type ist strikt gewhitelistet (statische CASE-Zweige, keine dynamische SQL). '
  'Aufruf ausschliesslich serverseitig mit Service-Role-Key aus api/admin-theme-world-sub.js.';

-- --------------------------------------------------------
-- Zugriffsrechte: Strikt kontrolliert
-- --------------------------------------------------------
-- REVOKE ALL FROM PUBLIC entfernt EXECUTE von allen Rollen inklusive
-- service_role — der anschliessende GRANT ist deshalb zwingend.
--
-- Hinweis zur SECURITY DEFINER-Semantik:
--   SECURITY DEFINER bestimmt, MIT WESSEN RECHTEN die Funktion läuft.
--   Sie bestimmt NICHT, WER sie aufrufen darf. Ohne expliziten GRANT
--   könnte sonst jede Rolle die Funktion ausführen.
REVOKE ALL ON FUNCTION public.replace_theme_world_subentities(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_theme_world_subentities(UUID, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.replace_theme_world_subentities(UUID, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_theme_world_subentities(UUID, TEXT, JSONB) TO service_role;
