-- Add price_info text field to courses table
-- This allows providers to enter a free-text price description
-- (e.g. "CHF 150 pro Person" or "CHF 50–200 je nach Paket")
-- The existing numeric `price` column is kept for Stripe payments and analytics.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_info TEXT;
