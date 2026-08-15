/**
 * Tests für die dynamische Themenwelten-Erkennung in der Sitemap.
 *
 * Hintergrund:
 *   Bereichs-Landingpages entstanden bisher ausschliesslich aus der statischen
 *   Legacy-Konfiguration BEREICH_LANDING_CONFIG. Themenwelten, die nur in der
 *   Datenbank existieren (theme_worlds / theme_world_scenarios), fehlten damit
 *   vollständig in der Sitemap.
 *
 * Verifiziert:
 *   1. publizierte DB-Themenwelt erscheint
 *   2. publiziertes Szenario erscheint
 *   3. Draft-Themenwelt erscheint nicht
 *   4. Draft-Szenario erscheint nicht
 *   5. Szenario einer nicht publizierten Themenwelt erscheint nicht
 *   6. Legacy-Bereichsseiten bleiben erhalten
 *   7. identische Legacy-/DB-Themenwelt-URL erscheint exakt einmal
 *   8. identische Szenario-URL erscheint exakt einmal
 *   9. DB-Fehler im Themenwelten-Teil zerstört nicht die gesamte Sitemap
 *  10. bestehende Sitemap-Bereiche (Kurse, Blog, Anbieter, Ratgeber, /thema) bleiben
 *
 * Supabase wird vollständig gemockt — kein echter DB-Zugriff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BEREICH_LANDING_CONFIG } from '../src/lib/bereichLandingConfig.js';

// ============================================================
// Mock-Infrastruktur
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

/**
 * Minimaler PostgREST-Query-Mock.
 * Wendet .eq() und .in() tatsächlich auf den Datensatz an, damit Tests
 * verifizieren, dass der Handler wirklich filtert (und nicht nur zufällig
 * gefilterte Mock-Daten bekommt).
 */
function makeSupabaseMock(tables) {
  const calls = [];

  const from = vi.fn((table) => {
    const config = tables[table] ?? { data: [], error: null };
    const filters = [];
    calls.push({ table, filters });

    const chain = {};
    for (const method of ['select', 'or', 'not', 'order', 'limit', 'neq', 'gte']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.eq = vi.fn((column, value) => {
      filters.push({ type: 'eq', column, value });
      return chain;
    });
    chain.in = vi.fn((column, values) => {
      filters.push({ type: 'in', column, values });
      return chain;
    });
    chain.then = (resolve, reject) => {
      let result;
      if (config.error) {
        result = { data: null, error: config.error };
      } else {
        let rows = config.data ?? [];
        for (const filter of filters) {
          if (filter.type === 'eq') {
            rows = rows.filter((row) => row[filter.column] === filter.value);
          } else if (filter.type === 'in') {
            rows = rows.filter((row) => filter.values.includes(row[filter.column]));
          }
        }
        result = { data: rows, error: null };
      }
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  });

  return { client: { from }, calls };
}

const mockState = { supabase: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockState.supabase),
}));

const BASE = 'https://kursnavi.ch';

const WORLD_PUBLISHED = 'w-published';
const WORLD_DRAFT = 'w-draft';

function defaultTables(overrides = {}) {
  return {
    courses: {
      data: [{
        id: 'course-1',
        title: 'Yoga Basis',
        category_area: 'Yoga',
        canton: 'ZH',
        created_at: '2026-01-01T00:00:00.000Z',
        user_id: 'provider-1',
      }],
      error: null,
    },
    articles: {
      data: [{ id: 'a1', slug: 'mein-blogpost', title: 'Blog', is_published: true, created_at: '2026-01-02T00:00:00.000Z' }],
      error: null,
    },
    profiles: {
      data: [{
        id: 'provider-1',
        slug: 'mein-anbieter',
        package_tier: 'pro',
        profile_published_at: '2026-01-03T00:00:00.000Z',
      }],
      error: null,
    },
    theme_worlds: {
      data: [
        {
          id: WORLD_PUBLISHED,
          url_segment: 'privat-hobby',
          slug: 'neue-db-themenwelt',
          status: 'published',
          updated_at: '2026-02-01T00:00:00.000Z',
          published_at: '2026-01-20T00:00:00.000Z',
        },
        {
          id: WORLD_DRAFT,
          url_segment: 'beruflich',
          slug: 'geheimer-entwurf',
          status: 'draft',
          updated_at: '2026-02-02T00:00:00.000Z',
          published_at: null,
        },
      ],
      error: null,
    },
    theme_world_scenarios: {
      data: [
        {
          theme_world_id: WORLD_PUBLISHED,
          slug: 'publiziertes-szenario',
          status: 'published',
          updated_at: '2026-02-03T00:00:00.000Z',
          published_at: '2026-01-25T00:00:00.000Z',
        },
        {
          theme_world_id: WORLD_PUBLISHED,
          slug: 'entwurf-szenario',
          status: 'draft',
          updated_at: '2026-02-04T00:00:00.000Z',
          published_at: null,
        },
        {
          theme_world_id: WORLD_DRAFT,
          slug: 'szenario-von-entwurfswelt',
          status: 'published',
          updated_at: '2026-02-05T00:00:00.000Z',
          published_at: '2026-01-26T00:00:00.000Z',
        },
      ],
      error: null,
    },
    ...overrides,
  };
}

