/**
 * Basic-Lead-Faktor: der Ranking-Abschlag für Basic-Anbieter, die über die
 * kostenlose Sichtbarkeit bereits genügend qualifizierte Anfragen erhalten
 * haben.
 *
 * Berechnet wird der Faktor NICHT hier, sondern in der Datenbank
 * (recompute_basic_lead_ranking_factors, siehe
 * supabase/migrations/20260824_basic_lead_ranking_factor.sql). Er liegt als
 * profiles.basic_lead_ranking_factor bereit und wird in App.jsx zusammen mit
 * den übrigen Anbieterdaten in derselben Abfrage geladen. Die öffentlichen
 * Kurslisten brauchen dadurch keine einzige zusätzliche Leadabfrage — weder
 * pro Kurs noch pro Anbieter.
 *
 * Dieses Modul ist die eine Stelle, an der der Faktor aus einem Kurs gelesen
 * und auf einen Ranking-Score angewendet wird. Beide öffentlichen Rankingpfade
 * (Suche und ähnliche Kurse) greifen darauf zu.
 */

/**
 * Staffel. Muss mit basic_lead_ranking_factor_for() in SQL übereinstimmen —
 * die Datenbank ist die führende Quelle, diese Tabelle dient der Anzeige im
 * Admin-Panel und den Tests.
 *
 * Die Grenzen sind bewusst als "ab dieser Anzahl" formuliert:
 *   0–3 → 1.00 | 4–6 → 0.90 | 7–10 → 0.80 | ab 11 → 0.70
 */
export const BASIC_LEAD_FACTOR_STEPS = [
  { minLeads: 11, factor: 0.70 },
  { minLeads: 7, factor: 0.80 },
  { minLeads: 4, factor: 0.90 },
  { minLeads: 0, factor: 1.00 },
];

/** Kein Abschlag. */
export const NEUTRAL_FACTOR = 1.0;

/**
 * Faktor aus einer Anzahl qualifizierter Basic-Leads.
 *
 * Nur für Anzeige und Tests. Im Ranking wird der von der Datenbank berechnete
 * Wert verwendet, damit Frontend und Datenbank nicht auseinanderlaufen können.
 *
 * @param {number} qualifiedLeadCount
 * @returns {number}
 */
export function basicLeadFactorFor(qualifiedLeadCount) {
  const count = Number(qualifiedLeadCount);
  if (!Number.isFinite(count) || count < 0) return NEUTRAL_FACTOR;

  const step = BASIC_LEAD_FACTOR_STEPS.find((s) => count >= s.minLeads);
  return step ? step.factor : NEUTRAL_FACTOR;
}

/**
 * Liest den Faktor eines Kurses.
 *
 * Fällt auf 1.00 zurück, wenn der Wert fehlt, kein gültiger Zahlenwert ist oder
 * ausserhalb von (0, 1] liegt. Ein fehlender Wert darf niemals dazu führen,
 * dass ein Kurs bevorzugt oder ausgeblendet wird — im Zweifel kein Abschlag.
 *
 * @param {object} course
 * @returns {number} Faktor in (0, 1]
 */
export function getBasicLeadFactor(course) {
  const raw = course?.basic_lead_ranking_factor;
  if (raw === null || raw === undefined) return NEUTRAL_FACTOR;

  // Postgres NUMERIC kommt über PostgREST als String an.
  const factor = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1) return NEUTRAL_FACTOR;

  return factor;
}

/**
 * Wendet den Faktor auf einen bereits berechneten Ranking-Score an.
 *
 *     finaler Ranking-Score = bisheriger Ranking-Score × Basic-Lead-Faktor
 *
 * Der Abschlag verschiebt damit nur die Reihenfolge innerhalb der bereits
 * gefundenen Treffer. Er kann keinen Kurs aus der Ergebnismenge entfernen und
 * keinen fachlich oder regional unpassenden Kurs nach vorne holen: Die
 * Relevanzstufe wird vorher und unabhängig davon bestimmt und schlägt den
 * Sichtbarkeits-Score.
 *
 * @param {number} score
 * @param {object} course
 * @returns {number}
 */
export function applyBasicLeadFactor(score, course) {
  const base = Number(score);
  if (!Number.isFinite(base)) return 0;
  return base * getBasicLeadFactor(course);
}
