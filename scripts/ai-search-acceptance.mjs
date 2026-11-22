/**
 * Abnahmebestand der KI-Suche (Paket 2) — AUSSCHLIESSLICH TESTumgebung.
 *
 *   node scripts/ai-search-acceptance.mjs plan              (Standard, nur Lesen)
 *   node scripts/ai-search-acceptance.mjs status            (nur Lesen, TEST)
 *   node scripts/ai-search-acceptance.mjs switch  --execute (S3–S6)
 *   node scripts/ai-search-acceptance.mjs restore --execute (S11, Rückweg)
 *   node scripts/ai-search-acceptance.mjs purge   --execute (Sicherung/Ergebnisse löschen)
 *
 * WICHTIG: Der Austausch ist NICHT isoliert. Er entfernt den bisherigen
 * Testindex (alle Dokumente, Abschnitte und Embeddings der bisher
 * veröffentlichten Testkurse), weil diese Kurse umkehrbar auf Entwurf gesetzt
 * werden. Vorher wird eine Sicherung im privaten Storage-Bucket des
 * TEST-Projekts abgelegt (Status, Prüfsummen, Abschnittsschlüssel, Embeddings;
 * keine Kurstexte); `restore` stellt daraus den bisherigen Zustand ohne
 * Modellaufruf wieder her.
 *
 * Schutz:
 *  - TEST-Ziel strikt geprüft (checkTestTarget); Schreiben nur mit --execute
 *    UND AI_ACCEPTANCE_CONFIRM=omoapbvfligjfznzivyu.
 *  - Produktion wird nur mit dem ÖFFENTLICHEN Schlüssel gelesen
 *    (SUPABASE_URL_PROD_PUBLIC, SUPABASE_PUBLISHABLE_KEY_PROD); ein
 *    Dienstschlüssel wird abgelehnt. Feste Positivliste, Status published.
 *  - Keine Modellaufrufe. Keine Kurstexte, Titel oder Namen im Log
 *    (das Repository ist öffentlich): nur Zählungen, IDs und Prüfsummen.
 *  - Jeder Schritt hat einen Prüfpunkt; bei Abweichung STOPP mit Exit 1.
 */

import { createClient } from '@supabase/supabase-js';
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { checkTestTarget, checkTargetUrl, EXPECTED_TEST_REF } from './ai-search-db-tests.mjs';
import { drainOutbox, loadCourseSource } from '../src/lib/aiSearch/worker.js';
import { runReconciliation, verifyChunkIntegrity } from '../src/lib/aiSearch/reconciliation.js';
import { buildProjection } from '../src/lib/aiSearch/projection.js';
import { buildCourseChunks } from '../src/lib/aiSearch/chunking.js';
import { estimateEmbeddingUsd } from '../src/lib/aiSearch/ops.js';
import {
  PRODUCTION_REF, ACCEPTANCE_RANGE, EXPORT_FIELDS, TAXONOMY_TABLES, PROVIDER_NAME_PREFIX,
  PROVIDER_SLUG_PREFIX, BACKUP_BUCKET, BACKUP_PATH, IMPORT_LOG_PATH,
  classifySupabaseKey, validateSnapshot, buildImportRows, diffTaxonomy, buildBackup, sealBackup,
  verifyBackup, compareIndexToBackup, planEmbeddingRestore, importFingerprint, inAcceptanceRange,
} from '../src/lib/aiSearch/acceptanceCatalog.js';

export const COMMANDS = Object.freeze(['plan', 'status', 'switch', 'restore', 'purge']);
const WRITE_COMMANDS = new Set(['switch', 'restore', 'purge']);
const PAGE = 1000;

export function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = argv.filter((a) => a.startsWith('--'));
  const command = positional[0] ?? 'plan';
  const unknown = flags.filter((f) => f !== '--execute');
  const errors = [];
  if (!COMMANDS.includes(command)) errors.push(`unbekannter Befehl "${command}" (erlaubt: ${COMMANDS.join(', ')})`);
  if (positional.length > 1) errors.push(`zu viele Argumente: ${positional.slice(1).join(' ')}`);
  if (unknown.length) errors.push(`unbekannte Optionen: ${unknown.join(' ')}`);
  const execute = flags.includes('--execute');
  if (execute && !WRITE_COMMANDS.has(command)) errors.push(`--execute gilt nur für ${[...WRITE_COMMANDS].join(', ')}`);
  return { command, execute, errors };
}

/** Lesequelle Produktion: nur öffentliche Adresse + öffentlicher Schlüssel. */
export function checkProdSource(env) {
  const target = checkTargetUrl(env?.SUPABASE_URL_PROD_PUBLIC, PRODUCTION_REF);
  if (!target.ok) return { ok: false, reason: `SUPABASE_URL_PROD_PUBLIC: ${target.reason}` };
  const kind = classifySupabaseKey(env?.SUPABASE_PUBLISHABLE_KEY_PROD);
  if (kind !== 'publishable') {
    return { ok: false, reason: `SUPABASE_PUBLISHABLE_KEY_PROD: nur ein öffentlicher Schlüssel ist erlaubt (erkannt: ${kind})` };
  }
  return { ok: true, reason: null };
}

/** Schreibfreigabe: --execute UND ausdrückliche Bestätigung. */
export function checkWriteConfirm(env, execute) {
  if (!execute) return { ok: false, reason: 'TROCKENLAUF (ohne --execute)' };
  if (env?.AI_ACCEPTANCE_CONFIRM !== EXPECTED_TEST_REF) return { ok: false, reason: `AI_ACCEPTANCE_CONFIRM=${EXPECTED_TEST_REF} fehlt` };
  return { ok: true, reason: null };
}

