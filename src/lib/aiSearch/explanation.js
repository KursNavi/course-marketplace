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

import { WISH_CLAIM_PATTERNS, DELIVERY_LABELS } from './wishCheck.js';
import { cantonForPlace } from './queryParse.js';
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
    offerForms: { birthday: 'Kindergeburtstag', company: 'Angebot für Firmen und Teams', training: 'berufliche Aus- oder Weiterbildung', self_study: 'Selbststudium', camp: 'Ferienlager', camp_overnight: 'Ferienlager mit Unterkunft', holiday: 'Ferienkurs', group_event: 'Event für Gruppen und Teams' },
    pastNote: (d) => ` (angegebener Termin ${d}, bereits vorbei)`,
    selfStudyOnly: 'Lernform laut Kursangaben: Selbststudium.',
    holidayFact: (x) => `Kursart laut Kursangaben: ${x}.`,
    holidayDeviates: (label, x) => `Abweichung vom Wunsch ${q.de(label)}: Kursart laut Kursangaben ${q.de(x)}.`,
    holidayUnknown: (label) => `Wunsch ${q.de(label)} nicht belegt.`,
    locationAddressOnly: (name) => `Nicht bestätigt: Kursort in ${name} – die Adressangabe nennt ${name}, ein Kursort ist aber nicht eingetragen.`,
    kursarten: { ferienkurs: 'Ferienkurs', feriencamp: 'Ferienlager', events_workshops: 'Workshop/Event', freizeitkurs: 'Freizeitkurs', kindergeburtstag: 'Kindergeburtstag' },
    or: 'oder',
    budgetBasis: (price) => `Budgetvorgabe nicht bestätigt: genannt ist ${price}, ob als Gesamtpreis, ist nicht angegeben.`,
    timeUnconfirmed: (label) => `Wunsch ${q.de(label)} nicht belegt.`,
    prereq: (x) => `Voraussetzungen: ${q.de(x)}.`,
    targetText: (x) => `Laut Kursbeschreibung: ${q.de(x)}.`,
    admission: (x) => `Zulassungsbedingungen laut Kursangaben: ${x}.`,
    placeMulti: (list, online, more, n) => `${n > 1 ? 'Kantone' : 'Kanton'} ${list}${more ? ' u. a.' : ''} (Präsenz laut Adressangabe)${online ? ', zudem online' : ''}`,
    placeConflict: 'Ortsangaben widersprüchlich: Als Kursort ist „Online“ eingetragen, die Lernform nennt aber Präsenz; ein Präsenzort fehlt.',
    mustPlaceOk: (name, place) => `Vorgabe „Kanton ${name}“ erfüllt: ${place}.`,
    mustOnlineOk: (form) => `Vorgabe „nicht online“ erfüllt: Lernform ${form}.`,
    mustOnlineConflict: (form) => `Vorgabe „nicht online“: Die Lernform nennt ${form}, als Kursort ist aber „Online“ eingetragen – widersprüchlich.`,
    timeDeviates: (label, actual) => `Abweichung vom Wunsch ${q.de(label)}: Kurszeit laut Kursangaben ${q.de(actual)}.`,
    qualFact: (x) => `Abschluss laut Kursangaben: ${q.de(x)}.`,
    qualDeviates: (label, x) => `${q.de(label)} laut Kursangaben nicht belegt; genannt wird ${q.de(x)}.`,
    qualMissing: (label) => `${q.de(label)} laut Kursangaben nicht belegt.`,
    objectives: (list) => `Lernziele laut Kursangaben: ${list}.`,
    descriptionLine: (x) => `Laut Kursbeschreibung: ${q.de(x)}.`,
    compact: [[' laut Kursangaben', ''], ['Laut Kursbeschreibung:', 'Beschreibung:'], ['Zulassungsbedingungen:', 'Zulassung:'], [' laut Adressangabe', '']],
    levelFact: (a) => `Niveau laut Kursangaben: ${a}.`,
    formFact: (a) => `Lernform laut Kursangaben: ${a}.`,
    timeFact: (x) => `Zeitangabe laut Kursangaben: ${q.de(x)}.`,
    levelConflict: (label, actual, word) => `Wunsch ${q.de(label)} nicht bestätigt: Das Niveau ist als ${q.de(actual)} angegeben, die Beschreibung nennt ${q.de(word)}.`,
    periodFact: (day) => `Termin im gewünschten Zeitraum: ${day}.`,
    periodDeviates: (label, day) => `Abweichung vom Wunsch ${q.de(label)}: nächster Termin ${day}.`,
    periodUnconfirmed: (label) => `Wunsch ${q.de(label)} nicht bestätigt: kein Termin angegeben.`,
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
    offerForms: { birthday: 'anniversaire d’enfant', company: 'offre pour entreprises et équipes', training: 'formation professionnelle', self_study: 'autoformation', camp: 'camp de vacances', camp_overnight: 'camp de vacances avec hébergement', holiday: 'cours de vacances', group_event: 'événement pour groupes et équipes' },
    pastNote: (d) => ` (date indiquée ${d}, déjà passée)`,
    selfStudyOnly: 'Forme d’apprentissage selon les indications du cours : autoformation.',
    holidayFact: (x) => `Type de cours selon les indications du cours : ${x}.`,
    holidayDeviates: (label, x) => `Écart par rapport au souhait ${q.fr(label)} : type de cours ${q.fr(x)}.`,
    holidayUnknown: (label) => `Souhait ${q.fr(label)} non confirmé.`,
    locationAddressOnly: (name) => `Non confirmé : lieu du cours à ${name} – l’adresse mentionne ${name}, mais aucun lieu n’est indiqué.`,
    kursarten: { ferienkurs: 'cours de vacances', feriencamp: 'camp de vacances', events_workshops: 'atelier/événement', freizeitkurs: 'cours de loisirs', kindergeburtstag: 'anniversaire d’enfant' },
    or: 'ou',
    budgetBasis: (price) => `Budget non confirmé : ${price} indiqué, sans précision s’il s’agit du prix total.`,
    timeUnconfirmed: (label) => `Souhait ${q.fr(label)} non confirmé.`,
    prereq: (x) => `Prérequis : ${q.fr(x)}.`,
    targetText: (x) => `Selon la description du cours : ${q.fr(x)}.`,
    admission: (x) => `Conditions d’admission selon les indications du cours : ${x}.`,
    placeMulti: (list, online, more, n) => `${n > 1 ? 'cantons' : 'canton'} ${list}${more ? ', entre autres' : ''} (présentiel selon l’adresse)${online ? ', aussi en ligne' : ''}`,
    placeConflict: 'Indications de lieu contradictoires : le lieu indiqué est « Online », mais la forme est présentielle ; aucun lieu présentiel indiqué.',
    mustPlaceOk: (name, place) => `Exigence « canton ${name} » remplie : ${place}.`,
    mustOnlineOk: (form) => `Exigence « pas en ligne » remplie : ${form}.`,
    mustOnlineConflict: (form) => `Exigence « pas en ligne » : la forme indiquée est ${form}, mais le lieu indiqué est « Online » – contradictoire.`,
    timeDeviates: (label, actual) => `Écart par rapport au souhait ${q.fr(label)} : horaire selon les indications du cours ${q.fr(actual)}.`,
    qualFact: (x) => `Diplôme selon les indications du cours : ${q.fr(x)}.`,
    qualDeviates: (label, x) => `${q.fr(label)} non confirmé selon les indications du cours ; mentionné : ${q.fr(x)}.`,
    qualMissing: (label) => `${q.fr(label)} non confirmé selon les indications du cours.`,
    objectives: (list) => `Objectifs selon les indications du cours : ${list}.`,
    descriptionLine: (x) => `Selon la description du cours : ${q.fr(x)}.`,
    compact: [[' selon les indications du cours', ''], ['Selon la description du cours :', 'Description :'], [' selon l’adresse', '']],
    levelFact: (a) => `Niveau selon les indications du cours : ${a}.`,
    formFact: (a) => `Forme d’apprentissage selon les indications du cours : ${a}.`,
    timeFact: (x) => `Horaire selon les indications du cours : ${q.fr(x)}.`,
    levelConflict: (label, actual, word) => `Souhait ${q.fr(label)} non confirmé : le niveau est indiqué ${q.fr(actual)}, mais la description mentionne ${q.fr(word)}.`,
    periodFact: (day) => `Date dans la période souhaitée : ${day}.`,
    periodDeviates: (label, day) => `Écart par rapport au souhait ${q.fr(label)} : prochaine date ${day}.`,
    periodUnconfirmed: (label) => `Souhait ${q.fr(label)} non confirmé : aucune date indiquée.`,
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
    offerForms: { birthday: 'festa di compleanno per bambini', company: 'offerta per aziende e team', training: 'formazione professionale', self_study: 'autoapprendimento', camp: 'campo vacanze', camp_overnight: 'campo vacanze con alloggio', holiday: 'corso durante le vacanze', group_event: 'evento per gruppi e team' },
    pastNote: (d) => ` (data indicata ${d}, già passata)`,
    selfStudyOnly: 'Forma di apprendimento secondo le indicazioni del corso: autoapprendimento.',
    holidayFact: (x) => `Tipo di corso secondo le indicazioni del corso: ${x}.`,
    holidayDeviates: (label, x) => `Differenza rispetto al desiderio ${q.it(label)}: tipo di corso ${q.it(x)}.`,
    holidayUnknown: (label) => `Desiderio ${q.it(label)} non confermato.`,
    locationAddressOnly: (name) => `Non confermato: sede del corso a ${name} – l’indirizzo cita ${name}, ma non è indicata una sede.`,
    kursarten: { ferienkurs: 'corso durante le vacanze', feriencamp: 'campo vacanze', events_workshops: 'workshop/evento', freizeitkurs: 'corso per il tempo libero', kindergeburtstag: 'festa di compleanno' },
    or: 'o',
    budgetBasis: (price) => `Budget non confermato: indicato ${price}, senza precisare se è il prezzo totale.`,
    timeUnconfirmed: (label) => `Desiderio ${q.it(label)} non confermato.`,
    prereq: (x) => `Prerequisiti: ${q.it(x)}.`,
    targetText: (x) => `Secondo la descrizione del corso: ${q.it(x)}.`,
    admission: (x) => `Condizioni di ammissione secondo le indicazioni del corso: ${x}.`,
    placeMulti: (list, online, more, n) => `${n > 1 ? 'cantoni' : 'cantone'} ${list}${more ? ', tra l’altro' : ''} (in presenza secondo l’indirizzo)${online ? ', anche online' : ''}`,
    placeConflict: 'Indicazioni sul luogo contraddittorie: come luogo è indicato «Online», ma la forma è in presenza; manca un luogo in presenza.',
    mustPlaceOk: (name, place) => `Requisito «cantone ${name}» soddisfatto: ${place}.`,
    mustOnlineOk: (form) => `Requisito «non online» soddisfatto: ${form}.`,
    mustOnlineConflict: (form) => `Requisito «non online»: la forma indicata è ${form}, ma come luogo è indicato «Online» – contraddittorio.`,
    timeDeviates: (label, actual) => `Differenza rispetto al desiderio ${q.it(label)}: orario secondo le indicazioni del corso ${q.it(actual)}.`,
    qualFact: (x) => `Titolo secondo le indicazioni del corso: ${q.it(x)}.`,
    qualDeviates: (label, x) => `${q.it(label)} non confermato secondo le indicazioni del corso; indicato: ${q.it(x)}.`,
    qualMissing: (label) => `${q.it(label)} non confermato secondo le indicazioni del corso.`,
    objectives: (list) => `Obiettivi secondo le indicazioni del corso: ${list}.`,
    descriptionLine: (x) => `Secondo la descrizione del corso: ${q.it(x)}.`,
    compact: [[' secondo le indicazioni del corso', ''], ['Secondo la descrizione del corso:', 'Descrizione:'], [' secondo l’indirizzo', '']],
    levelFact: (a) => `Livello secondo le indicazioni del corso: ${a}.`,
    formFact: (a) => `Forma di apprendimento secondo le indicazioni del corso: ${a}.`,
    timeFact: (x) => `Orario secondo le indicazioni del corso: ${q.it(x)}.`,
    levelConflict: (label, actual, word) => `Desiderio ${q.it(label)} non confermato: il livello è indicato ${q.it(actual)}, ma la descrizione riporta ${q.it(word)}.`,
    periodFact: (day) => `Data nel periodo desiderato: ${day}.`,
    periodDeviates: (label, day) => `Differenza rispetto al desiderio ${q.it(label)}: prossima data ${day}.`,
    periodUnconfirmed: (label) => `Desiderio ${q.it(label)} non confermato: nessuna data indicata.`,
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
  camp: /lager|colonie|campo vacanze|camp de vacances/i,
  camp_overnight: /unterkunft|übernacht|hébergement|alloggio|pernott/i,
  holiday: /ferienkurs|ferien|vacances|vacanze/i,
  group_event: /event|gruppen|groupe|gruppi/i,
};
// Berufliche Aus-/Weiterbildung (Befund 23.11.2026: Fachausbildung für
// Kursleitende bei einer privaten Suche nicht als solche benannt).
const TRAINING_TITLE = /\b(ausbildung|lehrgang|fernlehrgang|studiengang|nachdiplom\p{L}*|fachausweis|dipl\.|diplom\p{L}*|wiedereinstieg)/iu;
// Auch Mehrzahl und Zusammensetzungen („Lehrgänge“, „Ausbildungsportfolio“; Befund 20163).
const TRAINING_TEXT = /\b(?:fern)?lehrg[aä]ng\p{L}*|\bstudieng[aä]ng\p{L}*|\bausbildungsportfolio\b/iu;

