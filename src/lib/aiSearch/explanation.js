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

import { WISH_CLAIM_PATTERNS } from './wishCheck.js';
import { ADULT_CLAIM, CHILD_MENTION, audienceLabel } from './audience.js';
import { PRICE_STATUS } from './priceStatus.js';

/**
 * Serverhinweise in der Sprache der Anfrage (K4, 22.11.2026). Kurstitel,
 * Orte und Zitate bleiben unverändert; die Sprache sagt nichts über die
 * Unterrichtssprache des Kurses aus.
 */
export const EXPLANATION_LANGUAGES = Object.freeze(['de', 'fr', 'it']);
const q = { de: (t) => `„${t}“`, fr: (t) => `« ${t} »`, it: (t) => `«${t}»` };
const MESSAGES = {
  de: {
    sections: { title: 'im Titel', description: 'in der Beschreibung', objectives: 'in den Lernzielen', prerequisites: 'in den Voraussetzungen', keywords: 'in den Stichworten', free_reason: 'im Hinweis des Anbieters', category: 'in der Kategorie', location: 'bei den Ortsangaben', price_status: 'bei den Preisangaben', level: 'beim Niveau', languages: 'bei der Sprache' },
    titleHit: (term) => `Schon der Kurstitel greift ${q.de(term)} auf.`,
    termQuote: (term, where, quote) => `Zu ${q.de(term)} heisst es ${where}: ${q.de(quote)}.`,
    lunaQuote: (where, quote) => `${capitalize(where)} steht: ${q.de(quote)}.`,
    audience: (label) => `Zielgruppe laut Kursangaben: ${label}.`,
    place: (where) => `Ort laut Kursangaben: ${where}.`,
    canton: (name) => `Kanton ${name}`,
    placeDeviates: (wish, place) => `Abweichung vom Wunsch ${q.de(wish)}: Ort ist ${place}.`,
    placeOpen: (wish) => `Offen, ob in ${wish}: kein Ort angegeben.`,
    excluded: (name) => `nicht in ${name}`,
    wishUnconfirmed: (label, detail) => `Wunsch ${q.de(label)} nicht bestätigt: Die Kursangaben nennen ${detail}.`,
    wishDeviates: (label, detail) => `Abweichung vom Wunsch ${q.de(label)}: Die Kursangaben nennen ${detail}.`,
    levelIs: (a) => `als Niveau ${a}`, noLevel: 'kein Niveau', formIs: (a) => `als Lernform nur ${a}`, noForm: 'keine Lernform',
    event: (loc) => `Nicht bestätigt: ein Termin${loc ? ` in ${loc}` : ' passend zur Ortsvorgabe'}.`,
    location: (loc) => `Nicht bestätigt: Kursort in ${loc}.`,
    budget: (price) => `Nicht bestätigt: Preis im Budget (${price}).`,
    language: 'Nicht bestätigt: Kurssprache.',
    priceLine: (price) => `Preis laut Angaben: ${price}.`,
    nextDate: (day) => `Nächster Termin: ${day}.`,
    offerForm: (x) => `Angebotsform laut Kursangaben: ${x}.`,
    offerForms: { birthday: 'Kindergeburtstag', company: 'Angebot für Firmen und Teams', training: 'berufliche Aus- oder Weiterbildung', self_study: 'Selbststudium' },
    timeUnconfirmed: (label) => `Wunsch ${q.de(label)} nicht bestätigt: Die Kursangaben belegen das nicht.`,
    locale: 'de-CH',
    prices: { unknown: 'Preis auf Anfrage', free: 'Kostenlos', from: (a) => `ab CHF ${a}`, perUnit: (a) => `CHF ${a} pro Einheit` },
    wishLabels: { online: 'Online', not_online: 'nicht online', self_study: 'Selbststudium', presence: 'vor Ort', beginner: 'Für Einsteiger', time_evening: 'abends', time_weekend: 'am Wochenende', time_saturday: 'samstags', time_sunday: 'sonntags' },
    values: {},
  },
  fr: {
    sections: { title: 'dans le titre', description: 'dans la description', objectives: 'dans les objectifs', prerequisites: 'dans les prérequis', keywords: 'dans les mots-clés', free_reason: 'dans la remarque du prestataire', category: 'dans la catégorie', location: 'dans les indications de lieu', price_status: 'dans les indications de prix', level: 'au niveau', languages: 'à la langue' },
    titleHit: (term) => `Le titre du cours reprend déjà ${q.fr(term)}.`,
    termQuote: (term, where, quote) => `À propos de ${q.fr(term)}, on lit ${where} : ${q.fr(quote)}.`,
    lunaQuote: (where, quote) => `${capitalize(where)} : ${q.fr(quote)}.`,
    audience: (label) => `Public cible selon les indications du cours : ${label}.`,
    place: (where) => `Lieu selon les indications du cours : ${where}.`,
    canton: (name) => `canton ${name}`,
    placeDeviates: (wish, place) => `Écart par rapport au souhait ${q.fr(wish)} : le lieu est ${place}.`,
    placeOpen: (wish) => `Incertain si à ${wish} : aucun lieu indiqué.`,
    excluded: (name) => `pas à ${name}`,
    wishUnconfirmed: (label, detail) => `Souhait ${q.fr(label)} non confirmé : les indications du cours mentionnent ${detail}.`,
    wishDeviates: (label, detail) => `Écart par rapport au souhait ${q.fr(label)} : les indications du cours mentionnent ${detail}.`,
    levelIs: (a) => `comme niveau ${a}`, noLevel: 'aucun niveau', formIs: (a) => `comme forme d’apprentissage uniquement ${a}`, noForm: 'aucune forme d’apprentissage',
    event: (loc) => `Non confirmé : une date${loc ? ` à ${loc}` : ' correspondant au lieu exigé'}.`,
    location: (loc) => `Non confirmé : lieu du cours à ${loc}.`,
    budget: (price) => `Non confirmé : prix dans le budget (${price}).`,
    language: 'Non confirmé : langue du cours.',
    priceLine: (price) => `Prix selon les indications : ${price}.`,
    nextDate: (day) => `Prochaine date : ${day}.`,
    offerForm: (x) => `Forme de l’offre selon les indications du cours : ${x}.`,
    offerForms: { birthday: 'anniversaire d’enfant', company: 'offre pour entreprises et équipes', training: 'formation professionnelle', self_study: 'autoformation' },
    timeUnconfirmed: (label) => `Souhait ${q.fr(label)} non confirmé : les indications du cours ne le confirment pas.`,
    locale: 'fr-CH',
    prices: { unknown: 'prix sur demande', free: 'gratuit', from: (a) => `dès CHF ${a}`, perUnit: (a) => `CHF ${a} par unité` },
    wishLabels: { online: 'en ligne', not_online: 'pas en ligne', self_study: 'autoformation', presence: 'sur place', beginner: 'pour débutants', time_evening: 'le soir', time_weekend: 'le week-end', time_saturday: 'le samedi', time_sunday: 'le dimanche' },
    values: { 'Präsenz': 'présentiel', 'Online live': 'en ligne en direct', 'Online': 'en ligne', 'Selbststudium': 'autoformation', 'für Einsteiger': 'pour débutants', 'alle Niveaus': 'tous niveaux', 'Mittelstufe': 'niveau intermédiaire', 'Fortgeschrittene': 'avancés' },
  },
  it: {
    sections: { title: 'nel titolo', description: 'nella descrizione', objectives: 'negli obiettivi', prerequisites: 'nei prerequisiti', keywords: 'nelle parole chiave', free_reason: 'nella nota del fornitore', category: 'nella categoria', location: 'nelle indicazioni sul luogo', price_status: 'nelle indicazioni sul prezzo', level: 'al livello', languages: 'alla lingua' },
    titleHit: (term) => `Già il titolo del corso riprende ${q.it(term)}.`,
    termQuote: (term, where, quote) => `Su ${q.it(term)} si legge ${where}: ${q.it(quote)}.`,
    lunaQuote: (where, quote) => `${capitalize(where)}: ${q.it(quote)}.`,
    audience: (label) => `Destinatari secondo le indicazioni del corso: ${label}.`,
    place: (where) => `Luogo secondo le indicazioni del corso: ${where}.`,
    canton: (name) => `cantone ${name}`,
    placeDeviates: (wish, place) => `Differenza rispetto al desiderio ${q.it(wish)}: il luogo è ${place}.`,
    placeOpen: (wish) => `Non è chiaro se a ${wish}: nessun luogo indicato.`,
    excluded: (name) => `non a ${name}`,
    wishUnconfirmed: (label, detail) => `Desiderio ${q.it(label)} non confermato: le indicazioni del corso riportano ${detail}.`,
    wishDeviates: (label, detail) => `Differenza rispetto al desiderio ${q.it(label)}: le indicazioni del corso riportano ${detail}.`,
    levelIs: (a) => `come livello ${a}`, noLevel: 'nessun livello', formIs: (a) => `come forma di apprendimento solo ${a}`, noForm: 'nessuna forma di apprendimento',
    event: (loc) => `Non confermato: una data${loc ? ` a ${loc}` : ' adatta al luogo richiesto'}.`,
    location: (loc) => `Non confermato: sede del corso a ${loc}.`,
    budget: (price) => `Non confermato: prezzo entro il budget (${price}).`,
    language: 'Non confermato: lingua del corso.',
    priceLine: (price) => `Prezzo secondo le indicazioni: ${price}.`,
    nextDate: (day) => `Prossima data: ${day}.`,
    offerForm: (x) => `Forma dell’offerta secondo le indicazioni del corso: ${x}.`,
    offerForms: { birthday: 'festa di compleanno per bambini', company: 'offerta per aziende e team', training: 'formazione professionale', self_study: 'autoapprendimento' },
    timeUnconfirmed: (label) => `Desiderio ${q.it(label)} non confermato: le indicazioni del corso non lo confermano.`,
    locale: 'it-CH',
    prices: { unknown: 'prezzo su richiesta', free: 'gratuito', from: (a) => `da CHF ${a}`, perUnit: (a) => `CHF ${a} per unità` },
    wishLabels: { online: 'online', not_online: 'non online', self_study: 'autoapprendimento', presence: 'in presenza', beginner: 'per principianti', time_evening: 'la sera', time_weekend: 'nel fine settimana', time_saturday: 'il sabato', time_sunday: 'la domenica' },
    values: { 'Präsenz': 'in presenza', 'Online live': 'online dal vivo', 'Online': 'online', 'Selbststudium': 'autoapprendimento', 'für Einsteiger': 'per principianti', 'alle Niveaus': 'tutti i livelli', 'Mittelstufe': 'livello intermedio', 'Fortgeschrittene': 'avanzati' },
  },
};

