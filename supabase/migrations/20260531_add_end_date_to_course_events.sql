-- Add optional end_date to course_events
-- Used for lead courses with multi-day events (e.g. Feriencamps)
ALTER TABLE public.course_events
  ADD COLUMN end_date timestamptz NULL;
