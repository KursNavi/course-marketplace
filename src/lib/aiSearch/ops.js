/**
 * Betriebsrunner der KI-Suche – Kernlogik (ohne Netz testbar).
 *
 * EIN gemeinsamer Betriebsablauf aus vorhandenen Bausteinen:
 *  - Index:       runReconciliation (OHNE globalen Kontingent-Cleanup) und
 *                 drainOutbox (Outbox-Worker, atomare Übernahme in SQL).
 *  - Embeddings:  nur Abschnitte ohne Vektor oder mit anderer Modellversion
 *                 als der aktiven; Speichern nur, wenn der Abschnittsinhalt
 *                 (content_hash) seit dem Lesen unverändert ist.
 *  - Bereinigung: physische Löschung abgelaufener Ergebnisse.
 *  - Bericht:     Aktualität, Abdeckung, offene/fehlgeschlagene Aufträge,
 *                 Embedding-Lücken, Löschrückstand, Laufprotokoll, Fehler und
 *                 eine ausdrücklich BEGRENZTE Kostenschätzung.
 *
 * Standard ist ein LESENDER Trockenlauf. Jeder schreibende Schritt braucht
 * seinen eigenen Ausführungsschalter (parseOpsArgs). Schreibende Läufe laufen
 * unter der Laufsperre v2 (Migration 20261121225750_ai_search_ops_lease_v2):
 * Besitz, Verlängerung vor jedem Schritt, Abbruch, Abschluss – und jede
 * Schreibfunktion prüft die Sperre selbst in der Datenbank (Schreibschutz).
 * Fehlt die Sperre, sind schreibende Modi gesperrt. Kein Mailversand, kein
 * Kontingent-Cleanup, kein Cron-Endpunkt.
 */

import { diffCoverage, runReconciliation } from './reconciliation.js';
import { drainOutbox } from './worker.js';
import { monthKeyZurich } from './quota.js';
import { isMissingFunction } from './abuseGuard.js';
import { LeaseSession, LeaseLostError, isLeaseLostDbError, LEASE_DEFAULTS } from './opsLease.js';

/** Harte Obergrenzen je Lauf (Werte darüber werden abgewiesen, nicht gekappt). */
export const OPS_LIMITS = Object.freeze({
  defaultRuntimeSec: 300,
  maxRuntimeSec: 900,
  // Gesamtgrenze der Sperre = Laufzeit + Reserve (≤ 1800 s in der Datenbank).
  leaseGraceSec: 120,
  defaultIndexBatches: 10,
  maxIndexBatches: 40,
  indexBatchSize: 50,
  defaultMaxEnqueue: 200,
  maxEnqueue: 500,
  defaultEmbedChunks: 500,
  maxEmbedChunks: 3000,
  embedBatch: 100,
  // Stoppschwellen, KEINE garantierten Kostengrenzen: Der Runner beginnt
  // keinen Aufruf, wenn Schätzung bzw. erfasste Teilkosten (Tokens laut
  // Anbieterantwort × Preisannahme) die Schwelle überschreiten würden. Ein
  // bereits gestarteter Aufruf, abweichende Tokenzahlen oder Preise können
  // die tatsächlichen Kosten darüber hinaus erhöhen.
  maxEmbedUsdPerRun: 1,
  // Erfasste Runner-Embedding-Teilkosten je Kalendermonat (Zürich).
  maxEmbedUsdPerMonth: 2,
  defaultCleanupBatch: 1000,
  maxCleanupBatch: 5000,
});

/** Längste Dauer einzelner Schritte für das Sperr-Gate (Anfrage-Timeouts + Reserve). */
export const STEP_MS = Object.freeze({
  dbRequest: 30_000,
  indexGroup: 45_000,
  // Embedding-Aufruf (Timeout 15 s) + Speichern (≤ 30 s).
  embedBatch: 50_000,
});

