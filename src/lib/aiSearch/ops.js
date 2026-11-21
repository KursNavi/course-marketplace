/**
 * Betriebsrunner der KI-Suche – Kernlogik (ohne Netz testbar).
 *
 * Baut ausschliesslich auf vorhandenen Bausteinen auf:
 *  - Index:      runReconciliation (OHNE globalen Kontingent-Cleanup) und
 *                drainOutbox (Outbox-Worker, atomare Übernahme in SQL).
 *  - Embeddings: nur Abschnitte ohne Vektor oder mit anderer Modellversion
 *                als der aktiven; Speichern nur, wenn der Abschnittsinhalt
 *                (content_hash) seit dem Lesen unverändert ist.
 *  - Bereinigung: ai_search_result_cleanup (Migration 20261121122101).
 *  - Bericht:    Abdeckung, Aktualität, Fehler, offene Jobs, geschätzter
 *                Verbrauch (alles Schätzungen, ohne Gewähr).
 *
 * Standard ist ein LESENDER Trockenlauf. Jeder schreibende Schritt braucht
 * seinen eigenen Ausführungsschalter (siehe parseOpsArgs). Schreibende Läufe
 * nehmen vorher eine Laufsperre in der Datenbank (Entwurf
 * 20261121160000_ai_search_ops_lease); fehlt sie, sind schreibende Modi
 * gesperrt. Kein Mailversand, kein Kontingent-Cleanup, kein Cron-Endpunkt.
 */

import { diffCoverage, runReconciliation } from './reconciliation.js';
import { drainOutbox } from './worker.js';
import { monthKeyZurich } from './quota.js';
import { isMissingFunction } from './abuseGuard.js';

/** Harte Obergrenzen je Lauf (Werte darüber werden abgewiesen, nicht gekappt). */
export const OPS_LIMITS = Object.freeze({
  defaultRuntimeSec: 300,
  maxRuntimeSec: 900,
  leaseGraceSec: 120,
  defaultIndexBatches: 10,
  maxIndexBatches: 40,
  indexBatchSize: 50,
  defaultMaxEnqueue: 200,
  maxEnqueue: 500,
  defaultEmbedChunks: 500,
  maxEmbedChunks: 3000,
  embedBatch: 100,
  maxEmbedUsdPerRun: 1,
  defaultCleanupBatch: 1000,
  maxCleanupBatch: 5000,
});

/** Preisannahmen (Preisliste 13.11.2026, vor Beschaffung bestätigen). */
export const OPS_PRICES = Object.freeze({
  embeddingUsdPerMillion: 0.02,
  // Obergrenze je KI-Suche laut e3-entscheidungsvorlage.md (Luna, 30 Kandidaten).
  searchUsdMax: 0.003,
  charsPerToken: 4,
});

export const MONTHLY_BUDGET_USD = 10;
export const STALE_PENDING_HOURS = 24;

const PAGE = 1000;
const MODES = ['index', 'embed', 'cleanup'];
const KNOWN_FLAGS = new Set([
  'execute-index', 'execute-embed', 'execute-cleanup', 'max-usd', 'max-runtime-sec',
  'max-index-batches', 'max-enqueue', 'max-embed-chunks', 'cleanup-batch', 'json',
]);

export class OpsError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'OpsError';
    this.exitCode = exitCode;
  }
}

export function estimateEmbeddingUsd(chars, prices = OPS_PRICES) {
  const tokens = Math.ceil((chars || 0) / prices.charsPerToken);
  return { tokens, usd: (tokens / 1_000_000) * prices.embeddingUsdPerMillion };
}

function readFlags(argv) {
  const flags = new Map();
  const unknown = [];
  for (const raw of argv) {
    if (!raw.startsWith('--')) { unknown.push(raw); continue; }
    const [name, ...rest] = raw.slice(2).split('=');
    if (!KNOWN_FLAGS.has(name)) { unknown.push(raw); continue; }
    flags.set(name, rest.length ? rest.join('=') : true);
  }
  return { flags, unknown };
}

