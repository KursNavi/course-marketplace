/**
 * Tests für die serverseitige 404-Antwort unbekannter /bereich- und
 * /ratgeber-Ressourcen (Soft-404-Befund des technischen SEO-Audits).
 *
 * Befund:
 *   /bereich/{segment}/{unbekannter-bereich},
 *   /bereich/{segment}/{bereich}/{unbekanntes-szenario},
 *   /ratgeber/{segment}/{cluster}/{unbekannter-artikel} sowie unbekannte
 *   Ratgeber-Kategorien und -Cluster liefen in den allgemeinen SPA-Catch-all.
 *   Erster HTTP-Response: 200 + generische SPA-Shell. Die Meldung «Bereich
 *   nicht gefunden» / «Artikel nicht gefunden» und das noindex entstanden erst
 *   nach der React-Hydration — für Suchmaschinen indexierbare Leerseiten.
 *
 * Lösung (analog zur bestehenden /thema-Architektur):
 *   Vercel prüft das Dateisystem VOR den Rewrites. Existiert für eine URL aus
 *   diesen Route-Familien keine prerenderte Datei, greift ein Rewrite auf
 *   /api/resource-not-found und liefert einen echten HTTP 404.
 *
 * Abgedeckt:
 *   A) vercel.json — Reihenfolge und Reichweite der Regeln
 *   B) Routing-Simulation gegen den ECHTEN Prerender-Output
 *   C) /api/resource-not-found — Statuscode, Header, SEO-Eigenschaften
 *
 * Supabase ist vollständig gemockt; kein Test benötigt echte Zugangsdaten.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

// Die Routing-Suite führt einmalig das komplette Prerender-Skript aus.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

import { BEREICH_LANDING_CONFIG } from '../src/lib/bereichLandingConfig.js';

const vercelConfig = JSON.parse(readFileSync('./vercel.json', 'utf8'));

const NOT_FOUND_ENDPOINT = '/api/resource-not-found';
const SPA_CATCH_ALL = '/(.*)';
const BASE = 'https://kursnavi.ch';

// ============================================================
// A) vercel.json — Reihenfolge und Reichweite
// ============================================================

const rewriteSources = vercelConfig.rewrites.map((rule) => rule.source);
const notFoundRules = vercelConfig.rewrites.filter(
  (rule) => rule.destination === NOT_FOUND_ENDPOINT
);
const catchAllIndex = rewriteSources.indexOf(SPA_CATCH_ALL);

describe('vercel.json — 404-Fallback der Ressourcenfamilien', () => {
  it('deckt genau die bestätigten /bereich- und /ratgeber-Tiefen ab', () => {
    expect(notFoundRules.map((rule) => rule.source)).toEqual([
      '/bereich/:segment/:slug',
      '/bereich/:segment/:slug/:rest*',
      '/ratgeber/:category',
      '/ratgeber/:category/:cluster',
      '/ratgeber/:category/:cluster/:rest*',
    ]);
  });

  it('steht vollständig vor dem allgemeinen SPA-Catch-all', () => {
    expect(catchAllIndex).toBeGreaterThan(-1);
    for (const rule of notFoundRules) {
      expect(rewriteSources.indexOf(rule.source)).toBeLessThan(catchAllIndex);
    }
  });

  it('lässt den SPA-Catch-all als letzte Regel bestehen', () => {
    expect(catchAllIndex).toBe(vercelConfig.rewrites.length - 1);
    expect(vercelConfig.rewrites[catchAllIndex].destination).toBe('/index.html');
  });

  it('lässt die bestehenden Spezial-Rewrites unverändert und vorne', () => {
    expect(rewriteSources).toContain('/sitemap.xml');
    expect(rewriteSources).toContain('/courses/:__topic(\\d+)/:__loc/:__cseg');
    expect(rewriteSources).toContain('/api/(.*)');
    expect(rewriteSources).toContain('/thema/:segment/:slug');

    const firstNotFoundIndex = Math.min(
      ...notFoundRules.map((rule) => rewriteSources.indexOf(rule.source))
    );
    for (const source of [
      '/sitemap.xml',
      '/courses/:__topic(\\d+)/:__loc/:__cseg',
      '/api/(.*)',
      '/thema/:segment/:slug',
    ]) {
      expect(rewriteSources.indexOf(source)).toBeLessThan(firstNotFoundIndex);
    }
  });

  it('lässt Redirects, Headers und Crons unverändert', () => {
    expect(vercelConfig.redirects.map((rule) => rule.source)).toEqual([
      '/:path*',
      '/bereich/privat_hobby/:path*',
    ]);
    expect(vercelConfig.crons).toEqual([
      { path: '/api/cron', schedule: '0 12 * * *' },
      // Monatliche KI-Leadbewertung — bewusst getrennt vom täglichen Lauf,
      // damit eine lange oder fehlschlagende Bewertung Auszahlungen,
      // Erinnerungen und Paketabläufe nicht gefährdet.
      { path: '/api/cron-lead-scoring', schedule: '0 3 1 * *' },
    ]);
    expect(vercelConfig.trailingSlash).toBe(false);
  });

  it('bündelt für den 404-Handler bewusst keine SPA-Shell ein', () => {
    // Die Fehlerseite ist eigenständiges Markup — kein dist/index.html nötig.
    expect(Object.keys(vercelConfig.functions)).toEqual([
      'api/thema-redirect.js',
      'api/course-redirect.js',
    ]);
  });

  it('fasst weder /courses/ noch /anbieter/ an (separater Audit-Punkt)', () => {
    for (const rule of notFoundRules) {
      expect(rule.source.startsWith('/bereich/') || rule.source.startsWith('/ratgeber/')).toBe(true);
    }
  });
});

// ============================================================
// B) Routing-Simulation gegen den echten Prerender-Output
// ============================================================

/**
 * Übersetzt ein path-to-regexp-Muster aus vercel.json in eine RegExp.
 *
 * Unterstützt genau die in dieser Datei vorkommenden Formen:
 *   /literal        – wörtliches Segment (Punkte werden escaped)
 *   /(.*)           – roher Regex-Block
 *   /:name          – genau ein Segment
 *   /:name(\d+)     – Segment mit eigener Regex
 *   /:name*         – null oder mehr Segmente (inklusive führendem «/»)
 */
