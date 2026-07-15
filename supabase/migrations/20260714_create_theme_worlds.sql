-- ============================================================
-- Migration: Dynamisches Themenwelten-System — Phase 3
-- Erstellt: 2026-07-14
-- Branch: feature/dynamic-theme-worlds
-- ============================================================
-- Additive Migration — verändert keine bestehenden Tabellen.
-- Die Migration darf ausschliesslich lokal oder nach expliziter
-- Freigabe gegen eine Nicht-Produktionsumgebung ausgeführt werden.
-- Produktionsdatenbank: nicht ausführen ohne Phase-4-Abnahme.
-- ============================================================

-- ============================================================
-- Gemeinsame Trigger-Funktion für updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

comment on function public.set_updated_at() is
  'Setzt updated_at automatisch auf now() bei jedem UPDATE. Wird von mehreren Tabellen genutzt.';

-- ============================================================
-- 1. THEME_WORLDS — Haupttabelle
-- ============================================================

create table if not exists public.theme_worlds (
  -- Primärschlüssel
  id                uuid        primary key default gen_random_uuid(),

  -- Interner Config-Key (entspricht dem bisherigen JS-Config-Key)
  -- Beispiel: 'sport_fitness_beruf', 'yoga_achtsamkeit'
  key               text        unique not null,

  -- URL & Routing
  -- url_segment: URL-Pfadsegment, z.B. 'beruflich', 'privat-hobby', 'kinder-jugend'
  -- slug: URL-Slug der Themenwelt, z.B. 'sport-fitness-berufsausbildung'
  url_segment       text        not null,
  slug              text        not null,

  -- Datenbank-Segment (kanonischer Wert für DB-Abfragen)
  -- 'professionell' | 'privat' | 'kinder'
  db_segment        text        not null,

  -- Taxonomie-Bereichs-Slug (entspricht taxonomy_areas.slug / taxonomy_level2.slug)
  area_slug         text        not null,

  -- Inhalte (Deutsch Pflicht, weitere Sprachen optional)
  title_de          text        not null,
  title_en          text,
  title_fr          text,
  title_it          text,
  subtitle_de       text,
  subtitle_en       text,
  subtitle_fr       text,
  subtitle_it       text,
  intro_de          text,        -- Einleitungstext / Lead-Paragraph

  -- Bilder
  hero_image_url    text,        -- null = Segmentfarben-Gradient als Fallback
  hero_image_alt_de text,        -- Alt-Text für Hero-Bild
  og_image_url      text,        -- null = /og-default.png als Fallback

  -- SEO (null = im Frontend aus title_de / subtitle_de generiert)
  meta_title        text,
  meta_description  text,

  -- JSONB-Konfigurationen (Schemas dokumentiert in phase-2-architecture.md Abschnitt 8)
  search_config       jsonb,     -- {area_slug, type_key, default_spec?, default_focus?}
  section_titles      jsonb,     -- Optionale Überschriften-Overrides für Template-Abschnitte
  predefined_searches jsonb,     -- Array: [{label_de, spec?, focus?, loc?, delivery?}]
  cta_links           jsonb,     -- Array: [{label_de, loc?, delivery?}]

  -- Redaktioneller Status
  -- 'draft' = Entwurf, nicht öffentlich
  -- 'published' = veröffentlicht, öffentlich sichtbar
  -- 'archived' = archiviert, nicht öffentlich, wird nicht gelöscht
  status            text        not null default 'draft',
  published_at      timestamptz,  -- Wird beim ersten Publish gesetzt, nie zurückgesetzt

  -- Deploy-Status (getrennt vom redaktionellen Status)
  -- 'not_requested' = kein Deploy angefordert
  -- 'requested'     = Deploy-Hook wurde ausgelöst (nicht: Build abgeschlossen)
  -- 'failed'        = Deploy-Hook-Aufruf ist fehlgeschlagen
  deploy_status        text      not null default 'not_requested',
  deploy_requested_at  timestamptz,

  -- Sortierung und Zeitstempel
  sort_order        integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Constraints
  constraint theme_worlds_url_segment_slug_unique
    unique (url_segment, slug),

  constraint theme_worlds_status_check
    check (status in ('draft', 'published', 'archived')),

  constraint theme_worlds_deploy_status_check
    check (deploy_status in ('not_requested', 'requested', 'failed')),

  constraint theme_worlds_db_segment_check
    check (db_segment in ('professionell', 'privat', 'kinder')),

  -- Konsistenz zwischen db_segment und url_segment (verhindert widersprüchliche Werte)
  constraint theme_worlds_segment_consistency check (
    (db_segment = 'professionell' and url_segment = 'beruflich') or
    (db_segment = 'privat'        and url_segment = 'privat-hobby') or
    (db_segment = 'kinder'        and url_segment = 'kinder-jugend')
  ),

  -- Slug-Format: nur a-z, 0-9, Bindestriche; kein Führungs-/Abschluss-Bindestrich
  constraint theme_worlds_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint theme_worlds_url_segment_format_check
    check (url_segment ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  -- published_at darf nur gesetzt sein, wenn status = 'published' oder 'archived'
  constraint theme_worlds_published_at_check
    check (published_at is null or status in ('published', 'archived'))
);

comment on table public.theme_worlds is
  'Haupttabelle des dynamischen Themenwelten-Systems. Eine Themenwelt entspricht einer Bereichs-Landingpage unter /bereich/{url_segment}/{slug}.';

comment on column public.theme_worlds.key is
  'Interner Config-Key (z.B. sport_fitness_beruf). Dient für Legacy-Fallback-Mapping und Import-Scripts.';

comment on column public.theme_worlds.url_segment is
  'URL-Pfadsegment: beruflich | privat-hobby | kinder-jugend. Muss mit db_segment konsistent sein (CHECK-Constraint).';

comment on column public.theme_worlds.db_segment is
  'Kanonischer DB-Segment-Wert für Kurs-Abfragen: professionell | privat | kinder.';

comment on column public.theme_worlds.status is
  'Redaktioneller Status: draft | published | archived. Kontrolliert öffentliche Sichtbarkeit via RLS.';

comment on column public.theme_worlds.deploy_status is
  'Deploy-Status: not_requested | requested | failed. Getrennt vom redaktionellen Status. requested bedeutet nur: HTTP-Request an Hook akzeptiert.';

comment on column public.theme_worlds.search_config is
  'JSONB: {area_slug, type_key?, default_spec?, default_focus?}. Steuert die themenspezifische Kurs-Suche.';

comment on column public.theme_worlds.predefined_searches is
  'JSONB-Array: [{label_de, spec?, focus?, loc?, delivery?}]. Max 20 Einträge. Vordefinierte Suchlinks.';

comment on column public.theme_worlds.cta_links is
  'JSONB-Array: [{label_de, loc?, delivery?}]. Max 5 Einträge. CTA-Footer-Links.';

-- Indizes
create index if not exists theme_worlds_status_idx
  on public.theme_worlds (status);

create index if not exists theme_worlds_url_segment_slug_idx
  on public.theme_worlds (url_segment, slug);

create index if not exists theme_worlds_db_segment_idx
  on public.theme_worlds (db_segment);

-- updated_at Trigger
create trigger theme_worlds_set_updated_at
  before update on public.theme_worlds
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. THEME_WORLD_SCENARIOS — Szenario-Artikel
-- ============================================================

create table if not exists public.theme_world_scenarios (
  id              uuid        primary key default gen_random_uuid(),

  -- FK zur Themenwelt
  -- ON DELETE RESTRICT: verhindert versehentliches Löschen einer Themenwelt
  -- mit noch vorhandenen (ggf. publizierten) Szenario-Artikeln.
  -- Admin muss alle Szenarien zuerst archivieren und löschen.
  theme_world_id  uuid        not null references public.theme_worlds(id) on delete restrict,

  -- URL & Identität
  slug            text        not null,

  -- Anzeigeinhalt
  icon            text,          -- Emoji-Icon, z.B. '🎓'
  label_de        text        not null,
  label_en        text,
  label_fr        text,
  label_it        text,
  teaser_de       text,          -- Kurzbeschreibung (max. ~200 Zeichen empfohlen)
  teaser_en       text,

  -- Artikel-HTML (wird serverseitig sanitiert vor Speicherung)
  content_html    text,

  -- Bilder
  card_image_url  text,          -- Karten-Bild auf Landingpage (null = Emoji-Fallback)
  card_image_alt  text,
  og_image_url    text,          -- null = /og-default.png

  -- SEO (null = generiert aus label_de / teaser_de)
  meta_title      text,
  meta_description text,

  -- CTA-Konfiguration
  cta_label_de    text,
  cta_config      jsonb,         -- {spec?, focus?, loc?, delivery?}

  -- Reihenfolge und Status
  sort_order      integer     not null default 0,

  -- Redaktioneller Status (eigener Lifecycle, aber öffentlich nur wenn Eltern-TW published)
  status          text        not null default 'draft',
  published_at    timestamptz,

  -- Redaktionelles Datum der letzten inhaltlichen Prüfung
  last_reviewed_at date,

  -- Zeitstempel
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Constraints
  constraint scenarios_slug_theme_unique
    unique (theme_world_id, slug),

  constraint scenarios_status_check
    check (status in ('draft', 'published', 'archived')),

  constraint scenarios_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint scenarios_published_at_check
    check (published_at is null or status in ('published', 'archived')),

  -- Alt-Text ist Pflicht wenn ein Karten-Bild gesetzt ist
  constraint scenarios_card_image_alt_check
    check (card_image_url is null or card_image_alt is not null)
);

comment on table public.theme_world_scenarios is
  'Szenario-Artikel einer Themenwelt. Öffentlich lesbar nur wenn status=published UND theme_worlds.status=published.';

comment on column public.theme_world_scenarios.content_html is
  'Vollständiger HTML-Artikelinhalt. Wird serverseitig sanitiert (Script-Tags, Event-Handler, javascript:-URLs entfernt).';

comment on column public.theme_world_scenarios.cta_config is
  'JSONB: {spec?, focus?, loc?, delivery?}. Suchparameter für den CTA-Button. Keine URL-Strings.';

-- Indizes
create index if not exists scenarios_theme_world_id_idx
  on public.theme_world_scenarios (theme_world_id);

create index if not exists scenarios_status_idx
  on public.theme_world_scenarios (status);

create index if not exists scenarios_sort_order_idx
  on public.theme_world_scenarios (theme_world_id, sort_order);

-- updated_at Trigger
create trigger theme_world_scenarios_set_updated_at
  before update on public.theme_world_scenarios
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. THEME_WORLD_FAQS — FAQ-Einträge
-- ============================================================

create table if not exists public.theme_world_faqs (
  id              uuid        primary key default gen_random_uuid(),

  -- ON DELETE CASCADE: FAQs haben keinen eigenständigen Lifecycle
  theme_world_id  uuid        not null references public.theme_worlds(id) on delete cascade,

  question_de     text        not null,
  question_en     text,
  question_fr     text,
  question_it     text,
  answer_de       text        not null,
  answer_en       text,
  answer_fr       text,
  answer_it       text,

  sort_order      integer     not null default 0,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.theme_world_faqs is
  'FAQ-Einträge einer Themenwelt. Öffentlich lesbar wenn theme_worlds.status=published. CASCADE bei Themenwelt-Löschung.';

-- Index
create index if not exists faqs_theme_world_id_idx
  on public.theme_world_faqs (theme_world_id, sort_order);

-- ============================================================
-- 4. THEME_WORLD_EDITORIAL_SECTIONS — Redaktionelle Langtext-Sektionen
-- ============================================================

create table if not exists public.theme_world_editorial_sections (
  id              uuid        primary key default gen_random_uuid(),
  theme_world_id  uuid        not null references public.theme_worlds(id) on delete cascade,

  heading_de      text        not null,
  heading_en      text,
  intro_de        text,
  intro_en        text,

  -- Array von Aufzählungspunkten (pro Sprache)
  items_de        text[],
  items_en        text[],

  -- true = <ol> (geordnet), false = <ul> (ungeordnet)
  is_ordered      boolean     not null default false,

  closing_de      text,
  closing_en      text,

  sort_order      integer     not null default 0,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.theme_world_editorial_sections is
  'Redaktionelle Langtext-Sektionen einer Themenwelt. CASCADE bei Themenwelt-Löschung.';

comment on column public.theme_world_editorial_sections.items_de is
  'Array von Aufzählungspunkten auf Deutsch. Wird als <ul> oder <ol> gerendert (is_ordered).';

-- Index
create index if not exists editorial_theme_world_id_idx
  on public.theme_world_editorial_sections (theme_world_id, sort_order);

-- ============================================================
-- 5. THEME_WORLD_SPECIALTIES — Kursbereiche / Ausbildungsbereiche
-- ============================================================

create table if not exists public.theme_world_specialties (
  id              uuid        primary key default gen_random_uuid(),
  theme_world_id  uuid        not null references public.theme_worlds(id) on delete cascade,

  -- Exakter Label-String aus category_specialty_label in courses.all_categories
  -- Kein FK auf taxonomy_tables (Kurse speichern Labels, keine IDs)
  specialty_label text        not null,

  description_de  text,
  icon            text,          -- Emoji oder kurzes Symbol

  sort_order      integer     not null default 0,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),

  -- Kein doppeltes Specialty-Label pro Themenwelt
  constraint specialties_label_theme_unique
    unique (theme_world_id, specialty_label)
);

comment on table public.theme_world_specialties is
  'Kursbereiche / Ausbildungsbereiche einer Themenwelt. specialty_label entspricht courses.all_categories[].category_specialty_label. CASCADE bei Themenwelt-Löschung.';

comment on column public.theme_world_specialties.specialty_label is
  'Exakter String-Match zu category_specialty_label in der Kurs-Taxonomie. Kein FK — Kurse speichern Label-Strings, keine IDs.';

-- Index
create index if not exists specialties_theme_world_id_idx
  on public.theme_world_specialties (theme_world_id, sort_order);

-- ============================================================
-- 6. THEME_WORLD_REGIONS — Regionslinks
-- ============================================================

create table if not exists public.theme_world_regions (
  id              uuid        primary key default gen_random_uuid(),
  theme_world_id  uuid        not null references public.theme_worlds(id) on delete cascade,

  label_de        text        not null,    -- Sichtbares Label: 'Zürich', 'Ganze Schweiz'
  anchor_text_de  text,                    -- SEO-Linktext (falls abweichend vom Label)

  -- Suchparameter (mindestens einer muss gesetzt sein — Check in App-Layer)
  loc_param       text,                    -- ?loc= Wert: 'Zürich', 'Bern', etc.
  delivery_param  text,                    -- ?delivery= Wert: 'online_live', 'in_person', etc.

  sort_order      integer     not null default 0,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),

  -- Mindestens loc_param oder delivery_param muss gesetzt sein
  constraint regions_params_check
    check (loc_param is not null or delivery_param is not null)
);

comment on table public.theme_world_regions is
  'Regionslinks einer Themenwelt für die Suchnavigation. Mindestens loc_param oder delivery_param muss gesetzt sein. CASCADE bei Themenwelt-Löschung.';

comment on column public.theme_world_regions.delivery_param is
  'Erlaubte Werte: online_live | self_study | in_person (wie im Frontend-Routing verwendet).';

-- Validierung delivery_param-Werte
alter table public.theme_world_regions
  add constraint regions_delivery_param_check
  check (delivery_param is null or delivery_param in ('online_live', 'self_study', 'in_person'));

-- Index
create index if not exists regions_theme_world_id_idx
  on public.theme_world_regions (theme_world_id, sort_order);

-- ============================================================
-- 7. THEME_WORLD_TRUST_ITEMS — Trust- und Qualitätshinweise
-- ============================================================

create table if not exists public.theme_world_trust_items (
  id              uuid        primary key default gen_random_uuid(),
  theme_world_id  uuid        not null references public.theme_worlds(id) on delete cascade,

  -- Diskriminator-Feld
  -- 'label'    = echtes Qualitätslabel mit Logo (z.B. Qualitop, QualiCert, SFGV)
  -- 'editorial' = redaktioneller Hinweis ohne Logo
  -- 'info'     = allgemeine Info-Card
  item_type       text        not null default 'editorial',

  name            text        not null,    -- Titel des Eintrags
  description_de  text,
  logo_url        text,                    -- null wenn item_type != 'label'
  logo_alt        text,
  external_url    text,                    -- Link zur Organisation (optional)
  rights_note     text,                    -- Bildrechte / Nutzungshinweis (für Labels)

  sort_order      integer     not null default 0,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),

  -- Type-Constraint
  constraint trust_items_type_check
    check (item_type in ('label', 'editorial', 'info')),

  -- Logo-URL nur sinnvoll wenn item_type = 'label'
  -- Warnung: editorial-Items ohne Logo sind der Normalfall
  -- App-Layer-Validierung: wenn logo_url gesetzt, dann muss logo_alt gesetzt sein
  constraint trust_items_logo_alt_check
    check (logo_url is null or logo_alt is not null)
);

