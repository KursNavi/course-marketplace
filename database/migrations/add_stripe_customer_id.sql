-- Add stripe_customer_id column to profiles table
-- This will store the Stripe Customer ID for each user to enable
-- access to the Stripe Customer Portal for billing management

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
ON profiles(stripe_customer_id);

-- Add comment to document the column
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe Customer ID for billing portal access';
