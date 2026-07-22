# Phase 8.4 — OG-Image-Alt-Text-Feld-Fix

**Branch:** `feature/dynamic-theme-worlds`
**Ausgangsbasis:** Commit `c71c004` (Phase 8.3)
**Fix-Commit:** (nach diesem Dokument erstellt)
**Datum:** 2026-07-22

---

## 1. Bug-Beschreibung

Im Tab „Bilder & SEO" der AdminThemeWorldForm war das Feld „Open-Graph-Alt-Text" visuell vorhanden, aber funktional kaputt. Eingaben wurden nicht im Formular-State gespeichert, nicht an die API gesendet und nicht nach Reload angezeigt.

### Symptome
- Eingabe in das OG-Alt-Text-Feld → Wert erscheint kurz, wird aber nicht behalten
- Speichern → `og_image_alt_de` fehlt im API-Payload
- Reload → Feld bleibt leer (war nie gespeichert)
- Öffentlich: kein `og:image:alt` Meta-Tag

---

## 2. Root Cause Analyse — 7 Schichten

### Schicht 1: AdminImageField-Props (Haupt-Bug)

**Datei:** `src/components/admin/AdminThemeWorldForm.jsx`

```jsx
// VOR Fix (Zeile 583–594):
<AdminImageField
  currentUrl={bilder.og_image_url}
  altText=""                    // ← BUG: hardcoded leerer String, ignoriert State
  folder="theme-worlds"
  label="Open-Graph-Bild (Social Media)"
  altRequired={false}
  onImageUploaded={...}
  onAltTextChange={() => {}}    // ← BUG: No-Op — Eingaben werden verworfen
/>
```

Die Komponente `AdminImageField.jsx` selbst ist korrekt implementiert (Prop `altText` + Callback `onAltTextChange`). Der Fehler lag vollständig im Parent-Aufruf.

### Schicht 2: bilder-State (fehlender Schlüssel)

```javascript
// VOR Fix (Zeile 121):
const [bilder, setBilder] = useState({
  hero_image_url: '', hero_image_alt_de: '', og_image_url: '',  // og_image_alt_de fehlte!
  meta_title: '', meta_description: '',
});
```

### Schicht 3: loadAll (fehlende Extraktion)

```javascript
// VOR Fix (Zeile 183):
setBilder({
  hero_image_url: data.hero_image_url || '',
  hero_image_alt_de: data.hero_image_alt_de || '',
  og_image_url: data.og_image_url || '',
  // og_image_alt_de: fehlte!
  meta_title: data.meta_title || '',
  meta_description: data.meta_description || '',
});
```

### Schicht 4: saveBilder (fehlend im Payload)

```javascript
// VOR Fix (Zeile 299):
await updateThemeWorld(id, {
  hero_image_url: bilder.hero_image_url || null,
  hero_image_alt_de: bilder.hero_image_alt_de || null,
  og_image_url: bilder.og_image_url || null,
  // og_image_alt_de: fehlte!
  meta_title: bilder.meta_title || null,
  meta_description: bilder.meta_description || null,
});
```

### Schicht 5: ALLOWED_WRITE_FIELDS (API-Whitelist)

**Datei:** `api/admin-theme-worlds.js`

```javascript
// VOR Fix (Zeile 39):
'hero_image_url', 'hero_image_alt_de', 'og_image_url',
// og_image_alt_de fehlte → wurde von filterWriteFields() herausgefiltert!
```

### Schicht 6: API-Validator

**Datei:** `api/_lib/theme-world-validate.js`

```javascript
// VOR Fix: og_image_alt_de wurde nicht validiert
optionalText(errors, data, 'hero_image_alt_de', 200);
// og_image_alt_de fehlte in validateThemeWorldBase() und validateThemeWorldUpdate()
```

### Schicht 7: Datenbankschema

**Datei:** `supabase/migrations/20260714_create_theme_worlds.sql`

Die ursprüngliche Migration enthielt `hero_image_alt_de TEXT`, aber kein `og_image_alt_de`. Die Spalte existierte nicht in der Datenbank.

---

## 3. Implementierte Fixes

### 3.1 DB-Migration

**Neue Datei:** `supabase/migrations/20260722_add_theme_world_og_image_alt.sql`

```sql
ALTER TABLE theme_worlds
  ADD COLUMN IF NOT EXISTS og_image_alt_de text;
```

Muss auf Staging (omoapbvfligjfznzivyu) ausgeführt werden.

### 3.2 AdminThemeWorldForm.jsx — 4 Stellen

**bilder-State:**
```javascript
const [bilder, setBilder] = useState({
  hero_image_url: '', hero_image_alt_de: '', og_image_url: '', og_image_alt_de: '',  // +
  meta_title: '', meta_description: '',
});
```

**loadAll:**
```javascript
og_image_url: data.og_image_url || '',
og_image_alt_de: data.og_image_alt_de || '',  // +
```

**saveBilder:**
```javascript
og_image_url: bilder.og_image_url || null,
og_image_alt_de: bilder.og_image_alt_de || null,  // +
```

**AdminImageField-Props:**
```jsx
<AdminImageField
  altText={bilder.og_image_alt_de}           // vorher: ""
  onAltTextChange={(alt) => {                  // vorher: () => {}
    setBilder((p) => ({ ...p, og_image_alt_de: alt }));
    bilderSave.markDirty();
  }}
/>
```

