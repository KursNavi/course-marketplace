/**
 * Kontrollierter Abbau des Indexrückstands – AUSSCHLIESSLICH TESTumgebung
 * (omoapbvfligjfznzivyu, strikter URL-Parser der DB-Tests).
 *
 *   AI_OPS_CONFIRM=omoapbvfligjfznzivyu npm run ops:ai-index-backlog
 *
 * Nur Index: Jeder Zyklus ruft genau
 *   npm run ops:ai-test -- --execute-index --max-runtime-sec=180 --max-index-batches=2 --max-enqueue=50
 * auf (zusätzlich --json für die Auswertung; npm --silent nur für eine
 * saubere Ausgabe). Höchstens 10 serielle Zyklen und 1 000 gelesene Aufträge;
 * Halt-Regeln siehe src/lib/aiSearch/indexBacklog.js.
 *
 * Verweigert den Start, wenn ein Modellschlüssel oder die Modellfreigabe
 * gesetzt ist (keine Embedding-Aufrufe), und ohne AI_OPS_CONFIRM. Keine
 * Ergebnis- oder Kontingentbereinigung, kein Mailversand, kein Zeitplan.
 *
 * Am Ende ein lesender Nachweis: offene Aufträge vorher/nachher, betroffene
 * Kurs-IDs, Fehler, tatsächliche Änderungen, Indexabdeckung, Text-
 * vollständigkeit (Abschnittsvergleich aller indexierten Kurse) und
 * Embedding-Lücken.
 *
 * Exit: 0 planmässiges Ende (leer / Zyklen- / Auftragsgrenze) · 1 Fehler ·
 * 2 Vorbedingung · 3 anderer Lauf aktiv · 4 Sperrverlust/Abbruch ·
 * 6 kein Fortschritt · 130 Signal.
 */

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { checkTestTarget, EXPECTED_TEST_REF } from './ai-search-db-tests.mjs';
import { formatReport, timeoutFetch } from './ai-search-ops.mjs';
import { readModelConfig } from '../src/lib/aiSearch/openaiGateway.js';
import { collectStatus, fetchEmbeddingCandidates, STEP_MS } from '../src/lib/aiSearch/ops.js';
import { verifyChunkIntegrity } from '../src/lib/aiSearch/reconciliation.js';
import { runBacklog, INDEX_CYCLE_ARGS, BACKLOG_LIMITS } from '../src/lib/aiSearch/indexBacklog.js';

/** Startbedingungen: TEST-Ziel, Bestätigung, KEIN Modellschlüssel/keine Modellfreigabe. */
export function checkBacklogEnv(env) {
  const errors = [];
  const guard = checkTestTarget(env);
  if (!guard.ok) errors.push(guard.reason);
  if (env.AI_OPS_CONFIRM !== EXPECTED_TEST_REF) errors.push(`Bestätigung AI_OPS_CONFIRM=${EXPECTED_TEST_REF} fehlt.`);
  for (const name of ['OPENAI_API_KEY', 'AI_SEARCH_MODELS_ENABLED']) {
    if (env[name] !== undefined && env[name] !== '') errors.push(`${name} ist gesetzt – der Indexrückstandslauf läuft ohne Modellschlüssel und ohne Modellfreigabe.`);
  }
  return { ok: errors.length === 0, errors };
}

/** Umgebung für den Indexbefehl: nur die drei TEST-Werte + Bestätigung (+ PATH/HOME für npm). */
export function cycleEnv(env) {
  const keep = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'SystemRoot', 'TEMP', 'TMP', 'CI', 'npm_config_cache', 'AI_SEARCH_EMBEDDING_MODEL'];
  const out = {};
  for (const name of keep) if (env[name] !== undefined) out[name] = env[name];
  out.SUPABASE_URL_TEST = env.SUPABASE_URL_TEST;
  out.SUPABASE_SECRET_KEY_TEST = env.SUPABASE_SECRET_KEY_TEST;
  out.SUPABASE_PUBLISHABLE_KEY_TEST = env.SUPABASE_PUBLISHABLE_KEY_TEST;
  out.AI_OPS_CONFIRM = env.AI_OPS_CONFIRM;
  return out;
}

export const CYCLE_COMMAND = Object.freeze(['run', '--silent', 'ops:ai-test', '--', ...INDEX_CYCLE_ARGS, '--json']);

function runIndexCycle(env) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', CYCLE_COMMAND, {
      env: cycleEnv(env), stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    child.on('close', (code) => {
      let report = null;
      const begin = stdout.indexOf('{');
      if (begin >= 0) {
        try { report = JSON.parse(stdout.slice(begin)); } catch { report = null; }
      }
      resolve({ exitCode: code, report, stderr });
    });
    child.on('error', (error) => resolve({ exitCode: null, report: null, stderr: String(error?.message ?? error) }));
  });
}

