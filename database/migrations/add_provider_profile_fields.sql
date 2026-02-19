-- ============================================
-- Provider Profile Fields Migration
-- KursNavi Anbieter-Profile (Directory + Public Profiles)
-- Created: 2026-02-18
-- ============================================

-- NOTE: Run this migration against your Supabase database
-- These fields enable public provider profiles and the provider directory

-- ============================================
-- 1. Add Provider Profile Fields to profiles table
-- ============================================

-- Provider slug for public URL (e.g., /anbieter/aquakidz)
-- Auto-generated from full_name, editable by Pro+ (max 1x/month)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slug TEXT;

-- Provider description for public profile page
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provider_description TEXT;

-- Logo URL for provider branding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Cover image URL (Enterprise feature)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Opt-in public contact email (NOT the login email)
-- Prevents spam by separating account email from public contact
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_contact_email TEXT;

-- Gate for public visibility: NULL = not published, timestamp = published
-- Provider must explicitly publish their profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_published_at TIMESTAMPTZ;

-- Rate limiting for slug changes (max 1x per month)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_slug_change_at TIMESTAMPTZ;

-- ============================================
-- 2. Create Indices for Performance
-- ============================================

-- Unique index on slug (only where slug is not null)
-- This ensures slugs are unique across all providers
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug
ON profiles(slug)
WHERE slug IS NOT NULL;

-- Directory listing index for fast filtering
-- Used by /api/providers/directory endpoint
CREATE INDEX IF NOT EXISTS idx_profiles_directory
ON profiles(package_tier, verification_status, canton)
WHERE profile_published_at IS NOT NULL;

-- Index for finding profiles by published state
CREATE INDEX IF NOT EXISTS idx_profiles_published
ON profiles(profile_published_at)
WHERE profile_published_at IS NOT NULL;

-- ============================================
-- 3. Slug Aliases Table (SEO Stability)
-- ============================================
-- When a provider changes their slug, we keep the old one
-- to support redirects and prevent broken links

CREATE TABLE IF NOT EXISTS provider_slug_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    old_slug TEXT NOT NULL,
    new_slug TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast alias lookup
CREATE INDEX IF NOT EXISTS idx_slug_aliases_old
ON provider_slug_aliases(old_slug);

-- Index for finding all aliases of a provider
CREATE INDEX IF NOT EXISTS idx_slug_aliases_provider
ON provider_slug_aliases(provider_id);

-- ============================================
-- 4. Helper Function: Generate Provider Slug
-- ============================================
-- Generates a URL-safe slug from provider name
-- Handles German umlauts and special characters

CREATE OR REPLACE FUNCTION generate_provider_slug(provider_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INT := 2;
BEGIN
    -- Convert to lowercase and handle German umlauts
    base_slug := lower(trim(provider_name));
    base_slug := replace(base_slug, 'ä', 'ae');
    base_slug := replace(base_slug, 'ö', 'oe');
    base_slug := replace(base_slug, 'ü', 'ue');
    base_slug := replace(base_slug, 'ß', 'ss');
    base_slug := replace(base_slug, '&', ' und ');

    -- Remove non-alphanumeric characters (keep hyphens)
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');

    -- Remove leading/trailing hyphens
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');

    -- Ensure minimum length
    IF length(base_slug) < 3 THEN
        base_slug := 'anbieter';
    END IF;

    -- Check for collision and add suffix if needed
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM profiles WHERE slug = final_slug) LOOP
        final_slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;

    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Helper Function: Check Slug Change Cooldown
-- ============================================
-- Returns TRUE if the provider can change their slug
-- (no change in the last 30 days)

CREATE OR REPLACE FUNCTION can_change_slug(provider_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_change TIMESTAMPTZ;
BEGIN
    SELECT last_slug_change_at INTO last_change
    FROM profiles
    WHERE id = provider_id;

    -- If never changed, allow
    IF last_change IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Allow if more than 30 days have passed
    RETURN (NOW() - last_change) > INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. RLS Policies for New Fields
-- ============================================

-- Users can read public profile fields of published providers
-- (slug, provider_description, logo_url, cover_image_url, public_contact_email)
-- Note: This requires existing RLS to be enabled on profiles table

-- Policy: Anyone can read published provider profiles
-- (The actual data filtering happens in the API layer based on tier)

-- ============================================
-- 7. Trigger: Auto-generate slug on profile creation
-- ============================================
-- Only for providers (teachers) with Pro+ tier

CREATE OR REPLACE FUNCTION auto_generate_provider_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate slug for teachers without existing slug
    IF NEW.role = 'teacher' AND NEW.slug IS NULL AND NEW.full_name IS NOT NULL THEN
        -- Only auto-generate for Pro+ tiers
        IF NEW.package_tier IN ('pro', 'premium', 'enterprise') THEN
            NEW.slug := generate_provider_slug(NEW.full_name);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_auto_generate_slug ON profiles;

CREATE TRIGGER trg_auto_generate_slug
BEFORE INSERT OR UPDATE OF full_name, package_tier ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_generate_provider_slug();

-- ============================================
-- 8. Trigger: Track slug changes for aliases
-- ============================================

CREATE OR REPLACE FUNCTION track_slug_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if slug actually changed and both values are not null
    IF OLD.slug IS NOT NULL AND NEW.slug IS NOT NULL AND OLD.slug != NEW.slug THEN
        -- Insert alias record
        INSERT INTO provider_slug_aliases (provider_id, old_slug, new_slug)
        VALUES (NEW.id, OLD.slug, NEW.slug);

        -- Update last change timestamp
        NEW.last_slug_change_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_track_slug_change ON profiles;

CREATE TRIGGER trg_track_slug_change
BEFORE UPDATE OF slug ON profiles
FOR EACH ROW
EXECUTE FUNCTION track_slug_change();

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- To rollback this migration, run:
/*
DROP TRIGGER IF EXISTS trg_track_slug_change ON profiles;
DROP TRIGGER IF EXISTS trg_auto_generate_slug ON profiles;
DROP FUNCTION IF EXISTS track_slug_change();
DROP FUNCTION IF EXISTS auto_generate_provider_slug();
DROP FUNCTION IF EXISTS can_change_slug(UUID);
DROP FUNCTION IF EXISTS generate_provider_slug(TEXT);
DROP TABLE IF EXISTS provider_slug_aliases;
DROP INDEX IF EXISTS idx_profiles_published;
DROP INDEX IF EXISTS idx_profiles_directory;
DROP INDEX IF EXISTS idx_profiles_slug;
ALTER TABLE profiles DROP COLUMN IF EXISTS last_slug_change_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS profile_published_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS public_contact_email;
ALTER TABLE profiles DROP COLUMN IF EXISTS cover_image_url;
ALTER TABLE profiles DROP COLUMN IF EXISTS logo_url;
ALTER TABLE profiles DROP COLUMN IF EXISTS provider_description;
ALTER TABLE profiles DROP COLUMN IF EXISTS slug;
*/
