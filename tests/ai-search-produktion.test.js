/**
 * Produktionspaket (25.11.2026):
 *  1. Produktionsfreischaltung: standardmässig aus; nur mit exaktem Schalter
 *     (= Projektkennung) UND Server-/Browserziel Produktion. Vorschau bleibt TEST.
 *  2. Produktionswerkzeug: strikte Zielprüfung, Trockenlauf als Standard,
 *     Bestätigung, Kostenschwelle, Ersteinbettung/Aktivierung nur bei
 *     vollständigem Index, Rückweg.
 *  3. Produktionszeitplan: aus bis zur Schalter-Variable, keine PR-Auslöser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../src/lib/aiSearch/ops.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, collectStatus: vi.fn() };
});

const { checkAiSearchEnvironment, aiSearchClientMode, isProductionSwitchOn, PRODUCTION_REF, AI_SEARCH_TEST_REF } = await import('../src/lib/aiSearch/previewGuard.js');
const { readModelConfig } = await import('../src/lib/aiSearch/openaiGateway.js');
const ops = await import('../src/lib/aiSearch/ops.js');
const prod = await import('../scripts/ai-search-prod.mjs');

const PROD_URL = `https://${PRODUCTION_REF}.supabase.co`;
const TEST_URL = `https://${AI_SEARCH_TEST_REF}.supabase.co`;
const ROOT = path.resolve(import.meta.dirname, '..');

describe('1. Produktionsfreischaltung', () => {
  const prodEnv = { VERCEL_ENV: 'production', SUPABASE_URL: PROD_URL, VITE_SUPABASE_URL: PROD_URL };

  it('ohne Schalter bleibt Produktion gesperrt (404 not_available) – ein Merge aktiviert nichts', () => {
    expect(checkAiSearchEnvironment(prodEnv)).toMatchObject({ ok: false, code: 'not_available' });
  });

  it('„1“, „true“ oder andere Werte schalten NICHT frei; nur die exakte Projektkennung', () => {
    for (const value of ['1', 'true', 'yes', AI_SEARCH_TEST_REF, `${PRODUCTION_REF}x`]) {
      expect(checkAiSearchEnvironment({ ...prodEnv, AI_SEARCH_PRODUCTION_ENABLED: value }).ok).toBe(false);
      expect(isProductionSwitchOn(value)).toBe(false);
    }
    expect(checkAiSearchEnvironment({ ...prodEnv, AI_SEARCH_PRODUCTION_ENABLED: PRODUCTION_REF })).toEqual({ ok: true, ref: PRODUCTION_REF, mode: 'production' });
  });

  it('mit Schalter, aber falscher Datenbank (Server oder Browser): abgelehnt', () => {
    const on = { AI_SEARCH_PRODUCTION_ENABLED: PRODUCTION_REF, VERCEL_ENV: 'production' };
    expect(checkAiSearchEnvironment({ ...on, SUPABASE_URL: TEST_URL, VITE_SUPABASE_URL: PROD_URL })).toMatchObject({ ok: false, code: 'wrong_environment' });
    expect(checkAiSearchEnvironment({ ...on, SUPABASE_URL: PROD_URL, VITE_SUPABASE_URL: TEST_URL })).toMatchObject({ ok: false, code: 'wrong_environment' });
  });

  it('Vorschau bleibt an TEST gebunden – auch wenn der Schalter gesetzt ist', () => {
    const preview = { VERCEL_ENV: 'preview', AI_SEARCH_PRODUCTION_ENABLED: PRODUCTION_REF };
    expect(checkAiSearchEnvironment({ ...preview, SUPABASE_URL: PROD_URL, VITE_SUPABASE_URL: PROD_URL })).toMatchObject({ ok: false, code: 'wrong_environment' });
    expect(checkAiSearchEnvironment({ ...preview, SUPABASE_URL: TEST_URL, VITE_SUPABASE_URL: TEST_URL })).toEqual({ ok: true, ref: AI_SEARCH_TEST_REF, mode: 'test' });
  });

  it('Modellaufrufe in Produktion nur mit Freischaltung', () => {
    const models = { AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'k' };
    expect(readModelConfig({ ...prodEnv, ...models }).enabled).toBe(false);
    expect(readModelConfig({ ...prodEnv, ...models, AI_SEARCH_PRODUCTION_ENABLED: PRODUCTION_REF }).enabled).toBe(true);
  });

  it('Einstieg im Browser: kursnavi.ch nur mit Build-Schalter und Produktionsdatenbank', () => {
    expect(aiSearchClientMode({ hostname: 'kursnavi.ch', viteSupabaseUrl: PROD_URL })).toBe('off');
    expect(aiSearchClientMode({ hostname: 'kursnavi.ch', viteSupabaseUrl: PROD_URL, productionFlag: '1' })).toBe('off');
    expect(aiSearchClientMode({ hostname: 'www.kursnavi.ch', viteSupabaseUrl: PROD_URL, productionFlag: PRODUCTION_REF })).toBe('production');
    expect(aiSearchClientMode({ hostname: 'kursnavi.ch', viteSupabaseUrl: TEST_URL, productionFlag: PRODUCTION_REF })).toBe('off');
    expect(aiSearchClientMode({ hostname: 'x.vercel.app', viteSupabaseUrl: TEST_URL })).toBe('test');
    expect(aiSearchClientMode({ hostname: 'x.vercel.app', viteSupabaseUrl: PROD_URL, productionFlag: PRODUCTION_REF })).toBe('blocked');
    expect(aiSearchClientMode({ hostname: 'evil.example', viteSupabaseUrl: PROD_URL, productionFlag: PRODUCTION_REF })).toBe('off');
  });
});

describe('1b. OpenAI-Region (Datenresidenz) ohne Ausweichroute', () => {
  const env = { VERCEL_ENV: 'preview', SUPABASE_URL: TEST_URL, VITE_SUPABASE_URL: TEST_URL, AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'k' };

  it('Standard global; „eu“ nutzt eu.api.openai.com; unbekannte Werte sperren die Modelle', () => {
    expect(readModelConfig(env)).toMatchObject({ enabled: true, openaiRegion: 'global', openaiBaseUrl: 'https://api.openai.com/v1' });
    expect(readModelConfig({ ...env, AI_SEARCH_OPENAI_REGION: 'eu' })).toMatchObject({ enabled: true, openaiRegion: 'eu', openaiBaseUrl: 'https://eu.api.openai.com/v1' });
    expect(readModelConfig({ ...env, AI_SEARCH_OPENAI_REGION: 'europe' })).toMatchObject({ enabled: false, openaiRegion: null });
  });

  it('in der Region nicht belegtes Modell → keine Modellaufrufe (statt globaler Verarbeitung)', () => {
    expect(readModelConfig({ ...env, AI_SEARCH_OPENAI_REGION: 'eu', AI_SEARCH_EMBEDDING_MODEL: 'text-embedding-3-large' }).enabled).toBe(false);
  });

  it('Zugang ohne Region wird nicht erzeugt; mit „eu“ gehen Responses und Embeddings nur an den EU-Endpunkt', async () => {
    const { createOpenAiGateway } = await import('../src/lib/aiSearch/openaiGateway.js');
    expect(() => createOpenAiGateway({ apiKey: 'k' })).toThrow(/Region/);
    expect(() => createOpenAiGateway({ apiKey: 'k', region: 'mars' })).toThrow(/Region/);
    const urls = [];
    const fetchImpl = async (url) => { urls.push(String(url)); return { ok: true, json: async () => ({ data: [{ index: 0, embedding: new Array(1024).fill(0.1) }], usage: { total_tokens: 1 } }) }; };
    const gateway = createOpenAiGateway({ apiKey: 'k', region: 'eu', fetchImpl });
    await gateway.embed(['abc']);
    expect(urls).toEqual(['https://eu.api.openai.com/v1/embeddings']);
  });

  it('alle Aufrufer übergeben die konfigurierte Region', () => {
    for (const file of ['api/ai-search.js', 'scripts/ai-search-prod.mjs', 'scripts/ai-search-ops.mjs', 'scripts/ai-search-quality-run.mjs', 'scripts/ai-search-embed-test.mjs']) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      const calls = source.match(/createOpenAiGateway\(\{[^}]*/g) ?? [];
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(call).toMatch(/region: (modelConfig|config)\.openaiRegion/);
    }
  });
});

