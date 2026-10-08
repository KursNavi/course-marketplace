-- Keep the preview database compatible with the production schema.
--
-- This migration is intentionally idempotent because the migration ledger and
-- the actual preview schema drifted apart in the past. It only adds nullable
-- columns/tables or widens the representation of session_count; it does not
-- copy, delete, or rewrite course data.

ALTER TABLE public.courses
  ALTER COLUMN session_count TYPE text
  USING session_count::text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS social_linkedin text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_youtube text,
  ADD COLUMN IF NOT EXISTS pending_package_tier text,
  ADD COLUMN IF NOT EXISTS pending_package_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_package_stripe_session_id text;

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS social_teaser text;

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  context         text not null,
  terms_version   text not null,
  privacy_version text,
  accepted_at     timestamptz not null default now(),
  ip_address      text,
  user_agent      text,
  metadata        jsonb
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_id_idx
  ON public.legal_acceptances (user_id);

CREATE INDEX IF NOT EXISTS legal_acceptances_context_idx
  ON public.legal_acceptances (context);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own legal acceptances"
  ON public.legal_acceptances;

CREATE POLICY "Users can view own legal acceptances"
  ON public.legal_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
