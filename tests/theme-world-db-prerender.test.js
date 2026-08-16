/**
 * Tests für den statischen Prerender von DB-Themenwelten.
 *
 * Hintergrund (SEO-Audit):
 *   scripts/prerender-static.mjs erzeugte /bereich/-Dateien ausschliesslich aus
 *   BEREICH_LANDING_CONFIG. Eine Themenwelt, die nur in der Datenbank existiert
 *   (kein Legacy-Eintrag), bekam damit keine statische HTML-Datei — Vercel
 *   lieferte beim ersten Request die generische SPA-index.html aus.
 *
 * Diese Tests führen das echte Prerender-Skript aus (mit gemocktem Supabase und
 * einem temporären dist-Verzeichnis via PRERENDER_DIST_DIR) und prüfen die
 * tatsächlich geschriebenen Dateien.
 *
 * Verifiziert:
 *   1. DB-only Themenwelt bekommt dist/bereich/{segment}/{slug}/index.html
 *      mit meta_title, meta_description, Self-Canonical, index,follow,
 *      og_image_url und og_image_alt_de
 *   2. Publiziertes Szenario bekommt eine eigene Datei mit eigenen SEO-Werten
 *   3. Draft-Szenario bekommt KEINE Datei
 *   4. Archivierte/Draft-Themenwelt bekommt KEINE Datei
 *   5. Yoga (Legacy + Pilot) bleibt prerenderbar
 *   6. Sport (Legacy + Pilot) bleibt prerenderbar
 *   7. VITE_THEME_WORLD_DB_ENABLED=false → keine DB-only-Seite, Legacy intakt
 *   8. Supabase-Fehler bei aktiviertem DB-Prerender → Build bricht ab
 *   9. Legacy-only Build mit deaktiviertem DB-System funktioniert weiter
 *  10. Fallback-Logik der Routen-Erzeugung (reine Einheitstests)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

// Jeder Testfall führt das komplette Prerender-Skript aus (~130 HTML-Dateien).
// Unter paralleler Last reicht das Vitest-Standardlimit von 5s nicht.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { BEREICH_LANDING_CONFIG } from '../src/lib/bereichLandingConfig.js';
import { injectHeadMeta } from '../api/_lib/html-head.js';
import {
  buildThemeWorldPrerenderRoutes,
  loadThemeWorldPrerenderRoutes,
  ThemeWorldPrerenderError,
} from '../api/_lib/theme-world-prerender.js';

// ============================================================
// Mock-Infrastruktur
// ============================================================

/**
 * Minimaler PostgREST-Query-Mock: .eq()/.in() werden tatsächlich angewendet,
 * damit die Tests verifizieren, dass der Produktionscode wirklich filtert.
 */
