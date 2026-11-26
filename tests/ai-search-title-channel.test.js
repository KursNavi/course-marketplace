/**
 * Regression (Abnahme 22.11.2026): Der Titel-Kanal lieferte bis zu 100
 * Treffer ohne Relevanzsortierung; limit(100) schnitt vor jeder Sortierung ab,
 * und die Fusion behandelte die beliebige Reihenfolge als Rang.
 * Nachgestellt: „Yoga oder Pilates für Anfänger“ → zuerst Matcha-Bowl,
 * Origami, Mal-Retreat; Fotografie-Grundkurs fiel von Rang 7 auf 59.
 */

import { describe, it, expect } from 'vitest';
import { rankTitleMatches, lexicalDocumentChannel, runAiSearch, CANDIDATE_LIMIT, TITLE_CHANNEL_MAX_ROWS } from '../src/lib/aiSearch/searchService.js';
import { fuseRankedLists } from '../src/lib/aiSearch/retrieval.js';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

const NOW = new Date('2026-11-17T12:00:00Z');

function titleScenario(documentRows) {
  // Antwortet seitenweise in course_id-Reihenfolge, wie PostgREST mit order+range.
  return (call) => {
    if (call.table === 'ai_search_documents' && call.filters.some((f) => f[0] === 'textSearch')) {
      const sorted = [...documentRows].sort((a, b) => a.course_id - b.course_id);
      const [from, to] = call.range ?? [0, sorted.length - 1];
      return { data: sorted.slice(from, to + 1), error: null };
    }
    return { data: [], error: null };
  };
}

describe('Titel-Kanal: Relevanzsortierung', () => {
  it('sortiert nach Titeltreffern, dann Fundstelle, dann Kurs-ID; ohne Titeltreffer kein Eintrag', () => {
    const rows = [
      { course_id: 466, title: 'Matcha Bowl modellieren' },
      { course_id: 688, title: 'Origami und Papierkunst' },
      { course_id: 751, title: 'Yoga, Klang und Achtsamkeitsworkshops' },
      { course_id: 258, title: 'Yoga & Pilates-Gruppenkurse' },
      { course_id: 397, title: 'Pilates' },
    ];
    const ranked = rankTitleMatches(rows, ['yoga', 'pilates', 'anfänger']);
    // 258: 2 Treffer; 397 und 751: je 1 Treffer an Position 0 → Kurs-ID entscheidet.
    expect(ranked.map((r) => r.courseId)).toEqual([258, 397, 751]);
    expect(ranked.map((r) => r.titleHits)).toEqual([2, 1, 1]);
  });

  it('ist bei gleichem Bestand unabhängig von der Lieferreihenfolge (reproduzierbar)', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ course_id: 1000 + i, title: i % 3 === 0 ? `Fotografie Kurs ${i}` : `Malen ${i}` }));
    const a = rankTitleMatches(rows, ['fotografieren']).map((r) => r.courseId);
    const b = rankTitleMatches([...rows].reverse(), ['fotografieren']).map((r) => r.courseId);
    const c = rankTitleMatches([...rows].sort(() => 0.5 - Math.random()), ['fotografieren']).map((r) => r.courseId);
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(a[0]).toBe(1000);
  });

  it('Wortstamm: „fotografieren“ findet „Fotografie Grundlagen“', () => {
    expect(rankTitleMatches([{ course_id: 798, title: 'Fotografie Grundlagen' }], ['fotografieren'])).toHaveLength(1);
  });

  it('Begrenzung erst nach der Sortierung: ein relevanter Kurs hinter 100 unsortierten Treffern bleibt erhalten', async () => {
    const rows = [
      ...Array.from({ length: 1500 }, (_, i) => ({ course_id: 1 + i, title: `Workshop ${i}` })), // nur Beschreibungstreffer
      { course_id: 20798, title: 'Fotografie Grundlagen' },
    ];
    const { client, calls } = createFakeSupabase(titleScenario(rows));
    const meta = {};
    const list = await lexicalDocumentChannel(client, 'arbeit or fotografieren', ['arbeit', 'fotografieren'], meta);
    expect(list.map((r) => r.courseId)).toEqual([20798]);
    expect(meta).toEqual({ matched: 1501, withTitleHits: 1, truncated: false });
    const queries = calls.filter((c) => c.table === 'ai_search_documents');
    expect(queries.length).toBe(2); // 2 Seiten à 1000
    for (const q of queries) {
      expect(q.order).toEqual([['course_id', { ascending: true }]]);
      expect(q.limit).toBeUndefined();
      expect(q.range).toBeDefined();
    }
  });

  it('meldet eine Kappung, statt still abzuschneiden', async () => {
    const rows = Array.from({ length: TITLE_CHANNEL_MAX_ROWS + 10 }, (_, i) => ({ course_id: i + 1, title: 'Yoga' }));
    const meta = {};
    const list = await lexicalDocumentChannel(createFakeSupabase(titleScenario(rows)).client, 'yoga', ['yoga'], meta);
    expect(meta.truncated).toBe(true);
    expect(list).toHaveLength(CANDIDATE_LIMIT);
  });
});

