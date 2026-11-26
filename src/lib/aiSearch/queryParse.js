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
  // Füllwörter (Korrektur 23.11.2026, Befund §9.6): treffen viele fremde Kurse
  // und verdrängten im Textabruf passende Kurse. DE/FR/IT.
  'etwas', 'liebsten', 'lieber', 'richtung', 'bloss', 'mehr', 'meinen', 'meiner', 'meinem',
  'pour', 'cours', 'avec', 'une', 'mon', 'mes', 'son', 'sur', 'dans', 'pas', 'qui', 'que', 'aux',
  'cherche', 'apprendre', 'corso', 'corsi', 'una', 'mio', 'mia', 'del', 'della', 'anche',
  'cerco', 'imparare',
  // Budget-, Pflicht- und Altersangaben: werden im Formular bzw. serverseitig
  // geprüft und sind keine fachlichen Suchbegriffe.
  'budget', 'preis', 'maximum', 'massimo', 'francs', 'franchi', 'zwingend', 'exigé', 'obbligatorio',
  'pendant', 'ans', 'anni', 'jahre', 'jahren', 'jährige', 'jährigen', 'jähriger', 'tochter', 'sohn',
  'fils', 'fille', 'figlio', 'figlia',
]);

// „principiant“ deckt Ein- und Mehrzahl ab (Nachprüfung 25.11.2026, Befund 20099:
// „yoga per principianti“ wurde nicht als Niveauwunsch erkannt).
const BEGINNER_WORDS = ['anfänger', 'anfaenger', 'einsteiger', 'einstieg', 'grundkurs', 'beginner', 'débutant', 'principiant'];

// Gewünschte Sprache als Lerninhalt (Nachprüfung 25.11.2026, Befund 20108). Muster
// erkennt die Sprache in Kursangaben in allen drei Sprachen sowie auf Englisch.
const SUBJECT_LANGUAGES = [
  { words: /\b(?:englisch\p{L}*|anglais|inglese)\b/iu, pattern: '\\b(?:englisch\\p{L}*|english|anglais|inglese)' },
  { words: /\b(?:französisch\p{L}*|franzoesisch\p{L}*|français|francese)\b/iu, pattern: '\\b(?:französisch\\p{L}*|franzoesisch\\p{L}*|french|français|francese)' },
  { words: /\b(?:spanisch\p{L}*|espagnol|spagnolo)\b/iu, pattern: '\\b(?:spanisch\\p{L}*|spanish|espagnol|spagnolo|español)' },
  { words: /\b(?:italienisch\p{L}*|italien|italiano)\b/iu, pattern: '\\b(?:italienisch\\p{L}*|italian|italien|italiano)' },
  { words: /\b(?:deutschkurs\p{L}*|allemand|tedesco)\b/iu, pattern: '\\b(?:deutsch\\p{L}*|german|allemand|tedesco)' },
];

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
    let index = -1;
    for (const v of variants) {
      const match = new RegExp(`(^|[^\\p{L}])${escapeRegExp(v)}([^\\p{L}]|$)`, 'u').exec(lowerQuery);
      if (match) { index = match.index + match[1].length; break; }
    }
    if (index >= 0) found.push({ name, index });
  }
  return found;
}

// Verneinung (K1, 22.11.2026): ein Ausschlusswort höchstens vier Wörter vor
// der Angabe, ohne Satzgrenze dazwischen („aber nicht online“, „nicht in der
// Stadt Zürich“, „pas en ligne“, „non online“). Wird erkannt, entsteht ein
// verneinter Wunsch, nie der gegenteilige.
const NEGATION_WORDS = new Set(['nicht', 'kein', 'keine', 'keinen', 'keinem', 'ohne', 'ausser',
  'pas', 'sans', 'non', 'ni', 'hors', 'senza', 'niente', 'not', 'no']);

