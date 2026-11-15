/**
 * Reconciliation (S02): Anti-Join beider Richtungen, NULL-Status-Alarm,
 * Dedupe beim Einreihen, Hash-Stichprobe und Kontingent-Cleanup.
 */

import { describe, it, expect } from 'vitest';
import {
  diffCoverage,
  pickSample,
  runReconciliation,
} from '../src/lib/aiSearch/reconciliation.js';
import { buildProjection } from '../src/lib/aiSearch/projection.js';
import { createFakeSupabase, filterValue, findCall } from './helpers/fakeSupabase.js';

const publishedCourse = (id) => ({
  id,
  status: 'published',
  title: `Kurs ${id}`,
  description: 'Beschreibung.',
  booking_type: 'lead',
  price: 0,
  language: 'DE',
  canton: 'ZH',
  user_id: null,
  course_events: [],
  course_locations: [],
});

describe('diffCoverage', () => {
  it('findet fehlende und verwaiste Kurse beidseitig', () => {
    const diff = diffCoverage([1, 2, 3], [2, 3, 4]);
    expect(diff.missingInIndex).toEqual(['1']);
    expect(diff.orphanedInIndex).toEqual(['4']);
  });

  it('identische Mengen ergeben keinen Befund', () => {
    const diff = diffCoverage([1, 2], ['1', '2']);
    expect(diff.missingInIndex).toEqual([]);
    expect(diff.orphanedInIndex).toEqual([]);
  });
});

describe('pickSample', () => {
  it('ist mit injiziertem Zufall deterministisch und ohne Duplikate', () => {
    expect(pickSample([10, 20, 30], 2, () => 0)).toEqual([10, 20]);
    expect(pickSample([10, 20], 5, () => 0)).toEqual([10, 20]);
  });
});

/**
 * Szenario: 3 veroeffentlichte Kurse (1,2,3), Index kennt 2,3,4.
 * Erwartung: 4 (verwaist) prioritaer eingereiht, 1 (fehlt) normal; Kurs 1 hat
 * bereits einen offenen Job und darf nicht doppelt eingereiht werden —
 * deshalb liefert das Szenario fuer Kurs 1 einen pending-Treffer.
 */
function makeScenario({ pendingForMissing = false, sampleSize = 0, docHash = null, failedCount = 0 }) {
  const course2 = publishedCourse(2);
  return (call) => {
    const key = `${call.table}:${call.op}`;
    if (key === 'courses:select') {
      if (call.head) return { data: null, error: null, count: 1 }; // status IS NULL
      if (call.single) return { data: course2, error: null }; // Stichprobe laedt Kurs 2
      return { data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null };
    }
    if (key === 'ai_search_documents:select') {
      if (call.single) return { data: docHash ? { content_hash: docHash } : null, error: null };
      return { data: [{ course_id: 2 }, { course_id: 3 }, { course_id: 4 }], error: null };
    }
    if (key === 'ai_search_jobs:select') {
      if (call.head) {
        const status = filterValue(call, 'eq', 'status');
        return { data: null, error: null, count: status === 'failed' ? failedCount : 5 };
      }
      const ids = filterValue(call, 'in', 'course_id') ?? [];
      const pending = pendingForMissing && ids.map(String).includes('1') ? [{ course_id: 1 }] : [];
      return { data: pending, error: null };
    }
    if (key === 'v_course_full_categories:select') return { data: [], error: null };
    if (call.op === 'rpc' && call.table === 'ai_search_quota_cleanup') return { data: 2, error: null };
    return { data: null, error: null };
  };
}