/**
 * Vorbedingungen für den Austausch (S3–S6). Reine Funktion über den gelesenen
 * Zustand, damit die Abbruchbedingungen getestet sind.
 */
export function switchPreconditions({ state, validation, taxonomy, backupState = 'none', indexCheck }) {
  const problems = [];
  // Der Rückweg wird streng gegen die Sicherung geprüft (gleiche Prüfsummen,
  // gleiche Abschnitte). Das geht nur, wenn der heutige Index dem heutigen
  // Code entspricht — sonst wäre eine Abweichung nach dem Rückweg nicht
  // von einem Fehler zu unterscheiden.
  if (indexCheck && (indexCheck.hashMismatch > 0 || indexCheck.chunkFailures > 0)) {
    problems.push(`bisheriger Index entspricht nicht dem aktuellen Code (${indexCheck.hashMismatch} Prüfsummen, ${indexCheck.chunkFailures} Abschnittslisten abweichend) — erst Indexrückstand abarbeiten`);
  }
  if (!validation.ok) problems.push(`Katalogstand ungültig: ${validation.errors.slice(0, 3).join('; ')}`);
  if (state.coursesInRange > 0) problems.push(`${state.coursesInRange} Kurse liegen bereits im Abnahmebereich ${ACCEPTANCE_RANGE.min}–${ACCEPTANCE_RANGE.max}`);
  if (state.markedProfiles > 0) problems.push(`${state.markedProfiles} markierte E1-Profile existieren bereits`);
  if (state.pendingJobs > 0) problems.push(`${state.pendingJobs} offene Indexaufträge`);
  if (state.failedJobs > 0) problems.push(`${state.failedJobs} fehlgeschlagene Indexaufträge`);
  if (state.activeOpsLease) problems.push('Betriebsrunner hält gerade die Laufsperre');
  // Eine frühere Sicherung blockiert nur, wenn ihr Rückweg offen ist; eine
  // abgeschlossene wird vor dem neuen Austausch archiviert (nicht gelöscht).
  if (backupState === 'open') problems.push(`Sicherung ${BACKUP_PATH} gehört zu einem offenen Rückweg (bisherige Testkurse nicht vollständig wiederhergestellt)`);
  if (backupState === 'invalid') problems.push(`Sicherung ${BACKUP_PATH} ist nicht lesbar oder ungültig`);
  const differing = Object.entries(taxonomy?.differing ?? {}).filter(([, ids]) => ids.length > 0);
  if (differing.length) problems.push(`Taxonomie weicht bei gleicher ID ab: ${differing.map(([t, ids]) => `${t} ${ids.slice(0, 5).join(',')}`).join('; ')}`);
  if (state.chunksTotal !== state.chunksEmbedded) problems.push(`${state.chunksTotal - state.chunksEmbedded} Abschnitte ohne Embedding (Sicherung wäre unvollständig)`);
  return problems;
}

/** Vorbedingungen für den Rückweg (S11). */
export function restorePreconditions({ state, backupCheck, importLog, references }) {
  const problems = [];
  if (!backupCheck?.ok) problems.push(`Sicherung nicht verwendbar: ${backupCheck?.reason ?? 'fehlt'}`);
  if (!importLog) problems.push(`Importprotokoll ${IMPORT_LOG_PATH} fehlt`);
  if (state.pendingJobs > 0) problems.push(`${state.pendingJobs} offene Indexaufträge`);
  if (state.activeOpsLease) problems.push('Betriebsrunner hält gerade die Laufsperre');
  if (references.bookings > 0) problems.push(`${references.bookings} Buchungen verweisen auf Abnahmekurse`);
  if (references.leads > 0) problems.push(`${references.leads} Anfragen verweisen auf Abnahmekurse`);
  return problems;
}

function client(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAll(db, table, columns, apply, orderBy = 'id') {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = db.from(table).select(columns).order(orderBy).range(offset, offset + PAGE - 1);
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table} lesen: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

async function fetchByIds(db, table, columns, column, ids, chunk = 100) {
  const rows = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    rows.push(...await fetchAll(db, table, columns, (q) => q.in(column, slice), column));
  }
  return rows;
}

async function count(db, table, apply) {
  let query = db.from(table).select('*', { count: 'exact', head: true });
  if (apply) query = apply(query);
  const { count: value, error } = await query;
  if (error) throw new Error(`${table} zählen: ${error.message}`);
  return value ?? 0;
}

/** Liest den öffentlichen Katalog (Rolle anon) nach Positivliste. */
export async function exportSnapshot(prod) {
  const exportedAt = new Date().toISOString();
  const courses = await fetchAll(prod, 'courses', EXPORT_FIELDS.courses.join(', '), (q) => q.eq('status', 'published'));
  const publishedAfter = await count(prod, 'courses', (q) => q.eq('status', 'published'));
  if (publishedAfter !== courses.length) {
    throw new Error(`Katalog änderte sich während des Lesens (${courses.length} gelesen, ${publishedAfter} jetzt) — erneut starten`);
  }
  const ids = courses.map((c) => c.id);
  const userIds = [...new Set(courses.map((c) => c.user_id).filter(Boolean))];
  const snapshot = { exportedAt, courses };
  for (const table of ['course_events', 'course_locations', 'course_category_assignments']) {
    snapshot[table] = await fetchByIds(prod, table, EXPORT_FIELDS[table].join(', '), 'course_id', ids);
  }
  for (const table of TAXONOMY_TABLES) snapshot[table] = await fetchAll(prod, table, EXPORT_FIELDS[table].join(', '));
  snapshot.public_teacher_profiles = await fetchByIds(prod, 'public_teacher_profiles', EXPORT_FIELDS.public_teacher_profiles.join(', '), 'id', userIds);
  return snapshot;
}