function sourceToRegExp(source) {
  const segments = source.split('/').slice(1);
  let pattern = '';

  for (const segment of segments) {
    if (segment.startsWith(':')) {
      const match = /^:([A-Za-z0-9_]+)(\(.*\))?([*+?])?$/.exec(segment);
      if (!match) throw new Error(`Unbekanntes Muster: ${segment}`);
      const [, , custom, modifier] = match;
      const inner = custom ? custom.slice(1, -1) : '[^/]+';
      if (modifier === '*') pattern += `(?:/(?:${inner}))*`;
      else if (modifier === '+') pattern += `(?:/(?:${inner}))+`;
      else if (modifier === '?') pattern += `(?:/(?:${inner}))?`;
      else pattern += `/(?:${inner})`;
    } else if (segment.startsWith('(') && segment.endsWith(')')) {
      pattern += `/${segment}`;
    } else {
      pattern += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    }
  }

  return new RegExp(`^${pattern}$`);
}

/**
 * Bildet Vercels Routing-Reihenfolge nach:
 *   1. `redirects`
 *   2. Dateisystem (statische Dateien aus dist/)
 *   3. `rewrites` in Reihenfolge
 *
 * @param {string} pathname
 * @param {Set<string>} staticPaths - vom Build erzeugte Routen
 * @returns {{phase: string, target: string}}
 */
function resolveRoute(pathname, staticPaths) {
  for (const rule of vercelConfig.redirects) {
    // Host-gebundene Regeln (www → non-www) greifen nur für den www-Host.
    if ((rule.has || []).some((cond) => cond.type === 'host')) continue;
    if (sourceToRegExp(rule.source).test(pathname)) {
      return { phase: 'redirect', target: rule.destination };
    }
  }

  if (staticPaths.has(pathname)) {
    return { phase: 'static', target: `${pathname}/index.html` };
  }

  for (const rule of vercelConfig.rewrites) {
    if (sourceToRegExp(rule.source).test(pathname)) {
      return { phase: 'rewrite', target: rule.destination };
    }
  }

  return { phase: 'none', target: null };
}

// ─── Prerender-Ausführung (echtes Skript, gemocktes Supabase) ────────────────

const mockState = { supabase: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockState.supabase),
}));

