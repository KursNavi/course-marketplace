/**
 * Tests für drei gezielte Korrekturen am Themenwelt-Artikel-Editor.
 *
 * A  Schutz vor unbeabsichtigter blockübergreifender Auswahl (Chromium)
 * B  Direkte Textknoten unterhalb des Editor-Roots beim Baustein-Einfügen
 * C  Schliessen des Baustein-Menüs
 *
 * Anders als tests/rich-text-blocks.test.jsx arbeitet diese Datei mit der
 * echten Selection- und Range-Implementierung der Testumgebung. Nur so lässt
 * sich prüfen, ob die Auswahl tatsächlich begrenzt wird.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';
import {
  CLAMP_REASONS,
  clampBoundarySelection,
  findBoundaryOverreach,
  insertBlock,
  isTextInsertingInputType,
  wrapTopLevelTextNodes,
} from '../src/components/admin/richTextBlockUtils';

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

/** Die echte Selection der Testumgebung — nicht der Spion anderer Testdateien */
const nativeGetSelection = window.getSelection.bind(window);

beforeEach(() => {
  document.execCommand = vi.fn().mockReturnValue(true);
  document.queryCommandState = vi.fn().mockReturnValue(false);
  document.queryCommandValue = vi.fn().mockReturnValue('');
  window.confirm = vi.fn().mockReturnValue(true);
  window.getSelection = nativeGetSelection;
  nativeGetSelection().removeAllRanges();
});

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-scratch]').forEach((el) => el.remove());
  nativeGetSelection().removeAllRanges();
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Editor-Element ausserhalb von React, für reine Hilfsfunktionstests */
function makeEditorDiv(innerHTML = '') {
  const div = document.createElement('div');
  div.setAttribute('contenteditable', 'true');
  div.setAttribute('data-test-scratch', 'true');
  div.innerHTML = innerHTML;
  document.body.appendChild(div);
  return div;
}

/** Setzt eine echte Vorwärtsauswahl und liefert den aktiven Bereich */
function selectForward(startNode, startOffset, endNode, endOffset) {
  const sel = nativeGetSelection();
  sel.removeAllRanges();
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  sel.addRange(range);
  return sel;
}

/** Setzt dieselbe Auswahl rückwärts gezogen (Anker am Ende) */
function selectBackward(startNode, startOffset, endNode, endOffset) {
  const sel = nativeGetSelection();
  sel.removeAllRanges();
  sel.setBaseAndExtent(endNode, endOffset, startNode, startOffset);
  return sel;
}

/** Löst ein echtes beforeinput-Ereignis am Editor aus */
function fireBeforeInput(editor, inputType = 'insertText', data = 'QA Info-Box') {
  const event = new window.InputEvent('beforeinput', {
    inputType,
    data,
    bubbles: true,
    cancelable: true,
  });
  editor.dispatchEvent(event);
  return event;
}

/** Rendert den Editor und liefert Editor-Element sowie onChange-Spion */
function renderEditor(value = '', onChange = vi.fn(), id = 'test-editor') {
  const utils = render(<AdminRichTextEditor value={value} onChange={onChange} id={id} />);
  return { editor: screen.getByTestId(id), onChange, unmount: utils.unmount };
}

function clickBtn(testId) {
  fireEvent.mouseDown(screen.getByTestId(testId), { button: 0 });
}

const INFO_BOX_HTML =
  '<div class="info-box"><h3>Information</h3><p>Inhalt der Informationsbox.</p></div>';

/** Bausteinloser Aufbau mit denselben Blöcken auf oberster Ebene */
const PLAIN_HTML = '<h3>Information</h3><p>Inhalt der Informationsbox.</p>';

// ===========================================================================
// A – Schutz vor unbeabsichtigter blockübergreifender Auswahl
// ===========================================================================

