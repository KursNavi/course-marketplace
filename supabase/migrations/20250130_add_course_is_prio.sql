-- Add is_prio column to courses table for priority course functionality
-- Priority courses get boosted ranking in search results (Ranking-Bonus)
-- The number of allowed prio courses depends on the user's subscription plan

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS is_prio BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient filtering by priority status
CREATE INDEX IF NOT EXISTS idx_courses_is_prio ON courses(is_prio);

-- Composite index for queries filtering prio courses by user
CREATE INDEX IF NOT EXISTS idx_courses_prio_user ON courses(is_prio, user_id);

COMMENT ON COLUMN courses.is_prio IS 'Whether this course has priority status (boosted ranking). Limited by subscription plan.';
