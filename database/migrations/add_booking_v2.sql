-- Migration: Booking System v2
-- Adds: platform_flex booking type, ticket_periods, auto-refund logic

-- =============================================
-- 1. COURSES TABLE: Extend booking_type + add ticket_limit_30d
-- =============================================

-- Drop existing constraint and add new one with platform_flex
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_booking_type_check;
ALTER TABLE courses ADD CONSTRAINT courses_booking_type_check
  CHECK (booking_type IN ('lead', 'platform', 'platform_flex'));

-- Ticket-Limit field (NULL = unlimited)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ticket_limit_30d INTEGER DEFAULT NULL;

-- =============================================
-- 2. BOOKINGS TABLE: Add new columns
-- =============================================

-- Add new fields for v2 booking system
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_refund_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_type TEXT,
  ADD COLUMN IF NOT EXISTS ticket_period_id UUID;

-- Make event_id nullable (required for platform_flex)
ALTER TABLE bookings ALTER COLUMN event_id DROP NOT NULL;

-- Status constraint: only confirmed/refunded (MVP)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'refunded'));

-- Idempotency: Stripe Session ID must be unique
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_stripe_session_unique;
ALTER TABLE bookings ADD CONSTRAINT bookings_stripe_session_unique
  UNIQUE (stripe_checkout_session_id);

-- Duplicate protection: User can only book an event once
DROP INDEX IF EXISTS idx_bookings_user_event_unique;
CREATE UNIQUE INDEX idx_bookings_user_event_unique
  ON bookings (user_id, event_id)
  WHERE event_id IS NOT NULL AND status = 'confirmed';

-- =============================================
-- 3. NEW TABLE: ticket_periods
-- =============================================

CREATE TABLE IF NOT EXISTS ticket_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sold_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ticket_periods_course ON ticket_periods(course_id);
CREATE INDEX IF NOT EXISTS idx_ticket_periods_active ON ticket_periods(course_id, period_end);

-- =============================================
-- 4. DATABASE FUNCTIONS
-- =============================================

-- Function: Get or create current ticket period
CREATE OR REPLACE FUNCTION get_or_create_ticket_period(p_course_id UUID)
RETURNS ticket_periods AS $$
DECLARE
  current_period ticket_periods;
  new_period_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO current_period
  FROM ticket_periods
  WHERE course_id = p_course_id
    AND period_end > NOW()
  ORDER BY period_start DESC
  LIMIT 1;

  IF current_period IS NULL THEN
    new_period_start := NOW();
    INSERT INTO ticket_periods (course_id, period_start, period_end, sold_count)
    VALUES (p_course_id, new_period_start, new_period_start + INTERVAL '30 days', 0)
    RETURNING * INTO current_period;
  END IF;

  RETURN current_period;
END;
$$ LANGUAGE plpgsql;

-- Function: Check ticket availability (for UI + pre-checkout)
CREATE OR REPLACE FUNCTION check_ticket_availability(p_course_id UUID)
RETURNS TABLE(available BOOLEAN, remaining INTEGER, period_end TIMESTAMPTZ) AS $$
DECLARE
  course_limit INTEGER;
  period ticket_periods;
BEGIN
  SELECT ticket_limit_30d INTO course_limit FROM courses WHERE id = p_course_id;

  IF course_limit IS NULL THEN
    RETURN QUERY SELECT true, NULL::INTEGER, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  period := get_or_create_ticket_period(p_course_id);

  RETURN QUERY SELECT
    (period.sold_count < course_limit),
    (course_limit - period.sold_count),
    period.period_end;
END;
$$ LANGUAGE plpgsql;

-- Function: Reserve ticket (with row lock)
CREATE OR REPLACE FUNCTION reserve_ticket(p_course_id UUID)
RETURNS TABLE(success BOOLEAN, period_id UUID) AS $$
DECLARE
  course_limit INTEGER;
  period ticket_periods;
BEGIN
  SELECT ticket_limit_30d INTO course_limit FROM courses WHERE id = p_course_id;

  IF course_limit IS NULL THEN
    RETURN QUERY SELECT true, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO period
  FROM ticket_periods
  WHERE course_id = p_course_id AND period_end > NOW()
  ORDER BY period_start DESC
  LIMIT 1
  FOR UPDATE;

  IF period IS NULL THEN
    period := get_or_create_ticket_period(p_course_id);
    -- Re-lock after insert
    SELECT * INTO period
    FROM ticket_periods
    WHERE id = period.id
    FOR UPDATE;
  END IF;

  IF period.sold_count >= course_limit THEN
    RETURN QUERY SELECT false, NULL::UUID;
    RETURN;
  END IF;

  UPDATE ticket_periods
  SET sold_count = sold_count + 1
  WHERE id = period.id;

  RETURN QUERY SELECT true, period.id;
END;
$$ LANGUAGE plpgsql;

-- Function: Release ticket on refund (only if period still active)
CREATE OR REPLACE FUNCTION release_ticket(p_period_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE ticket_periods
  SET sold_count = GREATEST(0, sold_count - 1)
  WHERE id = p_period_id AND period_end > NOW();

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. COMMENTS
-- =============================================

COMMENT ON COLUMN courses.ticket_limit_30d IS 'Maximum bookings allowed per 30-day period. NULL means unlimited.';
COMMENT ON COLUMN bookings.paid_at IS 'Timestamp when payment was confirmed';
COMMENT ON COLUMN bookings.auto_refund_until IS 'Deadline for automatic refund eligibility';
COMMENT ON COLUMN bookings.payout_eligible_at IS 'Timestamp when payout can be processed';
COMMENT ON COLUMN bookings.booking_type IS 'Type of booking: lead, platform, or platform_flex';
COMMENT ON COLUMN bookings.ticket_period_id IS 'Reference to ticket_period for quota tracking';
COMMENT ON TABLE ticket_periods IS 'Tracks 30-day booking quotas per course';
