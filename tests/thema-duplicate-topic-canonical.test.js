/**
 * Tests für die Zusammenführung der zwei identischen Kunst-Themenseiten.
 *
 * Ausgangslage (SEO-Audit): /thema/privat-hobby/kunst-kreativitaet und
 * /thema/privat-hobby/kunst-kreativ hatten identischen Title, Description, H1,
 * Inhalt und Self-Canonical und standen beide in der Sitemap — zwei URLs für
 * denselben Suchintent.
 *
 * Zielzustand:
 *   Leader    = /thema/privat-hobby/kunst-kreativ
 *               (Slug der Taxonomie: constants.js privat_hobby.kunst_kreativ,
 *                identisch mit dem Themensegment der Kurs-URLs
 *                /courses/kunst-kreativ/…)
 *               → 200, Self-Canonical, genau einmal in der Sitemap
 *   Duplikat  = /thema/privat-hobby/kunst-kreativitaet
 *               → 308 auf den Leader, nicht in der Sitemap, keine Kette
 *
 * Die /thema-Architektur bleibt unverändert: Der Alias hat schlicht keinen
 * Eintrag mehr in SIMPLE_TOPIC_CONTENT und wird deshalb weder prerendert noch
 * in die Sitemap geschrieben; der bestehende Rewrite auf /api/thema-redirect
 * erledigt die Weiterleitung. Der Yoga-/Sport-Takeover (/thema → /bereich)
 * bleibt davon unberührt.
 *
 * Supabase ist vollständig gemockt — kein echter DB-Zugriff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SIMPLE_TOPIC_CONTENT,
  TOPIC_SLUG_ALIASES,
  resolveTopicAlias,
  SEGMENT_LANDING_CONFIG,
} from '../src/lib/segmentLandingConfig.js';
import { buildActiveThemeWorldTopicKeys, resolveTopicTarget } from '../src/lib/themeWorldTakeover.js';

const BASE = 'https://kursnavi.ch';

const LEADER_KEY = 'privat-hobby/kunst-kreativ';
const ALIAS_KEY = 'privat-hobby/kunst-kreativitaet';
const LEADER_PATH = `/thema/${LEADER_KEY}`;
const ALIAS_PATH = `/thema/${ALIAS_KEY}`;

// ============================================================
// Mocks — identische Mechanik wie tests/theme-world-topic-takeover.test.js
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

async function runSitemap(tables = baseTables()) {
  mockState.supabase = makeSupabaseMock(tables);
  const { default: handler } = await import('../api/sitemap.js');
  const res = makeMockRes();
  await handler({ method: 'GET', headers: {}, query: {} }, res);
  return res._sent || '';
}

/** Ruft /api/thema-redirect für einen /thema/{segment}/{slug}-Pfad auf. */
async function requestThema(path, themeWorlds = []) {
  const [, , segment, slug] = path.split('/');
  mockState.supabase = makeSupabaseMock(baseTables(themeWorlds));
  const { default: handler } = await import('../api/thema-redirect.js');
  const res = makeMockRes();
  await handler({ method: 'GET', headers: {}, query: { segment, slug }, url: path }, res);
  return res;
}

// ============================================================
// Konfiguration: genau ein Inhalts-Datensatz
// ============================================================

describe('Kunst-Themenseite — genau ein indexierbarer Inhalt', () => {
  it('nur der Leader hat einen Inhalts-Eintrag, das Duplikat nicht mehr', () => {
    expect(SIMPLE_TOPIC_CONTENT[LEADER_KEY]).toBeTruthy();
    expect(SIMPLE_TOPIC_CONTENT[ALIAS_KEY]).toBeUndefined();
  });

  it('kein zweiter Eintrag trägt denselben Title (kein neues Duplikat)', () => {
    const leaderTitle = SIMPLE_TOPIC_CONTENT[LEADER_KEY].title;
    const sameTitle = Object.keys(SIMPLE_TOPIC_CONTENT).filter(
      (key) => SIMPLE_TOPIC_CONTENT[key].title === leaderTitle
    );
    expect(sameTitle).toEqual([LEADER_KEY]);
  });

  it('das Duplikat bleibt als Alias erhalten und zeigt auf den Leader', () => {
    expect(TOPIC_SLUG_ALIASES[ALIAS_KEY]).toBe(LEADER_KEY);
    expect(resolveTopicAlias(ALIAS_KEY)).toBe(LEADER_KEY);
  });

  it('der Leader übernimmt die Kurs-Aliase des zusammengeführten Slugs', () => {
    // Sonst fiele ein Kurs mit category_area 'kunst_kreativitaet' nach der
    // Zusammenführung aus jeder Themenliste heraus.
    expect(SIMPLE_TOPIC_CONTENT[LEADER_KEY].areaAliases).toEqual(
      expect.arrayContaining(['kunst', 'kunst_kreativ', 'kunst_kreativitaet'])
    );
    expect(SIMPLE_TOPIC_CONTENT[LEADER_KEY].typeAliases).toEqual(
      expect.arrayContaining(['privat_hobby', 'privat', '2'])
    );
  });

  it('kein Alias zeigt auf einen Alias (Ketten sind schon in der Config ausgeschlossen)', () => {
    for (const [alias, target] of Object.entries(TOPIC_SLUG_ALIASES)) {
      expect(TOPIC_SLUG_ALIASES[target]).toBeUndefined();
      expect(SIMPLE_TOPIC_CONTENT[alias]).toBeUndefined();
      expect(SIMPLE_TOPIC_CONTENT[target]).toBeTruthy();
    }
  });
});

