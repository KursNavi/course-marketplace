/**
 * Sicherheitsabfragen im AdminRichTextEditor ohne nativen Dialog.
 *
 * Hintergrund: `window.confirm()` hält den Renderer-Hauptthread an. Ein
 * Browser-Agent ohne Dialogbehandlung kehrt dann aus dem Eingabe-Dispatch nicht
 * zurück — die Seite wirkt eingefroren. Der Editor fragt deshalb ausschliesslich
 * über eine eigene Fläche in seiner Oberfläche nach.
 *
 * Geprüfte Pflichtszenarien:
 *   1  sichtbarer Bestätigungszustand (Rolle, Beschriftung, Startfokus)
 *   2  Abbrechen lässt DOM und onChange unberührt
 *   3  Escape bricht ab
 *   4  Bestätigen führt die Aktion genau einmal aus
 *   5  onChange-Verhalten je Aktion
 *   6  veraltetes / entferntes Ziel führt zu keiner Löschung
 *   7  Artikelwechsel schliesst eine offene Rückfrage
 *   8  Fokuswechsel vor der Bestätigung löscht kein anderes Ziel
 *   9  wiederholtes Bestätigen löst keine zweite Aktion aus
 *  10  keine Nutzung von window.confirm in der React-Komponente
 *  11  Bestätigungstexte gelangen nie in editor.innerHTML
 *  12  zwei Editorinstanzen vergeben eindeutige ARIA-IDs
 *  13  leere Zeile wird ohne Rückfrage gelöscht
 *  14  Wechsel der destruktiven Aktion bei offener Rückfrage
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';
import { BLOCK_MESSAGES } from '../src/components/admin/richTextBlockUtils';

// ---------------------------------------------------------------------------
// Mock-Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.execCommand = vi.fn().mockReturnValue(true);
  document.queryCommandState = vi.fn().mockReturnValue(false);
  document.queryCommandValue = vi.fn().mockReturnValue('');
  // Absichtlich als Spion gesetzt: jede Nutzung wäre eine Regression.
  window.confirm = vi.fn().mockReturnValue(true);
  clearSelection();
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Erster Textknoten (oder der Knoten selbst, z.B. bei leeren Zellen) */
function textNodeIn(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  return walker.nextNode() || node;
}

/** Simulierte Caret-Position */
function setSelection(anchor) {
  const anchorNode = textNodeIn(anchor);
  window.getSelection = vi.fn(() => ({
    rangeCount: 1,
    isCollapsed: true,
    anchorNode,
    focusNode: anchorNode,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
    getRangeAt: vi.fn(() => ({
      deleteContents: vi.fn(),
      insertNode: vi.fn(),
      collapse: vi.fn(),
      cloneRange: vi.fn(() => ({ collapse: vi.fn() })),
    })),
  }));
}

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

function renderEditor(value, onChange = vi.fn(), id = 'confirm-editor') {
  const utils = render(<AdminRichTextEditor value={value} onChange={onChange} id={id} />);
  return { editor: screen.getByTestId(id), onChange, rerender: utils.rerender, id };
}

/** Caret setzen und den Editor davon in Kenntnis setzen */
function focusBlock(editor, node) {
  setSelection(node);
  fireEvent.mouseUp(editor);
}

/** Aktionsleisten-Schalter (ToolBtn reagiert auf mouseDown) */
function clickBtn(testId) {
  fireEvent.mouseDown(screen.getByTestId(testId), { button: 0 });
}

const acceptConfirm = () => fireEvent.click(screen.getByTestId('block-confirm-accept'));
const cancelConfirm = () => fireEvent.click(screen.getByTestId('block-confirm-cancel'));
const confirmPanel = () => screen.queryByTestId('block-confirm');

const TABLE_HTML =
  '<table>' +
  '<thead><tr><th>Qualifikation</th><th>Monatslohn</th></tr></thead>' +
  '<tbody>' +
  '<tr><td>Eidg. Fachausweis</td><td>CHF 4600</td></tr>' +
  '<tr><td>Diplom</td><td>CHF 5200</td></tr>' +
  '</tbody></table>';

