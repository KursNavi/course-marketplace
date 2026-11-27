/**
 * Vercel-Cron für den Produktionsbetrieb der KI-Suche (api/cron-ai-ops.js, 27.11.2026).
 * Kein Netz, keine Datenbank, keine Modellaufrufe: Supabase (zustandsbehaftete
 * Nachbildung der Laufsperre), Runner und Mailversand sind nachgebildet.
 * Geprüft werden Schutz, Umschalter, Grenzen, Laufzeitbudget, Abschlussprüfung
 * und die serverseitig gedrosselte Alarm-Mail.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

let currentClient = null;
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => currentClient) }));
vi.mock('resend', () => ({ Resend: class { constructor() { this.emails = { send: vi.fn() }; } } }));
vi.mock('../api/_lib/email-config.js', async (importOriginal) => ({ ...(await importOriginal()), sendEmailOrThrow: vi.fn(async () => ({ id: 'x' })) }));
vi.mock('../src/lib/aiSearch/ops.js', async (importOriginal) => ({ ...(await importOriginal()), runOps: vi.fn() }));

const cron = await import('../api/cron-ai-ops.js');
const { default: handler, CRON_OPS_ARGS, CRON_MAX_DURATION_SEC, TOTAL_BUDGET_MS, MAIL_RESERVE_MS, checkOpsCronTarget, assessReport, createBudget, budgetFetch } = cron;
const { runOps, parseOpsArgs, STEP_MS, OPS_LIMITS } = await import('../src/lib/aiSearch/ops.js');
const { sendEmailOrThrow } = await import('../api/_lib/email-config.js');
const { createClient } = await import('@supabase/supabase-js');
const { PRODUCTION_REF, AI_SEARCH_TEST_REF } = await import('../src/lib/aiSearch/previewGuard.js');

const ROOT = path.resolve(import.meta.dirname, '..');
const PROD_URL = `https://${PRODUCTION_REF}.supabase.co`;
const ENV_KEYS = ['VERCEL_ENV', 'CRON_SECRET', 'AI_OPS_CRON_ENABLED', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AI_SEARCH_MODELS_ENABLED', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'AI_SEARCH_PRODUCTION_ENABLED', 'AI_SEARCH_OPENAI_REGION'];
const ON = { VERCEL_ENV: 'production', CRON_SECRET: 'geheim', AI_OPS_CRON_ENABLED: PRODUCTION_REF, SUPABASE_URL: PROD_URL, SUPABASE_SERVICE_ROLE_KEY: 'svc', AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'sk', RESEND_API_KEY: 're' };
const T0 = new Date('2026-11-27T10:00:00Z');

/** Nachbildung der Laufsperre v2 (acquire exklusiv, release, Protokoll lesen) mit Uhr = Date.now(). */
function fakeDb() {
  const rows = [];
  let nextId = 100;
  const client = {
    rpc: vi.fn(async (fn, p) => {
      const now = Date.now();
      if (fn === 'ai_search_ops_lease_acquire') {
        for (const r of rows) if (!r.finished_at && r.lease_until <= now) { r.finished_at = now; r.outcome = 'expired'; }
        if (rows.some((r) => !r.finished_at)) return { data: null, error: null };
        const row = { id: nextId++, holder: p.p_holder, modes: p.p_modes, started_at: new Date(now).toISOString(), lease_until: now + p.p_lease_seconds * 1000, finished_at: null, outcome: null, summary: null };
        rows.push(row);
        return { data: row.id, error: null };
      }
      if (fn === 'ai_search_ops_lease_release') {
        const row = rows.find((r) => r.id === p.p_run_id);
        if (!row || row.holder !== p.p_holder) return { data: 'not_owner', error: null };
        Object.assign(row, { finished_at: now, outcome: p.p_outcome, summary: p.p_summary });
        return { data: 'released', error: null };
      }
      return { data: null, error: { message: `unbekannt ${fn}` } };
    }),
    from: vi.fn(() => {
      const q = { modes: [], select: () => q, contains: (_c, v) => { q.modes = v; return q; }, order: () => q,
        limit: async () => ({ data: rows.filter((r) => q.modes.every((m) => r.modes.includes(m))).sort((a, b) => b.id - a.id).map((r) => ({ ...r })), error: null }) };
      return q;
    }),
  };
  return { client, rows };
}