comment on table public.theme_world_trust_items is
  'Trust-Hinweise und Qualitätslabels einer Themenwelt. item_type steuert die Anzeige. CASCADE bei Themenwelt-Löschung.';

comment on column public.theme_world_trust_items.item_type is
  'label = Qualitätslabel mit Logo; editorial = redaktioneller Hinweis; info = allgemeine Info-Card.';

comment on column public.theme_world_trust_items.logo_url is
  'Nur für item_type=label. logo_alt ist dann Pflicht (CHECK-Constraint). Externe URLs und Supabase-Storage-URLs erlaubt.';

-- Index
create index if not exists trust_items_theme_world_id_idx
  on public.theme_world_trust_items (theme_world_id, sort_order);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Alle neuen Tabellen erhalten explizit RLS.
-- Schreiben: ausschliesslich über serverseitige API-Endpunkte mit SUPABASE_SERVICE_ROLE_KEY.
-- Lesen (anon/authenticated): nur für publizierte Inhalte.
-- Service-Role umgeht RLS automatisch (Supabase-Standard).

-- ------------------------------------------------------------
-- 7.1 theme_worlds RLS
-- ------------------------------------------------------------

alter table public.theme_worlds enable row level security;

-- Öffentliche Reads: nur publizierte Themenwelten
create policy "theme_worlds_public_read"
  on public.theme_worlds
  for select
  to anon, authenticated
  using (status = 'published');

