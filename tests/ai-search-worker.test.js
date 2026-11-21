/**
 * Outbox-Worker (S02): Koaleszenz, Uebergabe an die atomaren
 * Datenbankfunktionen (ai_search_apply_upsert/_delete), Ergebniszuordnung,
 * Fehlerpfad mit attempts/failed und Zeitbudget des Drains.
 *
 * Die Versions-/Tombstone-/Reparatursemantik selbst liegt in SQL (Migration
 * 20261115200229) und wird durch echte DB-Tests abgedeckt
 * (scripts/ai-search-db-tests.mjs, Abschnitt 9).
 */

import { describe, it, expect } from 'vitest';
import {
  coalesceJobs,
  processOutboxBatch,
  drainOutbox,
  DEFAULT_MAX_ATTEMPTS,
} from '../src/lib/aiSearch/worker.js';
import { createFakeSupabase, filterValue, findCall } from './helpers/fakeSupabase.js';

const publishedCourse = (overrides = {}) => ({
  id: 42,
  status: 'published',
  title: 'Yoga für Anfänger',
  description: 'Sanfter Einstieg in Zürich.',
  booking_type: 'lead',
  price: 0,
  language: 'DE',
  canton: 'ZH',
  user_id: 'user-1',
  course_events: [],
  course_locations: [{ city: 'Zürich', canton: 'ZH', location_type: 'presence' }],
  ...overrides,
});

const profileRow = { slug: 'studio-zh', city: 'Zürich', canton: 'ZH', verification_status: 'verified', bio_text: 'Seit 2010.' };

const job = (overrides = {}) => ({
  id: 1, course_id: 42, reason: 'course_upsert', priority: 5, source_version: 7, attempts: 0, ...overrides,
});

/** Standard-Antworten; einzelne Faelle ueberschreiben gezielt. */
function makeRespond({ jobs, course, upsertOutcome = 'inserted', overrides = {} }) {
  return (call) => {
    const key = call.op === 'rpc' ? `rpc:${call.table}` : `${call.table}:${call.op}`;
    if (overrides[key]) {
      const result = overrides[key](call);
      if (result !== undefined) return result;
    }
    if (key === 'ai_search_jobs:select') return { data: jobs, error: null };
    if (key === 'courses:select') return { data: course ?? null, error: null };
    if (key === 'profiles:select') return { data: profileRow, error: null };
    if (key === 'v_course_full_categories:select') return { data: [], error: null };
    if (key === 'rpc:ai_search_apply_upsert') return { data: upsertOutcome, error: null };
    if (key === 'rpc:ai_search_apply_delete') return { data: 'deleted', error: null };
    return { data: null, error: null };
  };
}

