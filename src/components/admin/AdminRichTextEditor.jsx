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
 *   - Baustein einfügen (Info-Box, Tipp-Box, Hinweis, Checkliste, Tabelle, Kurs-Box)
 *   - Baustein-Typ anzeigen (aktueller Abschnitt) inkl. Fokus-Hervorhebung
 *   - Baustein-Aktionen: In Text umwandeln / Löschen
 *   - Tabellen-Aktionen: Zeilen/Spalten hinzufügen und löschen, Kopfzeile,
 *     „Tabelle in Text umwandeln" (verlustfrei, ersetzt das generische Entkleiden)
 *   - Schutz vor der Chromium-Auswahl über die Blockgrenze hinaus (beforeinput)
 *
 * Baustein-Menü:
 *   Schliesst über erneuten Button-Klick, Eintragswahl, Escape und Aussenklick.
 *   Escape und Aussenklick verändern den Artikel nicht und melden kein onChange.
 *
 * Sicherheitsabfragen:
 *   Destruktive Aktionen (gefüllte Zeile/Spalte löschen, Baustein löschen,
 *   Tabelle in Text umwandeln) fragen ausschliesslich über eine eigene
 *   Bestätigungsfläche in der Editoroberfläche nach — nie über window.confirm.
 *   Ein nativer Dialog hält den Renderer-Hauptthread an; ein Browser-Agent ohne
 *   Dialogbehandlung bleibt dann im Eingabe-Dispatch stehen und die Seite wirkt
 *   eingefroren. Der Eingabe-Handler kehrt hier stattdessen sofort zurück.
 *
 *   Beim ersten Klick wird nichts verändert: Aktion und Ziel werden in einem Ref
 *   festgehalten (nicht im State — DOM-Knoten gehören nicht in den React-State).
 *   Erst die Bestätigung führt die Aktion genau einmal aus, und zwar auf dem
 *   erfassten Ziel statt auf der inzwischen möglicherweise verschobenen
 *   Selektion. Vor der Ausführung wird geprüft, ob das Ziel noch gültig ist.
 *
 *   Die Bestätigungsfläche liegt ausserhalb des contentEditable und gelangt
 *   deshalb nie in editor.innerHTML.
 *
 * value/onChange-Vertrag:
 *   - onChange wird ausschliesslich gemeldet, wenn sich editor.innerHTML
 *     tatsächlich geändert hat — wirkungslose Aktionen bleiben folgenlos.
 *   - Ein externer value-Wechsel wird immer übernommen und löst nie onChange
 *     aus. Ein vom Elternformular zurückgespiegelter Wert überschreibt den
 *     Editor nicht.
 *
 * Blog-Editor (AdminBlogManager) bleibt unverändert.
 */

import React, { useRef, useEffect, useLayoutEffect, useCallback, useId, useState } from 'react';
import {
  Bold, Italic, List, ListOrdered, Link as LinkIcon,
  Unlink, Globe, Undo2, Redo2, X, Plus, Table,
  Trash2, Scissors, ChevronDown,
} from 'lucide-react';
import { insertPlainTextAtCaret } from './richTextPasteUtils';
import { normalizeInlineFormatting } from './richTextFormatting';
import {
  BLOCK_LABELS,
  BLOCK_MESSAGES,
  clampBoundarySelection,
  getBlockType,
  resolveSelectionContext,
  resolveTableSelection,
  insertBlock,
  unwrapBlock,
  deleteBlock,
  tableInsertRowAbove,
  tableInsertRowBelow,
  tableDeleteRowAt,
  tableInsertColLeft,
  tableInsertColRight,
  tableDeleteColAt,
  tableToggleHeader,
  tableToText,
} from './richTextBlockUtils';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const HEADING_LEVELS = ['H2', 'H3', 'H4'];

/** Sicherheitsabstand des Einfüge-Menüs zum Viewportrand (px) */
const MENU_EDGE_MARGIN = 8;

/** Reihenfolge der Bausteine im Einfüge-Menü */
const INSERT_BLOCK_TYPES = [
  'info-box',
  'tip-box',
  'warning-box',
  'checklist',
  'table',
  'cta-box',
];

// ---------------------------------------------------------------------------
// Hilfsfunktion: execCommand-Wrapper
// ---------------------------------------------------------------------------

function exec(command, value = null) {
  document.execCommand(command, false, value);
}

// ---------------------------------------------------------------------------
// Toolbar-Button
// ---------------------------------------------------------------------------

function ToolBtn({
  onClick, title, active, disabled, children, testId,
  ariaExpanded, ariaHasPopup, ariaControls,
}) {
  // Ein Button mit Aufklappmenü meldet seinen Zustand über aria-expanded —
  // aria-pressed daneben wäre eine zweite, widersprüchliche Zustandsaussage.
  const isMenuButton = ariaExpanded !== undefined;

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      title={title}
      disabled={disabled}
      aria-pressed={isMenuButton ? undefined : active}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-controls={ariaControls}
      data-testid={testId}
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

function isUnsafeHref(rawUrl) {
  const lower = rawUrl.trim().toLowerCase().replace(/\s+/g, '');
  return (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  );
}

/**
 * Erzeugt ein a-Element ausschliesslich über DOM-APIs.
 *
 * Linktext wird über textContent gesetzt und href über setAttribute — beides
 * behandelt Benutzereingaben als Daten, nie als Markup. Zeichen wie < > & " '
 * können dadurch weder ein zusätzliches Element noch ein Event-Attribut
 * erzeugen. Es wird bewusst kein HTML-String zusammengesetzt.
 *
 * @param {{ text: string, href: string }} params
 * @returns {HTMLAnchorElement}
 */
function createLinkElement({ text, href }) {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  // Interne Links (beginnen mit /) bleiben im selben Tab und ohne rel
  if (!href.startsWith('/')) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }
  anchor.textContent = text;
  return anchor;
}

