/**
 * Kontrollierter Abbau des Indexrückstands (src/lib/aiSearch/indexBacklog.js,
 * scripts/ai-search-index-backlog.mjs, .github/workflows/ai-index-backlog.yml).
 *
 * Ohne Netz: Zustand und Zyklen sind Fakes. Geprüft werden vor allem die
 * Halt-Regeln (leer, Fehler, Sperrverlust, anderer Lauf, kein Fortschritt,
 * Grenzen) und dass nur der Indexbefehl ohne Modellzugang läuft.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  runBacklog, checkBeforeCycle, evaluateCycle, INDEX_CYCLE_ARGS, BACKLOG_LIMITS, STOP,
} from '../src/lib/aiSearch/indexBacklog.js';
import { checkBacklogEnv, cycleEnv, CYCLE_COMMAND } from '../scripts/ai-search-index-backlog.mjs';

const REF = 'omoapbvfligjfznzivyu';
const TEST_URL = `https://${REF}.supabase.co`;

const status = (pending, over = {}) => ({
  jobs: { pending, pendingCourses: pending, failed: 0, ...(over.jobs ?? {}) },
  ops: { applied: true, active: [], stale: [], ...(over.ops ?? {}) },
  coverage: { published: 803, documents: 803, missingInIndex: 0, orphanedInIndex: 0 },
  embeddings: { needEmbedding: 0 },
  freshness: { oldestPendingAt: null },
  ...over.extra,
});

/** Zyklusergebnis wie vom Runner (--json): liest `read` Aufträge, offen danach `after`. */
const cycle = (before, read, after, over = {}) => ({
  exitCode: over.exitCode ?? 0,
  stderr: '',
  report: {
    mode: 'execute', outcome: over.outcome ?? 'ok', runId: over.runId ?? 100, durationMs: 70_000,
    error: over.error ?? null,
    before: { jobs: { pending: before, failed: 0 } },
    after: over.afterError ? { error: over.afterError } : { jobs: { pending: after, failed: over.failedAfter ?? 0 } },
    steps: { index: { reconciliation: { enqueued: 0 }, worker: { batches: 2, fetchedJobs: read, courses: read, inserted: 0, updated: read, refreshed: 0, repaired: 0, deleted: 0, staleSkipped: 0, failures: over.failures ?? 0, errors: [], drained: after === 0 } } },
    stepResults: { index: read > 0 ? 'processed' : 'no-work' },
  },
});

/** Simulierte TESTdatenbank: jeder Zyklus erledigt `perCycle` Aufträge. */
function simulate({ pending, perCycle = 136, read = 100, script = {} }) {
  let open = pending;
  const runs = [];
  let reads = 0;
  return {
    runs,
    get reads() { return reads; },
    readStatus: async () => { reads += 1; return script.status?.(reads, open) ?? status(open); },
    runCycle: async (n) => {
      runs.push(n);
      if (script.cycle) { const r = script.cycle(n, open); if (r) return r; }
      const before = open;
      const done = Math.min(perCycle, open);
      open -= done;
      return cycle(before, Math.min(read, before), open);
    },
  };
}

describe('Abbau: Grenzen und planmässiges Ende', () => {
  it('liest zuerst den Zustand, dann seriell höchstens 10 Zyklen und ≤ 1 000 gelesene Aufträge', async () => {
    const db = simulate({ pending: 5000, perCycle: 120 });
    const result = await runBacklog(db);
    expect(db.runs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.jobsRead).toBe(1000);
    // beide Grenzen gleichzeitig erreicht; die Zyklengrenze wird zuerst geprüft
    expect(result.stop.code).toBe('max-cycles');
    expect(result.stop.exit).toBe(0);
    expect(result.start.jobs.pending).toBe(5000);
    // Anfangszustand + Zustandsprüfung nach jedem Zyklus
    expect(db.reads).toBe(11);
  });

  it('Zyklengrenze greift auch bei kleinen Zyklen (10 × 30 Aufträge)', async () => {
    const db = simulate({ pending: 5000, perCycle: 30, read: 30 });
    const result = await runBacklog(db);
    expect(db.runs).toHaveLength(10);
    expect(result.jobsRead).toBe(300);
    expect(result.stop.code).toBe('max-cycles');
  });

  it('leere Warteschlange: Halt sofort nach dem Zyklus, der sie leert', async () => {
    const db = simulate({ pending: 250, perCycle: 136 });
    const result = await runBacklog(db);
    expect(db.runs).toEqual([1, 2]);
    expect(result.stop.code).toBe('empty');
    expect(result.cycles.map((c) => [c.pendingBefore, c.pendingAfter])).toEqual([[250, 114], [114, 0]]);
  });

  it('schon zu Beginn leer: kein einziger Zyklus', async () => {
    const db = simulate({ pending: 0 });
    const result = await runBacklog(db);
    expect(db.runs).toEqual([]);
    expect(result.stop.code).toBe('empty');
  });
});