describe('A1/A2 – Grenzfall wird in beide Ziehrichtungen begrenzt', () => {
  it('Vorwärtsauswahl von h3 bis Offset 0 des folgenden p wird auf h3 begrenzt', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p, 0);
    const result = clampBoundarySelection(editor, sel, 'insertText');

    expect(result.clamped).toBe(true);
    expect(result.reason).toBe(CLAMP_REASONS.clamped);

    const range = sel.getRangeAt(0);
    expect(h3.contains(range.endContainer)).toBe(true);
    expect(range.toString()).toBe('Information');
    // Die Richtung bleibt: Anker vorne, Fokus hinten
    expect(sel.anchorNode).toBe(h3.firstChild);
    expect(sel.anchorOffset).toBe(0);
  });

  it('Auswahl bis Offset 0 des Textknotens im folgenden p wird ebenso begrenzt', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p.firstChild, 0);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(true);
    expect(sel.getRangeAt(0).toString()).toBe('Information');
  });

  it('Auswahl, die an der reinen Blockgrenze im Elternknoten endet, wird begrenzt', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const box = editor.querySelector('.info-box');
    const h3 = editor.querySelector('h3');

    // Ende im gemeinsamen Elternknoten, exakt vor dem p (Kindindex 1)
    const sel = selectForward(h3.firstChild, 0, box, 1);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(true);
    expect(sel.getRangeAt(0).toString()).toBe('Information');
  });

  it('Rückwärtsauswahl desselben Grenzfalls wird begrenzt und behält die Richtung', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectBackward(h3.firstChild, 0, p, 0);
    // Vorbedingung: der Anker liegt tatsächlich am Ende des Bereichs
    expect(sel.anchorNode).toBe(p);

    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(true);

    const range = sel.getRangeAt(0);
    expect(range.toString()).toBe('Information');
    expect(h3.contains(range.endContainer)).toBe(true);
    // Rückwärts gezogen: der Anker sitzt weiterhin am Ende
    expect(h3.contains(sel.anchorNode)).toBe(true);
    expect(sel.focusNode).toBe(h3.firstChild);
    expect(sel.focusOffset).toBe(0);
  });

  it('greift auch ohne umschliessenden Baustein auf oberster Ebene', () => {
    const editor = makeEditorDiv(PLAIN_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p, 0);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(true);
    expect(sel.getRangeAt(0).toString()).toBe('Information');
  });

  it('greift auch bei einem nackten vorausgehenden Textknoten im Root', () => {
    const editor = makeEditorDiv(`QA-Ausgangstext A.${INFO_BOX_HTML}`);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p, 0);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(true);
    expect(sel.getRangeAt(0).toString()).toBe('Information');
    // Der vorangehende Text bleibt unangetastet
    expect(editor.textContent).toContain('QA-Ausgangstext A.');
  });
});

describe('A3/A4 – gewöhnliche Auswahl bleibt unverändert', () => {
  it('Auswahl vollständig innerhalb h3 wird nicht angefasst', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');

    const sel = selectForward(h3.firstChild, 0, h3.firstChild, 4);
    const result = clampBoundarySelection(editor, sel, 'insertText');

    expect(result.clamped).toBe(false);
    expect(result.reason).toBe(CLAMP_REASONS.noBoundary);
    expect(sel.getRangeAt(0).toString()).toBe('Info');
  });

  it('Caret ohne Auswahl wird nicht angefasst', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');

    const sel = selectForward(h3.firstChild, 3, h3.firstChild, 3);
    const result = clampBoundarySelection(editor, sel, 'insertText');

    expect(result.clamped).toBe(false);
    expect(result.reason).toBe(CLAMP_REASONS.collapsed);
    expect(sel.getRangeAt(0).collapsed).toBe(true);
    expect(sel.getRangeAt(0).startOffset).toBe(3);
  });

  it('gar keine Selektion führt zu keiner Aktion', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const sel = nativeGetSelection();
    sel.removeAllRanges();

    expect(clampBoundarySelection(editor, sel, 'insertText')).toEqual({
      clamped: false,
      reason: CLAMP_REASONS.noSelection,
    });
  });
});

