-- Rückweg zum ENTWURF 20261124090000 (nachrangige Präfixtreffer).
-- Entfernt nur die zwei neuen Funktionen; ai_search_lexical bleibt unberührt.
DROP FUNCTION IF EXISTS ai_search_lexical_prefix(TEXT, TEXT[], INTEGER);
DROP FUNCTION IF EXISTS ai_search_prefix_query(TEXT[]);
