-- Migration: Link admin account to info@kursnavi.ch
-- Run this in the Supabase SQL Editor

-- 1. Delete orphaned admin profile (no matching auth user)
DELETE FROM profiles WHERE id = 'c7ffce39-d552-405f-b98e-5f8077871601';

-- 2. Upsert admin profile linked to the actual auth user
INSERT INTO profiles (id, full_name, email, role, package_tier, preferred_language)
SELECT id, 'KursNavi Admin', 'info@kursnavi.ch', 'admin', 'enterprise', 'de'
FROM auth.users WHERE email = 'info@kursnavi.ch'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = COALESCE(profiles.full_name, 'KursNavi Admin'),
  email = 'info@kursnavi.ch';

-- 3. Update auth metadata so session immediately has role='admin'
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'info@kursnavi.ch';