describe('coalesceJobs', () => {
  it('fasst Jobs je Kurs zusammen: hoechste Version, dringlichste Prioritaet', () => {
    const groups = coalesceJobs([
      job({ id: 3, source_version: 9, priority: 5 }),
      job({ id: 1, source_version: 7, priority: 1 }),
      job({ id: 2, course_id: 99, source_version: 8 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ courseId: 42, sourceVersion: 9, priority: 1, jobIds: [3, 1] });
    expect(groups[1]).toMatchObject({ courseId: 99, sourceVersion: 8 });
  });

  it('sortiert nach Prioritaet (Ruecknahme zuerst), dann Job-Reihenfolge', () => {
    const groups = coalesceJobs([
      job({ id: 1, course_id: 10, priority: 5 }),
      job({ id: 2, course_id: 20, priority: 1 }),
    ]);
    expect(groups.map((g) => g.courseId)).toEqual([20, 10]);
  });
});

describe('processOutboxBatch – Uebergabe an die atomare Uebernahme', () => {
  it('oeffentlicher Kurs geht als ai_search_apply_upsert mit Jobversion und Chunkliste an die DB', async () => {
    const { client, calls } = createFakeSupabase(makeRespond({ jobs: [job()], course: publishedCourse() }));
    const summary = await processOutboxBatch(client);

    expect(summary).toMatchObject({ fetchedJobs: 1, courses: 1, inserted: 1, failures: 0 });
    const apply = findCall(calls, (c) => c.op === 'rpc' && c.table === 'ai_search_apply_upsert');
    expect(apply.payload.p_course_id).toBe(42);
    expect(apply.payload.p_source_version).toBe(7);
    expect(apply.payload.p_document.content_hash).toBeTruthy();
    expect(apply.payload.p_chunks.length).toBeGreaterThan(0);
    // Chunk-Payload traegt nur die Abschnittsdaten; Hash/Version setzt die
    // Datenbankfunktion selbst (atomar, konsistent zum Dokument).
    expect(Object.keys(apply.payload.p_chunks[0]).sort())
      .toEqual(['char_end', 'char_start', 'chunk_index', 'section', 'text']);
    const done = findCall(calls, (c) => c.table === 'ai_search_jobs' && c.op === 'update');
    expect(done.payload.status).toBe('done');
    expect(filterValue(done, 'lte', 'source_version')).toBe(7);
    expect(filterValue(done, 'eq', 'course_id')).toBe(42);
  });

  it('ordnet die DB-Ergebnisse zu (updated/refreshed/repaired/stale_skipped) und schliesst Jobs ab', async () => {
    for (const [outcome, key] of [
      ['updated', 'updated'],
      ['refreshed', 'refreshed'],
      ['repaired', 'repaired'],
      ['stale_skipped', 'staleSkipped'],
    ]) {
      const { client, calls } = createFakeSupabase(makeRespond({
        jobs: [job()], course: publishedCourse(), upsertOutcome: outcome,
      }));
      const summary = await processOutboxBatch(client);
      expect(summary[key], outcome).toBe(1);
      // Auch ein wirkungsloser (stale) Job ist erledigt und wird geschlossen.
      const done = findCall(calls, (c) => c.table === 'ai_search_jobs' && c.op === 'update');
      expect(done.payload.status).toBe('done');
    }
  });

  it('fehlende Quellzeile geht als ai_search_apply_delete mit Jobversion an die DB', async () => {
    const { client, calls } = createFakeSupabase(makeRespond({ jobs: [job({ priority: 1 })], course: null }));
    const summary = await processOutboxBatch(client);

    expect(summary.deleted).toBe(1);
    const apply = findCall(calls, (c) => c.op === 'rpc' && c.table === 'ai_search_apply_delete');
    expect(apply.payload).toEqual({ p_course_id: 42, p_source_version: 7 });
  });

  it('Entwurf (unpublish) wird als Loeschung uebergeben', async () => {
    const { client, calls } = createFakeSupabase(makeRespond({
      jobs: [job()],
      course: publishedCourse({ status: 'draft' }),
    }));
    const summary = await processOutboxBatch(client);
    expect(summary.deleted).toBe(1);
    expect(findCall(calls, (c) => c.op === 'rpc' && c.table === 'ai_search_apply_upsert')).toBeUndefined();
  });

  it('Ladefehler: attempts steigt, Job bleibt pending; ab maxAttempts wird er failed', async () => {
    const failingLoad = {
      'courses:select': () => ({ data: null, error: { message: 'boom' } }),
    };
    {
      const { client, calls } = createFakeSupabase(makeRespond({ jobs: [job()], overrides: failingLoad }));
      const summary = await processOutboxBatch(client);
      expect(summary.failures).toBe(1);
      const mark = findCall(calls, (c) => c.table === 'ai_search_jobs' && c.op === 'update');
      expect(mark.payload).toMatchObject({ attempts: 1, status: 'pending' });
      expect(mark.payload.last_error).toContain('boom');
    }
    {
      const { client, calls } = createFakeSupabase(makeRespond({
        jobs: [job({ attempts: DEFAULT_MAX_ATTEMPTS - 1 })],
        overrides: failingLoad,
      }));
      await processOutboxBatch(client);
      const mark = findCall(calls, (c) => c.table === 'ai_search_jobs' && c.op === 'update');
      expect(mark.payload).toMatchObject({ attempts: DEFAULT_MAX_ATTEMPTS, status: 'failed' });
    }
  });

  it('Fehler der Uebernahmefunktion laeuft in denselben Fehlerpfad (kein Job geht verloren)', async () => {
    const { client, calls } = createFakeSupabase(makeRespond({
      jobs: [job()],
      course: publishedCourse(),
      overrides: {
        'rpc:ai_search_apply_upsert': () => ({ data: null, error: { message: 'apply kaputt' } }),
      },
    }));
    const summary = await processOutboxBatch(client);
    expect(summary.failures).toBe(1);
    const mark = findCall(calls, (c) => c.table === 'ai_search_jobs' && c.op === 'update');
    expect(mark.payload.status).toBe('pending');
    expect(mark.payload.last_error).toContain('apply kaputt');
  });

  it('onlyCourseIds begrenzt die Jobauswahl (gezielte Laeufe/DB-Tests)', async () => {
    const { client, calls } = createFakeSupabase(makeRespond({ jobs: [], course: null }));
    await processOutboxBatch(client, { onlyCourseIds: [7, 8] });
    const fetch = findCall(calls, (c) => c.table === 'ai_search_jobs' && c.op === 'select');
    expect(filterValue(fetch, 'in', 'course_id')).toEqual([7, 8]);
    expect(filterValue(fetch, 'eq', 'status')).toBe('pending');
    expect(filterValue(fetch, 'lt', 'attempts')).toBe(DEFAULT_MAX_ATTEMPTS);
  });
});

describe('drainOutbox', () => {
  it('laeuft bis die Outbox leer ist und meldet drained ehrlich', async () => {
    let fetchCount = 0;
    const { client } = createFakeSupabase((call) => {
      if (call.table === 'ai_search_jobs' && call.op === 'select') {
        fetchCount += 1;
        return { data: fetchCount === 1 ? [job()] : [], error: null };
      }
      if (call.table === 'courses') return { data: publishedCourse(), error: null };
      if (call.table === 'profiles') return { data: profileRow, error: null };
      if (call.op === 'rpc' && call.table === 'ai_search_apply_upsert') return { data: 'inserted', error: null };
      return { data: null, error: null };
    });
    const total = await drainOutbox(client);
    expect(total.batches).toBe(2);
    expect(total.inserted).toBe(1);
    expect(total.drained).toBe(true);
  });

  it('bricht ab, wenn ein Batch nur noch Fehler produziert (Backoff = naechster Cron)', async () => {
    const { client } = createFakeSupabase((call) => {
      if (call.table === 'ai_search_jobs' && call.op === 'select') return { data: [job()], error: null };
      if (call.table === 'courses') return { data: null, error: { message: 'boom' } };
      return { data: null, error: null };
    });
    const total = await drainOutbox(client);
    expect(total.batches).toBe(1);
    expect(total.drained).toBe(false);
    expect(total.failures).toBe(1);
  });
});
