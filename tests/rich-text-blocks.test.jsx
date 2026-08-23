/**
 * Tests für redaktionelle Artikel-Bausteine im AdminRichTextEditor.
 *
 * Geprüft wird nicht nur die isolierte Hilfsfunktion, sondern auch die
 * tatsächliche Verbindung zur Benutzeroberfläche (Aktionsleiste, Meldungen,
 * onChange-Verhalten).
 *
 * Abgedeckte Pflichtszenarien:
 *   1  Tabellen-Aktionsleiste zeigt „Tabelle in Text umwandeln"
 *   2  Der Tabellen-Button ruft tableToText auf und niemals unwrapBlock(table)
 *   3  Tabelle → Text → Serialisierung → erneutes Parsen ist verlustfrei
 *   4  Tabelle ohne thead
 *   5  Tabelle ohne tbody
 *   6  Tabelle mit leerem tbody
 *   7  Tabelle nur mit Kopfzeile
 *   8  Tabelle mit nur einer Zeile und einer Spalte
 *   9  Tabelle mit unterschiedlich vielen Zellen pro Zeile
 *  10  Tabelle mit leeren Zellen
 *  11  Tabelle mit Links
 *  12  Tabelle mit strong-/em-Inhalten
 *  13  Zeile mit Inhalt: Abbrechen verhindert Löschung und onChange
 *  14  Zeile mit Inhalt: Bestätigen löscht und löst genau einmal onChange aus
 *  15  Spalte mit Inhalt: Abbrechen verhindert Löschung und onChange
 *  16  Spalte mit Inhalt: Bestätigen löscht und löst genau einmal onChange aus
 *  17  Leere Zeile / Spalte wird ohne Bestätigung gelöscht
 *  18  thead-Zeile kann nicht über „Zeile löschen" gelöscht werden
 *  19  „Kopfzeile ausschalten" erhält alle Inhalte und entfernt leeres thead
 *  20  BlockActions werden gerendert und bedient
 *  21  „Baustein löschen": Abbrechen erhält Baustein, kein onChange
 *  22  „Baustein löschen": Bestätigen löscht, genau ein onChange
 *  23  Mehrere gleiche Bausteine: exakt zwei nach zwei gültigen Einfügungen
 *  24  Verschachtelungsversuch: keine Einfügung, sichtbare Fehlermeldung
 *  25  Editierbereich trägt prose-ratgeber
 *  26  Fokus-Hervorhebung liegt ausserhalb des contentEditable
 *  27  Externer value-Wechsel hinterlässt keine veraltete Bausteinaktion
 *  28  No-Op-Tabellenaktionen lösen kein onChange aus
 *  29  Auswahl über mehrere Abschnitte deaktiviert destruktive Aktionen
 *  30  Selektion ausserhalb des Editors deaktiviert Aktionen
 *  31  Blosse Initialisierung löst kein onChange aus
 *  32  Bestehende Paste-, Fett-, Kursiv-, Listen- und Linkfunktionen bleiben grün
 *  33  Artikelwechsel: No-Op, Eingabe danach, Parent-Echo, mehrere Wechsel
 *  34  Tabellen mit colspan/rowspan: Zeilen-/Spaltenaktionen sicher abgelehnt
 *  35  Tabelle → Text erzeugt auch mit Blockelementen gültiges HTML
 *  36  Fokus-Overlay: Listener bei Layoutänderungen und Cleanup beim Unmount
 *  37  Link-Einfügung ohne ungeescapten HTML-String
 *  38  No-Op-Aktionen aller Art lösen kein onChange aus
 *
 * Zusätzlich: Baustein-Erkennung, Einfügen, Checkliste, Kurs-Box, Tabellen-Ops.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';

// Die Baustein-Hilfsfunktionen werden mit durchreichenden Spionen umhüllt,
// damit geprüft werden kann, welche Funktion die Aktionsleiste tatsächlich ruft.
vi.mock('../src/components/admin/richTextBlockUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    tableToText: vi.fn((...args) => actual.tableToText(...args)),
    unwrapBlock: vi.fn((...args) => actual.unwrapBlock(...args)),
    deleteBlock: vi.fn((...args) => actual.deleteBlock(...args)),
  };
});

import {
  findBlockContainer,
  getBlockType,
  getCurrentBlockType,
  resolveSelectionContext,
  insertBlock,
  unwrapBlock,
  deleteBlock,
  cellHasContent,
  rowHasContent,
  tableToggleHeader,
  tableToText,
  tableInsertRowAbove,
  tableInsertRowBelow,
  tableDeleteRow,
  tableDeleteRowAt,
  tableInsertColLeft,
  tableInsertColRight,
  tableDeleteCol,
  tableDeleteColAt,
  tableHasMergedCells,
  BLOCK_LABELS,
  BLOCK_MESSAGES,
} from '../src/components/admin/richTextBlockUtils';

// ---------------------------------------------------------------------------
// Mock-Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.execCommand = vi.fn().mockReturnValue(true);
  document.queryCommandState = vi.fn().mockReturnValue(false);
  document.queryCommandValue = vi.fn().mockReturnValue('');
  window.confirm = vi.fn().mockReturnValue(true);
  clearSelection();
  tableToText.mockClear();
  unwrapBlock.mockClear();
  deleteBlock.mockClear();
});

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-scratch]').forEach((el) => el.remove());
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Erstes Textknoten-Kind (oder der Knoten selbst, z.B. bei leeren Zellen) */
function textNodeIn(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  return walker.nextNode() || node;
}

/**
 * Setzt eine simulierte Selektion; Anker und Fokus dürfen unterschiedlich sein.
 *
 * `insertNode` fügt den Knoten tatsächlich in das DOM ein — wie eine echte
 * Range. Nur dadurch lässt sich prüfen, ob Aktionen das Editor-HTML wirklich
 * verändern (Grundlage für „kein onChange ohne Änderung").
 */
function setSelection(anchor, focus = anchor) {
  const anchorNode = textNodeIn(anchor);
  const focusNode = textNodeIn(focus);
  const host = anchorNode && anchorNode.nodeType === Node.TEXT_NODE
    ? anchorNode.parentNode
    : anchorNode;
  const range = {
    deleteContents: vi.fn(),
    insertNode: vi.fn((node) => { if (host) host.appendChild(node); }),
    collapse: vi.fn(),
    cloneRange: vi.fn(() => ({ collapse: vi.fn() })),
  };
  window.getSelection = vi.fn(() => ({
    rangeCount: 1,
    isCollapsed: anchorNode === focusNode,
    anchorNode,
    focusNode,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
    getRangeAt: vi.fn(() => range),
  }));
  return range;
}

/** Entfernt jede Selektion */
function clearSelection() {
  window.getSelection = vi.fn(() => ({
    rangeCount: 0,
    isCollapsed: true,
    anchorNode: null,
    focusNode: null,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
  }));
}

/** Rendert den Editor und liefert Editor-Element sowie onChange-Spion */
function renderEditor(value = '', onChange = vi.fn(), id = 'test-editor') {
  const utils = render(<AdminRichTextEditor value={value} onChange={onChange} id={id} />);
  return { editor: screen.getByTestId(id), onChange, rerender: utils.rerender, id };
}

/** Setzt den Caret in einen Knoten und meldet die Änderung an den Editor */
function focusBlock(editor, node, focusNode) {
  setSelection(node, focusNode);
  fireEvent.mouseUp(editor);
}

/** Klick auf einen Toolbar-/Aktions-Button (ToolBtn reagiert auf mouseDown) */
function clickBtn(testId) {
  fireEvent.mouseDown(screen.getByTestId(testId), { button: 0 });
}

/**
 * Bestätigt die Rückfrage in der Editoroberfläche.
 *
 * Destruktive Aktionen öffnen keinen nativen Dialog mehr, sondern eine
 * Bestätigungsfläche im Editor. Erst deren Schalter führt die Aktion aus.
 */
function acceptConfirm() {
  fireEvent.click(screen.getByTestId('block-confirm-accept'));
}

/** Bricht die Rückfrage in der Editoroberfläche ab */
function cancelConfirm() {
  fireEvent.click(screen.getByTestId('block-confirm-cancel'));
}

/** Ist gerade eine Rückfrage sichtbar? */
function confirmVisible() {
  return screen.queryByTestId('block-confirm') !== null;
}

function openInsertMenu() {
  clickBtn('btn-insert-block');
}

function clickInsertType(type) {
  openInsertMenu();
  fireEvent.click(screen.getByTestId(`insert-${type}`));
}

/** Erstellt ein Editor-DOM-Element (nicht React) für Unit-Tests */
function makeEditorDiv(innerHTML = '') {
  const div = document.createElement('div');
  div.setAttribute('contenteditable', 'true');
  div.setAttribute('data-test-scratch', 'true');
  div.innerHTML = innerHTML;
  document.body.appendChild(div);
  return div;
}

/** Wandelt eine Tabelle über die Hilfsfunktion um und liefert die Absätze */
function convertTable(html) {
  const editorEl = makeEditorDiv(html);
  const table = editorEl.querySelector('table');
  const result = tableToText(table, editorEl);
  return { editorEl, result, paragraphs: Array.from(editorEl.querySelectorAll('p')) };
}

/** Prüft, dass keinerlei Tabellenreste im Element verblieben sind */
function expectNoTableRemnants(el) {
  expect(el.querySelector('table')).toBeNull();
  expect(el.querySelector('thead')).toBeNull();
  expect(el.querySelector('tbody')).toBeNull();
  expect(el.querySelector('tr')).toBeNull();
  expect(el.querySelector('th')).toBeNull();
  expect(el.querySelector('td')).toBeNull();
}

const TABLE_HTML =
  '<table>' +
  '<thead><tr><th>Qualifikation</th><th>Monatslohn</th></tr></thead>' +
  '<tbody>' +
  '<tr><td>Eidg. Fachausweis</td><td>CHF 4600</td></tr>' +
  '<tr><td>Diplom</td><td>CHF 5200</td></tr>' +
  '</tbody></table>';

/** Tabelle mit verbundener Kopfzelle (colspan) */
const COLSPAN_TABLE_HTML =
  '<table>' +
  '<thead><tr><th colspan="2">Übersicht Lohn</th></tr></thead>' +
  '<tbody>' +
  '<tr><td>Eidg. Fachausweis</td><td>CHF 4600</td></tr>' +
  '<tr><td>Diplom</td><td>CHF 5200</td></tr>' +
  '</tbody></table>';

/** Tabelle mit über zwei Zeilen verbundener Zelle (rowspan) */
const ROWSPAN_TABLE_HTML =
  '<table><tbody>' +
  '<tr><td rowspan="2">Grundstufe</td><td>Modul A</td></tr>' +
  '<tr><td>Modul B</td></tr>' +
  '</tbody></table>';

/**
 * Führt eine Aktion aus, die nachweislich keine DOM-Änderung bewirkt.
 * execCommand ist im Test ein reiner Spion — der Editor-Inhalt bleibt gleich.
 */
function performNoOpAction(editor) {
  const before = editor.innerHTML;
  fireEvent.mouseDown(screen.getByTitle(/Fett/i), { button: 0 });
  expect(editor.innerHTML).toBe(before);
}

/** Serialisiert das Element und parst es erneut */
function reparse(el) {
  const clone = document.createElement('div');
  clone.innerHTML = el.innerHTML;
  return clone;
}

/**
 * Prüft, dass die Serialisierung gültiges HTML ist: erneutes Parsen darf die
 * Struktur nicht verändern (`<p><pre>…</pre></p>` würde aufgebrochen).
 */
function expectStableSerialization(el) {
  expect(reparse(el).innerHTML).toBe(el.innerHTML);
}