/** 'birthday' | 'company' | null aus Kursart, Titel und Beschreibung. */
// Zielgruppe Teams/Organisationen im Text (Befund Abnahme 4, 20120: „eignet
// sich für Teams … ebenso für Organisationen“), ausser auch Einzelpersonen
// sind ausdrücklich angesprochen.
const COMPANY_AUDIENCE = /\b(eignet sich|richtet sich|gedacht|konzipiert|unterstützt)\s+(?:(?:vor allem|besonders|primär|speziell)\s+)?(?:an\s+|für\s+)?(?:teams|organisationen|unternehmen|firmen)\b/i;
const INDIVIDUALS_TOO = /einzelpersonen|privatpersonen|privat buchbar|einzelanmeldung/i;

export function offerFormOf(course) {
  if (String(course?.kinder_kursart ?? '').toLowerCase() === 'kindergeburtstag') return 'birthday';
  const description = String(course?.description ?? '');
  if (COMPANY_TITLE.test(String(course?.title ?? '')) || COMPANY_TEXT.test(description)) return 'company';
  if (COMPANY_AUDIENCE.test(description) && !INDIVIDUALS_TOO.test(description)) return 'company';
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
  // Ferienlager (Befund 24.11.2026: Sprachcamps nicht als Lager mit Unterkunft erkennbar):
  // Kursart „feriencamp“ bzw. „Lager“ im Titel; Unterkunft nur, wenn der Text sie nennt.
  const kursart = String(course?.kinder_kursart ?? '').toLowerCase();
  if (kursart === 'feriencamp' || kursart === 'lager' || /\blager\b/i.test(String(course?.title ?? ''))) {
    forms.push(/unterkunft|übernacht|vollpension/i.test(String(course?.description ?? '')) ? 'camp_overnight' : 'camp');
  }
  // Ferienkurs (Befund 20112): nur in den Ferien angeboten.
  if (kursart === 'ferienkurs') forms.push('holiday');
  // Gruppen-/Team-Event (Befund 20734: „Foto-Event für Gruppen, Teams …“, Stichwort „Teamevent“).
  const keywords = Array.isArray(course?.keywords) ? course.keywords.join(' ') : String(course?.keywords ?? '');
  if (!forms.includes('company') && (/\b(?:event|anlass)\s+für\s+(?:gruppen|teams)\b/i.test(String(course?.description ?? '')) || /\bteam-?events?\b/i.test(keywords))) forms.push('group_event');
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
  if (check.aspect === 'Zeit') {
    // Wunsch mit den Worten der Anfrage („nach der Arbeit“), sonst die Standardbezeichnung.
    const label = check.wishLabel || ((check.key && m.wishLabels[check.key]) ?? '');
    // Bekannte, abweichende Kurszeit wird genannt (24.11.2026), sonst „nicht belegt“.
    const past = check.pastDate ? m.pastNote(check.pastDate) : '';
    return check.status === 'deviating' && check.actual ? m.timeDeviates(label, check.actual).replace(/\.$/, `${past}.`) : m.timeUnconfirmed(label);
  }
  if (check.aspect === 'Kursart') {
    // Ferienkurs-Wunsch gegen die Kursart (24.11.2026).
    return check.status === 'deviating' && check.actual ? m.holidayDeviates(check.wishLabel, m.kursarten[check.actual] ?? check.actual) : m.holidayUnknown(check.wishLabel);
  }
  if (check.aspect === 'Zeitraum') {
    const day = formatDay(check.actual, m.locale);
    return check.status === 'deviating' && day ? m.periodDeviates(check.wishLabel, day) : m.periodUnconfirmed(check.wishLabel);
  }
  if (check.aspect === 'Niveau' && check.conflict) {
    return m.levelConflict(check.wishLabel || ((check.key && m.wishLabels[check.key]) ?? ''), translateValues(check.actual, m), check.conflict);
  }
  const field = check.aspect === 'Niveau' ? 'Niveau' : 'Lernform';
  const actual = check.actual ? translateValues(check.actual, m) : null;
  const detail = actual
    ? (field === 'Niveau' ? m.levelIs(actual) : m.formIs(actual))
    : (field === 'Niveau' ? m.noLevel : m.noForm);
  // Niveau mit dem Wort der Anfrage („Anfänger“); Lernform weiter mit Standardbezeichnung.
  const label = check.aspect === 'Niveau' && check.wishLabel ? check.wishLabel : ((check.key && m.wishLabels[check.key]) ?? check.wishLabel);
  // Verneinter Wunsch („nicht online“): eine Abweichung wird als solche
  // benannt, nie als nicht bestätigter Gegenwunsch (K1).
  return check.negated && check.status === 'deviating' ? m.wishDeviates(label, detail) : m.wishUnconfirmed(label, detail);
}