// ============================================================
// Auslieferung: Leader 200 + Self-Canonical, Duplikat 308
// ============================================================

describe('Kunst-Themenseite — Auslieferung', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. Leader wird mit 200 ausgeliefert', async () => {
    const res = await requestThema(LEADER_PATH);
    expect(res._status).toBe(200);
    expect(res._headers.Location).toBeUndefined();
  });

  it('2. Leader trägt den Self-Canonical auf sich selbst', async () => {
    const res = await requestThema(LEADER_PATH);
    expect(res._sent).toContain(`<link rel="canonical" href="${BASE}${LEADER_PATH}"`);
    expect(res._sent).not.toContain(`${BASE}${ALIAS_PATH}`);
  });

  it('4. Duplikat antwortet mit 308 auf den Leader', async () => {
    const res = await requestThema(ALIAS_PATH);
    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe(LEADER_PATH);
  });

  it('6. keine Redirect-Kette — das Redirect-Ziel antwortet direkt mit 200', async () => {
    const redirect = await requestThema(ALIAS_PATH);
    const target = await requestThema(redirect._headers.Location);
    expect(target._status).toBe(200);
    expect(target._headers.Location).toBeUndefined();
    expect(target._sent).toContain(`<link rel="canonical" href="${BASE}${LEADER_PATH}"`);
  });

  it('6b. keine Kette auch dann, wenn der Leader später von einer Themenwelt übernommen wird', async () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const res = await requestThema(ALIAS_PATH, [
      { url_segment: 'privat-hobby', slug: 'kunst-kreativ', status: 'published' },
    ]);
    expect(res._status).toBe(308);
    // Direkt auf die Themenwelt — nicht erst auf /thema/…/kunst-kreativ.
    expect(res._headers.Location).toBe('/bereich/privat-hobby/kunst-kreativ');
  });
});

// ============================================================
// Sitemap
// ============================================================

describe('Kunst-Themenseite — Sitemap', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('3. Leader steht genau einmal in der Sitemap', async () => {
    const xml = await runSitemap();
    expect(countLoc(xml, `${BASE}${LEADER_PATH}`)).toBe(1);
  });

  it('5. Duplikat steht nicht mehr in der Sitemap', async () => {
    const xml = await runSitemap();
    expect(countLoc(xml, `${BASE}${ALIAS_PATH}`)).toBe(0);
    expect(xml).not.toContain('kunst-kreativitaet');
  });
});

// ============================================================
// Interne Links + Regressionen
// ============================================================

describe('Kunst-Themenseite — interne Links', () => {
  it('7. kein interner Link im Segment-Config zeigt auf das Duplikat', () => {
    const configJson = JSON.stringify(SEGMENT_LANDING_CONFIG);
    expect(configJson).not.toContain('kunst-kreativitaet');
  });

  it('7b. der Themenlink für Kunst wird auf den Leader-Slug aufgelöst', () => {
    const keys = buildActiveThemeWorldTopicKeys();
    expect(resolveTopicTarget('privat-hobby', 'kunst-kreativ', keys)).toEqual({
      isThemenwelt: false,
      href: LEADER_PATH,
    });
  });
});

describe('Kunst-Themenseite — Regressionen der /thema-Architektur', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('8. Yoga-Takeover: /thema → /bereich bleibt 308', async () => {
    const res = await requestThema('/thema/privat-hobby/yoga-achtsamkeit');
    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe('/bereich/privat-hobby/yoga-achtsamkeit');
  });

  it('9. Sport-Takeover: /thema → /bereich bleibt 308', async () => {
    const res = await requestThema('/thema/beruflich/sport-fitness-berufsausbildung');
    expect(res._status).toBe(308);
    expect(res._headers.Location).toBe('/bereich/beruflich/sport-fitness-berufsausbildung');
  });

  it('10. anderes einfaches Thema (Musik) bleibt 200', async () => {
    const res = await requestThema('/thema/privat-hobby/musik');
    expect(res._status).toBe(200);
    expect(res._sent).toContain(`${BASE}/thema/privat-hobby/musik`);
  });

  it('11. unbekanntes Thema bleibt 404 und leitet niemals weiter', async () => {
    const res = await requestThema('/thema/privat-hobby/gibt-es-nicht');
    expect(res._status).toBe(404);
    expect(res._headers.Location).toBeUndefined();
  });
});