let saved;
let db;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.mocked(runOps).mockReset();
  vi.mocked(sendEmailOrThrow).mockReset();
  vi.mocked(sendEmailOrThrow).mockResolvedValue({ id: 'x' });
  vi.mocked(createClient).mockClear();
  db = fakeDb();
  currentClient = db.client;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  vi.useRealTimers();
});

async function call(headers = { authorization: 'Bearer geheim' }) {
  const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
  await handler({ method: 'GET', headers, query: {} }, res);
  return res;
}
const OK_REPORT = { outcome: 'ok', exitCode: 0, runId: 11, durationMs: 1200, stepResults: { index: 'no-work' }, lease: { status: 'released' }, before: { critical: [] }, after: { critical: [] } };
const FAILED_REPORT = { outcome: 'failed', exitCode: 1, runId: 12, error: 'OpenAI HTTP 403', lease: { status: 'released' }, before: { critical: [] }, after: { critical: ['1 Betriebslauf/-läufe … nicht behoben (12:failed).'] } };
const mailRows = () => db.rows.filter((r) => r.modes.includes('alarm-mail'));

describe('Schutz und Umschalter (standardmässig aus)', () => {
  it('ohne bzw. mit falschem Cron-Geheimnis: abgewiesen, kein Zugriff', async () => {
    Object.assign(process.env, ON);
    expect((await call({})).statusCode).toBe(401);
    expect((await call({ authorization: 'Bearer falsch' })).statusCode).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call()).statusCode).toBe(503);
    expect(runOps).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('nach dem Merge ohne Umschalter: „skipped“, kein Datenbank- oder Modellzugriff', async () => {
    Object.assign(process.env, ON);
    delete process.env.AI_OPS_CRON_ENABLED;
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ skipped: true });
    expect(runOps).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('nur die exakte Projektkennung schaltet ein; nur Vercel-Produktion; nur Produktionsziel', () => {
    for (const value of ['1', 'true', AI_SEARCH_TEST_REF, `${PRODUCTION_REF}x`, '']) {
      expect(checkOpsCronTarget({ ...ON, AI_OPS_CRON_ENABLED: value }).ok).toBe(false);
    }
    expect(checkOpsCronTarget({ ...ON, VERCEL_ENV: 'preview' }).ok).toBe(false);
    expect(checkOpsCronTarget({ ...ON, SUPABASE_URL: `https://${AI_SEARCH_TEST_REF}.supabase.co` }).ok).toBe(false);
    expect(checkOpsCronTarget({ ...ON, SUPABASE_SERVICE_ROLE_KEY: '' }).ok).toBe(false);
    expect(checkOpsCronTarget(ON)).toEqual({ ok: true });
  });

  it('unabhängig von der öffentlichen Freischaltung (Phase F); erfolgreicher Lauf: 200, keine Mail', async () => {
    Object.assign(process.env, ON);
    vi.mocked(runOps).mockResolvedValue(OK_REPORT);
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ outcome: 'ok', checks: { work: true, release: true, finalStatus: true }, critical: 0, mail: { attempted: false } });
    const [, options, deps] = vi.mocked(runOps).mock.calls[0];
    expect(deps.modelsEnabled).toBe(true);
    expect(options.execute).toEqual({ index: true, embed: true, cleanup: true });
    expect(mailRows()).toHaveLength(0);
    const src = readFileSync(path.join(ROOT, 'api/cron-ai-ops.js'), 'utf8');
    expect(src).not.toMatch(/env\??\.AI_SEARCH_PRODUCTION_ENABLED|checkAiSearchEnvironment/);
  });
});

