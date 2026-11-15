/**
 * Taegliche Reconciliation der KI-Suche (S02): Soll-Ist-Abgleich Quelle↔Index.
 *
 * Aufgaben (docs/ai-search/indexdesign.md Punkt 8, Datenvertrag §1/§6):
 *  - Count-Vergleich veroeffentlichte Kurse ↔ ai_search_documents.
 *  - Anti-Join beider Richtungen; fehlende/verwaiste Kurse werden als
 *    'reconciliation'-Jobs eingereiht (der Worker raeumt auf). Auf leerem
 *    Index IST das der Stufe-1-Backfill: alle veroeffentlichten Kurse werden
 *    eingereiht und vom Worker projiziert (Lexikalik sofort nutzbar;
 *    Embeddings folgen als Stufe 2 nach Gate E3).
 *  - Separate Zaehlung von courses.status IS NULL (muss 0 sein, sonst Alarm
 *    und bewusste Entscheidung laut Datenvertrag §1 — kein stiller Default).
 *  - Hash-Stichprobe: zufaellige Dokumente werden gegen die frisch gebaute
 *    Projektion verglichen; Abweichung wird eingereiht und alarmiert.
 *  - Cleanup verwaister Kontingent-Reservierungen (ai_search_quota_cleanup)
 *    laeuft im selben Cron.
 *
 * Alle Funktionen nehmen den Supabase-Client als Parameter (Service-Rolle,
 * nur serverseitig) und sind damit ohne Netz testbar.
 */

import { buildProjection } from './projection.js';
import { loadCourseSource } from './worker.js';

const PAGE_SIZE = 1000;
export const DEFAULT_SAMPLE_SIZE = 20;
export const DEFAULT_MAX_ENQUEUE = 500;

/** Beidseitiger Anti-Join auf ID-Ebene (reine Funktion, lokal testbar). */
export function diffCoverage(publishedIds, documentIds) {
  const published = new Set((publishedIds ?? []).map(String));
  const documents = new Set((documentIds ?? []).map(String));
  return {
    missingInIndex: [...published].filter((id) => !documents.has(id)),
    orphanedInIndex: [...documents].filter((id) => !published.has(id)),
  };
}

/** Deterministische Stichprobenwahl bei injizierbarem Zufall (Tests). */
export function pickSample(ids, sampleSize, random = Math.random) {
  const pool = [...(ids ?? [])];
  const size = Math.min(sampleSize, pool.length);
  const sample = [];
  for (let i = 0; i < size; i += 1) {
    const index = Math.floor(random() * pool.length);
    sample.push(pool.splice(index, 1)[0]);
  }
  return sample;
}

/** Holt eine ID-Spalte vollstaendig (seitenweise; PostgREST-Limit 1000). */
async function fetchAllIds(client, table, column, applyFilter) {
  const ids = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select(column).order(column, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table} lesen: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) ids.push(row[column]);
    if (rows.length < PAGE_SIZE) break;
  }
  return ids;
}

async function countRows(client, table, applyFilter) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (applyFilter) query = applyFilter(query);
  const { count, error } = await query;
  if (error) throw new Error(`${table} zaehlen: ${error.message}`);
  return count ?? 0;
}

async function enqueueReconciliationJobs(client, courseIds, priority) {
  if (courseIds.length === 0) return 0;
  // Bereits offene Jobs nicht doppelt einreihen (Outbox bleibt begrenzt):
  const { data: pendingRows, error: pendingError } = await client
    .from('ai_search_jobs')
    .select('course_id')
    .in('course_id', courseIds)
    .eq('status', 'pending');
  if (pendingError) throw new Error(`Offene Jobs lesen: ${pendingError.message}`);
  const alreadyQueued = new Set((pendingRows ?? []).map((row) => String(row.course_id)));
  const toEnqueue = courseIds.filter((id) => !alreadyQueued.has(String(id)));
  if (toEnqueue.length === 0) return 0;
  const { error: insertError } = await client
    .from('ai_search_jobs')
    .insert(toEnqueue.map((courseId) => ({ course_id: courseId, reason: 'reconciliation', priority })));
  if (insertError) throw new Error(`Jobs einreihen: ${insertError.message}`);
  return toEnqueue.length;
}

/**
 * Fuehrt den vollstaendigen Abgleich aus und liefert einen Bericht mit
 * expliziten Alarmen. Schreibzugriffe: ausschliesslich neue ai_search_jobs
 * sowie der Kontingent-Cleanup; Quelltabellen werden nie veraendert.
 */
export async function runReconciliation(client, options = {}) {
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const maxEnqueue = options.maxEnqueue ?? DEFAULT_MAX_ENQUEUE;
  const random = options.random ?? Math.random;
  const alarms = [];

  const publishedIds = await fetchAllIds(client, 'courses', 'id',
    (query) => query.eq('status', 'published'));
  const nullStatusCount = await countRows(client, 'courses',
    (query) => query.is('status', null));
  const documentIds = await fetchAllIds(client, 'ai_search_documents', 'course_id');

  const { missingInIndex, orphanedInIndex } = diffCoverage(publishedIds, documentIds);

  if (nullStatusCount > 0) {
    alarms.push(`courses.status IS NULL: ${nullStatusCount} Zeile(n) — Entscheidung laut Datenvertrag §1 noetig.`);
  }

  // Ruecknahme-Vorrang: Verwaiste zuerst und mit hoher Prioritaet einreihen.
  const cappedOrphaned = orphanedInIndex.slice(0, maxEnqueue);
  const remainingBudget = Math.max(maxEnqueue - cappedOrphaned.length, 0);
  const cappedMissing = missingInIndex.slice(0, remainingBudget);
  const truncated = orphanedInIndex.length > cappedOrphaned.length
    || missingInIndex.length > cappedMissing.length;
  if (truncated) {
    alarms.push(`Einreihung gekappt bei ${maxEnqueue} Jobs; Rest folgt im naechsten Lauf.`);
  }

  const enqueuedOrphaned = await enqueueReconciliationJobs(client, cappedOrphaned, 1);
  const enqueuedMissing = await enqueueReconciliationJobs(client, cappedMissing, 5);

  // Hash-Stichprobe nur ueber Kurse, die in Quelle UND Index vorhanden sind.
  const publishedSet = new Set(publishedIds.map(String));
  const comparable = documentIds.filter((id) => publishedSet.has(String(id)));
  const sampleIds = pickSample(comparable, sampleSize, random);
  let hashMismatches = 0;
  const mismatchedCourseIds = [];
  for (const courseId of sampleIds) {
    const { data: doc, error: docError } = await client
      .from('ai_search_documents')
      .select('content_hash')
      .eq('course_id', courseId)
      .maybeSingle();
    if (docError) throw new Error(`Stichprobe Dokument ${courseId}: ${docError.message}`);
    if (!doc) continue; // zwischenzeitlich entfernt — Anti-Join des naechsten Laufs greift
    const source = await loadCourseSource(client, courseId);
    const projection = buildProjection(
      source.course,
      { profile: source.profile, categoryPaths: source.categoryPaths },
      { sourceVersion: 0 },
    );
    const expectedHash = projection.action === 'upsert' ? projection.document.content_hash : null;
    if (expectedHash !== doc.content_hash) {
      hashMismatches += 1;
      mismatchedCourseIds.push(courseId);
    }
  }
  if (mismatchedCourseIds.length > 0) {
    alarms.push(`Hash-Stichprobe: ${mismatchedCourseIds.length} Abweichung(en) — Jobs eingereiht.`);
    await enqueueReconciliationJobs(client, mismatchedCourseIds, 3);
  }

  const pendingJobs = await countRows(client, 'ai_search_jobs',
    (query) => query.eq('status', 'pending'));
  const failedJobs = await countRows(client, 'ai_search_jobs',
    (query) => query.eq('status', 'failed'));
  if (failedJobs > 0) {
    alarms.push(`${failedJobs} Job(s) im Status 'failed' (Fehlerwarteschlange pruefen).`);
  }

  // Verwaiste Kontingent-Reservierungen freigeben (Crash-Recovery, Nachtrag 07).
  // skipQuotaCleanup: true fuer begrenzte Test-/Backfill-Laeufe — der Cleanup
  // wirkt GLOBAL auf alle abgelaufenen Reservierungen und darf dort nicht
  // mitlaufen (gleiches Prinzip wie AI_DB_TESTS_ALLOW_GLOBAL_CLEANUP).
  let releasedReservations = 0;
  if (options.skipQuotaCleanup === true) {
    releasedReservations = null;
  } else {
    const { data: cleanupResult, error: cleanupError } = await client.rpc('ai_search_quota_cleanup');
    if (cleanupError) {
      alarms.push(`Kontingent-Cleanup fehlgeschlagen: ${cleanupError.message}`);
    } else {
      releasedReservations = cleanupResult ?? 0;
    }
  }

  return {
    publishedCount: publishedIds.length,
    documentCount: documentIds.length,
    nullStatusCount,
    missingInIndex: missingInIndex.length,
    orphanedInIndex: orphanedInIndex.length,
    enqueued: enqueuedOrphaned + enqueuedMissing,
    truncated,
    hashSample: { checked: sampleIds.length, mismatches: hashMismatches },
    pendingJobs,
    failedJobs,
    releasedReservations,
    alarms,
  };
}
