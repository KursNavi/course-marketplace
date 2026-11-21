-- RÜCKWEG zum Entwurf 20261122090000_ai_search_ops_lease_v2.
-- Vorher den Zeitplan-Entwurf 20261122090100 zurücknehmen (falls
-- angewendet), sonst ruft pg_cron eine entfernte Funktion auf.
-- Entfernt ausschliesslich die neuen Objekte; bestehende Tabellen und
-- Funktionen (Index, Jobs, Ergebnisse) bleiben unverändert. Das
-- Laufprotokoll ai_search_ops_runs geht dabei verloren.
DROP FUNCTION IF EXISTS public.ai_search_ops_cleanup_tick(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.ai_search_ops_fenced_cleanup(BIGINT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.ai_search_ops_fenced_store_embeddings(BIGINT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.ai_search_ops_fenced_enqueue(BIGINT, UUID, BIGINT[], INTEGER);
DROP FUNCTION IF EXISTS public.ai_search_ops_fenced_job_failure(BIGINT, UUID, BIGINT[], INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.ai_search_ops_fenced_apply_delete(BIGINT, UUID, BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.ai_search_ops_fenced_apply_upsert(BIGINT, UUID, BIGINT, BIGINT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.ai_search_ops_assert_lease(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.ai_search_ops_lease_release(BIGINT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.ai_search_ops_request_abort(BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.ai_search_ops_lease_renew(BIGINT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.ai_search_ops_lease_acquire(UUID, TEXT[], INTEGER, INTEGER);
DROP TABLE IF EXISTS public.ai_search_ops_runs;
