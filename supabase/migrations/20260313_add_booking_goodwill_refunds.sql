BEGIN;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS goodwill_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS goodwill_status TEXT,
ADD COLUMN IF NOT EXISTS goodwill_request_message TEXT,
ADD COLUMN IF NOT EXISTS goodwill_decided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS goodwill_decided_by UUID,
ADD COLUMN IF NOT EXISTS goodwill_decision_message TEXT,
ADD COLUMN IF NOT EXISTS goodwill_refund_percent INTEGER,
ADD COLUMN IF NOT EXISTS goodwill_refund_amount_cents INTEGER,
ADD COLUMN IF NOT EXISTS goodwill_refunded_at TIMESTAMPTZ;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_goodwill_status_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_goodwill_status_check
CHECK (
  goodwill_status IS NULL OR goodwill_status IN ('pending', 'approved', 'declined')
);

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_goodwill_refund_percent_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_goodwill_refund_percent_check
CHECK (
  goodwill_refund_percent IS NULL OR goodwill_refund_percent IN (0, 25, 50, 100)
);

COMMENT ON COLUMN bookings.goodwill_requested_at IS 'Timestamp when the learner submitted a goodwill refund request after the automatic refund window.';
COMMENT ON COLUMN bookings.goodwill_status IS 'Goodwill request status: pending, approved or declined.';
COMMENT ON COLUMN bookings.goodwill_request_message IS 'Optional message from the learner to the provider explaining the goodwill request.';
COMMENT ON COLUMN bookings.goodwill_decided_at IS 'Timestamp when the provider decided on the goodwill request.';
COMMENT ON COLUMN bookings.goodwill_decided_by IS 'Provider user id who decided the goodwill request.';
COMMENT ON COLUMN bookings.goodwill_decision_message IS 'Optional provider message explaining the goodwill decision.';
COMMENT ON COLUMN bookings.goodwill_refund_percent IS 'Provider-approved goodwill refund percent: 0, 25, 50 or 100.';
COMMENT ON COLUMN bookings.goodwill_refund_amount_cents IS 'Actual refunded goodwill amount in cents.';
COMMENT ON COLUMN bookings.goodwill_refunded_at IS 'Timestamp when a goodwill refund was executed.';

CREATE INDEX IF NOT EXISTS idx_bookings_goodwill_status
ON bookings (goodwill_status)
WHERE goodwill_status IS NOT NULL;

COMMIT;
