-- Phase 8.9: OG-Image-Alt-Text für Szenarioartikel
--
-- Fügt die Spalte og_image_alt zur theme_world_scenarios-Tabelle hinzu.
-- Die Spalte fehlte im ursprünglichen Schema (20260714_create_theme_worlds.sql).
-- theme_worlds hat bereits og_image_alt_de (20260722_add_theme_world_og_image_alt.sql).
--
-- Konvention: optionaler Alt-Text für das Open-Graph-Bild, max. 200 Zeichen.
-- Wird öffentlich als og:image:alt Meta-Tag ausgegeben.
-- Kein DB-Constraint: OG-Alt-Text ist immer optional.

ALTER TABLE theme_world_scenarios
  ADD COLUMN IF NOT EXISTS og_image_alt text;
