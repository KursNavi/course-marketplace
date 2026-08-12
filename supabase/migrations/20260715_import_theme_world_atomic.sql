-- ============================================================
-- Migration: Atomische Import-Funktion für Themenwelten
-- Erstellt: 2026-07-15
-- Korrigiert: 2026-07-16 (Phase 6.5 Sicherheitskorrekturen)
-- Branch: feature/dynamic-theme-worlds
-- Phase 6: Import-Atomarität
-- ============================================================
-- Erstellt eine PostgreSQL-Funktion, die den Import einer
-- Themenwelt atomar (in einer einzigen impliziten Transaktion)
-- durchführt. Bei jedem Fehler werden ALLE Änderungen zurück-
-- gerollt — es bleibt kein halbfertiger Import in der DB.
--
-- SICHERHEIT (Phase 6.5 Korrekturen):
--   SET search_path = '': Verhindert search_path-Injection.
--   Alle Tabellen sind vollständig mit public. qualifiziert.
--   SECURITY DEFINER: Läuft mit Rechten des Funktionsbesitzers.
--   Zugriffsrechte: REVOKE ALL FROM PUBLIC, dann gezielter
--   GRANT TO service_role (explizit, nicht implizit).
--   anon und authenticated bleiben explizit ausgeschlossen.
--
-- ATOMARITÄT:
--   PostgreSQL-Funktionen laufen in einer impliziten Transaktion.
--   Jede RAISE EXCEPTION rollt alle Änderungen automatisch zurück.
--
-- ARRAY-VALIDIERUNG (Phase 6.5 Korrektur):
--   Alle fünf Listen (faqs, editorial_sections, specialties,
--   regions, trust_items) MÜSSEN im p_data-Objekt vorhanden sein.
--   Fehlende Schlüssel (vs. explizit leere Arrays []) werden als
--   Fehler behandelt und lösen einen vollständigen Rollback aus.
--   Explizit leere Arrays [] sind erlaubt (löschen alle Einträge).
--
-- IDEMPOTENZ:
--   Themenwelt und Szenarien: ON CONFLICT … DO UPDATE.
--   Listen (FAQs, Editorial, Specialties, Regionen, Trust): DELETE + INSERT.
--   Status-Schutz: status/published_at werden bei bestehenden Einträgen
--   NICHT überschrieben — Admins setzen den Status manuell via Admin-UI.
--   Inhaltliche Felder (title_de, content_html etc.) werden beim
--   Re-Import absichtlich aktualisiert — das ist der Zweck des Imports.
--
-- EINSCHRÄNKUNGEN:
--   Entfernte Szenarien (nicht in p_data) werden NICHT gelöscht.
--   Admins müssen veraltete Szenarien manuell archivieren/löschen.
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_theme_world_atomic(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tw        JSONB;
  v_tw_id     UUID;
  v_sc        JSONB;
  v_item      JSONB;
  v_idx       INTEGER;
BEGIN
  -- --------------------------------------------------------
  -- Eingabevalidierung
  -- --------------------------------------------------------
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'import_theme_world_atomic: p_data darf nicht NULL sein';
  END IF;

  v_tw := p_data->'theme_world';
  IF v_tw IS NULL OR v_tw->>'key' IS NULL OR v_tw->>'key' = '' THEN
    RAISE EXCEPTION 'import_theme_world_atomic: theme_world.key fehlt oder ist leer';
  END IF;

  IF p_data->'scenarios' IS NULL OR jsonb_array_length(p_data->'scenarios') = 0 THEN
    RAISE EXCEPTION 'import_theme_world_atomic: scenarios-Array fehlt oder ist leer';
  END IF;

  -- Alle Listen-Schlüssel müssen explizit vorhanden sein.
  -- Fehlende Schlüssel vs. explizit leere Arrays sind unterschiedliche Fälle:
  --   Fehlender Schlüssel → Fehler (verhindert unbeabsichtigtes Löschen)
  --   Leeres Array []     → erlaubt (löscht alle Einträge)
  IF NOT (p_data ? 'faqs') THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "faqs" fehlt in p_data — explizit leeres Array [] verwenden falls keine FAQs vorhanden';
  END IF;
  IF jsonb_typeof(p_data->'faqs') != 'array' THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "faqs" muss ein JSON-Array sein, erhalten: %', jsonb_typeof(p_data->'faqs');
  END IF;

  IF NOT (p_data ? 'editorial_sections') THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "editorial_sections" fehlt in p_data';
  END IF;
  IF jsonb_typeof(p_data->'editorial_sections') != 'array' THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "editorial_sections" muss ein JSON-Array sein';
  END IF;

  IF NOT (p_data ? 'specialties') THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "specialties" fehlt in p_data';
  END IF;
  IF jsonb_typeof(p_data->'specialties') != 'array' THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "specialties" muss ein JSON-Array sein';
  END IF;

  IF NOT (p_data ? 'regions') THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "regions" fehlt in p_data';
  END IF;
  IF jsonb_typeof(p_data->'regions') != 'array' THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "regions" muss ein JSON-Array sein';
  END IF;

  IF NOT (p_data ? 'trust_items') THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "trust_items" fehlt in p_data';
  END IF;
  IF jsonb_typeof(p_data->'trust_items') != 'array' THEN
    RAISE EXCEPTION 'import_theme_world_atomic: "trust_items" muss ein JSON-Array sein';
  END IF;

  -- --------------------------------------------------------
  -- 1. Themenwelt upserten (ON CONFLICT key)
  --    status und published_at werden bei bestehenden Einträgen
  --    NICHT überschrieben (Admins setzen Status manuell).
  -- --------------------------------------------------------
  INSERT INTO public.theme_worlds (
    key, slug, url_segment, db_segment, area_slug,
    title_de, subtitle_de, intro_de,
    hero_image_url, hero_image_alt_de, og_image_url,
    meta_title, meta_description,
    status, sort_order,
    search_config, section_titles, predefined_searches, cta_links,
    updated_at
  ) VALUES (
    v_tw->>'key',
    v_tw->>'slug',
    v_tw->>'url_segment',
    v_tw->>'db_segment',
    COALESCE(v_tw->>'area_slug', v_tw->>'key'),
    v_tw->>'title_de',
    v_tw->>'subtitle_de',
    v_tw->>'intro_de',
    v_tw->>'hero_image_url',
    v_tw->>'hero_image_alt_de',
    v_tw->>'og_image_url',
    v_tw->>'meta_title',
    v_tw->>'meta_description',
    COALESCE(v_tw->>'status', 'draft'),
    COALESCE((v_tw->>'sort_order')::INTEGER, 10),
    CASE WHEN v_tw->'search_config' IS NOT NULL AND v_tw->'search_config' != 'null'::JSONB
         THEN v_tw->'search_config' ELSE NULL END,
    CASE WHEN v_tw->'section_titles' IS NOT NULL AND v_tw->'section_titles' != 'null'::JSONB
         THEN v_tw->'section_titles' ELSE NULL END,
    COALESCE(v_tw->'predefined_searches', '[]'::JSONB),
    COALESCE(v_tw->'cta_links', '[]'::JSONB),
    NOW()
  )
  ON CONFLICT (key) DO UPDATE SET
    slug                = EXCLUDED.slug,
    url_segment         = EXCLUDED.url_segment,
    db_segment          = EXCLUDED.db_segment,
    area_slug           = EXCLUDED.area_slug,
    title_de            = EXCLUDED.title_de,
    subtitle_de         = EXCLUDED.subtitle_de,
    intro_de            = EXCLUDED.intro_de,
    hero_image_url      = EXCLUDED.hero_image_url,
    hero_image_alt_de   = EXCLUDED.hero_image_alt_de,
    og_image_url        = EXCLUDED.og_image_url,
    meta_title          = EXCLUDED.meta_title,
    meta_description    = EXCLUDED.meta_description,
    sort_order          = EXCLUDED.sort_order,
    search_config       = EXCLUDED.search_config,
    section_titles      = EXCLUDED.section_titles,
    predefined_searches = EXCLUDED.predefined_searches,
    cta_links           = EXCLUDED.cta_links,
    updated_at          = NOW()
    -- status und published_at werden absichtlich NICHT überschrieben
  RETURNING id INTO v_tw_id;

  -- --------------------------------------------------------
  -- 2. Szenarien upserten (ON CONFLICT theme_world_id, slug)
  --    Bereits publizierte Szenarien behalten ihren Status.
  -- --------------------------------------------------------
  v_idx := 0;
  FOR v_sc IN SELECT value FROM jsonb_array_elements(
    COALESCE(p_data->'scenarios', '[]'::JSONB)
  )
  LOOP
    v_idx := v_idx + 1;

    INSERT INTO public.theme_world_scenarios (
      theme_world_id, slug, sort_order, icon,
      label_de, teaser_de, content_html,
      card_image_url, card_image_alt, og_image_url,
      meta_title, meta_description,
      cta_label_de, cta_config,
      status, updated_at
    ) VALUES (
      v_tw_id,
      v_sc->>'slug',
      COALESCE((v_sc->>'sort_order')::INTEGER, v_idx),
      v_sc->>'icon',
      v_sc->>'label_de',
      v_sc->>'teaser_de',
      COALESCE(v_sc->>'content_html', ''),
      v_sc->>'card_image_url',
      v_sc->>'card_image_alt',
      v_sc->>'og_image_url',
      v_sc->>'meta_title',
      v_sc->>'meta_description',
      v_sc->>'cta_label_de',
      CASE WHEN v_sc->'cta_config' IS NOT NULL AND v_sc->'cta_config' != 'null'::JSONB
           THEN v_sc->'cta_config' ELSE NULL END,
      COALESCE(v_sc->>'status', 'draft'),
      NOW()
    )
    ON CONFLICT (theme_world_id, slug) DO UPDATE SET
      sort_order       = EXCLUDED.sort_order,
      icon             = EXCLUDED.icon,
      label_de         = EXCLUDED.label_de,
      teaser_de        = EXCLUDED.teaser_de,
      content_html     = EXCLUDED.content_html,
      card_image_url   = EXCLUDED.card_image_url,
      card_image_alt   = EXCLUDED.card_image_alt,
      og_image_url     = EXCLUDED.og_image_url,
      meta_title       = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      cta_label_de     = EXCLUDED.cta_label_de,
      cta_config       = EXCLUDED.cta_config,
      updated_at       = NOW()
      -- status und published_at werden absichtlich NICHT überschrieben
    ;
  END LOOP;

  -- --------------------------------------------------------
  -- 3. FAQs atomisch ersetzen (delete-all, dann insert)
  --    Voraussetzung: 'faqs'-Schlüssel wurde oben validiert.
  -- --------------------------------------------------------
  DELETE FROM public.theme_world_faqs
  WHERE theme_world_id = v_tw_id;

  v_idx := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_data->'faqs')
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.theme_world_faqs (
      theme_world_id, question_de, answer_de, sort_order, is_active
    ) VALUES (
      v_tw_id,
      v_item->>'question_de',
      v_item->>'answer_de',
      COALESCE((v_item->>'sort_order')::INTEGER, v_idx),
      COALESCE((v_item->>'is_active')::BOOLEAN, TRUE)
    );
  END LOOP;

  -- --------------------------------------------------------
  -- 4. Editorial Sections atomisch ersetzen
  --    Voraussetzung: 'editorial_sections'-Schlüssel wurde oben validiert.
  -- --------------------------------------------------------
  DELETE FROM public.theme_world_editorial_sections
  WHERE theme_world_id = v_tw_id;

  v_idx := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_data->'editorial_sections')
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.theme_world_editorial_sections (
      theme_world_id, heading_de, intro_de,
      items_de, is_ordered, closing_de,
      sort_order, is_active
    ) VALUES (
      v_tw_id,
      v_item->>'heading_de',
      v_item->>'intro_de',
      -- items_de ist text[] — Konvertierung von JSONB-Array
      CASE
        WHEN v_item->'items_de' IS NOT NULL
          AND v_item->'items_de' != 'null'::JSONB
          AND jsonb_typeof(v_item->'items_de') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'items_de'))
        ELSE NULL
      END,
      COALESCE((v_item->>'is_ordered')::BOOLEAN, FALSE),
      v_item->>'closing_de',
      COALESCE((v_item->>'sort_order')::INTEGER, v_idx),
      COALESCE((v_item->>'is_active')::BOOLEAN, TRUE)
    );
  END LOOP;

  -- --------------------------------------------------------
  -- 5. Specialties atomisch ersetzen
  --    Voraussetzung: 'specialties'-Schlüssel wurde oben validiert.
  -- --------------------------------------------------------
  DELETE FROM public.theme_world_specialties
  WHERE theme_world_id = v_tw_id;

  v_idx := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_data->'specialties')
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.theme_world_specialties (
      theme_world_id, specialty_label, description_de, icon,
      sort_order, is_active
    ) VALUES (
      v_tw_id,
      v_item->>'specialty_label',
      v_item->>'description_de',
      v_item->>'icon',
      COALESCE((v_item->>'sort_order')::INTEGER, v_idx),
      COALESCE((v_item->>'is_active')::BOOLEAN, TRUE)
    );
  END LOOP;

  -- --------------------------------------------------------
  -- 6. Regionen atomisch ersetzen
  --    Voraussetzung: 'regions'-Schlüssel wurde oben validiert.
  -- --------------------------------------------------------
  DELETE FROM public.theme_world_regions
  WHERE theme_world_id = v_tw_id;

  v_idx := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_data->'regions')
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.theme_world_regions (
      theme_world_id, label_de, anchor_text_de,
      loc_param, delivery_param, sort_order, is_active
    ) VALUES (
      v_tw_id,
      v_item->>'label_de',
      COALESCE(v_item->>'anchor_text_de', v_item->>'label_de'),
      v_item->>'loc_param',
      v_item->>'delivery_param',
      COALESCE((v_item->>'sort_order')::INTEGER, v_idx),
      COALESCE((v_item->>'is_active')::BOOLEAN, TRUE)
    );
  END LOOP;

  -- --------------------------------------------------------
  -- 7. Trust Items atomisch ersetzen
  --    Voraussetzung: 'trust_items'-Schlüssel wurde oben validiert.
  -- --------------------------------------------------------
  DELETE FROM public.theme_world_trust_items
  WHERE theme_world_id = v_tw_id;

  v_idx := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_data->'trust_items')
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.theme_world_trust_items (
      theme_world_id, item_type, name, description_de,
      logo_url, logo_alt, external_url, rights_note,
      sort_order, is_active
    ) VALUES (
      v_tw_id,
      COALESCE(v_item->>'item_type', 'editorial'),
      v_item->>'name',
      v_item->>'description_de',
      v_item->>'logo_url',
      v_item->>'logo_alt',
      v_item->>'external_url',
      v_item->>'rights_note',
      COALESCE((v_item->>'sort_order')::INTEGER, v_idx),
      COALESCE((v_item->>'is_active')::BOOLEAN, TRUE)
    );
  END LOOP;

  -- --------------------------------------------------------
  -- Ergebnis zurückgeben
  -- --------------------------------------------------------
  RETURN jsonb_build_object(
    'success',                     TRUE,
    'theme_world_id',              v_tw_id,
    'scenarios_processed',         jsonb_array_length(COALESCE(p_data->'scenarios',          '[]'::JSONB)),
    'faqs_replaced',               jsonb_array_length(COALESCE(p_data->'faqs',               '[]'::JSONB)),
    'editorial_sections_replaced', jsonb_array_length(COALESCE(p_data->'editorial_sections', '[]'::JSONB)),
    'specialties_replaced',        jsonb_array_length(COALESCE(p_data->'specialties',        '[]'::JSONB)),
    'regions_replaced',            jsonb_array_length(COALESCE(p_data->'regions',            '[]'::JSONB)),
    'trust_items_replaced',        jsonb_array_length(COALESCE(p_data->'trust_items',        '[]'::JSONB))
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Alle Änderungen werden durch PostgreSQL automatisch zurückgerollt.
    RAISE EXCEPTION 'import_theme_world_atomic: Import fehlgeschlagen (vollständiger Rollback): %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.import_theme_world_atomic(JSONB) IS
  'Importiert eine Themenwelt vollständig atomar in einer impliziten PostgreSQL-Transaktion. '
  'Bei jedem Fehler werden alle Änderungen zurückgerollt. '
  'Wird ausschliesslich vom Import-Script (scripts/import-theme-world.mjs) mit Service-Role-Key aufgerufen. '
  'Status-Felder (status, published_at) bestehender Einträge werden beim Re-Import NICHT überschrieben. '
  'Inhaltliche Felder (title_de, content_html etc.) werden beim Re-Import aktualisiert — das ist Systemzweck. '
  'Phase 6.5: search_path='' + GRANT TO service_role + Array-Pflichtvalidierung.';

-- --------------------------------------------------------
-- Zugriffsrechte: Strikt kontrolliert
-- --------------------------------------------------------
-- REVOKE ALL FROM PUBLIC: Entfernt EXECUTE-Berechtigung von allen Rollen inkl. service_role.
-- GRANT TO service_role:  Erteilt EXECUTE ausschliesslich der Service-Role.
-- anon und authenticated: Bleiben ohne EXECUTE-Berechtigung.
--
-- Hinweis zur SECURITY DEFINER-Semantik:
--   SECURITY DEFINER bestimmt, MIT WESSEN RECHTEN die Funktion läuft (owner = postgres).
--   Sie bestimmt NICHT, WER die Funktion aufrufen darf.
--   Deshalb ist der explizite GRANT unbedingt erforderlich.
REVOKE ALL ON FUNCTION public.import_theme_world_atomic(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.import_theme_world_atomic(JSONB) TO service_role;