export function isNegatedAt(lowerQuery, index) {
  const before = String(lowerQuery ?? '').slice(0, Math.max(0, index));
  const clause = before.split(/[.,;:!?()]|\b(?:aber|sondern|mais|ma|but)\b/u).pop() ?? '';
  const words = clause.match(/[\p{L}]+/gu) ?? [];
  return words.slice(-4).some((word) => NEGATION_WORDS.has(word));
}

const ONLINE_PATTERN = /\bonline\b|\bvirtuell\b|\bremote\b|\bzoom\b|\ben ligne\b|\bà distance\b|\bin linea\b|\ba distanza\b/u;

// Sprache der Anfrage (K4): einfache Wortzählung, Standard Deutsch.
const LANGUAGE_MARKERS = {
  fr: new Set(['le', 'la', 'les', 'des', 'du', 'un', 'une', 'pour', 'avec', 'cours', 'formation', 'enfant', 'enfants', 'mon', 'ma', 'mes', 'je', 'pas', 'en', 'ligne', 'débutant', 'débutants', 'ans', 'de', 'et', 'à', 'au', 'aux', 'cherche', 'apprendre']),
  it: new Set(['il', 'lo', 'gli', 'per', 'con', 'corso', 'corsi', 'bambini', 'bambino', 'anni', 'di', 'un', 'una', 'mio', 'mia', 'principianti', 'principiante', 'non', 'anche', 'imparare', 'cerco', 'e', 'a', 'del', 'della', 'nel']),
  de: new Set(['der', 'die', 'das', 'und', 'für', 'mit', 'ich', 'ein', 'eine', 'kurs', 'nicht', 'lernen', 'möchte', 'für', 'meine', 'meinen', 'am', 'im', 'auf', 'oder', 'jährige', 'jahren', 'anfänger']),
};

