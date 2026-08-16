/**
 * Prerender-Quelle für öffentliche Kursdetailseiten und Anbieterprofile.
 *
 * Hintergrund (SEO-Blocker 2 des technischen Audits):
 *   scripts/prerender-static.mjs erzeugte statische HTML-Dateien nur für
 *   Konfigurations- und Themenwelt-Routen. /courses/… und /anbieter/… fielen in
 *   den Catch-all-Rewrite auf dist/index.html — der erste HTTP-Response war für
 *   ca. 476 Kurse und ca. 21 Anbieterprofile die generische SPA-Shell. Title,
 *   Description, Canonical, og:url und JSON-LD entstanden erst nach der
 *   React-Hydration.
 *
 * Architektur — bewusst dieselbe wie beim DB-Themenwelt-Prerender (PR #100):
 *   Build lädt öffentliche Daten über das öffentliche Supabase-Paar, baut
 *   Routen und schreibt pro Route eine index.html.
 *
 * PUBLIC-GATES (die Sitemap ist die Wahrheit, nicht eine neue Regel):
 *   Kurse     — status = 'published' ODER status IS NULL (Legacy). Belegt durch
 *               api/sitemap.js (.or('status.eq.published,status.is.null')) und
 *               den öffentlichen Client-Filter in App.jsx
 *               (`c.status === 'published' || !c.status`). 'draft' und 'paused'
 *               (CHECK-Constraint in 20250130_add_course_status.sql) sind damit
 *               ausgeschlossen, ebenso jeder andere unbekannte Status.
 *   Anbieter  — profile_published_at IS NOT NULL UND slug IS NOT NULL UND
 *               package_tier in (pro, premium, enterprise) UND mindestens ein
 *               öffentlicher Kurs. Exakt die Bedingungen aus api/sitemap.js.
 *
 * KANONISCHE URL:
 *   Ausschliesslich buildCanonicalCoursePath() aus src/lib/courseUrl.js — keine
 *   zweite Slug-Logik. Kategorien kommen wie bei Sitemap und Client aus
 *   v_course_full_categories (api/_lib/course-categories.js).
 *
 * SEO-WAHRHEIT:
 *   src/lib/courseSeo.js und src/lib/providerSeo.js. Dieselben reinen
 *   Funktionen nutzen DetailView.jsx und ProviderProfilePage.jsx nach der
 *   Hydration — Server-HTML und React können deshalb nicht auseinanderlaufen.
 *
 * FAIL-SAFE (siehe auch scripts/prerender-static.mjs):
 *   SYSTEMISCHER DB-FEHLER      → CoursePrerenderError, Build bricht ab.
 *     Dazu zählt auch eine nicht auflösbare Kategorie-Abfrage: sie würde
 *     hunderte Kurse still verlieren oder deren URL raten lassen.
 *   EIN UNGÜLTIGER EINZELDATENSATZ → Warnung, Datensatz wird übersprungen.
 *     Nur wenn dadurch garantiert keine falsche URL/SEO-Seite entsteht
 *     (fehlende ID, fehlender Titel/Name, fehlender Slug, unerwartetes
 *     Pfadformat).
 */

import { buildCanonicalCoursePath } from '../../src/lib/courseUrl.js';
import { buildCourseJsonLdList, buildCourseSeo } from '../../src/lib/courseSeo.js';
import {
  PUBLIC_PROFILE_TIERS,
  buildProviderJsonLdList,
  buildProviderSeo,
  mapProfileRowToPublicProvider,
} from '../../src/lib/providerSeo.js';
import { attachPrimaryCategories, fetchCourseCategoryRows } from './course-categories.js';

/** Fehler, der einen Build kontrolliert scheitern lässt. */
export class CoursePrerenderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CoursePrerenderError';
    this.cause = cause;
  }
}

/** Seitengrösse für paginierte Abfragen (PostgREST liefert max. 1000 Zeilen). */
const PAGE_SIZE = 500;

/** Supabase `.in()` nicht mit beliebig vielen IDs auf einmal belasten. */
const ID_CHUNK_SIZE = 200;

/**
 * Erwartetes Format eines kanonischen Kurspfads.
 * Defense in Depth: der Pfad wird in einen Dateipfad und eine URL geschrieben.
 */
const CANONICAL_COURSE_PATH = /^\/courses\/[a-z0-9-]+\/[a-z0-9-]+\/[A-Za-z0-9][A-Za-z0-9-]*$/;

