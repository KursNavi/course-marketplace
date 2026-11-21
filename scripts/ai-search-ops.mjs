/**
 * Betriebsrunner der KI-Suche – AUSSCHLIESSLICH TESTumgebung
 * (omoapbvfligjfznzivyu, strikter URL-Parser wie in den DB-Tests).
 *
 * STANDARD = LESENDER TROCKENLAUF:
 *   npm run ops:ai-test
 * zeigt Abdeckung, Aktualität, Fehler, offene Jobs, abgelaufene Ergebnisse,
 * fehlende/veraltete Embeddings und den geschätzten Verbrauch. Keine
 * Schreibzugriffe, keine Modellaufrufe, keine Laufsperre nötig.
 *
 * Schreibende Schritte – jeder mit eigenem Schalter, alle zusätzlich mit
 * AI_OPS_CONFIRM=omoapbvfligjfznzivyu und nur unter Laufsperre
 * (Entwurf 20261121160000_ai_search_ops_lease; fehlt sie → gesperrt):
 *   --execute-index    Abgleich + Outbox-Worker (ohne Kontingent-Cleanup)
 *   --execute-embed    fehlende/veraltete Embeddings (KOSTENPFLICHTIG);
 *                      zusätzlich --max-usd=<≤ 1>, AI_SEARCH_MODELS_ENABLED=1,
 *                      OPENAI_API_KEY
 *   --execute-cleanup  abgelaufene gespeicherte Ergebnisse löschen
 * Grenzen: --max-runtime-sec (≤ 900), --max-index-batches (≤ 40 à 50 Jobs),
 *   --max-enqueue (≤ 500), --max-embed-chunks (≤ 3000), --cleanup-batch (≤ 5000).
 *   --json gibt den vollständigen Bericht als JSON aus.
 *
 * Exit-Codes: 0 ok · 1 Fehler · 2 Vorbedingung/Schalter fehlt · 3 anderer
 * Lauf aktiv. Kein Mailversand, kein Cron-Endpunkt, kein Scheduler.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { checkTestTarget, EXPECTED_TEST_REF } from './ai-search-db-tests.mjs';
import { readModelConfig, createOpenAiGateway } from '../src/lib/aiSearch/openaiGateway.js';
import { parseOpsArgs, runOps, OpsError } from '../src/lib/aiSearch/ops.js';

const usd = (value) => (value === null || value === undefined ? '—' : `USD ${Number(value).toFixed(4)}`);

export function formatReport(report) {
  const lines = [];
  const b = report.before;
  lines.push(`Modus: ${report.mode === 'dry-run' ? 'TROCKENLAUF (lesend, keine Schreibzugriffe, keine Modellaufrufe)' : 'AUSFÜHRUNG'} – Ergebnis: ${report.outcome}`);
  lines.push(`Stand: ${b.checkedAt}`);
  lines.push('');
  lines.push('Abdeckung');
  lines.push(`  Veröffentlichte Kurse: ${b.coverage.published} · Indexdokumente: ${b.coverage.documents}`);
  lines.push(`  Fehlend im Index: ${b.coverage.missingInIndex} · Verwaist im Index: ${b.coverage.orphanedInIndex} · ohne Status: ${b.coverage.nullStatus}`);
  lines.push('Aktualität');
  lines.push(`  Letzte Indexierung: ${b.freshness.lastIndexedAt ?? '—'} · ältester offener Job: ${b.freshness.oldestPendingAt ?? '—'}${b.freshness.oldestPendingHours !== null ? ` (${b.freshness.oldestPendingHours} h)` : ''}`);
  lines.push('Jobs');
  lines.push(`  Offen: ${b.jobs.pending} (davon mit Fehlversuch: ${b.jobs.pendingRetrying}) · fehlgeschlagen: ${b.jobs.failed}`);
  for (const job of b.jobs.failedSample) lines.push(`    Job ${job.id} Kurs ${job.course_id} (${job.attempts}×): ${job.last_error}`);
  lines.push('Embeddings');
  lines.push(`  Aktiv: ${b.embeddings.activeVersion ?? '—'} · konfiguriert: ${b.embeddings.configuredVersion ?? '—'}`);
  lines.push(`  Abschnitte gesamt: ${b.embeddings.chunksTotal} · fehlend/veraltet: ${b.embeddings.needEmbedding} (${b.embeddings.needEmbeddingChars} Zeichen)`);
  lines.push('Gespeicherte Ergebnisse');
  lines.push(`  Gespeichert: ${b.results.stored} · abgelaufen (löschbar): ${b.results.expired}`);
  lines.push(`Verbrauch ${b.usage.monthKey} (Schätzung, ohne Gewähr)`);
  lines.push(`  Suchen abgeschlossen: ${b.usage.searchesCompleted} · abgebrochen: ${b.usage.searchesReleased} → höchstens ${usd(b.estimate.searchesUsdMax)}`);
  lines.push(`  Ausstehende Embeddings: ~${b.estimate.embeddingTokens} Tokens ≈ ${usd(b.estimate.embeddingUsd)}`);
  lines.push(`  Summe höchstens ${usd(b.estimate.monthTotalUsdMax)} von Budget USD ${b.estimate.monthlyBudgetUsd}`);
  lines.push(`Alarme: ${b.alarms.length ? '' : 'keine'}`);
  for (const alarm of b.alarms) lines.push(`  - ${alarm}`);
  lines.push('');
  lines.push('Plan (Grenzen dieses Laufs)');
  lines.push(`  Index:      ${report.plan.index.execute ? 'AUSFÜHREN' : 'nur anzeigen'} – bis ${report.plan.index.wouldEnqueueMax} Kurse einreihen, bis ${report.plan.index.maxJobs} Jobs verarbeiten (offen: ${report.plan.index.pendingJobs})`);
  lines.push(`  Embeddings: ${report.plan.embed.execute ? 'AUSFÜHREN' : 'nur anzeigen'} – bis ${report.plan.embed.chunks} Abschnitte (Schätzung gesamt ${usd(report.plan.embed.estimateUsd)})`);
  lines.push(`  Bereinigung: ${report.plan.cleanup.execute ? 'AUSFÜHREN' : 'nur anzeigen'} – ${report.plan.cleanup.expired} abgelaufen, höchstens ${report.plan.cleanup.maxDelete} je Lauf`);
  if (report.mode === 'execute') {
    lines.push('');
    lines.push(`Lauf ${report.runId ?? '—'} · Dauer ${report.durationMs ?? 0} ms · Sperre freigegeben: ${report.lease?.released ?? '—'}`);
    if (report.message) lines.push(report.message);
    if (report.error) lines.push(`FEHLER: ${report.error}`);
    lines.push(`Schritte: ${JSON.stringify(report.steps)}`);
  }
  return lines.join('\n');
}

async function main() {
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }

  const parsed = parseOpsArgs(process.argv.slice(2), process.env, EXPECTED_TEST_REF);
  if (!parsed.ok) {
    for (const message of parsed.errors) console.error(`Abbruch: ${message}`);
    process.exit(2);
  }

  const service = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, { auth: { persistSession: false } });
  const config = readModelConfig({ ...process.env, SUPABASE_URL: process.env.SUPABASE_URL_TEST, VITE_SUPABASE_URL: process.env.SUPABASE_URL_TEST });

  const report = await runOps(service, parsed.options, {
    embeddingVersion: config.embeddingVersion,
    modelsEnabled: config.enabled && Boolean(process.env.OPENAI_API_KEY),
    createGateway: () => createOpenAiGateway({ apiKey: process.env.OPENAI_API_KEY, embeddingModel: config.embeddingModel }),
    holder: randomUUID(),
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