describe('Grenzen und gemeinsames Laufzeitbudget', () => {
  it('gleiche Mengen- und Kostengrenzen wie der GitHub-Zyklus; geprüft vom Runner', () => {
    const parsed = parseOpsArgs([...CRON_OPS_ARGS], { AI_OPS_CONFIRM: PRODUCTION_REF }, PRODUCTION_REF);
    expect(parsed.ok).toBe(true);
    expect(parsed.options.limits).toMatchObject({ maxUsd: 0.01, indexBatches: 6, maxEnqueue: 200, embedChunks: 300, cleanupBatch: 1000 });
    expect(parsed.options.purgeUsage).toBe(true);
    const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-ops-cycle-prod.yml'), 'utf8');
    for (const flag of CRON_OPS_ARGS.filter((f) => !f.startsWith('--max-runtime-sec'))) expect(wf).toContain(flag);
  });

  it('Budgetrechnung: Arbeit + laufender Schritt + Abschluss vor Phasenende; Mail-Reserve; Gesamtbudget unter maxDuration', () => {
    const { limits } = parseOpsArgs([...CRON_OPS_ARGS], { AI_OPS_CONFIRM: PRODUCTION_REF }, PRODUCTION_REF).options;
    const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.functions['api/cron-ai-ops.js']).toEqual({ maxDuration: CRON_MAX_DURATION_SEC });
    expect(TOTAL_BUDGET_MS).toBeLessThanOrEqual(CRON_MAX_DURATION_SEC * 1000 - 15_000);
    const longestStep = Math.max(...Object.values(STEP_MS));
    expect(limits.runtimeSec * 1000 + longestStep + STEP_MS.dbRequest).toBeLessThanOrEqual(TOTAL_BUDGET_MS - MAIL_RESERVE_MS);
    expect(limits.runtimeSec).toBeLessThanOrEqual(OPS_LIMITS.maxRuntimeSec);
  });

  it('budgetFetch: Zeitgrenze = min(Schrittgrenze, Phasenrest); erschöpfte Phase startet keine Anfrage', async () => {
    vi.useRealTimers();
    const budget = createBudget(10_000, { phaseEndMs: 150 });
    // Hängende Anfrage endet am Phasenende, nicht erst nach der Schrittgrenze (30 s).
    const hanging = (_input, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    const started = Date.now();
    await expect(budgetFetch(budget, 30_000, hanging)('https://x')).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
    const base = vi.fn();
    await new Promise((r) => setTimeout(r, 20));
    await expect(budgetFetch(budget, 30_000, base)('https://x')).rejects.toThrow(/Laufzeitbudget erschöpft/);
    expect(base).not.toHaveBeenCalled();
    // Phasenwechsel: neues Ende (nie über das Gesamtende hinaus).
    budget.setPhaseEnd(budget.hardEnd + 99_999);
    expect(budget.phaseEnd).toBe(budget.hardEnd);
  });

  it('echter Supabase-Client: erschöpftes Budget liefert Fehler statt Hängen (Abschluss und Endkontrolle brechen ab)', async () => {
    const { createClient: realCreateClient } = await vi.importActual('@supabase/supabase-js');
    const budget = createBudget(0);
    const base = vi.fn();
    const client = realCreateClient(PROD_URL, 'svc', { auth: { persistSession: false }, global: { fetch: budgetFetch(budget, 30_000, base) } });
    const read = await client.from('ai_search_jobs').select('id').limit(1);
    expect(read.error?.message).toMatch(/Laufzeitbudget erschöpft/);
    const release = await client.rpc('ai_search_ops_lease_release', { p_run_id: 1 });
    expect(release.error?.message).toMatch(/Laufzeitbudget erschöpft/);
    expect(base).not.toHaveBeenCalled();
  });

  it('kein „ok“ ohne notwendige Prüfungen: unbestätigter Abschluss oder fehlende Endkontrolle → unverified', () => {
    expect(assessReport(OK_REPORT)).toMatchObject({ verdict: 'ok', critical: [] });
    const noRelease = assessReport({ ...OK_REPORT, lease: { status: 'error', error: 'Laufzeitbudget erschöpft' } });
    expect(noRelease.verdict).toBe('unverified');
    expect(noRelease.critical.join(' ')).toMatch(/Abschluss von Lauf 11 nicht bestätigt \(error\)/);
    const expired = assessReport({ ...OK_REPORT, lease: { status: 'expired' } });
    expect(expired.verdict).toBe('unverified');
    const noFinal = assessReport({ ...OK_REPORT, after: { error: 'Laufzeitbudget erschöpft' } });
    expect(noFinal).toMatchObject({ verdict: 'unverified', checks: { finalStatus: false } });
    expect(noFinal.critical.join(' ')).toMatch(/Endkontrolle fehlt/);
    expect(assessReport(FAILED_REPORT).verdict).toBe('failed');
    expect(assessReport({ outcome: 'failed', exitCode: 1, error: 'x', before: null }).verdict).toBe('failed');
    expect(assessReport({ outcome: 'locked', exitCode: 3 })).toMatchObject({ verdict: 'locked', critical: [] });
  });

  it('Handler: Abschluss nicht bestätigt → 500 „unverified“, Alarm-Mail', async () => {
    Object.assign(process.env, ON);
    vi.mocked(runOps).mockResolvedValue({ ...OK_REPORT, lease: { status: 'error', error: 'Laufzeitbudget erschöpft' } });
    const res = await call();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ outcome: 'unverified', runOutcome: 'ok', checks: { release: false }, mail: { sent: true } });
    expect(vi.mocked(sendEmailOrThrow).mock.calls[0][2].subject).toMatch(/nicht bestätigt/);
  });

  it('Handler: Restbudget reicht nicht für die Mail → kein Versuch, kein Sperreintrag, Grund in der Antwort', async () => {
    Object.assign(process.env, ON);
    vi.mocked(runOps).mockImplementation(async () => { vi.setSystemTime(new Date(T0.getTime() + TOTAL_BUDGET_MS - 5_000)); return FAILED_REPORT; });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body.mail).toEqual({ attempted: false, sent: false, reason: 'Laufzeitbudget reicht nicht' });
    expect(sendEmailOrThrow).not.toHaveBeenCalled();
    expect(mailRows()).toHaveLength(0);
  });

  it('Laufsperre belegt (anderer Lauf aktiv, z. B. manueller GitHub-Lauf): 200, keine Mail', async () => {
    Object.assign(process.env, ON);
    vi.mocked(runOps).mockResolvedValue({ outcome: 'locked', exitCode: 3, before: { critical: ['x'] } });
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ outcome: 'locked', mail: { attempted: false } });
    expect(sendEmailOrThrow).not.toHaveBeenCalled();
  });
});