describe('A5 – bewusst gezogene Mehrblockauswahl wird nie verkürzt', () => {
  it('Auswahl mit sichtbarem Text aus h3 und p bleibt vollständig', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p.firstChild, 7);
    const result = clampBoundarySelection(editor, sel, 'insertText');

    expect(result.clamped).toBe(false);
    expect(result.reason).toBe(CLAMP_REASONS.noBoundary);
    expect(sel.getRangeAt(0).toString()).toBe('InformationInhalt ');
  });

  it('Auswahl über den ganzen Folgeabsatz hinaus bleibt vollständig', () => {
    const editor = makeEditorDiv(
      '<p>Erster Absatz.</p><p>Zweiter Absatz.</p><p>Dritter Absatz.</p>'
    );
    const [first, , third] = Array.from(editor.querySelectorAll('p'));

    const sel = selectForward(first.firstChild, 0, third.firstChild, 7);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(false);
    expect(sel.getRangeAt(0).toString()).toContain('Zweiter Absatz.');
  });

  it('ein einzelnes sichtbares Zeichen im Folgeblock verhindert die Korrektur', () => {
    const editor = makeEditorDiv(PLAIN_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p.firstChild, 1);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(false);
    expect(sel.getRangeAt(0).toString()).toBe('InformationI');
  });

  it('ein ausgewähltes Bild im Folgeblock verhindert die Korrektur', () => {
    const editor = makeEditorDiv(
      '<h3>Information</h3><p><img src="/bild.png" alt="Bild">Text.</p>'
    );
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    // Ende hinter dem img — sichtbarer Inhalt, obwohl ohne Text
    const sel = selectForward(h3.firstChild, 0, p, 1);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(false);
    expect(editor.querySelector('img')).not.toBeNull();
  });
});

describe('A6/A7/A8 – Sonderfälle bleiben unangetastet', () => {
  it('Auswahl über verschiedene Spezialbausteine wird nicht verändert', () => {
    const editor = makeEditorDiv(
      '<div class="info-box"><h3>Information</h3></div>'
      + '<div class="tip-box"><p>Tipp-Inhalt.</p></div>'
    );
    const h3 = editor.querySelector('.info-box h3');
    const p = editor.querySelector('.tip-box p');

    const sel = selectForward(h3.firstChild, 0, p, 0);
    const result = clampBoundarySelection(editor, sel, 'insertText');

    expect(result.clamped).toBe(false);
    expect(result.reason).toBe(CLAMP_REASONS.noBoundary);
  });

  it('Auswahl ausserhalb des Editors wird nicht verändert', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const outside = document.createElement('div');
    outside.setAttribute('data-test-scratch', 'true');
    outside.innerHTML = '<h3>Fremd</h3><p>Fremder Absatz.</p>';
    document.body.appendChild(outside);

    const h3 = outside.querySelector('h3');
    const p = outside.querySelector('p');
    const sel = selectForward(h3.firstChild, 0, p, 0);

    const result = clampBoundarySelection(editor, sel, 'insertText');
    expect(result.clamped).toBe(false);
    expect(result.reason).toBe(CLAMP_REASONS.noBoundary);
    expect(sel.getRangeAt(0).endContainer).toBe(p);
  });

  it('Auswahl zwischen Absätzen einer Tabellenzelle wird nicht verändert', () => {
    const editor = makeEditorDiv(
      '<table><tbody><tr><td><p>Erster Text.</p><p>Zweiter Text.</p></td></tr></tbody></table>'
    );
    const [first, second] = Array.from(editor.querySelectorAll('td p'));

    const sel = selectForward(first.firstChild, 0, second, 0);
    const result = clampBoundarySelection(editor, sel, 'insertText');

    expect(result.clamped).toBe(false);
    expect(result.reason).toBe(CLAMP_REASONS.noBoundary);
    expect(sel.getRangeAt(0).endContainer).toBe(second);
  });

  it('Auswahl über zwei Tabellenzellen wird nicht verändert', () => {
    const editor = makeEditorDiv(
      '<table><tbody><tr><td><p>Zelle A</p></td><td><p>Zelle B</p></td></tr></tbody></table>'
    );
    const [a, b] = Array.from(editor.querySelectorAll('td p'));

    const sel = selectForward(a.firstChild, 0, b, 0);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(false);
  });
});

