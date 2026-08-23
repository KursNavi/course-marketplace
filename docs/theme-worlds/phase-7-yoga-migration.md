# Phase 7 — Yoga & Achtsamkeit Dynamic Theme World

**Datum:** 2026-07-18
**Branch:** `feature/dynamic-theme-worlds`
**Status:** Abgeschlossen ✓

## Ziel

Migration der Themenwelt "Yoga & Achtsamkeit" vom statischen Legacy-System (`bereichLandingConfig.js`) in das dynamische DB-System (Supabase Staging). Sport & Fitness bleibt parallel aktiv — beide Themenwelten laufen gleichzeitig.

## Was wurde gemacht

### 1. Adapter-Bugfix (`src/lib/themeWorldAdapter.js`)

**Problem:** `adaptToLegacyBereichConfig` gab für `regionalDiscovery.title` und `.subtitle` immer leere Strings zurück, obwohl `section_titles.regions_heading` und `regions_subheading` in der DB existierten.

**Fix (Zeile 437–438):**
```js
// VORHER (Bug):
title: { de: '' },
subtitle: { de: '' },

// NACHHER (Fix):
title: st.regions_heading ? { de: st.regions_heading } : { de: '' },
subtitle: st.regions_subheading ? { de: st.regions_subheading } : { de: '' },
```

Dieser Bug hätte dazu geführt, dass der Abschnittstitel "Yoga- und Achtsamkeitskurse in deiner Region" nicht angezeigt worden wäre.

### 2. Yoga Import-Datei (`data/theme-worlds/yoga-achtsamkeit.json`)

Vollständige Import-Datei erstellt mit:
- 1 Themenwelt (`yoga_achtsamkeit`, `privat-hobby`, `privat`)
- 8 Szenarien mit vollständigem HTML-Inhalt
- 10 FAQs
- 6 redaktionelle Sektionen
- 7 Spezialgebiete
- 8 Regionen
- 3 Trust-Items (`item_type: "info"` — redaktionelle Hinweise, keine Logos)
- `section_titles` mit allen Schlüsseln inkl. `regions_heading` und `regions_subheading` (neue Schlüssel)

**Behobener Emoji-Fehler:** Zwei Icons im JSON hatten ungültige Surrogate-Paare:
- `\ud83fac1` → Korrektur zu 🫁 (`\uD83E\uDEC1`)
- `\ud83e\udef2` → Korrektur zu 🤲 (`\uD83E\uDD32`)

PostgreSQL warf sonst "Empty or invalid json" beim JSONB-Import.

### 3. Bild-Manifest (`data/theme-worlds/yoga-achtsamkeit-images.json`)

- Hero-Bild: Unsplash `photo-1506126613408-eca07ce68773` (externe URL, kein Upload nötig)
- 8 Szenario-Bilder: null (Legacy hatte keine Szenario-Bilder)
- `storage_migration_needed: false` für Phase 7

### 4. Staging-Import

```bash
node scripts/import-theme-world.mjs --file data/theme-worlds/yoga-achtsamkeit.json --apply --staging
```

- Staging-DB: `omoapbvfligjfznzivyu.supabase.co`
- Themenwelt-ID: `bdbd426a-f349-46eb-920b-9407dbf893d6`
- Idempotenz: Zweiter Import gibt dieselbe ID zurück ✓

### 5. Feature-Flag (`.env.staging.local`)

```
VITE_THEME_WORLD_PILOT_KEYS=sport_fitness_beruf,yoga_achtsamkeit
```

Yoga wurde zu den Pilot-Keys hinzugefügt. Der Legacy-Fallback bleibt aktiv wenn der Key entfernt wird.

## Yoga-Sonderfälle

| Eigenschaft | Wert | Unterschied zu Sport |
|-------------|------|---------------------|
| `url_segment` | `privat-hobby` | `beruflich` bei Sport |
| `db_segment` | `privat` | `professionell` bei Sport |
| `typeKey` | `privat_hobby` | `beruflich` bei Sport |
| `trust_heading` | "Worauf du bei der Kurswahl achten solltest" | "Qualität & Anerkennung" bei Sport |
| `trust items` | `item_type: "info"` (keine Logos) | `item_type: "label"` bei Sport |
| `faqs_heading` | "Häufige Fragen" (explizit gesetzt) | Sport: kein expliziter Wert |
| Anzahl FAQs | 10 | 7 bei Sport |
| Anzahl Szenarien | 8 | 8 bei Sport |
| Hero-Bild | Unsplash (extern) | Unsplash (extern) bei Sport |

## section_titles Mapping

