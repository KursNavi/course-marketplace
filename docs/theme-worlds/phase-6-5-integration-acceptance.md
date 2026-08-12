# Phase 6.5 — Technische Integrationsabnahme Sport-Pilot

**Branch:** `feature/dynamic-theme-worlds`
**Datum (Abschluss):** 2026-07-18
**Ausgangscommit:** `69bc978`
**Status:** ✅ BESTANDEN

---

## Zusammenfassung

Phase 6.5 führte die vollständige technische Integrationsabnahme des Sport-&-Fitness-Piloten gegen die echte Staging-Supabase-Umgebung durch.

**Staging-Projekt:** `omoapbvfligjfznzivyu` (TESTumgebung KursNavi)
**URL:** `https://omoapbvfligjfznzivyu.supabase.co`
**Produktion:** `nplxmpfasgpumpiddjfl` — **nie berührt**

---

## Ergebnisübersicht

| Prüfbereich | Status |
|------------|--------|
| Migrationen (2x) gegen Staging | ✅ |
| Schema-Verifikation (7 Tabellen, RLS, Indizes, Trigger, GRANT) | ✅ |
| Atomarer Import (Erstimport) | ✅ |
| Re-Import Idempotenz | ✅ |
| Rollback bei fehlerhaftem Import | ✅ |
| Statusschutz (published_at bleibt erhalten) | ✅ |
| RLS-Tests (12 Szenarien) | ✅ |
| Admin-Authentifizierung (5 Szenarien) | ✅ |
| Browser-URL-Tests (9 URLs × 2 Viewports) | ✅ 18/18 |
| Dynamic vs. Legacy Parität | ✅ |
| Yoga bleibt Legacy (kein Pilot-Key) | ✅ |
| Suchlinks (CTA, Region, Specialty) | ✅ |
| Performance: kein N+1 | ✅ |
| Accessibility-Basics | ✅ |
| Vitest gesamt | ✅ 741/741 |
| Build | ✅ |

---

## 1. Testumgebung

- **Staging-Ref:** `omoapbvfligjfznzivyu`
- **Konfiguration:** `.env.staging.local` (gitignored)
- **Feature-Flag lokal:** `VITE_THEME_WORLD_DB_ENABLED=true`, `VITE_THEME_WORLD_PILOT_KEYS=sport_fitness_beruf`
- **Dev-Server:** `npm run dev -- --mode staging --port 5174`
- **Supabase CLI:** v2.109.1 — `migration repair` + `postgres.js` für direkte Migration-Anwendung
- **Nachweis nicht Produktion:** Prod-Ref `nplxmpfasgpumpiddjfl` ≠ Staging-Ref ✓

---

## 2. Migrations-Anwendung

Zwei neue Migrations-Dateien auf Staging angewendet:

| Datei | Methode | Status |
|-------|---------|--------|
| `20260714_create_theme_worlds.sql` | `postgres.js` direkt | ✅ |
| `20260715_import_theme_world_atomic.sql` | `postgres.js` direkt | ✅ |
| `20260718_relax_regions_params_constraint.sql` | `postgres.js` direkt | ✅ |

Alle vorherigen Migrationen per `supabase migration repair --status applied` als angewendet markiert (Staging-DB hatte Schema bereits manuell).

---

## 3. Schema-Verifikation

Nach Migration geprüft:

| Kriterium | Ergebnis |
|-----------|---------|
| 7 Tabellen erstellt | ✅ |
| RLS auf allen 7 Tabellen aktiviert | ✅ |
| Public read policy (anon + authenticated) | ✅ |
| 22 Indizes | ✅ |
| 2 Trigger (set_updated_at) | ✅ |
| SECURITY DEFINER + search_path='' | ✅ |
| EXECUTE nur für postgres + service_role | ✅ |
| EXECUTE NICHT für anon/authenticated | ✅ |

---

## 4. Atomarer Import

**Import-Datei:** `data/theme-worlds/sport-fitness-berufsausbildung.json`

### Erstimport

| Komponente | Anzahl |
|------------|--------|
| Themenwelt | 1 |
| Szenarioartikel | 8 |
| FAQs | 7 |
| Editorial Sections | 6 |
| Specialties | 8 |
| Regionen | 8 |
| Trust Items | 3 |
| Pilot-URLs | 9 |

**TW-ID:** `5fba94e2-96ad-430a-97a9-e45634ba57ed`

### Re-Import (Idempotenz)

- Gleiche TW-ID ✅
- Gleiche Anzahlen ✅
- Status `published` erhalten ✅
- `published_at` erhalten ✅

### Rollback-Test

- Fehlerhafte Datei (trust_item ohne Pflichtfeld) → NOT NULL violation ✅
- Keine Teiländerungen (trust_items = 3, nicht 4) ✅
- Atomarität bestätigt ✅

---

## 5. Constraint-Fixes (Phase 6.5)

Zwei Constraint-Probleme identifiziert und behoben:

### regions_params_check (zu streng)

