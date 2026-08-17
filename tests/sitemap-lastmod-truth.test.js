/**
 * Tests für die Wahrheit der <lastmod>-Werte in der Sitemap.
 *
 * Audit-Befund: Course-URLs trugen `courses.created_at` und Provider-URLs
 * `profiles.profile_published_at` als <lastmod>. Beides sind Anlage- bzw.
 * Publikationszeitpunkte und keine Zeitpunkte der letzten wesentlichen Änderung
 * der öffentlichen Seite:
 *
 *   - Kurse sind nach der Anlage jederzeit editierbar (TeacherForm), ohne dass
 *     sich created_at bewegt. Ein technisches courses.updated_at existiert nicht
 *     gepflegt: set_updated_at() ist ausschliesslich an theme_worlds und
 *     theme_world_scenarios gebunden (20260714_create_theme_worlds.sql).
 *   - profile_published_at wird nur vom Publish-Schalter in api/provider.js
 *     gesetzt/geleert. Profilinhalte (bio_text, Logo, Standorte) ändern es nie,
 *     ein Re-Publish schreibt "jetzt" ohne Inhaltsänderung.
 *
 * Regel: Ohne verlässliche Quelle wird <lastmod> vollständig weggelassen.
 * Themenwelten behalten ihr lastmod — dort erzwingt ein DB-Trigger updated_at.
 *
 * Supabase wird vollständig gemockt — kein echter DB-Zugriff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mock-Infrastruktur (identisch zu sitemap-course-canonical.test.js)
// ============================================================

function makeMockRes() {
  return {
    _status: null,
    _body: null,
    _headers: {},
    _sent: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
    send(data) { this._sent = data; return this; },
  };
}

function makeMockReq() {
  return { method: 'GET', headers: {}, query: {} };
}

function makeSupabaseMock(tables) {
  const from = vi.fn((table) => {
    const config = tables[table] ?? { data: [], error: null };
    const filters = [];

    const chain = {};
    for (const method of ['select', 'or', 'not', 'order', 'limit', 'neq', 'gte', 'eq']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.in = vi.fn((column, values) => {
      filters.push({ column, values });
      return chain;
    });
    chain.then = (resolve, reject) => {
      if (config.error) return Promise.resolve({ data: null, error: config.error }).then(resolve, reject);
      let rows = config.data ?? [];
      for (const filter of filters) {
        rows = rows.filter((row) => filter.values.includes(row[filter.column]));
      }
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    };
    return chain;
  });

  return { from };
}

const mockState = { supabase: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockState.supabase),
}));

const BASE = 'https://kursnavi.ch';

const COURSE_CREATED_AT = '2024-03-05T08:15:00.000Z';
const PROFILE_PUBLISHED_AT = '2024-06-11T12:00:00.000Z';
const BLOG_CREATED_AT = '2025-02-02T09:00:00.000Z';
const THEME_WORLD_UPDATED_AT = '2026-05-04T17:30:00.000Z';

const COURSE = {
  id: 363,
  title: 'Spanisch Konversationskurs',
  category_type: 'privat',
  category_area: 'sprachen_privat',
  category_specialty: null,
  category_focus: null,
  canton: 'Bern',
  created_at: COURSE_CREATED_AT,
  // Macht PROVIDER anbieter-eligible (mind. ein publizierter Kurs).
  user_id: 'provider-1',
};

const COURSE_URL = `${BASE}/courses/sprachen-privat/bern/363-spanisch-konversationskurs`;

const PROVIDER = {
  id: 'provider-1',
  slug: 'kunstschule-bern',
  profile_published_at: PROFILE_PUBLISHED_AT,
  package_tier: 'pro',
};

const PROVIDER_URL = `${BASE}/anbieter/kunstschule-bern`;

const BLOG_POST = {
  id: 11,
  slug: 'weiterbildung-finanzieren',
  title: 'Weiterbildung finanzieren',
  created_at: BLOG_CREATED_AT,
};

const BLOG_URL = `${BASE}/blog/weiterbildung-finanzieren`;

const THEME_WORLD = {
  id: 'tw-1',
  url_segment: 'privat',
  slug: 'yoga',
  status: 'published',
  updated_at: THEME_WORLD_UPDATED_AT,
  published_at: '2026-01-01T00:00:00.000Z',
};

const THEME_WORLD_URL = `${BASE}/bereich/privat/yoga`;

/** Vollständiger Datensatz — alle Sitemap-Familien gleichzeitig besetzt. */
function fullTables(overrides = {}) {
  return {
    courses: { data: [COURSE], error: null },
    v_course_full_categories: { data: [], error: null },
    articles: { data: [BLOG_POST], error: null },
    profiles: { data: [PROVIDER], error: null },
    theme_worlds: { data: [THEME_WORLD], error: null },
    theme_world_scenarios: { data: [], error: null },
    ...overrides,
  };
}