function intFlag(flags, name, fallback, max, errors) {
  if (!flags.has(name)) return fallback;
  const value = Number(flags.get(name));
  if (!Number.isInteger(value) || value < 1) { errors.push(`--${name} muss eine ganze Zahl ≥ 1 sein.`); return fallback; }
  if (value > max) { errors.push(`--${name}=${value} liegt über der Obergrenze ${max}.`); return fallback; }
  return value;
}

/**
 * Wertet Kommandozeile und Umgebung aus. Unbekannte Schalter und Werte über
 * den Obergrenzen werden abgewiesen (kein stilles Kappen, kein Tippfehler-
 * Durchlauf wie „--execute“).
 */
export function parseOpsArgs(argv, env, expectedRef) {
  const errors = [];
  const { flags, unknown } = readFlags(argv);
  if (unknown.length) errors.push(`Unbekannte Angabe(n): ${unknown.join(' ')}`);

  const execute = {
    index: flags.get('execute-index') === true,
    embed: flags.get('execute-embed') === true,
    cleanup: flags.get('execute-cleanup') === true,
  };
  for (const mode of MODES) {
    const value = flags.get(`execute-${mode}`);
    if (value !== undefined && value !== true) errors.push(`--execute-${mode} nimmt keinen Wert.`);
  }
  const anyExecute = MODES.some((mode) => execute[mode]);

  const limits = {
    runtimeSec: intFlag(flags, 'max-runtime-sec', OPS_LIMITS.defaultRuntimeSec, OPS_LIMITS.maxRuntimeSec, errors),
    indexBatches: intFlag(flags, 'max-index-batches', OPS_LIMITS.defaultIndexBatches, OPS_LIMITS.maxIndexBatches, errors),
    maxEnqueue: intFlag(flags, 'max-enqueue', OPS_LIMITS.defaultMaxEnqueue, OPS_LIMITS.maxEnqueue, errors),
    embedChunks: intFlag(flags, 'max-embed-chunks', OPS_LIMITS.defaultEmbedChunks, OPS_LIMITS.maxEmbedChunks, errors),
    cleanupBatch: intFlag(flags, 'cleanup-batch', OPS_LIMITS.defaultCleanupBatch, OPS_LIMITS.maxCleanupBatch, errors),
    maxUsd: null,
  };

  if (anyExecute && env?.AI_OPS_CONFIRM !== expectedRef) {
    errors.push(`Schreibende Schritte brauchen die Bestätigung AI_OPS_CONFIRM=${expectedRef}.`);
  }
  if (execute.embed) {
    const maxUsd = Number(flags.get('max-usd'));
    if (!flags.has('max-usd') || !Number.isFinite(maxUsd) || maxUsd <= 0) {
      errors.push('--execute-embed braucht --max-usd=<Grenze in USD>.');
    } else if (maxUsd > OPS_LIMITS.maxEmbedUsdPerRun) {
      errors.push(`--max-usd=${maxUsd} liegt über der Laufgrenze ${OPS_LIMITS.maxEmbedUsdPerRun} USD.`);
    } else {
      limits.maxUsd = maxUsd;
    }
  } else if (flags.has('max-usd')) {
    errors.push('--max-usd gilt nur zusammen mit --execute-embed.');
  }

  return {
    ok: errors.length === 0,
    errors,
    options: { execute, anyExecute, limits, json: flags.get('json') === true },
  };
}

// ---------------------------------------------------------------------
// Lesende Erhebung
// ---------------------------------------------------------------------

async function fetchAll(client, table, columns, applyFilter, orderColumn = 'id') {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = client.from(table).select(columns).order(orderColumn, { ascending: true }).range(offset, offset + PAGE - 1);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table} lesen: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function count(client, table, applyFilter) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (applyFilter) query = applyFilter(query);
  const { count: value, error } = await query;
  if (error) throw new Error(`${table} zählen: ${error.message}`);
  return value ?? 0;
}

