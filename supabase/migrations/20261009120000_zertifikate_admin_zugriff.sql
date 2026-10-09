-- Nachtrag zu 20261008120000_storage_zugriffsregeln.sql
--
-- ANLASS: Eine Verschlechterung, die mit der vorigen Migration entstand.
--
-- Die Regeln für den certificates-Speicher verlangen, dass der Dateiname mit
-- der Kennung des ANGEMELDETEN Nutzers beginnt. Beim Impersonieren stimmt das
-- nicht: Dort bleibt die Anmeldung die des Admins (src/App.jsx:321,
-- `effectiveUser = impersonatedUser || user` — die Sitzung wird nicht
-- gewechselt), der Dateiname trägt aber die Kennung des Anbieters
-- (src/components/Dashboard.jsx:44 und :352).
--
-- Folge: Lädt ein Admin stellvertretend ein Verifizierungsdokument hoch, wird
-- das jetzt abgewiesen. Vorher ging es — die alte, zu offene Regel prüfte den
-- Namen gar nicht.
--
-- Praktische Auswirkung bisher keine: Der Speicher ist leer, die Funktion wurde
-- nie benutzt. Unangenehm wäre die Kombination mit dem geschluckten Fehler in
-- handleDocUpload gewesen — ein Fehlschlag ohne jede Rückmeldung. Dieser Teil
-- ist im zugehörigen Code-Commit behoben.
--
-- LÖSUNG
--
-- Beide Regeln lassen zusätzlich Admins zu. Dafür wird private.is_admin()
-- wiederverwendet (angelegt in 20260830080000_harden_supabase_linter_warnings.sql,
-- SECURITY DEFINER, für `authenticated` freigegeben) — kein zweiter Weg, die
-- Admin-Rolle zu prüfen.
--
-- EINSPIELEN: in BEIDE Projekte.
--   Produktion nplxmpfasgpumpiddjfl, Vorschau omoapbvfligjfznzivyu
-- Mehrfach ausführbar.

DROP POLICY IF EXISTS "Anbieter liest eigene Verifizierungsdokumente" ON storage.objects;
CREATE POLICY "Anbieter liest eigene Verifizierungsdokumente"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (
      owner = auth.uid()
      OR name LIKE auth.uid()::text || '\_%'
      -- Admins pruefen Verifizierungsantraege und laden stellvertretend hoch.
      OR private.is_admin()
    )
  );

DROP POLICY IF EXISTS "Anbieter laedt eigene Verifizierungsdokumente hoch" ON storage.objects;
CREATE POLICY "Anbieter laedt eigene Verifizierungsdokumente hoch"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'certificates'
    AND (
      name LIKE auth.uid()::text || '\_%'
      OR private.is_admin()
    )
  );
