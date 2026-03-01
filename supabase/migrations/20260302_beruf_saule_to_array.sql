-- Umbau: beruf_saule TEXT → beruf_saeulen TEXT[]
-- Ein Kurs kann mehreren Säulen angehören (z.B. Portfolio-Einträge)

-- 1. Alte Constraint entfernen
ALTER TABLE courses DROP CONSTRAINT IF EXISTS chk_beruf_saule_values;

-- 2. Alten Index entfernen
DROP INDEX IF EXISTS idx_courses_beruf_saule;

-- 3. Neue Array-Spalte anlegen
ALTER TABLE courses ADD COLUMN IF NOT EXISTS beruf_saeulen TEXT[] DEFAULT NULL;

-- 4. Daten migrieren (einzelner Wert → Array)
UPDATE courses
SET beruf_saeulen = ARRAY[beruf_saule]
WHERE beruf_saule IS NOT NULL;

-- 5. Alte Spalte entfernen
ALTER TABLE courses DROP COLUMN IF EXISTS beruf_saule;

-- 6. GIN-Index für Array-Suche
CREATE INDEX IF NOT EXISTS idx_courses_beruf_saeulen
  ON courses USING GIN(beruf_saeulen) WHERE beruf_saeulen IS NOT NULL;

COMMENT ON COLUMN courses.beruf_saeulen IS
  '3-Säulen für berufliche Kurse (Array, Mehrfachzuordnung möglich): diplome, fachkurse, quereinstieg. NULL für nicht-berufliche Kurse.';
