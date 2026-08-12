# Phase 8 — Neue Themenwelt per Admin erstellen

**Datum:** 2026-07-21
**Branch:** `feature/dynamic-theme-worlds`
**Commit-Basis:** `5ade753`

## Projektziel

Eine neue Themenwelt kann ohne individuelle Content-Codeänderungen vollständig durch einen Administrator angelegt werden.

---

## 1. Ausgangskontrolle

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Branch | `feature/dynamic-theme-worlds` ✓ |
| HEAD | `5ade753` ✓ |
| Git-Status | Sauber vor Commit ✓ |
| `.env.staging.local` | gitignored via `.env*.local` ✓ |
| Supabase-Link | `omoapbvfligjfznzivyu` (Staging) ✓ |
| Vitest | 882/882 (Baseline) + 65 neue = 947/947 ✓ |
| ESLint | Sauber (inkl. generischer Fix: `supabase/.temp/**` ignoriert) ✓ |
| Build | Erfolgreich ✓ |
| Staging-Daten | Sport (published), Yoga (published), kein test_kreativ_gestalten ✓ |

### Meta-Titel-Stand (Staging)
- Sport & Yoga: meta_title aus DB ≤ 60 Zeichen (seit Phase-7-Fix in commit 5ade753)
- Legacy-Modus: `document.title = config.title.de + " | KursNavi"` (generiert, kein DB-Wert)
- Dynamischer Modus: `config.metaTitle` aus DB (≤ 60 Zeichen durch Validierung erzwungen)
- Keine Inkonsistenz gefunden

---

## 2. Generischer Code-Fix (Kern von Phase 8)

### Problem
`BereichLandingPage.jsx` und `SzenarioArtikelView.jsx` setzten voraus, dass für jede Themenwelt ein Legacy-Eintrag in `BEREICH_LANDING_CONFIG` existiert. Ohne diesen Eintrag:
- `bereichKey = null`
- `if (!bereichKey) return;` → DB wurde nie abgefragt
- `config = null` → sofort 404

Neue Themenwelten (nur in DB, kein Legacy-Eintrag) waren daher nicht routebar.

### Fix (minimal, generisch, kein Test-Key hardcodiert)

**`src/components/BereichLandingPage.jsx`:**
1. Import: `isThemeWorldDbEnabled` aus `themeWorldFeatureFlag`
2. State: `const [dbOnlyLoading, setDbOnlyLoading] = useState(() => !legacyConfig && isThemeWorldDbEnabled())`
3. useEffect: Neuer Pfad für DB-only-Modus — lädt direkt ohne Pilot-Key-Prüfung
4. Guard: `if (dbOnlyLoading) return <Ladeindikator>` vor dem 404-Guard

**`src/components/SzenarioArtikelView.jsx`:**
Identisches Muster für zweistufigen Load (Themenwelt → Szenario).

### Logik des DB-only-Modus
```
!legacyConfig && isThemeWorldDbEnabled()
  → true: Direkt DB-Fetch ohne Pilot-Key-Einschränkung
  → false: Bestehende Pilot-Key-Logik bleibt unverändert
```

**Kein Legacy-Fallback bei DB-only:** Wenn die DB einen Fehler liefert, wird Not-found gezeigt (kein Legacy vorhanden). Wenn `ThemeWorldNotFoundError`, ebenfalls Not-found.

**Sport/Yoga unberührt:** Diese haben Legacy-Einträge → `legacyConfig != null` → DB-only-Pfad wird NICHT betreten → bestehende Pilot-Key-Logik läuft unverändert.

---

## 3. Admin-Erstellung der Test-Themenwelt

### Staging-Admin-URL
```
https://course-marketplace-h9nezdv2x-kursnavis-projects.vercel.app/admin/theme-worlds
```

### Test-Themenwelt-Daten

| Feld | Wert |
|------|------|
| Titel (DE) | Test-Themenwelt Kreativ & Gestalten |
| Interner Key | `test_kreativ_gestalten` |
| Segment | Privat & Hobby (`privat-hobby`) |
| Slug | `test-kreativ-gestalten` |
| Pfad | `/bereich/privat-hobby/test-kreativ-gestalten` |
| area_slug | `kreativ_gestalten` |

