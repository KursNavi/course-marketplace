import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildLeadActionUrl,
  createLeadActionToken,
  verifyLeadActionToken,
} from '../api/_lib/lead-action-token.js';

let updateValues;
let selectedLeadId;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => {
      if (table !== 'leads') throw new Error(`Unexpected table: ${table}`);
      return {
        update: (values) => {
          updateValues = values;
          return {
            eq: (_column, leadId) => {
              selectedLeadId = leadId;
              return {
                select: () => ({
                  single: async () => ({ data: { id: leadId, response_status: values.response_status }, error: null }),
                }),
              };
            },
          };
        },
      };
    },
  }),
}));

function makeResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
  };
}

const SECRET = 'lead-action-test-secret';
const LEAD_ID = 'f3e2a7d0-3304-4e71-9cc1-e31fb4cab455';

beforeEach(() => {
  process.env.LEAD_ACTION_SECRET = SECRET;
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  updateValues = null;
  selectedLeadId = null;
});

afterEach(() => {
  delete process.env.LEAD_ACTION_SECRET;
});

describe('signed lead actions', () => {
  it('creates verifiable, expiring links', () => {
    const expiresAt = Date.now() + 60000;
    const url = buildLeadActionUrl({
      baseUrl: 'https://kursnavi.ch', leadId: LEAD_ID, action: 'qualified', secret: SECRET, expiresAt,
    });
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/lead-action');
    expect(verifyLeadActionToken({
      leadId: LEAD_ID,
      action: 'qualified',
      expiresAt,
      token: parsed.searchParams.get('token'),
      secret: SECRET,
    })).toBe(true);
    expect(verifyLeadActionToken({
      leadId: LEAD_ID,
      action: 'qualified',
      expiresAt,
      token: parsed.searchParams.get('token'),
      secret: SECRET,
      now: expiresAt + 1,
    })).toBe(false);
  });

  it('shows a confirmation page on GET without changing data', async () => {
    const { default: handler } = await import('../api/lead-action.js');
    const expiresAt = Date.now() + 60000;
    const token = createLeadActionToken({ leadId: LEAD_ID, action: 'acknowledged', expiresAt, secret: SECRET });
    const res = makeResponse();

    await handler({ method: 'GET', query: { lead: LEAD_ID, action: 'acknowledged', expires: String(expiresAt), token } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Status bestätigen');
    expect(updateValues).toBeNull();
  });

  it('stores a confirmed provider response on POST', async () => {
    const { default: handler } = await import('../api/lead-action.js');
    const expiresAt = Date.now() + 60000;
    const token = createLeadActionToken({ leadId: LEAD_ID, action: 'contacted', expiresAt, secret: SECRET });
    const res = makeResponse();

    await handler({ method: 'POST', body: { lead: LEAD_ID, action: 'contacted', expires: String(expiresAt), token } }, res);

    expect(res.statusCode).toBe(200);
    expect(selectedLeadId).toBe(LEAD_ID);
    expect(updateValues.response_status).toBe('contacted');
    expect(updateValues.acknowledged_at).toBeTruthy();
    expect(updateValues.contacted_at).toBeTruthy();
  });
});