- **Problem:** `CHECK (loc_param IS NOT NULL OR delivery_param IS NOT NULL)` blockierte Region #7 "Ganze Schweiz" mit `loc_param=null, delivery_param=null`
- **Fix:** Migration `20260718_relax_regions_params_constraint.sql` — Constraint gedroppt
- **Begründung:** Region ohne Parameter = "Alle Kurse ohne Ortsfilter" — valid und gewollt

### theme_worlds_published_at_check (verhindert draft-Reset)

- **Verhalten:** `CHECK (published_at IS NULL OR status IN ('published', 'archived'))` — korrekt
- **RLS-Test-Fix:** Beim Setzen von `status='draft'` muss `published_at=null` mitgesetzt werden

---

## 6. RLS-Tests

12 Szenarien mit echtem Anon-Key getestet:

| # | Szenario | Status |
|---|---------|--------|
| 1 | Published TW sichtbar (anon) | ✅ |
| 2 | Draft TW unsichtbar (anon) | ✅ |
| 3 | Scenarios bei draft TW unsichtbar | ✅ |
| 4 | FAQs bei draft TW unsichtbar | ✅ |
| 5 | Published TW wieder sichtbar nach Re-Publish | ✅ |
| 6 | Published scenario sichtbar | ✅ |
| 7 | Draft scenario unsichtbar | ✅ |
| 8 | FAQs bei published TW sichtbar | ✅ |
| 9 | INSERT abgelehnt (HTTP 401) | ✅ |
| 10 | UPDATE wirkungslos | ✅ |
| 11 | DELETE wirkungslos | ✅ |
| 12 | RPC import_theme_world_atomic abgelehnt (HTTP 401) | ✅ |

---

## 7. Admin-Authentifizierung

Staging-Testnutzer erstellt:

| Nutzer | Rolle | Status |
|--------|-------|--------|
| `tw-test-admin@staging.kursnavi.invalid` | admin | ✅ erstellt |
| `tw-test-teacher@staging.kursnavi.invalid` | teacher | ✅ erstellt |
| `tw-test-user@staging.kursnavi.invalid` | user | ✅ erstellt |

`requireAdmin()` Verhalten:

| Szenario | Erwartet | Ergebnis |
|---------|---------|---------|
| Kein Token | 401 | ✅ |
| Ungültiger Token | 401 | ✅ |
| Normaler User | 403 | ✅ |
| Teacher | 403 | ✅ |
| Admin | 200 OK | ✅ |

---

## 8. Browser-URL-Tests (9 URLs × 2 Viewports)

Dev-Server: `http://localhost:5174` (Mode: staging)

Jede URL geprüft auf: HTTP 200, kein 404, H1 sichtbar, Breadcrumb, kein Spinner, Meta-Title, Meta-Description, Canonical, OG-Title; Landing: Szenario-Section, FAQ, Szenario-Links; Scenario: Article-Content.

| URL | Desktop | Mobile |
|-----|---------|--------|
| `/bereich/beruflich/sport-fitness-berufsausbildung` | ✅ 15/15 | ✅ 15/15 |
| `.../berufseinstieg` | ✅ 13/13 | ✅ 13/13 |
| `.../quereinstieg` | ✅ 13/13 | ✅ 13/13 |
| `.../weiterbildung` | ✅ 13/13 | ✅ 13/13 |
| `.../diplom-aufstieg` | ✅ 13/13 | ✅ 13/13 |
| `.../nebenerwerb` | ✅ 13/13 | ✅ 13/13 |
| `.../selbststaendigkeit` | ✅ 13/13 | ✅ 13/13 |
| `.../spezialisierung` | ✅ 13/13 | ✅ 13/13 |
| `.../zertifizierung` | ✅ 13/13 | ✅ 13/13 |

**Gesamt: 18/18 URL×Viewport-Kombinationen bestanden.**

### Sample: Landing Desktop

- H1: "Sport & Fitness - Finde deine Ausbildung"
- Breadcrumb: "Home › Berufliche Weiterbildung › Sport & Fitness - Finde deine Ausbildung"
- Meta-Title: gesetzt ✓
- Meta-Description: gesetzt ✓
- Canonical: enthält `/bereich/` ✓
- OG-Title: gesetzt ✓

---

## 9. Parity, Fallback & Search-Links

21/21 Tests bestanden:

