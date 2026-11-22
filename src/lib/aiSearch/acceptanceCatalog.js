/**
 * Abnahmebestand der KI-Suche (Paket 2): reine, lokal testbare Logik für
 * Übernahme des öffentlichen Katalogs in die TESTumgebung, Sicherung des
 * bisherigen Testindex und Rückweg. Kein Netz, keine Geheimnisse.
 *
 * Grundsätze (Entscheidungen vom 22.11.2026):
 *  - Quelle ist ausschliesslich, was die Plattform öffentlich zeigt. Gelesen
 *    wird mit dem ÖFFENTLICHEN Schlüssel (Rolle anon) und einer festen
 *    Positivliste je Tabelle; veröffentlichte Kurse werden zusätzlich per
 *    Statusfilter erzwungen und hier noch einmal geprüft.
 *  - Keine Produktionskonten, keine Profiltexte: je echtem Anbieter genau eine
 *    markierte Profilzeile „E1-Anbieter nnn“ ohne Login, Paketstufe basic.
 *  - Neuer ID-Bereich (Produktions-ID + 20 000). Der bisherige Testindex wird
 *    beim Austausch ENTFERNT (nicht isoliert); deshalb gibt es eine Sicherung
 *    mit Status, Dokument-Prüfsummen, Abschnittsschlüsseln und Embeddings.
 */