async function fetchColumn(client, table, column, applyFilter) {
  const values = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client.from(table).select(column).order(column, { ascending: true }).range(offset, offset + 999);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table} lesen: ${error.message}`);
    for (const row of data ?? []) values.push(row[column]);
    if ((data ?? []).length < 1000) break;
  }
  return values;
}

const uniqSorted = (values) => [...new Set(values.map(String))].sort((a, b) => Number(a) - Number(b));

/** Lesender Nachweis am Ende (keine Schreibzugriffe, keine Modellaufrufe). */
async function collectEvidence(client, { sinceIso, embeddingVersion, pendingCoursesBefore }) {
  const status = await collectStatus(client, { embeddingVersion });
  const affected = uniqSorted(await fetchColumn(client, 'ai_search_jobs', 'course_id',
    (q) => q.eq('status', 'done').gte('processed_at', sinceIso)));
  const pendingCoursesAfter = uniqSorted(await fetchColumn(client, 'ai_search_jobs', 'course_id', (q) => q.eq('status', 'pending')));
  const docIds = uniqSorted(await fetchColumn(client, 'ai_search_documents', 'course_id'));
  const chunkCourseIds = new Set((await fetchColumn(client, 'ai_search_chunks', 'course_id')).map(String));
  const docSet = new Set(docIds);
  const pendingSet = new Set(pendingCoursesAfter);
  const docsWithoutChunks = docIds.filter((id) => !chunkCourseIds.has(id));
  // Textvollständigkeit: Position + Inhalt jedes erwarteten Abschnitts gegen
  // den gespeicherten Bestand – für ALLE indexierten Kurse.
  const integrity = await verifyChunkIntegrity(client, docIds, { maxDetails: 1000 });
  const integrityFailed = integrity.details.map((d) => String(d.courseId));
  const candidates = embeddingVersion ? await fetchEmbeddingCandidates(client, embeddingVersion) : [];
  const affectedSet = new Set(affected);
  return {
    status,
    affected: {
      count: affected.length,
      ids: affected,
      nowIndexed: affected.filter((id) => docSet.has(id)).length,
      notIndexed: affected.filter((id) => !docSet.has(id)),
    },
    pendingCoursesBefore: pendingCoursesBefore?.length ?? null,
    pendingCoursesAfter: pendingCoursesAfter.length,
    docsWithoutChunks,
    textIntegrity: {
      checked: integrity.checked,
      failed: integrity.failed,
      failedWithPendingJob: integrityFailed.filter((id) => pendingSet.has(id)),
      failedWithoutPendingJob: integrityFailed.filter((id) => !pendingSet.has(id)),
      affectedFailed: integrityFailed.filter((id) => affectedSet.has(id)),
    },
    embeddingGaps: {
      total: candidates.length,
      inAffectedCourses: candidates.filter((c) => affectedSet.has(String(c.course_id))).length,
    },
  };
}

function formatSummary({ result, evidence, startedAtIso }) {
  const s = result.start;
  const e = evidence?.status;
  const lines = ['', '=== Indexrückstand: Abschlussbericht (lesend erhoben) ==='];
  lines.push(`Beginn: ${startedAtIso} · Zyklen: ${result.cycles.length} · gelesene Aufträge: ${result.jobsRead} (Grenzen ${BACKLOG_LIMITS.maxCycles} Zyklen / ${BACKLOG_LIMITS.maxJobsTotal} Aufträge)`);
  lines.push(`Halt: ${result.stop.text}${result.stop.detail ? ` – ${result.stop.detail}` : ''}`);
  if (s) lines.push(`Offene Aufträge vorher: ${s.jobs.pending} für ${s.jobs.pendingCourses} Kurse · fehlgeschlagen: ${s.jobs.failed}`);
  if (e) lines.push(`Offene Aufträge nachher: ${e.jobs.pending} für ${e.jobs.pendingCourses} Kurse · fehlgeschlagen: ${e.jobs.failed} · ältester offen: ${e.freshness.oldestPendingAt ?? '—'}`);
  for (const c of result.cycles) {
    lines.push(`  Zyklus ${c.cycle}: Lauf ${c.runId ?? '—'} ${c.outcome ?? '—'} (Exit ${c.exitCode}), ${c.jobsRead} gelesen, offen ${c.pendingBefore} → ${c.pendingAfter}, ${c.worker ? `Kurse ${c.worker.courses}: eingefügt ${c.worker.inserted}, aktualisiert ${c.worker.updated}, aufgefrischt ${c.worker.refreshed}, repariert ${c.worker.repaired}, entfernt ${c.worker.deleted}, veraltet ${c.worker.staleSkipped}, Fehler ${c.worker.failures}` : 'keine Verarbeitung'}, eingereiht ${c.enqueued}${c.stop ? ` → Halt: ${c.stop}` : ''}${c.error ? ` – ${c.error}` : ''}`);
  }
  if (evidence) {
    lines.push(`Betroffene Kurse (Aufträge erledigt seit Beginn): ${evidence.affected.count} · davon jetzt im Index: ${evidence.affected.nowIndexed} · nicht (mehr) im Index: ${evidence.affected.notIndexed.length}`);
    lines.push(`  Kurs-IDs: ${evidence.affected.ids.join(', ') || '—'}`);
    if (evidence.affected.notIndexed.length) lines.push(`  Nicht im Index: ${evidence.affected.notIndexed.join(', ')}`);
    lines.push(`Indexabdeckung: veröffentlicht ${e.coverage.published} · im Index ${e.coverage.documents} · fehlend ${e.coverage.missingInIndex} · verwaist ${e.coverage.orphanedInIndex}`);
    lines.push(`Textvollständigkeit: ${evidence.textIntegrity.checked} Kurse geprüft, ${evidence.textIntegrity.failed} abweichend (mit offenem Auftrag: ${evidence.textIntegrity.failedWithPendingJob.length}, OHNE offenen Auftrag: ${evidence.textIntegrity.failedWithoutPendingJob.length}${evidence.textIntegrity.failedWithoutPendingJob.length ? ` – ${evidence.textIntegrity.failedWithoutPendingJob.join(', ')}` : ''}) · betroffene Kurse abweichend: ${evidence.textIntegrity.affectedFailed.length} · Dokumente ohne Abschnitte: ${evidence.docsWithoutChunks.length}`);
    lines.push(`Embedding-Lücken: ${evidence.embeddingGaps.total} Abschnitte ohne passendes Embedding (davon in betroffenen Kursen: ${evidence.embeddingGaps.inAffectedCourses}) – KEIN Modellaufruf in diesem Lauf`);
  }
  return lines.join('\n');
}

async function main() {
  const env = checkBacklogEnv(process.env);
  if (!env.ok) {
    for (const message of env.errors) console.error(`Abbruch: ${message}`);
    process.exit(2);
  }
  const client = createClient(process.env.SUPABASE_URL_TEST, process.env.SUPABASE_SECRET_KEY_TEST, {
    auth: { persistSession: false },
    global: { fetch: timeoutFetch(STEP_MS.dbRequest) },
  });
  // Nur die Embedding-Version (für den lesenden Lückenbericht); ohne Schlüssel
  // und ohne Freigabe ist die Modellkonfiguration ausdrücklich deaktiviert.
  const config = readModelConfig({ AI_SEARCH_EMBEDDING_MODEL: process.env.AI_SEARCH_EMBEDDING_MODEL });
  const embeddingVersion = config.embeddingVersion;

  let stopRequested = false;
  process.on('SIGINT', () => { stopRequested = true; });
  process.on('SIGTERM', () => { stopRequested = true; });

  const startedAtIso = new Date().toISOString();
  console.log(`Indexrückstand – nur TEST ${EXPECTED_TEST_REF}, nur Index. Befehl je Zyklus: npm ${CYCLE_COMMAND.join(' ')}`);
  const pendingCoursesBefore = uniqSorted(await fetchColumn(client, 'ai_search_jobs', 'course_id', (q) => q.eq('status', 'pending')));

  const result = await runBacklog({
    readStatus: () => collectStatus(client, { embeddingVersion }),
    runCycle: async (n) => {
      const cycle = await runIndexCycle(process.env);
      if (cycle.report) console.log(`\n--- Zyklus ${n} ---\n${formatReport(cycle.report)}`);
      return cycle;
    },
    shouldStop: () => stopRequested,
    log: (text) => console.log(text),
  });

  let evidence = null;
  try {
    evidence = await collectEvidence(client, { sinceIso: startedAtIso, embeddingVersion, pendingCoursesBefore });
  } catch (error) {
    console.error(`Nachweis nicht vollständig lesbar: ${error?.message ?? error}`);
  }
  console.log(formatSummary({ result, evidence, startedAtIso }));
  console.log(`\nJSON: ${JSON.stringify({ startedAtIso, stop: result.stop, jobsRead: result.jobsRead, cycles: result.cycles, start: result.start ? { jobs: result.start.jobs, coverage: result.start.coverage, embeddings: result.start.embeddings } : null, evidence: evidence ? { ...evidence, status: { jobs: evidence.status.jobs, coverage: evidence.status.coverage, embeddings: evidence.status.embeddings, freshness: evidence.status.freshness } } : null })}`);
  process.exit(evidence ? result.stop.exit : (result.stop.exit || 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Abbruch: ${error?.message ?? error}`);
    process.exit(1);
  });
}