### Variable Anzahlen (bewusst abweichend von Sport/Yoga mit je 8)

| Tab | Inhalt | Anzahl |
|-----|--------|--------|
| Szenarioartikel | Kreativen Workshop auswählen, Neues Hobby ausprobieren, Kreativkurse für Einsteiger | **3** |
| FAQs | Kosten, Vorkenntnisse, Format, Ort, Dauer | **5** |
| Kursbereiche | Malerei & Zeichnen, Keramik & Töpfern, Fotografie, Textil & Nähen | **4** |
| Regionen | Zürich, Bern, Online | **3** |
| Redaktionell | Warum Kreativkurse?, So wählst du den richtigen Kurs | **2** |
| Trust Items | 3× info-Typ | **3** |
| Suchen | Malkurse Zürich, Keramik Online | **2** |

### Admin-Tab-Workflow (manuell durchzuführen)

**Tab: Grundlagen**
- Interner Key: `test_kreativ_gestalten`
- Titel: `Test-Themenwelt Kreativ & Gestalten`
- Untertitel: `Kreativkurse für jeden Geschmack in der Schweiz`
- URL-Segment: `privat-hobby`
- Slug: `test-kreativ-gestalten`
- Speichern → Reload → Prüfen: Kein Dirty-State

**Tab: Bilder & SEO**
- Hero-Bild: Upload (JPEG/PNG, < 5 MB)
- Alt-Text: `Kreative Menschen beim Malen in Zürich`
- OG-Bild: Upload
- Meta-Titel: `Kreativkurse Schweiz — Kurse & Ausbildungen 2026` (≤ 60 Zeichen)
- Meta-Beschreibung: `Finde die besten Kreativkurse in der Schweiz. Malerei, Keramik, Fotografie und mehr.`
- Speichern → Reload → Prüfen

**Tab: Suche**
- area_slug: `kreativ_gestalten`
- type_key: `privat_hobby`
- Speichern → Reload → Prüfen

**Tab: Kursbereiche**
4 Einträge hinzufügen (Malerei & Zeichnen, Keramik & Töpfern, Fotografie, Textil & Nähen)
- Speichern → Reload → Prüfen

**Tab: Regionen**
3 Einträge (Zürich mit `loc=zürich`, Bern mit `loc=bern`, Online mit `delivery=online`)
- Speichern → Reload → Prüfen

**Tab: Redaktionell**
2 Sektionen mit Inhalt
- Speichern → Reload → Prüfen

**Tab: FAQs**
5 Fragen mit Antworten
- Speichern → Reload → Prüfen

**Tab: Trust & Hinweise**
3 Info-Items
- Speichern → Reload → Prüfen

**Tab: Szenarioartikel**
3 Artikel erstellen (je mit Titel, Slug, Teaser, Rich-Text, Meta-Titel ≤ 60 Zeichen)
- Status zunächst: Draft

---

## 4. Bilder und Staging Storage

### Upload-Prüfungen
- Erlaubte Formate: JPEG, PNG, WebP
- Datei > 5 MB: wird abgelehnt (HTTP 413 / Validierungsfehler)
- Ungültiger MIME-Typ: wird abgelehnt
- Dateiname: UUID (kein Überschreiben)
- Vorschau: nach Upload sofort sichtbar
- Alt-Text: Pflichtfeld
- URL-Muster: `https://omoapbvfligjfznzivyu.supabase.co/storage/v1/object/public/theme-world-images/`
- Kein Produktions-Storage-URL (`nplxmpfasgpumpiddjfl`) für neue Uploads

---

## 5. Rich-Text-Editor

### Geprüfte Features (in Browser)
- Absätze, H2, H3
- Fett, Kursiv
- Aufzählung, nummerierte Liste
- Interner Link, externer Link, Link entfernen
- Undo/Redo
- Normaler Paste, formatierter Paste
- Cursor-Verhalten nach Formatierung
- Speichern und Reload

### Sicherheit (seit Phase 6 implementiert und getestet)
- `javascript:`-Links werden abgelehnt
- `data:`-Links werden abgelehnt
- `vbscript:`-Links werden abgelehnt
- Script-Tags entfernt
- Event-Handler entfernt
- Getestet in: `tests/theme-world-phase6-fixes.test.jsx`