/** Preisannahmen (Preisliste 13.11.2026, vor Beschaffung bestätigen). */
export const OPS_PRICES = Object.freeze({
  embeddingUsdPerMillion: 0.02,
  // Obergrenze je KI-Suche laut e3-entscheidungsvorlage.md (Luna, 30 Kandidaten).
  searchUsdMax: 0.003,
  charsPerToken: 4,
});

export const MONTHLY_BUDGET_USD = 10;

/** Kennzeichnung der Kostenangaben (begrenzte Schätzung, siehe collectStatus). */
export const ESTIMATE_NOTE = 'Begrenzte Schätzung (Preisannahmen 13.11.2026), nicht der vollständige Projektverbrauch und keine garantierte Monatsobergrenze; massgeblich ist die Abrechnung des Anbieters.';
export const ESTIMATE_SCOPE = Object.freeze([
  'Suchen dieses Monats laut Kontingenttabelle der TESTdatenbank × angenommener Höchstpreis je Suche',
  'noch fehlende/veraltete Embeddings dieser TESTdatenbank (einmalig, ~4 Zeichen je Token)',
]);
export const ESTIMATE_EXCLUDES = Object.freeze([
  'Embedding-Läufe ausserhalb des Betriebsrunners (Backfill-/Testskripte) und Sonden',
  'Modellaufrufe ausserhalb der Kontingenttabelle (z. B. Tests, Vorschau, andere Umgebungen)',
  'andere Nutzung desselben Anbieterkontos',
  'Preisänderungen, Steuern, Gebühren',
]);
export const STALE_PENDING_HOURS = 24;
/** Löschrückstand: ab so vielen Stunden nach Ablauf gilt ein Ergebnis als überfällig. */
export const CLEANUP_ALARM_HOURS = 2;
/** Zeitraum für Problemläufe im Bericht. */
export const PROBLEM_WINDOW_HOURS = 24 * 7;

