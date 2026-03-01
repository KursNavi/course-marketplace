-- Korrektur: Mehrsäulen-Zuordnungen + fehlende Einzelkorrektur

-- 1. ID 27: "star Fachausweis" ist Anbieter-Zertifikat → fachkurse (nicht diplome)
--    Fix wurde nach Array-Migration nicht erneut angewendet
UPDATE courses SET beruf_saeulen = ARRAY['fachkurse']
WHERE id = 27;

-- 2. ID 277: "Kauffrau/Kaufmann EFZ & BM1" → quereinstieg + diplome
--    EFZ = Berufsbildung (quereinstieg), BM1 = offizieller Abschluss (diplome)
UPDATE courses SET beruf_saeulen = ARRAY['quereinstieg', 'diplome']
WHERE id = 277;

-- 3. ID 62: "Sportmassage All Inclusive" → diplome + fachkurse
--    Paket bündelt Einzelmodule (fachkurse) + eidg. Diplom (diplome)
UPDATE courses SET beruf_saeulen = ARRAY['diplome', 'fachkurse']
WHERE id = 62;
