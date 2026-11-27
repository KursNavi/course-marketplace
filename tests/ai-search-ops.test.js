/**
 * Betriebsrunner der KI-Suche (src/lib/aiSearch/ops.js, scripts/ai-search-ops.mjs).
 *
 * Eigene Fixtures (kleiner In-Memory-Bestand über den Supabase-Fake), kein
 * Netz, keine Modellaufrufe. Geprüft wird vor allem, was NICHT passieren
 * darf: Schreibzugriffe im Trockenlauf, Läufe ohne Sperre, Kosten über der
 * Grenze, globaler Kontingent-Cleanup, Mailversand.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseOpsArgs, runOps, collectStatus, runEmbedStep, estimateEmbeddingUsd,
  OPS_LIMITS, OpsError, classifyStep, stepResultOf, resolvingRun, classifyProblemRuns,
} from '../src/lib/aiSearch/ops.js';
import { drainOutbox } from '../src/lib/aiSearch/worker.js';
import { LeaseSession } from '../src/lib/aiSearch/opsLease.js';
import { formatReport } from '../scripts/ai-search-ops.mjs';
import { createFakeSupabase, filterValue } from './helpers/fakeSupabase.js';

const REF = 'omoapbvfligjfznzivyu';
const VERSION = 'text-embedding-3-small@1024';
const NOW = new Date('2026-11-21T14:00:00Z');

/** Testbestand: Kurse 1–3 veröffentlicht; Index 1, 2, 9 (9 verwaist). */
function fixture(over = {}) {
  return {
    published: [1, 2, 3],
    documents: [1, 2, 9],
    nullStatus: 0,
    pending: 2,
    pendingRetrying: 1,
    failed: 1,
    oldestPending: '2026-11-19T14:00:00Z', // 48 h
    lastIndexed: '2026-11-21T12:00:00Z',
    active: VERSION,
    chunksTotal: 5,
    candidates: [
      { id: 11, course_id: 1, content_hash: 'h11', text: 'a'.repeat(400) },
      { id: 12, course_id: 2, content_hash: 'h12', text: 'b'.repeat(400) },
    ],
    resultsStored: 4,
    resultsExpired: 1,
    searchesCompleted: 3,
    searchesReleased: 1,
    pendingRows: [{ id: 1, course_id: 3 }, { id: 2, course_id: 3 }],
    oldestExpired: '2026-11-21T13:30:00Z', // 0.5 h abgelaufen
    opsRuns: [],
    opsRunsError: null,
    workerJobs: [],
    leaseResult: { data: 77, error: null },
    // Antwort der Verlängerung (Funktion: erhält Uhr); Standard: verlängert.
    renew: null,
    releaseStatus: 'released',
    cleanupDeleted: 1,
    changedMeanwhile: [],
    // Ab dem n-ten geschützten Schreibaufruf meldet die Datenbank KNL01.
    fenceLostAfter: Infinity,
    clockNow: () => NOW.getTime(),
    ...over,
  };
}

const WRITE_OPS = new Set(['insert', 'update', 'upsert', 'delete']);
const writes = (calls) => calls.filter((c) => WRITE_OPS.has(c.op) || (c.op === 'rpc' && c.table !== 'ai_search_month_key'));
const KNL01 = { code: 'KNL01', message: 'ai_search_ops_lease_lost' };

function makeClient(fx) {
  let fencedCalls = 0;
  const fenced = (ok) => {
    fencedCalls += 1;
    return fencedCalls > fx.fenceLostAfter ? { data: null, error: KNL01 } : ok();
  };
  return createFakeSupabase((call) => {
    const { table, op } = call;
    const eqStatus = filterValue(call, 'eq', 'status');
    if (op === 'rpc') {
      if (table === 'ai_search_ops_lease_acquire') return fx.leaseResult;
      if (table === 'ai_search_ops_lease_renew') {
        if (fx.renew) return fx.renew(call);
        const t = fx.clockNow();
        return { data: { status: 'renewed', lease_until: new Date(t + 120_000).toISOString(), db_now: new Date(t).toISOString(), capped: false }, error: null };
      }
      if (table === 'ai_search_ops_lease_release') return { data: fx.releaseStatus, error: null };
      if (table === 'ai_search_ops_fenced_cleanup') return fenced(() => ({ data: fx.cleanupDeleted, error: null }));
      if (table === 'ai_search_ops_fenced_enqueue') return fenced(() => ({ data: call.payload.p_course_ids.length, error: null }));
      if (table === 'ai_search_ops_fenced_apply_delete') return fenced(() => ({ data: 'deleted', error: null }));
      if (table === 'ai_search_ops_fenced_apply_upsert') return fenced(() => ({ data: 'updated', error: null }));
      if (table === 'ai_search_ops_fenced_job_failure') return fenced(() => ({ data: call.payload.p_job_ids.length, error: null }));
      if (table === 'ai_search_ops_fenced_store_embeddings') {
        return fenced(() => {
          const rows = call.payload.p_rows;
          const changed = rows.filter((r) => fx.changedMeanwhile.includes(r.id)).length;
          return { data: { stored: rows.length - changed, changed }, error: null };
        });
      }
      return { data: null, error: null };
    }
    if (table === 'ai_search_ops_runs' && op === 'select') {
      return fx.opsRunsError ? { data: null, error: fx.opsRunsError } : { data: fx.opsRuns, error: null };
    }
    if (table === 'ai_search_results' && op === 'select' && call.columns === 'expires_at') {
      return { data: fx.oldestExpired ? { expires_at: fx.oldestExpired } : null, error: null };
    }
    if (table === 'ai_search_jobs' && op === 'select' && call.columns === 'id, course_id') {
      return { data: fx.pendingRows, error: null };
    }
    if (op === 'update' && table === 'ai_search_chunks') {
      const id = filterValue(call, 'eq', 'id');
      return { data: fx.changedMeanwhile.includes(id) ? [] : [{ id }], error: null };
    }
    if (op !== 'select') return { data: null, error: null };

    if (call.head) {
      if (table === 'courses') return { count: fx.nullStatus };
      if (table === 'ai_search_jobs') {
        if (eqStatus === 'failed') return { count: fx.failed };
        if (call.filters.some(([n]) => n === 'gt')) return { count: fx.pendingRetrying };
        return { count: fx.pending };
      }
      if (table === 'ai_search_chunks') return { count: fx.chunksTotal };
      if (table === 'ai_search_results') return { count: call.filters.some(([n]) => n === 'lte') ? fx.resultsExpired : fx.resultsStored };
      if (table === 'ai_search_usage') return { count: filterValue(call, 'eq', 'state') === 'completed' ? fx.searchesCompleted : fx.searchesReleased };
      return { count: 0 };
    }
    if (table === 'courses' && call.single) return { data: null, error: fx.courseError ?? null };
    if (table === 'courses') return { data: fx.published.map((id) => ({ id })), error: null };
    if (table === 'ai_search_documents') {
      if (call.columns === 'indexed_at') return { data: { indexed_at: fx.lastIndexed }, error: null };
      if (call.single) return { data: null, error: null }; // Stichprobe: übersprungen
      return { data: fx.documents.map((id) => ({ course_id: id })), error: null };
    }
    if (table === 'ai_search_jobs') {
      if (call.columns === 'created_at') return { data: fx.oldestPending ? { created_at: fx.oldestPending } : null, error: null };
      if (call.columns?.startsWith('id, course_id, attempts')) return { data: [{ id: 5, course_id: 3, attempts: 5, last_error: 'x'.repeat(300) }], error: null };
      if (call.columns?.startsWith('id, course_id, reason')) {
        const batch = fx.workerJobs;
        fx.workerJobs = [];
        return { data: batch, error: null };
      }
      return { data: [], error: null };
    }
    if (table === 'ai_search_config') return { data: { active_model_version: fx.active }, error: null };
    if (table === 'ai_search_chunks') return { data: fx.candidates, error: null };
    if (table === 'public_teacher_profiles' || table === 'v_course_full_categories') return { data: null, error: null };
    return { data: null, error: null };
  });
}

