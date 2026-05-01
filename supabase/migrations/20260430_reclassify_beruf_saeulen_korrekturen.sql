-- Manuelle Korrekturen nach der automatischen Klassifizierung (20260430_reclassify_beruf_saeulen.sql)
-- Gleiche Pattern-Fehler wie beim ursprünglichen Klassifizierungs-Script (2026-03-02).
-- NACH dem Haupt-Migrations-Script ausführen.

-- ID 27: "Fitness Trainer mit star Fachausweis Qualitop OK-Status"
-- → "star Fachausweis" ist ein Provider-Zertifikat (nicht eidgenössisch)
-- → automatisch als 'ausbildung' klassifiziert (wegen "Fachausweis" im Titel)
UPDATE courses SET beruf_saeulen = ARRAY['zertifikatslehrgang'] WHERE id = 27;

-- ID 116: "Deutsch Zertifikate Aarau – Vorbereitung & Prüfungen (telc/fide/ÖSD/SDS)"
-- → Vorbereitungskurs auf externe Sprachzertifikatsprüfungen, kein Lehrgang
-- → automatisch als 'zertifikatslehrgang' klassifiziert (wegen "Zertifikate" im Titel)
UPDATE courses SET beruf_saeulen = ARRAY['fachkurs'] WHERE id = 116;

-- ID 117: "Französisch Zertifikate Aarau – DELF/DALF Vorbereitung"
-- → gleicher Fall wie ID 116
UPDATE courses SET beruf_saeulen = ARRAY['fachkurs'] WHERE id = 117;
