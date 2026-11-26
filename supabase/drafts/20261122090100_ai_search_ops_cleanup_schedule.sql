-- =====================================================================
-- ENTWURF – NICHT ANWENDEN ohne ausdrückliche Freigabe (Stand 22.11.2026).
-- SCHALTER für die zeitgesteuerte Ergebnislöschung (TESTumgebung).
-- Voraussetzung: Entwurf 20261122090000_ai_search_ops_lease_v2 angewendet.
-- Rückweg: supabase/drafts/20261122090100_ai_search_ops_cleanup_schedule_down.sql
--
-- Plant EINEN Datenbank-Job (pg_cron, läuft in der Datenbank selbst – kein
-- Schlüssel, kein Mailversand, keine Modellaufrufe, kein Vercel-Cron):
--   stündlich zur Minute 7: public.ai_search_ops_cleanup_tick(5000, 10)
--   → löscht abgelaufene gespeicherte Ergebnisse physisch (bis 50'000 je
--     Lauf), kürzt das Laufprotokoll auf 90 Tage, schreibt eine
--     Protokollzeile.
-- Aufbewahrung damit: Ergebnis 24 h abrufbar, physisch gelöscht spätestens
-- beim nächsten stündlichen Lauf → normal höchstens ~25 h nach Erzeugung.
-- Fällt ein Lauf aus, verlängert sich das um je eine Stunde; der
-- Betriebsbericht alarmiert ab 2 h Löschrückstand.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'ai-search-ops-cleanup',
  '7 * * * *',
  'SELECT public.ai_search_ops_cleanup_tick(5000, 10)'
);
