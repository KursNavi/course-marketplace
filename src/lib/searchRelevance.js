/**
 * Relevanz-Stufen für die öffentliche Kurssuche.
 *
 * Ausgangslage:
 *   Die Trefferprüfung in App.jsx wirft Titel, Anbieter, Schlagwörter, Kanton,
 *   Adresse, Eventorte, Spezialgebiet und Fokus in EINEN Textblock und prüft
 *   darauf `includes()`. Ein Treffer im Spezialgebiet «Yoga & Achtsamkeit» ist
 *   damit exakt so viel wert wie der Kurstitel «Yoga für Anfänger».
 *
 *   Sortiert wurde anschliessend allein nach Prio × Buchungsfaktor + Zufall —
 *   also ganz ohne Relevanz. Eine Suche nach «Yoga» konnte deshalb Pilates-
 *   oder Reiki-Kurse zuoberst zeigen, sobald diese hervorgehoben waren.
 *
 * Aufgabe dieses Moduls:
 *   Es entscheidet NICHT, ob ein Kurs angezeigt wird — die Treffermenge und
 *   damit die Trefferanzahl bleiben unverändert. Es bewertet ausschliesslich,
 *   WIE GUT ein bereits gefundener Kurs zur Eingabe passt, damit die Anzeige
 *   danach sortiert werden kann.
 *
 * Stufenmodell (grösser = relevanter):
 *   Titel      — der Kursname selbst trägt den Begriff
 *   Schlagwort — redaktionell gepflegte Stichwörter
 *   Kategorie  — Spezialgebiet und Fokus, also die thematische Einordnung
 *   Sonstiges  — Anbieter oder Ort; der Begriff kommt inhaltlich gar nicht vor
 *
 *   Innerhalb der Titel-Ebene wird zusätzlich abgestuft: Ein Titel, der exakt
 *   der Eingabe entspricht oder mit ihr beginnt, ist relevanter als einer, der
 *   sie irgendwo mittendrin führt («Thai-Yoga-Massage»). Damit stehen direkte
 *   Yoga-Kurse vor verwandten Angeboten, ohne dass verwandte Treffer
 *   verschwinden.
 *
 * Beschreibungstexte:
 *   course.description ist bewusst NICHT enthalten. Die Trefferprüfung
 *   durchsucht sie nicht, also kann kein Kurs allein über die Beschreibung in
 *   die Ergebnisliste gelangen. Eine Stufe dafür wäre toter Code, der eine
 *   Fähigkeit vortäuscht, die die Suche nicht hat.
 */

import { applyBasicLeadFactor } from './basicLeadPenalty';

/** Relevanzstufen. Bewusst grosse Abstände, damit Zwischenstufen nachrüstbar bleiben. */
export const RELEVANCE = {
  TITLE_EXACT: 100,      // Titel ist exakt die Eingabe
  TITLE_PREFIX: 90,      // Titel beginnt mit der Eingabe
  TITLE_ALL_WORDS: 80,   // alle Begriffe stehen als eigene Wörter im Titel
  TITLE_ALL_PARTS: 70,   // alle Begriffe stecken im Titel, teils als Wortteil
  TITLE_SOME: 60,        // mindestens ein Begriff steht im Titel
  KEYWORDS_ALL: 50,      // alle Begriffe in den Schlagwörtern
  KEYWORDS_SOME: 40,     // mindestens ein Begriff in den Schlagwörtern
  CATEGORY_ALL: 30,      // alle Begriffe in Spezialgebiet oder Fokus
  CATEGORY_SOME: 20,     // mindestens ein Begriff in der Kategorie
  OTHER: 10,             // nur Anbieter oder Ort
  NONE: 0,               // keine Eingabe oder kein bewertbares Feld
};

/** Buchstaben und Ziffern aller Sprachen — zur Erkennung von Wortgrenzen. */
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Vereinheitlicht ein Feld zu klein geschriebenem Text; nimmt auch Arrays entgegen. */
function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ').toLowerCase();
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

/**
 * Prüft, ob `term` in `text` als eigenständiges Wort vorkommt.
 *
 * Bewusst nicht über \b: In «Thai-Yoga-Massage» ist der Bindestrich eine
 * Wortgrenze, in «Yogalehrerin» dagegen nicht — genau diese Unterscheidung
 * trennt einen direkten von einem zusammengesetzten Treffer.
 */
