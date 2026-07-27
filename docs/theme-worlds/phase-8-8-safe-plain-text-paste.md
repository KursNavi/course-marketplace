# Phase 8.8 – Sicheres Plain-Text-Einfügen im Szenarioartikel-Editor

## Browserbefund (Phase 8E.2)

Beim manuellen Testen im Control Room wurde festgestellt: Wenn ein Admin-Nutzer Text
in den WYSIWYG-Editor (AdminRichTextEditor) einfügt, der HTML-Tags enthält – z. B.

```
Paste-Test <b>Dieser Text darf nicht fett erscheinen</b>
```

erscheint `"Dieser Text darf nicht fett erscheinen"` tatsächlich **fett formatiert**.
Das `<b>`-Element wurde vom Browser als echtes HTML interpretiert und gerendert.

---

## Root Cause

Der bisherige `handlePaste`-Handler in `AdminRichTextEditor.jsx`:

```javascript
const html = text
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0)
  .map((l) => `<p>${l}</p>`)  // ← unescaped Template-Literal
  .join('');
exec('insertHTML', html || text);  // ← interpretiert HTML
```

Zwei Fehler kombinieren sich:

1. **Kein HTML-Escaping**: `<p>${l}</p>` fügt den Clipboard-Text unverändert als HTML-Fragment zusammen.
2. **`insertHTML` execCommand**: Der Browser interpretiert den übergebenen String als HTML-Markup – Tags werden zu echten DOM-Elementen.

Der Angreifer (oder versehentliche Nutzer) muss lediglich Text mit HTML-Syntax in die Zwischenablage kopieren und einfügen.

---

## Risikoeinstufung

| Aspekt | Bewertung |
|--------|-----------|
| Angriffspfad | Lokaler Admin mit Formularzugang (kein öffentlicher Input) |
| Angriffsvektor | Pastefähiges HTML im Admin-Editor |
| Potenzielle Tags | `<b>`, `<script>`, `<img onerror=...>`, `<a href="javascript:...">` |
| Serverseitiger Schutz | sanitize-html blockiert `<script>`, `<img>`, `javascript:` |
| Lücke | `<b>`, `<strong>`, `<em>`, `<a>` werden vom Sanitizer erlaubt → können via Paste eingeschleust werden |
| CVSS-Analogie | Mittel — kein direkter Remote-Exploit, aber Vertrauenspfad (Admin→Content) wird umgangen |

---

## Warum serverseitiges Sanitizing allein nicht genügt

Der serverseitige Sanitizer mit `sanitize-html` erlaubt bewusst bestimmte Formatierungs-Tags
(`<b>`, `<strong>`, `<em>`, `<a href="https://...">`), weil der Editor strukturiertes HTML
produzieren soll.

Würde ein Admin versehentlich `<b>Haftungsausschluss nicht anwendbar</b>` aus einer
Word-Tabelle einpaste, wäre das Ergebnis fett formatierter Text im veröffentlichten Artikel –
obwohl der Admin "normalen Text" einfügen wollte. Serverseitiges Sanitizing entfernt das `<b>`
nicht, weil es zulässig ist.

Die Verteidigungslinie muss daher **clientseitig** beginnen: Plain-Text-Paste darf niemals
zu HTML-Elementen führen.

---

## Neue Selection-/Range-Logik

### Hilfsfunktion `insertPlainTextAtCaret`

Befindet sich in `src/components/admin/richTextPasteUtils.js` (ausgelagert aus dem
React-Komponentenfile, damit `react-refresh/only-export-components` erfüllt ist).
AdminRichTextEditor importiert sie; Tests importieren sie direkt für Unit-Tests.

```javascript
export function insertPlainTextAtCaret(text) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  range.deleteContents(); // ersetzt markierten Inhalt

  const lines = text.split(/\r?\n/);
  const fragment = document.createDocumentFragment();

  lines.forEach((line, i) => {
    if (i > 0) {
      fragment.appendChild(document.createElement('br'));
    }
    fragment.appendChild(document.createTextNode(line));
  });

  range.insertNode(fragment);

  range.collapse(false); // Caret hinter eingefügten Inhalt
  sel.removeAllRanges();
  sel.addRange(range);
}
```

**Schlüsseleigenschaften:**

- `document.createTextNode(line)` escaped `<`, `>`, `&`, `"`, `'` automatisch – kein HTML-Parsing
- `document.createDocumentFragment()` + `range.insertNode(fragment)` → kein `innerHTML`, kein `execCommand`
- Markierter Inhalt wird via `range.deleteContents()` ersetzt
- Caret wird korrekt positioniert

### Aktualisierter `handlePaste`

```javascript
const handlePaste = (e) => {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') ?? '';
  insertPlainTextAtCaret(text);
  notifyChange();
};
```

- `text/plain` ist die einzige verwendete Clipboard-Quelle
- `text/html` wird nicht gelesen

---

## Verhalten bei mehrzeiligem Text

Zeilenumbrüche werden als `<br>`-Elemente eingefügt (nicht als `<p>`).