async function runSitemap(tables) {
  const { client, calls } = makeSupabaseMock(tables);
  mockState.supabase = client;

  const { default: handler } = await import('../api/sitemap.js');
  const req = makeMockReq();
  const res = makeMockRes();
  await handler(req, res);

  return { res, xml: res._sent || '', calls };
}

function countLoc(xml, url) {
  return (xml.match(new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`, 'g')) || []).length;
}

describe('Sitemap: dynamische Themenwelten aus der Datenbank', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.VITE_SITE_URL = BASE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockState.supabase = null;
  });

  it('1. publizierte DB-Themenwelt erscheint in der Sitemap', async () => {
    const { res, xml } = await runSitemap(defaultTables());

    expect(res._status).toBe(200);
    expect(countLoc(xml, `${BASE}/bereich/privat-hobby/neue-db-themenwelt`)).toBe(1);
  });

  it('2. publiziertes Szenario einer publizierten Themenwelt erscheint', async () => {
    const { xml } = await runSitemap(defaultTables());

    expect(countLoc(xml, `${BASE}/bereich/privat-hobby/neue-db-themenwelt/publiziertes-szenario`)).toBe(1);
  });

  it('3. Draft-Themenwelt erscheint nicht', async () => {
    const { xml } = await runSitemap(defaultTables());

    expect(xml).not.toContain('geheimer-entwurf');
    expect(countLoc(xml, `${BASE}/bereich/beruflich/geheimer-entwurf`)).toBe(0);
  });

  it('4. Draft-Szenario erscheint nicht', async () => {
    const { xml } = await runSitemap(defaultTables());

    expect(xml).not.toContain('entwurf-szenario');
  });

  it('5. Szenario einer nicht publizierten Themenwelt erscheint nicht', async () => {
    const { xml } = await runSitemap(defaultTables());

    expect(xml).not.toContain('szenario-von-entwurfswelt');
  });

  it('filtert Themenwelten und Szenarien serverseitig auf status=published', async () => {
    const { calls } = await runSitemap(defaultTables());

    const worldCall = calls.find((c) => c.table === 'theme_worlds');
    expect(worldCall.filters).toContainEqual({ type: 'eq', column: 'status', value: 'published' });

    const scenarioCall = calls.find((c) => c.table === 'theme_world_scenarios');
    expect(scenarioCall.filters).toContainEqual({ type: 'eq', column: 'status', value: 'published' });
    // Szenarien werden zusätzlich auf die IDs publizierter Themenwelten eingeschränkt
    const inFilter = scenarioCall.filters.find((f) => f.type === 'in' && f.column === 'theme_world_id');
    expect(inFilter.values).toEqual([WORLD_PUBLISHED]);
  });

  it('fragt Szenarien gar nicht ab, wenn keine Themenwelt publiziert ist', async () => {
    const tables = defaultTables();
    tables.theme_worlds.data = [tables.theme_worlds.data[1]]; // nur Draft
    const { calls, res } = await runSitemap(tables);

    expect(res._status).toBe(200);
    expect(calls.some((c) => c.table === 'theme_world_scenarios')).toBe(false);
  });

  it('überspringt Themenwelten mit unzulässigem URL-Format', async () => {
    const tables = defaultTables();
    tables.theme_worlds.data = [{
      id: 'w-bad',
      url_segment: '../admin',
      slug: 'ok-slug',
      status: 'published',
      updated_at: null,
      published_at: null,
    }];
    const { xml, res } = await runSitemap(tables);

    expect(res._status).toBe(200);
    expect(xml).not.toContain('../admin');
    expect(xml).not.toContain('ok-slug');
  });
});

describe('Sitemap: Legacy-Bereiche und Deduplizierung', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.VITE_SITE_URL = BASE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockState.supabase = null;
  });

  it('6. Legacy-Bereichsseiten bleiben erhalten', async () => {
    const { xml } = await runSitemap(defaultTables());

    for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
      const path = `${BASE}/bereich/${bereich.segment}/${bereich.slug}`;
      expect(countLoc(xml, path)).toBe(1);
      for (const szenario of (bereich.scenarios || [])) {
        expect(countLoc(xml, `${path}/${szenario.slug}`)).toBe(1);
      }
    }
  });

  it('7. identische Legacy-/DB-Themenwelt-URL erscheint exakt einmal', async () => {
    const legacyYoga = Object.values(BEREICH_LANDING_CONFIG)
      .find((b) => b.slug === 'yoga-achtsamkeit');
    expect(legacyYoga).toBeTruthy();

    const tables = defaultTables();
    tables.theme_worlds.data.push({
      id: 'w-yoga',
      url_segment: legacyYoga.segment,
      slug: legacyYoga.slug,
      status: 'published',
      updated_at: '2026-03-01T00:00:00.000Z',
      published_at: '2026-02-01T00:00:00.000Z',
    });

    const { xml } = await runSitemap(tables);

    expect(countLoc(xml, `${BASE}/bereich/${legacyYoga.segment}/${legacyYoga.slug}`)).toBe(1);
  });

  it('8. identische Szenario-URL aus Legacy und DB erscheint exakt einmal', async () => {
    const legacyYoga = Object.values(BEREICH_LANDING_CONFIG)
      .find((b) => b.slug === 'yoga-achtsamkeit');
    const legacyScenario = legacyYoga.scenarios[0];

    const tables = defaultTables();
    tables.theme_worlds.data.push({
      id: 'w-yoga',
      url_segment: legacyYoga.segment,
      slug: legacyYoga.slug,
      status: 'published',
      updated_at: '2026-03-01T00:00:00.000Z',
      published_at: '2026-02-01T00:00:00.000Z',
    });
    tables.theme_world_scenarios.data.push({
      theme_world_id: 'w-yoga',
      slug: legacyScenario.slug,
      status: 'published',
      updated_at: '2026-03-02T00:00:00.000Z',
      published_at: '2026-02-02T00:00:00.000Z',
    });

    const { xml } = await runSitemap(tables);

    const url = `${BASE}/bereich/${legacyYoga.segment}/${legacyYoga.slug}/${legacyScenario.slug}`;
    expect(countLoc(xml, url)).toBe(1);
    // Gesamtzahl aller <url>-Blöcke = Zahl eindeutiger <loc>-Werte
    const locs = xml.match(/<loc>[^<]+<\/loc>/g) || [];
    expect(new Set(locs).size).toBe(locs.length);
  });
});

describe('Sitemap: Robustheit bei Themenwelten-DB-Fehlern', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.VITE_SITE_URL = BASE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockState.supabase = null;
  });

  it('9. Fehler beim Laden der Themenwelten zerstört nicht die gesamte Sitemap', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tables = defaultTables();
    tables.theme_worlds = { data: null, error: { message: 'connection reset' } };

    const { res, xml } = await runSitemap(tables);

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/xml');
    // Legacy-Bereiche bleiben vollständig erhalten
    for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
      expect(countLoc(xml, `${BASE}/bereich/${bereich.segment}/${bereich.slug}`)).toBe(1);
    }
    // Kurse, Blog und Anbieter bleiben erhalten
    expect(xml).toContain(`${BASE}/blog/mein-blogpost`);
    expect(xml).toContain(`${BASE}/anbieter/mein-anbieter`);
    expect(xml).toContain('/courses/');
    // Fehler wird sichtbar geloggt
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.flat().join(' ')).toMatch(/[Tt]hemenwelt/);
  });

  it('Szenario-Fehler behält die Themenwelt-URLs bei', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const tables = defaultTables();
    tables.theme_world_scenarios = { data: null, error: { message: 'timeout' } };

    const { res, xml } = await runSitemap(tables);

    expect(res._status).toBe(200);
    expect(countLoc(xml, `${BASE}/bereich/privat-hobby/neue-db-themenwelt`)).toBe(1);
    expect(xml).not.toContain('publiziertes-szenario');
  });
});

describe('Sitemap: bestehende Bereiche bleiben unverändert', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.VITE_SITE_URL = BASE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockState.supabase = null;
  });

  it('10. Kurse, Blog, Anbieter, Ratgeber, /thema und statische Seiten sind vorhanden', async () => {
    const { xml, res } = await runSitemap(defaultTables());

    expect(res._status).toBe(200);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(`<loc>${BASE}</loc>`);
    expect(xml).toContain(`${BASE}/search`);
    expect(xml).toContain(`${BASE}/courses/yoga/zh/course-1-yoga-basis`);
    expect(xml).toContain(`${BASE}/blog/mein-blogpost`);
    expect(xml).toContain(`${BASE}/anbieter/mein-anbieter`);
    expect(xml).toContain(`${BASE}/ratgeber</loc>`);
    expect(xml).toContain(`${BASE}/ratgeber/beruflich/finanzierung/vollkostenrechnung-weiterbildung`);
    expect(xml).toContain(`${BASE}/thema/`);
  });
});
