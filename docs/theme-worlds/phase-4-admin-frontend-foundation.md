# Phase 4 — Admin-UI und Frontend-Datenzugriff-Fundament

**Status:** Implementiert (Branch `feature/dynamic-theme-worlds`)
**Datum:** 2026-07-14
**Voraussetzung:** Phase 3 (Datenbank, API, Sicherheitsfundament)

---

## Übersicht

Phase 4 ergänzt die Phase-3-Infrastruktur um:

1. **Sicherheitskorrektur Phase 3** — HTML-Sanitizer, RLS-Policies
2. **Admin-Navigation** — Integration ins bestehende AdminPanel
3. **Admin-API-Client** — Authentifizierter HTTP-Client (kein direkter Supabase-Zugriff)
4. **Admin-UI-Komponenten** — Themenwelten-Liste, 9-Tab-Formular, Szenario-Verwaltung
5. **Sicherer Bild-Upload** — Signierte URLs, kein direkter Storage-Schlüssel im Client
6. **Frontend-Datendienst** — Öffentlicher Service für anonyme Nutzer
7. **Datenadapter** — Konvertierung DB-Format → Legacy-Komponentenformat
8. **Feature-Flag** — Pilot-gesteuerte Aktivierung mit Legacy-Fallback
9. **Tests** — Sanitizer, Adapter, API-Client, Feature-Flag

**Wichtig:** In Phase 4 ist die neue Datenquelle nicht öffentlich aktiv. Alle Env-Flags (`VITE_THEME_WORLD_DB_ENABLED`, `VITE_THEME_WORLD_PILOT_KEYS`) sind ungesetzt → immer Legacy-Fallback.

---

## 1. Sicherheitskorrekturen Phase 3

### A. HTML-Sanitizer (api/_lib/theme-world-sanitize.js)

**Problem:** Die Phase-3-Implementierung verwendete Regex-basiertes Sanitizing, das bekannte Bypässe hat (z.B. CDATA, Nested-Attribute, Encoding-Varianten).

**Lösung:** Vollständiger Ersatz durch `sanitize-html` v2.17.6 (htmlparser2-basiert, 8 Mio. Weekly Downloads, MIT-Lizenz, kein DOM erforderlich → funktioniert in Vercel Serverless).

**Import-Konflikt behoben:** Die Library wird als `sanitizeHtmlLib` importiert, da der Modul-Export dieselbe Bezeichnung `sanitizeHtml` verwendet.

**Erlaubte Tags (Allowlist):**
- Strukturell: `h2`–`h4`, `p`, `div`, `ul`, `ol`, `li`, `blockquote`, `figure`, `hr`, `br`
- Tabellen: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Inline: `strong`, `em`, `code`, `pre`, `a`, `img`, `span`

**Erlaubte Protokolle:**
- Links: `https`, `http`, `mailto`
- Bilder: nur `https`

**Automatische Transformationen:**
- Externe Links (nicht `/`-prefixed) erhalten `target="_blank" rel="noopener noreferrer"`
- Interne Links (`/`-prefixed) erhalten kein `target`/`rel`

**Exports:**
```js
sanitizeHtml(html)           // Bereinigt HTML
containsDangerousHtml(html)  // Boolean: true wenn Input ≠ sanitiertes Output
getSanitizerOptions()        // Gibt Konfig-Objekt zurück (für Tests/Audit)
```

### B. RLS-Policies Sub-Tabellen

**Problem:** Die Phase-3-Policies für Sub-Tabellen prüften nur ob die übergeordnete Themenwelt publiziert ist, nicht ob der Einzelsatz selbst aktiv ist:

```sql
-- Unvollständig (Phase 3):
using (
  theme_world_id in (select id from theme_worlds where status = 'published')
)
```

**Korrektur:** `is_active = true` wurde in allen 5 Sub-Tabellen-Policies ergänzt:

