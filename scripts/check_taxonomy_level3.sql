-- Check what's in taxonomy_level3
SELECT l3.id, l3.level2_id, l3.slug, l3.label_de, l2.slug as parent_slug, l2.label_de as parent_label
FROM taxonomy_level3 l3
JOIN taxonomy_level2 l2 ON l3.level2_id = l2.id
WHERE l3.is_active = true
ORDER BY l2.level1_id, l3.level2_id, l3.sort_order;
