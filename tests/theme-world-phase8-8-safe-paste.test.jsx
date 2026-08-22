/**
 * Phase 8.8 Tests: Sicheres Clipboard-Einfügen im AdminRichTextEditor
 *
 * Prüft den DOM-basierten Paste-Pfad (HTML mit sicherem Fallback auf Plain Text).
 * Der globale execCommand-Mock bleibt aktiv — der Paste-Pfad verwendet kein
 * insertHTML/execCommand.
 *
 * Getestete Szenarien:
 *   1. Literale Bold-Tags → kein <b>-Element
 *   2. Strukturierter HTML-Inhalt bleibt erhalten
 *   3. <script>-Text → kein script-Element
 *   4. <img onerror>-Text → kein img-Element
 *   5. javascript:-Link als Text → kein a-Element
 *   6. Vergleichszeichen < > → Text vollständig erhalten
 *   7. Mehrzeiliger Text → alle Zeilen vorhanden, korrekte Reihenfolge
 *   8. Leere Zwischenzeile → Trennung erhalten
 *   9. Schweizer Sonderzeichen → alle Zeichen erhalten
 *  10. Auswahl ersetzen → deleteContents aufgerufen
 *
 * Zusätzlich: Export-Sanity für insertPlainTextAtCaret
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';
import { insertHtmlAtCaret, insertPlainTextAtCaret, sanitizePastedHtml } from '../src/components/admin/richTextPasteUtils';

// ---------------------------------------------------------------------------
// Mock-Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.execCommand = vi.fn().mockReturnValue(true);
  document.queryCommandState = vi.fn().mockReturnValue(false);
  document.queryCommandValue = vi.fn().mockReturnValue('');
  // Fallback: kein Range — wird in jedem Test überschrieben
  window.getSelection = vi.fn().mockReturnValue({
    rangeCount: 0,
    isCollapsed: true,
    anchorNode: null,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
  });
});

// ---------------------------------------------------------------------------
// Test-Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Range-Mock. Wird ein `host` übergeben, fügt `insertNode` den Knoten
 * tatsächlich in das DOM ein — wie eine echte Range. Für die Assertions wird
 * vorher eine Kopie abgelegt, da das Einfügen ein DocumentFragment leert.
 */
function createMockRange(host = null) {
  const capturedNodes = [];
  return {
    deleteContents: vi.fn(),
    insertNode: vi.fn((node) => {
      capturedNodes.push(node.cloneNode(true));
      if (host) host.appendChild(node);
    }),
    collapse: vi.fn(),
    cloneRange: vi.fn().mockReturnValue({ collapse: vi.fn() }),
    _capturedNodes: capturedNodes,
  };
}

function mockSelectionWithRange(range) {
  const sel = {
    rangeCount: 1,
    isCollapsed: true,
    anchorNode: null,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
    getRangeAt: vi.fn().mockReturnValue(range),
  };
  window.getSelection = vi.fn().mockReturnValue(sel);
  return sel;
}

/**
 * Rendert den Editor, setzt Selection-Mock, feuert Paste-Event.
 * Gibt {range, sel, onChange} zurück für Assertions.
 */
function setupPasteTest(plainText, htmlText = '') {
  const onChange = vi.fn();
  render(<AdminRichTextEditor value="" onChange={onChange} id="test-paste-editor" />);
  const editor = screen.getByTestId('test-paste-editor');

  const range = createMockRange(editor);
  mockSelectionWithRange(range);

  fireEvent.paste(editor, {
    clipboardData: {
      getData: vi.fn((type) => {
        if (type === 'text/plain') return plainText;
        if (type === 'text/html') return htmlText;
        return '';
      }),
    },
  });

  // Das erste (und einzige) Argument an insertNode ist das DocumentFragment
  const fragment = range._capturedNodes[0] ?? null;
  return { range, sel: window.getSelection(), onChange, fragment, editor };
}

// ---------------------------------------------------------------------------
// Tests: Sicherheit — kein HTML aus Plain-Text
// ---------------------------------------------------------------------------

