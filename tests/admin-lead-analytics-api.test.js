/**
 * Admin-API der Lead-Analyse: Zugriffsschutz, Validierung, kein Klartext in
 * Listen-Endpunkten.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import { encryptLeadMessage } from '../api/_lib/lead-message-crypto.js';

let mockSupabase;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const PROVIDER_ID = '00000000-0000-4000-8000-0000000000aa';
const LEAD_ID = '00000000-0000-4000-8000-0000000000bb';

/**
 * @param {object} opts
 * @param {'admin'|'teacher'|'none'|'bad-token'} opts.role
 */
function buildSupabase({ role = 'admin', rpcResults = {}, payload = null } = {}) {
  const rpcCalls = [];
  return {
    rpcCalls,
    auth: {
      getUser: async (token) => (role === 'bad-token' || !token)
        ? { data: null, error: { message: 'invalid' } }
        : { data: { user: { id: ADMIN_ID } }, error: null },
    },
    from(table) {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => role === 'none'
                ? { data: null, error: { message: 'not found' } }
                : { data: { role }, error: null },
            }),
          }),
        };
      }
      if (table === 'lead_message_payloads') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: payload, error: null }) }) }),
        };
      }
      if (table === 'leads') {
        return {
          update: () => ({ in: () => ({ in: async () => ({ error: null }) }) }),
        };
      }
      throw new Error(`unerwartete Tabelle: ${table}`);
    },
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      return { data: rpcResults[name] ?? [], error: null };
    },
  };
}

async function call(req) {
  const { default: handler } = await import('../api/admin-lead-analytics.js');
  const res = makeRes();
  await handler({ headers: {}, query: {}, method: 'GET', ...req }, res);
  return res;
}