describe('A – nur textsetzende Eingabetypen lösen den Schutz aus', () => {
  const clamping = ['insertText', 'insertReplacementText', 'insertCompositionText'];
  const ignored = [
    'deleteContentBackward', 'deleteContentForward', 'deleteByCut',
    'insertParagraph', 'insertLineBreak', 'formatBold', 'historyUndo',
    'insertFromPaste', 'irgendwasUnbekanntes', undefined, null, '',
  ];

  clamping.forEach((type) => {
    it(`${type} wird als textsetzend erkannt und begrenzt`, () => {
      const editor = makeEditorDiv(INFO_BOX_HTML);
      const h3 = editor.querySelector('h3');
      const p = editor.querySelector('p');
      const sel = selectForward(h3.firstChild, 0, p, 0);

      expect(isTextInsertingInputType(type)).toBe(true);
      expect(clampBoundarySelection(editor, sel, type).clamped).toBe(true);
    });
  });

  ignored.forEach((type) => {
    it(`${String(type)} lässt die Auswahl unverändert`, () => {
      const editor = makeEditorDiv(INFO_BOX_HTML);
      const h3 = editor.querySelector('h3');
      const p = editor.querySelector('p');
      const sel = selectForward(h3.firstChild, 0, p, 0);

      expect(isTextInsertingInputType(type)).toBe(false);
      const result = clampBoundarySelection(editor, sel, type);
      expect(result.clamped).toBe(false);
      expect(result.reason).toBe(CLAMP_REASONS.unsupported);
      expect(sel.getRangeAt(0).endContainer).toBe(p);
    });
  });
});

describe('A – findBoundaryOverreach als reine Analyse', () => {
  it('verändert die übergebene Auswahl nicht', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');
    const sel = selectForward(h3.firstChild, 0, p, 0);
    const range = sel.getRangeAt(0);

    const target = findBoundaryOverreach(editor, range);

    expect(target).not.toBeNull();
    expect(target.node).toBe(h3.firstChild);
    expect(target.offset).toBe('Information'.length);
    // Die Analyse selbst hat nichts begrenzt
    expect(range.endContainer).toBe(p);
    expect(range.endOffset).toBe(0);
  });

  it('liefert null ohne Editor und ohne Bereich', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    expect(findBoundaryOverreach(null, document.createRange())).toBeNull();
    expect(findBoundaryOverreach(editor, null)).toBeNull();
  });
});

describe('A9 – nach der Korrektur bleiben beide Blöcke eigenständig', () => {
  it('Texteingabe ersetzt nur die Überschrift, der Absatz bleibt vollständig', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p, 0);
    expect(clampBoundarySelection(editor, sel, 'insertText').clamped).toBe(true);

    // Das, was der Browser nach der Korrektur tut: Auswahl löschen, Text setzen
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode('QA Info-Box'));

    expect(editor.querySelectorAll('h3')).toHaveLength(1);
    expect(editor.querySelectorAll('p')).toHaveLength(1);
    expect(editor.querySelector('h3').textContent).toBe('QA Info-Box');
    expect(editor.querySelector('p').textContent).toBe('Inhalt der Informationsbox.');
    expect(editor.querySelector('h3').querySelector('p')).toBeNull();
  });

  it('ohne Korrektur reicht die Auswahl über die Blockgrenze hinaus', () => {
    const editor = makeEditorDiv(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const range = selectForward(h3.firstChild, 0, p, 0).getRangeAt(0);

    // Genau diese Ausgangslage zieht Chromium beim Einsetzen von Text den
    // Folgeabsatz in die Überschrift. Die Auswirkung der nativen Editier-Engine
    // lässt sich hier nicht nachbilden — dafür läuft die echte
    // Chromium-Reproduktion in playwright/. Nachgewiesen wird die Vorbedingung:
    // das Ende liegt im Folgeblock, obwohl dort nichts Sichtbares ausgewählt ist.
    expect(h3.contains(range.endContainer)).toBe(false);
    expect(p.contains(range.endContainer) || range.endContainer === p).toBe(true);
    expect(range.toString()).toBe('Information');
  });
});

