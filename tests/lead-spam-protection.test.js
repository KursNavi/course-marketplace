/**
 * Missbrauchsschutz des Anfrageformulars (api/send-lead.js).
 *
 * Drei Luecken aus der Plattform-Durchsicht:
 *
 * 1. Keine serverseitige Formatpruefung der Absenderadresse. Ein direkter POST
 *    mit "abc" legte einen Lead an; der Versand scheiterte danach bei Resend,
 *    und der Aufrufer bekam einen 500er statt einer klaren Rueckmeldung. Der
 *    Lead blieb als 'failed' liegen und verfaelschte die Leadstatistik.
 *
 * 2. Kein Honeypot — obwohl api/contact.js einen hat.
 *
 * 3. Das Rate-Limit griff nur pro Adresse UND Kurs, und es war fail-open:
 *    `if (!rlError && ...)`. Mit wechselnder Absenderadresse liess sich ein
 *    Anbieter unbegrenzt zuspammen, und bei einer gestoerten Zaehlabfrage war
 *    gar kein Limit mehr aktiv.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockSupabase;
let insertedLeads;
let emailCountResult;
let ipCountResult;
let sentEmails;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('resend', () => ({ Resend: class Resend {} }));

vi.mock('../api/_lib/email-config.js', () => ({
  getEmailConfig: () => ({ from: 'KursNavi <info@test.local>', adminEmail: 'admin@test.local', supportEmail: 'hilfe@test.local' }),
  resolveUserEmail: async (_s, _u, email) => email,
  sendEmailOrThrow: async (_r, _tag, payload) => {
    sentEmails.push(payload);
    return { data: { id: 'mail-1' }, error: null };
  },
}));

const COURSE = {
  id: 42,
  title: 'Yoga für Anfänger',
  user_id: 'provider-1',
  booking_type: 'lead',
  category_area: 'Yoga & Achtsamkeit',
  canton: 'Zürich',
};

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

/**
 * Attrappe, die beide Abfrageformen kennt:
 *   select().eq().eq().gte()  — Limit pro Adresse und Kurs
 *   select().eq().gte()       — Limit pro IP
 */
function buildSupabase() {
  return {
    from(table) {
      if (table === 'courses') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: COURSE, error: null }) }) }) };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { email: 'anbieter@test.local', lead_email: null, package_tier: 'pro' }, error: null }) }),
          }),
        };
      }
      if (table === 'leads') {
        return {
          select: () => ({
            eq: () => ({
              // Zweites .eq() => Adresse+Kurs. Direktes .gte() => IP.
              eq: () => ({ gte: async () => emailCountResult }),
              gte: async () => ipCountResult,
            }),
          }),
          insert: (values) => {
            insertedLeads.push(values);
            return { select: () => ({ single: async () => ({ data: { id: 'lead-1' }, error: null }) }) };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'lead_message_payloads') {
        return { insert: async () => ({ error: null }) };
      }
      throw new Error(`unerwartete Tabelle: ${table}`);
    },
  };
}

async function callHandler(body = {}, headers = {}) {
  vi.resetModules();
  const { default: handler } = await import('../api/send-lead.js');
  const req = {
    method: 'POST',
    headers,
    body: { courseId: 42, name: 'Sara Muster', email: 'sara@example.com', message: 'Hallo', ...body },
  };
  const res = makeRes();
  await handler(req, res);
  return res;
}

beforeEach(() => {
  process.env.LEAD_HASH_SALT = 'test-salt';
  process.env.LEAD_MESSAGE_KEY = Buffer.alloc(32, 7).toString('base64');
  insertedLeads = [];
  sentEmails = [];
  emailCountResult = { count: 0, error: null };
  ipCountResult = { count: 0, error: null };
  mockSupabase = buildSupabase();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('Formatpruefung der Absenderadresse', () => {
  it.each([
    ['ohne @', 'keine-adresse'],
    ['ohne Punkt', 'sara@example'],
    ['mit Leerzeichen', 'sa ra@example.com'],
    ['nur Leerzeichen', '   '],
  ])('weist eine Adresse %s mit 400 ab', async (_label, email) => {
    const res = await callHandler({ email });
    expect(res._status).toBe(400);
    // Entscheidend: kein Lead, keine E-Mail.
    expect(insertedLeads).toHaveLength(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('laesst eine gueltige Adresse durch', async () => {
    const res = await callHandler({ email: 'Sara@Example.COM' });
    expect(res._status).toBe(200);
    expect(insertedLeads).toHaveLength(1);
  });
});

describe('Honeypot', () => {
  it('meldet still Erfolg und legt nichts an', async () => {
    const res = await callHandler({ _company: 'Bot GmbH' });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ success: true });
    expect(insertedLeads).toHaveLength(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('ein leeres Honeypot-Feld stoert nicht', async () => {
    const res = await callHandler({ _company: '' });
    expect(res._status).toBe(200);
    expect(insertedLeads).toHaveLength(1);
  });
});

describe('Rate-Limit pro Adresse und Kurs', () => {
  it('weist eine Wiederholung im Zeitfenster ab', async () => {
    emailCountResult = { count: 1, error: null };
    const res = await callHandler();
    expect(res._status).toBe(429);
    expect(insertedLeads).toHaveLength(0);
  });

  it('ist fail-closed: gestoerte Zaehlabfrage weist ab statt durchzulassen', async () => {
    emailCountResult = { count: null, error: { message: 'connection reset' } };
    const res = await callHandler();
    expect(res._status).toBe(429);
    expect(insertedLeads).toHaveLength(0);
  });
});

describe('Rate-Limit pro Absender-IP', () => {
  const MIT_IP = { 'x-forwarded-for': '203.0.113.9' };

  it('weist ab, sobald das Stundenlimit erreicht ist', async () => {
    ipCountResult = { count: 8, error: null };
    const res = await callHandler({}, MIT_IP);
    expect(res._status).toBe(429);
    expect(insertedLeads).toHaveLength(0);
  });

  it('laesst normalen Gebrauch durch', async () => {
    ipCountResult = { count: 2, error: null };
    const res = await callHandler({}, MIT_IP);
    expect(res._status).toBe(200);
    expect(insertedLeads).toHaveLength(1);
  });

  it('nimmt die erste Adresse aus einer Proxy-Kette', async () => {
    ipCountResult = { count: 8, error: null };
    const res = await callHandler({}, { 'x-forwarded-for': '203.0.113.9, 70.41.3.18' });
    expect(res._status).toBe(429);
  });

  it('speichert einen Hash der IP, nie die IP selbst', async () => {
    const res = await callHandler({}, MIT_IP);
    expect(res._status).toBe(200);
    const gespeichert = JSON.stringify(insertedLeads[0]);
    expect(gespeichert).not.toContain('203.0.113.9');
    expect(insertedLeads[0].requester_ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ohne Migration bleibt das Formular benutzbar', async () => {
    // Solange die Spalte fehlt, meldet Supabase einen Fehler. Diese Stufe darf
    // die Anfrage dann NICHT abweisen — sonst faellt das Formular ganz aus.
    ipCountResult = { count: null, error: { message: 'column leads.requester_ip_hash does not exist' } };
    const res = await callHandler({}, MIT_IP);
    expect(res._status).toBe(200);
    expect(insertedLeads).toHaveLength(1);
  });

  it('ohne IP im Request wird die Stufe uebersprungen', async () => {
    ipCountResult = { count: 99, error: null };
    const res = await callHandler({}, {});
    expect(res._status).toBe(200);
  });
});
