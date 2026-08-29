-- Drafts may be saved without a category, but public courses must always have
-- a real primary taxonomy assignment. Keep this rule at the database boundary
-- so direct Supabase/API updates cannot bypass the UI and admin checks.
CREATE OR REPLACE FUNCTION prevent_uncategorized_course_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published'
     AND NEW.category_level3_id IS NULL
     AND NEW.category_specialty_id IS NULL
     AND NOT EXISTS (
       SELECT 1
       FROM course_category_assignments cca
       WHERE cca.course_id = NEW.id
         AND cca.is_primary = true
         AND cca.level3_id IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'A course cannot be published without a complete primary category'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courses_require_category_on_publish ON courses;

CREATE TRIGGER courses_require_category_on_publish
  BEFORE INSERT OR UPDATE OF status, category_level3_id, category_specialty_id
  ON courses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_uncategorized_course_publish();
