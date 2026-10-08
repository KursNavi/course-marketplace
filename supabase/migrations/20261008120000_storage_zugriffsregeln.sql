-- Zugriffsregeln für die beiden Datei-Speicher.
--
-- ANLASS
--
-- Diese Regeln waren nirgends im Projekt hinterlegt — sie wurden seinerzeit von
-- Hand im Supabase-Dashboard eingestellt. Folge: In der Vorschau-Datenbank
-- fehlten sie vollständig, dort konnte niemand Kursbilder hochladen. Beim
-- Nachstellen fiel zusätzlich auf, dass die Produktionsregeln zu weit gefasst
-- sind.
--
-- Diese Datei macht den Soll-Zustand nachvollziehbar und wiederherstellbar.
--
-- WAS SICH ÄNDERT
--
-- 1. certificates — Verifizierungsdokumente der Anbieter
--    VORHER: SELECT und INSERT für `public`, geprüft wurde nur der Speichername.
--            Mit dem öffentlichen Schlüssel aus dem Seitenquelltext liess sich
--            der Speicher auflisten UND jede Datei herunterladen. Nachgewiesen
--            am 08.10.2026: HTTP 200 auf eine Kopfabfrage ohne Anmeldung.
--    NACHHER: Nur angemeldete Nutzer, und nur die eigenen Dateien.
--
--    Admins sind davon NICHT betroffen: Sie öffnen die in profiles.verification_docs
--    gespeicherten signierten Links (AdminPanel.jsx:539). Signierte Links umgehen
--    diese Regeln, die Prüfung von Anbietern funktioniert unverändert.
--
-- 2. course-images — Kursbilder
--    VORHER: INSERT und UPDATE für `public`. Jede beliebige Person konnte
--            Dateien in den Speicher legen.
--    NACHHER: Nur angemeldete Nutzer.
--    SELECT bleibt bewusst öffentlich — Besucher müssen Kursbilder sehen.
--
-- 3. course-images — Löschen
--    VORHER: gar keine Regel. src/lib/imageUtils.js ruft `.remove()` auf, das
--            scheiterte still; die Datei blieb im Speicher und öffentlich
--            erreichbar, obwohl die Oberfläche "gelöscht" meldete.
--    NACHHER: Angemeldete dürfen löschen.
--
-- EIGENTÜMER-PRÜFUNG BEI ZERTIFIKATEN
--
-- Zwei Wege, bewusst beide: `owner` wird von Supabase beim Hochladen gesetzt,
-- der Dateiname trägt zusätzlich die Nutzer-ID als Präfix (Dashboard.jsx:352:
-- `${uid}_${Date.now()}.${ext}`). Ältere Dateien, die unter der alten offenen
-- Regel ohne Anmeldung hochgeladen wurden, haben womöglich keinen `owner` —
-- für die greift die Namensprüfung.
--
-- EINSPIELEN
--
-- In BEIDE Projekte, damit Vorschau und Produktion gleich bleiben:
--   Produktion nplxmpfasgpumpiddjfl, Vorschau omoapbvfligjfznzivyu
-- Die Datei ist mehrfach ausführbar — bestehende Regeln werden zuerst entfernt.

-- --------------------------------------------------------------------------
-- certificates: Verifizierungsdokumente
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow cert reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow cert uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anbieter liest eigene Verifizierungsdokumente" ON storage.objects;
DROP POLICY IF EXISTS "Anbieter laedt eigene Verifizierungsdokumente hoch" ON storage.objects;

CREATE POLICY "Anbieter liest eigene Verifizierungsdokumente"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (owner = auth.uid() OR name LIKE auth.uid()::text || '\_%')
  );

CREATE POLICY "Anbieter laedt eigene Verifizierungsdokumente hoch"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certificates'
    AND name LIKE auth.uid()::text || '\_%'
  );

-- --------------------------------------------------------------------------
-- course-images: Kursbilder
-- --------------------------------------------------------------------------

-- Lesen bleibt öffentlich: Kursbilder erscheinen für nicht angemeldete Besucher.
DROP POLICY IF EXISTS "Give public access to course images" ON storage.objects;
CREATE POLICY "Give public access to course images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-images');

DROP POLICY IF EXISTS "Allow image uploads" ON storage.objects;
DROP POLICY IF EXISTS "Angemeldete laden Kursbilder hoch" ON storage.objects;
CREATE POLICY "Angemeldete laden Kursbilder hoch"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-images');

DROP POLICY IF EXISTS "Allow image updates" ON storage.objects;
DROP POLICY IF EXISTS "Angemeldete aendern Kursbilder" ON storage.objects;
CREATE POLICY "Angemeldete aendern Kursbilder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-images');

-- Neu: ohne diese Regel scheiterte jedes Löschen still.
DROP POLICY IF EXISTS "Angemeldete loeschen Kursbilder" ON storage.objects;
CREATE POLICY "Angemeldete loeschen Kursbilder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-images');
