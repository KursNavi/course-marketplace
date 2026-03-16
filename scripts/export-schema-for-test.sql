-- =============================================================================
-- SCHEMA-EXPORT FÜR TESTPROJEKT — TEIL 1: ENUMS + SEQUENCES + TABELLEN + CONSTRAINTS
-- =============================================================================
-- ✓ READ-ONLY — ändert NICHTS an deiner Datenbank
-- ✓ Sicher im PRODUKTIONS-SQL-Editor auszuführen
--
-- ANLEITUNG:
--   1. Öffne PRODUKTIONS-Dashboard → SQL Editor → "New query"
--   2. Kopiere dieses Script hinein
--   3. Klicke "Run"
--   4. In der Ergebnis-Tabelle siehst du EINE Zeile mit EINER Spalte "full_schema"
--   5. Klicke auf die Zelle — der vollständige Text wird angezeigt
--   6. Kopiere den gesamten Inhalt dieser Zelle
--   7. Öffne das TEST-Dashboard → SQL Editor → "New query"
--   8. Füge den kopierten Text ein und klicke "Run"
--
-- WICHTIG: Falls der Text in der Zelle abgeschnitten aussieht,
-- klicke doppelt auf die Zelle oder nutze den "Download CSV"-Button
-- (oben rechts in der Ergebnis-Tabelle) und öffne die CSV-Datei.
-- =============================================================================

WITH
-- Teil 0: ENUM Types (müssen VOR den Tabellen existieren)
enum_ddl AS (
  SELECT
    'DO $$ BEGIN CREATE TYPE ' || t.typname || ' AS ENUM ('
    || string_agg(
        '''' || e.enumlabel || '''',
        ', ' ORDER BY e.enumsortorder
       )
    || '); EXCEPTION WHEN duplicate_object THEN NULL; END $$;' AS ddl,
    0 AS sort_key,
    t.typname AS sort_name
  FROM pg_catalog.pg_type t
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = 'public'
  GROUP BY t.typname
),

-- Teil 0b: SEQUENCES (müssen VOR den Tabellen existieren, da DEFAULT nextval() darauf verweist)
seq_ddl AS (
  SELECT
    'CREATE SEQUENCE IF NOT EXISTS public.' || s.sequencename
    || ' AS ' || s.data_type
    || ' INCREMENT BY ' || s.increment_by
    || ' MINVALUE ' || s.min_value
    || ' MAXVALUE ' || s.max_value
    || ' START WITH ' || s.start_value
    || CASE WHEN s.cycle THEN ' CYCLE' ELSE ' NO CYCLE' END
    || ';' AS ddl,
    1 AS sort_key,
    s.sequencename AS sort_name
  FROM pg_sequences s
  WHERE s.schemaname = 'public'
),

-- Teil A: CREATE TABLE Statements (Spalten, Typen, Defaults, NOT NULL)
tables_ddl AS (
  SELECT
    'CREATE TABLE IF NOT EXISTS public.' || c.relname || ' (' ||
    string_agg(
      E'\n  ' || quote_ident(a.attname) || ' ' ||
      pg_catalog.format_type(a.atttypid, a.atttypmod) ||
      CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
      COALESCE(' DEFAULT ' || pg_catalog.pg_get_expr(d.adbin, d.adrelid), ''),
      ','
      ORDER BY a.attnum
    ) ||
    E'\n);' AS ddl,
    2 AS sort_key,
    c.relname AS sort_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attnum > 0
    AND NOT a.attisdropped
  GROUP BY c.relname
),

-- Teil B: PRIMARY KEY Constraints
pk_ddl AS (
  SELECT
    'DO $$ BEGIN '
    || 'ALTER TABLE public.' || tc.table_name
    || ' ADD CONSTRAINT ' || tc.constraint_name
    || ' PRIMARY KEY (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
    || '); EXCEPTION WHEN duplicate_object THEN NULL; END $$;' AS ddl,
    3 AS sort_key,
    tc.table_name AS sort_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
  GROUP BY tc.table_name, tc.constraint_name
),

-- Teil C: UNIQUE Constraints
unique_ddl AS (
  SELECT
    'DO $$ BEGIN '
    || 'ALTER TABLE public.' || tc.table_name
    || ' ADD CONSTRAINT ' || tc.constraint_name
    || ' UNIQUE (' || string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
    || '); EXCEPTION WHEN duplicate_object THEN NULL; END $$;' AS ddl,
    4 AS sort_key,
    tc.table_name AS sort_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
  GROUP BY tc.table_name, tc.constraint_name
),

-- Teil D: FOREIGN KEY Constraints
fk_ddl AS (
  SELECT
    'DO $$ BEGIN '
    || 'ALTER TABLE public.' || tc.table_name
    || ' ADD CONSTRAINT ' || tc.constraint_name
    || ' FOREIGN KEY (' || kcu.column_name || ') REFERENCES '
    || CASE WHEN ccu.table_schema = 'public' THEN 'public.' ELSE ccu.table_schema || '.' END
    || ccu.table_name || '(' || ccu.column_name || ')'
    || CASE
         WHEN rc.delete_rule = 'CASCADE' THEN ' ON DELETE CASCADE'
         WHEN rc.delete_rule = 'SET NULL' THEN ' ON DELETE SET NULL'
         WHEN rc.delete_rule = 'SET DEFAULT' THEN ' ON DELETE SET DEFAULT'
         ELSE ''
       END
    || '; EXCEPTION WHEN duplicate_object THEN NULL; END $$;' AS ddl,
    5 AS sort_key,
    tc.table_name AS sort_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
),

-- Teil E: CHECK Constraints (ohne system-generierte NOT NULL checks)
check_ddl AS (
  SELECT
    'DO $$ BEGIN '
    || 'ALTER TABLE public.' || tc.table_name
    || ' ADD CONSTRAINT ' || tc.constraint_name
    || ' CHECK (' || cc.check_clause || ')'
    || '; EXCEPTION WHEN duplicate_object THEN NULL; END $$;' AS ddl,
    6 AS sort_key,
    tc.table_name AS sort_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
  WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
    -- Exclude auto-generated NOT NULL checks
    AND cc.check_clause NOT LIKE '%IS NOT NULL%'
)

-- Alles zusammenfassen in einem einzigen Text
SELECT string_agg(ddl, E'\n' ORDER BY sort_key, sort_name) AS full_schema
FROM (
  SELECT * FROM enum_ddl
  UNION ALL SELECT * FROM seq_ddl
  UNION ALL SELECT * FROM tables_ddl
  UNION ALL SELECT * FROM pk_ddl
  UNION ALL SELECT * FROM unique_ddl
  UNION ALL SELECT * FROM fk_ddl
  UNION ALL SELECT * FROM check_ddl
) combined;
