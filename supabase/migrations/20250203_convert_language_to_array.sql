-- ============================================
-- Migration: Convert language from TEXT to TEXT[]
-- Date: 2025-02-03
-- Purpose: Allow courses to have multiple languages
-- ============================================

-- Step 1: Add new column for languages array
ALTER TABLE courses ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['Deutsch'];

-- Step 2: Migrate existing data from language (TEXT) to languages (TEXT[])
-- Convert single language values to arrays
UPDATE courses
SET languages = ARRAY[language]
WHERE language IS NOT NULL AND language != '';

-- Step 3: Handle NULL or empty language values - default to Deutsch
UPDATE courses
SET languages = ARRAY['Deutsch']
WHERE languages IS NULL OR languages = '{}';

-- Step 4: Drop the old language column (after verifying migration)
-- IMPORTANT: Only run this after confirming the migration worked!
-- For safety, we'll keep the old column for now and can drop it later
-- ALTER TABLE courses DROP COLUMN language;

-- Step 5: Create index for array search performance
CREATE INDEX IF NOT EXISTS idx_courses_languages ON courses USING GIN (languages);

-- ============================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================

-- Check migration results:
-- SELECT id, title, language, languages FROM courses LIMIT 20;

-- Verify all courses have languages array:
-- SELECT COUNT(*) FROM courses WHERE languages IS NULL OR languages = '{}';

-- Example: Find all courses that include German:
-- SELECT id, title, languages FROM courses WHERE 'Deutsch' = ANY(languages);

-- Example: Find courses available in multiple languages:
-- SELECT id, title, languages FROM courses WHERE array_length(languages, 1) > 1;
