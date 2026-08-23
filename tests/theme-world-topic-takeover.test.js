/**
 * Tests für die Übernahme einer einfachen /thema/-Landingpage durch eine
 * öffentlich aktive Themenwelt (/bereich/…).
 *
 * Produktinvariante:
 *   /thema/{segment}/{slug} ist der Fallback.
 *   Sobald /bereich/{segment}/{slug} als Themenwelt öffentlich aktiv ist,
 *   übernimmt sie das Thema vollständig — Übersicht, Redirect und Sitemap
 *   folgen derselben Regel (src/lib/themeWorldTakeover.js).
 *
 * Abgedeckt:
 *   A) Regel-Logik (aktiv / Draft / Feature-Flag / ungültige Werte)
 *   B) Sitemap: /thema/ verschwindet genau dann, wenn /bereich/ übernimmt
 *   C) /thema/-Redirect-Endpunkt: 308 auf /bereich/, sonst normale Auslieferung
 *
 * Supabase ist vollständig gemockt — kein echter DB-Zugriff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildActiveThemeWorldTopicKeys,
  getLegacyThemeWorldTopicKeys,
  resolveTopicTarget,
  topicKey,
  topicKeyFromBereichPath,
} from '../src/lib/themeWorldTakeover.js';
import { SIMPLE_TOPIC_CONTENT } from '../src/lib/segmentLandingConfig.js';

// ============================================================
// Fixtures — bewusst generisch, kein Yoga-Sonderfall in der Logik
// ============================================================

const BASE = 'https://kursnavi.ch';

// Legacy-Themenwelten (BEREICH_LANDING_CONFIG)
const YOGA = { segment: 'privat-hobby', slug: 'yoga-achtsamkeit' };
const SPORT = { segment: 'beruflich', slug: 'sport-fitness-berufsausbildung' };
// Thema ohne Themenwelt
const MUSIK = { segment: 'privat-hobby', slug: 'musik' };

function dbWorld(segment, slug, status = 'published') {
  return { url_segment: segment, slug, status };
}

// ============================================================
// A) Regel-Logik
// ============================================================

describe('themeWorldTakeover — Regel «öffentlich aktive Themenwelt»', () => {
  it('Legacy-Themenwelten gelten immer als öffentlich aktiv (statisch prerendert)', () => {
    const legacy = getLegacyThemeWorldTopicKeys();
    expect(legacy.has(`${YOGA.segment}/${YOGA.slug}`)).toBe(true);
    expect(legacy.has(`${SPORT.segment}/${SPORT.slug}`)).toBe(true);
  });

  it('Thema ohne Themenwelt zeigt auf /thema/ und trägt keinen Themenwelt-Status', () => {
    const keys = buildActiveThemeWorldTopicKeys();
    const target = resolveTopicTarget(MUSIK.segment, MUSIK.slug, keys);
    expect(target).toEqual({
      isThemenwelt: false,
      href: '/thema/privat-hobby/musik',
    });
  });

  it('Thema mit aktiver Themenwelt zeigt auf /bereich/', () => {
    const keys = buildActiveThemeWorldTopicKeys();
    expect(resolveTopicTarget(YOGA.segment, YOGA.slug, keys)).toEqual({
      isThemenwelt: true,
      href: '/bereich/privat-hobby/yoga-achtsamkeit',
    });
  });

  it('Sport bleibt unverändert eine Themenwelt', () => {
    const keys = buildActiveThemeWorldTopicKeys();
    expect(resolveTopicTarget(SPORT.segment, SPORT.slug, keys)).toEqual({
      isThemenwelt: true,
      href: '/bereich/beruflich/sport-fitness-berufsausbildung',
    });
  });

  it('publizierte DB-Themenwelt übernimmt, wenn das DB-System aktiviert ist', () => {
    const keys = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds: [dbWorld(MUSIK.segment, MUSIK.slug)],
    });
    expect(resolveTopicTarget(MUSIK.segment, MUSIK.slug, keys).href)
      .toBe('/bereich/privat-hobby/musik');
  });

  it('Draft-Themenwelt ersetzt die /thema/-Seite NICHT', () => {
    const keys = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds: [dbWorld(MUSIK.segment, MUSIK.slug, 'draft')],
    });
    expect(resolveTopicTarget(MUSIK.segment, MUSIK.slug, keys).href)
      .toBe('/thema/privat-hobby/musik');
  });

  it('archivierte Themenwelt ersetzt die /thema/-Seite NICHT', () => {
    const keys = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds: [dbWorld(MUSIK.segment, MUSIK.slug, 'archived')],
    });
    expect(keys.has('privat-hobby/musik')).toBe(false);
  });

  it('publizierte DB-Themenwelt ohne aktivierten Rollout ersetzt die /thema/-Seite NICHT', () => {
    // VITE_THEME_WORLD_DB_ENABLED nicht 'true' → /bereich/ liefert für eine
    // reine DB-Themenwelt öffentlich «Bereich nicht gefunden» aus.
    const keys = buildActiveThemeWorldTopicKeys({
      dbEnabled: false,
      publishedDbWorlds: [dbWorld(MUSIK.segment, MUSIK.slug)],
    });
    expect(resolveTopicTarget(MUSIK.segment, MUSIK.slug, keys).href)
      .toBe('/thema/privat-hobby/musik');
  });

  it('Rollback: fällt die Themenwelt weg, gilt wieder der /thema/-Fallback', () => {
    const aktiv = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds: [dbWorld(MUSIK.segment, MUSIK.slug)],
    });
    const nachRollback = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds: [dbWorld(MUSIK.segment, MUSIK.slug, 'draft')],
    });
    expect(resolveTopicTarget(MUSIK.segment, MUSIK.slug, aktiv).isThemenwelt).toBe(true);
    expect(resolveTopicTarget(MUSIK.segment, MUSIK.slug, nachRollback).isThemenwelt).toBe(false);
    // Der Fallback-Content bleibt dafür unangetastet erhalten.
    expect(SIMPLE_TOPIC_CONTENT['privat-hobby/musik']).toBeTruthy();
  });

  it('Unterstrich-Segmente werden auf die URL-Schreibweise normalisiert', () => {
    expect(topicKey('privat_hobby', 'musik')).toBe('privat-hobby/musik');
    const keys = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds: [dbWorld('privat_hobby', 'musik')],
    });
    expect(keys.has('privat-hobby/musik')).toBe(true);
  });

  it('ungültige Segment-/Slug-Werte werden verworfen (keine URL-Injection)', () => {
    expect(topicKey('privat-hobby', '../../etc')).toBeNull();
    expect(topicKey('', 'musik')).toBeNull();
    const keys = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds: [dbWorld('privat-hobby', '../../etc'), dbWorld('BAD SEGMENT', 'x')],
    });
    // nur die Legacy-Einträge bleiben übrig
    expect(keys).toEqual(getLegacyThemeWorldTopicKeys());
  });

  it('Szenario-Pfade übernehmen keine /thema/-Seite', () => {
    expect(topicKeyFromBereichPath('/bereich/privat-hobby/yoga-achtsamkeit'))
      .toBe('privat-hobby/yoga-achtsamkeit');
    expect(topicKeyFromBereichPath('/bereich/privat-hobby/yoga-achtsamkeit/yoga-fuer-anfaenger'))
      .toBeNull();
  });

  it('SIMPLE_TOPIC_CONTENT bleibt als Fallback-Quelle erhalten (auch für übernommene Themen)', () => {
    expect(SIMPLE_TOPIC_CONTENT['privat-hobby/yoga-achtsamkeit']).toBeTruthy();
  });
});

// ============================================================
// Supabase-Mock (identische Mechanik wie tests/sitemap-theme-worlds.test.js)
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

function makeSupabaseMock(tables) {
  const from = vi.fn((table) => {
    const config = tables[table] ?? { data: [], error: null };
    const filters = [];

    const chain = {};
    for (const method of ['select', 'or', 'not', 'order', 'limit', 'neq', 'gte']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.eq = vi.fn((column, value) => { filters.push({ type: 'eq', column, value }); return chain; });
    chain.in = vi.fn((column, values) => { filters.push({ type: 'in', column, values }); return chain; });
    chain.then = (resolve, reject) => {
      let result;
      if (config.error) {
        result = { data: null, error: config.error };
      } else {
        let rows = config.data ?? [];
        for (const filter of filters) {
          if (filter.type === 'eq') rows = rows.filter((r) => r[filter.column] === filter.value);
          else if (filter.type === 'in') rows = rows.filter((r) => filter.values.includes(r[filter.column]));
        }
        result = { data: rows, error: null };
      }
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  });

  return { from };
}

const mockState = { supabase: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockState.supabase),
}));

function baseTables(themeWorlds = []) {
  return {
    courses: { data: [], error: null },
    articles: { data: [], error: null },
    profiles: { data: [], error: null },
    theme_worlds: { data: themeWorlds, error: null },
    theme_world_scenarios: { data: [], error: null },
  };
}

function countLoc(xml, url) {
  return (xml.match(new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`, 'g')) || []).length;
}

async function runSitemap(tables) {
  mockState.supabase = makeSupabaseMock(tables);
  const { default: handler } = await import('../api/sitemap.js');
  const res = makeMockRes();
  await handler({ method: 'GET', headers: {}, query: {} }, res);
  return { res, xml: res._sent || '' };
}

// ============================================================
// B) Sitemap
// ============================================================

describe('Sitemap — /thema/-Fallback wird von aktiver Themenwelt verdrängt', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('übernommenes Thema: /bereich/ ist enthalten, /thema/ nicht', async () => {
    const { xml } = await runSitemap(baseTables());
    expect(countLoc(xml, `${BASE}/bereich/privat-hobby/yoga-achtsamkeit`)).toBe(1);
    expect(countLoc(xml, `${BASE}/thema/privat-hobby/yoga-achtsamkeit`)).toBe(0);
  });

  it('Thema ohne Themenwelt bleibt unverändert in der Sitemap', async () => {
    const { xml } = await runSitemap(baseTables());
    expect(countLoc(xml, `${BASE}/thema/privat-hobby/musik`)).toBe(1);
  });

  it('publizierte DB-Themenwelt verdrängt bei aktiviertem Rollout die /thema/-URL', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const { xml } = await runSitemap(baseTables([
      { id: 'w1', url_segment: 'privat-hobby', slug: 'musik', status: 'published', updated_at: '2026-02-01T00:00:00.000Z', published_at: null },
    ]));
    expect(countLoc(xml, `${BASE}/bereich/privat-hobby/musik`)).toBe(1);
    expect(countLoc(xml, `${BASE}/thema/privat-hobby/musik`)).toBe(0);
  });

  it('Draft-Themenwelt verdrängt die /thema/-URL NICHT', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const { xml } = await runSitemap(baseTables([
      { id: 'w1', url_segment: 'privat-hobby', slug: 'musik', status: 'draft', updated_at: null, published_at: null },
    ]));
    expect(countLoc(xml, `${BASE}/thema/privat-hobby/musik`)).toBe(1);
    expect(countLoc(xml, `${BASE}/bereich/privat-hobby/musik`)).toBe(0);
  });

  it('publizierte DB-Themenwelt ohne aktivierten Rollout verdrängt die /thema/-URL NICHT', async () => {
    // Kein VITE_THEME_WORLD_DB_ENABLED → öffentlich nicht aktiv.
    const { xml } = await runSitemap(baseTables([
      { id: 'w1', url_segment: 'privat-hobby', slug: 'musik', status: 'published', updated_at: null, published_at: null },
    ]));
    expect(countLoc(xml, `${BASE}/thema/privat-hobby/musik`)).toBe(1);
  });

  it('DB-Fehler: Sitemap bleibt funktionsfähig, /thema/-Fallbacks bleiben erhalten', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const tables = baseTables();
    tables.theme_worlds = { data: null, error: { message: 'boom' } };

    const { res, xml } = await runSitemap(tables);
    expect(res._status).toBe(200);
    expect(countLoc(xml, `${BASE}/thema/privat-hobby/musik`)).toBe(1);
    // Legacy-Themenwelten bleiben trotzdem korrekt konsolidiert
    expect(countLoc(xml, `${BASE}/bereich/privat-hobby/yoga-achtsamkeit`)).toBe(1);
    expect(countLoc(xml, `${BASE}/thema/privat-hobby/yoga-achtsamkeit`)).toBe(0);
  });
});

// ============================================================
// C) /thema/-Redirect-Endpunkt
// ============================================================

async function runThemaRedirect(query, themeWorlds = []) {
  mockState.supabase = makeSupabaseMock(baseTables(themeWorlds));
  const { default: handler } = await import('../api/thema-redirect.js');
  const res = makeMockRes();
  await handler({ method: 'GET', headers: {}, query, url: '/api/thema-redirect' }, res);
  return res;
}

describe('/thema/-Redirect — permanenter Redirect auf die Themenwelt', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('übernommenes Thema wird dauerhaft (308) auf /bereich/ weitergeleitet', async () => {
    const res = await runThemaRedirect({ segment: 'privat-hobby', slug: 'yoga-achtsamkeit' });
    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe('/bereich/privat-hobby/yoga-achtsamkeit');
  });

  it('Thema ohne Themenwelt wird normal ausgeliefert (kein Redirect)', async () => {
    const res = await runThemaRedirect({ segment: 'privat-hobby', slug: 'musik' });
    expect(res._status).toBe(200);
    expect(res._headers.Location).toBeUndefined();
    expect(res._sent).toContain('https://kursnavi.ch/thema/privat-hobby/musik');
  });

  it('publizierte DB-Themenwelt löst bei aktiviertem Rollout den Redirect aus', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const res = await runThemaRedirect(
      { segment: 'privat-hobby', slug: 'musik' },
      [{ url_segment: 'privat-hobby', slug: 'musik', status: 'published' }],
    );
    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe('/bereich/privat-hobby/musik');
  });

  it('Draft-Themenwelt löst KEINEN Redirect aus', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const res = await runThemaRedirect(
      { segment: 'privat-hobby', slug: 'musik' },
      [{ url_segment: 'privat-hobby', slug: 'musik', status: 'draft' }],
    );
    expect(res._status).toBe(200);
  });

  it('publizierte DB-Themenwelt ohne aktivierten Rollout löst KEINEN Redirect aus', async () => {
    const res = await runThemaRedirect(
      { segment: 'privat-hobby', slug: 'musik' },
      [{ url_segment: 'privat-hobby', slug: 'musik', status: 'published' }],
    );
    expect(res._status).toBe(200);
  });

  it('DB-Fehler: Legacy-Themenwelten leiten weiter, übrige Themen bleiben erreichbar', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const tables = baseTables();
    tables.theme_worlds = { data: null, error: { message: 'boom' } };
    mockState.supabase = makeSupabaseMock(tables);

    const { default: handler } = await import('../api/thema-redirect.js');

    const resMusik = makeMockRes();
    await handler({ query: { segment: 'privat-hobby', slug: 'musik' } }, resMusik);
    expect(resMusik._status).toBe(200);

    const resYoga = makeMockRes();
    await handler({ query: { segment: 'privat-hobby', slug: 'yoga-achtsamkeit' } }, resYoga);
    expect(resYoga._status).toBe(308);
  });

  it('unbekanntes Thema ergibt 404 statt Weiterleitung', async () => {
    const res = await runThemaRedirect({ segment: 'privat-hobby', slug: 'gibt-es-nicht' });
    expect(res._status).toBe(404);
  });

  it('ungültiges URL-Format ergibt 404 und niemals einen Redirect', async () => {
    const res = await runThemaRedirect({ segment: 'privat-hobby', slug: '../../etc' });
    expect(res._status).toBe(404);
    expect(res._headers.Location).toBeUndefined();
  });

  it('Segment und Slug werden notfalls aus dem Pfad gelesen', async () => {
    mockState.supabase = makeSupabaseMock(baseTables());
    const { default: handler } = await import('../api/thema-redirect.js');
    const res = makeMockRes();
    await handler({ url: '/thema/privat-hobby/yoga-achtsamkeit', query: {} }, res);
    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe('/bereich/privat-hobby/yoga-achtsamkeit');
  });

  it('Redirect ist cachebar, aber nicht unbefristet (Rollback bleibt möglich)', async () => {
    const res = await runThemaRedirect({ segment: 'privat-hobby', slug: 'yoga-achtsamkeit' });
    expect(res._headers['Cache-Control']).toContain('s-maxage');
  });
});
