-- RÜCKWEG für die drei KI-Such-Migrationen (20261113180000/180100/180200).
--
-- Zweck: dokumentierter, vollständiger Rückbau NUR der durch diese
-- Migrationen angelegten Objekte — ausschliesslich auf dem freigegebenen
-- TESTprojekt "TESTumgebung KursNavi" (omoapbvfligjfznzivyu) auszuführen.
-- Liegt bewusst AUSSERHALB von supabase/migrations/, damit kein Werkzeug
-- diese Datei als Migration anwendet.
--
-- Berührt KEINE bestehenden Tabellen/Daten (courses, course_events, ...);
-- entfernt werden nur ai_search_*-Objekte, die zugehörigen Trigger auf den
-- Quelltabellen und die unterstützenden Funktionen/Sequenzen. Die
-- Erweiterungen (unaccent, vector) werden NICHT entfernt — sie könnten von
-- anderem genutzt werden; falls Rückbau gewünscht, separat entscheiden.

BEGIN;

-- Trigger auf Quelltabellen (nur die von 20261113180000 angelegten):
DROP TRIGGER IF EXISTS ai_search_courses_outbox ON courses;
DROP TRIGGER IF EXISTS ai_search_course_events_outbox ON course_events;
DROP TRIGGER IF EXISTS ai_search_course_locations_outbox ON course_locations;
DROP FUNCTION IF EXISTS ai_search_enqueue_course_job();

-- Such-/Quota-Funktionen:
DROP FUNCTION IF EXISTS ai_search_lexical(TEXT, INTEGER);
DROP FUNCTION IF EXISTS ai_search_semantic(vector, TEXT, INTEGER);
DROP FUNCTION IF EXISTS ai_search_quota_reserve(UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS ai_search_quota_finalize(UUID, INTEGER);
DROP FUNCTION IF EXISTS ai_search_quota_release(UUID);
DROP FUNCTION IF EXISTS ai_search_quota_remaining(UUID, INTEGER);
DROP FUNCTION IF EXISTS ai_search_quota_cleanup();
DROP FUNCTION IF EXISTS ai_search_quota_used(UUID, TEXT);
DROP FUNCTION IF EXISTS ai_search_month_key(TIMESTAMPTZ);

-- Tabellen und Sequenz:
DROP TABLE IF EXISTS ai_search_usage;
DROP TABLE IF EXISTS ai_search_jobs;
DROP TABLE IF EXISTS ai_search_chunks;
DROP TABLE IF EXISTS ai_search_documents;
DROP TABLE IF EXISTS ai_search_config;
DROP SEQUENCE IF EXISTS ai_search_source_version_seq;

COMMIT;
