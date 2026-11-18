/**
 * Begründung je Suchkarte als Fliesstext (Nachtrag 10, §4).
 *
 * - Empfohlen 40–70 Wörter, harte Obergrenze 100 (MAX_EXPLANATION_WORDS).
 *   Bei knapper Evidenz bleibt der Text kürzer; nichts wird aufgefüllt.
 * - Der Text besteht ausschliesslich aus belegten Bausteinen: wörtliche
 *   Zitate aus dem öffentlichen Kurstext, Ort/Termin/Preis aus den
 *   Kursangaben. Keine erfundenen Lernziele, Eignung, Abschlüsse.
 * - Abweichungen von Wünschen und nicht bestätigte Muss-Vorgaben werden
 *   immer behalten (sie werden beim Kürzen nie entfernt).
 * - Paket-/Prio-Daten fliessen nie ein.
 */

export const MAX_EXPLANATION_WORDS = 100;
const QUOTE_MAX_WORDS = 16;

const IN_SECTION = {
  title: 'im Titel',
  description: 'in der Beschreibung',
  objectives: 'in den Lernzielen',
  prerequisites: 'in den Voraussetzungen',
  keywords: 'in den Stichworten',
  free_reason: 'im Hinweis des Anbieters',
  category: 'in der Kategorie',
  location: 'bei den Ortsangaben',
  price_status: 'bei den Preisangaben',
  level: 'beim Niveau',
  languages: 'bei der Sprache',
};

export function countWords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

/** Kürzt ein Zitat wortweise um den Suchbegriff herum (bleibt wörtlich). */
export function shortenQuote(quote, term, maxWords = QUOTE_MAX_WORDS) {
  const clean = String(quote ?? '').replace(/^…/, '').replace(/…$/, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const startsCut = String(quote ?? '').startsWith('…');
  const endsCut = String(quote ?? '').endsWith('…');
  if (words.length <= maxWords) return `${startsCut ? '…' : ''}${clean}${endsCut ? '…' : ''}`;
  const stem = String(term ?? '').toLowerCase().slice(0, 4);
  let hit = stem ? words.findIndex((w) => w.toLowerCase().includes(stem)) : -1;
  if (hit < 0) hit = Math.floor(words.length / 2);
  let from = Math.max(0, hit - Math.floor(maxWords / 2));
  const to = Math.min(words.length, from + maxWords);
  from = Math.max(0, to - maxWords);
  const prefix = from > 0 || startsCut ? '…' : '';
  const suffix = to < words.length || endsCut ? '…' : '';
  return `${prefix}${words.slice(from, to).join(' ')}${suffix}`;
}

function formatDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * @param {object} input
 * @param {Array} input.reasons  belegte Gründe (kind text|luna|location)
 * @param {Array} input.wishes   erkannte Wünsche aus der Vorinterpretation
 * @param {object} input.musts   aktive Muss-Vorgaben ({location, maxBudget})
 * @param {string[]} input.mustUnknowns  nicht bestätigbare Muss-Vorgaben
 * @param {string|null} input.place  Ort laut Kursangaben
 * @param {object|null} input.event  nächster passender Termin
 * @param {string} input.price   Preisdarstellung laut Kursangaben
 * @returns {string}
 */
export function buildExplanation({ reasons = [], wishes = [], musts = {}, mustUnknowns = [], place = null, event = null, price = '' }) {
  // priority: 0 = nie kürzen (Einschränkungen), höhere Zahl = zuerst weglassen
  const parts = [];
  const add = (order, priority, text) => { if (text) parts.push({ order, priority, text }); };

  const evidence = reasons.filter((r) => r.kind === 'text' || r.kind === 'luna');
  evidence.forEach((reason, index) => {
    const where = IN_SECTION[reason.section] ?? `bei „${reason.sectionLabel ?? reason.section}“`;
    let sentence;
    if (reason.section === 'title' && reason.kind === 'text') {
      sentence = `Schon der Kurstitel greift „${reason.term}“ auf.`;
    } else if (reason.kind === 'text') {
      sentence = `Zu „${reason.term}“ heisst es ${where}: „${shortenQuote(reason.quote, reason.term)}“.`;
    } else {
      sentence = `${capitalize(where)} steht: „${shortenQuote(reason.quote, '')}“.`;
    }
    add(10 + index, index === 0 ? 1 : 3 + index, sentence);
  });

  const locationReason = reasons.find((r) => r.kind === 'location');
  const locationWishes = wishes.filter((w) => w.type === 'location');
  if (locationReason) {
    const where = String(locationReason.quote ?? '').replace(/^Ort laut Kursangaben:\s*/, '');
    add(20, 2, `Laut Kursangaben findet er in ${where} statt, wie gewünscht.`);
  } else if (locationWishes.length > 0) {
    const wish = locationWishes.map((w) => w.label).join(' / ');
    add(20, 0, place
      ? `Abweichung von deinem Wunsch „${wish}“: Als Ort ist ${place} angegeben.`
      : `Ob der Kurs in ${wish} stattfindet, ist offen: Ein Ort ist nicht angegeben.`);
  }

  for (const unknown of mustUnknowns) {
    if (unknown === 'event') add(30, 0, `Nicht bestätigt: Ob ein Termin deine Ortsvorgabe${musts.location ? ` (${musts.location})` : ''} erfüllt, geht aus den Angaben nicht hervor.`);
    if (unknown === 'budget') add(31, 0, `Nicht bestätigt: Ob der Preis (${price || 'nicht angegeben'}) in deinem Budget liegt, lässt sich aus den Angaben nicht sicher ablesen.`);
    if (unknown === 'language') add(32, 0, 'Nicht bestätigt: Die Kurssprache ist nicht angegeben.');
  }

  const budgetWish = wishes.find((w) => w.type === 'budget');
  if ((budgetWish || musts.maxBudget) && !mustUnknowns.includes('budget') && price) {
    add(40, 2, `Preis laut Angaben: ${price}.`);
  }

  const day = formatDay(event?.startDate ?? event?.start_date);
  add(41, 6, day ? `Nächster Termin: ${day}.` : null);

  // Kürzen: am wenigsten wichtige Bausteine zuerst, Einschränkungen nie.
  const kept = [...parts];
  const total = () => kept.reduce((sum, p) => sum + countWords(p.text), 0);
  while (total() > MAX_EXPLANATION_WORDS) {
    const droppable = kept.filter((p) => p.priority > 0).sort((a, b) => b.priority - a.priority)[0];
    if (!droppable) break;
    kept.splice(kept.indexOf(droppable), 1);
  }
  let text = kept.sort((a, b) => a.order - b.order).map((p) => p.text).join(' ');
  if (countWords(text) > MAX_EXPLANATION_WORDS) {
    text = `${text.split(/\s+/).slice(0, MAX_EXPLANATION_WORDS).join(' ')}…`;
  }
  return text;
}