describe('Alarm-Mail: höchstens eine je 60 Minuten, serverseitig erzwungen', () => {
  beforeEach(() => { Object.assign(process.env, ON); });

  it('Fehlschlag: 500, eine Mail, Versuch in der Laufsperre protokolliert (nur Zählungen)', async () => {
    vi.mocked(runOps).mockResolvedValue(FAILED_REPORT);
    const res = await call();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ outcome: 'failed', runId: 12, critical: 1, mail: { attempted: true, sent: true } });
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(1);
    const [, label, mail] = vi.mocked(sendEmailOrThrow).mock.calls[0];
    expect(label).toBe('cron-ai-ops-alarm');
    expect(mail.subject).toMatch(/Lauf fehlgeschlagen/);
    expect(mail.html).toMatch(/OpenAI HTTP 403/);
    expect(mailRows()).toEqual([expect.objectContaining({ outcome: 'ok', summary: expect.objectContaining({ attempted: true, sent: true, lines: 2 }) })]);
  });

  it('Mehrfachzustellung desselben Cron-Aufrufs bzw. nächster Slot innerhalb 60 min: keine zweite Mail', async () => {
    vi.mocked(runOps).mockResolvedValue(FAILED_REPORT);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await call();
    await call(); // gleiche Minute (doppelte Zustellung)
    vi.setSystemTime(new Date(T0.getTime() + 15 * 60_000));
    const third = await call();
    vi.setSystemTime(new Date(T0.getTime() + 59 * 60_000));
    await call();
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(1);
    expect(third.body.mail).toMatchObject({ attempted: false, sent: false, reason: expect.stringMatching(/gedrosselt/) });
    // Gedrosselte Aufrufe schreiben keine Sperreinträge (Vorprüfung).
    expect(mailRows()).toHaveLength(1);
    vi.setSystemTime(new Date(T0.getTime() + 61 * 60_000));
    await call();
    spy.mockRestore();
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(2);
  });

  it('parallele Aufrufe: genau eine Mail (exklusive Sperre bzw. massgebliche Prüfung nach Datenbankuhr)', async () => {
    vi.mocked(runOps).mockResolvedValue(FAILED_REPORT);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const results = await Promise.all([call(), call(), call()]);
    spy.mockRestore();
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.body.mail.sent)).toHaveLength(1);
    expect(mailRows().filter((r) => r.summary?.attempted)).toHaveLength(1);
  });

  it('massgebliche Prüfung in der Sperre: Versuch zwischen Vorprüfung und Sperre wird erkannt', async () => {
    vi.mocked(runOps).mockResolvedValue(FAILED_REPORT);
    // Ein anderer Aufruf protokolliert seinen Versuch genau nach unserer Vorprüfung.
    const realFrom = db.client.from;
    let reads = 0;
    db.client.from = vi.fn((...args) => {
      reads += 1;
      if (reads === 2) db.rows.push({ id: 1, holder: 'x', modes: ['alarm-mail'], started_at: new Date(Date.now() - 1000).toISOString(), lease_until: 0, finished_at: Date.now(), outcome: 'ok', summary: { attempted: true, sent: true } });
      return realFrom(...args);
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    spy.mockRestore();
    expect(sendEmailOrThrow).not.toHaveBeenCalled();
    expect(res.body.mail.reason).toMatch(/gedrosselt \(letzter Versuch 1\)/);
    expect(mailRows().find((r) => r.id !== 1)).toMatchObject({ outcome: 'ok', summary: { attempted: false } });
  });

  it('abgebrochener Versuch (Sperreintrag abgelaufen, ohne Protokoll) zählt als Versuch', async () => {
    db.rows.push({ id: 5, holder: 'x', modes: ['alarm-mail'], started_at: new Date(T0.getTime() - 10 * 60_000).toISOString(), lease_until: T0.getTime() - 9 * 60_000, finished_at: T0.getTime() - 5 * 60_000, outcome: 'expired', summary: null });
    vi.mocked(runOps).mockResolvedValue(FAILED_REPORT);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await call();
    spy.mockRestore();
    expect(sendEmailOrThrow).not.toHaveBeenCalled();
  });

  it('Mailversand scheitert: Cron bleibt sichtbar (500), Versuch protokolliert, keine Wiederholung innerhalb 60 min', async () => {
    vi.mocked(sendEmailOrThrow).mockRejectedValue(new Error('resend down'));
    vi.mocked(runOps).mockResolvedValue(FAILED_REPORT);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    vi.setSystemTime(new Date(T0.getTime() + 15 * 60_000));
    await call();
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body.mail).toMatchObject({ attempted: true, sent: false, reason: 'resend down' });
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(1);
    expect(mailRows()).toEqual([expect.objectContaining({ outcome: 'failed', summary: expect.objectContaining({ attempted: true, sent: false }) })]);
  });

  it('erfolgreicher Lauf mit kritischem Rückstand: 200, Mail „kritischer Alarm“ (gedrosselt)', async () => {
    vi.mocked(runOps).mockResolvedValue({ ...OK_REPORT, after: { critical: ['Ältester offener Auftrag ist 30 h alt (> 24 h).'] } });
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ outcome: 'ok', critical: 1, mail: { sent: true } });
    expect(vi.mocked(sendEmailOrThrow).mock.calls[0][2].subject).toMatch(/kritischer Alarm/);
  });

  it('Runner wirft vor der Laufsperre (z. B. Modellaufrufe gesperrt): 500 und eine gedrosselte Mail', async () => {
    vi.mocked(runOps).mockRejectedValue(new Error('Embeddings gesperrt'));
    const first = await call();
    vi.setSystemTime(new Date(T0.getTime() + 15 * 60_000));
    await call();
    expect(first.statusCode).toBe(500);
    expect(first.body.outcome).toBe('failed');
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(1);
  });
});

describe('Statisch: nur ein Weg, alter Endpunkt bleibt gesperrt', () => {
  const src = readFileSync(path.join(ROOT, 'api/cron-ai-ops.js'), 'utf8');
  it('nutzt den geprüften Runner mit Laufsperre, nicht den alten Endpunkt', () => {
    expect(src).toMatch(/runOps\(client, parsed\.options/);
    expect(src).not.toMatch(/from '\.\/cron-ai-search\.js'|drainOutbox/);
    expect(readFileSync(path.join(ROOT, 'api/cron-ai-search.js'), 'utf8')).toMatch(/VERCEL_ENV === 'production'/);
  });
  it('GitHub-Zeitplan bleibt über die Repository-Variable abschaltbar; manuelle Läufe bleiben', () => {
    const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-ops-cycle-prod.yml'), 'utf8');
    expect(wf).toMatch(/github\.event_name == 'schedule' && vars\.AI_OPS_PROD_SCHEDULE_ENABLED == 'true'/);
    expect(wf).toMatch(/workflow_dispatch:/);
  });
});
