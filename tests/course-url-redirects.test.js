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

  /**
   * PostgREST-Mock, der die Statusbedingung TATSÄCHLICH anwendet.
   * Ohne das wäre der Draft-Test wertlos: die Bedingung muss im Handler
   * stehen, nicht nur in den Mock-Daten.
   */
  function mockSupabase({
    course = COURSE_ROW,
    categories = [CATEGORY_ROW],
    courseError = null,
    categoryError = null,
  } = {}) {
    const calls = { select: [], or: [] };

    const client = {
      calls,
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

        let rows = course ? [course] : [];
        const chain = {
          select: (columns) => { calls.select.push(columns); return chain; },
          eq: (column, value) => {
            rows = rows.filter((row) => String(row[column]) === String(value));
            return chain;
          },
          or: (expression) => {
            calls.or.push(expression);
            if (expression === 'status.eq.published,status.is.null') {
              rows = rows.filter((row) => row.status === 'published' || row.status == null);
            }
            return chain;
          },
          limit: (n) => Promise.resolve({
            data: courseError ? null : rows.slice(0, n),
            error: courseError,
          }),
        };
        return chain;
      },
    };

    return client;
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
  // Credential-Auswahl: Server-Paar zuerst, Public-Paar als Fallback
  // ============================================================

  describe('Supabase-Credential-Auswahl', () => {
    const SERVER_URL = 'https://server.supabase.co';
    const SERVICE_KEY = 'service-role-secret-value';
    const PUBLIC_URL = 'https://public.supabase.co';
    const PUBLIC_KEY = 'public-anon-key';

    function stub(vars) {
      vi.unstubAllEnvs();
      for (const [name, value] of Object.entries(vars)) vi.stubEnv(name, value);
    }

    it('1. Server-Paar vollstaendig vorhanden -> dieses wird verwendet', async () => {
      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      expect(createClientSpy).toHaveBeenCalledTimes(1);
      expect(createClientSpy).toHaveBeenCalledWith(SERVER_URL, SERVICE_KEY);
      expect(res._status).toBe(308);
      expect(res._headers.Location).toBe(CANONICAL_779);
    });

    it('2. Public-Paar ebenfalls vorhanden -> Server-Paar hat Vorrang', async () => {
      stub({
        SUPABASE_URL: SERVER_URL,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        VITE_SUPABASE_URL: PUBLIC_URL,
        VITE_SUPABASE_KEY: PUBLIC_KEY,
      });
      await loadHandler(mockSupabase());

      await handler(NUMERIC_REQ, makeRes());

      expect(createClientSpy).toHaveBeenCalledWith(SERVER_URL, SERVICE_KEY);
      const [usedUrl, usedKey] = createClientSpy.mock.calls[0];
      expect(usedUrl).not.toBe(PUBLIC_URL);
      expect(usedKey).not.toBe(PUBLIC_KEY);
    });

    it('3. nur Public-Paar vorhanden -> Public-Paar funktioniert weiterhin', async () => {
      stub({ VITE_SUPABASE_URL: PUBLIC_URL, VITE_SUPABASE_KEY: PUBLIC_KEY });
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      expect(createClientSpy).toHaveBeenCalledWith(PUBLIC_URL, PUBLIC_KEY);
      expect(res._status).toBe(308);
      expect(res._headers.Location).toBe(CANONICAL_779);
    });

    it('4. gemischtes Paar SUPABASE_URL + VITE_SUPABASE_KEY wird nicht kombiniert', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      stub({ SUPABASE_URL: SERVER_URL, VITE_SUPABASE_KEY: PUBLIC_KEY });
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      expect(createClientSpy).not.toHaveBeenCalled();
      expect(res._headers.Location).toBeUndefined();
      expect([200, 404]).toContain(res._status);
    });

    it('4b. gemischtes Paar VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ebenso wenig', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      stub({ VITE_SUPABASE_URL: PUBLIC_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      await loadHandler(mockSupabase());

      await handler(NUMERIC_REQ, makeRes());

      expect(createClientSpy).not.toHaveBeenCalled();
    });

    it('5. kein vollstaendiges Paar -> SPA-Fallback, kein 500', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stub({});
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      expect(createClientSpy).not.toHaveBeenCalled();
      expect(res._headers.Location).toBeUndefined();
      expect(res._status).not.toBe(500);
      expect([200, 404]).toContain(res._status);

      // Warnung nennt nur Variablennamen, nie Werte.
      const logged = warn.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).toContain('SUPABASE_URL');
      expect(logged).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(logged).toContain('VITE_SUPABASE_URL');
      expect(logged).toContain('VITE_SUPABASE_KEY');
    });

    it('6. der Service-Role-Wert erscheint nie in Response, Logs oder Redirect-Ziel', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      stub({
        SUPABASE_URL: SERVER_URL,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        VITE_SUPABASE_URL: PUBLIC_URL,
        VITE_SUPABASE_KEY: PUBLIC_KEY,
      });
      await loadHandler(mockSupabase());

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      // Redirect-Ziel
      expect(res._headers.Location).toBe(CANONICAL_779);
      expect(res._headers.Location).not.toContain(SERVICE_KEY);
      // Response-Body und saemtliche Header
      expect(String(res._sent ?? '')).not.toContain(SERVICE_KEY);
      expect(JSON.stringify(res._headers)).not.toContain(SERVICE_KEY);
      // Logs
      const logged = [...warn.mock.calls, ...error.mock.calls, ...log.mock.calls]
        .map((args) => args.map(String).join(' '))
        .join('\n');
      expect(logged).not.toContain(SERVICE_KEY);
    });

    it('6b. auch bei DB-Fehlern landet der Service-Role-Wert nicht im Log', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      await loadHandler(mockSupabase({ course: null, courseError: { message: 'Invalid API key' } }));

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      const logged = warn.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
      expect(logged).not.toContain(SERVICE_KEY);
      expect(res._headers.Location).toBeUndefined();
    });

    it('7. Draft-Kurs bekommt niemals einen 308 auf eine oeffentliche Canonical-URL', async () => {
      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      const supabase = mockSupabase({ course: { ...COURSE_ROW, status: 'draft' } });
      await loadHandler(supabase);

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      // Service Role umgeht RLS - die Statusbedingung ist die einzige Grenze.
      expect(supabase.calls.or).toContain('status.eq.published,status.is.null');
      expect(res._headers.Location).toBeUndefined();
      expect(res._status).not.toBe(308);
      expect(String(res._sent ?? '')).not.toContain(COURSE_ROW.title);
    });

    it('7b. archivierter Kurs ebenso wenig', async () => {
      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      await loadHandler(mockSupabase({ course: { ...COURSE_ROW, status: 'archived' } }));

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      expect(res._headers.Location).toBeUndefined();
    });

    it('7c. published und Legacy ohne Status werden weiterhin weitergeleitet', async () => {
      for (const status of ['published', null, undefined]) {
        stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
        await loadHandler(mockSupabase({ course: { ...COURSE_ROW, status } }));

        const res = makeRes();
        await handler(NUMERIC_REQ, res);

        expect(res._status, 'status=' + status).toBe(308);
        expect(res._headers.Location, 'status=' + status).toBe(CANONICAL_779);
      }
    });

    it('8. published Kurs mit numerischer Alt-URL -> 308 auf buildCanonicalCoursePath(course)', async () => {
      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      await loadHandler(mockSupabase({ course: { ...COURSE_ROW, status: 'published' } }));

      const res = makeRes();
      await handler(NUMERIC_REQ, res);

      const { buildCanonicalCoursePath } = await import('../src/lib/courseUrl.js');
      const expected = buildCanonicalCoursePath({
        ...COURSE_ROW,
        all_categories: [{
          course_id: 779,
          category_type: 'privat',
          category_type_label: 'Privat & Hobby',
          category_area: 'kunst',
          category_area_label: 'Kunst & Kreativ',
          category_specialty: 'schmuck',
          category_specialty_label: 'Schmuck',
          category_focus: null,
          category_focus_label: null,
          type_id: 1,
          area_id: 12,
          specialty_id: 130,
          focus_id: null,
          is_primary: true,
        }],
      });

      expect(res._status).toBe(308);
      expect(res._headers.Location).toBe(expected);
    });

    it('die Abfrage bleibt eng: eine ID, nur Canonical-Felder', async () => {
      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      const supabase = mockSupabase();
      await loadHandler(supabase);

      await handler(NUMERIC_REQ, makeRes());

      const [columns] = supabase.calls.select;
      expect(columns).toBe('id, title, category_type, category_area, category_specialty, category_focus, canton');
      // keine Preis-, Nutzer- oder Kontaktfelder
      expect(columns).not.toMatch(/user_id|price|email|description/);
    });

    it('resolveSupabaseCredentials meldet die verwendete Familie', async () => {
      const mod = await loadHandler(mockSupabase());

      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
      expect(mod.resolveSupabaseCredentials()).toEqual({
        url: SERVER_URL, key: SERVICE_KEY, source: 'server',
      });

      stub({ VITE_SUPABASE_URL: PUBLIC_URL, VITE_SUPABASE_KEY: PUBLIC_KEY });
      expect(mod.resolveSupabaseCredentials()).toEqual({
        url: PUBLIC_URL, key: PUBLIC_KEY, source: 'public',
      });

      stub({ SUPABASE_URL: SERVER_URL, VITE_SUPABASE_KEY: PUBLIC_KEY });
      expect(mod.resolveSupabaseCredentials()).toBeNull();
    });

    it('leere oder nur aus Leerzeichen bestehende Variablen zaehlen als fehlend', async () => {
      const mod = await loadHandler(mockSupabase());

      stub({ SUPABASE_URL: SERVER_URL, SUPABASE_SERVICE_ROLE_KEY: '   ' });
      expect(mod.resolveSupabaseCredentials()).toBeNull();

      stub({
        SUPABASE_URL: SERVER_URL,
        SUPABASE_SERVICE_ROLE_KEY: '',
        VITE_SUPABASE_URL: PUBLIC_URL,
        VITE_SUPABASE_KEY: PUBLIC_KEY,
      });
      expect(mod.resolveSupabaseCredentials()).toEqual({
        url: PUBLIC_URL, key: PUBLIC_KEY, source: 'public',
      });
    });
  });
});