describe('2. Produktionswerkzeug', () => {
  it('Zielprüfung: nur das Produktionsprojekt, nie TEST; Schlüssel Pflicht', () => {
    expect(prod.checkProductionTarget({ SUPABASE_URL_PROD: TEST_URL, SUPABASE_SECRET_KEY_PROD: 'k' })).toMatchObject({ ok: false });
    expect(prod.checkProductionTarget({ SUPABASE_URL_PROD: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY_PROD: 'k' })).toMatchObject({ ok: false });
    expect(prod.checkProductionTarget({ SUPABASE_URL_PROD: PROD_URL })).toMatchObject({ ok: false });
    expect(prod.checkProductionTarget({ SUPABASE_URL_PROD: `${PROD_URL}:8443`, SUPABASE_SECRET_KEY_PROD: 'k' })).toMatchObject({ ok: false });
    expect(prod.checkProductionTarget({ SUPABASE_URL_PROD: PROD_URL, SUPABASE_SECRET_KEY_PROD: 'k' })).toMatchObject({ ok: true });
  });

  it('Modellkonfiguration des Werkzeugs nutzt die Produktions-Zielprüfung, nicht den Web-Schalter', () => {
    const env = { SUPABASE_URL_PROD: PROD_URL, SUPABASE_SECRET_KEY_PROD: 'k', AI_SEARCH_MODELS_ENABLED: '1', OPENAI_API_KEY: 'k' };
    expect(prod.prodModelConfig(env).enabled).toBe(true);
    expect(prod.prodModelConfig({ ...env, SUPABASE_URL_PROD: TEST_URL }).enabled).toBe(false);
    expect(prod.prodModelConfig({ ...env, AI_SEARCH_MODELS_ENABLED: '0' }).enabled).toBe(false);
  });

  it('Befehlszeile: Trockenlauf ohne Bestätigung; Ausführung nur mit AI_PROD_CONFIRM und Kostenschwelle ≤ 1', () => {
    expect(prod.parseProdArgs('initial-embed', [], {})).toMatchObject({ ok: true, options: { execute: false } });
    expect(prod.parseProdArgs('initial-embed', ['--execute', '--max-usd=0.05'], {}).ok).toBe(false);
    expect(prod.parseProdArgs('initial-embed', ['--execute'], { AI_PROD_CONFIRM: PRODUCTION_REF }).ok).toBe(false);
    expect(prod.parseProdArgs('initial-embed', ['--execute', '--max-usd=2'], { AI_PROD_CONFIRM: PRODUCTION_REF }).ok).toBe(false);
    expect(prod.parseProdArgs('initial-embed', ['--execute', '--max-usd=0.05'], { AI_PROD_CONFIRM: PRODUCTION_REF })).toMatchObject({ ok: true, options: { execute: true, maxUsd: 0.05 } });
    expect(prod.parseProdArgs('activate', ['--execute'], { AI_PROD_CONFIRM: AI_SEARCH_TEST_REF }).ok).toBe(false);
    expect(prod.parseProdArgs('activate', ['--max-usd=1'], {}).ok).toBe(false);
    expect(prod.parseProdArgs('deactivate', ['--foo'], {}).ok).toBe(false);
  });

  const status = (over = {}) => ({
    coverage: { published: 697, documents: 697, missingInIndex: 0, orphanedInIndex: 0, nullStatus: 0, ...(over.coverage ?? {}) },
    jobs: { pending: 0, failed: 0, ...(over.jobs ?? {}) },
    embeddings: { activeVersion: null, configuredVersion: 'text-embedding-3-small@1024', chunksTotal: 2460, needEmbedding: 0, ...(over.embeddings ?? {}) },
    estimate: { embeddingUsd: 0.0046, runnerEmbedUsdMonth: 0, ...(over.estimate ?? {}) },
  });
  const deps = { embeddingVersion: 'text-embedding-3-small@1024', holder: 'h', modelsEnabled: true, createGateway: () => ({ usage: { embeddingTokens: 0 }, embed: async (t) => t.map(() => [0.1]) }) };

  function configClient(updated = [{ active_model_version: 'text-embedding-3-small@1024' }]) {
    const calls = [];
    const chain = { update: (v) => { calls.push(['update', v]); return chain; }, eq: () => chain, is: (c, v) => { calls.push(['is', c, v]); return chain; }, select: async () => ({ data: updated, error: null }) };
    return { calls, from: (table) => { calls.push(['from', table]); return chain; } };
  }

  beforeEach(() => ops.collectStatus.mockReset());

  it('Aktivierung: Trockenlauf schreibt nicht; Ausführung nur bei vollständiger Einbettung und vollständigem Index', async () => {
    ops.collectStatus.mockResolvedValue(status());
    const client = configClient();
    expect(await prod.runActivate(client, { execute: false }, deps)).toMatchObject({ outcome: 'dry-run', exitCode: 0 });
    expect(client.calls).toHaveLength(0);
    expect(await prod.runActivate(client, { execute: true }, deps)).toMatchObject({ outcome: 'ok', activeVersion: deps.embeddingVersion });
    expect(client.calls).toContainEqual(['is', 'active_model_version', null]);

    ops.collectStatus.mockResolvedValue(status({ embeddings: { needEmbedding: 3 } }));
    expect(await prod.runActivate(configClient(), { execute: true }, deps)).toMatchObject({ outcome: 'refused', exitCode: 2 });
    ops.collectStatus.mockResolvedValue(status({ jobs: { pending: 4 } }));
    expect(await prod.runActivate(configClient(), { execute: true }, deps)).toMatchObject({ outcome: 'refused', exitCode: 2 });
    ops.collectStatus.mockResolvedValue(status({ embeddings: { activeVersion: 'andere@512' } }));
    expect(await prod.runActivate(configClient(), { execute: true }, deps)).toMatchObject({ outcome: 'refused', exitCode: 2 });
  });

  it('Ersteinbettung: nur ohne aktive Version und bei vollständigem Index; Trockenlauf ohne Modellaufruf', async () => {
    ops.collectStatus.mockResolvedValue(status({ embeddings: { activeVersion: 'text-embedding-3-small@1024' } }));
    expect(await prod.runInitialEmbed({}, { execute: true, maxUsd: 0.05, embedChunks: 3000, runtimeSec: 300 }, deps)).toMatchObject({ outcome: 'refused', exitCode: 2 });
    ops.collectStatus.mockResolvedValue(status({ coverage: { missingInIndex: 5 }, embeddings: { needEmbedding: 2460 } }));
    expect(await prod.runInitialEmbed({}, { execute: true, maxUsd: 0.05, embedChunks: 3000, runtimeSec: 300 }, deps)).toMatchObject({ outcome: 'refused' });
    const gateway = vi.fn();
    ops.collectStatus.mockResolvedValue(status({ embeddings: { needEmbedding: 2460 } }));
    expect(await prod.runInitialEmbed({}, { execute: false, embedChunks: 3000, runtimeSec: 300 }, { ...deps, createGateway: gateway })).toMatchObject({ outcome: 'dry-run', plan: { chunks: 2460 } });
    expect(gateway).not.toHaveBeenCalled();
  });

  it('Einbettungsschritt „initial“: verweigert bei aktiver Version, speichert über die gesperrte Schreibfunktion', async () => {
    const session = { gate: async () => {}, fence: () => ({ p_run_id: 1, p_holder: 'h' }) };
    const gateway = { usage: { embeddingTokens: 10 }, embed: async (t) => t.map(() => [0.1]) };
    const refused = await ops.runEmbedStep({}, gateway, session, { version: 'v@1', activeVersion: 'v@1', candidates: [{ id: 1, text: 'abc', content_hash: 'h' }], initial: true, maxChunks: 10, maxUsd: 1, deadline: Date.now() + 60_000 });
    expect(refused).toMatchObject({ skipped: true });
    const rpc = vi.fn(async () => ({ data: { stored: 1, changed: 0 }, error: null }));
    const done = await ops.runEmbedStep({ rpc }, gateway, session, { version: 'v@1', activeVersion: null, candidates: [{ id: 1, text: 'abc', content_hash: 'h' }], initial: true, maxChunks: 10, maxUsd: 1, deadline: Date.now() + 60_000 });
    expect(done).toMatchObject({ embedded: 1, calls: 1 });
    expect(rpc).toHaveBeenCalledWith('ai_search_ops_fenced_store_embeddings', expect.objectContaining({ p_model_version: 'v@1' }));
    // Ohne „initial“ bleibt der bisherige Schutz: keine Einbettung bei fehlender aktiver Version.
    expect(await ops.runEmbedStep({ rpc }, gateway, session, { version: 'v@1', activeVersion: null, candidates: [], maxChunks: 10, maxUsd: 1, deadline: Date.now() + 60_000 })).toMatchObject({ skipped: true });
  });

  it('Aufbewahrung Kontingentzeilen: nur mit Ergebnisbereinigung; löscht nur abgeschlossene Zeilen vor dem Vormonat', async () => {
    expect(ops.parseOpsArgs(['--purge-usage'], {}, PRODUCTION_REF).ok).toBe(false);
    expect(ops.parseOpsArgs(['--execute-cleanup', '--purge-usage'], { AI_OPS_CONFIRM: PRODUCTION_REF }, PRODUCTION_REF)).toMatchObject({ ok: true, options: { purgeUsage: true } });
    expect(ops.previousMonthKey(new Date('2027-01-15T12:00:00Z'))).toBe('2026-12');
    expect(ops.previousMonthKey(new Date('2026-11-25T12:00:00Z'))).toBe('2026-10');
    const calls = [];
    const chain = { delete: (o) => { calls.push(['delete', o]); return chain; }, lt: (c, v) => { calls.push(['lt', c, v]); return chain; }, in: async (c, v) => { calls.push(['in', c, v]); return { count: 4, error: null }; } };
    const client = { rpc: async () => ({ data: 2, error: null }), from: (t) => { calls.push(['from', t]); return chain; } };
    const session = { gate: async () => {}, fence: () => ({}) };
    expect(await ops.runCleanupStep(client, session, { batch: 100, purgeUsageBefore: '2026-10' })).toMatchObject({ deleted: 2, usageDeleted: 4 });
    expect(calls).toContainEqual(['from', 'ai_search_usage']);
    expect(calls).toContainEqual(['lt', 'month_key', '2026-10']);
    expect(calls).toContainEqual(['in', 'state', ['completed', 'released']]);
    const plain = { rpc: async () => ({ data: 1, error: null }), from: () => { throw new Error('kein Zugriff erwartet'); } };
    expect(await ops.runCleanupStep(plain, session, { batch: 100 })).toEqual({ deleted: 1, batch: 100 });
  });

  it('Rückweg: Deaktivierung nur mit --execute, Trockenlauf zeigt die aktive Version', async () => {
    const chain = { select: () => chain, eq: () => chain, limit: async () => ({ data: [{ active_model_version: 'v@1' }], error: null }), update: vi.fn(() => ({ eq: async () => ({ error: null }) })) };
    const client = { from: () => chain };
    expect(await prod.runDeactivate(client, { execute: false })).toMatchObject({ outcome: 'dry-run', plan: { activeVersion: 'v@1' } });
    expect(chain.update).not.toHaveBeenCalled();
    expect(await prod.runDeactivate(client, { execute: true })).toMatchObject({ outcome: 'ok', activeVersion: null });
  });

  it('Cron-Endpunkt ohne Laufsperre ist in der Vercel-Produktion gesperrt', async () => {
    const before = { VERCEL_ENV: process.env.VERCEL_ENV, CRON_SECRET: process.env.CRON_SECRET };
    process.env.VERCEL_ENV = 'production';
    process.env.CRON_SECRET = 'geheim';
    try {
      const { default: handler } = await import('../api/cron-ai-search.js');
      const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
      await handler({ method: 'GET', headers: { authorization: 'Bearer geheim' }, query: {} }, res);
      expect(res.body).toMatchObject({ skipped: true });
    } finally {
      process.env.VERCEL_ENV = before.VERCEL_ENV;
      process.env.CRON_SECRET = before.CRON_SECRET;
      if (before.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
      if (before.CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    }
  });

  it('Abbruch laufender Läufe: Trockenlauf listet offene Läufe; Ausführung fordert je Lauf den Abbruch an', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const client = { rpc, from: () => ({ select: () => ({ is: async () => ({ data: [{ id: 9, modes: ['index'], lease_until: 'x', abort_requested_at: null }], error: null }) }) }) };
    expect(await prod.runAbort(client, { execute: false })).toMatchObject({ outcome: 'dry-run', plan: { open: [{ id: 9 }] } });
    expect(rpc).not.toHaveBeenCalled();
    expect(await prod.runAbort(client, { execute: true })).toMatchObject({ outcome: 'ok', requested: [{ id: 9, requested: true }] });
    expect(rpc).toHaveBeenCalledWith('ai_search_ops_request_abort', expect.objectContaining({ p_run_id: 9 }));
    expect(prod.parseProdArgs('abort', ['--execute'], {}).ok).toBe(false);
  });

  it('TEST-Werkzeuge bleiben TEST-gebunden (unverändert)', () => {
    for (const file of ['scripts/ai-search-ops.mjs', 'scripts/ai-search-embed-test.mjs', 'scripts/ai-search-backfill-test.mjs']) {
      expect(readFileSync(path.join(ROOT, file), 'utf8')).toMatch(/checkTestTarget\(process\.env\)/);
    }
  });
});

describe('3. Produktionszeitplan', () => {
  const wf = readFileSync(path.join(ROOT, '.github/workflows/ai-ops-cycle-prod.yml'), 'utf8');

  it('aus bis zur Schalter-Variable; manuell nur vom Standardbranch; nie für Pull Requests', () => {
    expect(wf).toMatch(/github\.event_name == 'schedule' && vars\.AI_OPS_PROD_SCHEDULE_ENABLED == 'true'/);
    expect(wf).toMatch(/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
    expect(wf).not.toMatch(/^\s*(pull_request|pull_request_target|push|workflow_run):/m);
    expect(wf).toMatch(/environment: ki-produktion/);
    expect(wf).toMatch(/permissions:\s*\n\s*contents: read/);
  });

  it('Abbruch-Job steht nicht in der Betriebs-Warteschlange (wartet nicht auf den laufenden Lauf)', () => {
    const jobs = wf.split(/\n {2}(?=[a-z]+:\n)/);
    const produktion = jobs.find((j) => j.startsWith('produktion:'));
    const abbruch = jobs.find((j) => j.startsWith('abbruch:'));
    expect(produktion).toMatch(/group: ki-produktionsbetrieb/);
    expect(produktion).toMatch(/!startsWith\(inputs\.befehl, 'abbrechen'\)/);
    expect(abbruch).toBeTruthy();
    expect(abbruch).not.toMatch(/concurrency:/);
    expect(abbruch).toMatch(/abort --execute/);
    expect(wf).not.toMatch(/^concurrency:/m);
  });

  it('Kostenschwellen und Überwachung: Zyklus ≤ USD 0.01 je Lauf, roter Lauf bei kritischem Alarm', () => {
    const cycle = wf.split('\n').find((l) => /ops --execute-index --execute-embed --execute-cleanup/.test(l));
    expect(cycle).toMatch(/--max-usd=0\.01(\s|$)/);
    expect(wf).toMatch(/if: always\(\)\s*\n\s*run: node scripts\/ai-search-prod\.mjs status --alarm-exit/);
    expect(wf).not.toMatch(/resend|RESEND|cron-ai-search|AI_SEARCH_LEXICAL_PREFIX|SCORE_SAMPLES/);
  });
});
