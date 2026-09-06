-- Allow providers to read the locations belonging to their own courses.
-- Public users continue to see locations only for published courses.

DROP POLICY IF EXISTS "providers_select_own_course_locations" ON public.course_locations;

CREATE POLICY "providers_select_own_course_locations"
  ON public.course_locations FOR SELECT
  TO authenticated
  USING (
    course_id IN (
      SELECT c.id
      FROM public.courses c
      WHERE c.user_id = (SELECT auth.uid())
    )
  );
