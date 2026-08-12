# Phase 3: Datenbank- und API-Grundlage — Dynamisches Themenwelten-System

**Erstellt:** 2026-07-14
**Branch:** `feature/dynamic-theme-worlds`
**Ausgangscommit:** `e4cd79a` (Phase 2)
**Status:** Phase 3 abgeschlossen — lokal committed, nicht gepusht

---

## 1. Umgesetztes Datenmodell

### 1.1 Überblick

Sieben neue Tabellen in `supabase/migrations/20260714_create_theme_worlds.sql`:

| Tabelle | Zweck | Delete-Verhalten |
|---|---|---|
| `theme_worlds` | Haupttabelle, Landingpage-Daten | — |
| `theme_world_scenarios` | Szenario-Artikel | `ON DELETE RESTRICT` |
| `theme_world_faqs` | FAQ-Einträge | `ON DELETE CASCADE` |
| `theme_world_editorial_sections` | Redaktionelle Langtext-Sektionen | `ON DELETE CASCADE` |
| `theme_world_specialties` | Kursbereiche / Ausbildungsbereiche | `ON DELETE CASCADE` |
| `theme_world_regions` | Regionslinks | `ON DELETE CASCADE` |
| `theme_world_trust_items` | Trust- und Qualitätshinweise | `ON DELETE CASCADE` |

### 1.2 Abweichungen von Phase 2

| Phase-2-Entwurf | Phase-3-Implementierung | Begründung |
|---|---|---|
| `is_published BOOLEAN`, `is_active BOOLEAN` | `status TEXT ('draft','published','archived')` | Statusmodell klarer, keine widersprüchlichen Boolean-Kombinationen |
| `type_key TEXT` in DB gespeichert | Nicht in DB — abgeleitet aus `url_segment` | Redundantes Feld vermieden; `url_segment.replace('-', '_')` ergibt type_key |
| Keine explizite Deploy-Tracking | `deploy_status TEXT`, `deploy_requested_at TIMESTAMPTZ` | Getrennte Verantwortlichkeit (Correction D) |
| Kein Konsistenz-Check zwischen Segmenten | `theme_worlds_segment_consistency CHECK` | Inkonsistente Werte auf DB-Ebene ausgeschlossen (Correction I) |
| RLS mit `is_published = true AND is_active = true` | RLS mit `status = 'published'` | Passt zum Statusmodell |

---

## 2. Tabellen im Detail

### 2.1 `theme_worlds`

```sql
id UUID PK
key TEXT UNIQUE NOT NULL          -- 'sport_fitness_beruf'
url_segment TEXT NOT NULL          -- 'beruflich' | 'privat-hobby' | 'kinder-jugend'
slug TEXT NOT NULL                 -- 'sport-fitness-berufsausbildung'
db_segment TEXT NOT NULL           -- 'professionell' | 'privat' | 'kinder'
area_slug TEXT NOT NULL            -- Taxonomie-Bereichs-Slug

-- Inhalte (DE Pflicht)
title_de / title_en / title_fr / title_it
subtitle_de / subtitle_en / subtitle_fr / subtitle_it
intro_de TEXT

-- Bilder
hero_image_url TEXT
hero_image_alt_de TEXT
og_image_url TEXT

-- SEO
meta_title TEXT
meta_description TEXT

-- JSONB
search_config JSONB
section_titles JSONB
predefined_searches JSONB
cta_links JSONB

-- Status
status TEXT DEFAULT 'draft'        -- 'draft' | 'published' | 'archived'
published_at TIMESTAMPTZ
deploy_status TEXT DEFAULT 'not_requested'
deploy_requested_at TIMESTAMPTZ

sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ             -- auto-updated via Trigger
```

**Constraints:**
- `UNIQUE (url_segment, slug)` — kanonischer Pfad eindeutig
- `theme_worlds_segment_consistency` — db_segment/url_segment müssen konsistent sein
- `theme_worlds_slug_format_check` — nur a-z, 0-9, Bindestriche
- `theme_worlds_published_at_check` — published_at nur bei status=published/archived

### 2.2 `theme_world_scenarios`

