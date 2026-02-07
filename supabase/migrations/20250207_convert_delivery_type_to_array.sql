-- Migration: Convert delivery_type from TEXT to TEXT[] for multi-select support
-- This allows courses to have multiple delivery formats (e.g., both presence and online_live)
-- Created: 2025-02-07

-- Step 1: Add new column delivery_types as TEXT array
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS delivery_types TEXT[] DEFAULT ARRAY['presence']::TEXT[];

-- Step 2: Migrate existing data from delivery_type to delivery_types
-- Convert single value to array
UPDATE courses
SET delivery_types = ARRAY[delivery_type]::TEXT[]
WHERE delivery_type IS NOT NULL
  AND (delivery_types IS NULL OR delivery_types = ARRAY['presence']::TEXT[]);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN courses.delivery_types IS 'Course delivery formats (array): presence (in-person), online_live (live online/Zoom), self_study (asynchronous). Multiple values allowed.';

-- Step 4: Create GIN index for efficient array queries (contains/overlaps)
CREATE INDEX IF NOT EXISTS idx_courses_delivery_types ON courses USING GIN(delivery_types);

-- Step 5: Drop old column (optional - keep for backward compatibility during transition)
-- Uncomment when ready to fully migrate:
-- ALTER TABLE courses DROP COLUMN IF EXISTS delivery_type;

-- Note: The old delivery_type column is kept for backward compatibility.
-- Once all code is updated to use delivery_types, run the DROP statement above.
