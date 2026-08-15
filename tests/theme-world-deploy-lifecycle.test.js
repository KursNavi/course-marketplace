/**
 * Deploy-Lifecycle der Themenwelten-Admin-API.
 *
 * Produktinvariante:
 *   Jede Änderung der öffentlichen Existenz einer Themenwelt (publish,
 *   unpublish, archive einer publizierten Themenwelt) muss denselben
 *   Vercel-Deploy-Hook anfordern, weil /thema/-Prerendering,
 *   /thema/ → /bereich/-Redirects und die statische HTML-Ausgabe erst beim
 *   Build synchronisiert werden.
 *
 * Abgedeckt:
 *   1. publish   + Deploy aktiv    → Hook genau einmal, deploy_status=requested
 *   2. unpublish + Deploy aktiv    → Hook genau einmal, deploy_status=requested
 *   3. unpublish + Deploy inaktiv  → kein Hook
 *   4. unpublish + Hook-Fehler     → Status bleibt draft, deploy_status=failed
 *   5. archive einer publizierten Themenwelt → Hook genau einmal
 *   6. archive eines Entwurfs      → kein Hook
 *   7. Hook-URL erscheint nie in Antwort oder Logs
 *   8. Deploy aktiv ohne Hook-URL  → nur DB-konforme deploy_status-Werte
 *
 * Supabase und fetch sind vollständig gemockt — kein DB-Zugriff, kein echter
 * Deploy-Request.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Env — muss vor dem ersten Import von theme-world-auth.js gesetzt sein
// ---------------------------------------------------------------------------
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/prj_test/secrettoken123';

const TW_ID = 'a1b2c3d4-e5f6-4abc-89cd-ef1234567890';

// ---------------------------------------------------------------------------
// Supabase-Mock
// ---------------------------------------------------------------------------

let mockSupabase;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

/**
 * Baut einen Supabase-Mock, der die .single()-Ergebnisse der Tabelle
 * theme_worlds der Reihe nach aus einer Queue liefert und alle
 * Update-Payloads mitschreibt.
 */
function setupSupabase(themeWorldSingleResults) {
  const queue = [...themeWorldSingleResults];
  const updates = [];

  mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }),
    },
    from: vi.fn((table) => {
      const chain = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        order: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        update: vi.fn((payload) => {
          if (table === 'theme_worlds') updates.push(payload);
          return chain;
        }),
        single: vi.fn(async () => {
          if (table === 'profiles') return { data: { role: 'admin' }, error: null };
          return queue.shift() ?? { data: null, error: null };
        }),
      };
      return chain;
    }),
  };

  return { updates };
}

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

function makeReq(action) {
  return {
    method: 'POST',
    query: { action, id: TW_ID },
    headers: { authorization: 'Bearer valid-admin-token' },
    body: null,
  };
}

async function invoke(action) {
  const handler = (await import('../api/admin-theme-worlds.js')).default;
  const res = makeRes();
  await handler(makeReq(action), res);
  return res;
}

// Vollständige Themenwelt, die das Publish-Gate passiert
const PUBLISHABLE_TW = {
  id: TW_ID,
  key: 'test_welt',
  title_de: 'Testwelt',
  slug: 'test-welt',
  url_segment: 'beruflich',
  db_segment: 'professionell',
  area_slug: 'test_welt',
  subtitle_de: 'Untertitel vorhanden.',
  search_config: { area_slug: 'test_welt' },
  status: 'draft',
  published_at: null,
};

const UNPUBLISH_ROW = {
  id: TW_ID,
  status: 'draft',
  published_at: null,
  deploy_status: 'not_requested',
  updated_at: '2026-08-15T10:00:00Z',
};

// ---------------------------------------------------------------------------
// Fetch- und Konsolen-Spies
// ---------------------------------------------------------------------------

let fetchSpy;
let warnSpy;
let errorSpy;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.THEME_WORLD_DEPLOY_ENABLED;
  delete process.env.VERCEL_DEPLOY_HOOK_URL;
  fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.THEME_WORLD_DEPLOY_ENABLED;
  delete process.env.VERCEL_DEPLOY_HOOK_URL;
});

function enableDeploy() {
  process.env.THEME_WORLD_DEPLOY_ENABLED = 'true';
  process.env.VERCEL_DEPLOY_HOOK_URL = HOOK_URL;
}

