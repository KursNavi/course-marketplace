-- ===========================================================================
-- NOCH NICHT AUSGEFUEHRT. Diese Migration ist vorbereitet, aber absichtlich
-- weder auf der Produktion noch auf der Vorschau-Datenbank eingespielt.
-- Einspielen nur auf ausdruecklichen Auftrag.
-- ===========================================================================
--
-- Zweck: Geokoordinaten direkt am Veranstaltungsort hinterlegen.
--
-- Stand ohne diese Migration:
--   Die Umkreissuche loest Kursorte zur Laufzeit im Browser aus der
--   mitgelieferten Schweizer Postleitzahlen-Tabelle auf
--   (src/data/swissPlaces.json, siehe src/lib/courseGeo.js). Das kostet nichts,
--   braucht keinen Geocoding-Dienst und funktioniert fuer jeden Kursort, bei
--   dem PLZ oder Ortsname hinterlegt ist. Die Genauigkeit ist der
--   Ortsmittelpunkt — fuer einen Umkreis ab 5 km ausreichend, und die
--   Oberflaeche kennzeichnet solche Positionen als «ungefaehr».
--
-- Wozu dann diese Spalten:
--   1. Genauere Kartenmarker auf Hausnummern-Ebene (statt Ortsmittelpunkt).
--   2. Kursorte, die sich aus dem Freitext nicht aufloesen lassen, koennen
--      einmalig von Hand oder per Geocoding nachgetragen werden, statt bei
--      jeder Suche erneut zu scheitern.
--   3. Spaetere Umkreisfilterung in der Datenbank statt im Browser, falls der
--      Kursbestand dafuer zu gross wird.
--
-- geo_source dokumentiert die Herkunft, geo_precision die Genauigkeit. Ohne
-- diese zwei Felder waere spaeter nicht mehr unterscheidbar, was eine
-- geprueft exakte Adresse ist und was ein Ortsmittelpunkt — und damit auch
-- nicht, was in der Oberflaeche als «ungefaehr» zu kennzeichnen ist.
--
-- Die Spalten sind bewusst NULL-bar: ein fehlender Wert bedeutet «nicht
-- bekannt». Es werden keine Platzhalter-Koordinaten eingetragen.

-- --- Veranstaltungstermine ---
ALTER TABLE public.course_events
  ADD COLUMN IF NOT EXISTS latitude     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_precision TEXT,
  ADD COLUMN IF NOT EXISTS geo_source    TEXT,
  ADD COLUMN IF NOT EXISTS geo_updated_at TIMESTAMPTZ;

-- --- Hinterlegte Kursorte (Lead-/Flex-Kurse) ---
ALTER TABLE public.course_locations
  ADD COLUMN IF NOT EXISTS latitude     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_precision TEXT,
  ADD COLUMN IF NOT EXISTS geo_source    TEXT,
  ADD COLUMN IF NOT EXISTS geo_updated_at TIMESTAMPTZ;

-- Wertebereiche festnageln, damit spaeter kein Freitext-Wildwuchs entsteht.
-- 'address'  = auf Strasse/Hausnummer aufgeloest (exakt)
-- 'locality' = Ortsmittelpunkt oder PLZ-Kreis (ungefaehr)
-- 'manual'   = von Hand gesetzt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_events_geo_precision_check'
  ) THEN
    ALTER TABLE public.course_events
      ADD CONSTRAINT course_events_geo_precision_check
      CHECK (geo_precision IS NULL OR geo_precision IN ('address', 'locality', 'manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_locations_geo_precision_check'
  ) THEN
    ALTER TABLE public.course_locations
      ADD CONSTRAINT course_locations_geo_precision_check
      CHECK (geo_precision IS NULL OR geo_precision IN ('address', 'locality', 'manual'));
  END IF;

  -- Koordinaten nur paarweise: eine Breite ohne Laenge waere unbrauchbar und
  -- wuerde in der Karte als Punkt am Nullmeridian landen.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_events_geo_pair_check'
  ) THEN
    ALTER TABLE public.course_events
      ADD CONSTRAINT course_events_geo_pair_check
      CHECK ((latitude IS NULL) = (longitude IS NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_locations_geo_pair_check'
  ) THEN
    ALTER TABLE public.course_locations
      ADD CONSTRAINT course_locations_geo_pair_check
      CHECK ((latitude IS NULL) = (longitude IS NULL));
  END IF;
END $$;

-- Teil-Indizes: nur Zeilen MIT Koordinaten sind fuer raeumliche Abfragen
-- interessant, und das ist zu Beginn die Minderheit.
CREATE INDEX IF NOT EXISTS idx_course_events_latlng
  ON public.course_events (latitude, longitude)
  WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_course_locations_latlng
  ON public.course_locations (latitude, longitude)
  WHERE latitude IS NOT NULL;

COMMENT ON COLUMN public.course_events.geo_precision IS
  'address = exakte Adresse, locality = Ortsmittelpunkt (ungefaehr), manual = von Hand gesetzt';
COMMENT ON COLUMN public.course_locations.geo_precision IS
  'address = exakte Adresse, locality = Ortsmittelpunkt (ungefaehr), manual = von Hand gesetzt';