async function firstRow(client, table, columns, applyFilter) {
  let query = client.from(table).select(columns);
  if (applyFilter) query = applyFilter(query);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`${table} lesen: ${error.message}`);
  return data ?? null;
}

/** Filter: Abschnitt ohne Vektor oder mit anderer Modellversion. */
export function embeddingCandidateFilter(version) {
  const quoted = `"${String(version).replace(/"/g, '')}"`;
  return (query) => query.or(`embedding.is.null,model_version.is.null,model_version.neq.${quoted}`);
}

export async function fetchEmbeddingCandidates(client, version) {
  return fetchAll(client, 'ai_search_chunks', 'id, course_id, content_hash, text', embeddingCandidateFilter(version));
}

/**
 * Rein lesender Zustandsbericht. Schreibt nichts, ruft keine Modelle auf.
 */
export async function collectStatus(client, { embeddingVersion, now = new Date(), prices = OPS_PRICES } = {}) {
  const published = await fetchAll(client, 'courses', 'id', (q) => q.eq('status', 'published'));
  const documents = await fetchAll(client, 'ai_search_documents', 'course_id', null, 'course_id');
  const { missingInIndex, orphanedInIndex } = diffCoverage(published.map((r) => r.id), documents.map((r) => r.course_id));
  const nullStatus = await count(client, 'courses', (q) => q.is('status', null));

  const pending = await count(client, 'ai_search_jobs', (q) => q.eq('status', 'pending'));
  const pendingRetrying = await count(client, 'ai_search_jobs', (q) => q.eq('status', 'pending').gt('attempts', 0));
  const failed = await count(client, 'ai_search_jobs', (q) => q.eq('status', 'failed'));
  const oldestPending = await firstRow(client, 'ai_search_jobs', 'created_at',
    (q) => q.eq('status', 'pending').order('created_at', { ascending: true }));
  let failedSample = [];
  if (failed > 0) {
    const { data, error } = await client.from('ai_search_jobs').select('id, course_id, attempts, last_error')
      .eq('status', 'failed').order('id', { ascending: false }).limit(5);
    if (error) throw new Error(`ai_search_jobs lesen: ${error.message}`);
    failedSample = (data ?? []).map((r) => ({ ...r, last_error: String(r.last_error ?? '').slice(0, 200) }));
  }
  const lastIndexed = await firstRow(client, 'ai_search_documents', 'indexed_at',
    (q) => q.order('indexed_at', { ascending: false }));

  const config = await firstRow(client, 'ai_search_config', 'active_model_version', (q) => q.eq('id', 1));
  const activeVersion = config?.active_model_version ?? null;
  const chunksTotal = await count(client, 'ai_search_chunks');
  const candidates = embeddingVersion ? await fetchEmbeddingCandidates(client, embeddingVersion) : [];
  const candidateChars = candidates.reduce((sum, row) => sum + String(row.text ?? '').length, 0);
  const embedEstimate = estimateEmbeddingUsd(candidateChars, prices);

  const nowIso = now.toISOString();
  const resultsStored = await count(client, 'ai_search_results');
  const resultsExpired = await count(client, 'ai_search_results', (q) => q.lte('expires_at', nowIso));

  const monthKey = monthKeyZurich(now);
  const searchesCompleted = await count(client, 'ai_search_usage', (q) => q.eq('month_key', monthKey).eq('state', 'completed'));
  const searchesReleased = await count(client, 'ai_search_usage', (q) => q.eq('month_key', monthKey).eq('state', 'released'));
  // Auch abgebrochene Suchen können Modellkosten verursacht haben.
  const searchUsd = (searchesCompleted + searchesReleased) * prices.searchUsdMax;

  const oldestPendingHours = oldestPending?.created_at
    ? Math.round(((now.getTime() - new Date(oldestPending.created_at).getTime()) / 3_600_000) * 10) / 10
    : null;

  const alarms = [];
  if (nullStatus > 0) alarms.push(`${nullStatus} Kurs(e) ohne Status (Datenvertrag §1).`);
  if (missingInIndex.length > 0) alarms.push(`${missingInIndex.length} veröffentlichte(r) Kurs(e) fehlen im Index.`);
  if (orphanedInIndex.length > 0) alarms.push(`${orphanedInIndex.length} Indexeintrag/-einträge ohne veröffentlichten Kurs.`);
  if (failed > 0) alarms.push(`${failed} Job(s) im Status 'failed'.`);
  if (oldestPendingHours !== null && oldestPendingHours > STALE_PENDING_HOURS) {
    alarms.push(`Ältester offener Job ist ${oldestPendingHours} h alt (> ${STALE_PENDING_HOURS} h).`);
  }
  if (embeddingVersion && activeVersion !== embeddingVersion) {
    alarms.push(`Konfigurierte Embedding-Version ${embeddingVersion} ≠ aktive ${activeVersion ?? '—'} (Modellwechsel ist ein eigener Schritt).`);
  }

  return {
    checkedAt: nowIso,
    coverage: {
      published: published.length,
      documents: documents.length,
      missingInIndex: missingInIndex.length,
      orphanedInIndex: orphanedInIndex.length,
      missingSample: missingInIndex.slice(0, 10),
      orphanedSample: orphanedInIndex.slice(0, 10),
      nullStatus,
    },
    freshness: {
      lastIndexedAt: lastIndexed?.indexed_at ?? null,
      oldestPendingAt: oldestPending?.created_at ?? null,
      oldestPendingHours,
    },
    jobs: { pending, pendingRetrying, failed, failedSample },
    embeddings: {
      configuredVersion: embeddingVersion ?? null,
      activeVersion,
      chunksTotal,
      needEmbedding: candidates.length,
      needEmbeddingChars: candidateChars,
    },
    results: { stored: resultsStored, expired: resultsExpired },
    usage: { monthKey, searchesCompleted, searchesReleased },
    estimate: {
      note: 'Schätzung ohne Gewähr (Preisliste 13.11.2026); ersetzt nicht die Abrechnung des Anbieters.',
      embeddingTokens: embedEstimate.tokens,
      embeddingUsd: embedEstimate.usd,
      searchesUsdMax: searchUsd,
      monthTotalUsdMax: embedEstimate.usd + searchUsd,
      monthlyBudgetUsd: MONTHLY_BUDGET_USD,
    },
    alarms,
  };
}

