-- Kinder-Taxonomie: nur level1.slug = 'kinder'
-- Separater Query wegen Zeichenlimit im SQL Editor Output

SELECT
  l2.id       AS level2_id,
  l2.slug     AS level2_slug,
  l2.label_de AS level2_label,
  l3.id       AS level3_id,
  l3.slug     AS level3_slug,
  l3.label_de AS level3_label,
  l4.id       AS level4_id,
  l4.slug     AS level4_slug,
  l4.label_de AS level4_label
FROM taxonomy_level1 l1
JOIN taxonomy_level2 l2 ON l2.level1_id = l1.id
JOIN taxonomy_level3 l3 ON l3.level2_id = l2.id
LEFT JOIN taxonomy_level4 l4 ON l4.level3_id = l3.id
WHERE l1.slug = 'kinder'
ORDER BY l2.id, l3.id, l4.id;