function makeSupabaseMock(tables) {
  const calls = [];

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
    for (const method of ['order', 'limit', 'not', 'or']) {
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
        if (filter.type === 'eq') {
          rows = rows.filter((row) => row[filter.column] === filter.value);
        } else if (filter.type === 'in') {
          rows = rows.filter((row) => filter.values.includes(row[filter.column]));
        }
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
// Test-Fixtures (bewusst frei von echten Production-URLs)
// ============================================================

const BASE = 'https://kursnavi.ch';

const DB_ONLY_WORLD_ID = 'w-db-only';
const DRAFT_WORLD_ID = 'w-draft';

const DB_ONLY_SEGMENT = 'privat-hobby';
const DB_ONLY_SLUG = 'fotografie-kreativ';
const DB_ONLY_PATH = `/bereich/${DB_ONLY_SEGMENT}/${DB_ONLY_SLUG}`;

const DB_ONLY_META_TITLE = 'Fotografie & Kreativkurse Schweiz | KursNavi';
const DB_ONLY_META_DESCRIPTION =
  'Finde Fotografie- und Kreativkurse in der ganzen Schweiz – vom Einstieg bis zur Spezialisierung.';
const DB_ONLY_OG_IMAGE = 'https://cdn.example.test/theme-worlds/fotografie-og.png';
const DB_ONLY_OG_ALT = 'Person mit Kamera in einem Fotokurs';

const SCENARIO_PUBLISHED_SLUG = 'erste-kamera';
const SCENARIO_META_TITLE = 'Erste Kamera kaufen: Ratgeber | KursNavi';
const SCENARIO_META_DESCRIPTION =
  'Worauf es beim Kauf der ersten Kamera ankommt – und welcher Kurs dir den Einstieg erleichtert.';
const SCENARIO_OG_IMAGE = 'https://cdn.example.test/theme-worlds/erste-kamera-og.png';
const SCENARIO_OG_ALT = 'Einsteigerkamera auf einem Holztisch';

const SCENARIO_DRAFT_SLUG = 'noch-nicht-fertig';

/** Legacy-Themenwelten, die im Pilot zusätzlich in der DB liegen. */
const LEGACY_YOGA = BEREICH_LANDING_CONFIG.yoga_achtsamkeit;
const LEGACY_SPORT = BEREICH_LANDING_CONFIG.sport_fitness_beruf;

function themeWorldRows() {
  return [
    {
      id: DB_ONLY_WORLD_ID,
      key: 'fotografie_kreativ',
      url_segment: DB_ONLY_SEGMENT,
      slug: DB_ONLY_SLUG,
      status: 'published',
      title_de: 'Fotografie & Kreativität',
      subtitle_de: 'Sichtbarer Untertitel der Themenwelt',
      meta_title: DB_ONLY_META_TITLE,
      meta_description: DB_ONLY_META_DESCRIPTION,
      og_image_url: DB_ONLY_OG_IMAGE,
      og_image_alt_de: DB_ONLY_OG_ALT,
      hero_image_alt_de: 'Hero-Alt sollte nicht gewinnen',
    },
    {
      id: DRAFT_WORLD_ID,
      key: 'geheimer_entwurf',
      url_segment: 'beruflich',
      slug: 'geheimer-entwurf',
      status: 'draft',
      title_de: 'Geheimer Entwurf',
      subtitle_de: 'Noch nicht öffentlich',
      meta_title: null,
      meta_description: null,
      og_image_url: null,
      og_image_alt_de: null,
      hero_image_alt_de: null,
    },
  ];
}

function scenarioRows() {
  return [
    {
      theme_world_id: DB_ONLY_WORLD_ID,
      slug: SCENARIO_PUBLISHED_SLUG,
      status: 'published',
      label_de: 'Erste Kamera',
      teaser_de: 'Sichtbarer Teaser des Szenarios',
      meta_title: SCENARIO_META_TITLE,
      meta_description: SCENARIO_META_DESCRIPTION,
      og_image_url: SCENARIO_OG_IMAGE,
      og_image_alt: SCENARIO_OG_ALT,
    },
    {
      theme_world_id: DB_ONLY_WORLD_ID,
      slug: SCENARIO_DRAFT_SLUG,
      status: 'draft',
      label_de: 'Noch nicht fertig',
      teaser_de: 'Entwurf',
      meta_title: 'Entwurfstitel',
      meta_description: 'Entwurfsbeschreibung',
      og_image_url: null,
      og_image_alt: null,
    },
    {
      theme_world_id: DRAFT_WORLD_ID,
      slug: 'szenario-von-entwurfswelt',
      status: 'published',
      label_de: 'Szenario einer Entwurfswelt',
      teaser_de: 'Darf nicht erscheinen',
      meta_title: null,
      meta_description: null,
      og_image_url: null,
      og_image_alt: null,
    },
  ];
}

function defaultTables(overrides = {}) {
  return {
    theme_worlds: { data: themeWorldRows(), error: null },
    theme_world_scenarios: { data: scenarioRows(), error: null },
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
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
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

/**
 * Führt das echte Prerender-Skript aus und gibt das dist-Verzeichnis zurück.
 */
async function runPrerender({ tables = defaultTables(), env = {} } = {}) {
  const { client, calls } = makeSupabaseMock(tables);
  mockState.supabase = client;

  setEnv({
    PRERENDER_DIST_DIR: distDir,
    VITE_SITE_URL: BASE,
    // Dasselbe öffentliche Paar wie im Browser (src/lib/supabase.js).
    // Platzhalterwerte — kein Test benötigt echte Zugangsdaten.
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_KEY: 'test-public-key',
    ...env,
  });

  vi.resetModules();
  await import('../scripts/prerender-static.mjs');
  return { calls };
}

/** Wie escapeHtmlAttr() in api/_lib/html-head.js — Werte landen escaped im HTML. */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readPage(path) {
  const file = join(distDir, ...path.split('/').filter(Boolean), 'index.html');
  return readFileSync(file, 'utf-8');
}

function pageExists(path) {
  return existsSync(join(distDir, ...path.split('/').filter(Boolean), 'index.html'));
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

  tempRoot = mkdtempSync(join(tmpdir(), 'kursnavi-prerender-'));
  distDir = join(tempRoot, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), readFileSync(TEMPLATE_PATH, 'utf-8'), 'utf-8');

  vi.spyOn(console, 'log').mockImplementation(() => {});
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
// 1. DB-only Themenwelt: Hauptseite
// ============================================================

describe('DB-only Themenwelt: statische Hauptseite', () => {
  it('1. erzeugt dist/bereich/{segment}/{slug}/index.html', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    expect(pageExists(DB_ONLY_PATH)).toBe(true);
  });

  it('enthält meta_title aus der Datenbank als <title>', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(DB_ONLY_PATH);

    expect(html).toContain(`<title>${esc(DB_ONLY_META_TITLE)}</title>`);
    // Der sichtbare Titel darf den redaktionellen meta_title nicht überschreiben
    expect(html).not.toContain('<title>Fotografie &amp; Kreativität | KursNavi</title>');
  });

  it('enthält meta_description aus der Datenbank', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(DB_ONLY_PATH);

    expect(html).toContain(`<meta name="description" content="${DB_ONLY_META_DESCRIPTION}"`);
    expect(html).not.toContain('Sichtbarer Untertitel der Themenwelt');
  });

  it('enthält den korrekten Self-Canonical', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(DB_ONLY_PATH);

    expect(html).toContain(`<link rel="canonical" href="${BASE}${DB_ONLY_PATH}"`);
  });

  it('ist auf index,follow gesetzt', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(DB_ONLY_PATH);

    expect(html).toContain('<meta name="robots" content="index,follow"');
    expect(html).not.toContain('noindex');
  });

  it('enthält Open-Graph-Titel, -Beschreibung und -URL', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(DB_ONLY_PATH);

    expect(html).toContain(`<meta property="og:title" content="${esc(DB_ONLY_META_TITLE)}"`);
    expect(html).toContain(`<meta property="og:description" content="${DB_ONLY_META_DESCRIPTION}"`);
    expect(html).toContain(`<meta property="og:url" content="${BASE}${DB_ONLY_PATH}"`);
  });

  it('enthält og:image aus og_image_url und og:image:alt aus og_image_alt_de', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(DB_ONLY_PATH);

    expect(html).toContain(`<meta property="og:image" content="${DB_ONLY_OG_IMAGE}"`);
    expect(html).toContain(`<meta property="og:image:alt" content="${DB_ONLY_OG_ALT}"`);
  });

  it('nutzt ausschliesslich öffentlich lesbare Filter (status=published)', async () => {
    const { calls } = await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    const worldCall = calls.find((c) => c.table === 'theme_worlds');
    expect(worldCall.filters).toContainEqual({ type: 'eq', column: 'status', value: 'published' });

    const scenarioCall = calls.find((c) => c.table === 'theme_world_scenarios');
    expect(scenarioCall.filters).toContainEqual({ type: 'eq', column: 'status', value: 'published' });
    const inFilter = scenarioCall.filters.find((f) => f.type === 'in' && f.column === 'theme_world_id');
    expect(inFilter.values).toEqual([DB_ONLY_WORLD_ID]);
  });
});

