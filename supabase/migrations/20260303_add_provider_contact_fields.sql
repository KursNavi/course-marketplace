-- Erweitert profiles um Kontakt- und Social-Felder für Anbieterprofil
-- Backward-kompatibel: alle Felder sind nullable, Frontend prüft auf NULL

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_linkedin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_instagram TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_facebook TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_youtube TEXT;
