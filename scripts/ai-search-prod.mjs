/**
 * Produktionswerkzeug der KI-Suche (Produktionspaket 25.11.2026).
 * AUSSCHLIESSLICH Produktionsprojekt nplxmpfasgpumpiddjfl. Die TEST-Werkzeuge
 * (backfill:ai-test, embed:ai-test, ops:ai-test) bleiben unverändert TEST-gebunden.
 *
 * STANDARD = LESENDER TROCKENLAUF. Jeder Befehl ohne --execute schreibt nichts
 * und ruft kein Modell auf.
 *
 *   node scripts/ai-search-prod.mjs status [--json] [--alarm-exit]
 *       Bereitstellung (Migrationen), Abdeckung, Aufträge, Embeddings,
 *       Löschrückstand, Laufprotokoll, begrenzte Kostenschätzung.
 *   node scripts/ai-search-prod.mjs ops [--execute-index] [--execute-embed --max-usd=X] [--execute-cleanup] [Grenzen]
 *       Laufender Betrieb über den bestehenden Betriebsrunner (Laufsperre v2,
 *       Grenzen und Stoppschwellen wie ops.js). Indexaufbau Stufe 1 =
 *       wiederholtes --execute-index (je Lauf höchstens 500 Einreihungen,
 *       40 × 50 Aufträge); jeder weitere Lauf setzt dort fort (Wiederaufnahme).
 *   node scripts/ai-search-prod.mjs initial-embed [--execute --max-usd=X] [--max-embed-chunks=N] [--max-runtime-sec=S]
 *       Ersteinbettung, nur solange KEINE Modellversion aktiv ist und der
 *       Index vollständig ist (0 fehlend, 0 verwaist, 0 offene/fehlgeschlagene
 *       Aufträge). Unter Laufsperre, Speichern nur bei unverändertem Abschnitt.
 *       Wiederholbar: verarbeitet nur Abschnitte ohne passendes Embedding.
 *   node scripts/ai-search-prod.mjs activate [--execute]
 *       Schaltet die konfigurierte Version aktiv, nur wenn ALLE Abschnitte
 *       eingebettet sind und der Index vollständig ist.
 *   node scripts/ai-search-prod.mjs deactivate [--execute]
 *       Rückweg: aktive Version entfernen (Suche fällt auf lexikalischen Abruf
 *       zurück; Embeddings bleiben erhalten).
 *
 * Schreibende Befehle brauchen zusätzlich:
 *   AI_PROD_CONFIRM=nplxmpfasgpumpiddjfl
 * Kostenpflichtige (Embeddings): AI_SEARCH_MODELS_ENABLED=1, OPENAI_API_KEY
 * (Schlüssel des Produktionsprojekts) und --max-usd ≤ 1 (Lauf-Stoppschwelle,
 * Schätzung; Monats-Stoppschwelle Runner-Embeddings USD 2).
 *
 * Ziel: SUPABASE_URL_PROD (strikt geprüft) und SUPABASE_SECRET_KEY_PROD.
 * Kein Mailversand, kein Cron-Endpunkt. Exit-Codes wie ops.js:
 * 0 ok · 1 Fehler · 2 Vorbedingung fehlt · 3 anderer Lauf aktiv · 4 Sperre
 * verloren · 5 kritischer Alarm (nur mit --alarm-exit).
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PRODUCTION_REF, AI_SEARCH_TEST_REF, supabaseRefOf } from '../src/lib/aiSearch/previewGuard.js';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import {
  parseOpsArgs, runOps, collectStatus, acquireLease, runEmbedStep, fetchEmbeddingCandidates,
  OpsError, OPS_LIMITS, STEP_MS,
} from '../src/lib/aiSearch/ops.js';
import { LeaseSession, LEASE_DEFAULTS } from '../src/lib/aiSearch/opsLease.js';
import { formatReport, timeoutFetch } from './ai-search-ops.mjs';

export const COMMANDS = Object.freeze(['status', 'ops', 'initial-embed', 'activate', 'deactivate']);
/** Tabellen/Funktionen, ohne die das Werkzeug nicht arbeitet (Migrationen M1–M7). */
export const REQUIRED_TABLES = Object.freeze(['ai_search_config', 'ai_search_documents', 'ai_search_chunks', 'ai_search_jobs', 'ai_search_index_state', 'ai_search_usage', 'ai_search_results', 'ai_search_ops_runs']);