/**
 * Nur lesend: Entspricht jedes Indexdokument dem, was der aktuelle Code aus
 * der Quelle erzeugen würde (Prüfsumme + Abschnitte)? Vollständig, nicht als
 * Stichprobe.
 */
async function checkIndexCurrent(db) {
  const documents = await fetchAll(db, 'ai_search_documents', 'course_id, content_hash', null, 'course_id');
  let hashMismatch = 0;
  const firstMismatches = [];
  for (let i = 0; i < documents.length; i += 10) {
    const batch = documents.slice(i, i + 10);
    const results = await Promise.all(batch.map(async (doc) => {
      const source = await loadCourseSource(db, doc.course_id);
      const projection = buildProjection(source.course, { profile: source.profile, categoryPaths: source.categoryPaths }, { sourceVersion: 0 });
      return projection.action === 'upsert' && projection.document.content_hash === doc.content_hash ? null : doc.course_id;
    }));
    for (const id of results) if (id !== null) { hashMismatch += 1; if (firstMismatches.length < 10) firstMismatches.push(id); }
  }
  const integrity = await verifyChunkIntegrity(db, documents.map((d) => d.course_id));
  return { documents: documents.length, hashMismatch, firstMismatches, chunkFailures: integrity.failed };
}

async function readTaxonomy(db) {
  const out = {};
  for (const table of TAXONOMY_TABLES) out[table] = await fetchAll(db, table, EXPORT_FIELDS[table].join(', '));
  return out;
}

const outsideRange = (q) => q.or(`id.lt.${ACCEPTANCE_RANGE.min},id.gt.${ACCEPTANCE_RANGE.max}`);
const outsideRangeCourse = (q) => q.or(`course_id.lt.${ACCEPTANCE_RANGE.min},course_id.gt.${ACCEPTANCE_RANGE.max}`);
const inRange = (column) => (q) => q.gte(column, ACCEPTANCE_RANGE.min).lte(column, ACCEPTANCE_RANGE.max);

export async function readTestState(db) {
  const nowIso = new Date().toISOString();
  const [publishedTotal, publishedOutside, coursesInRange, docsTotal, docsOutside, chunksTotal, chunksEmbedded,
    pendingJobs, failedJobs, markedProfiles] = await Promise.all([
    count(db, 'courses', (q) => q.eq('status', 'published')),
    count(db, 'courses', (q) => outsideRange(q.eq('status', 'published'))),
    count(db, 'courses', inRange('id')),
    count(db, 'ai_search_documents'),
    count(db, 'ai_search_documents', outsideRangeCourse),
    count(db, 'ai_search_chunks'),
    count(db, 'ai_search_chunks', (q) => q.not('embedding', 'is', null)),
    count(db, 'ai_search_jobs', (q) => q.eq('status', 'pending')),
    count(db, 'ai_search_jobs', (q) => q.eq('status', 'failed')),
    count(db, 'profiles', (q) => q.like('slug', `${PROVIDER_SLUG_PREFIX}%`)),
  ]);
  const { data: config, error: configError } = await db.from('ai_search_config').select('active_model_version').eq('id', 1).maybeSingle();
  if (configError) throw new Error(`Konfiguration: ${configError.message}`);
  const { data: leases, error: leaseError } = await db.from('ai_search_ops_runs').select('id').is('finished_at', null).gt('lease_until', nowIso).limit(1);
  if (leaseError) throw new Error(`Laufsperre: ${leaseError.message}`);
  return {
    publishedTotal, publishedOutside, coursesInRange, docsTotal, docsOutside, chunksTotal, chunksEmbedded,
    pendingJobs, failedJobs, markedProfiles,
    activeModelVersion: config?.active_model_version ?? null,
    activeOpsLease: (leases ?? []).length > 0,
  };
}

function printState(label, state) {
  console.log(`\n--- ${label} ---`);
  console.log(`Veröffentlichte Kurse:              ${state.publishedTotal} (davon ausserhalb ${ACCEPTANCE_RANGE.min}–${ACCEPTANCE_RANGE.max}: ${state.publishedOutside})`);
  console.log(`Kurse im Abnahmebereich:            ${state.coursesInRange}`);
  console.log(`Indexdokumente:                     ${state.docsTotal} (ausserhalb Abnahmebereich: ${state.docsOutside})`);
  console.log(`Abschnitte / mit Embedding:         ${state.chunksTotal} / ${state.chunksEmbedded}`);
  console.log(`Aufträge offen / fehlgeschlagen:    ${state.pendingJobs} / ${state.failedJobs}`);
  console.log(`Markierte E1-Profile:               ${state.markedProfiles}`);
  console.log(`Aktive Modellversion:               ${state.activeModelVersion ?? '–'}`);
  console.log(`Laufsperre Betriebsrunner aktiv:    ${state.activeOpsLease ? 'JA' : 'nein'}`);
}

