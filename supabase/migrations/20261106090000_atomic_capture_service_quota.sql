-- ============================================================================
-- Migration: Atomic capture-service quota check-and-increment
-- ============================================================================
-- api/create-capture-service-checkout.js and api/webhook.js both read
-- profiles.used_capture_services and later write it back with a plain
-- UPDATE, with no row lock in between. Two concurrent requests for the same
-- user can both read the same stale value and both commit based on it,
-- losing one of the increments (lost-update) -- in the free-quota path this
-- lets a provider consume more free capture-service units than their
-- package includes.
--
-- Mirrors the existing deduct_credit/add_credit pattern (see
-- 20260314_fix_credit_booking_id_type.sql): SELECT ... FOR UPDATE to lock
-- the row, then compute and write within the same function call so the
-- check-and-increment is atomic.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS used_capture_services integer NOT NULL DEFAULT 0;

-- Reserves up to p_requested_units free units against a user's included
-- capture-service quota, atomically. Returns how many were actually free
-- (may be less than requested if the quota was exhausted concurrently) and
-- the resulting used_capture_services total.
CREATE OR REPLACE FUNCTION public.reserve_free_capture_service_units(
  p_user_id uuid,
  p_requested_units integer,
  p_included_units integer
)
RETURNS TABLE(free_units integer, used_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
  v_free integer;
  v_used_after integer;
BEGIN
  SELECT COALESCE(used_capture_services, 0) INTO v_used
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  v_free := LEAST(GREATEST(0, p_included_units - v_used), GREATEST(0, p_requested_units));

  IF v_free > 0 THEN
    UPDATE profiles
      SET used_capture_services = v_used + v_free
      WHERE id = p_user_id
      RETURNING used_capture_services INTO v_used_after;
  ELSE
    v_used_after := v_used;
  END IF;

  RETURN QUERY SELECT v_free, v_used_after;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_free_capture_service_units(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_free_capture_service_units(uuid, integer, integer)
  TO service_role;

-- Atomically adds p_units to a user's used_capture_services counter
-- (used when a paid capture-service checkout completes).
CREATE OR REPLACE FUNCTION public.increment_capture_service_usage(
  p_user_id uuid,
  p_units integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used_after integer;
BEGIN
  UPDATE profiles
    SET used_capture_services = COALESCE(used_capture_services, 0) + p_units
    WHERE id = p_user_id
    RETURNING used_capture_services INTO v_used_after;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  RETURN v_used_after;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_capture_service_usage(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_capture_service_usage(uuid, integer)
  TO service_role;
