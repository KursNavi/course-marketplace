/**
 * Publikationsregel der KI-Suche (Datenvertrag §1).
 *
 * Öffentlich durchsuchbar ist ausschliesslich status === 'published'.
 *
 * Bewusst STRENGER als die klassische Anzeige (App.jsx behandelt auch
 * status == null als veröffentlicht): Die Legacy-NULL-Sonderbehandlung wird
 * erst übernommen, wenn am aktuellen Bestand nachgewiesen ist, dass solche
 * Datensätze existieren und öffentlich sein sollen. Bis dahin zählt die
 * Reconciliation NULL-Zeilen separat und alarmiert.
 *
 * Diese Regel wird auf JEDER Stufe durchgesetzt (Projektion, Index, Such-API,
 * Cache, Prüfung unmittelbar vor Ausgabe), weil die RLS der Kerntabellen seit
 * Migration 20260911120000 bewusst alle Zeilen lesbar macht (Direkt-URL-
 * Vorschau). Entwürfe dürfen weder in den Index noch in Modellkontexte.
 */

/**
 * @param {object} course
 * @param {{allowLegacyNullStatus?: boolean}} [options] - Legacy-NULL nur nach
 *   dokumentiertem Nachweis aktivieren (Datenvertrag §1), Default aus.
 * @returns {boolean}
 */
export function isPubliclySearchable(course, options = {}) {
  if (!course || typeof course !== 'object') return false;
  if (course.status === 'published') return true;
  if (course.status == null && options.allowLegacyNullStatus === true) return true;
  return false;
}

/**
 * Letzte Statusprüfung unmittelbar vor der Ausgabe: filtert eine Kandidaten-
 * liste gegen frisch geladene Quellzeilen. Kandidaten ohne frische Quellzeile
 * gelten als zurückgezogen und werden entfernt (Rücknahme-Vorrang).
 *
 * @param {Array<{course_id: number|string}>} candidates
 * @param {Map<string, object>|object} freshById - Map oder Objekt course_id → Kurszeile
 * @param {{allowLegacyNullStatus?: boolean}} [options]
 */
export function filterByFreshStatus(candidates, freshById, options = {}) {
  if (!Array.isArray(candidates)) return [];
  const lookup = freshById instanceof Map
    ? (id) => freshById.get(String(id))
    : (id) => (freshById ? freshById[String(id)] : undefined);
  return candidates.filter((candidate) => {
    const fresh = lookup(candidate?.course_id ?? candidate?.id);
    return isPubliclySearchable(fresh, options);
  });
}
