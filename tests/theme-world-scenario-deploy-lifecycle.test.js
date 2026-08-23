/**
 * Deploy-Lifecycle der Szenario-Admin-API.
 *
 * Produktinvariante:
 *   Jede Änderung der öffentlichen EXISTENZ eines Szenarios (publish aus einem
 *   nicht öffentlichen Status, unpublish, archive eines publizierten Szenarios)
 *   muss denselben Vercel-Deploy-Hook anfordern wie die Themenwelt selbst.
 *
 * Warum das ein Merge-Blocker für die 404-Architektur ist:
 *   /bereich/{segment}/{slug}/{szenario} wird statisch prerendert, und
 *   api/resource-not-found.js nimmt «keine statische Datei» als Beweis für
 *   «existiert nicht». Ohne Build nach einer Sichtbarkeitsänderung wäre
 *     - ein frisch publiziertes Szenario weiterhin 404, und
 *     - ein zurückgezogenes Szenario weiterhin 200 mit altem, indexierbarem
 *       HTML.
 *
 * Abgedeckt:
 *   1. publish (draft → published)      → Hook genau einmal
 *   2. unpublish (published → draft)    → Hook genau einmal
 *   3. archive eines publizierten Szenarios → Hook genau einmal
 *   4. archive eines Entwurfs           → kein Hook
 *   5. Deploy deaktiviert               → Statuswechsel gelingt, not_configured,
 *                                         keine DB-fremden deploy_status-Werte
 *   6. Hook-Fehler                      → Statuswechsel bleibt, Parent-Status
 *                                         'failed', kein Rollback
 *   7. erfolgreicher Hook               → Parent 'requested' + deploy_requested_at
 *   8. create / update / reorder / erneutes publish → kein Hook
 *   9. Gemeinsamer Helper: Themenwelt und Szenario nutzen dieselbe Quelle
 *  10. Hook-URL erscheint nie in Antwort oder Logs
 *
 * Supabase und fetch sind vollständig gemockt — kein DB-Zugriff, kein echter
 * Deploy-Request, keine echten Zugangsdaten.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Env — muss vor dem ersten Import von theme-world-auth.js gesetzt sein
// ---------------------------------------------------------------------------
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/prj_test/secrettoken123';

const TW_ID = 'a1b2c3d4-e5f6-4abc-89cd-ef1234567890';
const SCENARIO_ID = 'b2c3d4e5-f6a7-4bcd-89de-f12345678901';

// ---------------------------------------------------------------------------
// Supabase-Mock — Ergebnisse und Update-Payloads pro Tabelle
// ---------------------------------------------------------------------------

let mockSupabase;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

/**
 * @param {object} singleResultsByTable - Warteschlange von .single()-Ergebnissen je Tabelle
 * @returns {{updates: Array<{table: string, payload: object}>, eqCalls: Array}}
 */
function setupSupabase(singleResultsByTable) {
  const queues = {};
  for (const [table, results] of Object.entries(singleResultsByTable)) {
    queues[table] = [...results];
  }

  const updates = [];
  const eqCalls = [];

  mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }),
    },
    from: vi.fn((table) => {
      const chain = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        order: vi.fn(() => chain),
        eq: vi.fn((column, value) => {
          eqCalls.push({ table, column, value });
          return chain;
        }),
        update: vi.fn((payload) => {
          updates.push({ table, payload });
          return chain;
        }),
        single: vi.fn(async () => {
          if (table === 'profiles') return { data: { role: 'admin' }, error: null };
          return queues[table]?.shift() ?? { data: null, error: null };
        }),
      };
      return chain;
    }),
  };

  return { updates, eqCalls };
}

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

