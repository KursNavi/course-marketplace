-- Optionaler separater Empfänger für Kursanfragen.
-- Ist das Feld leer, verwendet der Lead-Versand weiterhin profiles.email.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lead_email TEXT;

COMMENT ON COLUMN public.profiles.lead_email IS
  'Optionaler Empfänger für Kursanfragen; bei NULL oder leerem Wert gilt die Profiladresse.';
