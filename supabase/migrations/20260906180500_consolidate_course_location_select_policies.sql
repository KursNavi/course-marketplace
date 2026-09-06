-- Keep course-location SELECT policies non-overlapping for authenticated users.
-- Anonymous users may read locations only for published courses; authenticated
-- users may additionally read locations belonging to their own courses.

DROP POLICY IF EXISTS "providers_select_own_course_locations" ON public.course_locations;
DROP POLICY IF EXISTS "public_read_published_course_locations" ON public.course_locations;

CREATE POLICY "public_read_published_course_locations"
  ON public.course_locations FOR SELECT
  TO anon
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.status = 'published'
    )
  );

CREATE POLICY "authenticated_read_course_locations"
  ON public.course_locations FOR SELECT
  TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.status = 'published'
         OR c.user_id = (SELECT auth.uid())
    )
  );