function fakeClock(startMs = NOW.getTime()) {
  let t = startMs;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

function fakeGateway({ tokensPerCall = 200 } = {}) {
  const gw = {
    usage: { embeddingTokens: 0 },
    calls: [],
    async embed(texts) {
      gw.calls.push(texts.length);
      gw.usage.embeddingTokens += tokensPerCall;
      return texts.map(() => [0.1, 0.2]);
    },
  };
  return gw;
}

const parse = (argv, env = {}) => parseOpsArgs(argv, env, REF);
const confirm = { AI_OPS_CONFIRM: REF };

describe('parseOpsArgs: Standard Trockenlauf, jede Schreibstufe mit eigenem Schalter', () => {
  it('ohne Angaben: Trockenlauf mit Standardgrenzen', () => {
    const r = parse([]);
    expect(r.ok).toBe(true);
    expect(r.options.anyExecute).toBe(false);
    expect(r.options.limits.runtimeSec).toBe(OPS_LIMITS.defaultRuntimeSec);
  });

  it('unbekannte oder ungenaue Schalter werden abgewiesen (kein „--execute“ für alles)', () => {
    expect(parse(['--execute']).ok).toBe(false);
    expect(parse(['--execute-index=yes'], confirm).ok).toBe(false);
    expect(parse(['execute-index']).ok).toBe(false);
  });

  it('schreibende Schritte nur mit AI_OPS_CONFIRM der TESTumgebung', () => {
    expect(parse(['--execute-cleanup']).ok).toBe(false);
    expect(parse(['--execute-cleanup'], { AI_OPS_CONFIRM: 'nplxmpfasgpumpiddjfl' }).ok).toBe(false);
    const r = parse(['--execute-cleanup'], confirm);
    expect(r.ok).toBe(true);
    expect(r.options.execute).toEqual({ index: false, embed: false, cleanup: true });
  });

  it('Embeddings nur mit --max-usd ≤ 1; --max-usd ohne Embedding ist ein Fehler', () => {
    expect(parse(['--execute-embed'], confirm).ok).toBe(false);
    expect(parse(['--execute-embed', '--max-usd=0'], confirm).ok).toBe(false);
    expect(parse(['--execute-embed', '--max-usd=1.5'], confirm).ok).toBe(false);
    expect(parse(['--max-usd=0.5']).ok).toBe(false);
    const r = parse(['--execute-embed', '--max-usd=0.05'], confirm);
    expect(r.ok).toBe(true);
    expect(r.options.limits.maxUsd).toBe(0.05);
  });

  it('Werte über den Obergrenzen werden abgewiesen, nicht still gekappt', () => {
    expect(parse(['--max-runtime-sec=901']).ok).toBe(false);
    expect(parse(['--max-index-batches=41']).ok).toBe(false);
    expect(parse(['--max-embed-chunks=3001']).ok).toBe(false);
    expect(parse(['--cleanup-batch=5001']).ok).toBe(false);
    expect(parse(['--max-enqueue=0']).ok).toBe(false);
    expect(parse(['--max-runtime-sec=900', '--cleanup-batch=5000']).ok).toBe(true);
  });
});

describe('Trockenlauf (Standard)', () => {
  it('liest nur: keine Schreibzugriffe, keine RPC, keine Sperre, kein Modell', async () => {
    const { client, calls } = makeClient(fixture());
    let gatewayCreated = false;
    const report = await runOps(client, parse([]).options, {
      embeddingVersion: VERSION, holder: 'h', clock: () => NOW,
      modelsEnabled: true, createGateway: () => { gatewayCreated = true; return fakeGateway(); },
    });
    expect(report.mode).toBe('dry-run');
    expect(report.exitCode).toBe(0);
    expect(writes(calls)).toEqual([]);
    expect(gatewayCreated).toBe(false);
  });

  it('berichtet Abdeckung, Aktualität, Fehler, offene Jobs, Ergebnisse und Verbrauch', async () => {
    const { client } = makeClient(fixture());
    const s = await collectStatus(client, { embeddingVersion: VERSION, now: NOW });
    expect(s.coverage).toMatchObject({ published: 3, documents: 3, missingInIndex: 1, orphanedInIndex: 1, missingSample: ['3'], orphanedSample: ['9'] });
    expect(s.freshness).toMatchObject({ lastIndexedAt: '2026-11-21T12:00:00Z', oldestPendingHours: 48 });
    expect(s.jobs).toMatchObject({ pending: 2, pendingRetrying: 1, failed: 1 });
    expect(s.jobs.failedSample[0].last_error).toHaveLength(200);
    expect(s.embeddings).toMatchObject({ activeVersion: VERSION, chunksTotal: 5, needEmbedding: 2, needEmbeddingChars: 800 });
    expect(s.results).toEqual({ stored: 4, expired: 1, oldestExpiredAt: "2026-11-21T13:30:00Z", backlogHours: 0.5 });
    expect(s.usage).toEqual({ monthKey: '2026-11', searchesCompleted: 3, searchesReleased: 1 });
    expect(s.estimate.embeddingTokens).toBe(200);
    expect(s.estimate.searchesUsdEstimate).toBeCloseTo(4 * 0.003, 10);
    expect(s.estimate.partialTotalUsd).toBeCloseTo(4 * 0.003 + 200 / 1_000_000 * 0.02, 10);
    expect(s.estimate.monthlyBudgetUsd).toBe(10);
    expect(s.alarms.join(' ')).toMatch(/fehlen im Index/);
    expect(s.alarms.join(' ')).toMatch(/ohne veröffentlichten Kurs/);
    expect(s.alarms.join(' ')).toMatch(/'failed'/);
    expect(s.alarms.join(' ')).toMatch(/48 h alt/);
  });

  it('nur fehlende oder veraltete Embeddings: Filter auf NULL oder andere Modellversion', async () => {
    const { client, calls } = makeClient(fixture());
    await collectStatus(client, { embeddingVersion: VERSION, now: NOW });
    const chunkQuery = calls.find((c) => c.table === 'ai_search_chunks' && !c.head);
    expect(chunkQuery.filters).toContainEqual(['or', `embedding.is.null,model_version.is.null,model_version.neq."${VERSION}"`]);
  });

  it('Kostenschätzung: 4 Zeichen je Token, USD 0.02 je Mio.', () => {
    expect(estimateEmbeddingUsd(4_000_000)).toEqual({ tokens: 1_000_000, usd: 0.02 });
  });

  it('Kosten als begrenzte Schätzung gekennzeichnet – kein Gesamtverbrauch, keine garantierte Obergrenze', async () => {
    const { client } = makeClient(fixture());
    const s = await collectStatus(client, { embeddingVersion: VERSION, now: NOW });
    expect(s.estimate.kind).toBe('partial-estimate');
    expect(s.estimate.note).toMatch(/Begrenzte Schätzung/);
    expect(s.estimate.note).toMatch(/nicht der vollständige Projektverbrauch und keine garantierte Monatsobergrenze/);
    expect(s.estimate.excludes.length).toBeGreaterThanOrEqual(3);
    expect(s.estimate).not.toHaveProperty('monthTotalUsdMax');
    expect(s.estimate).not.toHaveProperty('searchesUsdMax');

    const report = await runOps(client, parse([]).options, { embeddingVersion: VERSION, holder: 'h', clock: () => NOW });
    const text = formatReport(report);
    expect(text).toMatch(/BEGRENZTE SCHÄTZUNG/);
    expect(text).toMatch(/Nicht enthalten:/);
    expect(text).toMatch(/Teilsumme dieser zwei Posten/);
    expect(text).not.toMatch(/Summe höchstens|höchstens USD|Gesamtverbrauch/);
  });
});

describe('Schreibende Läufe: Laufsperre v2, Grenzen, keine Nebenwirkungen', () => {
  const deps = (extra = {}) => ({ embeddingVersion: VERSION, holder: 'holder-1', clock: () => NOW, now: () => NOW.getTime(), ...extra });

  it('Index: Sperre (Frist 120 s, Gesamtgrenze Laufzeit + 120 s), geschützte Einreihung, OHNE Kontingent-Cleanup', async () => {
    const { client, calls } = makeClient(fixture());
    const report = await runOps(client, parse(['--execute-index', '--max-runtime-sec=600'], confirm).options, deps());
    expect(report.outcome).toBe('ok');
    const acquire = calls.find((c) => c.table === 'ai_search_ops_lease_acquire');
    expect(acquire.payload).toEqual({ p_holder: 'holder-1', p_modes: ['index'], p_lease_seconds: 120, p_max_seconds: 720 });
    expect(calls.some((c) => c.table === 'ai_search_quota_cleanup')).toBe(false);
    expect(calls.some((c) => c.table === 'ai_search_result_cleanup' || c.table === 'ai_search_ops_fenced_cleanup')).toBe(false);
    const release = calls.find((c) => c.table === 'ai_search_ops_lease_release');
    expect(release.payload).toMatchObject({ p_run_id: 77, p_holder: 'holder-1', p_outcome: 'ok' });
    // Abgleich reiht verwaisten (9, Vorrang 1) und fehlenden (3, Vorrang 5) Kurs geschützt ein.
    const enq = calls.filter((c) => c.table === 'ai_search_ops_fenced_enqueue').map((c) => [c.payload.p_course_ids, c.payload.p_priority, c.payload.p_run_id]);
    expect(enq).toEqual([[['9'], 1, 77], [['3'], 5, 77]]);
    // Keine ungeschützten Schreibzugriffe auf Jobs.
    expect(calls.some((c) => c.table === 'ai_search_jobs' && WRITE_OPS.has(c.op))).toBe(false);
    expect(report.steps.index.reconciliation.enqueued).toBe(2);
  });

  it('Index: Übernahme + Jobabschluss nur über geschützte Funktionen mit Laufkennung', async () => {
    const fx = fixture({ workerJobs: [{ id: 1, course_id: 42, reason: 'course_delete', priority: 5, source_version: 7, attempts: 0 }] });
    const { client, calls } = makeClient(fx);
    const report = await runOps(client, parse(['--execute-index'], confirm).options, deps());
    expect(report.outcome).toBe('ok');
    const apply = calls.find((c) => c.table === 'ai_search_ops_fenced_apply_delete');
    expect(apply.payload).toEqual({ p_run_id: 77, p_holder: 'holder-1', p_course_id: 42, p_source_version: 7 });
    expect(calls.some((c) => c.table === 'ai_search_apply_delete' || c.table === 'ai_search_apply_upsert')).toBe(false);
    expect(calls.some((c) => c.table === 'ai_search_jobs' && c.op === 'update')).toBe(false);
  });

  it('anderer Lauf aktiv: Exit 3, keinerlei Schreibzugriff', async () => {
    const { client, calls } = makeClient(fixture({ leaseResult: { data: null, error: null } }));
    const report = await runOps(client, parse(['--execute-index', '--execute-cleanup'], confirm).options, deps());
    expect(report).toMatchObject({ outcome: 'locked', exitCode: 3 });
    expect(writes(calls).map((c) => c.table)).toEqual(['ai_search_ops_lease_acquire']);
  });

  it('Sperrfunktion fehlt (Entwurf nicht angewendet): gesperrt mit Exit 2, nichts geschrieben', async () => {
    const { client, calls } = makeClient(fixture({ leaseResult: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } }));
    await expect(runOps(client, parse(['--execute-cleanup'], confirm).options, deps())).rejects.toMatchObject({ exitCode: 2 });
    expect(calls.some((c) => /cleanup/.test(c.table) && c.op === 'rpc')).toBe(false);
  });

  it('Rechte-/Transportfehler der Sperre wird nicht als „fehlt“ gewertet', async () => {
    const { client } = makeClient(fixture({ leaseResult: { data: null, error: { code: '42501', message: 'permission denied' } } }));
    await expect(runOps(client, parse(['--execute-cleanup'], confirm).options, deps())).rejects.toBeInstanceOf(OpsError);
    await expect(runOps(client, parse(['--execute-cleanup'], confirm).options, deps())).rejects.toThrow(/nicht prüfbar/);
  });

  it('Bereinigung: physische Löschung über die geschützte Funktion mit Lauf-Grenze', async () => {
    const { client, calls } = makeClient(fixture({ cleanupDeleted: 1 }));
    const report = await runOps(client, parse(['--execute-cleanup', '--cleanup-batch=250'], confirm).options, deps());
    expect(report.steps.cleanup).toEqual({ deleted: 1, batch: 250 });
    const cleanups = calls.filter((c) => c.table === 'ai_search_ops_fenced_cleanup');
    expect(cleanups).toHaveLength(1);
    expect(cleanups[0].payload).toEqual({ p_run_id: 77, p_holder: 'holder-1', p_batch: 250 });
  });

  it('Embeddings ohne Modellfreigabe: Abbruch VOR der Sperre', async () => {
    const { client, calls } = makeClient(fixture());
    await expect(runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options, deps({ modelsEnabled: false })))
      .rejects.toMatchObject({ exitCode: 2 });
    expect(writes(calls)).toEqual([]);
  });

  it('Embeddings: geschützt speichern, nur unveränderte Abschnitte (content_hash), Rest „zwischenzeitlich geändert“', async () => {
    const { client, calls } = makeClient(fixture({ changedMeanwhile: [12] }));
    const gw = fakeGateway();
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ modelsEnabled: true, createGateway: () => gw }));
    expect(report.outcome).toBe('ok');
    expect(report.steps.embed).toMatchObject({ planned: 2, embedded: 1, changedMeanwhile: 1, calls: 1 });
    const store = calls.find((c) => c.table === 'ai_search_ops_fenced_store_embeddings');
    expect(store.payload.p_model_version).toBe(VERSION);
    expect(store.payload.p_rows.map((r) => [r.id, r.content_hash])).toEqual([[11, 'h11'], [12, 'h12']]);
    expect(calls.some((c) => c.table === 'ai_search_chunks' && c.op === 'update')).toBe(false);
    // Verbrauch wird im Laufprotokoll festgehalten (Grundlage der Monatsgrenze).
    expect(calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_summary.embed.actualUsd).toBeCloseTo(200 / 1e6 * 0.02, 12);
  });

  it('Embeddings ohne Lücke: kein Gateway, kein Modellaufruf', async () => {
    const { client } = makeClient(fixture({ candidates: [] }));
    let created = false;
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ modelsEnabled: true, createGateway: () => { created = true; return fakeGateway(); } }));
    expect(report.outcome).toBe('ok');
    expect(created).toBe(false);
    expect(report.steps.embed.skipped).toBe(true);
  });

  it('Embeddings: Schätzung über der Laufgrenze → kein einziger Modellaufruf, Lauf „failed“, Sperre frei', async () => {
    const big = Array.from({ length: 3 }, (_, i) => ({ id: i, course_id: 1, content_hash: `h${i}`, text: 'x'.repeat(4_000_000) }));
    const { client, calls } = makeClient(fixture({ candidates: big }));
    const gw = fakeGateway();
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ modelsEnabled: true, createGateway: () => gw }));
    expect(report).toMatchObject({ outcome: 'failed', exitCode: 2 });
    expect(gw.calls).toEqual([]);
    expect(calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_outcome).toBe('failed');
  });

  it('Embeddings: Monatsgrenze aus dem Laufprotokoll → kein Aufruf', async () => {
    const spent = [{ id: 5, modes: ['embed'], started_at: '2026-11-10T10:00:00Z', finished_at: '2026-11-10T10:05:00Z', outcome: 'ok', lease_until: '2026-11-10T10:06:00Z', summary: { embed: { actualUsd: 1.9999995 } } }];
    const { client } = makeClient(fixture({ opsRuns: spent }));
    const gw = fakeGateway();
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ modelsEnabled: true, createGateway: () => gw }));
    expect(report.outcome).toBe('failed');
    expect(report.error).toMatch(/Monats-Stoppschwelle/);
    expect(gw.calls).toEqual([]);
  });

  it('Embeddings: andere aktive Modellversion → übersprungen (kein Modellwechsel im Runner)', async () => {
    const gw = fakeGateway();
    const result = await runEmbedStep({}, gw, null, {
      version: VERSION, activeVersion: 'anderes@1024', candidates: fixture().candidates, maxChunks: 10, maxUsd: 1, deadline: Infinity,
    });
    expect(result.skipped).toBe(true);
    expect(gw.calls).toEqual([]);
  });

  it('Embeddings: Umfangsgrenze und tatsächlicher Verbrauch über Grenze stoppen weitere Aufrufe', async () => {
    const many = Array.from({ length: 350 }, (_, i) => ({ id: i, course_id: 1, content_hash: `h${i}`, text: 'abcd' }));
    const fx = fixture();
    const { client } = makeClient(fx);
    const session = new LeaseSession(client, { runId: 77, holder: 'h', now: fx.clockNow });
    const gw = fakeGateway({ tokensPerCall: 600_000 }); // 0.012 USD je Aufruf
    const result = await runEmbedStep(client, gw, session, {
      version: VERSION, activeVersion: VERSION, candidates: many, maxChunks: 300, maxUsd: 0.02, deadline: Infinity,
    });
    expect(result.planned).toBe(300);
    expect(gw.calls).toEqual([100, 100]); // dritter Aufruf: Verbrauch 0.024 > 0.02
    expect(result.stoppedBy).toBe('usd');
  });

  it('Fehler: Indexfehler zählt Fehlversuch geschützt und stoppt die folgenden Schritte', async () => {
    const fx = fixture({
      workerJobs: [{ id: 1, course_id: 42, reason: 'course_upsert', priority: 5, source_version: 1, attempts: 0 }],
      courseError: { message: 'Verbindung verloren' },
    });
    const { client, calls } = makeClient(fx);
    const report = await runOps(client, parse(['--execute-index', '--execute-cleanup'], confirm).options, deps());
    expect(report).toMatchObject({ outcome: 'failed', exitCode: 1 });
    expect(report.error).toMatch(/fehlgeschlagen/);
    const failure = calls.find((c) => c.table === 'ai_search_ops_fenced_job_failure');
    expect(failure.payload).toMatchObject({ p_run_id: 77, p_job_ids: [1], p_attempts: 1, p_max_attempts: 5 });
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_cleanup')).toBe(false);
    expect(calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_outcome).toBe('failed');
  });

  it('Laufzeitgrenze erreicht: spätere Schritte werden übersprungen statt begonnen', async () => {
    const clock = fakeClock();
    const { client, calls } = makeClient(fixture({ clockNow: clock.now }));
    const options = parse(['--execute-index', '--execute-cleanup', '--max-runtime-sec=60'], confirm).options;
    const report = await runOps(client, options, deps({
      now: () => { const t = clock.now(); clock.advance(30_000); return t; },
    }));
    expect(report.steps.cleanup).toEqual({ skipped: true, reason: 'Laufzeitgrenze erreicht' });
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_cleanup')).toBe(false);
  });
});

