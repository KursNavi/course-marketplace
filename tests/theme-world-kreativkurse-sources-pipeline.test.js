/**
 * Quellenangaben end-to-end: Admin-API-Roundtrip, Importer und öffentlicher
 * Lesepfad.
 *
 * Anlass ist die Themenwelt «Kreativkurse», deren sechs Szenarien je drei bis
 * vier Quellen führen. Der Weg vom Übergabepaket bis zur öffentlichen
 * Artikelseite lief bis hierher über zwei Stellen, die das Feld verloren:
 *
 *   1. Der Importer schrieb es weder im sequenziellen noch im atomaren Pfad —
 *      der Import meldete Erfolg, die Spalte blieb still auf '[]'.
 *   2. Der öffentliche Service reichte den rohen JSONB-Wert durch, ohne den
 *      Feldvertrag zu erzwingen.
 *
 * Abgedeckt:
 *   Roundtrip   create → get → update → erneutes get, Reihenfolge stabil
 *   Roundtrip   leere Quellenliste bleibt leer
 *   Roundtrip   Rohobjekt aus dem Request landet nie in der DB
 *   Importer    --validate meldet ungültige Quellen und lässt gültige durch
 *   Importer    beide Schreibpfade führen die Spalte
 *   Service     Quellen werden normalisiert ausgeliefert
 *   Service     Quellen gehören zum abgefragten Szenario, nicht zu einem anderen
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

// Vitest läuft mit dem Projekt-Root als Arbeitsverzeichnis (vite.config.js).
const PROJECT_ROOT = resolve('.');

// ---------------------------------------------------------------------------
// Testdaten — Format und Inhalt aus dem eingefrorenen Übergabepaket
// ---------------------------------------------------------------------------

const SOURCE_SBFI = {
  title: 'Weiterbildung',
  publisher: 'Staatssekretariat für Bildung Forschung und Innovation SBFI',
  url: 'https://www.sbfi.admin.ch/de/weiterbildung',
};
const SOURCE_SDBB = {
  title: 'Aus- oder Weiterbildungen beurteilen',
  publisher: 'berufsberatung.ch SDBB',
  url: 'https://www.berufsberatung.ch/de/aus-oder-weiterbildungen-beurteilen',
};
const SOURCE_SVEB = {
  title: 'Das passende Weiterbildungsangebot finden',
  publisher: 'weiterbildung.swiss SVEB',
  url: 'https://www.weiterbildung.swiss/?content=wbfinden&layout=11&spr=de',
};

// ===========================================================================
// 1. Admin-API-Roundtrip: create → get → update → get
// ===========================================================================

/**
 * Handler des Admin-Endpunkts. Wird einmal in beforeAll geladen, nicht in
 * jedem Testfall.
 *
 * Der Import zieht sanitize-html nach und kostet beim ersten Mal je nach
 * Maschinenlast mehrere Sekunden. Lag er im ersten Testfall, wurde diese Zeit
 * gegen dessen 5-Sekunden-Budget gerechnet — der Test lief allein zuverlässig
 * durch und riss die Grenze erst unter der Parallellast des vollständigen
 * Laufs. In beforeAll gehört die Ladezeit zum Setup und nicht mehr zu einem
 * einzelnen Fall.
 */
let handler;

beforeAll(async () => {
  process.env.SUPABASE_URL = 'https://omoapbvfligjfznzivyu.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-placeholder';
  process.env.VITE_SUPABASE_URL = 'https://omoapbvfligjfznzivyu.supabase.co';

  ({ default: handler } = await import('../api/admin-theme-world-scenarios.js'));
}, 30_000);

const TW_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.sig';

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}));

const mockSupabaseAdmin = { from: vi.fn() };

vi.mock('../api/_lib/theme-world-auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requireAdmin: vi.fn(async () => ({ supabaseAdmin: mockSupabaseAdmin })),
  };
});

/**
 * Ein sehr kleiner In-Memory-Ersatz für die beiden Tabellen, die der Handler
 * anfasst. Er speichert genau das, was der Handler schreibt — dadurch prüft
 * der Roundtrip den echten Schreib- und Lesepfad und nicht eine Attrappe.
 */
