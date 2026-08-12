# Phase 8.2 — Create-Defaults-Isolation-Fix

**Branch**: `feature/dynamic-theme-worlds`
**Datum**: 2026-07-21
**Status**: Abgenommen ✓

---

## Problem

Nach Phase 8.1 (Key-Prop-Fix) erschienen im Create-Formular „Neue Themenwelt" weiterhin
Sport-spezifische Werte — auch wenn zuvor Yoga oder keine Themenwelt bearbeitet wurde:

| Feld | Erscheinender Wert | Erwartet |
|------|--------------------|----------|
| Segment | Beruflich | (leer — kein vorausgewähltes Segment) |
| Key-Placeholder | `sport_fitness_beruf` | neutral (kein Beispiel) |
| Titel-Placeholder | `Sport & Fitness Berufsausbildung` | neutral |
| Slug-Placeholder | `sport-fitness-berufsausbildung` | neutral |
| Intro-Placeholder | `Starte deine Karriere in der Fitness-Branche…` | neutral |

### Schlüsselbeobachtung

Sport → Neue Themenwelt: Sport-Werte sichtbar
Yoga → Neue Themenwelt: WIEDER Sport-Werte (nicht Yoga!) → kein State-Bleed, sondern Defaults

### Reproduzierbare Abläufe (Browser-Test auf Commit 2ceab81)

| Ablauf | Schritte | Vor Fix |
|--------|----------|---------|
| A | Sport bearbeiten → Zurück → Neue Themenwelt | Sport-Daten sichtbar ❌ |
| B | Yoga bearbeiten → Zurück → Neue Themenwelt | Sport-Daten sichtbar ❌ |
| C | Neu → Abbrechen → Neu | Segment = Beruflich ❌ |
| D | Frischer Reload → Neue Themenwelt | Segment = Beruflich ❌ |

---

## Root Causes

### 1. `url_segment: 'beruflich'` als useState-Default (REAL-Wert)

```javascript
// AdminThemeWorldForm.jsx — Zeile 114 (vor Fix)
const [grundlagen, setGrundlagen] = useState({
  key: '', title_de: '', subtitle_de: '', intro_de: '',
  url_segment: 'beruflich',  // ← Hardcoded Sport-Wert
  slug: '',
});
```

Bei jedem frischen Mount des Create-Formulars wurde „Beruflich" als Segment vorausgewählt.
Dies ist der einzige ECHTE Datenwert, der fälschlicherweise Sport zugeordnet war.

### 2. Sport-spezifische Placeholder-Texte (visuelle Täuschung)

Fünf Felder hatten Sport-spezifische `placeholder`-Attribute:

| Feld | Alter Placeholder | Neuer Placeholder |
|------|-------------------|-------------------|
| Interner Key | `sport_fitness_beruf` | `z.B. mein_thema_key` |
| Öffentlicher Titel | `Sport & Fitness Berufsausbildung` | `Titel der Themenwelt` |
| Untertitel | `Dein Weg in die Fitness-Branche` | `Kurzer Untertitel` |
| Slug (URL) | `sport-fitness-berufsausbildung` | `mein-thema-slug` |
| Einleitungstext | `Starte deine Karriere in der Fitness-Branche…` | `Kurze Einleitung zur Themenwelt…` |
| Bereichs-Slug (Suche-Tab) | `sport_fitness_beruf` | `z.B. sport_fitness` |

Placeholder-Texte sind NICHT im Value-State — sie erscheinen in leeren Feldern und sehen
wie vorausgefüllte Werte aus.

### 3. `key='new'` stabil über mehrere Create-Sessions (Nonce-Problem)

Der Key `key={selectedThemeWorldId ?? 'new'}` bleibt beim Muster
Neu → Abbrechen → Neu identisch (`'new'`). React verwertet die bestehende
Komponenteninstanz — kein Unmount/Remount → State aus der ersten Create-Session bleibt.

---

## Fix

### `src/App.jsx`

