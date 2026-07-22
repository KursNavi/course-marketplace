/**
 * Wiederverwendbarer WYSIWYG Rich-Text-Editor für Admin-Formulare.
 *
 * Implementierung: contentEditable-div mit Formatierungs-Toolbar.
 * Nicht-technische Admins können Text formatieren ohne HTML schreiben zu müssen.
 *
 * Serverseitiges Sanitizing bleibt verbindlich — dieser Editor gibt HTML aus,
 * das vor dem Speichern über die API mit sanitize-html bereinigt wird.
 *
 * Kein direktes innerHTML-Schreiben mit unsanitiertem Input in der Ausgabe.
 * Ausgabe: editor.innerHTML (strukturiertes HTML, DOM-Serialized).
 *
 * Unterstützte Funktionen:
 *   - Absätze (P), Überschriften (H2, H3, H4)
 *   - Fett (B/Strong), Kursiv (I/Em)
 *   - Aufzählung (UL), Nummerierte Liste (OL)
 *   - Externer Link, Interner Link, Link entfernen
 *   - Undo / Redo (Browserunterstützung)
 *
 * Blog-Editor (AdminBlogManager) bleibt unverändert.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Bold, Italic, List, ListOrdered, Link as LinkIcon,
  Unlink, Globe, Undo, Undo2, Redo2, X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const HEADING_LEVELS = ['H2', 'H3', 'H4'];
const VALID_HEADING_TAGS = new Set(['h2', 'h3', 'h4']);

// ---------------------------------------------------------------------------
// Hilfsfunktion: execCommand-Wrapper
// ---------------------------------------------------------------------------

function exec(command, value = null) {
  // document.execCommand ist deprecated, bleibt aber in allen Browsern
  // der einzig verlässliche Weg für WYSIWYG ohne externe Library.
  document.execCommand(command, false, value);
}

// ---------------------------------------------------------------------------
// Toolbar-Button
// ---------------------------------------------------------------------------

function ToolBtn({ onClick, title, active, disabled, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // mousedown statt click: verhindert Fokusverlust aus contentEditable
        e.preventDefault();
        if (!disabled) onClick();
      }}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'px-2 py-1 text-xs rounded flex items-center gap-1 min-h-[28px] transition-colors',
        active
          ? 'bg-teal-600 text-white'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Separator
// ---------------------------------------------------------------------------

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5 self-center" />;
}

// ---------------------------------------------------------------------------
// Link-Panel
// ---------------------------------------------------------------------------

/**
 * Prüft ob ein URL-String ein unsicheres Protokoll enthält.
 * Blockiert javascript:, data: und vbscript: URLs (XSS-Prävention).
 * Server-seitiges Sanitizing bleibt zusätzlich verbindlich.
 *
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isUnsafeHref(rawUrl) {
  const lower = rawUrl.trim().toLowerCase().replace(/\s+/g, '');
  return (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  );
}

function LinkPanel({ mode, onClose, onInsert }) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleInsert = () => {
    if (!url.trim()) return;
    if (isUnsafeHref(url)) {
      setUrlError('Ungültige URL: javascript:, data: und vbscript: sind nicht erlaubt.');
      return;
    }
    setUrlError('');
    const href = mode === 'internal'
      ? (url.startsWith('/') ? url : `/${url}`)
      : url;
    onInsert({ text: text.trim() || url, href });
    setText('');
    setUrl('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleInsert(); }
    if (e.key === 'Escape') onClose();
  };

  const isInternal = mode === 'internal';
  const colorClass = isInternal
    ? 'bg-blue-50 border-blue-100'
    : 'bg-teal-50 border-teal-100';
  const btnClass = isInternal ? 'bg-blue-600' : 'bg-teal-600';
  const placeholder = isInternal ? '/search?q=yoga' : 'https://...';

  return (
    <div className={`border-b p-2 flex flex-wrap gap-2 items-center ${colorClass}`}>
      <input
        type="text"
        placeholder="Link-Text (optional)"
        className="p-1.5 text-sm border rounded w-36"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <input
        type={isInternal ? 'text' : 'url'}
        placeholder={placeholder}
        className={`p-1.5 text-sm border rounded flex-grow font-mono ${urlError ? 'border-red-400' : ''}`}
        value={url}
        onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(''); }}
        onKeyDown={handleKeyDown}
        aria-describedby={urlError ? 'link-url-error' : undefined}
      />
      {urlError && (
        <span id="link-url-error" className="w-full text-xs text-red-600 -mt-1" role="alert">
          {urlError}
        </span>
      )}
      <button
        type="button"
        onClick={handleInsert}
        className={`text-white px-3 py-1.5 rounded text-xs font-bold ${btnClass}`}
      >
        Einfügen
      </button>
      <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {string} props.value        — HTML-Inhalt
 * @param {function} props.onChange   — (html: string) => void
 * @param {string} [props.placeholder]
 * @param {string} [props.id]         — optional für Test-Targeting
 * @param {number} [props.minRows]    — Mindesthöhe in em
 */
