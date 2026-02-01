-- Add stripe_connect_account_id column to profiles table
-- This will store the Stripe Connect Account ID for providers to receive payouts

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;

-- Add column to track Connect onboarding completion status
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account_id
ON profiles(stripe_connect_account_id);

-- Add comments to document the columns
COMMENT ON COLUMN profiles.stripe_connect_account_id IS 'Stripe Connect Account ID for receiving payouts from course bookings';
COMMENT ON COLUMN profiles.stripe_connect_onboarding_complete IS 'Whether the provider has completed Stripe Connect onboarding (KYC, bank account)';
