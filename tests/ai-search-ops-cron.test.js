/**
 * Vercel-Cron für den Produktionsbetrieb der KI-Suche (api/cron-ai-ops.js, 27.11.2026).
 * Kein Netz, keine Datenbank, keine Modellaufrufe: Supabase, Runner und Mailversand
 * sind nachgebildet. Geprüft werden Schutz, Umschalter, Grenzen und Alarmierung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ fake: true })) }));
vi.mock('resend', () => ({ Resend: class { constructor() { this.emails = { send: vi.fn() }; } } }));
vi.mock('../api/_lib/email-config.js', async (importOriginal) => ({ ...(await importOriginal()), sendEmailOrThrow: vi.fn(async () => ({ id: 'x' })) }));
vi.mock('../src/lib/aiSearch/ops.js', async (importOriginal) => ({ ...(await importOriginal()), runOps: vi.fn() }));

const { default: handler, CRON_OPS_ARGS, CRON_MAX_DURATION_SEC, checkOpsCronTarget, shouldNotify } = await import('../api/cron-ai-ops.js');
const { runOps, parseOpsArgs, STEP_MS, OPS_LIMITS } = await import('../src/lib/aiSearch/ops.js');
const { sendEmailOrThrow } = await import('../api/_lib/email-config.js');
const { createClient } = await import('@supabase/supabase-js');
const { PRODUCTION_REF, AI_SEARCH_TEST_REF } = await import('../src/lib/aiSearch/previewGuard.js');

const ROOT = path.resolve(import.meta.dirname, '..');
const PROD_URL = `https://${PRODUCTION_REF}.supabase.co`;
const ENV_KEYS = ['VERCEL_ENV', 'CRON_SECRET', 'AI_OPS_CRON_ENABLED', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AI_SEARCH_MODELS_ENABLED', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'AI_SEARCH_PRODUCTION_ENABLED', 'AI_SEARCH_OPENAI_REGION'];
const ON = { VERCEL_ENV: 'production', CRON_SECRET: 'geheim', AI_OPS_CRON_ENABLED: PRODUCTION_REF, SUPABASE_URL: PROD_URL, SUPABASE_SERVICE_ROLE_KEY: 'svc', AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'sk', RESEND_API_KEY: 're' };

let saved;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.mocked(runOps).mockReset();
  vi.mocked(sendEmailOrThrow).mockClear();
  vi.mocked(createClient).mockClear();
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  vi.useRealTimers();
});

function setEnv(env) { Object.assign(process.env, env); }
async function call(headers = { authorization: 'Bearer geheim' }, method = 'GET') {
  const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
  await handler({ method, headers, query: {} }, res);
  return res;
}
const before = (previousOutcome, critical = []) => ({ critical, ops: { applied: true, recent: previousOutcome ? [{ id: 7, outcome: previousOutcome }] : [] } });

describe('Schutz und Umschalter (standardmässig aus)', () => {
  it('ohne bzw. mit falschem Cron-Geheimnis: abgewiesen, kein Zugriff', async () => {
    setEnv(ON);
    expect((await call({})).statusCode).toBe(401);
    expect((await call({ authorization: 'Bearer falsch' })).statusCode).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call()).statusCode).toBe(503);
    expect(runOps).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('nach dem Merge ohne Umschalter: „skipped“, kein Datenbank- oder Modellzugriff', async () => {
    setEnv(ON);
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

  it('unabhängig von der öffentlichen Freischaltung (Phase F): ohne AI_SEARCH_PRODUCTION_ENABLED lauffähig', async () => {
    setEnv(ON);
    vi.mocked(runOps).mockResolvedValue({ outcome: 'ok', exitCode: 0, runId: 11, durationMs: 1200, stepResults: { index: 'no-work' }, before: before('ok'), after: { critical: [] } });
    const res = await call();
    expect(res.statusCode).toBe(200);
    const [, options, deps] = vi.mocked(runOps).mock.calls[0];
    expect(deps.modelsEnabled).toBe(true);
    expect(options.execute).toEqual({ index: true, embed: true, cleanup: true });
    // Endpunkt liest die öffentliche Freischaltung nicht.
    const src = readFileSync(path.join(ROOT, 'api/cron-ai-ops.js'), 'utf8');
    expect(src).not.toMatch(/env\??\.AI_SEARCH_PRODUCTION_ENABLED|checkAiSearchEnvironment/);
  });
});

describe('Grenzen und Laufzeit', () => {
  it('gleiche Mengen- und Kostengrenzen wie der GitHub-Zyklus; geprüft vom Runner', () => {
    const parsed = parseOpsArgs([...CRON_OPS_ARGS], { AI_OPS_CONFIRM: PRODUCTION_REF }, PRODUCTION_REF);
    expect(parsed.ok).toBe(true);
    expect(parsed.options.limits).toMatchObject({ maxUsd: 0.01, indexBatches: 6, maxEnqueue: 200, embedChunks: 300, cleanupBatch: 1000 });
    expect(parsed.options.purgeUsage).toBe(true);
    const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-ops-cycle-prod.yml'), 'utf8');
    for (const flag of CRON_OPS_ARGS.filter((f) => !f.startsWith('--max-runtime-sec'))) expect(wf).toContain(flag);
  });

  it('Laufzeit: Runner-Grenze + Abschluss + Endbericht unter maxDuration (vercel.json)', () => {
    const { limits } = parseOpsArgs([...CRON_OPS_ARGS], { AI_OPS_CONFIRM: PRODUCTION_REF }, PRODUCTION_REF).options;
    const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.functions['api/cron-ai-ops.js']).toEqual({ maxDuration: CRON_MAX_DURATION_SEC });
    expect(CRON_MAX_DURATION_SEC).toBeLessThanOrEqual(300);
    // Letzter Schritt kann eine Anfragegrenze überziehen; danach Abschluss der Sperre und Endbericht.
    expect(limits.runtimeSec + (3 * STEP_MS.dbRequest) / 1000).toBeLessThanOrEqual(CRON_MAX_DURATION_SEC);
    expect(limits.runtimeSec).toBeLessThanOrEqual(OPS_LIMITS.maxRuntimeSec);
  });

  it('Laufsperre belegt (anderer Lauf aktiv, z. B. manueller GitHub-Lauf): 200, keine Mail', async () => {
    setEnv(ON);
    vi.mocked(runOps).mockResolvedValue({ outcome: 'locked', exitCode: 3, before: before('ok') });
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ outcome: 'locked', notified: false });
    expect(sendEmailOrThrow).not.toHaveBeenCalled();
  });
});

describe('Fehlerbenachrichtigung und Rückstandskontrolle', () => {
  it('neuer Fehlschlag nach erfolgreichem Vorlauf: 500 und sofort eine Admin-Mail; Antwort nur Zählungen', async () => {
    setEnv(ON);
    vi.mocked(runOps).mockResolvedValue({ outcome: 'failed', exitCode: 1, runId: 12, error: 'OpenAI HTTP 403', before: before('ok'), after: { critical: ['1 Betriebslauf/-läufe … nicht behoben (12:failed).'] } });
    const res = await call();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ outcome: 'failed', runId: 12, durationMs: null, steps: {}, critical: 1, notified: true });
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(1);
    const [, label, mail] = vi.mocked(sendEmailOrThrow).mock.calls[0];
    expect(label).toBe('cron-ai-ops-alarm');
    expect(mail.subject).toMatch(/Lauf fehlgeschlagen/);
    expect(mail.html).toMatch(/OpenAI HTTP 403/);
  });

  it('Mailfehler bricht den Cron nicht ab (Ergebnis bleibt sichtbar)', async () => {
    setEnv(ON);
    vi.mocked(sendEmailOrThrow).mockRejectedValueOnce(new Error('resend down'));
    vi.mocked(runOps).mockResolvedValue({ outcome: 'failed', exitCode: 1, before: before('ok'), after: { critical: [] } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    expect(res.statusCode).toBe(500);
    expect(res.body.notified).toBe(false);
    spy.mockRestore();
  });

  it('Runner wirft vor der Laufsperre (z. B. Modellaufrufe gesperrt): 500, keine Mail-Flut', async () => {
    setEnv(ON);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:30:00Z'));
    vi.mocked(runOps).mockRejectedValue(new Error('Embeddings gesperrt'));
    const res = await call();
    expect(res.statusCode).toBe(500);
    expect(sendEmailOrThrow).not.toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-11-27T11:00:00Z'));
    await call();
    expect(sendEmailOrThrow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmailOrThrow).mock.calls[0][2].subject).toMatch(/Alarm besteht weiter/);
  });

  it('shouldNotify: sofort bei neuem Fehler, sonst bei Fehler oder kritischem Alarm (Rückstand) höchstens stündlich', () => {
    const at = (m) => new Date(`2026-11-27T10:${String(m).padStart(2, '0')}:00Z`);
    expect(shouldNotify({ failed: true, critical: [], previousOutcome: 'ok', now: at(30) })).toBe('neu');
    expect(shouldNotify({ failed: true, critical: [], previousOutcome: 'none', now: at(30) })).toBe('neu');
    expect(shouldNotify({ failed: true, critical: [], previousOutcome: 'failed', now: at(30) })).toBeNull();
    expect(shouldNotify({ failed: true, critical: [], previousOutcome: 'failed', now: at(0) })).toBe('stündlich');
    expect(shouldNotify({ failed: true, critical: [], previousOutcome: null, now: at(45) })).toBeNull();
    const backlog = ['Ältester offener Auftrag ist 30 h alt (> 24 h).'];
    expect(shouldNotify({ failed: false, critical: backlog, previousOutcome: 'ok', now: at(2) })).toBe('stündlich');
    expect(shouldNotify({ failed: false, critical: backlog, previousOutcome: 'ok', now: at(17) })).toBeNull();
    expect(shouldNotify({ failed: false, critical: [], previousOutcome: 'ok', now: at(0) })).toBeNull();
  });

  it('erfolgreicher Lauf mit kritischem Rückstand: 200, Alarm in der Antwort, Mail im Stunden-Slot', async () => {
    setEnv(ON);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T12:01:00Z'));
    vi.mocked(runOps).mockResolvedValue({ outcome: 'ok', exitCode: 0, before: before('ok'), after: { critical: ['Löschrückstand: 3 …'] } });
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ critical: 1, notified: true });
  });
});

describe('Statisch: nur ein Weg, alter Endpunkt bleibt gesperrt', () => {
  const src = readFileSync(path.join(ROOT, 'api/cron-ai-ops.js'), 'utf8');
  it('nutzt den geprüften Runner mit Laufsperre, nicht den alten Endpunkt', () => {
    expect(src).toMatch(/runOps\(client, parsed\.options/);
    expect(src).not.toMatch(/from '\.\/cron-ai-search\.js'|runAiSearchCron|drainOutbox/);
    expect(readFileSync(path.join(ROOT, 'api/cron-ai-search.js'), 'utf8')).toMatch(/VERCEL_ENV === 'production'/);
  });
  it('GitHub-Zeitplan bleibt über die Repository-Variable abschaltbar; manuelle Läufe bleiben', () => {
    const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-ops-cycle-prod.yml'), 'utf8');
    expect(wf).toMatch(/github\.event_name == 'schedule' && vars\.AI_OPS_PROD_SCHEDULE_ENABLED == 'true'/);
    expect(wf).toMatch(/workflow_dispatch:/);
  });
});