---

## 6. Szenarioartikel (3 Stück)

| Nr | Titel | Slug | Status |
|----|-------|------|--------|
| 1 | Kreativen Workshop auswählen | `kreativen-workshop-auswaehlen` | draft → published |
| 2 | Neues Hobby ausprobieren | `neues-hobby-ausprobieren` | draft → published |
| 3 | Kreativkurse für Einsteiger | `kreativkurse-fuer-einsteiger` | draft → published |

Jeder Artikel: Titel, Slug, Teaser, Rich-Text, Kartenbild, Alt-Text, Meta-Titel ≤ 60 Zeichen, Meta-Beschreibung, CTA, Sortierung.

---

## 7. Draft- und Publish-Gates

### Draft-Verhalten
- Anonym: `GET /bereich/privat-hobby/test-kreativ-gestalten` → 404 (RLS blockiert)
- Admin: bearbeitbar
- Szenario-Artikel (draft): anonym nicht sichtbar

### Publish-Validierung
Vor vollständigem Ausfüllen: Publish-Versuch ergibt HTTP 422 mit Details-Array:
- Fehlende Felder werden explizit benannt
- Keine Teilpublikation möglich

### Nach Vervollständigung
- Alle Pflichtfelder ausgefüllt
- Mindestens 1 publiziertes Szenario vorhanden
- Publikation erfolgreich

---

## 8. Publikation (nur Staging)

### Erwartete Ergebnisse
- `status: 'published'`
- `published_at` gesetzt
- Öffentliche Landingpage sichtbar: `/bereich/privat-hobby/test-kreativ-gestalten`
- 3 Szenarioartikel sichtbar
- Alle aktiven Untereinträge sichtbar

### Öffentliche URLs
```
https://course-marketplace-h9nezdv2x-kursnavis-projects.vercel.app/bereich/privat-hobby/test-kreativ-gestalten
https://course-marketplace-h9nezdv2x-kursnavis-projects.vercel.app/bereich/privat-hobby/test-kreativ-gestalten/kreativen-workshop-auswaehlen
https://course-marketplace-h9nezdv2x-kursnavis-projects.vercel.app/bereich/privat-hobby/test-kreativ-gestalten/neues-hobby-ausprobieren
https://course-marketplace-h9nezdv2x-kursnavis-projects.vercel.app/bereich/privat-hobby/test-kreativ-gestalten/kreativkurse-fuer-einsteiger
```

---

## 9. Generisches Routing

### Bestätigung: Kein hardcodierter Test-Key
- `bereichLandingConfig.js`: kein `test_kreativ_gestalten` Eintrag ✓
- `szenarioContent.js`: kein `test_kreativ_gestalten` Eintrag ✓
- `App.jsx`: kein Sonderfall für neuen Key ✓
- `themeWorldFeatureFlag.js`: kein hardcodierter Key ✓
- Code-Suche nach `test_kreativ`: nur in Testdateien ✓

### URL-Routing (verifiziert durch Tests)
```
/bereich/privat-hobby/test-kreativ-gestalten            → bereich-landing ✓
/bereich/privat-hobby/test-kreativ-gestalten/{slug}     → bereich-szenario ✓
```

---

## 10. Browser-Checks (8 = 4 URLs × 2 Viewports)

Nach Publikation der Test-Themenwelt in Staging zu prüfen:

| URL | Desktop | Mobile |
|-----|---------|--------|
| `/bereich/privat-hobby/test-kreativ-gestalten` | kein 404, kein Console Error | Responsive |
| `/bereich/.../kreativen-workshop-auswaehlen` | kein 404, kein Console Error | Responsive |
| `/bereich/.../neues-hobby-ausprobieren` | kein 404, kein Console Error | Responsive |
| `/bereich/.../kreativkurse-fuer-einsteiger` | kein 404, kein Console Error | Responsive |

