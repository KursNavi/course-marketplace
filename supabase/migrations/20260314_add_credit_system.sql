BEGIN;

-- 1. Add credit balance to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_balance_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_credit_balance_non_negative;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_credit_balance_non_negative
  CHECK (credit_balance_cents >= 0);

-- 2. Credit transactions audit table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_booking_id BIGINT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('cancellation_credit', 'booking_deduction'));

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id
  ON credit_transactions(user_id);

-- 3. Add credit tracking columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS credit_used_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_via_credit BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. RLS for credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credit transactions" ON credit_transactions;

CREATE POLICY "Users can read own credit transactions"
  ON credit_transactions FOR SELECT
  USING (user_id = auth.uid());

-- 5. RPC: Add credit (cancellation refund)
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

-- 6. RPC: Deduct credit (booking checkout)
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

COMMENT ON COLUMN profiles.credit_balance_cents IS 'Platform credit balance in CHF centimes. Added on customer cancellation, deducted at checkout. Never expires.';
COMMENT ON TABLE credit_transactions IS 'Audit trail for all credit balance changes.';
COMMENT ON COLUMN bookings.credit_used_cents IS 'Amount of platform credit applied to this booking in CHF centimes.';
COMMENT ON COLUMN bookings.paid_via_credit IS 'TRUE if booking was fully paid with platform credit (no Stripe payment).';

COMMIT;