### 3.3 api/admin-theme-worlds.js

```javascript
'hero_image_url', 'hero_image_alt_de', 'og_image_url', 'og_image_alt_de',  // +
```

### 3.4 api/_lib/theme-world-validate.js — 2 Stellen

In `validateThemeWorldBase()` und `validateThemeWorldUpdate()`:
```javascript
optionalText(errors, data, 'hero_image_alt_de', 200);
optionalText(errors, data, 'og_image_alt_de', 200);  // +
```

### 3.5 src/lib/themeWorldAdapter.js — 2 Stellen

In `adaptThemeWorldToConfig()`:
```javascript
ogImageUrl: themeWorld.og_image_url || null,
ogImageAlt: themeWorld.og_image_alt_de || '',  // +
```

In `adaptToLegacyBereichConfig()`:
```javascript
heroImage: themeWorld.hero_image_url || null,
heroImageAlt: themeWorld.hero_image_alt_de || '',  // +
ogImageUrl: themeWorld.og_image_url || null,
ogImageAlt: themeWorld.og_image_alt_de || '',      // +
```

### 3.6 src/components/BereichLandingPage.jsx — Public SEO

```javascript
// VOR Fix:
'og:image': `${BASE_URL}/og-default.png`,

// NACH Fix:
const ogImageUrl = config.ogImageUrl || `${BASE_URL}/og-default.png`;
// + og:image nutzt Theme-World-OG-Bild wenn vorhanden

// NEU: og:image:alt
const ogAltText = config.ogImageAlt || config.heroImageAlt || '';
if (ogAltText) {
  // og:image:alt Meta-Tag setzen
}
```

---

## 4. Verhalten nach Fix

| Anforderung | Vor Fix | Nach Fix |
|-------------|---------|----------|
| Eingaben annehmen | ✗ (no-op) | ✓ |
| Wert im State behalten | ✗ (State fehlte) | ✓ |
| Speichern | ✗ (Feld fehlte im Payload + Whitelist) | ✓ |
| Nach Reload erscheinen | ✗ (Spalte fehlte in DB) | ✓ (nach Migration) |
| `og:image:alt` öffentlich | ✗ (kein Tag) | ✓ |

---

## 5. Warum og_image_alt_de NICHT Pflicht ist

Im Gegensatz zu `hero_image_alt_de` (Pflicht wenn `hero_image_url` gesetzt) ist `og_image_alt_de` **optional** — auch wenn `og_image_url` gesetzt ist. Begründung:
- OG-Bilder sind Social-Media-Previews, kein zugänglichkeitspflichtiger Inhalt im WCAG-Sinne
- `AdminImageField` erhält `altRequired={false}`
- Keine Pflicht-Regel im API-Validator

---

## 6. Testergebnisse

### Phase-8.4-Tests (neu)

```
36/36 passed
tests/theme-world-phase8-4-og-image-alt.test.jsx
```

Abgedeckte Test-Kategorien:
- bilder-State — OG Alt im Initialzustand (3 Tests)
- loadAll — og_image_alt_de aus DB laden (4 Tests)
- Eingabe annehmen und State aktualisieren (3 Tests)
- saveBilder — og_image_alt_de im Payload (3 Tests)
- API ALLOWED_WRITE_FIELDS (2 Tests)
- API-Validator og_image_alt_de Längenprüfung (6 Tests)
- ThemeWorld-Adapter ogImageAlt (5 Tests)
- DB-Migration (1 Test)
- Edit-Regression (3 Tests)
- API-Validator Konsistenz (6 Tests)

### Vollständige Suite

```
1073/1073 passed
41 Testdateien
kein Worker-Crash, kein unhandled error
```

Ausgangsstand: 1037/1037 (40 Dateien)
Zuwachs: +36 Tests, +1 Datei

### ESLint

```
Keine Fehler oder Warnungen
```

### Build

```
✓ built
175 static HTML files generated
```

---

## 7. Verbleibende Schritte (Browser-QA)

1. Migration auf Staging ausführen: `ALTER TABLE theme_worlds ADD COLUMN IF NOT EXISTS og_image_alt_de text;`
2. Browser-Test mit `test_kreativ_gestalten`:
   - Tab Bilder & SEO → OG-Alt-Text-Feld eingeben
   - Speichern → Reload → Feld zeigt gespeicherten Wert
   - Öffentliche Seite → `<meta property="og:image:alt">` im `<head>` prüfen

---

## 8. Betroffene Dateien (Summary)

| Datei | Art |
|-------|-----|
| `supabase/migrations/20260722_add_theme_world_og_image_alt.sql` | NEU |
| `src/components/admin/AdminThemeWorldForm.jsx` | 4 Stellen geändert |
| `api/admin-theme-worlds.js` | ALLOWED_WRITE_FIELDS +1 |
| `api/_lib/theme-world-validate.js` | 2 optionalText-Aufrufe hinzugefügt |
| `src/lib/themeWorldAdapter.js` | ogImageAlt in 2 Adapter-Funktionen |
| `src/components/BereichLandingPage.jsx` | og:image + og:image:alt Public-SEO |
| `tests/theme-world-phase8-4-og-image-alt.test.jsx` | NEU, 36 Tests |