export default function AdminRichTextEditor({
  value,
  onChange,
  placeholder = 'Text eingeben und formatieren…',
  id = 'admin-rich-text-editor',
  minRows = 20,
}) {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);
  const savedSelection = useRef(null);

  // Formatierungszustände für Toolbar
  const [fmt, setFmt] = useState({
    bold: false, italic: false, h2: false, h3: false, h4: false,
    ul: false, ol: false, link: false,
  });
  const [linkMode, setLinkMode] = useState(null); // null | 'external' | 'internal'

  // HTML in Editor laden wenn value sich von außen ändert
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    // Nur updaten wenn wirklich unterschiedlich (verhindert Cursor-Reset)
    if (el.innerHTML !== (value || '')) {
      el.innerHTML = value || '';
    }
  }, [value]);

  // Selektion speichern bevor Panel fokussiert wird
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  // Selektion wiederherstellen nach Rückkehr aus Panel
  const restoreSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el || !savedSelection.current) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  }, []);

  // onChange an übergeordnete Komponente melden
  const notifyChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isInternalChange.current = true;
    onChange(el.innerHTML);
  }, [onChange]);

  // Formatierungszustand der aktuellen Selektion prüfen
  const updateFormatState = useCallback(() => {
    try {
      const bold = document.queryCommandState('bold');
      const italic = document.queryCommandState('italic');
      const block = document.queryCommandValue('formatBlock').toLowerCase();
      const isLink = !!window.getSelection()?.anchorNode?.parentElement?.closest('a');
      setFmt({
        bold,
        italic,
        h2: block === 'h2',
        h3: block === 'h3',
        h4: block === 'h4',
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        link: isLink,
      });
    } catch (_) {
      // queryCommandState kann in manchen Situationen werfen
    }
  }, []);

  // Toolbar-Aktionen
  const applyBold = () => { exec('bold'); notifyChange(); };
  const applyItalic = () => { exec('italic'); notifyChange(); };
  const applyList = (type) => {
    exec(type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
    notifyChange();
  };
  const applyHeading = (level) => {
    const current = document.queryCommandValue('formatBlock').toLowerCase();
    exec('formatBlock', current === level ? 'p' : level);
    notifyChange();
  };
  const applyParagraph = () => { exec('formatBlock', 'p'); notifyChange(); };
  const removeLink = () => { exec('unlink'); notifyChange(); };
  const applyUndo = () => { exec('undo'); notifyChange(); };
  const applyRedo = () => { exec('redo'); notifyChange(); };

  // Link einfügen (aus LinkPanel)
  const handleLinkInsert = ({ text, href }) => {
    restoreSelection();
    setLinkMode(null);
    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed;

    if (hasSelection) {
      // Text ist bereits selektiert — nur href setzen
      exec('createLink', href);
    } else {
      // Kein selektierter Text — Link-HTML einfügen
      const isInternal = href.startsWith('/');
      const attrs = isInternal
        ? `href="${href}"`
        : `href="${href}" target="_blank" rel="noopener noreferrer"`;
      exec('insertHTML', `<a ${attrs}>${text}</a>`);
    }
    notifyChange();
  };

  const openLinkPanel = (mode) => {
    saveSelection();
    setLinkMode((prev) => (prev === mode ? null : mode));
  };

  // Tastaturkürzel
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Standard: Browser-Verhalten (neuer <p> oder <li>)
      // Kein eigenes Handling nötig
    }
    // Ctrl+Z / Ctrl+Y werden vom Browser nativ behandelt
    setTimeout(updateFormatState, 0);
  };

  // Clipboard: nur Text einfügen um Fremd-HTML zu vermeiden
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    // Zeilenumbrüche als <br> einfügen, dann bereinigen
    const html = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => `<p>${l}</p>`)
      .join('');
    exec('insertHTML', html || text);
    notifyChange();
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">

      {/* Toolbar */}
      <div
        className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1 items-center"
        role="toolbar"
        aria-label="Text-Formatierung"
      >
        {/* Undo / Redo */}
        <ToolBtn onClick={applyUndo} title="Rückgängig (Ctrl+Z)">
          <Undo2 size={13} />
        </ToolBtn>
        <ToolBtn onClick={applyRedo} title="Wiederholen (Ctrl+Y)">
          <Redo2 size={13} />
        </ToolBtn>

        <Sep />

        {/* Überschriften */}
        {HEADING_LEVELS.map((h) => (
          <ToolBtn
            key={h}
            onClick={() => applyHeading(h.toLowerCase())}
            active={fmt[h.toLowerCase()]}
            title={`Überschrift ${h}`}
          >
            <span className="font-bold">{h}</span>
          </ToolBtn>
        ))}
        <ToolBtn onClick={applyParagraph} title="Absatz">
          <span className="font-mono text-xs">¶</span>
        </ToolBtn>

        <Sep />

        {/* Inline-Formatierung */}
        <ToolBtn onClick={applyBold} active={fmt.bold} title="Fett (Ctrl+B)">
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn onClick={applyItalic} active={fmt.italic} title="Kursiv (Ctrl+I)">
          <Italic size={13} />
        </ToolBtn>

        <Sep />

        {/* Listen */}
        <ToolBtn onClick={() => applyList('ul')} active={fmt.ul} title="Aufzählung">
          <List size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => applyList('ol')} active={fmt.ol} title="Nummerierte Liste">
          <ListOrdered size={13} />
        </ToolBtn>

        <Sep />

        {/* Links */}
        <ToolBtn
          onClick={() => openLinkPanel('external')}
          active={linkMode === 'external'}
          title="Externer Link"
        >
          <Globe size={12} />
          <span>Link</span>
        </ToolBtn>
        <ToolBtn
          onClick={() => openLinkPanel('internal')}
          active={linkMode === 'internal'}
          title="Interner Link (z.B. /search?q=...)"
        >
          <LinkIcon size={12} />
          <span>Intern</span>
        </ToolBtn>
        <ToolBtn onClick={removeLink} title="Link entfernen" disabled={!fmt.link}>
          <Unlink size={12} />
        </ToolBtn>
      </div>

      {/* Link-Panel */}
      {linkMode && (
        <LinkPanel
          mode={linkMode}
          onClose={() => setLinkMode(null)}
          onInsert={handleLinkInsert}
        />
      )}

      {/* WYSIWYG-Editierbereich */}
      <div
        id={id}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-testid={id}
        data-placeholder={placeholder}
        onInput={notifyChange}
        onKeyDown={handleKeyDown}
        onKeyUp={updateFormatState}
        onMouseUp={updateFormatState}
        onFocus={updateFormatState}
        onPaste={handlePaste}
        className={[
          'w-full p-4 text-sm leading-relaxed outline-none',
          'prose prose-sm max-w-none',
          'focus:ring-2 focus:ring-inset focus:ring-teal-500',
          '[&[data-placeholder]:empty:before]:content-[attr(data-placeholder)]',
          '[&[data-placeholder]:empty:before]:text-gray-400',
          '[&[data-placeholder]:empty:before]:pointer-events-none',
        ].join(' ')}
        style={{ minHeight: `${minRows * 1.6}rem` }}
        aria-label="Artikelinhalt bearbeiten"
        aria-multiline="true"
      />

      {/* Fusszeile */}
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-1.5 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          WYSIWYG-Editor · HTML wird serverseitig sanitiert beim Speichern
        </p>
        <p className="text-xs text-gray-300">
          Ctrl+B = Fett · Ctrl+I = Kursiv · Ctrl+Z = Rückgängig
        </p>
      </div>
    </div>
  );
}