// ============================================================
// 2.–4. Szenarien und nicht publizierte Datensätze
// ============================================================

describe('DB-only Themenwelt: Szenarien', () => {
  it('2. publiziertes Szenario bekommt eine eigene statische Datei', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    expect(pageExists(`${DB_ONLY_PATH}/${SCENARIO_PUBLISHED_SLUG}`)).toBe(true);
  });

  it('Szenario enthält eigenen SEO-Titel, eigene Description und Self-Canonical', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(`${DB_ONLY_PATH}/${SCENARIO_PUBLISHED_SLUG}`);

    expect(html).toContain(`<title>${SCENARIO_META_TITLE}</title>`);
    expect(html).toContain(`<meta name="description" content="${SCENARIO_META_DESCRIPTION}"`);
    expect(html).toContain(
      `<link rel="canonical" href="${BASE}${DB_ONLY_PATH}/${SCENARIO_PUBLISHED_SLUG}"`
    );
    expect(html).toContain('<meta name="robots" content="index,follow"');
  });

  it('Szenario nutzt sein eigenes OG-Bild und seinen eigenen Alt-Text', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });
    const html = readPage(`${DB_ONLY_PATH}/${SCENARIO_PUBLISHED_SLUG}`);

    expect(html).toContain(`<meta property="og:image" content="${SCENARIO_OG_IMAGE}"`);
    expect(html).toContain(`<meta property="og:image:alt" content="${SCENARIO_OG_ALT}"`);
    // Nicht das OG-Bild der Eltern-Themenwelt
    expect(html).not.toContain(DB_ONLY_OG_IMAGE);
  });

  it('3. Draft-Szenario erzeugt KEINE statische Datei', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    expect(pageExists(`${DB_ONLY_PATH}/${SCENARIO_DRAFT_SLUG}`)).toBe(false);
  });

  it('4. Draft-Themenwelt und deren Szenarien erzeugen KEINE statische Datei', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    expect(pageExists('/bereich/beruflich/geheimer-entwurf')).toBe(false);
    expect(pageExists('/bereich/beruflich/geheimer-entwurf/szenario-von-entwurfswelt')).toBe(false);
  });

  it('archivierte Themenwelt erzeugt KEINE statische Datei', async () => {
    const tables = defaultTables();
    tables.theme_worlds.data = [
      { ...themeWorldRows()[0], status: 'archived' },
    ];
    await runPrerender({ tables, env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    expect(pageExists(DB_ONLY_PATH)).toBe(false);
  });
});