describe('Sperrlücke geschlossen: langer Schritt, Sperrverlust, Abbruch, Wiederaufnahme', () => {
  const deps = (extra = {}) => ({ embeddingVersion: VERSION, holder: 'holder-1', clock: () => NOW, ...extra });
  const jobs = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, course_id: 100 + i, reason: 'course_delete', priority: 5, source_version: 1, attempts: 0 }));

  it('LeaseSession: verlängert vor einem Schritt, wenn die Restfrist nicht reicht', async () => {
    const clock = fakeClock();
    const fx = fixture({ clockNow: clock.now });
    const { client, calls } = makeClient(fx);
    const s = new LeaseSession(client, { runId: 77, holder: 'h', now: clock.now });
    await s.gate(10_000); // 120 s Rest ≥ 75 s Schwelle → keine Verlängerung
    expect(calls.filter((c) => c.table === 'ai_search_ops_lease_renew')).toHaveLength(0);
    clock.advance(60_000); // 60 s Rest < 75 s
    await s.gate(10_000);
    expect(calls.filter((c) => c.table === 'ai_search_ops_lease_renew')).toHaveLength(1);
    expect(s.remainingMs()).toBe(120_000);
  });

  it('langer Arbeitsschritt: Frist während des Schritts abgelaufen → Verlängerung verweigert, kein weiterer Schritt', async () => {
    const clock = fakeClock();
    const fx = fixture({
      clockNow: clock.now,
      renew: () => ({ data: { status: 'expired', db_now: new Date(clock.now()).toISOString() }, error: null }),
    });
    const { client } = makeClient(fx);
    const s = new LeaseSession(client, { runId: 77, holder: 'h', now: clock.now });
    await s.gate(30_000);
    clock.advance(200_000); // Schritt dauerte länger als die Frist
    await expect(s.gate(30_000)).rejects.toMatchObject({ name: 'LeaseLostError', status: 'expired', exitCode: 4 });
    await expect(s.gate(0)).rejects.toMatchObject({ status: 'expired' }); // bleibt gesperrt
  });

  it('Gesamtgrenze: gekappte Verlängerung reicht nicht für den Schritt → kein Beginn', async () => {
    const clock = fakeClock();
    const fx = fixture({
      clockNow: clock.now,
      renew: () => ({ data: { status: 'renewed', lease_until: new Date(clock.now() + 20_000).toISOString(), db_now: new Date(clock.now()).toISOString(), capped: true }, error: null }),
    });
    const { client } = makeClient(fx);
    const s = new LeaseSession(client, { runId: 77, holder: 'h', now: clock.now });
    clock.advance(100_000);
    await expect(s.gate(50_000)).rejects.toMatchObject({ status: 'max_reached' });
  });

  it('Sperrverlust mitten im Index: Datenbank meldet KNL01 → sofortiger Halt, KEIN Fehlversuch, Jobs bleiben offen, Lauf „lost“', async () => {
    const fx = fixture({ workerJobs: jobs(4), fenceLostAfter: 2 });
    const { client, calls } = makeClient(fx);
    const report = await runOps(client, parse(['--execute-index', '--execute-cleanup'], confirm).options, deps({ now: () => NOW.getTime() }));
    // Einreihung (2 geschützte Aufrufe) ging durch, danach verweigert die Datenbank.
    expect(report).toMatchObject({ outcome: 'lost', exitCode: 4 });
    const applies = calls.filter((c) => c.table === 'ai_search_ops_fenced_apply_delete');
    expect(applies).toHaveLength(1); // erster Kurs abgewiesen → keine weiteren
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_job_failure')).toBe(false);
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_cleanup')).toBe(false);
    const release = calls.find((c) => c.table === 'ai_search_ops_lease_release');
    expect(release.payload.p_outcome).toBe('lost');
    expect(release.payload.p_summary.leaseLost).toBe('fenced');
  });

  it('Sperrverlust vor dem Embedding-Aufruf: kein neuer Modellaufruf', async () => {
    const fx = fixture({ renew: () => ({ data: { status: 'lost', db_now: NOW.toISOString() }, error: null }) });
    const { client } = makeClient(fx);
    const clock = fakeClock();
    const s = new LeaseSession(client, { runId: 77, holder: 'h', now: clock.now, leaseUntil: new Date(clock.now() + 40_000).toISOString() });
    const gw = fakeGateway();
    await expect(runEmbedStep(client, gw, s, {
      version: VERSION, activeVersion: VERSION, candidates: fixture().candidates, maxChunks: 10, maxUsd: 1, deadline: Infinity, now: clock.now,
    })).rejects.toMatchObject({ status: 'lost' });
    expect(gw.calls).toEqual([]);
  });

  it('Sperrverlust NACH dem Embedding-Aufruf: Speichern abgewiesen (KNL01), Verbrauch trotzdem protokolliert', async () => {
    const fx = fixture({ fenceLostAfter: 0 });
    const { client, calls } = makeClient(fx);
    const gw = fakeGateway();
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ now: () => NOW.getTime(), modelsEnabled: true, createGateway: () => gw }));
    expect(report).toMatchObject({ outcome: 'lost', exitCode: 4 });
    expect(gw.calls).toEqual([2]);
    expect(calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_summary.embed.actualUsd).toBeGreaterThan(0);
  });

  it('Abbruch WÄHREND des Embedding-Aufrufs: nach Rückkehr nichts gespeichert, Kosten des Aufrufs protokolliert', async () => {
    const fx = fixture();
    const { client, calls } = makeClient(fx);
    let session = null;
    const gw = fakeGateway();
    const original = gw.embed;
    gw.embed = async (texts) => { const out = await original(texts); session.requestStop('SIGTERM'); return out; };
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ now: () => NOW.getTime(), modelsEnabled: true, createGateway: () => gw, onSession: (s) => { session = s; } }));
    expect(report).toMatchObject({ outcome: 'aborted', exitCode: 4 });
    expect(gw.calls).toEqual([2]);
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_store_embeddings')).toBe(false);
    const summary = calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_summary;
    expect(summary.embed.actualUsd).toBeGreaterThan(0);
  });

  it('Sperrverlust WÄHREND des Embedding-Aufrufs: Prüfung nach Rückkehr verhindert das Speichern', async () => {
    const clock = fakeClock();
    let lost = false;
    const fx = fixture({
      clockNow: clock.now,
      renew: () => (lost
        ? { data: { status: 'expired', db_now: new Date(clock.now()).toISOString() }, error: null }
        : { data: { status: 'renewed', lease_until: new Date(clock.now() + 120_000).toISOString(), db_now: new Date(clock.now()).toISOString() }, error: null }),
    });
    const { client, calls } = makeClient(fx);
    const s = new LeaseSession(client, { runId: 77, holder: 'h', now: clock.now });
    const gw = fakeGateway();
    const original = gw.embed;
    gw.embed = async (texts) => { const out = await original(texts); lost = true; clock.advance(100_000); return out; };
    await expect(runEmbedStep(client, gw, s, {
      version: VERSION, activeVersion: VERSION, candidates: fixture().candidates, maxChunks: 10, maxUsd: 1, deadline: Infinity, now: clock.now,
    })).rejects.toMatchObject({ status: 'expired' });
    expect(gw.calls).toEqual([2]);
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_store_embeddings')).toBe(false);
  });

  it('Abbruch von aussen (Datenbank): nächster Schritt startet nicht, Lauf „aborted“', async () => {
    const clock = fakeClock();
    const fx = fixture({
      clockNow: clock.now,
      workerJobs: jobs(3),
      renew: () => ({ data: { status: 'abort_requested', db_now: new Date(clock.now()).toISOString() }, error: null }),
    });
    const { client, calls } = makeClient(fx);
    const report = await runOps(client, parse(['--execute-index'], confirm).options, deps({
      // Jeder Zeitabruf rückt 20 s vor → Restfrist sinkt unter die Schwelle.
      now: () => { const t = clock.now(); clock.advance(20_000); return t; },
    }));
    expect(report).toMatchObject({ outcome: 'aborted', exitCode: 4 });
    expect(calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_outcome).toBe('aborted');
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_job_failure')).toBe(false);
  });

  it('Abbruch lokal (SIGTERM): requestStop → kein weiterer Schritt, Lauf „aborted“', async () => {
    const fx = fixture({ workerJobs: jobs(3) });
    const { client, calls } = makeClient(fx);
    let session = null;
    const report = await runOps(client, parse(['--execute-index'], confirm).options, deps({
      now: () => NOW.getTime(),
      onSession: (s) => { session = s; s.requestStop('SIGTERM'); },
    }));
    expect(session).not.toBeNull();
    expect(report.outcome).toBe('aborted');
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_enqueue')).toBe(false);
    expect(calls.some((c) => c.table === 'ai_search_ops_fenced_apply_delete')).toBe(false);
  });

  it('Abschluss nach Fristablauf: Datenbank protokolliert „expired“, Bericht zeigt es', async () => {
    const { client } = makeClient(fixture({ releaseStatus: 'expired' }));
    const report = await runOps(client, parse(['--execute-cleanup'], confirm).options, deps({ now: () => NOW.getTime() }));
    expect(report.lease).toEqual({ status: 'expired' });
    expect(formatReport(report)).toMatch(/Abschluss in der Datenbank: expired/);
  });

  it('Wiederaufnahme: Lauf 1 verliert die Sperre, Lauf 2 übernimmt und erledigt die offenen Jobs', async () => {
    // Gemeinsamer Bestand: 3 offene Jobs. Lauf 1 schafft einen Kurs, dann KNL01.
    const pendingJobs = jobs(3);
    const done = new Set();
    const shared = { workerJobsLeft: () => pendingJobs.filter((j) => !done.has(j.id)) };
    const makeRun = (lostAfter, runId) => {
      let fencedCalls = 0;
      return createFakeSupabase((call) => {
        if (call.op === 'rpc') {
          if (call.table === 'ai_search_ops_lease_acquire') return { data: runId, error: null };
          if (call.table === 'ai_search_ops_lease_release') return { data: 'released', error: null };
          if (call.table === 'ai_search_ops_fenced_apply_delete') {
            fencedCalls += 1;
            if (fencedCalls > lostAfter) return { data: null, error: KNL01 };
            const job = pendingJobs.find((j) => j.course_id === call.payload.p_course_id);
            done.add(job.id);
            return { data: 'deleted', error: null };
          }
          return { data: 0, error: null };
        }
        if (call.table === 'ai_search_jobs' && call.columns?.startsWith('id, course_id, reason')) return { data: shared.workerJobsLeft(), error: null };
        if (call.head) return { count: 0 };
        if (call.table === 'ai_search_ops_runs') return { data: [], error: null };
        if (call.table === 'courses' && call.single) return { data: null, error: null };
        return { data: call.single ? null : [], error: null };
      });
    };
    const run1 = makeRun(1, 81);
    const r1 = await runOps(run1.client, parse(['--execute-index'], confirm).options, deps({ now: () => NOW.getTime() }));
    expect(r1.outcome).toBe('lost');
    expect(done.size).toBe(1);
    const run2 = makeRun(Infinity, 82);
    const r2 = await runOps(run2.client, parse(['--execute-index'], confirm).options, deps({ now: () => NOW.getTime() }));
    expect(r2.outcome).toBe('ok');
    expect(done.size).toBe(3);
    // Kein Job wurde als Fehlversuch gezählt.
    expect([...run1.calls, ...run2.calls].some((c) => c.table === 'ai_search_ops_fenced_job_failure')).toBe(false);
  });
});

