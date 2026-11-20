-- =====================================================================
-- ENTWURF – NICHT ANWENDEN ohne ausdrückliche Freigabe (Stand 20.11.2026).
-- Liegt bewusst NICHT in supabase/migrations. Rückweg:
--   supabase/drafts/20261120090000_ai_search_keep_embeddings_skip_noop_jobs_down.sql
-- Tests (laufen mit erzwungenem Rollback):
--   supabase/drafts/tests/20261120090000_ai_search_keep_embeddings_skip_noop_jobs_test.sql
--
-- Befund: docs/ai-search/befund-warteschlange-testindex.md
--   1. ai_search_apply_upsert löscht bei jedem geänderten Inhaltshash ALLE
--      Abschnitte und verwirft damit auch Embeddings unveränderter Texte
--      (19.11.: 2'768 von 2'771 nach einer reinen Profiländerung).
--   2. Der Outbox-Trigger reiht bei JEDEM UPDATE einen Auftrag ein, auch wenn
--      kein Wert oder nur ein für den Index bedeutungsloses Feld sich ändert
--      (19.11.: 13'154 Aufträge durch Speichern des Testanbieter-Profils).
--
-- Änderungen:
--   A) Embeddings bleiben erhalten, wenn die vollständige Embedding-Eingabe
--      identisch ist. Eingabe ist ausschliesslich der Abschnittstext
--      (scripts/ai-search-embed-test.mjs: embed(row.text)). Übernommen wird
--      immer das PAAR (embedding, model_version) – der Vektor bleibt also an
--      genau die Modellversion gebunden, mit der er erzeugt wurde. Die
--      Dimension ist durch den Spaltentyp vector(1024) festgelegt und wird
--      zusätzlich geprüft. Suche und Embedding-Lauf filtern weiterhin auf die
--      aktive Modellversion; Vektoren einer anderen Version werden dort
--      nicht verwendet bzw. neu berechnet.
--   B) Keine Aufträge für wertgleiche UPDATEs. Bei courses zählen drei Felder
--      nicht als Indexänderung (Ausschlussliste, alles andere löst weiterhin
--      aus – auch künftige neue Spalten):
--        instructor_name  – nicht Teil der Projektion (projection.js)
--        is_pro, is_prio  – werden bei jeder Suche live aus courses gelesen
--      Inhalt, Status, Preise, Kategorien-Spalten, Ort, Niveau, Sprache usw.
--      lösen weiterhin aus. course_events/course_locations: nur exakt
--      wertgleiche Zeilen werden übersprungen; INSERT/DELETE immer.
--   C) Folge von B): Bisher erreichten Profiländerungen den Index nur über den
--      Umweg instructor_name. Neu reiht ein eigener Trigger die Kurse eines
--      Anbieters ein, wenn sich eines der indexierten Profilfelder wirklich
--      ändert (projection.js PROFILE_FIELDS: slug, city, canton,
--      verification_status, bio_text), Grund 'profile_change'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- B) Ausschlussliste (eine Stelle, von Tests geprüft)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_search_ignored_course_columns()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT ARRAY['instructor_name', 'is_pro', 'is_prio']::text[];
$function$;

-- ---------------------------------------------------------------------
-- B) Outbox-Trigger: wertgleiche UPDATEs überspringen
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_search_enqueue_course_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id BIGINT;
  v_reason    TEXT;
  v_priority  SMALLINT := 5;
BEGIN
  -- Entwurf 20.11.2026: UPDATE ohne indexrelevante Wertänderung → kein Auftrag.
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'courses' THEN
      IF (to_jsonb(NEW) - ai_search_ignored_course_columns())
         = (to_jsonb(OLD) - ai_search_ignored_course_columns()) THEN
        RETURN NEW;
      END IF;
    ELSIF to_jsonb(NEW) = to_jsonb(OLD) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'courses' THEN
    v_course_id := COALESCE(NEW.id, OLD.id);
    IF TG_OP = 'DELETE' THEN
      v_reason := 'course_delete'; v_priority := 1;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_reason := 'course_upsert';
      v_priority := CASE WHEN COALESCE(NEW.status,'') <> 'published' THEN 1 ELSE 3 END;
    ELSE
      v_reason := 'course_upsert';
    END IF;
  ELSIF TG_TABLE_NAME = 'course_events' THEN
    v_course_id := COALESCE(NEW.course_id, OLD.course_id);
    v_reason := 'event_change'; v_priority := 3;
  ELSIF TG_TABLE_NAME = 'course_locations' THEN
    v_course_id := COALESCE(NEW.course_id, OLD.course_id);
    v_reason := 'location_change';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO ai_search_jobs (course_id, reason, priority)
  VALUES (v_course_id, v_reason, v_priority);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ---------------------------------------------------------------------
-- C) Profiländerungen mit Indexwirkung einreihen
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_search_enqueue_profile_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.slug, NEW.city, NEW.canton, NEW.verification_status, NEW.bio_text)
     IS NOT DISTINCT FROM
     (OLD.slug, OLD.city, OLD.canton, OLD.verification_status, OLD.bio_text) THEN
    RETURN NEW;
  END IF;

  INSERT INTO ai_search_jobs (course_id, reason, priority)
  SELECT c.id, 'profile_change', 5
  FROM courses c
  WHERE c.user_id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ai_search_profiles_outbox ON public.profiles;
CREATE TRIGGER ai_search_profiles_outbox
  AFTER UPDATE OF slug, city, canton, verification_status, bio_text ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ai_search_enqueue_profile_jobs();

