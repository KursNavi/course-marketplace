/**
 * Tests für die kanonischen Kurs-URLs in der Sitemap.
 *
 * Audit-Befund: 361 von 476 Course-Sitemap-URLs verwendeten ein numerisches
 * Themensegment (/courses/12/...), weil die Sitemap das rohe Feld
 * `courses.category_area` benutzte. Der Browser zeigte dagegen die semantische
 * Kategorie (/courses/kunst/...). Nach dem Fix löst die Sitemap die Kategorie
 * über v_course_full_categories auf — dieselbe Quelle wie der Client.
 *
 * Supabase wird vollständig gemockt — kein echter DB-Zugriff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

/** Kurs 779 aus dem Audit: numerische Spalte, semantische Taxonomie-Zeile. */
const COURSE_NUMERIC = {
  id: 779,
  title: '18k Gold Wax Ring Carving Workshop für zwei Personen',
  category_type: 'privat',
  category_area: '12',
  category_specialty: null,
  category_focus: null,
  canton: 'Zürich',
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Kurs, dessen Kategorie bereits als Slug in der courses-Tabelle steht. */
const COURSE_SLUG = {
  id: 363,
  title: 'Spanisch Konversationskurs',
  category_type: 'privat',
  category_area: 'sprachen_privat',
  category_specialty: null,
  category_focus: null,
  canton: 'Bern',
  created_at: '2026-01-02T00:00:00.000Z',
};

const CATEGORY_ROW_779 = {
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

/** Dieselbe Kategorie-Form, die api/_lib/course-categories.js aus der View baut. */
const EXPECTED_CATEGORY_779 = {
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
};

function courseLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]*\/courses\/[^<]*)<\/loc>/g)].map((match) => match[1]);
}

async function renderSitemap(tables) {
  mockState.supabase = makeSupabaseMock(tables);
  vi.resetModules();
  const { default: handler } = await import('../api/sitemap.js');
  const res = makeMockRes();
  await handler(makeMockReq(), res);
  return res;
}

// ============================================================
// Tests
// ============================================================

describe('Sitemap: kanonische Kurs-URLs', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.VITE_SITE_URL = BASE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nutzt das semantische Themensegment statt der numerischen Taxonomie-ID', async () => {
    const res = await renderSitemap({
      courses: { data: [COURSE_NUMERIC], error: null },
      v_course_full_categories: { data: [CATEGORY_ROW_779], error: null },
    });

    expect(res._status).toBe(200);
    expect(courseLocs(res._sent)).toEqual([
      `${BASE}/courses/kunst/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen`,
    ]);
  });

  it('erzeugt keine numerischen Themensegmente mehr', async () => {
    const res = await renderSitemap({
      courses: { data: [COURSE_NUMERIC, COURSE_SLUG], error: null },
      v_course_full_categories: { data: [CATEGORY_ROW_779], error: null },
    });

    const numeric = courseLocs(res._sent).filter((loc) => /\/courses\/\d+\//.test(loc));
    expect(numeric).toEqual([]);
  });

  it('normalisiert Umlaute in Ort und Titel identisch zum Browser', async () => {
    const res = await renderSitemap({
      courses: { data: [COURSE_NUMERIC], error: null },
      v_course_full_categories: { data: [CATEGORY_ROW_779], error: null },
    });

    const [loc] = courseLocs(res._sent);
    expect(loc).toContain('/zuerich/');
    expect(loc).toContain('-fuer-zwei-personen');
    expect(loc).not.toContain('zürich');
    expect(loc).not.toContain('f-r');
    expect(loc).not.toContain('%');
  });

  it('lässt bereits kanonische Bestands-URLs unverändert', async () => {
    const res = await renderSitemap({
      courses: { data: [COURSE_SLUG], error: null },
      v_course_full_categories: { data: [], error: null },
    });

    expect(courseLocs(res._sent)).toEqual([
      `${BASE}/courses/sprachen-privat/bern/363-spanisch-konversationskurs`,
    ]);
  });

  it('fragt die Kategorien über v_course_full_categories ab', async () => {
    mockState.supabase = makeSupabaseMock({
      courses: { data: [COURSE_NUMERIC], error: null },
      v_course_full_categories: { data: [CATEGORY_ROW_779], error: null },
    });
    vi.resetModules();
    const { default: handler } = await import('../api/sitemap.js');
    await handler(makeMockReq(), makeMockRes());

    const queriedTables = mockState.supabase.from.mock.calls.map(([table]) => table);
    expect(queriedTables).toContain('v_course_full_categories');
  });
});

