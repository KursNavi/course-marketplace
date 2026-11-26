-- =====================================================================
-- ENTWURF (nicht angewendet): nachrangige Präfixtreffer im Textabruf
-- Stand 23.11.2026, Abrufprüfung Punkt 3 (fehlender Fotokurs 20588).
--
-- Befund: „fotografieren“ wird zum Stamm 'fotografi', „fotografisches“ zu
-- 'fotograf'. websearch_to_tsquery in ai_search_lexical kennt keine Präfixe,
-- deshalb findet „fotografieren“ den Kurs „Bildgestaltung und Bildkomposition“
-- (Text: „fotografisches Sehen“, „Fotokurs“) nicht.
--
-- Kleinste Korrektur:
--   * NEUE Funktion ai_search_lexical_prefix (die bestehende ai_search_lexical
--     bleibt unverändert und wird weiter genutzt, bis der Client umgestellt ist).
--   * Präfix nur für lange Stämme (mindestens 8 Zeichen), um ein Zeichen
--     gekürzt: 'fotografi' → 'fotograf:*'. Kurze Stämme ('beruf', 'nach')
--     verbreiterten die Treffer in der Messung um das Zwei- bis Dreifache.
--   * Präfix-Treffer sind NACHRANGIG: erst alle exakten Treffer (wie bisher
--     nach ts_rank), danach Kurse, die nur über das Präfix passen. Ein
--     Präfixtreffer kann so keinen exakten Treffer verdrängen.
--   * Gleiche Regeln wie ai_search_lexical: bester Abschnitt je Kurs VOR dem
--     Limit, Limit begrenzt Kurse, kein Zugriff für anon/authenticated.
--
-- Messung auf dem öffentlichen Katalog (697 Kurse, Abschnittstexte):
--   de-privat-002 „fotografieren“: 33 exakte + 4 nachrangige Treffer, darunter
--   20588; simulierter Rang nach Zusammenführung 33 → 22 (an Luna).
--   Breiteste Wirkung: de-kinder-002 73 → 107 („programm:*“ trifft das
--   allgemeine Wort „Programm“) – nur nachrangig, verdrängt keinen exakten Treffer.
-- =====================================================================

CREATE OR REPLACE FUNCTION ai_search_prefix_query(p_terms TEXT[])
RETURNS TSQUERY
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Nur Buchstabenstämme ab 8 Zeichen; ohne geeigneten Stamm: NULL.
  SELECT to_tsquery('simple', string_agg(left(st, length(st) - 1) || ':*', ' | '))
  FROM (
    SELECT (ts_lexize('german_stem', lower(t)))[1] AS st
    FROM unnest(coalesce(p_terms, '{}'::text[])) AS t
  ) s
  WHERE st IS NOT NULL AND length(st) >= 8 AND st ~ '^[[:alpha:]]+$';
$$;

CREATE OR REPLACE FUNCTION ai_search_lexical_prefix(p_query TEXT, p_terms TEXT[], p_limit INTEGER DEFAULT 100)
RETURNS TABLE (course_id BIGINT, rank REAL, best_section TEXT, best_chunk_index INTEGER, prefix_only BOOLEAN)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('german', p_query) AS exact_q,
           ai_search_prefix_query(p_terms) AS prefix_q
  ),
  exact_hits AS (
    SELECT DISTINCT ON (c.course_id)
           c.course_id, ts_rank(c.tsv, q.exact_q) AS rank, c.section, c.chunk_index
    FROM ai_search_chunks c, q
    WHERE c.tsv @@ q.exact_q
    ORDER BY c.course_id, ts_rank(c.tsv, q.exact_q) DESC, c.chunk_index
  ),
  prefix_hits AS (
    SELECT DISTINCT ON (c.course_id)
           c.course_id, ts_rank(c.tsv, q.prefix_q) AS rank, c.section, c.chunk_index
    FROM ai_search_chunks c, q
    WHERE q.prefix_q IS NOT NULL
      AND c.tsv @@ q.prefix_q
      AND NOT EXISTS (SELECT 1 FROM exact_hits e WHERE e.course_id = c.course_id)
    ORDER BY c.course_id, ts_rank(c.tsv, q.prefix_q) DESC, c.chunk_index
  )
  SELECT course_id, rank, section, chunk_index, prefix_only
  FROM (
    SELECT e.course_id, e.rank, e.section, e.chunk_index, FALSE AS prefix_only FROM exact_hits e
    UNION ALL
    SELECT p.course_id, p.rank, p.section, p.chunk_index, TRUE AS prefix_only FROM prefix_hits p
  ) a
  ORDER BY prefix_only, rank DESC, course_id
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION ai_search_prefix_query(TEXT[]) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION ai_search_lexical_prefix(TEXT, TEXT[], INTEGER) FROM anon, authenticated, PUBLIC;
