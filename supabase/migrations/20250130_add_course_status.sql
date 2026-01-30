-- Add status column to courses table for draft/publish functionality
-- Status values: 'draft' (only visible to owner), 'published' (public), 'paused' (temporarily hidden)

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
CHECK (status IN ('draft', 'published', 'paused'));

-- Index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);

-- Composite index for common queries (status + user_id for teacher's own courses)
CREATE INDEX IF NOT EXISTS idx_courses_status_user ON courses(status, user_id);

COMMENT ON COLUMN courses.status IS 'Course visibility status: draft (owner-only), published (public), paused (temporarily hidden)';