```sql
id UUID PK
theme_world_id UUID FK → theme_worlds(id) ON DELETE RESTRICT
slug TEXT NOT NULL
icon TEXT
label_de TEXT NOT NULL
label_en / label_fr / label_it
teaser_de TEXT
teaser_en TEXT
content_html TEXT                  -- sanitiert vor Speicherung
card_image_url TEXT
card_image_alt TEXT
og_image_url TEXT
meta_title / meta_description TEXT
cta_label_de TEXT
cta_config JSONB
sort_order INTEGER
status TEXT DEFAULT 'draft'        -- 'draft' | 'published' | 'archived'
published_at TIMESTAMPTZ
last_reviewed_at DATE
created_at / updated_at TIMESTAMPTZ
```

**Constraints:**
- `UNIQUE (theme_world_id, slug)` — Slug eindeutig pro Themenwelt
- `scenarios_card_image_alt_check` — Alt-Text Pflicht wenn Bild gesetzt

### 2.3 Sub-Tabellen (FAQs, Editorial, Specialties, Regions, Trust)

Alle CASCADE bei Theme-World-Löschung. `is_active BOOLEAN DEFAULT true` (kein Status-Enum — kein eigenständiger Lifecycle).

Besonderheiten:
- `theme_world_regions`: `constraint regions_params_check` — min. `loc_param` oder `delivery_param` muss gesetzt sein
- `theme_world_trust_items`: `item_type` ('label','editorial','info'), `logo_alt` Pflicht wenn `logo_url` gesetzt
- `theme_world_specialties`: `UNIQUE (theme_world_id, specialty_label)` — kein Duplikat-Label pro TW

---

## 3. Statusmodell

### Redaktioneller Status (`theme_worlds`, `theme_world_scenarios`)

```
draft      → Standard bei Erstellung. Nicht öffentlich sichtbar.
published  → Öffentlich sichtbar (via RLS). Slug read-only via API.
archived   → Nicht öffentlich. Datensatz bleibt erhalten (kein Löschen).
```

Übergänge:
- `draft → published`: via `publish`-Action (Validierungsprüfung)
- `published → draft`: via `unpublish`-Action
- `* → archived`: via `archive`-Action
- `archived → published`: NICHT direkt. Erst `archive → draft` nötig (über DB-Zugriff).

### Deploy-Status (`theme_worlds` only)

```
not_requested  → Kein Deploy angefordert (Standard)
requested      → HTTP-POST an Hook akzeptiert (kein Nachweis für fertigen Build)
failed         → Anfrage fehlgeschlagen (Timeout, HTTP-Fehler, Netzwerkfehler)
```

Deploy-Status ist unabhängig vom redaktionellen Status.

---

## 4. RLS-Policies

Alle sieben Tabellen haben `ENABLE ROW LEVEL SECURITY`.

### Öffentliche SELECT-Policies

| Tabelle | Bedingung |
|---|---|
| `theme_worlds` | `status = 'published'` |
| `theme_world_scenarios` | `status = 'published' AND theme_world_id IN (SELECT id FROM theme_worlds WHERE status = 'published')` |
| Sub-Tabellen (5) | `theme_world_id IN (SELECT id FROM theme_worlds WHERE status = 'published')` |

**Keine** INSERT/UPDATE/DELETE-Policies für `anon` oder `authenticated`.

Service-Role umgeht RLS automatisch (Supabase-Standard). Alle schreibenden Operationen laufen ausschliesslich über Server-API-Endpunkte mit `SUPABASE_SERVICE_ROLE_KEY`.

---

## 5. Öffentliche Reads

**Strategie:** Direkter Supabase-Read via `anon`-Key unter RLS (wie in Phase 2 empfohlen).

Das Frontend liest publizierte Themenwelten direkt über den Supabase-Client:
```javascript
const { data } = await supabase
  .from('theme_worlds')
  .select(`*, theme_world_faqs(*), theme_world_scenarios(*), ...`)
  .eq('url_segment', segment)
  .eq('slug', slug)
  // status='published' wird automatisch durch RLS erzwungen
  .single();
```

