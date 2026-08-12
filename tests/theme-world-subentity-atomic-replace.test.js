/**
 * Release-Blocker 1 — Regressionstests: Datenverlust beim Speichern von Unterlisten
 *
 * URSACHE (vor dem Fix)
 *   api/admin-theme-world-sub.js -> replaceList() führte zwei getrennte
 *   Supabase-Aufrufe aus:
 *     1. DELETE aller bestehenden Datensätze
 *     2. separater INSERT der neuen Liste
 *   Schlug (2) fehl, war (1) bereits committet — die vorherigen Daten
 *   waren dauerhaft verloren.
 *
 * FIX
 *   Der Listenersatz läuft jetzt über die PostgreSQL-RPC
 *   replace_theme_world_subentities (Migration 20260809). DELETE und INSERT
 *   stehen dort in einem Funktionsaufruf und damit in derselben Transaktion.
 *
 * WAS DIESE DATEI BEWEIST — und was nicht
 *   Supabase ist in dieser Suite vollständig gemockt; eine echte
 *   Transaktionsgarantie lässt sich hier NICHT herstellen und wird auch
 *   nicht simuliert. Bewiesen werden deshalb zwei getrennte Dinge:
 *
 *   A) SQL-Struktur (statisch): Die Migration führt DELETE + INSERT im
 *      selben Funktionskörper aus, ohne COMMIT/SAVEPOINT und ohne
 *      fehlerverschluckenden EXCEPTION-Handler. Daraus folgt der Rollback
 *      durch PostgreSQL.
 *   B) API-Verhalten: Der Endpunkt sendet KEIN eigenständiges DELETE mehr.
 *      Damit existiert das Zeitfenster, in dem Daten verloren gehen
 *      konnten, im JavaScript-Pfad nicht mehr.
 *
 *   Der echte Rollback an einer laufenden Datenbank wird in
 *   tests/theme-world-subentity-rollback.integration.test.js geprüft
 *   (übersprungen, solange keine Staging-Zugangsdaten gesetzt sind).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const MIGRATION_PATH = resolve(
  PROJECT_ROOT,
  'supabase/migrations/20260809_atomic_replace_theme_world_subentities.sql'
);

let migrationSql = '';
try {
  migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');
} catch (_) {
  migrationSql = '';
}

/** Körper der Funktion zwischen AS $$ und $$; — nur dort darf DML stehen. */
function functionBody(sql) {
  const match = sql.match(/AS \$\$([\s\S]*?)\$\$;/);
  return match ? match[1] : '';
}

const FIVE_TABLES = [
  'theme_world_faqs',
  'theme_world_editorial_sections',
  'theme_world_specialties',
  'theme_world_regions',
  'theme_world_trust_items',
];

const ENTITY_TYPES = ['faqs', 'editorial_sections', 'specialties', 'regions', 'trust_items'];

// ===========================================================================
// A. Migration 20260809 — SQL-Struktur (statisch)
// ===========================================================================

