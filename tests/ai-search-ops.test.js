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
  OPS_LIMITS, OpsError,
} from '../src/lib/aiSearch/ops.js';
import { drainOutbox } from '../src/lib/aiSearch/worker.js';
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
    workerJobs: [],
    leaseResult: { data: 77, error: null },
    cleanupDeleted: 1,
    changedMeanwhile: [],
    ...over,
  };
}

const WRITE_OPS = new Set(['insert', 'update', 'upsert', 'delete']);
const writes = (calls) => calls.filter((c) => WRITE_OPS.has(c.op) || (c.op === 'rpc' && c.table !== 'ai_search_month_key'));

function makeClient(fx) {
  return createFakeSupabase((call) => {
    const { table, op } = call;
    const eqStatus = filterValue(call, 'eq', 'status');
    if (op === 'rpc') {
      if (table === 'ai_search_ops_lease_acquire') return fx.leaseResult;
      if (table === 'ai_search_ops_lease_release') return { data: true, error: null };
      if (table === 'ai_search_result_cleanup') return { data: fx.cleanupDeleted, error: null };
      if (table === 'ai_search_apply_delete') return { data: 'deleted', error: null };
      return { data: null, error: null };
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
    if (table === 'profiles' || table === 'v_course_full_categories') return { data: null, error: null };
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
    expect(s.results).toEqual({ stored: 4, expired: 1 });
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

describe('Schreibende Läufe: Laufsperre, Grenzen, keine Nebenwirkungen', () => {
  const deps = (extra = {}) => ({ embeddingVersion: VERSION, holder: 'holder-1', clock: () => NOW, ...extra });

  it('Index: Sperre mit Frist Laufzeit + 120 s, Abgleich OHNE Kontingent-Cleanup, Sperre freigegeben', async () => {
    const { client, calls } = makeClient(fixture());
    const report = await runOps(client, parse(['--execute-index', '--max-runtime-sec=600'], confirm).options, deps());
    expect(report.outcome).toBe('ok');
    const acquire = calls.find((c) => c.table === 'ai_search_ops_lease_acquire');
    expect(acquire.payload).toEqual({ p_holder: 'holder-1', p_modes: ['index'], p_lease_seconds: 720 });
    expect(calls.some((c) => c.table === 'ai_search_quota_cleanup')).toBe(false);
    expect(calls.some((c) => c.table === 'ai_search_result_cleanup')).toBe(false);
    const release = calls.find((c) => c.table === 'ai_search_ops_lease_release');
    expect(release.payload).toMatchObject({ p_run_id: 77, p_holder: 'holder-1', p_outcome: 'ok' });
    // Abgleich reiht verwaisten (9, Vorrang 1) und fehlenden (3, Vorrang 5) Kurs ein.
    const inserted = calls.filter((c) => c.table === 'ai_search_jobs' && c.op === 'insert').flatMap((c) => c.payload);
    expect(inserted.map((r) => [r.course_id, r.priority])).toEqual([['9', 1], ['3', 5]]);
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
    expect(calls.some((c) => c.table === 'ai_search_result_cleanup')).toBe(false);
  });

  it('Rechte-/Transportfehler der Sperre wird nicht als „fehlt“ gewertet', async () => {
    const { client } = makeClient(fixture({ leaseResult: { data: null, error: { code: '42501', message: 'permission denied' } } }));
    const run = runOps(client, parse(['--execute-cleanup'], confirm).options, deps());
    await expect(run).rejects.toBeInstanceOf(OpsError);
    await expect(runOps(client, parse(['--execute-cleanup'], confirm).options, deps())).rejects.toThrow(/nicht prüfbar/);
  });

  it('Bereinigung: genau eine Bereinigung mit der Lauf-Grenze', async () => {
    const { client, calls } = makeClient(fixture({ cleanupDeleted: 1 }));
    const report = await runOps(client, parse(['--execute-cleanup', '--cleanup-batch=250'], confirm).options, deps());
    expect(report.steps.cleanup).toEqual({ deleted: 1, batch: 250 });
    expect(calls.filter((c) => c.table === 'ai_search_result_cleanup')).toHaveLength(1);
    expect(calls.find((c) => c.table === 'ai_search_result_cleanup').payload).toEqual({ p_batch: 250 });
  });

  it('Embeddings ohne Modellfreigabe: Abbruch VOR der Sperre', async () => {
    const { client, calls } = makeClient(fixture());
    await expect(runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options, deps({ modelsEnabled: false })))
      .rejects.toMatchObject({ exitCode: 2 });
    expect(writes(calls)).toEqual([]);
  });

  it('Embeddings: nur unveränderte Abschnitte speichern (content_hash), Rest als „zwischenzeitlich geändert“', async () => {
    const fx = fixture({ changedMeanwhile: [12] });
    const { client, calls } = makeClient(fx);
    const gw = fakeGateway();
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ modelsEnabled: true, createGateway: () => gw }));
    expect(report.outcome).toBe('ok');
    expect(report.steps.embed).toMatchObject({ planned: 2, embedded: 1, changedMeanwhile: 1, calls: 1 });
    const updates = calls.filter((c) => c.table === 'ai_search_chunks' && c.op === 'update');
    expect(updates.map((u) => filterValue(u, 'eq', 'content_hash'))).toEqual(['h11', 'h12']);
    expect(updates[0].payload.model_version).toBe(VERSION);
  });

  it('Embeddings: Schätzung über der Grenze → kein einziger Modellaufruf, Lauf „failed“, Sperre frei', async () => {
    const big = Array.from({ length: 3 }, (_, i) => ({ id: i, course_id: 1, content_hash: `h${i}`, text: 'x'.repeat(4_000_000) }));
    const { client, calls } = makeClient(fixture({ candidates: big }));
    const gw = fakeGateway();
    const report = await runOps(client, parse(['--execute-embed', '--max-usd=0.01'], confirm).options,
      deps({ modelsEnabled: true, createGateway: () => gw }));
    expect(report).toMatchObject({ outcome: 'failed', exitCode: 2 });
    expect(gw.calls).toEqual([]);
    expect(calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_outcome).toBe('failed');
  });

  it('Embeddings: andere aktive Modellversion → übersprungen (kein Modellwechsel im Runner)', async () => {
    const gw = fakeGateway();
    const result = await runEmbedStep({}, gw, {
      version: VERSION, activeVersion: 'anderes@1024', candidates: fixture().candidates, maxChunks: 10, maxUsd: 1, deadline: Infinity,
    });
    expect(result.skipped).toBe(true);
    expect(gw.calls).toEqual([]);
  });

  it('Embeddings: Umfangsgrenze und tatsächlicher Verbrauch über Grenze stoppen weitere Aufrufe', async () => {
    const many = Array.from({ length: 350 }, (_, i) => ({ id: i, course_id: 1, content_hash: `h${i}`, text: 'abcd' }));
    const { client } = makeClient(fixture());
    const gw = fakeGateway({ tokensPerCall: 600_000 }); // 0.012 USD je Aufruf
    const result = await runEmbedStep(client, gw, {
      version: VERSION, activeVersion: VERSION, candidates: many, maxChunks: 300, maxUsd: 0.02, deadline: Infinity,
    });
    expect(result.planned).toBe(300);
    expect(gw.calls).toEqual([100, 100]); // dritter Aufruf: Verbrauch 0.024 > 0.02
    expect(result.stoppedBy).toBe('usd');
  });

  it('Indexfehler stoppt die folgenden Schritte (keine Bereinigung danach)', async () => {
    const fx = fixture({
      workerJobs: [{ id: 1, course_id: 42, reason: 'course_upsert', priority: 5, source_version: 1, attempts: 0 }],
      courseError: { message: 'Verbindung verloren' },
    });
    const { client, calls } = makeClient(fx);
    const report = await runOps(client, parse(['--execute-index', '--execute-cleanup'], confirm).options, deps());
    expect(report.outcome).toBe('failed');
    expect(report.error).toMatch(/fehlgeschlagen/);
    expect(calls.some((c) => c.table === 'ai_search_result_cleanup')).toBe(false);
    expect(calls.find((c) => c.table === 'ai_search_ops_lease_release').payload.p_outcome).toBe('failed');
  });

  it('Laufzeitgrenze erreicht: spätere Schritte werden übersprungen statt begonnen', async () => {
    const clock = fakeClock();
    const { client, calls } = makeClient(fixture());
    const options = parse(['--execute-index', '--execute-cleanup', '--max-runtime-sec=60'], confirm).options;
    const report = await runOps(client, options, deps({
      now: () => { const t = clock.now(); clock.advance(30_000); return t; },
    }));
    expect(report.steps.cleanup).toEqual({ skipped: true, reason: 'Laufzeitgrenze erreicht' });
    expect(calls.some((c) => c.table === 'ai_search_result_cleanup')).toBe(false);
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

describe('Entwurf 20261121160000 (Laufsperre): statisch, nicht angewendet', async () => {
  const { readdirSync } = await import('node:fs');
  const { composeDraftTest } = await import('../scripts/ai-search-draft-sql-test.mjs');
  const ROOT = path.resolve(__dirname, '..');
  const up = readFileSync(path.join(ROOT, 'supabase/drafts/20261121160000_ai_search_ops_lease.sql'), 'utf8');

  it('liegt nicht im Migrationsbestand und ist als Entwurf markiert', () => {
    expect(readdirSync(path.join(ROOT, 'supabase/migrations')).some((f) => f.includes('ops_lease'))).toBe(false);
    expect(up).toMatch(/ENTWURF – NICHT ANWENDEN/);
  });

  it('exklusiv über Advisory-Lock, Frist begrenzt, nur eigener Halter gibt frei, nur Serverrolle', () => {
    expect(up).toMatch(/pg_advisory_xact_lock\(hashtextextended\('ai_search_ops_lease', 0\)\)/);
    expect(up).toMatch(/p_lease_seconds < 60 OR p_lease_seconds > 1800/);
    expect(up).toMatch(/WHERE id = p_run_id AND holder = p_holder AND finished_at IS NULL/);
    expect(up).toMatch(/REVOKE EXECUTE ON FUNCTION public\.ai_search_ops_lease_acquire\(UUID, TEXT\[\], INTEGER\) FROM anon, authenticated, PUBLIC/);
    expect(up).toMatch(/REVOKE ALL ON public\.ai_search_ops_runs FROM anon, authenticated/);
    // Frist muss die maximale Laufzeit plus Reserve abdecken.
    expect(OPS_LIMITS.maxRuntimeSec + OPS_LIMITS.leaseGraceSec).toBeLessThanOrEqual(1800);
  });

  it('Rollback-Test setzt sich vollständig zusammen (12 Prüfungen, Dollar-Quoting erhalten)', () => {
    const { sql, migration, rollback } = composeDraftTest(ROOT, 'ops_lease');
    expect(migration).toHaveLength(8);
    expect(rollback).toHaveLength(3);
    expect(sql).toMatch(/c_expected CONSTANT INTEGER := 12/);
    expect((sql.match(/v_checks := v_checks \+ 1/g) ?? []).length).toBe(12);
    expect((sql.match(/AS \$\$/g) ?? []).length).toBe(2);
    expect(sql).not.toMatch(/@@MIGRATION@@|@@ROLLBACK@@/);
  });

  it('Regression: Freigabe läuft als eigene Anweisung, Wirkung wird erst danach geprüft', () => {
    const testSql = readFileSync(path.join(ROOT, 'supabase/drafts/tests/20261121160000_ai_search_ops_lease_test.sql'), 'utf8');
    const lines = testSql.split('\n');
    // Jeder Aufruf der Freigabe (ausser Rechte-/Existenzprüfung über den
    // Signaturtext) steht allein in einer Zuweisung an v_bool.
    const calls = lines.filter((l) => /ai_search_ops_lease_release\(v_/.test(l));
    expect(calls).toHaveLength(3);
    for (const line of calls) {
      expect(line.trim()).toMatch(/^v_bool := ai_search_ops_lease_release\(v_id, h[12], '[^']*', '[^']*'::jsonb\);$/);
    }
    // Altes Muster (Funktion und Prüfung derselben Zeile in EINER Bedingung) ist weg.
    expect(testSql).not.toMatch(/IF\s+(NOT\s+)?ai_search_ops_lease_release\(/);
    expect(testSql).not.toMatch(/(OR|AND)\s+(NOT\s+)?ai_search_ops_lease_release\(/);
    // Nach der eigenen Freigabe wird finished_at ausdrücklich geprüft.
    expect(testSql).toMatch(/v_bool IS DISTINCT FROM TRUE\s+OR \(SELECT finished_at FROM ai_search_ops_runs WHERE id = v_id\) IS NULL/);
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

  it('Runner nur gegen die TESTumgebung (strikter URL-Parser der DB-Tests)', () => {
    expect(cli).toMatch(/checkTestTarget\(process\.env\)/);
    expect(cli.indexOf('checkTestTarget(process.env)')).toBeLessThan(cli.indexOf('createClient('));
  });
});
