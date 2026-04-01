-- ============================================
-- Migration: Fix saved_courses RLS policies
-- ============================================
-- Problem: Migration 20260228_security_hardening_rls.sql created correct
-- FOR INSERT WITH CHECK policies but did NOT drop any pre-existing policies.
-- If the database has an older "FOR ALL USING (auth.uid() = user_id)" policy,
-- that USING clause is used as a fallback WITH CHECK for INSERT operations,
-- causing: "new row violates row-level security policy (USING expression)"
--
-- Fix: Drop ALL existing saved_courses policies and recreate them cleanly.
-- ============================================

-- Drop all existing policies (names may vary between prod and test DB)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'saved_courses' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.saved_courses', pol.policyname);
  END LOOP;
END;
$$;

-- Ensure RLS is enabled
ALTER TABLE saved_courses ENABLE ROW LEVEL SECURITY;

-- Recreate policies with explicit FOR SELECT / FOR INSERT / FOR DELETE
-- (no FOR ALL — avoids USING clause being used as INSERT fallback check)

CREATE POLICY "saved_courses_select"
  ON saved_courses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_courses_insert"
  ON saved_courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_courses_delete"
  ON saved_courses FOR DELETE
  USING (auth.uid() = user_id);