describe('runReconciliation', () => {
  it('reiht Verwaiste prioritaer und Fehlende normal ein; NULL-Status alarmiert', async () => {
    const { client, calls } = createFakeSupabase(makeScenario({}));
    const report = await runReconciliation(client, { sampleSize: 0 });

    expect(report).toMatchObject({
      publishedCount: 3,
      documentCount: 3,
      nullStatusCount: 1,
      missingInIndex: 1,
      orphanedInIndex: 1,
      enqueued: 2,
      releasedReservations: 2,
    });
    const inserts = calls.filter((c) => c.table === 'ai_search_jobs' && c.op === 'insert');
    expect(inserts).toHaveLength(2);
    expect(inserts[0].payload).toEqual([{ course_id: '4', reason: 'reconciliation', priority: 1 }]);
    expect(inserts[1].payload).toEqual([{ course_id: '1', reason: 'reconciliation', priority: 5 }]);
    expect(report.alarms.some((a) => a.includes('status IS NULL'))).toBe(true);
  });

  it('reiht Kurse mit bereits offenem Job nicht doppelt ein', async () => {
    const { client, calls } = createFakeSupabase(makeScenario({ pendingForMissing: true }));
    const report = await runReconciliation(client, { sampleSize: 0 });

    expect(report.enqueued).toBe(1); // nur der verwaiste Kurs 4
    const inserts = calls.filter((c) => c.table === 'ai_search_jobs' && c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload[0].course_id).toBe('4');
  });

  it('Hash-Stichprobe: Abweichung alarmiert und reiht den Kurs ein', async () => {
    const { client, calls } = createFakeSupabase(makeScenario({ sampleSize: 1, docHash: 'veralteter-hash' }));
    const report = await runReconciliation(client, { sampleSize: 1, random: () => 0 });

    expect(report.hashSample).toEqual({ checked: 1, mismatches: 1 });
    expect(report.alarms.some((a) => a.includes('Hash-Stichprobe'))).toBe(true);
    const inserts = calls.filter((c) => c.table === 'ai_search_jobs' && c.op === 'insert');
    const mismatchInsert = inserts.find((c) => c.payload[0]?.priority === 3);
    expect(mismatchInsert.payload[0]).toMatchObject({ course_id: 2, reason: 'reconciliation' });
  });

  it('Hash-Stichprobe: uebereinstimmender Hash erzeugt keinen Alarm', async () => {
    const expected = buildProjection(publishedCourse(2), { profile: null, categoryPaths: null }, { sourceVersion: 0 });
    const { client } = createFakeSupabase(makeScenario({
      sampleSize: 1,
      docHash: expected.document.content_hash,
    }));
    const report = await runReconciliation(client, { sampleSize: 1, random: () => 0 });

    expect(report.hashSample).toEqual({ checked: 1, mismatches: 0 });
    expect(report.alarms.some((a) => a.includes('Hash-Stichprobe'))).toBe(false);
  });

  it('failed-Jobs erscheinen als Alarm (Fehlerwarteschlange)', async () => {
    const { client } = createFakeSupabase(makeScenario({ failedCount: 3 }));
    const report = await runReconciliation(client, { sampleSize: 0 });
    expect(report.failedJobs).toBe(3);
    expect(report.alarms.some((a) => a.includes("'failed'"))).toBe(true);
  });

  it('kappt die Einreihung bei maxEnqueue und alarmiert', async () => {
    const { client, calls } = createFakeSupabase((call) => {
      const key = `${call.table}:${call.op}`;
      if (key === 'courses:select') {
        if (call.head) return { data: null, error: null, count: 0 };
        return { data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null };
      }
      if (key === 'ai_search_documents:select') return { data: [], error: null };
      if (key === 'ai_search_jobs:select') {
        return call.head ? { data: null, error: null, count: 0 } : { data: [], error: null };
      }
      if (call.op === 'rpc') return { data: 0, error: null };
      return { data: null, error: null };
    });
    const report = await runReconciliation(client, { sampleSize: 0, maxEnqueue: 2 });

    expect(report.missingInIndex).toBe(3);
    expect(report.enqueued).toBe(2);
    expect(report.truncated).toBe(true);
    expect(report.alarms.some((a) => a.includes('gekappt'))).toBe(true);
    const insert = findCall(calls, (c) => c.table === 'ai_search_jobs' && c.op === 'insert');
    expect(insert.payload).toHaveLength(2);
  });
});
