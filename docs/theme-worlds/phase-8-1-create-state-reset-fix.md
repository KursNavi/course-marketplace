# Phase 8.1 — Create-State-Reset-Fix

**Branch**: `feature/dynamic-theme-worlds`
**Datum**: 2026-07-21
**Status**: Abgenommen ✓

---

## Problem

Nach dem Bearbeiten einer bestehenden Themenwelt (z. B. Sport & Fitness) zeigte das Formular
„Neue Themenwelt erstellen" die Daten der zuvor bearbeiteten Themenwelt an:

- Key: `sport_fitness_beruf`
- Titel: `Sport & Fitness Berufsausbildung`
- Segment: `Beruflich`
- Slug: `sport-fitness-berufsausbildung`

Die Werte wurden **nicht gespeichert** und die bestehenden Themenwelten blieben unverändert — der
Fehler war rein visuell, aber kritisch für die Usability.

### Reproduzierbare Abläufe

| Ablauf | Schritte |
|--------|----------|
| A | Sport bearbeiten → Zurück → Neue Themenwelt → Formular enthält Sport-Daten |
| B | Yoga bearbeiten → Zurück → Neue Themenwelt → Formular enthält Yoga-Daten |
| C | Frischer Reload → Liste → Neue Themenwelt → Formular korrekt leer ✓ |
| D | Direktaufruf `/admin/theme-world/new` → Formular korrekt leer ✓ |

---

## Root Cause

### 1. Fehlender `key`-Prop auf `AdminThemeWorldForm`

In `src/App.jsx` fehlte ein `key`-Prop auf dem `<AdminThemeWorldForm />`-Element.
Ohne `key` kann React eine bestehende Komponenteninstanz wiederverwenden, wenn sich nur die Props
ändern (statt sie unmounten/remounten).

Beim Übergang von Edit-Modus (`themeWorldId = sport-uuid`) zu Create-Modus (`themeWorldId = null`)
wurde die Instanz wiederverwendet — die `useState`-Initializer liefen nicht erneut, Sport-Daten
blieben im State.

### 2. `setSelectedThemeWorldId(created.id)` in `saveGrundlagen`

Nach dem ersten Speichern einer neuen Themenwelt wurde `setSelectedThemeWorldId(created.id)`
aufgerufen. Das änderte den App-State mid-Session und veränderte die `themeWorldId`-Prop der
noch gemounteten Komponente — was bei einem späteren Wechsel zum Create-Modus eine verbleibende
nicht-null `selectedThemeWorldId` hinterließ.

---

## Fix

### `src/App.jsx`

```jsx
{view === 'admin-theme-world-form' && (
  <AdminThemeWorldForm
    key={selectedThemeWorldId ?? 'new'}   // ← NEU
    showNotification={showNotification}
    setView={setView}
    themeWorldId={selectedThemeWorldId}
    setSelectedThemeWorldId={setSelectedThemeWorldId}
    setSelectedScenarioId={setSelectedScenarioId}
  />
)}
```

`key={selectedThemeWorldId ?? 'new'}` garantiert:
- Create-Modus: `key='new'` → frischer Mount, alle useState-Initializer laufen neu
- Edit Sport: `key='<sport-uuid>'` → frischer Mount mit Sport-Daten
- Edit Yoga: `key='<yoga-uuid>'` → frischer Mount mit Yoga-Daten
- Jeder Moduswechsel erzwingt ein Unmount/Remount → kein State-Bleed möglich

### `src/components/admin/AdminThemeWorldForm.jsx` — `saveGrundlagen`

1. **`setSelectedThemeWorldId(created.id)` entfernt** — verhindert mid-Session Key-Änderungen;
   lokaler State `savedTwId` ist für alle Folge-Speichervorgänge ausreichend.

2. **Safety Guard im Create-Pfad**:
   ```javascript
   if (themeWorldId) {
     throw new Error('Interner Fehler: Create-Modus hat unerwartete themeWorldId. Bitte Seite neu laden.');
   }
   ```

