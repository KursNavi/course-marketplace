/**
 * Phase 7.8 — Scenario Admin Server Fix Tests (updated: Phase 7.8.1)
 *
 * Root cause: admin-theme-world-scenarios.js imports sanitize-html (CJS)
 * which requires htmlparser2. htmlparser2 v12+ is ESM-only, causing
 * ERR_REQUIRE_ESM → FUNCTION_INVOCATION_FAILED on Vercel (Node.js 20.x).
 *
 * Phase 7.8 attempted fix: engines.node ">=22" (wrong format — Vercel needs "22.x")
 * Phase 7.8.1 fix (this commit):
 *   1. engines.node: "22.x"  — correct Vercel format
 *   2. overrides.htmlparser2: "9.x"  — pin to last CJS version (runtime-independent)
 *
 * Why both?
 *   - engines.node "22.x" upgrades Vercel's Node.js runtime (belt)
 *   - htmlparser2 override removes the ESM-only dep entirely (suspenders)
 *
 * Covers:
 *   1. package.json engines.node is "22.x" (correct Vercel format)
 *   2. package.json overrides.htmlparser2 is "9.x" (CJS pin)
 *   3. htmlparser2 used by sanitize-html is v9.x (CJS — no type:module)
 *   4. sanitize-html can be imported and sanitizes correctly
 *   5. admin-theme-world-scenarios.js module loads without error
 *   6. listScenarios API client sends correct URL and reads result.data
 *   7. getThemeWorld API client reads result.data (no wrapper mismatch)
 *   8. Regression: body.items fix from Phase 7.7 still in place
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}));

// ---------------------------------------------------------------------------
// 1. package.json engines.node is "22.x" (correct Vercel format)
// ---------------------------------------------------------------------------

describe('Phase 7.8.1: package.json engines.node', () => {
  it('has engines.node set to "22.x" (Vercel-recognized format)', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    expect(pkg).toHaveProperty('engines');
    expect(pkg.engines).toHaveProperty('node');
    // Vercel recognizes "22.x" and "^22.0.0" — NOT ">=22" (wrong format)
    const nodeReq = pkg.engines.node;
    const match = nodeReq.match(/\d+/);
    const major = match ? parseInt(match[0], 10) : NaN;
    expect(major).toBeGreaterThanOrEqual(22);
    // Specifically must be "22.x" — the format Vercel's docs show
    expect(nodeReq).toBe('22.x');
  });
});

// ---------------------------------------------------------------------------
// 2. package.json overrides.htmlparser2 is "9.x"
// ---------------------------------------------------------------------------

describe('Phase 7.8.1: package.json npm overrides', () => {
  it('has overrides.htmlparser2 pinned to 9.x (last CJS version)', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    expect(pkg).toHaveProperty('overrides');
    expect(pkg.overrides).toHaveProperty('htmlparser2');
    // Must pin to v9.x (CJS) — v10+ switched to ESM-only
    const override = pkg.overrides.htmlparser2;
    const match = override.match(/\d+/);
    const major = match ? parseInt(match[0], 10) : NaN;
    expect(major).toBe(9);
  });

  it('has htmlparser2 installed as v9.x via override', () => {
    // When overridden, npm installs it nested under sanitize-html
    const pkgPath = resolve('node_modules/sanitize-html/node_modules/htmlparser2/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const major = parseInt(pkg.version.split('.')[0], 10);
    expect(major).toBe(9);
  });

  it('htmlparser2 v9 is CommonJS (no type:module field)', () => {
    const pkgPath = resolve('node_modules/sanitize-html/node_modules/htmlparser2/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    // CJS packages have no "type" field (or "type":"commonjs")
    expect(pkg.type).toBeUndefined();
  });

  it('htmlparser2 v9 has CJS module.exports (not ESM export syntax)', () => {
    const pkgPath = resolve('node_modules/sanitize-html/node_modules/htmlparser2/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const mainPath = resolve(`node_modules/sanitize-html/node_modules/htmlparser2/${pkg.main || 'lib/index.js'}`);
    const content = readFileSync(mainPath, 'utf8');
    // CJS: has module.exports or exports.something
    expect(content).toMatch(/module\.exports|exports\./);
    // NOT ESM
    expect(content).not.toMatch(/^export /m);
  });
});

// ---------------------------------------------------------------------------
// 3. sanitize-html works with CJS htmlparser2 (no require(esm) needed)
// ---------------------------------------------------------------------------

describe('Phase 7.8.1: sanitize-html with CJS htmlparser2', () => {
  it('sanitize-html uses require("htmlparser2") (CJS chain)', () => {
    const content = readFileSync(resolve('node_modules/sanitize-html/index.js'), 'utf8');
    expect(content).toContain("require('htmlparser2')");
  });

  it('can be imported as ESM default and works on any Node.js (CJS chain is clean)', async () => {
    const { default: sanitize } = await import('sanitize-html');
    expect(typeof sanitize).toBe('function');
  });

  it('sanitizes HTML correctly (no ESM interop required)', async () => {
    const { default: sanitize } = await import('sanitize-html');
    const result = sanitize('<p>Safe <script>evil()</script> <b>world</b></p>', {
      allowedTags: ['p', 'b'],
    });
    expect(result).toBe('<p>Safe  <b>world</b></p>');
    expect(result).not.toContain('evil');
    expect(result).not.toContain('script');
  });
});

// ---------------------------------------------------------------------------
// 4. admin-theme-world-scenarios.js module loads without error
// ---------------------------------------------------------------------------

describe('Phase 7.8.1: admin-theme-world-scenarios.js module health', () => {
  it('exports a default handler function', async () => {
    process.env.SUPABASE_URL = 'https://omoapbvfligjfznzivyu.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-for-import-check';

    const mod = await import('../api/admin-theme-world-scenarios.js');
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 5. API client: listScenarios sends correct URL, reads result.data
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

import { listScenarios, getThemeWorld } from '../src/lib/themeWorldAdminApi.js';

const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.sig';
const FAKE_TW_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

let fetchSpy;
beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: FAKE_TOKEN } },
  });
  fetchSpy = vi.spyOn(global, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());

function mockFetchResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  });
}

describe('Phase 7.8.1: listScenarios API client', () => {
  it('calls the correct endpoint URL', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: [] }));
    await listScenarios(FAKE_TW_ID);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/admin-theme-world-scenarios');
    expect(url).toContain('action=list');
    expect(url).toContain(`themeWorldId=${FAKE_TW_ID}`);
  });

  it('reads result.data from the response', async () => {
    const scenarios = [
      { id: 's1', label_de: 'Yoga für Anfänger', sort_order: 1 },
      { id: 's2', label_de: 'Stress abbauen', sort_order: 2 },
    ];
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: scenarios }));
    const result = await listScenarios(FAKE_TW_ID);
    expect(result).toEqual(scenarios);
    expect(result).toHaveLength(2);
  });

  it('returns [] when result.data is empty', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: [] }));
    const result = await listScenarios(FAKE_TW_ID);
    expect(result).toEqual([]);
  });

  it('returns [] when result.data is null', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: null }));
    const result = await listScenarios(FAKE_TW_ID);
    expect(result).toEqual([]);
  });

  it('returns 8 scenarios for Yoga-shaped payload', async () => {
    const yogaScenarios = Array.from({ length: 8 }, (_, i) => ({
      id: `yoga-id-${i}`,
      label_de: `Yoga Szenario ${i + 1}`,
      sort_order: i + 1,
      status: 'published',
    }));
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: yogaScenarios }));
    const result = await listScenarios(FAKE_TW_ID);
    expect(result).toHaveLength(8);
    expect(result[0].sort_order).toBe(1);
    expect(result[7].sort_order).toBe(8);
  });

  it('throws ApiError on 500 server error', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(500, { error: 'Interner Serverfehler.' }));
    await expect(listScenarios(FAKE_TW_ID)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. getThemeWorld reads result.data (not result directly)
// ---------------------------------------------------------------------------

describe('Phase 7.8.1: getThemeWorld API client', () => {
  it('reads result.data from the response', async () => {
    const tw = { id: FAKE_TW_ID, title_de: 'Yoga & Achtsamkeit', status: 'published' };
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: tw }));
    const result = await getThemeWorld(FAKE_TW_ID);
    expect(result).toEqual(tw);
    expect(result.status).toBe('published');
  });

  it('calls the correct endpoint URL for get action', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { id: FAKE_TW_ID } }));
    await getThemeWorld(FAKE_TW_ID);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/admin-theme-worlds');
    expect(url).toContain('action=get');
    expect(url).toContain(`id=${FAKE_TW_ID}`);
  });
});

// ---------------------------------------------------------------------------
// 7. Regression: Phase 7.7 body.items fix still in place
// ---------------------------------------------------------------------------

import {
  replaceFaqs,
  replaceEditorialSections,
  replaceSpecialties,
  replaceRegions,
  replaceTrustItems,
  reorderScenarios,
} from '../src/lib/themeWorldAdminApi.js';

describe('Phase 7.8.1 Regression: body.items fix (from Phase 7.7) still in place', () => {
  const CHECK_ITEMS = [{ id: 'x', sort_order: 1 }];

  it('replaceFaqs sends body.items', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 1 } }));
    await replaceFaqs(FAKE_TW_ID, CHECK_ITEMS);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.items).toEqual(CHECK_ITEMS);
    expect(body.faqs).toBeUndefined();
  });

  it('replaceEditorialSections sends body.items', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 1 } }));
    await replaceEditorialSections(FAKE_TW_ID, CHECK_ITEMS);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.items).toEqual(CHECK_ITEMS);
    expect(body.sections).toBeUndefined();
  });

  it('replaceSpecialties sends body.items', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 1 } }));
    await replaceSpecialties(FAKE_TW_ID, CHECK_ITEMS);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.items).toEqual(CHECK_ITEMS);
    expect(body.specialties).toBeUndefined();
  });

  it('replaceRegions sends body.items', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 1 } }));
    await replaceRegions(FAKE_TW_ID, CHECK_ITEMS);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.items).toEqual(CHECK_ITEMS);
    expect(body.regions).toBeUndefined();
  });

  it('replaceTrustItems sends body.items', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { count: 1 } }));
    await replaceTrustItems(FAKE_TW_ID, CHECK_ITEMS);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.items).toEqual(CHECK_ITEMS);
    expect(body.trustItems).toBeUndefined();
  });

  it('reorderScenarios sends body.items', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: {} }));
    await reorderScenarios(FAKE_TW_ID, CHECK_ITEMS);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.items).toEqual(CHECK_ITEMS);
    expect(body.order).toBeUndefined();
  });
});