function messagesFor(language) {
  return MESSAGES[EXPLANATION_LANGUAGES.includes(language) ? language : 'de'];
}

function translateValues(text, m) {
  return String(text ?? '').split(' / ').map((part) => m.values[part] ?? part).join(' / ');
}

/** Preisangabe für den Hinweistext in der Sprache der Begründung. */
// Wesentliche Angebotsform (Punkt 4, 23.11.2026): feste Absicherung zusätzlich
// zur Luna-Anweisung für eindeutig erkennbare Formen.
// Titel: Firmen/Unternehmen als eigenes Wort; Beschreibung nur eindeutige Begriffe
// (ein allgemeines Angebot "auch für Firmen buchbar" ist kein Firmenangebot).
const COMPANY_TITLE = /\b(firmen|unternehmen|teamevents?|team-events?|teambuilding|teamanl[aä]ss|inhouse)\b/i;
const COMPANY_TEXT = /\b(firmenkurs|firmenanl[aä]ss|firmen-?events?|teamevents?|team-events?|teambuilding|teamanl[aä]ss|inhouse-?(kurs|schulung|training))\b/i;
// Je Angebotsform: Woran erkennbar ist, dass der Text sie schon nennt.
const OFFER_FORM_MENTIONS = {
  birthday: /geburtstag|party|anniversaire|compleanno|festa/i,
  company: /firm|team|unternehm|entreprise|équipe|aziend|squadra/i,
  training: /ausbildung|lehrgang|studiengang|weiterbildung|formation|cursus|formazione|percorso/i,
  self_study: WISH_CLAIM_PATTERNS.self_study,
};
// Berufliche Aus-/Weiterbildung (Befund 23.11.2026: Fachausbildung für
// Kursleitende bei einer privaten Suche nicht als solche benannt).
const TRAINING_TITLE = /\b(ausbildung|lehrgang|fernlehrgang|studiengang|nachdiplom\p{L}*|fachausweis|dipl\.|diplom\p{L}*)/iu;
const TRAINING_TEXT = /\b(fernlehrgang|lehrgang|studiengang)\b/i;

