-- =====================================================================
-- Vorher/Nachher-Nachweis zur Migration 20261120205856 – NUR LESEND.
-- Vor und nach dem Testlauf ausführen; alle Spalten ausser denen im Block
-- "seq_*" müssen identisch sein. Sequenzen rollen in PostgreSQL nicht
-- zurück und dürfen daher steigen (einzige erwartete bleibende Wirkung).
-- =====================================================================
SELECT
  now() AS geprueft_am,
  -- Objektstand
  md5(pg_get_functiondef('public.ai_search_enqueue_course_job()'::regprocedure))               AS fn_enqueue_md5,
  md5(pg_get_functiondef('public.ai_search_apply_upsert(bigint,bigint,jsonb,jsonb)'::regprocedure)) AS fn_apply_upsert_md5,
  to_regprocedure('public.ai_search_ignored_course_columns()') IS NOT NULL                     AS fn_ignored_vorhanden,
  to_regprocedure('public.ai_search_enqueue_profile_jobs()') IS NOT NULL                       AS fn_profile_jobs_vorhanden,
  (SELECT string_agg(tgrelid::regclass || '.' || tgname, ', ' ORDER BY tgrelid::regclass::text, tgname)
     FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'ai_search_%')                     AS ai_trigger,
  (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname) FROM pg_proc p
     CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
     JOIN pg_roles r ON r.oid = a.grantee
    WHERE p.oid = 'public.ai_search_apply_upsert(bigint,bigint,jsonb,jsonb)'::regprocedure
      AND a.privilege_type = 'EXECUTE')                                                        AS apply_upsert_execute_rollen,
  -- Bestehende Daten (Anzahl + Prüfsumme über ganze Zeilen bzw. Kernfelder)
  (SELECT count(*) FROM courses)                                                               AS courses_n,
  (SELECT md5(string_agg(c::text, '' ORDER BY c.id)) FROM courses c)                           AS courses_md5,
  (SELECT count(*) FROM profiles)                                                              AS profiles_n,
  (SELECT md5(string_agg(p::text, '' ORDER BY p.id)) FROM profiles p)                          AS profiles_md5,
  (SELECT count(*) FROM provider_package_history)                                              AS package_history_n,
  (SELECT md5(string_agg(h::text, '' ORDER BY h.id)) FROM provider_package_history h)          AS package_history_md5,
  (SELECT count(*) FROM course_category_assignments)                                           AS category_assignments_n,
  (SELECT md5(string_agg(a::text, '' ORDER BY a.id)) FROM course_category_assignments a)       AS category_assignments_md5,
  (SELECT count(*) FROM course_events)                                                         AS course_events_n,
  (SELECT md5(string_agg(e::text, '' ORDER BY e.id)) FROM course_events e)                     AS course_events_md5,
  (SELECT count(*) FROM course_locations)                                                      AS course_locations_n,
  (SELECT md5(string_agg(l::text, '' ORDER BY l.id)) FROM course_locations l)                  AS course_locations_md5,
  (SELECT count(*) FROM ai_search_jobs)                                                        AS jobs_n,
  (SELECT count(*) FROM ai_search_jobs WHERE status = 'pending')                               AS jobs_pending,
  (SELECT count(*) FROM ai_search_jobs WHERE status = 'failed')                                AS jobs_failed,
  (SELECT md5(string_agg(j::text, '' ORDER BY j.id)) FROM ai_search_jobs j)                    AS jobs_md5,
  (SELECT count(*) FROM ai_search_documents)                                                   AS documents_n,
  (SELECT md5(string_agg(d.course_id || ':' || d.content_hash || ':' || d.source_version, ',' ORDER BY d.course_id))
     FROM ai_search_documents d)                                                               AS documents_md5,
  (SELECT count(*) FROM ai_search_index_state)                                                 AS index_state_n,
  (SELECT md5(string_agg(s::text, '' ORDER BY s.course_id)) FROM ai_search_index_state s)      AS index_state_md5,
  (SELECT count(*) FROM ai_search_chunks)                                                      AS chunks_n,
  (SELECT count(*) FROM ai_search_chunks k JOIN ai_search_config cfg ON cfg.id = 1
    WHERE k.embedding IS NOT NULL AND k.model_version = cfg.active_model_version)              AS chunks_mit_aktivem_embedding,
  (SELECT md5(string_agg(k.id || ':' || k.content_hash || ':' || COALESCE(k.model_version, '-') || ':'
                         || COALESCE(md5(k.embedding::text), '-'), ',' ORDER BY k.id))
     FROM ai_search_chunks k)                                                                  AS chunks_md5,
  -- Erwartete bleibende Wirkung: Sequenzen (dürfen steigen)
  (SELECT last_value FROM courses_id_seq)                                                      AS seq_courses,
  (SELECT last_value FROM ai_search_jobs_id_seq)                                               AS seq_jobs,
  (SELECT last_value FROM ai_search_source_version_seq)                                        AS seq_source_version,
  (SELECT last_value FROM ai_search_chunks_id_seq)                                             AS seq_chunks,
  (SELECT last_value FROM provider_package_history_id_seq)                                     AS seq_package_history;
