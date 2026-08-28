-- Themenwelten dürfen alternativ über eine Kursart über mehrere Bereiche
-- hinweg suchen. Bestehende bereichsgebundene Themenwelten bleiben unverändert.
alter table public.theme_worlds
  alter column area_slug drop not null;

comment on column public.theme_worlds.area_slug is
  'Optionaler Taxonomie-Bereich. Darf leer bleiben, wenn search_config.kursart einen bereichsübergreifenden Suchraum definiert.';

comment on column public.theme_worlds.search_config is
  'JSONB: {area_slug?, kursart?, type_key?, default_spec?, default_focus?}. Mindestens area_slug oder kursart definiert den Suchraum.';
