/**
 * Adapter-Vertrag für OpenAI gpt-6-luna (Modellentscheidung, Nachtrag 08).
 *
 * Luna übernimmt Interpretation natürlicher Suchwünsche, fachliche Bewertung
 * bereitgestellter öffentlicher Kandidatenevidenz und belegte Begründungen.
 * Dieses Modul enthält NUR die lokal testbare Vertragslogik (Request-Aufbau
 * und strikte Antwortvalidierung) — KEINE Netzwerkaufrufe. Echte API-Aufrufe
 * setzen die separaten Gates voraus: API-Zugang, Ausgabenbudget, Betrieb.
 *
 * Sicherheitsinvarianten (02/04, Nachtrag 08):
 *  - Harte Kriterien, Veröffentlichung, Preis-/Eventwahrheit, Paid-Bonus und
 *    Login/Kontingent bleiben deterministisch serverseitig — Modelltext kann
 *    sie nicht übergehen.
 *  - Kurs-/Nutzertexte sind untrusted Daten: keine Tools, keine Geheimnisse,
 *    nur strukturierte Ausgabe.
 *  - Antworten werden gegen die ERLAUBTEN Kandidaten-IDs und Evidenzfelder
 *    validiert; unbekannte IDs, fremde Links und unbelegte Gründe werden
 *    verworfen bzw. als unklar markiert.
 */

export const LUNA_MODEL_ID = 'gpt-6-luna';

/** Felder, auf die sich eine Begründung beziehen darf (Datenvertrag §2). */
export const ALLOWED_EVIDENCE_FIELDS = Object.freeze([
  'title', 'description', 'objectives', 'prerequisites', 'keywords', 'free_reason',
  'level', 'languages', 'delivery_types', 'target_age_groups', 'min_age',
  'target_group', 'session_count', 'session_length', 'price_status', 'event',
  'category', 'location', 'provider_bio',
]);

/**
 * Baut den Bewertungs-Request: Kandidaten mit abgegrenzter öffentlicher
 * Evidenz, ohne Paket-/Lead-Daten. Rein deterministisch, für Mock-Tests.
 */
export function buildRerankRequest(query, candidates) {
  const safeCandidates = (Array.isArray(candidates) ? candidates : []).map((candidate) => ({
    courseId: String(candidate.courseId),
    evidence: Object.fromEntries(
      Object.entries(candidate.evidence ?? {})
        .filter(([field]) => ALLOWED_EVIDENCE_FIELDS.includes(field)),
    ),
  }));
  return {
    model: LUNA_MODEL_ID,
    // Nutzereingabe und Kursinhalte sind DATEN, keine Anweisungen:
    input: {
      task: 'rank_and_justify',
      query: String(query ?? ''),
      candidates: safeCandidates,
    },
    // Strukturierte Ausgabe erzwingen; keine Tools fuer den Reranker.
    responseFormat: 'json',
    tools: [],
  };
}

/**
 * Validiert eine (gemockte oder echte) Luna-Antwort strikt gegen die
 * erlaubten Kandidaten. Verwirft unbekannte IDs, fremde Links und Gründe
 * ohne zulässige Feldreferenz; Score wird auf 0–100 begrenzt.
 *
 * @param {unknown} response - geparstes JSON { results: [{courseId, score, reasons}] }
 * @param {Array<string|number>} allowedCourseIds
 * @returns {{accepted: Array<{courseId: string, score: number,
 *            reasons: Array<{field: string, quote: string|null}>}>,
 *            rejected: Array<{courseId?: string, reason: string}>}}
 */
export function validateRerankResponse(response, allowedCourseIds) {
  const allowed = new Set((allowedCourseIds ?? []).map(String));
  const accepted = [];
  const rejected = [];

  const results = response && typeof response === 'object' && Array.isArray(response.results)
    ? response.results
    : null;
  if (!results) {
    return { accepted, rejected: [{ reason: 'keine strukturierte results-Liste' }] };
  }

  const seen = new Set();
  for (const entry of results) {
    const courseId = entry && entry.courseId !== undefined ? String(entry.courseId) : null;
    if (!courseId || !allowed.has(courseId)) {
      rejected.push({ courseId: courseId ?? undefined, reason: 'unbekannte oder nicht erlaubte Kurs-ID' });
      continue;
    }
    if (seen.has(courseId)) {
      rejected.push({ courseId, reason: 'doppelter Kandidat' });
      continue;
    }
    const score = Number(entry.score);
    if (!Number.isFinite(score)) {
      rejected.push({ courseId, reason: 'fehlender oder ungültiger Score' });
      continue;
    }

    const reasons = [];
    for (const reason of Array.isArray(entry.reasons) ? entry.reasons : []) {
      const field = reason && typeof reason.field === 'string' ? reason.field : null;
      const quote = reason && typeof reason.quote === 'string' ? reason.quote : null;
      if (!field || !ALLOWED_EVIDENCE_FIELDS.includes(field)) {
        rejected.push({ courseId, reason: `Grund ohne zulässige Feldreferenz verworfen (${field ?? 'ohne Feld'})` });
        continue;
      }
      // Keine Links/Anweisungen aus Modelltext übernehmen:
      if (quote && /https?:\/\//i.test(quote)) {
        rejected.push({ courseId, reason: 'Grund mit Link verworfen' });
        continue;
      }
      reasons.push({ field, quote });
    }

    seen.add(courseId);
    accepted.push({
      courseId,
      score: Math.max(0, Math.min(100, score)),
      reasons,
    });
  }

  return { accepted, rejected };
}
