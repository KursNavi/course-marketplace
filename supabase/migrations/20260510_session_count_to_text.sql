-- Change session_count from INTEGER to TEXT
-- Allows free-text entries like "8 Einheiten à 60 Min." or "4–8 Lektionen je nach Gruppe"
-- This field is not used in any payments or analytics functions, so the type change is safe.

ALTER TABLE courses ALTER COLUMN session_count TYPE TEXT USING session_count::TEXT;
