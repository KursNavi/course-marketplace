/**
 * Hilfsfunktionen für sicheres Plain-Text-Einfügen im AdminRichTextEditor.
 *
 * Separat aus AdminRichTextEditor.jsx ausgelagert um den
 * react-refresh/only-export-components ESLint-Regel zu erfüllen.
 */

/**
 * Fügt reinen Text sicher über Selection/Range in das aktive contentEditable ein.
 *
 * Verwendet ausschliesslich document.createTextNode() — kein innerHTML,
 * kein insertHTML execCommand. HTML-Sonderzeichen (< > & " ') werden dadurch
 * automatisch als Text behandelt und nie als Markup interpretiert.
 *
 * Zeilenumbrüche werden als <br>-Elemente eingefügt, da Blockelemente (<p>)
 * innerhalb bestehender Absätze zu ungültigem Nesting führen würden.
 *
 * @param {string} text — Rohtext aus clipboardData.getData('text/plain')
 */
export function insertPlainTextAtCaret(text) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  // Markierten Inhalt entfernen (Ersetzen-Semantik)
  range.deleteContents();

  const lines = text.split(/\r?\n/);
  const fragment = document.createDocumentFragment();

  lines.forEach((line, i) => {
    if (i > 0) {
      // Zeilenumbruch als <br> — kein Block-Element, keine Nesting-Probleme
      fragment.appendChild(document.createElement('br'));
    }
    // createTextNode escaped < > & " ' automatisch — kein HTML-Parsing
    fragment.appendChild(document.createTextNode(line));
  });

  range.insertNode(fragment);

  // Caret hinter den eingefügten Inhalt setzen
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
