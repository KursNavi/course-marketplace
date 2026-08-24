import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockSupabase;
let mockVerify;
let currentLead;
let leadUpdates;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('resend', () => ({
  Resend: class {
    constructor() {
      this.webhooks = { verify: (...args) => mockVerify(...args) };
    }
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

function buildSupabase() {
  return {
    from(table) {
      if (table !== 'leads') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: currentLead, error: null }) }),
        }),
        update: (values) => ({
          eq: async () => { leadUpdates.push(values); return { error: null }; },
        }),
      };
    },
  };
}

async function callHandler(event = { type: 'email.delivered', created_at: '2026-08-24T12:00:00Z', data: { email_id: 'resend-1' } }) {
  const { default: handler } = await import('../api/resend-webhook.js');
  const res = makeRes();
  await handler({
    method: 'POST',
    rawBody: JSON.stringify(event),
    headers: {
      'svix-id': 'evt-1',
      'svix-timestamp': '1777000000',
      'svix-signature': 'v1,test',
    },
  }, res);
  return res;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  currentLead = { id: 'lead-1', email_delivery_status: 'accepted' };
  leadUpdates = [];
  mockSupabase = buildSupabase();
  mockVerify = vi.fn(() => ({
    type: 'email.delivered',
    created_at: '2026-08-24T12:00:00Z',
    data: { email_id: 'resend-1' },
  }));
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.RESEND_WEBHOOK_SECRET = 'whsec-test';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('Resend-Webhook', () => {
  it('prüft die Signatur und schreibt delivered am Lead', async () => {
    const res = await callHandler();

    expect(res._status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.any(String),
      webhookSecret: 'whsec-test',
    }));
    expect(leadUpdates).toEqual([{
      email_delivery_status: 'delivered',
      email_delivery_updated_at: '2026-08-24T12:00:00Z',
      email_delivery_error_code: null,
    }]);
  });

  it('setzt einen späteren Status nicht durch ein verspätetes Ereignis zurück', async () => {
    mockVerify = vi.fn(() => ({
      type: 'email.delivery_delayed',
      created_at: '2026-08-24T12:01:00Z',
      data: { email_id: 'resend-1' },
    }));
    currentLead = { id: 'lead-1', email_delivery_status: 'delivered' };

    const res = await callHandler();

    expect(res._status).toBe(200);
    expect(res._body.updated).toBe(false);
    expect(leadUpdates).toHaveLength(0);
  });

  it('quittiert unbekannte E-Mails ohne Daten zu verändern', async () => {
    currentLead = null;

    const res = await callHandler();

    expect(res._status).toBe(200);
    expect(res._body.matched).toBe(false);
    expect(leadUpdates).toHaveLength(0);
  });

  it('verweigert den Betrieb ohne Webhook-Geheimnis', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const res = await callHandler();

    expect(res._status).toBe(503);
  });
});