function makeSupabaseMock(tables) {
  const from = vi.fn((table) => {
    const config = tables[table] ?? { data: [], error: null };
    const filters = [];

    const chain = {};
    chain.select = vi.fn(() => chain);
    for (const method of ['order', 'limit', 'not', 'or', 'range']) {
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
    chain.then = (onFulfilled, onRejected) => {
      if (config.error) {
        return Promise.resolve({ data: null, error: config.error }).then(onFulfilled, onRejected);
      }
      let rows = config.data ?? [];
      for (const filter of filters) {
        if (filter.type === 'eq') rows = rows.filter((row) => row[filter.column] === filter.value);
        else if (filter.type === 'in') rows = rows.filter((row) => filter.values.includes(row[filter.column]));
      }
      return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
    };
    return chain;
  });

  return { from };
}

/** DB-only Themenwelt (kein Legacy-Eintrag) inklusive publiziertem Szenario. */
const DB_WORLD_ID = 'w-db-only';
const DB_WORLD_PATH = '/bereich/privat-hobby/fotografie-kreativ';
const DB_SCENARIO_PATH = `${DB_WORLD_PATH}/erste-kamera`;

function themeWorldTables() {
  return {
    theme_worlds: {
      data: [
        {
          id: DB_WORLD_ID,
          key: 'fotografie_kreativ',
          url_segment: 'privat-hobby',
          slug: 'fotografie-kreativ',
          status: 'published',
          title_de: 'Fotografie & Kreativität',
          subtitle_de: 'Untertitel der Themenwelt',
          meta_title: 'Fotografiekurse Schweiz | KursNavi',
          meta_description: 'Fotografie- und Kreativkurse in der ganzen Schweiz.',
          og_image_url: null,
          og_image_alt_de: null,
          hero_image_alt_de: null,
        },
      ],
      error: null,
    },
    theme_world_scenarios: {
      data: [
        {
          theme_world_id: DB_WORLD_ID,
          slug: 'erste-kamera',
          status: 'published',
          label_de: 'Erste Kamera',
          teaser_de: 'Teaser des Szenarios',
          meta_title: 'Erste Kamera kaufen | KursNavi',
          meta_description: 'Worauf es beim Kauf der ersten Kamera ankommt.',
          og_image_url: null,
          og_image_alt: null,
        },
        {
          theme_world_id: DB_WORLD_ID,
          slug: 'noch-nicht-fertig',
          status: 'draft',
          label_de: 'Entwurf',
          teaser_de: 'Entwurf',
          meta_title: null,
          meta_description: null,
          og_image_url: null,
          og_image_alt: null,
        },
      ],
      error: null,
    },
  };
}

const ENV_KEYS = [
  'PRERENDER_DIST_DIR',
  'VITE_SITE_URL',
  'VITE_THEME_WORLD_DB_ENABLED',
  'VITE_THEME_WORLD_PILOT_KEYS',
  'VITE_COURSE_PRERENDER_ENABLED',
  'VITE_COURSE_PRERENDER_REQUIRED',
  'VERCEL',
  'VERCEL_ENV',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_KEY',
];

let tempRoot = null;
let distDir = null;
let savedEnv = {};
/** Alle vom Build erzeugten Routen — die «Dateisystem»-Ebene der Simulation. */
const staticPaths = new Set();

/** Sammelt rekursiv jede geschriebene index.html als Route. */
function collectStaticPaths(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const route = `${prefix}/${entry.name}`;
    if (existsSync(join(dir, entry.name, 'index.html'))) staticPaths.add(route);
    collectStaticPaths(join(dir, entry.name), route);
  }
}

beforeAll(async () => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

  tempRoot = mkdtempSync(join(tmpdir(), 'kursnavi-soft404-'));
  distDir = join(tempRoot, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), readFileSync(resolve('index.html'), 'utf-8'), 'utf-8');

  mockState.supabase = makeSupabaseMock(themeWorldTables());

  for (const key of ENV_KEYS) delete process.env[key];
  process.env.PRERENDER_DIST_DIR = distDir;
  process.env.VITE_SITE_URL = BASE;
  process.env.VITE_THEME_WORLD_DB_ENABLED = 'true';
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.VITE_SUPABASE_KEY = 'test-public-key';
  // Kurs-/Anbieter-Prerender hat eine eigene Testdatei und ist hier ohne Belang.
  process.env.VITE_COURSE_PRERENDER_ENABLED = 'false';

  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.resetModules();
  await import('../scripts/prerender-static.mjs');
  log.mockRestore();
  warn.mockRestore();

  collectStaticPaths(distDir);
});

