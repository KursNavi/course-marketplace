/**
 * Bezahlte Priorität in der KI-Trefferliste: Pilotregel (00/02/04, kalibrierbar).
 *
 * Dies ist eine NEUE, vor Liveaktivierung fachlich zu entscheidende Regel,
 * keine bestehende Paketzusage. Invarianten:
 *  - Muss-Kriterien, Öffentlichkeit und fachliche Mindestpassung (Score >= 70)
 *    zuerst; kein Bonus bringt einen ungeeigneten Kurs in die Auswahl.
 *  - Passungsbänder 90-100 / 80-89 / 70-79: kein kommerzieller Sprung in ein
 *    höheres Band.
 *  - Bonus nur innerhalb des Bands: Basic +0, Pro +2, Premium +3, Enterprise +3;
 *    berechtigtes Prio zusätzlich +2; kumuliert maximal +5.
 *  - Paketberechtigung kommt SERVERSEITIG aufgelöst herein (aktueller
 *    package_tier inkl. Ablauf/Downgrade und Prio-Kontingent aus
 *    profiles/provider_package_history) — nie allein aus einem alten
 *    Frontendflag. Diese Funktion vertraut dem Aufrufer, dass `tier` und
 *    `prioEligible` bereits autoritativ geprüft sind; abgelaufene Pakete
 *    müssen als 'basic' übergeben werden.
 *  - Der bestehende Basic-Lead-Abschlag, booking_factor und Rotation der
 *    klassischen Suche fliessen hier bewusst NICHT ein (kein doppelter
 *    Abschlag, keine implizite Übernahme).
 *  - Stabiler Tie-Break: fachlicher Score, dann Kurs-ID. Deterministisch für
 *    stabile Reihenfolge/Seitencursor pro Suchstand.
 */

export const MIN_SCORE = 70;

export const BANDS = Object.freeze([
  { min: 90, max: 100 },
  { min: 80, max: 89 },
  { min: 70, max: 79 },
]);

const TIER_BONUS = Object.freeze({
  basic: 0,
  pro: 2,
  premium: 3,
  enterprise: 3,
});

export const PRIO_BONUS = 2;
export const MAX_TOTAL_BONUS = 5;

export function bandOf(score) {
  for (let i = 0; i < BANDS.length; i += 1) {
    if (score >= BANDS[i].min && score <= BANDS[i].max) return i;
  }
  return -1; // unter Mindestpassung
}

/**
 * @param {string} tier - autoritativ aufgelöste aktuelle Paketstufe
 * @param {boolean} prioEligible - serverseitig geprüfte is_prio-Berechtigung
 *   (Flag gesetzt UND innerhalb des Paket-Prio-Kontingents UND Paket aktiv)
 */
export function paidBonus(tier, prioEligible) {
  const base = TIER_BONUS[tier] ?? 0;
  const total = base + (prioEligible ? PRIO_BONUS : 0);
  return Math.min(total, MAX_TOTAL_BONUS);
}

/**
 * Sortiert fachlich bewertete, Muss-bestätigte Kandidaten mit begrenztem
 * Paid-Einfluss. Kandidaten unter der Mindestpassung werden entfernt —
 * unabhängig vom Paket.
 *
 * @param {Array<{courseId: string|number, score: number, tier?: string,
 *                prioEligible?: boolean}>} candidates
 * @returns {Array<candidate & {band: number, bonus: number, visibility: number,
 *                              paidInfluence: boolean}>}
 *   paidInfluence kennzeichnet Treffer, deren Position ein Bonus beeinflussen
 *   kann (für die sichtbare Werbekennzeichnung in der UI).
 */
export function rankWithPaidPriority(candidates) {
  if (!Array.isArray(candidates)) return [];

  const eligible = candidates
    .filter((c) => Number.isFinite(c?.score) && c.score >= MIN_SCORE)
    .map((c) => {
      const bonus = paidBonus(c.tier ?? 'basic', c.prioEligible === true);
      return {
        ...c,
        band: bandOf(c.score),
        bonus,
        visibility: c.score + bonus,
        paidInfluence: bonus > 0,
      };
    });

  return eligible.sort((a, b) => {
    // Höheres Band zuerst; Bonus kann die Bandgrenze nie überschreiten,
    // weil die Bänder direkt aus dem fachlichen Score bestimmt werden.
    if (a.band !== b.band) return a.band - b.band;
    if (a.visibility !== b.visibility) return b.visibility - a.visibility;
    // Gleichstand: fachlicher Score, dann stabile Kurs-ID.
    if (a.score !== b.score) return b.score - a.score;
    return String(a.courseId).localeCompare(String(b.courseId));
  });
}
