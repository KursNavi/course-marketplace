/**
 * Tests für die serverseitige Kanonisierung von Hosts und Kurs-URLs.
 *
 * Audit-Befund:
 *   - https://www.kursnavi.ch/... lieferte HTTP 200 (kein Redirect auf non-www)
 *   - alte /courses/-URLs lieferten HTTP 200 statt einer Weiterleitung auf
 *     ihren aktuellen kanonischen Pfad
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

const vercelConfig = JSON.parse(readFileSync('./vercel.json', 'utf8'));

const courseRewrite = vercelConfig.rewrites.find((rule) =>
  rule.destination.startsWith('/api/course-redirect')
);

/** Benannte Captures einer vercel.json-Source, in Reihenfolge. */
function captureNames(source) {
  return [...source.matchAll(/:(\w+)/g)].map(([, name]) => name);
}

/**
 * Bildet nach, was die Function nach dem Rewrite tatsächlich in `req.query`
 * sieht: Vercel hängt **jeden** benannten Source-Capture an die
 * Destination-Query an — zusätzlich zur Query des Besuchers.
 *
 * Genau dieses Auto-Append hat den Leak erzeugt (`?topic=12&location=…`), als
 * die Captures noch `:topic`/`:location`/`:course` hiessen. Der Test leitet die
 * Namen deshalb aus vercel.json ab statt sie zu wiederholen.
 *
 * @returns {object|null} `req.query` oder null, wenn die Regel nicht greift
 */
function simulateVercelRewrite(rule, requestUrl) {
  const [pathname, rawQuery = ''] = requestUrl.split('?');

  const pattern = rule.source.replace(
    /:(\w+)(\(([^)]*)\))?/g,
    (_match, _name, _group, custom) => `(${custom || '[^/]+'})`
  );
  const matched = new RegExp(`^${pattern}$`).exec(pathname);
  if (!matched) return null;

  const query = {};
  const append = (key, value) => {
    query[key] = key in query ? [].concat(query[key], value) : value;
  };

  for (const [key, value] of new URLSearchParams(rawQuery)) append(key, value);
  captureNames(rule.source).forEach((name, index) => append(name, matched[index + 1]));

  return query;
}

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
// Rewrite für nicht-kanonische Kurs-URLs
// ============================================================

