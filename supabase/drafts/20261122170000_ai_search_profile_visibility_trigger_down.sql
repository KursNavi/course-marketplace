-- RÜCKWEG zum Entwurf 20261122170000_ai_search_profile_visibility_trigger.
-- Stellt Funktion und Trigger exakt wie in Migration 20261120205856
-- (Abschnitt C) wieder her: ohne Spalte role.

CREATE OR REPLACE FUNCTION public.ai_search_enqueue_profile_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.slug, NEW.city, NEW.canton, NEW.verification_status, NEW.bio_text)
     IS NOT DISTINCT FROM
     (OLD.slug, OLD.city, OLD.canton, OLD.verification_status, OLD.bio_text) THEN
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
  AFTER UPDATE OF slug, city, canton, verification_status, bio_text ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ai_search_enqueue_profile_jobs();