Admin-Reads (inkl. Entwürfe) laufen über `/api/admin-theme-worlds.js` mit Service-Role.

---

## 6. Admin-Authentifizierung

**Implementiert in:** `api/_lib/theme-world-auth.js`

Reihenfolge für alle schreibenden Endpunkte:

1. `Authorization: Bearer <token>` Header prüfen (401 wenn fehlt)
2. `supabaseAdmin.auth.getUser(token)` — JWT validieren (401 wenn ungültig)
3. `profiles.role = 'admin'` prüfen (403 wenn nicht Admin)
4. Erst danach: Service-Role-Operationen ausführen

Wiederverwendet das gleiche Muster wie `api/admin.js` (Zeilen 61–79) und `api/admin/taxonomy.js`.

---

## 7. API-Endpunkte

### 7.1 `GET|POST /api/admin-theme-worlds?action=<action>`

| Action | Methode | Beschreibung |
|---|---|---|
| `list` | GET | Alle TW (inkl. Entwürfe) für Admin |
| `get&id=<uuid>` | GET | Einzelne TW vollständig laden |
| `create` | POST | Neue TW erstellen (status=draft) |
| `update&id=<uuid>` | POST | Grunddaten aktualisieren |
| `archive&id=<uuid>` | POST | Status → 'archived' |
| `publish&id=<uuid>` | POST | Validieren + Status → 'published' |
| `unpublish&id=<uuid>` | POST | Status → 'draft' |

### 7.2 `GET|POST /api/admin-theme-world-scenarios?action=<action>&themeWorldId=<uuid>`

| Action | Methode | Beschreibung |
|---|---|---|
| `list` | GET | Szenarien einer TW |
| `get&id=<uuid>` | GET | Einzelnes Szenario vollständig |
| `create` | POST | Neues Szenario (status=draft) |
| `update&id=<uuid>` | POST | Aktualisieren |
| `archive&id=<uuid>` | POST | Status → 'archived' |
| `publish&id=<uuid>` | POST | Validieren + publizieren |
| `reorder` | POST | `{items: [{id, sort_order}]}` — Reihenfolge setzen |

### 7.3 `GET|POST /api/admin-theme-world-sub?action=<action>&themeWorldId=<uuid>`

| Action | Methode | Beschreibung |
|---|---|---|
| `get-all` | GET | Alle Sub-Entitäten einer TW |
| `replace-faqs` | POST | `{items: [...]}` — FAQ-Liste atomar ersetzen |
| `replace-editorial` | POST | Redaktionelle Sektionen ersetzen |
| `replace-specialties` | POST | Kursbereiche ersetzen |
| `replace-regions` | POST | Regionslinks ersetzen |
| `replace-trust` | POST | Trust-Items ersetzen |

**Atomarer Listenersatz:** Löscht alle vorhandenen Einträge, fügt neue Liste ein. Keine ACID-Transaktion (Supabase JS-Client), aber sequenziell sicher.

### 7.4 Fehlerformat

```json
{ "error": "Menschenlesbare Fehlermeldung." }
{ "error": "Validierungsfehler.", "details": ["field: Problem.", ...] }
```

HTTP-Status: 200 OK / 201 Created / 400 Bad Request / 401 Unauthorized / 403 Forbidden / 404 Not Found / 405 Method Not Allowed / 409 Conflict / 422 Unprocessable / 500 Internal Server Error

---

## 8. Validierung

**Implementiert in:** `api/_lib/theme-world-validate.js`

### Validierte Schemas

| Schema | Funktion |
|---|---|
| Theme World Grunddaten | `validateThemeWorldBase(data)` |
| Szenario | `validateScenario(data)` |
| search_config JSONB | `validateSearchConfig(config)` |
| section_titles JSONB | `validateSectionTitles(titles)` |
| predefined_searches JSONB | `validatePredefinedSearches(searches)` |
| cta_links JSONB | `validateCtaLinks(links)` |
| cta_config JSONB | `validateCtaConfig(config)` |
| FAQ | `validateFaq(data)` |
| Editorial Section | `validateEditorialSection(data)` |
| Specialty | `validateSpecialty(data)` |
| Region | `validateRegion(data)` |
| Trust Item | `validateTrustItem(data)` |
| Sort-Reordering | `validateSortReorder(items)` |
| Publish-Gate TW | `validatePublishThemeWorld(themeWorld)` |
| Publish-Gate Szenario | `validatePublishScenario(scenario, parentTW)` |