describe('Blocker 1 / A: Migration 20260809 stellt den Listenersatz transaktional bereit', () => {
  it('Migrationsdatei ist vorhanden', () => {
    expect(migrationSql.length).toBeGreaterThan(500);
  });

  it('erstellt die Funktion replace_theme_world_subentities(UUID, TEXT, JSONB)', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.replace_theme_world_subentities\(/
    );
    expect(migrationSql).toMatch(/p_theme_world_id\s+UUID/);
    expect(migrationSql).toMatch(/p_entity_type\s+TEXT/);
    expect(migrationSql).toMatch(/p_items\s+JSONB/);
  });

  it.each(FIVE_TABLES)(
    'enthält DELETE und INSERT für %s im selben Funktionskörper',
    (table) => {
      const body = functionBody(migrationSql);
      expect(body).toMatch(new RegExp(`DELETE FROM public\\.${table}`));
      expect(body).toMatch(new RegExp(`INSERT INTO public\\.${table}`));
    }
  );

  it('jedes DELETE ist auf eine einzelne Themenwelt eingegrenzt (kein globales DELETE)', () => {
    const body = functionBody(migrationSql);
    const deletes = body.match(/DELETE FROM public\.\w+[\s\S]*?;/g) || [];
    expect(deletes.length).toBe(5);
    for (const stmt of deletes) {
      expect(stmt).toMatch(/WHERE theme_world_id = p_theme_world_id/);
    }
  });

  it('enthält kein COMMIT, ROLLBACK oder SAVEPOINT (Transaktionsklammer gehört dem Aufrufer)', () => {
    const body = functionBody(migrationSql);
    expect(body).not.toMatch(/\bCOMMIT\b/i);
    expect(body).not.toMatch(/\bROLLBACK\b/i);
    expect(body).not.toMatch(/\bSAVEPOINT\b/i);
  });

  it('enthält keinen fehlerverschluckenden EXCEPTION-Handler', () => {
    // Ein "EXCEPTION WHEN OTHERS"-Block dürfte einen Fehler niemals
    // abfangen ohne ihn erneut zu werfen — hier existiert gar keiner,
    // damit SQLSTATE und Originalmeldung unverändert propagieren.
    const body = functionBody(migrationSql);
    expect(body).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS/i);
  });

  it('validiert den Entity-Typ gegen eine strikte Whitelist', () => {
    const body = functionBody(migrationSql);
    expect(body).toMatch(/p_entity_type NOT IN \(/);
    for (const type of ENTITY_TYPES) {
      expect(body).toContain(`'${type}'`);
    }
    // Unbekannter Typ muss zu einer Exception führen
    expect(body).toMatch(/RAISE EXCEPTION[^;]*unbekannter Entity-Typ/i);
  });

  it('verwendet keine dynamische SQL und keinen Tabellennamen aus Parametern', () => {
    const body = functionBody(migrationSql);
    expect(body).not.toMatch(/\bEXECUTE\b/i);
    expect(body).not.toMatch(/\bformat\s*\(/i);
    expect(body).not.toMatch(/quote_ident/i);
    // Tabellennamen stehen ausschliesslich statisch im Code
    expect(body).not.toMatch(/FROM public\.'/);
  });

  it('lehnt ein fehlendes/ungültiges p_items ab, bevor gelöscht wird', () => {
    const body = functionBody(migrationSql);
    const guardIdx = body.search(/p_items IS NULL OR jsonb_typeof\(p_items\) <> 'array'/);
    const firstDeleteIdx = body.search(/DELETE FROM public\./);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(firstDeleteIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(firstDeleteIdx);
  });

  it('prüft die Existenz der Themenwelt, bevor gelöscht wird', () => {
    const body = functionBody(migrationSql);
    const existsIdx = body.search(/NOT EXISTS \(\s*SELECT 1 FROM public\.theme_worlds/);
    const firstDeleteIdx = body.search(/DELETE FROM public\./);
    expect(existsIdx).toBeGreaterThan(-1);
    expect(existsIdx).toBeLessThan(firstDeleteIdx);
  });

  it('setzt search_path auf leeren String (kein search_path-Injection)', () => {
    expect(migrationSql).toMatch(/SET search_path = ''/);
  });
});

// ===========================================================================
// A2. Migration 20260809 — Berechtigungen
// ===========================================================================

describe('Blocker 1 / A2: RPC ist nicht öffentlich freigegeben', () => {
  const SIG = 'public.replace_theme_world_subentities(UUID, TEXT, JSONB)';

  it('entzieht PUBLIC alle Rechte', () => {
    expect(migrationSql).toContain(`REVOKE ALL ON FUNCTION ${SIG} FROM PUBLIC`);
  });

  it('entzieht anon das EXECUTE-Recht', () => {
    expect(migrationSql).toContain(`REVOKE EXECUTE ON FUNCTION ${SIG} FROM anon`);
  });

  it('entzieht authenticated das EXECUTE-Recht', () => {
    expect(migrationSql).toContain(`REVOKE EXECUTE ON FUNCTION ${SIG} FROM authenticated`);
  });

  it('erteilt EXECUTE ausschliesslich service_role', () => {
    expect(migrationSql).toContain(`GRANT EXECUTE ON FUNCTION ${SIG} TO service_role`);
    const grants = migrationSql.match(/GRANT EXECUTE ON FUNCTION[^;]*;/g) || [];
    expect(grants.length).toBe(1);
    expect(grants[0]).toContain('service_role');
  });

  it('GRANT steht nach den REVOKE-Anweisungen', () => {
    const revokeIdx = migrationSql.indexOf('REVOKE ALL ON FUNCTION');
    const grantIdx = migrationSql.indexOf('GRANT EXECUTE ON FUNCTION');
    expect(revokeIdx).toBeGreaterThan(-1);
    expect(grantIdx).toBeGreaterThan(revokeIdx);
  });

  it('läuft als SECURITY DEFINER', () => {
    expect(migrationSql).toMatch(/SECURITY DEFINER/);
  });
});

// ===========================================================================
// A3. Migration 20260809 — Unbedenklichkeit (Phase 7)
// ===========================================================================

describe('Blocker 1 / A3: Migration verändert keine Daten und keine fremden Tabellen', () => {
  it('enthält kein TRUNCATE', () => {
    expect(migrationSql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('enthält kein CASCADE', () => {
    expect(migrationSql).not.toMatch(/\bCASCADE\b/i);
  });

  it('enthält kein DROP TABLE und kein ALTER TABLE', () => {
    expect(migrationSql).not.toMatch(/\bDROP TABLE\b/i);
    expect(migrationSql).not.toMatch(/\bALTER TABLE\b/i);
  });

  it('rührt keine Kurs-, Nutzer- oder Buchungstabellen an', () => {
    const forbidden = [
      'courses', 'bookings', 'profiles', 'course_events',
      'providers', 'credits', 'taxonomy_level1', 'course_locations',
    ];
    for (const table of forbidden) {
      expect(migrationSql).not.toMatch(new RegExp(`public\\.${table}\\b`));
    }
  });

  it('führt beim Ausführen selbst kein DML aus (nur Funktion + Rechte)', () => {
    // Ausserhalb des Funktionskörpers darf keine DML-Anweisung stehen.
    const outside = migrationSql.replace(/AS \$\$[\s\S]*?\$\$;/, '');
    expect(outside).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\s/im);
  });

  it('besteht ausschliesslich aus CREATE FUNCTION, COMMENT, REVOKE und GRANT', () => {
    const outside = migrationSql.replace(/AS \$\$[\s\S]*?\$\$;/, '');
    const statements = outside
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('--'));
    const allowedStart = /^(CREATE OR REPLACE FUNCTION|COMMENT ON FUNCTION|REVOKE|GRANT|RETURNS|LANGUAGE|SECURITY|SET|p_|\)|'|"|AS )/i;
    for (const stmt of statements) {
      expect(stmt).toMatch(allowedStart);
    }
  });
});

// ===========================================================================
// B. API-Verhalten — api/admin-theme-world-sub.js
// ===========================================================================

const THEME_WORLD_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_THEME_WORLD_ID = '22222222-2222-4222-8222-222222222222';

let mockSupabase;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

function makeMockRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

/**
 * Fake-Supabase-Client, der jede Tabellenoperation protokolliert.
 * `.delete()` und `.insert()` auf den Sub-Tabellen dürfen NIE aufgerufen werden.
 */
function makeRecordingSupabase({ rpcResult } = {}) {
  const calls = { rpc: [], deletes: [], inserts: [], selects: [] };

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table) => {
      const chain = {
        select: vi.fn((cols) => { calls.selects.push({ table, cols }); return chain; }),
        insert: vi.fn((payload) => { calls.inserts.push({ table, payload }); return chain; }),
        update: vi.fn(() => chain),
        delete: vi.fn(() => { calls.deletes.push({ table }); return chain; }),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        single: vi.fn(() => {
          if (table === 'profiles') {
            return Promise.resolve({ data: { role: 'admin' }, error: null });
          }
          if (table === 'theme_worlds') {
            return Promise.resolve({ data: { id: THEME_WORLD_ID }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        then: (resolve) => resolve({ data: [], error: null }),
      };
      return chain;
    }),
    rpc: vi.fn((fn, args) => {
      calls.rpc.push({ fn, args });
      return Promise.resolve(
        rpcResult || {
          data: {
            success: true,
            theme_world_id: args.p_theme_world_id,
            entity_type: args.p_entity_type,
            count: args.p_items.length,
          },
          error: null,
        }
      );
    }),
  };

  return { client, calls };
}

function makeAdminReq({ action, themeWorldId = THEME_WORLD_ID, items = [] }) {
  return {
    method: 'POST',
    query: { action, themeWorldId },
    headers: { authorization: 'Bearer valid-admin-token' },
    body: { items },
  };
}

async function loadHandler() {
  const mod = await import('../api/admin-theme-world-sub.js');
  return mod.default;
}

const REPLACE_ACTIONS = [
  { action: 'replace-faqs', entityType: 'faqs', table: 'theme_world_faqs',
    item: { question_de: 'Frage?', answer_de: 'Antwort.' } },
  { action: 'replace-editorial', entityType: 'editorial_sections', table: 'theme_world_editorial_sections',
    item: { heading_de: 'Überschrift' } },
  { action: 'replace-specialties', entityType: 'specialties', table: 'theme_world_specialties',
    item: { specialty_label: 'Fitness' } },
  { action: 'replace-regions', entityType: 'regions', table: 'theme_world_regions',
    item: { label_de: 'Zürich', loc_param: 'Zürich' } },
  { action: 'replace-trust', entityType: 'trust_items', table: 'theme_world_trust_items',
    item: { item_type: 'editorial', name: 'Hinweis' } },
];

describe('Blocker 1 / B: API führt kein eigenständiges DELETE + INSERT mehr aus', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    vi.resetModules();
  });

  it.each(REPLACE_ACTIONS)(
    '$action ruft die RPC auf und sendet KEIN separates DELETE/INSERT',
    async ({ action, entityType, table, item }) => {
      const { client, calls } = makeRecordingSupabase();
      mockSupabase = client;

      const handler = await loadHandler();
      const res = makeMockRes();
      await handler(makeAdminReq({ action, items: [item] }), res);

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ ok: true, count: 1 });

      // Genau ein RPC-Aufruf mit korrektem Entity-Typ
      expect(calls.rpc).toHaveLength(1);
      expect(calls.rpc[0].fn).toBe('replace_theme_world_subentities');
      expect(calls.rpc[0].args.p_entity_type).toBe(entityType);
      expect(calls.rpc[0].args.p_theme_world_id).toBe(THEME_WORLD_ID);
      expect(calls.rpc[0].args.p_items).toHaveLength(1);

      // Kernaussage: kein DELETE und kein INSERT auf der Sub-Tabelle
      expect(calls.deletes).toHaveLength(0);
      expect(calls.inserts).toHaveLength(0);
      expect(calls.deletes.some(c => c.table === table)).toBe(false);
      expect(calls.inserts.some(c => c.table === table)).toBe(false);
    }
  );

  it('setzt sort_order aus dem Listenindex, wenn nicht angegeben', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(
      makeAdminReq({
        action: 'replace-faqs',
        items: [
          { question_de: 'A?', answer_de: 'A.' },
          { question_de: 'B?', answer_de: 'B.' },
          { question_de: 'C?', answer_de: 'C.', sort_order: 99 },
        ],
      }),
      res
    );

    expect(res._status).toBe(200);
    const sent = calls.rpc[0].args.p_items;
    expect(sent.map(i => i.sort_order)).toEqual([0, 1, 99]);
  });

  it('sendet keine theme_world_id im Item-Payload (kommt aus dem RPC-Parameter)', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(
      makeAdminReq({ action: 'replace-faqs', items: [{ question_de: 'Q?', answer_de: 'A.' }] }),
      res
    );

    expect(calls.rpc[0].args.p_items[0].theme_world_id).toBeUndefined();
    expect(calls.rpc[0].args.p_theme_world_id).toBe(THEME_WORLD_ID);
  });
});

