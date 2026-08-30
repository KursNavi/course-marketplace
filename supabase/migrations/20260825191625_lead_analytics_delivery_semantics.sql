-- Lead-Analyse Phase 1 — Zustellsemantik
--
-- `leads.status = sent` means that Resend accepted the message. A later
-- delivery webhook can still mark it bounced/failed/suppressed. Statistics
-- used for provider steering must exclude those terminal delivery failures,
-- while the admin lead list continues to show them for troubleshooting.

CREATE OR REPLACE FUNCTION admin_provider_lead_overview(
  p_search TEXT DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_filter TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'leads_total',
  p_dir TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  provider_id UUID,
  full_name TEXT,
  email TEXT,
  package_tier TEXT,
  package_started_at TIMESTAMPTZ,
  package_start_is_estimated BOOLEAN,
  previous_package_tier TEXT,
  active_courses INTEGER,
  leads_30d INTEGER,
  leads_90d INTEGER,
  leads_365d INTEGER,
  leads_total INTEGER,
  avg_quality_score_365d NUMERIC,
  scored_leads_365d INTEGER,
  qualified_basic_leads_current_phase INTEGER,
  basic_lead_ranking_factor NUMERIC,
  last_lead_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset INTEGER := greatest(coalesce(p_offset, 0), 0);
  v_search TEXT := nullif(btrim(coalesce(p_search, '')), '');
  v_tier TEXT := nullif(lower(btrim(coalesce(p_tier, ''))), '');
  v_filter TEXT := nullif(lower(btrim(coalesce(p_filter, ''))), '');
  v_sort TEXT := lower(coalesce(p_sort, 'leads_total'));
  v_asc BOOLEAN := lower(coalesce(p_dir, 'desc')) = 'asc';
BEGIN
  IF v_sort NOT IN ('leads_total', 'leads_30d', 'leads_90d', 'leads_365d',
                    'avg_quality', 'package_started_at', 'ranking_factor',
                    'qualified_basic', 'full_name', 'last_lead_at') THEN
    v_sort := 'leads_total';
  END IF;

  IF v_tier IS NOT NULL AND v_tier NOT IN ('basic', 'pro', 'premium', 'enterprise') THEN
    v_tier := NULL;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id, p.full_name, p.email,
           lower(coalesce(p.package_tier, 'basic')) AS tier,
           p.package_started_at,
           p.basic_lead_ranking_factor
    FROM profiles p
    WHERE p.role = 'teacher'
      AND (v_tier IS NULL OR lower(coalesce(p.package_tier, 'basic')) = v_tier)
      AND (v_search IS NULL
           OR p.full_name ILIKE '%' || v_search || '%'
           OR p.email ILIKE '%' || v_search || '%')
  ),
  open_period AS (
    SELECT h.provider_id, h.package_tier, h.started_at, h.start_is_estimated
    FROM provider_package_history h
    JOIN base b ON b.id = h.provider_id
    WHERE h.ended_at IS NULL
  ),
  prev_period AS (
    SELECT DISTINCT ON (h.provider_id) h.provider_id, h.package_tier
    FROM provider_package_history h
    JOIN base b ON b.id = h.provider_id
    WHERE h.ended_at IS NOT NULL
    ORDER BY h.provider_id, h.ended_at DESC
  ),
  course_counts AS (
    SELECT c.user_id AS provider_id, count(*)::INTEGER AS active_courses
    FROM courses c
    JOIN base b ON b.id = c.user_id
    WHERE c.status = 'published'
    GROUP BY c.user_id
  ),
  reached_leads AS (
    SELECT l.*
    FROM leads l
    JOIN base b ON b.id = l.provider_id
    WHERE l.status = 'sent'
      AND coalesce(l.email_delivery_status, 'unknown') NOT IN
        ('bounced', 'complained', 'failed', 'suppressed')
  ),
  lead_stats AS (
    SELECT
      l.provider_id,
      count(*) FILTER (WHERE l.created_at >= now() - INTERVAL '30 days')::INTEGER AS leads_30d,
      count(*) FILTER (WHERE l.created_at >= now() - INTERVAL '90 days')::INTEGER AS leads_90d,
      count(*) FILTER (WHERE l.created_at >= now() - INTERVAL '365 days')::INTEGER AS leads_365d,
      count(*)::INTEGER AS leads_total,
      avg(l.quality_score) FILTER (
        WHERE l.quality_score IS NOT NULL AND l.created_at >= now() - INTERVAL '365 days'
      ) AS avg_quality_365d,
      count(*) FILTER (
        WHERE l.quality_score IS NOT NULL AND l.created_at >= now() - INTERVAL '365 days'
      )::INTEGER AS scored_365d,
      max(l.created_at) AS last_lead_at
    FROM reached_leads l
    GROUP BY l.provider_id
  ),
  qualified AS (
    SELECT o.provider_id, count(l.id)::INTEGER AS qualified_basic
    FROM open_period o
    LEFT JOIN reached_leads l
      ON l.provider_id = o.provider_id
     AND l.provider_tier_at_lead = 'basic'
     AND l.quality_score >= 5
     AND l.created_at >= o.started_at
    WHERE o.package_tier = 'basic'
    GROUP BY o.provider_id
  ),
  merged AS (
    SELECT
      b.id,
      b.full_name,
      b.email,
      b.tier,
      coalesce(o.started_at, b.package_started_at) AS started_at,
      coalesce(o.start_is_estimated, false) AS start_estimated,
      pv.package_tier AS previous_tier,
      coalesce(cc.active_courses, 0) AS active_courses,
      coalesce(ls.leads_30d, 0) AS leads_30d,
      coalesce(ls.leads_90d, 0) AS leads_90d,
      coalesce(ls.leads_365d, 0) AS leads_365d,
      coalesce(ls.leads_total, 0) AS leads_total,
      ls.avg_quality_365d,
      coalesce(ls.scored_365d, 0) AS scored_365d,
      coalesce(q.qualified_basic, 0) AS qualified_basic,
      b.basic_lead_ranking_factor,
      ls.last_lead_at
    FROM base b
    LEFT JOIN open_period o ON o.provider_id = b.id
    LEFT JOIN prev_period pv ON pv.provider_id = b.id
    LEFT JOIN course_counts cc ON cc.provider_id = b.id
    LEFT JOIN lead_stats ls ON ls.provider_id = b.id
    LEFT JOIN qualified q ON q.provider_id = b.id
  ),
  filtered AS (
    SELECT * FROM merged m
    WHERE v_filter IS NULL
       OR (v_filter = 'no_leads' AND m.leads_total = 0)
       OR (v_filter = 'basic_many_leads' AND m.tier = 'basic' AND m.qualified_basic >= 4)
  ),
  counted AS (
    SELECT f.*, count(*) OVER () AS total_count FROM filtered f
  )
  SELECT
    c.id, c.full_name, c.email, c.tier, c.started_at, c.start_estimated,
    c.previous_tier, c.active_courses, c.leads_30d, c.leads_90d, c.leads_365d,
    c.leads_total, c.avg_quality_365d, c.scored_365d, c.qualified_basic,
    c.basic_lead_ranking_factor, c.last_lead_at, c.total_count
  FROM counted c
  ORDER BY
    CASE WHEN v_asc THEN CASE v_sort
      WHEN 'leads_total' THEN c.leads_total WHEN 'leads_30d' THEN c.leads_30d
      WHEN 'leads_90d' THEN c.leads_90d WHEN 'leads_365d' THEN c.leads_365d
      WHEN 'qualified_basic' THEN c.qualified_basic END END ASC NULLS LAST,
    CASE WHEN NOT v_asc THEN CASE v_sort
      WHEN 'leads_total' THEN c.leads_total WHEN 'leads_30d' THEN c.leads_30d
      WHEN 'leads_90d' THEN c.leads_90d WHEN 'leads_365d' THEN c.leads_365d
      WHEN 'qualified_basic' THEN c.qualified_basic END END DESC NULLS LAST,
    CASE WHEN v_asc AND v_sort = 'avg_quality' THEN c.avg_quality_365d END ASC NULLS LAST,
    CASE WHEN NOT v_asc AND v_sort = 'avg_quality' THEN c.avg_quality_365d END DESC NULLS LAST,
    CASE WHEN v_asc AND v_sort = 'ranking_factor' THEN c.basic_lead_ranking_factor END ASC NULLS LAST,
    CASE WHEN NOT v_asc AND v_sort = 'ranking_factor' THEN c.basic_lead_ranking_factor END DESC NULLS LAST,
    CASE WHEN v_asc AND v_sort = 'package_started_at' THEN c.started_at END ASC NULLS LAST,
    CASE WHEN NOT v_asc AND v_sort = 'package_started_at' THEN c.started_at END DESC NULLS LAST,
    CASE WHEN v_asc AND v_sort = 'last_lead_at' THEN c.last_lead_at END ASC NULLS LAST,
    CASE WHEN NOT v_asc AND v_sort = 'last_lead_at' THEN c.last_lead_at END DESC NULLS LAST,
    CASE WHEN v_asc AND v_sort = 'full_name' THEN c.full_name END ASC NULLS LAST,
    CASE WHEN NOT v_asc AND v_sort = 'full_name' THEN c.full_name END DESC NULLS LAST,
    c.id ASC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION admin_provider_lead_detail(p_provider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_basic_start TIMESTAMPTZ := current_basic_phase_start(p_provider_id);
BEGIN
  SELECT jsonb_build_object(
    'provider', (
      SELECT jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'email', p.email,
        'package_tier', lower(coalesce(p.package_tier, 'basic')),
        'package_started_at', p.package_started_at,
        'basic_lead_ranking_factor', p.basic_lead_ranking_factor,
        'current_basic_phase_start', v_basic_start
      ) FROM profiles p WHERE p.id = p_provider_id
    ),
    'totals', (
      SELECT jsonb_build_object(
        'leads_30d', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.created_at >= now() - INTERVAL '30 days'),
        'leads_90d', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.created_at >= now() - INTERVAL '90 days'),
        'leads_365d', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.created_at >= now() - INTERVAL '365 days'),
        'leads_total', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed')),
        'avg_quality_30d', avg(l.quality_score) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.quality_score IS NOT NULL AND l.created_at >= now() - INTERVAL '30 days'),
        'avg_quality_90d', avg(l.quality_score) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.quality_score IS NOT NULL AND l.created_at >= now() - INTERVAL '90 days'),
        'avg_quality_365d', avg(l.quality_score) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.quality_score IS NOT NULL AND l.created_at >= now() - INTERVAL '365 days'),
        'avg_quality_total', avg(l.quality_score) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.quality_score IS NOT NULL),
        'scored_total', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.quality_score IS NOT NULL),
        'pending_total', count(*) FILTER (WHERE l.quality_status = 'pending'),
        'failed_total', count(*) FILTER (WHERE l.quality_status = 'failed'),
        'expired_unscored_total', count(*) FILTER (WHERE l.quality_status = 'expired_unscored'),
        'leads_during_basic', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.provider_tier_at_lead = 'basic'),
        'leads_during_paid', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.provider_tier_at_lead IN ('pro','premium','enterprise')),
        'leads_tier_unknown', count(*) FILTER (WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed') AND l.provider_tier_at_lead IS NULL),
        'qualified_basic_current_phase', count(*) FILTER (
          WHERE l.status = 'sent' AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed')
            AND v_basic_start IS NOT NULL AND l.provider_tier_at_lead = 'basic'
            AND l.quality_score >= 5 AND l.created_at >= v_basic_start
        )
      ) FROM leads l WHERE l.provider_id = p_provider_id
    ),
    'monthly', coalesce((
      SELECT jsonb_agg(m ORDER BY m->>'month') FROM (
        SELECT jsonb_build_object(
          'month', to_char(date_trunc('month', l.created_at), 'YYYY-MM'),
          'leads', count(*),
          'scored', count(*) FILTER (WHERE l.quality_score IS NOT NULL),
          'avg_quality', avg(l.quality_score) FILTER (WHERE l.quality_score IS NOT NULL)
        ) AS m FROM leads l
        WHERE l.provider_id = p_provider_id AND l.status = 'sent'
          AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed')
        GROUP BY date_trunc('month', l.created_at)
      ) s
    ), '[]'::jsonb),
    'by_course', coalesce((
      SELECT jsonb_agg(c ORDER BY (c->>'leads')::INT DESC) FROM (
        SELECT jsonb_build_object(
          'course_id', l.course_id, 'title', co.title, 'leads', count(*),
          'avg_quality', avg(l.quality_score) FILTER (WHERE l.quality_score IS NOT NULL)
        ) AS c FROM leads l LEFT JOIN courses co ON co.id = l.course_id
        WHERE l.provider_id = p_provider_id AND l.status = 'sent'
          AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed')
        GROUP BY l.course_id, co.title
      ) s
    ), '[]'::jsonb),
    'score_distribution', coalesce((
      SELECT jsonb_object_agg(sd.score::TEXT, sd.cnt) FROM (
        SELECT l.quality_score AS score, count(*) AS cnt FROM leads l
        WHERE l.provider_id = p_provider_id AND l.status = 'sent'
          AND coalesce(l.email_delivery_status, 'unknown') NOT IN ('bounced','complained','failed','suppressed')
          AND l.quality_score IS NOT NULL
        GROUP BY l.quality_score
      ) sd
    ), '{}'::jsonb),
    'package_history', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id, 'package_tier', h.package_tier, 'started_at', h.started_at,
        'ended_at', h.ended_at, 'start_is_estimated', h.start_is_estimated,
        'change_source', h.change_source
      ) ORDER BY h.started_at DESC)
      FROM provider_package_history h WHERE h.provider_id = p_provider_id
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION admin_provider_lead_overview(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_provider_lead_detail(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_provider_lead_overview(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION admin_provider_lead_detail(UUID) TO service_role;

-- Bring already tracked terminal delivery failures in line with the durable
-- send-status audit field. Future webhook events are handled in
-- api/resend-webhook.js the same way.
UPDATE leads
SET status = 'failed'
WHERE status = 'sent'
  AND email_delivery_status IN ('bounced', 'complained', 'failed', 'suppressed');

SELECT recompute_basic_lead_ranking_factors();