async function renderSitemap(tables) {
  mockState.supabase = makeSupabaseMock(tables);
  vi.resetModules();
  const { default: handler } = await import('../api/sitemap.js');
  const res = makeMockRes();
  await handler(makeMockReq(), res);
  return res;
}

/** Zerlegt die Sitemap in <url>-Blöcke mit loc/lastmod. */
function urlEntries(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const block = match[1];
    const loc = block.match(/<loc>([^<]*)<\/loc>/)?.[1] ?? null;
    const lastmodMatch = block.match(/<lastmod>([^<]*)<\/lastmod>/);
    return { loc, lastmod: lastmodMatch ? lastmodMatch[1] : undefined, block };
  });
}

function entryFor(xml, loc) {
  return urlEntries(xml).find((entry) => entry.loc === loc);
}

// ============================================================
// 1./2./4. Kein erfundenes lastmod bei Kursen und Anbietern
// ============================================================

describe('Sitemap: Course-/Provider-lastmod erfindet kein Änderungsdatum', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.VITE_SITE_URL = BASE;
    process.env.VITE_THEME_WORLD_DB_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.VITE_THEME_WORLD_DB_ENABLED;
    vi.restoreAllMocks();
  });

  it('1. Course-Eintrag trägt kein created_at als lastmod', async () => {
    const res = await renderSitemap(fullTables());

    const course = entryFor(res._sent, COURSE_URL);
    expect(course).toBeDefined();
    expect(course.block).not.toContain(COURSE_CREATED_AT);
    expect(res._sent).not.toContain(COURSE_CREATED_AT);
  });

  it('2. Provider-Eintrag trägt kein profile_published_at als lastmod', async () => {
    const res = await renderSitemap(fullTables());

    const provider = entryFor(res._sent, PROVIDER_URL);
    expect(provider).toBeDefined();
    expect(provider.block).not.toContain(PROFILE_PUBLISHED_AT);
    expect(res._sent).not.toContain(PROFILE_PUBLISHED_AT);
  });

  it('4. Ohne verlässliche Quelle fehlt <lastmod> vollständig — kein leeres Element', async () => {
    const res = await renderSitemap(fullTables());

    const course = entryFor(res._sent, COURSE_URL);
    const provider = entryFor(res._sent, PROVIDER_URL);

    expect(course.lastmod).toBeUndefined();
    expect(provider.lastmod).toBeUndefined();
    expect(course.block).not.toContain('<lastmod>');
    expect(provider.block).not.toContain('<lastmod>');
    expect(res._sent).not.toContain('<lastmod></lastmod>');
    expect(res._sent).not.toContain('<lastmod>Invalid Date</lastmod>');
  });

  it('4b. Kein Kurs- oder Anbieter-Eintrag trägt überhaupt ein lastmod', async () => {
    const res = await renderSitemap(
      fullTables({
        courses: {
          data: [COURSE, { ...COURSE, id: 364, title: 'Italienisch Intensiv', canton: 'Zug' }],
          error: null,
        },
        profiles: {
          data: [PROVIDER, { ...PROVIDER, slug: 'zweite-schule' }],
          error: null,
        },
      })
    );

    const withLastmod = urlEntries(res._sent)
      .filter((entry) => entry.lastmod !== undefined)
      .map((entry) => entry.loc);

    expect(withLastmod.filter((loc) => loc.includes('/courses/'))).toEqual([]);
    expect(withLastmod.filter((loc) => loc.startsWith(`${BASE}/anbieter/`))).toEqual([]);
  });

  it('kein Build-, Deploy- oder Heute-Datum als Ersatz-lastmod', async () => {
    const res = await renderSitemap(fullTables());

    const today = new Date().toISOString().slice(0, 10);
    const course = entryFor(res._sent, COURSE_URL);
    const provider = entryFor(res._sent, PROVIDER_URL);

    expect(course.block).not.toContain(today);
    expect(provider.block).not.toContain(today);
  });
});

