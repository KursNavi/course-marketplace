# Umkreissuche und Kartenansicht

Erste Version: Besucher wählen einen Ausgangsort (Ort oder Postleitzahl) oder
geben freiwillig ihren Gerätestandort frei und filtern die Kurssuche auf einen
Umkreis von 5, 10, 25 oder 50 km. Dieselbe Treffermenge ist als Liste oder als
Karte darstellbar.

## Verbindliche Regel: die Priorisierung bleibt unverändert

Die Entfernung dient **ausschliesslich der Filterung**. Es gibt keine
Entfernungssortierung und keinen Schalter dafür.

* Der Umkreisfilter ist in `src/App.jsx` ein eigener Schritt *nach* allen
  übrigen Filtern und *vor* der Anzeige: `filteredCoursesPreRadius` →
  `filteredCoursesPreCategory`. Er nutzt `Array.filter` und behält damit die
  Reihenfolge; es wird nur entfernt.
* `sortCoursesByRelevance` in `src/lib/searchRelevance.js` ist unverändert und
  kennt keine Koordinaten.
* Nachgewiesen in `tests/umkreis-prio-regression.test.js` — unter anderem
  explizit für den Fall, dass ein niedriger priorisierter Kurs näher liegt.

## Kursorte: wie aus Adressdaten Koordinaten werden

Es gibt **keinen** Geocoding-Dienst zur Laufzeit. Stattdessen liegt eine
statische Tabelle der Schweizer Postleitzahlen in `src/data/swissPlaces.json`
(rund 4500 Einträge, 195 KB, eigenes Ladepaket). Sie wird erst geladen, wenn
jemand die Umkreissuche benutzt.

* **Quelle:** GeoNames Postleitzahlen Schweiz, Lizenz CC BY 4.0.
  Namensnennung ist Lizenzbedingung und steht in der Datei selbst
  (`quelle`, `lizenz`) sowie im Erzeugungsskript.
* **Neu erzeugen:** `CH.zip` von
  `https://download.geonames.org/export/zip/CH.zip` entpacken, dann
  `npm run geo:places -- <pfad-zu-CH.txt>`. Ergebnis ist stabil sortiert, der
  Lauf also wiederholbar.
* **Kosten:** keine. Kein Zugangsschlüssel, keine Nutzungsgrenze, keine
  Abfrage pro Suche. Weder Suchbegriffe noch Besucherstandorte gehen an Dritte.

### Rangfolge der Ortsquellen (`src/lib/courseGeo.js`)

1. Präsenz-Termine aus `course_events` — bei aktivem Datumsfilter nur die dazu
   passenden Termine.
2. Hinterlegte Kursorte aus `course_locations` (nur wenn es keine Termine gibt).
3. Flache Felder am Kurs (`city`, `canton`, `address`) als letzte Rückfallebene.

Damit zählt immer der Veranstaltungsort, nie der Firmensitz — und eine veraltete
Adresse am Kurs kann einen Kurs nicht an den falschen Ort setzen.

### Genauigkeit und Grenzen

* Alle Positionen sind **Ortsmittelpunkte** (PLZ-Kreis bzw. Ortschaft), nie
  Hausadressen. Die Oberfläche kennzeichnet sie als «ungefähr».
* Gefiltert wird nach **Luftlinie** (Haversine, `src/lib/geoDistance.js`). Die
  Grenze zählt als Treffer.
* Was sich nicht eindeutig auflösen lässt, bleibt **ohne** Koordinate. Es wird
  nichts geschätzt und kein Kantonsmittelpunkt eingesetzt. Solche Kurse
  erscheinen weiterhin in der normalen Suche, können bei aktivem Umkreis aber
  nicht als räumlicher Treffer gelten; die Oberfläche erklärt das.
* Reine Onlinekurse sind keine räumlichen Treffer und bekommen keinen Marker.
  Bei Hybridkursen zählt der physische Ort. Kurse im Ausland und in
  Liechtenstein liegen aussserhalb der Schweizer Tabelle.

### Abdeckung prüfen und Ortsdaten ergänzen

`npm run geo:coverage` (nur lesend) zeigt, wie viele veröffentlichte Kurse
auflösbar sind und listet die Kurse mit Nacharbeitsbedarf auf:

```
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run geo:coverage
```

Das Skript wählt bewusst kein Projekt selbst aus. Mit `--fill` trägt es die
Koordinaten in die Datenbank ein — das setzt die unten genannte Migration
voraus und bricht sonst ohne Änderung ab.