describe('Betriebsbericht: Löschrückstand, Laufprotokoll, Überwachung', () => {
  it('meldet Aufträge je Kurs, Löschrückstand und Laufprotokoll', async () => {
    const runs = [
      { id: 9, modes: ['cleanup-scheduled'], started_at: '2026-11-21T13:07:00Z', finished_at: '2026-11-21T13:07:01Z', outcome: 'ok', lease_until: '2026-11-21T13:07:00Z', summary: { deleted: 3, expired_left: 0 } },
      { id: 8, modes: ['index'], started_at: '2026-11-21T12:00:00Z', finished_at: '2026-11-21T12:03:00Z', outcome: 'lost', lease_until: '2026-11-21T12:02:00Z', summary: { error: 'Sperre verloren' } },
      { id: 7, modes: ['embed'], started_at: '2026-11-20T12:00:00Z', finished_at: '2026-11-20T12:01:00Z', outcome: 'ok', lease_until: '2026-11-20T12:02:00Z', summary: { embed: { actualUsd: 0.004 } } },
    ];
    const { client } = makeClient(fixture({ opsRuns: runs, oldestExpired: '2026-11-21T10:00:00Z' }));
    const s = await collectStatus(client, { embeddingVersion: VERSION, now: NOW });
    expect(s.jobs).toMatchObject({ pending: 2, pendingCourses: 1 });
    expect(s.results).toMatchObject({ expired: 1, backlogHours: 4 });
    expect(s.critical.join(' ')).toMatch(/Löschrückstand/);
    expect(s.ops.applied).toBe(true);
    expect(s.ops.lastCleanupTick).toEqual({ at: '2026-11-21T13:07:01Z', deleted: 3, expiredLeft: 0 });
    expect(s.ops.problemCount).toBe(1);
    expect(s.critical.join(' ')).toMatch(/8:lost/);
    expect(s.ops.embedUsdMonth).toBeCloseTo(0.004, 10);
    expect(s.estimate.runnerEmbedUsdMonth).toBeCloseTo(0.004, 10);
    const text = formatReport({ mode: 'dry-run', outcome: 'ok', before: s, plan: (await runOps(client, parse([]).options, { embeddingVersion: VERSION, holder: 'h', clock: () => NOW })).plan });
    expect(text).toMatch(/für 1 verschiedene Kurse/);
    expect(text).toMatch(/ältestes seit 4 h abgelaufen/);
    expect(text).toMatch(/Letzte zeitgesteuerte Löschung: 2026-11-21 13:07:01 UTC, 3 gelöscht/);
  });

  it('Überwachung 27.11.2026: behobener historischer Fehler ist Hinweis, offener bleibt kritisch; Historie bleibt', async () => {
    const run = (id, modes, at, outcome, summary) => ({ id, modes, started_at: at, finished_at: at, outcome, lease_until: at, summary });
    // Form der Produktionsläufe 3–5: Ersteinbettung mit 403, danach Index ok, danach Einbettung ok.
    const failed403 = run(3, ['embed'], '2026-11-21T08:00:00Z', 'failed', { initial: true, error: 'OpenAI HTTP 403' });
    const indexOk = run(4, ['index'], '2026-11-21T09:00:00Z', 'ok', { stepResults: { index: 'processed' }, index: { jobs: 4 } });
    const embedOk = run(5, ['embed'], '2026-11-21T10:00:00Z', 'ok', { initial: true, embed: { embedded: 2481, actualUsd: 0.0047 } });

    const resolved = await collectStatus(makeClient(fixture({ opsRuns: [embedOk, indexOk, failed403] })).client, { embeddingVersion: VERSION, now: NOW });
    expect(resolved.ops.problemCount).toBe(1);
    expect(resolved.ops.problemRuns).toEqual([expect.objectContaining({ id: 3, outcome: 'failed', error: 'OpenAI HTTP 403', resolvedBy: 5 })]);
    expect(resolved.critical.join(' ')).not.toMatch(/nicht behoben|3:failed/);
    expect(resolved.alarms.join(' ')).toMatch(/Behoben \(Historie\): Lauf 3 \(embed, failed: OpenAI HTTP 403\) – danach Lauf 5 erfolgreich/);
    const { plan } = await runOps(makeClient(fixture({ opsRuns: [embedOk, indexOk, failed403] })).client, parse([]).options, { embeddingVersion: VERSION, holder: 'h', clock: () => NOW });
    const text = formatReport({ mode: 'dry-run', outcome: 'ok', before: resolved, plan });
    expect(text).toMatch(/Nicht erfolgreich \(7 Tage\): 1/);
    expect(text).toMatch(/Lauf 3 .*embed: failed – OpenAI HTTP 403 \(behoben durch Lauf 5\)/);

    // Nur ein Lauf anderer Art (Index) oder ein übersprungener Schritt behebt nichts → kritisch.
    const skipped = run(6, ['index', 'embed', 'cleanup'], '2026-11-21T11:00:00Z', 'ok', { stepResults: { index: 'no-work', embed: 'skipped', cleanup: 'no-work' } });
    const open = await collectStatus(makeClient(fixture({ opsRuns: [skipped, indexOk, failed403] })).client, { embeddingVersion: VERSION, now: NOW });
    expect(open.ops.problemRuns[0].resolvedBy).toBeNull();
    expect(open.critical.join(' ')).toMatch(/1 Betriebslauf\/-läufe in den letzten 24 h nicht erfolgreich und nicht behoben \(3:failed\)/);
    expect(formatReport({ mode: 'dry-run', outcome: 'ok', before: open, plan })).toMatch(/OpenAI HTTP 403 \(offen\)/);

    // Ein früherer erfolgreicher Lauf behebt keinen späteren Fehler.
    expect(resolvingRun([embedOk, failed403], { ...failed403, started_at: '2026-11-21T12:00:00Z' })).toBeNull();
    // Ausserhalb von 24 h: weder kritisch noch Hinweis, bleibt aber im 7-Tage-Protokoll.
    const old = classifyProblemRuns([{ id: 1, startedAt: '2026-11-19T10:00:00Z', resolvedBy: null }], NOW);
    expect(old).toEqual({ open: [], resolved: [] });
  });

  it('Sperreinträge der Alarm-Mail sind keine Betriebsläufe; nicht zugestellte Mail erscheint als Hinweis', async () => {
    const run = (id, modes, at, outcome, summary) => ({ id, modes, started_at: at, finished_at: at, outcome, lease_until: at, summary });
    const runs = [
      run(22, ['alarm-mail'], '2026-11-21T13:30:00Z', 'failed', { attempted: true, sent: false, reason: 'resend down' }),
      run(21, ['alarm-mail'], '2026-11-21T13:20:00Z', 'ok', { attempted: false, sent: false, reason: 'gedrosselt' }),
      run(20, ['index'], '2026-11-21T13:00:00Z', 'ok', { stepResults: { index: 'no-work' }, index: { jobs: 0 } }),
    ];
    const s = await collectStatus(makeClient(fixture({ opsRuns: runs })).client, { embeddingVersion: VERSION, now: NOW });
    expect(s.ops.recent.map((r) => r.id)).toEqual([20]);
    expect(s.ops.problemCount).toBe(0);
    expect(s.critical.join(' ')).not.toMatch(/nicht behoben/);
    expect(s.ops.lastAlarmMail).toEqual({ id: 22, at: '2026-11-21T13:30:00Z', outcome: 'failed', sent: false });
    expect(s.alarms.join(' ')).toMatch(/Letzte Alarm-Mail nicht bestätigt zugestellt \(Sperreintrag 22, failed\)/);
    // Offener Mail-Sperreintrag belegt die Sperre sichtbar (aktiv bzw. abgelaufen → kritisch).
    const stale = await collectStatus(makeClient(fixture({ opsRuns: [{ id: 23, modes: ['alarm-mail'], started_at: '2026-11-21T13:00:00Z', finished_at: null, outcome: null, lease_until: '2026-11-21T13:00:30Z', summary: null }] })).client, { embeddingVersion: VERSION, now: NOW });
    expect(stale.critical.join(' ')).toMatch(/Lauf 23 \(alarm-mail\) ist abgelaufen/);
  });

  it('abgelaufener, nicht abgeschlossener Lauf erscheint als kritischer Alarm', async () => {
    const runs = [{ id: 4, modes: ['index'], started_at: '2026-11-21T13:00:00Z', finished_at: null, outcome: null, lease_until: '2026-11-21T13:02:00Z', summary: null }];
    const { client } = makeClient(fixture({ opsRuns: runs }));
    const s = await collectStatus(client, { embeddingVersion: VERSION, now: NOW });
    expect(s.ops.stale).toEqual([{ id: 4, modes: ['index'], leaseUntil: '2026-11-21T13:02:00Z' }]);
    expect(s.critical.join(' ')).toMatch(/Lauf 4 .* abgelaufen/);
  });

  it('Laufsperre nicht angewendet: Hinweis statt Fehler; andere Fehler werden nicht verschluckt', async () => {
    const missing = makeClient(fixture({ opsRunsError: { code: 'PGRST205', message: 'Could not find the table' } }));
    const s = await collectStatus(missing.client, { embeddingVersion: VERSION, now: NOW });
    expect(s.ops).toEqual({ applied: false });
    expect(s.alarms.join(' ')).toMatch(/Laufsperre v2 nicht angewendet/);
    const denied = makeClient(fixture({ opsRunsError: { code: '42501', message: 'permission denied' } }));
    await expect(collectStatus(denied.client, { embeddingVersion: VERSION, now: NOW })).rejects.toThrow(/ai_search_ops_runs lesen/);
  });

  it('--alarm-exit: Trockenlauf mit kritischem Alarm endet mit Exit 5, ohne Alarm mit 0', async () => {
    const alarmed = makeClient(fixture()); // failed=1, ältester Job 48 h
    const r1 = await runOps(alarmed.client, parse(['--alarm-exit']).options, { embeddingVersion: VERSION, holder: 'h', clock: () => NOW });
    expect(r1).toMatchObject({ mode: 'dry-run', outcome: 'alarm', exitCode: 5 });
    expect(writes(alarmed.calls)).toEqual([]);
    const calm = makeClient(fixture({ failed: 0, oldestPending: '2026-11-21T13:00:00Z', oldestExpired: null, resultsExpired: 0 }));
    const r2 = await runOps(calm.client, parse(['--alarm-exit']).options, { embeddingVersion: VERSION, holder: 'h', clock: () => NOW });
    expect(r2).toMatchObject({ outcome: 'ok', exitCode: 0 });
  });
});