/**
 * Faktensatz zu einem BESTÄTIGTEN Wunsch (Stabilisierung 23.11.2026): Da Luna
 * keine Passungsaussage mehr schreibt, nennt der Server die belegte Angabe.
 */
export function wishFactSentence(check, language = 'de') {
  if (!check || check.status !== 'confirmed') return null;
  const m = messagesFor(language);
  if (check.aspect === 'Niveau' && check.actual) return m.levelFact(translateValues(check.actual, m));
  if (check.aspect === 'Lernform' && check.actual) return m.formFact(translateValues(check.actual, m));
  if (check.aspect === 'Zeit' && check.actual) return m.timeFact(check.actual).replace(/\.$/, `${check.pastDate ? m.pastNote(check.pastDate) : ''}.`);
  if (check.aspect === 'Kursart') return m.holidayFact(m.kursarten[check.actual] ?? m.offerForms.holiday);
  if (check.aspect === 'Zeitraum') {
    const day = formatDay(check.actual, m.locale);
    return day ? m.periodFact(day) : null;
  }
  return null;
}

/**
 * Inhaltssatz aus Lunas Text (Stabilisierung 23.11.2026): Luna beschreibt nur
 * noch, was man lernt; alle Tatsachen zu Eignung, Niveau, Zielgruppe,
 * Angebotsform, Ort, Zeit und Preis setzt der Server aus den Kursangaben.
 * Übernommen wird nur der erste Satz. Enthält er trotzdem eine Passungs- oder
 * Eignungsaussage, entfällt er (dann gelten die belegten Zitatsätze).
 * Diese Prüfung ist eine Absicherung, nicht die Hauptlösung.
 */