// ============================================================
// 3. Echte Änderungsquelle wird exakt ausgegeben (Themenwelten)
// ============================================================

describe('Sitemap: echte Änderungsquelle bleibt exakt erhalten', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.VITE_SITE_URL = BASE;
    process.env.VITE_THEME_WORLD_DB_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.VITE_THEME_WORLD_DB_ENABLED;
    vi.restoreAllMocks();
  });

  it('3. Themenwelt gibt genau ihr getriggertes updated_at aus', async () => {
    const res = await renderSitemap(fullTables());

    const themeWorld = entryFor(res._sent, THEME_WORLD_URL);
    expect(themeWorld).toBeDefined();
    expect(themeWorld.lastmod).toBe(THEME_WORLD_UPDATED_AT);
  });

  it('3b. Blog-lastmod bleibt unverändert (ausserhalb dieses Fixes)', async () => {
    const res = await renderSitemap(fullTables());

    const blog = entryFor(res._sent, BLOG_URL);
    expect(blog).toBeDefined();
    expect(blog.lastmod).toBe(BLOG_CREATED_AT);
  });
});

// ============================================================
// 5./6./7. URLs und Eligibility unverändert
// ============================================================

describe('Sitemap: URLs und Eligibility unverändert', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.VITE_SITE_URL = BASE;
    process.env.VITE_THEME_WORLD_DB_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.VITE_THEME_WORLD_DB_ENABLED;
    vi.restoreAllMocks();
  });

  it('5. Course-URL bleibt kanonisch korrekt', async () => {
    const res = await renderSitemap(fullTables());

    const { buildCanonicalCoursePath } = await import('../src/lib/courseUrl.js');
    expect(entryFor(res._sent, COURSE_URL)).toBeDefined();
    expect(entryFor(res._sent, `${BASE}${buildCanonicalCoursePath(COURSE)}`)).toBeDefined();
  });

  it('6. Provider-URL bleibt /anbieter/{slug}', async () => {
    const res = await renderSitemap(fullTables());

    expect(entryFor(res._sent, PROVIDER_URL)).toBeDefined();
    expect(entryFor(res._sent, PROVIDER_URL).block).toContain('<priority>0.6</priority>');
    expect(entryFor(res._sent, PROVIDER_URL).block).toContain('<changefreq>weekly</changefreq>');
  });

  it('7a. Course-Eintragsmenge unverändert — publiziert rein, Kategorie-Ausfall raus', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const numericCourse = {
      ...COURSE,
      id: 779,
      title: 'Wax Ring Carving',
      category_area: '12',
      canton: 'Zürich',
    };

    const withCategory = await renderSitemap(
      fullTables({
        courses: { data: [COURSE, numericCourse], error: null },
        v_course_full_categories: {
          data: [{
            course_id: 779,
            is_primary: true,
            level1_id: 1, level1_slug: 'privat', level1_label_de: 'Privat & Hobby',
            level2_id: 12, level2_slug: 'kunst', level2_label_de: 'Kunst & Kreativ',
            level3_id: 130, level3_slug: 'schmuck', level3_label_de: 'Schmuck',
            level4_id: null, level4_slug: null, level4_label_de: null,
          }],
          error: null,
        },
      })
    );

    const withCategoryLocs = urlEntries(withCategory._sent)
      .map((entry) => entry.loc)
      .filter((loc) => loc.includes('/courses/'));
    expect(withCategoryLocs).toEqual([
      COURSE_URL,
      `${BASE}/courses/kunst/zuerich/779-wax-ring-carving`,
    ]);

    const withoutCategory = await renderSitemap(
      fullTables({
        courses: { data: [COURSE, numericCourse], error: null },
        v_course_full_categories: { data: null, error: { message: 'view down' } },
      })
    );

    const withoutCategoryLocs = urlEntries(withoutCategory._sent)
      .map((entry) => entry.loc)
      .filter((loc) => loc.includes('/courses/'));
    expect(withoutCategoryLocs).toEqual([COURSE_URL]);
  });

  it('7b. Provider-Eligibility unverändert — mit publiziertem Kurs rein, ohne raus', async () => {
    const providerProfileLocs = (xml) => urlEntries(xml)
      .map((entry) => entry.loc)
      .filter((loc) => loc.startsWith(`${BASE}/anbieter/`));

    const eligible = await renderSitemap(fullTables());
    expect(providerProfileLocs(eligible._sent)).toEqual([PROVIDER_URL]);

    // Kein publizierter Kurs → Profil fällt aus der Sitemap.
    const notEligible = await renderSitemap(fullTables({ courses: { data: [], error: null } }));
    expect(providerProfileLocs(notEligible._sent)).toEqual([]);

    // Die statische Anbieter-Übersicht bleibt in beiden Fällen erhalten.
    expect(entryFor(eligible._sent, `${BASE}/anbieter`)).toBeDefined();
    expect(entryFor(notEligible._sent, `${BASE}/anbieter`)).toBeDefined();
  });
});