/** 'birthday' | 'company' | null aus Kursart, Titel und Beschreibung. */
export function offerFormOf(course) {
  if (String(course?.kinder_kursart ?? '').toLowerCase() === 'kindergeburtstag') return 'birthday';
  if (COMPANY_TITLE.test(String(course?.title ?? '')) || COMPANY_TEXT.test(String(course?.description ?? ''))) return 'company';
  return null;
}

/**
 * Alle wesentlichen Angebotsformen (Punkt 4): zusätzlich zu offerFormOf
 * berufliche Aus-/Weiterbildung (Kurstyp „professionell“ mit Lehrgang/
 * Ausbildung/Diplom) und reines Selbststudium laut Lernform.
 */
export function offerFormsOf(course) {
  const forms = [offerFormOf(course)];
  const professional = String(course?.category_type ?? '').toLowerCase() === 'professionell';
  if (professional && (TRAINING_TITLE.test(String(course?.title ?? '')) || TRAINING_TEXT.test(String(course?.description ?? '')))) forms.push('training');
  const types = Array.isArray(course?.delivery_types) && course.delivery_types.length > 0 ? course.delivery_types : (course?.delivery_type ? [course.delivery_type] : []);
  if (types.length > 0 && types.every((t) => String(t).toLowerCase() === 'self_study')) forms.push('self_study');
  return [...new Set(forms.filter(Boolean))];
}