3. **Guard für fehlende ID im Update-Pfad**:
   ```javascript
   const id = savedTwId || themeWorldId;
   if (!id) {
     throw new Error('Interner Fehler: Kein ID für Update-Speicherung. Bitte Seite neu laden.');
   }
   ```

4. **Bessere 409-Fehlerbehandlung**:
   ```javascript
   const isConflict = err instanceof ApiError && err.isConflict;
   const msg = isConflict
     ? (err.message || 'Konflikt: Key oder Pfad wird bereits von einer anderen Themenwelt verwendet.')
     : getErrorMessage(err, 'Speichern fehlgeschlagen.');
   ```

5. **`published_at: null`** im `setTw`-Aufruf des Create-Pfads für vollständiges initiales Objekt.

---

## Sub-Entity State

Durch den `key`-Prop-Fix werden alle Sub-Entity-States automatisch zurückgesetzt:
- Specialties, Regionen, Editorial-Content, FAQs, Trust-Items
- Alle initialisieren als leere Arrays (`useState([])`) — beim Remount korrekt

---

## Tests

**Datei**: `tests/theme-world-phase8-1-admin-state.test.jsx`
**Anzahl**: 29 Tests, alle grün ✓

| Gruppe | Tests |
|--------|-------|
| Create-Modus Initialer Zustand | 6 |
| State-Isolation: Create nach Sport-Edit | 3 |
| State-Isolation: Create nach Yoga-Edit | 2 |
| Edit-Modus Grundfunktionalität | 4 |
| Speichern: Create verwendet createThemeWorld | 3 |
| Speichern: Edit verwendet updateThemeWorld | 1 |
| Konflikt-Behandlung 409 | 2 |
| key-Prop-Verhalten | 4 |
| Abbrechen | 1 |
| Regression (Sport/Yoga) | 2 |
| Sicherheit | 1 |

### Wichtige Mocks

- `supabase` — kein Datenbankzugriff in Tests
- `themeWorldAdminApi` — `getThemeWorld`, `getAllSubEntities`, `createThemeWorld`, `updateThemeWorld`, `ApiError`
- `AdminStatusBadge`, `AdminSaveState`, `AdminSeoFields`, `AdminImageField`, `AdminRichTextEditor`

### Bekannte Eigenheit (kein Bug)

Das Grundlagen-Tab rendert zwei „Speichern"-Buttons (`TabHeader` + `TabFooter`).
Tests verwenden daher `getAllByRole('button', { name: /Speichern/i })[0]`.

---

## Qualitätssicherung

| Schritt | Ergebnis |
|---------|----------|
| Vitest (neu) | 29/29 ✓ |
| Vitest (vollständig) | 945/945 ✓ (37 Dateien) |
| ESLint | Keine Fehler ✓ |
| Build | ✓ built in ~13s |

---

## Navigations-Regressionstests (manuell)

| Szenario | Erwartet | Status |
|----------|----------|--------|
| Neue Themenwelt nach Sport-Edit | Leeres Formular | ✓ (key-Fix) |
| Neue Themenwelt nach Yoga-Edit | Leeres Formular | ✓ (key-Fix) |
| Neue → Abbrechen → Sport bearbeiten | Sport-Daten korrekt | ✓ |
| Sport → Yoga → Neu | Leeres Formular | ✓ |
| Grundlagen speichern (Create) | createThemeWorld aufgerufen | ✓ |
| Grundlagen speichern (Edit) | updateThemeWorld aufgerufen | ✓ |
| 409 Konflikt | Fehlermeldung mit Konflikthinweis | ✓ |

---

## Commit

```
Fix new theme world form state isolation
```

Geänderte Dateien:
- `src/App.jsx` — `key={selectedThemeWorldId ?? 'new'}` auf AdminThemeWorldForm
- `src/components/admin/AdminThemeWorldForm.jsx` — saveGrundlagen: kein setSelectedThemeWorldId, Safety Guards, 409-Handling
- `tests/theme-world-phase8-1-admin-state.test.jsx` — 29 neue Tests (neue Datei)
- `docs/theme-worlds/phase-8-1-create-state-reset-fix.md` — diese Dokumentation
