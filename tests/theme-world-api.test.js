/**
 * Unit-Tests für Theme-World-Admin-API-Endpunkte.
 *
 * Supabase wird vollständig gemockt — kein echter DB-Zugriff.
 * Tests verifizieren:
 *   - Auth-Prüfung (fehlendes Token, ungültiges Token, normaler Nutzer, Admin)
 *   - Korrekte Datenbankoperationen bei gültigen Requests
 *   - Validierungsfehler werden korrekt zurückgegeben
 *   - Konflikte (409) bei doppeltem Pfad
 *   - Publish-Gate bei fehlenden Pflichtfeldern
 *   - Archivierung statt Löschung
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock-Infrastruktur
// ============================================================

function makeMockRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

function makeMockReq({ method = 'GET', query = {}, headers = {}, body = null } = {}) {
  return { method, query, headers, body };
}

// Mock für Supabase createClient
const mockSelectResult = { data: [], error: null };
const mockSingleResult = { data: null, error: null };
const mockInsertResult = { data: { id: 'new-id', status: 'draft' }, error: null };
const mockUpdateResult = { data: { id: 'test-id', status: 'draft' }, error: null };

let mockSupabase;

function createMockSupabase(overrides = {}) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockSingleResult),
    ...overrides,
  };
  return builder;
}

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Hilfsfunktion: Standard-Admin-Mock
function setupAdminAuth(supabaseOverrides = {}) {
  const adminUserId = '00000000-0000-4000-8000-000000000001';
  mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: adminUserId } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (table === 'profiles') {
            return Promise.resolve({ data: { role: 'admin' }, error: null });
          }
          return Promise.resolve(mockSingleResult);
        }),
        ...supabaseOverrides[table],
      };
      return chain;
    }),
  };
  return adminUserId;
}

function makeAdminReq(opts = {}) {
  return makeMockReq({
    ...opts,
    headers: {
      authorization: 'Bearer valid-admin-token',
      ...(opts.headers || {}),
    },
  });
}

// ============================================================
// Tests: requireAdmin (Auth-Helper)
// ============================================================

describe('requireAdmin Auth-Prüfung', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('lehnt Request ohne Authorization-Header ab (401)', async () => {
    const { requireAdmin } = await import('../api/_lib/theme-world-auth.js');

    mockSupabase = createMockSupabase();
    const req = makeMockReq({ headers: {} });
    const res = makeMockRes();

    const result = await requireAdmin(req, res);

    expect(result).toBeNull();
    expect(res._status).toBe(401);
  });

  it('lehnt Request mit ungültigem Token ab (401)', async () => {
    const { requireAdmin } = await import('../api/_lib/theme-world-auth.js');

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Invalid token') }),
      },
      from: vi.fn().mockReturnThis(),
    };

    const req = makeMockReq({ headers: { authorization: 'Bearer invalid-token' } });
    const res = makeMockRes();

    const result = await requireAdmin(req, res);

    expect(result).toBeNull();
    expect(res._status).toBe(401);
  });

  it('lehnt normalen Nutzer (role=teacher) ab (403)', async () => {
    const { requireAdmin } = await import('../api/_lib/theme-world-auth.js');

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-id' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null }),
      }),
    };

    const req = makeMockReq({ headers: { authorization: 'Bearer token' } });
    const res = makeMockRes();

    const result = await requireAdmin(req, res);

    expect(result).toBeNull();
    expect(res._status).toBe(403);
  });

  it('akzeptiert Admin-Nutzer (role=admin)', async () => {
    const { requireAdmin } = await import('../api/_lib/theme-world-auth.js');

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-id' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
      }),
    };

    const req = makeMockReq({ headers: { authorization: 'Bearer admin-token' } });
    const res = makeMockRes();

    const result = await requireAdmin(req, res);

    expect(result).not.toBeNull();
    expect(result.supabaseAdmin).toBeDefined();
    expect(result.userId).toBe('admin-id');
  });
});

// ============================================================
// Tests: Admin Theme Worlds API — Validierung
// ============================================================

describe('admin-theme-worlds API Validierung', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('create: lehnt ungültigen Slug ab (400)', async () => {
    const handler = (await import('../api/admin-theme-worlds.js')).default;

    const fromResults = {};
    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => {
        const base = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(
            table === 'profiles' ? { data: { role: 'admin' }, error: null } : { data: null, error: null }
          ),
        };
        return base;
      }),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'create' },
      body: {
        key: 'test',
        url_segment: 'beruflich',
        slug: 'Ungültiger Slug!',  // Ungültig
        db_segment: 'professionell',
        area_slug: 'test',
        title_de: 'Test',
      },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('slug')])
    );
  });

  it('create: lehnt inkonsistentes Segment-Paar ab (400)', async () => {
    const handler = (await import('../api/admin-theme-worlds.js')).default;

    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          table === 'profiles' ? { data: { role: 'admin' }, error: null } : { data: null, error: null }
        ),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
      })),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'create' },
      body: {
        key: 'test',
        url_segment: 'beruflich',
        slug: 'test-slug',
        db_segment: 'kinder',  // Inkonsistent mit beruflich
        area_slug: 'test',
        title_de: 'Test',
      },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('Inkonsistentes')])
    );
  });
});

// ============================================================
// Tests: Publish-Gate bei fehlenden Pflichtfeldern
// ============================================================

describe('admin-theme-worlds publish-gate', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('publish: lehnt Themenwelt ohne subtitle_de und intro_de ab (422)', async () => {
    const handler = (await import('../api/admin-theme-worlds.js')).default;

    const TW_UUID_1 = 'a1b2c3d4-e5f6-4abc-89cd-ef1234567890';

    const incompleteThemeWorld = {
      id: TW_UUID_1,
      title_de: 'Titel',
      url_segment: 'beruflich',
      slug: 'test-slug',
      db_segment: 'professionell',
      area_slug: 'test',
      subtitle_de: null,  // Fehlt
      intro_de: null,     // Fehlt
      search_config: { area_slug: 'test' },
      status: 'draft',
      published_at: null,
    };

    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          table === 'profiles'
            ? { data: { role: 'admin' }, error: null }
            : { data: incompleteThemeWorld, error: null }
        ),
      })),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'publish', id: TW_UUID_1 },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(422);
    expect(res._body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('subtitle_de')])
    );
  });

  it('publish: lehnt fehlende search_config ab (422)', async () => {
    const handler = (await import('../api/admin-theme-worlds.js')).default;

    const TW_UUID_2 = 'b2c3d4e5-f6a7-4bcd-9cde-f12345678901';

    const themeWorldNoSearch = {
      id: TW_UUID_2,
      title_de: 'Titel',
      url_segment: 'beruflich',
      slug: 'test-slug',
      db_segment: 'professionell',
      area_slug: 'test',
      subtitle_de: 'Untertitel vorhanden.',
      search_config: null,  // Fehlt
      status: 'draft',
      published_at: null,
    };

    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          table === 'profiles'
            ? { data: { role: 'admin' }, error: null }
            : { data: themeWorldNoSearch, error: null }
        ),
      })),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'publish', id: TW_UUID_2 },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(422);
    expect(res._body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('area_slug')])
    );
  });
});

// ============================================================
// Tests: Doppelter Pfad → Konflikt (409)
// ============================================================

describe('admin-theme-worlds Konflikt bei doppeltem Pfad', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('create: gibt 409 bei Unique-Constraint-Verletzung zurück', async () => {
    const handler = (await import('../api/admin-theme-worlds.js')).default;

    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(
            table === 'profiles'
              ? { data: { role: 'admin' }, error: null }
              : { data: null, error: { code: '23505', message: 'duplicate key' } }
          ),
        };
        return chain;
      }),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'create' },
      body: {
        key: 'sport_fitness_beruf',
        url_segment: 'beruflich',
        slug: 'sport-fitness-berufsausbildung',
        db_segment: 'professionell',
        area_slug: 'sport_fitness_beruf',
        title_de: 'Sport & Fitness',
        subtitle_de: 'Beruflich.',
        search_config: { area_slug: 'sport_fitness_beruf' },
      },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(409);
    expect(res._body.error).toContain('existiert bereits');
  });
});

// ============================================================
// Tests: Szenario ohne existierende Themenwelt (404)
// ============================================================

describe('admin-theme-world-scenarios nicht-existierende Themenwelt', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('create: gibt 404 wenn themeWorldId nicht existiert', async () => {
    const handler = (await import('../api/admin-theme-world-scenarios.js')).default;

    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          table === 'profiles'
            ? { data: { role: 'admin' }, error: null }
            : { data: null, error: { message: 'Not found' } }  // TW nicht gefunden
        ),
      })),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'create', themeWorldId: '00000000-0000-4000-8000-000000000099' },
      body: {
        slug: 'test-szenario',
        label_de: 'Test Szenario',
        teaser_de: 'Teaser.',
      },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._body.error).toContain('nicht gefunden');
  });
});

// ============================================================
// Tests: FAQ-Liste ersetzen (Sub-Items)
// ============================================================

describe('admin-theme-world-sub FAQ-Listenersatz', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('replace-faqs: lehnt FAQ ohne question_de ab (400)', async () => {
    const handler = (await import('../api/admin-theme-world-sub.js')).default;

    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          table === 'profiles'
            ? { data: { role: 'admin' }, error: null }
            : { data: { id: 'tw-id' }, error: null }  // TW existiert
        ),
      })),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'replace-faqs', themeWorldId: '00000000-0000-4000-8000-000000000001' },
      body: {
        items: [
          { answer_de: 'Antwort ohne Frage' }, // question_de fehlt
        ],
      },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('question_de')])
    );
  });
});

// ============================================================
// Tests: Archivierung statt Löschung
// ============================================================

describe('admin-theme-worlds Archivierung', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('archive: setzt Status auf archived', async () => {
    const handler = (await import('../api/admin-theme-worlds.js')).default;

    let updatedPayload;
    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockImplementation((table) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockImplementation((payload) => {
            updatedPayload = payload;
            return chain;
          }),
          single: vi.fn().mockResolvedValue(
            table === 'profiles'
              ? { data: { role: 'admin' }, error: null }
              : { data: { id: 'tw-id', status: 'archived' }, error: null }
          ),
        };
        return chain;
      }),
    };

    const req = makeAdminReq({
      method: 'POST',
      query: { action: 'archive', id: '00000000-0000-4000-8000-000000000001' },
    });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(updatedPayload?.status).toBe('archived');
    // Kein DELETE-Aufruf — nur Status-Update
  });
});

// ============================================================
// Tests: Unbekannte Action
// ============================================================

describe('admin-theme-worlds unbekannte Action', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('gibt 400 bei unbekannter Action', async () => {
    const handler = (await import('../api/admin-theme-worlds.js')).default;

    mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
      }),
    };

    const req = makeAdminReq({ method: 'GET', query: { action: 'delete-everything' } });
    const res = makeMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body.error).toContain('Unbekannte Action');
  });
});