// Sprache des Luna-Textes (K4): typische Funktionswörter je Sprache; bewusst
// ohne mehrdeutige Wörter (la, le, du, un).
const LEAD_MARKERS = {
  de: new Set(['der', 'die', 'das', 'und', 'deine', 'deinen', 'deinem', 'dein', 'ist', 'mit', 'für', 'zu', 'zum', 'zur', 'passt', 'lernst', 'übst', 'kannst', 'sich', 'auf', 'von', 'wenn', 'auch', 'eine', 'einen', 'im', 'den', 'dem']),
  fr: new Set(['les', 'des', 'tu', 'ton', 'ta', 'tes', 'et', 'est', 'pour', 'avec', 'une', 'à', 'au', 'aux', 'qui', 'dans', 'de', 'apprends', 'convient']),
  it: new Set(['il', 'lo', 'gli', 'e', 'è', 'per', 'con', 'una', 'di', 'del', 'della', 'impari', 'ti', 'tuo', 'tua', 'che', 'nel', 'nella', 'alla', 'adatto', 'adatta']),
};

/** true, wenn der Text deutlich in einer anderen Sprache als `language` steht. */
export function leadLanguageMismatch(text, language = 'de') {
  const target = EXPLANATION_LANGUAGES.includes(language) ? language : 'de';
  const words = String(text ?? '').toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const counts = { de: 0, fr: 0, it: 0 };
  for (const word of words) for (const [lang, set] of Object.entries(LEAD_MARKERS)) if (set.has(word)) counts[lang] += 1;
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best !== target && bestCount >= 3 && counts[target] < bestCount / 2;
}