// ============================================================
// Keine geratenen URLs bei Kategorie-Ausfall
// ============================================================

describe('Sitemap: raet keine kanonische Kurs-URL', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.VITE_SITE_URL = BASE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. numerischer Kurs + Kategorie geladen → korrekte semantische URL', async () => {
    const res = await renderSitemap({
      courses: { data: [COURSE_NUMERIC], error: null },
      v_course_full_categories: { data: [CATEGORY_ROW_779], error: null },
    });

    expect(courseLocs(res._sent)).toEqual([
      `${BASE}/courses/kunst/zuerich/779-18k-gold-wax-ring-carving-workshop-fuer-zwei-personen`,
    ]);
  });

  it('2. numerischer Kurs + Kategorieabfrage fehlgeschlagen → Kurs fehlt in der Sitemap', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await renderSitemap({
      courses: { data: [COURSE_NUMERIC], error: null },
      v_course_full_categories: { data: null, error: { message: 'view down' } },
    });

    // Lieber gar keine URL als eine geratene, die sich spaeter aendert.
    expect(courseLocs(res._sent)).toEqual([]);
    expect(res._sent).not.toContain('/courses/privat/');
    expect(res._sent).not.toContain('/courses/kurs/');

    const logged = warn.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).toContain('779');
    expect(logged).not.toContain('test-key');
  });

  it('3. semantischer Legacy-Kurs + Kategorieabfrage fehlgeschlagen → URL bleibt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await renderSitemap({
      courses: { data: [COURSE_SLUG], error: null },
      v_course_full_categories: { data: null, error: { message: 'view down' } },
    });

    // Dieser Kurs braucht die View gar nicht — seine URL ist stabil.
    expect(courseLocs(res._sent)).toEqual([
      `${BASE}/courses/sprachen-privat/bern/363-spanisch-konversationskurs`,
    ]);
  });

  it('4. Sitemap-Pfad ist identisch mit buildCanonicalCoursePath des vollen Kursobjekts', async () => {
    const res = await renderSitemap({
      courses: { data: [COURSE_NUMERIC, COURSE_SLUG], error: null },
      v_course_full_categories: { data: [CATEGORY_ROW_779], error: null },
    });

    const { buildCanonicalCoursePath } = await import('../src/lib/courseUrl.js');
    const fullCourse779 = { ...COURSE_NUMERIC, all_categories: [EXPECTED_CATEGORY_779] };

    expect(courseLocs(res._sent)).toEqual([
      `${BASE}${buildCanonicalCoursePath(fullCourse779)}`,
      `${BASE}${buildCanonicalCoursePath(COURSE_SLUG)}`,
    ]);
  });

  it('ein einzelner Kategoriefehler bricht die restliche Sitemap nicht', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await renderSitemap({
      courses: { data: [COURSE_NUMERIC, COURSE_SLUG], error: null },
      v_course_full_categories: { data: null, error: { message: 'view down' } },
    });

    expect(res._status).toBe(200);
    // Der stabile Kurs bleibt, der ungeklaerte faellt weg …
    expect(courseLocs(res._sent)).toEqual([
      `${BASE}/courses/sprachen-privat/bern/363-spanisch-konversationskurs`,
    ]);
    // … und alle uebrigen Sitemap-Bereiche sind unveraendert vorhanden.
    expect(res._sent).toContain(`${BASE}/search`);
    expect(res._sent).toContain(`${BASE}/ratgeber`);
    expect(res._sent).toContain('</urlset>');
  });
});