```sql
-- Korrekt (Phase 4):
using (
  is_active = true
  and theme_world_id in (
    select id from public.theme_worlds where status = 'published'
  )
)
```

Betrifft: `theme_world_faqs`, `theme_world_editorial_sections`, `theme_world_specialties`, `theme_world_regions`, `theme_world_trust_items`.

**Hinweis:** Diese Korrektur ist in der Migrationsdatei `supabase/migrations/20260714_create_theme_worlds.sql` eingebunden. Die Migration wurde noch nicht remote ausgeführt (kein Remote-Zugriff in Phase 4).

---

## 2. Dateiübersicht

### Neue Quelldateien

| Datei | Zweck |
|-------|-------|
| `src/lib/themeWorldAdminApi.js` | Admin-API-Client mit Bearer-Token-Auth |
| `src/lib/themeWorldService.js` | Öffentlicher Frontend-Datendienst |
| `src/lib/themeWorldAdapter.js` | Datenadapter DB → Legacy-Format |
| `src/lib/themeWorldFeatureFlag.js` | Feature-Flag + Legacy-Fallback |
| `api/admin-theme-world-image.js` | Signed-URL-Endpunkt für Bild-Upload |

### Admin-UI-Komponenten

| Datei | Zweck |
|-------|-------|
| `src/components/admin/AdminStatusBadge.jsx` | Status-Badge (draft/published/archived) |
| `src/components/admin/AdminSaveState.jsx` | Speicher-Zustandsanzeige (idle/saving/saved/error) |
| `src/components/admin/AdminSeoFields.jsx` | SEO-Felder mit Zeichenzähler |
| `src/components/admin/AdminImageField.jsx` | Bild-Upload mit SignedURL-Flow |
| `src/components/admin/AdminRichTextEditor.jsx` | HTML-Textarea mit Toolbar |
| `src/components/admin/AdminThemeWorldList.jsx` | Themenwelten-Übersicht |
| `src/components/admin/AdminThemeWorldForm.jsx` | 9-Tab-Formular (Themenwelt) |
| `src/components/admin/AdminScenarioList.jsx` | Szenario-Liste pro Themenwelt |
| `src/components/admin/AdminScenarioForm.jsx` | Szenario-Editor |

### Modifizierte Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/AdminPanel.jsx` | Navigations-Button „Themenwelten" |
| `src/App.jsx` | Lazy-Imports + State + View-Render für 4 Admin-Views |
| `api/_lib/theme-world-sanitize.js` | Komplett neu: parser-basierter Sanitizer |
| `supabase/migrations/20260714_create_theme_worlds.sql` | RLS-Korrektur Sub-Tabellen |

### Testdateien

| Datei | Prüft |
|-------|-------|
| `tests/theme-world-sanitize-v2.test.js` | XSS-Vektoren, Allowlist, Protokolle |
| `tests/theme-world-adapter.test.js` | DB→Legacy-Transformation, Segmentnormalisierung |
| `tests/theme-world-admin-api-client.test.js` | Auth, Fehler-Handling, Secrets |
| `tests/theme-world-feature-flag.test.js` | Flag-Logik, Fallback, Not-found vs DB-Fehler |

---

## 3. Admin-API-Client (themeWorldAdminApi.js)

### Designprinzipien

- **Kein direkter Supabase-Zugriff** aus Admin-Komponenten — alle Writes gehen über API-Endpunkte
- **Bearer-Token-Auth** aus der Supabase-Session (`supabase.auth.getSession()`)
- **Kein Service-Role-Key im Client** — dieser bleibt ausschliesslich serverseitig
- **Timeout** per `AbortController` (Standard: 15 Sekunden)

### ApiError-Klasse

```js
class ApiError extends Error {
  constructor(message, status, details = null, reason = null)
  get isUnauthorized()  // status === 401
  get isForbidden()     // status === 403
  get isConflict()      // status === 409
  get isUnprocessable() // status === 422
  get isServerError()   // status >= 500
  get isTimeout()       // reason === 'timeout'
  get isNetworkError()  // reason === 'network_error'
}
```

