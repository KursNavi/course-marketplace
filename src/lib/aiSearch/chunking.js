/**
 * Textbereinigung und überlappendes Chunking für die Suchprojektion
 * (Datenvertrag §2, Indexdesign Punkt 3).
 *
 * Invarianten:
 *  - KEINE Längenobergrenze: beliebig lange Texte werden vollständig erfasst
 *    (das 2000-Zeichen-Formularlimit ist keine Architekturgrenze; Importe
 *    können länger sein).
 *  - Kein stilles Abschneiden: jeder Zeichenindex des bereinigten Texts liegt
 *    in mindestens einem Chunk (nachweisbar über char_start/char_end).
 *  - Deterministisch: gleicher Text ergibt gleiche Chunks (content_hash/Idempotenz).
 *  - Abschnitt (section) und Position bleiben erhalten; Dedupe auf Kursebene
 *    passiert beim Abruf, nicht hier.
 */

const DEFAULT_CHUNK_SIZE = 1200;   // Zeichen, grob ~300 Token
const DEFAULT_OVERLAP = 200;       // Zeichen Überlappung zwischen Nachbarchunks

/**
 * Bereinigt Quelltext für die Indexierung: HTML-Tags raus, Whitespace
 * normalisieren, unsichtbare Steuerzeichen entfernen. Inhalt bleibt erhalten.
 */
export function cleanText(raw) {
  if (raw === null || raw === undefined) return '';
  let text = String(raw);
  // HTML-Entities und Tags defensiv entfernen (Beschreibungen sind i. d. R.
  // Klartext; Importquellen können HTML liefern).
  text = text.replace(/<[^>]*>/g, ' ');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Unsichtbare Steuerzeichen entfernen (ausser Tab/Zeilenumbruch) — bewusst
  // ohne Regex-Literal, damit keine rohen Steuerbytes im Quelltext landen.
  text = Array.from(text)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
  text = text.replace(/\r\n?/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * Sucht nahe `target` eine natürliche Bruchstelle (Absatz, Satzende, Wortgrenze),
 * damit Chunks lesbare Evidenzabschnitte bleiben.
 */
function findBreakPoint(text, target, windowSize) {
  const from = Math.max(0, target - windowSize);
  const slice = text.slice(from, target);
  const paragraph = slice.lastIndexOf('\n\n');
  if (paragraph >= 0) return from + paragraph + 2;
  const sentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  if (sentence >= 0) return from + sentence + 2;
  const word = slice.lastIndexOf(' ');
  if (word >= 0) return from + word + 1;
  return target;
}

/**
 * Zerlegt bereinigten Text in überlappende Chunks mit vollständiger Abdeckung.
 *
 * @param {string} text - bereits bereinigter Text (cleanText)
 * @param {string} section - Quellabschnitt, z. B. 'description'
 * @param {{chunkSize?: number, overlap?: number}} [options]
 * @returns {Array<{section: string, chunkIndex: number, charStart: number,
 *                  charEnd: number, text: string}>}
 */
export function chunkText(text, section, options = {}) {
  const chunkSize = Math.max(200, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const overlap = Math.min(
    Math.max(0, options.overlap ?? DEFAULT_OVERLAP),
    Math.floor(chunkSize / 2),
  );
  if (!text) return [];
  if (text.length <= chunkSize) {
    return [{ section, chunkIndex: 0, charStart: 0, charEnd: text.length, text }];
  }

  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const brk = findBreakPoint(text, end, Math.floor(chunkSize / 4));
      if (brk > start + Math.floor(chunkSize / 2)) end = brk;
    }
    chunks.push({
      section,
      chunkIndex: index,
      charStart: start,
      charEnd: end,
      text: text.slice(start, end),
    });
    if (end >= text.length) break;
    index += 1;
    // Überlappung: der nächste Chunk beginnt vor dem Ende des aktuellen.
    start = end - overlap;
  }
  return chunks;
}

/**
 * Baut sämtliche Chunks eines Kurses über alle zulässigen Textfelder
 * (Datenvertrag §2). Reihenfolge und section bleiben stabil.
 */
export const CHUNKABLE_SECTIONS = Object.freeze([
  'description',
  'objectives',
  'prerequisites',
  'keywords',
  'free_reason',
]);

export function buildCourseChunks(course, options = {}) {
  if (!course || typeof course !== 'object') return [];
  const all = [];
  for (const section of CHUNKABLE_SECTIONS) {
    const raw = course[section];
    const value = Array.isArray(raw) ? raw.join(' ') : raw;
    const text = cleanText(value);
    if (!text) continue;
    all.push(...chunkText(text, section, options));
  }
  return all;
}

/**
 * Prüfhilfe für Tests/Reconciliation: deckt die Chunkliste den Text lückenlos ab?
 */
export function coversFullText(chunks, textLength) {
  if (textLength === 0) return true;
  const sorted = [...chunks].sort((a, b) => a.charStart - b.charStart);
  let covered = 0;
  for (const chunk of sorted) {
    if (chunk.charStart > covered) return false;
    covered = Math.max(covered, chunk.charEnd);
  }
  return covered >= textLength;
}