// ---------------------------------------------------------------------
// Schreibende Schritte (nur mit eigenem Schalter, nur unter Laufsperre)
// ---------------------------------------------------------------------

export async function runIndexStep(client, { deadline, maxBatches, maxEnqueue, now = Date.now }) {
  const reconciliation = await runReconciliation(client, { skipQuotaCleanup: true, maxEnqueue });
  const remaining = deadline - now();
  if (remaining <= 0) return { reconciliation, worker: null, stoppedBy: 'runtime' };
  const worker = await drainOutbox(client, {
    timeBudgetMs: remaining,
    maxBatches,
    batchSize: OPS_LIMITS.indexBatchSize,
  });
  return { reconciliation, worker: { ...worker, errors: worker.errors.slice(0, 10) }, stoppedBy: worker.drained ? null : 'limit' };
}

export async function runEmbedStep(client, gateway, {
  version, activeVersion, candidates, maxChunks, maxUsd, deadline,
  now = Date.now, prices = OPS_PRICES,
}) {
  if (!version || version !== activeVersion) {
    return { skipped: true, reason: `Konfigurierte Version ${version ?? '—'} ≠ aktive ${activeVersion ?? '—'}; kein Modellwechsel im Betriebsrunner.` };
  }
  const planned = candidates.slice(0, maxChunks);
  const chars = planned.reduce((sum, row) => sum + String(row.text ?? '').length, 0);
  const estimate = estimateEmbeddingUsd(chars, prices);
  if (estimate.usd > maxUsd) {
    throw new OpsError(`Embedding-Schätzung USD ${estimate.usd.toFixed(4)} über Grenze ${maxUsd} – kein Aufruf.`, 2);
  }

  const result = { planned: planned.length, embedded: 0, changedMeanwhile: 0, calls: 0, estimate, stoppedBy: null };
  for (let i = 0; i < planned.length; i += OPS_LIMITS.embedBatch) {
    if (now() >= deadline) { result.stoppedBy = 'runtime'; break; }
    const spentTokens = gateway.usage?.embeddingTokens ?? 0;
    if ((spentTokens / 1_000_000) * prices.embeddingUsdPerMillion > maxUsd) { result.stoppedBy = 'usd'; break; }
    const batch = planned.slice(i, i + OPS_LIMITS.embedBatch);
    const vectors = await gateway.embed(batch.map((row) => row.text));
    result.calls += 1;
    if (!Array.isArray(vectors) || vectors.length !== batch.length) {
      throw new OpsError(`Embedding-Antwort unvollständig (${vectors?.length ?? 0}/${batch.length}).`);
    }
    for (let j = 0; j < batch.length; j += 1) {
      // Nur speichern, wenn der Abschnitt seit dem Lesen unverändert ist –
      // sonst gehört der Vektor zu einem alten Text.
      const { data, error } = await client.from('ai_search_chunks')
        .update({ embedding: JSON.stringify(vectors[j]), model_version: version })
        .eq('id', batch[j].id)
        .eq('content_hash', batch[j].content_hash)
        .select('id');
      if (error) throw new Error(`Embedding speichern ${batch[j].id}: ${error.message}`);
      if (Array.isArray(data) && data.length === 1) result.embedded += 1;
      else result.changedMeanwhile += 1;
    }
  }
  result.actualTokens = gateway.usage?.embeddingTokens ?? null;
  result.actualUsd = result.actualTokens === null ? null : (result.actualTokens / 1_000_000) * prices.embeddingUsdPerMillion;
  return result;
}

