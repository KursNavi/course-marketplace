-- KI-Suche Phase 1 Nachtrag: atomare, nebenlaeufigkeitssichere Index-Uebernahme.
--
-- WICHTIG: Vorbereitet, noch NICHT angewendet (liegt zur Pruefung vor).
-- Anwendung zuerst auf der freigegebenen TESTumgebung (omoapbvfligjfznzivyu),
-- nie direkt in Produktion.
--
-- Hintergrund (Pruefbefunde zu PR #198):
--  1. Versionspruefung und Uebernahme muessen ATOMAR erfolgen — zwei
--     gleichzeitig laufende Worker (oder Worker + manueller Lauf) duerfen
--     sich nicht ueberholen. Loesung: SECURITY-DEFINER-Funktionen mit
--     kursbezogenem Advisory-Lock; Dokument + Chunks werden in EINER
--     Transaktion geschrieben.
--  2. Ruecknahme/Loeschung braucht denselben Versionsschutz. Da die
--     Loeschung die Dokumentzeile entfernt, traegt eine eigene
--     Wasserstandstabelle (ai_search_index_state) die zuletzt angewendete
--     Version als Tombstone: ein aelterer Upsert kann einen zurueckgezogenen
--     Kurs nicht wieder anlegen.
--  3. Ein frueherer unvollstaendiger Stand (Dokument ohne vollstaendige
--     Chunks) wird bei erneutem Versuch REPARIERT statt wegen gleicher
--     Version/gleichen Inhalts uebersprungen (Abgleich der tatsaechlichen
--     Chunkanzahl gegen die erwartete).
--
-- ai_search_index_state hat bewusst KEINEN Fremdschluessel auf courses:
-- Tombstones muessen geloeschte Kurse ueberleben (und Tests koennen mit
-- synthetischen Kurs-IDs arbeiten). Zugriff wie alle ai_search_*-Objekte
-- nur serverseitig.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_search_index_state (
  course_id            BIGINT PRIMARY KEY,
  last_source_version  BIGINT NOT NULL,
  last_action          TEXT NOT NULL CHECK (last_action IN ('upsert', 'delete')),
  content_hash         TEXT,
  chunk_count          INTEGER NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_search_index_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_search_index_state FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomare Uebernahme einer Projektion (Dokument + Chunks in einer Transaktion)
-- ---------------------------------------------------------------------------
-- Rueckgabe:
--   'stale_skipped' - Jobversion ist aelter als der Wasserstand (oder gleich
--                     alt gegenueber einer Ruecknahme): nichts geschrieben.
--   'refreshed'     - Inhalt unveraendert UND Bestand vollstaendig: nur
--                     Version/Frische nachgezogen (Chunks/Embeddings bleiben).
--   'repaired'      - gleicher Inhalt, aber unvollstaendiger Bestand
--                     (z. B. Abbruch eines frueheren Laufs): voll neu
--                     geschrieben.
--   'inserted'/'updated' - regulaere Neuanlage bzw. Aktualisierung.
CREATE OR REPLACE FUNCTION ai_search_apply_upsert(
  p_course_id BIGINT,
  p_source_version BIGINT,
  p_document JSONB,
  p_chunks JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state           ai_search_index_state%ROWTYPE;
  v_hash            TEXT := p_document->>'content_hash';
  v_expected_chunks INTEGER := COALESCE(jsonb_array_length(COALESCE(p_chunks, '[]'::jsonb)), 0);
  v_doc_exists      BOOLEAN;
  v_chunk_count     INTEGER;
  v_outcome         TEXT;
BEGIN
  -- Pro Kurs serialisiert: parallele Worker laufen hier nacheinander.
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_search_apply:' || p_course_id::text, 0));

  SELECT * INTO v_state FROM ai_search_index_state WHERE course_id = p_course_id;

  IF FOUND AND p_source_version < v_state.last_source_version THEN
    RETURN 'stale_skipped';
  END IF;
  IF FOUND AND p_source_version = v_state.last_source_version
     AND v_state.last_action = 'delete' THEN
    -- Ruecknahme behaelt bei Versionsgleichstand Vorrang.
    RETURN 'stale_skipped';
  END IF;

  SELECT EXISTS (SELECT 1 FROM ai_search_documents WHERE course_id = p_course_id)
    INTO v_doc_exists;
  SELECT count(*) INTO v_chunk_count FROM ai_search_chunks WHERE course_id = p_course_id;

  -- Unveraenderter Inhalt UND vollstaendiger Bestand: nur Version/Frische.
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
$$;

-- ---------------------------------------------------------------------------
-- Atomare Ruecknahme/Loeschung mit demselben Versionsschutz und Tombstone
-- ---------------------------------------------------------------------------
-- Rueckgabe: 'deleted' | 'stale_skipped'. Bei Versionsgleichstand gewinnt
-- die Loeschung (Ruecknahme-Vorrang laut Datenvertrag §1).
CREATE OR REPLACE FUNCTION ai_search_apply_delete(
  p_course_id BIGINT,
  p_source_version BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state ai_search_index_state%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_search_apply:' || p_course_id::text, 0));

  SELECT * INTO v_state FROM ai_search_index_state WHERE course_id = p_course_id;
  IF FOUND AND p_source_version < v_state.last_source_version THEN
    RETURN 'stale_skipped';
  END IF;

  DELETE FROM ai_search_chunks WHERE course_id = p_course_id;
  DELETE FROM ai_search_documents WHERE course_id = p_course_id;

  INSERT INTO ai_search_index_state (course_id, last_source_version, last_action, content_hash, chunk_count)
  VALUES (p_course_id, p_source_version, 'delete', NULL, 0)
  ON CONFLICT (course_id) DO UPDATE SET
    last_source_version = EXCLUDED.last_source_version,
    last_action = 'delete',
    content_hash = NULL,
    chunk_count = 0,
    updated_at = now();

  RETURN 'deleted';
END;
$$;

-- Nur die Serverrolle darf diese Funktionen aufrufen.
REVOKE EXECUTE ON FUNCTION ai_search_apply_upsert(BIGINT, BIGINT, JSONB, JSONB)
  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_apply_delete(BIGINT, BIGINT)
  FROM anon, authenticated, PUBLIC;

COMMIT;
