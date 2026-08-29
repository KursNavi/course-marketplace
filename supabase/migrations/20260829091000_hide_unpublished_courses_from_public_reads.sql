-- Providers still need to see their own drafts, while anonymous and other
-- authenticated users may only read published (or legacy NULL-status) data.
-- This prevents draft course content, events and taxonomy assignments from
-- being exposed through the Supabase Data API.

DROP POLICY IF EXISTS "Anyone can read courses" ON courses;
CREATE POLICY "Public can read published courses and owners can read drafts"
  ON courses FOR SELECT
  TO anon, authenticated
  USING (
    status IS NULL
    OR status = 'published'
    OR (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Anyone can read course events" ON course_events;
CREATE POLICY "Public can read events for published courses"
  ON course_events FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM courses c
      WHERE c.id = course_events.course_id
        AND (
          c.status IS NULL
          OR c.status = 'published'
          OR (select auth.uid()) = c.user_id
        )
    )
  );

DROP POLICY IF EXISTS "cca_select" ON course_category_assignments;
CREATE POLICY "Public can read categories for published courses"
  ON course_category_assignments FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM courses c
      WHERE c.id = course_category_assignments.course_id
        AND (
          c.status IS NULL
          OR c.status = 'published'
          OR (select auth.uid()) = c.user_id
        )
    )
  );
