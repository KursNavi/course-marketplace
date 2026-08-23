/**
 * Hilfsfunktionen für sicheres Einfügen im AdminRichTextEditor.
 *
 * Separat aus AdminRichTextEditor.jsx ausgelagert um den
 * react-refresh/only-export-components ESLint-Regel zu erfüllen.
 */

import { normalizeInlineFormatting } from './richTextFormatting';

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

// Diese Liste ist absichtlich kleiner als der vollständige HTML-Sanitizer der
// API. Beim Einfügen aus Word, Google Docs oder einer Webseite sollen nur
// redaktionell sinnvolle Strukturen in den Editor gelangen.
const PASTED_HTML_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'H2', 'H3', 'H4',
  'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
  'STRONG', 'B', 'EM', 'I', 'U', 'S', 'MARK', 'CODE', 'ABBR',
  'BLOCKQUOTE', 'PRE', 'FIGURE', 'FIGCAPTION', 'A', 'HR', 'BR', 'SPAN', 'IMG',
]);

const PASTED_HTML_CLASSES = new Set([
  'lead', 'info-box', 'tip-box', 'warning-box', 'checklist', 'cta-box',
]);

const GLOBAL_ATTRIBUTES = new Set(['class', 'id', 'title']);
const LINK_ATTRIBUTES = new Set(['href', 'target', 'rel']);
const IMAGE_ATTRIBUTES = new Set(['src', 'alt', 'title', 'width', 'height', 'loading']);
const CELL_ATTRIBUTES = new Set(['colspan', 'rowspan']);
const ORDERED_LIST_ATTRIBUTES = new Set(['start', 'type']);
const DROP_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH']);

