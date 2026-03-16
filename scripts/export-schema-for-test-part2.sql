-- =============================================================================
-- SCHEMA-EXPORT FÜR TESTPROJEKT — TEIL 2: FUNCTIONS, VIEWS, RLS, INDEXES, etc.
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
-- REIHENFOLGE: Dieses Script NACH Teil 1 (Tabellen) ausführen!
--
-- Jedes Statement ist einzeln in einen Exception-Handler gewrappt,
-- damit ein Fehler nicht die restliche Ausführung blockiert.
-- Übersprungene Objekte werden als NOTICE geloggt.
--
-- WICHTIG: Falls der Text in der Zelle abgeschnitten aussieht,
-- klicke doppelt auf die Zelle oder nutze den "Download CSV"-Button
-- (oben rechts in der Ergebnis-Tabelle) und öffne die CSV-Datei.
-- =============================================================================

WITH
-- Teil A: Functions (inkl. source code)
func_ddl AS (
  SELECT
    'DO $__wrap__$ BEGIN EXECUTE '
    || quote_literal(pg_catalog.pg_get_functiondef(p.oid))
    || '; EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped function '
    || p.proname
    || ': %'', SQLERRM; END; $__wrap__$;' AS ddl,
    1 AS sort_key,
    p.proname AS sort_name
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p')
),

-- Teil B: Regular Views
view_ddl AS (
  SELECT
    'DO $__wrap__$ BEGIN EXECUTE '
    || quote_literal(
        'CREATE OR REPLACE VIEW public.' || c.relname || ' AS '
        || pg_catalog.pg_get_viewdef(c.oid, true)
       )
    || '; EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped view '
    || c.relname
    || ': %'', SQLERRM; END; $__wrap__$;' AS ddl,
    2 AS sort_key,
    c.relname AS sort_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
),

-- Teil C: Materialized Views
matview_ddl AS (
  SELECT
    'DO $__wrap__$ BEGIN EXECUTE '
    || quote_literal(
        'CREATE MATERIALIZED VIEW IF NOT EXISTS public.' || c.relname || ' AS '
        || pg_catalog.pg_get_viewdef(c.oid, true)
       )
    || '; EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped matview '
    || c.relname
    || ': %'', SQLERRM; END; $__wrap__$;' AS ddl,
    3 AS sort_key,
    c.relname AS sort_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'm'
),

-- Teil D: Indexes (nur benutzerdefinierte, keine PK/UNIQUE die schon in Teil 1 sind)
index_ddl AS (
  SELECT
    'DO $__wrap__$ BEGIN EXECUTE '
    || quote_literal(pg_catalog.pg_get_indexdef(i.indexrelid))
    || '; EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped index '
    || ic.relname
    || ': %'', SQLERRM; END; $__wrap__$;' AS ddl,
    4 AS sort_key,
    ic.relname AS sort_name
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_catalog.pg_class tc ON tc.oid = i.indrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = tc.relnamespace
  WHERE n.nspname = 'public'
    AND NOT i.indisprimary
    AND NOT i.indisunique
    AND ic.relname NOT LIKE 'pg_%'
),

-- Teil E: Triggers (nur auf public-Tabellen)
trigger_ddl AS (
  SELECT
    'DO $__wrap__$ BEGIN EXECUTE '
    || quote_literal(pg_catalog.pg_get_triggerdef(t.oid))
    || '; EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped trigger on '
    || c.relname
    || ': %'', SQLERRM; END; $__wrap__$;' AS ddl,
    5 AS sort_key,
    c.relname AS sort_name
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
),

-- Teil F: RLS Enable
rls_enable_ddl AS (
  SELECT
    'ALTER TABLE public.' || c.relname || ' ENABLE ROW LEVEL SECURITY;' AS ddl,
    6 AS sort_key,
    c.relname AS sort_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
),

-- Teil G: RLS Policies
policy_ddl AS (
  SELECT
    'DO $__wrap__$ BEGIN EXECUTE '
    || quote_literal(
        'CREATE POLICY ' || quote_ident(pol.polname) || ' ON public.' || c.relname
        || ' AS ' || CASE pol.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END
        || ' FOR ' || CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
           END
        || ' TO ' || CASE
            WHEN pol.polroles = '{0}' THEN 'public'
            ELSE (
              SELECT string_agg(
                CASE WHEN r.rolname IS NOT NULL THEN r.rolname ELSE role_oid::text END,
                ', '
              )
              FROM unnest(pol.polroles) AS role_oid
              LEFT JOIN pg_catalog.pg_roles r ON r.oid = role_oid
            )
           END
        || CASE WHEN pol.polqual IS NOT NULL
            THEN ' USING (' || pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) || ')'
            ELSE ''
           END
        || CASE WHEN pol.polwithcheck IS NOT NULL
            THEN ' WITH CHECK (' || pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) || ')'
            ELSE ''
           END
       )
    || '; EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped policy '
    || pol.polname || ' on ' || c.relname
    || ': %'', SQLERRM; END; $__wrap__$;' AS ddl,
    7 AS sort_key,
    c.relname || '/' || pol.polname AS sort_name
  FROM pg_catalog.pg_policy pol
  JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
),

-- Teil H: Trigger auf auth.users (Sonderbehandlung)
auth_trigger_ddl AS (
  SELECT
    'DO $__wrap__$ BEGIN'
    || ' EXECUTE ''DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users'';'
    || ' EXECUTE ''CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users'
    || ' FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()'';'
    || ' EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped auth trigger: %'', SQLERRM;'
    || ' END; $__wrap__$;' AS ddl,
    8 AS sort_key,
    'zzz_auth_trigger' AS sort_name
),

-- Teil I: Materialized View Refresh (muss am Ende kommen)
matview_refresh AS (
  SELECT
    'DO $__wrap__$ BEGIN EXECUTE '
    || quote_literal('REFRESH MATERIALIZED VIEW public.' || c.relname)
    || '; EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Skipped refresh '
    || c.relname
    || ': %'', SQLERRM; END; $__wrap__$;' AS ddl,
    9 AS sort_key,
    c.relname AS sort_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'm'
)

-- Alles zusammenfassen in einem einzigen Text
SELECT string_agg(ddl, E'\n' ORDER BY sort_key, sort_name) AS full_schema
FROM (
  SELECT * FROM func_ddl
  UNION ALL SELECT * FROM view_ddl
  UNION ALL SELECT * FROM matview_ddl
  UNION ALL SELECT * FROM index_ddl
  UNION ALL SELECT * FROM trigger_ddl
  UNION ALL SELECT * FROM rls_enable_ddl
  UNION ALL SELECT * FROM policy_ddl
  UNION ALL SELECT * FROM auth_trigger_ddl
  UNION ALL SELECT * FROM matview_refresh
) combined;