// Altersgrenzen als Teilnahmebeschränkung (Punkt 4): gilt als genannt, wenn
// die Zahl als Ziffer oder ausgeschrieben (DE/FR/IT) im Text steht.
const NUMBER_WORDS = {
  1: ['eins', 'un', 'uno'], 2: ['zwei', 'deux', 'due'], 3: ['drei', 'trois', 'tre'], 4: ['vier', 'quatre', 'quattro'],
  5: ['fünf', 'cinq', 'cinque'], 6: ['sechs', 'six', 'sei'], 7: ['sieben', 'sept', 'sette'], 8: ['acht', 'huit', 'otto'],
  9: ['neun', 'neuf', 'nove'], 10: ['zehn', 'dix', 'dieci'], 11: ['elf', 'onze', 'undici'], 12: ['zwölf', 'douze', 'dodici'],
  13: ['dreizehn', 'treize', 'tredici'], 14: ['vierzehn', 'quatorze', 'quattordici'], 15: ['fünfzehn', 'quinze', 'quindici'],
  16: ['sechzehn', 'seize', 'sedici'], 17: ['siebzehn', 'dix-sept', 'diciassette'], 18: ['achtzehn', 'dix-huit', 'diciotto'],
};
export function ageMentioned(text, age) {
  const lower = String(text ?? '').toLowerCase();
  if (new RegExp(`(^|[^\\d])${age}([^\\d]|$)`).test(lower)) return true;
  return (NUMBER_WORDS[age] ?? []).some((word) => new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'u').test(lower));
}

function audienceMissing(text, audience) {
  if (!CHILD_MENTION.test(text)) return true;
  const ages = [audience?.minAge, audience?.maxAge].filter((n) => Number.isFinite(n));
  return ages.some((age) => !ageMentioned(text, age));
}

export function localizedPrice(priceStatus, language = 'de') {
  const m = messagesFor(language);
  switch (priceStatus?.status) {
    case PRICE_STATUS.FREE: return m.prices.free;
    case PRICE_STATUS.FIXED: return `CHF ${priceStatus.amount}`;
    case PRICE_STATUS.FROM: return m.prices.from(priceStatus.amount);
    case PRICE_STATUS.PER_UNIT: return m.prices.perUnit(priceStatus.amount);
    case PRICE_STATUS.INFO_TEXT: return priceStatus.infoText;
    default: return m.prices.unknown;
  }
}

// Nachtrag 12 (18.11.2026): normal 25–40 Wörter, höchstens 50 einschliesslich
// serverseitiger Hinweise (ersetzt 40–70/100 aus Nachtrag 10).
export const MAX_EXPLANATION_WORDS = 50;
const QUOTE_MAX_WORDS = 12;

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

function formatDay(value, locale = 'de-CH') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
}

// Wortfelder je Aspekt: Ein Satzteil, der den Aspekt überhaupt anspricht
// (positiv ODER verneinend), wird durch den einen Serverhinweis ersetzt.
const ASPECT_PATTERNS = {
  Lernform: [WISH_CLAIM_PATTERNS.self_study, WISH_CLAIM_PATTERNS.presence, WISH_CLAIM_PATTERNS.online],
  Niveau: [WISH_CLAIM_PATTERNS.beginner, /fortgeschritten|mittelstufe|\bniveau\b|avancé|intermédiaire|avanzat|intermedi|\blivello\b/i],
  Zeit: [WISH_CLAIM_PATTERNS.time],
};

function mentionsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Nachtrag 13 (19.11.2026): Ist ein Wunsch zu Lernform/Online/Niveau NICHT
 * durch die strukturierten Kursangaben bestätigt, gibt der Server genau EINE
 * datenbasierte Aussage dazu aus (buildExplanation). Aus dem Modelltext
 * werden deshalb alle Satzteile entfernt, die diesen Aspekt ansprechen:
 * - positive Erfüllungsbehauptungen („passt zu deinem Wunsch nach
 *   selbstständigem Lernen“) – unbelegt;
 * - Ausschlussbehauptungen („nicht im Selbststudium“) – Präsenz allein
 *   belegt keinen Ausschluss, und der Sachverhalt stünde sonst doppelt.
 * Entfernt wird möglichst nur der betroffene Satzteil (Komma/Semikolon/
 * Gedankenstrich); spricht schon der Satzanfang den Aspekt an, der ganze Satz.
 * Bestätigte Wünsche bleiben unverändert.
 */