/** Kein Absatz darf ein Blockelement enthalten */
function expectNoBlockInsideParagraph(el) {
  Array.from(el.querySelectorAll('p')).forEach((p) => {
    expect(p.querySelector(
      'p, div, section, article, pre, figure, figcaption, hr, ul, ol, li,'
      + ' blockquote, table, h1, h2, h3, h4, h5, h6'
    )).toBeNull();
  });
}

/** Öffnet das Link-Panel, füllt es aus und bestätigt mit Enter */
function insertLinkViaPanel({ mode = 'external', text = '', url }) {
  const buttonTitle = mode === 'internal' ? /Interner Link/i : 'Externer Link';
  const urlPlaceholder = mode === 'internal' ? '/search?q=yoga' : 'https://...';
  fireEvent.mouseDown(screen.getByTitle(buttonTitle), { button: 0 });
  fireEvent.change(screen.getByPlaceholderText('Link-Text (optional)'), {
    target: { value: text },
  });
  const urlInput = screen.getByPlaceholderText(urlPlaceholder);
  fireEvent.change(urlInput, { target: { value: url } });
  fireEvent.keyDown(urlInput, { key: 'Enter' });
}

// ===========================================================================
// 1 + 2 + 20: Tabellen-Aktionsleiste und ihre Verdrahtung
// ===========================================================================

describe('1/2/20 – Tabellen-Aktionsleiste ist korrekt verdrahtet', () => {
  it('zeigt die Aktionsleiste mit „Tabelle in Text umwandeln"', () => {
    const { editor } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));

    const bar = screen.getByTestId('block-actions');
    expect(bar).toBeTruthy();
    const btn = screen.getByTestId('btn-table-to-text');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Tabelle in Text umwandeln');
  });

  it('blendet den generischen „In Text umwandeln"-Button für Tabellen aus', () => {
    const { editor } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));

    expect(screen.queryByTestId('btn-unwrap')).toBeNull();
  });

  it('ruft tableToText auf und niemals unwrapBlock', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));

    clickBtn('btn-table-to-text');
    expect(tableToText).not.toHaveBeenCalled();
    acceptConfirm();

    expect(tableToText).toHaveBeenCalledTimes(1);
    expect(unwrapBlock).not.toHaveBeenCalled();
    expectNoTableRemnants(editor);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('unwrapBlock verweigert Tabellen auch bei direktem Aufruf', () => {
    const editorEl = makeEditorDiv(TABLE_HTML);
    const table = editorEl.querySelector('table');

    const result = unwrapBlock(table, editorEl);

    expect(result.success).toBe(false);
    expect(editorEl.querySelector('table')).toBeTruthy();
    expect(editorEl.querySelectorAll('td')).toHaveLength(4);
  });

  it('zeigt für Nicht-Tabellen weiterhin den generischen Umwandeln-Button', () => {
    const { editor } = renderEditor('<div class="info-box"><p>Inhalt</p></div>');
    focusBlock(editor, editor.querySelector('.info-box p'));

    expect(screen.getByTestId('btn-unwrap')).toBeTruthy();
    expect(screen.queryByTestId('btn-table-to-text')).toBeNull();
  });

  it('unwrap einer Info-Box erhält den Inhalt und meldet genau eine Änderung', () => {
    const { editor, onChange } = renderEditor(
      '<div class="info-box"><h3>Titel</h3><p>Absatz</p></div>'
    );
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-unwrap');

    expect(unwrapBlock).toHaveBeenCalledTimes(1);
    expect(editor.querySelector('.info-box')).toBeNull();
    expect(editor.querySelector('h3').textContent).toBe('Titel');
    expect(editor.textContent).toContain('Absatz');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 3: Verlustfreiheit über Serialisierung und erneutes Parsen
// ===========================================================================

describe('3 – Tabelle → Text → Serialisierung → erneutes Parsen', () => {
  it('erhält Texte, Links und Formatierungen', () => {
    const html =
      '<table>' +
      '<thead><tr><th>Kurs</th><th>Details</th></tr></thead>' +
      '<tbody><tr>' +
      '<td><a href="/kurse">Kursangebot</a></td>' +
      '<td><strong>Fett</strong> und <em>Kursiv</em></td>' +
      '</tr></tbody></table>';
    const { editor } = renderEditor(html);
    focusBlock(editor, editor.querySelector('td'));

    clickBtn('btn-table-to-text');
    acceptConfirm();

    const serialized = editor.innerHTML;
    const reparsed = document.createElement('div');
    reparsed.innerHTML = serialized;

    expectNoTableRemnants(reparsed);
    expect(reparsed.textContent).toContain('Kursangebot');
    expect(reparsed.textContent).toContain('Kurs:');
    expect(reparsed.textContent).toContain('Details:');
    expect(reparsed.querySelector('a[href="/kurse"]')).toBeTruthy();
    expect(reparsed.querySelector('strong').textContent).toBe('Fett');
    expect(reparsed.querySelector('em').textContent).toBe('Kursiv');
  });
});

// ===========================================================================
// 4–12: tableToText in allen geforderten Tabellenformen
// ===========================================================================

describe('4–12 – tableToText deckt alle Tabellenformen verlustfrei ab', () => {
  it('4 – Tabelle ohne thead: jede Zeile wird ein Absatz', () => {
    const { editorEl, result, paragraphs } = convertTable(
      '<table><tbody>' +
      '<tr><td>A1</td><td>A2</td></tr>' +
      '<tr><td>B1</td><td>B2</td></tr>' +
      '</tbody></table>'
    );

    expect(result.success).toBe(true);
    expectNoTableRemnants(editorEl);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe('A1 — A2');
    expect(paragraphs[1].textContent).toBe('B1 — B2');
  });

  it('5 – Tabelle ohne tbody', () => {
    const { editorEl, result, paragraphs } = convertTable(
      '<table><thead><tr><th>Kopf</th></tr></thead></table>'
    );

    expect(result.success).toBe(true);
    expectNoTableRemnants(editorEl);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe('Kopf');
  });

  it('5b – Zeilen direkt im table-Element ohne tbody', () => {
    const editorEl = makeEditorDiv('<table></table>');
    const table = editorEl.querySelector('table');
    const tr = document.createElement('tr');
    ['X', 'Y'].forEach((t) => {
      const td = document.createElement('td');
      td.textContent = t;
      tr.appendChild(td);
    });
    table.appendChild(tr);

    const result = tableToText(table, editorEl);

    expect(result.success).toBe(true);
    expectNoTableRemnants(editorEl);
    expect(editorEl.querySelectorAll('p')).toHaveLength(1);
    expect(editorEl.textContent).toBe('X — Y');
  });

  it('6 – Tabelle mit leerem tbody erhält die Kopfzeile', () => {
    const { editorEl, result, paragraphs } = convertTable(
      '<table><thead><tr><th>Nur Kopf 1</th><th>Nur Kopf 2</th></tr></thead>' +
      '<tbody></tbody></table>'
    );

    expect(result.success).toBe(true);
    expectNoTableRemnants(editorEl);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe('Nur Kopf 1 — Nur Kopf 2');
  });

  it('7 – Tabelle nur mit Kopfzeile wird nie zu einem leeren Absatz', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th>Alleinige Überschrift</th></tr></thead></table>'
    );

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe('Alleinige Überschrift');
    expect(editorEl.textContent.trim()).not.toBe('');
  });

  it('8 – Tabelle mit nur einer Zeile und einer Spalte', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><tbody><tr><td>Einziger Wert</td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe('Einziger Wert');
    expectNoTableRemnants(editorEl);
  });

  it('8b – eine Datenzeile mit Kopfzeile ergibt beschriftete Absätze', () => {
    const { paragraphs } = convertTable(
      '<table><thead><tr><th>Qualifikation</th><th>Monatslohn</th></tr></thead>' +
      '<tbody><tr><td>Eidg. Fachausweis</td><td>CHF 4600 – 4900</td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe('Qualifikation: Eidg. Fachausweis');
    expect(paragraphs[1].textContent).toBe('Monatslohn: CHF 4600 – 4900');
  });

  it('9 – unterschiedlich viele Zellen pro Zeile: keine Überschrift geht verloren', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>' +
      '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(3);
    // Nicht verwendete Kopfzelle wird zusätzlich ausgegeben
    expect(paragraphs[0].textContent).toBe('C');
    expect(paragraphs[1].textContent).toBe('A: 1');
    expect(paragraphs[2].textContent).toBe('B: 2');
    expect(editorEl.textContent).toContain('C');
  });

  it('10 – leere Zellen erzeugen keine leeren Absätze', () => {
    const { paragraphs } = convertTable(
      '<table><thead><tr><th>K1</th><th>K2</th></tr></thead>' +
      '<tbody><tr><td>Wert</td><td></td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(2);
    // K2 hat keine gefüllte Datenzelle → wird als eigener Absatz erhalten
    expect(paragraphs[0].textContent).toBe('K2');
    expect(paragraphs[1].textContent).toBe('K1: Wert');
  });

  it('10b – vollständig leere Tabelle ergibt genau einen leeren Absatz', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><tbody><tr><td></td><td></td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe('');
    expectNoTableRemnants(editorEl);
  });

  it('11 – Links in Zellen bleiben als DOM erhalten', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th>Quelle</th></tr></thead>' +
      '<tbody><tr><td>Siehe <a href="https://example.ch/a" target="_blank" ' +
      'rel="noopener noreferrer">Anbieter</a></td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(1);
    const link = editorEl.querySelector('a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://example.ch/a');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toBe('Anbieter');
    expect(paragraphs[0].textContent).toBe('Quelle: Siehe Anbieter');
  });

  it('12 – strong und em bleiben erhalten', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th>Hinweis</th></tr></thead>' +
      '<tbody><tr><td><strong>Wichtig</strong> und <em>kursiv</em></td></tr>' +
      '</tbody></table>'
    );

    expect(editorEl.querySelector('strong').textContent).toBe('Wichtig');
    expect(editorEl.querySelector('em').textContent).toBe('kursiv');
    expect(paragraphs[0].textContent).toBe('Hinweis: Wichtig und kursiv');
  });

  it('12b – Formatierung in der Kopfzelle wird geklont, nicht verschoben', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th><strong>Kopf</strong></th></tr></thead>' +
      '<tbody><tr><td>Eins</td></tr><tr><td>Zwei</td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(2);
    expect(editorEl.querySelectorAll('strong')).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe('Kopf: Eins');
    expect(paragraphs[1].textContent).toBe('Kopf: Zwei');
  });

  it('12c – Blockelemente in Zellen werden ohne p-in-p aufgelöst', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><tbody><tr><td><p>Erster</p><p>Zweiter</p></td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].querySelector('p')).toBeNull();
    expect(paragraphs[0].textContent).toBe('Erster Zweiter');
    expectNoTableRemnants(editorEl);
  });

  it('lehnt Nicht-Tabellen und fremde Elemente ab', () => {
    const editorEl = makeEditorDiv('<p>Text</p>');
    const foreign = document.createElement('table');

    expect(tableToText(foreign, editorEl).success).toBe(false);
    expect(tableToText(editorEl.querySelector('p'), editorEl).success).toBe(false);
  });
});

// ===========================================================================
// 13–18: Schutz vor Inhaltsverlust bei Zeilen und Spalten
// ===========================================================================