describe('Bericht „letzte erfolgreiche Verarbeitung“: nur echte Ergebnisse je Schritt', () => {
  const deps = (extra = {}) => ({ embeddingVersion: VERSION, holder: 'holder-1', clock: () => NOW, now: () => NOW.getTime(), ...extra });
  const releaseSummary = (calls) => calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_summary;

  it('classifyStep: verarbeitet, geprüft ohne Arbeitsbedarf und übersprungen werden unterschieden', () => {
    expect(classifyStep('index', { reconciliation: { enqueued: 0 }, worker: { fetchedJobs: 100 } })).toBe('processed');
    expect(classifyStep('index', { reconciliation: { enqueued: 2 }, worker: null, stoppedBy: 'runtime' })).toBe('processed');
    expect(classifyStep('index', { reconciliation: { enqueued: 0 }, worker: { fetchedJobs: 0, drained: true } })).toBe('no-work');
    expect(classifyStep('index', { reconciliation: { enqueued: 0 }, worker: null, stoppedBy: 'runtime' })).toBe('skipped');
    expect(classifyStep('embed', { embedded: 3, calls: 1 })).toBe('processed');
    expect(classifyStep('embed', { skipped: true, noWork: true, planned: 0, calls: 0 })).toBe('no-work');
    expect(classifyStep('embed', { skipped: true, reason: 'andere Version' })).toBe('skipped');
    expect(classifyStep('embed', { skipped: true, reason: 'Laufzeitgrenze erreicht' })).toBe('skipped');
    expect(classifyStep('embed', { planned: 2, embedded: 0, changedMeanwhile: 2, calls: 1 })).toBe('skipped');
    expect(classifyStep('embed', { failed: true })).toBeNull();
    expect(classifyStep('cleanup', { deleted: 4, batch: 100 })).toBe('processed');
    expect(classifyStep('cleanup', { deleted: 0, batch: 100 })).toBe('no-work');
    expect(classifyStep('cleanup', { skipped: true, reason: 'Laufzeitgrenze erreicht' })).toBe('skipped');
    expect(classifyStep('cleanup', undefined)).toBeNull();
  });

  it('stepResultOf: nicht ausgewählt → null; ältere Protokolle nur mit eindeutigem Beleg', () => {
    // Form des echten Laufs Nr. 4 (21.11.2026): Embedding übersprungen, nichts gelöscht.
    const run4 = { modes: ['index', 'embed', 'cleanup'], outcome: 'ok', summary: { index: { enqueued: 0, jobs: 100, failures: 0, stoppedBy: 'limit' }, embed: { calls: 0, actualUsd: null }, cleanup: { deleted: 0 } } };
    expect(stepResultOf(run4, 'index')).toBe('processed');
    expect(stepResultOf(run4, 'embed')).toBeNull();
    expect(stepResultOf(run4, 'cleanup')).toBe('no-work');
    expect(stepResultOf({ modes: ['index'], summary: { index: { jobs: 5 } } }, 'embed')).toBeNull();
    expect(stepResultOf({ modes: ['index'], summary: { index: { enqueued: 0 } } }, 'index')).toBeNull();
    expect(stepResultOf({ modes: ['embed'], summary: { stepResults: { embed: 'skipped' }, embed: { embedded: 9 } } }, 'embed')).toBe('skipped');
    expect(stepResultOf({ modes: ['embed'], summary: { stepResults: { embed: 'erfunden' } } }, 'embed')).toBeNull();
    expect(stepResultOf({ modes: ['cleanup-scheduled'], summary: { deleted: 0, expired_left: 0 } }, 'cleanup-scheduled')).toBe('no-work');
  });

  it('collectStatus: übersprungene, nicht ausgewählte und fehlgeschlagene Schritte aktualisieren nichts', async () => {
    const run = (id, modes, finished, outcome, summary) => ({ id, modes, started_at: finished, finished_at: finished, outcome, lease_until: finished, summary });
    const runs = [
      // neuester: nur Index ausgewählt → Embeddings/Bereinigung bleiben unberührt
      run(14, ['index'], '2026-11-21T13:50:00Z', 'ok', { stepResults: { index: 'no-work' }, index: { jobs: 0, enqueued: 0 } }),
      // fehlgeschlagen trotz verarbeiteter Daten → zählt nicht
      run(13, ['index'], '2026-11-21T13:40:00Z', 'failed', { stepResults: { index: 'processed' }, index: { jobs: 50 } }),
      // Embedding übersprungen (Laufzeit), Bereinigung ohne Arbeitsbedarf
      run(12, ['index', 'embed', 'cleanup'], '2026-11-21T13:30:00Z', 'ok', { stepResults: { index: 'processed', embed: 'skipped', cleanup: 'no-work' } }),
      // ältester: Embeddings tatsächlich gespeichert, Bereinigung gelöscht
      run(11, ['embed', 'cleanup'], '2026-11-21T12:00:00Z', 'ok', { stepResults: { embed: 'processed', cleanup: 'processed' }, embed: { embedded: 7, actualUsd: 0 } }),
    ];
    const { client } = makeClient(fixture({ opsRuns: runs }));
    const s = await collectStatus(client, { embeddingVersion: VERSION, now: NOW });
    expect(s.ops.lastProcessed).toEqual({ index: '2026-11-21T13:30:00Z', embed: '2026-11-21T12:00:00Z', cleanup: '2026-11-21T12:00:00Z', 'cleanup-scheduled': null });
    expect(s.ops.lastNoWork).toEqual({ index: '2026-11-21T13:50:00Z', embed: null, cleanup: '2026-11-21T13:30:00Z', 'cleanup-scheduled': null });
    expect(s.ops.lastOk).toBeUndefined();
    const text = formatReport({ mode: 'dry-run', outcome: 'ok', before: s, plan: (await runOps(client, parse([]).options, deps())).plan });
    expect(text).toMatch(/übersprungene oder nicht ausgewählte Schritte zählen nicht/);
    expect(text).toMatch(/Index: Daten verarbeitet 2026-11-21 13:30:00 UTC · geprüft ohne Arbeitsbedarf 2026-11-21 13:50:00 UTC/);
    expect(text).toMatch(/Embeddings: Daten verarbeitet 2026-11-21 12:00:00 UTC · geprüft ohne Arbeitsbedarf —/);
    expect(text).not.toMatch(/Letzter erfolgreicher Lauf/);
  });

  it('Laufprotokoll: stepResults nur für ausgewählte Schritte; Embedding ohne Lücke = geprüft, Bereinigung 0 = geprüft', async () => {
    const fx = fixture({ candidates: [], cleanupDeleted: 0, workerJobs: [{ id: 1, course_id: 42, reason: 'course_delete', priority: 5, source_version: 7, attempts: 0 }] });
    const { client, calls } = makeClient(fx);
    const report = await runOps(client, parse(['--execute-index', '--execute-embed', '--max-usd=0.01', '--execute-cleanup'], confirm).options,
      deps({ modelsEnabled: true, createGateway: () => fakeGateway() }));
    expect(report.outcome).toBe('ok');
    expect(report.stepResults).toEqual({ index: 'processed', embed: 'no-work', cleanup: 'no-work' });
    expect(releaseSummary(calls).stepResults).toEqual({ index: 'processed', embed: 'no-work', cleanup: 'no-work' });
    const text = formatReport(report);
    expect(text).toMatch(/Index: Daten verarbeitet – 1 Aufträge gelesen/);
    expect(text).toMatch(/Embeddings: erfolgreich geprüft, kein Arbeitsbedarf – Keine fehlenden/);
    expect(text).toMatch(/Bereinigung: erfolgreich geprüft, kein Arbeitsbedarf – 0 gelöscht/);

    const only = makeClient(fixture({ published: [1, 2], documents: [1, 2] }));
    const r2 = await runOps(only.client, parse(['--execute-index'], confirm).options, deps());
    expect(r2.stepResults).toEqual({ index: 'no-work' });
    expect(Object.keys(releaseSummary(only.calls).stepResults)).toEqual(['index']);
    const perStep = formatReport(r2).split('Ergebnis je Schritt:')[1].split('Schritte (Details)')[0];
    expect(perStep).toMatch(/Index: erfolgreich geprüft, kein Arbeitsbedarf/);
    expect(perStep).not.toMatch(/Embeddings|Bereinigung/);
  });

  it('Laufzeitgrenze: übersprungener Schritt wird als „skipped“ protokolliert und im Bericht so benannt', async () => {
    const clock = fakeClock();
    const { client, calls } = makeClient(fixture({ clockNow: clock.now }));
    const options = parse(['--execute-index', '--execute-cleanup', '--max-runtime-sec=60'], confirm).options;
    const report = await runOps(client, options, deps({ now: () => { const t = clock.now(); clock.advance(30_000); return t; } }));
    expect(report.outcome).toBe('ok');
    expect(releaseSummary(calls).stepResults.cleanup).toBe('skipped');
    expect(formatReport(report)).toMatch(/Bereinigung: übersprungen \(zählt nicht als Verarbeitung\) – Laufzeitgrenze erreicht/);
  });
});