describe('Blocker 1 / B2: Fehlerfall zerstört keine bestehenden Daten', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    vi.resetModules();
  });

  it.each(REPLACE_ACTIONS)(
    '$action: RPC-Fehler (Constraint-Verletzung) → 500, und die API hat nichts gelöscht',
    async ({ action, item }) => {
      // Realistischer Constraint-Fehler, wie ihn PostgreSQL liefert:
      // z.B. specialties_label_theme_unique bei doppeltem specialty_label.
      const { client, calls } = makeRecordingSupabase({
        rpcResult: {
          data: null,
          error: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "specialties_label_theme_unique"',
          },
        },
      });
      mockSupabase = client;

      const handler = await loadHandler();
      const res = makeMockRes();
      await handler(makeAdminReq({ action, items: [item, item] }), res);

      expect(res._status).toBe(500);
      expect(res._body.error).toMatch(/Listenersatz fehlgeschlagen/);
      expect(res._body.error).toMatch(/unique constraint/);

      // Entscheidend: Die API hat zu KEINEM Zeitpunkt selbst gelöscht.
      // Das Löschen passiert nur innerhalb der RPC-Transaktion, die beim
      // Fehler vollständig zurückgerollt wird.
      expect(calls.deletes).toHaveLength(0);
      expect(calls.inserts).toHaveLength(0);
      expect(calls.rpc).toHaveLength(1);
    }
  );

  it('versucht KEINE Wiederherstellung der alten Daten in JavaScript', async () => {
    // Ein "best effort"-Restore-Pfad wäre kein Ersatz für eine Transaktion.
    // Nach einem RPC-Fehler darf genau nichts weiter passieren.
    const { client, calls } = makeRecordingSupabase({
      rpcResult: { data: null, error: { code: '23505', message: 'duplicate key' } },
    });
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(
      makeAdminReq({ action: 'replace-faqs', items: [{ question_de: 'Q?', answer_de: 'A.' }] }),
      res
    );

    expect(res._status).toBe(500);
    expect(calls.rpc).toHaveLength(1);   // kein zweiter Rettungsversuch
    expect(calls.inserts).toHaveLength(0); // kein Re-Insert der alten Liste
  });

  it('Quelltext enthält keine JS-seitige Restore-/Rollback-Logik', async () => {
    const src = readFileSync(resolve(PROJECT_ROOT, 'api/admin-theme-world-sub.js'), 'utf-8');
    // Kein DELETE/INSERT auf Sub-Tabellen mehr im API-Layer
    expect(src).not.toMatch(/\.delete\(\)/);
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).toContain('replace_theme_world_subentities');
  });
});

