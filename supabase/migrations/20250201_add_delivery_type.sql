-- Migration: Add delivery_type to courses table
-- This supports filtering for Online Live, In-Person, and Self-Study courses
-- Created: 2025-02-01

-- Add delivery_type column to courses table
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'presence';

-- Add comment for documentation
COMMENT ON COLUMN courses.delivery_type IS 'Course delivery format: presence (in-person), online_live (live online), self_study (asynchronous)';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_courses_delivery_type ON courses(delivery_type);
