# Phase 8.7 — Editorial List Textarea: Zeilenumbruch-Fix

**Datum:** 2026-07-26
**Branch:** `feature/dynamic-theme-worlds`
**Ausgangsbasis:** `756f785` (Complete predefined searches for dynamic theme worlds)

---

## Browserbefund

Im redaktionellen Tab des Admin-Formulars für Themenwelten war es nicht möglich, mehrere Aufzählungspunkte einzugeben. Beim Drücken von Enter nach einem Punkt wurde der Zeilenumbruch sofort entfernt. Der nächste eingetippte Text wurde direkt an den vorherigen Punkt angehängt.

Erwartetes Verhalten:
```
Punkt 1
Punkt 2
Punkt 3
```

Tatsächliches Verhalten (vor Fix):
```
Punkt 1Punkt 2Punkt 3
```

---

## Root Cause

In `AdminThemeWorldForm.jsx`, Tab „Redaktionell", war die Textarea für `items_de` ein **vollständig kontrolliertes** React-Eingabefeld:

```jsx
value={(item.items_de || []).join('\n')}
onChange={(e) => update({ items_de: e.target.value.split('\n').filter(Boolean) })}
```

### Ablauf des Fehlers

1. User tippt `Punkt 1` → `items_de = ['Punkt 1']`
2. User drückt Enter → Browser sendet `onChange` mit value `'Punkt 1\n'`
3. `.split('\n')` → `['Punkt 1', '']`
4. `.filter(Boolean)` → `['Punkt 1']` (leerer String entfernt)
5. `update({ items_de: ['Punkt 1'] })` → Parent-State ändert sich
6. React rendert die Textarea neu mit `value = 'Punkt 1'` (kein `\n`)
7. Der Zeilenumbruch ist verschwunden; Cursor steht am Ende von „Punkt 1"

Das Problem liegt im `onChange`-Handler: Er konvertiert sofort zum Array und entfernt dabei alle leeren Einträge — einschliesslich des temporär leeren Eintrags, der beim Enter-Drücken entsteht.

---

## Warum kein Rich-Text-Editor nötig ist

Die `items_de`-Liste enthält ausschliesslich **einfache Strings** — keine Formatierung, kein HTML. Das Datenbankmodell (`editorial_sections.items_de`) ist ein `text[]`-Array. Ein Rich-Text-Editor würde:

- HTML in den Array-Einträgen speichern (nicht erlaubt),
- das Datenbankmodell ändern (nicht erlaubt),
- eine unnötige Komplexität einführen.

Die korrekte Lösung ist eine plain-text Textarea mit verzögerter Normalisierung — genau was `ItemsDeTextarea` implementiert.

---

## Neue Eingabelogik — `ItemsDeTextarea`

Die Komponente `ItemsDeTextarea` ersetzt die alte Inline-Textarea.

```jsx
function ItemsDeTextarea({ value, onChange }) {
  const [raw, setRaw] = React.useState(() => (value || []).join('\n'));
  const isFocused = React.useRef(false);

  React.useEffect(() => {
    if (!isFocused.current) {
      setRaw((value || []).join('\n'));
    }
  }, [value]);

  return (
    <textarea
      className="FormInput h-24 resize-none font-mono text-sm"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => {
        isFocused.current = false;
        onChange(raw.split('\n').map((line) => line.trim()).filter(Boolean));
      }}
      placeholder={"Punkt 1\nPunkt 2\nPunkt 3"}
    />
  );
}
```

### Kernprinzip

- **`raw`** ist lokaler `useState`-String — enthält den exakten Textarea-Inhalt inkl. Zeilenumbrüche.
- **`onChange`** (im Parent) wird **nur beim Blur** aufgerufen — nicht bei jedem Tastendruck.
- **`isFocused`** verhindert, dass externe `value`-Prop-Änderungen den Rohtext während der aktiven Eingabe überschreiben.

### Verhalten

| Aktion | Resultat |
|--------|---------|
| Enter drücken | Zeilenumbruch bleibt in Textarea sichtbar |
| Weitertippen nach Enter | Text erscheint auf der neuen Zeile |
| Blur (Tab-Taste / Klick auf anderes Feld) | Normalisierung → Array-Update |
| Admin-Tab wechseln (z.B. → Grundlagen) | Blur feuert → Normalisierung → Werte gespeichert im Parent-State |
| Zurück zum Redaktionell-Tab | Textarea lädt normalisierten Wert aus Parent-State |
| Seite neu laden | items_de aus DB geladen, werden korrekt als `join('\n')` angezeigt |

---

## Normalisierung beim Blur/Speichern

Beim Blur wird folgendes durchgeführt:

```js
raw.split('\n').map((line) => line.trim()).filter(Boolean)
```

| Eingabe (raw) | Ergebnis (Array) |
|---------------|-----------------|
| `"Punkt 1\nPunkt 2\nPunkt 3"` | `['Punkt 1', 'Punkt 2', 'Punkt 3']` |
| `"Punkt 1\n\nPunkt 2"` (Leerzeile) | `['Punkt 1', 'Punkt 2']` |
| `"  Punkt 1  \n  Punkt 2  "` | `['Punkt 1', 'Punkt 2']` |
| `""` (leer) | `[]` |
| `"Einzelpunkt"` | `['Einzelpunkt']` |

---

## Tests

Neue Testdatei: `tests/theme-world-phase8-7-editorial-list-newline-fix.test.jsx`

### Getestete Verhaltensweisen

| Test | Beschreibung |
|------|-------------|
| Enter bleibt während der Eingabe erhalten (4 Tests) | Enter nach Text, Enter zwischen Zeilen, drei Zeilen, trailing Enter |
| Drei Punkte als drei Array-Einträge (4 Tests) | Drei Einträge gespeichert, Leerzeile entfernt, Leerzeichen getrimmt, leeres Array |
| Tabwechsel erhält den Rohtext (3 Tests) | Blur entfernt keinen gültigen Text, Refokus nach Blur, Admin-Tab-Wechsel |
| Initialer Load / Reload (4 Tests) | Drei items_de, leere items_de, einzelner Eintrag, kein Dirty-State nach Laden |
| is_ordered — Aufzählungstyp (3 Tests) | Ungeordnet bleibt false, geordnet bleibt true, Checkbox umschalten |
| Sport-/Yoga-Daten unverändert (3 Tests) | Sport unberührt, Yoga korrekt geladen, Sport nach Yoga |
| Kein Rich-Text-/HTML-Pfad (3 Tests) | Kein rich-text-editor, kein HTML nach Speichern, Array von Strings |
| Abbrechen (1 Test) | Unmount ohne Speichern ruft API nicht auf |

**Gesamt neu:** 25 Tests
**Gesamtsuite nach Fix:** 1159 Tests

---

## Browser-QA nach Fix

Zu prüfen:

1. **Drei Zeilen eingeben:** Cursor nach Enter bleibt auf neuer Zeile
2. **Leerzeile:** Leere Zwischenzeile nach Blur/Speichern entfernt
3. **Laden:** Bestehende Punkte erscheinen nach Reload korrekt zeilenweise
4. **Tab-Wechsel:** Eingaben bleiben nach Admin-Tab-Wechsel erhalten
5. **Abbrechen:** Abbrechen ohne Speichern verwirft Änderungen
6. **Sport-Themenwelt:** Bestehende Daten unverändert
7. **Yoga-Themenwelt:** Bestehende Daten unverändert
8. **is_ordered:** Nummerierte Liste bleibt nummeriert, ungeordnete bleibt ungeordnet