function createFakeDb(initialScenario) {
  const db = { scenario: { ...initialScenario } };

  mockSupabaseAdmin.from.mockImplementation((table) => {
    if (table === 'theme_worlds') {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { id: TW_ID }, error: null }) }) }),
      };
    }

    if (table !== 'theme_world_scenarios') throw new Error(`Unerwartete Tabelle: ${table}`);

    return {
      select: () => ({
        eq: () => ({ single: async () => ({ data: db.scenario, error: null }) }),
      }),
      insert: (payload) => {
        db.scenario = { ...db.scenario, ...payload, id: SC_ID };
        return {
          select: () => ({ single: async () => ({ data: { id: SC_ID, slug: db.scenario.slug, status: 'draft', created_at: 'now' }, error: null }) }),
        };
      },
      update: (payload) => {
        db.scenario = { ...db.scenario, ...payload };
        return {
          eq: () => ({
            select: () => ({ single: async () => ({ data: { id: SC_ID, slug: db.scenario.slug, status: db.scenario.status, updated_at: 'now' }, error: null }) }),
          }),
        };
      },
    };
  });

  return db;
}

async function invoke(method, action, query, body) {
  const req = {
    method,
    query: { action, ...query },
    body: body === undefined ? '{}' : JSON.stringify(body),
    headers: { authorization: `Bearer ${TOKEN}` },
  };
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(payload) { this._body = payload; return this; },
  };
  await handler(req, res);
  return res;
}

function baseScenario(overrides = {}) {
  return {
    id: SC_ID,
    theme_world_id: TW_ID,
    slug: 'kreativ-einsteigen',
    label_de: 'Kreativ einsteigen',
    content_html: '<p>Inhalt.</p>',
    cta_config: {},
    sources: [],
    status: 'draft',
    ...overrides,
  };
}

describe('Admin-API-Roundtrip: sources überstehen create, get, update und erneutes Laden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create speichert die Quellen in der übergebenen Reihenfolge', async () => {
    const db = createFakeDb(baseScenario());

    const res = await invoke('POST', 'create', { themeWorldId: TW_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      sources: [SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB],
    });

    expect(res._status).toBe(201);
    expect(db.scenario.sources).toEqual([SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB]);
  });

  it('get liefert die gespeicherten Quellen unverändert zurück', async () => {
    createFakeDb(baseScenario({ sources: [SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB] }));

    const res = await invoke('GET', 'get', { id: SC_ID });

    expect(res._status).toBe(200);
    expect(res._body.data.sources).toEqual([SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB]);
  });

  it('update mit geänderter Reihenfolge speichert genau diese Reihenfolge', async () => {
    const db = createFakeDb(baseScenario({ sources: [SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB] }));

    const res = await invoke('POST', 'update', { id: SC_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      sources: [SOURCE_SVEB, SOURCE_SBFI, SOURCE_SDBB],
    });

    expect(res._status).toBe(200);
    expect(db.scenario.sources).toEqual([SOURCE_SVEB, SOURCE_SBFI, SOURCE_SDBB]);
  });

  it('ein anschliessendes get zeigt Titel, Herausgeber, URL und Reihenfolge unverändert', async () => {
    createFakeDb(baseScenario());

    await invoke('POST', 'create', { themeWorldId: TW_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      sources: [SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB],
    });

    await invoke('POST', 'update', { id: SC_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      sources: [SOURCE_SDBB, SOURCE_SVEB, SOURCE_SBFI],
    });

    const res = await invoke('GET', 'get', { id: SC_ID });

    expect(res._body.data.sources).toEqual([SOURCE_SDBB, SOURCE_SVEB, SOURCE_SBFI]);
    expect(res._body.data.sources[0].title).toBe(SOURCE_SDBB.title);
    expect(res._body.data.sources[0].publisher).toBe(SOURCE_SDBB.publisher);
    expect(res._body.data.sources[0].url).toBe(SOURCE_SDBB.url);
  });

  it('eine leere Quellenliste bleibt leer und ist kein Fehler', async () => {
    const db = createFakeDb(baseScenario({ sources: [SOURCE_SBFI] }));

    const res = await invoke('POST', 'update', { id: SC_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      sources: [],
    });

    expect(res._status).toBe(200);
    expect(db.scenario.sources).toEqual([]);
  });

  it('schreibt nie das Rohobjekt aus dem Request — unbekannte Felder werden abgewiesen', async () => {
    const db = createFakeDb(baseScenario());

    const res = await invoke('POST', 'update', { id: SC_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      sources: [{ ...SOURCE_SBFI, retrieved_at: '2026-08-19' }],
    });

    expect(res._status).toBe(400);
    expect(db.scenario.sources).toEqual([]); // unverändert
  });

  it('lehnt mehr als zehn Quellen ab, ohne etwas zu schreiben', async () => {
    const db = createFakeDb(baseScenario());
    const many = Array.from({ length: 11 }, (_, i) => ({
      title: `Titel ${i}`,
      publisher: `Herausgeber ${i}`,
      url: `https://example.org/${i}`,
    }));

    const res = await invoke('POST', 'update', { id: SC_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      sources: many,
    });

    expect(res._status).toBe(400);
    expect(db.scenario.sources).toEqual([]);
  });

  it('lehnt eine nicht-http(s)-URL ab, ohne etwas zu schreiben', async () => {
    const db = createFakeDb(baseScenario());

    const res = await invoke('POST', 'update', { id: SC_ID }, {
      slug: 'kreativ-einsteigen',
      label_de: 'Kreativ einsteigen',
      content_html: '<p>Inhalt.</p>',
      // eslint-disable-next-line no-script-url
      sources: [{ title: 'T', publisher: 'P', url: 'javascript:alert(1)' }],
    });

    expect(res._status).toBe(400);
    expect(db.scenario.sources).toEqual([]);
  });
});