/** Erwartetes Format eines Anbieter-Slugs (siehe validate-slug in api/provider.js). */
const SAFE_PROVIDER_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Ist der Kurs-/Anbieter-Prerender aktiviert?
 *
 * Standard: AN. Der Prerender ist die einzige Stelle, die diesen URL-Familien
 * überhaupt seitenspezifisches Erst-HTML gibt — ein Opt-in würde bei fehlender
 * Konfiguration still den gesamten SEO-Effekt verlieren. Abschalten deshalb nur
 * explizit über VITE_COURSE_PRERENDER_ENABLED='false'.
 *
 * @param {object} [env=process.env]
 * @returns {boolean}
 */
export function isCoursePrerenderEnabled(env = process.env) {
  return env?.VITE_COURSE_PRERENDER_ENABLED !== 'false';
}

/**
 * Liest das öffentliche Supabase-Paar aus der Umgebung.
 *
 * Bewusst KEINE Fallback-Kette: URL und Key müssen aus derselben
 * Konfigurationsfamilie stammen (sonst «Invalid API key»), und der Prerender
 * soll exakt die Inhalte sehen, die RLS auch einem anonymen Besucher freigibt.
 * Service-Role-Rechte würden Entwürfe sichtbar machen und sind hier verboten.
 *
 * @param {object} [env=process.env]
 * @returns {{url: string|null, key: string|null, missing: string[]}}
 */
export function readPublicSupabaseCredentials(env = process.env) {
  const url = env?.VITE_SUPABASE_URL || null;
  const key = env?.VITE_SUPABASE_KEY || null;
  const missing = [
    url ? null : 'VITE_SUPABASE_URL',
    key ? null : 'VITE_SUPABASE_KEY',
  ].filter(Boolean);
  return { url, key, missing };
}

/**
 * Führt eine paginierte Select-Abfrage aus.
 *
 * Ohne Pagination würde PostgREST stillschweigend nach 1000 Zeilen abschneiden
 * — bei ca. 476 Kursen mit ihren Terminen ist das erreichbar, und ein stilles
 * Abschneiden wäre genau der Verlust, den dieser PR verhindern soll.
 *
 * @param {string} label - Für Fehlermeldungen
 * @param {(from: number, to: number) => Promise<{data: any[]|null, error: any}>} run
 * @returns {Promise<any[]>}
 * @throws {CoursePrerenderError}
 */
async function fetchAllPages(label, run) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let result;
    try {
      result = await run(offset, offset + PAGE_SIZE - 1);
    } catch (e) {
      throw new CoursePrerenderError(`${label} fehlgeschlagen: ${e?.message || e}`, e);
    }
    if (result?.error) {
      throw new CoursePrerenderError(
        `${label} konnte nicht geladen werden: ${result.error.message || result.error}`,
        result.error
      );
    }
    const page = result?.data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** PostgREST-Code für «Spalte existiert nicht». */
const UNDEFINED_COLUMN = '42703';

/**
 * Wie fetchAllPages(), aber tolerant gegenüber optionalen Spalten.
 *
 * Manche Spalten sind für den anonymen Lesezugriff nicht verfügbar — sei es,
 * weil die Migration in dieser Umgebung noch nicht gelaufen ist, sei es wegen
 * spaltenweiser Rechte. PostgREST meldet beides als 42703. Solche Spalten
 * reichern die strukturierten Daten nur an; ihr Fehlen darf nicht hunderte
 * SEO-Seiten kosten. Deshalb: EINMAL mit dem Kernspaltensatz nachladen und laut
 * warnen. Jeder andere Fehler bleibt systemisch und bricht den Build ab.
 *
 * Die Parität zur hydratisierten Seite bleibt dabei erhalten: ein anonymer
 * Besucher sieht dieselben Spalten nicht.
 *
 * @param {string} label
 * @param {string} coreColumns
 * @param {string} optionalColumns
 * @param {(columns: string) => (from: number, to: number) => Promise<object>} queryFactory
 * @param {object} [logger=console]
 * @returns {Promise<any[]>}
 */