// ============================================================
// 5.–6. Regression: Yoga und Sport
// ============================================================

describe('Regression: Legacy-Themenwelten bleiben prerenderbar', () => {
  const pilotEnv = {
    VITE_THEME_WORLD_DB_ENABLED: 'true',
    VITE_THEME_WORLD_PILOT_KEYS: 'yoga_achtsamkeit,sport_fitness_beruf',
  };

  it('5. Yoga wird weiterhin prerendert (inkl. Szenarien)', async () => {
    await runPrerender({ env: pilotEnv });

    const path = `/bereich/${LEGACY_YOGA.segment}/${LEGACY_YOGA.slug}`;
    expect(pageExists(path)).toBe(true);
    for (const szenario of LEGACY_YOGA.scenarios) {
      expect(pageExists(`${path}/${szenario.slug}`)).toBe(true);
    }
  });

  it('6. Sport wird weiterhin prerendert (inkl. Szenarien)', async () => {
    await runPrerender({ env: pilotEnv });

    const path = `/bereich/${LEGACY_SPORT.segment}/${LEGACY_SPORT.slug}`;
    expect(pageExists(path)).toBe(true);
    for (const szenario of LEGACY_SPORT.scenarios) {
      expect(pageExists(`${path}/${szenario.slug}`)).toBe(true);
    }
  });

  it('alle Legacy-Bereichsseiten existieren auch bei aktivem DB-Prerender', async () => {
    await runPrerender({ env: pilotEnv });

    for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
      const path = `/bereich/${bereich.segment}/${bereich.slug}`;
      expect(pageExists(path)).toBe(true);
      for (const szenario of (bereich.scenarios || [])) {
        expect(pageExists(`${path}/${szenario.slug}`)).toBe(true);
      }
    }
  });

  it('Legacy-Seite ohne Pilot-Key behält ihren Legacy-Titel, auch wenn die DB sie kennt', async () => {
    const tables = defaultTables();
    tables.theme_worlds.data.push({
      id: 'w-yoga',
      key: 'yoga_achtsamkeit',
      url_segment: LEGACY_YOGA.segment,
      slug: LEGACY_YOGA.slug,
      status: 'published',
      title_de: 'Yoga aus der Datenbank',
      subtitle_de: 'DB-Untertitel',
      meta_title: 'DB-Yoga-Titel | KursNavi',
      meta_description: 'DB-Yoga-Beschreibung',
      og_image_url: null,
      og_image_alt_de: null,
      hero_image_alt_de: null,
    });

    // Pilot-Liste leer → Laufzeit liefert Legacy-Inhalte → Prerender ebenfalls
    await runPrerender({ tables, env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    const html = readPage(`/bereich/${LEGACY_YOGA.segment}/${LEGACY_YOGA.slug}`);
    expect(html).toContain(`<title>${esc(`${LEGACY_YOGA.title.de} | KursNavi`)}</title>`);
    expect(html).not.toContain('DB-Yoga-Titel');
  });

  it('Legacy-Seite MIT Pilot-Key übernimmt die DB-SEO-Werte (wie zur Laufzeit)', async () => {
    const tables = defaultTables();
    tables.theme_worlds.data.push({
      id: 'w-yoga',
      key: 'yoga_achtsamkeit',
      url_segment: LEGACY_YOGA.segment,
      slug: LEGACY_YOGA.slug,
      status: 'published',
      title_de: 'Yoga aus der Datenbank',
      subtitle_de: 'DB-Untertitel',
      meta_title: 'DB-Yoga-Titel | KursNavi',
      meta_description: 'DB-Yoga-Beschreibung',
      og_image_url: null,
      og_image_alt_de: null,
      hero_image_alt_de: null,
    });

    await runPrerender({ tables, env: pilotEnv });

    const html = readPage(`/bereich/${LEGACY_YOGA.segment}/${LEGACY_YOGA.slug}`);
    expect(html).toContain('<title>DB-Yoga-Titel | KursNavi</title>');
    expect(html).toContain('<meta name="description" content="DB-Yoga-Beschreibung"');
    // Genau eine Datei — die Legacy-Schleife überschreibt die DB-Version nicht
    expect(html).not.toContain(LEGACY_YOGA.subtitle.de);
  });
});

// ============================================================
// 7. Feature-Flag aus
// ============================================================

describe('VITE_THEME_WORLD_DB_ENABLED=false', () => {
  it('7. DB-only Themenwelt wird NICHT prerendert', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'false' } });

    expect(pageExists(DB_ONLY_PATH)).toBe(false);
    expect(pageExists(`${DB_ONLY_PATH}/${SCENARIO_PUBLISHED_SLUG}`)).toBe(false);
  });

  it('fragt Supabase gar nicht erst ab', async () => {
    const { calls } = await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'false' } });

    expect(calls).toHaveLength(0);
  });

  it('9. Legacy-Build funktioniert unverändert weiter', async () => {
    await runPrerender({ env: { VITE_THEME_WORLD_DB_ENABLED: 'false' } });

    for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
      const path = `/bereich/${bereich.segment}/${bereich.slug}`;
      expect(pageExists(path)).toBe(true);
    }
    // Statische Standardseiten und Ratgeber bleiben erhalten
    expect(pageExists('/about')).toBe(true);
    expect(pageExists('/ratgeber/beruflich/finanzierung')).toBe(true);
  });

  it('/thema-Seite der DB-only Themenwelt bleibt bestehen (kein Takeover)', async () => {
    // Die DB-only Themenwelt liegt auf demselben Key wie eine /thema/-Seite.
    const tables = defaultTables();
    tables.theme_worlds.data = [
      { ...themeWorldRows()[0], url_segment: 'privat-hobby', slug: 'musik' },
    ];

    await runPrerender({ tables, env: { VITE_THEME_WORLD_DB_ENABLED: 'false' } });

    // /thema/privat-hobby/musik steht in SIMPLE_TOPIC_CONTENT und darf ohne
    // Flag nicht von einer reinen DB-Themenwelt übernommen werden.
    expect(pageExists('/thema/privat-hobby/musik')).toBe(true);
    expect(pageExists('/bereich/privat-hobby/musik')).toBe(false);
  });

  it('mit aktivem Flag übernimmt die DB-Themenwelt die /thema-Seite', async () => {
    const tables = defaultTables();
    tables.theme_worlds.data = [
      { ...themeWorldRows()[0], url_segment: 'privat-hobby', slug: 'musik' },
    ];

    await runPrerender({ tables, env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } });

    expect(pageExists('/thema/privat-hobby/musik')).toBe(false);
    expect(pageExists('/bereich/privat-hobby/musik')).toBe(true);
  });
});