// ===========================================================================
// 2. Importer — sources dürfen beim Import nicht verloren gehen
// ===========================================================================

const IMPORTER_PATH = resolve(PROJECT_ROOT, 'scripts/import-theme-world.mjs');
const ATOMIC_MIGRATION = resolve(
  PROJECT_ROOT,
  'supabase/migrations/20260822_import_theme_world_atomic_sources.sql',
);

/** Minimales, gültiges Importpaket mit einem Szenario. */
function buildImportPackage(sources) {
  return {
    version: '1.0',
    schema: 'theme-world-import/v1',
    theme_world: {
      key: 'privat-hobby-kreativkurse',
      slug: 'kreativkurse',
      url_segment: 'privat-hobby',
      db_segment: 'privat',
      title_de: 'Kreativkurse',
      meta_title: 'Kreativkurse in der Schweiz',
      meta_description: 'Kurse für Malen, Töpfern, DIY und Fotografie.',
      status: 'draft',
    },
    scenarios: [
      {
        slug: 'kreativ-einsteigen',
        label_de: 'Kreativ einsteigen',
        content_html: '<p>Inhalt.</p>',
        meta_title: 'Kreativ einsteigen',
        meta_description: 'Der Einstieg in kreative Kurse.',
        status: 'draft',
        ...(sources === undefined ? {} : { sources }),
      },
    ],
    faqs: [],
    editorial_sections: [],
    specialties: [],
    regions: [],
    trust_items: [],
  };
}

/**
 * Führt den Importer im Validate-Modus aus.
 * Rückgabe: { code, output } — nie ein Throw, damit auch der Fehlerfall
 * auswertbar bleibt.
 */
function runValidate(packageObject) {
  const dir = mkdtempSync(join(tmpdir(), 'kursnavi-import-'));
  const file = join(dir, 'package.json');
  writeFileSync(file, JSON.stringify(packageObject), 'utf8');

  try {
    const output = execFileSync('node', [IMPORTER_PATH, '--file', file, '--validate'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (error) {
    return {
      code: error.status ?? 1,
      output: `${error.stdout || ''}${error.stderr || ''}`,
    };
  }
}

describe('Importer: scenarios[].sources', () => {
  it('lässt ein gültiges Quellenpaket durch', () => {
    const result = runValidate(buildImportPackage([SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB]));
    expect(result.code).toBe(0);
    expect(result.output).toContain('Schema valide');
  });

  it('akzeptiert ein Szenario ganz ohne sources-Feld', () => {
    const result = runValidate(buildImportPackage(undefined));
    expect(result.code).toBe(0);
  });

  it('akzeptiert eine ausdrücklich leere Quellenliste', () => {
    const result = runValidate(buildImportPackage([]));
    expect(result.code).toBe(0);
  });

  it('meldet eine ungültige URL als Fehler statt sie stillschweigend zu importieren', () => {
    const result = runValidate(buildImportPackage([
      { title: 'Titel', publisher: 'Herausgeber', url: 'nicht-absolut' },
    ]));
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('url');
  });

  it('meldet ein unbekanntes Feld in einer Quelle', () => {
    const result = runValidate(buildImportPackage([
      { ...SOURCE_SBFI, retrieved_at: '2026-08-19' },
    ]));
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('retrieved_at');
  });

  it('meldet mehr als zehn Quellen', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      title: `Titel ${i}`,
      publisher: `Herausgeber ${i}`,
      url: `https://example.org/${i}`,
    }));
    const result = runValidate(buildImportPackage(many));
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('Maximal 10');
  });

  // Beide Schreibpfade führen die Spalte explizit auf. Genau dieses Vergessen
  // war der ursprüngliche Datenverlust: der Import lief fehlerfrei durch und
  // liess sources auf dem Spaltendefault stehen.
  it('der sequenzielle Schreibpfad führt sources im Szenario-Payload', () => {
    const source = readFileSync(IMPORTER_PATH, 'utf8');
    expect(source).toMatch(/sources:\s*validateScenarioSources\(s\.sources\)\.sources/);
  });

  it('der atomare RPC schreibt sources beim Insert und beim Re-Import', () => {
    const sql = readFileSync(ATOMIC_MIGRATION, 'utf8');
    const scenarioInsert = sql.slice(sql.indexOf('INSERT INTO public.theme_world_scenarios'));
    expect(scenarioInsert).toContain('sources');
    expect(scenarioInsert).toMatch(/sources\s*=\s*EXCLUDED\.sources/);
  });

  it('die Migration ist idempotent anwendbar', () => {
    const sql = readFileSync(ATOMIC_MIGRATION, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.import_theme_world_atomic');
  });
});

