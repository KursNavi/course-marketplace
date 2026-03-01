-- Korrektur der automatischen 3-Säulen-Klassifizierung (Array-Format)

-- 1. "Masterclass" ≠ "Master" → diplome entfernen, fachkurse setzen
UPDATE courses SET beruf_saeulen = ARRAY['fachkurse']
WHERE id IN (94, 99);

-- 2. CAS/MAS am Titelanfang nicht erkannt → diplome hinzufügen
UPDATE courses SET beruf_saeulen = ARRAY['diplome']
WHERE id IN (141, 142, 143, 297, 144);

-- 3. Berufsmaturität BM2 = offizieller Schweizer Abschluss → diplome
UPDATE courses SET beruf_saeulen = ARRAY['diplome']
WHERE id = 278;

-- 4. "star Fachausweis" = Anbieter-Zertifikat (nicht eidgenössisch) → fachkurse
UPDATE courses SET beruf_saeulen = ARRAY['fachkurse']
WHERE id = 27;
