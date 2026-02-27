-- ============================================
-- Migration: Auto-refresh v_taxonomy_paths on taxonomy changes
-- ============================================

-- Drop existing function and triggers first
DROP TRIGGER IF EXISTS refresh_taxonomy_paths_on_level1 ON taxonomy_level1;
DROP TRIGGER IF EXISTS refresh_taxonomy_paths_on_level2 ON taxonomy_level2;
DROP TRIGGER IF EXISTS refresh_taxonomy_paths_on_level3 ON taxonomy_level3;
DROP FUNCTION IF EXISTS refresh_taxonomy_paths();

-- Function to refresh the materialized view
CREATE FUNCTION refresh_taxonomy_paths()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW v_taxonomy_paths;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for each taxonomy level table
CREATE TRIGGER refresh_taxonomy_paths_on_level1
AFTER INSERT OR UPDATE OR DELETE ON taxonomy_level1
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_taxonomy_paths();

CREATE TRIGGER refresh_taxonomy_paths_on_level2
AFTER INSERT OR UPDATE OR DELETE ON taxonomy_level2
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_taxonomy_paths();

CREATE TRIGGER refresh_taxonomy_paths_on_level3
AFTER INSERT OR UPDATE OR DELETE ON taxonomy_level3
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_taxonomy_paths();

COMMENT ON FUNCTION refresh_taxonomy_paths() IS 'Automatically refreshes v_taxonomy_paths materialized view when taxonomy tables are modified';