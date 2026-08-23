-- ============================================================
-- ROLLBACK: Phase 3 Migration aus Produktion entfernen
-- Erstellt: 2026-07-16
-- Grund:    Migration 20260714_create_theme_worlds.sql wurde
--           irrtümlich in der produktiven Supabase-Datenbank
--           ausgeführt. Alle 7 neuen Tabellen sind leer.
--           Bestehende Daten wurden nicht verändert.
-- ============================================================
-- SICHERHEIT:
--   Nur additive Änderungen werden rückgängig gemacht.
--   Keine bestehenden Tabellen oder Daten werden berührt.
--   Die 7 Tabellen sind leer (keine Daten zu verlieren).
--
-- REIHENFOLGE:
--   1. Abhängige Tabellen zuerst (Foreign Keys zu theme_worlds)
--   2. Haupttabelle zuletzt
--   3. Funktion zuletzt (Trigger wurden mit den Tabellen gelöscht)
--
-- VORPRÜFUNG (optional, im SQL-Editor ausführen):
--   SELECT table_name
--   FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name LIKE 'theme_world%';
-- ============================================================

-- ============================================================
-- Schritt 1: Abhängige Tabellen entfernen
-- (Triggers, Indizes, RLS-Policies werden automatisch gelöscht)
-- ============================================================
DROP TABLE IF EXISTS public.theme_world_trust_items;
DROP TABLE IF EXISTS public.theme_world_regions;
DROP TABLE IF EXISTS public.theme_world_specialties;
DROP TABLE IF EXISTS public.theme_world_editorial_sections;
DROP TABLE IF EXISTS public.theme_world_faqs;
DROP TABLE IF EXISTS public.theme_world_scenarios;

-- ============================================================
-- Schritt 2: Haupttabelle entfernen
-- ============================================================
DROP TABLE IF EXISTS public.theme_worlds;

-- ============================================================
-- Schritt 3: Trigger-Funktion entfernen
-- (Funktion set_updated_at existierte vor dieser Migration nicht)
-- (Prüfe mit: SELECT proname FROM pg_proc WHERE proname = 'set_updated_at')
-- ============================================================
DROP FUNCTION IF EXISTS public.set_updated_at();

-- ============================================================
-- Schritt 4: Nachweis (nach Ausführung prüfen)
-- ============================================================
-- Führe anschliessend aus:
-- SELECT count(*) FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'theme_world%';
-- → Erwartet: 0
--
-- SELECT proname FROM pg_proc WHERE proname IN ('set_updated_at', 'import_theme_world_atomic');
-- → Erwartet: keine Zeilen
-- ============================================================
