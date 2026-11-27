-- =====================================================================
-- Bestätigung der Volljährigkeit (AGB Ziff. 3.5 a, Entscheid 27.11.2026)
-- =====================================================================
-- Eigene KursNavi-Konten nur ab 18 Jahren. Gespeichert wird die
-- ausdrückliche SELBSTAUSKUNFT „Ich bin mindestens 18 Jahre alt“ je Konto und
-- Regelversion, mit Zeitpunkt der Datenbank. Keine überprüfte
-- Altersfeststellung: kein Geburtsdatum, kein Ausweis, kein Elternverfahren.
--
-- Quellen:
--  - 'signup':    bei der Registrierung. Das Pflicht-Häkchen wird als
--                 Metadatum (adult_confirmed = true, adult_rule_version) mit
--                 signUp übergeben; der Trigger unten schreibt den Eintrag in
--                 DERSELBEN Transaktion wie das Konto. Schlägt das Schreiben
--                 fehl, entsteht kein Konto.
--  - 'ai_search': bestehende Konten, einmal vor der ersten KI-Nutzung, über
--                 /api/ai-search (Serverrolle; Erfolg erst nach Rückleseprüfung).
-- Frühere Registrierung oder alte AGB-Zustimmung werden NICHT als
-- Bestätigung gewertet (kein Rückfüllen bestehender Konten).
--
-- Zugriff: nur Serverrolle. Keine Rechte für anon/authenticated, keine Policy.
-- Kontolöschung: Einträge werden mitgelöscht (ON DELETE CASCADE).
-- Nur neue Objekte; bestehende Tabellen und Funktionen bleiben unverändert.
-- Rückweg: docs/ai-search/volljaehrigkeit-migration-rueckweg.md
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.account_adult_confirmations (
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_version TEXT        NOT NULL CHECK (rule_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  source       TEXT        NOT NULL CHECK (source IN ('signup', 'ai_search')),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rule_version)
);

COMMENT ON TABLE public.account_adult_confirmations IS
  'Selbstauskunft „mindestens 18 Jahre“ je Konto und Regelversion (AGB 3.5 a). Keine überprüfte Altersfeststellung.';

ALTER TABLE public.account_adult_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_adult_confirmations FROM anon, authenticated;

-- Registrierung: Eintrag atomar mit dem Konto (nur bei ausdrücklicher Angabe).
CREATE OR REPLACE FUNCTION public.record_signup_adult_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'adult_confirmed' = 'true'
     AND COALESCE(NEW.raw_user_meta_data->>'adult_rule_version', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    INSERT INTO public.account_adult_confirmations (user_id, rule_version, source)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'adult_rule_version', 'signup')
    ON CONFLICT (user_id, rule_version) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_signup_adult_confirmation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_adult_confirmation ON auth.users;
CREATE TRIGGER on_auth_user_adult_confirmation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.record_signup_adult_confirmation();
