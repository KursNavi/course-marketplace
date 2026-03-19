-- Anbieter-Email direkt korrigieren (umgeht Bestätigungs-Flow)
-- ============================================================
-- ANLEITUNG: Alte und neue Email unten einsetzen, dann ausführen.

UPDATE auth.users
SET
  email = 'NEUE_EMAIL@example.com',
  email_confirmed_at = now()
WHERE email = 'ALTE_FALSCHE_EMAIL@example.com';

UPDATE public.profiles
SET email = 'NEUE_EMAIL@example.com'
WHERE email = 'ALTE_FALSCHE_EMAIL@example.com';
