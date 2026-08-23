# Phase 8.11 – Public Content Integrity & Search Labels

**Branch:** `feature/dynamic-theme-worlds`
**Datum:** 2026-08-01
**Status:** ✅ Abgeschlossen (1257/1257 Tests bestanden)

---

## Übersicht

Phase 8.11 umfasst drei thematisch verwandte Verbesserungen:

1. **`area_label_de`**: Lesbares Anzeige-Label für dynamische Suchbereiche
2. **Delivery-Kanonisierung**: Einheitliche URL-Werte für den Liefertyp-Filter
3. **Escaped-HTML-Schutz**: API-Validator lehnt maskierten HTML-Artikelinhalt ab

---

## 1. `area_label_de` – Lesbarer Suchbereichs-Anzeigename

### Problem

Die Anzeigebezeichnung für Suchbereiche (Breadcrumb, Seitentitel, Suchfilter-Chip) wurde bisher
ausschliesslich aus der statischen Taxonomiedatenbank (`taxonomy_level2`) oder dem alten
`bereichLandingConfig.js` abgeleitet. Dynamisch angelegte Themenwelten hatten keinen eigenen
lesbaren Label-Eintrag und fielen auf den technischen `area_slug` zurück (z. B. `kreativ_gestalten`
statt „Kreativ & Gestalten").

### Lösung

**Neues optionales JSON-Feld** `area_label_de` im bestehenden `search_config`-JSONB-Objekt.
Keine Datenbankmigrierung nötig — das Feld wird serverseitig als erlaubter Schlüssel registriert
und clientseitig in der `SearchPageView` als Fallback eingebunden.

#### Dateien

| Datei | Änderung |
|-------|----------|
| `api/_lib/theme-world-validate.js` | `area_label_de` in `SEARCH_CONFIG_ALLOWED_KEYS` ergänzt; Validierung (optional, max 80 Zeichen) |
| `src/components/admin/AdminThemeWorldForm.jsx` | Formularfeld „Anzeigename in der Suche" im Suche-Tab; Lade-/Speicher-Logik |
| `src/lib/themeWorldService.js` | `fetchPublishedThemeWorldAreaLabels()`: lädt alle publizierten Themenwelten einmalig, gibt `Map<area_slug, label>` zurück |
| `src/components/SearchPageView.jsx` | `themeWorldLabels`-State + Effect; erweiterte `getAreaLabelFromDB`-Fallback-Kette |

#### Fallback-Kette in `getAreaLabelFromDB` (SearchPageView)

1. DB-Taxonomie (`taxonomy_level2.name_de` aus dem Supabase-Cache)
2. Statische Konstante `NEW_TAXONOMY` (hardcodiert in SearchPageView)
3. Legacy `bereichLandingConfig.js`
4. `area_label_de` aus publizierten Themenwelten (`search_config.area_label_de`)
5. `title_de` der Themenwelt (Fallback wenn `area_label_de` leer)
6. Roher `area_slug` (letzter Ausweg)

#### Admin-UI

Das Feld erscheint im Tab **Suche** zwischen `area_slug` und `default_spec`:

- Typ: `text`, `maxLength={80}`
- Placeholder: `z. B. Kreativ & Gestalten`
- Hint: „Lesbare Bezeichnung für Breadcrumb, Seitentitel und Suchfilter. Leer lassen um den Titel der Themenwelt zu verwenden."
- Wird nur gespeichert wenn nicht leer (kein leerer String in `search_config`)

#### Performance

`fetchPublishedThemeWorldAreaLabels()` wird einmalig beim Mount von `SearchPageView` gefeuert
(leeres `useEffect`-Dependency-Array). Das Ergebnis ist eine `Map`, die für alle
`getAreaLabelFromDB`-Aufrufe innerhalb derselben Suche-Session wiederverwendet wird.

---

## 2. Delivery-Kanonisierung

### Problem

Der URL-Parameter `delivery` akzeptierte historisch Werte wie `in_person`, `onsite` und `online`,
die keine kanonischen Schlüsselwörter sind. Beim Klick auf CTA-Links aus Themenwelten oder
Bereichs-Landingpages konnten nicht-kanonische Werte in die URL gelangen und zu inkonsistenten
Filterzuständen führen.

### Kanonische Werte

| Wert in URL | Bedeutung |
|-------------|-----------|
| `presence` | Präsenz-/Vor-Ort-Kurs |
| `online_live` | Online-Live-Kurs |
| `self_study` | Selbststudium / E-Learning |

### Normalisierung

Die Funktion `normalizeDeliveryTypeKey()` (zuvor intern in `courseMetadata.js`) wurde
**exportiert** und wird nun an allen URL-Lese- und -Schreibpunkten eingesetzt:

#### URL-Lesepunkte (Parsing)

| Datei | Ort |
|-------|-----|
| `src/App.jsx` | Lazy-Init der `selectedDeliveryTypes`-State |
| `src/App.jsx` | `syncFromUrl`-Funktion (popstate-Handler) |
| `src/App.jsx` | Direkter Setter nach Segment-/Bereichswechsel |

Ein neuer Hilfer `parseDeliveryParam(param)` auf Modulebene kapselt: Split bei `,`,
`normalizeDeliveryTypeKey` pro Token, Deduplizierung via `Set`, Filterung von `null`.

#### URL-Schreibpunkte (Generierung)

| Datei | Ort |
|-------|-----|
| `src/components/BereichLandingPage.jsx` | `buildSearchUrl()` |
| `src/components/SzenarioArtikelView.jsx` | `goToSearch()` |
| `src/lib/themeWorldAdapter.js` | `predefinedSearches`, `ctaLinks`, `regions`, `_extractSearchParams` |

#### Serverseite

`VALID_DELIVERY_TYPES` in `api/_lib/theme-world-validate.js` aktualisiert:

```diff
- const VALID_DELIVERY_TYPES = ['online_live', 'self_study', 'in_person'];
+ const VALID_DELIVERY_TYPES = ['online_live', 'self_study', 'presence'];
```

**Rückwärtskompatibilität**: Alte URLs mit `in_person`, `onsite`, `online` werden beim Parsen
automatisch auf den kanonischen Wert normalisiert. Die Seite funktioniert weiterhin korrekt.

---

## 3. Escaped-HTML-Validator

### Problem

Durch Copy-Paste aus bestimmten Quellen oder fehlerhafte Editoroperationen kann
`content_html` eines Szenario-Artikels vollständig maskiertes HTML enthalten —
z. B. `&lt;p&gt;Hallo&lt;/p&gt;` statt `<p>Hallo</p>`. Solche Inhalte werden im Browser
als Klartext dargestellt (die HTML-Tags erscheinen sichtbar) statt als formatierter Text.

### Lösung

Neue Funktion `detectEscapedHtmlDocument(html)` in `api/_lib/theme-world-validate.js` (exportiert):

```js
export function detectEscapedHtmlDocument(html) {
  if (!html || typeof html !== 'string') return false;
  // Prüft auf ≥3 escaped strukturelle Tags (p, div, ul, h2 usw.)
  // UND keine echten HTML-Tags vorhanden
  const escapedTagPatterns = [
    /&lt;p(?:[\s>/]|&)/i,
    /&lt;div(?:[\s>/]|&)/i,
    /&lt;ul(?:[\s>/]|&)/i,
    /&lt;ol(?:[\s>/]|&)/i,
    /&lt;li(?:[\s>/]|&)/i,
    /&lt;h[1-6](?:[\s>/]|&)/i,
    /&lt;\/p&gt;/i,
    /&lt;\/div&gt;/i,
  ];
  const escapedCount = escapedTagPatterns.filter((p) => p.test(html)).length;
  const hasRealTags = /<[a-zA-Z][^>]*>/.test(html);
  return escapedCount >= 3 && !hasRealTags;
}
```

**Schwellenwert 3**: Vermeidet Falsch-Positive bei literalen Vergleichen wie „2 < 3" oder
Inline-Code-Snippets mit einzelnen `&lt;` Vorkommnissen.

**Regex-Suffix `(?:[\s>/]|&)`**: Notwendig, weil `&lt;p&gt;` das `&` von `&gt;` direkt nach
dem Tag-Namen hat, nicht `>`. Das Muster erkennt beide Formate (`&lt;p>` und `&lt;p&gt;`).

### Integration in `validateScenario`

```js
if (data.content_html && detectEscapedHtmlDocument(data.content_html)) {
  collect(errors, 'content_html',
    'Der Artikelinhalt enthält maskiertes HTML statt formatierter Inhalte. Bitte den Editorinhalt prüfen.');
}
```

Die Prüfung erfolgt **vor** allen anderen JSONB-Validierungen.

---

## Geänderte Dateien (13 Dateien)

### Produktionscode (9)

| Datei | Kurzbeschreibung |
|-------|-----------------|
| `api/_lib/theme-world-validate.js` | `area_label_de`, kanonische Delivery-Werte, `detectEscapedHtmlDocument` |
| `src/lib/courseMetadata.js` | `normalizeDeliveryTypeKey` exportiert |
| `src/lib/themeWorldService.js` | `fetchPublishedThemeWorldAreaLabels()` |
| `src/lib/themeWorldAdapter.js` | Delivery-Normalisierung in 4 Stellen |
| `src/App.jsx` | `parseDeliveryParam()`, Delivery-Normalisierung in 3 URL-Lesepunkten |
| `src/components/BereichLandingPage.jsx` | Delivery-Normalisierung in `buildSearchUrl` |
| `src/components/SzenarioArtikelView.jsx` | Delivery-Normalisierung in `goToSearch` |
| `src/components/SearchPageView.jsx` | TW-Labels-State + erweiterte Fallback-Kette |
| `src/components/admin/AdminThemeWorldForm.jsx` | `area_label_de`-Feld, Delivery-Dropdown-Fix |

### Tests (4 aktualisiert, 1 neu)

| Datei | Änderung |
|-------|---------|
| `tests/phase-8-11.test.js` | **NEU** — 51 neue Tests |
| `tests/theme-world-validation.test.js` | `in_person` → `presence` |
| `tests/theme-world-phase8-6-predefined-searches.test.jsx` | `in_person` → `presence`, Validierungsliste aktualisiert |
| `tests/theme-world-phase5-bridge-adapter.test.js` | `online` → `online_live` (Adapter-Normalisierung) |
| `tests/theme-world-phase8-logic.test.js` | `online` → `online_live` (Adapter-Normalisierung) |

---

## Testergebnisse

```
Test Suites: 40 passed, 40 total
Tests:       1257 passed, 1257 total
Snapshots:   0 total
Time:        ~12s
```

Baseline vor Phase 8.11: **1206 Tests**
Neue Tests: **51** (in `tests/phase-8-11.test.js`)

### Testabdeckung Phase 8.11

| Kategorie | Anzahl Tests |
|-----------|-------------|
| `detectEscapedHtmlDocument` | 11 |
| `validateScenario` Escaped-HTML-Schutz | 4 |
| `validateSearchConfig` mit `area_label_de` | 8 |
| `VALID_DELIVERY_TYPES` kanonische Werte | 2 |
| `normalizeDeliveryTypeKey` | 10 |
| Adapter Delivery-Kanonisierung | 6 |
| Label-Auflösungslogik | 6 |
| `validatePredefinedSearches` kanonische Delivery | 4 |
| **Total** | **51** |

---

## Keine DB-Migrierung erforderlich

`area_label_de` wird als JSON-Key im bestehenden `search_config`-JSONB-Feld gespeichert.
Die Spalte `search_config` existiert bereits in der `theme_worlds`-Tabelle.

---

## Bekannte Einschränkungen / Nächste Schritte

- `getAreaLabelFromDB` in SearchPageView gibt `null` zurück wenn `themeWorldLabels` noch nicht
  geladen wurde (erster Render). Der asynchrone Fallback greift erst nach dem ersten Fetch.
  Da dieser Render-Fall nur einmalig kurz auftritt, ist kein Skeleton/Placeholder nötig.
- Für SSR/SSG wäre `fetchPublishedThemeWorldAreaLabels` als Server-Side-Funktion umzuschreiben
  (aktuell nicht relevant, da SPA ohne SSR).
