# Phase 7.6 — Admin Roundtrip Fix

**Branch:** `feature/dynamic-theme-worlds`
**Base commit:** f20adde (Phase 7.5 lint fix)
**Date:** 2026-07-18

---

## 1. Beobachtete Fehler

Bei manueller QA des Admin-Panels (Staging) wurden zwei kritische Probleme gefunden:

### Problem A — Alle Sub-Entitäten-Tabs leer
Beim Öffnen des Yoga-Datensatzes erschienen folgende Tabs als leer:
- **Kursbereiche**: „Noch keine Kursbereiche" — gleichzeitig „Ungespeicherte Änderungen"
- **Regionen**: leer
- **Redaktionell**: leer
- **FAQs**: leer
- **Trust & Hinweise**: leer

Die öffentliche Seite zeigte alle Inhalte korrekt an (Daten in der DB vorhanden).

### Problem B — Bilder & SEO nicht speicherbar
Klick auf „Speichern" im Tab „Bilder & SEO" ergab:
- Toast: „Fehler: Validierungsfehler."
- Inline: „Fehler beim Speichern"

---

## 2. Datenbank-Ausgangsstand (Staging, read-only)

| Theme World | FAQs | Editorial | Specialties | Regions | Trust | Scenarios |
|-------------|------|-----------|-------------|---------|-------|-----------|
| sport_fitness_beruf | 7 | 6 | 8 | 8 | 3 | 8 (alle published) |
| yoga_achtsamkeit | 10 | 6 | 7 | 8 | 3 | 8 (alle published) |

Alle Daten waren intakt in der DB vorhanden. Kein Datenverlust.

---

## 3. Öffentliche Datenquelle

**Dynamisch (DB)** — nicht Legacy.

- `VITE_THEME_WORLD_DB_ENABLED=true`
- `VITE_THEME_WORLD_PILOT_KEYS=sport_fitness_beruf,yoga_achtsamkeit`
- `isThemeWorldEnabled('yoga_achtsamkeit')` → `true`
- `isThemeWorldEnabled('sport_fitness_beruf')` → `true`

Die öffentlichen Seiten luden korrekte Inhalte aus der DB. Der silent Fallback auf Legacy-Config trat nicht auf.

---

## 4. Root Cause: leere Sub-Entitäten-Tabs

### Bug 1 — `getAllSubEntities`: `result.data` immer `undefined`

**Datei:** `src/lib/themeWorldAdminApi.js`

```javascript
// ALT (gebrochen):
export async function getAllSubEntities(themeWorldId) {
  const result = await apiCall('/api/admin-theme-world-sub?action=get-all&...');
  return result.data || {}; // ← result.data ist IMMER undefined!
}
```

Die API (`admin-theme-world-sub.js`) gibt Arrays direkt auf Root-Ebene zurück:
```json
{ "faqs": [...], "editorial_sections": [...], "specialties": [...], ... }
```

Kein `data`-Wrapper. `result.data` war immer `undefined`, daher `subs = {}`.

**Folge:** `setSpecialties(subs.specialties || [])` → `[]`, alle Tabs leer.

### Bug 2 — camelCase/snake_case-Mismatch (sekundär, nach Bug 1 relevant)

Die API liefert snake_case-Keys (`editorial_sections`, `trust_items`), das Form erwartete camelCase (`editorialSections`, `trustItems`):

```javascript
setEditorial(subs.editorialSections || []);  // ← 'editorialSections' nicht in subs
setTrustItems(subs.trustItems || []);        // ← 'trustItems' nicht in subs
```

---

## 5. Root Cause: Dirty-State direkt nach Load

`specialtiesSave.isDirty` war `true` beim ersten Öffnen des Tabs, obwohl kein Nutzer etwas geändert hatte. Ursache: stale State aus einer früheren Navigation oder Session-Zustand.

Die `useSaveState()`-Funktion hat kein `resetDirty` nach erfolgreichem Load aufgerufen. Wenn die Komponente gemountet blieb (z.B. weil sie nur visuell versteckt wurde), persistierte der Dirty-State.

---