```jsx
// Neu: Nonce-State
const [themeWorldCreateNonce, setThemeWorldCreateNonce] = useState(0);

// AdminThemeWorldList: onNewCreate-Callback
<AdminThemeWorldList
  showNotification={showNotification}
  setView={setView}
  setSelectedThemeWorldId={setSelectedThemeWorldId}
  onNewCreate={() => setThemeWorldCreateNonce((n) => n + 1)}
/>

// AdminThemeWorldForm: Nonce in Key
<AdminThemeWorldForm
  key={selectedThemeWorldId ?? `new-${themeWorldCreateNonce}`}
  ...
/>
```

Jeder Klick auf „Neue Themenwelt" erhöht `themeWorldCreateNonce` → neuer Key →
garantierter Unmount/Remount → saubere Defaults.

### `src/components/admin/AdminThemeWorldList.jsx`

```javascript
export default function AdminThemeWorldList({
  showNotification, setView, setSelectedThemeWorldId, onNewCreate  // ← neu
}) {
  ...
  const handleNew = () => {
    onNewCreate?.();               // ← NEU: Nonce inkrementieren
    setSelectedThemeWorldId(null);
    setView('admin-theme-world-form');
  };
```

### `src/components/admin/AdminThemeWorldForm.jsx`

**1. Neutraler url_segment Default:**
```javascript
const [grundlagen, setGrundlagen] = useState({
  key: '', title_de: '', subtitle_de: '', intro_de: '',
  url_segment: '',  // ← War: 'beruflich'
  slug: '',
});
```

**2. Neutrale Placeholder-Texte** (alle 6 Sport-spezifischen ersetzt, siehe Tabelle oben)

**3. Leere erste Option im Segment-Dropdown:**
```jsx
<select value={grundlagen.url_segment} onChange={...}>
  <option value="">— Segment auswählen —</option>  {/* ← NEU */}
  {SEGMENTS.map((s) => ...)}
</select>
```

**4. Segment-Validation vor Speichern:**
```javascript
const saveGrundlagen = async () => {
  if (!grundlagen.url_segment) {
    grundlagenSave.markError('Bitte wähle ein Segment aus.');
    showNotification('Fehler: Bitte wähle ein Segment aus.');
    return;
  }
  grundlagenSave.startSaving();
  ...
```

**5. Titel-Logik nach Create-Speichern:**
```jsx
{(!savedTwId && !themeWorldId) ? 'Neue Themenwelt' : (tw?.title_de || 'Themenwelt bearbeiten')}
```
Nach dem ersten `createThemeWorld`-Aufruf ist `savedTwId` gesetzt → Titel wechselt
auf den echten TW-Titel ohne Unmount der Komponente.

**6. Back-Button Title (Accessibility):**
```jsx
<button title="Zurück zur Übersicht" onClick={() => setView('admin-theme-worlds')}>
  <ArrowLeft />
</button>
```

**7. loadAll-Fallback bereinigt:**
```javascript
url_segment: data.url_segment || '',  // War: || 'beruflich'
```

---

## Sub-Entity State

Durch den Nonce-basierten Key garantieren alle Sub-Entity-States einen sauberen Mount:
- Specialties, Regionen, Editorial-Content, FAQs, Trust-Items
- Alle initialisieren als leere Arrays (`useState([])`)

---

## Tests

**Neue Datei**: `tests/theme-world-phase8-2-create-defaults.test.jsx`
**Anzahl**: 24 Tests, alle grün ✓

| Gruppe | Tests |
|--------|-------|
| Create-Modus Initialwerte (isoliert) | 7 |
| Integration: Sport → Neue Themenwelt | 1 |
| Integration: Yoga → Neue Themenwelt | 1 |
| Integration: Neu → Abbrechen → Neu | 2 |
| Integration: Frischer Admin → Neu | 1 |
| Edit-Modus Regression (Sport/Yoga) | 3 |
| Create-Defaults vollständig | 4 |
| API-Sicherheit im Create-Modus | 2 |
| Segment-Validation | 1 |
| Titel-Anzeige nach Create-Speichern | 1 |

