-- ============================================
-- Migration: Fix Security Advisor Warnings
-- ============================================
-- 1. Set search_path on all functions missing it
-- 2. Revoke public API access to materialized view v_taxonomy_paths
-- 3. Restrict course_views INSERT policy
-- ============================================


-- ============================================
-- 1. SET search_path ON ALL FUNCTIONS
-- ============================================
-- Prevents search_path hijacking on SECURITY DEFINER functions.
-- Using ALTER FUNCTION to avoid recreating complex function bodies.

-- Ticket system functions (created via Dashboard, not in migrations)
ALTER FUNCTION get_or_create_ticket_period SET search_path = public;
ALTER FUNCTION check_ticket_availability SET search_path = public;
ALTER FUNCTION reserve_ticket SET search_path = public;
ALTER FUNCTION release_ticket SET search_path = public;

-- Slug management functions (created via Dashboard)
ALTER FUNCTION generate_provider_slug SET search_path = public;
ALTER FUNCTION can_change_slug SET search_path = public;
ALTER FUNCTION auto_generate_provider_slug SET search_path = public;
ALTER FUNCTION track_slug_change SET search_path = public;

-- Account deletion
ALTER FUNCTION delete_provider_account SET search_path = public;

-- Analytics functions
ALTER FUNCTION get_provider_analytics SET search_path = public;
ALTER FUNCTION get_course_performance SET search_path = public;

-- Taxonomy refresh trigger function
ALTER FUNCTION refresh_taxonomy_paths SET search_path = public;


-- ============================================
-- 2. MATERIALIZED VIEW API ACCESS (kept open)
-- ============================================
-- v_taxonomy_paths is used by v_course_full_categories which has
-- security_invoker = true, meaning the calling user's permissions apply.
-- Therefore anon/authenticated MUST retain SELECT to load courses.
-- No REVOKE needed here.


-- ============================================
-- 3. RESTRICT course_views INSERT POLICY
-- ============================================
-- The current policy allows unrestricted INSERT (WITH CHECK true).
-- We keep it open for anonymous tracking but require that the
-- viewer_id matches the authenticated user (if logged in) or is NULL
-- (for anonymous visitors). This prevents spoofing viewer_id.

DROP POLICY IF EXISTS "Anyone can insert views" ON course_views;

CREATE POLICY "Anyone can insert views"
  ON course_views FOR INSERT
  WITH CHECK (
    viewer_id IS NULL OR viewer_id = auth.uid()
  );