## 6. Root Cause: Validierungsfehler bei Bilder & SEO

**Datei:** `api/admin-theme-worlds.js`, update-Action:

```javascript
const validation = validateThemeWorldBase(body);  // ← verlangt IMMER key/title_de/slug etc.
```

`validateThemeWorldBase` definiert `key`, `title_de`, `area_slug`, `db_segment`, `url_segment`, `slug` als Pflichtfelder — auch bei einem Partial-Update.

`saveBilder` schickt aber nur:
```json
{ "hero_image_url": null, "hero_image_alt_de": null, "og_image_url": null, "meta_title": null, "meta_description": null }
```

→ Fehlende Pflichtfelder → Validierung schlägt fehl → „Validierungsfehler."

---

## 7. Fix

### Fix 1 — `getAllSubEntities` normalisiert API-Antwort

```javascript
// src/lib/themeWorldAdminApi.js
export async function getAllSubEntities(themeWorldId) {
  const result = await apiCall(
    `/api/admin-theme-world-sub?action=get-all&themeWorldId=${encodeURIComponent(themeWorldId)}`,
  );
  // API returns arrays at root level (no 'data' wrapper), with snake_case keys.
  return {
    faqs: result.faqs || [],
    editorialSections: result.editorial_sections || [],
    specialties: result.specialties || [],
    regions: result.regions || [],
    trustItems: result.trust_items || [],
  };
}
```

Behebt Bug 1 (result.data) und Bug 2 (camelCase).

### Fix 2 — `validateThemeWorldUpdate` (Partial-Validator)

```javascript
// api/_lib/theme-world-validate.js — neu hinzugefügt
export function validateThemeWorldUpdate(data) {
  // Pflichtfelder nur validieren wenn im Payload vorhanden
  if ('key' in data) requireText(errors, data, 'key', 100);
  if ('title_de' in data) requireText(errors, data, 'title_de', 200);
  // ...
}
```

### Fix 3 — `update`-Action verwendet Partial-Validator

```javascript
// api/admin-theme-worlds.js — update-Action
const validation = validateThemeWorldUpdate(body); // statt validateThemeWorldBase
```

### Fix 4 — Sub-Query-Fehler propagieren (kein stilles `[]`)

```javascript
// api/admin-theme-world-sub.js — get-all action
const subErrors = [
  faqs.error && `faqs: ${faqs.error.message}`,
  editorial.error && `editorial_sections: ${editorial.error.message}`,
  // ...
].filter(Boolean);

if (subErrors.length > 0) {
  return res.status(500).json({
    error: 'Unterdaten konnten nicht vollständig geladen werden.',
    details: subErrors,
  });
}
```

### Fix 5 — `resetDirty()` nach erfolgreichem Load

```javascript
// src/components/admin/AdminThemeWorldForm.jsx — in useSaveState()
const resetDirty = useCallback(() => {
  setState('idle');
  setIsDirty(false);
  setErrorMsg(null);
}, []);

// In loadAll() nach setState-Calls:
grundlagenSave.resetDirty();
bilderSave.resetDirty();
// ... alle 8 Tabs
```

### Fix 6 — Save blockieren bei Lade-Fehler

```javascript
// In saveBilder, saveSuche, saveSub:
if (loadError) return showNotification('Laden fehlgeschlagen — Speichern nicht möglich.');
```

### Fix 7 — Validierungsdetails in Toast-Meldung

```javascript
// src/lib/themeWorldAdminApi.js — getErrorMessage
if (error.details?.length) {
  return `${error.message || defaultMessage}: ${error.details.join('; ')}`;
}
```

---

## 8. Datenverlustschutz

| Szenario | Verhalten vorher | Verhalten jetzt |
|----------|-----------------|-----------------|
| Sub-Query-Fehler beim Laden | 200 + `[]` → Phantomliste | 500 → `loadError` → Formular zeigt Fehlerseite |
| Laden fehlgeschlagen + Speichern | Überschreibt bestehende Daten mit `[]` | Save blockiert: „Laden fehlgeschlagen" |
| Stale Dirty-State nach Navigation | Bleibt persistent | `resetDirty()` nach erfolgreichem Load |
| Bilder-Tab speichern | 400 Validierungsfehler | Partial-Validator erlaubt Tab-spezifische Updates |

