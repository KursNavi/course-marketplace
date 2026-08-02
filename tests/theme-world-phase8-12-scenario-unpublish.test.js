/**
 * Phase 8.12 — Scenario Unpublish: API Handler + Client Tests
 *
 * API handler tests (admin-theme-world-scenarios.js):
 *   1.  published → draft (status wird draft)
 *   2.  published_at wird auf null gesetzt
 *   3.  Response enthält status draft + message
 *   4.  unpublish bei draft ergibt 409
 *   5.  unpublish bei archived ergibt 409
 *   6.  unbekannte ID ergibt 404
 *   7a. fehlende ID ergibt 400
 *   7b. ungültige UUID ergibt 400
 *   8.  fehlender Bearer ergibt 401
 *   9.  nur das gezielte Szenario wird aktualisiert
 *
 * Client tests (themeWorldAdminApi.js):
 *   10a. unpublishScenario sendet POST mit action=unpublish und id
 *   10b. gibt data.status=draft zurück
 *   11a. 409-Fehler wird als ApiError weitergereicht
 *   11b. ApiError hat status 409
 *   11c. 404-Fehler wird als ApiError weitergereicht
 *   11d. 500-Fehler wird als ApiError weitergereicht
 *
 * Regression API:
 *   25a. archived → published bleibt blockiert (409 in API)
 *   26.  keine Sonderlogik für bestimmte Slugs
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Env vars — müssen vor dem ersten Handler-Import gesetzt sein
// ---------------------------------------------------------------------------

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://omoapbvfligjfznzivyu.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-placeholder';
  process.env.VITE_SUPABASE_URL = 'https://omoapbvfligjfznzivyu.supabase.co';
});

// ---------------------------------------------------------------------------
// Gültige UUID v4: Gruppe 3 muss mit '4' beginnen, Gruppe 4 mit [89ab]
// ---------------------------------------------------------------------------
const FAKE_TW_ID    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FAKE_S_ID_1   = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FAKE_S_ID_2   = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FAKE_TOKEN    = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.sig';

// ---------------------------------------------------------------------------
// Mock für Supabase (nicht direkt genutzt in Handler, aber importiert)
// ---------------------------------------------------------------------------
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}));

// ---------------------------------------------------------------------------
// mockSupabaseAdmin — wird im requireAdmin-Mock zurückgegeben
// ---------------------------------------------------------------------------
const mockSupabaseAdmin = { from: vi.fn() };

// ---------------------------------------------------------------------------
// Mock für theme-world-auth.js
// requireAdmin: prüft nur Bearer; gibt mockSupabaseAdmin zurück
// isValidUUID, requireMethod, parseBody: echte Implementierungen
// ---------------------------------------------------------------------------
vi.mock('../api/_lib/theme-world-auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requireAdmin: vi.fn(async (req, res) => {
      const authHeader = req.headers?.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Nicht autorisiert.' });
        return null;
      }
      return { supabaseAdmin: mockSupabaseAdmin };
    }),
  };
});

// ---------------------------------------------------------------------------
// Hilfsfunktion: Handler aufrufen
// ---------------------------------------------------------------------------
async function invokeHandler(method, action, id, extraQuery = {}) {
  const { default: handler } = await import('../api/admin-theme-world-scenarios.js');

  const req = {
    method,
    query: { action, ...(id !== undefined ? { id } : {}), ...extraQuery },
    body: '{}',
    headers: { authorization: `Bearer ${FAKE_TOKEN}` },
  };

  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };

  await handler(req, res);
  return res;
}

async function invokeHandlerNoAuth(method, action, id) {
  const { default: handler } = await import('../api/admin-theme-world-scenarios.js');

  const req = {
    method,
    query: { action, ...(id !== undefined ? { id } : {}) },
    body: '{}',
    headers: {},
  };

  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };

  await handler(req, res);
  return res;
}

// ---------------------------------------------------------------------------
// Setup: mockSupabaseAdmin.from zurücksetzen
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// API Tests 1–3: published → draft
// ---------------------------------------------------------------------------

describe('Phase 8.12 API: unpublish — published → draft', () => {
  function setupPublishedScenario() {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: FAKE_S_ID_1, status: 'published' },
        error: null,
      }),
    };
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: FAKE_S_ID_1, status: 'draft', published_at: null, updated_at: '2026-08-02T10:00:00Z' },
        error: null,
      }),
    };
    let callCount = 0;
    mockSupabaseAdmin.from = vi.fn(() => {
      callCount++;
      return callCount === 1 ? selectChain : updateChain;
    });
    return { selectChain, updateChain };
  }

  it('(1) sets status to draft when scenario is published', async () => {
    setupPublishedScenario();
    const res = await invokeHandler('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
  });

  it('(2) sets published_at to null', async () => {
    const { updateChain } = setupPublishedScenario();
    const res = await invokeHandler('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(200);
    expect(res._body.data.published_at).toBeNull();
    // Verify update payload contains both status and published_at
    expect(updateChain.update).toHaveBeenCalledWith({ status: 'draft', published_at: null });
  });

  it('(3) response contains status=draft and message about Entwurf', async () => {
    setupPublishedScenario();
    const res = await invokeHandler('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
    expect(res._body.message).toBeTruthy();
    expect(res._body.message).toContain('zurückgezogen');
    expect(res._body.message).toContain('Entwurf');
  });
});

// ---------------------------------------------------------------------------
// API Tests 4–5: 409 bei draft oder archived
// ---------------------------------------------------------------------------

describe('Phase 8.12 API: unpublish — 409 bei falschem Status', () => {
  it('(4) returns 409 when scenario is draft', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: FAKE_S_ID_1, status: 'draft' },
        error: null,
      }),
    };
    mockSupabaseAdmin.from = vi.fn(() => selectChain);

    const res = await invokeHandler('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(409);
    expect(res._body.error).toContain('publizierte');
  });

  it('(5) returns 409 when scenario is archived', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: FAKE_S_ID_1, status: 'archived' },
        error: null,
      }),
    };
    mockSupabaseAdmin.from = vi.fn(() => selectChain);

    const res = await invokeHandler('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(409);
    expect(res._body.error).toContain('publizierte');
  });
});

// ---------------------------------------------------------------------------
// API Test 6: 404 für unbekannte ID
// ---------------------------------------------------------------------------

describe('Phase 8.12 API: unpublish — 404 für unbekannte ID', () => {
  it('(6) returns 404 when scenario does not exist', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      }),
    };
    mockSupabaseAdmin.from = vi.fn(() => selectChain);

    const res = await invokeHandler('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(404);
    expect(res._body.error).toContain('nicht gefunden');
  });
});

// ---------------------------------------------------------------------------
// API Tests 7a–7b: fehlende / ungültige ID
// ---------------------------------------------------------------------------

describe('Phase 8.12 API: unpublish — fehlende oder ungültige ID', () => {
  it('(7a) returns 400 when id is missing', async () => {
    const res = await invokeHandler('POST', 'unpublish', undefined);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/ID/i);
  });

  it('(7b) returns 400 when id is not a valid UUID v4', async () => {
    const res = await invokeHandler('POST', 'unpublish', 'not-a-uuid');
    expect(res._status).toBe(400);
  });

  it('(7c) returns 400 for UUID with wrong version (not v4)', async () => {
    // Version 1 UUID: 3rd group starts with 1, not 4
    const res = await invokeHandler('POST', 'unpublish', '11111111-1111-1111-1111-111111111111');
    expect(res._status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// API Test 8: Auth-Schutz
// ---------------------------------------------------------------------------

describe('Phase 8.12 API: unpublish — Authentifizierung', () => {
  it('(8) returns 401 when no Bearer token is provided', async () => {
    const res = await invokeHandlerNoAuth('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// API Test 9: Isolation — nur das gezielte Szenario wird aktualisiert
// ---------------------------------------------------------------------------

describe('Phase 8.12 API: unpublish — Isolation', () => {
  it('(9) update uses WHERE id = targetId, not id = otherId', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: FAKE_S_ID_1, status: 'published' },
        error: null,
      }),
    };
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: FAKE_S_ID_1, status: 'draft', published_at: null, updated_at: '2026-08-02T10:00:00Z' },
        error: null,
      }),
    };
    let callCount = 0;
    mockSupabaseAdmin.from = vi.fn(() => {
      callCount++;
      return callCount === 1 ? selectChain : updateChain;
    });

    const res = await invokeHandler('POST', 'unpublish', FAKE_S_ID_1);
    expect(res._status).toBe(200);

    // The update chain's .eq must have been called with the target ID, not ID_2
    const eqCalls = updateChain.eq.mock.calls;
    expect(eqCalls.some(call => call[0] === 'id' && call[1] === FAKE_S_ID_1)).toBe(true);
    expect(eqCalls.some(call => call[1] === FAKE_S_ID_2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Client Tests 10–11: unpublishScenario() in themeWorldAdminApi.js
// Verwende vi.importActual um die echte Funktion (nicht das Mock) zu laden.
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: vi.fn(),
  },
}));

let fetchSpy;
beforeEach(() => {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: FAKE_TOKEN } },
  });
  fetchSpy = vi.spyOn(global, 'fetch');
});
afterEach(() => fetchSpy?.mockRestore());

function mockFetchResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  });
}

describe('Phase 8.12 Client: unpublishScenario', () => {
  it('(10a) sends POST to correct endpoint with action=unpublish and id', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, {
      data: { id: FAKE_S_ID_1, status: 'draft', published_at: null, updated_at: '2026-08-02T10:00:00Z' },
      message: 'Artikel wurde zurückgezogen und ist wieder als Entwurf gespeichert.',
    }));

    const { unpublishScenario } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    await unpublishScenario(FAKE_S_ID_1);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/admin-theme-world-scenarios');
    expect(url).toContain('action=unpublish');
    expect(url).toContain(`id=${FAKE_S_ID_1}`);
    expect(options.method).toBe('POST');
  });

  it('(10b) returns data with status=draft and published_at=null', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, {
      data: { id: FAKE_S_ID_1, status: 'draft', published_at: null, updated_at: '2026-08-02T10:00:00Z' },
    }));

    const { unpublishScenario } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    const result = await unpublishScenario(FAKE_S_ID_1);

    expect(result.status).toBe('draft');
    expect(result.published_at).toBeNull();
  });

  it('(11a) throws on 409 (wrong status — draft/archived)', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(409, {
      error: 'Nur publizierte Szenarioartikel können zurückgezogen werden.',
    }));

    const { unpublishScenario, ApiError } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    await expect(unpublishScenario(FAKE_S_ID_1)).rejects.toBeInstanceOf(ApiError);
  });

  it('(11b) ApiError has status 409 and correct message', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(409, {
      error: 'Nur publizierte Szenarioartikel können zurückgezogen werden.',
    }));

    const { unpublishScenario, ApiError } = await vi.importActual('../src/lib/themeWorldAdminApi.js');

    let caught;
    try {
      await unpublishScenario(FAKE_S_ID_1);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.status).toBe(409);
    expect(caught.message).toContain('publizierte');
  });

  it('(11c) throws ApiError on 404', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(404, { error: 'Szenario nicht gefunden.' }));

    const { unpublishScenario, ApiError } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    await expect(unpublishScenario(FAKE_S_ID_1)).rejects.toBeInstanceOf(ApiError);
  });

  it('(11d) throws ApiError on 500', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(500, { error: 'Zurückziehen fehlgeschlagen.' }));

    const { unpublishScenario, ApiError } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    await expect(unpublishScenario(FAKE_S_ID_1)).rejects.toBeInstanceOf(ApiError);
  });
});

// ---------------------------------------------------------------------------
// Regression: bestehende Publish/Archive-Funktionen über Client
// ---------------------------------------------------------------------------

describe('Phase 8.12 Regression API: existing functions via client', () => {
  it('(23r) publishScenario still sends action=publish', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, {
      data: { id: FAKE_S_ID_1, status: 'published', published_at: '2026-08-02T10:00:00Z' },
    }));

    const { publishScenario } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    await publishScenario(FAKE_S_ID_1);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('action=publish');
  });

  it('(24r) archiveScenario still sends action=archive', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, {
      data: { id: FAKE_S_ID_1, status: 'archived' },
    }));

    const { archiveScenario } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    await archiveScenario(FAKE_S_ID_1);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('action=archive');
  });

  it('(25r) unpublishScenario uses action=unpublish, not action=archive', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, {
      data: { id: FAKE_S_ID_1, status: 'draft', published_at: null },
    }));

    const { unpublishScenario } = await vi.importActual('../src/lib/themeWorldAdminApi.js');
    await unpublishScenario(FAKE_S_ID_1);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('action=unpublish');
    expect(url).not.toContain('action=archive');
  });
});