const BOX_HTML = '<div class="info-box"><h3>Titel</h3><p>Inhalt</p></div><p id="rest">Rest</p>';

/** Die vier bestätigungspflichtigen Aktionen mit passendem Ausgangsdokument */
const CONFIRMED_ACTIONS = [
  {
    name: 'Spalte löschen',
    testId: 'btn-del-col',
    html: TABLE_HTML,
    focus: (editor) => editor.querySelector('tbody tr').cells[1],
    message: BLOCK_MESSAGES.confirmCol,
  },
  {
    name: 'Zeile löschen',
    testId: 'btn-del-row',
    html: TABLE_HTML,
    focus: (editor) => editor.querySelectorAll('tbody tr')[1].cells[0],
    message: BLOCK_MESSAGES.confirmRow,
  },
  {
    name: 'Baustein löschen',
    testId: 'btn-delete-block',
    html: BOX_HTML,
    focus: (editor) => editor.querySelector('.info-box p'),
    message: '„Info-Box" vollständig löschen? Alle Inhalte gehen verloren.',
  },
  {
    name: 'Tabelle in Text umwandeln',
    testId: 'btn-table-to-text',
    html: TABLE_HTML,
    focus: (editor) => editor.querySelector('tbody td'),
    message: 'Tabelle in normalen Text umwandeln? Die Zellinhalte bleiben erhalten.',
  },
];

// ===========================================================================
// 1: Sichtbarer Bestätigungszustand
// ===========================================================================