describe('Rewrite für Kurs-URLs', () => {
  it('existiert und übergibt auch alte Text-Slugs an die Kanonisierung', () => {
    expect(courseRewrite).toBeDefined();
    expect(courseRewrite.source).toBe('/courses/:__topic/:__loc/:__cseg');
  });

  it('übergibt alle drei Segmente über die Source-Captures an die Funktion', () => {
    // Vercel hängt die Captures selbst an die Query an — eine explizite Query
    // in der Destination würde die Parameter nur zusätzlich unter einem
    // zweiten Namen erzeugen (genau das war der Query-Leak).
    expect(captureNames(courseRewrite.source)).toEqual(['__topic', '__loc', '__cseg']);
    expect(courseRewrite.destination).toBe('/api/course-redirect');
    expect(courseRewrite.destination).not.toContain('?');
  });

  it('benennt die Captures exakt wie INJECTED_PARAMS der Funktion', () => {
    // Diese Kopplung ist der eigentliche Fix: Weicht sie auf, landen die
    // Rewrite-internen Parameter wieder im 308-Location-Header.
    const source = readFileSync('./api/course-redirect.js', 'utf8');
    const declaration = source.match(/const INJECTED_PARAMS = \[([^\]]*)\]/);
    expect(declaration).not.toBeNull();

    const injected = declaration[1]
      .split(',')
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);

    expect([...injected].sort()).toEqual([...captureNames(courseRewrite.source)].sort());
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

    // /thema behält seine eigene Parameterübergabe (andere Function, eigener Vertrag).
    const themaRewrite = vercelConfig.rewrites.find((rule) => rule.source === '/thema/:segment/:slug');
    expect(themaRewrite.destination).toBe('/api/thema-redirect?segment=:segment&slug=:slug');

    // Die 404-Rewrites aus PR #104 bleiben unberührt.
    expect(
      vercelConfig.rewrites
        .filter((rule) => rule.destination === '/api/resource-not-found')
        .map((rule) => rule.source)
    ).toEqual([
      '/bereich/:segment/:slug',
      '/bereich/:segment/:slug/:rest*',
      '/ratgeber/:category',
      '/ratgeber/:category/:cluster',
      '/ratgeber/:category/:cluster/:rest*',
    ]);
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

  function mockSupabase({
    course = COURSE_ROW,
    categories = [CATEGORY_ROW],
    courseError = null,
    categoryError = null,
  } = {}) {
    return {
      from: (table) => {
        if (table === 'v_course_full_categories') {
          const chain = {
            select: () => chain,
            in: () => Promise.resolve({
              data: categoryError ? null : categories,
              error: categoryError,
            }),
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

  /** Nur das öffentliche Paar — so ist die Preview/Production-Konfiguration gesetzt. */
  function setPublicEnv() {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://public.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', 'public-anon-key');
  }

  beforeEach(async () => {
    vi.unstubAllEnvs();
    setPublicEnv();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /** Merkt sich, womit createClient aufgerufen wurde. */
  let createClientSpy;

  async function loadHandler(supabaseMock) {
    createClientSpy = vi.fn(() => supabaseMock);
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: createClientSpy,
    }));
    const mod = await import('../api/course-redirect.js');
    handler = mod.default;
    parseCourseRedirectRequest = mod.parseCourseRedirectRequest;
    return mod;
  }

  const NUMERIC_REQ = {
    query: { __topic: '12', __loc: 'zuerich', __cseg: '779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen' },
  };
  const CANONICAL_779 =
    '/courses/kunst/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen';

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

  it('kanonisiert auch einen überholten Text-Slug im Themenpfad', async () => {
    await loadHandler(mockSupabase());
    const res = makeRes();
    await handler(
      { query: { __topic: 'alltag-leben', __loc: 'falsch', __cseg: '779-veralteter-titel' } },
      res
    );

    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe(CANONICAL_779);
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

  it('leitet nicht weiter, wenn die Kategorie nicht auflösbar ist (kein geratenes 308)', async () => {
    await loadHandler(mockSupabase({ categoryError: { message: 'view down' } }));
    const res = makeRes();
    await handler(NUMERIC_REQ, res);

    // Kurs 779 hat nur category_area="12" — ohne View-Daten wäre das Thema geraten.
    expect(res._headers.Location).toBeUndefined();
    expect([200, 404]).toContain(res._status);
  });

  it('leitet trotz Kategoriefehler weiter, wenn der Kurs selbst ein semantisches Thema hat', async () => {
    const legacyCourse = {
      id: 363,
      title: 'Spanisch Konversationskurs',
      canton: 'Bern',
      category_type: 'privat',
      category_area: 'sprachen_privat',
    };
    await loadHandler(mockSupabase({ course: legacyCourse, categoryError: { message: 'view down' } }));
    const res = makeRes();
    await handler({ query: { __topic: '12', __loc: 'falsch', __cseg: '363-x' } }, res);

    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe('/courses/sprachen-privat/bern/363-spanisch-konversationskurs');
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

  // ============================================================
  // Ende zu Ende: vercel.json-Rewrite + Handler
  // ============================================================

  describe('Rewrite-interne Parameter erreichen den Location-Header nie', () => {
    const LEGACY_URL =
      '/courses/12/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen';

    /** Namen, die ausschliesslich intern sind — in keiner Variante erlaubt. */
    const FORBIDDEN = ['topic=', 'location=', 'course=', '__topic', '__loc', '__cseg'];

    /** Schickt eine echte Besucher-URL durch Rewrite-Simulation und Handler. */
    async function follow(requestUrl) {
      const query = simulateVercelRewrite(courseRewrite, requestUrl);
      expect(query).not.toBeNull();

      await loadHandler(mockSupabase());
      const res = makeRes();
      await handler({ query }, res);

      expect(res._status).toBe(308);
      for (const marker of FORBIDDEN) {
        expect(res._headers.Location).not.toContain(marker);
      }
      return res._headers.Location;
    }

    it('1. ohne Besucherquery bleibt das Ziel query-frei', async () => {
      expect(await follow(LEGACY_URL)).toBe(CANONICAL_779);
    });

    it('2. utm_source bleibt exakt erhalten', async () => {
      expect(await follow(`${LEGACY_URL}?utm_source=audit`)).toBe(
        `${CANONICAL_779}?utm_source=audit`
      );
    });

    it('3. mehrere echte Besucherparameter bleiben vollständig erhalten', async () => {
      expect(await follow(`${LEGACY_URL}?utm_source=audit&utm_medium=test`)).toBe(
        `${CANONICAL_779}?utm_source=audit&utm_medium=test`
      );
    });

    it('4. vom Besucher eingeschleuste interne Parameter werden verworfen', async () => {
      expect(await follow(`${LEGACY_URL}?__topic=evil&utm_source=audit`)).toBe(
        `${CANONICAL_779}?utm_source=audit`
      );
      expect(await follow(`${LEGACY_URL}?__loc=evil&__cseg=1-evil&utm_source=audit`)).toBe(
        `${CANONICAL_779}?utm_source=audit`
      );
    });

    it('5. der Auto-Append liefert der Function genau die internen Namen', () => {
      expect(simulateVercelRewrite(courseRewrite, LEGACY_URL)).toEqual({
        __topic: '12',
        __loc: 'zuerich',
        __cseg: '779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen',
      });
    });

    it('6. Regressionsnachweis: die frühere Regel erzeugte den Leak', async () => {
      // Alte Regel — Captures :topic/:location/:course plus explizite
      // Destination-Query. Vercel lieferte der Function dadurch beide
      // Namensfamilien; INJECTED_PARAMS kannte nur die zweite.
      const autoAppended = simulateVercelRewrite(
        { source: '/courses/:topic(\\d+)/:location/:course' },
        LEGACY_URL
      );
      const legacyQuery = {
        ...autoAppended,
        __topic: autoAppended.topic,
        __loc: autoAppended.location,
        __cseg: autoAppended.course,
      };

      await loadHandler(mockSupabase());
      const res = makeRes();
      await handler({ query: legacyQuery }, res);

      expect(res._status).toBe(308);
      expect(res._headers.Location).toBe(
        `${CANONICAL_779}?topic=12&location=zuerich&course=${autoAppended.course}`
      );
    });

    it('7. auch ein alter Text-Slug erreicht die Function und wird dauerhaft korrigiert', async () => {
      const oldTextSlugUrl =
        '/courses/alltag-leben/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen';

      expect(simulateVercelRewrite(courseRewrite, oldTextSlugUrl)).toEqual({
        __topic: 'alltag-leben',
        __loc: 'zuerich',
        __cseg: '779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen',
      });
      expect(await follow(oldTextSlugUrl)).toBe(CANONICAL_779);
    });

    it('8. ein bereits kanonischer Pfad löst keinen Redirect-Loop aus', async () => {
      const query = simulateVercelRewrite(courseRewrite, CANONICAL_779);
      expect(query).not.toBeNull();

      await loadHandler(mockSupabase());
      const res = makeRes();
      await handler({ query }, res);

      expect(res._headers.Location).toBeUndefined();
      expect([200, 404]).toContain(res._status);
    });
  });

  // ============================================================
  // Supabase-Konfiguration: ausschliesslich das öffentliche Paar
  // ============================================================

  describe('nutzt nur VITE_SUPABASE_URL + VITE_SUPABASE_KEY', () => {
    it('1. das öffentliche Paar allein genügt', async () => {
      vi.unstubAllEnvs();
      vi.stubEnv('VITE_SUPABASE_URL', 'https://public.supabase.co');
      vi.stubEnv('VITE_SUPABASE_KEY', 'public-anon-key');
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      expect(res._status).toBe(308);
      expect(res._headers.Location).toBe(CANONICAL_779);
    });

    it('2. SUPABASE_SERVICE_ROLE_KEY wird nicht verwendet', async () => {
      vi.unstubAllEnvs();
      vi.stubEnv('VITE_SUPABASE_URL', 'https://public.supabase.co');
      vi.stubEnv('VITE_SUPABASE_KEY', 'public-anon-key');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret');
      await loadHandler(mockSupabase());

      await handler(NUMERIC_REQ, makeRes());

      expect(createClientSpy).toHaveBeenCalledTimes(1);
      const [, usedKey] = createClientSpy.mock.calls[0];
      expect(usedKey).toBe('public-anon-key');
      expect(usedKey).not.toBe('service-role-secret');

      // Auch im Quelltext darf die Service Role nicht mehr auftauchen.
      const source = readFileSync('./api/course-redirect.js', 'utf8');
      expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('3. SUPABASE_URL wird nicht mit einem VITE-Key kombiniert', async () => {
      vi.unstubAllEnvs();
      vi.stubEnv('SUPABASE_URL', 'https://server-only.supabase.co');
      vi.stubEnv('VITE_SUPABASE_KEY', 'public-anon-key');
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      // Ohne VITE_SUPABASE_URL kein Client — gemischte Paare gäbe es sonst.
      expect(createClientSpy).not.toHaveBeenCalled();
      expect(res._headers.Location).toBeUndefined();

      const source = readFileSync('./api/course-redirect.js', 'utf8');
      expect(source).not.toMatch(/process\.env\.SUPABASE_URL/);
      expect(source).not.toMatch(/process\.env\.SUPABASE_ANON_KEY/);
      expect(source).not.toMatch(/process\.env\.VITE_SUPABASE_ANON_KEY/);
    });

    it('4. fehlendes öffentliches Paar fällt sauber auf die SPA-Shell zurück', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.unstubAllEnvs();
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      expect(createClientSpy).not.toHaveBeenCalled();
      expect(res._headers.Location).toBeUndefined();
      expect([200, 404]).toContain(res._status); // kein 500
      // Warnung nennt nur die Variablennamen, nie Werte.
      const logged = warn.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).toContain('VITE_SUPABASE_URL');
      expect(logged).toContain('VITE_SUPABASE_KEY');
      expect(logged).not.toContain('public-anon-key');
      expect(logged).not.toContain('service-role');
    });

    it('5. createClient wird exakt mit dem öffentlichen Paar aufgerufen', async () => {
      vi.unstubAllEnvs();
      vi.stubEnv('VITE_SUPABASE_URL', 'https://public.supabase.co');
      vi.stubEnv('VITE_SUPABASE_KEY', 'public-anon-key');
      vi.stubEnv('SUPABASE_URL', 'https://server-only.supabase.co');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret');
      vi.stubEnv('SUPABASE_ANON_KEY', 'other-anon-key');
      await loadHandler(mockSupabase());

      await handler(NUMERIC_REQ, makeRes());

      expect(createClientSpy).toHaveBeenCalledTimes(1);
      expect(createClientSpy).toHaveBeenCalledWith('https://public.supabase.co', 'public-anon-key');
    });
  });
});
