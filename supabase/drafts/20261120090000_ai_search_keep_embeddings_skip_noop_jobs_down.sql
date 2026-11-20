-- =====================================================================
-- RÜCKWEG zum Entwurf 20261120090000_ai_search_keep_embeddings_skip_noop_jobs
-- Stellt die Funktionsdefinitionen wieder her, wie sie am 20.11.2026 in der
-- TESTumgebung aktiv waren (abgerufen mit pg_get_functiondef), und entfernt
-- den neuen Profil-Trigger samt Hilfsfunktionen. Daten bleiben unberührt:
-- bereits übernommene Embeddings und eingereihte Aufträge sind gültig.
-- =====================================================================

DROP TRIGGER IF EXISTS ai_search_profiles_outbox ON public.profiles;
DROP FUNCTION IF EXISTS public.ai_search_enqueue_profile_jobs();

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

DROP FUNCTION IF EXISTS public.ai_search_ignored_course_columns();

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

REVOKE EXECUTE ON FUNCTION ai_search_apply_upsert(BIGINT, BIGINT, JSONB, JSONB) FROM anon, authenticated, PUBLIC;
