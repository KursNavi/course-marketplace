-- Add exact address fields to courses for lead/flex booking types.
-- These store the provider's location (street, city) so we can add map support later.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_street TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_city TEXT;
