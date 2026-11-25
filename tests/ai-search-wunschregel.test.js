/**
 * Produktregel (bestätigt 23.11.2026): Optionale Wünsche (Ort, Zeit, Lernform)
 * beeinflussen die Reihenfolge, schliessen fachlich ausreichend passende Kurse
 * aber nicht aus. Zwingende Vorgaben bleiben Ausschlusskriterien. Die
 * Mindestpassung 70 gilt für die fachliche Eignung. Paketregeln erhalten
 * keinen zusätzlichen Einfluss.
 */

import { describe, it, expect, vi } from 'vitest';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { rankWithPaidPriority, wishAdjustment, WISH_ADJUST_MAX, MIN_SCORE } from '../src/lib/aiSearch/paidRanking.js';
import { validateRerankResponse } from '../src/lib/aiSearch/lunaAdapter.js';
import { createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { buildExplanation, offerFormOf } from '../src/lib/aiSearch/explanation.js';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

const NOW = new Date('2026-11-17T12:00:00Z');

function course(id, extra = {}) {
  return { id, status: 'published', title: `Fotokurs ${id}`, booking_type: 'lead', price: null, canton: 'Zürich', user_id: `u${id}`, is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'], ...extra };
}

function client(courses, profiles = []) {
  const chunks = courses.map((c) => ({ course_id: c.id, section: 'description', chunk_index: 0, text: 'Fotografie Grundlagen für Einsteiger' }));
  const ids = courses.map((c) => ({ id: c.id }));
  return createFakeSupabase((call) => {
    if (call.table === 'ai_search_config') return { data: { active_model_version: null }, error: null };
    if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: chunks.map((c) => ({ course_id: c.course_id })), error: null };
    if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
    if (call.table === 'ai_search_documents' && call.filters.some((f) => f[0] === 'textSearch')) return { data: [], error: null };
    if (call.table === 'ai_search_documents' && call.range) return { data: ids.map((r) => ({ course_id: r.id })), error: null };
    if (call.table === 'courses' && call.range) return { data: ids, error: null };
    if (call.table === 'courses') {
      const wanted = (filterValue(call, 'in', 'id') ?? []).map(String);
      return { data: courses.filter((c) => wanted.includes(String(c.id))), error: null };
    }
    if (call.table === 'ai_search_chunks') return { data: chunks, error: null };
    if (call.table === 'profiles') return { data: profiles, error: null };
    return { data: [], error: null };
  }).client;
}

/** Luna-Attrappe: fachlicher Score und Wunscherfüllung je Kurs vorgegeben. */
function luna(byId) {
  return {
    usage: {},
    embed: vi.fn(),
    rerank: vi.fn(async (q, cands) => ({
      sentIds: cands.map((c) => String(c.courseId)),
      accepted: cands.map((c) => {
        const v = byId[String(c.courseId)] ?? { score: 0, wishScore: 50 };
        return { courseId: String(c.courseId), score: v.score, wishScore: v.wishScore, explanation: v.score >= 70 ? 'Du lernst die Grundlagen der Fotografie.' : null, reasons: v.score >= 70 ? [{ field: 'description', quote: 'Fotografie Grundlagen' }] : [] };
      }),
      rejected: [],
    })),
  };
}

const models = (gateway) => ({ gateway, embeddingVersion: 'v1' });

describe('Optionaler Wunsch schliesst nicht aus, zwingende Vorgabe schon', () => {
  it('derselbe fachlich passende Kurs bleibt bei einem nicht erfüllten Ortswunsch zulässig', async () => {
    const courses = [course(1, { canton: 'Zürich' })];
    const gateway = luna({ 1: { score: 80, wishScore: 0 } }); // Wunsch „Bern“ belegt nicht erfüllt
    const ohne = await runAiSearch(client(courses), { query: 'Fotografie lernen', now: NOW, models: models(gateway) });
    const mitWunsch = await runAiSearch(client(courses), { query: 'Fotografie lernen, am liebsten in Bern', now: NOW, models: models(gateway) });
    expect(ohne.results.map((r) => r.courseId)).toEqual([1]);
    expect(mitWunsch.results.map((r) => r.courseId)).toEqual([1]);
    // Abweichung bleibt sichtbar.
    // Ort mit Kanton gekennzeichnet (Stabilisierung 23.11.2026).
    expect(mitWunsch.results[0].explanation).toMatch(/Abweichung vom Wunsch „Bern“: Ort ist Kanton Zürich\./);
  });

  it('eine zwingende Vorgabe (Kanton Bern) schliesst denselben Kurs aus', async () => {
    const gateway = luna({ 1: { score: 80, wishScore: 0 } });
    const result = await runAiSearch(client([course(1, { canton: 'Zürich' })]), { query: 'Fotografie lernen', musts: { canton: 'Bern', onlineAllowed: false }, now: NOW, models: models(gateway) });
    expect(result.results).toEqual([]);
    expect(result.incompleteResults).toEqual([]);
    expect(result.stats.excludedByMust).toBe(1);
  });

  it('fachlich unpassende Kurse werden auch bei voll erfüllten Wünschen nicht zugelassen', async () => {
    const gateway = luna({ 1: { score: 60, wishScore: 100 }, 2: { score: 69, wishScore: 100 } });
    const result = await runAiSearch(client([course(1, { canton: 'Bern' }), course(2, { canton: 'Bern' })]), { query: 'Fotografie lernen in Bern', now: NOW, models: models(gateway) });
    expect(result.results).toEqual([]);
    expect(result.stats.belowThreshold).toBe(2);
  });

  it('Wunscherfüllung beeinflusst die Reihenfolge innerhalb des fachlichen Bands', async () => {
    const gateway = luna({ 1: { score: 84, wishScore: 0 }, 2: { score: 83, wishScore: 100 } });
    const result = await runAiSearch(client([course(1), course(2)]), { query: 'Fotografie lernen in Bern', now: NOW, models: models(gateway) });
    expect(result.results.map((r) => r.courseId)).toEqual([2, 1]); // 83+2 vor 84−2
  });
});

describe('Begrenzter Wunschbeitrag; Paketregel unverändert', () => {
  it('wishScore → Ordnungsbeitrag −2 … +2, neutral bei fehlendem Wert', () => {
    expect([0, 25, 50, 75, 100].map(wishAdjustment)).toEqual([-2, -1, 0, 1, 2]);
    expect(wishAdjustment(undefined)).toBe(0);
    expect(WISH_ADJUST_MAX).toBe(2);
  });

  it('Wünsche heben keinen Kurs über eine Bandgrenze und keinen unter die Mindestpassung', () => {
    const ranked = rankWithPaidPriority([
      { courseId: 'a', score: 90, wishAdjust: -2 },
      { courseId: 'b', score: 89, wishAdjust: 2 },
      { courseId: 'c', score: 70, wishAdjust: -2 },
      { courseId: 'd', score: 69, wishAdjust: 2 },
    ]);
    expect(ranked.map((r) => r.courseId)).toEqual(['a', 'b', 'c']);
    expect(MIN_SCORE).toBe(70);
  });

  it('Paketbonus wirkt unverändert; Wünsche verschaffen ihm kein zusätzliches Gewicht', () => {
    const base = [
      { courseId: 'basic', score: 86, tier: 'basic' },
      { courseId: 'premium', score: 85, tier: 'premium' },
    ];
    // Ohne Wunschwerte: Premium +3 → 88 vor 86 (wie bisher).
    expect(rankWithPaidPriority(base).map((r) => r.courseId)).toEqual(['premium', 'basic']);
    const ranked = rankWithPaidPriority(base.map((c) => ({ ...c, wishAdjust: 0 })));
    expect(ranked.map((r) => [r.courseId, r.bonus])).toEqual([['premium', 3], ['basic', 0]]);
    // Gleiche Wunscherfüllung für beide: Reihenfolge und Bonus unverändert.
    expect(rankWithPaidPriority(base.map((c) => ({ ...c, wishAdjust: 2 }))).map((r) => [r.courseId, r.bonus, r.visibility])).toEqual([['premium', 3, 88], ['basic', 0, 86]]);
  });

  it('Luna-Antwort: wishScore wird begrenzt übernommen; fehlt er, ist er neutral', () => {
    const { accepted } = validateRerankResponse({ results: [
      { courseId: '1', score: 80, wishScore: 140, reasons: [] },
      { courseId: '2', score: 75, reasons: [] },
    ] }, ['1', '2']);
    expect(accepted.map((a) => a.wishScore)).toEqual([100, 50]);
  });

  it('Anweisung an Luna: score nur fachlich, Wünsche getrennt in wishScore', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', usage: {}, output_text: JSON.stringify({ results: [] }) }) }));
    await createOpenAiGateway({ region: 'global',  apiKey: 'k', fetchImpl }).rerank('Fotografie', [{ courseId: 1, evidence: { title: 'x' } }]);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.instructions).toMatch(/score bewertet ausschliesslich die fachliche Eignung/);
    expect(body.instructions).toMatch(/fliessen NICHT in score ein/);
    expect(body.instructions).toMatch(/wishScore \(0-100\)/);
    expect(body.text.format.schema.properties.results.items.required).toContain('wishScore');
  });
});