/**
 * Fügt einen Link an der aktuellen Cursorposition ein — über Range/DOM
 * statt über execCommand('insertHTML') mit einem zusammengebauten String.
 *
 * @param {{ text: string, href: string }} params
 * @returns {HTMLAnchorElement|null} das eingefügte Element oder null
 */
function insertLinkAtCaret({ text, href }) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  range.deleteContents();

  const anchor = createLinkElement({ text, href });
  range.insertNode(anchor);

  // Caret hinter den Link setzen
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  return anchor;
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
  const colorClass = isInternal ? 'bg-blue-50 border-blue-100' : 'bg-teal-50 border-teal-100';
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
// Abschnitts-Anzeige (aktueller Baustein-Typ)
// ---------------------------------------------------------------------------

/** Farb-Klassen je Baustein-Typ für die Statuszeile */
const BLOCK_BADGE_STYLES = {
  'info-box':    'bg-blue-100 text-blue-800 border border-blue-200',
  'tip-box':     'bg-emerald-100 text-emerald-800 border border-emerald-200',
  'warning-box': 'bg-amber-100 text-amber-800 border border-amber-200',
  'checklist':   'bg-gray-100 text-gray-800 border border-gray-300',
  'cta-box':     'bg-orange-100 text-orange-800 border border-orange-200',
  'table':       'bg-purple-100 text-purple-800 border border-purple-200',
};

