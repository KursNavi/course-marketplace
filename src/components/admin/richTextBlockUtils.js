/**
 * Hilfsfunktionen für redaktionelle Artikel-Bausteine im AdminRichTextEditor.
 *
 * Reine DOM-Operationen — kein React, kein direktes innerHTML mit unsanitiertem Input.
 *
 * Unterstützte Bausteine (erkannt anhand CSS-Klassen bzw. table-Element):
 *   info-box     → blaue Informationsbox
 *   tip-box      → grüne Tipp-Box
 *   warning-box  → gelbe Hinweis-/Warnungsbox
 *   checklist    → Checkliste mit Häkchen (optisch, keine input[type=checkbox])
 *   cta-box      → Kurs-Box / Handlungsaufforderung (kein Button im gespeicherten HTML)
 *   table        → semantische HTML-Tabelle (table-Element, keine Zusatzklasse)
 *
 * Kein data-Attribut zur Kennzeichnung — Erkennung nur über Klassen / Elementtyp.
 * Editor-Beschriftungen landen nicht im gespeicherten HTML.
 *
 * Alle verändernden Funktionen liefern ein einheitliches Ergebnisobjekt
 * `{ success: boolean, message?: string }`. Der Aufrufer darf onChange nur
 * auslösen, wenn `success === true` — damit meldet der Editor keine Änderung,
 * wenn gar keine stattgefunden hat.
 */

// ---------------------------------------------------------------------------
// Typdefinitionen (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {'info-box'|'tip-box'|'warning-box'|'checklist'|'cta-box'|'table'|null} BlockType
 */

/**
 * @typedef {{ success: boolean, message?: string }} BlockResult
 */

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Bekannte Spezialbausteine als geordnete Klassen-Liste */
export const BLOCK_CLASSES = ['info-box', 'tip-box', 'warning-box', 'checklist', 'cta-box'];

/** Menschenlesbare Bezeichnungen für die Benutzeroberfläche */
export const BLOCK_LABELS = {
  'info-box':    'Info-Box',
  'tip-box':     'Tipp-Box',
  'warning-box': 'Hinweis / Warnung',
  'checklist':   'Checkliste',
  'cta-box':     'Kurs-Box',
  'table':       'Tabelle',
};

/** Zentrale, verständliche Meldungstexte für abgelehnte Aktionen */
export const BLOCK_MESSAGES = {
  noEditor:      'Kein Editor-Bereich verfügbar.',
  noSelection:   'Bitte zuerst in den Baustein klicken.',
  outside:       'Die Auswahl liegt ausserhalb des Editors.',
  multiSection:  'Die Auswahl erstreckt sich über mehrere Abschnitte.',
  staleBlock:    'Die Auswahl ist nicht mehr gültig. Bitte erneut in den Baustein klicken.',
  nested:        'Ein Baustein kann nicht innerhalb eines anderen Bausteins eingefügt werden.',
  notInTable:    'Der Cursor befindet sich nicht in einer Tabelle.',
  notInCell:     'Der Cursor befindet sich nicht in einer Tabellenzelle.',
  multiCell:     'Die Auswahl umfasst mehrere Zellen. Bitte den Cursor in genau eine Zelle setzen.',
  headerRow:     'Die Kopfzeile kann über «Kopfzeile ausschalten» entfernt werden.',
  lastRow:       'Die letzte Tabellenzeile kann nicht gelöscht werden.',
  lastCol:       'Die letzte Tabellenspalte kann nicht gelöscht werden.',
  confirmRow:    'Diese Tabellenzeile enthält Inhalt. Wirklich löschen?',
  confirmCol:    'Diese Tabellenspalte enthält Inhalt. Wirklich löschen?',
  cancelled:     'Aktion abgebrochen — es wurde nichts verändert.',
  noTable:       'Kein Tabellen-Baustein ausgewählt.',
  noHeaderRow:   'Die Tabelle enthält keine Zeile für eine Kopfzeile.',
  mergedCells:   'Diese Tabelle enthält verbundene Zellen. '
                 + 'Zeilen und Spalten können hier nicht sicher bearbeitet werden.',
};

/** Trenner zwischen Zellinhalten einer Zeile bei der Umwandlung in Text */
export const CELL_SEPARATOR = ' — ';

/**
 * Blockelemente, deren Inhalt beim Umwandeln in den Absatz aufgelöst wird.
 * Enthält alle vom Sanitizer erlaubten Blockelemente, die als Zellinhalt
 * vorkommen können und deren Kinder gültiger Absatzinhalt sind.
 */
const DISSOLVED_BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'BLOCKQUOTE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH',
  'FIGCAPTION',
]);

/**
 * Blockelemente, die als eigenständige Geschwister erhalten bleiben müssen.
 * In einem Absatz wären sie ungültiges HTML (`<p><pre>…</pre></p>`) — beim
 * erneuten Parsen bricht der Browser den Absatz auf und die Struktur stimmt
 * nicht mehr mit der Serialisierung überein.
 *
 * pre  — Auflösen zerstört die bedeutungstragende Formatierung.
 * figure — Auflösen zerstört den Bezug zwischen Bild und figcaption.
 * hr   — leeres Element, beim Auflösen ginge es ersatzlos verloren.
 */
