# Phase 8.3 — Segment-Default-Neutralitäts-Fix

**Branch:** `feature/dynamic-theme-worlds`
**Ausgangsbasis:** Commit `3dcb242`
**Fix-Commit:** (nach diesem Dokument erstellt)
**Datum:** 2026-07-22

---

## 1. Browserbefund (Phase-8.2-Browser-Vortest auf Commit 3dcb242)

### Erfolgreich

- Tatsächlicher Key leer ✓
- Tatsächlicher Titel leer ✓
- Tatsächlicher Slug leer ✓
- Einleitung leer ✓
- Suche neutral ✓
- Bilder und SEO leer ✓
- Unterlisten leer oder korrekt gesperrt ✓
- Ungespeicherte QA-Werte werden nach Abbrechen entfernt ✓
- Aufeinanderfolgende Create-Sessions werden neu initialisiert ✓
- Kein Datensatz wurde erstellt ✓

### Verbleibender Fehler

Der Create-Screen zeigte trotz korrekter Segmentauswahl `— Segment auswählen —`:

```
DB-Segment: professionell
```

Dies trat auf:
- Nach Sport → Neu
- Nach Yoga → Neu
- Bei direktem Einstieg → Neu
- In jeder neuen Create-Session

---

## 2. Exakte Root Cause

Datei: `src/components/admin/AdminThemeWorldForm.jsx`

### Fehlerhafter Mapping-Pfad

**Anzeige (vor Fix, Zeile 387):**
```javascript
const dbSegment = URL_TO_DB[grundlagen.url_segment] || 'professionell';
```

**Save-Payload (vor Fix, Zeile 253):**
```javascript
db_segment: URL_TO_DB[grundlagen.url_segment] || 'professionell',
```

### Warum `professionell` erschien

1. `grundlagen.url_segment` startet korrekt als `''` (leerer String — Phase 8.2 Fix)
2. `URL_TO_DB['']` → `undefined` (kein Eintrag für leeren String)
3. `undefined || 'professionell'` → `'professionell'`
4. Die Variable `dbSegment` hatte damit immer den Wert `'professionell'` im leeren Zustand

Dies ist ein **reiner Anzeige- und Payload-Fehler** durch einen unsicheren `||`-Fallback. Der `url_segment`-State selbst war korrekt leer (Phase 8.2 hat `url_segment: ''` als Default korrekt gesetzt).

---

## 3. War `professionell` nur angezeigt oder auch im State/Payload?

| Ebene | Ergebnis |
|-------|----------|
| `grundlagen.url_segment` React-State | Korrekt leer (`''`) |
| `dbSegment` (abgeleitete Const) | `'professionell'` (BUG — nur für Anzeige) |
| DB-Segment-Anzeige im UI | `'professionell'` (BUG — sichtbares Problem) |
| Save-Payload `db_segment` | `'professionell'` (wäre im Payload gelandet) |
| Tatsächlicher API-Aufruf ohne Segment | NEIN — Client-Validierung blockiert (Phase 8.2 bereits korrekt) |
| API-Validator bei leerem `url_segment` | Würde ebenfalls ablehnen (422) |

**Fazit:** Der Wert `professionell` wäre ohne die Client-Validierung (Phase 8.2) im API-Payload gelandet. Die Client-Validierung hat verhindert, dass Daten korrumpiert wurden. Dennoch war die Anzeige irreführend und der Code-Pfad unsicher.

---

## 4. Neutrales Create-Verhalten nach Fix

Im Create-Modus gilt jetzt:

| Feld | Wert |
|------|------|
| `url_segment` | `''` (leerer String) |
| `dbSegment` (Const) | `null` |
| DB-Segment-Anzeige | `—` |
| Kein abgeleitetes Segment | ✓ |
| Kein Segment-Default | ✓ |
| Speichern ohne Segment | Blockiert mit Meldung |

---

## 5. Gültige Segmentzuordnungen

| URL-Segment | DB-Segment | Anzeige |
|------------|-----------|---------|
| `beruflich` | `professionell` | `professionell` |
| `privat-hobby` | `privat` | `privat` |
| `kinder-jugend` | `kinder` | `kinder` |
| `''` (leer) | `null` | `—` |

Definiert in `URL_TO_DB` und `VALID_DB_SEGMENTS`/`VALID_URL_SEGMENTS` in `api/_lib/theme-world-validate.js`.

---

## 6. UI-Anpassung

### Vor Fix

```jsx
// Zeile 387 — Abgeleitete Const
const dbSegment = URL_TO_DB[grundlagen.url_segment] || 'professionell';

// Zeile 503 — Anzeige
<code>{dbSegment}</code>

// Zeile 253 — Save-Payload
db_segment: URL_TO_DB[grundlagen.url_segment] || 'professionell',
```

### Nach Fix

```jsx
// Zeile 387 — Abgeleitete Const
const dbSegment = URL_TO_DB[grundlagen.url_segment] || null;

// Zeile 503 — Anzeige
<code>{dbSegment || '—'}</code>

// Zeile 253 — Save-Payload
db_segment: URL_TO_DB[grundlagen.url_segment] || null,
```

