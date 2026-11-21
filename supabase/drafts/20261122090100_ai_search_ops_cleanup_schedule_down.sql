-- RÜCKWEG zum Entwurf 20261122090100_ai_search_ops_cleanup_schedule.
-- Entfernt nur den eigenen Job. Die Erweiterung pg_cron wird nur entfernt,
-- wenn danach kein anderer Job mehr eingeplant ist.
DO $down$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-search-ops-cleanup') THEN
      PERFORM cron.unschedule('ai-search-ops-cleanup');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job) THEN
      DROP EXTENSION IF EXISTS pg_cron;
    END IF;
  END IF;
END
$down$;
