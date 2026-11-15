-- KI-Suche Phase 1: Projektion, Chunks, Jobs (Outbox) und Lexikalik.
--
-- WICHTIG: Diese Migration ist vorbereitet, aber noch NICHT angewendet.
-- Anwendung zuerst auf dem verifizierten Supabase-TESTprojekt (Freigabe E5),
-- niemals direkt in Produktion. Sie ändert keine bestehenden Tabellen,
-- Policies oder Trigger ausser den hier neu angelegten.
--
-- Vertrag: docs/ai-search/datenvertrag.md
--  * Öffentlich durchsuchbar ist ausschliesslich courses.status = 'published'.
--    Die RLS der Kerntabellen erzwingt das bewusst nicht (Direkt-URL-Vorschau),
--    deshalb filtert die Projektion selbst und die Such-API prüft vor Ausgabe.
--  * contact_email und sämtliche Lead-/Paket-Interna gehören NICHT hierher.
--  * ai_search_* ist nur serverseitig (service_role) zugreifbar.

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------------------------------------------------------------------------
-- Konfiguration (eine Zeile; aktive Embedding-Modellversion u. a.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_search_config (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_model_version  TEXT,            -- NULL = noch kein Embeddingmodell aktiv
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ai_search_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Dokumentprojektion: genau eine Zeile je oeffentlich durchsuchbarem Kurs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_search_documents (
  course_id          BIGINT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  -- Publikationsregel streng: nur 'published'. status IS NULL wird NICHT
  -- aufgenommen (Nachweis am Bestand steht aus; Reconciliation zaehlt NULL).
  title              TEXT NOT NULL,
  description_clean  TEXT NOT NULL DEFAULT '',
  -- Strukturierte, oeffentlich zulaessige Kriterien als dokumentierter Block.
  -- Quelle je Feld: Tabelle.Spalte; Aufbau siehe Datenvertrag §2/§5.
  facts              JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_status       TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (price_status IN ('unknown','free','fixed','from','per_unit','info_text')),
  price_amount       NUMERIC,
  -- Versionierung gegen Out-of-order-Overwrites:
  content_hash       TEXT NOT NULL,
  source_version     BIGINT NOT NULL,
  source_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  indexed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lexikalik ueber Titel + Kernfelder (Chunks tragen den Volltext):
  tsv                TSVECTOR GENERATED ALWAYS AS (
                       setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('german', coalesce(description_clean, '')), 'B')
                     ) STORED
);

CREATE INDEX IF NOT EXISTS ai_search_documents_tsv_idx
  ON ai_search_documents USING gin (tsv);

-- ---------------------------------------------------------------------------
-- Chunks: ueberlappende Abschnitte ALLER Textfelder, keine Laengenobergrenze
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_search_chunks (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id          BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section            TEXT NOT NULL,     -- z. B. 'description', 'objectives', 'prerequisites'
  chunk_index        INTEGER NOT NULL,  -- Reihenfolge innerhalb der Section
  char_start         INTEGER NOT NULL,  -- Nachweis vollstaendiger Abdeckung
  char_end           INTEGER NOT NULL,
  text               TEXT NOT NULL,
  content_hash       TEXT NOT NULL,
  source_version     BIGINT NOT NULL,
  -- Embedding ist bewusst getrennt befuellbar (Backfill-Stufe 2) und je
  -- Modellversion gehalten; Umschaltung via ai_search_config.
  model_version      TEXT,
  -- Vektortyp folgt in der separaten pgvector-Migration; hier Platzhalterfrei.
  tsv                TSVECTOR GENERATED ALWAYS AS (
                       to_tsvector('german', coalesce(text, ''))
                     ) STORED,
  UNIQUE (course_id, section, chunk_index)
);

CREATE INDEX IF NOT EXISTS ai_search_chunks_tsv_idx
  ON ai_search_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS ai_search_chunks_course_idx
  ON ai_search_chunks (course_id);

-- ---------------------------------------------------------------------------
-- Outbox: idempotente, versionierte Aenderungsjobs
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS ai_search_source_version_seq;

CREATE TABLE IF NOT EXISTS ai_search_jobs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id       BIGINT NOT NULL,
  reason          TEXT NOT NULL CHECK (reason IN (
                    'course_upsert','course_delete','event_change',
                    'location_change','category_change','profile_change',
                    'backfill','reconciliation'
                  )),
  -- Rücknahmen (unpublish/delete) laufen mit hoher Prioritaet zuerst.
  priority        SMALLINT NOT NULL DEFAULT 5,
  source_version  BIGINT NOT NULL DEFAULT nextval('ai_search_source_version_seq'),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','done','failed')),
  attempts        SMALLINT NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_search_jobs_pending_idx
  ON ai_search_jobs (status, priority, id)
  WHERE status IN ('pending','failed');

-- ---------------------------------------------------------------------------
-- Trigger auf den Quelltabellen: nur Job einreihen, keine Logik im Trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_search_enqueue_course_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- Publish/Unpublish: Ruecknahme hat Vorrang.
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
$$;

DROP TRIGGER IF EXISTS ai_search_courses_outbox ON courses;
CREATE TRIGGER ai_search_courses_outbox
  AFTER INSERT OR UPDATE OR DELETE ON courses
  FOR EACH ROW EXECUTE FUNCTION ai_search_enqueue_course_job();

DROP TRIGGER IF EXISTS ai_search_course_events_outbox ON course_events;
CREATE TRIGGER ai_search_course_events_outbox
  AFTER INSERT OR UPDATE OR DELETE ON course_events
  FOR EACH ROW EXECUTE FUNCTION ai_search_enqueue_course_job();

DROP TRIGGER IF EXISTS ai_search_course_locations_outbox ON course_locations;
CREATE TRIGGER ai_search_course_locations_outbox
  AFTER INSERT OR UPDATE OR DELETE ON course_locations
  FOR EACH ROW EXECUTE FUNCTION ai_search_enqueue_course_job();

-- Kategorien-/Profilaenderungen werden im Pilot ueber die taegliche
-- Reconciliation erfasst (geringe Aenderungsrate); eigene Trigger folgen,
-- falls die Frischemessung es verlangt.

-- ---------------------------------------------------------------------------
-- Rechte: ausschliesslich serverseitig (service_role). Kein anon/authenticated.
-- ---------------------------------------------------------------------------
ALTER TABLE ai_search_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_search_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_search_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_search_jobs      ENABLE ROW LEVEL SECURITY;

-- Bewusst KEINE Policies fuer anon/authenticated: ohne Policy kein Zugriff.
REVOKE ALL ON ai_search_config, ai_search_documents, ai_search_chunks, ai_search_jobs
  FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lexikalische Suche ueber den GESAMTEN Index (Fallback-Kanal der Hybridsuche)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_search_lexical(p_query TEXT, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (course_id BIGINT, rank REAL, best_section TEXT, best_chunk_index INTEGER)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- websearch_to_tsquery: robust gegen Rohtext.
  -- WICHTIG: Chunktreffer werden VOR dem Limit auf Kursebene zusammengefuehrt
  -- (bester Chunk je Kurs). Das Limit begrenzt KURSE, nicht Chunks — ein
  -- einzelner langer Kurs mit vielen Treffern darf anderen passenden Kursen
  -- keine Kandidatenplaetze wegnehmen; Textlaenge allein ist kein Vorteil.
  WITH hits AS (
    SELECT c.course_id,
           ts_rank(c.tsv, websearch_to_tsquery('german', p_query)) AS rank,
           c.section,
           c.chunk_index
    FROM ai_search_chunks c
    WHERE c.tsv @@ websearch_to_tsquery('german', p_query)
  ),
  best_per_course AS (
    SELECT DISTINCT ON (h.course_id)
           h.course_id, h.rank, h.section, h.chunk_index
    FROM hits h
    ORDER BY h.course_id, h.rank DESC, h.chunk_index
  )
  SELECT b.course_id, b.rank, b.section, b.chunk_index
  FROM best_per_course b
  ORDER BY b.rank DESC, b.course_id
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION ai_search_lexical(TEXT, INTEGER) FROM anon, authenticated, PUBLIC;

COMMIT;
