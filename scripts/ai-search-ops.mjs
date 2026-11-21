/**
 * Betriebsrunner der KI-Suche – AUSSCHLIESSLICH TESTumgebung
 * (omoapbvfligjfznzivyu, strikter URL-Parser wie in den DB-Tests).
 *
 * STANDARD = LESENDER TROCKENLAUF:
 *   npm run ops:ai-test
 * zeigt Aktualität, Abdeckung, offene/fehlgeschlagene Aufträge,
 * Embedding-Lücken, Löschrückstand, Laufprotokoll und eine BEGRENZTE
 * Kostenschätzung. Keine Schreibzugriffe, keine Modellaufrufe, keine Sperre.
 *
 * Schreibende Schritte – jeder mit eigenem Schalter, alle zusätzlich mit
 * AI_OPS_CONFIRM=omoapbvfligjfznzivyu und nur unter Laufsperre v2
 * (Entwurf 20261122090000_ai_search_ops_lease_v2; fehlt sie → gesperrt):
 *   --execute-index    Abgleich + Outbox-Worker (ohne Kontingent-Cleanup)
 *   --execute-embed    fehlende/veraltete Embeddings (KOSTENPFLICHTIG);
 *                      zusätzlich --max-usd=<≤ 1>, AI_SEARCH_MODELS_ENABLED=1,
 *                      OPENAI_API_KEY; Monats-Stoppschwelle für erfasste
 *                      Runner-Embedding-Teilkosten USD 2 (Schätzung, keine
 *                      garantierte Kostengrenze)
 *   --execute-cleanup  abgelaufene gespeicherte Ergebnisse physisch löschen
 * Grenzen: --max-runtime-sec (≤ 900), --max-index-batches (≤ 40 à 50 Jobs),
 *   --max-enqueue (≤ 500), --max-embed-chunks (≤ 3000), --cleanup-batch (≤ 5000).
 *   --json gibt den vollständigen Bericht als JSON aus.
 *   --alarm-exit: Trockenlauf endet mit Exit 5, wenn kritische Alarme
 *   bestehen (Überwachung im Zeitplan).
 *
 * Jede Datenbankanfrage hat ein Zeitlimit (30 s); SIGINT/SIGTERM beenden
 * den Lauf vor dem nächsten Schritt und protokollieren ihn als 'aborted'.
 *
 * Exit-Codes: 0 ok · 1 Fehler · 2 Vorbedingung/Schalter fehlt · 3 anderer
 * Lauf aktiv · 4 Sperre verloren/abgebrochen · 5 kritischer Alarm
 * (nur mit --alarm-exit). Kein Mailversand, kein Cron-Endpunkt.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { checkTestTarget, EXPECTED_TEST_REF } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { parseOpsArgs, runOps, OpsError, OPS_LIMITS, STEP_MS } from '../src/lib/aiSearch/ops.js';

const usd = (value) => (value === null || value === undefined ? '—' : `USD ${Number(value).toFixed(4)}`);
const when = (iso) => (iso ? String(iso).replace('T', ' ').replace(/\.\d+/, '').replace(/\+00:00$|Z$/, ' UTC') : '—');

export function formatReport(report) {
  const lines = [];
  const b = report.before;
  const ops = b.ops ?? { applied: false };
  lines.push(`Modus: ${report.mode === 'dry-run' ? 'TROCKENLAUF (lesend, keine Schreibzugriffe, keine Modellaufrufe)' : 'AUSFÜHRUNG'} – Ergebnis: ${report.outcome}`);
  lines.push(`Stand: ${when(b.checkedAt)}`);
  lines.push('');
  lines.push(`Kritische Alarme: ${b.critical.length ? '' : 'keine'}`);
  for (const alarm of b.critical) lines.push(`  ! ${alarm}`);
  const notes = b.alarms.filter((a) => !b.critical.includes(a));
  if (notes.length) {
    lines.push('Hinweise:');
    for (const note of notes) lines.push(`  - ${note}`);
  }
  lines.push('');
  lines.push('1. Aktualität');
  lines.push(`  Letzte Indexierung: ${when(b.freshness.lastIndexedAt)}`);
  lines.push(`  Ältester offener Auftrag: ${when(b.freshness.oldestPendingAt)}${b.freshness.oldestPendingHours !== null ? ` (${b.freshness.oldestPendingHours} h)` : ''}`);
  if (ops.applied) {
    lines.push(`  Letzter erfolgreicher Lauf – Index: ${when(ops.lastOk.index)} · Embeddings: ${when(ops.lastOk.embed)} · Bereinigung: ${when(ops.lastOk.cleanup)} · zeitgesteuerte Löschung: ${when(ops.lastOk['cleanup-scheduled'])}`);
  }
  lines.push('2. Abdeckung');
  lines.push(`  Veröffentlichte Kurse: ${b.coverage.published} · im Index: ${b.coverage.documents} · fehlend: ${b.coverage.missingInIndex} · verwaist: ${b.coverage.orphanedInIndex} · ohne Status: ${b.coverage.nullStatus}`);
  lines.push('3. Aufträge (Änderungen, die noch in den Index müssen)');
  lines.push(`  Offen: ${b.jobs.pending} Aufträge für ${b.jobs.pendingCourses} verschiedene Kurse (mit Fehlversuch: ${b.jobs.pendingRetrying}) · fehlgeschlagen: ${b.jobs.failed}`);
  for (const job of b.jobs.failedSample) lines.push(`    Auftrag ${job.id}, Kurs ${job.course_id} (${job.attempts}×): ${job.last_error}`);
  lines.push('4. Embeddings');
  lines.push(`  Aktive Version: ${b.embeddings.activeVersion ?? '—'} · konfiguriert: ${b.embeddings.configuredVersion ?? '—'}`);
  lines.push(`  Abschnitte: ${b.embeddings.chunksTotal} · ohne passendes Embedding: ${b.embeddings.needEmbedding} (${b.embeddings.needEmbeddingChars} Zeichen)`);
  lines.push('5. Gespeicherte Ergebnisse und Löschung');
  lines.push(`  Gespeichert: ${b.results.stored} · abgelaufen, noch nicht gelöscht: ${b.results.expired}${b.results.backlogHours !== null ? ` (ältestes seit ${b.results.backlogHours} h abgelaufen)` : ''}`);
  if (ops.applied) {
    lines.push(`  Letzte zeitgesteuerte Löschung: ${ops.lastCleanupTick ? `${when(ops.lastCleanupTick.at)}, ${ops.lastCleanupTick.deleted} gelöscht, danach ${ops.lastCleanupTick.expiredLeft} offen` : 'noch keine (Zeitplan nicht eingeschaltet)'}`);
  }
  lines.push('6. Betriebsläufe');
  if (!ops.applied) {
    lines.push('  Laufsperre v2 nicht angewendet – kein Laufprotokoll, schreibende Schritte gesperrt.');
  } else {
    lines.push(`  Aktiv: ${ops.active.length ? ops.active.map((r) => `Lauf ${r.id} (${r.modes.join('+')}, Frist bis ${when(r.leaseUntil)}, ${r.renewals}× verlängert${r.abortRequested ? ', Abbruch angefordert' : ''})`).join('; ') : 'keiner'}`);
    if (ops.stale.length) lines.push(`  Abgelaufen, nicht abgeschlossen: ${ops.stale.map((r) => `Lauf ${r.id}`).join(', ')}`);
    lines.push(`  Nicht erfolgreich (7 Tage): ${ops.problemCount}`);
    for (const run of ops.problemRuns) lines.push(`    Lauf ${run.id} ${when(run.startedAt)} ${run.modes.join('+')}: ${run.outcome}${run.error ? ` – ${run.error}` : ''}`);
    for (const run of ops.recent) lines.push(`  Zuletzt: Lauf ${run.id} ${when(run.startedAt)} ${run.modes.join('+')} → ${run.outcome ?? '—'}`);
  }
  lines.push(`7. Kosten ${b.usage.monthKey} – BEGRENZTE SCHÄTZUNG`);
  lines.push(`  ${b.estimate.note}`);
  lines.push(`  Suchen abgeschlossen: ${b.usage.searchesCompleted} · abgebrochen: ${b.usage.searchesReleased} → geschätzt ${usd(b.estimate.searchesUsdEstimate)}`);
  lines.push(`  Ausstehende Embeddings: ~${b.estimate.embeddingTokens} Tokens ≈ ${usd(b.estimate.embeddingUsd)}`);
  lines.push(`  Teilsumme dieser zwei Posten ≈ ${usd(b.estimate.partialTotalUsd)} (Budgetrahmen USD ${b.estimate.monthlyBudgetUsd})`);
  if (b.estimate.runnerEmbedUsdMonth !== null && b.estimate.runnerEmbedUsdMonth !== undefined) {
    lines.push(`  Erfasste Teilkosten, nur Runner-Embeddings diesen Monat (Tokens laut Anbieter × Preisannahme): ca. ${usd(b.estimate.runnerEmbedUsdMonth)} – Stoppschwelle USD ${OPS_LIMITS.maxEmbedUsdPerMonth}, keine garantierte Grenze`);
  }
  lines.push(`  Nicht enthalten: ${b.estimate.excludes.join('; ')}`);
  lines.push('');
  lines.push('Plan (Grenzen dieses Laufs)');
  lines.push(`  Index:      ${report.plan.index.execute ? 'AUSFÜHREN' : 'nur anzeigen'} – ${report.plan.index.wouldEnqueueMax} fehlende/verwaiste Kurse einreihen (alle Einreihungen inkl. Hash-Abweichungen zusammen höchstens ${report.plan.index.maxEnqueueTotal}), bis ${report.plan.index.maxJobs} Jobs verarbeiten (offen: ${report.plan.index.pendingJobs})`);
  lines.push(`  Embeddings: ${report.plan.embed.execute ? 'AUSFÜHREN' : 'nur anzeigen'} – bis ${report.plan.embed.chunks} Abschnitte (geschätzt für alle fehlenden ${usd(report.plan.embed.estimateUsd)})`);
  lines.push(`  Bereinigung: ${report.plan.cleanup.execute ? 'AUSFÜHREN' : 'nur anzeigen'} – ${report.plan.cleanup.expired} abgelaufen, höchstens ${report.plan.cleanup.maxDelete} je Lauf`);
  if (report.mode === 'execute') {
    lines.push('');
    lines.push(`Lauf ${report.runId ?? '—'} · Dauer ${report.durationMs ?? 0} ms · Abschluss in der Datenbank: ${report.lease?.status ?? '—'}`);
    if (report.message) lines.push(report.message);
    if (report.error) lines.push(`FEHLER: ${report.error}`);
    lines.push(`Schritte: ${JSON.stringify(report.steps)}`);
  }
  return lines.join('\n');
}

/** fetch mit festem Zeitlimit je Anfrage (begrenzt jeden Schritt). */
export function timeoutFetch(timeoutMs, baseFetch = globalThis.fetch) {
  return (input, init = {}) => {
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    return baseFetch(input, { ...init, signal });
  };
}

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }

  const parsed = parseOpsArgs(process.argv.slice(2), process.env, EXPECTED_TEST_REF);
  if (!parsed.ok) {
    for (const message of parsed.errors) console.error(`Abbruch: ${message}`);
    process.exit(2);
  }

  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, {
    auth: { persistSession: false },
    global: { fetch: timeoutFetch(STEP_MS.dbRequest) },
  });
  const config = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });

  let session = null;
  const stop = (signal) => {
    if (session) session.requestStop(signal);
    else process.exit(130);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  const report = await runOps(service, parsed.options, {
    embeddingVersion: config.embeddingVersion,
    modelsEnabled: config.enabled && Boolean(process.env.OPENAI_API_KEY),
    createGateway: () => createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: config.embeddingModel }),
    holder: randomUUID(),
    onSession: (value) => { session = value; },
  });

  console.log(parsed.options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Abbruch: ${error?.message ?? error}`);
    process.exit(error instanceof OpsError ? error.exitCode : 1);
  });
}
