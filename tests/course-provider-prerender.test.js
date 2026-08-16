/**
 * Tests für den statischen Prerender öffentlicher Kursdetailseiten und
 * Anbieterprofile (SEO-Blocker 2 des technischen Audits).
 *
 * Hintergrund:
 *   /courses/… und /anbieter/… bekamen bisher keine statische Datei und fielen
 *   in den Catch-all-Rewrite auf dist/index.html. Der erste HTTP-Response war
 *   für ca. 476 Kurse und ca. 21 Anbieterprofile die generische SPA-Shell —
 *   Title, Description, Canonical, og:url und JSON-LD entstanden erst nach der
 *   React-Hydration.
 *
 * Diese Tests führen das ECHTE Prerender-Skript aus (gemocktes Supabase,
 * temporäres dist über PRERENDER_DIST_DIR) und lesen anschliessend die
 * tatsächlich geschriebenen HTML-Dateien — analog zum Themenwelt-Prerender-Test.
 *
 * Kein Test benötigt echte Zugangsdaten; alle Werte sind Platzhalter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

// Jeder Testfall führt das komplette Prerender-Skript aus (>170 HTML-Dateien).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { buildCanonicalCoursePath, buildCanonicalCourseUrl } from '../src/lib/courseUrl.js';

// ============================================================
// Mock-Infrastruktur
// ============================================================

/**
 * Minimaler PostgREST-Query-Mock. .eq/.in/.not/.or/.range werden tatsächlich
 * angewendet, damit die Tests verifizieren, dass der Produktionscode wirklich
 * filtert und paginiert.
 */
function makeSupabaseMock(tables) {
  const calls = [];

  const matchesOrClause = (row, clause) => {
    const [column, op, value] = clause.split('.');
    if (op === 'eq') return String(row[column]) === value;
    if (op === 'is' && value === 'null') return row[column] === null || row[column] === undefined;
    return false;
  };

  const from = vi.fn((table) => {
    const config = tables[table] ?? { data: [], error: null };
    const filters = [];
    const call = { table, filters, columns: null };
    calls.push(call);

    const chain = {};
    chain.select = vi.fn((columns) => {
      call.columns = columns;
      return chain;
    });
    chain.limit = vi.fn(() => chain);
    chain.order = vi.fn((column) => {
      filters.push({ type: 'order', column });
      return chain;
    });
    chain.eq = vi.fn((column, value) => {
      filters.push({ type: 'eq', column, value });
      return chain;
    });
    chain.in = vi.fn((column, values) => {
      filters.push({ type: 'in', column, values });
      return chain;
    });
    chain.not = vi.fn((column, operator, value) => {
      filters.push({ type: 'not', column, operator, value });
      return chain;
    });
    chain.or = vi.fn((expression) => {
      filters.push({ type: 'or', expression });
      return chain;
    });
    chain.range = vi.fn((from_, to) => {
      filters.push({ type: 'range', from: from_, to });
      return chain;
    });
    chain.then = (onFulfilled, onRejected) => {
      // errorIfSelects simuliert eine Spalte, die es in dieser Datenbank nicht
      // gibt — der Fehler hängt dann von der angeforderten Spaltenliste ab.
      const columnError =
        config.errorIfSelects && String(call.columns || '').includes(config.errorIfSelects.column)
          ? config.errorIfSelects.error
          : null;
      const error = config.error || columnError;
      if (error) {
        return Promise.resolve({ data: null, error }).then(onFulfilled, onRejected);
      }
      let rows = config.data ?? [];
      let range = null;
      for (const filter of filters) {
        if (filter.type === 'eq') {
          rows = rows.filter((row) => row[filter.column] === filter.value);
        } else if (filter.type === 'in') {
          rows = rows.filter((row) => filter.values.includes(row[filter.column]));
        } else if (filter.type === 'not' && filter.operator === 'is' && filter.value === null) {
          rows = rows.filter((row) => row[filter.column] !== null && row[filter.column] !== undefined);
        } else if (filter.type === 'or') {
          rows = rows.filter((row) =>
            filter.expression.split(',').some((clause) => matchesOrClause(row, clause))
          );
        } else if (filter.type === 'range') {
          range = filter;
        }
      }
      if (range) rows = rows.slice(range.from, range.to + 1);
      // Spaltenprojektion wie PostgREST: nicht selektierte Felder fehlen in der
      // Antwort. Nur so zeigt ein Fallback auf weniger Spalten echte Wirkung.
      const columns = String(call.columns || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (columns.length > 0 && !columns.includes('*')) {
        rows = rows.map((row) =>
          Object.fromEntries(columns.filter((c) => c in row).map((c) => [c, row[c]]))
        );
      }
      return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
    };
    return chain;
  });

  return { client: { from }, calls };
}

const mockState = { supabase: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockState.supabase),
}));

// ============================================================
// Fixtures (bewusst frei von echten Production-Daten)
// ============================================================

const BASE = 'https://kursnavi.ch';

/** Zukünftiger Termin — erzwingt das EducationEvent-Schema deterministisch. */
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
const PAST_DATE = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const OWNER_PUBLIC = 'user-kunstschule';
const OWNER_NO_PUBLIC_COURSE = 'user-nur-entwuerfe';
const OWNER_BASIC = 'user-basic';
const OWNER_UNPUBLISHED = 'user-unpubliziert';