function SectionBadge({ blockType, multiple }) {
  const neutral = 'bg-gray-50 text-gray-500 border border-gray-200';
  const label = multiple
    ? 'Mehrere Abschnitte'
    : (blockType ? BLOCK_LABELS[blockType] : 'Normaler Text');
  const style = !multiple && blockType ? BLOCK_BADGE_STYLES[blockType] : neutral;
  return (
    <span
      data-testid="section-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}
    >
      Aktueller Abschnitt: {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Baustein-Aktions-Leiste
// ---------------------------------------------------------------------------

function BlockActions({ blockType, onAction }) {
  if (!blockType) return null;
  const isTable = blockType === 'table';

  return (
    <div
      data-testid="block-actions"
      className="border-b border-gray-100 bg-gray-50 px-2 py-1 flex flex-wrap gap-1 items-center text-xs"
    >
      <span className="text-gray-500 mr-1">Baustein:</span>

      {isTable && (
        <>
          <ToolBtn
            onClick={() => onAction('row-above')}
            title="Zeile oberhalb einfügen"
            testId="btn-row-above"
          >
            ↑ Zeile
          </ToolBtn>
          <ToolBtn
            onClick={() => onAction('row-below')}
            title="Zeile unterhalb einfügen"
            testId="btn-row-below"
          >
            ↓ Zeile
          </ToolBtn>
          <ToolBtn
            onClick={() => onAction('col-left')}
            title="Spalte links einfügen"
            testId="btn-col-left"
          >
            ← Spalte
          </ToolBtn>
          <ToolBtn
            onClick={() => onAction('col-right')}
            title="Spalte rechts einfügen"
            testId="btn-col-right"
          >
            → Spalte
          </ToolBtn>
          <ToolBtn
            onClick={() => onAction('del-row')}
            title="Aktuelle Zeile löschen"
            testId="btn-del-row"
          >
            Zeile löschen
          </ToolBtn>
          <ToolBtn
            onClick={() => onAction('del-col')}
            title="Aktuelle Spalte löschen"
            testId="btn-del-col"
          >
            Spalte löschen
          </ToolBtn>
          <ToolBtn
            onClick={() => onAction('toggle-header')}
            title="Kopfzeile ein-/ausschalten"
            testId="btn-toggle-header"
          >
            Kopfzeile
          </ToolBtn>
          <Sep />
          {/* Tabellen werden ausschliesslich über tableToText umgewandelt —
              ein generisches Entkleiden würde tr/td ohne table zurücklassen. */}
          <ToolBtn
            onClick={() => onAction('table-to-text')}
            title="Tabelle in normalen Text umwandeln (Zellinhalte bleiben erhalten)"
            testId="btn-table-to-text"
          >
            <Scissors size={11} />
            Tabelle in Text umwandeln
          </ToolBtn>
        </>
      )}

      {!isTable && (
        <ToolBtn
          onClick={() => onAction('unwrap')}
          title="In normalen Text umwandeln (Hülle entfernen, Inhalt bleibt)"
          testId="btn-unwrap"
        >
          <Scissors size={11} />
          In Text umwandeln
        </ToolBtn>
      )}
      <ToolBtn
        onClick={() => onAction('delete')}
        title="Baustein vollständig löschen"
        testId="btn-delete-block"
      >
        <Trash2 size={11} />
        Baustein löschen
      </ToolBtn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bestätigungsfläche für destruktive Aktionen
// ---------------------------------------------------------------------------

/**
 * Nicht blockierende Bestätigung innerhalb der Editoroberfläche.
 *
 * Ersetzt window.confirm vollständig. Der auslösende Eingabe-Handler kehrt
 * sofort zurück; die Entscheidung fällt erst über einen der beiden Schalter
 * oder über Escape.
 *
 * Bewusst kein aria-modal und kein Fokus-Käfig: der Editor bleibt währenddessen
 * bedienbar. Die Aktion hängt nicht an der Selektion, sondern am erfassten
 * Ziel — ein Klick in einen anderen Baustein kann deshalb nichts verfälschen.
 *
 * Die Schalter reagieren auf click (nicht auf mouseDown wie die Werkzeugleiste):
 * sie sollen den Fokus erhalten dürfen, danach führt der Aufrufer ihn
 * ausdrücklich in den Editor zurück.
 *
 * Die IDs für aria-labelledby/aria-describedby stammen aus useId() und sind
 * damit je Instanz eindeutig: stehen zwei Editoren auf derselben Seite und ist
 * in beiden eine Rückfrage offen, zeigt jede Beschriftung nachweislich auf den
 * eigenen Text. Feste IDs würden hier doppelt vergeben und die zweite Rückfrage
 * mit dem Titel der ersten beschriften.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.message
 * @param {string} props.confirmLabel
 * @param {function} props.onConfirm
 * @param {function} props.onCancel
 */
function ConfirmPanel({ title, message, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const uid = useId();
  const titleId = `${uid}-block-confirm-title`;
  const messageId = `${uid}-block-confirm-message`;

  // Startfokus auf „Abbrechen": bei einer destruktiven Rückfrage ist der
  // ungefährliche Ausgang die richtige Vorgabe.
  useEffect(() => {
    const btn = cancelRef.current;
    if (btn && typeof btn.focus === 'function') btn.focus();
  }, []);

  // Escape bricht ab, unabhängig davon, wo der Fokus gerade steht. Der Listener
  // besteht nur, solange die Rückfrage offen ist.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onCancel]);

  return (
    <div
      data-testid="block-confirm"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="border-b border-red-200 bg-red-50 px-3 py-2 flex flex-wrap gap-2 items-center justify-between"
    >
      <div className="text-xs text-red-900">
        <p id={titleId} data-testid="block-confirm-title" className="font-bold">
          {title}
        </p>
        <p id={messageId} data-testid="block-confirm-message">
          {message}
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="button"
          ref={cancelRef}
          data-testid="block-confirm-cancel"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
        >
          Abbrechen
        </button>
        <button
          type="button"
          data-testid="block-confirm-accept"
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Einfüge-Menü
// ---------------------------------------------------------------------------

/**
 * Aufklappmenü „Baustein einfügen".
 *
 * Das geöffnete Menü schliesst sich über vier Wege:
 *   1. erneuter Klick auf den Toolbar-Button
 *   2. Auswahl eines Menüeintrags (erst nachdem dieser verarbeitet wurde)
 *   3. Escape
 *   4. Zeiger-/Mausklick ausserhalb des Menücontainers
 *
 * Die globalen Listener bestehen ausschliesslich, solange das Menü offen ist,
 * und werden beim Schliessen wie beim Unmount vollständig entfernt.
 *
 * Weder Escape noch ein Aussenklick verändern den Artikel: es wird nur der
 * lokale Öffnungszustand gesetzt. Die Editor-Selektion bleibt unangetastet —
 * das Menü verhindert lediglich den Fokusverlust über mousedown.
 */
function InsertMenu({ onInsert, disabled }) {
  const [open, setOpen] = useState(false);
  // Horizontale Korrektur (px) gegenüber der Standardposition `left: 0`.
  // Der Trigger steht in einer flex-wrap-Toolbar — seine Position gegenüber
  // dem Viewport ist je nach Breite (390/768/1280) nicht vorhersagbar genug
  // für eine rein statische CSS-Ausrichtung. Deshalb wird beim Öffnen und bei
  // jedem Grössenwechsel gemessen und nötigenfalls in den sichtbaren Bereich
  // gerückt (siehe measureAndClamp).
  const [menuOffsetX, setMenuOffsetX] = useState(0);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = 'insert-block-menu';

  const handleInsert = (type) => {
    setOpen(false);
    onInsert(type);
  };

  /**
   * Misst das offene Menü und korrigiert seinen horizontalen Versatz so, dass
   * es mit MENU_EDGE_MARGIN Abstand im Viewport bleibt.
   *
   * Der Versatz wird additiv fortgeschrieben (prev + delta), weil das gemessene
   * Rechteck den bereits angewandten Versatz enthält. Nur so liefert ein
   * zweiter Aufruf — etwa nach einem Resize — wieder ein richtiges Ergebnis
   * statt den alten Wert zu ersetzen.
   *
   * Bei delta === 0 wird kein State gesetzt; damit kann auch ein häufig
   * feuerndes resize-Ereignis keine Renderschleife auslösen.
   *
   * Randfall: unterhalb von etwa 2 × Rand + Menübreite (~216 px) sind beide
   * Ränder mathematisch nicht gleichzeitig erfüllbar. Dann gewinnt der linke
   * Rand, weil die Einträge von links gelesen werden.
   */
  const measureAndClamp = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    let delta = 0;
    if (rect.right > window.innerWidth - MENU_EDGE_MARGIN) {
      delta -= rect.right - (window.innerWidth - MENU_EDGE_MARGIN);
    }
    if (rect.left + delta < MENU_EDGE_MARGIN) {
      delta += MENU_EDGE_MARGIN - (rect.left + delta);
    }
    if (delta === 0) return;
    setMenuOffsetX((prev) => prev + delta);
  }, []);

  // Vor dem ersten Paint messen und in den Viewport klemmen — verhindert
  // Aufblitzen an falscher Position.
  useLayoutEffect(() => {
    if (!open) return;
    measureAndClamp();
  }, [open, measureAndClamp]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    // Ein Klick innerhalb des Containers — auch auf den Toolbar-Button selbst —
    // darf hier nichts schliessen: den Button behandelt sein eigener onClick,
    // ein Menüeintrag muss zuerst verarbeitet werden.
    const handleOutsidePointer = (e) => {
      const el = containerRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };

    // Ein Grössenwechsel bei offenem Menü verschiebt den Trigger (die Toolbar
    // bricht anders um) — derselbe Rechenweg klemmt danach erneut.
    const handleResize = () => measureAndClamp();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    document.addEventListener('mousedown', handleOutsidePointer, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsidePointer, true);
      document.removeEventListener('mousedown', handleOutsidePointer, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, measureAndClamp]);

  // Beim Schliessen zurücksetzen, damit ein Neuöffnen nie kurzzeitig die
  // Korrektur einer vorherigen (ggf. anderen) Trigger-Position zeigt.
  useEffect(() => {
    if (!open) setMenuOffsetX(0);
  }, [open]);

  return (
    <div className="relative" data-testid="insert-menu-container" ref={containerRef}>
      <ToolBtn
        onClick={() => setOpen((v) => !v)}
        title="Baustein einfügen"
        active={open}
        disabled={disabled}
        testId="btn-insert-block"
        ariaExpanded={open}
        ariaHasPopup="menu"
        ariaControls={open ? menuId : undefined}
      >
        <Plus size={12} />
        <span>Baustein</span>
        <ChevronDown size={10} />
      </ToolBtn>

      {open && (
        <div
          id={menuId}
          data-testid="insert-menu"
          ref={menuRef}
          role="menu"
          aria-label="Baustein einfügen"
          className="absolute top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] py-1"
          style={{ left: `${menuOffsetX}px` }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {INSERT_BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              data-testid={`insert-${type}`}
              onClick={() => handleInsert(type)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <BlockIcon type={type} />
              {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kleines Farb-Icon je Baustein-Typ im Menü */
function BlockIcon({ type }) {
  const colors = {
    'info-box':    'bg-blue-400',
    'tip-box':     'bg-emerald-400',
    'warning-box': 'bg-amber-400',
    'checklist':   'bg-gray-400',
    'cta-box':     'bg-orange-400',
    'table':       'bg-purple-400',
  };
  if (type === 'table') return <Table size={12} className="text-purple-500" />;
  return <span className={`inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 ${colors[type] || 'bg-gray-300'}`} />;
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
  const editorShellRef = useRef(null);
  const savedSelection = useRef(null);

  // Kontrollierte value-Synchronisierung ohne „interner Änderungs"-Flag.
  //
  // syncedHtml   — das HTML, das der Editor zuletzt nachweislich anzeigte
  //                (Vergleichsbasis für „hat sich wirklich etwas geändert?")
  // emittedValue — der zuletzt an das Elternformular gemeldete Wert
  //                (erkennt das Zurückspiegeln des eigenen Werts)
  //
  // Beide sind reine Wertspeicher: sie können nie „hängen bleiben" und dadurch
  // einen echten externen value-Wechsel verschlucken.
  const syncedHtml = useRef(null);
  const emittedValue = useRef(null);

  // Formatierungszustände für Toolbar
  const [fmt, setFmt] = useState({
    bold: false, italic: false, h2: false, h3: false, h4: false,
    ul: false, ol: false, link: false,
  });
  const [linkMode, setLinkMode] = useState(null); // null | 'external' | 'internal'

  // Baustein-Zustand — nur der sichtbare Abschnittstyp, niemals ein DOM-Element.
  // Der Container wird bei jeder Aktion frisch aus Selektion + editorRef ermittelt.
  const [blockState, setBlockState] = useState({
    inEditor: false, multiple: false, blockType: null,
  });
  const [insertError, setInsertError] = useState('');
  // Fokus-Rahmen des aktuellen Bausteins — liegt ausserhalb des contentEditable
  const [focusRect, setFocusRect] = useState(null);

  // Offene Sicherheitsabfrage.
  //
  // confirmUi   — ausschliesslich die sichtbaren Texte (State, weil gerendert)
  // pendingRef  — der erfasste Aktionskontext inkl. DOM-Knoten (Ref, weil
  //               DOM-Referenzen nicht in den React-State gehören und die
  //               Ausführung sie synchron und ohne Renderzyklus braucht)
  const [confirmUi, setConfirmUi] = useState(null);
  const pendingRef = useRef(null);

  const resetBlockState = useCallback(() => {
    setBlockState({ inEditor: false, multiple: false, blockType: null });
    setFocusRect(null);
  }, []);

  /** Offene Rückfrage schliessen und den erfassten Zielkontext verwerfen */
  const clearConfirm = useCallback(() => {
    pendingRef.current = null;
    setConfirmUi((prev) => (prev === null ? prev : null));
  }, []);

  // HTML in den Editor laden, wenn value sich von aussen ändert.
  //
  // Entschieden wird ausschliesslich über einen Wertvergleich zwischen
  // angezeigtem HTML, zuletzt gemeldetem Wert und neuem value:
  //
  //   value === angezeigtes HTML   → nichts zu tun
  //   value === zuletzt gemeldet   → Echo des Elternformulars, nichts zu tun
  //   sonst                        → echter externer Wechsel, Inhalt übernehmen
  //
  // Kein onChange und keine automatische Normalisierung beim blossen Laden.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const next = value || '';
    if (next === el.innerHTML) {
      syncedHtml.current = el.innerHTML;
      return;
    }
    // Das Elternformular spiegelt exakt unsere letzte Meldung zurück: der
    // Editor zeigt diesen Stand bereits. Ein Überschreiben würde nur den
    // Cursor zerstören und könnte eine Schleife auslösen.
    if (next === emittedValue.current) return;

    el.innerHTML = next;
    // Nach dem Schreiben zurücklesen — der Browser normalisiert das Markup
    syncedHtml.current = el.innerHTML;
    emittedValue.current = null;
    // Alle bisherigen Container- und Selektionsbezüge sind jetzt verwaist
    savedSelection.current = null;
    // Dazu gehört auch eine noch offene Rückfrage: ihr Ziel stammt aus dem
    // vorherigen Artikel und existiert nicht mehr.
    clearConfirm();
    resetBlockState();
    setInsertError('');
  }, [value, resetBlockState, clearConfirm]);

  // Schutz vor der Chromium-Auswahl über die Blockgrenze hinaus.
  //
  // Der Listener hängt am nativen beforeinput-Ereignis und läuft damit
  // garantiert vor der DOM-Veränderung durch den Browser. Reacts synthetisches
  // onBeforeInput ist dafür ungeeignet: es stammt aus keypress/textInput und
  // führt kein inputType mit.
  //
  // Das Ereignis wird ausdrücklich nicht verhindert — nach der Korrektur setzt
  // der Browser den Text normal ein. Es wird nichts gemeldet: die anschliessende
  // echte Eingabe löst onInput und damit notifyChange aus.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return undefined;

    const handleBeforeInput = (event) => {
      const sel = typeof window !== 'undefined' && window.getSelection
        ? window.getSelection()
        : null;
      clampBoundarySelection(el, sel, event.inputType);
    };

    el.addEventListener('beforeinput', handleBeforeInput);
    return () => el.removeEventListener('beforeinput', handleBeforeInput);
  }, []);

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

  // onChange an übergeordnete Komponente melden.
  //
  // Gemeldet wird nur, wenn sich editor.innerHTML gegenüber dem zuletzt
  // synchronisierten Stand tatsächlich unterscheidet. Der Rückgabewert von
  // document.execCommand genügt dafür nicht — er sagt browserabhängig nichts
  // Verlässliches darüber aus, ob das DOM verändert wurde. Eine wirkungslose
  // Aktion hinterlässt dadurch weder ein onChange noch internen Zustand.
  const notifyChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    if (html === syncedHtml.current) return;

    syncedHtml.current = html;
    const normalized = normalizeInlineFormatting(html);
    emittedValue.current = normalized;
    onChange(normalized);
  }, [onChange]);

  // Fokus-Rahmen am aktuell erkannten Baustein ausrichten.
  // Der Rahmen ist ein Overlay ausserhalb des contentEditable und wird deshalb
  // nie Bestandteil von editor.innerHTML.
  const updateFocusRect = useCallback((container) => {
    const shell = editorShellRef.current;
    if (!container || !shell || typeof container.getBoundingClientRect !== 'function') {
      setFocusRect((prev) => (prev === null ? prev : null));
      return;
    }
    const box = container.getBoundingClientRect();
    const host = shell.getBoundingClientRect();
    const next = {
      top: box.top - host.top,
      left: box.left - host.left,
      width: box.width,
      height: box.height,
    };
    setFocusRect((prev) => (
      prev && prev.top === next.top && prev.left === next.left
        && prev.width === next.width && prev.height === next.height
        ? prev
        : next
    ));
  }, []);

  // Baustein-Zustand aus der aktuellen Selektion neu bestimmen
  const syncBlockState = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const ctx = resolveSelectionContext(el);
    setBlockState((prev) => (
      prev.inEditor === ctx.inEditor && prev.multiple === ctx.multiple
        && prev.blockType === ctx.blockType
        ? prev
        : { inEditor: ctx.inEditor, multiple: ctx.multiple, blockType: ctx.blockType }
    ));
    updateFocusRect(ctx.container);
  }, [updateFocusRect]);

  // Selektionswechsel zuverlässig beobachten (auch ohne Editor-Event)
  useEffect(() => {
    const handler = () => syncBlockState();
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [syncBlockState]);

  // Ist aktuell überhaupt ein Fokus-Rahmen sichtbar?
  const hasFocusOverlay = focusRect !== null
    && !!blockState.blockType
    && !blockState.multiple;

  // Fokus-Rahmen nachführen, wenn sich nicht die Selektion, sondern das Layout
  // ändert: Fenstergrösse, Scrollen im Editor, Grössenänderung des Editors.
  //
  // Die Listener bestehen nur, solange auch ein Rahmen sichtbar ist — es
  // bleiben keine dauerhaften globalen Listener zurück. syncBlockState liest
  // die Selektion frisch aus und setzt focusRect nur bei geänderten Werten,
  // deshalb entstehen weder Schleifen noch überflüssige State-Updates.
  useEffect(() => {
    if (!hasFocusOverlay) return undefined;
    const el = editorRef.current;
    const handler = () => syncBlockState();

    window.addEventListener('resize', handler);
    if (el) el.addEventListener('scroll', handler);

    let observer = null;
    if (el && typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(handler);
      observer.observe(el);
    }

    return () => {
      window.removeEventListener('resize', handler);
      if (el) el.removeEventListener('scroll', handler);
      if (observer) observer.disconnect();
    };
  }, [hasFocusOverlay, syncBlockState]);

  // Formatierungszustand und Baustein-Typ der aktuellen Selektion prüfen
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
    } catch (_) { /* queryCommandState kann werfen */ }

    syncBlockState();
  }, [syncBlockState]);

  // Toolbar-Aktionen
  const applyBold = () => { exec('styleWithCSS', false); exec('bold'); notifyChange(); };
  const applyItalic = () => { exec('styleWithCSS', false); exec('italic'); notifyChange(); };
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
      // Markierter Text wird vom Browser selbst in ein a-Element gehüllt
      exec('createLink', href);
    } else {
      insertLinkAtCaret({ text, href });
    }
    notifyChange();
  };

  const openLinkPanel = (mode) => {
    saveSelection();
    setLinkMode((prev) => (prev === mode ? null : mode));
  };

  // Baustein einfügen
  const handleInsertBlock = useCallback((type) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const result = insertBlock(type, el);
    if (!result.success) {
      setInsertError(result.message || 'Baustein konnte nicht eingefügt werden.');
      return;
    }
    setInsertError('');
    updateFormatState();
    notifyChange();
  }, [notifyChange, updateFormatState]);

  // Ergebnis einer ausgeführten Baustein-Aktion verarbeiten.
  // onChange läuft ausschliesslich bei tatsächlich erfolgter Änderung.
  const finishAction = useCallback((result) => {
    if (result && result.success) {
      setInsertError('');
      notifyChange();
    } else {
      setInsertError((result && result.message) || 'Aktion nicht möglich.');
    }
    syncBlockState();
  }, [notifyChange, syncBlockState]);

  // Fokus nach einer Rückfrage kontrolliert in den Editor zurückführen
  const returnFocusToEditor = useCallback(() => {
    const el = editorRef.current;
    if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
  }, []);

  /**
   * Rückfrage öffnen: Ziel festhalten, Oberfläche anzeigen, sofort zurückkehren.
   *
   * Es wird nichts gelöscht, nichts umgewandelt und kein onChange gemeldet.
   *
   * @param {{action: string, container: Element, cell: Element|null, blockType: string}} pending
   * @param {{title: string, message: string, confirmLabel: string}} ui
   */
  const requestConfirm = useCallback((pending, ui) => {
    pendingRef.current = pending;
    setConfirmUi(ui);
    setInsertError('');
  }, []);

  /**
   * Ist das erfasste Ziel noch dasselbe und noch verwendbar?
   *
   * Zwischen Klick und Bestätigung kann beliebig viel geschehen sein: der
   * Baustein kann entfernt, ersetzt oder durch einen externen Wechsel abgelöst
   * worden sein. Erst wenn alle Prüfungen zutreffen, wird ausgeführt.
   *
   * @param {{container: Element, cell: Element|null, blockType: string}} pending
   * @param {Element} el
   * @returns {boolean}
   */
  const isPendingTargetValid = useCallback((pending, el) => {
    const { container, cell, blockType } = pending;
    if (!container || !container.isConnected || !el.contains(container)) return false;
    // Gleicher Knoten, aber inzwischen andere Struktur → nicht mehr dasselbe Ziel
    if (getBlockType(container) !== blockType) return false;
    if (cell) {
      if (!cell.isConnected || !el.contains(cell)) return false;
      if (cell.closest('table') !== container) return false;
    }
    return true;
  }, []);

  // Rückfrage abbrechen: DOM unverändert, kein onChange, Zielkontext verworfen.
  const handleConfirmCancel = useCallback(() => {
    clearConfirm();
    returnFocusToEditor();
    syncBlockState();
  }, [clearConfirm, returnFocusToEditor, syncBlockState]);

  // Rückfrage bestätigen: Aktion genau einmal auf dem erfassten Ziel ausführen.
  const handleConfirmAccept = useCallback(() => {
    const el = editorRef.current;
    const pending = pendingRef.current;

    // Zuerst verbrauchen: ein zweiter Klick — auch als Doppelklick vor dem
    // nächsten Render — findet keinen Kontext mehr und läuft ins Leere.
    pendingRef.current = null;
    setConfirmUi(null);

    if (!el || !pending) {
      returnFocusToEditor();
      return;
    }

    if (!isPendingTargetValid(pending, el)) {
      setInsertError(BLOCK_MESSAGES.staleBlock);
      returnFocusToEditor();
      syncBlockState();
      return;
    }

    let result;
    switch (pending.action) {
      case 'delete':
        result = deleteBlock(pending.container, el);
        break;
      case 'table-to-text':
        result = tableToText(pending.container, el);
        break;
      // Die Aktion läuft auf der erfassten Zelle, nicht auf der Selektion.
      // Die Bestätigung ist an dieser Stelle bereits erteilt — die
      // Hilfsfunktion darf deshalb nie erneut nachfragen.
      case 'del-row':
        result = tableDeleteRowAt(pending.cell, el, { confirm: () => true });
        break;
      case 'del-col':
        result = tableDeleteColAt(pending.cell, el, { confirm: () => true });
        break;
      default:
        result = { success: false, message: 'Unbekannte Aktion.' };
    }

    finishAction(result);
    returnFocusToEditor();
  }, [finishAction, isPendingTargetValid, returnFocusToEditor, syncBlockState]);

  /**
   * Baustein-Aktionen.
   *
   * Ungefährliche Aktionen laufen unmittelbar; der Container wird dafür frisch
   * aus Selektion und editorRef ermittelt. Destruktive Aktionen führen hier
   * nichts aus: sie erfassen ihr Ziel und öffnen die Rückfrage.
   */
  const handleBlockAction = useCallback((action) => {
    const el = editorRef.current;
    if (!el) return;

    // Eine noch offene Rückfrage gehört zu einem anderen Klick — sie verfällt.
    clearConfirm();

    const ctx = resolveSelectionContext(el);
    if (!ctx.inEditor || ctx.multiple || !ctx.container) {
      setInsertError(ctx.multiple ? BLOCK_MESSAGES.multiSection : BLOCK_MESSAGES.staleBlock);
      syncBlockState();
      return;
    }

    const container = ctx.container;
    const blockType = getBlockType(container);
    const isTable = blockType === 'table';

    // --- Aktionen mit Rückfrage ------------------------------------------
    if (action === 'delete') {
      const label = blockType ? BLOCK_LABELS[blockType] : 'diesen Baustein';
      requestConfirm(
        { action: 'delete', container, cell: null, blockType },
        {
          title: 'Baustein löschen',
          message: `„${label}" vollständig löschen? Alle Inhalte gehen verloren.`,
          confirmLabel: 'Baustein löschen',
        },
      );
      return;
    }

    // Sicherheitsnetz: für Tabellen niemals generisch entkleiden
    if (action === 'table-to-text' || (action === 'unwrap' && isTable)) {
      if (!isTable) {
        setInsertError(BLOCK_MESSAGES.noTable);
        syncBlockState();
        return;
      }
      requestConfirm(
        { action: 'table-to-text', container, cell: null, blockType: 'table' },
        {
          title: 'Tabelle in Text umwandeln',
          message: 'Tabelle in normalen Text umwandeln? Die Zellinhalte bleiben erhalten.',
          confirmLabel: 'Umwandeln',
        },
      );
      return;
    }

    if (action === 'del-row' || action === 'del-col') {
      const target = resolveTableSelection(el);
      if (!target.ok) {
        setInsertError(target.message);
        syncBlockState();
        return;
      }

      // Ob überhaupt gefragt werden muss, entscheidet allein die Hilfsfunktion.
      // Eine ablehnende Bestätigung lässt sie ohne jede DOM-Änderung abbrechen —
      // leere Zeilen und Spalten löscht sie dagegen sofort, unverändert zum
      // bisherigen Verhalten.
      let needsConfirm = false;
      const probe = { confirm: () => { needsConfirm = true; return false; } };
      const result = action === 'del-row'
        ? tableDeleteRowAt(target.cell, el, probe)
        : tableDeleteColAt(target.cell, el, probe);

      if (needsConfirm) {
        requestConfirm(
          { action, container: target.table, cell: target.cell, blockType: 'table' },
          action === 'del-row'
            ? {
              title: 'Zeile löschen',
              message: BLOCK_MESSAGES.confirmRow,
              confirmLabel: 'Zeile löschen',
            }
            : {
              title: 'Spalte löschen',
              message: BLOCK_MESSAGES.confirmCol,
              confirmLabel: 'Spalte löschen',
            },
        );
        return;
      }

      finishAction(result);
      return;
    }

    // --- Aktionen ohne Rückfrage -----------------------------------------
    let result;
    switch (action) {
      case 'unwrap':        result = unwrapBlock(container, el); break;
      case 'row-above':     result = tableInsertRowAbove(el); break;
      case 'row-below':     result = tableInsertRowBelow(el); break;
      case 'col-left':      result = tableInsertColLeft(el); break;
      case 'col-right':     result = tableInsertColRight(el); break;
      case 'toggle-header':
        result = isTable
          ? tableToggleHeader(container)
          : { success: false, message: BLOCK_MESSAGES.noTable };
        break;
      default:
        result = { success: false, message: 'Unbekannte Aktion.' };
    }

    finishAction(result);
  }, [clearConfirm, finishAction, requestConfirm, syncBlockState]);

  // Tastaturkürzel
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setInsertError('');
    }
    setTimeout(updateFormatState, 0);
  };

  // Clipboard: ausschliesslich text/plain
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    insertPlainTextAtCaret(text);
    notifyChange();
  };

  // Die Baustein-Gestaltung stammt aus der öffentlichen Klasse `prose-ratgeber`
  // (src/index.css) — hier stehen ausschliesslich editor-spezifische Hilfen:
  // sichtbare Zellgrenzen während der Tabellenbearbeitung.
  const editorBlockStyles = `
    [&_th]:border [&_th]:border-gray-300
    [&_td]:border [&_td]:border-gray-200
  `;

  return (
    // Kein overflow-hidden hier: die Sticky-Aktionsleiste braucht den
    // Dokument-Scroll als Bezug, ein overflow-hidden-Vorfahre würde jeden
    // sticky-Nachfahren stattdessen auf diese (nicht scrollende) Box
    // beschränken. Toolbar und Fusszeile runden ihre Ecken deshalb selbst.
    <div className="border border-gray-200 rounded-lg shadow-sm">

      {/* Toolbar */}
      <div
        className="bg-gray-50 border-b border-gray-200 rounded-t-lg p-2 flex flex-wrap gap-1 items-center"
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

        <Sep />

        {/* Baustein einfügen */}
        <InsertMenu onInsert={handleInsertBlock} disabled={false} />

        {/* Abschnitts-Anzeige */}
        <div className="ml-auto">
          <SectionBadge blockType={blockState.blockType} multiple={blockState.multiple} />
        </div>
      </div>

      {/* Link-Panel */}
      {linkMode && (
        <LinkPanel
          mode={linkMode}
          onClose={() => setLinkMode(null)}
          onInsert={handleLinkInsert}
        />
      )}

      {/* Baustein-Aktionen + Sicherheitsabfrage.
          Unterhalb des Desktop-Breakpoints (lg) sticky knapp unter der
          Hauptnavigation (h-20 = top-20, z-index unter deren z-50): bei
          langen Artikeln bleibt die Leiste beim Scrollen zum aktiven,
          weit unten liegenden Baustein erreichbar. Auf Desktop bleibt das
          bisherige statische Verhalten unverändert. */}
      {((blockState.inEditor && !blockState.multiple && blockState.blockType) || confirmUi) && (
        <div className="sticky top-20 z-40 lg:static lg:top-auto lg:z-auto">
          {blockState.inEditor && !blockState.multiple && blockState.blockType && (
            <BlockActions
              blockType={blockState.blockType}
              onAction={handleBlockAction}
            />
          )}

          {/* Sicherheitsabfrage — ausserhalb des contentEditable, damit weder
              die Texte noch die Schalter je in editor.innerHTML landen können. */}
          {confirmUi && (
            <ConfirmPanel
              title={confirmUi.title}
              message={confirmUi.message}
              confirmLabel={confirmUi.confirmLabel}
              onConfirm={handleConfirmAccept}
              onCancel={handleConfirmCancel}
            />
          )}
        </div>
      )}

      {/* Einfüge-Fehlermeldung */}
      {insertError && (
        <div
          data-testid="insert-error"
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between"
        >
          <span>{insertError}</span>
          <button
            type="button"
            onClick={() => setInsertError('')}
            className="text-amber-600 hover:text-amber-800 ml-2"
            aria-label="Meldung schliessen"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* WYSIWYG-Editierbereich.
          `overflow-hidden` begrenzt hier ausschliesslich den Fokus-Rahmen:
          bei einer Tabelle, die breiter als der Editor ist, ist auch das
          Overlay breiter als der Editor und würde die Seite sonst selbst
          horizontal verbreitern. Die Sticky-Aktionsleiste ist ein
          Geschwisterelement dieser Hülle, kein Nachfahre — sie bleibt davon
          unberührt. */}
      <div className="relative overflow-hidden" ref={editorShellRef}>
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
            // Editor-Tabellen sind direkte table-Elemente ohne .table-wrapper
            // (anders als im öffentlichen Renderer). Eine über die
            // Tabellenaktionen verbreiterte Tabelle würde sonst die ganze
            // Admin-Seite horizontal scrollbar machen. Der Overflow bleibt
            // deshalb hier lokal — der Scrollcontainer ist zugleich das
            // Element, auf dem der Fokus-Rahmen bereits einen scroll-Listener
            // hat, sodass das Overlay seine x-Position ohne Zusatzlogik
            // nachführt.
            'overflow-x-auto',
            'prose prose-sm max-w-none',
            // Öffentliche Baustein-Gestaltung im Editor wiederverwenden
            'prose-ratgeber',
            'focus:ring-2 focus:ring-inset focus:ring-teal-500',
            '[&[data-placeholder]:empty:before]:content-[attr(data-placeholder)]',
            '[&[data-placeholder]:empty:before]:text-gray-400',
            '[&[data-placeholder]:empty:before]:pointer-events-none',
            editorBlockStyles,
          ].join(' ')}
          style={{ minHeight: `${minRows * 1.6}rem` }}
          aria-label="Artikelinhalt bearbeiten"
          aria-multiline="true"
        />

        {/* Fokus-Hervorhebung des aktuellen Bausteins.
            Liegt ausserhalb des contentEditable, ist nicht klickbar und
            gelangt daher nie in editor.innerHTML. */}
        {hasFocusOverlay && (
          <div
            data-testid="block-focus-overlay"
            aria-hidden="true"
            className="pointer-events-none absolute rounded-lg ring-2 ring-teal-400/70"
            style={{
              top: `${focusRect.top - 2}px`,
              left: `${focusRect.left - 2}px`,
              width: `${focusRect.width + 4}px`,
              height: `${focusRect.height + 4}px`,
            }}
          />
        )}
      </div>

      {/* Fusszeile */}
      <div className="bg-gray-50 border-t border-gray-200 rounded-b-lg px-3 py-1.5 flex items-center justify-between">
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