describe('Wesentliche Teilnahmebeschränkungen und Angebotsformen (Punkt 4)', () => {
  it('Stabilisierung: Luna schreibt keine Eignung; Beschränkungen setzt der Server aus dem Kurstext', async () => {
    // Ersetzt die frühere Anweisung an Luna, Beschränkungen selbst zu nennen.
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'completed', usage: {}, output_text: JSON.stringify({ results: [] }) }) }));
    await createOpenAiGateway({ region: 'global',  apiKey: 'k', fetchImpl }).rerank('Führung', [{ courseId: 1, evidence: { title: 'x' } }]);
    const { instructions } = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(instructions).toMatch(/genau EIN Satz/);
    expect(instructions).toMatch(/Keine Aussage dazu, ob oder warum der Kurs passt/);
    const text = buildExplanation({
      lead: 'Du lernst, Lernende in der Praxis zu führen und auszubilden.',
      description: 'Dieser Berufsbildner-Kurs richtet sich an Ärztinnen und Ärzte, die als Praxisbesitzer/innen Mitarbeitende führen und Lernende in der Praxis ausbilden.',
    });
    expect(text).toMatch(/Laut Kursbeschreibung: „richtet sich an Ärztinnen und Ärzte, die als…“\./);
  });

  it('Firmenangebot und Kindergeburtstag werden erkannt; allgemeine Kurse nicht', () => {
    expect(offerFormOf({ title: 'Hatha-Yoga für Firmen' })).toBe('company');
    expect(offerFormOf({ title: 'Malen für Gruppen und Firmen' })).toBe('company');
    expect(offerFormOf({ title: 'Teamevent in der Töpferwerkstatt' })).toBe('company');
    expect(offerFormOf({ kinder_kursart: 'kindergeburtstag', title: 'Slime Party' })).toBe('birthday');
    expect(offerFormOf({ title: 'Firmensprachkurse Aarau' })).toBeNull();
    expect(offerFormOf({ title: 'Malkurs', description: 'Auch für Firmen buchbar.' })).toBeNull();
  });

  it('Server ergänzt die Angebotsform, wenn der Text sie verschweigt (DE/FR/IT), sonst nicht doppelt', () => {
    const lead = 'Du lernst sanfte Yogaübungen und Atemtechniken.';
    expect(buildExplanation({ lead, offerForm: 'company' })).toMatch(/Angebotsform laut Kursangaben: Angebot für Firmen und Teams\./);
    expect(buildExplanation({ lead: 'Tu apprends le yoga doux.', offerForm: 'company', language: 'fr' })).toMatch(/Forme de l’offre selon les indications du cours : offre pour entreprises et équipes\./);
    expect(buildExplanation({ lead: 'Impari a dipingere.', offerForm: 'birthday', language: 'it' })).toMatch(/festa di compleanno per bambini/);
    // Stabilisierung: Ein Luna-Satz mit Zielgruppenaussage entfällt; der
    // Server-Hinweis steht dann genau einmal.
    expect(buildExplanation({ lead: 'Das Angebot richtet sich an Firmen und Teams.', offerForm: 'company' }).match(/Angebotsform laut Kursangaben/g)).toHaveLength(1);
  });

  it('Ende-zu-Ende: Firmenkurs-Karte nennt das Firmenformat', async () => {
    const gateway = luna({ 1: { score: 80, wishScore: 50 } });
    const result = await runAiSearch(client([course(1, { title: 'Hatha-Yoga für Firmen' })]), { query: 'Fotografie lernen', now: NOW, models: models(gateway) });
    // Seit 25.11.2026 mit der wörtlichen Zielgruppe aus dem Titel.
    expect(result.results[0].explanation).toMatch(/Angebot laut Kurstitel „für Firmen“\./);
  });
});
