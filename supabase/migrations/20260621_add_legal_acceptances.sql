-- Migration: legal_acceptances
-- Speichert Consent-Nachweise für AGB, Datenschutz und weitere rechtlich relevante Bestätigungen.
-- Erstellt: 2026-06-21

create table if not exists public.legal_acceptances (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  context         text        not null,
  -- Mögliche Werte: registration | provider_onboarding | course_publish |
  --                 package_purchase | package_upgrade | course_creation_service
  terms_version   text        not null,
  privacy_version text,
  accepted_at     timestamptz not null default now(),
  ip_address      text,
  user_agent      text,
  metadata        jsonb
);

comment on table public.legal_acceptances is
  'Audit-Trail für AGB- und Datenschutz-Annahmen durch Nutzerinnen und Nutzer sowie Anbieter.';

comment on column public.legal_acceptances.context is
  'Kontext der Annahme, z.B. registration, package_purchase, package_upgrade.';

comment on column public.legal_acceptances.terms_version is
  'AGB-Version (ISO-Datum, z.B. 2026-06-21) zum Zeitpunkt der Annahme.';

-- Index für schnelle Abfragen nach Nutzer
create index if not exists legal_acceptances_user_id_idx
  on public.legal_acceptances (user_id);

-- Index für Kontext-Filter
create index if not exists legal_acceptances_context_idx
  on public.legal_acceptances (context);

-- Row Level Security aktivieren
alter table public.legal_acceptances enable row level security;

-- Nutzerinnen und Nutzer dürfen nur eigene Einträge lesen
create policy "Users can view own legal acceptances"
  on public.legal_acceptances
  for select
  using (auth.uid() = user_id);

-- Schreibzugriff nur über Service Role (API-Endpoint mit SUPABASE_SERVICE_ROLE_KEY).
-- Es gibt keine INSERT-Policy für authenticated users — Schreiben läuft ausschliesslich
-- über den serverseitigen Endpoint /api/record-legal-acceptance.
