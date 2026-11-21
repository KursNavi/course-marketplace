/**
 * Deterministische Vorinterpretation einer KI-Suchanfrage (Preview-Stufe).
 *
 * Bis Luna freigegeben ist (Gate E3), übernimmt diese Funktion die
 * Interpretation regelbasiert und OHNE Modellaufruf:
 *  - Suchbegriffe für den lexikalischen Kanal (Stoppwörter entfernt),
 *  - erkannte Orte (Kantone/Städte), Online-Wunsch, Budgetangabe und
 *    Anfänger-Hinweis — ausschliesslich als WÜNSCHE (Chips). Ein erkannter
 *    Wunsch schliesst nie einen Kurs aus (02-ki-suche: kein Ausschluss
 *    aufgrund eines unsicher interpretierten Kriteriums ohne Bestätigung).
 *    Zwingende Kriterien setzt die Nutzerin ausdrücklich in der Oberfläche.
 *
 * Rein und lokal testbar; kein Netz, keine Geheimnisse.
 */

// Bewusst lokal (nicht aus src/lib/constants.js): jene Datei zieht
// lucide-react nach und gehört nicht in die Serverfunktion.
const SWISS_CANTONS = ['Aargau', 'Appenzell AI', 'Appenzell AR', 'Basel-Landschaft', 'Basel-Stadt',
  'Bern', 'Fribourg', 'Genève', 'Glarus', 'Graubünden', 'Jura', 'Liechtenstein', 'Luzern',
  'Neuchâtel', 'Nidwalden', 'Obwalden', 'Schaffhausen', 'Schwyz', 'Solothurn', 'St. Gallen',
  'Thurgau', 'Ticino', 'Uri', 'Valais', 'Vaud', 'Zug', 'Zürich'];
const SWISS_CITIES = ['Basel', 'Biel', 'Lausanne', 'Lugano', 'Winterthur', 'Genf', 'Zürich', 'Bern', 'Luzern', 'St. Gallen'];
const CITY_TO_CANTON = {
  Basel: 'Basel-Stadt', Biel: 'Bern', Lausanne: 'Vaud', Lugano: 'Ticino', Winterthur: 'Zürich', Genf: 'Genève',
};

/** Kanton zu einem erkannten Ort (Stadt oder Kanton), sonst null. */
export function cantonForPlace(place) {
  if (SWISS_CANTONS.includes(place)) return place;
  return CITY_TO_CANTON[place] ?? null;
}

export const QUERY_MIN_LENGTH = 3;
export const QUERY_MAX_LENGTH = 500;

const STOPWORDS = new Set([
  'aber', 'alle', 'als', 'also', 'am', 'an', 'auch', 'auf', 'aus', 'bei', 'bin', 'bis',
  'das', 'dass', 'dem', 'den', 'der', 'des', 'die', 'dies', 'diese', 'dieser', 'doch',
  'ein', 'eine', 'einem', 'einen', 'einer', 'eines', 'er', 'es', 'etwas', 'für', 'fuer',
  'gerne', 'gern', 'gibt', 'habe', 'haben', 'hat', 'ich', 'ihr', 'im', 'in', 'ist', 'ja',
  'kann', 'kein', 'keine', 'man', 'mehr', 'mein', 'meine', 'mich', 'mir', 'mit', 'möchte',
  'moechte', 'muss', 'nach', 'nicht', 'noch', 'nur', 'oder', 'ohne', 'sehr', 'sich', 'sie',
  'sind', 'so', 'soll', 'suche', 'suchen', 'um', 'und', 'uns', 'unter', 'vom', 'von', 'vor',
  'war', 'was', 'welche', 'wenn', 'wer', 'wie', 'will', 'wir', 'wo', 'würde', 'zu', 'zum',
  'zur', 'kurs', 'kurse', 'kursen', 'angebot', 'angebote', 'bitte', 'lernen', 'besser',
  'gut', 'gute', 'guten', 'neue', 'neuen', 'möglichst', 'vorzugsweise', 'idealerweise',
  'höchstens', 'maximal', 'max', 'chf', 'franken', 'fr', 'sfr', 'online', 'jemand',
  'irgendwo', 'irgendwas', 'the', 'and', 'for', 'with', 'le', 'la', 'les', 'des', 'et',
  'il', 'di', 'per', 'con',
]);

const BEGINNER_WORDS = ['anfänger', 'anfaenger', 'einsteiger', 'einstieg', 'grundkurs', 'beginner', 'débutant', 'principiante'];

