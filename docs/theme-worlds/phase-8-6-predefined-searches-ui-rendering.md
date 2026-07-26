# Phase 8.6 — Vordefinierte Suchen: Admin-Editor und öffentliche Darstellung

**Datum:** 2026-07-26
**Branch:** `feature/dynamic-theme-worlds`
**Commit:** nach bcb6e8e

---

## 1. Analysebefund

### Vorhandene Komponenten (bereits vollständig implementiert)

| Komponente | Status |
|-----------|--------|
| DB-Spalte `theme_worlds.predefined_searches` (JSONB) | ✅ vorhanden |
| API-Allowlist (`ALLOWED_WRITE_FIELDS`) | ✅ vorhanden |
| Server-seitiger Validator (`validatePredefinedSearches`) | ✅ vorhanden |
| Import-Daten (Sport: 10 Einträge, Yoga: 10 Einträge) | ✅ vorhanden |
| Adapter (`adaptToLegacyBereichConfig`) | ✅ vorhanden |

### Fehlende Komponenten (in Phase 8.6 implementiert)

| Komponente | Status |
|-----------|--------|
| Admin-Editor im Tab „Suche" | ✅ neu implementiert |
| Öffentliche Darstellung in `BereichLandingPage` | ✅ neu implementiert |

---

## 2. Bisherige Inkonsistenz

Die `predefined_searches`-Einträge waren in der Datenbank speicherbar und wurden durch den Adapter korrekt in das Legacy-Format umgewandelt. Die öffentliche Landingpage ignorierte `config.predefinedSearches` jedoch vollständig — keine Sektion, keine Links.

Im Admin-Formular fehlte jegliche UI für `predefined_searches`. Einträge konnten nur über den JSON-Import-Script gesetzt werden.

---

## 3. Datenmodell

### DB-Format (`theme_worlds.predefined_searches`)

```json
[
  {
    "label_de": "Fitnesstrainer Basiskurs",
    "spec": "Fitness-Trainer-Ausbildung",
    "focus": "Basis-Ausbildung",
    "loc": "Zürich",
    "delivery": "in_person"
  }
]
```

Erlaubte Keys: `label_de` (Pflicht, max 80 Zeichen), `spec`, `focus`, `loc`, `delivery`
Erlaubte `delivery`-Werte: `online_live`, `self_study`, `in_person`
Maximum: 20 Einträge

### Legacy-Component-Format (nach Adapter)

```js
{
  label: { de: 'Fitnesstrainer Basiskurs' },
  params: { spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' },
  extraParams: { loc: 'Zürich', delivery: 'in_person' }
}
```

---

## 4. Admin-Editor

### Ort

Tab „Suche" in `AdminThemeWorldForm.jsx`, unterhalb der bestehenden Felder `area_slug`, `default_spec`, `default_focus`.

### Editierbare Felder pro Eintrag

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `label_de` | Text (max 80 Zeichen) | Ja | Sichtbarer Linktext |
| `spec` | Text | Nein | Taxonomie-Spezialgebiet |
| `focus` | Text | Nein | Taxonomie-Fokus |
| `loc` | Text | Nein | Standort-Filter |
| `delivery` | Select | Nein | Kursformat (Online Live / Selbststudium / Vor Ort) |

### Aktionen