### Exportierte Funktionen

**Themenwelten:**
```js
listThemeWorlds()
getThemeWorld(id)
createThemeWorld(data)
updateThemeWorld(id, data)
archiveThemeWorld(id)
publishThemeWorld(id)
unpublishThemeWorld(id)
getAllSubEntities(id)
replaceFaqs(id, faqs)
replaceEditorialSections(id, sections)
replaceSpecialties(id, specialties)
replaceRegions(id, regions)
replaceTrustItems(id, items)
```

**Szenarioartikel:**
```js
listScenarios(themeWorldId)
getScenario(id)
createScenario(themeWorldId, data)
updateScenario(id, data)
archiveScenario(id)
publishScenario(id)
reorderScenarios(themeWorldId, order)
```

**Bild-Upload:**
```js
requestImageUploadUrl({ mimeType, fileSize, folder })
uploadImageToSignedUrl(signedUrl, file, onProgress?)
uploadThemeWorldImage(file, folder, onProgress?)
```

**Fehlerbehandlung:**
```js
getErrorMessage(error, defaultMessage?)  // Gibt benutzerfreundliche Meldung zurück
```

---

## 4. Sicherer Bild-Upload (api/admin-theme-world-image.js)

### Flow

```
Admin-Browser                     Server (Vercel)              Supabase Storage
     │                                  │                            │
     │ GET /api/admin-theme-world-image  │                            │
     │   ?action=sign                   │                            │
     │   &mimeType=image/jpeg           │                            │
     │   &fileSize=1234567              │                            │
     │   &folder=theme-worlds           │                            │
     │ Authorization: Bearer <token>    │                            │
     │ ─────────────────────────────►  │                            │
     │                                  │ Admin-Auth prüfen          │
     │                                  │ MIME-Typ validieren        │
     │                                  │ Dateigrösse validieren     │
     │                                  │ Ordner-Allowlist prüfen    │
     │                                  │ UUID-Dateiname generieren  │
     │                                  │ createSignedUploadUrl()   │
     │                                  │ ──────────────────────── ►│
     │                                  │ ◄─── signedUrl + path ────│
     │ ◄── { signedUrl, publicUrl } ───│                            │
     │                                  │                            │
     │ PUT <signedUrl>                   │                            │
     │ (direkt, ohne Server-Umweg)       │                            │
     │ ──────────────────────────────────────────────────────────── ►│
     │ ◄───────────────────────────── 200 OK ─────────────────────── │
```

### Validierungen (serverseitig)

- **MIME-Typ:** Nur `image/jpeg`, `image/png`, `image/webp` erlaubt
- **Dateigrösse:** Max 5 MB
- **Ordner:** Nur `theme-worlds` und `theme-world-scenarios` erlaubt
- **Dateiname:** Server generiert UUID-basierten Namen — kein Client-kontrollierter Pfad
- **Keine Secrets in der Response:** `signedUrl`, `storagePath`, `publicUrl` — kein Service-Role-Key

---

## 5. Öffentlicher Frontend-Datendienst (themeWorldService.js)

### Fehlerklassen

```js
ThemeWorldNotFoundError   // Seite existiert wirklich nicht (kein Legacy-Fallback)
ThemeWorldDbError         // Technisches DB-Problem (Legacy-Fallback greift)
```

**Wichtig:** PostgREST-Fehlercode `PGRST116` (kein Ergebnis) wird als `ThemeWorldNotFoundError` geworfen. Alle anderen DB-Fehler werden als `ThemeWorldDbError` geworfen.

### Exportierte Funktionen