-- Keine INSERT/UPDATE/DELETE für anon oder authenticated.
-- Schreiben läuft ausschliesslich über Service-Role-API-Endpunkte.

comment on policy "theme_worlds_public_read" on public.theme_worlds is
  'Anonyme und eingeloggte Nutzer sehen nur publizierte Themenwelten. Entwürfe und archivierte Einträge sind unsichtbar.';

-- ------------------------------------------------------------
-- 7.2 theme_world_scenarios RLS
-- ------------------------------------------------------------

alter table public.theme_world_scenarios enable row level security;

-- Öffentliche Reads: nur publizierte Szenarien MIT publizierter Eltern-Themenwelt
create policy "theme_world_scenarios_public_read"
  on public.theme_world_scenarios
  for select
  to anon, authenticated
  using (
    status = 'published'
    and theme_world_id in (
      select id from public.theme_worlds where status = 'published'
    )
  );

comment on policy "theme_world_scenarios_public_read" on public.theme_world_scenarios is
  'Szenarien sind nur öffentlich sichtbar wenn: eigener status=published UND theme_worlds.status=published.';

-- ------------------------------------------------------------
-- 7.3 theme_world_faqs RLS
-- PHASE-4-KORREKTUR: is_active = true ergänzt. Inaktive FAQs dürfen auch bei
-- publizierter Themenwelt nicht öffentlich sichtbar sein.
-- ------------------------------------------------------------

