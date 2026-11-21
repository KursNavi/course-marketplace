-- =====================================================================
-- RÜCKWEG zur Migration
--   supabase/migrations/20261121122101_ai_search_result_store_and_guard.sql
-- (bis 21.11.2026 Entwurf 20261121090000; auf der TESTumgebung verbucht als
-- 20261121122101). NUR nach ausdrücklicher Freigabe ausführen; danach den
-- Eintrag in supabase_migrations.schema_migrations entsprechend bereinigen. Entfernt Ergebnisspeicher und
-- Bremse; ai_search_quota_reserve erhält wieder die Fassung aus
-- 20261113180200_ai_search_quota.sql. Gespeicherte Ergebnisse gehen dabei
-- verloren (gewollt: befristete Kopien); Kontingentdaten bleiben unverändert.
-- =====================================================================

DROP FUNCTION IF EXISTS public.ai_search_result_purge_user(UUID);
DROP FUNCTION IF EXISTS public.ai_search_result_cleanup(INTEGER);
DROP FUNCTION IF EXISTS public.ai_search_result_fetch(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.ai_search_quota_finalize_and_store(UUID, UUID, TEXT, JSONB, INTEGER);
DROP TABLE IF EXISTS public.ai_search_results;
DROP INDEX IF EXISTS public.ai_search_usage_user_created_idx;

CREATE OR REPLACE FUNCTION public.ai_search_quota_reserve(
  p_user_id UUID,
  p_request_id UUID,
  p_query_hash TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month TEXT := ai_search_month_key();
  v_row ai_search_usage%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_month, 0));

  SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_row.user_id IS DISTINCT FROM p_user_id
       OR v_row.query_hash IS DISTINCT FROM p_query_hash THEN
      RETURN 'request_mismatch';
    END IF;
    RETURN 'already_' || v_row.state;
  END IF;

  IF ai_search_quota_used(p_user_id, v_month) >= p_limit THEN
    RETURN 'limit_reached';
  END IF;

  BEGIN
    INSERT INTO ai_search_usage (user_id, month_key, request_id, query_hash)
    VALUES (p_user_id, v_month, p_request_id, p_query_hash);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_row FROM ai_search_usage WHERE request_id = p_request_id;
    IF v_row.user_id IS DISTINCT FROM p_user_id
       OR v_row.query_hash IS DISTINCT FROM p_query_hash THEN
      RETURN 'request_mismatch';
    END IF;
    RETURN 'already_' || v_row.state;
  END;

  RETURN 'reserved';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ai_search_quota_reserve(UUID, UUID, TEXT, INTEGER) FROM anon, authenticated, PUBLIC;
