-- Remove legacy "paused" course status.
-- Normalize any remaining paused rows to draft, then tighten the CHECK constraint.

BEGIN;

UPDATE courses
SET status = 'draft'
WHERE status = 'paused';

ALTER TABLE courses
DROP CONSTRAINT IF EXISTS courses_status_check;

ALTER TABLE courses
ADD CONSTRAINT courses_status_check
CHECK (status IN ('draft', 'published'));

COMMENT ON COLUMN courses.status IS 'Course visibility status: draft (owner-only), published (public)';

COMMIT;
