/**
 * Folgeschritt Stabilisierung (23.11.2026), lokal:
 *  1. Luna-Inhaltssatz: behauptete Eigenschaften brauchen einen Beleg.
 *  2. Zweite Score-Stichprobe PARALLEL (kein zusätzlicher sequenzieller
 *     Aufruf), Mittelwert statt Einzelwert, Mindestpassung unverändert.
 *  3. Abruf: Bedeutungssuche wahlweise mit dem fachlichen Anliegen; beide
 *     Varianten im Prüfbericht. Datenbankentwurf nur als Entwurf.
 */

import { describe, it, expect, vi } from 'vitest';
import { contentSentence, unbackedProperty, buildExplanation } from '../src/lib/aiSearch/explanation.js';
import { combineScoreSamples, createOpenAiGateway, readModelConfig } from '../src/lib/aiSearch/openaiGateway.js';
import { rankWithPaidPriority, MIN_SCORE } from '../src/lib/aiSearch/paidRanking.js';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { composeDraftTest } from '../scripts/ai-search-draft-sql-test.mjs';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

describe('1. Inhaltssatz ohne unbelegte Eigenschaften', () => {
  it('verwirft eine Eigenschaft, die die Kursangaben nicht tragen', () => {
    const evidence = 'Robotik mit LEGO Education. Kinder bauen und programmieren Roboter.';
    expect(unbackedProperty('Du baust in kleinen Gruppen Roboter.', evidence)).toBe('kleingruppe');
    expect(unbackedProperty('Du übst in einem Ferienkurs das Programmieren.', evidence)).toBe('ferien');
    expect(unbackedProperty('Du lernst online, Roboter zu steuern.', evidence)).toBe('online');
    expect(contentSentence('Du baust in kleinen Gruppen Roboter und programmierst Sensoren.', evidence)).toBeNull();
  });

  it('lässt dieselbe Eigenschaft stehen, wenn die Kursangaben sie belegen', () => {
    const evidence = 'Interaktive Kurse in kleinen Gruppen mit Outdoor-Aktivitäten; Online live via Zoom.';
    expect(unbackedProperty('Du übst Englisch in kleinen Gruppen und draussen.', evidence)).toBeNull();
    expect(contentSentence('Du übst Englisch in kleinen Gruppen mit Aktivitäten im Freien.', evidence)).not.toBeNull();
  });

  it('Begründung: unbelegter Inhaltssatz entfällt, die belegten Zitatsätze bleiben', () => {
    const text = buildExplanation({
      lead: 'Du übst täglich Schwimmtechnik im Ferienlager.',
      reasons: [{ kind: 'luna', section: 'description', quote: 'Schwimmtechnik für Kinder' }],
      evidenceText: 'Schwimmtechnik für Kinder, wöchentlich im Hallenbad.',
    });
    expect(text).toBe('In der Beschreibung steht: „Schwimmtechnik für Kinder“.');
  });
});

