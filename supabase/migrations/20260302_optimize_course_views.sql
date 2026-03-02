-- Optimierung course_views: Retention, besserer Index, performantere RPC-Funktion

-- 1) Composite-Index für die häufigste Query-Kombination (ersetzt den einfachen course_date Index)
DROP INDEX IF EXISTS idx_course_views_course_date;
CREATE INDEX idx_course_views_course_type_date
  ON course_views(course_id, view_type, created_at);

-- 2) Retention-Funktion: Einträge älter als 365 Tage löschen
CREATE OR REPLACE FUNCTION cleanup_old_course_views()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM course_views
  WHERE created_at < now() - INTERVAL '365 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 3) get_course_performance optimieren: Subqueries mit FILTER statt doppelter LEFT JOIN
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
  WITH booking_stats AS (
    SELECT
      b.course_id AS cid,
      COUNT(*) AS bookings
    FROM bookings b
    JOIN courses c ON c.id = b.course_id
    WHERE c.user_id = provider_id
      AND b.created_at >= now() - (months_back || ' months')::interval
      AND b.status != 'refunded'
    GROUP BY b.course_id
  ),
  view_stats AS (
    SELECT
      v.course_id AS cid,
      COUNT(*) FILTER (WHERE v.view_type = 'impression') AS impressions,
      COUNT(*) FILTER (WHERE v.view_type = 'detail') AS details
    FROM course_views v
    JOIN courses c ON c.id = v.course_id
    WHERE c.user_id = provider_id
      AND v.created_at >= now() - (months_back || ' months')::interval
    GROUP BY v.course_id
  )
  SELECT
    c.id,
    c.title,
    COALESCE(bs.bookings, 0)::BIGINT,
    (COALESCE(bs.bookings, 0) * c.price * 100)::BIGINT,
    COALESCE(vs.impressions, 0)::BIGINT,
    COALESCE(vs.details, 0)::BIGINT,
    CASE
      WHEN COALESCE(vs.details, 0) > 0
      THEN ROUND(COALESCE(bs.bookings, 0)::numeric / vs.details * 100, 1)
      ELSE 0
    END
  FROM courses c
  LEFT JOIN booking_stats bs ON bs.cid = c.id
  LEFT JOIN view_stats vs ON vs.cid = c.id
  WHERE c.user_id = provider_id
    AND (c.status = 'published' OR c.status IS NULL)
  ORDER BY COALESCE(bs.bookings, 0) DESC, c.price DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
