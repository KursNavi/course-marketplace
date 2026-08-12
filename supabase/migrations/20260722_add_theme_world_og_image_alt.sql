-- Phase 8.4: OG-Image-Alt-Text-Feld für Themenwelten
--
-- Fügt die Spalte og_image_alt_de zur theme_worlds-Tabelle hinzu.
-- Die Spalte war im ursprünglichen Schema fehlend (20260714_create_theme_worlds.sql).
--
-- Konvention: optionaler Alt-Text für das Open-Graph-Bild, max. 200 Zeichen.
-- Wird öffentlich als og:image:alt Meta-Tag ausgegeben.

ALTER TABLE theme_worlds
  ADD COLUMN IF NOT EXISTS og_image_alt_de text;
