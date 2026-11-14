/**
 * Projektions-Builder: Kern des Index-Workers (S02).
 *
 * Baut aus einer Kurs-Quellzeile (plus zulässigen Anbieter-/Kategoriedaten)
 * deterministisch den Eintrag für ai_search_documents und die Chunkliste für
 * ai_search_chunks — rein, ohne Datenbank, lokal testbar. Der spätere Worker
 * (Vercel-Cron nach api/cron*-Muster) ruft diese Funktionen je Job auf und
 * schreibt nur, wenn source_version neuer ist (Out-of-order-Schutz in SQL).
 *
 * Invarianten (Datenvertrag §1/§2):
 *  - Nur öffentlich durchsuchbare Kurse (isPubliclySearchable) ergeben eine
 *    Projektion; alles andere ergibt eine Löschanweisung.
 *  - Nur erlaubte Felder; contact_email, Lead-/Paketdaten u. ä. erscheinen
 *    weder im Dokument noch in Chunks.
 *  - content_hash ist stabil über die kanonischen Quellfelder: gleicher
 *    Inhalt ⇒ gleicher Hash (idempotente Jobs erkennen No-ops).
 */

import { isPubliclySearchable } from './publication.js';
import { derivePriceStatus } from './priceStatus.js';
import { cleanText, buildCourseChunks } from './chunking.js';

/** FNV-1a 64-bit als hex — deterministisch, ohne Abhängigkeiten. */
export function contentHash(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input ?? null);
  let hashHigh = 0xcbf29ce4;
  let hashLow = 0x84222325;
  for (let i = 0; i < text.length; i += 1) {
    hashLow ^= text.charCodeAt(i);
    // 64-bit FNV-Prime-Multiplikation in zwei 32-bit Hälften:
    const low = (hashLow & 0xffff) * 0x1b3 + (((hashLow >>> 16) * 0x1b3) << 16);
    const high = (hashHigh * 0x1b3 + ((hashLow * 0x100) >>> 0)) >>> 0;
    hashLow = low >>> 0;
    hashHigh = high;
  }
  return `${hashHigh.toString(16).padStart(8, '0')}${(hashLow >>> 0).toString(16).padStart(8, '0')}`;
}

/** Zulässige öffentliche Anbieterfelder (Datenvertrag §2). */
const PROFILE_FIELDS = ['slug', 'city', 'canton', 'verification_status', 'bio_text'];

/**
 * Baut die Suchprojektion eines Kurses.
 *
 * @param {object} course - Kurszeile inkl. course_events/course_locations
 * @param {{profile?: object, categoryPaths?: Array}} [context]
 * @param {{sourceVersion?: number, allowLegacyNullStatus?: boolean,
 *          chunkOptions?: object}} [options]
 * @returns {{action: 'upsert', document: object, chunks: Array} |
 *           {action: 'delete', courseId: any, reason: string}}
 */
export function buildProjection(course, context = {}, options = {}) {
  if (!course || course.id === undefined || course.id === null) {
    return { action: 'delete', courseId: course?.id ?? null, reason: 'missing_source' };
  }
  if (!isPubliclySearchable(course, { allowLegacyNullStatus: options.allowLegacyNullStatus === true })) {
    // Entwürfe/zurückgezogene Kurse: Projektion und Chunks entfernen.
    return { action: 'delete', courseId: course.id, reason: 'not_public' };
  }

  const priceStatus = derivePriceStatus(course);
  const profile = context.profile ?? null;

  const facts = {
    level: course.level ?? null,
    languages: Array.isArray(course.languages) && course.languages.length > 0
      ? course.languages
      : (course.language ? [course.language] : []),
    delivery_types: course.delivery_types ?? (course.delivery_type ? [course.delivery_type] : []),
    target_age_groups: course.target_age_groups ?? null,
    min_age: course.min_age ?? null,
    target_group: course.target_group ?? null,
    session_count: course.session_count ?? null,
    session_length: course.session_length ?? null,
    booking_type: course.booking_type ?? null,
    canton: course.canton ?? null,
    locations: (Array.isArray(course.course_locations) ? course.course_locations : [])
      .map((loc) => ({ city: loc.city ?? null, canton: loc.canton ?? null, type: loc.location_type ?? null })),
    category_paths: context.categoryPaths ?? null,
    provider: profile
      ? Object.fromEntries(PROFILE_FIELDS.map((field) => [field, profile[field] ?? null]))
      : null,
  };

  const chunks = buildCourseChunks(course, options.chunkOptions);

  // Kanonischer Inhalt fuer den Versionshash: alles, was Dokument oder
  // Chunks beeinflusst. Events sind autoritativ getrennt, beeinflussen aber
  // die Frische (Jobausloesung), nicht den Dokumenthash.
  const canonical = {
    id: course.id,
    title: course.title ?? '',
    description: cleanText(course.description),
    facts,
    priceStatus,
    sections: chunks.map((chunk) => [chunk.section, chunk.chunkIndex, chunk.text]),
  };
  const hash = contentHash(canonical);
  const sourceVersion = Number.isFinite(options.sourceVersion) ? options.sourceVersion : 0;

  return {
    action: 'upsert',
    document: {
      course_id: course.id,
      title: course.title ?? '',
      description_clean: cleanText(course.description),
      facts,
      price_status: priceStatus.status,
      price_amount: priceStatus.amount,
      content_hash: hash,
      source_version: sourceVersion,
    },
    chunks: chunks.map((chunk) => ({
      course_id: course.id,
      section: chunk.section,
      chunk_index: chunk.chunkIndex,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
      text: chunk.text,
      content_hash: hash,
      source_version: sourceVersion,
    })),
  };
}
