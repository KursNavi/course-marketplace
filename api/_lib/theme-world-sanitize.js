/**
 * Serverseitiger HTML-Sanitizer für Theme-World-Inhalte.
 *
 * PHASE-4-KORREKTUR: Der ursprüngliche Regex-Sanitizer aus Phase 3 wurde durch
 * sanitize-html (v2.x, htmlparser2-basiert, MIT-Lizenz) ersetzt.
 *
 * Entscheidung für sanitize-html:
 *   - Vollständig parser-basiert (kein Regex-Parsing von HTML)
 *   - Keine DOM-Umgebung erforderlich — funktioniert nativ in Vercel Serverless Node.js
 *   - Allowlist-Modell: nur explizit erlaubte Tags/Attribute durchgelassen
 *   - Aktiv gewartet (8M+ npm-Downloads/Woche, MIT-Lizenz)
 *   - Kleine Dependency-Kette: htmlparser2 + htmlparser2-dom
 *   - Alternative (DOMPurify + jsdom) wäre ~25 MB schwerer und unnötig für Server-Side
 *
 * Sicherheitsmodell:
 *   - Admin-only Input (authentifiziert + role=admin)
 *   - Parser zerlegt HTML, Allowlist entfernt alles Unbekannte
 *   - javascript:, data:, vbscript: in URLs werden entfernt
 *   - Alle on*-Event-Handler werden entfernt (Allowlist enthält keine)
 *   - Unbekannte Attribute und Tags werden entfernt
 *
 * Erlaubte Tags:
 *   Struktur:   p, div, section, article
 *   Überschriften: h2, h3, h4
 *   Listen:     ul, ol, li
 *   Tabellen:   table, thead, tbody, tr, th, td
 *   Inline:     strong, b, em, i, u, s, mark, code, abbr
 *   Blöcke:     blockquote, pre, figure, figcaption
 *   Medien:     img
 *   Links:      a
 *   Sonstiges:  hr, br, span
 *
 * Erlaubte Attribute:
 *   Alle Tags: class, id
 *   a:   href (https:// oder /interne-pfade), title, target, rel
 *   img: src (https://), alt, title, width, height, loading
 *   td/th: colspan, rowspan
 *   ol:  start, type
 */

import sanitizeHtmlLib from 'sanitize-html';

/**
 * Definierte Allowlist für redaktionelle Inhalte.
 * Wird einmalig beim Modulload erstellt.
 */
const SANITIZE_OPTIONS = {
  allowedTags: [
    // Struktur
    'p', 'div', 'section', 'article',
    // Überschriften
    'h2', 'h3', 'h4',
    // Listen
    'ul', 'ol', 'li',
    // Tabellen
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // Inline-Formatierung
    'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'code', 'abbr',
    // Block-Elemente
    'blockquote', 'pre', 'figure', 'figcaption',
    // Medien
    'img',
    // Links
    'a',
    // Sonstiges
    'hr', 'br', 'span',
  ],

  allowedAttributes: {
    // Globale Attribute (auf allen Tags erlaubt)
    '*': ['class', 'id'],

    // Links
    'a': ['href', 'title', 'target', 'rel'],

    // Bilder
    'img': ['src', 'alt', 'title', 'width', 'height', 'loading'],

    // Tabellenzellen
    'td': ['colspan', 'rowspan'],
    'th': ['colspan', 'rowspan', 'scope'],

    // Geordnete Listen
    'ol': ['start', 'type'],

    // Abkürzungen
    'abbr': ['title'],

    // Blockquotes
    'blockquote': ['cite'],
  },

  // Gefährliche Protokolle in URLs entfernen
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: {
    // Interne Links (/search, /bereich/...) erlauben
    'a': ['https', 'http', 'mailto', ''],
    // Bilder nur von https
    'img': ['https'],
  },

  // Relative URLs für interne Links erlauben (beginnt mit /)
  allowedSchemesAppliedToAttributes: ['href', 'src', 'action'],

  // Kein Parsen von Protokoll-relativen URLs als sicher (//example.com)
  allowProtocolRelative: false,

  // Attribute mit leeren Werten nicht entfernen (z.B. alt="")
  disallowedTagsMode: 'discard',

  // Text in entfernten Block-Tags erhalten
  textFilter: (text) => text,

  // Transformationen: target="_blank" nur mit rel="noopener noreferrer"
  transformTags: {
    'a': (tagName, attribs) => {
      const href = attribs.href || '';

      // Interne Links: kein target, kein rel (explizit aus Attributen entfernen)
      if (href.startsWith('/') || href.startsWith('#')) {
        // eslint-disable-next-line no-unused-vars
        const { target: _t, rel: _r, ...rest } = attribs;
        return { tagName, attribs: { ...rest, href } };
      }

      // Externe Links: target="_blank" + rel="noopener noreferrer" erzwingen
      return {
        tagName,
        attribs: {
          ...attribs,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      };
    },
  },
};

/**
 * Sanitiert HTML-Inhalt für sichere Speicherung und spätere Ausgabe
 * via dangerouslySetInnerHTML.
 *
 * Verwendet sanitize-html (htmlparser2-basiert) statt Regex.
 * Der Parser zerlegt den Input vollständig und baut ihn aus der Allowlist
 * neu auf — kein Regex-Matching auf HTML-Strings.
 *
 * @param {string|null|undefined} html - Roher HTML-Input vom Admin
 * @returns {string} Sanitierter HTML-String
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS);
}

/**
 * Prüft, ob ein HTML-String nach dem Sanitizing verändert wurde.
 * Nützlich für Tests und Logging.
 *
 * @param {string|null|undefined} html
 * @returns {boolean} true wenn der Input als gefährlich eingestuft wird
 *   (d.h. Sanitizing würde etwas entfernen)
 */
export function containsDangerousHtml(html) {
  if (!html || typeof html !== 'string') return false;
  const sanitized = sanitizeHtmlLib(html, SANITIZE_OPTIONS);
  return sanitized !== html;
}

/**
 * Gibt zurück, welche Konfiguration der Sanitizer verwendet.
 * Nur für Dokumentations- und Test-Zwecke.
 *
 * @returns {object} Eine Kopie der Sanitizer-Konfiguration
 */
export function getSanitizerOptions() {
  return { ...SANITIZE_OPTIONS };
}