export async function runCleanupStep(client, { batch }) {
  const { data, error } = await client.rpc('ai_search_result_cleanup', { p_batch: batch });
  if (error) throw new Error(`Ergebnisbereinigung: ${error.message}`);
  return { deleted: Number(data ?? 0), batch };
}

// ---------------------------------------------------------------------
// Laufsperre
// ---------------------------------------------------------------------

export async function acquireLease(client, { holder, modes, leaseSeconds }) {
  const { data, error } = await client.rpc('ai_search_ops_lease_acquire', {
    p_holder: holder, p_modes: modes, p_lease_seconds: leaseSeconds,
  });
  if (error) {
    if (isMissingFunction(error)) {
      throw new OpsError('Laufsperre fehlt (Entwurf 20261121160000_ai_search_ops_lease nicht angewendet) – schreibende Schritte gesperrt.', 2);
    }
    // Rechte-/Transportfehler NICHT als „nicht vorhanden“ werten.
    throw new OpsError(`Laufsperre nicht prüfbar: ${error.code ?? '-'} ${error.message}`, 1);
  }
  return data ?? null;
}

async function releaseLease(client, { runId, holder, outcome, summary }) {
  const { data, error } = await client.rpc('ai_search_ops_lease_release', {
    p_run_id: runId, p_holder: holder, p_outcome: outcome, p_summary: summary,
  });
  if (error) return { released: false, error: error.message };
  return { released: data === true };
}

// ---------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------

/**
 * @param {object} client - Supabase-Client (Service-Rolle, TESTumgebung)
 * @param {{execute, anyExecute, limits}} options - aus parseOpsArgs
 * @param {{embeddingVersion: string, createGateway?: Function,
 *          modelsEnabled?: boolean, holder: string, now?: () => number,
 *          clock?: () => Date}} deps
 */
