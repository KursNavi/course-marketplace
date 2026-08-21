/**
 * Gültigkeitshinweis für zeitabhängige Angaben in Themenwelt-Artikeln.
 *
 * Ausgangslage:
 *   Die Sport- und Fitness-Artikel führen konkrete Beträge und rechtliche
 *   Voraussetzungen — etwa die Höchstbeträge der Bundesbeiträge an
 *   eidgenössische Prüfungen (CHF 9'500 / CHF 10'500), das Mindest-Stammkapital
 *   einer GmbH oder die Umsatzschwelle für die Mehrwertsteuer. Solche Werte
 *   werden politisch festgelegt und ändern sich.
 *
 *   Live geprüft: Kein einziger dieser Artikel trug einen Stand- oder
 *   Gültigkeitshinweis. Die offiziellen Quellen (SBFI, AHV/IV, SECO, SUVA,
 *   ESTV) sind zwar sauber hinterlegt, standen aber nur als Block ganz unten,
 *   ohne erkennbaren Bezug zu den Zahlen im Text.
 *
 * Was dieses Modul tut — und was bewusst nicht:
 *   Es erfindet, ändert und aktualisiert KEINE Zahl. Der Artikeltext bleibt
 *   unangetastet. Es erkennt lediglich, ob ein Artikel zeitabhängige Angaben
 *   enthält, und formuliert daraus einen Hinweis, der ausschliesslich auf
 *   echten Daten beruht: dem redaktionellen Prüfdatum des Artikels
 *   (theme_world_scenarios.last_reviewed_at) und den hinterlegten Quellen.
 *
 *   Liegt kein Prüfdatum vor, wird auch keines behauptet — der Hinweis nennt
 *   dann nur die Zeitabhängigkeit selbst.
 *
 * Formulierung:
 *   Bewusst als Orientierung, nie als Zusicherung. Verbindlich sind die
 *   offiziellen Stellen, nicht dieser Artikel.
 */

import { formatEditorialReviewMonth } from './editorialReviewDate';

/**
 * Muster für zeitabhängige Angaben.
 *
 * Geldbeträge und Prozentwerte sind die eindeutigen Fälle. Dazu kommen
 * Begriffe, hinter denen regelmässig geänderte Regelwerke stehen — Beiträge,
 * Versicherungspflichten, Prüfungs- und Zulassungsvoraussetzungen.
 */
const PATTERNS = [
  /CHF\s?\d/i,                       // Geldbeträge
  /\d\s?%/,                          // Prozent- und Beitragssätze
  /\bbundesbeitr/i,                  // Bundesbeiträge an eidg. Prüfungen
  /\bbeitragssatz|beitragssätze/i,
  /\bahv\b|\biv\b|\beo\b|\balv\b/i,  // Sozialversicherungen
  /\bmehrwertsteuer|\bmwst\b/i,
  /\bstammkapital/i,
  /\bkrankentaggeld|unfallversicherung|haftpflichtversicherung/i,
  /\bzulassungsvoraussetzung|zulassungsbedingung/i,
  /\bprüfungsordnung|prüfungsreglement|wegleitung/i,
  /\blohnempfehlung|\blohnband|\bmindestlohn/i,
];

/**
 * Prüft, ob ein Artikel zeitabhängige Angaben enthält.
 *
 * @param {unknown} html - Artikelinhalt (HTML oder Text)
 * @returns {boolean}
 */
export function containsTimeSensitiveFacts(html) {
  if (typeof html !== 'string' || !html.trim()) return false;
  return PATTERNS.some((pattern) => pattern.test(html));
}

/**
 * Baut den Gültigkeitshinweis.
 *
 * @param {object} [options]
 * @param {unknown} [options.lastReviewedAt] - echtes Prüfdatum oder null
 * @param {boolean} [options.hasSources] - sind offizielle Quellen hinterlegt?
 * @returns {{intro: string, stand: string|null, verweis: string}}
 */
export function buildTimeSensitiveNotice(options = {}) {
  const { lastReviewedAt = null, hasSources = false } = options;

  const monat = formatEditorialReviewMonth(lastReviewedAt);

  return {
    intro:
      'Beträge, Beitragssätze sowie Prüfungs- und Zulassungsvoraussetzungen '
      + 'werden regelmässig angepasst.',
    // Nur behaupten, was in den Daten steht.
    stand: monat
      ? `Die Angaben in diesem Artikel geben den Stand der letzten redaktionellen Prüfung wieder (${monat}).`
      : null,
    verweis: hasSources
      ? 'Sie dienen der Orientierung und ersetzen keine verbindliche Auskunft — '
        + 'massgeblich sind die unten verlinkten offiziellen Stellen.'
      : 'Sie dienen der Orientierung und ersetzen keine verbindliche Auskunft — '
        + 'massgeblich sind die zuständigen offiziellen Stellen.',
  };
}