import { createHash, createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const PRODUCTION_REF = 'nplxmpfasgpumpiddjfl';
export const TEST_REF = 'omoapbvfligjfznzivyu';

export const ID_OFFSET = 20000;
export const ACCEPTANCE_RANGE = Object.freeze({ min: 20000, max: 29999 });
/** Grösste übernehmbare Produktions-ID (sonst verlässt sie den Bereich). */
export const MAX_SOURCE_ID = ACCEPTANCE_RANGE.max - ID_OFFSET;

export const PROVIDER_NAME_PREFIX = 'E1-Anbieter ';
export const PROVIDER_SLUG_PREFIX = 'e1-anbieter-';

/** Privater Speicher im TEST-Projekt (Storage-Bucket, nicht öffentlich). */
export const BACKUP_BUCKET = 'ai-search-acceptance';
export const BACKUP_PATH = 'abnahme-katalog/s3-ausgangszustand.json.gz';
export const IMPORT_LOG_PATH = 'abnahme-katalog/s5-import.json';
export const QUALITY_PREFIX = 'abnahme-katalog/s9-qualitaet';

export const TAXONOMY_TABLES = Object.freeze(['taxonomy_level1', 'taxonomy_level2', 'taxonomy_level3', 'taxonomy_level4']);
const TAXONOMY_LABELS = ['slug', 'label_de', 'label_en', 'label_fr', 'label_it', 'sort_order', 'is_active'];

/**
 * Positivliste je Quelle. Nur diese Spalten werden gelesen und übernommen.
 * `status` wird nur gelesen (Prüfung = published), im TEST gesetzt.
 */
export const EXPORT_FIELDS = Object.freeze({
  courses: Object.freeze([
    'id', 'status', 'title', 'description', 'objectives', 'prerequisites', 'keywords', 'free_reason',
    'level', 'language', 'languages', 'delivery_type', 'delivery_types', 'target_age_groups', 'min_age',
    'target_group', 'session_count', 'session_length', 'price', 'price_info', 'booking_type', 'canton',
    'address', 'instructor_name', 'image_url', 'category_type', 'category_area', 'category_specialty',
    'category_focus', 'category_type_id', 'category_area_id', 'category_specialty_id', 'category_focus_id',
    'category_level3_id', 'category_level4_id', 'kinder_kursart', 'privat_kursart', 'user_id',
    'created_at', 'start_date',
  ]),
  course_events: Object.freeze([
    'course_id', 'start_date', 'end_date', 'location', 'canton', 'schedule_description',
    'max_participants', 'cancelled_at', 'cancelled_reason',
  ]),
  course_locations: Object.freeze(['course_id', 'location_type', 'street', 'city', 'canton', 'sort_order']),
  course_category_assignments: Object.freeze(['course_id', 'level3_id', 'level4_id', 'is_primary']),
  taxonomy_level1: Object.freeze(['id', 'icon', ...TAXONOMY_LABELS]),
  taxonomy_level2: Object.freeze(['id', 'level1_id', 'icon', ...TAXONOMY_LABELS]),
  taxonomy_level3: Object.freeze(['id', 'level2_id', ...TAXONOMY_LABELS]),
  taxonomy_level4: Object.freeze(['id', 'level3_id', ...TAXONOMY_LABELS]),
  // Nur aus der öffentlichen Ansicht, nie aus profiles. Kein Name, kein
  // Profiltext, keine Kontaktdaten, keine Paketstufe.
  public_teacher_profiles: Object.freeze(['id', 'city', 'canton', 'verification_status']),
});

/**
 * Felder, die nie übernommen werden dürfen (zusätzliche Sperre zur
 * Positivliste; private, kommerzielle oder Kontaktangaben).
 */
export const FORBIDDEN_FIELDS = Object.freeze([
  'contact_email', 'external_link', 'provider_url', 'ticket_limit_30d', 'plan_tier', 'is_pro', 'rating',
  'email', 'phone', 'full_name', 'bio', 'bio_text', 'website_url', 'lead_email', 'public_contact_email',
  'stripe_customer_id', 'stripe_connect_account_id', 'credit_balance_cents', 'package_tier',
  'package_expires_at', 'certificates', 'logo_url', 'additional_locations', 'show_email_publicly',
]);

/** Profilspalten, die der Import im TEST setzt (alles andere bleibt Standard). */
export const PROFILE_INSERT_FIELDS = Object.freeze([
  'id', 'role', 'full_name', 'slug', 'city', 'canton', 'verification_status', 'package_tier',
  'package_expires_at', 'email',
]);

export function inAcceptanceRange(id) {
  const n = Number(id);
  return Number.isInteger(n) && n >= ACCEPTANCE_RANGE.min && n <= ACCEPTANCE_RANGE.max;
}

/**
 * Art eines Supabase-Schlüssels, ohne ihn zu prüfen oder auszugeben.
 * 'publishable' = öffentlicher Schlüssel (sb_publishable_… oder JWT mit
 * Rolle anon), 'secret' = Dienstschlüssel. Der Export akzeptiert nur
 * 'publishable': Er sieht damit technisch nur, was jede Besucherin sieht.
 */
export function classifySupabaseKey(rawKey) {
  const key = String(rawKey ?? '').trim();
  if (!key) return 'missing';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('sb_secret_')) return 'secret';
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      if (payload?.role === 'anon') return 'publishable';
      if (payload?.role === 'service_role') return 'secret';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

function pick(row, fields) {
  const out = {};
  for (const field of fields) out[field] = row?.[field] ?? null;
  return out;
}

/**
 * Prüft einen gelesenen Katalogstand vor jeder Verwendung.
 * @returns {{ok: boolean, errors: string[], counts: object}}
 */
export function validateSnapshot(snapshot) {
  const errors = [];
  const tables = ['courses', 'course_events', 'course_locations', 'course_category_assignments', 'public_teacher_profiles', ...TAXONOMY_TABLES];
  for (const table of tables) {
    const rows = snapshot?.[table];
    if (!Array.isArray(rows)) { errors.push(`${table}: fehlt`); continue; }
    const allowed = new Set(EXPORT_FIELDS[table]);
    for (const row of rows) {
      for (const key of Object.keys(row ?? {})) {
        if (FORBIDDEN_FIELDS.includes(key)) errors.push(`${table}: gesperrtes Feld ${key}`);
        else if (!allowed.has(key)) errors.push(`${table}: Feld ${key} nicht in der Positivliste`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)].slice(0, 50), counts: {} };

  const courseIds = new Set();
  for (const course of snapshot.courses) {
    const id = Number(course.id);
    if (course.status !== 'published') errors.push(`Kurs ${course.id}: Status ${course.status} (nur published erlaubt)`);
    if (!Number.isInteger(id) || id < 1 || id > MAX_SOURCE_ID) errors.push(`Kurs ${course.id}: ID ausserhalb 1–${MAX_SOURCE_ID}`);
    if (courseIds.has(id)) errors.push(`Kurs ${course.id}: doppelt`);
    courseIds.add(id);
  }
  if (courseIds.size === 0) errors.push('keine veröffentlichten Kurse gelesen');

  for (const table of ['course_events', 'course_locations', 'course_category_assignments']) {
    for (const row of snapshot[table]) {
      if (!courseIds.has(Number(row.course_id))) errors.push(`${table}: Kurs ${row.course_id} ist nicht im Export`);
    }
  }
  const l3 = new Set(snapshot.taxonomy_level3.map((r) => Number(r.id)));
  const l4 = new Set(snapshot.taxonomy_level4.map((r) => Number(r.id)));
  for (const row of snapshot.course_category_assignments) {
    if (!l3.has(Number(row.level3_id))) errors.push(`Zuordnung Kurs ${row.course_id}: Stufe 3 ${row.level3_id} unbekannt`);
    if (row.level4_id !== null && row.level4_id !== undefined && !l4.has(Number(row.level4_id))) {
      errors.push(`Zuordnung Kurs ${row.course_id}: Stufe 4 ${row.level4_id} unbekannt`);
    }
  }
  for (const course of snapshot.courses) {
    if (course.category_level3_id != null && !l3.has(Number(course.category_level3_id))) errors.push(`Kurs ${course.id}: Stufe 3 ${course.category_level3_id} unbekannt`);
    if (course.category_level4_id != null && !l4.has(Number(course.category_level4_id))) errors.push(`Kurs ${course.id}: Stufe 4 ${course.category_level4_id} unbekannt`);
  }

  const providerIds = new Set(snapshot.courses.map((c) => c.user_id).filter(Boolean));
  const publicProviders = snapshot.public_teacher_profiles.filter((p) => providerIds.has(p.id));
  return {
    ok: errors.length === 0,
    errors: errors.slice(0, 50),
    counts: {
      courses: snapshot.courses.length,
      events: snapshot.course_events.length,
      locations: snapshot.course_locations.length,
      assignments: snapshot.course_category_assignments.length,
      providers: providerIds.size,
      providersPublic: publicProviders.length,
      coursesWithoutProvider: snapshot.courses.filter((c) => !c.user_id).length,
      maxCourseId: Math.max(0, ...courseIds),
    },
  };
}

/** Nicht umkehrbare, stabile Pseudonym-UUID (v4-Format) je Anbieter und Lauf. */
export function pseudonymUuid(secret, sourceId) {
  if (!secret || String(secret).length < 16) throw new Error('Pseudonym-Schlüssel fehlt oder ist zu kurz');
  const bytes = createHmac('sha256', String(secret)).update(String(sourceId)).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Wandelt einen geprüften Katalogstand in die Zeilen für den TEST-Import.
 * Anbieter werden nach ihrer kleinsten Kurs-ID nummeriert (001, 002, …).
 * Nicht öffentlich sichtbare Anbieter (nicht in der Ansicht) bekommen eine
 * Profilzeile ohne Rolle teacher, damit sie wie in Produktion keine
 * Anbieterangaben im Index haben.
 */
export function buildImportRows(snapshot, { secret }) {
  const firstCourse = new Map();
  for (const course of [...snapshot.courses].sort((a, b) => Number(a.id) - Number(b.id))) {
    if (course.user_id && !firstCourse.has(course.user_id)) firstCourse.set(course.user_id, Number(course.id));
  }
  const publicById = new Map(snapshot.public_teacher_profiles.map((p) => [p.id, p]));
  const providerOrder = [...firstCourse.keys()];
  const pseudonyms = new Map();
  const profiles = providerOrder.map((sourceId, index) => {
    const number = String(index + 1).padStart(3, '0');
    const id = pseudonymUuid(secret, sourceId);
    pseudonyms.set(sourceId, id);
    const visible = publicById.get(sourceId) ?? null;
    return {
      id,
      role: visible ? 'teacher' : 'student',
      full_name: `${PROVIDER_NAME_PREFIX}${number}`,
      slug: `${PROVIDER_SLUG_PREFIX}${number}`,
      city: visible?.city ?? null,
      canton: visible?.canton ?? null,
      verification_status: visible?.verification_status ?? null,
      package_tier: 'basic',
      package_expires_at: null,
      email: null,
    };
  });

  const courseFields = EXPORT_FIELDS.courses.filter((f) => f !== 'status');
  const courses = snapshot.courses.map((course) => ({
    ...pick(course, courseFields),
    id: Number(course.id) + ID_OFFSET,
    user_id: course.user_id ? pseudonyms.get(course.user_id) : null,
    status: 'published',
    is_prio: false,
  }));
  const shift = (table) => snapshot[table].map((row) => ({
    ...pick(row, EXPORT_FIELDS[table]),
    course_id: Number(row.course_id) + ID_OFFSET,
  }));
  return {
    profiles,
    courses,
    course_events: shift('course_events'),
    course_locations: shift('course_locations'),
    course_category_assignments: shift('course_category_assignments'),
  };
}

/**
 * Vergleicht die Taxonomie aus Produktion mit dem TEST-Stand.
 * missing: in Produktion vorhanden, im TEST nicht (wird ergänzt);
 * differing: gleiche ID, anderer Inhalt (Abbruchgrund, weil sonst
 * Kategoriepfade im Index von Produktion abweichen).
 */
export function diffTaxonomy(source, target) {
  const missing = {};
  const differing = {};
  for (const table of TAXONOMY_TABLES) {
    const fields = EXPORT_FIELDS[table];
    const targetById = new Map((target?.[table] ?? []).map((row) => [Number(row.id), row]));
    missing[table] = [];
    differing[table] = [];
    for (const row of source?.[table] ?? []) {
      const existing = targetById.get(Number(row.id));
      if (!existing) missing[table].push(pick(row, fields));
      else if (JSON.stringify(pick(existing, fields)) !== JSON.stringify(pick(row, fields))) differing[table].push(Number(row.id));
    }
  }
  return { missing, differing };
}

export function textMd5(text) {
  return createHash('md5').update(String(text ?? ''), 'utf8').digest('hex');
}

export function chunkKey(row) {
  return `${row.course_id}|${row.section}|${row.chunk_index}`;
}

/**
 * Sicherung des bisherigen Testbestands vor dem Austausch (S3).
 * Enthält keine Kurstexte: nur IDs, Status, Prüfsummen, Abschnittsschlüssel
 * mit Text-md5 und die Embeddings (für einen Rückweg ohne Modellaufruf).
 */
export function buildBackup({ courses, documents, chunks, activeModelVersion, createdAt }) {
  const backup = {
    format: 'ai-search-acceptance-backup@1',
    project: TEST_REF,
    createdAt,
    activeModelVersion: activeModelVersion ?? null,
    // Kurse mit höherer ID sind nach der Sicherung entstanden (z. B. CI-Seed).
    maxCourseId: Math.max(0, ...courses.map((c) => Number(c.id))),
    publishedCourseIds: courses.filter((c) => c.status === 'published').map((c) => Number(c.id)).sort((a, b) => a - b),
    documents: documents.map((d) => ({ course_id: Number(d.course_id), content_hash: d.content_hash }))
      .sort((a, b) => a.course_id - b.course_id),
    chunks: chunks.map((c) => ({
      key: chunkKey(c),
      text_md5: textMd5(c.text),
      model_version: c.model_version ?? null,
      embedding: c.embedding ?? null,
    })).sort((a, b) => a.key.localeCompare(b.key)),
  };
  backup.counts = {
    publishedCourses: backup.publishedCourseIds.length,
    documents: backup.documents.length,
    chunks: backup.chunks.length,
    chunksEmbedded: backup.chunks.filter((c) => c.embedding).length,
  };
  return backup;
}

export function backupChecksum(backup) {
  const { checksum, ...rest } = backup ?? {};
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex');
}

export function sealBackup(backup) {
  return { ...backup, checksum: backupChecksum(backup) };
}

export function verifyBackup(backup) {
  if (backup?.format !== 'ai-search-acceptance-backup@1') return { ok: false, reason: 'unbekanntes Format' };
  if (backup.project !== TEST_REF) return { ok: false, reason: 'Sicherung gehört nicht zur TESTumgebung' };
  if (backup.checksum !== backupChecksum(backup)) return { ok: false, reason: 'Prüfsumme stimmt nicht' };
  return { ok: true, reason: null };
}

/**
 * Vergleicht den aktuellen Index mit der Sicherung (Rückweg, S11).
 * Erwartet: gleiche Dokumente, gleiche Inhalts-Prüfsummen, gleiche
 * Abschnittsschlüssel mit gleichem Text.
 *
 * `ignoreCourseIds`: Kurse, die nach der Sicherung von aussen entstanden oder
 * gelöscht wurden (die CI schreibt in dieselbe TESTumgebung). Sie werden
 * nicht als Abweichung gezählt, sondern vom Aufrufer gesondert ausgewiesen.
 */
export function compareIndexToBackup(backup, documents, chunks, { ignoreCourseIds = [] } = {}) {
  const ignore = new Set([...ignoreCourseIds].map(Number));
  const courseOfKey = (key) => Number(String(key).split('|')[0]);
  const expectedDocs = new Map(backup.documents.filter((d) => !ignore.has(d.course_id)).map((d) => [d.course_id, d.content_hash]));
  const actualDocs = new Map(documents.filter((d) => !ignore.has(Number(d.course_id))).map((d) => [Number(d.course_id), d.content_hash]));
  const missingDocs = [...expectedDocs.keys()].filter((id) => !actualDocs.has(id));
  const extraDocs = [...actualDocs.keys()].filter((id) => !expectedDocs.has(id));
  const hashMismatch = [...expectedDocs.keys()].filter((id) => actualDocs.has(id) && actualDocs.get(id) !== expectedDocs.get(id));
  const expectedChunks = new Map(backup.chunks.filter((c) => !ignore.has(courseOfKey(c.key))).map((c) => [c.key, c.text_md5]));
  const actualChunks = new Map(chunks.filter((c) => !ignore.has(Number(c.course_id))).map((c) => [chunkKey(c), textMd5(c.text)]));
  const missingChunks = [...expectedChunks.keys()].filter((k) => !actualChunks.has(k));
  const extraChunks = [...actualChunks.keys()].filter((k) => !expectedChunks.has(k));
  const textMismatch = [...expectedChunks.keys()].filter((k) => actualChunks.has(k) && actualChunks.get(k) !== expectedChunks.get(k));
  const total = missingDocs.length + extraDocs.length + hashMismatch.length + missingChunks.length + extraChunks.length + textMismatch.length;
  return { ok: total === 0, missingDocs, extraDocs, hashMismatch, missingChunks, extraChunks, textMismatch };
}

/**
 * Welche gesicherten Embeddings können ohne Modellaufruf zurückgeschrieben
 * werden? Nur bei gleichem Schlüssel UND gleichem Text (md5). Alles andere
 * bleibt offen und wird mit dem bestehenden Embedding-Skript nachgeholt.
 */
export function planEmbeddingRestore(backup, currentChunks) {
  const byKey = new Map(backup.chunks.map((c) => [c.key, c]));
  const updates = [];
  const unmatched = [];
  for (const chunk of currentChunks) {
    const saved = byKey.get(chunkKey(chunk));
    if (saved?.embedding && saved.text_md5 === textMd5(chunk.text) && saved.model_version) {
      if (chunk.model_version !== saved.model_version || chunk.embedding == null) {
        updates.push({ id: chunk.id, embedding: saved.embedding, model_version: saved.model_version });
      }
    } else {
      unmatched.push(chunkKey(chunk));
    }
  }
  return { updates, unmatched };
}

/** Kurz-Prüfsumme über die Importzeilen (fürs Protokoll, ohne Inhalte). */
export function importFingerprint(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
}
