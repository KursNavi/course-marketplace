/**
 * Redaktioneller Prüfhinweis unter Themenwelt-Artikeln.
 *
 * Hintergrund:
 *   SzenarioArtikelView zeigte bisher den fest einprogrammierten Satz
 *   «Zuletzt redaktionell geprüft: März 2026.» — unabhängig davon, ob der
 *   Artikel je geprüft wurde und unabhängig vom tatsächlichen Prüfdatum.
 *   Das ist eine Vertrauensangabe, also darf sie nur aus einer echten
 *   Datenquelle stammen.
 *
 * Einzige zulässige Quelle:
 *   theme_world_scenarios.last_reviewed_at (date)
 *     = «redaktionelles Datum der letzten inhaltlichen Prüfung»
 *
 * Ausdrücklich KEINE Quelle:
 *   - updated_at (der Trigger hebt es auch bei reinen Status-/Sortierwechseln an)
 *   - Build-Zeit, Systemzeit, Git-Historie
 *
 * Fehlt der Wert — bei Legacy-Szenarien immer, bei DB-Szenarien bis zur
 * ersten redaktionellen Prüfung — wird gar kein Prüfdatum behauptet.
 *
 * Darstellung als Monat + Jahr: der Tag suggeriert eine Genauigkeit, die eine
 * redaktionelle Inhaltsprüfung nicht hat, und lädt zu häufigem Nachpflegen ein.
 */

/** Deutsche Monatsnamen (Schweizer Schreibweise identisch). */
const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const ISO_DATE_PART = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formatiert ein echtes Prüfdatum als «Monat Jahr».
 *
 * Der Datumsanteil wird abgeschnitten statt umgerechnet — dieselbe Regel wie in
 * seoUtils.normalizeSchemaDate(). Damit ergibt derselbe Rohwert immer denselben
 * angezeigten Monat, egal in welcher Zeitzone Build oder Browser laufen.
 *
 * @param {unknown} value - z.B. '2026-08-15' oder ein ISO-Timestamp
 * @returns {string|null} z.B. 'August 2026', oder null wenn kein echtes Datum
 */
export function formatEditorialReviewMonth(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${MONTH_NAMES_DE[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const datePart = trimmed.slice(0, 10);
  const match = ISO_DATE_PART.exec(datePart);
  if (!match) return null;

  // Nach dem Datum darf nur eine Zeitangabe folgen ('T…' oder ' …').
  const rest = trimmed.slice(10);
  if (rest && !/^[T ]/.test(rest)) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Kalendarische Plausibilität (fängt '2026-02-31' und '2026-13-01' ab).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${MONTH_NAMES_DE[month - 1]} ${year}`;
}

/**
 * Wählt aus mehreren Prüfdaten das jüngste aus.
 *
 * Anwendungsfall: Eine Themenwelt-Landingpage hat selbst kein Prüfdatum —
 * theme_worlds führt keine Spalte last_reviewed_at, nur die Artikel
 * (theme_world_scenarios) tun das. Statt auf der Landingpage ein Datum zu
 * erfinden, wird das aktuellste Prüfdatum ihrer publizierten Artikel gezeigt.
 * Damit stammt auch die Landingpage-Angabe aus einer echten Datenquelle.
 *
 * Verglichen wird der reine Datumsanteil als Zeichenkette. Bei ISO-Datumsangaben
 * (JJJJ-MM-TT) ist die lexikografische Ordnung identisch zur chronologischen,
 * also braucht es keine Zeitzonen-Umrechnung. Ungültige und fehlende Werte
 * fallen heraus; bleibt nichts übrig, ist das Ergebnis null.
 *
 * @param {unknown} values - Liste möglicher Prüfdaten
 * @returns {string|null} jüngstes gültiges Datum als 'JJJJ-MM-TT', sonst null
 */
export function pickLatestReviewDate(values) {
  if (!Array.isArray(values)) return null;

  let latest = null;
  for (const value of values) {
    // formatEditorialReviewMonth() ist hier reiner Gültigkeitstest: Es liefert
    // nur für ein echtes Kalenderdatum einen Wert. So gilt für Einzel- und
    // Sammelangabe dieselbe Prüfregel.
    if (!formatEditorialReviewMonth(value)) continue;

    const datePart = value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).trim().slice(0, 10);

    if (latest === null || datePart > latest) latest = datePart;
  }

  return latest;
}

/**
 * Baut den vollständigen redaktionellen Hinweistext.
 *
 * Der allgemeine Orientierungssatz steht immer. Der Prüfsatz kommt nur dazu,
 * wenn ein echtes Prüfdatum vorliegt.
 *
 * @param {unknown} lastReviewedAt - scenario.lastReviewedAt (oder null)
 * @returns {string}
 */
export function buildEditorialReviewNotice(lastReviewedAt) {
  const orientation =
    'Die Inhalte dienen der Orientierung; massgeblich sind im Zweifel die Angaben '
    + 'der jeweiligen Anbieter und offiziellen Stellen.';

  const month = formatEditorialReviewMonth(lastReviewedAt);
  if (!month) return orientation;

  return `Zuletzt redaktionell geprüft: ${month}. ${orientation}`;
}