describe('Abbau: sofortiger Halt, keine Wiederholung', () => {
  it('Fehler im Zyklus (Exit 1): Halt, kein weiterer Zyklus', async () => {
    const db = simulate({ pending: 900, script: { cycle: (n, open) => (n === 2 ? cycle(open, 50, open - 50, { exitCode: 1, outcome: 'failed', error: 'Index: 1 Kurs(e) fehlgeschlagen' }) : null) } });
    const result = await runBacklog(db);
    expect(db.runs).toEqual([1, 2]);
    expect(result.stop).toMatchObject({ code: 'error', exit: 1 });
    expect(result.stop.detail).toMatch(/fehlgeschlagen/);
  });

  it('Sperrverlust (Exit 4 / lost) und Abbruch: Halt mit Exit 4', async () => {
    for (const over of [{ exitCode: 4, outcome: 'lost' }, { exitCode: 4, outcome: 'aborted' }]) {
      const db = simulate({ pending: 900, script: { cycle: (n, open) => cycle(open, 20, open - 20, over) } });
      const result = await runBacklog(db);
      expect(db.runs).toEqual([1]);
      expect(result.stop).toMatchObject({ code: 'lease', exit: 4 });
    }
  });

  it('anderer Lauf hält die Sperre (Exit 3): Halt ohne Wiederholung', async () => {
    const db = simulate({ pending: 900, script: { cycle: (n, open) => ({ exitCode: 3, stderr: '', report: { outcome: 'locked', message: 'Ein anderer Betriebsdurchlauf ist aktiv', before: { jobs: { pending: open, failed: 0 } }, steps: {} } }) } });
    const result = await runBacklog(db);
    expect(db.runs).toEqual([1]);
    expect(result.stop).toMatchObject({ code: 'parallel', exit: 3 });
  });

  it('anderer aktiver Lauf in der Zustandsprüfung: kein (weiterer) Zyklus', async () => {
    const busy = { ops: { active: [{ id: 5, modes: ['index', 'embed', 'cleanup'] }] } };
    const atStart = simulate({ pending: 900, script: { status: (n, open) => status(open, busy) } });
    expect((await runBacklog(atStart)).stop.code).toBe('parallel');
    expect(atStart.runs).toEqual([]);
    const between = simulate({ pending: 900, script: { status: (n, open) => (n === 2 ? status(open, busy) : status(open)) } });
    const result = await runBacklog(between);
    expect(between.runs).toEqual([1]);
    expect(result.stop.detail).toMatch(/Lauf 5/);
  });

  it('kein Fortschritt (0 gelesen oder offene Aufträge nicht weniger): Halt mit Exit 6', async () => {
    const none = simulate({ pending: 900, script: { cycle: (n, open) => cycle(open, 0, open) } });
    expect((await runBacklog(none)).stop).toMatchObject({ code: 'no-progress', exit: 6 });
    expect(none.runs).toEqual([1]);
    // gelesen, aber Warteschlange wächst (z. B. neue Einreihungen): ebenfalls Halt
    const growing = simulate({ pending: 900, script: { cycle: (n, open) => cycle(open, 100, open + 10) } });
    expect((await runBacklog(growing)).stop.code).toBe('no-progress');
    expect(growing.runs).toEqual([1]);
  });

  it('neue fehlgeschlagene Aufträge: Halt (im Zyklusbericht oder in der Zustandsprüfung)', async () => {
    const inCycle = simulate({ pending: 900, script: { cycle: (n, open) => cycle(open, 100, open - 100, { failedAfter: 1 }) } });
    expect((await runBacklog(inCycle)).stop.code).toBe('error');
    const inStatus = simulate({ pending: 900, script: { status: (n, open) => status(open, { jobs: { failed: n >= 2 ? 1 : 0 } }) } });
    const result = await runBacklog(inStatus);
    expect(inStatus.runs).toEqual([1]);
    expect(result.stop.detail).toMatch(/Fehlgeschlagene Aufträge 0 → 1/);
  });

  it('unlesbarer Bericht, Ausnahme im Zyklus oder unlesbarer Zustand: Halt als Fehler', async () => {
    const noJson = simulate({ pending: 900, script: { cycle: () => ({ exitCode: 2, report: null, stderr: 'Abbruch: Bestätigung fehlt' }) } });
    const r1 = await runBacklog(noJson);
    expect(r1.stop.code).toBe('error');
    expect(r1.stop.detail).toMatch(/Bestätigung fehlt/);
    const throwing = simulate({ pending: 900, script: { cycle: () => { throw new Error('spawn ENOENT'); } } });
    expect((await runBacklog(throwing)).stop.code).toBe('error');
    const afterErr = simulate({ pending: 900, script: { cycle: (n, open) => cycle(open, 100, open, { afterError: 'Zeitlimit' }) } });
    expect((await runBacklog(afterErr)).stop.code).toBe('error');
    let reads = 0;
    const r4 = await runBacklog({ readStatus: async () => { reads += 1; if (reads > 1) throw new Error('Netz weg'); return status(900); }, runCycle: async () => cycle(900, 100, 800) });
    expect(r4.stop.detail).toMatch(/nach Zyklus 1 nicht lesbar/);
    const r5 = await runBacklog({ readStatus: async () => { throw new Error('Netz weg'); }, runCycle: async () => { throw new Error('darf nicht laufen'); } });
    expect(r5.stop.code).toBe('error');
    expect(r5.cycles).toEqual([]);
  });

  it('Laufsperre v2 fehlt: kein Zyklus (Vorbedingung)', async () => {
    const db = simulate({ pending: 900, script: { status: (n, open) => status(open, { ops: { applied: false } }) } });
    const result = await runBacklog(db);
    expect(db.runs).toEqual([]);
    expect(result.stop).toMatchObject({ code: 'precondition', exit: 2 });
  });

  it('Signal: kein weiterer Zyklus nach dem laufenden', async () => {
    let stop = false;
    const db = simulate({ pending: 900, script: { cycle: (n, open) => { stop = true; return cycle(open, 100, open - 100); } } });
    const result = await runBacklog({ ...db, readStatus: db.readStatus, runCycle: db.runCycle, shouldStop: () => stop });
    expect(db.runs).toEqual([1]);
    expect(result.stop.code).toBe('signal');
  });

  it('Sicherheitsnetz: mehr als 100 Aufträge in einem Zyklus → Halt', () => {
    const ev = evaluateCycle(cycle(900, 150, 750));
    expect(ev.stop.code).toBe('job-limit');
  });

  it('checkBeforeCycle: Grenze so, dass 1 000 gelesene Aufträge nie überschritten werden', () => {
    const ctx = { cycles: 9, jobsRead: 901, failedAtStart: 0 };
    expect(checkBeforeCycle(status(500), ctx).code).toBe('job-limit');
    expect(checkBeforeCycle(status(500), { ...ctx, jobsRead: 900 })).toBeNull();
    expect(checkBeforeCycle(status(500), { ...ctx, cycles: 10, jobsRead: 0 }).code).toBe('max-cycles');
    expect(STOP.empty.exit).toBe(0);
  });
});

