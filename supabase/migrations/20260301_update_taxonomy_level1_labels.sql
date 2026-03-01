-- Update taxonomy_level1 display labels to match header/navigation wording
-- "Professionell" → "Beruflich", "Privat" → "Privat & Hobby"
UPDATE taxonomy_level1
SET label_de = CASE slug
    WHEN 'professionell' THEN 'Beruflich'
    WHEN 'privat' THEN 'Privat & Hobby'
    ELSE label_de
END
WHERE slug IN ('professionell', 'privat');
