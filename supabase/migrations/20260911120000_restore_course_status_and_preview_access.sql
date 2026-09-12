-- Restore the provider write policies removed by the security hardening
-- migration and make direct course URLs usable for draft previews.
--
-- Draft remains a search/indexing state in the application. It is not a
-- protection boundary for the course detail URL: anyone with that URL may
-- inspect the same course detail, events, categories and locations.

BEGIN;

-- Direct URL / preview access: expose course detail data for both public roles.
DROP POLICY IF EXISTS "Anyone can read courses" ON public.courses;
DROP POLICY IF EXISTS "Courses: public read" ON public.courses;
DROP POLICY IF EXISTS "Public can read published courses and owners can read drafts"
  ON public.courses;
CREATE POLICY "Courses: public read all for URL previews"
  ON public.courses FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read course events" ON public.course_events;
DROP POLICY IF EXISTS "Course events: public read" ON public.course_events;
DROP POLICY IF EXISTS "Public can read events for published courses"
  ON public.course_events;
CREATE POLICY "Course events: public read all for URL previews"
  ON public.course_events FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "cca_select" ON public.course_category_assignments;
DROP POLICY IF EXISTS "Public can read categories for published courses"
  ON public.course_category_assignments;
CREATE POLICY "Course categories: public read all for URL previews"
  ON public.course_category_assignments FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_read_published_course_locations"
  ON public.course_locations;
DROP POLICY IF EXISTS "authenticated_read_course_locations"
  ON public.course_locations;
CREATE POLICY "Course locations: public read all for URL previews"
  ON public.course_locations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Providers must be able to update their own course status. Without an UPDATE
-- policy Supabase returns an empty update result instead of an error, so the UI
-- appeared to publish the course and then showed draft again after refresh.
DROP POLICY IF EXISTS "Owners can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Courses: insert own" ON public.courses;
CREATE POLICY "Courses: insert own"
  ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owners can update own courses" ON public.courses;
DROP POLICY IF EXISTS "Courses: update own" ON public.courses;
CREATE POLICY "Courses: update own"
  ON public.courses FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owners can delete own courses" ON public.courses;
DROP POLICY IF EXISTS "Courses: delete own" ON public.courses;
CREATE POLICY "Courses: delete own"
  ON public.courses FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Keep direct provider editing of dates working after the same hardening
-- migration removed the original course-event write policies.
DROP POLICY IF EXISTS "Course owners can insert events" ON public.course_events;
DROP POLICY IF EXISTS "Course events: owner insert" ON public.course_events;
CREATE POLICY "Course events: owner insert"
  ON public.course_events FOR INSERT
  TO authenticated
  WITH CHECK (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Course owners can update own events" ON public.course_events;
DROP POLICY IF EXISTS "Course events: owner update" ON public.course_events;
CREATE POLICY "Course events: owner update"
  ON public.course_events FOR UPDATE
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

DROP POLICY IF EXISTS "Course owners can delete own events" ON public.course_events;
DROP POLICY IF EXISTS "Course events: owner delete" ON public.course_events;
CREATE POLICY "Course events: owner delete"
  ON public.course_events FOR DELETE
  TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (select auth.uid())
    )
  );

COMMIT;

