/**
 * Wiederverwendbarer Rich-Text-Editor für Admin-Formulare.
 *
 * Implementierung: Textarea mit HTML-Toolbar (analog zu AdminBlogManager).
 * Der HTML-Input wird serverseitig sanitiert (sanitize-html, nicht Regex).
 *
 * Keine unsichere HTML-Vorschau im Editor selbst.
 * Sichere Vorschau nur via expliziten "Vorschau anzeigen"-Modus mit
 * einer Sandbox-Vorschau (ohne dangerouslySetInnerHTML im Editor).
 *
 * Dieser Editor ist eine extrahierte und unabhängige Komponente —
 * AdminBlogManager funktioniert unverändert weiter.
 */

import React, { useRef, useEffect, useState } from 'react';
import { Bold, List, Link as LinkIcon, X, Globe } from 'lucide-react';

/**
 * @param {object} props
 * @param {string} props.value - HTML-Inhalt
 * @param {function} props.onChange - (html: string) => void
 * @param {string} [props.placeholder]
 * @param {number} [props.minRows]
 * @param {string} [props.id]
 */
export default function AdminRichTextEditor({
  value,
  onChange,
  placeholder = 'HTML-Inhalt eingeben…',
  minRows = 20,
  id = 'admin-rich-text-editor',
}) {
  const cursorRef = useRef(null);
  const [linkMode, setLinkMode] = useState(null); // null | 'generic' | 'internal'
  const [genericLink, setGenericLink] = useState({ url: '', text: '' });
  const [internalLink, setInternalLink] = useState({ path: '', text: '' });

  // Cursor nach Content-Änderung wiederherstellen
  useEffect(() => {
    if (cursorRef.current !== null) {
      const ta = document.getElementById(id);
      if (ta) {
        ta.focus();
        ta.setSelectionRange(cursorRef.current, cursorRef.current);
      }
      cursorRef.current = null;
    }
  }, [value, id]);

  const insertText = (text) => {
    const ta = document.getElementById(id);
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = ta.value || '';
    cursorRef.current = start + text.length;
    onChange(current.substring(0, start) + text + current.substring(end));
  };

  const wrapSelection = (openTag, closeTag) => {
    const ta = document.getElementById(id);
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = ta.value || '';
    const selection = current.substring(start, end);
    const full = openTag + selection + closeTag;
    cursorRef.current = start + openTag.length + selection.length;
    onChange(current.substring(0, start) + full + current.substring(end));
  };

  const insertGenericLink = () => {
    if (!genericLink.text || !genericLink.url) return;
    const isInternal = genericLink.url.startsWith('/');
    const attrs = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
    insertText(`<a href="${genericLink.url}"${attrs}>${genericLink.text}</a>`);
    setLinkMode(null);
    setGenericLink({ url: '', text: '' });
  };

  const insertInternalLink = () => {
    if (!internalLink.text || !internalLink.path) return;
    const path = internalLink.path.startsWith('/') ? internalLink.path : `/${internalLink.path}`;
    insertText(`<a href="${path}">${internalLink.text}</a>`);
    setLinkMode(null);
    setInternalLink({ path: '', text: '' });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-100 p-2 border-b flex flex-wrap gap-2 items-center">
        <ToolBtn onClick={() => wrapSelection('<h2>', '</h2>')} label="H2" title="Überschrift 2" />
        <ToolBtn onClick={() => wrapSelection('<h3>', '</h3>')} label="H3" title="Überschrift 3" />
        <ToolBtn onClick={() => wrapSelection('<h4>', '</h4>')} label="H4" title="Überschrift 4" />
        <ToolBtn onClick={() => wrapSelection('<strong>', '</strong>')} icon={<Bold size={14} />} title="Fett" />
        <ToolBtn onClick={() => wrapSelection('<em>', '</em>')} label="Em" title="Kursiv" />
        <ToolBtn
          onClick={() => insertText('<ul>\n  <li>Punkt 1</li>\n  <li>Punkt 2</li>\n</ul>')}
          icon={<List size={14} />}
          title="Liste"
        />
        <ToolBtn
          onClick={() => insertText('<p></p>')}
          label="P"
          title="Absatz"
        />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => setLinkMode(linkMode === 'generic' ? null : 'generic')}
          className={`px-2 py-1 text-xs font-bold rounded flex items-center gap-1 ${
            linkMode === 'generic' ? 'bg-teal-600 text-white' : 'bg-white text-teal-700 hover:bg-teal-50'
          }`}
          title="Externer Link"
        >
          <Globe size={12} /> Link
        </button>
        <button
          type="button"
          onClick={() => setLinkMode(linkMode === 'internal' ? null : 'internal')}
          className={`px-2 py-1 text-xs font-bold rounded flex items-center gap-1 ${
            linkMode === 'internal' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'
          }`}
          title="Interner Link"
        >
          <LinkIcon size={12} /> Intern
        </button>
      </div>

      {/* Link-Tools */}
      {linkMode === 'generic' && (
        <div className="bg-teal-50 border-b border-teal-100 p-3 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Link-Text"
            className="p-1.5 text-sm border rounded w-40"
            value={genericLink.text}
            onChange={(e) => setGenericLink({ ...genericLink, text: e.target.value })}
          />
          <input
            type="url"
            placeholder="https://..."
            className="p-1.5 text-sm border rounded flex-grow"
            value={genericLink.url}
            onChange={(e) => setGenericLink({ ...genericLink, url: e.target.value })}
          />
          <button
            type="button"
            onClick={insertGenericLink}
            className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs font-bold"
          >
            Einfügen
          </button>
          <button type="button" onClick={() => setLinkMode(null)}>
            <X size={14} className="text-teal-500" />
          </button>
        </div>
      )}
      {linkMode === 'internal' && (
        <div className="bg-blue-50 border-b border-blue-100 p-3 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Link-Text"
            className="p-1.5 text-sm border rounded w-40"
            value={internalLink.text}
            onChange={(e) => setInternalLink({ ...internalLink, text: e.target.value })}
          />
          <input
            type="text"
            placeholder="/search?q=yoga"
            className="p-1.5 text-sm border rounded flex-grow font-mono"
            value={internalLink.path}
            onChange={(e) => setInternalLink({ ...internalLink, path: e.target.value })}
          />
          <button
            type="button"
            onClick={insertInternalLink}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold"
          >
            Einfügen
          </button>
          <button type="button" onClick={() => setLinkMode(null)}>
            <X size={14} className="text-blue-500" />
          </button>
        </div>
      )}

      {/* Editor */}
      <textarea
        id={id}
        className={`w-full p-4 font-mono text-sm leading-relaxed resize-y outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500`}
        style={{ minHeight: `${minRows * 1.6}rem` }}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />

      <div className="bg-gray-50 border-t px-3 py-1.5">
        <p className="text-xs text-gray-400">
          HTML-Eingabe · Wird serverseitig sanitiert beim Speichern
        </p>
      </div>
    </div>
  );
}

const ToolBtn = ({ onClick, label, icon, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-xs font-bold flex items-center min-h-[26px] shadow-sm text-gray-700"
  >
    {icon || label}
  </button>
);