describe('Phase 8.8 – Safe Paste: HTML-Elemente werden nicht erzeugt', () => {

  it('1. Literale Bold-Tags: kein <b>- oder <strong>-Element', () => {
    const input = 'Paste-Test <b>Dieser Text darf nicht fett erscheinen</b>';
    const { fragment } = setupPasteTest(input);

    expect(fragment).not.toBeNull();
    expect(fragment.querySelector('b')).toBeNull();
    expect(fragment.querySelector('strong')).toBeNull();
    // Literaltext vollständig erhalten
    expect(fragment.textContent).toContain('<b>');
    expect(fragment.textContent).toContain('</b>');
    expect(fragment.textContent).toContain('Paste-Test');
  });

  it('2. Strukturierter HTML-Inhalt wird übernommen, wenn vorhanden', () => {
    const html = '<h2>Überschrift</h2><ul><li><strong>Fett</strong></li></ul>';
    const { fragment } = setupPasteTest('', html);

    expect(fragment).not.toBeNull();
    expect(fragment.querySelector('h2')?.textContent).toBe('Überschrift');
    expect(fragment.querySelector('ul li strong')?.textContent).toBe('Fett');
  });

  it('3. <script>-Text: kein script-Element, kein Code ausgeführt', () => {
    const input = '<script>alert(1)</script>';
    const { fragment } = setupPasteTest(input);

    expect(fragment).not.toBeNull();
    expect(fragment.querySelector('script')).toBeNull();
    // Inhalt als Literaltext vorhanden
    expect(fragment.textContent).toContain('<script>');
  });

  it('4. <img onerror>-Text: kein img-Element, kein Event-Handler', () => {
    const input = '<img src=x onerror=alert(1)>';
    const { fragment } = setupPasteTest(input);

    expect(fragment).not.toBeNull();
    expect(fragment.querySelector('img')).toBeNull();
    expect(fragment.textContent).toContain('<img');
  });

  it('5. javascript:-Link als Text: kein <a>-Element, kein aktiver Link', () => {
    const input = '<a href="javascript:alert(1)">Link</a>';
    const { fragment } = setupPasteTest(input);

    expect(fragment).not.toBeNull();
    expect(fragment.querySelector('a')).toBeNull();
    expect(fragment.textContent).toContain('<a href=');
  });

  it('5b. Unsichere HTML-Struktur wird entfernt, sichere CTA-Klasse bleibt', () => {
    const html = '<div class="cta-box" onclick="alert(1)"><h3>Weiter</h3><a href="javascript:alert(1)">Link</a><script>alert(1)</script></div>';
    const { fragment } = setupPasteTest('', html);

    expect(fragment.querySelector('.cta-box')).not.toBeNull();
    expect(fragment.querySelector('h3')?.textContent).toBe('Weiter');
    expect(fragment.querySelector('script')).toBeNull();
    expect(fragment.querySelector('a')).toBeNull();
    expect(fragment.querySelector('[onclick]')).toBeNull();
  });

  it('5c. Sichere Links bleiben aktiv, externe Links erhalten Schutz-Rel', () => {
    const { fragment } = setupPasteTest('', '<p><a href="https://example.org" target="_blank">Quelle</a></p>');

    const link = fragment.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.org');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('5d. Browser-Styles für Fett und Kursiv werden semantisch übernommen', () => {
    const { fragment } = setupPasteTest('', '<p><span style="font-weight: 700; font-style: italic">Format</span></p>');

    expect(fragment.querySelector('strong em')?.textContent).toBe('Format');
    expect(fragment.querySelector('[style]')).toBeNull();
  });

});

// ---------------------------------------------------------------------------
// Tests: Zeichenintegrität
// ---------------------------------------------------------------------------

