-- Prüfe ob price_info und session_count korrekt migriert wurden
SELECT
  column_name,
  data_type,
  is_nullable,
  CASE
    WHEN column_name = 'price_info' AND data_type = 'text' THEN '✓ OK'
    WHEN column_name = 'session_count' AND data_type = 'text' THEN '✓ OK'
    WHEN column_name = 'session_count' AND data_type = 'integer' THEN '✗ NICHT MIGRIERT (noch INTEGER)'
    ELSE '?'
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'courses'
  AND column_name IN ('price_info', 'session_count')
ORDER BY column_name;
