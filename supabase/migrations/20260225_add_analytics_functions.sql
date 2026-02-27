-- Migration: Add RPC functions for provider analytics

-- Monthly aggregates for a provider (bookings, revenue, views)
CREATE OR REPLACE FUNCTION get_provider_analytics(provider_id UUID, months_back INT DEFAULT 12)
RETURNS TABLE (
  month TEXT,
  total_bookings BIGINT,
  total_revenue_cents BIGINT,
  total_net_cents BIGINT,
  total_views BIGINT,
  total_detail_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_range AS (
    SELECT generate_series(
      date_trunc('month', now() - (months_back || ' months')::interval),
      date_trunc('month', now()),
      '1 month'::interval
    ) AS month_start
  ),
  monthly_bookings AS (
    SELECT
      date_trunc('month', b.created_at) AS m,
      COUNT(*) AS bookings,
      COALESCE(SUM(b.amount_cents), 0) AS revenue,
      COALESCE(SUM(b.net_amount_cents), 0) AS net
    FROM bookings b
    JOIN courses c ON c.id = b.course_id
    WHERE c.user_id = provider_id
      AND b.created_at >= now() - (months_back || ' months')::interval
      AND b.status != 'refunded'
    GROUP BY date_trunc('month', b.created_at)
  ),
  monthly_views AS (
    SELECT
      date_trunc('month', v.created_at) AS m,
      COUNT(*) FILTER (WHERE v.view_type = 'impression') AS impressions,
      COUNT(*) FILTER (WHERE v.view_type = 'detail') AS details
    FROM course_views v
    JOIN courses c ON c.id = v.course_id
    WHERE c.user_id = provider_id
      AND v.created_at >= now() - (months_back || ' months')::interval
    GROUP BY date_trunc('month', v.created_at)
  )
  SELECT
    to_char(dr.month_start, 'YYYY-MM') AS month,
    COALESCE(mb.bookings, 0),
    COALESCE(mb.revenue, 0),
    COALESCE(mb.net, 0),
    COALESCE(mv.impressions, 0),
    COALESCE(mv.details, 0)
  FROM date_range dr
  LEFT JOIN monthly_bookings mb ON mb.m = dr.month_start
  LEFT JOIN monthly_views mv ON mv.m = dr.month_start
  ORDER BY dr.month_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Per-course performance metrics for a provider
CREATE OR REPLACE FUNCTION get_course_performance(provider_id UUID, months_back INT DEFAULT 12)
RETURNS TABLE (
  course_id BIGINT,
  course_title TEXT,
  total_bookings BIGINT,
  total_revenue_cents BIGINT,
  total_views BIGINT,
  total_detail_views BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    COUNT(DISTINCT b.id) AS total_bookings,
    COALESCE(SUM(DISTINCT b.amount_cents), 0) AS total_revenue_cents,
    COUNT(DISTINCT v_imp.id) AS total_views,
    COUNT(DISTINCT v_det.id) AS total_detail_views,
    CASE
      WHEN COUNT(DISTINCT v_det.id) > 0
      THEN ROUND(COUNT(DISTINCT b.id)::numeric / COUNT(DISTINCT v_det.id) * 100, 1)
      ELSE 0
    END AS conversion_rate
  FROM courses c
  LEFT JOIN bookings b ON b.course_id = c.id
    AND b.created_at >= now() - (months_back || ' months')::interval
    AND b.status != 'refunded'
  LEFT JOIN course_views v_imp ON v_imp.course_id = c.id
    AND v_imp.view_type = 'impression'
    AND v_imp.created_at >= now() - (months_back || ' months')::interval
  LEFT JOIN course_views v_det ON v_det.course_id = c.id
    AND v_det.view_type = 'detail'
    AND v_det.created_at >= now() - (months_back || ' months')::interval
  WHERE c.user_id = provider_id
    AND (c.status = 'published' OR c.status IS NULL)
  GROUP BY c.id, c.title
  ORDER BY COUNT(DISTINCT b.id) DESC, COALESCE(SUM(DISTINCT b.amount_cents), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