describe('2. Zweite Score-Stichprobe', () => {
  it('Mittelwert, nie der höhere Wert; ohne zweite Stichprobe bleibt die erste', () => {
    const accepted = [
      { courseId: '1', score: 82, wishScore: 40, reasons: [] },
      { courseId: '2', score: 88, wishScore: 50, reasons: [] },
      { courseId: '3', score: 75, wishScore: 50, reasons: [] },
    ];
    const second = new Map([['1', { courseId: '1', score: 55, wishScore: 60 }], ['2', { courseId: '2', score: 55, wishScore: 50 }]]);
    const out = combineScoreSamples(accepted, second);
    expect(out.map((e) => e.score)).toEqual([69, 72, 75]); // 82/55 → 68.5 → 69 (unter 70), 88/55 → 71.5 → 72
    expect(out.map((e) => e.scoreSamples)).toEqual([[82, 55], [88, 55], [75]]);
    expect(out[0].wishScore).toBe(50);
    expect(MIN_SCORE).toBe(70);
  });

  it('Paketregeln: gleiche Stichproben ergeben unabhängig vom Paket denselben Endwert und dieselbe Zulassung', () => {
    // Die Zusammenführung kennt kein Paket: gleiche Stichproben → gleicher Endwert.
    const base = combineScoreSamples([{ courseId: 'a', score: 60, wishScore: 50 }, { courseId: 'b', score: 60, wishScore: 50 }], new Map([['a', { score: 80, wishScore: 50 }], ['b', { score: 80, wishScore: 50 }]]));
    expect(base.map((e) => e.score)).toEqual([70, 70]);
    // Zulassung (≥ 70) für beide gleich; das Paket wirkt danach nur wie bisher innerhalb des Bands.
    const ranked = rankWithPaidPriority([
      { courseId: 'a', score: base[0].score, wishAdjust: 0, tier: 'basic', prioEligible: false },
      { courseId: 'b', score: base[1].score, wishAdjust: 0, tier: 'premium', prioEligible: true },
    ]);
    expect(ranked.map((r) => r.courseId).sort()).toEqual(['a', 'b']);
    const below = rankWithPaidPriority([{ courseId: 'c', score: 69, wishAdjust: 0, tier: 'premium', prioEligible: true }]);
    expect(below).toEqual([]);
  });

  function deferredFetch() {
    const calls = [];
    const fetchImpl = vi.fn((url, init) => new Promise((resolve) => {
      const body = JSON.parse(init.body);
      const input = JSON.parse(body.input);
      calls.push({ body, input, resolve });
    }));
    return { fetchImpl, calls };
  }
  const answer = (stage, ids, scoreOf) => ({
    ok: true,
    json: async () => ({ status: 'completed', usage: { input_tokens: 10, output_tokens: 5 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify({ results: ids.map((id) => (stage === 'rank'
      ? { courseId: id, score: scoreOf(id), wishScore: 50, explanation: '', reasons: [] }
      : { courseId: id, score: scoreOf(id) + 10, wishScore: 50 })) }) }] }] }),
  });

  it('startet beide Stichproben GLEICHZEITIG, mit anderer Zusammensetzung der Teilaufrufe', async () => {
    const { fetchImpl, calls } = deferredFetch();
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl, batchSize: 2, distribution: 'stripe', scoreSamples: 2 });
    const candidates = ['1', '2', '3', '4'].map((id) => ({ courseId: id, evidence: { title: `Kurs ${id}` } }));
    const pending = gateway.rerank('Fotografie', candidates, { language: 'de' });
    await new Promise((r) => setTimeout(r, 0));
    // Alle vier Teilaufrufe (2 rank + 2 sample) sind gestellt, bevor einer antwortet.
    expect(calls).toHaveLength(4);
    const groups = (stageTask) => calls.filter((c) => (stageTask === 'sample' ? /keine Begründung/.test(c.body.instructions) : !/keine Begründung/.test(c.body.instructions)))
      .map((c) => c.input.candidates.map((x) => x.courseId).sort().join(','));
    expect(groups('rank').sort()).toEqual(['1,3', '2,4']); // stripe
    expect(groups('sample').sort()).toEqual(['1,2', '3,4']); // block: andere Nachbarn
    for (const c of calls) {
      const ids = c.input.candidates.map((x) => x.courseId);
      c.resolve(answer(/keine Begründung/.test(c.body.instructions) ? 'sample' : 'rank', ids, () => 60));
    }
    const result = await pending;
    expect(result.accepted.map((a) => [a.courseId, a.score, a.scoreSamples])).toEqual([
      ['1', 65, [60, 70]], ['3', 65, [60, 70]], ['2', 65, [60, 70]], ['4', 65, [60, 70]],
    ]);
  });

  it('fällt die zweite Stichprobe aus, gilt die erste unverändert (keine Wiederholung)', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      const ids = JSON.parse(body.input).candidates.map((x) => x.courseId);
      if (/keine Begründung/.test(body.instructions)) return { ok: false, status: 500, json: async () => ({}) };
      return answer('rank', ids, () => 72);
    });
    const gateway = createOpenAiGateway({ apiKey: 'k', fetchImpl, batchSize: 5, scoreSamples: 2 });
    const result = await gateway.rerank('Yoga', [{ courseId: 1, evidence: { title: 'Yoga' } }], {});
    expect(result.accepted[0]).toMatchObject({ score: 72, scoreSamples: [72] });
    expect(gateway.usage.lunaSampleFailures).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('Standard ist eine Stichprobe; zwei nur auf ausdrückliche Einstellung', () => {
    expect(readModelConfig({}).lunaScoreSamples).toBe(1);
    expect(readModelConfig({ AI_SEARCH_LUNA_SCORE_SAMPLES: '2' }).lunaScoreSamples).toBe(2);
    expect(readModelConfig({ AI_SEARCH_LUNA_SCORE_SAMPLES: '3' }).lunaScoreSamples).toBe(1);
    expect(readModelConfig({}).semanticQuery).toBe('full');
    expect(readModelConfig({ AI_SEARCH_SEMANTIC_QUERY: 'topic' }).semanticQuery).toBe('topic');
  });
});