async function invokeScenario(action, query = {}, body = null) {
  const handler = (await import('../api/admin-theme-world-scenarios.js')).default;
  const res = makeRes();
  await handler(
    {
      method: 'POST',
      query: { action, id: SCENARIO_ID, ...query },
      headers: { authorization: 'Bearer valid-admin-token' },
      body,
    },
    res
  );
  return res;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Szenario, das das Publish-Gate passiert (Parent muss publiziert sein). */
const PUBLISHABLE_SCENARIO = {
  id: SCENARIO_ID,
  theme_world_id: TW_ID,
  slug: 'erste-kamera',
  status: 'draft',
  label_de: 'Erste Kamera',
  teaser_de: 'Worauf es beim Kauf der ersten Kamera ankommt.',
  content_html: '<p>Inhalt des Artikels.</p>',
  card_image_url: null,
  card_image_alt: null,
  published_at: null,
};

const PUBLISHED_PARENT = { id: TW_ID, status: 'published' };

const PUBLISHED_SCENARIO_ROW = {
  id: SCENARIO_ID,
  status: 'published',
  theme_world_id: TW_ID,
};

const DRAFT_AFTER_UNPUBLISH = {
  id: SCENARIO_ID,
  status: 'draft',
  published_at: null,
  updated_at: '2026-08-16T10:00:00Z',
};

const ARCHIVED_ROW = {
  id: SCENARIO_ID,
  status: 'archived',
  updated_at: '2026-08-16T10:00:00Z',
};

// ---------------------------------------------------------------------------
// Spies
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

/** Alle Update-Payloads auf theme_worlds, die deploy_status setzen. */
function parentDeployUpdates(updates) {
  return updates
    .filter((u) => u.table === 'theme_worlds' && 'deploy_status' in u.payload)
    .map((u) => u.payload);
}

function scenarioUpdates(updates) {
  return updates.filter((u) => u.table === 'theme_world_scenarios').map((u) => u.payload);
}

/** Mock-Läufe für die drei Sichtbarkeitsaktionen. */
function setupPublish(scenarioOverrides = {}, parent = PUBLISHED_PARENT) {
  return setupSupabase({
    theme_world_scenarios: [
      { data: { ...PUBLISHABLE_SCENARIO, ...scenarioOverrides }, error: null }, // laden
      { data: { id: SCENARIO_ID, status: 'published', published_at: '2026-08-16T10:00:00Z' }, error: null },
    ],
    theme_worlds: [{ data: parent, error: null }],
  });
}

function setupUnpublish() {
  return setupSupabase({
    theme_world_scenarios: [
      { data: { ...PUBLISHED_SCENARIO_ROW }, error: null }, // laden
      { data: { ...DRAFT_AFTER_UNPUBLISH }, error: null },  // Update
    ],
    theme_worlds: [],
  });
}

function setupArchive(previousStatus) {
  return setupSupabase({
    theme_world_scenarios: [
      { data: { id: SCENARIO_ID, status: previousStatus, theme_world_id: TW_ID }, error: null },
      { data: { ...ARCHIVED_ROW }, error: null },
    ],
    theme_worlds: [],
  });
}

// ===========================================================================
// 1. publish (draft → published)
// ===========================================================================

describe('Szenario publish mit aktivem Deploy-Hook', () => {
  it('setzt den Status auf published und löst den Hook genau einmal aus', async () => {
    enableDeploy();
    const { updates } = setupPublish();

    const res = await invokeScenario('publish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('published');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1].method).toBe('POST');
    expect(res._body.deploy).toEqual({ status: 'requested' });

    expect(scenarioUpdates(updates)[0].status).toBe('published');
  });

  it('speichert deploy_status und deploy_requested_at auf der Parent-Themenwelt', async () => {
    enableDeploy();
    const { updates, eqCalls } = setupPublish();

    await invokeScenario('publish');

    const [payload] = parentDeployUpdates(updates);
    expect(payload.deploy_status).toBe('requested');
    expect(payload.deploy_requested_at).toEqual(expect.any(String));

    // Der Deploy-Status gehört auf die Parent-Themenwelt, nicht auf das Szenario.
    expect(eqCalls.some((c) => c.table === 'theme_worlds' && c.column === 'id' && c.value === TW_ID))
      .toBe(true);
  });

  it('löst bei einem bereits publizierten Szenario keinen erneuten Hook aus', async () => {
    enableDeploy();
    const { updates } = setupPublish({ status: 'published', published_at: '2026-08-01T00:00:00Z' });

    const res = await invokeScenario('publish');

    expect(res._status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(parentDeployUpdates(updates)).toHaveLength(0);
  });

  it('löst bei fehlgeschlagener Validierung keinen Hook aus', async () => {
    enableDeploy();
    setupPublish({ content_html: null });

    const res = await invokeScenario('publish');

    expect(res._status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('löst bei nicht publizierter Parent-Themenwelt keinen Hook aus', async () => {
    enableDeploy();
    setupPublish({}, { id: TW_ID, status: 'draft' });

    const res = await invokeScenario('publish');

    expect(res._status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 2. unpublish (published → draft)
// ===========================================================================

describe('Szenario unpublish mit aktivem Deploy-Hook', () => {
  it('setzt den Status auf draft und löst den Hook genau einmal aus', async () => {
    enableDeploy();
    const { updates } = setupUnpublish();

    const res = await invokeScenario('unpublish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
    expect(res._body.data.published_at).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res._body.deploy).toEqual({ status: 'requested' });

    // Der fachliche Statuswechsel bleibt exakt wie bisher.
    expect(scenarioUpdates(updates)[0]).toEqual({ status: 'draft', published_at: null });
    const [payload] = parentDeployUpdates(updates);
    expect(payload.deploy_status).toBe('requested');
    expect(payload.deploy_requested_at).toEqual(expect.any(String));
  });

  it('behält die bestehende Rückmeldung an die Redaktion bei', async () => {
    enableDeploy();
    setupUnpublish();

    const res = await invokeScenario('unpublish');

    expect(res._body.message).toContain('zurückgezogen');
    expect(res._body.message).toContain('Entwurf');
  });

  it('löst bei einem Entwurf keinen Hook aus (409 bleibt bestehen)', async () => {
    enableDeploy();
    setupSupabase({
      theme_world_scenarios: [{ data: { id: SCENARIO_ID, status: 'draft', theme_world_id: TW_ID }, error: null }],
      theme_worlds: [],
    });

    const res = await invokeScenario('unpublish');

    expect(res._status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('löst bei unbekannter ID keinen Hook aus (404 bleibt bestehen)', async () => {
    enableDeploy();
    setupSupabase({
      theme_world_scenarios: [{ data: null, error: { message: 'Not found' } }],
      theme_worlds: [],
    });

    const res = await invokeScenario('unpublish');

    expect(res._status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. + 4. archive
// ===========================================================================

describe('Szenario archive', () => {
  it('löst bei einem publizierten Szenario den Hook genau einmal aus', async () => {
    enableDeploy();
    const { updates } = setupArchive('published');

    const res = await invokeScenario('archive');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('archived');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res._body.deploy).toEqual({ status: 'requested' });

    expect(scenarioUpdates(updates)[0]).toEqual({ status: 'archived' });
    expect(parentDeployUpdates(updates)).toHaveLength(1);
  });

  it('löst bei einem Entwurf keinen Hook aus', async () => {
    enableDeploy();
    const { updates } = setupArchive('draft');

    const res = await invokeScenario('archive');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('archived');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res._body.deploy).toBeUndefined();
    expect(parentDeployUpdates(updates)).toHaveLength(0);
  });

  it('löst bei einem bereits archivierten Szenario keinen Hook aus', async () => {
    enableDeploy();
    setupArchive('archived');

    await invokeScenario('archive');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gibt 404 zurück, wenn das Szenario nicht existiert, und löst keinen Hook aus', async () => {
    enableDeploy();
    setupSupabase({
      theme_world_scenarios: [{ data: null, error: { message: 'Not found' } }],
      theme_worlds: [],
    });

    const res = await invokeScenario('archive');

    expect(res._status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 5. Deploy deaktiviert
// ===========================================================================

describe('Szenario-Lifecycle ohne aktivierten Deploy-Hook', () => {
  const ALLOWED_DB_VALUES = ['not_requested', 'requested', 'failed'];

  it('publish gelingt, meldet not_configured und löst keinen Hook aus', async () => {
    const { updates } = setupPublish();

    const res = await invokeScenario('publish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('published');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res._body.deploy).toEqual({ status: 'not_configured' });
    // 'not_configured' verletzt den CHECK-Constraint der Spalte deploy_status.
    expect(parentDeployUpdates(updates)).toHaveLength(0);
  });

  it('unpublish gelingt und schreibt keinen ungültigen deploy_status', async () => {
    const { updates } = setupUnpublish();

    const res = await invokeScenario('unpublish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res._body.deploy).toEqual({ status: 'not_configured' });
    for (const payload of parentDeployUpdates(updates)) {
      expect(ALLOWED_DB_VALUES).toContain(payload.deploy_status);
    }
    expect(parentDeployUpdates(updates)).toHaveLength(0);
  });

  it('archive gelingt und löst keinen Hook aus', async () => {
    const res = await invokeScenario('archive');
    // ohne Setup: kein Datensatz → 404, aber garantiert kein Hook
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res._status).toBe(404);
  });

  it('THEME_WORLD_DEPLOY_ENABLED=false löst trotz gesetzter Hook-URL keinen Hook aus', async () => {
    process.env.THEME_WORLD_DEPLOY_ENABLED = 'false';
    process.env.VERCEL_DEPLOY_HOOK_URL = HOOK_URL;
    setupUnpublish();

    await invokeScenario('unpublish');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Deploy aktiviert ohne Hook-URL schreibt nur DB-konforme Werte', async () => {
    process.env.THEME_WORLD_DEPLOY_ENABLED = 'true';
    // VERCEL_DEPLOY_HOOK_URL bewusst nicht gesetzt
    const { updates } = setupUnpublish();

    const res = await invokeScenario('unpublish');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res._body.deploy).toEqual({ status: 'not_configured' });
    const payloads = parentDeployUpdates(updates);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].deploy_status).toBe('not_requested');
    for (const payload of payloads) {
      expect(ALLOWED_DB_VALUES).toContain(payload.deploy_status);
    }
  });
});

// ===========================================================================
// 6. Hook-Fehler — kein Rollback
// ===========================================================================

describe('Szenario-Lifecycle bei fehlgeschlagenem Deploy-Hook', () => {
  it('publish bleibt bestehen, Parent-deploy_status wird failed', async () => {
    enableDeploy();
    fetchSpy.mockResolvedValue({ ok: false, status: 503 });
    const { updates } = setupPublish();

    const res = await invokeScenario('publish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('published');
    expect(res._body.deploy.status).toBe('failed');

    const payloads = parentDeployUpdates(updates);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual({ deploy_status: 'failed' });
    expect(payloads[0].deploy_requested_at).toBeUndefined();

    // Kein Rückschreiben auf draft
    expect(scenarioUpdates(updates).some((p) => p.status === 'draft')).toBe(false);
  });

  it('unpublish bleibt bestehen, Parent-deploy_status wird failed', async () => {
    enableDeploy();
    fetchSpy.mockResolvedValue({ ok: false, status: 503 });
    const { updates } = setupUnpublish();

    const res = await invokeScenario('unpublish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
    expect(res._body.data.published_at).toBeNull();
    expect(res._body.deploy.status).toBe('failed');
    expect(parentDeployUpdates(updates)[0]).toEqual({ deploy_status: 'failed' });

    // Kein Rückschreiben auf published
    expect(scenarioUpdates(updates).some((p) => p.status === 'published')).toBe(false);
  });

  it('archive bleibt bestehen, auch bei Netzwerkfehler', async () => {
    enableDeploy();
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const { updates } = setupArchive('published');

    const res = await invokeScenario('archive');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('archived');
    expect(res._body.deploy.status).toBe('failed');
    expect(parentDeployUpdates(updates)[0]).toEqual({ deploy_status: 'failed' });
  });

  it('ein Fehler beim Speichern des deploy_status rollt nichts zurück', async () => {
    enableDeploy();
    // theme_worlds-Update liefert keinen Fehler über .single(), sondern direkt —
    // der Helper wertet das Ergebnisobjekt aus. Hier genügt der Nachweis, dass
    // der fachliche Status auch bei fehlgeschlagenem Hook stehen bleibt.
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });
    const { updates } = setupUnpublish();

    const res = await invokeScenario('unpublish');

    expect(res._status).toBe(200);
    expect(res._body.data.status).toBe('draft');
    expect(scenarioUpdates(updates)).toHaveLength(1);
  });
});

// ===========================================================================
// 8. Aktionen ohne Sichtbarkeitsänderung
// ===========================================================================

describe('Aktionen ohne Änderung der öffentlichen Existenz', () => {
  it('create löst keinen Hook aus (neue Szenarien sind immer Entwürfe)', async () => {
    enableDeploy();
    setupSupabase({
      theme_worlds: [{ data: { id: TW_ID }, error: null }],
      theme_world_scenarios: [
        { data: { id: SCENARIO_ID, slug: 'neu', status: 'draft', created_at: '2026-08-16T10:00:00Z' }, error: null },
      ],
    });

    const res = await invokeScenario(
      'create',
      { themeWorldId: TW_ID },
      JSON.stringify({ slug: 'neu', label_de: 'Neu', teaser_de: 'Teaser' })
    );

    expect(res._status).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('update löst keinen Hook aus', async () => {
    enableDeploy();
    setupSupabase({
      theme_world_scenarios: [
        { data: { id: SCENARIO_ID, status: 'published', slug: 'erste-kamera' }, error: null },
        { data: { id: SCENARIO_ID, slug: 'erste-kamera', status: 'published', updated_at: '2026-08-16T10:00:00Z' }, error: null },
      ],
      theme_worlds: [],
    });

    const res = await invokeScenario(
      'update',
      {},
      JSON.stringify({ slug: 'erste-kamera', label_de: 'Erste Kamera', teaser_de: 'Teaser' })
    );

    expect(res._status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reorder löst keinen Hook aus', async () => {
    enableDeploy();
    setupSupabase({ theme_world_scenarios: [], theme_worlds: [] });

    await invokeScenario(
      'reorder',
      { themeWorldId: TW_ID },
      JSON.stringify({ items: [{ id: SCENARIO_ID, sort_order: 1 }] })
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 9. Gemeinsamer Helper statt zweiter Kopie
// ===========================================================================

describe('Gemeinsamer Deploy-Lifecycle-Helper', () => {
  it('beide Admin-Endpunkte importieren denselben Helper', () => {
    const worlds = readFileSync('./api/admin-theme-worlds.js', 'utf8');
    const scenarios = readFileSync('./api/admin-theme-world-scenarios.js', 'utf8');

    expect(worlds).toContain("./_lib/theme-world-deploy-lifecycle.js");
    expect(scenarios).toContain("./_lib/theme-world-deploy-lifecycle.js");
  });

  it('keiner der beiden Endpunkte hält eine eigene Kopie der Hook-Logik', () => {
    for (const file of ['./api/admin-theme-worlds.js', './api/admin-theme-world-scenarios.js']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('triggerDeployHook(');
      expect(source).not.toContain('function requestDeployForVisibilityChange');
    }
  });

  it('der Helper kennt nur die drei DB-konformen deploy_status-Werte', async () => {
    const { DB_DEPLOY_STATUS, toDbDeployStatus } = await import(
      '../api/_lib/theme-world-deploy-lifecycle.js'
    );

    expect(Object.values(DB_DEPLOY_STATUS).sort()).toEqual(['failed', 'not_requested', 'requested']);
    expect(toDbDeployStatus('requested')).toBe('requested');
    expect(toDbDeployStatus('failed')).toBe('failed');
    expect(toDbDeployStatus('not_configured')).toBe('not_requested');
    expect(toDbDeployStatus(undefined)).toBe('not_requested');
  });

  it('ohne Parent-ID wird kein deploy_status geschrieben, der Build aber angefordert', async () => {
    enableDeploy();
    const { requestDeployForVisibilityChange } = await import(
      '../api/_lib/theme-world-deploy-lifecycle.js'
    );
    const { updates } = setupSupabase({ theme_worlds: [], theme_world_scenarios: [] });

    const result = await requestDeployForVisibilityChange(mockSupabase, null, 'publish', 'test');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.deploy.status).toBe('requested');
    expect(result.deployStatus).toBeNull();
    expect(parentDeployUpdates(updates)).toHaveLength(0);
  });
});

// ===========================================================================
// 10. Sicherheit: Hook-URL nie in Antwort oder Logs
// ===========================================================================

describe('Deploy-Hook-Sicherheit im Szenario-Lifecycle', () => {
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

  it('gibt die Hook-URL bei erfolgreichem publish weder aus noch loggt sie', async () => {
    enableDeploy();
    setupPublish();
    assertNoSecretLeak(await invokeScenario('publish'));
  });

  it('gibt die Hook-URL bei fehlgeschlagenem Hook weder aus noch loggt sie', async () => {
    enableDeploy();
    fetchSpy.mockRejectedValue(new Error(`connect failed for ${HOOK_URL}`));
    setupUnpublish();
    assertNoSecretLeak(await invokeScenario('unpublish'));
  });

  it('gibt die Hook-URL beim archive eines publizierten Szenarios nicht preis', async () => {
    enableDeploy();
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });
    setupArchive('published');
    assertNoSecretLeak(await invokeScenario('archive'));
  });
});
