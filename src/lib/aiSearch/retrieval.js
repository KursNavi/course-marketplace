/**
 * Kandidatenzusammenführung des hybriden Abrufs — deterministische Referenz
 * des Vertrags, den die SQL-Funktionen ai_search_lexical/ai_search_semantic
 * erfüllen (dort per DISTINCT ON vor dem LIMIT).
 *
 * Invariante (Prüfbefund 4): Chunktreffer werden VOR jeder Begrenzung auf
 * Kursebene zusammengeführt (bester Chunk je Kurs). Ein Limit begrenzt
 * KURSE, nie Chunks — ein einzelner langer Kurs mit vielen Treffer-Chunks
 * darf anderen passenden Kursen keine Kandidatenplätze wegnehmen, und
 * Textlänge allein verschafft keinen Vorteil.
 */

/**
 * Führt Chunktreffer eines Abrufkanals zu Kurskandidaten zusammen und
 * begrenzt erst danach.
 *
 * @param {Array<{courseId: string|number, score: number, section?: string,
 *                chunkIndex?: number}>} chunkHits - score: höher = besser
 *   (bei Distanzen vorher negieren bzw. in Ähnlichkeit umrechnen)
 * @param {number} [limit] - maximale Anzahl KURSE (nicht Chunks)
 * @returns {Array<{courseId, score, section, chunkIndex, chunkMatches:number}>}
 *   absteigend nach bestem Chunk-Score, Tie-Break stabile Kurs-ID
 */
export function dedupeChunkHitsByCourse(chunkHits, limit = Infinity) {
  if (!Array.isArray(chunkHits)) return [];

  const best = new Map(); // courseId → bester Treffer + Zähler
  for (const hit of chunkHits) {
    if (!hit || hit.courseId === undefined || hit.courseId === null) continue;
    if (!Number.isFinite(hit.score)) continue;
    const key = String(hit.courseId);
    const current = best.get(key);
    if (!current) {
      best.set(key, { ...hit, chunkMatches: 1 });
    } else {
      current.chunkMatches += 1;
      // Nur der beste Chunk zählt für den Kurs-Score; weitere Treffer
      // desselben Kurses erhöhen den Score bewusst NICHT (Längenneutralität).
      if (hit.score > current.score) {
        best.set(key, { ...hit, chunkMatches: current.chunkMatches });
      }
    }
  }

  const courses = [...best.values()].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return String(a.courseId).localeCompare(String(b.courseId));
  });

  return Number.isFinite(limit) ? courses.slice(0, Math.max(0, limit)) : courses;
}

/**
 * Reciprocal Rank Fusion zweier (oder mehrerer) bereits je Kurs deduplizierter
 * Kandidatenlisten. Erwartet Listen absteigender Güte; k = 60 ist der übliche
 * RRF-Dämpfungswert.
 *
 * @param {Array<Array<{courseId: string|number}>>} rankedLists
 * @param {{k?: number, limit?: number}} [options]
 */
export function fuseRankedLists(rankedLists, options = {}) {
  const k = options.k ?? 60;
  const scores = new Map();
  for (const list of Array.isArray(rankedLists) ? rankedLists : []) {
    if (!Array.isArray(list)) continue;
    list.forEach((item, index) => {
      if (!item || item.courseId === undefined || item.courseId === null) return;
      const key = String(item.courseId);
      const entry = scores.get(key) ?? { courseId: item.courseId, rrf: 0 };
      entry.rrf += 1 / (k + index + 1);
      scores.set(key, entry);
    });
  }
  const fused = [...scores.values()].sort((a, b) => {
    if (a.rrf !== b.rrf) return b.rrf - a.rrf;
    return String(a.courseId).localeCompare(String(b.courseId));
  });
  return Number.isFinite(options.limit) ? fused.slice(0, Math.max(0, options.limit)) : fused;
}
