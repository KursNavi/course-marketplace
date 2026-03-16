-- =============================================================================
-- SCHEMA-EXPORT FÜR TESTPROJEKT — TEIL 3: TAXONOMIE-STAMMDATEN
-- =============================================================================
-- ✓ READ-ONLY — ändert NICHTS an deiner Datenbank
-- ✓ Sicher im PRODUKTIONS-SQL-Editor auszuführen
--
-- ANLEITUNG:
--   1. Öffne PRODUKTIONS-Dashboard → SQL Editor → "New query"
--   2. Kopiere dieses Script hinein
--   3. Klicke "Run"
--   4. In der Ergebnis-Tabelle siehst du EINE Zeile mit EINER Spalte "full_data"
--   5. Klicke auf die Zelle — der vollständige Text wird angezeigt
--   6. Kopiere den gesamten Inhalt dieser Zelle
--   7. Öffne das TEST-Dashboard → SQL Editor → "New query"
--   8. Füge den kopierten Text ein und klicke "Run"
--
-- REIHENFOLGE: Dieses Script NACH Teil 1 + Teil 2 ausführen!
-- Es werden NUR die Taxonomie-Stammdaten exportiert (Kategorienamen etc.)
-- KEINE Benutzerdaten, KEINE Kurse, KEINE persönlichen Informationen.
--
-- WICHTIG: Falls der Text in der Zelle abgeschnitten aussieht,
-- nutze den "Download CSV"-Button und öffne die CSV-Datei.
-- =============================================================================

WITH
-- Level 1 (oberste Ebene: z.B. "Beruflich", "Privat & Hobby")
level1_inserts AS (
  SELECT
    'INSERT INTO public.taxonomy_level1 (id, slug, label_de, label_en, label_fr, label_it, icon, sort_order, is_active) VALUES ('
    || id || ', '
    || quote_literal(slug) || ', '
    || quote_literal(label_de) || ', '
    || COALESCE(quote_literal(label_en), 'NULL') || ', '
    || COALESCE(quote_literal(label_fr), 'NULL') || ', '
    || COALESCE(quote_literal(label_it), 'NULL') || ', '
    || COALESCE(quote_literal(icon), 'NULL') || ', '
    || COALESCE(sort_order::text, '0') || ', '
    || is_active
    || ') ON CONFLICT (id) DO NOTHING;' AS ddl,
    1 AS sort_key,
    id AS sort_id
  FROM public.taxonomy_level1
),

-- Level 2 (z.B. "Sport & Fitness Berufsausbildung")
level2_inserts AS (
  SELECT
    'INSERT INTO public.taxonomy_level2 (id, level1_id, slug, label_de, label_en, label_fr, label_it, icon, sort_order, is_active) VALUES ('
    || id || ', '
    || level1_id || ', '
    || COALESCE(quote_literal(slug), 'NULL') || ', '
    || quote_literal(label_de) || ', '
    || COALESCE(quote_literal(label_en), 'NULL') || ', '
    || COALESCE(quote_literal(label_fr), 'NULL') || ', '
    || COALESCE(quote_literal(label_it), 'NULL') || ', '
    || COALESCE(quote_literal(icon), 'NULL') || ', '
    || COALESCE(sort_order::text, '0') || ', '
    || is_active
    || ') ON CONFLICT (id) DO NOTHING;' AS ddl,
    2 AS sort_key,
    id AS sort_id
  FROM public.taxonomy_level2
),

-- Level 3 (z.B. "Fitnesstrainer")
level3_inserts AS (
  SELECT
    'INSERT INTO public.taxonomy_level3 (id, level2_id, slug, label_de, label_en, label_fr, label_it, sort_order, is_active) VALUES ('
    || id || ', '
    || level2_id || ', '
    || COALESCE(quote_literal(slug), 'NULL') || ', '
    || quote_literal(label_de) || ', '
    || COALESCE(quote_literal(label_en), 'NULL') || ', '
    || COALESCE(quote_literal(label_fr), 'NULL') || ', '
    || COALESCE(quote_literal(label_it), 'NULL') || ', '
    || COALESCE(sort_order::text, '0') || ', '
    || is_active
    || ') ON CONFLICT (id) DO NOTHING;' AS ddl,
    3 AS sort_key,
    id AS sort_id
  FROM public.taxonomy_level3
),

-- Level 4 (z.B. "Personal Trainer Zertifikat")
level4_inserts AS (
  SELECT
    'INSERT INTO public.taxonomy_level4 (id, level3_id, slug, label_de, label_en, label_fr, label_it, sort_order, is_active) VALUES ('
    || id || ', '
    || level3_id || ', '
    || COALESCE(quote_literal(slug), 'NULL') || ', '
    || quote_literal(label_de) || ', '
    || COALESCE(quote_literal(label_en), 'NULL') || ', '
    || COALESCE(quote_literal(label_fr), 'NULL') || ', '
    || COALESCE(quote_literal(label_it), 'NULL') || ', '
    || COALESCE(sort_order::text, '0') || ', '
    || is_active
    || ') ON CONFLICT (id) DO NOTHING;' AS ddl,
    4 AS sort_key,
    id AS sort_id
  FROM public.taxonomy_level4
),

-- Sequences auf den aktuellen Max-Wert setzen
seq_reset AS (
  SELECT 'SELECT setval(''taxonomy_level1_id_seq'', COALESCE((SELECT MAX(id) FROM taxonomy_level1), 0) + 1, false);'
    || E'\n' || 'SELECT setval(''taxonomy_level2_id_seq'', COALESCE((SELECT MAX(id) FROM taxonomy_level2), 0) + 1, false);'
    || E'\n' || 'SELECT setval(''taxonomy_level3_id_seq'', COALESCE((SELECT MAX(id) FROM taxonomy_level3), 0) + 1, false);'
    || E'\n' || 'SELECT setval(''taxonomy_level4_id_seq'', COALESCE((SELECT MAX(id) FROM taxonomy_level4), 0) + 1, false);'
    AS ddl,
    5 AS sort_key,
    0 AS sort_id
),

-- Am Ende: Materialized View refreshen damit die Paths aktuell sind
refresh_mv AS (
  SELECT
    'REFRESH MATERIALIZED VIEW public.v_taxonomy_paths;' AS ddl,
    6 AS sort_key,
    0 AS sort_id
)

SELECT string_agg(ddl, E'\n' ORDER BY sort_key, sort_id) AS full_data
FROM (
  SELECT * FROM level1_inserts
  UNION ALL SELECT * FROM level2_inserts
  UNION ALL SELECT * FROM level3_inserts
  UNION ALL SELECT * FROM level4_inserts
  UNION ALL SELECT * FROM seq_reset
  UNION ALL SELECT * FROM refresh_mv
) combined;