- **Hinzufügen**: „+ Vordefinierte Suche hinzufügen" (disabled wenn 20 Einträge erreicht)
- **Entfernen**: „Entfernen"-Button pro Eintrag
- **Reihenfolge**: Entspricht der Array-Reihenfolge (Position #1, #2, … in der oberen rechten Ecke sichtbar)

### Maximale Einträge

20 Einträge. Bei Erreichen des Limits wird der Hinzufügen-Button deaktiviert und zeigt „Maximum erreicht (20)".

### Kein Dirty-State nach Laden

Nach erfolgreichem Laden werden alle Save-States zurückgesetzt (`sucheSave.resetDirty()`).

---

## 5. Validierung

### Client-seitig (vor API-Aufruf)

- Max. 20 Einträge: Fehler + `showNotification`
- `label_de` leer: Fehler mit Eintragsnummer (#1, #2 …)
- Fehlermeldung erscheint im Tab-Header und als Notification

### Server-seitig (`validatePredefinedSearches`)

- Max. 20 Einträge
- `label_de` Pflichtfeld, max 80 Zeichen
- `delivery` muss `online_live | self_study | in_person` sein
- Unbekannte Keys werden abgelehnt

### Normalisierung beim Speichern

Leere optionale Felder (`""`, `null`) werden aus dem Save-Payload entfernt:

```js
const normalizedSearches = predefinedSearches.map((s) => ({
  label_de: (s.label_de || '').trim(),
  ...(s.spec && s.spec.trim() ? { spec: s.spec.trim() } : {}),
  ...(s.focus && s.focus.trim() ? { focus: s.focus.trim() } : {}),
  ...(s.loc && s.loc.trim() ? { loc: s.loc.trim() } : {}),
  ...(s.delivery ? { delivery: s.delivery } : {}),
}));
```

Dadurch entstehen keine leeren Datensätze nach Reload.

---

## 6. Save- und Reload-Verhalten

### Save-Payload (Tab „Suche")

```js
{
  area_slug: suche.area_slug,
  search_config: {
    area_slug: suche.area_slug,
    type_key?,
    default_spec?,
    default_focus?,
  },
  predefined_searches: normalizedSearches,
}
```

`cta_links` wird im Suche-Tab nicht verändert.

### Laden

In `loadAll()` werden `data.predefined_searches || []` in den State `predefinedSearches` geladen. Der State ist sauber von `suche` State getrennt.

### Tab-Wechsel

`predefinedSearches` State bleibt beim Tab-Wechsel erhalten (React-State bleibt bis Unmount bestehen).

### Create → Edit Workflow

Beim Erstellen einer neuen Themenwelt ist `predefinedSearches` initial `[]`. Erst nach dem Speichern der Grundlagen kann die Suche-Tab gespeichert werden.

---

## 7. Öffentliche Darstellung

### Ort

`BereichLandingPage.jsx` — nach der Kursarten-Sektion, vor der Ausbildungsbereiche-Sektion.

### Bedingung

Die Sektion erscheint nur, wenn mindestens ein Eintrag mit gültigem `label.de` vorhanden ist:

```jsx
{config.predefinedSearches && config.predefinedSearches.filter(s => s.label?.de).length > 0 && (
  // Sektion
)}
```

### Design

- Überschrift: `sectionTitles.searchesTitle?.de` oder Fallback `'Schnelleinstieg'`
- Untertitel: `sectionTitles.searchesSubtitle?.de` (optional)
- Links: `inline-flex`, `rounded-full`, responsives `flex-wrap gap-3 justify-center`
- Jeder Link zeigt `search.label[lang] || search.label.de` als Linktext
- Tastaturbedienung: native `<a>`-Element mit `href`

### URL-Erzeugung

Verwendet die bestehende `buildSearchUrl()` Hilfsfunktion:

```js
const allParams = { ...search.params, ...(search.extraParams || {}) };
const url = buildSearchUrl(allParams);
// → /search?type=beruflich&area=sport_fitness&spec=...&focus=...&loc=...&delivery=...
```

---

## 8. URL-Parameter

| Parameter | Quelle | Query-String |
|-----------|--------|-------------|
| `type` | `config.typeKey` | immer gesetzt |
| `area` | `config.areaSlug` | immer gesetzt |
| `spec` | `search.params.spec` | optional |
| `focus` | `search.params.focus` | optional |
| `loc` | `search.extraParams.loc` | optional |
| `delivery` | `search.extraParams.delivery` | optional |

Nur Werte mit truthy Wert werden gesetzt. Leere Parameter erzeugen keine Query-String-Einträge.

---

## 9. Sport- und Yoga-Regression

### Erwartetes Verhalten (keine Änderung)

| Prüfung | Ergebnis |
|---------|----------|
| Sport predefined_searches werden geladen | ✅ |
| Admin zeigt alle Sport-Einträge (10 in Importdaten) | ✅ |
| Keine Datenänderung durch reines Laden | ✅ |
| Öffentliche Seite rendert Sport-Suchlinks | ✅ |
| Yoga predefined_searches werden geladen | ✅ |
| Admin zeigt alle Yoga-Einträge (10 in Importdaten) | ✅ |
| Keine Datenänderung durch reines Laden | ✅ |
| Öffentliche Seite rendert Yoga-Suchlinks | ✅ |

Keine Staging-Daten von Sport oder Yoga wurden gespeichert.

---

## 10. Tests

### Testdatei

`tests/theme-world-phase8-6-predefined-searches.test.jsx`

### Admin-Tests (16)

- Sport-Daten werden korrekt geladen
- Yoga-Daten werden korrekt geladen
- `null` → leeres Array (kein Fehler)
- Kein Dirty-State nach erfolgreichem Laden
- Tabwechsel verliert keine predefined_searches
- Neuer Eintrag kann hinzugefügt werden
- `label_de` kann editiert werden
- Optionale Parameter können editiert werden
- Eintrag kann entfernt werden
- Reihenfolge bleibt durch Array-Index erhalten
- Max. 20 Einträge: Add-Button wird disabled
- 21. Eintrag: Add-Button bleibt disabled
- Fehlendes `label_de` wird abgelehnt
- Save-Payload enthält `predefined_searches`, `area_slug`, `search_config`
- Leere optionale Felder werden normalisiert
- Reload-Logik: `data.predefined_searches` wird gelesen

### Öffentliche Seite (15)

- Sektion erscheint bei Einträgen
- Sektion fehlt bei leerem Array
- Sektion fehlt bei `undefined`/`null`
- Sichtbarer Linktext verwendet `label_de`
- `spec` wird in URL übernommen
- `focus` wird übernommen
- `loc` wird übernommen
- `delivery` wird übernommen
- `area_slug` wird berücksichtigt
- Leere/null-Einträge werden nicht gerendert
- `cta_links` bleiben unverändert
- Keyboard-Zugänglichkeit (native `<a>`)
- Responsive Darstellung (`flex-wrap`)
- Keine hardcodierten Theme-Keys
- Standard-Überschrift „Schnelleinstieg"
- Konfigurierbarer `searchesTitle`

### Adapter-Tests (7)

- Korrekte Adapter-Ausgabe
- `null` → leeres Array
- Leere optionale Felder nicht in `params`/`extraParams`
- Reihenfolge erhalten
- Sport: 4 Einträge vollständig adaptiert
- Yoga: 4 Einträge vollständig adaptiert
- `searchesTitle` aus `section_titles.searches_heading` gemappt

### Validator-Tests (13)

- `null`/`undefined` → keine Fehler (optional)
- Leeres Array → keine Fehler
- Gültiger Eintrag → keine Fehler
- Max. 20 erlaubt
- 21 → Fehler
- Fehlendes `label_de` → Fehler
- Zu langes `label_de` (>80) → Fehler
- Ungültiger `delivery`-Wert → Fehler
- Gültige `delivery`-Werte → kein Fehler
- Unbekannter Key → Fehler
- Reihenfolge unveränderlich durch Validator
- Kein Array → Fehler

### Gesamtzahl

**52 neue Tests**, alle bestanden.
Gesamtsuite: **1134 Tests** (vorher 1082).

---

## 11. Verbleibende Risiken

### area_slug Create-Fallback

Bei einer neuen Themenwelt wird `area_slug` initial auf `grundlagen.key` gesetzt (Zeile 260 in `saveGrundlagen`). Dieser Fallback-Wert ist ein temporärer Draft-Wert und entspricht nicht dem finalen taxonomy_level2-Slug.

**Warum dieser Fallback**: Beim Erstellen muss `area_slug` einen Wert haben (NOT NULL in DB). Vor dem Speichern der Suche-Tab wird der korrekte Wert im Suche-Tab eingetragen.

**Publish-Gate**: Der Publish-Endpoint validiert `search_config.area_slug` als Pflichtfeld. Eine Themenwelt mit falschem `area_slug` kann nicht publiziert werden, ohne dass der Wert korrekt gesetzt wurde.

**Kein Sonderfall** für `test_kreativ_gestalten`: Der Draft-Wert `test_kreativ_gestalten` als `area_slug` wird später im Browser manuell auf `kreativ_gestalten` korrigiert.

### Delivery-Wert in Sport-Import

In `sport-fitness-berufsausbildung.json` hat ein Eintrag `"delivery": "online_live,self_study"` (kommagetrennt). Dies ist kein gültiger Wert für den Validator (erlaubt sind nur Einzelwerte). Der Eintrag wurde per SQL-Import direkt in die DB geschrieben (umgeht die API-Validierung).

Im Admin-Editor kann dieser Wert nicht direkt editiert werden (Select zeigt keinen passenden Wert). Bei Speichern über den Admin würde der ungültige Wert bereinigt (leer → delivery-Key entfernt).

---

## 12. Entscheidung zur Phase-8B.2-Browserprüfung

**Phase 8.6 technisch bestanden.**

### Bestätigungen

- ✅ Keine Sport-Daten verändert
- ✅ Keine Yoga-Daten verändert
- ✅ Test-Themenwelt weiterhin Draft (kein zweiter Test-Draft erstellt)
- ✅ Keine Admin-Daten während der Implementierung verändert
- ✅ Kein Merge, kein neuer PR, PR #89 nicht gemergt
- ✅ Kein Production-Deploy
- ✅ Keine Produktionsdaten verändert
- ✅ Phase 8C und Phase 9 nicht begonnen
- ✅ ESLint: keine Fehler
- ✅ Build: erfolgreich
- ✅ Tests: 1134/1134 bestanden (52 neue)
- ✅ Kein unhandled error

**Phase 8B.2 darf erneut im Browser geprüft werden:**

1. Im Browser: Test-Themenwelt im Admin öffnen → Tab „Suche" → zwei vordefinierte Suchen anlegen → Speichern
2. Prüfen: Reload lädt die zwei Einträge korrekt
3. Öffentliche Seite aufrufen: Schnelleinstieg-Sektion erscheint mit zwei Suchlinks
4. Suchlinks klicken: Suchseite öffnet sich mit korrekten Parametern