function isSafePastedHref(value) {
  const href = String(value || '').trim();
  if (!href) return false;
  if (href.startsWith('//')) return false;
  if (href.startsWith('/') || href.startsWith('#')) return true;
  try {
    const parsed = new URL(href, window.location.href);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
}

/**
 * Entscheidet, ob eine eingefügte Bildquelle übernommen werden darf.
 *
 * Erlaubt ist ausschliesslich eine vollständig ausgeschriebene https://-Adresse.
 * Alles andere wird verworfen — das Bild fliegt dann samt Element aus dem
 * eingefügten Inhalt, statt mit leerem src im Editor zu landen.
 *
 * Warum die Auflösung gegen window.location.href weggefallen ist:
 *   Eine protokollrelative Adresse (//fremder-host/bild.jpg) übernimmt das
 *   Protokoll der aktuellen Seite. Unter HTTPS machte new URL() daraus
 *   https://fremder-host/bild.jpg, die Protokollprüfung sagte «https» — und ein
 *   beliebiger fremder Host wurde durchgewunken. Aus demselben Grund galten
 *   relative Angaben (/bild.jpg) als sicher: sie lösten gegen die eigene
 *   Herkunft auf. Beides ist keine geprüfte Bildquelle, sondern ein Artefakt der
 *   Auflösung.
 *
 * Deshalb wird hier ohne Basis geparst. Relative und protokollrelative Formen
 * scheitern dadurch schon am Parser; die //-Form wird zusätzlich vorher
 * abgefangen, damit die Absicht im Code steht und ein später ergänztes
 * Basisargument die Lücke nicht stillschweigend wieder öffnet.
 *
 * Abgelehnt werden damit unter anderem: //host/bild.jpg, /bild.jpg, bild.jpg,
 * http://…, data:…, blob:…, javascript:… und file:…
 *
 * @param {unknown} value - Rohwert des src-Attributs aus dem eingefügten HTML
 * @returns {boolean}
 */
function isSafePastedImageSrc(value) {
  const src = String(value || '').trim();
  if (!src) return false;

  // Protokollrelativ — niemals auflösen, immer ablehnen.
  if (src.startsWith('//')) return false;

  let parsed;
  try {
    // Ohne Basis: nur absolute Adressen mit eigenem Schema kommen durch.
    parsed = new URL(src);
  } catch (_) {
    return false;
  }

  return parsed.protocol === 'https:';
}

function copyPastedChildren(source, target) {
  Array.from(source.childNodes).forEach((child) => {
    appendSanitizedPastedNode(child, target);
  });
}

function appendSanitizedPastedNode(node, target) {
  if (node.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(node.nodeValue || ''));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const source = /** @type {HTMLElement} */ (node);
  const tag = source.tagName.toUpperCase();
  if (DROP_CONTENT_TAGS.has(tag)) return;

  // Unbekannte Formatierungs-Tags werden entkleidet, nicht als HTML-Struktur
  // übernommen. Der Text bleibt damit erhalten, ohne neue Markup-Flächen zu
  // öffnen.
  if (!PASTED_HTML_TAGS.has(tag)) {
    copyPastedChildren(source, target);
    return;
  }

  if (tag === 'IMG' && !isSafePastedImageSrc(source.getAttribute('src'))) return;

  if (tag === 'A' && !isSafePastedHref(source.getAttribute('href'))) {
    copyPastedChildren(source, target);
    return;
  }

  const clean = document.createElement(tag.toLowerCase());
  Array.from(source.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;
    if (name.startsWith('on') || name === 'style' || name.startsWith('data-')) return;

    if (GLOBAL_ATTRIBUTES.has(name)) {
      if (name === 'class') {
        const classes = value.split(/\s+/).filter((className) => PASTED_HTML_CLASSES.has(className));
        if (classes.length > 0) clean.setAttribute('class', classes.join(' '));
      } else if (name === 'id' && /^[A-Za-z][A-Za-z0-9_:-]*$/.test(value)) {
        clean.setAttribute(name, value);
      } else if (name === 'title') {
        clean.setAttribute(name, value);
      }
      return;
    }

    if (tag === 'A' && LINK_ATTRIBUTES.has(name)) {
      if (name === 'href' && isSafePastedHref(value)) clean.setAttribute(name, value);
      if (name === 'target' && value === '_blank') clean.setAttribute(name, value);
      if (name === 'rel') clean.setAttribute(name, 'noopener noreferrer');
      return;
    }

    if (tag === 'IMG' && IMAGE_ATTRIBUTES.has(name)) {
      if (name === 'src' && isSafePastedImageSrc(value)) clean.setAttribute(name, value);
      if (name !== 'src') clean.setAttribute(name, value);
      return;
    }

    if ((tag === 'TD' || tag === 'TH') && CELL_ATTRIBUTES.has(name)) {
      if (/^\d+$/.test(value)) clean.setAttribute(name, value);
      return;
    }

    if (tag === 'OL' && ORDERED_LIST_ATTRIBUTES.has(name)) {
      if (name === 'start' && /^-?\d+$/.test(value)) clean.setAttribute(name, value);
      if (name === 'type' && /^[1AaIi]$/.test(value)) clean.setAttribute(name, value);
    }
  });

  // Der API-Sanitizer behandelt externe Links ebenfalls als neue Fenster und
  // versieht sie mit dem üblichen Schutz-Rel. Schon beim Einfügen soll die
  // Vorschau deshalb dasselbe Verhalten zeigen.
  if (tag === 'A') {
    const href = clean.getAttribute('href') || '';
    if (href && !href.startsWith('/') && !href.startsWith('#')) {
      clean.setAttribute('target', '_blank');
      clean.setAttribute('rel', 'noopener noreferrer');
    }
  }

  copyPastedChildren(source, clean);
  target.appendChild(clean);
}

/**
 * Bereitet HTML aus der Zwischenablage als vertrauenswürdiges DocumentFragment
 * vor. Das Fragment bleibt bis zum Einfügen vom sichtbaren Editor getrennt.
 *
 * @param {string} html — HTML aus clipboardData.getData('text/html')
 * @returns {DocumentFragment}
 */
export function sanitizePastedHtml(html) {
  const fragment = document.createDocumentFragment();
  if (!String(html || '').trim()) return fragment;

  const template = document.createElement('template');
  // Browser-Editoren verwenden für Fett/Kursiv teilweise span[style]. Die
  // bestehende Normalisierung überführt genau diese Fälle zuerst in strong/em;
  // alle übrigen Style-Attribute werden darunter weiterhin verworfen.
  template.innerHTML = normalizeInlineFormatting(String(html));
  copyPastedChildren(template.content, fragment);
  return fragment;
}

/**
 * Fügt bereinigtes HTML an der aktuellen Selection ein.
 * @returns {boolean} true, wenn sichtbare Struktur eingefügt wurde
 */
export function insertHtmlAtCaret(html) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  const fragment = sanitizePastedHtml(html);
  if (fragment.childNodes.length === 0) return false;

  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(fragment);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}