/** Kleinschreibung + Unicode-Normalisierung, Umlaute bleiben erhalten. */
export function normalizeQuery(query) {
  return String(query ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Prüft die Rohanfrage. Liefert einen Fehlercode oder null. */
export function validateQuery(query) {
  const normalized = normalizeQuery(query);
  if (normalized.length < QUERY_MIN_LENGTH) return 'query_too_short';
  if (normalized.length > QUERY_MAX_LENGTH) return 'query_too_long';
  return null;
}

function tokenize(text) {
  return (String(text ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

const PLACE_NAMES = [...new Set([...SWISS_CANTONS, ...SWISS_CITIES])];

function detectPlaces(lowerQuery) {
  const found = [];
  for (const name of PLACE_NAMES) {
    const variants = [name, name.replace('ü', 'ue').replace('è', 'e').replace('â', 'a')]
      .map((v) => v.toLowerCase());
    const pattern = variants.some((v) => new RegExp(`(^|[^\\p{L}])${escapeRegExp(v)}([^\\p{L}]|$)`, 'u').test(lowerQuery));
    if (pattern) found.push(name);
  }
  return found;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} query
 * @returns {{normalized: string, terms: string[], wishes: Array<{type: string,
 *   label: string, value: any}>, tsQuery: string}}
 */
export function parseQuery(query) {
  const normalized = normalizeQuery(query);
  const lower = normalized.toLowerCase();
  const wishes = [];

  const places = detectPlaces(lower);
  for (const place of places) wishes.push({ type: 'location', label: place, value: place });

  if (/\bonline\b|\bvirtuell\b|\bremote\b|\bzoom\b/u.test(lower)) {
    wishes.push({ type: 'online', label: 'Online', value: true });
  }

  const budgetMatch = lower.match(/(?:chf|fr\.?|franken)\s*(\d{1,5})|(\d{1,5})\s*(?:chf|fr\.?|franken)/u);
  if (budgetMatch) {
    const amount = Number(budgetMatch[1] ?? budgetMatch[2]);
    if (Number.isFinite(amount) && amount > 0) {
      wishes.push({ type: 'budget', label: `bis CHF ${amount}`, value: amount });
    }
  }

  // Lernform-Wünsche (werden serverseitig gegen delivery_types geprüft, wishCheck.js).
  if (/selbststudium|selbstlern|im eigenen tempo|e-learning|videokurs|on.?demand/u.test(lower)) {
    wishes.push({ type: 'format', label: 'Selbststudium', value: 'self_study' });
  }
  if (/\bvor ort\b|präsenz/u.test(lower)) {
    wishes.push({ type: 'format', label: 'vor Ort', value: 'presence' });
  }

  if (BEGINNER_WORDS.some((word) => lower.includes(word))) {
    wishes.push({ type: 'level', label: 'Für Einsteiger', value: 'beginner' });
  }

  const placeTokens = new Set(places.flatMap((place) => tokenize(place)));
  const terms = [];
  for (const token of tokenize(normalized)) {
    if (token.length < 3) continue;
    if (/^\d+$/.test(token)) continue;
    if (STOPWORDS.has(token)) continue;
    if (placeTokens.has(token)) continue;
    if (!terms.includes(token)) terms.push(token);
  }

  // websearch_to_tsquery: Begriffe mit "or" verbinden, damit ein natürlicher
  // Satz nicht an der UND-Verknüpfung aller Wörter scheitert. Die Begriffe
  // bestehen nur aus Buchstaben/Ziffern (keine Operatoren aus Nutzertext).
  const tsQuery = terms.slice(0, 12).join(' or ');

  return { normalized, terms: terms.slice(0, 12), wishes, tsQuery };
}

/**
 * Wortstamm-tolerante Begriffsprüfung (Preview-Heuristik): ein Begriff gilt
 * als im Text vorhanden, wenn ein Textwort mit denselben ersten Zeichen
 * beginnt (z. B. "fotografieren" ↔ "Fotografie").
 */
export function termStem(term) {
  const lower = String(term ?? '').toLowerCase();
  return lower.length > 6 ? lower.slice(0, Math.max(5, lower.length - 4)) : lower;
}

export function findTermInText(term, text) {
  const stem = termStem(term);
  if (!stem) return null;
  const source = String(text ?? '');
  const lower = source.toLowerCase();
  const regex = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(stem)}[\\p{L}]*)`, 'u');
  const match = regex.exec(lower);
  if (!match) return null;
  const index = match.index + match[1].length;
  return { index, length: match[2].length };
}

/** Kurzer Textauszug um eine Fundstelle (Beleg für die Begründung). */
export function excerptAround(text, index, length, radius = 70) {
  const source = String(text ?? '');
  const start = Math.max(0, index - radius);
  const end = Math.min(source.length, index + length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}