async function storageExists(db, path) {
  const [folder, ...rest] = path.split('/');
  const name = rest.join('/');
  const { data, error } = await db.storage.from(BACKUP_BUCKET).list(folder, { search: name });
  if (error) {
    if (/not found/i.test(error.message)) return false;
    throw new Error(`Speicher prüfen: ${error.message}`);
  }
  return (data ?? []).some((entry) => entry.name === name);
}

async function ensurePrivateBucket(db) {
  const { data, error } = await db.storage.getBucket(BACKUP_BUCKET);
  if (data) {
    if (data.public) throw new Error(`Bucket ${BACKUP_BUCKET} ist öffentlich — Abbruch`);
    return 'vorhanden';
  }
  if (error && !/not found/i.test(error.message)) throw new Error(`Bucket prüfen: ${error.message}`);
  const created = await db.storage.createBucket(BACKUP_BUCKET, { public: false });
  if (created.error) throw new Error(`Bucket anlegen: ${created.error.message}`);
  return 'angelegt (privat)';
}

async function bucketReachable(db) {
  const { data, error } = await db.storage.getBucket(BACKUP_BUCKET);
  if (data) return { exists: true, public: data.public };
  if (error && !/not found/i.test(error.message)) throw new Error(`Bucket prüfen: ${error.message}`);
  return { exists: false, public: false };
}

export async function uploadJson(db, path, value, { gzip = false } = {}) {
  const raw = Buffer.from(JSON.stringify(value), 'utf8');
  const body = gzip ? gzipSync(raw) : raw;
  const { error } = await db.storage.from(BACKUP_BUCKET).upload(path, body, {
    contentType: gzip ? 'application/gzip' : 'application/json', upsert: false,
  });
  if (error) throw new Error(`Hochladen ${path}: ${error.message}`);
  return body.length;
}