-- ---------------------------------------------------------------------
-- A) Atomare Übernahme: Embeddings unveränderter Abschnittstexte erhalten
--    (unverändert gegenüber 20261115190000 bis auf v_kept und den
--    abschliessenden UPDATE-Block)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_search_apply_upsert(p_course_id bigint, p_source_version bigint, p_document jsonb, p_chunks jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state           ai_search_index_state%ROWTYPE;
  v_hash            TEXT := p_document->>'content_hash';
  v_expected_chunks INTEGER := COALESCE(jsonb_array_length(COALESCE(p_chunks, '[]'::jsonb)), 0);
  v_doc_exists      BOOLEAN;
  v_chunk_count     INTEGER;
  v_outcome         TEXT;
  v_kept            ai_search_chunks[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_search_apply:' || p_course_id::text, 0));

  SELECT * INTO v_state FROM ai_search_index_state WHERE course_id = p_course_id;

  IF FOUND AND p_source_version < v_state.last_source_version THEN
    RETURN 'stale_skipped';
  END IF;
  IF FOUND AND p_source_version = v_state.last_source_version
     AND v_state.last_action = 'delete' THEN
    RETURN 'stale_skipped';
  END IF;

  SELECT EXISTS (SELECT 1 FROM ai_search_documents WHERE course_id = p_course_id)
    INTO v_doc_exists;
  SELECT count(*) INTO v_chunk_count FROM ai_search_chunks WHERE course_id = p_course_id;

  IF FOUND AND v_state.last_action = 'upsert' AND v_state.content_hash = v_hash
     AND v_doc_exists AND v_chunk_count = v_expected_chunks THEN
    UPDATE ai_search_documents
    SET source_version = p_source_version, source_updated_at = now(), indexed_at = now()
    WHERE course_id = p_course_id;
    UPDATE ai_search_index_state
    SET last_source_version = p_source_version, updated_at = now()
    WHERE course_id = p_course_id;
    RETURN 'refreshed';
  END IF;

  IF FOUND AND v_state.content_hash = v_hash THEN
    v_outcome := 'repaired';
  ELSIF v_doc_exists THEN
    v_outcome := 'updated';
  ELSE
    v_outcome := 'inserted';
  END IF;

  INSERT INTO ai_search_documents (
    course_id, title, description_clean, facts, price_status, price_amount,
    content_hash, source_version, source_updated_at, indexed_at
  )
  VALUES (
    p_course_id,
    COALESCE(p_document->>'title', ''),
    COALESCE(p_document->>'description_clean', ''),
    COALESCE(p_document->'facts', '{}'::jsonb),
    COALESCE(p_document->>'price_status', 'unknown'),
    NULLIF(p_document->>'price_amount', '')::NUMERIC,
    v_hash,
    p_source_version,
    now(), now()
  )
  ON CONFLICT (course_id) DO UPDATE SET
    title = EXCLUDED.title,
    description_clean = EXCLUDED.description_clean,
    facts = EXCLUDED.facts,
    price_status = EXCLUDED.price_status,
    price_amount = EXCLUDED.price_amount,
    content_hash = EXCLUDED.content_hash,
    source_version = EXCLUDED.source_version,
    source_updated_at = now(),
    indexed_at = now();

  -- Entwurf 20.11.2026: vorhandene Embeddings vor dem Neuschreiben sichern.
  SELECT array_agg(c) INTO v_kept
  FROM ai_search_chunks c
  WHERE c.course_id = p_course_id
    AND c.embedding IS NOT NULL
    AND c.model_version IS NOT NULL;

  DELETE FROM ai_search_chunks WHERE course_id = p_course_id;
  INSERT INTO ai_search_chunks (
    course_id, section, chunk_index, char_start, char_end, text,
    content_hash, source_version
  )
  SELECT
    p_course_id,
    c->>'section',
    (c->>'chunk_index')::INTEGER,
    (c->>'char_start')::INTEGER,
    (c->>'char_end')::INTEGER,
    c->>'text',
    v_hash,
    p_source_version
  FROM jsonb_array_elements(COALESCE(p_chunks, '[]'::jsonb)) AS c;

  -- Entwurf 20.11.2026: identischer Abschnittstext (= vollständige
  -- Embedding-Eingabe) → Embedding samt zugehöriger Modellversion übernehmen.
  -- Position/Abschnitt spielen für den Vektor keine Rolle; bei mehrfach
  -- vorkommendem Text gilt der erste gesicherte Eintrag (gleicher Vektor).
  IF v_kept IS NOT NULL THEN
    UPDATE ai_search_chunks n
    SET embedding = o.embedding,
        model_version = o.model_version
    FROM (
      SELECT DISTINCT ON (k.text) k.text, k.embedding, k.model_version
      FROM unnest(v_kept) AS k
      WHERE vector_dims(k.embedding) = 1024
      ORDER BY k.text, k.section, k.chunk_index
    ) AS o
    WHERE n.course_id = p_course_id
      AND n.text = o.text;
  END IF;

  INSERT INTO ai_search_index_state (course_id, last_source_version, last_action, content_hash, chunk_count)
  VALUES (p_course_id, p_source_version, 'upsert', v_hash, v_expected_chunks)
  ON CONFLICT (course_id) DO UPDATE SET
    last_source_version = EXCLUDED.last_source_version,
    last_action = 'upsert',
    content_hash = EXCLUDED.content_hash,
    chunk_count = EXCLUDED.chunk_count,
    updated_at = now();

  RETURN v_outcome;
END;
$function$;

-- ---------------------------------------------------------------------
-- Rechte wie bisher: nur Serverrolle (CREATE OR REPLACE behält bestehende
-- Rechte; neue Funktionen werden ausdrücklich gesperrt).
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION ai_search_apply_upsert(BIGINT, BIGINT, JSONB, JSONB) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_ignored_course_columns() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_enqueue_profile_jobs() FROM anon, authenticated, PUBLIC;