describe('drainOutbox: Umfangsgrenze maxBatches', () => {
  it('bricht nach maxBatches ab, auch wenn noch Jobs offen sind', async () => {
    let served = 0;
    const { client } = createFakeSupabase((call) => {
      if (call.table === 'ai_search_jobs' && call.op === 'select') {
        served += 1;
        return { data: [{ id: served, course_id: served, priority: 5, source_version: 1, attempts: 0 }], error: null };
      }
      if (call.op === 'rpc') return { data: 'deleted', error: null };
      return { data: null, error: null };
    });
    const total = await drainOutbox(client, { maxBatches: 2, timeBudgetMs: 60_000 });
    expect(total.batches).toBe(2);
    expect(total.drained).toBe(false);
  });
});

describe('Laufsperre v2 (Migration 20261121225750) und Zeitplan-Entwurf 090100: statisch', async () => {
  const { readdirSync, existsSync } = await import('node:fs');
  const { composeDraftTest } = await import('../scripts/ai-search-draft-sql-test.mjs');
  const ROOT = path.resolve(__dirname, '..');
  const up = readFileSync(path.join(ROOT, 'supabase/migrations/20261121225750_ai_search_ops_lease_v2.sql'), 'utf8');
  const down = readFileSync(path.join(ROOT, 'supabase/rollback/20261121225750_ai_search_ops_lease_v2_down.sql'), 'utf8');
  const schedule = readFileSync(path.join(ROOT, 'supabase/drafts/20261122090100_ai_search_ops_cleanup_schedule.sql'), 'utf8');
  const scheduleDown = readFileSync(path.join(ROOT, 'supabase/drafts/20261122090100_ai_search_ops_cleanup_schedule_down.sql'), 'utf8');

  it('Laufsperre v2 genau einmal im Migrationsbestand (verbuchte Version), Zeitplan weiter nur Entwurf; v1 entfernt', () => {
    const migrations = readdirSync(path.join(ROOT, 'supabase/migrations'));
    expect(migrations.filter((f) => /ops_lease/.test(f))).toEqual(['20261121225750_ai_search_ops_lease_v2.sql']);
    expect(migrations.some((f) => /ops_cleanup/.test(f))).toBe(false);
    expect(readdirSync(path.join(ROOT, 'supabase/drafts')).some((f) => /20261122090000/.test(f))).toBe(false);
    expect(schedule).toMatch(/ENTWURF – NICHT ANWENDEN/);
    expect(existsSync(path.join(ROOT, 'supabase/drafts/20261121160000_ai_search_ops_lease.sql'))).toBe(false);
  });

  it('Sperre: exklusiv, kurze Frist mit Gesamtgrenze, Übernahme protokolliert', () => {
    expect(up).toMatch(/pg_advisory_xact_lock\(hashtextextended\('ai_search_ops_lease', 0\)\)/);
    expect(up).toMatch(/p_lease_seconds < 30 OR p_lease_seconds > 300/);
    expect(up).toMatch(/p_max_seconds > 1800/);
    expect(up).toMatch(/CHECK \(lease_until <= max_until\)/);
    expect(up).toMatch(/outcome = 'expired'[\s\S]*'taken_over_by'/);
    expect(OPS_LIMITS.maxRuntimeSec + OPS_LIMITS.leaseGraceSec).toBeLessThanOrEqual(1800);
  });

  it('Schreibschutz: jede geschützte Funktion prüft zuerst die Sperre (FOR SHARE, KNL01)', () => {
    expect(up).toMatch(/lease_until > now\(\) AND abort_requested_at IS NULL\s+FOR SHARE/);
    expect(up).toMatch(/ERRCODE = 'KNL01'/);
    const fenced = [...up.matchAll(/CREATE OR REPLACE FUNCTION public\.(ai_search_ops_fenced_\w+)\(([\s\S]*?)\nEND;\n\$\$;/g)];
    expect(fenced.map((m) => m[1]).sort()).toEqual([
      'ai_search_ops_fenced_apply_delete', 'ai_search_ops_fenced_apply_upsert', 'ai_search_ops_fenced_cleanup',
      'ai_search_ops_fenced_enqueue', 'ai_search_ops_fenced_job_failure', 'ai_search_ops_fenced_store_embeddings',
    ]);
    for (const [, name, body] of fenced) {
      const begin = body.indexOf('BEGIN');
      const firstStatement = body.slice(begin + 5).trim().split('\n')[0];
      expect(firstStatement, name).toBe('PERFORM ai_search_ops_assert_lease(p_run_id, p_holder);');
    }
    // Speichern nur bei unverändertem Text und aktiver Modellversion.
    expect(up).toMatch(/c\.content_hash = r->>'content_hash'/);
    expect(up).toMatch(/p_model_version <> \(SELECT active_model_version FROM ai_search_config WHERE id = 1\)/);
  });

  it('nur Serverrolle: REVOKE für alle neuen Funktionen und die Tabelle', () => {
    const created = [...up.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created).toHaveLength(12);
    for (const name of created) expect(up).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) FROM anon, authenticated, PUBLIC;`));
    expect(up).toMatch(/REVOKE ALL ON public\.ai_search_ops_runs FROM anon, authenticated/);
    // Rückweg entfernt jede neue Funktion und die Tabelle.
    for (const name of created) expect(down).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${name}\\(`));
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.ai_search_ops_runs;/);
  });

  it('Lease-Entwurf ändert keine bestehenden Objekte und plant nichts ein', () => {
    expect(up).not.toMatch(/ALTER TABLE public\.ai_search_(jobs|chunks|results|documents|usage)/);
    expect(up).not.toMatch(/CREATE OR REPLACE FUNCTION public\.ai_search_(apply|result|quota)_/);
    expect(up).not.toMatch(/cron\.schedule|CREATE EXTENSION/);
  });

  it('Zeitplan-Entwurf: genau ein stündlicher pg_cron-Job für die Löschung; Rückweg entfernt nur ihn', () => {
    const jobs = [...schedule.matchAll(/cron\.schedule\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g)];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].slice(1)).toEqual(['ai-search-ops-cleanup', '7 * * * *', 'SELECT public.ai_search_ops_cleanup_tick(5000, 10)']);
    expect(schedule).not.toMatch(/net\.http|http_post|resend|openai/i);
    expect(scheduleDown).toMatch(/cron\.unschedule\('ai-search-ops-cleanup'\)/);
    expect(scheduleDown).toMatch(/IF NOT EXISTS \(SELECT 1 FROM cron\.job\) THEN\s+DROP EXTENSION IF EXISTS pg_cron/);
  });

  it('Rollback-Test v2 setzt sich vollständig zusammen (28 Prüfungen, Dollar-Quoting erhalten)', () => {
    const { sql, migration, rollback } = composeDraftTest(ROOT, 'ops_lease_v2');
    expect(migration).toHaveLength(29);
    expect(rollback).toHaveLength(13);
    expect(sql).toMatch(/c_expected CONSTANT INTEGER := 28/);
    expect((sql.match(/v_checks := v_checks \+ 1/g) ?? []).length).toBe(28);
    expect((sql.match(/AS \$\$/g) ?? []).length).toBe(12);
    expect(sql).not.toMatch(/@@MIGRATION@@|@@ROLLBACK@@/);
  });

  it('Rollback-Test v2: Abschluss/Verlängerung jeweils als eigene Anweisung, Wirkung danach geprüft', () => {
    const testSql = readFileSync(path.join(ROOT, 'supabase/drafts/tests/20261121225750_ai_search_ops_lease_v2_test.sql'), 'utf8');
    for (const fn of ['ai_search_ops_lease_release', 'ai_search_ops_lease_renew']) {
      expect(testSql).not.toMatch(new RegExp(`(IF|OR|AND)\\s+(NOT\\s+)?${fn}\\(`));
      const lines = testSql.split('\n').filter((l) => new RegExp(`${fn}\\(v_`).test(l));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.trim()).toMatch(new RegExp(`^v_(txt|json) := ${fn}\\(`));
    }
    // Nur eigene Testdaten: keine bestehenden Jobs/Abschnitte als Probeobjekte,
    // eigene Testkurse, eigener Abschnitt, eigenes Konto mit eigenen Ergebnissen.
    expect(testSql).not.toMatch(/FROM ai_search_jobs WHERE status = 'pending' ORDER BY id LIMIT 1/);
    expect(testSql).not.toMatch(/FROM ai_search_chunks WHERE embedding IS NOT NULL/);
    expect(testSql).toMatch(/INSERT INTO courses \(title, status, user_id, description\)\s+VALUES \('ZZ Laufsperre-Test A', 'draft'/);
    expect(testSql).toMatch(/INSERT INTO ai_search_chunks [^;]*VALUES \(v_course,/);
    expect(testSql).toMatch(/'zz-ki-leasetest-'/);
    expect(testSql).toMatch(/INSERT INTO ai_search_results [^;]*FROM ai_search_usage WHERE user_id = v_user/);
    // Vor jeder Bereinigung: Abbruch, falls fremde abgelaufene Ergebnisse existieren.
    const guard = testSql.indexOf('fremde abgelaufene Ergebnisse vorhanden');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(testSql.indexOf('ai_search_ops_fenced_cleanup('));
    expect(guard).toBeLessThan(testSql.indexOf('ai_search_ops_cleanup_tick('));
    // Geschützte Schreibproben nur mit eigenen Objekten.
    expect(testSql).toMatch(/ai_search_ops_fenced_job_failure\(v_run, h1, ARRAY\[v_job\]/);
    expect(testSql).toMatch(/'id', v_chunk, 'content_hash', 'zz-hash-a'/);
  });
});

