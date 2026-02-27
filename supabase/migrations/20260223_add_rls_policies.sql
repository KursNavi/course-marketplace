-- ============================================
-- Migration: Add RLS policies for unrestricted tables
-- ============================================
-- This migration adds Row Level Security policies to:
-- 1. provider_slug_aliases - public read, trigger-managed writes
-- 2. ticket_periods - provider read own, RPC-managed writes
-- ============================================

-- ============================================
-- 1. PROVIDER_SLUG_ALIASES
-- ============================================
-- Purpose: Store old provider slugs for URL redirects
-- Access: Public read (for redirects), writes only via database trigger

ALTER TABLE provider_slug_aliases ENABLE ROW LEVEL SECURITY;

-- Public can read all aliases (needed for redirect lookups without auth)
CREATE POLICY "Anyone can read slug aliases for redirects"
  ON provider_slug_aliases
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for regular users
-- Writes are handled by the track_slug_change() trigger with SECURITY DEFINER

-- ============================================
-- 2. TICKET_PERIODS
-- ============================================
-- Purpose: Track 30-day booking quotas per course
-- Access: Providers can read their own course periods, writes via RPC functions

ALTER TABLE ticket_periods ENABLE ROW LEVEL SECURITY;

-- Providers can read ticket periods for their own courses
CREATE POLICY "Providers can read own course ticket periods"
  ON ticket_periods
  FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM courses WHERE user_id = auth.uid()
    )
  );

-- No direct INSERT/UPDATE/DELETE policies for regular users
-- All modifications are handled by SECURITY DEFINER functions:
-- - get_or_create_ticket_period()
-- - reserve_ticket()
-- - release_ticket()