const STANDALONE_BLOCK_TAGS = new Set(['PRE', 'FIGURE', 'HR']);

// ---------------------------------------------------------------------------
// Baustein-Erkennung
// ---------------------------------------------------------------------------

/**
 * Findet den nächsten umschliessenden Spezial-Bausteinknoten ausgehend von einem
 * DOM-Knoten innerhalb des Editors. Gibt null zurück für normalen Text.
 *
 * @param {Node|null} node    — aktueller DOM-Knoten (z.B. anchorNode der Selection)
 * @param {Element} editorEl  — das contentEditable-Root-Element
 * @returns {Element|null}    — das Bausteincontainer-Element oder null
 */
export function findBlockContainer(node, editorEl) {
  if (!node || !editorEl) return null;
  let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (el && el !== editorEl) {
    if (el.tagName === 'TABLE') return el;
    for (const cls of BLOCK_CLASSES) {
      if (el.classList && el.classList.contains(cls)) return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Ermittelt den Baustein-Typ eines Container-Elements.
 *
 * @param {Element|null} container
 * @returns {BlockType}
 */
export function getBlockType(container) {
  if (!container) return null;
  if (container.tagName === 'TABLE') return 'table';
  for (const cls of BLOCK_CLASSES) {
    if (container.classList && container.classList.contains(cls)) return cls;
  }
  return null;
}

/**
 * Gibt den Baustein-Typ für den aktuellen Caret-/Selektionskontext zurück.
 * Gibt null zurück für normalen Text, für eine Auswahl über mehrere Abschnitte
 * und für eine Selektion ausserhalb des Editors.
 *
 * @param {Element} editorEl
 * @returns {BlockType}
 */
export function getCurrentBlockType(editorEl) {
  return resolveSelectionContext(editorEl).blockType;
}

/**
 * Wertet die aktuelle Selektion aus — immer frisch aus `window.getSelection()`
 * und dem übergebenen Editor-Element. Es wird bewusst keine DOM-Referenz
 * zwischengespeichert, damit keine verwaisten Container weiterverwendet werden.
 *
 * Es werden **beide** Enden der Auswahl geprüft (anchorNode und focusNode):
 * liegen sie in unterschiedlichen Bausteinen, gilt die Auswahl als
 * abschnittsübergreifend und es wird kein Container geliefert.
 *
 * @param {Element|null} editorEl
 * @returns {{ inEditor: boolean, multiple: boolean, container: Element|null,
 *             blockType: BlockType, anchorNode: Node|null, focusNode: Node|null }}
 */
export function resolveSelectionContext(editorEl) {
  const empty = {
    inEditor: false, multiple: false, container: null,
    blockType: null, anchorNode: null, focusNode: null,
  };
  if (!editorEl) return empty;

  const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return empty;

  const anchorNode = sel.anchorNode || null;
  const focusNode = sel.focusNode || anchorNode;
  if (!anchorNode) return empty;

  // Selektion ausserhalb des Editors deaktiviert sämtliche Baustein-Aktionen
  if (!editorEl.contains(anchorNode)) return empty;
  if (focusNode && !editorEl.contains(focusNode)) return empty;

  const anchorContainer = findBlockContainer(anchorNode, editorEl);
  const focusContainer = findBlockContainer(focusNode, editorEl);

  if (anchorContainer !== focusContainer) {
    return {
      inEditor: true, multiple: true, container: null,
      blockType: null, anchorNode, focusNode,
    };
  }

  return {
    inEditor: true,
    multiple: false,
    container: anchorContainer,
    blockType: getBlockType(anchorContainer),
    anchorNode,
    focusNode,
  };
}

// ---------------------------------------------------------------------------
// Baustein einfügen
// ---------------------------------------------------------------------------

/**
 * Standard-HTML-Inhalt für neue Bausteine.
 * Kein Button in cta-box (wird vom öffentlichen Renderer ergänzt).
 *
 * @param {BlockType} type
 * @returns {string} Innen-HTML des neuen Containers
 */
function defaultBlockContent(type) {
  switch (type) {
    case 'info-box':
      return '<h3>Information</h3><p>Inhalt der Informationsbox.</p>';
    case 'tip-box':
      return '<h3>Tipp</h3><p>Inhalt der Tipp-Box.</p>';
    case 'warning-box':
      return '<h3>Hinweis</h3><p>Inhalt des Hinweises.</p>';
    case 'checklist':
      return '<h3>Checkliste</h3><ul><li>Eintrag 1</li><li>Eintrag 2</li></ul>';
    case 'cta-box':
      return '<h3>Jetzt Kurs finden</h3><p>Beschreibungstext für die Kurs-Box.</p>';
    case 'table':
      return null; // Tabelle wird separat erstellt
    default:
      return '<p>Neuer Inhalt.</p>';
  }
}

/**
 * Erstellt ein neues Tabellen-Element mit einer Kopfzeile und zwei Datenzeilen.
 *
 * @param {number} [cols=3]
 * @param {number} [rows=2]
 * @returns {HTMLTableElement}
 */
function createTableElement(cols = 3, rows = 2) {
  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th');
    th.textContent = `Spalte ${c + 1}`;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    tbody.appendChild(createRow(cols, 'td'));
  }
  table.appendChild(tbody);
  return table;
}

/**
 * Fügt einen neuen Baustein in den Editor ein.
 *
 * Verhindert Verschachtelung: Wenn der Caret sich bereits in einem Baustein
 * befindet, wird der Baustein nicht eingefügt und eine Fehlermeldung
 * zurückgegeben. Dasselbe gilt für eine Auswahl über mehrere Abschnitte.
 *
 * Der Baustein wird nach dem aktuellen Block-Container des Carets eingefügt,
 * oder am Ende des Editors wenn kein Block-Kontext vorhanden ist.
 *
 * @param {BlockType} type
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function insertBlock(type, editorEl) {
  if (!editorEl) return { success: false, message: BLOCK_MESSAGES.noEditor };

  const ctx = resolveSelectionContext(editorEl);

  if (ctx.multiple) {
    return { success: false, message: BLOCK_MESSAGES.multiSection };
  }
  if (ctx.container) {
    return { success: false, message: BLOCK_MESSAGES.nested };
  }

  // Einfügeposition: nach dem aktuellen Top-Level-Block
  let insertAfter = null;
  if (ctx.inEditor && ctx.anchorNode) {
    let node = ctx.anchorNode;
    while (node && node.parentElement && node.parentElement !== editorEl) {
      node = node.parentElement;
    }
    insertAfter = node && node !== editorEl && node.parentElement === editorEl ? node : null;
  }

  let newEl;
  if (type === 'table') {
    newEl = createTableElement();
  } else {
    newEl = document.createElement('div');
    newEl.className = type;
    newEl.innerHTML = defaultBlockContent(type);
  }

  if (insertAfter && insertAfter.nextSibling) {
    editorEl.insertBefore(newEl, insertAfter.nextSibling);
  } else {
    editorEl.appendChild(newEl);
  }

  if (!editorEl.contains(newEl)) {
    return { success: false, message: 'Baustein konnte nicht eingefügt werden.' };
  }

  // Caret in neuen Baustein setzen
  try {
    const range = document.createRange();
    const firstText = newEl.querySelector('h3, p, td, th');
    if (firstText) {
      range.setStart(firstText, 0);
      range.collapse(true);
      const sel = window.getSelection();
      if (sel && typeof sel.removeAllRanges === 'function') {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  } catch (_) {
    // Caret-Setzen ist optional — kein Fehler für den User
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Baustein-Hülle entfernen (Inhalt bleibt erhalten)
// ---------------------------------------------------------------------------

/**
 * Entfernt nur die Hülle eines Bausteins und belässt alle Kindelemente direkt
 * im Editor. Reihenfolge und Struktur bleiben unverändert.
 *
 * Tabellen sind ausdrücklich ausgeschlossen: ein generisches Entkleiden würde
 * thead/tbody/tr/td ohne umschliessendes table-Element im Editor zurücklassen.
 * Für Tabellen ist ausschliesslich `tableToText()` zuständig.
 *
 * @param {Element} container — das Bausteincontainer-Element
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function unwrapBlock(container, editorEl) {
  if (!container || !editorEl || !editorEl.contains(container)) {
    return { success: false, message: BLOCK_MESSAGES.staleBlock };
  }
  if (container.tagName === 'TABLE') {
    return {
      success: false,
      message: 'Tabellen werden über «Tabelle in Text umwandeln» umgewandelt.',
    };
  }

  const fragment = document.createDocumentFragment();
  while (container.firstChild) {
    fragment.appendChild(container.firstChild);
  }
  container.parentNode.replaceChild(fragment, container);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Baustein vollständig löschen
// ---------------------------------------------------------------------------

/**
 * Löscht den Baustein und seinen gesamten Inhalt.
 * Die Sicherheitsabfrage verantwortet der Aufrufer (Editor-Komponente).
 *
 * @param {Element} container
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function deleteBlock(container, editorEl) {
  if (!container || !editorEl || !editorEl.contains(container)) {
    return { success: false, message: BLOCK_MESSAGES.staleBlock };
  }
  container.remove();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tabellen: Grundlagen
// ---------------------------------------------------------------------------

/**
 * Alle Zeilen einer Tabelle in Dokumentreihenfolge (thead, tbody und direkte tr).
 * Zeilen verschachtelter Tabellen werden ausgeschlossen.
 *
 * @param {HTMLTableElement} table
 * @returns {HTMLTableRowElement[]}
 */
function getAllRows(table) {
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
}

/**
 * Zellen einer Zeile (nur direkte td/th-Kinder — robust auch bei ungewöhnlichem DOM).
 *
 * @param {HTMLTableRowElement} row
 * @returns {HTMLTableCellElement[]}
 */
function getRowCells(row) {
  if (!row) return [];
  return Array.from(row.children).filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
}

/**
 * Ist die Zeile Teil einer Kopfzeile (thead)?
 *
 * @param {HTMLTableRowElement} row
 * @returns {boolean}
 */
function isHeaderRow(row) {
  return !!(row && row.closest && row.closest('thead'));
}

/**
 * Tatsächliche maximale Spaltenzahl über alle Zeilen — Grundlage für
 * versatzfreies Einfügen und Löschen bei unregelmässigen Tabellen.
 *
 * @param {HTMLTableRowElement[]} rows
 * @returns {number}
 */
function getMaxCols(rows) {
  return rows.reduce((max, row) => Math.max(max, getRowCells(row).length), 0);
}

/**
 * Passender Zell-Tag für eine Zeile: th in der Kopfzeile bzw. in reinen th-Zeilen.
 *
 * @param {HTMLTableRowElement} row
 * @returns {'td'|'th'}
 */
function rowCellTag(row) {
  if (isHeaderRow(row)) return 'th';
  const cells = getRowCells(row);
  if (cells.length > 0 && cells.every((c) => c.tagName === 'TH')) return 'th';
  return 'td';
}

/**
 * Erstellt ein neues TR-Element mit der angegebenen Anzahl leerer Zellen.
 *
 * @param {number} cols
 * @param {'td'|'th'} [tag='td']
 * @returns {HTMLTableRowElement}
 */
function createRow(cols, tag = 'td') {
  const tr = document.createElement('tr');
  for (let i = 0; i < Math.max(1, cols); i++) {
    tr.appendChild(document.createElement(tag));
  }
  return tr;
}

/**
 * Ergänzt eine zu kurze Zeile mit leeren Zellen, damit kein Spaltenversatz entsteht.
 *
 * @param {HTMLTableRowElement} row
 * @param {number} cols
 * @returns {boolean} true wenn Zellen ergänzt wurden
 */
function padRow(row, cols) {
  const tag = rowCellTag(row);
  let cells = getRowCells(row);
  let changed = false;
  while (cells.length < cols) {
    row.appendChild(document.createElement(tag));
    cells = getRowCells(row);
    changed = true;
  }
  return changed;
}

/**
 * Fügt in einer Zeile an logischer Position eine leere Zelle ein.
 *
 * @param {HTMLTableRowElement} row
 * @param {number} index
 */
function insertCellAt(row, index) {
  const cell = document.createElement(rowCellTag(row));
  const cells = getRowCells(row);
  if (index >= cells.length) {
    row.appendChild(cell);
  } else {
    row.insertBefore(cell, cells[index]);
  }
}

/**
 * Vorhandenes tbody oder ein neu angehängtes tbody.
 *
 * @param {HTMLTableElement} table
 * @returns {HTMLTableSectionElement}
 */
function ensureTbody(table) {
  const existing = Array.from(table.children).find((c) => c.tagName === 'TBODY');
  if (existing) return existing;
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  return tbody;
}

/**
 * Enthält die Zelle schützenswerten Inhalt?
 *
 * Berücksichtigt neben Text auch sichtbare Elemente ohne eigenen Text:
 * Links, Bilder, Trennlinien, vorformatierte Blöcke und Abbildungen.
 *
 * @param {Element|null} cell
 * @returns {boolean}
 */
export function cellHasContent(cell) {
  if (!cell) return false;
  const text = (cell.textContent || '').replace(/[\s\u00a0\u200b]+/g, '');
  if (text.length > 0) return true;
  return !!cell.querySelector('a, img, hr, pre, figure');
}

/**
 * Enthält mindestens eine Zelle der Zeile Inhalt?
 *
 * @param {HTMLTableRowElement|null} row
 * @returns {boolean}
 */
export function rowHasContent(row) {
  return getRowCells(row).some(cellHasContent);
}

/**
 * Liest colspan/rowspan robust aus.
 *
 * `rowspan="0"` bedeutet laut HTML-Spezifikation „bis zum Ende des Abschnitts"
 * und ist damit ebenfalls eine Verbindung über mehrere Zeilen.
 *
 * @param {HTMLTableCellElement} cell
 * @param {'colspan'|'rowspan'} name
 * @returns {number}
 */
function spanCount(cell, name) {
  const raw = cell.getAttribute ? cell.getAttribute(name) : null;
  if (raw === null || raw === undefined) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 1;
  if (parsed === 0) return name === 'rowspan' ? Number.POSITIVE_INFINITY : 1;
  return parsed;
}

/**
 * Enthält die Tabelle verbundene Zellen (colspan/rowspan grösser als 1)?
 *
 * Die Produktspezifikation sieht keine Bearbeitung verbundener Zellen vor.
 * Der Sanitizer lässt colspan/rowspan aber grundsätzlich durch, deshalb müssen
 * Zeilen- und Spaltenoperationen solche Tabellen sicher ablehnen: die
 * Positionsberechnung über die Zellanzahl wäre dort nachweislich falsch.
 *
 * Zellen verschachtelter Tabellen bleiben unberücksichtigt.
 *
 * @param {HTMLTableElement|null} table
 * @returns {boolean}
 */
export function tableHasMergedCells(table) {
  if (!table || table.tagName !== 'TABLE') return false;
  return Array.from(table.querySelectorAll('td, th'))
    .filter((cell) => cell.closest('table') === table)
    .some((cell) => spanCount(cell, 'colspan') > 1 || spanCount(cell, 'rowspan') > 1);
}

/**
 * Sicherheitsabfrage — standardmässig window.confirm, in Tests injizierbar.
 *
 * @param {{confirm?: function}} options
 * @param {string} message
 * @returns {boolean}
 */
function askConfirm(options, message) {
  const fn = (options && options.confirm)
    || (typeof window !== 'undefined' ? window.confirm : null);
  if (typeof fn !== 'function') return false;
  return fn(message) === true;
}

/**
 * Findet die nächste umschliessende Zelle innerhalb einer Grenze.
 *
 * @param {Node|null} node
 * @param {Element} boundary
 * @returns {HTMLTableCellElement|null}
 */
function findCell(node, boundary) {
  if (!node) return null;
  let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (el && el !== boundary.parentElement) {
    if (el.tagName === 'TD' || el.tagName === 'TH') return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * Ermittelt Tabelle, Zeile und Zelle frisch aus der aktuellen Selektion.
 * Liefert einen Fehlergrund, wenn keine eindeutige Zelle bestimmbar ist.
 *
 * @param {Element} editorEl
 * @returns {{ ok: boolean, message?: string, table?: HTMLTableElement,
 *             row?: HTMLTableRowElement, cell?: HTMLTableCellElement }}
 */
function resolveTableContext(editorEl) {
  if (!editorEl) return { ok: false, message: BLOCK_MESSAGES.noEditor };

  const ctx = resolveSelectionContext(editorEl);
  if (!ctx.inEditor) return { ok: false, message: BLOCK_MESSAGES.outside };
  if (ctx.multiple) return { ok: false, message: BLOCK_MESSAGES.multiSection };
  if (!ctx.container || ctx.container.tagName !== 'TABLE') {
    return { ok: false, message: BLOCK_MESSAGES.notInTable };
  }

  const table = ctx.container;
  const anchorCell = findCell(ctx.anchorNode, table);
  if (!anchorCell) return { ok: false, message: BLOCK_MESSAGES.notInCell };

  const focusCell = findCell(ctx.focusNode, table);
  if (focusCell && focusCell !== anchorCell) {
    return { ok: false, message: BLOCK_MESSAGES.multiCell };
  }

  const row = anchorCell.parentElement && anchorCell.parentElement.tagName === 'TR'
    ? anchorCell.parentElement
    : null;
  if (!row) return { ok: false, message: BLOCK_MESSAGES.notInCell };

  return { ok: true, table, row, cell: anchorCell };
}

/**
 * Wie `resolveTableContext`, lehnt aber Tabellen mit verbundenen Zellen ab.
 *
 * Zeilen- und Spaltenoperationen bestimmen ihre Position über die Zellanzahl
 * einer Zeile. Bei colspan/rowspan stimmt diese Rechnung nicht mehr mit dem
 * sichtbaren Raster überein — die Aktion würde Inhalte verschieben oder
 * löschen. Deshalb wird sie ohne jede DOM-Änderung abgelehnt.
 *
 * @param {Element} editorEl
 * @returns {{ ok: boolean, message?: string, table?: HTMLTableElement,
 *             row?: HTMLTableRowElement, cell?: HTMLTableCellElement }}
 */
function resolveEditableTableContext(editorEl) {
  const ctx = resolveTableContext(editorEl);
  if (!ctx.ok) return ctx;
  if (tableHasMergedCells(ctx.table)) {
    return { ok: false, message: BLOCK_MESSAGES.mergedCells };
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Tabellen: Zeilen
// ---------------------------------------------------------------------------

/**
 * Fügt eine leere Zeile ein. Steht der Cursor in der Kopfzeile, entsteht keine
 * zweite Kopfzeile — die neue Datenzeile wird an den Anfang des tbody gesetzt.
 *
 * @param {Element} editorEl
 * @param {'above'|'below'} position
 * @returns {BlockResult}
 */
function insertTableRow(editorEl, position) {
  const ctx = resolveEditableTableContext(editorEl);
  if (!ctx.ok) return { success: false, message: ctx.message };

  const rows = getAllRows(ctx.table);
  const newRow = createRow(getMaxCols(rows), 'td');

  if (isHeaderRow(ctx.row)) {
    const tbody = ensureTbody(ctx.table);
    tbody.insertBefore(newRow, tbody.firstChild);
    return { success: true };
  }

  const parent = ctx.row.parentNode;
  if (!parent) return { success: false, message: BLOCK_MESSAGES.staleBlock };

  if (position === 'above') {
    parent.insertBefore(newRow, ctx.row);
  } else {
    parent.insertBefore(newRow, ctx.row.nextSibling);
  }
  return { success: true };
}

/**
 * Fügt eine Zeile oberhalb der aktuellen Zeile ein.
 *
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function tableInsertRowAbove(editorEl) {
  return insertTableRow(editorEl, 'above');
}

/**
 * Fügt eine Zeile unterhalb der aktuellen Zeile ein.
 *
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function tableInsertRowBelow(editorEl) {
  return insertTableRow(editorEl, 'below');
}

/**
 * Löscht die aktuelle Zeile.
 *
 * Schutzregeln:
 *   - Kopfzeilen (thead) werden nicht gelöscht.
 *   - Die letzte Datenzeile bleibt erhalten.
 *   - Gefüllte Zeilen erfordern eine Sicherheitsabfrage.
 *
 * @param {Element} editorEl
 * @param {{confirm?: function}} [options]
 * @returns {BlockResult}
 */
export function tableDeleteRow(editorEl, options = {}) {
  const ctx = resolveEditableTableContext(editorEl);
  if (!ctx.ok) return { success: false, message: ctx.message };

  if (isHeaderRow(ctx.row)) {
    return { success: false, message: BLOCK_MESSAGES.headerRow };
  }

  const dataRows = getAllRows(ctx.table).filter((r) => !isHeaderRow(r));
  if (dataRows.length <= 1) {
    return { success: false, message: BLOCK_MESSAGES.lastRow };
  }

  if (rowHasContent(ctx.row) && !askConfirm(options, BLOCK_MESSAGES.confirmRow)) {
    return { success: false, message: BLOCK_MESSAGES.cancelled };
  }

  const parent = ctx.row.parentNode;
  ctx.row.remove();
  // Kein leerer tbody-Rest
  if (parent && parent.tagName === 'TBODY' && getAllRows(ctx.table).filter(
    (r) => r.parentNode === parent).length === 0) {
    parent.remove();
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tabellen: Spalten
// ---------------------------------------------------------------------------

/**
 * Fügt eine Spalte ein. Unregelmässige Zeilen werden vorher mit leeren Zellen
 * auf die tatsächliche maximale Spaltenzahl ergänzt, damit kein Versatz entsteht.
 *
 * @param {Element} editorEl
 * @param {'left'|'right'} side
 * @returns {BlockResult}
 */
function insertTableColumn(editorEl, side) {
  const ctx = resolveEditableTableContext(editorEl);
  if (!ctx.ok) return { success: false, message: ctx.message };

  const rows = getAllRows(ctx.table);
  const maxCols = getMaxCols(rows);
  const idx = getRowCells(ctx.row).indexOf(ctx.cell);
  if (idx < 0) return { success: false, message: BLOCK_MESSAGES.notInCell };

  const target = side === 'left' ? idx : idx + 1;
  rows.forEach((row) => {
    padRow(row, maxCols);
    insertCellAt(row, target);
  });
  return { success: true };
}

/**
 * Fügt eine Spalte links von der aktuellen Spalte ein.
 *
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function tableInsertColLeft(editorEl) {
  return insertTableColumn(editorEl, 'left');
}

/**
 * Fügt eine Spalte rechts von der aktuellen Spalte ein.
 *
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function tableInsertColRight(editorEl) {
  return insertTableColumn(editorEl, 'right');
}

/**
 * Löscht die aktuelle Spalte.
 *
 * Schutzregeln:
 *   - Die letzte Spalte bleibt erhalten.
 *   - Enthält eine betroffene Zelle Inhalt (inkl. Kopfzelle), erfolgt eine
 *     Sicherheitsabfrage.
 *
 * @param {Element} editorEl
 * @param {{confirm?: function}} [options]
 * @returns {BlockResult}
 */
export function tableDeleteCol(editorEl, options = {}) {
  const ctx = resolveEditableTableContext(editorEl);
  if (!ctx.ok) return { success: false, message: ctx.message };

  const rows = getAllRows(ctx.table);
  const maxCols = getMaxCols(rows);
  if (maxCols <= 1) return { success: false, message: BLOCK_MESSAGES.lastCol };

  const idx = getRowCells(ctx.row).indexOf(ctx.cell);
  if (idx < 0) return { success: false, message: BLOCK_MESSAGES.notInCell };

  const affected = rows.map((row) => getRowCells(row)[idx]).filter(Boolean);
  if (affected.some(cellHasContent) && !askConfirm(options, BLOCK_MESSAGES.confirmCol)) {
    return { success: false, message: BLOCK_MESSAGES.cancelled };
  }

  rows.forEach((row) => {
    padRow(row, maxCols);
    const cell = getRowCells(row)[idx];
    if (cell) cell.remove();
  });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tabellen: Kopfzeile
// ---------------------------------------------------------------------------

/**
 * Erstellt eine Zelle des Zieltyps und übernimmt alle Kindknoten verlustfrei.
 * Übertragen werden nur die Struktur-Attribute colspan/rowspan/class.
 *
 * @param {HTMLTableCellElement} cell
 * @param {'td'|'th'} tagName
 * @returns {HTMLTableCellElement}
 */
function convertCell(cell, tagName) {
  const next = document.createElement(tagName);
  ['colspan', 'rowspan', 'class'].forEach((name) => {
    if (cell.hasAttribute(name)) next.setAttribute(name, cell.getAttribute(name));
  });
  while (cell.firstChild) next.appendChild(cell.firstChild);
  cell.replaceWith(next);
  return next;
}

/**
 * Schaltet die Kopfzeile ein oder aus — verlustfrei und ohne leere Reste.
 *
 * Aus: th → td, Zeile wandert an den Anfang des tbody, thead wird entfernt.
 * Ein: erste Datenzeile → thead mit th-Zellen.
 *
 * @param {HTMLTableElement} table
 * @returns {BlockResult}
 */
export function tableToggleHeader(table) {
  if (!table || table.tagName !== 'TABLE') {
    return { success: false, message: BLOCK_MESSAGES.noTable };
  }
  // Verbundene Zellen: eine Zeile zwischen thead und tbody zu verschieben würde
  // ein rowspan über die Abschnittsgrenze hinweg zurücklassen — nicht sicher.
  if (tableHasMergedCells(table)) {
    return { success: false, message: BLOCK_MESSAGES.mergedCells };
  }

  const thead = Array.from(table.children).find((c) => c.tagName === 'THEAD') || null;
  const headerRow = thead ? getAllRows(table).find((r) => r.parentNode === thead) : null;

  if (headerRow) {
    // Kopfzeile ausschalten
    getRowCells(headerRow).forEach((cell) => {
      if (cell.tagName === 'TH') convertCell(cell, 'td');
    });
    const tbody = ensureTbody(table);
    tbody.insertBefore(headerRow, tbody.firstChild);
    thead.remove();
    return { success: true };
  }

  // Leeres thead ist ein inkonsistenter Rest — entfernen und Kopfzeile neu bilden
  if (thead) thead.remove();

  const rows = getAllRows(table);
  const firstRow = rows[0];
  if (!firstRow) return { success: false, message: BLOCK_MESSAGES.noHeaderRow };

  const parent = firstRow.parentNode;
  getRowCells(firstRow).forEach((cell) => {
    if (cell.tagName === 'TD') convertCell(cell, 'th');
  });

  const newThead = document.createElement('thead');
  newThead.appendChild(firstRow);
  table.insertBefore(newThead, table.firstChild);

  // Leer gewordenen tbody-Rest entfernen
  if (parent && parent.tagName === 'TBODY'
      && getAllRows(table).filter((r) => r.parentNode === parent).length === 0) {
    parent.remove();
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tabellen: Umwandlung in normalen Text
// ---------------------------------------------------------------------------

/**
 * Sammelstelle für umgewandelte Zellinhalte, die ausschliesslich gültiges
 * HTML erzeugt.
 *
 * Inline-Inhalte landen im laufenden Absatz. Blockelemente, die in einem
 * Absatz ungültig wären (pre, figure, hr), werden als Geschwister neben den
 * Absatz gesetzt; danach beginnt ein neuer Absatz. Trenner werden nur
 * materialisiert, wenn tatsächlich Inhalt davor und danach steht — sonst
 * entstünden Absätze, die nur aus einem Trennzeichen bestehen.
 *
 * @param {DocumentFragment|Element} target
 */
function createTextSink(target) {
  let paragraph = null;
  let pendingGap = '';

  const closeParagraph = () => {
    if (paragraph) {
      if (cellHasContent(paragraph)) target.appendChild(paragraph);
      paragraph = null;
    }
    pendingGap = '';
  };

  return {
    /** Inline-Knoten (Text, a, strong, img, …) in den laufenden Absatz */
    inline(node) {
      if (!paragraph) paragraph = document.createElement('p');
      // Ein einfacher Wort-Abstand entfällt, wenn bereits Leerraum davorsteht;
      // der Zell-Trenner wird dagegen immer gesetzt.
      const redundant = pendingGap === ' ' && /\s$/.test(paragraph.textContent || '');
      if (pendingGap && paragraph.lastChild && !redundant) {
        paragraph.appendChild(document.createTextNode(pendingGap));
      }
      pendingGap = '';
      paragraph.appendChild(node);
    },
    /** Trenner vormerken — der stärkere Zell-Trenner gewinnt */
    gap(value) {
      if (pendingGap !== CELL_SEPARATOR) pendingGap = value;
    },
    /** Blockelement als gültiges Geschwisterelement ablegen */
    block(node) {
      closeParagraph();
      target.appendChild(node);
    },
    close: closeParagraph,
  };
}

/**
 * Übergibt einen Knoten an die Sammelstelle und behandelt dabei Blockelemente:
 * auflösbare werden in ihre Kinder zerlegt, eigenständige bleiben als Block
 * erhalten. So entsteht nie eine ungültige Verschachtelung wie p-in-p oder
 * pre-in-p.
 *
 * @param {ReturnType<createTextSink>} sink
 * @param {Node} node
 */
function emitNode(sink, node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (STANDALONE_BLOCK_TAGS.has(node.tagName)) {
      sink.block(node);
      return;
    }
    if (DISSOLVED_BLOCK_TAGS.has(node.tagName)) {
      const children = Array.from(node.childNodes);
      if (children.length > 0) sink.gap(' ');
      children.forEach((child) => emitNode(sink, child));
      return;
    }
  }
  sink.inline(node);
}

/**
 * Überträgt den Inhalt einer Zelle in die Sammelstelle.
 * Es werden ausschliesslich bestehende DOM-Knoten verschoben bzw. geklont —
 * niemals wird HTML aus Benutzereingaben als Zeichenkette erzeugt.
 * Links und erlaubte Inline-Formatierungen bleiben dadurch erhalten.
 *
 * @param {ReturnType<createTextSink>} sink
 * @param {HTMLTableCellElement} cell
 * @param {boolean} [clone=false]
 */
function emitCellContent(sink, cell, clone = false) {
  Array.from(cell.childNodes)
    .map((node) => (clone ? node.cloneNode(true) : node))
    .forEach((node) => emitNode(sink, node));
}

/**
 * Gibt mehrere Zellen einer Zeile als einen Absatz aus (neutraler Trenner).
 *
 * @param {ReturnType<createTextSink>} sink
 * @param {HTMLTableCellElement[]} cells
 * @param {boolean} [clone=false]
 */
function emitRow(sink, cells, clone = false) {
  cells.forEach((cell, i) => {
    if (i > 0) sink.gap(CELL_SEPARATOR);
    emitCellContent(sink, cell, clone);
  });
  sink.close();
}

/**
 * Bestimmt die Kopfzeile einer Tabelle: die thead-Zeile, ersatzweise eine
 * erste Zeile, die ausschliesslich aus th-Zellen besteht.
 *
 * @param {HTMLTableRowElement[]} rows
 * @returns {HTMLTableRowElement|null}
 */
function findHeaderRow(rows) {
  const inThead = rows.find(isHeaderRow);
  if (inThead) return inThead;
  const first = rows[0];
  if (!first) return null;
  const cells = getRowCells(first);
  if (cells.length > 0 && cells.every((c) => c.tagName === 'TH')) return first;
  return null;
}

/**
 * Wandelt eine Tabelle verlustfrei in normalen Text um.
 *
 * Mit Kopfzeile: jede gefüllte Datenzelle wird zu einem eigenen Absatz
 * „Spaltenüberschrift: Zellinhalt". Der Überschriften-Inhalt wird dabei als
 * DOM geklont, der Zellinhalt verschoben — Links, strong/em und andere
 * erlaubte Inline-Formatierungen bleiben vollständig erhalten.
 *
 * Ohne Kopfzeile: jede Zeile wird zu einem Absatz, die Zellinhalte bleiben in
 * ihrer Reihenfolge und werden mit „ — " getrennt.
 *
 * Mit verbundenen Zellen (colspan/rowspan): keine Zuordnung zu Spalten-
 * überschriften — eine Zuordnung über den Spaltenindex wäre dort nachweislich
 * falsch. Stattdessen greift die einfache zeilenweise Umwandlung in
 * DOM-Reihenfolge. Es geht kein sichtbarer Inhalt verloren.
 *
 * Kopfzellen, die in keiner Datenzelle als Präfix vorkommen (z.B. bei fehlenden
 * Datenzellen oder leeren Spalten), werden zusätzlich als eigener Absatz
 * ausgegeben. Nach der Umwandlung bleibt kein table/thead/tbody/tr/th/td übrig.
 *
 * @param {HTMLTableElement} table
 * @param {Element} editorEl
 * @returns {BlockResult}
 */
export function tableToText(table, editorEl) {
  if (!table || table.tagName !== 'TABLE' || !editorEl || !editorEl.contains(table)) {
    return { success: false, message: BLOCK_MESSAGES.noTable };
  }

  const rows = getAllRows(table);
  const headerRow = tableHasMergedCells(table) ? null : findHeaderRow(rows);
  const headerCells = headerRow ? getRowCells(headerRow) : [];
  const dataRows = rows.filter((row) => row !== headerRow);

  const fragment = document.createDocumentFragment();
  const sink = createTextSink(fragment);
  const headerUsed = headerCells.map(() => false);

  if (headerCells.length > 0 && dataRows.length > 0) {
    dataRows.forEach((row) => {
      getRowCells(row).forEach((cell, colIdx) => {
        if (!cellHasContent(cell)) return;
        const headerCell = headerCells[colIdx];
        if (headerCell && cellHasContent(headerCell)) {
          emitCellContent(sink, headerCell, true);
          sink.inline(document.createTextNode(': '));
          headerUsed[colIdx] = true;
        }
        emitCellContent(sink, cell);
        sink.close();
      });
    });

    // Kopfzellen ohne jede zugehörige gefüllte Datenzelle gehen sonst verloren
    const unused = headerCells.filter((cell, i) => !headerUsed[i] && cellHasContent(cell));
    if (unused.length > 0) {
      const leading = document.createDocumentFragment();
      emitRow(createTextSink(leading), unused);
      fragment.insertBefore(leading, fragment.firstChild);
    }
  } else {
    // Keine Kopfzeile, keine Datenzeilen oder verbundene Zellen:
    // jede Zeile wird ein Absatz in DOM-Reihenfolge
    const allRows = headerRow ? [headerRow, ...dataRows] : dataRows;
    allRows.forEach((row) => emitRow(sink, getRowCells(row).filter(cellHasContent)));
  }

  if (fragment.childNodes.length === 0) {
    fragment.appendChild(document.createElement('p'));
  }

  table.parentNode.replaceChild(fragment, table);
  return { success: true };
}