describe('1 – Bestätigung erscheint statt eines nativen Dialogs', () => {
  CONFIRMED_ACTIONS.forEach(({ name, testId, html, focus, message }) => {
    it(`${name}: zeigt die Rückfrage und verändert zunächst nichts`, () => {
      const { editor, onChange } = renderEditor(html);
      const before = editor.innerHTML;
      focusBlock(editor, focus(editor));

      clickBtn(testId);

      expect(window.confirm).not.toHaveBeenCalled();
      expect(confirmPanel()).not.toBeNull();
      expect(screen.getByTestId('block-confirm-message').textContent).toBe(message);
      expect(editor.innerHTML).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('die Rückfrage ist als alertdialog zugänglich und programmatisch beschriftet', () => {
    const { editor } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');

    const panel = screen.getByRole('alertdialog');
    expect(panel).toBe(confirmPanel());

    const labelId = panel.getAttribute('aria-labelledby');
    const describedId = panel.getAttribute('aria-describedby');
    expect(document.getElementById(labelId)).toBe(screen.getByTestId('block-confirm-title'));
    expect(document.getElementById(describedId)).toBe(screen.getByTestId('block-confirm-message'));
    expect(screen.getByTestId('block-confirm-title').textContent).toBe('Baustein löschen');
  });

  it('der Startfokus liegt auf dem ungefährlichen Ausgang', () => {
    const { editor } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');

    expect(document.activeElement).toBe(screen.getByTestId('block-confirm-cancel'));
  });

  it('beide Schalter sind eindeutig beschriftet', () => {
    const { editor } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');

    expect(screen.getByTestId('block-confirm-cancel').textContent).toBe('Abbrechen');
    expect(screen.getByTestId('block-confirm-accept').textContent).toBe('Spalte löschen');
  });
});

// ===========================================================================
// 2/3: Abbrechen und Escape
// ===========================================================================

describe('2/3 – Abbrechen und Escape lassen alles unverändert', () => {
  CONFIRMED_ACTIONS.forEach(({ name, testId, html, focus }) => {
    it(`${name}: Abbrechen lässt DOM und onChange unberührt`, () => {
      const { editor, onChange } = renderEditor(html);
      focusBlock(editor, focus(editor));
      const before = editor.innerHTML;

      clickBtn(testId);
      cancelConfirm();

      expect(confirmPanel()).toBeNull();
      expect(editor.innerHTML).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it(`${name}: Escape bricht ab`, () => {
      const { editor, onChange } = renderEditor(html);
      focusBlock(editor, focus(editor));
      const before = editor.innerHTML;

      clickBtn(testId);
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(confirmPanel()).toBeNull();
      expect(editor.innerHTML).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('nach dem Abbrechen liegt der Fokus wieder im Editor', () => {
    const { editor } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');
    cancelConfirm();

    expect(document.activeElement).toBe(editor);
  });

  it('eine abgebrochene Rückfrage lässt sich erneut auslösen', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');
    cancelConfirm();
    clickBtn('btn-del-col');
    acceptConfirm();

    expect(editor.querySelector('tbody tr').cells).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 4/5: Bestätigen und onChange
// ===========================================================================

describe('4/5 – Bestätigen führt genau einmal aus', () => {
  it('Spalte löschen entfernt genau die Zielspalte', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');
    acceptConfirm();

    expect(editor.querySelectorAll('thead th')).toHaveLength(1);
    expect(editor.querySelector('tbody tr').cells).toHaveLength(1);
    expect(editor.textContent).not.toContain('CHF 4600');
    expect(editor.textContent).toContain('Eidg. Fachausweis');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Zeile löschen entfernt genau die Zielzeile', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelectorAll('tbody tr')[1].cells[0]);

    clickBtn('btn-del-row');
    acceptConfirm();

    expect(editor.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(editor.textContent).not.toContain('Diplom');
    expect(editor.textContent).toContain('Eidg. Fachausweis');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Baustein löschen entfernt nur den erfassten Baustein', () => {
    const { editor, onChange } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');
    acceptConfirm();

    expect(editor.querySelector('.info-box')).toBeNull();
    expect(editor.querySelector('#rest')).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Tabelle in Text erzeugt Absätze ohne Tabellenreste', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody td'));

    clickBtn('btn-table-to-text');
    acceptConfirm();

    expect(editor.querySelector('table')).toBeNull();
    expect(editor.querySelector('tr')).toBeNull();
    expect(editor.querySelector('td')).toBeNull();
    expect(editor.querySelectorAll('p').length).toBeGreaterThan(0);
    expect(editor.textContent).toContain('CHF 5200');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('leere Spalten bleiben ohne Rückfrage löschbar', () => {
    const { editor, onChange } = renderEditor(
      '<table><thead><tr><th>K</th><th></th></tr></thead>' +
      '<tbody><tr><td>Wert</td><td></td></tr></tbody></table>'
    );
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');

    expect(confirmPanel()).toBeNull();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(editor.querySelector('tbody tr').cells).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('nach dem Bestätigen liegt der Fokus wieder im Editor', () => {
    const { editor } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');
    acceptConfirm();

    expect(document.activeElement).toBe(editor);
  });
});

// ===========================================================================
// 6: Veraltetes Ziel
// ===========================================================================

describe('6 – veraltetes Ziel wird nicht ausgeführt', () => {
  it('ein zwischenzeitlich entfernter Baustein wird nicht gelöscht', () => {
    const { editor, onChange } = renderEditor(BOX_HTML);
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');

    // Ziel verschwindet zwischen Klick und Bestätigung
    editor.querySelector('.info-box').remove();
    const after = editor.innerHTML;

    acceptConfirm();

    expect(editor.innerHTML).toBe(after);
    expect(editor.querySelector('#rest')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(confirmPanel()).toBeNull();
    expect(screen.getByTestId('insert-error').textContent)
      .toContain(BLOCK_MESSAGES.staleBlock);
  });

  it('eine zwischenzeitlich ersetzte Tabelle wird nicht umgewandelt', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody td'));

    clickBtn('btn-table-to-text');

    // Gleiche Position, andere Struktur
    editor.innerHTML = '<p>Ersetzt</p>';
    const after = editor.innerHTML;

    acceptConfirm();

    expect(editor.innerHTML).toBe(after);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('eine zwischenzeitlich entfernte Zielzelle löscht keine Spalte', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    const target = editor.querySelector('tbody tr').cells[1];
    focusBlock(editor, target);

    clickBtn('btn-del-col');

    target.remove();
    const after = editor.innerHTML;

    acceptConfirm();

    expect(editor.innerHTML).toBe(after);
    expect(editor.querySelectorAll('thead th')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 7/8: Artikelwechsel und Fokuswechsel
// ===========================================================================

describe('7/8 – Kontextwechsel während einer offenen Rückfrage', () => {
  it('ein Artikelwechsel schliesst die Rückfrage und verwirft das Ziel', () => {
    const onChange = vi.fn();
    const { editor, rerender, id } = renderEditor(BOX_HTML, onChange);
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');
    expect(confirmPanel()).not.toBeNull();

    rerender(
      <AdminRichTextEditor value="<p>Artikel B</p>" onChange={onChange} id={id} />
    );

    expect(confirmPanel()).toBeNull();
    expect(editor.innerHTML).toBe('<p>Artikel B</p>');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ein Fokuswechsel vor der Bestätigung löscht kein anderes Ziel', () => {
    const { editor, onChange } = renderEditor(
      '<div class="info-box"><p>Erster</p></div>'
      + '<div class="tip-box"><p>Zweiter</p></div>'
    );
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');

    // Der Cursor wandert in einen anderen Baustein
    focusBlock(editor, editor.querySelector('.tip-box p'));

    acceptConfirm();

    expect(editor.querySelector('.info-box')).toBeNull();
    expect(editor.querySelector('.tip-box')).toBeTruthy();
    expect(editor.textContent).toContain('Zweiter');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ein Fokuswechsel in eine andere Tabellenzelle verschiebt die Zielspalte nicht', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');

    focusBlock(editor, editor.querySelector('tbody tr').cells[0]);

    acceptConfirm();

    // Gelöscht wird die erfasste zweite Spalte, nicht die inzwischen aktive
    expect(editor.textContent).not.toContain('CHF 4600');
    expect(editor.textContent).toContain('Eidg. Fachausweis');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 9: Wiederholtes Bestätigen
// ===========================================================================

describe('9 – wiederholtes Bestätigen bleibt folgenlos', () => {
  it('ein zweiter Klick auf denselben Schalter löscht nicht erneut', () => {
    const { editor, onChange } = renderEditor(
      '<div class="info-box"><p>Erster</p></div>'
      + '<div class="tip-box"><p>Zweiter</p></div>'
    );
    focusBlock(editor, editor.querySelector('.info-box p'));

    clickBtn('btn-delete-block');
    const acceptBtn = screen.getByTestId('block-confirm-accept');
    fireEvent.click(acceptBtn);
    fireEvent.click(acceptBtn);

    expect(editor.querySelector('.info-box')).toBeNull();
    expect(editor.querySelector('.tip-box')).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(confirmPanel()).toBeNull();
  });
});

// ===========================================================================
// 10/11: Kein nativer Dialog, keine Editor-Oberfläche im Artikel-HTML
// ===========================================================================

describe('10/11 – kein nativer Dialog, keine Oberfläche im gespeicherten HTML', () => {
  it('keine der vier Aktionen erreicht window.confirm', () => {
    CONFIRMED_ACTIONS.forEach(({ testId, html, focus }) => {
      const { editor } = renderEditor(html, vi.fn(), `no-native-${testId}`);
      focusBlock(editor, focus(editor));

      clickBtn(testId);
      acceptConfirm();

      cleanup();
    });

    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('die Quelle der React-Komponente ruft weder window.confirm noch confirm', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/admin/AdminRichTextEditor.jsx'),
      'utf8',
    );

    expect(source).not.toMatch(/window\s*\.\s*confirm\s*\(/);
    expect(source).not.toMatch(/(?:^|[^\w.$])confirm\s*\(/m);
  });

  it('Bestätigungstexte gelangen nicht in das Artikel-HTML', () => {
    const onChange = vi.fn();
    const { editor } = renderEditor(TABLE_HTML, onChange);
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');
    // Sichtbar in der Oberfläche …
    expect(screen.getByTestId('block-confirm-message')).toBeTruthy();
    // … aber nicht im Editorinhalt
    expect(editor.innerHTML).not.toContain('Abbrechen');
    expect(editor.innerHTML).not.toContain('alertdialog');
    expect(editor.innerHTML).not.toContain(BLOCK_MESSAGES.confirmCol);

    acceptConfirm();

    const emitted = onChange.mock.calls[0][0];
    expect(emitted).not.toContain('Abbrechen');
    expect(emitted).not.toContain('block-confirm');
    expect(emitted).not.toContain(BLOCK_MESSAGES.confirmCol);
  });
});

// ===========================================================================
// 12: Mehrere Editorinstanzen auf derselben Seite
// ===========================================================================

describe('12 – zwei Editorinstanzen vergeben eindeutige ARIA-IDs', () => {
  /** Rendert eine Instanz und liefert Container plus Editorknoten */
  function renderInstance(id, html) {
    const { container } = render(
      <AdminRichTextEditor value={html} onChange={vi.fn()} id={id} />
    );
    return { container, editor: container.querySelector(`[data-testid="${id}"]`) };
  }

  /** Rückfrage in genau dieser Instanz öffnen */
  function openConfirmIn({ container, editor }) {
    focusBlock(editor, editor.querySelector('.info-box p'));
    fireEvent.mouseDown(within(container).getByTestId('btn-delete-block'), { button: 0 });
    return within(container).getByTestId('block-confirm');
  }

  it('beide offenen Rückfragen sind eindeutig und richtig beschriftet', () => {
    const a = renderInstance('editor-a', BOX_HTML);
    const b = renderInstance('editor-b', BOX_HTML);

    const panelA = openConfirmIn(a);
    // Die erste Rückfrage bleibt offen, während die zweite geöffnet wird
    const panelB = openConfirmIn(b);
    expect(panelA.isConnected).toBe(true);

    expect(panelA.getAttribute('role')).toBe('alertdialog');
    expect(panelB.getAttribute('role')).toBe('alertdialog');

    const labelA = panelA.getAttribute('aria-labelledby');
    const labelB = panelB.getAttribute('aria-labelledby');
    const describedA = panelA.getAttribute('aria-describedby');
    const describedB = panelB.getAttribute('aria-describedby');

    // Eindeutig je Instanz
    expect(labelA).toBeTruthy();
    expect(describedA).toBeTruthy();
    expect(labelA).not.toBe(labelB);
    expect(describedA).not.toBe(describedB);

    // Keine ID kommt im Dokument doppelt vor
    for (const id of [labelA, labelB, describedA, describedB]) {
      expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
    }

    // Jede Referenz zeigt auf das Element der eigenen Instanz
    expect(document.getElementById(labelA))
      .toBe(within(a.container).getByTestId('block-confirm-title'));
    expect(document.getElementById(describedA))
      .toBe(within(a.container).getByTestId('block-confirm-message'));
    expect(a.container.contains(document.getElementById(labelA))).toBe(true);
    expect(b.container.contains(document.getElementById(labelA))).toBe(false);

    expect(document.getElementById(labelB))
      .toBe(within(b.container).getByTestId('block-confirm-title'));
    expect(document.getElementById(describedB))
      .toBe(within(b.container).getByTestId('block-confirm-message'));
    expect(b.container.contains(document.getElementById(labelB))).toBe(true);
    expect(a.container.contains(document.getElementById(labelB))).toBe(false);
  });

  it('das Bestätigen in einer Instanz verändert die andere nicht', () => {
    const a = renderInstance('editor-a', BOX_HTML);
    const b = renderInstance('editor-b', BOX_HTML);

    openConfirmIn(a);
    openConfirmIn(b);

    fireEvent.click(within(b.container).getByTestId('block-confirm-accept'));

    // Nur Instanz B hat gelöscht, A behält Baustein und offene Rückfrage
    expect(b.editor.querySelector('.info-box')).toBeNull();
    expect(a.editor.querySelector('.info-box')).toBeTruthy();
    expect(within(a.container).queryByTestId('block-confirm')).not.toBeNull();
    expect(within(b.container).queryByTestId('block-confirm')).toBeNull();
  });
});

// ===========================================================================
// 13: Leere Zeile ohne Rückfrage
// ===========================================================================

describe('13 – leere Zeile wird ohne Rückfrage gelöscht', () => {
  const TABLE_WITH_EMPTY_ROW =
    '<table><thead><tr><th>Qualifikation</th><th>Monatslohn</th></tr></thead>' +
    '<tbody>' +
    '<tr><td>Eidg. Fachausweis</td><td>CHF 4600</td></tr>' +
    '<tr><td></td><td></td></tr>' +
    '</tbody></table>';

  it('entfernt genau die leere Zielzeile und meldet genau einmal', () => {
    const { editor, onChange } = renderEditor(TABLE_WITH_EMPTY_ROW);
    const emptyRow = editor.querySelectorAll('tbody tr')[1];
    focusBlock(editor, emptyRow.cells[0]);

    clickBtn('btn-del-row');

    // Keine Rückfrage, kein nativer Dialog
    expect(confirmPanel()).toBeNull();
    expect(window.confirm).not.toHaveBeenCalled();

    // Genau die leere Zeile ist fort, die gefüllte bleibt vollständig
    expect(emptyRow.isConnected).toBe(false);
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(editor.textContent).toContain('Eidg. Fachausweis');
    expect(editor.textContent).toContain('CHF 4600');
    expect(editor.querySelectorAll('thead th')).toHaveLength(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('insert-error')).toBeNull();
  });
});

// ===========================================================================
// 14: Wechsel der destruktiven Aktion bei offener Rückfrage
// ===========================================================================

describe('14 – eine zweite destruktive Aktion ersetzt die offene Rückfrage', () => {
  it('nur die zuletzt gewählte Aktion bleibt erfasst und wird ausgeführt', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    // Ziel der ersten Aktion: zweite Spalte der ersten Datenzeile
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');
    expect(screen.getByTestId('block-confirm-title').textContent).toBe('Spalte löschen');
    expect(screen.getByTestId('block-confirm-message').textContent)
      .toBe(BLOCK_MESSAGES.confirmCol);

    // Ohne Bestätigen die zweite destruktive Aktion auslösen
    clickBtn('btn-del-row');

    // Weiterhin genau eine Rückfrage — und zwar die der zweiten Aktion
    expect(screen.getAllByTestId('block-confirm')).toHaveLength(1);
    expect(screen.getByTestId('block-confirm-title').textContent).toBe('Zeile löschen');
    expect(screen.getByTestId('block-confirm-message').textContent)
      .toBe(BLOCK_MESSAGES.confirmRow);

    // Bis hierher wurde nichts verändert
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(editor.querySelector('tbody tr').cells).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();

    acceptConfirm();

    // Ausgeführt wurde ausschliesslich die zweite Aktion: die Zeile ist fort,
    // die Spalte der ersten Aktion steht unverändert.
    expect(editor.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(editor.textContent).not.toContain('Eidg. Fachausweis');
    expect(editor.querySelectorAll('thead th')).toHaveLength(2);
    expect(editor.querySelector('tbody tr').cells).toHaveLength(2);
    expect(editor.textContent).toContain('CHF 5200');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('der Wechsel auf „Baustein löschen" verwirft das Tabellenziel', () => {
    const { editor, onChange } = renderEditor(TABLE_HTML);
    focusBlock(editor, editor.querySelector('tbody tr').cells[1]);

    clickBtn('btn-del-col');
    clickBtn('btn-delete-block');

    expect(screen.getAllByTestId('block-confirm')).toHaveLength(1);
    expect(screen.getByTestId('block-confirm-title').textContent).toBe('Baustein löschen');
    expect(onChange).not.toHaveBeenCalled();

    acceptConfirm();

    // Die gesamte Tabelle ist fort — keine halb ausgeführte Spaltenlöschung
    expect(editor.querySelector('table')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