alter table public.theme_world_faqs enable row level security;

create policy "theme_world_faqs_public_read"
  on public.theme_world_faqs
  for select
  to anon, authenticated
  using (
    is_active = true
    and theme_world_id in (
      select id from public.theme_worlds where status = 'published'
    )
  );

comment on policy "theme_world_faqs_public_read" on public.theme_world_faqs is
  'FAQs sind nur öffentlich sichtbar wenn: is_active=true UND theme_worlds.status=published.';

-- ------------------------------------------------------------
-- 7.4 theme_world_editorial_sections RLS
-- PHASE-4-KORREKTUR: is_active = true ergänzt.
-- ------------------------------------------------------------

alter table public.theme_world_editorial_sections enable row level security;

create policy "theme_world_editorial_sections_public_read"
  on public.theme_world_editorial_sections
  for select
  to anon, authenticated
  using (
    is_active = true
    and theme_world_id in (
      select id from public.theme_worlds where status = 'published'
    )
  );

comment on policy "theme_world_editorial_sections_public_read" on public.theme_world_editorial_sections is
  'Editorial Sections sind nur öffentlich sichtbar wenn: is_active=true UND theme_worlds.status=published.';

-- ------------------------------------------------------------
-- 7.5 theme_world_specialties RLS
-- PHASE-4-KORREKTUR: is_active = true ergänzt.
-- ------------------------------------------------------------

