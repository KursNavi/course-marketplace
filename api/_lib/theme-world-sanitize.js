/**
 * Serverseitiger HTML-Sanitizer für Theme-World-Inhalte.
 *
 * Entfernt gefährliche HTML-Elemente und Attribute aus Admin-Input,
 * bevor dieser in der Datenbank gespeichert wird. Der Sanitizer ist
 * speziell für den serverless-Vercel-Kontext ohne DOM-Umgebung konzipiert.
 *
 * Erlaubt:
 *   Standard-HTML-Struktur- und Formatierungselemente (p, h2-h4, ul, ol, li,
 *   table, strong, em, a, img, figure, blockquote, code, pre, hr, br),
 *   class- und id-Attribute, reguläre href/src mit https://-URLs.
 *
 * Entfernt:
 *   <script>, <iframe>, <object>, <embed>, <form>, <base>, <link>, <meta>,
 *   <style> Tags und deren Inhalte, alle on*-Event-Handler-Attribute,
 *   javascript:-URLs, data:-URLs in href/src.
 *
 * Entscheidung: Regex-basiert statt DOMPurify, da DOMPurify im serverless
 * Node.js-Umfeld ohne jsdom nicht einsatzbereit ist. Da nur Admin-User
 * (authentifiziert + role=admin) Inhalte schreiben können, ist das
 * Risikoprofil für diese Lösung akzeptabel. Bei öffentlichem Schreibzugriff
 * wäre eine vollständige DOM-Parser-Lösung erforderlich.
 */

// Tags, die vollständig mit Inhalt entfernt werden
const BLOCK_TAGS_WITH_CONTENT =
  /<(script|iframe|object|embed|form|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

// Self-closing oder öffnende Tags dieser Elemente (ohne Inhalt)
const BLOCK_TAGS_VOID =
  /<\/?(script|iframe|object|embed|form|base|link|meta|style)\b[^>]*\/?>/gi;

// Event-Handler-Attribute: on*="..." oder on*='...'
const EVENT_HANDLER_ATTRS =
  /\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi;

// javascript:-URLs in href, src, action, formaction
const JAVASCRIPT_URLS =
  /(\s+(?:href|src|action|formaction)\s*=\s*["'])(\s*javascript\s*:)/gi;

// data:-URLs in href oder src (können für XSS missbraucht werden)
const DATA_URLS =
  /(\s+(?:href|src)\s*=\s*["'])(\s*data\s*:)/gi;

// vbscript:-URLs (legacy IE-Vektor)
const VBSCRIPT_URLS =
  /(\s+(?:href|src|action|formaction)\s*=\s*["'])(\s*vbscript\s*:)/gi;

/**
 * Sanitiert HTML-Inhalt für sichere Speicherung und spätere Ausgabe
 * via dangerouslySetInnerHTML.
 *
 * @param {string|null|undefined} html - Roher HTML-Input vom Admin
 * @returns {string} Sanitierter HTML-String
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    .replace(BLOCK_TAGS_WITH_CONTENT, '')
    .replace(BLOCK_TAGS_VOID, '')
    .replace(EVENT_HANDLER_ATTRS, '')
    .replace(JAVASCRIPT_URLS, '$1#removed:')
    .replace(DATA_URLS, '$1#removed:')
    .replace(VBSCRIPT_URLS, '$1#removed:');
}

/**
 * Prüft, ob ein HTML-String gefährliche Muster enthält.
 * Nützlich für Tests und Logging.
 *
 * @param {string|null|undefined} html
 * @returns {boolean} true wenn der Input als gefährlich eingestuft wird
 */
export function containsDangerousHtml(html) {
  if (!html || typeof html !== 'string') return false;
  return (
    /<(script|iframe|object|embed|form|style)\b/i.test(html) ||
    /\son[a-zA-Z]+\s*=/i.test(html) ||
    /href\s*=\s*["']\s*javascript\s*:/i.test(html) ||
    /src\s*=\s*["']\s*data\s*:/i.test(html)
  );
}