/**
 * Strikte Zielprüfung: nur das Produktionsprojekt, nie TEST oder ein anderes.
 * @returns {{ok: true, url: string, key: string} | {ok: false, reason: string}}
 */
export function checkProductionTarget(env) {
  const ref = supabaseRefOf(env?.SUPABASE_URL_PROD);
  if (ref === AI_SEARCH_TEST_REF) return { ok: false, reason: 'SUPABASE_URL_PROD zeigt auf die TESTumgebung – dieses Werkzeug ist nur für Produktion.' };
  if (ref !== PRODUCTION_REF) return { ok: false, reason: `SUPABASE_URL_PROD muss exakt https://${PRODUCTION_REF}.supabase.co sein.` };
  if (!env?.SUPABASE_SECRET_KEY_PROD) return { ok: false, reason: 'SUPABASE_SECRET_KEY_PROD fehlt.' };
  return { ok: true, url: String(env.SUPABASE_URL_PROD).trim(), key: env.SUPABASE_SECRET_KEY_PROD };
}

/** Bestätigung für schreibende Befehle. */
export function hasProdConfirm(env) {
  return String(env?.AI_PROD_CONFIRM ?? '').trim() === PRODUCTION_REF;
}

/** Modellkonfiguration mit der Produktions-Zielprüfung statt des Web-Umgebungsschutzes. */
export function prodModelConfig(env) {
  const target = checkProductionTarget(env);
  return readModelConfig(env, { checkEnvironment: () => (target.ok ? { ok: true, ref: PRODUCTION_REF, mode: 'production' } : { ok: false, code: 'wrong_environment', reason: target.reason }) });
}

function readFlags(argv, allowed) {
  const flags = new Map();
  const errors = [];
  for (const raw of argv) {
    if (!raw.startsWith('--')) { errors.push(`Unbekannte Angabe: ${raw}`); continue; }
    const [name, ...rest] = raw.slice(2).split('=');
    if (!allowed.includes(name)) { errors.push(`Unbekannter Schalter für diesen Befehl: --${name}`); continue; }
    flags.set(name, rest.length ? rest.join('=') : true);
  }
  return { flags, errors };
}

function intFlag(flags, name, fallback, max, errors) {
  if (!flags.has(name)) return fallback;
  const value = Number(flags.get(name));
  if (!Number.isInteger(value) || value < 1 || value > max) { errors.push(`--${name} muss eine ganze Zahl zwischen 1 und ${max} sein.`); return fallback; }
  return value;
}

/**
 * Prüft die Befehlszeile der Befehle initial-embed/activate/deactivate.
 * @returns {{ok: boolean, errors: string[], options: object}}
 */
export function parseProdArgs(command, argv, env) {
  const allowed = {
    'initial-embed': ['execute', 'max-usd', 'max-embed-chunks', 'max-runtime-sec', 'json'],
    activate: ['execute', 'json'],
    deactivate: ['execute', 'json'],
  }[command];
  if (!allowed) return { ok: false, errors: [`Unbekannter Befehl: ${command}`], options: {} };
  const { flags, errors } = readFlags(argv, allowed);
  const execute = flags.get('execute') === true;
  const options = {
    execute,
    json: flags.get('json') === true,
    embedChunks: intFlag(flags, 'max-embed-chunks', OPS_LIMITS.maxEmbedChunks, OPS_LIMITS.maxEmbedChunks, errors),
    runtimeSec: intFlag(flags, 'max-runtime-sec', OPS_LIMITS.defaultRuntimeSec, OPS_LIMITS.maxRuntimeSec, errors),
    maxUsd: null,
  };
  if (execute && !hasProdConfirm(env)) errors.push(`Schreibende Befehle brauchen AI_PROD_CONFIRM=${PRODUCTION_REF}.`);
  if (command === 'initial-embed' && execute) {
    const maxUsd = Number(flags.get('max-usd'));
    if (!flags.has('max-usd') || !Number.isFinite(maxUsd) || maxUsd <= 0) errors.push('initial-embed --execute braucht --max-usd=<Stoppschwelle in USD>.');
    else if (maxUsd > OPS_LIMITS.maxEmbedUsdPerRun) errors.push(`--max-usd=${maxUsd} liegt über der Lauf-Stoppschwelle ${OPS_LIMITS.maxEmbedUsdPerRun} USD.`);
    else options.maxUsd = maxUsd;
  } else if (flags.has('max-usd')) {
    errors.push('--max-usd gilt nur mit initial-embed --execute.');
  }
  return { ok: errors.length === 0, errors, options };
}

