/**
 * Der Kursname in beiden Anfrage-Mails muss ein Link zur Kursseite sein.
 *
 * Gemeldet vom Betreiber: In der Mail an den Anbieter und in der Bestaetigung
 * an die anfragende Person stand der Kursname zwar blau hervorgehoben da, war
 * aber nicht anklickbar. Beide mussten den Kurs selbst suchen, um zu sehen,
 * worum es geht.
 *
 * Die URL wird mit buildCanonicalCoursePath() gebaut — demselben Pfad-Bauer,
 * den Sitemap und Kursdetailseite nutzen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockSupabase;
let sentEmails;

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => mockSupabase) }));
vi.mock('resend', () => ({ Resend: class Resend {} }));

vi.mock('../api/_lib/email-config.js', () => ({
  getEmailConfig: () => ({
    from: 'KursNavi <info@test.local>',
    adminEmail: 'admin@test.local',
    supportEmail: 'hilfe@test.local',
  }),
  resolveUserEmail: async (_s, _u, email) => email,
  sendEmailOrThrow: async (_r, tag, payload) => {
    sentEmails.push({ tag, ...payload });
    return { data: { id: 'mail-1' }, error: null };
  },
}));

const COURSE = {
  id: 42,
  title: 'Yoga für Anfänger',
  user_id: 'provider-1',
  booking_type: 'lead',
  category_area: 'yoga_achtsamkeit',
  canton: 'Zürich',
};

/** Erwarteter Pfad laut buildCanonicalCoursePath. */
const ERWARTETER_PFAD = '/courses/yoga-achtsamkeit/zuerich/42-yoga-fuer-anfaenger';

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
          select: () => ({ eq: () => ({ eq: () => ({ gte: async () => ({ count: 0, error: null }) }), gte: async () => ({ count: 0, error: null }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'lead-1' }, error: null }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'lead_message_payloads') return { insert: async () => ({ error: null }) };
      throw new Error(`unerwartete Tabelle: ${table}`);
    },
  };
}

async function anfrageSenden(host = 'kursnavi.ch') {
  vi.resetModules();
  const { default: handler } = await import('../api/send-lead.js');
  const req = {
    method: 'POST',
    headers: { host, 'x-forwarded-proto': 'https' },
    body: { courseId: 42, name: 'Sara Muster', email: 'sara@example.com', message: 'Hallo' },
  };
  const res = makeRes();
  await handler(req, res);
  return res;
}

const mailMit = (tag) => sentEmails.find((m) => m.tag === tag);

beforeEach(() => {
  process.env.LEAD_HASH_SALT = 'test-salt';
  process.env.LEAD_MESSAGE_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.VITE_SITE_URL = 'https://kursnavi.ch';
  sentEmails = [];
  mockSupabase = buildSupabase();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('Mail an den Anbieter', () => {
  it('verlinkt den Kursnamen auf die Kursseite', async () => {
    const res = await anfrageSenden();
    expect(res._status).toBe(200);

    const mail = mailMit('lead-to-provider');
    expect(mail.html).toContain(`href="https://kursnavi.ch${ERWARTETER_PFAD}"`);
    // Der Kursname selbst ist der Linktext.
    expect(mail.html).toMatch(/<a href="https:\/\/kursnavi\.ch\/courses\/[^"]+"[^>]*>Yoga für Anfänger<\/a>/);
  });

  it('der Kursname steht nicht mehr als reiner Text da', async () => {
    await anfrageSenden();
    const mail = mailMit('lead-to-provider');
    expect(mail.html).not.toContain('<strong>Yoga für Anfänger</strong>');
  });
});

describe('Bestaetigung an die anfragende Person', () => {
  it('verlinkt den Kursnamen ebenfalls', async () => {
    await anfrageSenden();

    const mail = mailMit('lead-confirmation-requester');
    expect(mail.html).toContain(`href="https://kursnavi.ch${ERWARTETER_PFAD}"`);
    expect(mail.html).toMatch(/<a href="[^"]+"[^>]*>Yoga für Anfänger<\/a>/);
  });

  it('der Link zeigt nicht auf die Suche, sondern auf den Kurs', async () => {
    await anfrageSenden();
    const mail = mailMit('lead-confirmation-requester');
    // Der Knopf unten fuehrt weiterhin zur Suche — der Kursname aber zum Kurs.
    expect(mail.html).toContain('https://kursnavi.ch/search');
    expect(mail.html).toContain(ERWARTETER_PFAD);
  });
});

describe('Basis-Adresse des Links', () => {
  it('nutzt auf einer Preview die Preview-Adresse', async () => {
    await anfrageSenden('course-marketplace-abc123.vercel.app');

    const mail = mailMit('lead-to-provider');
    expect(mail.html).toContain(`href="https://course-marketplace-abc123.vercel.app${ERWARTETER_PFAD}"`);
  });

  it('faellt bei einem fremden Host auf die konfigurierte Adresse zurueck', async () => {
    // Host-Allowlist aus api/_lib/base-url.js — ein manipulierter Header darf
    // den Link nicht umlenken.
    await anfrageSenden('boese.example.com');

    const mail = mailMit('lead-to-provider');
    expect(mail.html).toContain(`href="https://kursnavi.ch${ERWARTETER_PFAD}"`);
    expect(mail.html).not.toContain('boese.example.com');
  });
});
