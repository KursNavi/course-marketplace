-- Replace the two simple location columns (added yesterday) with a proper
-- course_locations table that supports multiple locations per course and
-- location types (presence / online / ausland).

-- 1. Remove the simple columns we added previously
ALTER TABLE courses DROP COLUMN IF EXISTS location_street;
ALTER TABLE courses DROP COLUMN IF EXISTS location_city;

-- 2. Create the course_locations table
CREATE TABLE IF NOT EXISTS course_locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   BIGINT      NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  location_type TEXT      NOT NULL DEFAULT 'presence'
                          CHECK (location_type IN ('presence', 'online', 'ausland')),
  street      TEXT,
  city        TEXT,
  canton      TEXT,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Row-Level Security
ALTER TABLE course_locations ENABLE ROW LEVEL SECURITY;

-- Providers can manage locations for their own courses
CREATE POLICY "providers_manage_own_course_locations"
  ON course_locations
  FOR ALL
  USING (
    course_id IN (SELECT id FROM courses WHERE user_id = auth.uid())
  );

-- Public can read locations for published courses
CREATE POLICY "public_read_published_course_locations"
  ON course_locations
  FOR SELECT
  USING (
    course_id IN (SELECT id FROM courses WHERE status = 'published')
  );