const COURSE_IMAGE = 'https://cdn.example.test/courses/aquarell.jpg';

/**
 * C1 — veröffentlichter Kurs mit NUMERISCHER Taxonomie im Basisdatensatz und
 * semantischer Kategorie aus v_course_full_categories. Titel und Kanton
 * enthalten Umlaute («für», «Zürich»).
 */
const COURSE_PUBLISHED = {
  id: 779,
  title: 'Aquarell für Anfänger',
  description: 'Ein Einstieg in die Aquarellmalerei mit viel Praxis.',
  canton: 'Zürich',
  city: 'Zürich',
  address: 'Atelierstrasse 4',
  image_url: COURSE_IMAGE,
  price: 240,
  booking_type: 'lead',
  session_length: '2h',
  session_count: 6,
  instructor_name: 'Kunstschule Beispiel',
  user_id: OWNER_PUBLIC,
  status: 'published',
  start_date: null,
  category_type: 'privat',
  // Numerische Taxonomie-ID im Basisdatensatz — darf NIE im Pfad landen.
  category_area: '12',
  category_specialty: null,
  category_focus: null,
  created_at: '2026-01-10T00:00:00.000Z',
};

/** C2 — veröffentlichter Kurs ohne View-Kategorien (Fallback auf Flachfelder). */
const COURSE_LEGACY_FIELDS = {
  id: 780,
  title: 'Yoga Basics',
  description: 'Sanfter Einstieg in Yoga.',
  canton: 'Bern',
  city: 'Bern',
  address: null,
  image_url: null,
  price: 0,
  booking_type: 'lead',
  session_length: null,
  session_count: null,
  instructor_name: 'Yoga Beispiel',
  user_id: OWNER_PUBLIC,
  status: 'published',
  start_date: null,
  category_type: 'privat',
  category_area: 'sport_fitness',
  category_specialty: null,
  category_focus: null,
  created_at: '2026-01-09T00:00:00.000Z',
};

/** C3 — Entwurf. Darf keine statische Datei bekommen. */
const COURSE_DRAFT = {
  ...COURSE_LEGACY_FIELDS,
  id: 781,
  title: 'Geheimer Entwurf',
  status: 'draft',
  user_id: OWNER_NO_PUBLIC_COURSE,
};

/** C4 — pausiert (CHECK-Constraint kennt draft/published/paused). */
const COURSE_PAUSED = {
  ...COURSE_LEGACY_FIELDS,
  id: 782,
  title: 'Pausierter Kurs',
  status: 'paused',
  user_id: OWNER_PUBLIC,
};

/** C5 — archiviert/unbekannter Status. Ebenfalls nicht öffentlich. */
const COURSE_ARCHIVED = {
  ...COURSE_LEGACY_FIELDS,
  id: 783,
  title: 'Archivierter Kurs',
  status: 'archived',
  user_id: OWNER_PUBLIC,
};

/** C6 — Legacy-Datensatz ohne Status. Gilt öffentlich als veröffentlicht. */
const COURSE_LEGACY_NULL_STATUS = {
  ...COURSE_LEGACY_FIELDS,
  id: 784,
  title: 'Alter Kurs ohne Status',
  canton: 'Aargau',
  status: null,
  user_id: OWNER_PUBLIC,
};

/** C7 — einzelner defekter Datensatz: kein Titel. Wird übersprungen. */
const COURSE_WITHOUT_TITLE = {
  ...COURSE_LEGACY_FIELDS,
  id: 785,
  title: '   ',
  status: 'published',
  user_id: OWNER_PUBLIC,
};

const ALL_COURSES = [
  COURSE_PUBLISHED,
  COURSE_LEGACY_FIELDS,
  COURSE_DRAFT,
  COURSE_PAUSED,
  COURSE_ARCHIVED,
  COURSE_LEGACY_NULL_STATUS,
  COURSE_WITHOUT_TITLE,
];

/** Semantische Kategorie zu C1 aus v_course_full_categories. */
const CATEGORY_ROWS = [
  {
    course_id: COURSE_PUBLISHED.id,
    is_primary: true,
    level1_id: 3,
    level1_slug: 'privat',
    level1_label_de: 'Privat & Hobby',
    level2_id: 12,
    level2_slug: 'kunst-kreativ',
    level2_label_de: 'Kunst & Kreativ',
    level3_id: 44,
    level3_slug: 'malerei',
    level3_label_de: 'Malerei',
    level4_id: null,
    level4_slug: null,
    level4_label_de: null,
  },
];

const COURSE_EVENT_ROWS = [
  {
    course_id: COURSE_PUBLISHED.id,
    start_date: FUTURE_DATE,
    end_date: null,
    max_participants: 12,
    cancelled_at: null,
  },
  {
    course_id: COURSE_LEGACY_FIELDS.id,
    start_date: PAST_DATE,
    end_date: null,
    max_participants: 0,
    cancelled_at: null,
  },
];