describe('13–18 – Zeilen und Spalten sicher löschen', () => {
  function renderTable(html = TABLE_HTML) {
    const { editor, onChange } = renderEditor(html);
    return { editor, onChange };
  }

  it('13 – gefüllte Zeile: Abbrechen verhindert Löschung und onChange', () => {
    const { editor, onChange } = renderTable();
    focusBlock(editor, editor.querySelectorAll('tbody tr')[1].querySelector('td'));

    clickBtn('btn-del-row');

    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('block-confirm-message').textContent)
      .toBe(BLOCK_MESSAGES.confirmRow);
    // Der blosse Klick verändert noch nichts
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(2);

    cancelConfirm();

    expect(confirmVisible()).toBe(false);
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(editor.textContent).toContain('Diplom');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('insert-error')).toBeNull();
  });

  it('14 – gefüllte Zeile: Bestätigen löscht und meldet genau einmal', () => {
    const { editor, onChange } = renderTable();
    focusBlock(editor, editor.querySelectorAll('tbody tr')[1].querySelector('td'));

    clickBtn('btn-del-row');
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(2);
    acceptConfirm();

    expect(window.confirm).not.toHaveBeenCalled();
    expect(confirmVisible()).toBe(false);
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(editor.textContent).not.toContain('Diplom');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('15 – gefüllte Spalte: Abbrechen verhindert Löschung und onChange', () => {
    const { editor, onChange } = renderTable();
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');

    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('block-confirm-message').textContent)
      .toBe(BLOCK_MESSAGES.confirmCol);

    cancelConfirm();

    expect(editor.querySelector('tbody tr').cells).toHaveLength(2);
    expect(editor.textContent).toContain('CHF 4600');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('16 – gefüllte Spalte: Bestätigen löscht und meldet genau einmal', () => {
    const { editor, onChange } = renderTable();
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');
    acceptConfirm();

    expect(editor.querySelector('tbody tr').cells).toHaveLength(1);
    expect(editor.querySelectorAll('thead th')).toHaveLength(1);
    expect(editor.textContent).not.toContain('CHF 4600');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('17 – leere Zeile wird ohne Sicherheitsabfrage gelöscht', () => {
    const { editor, onChange } = renderTable(
      '<table><thead><tr><th>K</th></tr></thead>' +
      '<tbody><tr><td>Wert</td></tr><tr><td></td></tr></tbody></table>'
    );
    focusBlock(editor, editor.querySelectorAll('tbody tr')[1].cells[0]);

    clickBtn('btn-del-row');

    expect(window.confirm).not.toHaveBeenCalled();
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('17b – leere Spalte wird ohne Sicherheitsabfrage gelöscht', () => {
    const { editor, onChange } = renderTable(
      '<table><thead><tr><th>K</th><th></th></tr></thead>' +
      '<tbody><tr><td>Wert</td><td></td></tr></tbody></table>'
    );
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');

    expect(window.confirm).not.toHaveBeenCalled();
    expect(editor.querySelector('tbody tr').cells).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('18 – thead-Zeile kann nicht über „Zeile löschen" entfernt werden', () => {
    const { editor, onChange } = renderTable();
    focusBlock(editor, editor.querySelector('thead th'));

    clickBtn('btn-del-row');

    expect(editor.querySelectorAll('thead tr')).toHaveLength(1);
    expect(editor.querySelectorAll('thead th')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('insert-error').textContent).toContain('Kopfzeile ausschalten');
  });

  it('cellHasContent / rowHasContent erkennen Text, Links und Bilder', () => {
    const editorEl = makeEditorDiv(
      '<table><tbody>' +
      '<tr><td></td><td>   </td></tr>' +
      '<tr><td><a href="/x">L</a></td></tr>' +
      '<tr><td><img src="/b.png" alt=""></td></tr>' +
      '</tbody></table>'
    );
    const rows = editorEl.querySelectorAll('tr');

    expect(cellHasContent(rows[0].cells[0])).toBe(false);
    expect(cellHasContent(rows[0].cells[1])).toBe(false);
    expect(rowHasContent(rows[0])).toBe(false);
    expect(rowHasContent(rows[1])).toBe(true);
    expect(rowHasContent(rows[2])).toBe(true);
  });
});

// ===========================================================================
// 19: Kopfzeile ein- und ausschalten
// ===========================================================================

describe('19 – Kopfzeile ein-/ausschalten', () => {
  it('ausschalten erhält alle Inhalte und lässt kein thead zurück', () => {
    const editorEl = makeEditorDiv(
      '<table><thead><tr><th>Qualifikation</th><th><strong>Lohn</strong></th></tr></thead>' +
      '<tbody><tr><td>A</td><td>B</td></tr></tbody></table>'
    );
    const table = editorEl.querySelector('table');

    const result = tableToggleHeader(table);

    expect(result.success).toBe(true);
    expect(table.querySelector('thead')).toBeNull();
    expect(table.querySelectorAll('th')).toHaveLength(0);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table.querySelector('tbody tr').cells[0].textContent).toBe('Qualifikation');
    expect(table.querySelector('strong').textContent).toBe('Lohn');
  });

  it('einschalten funktioniert auch ohne tbody', () => {
    const editorEl = makeEditorDiv('<table></table>');
    const table = editorEl.querySelector('table');
    ['K1', 'K2'].forEach(() => { /* Struktur unten aufgebaut */ });
    const tr = document.createElement('tr');
    ['K1', 'K2'].forEach((t) => {
      const td = document.createElement('td');
      td.textContent = t;
      tr.appendChild(td);
    });
    table.appendChild(tr);

    const result = tableToggleHeader(table);

    expect(result.success).toBe(true);
    expect(table.querySelectorAll('thead tr')).toHaveLength(1);
    expect(table.querySelectorAll('thead th')).toHaveLength(2);
    expect(table.querySelector('thead th').textContent).toBe('K1');
  });

  it('entfernt ein leeres thead und bildet die Kopfzeile neu', () => {
    const editorEl = makeEditorDiv(
      '<table><thead></thead><tbody><tr><td>K1</td></tr>' +
      '<tr><td>D1</td></tr></tbody></table>'
    );
    const table = editorEl.querySelector('table');

    const result = tableToggleHeader(table);

    expect(result.success).toBe(true);
    expect(table.querySelectorAll('thead')).toHaveLength(1);
    expect(table.querySelector('thead th').textContent).toBe('K1');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('Ein- und Ausschalten ist verlustfrei umkehrbar', () => {
    const editorEl = makeEditorDiv(
      '<table><thead><tr><th>K1</th><th>K2</th></tr></thead>' +
      '<tbody><tr><td>A</td><td>B</td></tr></tbody></table>'
    );
    const table = editorEl.querySelector('table');

    tableToggleHeader(table);
    tableToggleHeader(table);

    expect(table.querySelectorAll('thead tr')).toHaveLength(1);
    expect(table.querySelectorAll('thead th')).toHaveLength(2);
    expect(table.querySelector('thead th').textContent).toBe('K1');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(editorEl.textContent).toContain('K2');
    expect(editorEl.textContent).toContain('B');
  });

  it('über die Aktionsleiste bedienbar und meldet genau eine Änderung', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));

    clickBtn('btn-toggle-header');

    expect(editor.querySelector('thead')).toBeNull();
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('leere Tabelle ohne Zeile liefert eine verständliche Meldung', () => {
    const editorEl = makeEditorDiv('<table></table>');
    const result = tableToggleHeader(editorEl.querySelector('table'));

    expect(result.success).toBe(false);
    expect(result.message).toBe(BLOCK_MESSAGES.noHeaderRow);
  });
});

// ===========================================================================
// 21–24: Baustein löschen, mehrfach einfügen, Verschachtelung
// ===========================================================================

describe('21–24 – Baustein-Aktionen in der Oberfläche', () => {
  it('21 – „Baustein löschen": Abbrechen erhält den Baustein', () => {
    const { editor, onChange } = renderEditor(
      '<div class="warning-box"><h3>Titel</h3><p>Inhalt</p></div>'
    );
    focusBlock(editor, editor.querySelector('.warning-box p'));

    clickBtn('btn-delete-block');

    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('block-confirm-message').textContent)
      .toContain('Hinweis / Warnung');

    cancelConfirm();

    expect(deleteBlock).not.toHaveBeenCalled();
    expect(editor.querySelectorAll('.warning-box')).toHaveLength(1);
    expect(editor.textContent).toContain('Inhalt');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('22 – „Baustein löschen": Bestätigen löscht und meldet genau einmal', () => {
    const { editor, onChange } = renderEditor(
      '<div class="warning-box"><h3>Titel</h3><p>Inhalt</p></div><p id="rest">Rest</p>'
    );
    focusBlock(editor, editor.querySelector('.warning-box p'));

    clickBtn('btn-delete-block');
    expect(deleteBlock).not.toHaveBeenCalled();
    acceptConfirm();

    expect(deleteBlock).toHaveBeenCalledTimes(1);
    expect(editor.querySelectorAll('.warning-box')).toHaveLength(0);
    expect(editor.textContent).not.toContain('Titel');
    expect(editor.querySelector('#rest')).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('23 – zwei gültige Einfügungen ergeben exakt zwei Bausteine', () => {
    const { editor, onChange } = renderEditor('<p id="p1">A</p><p id="p2">B</p>');

    focusBlock(editor, editor.querySelector('#p1'));
    clickInsertType('info-box');
    focusBlock(editor, editor.querySelector('#p2'));
    clickInsertType('info-box');

    expect(editor.querySelectorAll('.info-box')).toHaveLength(2);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('insert-error')).toBeNull();
  });

  it('23b – zwei Tabellen können eingefügt werden', () => {
    const { editor } = renderEditor('<p id="p1">A</p><p id="p2">B</p>');

    focusBlock(editor, editor.querySelector('#p1'));
    clickInsertType('table');
    focusBlock(editor, editor.querySelector('#p2'));
    clickInsertType('table');

    expect(editor.querySelectorAll('table')).toHaveLength(2);
  });

  it('24 – Verschachtelung wird verhindert und sichtbar gemeldet', () => {
    const { editor, onChange } = renderEditor(
      '<div class="info-box"><p id="inner">Inhalt</p></div>'
    );
    focusBlock(editor, editor.querySelector('#inner'));

    clickInsertType('tip-box');

    expect(editor.querySelectorAll('.tip-box')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
    const error = screen.getByTestId('insert-error');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('innerhalb eines anderen Bausteins');
  });

  it('24b – Verschachtelung in einer Tabelle wird verhindert', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));

    clickInsertType('checklist');

    expect(editor.querySelectorAll('.checklist')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('insert-error')).toBeTruthy();
  });

  it('24c – Fehlermeldung verschwindet nach erfolgreicher Folgeaktion', () => {
    const { editor } = renderEditor('<div class="info-box"><p id="inner">X</p></div>' +
      '<p id="frei">Frei</p>');
    focusBlock(editor, editor.querySelector('#inner'));
    clickInsertType('tip-box');
    expect(screen.getByTestId('insert-error')).toBeTruthy();

    focusBlock(editor, editor.querySelector('#frei'));
    clickInsertType('tip-box');

    expect(editor.querySelectorAll('.tip-box')).toHaveLength(1);
    expect(screen.queryByTestId('insert-error')).toBeNull();
  });
});

// ===========================================================================
// 25 + 26: Darstellung im Editor
// ===========================================================================

describe('25/26 – Editor-Darstellung', () => {
  it('25 – Editierbereich trägt prose-ratgeber', () => {
    const { editor } = renderEditor('<p>Text</p>');
    expect(editor.className).toContain('prose-ratgeber');
  });

  it('26 – Fokus-Hervorhebung liegt ausserhalb des contentEditable', () => {
    const { editor } = renderEditor('<div class="tip-box"><p>Inhalt</p></div>');
    focusBlock(editor, editor.querySelector('.tip-box p'));

    const overlay = screen.getByTestId('block-focus-overlay');
    expect(overlay).toBeTruthy();
    expect(editor.contains(overlay)).toBe(false);
    expect(editor.innerHTML).not.toContain('block-focus-overlay');
    expect(editor.innerHTML).not.toContain('data-testid');
    expect(editor.querySelector('[style]')).toBeNull();
  });

  it('26b – keine Hervorhebung bei normalem Text', () => {
    const { editor } = renderEditor('<p id="p1">Normaler Text</p>');
    focusBlock(editor, editor.querySelector('#p1'));

    expect(screen.queryByTestId('block-focus-overlay')).toBeNull();
    expect(screen.getByTestId('section-badge').textContent).toContain('Normaler Text');
  });

  it('26c – gespeichertes HTML enthält keine Editor-Klassen oder Marker', () => {
    const { editor } = renderEditor('<div class="cta-box"><h3>Titel</h3></div>');
    focusBlock(editor, editor.querySelector('.cta-box h3'));

    const html = editor.innerHTML;
    expect(html).toContain('class="cta-box"');
    expect(html).not.toContain('Aktueller Abschnitt');
    expect(html).not.toContain('data-block');
    expect(html).not.toContain('ring-teal');
    expect(editor.contains(screen.getByTestId('block-actions'))).toBe(false);
    expect(editor.contains(screen.getByTestId('section-badge'))).toBe(false);
  });
});

// ===========================================================================
// 27–30: Selektion, veraltete Referenzen, No-Op-Aktionen
// ===========================================================================

describe('27–30 – Selektions- und Zustandssicherheit', () => {
  it('27 – externer value-Wechsel entfernt die Bausteinaktionen', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor value={TABLE_HTML} onChange={onChange} id="test-editor" />
    );
    const editor = screen.getByTestId('test-editor');
    focusBlock(editor, editor.querySelector('td'));
    expect(screen.getByTestId('block-actions')).toBeTruthy();

    rerender(
      <AdminRichTextEditor value="<p>Ganz neuer Text</p>" onChange={onChange} id="test-editor" />
    );

    expect(screen.queryByTestId('block-actions')).toBeNull();
    expect(screen.queryByTestId('block-focus-overlay')).toBeNull();
    expect(editor.querySelector('table')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('27b – Aktion auf veralteter Selektion verändert nichts', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));
    expect(screen.getByTestId('btn-del-row')).toBeTruthy();

    // Der Baustein wird ausserhalb des Editors entfernt → Selektion ist verwaist
    const table = editor.querySelector('table');
    table.remove();

    clickBtn('btn-del-row');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('insert-error')).toBeTruthy();
  });

  it('28 – letzte Datenzeile: kein Löschen, kein onChange', () => {
    const { editor, onChange } = renderEditor(
      '<table><thead><tr><th>K</th></tr></thead>' +
      '<tbody><tr><td>Einzig</td></tr></tbody></table>'
    );
    focusBlock(editor, editor.querySelector('tbody td'));

    clickBtn('btn-del-row');

    expect(editor.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('insert-error').textContent).toBe(BLOCK_MESSAGES.lastRow);
  });

  it('28b – letzte Spalte: kein Löschen, kein onChange', () => {
    const { editor, onChange } = renderEditor(
      '<table><tbody><tr><td>Einzig</td></tr><tr><td>Zwei</td></tr></tbody></table>'
    );
    focusBlock(editor, editor.querySelector('td'));

    clickBtn('btn-del-col');

    expect(editor.querySelector('tr').cells).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('insert-error').textContent).toBe(BLOCK_MESSAGES.lastCol);
  });

  it('28c – abgebrochene Tabellenumwandlung verändert nichts', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));

    clickBtn('btn-table-to-text');
    cancelConfirm();

    expect(editor.querySelector('table')).toBeTruthy();
    expect(editor.querySelectorAll('td')).toHaveLength(4);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('29 – Auswahl über mehrere Abschnitte deaktiviert destruktive Aktionen', () => {
    const { editor } = renderEditor(TABLE_HTML + '<p id="aussen">Danach</p>');
    focusBlock(editor, editor.querySelector('td'), editor.querySelector('#aussen'));

    expect(screen.getByTestId('section-badge').textContent).toContain('Mehrere Abschnitte');
    expect(screen.queryByTestId('block-actions')).toBeNull();
    expect(screen.queryByTestId('btn-del-row')).toBeNull();
    expect(screen.queryByTestId('block-focus-overlay')).toBeNull();
  });

  it('29b – Auswahl über mehrere Zellen führt keine Tabellenaktion aus', () => {
    const editorEl = makeEditorDiv(TABLE_HTML);
    const cells = editorEl.querySelectorAll('tbody td');
    setSelection(cells[0], cells[1]);

    const result = tableDeleteRow(editorEl);

    expect(result.success).toBe(false);
    expect(result.message).toBe(BLOCK_MESSAGES.multiCell);
    expect(editorEl.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('30 – Selektion ausserhalb des Editors deaktiviert alle Aktionen', () => {
    const { editor } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));
    expect(screen.getByTestId('block-actions')).toBeTruthy();

    const outside = makeEditorDiv('<p>Fremder Text</p>');
    focusBlock(editor, outside.querySelector('p'));

    expect(screen.queryByTestId('block-actions')).toBeNull();
    expect(screen.getByTestId('section-badge').textContent).toContain('Normaler Text');
  });

  it('30b – Tabellenaktion bei Selektion ausserhalb bleibt wirkungslos', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));
    const outside = makeEditorDiv('<p>Fremder Text</p>');
    setSelection(outside.querySelector('p'));

    // Der Button ist noch aus dem vorherigen Zustand gerendert
    clickBtn('btn-del-row');

    expect(editor.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('block-actions')).toBeNull();
  });

  it('resolveSelectionContext bewertet Anker und Fokus gemeinsam', () => {
    const editorEl = makeEditorDiv(
      '<div class="info-box"><p>Innen</p></div><p>Aussen</p>'
    );
    const innen = editorEl.querySelector('.info-box p');
    const aussen = editorEl.querySelectorAll('p')[1];

    setSelection(innen);
    expect(resolveSelectionContext(editorEl).blockType).toBe('info-box');
    expect(getCurrentBlockType(editorEl)).toBe('info-box');

    setSelection(innen, aussen);
    const spread = resolveSelectionContext(editorEl);
    expect(spread.multiple).toBe(true);
    expect(spread.container).toBeNull();
    expect(getCurrentBlockType(editorEl)).toBeNull();

    clearSelection();
    expect(resolveSelectionContext(editorEl).inEditor).toBe(false);
  });
});

