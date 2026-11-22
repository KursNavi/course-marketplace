-- =====================================================================
-- ENTWURF – NICHT ANWENDEN ohne ausdrückliche Freigabe (Stand 22.11.2026).
-- Profil-Trigger der KI-Suche: auch Sichtbarkeitswechsel einreihen.
-- Voraussetzung: Migration 20261120205856_ai_search_keep_embeddings_skip_noop_jobs.
-- Rückweg: supabase/drafts/20261122170000_ai_search_profile_visibility_trigger_down.sql
--
-- Hintergrund (E1, 22.11.2026): Der Worker liest Profilangaben jetzt aus der
-- öffentlichen Ansicht public_teacher_profiles (WHERE role = 'teacher'),
-- genau wie die Profilseite /profil/…. Ob Slug, Ort, Kanton, Verifizierung
-- und Profiltext in den Index gehören, hängt damit auch an profiles.role.
-- Bisher reagierte der Trigger nur auf die übernommenen Felder; ein
-- Rollenwechsel (z. B. teacher → student) liess den Profiltext bis zur
-- nächsten Änderung im Index. Der tägliche Abgleich prüft Prüfsummen nur
-- stichprobenweise und fängt das nicht verlässlich.
--
-- Änderung: Spalte role in Vergleich und UPDATE OF aufnehmen. Sonst
-- unverändert gegenüber 20261120205856 (Abschnitt C). Keine Datenänderung,
-- keine Modellaufrufe; beim Anwenden entstehen keine Aufträge.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ai_search_enqueue_profile_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.slug, NEW.city, NEW.canton, NEW.verification_status, NEW.bio_text, NEW.role)
     IS NOT DISTINCT FROM
     (OLD.slug, OLD.city, OLD.canton, OLD.verification_status, OLD.bio_text, OLD.role) THEN
    RETURN NEW;
  END IF;

  INSERT INTO ai_search_jobs (course_id, reason, priority)
  SELECT c.id, 'profile_change', 5
  FROM courses c
  WHERE c.user_id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ai_search_profiles_outbox ON public.profiles;
CREATE TRIGGER ai_search_profiles_outbox
  AFTER UPDATE OF slug, city, canton, verification_status, bio_text, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ai_search_enqueue_profile_jobs();