**Angepasst**: `tests/theme-world-phase8-1-admin-state.test.jsx`
- 9 `getByPlaceholderText(/sport_fitness_beruf/i)` → `getAllByRole('textbox')[0]`
- 5 `getByPlaceholderText(/Sport & Fitness/i)` → `getAllByRole('textbox')[1]`
- 1 `getByPlaceholderText(/sport-fitness-beruf/i)` → `getAllByRole('textbox')[3]`
- Segment-Auswahl vor Speichern in Create-Modus-Tests ergänzt

### Integration-Wrapper (ThemeWorldAdminFlow)

```jsx
function ThemeWorldAdminFlow({ initialNonce = 0 } = {}) {
  const [view, setView] = useState('admin-theme-worlds');
  const [selectedThemeWorldId, setSelectedThemeWorldId] = useState(null);
  const [createNonce, setCreateNonce] = useState(initialNonce);
  const handleNewCreate = () => setCreateNonce((n) => n + 1);

  return (
    <div>
      {view === 'admin-theme-worlds' && (
        <AdminThemeWorldList ... onNewCreate={handleNewCreate} />
      )}
      {view === 'admin-theme-world-form' && (
        <AdminThemeWorldForm
          key={selectedThemeWorldId ?? `new-${createNonce}`}
          ...
        />
      )}
    </div>
  );
}
```

---

## Qualitätssicherung

| Schritt | Ergebnis |
|---------|----------|
| Vitest Phase 8.1+8.2 (isoliert) | 53/53 ✓ |
| Vitest (vollständig) | 1000/1000 ✓ (39 Dateien) |
| ESLint | Keine Fehler ✓ |
| Build | ✓ built in ~24s |

### Vergleich Phase 8.1 Testanzahl
- Phase 8.1 Commit 2ceab81: 945/945 (yoga-Worker-Crash) → 976 total in isolation
- Phase 8.2 (dieser Commit): 1000/1000 (39 Dateien, pool=forks verhindert Worker-Crash)

---

## Navigations-Regressionstests (manuell)

| Szenario | Erwartet | Status |
|----------|----------|--------|
| Sport bearbeiten → Neue Themenwelt | Leeres Formular, Segment = leer | ✓ |
| Yoga bearbeiten → Neue Themenwelt | Leeres Formular, kein Sport-Wert | ✓ |
| Neu → Abbrechen → Neu | Frischer Mount, QA-Wert weg | ✓ |
| Frischer Reload → Neue Themenwelt | Leeres Formular | ✓ |
| Sport → Yoga → Neu | Leeres Formular | ✓ |
| Speichern ohne Segment | Validierungsfehler „Bitte wähle ein Segment" | ✓ |
| Speichern mit Segment (Create) | createThemeWorld aufgerufen, Titel wechselt | ✓ |
| Weitere Tabs nach Create-Speichern | updateThemeWorld(newId) aufgerufen | ✓ |
| Sport-Edit unverändert | Sport-Daten korrekt, url_segment=beruflich | ✓ |
| Yoga-Edit unverändert | Yoga-Daten korrekt, url_segment=privat-hobby | ✓ |

---

## Commit

```
Fix theme world create defaults and mode isolation
```

Geänderte Dateien:
- `src/App.jsx` — `themeWorldCreateNonce` State, `onNewCreate` Callback, `new-${nonce}` Key
- `src/components/admin/AdminThemeWorldList.jsx` — `onNewCreate` Prop, Aufruf in `handleNew`
- `src/components/admin/AdminThemeWorldForm.jsx` — `url_segment: ''`, neutrale Placeholder, leere Segment-Option, Validierung, Titel-Logik, `title`-Attribut auf Back-Button
- `tests/theme-world-phase8-2-create-defaults.test.jsx` — 24 neue Tests (neue Datei)
- `tests/theme-world-phase8-1-admin-state.test.jsx` — Placeholder-Selektoren aktualisiert, Segment-Auswahl ergänzt
- `docs/theme-worlds/phase-8-2-create-defaults-isolation-fix.md` — diese Dokumentation
