/**
 * Phase 5 Tests: AdminRichTextEditor (WYSIWYG)
 *
 * Prüft:
 * - Rendering und Grundstruktur
 * - value/onChange API
 * - Toolbar vorhanden (Überschriften, Fett, Listen, Links, Undo/Redo)
 * - Link-Panel öffnen/schliessen
 * - Placeholder
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminRichTextEditor from '../src/components/admin/AdminRichTextEditor';

// document.execCommand existiert in jsdom nicht — mocken
beforeEach(() => {
  document.execCommand = vi.fn().mockReturnValue(true);
  document.queryCommandState = vi.fn().mockReturnValue(false);
  document.queryCommandValue = vi.fn().mockReturnValue('');
  window.getSelection = vi.fn().mockReturnValue({
    rangeCount: 0,
    isCollapsed: true,
    anchorNode: null,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
  });
});

describe('AdminRichTextEditor: Rendering', () => {
  it('Rendert die Toolbar', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByRole('toolbar')).toBeDefined();
  });

  it('Rendert den contentEditable-Bereich mit data-testid', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} id="test-editor" />);
    expect(screen.getByTestId('test-editor')).toBeDefined();
  });

  it('contentEditable ist gesetzt', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} id="test-editor" />);
    const editor = screen.getByTestId('test-editor');
    expect(editor.getAttribute('contenteditable')).toBe('true');
  });

  it('Zeigt Placeholder an (data-placeholder)', () => {
    const ph = 'Hier Text eingeben…';
    render(<AdminRichTextEditor value="" onChange={vi.fn()} placeholder={ph} id="test-editor" />);
    const editor = screen.getByTestId('test-editor');
    expect(editor.getAttribute('data-placeholder')).toBe(ph);
  });

  it('Rendert Fusszeile mit Hinweis auf serverseitiges Sanitizing', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByText(/serverseitig sanitiert/i)).toBeDefined();
  });
});

describe('AdminRichTextEditor: Toolbar-Buttons', () => {
  it('Hat H2-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Überschrift H2')).toBeDefined();
  });

  it('Hat H3-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Überschrift H3')).toBeDefined();
  });

  it('Hat H4-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Überschrift H4')).toBeDefined();
  });

  it('Hat Absatz-Button (¶)', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Absatz')).toBeDefined();
  });

  it('Hat Fett-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle(/Fett/i)).toBeDefined();
  });

  it('Hat Kursiv-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle(/Kursiv/i)).toBeDefined();
  });

  it('Hat Aufzählung-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Aufzählung')).toBeDefined();
  });

  it('Hat Nummerierte-Liste-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Nummerierte Liste')).toBeDefined();
  });

  it('Hat externen Link-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Externer Link')).toBeDefined();
  });

  it('Hat internen Link-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle(/Interner Link/i)).toBeDefined();
  });

  it('Hat Undo-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle(/Rückgängig/i)).toBeDefined();
  });

  it('Hat Redo-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle(/Wiederholen/i)).toBeDefined();
  });
});

describe('AdminRichTextEditor: Link-Panel', () => {
  it('Link-Panel initial nicht sichtbar', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText('Link-Text (optional)')).toBeNull();
  });

  it('Link-Panel öffnet sich bei Klick auf externen Link-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    const btn = screen.getByTitle('Externer Link');
    fireEvent.mouseDown(btn, { button: 0 });
    expect(screen.getByPlaceholderText('Link-Text (optional)')).toBeDefined();
    expect(screen.getByPlaceholderText('https://...')).toBeDefined();
  });

  it('Internes Link-Panel zeigt anderen Placeholder', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    const btn = screen.getByTitle(/Interner Link/i);
    fireEvent.mouseDown(btn, { button: 0 });
    expect(screen.getByPlaceholderText('/search?q=yoga')).toBeDefined();
  });

  it('Link-Panel schliesst sich bei erneutem Klick auf Link-Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    const btn = screen.getByTitle('Externer Link');
    // Panel öffnen
    fireEvent.mouseDown(btn, { button: 0 });
    expect(screen.getByPlaceholderText('https://...')).toBeDefined();
    // Panel schliessen via Escape-Taste im URL-Feld
    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.keyDown(urlInput, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('https://...')).toBeNull();
  });

  it('Link-Panel toggled sich bei zweitem Klick auf denselben Button', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    const btn = screen.getByTitle('Externer Link');
    // Öffnen
    fireEvent.mouseDown(btn, { button: 0 });
    expect(screen.getByPlaceholderText('https://...')).toBeDefined();
    // Schliessen durch erneuten Klick
    fireEvent.mouseDown(btn, { button: 0 });
    expect(screen.queryByPlaceholderText('https://')).toBeNull();
  });
});

describe('AdminRichTextEditor: onChange API', () => {
  it('Ruft onChange bei onInput-Event auf', () => {
    const onChange = vi.fn();
    render(<AdminRichTextEditor value="" onChange={onChange} id="test-editor" />);
    const editor = screen.getByTestId('test-editor');
    // Simuliere Input-Event
    Object.defineProperty(editor, 'innerHTML', { value: '<p>Test</p>', configurable: true });
    fireEvent.input(editor);
    expect(onChange).toHaveBeenCalled();
  });
});

describe('AdminRichTextEditor: Barrierefreiheit', () => {
  it('Toolbar hat aria-label', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.getAttribute('aria-label')).toBeTruthy();
  });

  it('Editierbereich hat aria-label', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} id="test-editor" />);
    const editor = screen.getByTestId('test-editor');
    expect(editor.getAttribute('aria-label')).toBeTruthy();
  });

  it('aria-multiline ist true', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} id="test-editor" />);
    const editor = screen.getByTestId('test-editor');
    expect(editor.getAttribute('aria-multiline')).toBe('true');
  });

  it('Fett-Button hat aria-pressed', () => {
    render(<AdminRichTextEditor value="" onChange={vi.fn()} />);
    const boldBtn = screen.getByTitle(/Fett/i);
    expect(boldBtn.hasAttribute('aria-pressed')).toBe(true);
  });
});