export function containsWholeWord(text, term) {
  if (!text || !term) return false;
  let index = text.indexOf(term);
  while (index !== -1) {
    const before = index > 0 ? text[index - 1] : '';
    const after = text[index + term.length] || '';
    const freeBefore = !before || !WORD_CHAR.test(before);
    const freeAfter = !after || !WORD_CHAR.test(after);
    if (freeBefore && freeAfter) return true;
    index = text.indexOf(term, index + 1);
  }
  return false;
}

/**
 * Zerlegt die Eingabe in OR-Gruppen mit ihren UND-Begriffen.
 *
 * Spiegelt exakt die Trefferprüfung in App.jsx: erst an OR trennen, dann an
 * AND, dann an Leerzeichen. Weicht die Zerlegung ab, bewertet dieses Modul
 * eine andere Eingabe als die, nach der gesucht wurde.
 *
 * @param {unknown} query - Roheingabe aus dem Suchfeld
 * @returns {string[][]} z.B. 'Yoga AND Zürich OR Pilates' → [['yoga','zürich'], ['pilates']]
 */
export function parseQueryGroups(query) {
  if (typeof query !== 'string') return [];
  const raw = query.trim();
  if (!raw) return [];

  return raw
    .split(/\s+OR\s+/i)
    .map((orClause) => orClause
      .split(/\s+AND\s+/i)
      .flatMap((part) => part.trim().split(/\s+/))
      .filter((term) => term.length > 0)
      .map((term) => term.toLowerCase()))
    .filter((terms) => terms.length > 0);
}

/** Bündelt die durchsuchbaren Felder eines Kurses nach Relevanz-Ebene. */
function collectFields(course) {
  const eventLocations = Array.isArray(course.course_events)
    ? course.course_events.map((ev) => `${ev?.canton || ''} ${ev?.location || ''}`).join(' ').toLowerCase()
    : '';

  return {
    title: toText(course.title),
    keywords: toText(course.keywords),
    category: `${toText(course.category_specialty)} ${toText(course.category_focus)}`.trim(),
    other: [
      toText(course.instructor_name),
      toText(course.canton),
      toText(course.address),
      eventLocations,
    ].filter(Boolean).join(' '),
  };
}

/** Bewertet eine einzelne UND-Gruppe gegen einen Kurs. */
function scoreGroup(fields, terms) {
  const { title, keywords, category, other } = fields;
  const phrase = terms.join(' ');

  // --- Titel-Ebene ---
  if (title) {
    if (title === phrase) return RELEVANCE.TITLE_EXACT;

    if (terms.length > 0 && title.startsWith(phrase)) {
      const after = title[phrase.length] || '';
      if (!after || !WORD_CHAR.test(after)) return RELEVANCE.TITLE_PREFIX;
    }

    if (terms.every((term) => containsWholeWord(title, term))) return RELEVANCE.TITLE_ALL_WORDS;
    if (terms.every((term) => title.includes(term))) return RELEVANCE.TITLE_ALL_PARTS;
    if (terms.some((term) => title.includes(term))) return RELEVANCE.TITLE_SOME;
  }

  // --- Schlagwort-Ebene ---
  if (keywords) {
    if (terms.every((term) => keywords.includes(term))) return RELEVANCE.KEYWORDS_ALL;
    if (terms.some((term) => keywords.includes(term))) return RELEVANCE.KEYWORDS_SOME;
  }

  // --- Kategorie-Ebene ---
  if (category) {
    if (terms.every((term) => category.includes(term))) return RELEVANCE.CATEGORY_ALL;
    if (terms.some((term) => category.includes(term))) return RELEVANCE.CATEGORY_SOME;
  }

  // --- Sonstige Felder ---
  if (other && terms.some((term) => other.includes(term))) return RELEVANCE.OTHER;

  return RELEVANCE.NONE;
}

/**
 * Ermittelt die Relevanzstufe eines Kurses zur Sucheingabe.
 *
 * Bei mehreren OR-Gruppen zählt die beste Gruppe: Wer «Yoga OR Pilates» sucht,
 * soll einen Kurs über den Begriff bewertet sehen, der tatsächlich passt.
 *
 * @param {object} course - Kursdatensatz
 * @param {unknown} query - Roheingabe aus dem Suchfeld
 * @returns {number} Wert aus RELEVANCE; 0 ohne Eingabe
 */
