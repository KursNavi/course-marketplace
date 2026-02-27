-- Migration: Create course_views table for analytics tracking
-- Tracks impressions (search results) and detail views per course

CREATE TABLE IF NOT EXISTS course_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL CHECK (view_type IN ('impression', 'detail')),
  viewer_id UUID,  -- NULL for anonymous visitors
  source TEXT DEFAULT 'search',  -- 'search', 'category', 'home', 'direct', 'provider_profile'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX idx_course_views_course_id ON course_views(course_id);
CREATE INDEX idx_course_views_created_at ON course_views(created_at);
CREATE INDEX idx_course_views_course_date ON course_views(course_id, created_at);

-- RLS: Anyone can insert views (including anonymous), only course owners can read
ALTER TABLE course_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert views"
  ON course_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Course owners can read their views"
  ON course_views FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );
