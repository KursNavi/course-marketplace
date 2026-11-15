/**
 * Outbox-Worker der KI-Suche (S02): verarbeitet ai_search_jobs zu
 * ai_search_documents/ai_search_chunks.
 *
 * Architektur (docs/ai-search/indexdesign.md):
 *  - Jobs werden je Kurs KOALESZIERT: ein Lauf verarbeitet pro Kurs genau
 *    einmal den aktuellsten Stand (hoechste source_version im Batch) und
 *    schliesst alle aelteren Jobs desselben Kurses mit ab.
 *  - Die UEBERNAHME selbst (Versionspruefung + Dokument + Chunks bzw.
 *    Loeschung + Tombstone) laeuft ATOMAR in der Datenbank
 *    (ai_search_apply_upsert / ai_search_apply_delete, Migration
 *    20261115190000): kursbezogener Advisory-Lock serialisiert parallele
 *    Worker; ein aelterer Lauf kann weder einen neueren Stand ueberschreiben
 *    noch einen zurueckgezogenen Kurs wieder anlegen (Wasserstand in
 *    ai_search_index_state ueberlebt Loeschungen).
 *  - Idempotenz: unveraenderter content_hash bei vollstaendigem Bestand
 *    aktualisiert nur Version/Zeitstempel ('refreshed'); ein unvollstaendiger
 *    frueherer Stand wird repariert ('repaired') statt uebersprungen.
 *  - Fehler: attempts zaehlt hoch; ab maxAttempts wird der Job 'failed'
 *    (Fehlerwarteschlange fuer die Reconciliation), sonst bleibt er 'pending'
 *    und der naechste Cron-Lauf ist der Backoff.
 *  - Embeddings werden hier NICHT erzeugt (Gate E3 offen: Modellwahl/Budget);
 *    neue Chunks tragen embedding NULL und model_version NULL. Der
 *    Embedding-Backfill ist Stufe 2 und je Modellversion getrennt.
 *
 * Alle Funktionen nehmen den Supabase-Client als Parameter (Service-Rolle,
 * nur serverseitig) und sind damit ohne Netz testbar.
 */

import { buildProjection } from './projection.js';

export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_MAX_ATTEMPTS = 5;
const ERROR_TEXT_LIMIT = 500;

/**
 * Koalesziert eine Jobliste je Kurs: pro Kurs bleibt die hoechste
 * source_version (aktuellster Stand), die dringlichste Prioritaet und die
 * Liste aller Job-IDs. Rueckgabe sortiert nach Prioritaet, dann Job-Reihenfolge.
 */
export function coalesceJobs(jobs) {
  const byCourse = new Map();
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!job || job.course_id === null || job.course_id === undefined) continue;
    const key = String(job.course_id);
    const entry = byCourse.get(key);
    if (!entry) {
      byCourse.set(key, {
        courseId: job.course_id,
        sourceVersion: job.source_version ?? 0,
        priority: job.priority ?? 5,
        firstId: job.id,
        jobIds: [job.id],
        attempts: job.attempts ?? 0,
      });
    } else {
      entry.sourceVersion = Math.max(entry.sourceVersion, job.source_version ?? 0);
      entry.priority = Math.min(entry.priority, job.priority ?? 5);
      entry.firstId = Math.min(entry.firstId, job.id);
      entry.jobIds.push(job.id);
      entry.attempts = Math.max(entry.attempts, job.attempts ?? 0);
    }
  }
  return [...byCourse.values()].sort(
    (a, b) => (a.priority - b.priority) || (a.firstId - b.firstId),
  );
}

/**
 * Laedt die Quelldaten eines Kurses fuer die Projektion. Beim Profil werden
 * NUR die laut Datenvertrag §2 zulaessigen oeffentlichen Felder selektiert —
 * private Felder (E-Mail, Stripe, Pakete) erreichen den Worker-Prozess nicht.
 */
export async function loadCourseSource(client, courseId) {
  const { data: course, error } = await client
    .from('courses')
    .select('*, course_events(*), course_locations(*)')
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw new Error(`Kursquelle ${courseId}: ${error.message}`);
  if (!course) return { course: null, profile: null, categoryPaths: null };

  let profile = null;
  if (course.user_id) {
    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .select('slug, city, canton, verification_status, bio_text')
      .eq('id', course.user_id)
      .maybeSingle();
    if (profileError) throw new Error(`Profil zu Kurs ${courseId}: ${profileError.message}`);
    profile = profileRow ?? null;
  }

  const { data: categoryRows, error: categoryError } = await client
    .from('v_course_full_categories')
    .select('*')
    .eq('course_id', courseId);
  if (categoryError) throw new Error(`Kategorien zu Kurs ${courseId}: ${categoryError.message}`);

  return {
    course,
    profile,
    categoryPaths: Array.isArray(categoryRows) && categoryRows.length > 0 ? categoryRows : null,
  };
}

/**
 * Uebergibt die Projektion an die atomare Datenbankfunktion. Versionsschutz,
 * Tombstone-Pruefung, Vollstaendigkeitsreparatur und das konsistente
 * Schreiben von Dokument + Chunks liegen vollstaendig in SQL (eine
 * Transaktion, kursbezogener Advisory-Lock) — hier wird nur noch das
 * Ergebnis entgegengenommen.
 */
async function applyProjection(client, courseId, projection, sourceVersion) {
  if (projection.action === 'delete') {
    const { data, error } = await client.rpc('ai_search_apply_delete', {
      p_course_id: courseId,
      p_source_version: sourceVersion,
    });
    if (error) throw new Error(`Loeschung ${courseId}: ${error.message}`);
    return data;
  }
  const { data, error } = await client.rpc('ai_search_apply_upsert', {
    p_course_id: courseId,
    p_source_version: sourceVersion,
    p_document: projection.document,
    p_chunks: projection.chunks.map((chunk) => ({
      section: chunk.section,
      chunk_index: chunk.chunk_index,
      char_start: chunk.char_start,
      char_end: chunk.char_end,
      text: chunk.text,
    })),
  });
  if (error) throw new Error(`Uebernahme ${courseId}: ${error.message}`);
  return data;
}

/**
 * Verarbeitet einen Batch offener Outbox-Jobs. Rueckgabe ist eine Zusammen-
 * fassung fuer Logs/Monitoring; Fehler einzelner Kurse brechen den Batch
 * nicht ab, sondern zaehlen attempts hoch (ab maxAttempts: status 'failed').
 *
 * @param {object} client - Supabase-Client mit Service-Rolle
 * @param {{batchSize?: number, maxAttempts?: number, onlyCourseIds?: Array,
 *          allowLegacyNullStatus?: boolean, now?: () => Date}} [options]
 */