const PAGE = 1000;
const MODES = ['index', 'embed', 'cleanup'];
const KNOWN_FLAGS = new Set([
  'execute-index', 'execute-embed', 'execute-cleanup', 'max-usd', 'max-runtime-sec',
  'max-index-batches', 'max-enqueue', 'max-embed-chunks', 'cleanup-batch', 'json', 'alarm-exit',
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
  for (const name of ['json', 'alarm-exit']) {
    const value = flags.get(name);
    if (value !== undefined && value !== true) errors.push(`--${name} nimmt keinen Wert.`);
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
      errors.push('--execute-embed braucht --max-usd=<Stoppschwelle in USD, Schätzung>.');
    } else if (maxUsd > OPS_LIMITS.maxEmbedUsdPerRun) {
      errors.push(`--max-usd=${maxUsd} liegt über der höchsten Lauf-Stoppschwelle ${OPS_LIMITS.maxEmbedUsdPerRun} USD (Schätzung).`);
    } else {
      limits.maxUsd = maxUsd;
    }
  } else if (flags.has('max-usd')) {
    errors.push('--max-usd gilt nur zusammen mit --execute-embed.');
  }

  return {
    ok: errors.length === 0,
    errors,
    options: {
      execute, anyExecute, limits,
      json: flags.get('json') === true,
      alarmExit: flags.get('alarm-exit') === true,
    },
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

const hoursBetween = (later, earlier) => Math.round(((later.getTime() - new Date(earlier).getTime()) / 3_600_000) * 10) / 10;

/** Fehlende Tabelle (Laufsperre nicht angewendet) – PostgREST/PG-Codes. */
export function isMissingTable(error) {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01'
    || /Could not find the table|relation .* does not exist/i.test(String(error.message ?? ''));
}

/** Filter: Abschnitt ohne Vektor oder mit anderer Modellversion. */
export function embeddingCandidateFilter(version) {
  const quoted = `"${String(version).replace(/"/g, '')}"`;
  return (query) => query.or(`embedding.is.null,model_version.is.null,model_version.neq.${quoted}`);
}

export async function fetchEmbeddingCandidates(client, version) {
  return fetchAll(client, 'ai_search_chunks', 'id, course_id, content_hash, text', embeddingCandidateFilter(version));
}

const runUsd = (run) => {
  const value = Number(run?.summary?.embed?.actualUsd ?? run?.summary?.late_summary?.embed?.actualUsd);
  return Number.isFinite(value) ? value : 0;
};

/**
 * Laufprotokoll (Laufsperre v2). Liefert {applied:false}, wenn die Tabelle
 * fehlt; andere Fehler (Rechte/Transport) werden NICHT verschluckt.
 */
export async function readOpsState(client, now = new Date()) {
  const monthKey = monthKeyZurich(now);
  // Grosszügig ab Monatsanfang UTC − 1 Tag lesen, danach exakt nach
  // Zürcher Monat bzw. Problemfenster filtern.
  const [year, month] = monthKey.split('-').map(Number);
  const monthFloor = new Date(Date.UTC(year, month - 1, 1) - 86_400_000);
  const problemFloor = new Date(now.getTime() - PROBLEM_WINDOW_HOURS * 3_600_000);
  const since = new Date(Math.min(monthFloor.getTime(), problemFloor.getTime())).toISOString();

  const { data, error } = await client.from('ai_search_ops_runs')
    .select('id, modes, started_at, finished_at, outcome, lease_until, heartbeat_at, renewals, abort_requested_at, summary')
    .or(`started_at.gte.${since},finished_at.is.null`)
    .order('started_at', { ascending: false })
    .limit(2000);
  if (error) {
    if (isMissingTable(error)) return { applied: false };
    throw new Error(`ai_search_ops_runs lesen: ${error.message}`);
  }
  const runs = data ?? [];
  const open = runs.filter((r) => !r.finished_at);
  const active = open.filter((r) => new Date(r.lease_until) > now);
  const stale = open.filter((r) => new Date(r.lease_until) <= now);
  const problemRuns = runs.filter((r) => r.finished_at && ['failed', 'expired', 'lost', 'aborted'].includes(r.outcome)
    && new Date(r.started_at) >= problemFloor);
  const lastOk = {};
  for (const mode of [...MODES, 'cleanup-scheduled']) {
    const hit = runs.find((r) => r.outcome === 'ok' && Array.isArray(r.modes) && r.modes.includes(mode));
    lastOk[mode] = hit ? hit.finished_at : null;
  }
  const monthRuns = runs.filter((r) => monthKeyZurich(new Date(r.started_at)) === monthKey);
  const embedUsdMonth = monthRuns.reduce((sum, r) => sum + runUsd(r), 0);
  const lastTick = runs.find((r) => Array.isArray(r.modes) && r.modes.includes('cleanup-scheduled')) ?? null;
  return {
    applied: true,
    active: active.map((r) => ({ id: r.id, modes: r.modes, startedAt: r.started_at, leaseUntil: r.lease_until, heartbeatAt: r.heartbeat_at, renewals: r.renewals, abortRequested: Boolean(r.abort_requested_at) })),
    stale: stale.map((r) => ({ id: r.id, modes: r.modes, leaseUntil: r.lease_until })),
    recent: runs.filter((r) => !(r.modes ?? []).includes('cleanup-scheduled')).slice(0, 5)
      .map((r) => ({ id: r.id, modes: r.modes, startedAt: r.started_at, outcome: r.outcome ?? (r.finished_at ? null : 'läuft'), error: r.summary?.error ?? null })),
    problemRuns: problemRuns.slice(0, 10).map((r) => ({ id: r.id, modes: r.modes, startedAt: r.started_at, outcome: r.outcome, error: r.summary?.error ?? null })),
    problemCount: problemRuns.length,
    lastOk,
    lastCleanupTick: lastTick ? { at: lastTick.finished_at, deleted: lastTick.summary?.deleted ?? null, expiredLeft: lastTick.summary?.expired_left ?? null } : null,
    embedUsdMonth,
  };
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
  const pendingRows = pending > 0 ? await fetchAll(client, 'ai_search_jobs', 'id, course_id', (q) => q.eq('status', 'pending')) : [];
  const pendingCourses = new Set(pendingRows.map((r) => String(r.course_id))).size;
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
  const oldestExpired = resultsExpired > 0
    ? await firstRow(client, 'ai_search_results', 'expires_at', (q) => q.lte('expires_at', nowIso).order('expires_at', { ascending: true }))
    : null;
  const backlogHours = oldestExpired?.expires_at ? hoursBetween(now, oldestExpired.expires_at) : null;

  const monthKey = monthKeyZurich(now);
  const searchesCompleted = await count(client, 'ai_search_usage', (q) => q.eq('month_key', monthKey).eq('state', 'completed'));
  const searchesReleased = await count(client, 'ai_search_usage', (q) => q.eq('month_key', monthKey).eq('state', 'released'));
  // Auch abgebrochene Suchen können Modellkosten verursacht haben.
  const searchUsd = (searchesCompleted + searchesReleased) * prices.searchUsdMax;

  const ops = await readOpsState(client, now);

  const oldestPendingHours = oldestPending?.created_at ? hoursBetween(now, oldestPending.created_at) : null;

  // Kritische Alarme (für --alarm-exit) und Hinweise.
  const critical = [];
  const notes = [];
  if (nullStatus > 0) notes.push(`${nullStatus} Kurs(e) ohne Status (Datenvertrag §1).`);
  if (missingInIndex.length > 0) notes.push(`${missingInIndex.length} veröffentlichte(r) Kurs(e) fehlen im Index.`);
  if (orphanedInIndex.length > 0) notes.push(`${orphanedInIndex.length} Indexeintrag/-einträge ohne veröffentlichten Kurs.`);
  if (failed > 0) critical.push(`${failed} Auftrag/Aufträge im Status 'failed'.`);
  if (oldestPendingHours !== null && oldestPendingHours > STALE_PENDING_HOURS) {
    critical.push(`Ältester offener Auftrag ist ${oldestPendingHours} h alt (> ${STALE_PENDING_HOURS} h).`);
  }
  if (embeddingVersion && activeVersion !== embeddingVersion) {
    notes.push(`Konfigurierte Embedding-Version ${embeddingVersion} ≠ aktive ${activeVersion ?? '—'} (Modellwechsel ist ein eigener Schritt).`);
  }
  if (candidates.length > 0) notes.push(`${candidates.length} Abschnitt(e) ohne passendes Embedding.`);
  if (backlogHours !== null && backlogHours > CLEANUP_ALARM_HOURS) {
    critical.push(`Löschrückstand: ${resultsExpired} abgelaufene(s) Ergebnis(se), ältestes seit ${backlogHours} h abgelaufen (> ${CLEANUP_ALARM_HOURS} h).`);
  }
  if (ops.applied) {
    for (const run of ops.stale) critical.push(`Lauf ${run.id} (${run.modes.join('+')}) ist abgelaufen, aber nicht abgeschlossen (Absturz?); wird beim nächsten Lauf als 'expired' protokolliert.`);
    const recentProblems = ops.problemRuns.filter((r) => new Date(r.startedAt) >= new Date(now.getTime() - 24 * 3_600_000));
    if (recentProblems.length > 0) critical.push(`${recentProblems.length} Betriebslauf/-läufe in den letzten 24 h nicht erfolgreich (${recentProblems.map((r) => `${r.id}:${r.outcome}`).join(', ')}).`);
    if (ops.embedUsdMonth > OPS_LIMITS.maxEmbedUsdPerMonth * 0.8) {
      notes.push(`Erfasste Runner-Embedding-Teilkosten diesen Monat ca. USD ${ops.embedUsdMonth.toFixed(4)} – über 80 % der Monats-Stoppschwelle USD ${OPS_LIMITS.maxEmbedUsdPerMonth} (Schätzung, keine Abrechnung).`);
    }
  } else {
    notes.push('Laufsperre v2 nicht angewendet – schreibende Schritte gesperrt, kein Laufprotokoll.');
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
    jobs: { pending, pendingCourses, pendingRetrying, failed, failedSample },
    embeddings: {
      configuredVersion: embeddingVersion ?? null,
      activeVersion,
      chunksTotal,
      needEmbedding: candidates.length,
      needEmbeddingChars: candidateChars,
    },
    results: {
      stored: resultsStored,
      expired: resultsExpired,
      oldestExpiredAt: oldestExpired?.expires_at ?? null,
      backlogHours,
    },
    ops,
    usage: { monthKey, searchesCompleted, searchesReleased },
    // BEGRENZTE SCHÄTZUNG – kein vollständiger Projektverbrauch und keine
    // garantierte Monatsobergrenze. Sie umfasst nur die beiden genannten
    // Posten dieser Testdatenbank (siehe scope/excludes).
    estimate: {
      kind: 'partial-estimate',
      note: ESTIMATE_NOTE,
      scope: ESTIMATE_SCOPE,
      excludes: ESTIMATE_EXCLUDES,
      embeddingTokens: embedEstimate.tokens,
      embeddingUsd: embedEstimate.usd,
      searchesUsdEstimate: searchUsd,
      partialTotalUsd: embedEstimate.usd + searchUsd,
      // Gemessen (Tokens laut Anbieterantwort × Preisannahme), nur Runner.
      runnerEmbedUsdMonth: ops.applied ? ops.embedUsdMonth : null,
      monthlyBudgetUsd: MONTHLY_BUDGET_USD,
    },
    critical,
    alarms: [...critical, ...notes],
  };
}

// ---------------------------------------------------------------------
// Schreibende Schritte (nur mit eigenem Schalter, nur unter Laufsperre)
// ---------------------------------------------------------------------

function leaseErrorFrom(error) {
  return new LeaseLostError('fenced', `Schreibschutz der Datenbank: Sperre ungültig (${error.code ?? '-'}) – kein weiterer Schritt.`);
}

/** Geschützte Einreihung für runReconciliation (Sperrprüfung in der Datenbank). */
function fencedEnqueue(client, session) {
  return async (courseIds, priority) => {
    if (!courseIds || courseIds.length === 0) return 0;
    await session.gate(STEP_MS.dbRequest);
    const { data, error } = await client.rpc('ai_search_ops_fenced_enqueue', {
      ...session.fence(), p_course_ids: courseIds, p_priority: priority,
    });
    if (error) {
      if (isLeaseLostDbError(error)) throw leaseErrorFrom(error);
      throw new Error(`Jobs einreihen: ${error.message}`);
    }
    return Number(data ?? 0);
  };
}

export async function runIndexStep(client, session, { deadline, maxBatches, maxEnqueue, now = Date.now }) {
  const reconciliation = await runReconciliation(client, {
    skipQuotaCleanup: true,
    maxEnqueue,
    enqueue: fencedEnqueue(client, session),
  });
  const remaining = deadline - now();
  if (remaining <= 0) return { reconciliation, worker: null, stoppedBy: 'runtime' };
  try {
    const worker = await drainOutbox(client, {
      timeBudgetMs: remaining,
      maxBatches,
      batchSize: OPS_LIMITS.indexBatchSize,
      fence: session,
      groupStepMs: STEP_MS.indexGroup,
    });
    return { reconciliation, worker: { ...worker, errors: worker.errors.slice(0, 10) }, stoppedBy: worker.drained ? null : 'limit' };
  } catch (error) {
    if (error?.leaseLost) error.partialStep = { reconciliation, worker: error.partialTotal ?? null, stoppedBy: 'lease' };
    throw error;
  }
}

export async function runEmbedStep(client, gateway, session, {
  version, activeVersion, candidates, maxChunks, maxUsd, deadline,
  monthSpentUsd = 0, monthCapUsd = OPS_LIMITS.maxEmbedUsdPerMonth,
  now = Date.now, prices = OPS_PRICES,
}) {
  if (!version || version !== activeVersion) {
    return { skipped: true, reason: `Konfigurierte Version ${version ?? '—'} ≠ aktive ${activeVersion ?? '—'}; kein Modellwechsel im Betriebsrunner.` };
  }
  const planned = candidates.slice(0, maxChunks);
  if (planned.length === 0) return { skipped: true, reason: 'Keine fehlenden oder veralteten Embeddings – kein Modellaufruf.', planned: 0, calls: 0 };
  const chars = planned.reduce((sum, row) => sum + String(row.text ?? '').length, 0);
  const estimate = estimateEmbeddingUsd(chars, prices);
  if (estimate.usd > maxUsd) {
    throw new OpsError(`Embedding-Schätzung ca. USD ${estimate.usd.toFixed(4)} über der Lauf-Stoppschwelle ${maxUsd} – kein Aufruf.`, 2);
  }
  if (monthSpentUsd + estimate.usd > monthCapUsd) {
    throw new OpsError(`Monats-Stoppschwelle Runner-Embeddings: erfasste Teilkosten ca. USD ${monthSpentUsd.toFixed(4)} + geschätzt ${estimate.usd.toFixed(4)} > USD ${monthCapUsd} – kein Aufruf.`, 2);
  }

  const result = { planned: planned.length, embedded: 0, changedMeanwhile: 0, calls: 0, estimate, stoppedBy: null };
  const spentUsd = () => ((gateway.usage?.embeddingTokens ?? 0) / 1_000_000) * prices.embeddingUsdPerMillion;
  try {
    for (let i = 0; i < planned.length; i += OPS_LIMITS.embedBatch) {
      if (now() >= deadline) { result.stoppedBy = 'runtime'; break; }
      if (spentUsd() > maxUsd || monthSpentUsd + spentUsd() > monthCapUsd) { result.stoppedBy = 'usd'; break; }
      // Kein neuer Modellaufruf ohne gültige Sperre für Aufruf + Speichern.
      await session.gate(STEP_MS.embedBatch);
      const batch = planned.slice(i, i + OPS_LIMITS.embedBatch);
      const vectors = await gateway.embed(batch.map((row) => row.text));
      result.calls += 1;
      if (!Array.isArray(vectors) || vectors.length !== batch.length) {
        throw new OpsError(`Embedding-Antwort unvollständig (${vectors?.length ?? 0}/${batch.length}).`);
      }
      // Nach der Rückkehr des Aufrufs VOR dem Speichern erneut prüfen:
      // Abbruch angefordert oder Sperre verloren → nichts speichern. Der
      // bereits gestartete Aufruf kann trotzdem Kosten verursacht haben; sie
      // bleiben in actualTokens/actualUsd sichtbar (finally).
      await session.gate(STEP_MS.dbRequest);
      // Nur speichern, wenn der Abschnitt seit dem Lesen unverändert ist –
      // sonst gehört der Vektor zu einem alten Text. Sperre in der Datenbank geprüft.
      const { data, error } = await client.rpc('ai_search_ops_fenced_store_embeddings', {
        ...session.fence(),
        p_model_version: version,
        p_rows: batch.map((row, j) => ({ id: row.id, content_hash: row.content_hash, embedding: vectors[j] })),
      });
      if (error) {
        if (isLeaseLostDbError(error)) throw leaseErrorFrom(error);
        throw new Error(`Embeddings speichern: ${error.message}`);
      }
      result.embedded += Number(data?.stored ?? 0);
      result.changedMeanwhile += Number(data?.changed ?? 0);
    }
  } finally {
    result.actualTokens = gateway.usage?.embeddingTokens ?? null;
    result.actualUsd = result.actualTokens === null ? null : (result.actualTokens / 1_000_000) * prices.embeddingUsdPerMillion;
  }
  return result;
}

export async function runCleanupStep(client, session, { batch }) {
  await session.gate(STEP_MS.dbRequest);
  const { data, error } = await client.rpc('ai_search_ops_fenced_cleanup', { ...session.fence(), p_batch: batch });
  if (error) {
    if (isLeaseLostDbError(error)) throw leaseErrorFrom(error);
    throw new Error(`Ergebnisbereinigung: ${error.message}`);
  }
  return { deleted: Number(data ?? 0), batch };
}

// ---------------------------------------------------------------------
// Laufsperre
// ---------------------------------------------------------------------

export async function acquireLease(client, { holder, modes, leaseSeconds, maxSeconds }) {
  const { data, error } = await client.rpc('ai_search_ops_lease_acquire', {
    p_holder: holder, p_modes: modes, p_lease_seconds: leaseSeconds, p_max_seconds: maxSeconds,
  });
  if (error) {
    if (isMissingFunction(error)) {
      throw new OpsError('Laufsperre fehlt (Migration 20261121225750_ai_search_ops_lease_v2 nicht angewendet) – schreibende Schritte gesperrt.', 2);
    }
    // Rechte-/Transportfehler NICHT als „nicht vorhanden“ werten.
    throw new OpsError(`Laufsperre nicht prüfbar: ${error.code ?? '-'} ${error.message}`, 1);
  }
  return data ?? null;
}

// ---------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------

function outcomeFor(failure) {
  if (!failure) return 'ok';
  if (failure.leaseLost) return ['aborted', 'abort_requested'].includes(failure.status) ? 'aborted' : 'lost';
  return 'failed';
}

/**
 * @param {object} client - Supabase-Client (Service-Rolle, TESTumgebung)
 * @param {{execute, anyExecute, limits, alarmExit?}} options - aus parseOpsArgs
 * @param {{embeddingVersion: string, createGateway?: Function,
 *          modelsEnabled?: boolean, holder: string, now?: () => number,
 *          clock?: () => Date, onSession?: Function, leaseSec?: number}} deps
 */
export async function runOps(client, options, deps) {
  const now = deps.now ?? Date.now;
  const clock = deps.clock ?? (() => new Date());
  const startedAt = now();
  const deadline = startedAt + options.limits.runtimeSec * 1000;
  const before = await collectStatus(client, { embeddingVersion: deps.embeddingVersion, now: clock() });

  const plan = {
    index: { execute: options.execute.index, wouldEnqueueMax: Math.min(before.coverage.missingInIndex + before.coverage.orphanedInIndex, options.limits.maxEnqueue), maxEnqueueTotal: options.limits.maxEnqueue, pendingJobs: before.jobs.pending, pendingCourses: before.jobs.pendingCourses, maxJobs: options.limits.indexBatches * OPS_LIMITS.indexBatchSize },
    embed: { execute: options.execute.embed, chunks: Math.min(before.embeddings.needEmbedding, options.limits.embedChunks), estimateUsd: before.estimate.embeddingUsd, monthSpentUsd: before.estimate.runnerEmbedUsdMonth, monthCapUsd: OPS_LIMITS.maxEmbedUsdPerMonth },
    cleanup: { execute: options.execute.cleanup, expired: before.results.expired, maxDelete: options.limits.cleanupBatch },
  };

  if (!options.anyExecute) {
    const alarmed = options.alarmExit && before.critical.length > 0;
    return { mode: 'dry-run', outcome: alarmed ? 'alarm' : 'ok', exitCode: alarmed ? 5 : 0, before, plan, steps: {} };
  }

  if (options.execute.embed) {
    if (!deps.modelsEnabled || typeof deps.createGateway !== 'function') {
      throw new OpsError('Embeddings gesperrt: Modellaufrufe nicht freigeschaltet (AI_SEARCH_MODELS_ENABLED/OPENAI_API_KEY).', 2);
    }
  }

  const modes = MODES.filter((mode) => options.execute[mode]);
  const leaseSec = deps.leaseSec ?? LEASE_DEFAULTS.leaseSec;
  const runId = await acquireLease(client, {
    holder: deps.holder,
    modes,
    leaseSeconds: leaseSec,
    maxSeconds: options.limits.runtimeSec + OPS_LIMITS.leaseGraceSec,
  });
  if (runId === null) {
    return { mode: 'execute', outcome: 'locked', exitCode: 3, before, plan, steps: {}, message: 'Ein anderer Betriebsdurchlauf ist aktiv – nichts ausgeführt.' };
  }
  const session = new LeaseSession(client, { runId, holder: deps.holder, leaseSec, now });
  deps.onSession?.(session);

  const steps = {};
  let failure = null;
  try {
    if (options.execute.index) {
      try {
        steps.index = await runIndexStep(client, session, { deadline, maxBatches: options.limits.indexBatches, maxEnqueue: options.limits.maxEnqueue, now });
      } catch (error) {
        if (error?.partialStep) steps.index = error.partialStep;
        throw error;
      }
      if ((steps.index.worker?.failures ?? 0) > 0) {
        throw new OpsError(`Index: ${steps.index.worker.failures} Kurs(e) fehlgeschlagen – weitere Schritte nicht ausgeführt.`);
      }
    }
    if (options.execute.embed) {
      if (now() >= deadline) steps.embed = { skipped: true, reason: 'Laufzeitgrenze erreicht' };
      else {
        const candidates = await fetchEmbeddingCandidates(client, deps.embeddingVersion);
        const gateway = candidates.length > 0 ? deps.createGateway() : { usage: { embeddingTokens: 0 }, embed: async () => { throw new Error('kein Aufruf vorgesehen'); } };
        steps.embed = await runEmbedStep(client, gateway, session, {
          version: deps.embeddingVersion,
          activeVersion: before.embeddings.activeVersion,
          candidates,
          maxChunks: options.limits.embedChunks,
          maxUsd: options.limits.maxUsd,
          monthSpentUsd: before.estimate.runnerEmbedUsdMonth ?? 0,
          deadline,
          now,
        }).catch((error) => {
          // Teilverbrauch auch im Fehlerfall protokollieren.
          steps.embed = { failed: true, actualTokens: gateway.usage?.embeddingTokens ?? null, actualUsd: ((gateway.usage?.embeddingTokens ?? 0) / 1_000_000) * OPS_PRICES.embeddingUsdPerMillion };
          throw error;
        });
      }
    }
    if (options.execute.cleanup) {
      if (now() >= deadline) steps.cleanup = { skipped: true, reason: 'Laufzeitgrenze erreicht' };
      else steps.cleanup = await runCleanupStep(client, session, { batch: options.limits.cleanupBatch });
    }
  } catch (error) {
    failure = error;
  }

  const outcome = outcomeFor(failure);
  const durationMs = now() - startedAt;
  const summary = {
    modes,
    durationMs,
    renewals: session.renewals,
    index: steps.index ? { enqueued: steps.index.reconciliation?.enqueued, enqueuedBy: steps.index.reconciliation?.enqueuedBy, jobs: steps.index.worker?.fetchedJobs, failures: steps.index.worker?.failures, stoppedBy: steps.index.stoppedBy } : undefined,
    embed: steps.embed ? { embedded: steps.embed.embedded, calls: steps.embed.calls, actualUsd: steps.embed.actualUsd ?? null } : undefined,
    cleanup: steps.cleanup ? { deleted: steps.cleanup.deleted } : undefined,
    leaseLost: failure?.leaseLost ? failure.status : undefined,
    error: failure ? String(failure.message ?? failure).slice(0, 300) : undefined,
  };
  const lease = await session.release(outcome, summary);

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