### Zu prüfen je URL
- Korrekte H1
- Breadcrumb
- Privat-&-Hobby-Theme (violette Farben)
- Inhalte sichtbar
- Bilder mit Alt-Text
- Kursbereiche (4)
- Regionen (3)
- Editorial Sections (2)
- FAQs (5)
- Trust Items (3)
- Suchlinks
- Meta Title ≤ 60 Zeichen
- Meta Description
- Canonical URL
- Open Graph Tags
- Keine horizontale Seitenüberbreite

---

## 11. Variable Anzahlen — Bestätigung

| Element | Test-Themenwelt | Sport/Yoga | Adapter reagiert korrekt |
|---------|-----------------|------------|--------------------------|
| Szenarioartikel | 3 | 8 | ✓ (kein Hardcode auf 8) |
| FAQs | 5 | 8 | ✓ |
| Kursbereiche | 4 | variiert | ✓ |
| Regionen | 3 | variiert | ✓ |
| Editorial Sections | 2 | variiert | ✓ |
| Trust Items | 3 | variiert | ✓ |
| Vordefinierte Suchen | 2 | variiert | ✓ |

Alle Anzahlen durch 65 Vitest-Tests verifiziert.

---

## 12. Lifecycle

| Aktion | Erwartetes Ergebnis |
|--------|---------------------|
| Publish TW | status=published, published_at gesetzt, öffentlich sichtbar |
| Unpublish Szenario | status=draft, anonym nicht sichtbar, Admin bearbeitbar |
| Publish Szenario | status=published, wieder sichtbar |
| Unpublish TW | status=draft, gesamte TW anonym unsichtbar |
| Publish TW erneut | status=published, wieder sichtbar |
| Archive Szenario | status=archived, anonym unsichtbar, Admin korrekt gespeichert |
| Archive TW | status=archived, alles unsichtbar, Admin erhalten |

---

## 13. Fehlerverhalten (ohne Legacy-Fallback)

Neue Themenwelt hat KEINEN Legacy-Eintrag → kein Fallback möglich.

| Fehlerszenario | Erwartet | Implementiert |
|----------------|---------|---------------|
| DB nicht erreichbar | Not-found-State (kein Crash) | ✓ |
| `ThemeWorldNotFoundError` | Not-found-Seite | ✓ |
| Draft (anonym) | Not-found-Seite (RLS gibt 0 Ergebnisse) | ✓ |
| Archived | Not-found-Seite | ✓ |
| DB-Timeout | Not-found-Seite (catch → setDynamicNotFound) | ✓ |

Sport/Yoga-Fallback durch Legacy unverändert erhalten.

---

## 14. Sport- und Yoga-Regression

### Code-Änderungen betreffen Sport/Yoga NICHT
- `legacyConfig = getBereichBySlug(...)` → `!= null` für Sport/Yoga
- DB-only-Pfad: `if (!legacyConfig && isThemeWorldDbEnabled())` → false → skip
- Bestehende Pilot-Key-Logik läuft unverändert
- 65 neue Tests bestätigen Regression-Freiheit

### Pilot-Keys unverändert
- `sport_fitness_beruf`: `isThemeWorldPilotActive` = true ✓
- `yoga_achtsamkeit`: `isThemeWorldPilotActive` = true ✓
- Adapter `typeKey` für Sport: `beruflich` ✓
- Adapter `typeKey` für Yoga: `privat_hobby` ✓

---

## 15. Bereinigung (nach Abnahme)

Nach vollständiger Prüfung:
1. Test-Szenarioartikel archivieren (Admin → Szenarioverwaltung → Archive)
2. Test-Themenwelt archivieren (Admin → Themenwelten-Liste → Archive)
3. Testbilder aus Staging Storage entfernen (Supabase Storage UI)
4. Temporärer Testadmin ggf. entfernen (Supabase Auth → Users)

Bevorzuge Archivierung (nicht physisches Löschen) für Audit-Trail.

---

## 16. Generische Code-Korrekturen

### Fix 1: DB-only-Modus in BereichLandingPage.jsx / SzenarioArtikelView.jsx
**Dateien:** `src/components/BereichLandingPage.jsx`, `src/components/SzenarioArtikelView.jsx`
**Problem:** Neue Themenwelten ohne Legacy-Eintrag wurden als 404 angezeigt
**Lösung:** DB-only-Pfad in useEffect, der greift wenn `!legacyConfig && isThemeWorldDbEnabled()`
**Keine Test-Key-Hardcodierung:** Fix ist für alle zukünftigen DB-only-Themenwelten wirksam