```js
fetchThemeWorld(urlSegment, slug)          // Lädt eine Themenwelt
fetchPublishedScenarios(themeWorldId)      // Lädt alle publizierten Szenarien
fetchPublishedScenario(themeWorldId, slug) // Lädt ein einzelnes Szenario
fetchFaqs(themeWorldId)
fetchEditorialSections(themeWorldId)
fetchSpecialties(themeWorldId)
fetchRegions(themeWorldId)
fetchTrustItems(themeWorldId)
fetchThemeWorldPage(urlSegment, slug)      // Parallel-Load aller Daten
```

### Regeln

- Nur publizierte Inhalte (RLS-enforced)
- Anon-Client — keine Admin-Privilegien
- Keine Preloads beim App-Start
- In Phase 4 nicht aktiv eingebunden (nur getestet)

---

## 6. Datenadapter (themeWorldAdapter.js)

### Zweck

Konvertiert DB-Datenformat (Phase 3 Schema) in das Format, das `BereichLandingPage.jsx` und `SzenarioArtikelView.jsx` erwarten (Legacy-Format aus `bereichLandingConfig.js`).

### Segmentnormalisierung

| URL-Segment (Bindestrich) | DB-Segment | TypeKey (Unterstrich) |
|--------------------------|------------|----------------------|
| `beruflich` | `professionell` | `beruflich` |
| `privat-hobby` | `privat` | `privat_hobby` |
| `kinder-jugend` | `kinder` | `kinder_jugend` |

### Hauptfunktion

```js
adaptThemeWorldToConfig({
  themeWorld,
  scenarios,
  faqs,
  editorialSections,
  specialties,
  regions,
  trustItems,
})
// → Legacy-Config-Objekt im Format von bereichLandingConfig.js
```

### Hilfsfunktionen

```js
normalizeUrlSegment(segment)      // Bindestriche + Lowercase
urlSegmentToTypeKey(urlSegment)   // 'privat-hobby' → 'privat_hobby'
dbSegmentToUrlSegment(dbSeg)      // 'professionell' → 'beruflich'
urlSegmentToDbSegment(urlSeg)     // 'beruflich' → 'professionell'
adaptScenarioCard(scenario)       // DB-Szenario → Karten-Format
adaptScenarioArticle(scenario)    // DB-Szenario → Artikel-Format
```

---

## 7. Feature-Flag-System (themeWorldFeatureFlag.js)

### Env-Variablen

| Variable | Typ | Default | Zweck |
|----------|-----|---------|-------|
| `VITE_THEME_WORLD_DB_ENABLED` | `'true'` / `'false'` | ungesetzt | Globaler Schalter |
| `VITE_THEME_WORLD_PILOT_KEYS` | Kommaliste | ungesetzt | Aktivierte Keys |

**In Phase 4:** Beide ungesetzt → immer Legacy-Fallback.

### Fallback-Logik

```
isThemeWorldPilotActive(key)?
├── Nein → Legacy-Config (kein DB-Aufruf)
└── Ja → dbLoader()
    ├── Erfolg → DB-Daten (source: 'db')
    ├── ThemeWorldNotFoundError → notFound=true, KEIN Fallback
    ├── ThemeWorldDbError → Legacy-Fallback (source: 'legacy', error gesetzt)
    └── Unbekannter Fehler → Legacy-Fallback (source: 'legacy', error gesetzt)
```

### Verwendung

```js
const { data, source, notFound, error } = await loadThemeWorldWithFallback({
  themeWorldKey: 'sport_fitness_beruf',
  dbLoader: () => fetchThemeWorldPage('beruflich', 'sport-fitness-berufsausbildung'),
  legacyLoader: () => getBereichConfig('sport_fitness_beruf'),
});
```

---

## 8. Admin-UI (4 Views)

### Routing

| View | Komponente | Trigger |
|------|------------|---------|
| `admin-theme-worlds` | `AdminThemeWorldList` | „Themenwelten"-Button in AdminPanel |
| `admin-theme-world-form` | `AdminThemeWorldForm` | Neu/Bearbeiten in Liste |
| `admin-scenario-list` | `AdminScenarioList` | Tab in Formular / Button in Liste |
| `admin-scenario-form` | `AdminScenarioForm` | Neu/Bearbeiten in Szenario-Liste |