export async function processOutboxBatch(client, options = {}) {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = options.now ?? (() => new Date());

  let query = client
    .from('ai_search_jobs')
    .select('id, course_id, reason, priority, source_version, attempts')
    .eq('status', 'pending')
    .lt('attempts', maxAttempts)
    .order('priority', { ascending: true })
    .order('id', { ascending: true })
    .limit(batchSize);
  if (Array.isArray(options.onlyCourseIds) && options.onlyCourseIds.length > 0) {
    query = query.in('course_id', options.onlyCourseIds);
  }
  const { data: jobs, error: fetchError } = await query;
  if (fetchError) throw new Error(`Outbox lesen: ${fetchError.message}`);

  const groups = coalesceJobs(jobs);
  const summary = {
    fetchedJobs: jobs?.length ?? 0,
    courses: groups.length,
    inserted: 0,
    updated: 0,
    refreshed: 0,
    repaired: 0,
    deleted: 0,
    staleSkipped: 0,
    failures: 0,
    errors: [],
  };

  for (const group of groups) {
    try {
      const source = await loadCourseSource(client, group.courseId);
      const projection = buildProjection(
        source.course,
        { profile: source.profile, categoryPaths: source.categoryPaths },
        {
          sourceVersion: group.sourceVersion,
          allowLegacyNullStatus: options.allowLegacyNullStatus === true,
        },
      );

      const outcome = await applyProjection(client, group.courseId, projection, group.sourceVersion);

      if (outcome === 'inserted') summary.inserted += 1;
      else if (outcome === 'updated') summary.updated += 1;
      else if (outcome === 'refreshed') summary.refreshed += 1;
      else if (outcome === 'repaired') summary.repaired += 1;
      else if (outcome === 'deleted') summary.deleted += 1;
      else if (outcome === 'stale_skipped') summary.staleSkipped += 1;

      // Koaleszenz: ALLE offenen Jobs dieses Kurses bis zur verarbeiteten
      // Version abschliessen — auch solche, die nicht im Batch-Limit lagen.
      const { error: doneError } = await client
        .from('ai_search_jobs')
        .update({ status: 'done', processed_at: now().toISOString() })
        .eq('course_id', group.courseId)
        .lte('source_version', group.sourceVersion)
        .eq('status', 'pending');
      if (doneError) throw new Error(`Jobs abschliessen ${group.courseId}: ${doneError.message}`);
    } catch (err) {
      const message = String(err?.message ?? err).slice(0, ERROR_TEXT_LIMIT);
      summary.failures += 1;
      summary.errors.push({ courseId: group.courseId, message });
      const nextAttempts = group.attempts + 1;
      const { error: markError } = await client
        .from('ai_search_jobs')
        .update({
          attempts: nextAttempts,
          last_error: message,
          status: nextAttempts >= maxAttempts ? 'failed' : 'pending',
        })
        .in('id', group.jobIds);
      if (markError) {
        // Markierung fehlgeschlagen: nur protokollieren — der Job bleibt
        // 'pending' und wird im naechsten Lauf erneut versucht.
        summary.errors.push({ courseId: group.courseId, message: `Fehlermarkierung: ${markError.message}`.slice(0, ERROR_TEXT_LIMIT) });
      }
    }
  }

  return summary;
}

/**
 * Laesst Batches laufen, bis die Outbox leer ist oder das Zeitbudget
 * aufgebraucht ist (Vercel-Funktionslaufzeit). 'drained' sagt ehrlich, ob
 * am Ende noch Jobs offen waren.
 */
export async function drainOutbox(client, options = {}) {
  const timeBudgetMs = options.timeBudgetMs ?? 40_000;
  const startedAt = Date.now();
  const total = {
    batches: 0,
    fetchedJobs: 0,
    courses: 0,
    inserted: 0,
    updated: 0,
    refreshed: 0,
    repaired: 0,
    deleted: 0,
    staleSkipped: 0,
    failures: 0,
    errors: [],
    drained: false,
  };

  for (;;) {
    const batch = await processOutboxBatch(client, options);
    total.batches += 1;
    total.fetchedJobs += batch.fetchedJobs;
    total.courses += batch.courses;
    total.inserted += batch.inserted;
    total.updated += batch.updated;
    total.refreshed += batch.refreshed;
    total.repaired += batch.repaired;
    total.deleted += batch.deleted;
    total.staleSkipped += batch.staleSkipped;
    total.failures += batch.failures;
    total.errors.push(...batch.errors);

    if (batch.fetchedJobs === 0) {
      total.drained = true;
      break;
    }
    // Nur fehlgeschlagene Jobs uebrig? Dann nicht im selben Lauf endlos
    // wiederholen — attempts schuetzt zusaetzlich, aber der naechste Cron
    // ist der vorgesehene Backoff.
    if (batch.courses > 0 && batch.failures === batch.courses) break;
    if (Date.now() - startedAt >= timeBudgetMs) break;
  }

  return total;
}
