-- ============================================================
-- Migration: Relaxiere regions_params_check Constraint
-- Datum: 2026-07-18
-- Branch: feature/dynamic-theme-worlds
-- ============================================================
-- Hintergrund: Die ursprüngliche Constraint in 20260714 war zu streng.
-- Eine Region mit loc_param=NULL und delivery_param=NULL ist valide:
-- Sie repräsentiert einen "Alle Regionen"-Link (z.B. "Ganze Schweiz")
-- ohne Standort- oder Lieferungsfilter. Im Frontend erzeugt dies
-- einen Suchlink ohne location/delivery-Parameter, der alle Kurse
-- der Themenwelt zeigt.
-- ============================================================

ALTER TABLE public.theme_world_regions
  DROP CONSTRAINT IF EXISTS regions_params_check;

-- Keine neue Constraint — beide Felder dürfen null sein.
-- (anchor_text_de und label_de sind bereits NOT NULL, die Zeile ist daher nicht leer.)