// ===========================================================================
// 3. Öffentlicher Lesepfad — richtige Quellen beim richtigen Szenario
// ===========================================================================

describe('themeWorldService: Quellen im öffentlichen Lesepfad', () => {
  /**
   * Baut einen Supabase-Doppelgänger, der pro Slug einen anderen Datensatz
   * liefert — damit lässt sich prüfen, dass die Quellen dem abgefragten
   * Szenario folgen und nicht einem beliebigen anderen.
   */
  async function loadServiceWithRows(rowsBySlug) {
    vi.resetModules();

    const from = vi.fn(() => {
      const state = {};
      const builder = {
        select: () => builder,
        eq: (column, value) => {
          state[column] = value;
          return builder;
        },
        single: async () => {
          const row = rowsBySlug[state.slug];
          return row
            ? { data: row, error: null }
            : { data: null, error: { code: 'PGRST116' } };
        },
      };
      return builder;
    });

    vi.doMock('../src/lib/supabase', () => ({ supabase: { from } }));
    return import('../src/lib/themeWorldService.js');
  }

  const ROWS = {
    'kreativ-einsteigen': {
      id: 'sc-1',
      slug: 'kreativ-einsteigen',
      sources: [SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB],
    },
    'malen-zeichnen': {
      id: 'sc-2',
      slug: 'malen-zeichnen',
      sources: [{
        title: 'Handwerkzeuge Checkliste 67078.D',
        publisher: 'Suva',
        url: 'https://www.suva.ch/de-ch/download/checklisten/handwerkzeuge/handwerkzeuge--67078.d?sc_lang=de-CH',
      }],
    },
    'ohne-quellen': { id: 'sc-3', slug: 'ohne-quellen', sources: [] },
  };

  it('liefert die Quellen des abgefragten Szenarios in unveränderter Reihenfolge', async () => {
    const service = await loadServiceWithRows(ROWS);
    const row = await service.fetchPublishedScenario('tw-1', 'kreativ-einsteigen');

    expect(row.sources).toEqual([SOURCE_SBFI, SOURCE_SDBB, SOURCE_SVEB]);
  });

  it('liefert keine fremden Quellen beim anderen Szenario', async () => {
    const service = await loadServiceWithRows(ROWS);
    const row = await service.fetchPublishedScenario('tw-1', 'malen-zeichnen');

    expect(row.sources).toHaveLength(1);
    expect(row.sources[0].publisher).toBe('Suva');
    expect(row.sources.map((s) => s.url)).not.toContain(SOURCE_SBFI.url);
  });

  it('liefert ein leeres Array für ein Szenario ohne Quellen', async () => {
    const service = await loadServiceWithRows(ROWS);
    const row = await service.fetchPublishedScenario('tw-1', 'ohne-quellen');

    expect(row.sources).toEqual([]);
  });

  // Ein Altbestand oder ein Eintrag aus einer Umgebung ohne strengen
  // Schreibpfad darf keine unsicheren Links auf eine öffentliche Seite tragen.
  it('verwirft ungültige Einträge, ohne die Reihenfolge der gültigen zu stören', async () => {
    const service = await loadServiceWithRows({
      'gemischt': {
        id: 'sc-4',
        slug: 'gemischt',
        sources: [
          SOURCE_SBFI,
          { title: 'Ohne URL', publisher: 'X' },
          // eslint-disable-next-line no-script-url
          { title: 'Böse', publisher: 'X', url: 'javascript:alert(1)' },
          SOURCE_SVEB,
        ],
      },
    });

    const row = await service.fetchPublishedScenario('tw-1', 'gemischt');
    expect(row.sources).toEqual([SOURCE_SBFI, SOURCE_SVEB]);
  });

  it('bricht nicht, wenn die Spalte in der Umgebung fehlt', async () => {
    const service = await loadServiceWithRows({
      'alt': { id: 'sc-5', slug: 'alt' },
    });

    const row = await service.fetchPublishedScenario('tw-1', 'alt');
    expect(row.sources).toEqual([]);
  });
});