describe('Nur Index, nur TEST, ohne Modellzugang', () => {
  it('Zyklusbefehl ist genau der freigegebene Indexbefehl (+ --json für die Auswertung)', () => {
    expect(INDEX_CYCLE_ARGS).toEqual(['--execute-index', '--max-runtime-sec=180', '--max-index-batches=2', '--max-enqueue=50']);
    expect(CYCLE_COMMAND).toEqual(['run', '--silent', 'ops:ai-test', '--', ...INDEX_CYCLE_ARGS, '--json']);
    expect(CYCLE_COMMAND.join(' ')).not.toMatch(/--execute-embed|--execute-cleanup|--max-usd/);
    expect(BACKLOG_LIMITS).toEqual({ maxCycles: 10, maxJobsTotal: 1000, jobsPerCycle: 100 });
  });

  it('Start nur mit TEST-Ziel und Bestätigung; Modellschlüssel oder Modellfreigabe → verweigert', () => {
    const base = { SUPABASE_URL_TEST: TEST_URL, SUPABASE_SECRET_KEY_TEST: 's', SUPABASE_PUBLISHABLE_KEY_TEST: 'p', AI_OPS_CONFIRM: REF };
    expect(checkBacklogEnv(base).ok).toBe(true);
    expect(checkBacklogEnv({ ...base, AI_OPS_CONFIRM: undefined }).errors.join(' ')).toMatch(/AI_OPS_CONFIRM/);
    expect(checkBacklogEnv({ ...base, OPENAI_API_KEY: 'sk-x' }).ok).toBe(false);
    expect(checkBacklogEnv({ ...base, AI_SEARCH_MODELS_ENABLED: '1' }).ok).toBe(false);
    expect(checkBacklogEnv({ ...base, SUPABASE_URL_TEST: 'https://abcdefghijklmnopqrst.supabase.co' }).ok).toBe(false);
  });

  it('Zyklus erhält nur die drei TEST-Werte und die Bestätigung – keinen Modellschlüssel', () => {
    const env = cycleEnv({ PATH: '/bin', SUPABASE_URL_TEST: TEST_URL, SUPABASE_SECRET_KEY_TEST: 's', SUPABASE_PUBLISHABLE_KEY_TEST: 'p', AI_OPS_CONFIRM: REF, OPENAI_API_KEY: 'sk-x', AI_SEARCH_MODELS_ENABLED: '1', SUPABASE_URL: 'https://prod.example' });
    expect(env).toEqual({ PATH: '/bin', SUPABASE_URL_TEST: TEST_URL, SUPABASE_SECRET_KEY_TEST: 's', SUPABASE_PUBLISHABLE_KEY_TEST: 'p', AI_OPS_CONFIRM: REF });
  });

  it('Skript nutzt weder Embedding-Aufrufe noch Bereinigung noch Mailversand', () => {
    const ROOT = path.resolve(__dirname, '..');
    for (const file of ['scripts/ai-search-index-backlog.mjs', 'src/lib/aiSearch/indexBacklog.js']) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      expect(source).not.toMatch(/createOpenAiGateway|runEmbedStep|runCleanupStep|ai_search_quota_cleanup|ai_search_ops_fenced_cleanup|resend|sendEmail/);
      expect(source).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    }
  });
});