### AdminThemeWorldForm — 9 Tabs

| # | Tab | Inhalt |
|---|-----|--------|
| 1 | Grundlagen | Titel, Key, URL-Segment, Slug, Subtitle, Intro, Sortierung |
| 2 | Bilder & SEO | Hero-Bild, OG-Bild, Meta-Title, Meta-Description |
| 3 | Suche | area_slug, type_key, default_spec, Lieferart, Standort |
| 4 | Kursbereiche | Spezialgebiete (Batch-Replace) |
| 5 | Regionen | Regionen mit Kanton-Mapping (Batch-Replace) |
| 6 | Redaktionell | Editorial Sections (Batch-Replace) |
| 7 | FAQs | FAQ-Liste (Batch-Replace) |
| 8 | Trust | Trust-Items / Qualitätssignale (Batch-Replace) |
| 9 | Szenarioartikel | Navigiert zu AdminScenarioList |

**Tab-spezifisches Speichern:** Jeder Tab speichert unabhängig mit eigenem `useSaveState()`.

### Slug-Schutz

- Bei publizierten Themenwelten ist der Slug gesperrt (Eingabefeld deaktiviert)
- Bei Speicher-Versuch wird der bestehende Slug serverseitig aus DB gelesen
- UI zeigt „Slug gesperrt"-Badge im Header

### Publish-Gate (UI-seitig)

Vor dem Publizieren zeigt die Liste eine Warnung wenn die Themenwelt bereits publiziert ist und der Admin archivieren will (nicht reversibler Verlust der URL-Struktur).

---

## 9. Rich-Text-Editor (AdminRichTextEditor.jsx)

Einfacher HTML-Textarea mit Toolbar. Kein externer WYSIWYG-Editor — HTML-Eingabe, serverseitig sanitiert.

**Toolbar-Buttons:**
- H2, H3, H4
- **Bold** (`<strong>`), *Em* (`<em>`)
- Liste (`<ul>`)
- Absatz (`<p>`)
- Externer Link (öffnet Dialog: URL + Label)
- Interner Link (öffnet Dialog: Pfad + Label)

---

## 10. Bild-Upload-Komponente (AdminImageField.jsx)

- Client-seitige Validierung: MIME-Typ + Dateigrösse (vor Upload)
- Fortschrittsbalken via XHR `progress`-Event
- Alt-Text-Feld (Pflicht wenn Bild vorhanden, konfigurierbar)
- Vorschau des aktuellen Bildes
- Löschen-Option (setzt URL auf null)

---

## 11. SEO-Felder (AdminSeoFields.jsx)

- Meta-Title: max 60 Zeichen, Live-Counter mit Ampel-Farbe
- Meta-Description: max 155 Zeichen, Live-Counter mit Ampel-Farbe
- Hinweis auf empfohlene Längen

---

## 12. Keine öffentliche Aktivierung

In Phase 4 sind folgende Punkte bewusst NICHT aktiv:

- `VITE_THEME_WORLD_DB_ENABLED` ist nicht gesetzt → immer Legacy-Fallback
- `VITE_THEME_WORLD_PILOT_KEYS` ist nicht gesetzt → kein Key aktiviert
- `BereichLandingPage.jsx` und `SzenarioArtikelView.jsx` sind unverändert
- Keine Änderungen an App.jsx-Routing für öffentliche Seiten
- Kein Deployment der neuen Migration auf Remote-DB

Die Aktivierung erfolgt in Phase 5 (Pilot-Rollout).

---

## 13. Tests

### Abdeckung