/** Index vollständig und ohne Rückstand (Voraussetzung für Einbettung/Aktivierung). */
export function indexComplete(status) {
  const gaps = [];
  if (status.coverage.missingInIndex > 0) gaps.push(`${status.coverage.missingInIndex} veröffentlichte Kurse fehlen im Index`);
  if (status.coverage.orphanedInIndex > 0) gaps.push(`${status.coverage.orphanedInIndex} verwaiste Indexeinträge`);
  if (status.coverage.nullStatus > 0) gaps.push(`${status.coverage.nullStatus} Kurse ohne Status`);
  if (status.jobs.pending > 0) gaps.push(`${status.jobs.pending} offene Aufträge`);
  if (status.jobs.failed > 0) gaps.push(`${status.jobs.failed} fehlgeschlagene Aufträge`);
  if (status.coverage.published > 0 && status.coverage.documents === 0) gaps.push('Index leer');
  return { ok: gaps.length === 0, gaps };
}

/** Bereitstellung: alle KI-Tabellen lesbar (Service-Rolle). Fehlend = Migrationen fehlen. */
export async function checkDeployment(client) {
  const missing = [];
  for (const table of REQUIRED_TABLES) {
    const { error } = await client.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (error) missing.push(`${table} (${error.code ?? error.message})`);
  }
  return { ok: missing.length === 0, missing };
}

/** Ersteinbettung unter Laufsperre (siehe Kopf). */
export async function runInitialEmbed(client, options, deps) {
  const status = await collectStatus(client, { embeddingVersion: deps.embeddingVersion, now: new Date() });
  const index = indexComplete(status);
  const plan = { activeVersion: status.embeddings.activeVersion, version: deps.embeddingVersion, needEmbedding: status.embeddings.needEmbedding, chunks: Math.min(status.embeddings.needEmbedding, options.embedChunks), estimateUsd: status.estimate.embeddingUsd, index };
  if (status.embeddings.activeVersion) {
    return { exitCode: 2, outcome: 'refused', plan, message: `Bereits aktiv: ${status.embeddings.activeVersion}. Laufende Einbettung über „ops --execute-embed“.` };
  }
  if (!index.ok) return { exitCode: 2, outcome: 'refused', plan, message: `Index unvollständig – keine Einbettung: ${index.gaps.join('; ')}.` };
  if (!options.execute) return { exitCode: 0, outcome: 'dry-run', plan };
  if (!deps.modelsEnabled) throw new OpsError('Embeddings gesperrt: AI_SEARCH_MODELS_ENABLED=1 und OPENAI_API_KEY nötig.', 2);

  const leaseSec = LEASE_DEFAULTS.leaseSec;
  const runId = await acquireLease(client, { holder: deps.holder, modes: ['embed'], leaseSeconds: leaseSec, maxSeconds: options.runtimeSec + OPS_LIMITS.leaseGraceSec });
  if (runId === null) return { exitCode: 3, outcome: 'locked', plan, message: 'Ein anderer Betriebsdurchlauf ist aktiv – nichts ausgeführt.' };
  const session = new LeaseSession(client, { runId, holder: deps.holder, leaseSec });
  deps.onSession?.(session);
  let step = null;
  let failure = null;
  try {
    const candidates = await fetchEmbeddingCandidates(client, deps.embeddingVersion);
    step = await runEmbedStep(client, deps.createGateway(), session, {
      version: deps.embeddingVersion, activeVersion: null, candidates, initial: true,
      maxChunks: options.embedChunks, maxUsd: options.maxUsd,
      monthSpentUsd: status.estimate.runnerEmbedUsdMonth ?? 0,
      deadline: Date.now() + options.runtimeSec * 1000,
    });
  } catch (error) {
    failure = error;
  }
  const outcome = failure ? (failure.leaseLost ? 'lost' : 'failed') : 'ok';
  const lease = await session.release(outcome, { modes: ['embed'], initial: true, embed: step ? { embedded: step.embedded, calls: step.calls, actualUsd: step.actualUsd ?? null } : undefined, error: failure ? String(failure.message ?? failure).slice(0, 300) : undefined });
  const after = await collectStatus(client, { embeddingVersion: deps.embeddingVersion, now: new Date() });
  return { exitCode: failure ? (failure.exitCode ?? 1) : 0, outcome, runId, plan, step, lease, after: { needEmbedding: after.embeddings.needEmbedding, chunksTotal: after.embeddings.chunksTotal }, error: failure ? String(failure.message ?? failure) : null };
}

