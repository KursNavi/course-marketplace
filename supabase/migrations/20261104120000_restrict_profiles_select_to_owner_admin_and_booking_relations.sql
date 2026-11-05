-- ============================================================================
-- Migration: Restrict public SELECT access on profiles
-- ============================================================================
-- Resolves a public PII leak: the original "Anyone can read profiles" policy
-- (20260228_security_hardening_rls.sql) has no role restriction and lets any
-- unauthenticated caller with the public anon key read every column of every
-- profile row (email, street, stripe_customer_id, credit_balance_cents, ...).
--
-- Replaces it with:
--   - owner-only SELECT (a user can read their own profile)
--   - admin SELECT (reusing private.is_admin(), see 20260830080000)
--   - teacher SELECT of their own course bookers' profiles (needed by
--     fetchTeacherEarnings in src/App.jsx, which reads student name/email
--     for a teacher's own bookings)
--
-- Public, unauthenticated reads needed for teacher-profile pages
-- (src/App.jsx, src/components/DetailView.jsx) are served instead from a new
-- view, public_teacher_profiles, exposing only a safe, curated column list
-- and gating the email column on show_email_publicly itself server-side
-- (not trusting the frontend to honor it).
--
-- Defensive: policy names below may already exist on live projects outside
-- of the tracked migration history (see 20260830080000's DROP/ALTER of
-- "profiles_select_own" / "profiles_insert_own" / "profiles_update_own",
-- names that were never created by any tracked migration) -- every
-- DROP/CREATE here is written to be safely re-runnable.
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_course_bookers" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (private.is_admin());

-- A teacher may read the profile of a user who booked one of their own
-- courses (name/email needed on the teacher dashboard / earnings view).
CREATE POLICY "profiles_select_course_bookers"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.courses c ON c.id = b.course_id
      WHERE b.user_id = profiles.id
        AND c.user_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- Public, unauthenticated-safe teacher profile view
-- ----------------------------------------------------------------------------
-- Created by the migration role, not with security_invoker, so it reads
-- public.profiles with the view owner's privileges and is not subject to the
-- restrictive policies above. Access control instead happens via the
-- explicit column list and WHERE clause below, plus the GRANTs that follow.
DROP VIEW IF EXISTS public.public_teacher_profiles;

CREATE VIEW public.public_teacher_profiles AS
SELECT
  id,
  full_name,
  slug,
  logo_url,
  city,
  canton,
  additional_locations,
  is_professional,
  verification_status,
  website_url,
  phone,
  bio_text,
  certificates,
  package_tier,
  profile_published_at,
  show_email_publicly,
  CASE WHEN show_email_publicly THEN email ELSE NULL END AS email
FROM public.profiles
WHERE role = 'teacher';

REVOKE ALL ON public.public_teacher_profiles FROM PUBLIC;
GRANT SELECT ON public.public_teacher_profiles TO anon, authenticated;