| DB-Schlüssel | Wert (Yoga) |
|-------------|-------------|
| `scenarios_heading` | "Welche Richtung passt zu dir?" |
| `scenarios_subheading` | "Finde den passenden Einstieg für Entspannung, Schlaf, Fokus oder körperliche Praxis" |
| `faqs_heading` | "Häufige Fragen" |
| `trust_heading` | "Worauf du bei der Kurswahl achten solltest" |
| `cta_heading` | "Bereit für deine Praxis?" |
| `cta_button` | "Alle Yoga-Kurse anzeigen" |
| `regions_heading` | "Yoga- und Achtsamkeitskurse in deiner Region" |
| `regions_subheading` | "Finde Yoga- und Achtsamkeitskurse in deiner Region..." |
| `specialties_heading` | "Kursbereiche" |
| `specialties_subheading` | "Alle Schwerpunkte auf einen Blick" |
| `searches_subheading` | "Schnelleinstieg zu gefragten Yoga- und Achtsamkeitsformaten" |

## URL-Struktur

| URL | Typ | Status |
|-----|-----|--------|
| `/bereich/privat-hobby/yoga-achtsamkeit` | Landingpage | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/yoga-fuer-anfaenger` | Szenario | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/yoga-stile-finden` | Szenario | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/stress-abbauen-entspannen` | Szenario | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/besser-schlafen-yoga-nidra` | Szenario | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork` | Szenario | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/klangmeditation-mantra` | Szenario | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/energiearbeit-reiki` | Szenario | ✓ |
| `/bereich/privat-hobby/yoga-achtsamkeit/bodywork-thai-yoga-massage` | Szenario | ✓ |

## Testergebnisse

| Testsuite | Ergebnis |
|-----------|---------|
| Vitest (alle) | 772/772 ✓ |
| Phase 7 Unit Tests (`theme-world-phase7-yoga.test.js`) | 31/31 ✓ |
| URL-Check Yoga (18 Checks) | 18/18 ✓ |
| Parity/Fallback/Regression/A11y (35 Checks) | 35/35 ✓ |
| Phase 6.5 Sport Regression (18 Checks) | 18/18 ✓ |
| Phase 6.5 Parity/Fallback (21 Checks, aktualisiert) | 21/21 ✓ |
| Phase 6.5 Security Tests | 54/54 ✓ |
| RLS Smoke Test | 4/4 ✓ |
| Staging Build | ✓ |

## RLS-Verhalten

- `published` → anon key sieht Yoga-Themenwelt und alle 8 Szenarien ✓
- `draft` → anon key sieht keine Draft-Einträge ✓
- Schreiben → anon key wird von RLS blockiert ✓

## Performance

- Supabase-Abfragen beim Laden der Yoga-Landingpage: 14 (React StrictMode → 2×7 TW-Tabellen)
- Kein N+1: `theme_world_scenarios` wird exakt 2× abgefragt (StrictMode), nicht 8×

## Bekannte Einschränkungen (Phase 8)

- Szenario-Bilder: alle 8 Szenarien haben `null` als `card_image_url` — Stockbilder optional in Phase 8
- Hero-Bild ist noch eine externe Unsplash-URL — Upload nach Supabase Storage in Phase 8
- `storage_migration_needed: true` für Hero-Bild (in `yoga-achtsamkeit-images.json`)

## Neue Testdateien

| Datei | Zweck |
|-------|-------|
| `tests/phase7-yoga-url-check.mjs` | Browser-Test: 9 Yoga-URLs × 2 Viewports |
| `tests/phase7-yoga-parity-fallback.mjs` | Parity, Sonderfälle, Regression, Performance, A11y |
| `tests/theme-world-phase7-yoga.test.js` | Vitest-Unit-Tests (Adapter-Bugfix, Import-Validität) |

## Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `src/lib/themeWorldAdapter.js` | Bug-Fix: `regions_heading`/`regions_subheading` |
| `.env.staging.local` | `yoga_achtsamkeit` zu `VITE_THEME_WORLD_PILOT_KEYS` hinzugefügt |
| `tests/phase65-parity-fallback.mjs` | Test B aktualisiert: Yoga ist jetzt dynamisch (Phase 7) |
| `data/theme-worlds/yoga-achtsamkeit.json` | NEU: Yoga Import-Datei |
| `data/theme-worlds/yoga-achtsamkeit-images.json` | NEU: Bild-Manifest |
| `tests/phase7-yoga-url-check.mjs` | NEU |
| `tests/phase7-yoga-parity-fallback.mjs` | NEU |
| `tests/theme-world-phase7-yoga.test.js` | NEU |
| `docs/theme-worlds/phase-7-yoga-migration.md` | NEU (dieses Dokument) |