afterAll(() => {
  mockState.supabase = null;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = null;
  distDir = null;
});

/** Der erste HTTP-Response, den Vercel für diese URL erzeugt. */
function firstResponse(pathname) {
  const { phase, target } = resolveRoute(pathname, staticPaths);
  if (phase === 'redirect') return '308';
  if (phase === 'static') return '200';
  if (target === NOT_FOUND_ENDPOINT) return '404';
  if (target === '/index.html') return '200 (SPA)';
  return target;
}

const YOGA = BEREICH_LANDING_CONFIG.yoga_achtsamkeit;
const SPORT = BEREICH_LANDING_CONFIG.sport_fitness_beruf;
const YOGA_PATH = `/bereich/${YOGA.segment}/${YOGA.slug}`;
const SPORT_PATH = `/bereich/${SPORT.segment}/${SPORT.slug}`;

describe('Routing — der Prerender-Output entscheidet über 200 vs. 404', () => {
  it('der Prerender hat überhaupt Seiten erzeugt', () => {
    expect(staticPaths.size).toBeGreaterThan(50);
  });

  // ─── /bereich: gültige Seiten bleiben 200 ────────────────────────────────

  it('Yoga-Themenwelt bleibt eine statische 200-Seite', () => {
    expect(staticPaths.has(YOGA_PATH)).toBe(true);
    expect(firstResponse(YOGA_PATH)).toBe('200');
  });

  it('jedes Yoga-Szenario bleibt eine statische 200-Seite', () => {
    for (const scenario of YOGA.scenarios) {
      expect(firstResponse(`${YOGA_PATH}/${scenario.slug}`)).toBe('200');
    }
  });

  it('Sport-Themenwelt und ihre Szenarien bleiben statische 200-Seiten', () => {
    expect(firstResponse(SPORT_PATH)).toBe('200');
    for (const scenario of SPORT.scenarios) {
      expect(firstResponse(`${SPORT_PATH}/${scenario.slug}`)).toBe('200');
    }
  });

  it('DB-only Themenwelt und ihr publiziertes Szenario bleiben 200', () => {
    expect(firstResponse(DB_WORLD_PATH)).toBe('200');
    expect(firstResponse(DB_SCENARIO_PATH)).toBe('200');
  });

  // ─── /bereich: unbekannte Ressourcen werden 404 ──────────────────────────

  it('unbekannter Bereich ergibt 404 statt SPA-Shell', () => {
    expect(firstResponse('/bereich/privat-hobby/audit-nicht-vorhanden-zz')).toBe('404');
  });

  it('unbekanntes Szenario einer gültigen Themenwelt ergibt 404', () => {
    expect(firstResponse(`${YOGA_PATH}/audit-nicht-vorhanden-zz`)).toBe('404');
    expect(firstResponse(`${SPORT_PATH}/audit-nicht-vorhanden-zz`)).toBe('404');
  });

  it('unbekanntes Segment in derselben Route-Familie ergibt 404', () => {
    expect(firstResponse('/bereich/gibt-es-nicht/yoga-achtsamkeit')).toBe('404');
    expect(firstResponse('/bereich/gibt-es-nicht/yoga-achtsamkeit/yoga-fuer-anfaenger')).toBe('404');
  });

  it('nicht publiziertes Szenario einer gültigen Themenwelt ergibt 404', () => {
    expect(firstResponse(`${DB_WORLD_PATH}/noch-nicht-fertig`)).toBe('404');
  });

  it('übertief verschachtelte /bereich-URLs ergeben ebenfalls 404', () => {
    expect(firstResponse(`${YOGA_PATH}/yoga-fuer-anfaenger/noch-tiefer`)).toBe('404');
  });

  // ─── /ratgeber ───────────────────────────────────────────────────────────

  it('Ratgeber-Hub, -Kategorie, -Cluster und -Artikel bleiben 200', () => {
    expect(firstResponse('/ratgeber')).toBe('200');
    expect(firstResponse('/ratgeber/beruflich')).toBe('200');
    expect(firstResponse('/ratgeber/beruflich/finanzierung')).toBe('200');
    expect(firstResponse('/ratgeber/beruflich/finanzierung/vollkostenrechnung-weiterbildung')).toBe('200');
  });

  it('alle drei Ratgeber-Kategorien bleiben 200', () => {
    for (const category of ['beruflich', 'privat-hobby', 'kinder']) {
      expect(firstResponse(`/ratgeber/${category}`)).toBe('200');
    }
  });

  it('unbekannte Ratgeber-Kategorie ergibt 404', () => {
    expect(firstResponse('/ratgeber/audit-nicht-vorhanden-zz')).toBe('404');
  });

  it('unbekannter Ratgeber-Cluster ergibt 404', () => {
    expect(firstResponse('/ratgeber/beruflich/audit-nicht-vorhanden-zz')).toBe('404');
  });

  it('unbekannter Ratgeber-Artikel ergibt 404', () => {
    expect(firstResponse('/ratgeber/beruflich/finanzierung/audit-nicht-vorhanden-zz')).toBe('404');
  });

  it('jede prerenderte Ratgeber-Seite bleibt vom Fallback unangetastet', () => {
    const ratgeberPaths = [...staticPaths].filter((path) => path.startsWith('/ratgeber'));
    expect(ratgeberPaths.length).toBeGreaterThan(70);
    for (const path of ratgeberPaths) {
      expect(firstResponse(path)).toBe('200');
    }
  });

  it('jede prerenderte /bereich-Seite bleibt vom Fallback unangetastet', () => {
    const bereichPaths = [...staticPaths].filter((path) => path.startsWith('/bereich/'));
    expect(bereichPaths.length).toBeGreaterThan(10);
    for (const path of bereichPaths) {
      expect(firstResponse(path)).toBe('200');
    }
  });

  // ─── Unveränderte Nachbarfamilien ────────────────────────────────────────

  it('bestehende /thema-Regeln bleiben unverändert', () => {
    // Übernommene Themen haben bewusst keine Datei → Rewrite auf den Redirect.
    expect(staticPaths.has(`/thema/${YOGA.segment}/${YOGA.slug}`)).toBe(false);
    expect(resolveRoute(`/thema/${YOGA.segment}/${YOGA.slug}`, staticPaths).target)
      .toContain('/api/thema-redirect');

    // Nicht übernommene Themen bleiben statisch.
    expect(firstResponse('/thema/privat-hobby/musik')).toBe('200');
  });

  it('numerische Kurs-URLs erreichen weiterhin den Course-Redirect', () => {
    expect(resolveRoute('/courses/12/zuerich/779-titel', staticPaths).target)
      .toContain('/api/course-redirect');
  });

  it('Kurs- und Anbieter-URLs laufen nicht in den 404-Fallback', () => {
    // Sie werden in PR #103 prerendert; ohne Datei bleibt der SPA-Catch-all —
    // bewusst unverändert, das ist ein separater Audit-Punkt.
    expect(firstResponse('/courses/kunst/zuerich/779-titel')).toBe('200 (SPA)');
    expect(firstResponse('/anbieter/beispiel-anbieter')).toBe('200 (SPA)');
  });

  it('der allgemeine SPA-Catch-all bleibt für andere App-Routen erhalten', () => {
    for (const path of ['/dashboard', '/blog/mein-post', '/profil/abc', '/login']) {
      expect(firstResponse(path)).toBe('200 (SPA)');
    }
  });

  it('der Legacy-Unterstrich-Redirect gewinnt weiterhin vor dem 404-Fallback', () => {
    expect(firstResponse('/bereich/privat_hobby/yoga-achtsamkeit')).toBe('308');
    expect(firstResponse('/bereich/privat_hobby/audit-nicht-vorhanden-zz')).toBe('308');
  });

  /**
   * Dokumentierte Ausnahme:
   * /bereich/{segment} ohne Slug ist keine Ressource dieser Familie. App.jsx
   * behandelt die URL als Suchseite; sie steht in keiner Sitemap und wird
   * nirgends verlinkt. Dieser PR ändert ihr Verhalten bewusst NICHT — der
   * Auftrag umfasst nur die bestätigten Ressourcenfamilien.
   */
  it('/bereich/{segment} ohne Slug behält sein bisheriges Verhalten', () => {
    expect(firstResponse('/bereich/beruflich')).toBe('200 (SPA)');
  });
});