| Testdatei | Tests | Prüft |
|-----------|-------|-------|
| `theme-world-sanitize-v2.test.js` | 50+ | XSS-Vektoren, Allowlist, Protokolle, Event-Handler |
| `theme-world-adapter.test.js` | 30+ | DB→Legacy-Transformation, beide Fixtures, null-Inputs |
| `theme-world-admin-api-client.test.js` | 40+ | Auth, 401/403/409/422/500, Timeout, Netzwerkfehler, Secrets |
| `theme-world-feature-flag.test.js` | 35+ | Flag-Logik, alle Fallback-Pfade, Error-Unterscheidung |

### Ausführung

```bash
npx vitest run tests/theme-world-sanitize-v2.test.js
npx vitest run tests/theme-world-adapter.test.js
npx vitest run tests/theme-world-admin-api-client.test.js
npx vitest run tests/theme-world-feature-flag.test.js
```

Alle Tests zusammen:
```bash
npx vitest run --reporter=verbose
```

---

## 14. Abhängigkeiten

### Neu installiert

| Paket | Version | Zweck |
|-------|---------|-------|
| `sanitize-html` | `^2.17.6` | Parser-basierter HTML-Sanitizer (Serverseite) |

---

## 15. Migrations-Status

Die Migrations-Korrektur (RLS `is_active = true`) ist in
`supabase/migrations/20260714_create_theme_worlds.sql` eingearbeitet.

**Für Production-Deployment:** Diese Datei muss in Supabase Studio → SQL Editor ausgeführt werden (oder via `supabase db push`). Dies erfolgt in Phase 5.

---

## 16. Nächste Schritte (Phase 5 — Pilot-Rollout)

1. Remote-Migration ausführen (`supabase db push` oder manuell via SQL Editor)
2. Erste Themenwelt über Admin-UI erstellen und publizieren
3. Env-Variablen in Vercel setzen:
   - `VITE_THEME_WORLD_DB_ENABLED=true`
   - `VITE_THEME_WORLD_PILOT_KEYS=sport_fitness_beruf` (oder der jeweilige Key)
4. `BereichLandingPage.jsx` um `loadThemeWorldWithFallback` erweitern
5. Deploy und Monitoring des Pilot-Keys

---

## 17. Bekannte Limitierungen

- **AdminRichTextEditor:** Kein WYSIWYG, nur HTML-Textarea mit Toolbar-Snippets. Ausreichend für Redakteure mit HTML-Grundkenntnissen.
- **Kein Restore nach Archivierung:** Archivierte Themenwelten können über die UI nicht wiederhergestellt werden (DB-Update möglich via SQL).
- **Keine Undo-Funktion:** Sub-Entitäten (FAQs, etc.) werden atomisch ersetzt — kein Undo nach Speichern.

---

## 18. Entscheidungsprotokoll

| Entscheidung | Alternative | Begründung |
|-------------|-------------|------------|
| `sanitize-html` für HTML-Sanitizing | DOMPurify+jsdom, eigene Engine | DOMPurify benötigt DOM (25MB+ mit jsdom), eigene Engine verboten. `sanitize-html` ist htmlparser2-basiert, läuft in Node.js ohne DOM, weit verbreitet (8M Downloads/Woche) |
| Signed-URL-Flow statt Server-Proxy für Bilder | Direkter Upload via Service Role | Vercel-Funktionslimit 4.5MB, saubere Trennung Auth-Check vs. Upload |
| Zwei Fehlerklassen (NotFoundError vs. DbError) | Einheitliche Fehlerklasse | Kritischer UX-Unterschied: 404 darf nicht auf Legacy zurückfallen (würde falschen Inhalt zeigen), technische Fehler sollen auf Legacy zurückfallen |
| Tab-spezifisches Speichern | Single-Save für gesamtes Formular | Grosse Formulare haben viele Sub-Entitäten mit atomischem Batch-Replace — ein einzelner Save wäre fehleranfällig und langsam |
| Bearer-Token über API-Layer | Direkter Supabase-Client in Admin | Service-Role-Key darf nie im Client sein; API-Layer ermöglicht serverseitige Validierung und Publish-Gate |