// ===========================================================================
// 31: Keine spurious onChange-Aufrufe
// ===========================================================================

describe('31 – Blosse Initialisierung löst kein onChange aus', () => {
  it('initiales Render mit Inhalt', () => {
    const onChange = vi.fn();
    render(<AdminRichTextEditor value="<p>Bestehend</p>" onChange={onChange} id="init-1" />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('initiales Render ohne Inhalt', () => {
    const onChange = vi.fn();
    render(<AdminRichTextEditor value="" onChange={onChange} id="init-2" />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('initiales Render mit Baustein-HTML verändert das HTML nicht', () => {
    const onChange = vi.fn();
    const html = '<div class="info-box"><h3>Titel</h3><p>Text</p></div>';
    render(<AdminRichTextEditor value={html} onChange={onChange} id="init-3" />);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('init-3').innerHTML).toBe(html);
  });

  it('Fokus und Selektionswechsel allein lösen kein onChange aus', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('td'));
    fireEvent.focus(editor);
    fireEvent.keyUp(editor);

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 32: Bestehende Funktionen bleiben erhalten
// ===========================================================================

describe('32 – Bestehende Editor-Funktionen', () => {
  it('Toolbar enthält alle bisherigen Schaltflächen', () => {
    renderEditor();
    expect(screen.getByTitle('Überschrift H2')).toBeTruthy();
    expect(screen.getByTitle('Überschrift H3')).toBeTruthy();
    expect(screen.getByTitle('Überschrift H4')).toBeTruthy();
    expect(screen.getByTitle(/Fett/i)).toBeTruthy();
    expect(screen.getByTitle(/Kursiv/i)).toBeTruthy();
    expect(screen.getByTitle('Aufzählung')).toBeTruthy();
    expect(screen.getByTitle('Nummerierte Liste')).toBeTruthy();
    expect(screen.getByTitle('Externer Link')).toBeTruthy();
    expect(screen.getByTitle(/Interner Link/i)).toBeTruthy();
    expect(screen.getByTitle(/Rückgängig/i)).toBeTruthy();
    expect(screen.getByTitle(/Wiederholen/i)).toBeTruthy();
  });

  it('Fett und Kursiv rufen execCommand auf', () => {
    renderEditor();
    fireEvent.mouseDown(screen.getByTitle(/Fett/i), { button: 0 });
    expect(document.execCommand).toHaveBeenCalledWith('bold', false, null);
    fireEvent.mouseDown(screen.getByTitle(/Kursiv/i), { button: 0 });
    expect(document.execCommand).toHaveBeenCalledWith('italic', false, null);
  });

  it('Listen rufen execCommand auf', () => {
    renderEditor();
    fireEvent.mouseDown(screen.getByTitle('Aufzählung'), { button: 0 });
    expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, null);
    fireEvent.mouseDown(screen.getByTitle('Nummerierte Liste'), { button: 0 });
    expect(document.execCommand).toHaveBeenCalledWith('insertOrderedList', false, null);
  });

  it('Link-Panel öffnet sich und weist unsichere URLs ab', () => {
    renderEditor();
    fireEvent.mouseDown(screen.getByTitle('Externer Link'), { button: 0 });
    const urlInput = screen.getByPlaceholderText('https://...');
    expect(urlInput).toBeTruthy();

    fireEvent.change(urlInput, { target: { value: 'javascript:alert(1)' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });

    expect(screen.getByRole('alert').textContent).toContain('Ungültige URL');
    const insertHtmlCalls = document.execCommand.mock.calls.filter((c) => c[0] === 'insertHTML');
    expect(insertHtmlCalls).toHaveLength(0);
  });

  it('Paste bleibt reiner Text ohne insertHTML', () => {
    const { editor, onChange } = renderEditor('');
    setSelection(editor);

    fireEvent.paste(editor, {
      clipboardData: { getData: vi.fn((type) => (type === 'text/plain' ? '<b>Bold</b>' : '')) },
    });

    const insertHtmlCalls = document.execCommand.mock.calls.filter((c) => c[0] === 'insertHTML');
    expect(insertHtmlCalls).toHaveLength(0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 33: Artikelwechsel — kontrollierte value-Synchronisierung
// ===========================================================================

describe('33 – Artikelwechsel im Formular', () => {
  const ARTIKEL_A = '<p>Artikel A</p>';
  const ARTIKEL_B = '<p>Artikel B</p>';
  const ARTIKEL_C = '<p>Artikel C</p>';

  it('A – No-Op vor externem Wechsel: Artikel B wird übernommen, kein onChange', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor value={ARTIKEL_A} onChange={onChange} id="wechsel-a" />
    );
    const editor = screen.getByTestId('wechsel-a');
    focusBlock(editor, editor.querySelector('p'));

    // Wirkungslose Editoraktion
    performNoOpAction(editor);
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <AdminRichTextEditor value={ARTIKEL_B} onChange={onChange} id="wechsel-a" />
    );

    expect(editor.innerHTML).toBe(ARTIKEL_B);
    expect(editor.textContent).toBe('Artikel B');
    expect(editor.textContent).not.toContain('Artikel A');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('B – Eingabe nach externem Wechsel basiert auf Artikel B', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor value={ARTIKEL_A} onChange={onChange} id="wechsel-b" />
    );
    const editor = screen.getByTestId('wechsel-b');
    focusBlock(editor, editor.querySelector('p'));
    performNoOpAction(editor);

    rerender(
      <AdminRichTextEditor value={ARTIKEL_B} onChange={onChange} id="wechsel-b" />
    );

    // Bearbeitung im neuen Artikel
    editor.querySelector('p').textContent = 'Artikel B bearbeitet';
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0];
    expect(emitted).toBe('<p>Artikel B bearbeitet</p>');
    expect(emitted).not.toContain('Artikel A');
  });

  it('C – Parent-Echo nach echter Änderung: keine Schleife, kein zweites onChange', () => {
    const onChange = vi.fn();

    function Host() {
      const [html, setHtml] = React.useState(ARTIKEL_A);
      return (
        <AdminRichTextEditor
          value={html}
          onChange={(next) => { onChange(next); setHtml(next); }}
          id="wechsel-c"
        />
      );
    }

    render(<Host />);
    const editor = screen.getByTestId('wechsel-c');
    focusBlock(editor, editor.querySelector('p'));

    editor.querySelector('p').textContent = 'Artikel A erweitert';
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('<p>Artikel A erweitert</p>');
    // Der zurückgespiegelte Wert überschreibt den Editor nicht
    expect(editor.innerHTML).toBe('<p>Artikel A erweitert</p>');

    // Eine zweite echte Änderung wird weiterhin gemeldet
    editor.querySelector('p').textContent = 'Artikel A nochmals';
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('<p>Artikel A nochmals</p>');
    expect(editor.innerHTML).toBe('<p>Artikel A nochmals</p>');
  });

  it('D – mehrere externe Wechsel ohne onChange und ohne alte DOM-Bezüge', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor value={TABLE_HTML} onChange={onChange} id="wechsel-d" />
    );
    const editor = screen.getByTestId('wechsel-d');
    focusBlock(editor, editor.querySelector('td'));
    expect(screen.getByTestId('block-actions')).toBeTruthy();

    // Artikel A → Artikel B
    rerender(
      <AdminRichTextEditor
        value='<div class="info-box"><p>Artikel B</p></div>'
        onChange={onChange}
        id="wechsel-d"
      />
    );
    expect(editor.querySelector('table')).toBeNull();
    expect(editor.querySelector('.info-box')).toBeTruthy();
    expect(screen.queryByTestId('block-actions')).toBeNull();
    expect(screen.queryByTestId('block-focus-overlay')).toBeNull();

    // Artikel B → Artikel C
    rerender(
      <AdminRichTextEditor value={ARTIKEL_C} onChange={onChange} id="wechsel-d" />
    );
    expect(editor.innerHTML).toBe(ARTIKEL_C);
    expect(editor.querySelector('.info-box')).toBeNull();
    expect(screen.queryByTestId('block-actions')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    // Die Bearbeitung greift jetzt auf dem aktuellen Artikel
    editor.querySelector('p').textContent = 'Artikel C bearbeitet';
    fireEvent.input(editor);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('<p>Artikel C bearbeitet</p>');
  });

  it('D2 – nach mehreren Wechseln arbeiten Bausteinaktionen auf dem neuen DOM', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor value={TABLE_HTML} onChange={onChange} id="wechsel-d2" />
    );
    const editor = screen.getByTestId('wechsel-d2');
    focusBlock(editor, editor.querySelector('td'));

    rerender(
      <AdminRichTextEditor
        value='<div class="tip-box"><h3>Titel B</h3><p>Inhalt B</p></div>'
        onChange={onChange}
        id="wechsel-d2"
      />
    );
    focusBlock(editor, editor.querySelector('.tip-box p'));

    clickBtn('btn-unwrap');

    expect(editor.querySelector('.tip-box')).toBeNull();
    expect(editor.textContent).toContain('Inhalt B');
    expect(editor.textContent).not.toContain('Qualifikation');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('externer Wechsel auf denselben Wert schreibt den Editor nicht neu', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor value={ARTIKEL_A} onChange={onChange} id="wechsel-gleich" />
    );
    const editor = screen.getByTestId('wechsel-gleich');
    const paragraph = editor.querySelector('p');

    rerender(
      <AdminRichTextEditor value={ARTIKEL_A} onChange={onChange} id="wechsel-gleich" />
    );

    // Derselbe Knoten — kein unnötiges Überschreiben
    expect(editor.querySelector('p')).toBe(paragraph);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 34: Verbundene Zellen (colspan / rowspan)
// ===========================================================================

describe('34 – Tabellen mit verbundenen Zellen', () => {
  const ROW_COL_ACTIONS = [
    'btn-row-above', 'btn-row-below',
    'btn-col-left', 'btn-col-right',
    'btn-del-row', 'btn-del-col',
    'btn-toggle-header',
  ];

  it('die Meldung ist verständlich und eindeutig', () => {
    expect(BLOCK_MESSAGES.mergedCells).toBe(
      'Diese Tabelle enthält verbundene Zellen. '
      + 'Zeilen und Spalten können hier nicht sicher bearbeitet werden.'
    );
  });

  it('tableHasMergedCells erkennt colspan und rowspan grösser als 1', () => {
    const colspan = makeEditorDiv(COLSPAN_TABLE_HTML);
    const rowspan = makeEditorDiv(ROWSPAN_TABLE_HTML);
    const plain = makeEditorDiv(TABLE_HTML);
    const explicitOne = makeEditorDiv(
      '<table><tbody><tr><td colspan="1" rowspan="1">A</td></tr></tbody></table>'
    );

    expect(tableHasMergedCells(colspan.querySelector('table'))).toBe(true);
    expect(tableHasMergedCells(rowspan.querySelector('table'))).toBe(true);
    expect(tableHasMergedCells(plain.querySelector('table'))).toBe(false);
    expect(tableHasMergedCells(explicitOne.querySelector('table'))).toBe(false);
    expect(tableHasMergedCells(null)).toBe(false);
  });

  it('rowspan="0" gilt ebenfalls als verbunden', () => {
    const editorEl = makeEditorDiv(
      '<table><tbody><tr><td rowspan="0">A</td><td>B</td></tr>' +
      '<tr><td>C</td></tr></tbody></table>'
    );
    expect(tableHasMergedCells(editorEl.querySelector('table'))).toBe(true);
  });

  ROW_COL_ACTIONS.forEach((testId) => {
    it(`${testId} wird bei colspan ohne DOM-Änderung abgelehnt`, () => {
      const { editor, onChange } = renderEditor(COLSPAN_TABLE_HTML);
      focusBlock(editor, editor.querySelector('tbody td'));
      const before = editor.innerHTML;

      clickBtn(testId);

      expect(editor.innerHTML).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
      expect(screen.getByTestId('insert-error').textContent)
        .toBe(BLOCK_MESSAGES.mergedCells);
    });

    it(`${testId} wird bei rowspan ohne DOM-Änderung abgelehnt`, () => {
      const { editor, onChange } = renderEditor(ROWSPAN_TABLE_HTML);
      focusBlock(editor, editor.querySelectorAll('td')[1]);
      const before = editor.innerHTML;

      clickBtn(testId);

      expect(editor.innerHTML).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
      expect(screen.getByTestId('insert-error').textContent)
        .toBe(BLOCK_MESSAGES.mergedCells);
    });
  });

  it('die Hilfsfunktionen lehnen verbundene Zellen direkt ab', () => {
    const editorEl = makeEditorDiv(COLSPAN_TABLE_HTML);
    setSelection(editorEl.querySelector('tbody td'));
    const before = editorEl.innerHTML;

    [
      tableInsertRowAbove, tableInsertRowBelow, tableDeleteRow,
      tableInsertColLeft, tableInsertColRight, tableDeleteCol,
    ].forEach((fn) => {
      const result = fn(editorEl, { confirm: () => true });
      expect(result.success).toBe(false);
      expect(result.message).toBe(BLOCK_MESSAGES.mergedCells);
    });

    expect(editorEl.innerHTML).toBe(before);
  });

  it('Tabelle → Text erhält bei colspan sämtliche sichtbaren Inhalte', () => {
    const { editorEl, result, paragraphs } = convertTable(COLSPAN_TABLE_HTML);

    expect(result.success).toBe(true);
    expectNoTableRemnants(editorEl);
    // Zeilenweise Umwandlung in DOM-Reihenfolge, keine erzwungene Zuordnung
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0].textContent).toBe('Übersicht Lohn');
    expect(paragraphs[1].textContent).toBe('Eidg. Fachausweis — CHF 4600');
    expect(paragraphs[2].textContent).toBe('Diplom — CHF 5200');
    expect(editorEl.textContent).not.toContain('Übersicht Lohn: ');
    expectStableSerialization(editorEl);
  });

  it('Tabelle → Text erhält bei rowspan sämtliche sichtbaren Inhalte', () => {
    const { editorEl, result, paragraphs } = convertTable(ROWSPAN_TABLE_HTML);

    expect(result.success).toBe(true);
    expectNoTableRemnants(editorEl);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe('Grundstufe — Modul A');
    expect(paragraphs[1].textContent).toBe('Modul B');
    expectStableSerialization(editorEl);
  });

  it('Tabelle → Text erhält Links und Inline-Formatierung bei verbundenen Zellen', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th colspan="2">Anbieter</th></tr></thead>' +
      '<tbody><tr>' +
      '<td><a href="/kurse">Kursangebot</a></td>' +
      '<td><strong>Neu</strong> und <em>geprüft</em></td>' +
      '</tr></tbody></table>'
    );

    expect(editorEl.querySelector('a[href="/kurse"]').textContent).toBe('Kursangebot');
    expect(editorEl.querySelector('strong').textContent).toBe('Neu');
    expect(editorEl.querySelector('em').textContent).toBe('geprüft');
    expect(paragraphs[0].textContent).toBe('Anbieter');
    expect(paragraphs[1].textContent).toBe('Kursangebot — Neu und geprüft');
    expectNoTableRemnants(editorEl);
    expectStableSerialization(editorEl);
  });

  it('Tabelle → Text bleibt über die Aktionsleiste bedienbar', () => {
    const { editor, onChange } = renderEditor(COLSPAN_TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody td'));

    clickBtn('btn-table-to-text');
    acceptConfirm();

    expectNoTableRemnants(editor);
    expect(editor.textContent).toContain('Übersicht Lohn');
    expect(editor.textContent).toContain('CHF 5200');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 35: Gültiges HTML bei Tabelle → Text (Blockelemente in Zellen)
// ===========================================================================

describe('35 – Tabelle → Text erzeugt gültiges HTML', () => {
  it('pre bleibt eigenständig und landet nie in einem Absatz', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th>Doku</th></tr></thead>' +
      '<tbody><tr><td>Vorher <pre>const a = 1;</pre> Nachher</td></tr></tbody></table>'
    );

    const pre = editorEl.querySelector('pre');
    expect(pre.textContent).toBe('const a = 1;');
    expect(pre.closest('p')).toBeNull();
    expect(editorEl.textContent).toContain('Vorher');
    expect(editorEl.textContent).toContain('Nachher');
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(editorEl.innerHTML).not.toContain('<p><pre>');
    expectNoBlockInsideParagraph(editorEl);
    expectStableSerialization(editorEl);
    expectNoTableRemnants(editorEl);
  });

  it('hr bleibt als Trennlinie erhalten', () => {
    const { editorEl } = convertTable(
      '<table><tbody><tr><td>Oben<hr>Unten</td></tr></tbody></table>'
    );

    expect(editorEl.querySelector('hr')).toBeTruthy();
    expect(editorEl.querySelector('hr').closest('p')).toBeNull();
    expect(editorEl.textContent).toContain('Oben');
    expect(editorEl.textContent).toContain('Unten');
    expectNoBlockInsideParagraph(editorEl);
    expectStableSerialization(editorEl);
    expectNoTableRemnants(editorEl);
  });

  it('eine Zelle, die nur eine hr enthält, geht nicht verloren', () => {
    const { editorEl } = convertTable(
      '<table><tbody><tr><td><hr></td><td>Text</td></tr></tbody></table>'
    );

    expect(editorEl.querySelector('hr')).toBeTruthy();
    expect(editorEl.textContent).toContain('Text');
    expectNoTableRemnants(editorEl);
    expectStableSerialization(editorEl);
  });

  it('figure mit figcaption bleibt als Einheit erhalten', () => {
    const { editorEl } = convertTable(
      '<table><tbody><tr><td>' +
      '<figure><img src="https://example.ch/bild.png" alt="Kurs">' +
      '<figcaption>Bildlegende</figcaption></figure>' +
      '</td></tr></tbody></table>'
    );

    const figure = editorEl.querySelector('figure');
    expect(figure).toBeTruthy();
    expect(figure.closest('p')).toBeNull();
    expect(figure.querySelector('figcaption').textContent).toBe('Bildlegende');
    expect(figure.querySelector('img').getAttribute('alt')).toBe('Kurs');
    expect(editorEl.innerHTML).not.toContain('<p><figure>');
    expectNoBlockInsideParagraph(editorEl);
    expectStableSerialization(editorEl);
    expectNoTableRemnants(editorEl);
  });

  it('Liste in einer Zelle wird ohne ul-in-p aufgelöst', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th>Inhalt</th></tr></thead>' +
      '<tbody><tr><td><ul><li>Eins</li><li>Zwei</li></ul></td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe('Inhalt: Eins Zwei');
    expectNoBlockInsideParagraph(editorEl);
    expectStableSerialization(editorEl);
    expectNoTableRemnants(editorEl);
  });

  it('Absatz in einer Zelle wird ohne p-in-p aufgelöst', () => {
    const { editorEl, paragraphs } = convertTable(
      '<table><thead><tr><th>Kopf</th></tr></thead>' +
      '<tbody><tr><td><p>Erster</p><p>Zweiter</p></td></tr></tbody></table>'
    );

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].textContent).toBe('Kopf: Erster Zweiter');
    expectNoBlockInsideParagraph(editorEl);
    expectStableSerialization(editorEl);
  });

  it('gemischte Inline- und Blockinhalte bleiben vollständig und gültig', () => {
    const { editorEl } = convertTable(
      '<table><tbody><tr><td>' +
      '<p>Absatz mit <a href="/kurse">Link</a></p>' +
      '<pre>code()</pre>' +
      '<hr>' +
      '<blockquote>Zitat</blockquote>' +
      '<ul><li><strong>Fett</strong></li><li><em>Kursiv</em></li></ul>' +
      '<figure><figcaption>Legende</figcaption></figure>' +
      '</td></tr></tbody></table>'
    );

    // Sämtliche sichtbaren Inhalte sind erhalten
    ['Absatz mit', 'Link', 'code()', 'Zitat', 'Fett', 'Kursiv', 'Legende']
      .forEach((text) => expect(editorEl.textContent).toContain(text));

    expect(editorEl.querySelector('a[href="/kurse"]')).toBeTruthy();
    expect(editorEl.querySelector('strong').textContent).toBe('Fett');
    expect(editorEl.querySelector('em').textContent).toBe('Kursiv');
    expect(editorEl.querySelector('pre').textContent).toBe('code()');
    expect(editorEl.querySelector('hr')).toBeTruthy();
    expect(editorEl.querySelector('figure figcaption').textContent).toBe('Legende');

    expectNoBlockInsideParagraph(editorEl);
    expectStableSerialization(editorEl);
    expectNoTableRemnants(editorEl);
  });

  it('über die Aktionsleiste bleibt die Umwandlung gültig und verlustfrei', () => {
    const { editor, onChange } = renderEditor(
      '<table><thead><tr><th>Kopf</th></tr></thead><tbody><tr><td>' +
      'Text <pre>pre-Inhalt</pre><hr>' +
      '<figure><figcaption>Legende</figcaption></figure>' +
      '</td></tr></tbody></table>'
    );
    focusBlock(editor, editor.querySelector('tbody td'));

    clickBtn('btn-table-to-text');
    acceptConfirm();

    expect(onChange).toHaveBeenCalledTimes(1);
    expectNoTableRemnants(editor);
    expectNoBlockInsideParagraph(editor);
    expectStableSerialization(editor);

    const reparsed = reparse(editor);
    expect(reparsed.querySelector('pre').textContent).toBe('pre-Inhalt');
    expect(reparsed.querySelector('hr')).toBeTruthy();
    expect(reparsed.querySelector('figure figcaption').textContent).toBe('Legende');
    expect(reparsed.textContent).toContain('Text');
  });
});

// ===========================================================================
// 36: Fokus-Overlay bei Layoutänderungen
// ===========================================================================

describe('36 – Fokus-Overlay wird nachgeführt und sauber abgeräumt', () => {
  const BOX_HTML = '<div class="tip-box"><p>Inhalt</p></div>';

  it('ohne sichtbaren Rahmen wird kein globaler resize-Listener registriert', () => {
    const windowAdd = vi.spyOn(window, 'addEventListener');

    render(<AdminRichTextEditor value="<p>Nur Text</p>" onChange={vi.fn()} id="ov-none" />);

    expect(windowAdd.mock.calls.filter((c) => c[0] === 'resize')).toHaveLength(0);
    windowAdd.mockRestore();
  });

  it('registriert resize, scroll und ResizeObserver und entfernt alles beim Unmount', () => {
    const observed = [];
    const disconnected = [];
    class TestResizeObserver {
      constructor(callback) { this.callback = callback; }
      observe(el) { observed.push(el); }
      disconnect() { disconnected.push(this); }
    }
    const originalObserver = window.ResizeObserver;
    window.ResizeObserver = TestResizeObserver;

    const windowAdd = vi.spyOn(window, 'addEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <AdminRichTextEditor value={BOX_HTML} onChange={vi.fn()} id="ov-listener" />
    );
    const editor = screen.getByTestId('ov-listener');
    const editorAdd = vi.spyOn(editor, 'addEventListener');
    const editorRemove = vi.spyOn(editor, 'removeEventListener');

    focusBlock(editor, editor.querySelector('.tip-box p'));
    expect(screen.getByTestId('block-focus-overlay')).toBeTruthy();

    const resizeAdds = windowAdd.mock.calls.filter((c) => c[0] === 'resize');
    const scrollAdds = editorAdd.mock.calls.filter((c) => c[0] === 'scroll');
    expect(resizeAdds).toHaveLength(1);
    expect(scrollAdds).toHaveLength(1);
    expect(observed).toEqual([editor]);

    unmount();

    const resizeRemovals = windowRemove.mock.calls.filter((c) => c[0] === 'resize');
    const scrollRemovals = editorRemove.mock.calls.filter((c) => c[0] === 'scroll');
    expect(resizeRemovals).toHaveLength(1);
    expect(resizeRemovals[0][1]).toBe(resizeAdds[0][1]);
    expect(scrollRemovals).toHaveLength(1);
    expect(scrollRemovals[0][1]).toBe(scrollAdds[0][1]);
    expect(disconnected).toHaveLength(1);

    windowAdd.mockRestore();
    windowRemove.mockRestore();
    editorAdd.mockRestore();
    editorRemove.mockRestore();
    window.ResizeObserver = originalObserver;
  });

  it('resize und Scrollen führen den Rahmen nach, ohne etwas zu melden', () => {
    const { editor, onChange } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.tip-box p'));
    const before = editor.innerHTML;

    fireEvent(window, new Event('resize'));
    fireEvent.scroll(editor);

    expect(screen.getByTestId('block-focus-overlay')).toBeTruthy();
    expect(editor.innerHTML).toBe(before);
    expect(editor.innerHTML).not.toContain('block-focus-overlay');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ResizeObserver-Rückmeldung löst keine Endlosschleife aus', () => {
    let callback = null;
    class TestResizeObserver {
      constructor(cb) { callback = cb; }
      observe() {}
      disconnect() {}
    }
    const originalObserver = window.ResizeObserver;
    window.ResizeObserver = TestResizeObserver;

    const { editor, onChange } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.tip-box p'));
    expect(typeof callback).toBe('function');

    // Mehrfache Rückmeldungen dürfen keinen weiteren Zustand erzeugen
    act(() => {
      for (let i = 0; i < 5; i++) callback();
    });

    expect(screen.getByTestId('block-focus-overlay')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    window.ResizeObserver = originalObserver;
  });

  it('der Rahmen verschwindet beim Wechsel zu normalem Text', () => {
    const { editor } = renderEditor(BOX_HTML + '<p id="frei">Frei</p>');
    focusBlock(editor, editor.querySelector('.tip-box p'));
    expect(screen.getByTestId('block-focus-overlay')).toBeTruthy();

    focusBlock(editor, editor.querySelector('#frei'));

    expect(screen.queryByTestId('block-focus-overlay')).toBeNull();
  });
});

// ===========================================================================
// 37: Link-Einfügung ohne HTML-String
// ===========================================================================

describe('37 – Link-Einfügung erzeugt kontrolliertes DOM', () => {
  function renderWithCaret(html = '<p id="p1">Start</p>') {
    const { editor, onChange } = renderEditor(html);
    focusBlock(editor, editor.querySelector('#p1'));
    return { editor, onChange };
  }

  it('Linktext mit < > & sowie Anführungszeichen bleibt reiner Text', () => {
    const rawText = 'A < B & C > D "doppelt" \'einfach\'';
    const { editor, onChange } = renderWithCaret();

    insertLinkViaPanel({ text: rawText, url: 'https://example.ch/kurs' });

    const links = editor.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe(rawText);
    expect(links[0].children).toHaveLength(0);
    expect(links[0].getAttribute('href')).toBe('https://example.ch/kurs');
    // Genau zwei Elemente: der bestehende Absatz und der neue Link
    expect(editor.querySelectorAll('*')).toHaveLength(2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('scheinbares HTML im Linktext erzeugt kein Element und kein Event-Attribut', () => {
    const rawText = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const { editor } = renderWithCaret();

    insertLinkViaPanel({ text: rawText, url: 'https://example.ch/a' });

    expect(editor.querySelectorAll('a')).toHaveLength(1);
    expect(editor.querySelector('img')).toBeNull();
    expect(editor.querySelector('script')).toBeNull();
    expect(editor.querySelector('a').textContent).toBe(rawText);
    Array.from(editor.querySelectorAll('*')).forEach((el) => {
      expect(el.getAttributeNames().some((name) => name.startsWith('on'))).toBe(false);
    });
    // Der Text ist escaped serialisiert, nicht als Markup
    expect(editor.innerHTML).toContain('&lt;img');
    expect(editor.innerHTML).not.toContain('<img');
  });

  it('URL mit Anführungszeichen und Sonderzeichen bricht das Attribut nicht auf', () => {
    const url = 'https://example.ch/a"b\'c?x=1&y=2';
    const { editor } = renderWithCaret();

    insertLinkViaPanel({ text: 'Anbieter', url });

    const links = editor.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(url);
    expect(links[0].getAttributeNames().sort()).toEqual(['href', 'rel', 'target']);
    expect(editor.innerHTML).toContain('&quot;');
    // Erneutes Parsen liefert exakt denselben Link
    expect(reparse(editor).querySelector('a').getAttribute('href')).toBe(url);
    expect(reparse(editor).querySelectorAll('a')).toHaveLength(1);
  });

  it('externer Link erhält target und rel, interner Link nicht', () => {
    const extern = renderWithCaret();
    insertLinkViaPanel({ text: 'Extern', url: 'https://example.ch/x' });
    const externalLink = extern.editor.querySelector('a');
    expect(externalLink.getAttribute('target')).toBe('_blank');
    expect(externalLink.getAttribute('rel')).toBe('noopener noreferrer');
    cleanup();

    const intern = renderWithCaret();
    insertLinkViaPanel({ mode: 'internal', text: 'Intern', url: '/search?q=yoga' });
    const internalLink = intern.editor.querySelector('a');
    expect(internalLink.getAttribute('href')).toBe('/search?q=yoga');
    expect(internalLink.hasAttribute('target')).toBe(false);
    expect(internalLink.hasAttribute('rel')).toBe(false);
  });

  it('interner Link ohne führenden Schrägstrich wird ergänzt', () => {
    const { editor } = renderWithCaret();

    insertLinkViaPanel({ mode: 'internal', text: 'Kurse', url: 'kurse' });

    expect(editor.querySelector('a').getAttribute('href')).toBe('/kurse');
  });

  it('es wird kein insertHTML-execCommand mehr verwendet', () => {
    renderWithCaret();

    insertLinkViaPanel({ text: 'Text', url: 'https://example.ch/y' });

    const insertHtmlCalls = document.execCommand.mock.calls.filter((c) => c[0] === 'insertHTML');
    expect(insertHtmlCalls).toHaveLength(0);
  });

  it('unsichere URL erzeugt weiterhin keinen Link', () => {
    const { editor, onChange } = renderWithCaret();

    insertLinkViaPanel({ text: 'Böse', url: 'javascript:alert(1)' });

    expect(editor.querySelectorAll('a')).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('Ungültige URL');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('markierter Text nutzt weiterhin createLink des Browsers', () => {
    const { editor, onChange } = renderEditor('<p id="p1">Start</p><p id="p2">Ende</p>');
    // Anker und Fokus im selben Abschnitt, aber nicht zusammengefallen
    setSelection(editor.querySelector('#p1'), editor.querySelector('#p2'));
    fireEvent.mouseUp(editor);

    insertLinkViaPanel({ text: 'Ignoriert', url: 'https://example.ch/z' });

    expect(document.execCommand).toHaveBeenCalledWith(
      'createLink', false, 'https://example.ch/z'
    );
    // Kein manuell erzeugtes a-Element im Auswahlpfad
    expect(editor.querySelectorAll('a')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 38: No-Op-Aktionen aller Art
// ===========================================================================

describe('38 – No-Op-Aktionen lösen kein onChange aus', () => {
  const TOOLBAR_NO_OPS = [
    ['Fett', /Fett/i],
    ['Kursiv', /Kursiv/i],
    ['Überschrift H2', 'Überschrift H2'],
    ['Überschrift H3', 'Überschrift H3'],
    ['Überschrift H4', 'Überschrift H4'],
    ['Absatz', 'Absatz'],
    ['Aufzählung', 'Aufzählung'],
    ['Nummerierte Liste', 'Nummerierte Liste'],
    ['Rückgängig', /Rückgängig/i],
    ['Wiederholen', /Wiederholen/i],
  ];

  TOOLBAR_NO_OPS.forEach(([name, title]) => {
    it(`${name} ohne DOM-Wirkung meldet keine Änderung`, () => {
      const { editor, onChange } = renderEditor('<p id="p1">Text</p>');
      focusBlock(editor, editor.querySelector('#p1'));
      const before = editor.innerHTML;

      fireEvent.mouseDown(screen.getByTitle(title), { button: 0 });

      expect(document.execCommand).toHaveBeenCalled();
      expect(editor.innerHTML).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('„Link entfernen" ohne DOM-Wirkung meldet keine Änderung', () => {
    const { editor, onChange } = renderEditor('<p><a href="/x" id="lnk">Link</a></p>');
    focusBlock(editor, editor.querySelector('#lnk'));
    const before = editor.innerHTML;

    const unlinkBtn = screen.getByTitle('Link entfernen');
    expect(unlinkBtn.disabled).toBe(false);
    fireEvent.mouseDown(unlinkBtn, { button: 0 });

    expect(document.execCommand).toHaveBeenCalledWith('unlink', false, null);
    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Paste ohne Selektion verändert nichts und meldet nichts', () => {
    const { editor, onChange } = renderEditor('<p>Text</p>');
    const before = editor.innerHTML;
    clearSelection();

    fireEvent.paste(editor, {
      clipboardData: { getData: vi.fn(() => 'Neuer Text') },
    });

    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('onInput ohne tatsächliche Änderung meldet nichts', () => {
    const { editor, onChange } = renderEditor('<p>Unverändert</p>');

    fireEvent.input(editor);
    fireEvent.input(editor);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('abgelehnte Bausteinaktion hinterlässt keinen internen Zustand', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor
        value={'<table><thead><tr><th>K</th></tr></thead>' +
          '<tbody><tr><td>Einzig</td></tr></tbody></table>'}
        onChange={onChange}
        id="noop-block"
      />
    );
    const editor = screen.getByTestId('noop-block');
    focusBlock(editor, editor.querySelector('tbody td'));

    // Letzte Datenzeile lässt sich nicht löschen → wirkungslos
    clickBtn('btn-del-row');
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <AdminRichTextEditor value="<p>Artikel B</p>" onChange={onChange} id="noop-block" />
    );

    expect(editor.innerHTML).toBe('<p>Artikel B</p>');
    expect(editor.querySelector('table')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('abgebrochene Baustein-Löschung hinterlässt keinen internen Zustand', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor
        value='<div class="info-box"><p>Inhalt A</p></div>'
        onChange={onChange}
        id="noop-cancel"
      />
    );
    const editor = screen.getByTestId('noop-cancel');
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');
    cancelConfirm();
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <AdminRichTextEditor value="<p>Artikel B</p>" onChange={onChange} id="noop-cancel" />
    );

    expect(editor.innerHTML).toBe('<p>Artikel B</p>');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('wirkungsloser Baustein-Einfügeversuch blockiert keinen value-Wechsel', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor
        value='<div class="info-box"><p id="inner">Inhalt</p></div>'
        onChange={onChange}
        id="noop-insert"
      />
    );
    const editor = screen.getByTestId('noop-insert');
    focusBlock(editor, editor.querySelector('#inner'));

    // Verschachtelung wird abgelehnt
    clickInsertType('tip-box');
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <AdminRichTextEditor value="<p>Artikel B</p>" onChange={onChange} id="noop-insert" />
    );

    expect(editor.innerHTML).toBe('<p>Artikel B</p>');
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Baustein-Erkennung, Einfügen und Menü
// ===========================================================================

describe('Einfüge-Menü und Baustein-Erkennung', () => {
  it('zeigt alle sechs Bausteine mit lesbaren Bezeichnungen', () => {
    renderEditor();
    openInsertMenu();

    ['info-box', 'tip-box', 'warning-box', 'checklist', 'table', 'cta-box']
      .forEach((type) => expect(screen.getByTestId(`insert-${type}`)).toBeTruthy());

    expect(screen.getByText('Info-Box')).toBeTruthy();
    expect(screen.getByText('Tipp-Box')).toBeTruthy();
    expect(screen.getByText('Hinweis / Warnung')).toBeTruthy();
    expect(screen.getByText('Checkliste')).toBeTruthy();
    expect(screen.getByText('Tabelle')).toBeTruthy();
    expect(screen.getByText('Kurs-Box')).toBeTruthy();
  });

  ['info-box', 'tip-box', 'warning-box', 'checklist', 'cta-box', 'table'].forEach((type) => {
    it(`fügt ${type} über die Oberfläche ein`, () => {
      const { editor, onChange } = renderEditor('<p id="p1">Start</p>');
      focusBlock(editor, editor.querySelector('#p1'));

      clickInsertType(type);

      const selector = type === 'table' ? 'table' : `.${type}`;
      expect(editor.querySelectorAll(selector)).toHaveLength(1);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  it('erkennt alle Baustein-Typen im Badge', () => {
    const cases = {
      'info-box': '<div class="info-box"><p id="t">X</p></div>',
      'tip-box': '<div class="tip-box"><p id="t">X</p></div>',
      'warning-box': '<div class="warning-box"><p id="t">X</p></div>',
      'checklist': '<div class="checklist"><ul><li id="t">X</li></ul></div>',
      'cta-box': '<div class="cta-box"><p id="t">X</p></div>',
      'table': '<table><tbody><tr><td id="t">X</td></tr></tbody></table>',
    };

    Object.entries(cases).forEach(([type, html]) => {
      const { editor } = renderEditor(html, vi.fn(), `badge-${type}`);
      focusBlock(editor, editor.querySelector('#t'));
      expect(screen.getByTestId('section-badge').textContent)
        .toContain(BLOCK_LABELS[type]);
      cleanup();
    });
  });

  it('findBlockContainer liefert null für normalen Text', () => {
    const editorEl = makeEditorDiv('<p>Normaler Text</p>');
    expect(findBlockContainer(editorEl.querySelector('p'), editorEl)).toBeNull();
    expect(getBlockType(null)).toBeNull();
  });

  it('Checkliste enthält Überschrift, Listenpunkte und keine Checkbox', () => {
    const editorEl = makeEditorDiv('<p>Start</p>');
    setSelection(editorEl.querySelector('p'));

    expect(insertBlock('checklist', editorEl).success).toBe(true);
    const checklist = editorEl.querySelector('.checklist');
    expect(checklist.querySelector('h3')).toBeTruthy();
    expect(checklist.querySelectorAll('li')).toHaveLength(2);
    expect(editorEl.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('Kurs-Box speichert keinen Button', () => {
    const editorEl = makeEditorDiv('<p>Start</p>');
    setSelection(editorEl.querySelector('p'));

    insertBlock('cta-box', editorEl);
    const cta = editorEl.querySelector('.cta-box');

    expect(cta.querySelector('button')).toBeNull();
    expect(cta.querySelector('.cta-box-button')).toBeNull();
    expect(cta.querySelector('h3')).toBeTruthy();
    expect(cta.querySelector('p')).toBeTruthy();
  });

  it('eingefügte Bausteine tragen keine data-Attribute', () => {
    const editorEl = makeEditorDiv('<p>Start</p>');
    setSelection(editorEl.querySelector('p'));

    insertBlock('info-box', editorEl);
    const box = editorEl.querySelector('.info-box');

    expect(box.hasAttribute('data-block-type')).toBe(false);
    expect(box.hasAttribute('data-editor-label')).toBe(false);
    expect(box.getAttribute('class')).toBe('info-box');
  });

  it('deleteBlock lehnt fremde Container ab', () => {
    const editorEl = makeEditorDiv('');
    const outside = document.createElement('div');
    outside.className = 'info-box';

    expect(deleteBlock(outside, editorEl).success).toBe(false);
    expect(unwrapBlock(outside, editorEl).success).toBe(false);
  });
});

// ===========================================================================
// Tabellenstruktur: Zeilen und Spalten einfügen (inkl. unregelmässiger Tabellen)
// ===========================================================================

describe('Tabellenstruktur bearbeiten', () => {
  it('fügt Zeilen ober- und unterhalb ein', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody td'));

    clickBtn('btn-row-below');
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(3);

    clickBtn('btn-row-above');
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(editor.querySelectorAll('tbody tr')[0].cells).toHaveLength(2);
  });

  it('erzeugt aus der Kopfzeile heraus keine zweite Kopfzeile', () => {
    const editorEl = makeEditorDiv(TABLE_HTML);
    setSelection(editorEl.querySelector('th'));

    const result = tableInsertRowBelow(editorEl);

    expect(result.success).toBe(true);
    expect(editorEl.querySelectorAll('thead tr')).toHaveLength(1);
    expect(editorEl.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(editorEl.querySelectorAll('thead th')).toHaveLength(2);
  });

  it('fügt Spalten links und rechts an der richtigen Position ein', () => {
    const editorEl = makeEditorDiv(TABLE_HTML);
    setSelection(editorEl.querySelector('tbody tr').cells[0]);

    expect(tableInsertColRight(editorEl).success).toBe(true);
    expect(editorEl.querySelector('tbody tr').cells).toHaveLength(3);
    expect(editorEl.querySelector('tbody tr').cells[0].textContent).toBe('Eidg. Fachausweis');
    expect(editorEl.querySelector('tbody tr').cells[1].textContent).toBe('');
    expect(editorEl.querySelector('tbody tr').cells[2].textContent).toBe('CHF 4600');
    expect(editorEl.querySelectorAll('thead th')).toHaveLength(3);
    expect(editorEl.querySelector('thead tr').cells[1].tagName).toBe('TH');

    setSelection(editorEl.querySelector('tbody tr').cells[0]);
    expect(tableInsertColLeft(editorEl).success).toBe(true);
    expect(editorEl.querySelector('tbody tr').cells).toHaveLength(4);
    expect(editorEl.querySelector('tbody tr').cells[0].textContent).toBe('');
    expect(editorEl.querySelector('tbody tr').cells[1].textContent).toBe('Eidg. Fachausweis');
  });

  it('unregelmässige Tabelle: Spalte einfügen ohne Versatz', () => {
    const editorEl = makeEditorDiv(
      '<table><tbody>' +
      '<tr><td>a1</td><td>a2</td><td>a3</td></tr>' +
      '<tr><td>b1</td></tr>' +
      '</tbody></table>'
    );
    const rows = editorEl.querySelectorAll('tr');
    setSelection(rows[0].cells[1]);

    expect(tableInsertColRight(editorEl).success).toBe(true);

    expect(rows[0].cells).toHaveLength(4);
    expect(rows[1].cells).toHaveLength(4);
    expect(rows[0].cells[3].textContent).toBe('a3');
    expect(rows[0].cells[2].textContent).toBe('');
    expect(rows[1].cells[0].textContent).toBe('b1');
    expect(rows[1].cells[2].textContent).toBe('');
  });

  it('unregelmässige Tabelle: Spalte löschen ohne Versatz', () => {
    const editorEl = makeEditorDiv(
      '<table><tbody>' +
      '<tr><td>a1</td><td>a2</td><td>a3</td></tr>' +
      '<tr><td>b1</td></tr>' +
      '</tbody></table>'
    );
    const rows = editorEl.querySelectorAll('tr');
    setSelection(rows[0].cells[1]);

    expect(tableDeleteCol(editorEl, { confirm: () => true }).success).toBe(true);

    expect(rows[0].cells).toHaveLength(2);
    expect(rows[1].cells).toHaveLength(2);
    expect(rows[0].cells[0].textContent).toBe('a1');
    expect(rows[0].cells[1].textContent).toBe('a3');
  });

  // -------------------------------------------------------------------------
  // Invariante: eine verneinte Sicherheitsabfrage verändert das DOM nicht
  //
  // Die Editor-Komponente ermittelt mit einem Probelauf — `confirm: () => false`
  // — ob überhaupt gefragt werden muss. Dieser Probelauf läuft beim ersten Klick
  // auf „Zeile/Spalte löschen" und darf deshalb nachweislich nichts verändern:
  // weder Zellen ergänzen oder entfernen noch Markup normalisieren. Steht vor
  // der Abfrage jemals eine DOM-Mutation, ist der erste Klick wieder eine stille
  // Änderung — genau der Fehler, den die Rückfrage vermeiden soll.
  // -------------------------------------------------------------------------
  describe('Probelauf: verneinte Bestätigung lässt das DOM unberührt', () => {
    /** Alle Attribute eines Elements als stabil sortierter Vergleichswert */
    function attrSnapshot(root) {
      return Array.from(root.querySelectorAll('*')).map((el) => (
        `${el.tagName}[${Array.from(el.attributes)
          .map((a) => `${a.name}=${a.value}`)
          .sort()
          .join(',')}]`
      ));
    }

    /** Zellzahl je Zeile — deckt Ergänzen und Entfernen einzeln auf */
    function cellCounts(table) {
      return Array.from(table.querySelectorAll('tr')).map((tr) => tr.children.length);
    }

    const FILLED_TABLE =
      '<table class="daten"><thead><tr><th scope="col">Qualifikation</th>' +
      '<th scope="col">Monatslohn</th></tr></thead>' +
      '<tbody>' +
      '<tr><td>Eidg. Fachausweis</td><td class="num">CHF 4600</td></tr>' +
      '<tr><td>Diplom</td><td class="num">CHF 5200</td></tr>' +
      '</tbody></table>';

    it('tableDeleteRowAt bricht ab und verändert die Tabelle byteweise nicht', () => {
      const editorEl = makeEditorDiv(FILLED_TABLE);
      const table = editorEl.querySelector('table');
      const cell = editorEl.querySelectorAll('tbody tr')[1].cells[0];

      const htmlBefore = table.outerHTML;
      const attrsBefore = attrSnapshot(table);
      const countsBefore = cellCounts(table);
      const rowsBefore = table.querySelectorAll('tr').length;

      const result = tableDeleteRowAt(cell, editorEl, { confirm: () => false });

      expect(result.success).toBe(false);
      expect(result.message).toBe(BLOCK_MESSAGES.cancelled);
      expect(table.outerHTML).toBe(htmlBefore);
      expect(attrSnapshot(table)).toEqual(attrsBefore);
      expect(cellCounts(table)).toEqual(countsBefore);
      expect(table.querySelectorAll('tr')).toHaveLength(rowsBefore);
      expect(cell.isConnected).toBe(true);
    });

    it('tableDeleteColAt bricht ab und verändert die Tabelle byteweise nicht', () => {
      const editorEl = makeEditorDiv(FILLED_TABLE);
      const table = editorEl.querySelector('table');
      const cell = editorEl.querySelector('tbody tr').cells[1];

      const htmlBefore = table.outerHTML;
      const attrsBefore = attrSnapshot(table);
      const countsBefore = cellCounts(table);

      const result = tableDeleteColAt(cell, editorEl, { confirm: () => false });

      expect(result.success).toBe(false);
      expect(result.message).toBe(BLOCK_MESSAGES.cancelled);
      expect(table.outerHTML).toBe(htmlBefore);
      expect(attrSnapshot(table)).toEqual(attrsBefore);
      expect(cellCounts(table)).toEqual(countsBefore);
      expect(cell.isConnected).toBe(true);
    });

    it('auch bei unregelmässigen Zeilen wird nichts aufgefüllt', () => {
      // padRow ist der einzige Mutator in deleteColIn — er darf erst nach der
      // Bestätigung laufen, sonst wächst die kurze Zeile schon beim Probelauf.
      const editorEl = makeEditorDiv(
        '<table><tbody>' +
        '<tr><td>a1</td><td>a2</td><td>a3</td></tr>' +
        '<tr><td>b1</td></tr>' +
        '</tbody></table>'
      );
      const table = editorEl.querySelector('table');
      const cell = table.querySelectorAll('tr')[0].cells[1];

      const htmlBefore = table.outerHTML;

      expect(tableDeleteColAt(cell, editorEl, { confirm: () => false }).success).toBe(false);

      expect(table.outerHTML).toBe(htmlBefore);
      expect(cellCounts(table)).toEqual([3, 1]);
    });

    it('die Bestätigung wird genau einmal und mit der erwarteten Meldung erfragt', () => {
      const editorEl = makeEditorDiv(FILLED_TABLE);
      const rowConfirm = vi.fn().mockReturnValue(false);
      const colConfirm = vi.fn().mockReturnValue(false);

      tableDeleteRowAt(
        editorEl.querySelectorAll('tbody tr')[1].cells[0], editorEl, { confirm: rowConfirm },
      );
      tableDeleteColAt(
        editorEl.querySelector('tbody tr').cells[1], editorEl, { confirm: colConfirm },
      );

      expect(rowConfirm).toHaveBeenCalledTimes(1);
      expect(rowConfirm).toHaveBeenCalledWith(BLOCK_MESSAGES.confirmRow);
      expect(colConfirm).toHaveBeenCalledTimes(1);
      expect(colConfirm).toHaveBeenCalledWith(BLOCK_MESSAGES.confirmCol);
      // Der injizierte Rückruf verdrängt den window.confirm-Rückfall vollständig
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('leere Zeilen und Spalten fragen gar nicht erst nach', () => {
      const editorEl = makeEditorDiv(
        '<table><thead><tr><th>K</th><th></th></tr></thead>' +
        '<tbody><tr><td>Wert</td><td></td></tr><tr><td></td><td></td></tr></tbody></table>'
      );
      const table = editorEl.querySelector('table');
      const emptyRow = table.querySelectorAll('tbody tr')[1];
      const confirmFn = vi.fn().mockReturnValue(false);

      // Leere Zeile: wird sofort gelöscht, ohne Rückfrage
      expect(tableDeleteRowAt(emptyRow.cells[0], editorEl, { confirm: confirmFn }).success)
        .toBe(true);
      expect(confirmFn).not.toHaveBeenCalled();
      expect(table.querySelectorAll('tbody tr')).toHaveLength(1);

      // Leere Spalte: ebenso
      expect(tableDeleteColAt(
        table.querySelector('tbody tr').cells[1], editorEl, { confirm: confirmFn },
      ).success).toBe(true);
      expect(confirmFn).not.toHaveBeenCalled();
      expect(table.querySelectorAll('thead th')).toHaveLength(1);
    });
  });

  it('Tabellenaktionen ohne Selektion in einer Tabelle bleiben wirkungslos', () => {
    const editorEl = makeEditorDiv('<p>Kein Tabellentext</p>');
    setSelection(editorEl.querySelector('p'));

    expect(tableInsertRowAbove(editorEl).success).toBe(false);
    expect(tableInsertRowBelow(editorEl).success).toBe(false);
    expect(tableDeleteRow(editorEl).success).toBe(false);
    expect(tableInsertColLeft(editorEl).success).toBe(false);
    expect(tableInsertColRight(editorEl).success).toBe(false);
    expect(tableDeleteCol(editorEl).success).toBe(false);
    expect(tableDeleteRow(editorEl).message).toBe(BLOCK_MESSAGES.notInTable);
  });
});

// ===========================================================================
// Konstanten
// ===========================================================================

describe('BLOCK_LABELS und BLOCK_MESSAGES', () => {
  it('enthält alle sechs Bausteinbezeichnungen', () => {
    expect(BLOCK_LABELS['info-box']).toBe('Info-Box');
    expect(BLOCK_LABELS['tip-box']).toBe('Tipp-Box');
    expect(BLOCK_LABELS['warning-box']).toBe('Hinweis / Warnung');
    expect(BLOCK_LABELS['checklist']).toBe('Checkliste');
    expect(BLOCK_LABELS['cta-box']).toBe('Kurs-Box');
    expect(BLOCK_LABELS['table']).toBe('Tabelle');
  });

  it('nennt die Kopfzeilen-Alternative in der Schutzmeldung', () => {
    expect(BLOCK_MESSAGES.headerRow).toContain('Kopfzeile ausschalten');
    expect(BLOCK_MESSAGES.confirmRow).toBe('Diese Tabellenzeile enthält Inhalt. Wirklich löschen?');
    expect(BLOCK_MESSAGES.confirmCol).toBe('Diese Tabellenspalte enthält Inhalt. Wirklich löschen?');
  });
});