export async function downloadJson(db, path, { gzip = false } = {}) {
  const { data, error } = await db.storage.from(BACKUP_BUCKET).download(path);
  if (error) throw new Error(`Laden ${path}: ${error.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  return JSON.parse((gzip ? gunzipSync(buffer) : buffer).toString('utf8'));
}

/** Worker + Abgleich bis die Warteschlange leer ist (wie die Testbefüllung). */
async function drainAll(db, label) {
  let last = null;
  for (let round = 1; round <= 10; round += 1) {
    const reconciliation = await runReconciliation(db, { skipQuotaCleanup: true });
    const drained = await drainOutbox(db, { timeBudgetMs: 10 * 60_000, batchSize: 400, concurrency: 8 });
    console.log(`${label} Runde ${round}: Abgleich eingereiht ${reconciliation.enqueued ?? '?'}, verarbeitet ${drained.courses}, neu ${drained.inserted}, aktualisiert ${drained.updated}, entfernt ${drained.deleted}, Fehler ${drained.failures}`);
    if (drained.failures > 0) throw new StepError(`${label}: ${drained.failures} Kurs(e) fehlgeschlagen (erste Kurs-IDs: ${drained.errors.slice(0, 5).map((e) => e.courseId ?? '?').join(', ')})`);
    last = { reconciliation, drained };
    if (!reconciliation.truncated && drained.drained) return last;
  }
  throw new StepError(`${label}: Warteschlange nach 10 Runden nicht leer`);
}

class StepError extends Error {}

function stop(message) {
  console.error(`\nSTOPP: ${message}`);
  process.exitCode = 1;
}

async function takeBackup(db) {
  const courses = await fetchAll(db, 'courses', 'id, status');
  const documents = await fetchAll(db, 'ai_search_documents', 'course_id, content_hash', null, 'course_id');
  const chunks = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await db.from('ai_search_chunks')
      .select('id, course_id, section, chunk_index, text, model_version, embedding')
      .order('id').range(offset, offset + 199);
    if (error) throw new Error(`Abschnitte lesen: ${error.message}`);
    chunks.push(...(data ?? []));
    if ((data ?? []).length < 200) break;
  }
  const { data: config } = await db.from('ai_search_config').select('active_model_version').eq('id', 1).maybeSingle();
  return sealBackup(buildBackup({ courses, documents, chunks, activeModelVersion: config?.active_model_version, createdAt: new Date().toISOString() }));
}

async function insertBatches(db, table, rows, size) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size));
    if (error) throw new StepError(`${table} einfügen (ab Zeile ${i}): ${error.message}`);
  }
}

async function updateStatus(db, ids, from, to) {
  let changed = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('courses').update({ status: to }).in('id', ids.slice(i, i + 200)).eq('status', from).select('id');
    if (error) throw new StepError(`Status ${from}→${to}: ${error.message}`);
    changed += (data ?? []).length;
  }
  return changed;
}

function estimateNewChunks(rows) {
  let chunks = 0;
  let chars = 0;
  for (const course of rows.courses) {
    for (const chunk of buildCourseChunks(course)) { chunks += 1; chars += chunk.text.length; }
  }
  return { chunks, chars, ...estimateEmbeddingUsd(chars) };
}

function printPlan({ snapshot, validation, rows, taxonomy, estimate }) {
  console.log(`\n--- Katalogstand Produktion (öffentlich, gelesen ${snapshot.exportedAt}) ---`);
  console.log(`Kurse ${validation.counts.courses}, Termine ${validation.counts.events}, Orte ${validation.counts.locations}, Kategoriezuordnungen ${validation.counts.assignments}`);
  console.log(`Anbieter ${validation.counts.providers} (öffentlich sichtbar ${validation.counts.providersPublic}), Kurse ohne Anbieter ${validation.counts.coursesWithoutProvider}, höchste Kurs-ID ${validation.counts.maxCourseId}`);
  console.log(`Prüfung Positivliste/Status: ${validation.ok ? 'OK' : `FEHLER: ${validation.errors.slice(0, 5).join('; ')}`}`);
  const missing = TAXONOMY_TABLES.map((t) => `${t} +${taxonomy.missing[t].length}${taxonomy.missing[t].length ? ` (IDs ${taxonomy.missing[t].map((r) => r.id).join(',')})` : ''}`).join('; ');
  const differing = TAXONOMY_TABLES.map((t) => `${t} ${taxonomy.differing[t].length}`).join('; ');
  console.log(`Taxonomie zu ergänzen: ${missing}`);
  console.log(`Taxonomie abweichend (gleiche ID): ${differing}`);
  if (rows) {
    console.log(`Import: ${rows.profiles.length} markierte Profile (${PROVIDER_NAME_PREFIX}001…, Rolle teacher ${rows.profiles.filter((p) => p.role === 'teacher').length}, Paket basic), ${rows.courses.length} Kurse (IDs ${ACCEPTANCE_RANGE.min}+), Prüfsumme ${importFingerprint({ ...rows, profiles: rows.profiles.map(({ id, ...rest }) => rest) })}`);
    console.log(`Neue Abschnitte ≈ ${estimate.chunks}, ${estimate.chars} Zeichen ≈ ${estimate.tokens} Tokens ≈ USD ${estimate.usd.toFixed(4)} Ersteinbettung (Schätzung)`);
  }
}

async function cmdPlanOrSwitch(env, { execute, command }) {
  const prodCheck = checkProdSource(env);
  if (!prodCheck.ok) { stop(prodCheck.reason); return; }
  const test = client(env.SUPABASE_URL_TEST, env.SUPABASE_SECRET_KEY_TEST);
  const prod = client(env.SUPABASE_URL_PROD_PUBLIC, env.SUPABASE_PUBLISHABLE_KEY_PROD);

  const snapshot = await exportSnapshot(prod);
  const validation = validateSnapshot(snapshot);
  const taxonomy = diffTaxonomy(snapshot, await readTaxonomy(test));
  const rows = validation.ok ? buildImportRows(snapshot, { secret: randomBytes(32).toString('hex') }) : null;
  const estimate = rows ? estimateNewChunks(rows) : null;
  printPlan({ snapshot, validation, rows, taxonomy, estimate });

  const state = await readTestState(test);
  printState('TEST vorher', state);
  const bucket = await bucketReachable(test);
  const backupExists = bucket.exists ? await storageExists(test, BACKUP_PATH) : false;
  const previous = backupExists ? await previousBackupState(test, state) : { state: 'none' };
  console.log(`Privater Speicher ${BACKUP_BUCKET}: ${bucket.exists ? (bucket.public ? 'ÖFFENTLICH (Abbruch)' : 'vorhanden') : 'wird angelegt'}; frühere Sicherung: ${backupExists ? `${previous.state}${previous.createdAt ? ` (${previous.createdAt})` : ''}` : 'keine'}`);
  const indexCheck = await checkIndexCurrent(test);
  console.log(`Bisheriger Index gegen aktuellen Code: ${indexCheck.documents} Dokumente, ${indexCheck.hashMismatch} Prüfsummen abweichend${indexCheck.firstMismatches.length ? ` (Kurs-IDs ${indexCheck.firstMismatches.join(', ')})` : ''}, ${indexCheck.chunkFailures} Abschnittslisten abweichend`);
  const problems = switchPreconditions({ state, validation, taxonomy, backupState: previous.state, indexCheck });
  if (bucket.public) problems.push(`Bucket ${BACKUP_BUCKET} ist öffentlich`);
  console.log(`\nVom Austausch betroffen: ${state.publishedOutside} veröffentlichte Testkurse → Entwurf; ${state.docsTotal} Dokumente, ${state.chunksTotal} Abschnitte, ${state.chunksEmbedded} Embeddings werden aus dem Index entfernt (Sicherung vorher).`);
  if (problems.length) { problems.forEach((p) => console.log(`Vorbedingung NICHT erfüllt: ${p}`)); }
  else console.log('Vorbedingungen für den Austausch: erfüllt.');

  if (command === 'plan') { if (problems.length) process.exitCode = 1; return; }
  const confirm = checkWriteConfirm(env, execute);
  if (!confirm.ok) { console.log(`\n${confirm.reason}: keine Änderung.`); if (problems.length) process.exitCode = 1; return; }
  if (problems.length) { stop('Vorbedingungen nicht erfüllt — keine Änderung.'); return; }

  // S3: Sicherung
  console.log(`\n=== S3 Sicherung (${await ensurePrivateBucket(test)}) ===`);
  if (previous.state === 'closed') {
    const moved = await archivePreviousBackup(test, previous.createdAt);
    console.log(`Frühere Sicherung archiviert (Rückweg war abgeschlossen): ${moved.join(', ')}`);
  }
  const backup = await takeBackup(test);
  if (backup.counts.documents !== state.docsTotal || backup.counts.chunks !== state.chunksTotal || backup.counts.publishedCourses !== state.publishedTotal) {
    stop(`Sicherung unvollständig (${JSON.stringify(backup.counts)}) — keine Änderung.`); return;
  }
  const size = await uploadJson(test, BACKUP_PATH, backup, { gzip: true });
  const reread = await downloadJson(test, BACKUP_PATH, { gzip: true });
  const check = verifyBackup(reread);
  if (!check.ok || reread.checksum !== backup.checksum) { stop(`Sicherung nach dem Hochladen nicht lesbar: ${check.reason}`); return; }
  console.log(`Gesichert: ${JSON.stringify(backup.counts)}, ${Math.round(size / 1024)} KB, Prüfsumme ${backup.checksum.slice(0, 16)}`);

  try {
    // S4: bisherige Testkurse auf Entwurf, Index leeren
    console.log('\n=== S4 Bisherige Testkurse auf Entwurf, Index entfernen ===');
    const changed = await updateStatus(test, backup.publishedCourseIds, 'published', 'draft');
    console.log(`Auf Entwurf gesetzt: ${changed} von ${backup.publishedCourseIds.length}`);
    if (changed !== backup.publishedCourseIds.length) throw new StepError('nicht alle Kurse umgestellt');
    await drainAll(test, 'Entfernen');
    const afterDelete = await readTestState(test);
    printState('TEST nach S4', afterDelete);
    if (afterDelete.publishedTotal !== 0 || afterDelete.docsTotal !== 0 || afterDelete.chunksTotal !== 0) {
      throw new StepError('Index nach S4 nicht leer (oder neue veröffentlichte Kurse ausserhalb des Abnahmebereichs, z. B. durch CI) — kein Import');
    }

    // S5: Taxonomie, Profile, Kurse
    console.log('\n=== S5 Import ===');
    const taxonomyAdded = {};
    for (const table of TAXONOMY_TABLES) {
      await insertBatches(test, table, taxonomy.missing[table], 200);
      taxonomyAdded[table] = taxonomy.missing[table].map((r) => r.id);
    }
    await insertBatches(test, 'profiles', rows.profiles, 100);
    await insertBatches(test, 'courses', rows.courses, 100);
    await insertBatches(test, 'course_events', rows.course_events, 500);
    await insertBatches(test, 'course_locations', rows.course_locations, 500);
    await insertBatches(test, 'course_category_assignments', rows.course_category_assignments, 500);
    const imported = {
      courses: await count(test, 'courses', inRange('id')),
      course_events: await count(test, 'course_events', inRange('course_id')),
      course_locations: await count(test, 'course_locations', inRange('course_id')),
      course_category_assignments: await count(test, 'course_category_assignments', inRange('course_id')),
      profiles: await count(test, 'profiles', (q) => q.like('slug', `${PROVIDER_SLUG_PREFIX}%`)),
    };
    console.log(`Im TEST: ${JSON.stringify(imported)}; Taxonomie ergänzt ${JSON.stringify(taxonomyAdded)}`);
    for (const [table, value] of Object.entries(imported)) {
      if (value !== rows[table].length) throw new StepError(`${table}: ${value} im TEST, ${rows[table].length} erwartet`);
    }
    await uploadJson(test, IMPORT_LOG_PATH, {
      exportedAt: snapshot.exportedAt, importedAt: new Date().toISOString(), counts: imported, taxonomyAdded,
      validation: validation.counts, sourceProject: PRODUCTION_REF,
    });

    // S6: Indexaufbau ohne Modell
    console.log('\n=== S6 Indexaufbau (ohne Modell) ===');
    await drainAll(test, 'Aufbau');
    const built = await readTestState(test);
    printState('TEST nach S6', built);
    const docIds = (await fetchAll(test, 'ai_search_documents', 'course_id', null, 'course_id')).map((d) => Number(d.course_id));
    const integrity = await verifyChunkIntegrity(test, docIds);
    console.log(`Abschnittsvergleich: ${integrity.checked} geprüft, ${integrity.failed} abweichend`);
    const outside = docIds.filter((id) => !inAcceptanceRange(id)).length;
    if (built.publishedTotal !== rows.courses.length || built.docsTotal !== rows.courses.length || outside > 0
      || integrity.failed > 0 || built.pendingJobs > 0 || built.failedJobs > 0) {
      throw new StepError('Indexaufbau unvollständig oder mit fremden Kursen');
    }
    console.log(`\nAustausch abgeschlossen. Nächster Schritt S7: Ersteinbettung von ${built.chunksTotal - built.chunksEmbedded} Abschnitten (Schätzung USD ${estimate.usd.toFixed(4)}).`);
  } catch (error) {
    if (error instanceof StepError) { stop(`${error.message}. Rückweg: \`restore --execute\` (Sicherung liegt vor).`); return; }
    throw error;
  }
}