// ============================================================
// C) /api/resource-not-found
// ============================================================

function makeRes() {
  return {
    _status: null,
    _headers: {},
    _sent: null,
    _ended: false,
    status(code) { this._status = code; return this; },
    setHeader(key, value) { this._headers[key] = value; },
    send(body) { this._sent = body; return this; },
    end() { this._ended = true; return this; },
  };
}

describe('/api/resource-not-found — Fehlerseite', () => {
  let handler;
  let html;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import('../api/resource-not-found.js');
    handler = mod.default;
    html = mod.renderNotFoundHtml();
  });

  it('antwortet auf GET mit HTTP 404', () => {
    const res = makeRes();
    handler({ method: 'GET' }, res);
    expect(res._status).toBe(404);
  });

  it('antwortet ohne Methodenangabe ebenfalls mit 404', () => {
    const res = makeRes();
    handler({}, res);
    expect(res._status).toBe(404);
  });

  it('liefert HTML als Content-Type', () => {
    const res = makeRes();
    handler({ method: 'GET' }, res);
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res._sent).toContain('<!doctype html>');
  });

  it('beantwortet HEAD mit 404 und ohne Body', () => {
    const res = makeRes();
    handler({ method: 'HEAD' }, res);
    expect(res._status).toBe(404);
    expect(res._ended).toBe(true);
    expect(res._sent).toBeNull();
  });

  it('weist schreibende Methoden mit 405 ab', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = makeRes();
      handler({ method }, res);
      expect(res._status).toBe(405);
      expect(res._headers.Allow).toBe('GET, HEAD');
    }
  });

  // ─── SEO-Eigenschaften ───────────────────────────────────────────────────

  it('setzt robots auf noindex,nofollow — im Markup und als Header', () => {
    const res = makeRes();
    handler({ method: 'GET' }, res);
    expect(res._sent).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(res._headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('enthält nirgends index,follow', () => {
    expect(html).not.toMatch(/index\s*,\s*follow/);
    expect(html).not.toContain('content="index');
  });

  it('trägt den Fehler-Title', () => {
    expect(html).toContain('<title>Seite nicht gefunden | KursNavi</title>');
  });

  it('trägt die Fehler-Description', () => {
    expect(html).toContain('<meta name="description" content="Die gesuchte Seite wurde nicht gefunden." />');
  });

  it('setzt überhaupt keinen Canonical — weder self noch fremd', () => {
    expect(html).not.toContain('rel="canonical"');
  });

  it('enthält kein JSON-LD', () => {
    expect(html).not.toContain('application/ld+json');
    expect(html).not.toContain('schema.org');
  });

  it('enthält keine og:-Tags einer gültigen Ressource', () => {
    expect(html).not.toContain('og:url');
    expect(html).not.toContain('og:image');
  });

  it('bietet hilfreiche Navigation zu Suche und Startseite', () => {
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/"');
  });

  it('lädt die React-App nicht nach (eigenständiges Markup)', () => {
    expect(html).not.toContain('<script');
    expect(html).not.toContain('/assets/');
  });

  // ─── Keine Abhängigkeiten ────────────────────────────────────────────────

  it('braucht weder Datenbank noch Secrets noch Dateisystem', () => {
    const source = readFileSync('./api/resource-not-found.js', 'utf8');
    expect(source).not.toContain('@supabase/supabase-js');
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toContain('readFileSync');
    expect(source).not.toContain('SUPABASE');
    expect(source).not.toContain('STRIPE');
  });

  it('funktioniert ohne jede Umgebungsvariable', () => {
    const removed = {};
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('VITE_') || key.startsWith('SUPABASE_')) {
        removed[key] = process.env[key];
        delete process.env[key];
      }
    }
    try {
      const res = makeRes();
      handler({ method: 'GET' }, res);
      expect(res._status).toBe(404);
    } finally {
      for (const [key, value] of Object.entries(removed)) process.env[key] = value;
    }
  });

  it('ist nur kurz cachebar, damit neue Inhalte zeitnah 200 liefern', () => {
    const res = makeRes();
    handler({ method: 'GET' }, res);
    expect(res._headers['Cache-Control']).toContain('s-maxage=60');
  });
});
