BEGIN;

CREATE OR REPLACE FUNCTION refund_booking_to_credit(
  p_booking_id BIGINT,
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  new_balance_cents INTEGER,
  ticket_period_id BIGINT,
  already_processed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_new_balance INTEGER;
BEGIN
  IF p_amount_cents < 0 THEN
    RAISE EXCEPTION 'Refund amount must be non-negative';
  END IF;

  SELECT *
    INTO v_booking
    FROM bookings
    WHERE id = p_booking_id
      AND user_id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  IF v_booking.status = 'refunded' OR v_booking.refunded_at IS NOT NULL THEN
    SELECT credit_balance_cents
      INTO v_new_balance
      FROM profiles
      WHERE id = p_user_id;

    RETURN QUERY SELECT v_new_balance, v_booking.ticket_period_id, TRUE;
    RETURN;
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking is not active: %', p_booking_id;
  END IF;

  IF p_amount_cents > 0 THEN
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
      (p_user_id, p_amount_cents, v_new_balance, 'cancellation_credit', p_booking_id, p_description);
  ELSE
    SELECT credit_balance_cents
      INTO v_new_balance
      FROM profiles
      WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'User profile not found: %', p_user_id;
    END IF;
  END IF;

  UPDATE bookings
    SET status = 'refunded',
        refunded_at = COALESCE(refunded_at, now())
    WHERE id = p_booking_id;

  RETURN QUERY SELECT v_new_balance, v_booking.ticket_period_id, FALSE;
END;
$$;

COMMIT;