### Publish-Gate Themenwelt — Pflichtfelder

- `title_de` (nicht leer)
- `url_segment` + `slug` (gültige Werte)
- `db_segment` (gültiger Wert)
- `subtitle_de` ODER `intro_de` (mindestens einer)
- `search_config.area_slug` (vorhanden)
- `hero_image_alt_de` (wenn `hero_image_url` gesetzt)

Hero-Bild selbst: **nicht** verpflichtend (Fallback: Segmentfarbe).

### Publish-Gate Szenario — Pflichtfelder

- Parent-Themenwelt muss `status = 'published'` haben
- `label_de`, `slug` (gültige Werte)
- `teaser_de` (nicht leer)
- `content_html` (nicht leer)
- `card_image_alt` (wenn `card_image_url` gesetzt)

### JSONB-Key-Validierung

Unbekannte Keys in JSONB-Configs (search_config, section_titles, predefined_searches, cta_links, cta_config) werden **abgelehnt** (`400 Bad Request`).

Keine sicherheits- oder routingrelevanten freien Keys.

---

## 9. HTML-Sanitizing

**Implementiert in:** `api/_lib/theme-world-sanitize.js`

### Ansatz

Regex-basiert (kein DOMPurify) — serverless Node.js ohne DOM-Umgebung.

**Entfernt:**
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>` Tags + Inhalt
- `on*`-Event-Handler-Attribute (`onclick`, `onload`, `onerror`, etc.)
- `javascript:` in `href`, `src`, `action`, `formaction`
- `data:` in `href`, `src`
- `vbscript:` in URL-Attributen

**Erlaubt:** Alle anderen HTML-Tags inkl. `class`, `id`, reguläre `href`/`src` mit `https://`.

### Risikobewertung

Akzeptabel für admin-only Content (authentifiziert + role=admin). Bei öffentlichem Schreibzugriff wäre eine vollständige DOM-Parser-Lösung (DOMPurify + jsdom oder linkedom) erforderlich.

Sanitisierung erfolgt automatisch bei `create` und `update` von Szenarien (`content_html`).

---

## 10. Bildfelder

| Feld | Tabelle | Pflicht | Alt-Text-Pflicht |
|---|---|---|---|
| `hero_image_url` | `theme_worlds` | Nein (Fallback: Gradient) | Ja, wenn gesetzt |
| `og_image_url` | `theme_worlds` | Nein (Fallback: /og-default.png) | Nein |
| `card_image_url` | `theme_world_scenarios` | Nein (Fallback: Emoji) | Ja, wenn gesetzt (DB+API-Constraint) |
| `og_image_url` | `theme_world_scenarios` | Nein | Nein |
| `logo_url` | `theme_world_trust_items` | Nur bei item_type='label' | Ja, wenn gesetzt (DB+API-Constraint) |

Alle Bild-URLs müssen `https://`-Protokoll haben (validiert in API).

---

## 11. Deploy-Hook-Grundlage

**Implementiert in:** `api/_lib/deploy-hook.js`

### Rückgabewerte

```javascript
{ status: 'not_configured' }  // VERCEL_DEPLOY_HOOK_URL fehlt/ungültig
{ status: 'requested' }       // HTTP-Request akzeptiert — kein Deploy-Nachweis
{ status: 'failed', httpStatus: 403 }   // HTTP-Fehler
{ status: 'failed', reason: 'timeout' } // Request-Timeout (5s)
{ status: 'failed', reason: 'network_error' } // Netzwerkfehler
```

### Sicherheitsregeln (alle erfüllt)

- URL nur aus `VERCEL_DEPLOY_HOOK_URL` (nie hardcoded)
- URL nie an Browser gesendet
- URL nie in Logs ausgegeben
- Secrets nie in Fehlerantworten
- 5-Sekunden-Timeout
- POST-Methode