const PROVIDER_PUBLIC = {
  id: OWNER_PUBLIC,
  full_name: 'Kunstschule Beispiel',
  slug: 'kunstschule-beispiel',
  bio_text: 'Wir unterrichten Malerei und Zeichnen in kleinen Gruppen.',
  logo_url: 'https://cdn.example.test/provider/logo.png',
  website_url: 'https://beispiel.example',
  phone: '+41 44 000 00 00',
  street: 'Atelierstrasse 4',
  city: 'Zürich',
  canton: 'Zürich',
  social_linkedin: null,
  social_instagram: 'https://instagram.example/kunstschule',
  social_facebook: null,
  social_youtube: null,
  package_tier: 'pro',
  profile_published_at: '2026-02-01T10:00:00.000Z',
};

/** Profil ohne profile_published_at — nicht veröffentlicht. */
const PROVIDER_UNPUBLISHED = {
  ...PROVIDER_PUBLIC,
  id: OWNER_UNPUBLISHED,
  full_name: 'Noch nicht publiziert',
  slug: 'noch-nicht-publiziert',
  profile_published_at: null,
};

/** Basic-Paket — hat kein öffentliches Profil (Public-Gate fehlt). */
const PROVIDER_BASIC_TIER = {
  ...PROVIDER_PUBLIC,
  id: OWNER_BASIC,
  full_name: 'Basic Anbieter',
  slug: 'basic-anbieter',
  package_tier: 'basic',
};

/** Publiziert und Pro, aber ohne einen einzigen öffentlichen Kurs. */
const PROVIDER_WITHOUT_PUBLIC_COURSE = {
  ...PROVIDER_PUBLIC,
  id: OWNER_NO_PUBLIC_COURSE,
  full_name: 'Nur Entwürfe',
  slug: 'nur-entwuerfe',
  package_tier: 'premium',
};

const ALL_PROVIDERS = [
  PROVIDER_PUBLIC,
  PROVIDER_UNPUBLISHED,
  PROVIDER_BASIC_TIER,
  PROVIDER_WITHOUT_PUBLIC_COURSE,
];

function defaultTables(overrides = {}) {
  return {
    courses: { data: ALL_COURSES, error: null },
    v_course_full_categories: { data: CATEGORY_ROWS, error: null },
    course_events: { data: COURSE_EVENT_ROWS, error: null },
    profiles: { data: ALL_PROVIDERS, error: null },
    theme_worlds: { data: [], error: null },
    theme_world_scenarios: { data: [], error: null },
    ...overrides,
  };
}

// ============================================================
// Prerender-Ausführung
// ============================================================

const TEMPLATE_PATH = resolve('index.html');

let tempRoot = null;
let distDir = null;
const ENV_KEYS = [
  'PRERENDER_DIST_DIR',
  'VITE_SITE_URL',
  'VITE_THEME_WORLD_DB_ENABLED',
  'VITE_THEME_WORLD_PILOT_KEYS',
  'VITE_COURSE_PRERENDER_ENABLED',
  'VITE_COURSE_PRERENDER_REQUIRED',
  // Von Vercel automatisch gesetzt — entscheidet über die Strenge des Fail-safe.
  'VERCEL',
  'VERCEL_ENV',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_KEY',
];
let savedEnv = {};

function setEnv(env) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    process.env[key] = value;
  }
}

async function runPrerender({ tables = defaultTables(), env = {} } = {}) {
  const { client, calls } = makeSupabaseMock(tables);
  mockState.supabase = client;

  setEnv({
    PRERENDER_DIST_DIR: distDir,
    VITE_SITE_URL: BASE,
    // Platzhalter — kein Test benötigt echte Zugangsdaten.
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_KEY: 'test-public-key',
    ...env,
  });

  vi.resetModules();
  await import('../scripts/prerender-static.mjs');
  return { calls };
}

function pageFile(path) {
  return join(distDir, ...path.split('/').filter(Boolean), 'index.html');
}

function readPage(path) {
  return readFileSync(pageFile(path), 'utf-8');
}

function pageExists(path) {
  return existsSync(pageFile(path));
}

/** Alle vom Build injizierten JSON-LD-Blöcke einer Seite. */
function readJsonLd(path) {
  const html = readPage(path);
  const blocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json" data-prerender-jsonld="\d+">([\s\S]*?)<\/script>/g
    ),
  ];
  // `<` liegt als < im Markup — JSON.parse dekodiert das korrekt zurück.
  return blocks.map((match) => JSON.parse(match[1]));
}

function countMatches(html, pattern) {
  return (html.match(pattern) || []).length;
}

const COURSE_PATH = buildCanonicalCoursePath(COURSE_PUBLISHED_WITH_CATEGORIES());
const LEGACY_COURSE_PATH = buildCanonicalCoursePath(COURSE_LEGACY_FIELDS);
const NULL_STATUS_PATH = buildCanonicalCoursePath(COURSE_LEGACY_NULL_STATUS);
const PROVIDER_PATH = `/anbieter/${PROVIDER_PUBLIC.slug}`;

/**
 * C1 so, wie der Prerender ihn sieht: mit den aus der View aufgelösten
 * Kategorien. Genau diese Form erwartet buildCanonicalCoursePath().
 */