| Test | Ergebnis |
|------|---------|
| A.1 H1 contains "Sport" | ✅ "Sport & Fitness - Finde deine Ausbildung" |
| A.2 Breadcrumb contains "beruflich" | ✅ |
| A.3 ≥ 8 Szenario-Links | ✅ count=16 |
| A.4 Specialties/Trust-Bereich sichtbar | ✅ body len=9084 |
| A.5 Kein Fehler-Overlay | ✅ |
| B.1 Yoga-Seite lädt (H1 sichtbar) | ✅ "Yoga & Achtsamkeit - Finde den Kurs..." |
| B.2 Keine theme_world DB-Abfrage für Yoga | ✅ 0 TW-Requests |
| B.3 Yoga-Seite hat Inhalt | ✅ |
| C.1 ≥ 1 Search-CTA-Link | ✅ count=13 |
| C.2 CTA ist /search URL | ✅ `/search?type=beruflich` |
| C.3 Search-Links mit Params | ✅ count=13 |
| C.4 CTA-Klick navigiert zu /search | ✅ |
| D.1 Szenario-Seite hat Search-Links | ✅ count=2 |
| D.2 .prose-ratgeber gerendert | ✅ |
| D.3 Szenario H1 vorhanden | ✅ "Berufseinstieg" |
| E.1 Kein N+1: theme_world_scenarios ≤ 2 Requests | ✅ scenarios=2 |
| E.2 TW-Daten geladen (≥ 1 TW-Request) | ✅ tw_requests=14 |
| F.1 Genau 1 H1 | ✅ |
| F.2 Bilder mit alt-Attribut | ✅ |
| F.3 `<main>` Landmark | ✅ |
| F.4 Interaktive Elemente (≥ 5) | ✅ count=75 |

### Hinweis: 42 Supabase-Requests (kein Problem)

Im Dev-Server (React StrictMode) laufen Effects doppelt:
- 7 theme_world_*-Tabellen × 2 (StrictMode) = 14 TW-Requests
- taxonomy_level1-4 × 4 (StrictMode × Layout + BereichLandingPage)
- courses, articles, profiles = globale Layout-Komponenten
- `theme_world_scenarios`: nur 2× (nicht 8× — kein N+1)

In Produktion (kein StrictMode): ~7 TW-Requests für die Landing-Page.

---

## 10. Vitest & Build

| Metrik | Ergebnis |
|--------|---------|
| Vitest: Testdateien | 29 |
| Vitest: Tests gesamt | **741** (Baseline: 728) |
| Neue Regression-Tests (Phase 6.5) | +13 |
| Build | ✅ |

### Neue Regression-Tests (Phase 6.5)

- `regions_params_check` entfernt: Constraint-Migration vorhanden, kein ADD CONSTRAINT
- `theme_worlds_published_at_check`: vorhanden und korrekt formuliert
- Import-Script: `.env.staging.local` vor `.env.test.local` geladen
- JSON-Daten: "Ganze Schweiz"-Region mit `loc_param=null, delivery_param=null` vorhanden und gültig

---

## 11. Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `scripts/import-theme-world.mjs` | `.env.staging.local` als primärer Staging-Fallback |
| `supabase/migrations/20260718_relax_regions_params_constraint.sql` | NEU: Constraint regions_params_check gedroppt |
| `tests/theme-world-phase6-5-security.test.js` | +13 Regression-Tests für Phase 6.5 Fixes |
| `tests/phase65-url-check.mjs` | NEU: 9-URL Browser-Test (nicht committed, Hilfs-Script) |
| `tests/phase65-parity-fallback.mjs` | NEU: Parity/Fallback Browser-Test (nicht committed, Hilfs-Script) |
| `docs/theme-worlds/phase-6-5-integration-acceptance.md` | Dieser Abnahmebericht (aktualisiert) |

---

## 12. Offene Punkte (für Phase 7)

| Punkt | Details |
|-------|---------|
| Rich-Text-Editor Browser-Test | Nicht durchgeführt — erfordert Admin-Login im Browser |
| Bild-Upload Staging | Nicht durchgeführt — erfordert Storage-Setup und Admin-UI |
| Staging-Testnutzer bereinigen | `tw-test-admin/teacher/user@staging.kursnavi.invalid` löschen |

Diese Punkte blockieren Phase 7 nicht — alle kritischen Integrationspfade sind bestanden.

---

## 13. Abnahmeentscheidung

### ✅ Phase 6.5 BESTANDEN

**Alle kritischen Prüfbereiche bestanden:**
- Migrations gegen echte Staging-DB angewendet und verifiziert ✅
- Atomarer Import (Erst, Re, Rollback, Statusschutz) bestanden ✅
- RLS real getestet (12/12 Szenarien) ✅
- Admin-Auth real getestet (5/5 Szenarien) ✅
- Alle 9 Browser-URLs dynamisch korrekt (18/18 checks) ✅
- Legacy (Yoga) unverändert funktioniert ✅
- Kein N+1, korrekte Accessibility-Basics ✅
- 741 Vitest-Tests bestanden ✅

**Phase 7 kann beginnen.**

---

## 14. Bestätigungen

- ✅ Kein Push
- ✅ Kein Pull Request
- ✅ Keine Produktionsdatenbank berührt
- ✅ Keine produktiven Storage-Dateien verändert
- ✅ Kein produktiver Deploy Hook ausgelöst
- ✅ Yoga nicht migriert (bleibt Legacy)
- ✅ Keine neue Themenwelt erstellt
- ✅ Legacy-Dateien nicht entfernt
- ✅ Sitemap nicht umgestellt
- ✅ Prerendering nicht umgestellt
- ✅ Keine produktiven Feature-Flags gesetzt
- ✅ Phase 7 nicht begonnen