describe('Zusammenführung der Kanäle (RRF)', () => {
  it('beliebige Titel-Reihenfolge darf einen gut platzierten Abschnittstreffer nicht verdrängen', () => {
    // Nachstellung des Befunds: Abschnitts-Kanal hat den Soll-Kurs auf Rang 7.
    const chunk = Array.from({ length: 30 }, (_, i) => ({ courseId: 100 + i }));
    chunk.splice(6, 0, { courseId: 20798 });
    // Alt: 100 Titeltreffer in beliebiger Reihenfolge, der Soll-Kurs nicht dabei.
    const oldTitle = Array.from({ length: 100 }, (_, i) => ({ courseId: 500 + i }));
    const oldRank = fuseRankedLists([chunk, oldTitle], { limit: 200 }).findIndex((c) => String(c.courseId) === '20798') + 1;
    // Neu: nur Kurse mit Titeltreffer, nach Relevanz; der Soll-Kurs vorne.
    const newTitle = [{ courseId: 20798 }];
    const newRank = fuseRankedLists([chunk, newTitle], { limit: 200 }).findIndex((c) => String(c.courseId) === '20798') + 1;
    expect(oldRank).toBeGreaterThan(7);
    expect(newRank).toBe(1);
  });

  it('Ende-zu-Ende: Titel-Kanal ohne Fremdkurse; Diagnose zeigt Ränge je Kanal und Fusionsrang', async () => {
    const courses = [
      { id: 20751, title: 'Yoga, Klang und Achtsamkeitsworkshops', canton: 'Bern' },
      { id: 20466, title: 'Matcha Bowl modellieren', canton: 'Basel-Stadt' },
      { id: 20258, title: 'Yoga & Pilates-Gruppenkurse', canton: 'Zürich' },
    ].map((c) => ({ ...c, status: 'published', booking_type: 'lead', price: null, user_id: `u${c.id}`, is_prio: false, course_events: [], course_locations: [], delivery_types: ['presence'] }));
    const chunks = [
      { course_id: 20258, section: 'description', chunk_index: 0, text: 'Yoga und Pilates für Anfänger' },
      { course_id: 20751, section: 'description', chunk_index: 0, text: 'Yoga für Anfängerinnen und Anfänger' },
      { course_id: 20466, section: 'description', chunk_index: 0, text: 'Eine Schale für Anfänger formen' },
    ];
    const ids = courses.map((c) => ({ id: c.id }));
    const { client } = createFakeSupabase((call) => {
      if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: [{ course_id: 20258 }, { course_id: 20466 }, { course_id: 20751 }], error: null };
      if (call.table === 'ai_search_documents' && call.filters.some((f) => f[0] === 'textSearch')) {
        return { data: courses.map((c) => ({ course_id: c.id, title: c.title })).sort((a, b) => a.course_id - b.course_id), error: null };
      }
      if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
      if (call.table === 'ai_search_documents' && call.range) return { data: ids.map((r) => ({ course_id: r.id })), error: null };
      if (call.table === 'courses' && call.range) return { data: ids, error: null };
      if (call.table === 'courses') {
        const wanted = (filterValue(call, 'in', 'id') ?? []).map(String);
        return { data: courses.filter((c) => wanted.includes(String(c.id))), error: null };
      }
      if (call.table === 'ai_search_chunks') return { data: chunks, error: null };
      if (call.table === 'v_course_full_categories') return { data: [], error: null };
      return { data: [], error: null };
    });
    const result = await runAiSearch(client, { query: 'Yoga oder Pilates für Anfänger', now: NOW, diagnostics: true });
    const byId = Object.fromEntries(result.diagnostics.candidates.map((c) => [c.courseId, c]));
    expect(byId['20466'].lexicalDocumentRank).toBeNull(); // Matcha: kein Titeltreffer → nicht im Titel-Kanal
    expect(byId['20258'].lexicalDocumentRank).toBe(1);
    expect(byId['20751'].lexicalDocumentRank).toBe(2);
    expect(byId['20258'].fusedRank).toBe(1);
    expect(byId['20751'].fusedRank).toBeLessThan(byId['20466'].fusedRank);
    expect(result.diagnostics.titleChannel).toEqual({ matched: 3, withTitleHits: 2, truncated: false });
  });
});