function COURSE_PUBLISHED_WITH_CATEGORIES() {
  return {
    ...COURSE_PUBLISHED,
    all_categories: [
      {
        course_id: COURSE_PUBLISHED.id,
        category_type: 'privat',
        category_type_label: 'Privat & Hobby',
        category_area: 'kunst-kreativ',
        category_area_label: 'Kunst & Kreativ',
        category_specialty: 'malerei',
        category_specialty_label: 'Malerei',
        category_focus: null,
        category_focus_label: null,
        type_id: 3,
        area_id: 12,
        specialty_id: 44,
        focus_id: null,
        is_primary: true,
      },
    ],
  };
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

  tempRoot = mkdtempSync(join(tmpdir(), 'kursnavi-course-prerender-'));
  distDir = join(tempRoot, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), readFileSync(TEMPLATE_PATH, 'utf-8'), 'utf-8');

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mockState.supabase = null;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = null;
  distDir = null;
});

// ============================================================
// 1.–6. Kurs-Prerender: welche Kurse bekommen eine Datei?
// ============================================================

describe('Course-Prerender: Public-Filter und kanonischer Pfad', () => {
  it('1. veröffentlichter Kurs bekommt eine statische index.html', async () => {
    await runPrerender();

    expect(pageExists(COURSE_PATH)).toBe(true);
    expect(pageExists(LEGACY_COURSE_PATH)).toBe(true);
  });

  it('2. der Dateipfad ist exakt buildCanonicalCoursePath(course)', async () => {
    await runPrerender();

    // Kein zweiter Slug-Algorithmus: der erwartete Pfad kommt aus derselben
    // Funktion, die Sitemap, Canonical und interne Links nutzen.
    const expected = buildCanonicalCoursePath(COURSE_PUBLISHED_WITH_CATEGORIES());
    expect(existsSync(pageFile(expected))).toBe(true);
  });

  it('3. numerische Taxonomie im Basiskurs ergibt den semantischen Pfad aus der View', async () => {
    await runPrerender();

    expect(COURSE_PATH).toContain('/courses/kunst-kreativ/');
    // Die rohe Taxonomie-ID darf nirgends als Themensegment erscheinen.
    expect(pageExists('/courses/12/zuerich/779-aquarell-fuer-anfaenger')).toBe(false);
  });

  it('4. Zürich wird zu «zuerich», «für» zu «fuer»', async () => {
    await runPrerender();

    expect(COURSE_PATH).toBe('/courses/kunst-kreativ/zuerich/779-aquarell-fuer-anfaenger');
    expect(pageExists('/courses/kunst-kreativ/zuerich/779-aquarell-fuer-anfaenger')).toBe(true);
  });

  it('5. Draft-Kurs bekommt KEINE statische Datei', async () => {
    await runPrerender();

    expect(pageExists(buildCanonicalCoursePath(COURSE_DRAFT))).toBe(false);
  });

  it('6. pausierte und archivierte Kurse bekommen KEINE statische Datei', async () => {
    await runPrerender();

    expect(pageExists(buildCanonicalCoursePath(COURSE_PAUSED))).toBe(false);
    expect(pageExists(buildCanonicalCoursePath(COURSE_ARCHIVED))).toBe(false);
  });

  it('Legacy-Kurs ohne status gilt weiterhin als öffentlich', async () => {
    await runPrerender();

    expect(pageExists(NULL_STATUS_PATH)).toBe(true);
  });

  it('filtert bereits in der Query auf published/legacy — nicht erst im Code', async () => {
    const { calls } = await runPrerender();

    const courseCall = calls.find((c) => c.table === 'courses');
    expect(courseCall.filters).toContainEqual({
      type: 'or',
      expression: 'status.eq.published,status.is.null',
    });
  });

  it('ein einzelner Kurs ohne Titel wird übersprungen, ohne den Build zu stoppen', async () => {
    await runPrerender();

    // Andere Kurse existieren weiterhin — der defekte Datensatz blockiert nichts.
    expect(pageExists(COURSE_PATH)).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Kurs ${COURSE_WITHOUT_TITLE.id} übersprungen`)
    );
  });

  it('fragt keine Spalten ab, die es in courses nicht gibt', async () => {
    const { calls } = await runPrerender();

    // `city` gab es nie auf courses (hiess location_city und wurde mit
    // course_locations entfernt). Eine solche Spalte lässt die gesamte Abfrage
    // scheitern und damit den Build abbrechen.
    const courseCall = calls.find((c) => c.table === 'courses');
    expect(courseCall.columns).not.toMatch(/\bcity\b/);
    expect(courseCall.columns).toContain('canton');
    expect(courseCall.columns).toContain('address');
  });

  it('lädt Kategorien und Termine gebündelt statt einmal pro Kurs', async () => {
    const { calls } = await runPrerender();

    // 476 Kurse dürfen keine 476 Einzelabfragen auslösen: pro Tabelle genügt
    // ein Block je 200 IDs (hier also genau einer).
    expect(calls.filter((c) => c.table === 'v_course_full_categories')).toHaveLength(1);
    expect(calls.filter((c) => c.table === 'course_events')).toHaveLength(1);
  });
});

// ============================================================
// 7.–9. Kurs-Prerender: Inhalt des ersten HTML
// ============================================================

describe('Course-Prerender: erstes HTML', () => {
  it('7a. enthält den individuellen Title und die individuelle Description', async () => {
    await runPrerender();
    const html = readPage(COURSE_PATH);

    expect(html).toContain('<title>Aquarell für Anfänger in Zürich | KursNavi</title>');
    expect(html).toContain(
      '<meta name="description" content="Aquarell für Anfänger in Zürich – Ein Einstieg in die Aquarellmalerei mit viel Praxis."'
    );
    // Nicht mehr die generische Shell
    expect(html).not.toContain('<title>KursNavi – Der Schweizer Kursmarktplatz</title>');
  });

  it('7b. enthält genau einen Self-Canonical', async () => {
    await runPrerender();
    const html = readPage(COURSE_PATH);

    expect(html).toContain(`<link rel="canonical" href="${BASE}${COURSE_PATH}"`);
    expect(countMatches(html, /<link rel="canonical"/g)).toBe(1);
  });

  it('7c. ist auf index,follow gesetzt', async () => {
    await runPrerender();
    const html = readPage(COURSE_PATH);

    expect(html).toContain('<meta name="robots" content="index,follow"');
    expect(html).not.toContain('noindex');
  });

  it('7d. enthält og:type, og:title, og:description, og:url und das erwartete og:image', async () => {
    await runPrerender();
    const html = readPage(COURSE_PATH);

    expect(html).toContain('<meta property="og:type" content="website"');
    expect(html).toContain('<meta property="og:title" content="Aquarell für Anfänger in Zürich"');
    expect(html).toContain(
      '<meta property="og:description" content="Aquarell für Anfänger in Zürich – Ein Einstieg in die Aquarellmalerei mit viel Praxis."'
    );
    expect(html).toContain(`<meta property="og:url" content="${BASE}${COURSE_PATH}"`);
    expect(html).toContain(`<meta property="og:image" content="${COURSE_IMAGE}"`);
  });

  it('7e. Kurs ohne eigenes Bild bekommt das Standard-OG-Bild', async () => {
    await runPrerender();
    const html = readPage(LEGACY_COURSE_PATH);

    expect(html).toContain(`<meta property="og:image" content="${BASE}/og-default.png"`);
  });

  it('7f. enthält Course-, EducationEvent- und BreadcrumbList-JSON-LD', async () => {
    await runPrerender();
    const schemas = readJsonLd(COURSE_PATH);
    const types = schemas.map((s) => s['@type']);

    expect(types).toContain('Course');
    expect(types).toContain('EducationEvent');
    expect(types).toContain('BreadcrumbList');
    // Kein Hybrid: Course und EducationEvent bleiben getrennte Knoten.
    expect(types.filter((t) => t === 'Course')).toHaveLength(1);
    expect(schemas.find((s) => s['@type'] === 'Course').startDate).toBeUndefined();
  });

  it('7g. EducationEvent entsteht nur bei einem laufenden/zukünftigen Termin', async () => {
    await runPrerender();

    // C2 hat nur einen vergangenen Termin.
    const types = readJsonLd(LEGACY_COURSE_PATH).map((s) => s['@type']);
    expect(types).toContain('Course');
    expect(types).toContain('BreadcrumbList');
    expect(types).not.toContain('EducationEvent');
  });

  it('8. keine generische Root-Canonical und keine Root-og:url bleiben übrig', async () => {
    await runPrerender();
    const html = readPage(COURSE_PATH);

    expect(html).not.toContain(`<link rel="canonical" href="${BASE}/"`);
    expect(html).not.toContain(`<meta property="og:url" content="${BASE}/"`);
    expect(countMatches(html, /<meta property="og:url"/g)).toBe(1);
    expect(countMatches(html, /<title>/g)).toBe(1);
    expect(countMatches(html, /<meta name="description"/g)).toBe(1);
    expect(countMatches(html, /<meta name="robots"/g)).toBe(1);
  });

  it('9. Course-JSON-LD-URL = Canonical = buildCanonicalCourseUrl()', async () => {
    await runPrerender();
    const html = readPage(COURSE_PATH);
    const schemas = readJsonLd(COURSE_PATH);

    const expectedUrl = buildCanonicalCourseUrl(COURSE_PUBLISHED_WITH_CATEGORIES(), BASE);
    const courseSchema = schemas.find((s) => s['@type'] === 'Course');
    const eventSchema = schemas.find((s) => s['@type'] === 'EducationEvent');

    expect(courseSchema.offers.url).toBe(expectedUrl);
    expect(eventSchema.offers.url).toBe(expectedUrl);
    expect(html).toContain(`<link rel="canonical" href="${expectedUrl}"`);
    expect(html).toContain(`<meta property="og:url" content="${expectedUrl}"`);
  });

  it('Course-JSON-LD nennt Anbieter, Preis und Verfügbarkeit ohne erfundene Felder', async () => {
    await runPrerender();
    const courseSchema = readJsonLd(COURSE_PATH).find((s) => s['@type'] === 'Course');

    expect(courseSchema.name).toBe(COURSE_PUBLISHED.title);
    expect(courseSchema.provider.name).toBe(COURSE_PUBLISHED.instructor_name);
    expect(courseSchema.provider.sameAs).toBe(`${BASE}/teacher/${OWNER_PUBLIC}`);
    expect(courseSchema.offers.price).toBe(240);
    expect(courseSchema.offers.availability).toBe('https://schema.org/InStock');
    expect(courseSchema.timeRequired).toBe('6x 2h');
    expect(courseSchema.aggregateRating).toBeUndefined();
  });

  it('BreadcrumbList zeigt auf die kanonische Themen-/Ortsebene', async () => {
    await runPrerender();
    const breadcrumb = readJsonLd(COURSE_PATH).find((s) => s['@type'] === 'BreadcrumbList');

    expect(breadcrumb.itemListElement[0].item).toBe(BASE);
    expect(breadcrumb.itemListElement[1].item).toBe(`${BASE}/courses/kunst-kreativ/zuerich/`);
    expect(breadcrumb.itemListElement[2].name).toBe(COURSE_PUBLISHED.title);
  });
});

// ============================================================
// Anbieter-Prerender
// ============================================================

describe('Anbieter-Prerender', () => {
  it('1. öffentliches Profil bekommt dist/anbieter/{slug}/index.html', async () => {
    await runPrerender();

    expect(pageExists(PROVIDER_PATH)).toBe(true);
  });

  it('2. nicht veröffentlichtes Profil bekommt KEINE Datei', async () => {
    await runPrerender();

    expect(pageExists(`/anbieter/${PROVIDER_UNPUBLISHED.slug}`)).toBe(false);
  });

  it('3a. Basic-Paket bekommt KEINE Datei', async () => {
    await runPrerender();

    expect(pageExists(`/anbieter/${PROVIDER_BASIC_TIER.slug}`)).toBe(false);
  });

  it('3b. Pro-Profil ohne einen einzigen öffentlichen Kurs bekommt KEINE Datei', async () => {
    await runPrerender();

    // Sitemap-Regel: nur Anbieter mit mindestens einem öffentlichen Kurs.
    expect(pageExists(`/anbieter/${PROVIDER_WITHOUT_PUBLIC_COURSE.slug}`)).toBe(false);
  });

  it('filtert Paket, Slug und Veröffentlichung bereits in der Query', async () => {
    const { calls } = await runPrerender();

    const profileCall = calls.find((c) => c.table === 'profiles');
    expect(profileCall.filters).toContainEqual({
      type: 'not',
      column: 'profile_published_at',
      operator: 'is',
      value: null,
    });
    expect(profileCall.filters).toContainEqual({
      type: 'not',
      column: 'slug',
      operator: 'is',
      value: null,
    });
    expect(profileCall.filters).toContainEqual({
      type: 'in',
      column: 'package_tier',
      values: ['pro', 'premium', 'enterprise'],
    });
  });

  it('fehlende optionale Profilspalte kostet Details, aber keine Seite', async () => {
    // Migrationsstand ohne social_*/phone/street: api/provider.js hält dafür
    // seit jeher eine Fallback-Abfrage vor — der Prerender ebenso.
    const tables = defaultTables({
      profiles: {
        data: ALL_PROVIDERS,
        error: null,
        errorIfSelects: {
          column: 'social_linkedin',
          error: { code: '42703', message: 'column profiles.social_linkedin does not exist' },
        },
      },
    });

    await runPrerender({ tables });

    expect(pageExists(PROVIDER_PATH)).toBe(true);
    const organization = readJsonLd(PROVIDER_PATH).find((s) => Array.isArray(s['@type']));
    expect(organization.name).toBe(PROVIDER_PUBLIC.full_name);
    expect(organization.telephone).toBeUndefined();
    expect(organization.sameAs).toEqual([PROVIDER_PUBLIC.website_url]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Optionale Spalten für Öffentliche Anbieterprofile nicht verfügbar')
    );
  });

  it('ein anderer Profilfehler bleibt systemisch und bricht den Build ab', async () => {
    const tables = defaultTables({
      profiles: { data: null, error: { code: '08006', message: 'connection failure' } },
    });

    await expect(runPrerender({ tables })).rejects.toThrow(/Anbieterprofile/);
  });

  it('4. erstes HTML enthält Title, Description, Canonical, index,follow und OG', async () => {
    await runPrerender();
    const html = readPage(PROVIDER_PATH);

    expect(html).toContain('<title>Kunstschule Beispiel | KursNavi</title>');
    expect(html).toContain(`<meta name="description" content="${PROVIDER_PUBLIC.bio_text}"`);
    expect(html).toContain(`<link rel="canonical" href="${BASE}${PROVIDER_PATH}"`);
    expect(html).toContain('<meta name="robots" content="index,follow"');
    expect(html).toContain('<meta property="og:title" content="Kunstschule Beispiel | KursNavi"');
    expect(html).toContain(`<meta property="og:url" content="${BASE}${PROVIDER_PATH}"`);
    expect(html).toContain(`<meta property="og:image" content="${PROVIDER_PUBLIC.logo_url}"`);
    expect(countMatches(html, /<link rel="canonical"/g)).toBe(1);
    expect(countMatches(html, /<meta property="og:url"/g)).toBe(1);
    expect(countMatches(html, /<title>/g)).toBe(1);
  });

  it('4b. erstes HTML enthält EducationalOrganization- und BreadcrumbList-JSON-LD', async () => {
    await runPrerender();
    const schemas = readJsonLd(PROVIDER_PATH);

    const organization = schemas.find((s) => Array.isArray(s['@type']));
    expect(organization['@type']).toEqual(['EducationalOrganization', 'LocalBusiness']);
    expect(organization.url).toBe(`${BASE}${PROVIDER_PATH}`);
    expect(organization.address.streetAddress).toBe(PROVIDER_PUBLIC.street);
    expect(organization.telephone).toBe(PROVIDER_PUBLIC.phone);
    expect(organization.sameAs).toEqual([
      PROVIDER_PUBLIC.website_url,
      PROVIDER_PUBLIC.social_instagram,
    ]);
    // Keine erfundenen Felder: ohne öffentliche E-Mail steht auch keine im Schema.
    expect(organization.email).toBeUndefined();

    const breadcrumb = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(breadcrumb.itemListElement[2].item).toBe(`${BASE}${PROVIDER_PATH}`);
  });
});

// ============================================================
// Fail-safe
// ============================================================

describe('Fail-safe: systemische Fehler brechen den Build ab', () => {
  it('1a. nicht erreichbare courses-Abfrage bricht den Build ab', async () => {
    const tables = defaultTables({ courses: { data: null, error: { message: 'connection reset' } } });

    await expect(runPrerender({ tables })).rejects.toThrow(
      /Öffentliche Kurse konnte[n]? nicht geladen werden/
    );
  });

  it('1b. nicht auflösbare Kategorien brechen den Build ab (keine geratenen URLs)', async () => {
    const tables = defaultTables({
      v_course_full_categories: { data: null, error: { message: 'timeout' } },
    });

    await expect(runPrerender({ tables })).rejects.toThrow(/Kategorien für \d+ Kurs\(e\)/);
  });

  it('1c. nicht erreichbare profiles-Abfrage bricht den Build ab', async () => {
    const tables = defaultTables({ profiles: { data: null, error: { message: 'connection reset' } } });

    await expect(runPrerender({ tables })).rejects.toThrow(
      /Öffentliche Anbieterprofile konnte[n]? nicht geladen werden/
    );
  });

  it('1d. nicht erreichbare course_events-Abfrage bricht den Build ab', async () => {
    const tables = defaultTables({ course_events: { data: null, error: { message: 'timeout' } } });

    await expect(runPrerender({ tables })).rejects.toThrow(/Kurstermine konnte[n]? nicht geladen werden/);
  });

  it('ein für anonym nicht lesbares end_date kostet keine Kursseite', async () => {
    // Anonyme Leser sehen course_events.end_date in dieser Datenbank nicht;
    // PostgREST meldet das als 42703. Die hydratisierte Seite sieht die Spalte
    // ebenfalls nicht — Prerender und Hydration bleiben identisch.
    const tables = defaultTables({
      course_events: {
        data: COURSE_EVENT_ROWS,
        error: null,
        errorIfSelects: {
          column: 'end_date',
          error: { code: '42703', message: 'column course_events.end_date does not exist' },
        },
      },
    });

    await runPrerender({ tables });

    expect(pageExists(COURSE_PATH)).toBe(true);
    const event = readJsonLd(COURSE_PATH).find((s) => s['@type'] === 'EducationEvent');
    expect(event.startDate).toBe(FUTURE_DATE);
    expect(event.endDate).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Optionale Spalten für Kurstermine nicht verfügbar')
    );
  });

  it('der Fehler ist ein CoursePrerenderError und nennt keine Zugangsdaten', async () => {
    const tables = defaultTables({ courses: { data: null, error: { message: 'connection reset' } } });
    const error = await runPrerender({ tables }).catch((e) => e);

    expect(error.name).toBe('CoursePrerenderError');
    expect(error.message).not.toContain('test-public-key');
    expect(error.message).not.toContain('test.supabase.co');
  });
});

describe('Fail-safe: Credentials', () => {
  it('2a. genau eine fehlende Variable ist immer ein Build-Fehler', async () => {
    await expect(
      runPrerender({ env: { VITE_SUPABASE_URL: undefined } })
    ).rejects.toThrow(/es fehlt: VITE_SUPABASE_URL/);

    await expect(
      runPrerender({ env: { VITE_SUPABASE_KEY: undefined } })
    ).rejects.toThrow(/es fehlt: VITE_SUPABASE_KEY/);
  });

  it('2b. ausserhalb Vercel erzwingt VITE_COURSE_PRERENDER_REQUIRED=true den Abbruch', async () => {
    const error = await runPrerender({
      env: {
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_KEY: undefined,
        VITE_COURSE_PRERENDER_REQUIRED: 'true',
      },
    }).catch((e) => e);

    expect(error.name).toBe('CoursePrerenderError');
    expect(error.message).toContain('VITE_SUPABASE_URL und VITE_SUPABASE_KEY');
    expect(error.message).not.toContain('test-public-key');
  });

  it('2c. lokal/CI ohne Vercel: fehlendes Paar überspringt laut, statt still zu deployen', async () => {
    await runPrerender({
      env: { VITE_SUPABASE_URL: undefined, VITE_SUPABASE_KEY: undefined },
    });

    expect(pageExists(COURSE_PATH)).toBe(false);
    expect(pageExists(PROVIDER_PATH)).toBe(false);
    // Die übrigen statischen Seiten entstehen weiterhin.
    expect(pageExists('/about')).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('VITE_SUPABASE_URL und VITE_SUPABASE_KEY fehlen')
    );
  });

  it('3. ein vorhandener Service-Role-Key ersetzt das öffentliche Paar NICHT', async () => {
    const error = await runPrerender({
      env: {
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_KEY: undefined,
        VITE_COURSE_PRERENDER_REQUIRED: 'true',
        SUPABASE_URL: 'https://server.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-should-not-be-used',
      },
    }).catch((e) => e);

    expect(error.name).toBe('CoursePrerenderError');
    expect(error.message).not.toContain('service-role-should-not-be-used');
  });

  it('nutzt ausschliesslich das öffentliche Paar für den Client', async () => {
    await runPrerender();

    const { createClient } = await import('@supabase/supabase-js');
    expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-public-key');
  });
});

// ============================================================
// Fail-safe: echter Vercel-Build ist strenger als lokal/CI
// ============================================================

describe('Fail-safe: Vercel-Build', () => {
  // Vercel setzt VERCEL und VERCEL_ENV in jedem Build automatisch — es ist also
  // keine zusätzliche Projektkonfiguration nötig, damit ein echter Deploy
  // strenger behandelt wird als ein lokaler Build.
  const VERCEL_ENVS = [
    { label: 'VERCEL=1', env: { VERCEL: '1' } },
    { label: 'VERCEL_ENV=preview', env: { VERCEL_ENV: 'preview' } },
    { label: 'VERCEL_ENV=production', env: { VERCEL_ENV: 'production' } },
  ];

  for (const { label, env } of VERCEL_ENVS) {
    it(`2. ${label}: fehlendes Credential-Paar bricht den Build ab`, async () => {
      const error = await runPrerender({
        env: { ...env, VITE_SUPABASE_URL: undefined, VITE_SUPABASE_KEY: undefined },
      }).catch((e) => e);

      expect(error.name).toBe('CoursePrerenderError');
      expect(error.message).toContain('Vercel-Build erkannt');
      // Kein zusätzliches Flag nötig — Production ist ohne Zutun fail-safe.
      expect(pageExists(COURSE_PATH)).toBe(false);
    });
  }

  it('3. Vercel mit nur VITE_SUPABASE_URL bricht ab', async () => {
    const error = await runPrerender({
      env: { VERCEL: '1', VITE_SUPABASE_KEY: undefined },
    }).catch((e) => e);

    expect(error.name).toBe('CoursePrerenderError');
    expect(error.message).toContain('es fehlt: VITE_SUPABASE_KEY');
  });

  it('4. Vercel mit nur VITE_SUPABASE_KEY bricht ab', async () => {
    const error = await runPrerender({
      env: { VERCEL: '1', VITE_SUPABASE_URL: undefined },
    }).catch((e) => e);

    expect(error.name).toBe('CoursePrerenderError');
    expect(error.message).toContain('es fehlt: VITE_SUPABASE_URL');
  });

  it('5. Vercel mit vollständigem öffentlichem Paar prerendert normal', async () => {
    await runPrerender({ env: { VERCEL: '1', VERCEL_ENV: 'preview' } });

    expect(pageExists(COURSE_PATH)).toBe(true);
    expect(pageExists(PROVIDER_PATH)).toBe(true);
  });

  it('6. Vercel mit VITE_COURSE_PRERENDER_ENABLED=false überspringt bewusst, ohne Fehler', async () => {
    const { calls } = await runPrerender({
      env: {
        VERCEL: '1',
        VERCEL_ENV: 'production',
        VITE_COURSE_PRERENDER_ENABLED: 'false',
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_KEY: undefined,
      },
    });

    expect(pageExists(COURSE_PATH)).toBe(false);
    expect(pageExists('/about')).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('nennt in keiner Fail-safe-Meldung Zugangsdaten', async () => {
    const error = await runPrerender({
      env: {
        VERCEL: '1',
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_KEY: undefined,
        SUPABASE_URL: 'https://server.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-should-not-be-used',
      },
    }).catch((e) => e);

    expect(error.message).not.toContain('service-role-should-not-be-used');
    expect(error.message).not.toContain('server.supabase.co');
  });
});

describe('VITE_COURSE_PRERENDER_ENABLED=false', () => {
  it('erzeugt keine Kurs-/Anbieterseiten und fragt Supabase nicht ab', async () => {
    const { calls } = await runPrerender({ env: { VITE_COURSE_PRERENDER_ENABLED: 'false' } });

    expect(pageExists(COURSE_PATH)).toBe(false);
    expect(pageExists(PROVIDER_PATH)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('die übrigen statischen Seiten bleiben unverändert', async () => {
    await runPrerender({ env: { VITE_COURSE_PRERENDER_ENABLED: 'false' } });

    expect(pageExists('/about')).toBe(true);
    expect(pageExists('/ratgeber/beruflich/finanzierung')).toBe(true);
    expect(pageExists('/anbieter')).toBe(true);
  });
});
