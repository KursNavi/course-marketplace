-- Add street column to profiles table for full address support
-- The additional_locations column stores JSON; its internal structure is updated via app code.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street TEXT;
