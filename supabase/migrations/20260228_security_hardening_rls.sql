-- ============================================
-- Migration: Comprehensive RLS Security Hardening
-- ============================================
-- Resolves Supabase Security Advisor errors by enabling RLS
-- and creating appropriate policies for all unprotected tables.
-- Also fixes overly permissive policies on course_category_assignments.
-- ============================================


-- ============================================
-- 1. PROFILES
-- ============================================
-- Public read needed for course detail pages (instructor info).
-- Writes restricted to own profile. INSERT handled by
-- handle_new_user() trigger (SECURITY DEFINER) + safety-net upsert.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);


-- ============================================
-- 2. COURSES (RLS already enabled — add missing policies)
-- ============================================
-- Public read for search page. Writes restricted to course owner.
-- Existing policy "Users can update is_prio on own courses" is
-- compatible (Postgres ORs multiple policies of the same command).

CREATE POLICY "Anyone can read courses"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert courses"
  ON courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own courses"
  ON courses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete own courses"
  ON courses FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- 3. BOOKINGS
-- ============================================
-- Students read own bookings. Providers read bookings for their
-- courses (earnings dashboard). Inserts for free-course bookings.
-- All status updates (refund, payout) go through service role.

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Providers can read bookings for own courses"
  ON bookings FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Providers can delete bookings for own courses"
  ON bookings FOR DELETE
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 4. COURSE_EVENTS
-- ============================================
-- Public read for course detail pages.
-- Writes restricted to course owner via subquery.

ALTER TABLE course_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read course events"
  ON course_events FOR SELECT
  USING (true);

CREATE POLICY "Course owners can insert events"
  ON course_events FOR INSERT
  WITH CHECK (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Course owners can update own events"
  ON course_events FOR UPDATE
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Course owners can delete own events"
  ON course_events FOR DELETE
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 5. SAVED_COURSES
-- ============================================
-- Users can only manage their own saved/wishlisted courses.

ALTER TABLE saved_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved courses"
  ON saved_courses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved courses"
  ON saved_courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved courses"
  ON saved_courses FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- 6. COURSE_CATEGORY_ASSIGNMENTS — Fix permissive policies
-- ============================================
-- Replace open INSERT/DELETE (WITH CHECK/USING true) with
-- ownership checks. SELECT policy (cca_select) stays as-is.

DROP POLICY IF EXISTS "cca_insert" ON course_category_assignments;
DROP POLICY IF EXISTS "cca_delete" ON course_category_assignments;

CREATE POLICY "Course owners can insert category assignments"
  ON course_category_assignments FOR INSERT
  WITH CHECK (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Course owners can delete category assignments"
  ON course_category_assignments FOR DELETE
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );


-- ============================================
-- 7. FIX SECURITY DEFINER VIEW
-- ============================================
-- v_course_full_categories runs with creator's permissions by default,
-- bypassing RLS. Recreate with security_invoker = true so it respects
-- the querying user's RLS policies instead.

CREATE OR REPLACE VIEW v_course_full_categories
WITH (security_invoker = true)
AS
SELECT
    c.id AS course_id,
    c.title,
    cca.is_primary,
    tp.level1_id,
    tp.level1_slug,
    tp.level1_label_de,
    tp.level2_id,
    tp.level2_slug,
    tp.level2_label_de,
    tp.level3_id,
    tp.level3_slug,
    tp.level3_label_de,
    l4.id AS level4_id,
    l4.slug AS level4_slug,
    l4.label_de AS level4_label_de
FROM courses c
JOIN course_category_assignments cca ON cca.course_id = c.id
JOIN v_taxonomy_paths tp ON tp.level3_id = cca.level3_id
LEFT JOIN taxonomy_level4 l4 ON l4.id = cca.level4_id AND l4.is_active;
