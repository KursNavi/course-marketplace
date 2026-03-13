BEGIN;

-- Fix: reference_booking_id was UUID but bookings.id is BIGINT
ALTER TABLE credit_transactions
  ALTER COLUMN reference_booking_id TYPE BIGINT USING reference_booking_id::text::bigint;

-- Drop OLD function signatures (UUID param) before recreating with BIGINT
DROP FUNCTION IF EXISTS add_credit(UUID, INTEGER, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS deduct_credit(UUID, INTEGER, UUID, TEXT);

-- Recreate add_credit with correct parameter type
CREATE OR REPLACE FUNCTION add_credit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_type TEXT,
  p_reference_booking_id BIGINT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(new_balance_cents INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE profiles
    SET credit_balance_cents = credit_balance_cents + p_amount_cents
    WHERE id = p_user_id
    RETURNING credit_balance_cents INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  INSERT INTO credit_transactions
    (user_id, amount_cents, balance_after_cents, type, reference_booking_id, description)
  VALUES
    (p_user_id, p_amount_cents, v_new_balance, p_type, p_reference_booking_id, p_description);

  RETURN QUERY SELECT v_new_balance;
END;
$$;

-- Recreate deduct_credit with correct parameter type
CREATE OR REPLACE FUNCTION deduct_credit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_reference_booking_id BIGINT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(new_balance_cents INTEGER, actually_deducted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_deduct INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT credit_balance_cents INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  v_deduct := LEAST(p_amount_cents, v_current_balance);

  IF v_deduct <= 0 THEN
    RETURN QUERY SELECT v_current_balance, 0;
    RETURN;
  END IF;

  UPDATE profiles
    SET credit_balance_cents = credit_balance_cents - v_deduct
    WHERE id = p_user_id
    RETURNING credit_balance_cents INTO v_new_balance;

  INSERT INTO credit_transactions
    (user_id, amount_cents, balance_after_cents, type, reference_booking_id, description)
  VALUES
    (p_user_id, -v_deduct, v_new_balance, 'booking_deduction', p_reference_booking_id, p_description);

  RETURN QUERY SELECT v_new_balance, v_deduct;
END;
$$;

COMMIT;