describe('Workflow ki-index-rueckstand: statisch', () => {
  const ROOT = path.resolve(__dirname, '..');
  const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-index-backlog.yml'), 'utf8');

  it('nur per Label an einem PR dieses Repositorys; kein Push, kein Zeitplan', () => {
    expect(wf).toMatch(/types: \[labeled\]/);
    expect(wf).toMatch(/github\.event\.label\.name == 'ki-index-rueckstand'/);
    expect(wf).toMatch(/github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
    expect(wf).not.toMatch(/^\s*(push|schedule|workflow_run|workflow_dispatch):/m);
    expect(wf).not.toMatch(/ki-betrieb-zyklus'/);
  });

  it('drei TEST-Secrets + Bestätigung; kein Modellschlüssel, keine Modellfreigabe, keine weiteren Schritte', () => {
    expect(wf).toMatch(/SUPABASE_URL_TEST: \$\{\{ secrets\.SUPABASE_URL_TEST \}\}/);
    expect(wf).toMatch(/SUPABASE_SECRET_KEY_TEST: \$\{\{ secrets\.SUPABASE_SECRET_KEY_TEST \}\}/);
    expect(wf).toMatch(/SUPABASE_PUBLISHABLE_KEY_TEST: \$\{\{ secrets\.SUPABASE_PUBLISHABLE_KEY_TEST \}\}/);
    expect(wf).toMatch(/AI_OPS_CONFIRM: omoapbvfligjfznzivyu/);
    expect(wf).not.toMatch(/OPENAI|AI_SEARCH_MODELS_ENABLED|--execute-embed|--execute-cleanup|--max-usd/);
    expect(wf.match(/secrets\./g)).toHaveLength(3);
    const runs = wf.split('\n').filter((l) => /^\s*run:/.test(l)).map((l) => l.trim());
    expect(runs).toEqual(['run: npm ci', 'run: npm run ops:ai-index-backlog']);
  });

  it('nie parallel zum Betriebszyklus (gleiche Concurrency-Gruppe, keine Abbrüche), Lesezugriff, Zeitlimit', () => {
    expect(wf).toMatch(/concurrency:\s*\n\s*group: ki-betrieb-zyklus\s*\n\s*cancel-in-progress: false/);
    expect(wf).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(wf).toMatch(/timeout-minutes: 60/);
  });

  it('npm-Skript zeigt auf den Abbau-Runner', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['ops:ai-index-backlog']).toBe('node scripts/ai-search-index-backlog.mjs');
    expect(pkg.scripts['ops:ai-test']).toBe('node scripts/ai-search-ops.mjs');
  });
});
