/**
 * Tests für die serverseitige Kanonisierung von Hosts und Kurs-URLs.
 *
 * Audit-Befund:
 *   - https://www.kursnavi.ch/... lieferte HTTP 200 (kein Redirect auf non-www)
 *   - /courses/12/zuerich/779-... lieferte HTTP 200 statt einer Weiterleitung
 *     auf /courses/kunst/zuerich/779-...
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

const vercelConfig = JSON.parse(readFileSync('./vercel.json', 'utf8'));

// ============================================================
// www → non-www
// ============================================================

describe('www → non-www Redirect (vercel.json)', () => {
  const wwwRedirect = vercelConfig.redirects.find((rule) =>
    (rule.has || []).some((cond) => cond.type === 'host' && cond.value === 'www.kursnavi.ch')
  );

  it('existiert', () => {
    expect(wwwRedirect).toBeDefined();
  });

  it('ist permanent (308)', () => {
    expect(wwwRedirect.permanent).toBe(true);
  });

  it('erhält den Pfad', () => {
    expect(wwwRedirect.source).toBe('/:path*');
    expect(wwwRedirect.destination).toBe('https://kursnavi.ch/:path*');
  });

  it('zielt auf die kanonische Domain über HTTPS', () => {
    expect(wwwRedirect.destination.startsWith('https://kursnavi.ch')).toBe(true);
    expect(wwwRedirect.destination).not.toContain('www.');
    expect(wwwRedirect.destination).not.toContain('http://');
  });

  it('steht vor den Pfad-Redirects, damit der Host in einem Hop korrekt ist', () => {
    const index = vercelConfig.redirects.indexOf(wwwRedirect);
    expect(index).toBe(0);
  });

  it('beschädigt den bestehenden Theme-World-Redirect nicht', () => {
    const bereichRedirect = vercelConfig.redirects.find(
      (rule) => rule.source === '/bereich/privat_hobby/:path*'
    );
    expect(bereichRedirect).toBeDefined();
    expect(bereichRedirect.destination).toBe('/bereich/privat-hobby/:path*');
    expect(bereichRedirect.permanent).toBe(true);
  });

  it('greift nur für den www-Host — non-www erzeugt keine Kette', () => {
    // Nur eine einzige host-gebundene Regel; sie kann sich nicht selbst treffen,
    // weil ihr Ziel den www-Host nicht mehr enthält.
    const hostRules = vercelConfig.redirects.filter((rule) =>
      (rule.has || []).some((cond) => cond.type === 'host')
    );
    expect(hostRules).toHaveLength(1);
  });
});

// ============================================================
// Rewrite für numerische Kurs-URLs
// ============================================================

describe('Rewrite für Kurs-URLs mit numerischem Themensegment', () => {
  const courseRewrite = vercelConfig.rewrites.find((rule) =>
    rule.destination.startsWith('/api/course-redirect')
  );

  it('existiert und trifft nur rein numerische Themensegmente', () => {
    expect(courseRewrite).toBeDefined();
    expect(courseRewrite.source).toBe('/courses/:topic(\\d+)/:location/:course');
  });

  it('übergibt alle drei Segmente an die Funktion', () => {
    expect(courseRewrite.destination).toContain('__topic=:topic');
    expect(courseRewrite.destination).toContain('__loc=:location');
    expect(courseRewrite.destination).toContain('__cseg=:course');
  });

  it('steht vor dem SPA-Catch-all', () => {
    const rewriteIndex = vercelConfig.rewrites.indexOf(courseRewrite);
    const catchAllIndex = vercelConfig.rewrites.findIndex((rule) => rule.source === '/(.*)');
    expect(rewriteIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThan(rewriteIndex);
  });

  it('bekommt die SPA-Shell mitgebündelt (Fallback ohne Redirect)', () => {
    expect(vercelConfig.functions['api/course-redirect.js']).toEqual({
      includeFiles: 'dist/index.html',
    });
  });

  it('lässt bestehende Rewrites unverändert', () => {
    const sources = vercelConfig.rewrites.map((rule) => rule.source);
    expect(sources).toContain('/sitemap.xml');
    expect(sources).toContain('/thema/:segment/:slug');
    expect(sources).toContain('/api/(.*)');
    expect(sources).toContain('/(.*)');
  });
});

// ============================================================
// Handler-Verhalten
// ============================================================

describe('api/course-redirect Handler', () => {
  let handler;
  let parseCourseRedirectRequest;

  const COURSE_ROW = {
    id: 779,
    title: '18k Gold Wax Ring Carving Workshop für zwei Personen',
    canton: 'Zürich',
    category_type: 'privat',
    category_area: '12',
  };

  const CATEGORY_ROW = {
    course_id: 779,
    is_primary: true,
    level1_id: 1,
    level1_slug: 'privat',
    level1_label_de: 'Privat & Hobby',
    level2_id: 12,
    level2_slug: 'kunst',
    level2_label_de: 'Kunst & Kreativ',
    level3_id: 130,
    level3_slug: 'schmuck',
    level3_label_de: 'Schmuck',
    level4_id: null,
    level4_slug: null,
    level4_label_de: null,
  };

  function makeRes() {
    return {
      _status: null,
      _headers: {},
      _sent: null,
      status(code) { this._status = code; return this; },
      setHeader(key, value) { this._headers[key] = value; },
      send(body) { this._sent = body; return this; },
    };
  }

  function mockSupabase({ course = COURSE_ROW, categories = [CATEGORY_ROW], courseError = null } = {}) {
    return {
      from: (table) => {
        if (table === 'v_course_full_categories') {
          const chain = {
            select: () => chain,
            in: () => Promise.resolve({ data: categories, error: null }),
          };
          return chain;
        }
        const chain = {
          select: () => chain,
          eq: () => chain,
          or: () => chain,
          limit: () => Promise.resolve({ data: course ? [course] : [], error: courseError }),
        };
        return chain;
      },
    };
  }

  beforeEach(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  async function loadHandler(supabaseMock) {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => supabaseMock,
    }));
    const mod = await import('../api/course-redirect.js');
    handler = mod.default;
    parseCourseRedirectRequest = mod.parseCourseRedirectRequest;
    return mod;
  }

  it('leitet eine numerische Kurs-URL permanent auf die kanonische URL', async () => {
    await loadHandler(mockSupabase());
    const res = makeRes();
    await handler(
      { query: { __topic: '12', __loc: 'zuerich', __cseg: '779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen' } },
      res
    );

    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe(
      '/courses/kunst/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen'
    );
  });

  it('kanonisiert auch bei falschem Orts- und Titel-Slug anhand der ID', async () => {
    await loadHandler(mockSupabase());
    const res = makeRes();
    await handler({ query: { __topic: '12', __loc: 'falsch', __cseg: '779-voellig-falscher-titel' } }, res);

    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe(
      '/courses/kunst/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen'
    );
  });

  it('erhält den Querystring des Besuchers', async () => {
    await loadHandler(mockSupabase());
    const res = makeRes();
    await handler(
      { query: { __topic: '12', __loc: 'zuerich', __cseg: '779-x', utm_source: 'newsletter', ref: 'abc' } },
      res
    );

    expect(res._status).toBe(308);
    expect(res._headers.Location).toContain('?utm_source=newsletter&ref=abc');
    expect(res._headers.Location).not.toContain('__topic');
    expect(res._headers.Location).not.toContain('__cseg');
  });

  it('liefert die SPA-Shell statt eines Fehlers, wenn der Kurs unbekannt ist', async () => {
    await loadHandler(mockSupabase({ course: null, categories: [] }));
    const res = makeRes();
    await handler({ query: { __topic: '12', __loc: 'zuerich', __cseg: '99999-weg' } }, res);

    expect([200, 404]).toContain(res._status);
    expect(res._headers.Location).toBeUndefined();
  });

  it('liefert die SPA-Shell, wenn die Datenbank einen Fehler meldet', async () => {
    await loadHandler(mockSupabase({ course: null, courseError: { message: 'boom' } }));
    const res = makeRes();
    await handler({ query: { __topic: '12', __loc: 'zuerich', __cseg: '779-x' } }, res);

    expect(res._headers.Location).toBeUndefined();
  });

  it('parst die injizierten Parameter und trennt sie von der echten Query', async () => {
    await loadHandler(mockSupabase());
    const parsed = parseCourseRedirectRequest({
      query: { __topic: '12', __loc: 'zuerich', __cseg: '779-titel-slug', page: '2' },
    });
    expect(parsed.courseId).toBe('779');
    expect(parsed.originalPath).toBe('/courses/12/zuerich/779-titel-slug');
    expect(parsed.search).toBe('page=2');
  });
});