// ============================================================
// 8. Fail-safe bei Supabase-Fehlern
// ============================================================

describe('Fail-safe: Supabase-Fehler bei aktivem DB-Prerender', () => {
  it('8. Themenwelten-Abfragefehler bricht den Build kontrolliert ab', async () => {
    const tables = defaultTables({
      theme_worlds: { data: null, error: { message: 'connection reset' } },
    });

    await expect(
      runPrerender({ tables, env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } })
    ).rejects.toThrow(/Themenwelten konnten nicht geladen werden/);
  });

  it('Szenario-Abfragefehler bricht den Build ebenfalls ab', async () => {
    const tables = defaultTables({
      theme_world_scenarios: { data: null, error: { message: 'timeout' } },
    });

    await expect(
      runPrerender({ tables, env: { VITE_THEME_WORLD_DB_ENABLED: 'true' } })
    ).rejects.toThrow(/Szenario-Artikel konnten nicht geladen werden/);
  });

});

// ============================================================
// Credential-Auswahl: ausschliesslich das öffentliche Paar
// ============================================================

describe('Prerender nutzt nur VITE_SUPABASE_URL + VITE_SUPABASE_KEY', () => {
  it('1. das öffentliche Paar genügt für den DB-Prerender', async () => {
    const { calls } = await runPrerender({
      env: {
        VITE_THEME_WORLD_DB_ENABLED: 'true',
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_KEY: 'test-public-key',
      },
    });

    expect(calls.some((c) => c.table === 'theme_worlds')).toBe(true);
    expect(pageExists(DB_ONLY_PATH)).toBe(true);
  });

  it('2. fehlende VITE_SUPABASE_URL löst den Fail-safe aus', async () => {
    await expect(
      runPrerender({
        env: {
          VITE_THEME_WORLD_DB_ENABLED: 'true',
          VITE_SUPABASE_URL: undefined,
          VITE_SUPABASE_KEY: 'test-public-key',
        },
      })
    ).rejects.toThrow(/im Build fehlt: VITE_SUPABASE_URL\./);
  });

  it('3. fehlender VITE_SUPABASE_KEY löst den Fail-safe aus', async () => {
    await expect(
      runPrerender({
        env: {
          VITE_THEME_WORLD_DB_ENABLED: 'true',
          VITE_SUPABASE_URL: 'https://test.supabase.co',
          VITE_SUPABASE_KEY: undefined,
        },
      })
    ).rejects.toThrow(/im Build fehlt: VITE_SUPABASE_KEY\./);
  });

  it('der Fail-safe wirft einen ThemeWorldPrerenderError und nennt keine Werte', async () => {
    const error = await runPrerender({
      env: {
        VITE_THEME_WORLD_DB_ENABLED: 'true',
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_KEY: undefined,
      },
    }).catch((e) => e);

    // Identitätsvergleich statt instanceof: das Skript importiert das Modul
    // nach vi.resetModules() frisch, die Klassenreferenz ist deshalb eine andere.
    expect(error.name).toBe('ThemeWorldPrerenderError');
    expect(error.message).toContain('VITE_SUPABASE_URL und VITE_SUPABASE_KEY');
    // Nur Variablennamen, keine Werte
    expect(error.message).not.toContain('test-public-key');
    expect(error.message).not.toContain('supabase.co');
  });

  it('4. ein vorhandener SUPABASE_SERVICE_ROLE_KEY ersetzt das öffentliche Paar NICHT', async () => {
    const error = await runPrerender({
      env: {
        VITE_THEME_WORLD_DB_ENABLED: 'true',
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_KEY: undefined,
        // Server-seitige Variablen sind auf Vercel vorhanden, dürfen den
        // öffentlichen Read aber weder ersetzen noch mit ihm gemischt werden.
        SUPABASE_URL: 'https://server.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-should-not-be-used',
      },
    }).catch((e) => e);

    expect(error.name).toBe('ThemeWorldPrerenderError');
    expect(error.message).not.toContain('service-role-should-not-be-used');
  });

  it('4b. der Prerender greift auch bei gesetzten Server-Variablen nur auf das öffentliche Paar zu', async () => {
    const { calls } = await runPrerender({
      env: {
        VITE_THEME_WORLD_DB_ENABLED: 'true',
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_KEY: 'test-public-key',
        SUPABASE_URL: 'https://server.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-should-not-be-used',
      },
    });

    expect(calls.some((c) => c.table === 'theme_worlds')).toBe(true);
    const { createClient } = await import('@supabase/supabase-js');
    expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-public-key');
  });
});