describe('Blocker 1 / B3: Leere Liste, Isolation und unbekannte Typen', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    vi.resetModules();
  });

  it('leere Liste löscht die bestehende Liste beabsichtigt (RPC mit leerem Array)', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(makeAdminReq({ action: 'replace-faqs', items: [] }), res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ ok: true, count: 0 });
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].args.p_items).toEqual([]);
    // Auch hier: kein eigenständiges DELETE
    expect(calls.deletes).toHaveLength(0);
  });

  it('verändert nur die angeforderte Themenwelt (ID wird unverändert durchgereicht)', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(
      {
        method: 'POST',
        query: { action: 'replace-faqs', themeWorldId: OTHER_THEME_WORLD_ID },
        headers: { authorization: 'Bearer valid-admin-token' },
        body: { items: [{ question_de: 'Q?', answer_de: 'A.' }] },
      },
      res
    );

    expect(res._status).toBe(200);
    expect(calls.rpc[0].args.p_theme_world_id).toBe(OTHER_THEME_WORLD_ID);
    expect(calls.rpc[0].args.p_theme_world_id).not.toBe(THEME_WORLD_ID);
  });

  it('unbekannte Action wird abgelehnt, ohne die DB zu berühren (400)', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(makeAdminReq({ action: 'replace-everything' }), res);

    expect(res._status).toBe(400);
    expect(calls.rpc).toHaveLength(0);
    expect(calls.deletes).toHaveLength(0);
    expect(calls.inserts).toHaveLength(0);
  });

  it('ungültige themeWorldId wird abgelehnt, ohne die DB zu berühren (400)', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(makeAdminReq({ action: 'replace-faqs', themeWorldId: 'nicht-uuid' }), res);

    expect(res._status).toBe(400);
    expect(calls.rpc).toHaveLength(0);
    expect(calls.deletes).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Release-Blocker 2 — Endpoint-Roundtrip
  // Eine realistische Sport-/Yoga-Region ohne Standort- und
  // Lieferungsfilter muss den Endpunkt passieren können.
  // -------------------------------------------------------------------
  it('replace-regions akzeptiert "Ganze Schweiz" mit beiden null-Parametern', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(
      makeAdminReq({
        action: 'replace-regions',
        items: [
          { label_de: 'Ganze Schweiz', loc_param: null, delivery_param: null },
          { label_de: 'Zürich', loc_param: 'Zürich', delivery_param: null },
          { label_de: 'Online', loc_param: null, delivery_param: 'online_live' },
        ],
      }),
      res
    );

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ ok: true, count: 3 });

    const sent = calls.rpc[0].args.p_items;
    expect(sent[0]).toMatchObject({
      label_de: 'Ganze Schweiz',
      loc_param: null,
      delivery_param: null,
      sort_order: 0,
      is_active: true,
    });
    expect(sent[1].loc_param).toBe('Zürich');
    expect(sent[2].delivery_param).toBe('online_live');
  });

  it('replace-regions lehnt einen tatsächlich gesetzten, ungültigen delivery_param weiterhin ab (400)', async () => {
    const { client, calls } = makeRecordingSupabase();
    mockSupabase = client;

    const handler = await loadHandler();
    const res = makeMockRes();
    await handler(
      makeAdminReq({
        action: 'replace-regions',
        items: [{ label_de: 'Kaputt', loc_param: null, delivery_param: 'at_home' }],
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(res._body.error).toBe('Validierungsfehler.');
    expect(res._body.details.some(d => d.includes('delivery_param'))).toBe(true);
    // Validierung schlägt fehl, bevor irgendetwas an die DB geht
    expect(calls.rpc).toHaveLength(0);
  });

  it('Entity-Typ stammt aus statischem Code, nie aus Clientdaten', async () => {
    const src = readFileSync(resolve(PROJECT_ROOT, 'api/admin-theme-world-sub.js'), 'utf-8');

    // Alle fünf Aufrufe übergeben ein String-Literal als Entity-Typ.
    const callSites = src.match(/replaceList\(supabaseAdmin, '([a-z_]+)'/g) || [];
    expect(callSites).toHaveLength(5);

    // Keine Interpolation aus req.query/body in den Entity-Typ
    expect(src).not.toMatch(/replaceList\(supabaseAdmin, `/);
    expect(src).not.toMatch(/replaceList\(supabaseAdmin, (action|req\.|body\.)/);

    // API-Whitelist deckt sich mit der SQL-Whitelist
    for (const type of ENTITY_TYPES) {
      expect(src).toContain(`'${type}'`);
      expect(functionBody(migrationSql)).toContain(`'${type}'`);
    }
  });
});
