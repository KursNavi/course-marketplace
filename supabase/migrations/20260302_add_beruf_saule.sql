-- 3-Säulen-Klassifikation für berufliche Kurse
-- Neue Spalte beruf_saule: orthogonale Dimension zur Fach-Taxonomie
-- Nur für professionelle Kurse relevant (NULL für privat/kinder)

-- Spalte hinzufügen
ALTER TABLE courses ADD COLUMN IF NOT EXISTS beruf_saule TEXT DEFAULT NULL;

-- CHECK-Constraint: nur 3 gültige Werte oder NULL
ALTER TABLE courses ADD CONSTRAINT chk_beruf_saule_values
  CHECK (beruf_saule IS NULL OR beruf_saule IN ('diplome', 'fachkurse', 'quereinstieg'));

-- Partial Index für schnelle Filterung (nur nicht-NULL Werte)
CREATE INDEX IF NOT EXISTS idx_courses_beruf_saule
  ON courses(beruf_saule) WHERE beruf_saule IS NOT NULL;

COMMENT ON COLUMN courses.beruf_saule IS
  '3-Säulen für berufliche Kurse: diplome (Diplome & Höhere Abschlüsse), fachkurse (Fachkurse & Praxis-Zertifikate), quereinstieg (Quereinstieg & Berufsbildung). NULL für nicht-berufliche Kurse.';