export function removeUnbackedWishClaims(lead, wishChecks = []) {
  const text = typeof lead === 'string' ? lead.trim() : '';
  if (!text) return null;
  const open = wishChecks.filter((check) => check.status !== 'confirmed');
  if (open.length === 0) return text;
  const patterns = [...new Set(open.flatMap((check) => ASPECT_PATTERNS[check.aspect]
    ?? (WISH_CLAIM_PATTERNS[check.claimKey] ? [WISH_CLAIM_PATTERNS[check.claimKey]] : [])))];
  if (patterns.length === 0) return text;
  return removeClauses(text, patterns);
}

/**
 * Entfernt Satzteile, die eines der Muster enthalten (Komma/Semikolon/
 * Gedankenstrich); trifft schon der Satzanfang, den ganzen Satz.
 */
function removeClauses(text, patterns) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  const kept = sentences.map((raw) => {
    const sentence = raw.trim();
    if (!mentionsAny(sentence, patterns)) return sentence;
    const end = /[.!?]+$/.exec(sentence)?.[0] ?? '.';
    const clauses = sentence.replace(/[.!?]+$/, '').split(/\s*[,;]\s+|\s+[–—]\s+/);
    if (mentionsAny(clauses[0], patterns)) return null;
    const rest = clauses.filter((clause) => !mentionsAny(clause, patterns)).join(', ');
    return countWords(rest) >= 4 ? `${rest}${end}` : null;
  }).filter(Boolean);
  const result = kept.join(' ').trim();
  return result || null;
}

/**
 * Zielgruppe Kinder/Jugendliche (20.11.2026): unbelegte Erwachsenen-Eignung
 * aus dem Modelltext entfernen. Gibt den bereinigten Text zurück.
 */
export function removeUnbackedAdultClaims(lead, audience) {
  const text = typeof lead === 'string' ? lead.trim() : '';
  if (!text) return null;
  if (!audience?.child || audience.adultsBacked) return text;
  return removeClauses(text, [ADULT_CLAIM]);
}

/**
 * Eine evidenzgerechte Aussage je nicht bestätigtem Wunsch. Sie gibt nur
 * wieder, was die Kursangaben nennen; aus „Präsenz“ wird kein Ausschluss von
 * Selbststudium gefolgert.
 */
