-- KI-Suche Phase 1: Vektorspalte fuer semantischen Abruf (exakte Suche, kein ANN).
--
-- GATE: Erst anwenden, nachdem auf dem ZIELPROJEKT (zuerst Testprojekt, E5)
-- verifiziert wurde, dass die pgvector-Erweiterung in unterstuetzter Version
-- verfuegbar ist. Diese Datei ist vorbereitet und NICHT angewendet.
--
-- Pilotentscheidung (docs/ai-search/indexdesign.md):
--  * exakte Vektorsuche (sequentieller Scan) statt HNSW/IVF — bei der aktuellen
--    Kataloggroessenordnung vollstaendig und schnell genug; ANN erst bei Bedarf
--    und dann mit Recall-Messung gegen diese exakte Referenz.
--  * Dimension 1024 ist ein Platzhalter fuer die Evaluation (E3) und wird vor
--    Anwendung auf das gewaehlte Embeddingmodell gesetzt.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE ai_search_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Exakter semantischer Abruf ueber den GESAMTEN Index der aktiven Modellversion.
-- Kein Index auf embedding: exakte Referenzsuche ist im Pilot gewollt.
CREATE OR REPLACE FUNCTION ai_search_semantic(
  p_embedding vector(1024),
  p_model_version TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (course_id BIGINT, distance REAL, section TEXT, chunk_index INTEGER)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.course_id,
         (c.embedding <=> p_embedding)::REAL AS distance,
         c.section,
         c.chunk_index
  FROM ai_search_chunks c
  WHERE c.embedding IS NOT NULL
    AND c.model_version = p_model_version
  ORDER BY c.embedding <=> p_embedding, c.course_id, c.chunk_index
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION ai_search_semantic(vector, TEXT, INTEGER)
  FROM anon, authenticated, PUBLIC;

COMMIT;