/** Alle Update-Payloads, die deploy_status setzen. */
function deployUpdates(updates) {
  return updates.filter((p) => 'deploy_status' in p);
}

// ===========================================================================
// 1. publish + Deploy aktiv
// ===========================================================================

describe('publish mit aktivem Deploy-Hook', () => {
  it('löst den Hook genau einmal aus und speichert deploy_status=requested', async () => {
    enableDeploy();
    const { updates } = setupSupabase([
      { data: PUBLISHABLE_TW, error: null },                                  // Laden
      { data: { id: TW_ID, status: 'published', published_at: '2026-08-15T10:00:00Z', deploy_status: 'not_requested' }, error: null },
    ]);

    const res = await invoke('publish');

    expect(res._status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1].method).toBe('POST');

    expect(res._body.deploy).toEqual({ status: 'requested' });
    expect(res._body.data.status).toBe('published');
    expect(res._body.data.deploy_status).toBe('requested');

    const [deployPayload] = deployUpdates(updates);
    expect(deployPayload.deploy_status).toBe('requested');
    expect(deployPayload.deploy_requested_at).toEqual(expect.any(String));
  });
});

// ===========================================================================
// 2. + 3. unpublish
// ===========================================================================

describe('unpublish mit aktivem Deploy-Hook', () => {
  it('löst den Hook genau einmal aus und speichert deploy_status=requested', async () => {
    enableDeploy();
    const { updates } = setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    const res = await invoke('unpublish');

    expect(res._status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    expect(res._body.deploy).toEqual({ status: 'requested' });
    expect(res._body.data.status).toBe('draft');
    expect(res._body.data.published_at).toBeNull();
    expect(res._body.data.deploy_status).toBe('requested');

    // Statuswechsel setzt kein kurzlebiges not_requested, das den Hook-Status
    // überschreiben oder verlieren würde.
    expect(updates[0]).toEqual({ status: 'draft', published_at: null });
    const deployPayloads = deployUpdates(updates);
    expect(deployPayloads).toHaveLength(1);
    expect(deployPayloads[0].deploy_status).toBe('requested');
    expect(deployPayloads[0].deploy_requested_at).toEqual(expect.any(String));
  });
});

describe('unpublish ohne aktivierten Deploy-Hook', () => {
  it('löst keinen Hook aus und setzt deploy_status auf not_requested', async () => {
    const { updates } = setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    const res = await invoke('unpublish');

    expect(res._status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res._body.deploy).toEqual({ status: 'not_configured' });
    expect(res._body.data.status).toBe('draft');
    expect(updates).toEqual([
      { status: 'draft', published_at: null, deploy_status: 'not_requested' },
    ]);
  });

  it('löst auch bei THEME_WORLD_DEPLOY_ENABLED=false keinen Hook aus', async () => {
    process.env.THEME_WORLD_DEPLOY_ENABLED = 'false';
    process.env.VERCEL_DEPLOY_HOOK_URL = HOOK_URL;
    setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    await invoke('unpublish');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 4. unpublish + Hook-Fehler
// ===========================================================================

describe('unpublish bei fehlgeschlagenem Deploy-Hook', () => {
  it('behält den fachlichen Status draft und speichert deploy_status=failed', async () => {
    enableDeploy();
    fetchSpy.mockResolvedValue({ ok: false, status: 503 });
    const { updates } = setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    const res = await invoke('unpublish');

    // Fachliche Statusänderung wird NICHT zurückgerollt
    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
    expect(res._body.data.published_at).toBeNull();
    expect(res._body.deploy.status).toBe('failed');
    expect(res._body.data.deploy_status).toBe('failed');

    const deployPayloads = deployUpdates(updates);
    expect(deployPayloads).toHaveLength(1);
    expect(deployPayloads[0]).toEqual({ deploy_status: 'failed' });
    expect(deployPayloads[0].deploy_requested_at).toBeUndefined();

    // Kein zweiter Statuswechsel zurück auf published
    expect(updates.some((p) => p.status === 'published')).toBe(false);
  });

  it('behält den Status draft auch bei Netzwerkfehler', async () => {
    enableDeploy();
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const { updates } = setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    const res = await invoke('unpublish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
    expect(res._body.deploy.status).toBe('failed');
    expect(deployUpdates(updates)[0]).toEqual({ deploy_status: 'failed' });
  });
});

// ===========================================================================
// 5. + 6. archive
// ===========================================================================

describe('archive einer publizierten Themenwelt', () => {
  it('löst den Hook genau einmal aus und speichert deploy_status=requested', async () => {
    enableDeploy();
    const { updates } = setupSupabase([
      { data: { id: TW_ID, status: 'published' }, error: null },                       // Vorstatus
      { data: { id: TW_ID, status: 'archived', updated_at: '2026-08-15T10:00:00Z' }, error: null },
    ]);

    const res = await invoke('archive');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('archived');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res._body.deploy).toEqual({ status: 'requested' });
    expect(res._body.data.deploy_status).toBe('requested');

    expect(updates[0]).toEqual({ status: 'archived' });
    expect(deployUpdates(updates)).toHaveLength(1);
  });
});

describe('archive einer nicht öffentlichen Themenwelt', () => {
  it('löst bei einem Entwurf keinen Deploy aus', async () => {
    enableDeploy();
    const { updates } = setupSupabase([
      { data: { id: TW_ID, status: 'draft' }, error: null },
      { data: { id: TW_ID, status: 'archived', updated_at: '2026-08-15T10:00:00Z' }, error: null },
    ]);

    const res = await invoke('archive');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('archived');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(deployUpdates(updates)).toHaveLength(0);
  });

  it('löst bei einer bereits archivierten Themenwelt keinen Deploy aus', async () => {
    enableDeploy();
    setupSupabase([
      { data: { id: TW_ID, status: 'archived' }, error: null },
      { data: { id: TW_ID, status: 'archived', updated_at: '2026-08-15T10:00:00Z' }, error: null },
    ]);

    await invoke('archive');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gibt 404 zurück, wenn die Themenwelt nicht existiert, und löst keinen Deploy aus', async () => {
    enableDeploy();
    setupSupabase([{ data: null, error: { message: 'Not found' } }]);

    const res = await invoke('archive');

    expect(res._status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 7. Sicherheit: Hook-URL nie in Antwort oder Logs
// ===========================================================================

describe('Deploy-Hook-Sicherheit', () => {
  const SECRET_FRAGMENT = 'secrettoken123';

  function assertNoSecretLeak(res) {
    const body = JSON.stringify(res._body);
    expect(body).not.toContain(HOOK_URL);
    expect(body).not.toContain(SECRET_FRAGMENT);

    const logged = [...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .map((args) => args.map((a) => String(a)).join(' '))
      .join('\n');
    expect(logged).not.toContain(HOOK_URL);
    expect(logged).not.toContain(SECRET_FRAGMENT);
  }

  it('gibt die Hook-URL bei erfolgreichem unpublish weder aus noch loggt sie', async () => {
    enableDeploy();
    setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    assertNoSecretLeak(await invoke('unpublish'));
  });

  it('gibt die Hook-URL bei fehlgeschlagenem Hook weder aus noch loggt sie', async () => {
    enableDeploy();
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });
    setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    assertNoSecretLeak(await invoke('unpublish'));
  });

  it('gibt die Hook-URL beim archive einer publizierten Themenwelt nicht preis', async () => {
    enableDeploy();
    fetchSpy.mockRejectedValue(new Error(`connect failed for ${HOOK_URL}`));
    setupSupabase([
      { data: { id: TW_ID, status: 'published' }, error: null },
      { data: { id: TW_ID, status: 'archived' }, error: null },
    ]);

    assertNoSecretLeak(await invoke('archive'));
  });
});

// ===========================================================================
// 8. Deploy aktiviert, aber Hook-URL fehlt
// ===========================================================================

describe('Deploy aktiviert ohne konfigurierte Hook-URL', () => {
  it('schreibt nur DB-konforme deploy_status-Werte und meldet not_configured', async () => {
    process.env.THEME_WORLD_DEPLOY_ENABLED = 'true';
    // VERCEL_DEPLOY_HOOK_URL bewusst nicht gesetzt
    const { updates } = setupSupabase([{ data: { ...UNPUBLISH_ROW }, error: null }]);

    const res = await invoke('unpublish');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res._body.deploy).toEqual({ status: 'not_configured' });

    // 'not_configured' verletzt den CHECK-Constraint der Spalte deploy_status
    const allowed = ['not_requested', 'requested', 'failed'];
    for (const payload of deployUpdates(updates)) {
      expect(allowed).toContain(payload.deploy_status);
    }
    expect(deployUpdates(updates)[0].deploy_status).toBe('not_requested');
  });
});