const ASSESSMENT = /\b(passt|passend|geeignet|eignet|richtet sich|ideal|für dich|zu deine[mnrs]?|unterstützt (?:\p{L}+ )?(?:dich|deine[nmrs]?)|(?:dein|deine[nmrs]?) (?:\p{L}+ )?(?:wunsch|ziel|ziele|wechsel|einstieg|rolle|niveau|situation|anliegen|suche|alter)|anfänger\p{L}*|einsteiger\p{L}*|fortgeschritten\p{L}*|vorkenntnis\p{L}*|kinder\p{L}*|jugendlich\p{L}*|erwachsen\p{L}*|ferien\p{L}*|convient|adapté\p{L}*|idéal\p{L}*|pour toi|débutant\p{L}*|enfants?|adolescents?|adultes?|adatt[oaie]|ideale|per te|principiant[ei]|bambin[ie]|ragazz[ie]|adulti)\b/iu;
export function contentSentence(lead, evidenceText = null) {
  const text = typeof lead === 'string' ? lead.replace(/\s+/g, ' ').trim() : '';
  if (!text) return null;
  const first = (text.match(/^[^.!?]+[.!?]+/) ?? [text])[0].trim();
  if (countWords(first) < 4 || ASSESSMENT.test(first)) return null;
  // Belegprüfung (Punkt 1, 23.11.2026): Behauptet der Inhaltssatz eine
  // Eigenschaft, muss sie in den Kursangaben stehen; sonst entfällt er.
  if (evidenceText !== null && unbackedProperty(first, evidenceText)) return null;
  return first;
}

/**
 * Eigenschaften, die ein Inhaltssatz nur mit Beleg nennen darf: je Eigenschaft
 * die Behauptung (DE/FR/IT) und der Beleg in den Kursangaben (Titel,
 * Beschreibung, Lernziele, Stichworte, Terminbeschreibung, Lernform).
 * Keine Sperrliste: Die Aussage bleibt erlaubt, wenn die Kursangaben sie tragen.
 */
export const PROPERTY_CLAIMS = Object.freeze([
  { key: 'online', claim: /\bonline\b|\bzoom\b|virtuell|en ligne|à distance|in linea|a distanza/i, evidence: /\bonline\b|\bzoom\b|virtuell|livestream|webinar|e-learning/i },
  { key: 'draussen', claim: /draussen|im freien|outdoor|en plein air|à l['’]extérieur|all['’]aperto/i, evidence: /draussen|im freien|outdoor|plein air|aperto|exkursion|ausflug|natur|wald|garten|stadtrundgang|city walk/i },
  { key: 'kleingruppe', claim: /kleine[nr]? gruppe|kleingruppe|petits? groupes?|piccoli gruppi/i, evidence: /kleingruppe|kleine[nr]? gruppe|max(?:imal)?\.?\s*\d+\s*(?:teilnehm|person|kinder)|petits? groupes?|piccoli gruppi/i },
  { key: 'einzel', claim: /einzelunterricht|einzeltraining|einzellektion|privatunterricht|1:1|cours particuliers?|leçons? individuelles?|lezioni? (?:individuali|private)/i, evidence: /einzel|privatunterricht|privatstunde|1:1|personal training|individuell/i },
  { key: 'ferien', claim: /ferien|\bcamp\b|\blager\b|vacances|colonie|vacanze|\bcampo\b/i, evidence: /ferien|\bcamp\b|\blager\b|vacances|vacanze/i },
  { key: 'intensiv', claim: /intensiv|intensif|intensivo/i, evidence: /intensiv/i },
  { key: 'täglich', claim: /täglich|jeden tag|chaque jour|tous les jours|ogni giorno/i, evidence: /täglich|jeden tag|aufeinanderfolgenden tagen|tageweise/i },
  { key: 'zeit', claim: /wochenend|samstag|sonntag|\babends?\b|feierabend|week-?end|samedi|dimanche|\bsoir|fine settimana|sabato|domenica|\bsera\b/i, evidence: /wochenend|samstag|sonntag|\b(?:sa|so)\.?\s*[/\d]|abend|feierabend|(?:1[89]|2[0-2])[:.][0-5]\d/i },
]);

/** Erste Eigenschaft, die der Satz behauptet, die Kursangaben aber nicht tragen. */
export function unbackedProperty(sentence, evidenceText) {
  const text = String(sentence ?? '');
  const evidence = String(evidenceText ?? '');
  return PROPERTY_CLAIMS.find((p) => p.claim.test(text) && !p.evidence.test(evidence))?.key ?? null;
}

/** Ort mit Stadt und Kanton („Horgen (Kanton Zürich)“), Online unverändert. */
export function formatPlace(cities, canton, language = 'de') {
  const m = messagesFor(language);
  const known = [...new Set((cities ?? []).filter(Boolean).map(String))];
  const cantonName = canton ? String(canton) : null;
  if (cantonName && /^online$/i.test(cantonName)) return known.length > 0 ? known.join(', ') : 'Online';
  if (known.length > 0 && cantonName && !known.some((c) => c.toLowerCase() === cantonName.toLowerCase())) return `${known.join(', ')} (${m.canton(cantonName)})`;
  if (known.length > 0) return known.join(', ');
  return cantonName ? m.canton(cantonName) : null;
}

