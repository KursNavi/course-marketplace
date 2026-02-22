-- Check what's in taxonomy_level2
SELECT id, level1_id, slug, label_de, label_en, is_active, sort_order
FROM taxonomy_level2
WHERE is_active = true
ORDER BY level1_id, sort_order;