export function getRelevanceScore(course, query) {
  if (!course) return RELEVANCE.NONE;

  const groups = parseQueryGroups(query);
  if (groups.length === 0) return RELEVANCE.NONE;

  const fields = collectFields(course);
  return groups.reduce((best, terms) => Math.max(best, scoreGroup(fields, terms)), RELEVANCE.NONE);
}

/**
 * Sortiert bereits gefilterte Kurse für die Anzeige.
 *
 * Reihenfolge der Kriterien:
 *   1. Bei aktivem Datumsfilter zuerst Kurse mit Termin (bisheriges Verhalten).
 *   2. Relevanz zur Sucheingabe — neu, und bewusst VOR der Hervorhebung:
 *      Ein direkter Titeltreffer steht vor einem hervorgehobenen Kurs, der nur
 *      über die Kategorie passt. Genau das war der gemeldete Fehler.
 *   3. Sichtbarkeits-Score (Hervorhebung × Buchungsfaktor + Streuung) — wirkt
 *      unverändert weiter, aber nur innerhalb einer Relevanzstufe.
 *   4. Kurs-ID als letzter Anker, damit die Reihenfolge nicht von der
 *      Eingangsreihenfolge der Datenbankantwort abhängt.
 *
 * Die Funktion filtert nichts: Die zurückgegebene Liste enthält exakt dieselben
 * Kurse wie die Eingabe, nur in anderer Reihenfolge.
 *
 * @param {Array} courses - bereits gefilterte Kurse
 * @param {object} options
 * @param {string} [options.query] - Roheingabe aus dem Suchfeld
 * @param {number} [options.seed] - Streuwert in [0, 1) für gleichrangige Kurse
 * @param {boolean} [options.preferDated] - Kurse mit Termin zuerst
 * @returns {Array} neue, sortierte Liste
 */
export function sortCoursesByRelevance(courses, options = {}) {
  if (!Array.isArray(courses)) return [];

  const { query = '', seed = 0, preferDated = false } = options;

  const hasDate = (c) => {
    if (c?.start_date) return true;
    return Array.isArray(c?.course_events) && c.course_events.some((ev) => ev?.start_date);
  };

  const relevance = new Map();
  const visibility = new Map();

  courses.forEach((course, i) => {
    const planFactor = course?.is_prio ? 1.2 : 1.0;
    const bookingFactor = course?.booking_factor || 1.0;
    const hash = Math.sin(seed * 10000 + i + 1) * 10000;
    const jitter = (hash - Math.floor(hash)) * 0.15;

    relevance.set(course?.id, getRelevanceScore(course, query));
    // Basic-Lead-Penalty wirkt als Multiplikator auf den fertigen
    // Sichtbarkeits-Score. Prio- und Buchungsfaktor bleiben unverändert; der
    // Abschlag verschiebt nur die Reihenfolge innerhalb derselben Relevanzstufe.
    visibility.set(course?.id, applyBasicLeadFactor(planFactor * bookingFactor + jitter, course));
  });

  return [...courses].sort((a, b) => {
    if (preferDated) {
      const aDated = hasDate(a);
      const bDated = hasDate(b);
      if (aDated && !bDated) return -1;
      if (!aDated && bDated) return 1;
    }

    // Relevanz schlägt Hervorhebung: Ein direkter Titeltreffer steht vor einem
    // hervorgehobenen Kurs, der nur über die Kategorie passt.
    const byRelevance = relevance.get(b?.id) - relevance.get(a?.id);
    if (byRelevance !== 0) return byRelevance;

    const byVisibility = visibility.get(b?.id) - visibility.get(a?.id);
    if (byVisibility !== 0) return byVisibility;

    return String(a?.id).localeCompare(String(b?.id));
  });
}

/**
 * Stabiler Streuwert aus einer Zeichenkette (FNV-1a, 32 Bit).
 *
 * Zweck: Bei aktiver Sucheingabe ersetzt dieser Wert den bisherigen
 * Zufalls-Seed. Die Rotation gleichrangiger Kurse bleibt damit erhalten,
 * dieselbe Suche liefert aber immer dieselbe Reihenfolge — sonst wäre die
 * Sortierung nicht reproduzierbar und nicht prüfbar.
 *
 * @param {unknown} value
 * @returns {number} Wert in [0, 1)
 */
export function stableSeed(value) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 100000) / 100000;
}