---

## 9. Browser-Prüfung

Alle Fixes per Staging-DB-Query (read-only) und Node.js-Logikverifikation bestätigt:

- Yoga: FAQs=10, Specialties=7, Editorial=6, Regions=8, Trust=3 — alle nach Fix geladen ✓
- Sport: FAQs=7, Specialties=8, Editorial=6, Regions=8, Trust=3 — alle nach Fix geladen ✓
- Feature Flag: dynamischer Modus aktiv für beide Theme Worlds ✓
- Partial-Validator: Bilder-Payload ohne key/title_de/slug passiert Validierung ✓
- hero_image_url=null → kein hero_alt erforderlich ✓

---

## 10. Tests

| Suite | Tests | Ergebnis |
|-------|-------|---------|
| `theme-world-admin-roundtrip.test.js` (neu) | 32/32 | ✓ |
| Vitest gesamt | **828/828** | ✓ (+32 vs. Phase 7.5) |
| ESLint geänderte Dateien | 0 Fehler | ✓ |
| `npx vite build` | ✓ | |

### Neue Test-Abdeckung

1. `getAllSubEntities` — Bug bestätigt (OLD: leer) und Fix bestätigt (NEW: korrekte Arrays)
2. camelCase-Normalisierung: `editorial_sections` → `editorialSections`, `trust_items` → `trustItems`
3. `validateThemeWorldUpdate` — Bilder/Suche/Grundlagen-Payloads
4. Sub-Entity-Lade-Fehler → Save blockiert
5. `resetDirty` nach Load
6. `getErrorMessage` mit Details
7. Sport- und Yoga-Parität (gleicher Code-Pfad)

---

## 11. Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `src/lib/themeWorldAdminApi.js` | `getAllSubEntities`: normalisiert result.data-Bug + camelCase; `getErrorMessage`: Details bei 400 |
| `api/_lib/theme-world-validate.js` | Neuer `validateThemeWorldUpdate` (Partial-Validator) |
| `api/admin-theme-worlds.js` | `update`-Action: `validateThemeWorldUpdate` statt `validateThemeWorldBase` |
| `api/admin-theme-world-sub.js` | Sub-Query-Fehler → 500 (kein stilles `[]`) |
| `src/components/admin/AdminThemeWorldForm.jsx` | `resetDirty` in `useSaveState`; `resetDirty` nach `loadAll`; Save-Guard bei `loadError` |
| `tests/theme-world-admin-roundtrip.test.js` | 32 neue Regressionstests |

---

## 12. Verbleibende Risiken

- `yoga_achtsamkeit.published_at = null` (Sport hat `2026-07-17`). Der Import-Script hat `status: 'published'` gesetzt aber `published_at` nicht. Kein funktionaler Impact, aber inkonsistent. **Aktion:** in Phase 8 via Admin korrigieren (Manual edit im Grundlagen-Tab).
- Cookiebot auf Preview-Domain: weiterhin offen (Phase 8 Infrastructure).
- Admin-Panel auf Produktion: noch nicht getestet (Phase 8 Scope).

---

## 13. Entscheidung Phase 8

**Phase 8 darf fortgesetzt werden**, wenn folgende manuelle Browser-Verifikation im Staging-Admin bestätigt wird:

1. Yoga-Datensatz öffnen → alle Tabs zeigen Daten (nicht leer)
2. Tab „Bilder & SEO" → Speichern → kein Validierungsfehler
3. Tab „Kursbereiche" → kein sofortiger Dirty-State
4. Sport-Datensatz → gleiche Prüfung

Der Code ist technisch bereit. Die Verifikation erfolgt durch manuelle QA im Browser.

---

## Produktionssicherheit

- Keine Produktionsänderung
- Kein Push, kein PR
- Nur `feature/dynamic-theme-worlds` modifiziert
- Staging-Daten nur gelesen (keine schreibende Aktion)
