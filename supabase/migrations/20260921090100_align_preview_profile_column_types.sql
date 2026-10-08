-- Match the existing production types for package checkout metadata.

ALTER TABLE public.profiles
  ALTER COLUMN pending_package_tier TYPE character varying
  USING pending_package_tier::character varying;

ALTER TABLE public.profiles
  ALTER COLUMN pending_package_stripe_session_id TYPE character varying
  USING pending_package_stripe_session_id::character varying;