/** Aktivierung nur bei vollständiger Einbettung und vollständigem Index. */
export async function runActivate(client, options, deps) {
  const status = await collectStatus(client, { embeddingVersion: deps.embeddingVersion, now: new Date() });
  const index = indexComplete(status);
  const plan = { activeVersion: status.embeddings.activeVersion, version: deps.embeddingVersion, needEmbedding: status.embeddings.needEmbedding, chunksTotal: status.embeddings.chunksTotal, index };
  if (status.embeddings.activeVersion === deps.embeddingVersion) return { exitCode: 0, outcome: 'no-work', plan, message: 'Version ist bereits aktiv.' };
  if (status.embeddings.activeVersion) return { exitCode: 2, outcome: 'refused', plan, message: `Andere Version aktiv (${status.embeddings.activeVersion}) – Modellwechsel ist nicht Teil dieses Pakets.` };
  if (!index.ok) return { exitCode: 2, outcome: 'refused', plan, message: `Index unvollständig: ${index.gaps.join('; ')}.` };
  if (status.embeddings.chunksTotal === 0) return { exitCode: 2, outcome: 'refused', plan, message: 'Keine Abschnitte im Index.' };
  if (status.embeddings.needEmbedding > 0) return { exitCode: 2, outcome: 'refused', plan, message: `${status.embeddings.needEmbedding} Abschnitte ohne Embedding dieser Version – nicht aktiviert.` };
  if (!options.execute) return { exitCode: 0, outcome: 'dry-run', plan };
  const { data, error } = await client.from('ai_search_config')
    .update({ active_model_version: deps.embeddingVersion, updated_at: new Date().toISOString() })
    .eq('id', 1).is('active_model_version', null).select('active_model_version');
  if (error) throw new OpsError(`Aktivieren: ${error.message}`);
  if (!Array.isArray(data) || data.length !== 1) return { exitCode: 1, outcome: 'failed', plan, message: 'Aktivierung nicht übernommen (Konfiguration geändert?).' };
  return { exitCode: 0, outcome: 'ok', plan, activeVersion: data[0].active_model_version };
}