async function fetchAllPagesTolerant(label, coreColumns, optionalColumns, queryFactory, logger = console) {
  try {
    return await fetchAllPages(label, queryFactory(`${coreColumns}, ${optionalColumns}`));
  } catch (e) {
    if (e?.cause?.code !== UNDEFINED_COLUMN) throw e;
    logger?.warn?.(
      `[prerender] Optionale Spalten für ${label} nicht verfügbar (${e.cause.message}) — ` +
        'die betroffenen Seiten entstehen ohne diese Zusatzangaben.'
    );
    return fetchAllPages(label, queryFactory(coreColumns));
  }
}

/**
 * Lädt alle öffentlich sichtbaren Kurse inklusive semantischer Kategorien und
 * Termine.
 *
 * Bewusst wenige Abfragen statt einer pro Kurs:
 *   1x courses (paginiert)
 *   1x v_course_full_categories pro 200er-Block
 *   1x course_events pro 200er-Block (paginiert)
 *
 * `bookings` wird NICHT mitgeladen: RLS gibt anonym keine Buchungen frei, ein
 * anonymer Besucher sieht also ebenfalls keine — die abgeleitete Verfügbarkeit
 * ist damit im Prerender und nach der Hydration identisch.
 *
 * @param {object} supabase
 * @param {object} [options]
 * @param {object} [options.logger=console]
 * @returns {Promise<object[]>}
 * @throws {CoursePrerenderError} bei jedem systemischen DB-Fehler
 */
