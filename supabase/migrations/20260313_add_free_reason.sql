ALTER TABLE courses ADD COLUMN IF NOT EXISTS free_reason TEXT;

COMMENT ON COLUMN courses.free_reason IS 'Pflichtangabe warum ein Kurs kostenlos angeboten wird (nur wenn Preis=0 bei platform/platform_flex).';