async function cmdStatus(env) {
  const test = client(env.SUPABASE_URL_TEST, env.SUPABASE_SECRET_KEY_TEST);
  printState('TEST', await readTestState(test));
  const bucket = await bucketReachable(test);
  console.log(`Sicherung vorhanden: ${bucket.exists && await storageExists(test, BACKUP_PATH) ? 'ja' : 'nein'}; Importprotokoll: ${bucket.exists && await storageExists(test, IMPORT_LOG_PATH) ? 'ja' : 'nein'}`);
}

async function cmdRestore(env, { execute }) {
  const test = client(env.SUPABASE_URL_TEST, env.SUPABASE_SECRET_KEY_TEST);
  const state = await readTestState(test);
  printState('TEST vorher', state);
  const bucket = await bucketReachable(test);
  const backup = bucket.exists && await storageExists(test, BACKUP_PATH) ? await downloadJson(test, BACKUP_PATH, { gzip: true }) : null;
  const importLog = bucket.exists && await storageExists(test, IMPORT_LOG_PATH) ? await downloadJson(test, IMPORT_LOG_PATH) : null;
  const references = {
    bookings: await count(test, 'bookings', inRange('course_id')),
    leads: await count(test, 'leads', inRange('course_id')),
  };
  const backupCheck = backup ? verifyBackup(backup) : { ok: false, reason: 'keine Sicherung gefunden' };
  const problems = restorePreconditions({ state, backupCheck, importLog, references });
  if (backup) console.log(`Sicherung vom ${backup.createdAt}: ${JSON.stringify(backup.counts)}`);
  console.log(`Rückweg: ${state.coursesInRange} Abnahmekurse und ${state.markedProfiles} markierte Profile löschen, Taxonomie-Ergänzungen entfernen, ${backup?.publishedCourseIds.length ?? '?'} Testkurse wieder veröffentlichen, Index neu aufbauen, ${backup?.counts.chunksEmbedded ?? '?'} Embeddings aus der Sicherung zurückschreiben (kein Modellaufruf).`);
  problems.forEach((p) => console.log(`Vorbedingung NICHT erfüllt: ${p}`));
  const confirm = checkWriteConfirm(env, execute);
  if (!confirm.ok) { console.log(`\n${confirm.reason}: keine Änderung.`); if (problems.length) process.exitCode = 1; return; }
  if (problems.length) { stop('Vorbedingungen nicht erfüllt — keine Änderung.'); return; }

  try {
    console.log('\n=== R1 Abnahmekurse und markierte Profile löschen ===');
    const { error: delCourses } = await test.from('courses').delete().gte('id', ACCEPTANCE_RANGE.min).lte('id', ACCEPTANCE_RANGE.max);
    if (delCourses) throw new StepError(`Kurse löschen: ${delCourses.message}`);
    const { error: delProfiles } = await test.from('profiles').delete()
      .like('slug', `${PROVIDER_SLUG_PREFIX}%`).like('full_name', `${PROVIDER_NAME_PREFIX}%`).is('email', null);
    if (delProfiles) throw new StepError(`Profile löschen: ${delProfiles.message}`);
    for (const table of [...TAXONOMY_TABLES].reverse()) {
      const ids = importLog.taxonomyAdded?.[table] ?? [];
      if (ids.length === 0) continue;
      const { error } = await test.from(table).delete().in('id', ids);
      if (error) throw new StepError(`${table} Ergänzungen entfernen: ${error.message}`);
    }

    console.log('\n=== R2 Bisherige Testkurse wieder veröffentlichen ===');
    const changed = await updateStatus(test, backup.publishedCourseIds, 'draft', 'published');
    const current = await fetchByIds(test, 'courses', 'id, status', 'id', backup.publishedCourseIds, 200);
    const publishedAgain = current.filter((c) => c.status === 'published').length;
    const deletedSinceBackup = backup.publishedCourseIds.filter((id) => !current.some((c) => Number(c.id) === id));
    console.log(`Wieder veröffentlicht: ${changed} umgestellt, ${publishedAgain} von ${backup.publishedCourseIds.length} jetzt veröffentlicht, seit der Sicherung gelöscht: ${deletedSinceBackup.length}`);
    await drainAll(test, 'Wiederaufbau');

    console.log('\n=== R3 Abgleich mit der Sicherung ===');
    const documents = await fetchAll(test, 'ai_search_documents', 'course_id, content_hash', null, 'course_id');
    const chunks = await fetchAll(test, 'ai_search_chunks', 'id, course_id, section, chunk_index, text, model_version', null);
    const createdSinceBackup = documents.map((d) => Number(d.course_id)).filter((id) => id > backup.maxCourseId && !inAcceptanceRange(id));
    if (deletedSinceBackup.length || createdSinceBackup.length) {
      console.log(`Von aussen verändert (z. B. CI-Seed), gesondert ausgewiesen: gelöscht ${deletedSinceBackup.join(', ') || '–'}; neu ${createdSinceBackup.join(', ') || '–'}`);
    }
    const comparison = compareIndexToBackup(backup, documents, chunks, { ignoreCourseIds: [...deletedSinceBackup, ...createdSinceBackup] });
    const summary = Object.fromEntries(Object.entries(comparison).filter(([k]) => k !== 'ok').map(([k, v]) => [k, v.length]));
    console.log(`Abweichungen: ${JSON.stringify(summary)}`);

    console.log('\n=== R4 Embeddings aus der Sicherung zurückschreiben ===');
    const ignored = new Set([...deletedSinceBackup, ...createdSinceBackup]);
    const plan = planEmbeddingRestore(backup, chunks.filter((c) => !ignored.has(Number(c.course_id))).map((c) => ({ ...c, embedding: null })));
    const ignoredChunks = chunks.filter((c) => ignored.has(Number(c.course_id))).length;
    let written = 0;
    for (const update of plan.updates) {
      const { error } = await test.from('ai_search_chunks').update({ embedding: update.embedding, model_version: update.model_version }).eq('id', update.id);
      if (error) throw new StepError(`Embedding zurückschreiben ${update.id}: ${error.message}`);
      written += 1;
    }
    console.log(`Zurückgeschrieben: ${written}; ohne passende Sicherung: ${plan.unmatched.length}; Abschnitte neuer Fremdkurse (nicht in der Sicherung): ${ignoredChunks}`);
    const after = await readTestState(test);
    printState('TEST nach Rückweg', after);
    const restored = comparison.ok && publishedAgain + deletedSinceBackup.length === backup.publishedCourseIds.length
      && plan.unmatched.length === 0 && after.chunksEmbedded + ignoredChunks >= after.chunksTotal
      && after.activeModelVersion === backup.activeModelVersion && after.coursesInRange === 0 && after.markedProfiles === 0;
    if (!restored) {
      throw new StepError(`Zustand weicht von der Sicherung ab${plan.unmatched.length ? ` — ${plan.unmatched.length} Abschnitte mit dem Embedding-Skript nachholen (Schätzung siehe Trockenlauf)` : ''}`);
    }
    console.log('\nRückweg abgeschlossen: Zustand entspricht der Sicherung (Dokumente, Prüfsummen, Abschnitte, Embeddings).');
  } catch (error) {
    if (error instanceof StepError) { stop(error.message); return; }
    throw error;
  }
}

