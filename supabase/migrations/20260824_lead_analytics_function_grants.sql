-- Lead-Analyse Phase 1 — Triggerfunktionen nicht als öffentliche RPCs anbieten.

REVOKE ALL ON FUNCTION public.track_package_tier_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_package_started_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.basic_lead_ranking_factor_for(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_ranking_factor_on_tier_change() FROM PUBLIC, anon, authenticated;