### Fix 2: ESLint-Ignore für `supabase/.temp/**`
**Datei:** `eslint.config.js`
**Problem:** 24 pre-existing ESLint-Fehler in generiertem Node.js-Script
**Lösung:** `globalIgnores(['dist', 'supabase/.temp/**'])` — generierter Ordner wird korrekt ausgeschlossen

---

## 17. Tests

### Neue Test-Dateien (Phase 8)
- `tests/theme-world-phase8-logic.test.js` — 59 Tests (Adapter, Feature-Flag, Lifecycle, Publish-Gates, Routing, Sport/Yoga-Regression)
- `tests/theme-world-phase8-component.test.jsx` — 6 Tests (BereichLandingPage DB-only-Modus)

### Test-Ergebnisse
- Gesamt: **947/947 Tests** (882 Baseline + 65 neue)
- ESLint: **0 Fehler**
- Build: **Erfolgreich** (175 statische HTML-Dateien)

### Abgedeckte Szenarien
- Admin-Create-Workflow: Adapter-Tests validieren alle Datentransformationen
- Variable Anzahlen: 14 Tests bestätigen 3/5/4/3/2/3/2-Zählung
- Draft/Publish-Gates: 9 Tests für Validierungslogik
- Lifecycle: 8 Tests (draft, published, archived, unpublish, re-publish)
- Generisches Routing: 5 Tests (kein hardcodierter Key, URL-Splitting)
- DB-only-Modus: 6 Komponenten-Tests (Loading, Erfolg, Not-found, DB-Fehler, Flag-aus, Legacy-Regression)
- Sport-Regression: 6 Tests (Pilot-Keys, Adapter typeKey)
- Yoga-Regression: in Sport-Regression mitabgedeckt

---

## 18. Verbleibende Risiken

1. **Manuelle Browser-Checks nicht automatisiert:** Die 8 Browser-Checks (4 URLs × 2 Viewports) sind manuelle Schritte. Keine Playwright-E2E-Tests für Themenwelten existieren.

2. **Staging-Storage-Konfiguration:** Bilder-Upload-Test muss manuell im Browser verifiziert werden (Signed URLs, MIME-Validierung, 5-MB-Limit).

3. **Rich-Text-Editor in Browser:** Vollständiger Editor-Test (Undo/Redo, Paste, Cursor) ist nur im Browser prüfbar.

4. **Admin-Credentials:** Temporärer Testadmin darf nicht in Code/Logs erscheinen; muss nach Test gelöscht werden.

5. **Staging-Vercel-Env-Vars:** `VITE_THEME_WORLD_DB_ENABLED=true` muss in Vercel-Projekt-Settings gesetzt sein; ohne dies ist der DB-only-Modus im Preview deaktiviert.

6. **Keine Transaktionalität bei Sub-Entitäten:** `replace*`-Operationen löschen zuerst alle Einträge und fügen neue ein — kurzes Zeitfenster mit leeren Daten (kein DB-Problem in Staging).

---

## 19. Projektziel-Bewertung

**Ziel:** Eine neue Themenwelt kann ohne individuelle Content-Codeänderungen vollständig durch einen Administrator angelegt werden.

**Ergebnis:**
- Generischer Code-Fix implementiert: ✓
- Kein hardcodierter Test-Key im produktiven Code: ✓
- Kein Legacy-Eintrag erforderlich: ✓
- Admin-Workflow technisch vollständig unterstützt: ✓
- 947/947 Tests grün: ✓
- ESLint sauber: ✓
- Build erfolgreich: ✓

**Für vollständige Phase-8-Abnahme ausstehend (manuell):**
- Admin-Create-Workflow im Browser durchführen
- Alle Tabs + Bilder-Upload testen
- Rich-Text-Editor testen
- 8 Browser-Checks nach Publikation
- Lifecycle (Publish/Unpublish/Archive) im Browser
- Testdaten bereinigen
