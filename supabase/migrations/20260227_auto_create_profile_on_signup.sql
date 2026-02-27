-- ============================================
-- Migration: Auto-create profile on user signup
-- ============================================
-- Creates a trigger on auth.users that automatically inserts
-- a row into public.profiles whenever a new user signs up.
-- This prevents the issue where a user exists in auth.users
-- but has no corresponding profile row.
-- ============================================

-- 1) Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    package_tier,
    preferred_language,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'package_tier', 'basic'),
    'de',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) Create the trigger (drop first if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3) Backfill: Create profiles for any existing auth.users that are missing
INSERT INTO public.profiles (id, full_name, email, role, package_tier, preferred_language, created_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  COALESCE(u.raw_user_meta_data->>'role', 'student'),
  COALESCE(u.raw_user_meta_data->>'package_tier', 'basic'),
  'de',
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
