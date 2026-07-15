# Phase 5: Sport & Fitness Pilot — Dokumentation

**Branch:** `feature/dynamic-theme-worlds`
**Status:** Implementiert, nicht deployed
**Ziel:** Erster Live-Pilot der dynamischen Themenwelt-Infrastruktur für Sport & Fitness

---

## Übersicht

Phase 5 schliess die Brücke zwischen der in Phase 3/4 aufgebauten Datenbank-/Admin-Infrastruktur und der bestehenden Legacy-Darstellung. Das Ergebnis ist eine vollständige, feature-flag-gesteuerte Datenquellenumschaltung für den Bereich **Sport & Fitness / Berufsausbildung**.

Alle 9 URLs (1 Landingpage + 8 Szenario-Artikel) können wahlweise aus der Legacy-Konfiguration (`bereichLandingConfig.js` / `szenarioContent.js`) oder aus der Supabase-Datenbank bedient werden — ohne Änderung am URL-Schema.

---

## Deliverables

| # | Liefergegenstand | Dateipfad |
|---|-----------------|-----------|
| 1 | WYSIWYG Rich-Text-Editor | `src/components/admin/AdminRichTextEditor.jsx` |
| 2 | Importformat-Schema (Pilot-Daten) | `data/theme-worlds/sport-fitness-berufsausbildung.json` |
| 3 | Bild-Manifest | `data/theme-worlds/sport-fitness-images.json` |
| 4 | Import-Script (validate/dry-run/apply) | `scripts/import-theme-world.mjs` |
| 5 | Bridge-Adapter (DB→Legacy-Format) | `src/lib/themeWorldAdapter.js` (erweitert) |
| 6 | BereichLandingPage mit Feature-Flag | `src/components/BereichLandingPage.jsx` (erweitert) |
| 7 | SzenarioArtikelView mit Feature-Flag | `src/components/SzenarioArtikelView.jsx` (erweitert) |
| 8 | Tests (5 Dateien) | `tests/theme-world-phase5-*.test.js`, `tests/admin-rich-text-editor.test.jsx` |

---

## 1. WYSIWYG Rich-Text-Editor

**Datei:** `src/components/admin/AdminRichTextEditor.jsx`

### Was wurde geändert
Die vorherige Implementierung war ein einfaches HTML-Textarea mit einer Toolbar, die rohe HTML-Tags einfügte. Die neue Implementierung ist ein echter WYSIWYG-Editor auf Basis von `contentEditable`.

### Technische Entscheidungen
- **Keine neuen npm-Abhängigkeiten** — nutzt `document.execCommand()` (deprecated, aber in allen Browsern zuverlässig)
- **API-kompatibel** — `value`/`onChange`-Props bleiben identisch zu vorher
- **Serverseitiges Sanitizing** bleibt obligatorisch (Hinweis in Fusszeile sichtbar)

### Unterstützte Funktionen
| Funktion | Toolbar-Button |
|----------|---------------|
| Absatz (P) | ¶ |
| Überschriften | H2, H3, H4 |
| Fett | B |
| Kursiv | I |
| Aufzählung | Listsymbol |
| Nummerierte Liste | Listensymbol |
| Externer Link | Globe-Icon + Panel |
| Interner Link | Link-Icon + Panel |
| Link entfernen | Unlink (nur aktiv wenn Link selektiert) |
| Rückgängig | Undo2 |
| Wiederholen | Redo2 |

### Link-Panel
- Öffnet sich per Klick auf Globe (extern) oder LinkIcon (intern)
- Eingabe: Link-Text (optional) + URL
- Bei externem Link: `target="_blank" rel="noopener noreferrer"` automatisch
- Bei internem Link: führender `/` wird erzwungen
- Enter = Einfügen, Escape = Schliessen

### Clipboard-Verhalten
Einfügen bereinigt Fremd-HTML automatisch: nur Plaintext, aufgeteilt in `<p>`-Tags.

---

## 2. Importformat & Pilotdaten

**Datei:** `data/theme-worlds/sport-fitness-berufsausbildung.json`

