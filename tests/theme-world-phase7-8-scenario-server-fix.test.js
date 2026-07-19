/**
 * Phase 7.8 — Scenario Admin Server Fix Tests
 *
 * Root cause: admin-theme-world-scenarios.js imports sanitize-html (CJS)
 * which requires htmlparser2 v12 (ESM-only). This causes ERR_REQUIRE_ESM
 * on Node.js < 22, resulting in FUNCTION_INVOCATION_FAILED on Vercel Preview.
 *
 * Fix: add engines.node >= 22 to package.json so Vercel uses Node.js 22.x
 * where require(esm) is supported natively.
 *
 * Covers:
 *   1. package.json engines.node >= 22
 *   2. sanitize-html can be imported in ESM context (Node >= 22 confirms this)
 *   3. htmlparser2 is ESM-only (no CJS exports)
 *   4. admin-theme-world-scenarios.js module imports without error
 *   5. listScenarios API client sends correct URL and reads result.data
 *   6. getThemeWorld API client reads result.data (no wrapper mismatch)
 *   7. Regression: body.items fix from Phase 7.7 still in place
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
// 1. package.json engines.node >= 22
// ---------------------------------------------------------------------------

describe('Phase 7.8: package.json engines.node', () => {
  it('has engines.node field set to >=22', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    expect(pkg).toHaveProperty('engines');
    expect(pkg.engines).toHaveProperty('node');
    // Must require Node.js >= 22 to support require(esm) for sanitize-html → htmlparser2
    const nodeReq = pkg.engines.node;
    // Accept: ">=22", "22.x", "^22", "22" — any that implies 22+
    const match = nodeReq.match(/\d+/);
    const major = match ? parseInt(match[0], 10) : NaN;
    expect(major).toBeGreaterThanOrEqual(22);
  });
});

// ---------------------------------------------------------------------------
// 2. htmlparser2 is ESM-only (no CJS exports) — confirms root cause
// ---------------------------------------------------------------------------

describe('Phase 7.8: htmlparser2 v12 is ESM-only', () => {
  it('htmlparser2 dist/index.js uses ESM syntax (import/export)', () => {
    const indexPath = resolve('node_modules/htmlparser2/dist/index.js');
    const content = readFileSync(indexPath, 'utf8');
    expect(content).toMatch(/^import\s+/m);
    expect(content).toMatch(/^export\s+/m);
  });

  it('htmlparser2 dist/index.js has no CJS module.exports or require()', () => {
    const indexPath = resolve('node_modules/htmlparser2/dist/index.js');
    const content = readFileSync(indexPath, 'utf8');
    expect(content).not.toContain('module.exports');
    expect(content).not.toContain('require(');
  });

  it('htmlparser2 package.json type is module', () => {
    const pkg = JSON.parse(readFileSync(resolve('node_modules/htmlparser2/package.json'), 'utf8'));
    expect(pkg.type).toBe('module');
  });

  it('sanitize-html index.js uses require() for htmlparser2 (CJS package)', () => {
    const content = readFileSync(resolve('node_modules/sanitize-html/index.js'), 'utf8');
    expect(content).toContain("require('htmlparser2')");
  });
});

// ---------------------------------------------------------------------------
// 3. sanitize-html ESM import works (Node.js >= 22 enables require(esm))
// ---------------------------------------------------------------------------

describe('Phase 7.8: sanitize-html ESM default import', () => {
  it('can be imported as ESM default in the current Node.js runtime', async () => {
    // This test only passes on Node.js >= 22 where require(esm) is supported.
    // If this test fails, engines.node must be raised.
    const { default: sanitize } = await import('sanitize-html');
    expect(typeof sanitize).toBe('function');
  });

  it('sanitizes HTML correctly after ESM import', async () => {
    const { default: sanitize } = await import('sanitize-html');
    const result = sanitize('<p>Safe <script>evil()</script></p>', {
      allowedTags: ['p'],
    });
    expect(result).toBe('<p>Safe </p>');
    expect(result).not.toContain('evil');
    expect(result).not.toContain('script');
  });
});

// ---------------------------------------------------------------------------
// 4. admin-theme-world-scenarios.js module loads without error
// ---------------------------------------------------------------------------

describe('Phase 7.8: admin-theme-world-scenarios.js module health', () => {
  it('exports a default handler function', async () => {
    // Provide env vars so requireAdmin module-level code doesn't fail
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

describe('Phase 7.8: listScenarios API client', () => {
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

describe('Phase 7.8: getThemeWorld API client', () => {
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

describe('Phase 7.8 Regression: body.items fix (from Phase 7.7) still in place', () => {
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