export async function runOps(client, options, deps) {
  const now = deps.now ?? Date.now;
  const clock = deps.clock ?? (() => new Date());
  const startedAt = now();
  const deadline = startedAt + options.limits.runtimeSec * 1000;
  const before = await collectStatus(client, { embeddingVersion: deps.embeddingVersion, now: clock() });

  const plan = {
    index: { execute: options.execute.index, wouldEnqueueMax: Math.min(before.coverage.missingInIndex + before.coverage.orphanedInIndex, options.limits.maxEnqueue), pendingJobs: before.jobs.pending, maxJobs: options.limits.indexBatches * OPS_LIMITS.indexBatchSize },
    embed: { execute: options.execute.embed, chunks: Math.min(before.embeddings.needEmbedding, options.limits.embedChunks), estimateUsd: before.estimate.embeddingUsd },
    cleanup: { execute: options.execute.cleanup, expired: before.results.expired, maxDelete: options.limits.cleanupBatch },
  };

  if (!options.anyExecute) {
    return { mode: 'dry-run', outcome: 'ok', exitCode: 0, before, plan, steps: {} };
  }

  if (options.execute.embed) {
    if (!deps.modelsEnabled || typeof deps.createGateway !== 'function') {
      throw new OpsError('Embeddings gesperrt: Modellaufrufe nicht freigeschaltet (AI_SEARCH_MODELS_ENABLED/OPENAI_API_KEY).', 2);
    }
  }

  const modes = MODES.filter((mode) => options.execute[mode]);
  const runId = await acquireLease(client, {
    holder: deps.holder,
    modes,
    leaseSeconds: options.limits.runtimeSec + OPS_LIMITS.leaseGraceSec,
  });
  if (runId === null) {
    return { mode: 'execute', outcome: 'locked', exitCode: 3, before, plan, steps: {}, message: 'Ein anderer Betriebsdurchlauf ist aktiv – nichts ausgeführt.' };
  }

  const steps = {};
  let outcome = 'ok';
  let failure = null;
  try {
    if (options.execute.index) {
      steps.index = await runIndexStep(client, { deadline, maxBatches: options.limits.indexBatches, maxEnqueue: options.limits.maxEnqueue, now });
      if ((steps.index.worker?.failures ?? 0) > 0) {
        throw new OpsError(`Index: ${steps.index.worker.failures} Kurs(e) fehlgeschlagen – weitere Schritte nicht ausgeführt.`);
      }
    }
    if (options.execute.embed) {
      if (now() >= deadline) steps.embed = { skipped: true, reason: 'Laufzeitgrenze erreicht' };
      else {
        const candidates = await fetchEmbeddingCandidates(client, deps.embeddingVersion);
        steps.embed = await runEmbedStep(client, deps.createGateway(), {
          version: deps.embeddingVersion,
          activeVersion: before.embeddings.activeVersion,
          candidates,
          maxChunks: options.limits.embedChunks,
          maxUsd: options.limits.maxUsd,
          deadline,
          now,
        });
      }
    }
    if (options.execute.cleanup) {
      if (now() >= deadline) steps.cleanup = { skipped: true, reason: 'Laufzeitgrenze erreicht' };
      else steps.cleanup = await runCleanupStep(client, { batch: options.limits.cleanupBatch });
    }
  } catch (error) {
    outcome = 'failed';
    failure = error;
  }

  const durationMs = now() - startedAt;
  const summary = {
    modes,
    durationMs,
    index: steps.index ? { enqueued: steps.index.reconciliation?.enqueued, jobs: steps.index.worker?.fetchedJobs, failures: steps.index.worker?.failures } : undefined,
    embed: steps.embed ? { embedded: steps.embed.embedded, actualUsd: steps.embed.actualUsd } : undefined,
    cleanup: steps.cleanup ? { deleted: steps.cleanup.deleted } : undefined,
    error: failure ? String(failure.message ?? failure).slice(0, 300) : undefined,
  };
  const lease = await releaseLease(client, { runId, holder: deps.holder, outcome, summary });

  let after = null;
  try {
    after = await collectStatus(client, { embeddingVersion: deps.embeddingVersion, now: clock() });
  } catch (error) {
    after = { error: String(error?.message ?? error) };
  }

  return {
    mode: 'execute',
    runId,
    outcome,
    exitCode: failure ? (failure.exitCode ?? 1) : 0,
    error: summary.error ?? null,
    durationMs,
    lease,
    before,
    plan,
    steps,
    after,
  };
}