// ============================================================
// 8./9. Regression: übrige Sitemap-Familien und XML-Validität
// ============================================================

describe('Sitemap: Regression übrige Familien und XML', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.VITE_SITE_URL = BASE;
    process.env.VITE_THEME_WORLD_DB_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.VITE_THEME_WORLD_DB_ENABLED;
    vi.restoreAllMocks();
  });

  it('8. Blog-, Ratgeber-, Bereich- und Themenwelt-Familien unverändert vorhanden', async () => {
    const res = await renderSitemap(fullTables());
    const locs = urlEntries(res._sent).map((entry) => entry.loc);

    expect(locs).toContain(BLOG_URL);
    expect(locs).toContain(`${BASE}/ratgeber`);
    expect(locs).toContain(`${BASE}/ratgeber/beruflich/finanzierung`);
    expect(locs).toContain(`${BASE}/ratgeber/beruflich/finanzierung/vollkostenrechnung-weiterbildung`);
    expect(locs).toContain(THEME_WORLD_URL);
    expect(locs).toContain(`${BASE}/search`);
    expect(locs).toContain(BASE);
  });

  it('8b. Ratgeber-, Bereich- und Thema-URLs tragen weiterhin kein lastmod', async () => {
    const res = await renderSitemap(fullTables());

    const ratgeber = entryFor(res._sent, `${BASE}/ratgeber/beruflich/finanzierung`);
    expect(ratgeber.lastmod).toBeUndefined();
  });

  it('9. XML bleibt valide und wohlgeformt', async () => {
    const res = await renderSitemap(fullTables());
    const xml = res._sent;

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/xml');
    expect(xml.trimStart()).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);

    // Tag-Bilanz: jedes geöffnete Element wird geschlossen.
    const count = (needle) => (xml.match(new RegExp(needle, 'g')) || []).length;
    expect(count('<url>')).toBe(count('</url>'));
    expect(count('<loc>')).toBe(count('</loc>'));
    expect(count('<lastmod>')).toBe(count('</lastmod>'));
    expect(count('<changefreq>')).toBe(count('</changefreq>'));
    expect(count('<priority>')).toBe(count('</priority>'));

    // Jeder verbleibende lastmod-Wert ist ein gültiges W3C-Datetime.
    for (const entry of urlEntries(xml)) {
      if (entry.lastmod === undefined) continue;
      expect(entry.lastmod).not.toBe('');
      expect(Number.isNaN(new Date(entry.lastmod).getTime())).toBe(false);
    }

    // Reihenfolge innerhalb eines Eintrags bleibt loc → [lastmod] → changefreq → priority.
    for (const entry of urlEntries(xml)) {
      const order = [...entry.block.matchAll(/<(loc|lastmod|changefreq|priority)>/g)].map((m) => m[1]);
      const expectedOrder = ['loc', 'lastmod', 'changefreq', 'priority'].filter((tag) => order.includes(tag));
      expect(order).toEqual(expectedOrder);
    }
  });
});