### Phase-3-Einschränkung

Der Aufruf in Publish-Endpunkten ist hinter `THEME_WORLD_DEPLOY_ENABLED=true` gesperrt.
**Default (nicht gesetzt): kein Deploy in Phase 3.**

---

## 12. Publish-Validierung

### Ablauf (Themenwelt)

1. Admin-Berechtigung prüfen (Bearer Token → profiles.role = 'admin')
2. Themenwelt vollständig aus DB laden
3. `validatePublishThemeWorld(themeWorld)` — serverseitige Validierung
4. Bei Fehler: `422 Unprocessable Entity` mit `details`-Array
5. `status = 'published'`, `published_at = now()` (wenn noch nicht gesetzt)
6. Deploy-Hook nur wenn `THEME_WORLD_DEPLOY_ENABLED=true` (Phase 3: nie aktiv)
7. Deploy-Status in DB speichern
8. Antwort: `{ data: {...}, deploy: {...} }`

### Ablauf (Szenario)

1. Admin-Berechtigung prüfen
2. Szenario + Parent-Themenwelt aus DB laden
3. `validatePublishScenario(scenario, parentTW)`
4. Parent muss `status = 'published'` haben
5. Status setzen, `published_at` setzen
6. Kein Deploy-Hook für Szenarien (nur TW-Publish löst Deploy aus)

---

## 13. Sitemap-Bugfix

**Problem:** `api/sitemap.js` Zeile 46 fragt `.from('blog')` ab (Tabelle existiert nicht). Blog-Post-URLs fehlten vollständig aus der Sitemap.

**Fix:** `.from('articles')` (korrekte Tabellennamen, bestätigt in Phase 2).

**Fehlerbehandlung verbessert:** `console.error(...)` statt `console.warn(...)` bei Blog-Abfragefehler. Sitemap wird ohne Blog-URLs ausgeliefert (kein 500-Fehler).

**Was NICHT geändert wurde:**
- Keine Sitemap-Einträge für neue Themenwelten (Phase 4+)
- Keine Änderung an bereichUrls-Loop (Legacy-Config bleibt aktiv)
- Keine anderen Sitemap-Funktionen

---

## 14. Lokale Tests

### Ausgeführte Test-Suites

Tests liegen in `tests/`:
- `theme-world-validation.test.js` — Validierungsschemas (60+ Tests)
- `theme-world-sanitize.test.js` — HTML-Sanitizer (20+ Tests)
- `theme-world-deploy-hook.test.js` — Deploy-Hook-Helfer (12+ Tests)
- `theme-world-api.test.js` — API-Handler mit gemocktem Supabase (15+ Tests)
- `sitemap-blog-fix.test.js` — Sitemap-Bugfix-Verifikation (5+ Tests)

### Voraussetzungen für lokale Tests

```bash
npm test
# oder
npx vitest run
```

Keine echte DB oder Supabase-Verbindung erforderlich — Supabase wird vollständig gemockt.

---

## 15. Migration: Noch nicht ausgeführt

**Migrationsdatei:** `supabase/migrations/20260714_create_theme_worlds.sql`

**Status: Erstellt, aber NICHT ausgeführt.**

### Migration ist additiv — keine bestehenden Tabellen werden verändert.

### Voraussetzungen für spätere sichere Ausführung

1. **Lokal** (optional, für Tests):
   ```bash
   supabase db reset        # Lokale DB zurücksetzen
   supabase db push         # Migration lokal anwenden
   # ODER
   supabase migration run   # Einzelne Migration anwenden
   ```

2. **Produktions-Staging** (vor Production):
   - Migration in Supabase Staging-Projekt ausführen
   - Alle Tests gegen Staging laufen lassen
   - Manuelle Verifikation der Tabellenstruktur

3. **Produktion** (nach Phase-4-Abnahme):
   ```bash
   supabase db push --db-url <PRODUCTION_DB_URL>
   # ODER: Via Supabase Dashboard → SQL Editor → Migration-SQL einfügen
   ```