**Begründung:** Der Cursor kann sich innerhalb eines bestehenden `<p>` befinden.
Ein `<p>` innerhalb eines `<p>` wäre ungültiges HTML. `<br>` ist in jedem Kontext sicher.

**Beispiel:**

```
Erste Zeile
Zweite Zeile
Dritte Zeile
```

Erzeugt im DOM-Fragment:
```
TextNode("Erste Zeile") + <br> + TextNode("Zweite Zeile") + <br> + TextNode("Dritte Zeile")
```

**Leere Zwischenzeilen** werden erhalten:

```
Erste Zeile

Dritte Zeile
```

Ergibt: `TextNode("Erste Zeile") + <br> + TextNode("") + <br> + TextNode("Dritte Zeile")`

Die leere `TextNode("")` erhält den visuellen Abstand über den `<br>` davor und danach.

**Alter Code** (entfernt) filterte leere Zeilen heraus (`filter((l) => l.length > 0)`),
was Absätze unbemerkt zusammengeklebt hätte.

---

## Tests

Testdatei: `tests/theme-world-phase8-8-safe-paste.test.jsx`

| Nr | Szenario | Assertion |
|----|----------|-----------|
| 1  | `<b>…</b>` als Plain-Text | kein `<b>`- oder `<strong>`-Element im Fragment |
| 2  | text/plain vs text/html | Nur `text/plain` verwendet; `<b>` aus text/html ignoriert |
| 3  | `<script>alert(1)</script>` | kein `script`-Element |
| 4  | `<img src=x onerror=alert(1)>` | kein `img`-Element |
| 5  | `<a href="javascript:…">` | kein `a`-Element |
| 6  | `2 < 3 und 5 > 4` | Text vollständig, nur TextNode, kein Element |
| 7  | `Erste\nZweite\nDritte` | 5 childNodes: 3 TextNodes + 2 `<br>` |
| 7b | CRLF (`\r\n`) | 3 childNodes: 2 TextNodes + 1 `<br>` |
| 8  | Leere Zwischenzeile | 5 childNodes, mittlere TextNode ist `""` |
| 9  | Schweizer Sonderzeichen | `textContent` identisch mit Input |
| 10 | Auswahl ersetzen | `range.deleteContents()` aufgerufen |
| 10b| Cursor gesetzt | `range.collapse(false)` + `sel.addRange(range)` |
| –  | `notifyChange` ausgelöst | `onChange` wird aufgerufen |
| –  | `execCommand insertHTML` NICHT aufgerufen | Kein Rückfall auf alten Pfad |
| –  | `insertPlainTextAtCaret` Direkt-Export | 6 Direkttests |

**Gesamtzahl neue Tests:** 20 (innerhalb dieser Testdatei)

---

## Fokussierte Browser-Nachprüfung (Phase 8E.3)

Folgende manuelle Schritte sind für die Browserprüfung vorgesehen:

1. Control Room → Themenwelt „Test" → Szenario öffnen
2. In den Textbereich klicken
3. Folgenden Text in die Zwischenablage kopieren und einfügen:
   ```
   Paste-Test <b>Dieser Text darf nicht fett erscheinen</b>
   ```
4. **Erwartet:** Text erscheint komplett als normaler Text, kein fett formatiertes Element.
5. Test mit `<script>alert(1)</script>` → kein Alert, Text sichtbar
6. Test mit mehrzeiligem Text (3 Zeilen, leere Zwischenzeile) → korrekte Trennung nach Speichern und Reload
7. Test mit `2 < 3 und 5 > 4` → alle Zeichen korrekt im gespeicherten HTML

---

## Slug-Befund (nicht blockierend, Phase 8E.3-separat)

**Beobachtung:** Wenn der Auto-Slug aktiv ist und der Nutzer versucht, den Slug-Wert
manuell zu ersetzen, muss der gesamte bestehende Slug-Text zuerst markiert oder gelöscht
werden. Ein direktes Eintippen am Cursor fügt neuen Text ein, ohne den alten zu ersetzen.

**Ursache:** `AdminScenarioForm.jsx` deaktiviert den Slug-Auto-Fill erst bei manuellem
Input. Ein einfaches Drücken einer Taste erzeugt keinen Select-All-Effekt.

**Status:** Nicht blockierend — UX-Quirk, kein Datenverlust, keine Sicherheitsrelevanz.

**Kein Fix in Phase 8.8:** `AdminScenarioForm.jsx` bleibt in diesem Commit unverändert.
Ein gezielter UX-Fix kann in einer separaten Phase (z. B. 8.9 oder 9.x) als
`select-all-on-focus`-Erweiterung für das Slug-Feld ergänzt werden.

---

## Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `src/components/admin/AdminRichTextEditor.jsx` | `handlePaste` ersetzt; Import von richTextPasteUtils |
| `src/components/admin/richTextPasteUtils.js` | Neue Utility-Datei mit `insertPlainTextAtCaret` |
| `tests/theme-world-phase8-8-safe-paste.test.jsx` | 21 neue Tests |
| `docs/theme-worlds/phase-8-8-safe-plain-text-paste.md` | Diese Dokumentation |
