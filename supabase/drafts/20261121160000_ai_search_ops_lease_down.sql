-- RÜCKWEG zum Entwurf 20261121160000_ai_search_ops_lease.
-- NUR nach ausdrücklicher Freigabe ausführen. Entfernt ausschliesslich die
-- Laufsperre und das Laufprotokoll; Index-, Kontingent- und Quelldaten
-- bleiben unberührt. Das Laufprotokoll geht dabei verloren.

DROP FUNCTION IF EXISTS public.ai_search_ops_lease_release(BIGINT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.ai_search_ops_lease_acquire(UUID, TEXT[], INTEGER);
DROP TABLE IF EXISTS public.ai_search_ops_runs;