// ============================================================
// 10. Routen-Erzeugung: Fallbacks (Einheitstests)
// ============================================================

describe('buildThemeWorldPrerenderRoutes: Fallbacks', () => {
  const world = {
    id: 'w1',
    key: 'demo_welt',
    url_segment: 'beruflich',
    slug: 'demo-welt',
    status: 'published',
    title_de: 'Demo Welt',
    subtitle_de: 'Der sichtbare Untertitel',
    meta_title: null,
    meta_description: null,
    og_image_url: null,
    og_image_alt_de: null,
    hero_image_alt_de: 'Hero-Alt-Text',
  };

  it('fällt ohne meta_title auf «{Titel} | KursNavi» zurück', () => {
    const [route] = buildThemeWorldPrerenderRoutes({ worlds: [world], baseUrl: BASE });
    expect(route.title).toBe('Demo Welt | KursNavi');
  });

  it('fällt ohne meta_description auf den Subtitle zurück', () => {
    const [route] = buildThemeWorldPrerenderRoutes({ worlds: [world], baseUrl: BASE });
    expect(route.description).toBe('Der sichtbare Untertitel');
  });

  it('fällt ohne og_image_url auf das Standardbild zurück', () => {
    const [route] = buildThemeWorldPrerenderRoutes({ worlds: [world], baseUrl: BASE });
    expect(route.ogImage).toBe(`${BASE}/og-default.png`);
  });

  it('fällt ohne og_image_alt_de auf hero_image_alt_de zurück', () => {
    const [route] = buildThemeWorldPrerenderRoutes({ worlds: [world], baseUrl: BASE });
    expect(route.ogImageAlt).toBe('Hero-Alt-Text');
  });

  it('Szenario fällt ohne meta_title auf «{Label} — {Weltentitel} | KursNavi» zurück', () => {
    const routes = buildThemeWorldPrerenderRoutes({
      worlds: [world],
      scenarios: [{
        theme_world_id: 'w1',
        slug: 'mein-szenario',
        status: 'published',
        label_de: 'Mein Szenario',
        teaser_de: 'Teaser-Text',
        meta_title: null,
        meta_description: null,
        og_image_url: null,
        og_image_alt: null,
      }],
      baseUrl: BASE,
    });

    const scenario = routes.find((r) => r.kind === 'scenario');
    expect(scenario.title).toBe('Mein Szenario — Demo Welt | KursNavi');
    expect(scenario.description).toBe('Teaser-Text');
    expect(scenario.ogImage).toBe(`${BASE}/og-default.png`);
    expect(scenario.ogImageAlt).toBe('');
  });

  it('überspringt Datensätze mit unzulässigem URL-Format', () => {
    const warn = vi.fn();
    const routes = buildThemeWorldPrerenderRoutes({
      worlds: [{ ...world, url_segment: '../admin' }],
      baseUrl: BASE,
      logger: { warn },
    });

    expect(routes).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe('injectHeadMeta: optionaler ogImageAlt', () => {
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');
  const meta = {
    canonical: `${BASE}/bereich/beruflich/demo`,
    title: 'Demo',
    description: 'Beschreibung',
    ogImage: `${BASE}/og-default.png`,
  };

  it('erzeugt og:image:alt nur bei vorhandenem Wert', () => {
    const html = injectHeadMeta(template, { ...meta, ogImageAlt: 'Ein Alt-Text' });
    expect(html).toContain('<meta property="og:image:alt" content="Ein Alt-Text" />');
  });

  it('erzeugt kein og:image:alt ohne Wert (bestehende Aufrufer bleiben unverändert)', () => {
    expect(injectHeadMeta(template, meta)).not.toContain('og:image:alt');
    expect(injectHeadMeta(template, { ...meta, ogImageAlt: '   ' })).not.toContain('og:image:alt');
  });

  it('escaped Sonderzeichen im Alt-Text', () => {
    const html = injectHeadMeta(template, { ...meta, ogImageAlt: 'Foto "A" & B' });
    expect(html).toContain('<meta property="og:image:alt" content="Foto &quot;A&quot; &amp; B" />');
  });

  it('setzt einen bereits vorhandenen og:image:alt-Wert neu, statt zu duplizieren', () => {
    const once = injectHeadMeta(template, { ...meta, ogImageAlt: 'Erster Alt-Text' });
    const twice = injectHeadMeta(once, { ...meta, ogImageAlt: 'Zweiter Alt-Text' });

    expect(twice.match(/og:image:alt/g)).toHaveLength(1);
    expect(twice).toContain('content="Zweiter Alt-Text"');
  });
});

describe('loadThemeWorldPrerenderRoutes: Flag-Semantik', () => {
  it('fragt ohne Flag nichts ab und liefert keine Routen', async () => {
    const supabase = { from: vi.fn() };
    const result = await loadThemeWorldPrerenderRoutes({
      supabase,
      baseUrl: BASE,
      env: { VITE_THEME_WORLD_DB_ENABLED: 'false' },
    });

    expect(result.enabled).toBe(false);
    expect(result.routes).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('wirft ThemeWorldPrerenderError, wenn bei aktivem Flag kein Client vorhanden ist', async () => {
    await expect(
      loadThemeWorldPrerenderRoutes({
        supabase: null,
        baseUrl: BASE,
        env: { VITE_THEME_WORLD_DB_ENABLED: 'true' },
      })
    ).rejects.toBeInstanceOf(ThemeWorldPrerenderError);
  });
});
