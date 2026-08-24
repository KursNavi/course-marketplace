/**
 * Härtung des Lead-Prozesses in api/send-lead.js.
 *
 * Kernaussage der Tests: Es darf keine erfolgreich versandte Anfrage ohne
 * dauerhaften Lead-Datensatz geben.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';

// --- Mocks -----------------------------------------------------------------

let mockSupabase;
let mockSentEmails;
let insertedLeads;
let insertedPayloads;
let leadUpdates;
let leadInsertError;
let payloadInsertError;
let mockEmailShouldFail;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Muss konstruierbar sein — der Handler ruft `new Resend(...)`.
vi.mock('resend', () => ({
  Resend: class Resend {},
}));

vi.mock('../api/_lib/email-config.js', () => ({
  getEmailConfig: () => ({ from: 'KursNavi <info@test.local>', adminEmail: 'admin@test.local' }),
  resolveUserEmail: async (_supabase, _userId, email) => email,
  sendEmailOrThrow: async (_resend, _tag, payload) => {
    if (mockEmailShouldFail) throw new Error('Resend down');
    mockSentEmails.push(payload);
  },
}));

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

const COURSE = { id: 42, title: 'Yoga für Anfänger', user_id: 'provider-1', booking_type: 'lead' };

function buildSupabase({ providerTier = 'basic' } = {}) {
  return {
    from(table) {
      if (table === 'courses') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: COURSE, error: null }) }) }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { email: 'anbieter@test.local', package_tier: providerTier }, error: null }) }),
          }),
        };
      }
      if (table === 'leads') {
        return {
          // Rate-Limit-Abfrage
          select: () => ({
            eq: () => ({ eq: () => ({ gte: async () => ({ count: 0, error: null }) }) }),
          }),
          insert: (values) => {
            insertedLeads.push(values);
            return {
              select: () => ({
                single: async () => leadInsertError
                  ? { data: null, error: leadInsertError }
                  : { data: { id: 'lead-1' }, error: null },
              }),
            };
          },
          update: (values) => ({
            eq: async (_col, id) => { leadUpdates.push({ id, values }); return { error: null }; },
          }),
        };
      }
      if (table === 'lead_message_payloads') {
        return {
          insert: async (values) => {
            if (payloadInsertError) return { error: payloadInsertError };
            insertedPayloads.push(values);
            return { error: null };
          },
        };
      }
      throw new Error(`unerwartete Tabelle: ${table}`);
    },
  };
}

async function callHandler(body = {}) {
  const { default: handler } = await import('../api/send-lead.js');
  const req = {
    method: 'POST',
    body: {
      courseId: 42,
      name: 'Sara Muster',
      email: 'sara@example.com',
      message: 'Ich möchte am Dienstagskurs teilnehmen.',
      ...body,
    },
  };
  const res = makeRes();
  await handler(req, res);
  return res;
}

// --- Setup -----------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockSentEmails = [];
  insertedLeads = [];
  insertedPayloads = [];
  leadUpdates = [];
  leadInsertError = null;
  payloadInsertError = null;
  mockEmailShouldFail = false;
  mockSupabase = buildSupabase();

  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.LEAD_HASH_SALT = 'test-salt';
  process.env.LEAD_MESSAGE_ENCRYPTION_KEY = randomBytes(32).toString('base64');

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// --- Tests -----------------------------------------------------------------

describe('Erfolgreicher Lead', () => {
  it('legt den Lead-Datensatz an und versendet die E-Mail', async () => {
    const res = await callHandler();

    expect(res._status).toBe(200);
    expect(insertedLeads).toHaveLength(1);
    expect(mockSentEmails).toHaveLength(1);
    expect(leadUpdates).toContainEqual({ id: 'lead-1', values: { status: 'sent' } });
  });

  it('speichert das Paket des Anbieters als Snapshot am Lead', async () => {
    mockSupabase = buildSupabase({ providerTier: 'premium' });
    await callHandler();
    expect(insertedLeads[0].provider_tier_at_lead).toBe('premium');
  });

  it('normalisiert ein unbekanntes Paket zu null statt zu raten', async () => {
    mockSupabase = buildSupabase({ providerTier: 'irgendwas-neues' });
    await callHandler();
    // null zählt in der Penalty nie mit — besser als ein falsches 'basic'.
    expect(insertedLeads[0].provider_tier_at_lead).toBeNull();
  });

  it('legt den Anfragetext verschlüsselt und mit Ablaufdatum ab', async () => {
    await callHandler({ message: 'Sehr konkrete Anfrage von Sara' });

    expect(insertedPayloads).toHaveLength(1);
    const payload = insertedPayloads[0];
    expect(payload.lead_id).toBe('lead-1');
    expect(payload.ciphertext).toMatch(/^v1\./);
    expect(payload.ciphertext).not.toContain('Sara');

    const days = (new Date(payload.expires_at) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(59);
    expect(days).toBeLessThan(61);
  });
});

describe('Obligatorischer Lead-Datensatz', () => {
  it('versendet KEINE E-Mail, wenn der Lead nicht angelegt werden kann', async () => {
    leadInsertError = { message: 'insert failed' };

    const res = await callHandler();

    expect(res._status).toBe(500);
    // Das ist der Kern: keine versandte, aber ungemessene Anfrage.
    expect(mockSentEmails).toHaveLength(0);
    expect(insertedPayloads).toHaveLength(0);
  });

  it('meldet den Fehler dem Aufrufer statt ihn nur zu protokollieren', async () => {
    leadInsertError = { message: 'insert failed' };
    const res = await callHandler();
    expect(res._body.error).toMatch(/nicht erfasst/i);
  });
});

describe('Anfragetext ist nicht versandkritisch', () => {
  it('versendet die E-Mail auch, wenn der Text nicht gespeichert werden kann', async () => {
    payloadInsertError = { message: 'payload insert failed' };

    const res = await callHandler();

    expect(res._status).toBe(200);
    expect(mockSentEmails).toHaveLength(1);
    expect(leadUpdates).toContainEqual({ id: 'lead-1', values: { quality_error_code: 'payload_write_failed' } });
  });

  it('versendet die E-Mail auch ohne Verschlüsselungsschlüssel', async () => {
    delete process.env.LEAD_MESSAGE_ENCRYPTION_KEY;

    const res = await callHandler();

    expect(res._status).toBe(200);
    expect(mockSentEmails).toHaveLength(1);
    expect(insertedPayloads).toHaveLength(0);
  });

  it('schreibt den Anfragetext bei einem Fehler nicht ins Log', async () => {
    payloadInsertError = { message: 'payload insert failed' };
    await callHandler({ message: 'Sara Muster, Telefon 079 111 22 33' });

    for (const call of console.error.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('079 111 22 33');
      expect(JSON.stringify(call)).not.toContain('Sara Muster');
    }
  });
});

describe('E-Mail-Fehler', () => {
  it('markiert den Lead als failed und meldet einen Fehler', async () => {
    mockEmailShouldFail = true;

    const res = await callHandler();

    expect(res._status).toBe(500);
    expect(leadUpdates).toContainEqual({ id: 'lead-1', values: { status: 'failed' } });
  });
});

describe('Eingabeprüfung bleibt bestehen', () => {
  it('weist fehlende Felder ab', async () => {
    const { default: handler } = await import('../api/send-lead.js');
    const res = makeRes();
    await handler({ method: 'POST', body: { courseId: 42 } }, res);
    expect(res._status).toBe(400);
    expect(insertedLeads).toHaveLength(0);
  });

  it('weist andere Methoden als POST ab', async () => {
    const { default: handler } = await import('../api/send-lead.js');
    const res = makeRes();
    await handler({ method: 'GET', body: {} }, res);
    expect(res._status).toBe(405);
  });
});
