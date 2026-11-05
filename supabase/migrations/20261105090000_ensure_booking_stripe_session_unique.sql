-- ============================================================================
-- Migration: Make the Stripe checkout session uniqueness guard explicit
-- ============================================================================
-- api/webhook.js and api/confirm-checkout-session.js both insert a booking
-- row after a successful Stripe payment and rely on Postgres error code
-- 23505 (unique_violation) to detect "this session already created a
-- booking" -- used as idempotency protection against the webhook and the
-- client-triggered confirm call both firing for the same checkout session.
--
-- No tracked migration creates either the `stripe_checkout_session_id`
-- column or a uniqueness guard on it -- the `bookings` table predates the
-- migration history. This migration makes that already-relied-upon
-- invariant explicit and reproducible in any environment.
--
-- Both statements are defensive (IF NOT EXISTS) and safe to run regardless
-- of the current state of a given database.
-- ============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

-- Partial index: bookings paid via account credit (see
-- api/book-with-credit.js) have stripe_checkout_session_id = null and must
-- not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_checkout_session_id_key
  ON public.bookings (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