### Vorbereitete, NICHT eingespielte Migration

`supabase/migrations/20261110120000_add_geo_coordinates_to_course_places.sql`
ergänzt `course_events` und `course_locations` um `latitude`, `longitude`,
`geo_precision`, `geo_source`, `geo_updated_at`.

**Status: nicht ausgeführt.** Die erste Version funktioniert ohne sie. Sie wird
gebraucht, sobald Marker auf Hausnummern-Ebene genau sein sollen, einzelne
Kursorte von Hand nachgetragen werden oder der Umkreis in der Datenbank
gefiltert werden soll. Einspielen nur auf ausdrücklichen Auftrag.

## Karte

* **Bibliothek:** Leaflet 1.9 (BSD-2) mit `leaflet.markercluster` für das
  Zusammenfassen dicht beieinanderliegender Marker. Beide werden erst beim
  Öffnen der Kartenansicht nachgeladen (eigene Ladepakete, rund 150 KB + 35 KB).
* **Kartenbilder:** standardmässig OpenStreetMap
  (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, ODbL). Die Namensnennung
  «© OpenStreetMap-Mitwirkende» ist über die Leaflet-Attribution sichtbar.
* **Kein Zugangsschlüssel, keine Kosten.** Für dauerhaft höhere Zugriffszahlen
  gelten die Fair-Use-Regeln von OpenStreetMap; ein anderer Kartendienst lässt
  sich dann ohne Codeänderung über Umgebungsvariablen einsetzen:

  | Variable | Bedeutung |
  |---|---|
  | `VITE_MAP_TILE_URL` | Adressmuster der Kartenbilder |
  | `VITE_MAP_TILE_ATTRIBUTION` | anzuzeigende Quellenangabe |

* Verschieben und Zoomen ändert die Suche **nicht**. Liste und Karte beruhen
  auf derselben `sortedCourses`-Liste; innerhalb eines Markers gilt dieselbe
  Priorisierung.
* Fällt die Karte aus, greift `MapErrorBoundary` bzw. der Fehlerzustand in
  `CourseMap`: ein Hinweis mit Weg zurück zur Liste. Die Ergebnisliste bleibt
  unberührt.

## Standortfreigabe

* `Permissions-Policy` in `vercel.json`: `geolocation=(self)` statt vorher
  `geolocation=()`. Alle übrigen Sicherheitsvorgaben sind unverändert, geprüft
  in `tests/security-headers.test.js`.
* Die Abfrage startet ausschliesslich auf Klick (`src/lib/deviceLocation.js`).
  Kein Aufruf beim Seitenaufruf, keine Vorab-Berechtigungsabfrage, kein
  `watchPosition`.
* Abgelehnt, Zeitüberschreitung, nicht verfügbar und nicht unterstützt haben
  je einen eigenen, verständlichen Text. Die manuelle Eingabe bleibt immer
  nutzbar.
* Präzise Gerätekoordinaten werden nicht gespeichert, nicht in die Adresszeile
  geschrieben, nicht gemeldet und nicht protokolliert. Geprüft in
  `tests/umkreis-suchparameter.test.js`.

## Suchparameter

| Parameter | Inhalt |
|---|---|
| `near` | Kennung eines **manuell gewählten** Ortes, z.B. `plz:8001:Zürich` oder `ort:ZH:Winterthur` |
| `radius` | 5, 10, 25 oder 50 — nur zusammen mit `near` |
| `map` | `1` für die Kartenansicht |

Ein per Standortfreigabe gesetzter Ausgangsort erscheint bewusst **nicht** in
der Adresszeile; er lebt nur im Zustand der offenen Seite und übersteht daher
kein Neuladen.

## Tests

| Datei | Inhalt |
|---|---|
| `tests/umkreis-geo-distanz.test.js` | Luftlinie, Radiusgrenze (innen, aussen, genau auf der Linie) |
| `tests/umkreis-swiss-places.test.js` | PLZ- und Ortssuche, Umlaute, Mehrdeutigkeit, echter Datensatz |
| `tests/umkreis-course-geo.test.js` | Kursorte, mehrere Standorte, Datumsfilter, Online/Hybrid/Ausland, Marker |
| `tests/umkreis-prio-regression.test.js` | **Die Priorisierung bleibt unverändert** |
| `tests/umkreis-panel.test.jsx` | Bedienfeld, Standortfreigabe in allen Fällen |
| `tests/umkreis-suchparameter.test.js` | Zusammenspiel mit bestehenden Filtern, Datenschutz |