/**
 * Zustand einer früheren Sicherung: 'closed' = Rückweg abgeschlossen (alle
 * gesicherten Kurse wieder veröffentlicht oder seither gelöscht, kein
 * Abnahmebestand); 'open' = Rückweg offen; 'invalid' = nicht verwendbar.
 */
export function backupClosed({ state, publishedIds, currentRows }) {
  const published = currentRows.filter((c) => c.status === 'published').length;
  const deleted = publishedIds.length - currentRows.length;
  return state.coursesInRange === 0 && state.markedProfiles === 0 && published + deleted === publishedIds.length;
}

async function previousBackupState(db, state) {
  let backup;
  try { backup = await downloadJson(db, BACKUP_PATH, { gzip: true }); } catch { return { state: 'invalid' }; }
  if (!verifyBackup(backup).ok) return { state: 'invalid', createdAt: backup?.createdAt ?? null };
  const currentRows = await fetchByIds(db, 'courses', 'id, status', 'id', backup.publishedCourseIds, 200);
  return { state: backupClosed({ state, publishedIds: backup.publishedCourseIds, currentRows }) ? 'closed' : 'open', createdAt: backup.createdAt };
}

export function archiveFolder(createdAt) {
  return `abnahme-katalog/archiv/${String(createdAt ?? 'unbekannt').replace(/[:.]/g, '-')}`;
}

