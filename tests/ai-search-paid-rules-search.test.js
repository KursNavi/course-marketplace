/**
 * Paketregeln im Suchablauf mit künstlichen Testfällen (Entscheidung
 * 22.11.2026): Der Abnahmebestand setzt alle Anbieter auf basic; die
 * bezahlte Priorität wird hier separat und vollständig synthetisch geprüft.
 */

import { describe, it, expect } from 'vitest';
import { runAiSearch } from '../src/lib/aiSearch/searchService.js';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

const NOW = new Date('2026-11-17T12:00:00Z');
const TEXT = 'Malen mit Aquarell und Acryl.';

function course(id, overrides = {}) {
  return {
    id, status: 'published', title: 'Malen', booking_type: 'platform', price: 100, canton: 'Zürich',
    user_id: `u${id}`, is_prio: false,
    course_events: [{ id: id * 10, start_date: '2026-12-05', canton: 'Zürich', location: 'Zürich', cancelled_at: null }],
    course_locations: [],
    ...overrides,
  };
}

function scenario(courses, profiles) {
  const chunks = courses.map((c) => ({ course_id: c.id, section: 'description', chunk_index: 0, text: TEXT }));
  const ids = courses.map((c) => ({ id: c.id }));
  return (call) => {
    if (call.op === 'rpc' && call.table === 'ai_search_lexical') return { data: chunks.map((c) => ({ course_id: c.course_id })), error: null };
    if (call.table === 'ai_search_jobs' && call.head) return { data: null, error: null, count: 0 };
    if (call.table === 'ai_search_documents' && call.range) return { data: ids.map((r) => ({ course_id: r.id })), error: null };
    if (call.table === 'ai_search_documents') return { data: [], error: null };
    if (call.table === 'courses' && call.range) return { data: ids, error: null };
    if (call.table === 'courses') {
      const wanted = (filterValue(call, 'in', 'id') ?? []).map(String);
      return { data: courses.filter((c) => wanted.includes(String(c.id))), error: null };
    }
    if (call.table === 'ai_search_chunks') return { data: chunks, error: null };
    if (call.table === 'profiles') return { data: profiles, error: null };
    if (call.table === 'v_course_full_categories') return { data: [], error: null };
    return { data: null, error: null };
  };
}

async function order(courses, profiles) {
  const { client } = createFakeSupabase(scenario(courses, profiles));
  const result = await runAiSearch(client, { query: 'Malen Aquarell', now: NOW });
  return result.results.map((r) => r.courseId);
}

describe('Paketregeln im Suchablauf (künstliche Fälle)', () => {
  it('Abnahmebestand: alle basic → reine Fachrangfolge, Prio-Flag wirkungslos', async () => {
    const courses = [course(3, { is_prio: true }), course(1), course(2, { is_prio: true })];
    const profiles = courses.map((c) => ({ id: c.user_id, package_tier: 'basic', package_expires_at: null }));
    expect(await order(courses, profiles)).toEqual([1, 2, 3]);
  });

  it('Premium mit Prio überholt gleich passenden Basic-Kurs innerhalb des Bands', async () => {
    const courses = [course(1), course(2, { is_prio: true })];
    const profiles = [
      { id: 'u1', package_tier: 'basic', package_expires_at: null },
      { id: 'u2', package_tier: 'premium', package_expires_at: null },
    ];
    expect(await order(courses, profiles)).toEqual([2, 1]);
  });

  it('abgelaufenes Premium-Paket wirkt wie basic, auch mit Prio-Flag', async () => {
    const courses = [course(1), course(2, { is_prio: true })];
    const profiles = [
      { id: 'u1', package_tier: 'basic', package_expires_at: null },
      { id: 'u2', package_tier: 'premium', package_expires_at: '2026-11-01T00:00:00Z' },
    ];
    expect(await order(courses, profiles)).toEqual([1, 2]);
  });

  it('Pro ohne Prio vor Basic; unbekannte Stufe und fehlendes Profil wie basic', async () => {
    const courses = [course(1), course(2), course(3), course(4)];
    const profiles = [
      { id: 'u1', package_tier: 'gold', package_expires_at: null },
      { id: 'u3', package_tier: 'pro', package_expires_at: null },
      { id: 'u4', package_tier: 'basic', package_expires_at: null },
    ];
    expect(await order(courses, profiles)).toEqual([3, 1, 2, 4]);
  });
});
