-- ============================================
-- Migration: Add package payment tracking fields
-- ============================================
-- Adds package_expires_at (annual expiry) and
-- package_stripe_session_id (idempotency guard for webhook).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS package_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS package_stripe_session_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS package_reminder_sent INTEGER DEFAULT NULL;

-- Index for cron job that finds expiring packages
CREATE INDEX IF NOT EXISTS idx_profiles_package_expires_at
  ON profiles (package_expires_at)
  WHERE package_expires_at IS NOT NULL;