async function archivePreviousBackup(db, createdAt) {
  const folder = archiveFolder(createdAt);
  const moved = [];
  for (const path of [BACKUP_PATH, IMPORT_LOG_PATH]) {
    if (!(await storageExists(db, path))) continue;
    const target = `${folder}/${path.split('/').pop()}`;
    const { error } = await db.storage.from(BACKUP_BUCKET).move(path, target);
    if (error) throw new Error(`Archivieren ${path}: ${error.message}`);
    moved.push(target);
  }
  return moved;
}

async function listRecursive(db, folder, depth = 0) {
  const { data, error } = await db.storage.from(BACKUP_BUCKET).list(folder, { limit: 1000 });
  if (error) throw new Error(`Liste ${folder}: ${error.message}`);
  const paths = [];
  for (const entry of data ?? []) {
    if (entry.id) paths.push(`${folder}/${entry.name}`);
    else if (depth < 4) paths.push(...await listRecursive(db, `${folder}/${entry.name}`, depth + 1));
  }
  return paths;
}

async function cmdPurge(env, { execute }) {
  const test = client(env.SUPABASE_URL_TEST, env.SUPABASE_SECRET_KEY_TEST);
  const bucket = await bucketReachable(test);
  if (!bucket.exists) { console.log(`Bucket ${BACKUP_BUCKET} existiert nicht.`); return; }
  // Alle Dateien unter abnahme-katalog/ (Sicherung, Archiv, Ergebnisse), rekursiv.
  const paths = await listRecursive(test, 'abnahme-katalog');
  const state = await readTestState(test);
  console.log(`Zu löschen: ${paths.length} Dateien im Bucket ${BACKUP_BUCKET}`);
  if (state.coursesInRange > 0) { stop('Abnahmebestand ist noch vorhanden — Sicherung wird für den Rückweg gebraucht.'); return; }
  const confirm = checkWriteConfirm(env, execute);
  if (!confirm.ok) { console.log(`${confirm.reason}: keine Änderung.`); return; }
  if (paths.length) {
    const { error } = await test.storage.from(BACKUP_BUCKET).remove(paths);
    if (error) throw new Error(`Löschen: ${error.message}`);
  }
  const { error } = await test.storage.deleteBucket(BACKUP_BUCKET);
  if (error) throw new Error(`Bucket löschen: ${error.message}`);
  console.log('Sicherung, Importprotokoll und Ergebnisse gelöscht.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.errors.length) { args.errors.forEach((e) => console.error(`Abbruch: ${e}`)); process.exit(2); }
  const guard = checkTestTarget(process.env);
  if (!guard.ok) { console.error(`Abbruch: ${guard.reason}`); process.exit(2); }
  console.log(`Abnahmebestand KI-Suche — Befehl ${args.command}${args.execute ? ' (AUSFÜHRUNG)' : ''}, Ziel ${EXPECTED_TEST_REF}. Keine Modellaufrufe.`);
  if (args.command === 'plan' || args.command === 'switch') await cmdPlanOrSwitch(process.env, args);
  else if (args.command === 'status') await cmdStatus(process.env);
  else if (args.command === 'restore') await cmdRestore(process.env, args);
  else if (args.command === 'purge') await cmdPurge(process.env, args);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Unerwarteter Fehler:', error?.message ?? error); process.exit(1); });
}
