-- Add cancellation fields to course_events for provider-initiated event cancellation
ALTER TABLE course_events
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT DEFAULT NULL;

-- Index for filtering active (non-cancelled) events
CREATE INDEX IF NOT EXISTS idx_course_events_cancelled_at
  ON course_events (cancelled_at)
  WHERE cancelled_at IS NULL;