**Anmerkung:** Der Save-Payload-Fallback auf `null` ist technisch ein toter Codepfad, da die Client-Validierung davor abfängt. Die Änderung ist dennoch wichtig für Codeklarheit und defensive Sicherheit.

---

## 7. Client- und API-Validierung

### Client-Validierung (seit Phase 8.2, unverändert)

```javascript
// In saveGrundlagen():
if (!grundlagen.url_segment) {
  grundlagenSave.markError('Bitte wähle ein Segment aus.');
  showNotification('Fehler: Bitte wähle ein Segment aus.');
  return; // Kein API-Aufruf
}
```

### API-Validierung (`api/_lib/theme-world-validate.js`)

```javascript
// validateThemeWorldBase (CREATE):
if (!VALID_DB_SEGMENTS.includes(data.db_segment)) {
  collect(errors, 'db_segment', `Ungültiger Wert. Erlaubt: ${VALID_DB_SEGMENTS.join(', ')}.`);
}
if (!VALID_URL_SEGMENTS.includes(data.url_segment)) {
  collect(errors, 'url_segment', `Ungültiger Wert. Erlaubt: ${VALID_URL_SEGMENTS.join(', ')}.`);
}
// Konsistenzprüfung
const SEGMENT_MAP = { professionell: 'beruflich', privat: 'privat-hobby', kinder: 'kinder-jugend' };
if (data.db_segment && data.url_segment && SEGMENT_MAP[data.db_segment] !== data.url_segment) {
  collect(errors, 'db_segment/url_segment', ...);
}
```

Die API würde einen leeren `db_segment`-Wert (leer, null, undefined) mit HTTP 422 ablehnen — als zweite Verteidigungslinie.

---

## 8. Payload-Tests

Neue Tests in `tests/theme-world-phase8-3-segment-neutrality.test.jsx`:

**Create-Payload Korrektheit:**
- `beruflich` → Payload enthält `db_segment: 'professionell'`
- `privat-hobby` → Payload enthält `db_segment: 'privat'`
- `kinder-jugend` → Payload enthält `db_segment: 'kinder'`
- Ohne Segment: kein API-Request (kein `professionell`-Default)
- Payload enthält keine Segment-ID (kein `id`-Feld)

---

## 9. Edit-Regression

Beide Edit-Modi bleiben korrekt:
- **Sport** (`url_segment: 'beruflich'`): zeigt `professionell` ✓
- **Yoga** (`url_segment: 'privat-hobby'`): zeigt `privat` ✓
- Laden erzeugt keinen Dirty-State ✓
- `updateThemeWorld` wird nach Laden nicht automatisch aufgerufen ✓

---

## 10. Vollständige Testergebnisse

### Phase-8.3-Tests (neu)

```
37/37 passed
tests/theme-world-phase8-3-segment-neutrality.test.jsx
```

Abgedeckte Test-Kategorien:
- Segment-Mapping: Leere Werte (4 Tests)
- Segment-Mapping: Gültige Werte (3 Tests)
- Segment-Mapping: Zurücksetzen auf leer (3 Tests)
- Speicherschutz ohne Segment (3 Tests)
- Create-Payload Korrektheit (5 Tests)
- API-Validator Segment-Validierung (11 Tests)
- Edit-Modus DB-Segment-Anzeige (3 Tests)
- Navigation Regression DB-Segment (4 Tests)
- Abgedeckte Szenarien laut Spec: 20 von 20

### Vollständige Suite

```
1037/1037 passed
40 Testdateien
kein Worker-Crash, kein unhandled error
```

Ausgangsstand: 1000/1000 (39 Dateien)
Zuwachs: +37 Tests, +1 Datei

### ESLint

```
Keine Fehler oder Warnungen
```

### Build

```
✓ built in 21.38s
175 static HTML files generated
```

---

## 11. Verbleibende Risiken

| Risiko | Bewertung |
|--------|-----------|
| Falsche Segment-ID im Edit-Payload | Kein Risiko — `URL_TO_DB[valid_segment]` liefert immer den korrekten Wert |
| Stiller Fallback auf `professionell` | Beseitigt |
| API akzeptiert leeres Segment | Nein — doppelte Absicherung (Client + API-Validator) |
| Kinder-Jugend-Modus ungetestet (fehlte bisher) | Behoben — neuer Test `kinder-jugend → kinder` |
| DB-Constraint bei leerem Segment | Kein Risiko — Client und API blockieren vorher |

---

## 12. Entscheidung zur erneuten Browser-QA

**Neuer Browser-Vortest empfohlen.**

Der verbleibende Fehler (DB-Segment: professionell) ist behoben. Alle drei Änderungen betreffen ausschliesslich:
1. Die abgeleitete Anzeigevariable (`dbSegment`)
2. Die Darstellung im UI
3. Den defensiven Fallback im Save-Payload

Keine strukturellen Änderungen an Routing, State-Management oder Datenbank-Schema.

Zu testen im Browser:
- Create-Modus: DB-Segment-Anzeige zeigt `—`
- Segment auswählen: korrektes DB-Segment erscheint
- Segment zurücksetzen: DB-Segment wird wieder `—`
- Sport → Neu: neutral
- Yoga → Neu: neutral
- Direkter Einstieg → Neu: neutral
- Nichts speichern