alter table public.theme_world_specialties enable row level security;

create policy "theme_world_specialties_public_read"
  on public.theme_world_specialties
  for select
  to anon, authenticated
  using (
    is_active = true
    and theme_world_id in (
      select id from public.theme_worlds where status = 'published'
    )
  );

comment on policy "theme_world_specialties_public_read" on public.theme_world_specialties is
  'Specialties sind nur öffentlich sichtbar wenn: is_active=true UND theme_worlds.status=published.';

-- ------------------------------------------------------------
-- 7.6 theme_world_regions RLS
-- PHASE-4-KORREKTUR: is_active = true ergänzt.
-- ------------------------------------------------------------

alter table public.theme_world_regions enable row level security;

create policy "theme_world_regions_public_read"
  on public.theme_world_regions
  for select
  to anon, authenticated
  using (
    is_active = true
    and theme_world_id in (
      select id from public.theme_worlds where status = 'published'
    )
  );

comment on policy "theme_world_regions_public_read" on public.theme_world_regions is
  'Regionen sind nur öffentlich sichtbar wenn: is_active=true UND theme_worlds.status=published.';

-- ------------------------------------------------------------
-- 7.7 theme_world_trust_items RLS
-- PHASE-4-KORREKTUR: is_active = true ergänzt.
-- ------------------------------------------------------------

alter table public.theme_world_trust_items enable row level security;

create policy "theme_world_trust_items_public_read"
  on public.theme_world_trust_items
  for select
  to anon, authenticated
  using (
    is_active = true
    and theme_world_id in (
      select id from public.theme_worlds where status = 'published'
    )
  );

comment on policy "theme_world_trust_items_public_read" on public.theme_world_trust_items is
  'Trust Items sind nur öffentlich sichtbar wenn: is_active=true UND theme_worlds.status=published.';

-- ============================================================
-- ABSCHLUSS
-- ============================================================
-- Diese Migration ist additiv und verändert keine bestehenden Tabellen.
-- Nächste Schritte (nicht in dieser Migration):
--   1. API-Endpunkte (api/admin-theme-worlds.js etc.) implementieren
--   2. Import-Script für bestehende Themenwelten (Phase 5)
--   3. Frontend-Umschaltung (Phase 6)
-- ============================================================
