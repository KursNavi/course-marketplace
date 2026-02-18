-- Migration: Remove contact_email from course_private
-- Reason: Lead inquiries will use the provider's account email instead

-- Remove the contact_email column from course_private table
ALTER TABLE course_private DROP COLUMN IF EXISTS contact_email;

-- Add comment explaining the change
COMMENT ON TABLE course_private IS 'Stores private course data. Lead contact emails now use provider account email from profiles table.';