export async function fetchPublicCourses(supabase, { logger = console } = {}) {
  if (!supabase) {
    throw new CoursePrerenderError('Kein Supabase-Client für den Kurs-Prerender verfügbar.');
  }

  const courses = await fetchAllPages('Öffentliche Kurse', (from, to) =>
    supabase
      .from('courses')
      .select(
        // Nur die Felder für kanonische URL, SEO-Texte und strukturierte Daten.
        // `city` steht bewusst NICHT hier: die Spalte existiert nicht (sie hiess
        // einmal location_city und wurde mit course_locations entfernt).
        // courseSeo.js liest course.city trotzdem als Zwischenstufe der
        // Ortskette — exakt wie DetailView.jsx, wo der Wert ebenfalls
        // undefined ist.
        'id, title, description, canton, address, image_url, price, booking_type, ' +
          'session_length, session_count, instructor_name, user_id, status, start_date, ' +
          'category_type, category_area, category_specialty, category_focus, created_at'
      )
      // Identisch zur Sitemap: veröffentlicht ODER Legacy-Datensatz ohne Status.
      .or('status.eq.published,status.is.null')
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  // Zweite Prüfung im Code — falls ein Backend den Query-Filter ignoriert, darf
  // ein Entwurf trotzdem keine indexierbare Datei bekommen.
  const publicCourses = (courses || []).filter(
    (course) => course && (course.status === 'published' || !course.status)
  );

  if (publicCourses.length === 0) return [];

  const courseIds = publicCourses.map((course) => course.id);

  // Kategorien — dieselbe Quelle wie Sitemap und Client.
  const { byCourseId, unresolvedIds } = await fetchCourseCategoryRows(supabase, courseIds);
  if (unresolvedIds.size > 0) {
    // Nicht überspringen: das wären hunderte fehlende oder geratene URLs.
    throw new CoursePrerenderError(
      `Kategorien für ${unresolvedIds.size} Kurs(e) konnten nicht geladen werden. ` +
        'Der Build wird abgebrochen, damit keine Kurs-URL geraten wird und keine ' +
        'öffentlichen Kursseiten still ohne SEO-Daten deployen.'
    );
  }

  const eventsByCourseId = await fetchCourseEvents(supabase, courseIds, logger);

  logger?.log?.(
    `  → ${publicCourses.length} öffentliche Kurse geladen (${eventsByCourseId.size} mit Terminen).`
  );

  return attachPrimaryCategories(publicCourses, byCourseId).map((course) => ({
    ...course,
    course_events: eventsByCourseId.get(course.id) || [],
  }));
}

/** Termin-Spalten, ohne die EducationEvent/Verfügbarkeit nicht bestimmbar sind. */
const EVENT_CORE_COLUMNS = 'course_id, start_date, max_participants, cancelled_at';

/** `end_date` ist für den anonymen Lesezugriff nicht überall verfügbar. */
const EVENT_OPTIONAL_COLUMNS = 'end_date';

/** Lädt die Termine der angegebenen Kurse, gruppiert nach Kurs-ID. */
async function fetchCourseEvents(supabase, courseIds, logger = console) {
  const byCourseId = new Map();

  for (let offset = 0; offset < courseIds.length; offset += ID_CHUNK_SIZE) {
    const chunk = courseIds.slice(offset, offset + ID_CHUNK_SIZE);
    const rows = await fetchAllPagesTolerant(
      'Kurstermine',
      EVENT_CORE_COLUMNS,
      EVENT_OPTIONAL_COLUMNS,
      (columns) => (from, to) =>
        supabase
          .from('course_events')
          .select(columns)
          .in('course_id', chunk)
          .order('start_date', { ascending: true })
          .range(from, to),
      logger
    );

    for (const row of rows) {
      const list = byCourseId.get(row.course_id) || [];
      list.push(row);
      byCourseId.set(row.course_id, list);
    }
  }

  return byCourseId;
}

/** Pflichtspalten eines Anbieterprofils — ohne sie ist keine SEO-Seite möglich. */
const PROVIDER_CORE_COLUMNS =
  'id, full_name, slug, bio_text, logo_url, website_url, city, canton, ' +
  'package_tier, profile_published_at';

/**
 * Zusätzliche Spalten, die das JSON-LD anreichern, aber je nach Migrationsstand
 * fehlen können. api/provider.js hält für genau diese Spalten seit jeher eine
 * Fallback-Abfrage vor.
 */
const PROVIDER_OPTIONAL_COLUMNS =
  'phone, street, social_linkedin, social_instagram, social_facebook, social_youtube';

/**
 * Lädt alle öffentlich indexierbaren Anbieterprofile.
 *
 * Die Gates entsprechen exakt api/sitemap.js. Die «mindestens ein öffentlicher
 * Kurs»-Bedingung wird aus der bereits geladenen Kursmenge abgeleitet — keine
 * zusätzliche Abfrage.
 *
 * Fehlt eine der optionalen Spalten, wird EINMAL mit dem Kernspaltensatz
 * nachgeladen (siehe fetchAllPagesTolerant): das JSON-LD verliert dann
 * Telefonnummer, Strasse und sameAs-Links, aber es gehen keine 21 SEO-Seiten
 * verloren. Jeder andere Fehler bleibt systemisch und bricht den Build ab.
 *
 * @param {object} supabase
 * @param {object} options
 * @param {Set<string>} options.publicCourseOwnerIds - user_id aller öffentlichen Kurse
 * @param {object} [options.logger=console]
 * @returns {Promise<object[]>} Zeilen aus `profiles`
 * @throws {CoursePrerenderError}
 */
export async function fetchPublicProviders(
  supabase,
  { publicCourseOwnerIds, logger = console } = {}
) {
  if (!supabase) {
    throw new CoursePrerenderError('Kein Supabase-Client für den Anbieter-Prerender verfügbar.');
  }

  const rows = await fetchAllPagesTolerant(
    'Öffentliche Anbieterprofile',
    PROVIDER_CORE_COLUMNS,
    PROVIDER_OPTIONAL_COLUMNS,
    (columns) => (from, to) =>
      supabase
        .from('profiles')
        .select(columns)
        .not('profile_published_at', 'is', null)
        .not('slug', 'is', null)
        .in('package_tier', PUBLIC_PROFILE_TIERS)
        .range(from, to),
    logger
  );

  const owners = publicCourseOwnerIds || new Set();
  const eligible = (rows || []).filter((row) => {
    // Zweite Prüfung im Code — Gate darf nicht allein an der Query hängen.
    const tier = String(row?.package_tier || 'basic').toLowerCase();
    if (!PUBLIC_PROFILE_TIERS.includes(tier)) return false;
    if (!row?.profile_published_at || !row?.slug) return false;
    // Sitemap-Regel: nur Anbieter mit mindestens einem öffentlichen Kurs.
    return owners.has(row.id);
  });

  logger?.log?.(
    `  → ${eligible.length} von ${rows.length} publizierten Profilen erfüllen alle Public-Gates.`
  );

  return eligible;
}

/**
 * Bildet öffentliche Kurse auf Prerender-Routen ab.
 *
 * @param {object} params
 * @param {object[]} params.courses
 * @param {string} params.baseUrl
 * @param {object} [params.logger=console]
 * @returns {Array<{path: string, kind: 'course'}>}
 */
export function buildCoursePrerenderRoutes({ courses = [], baseUrl, logger = console }) {
  const routes = [];
  const seenPaths = new Set();

  for (const course of courses) {
    // --- Einzeldatensatz-Prüfungen: überspringen statt Build abbrechen ---
    if (!course || course.id === null || course.id === undefined || course.id === '') {
      logger?.warn?.('[prerender] Kurs übersprungen — kein verwertbarer Datensatz (fehlende ID).');
      continue;
    }
    if (!String(course.title || '').trim()) {
      logger?.warn?.(
        `[prerender] Kurs ${course.id} übersprungen — kein Titel, Slug und SEO-Titel wären leer.`
      );
      continue;
    }

    const path = buildCanonicalCoursePath(course);
    if (!CANONICAL_COURSE_PATH.test(path)) {
      logger?.warn?.(
        `[prerender] Kurs ${course.id} übersprungen — unerwartetes Pfadformat: ${path}`
      );
      continue;
    }
    if (seenPaths.has(path)) {
      logger?.warn?.(`[prerender] Kurs ${course.id} übersprungen — Pfad bereits vergeben: ${path}`);
      continue;
    }
    seenPaths.add(path);

    const seo = buildCourseSeo(course, baseUrl);
    routes.push({
      path,
      kind: 'course',
      title: seo.title,
      description: seo.description,
      ogTitle: seo.ogTitle,
      ogDescription: seo.ogDescription,
      ogType: seo.ogType,
      ogImage: seo.ogImage,
      jsonLd: buildCourseJsonLdList(course, baseUrl),
    });
  }

  return routes;
}

/**
 * Bildet öffentliche Anbieterprofile auf Prerender-Routen ab.
 *
 * @param {object} params
 * @param {object[]} params.providers - Zeilen aus `profiles`
 * @param {string} params.baseUrl
 * @param {object} [params.logger=console]
 * @returns {Array<{path: string, kind: 'provider'}>}
 */
export function buildProviderPrerenderRoutes({ providers = [], baseUrl, logger = console }) {
  const routes = [];
  const seenSlugs = new Set();

  for (const row of providers) {
    if (!row || !SAFE_PROVIDER_SLUG.test(String(row.slug || ''))) {
      logger?.warn?.(
        `[prerender] Anbieterprofil übersprungen — unerwartetes Slug-Format: ${row?.slug}`
      );
      continue;
    }
    if (!String(row.full_name || '').trim()) {
      logger?.warn?.(
        `[prerender] Anbieterprofil ${row.slug} übersprungen — kein Name, Titel wäre leer.`
      );
      continue;
    }
    if (seenSlugs.has(row.slug)) {
      logger?.warn?.(`[prerender] Anbieterprofil übersprungen — Slug doppelt: ${row.slug}`);
      continue;
    }
    seenSlugs.add(row.slug);

    const provider = mapProfileRowToPublicProvider(row);
    const seo = buildProviderSeo(provider, baseUrl);
    routes.push({
      path: seo.path,
      kind: 'provider',
      title: seo.title,
      description: seo.description,
      ogTitle: seo.ogTitle,
      ogDescription: seo.ogDescription,
      ogType: seo.ogType,
      ogImage: seo.ogImage,
      jsonLd: buildProviderJsonLdList(provider, baseUrl),
    });
  }

  return routes;
}

/**
 * Ermittelt alle statisch zu erzeugenden Kurs- und Anbieterrouten.
 *
 * @param {object} params
 * @param {object} [params.supabase] - Supabase-Client (öffentliches Paar)
 * @param {string} params.baseUrl
 * @param {object} [params.env=process.env]
 * @param {object} [params.logger=console]
 * @returns {Promise<{enabled: boolean, courseRoutes: Array, providerRoutes: Array}>}
 * @throws {CoursePrerenderError} bei systemischen Fehlern
 */
export async function loadCourseAndProviderPrerenderRoutes({
  supabase,
  baseUrl,
  env = process.env,
  logger = console,
}) {
  if (!isCoursePrerenderEnabled(env)) {
    return { enabled: false, courseRoutes: [], providerRoutes: [] };
  }

  const courses = await fetchPublicCourses(supabase, { logger });
  const publicCourseOwnerIds = new Set(
    courses.map((course) => course.user_id).filter(Boolean)
  );
  const providers = await fetchPublicProviders(supabase, { publicCourseOwnerIds, logger });

  return {
    enabled: true,
    courseRoutes: buildCoursePrerenderRoutes({ courses, baseUrl, logger }),
    providerRoutes: buildProviderPrerenderRoutes({ providers, baseUrl, logger }),
  };
}