### Schema
```
{
  "schema": "theme-world-import/v1",
  "version": "1.0.0",
  "generated_at": "...",
  "theme_world": { ... },
  "scenarios": [ ... ],        // 8 Einträge
  "faqs": [ ... ],             // 7 Einträge
  "editorial_sections": [ ... ],// 6 Einträge
  "specialties": [ ... ],      // 8 Einträge
  "regions": [ ... ],          // 8 Einträge
  "trust_items": [ ... ]       // 3 Einträge
}
```

### Inhalt der Pilotdaten
- **1 Themenwelt:** `sport_fitness_beruf` → `/bereich/beruflich/sport-fitness-berufsausbildung`
- **8 Szenario-Artikel** mit vollständigem `content_html` (1.000–6.413 Zeichen), je meta_title und meta_description
- **Szenario-Reihenfolge** (identisch mit Legacy):
  1. berufseinstieg
  2. quereinstieg
  3. weiterbildung
  4. diplom-aufstieg
  5. nebenerwerb
  6. selbststaendigkeit
  7. spezialisierung
  8. zertifizierung

### Specialty-Labels (8)
1. Fitness-Trainer-Ausbildung
2. Personal-Trainer-Ausbildung
3. Group-Fitness / Kursleitung
4. Trainingsmethoden & Spezialisierungen
5. Mind-Body (Yoga & Pilates)
6. Ernährung & Coaching
7. Zertifikate & Prüfungsvorbereitung
8. Business & Selbstständigkeit

### Regionen (8)
Zürich, Bern, Basel, Luzern, Aargau, St. Gallen, Ganze Schweiz, Online-live

### Trust Items (3)
Qualitop, QualiCert, Fitness-Guide (SFGV)

---

## 3. Import-Script

**Datei:** `scripts/import-theme-world.mjs`

### Verwendung (nur lokal)

```bash
# Nur Validierung (kein DB-Zugriff)
node scripts/import-theme-world.mjs --validate data/theme-worlds/sport-fitness-berufsausbildung.json

# Dry-Run (zeigt was importiert würde)
node scripts/import-theme-world.mjs --dry-run data/theme-worlds/sport-fitness-berufsausbildung.json

# Anwenden (nur mit lokaler Supabase-Instanz)
node scripts/import-theme-world.mjs --apply data/theme-worlds/sport-fitness-berufsausbildung.json
```

### Sicherheitscheck
Das Script lehnt alle nicht-lokalen Supabase-URLs ab. Erlaubt sind nur:
- `localhost`
- `127.0.0.1`
- `::1`
- `supabase.local`

→ Kein versehentliches Schreiben in Produktion möglich.

### Idempotenz
- Themenwelt: upsert auf `key`
- Szenarien: upsert auf `(theme_world_id, slug)`
- Listen (FAQs, Specialties etc.): atomares Ersetzen (delete + insert)

---

## 4. Bridge-Adapter (DB→Legacy-Format)

**Datei:** `src/lib/themeWorldAdapter.js`

### Neue Funktionen

#### `adaptToLegacyBereichConfig(data)`
Konvertiert rohe DB-Daten (`{ themeWorld, scenarios, faqs, editorialSections, specialties, regions, trustItems }`) in das exakte Format, das `BereichLandingPage.jsx` erwartet.

**Wichtige Konversionen:**

| DB-Format | Legacy-Format |
|-----------|--------------|
| `title_de` | `title: { de }` |
| `scenarios[].label_de` | `scenarios[].label: { de }` |
| `scenarios[].teaser_de` | `scenarios[].text: { de }` |
| `specialties[]` array | `specialtyDescriptions[label] = { de, icon }` |
| `regions[].label_de` | `regionalDiscovery.regions[].label` |
| `faqs[].question_de` | `faqs[].q: { de }` |
| `trust_items[]` | `trustLogos[]` |
| `section_titles.*_heading` | `sectionTitles.*Title: { de }` |

#### `adaptToLegacySzenarioConfig(scenario)`
Konvertiert ein einzelnes DB-Szenario in das Format, das `SzenarioArtikelView.jsx` erwartet.

---

## 5. Feature-Flag-Integration

### Umgebungsvariablen

```env
# Globaler Schalter
VITE_THEME_WORLD_DB_ENABLED=true

# Kommagetrennte Liste der aktiven Pilot-Keys
VITE_THEME_WORLD_PILOT_KEYS=sport_fitness_beruf
```