describe('A10 – die Selektionskorrektur meldet keine Änderung', () => {
  it('beforeinput ohne echte Eingabe löst kein onChange aus', () => {
    const { editor, onChange } = renderEditor(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');
    const before = editor.innerHTML;

    selectForward(h3.firstChild, 0, p, 0);
    const event = fireBeforeInput(editor, 'insertText');

    expect(onChange).not.toHaveBeenCalled();
    expect(editor.innerHTML).toBe(before);
    // Der Browser darf normal weiterarbeiten
    expect(event.defaultPrevented).toBe(false);
  });

  it('der Editor begrenzt die Auswahl bei beforeinput tatsächlich', () => {
    const { editor } = renderEditor(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p, 0);
    fireBeforeInput(editor, 'insertText');

    expect(h3.contains(sel.getRangeAt(0).endContainer)).toBe(true);
    expect(sel.getRangeAt(0).toString()).toBe('Information');
  });

  it('beforeinput mit Löschtyp lässt die Auswahl unverändert', () => {
    const { editor, onChange } = renderEditor(INFO_BOX_HTML);
    const h3 = editor.querySelector('h3');
    const p = editor.querySelector('p');

    const sel = selectForward(h3.firstChild, 0, p, 0);
    fireBeforeInput(editor, 'deleteContentBackward', null);

    expect(sel.getRangeAt(0).endContainer).toBe(p);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('der beforeinput-Listener wird beim Unmount entfernt', () => {
    const editorHost = makeEditorDiv();
    const addSpy = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const removeSpy = vi.spyOn(HTMLElement.prototype, 'removeEventListener');

    const { unmount } = renderEditor(INFO_BOX_HTML);
    const added = addSpy.mock.calls.filter(([type]) => type === 'beforeinput');
    expect(added.length).toBe(1);

    unmount();
    const removed = removeSpy.mock.calls.filter(([type]) => type === 'beforeinput');
    expect(removed.length).toBe(1);
    expect(removed[0][1]).toBe(added[0][1]);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    editorHost.remove();
  });
});

// ===========================================================================
// B – Direkte Textknoten unterhalb des Editor-Roots
// ===========================================================================

describe('B1/B2/B3 – Verpacken erst bei der Benutzeraktion', () => {
  it('blosses Laden verändert einen direkten Textknoten nicht', () => {
    const { editor, onChange } = renderEditor('QA-Ausgangstext A.');

    expect(editor.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    expect(editor.querySelector('p')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('auch ein externer value-Wechsel normalisiert nicht', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AdminRichTextEditor value="<p>Alt.</p>" onChange={onChange} id="test-editor" />
    );
    rerender(
      <AdminRichTextEditor value="QA-Ausgangstext A." onChange={onChange} id="test-editor" />
    );

    const editor = screen.getByTestId('test-editor');
    expect(editor.querySelector('p')).toBeNull();
    expect(editor.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('erst insertBlock verpackt den Textknoten in einen Absatz', () => {
    const editor = makeEditorDiv('QA-Ausgangstext A.');
    const textNode = editor.firstChild;
    selectForward(textNode, 3, textNode, 3);

    const result = insertBlock('info-box', editor);

    expect(result.success).toBe(true);
    expect(editor.children[0].tagName).toBe('P');
    expect(editor.children[0].textContent).toBe('QA-Ausgangstext A.');
    // Derselbe Knoten, nur verschoben — der Text ist zeichengenau erhalten
    expect(editor.children[0].firstChild).toBe(textNode);
  });
});

describe('B4/B5 – Reihenfolge und Einfügeposition', () => {
  it('der Baustein wird nach dem erzeugten Absatz eingefügt', () => {
    const editor = makeEditorDiv('QA-Ausgangstext A.');
    selectForward(editor.firstChild, 0, editor.firstChild, 0);

    expect(insertBlock('info-box', editor).success).toBe(true);

    expect(editor.children).toHaveLength(2);
    expect(editor.children[0].tagName).toBe('P');
    expect(editor.children[0].textContent).toBe('QA-Ausgangstext A.');
    expect(editor.children[1].className).toBe('info-box');
    // Der Ausgangstext ist weder gelöscht noch in den Baustein gewandert
    expect(editor.children[1].textContent).not.toContain('QA-Ausgangstext');
  });

  it('mehrere direkte Textknoten behalten ihre Reihenfolge', () => {
    const editor = makeEditorDiv('');
    editor.appendChild(document.createTextNode('Erster Text.'));
    editor.appendChild(document.createElement('hr'));
    editor.appendChild(document.createTextNode('Zweiter Text.'));
    editor.appendChild(document.createTextNode('Dritter Text.'));

    const result = wrapTopLevelTextNodes(editor);

    expect(result).toEqual({ changed: true, wrapped: 3 });
    expect(Array.from(editor.children).map((el) => el.tagName))
      .toEqual(['P', 'HR', 'P', 'P']);
    expect(Array.from(editor.querySelectorAll('p')).map((el) => el.textContent))
      .toEqual(['Erster Text.', 'Zweiter Text.', 'Dritter Text.']);
    expect(editor.textContent).toBe('Erster Text.Zweiter Text.Dritter Text.');
  });

  it('der Baustein landet hinter dem Absatz des Carets, nicht am Ende', () => {
    const editor = makeEditorDiv('');
    editor.appendChild(document.createTextNode('Erster Text.'));
    editor.appendChild(document.createTextNode('Zweiter Text.'));
    const first = editor.firstChild;
    selectForward(first, 2, first, 2);

    expect(insertBlock('tip-box', editor).success).toBe(true);

    expect(Array.from(editor.children).map((el) => el.tagName))
      .toEqual(['P', 'DIV', 'P']);
    expect(editor.children[0].textContent).toBe('Erster Text.');
    expect(editor.children[1].className).toBe('tip-box');
    expect(editor.children[2].textContent).toBe('Zweiter Text.');
  });
});

describe('B6/B7 – bestehende Struktur und Leerraum', () => {
  it('vorhandene Absätze werden nicht doppelt verpackt', () => {
    const editor = makeEditorDiv('<p>Bereits ein Absatz.</p><h3>Titel</h3>');
    const before = editor.innerHTML;

    expect(wrapTopLevelTextNodes(editor)).toEqual({ changed: false, wrapped: 0 });
    expect(editor.innerHTML).toBe(before);
    expect(editor.querySelectorAll('p')).toHaveLength(1);
    expect(editor.querySelector('p > p')).toBeNull();
  });

  it('reine Leerraum-Knoten erzeugen keine leeren Absätze', () => {
    const editor = makeEditorDiv('<p>Erster.</p>\n  \n<p>Zweiter.</p>');

    expect(wrapTopLevelTextNodes(editor)).toEqual({ changed: false, wrapped: 0 });
    expect(editor.querySelectorAll('p')).toHaveLength(2);
    expect(Array.from(editor.querySelectorAll('p')).every((p) => p.textContent.trim()))
      .toBe(true);
  });

  it('Leerraum um einen sichtbaren Textknoten bleibt sichtbarer Inhalt', () => {
    const editor = makeEditorDiv('');
    editor.appendChild(document.createTextNode('  QA-Ausgangstext A.  '));

    expect(wrapTopLevelTextNodes(editor)).toEqual({ changed: true, wrapped: 1 });
    expect(editor.querySelector('p').textContent).toBe('  QA-Ausgangstext A.  ');
  });

  it('ohne Editor-Element passiert nichts', () => {
    expect(wrapTopLevelTextNodes(null)).toEqual({ changed: false, wrapped: 0 });
  });
});

describe('B8/B9 – Meldung und Wiederholung', () => {
  it('die gesamte Einfügeaktion meldet genau einmal eine Änderung', () => {
    const { editor, onChange } = renderEditor('QA-Ausgangstext A.');
    const textNode = editor.firstChild;
    selectForward(textNode, 0, textNode, 0);

    clickBtn('btn-insert-block');
    fireEvent.click(screen.getByTestId('insert-info-box'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const html = onChange.mock.calls[0][0];
    expect(html).toContain('<p>QA-Ausgangstext A.</p>');
    expect(html).toContain('info-box');
    expect(editor.querySelector('p').textContent).toBe('QA-Ausgangstext A.');
  });

  it('wiederholtes Einfügen dupliziert den Ausgangstext nicht', () => {
    const editor = makeEditorDiv('QA-Ausgangstext A.');
    selectForward(editor.firstChild, 0, editor.firstChild, 0);
    expect(insertBlock('info-box', editor).success).toBe(true);

    const paragraph = editor.querySelector('p');
    selectForward(paragraph.firstChild, 0, paragraph.firstChild, 0);
    expect(insertBlock('tip-box', editor).success).toBe(true);

    const texts = Array.from(editor.childNodes)
      .filter((n) => n.textContent === 'QA-Ausgangstext A.');
    expect(texts).toHaveLength(1);
    expect(editor.textContent.match(/QA-Ausgangstext A\./g)).toHaveLength(1);
    expect(editor.querySelectorAll('.info-box')).toHaveLength(1);
    expect(editor.querySelectorAll('.tip-box')).toHaveLength(1);
  });

  it('ein abgelehnter Einfügeversuch verpackt nichts', () => {
    const editor = makeEditorDiv(`QA-Ausgangstext A.${INFO_BOX_HTML}`);
    const h3 = editor.querySelector('h3');
    selectForward(h3.firstChild, 0, h3.firstChild, 0);

    const result = insertBlock('tip-box', editor);

    expect(result.success).toBe(false);
    expect(editor.querySelector('p:not(.info-box p)')).toBeNull();
    expect(editor.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
  });
});

// ===========================================================================
// C – Baustein-Menü schliessen
// ===========================================================================

describe('C1/C2 – Toolbar-Button öffnet und schliesst', () => {
  it('der Button öffnet das Menü', () => {
    renderEditor('<p>Text.</p>');
    expect(screen.queryByTestId('insert-menu')).toBeNull();

    clickBtn('btn-insert-block');
    expect(screen.getByTestId('insert-menu')).toBeTruthy();
  });

  it('ein erneuter Button-Klick schliesst das Menü', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');
    expect(screen.getByTestId('insert-menu')).toBeTruthy();

    clickBtn('btn-insert-block');
    expect(screen.queryByTestId('insert-menu')).toBeNull();
  });

  it('der Button bleibt nach mehreren Zyklen zuverlässig bedienbar', () => {
    renderEditor('<p>Text.</p>');
    for (let i = 0; i < 3; i += 1) {
      clickBtn('btn-insert-block');
      expect(screen.getByTestId('insert-menu')).toBeTruthy();
      clickBtn('btn-insert-block');
      expect(screen.queryByTestId('insert-menu')).toBeNull();
    }
  });
});

describe('C3/C7 – Escape schliesst das Menü folgenlos', () => {
  it('Escape schliesst das geöffnete Menü', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('insert-menu')).toBeNull();
  });

  it('Escape im Editor schliesst das Menü ebenfalls', () => {
    const { editor } = renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.queryByTestId('insert-menu')).toBeNull();
  });

  it('Escape löst kein onChange aus und verändert den Artikel nicht', () => {
    const { editor, onChange } = renderEditor('<p>Text.</p>');
    const before = editor.innerHTML;
    clickBtn('btn-insert-block');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(editor.innerHTML).toBe(before);
    expect(editor.querySelector('.info-box')).toBeNull();
  });

  it('andere Tasten schliessen das Menü nicht', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    fireEvent.keyDown(document, { key: 'a' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByTestId('insert-menu')).toBeTruthy();
  });
});

describe('C4/C5/C8 – Aussenklick schliesst, Innenklick nicht', () => {
  it('ein Klick ausserhalb des Menücontainers schliesst das Menü', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('insert-menu')).toBeNull();
  });

  it('ein Klick in den Editierbereich schliesst das Menü', () => {
    const { editor } = renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    fireEvent.mouseDown(editor);
    expect(screen.queryByTestId('insert-menu')).toBeNull();
  });

  it('ein pointerdown ausserhalb schliesst das Menü ebenfalls', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('insert-menu')).toBeNull();
  });

  it('ein Klick innerhalb des Menücontainers schliesst nicht vorzeitig', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    fireEvent.mouseDown(screen.getByTestId('insert-menu'));
    expect(screen.getByTestId('insert-menu')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('insert-info-box'));
    expect(screen.getByTestId('insert-menu')).toBeTruthy();
  });

  it('Aussenklick löst kein onChange aus und verändert den Artikel nicht', () => {
    const { editor, onChange } = renderEditor('<p>Text.</p>');
    const before = editor.innerHTML;
    clickBtn('btn-insert-block');

    fireEvent.mouseDown(document.body);

    expect(onChange).not.toHaveBeenCalled();
    expect(editor.innerHTML).toBe(before);
  });
});

describe('C6 – Eintragswahl fügt genau einen Baustein ein und schliesst', () => {
  it('ein Klick auf einen Eintrag fügt einen Baustein ein und schliesst das Menü', () => {
    const { editor, onChange } = renderEditor('<p>Text.</p>');
    const p = editor.querySelector('p');
    selectForward(p.firstChild, 0, p.firstChild, 0);

    clickBtn('btn-insert-block');
    fireEvent.click(screen.getByTestId('insert-info-box'));

    expect(screen.queryByTestId('insert-menu')).toBeNull();
    expect(editor.querySelectorAll('.info-box')).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('nach der Eintragswahl lässt sich das Menü erneut öffnen', () => {
    const { editor } = renderEditor('<p>Text.</p>');
    const p = editor.querySelector('p');
    selectForward(p.firstChild, 0, p.firstChild, 0);

    clickBtn('btn-insert-block');
    fireEvent.click(screen.getByTestId('insert-tip-box'));
    clickBtn('btn-insert-block');

    expect(screen.getByTestId('insert-menu')).toBeTruthy();
  });
});

describe('C9 – Listener bestehen nur solange nötig', () => {
  it('bei geschlossenem Menü sind keine Menü-Listener registriert', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    renderEditor('<p>Text.</p>');

    const types = addSpy.mock.calls.map(([type]) => type);
    expect(types).not.toContain('pointerdown');
    expect(types).not.toContain('mousedown');
    addSpy.mockRestore();
  });

  it('beim Schliessen werden alle Listener wieder entfernt', () => {
    renderEditor('<p>Text.</p>');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    clickBtn('btn-insert-block');
    clickBtn('btn-insert-block');

    const types = removeSpy.mock.calls.map(([type]) => type);
    expect(types).toContain('keydown');
    expect(types).toContain('pointerdown');
    expect(types).toContain('mousedown');
    removeSpy.mockRestore();
  });

  it('beim Unmount mit offenem Menü bleibt kein Listener zurück', () => {
    const { unmount } = renderEditor('<p>Text.</p>');
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    clickBtn('btn-insert-block');
    const added = addSpy.mock.calls.filter(
      ([type]) => ['keydown', 'pointerdown', 'mousedown'].includes(type)
    );
    expect(added).toHaveLength(3);

    unmount();

    added.forEach(([type, handler]) => {
      const match = removeSpy.mock.calls.find(
        ([t, h]) => t === type && h === handler
      );
      expect(match, `kein removeEventListener für ${type}`).toBeTruthy();
    });

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('nach dem Unmount schliesst ein Aussenklick nichts mehr an', () => {
    const { unmount } = renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');
    unmount();

    expect(() => fireEvent.mouseDown(document.body)).not.toThrow();
    expect(screen.queryByTestId('insert-menu')).toBeNull();
  });
});

describe('C10/C11 – ARIA-Angaben', () => {
  it('aria-expanded wechselt beim Öffnen und Schliessen', () => {
    renderEditor('<p>Text.</p>');
    const btn = screen.getByTestId('btn-insert-block');
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    clickBtn('btn-insert-block');
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    clickBtn('btn-insert-block');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('der Button meldet ein Aufklappmenü und verweist darauf', () => {
    renderEditor('<p>Text.</p>');
    const btn = screen.getByTestId('btn-insert-block');
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');

    clickBtn('btn-insert-block');
    const menu = screen.getByTestId('insert-menu');
    expect(btn.getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.id).toBeTruthy();
  });

  it('Menü und Einträge tragen passende Rollen', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    const menu = screen.getByRole('menu');
    expect(menu).toBe(screen.getByTestId('insert-menu'));
    expect(menu.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getAllByRole('menuitem')).toHaveLength(6);
  });

  it('die Einträge bleiben per Tastatur erreichbar', () => {
    renderEditor('<p>Text.</p>');
    clickBtn('btn-insert-block');

    screen.getAllByRole('menuitem').forEach((item) => {
      expect(item.tagName).toBe('BUTTON');
      expect(item.hasAttribute('disabled')).toBe(false);
      expect(item.getAttribute('tabindex')).not.toBe('-1');
    });
  });

  it('Formatierungs-Buttons behalten aria-pressed', () => {
    renderEditor('<p>Text.</p>');
    expect(screen.getByTitle(/Fett/i).hasAttribute('aria-pressed')).toBe(true);
    expect(screen.getByTestId('btn-insert-block').hasAttribute('aria-pressed')).toBe(false);
  });
});