/** Rückweg: aktive Version entfernen (Embeddings bleiben). */
export async function runDeactivate(client, options) {
  const { data: rows, error: readError } = await client.from('ai_search_config').select('active_model_version').eq('id', 1).limit(1);
  if (readError) throw new OpsError(`Konfiguration lesen: ${readError.message}`);
  const activeVersion = rows?.[0]?.active_model_version ?? null;
  if (!activeVersion) return { exitCode: 0, outcome: 'no-work', plan: { activeVersion }, message: 'Keine Version aktiv.' };
  if (!options.execute) return { exitCode: 0, outcome: 'dry-run', plan: { activeVersion } };
  const { error } = await client.from('ai_search_config').update({ active_model_version: null, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw new OpsError(`Deaktivieren: ${error.message}`);
  return { exitCode: 0, outcome: 'ok', plan: { activeVersion }, activeVersion: null };
}

function printResult(command, result, json) {
  if (json) { console.log(JSON.stringify({ command, ...result }, null, 2)); return; }
  console.log(`Befehl: ${command} – Ergebnis: ${result.outcome}`);
  if (result.message) console.log(result.message);
  console.log(`Plan: ${JSON.stringify(result.plan)}`);
  if (result.step) console.log(`Schritt: ${JSON.stringify(result.step)}`);
  if (result.after) console.log(`Danach: ${JSON.stringify(result.after)}`);
  if (result.lease) console.log(`Laufsperre: ${JSON.stringify(result.lease)}`);
  if (result.error) console.log(`FEHLER: ${result.error}`);
  if (result.outcome === 'dry-run') console.log('TROCKENLAUF: keine Schreibzugriffe, keine Modellaufrufe.');
}

async function main() {
  const [command = 'status', ...argv] = process.argv.slice(2);
  if (!COMMANDS.includes(command)) { console.error(`Abbruch: Befehl ${command} unbekannt (${COMMANDS.join(', ')}).`); process.exit(2); }
  const target = checkProductionTarget(process.env);
  if (!target.ok) { console.error(`Abbruch: ${target.reason}`); process.exit(2); }
  const client = createClient(target.url, target.key, { auth: { persistSession: false }, global: { fetch: timeoutFetch(STEP_MS.dbRequest) } });
  const config = prodModelConfig(process.env);
  const deployment = await checkDeployment(client);
  if (!deployment.ok) { console.error(`Abbruch: KI-Migrationen fehlen in Produktion: ${deployment.missing.join(', ')}.`); process.exit(2); }
  console.log(`Ziel: Produktion ${PRODUCTION_REF} · Modellversion ${config.embeddingVersion} · Modellaufrufe ${config.enabled ? 'freigeschaltet' : `gesperrt (${config.reason})`}`);

  let session = null;
  const stop = (signal) => { if (session) session.requestStop(signal); else process.exit(130); };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  const deps = {
    embeddingVersion: config.embeddingVersion,
    modelsEnabled: config.enabled && Boolean(process.env.OPENAI_API_KEY),
    createGateway: () => createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: config.embeddingModel }),
    holder: randomUUID(),
    onSession: (value) => { session = value; },
  };

  if (command === 'status' || command === 'ops') {
    // Gleiche Bestätigung wie die übrigen Befehle (AI_PROD_CONFIRM), geprüft vom Betriebsrunner.
    const args = command === 'status' ? argv.filter((a) => a === '--json' || a === '--alarm-exit') : argv;
    if (command === 'status' && args.length !== argv.length) { console.error('Abbruch: status ist lesend und nimmt nur --json und --alarm-exit.'); process.exit(2); }
    const parsed = parseOpsArgs(args, { AI_OPS_CONFIRM: process.env.AI_PROD_CONFIRM }, PRODUCTION_REF);
    if (!parsed.ok) { for (const message of parsed.errors) console.error(`Abbruch: ${message.replace('AI_OPS_CONFIRM', 'AI_PROD_CONFIRM')}`); process.exit(2); }
    const report = await runOps(client, parsed.options, deps);
    console.log(parsed.options.json ? JSON.stringify(report, null, 2) : formatReport(report));
    process.exit(report.exitCode);
  }

  const parsed = parseProdArgs(command, argv, process.env);
  if (!parsed.ok) { for (const message of parsed.errors) console.error(`Abbruch: ${message}`); process.exit(2); }
  const result = command === 'initial-embed'
    ? await runInitialEmbed(client, parsed.options, deps)
    : command === 'activate' ? await runActivate(client, parsed.options, deps) : await runDeactivate(client, parsed.options);
  printResult(command, result, parsed.options.json);
  process.exit(result.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Abbruch: ${error?.message ?? error}`);
    process.exit(error instanceof OpsError ? error.exitCode : 1);
  });
}