export function detectQueryLanguage(text) {
  const words = String(text ?? '').toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const scores = { de: 0, fr: 0, it: 0 };
  for (const word of words) {
    for (const [lang, markers] of Object.entries(LANGUAGE_MARKERS)) if (markers.has(word)) scores[lang] += 1;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > scores.de ? best[0] : 'de';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Zeitwünsche (23.11.2026, Produktregel: Wünsche zu Ort, Zeit oder Lernform
 * beeinflussen nur die Reihenfolge; Abweichungen bleiben sichtbar). Erkannt
 * werden nur eindeutige Angaben; geprüft werden sie in wishCheck.js.
 */
export const TIME_WISHES = Object.freeze([
  { value: 'evening', label: 'abends', pattern: /\babends\b|\bam abend\b|\bnach der arbeit\b|\bnach feierabend\b|\ble soir\b|\ben soir[ée]e\b|\bapr[èe]s le travail\b|\bla sera\b|\bdi sera\b|\bdopo il lavoro\b/u },
  { value: 'weekend', label: 'am Wochenende', pattern: /\b(?:am |übers |an )?wochenenden?\b|\b(?:le |du )?week-?end\b|\b(?:il |nel |nei )?fine settimana\b/u },
  { value: 'saturday', label: 'samstags', pattern: /\bsamstags?\b|\bam samstag\b|\b(?:le )?samedis?\b|\b(?:il )?sabato\b/u },
  { value: 'sunday', label: 'sonntags', pattern: /\bsonntags?\b|\bam sonntag\b|\b(?:le )?dimanches?\b|\b(?:la )?domenica\b/u },
]);

// Zeitraum-Angaben („im März“, „diesen Winter“, „Sommer 2027“): optionale
// Zeitwünsche; sie werden nur aus dem fachlichen Anliegen herausgelöst
// (keine eigene Prüfung, die Terminangaben reichen dafür nicht aus).
const MONTHS = 'januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|janvier|février|mars|avril|juin|juillet|août|septembre|octobre|novembre|décembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|dicembre';
const SEASONS = 'frühling|fruehling|sommer|herbst|winter|printemps|été|automne|hiver|primavera|estate|autunno|inverno';
// Nicht nach Apostroph („vacances d'automne“ bleibt Teil des Anliegens).
const PERIOD_PATTERN = new RegExp(`(?<![\\p{L}'’])(?:(?:start|beginn|ab|im|in|diesen|nächsten|naechsten|kommenden|en|au|cet|cette|ce|dès|début|debut|inizio|dal|da|questo|quest|prossimo|prossima)\\s+)*(?:${MONTHS}|${SEASONS})(?:\\s+\\d{4})?(?![\\p{L}])`, 'gu');

// Monate (1–12) und Jahreszeiten je Sprache für Zeitraum-Wünsche.
const MONTH_NUMBERS = {
  januar: 1, janvier: 1, gennaio: 1, februar: 2, février: 2, febbraio: 2, märz: 3, maerz: 3, mars: 3, marzo: 3,
  april: 4, avril: 4, aprile: 4, mai: 5, maggio: 5, juni: 6, juin: 6, giugno: 6, juli: 7, juillet: 7, luglio: 7,
  august: 8, août: 8, agosto: 8, september: 9, septembre: 9, settembre: 9, oktober: 10, octobre: 10, ottobre: 10,
  november: 11, novembre: 11, dezember: 12, décembre: 12, dicembre: 12,
};
const SEASON_MONTHS = {
  frühling: [3, 4, 5], fruehling: [3, 4, 5], printemps: [3, 4, 5], primavera: [3, 4, 5],
  sommer: [6, 7, 8], été: [6, 7, 8], estate: [6, 7, 8],
  herbst: [9, 10, 11], automne: [9, 10, 11], autunno: [9, 10, 11],
  winter: [12, 1, 2], hiver: [12, 1, 2], inverno: [12, 1, 2],
};

/**
 * Zeitraum-Wünsche („im März“, „Sommer 2027“, „diesen Winter“; Stabilisierung
 * 23.11.2026): optionale Zeitwünsche, geprüft gegen die Termine (wishCheck).
 * @returns {Array<{type: 'period', label: string, value: {months: number[], year: number|null}}>}
 */
export function detectPeriodWishes(normalized) {
  const text = String(normalized ?? '');
  const lower = text.toLowerCase();
  const found = [];
  for (const match of lower.matchAll(PERIOD_PATTERN)) {
    if (isNegatedAt(lower, match.index)) continue;
    const words = match[0].split(/\s+/);
    const key = words.find((w) => MONTH_NUMBERS[w] || SEASON_MONTHS[w]);
    if (!key) continue;
    const months = MONTH_NUMBERS[key] ? [MONTH_NUMBERS[key]] : SEASON_MONTHS[key];
    const year = Number(/\d{4}/.exec(match[0])?.[0]) || null;
    found.push({ type: 'period', label: text.slice(match.index, match.index + match[0].length).trim(), value: { months, year } });
  }
  return found;
}

// Wörter, die zu einer Orts-, Zeit- oder Lernform-Angabe gehören und mit ihr
// aus dem fachlichen Anliegen gelöst werden („am liebsten in Bern“,
// „aber nicht online“, „anche online“, „de préférence le week-end“).
const WISH_LEAD_WORDS = new Set(['in', 'im', 'bei', 'nahe', 'nähe', 'naehe', 'von', 'der', 'stadt', 'raum', 'region', 'kanton',
  'um', 'rund', 'am', 'liebsten', 'lieber', 'vorzugsweise', 'idealerweise', 'möglichst', 'gerne', 'gern', 'auch', 'nur',
  'nicht', 'aber', 'à', 'au', 'en', 'a', 'nel', 'nella', 'près', 'de', 'préférence', 'plutôt', 'idéalement', 'pas',
  'non', 'anche', 'preferibilmente', 'possibilmente', 'solo', 'uniquement', 'seulement']);

function extendLeft(text, start) {
  let from = start;
  for (;;) {
    const before = text.slice(0, from);
    const match = /([\p{L}]+)\s+$/u.exec(before);
    if (!match || !WISH_LEAD_WORDS.has(match[1].toLowerCase())) return from;
    from = match.index;
  }
}

/**
 * Fachliches Anliegen ohne optionale Wünsche zu Ort, Zeit und Lernform
 * (Produktregel 23.11.2026): Luna bewertet die fachliche Eignung nur daran;
 * die herausgelösten Angaben gehen getrennt als optionale Wünsche mit und
 * zählen nur für die Reihenfolge. Zwingende Vorgaben kommen aus dem Formular
 * und werden serverseitig geprüft. Der Textabruf bleibt unverändert.
 *
 * @returns {{topic: string, optionalWishes: string[]}}
 */
export function splitOptionalWishes(normalized) {
  const text = String(normalized ?? '');
  const lower = text.toLowerCase();
  const spans = [];
  const addSpan = (start, end) => { if (end > start) spans.push([extendLeft(lower, start), end]); };
  for (const place of detectPlaces(lower)) {
    const name = place.name.toLowerCase();
    const raw = lower.slice(place.index);
    const length = raw.startsWith(name) ? name.length : (/^[\p{L}.\- ]+?(?=[^\p{L}]|$)/u.exec(raw)?.[0].length ?? name.length);
    addSpan(place.index, place.index + length);
  }
  for (const regex of [new RegExp(ONLINE_PATTERN.source, 'gu'), /\bvor ort\b|\bpräsenz(?:unterricht)?\b|\bselbststudium\b|\bselbstlern\p{L}*\b|\bim eigenen tempo\b|\be-learning\b|\bon.?demand\b/gu, PERIOD_PATTERN]) {
    for (const match of lower.matchAll(regex)) addSpan(match.index, match.index + match[0].length);
  }
  for (const wish of TIME_WISHES) {
    for (const match of lower.matchAll(new RegExp(wish.pattern.source, 'gu'))) addSpan(match.index, match.index + match[0].length);
  }
  if (spans.length === 0) return { topic: text, optionalWishes: [] };
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  const optionalWishes = merged.map(([s, e]) => text.slice(s, e).trim()).filter(Boolean);
  let topic = '';
  let cursor = 0;
  for (const [s, e] of merged) { topic += `${text.slice(cursor, s)} `; cursor = e; }
  topic += text.slice(cursor);
  topic = topic
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/(?:^|[,;]\s*)(?:und|oder|aber|et|ou|mais|e|o|ma)(?=\s*(?:[,;.]|$))/giu, '')
    .replace(/([,;])\s*(?=[,;.]|$)/g, '')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .replace(/\s+(?:und|oder|aber|et|ou|mais|e|o|ma)$/iu, '')
    .trim();
  if (topic.length < QUERY_MIN_LENGTH) return { topic: text, optionalWishes: [] };
  return { topic, optionalWishes };
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

  const found = detectPlaces(lower);
  const places = found.map((place) => place.name);
  for (const place of found) {
    if (isNegatedAt(lower, place.index)) {
      wishes.push({ type: 'location', label: `nicht ${place.name}`, value: place.name, negated: true });
    } else {
      wishes.push({ type: 'location', label: place.name, value: place.name });
    }
  }

  const onlineMatch = ONLINE_PATTERN.exec(lower);
  if (onlineMatch) {
    wishes.push(isNegatedAt(lower, onlineMatch.index)
      ? { type: 'online', label: 'nicht online', value: false, negated: true }
      : { type: 'online', label: 'Online', value: true });
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
  const presenceMatch = /\bvor ort\b|präsenz/u.exec(lower);
  if (presenceMatch && !isNegatedAt(lower, presenceMatch.index)) {
    wishes.push({ type: 'format', label: 'vor Ort', value: 'presence' });
  }

  // Zeitwünsche (nur nicht verneinte, je Art höchstens einmal).
  for (const wish of TIME_WISHES) {
    const match = wish.pattern.exec(lower);
    // Bezeichnung mit den Worten der Anfrage („nach der Arbeit“, „le soir“), Lesbarkeit 24.11.2026.
    if (match && !isNegatedAt(lower, match.index)) wishes.push({ type: 'time', label: normalized.slice(match.index, match.index + match[0].length).trim(), value: wish.value });
  }
  wishes.push(...detectPeriodWishes(normalized));

  // Ferienkurs als gewünschte Kursart (24.11.2026), geprüft gegen die Kursart.
  const holidayMatch = /\bferien(?:kurs|lager|camp|woche)\p{L}*|\bcours de vacances|\bstage de vacances|\bpendant les vacances|\bcorso estivo|\bdurante le vacanze/iu.exec(normalized);
  if (holidayMatch && !isNegatedAt(lower, holidayMatch.index)) wishes.push({ type: 'holiday', label: holidayMatch[0], value: true });

  // Abschluss (24.11.2026): CAS/MAS/DAS/MBA nur in Grossschreibung; geprüft
  // werden sie serverseitig gegen die Kursangaben (explanation.qualificationCheck).
  const qualificationPatterns = [
    [/\b(CAS|MAS|DAS|E?MBA)\b/u, (m) => m[1].toLowerCase().replace(/^emba$/, 'mba')],
    [/\b(?:zertifikat\p{L}*|certificat\p{L}*|certificato)/iu, () => 'zertifikat'],
    [/\b(?:diplom\p{L}*|diplôme|diploma)/iu, () => 'diplom'],
    [/\bfachausweis\p{L}*/iu, () => 'fachausweis'],
  ];
  const seenQualifications = new Set();
  for (const [pattern, toValue] of qualificationPatterns) {
    const match = pattern.exec(normalized);
    if (!match || isNegatedAt(lower, match.index)) continue;
    const value = toValue(match);
    if (seenQualifications.has(value)) continue;
    seenQualifications.add(value);
    wishes.push({ type: 'qualification', label: match[0], value });
  }

  // „flexibel buchbar“ als Wunsch zur Buchungsform (Nachprüfung 25.11.2026, Befund 20442).
  const bookingMatch = /\bflexibel buchbar|\beinzeln buchbar|\bjederzeit einsteigen|\beinstieg jederzeit|\bdrop-?in\b|\binscription flexible|\bprenotabile in modo flessibile/iu.exec(normalized);
  if (bookingMatch && !isNegatedAt(lower, bookingMatch.index)) wishes.push({ type: 'booking', label: bookingMatch[0], value: 'flexible' });

  // Sprache als Lerninhalt, mit dem Wort der Anfrage (z. B. „Englisch“).
  for (const subject of SUBJECT_LANGUAGES) {
    const match = subject.words.exec(normalized);
    if (match && !isNegatedAt(lower, match.index)) {
      wishes.push({ type: 'subject', label: match[0].replace(/kurs\p{L}*$/iu, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase()), value: 'language', pattern: subject.pattern });
      break;
    }
  }

  // „nicht bloss Einführung“ ist kein Einsteigerwunsch.
  const beginnerIndex = BEGINNER_WORDS.map((word) => lower.indexOf(word)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (beginnerIndex !== undefined && !isNegatedAt(lower, beginnerIndex)) {
    // Bezeichnung mit dem Wort der Anfrage („Anfänger“, „débutant“), Lesbarkeit 24.11.2026.
    const word = /[\p{L}-]+/u.exec(normalized.slice(beginnerIndex))?.[0] ?? 'Für Einsteiger';
    wishes.push({ type: 'level', label: word, value: 'beginner' });
  }

  const placeTokens = new Set(places.flatMap((place) => tokenize(place)));
  // Suchbegriffe aus dem fachlichen Anliegen (ohne optionale Wünsche zu Ort,
  // Zeit und Lernform; Korrektur 23.11.2026): „nach der Arbeit“, „am liebsten
  // in Bern“ oder „le week-end“ erzeugen keine Textabruf-Begriffe mehr.
  const { topic, optionalWishes } = splitOptionalWishes(normalized);
  const terms = [];
  for (const token of tokenize(topic)) {
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

  return { normalized, terms: terms.slice(0, 12), wishes, tsQuery, language: detectQueryLanguage(normalized), topic, optionalWishes };
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