### Verhalten

| Flag | Pilot-Key | Verhalten |
|------|-----------|-----------|
| `false` | beliebig | Legacy (kein DB-Zugriff) |
| `true` | leer | Legacy (kein DB-Zugriff) |
| `true` | `sport_fitness_beruf` | DB-Versuch, Legacy-Fallback bei Fehler |
| `true` | nur `yoga_achtsamkeit` | Yoga via DB, Sport Legacy |

### Fehlerbehandlung in Komponenten

```
ThemeWorldDbError  → Legacy-Fallback (transparente Degradierung)
ThemeWorldNotFoundError → 404-Behandlung (kein Legacy-Fallback)
```

### BereichLandingPage.jsx
```jsx
// Effektives Config-Objekt:
const config = dynamicConfig || legacyConfig;
// 404 wenn kein Config vorhanden oder DB meldet not-found:
if (!config || dynamicNotFound) { return <NotFoundView />; }
```

### SzenarioArtikelView.jsx
```jsx
// Artikel-Inhalt aus DB oder Legacy:
const articleContent = dynamicArticleContent !== null
  ? dynamicArticleContent
  : legacyArticleContent;
// Navigation "Weitere Szenarien" nutzt immer Legacy-Config:
const otherScenarios = legacyBereichConfig?.scenarios ?? [];
```

---

## 6. Tests

### Neue Testdateien

| Datei | Tests | Beschreibung |
|-------|-------|--------------|
| `tests/theme-world-phase5-import.test.js` | 27 | Importdatei-Schema, Pflichtfelder, Inhalt |
| `tests/theme-world-phase5-bridge-adapter.test.js` | 28 | Adapter-Konversionen (alle Felder) |
| `tests/theme-world-phase5-parity.test.js` | 17 | Paritätsvergleich Legacy ↔ Import-Daten |
| `tests/theme-world-phase5-feature-flag.test.js` | 19 | Feature-Flag-Verhalten, loadThemeWorldWithFallback |
| `tests/admin-rich-text-editor.test.jsx` | 27 | WYSIWYG-Editor Rendering, Toolbar, Barrierefreiheit |

**Gesamte neue Tests:** 118

---

## 7. Pilot-Aktivierung (Checkliste für spätere Aktivierung)

> **ACHTUNG:** Folgende Schritte dürfen nur nach expliziter Freigabe durch das Team durchgeführt werden.

- [ ] Lokale Supabase-Instanz starten
- [ ] Import-Script ausführen: `node scripts/import-theme-world.mjs --apply data/theme-worlds/sport-fitness-berufsausbildung.json`
- [ ] Import verifizieren mit `--dry-run`
- [ ] `.env.local` setzen:
  ```
  VITE_THEME_WORLD_DB_ENABLED=true
  VITE_THEME_WORLD_PILOT_KEYS=sport_fitness_beruf
  ```
- [ ] Alle 9 Sport-URLs manuell prüfen
- [ ] Parity-Test der gerenderten Seiten mit Legacy-Versionen
- [ ] Für Produktion: Supabase Migration ausführen (Phase 3 Migrations)
- [ ] Für Produktion: Vercel Environment Variables setzen

---

## 8. Nicht geändert in Phase 5

- `src/lib/bereichLandingConfig.js` — Legacy-Konfiguration unverändert
- `src/lib/szenarioContent.js` — Legacy-Artikelinhalte unverändert
- Sitemap, Prerender-Konfiguration
- Yoga & Achtsamkeit Bereich
- Bestehende Phase 1-4 Dateien
- Keine Remote-Datenbankoperationen
- Kein Push, kein PR

---

## 9. Bekannte Einschränkungen

- `document.execCommand()` ist offiziell deprecated (aber in allen Browsern implementiert und ohne Alternative für WYSIWYG ohne externe Library)
- Die Paritätsprüfung ist datenbasiert (Schlüssel, Labels, Slugs), aber nicht pixel-perfekt visuell
- DB-Daten werden erst nach dem ersten Render geladen (kein SSR) — kurzes Legacy-Flash möglich beim Pilot
- `otherScenarios` in `SzenarioArtikelView` nutzt immer Legacy-Config für die Seitennavigation (vereinfachung, DB-Vollausbau in Phase 6)
