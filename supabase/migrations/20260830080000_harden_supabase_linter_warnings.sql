BEGIN;

-- ---------------------------------------------------------------------------
-- Security: restrict privileged RPCs and pin function search paths.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.add_credit(uuid, integer, text, bigint, text)
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.add_credit(uuid, integer, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credit(uuid, integer, text, bigint, text)
  TO service_role;

ALTER FUNCTION public.deduct_credit(uuid, integer, bigint, text)
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid, integer, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credit(uuid, integer, bigint, text)
  TO service_role;

ALTER FUNCTION public.refund_booking_to_credit(bigint, uuid, integer, text)
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.refund_booking_to_credit(bigint, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_booking_to_credit(bigint, uuid, integer, text)
  TO service_role;

ALTER FUNCTION public.cleanup_old_contact_messages()
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_contact_messages()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_contact_messages()
  TO service_role;

ALTER FUNCTION public.cleanup_old_leads()
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_leads()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_leads()
  TO service_role;

ALTER FUNCTION public.refresh_taxonomy_paths()
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.refresh_taxonomy_paths()
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.refresh_taxonomy_paths_manual()
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.refresh_taxonomy_paths_manual()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_taxonomy_paths_manual()
  TO service_role;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public;

-- This function is a PostgreSQL trigger, not an RPC endpoint. The conditional
-- keeps this migration compatible with environments created before the course
-- draft/publish migration.
DO $$
BEGIN
  IF to_regprocedure('public.prevent_uncategorized_course_publish()') IS NOT NULL THEN
    ALTER FUNCTION public.prevent_uncategorized_course_publish()
      SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.prevent_uncategorized_course_publish()
      FROM PUBLIC, anon, authenticated, service_role;
  END IF;
END;
$$;

-- Provider-facing analytics and priority updates already rely on the normal
-- RLS policies. Run them as the caller so they cannot bypass those policies.
ALTER FUNCTION public.get_provider_analytics(uuid, integer)
  SECURITY INVOKER SET search_path = public;
ALTER FUNCTION public.get_course_performance(uuid, integer)
  SECURITY INVOKER SET search_path = public;
ALTER FUNCTION public.toggle_course_prio(uuid, boolean)
  SECURITY INVOKER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_provider_analytics(uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_analytics(uuid, integer)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_course_performance(uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_course_performance(uuid, integer)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.toggle_course_prio(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_course_prio(uuid, boolean)
  TO authenticated, service_role;

-- Move account deletion behind a private SECURITY DEFINER implementation while
-- keeping the existing public RPC name as a SECURITY INVOKER wrapper.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.delete_provider_account(p_provider_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  course_ids bigint[];
  event_ids uuid[];
BEGIN
  IF auth.uid() IS DISTINCT FROM p_provider_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
  END IF;

  SELECT array_agg(c.id)
    INTO course_ids
  FROM public.courses c
  WHERE c.user_id = p_provider_id;

  IF course_ids IS NOT NULL AND array_length(course_ids, 1) > 0 THEN
    DELETE FROM public.course_category_assignments
    WHERE course_id = ANY(course_ids);

    DELETE FROM public.ticket_periods
    WHERE course_id = ANY(course_ids);

    SELECT array_agg(e.id)
      INTO event_ids
    FROM public.course_events e
    WHERE e.course_id = ANY(course_ids);

    IF event_ids IS NOT NULL AND array_length(event_ids, 1) > 0 THEN
      DELETE FROM public.bookings
      WHERE event_id = ANY(event_ids);
    END IF;

    DELETE FROM public.bookings
    WHERE course_id = ANY(course_ids);

    DELETE FROM public.course_events
    WHERE course_id = ANY(course_ids);

    DELETE FROM public.courses
    WHERE user_id = p_provider_id;
  END IF;

  DELETE FROM public.provider_slug_aliases
  WHERE provider_id = p_provider_id;

  DELETE FROM public.profiles
  WHERE id = p_provider_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION private.delete_provider_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.delete_provider_account(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_provider_account(provider_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.delete_provider_account(provider_id);
$$;

REVOKE EXECUTE ON FUNCTION public.delete_provider_account(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_provider_account(uuid)
  TO authenticated, service_role;

-- is_admin() is used only from RLS policies. Keep it out of the exposed public
-- schema, while retaining the same boolean behavior for policy evaluation.
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Security/RLS: remove redundant public policies and make ownership explicit.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Articles: admin write" ON public.articles;
CREATE POLICY "Articles: admin insert"
  ON public.articles FOR INSERT
  TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "Articles: admin update"
  ON public.articles FOR UPDATE
  TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY "Articles: admin delete"
  ON public.articles FOR DELETE
  TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS "Bookings: select own or course-owner or admin" ON public.bookings;
CREATE POLICY "Bookings: select own or course-owner or admin"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = bookings.course_id
        AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Providers can read bookings for own courses" ON public.bookings;
DROP POLICY IF EXISTS "Students can read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
ALTER POLICY "Providers can delete bookings for own courses"
  ON public.bookings TO authenticated;

ALTER POLICY "Bookings: insert own"
  ON public.bookings
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Course events: public read" ON public.course_events;
DROP POLICY IF EXISTS "Course owners can delete own events" ON public.course_events;
DROP POLICY IF EXISTS "Course owners can insert events" ON public.course_events;
DROP POLICY IF EXISTS "Course owners can update own events" ON public.course_events;

DROP POLICY IF EXISTS "providers_manage_own_course_locations" ON public.course_locations;
CREATE POLICY "providers_insert_own_course_locations"
  ON public.course_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );
CREATE POLICY "providers_update_own_course_locations"
  ON public.course_locations FOR UPDATE
  TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );
CREATE POLICY "providers_delete_own_course_locations"
  ON public.course_locations FOR DELETE
  TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );
ALTER POLICY "public_read_published_course_locations"
  ON public.course_locations TO anon, authenticated;

DROP POLICY IF EXISTS "Courses: public read" ON public.courses;
DROP POLICY IF EXISTS "Owners can delete own courses" ON public.courses;
DROP POLICY IF EXISTS "Owners can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Owners can update own courses" ON public.courses;
DROP POLICY IF EXISTS "Users can update own courses" ON public.courses;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
ALTER POLICY "Users can delete own profile"
  ON public.profiles TO authenticated;
ALTER POLICY "profiles_insert_own"
  ON public.profiles
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "profiles_update_own"
  ON public.profiles
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Anyone can insert views"
  ON public.course_views
  WITH CHECK ((viewer_id IS NULL) OR (viewer_id = (select auth.uid())));
ALTER POLICY "Course owners can read their views"
  ON public.course_views TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );

ALTER POLICY "Course owners can insert category assignments"
  ON public.course_category_assignments TO authenticated
  WITH CHECK (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );
ALTER POLICY "Course owners can delete category assignments"
  ON public.course_category_assignments TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );

ALTER POLICY "Users can read own credit transactions"
  ON public.credit_transactions TO authenticated
  USING ((select auth.uid()) = user_id);
DO $$
BEGIN
  IF to_regclass('public.legal_acceptances') IS NOT NULL THEN
    EXECUTE 'ALTER POLICY "Users can view own legal acceptances" ON public.legal_acceptances TO authenticated USING ((select auth.uid()) = user_id)';
  END IF;
END;
$$;
ALTER POLICY "saved_courses_select"
  ON public.saved_courses TO authenticated
  USING ((select auth.uid()) = user_id);
ALTER POLICY "saved_courses_insert"
  ON public.saved_courses TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "saved_courses_delete"
  ON public.saved_courses TO authenticated
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Providers can read own course ticket periods"
  ON public.ticket_periods TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );

DROP FUNCTION public.is_admin();

-- Normalize remaining policies that still call auth.uid() directly. Policies
-- already using the init-plan-safe SELECT wrapper are left unchanged.
DO $$
DECLARE
  policy_row record;
  new_qual text;
  new_check text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ILIKE '%auth.uid()%' AND qual NOT ILIKE '%select auth.uid()%')
        OR (with_check ILIKE '%auth.uid()%' AND with_check NOT ILIKE '%select auth.uid()%')
      )
  LOOP
    new_qual := replace(policy_row.qual, 'auth.uid()', '(select auth.uid())');
    new_check := replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())');

    IF policy_row.qual IS NOT NULL AND policy_row.with_check IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING %s WITH CHECK %s',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        new_qual,
        new_check
      );
    ELSIF policy_row.qual IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING %s',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        new_qual
      );
    ELSE
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK %s',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        new_check
      );
    END IF;
  END LOOP;
END;
$$;

-- Explicit deny policies document the backend-only access model.
DROP POLICY IF EXISTS "No public access" ON public.contact_messages;
CREATE POLICY "No public access"
  ON public.contact_messages FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No public access" ON public.lead_message_payloads;
CREATE POLICY "No public access"
  ON public.lead_message_payloads FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Performance: add missing FK coverage and remove one exact duplicate index.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bookings_course_id
  ON public.bookings(course_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id
  ON public.bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id
  ON public.contact_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_course_locations_course_id
  ON public.course_locations(course_id);

DROP INDEX IF EXISTS public.saved_courses_user_course_unique;

COMMIT;
