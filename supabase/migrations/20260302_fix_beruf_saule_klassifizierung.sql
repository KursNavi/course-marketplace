-- Korrektur der automatischen 3-Säulen-Klassifizierung
-- 8 Kurse falsch zugeordnet durch ungenaue Keyword-Matches

-- 1. "Masterclass" ≠ "Master" → diplome zurück zu fachkurse
UPDATE courses SET beruf_saule = 'fachkurse'
WHERE id IN (94, 99);

-- 2. CAS/MAS am Titelanfang nicht erkannt → fachkurse zu diplome
UPDATE courses SET beruf_saule = 'diplome'
WHERE id IN (141, 142, 143, 297, 144);

-- 3. Berufsmaturität BM2 = offizieller Schweizer Abschluss → diplome
UPDATE courses SET beruf_saule = 'diplome'
WHERE id = 278;