describe('3. Bedeutungssuche: ganze Anfrage oder fachliches Anliegen', () => {
  function client(semanticByCall) {
    const courses = [1, 2, 3].map((id) => ({ id, status: 'published', title: `Fotokurs ${id}`, booking_type: 'lead', price: null, canton: 'Zürich', user_id: `u${id}`, is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'] }));
    let semanticCall = 0;
    return createFakeSupabase((call) => {
      if (call.table === 'ai_search_config') return { data: { active_model_version: 'v1' }, error: null };
      if (call.op === 'rpc' && call.table === 'ai_search_semantic') return { data: semanticByCall[semanticCall++].map((id) => ({ course_id: id })), error: null };
      if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: [], error: null };
      if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
      if (call.table === 'ai_search_documents' && call.filters.some((f) => f[0] === 'textSearch')) return { data: [], error: null };
      if (call.table === 'ai_search_documents' && call.range) return { data: courses.map((c) => ({ course_id: c.id })), error: null };
      if (call.table === 'courses' && call.range) return { data: courses.map((c) => ({ id: c.id })), error: null };
      if (call.table === 'courses') {
        const wanted = (filterValue(call, 'in', 'id') ?? []).map(String);
        return { data: courses.filter((c) => wanted.includes(String(c.id))), error: null };
      }
      return { data: [], error: null };
    }).client;
  }
  const gatewayWith = () => ({
    usage: {},
    embed: vi.fn(async (texts) => (Array.isArray(texts) ? texts : [texts]).map(() => new Array(1024).fill(0))),
    rerank: vi.fn(async (q, cands) => ({ sentIds: cands.map((c) => String(c.courseId)), accepted: cands.map((c) => ({ courseId: String(c.courseId), score: 80, wishScore: 50, explanation: null, reasons: [] })), rejected: [] })),
  });

  it('im Prüfbericht EIN Embedding-Aufruf mit beiden Texten; Ränge beider Varianten festgehalten', async () => {
    const gateway = gatewayWith();
    const result = await runAiSearch(client([[3, 2, 1], [1, 2, 3]]), {
      query: 'Ich will nach der Arbeit besser fotografieren lernen, am liebsten in Bern', now: new Date('2026-11-23T12:00:00Z'),
      models: { gateway, embeddingVersion: 'v1', semanticQuery: 'topic' }, diagnostics: true,
    });
    expect(gateway.embed).toHaveBeenCalledTimes(1);
    expect(gateway.embed.mock.calls[0][0]).toEqual(['Ich will nach der Arbeit besser fotografieren lernen, am liebsten in Bern', 'Ich will besser fotografieren lernen']);
    expect(result.diagnostics.semanticQueryUsed).toBe('topic');
    expect(result.diagnostics.semanticTop).toEqual({ full: ['3', '2', '1'], topic: ['1', '2', '3'] });
    const c1 = result.diagnostics.candidates.find((c) => c.courseId === '1');
    expect(c1).toMatchObject({ semanticRankFull: 3, semanticRankTopic: 1, semanticRank: 1 });
  });

  it('ohne Prüfbericht nur der gewählte Text; Standard ist die ganze Anfrage', async () => {
    const gateway = gatewayWith();
    await runAiSearch(client([[1, 2, 3]]), { query: 'Fotografie lernen, am liebsten in Bern', now: new Date('2026-11-23T12:00:00Z'), models: { gateway, embeddingVersion: 'v1' } });
    expect(gateway.embed.mock.calls[0][0]).toEqual(['Fotografie lernen, am liebsten in Bern']);
  });
});

describe('4. Vorab festgelegte Probenauswahl', () => {
  it('genau die 8 festgelegten Fälle, Probeneinstellungen Pflicht, Grenze USD 0.10', async () => {
    const { readFileSync } = await import('node:fs');
    const run = await import('../scripts/ai-search-quality-run.mjs');
    const spec = JSON.parse(readFileSync('tests/fixtures/ai-search-quality/proben-20261124.json', 'utf8'));
    const all = spec.cases.map((c) => ({ id: c.id })).concat([{ id: 'q-null-001' }]);
    const env = { AI_SEARCH_LUNA_SCORE_SAMPLES: '2', AI_SEARCH_SEMANTIC_QUERY: 'topic' };
    const ok = run.selectProbeCases(all, spec, env);
    expect(ok.errors).toEqual([]);
    expect(ok.cases.map((c) => c.id)).toEqual(['de-privat-002', 'q-fr-001', 'de-kinder-002', 'de-beruf-002', 'q-fr-002', 'de-beruf-001', 'q-muss-001', 'de-beruf-003']);
    expect(run.selectProbeCases(all, spec, {}).errors.join(' ')).toMatch(/AI_SEARCH_LUNA_SCORE_SAMPLES=2 fehlt/);
    // Jede Kategorie der Freigabe ist vertreten.
    const cats = new Set(spec.cases.flatMap((c) => c.kategorien));
    expect([...cats].sort()).toEqual(['falsche Eignung', 'fehlender Abruf', 'schwankende Scores', 'unbelegte Begründungen']);
    const confirm = { AI_QUALITY_CONFIRM: 'omoapbvfligjfznzivyu' };
    expect(run.checkRunArgs(['--execute', '--probe', '--max-usd=0.09'], confirm).errors).toEqual([]);
    expect(run.checkRunArgs(['--execute', '--probe', '--max-usd=0.2'], confirm).errors.join(' ')).toMatch(/Probengrenze/);
  });
});

describe('3. Datenbankentwurf (nur Entwurf)', () => {
  it('Rollback-Test lässt sich zusammensetzen; Entwurf liegt nicht unter supabase/migrations', () => {
    const { sql, migration, rollback } = composeDraftTest(undefined, 'lexical_prefix');
    expect(migration.length).toBeGreaterThanOrEqual(4);
    expect(rollback).toHaveLength(2);
    expect(sql).not.toContain('@@MIGRATION@@');
    expect(sql).toContain('AI_DRAFT_TEST_OK');
  });
});