// Zielgruppen-Aussage der Kursbeschreibung als wesentliche Einschränkung
// (Stabilisierung 23.11.2026; Beispiel 20194: „richtet sich an Ärztinnen und
// Ärzte, die als Praxisbesitzer/innen …“). Wörtlich übernommen, gekürzt.
const AUDIENCE_STATEMENT = /\b(?:richtet sich (?:ausschlie(?:ss|\xdf)lich |vor allem |speziell |primär |insbesondere )?an|(?:ist|sind) (?:nur |ausschliesslich |speziell )?für|eignet sich (?:nur |ausschliesslich |besonders |speziell )?für|(?:nur|ausschliesslich) für|s['’]adresse (?:uniquement |exclusivement )?(?:aux|à|au)|réservée? aux|si rivolge (?:a|ai|alle|agli)|riservat[oa] (?:a|ai|alle|agli))\s+/iu;
// Satzende ohne Abkürzungen („ca.“, „z. B.“, „u. a.“, „bzw.“) und Ziffern („3.5“).
const ABBREVIATION_END = /(?:^|[\s(])(?:ca|z|B|u|a|bzw|evtl|inkl|max|min|Nr|resp|vgl|usw|etc|ggf|d|h|Dr|Prof|St)$/;
function sentenceRest(text) {
  let end = 0;
  while (end < text.length && end < 200) {
    const ch = text[end];
    // Doppelpunkt nur als Satzzeichen, nicht im Wort („Einsteiger:innen“, Lesbarkeit 24.11.2026).
    if (/[;!?\n]/.test(ch) || (ch === ':' && !/[\p{L}]/u.test(text[end + 1] ?? ''))) break;
    if (ch === '.' && !ABBREVIATION_END.test(text.slice(0, end)) && !/\d/.test(text[end - 1] ?? '')) break;
    end += 1;
  }
  return text.slice(0, end);
}
export function audienceStatement(description, maxWords = 8) {
  const source = String(description ?? '');
  const match = AUDIENCE_STATEMENT.exec(source);
  if (!match) return null;
  const phrase = match[0] + sentenceRest(source.slice(match.index + match[0].length));
  const words = phrase.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length < 4) return null;
  return words.length <= maxWords ? words.join(' ').replace(/[,–-]+$/, '') : `${words.slice(0, maxWords).join(' ').replace(/[,;:–-]+$/, '')}…`;
}

// Einschränkende Angaben (nie gekürzt): Berufsgruppe, Teams/Organisationen,
// Abschluss, Berufspraxis, Sprachniveau, Mindestalter, ausdrückliche
// Beschränkung. Übrige Zielgruppen- und Voraussetzungsangaben (z. B. „eigene
// Kamera“) weichen bei Platzmangel vor dem Inhaltssatz. Nur für die
// Kürzungsreihenfolge, nie zum Sperren von Text.
const RESTRICTIVE = /\b(?:nur|ausschlie(?:ss|\xdf)lich|exklusiv|reserviert|uniquement|exclusivement|solo)\b|réservé|riservat|ärzt|fachperson|fachleute|lehrperson|pflegefach|therapeut|mitarbeitende|führungskr|\bteams?\b|organisation|unternehmen|firmen|grundbildung|berufsbildung|abschluss|berufspraxis|berufserfahrung|berufstätigkeit|fachausweis|diplom|\befz\b|bachelor|\bmaster\b|\b[abc][12]\b|mindestalter|zulassung|fähigkeitszeugnis|berufsprüfung|fachprüfung|matura|hochschul|studium|abgeschlossene/iu;

// Voraussetzungen als wesentliche Teilnahmebeschränkung: wörtlich, gekürzt.
const NO_PREREQ = /^\s*[-–•]?\s*(keine|keinerlei|aucun|aucune|nessun|nessuna|none)\b/i;
export function prerequisiteQuote(text, maxWords = 8) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').replace(/^[\s–•-]+/, '').trim();
  if (clean.length < 4 || NO_PREREQ.test(clean)) return null;
  const words = clean.split(' ');
  return words.length <= maxWords ? clean.replace(/[.;:]+$/, '') : `${words.slice(0, maxWords).join(' ').replace(/[,;:–-]+$/, '')}…`;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Prüft Lunas Inhaltssatz und nennt bei Verwerfung den Grund (Diagnose, nur
 * im privaten Prüfbericht): leer, zu_kurz, sprache, passungsaussage,
 * eigenschaft:<key>.
 * @returns {{text: string|null, reason: string|null}}
 */
export function contentSentenceCheck(lead, evidenceText = null, language = 'de') {
  const text = typeof lead === 'string' ? lead.replace(/\s+/g, ' ').trim() : '';
  if (!text) return { text: null, reason: 'leer' };
  if (leadLanguageMismatch(text, language)) return { text: null, reason: 'sprache' };
  const first = (text.match(/^[^.!?]+[.!?]+/) ?? [text])[0].trim();
  if (countWords(first) < 4) return { text: null, reason: 'zu_kurz' };
  if (ASSESSMENT.test(first)) return { text: null, reason: `passungsaussage:${ASSESSMENT.exec(first)[0].toLowerCase()}` };
  const property = evidenceText !== null ? unbackedProperty(first, evidenceText) : null;
  if (property) return { text: null, reason: `eigenschaft:${property}` };
  return { text: first, reason: null };
}

// Kantone aus einer Adressangabe („Online, Genève, …, Bern“).
const ADDRESS_SPLIT = /\s*[,;/]\s*/;
export function addressCantons(address) {
  return [...new Set(String(address ?? '').split(ADDRESS_SPLIT).map((s) => s.trim()).filter((s) => s && cantonForPlace(s) === s))];
}

/**
 * Ort aus allen Ortsangaben zusammen (Serverfehler 20127/20163/20099,
 * 24.11.2026): Ein Ortsfeld „Online“ verdrängt belegte Präsenz nicht.
 *  - Städte aus Kursorten/Terminen → „8810 Horgen (Kanton Zürich)“;
 *  - sonst Kantone aus der Adressangabe → „Präsenz laut Adressangabe u. a. in …“;
 *  - Ortsfeld „Online“ ohne Präsenz → „Online“;
 *  - Ortsfeld „Online“, Lernform Präsenz, kein Ort → Widerspruch ausdrücklich.
 * @returns {{text: string|null, kind: 'cities'|'address'|'online'|'conflict'|'canton'|null}}
 */
export function placeSummary({ cities = [], canton = null, address = null, deliveryTypes = [], prefer = [], language = 'de' }) {
  const m = messagesFor(language);
  const types = (deliveryTypes ?? []).map((t) => String(t).toLowerCase());
  const presence = types.some((t) => t === 'presence' || t === 'vor_ort');
  const online = types.some((t) => t === 'online' || t === 'online_live') || /^online$/i.test(String(canton ?? ''));
  const known = [...new Set((cities ?? []).filter(Boolean).map(String))];
  const cantonName = canton && !/^online$/i.test(String(canton)) ? String(canton) : null;
  if (known.length > 0) {
    const text = cantonName && !known.some((c) => c.toLowerCase() === cantonName.toLowerCase()) ? `${known.join(', ')} (${m.canton(cantonName)})` : known.join(', ');
    return { text, kind: 'cities' };
  }
  const fromAddress = addressCantons(address);
  if (presence && fromAddress.length > 0) {
    const preferred = fromAddress.filter((c) => (prefer ?? []).some((p) => cantonForPlace(p) === c || p === c));
    const ordered = [...preferred, ...fromAddress.filter((c) => !preferred.includes(c))];
    const list = ordered.slice(0, 3);
    return { text: m.placeMulti(list.join(', '), online, ordered.length > list.length, list.length), kind: 'address' };
  }
  if (presence && /^online$/i.test(String(canton ?? ''))) return { text: null, kind: 'conflict' };
  if (cantonName) return { text: m.canton(cantonName), kind: 'canton' };
  if (online) return { text: 'Online', kind: 'online' };
  return { text: null, kind: null };
}

// Zulassungsbedingungen: alle einschränkenden Teilsätze sinngemäss (wörtlich,
// je Teilsatz gekürzt), statt nach 8 Wörtern abzuschneiden (Befund 20377).
const CONNECTOR = /mind(?:estens|\.)\s*(?:eine[rsn]?|ein)\b|eine[rs]? der folgenden|au moins un|almeno un/i;
export function admissionConditions(text, perClause = 5, maxClauses = 7) {
  const clean = String(text ?? '').replace(/\r/g, '');
  if (!clean.trim()) return null;
  const clauses = clean.split(/\n+|;|•|\s[–-]\s|(?<=[.:])\s+(?=[A-ZÄÖÜ])/).map((c) => c.replace(/^[\s–•-]+/, '').replace(/[\s.:;,]+$/, '').trim()).filter((c) => c.length > 2);
  const picked = clauses.filter((c) => RESTRICTIVE.test(c) || CONNECTOR.test(c));
  if (picked.length === 0) return null;
  return picked.slice(0, maxClauses).map((c) => {
    const words = c.split(/\s+/);
    return words.length <= perClause ? c : `${words.slice(0, perClause).join(' ').replace(/[,;:–-]+$/, '')}…`;
  });
}

// Abschluss aus belegten Kursangaben (Befund 20377/20163/20380).
const QUAL_PATTERNS = {
  cas: /\bCAS\b/, mas: /\bMAS\b/, das: /\bDAS\b/, mba: /\bE?MBA\b/,
  zertifikat: /zertifik\p{L}*|certific\p{L}*/iu,
  zertifikat_marke: /\bSIZ\b|\bECDL\b|\bICDL\b/u,
  diplom: /\bdipl(?:om\p{L}*|\.)|dipl[oô]m\p{L}*/iu,
  fachausweis: /fachausweis/i,
  efz: /\bEFZ\b/,
};
export function qualificationCheck(courseText, wanted) {
  const text = String(courseText ?? '');
  const excerptAt = (re) => {
    const hit = re.exec(text);
    if (!hit) return null;
    // Wörtlicher Ausschnitt: ein Wort davor (nicht über ein Satzende), das
    // Trefferwort und bis zu zwei Wörter danach; Füllwörter am Ende entfallen.
    const tokens = [...text.matchAll(/\S+/g)];
    const i = tokens.findIndex((t) => t.index <= hit.index && hit.index < t.index + t[0].length);
    if (i < 0) return hit[0];
    const from = i > 0 && !/[.!?:;]$/.test(tokens[i - 1][0]) ? i - 1 : i;
    let picked = tokens.slice(from, i + 3).map((t) => t[0]);
    const cut = picked.findIndex((w, k) => k > i - from && /[.!?;:,)]$/.test(w));
    if (cut >= 0) picked = picked.slice(0, cut + 1);
    while (picked.length > i - from + 1 && /^(wird|werden|ist|sind|und|oder|der|die|das|des|nach|von|mit|für|im|in|zu|am|als)$/i.test(picked[picked.length - 1])) picked.pop();
    return picked.join(' ').replace(/^[^\p{L}\p{N}]+|[\s,;:.–-]+$/gu, '').trim();
  };
  const ownPatterns = wanted === 'zertifikat' ? [QUAL_PATTERNS.zertifikat, QUAL_PATTERNS.zertifikat_marke] : (QUAL_PATTERNS[wanted] ? [QUAL_PATTERNS[wanted]] : []);
  for (const re of ownPatterns) {
    const own = excerptAt(re);
    if (own) return { status: 'confirmed', actual: own };
  }
  for (const [kind, re] of Object.entries(QUAL_PATTERNS)) {
    if (kind === wanted || (wanted === 'zertifikat' && kind === 'zertifikat_marke')) continue;
    const other = excerptAt(re);
    if (other) return { status: 'deviating', actual: other };
  }
  return { status: 'unknown', actual: null };
}

// Ersatz für einen verworfenen Inhaltssatz: belegte Lernziele (wörtlich) oder
// der erste Satz der Beschreibung. Keine erfundene Erklärung.
export function contentFallback({ objectives = null, description = null, language = 'de' }) {
  const m = messagesFor(language);
  const list = (Array.isArray(objectives) ? objectives : (objectives ? [objectives] : [])).map((o) => String(o).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const quote = (s, n) => { const w = s.split(' '); return w.length <= n ? s.replace(/[.;:]+$/, '') : `${w.slice(0, n).join(' ').replace(/[,;:.–-]+$/, '')}…`; };
  if (list.length > 0) return m.objectives(list.slice(0, 2).map((o) => q[EXPLANATION_LANGUAGES.includes(language) ? language : 'de'](quote(o, 7))).join(', '));
  const desc = String(description ?? '').replace(/\s+/g, ' ').trim();
  if (!desc) return null;
  const first = (desc.match(/^.+?[.!?](?=\s|$)/) ?? [desc])[0];
  return m.descriptionLine(quote(first, 16));
}

/**
 * @param {object} input  siehe Felder; zusätzlich (24.11.2026):
 *   address, deliveryTypes, objectives, courseText (für Abschluss), trace
 *   (Objekt, wird mit lunaText/verworfen gefüllt – nur für den privaten Prüfbericht).
 * @returns {string}
 */
export function buildExplanation({ lead = null, reasons = [], wishes = [], wishChecks = [], musts = {}, mustUnknowns = [], place = null, cities = [], canton = null, address = null, deliveryTypes = null, event = null, price = '', audience = null, language = 'de', offerForm = null, prerequisites = null, description = null, objectives = null, evidenceText = null, courseText = null, trace = null }) {
  const m = messagesFor(language);
  const audienceText = audience?.child ? ('minAge' in audience ? audienceLabel(audience, language) : audience.label) : null;
  // priority: 0 = nie kürzen (Einschränkungen, Abweichungen, Vorgaben),
  // höhere Zahl = zuerst weglassen. Kürzen nie mitten im Satz.
  const parts = [];
  const add = (order, priority, text) => { if (text) parts.push({ order, priority, text, lead: false }); };

  // 1. Inhaltssatz: geprüfter Luna-Satz, sonst belegter Ersatz aus Kursdaten.
  const check = contentSentenceCheck(lead, evidenceText, language);
  let leadText = check.text ? removeUnbackedAdultClaims(removeUnbackedWishClaims(check.text, wishChecks), audience) : null;
  let rejected = check.reason;
  if (check.text && !leadText) rejected = 'unbelegte_wunsch_oder_eignungsaussage';
  if (trace) { trace.lunaText = typeof lead === 'string' ? lead : null; trace.verworfen = lead ? rejected : null; }
  if (leadText) {
    parts.push({ order: 10, priority: 1, text: leadText, lead: true });
  } else {
    const fallback = contentFallback({ objectives, description, language });
    if (fallback) {
      parts.push({ order: 10, priority: 1, text: fallback, lead: true });
      if (trace) trace.ersatz = 'kursdaten';
    } else {
      reasons.filter((r) => r.kind === 'text' || r.kind === 'luna').forEach((reason, index) => {
        const where = m.sections[reason.section] ?? m.sections.category;
        const sentence = reason.section === 'title' && reason.kind === 'text'
          ? m.titleHit(reason.term)
          : (reason.kind === 'text' ? m.termQuote(reason.term, where, shortenQuote(reason.quote, reason.term)) : m.lunaQuote(where, shortenQuote(reason.quote, '')));
        add(10 + index, index === 0 ? 1 : 3 + index, sentence);
      });
      if (trace) trace.ersatz = 'zitate';
    }
  }

  // 2. Angebotsform, Zielgruppe, Zulassung/Voraussetzungen.
  // Ferienkurs als Angebotsform nur, wenn kein Ferienkurs-Wunsch ihn schon behandelt.
  const holidayWish = wishChecks.some((c) => c.aspect === 'Kursart');
  const forms = (Array.isArray(offerForm) ? offerForm : [offerForm]).filter((form) => form && m.offerForms[form] && !(form === 'holiday' && holidayWish));
  const wishTexts = wishChecks.map((c) => wishCheckSentence(c, language)).filter(Boolean).join(' ');
  forms.forEach((form, index) => {
    const shown = `${parts.map((p) => p.text).join(' ')} ${wishTexts}`;
    if (OFFER_FORM_MENTIONS[form].test(shown)) return;
    // Selbststudium ist eine Lernform, keine Angebotsform (Lesbarkeit 24.11.2026).
    add(14 + index / 10, 0, form === 'self_study' ? m.selfStudyOnly : m.offerForm(m.offerForms[form]));
  });
  if (audienceText && audienceMissing(parts.map((p) => p.text).join(' '), audience)) add(15, 0, m.audience(audienceText));
  const statement = audienceText ? null : audienceStatement(description);
  if (statement) add(15.5, RESTRICTIVE.test(statement) ? 0 : 1.5, m.targetText(statement));
  const conditions = admissionConditions(prerequisites);
  if (conditions) {
    const qf = q[EXPLANATION_LANGUAGES.includes(language) ? language : 'de'];
    // Nach „mind. einer der folgenden …“ sind die Teilsätze Alternativen: mit „oder“ verbinden.
    const connectorAt = conditions.findIndex((c) => CONNECTOR.test(c));
    const formatted = connectorAt < 0
      ? conditions.map((c) => qf(c)).join('; ')
      : [...conditions.slice(0, connectorAt + 1).map((c) => qf(c)), conditions.slice(connectorAt + 1).map((c) => qf(c)).join(` ${m.or} `)].filter(Boolean).join('; ');
    add(16, 0, m.admission(formatted));
  } else {
    const prereq = prerequisiteQuote(prerequisites);
    if (prereq) add(16, 1.5, m.prereq(prereq));
  }

  // 3. Ort und Vorgaben. Formular-Vorgaben heissen „Vorgabe“, nie „Wunsch“.
  const mustCanton = musts?.location ? String(musts.location) : null;
  const positivePlaces = wishes.filter((w) => w.type === 'location' && !w.negated && !(mustCanton && cantonForPlace(w.value) === mustCanton));
  const excludedPlaces = wishes.filter((w) => w.type === 'location' && w.negated);
  const summary = placeSummary({ cities, canton, address, deliveryTypes: deliveryTypes ?? [], prefer: positivePlaces.map((w) => w.value).concat(mustCanton ? [mustCanton] : []), language });
  const placeText = summary.text ?? (summary.kind === 'conflict' ? null : place);
  const locationReason = reasons.find((r) => r.kind === 'location');
  const mustOk = mustCanton && !mustUnknowns.includes('location') && !mustUnknowns.includes('event');
  if (mustOk) {
    add(19, 0, m.mustPlaceOk(mustCanton, placeText ?? m.canton(mustCanton)));
  } else if (locationReason && positivePlaces.length > 0) {
    add(20, 1.2, m.place(placeText ?? String(locationReason.quote ?? '').replace(/^Ort laut Kursangaben:\s*/, '')));
  } else if (positivePlaces.length > 0) {
    const wish = positivePlaces.map((w) => w.value).join(' / ');
    if (summary.kind === 'conflict') add(20, 0, m.placeConflict);
    else add(20, 0, placeText ? m.placeDeviates(wish, placeText) : m.placeOpen(wish));
  } else if (excludedPlaces.length > 0) {
    const known = (cities ?? []).filter(Boolean);
    const hit = excludedPlaces.find((w) => known.some((c) => String(c).toLowerCase().includes(String(w.value).toLowerCase())));
    if (hit) add(20, 0, m.placeDeviates(m.excluded(hit.value), known.join(', ')));
    else if (summary.text) add(20, 2, m.place(summary.text));
    // Nur ein Ortsname ohne Stadtangabe: als Kanton kennzeichnen (K1).
    else if (place) add(20, 2, m.place(m.canton(place)));
  } else if (!mustCanton && summary.kind === 'conflict') {
    add(20, 2, m.placeConflict);
  }
  if (musts?.onlineAllowed === false && mustCanton) {
    const types = (deliveryTypes ?? []).map((t) => String(t).toLowerCase());
    const form = translateValues(types.map((t) => DELIVERY_LABELS[t] ?? t).filter((v, i, a) => a.indexOf(v) === i).join(' / '), m);
    if (form && /^online$/i.test(String(canton ?? ''))) add(21, 0, m.mustOnlineConflict(form));
    else if (form && types.some((t) => t === 'presence' || t === 'vor_ort')) add(21, 1.2, m.mustOnlineOk(form));
  }

  // 4. Wünsche: eine Aussage je Wunsch; bestätigte als belegte Angabe.
  const seenWishes = new Set();
  wishChecks.forEach((c, index) => {
    const key = `${c.aspect}|${c.wishLabel}`;
    if (seenWishes.has(key)) return;
    seenWishes.add(key);
    add(25 + index, 0, wishCheckSentence(c, language));
    // Bestätigte Wünsche bleiben sichtbar (Vollständigkeit, 24.11.2026).
    add(25 + index, 0, wishFactSentence(c, language));
  });

  // 5. Abschluss (CAS, Diplom, Zertifikat …) aus belegten Kursangaben.
  for (const wish of wishes.filter((w) => w.type === 'qualification')) {
    const result = qualificationCheck(courseText ?? `${description ?? ''}`, wish.value);
    if (result.status === 'confirmed') add(24, 1.2, m.qualFact(result.actual));
    else if (result.status === 'deviating') add(24, 0, m.qualDeviates(wish.label, result.actual));
    else add(24, 0, m.qualMissing(wish.label));
  }

  for (const unknown of mustUnknowns) {
    if (unknown === 'event') add(30, 0, m.event(musts.location ?? null));
    if (unknown === 'location') {
      // Adressangabe nennt den Kanton, ein Kursort fehlt (Befund 20099): so benennen.
      add(30, 0, addressCantons(address).includes(String(musts.location)) ? m.locationAddressOnly(musts.location) : m.location(musts.location));
    }
    if (unknown === 'budget') {
      // Genannte Beträge liegen im Budget, die Preisbasis ist aber offen (24.11.2026):
      // das ausdrücklich sagen statt nur „nicht bestätigt“.
      const amounts = [...String(price ?? '').matchAll(/CHF\s*(\d+(?:[.,]\d+)?)/gi)].map((x) => Number(x[1].replace(',', '.')));
      const within = Number.isFinite(musts.maxBudget) && amounts.length > 0 && amounts.every((a) => a <= musts.maxBudget);
      // Langer Preis-Freitext (z. B. mit Gutscheincode): nur die genannten Beträge.
      // Langer Freitext: wörtlicher Anfang mit Auslassung (Befund 20613: Zitat muss wörtlich sein).
      const words = String(price).replace(/\s+/g, ' ').trim().split(' ');
      const priceText = words.length > 8 ? `${words.slice(0, 8).join(' ').replace(/[,;:.–-]+$/, '')}…` : String(price).replace(/[.\s]+$/, '');
      const quoted = q[EXPLANATION_LANGUAGES.includes(language) ? language : 'de'](priceText);
      add(31, 0, within ? m.budgetBasis(quoted) : m.budget(price || m.prices.unknown));
    }
    if (unknown === 'language') add(32, 0, m.language);
  }
  const budgetWish = wishes.find((w) => w.type === 'budget');
  if ((budgetWish || musts.maxBudget) && !mustUnknowns.includes('budget') && price) add(40, 2, m.priceLine(price));
  const day = formatDay(event?.startDate ?? event?.start_date, m.locale);
  add(41, 6, day ? m.nextDate(day) : null);

  // Kürzen (24.11.2026): 1. verdichten (kürzere Formulierung, gleicher Inhalt),
  // 2. weglassbare Angaben, 3. Inhaltssatz an Satzgrenzen. Nie mitten im Satz;
  // Einschränkungen (Priorität 0) bleiben auch, wenn die Grenze sonst nicht hält.
  const kept = [...parts];
  const total = () => kept.reduce((sum, p) => sum + countWords(p.text), 0);
  if (total() > MAX_EXPLANATION_WORDS) {
    for (const p of kept) if (!p.lead) for (const [from, to] of m.compact ?? []) p.text = p.text.split(from).join(to);
  }
  while (total() > MAX_EXPLANATION_WORDS) {
    const droppable = kept.filter((p) => p.priority > 1 && !p.lead).sort((a, b) => b.priority - a.priority)[0];
    if (!droppable) break;
    kept.splice(kept.indexOf(droppable), 1);
  }
  // Inhaltssatz und Einschränkungen bleiben; reicht die Grenze dann nicht, wird
  // sie überschritten statt eine wesentliche Aussage abzuschneiden (Diagnose).
  if (trace) trace.ueberLaenge = total() > MAX_EXPLANATION_WORDS;
  return kept.sort((a, b) => a.order - b.order).map((p) => p.text).join(' ');
}