const AUTH = { authorization: 'Bearer valid-token' };
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  mockSupabase = buildSupabase({ role: 'admin' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('Zugriffsschutz', () => {
  it('lehnt Anfragen ohne Authorization-Header ab', async () => {
    const res = await call({ query: { action: 'overview' } });
    expect(res._status).toBe(401);
  });

  it('lehnt einen nicht auswertbaren Header ab', async () => {
    const res = await call({ headers: { authorization: 'Basic abc' }, query: { action: 'overview' } });
    expect(res._status).toBe(401);
  });

  it('lehnt ein ungültiges Token ab', async () => {
    mockSupabase = buildSupabase({ role: 'bad-token' });
    const res = await call({ headers: AUTH, query: { action: 'overview' } });
    expect(res._status).toBe(401);
  });

  it('sperrt eingeloggte Nicht-Admins aus', async () => {
    mockSupabase = buildSupabase({ role: 'teacher' });
    const res = await call({ headers: AUTH, query: { action: 'overview' } });
    expect(res._status).toBe(403);
  });

  it('sperrt jede Action für Nicht-Admins, nicht nur die Übersicht', async () => {
    mockSupabase = buildSupabase({ role: 'teacher' });
    for (const action of ['overview', 'detail', 'leads', 'message', 'rescore']) {
      const res = await call({ headers: AUTH, method: 'POST', query: { action } });
      expect(res._status).toBe(403);
    }
  });
});

describe('Übersicht: Validierung von Filter, Sortierung und Pagination', () => {
  it('reicht erlaubte Parameter durch', async () => {
    await call({
      headers: AUTH,
      query: { action: 'overview', q: 'Muster', tier: 'basic', filter: 'no_leads', sortBy: 'avg_quality', sortDir: 'asc', limit: '50', offset: '100' },
    });

    expect(mockSupabase.rpcCalls[0].args).toMatchObject({
      p_search: 'Muster',
      p_tier: 'basic',
      p_filter: 'no_leads',
      p_sort: 'avg_quality',
      p_dir: 'asc',
      p_limit: 50,
      p_offset: 100,
    });
  });

  it('verwirft eine unbekannte Sortierung statt sie durchzureichen', async () => {
    await call({ headers: AUTH, query: { action: 'overview', sortBy: 'leads_total; DROP TABLE leads' } });
    expect(mockSupabase.rpcCalls[0].args.p_sort).toBe('leads_total');
  });

  it('verwirft ein unbekanntes Paket und einen unbekannten Filter', async () => {
    await call({ headers: AUTH, query: { action: 'overview', tier: 'gold', filter: 'alles' } });
    expect(mockSupabase.rpcCalls[0].args.p_tier).toBeNull();
    expect(mockSupabase.rpcCalls[0].args.p_filter).toBeNull();
  });

  it('begrenzt limit nach oben und offset nach unten', async () => {
    await call({ headers: AUTH, query: { action: 'overview', limit: '99999', offset: '-5' } });
    expect(mockSupabase.rpcCalls[0].args.p_limit).toBe(100);
    expect(mockSupabase.rpcCalls[0].args.p_offset).toBe(0);
  });

  it('nimmt bei fehlenden Parametern sichere Vorgaben', async () => {
    await call({ headers: AUTH, query: { action: 'overview' } });
    expect(mockSupabase.rpcCalls[0].args).toMatchObject({
      p_search: null, p_tier: null, p_filter: null, p_sort: 'leads_total', p_dir: 'desc', p_limit: 25, p_offset: 0,
    });
  });

  it('liefert die Gesamtzahl und entfernt die interne Zählspalte', async () => {
    mockSupabase = buildSupabase({
      role: 'admin',
      rpcResults: {
        admin_provider_lead_overview: [
          { provider_id: PROVIDER_ID, full_name: 'A', leads_total: 4, total_count: 12 },
        ],
      },
    });
    const res = await call({ headers: AUTH, query: { action: 'overview' } });

    expect(res._status).toBe(200);
    expect(res._body.pagination.total).toBe(12);
    expect(res._body.data[0]).not.toHaveProperty('total_count');
  });

  it('liefert bei leerem Ergebnis eine saubere Null-Gesamtzahl', async () => {
    const res = await call({ headers: AUTH, query: { action: 'overview' } });
    expect(res._body).toEqual({ data: [], pagination: { total: 0, limit: 25, offset: 0 } });
  });
});

describe('Detail und Leadliste', () => {
  it('weist eine ungültige providerId ab', async () => {
    for (const providerId of ['nicht-uuid', '1 OR 1=1', '']) {
      const res = await call({ headers: AUTH, query: { action: 'detail', providerId } });
      expect(res._status).toBe(400);
    }
    expect(mockSupabase.rpcCalls).toHaveLength(0);
  });

  it('meldet einen unbekannten Anbieter als 404', async () => {
    mockSupabase = buildSupabase({ role: 'admin', rpcResults: { admin_provider_lead_detail: {} } });
    const res = await call({ headers: AUTH, query: { action: 'detail', providerId: PROVIDER_ID } });
    expect(res._status).toBe(404);
  });

  it('liefert in der Leadliste keinen Klartext und kein Chiffrat', async () => {
    mockSupabase = buildSupabase({
      role: 'admin',
      rpcResults: {
        admin_provider_leads: [{
          id: LEAD_ID, created_at: '2026-08-01T00:00:00Z', course_title: 'Yoga',
          status: 'sent', quality_score: 7, quality_status: 'scored',
          message_available: true, total_count: 1,
        }],
      },
    });

    const res = await call({ headers: AUTH, query: { action: 'leads', providerId: PROVIDER_ID } });

    const serialized = JSON.stringify(res._body);
    expect(serialized).not.toContain('ciphertext');
    expect(serialized).not.toContain('v1.');
    expect(res._body.data[0].message_available).toBe(true);
  });

  it('begrenzt die Leadliste', async () => {
    await call({ headers: AUTH, query: { action: 'leads', providerId: PROVIDER_ID, limit: '5000' } });
    expect(mockSupabase.rpcCalls[0].args.p_limit).toBe(100);
  });
});

describe('Klartext eines einzelnen Leads', () => {
  const key = randomBytes(32).toString('base64');

  it('entschlüsselt nur bei gültiger leadId', async () => {
    const res = await call({ headers: AUTH, query: { action: 'message', leadId: 'kaputt' } });
    expect(res._status).toBe(400);
  });

  it('liefert den Klartext, solange der Text gültig ist', async () => {
    process.env.LEAD_MESSAGE_ENCRYPTION_KEY = key;
    mockSupabase = buildSupabase({
      role: 'admin',
      payload: {
        ciphertext: encryptLeadMessage('Ich möchte am Dienstagskurs teilnehmen.', { LEAD_MESSAGE_ENCRYPTION_KEY: key }),
        created_at: '2026-08-01T00:00:00Z',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    const res = await call({ headers: AUTH, query: { action: 'message', leadId: LEAD_ID } });

    expect(res._status).toBe(200);
    expect(res._body.available).toBe(true);
    expect(res._body.message).toBe('Ich möchte am Dienstagskurs teilnehmen.');
  });

  it('unterscheidet gelöscht von abgelaufen', async () => {
    mockSupabase = buildSupabase({ role: 'admin', payload: null });
    const geloescht = await call({ headers: AUTH, query: { action: 'message', leadId: LEAD_ID } });
    expect(geloescht._body).toEqual({ available: false, reason: 'deleted' });

    mockSupabase = buildSupabase({
      role: 'admin',
      payload: { ciphertext: 'v1.a.b.c', created_at: '2026-01-01T00:00:00Z', expires_at: new Date(Date.now() - 1000).toISOString() },
    });
    const abgelaufen = await call({ headers: AUTH, query: { action: 'message', leadId: LEAD_ID } });
    expect(abgelaufen._body.available).toBe(false);
    expect(abgelaufen._body.reason).toBe('expired');
    // Ein abgelaufener Text wird gar nicht erst entschlüsselt.
    expect(abgelaufen._body).not.toHaveProperty('message');
  });

  it('gibt bei fehlgeschlagener Entschlüsselung keine Details preis', async () => {
    process.env.LEAD_MESSAGE_ENCRYPTION_KEY = key;
    mockSupabase = buildSupabase({
      role: 'admin',
      payload: { ciphertext: 'v1.aaaa.bbbb.cccc', created_at: 'x', expires_at: new Date(Date.now() + 86400000).toISOString() },
    });

    const res = await call({ headers: AUTH, query: { action: 'message', leadId: LEAD_ID } });

    expect(res._status).toBe(500);
    expect(JSON.stringify(res._body)).not.toContain(key);
  });
});

describe('Manuelle Wiederholung', () => {
  it('verlangt leadIds', async () => {
    const res = await call({ headers: AUTH, method: 'POST', query: { action: 'rescore' }, body: {} });
    expect(res._status).toBe(400);
  });

  it('weist ungültige IDs ab', async () => {
    const res = await call({ headers: AUTH, method: 'POST', query: { action: 'rescore' }, body: { leadIds: ['nope'] } });
    expect(res._status).toBe(400);
  });

  it('begrenzt die Anzahl pro Anfrage', async () => {
    const res = await call({
      headers: AUTH, method: 'POST', query: { action: 'rescore' },
      body: { leadIds: Array.from({ length: 26 }, () => LEAD_ID) },
    });
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/Maximal/);
  });

  it('meldet einen fehlenden KI-Anbieter als 501 statt als Serverfehler', async () => {
    delete process.env.LEAD_SCORING_PROVIDER;
    const res = await call({ headers: AUTH, method: 'POST', query: { action: 'rescore' }, body: { leadIds: [LEAD_ID] } });
    expect(res._status).toBe(501);
    expect(res._body.error).toBe('lead_scoring_not_configured');
  });

  it('lehnt GET ab', async () => {
    const res = await call({ headers: AUTH, method: 'GET', query: { action: 'rescore' } });
    expect(res._status).toBe(405);
  });
});

describe('Unbekannte Action', () => {
  it('antwortet mit 400', async () => {
    const res = await call({ headers: AUTH, query: { action: 'gibt-es-nicht' } });
    expect(res._status).toBe(400);
  });
});