4. **Rollback** (falls nötig):
   - Neue Tabellen löschen: `DROP TABLE IF EXISTS theme_world_trust_items, ...`
   - Kein anderes System wird beeinträchtigt (additive Migration)

### Nicht ausführen

- Nicht gegen die produktive Supabase-Datenbank ausführen
- Nicht per `supabase push` gegen das verknüpfte Remote-Projekt

---

## 16. Voraussetzungen für Phase 4

Phase 4 implementiert Admin-Formulare und Frontend-Anbindung. Voraussetzungen:

1. **Migration ausgeführt** gegen ein Nicht-Produktionssystem (Staging oder lokal)
2. **Umgebungsvariablen gesetzt:**
   - `SUPABASE_URL` / `VITE_SUPABASE_URL` — bereits vorhanden
   - `SUPABASE_SERVICE_ROLE_KEY` — bereits vorhanden
   - `VERCEL_DEPLOY_HOOK_URL` — neu, für später
   - `THEME_WORLD_DEPLOY_ENABLED=true` — erst in Phase 4 aktivieren
3. **API-Endpunkte deployed** auf Vercel (aus diesem Commit)
4. **Keine bestehende Themenwelt importiert** (Phase 5)
5. **Kein Frontend auf neue Datenquelle umgestellt** (Phase 6)

### Neue Dateien aus Phase 3

```
supabase/migrations/20260714_create_theme_worlds.sql
api/_lib/theme-world-auth.js
api/_lib/theme-world-validate.js
api/_lib/theme-world-sanitize.js
api/_lib/deploy-hook.js
api/admin-theme-worlds.js
api/admin-theme-world-scenarios.js
api/admin-theme-world-sub.js
tests/theme-world-validation.test.js
tests/theme-world-sanitize.test.js
tests/theme-world-deploy-hook.test.js
tests/theme-world-api.test.js
tests/sitemap-blog-fix.test.js
docs/theme-worlds/phase-3-database-api.md
```

### Geänderte Dateien aus Phase 3

```
api/sitemap.js           — Bug-Fix: blog → articles
docs/theme-worlds/phase-2-architecture.md  — Corrections-Abschnitt ergänzt
```

---

## 17. Bekannte Risiken

| Risiko | Schwere | Massnahme |
|---|---|---|
| Migration gegen Production ohne Freigabe | Kritisch | Explizites Gate: Migration nur nach Phase-4-Abnahme |
| Sub-Tabellen-Ersatz nicht transaktional | Mittel | Delete + Insert sequenziell; bei Insert-Fehler ist Tabelle leer. Mitigierung: Validierung vor Delete |
| HTML-Sanitizer Regex-Lücken | Niedrig | Admin-only Content; Regex deckt bekannte Vektoren ab |
| Slug-Änderung publizierter Inhalte via DB-Direktzugriff | Mittel | API-Schutz vorhanden; DB-Level-Schutz nur via Supabase RLS (nicht für Service-Role) |
| Deploy-Status nicht persistent bei API-Fehler | Niedrig | Best-effort; echter Deploy-Status kommt aus Vercel-Dashboard |

---

## 18. Rollback über Legacy-Fallback

Rollback ist **nie** durch Löschen von Datensätzen vorgesehen.

**Rollback-Strategie (nach Phase 6):**
1. Feature-Flag `VITE_THEME_WORLD_USE_DB = false` setzen (oder Variable entfernen)
2. Deploy
3. `BereichLandingPage.jsx` und `SzenarioArtikelView.jsx` verwenden wieder JS-Config-Fallback
4. DB-Datensätze bleiben vollständig erhalten

DB-Tabellen können dauerhaft im System verbleiben (keine Auswirkung wenn Feature-Flag deaktiviert).

---

## 19. Bestätigungen

- Kein Push
- Kein Pull Request erstellt
- Keine produktive Migration ausgeführt
- Keine produktiven Daten verändert
- Kein echter Deploy Hook ausgelöst
- Keine bestehende Themenwelt importiert
- Kein Admin-Frontend implementiert
- Kein Frontend auf neue Datenquelle umgestellt
- Phase 4 nicht begonnen