describe('Phase 8.8 – Safe Paste: Zeichenintegrität', () => {

  it('6. Vergleichszeichen < und > bleiben als Text erhalten', () => {
    const input = '2 < 3 und 5 > 4';
    const { fragment } = setupPasteTest(input);

    expect(fragment).not.toBeNull();
    // Kein HTML-Parsing: < und > bilden keine Elemente
    expect(fragment.childNodes.length).toBe(1);
    expect(fragment.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    expect(fragment.textContent).toBe('2 < 3 und 5 > 4');
  });

  it('9. Schweizer Sonderzeichen vollständig erhalten', () => {
    const input = 'Zürich, Gefässe, Einsteigerinnen & Einsteiger';
    const { fragment } = setupPasteTest(input);

    expect(fragment).not.toBeNull();
    expect(fragment.textContent).toBe('Zürich, Gefässe, Einsteigerinnen & Einsteiger');
  });

});

// ---------------------------------------------------------------------------
// Tests: Mehrzeiligkeit
// ---------------------------------------------------------------------------

describe('Phase 8.8 – Safe Paste: Mehrzeiliger Text', () => {

  it('7. Drei Zeilen: alle vorhanden, korrekte Reihenfolge, keine Klebung', () => {
    const input = 'Erste Zeile\nZweite Zeile\nDritte Zeile';
    const { fragment } = setupPasteTest(input);

    expect(fragment).not.toBeNull();
    const children = Array.from(fragment.childNodes);
    // Erwartet: TextNode, <br>, TextNode, <br>, TextNode
    expect(children.length).toBe(5);
    expect(children[0].nodeType).toBe(Node.TEXT_NODE);
    expect(children[0].textContent).toBe('Erste Zeile');
    expect(children[1].nodeName).toBe('BR');
    expect(children[2].nodeType).toBe(Node.TEXT_NODE);
    expect(children[2].textContent).toBe('Zweite Zeile');
    expect(children[3].nodeName).toBe('BR');
    expect(children[4].nodeType).toBe(Node.TEXT_NODE);
    expect(children[4].textContent).toBe('Dritte Zeile');
  });

  it('7b. CRLF-Zeilenumbrüche (Windows) werden korrekt verarbeitet', () => {
    const input = 'Erste Zeile\r\nZweite Zeile';
    const { fragment } = setupPasteTest(input);

    const children = Array.from(fragment.childNodes);
    expect(children.length).toBe(3);
    expect(children[0].textContent).toBe('Erste Zeile');
    expect(children[1].nodeName).toBe('BR');
    expect(children[2].textContent).toBe('Zweite Zeile');
  });

  it('8. Leere Zwischenzeile: Trennung bleibt erhalten', () => {
    const input = 'Erste Zeile\n\nDritte Zeile';
    const { fragment } = setupPasteTest(input);

    const children = Array.from(fragment.childNodes);
    // Erwartet: TextNode('Erste Zeile'), <br>, TextNode(''), <br>, TextNode('Dritte Zeile')
    expect(children.length).toBe(5);
    expect(children[0].textContent).toBe('Erste Zeile');
    expect(children[1].nodeName).toBe('BR');
    expect(children[2].nodeType).toBe(Node.TEXT_NODE);
    expect(children[2].textContent).toBe(''); // leere Zeile erhalten
    expect(children[3].nodeName).toBe('BR');
    expect(children[4].textContent).toBe('Dritte Zeile');
  });

});

// ---------------------------------------------------------------------------
// Tests: Auswahl ersetzen, Cursor, Benachrichtigung
// ---------------------------------------------------------------------------

describe('Phase 8.8 – Safe Paste: Auswahl und Cursor', () => {

  it('10. Auswahl ersetzen: deleteContents wird aufgerufen', () => {
    const { range } = setupPasteTest('Neuer Text');

    expect(range.deleteContents).toHaveBeenCalledOnce();
  });

  it('10b. Cursor wird hinter eingefügten Inhalt gesetzt (collapse + addRange)', () => {
    const { range, sel } = setupPasteTest('Text nach Paste');

    expect(range.collapse).toHaveBeenCalledWith(false);
    expect(sel.removeAllRanges).toHaveBeenCalled();
    expect(sel.addRange).toHaveBeenCalledWith(range);
  });

  it('notifyChange wird nach Paste aufgerufen', () => {
    const { onChange } = setupPasteTest('Beliebiger Text');

    expect(onChange).toHaveBeenCalled();
  });

  it('execCommand insertHTML wird beim Paste NICHT aufgerufen', () => {
    setupPasteTest('', '<p>Paste-Test <strong>bold</strong></p>');

    // Der neue Pfad umgeht execCommand vollständig
    const insertHTMLCalls = document.execCommand.mock.calls.filter(
      (args) => args[0] === 'insertHTML'
    );
    expect(insertHTMLCalls.length).toBe(0);
  });

});

// ---------------------------------------------------------------------------
// Tests: insertPlainTextAtCaret Direkt-Export
// ---------------------------------------------------------------------------

describe('Phase 8.8 – insertPlainTextAtCaret: direkter Export', () => {

  it('ist exportiert und eine Funktion', () => {
    expect(typeof insertPlainTextAtCaret).toBe('function');
  });

  it('tut nichts wenn keine Selection vorhanden', () => {
    // window.getSelection gibt rangeCount: 0 zurück (aus beforeEach)
    expect(() => insertPlainTextAtCaret('Text')).not.toThrow();
  });

  it('tut nichts wenn getSelection null zurückgibt', () => {
    window.getSelection = vi.fn().mockReturnValue(null);
    expect(() => insertPlainTextAtCaret('Text')).not.toThrow();
  });

  it('erstellt TextNode für einzeiligen Text', () => {
    const range = createMockRange();
    mockSelectionWithRange(range);

    insertPlainTextAtCaret('Hallo Welt');

    const fragment = range._capturedNodes[0];
    expect(fragment).toBeDefined();
    expect(fragment.childNodes.length).toBe(1);
    expect(fragment.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    expect(fragment.childNodes[0].textContent).toBe('Hallo Welt');
  });

  it('erstellt TextNodes und <br>s für mehrzeiligen Text', () => {
    const range = createMockRange();
    mockSelectionWithRange(range);

    insertPlainTextAtCaret('Zeile 1\nZeile 2');

    const fragment = range._capturedNodes[0];
    expect(fragment.childNodes.length).toBe(3);
    expect(fragment.childNodes[0].textContent).toBe('Zeile 1');
    expect(fragment.childNodes[1].nodeName).toBe('BR');
    expect(fragment.childNodes[2].textContent).toBe('Zeile 2');
  });

  it('HTML-Sonderzeichen in Text werden nicht als Markup interpretiert', () => {
    const range = createMockRange();
    mockSelectionWithRange(range);

    insertPlainTextAtCaret('<script>alert(1)</script>');

    const fragment = range._capturedNodes[0];
    expect(fragment.querySelector('script')).toBeNull();
    expect(fragment.querySelector('b')).toBeNull();
    expect(fragment.textContent).toBe('<script>alert(1)</script>');
  });

  it('leerer Text: nur deleteContents aufgerufen, kein Absturz', () => {
    const range = createMockRange();
    mockSelectionWithRange(range);

    expect(() => insertPlainTextAtCaret('')).not.toThrow();
    expect(range.deleteContents).toHaveBeenCalled();
  });

});

describe('Phase 8.8 – HTML-Paste: direkter Export', () => {
  it('sanitizePastedHtml liefert ein bereinigtes DocumentFragment', () => {
    const fragment = sanitizePastedHtml('<h2>Titel</h2><script>alert(1)</script><a href="//evil.example">Unsicher</a>');

    expect(fragment.querySelector('h2')?.textContent).toBe('Titel');
    expect(fragment.querySelector('script')).toBeNull();
    expect(fragment.querySelector('a')).toBeNull();
  });

  it('insertHtmlAtCaret ersetzt die Auswahl und setzt den Cursor zurück', () => {
    const host = document.createElement('div');
    const range = createMockRange(host);
    const sel = mockSelectionWithRange(range);

    expect(insertHtmlAtCaret('<p>HTML-Inhalt</p>')).toBe(true);
    expect(range.deleteContents).toHaveBeenCalledOnce();
    expect(range.collapse).toHaveBeenCalledWith(false);
    expect(sel.addRange).toHaveBeenCalledWith(range);
    expect(host.innerHTML).toContain('<p>HTML-Inhalt</p>');
  });
});