export function wishCheckSentence(check, language = 'de') {
  if (!check || check.status === 'confirmed') return null;
  const m = messagesFor(language);
  if (check.aspect === 'Zeit') return m.timeUnconfirmed((check.key && m.wishLabels[check.key]) ?? check.wishLabel);
  const field = check.aspect === 'Niveau' ? 'Niveau' : 'Lernform';
  const actual = check.actual ? translateValues(check.actual, m) : null;
  const detail = actual
    ? (field === 'Niveau' ? m.levelIs(actual) : m.formIs(actual))
    : (field === 'Niveau' ? m.noLevel : m.noForm);
  const label = (check.key && m.wishLabels[check.key]) ?? check.wishLabel;
  // Verneinter Wunsch („nicht online“): eine Abweichung wird als solche
  // benannt, nie als nicht bestätigter Gegenwunsch (K1).
  return check.negated && check.status === 'deviating' ? m.wishDeviates(label, detail) : m.wishUnconfirmed(label, detail);
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * @param {object} input
 * @param {Array} input.reasons  belegte Gründe (kind text|luna|location)
 * @param {Array} input.wishes   erkannte Wünsche aus der Vorinterpretation
 *   (verneinte Wünsche mit negated: true, K1)
 * @param {object} input.musts   aktive Muss-Vorgaben ({location, maxBudget})
 * @param {string[]} input.mustUnknowns  nicht bestätigbare Muss-Vorgaben
 * @param {string|null} input.place  Ort laut Kursangaben
 * @param {string[]} [input.cities]  Orte (Städte) laut Kursorten/Terminen
 * @param {object|null} input.event  nächster passender Termin
 * @param {string} input.price   Preisdarstellung (in der Sprache der Begründung)
 * @param {string} [input.language]  'de' | 'fr' | 'it' (Sprache der Anfrage, K4)
 * @returns {string}
 */
export function buildExplanation({ lead = null, reasons = [], wishes = [], wishChecks = [], musts = {}, mustUnknowns = [], place = null, cities = [], event = null, price = '', audience = null, language = 'de', offerForm = null }) {
  const m = messagesFor(language);
  // Strukturierte Zielgruppe (childAudience) in der Sprache der Begründung;
  // ältere Aufrufer mit nur einem Label behalten dieses.
  const audienceText = audience?.child ? ('minAge' in audience ? audienceLabel(audience, language) : audience.label) : null;
  // priority: 0 = nie kürzen (Einschränkungen), höhere Zahl = zuerst weglassen
  const parts = [];
  const add = (order, priority, text) => { if (text) parts.push({ order, priority, text, lead: false }); };

  // Serverseitig geprüfter Luna-Fliesstext ersetzt die Zitatsätze. Fehlt er,
  // bleibt die bisherige belegte Zusammenstellung. Sätze, die einen NICHT
  // bestätigten Wunsch als erfüllt darstellen oder bei Kinderkursen eine
  // unbelegte Eignung für Erwachsene behaupten, werden vorher entfernt.
  // K4: Luna-Text in einer anderen Sprache als die Anfrage wird nicht gezeigt;
  // an seine Stelle treten die belegten Zitatsätze in der richtigen Sprache.
  const leadInLanguage = lead && !leadLanguageMismatch(lead, language) ? lead : null;
  const leadText = removeUnbackedAdultClaims(removeUnbackedWishClaims(leadInLanguage, wishChecks), audience);
  if (leadText) parts.push({ order: 10, priority: 1, text: leadText, lead: true });
  const evidence = leadText ? [] : reasons.filter((r) => r.kind === 'text' || r.kind === 'luna');
  evidence.forEach((reason, index) => {
    const where = m.sections[reason.section] ?? m.sections.category;
    let sentence;
    if (reason.section === 'title' && reason.kind === 'text') {
      sentence = m.titleHit(reason.term);
    } else if (reason.kind === 'text') {
      sentence = m.termQuote(reason.term, where, shortenQuote(reason.quote, reason.term));
    } else {
      sentence = m.lunaQuote(where, shortenQuote(reason.quote, ''));
    }
    add(10 + index, index === 0 ? 1 : 3 + index, sentence);
  });

  // Wesentliche Angebotsform (Firmen/Teams, Kindergeburtstag): nennt der Text
  // sie nicht selbst, ergänzt der Server einen nie gekürzten Hinweis.
  // Mehrere Formen möglich (offerFormsOf); Selbststudium gilt auch als genannt,
  // wenn ein Lernform-Hinweis zu einem Wunsch es bereits nennt.
  const forms = (Array.isArray(offerForm) ? offerForm : [offerForm]).filter((form) => form && m.offerForms[form]);
  const wishTexts = wishChecks.map((check) => wishCheckSentence(check, language)).filter(Boolean).join(' ');
  forms.forEach((form, index) => {
    const shown = `${parts.map((p) => p.text).join(' ')} ${wishTexts}`;
    if (!OFFER_FORM_MENTIONS[form].test(shown)) add(14 + index / 10, 0, m.offerForm(m.offerForms[form]));
  });

  // Kinder-/Jugendkurs: Zielgruppe mit Altersgrenzen muss erkennbar sein.
  // Nennt der Text sie (oder eine Altersgrenze) nicht selbst, ergänzt der
  // Server einen nie gekürzten Hinweis.
  if (audienceText && audienceMissing(parts.map((p) => p.text).join(' '), audience)) add(15, 0, m.audience(audienceText));

  const locationReason = reasons.find((r) => r.kind === 'location');
  const positivePlaces = wishes.filter((w) => w.type === 'location' && !w.negated);
  const excludedPlaces = wishes.filter((w) => w.type === 'location' && w.negated);
  if (locationReason) {
    const where = String(locationReason.quote ?? '').replace(/^Ort laut Kursangaben:\s*/, '');
    add(20, 2, m.place(where));
  } else if (positivePlaces.length > 0) {
    const wish = positivePlaces.map((w) => w.value).join(' / ');
    add(20, 0, place ? m.placeDeviates(wish, place) : m.placeOpen(wish));
  } else if (excludedPlaces.length > 0) {
    // Verneinter Ortswunsch (K1): Abweichung nur, wenn ein bekannter Ort
    // genau dem Ausgeschlossenen entspricht; sonst neutral der Ort laut
    // Kursangaben, ohne Kanton und Stadt zu verwechseln.
    const known = (cities ?? []).filter(Boolean);
    const hit = excludedPlaces.find((w) => known.some((c) => String(c).toLowerCase().includes(String(w.value).toLowerCase())));
    if (hit) {
      add(20, 0, m.placeDeviates(m.excluded(hit.value), known.join(', ')));
    } else if (known.length > 0) {
      add(20, 2, m.place(known.join(', ')));
    } else if (place) {
      add(20, 2, m.place(m.canton(place)));
    }
  }

  // Wünsche zu Lernform/Niveau: nur strukturierte Kursangaben entscheiden.
  // Genau eine Aussage je Wunsch (Nachtrag 13); doppelte Wünsche zusammenfassen.
  const seenWishes = new Set();
  wishChecks.forEach((check, index) => {
    const key = `${check.aspect}|${check.wishLabel}`;
    if (seenWishes.has(key)) return;
    seenWishes.add(key);
    add(25 + index, 0, wishCheckSentence(check, language));
  });

  for (const unknown of mustUnknowns) {
    if (unknown === 'event') add(30, 0, m.event(musts.location ?? null));
    if (unknown === 'location') add(30, 0, m.location(musts.location));
    if (unknown === 'budget') add(31, 0, m.budget(price || m.prices.unknown));
    if (unknown === 'language') add(32, 0, m.language);
  }

  const budgetWish = wishes.find((w) => w.type === 'budget');
  if ((budgetWish || musts.maxBudget) && !mustUnknowns.includes('budget') && price) {
    add(40, 2, m.priceLine(price));
  }

  const day = formatDay(event?.startDate ?? event?.start_date, m.locale);
  add(41, 6, day ? m.nextDate(day) : null);

  // Kürzen: am wenigsten wichtige Bausteine zuerst, Einschränkungen nie.
  const kept = [...parts];
  const total = () => kept.reduce((sum, p) => sum + countWords(p.text), 0);
  const shrink = () => {
    while (total() > MAX_EXPLANATION_WORDS) {
      const droppable = kept.filter((p) => p.priority > 0 && !p.lead).sort((a, b) => b.priority - a.priority)[0];
      if (droppable) { kept.splice(kept.indexOf(droppable), 1); continue; }
      // Nur noch Lead + Einschränkungen: Lead an Satzgrenzen kürzen.
      const leadPart = kept.find((p) => p.lead);
      if (!leadPart) break;
      const budget = MAX_EXPLANATION_WORDS - (total() - countWords(leadPart.text));
      const sentences = leadPart.text.match(/[^.!?]+[.!?]+/g) ?? [leadPart.text];
      let shortened = '';
      for (const sentence of sentences) {
        const next = `${shortened} ${sentence.trim()}`.trim();
        if (countWords(next) > budget) break;
        shortened = next;
      }
      if (shortened) leadPart.text = shortened;
      else kept.splice(kept.indexOf(leadPart), 1);
      break;
    }
  };
  shrink();
  // Ging die Zielgruppen-Nennung beim Kürzen verloren, Hinweis nachträglich sichern.
  if (audienceText && !kept.some((p) => p.order === 15) && audienceMissing(kept.map((p) => p.text).join(' '), audience)) {
    kept.push({ order: 15, priority: 0, text: m.audience(audienceText), lead: false });
    shrink();
  }
  let text = kept.sort((a, b) => a.order - b.order).map((p) => p.text).join(' ');
  if (countWords(text) > MAX_EXPLANATION_WORDS) {
    text = `${text.split(/\s+/).slice(0, MAX_EXPLANATION_WORDS).join(' ')}…`;
  }
  return text;
}