describe('Statisch: keine Nebenwirkungen des Cron-Endpunkts, keine Kosten in der CI', () => {
  const ROOT = path.resolve(__dirname, '..');
  const ops = readFileSync(path.join(ROOT, 'src/lib/aiSearch/ops.js'), 'utf8');
  const cli = readFileSync(path.join(ROOT, 'scripts/ai-search-ops.mjs'), 'utf8');
  const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');

  it('Runner nutzt weder Kontingent-Cleanup noch Mailversand noch den Cron-Endpunkt', () => {
    for (const source of [ops, cli]) {
      expect(source).not.toMatch(/rpc\('ai_search_quota_cleanup'/);
      expect(source).not.toMatch(/from 'resend'|sendEmail|cron-ai-search\.js/);
    }
    expect(ops).toMatch(/skipQuotaCleanup: true/);
  });

  it('CI ruft den Runner nicht auf (keine Betriebsläufe, keine kostenpflichtigen Aufrufe)', () => {
    expect(ci).not.toMatch(/ops:ai-test|ai-search-ops\.mjs|--execute-embed|embed:ai-test/);
  });

  it('Trockenlauf-Workflow: nur per Label, Aufruf ohne Schalter, ohne Bestätigung und ohne Modellschlüssel', () => {
    const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-ops-dryrun.yml'), 'utf8');
    expect(wf).toMatch(/types: \[labeled\]/);
    expect(wf).toMatch(/if: github\.event\.label\.name == 'ki-betrieb-trockenlauf'/);
    expect(wf).not.toMatch(/^\s*push:|schedule:|workflow_run:/m);
    expect(wf).toMatch(/^\s*run: npm run ops:ai-test\s*$/m);
    const runLines = wf.split('\n').filter((l) => /ops:ai-test|ai-search-ops/.test(l) && /run:/.test(l));
    expect(runLines).toHaveLength(1);
    expect(wf).not.toMatch(/--execute|--max-usd|AI_OPS_CONFIRM:|OPENAI|AI_SEARCH_MODELS_ENABLED/);
    expect(wf).toMatch(/permissions:\s*\n\s*contents: read/);
  });

  it('Zyklus-Workflow: vorbereitet, aber AUS – Label oder Zeitplan nur mit Schalter-Variable; kleine Kostengrenzen', () => {
    const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-ops-cycle.yml'), 'utf8');
    expect(wf).toMatch(/github\.event_name == 'pull_request' && github\.event\.label\.name == 'ki-betrieb-zyklus'/);
    expect(wf).toMatch(/github\.event_name == 'schedule' && vars\.AI_OPS_SCHEDULE_ENABLED == 'true'/);
    expect(wf).not.toMatch(/^\s*push:|workflow_run:/m);
    const runs = wf.split('\n').filter((l) => /^\s*run: npm run ops:ai-test/.test(l));
    expect(runs).toHaveLength(4);
    for (const line of runs.filter((l) => /--execute-embed/.test(l))) {
      expect(line).toMatch(/--max-usd=0\.01(\s|$)/);
      expect(line).toMatch(/--max-runtime-sec=(180|300)(\s|$)/);
    }
    expect(wf).toMatch(/timeout-minutes: 12/);
    expect(wf).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(wf).not.toMatch(/resend|RESEND|ai_search_quota_cleanup|cron-ai-search/);
  });

  it('Vercel-Crons: die zwei bestehenden unverändert, einziger Zusatz ist der Betriebs-Cron mit Laufsperre', () => {
    const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.crons).toEqual([
      { path: '/api/cron', schedule: '0 12 * * *' },
      { path: '/api/cron-lead-scoring', schedule: '0 2 1 * *' },
      { path: '/api/cron-ai-ops', schedule: '*/15 * * * *' },
    ]);
    // Der alte Endpunkt ohne Laufsperre bekommt keinen Zeitplan.
    expect(JSON.stringify(vercel.crons)).not.toMatch(/cron-ai-search/);
  });

  it('Runner nur gegen die TESTumgebung (strikter URL-Parser der DB-Tests)', () => {
    expect(cli).toMatch(/checkTestTarget\(process\.env\)/);
    expect(cli.indexOf('checkTestTarget(process.env)')).toBeLessThan(cli.indexOf('createClient('));
  });
});
