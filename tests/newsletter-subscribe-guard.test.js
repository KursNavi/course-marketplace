/**
 * Newsletter-Anmeldung (api/subscribe.js).
 *
 * Zwei gemeldete Probleme, beide hier abgesichert:
 *
 * 1. Eine zweite Anmeldung mit derselben Adresse meldete erneut "erfolgreich
 *    angemeldet". Grund: Mit `updateEnabled: true` antwortet Brevo bei einem
 *    bekannten Kontakt gar nicht mit einem Fehler, sondern mit Erfolg — die
 *    Duplikat-Erkennung lag aber im Fehlerzweig und kam nie zum Zug.
 *
 * 2. Der Endpunkt schrieb aus JEDER Umgebung in dieselbe Live-Liste. Eine
 *    Testanmeldung auf einer Preview landete im echten Verteiler.
 *
 * Dazu Honeypot und eine Kurzzeit-Bremse.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveListTarget } from '../api/subscribe.js';

const LIVE_LISTE = 5;

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

/** Brevo-Attrappe: kennt eine Menge bereits eingetragener Adressen. */
function mockBrevo({ bekannt = new Map(), postStatus = 201, postBody = {} } = {}) {
  const aufrufe = { get: [], post: [] };
  global.fetch = vi.fn(async (url, options = {}) => {
    const u = String(url);
    if (!options.method || options.method === 'GET') {
      const adresse = decodeURIComponent(u.split('/contacts/')[1] || '');
      aufrufe.get.push(adresse);
      if (bekannt.has(adresse)) {
        return { ok: true, status: 200, json: async () => ({ email: adresse, listIds: bekannt.get(adresse) }) };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    }
    aufrufe.post.push(JSON.parse(options.body));
    const ok = postStatus >= 200 && postStatus < 300;
    return { ok, status: postStatus, json: async () => postBody, text: async () => JSON.stringify(postBody) };
  });
  return aufrufe;
}

async function callHandler(body = {}, headers = {}) {
  vi.resetModules();
  const { default: handler } = await import('../api/subscribe.js');
  const req = { method: 'POST', headers, body: { email: 'neu@example.com', ...body } };
  const res = makeRes();
  await handler(req, res);
  return res;
}

// Nur die drei Schluessel sichern und einzeln zuruecksetzen. `process.env`
// komplett zu ersetzen wuerde die Objektreferenz austauschen und andere Tests
// im selben Worker stoeren.
const ENV_KEYS = ['VERCEL_ENV', 'BREVO_API_KEY', 'BREVO_TEST_LIST_ID'];
let envVorher;

beforeEach(() => {
  envVorher = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.VERCEL_ENV = 'production';
  process.env.BREVO_API_KEY = 'test-key';
  delete process.env.BREVO_TEST_LIST_ID;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (envVorher[k] === undefined) delete process.env[k];
    else process.env[k] = envVorher[k];
  }
  vi.restoreAllMocks();
});

describe('Zielliste je Umgebung', () => {
  it('Produktion schreibt in die Live-Liste', () => {
    expect(resolveListTarget({ VERCEL_ENV: 'production' })).toEqual({ schreiben: true, listId: LIVE_LISTE });
  });

  it('Preview fasst die Live-Liste NICHT an', () => {
    expect(resolveListTarget({ VERCEL_ENV: 'preview' })).toEqual({ schreiben: false, listId: null });
  });

  it('lokale Entwicklung fasst die Live-Liste NICHT an', () => {
    expect(resolveListTarget({})).toEqual({ schreiben: false, listId: null });
  });

  it('mit ausdruecklicher Testliste schreibt die Preview dorthin', () => {
    expect(resolveListTarget({ VERCEL_ENV: 'preview', BREVO_TEST_LIST_ID: '9' }))
      .toEqual({ schreiben: true, listId: 9 });
  });
});

describe('Preview schreibt nicht in den echten Verteiler', () => {
  it('meldet Erfolg, ruft Brevo aber gar nicht auf', async () => {
    process.env.VERCEL_ENV = 'preview';
    const aufrufe = mockBrevo();

    const res = await callHandler({ email: 'test@example.com' });

    expect(res._status).toBe(200);
    expect(res._body.simulated).toBe(true);
    expect(aufrufe.get).toHaveLength(0);
    expect(aufrufe.post).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('Duplikat-Erkennung', () => {
  it('meldet eine bereits eingetragene Adresse als "bereits angemeldet"', async () => {
    const aufrufe = mockBrevo({ bekannt: new Map([['schon@example.com', [LIVE_LISTE]]]) });

    const res = await callHandler({ email: 'schon@example.com' });

    expect(res._status).toBe(200);
    expect(res._body.already).toBe(true);
    // Kein erneutes Schreiben noetig.
    expect(aufrufe.post).toHaveLength(0);
  });

  it('traegt eine bekannte Adresse nach, die noch in einer anderen Liste steckt', async () => {
    const aufrufe = mockBrevo({ bekannt: new Map([['woanders@example.com', [99]]]) });

    const res = await callHandler({ email: 'woanders@example.com' });

    expect(res._status).toBe(200);
    expect(res._body.already).toBe(false);
    expect(aufrufe.post).toHaveLength(1);
    expect(aufrufe.post[0].listIds).toEqual([LIVE_LISTE]);
  });

  it('legt eine unbekannte Adresse neu an', async () => {
    const aufrufe = mockBrevo();

    const res = await callHandler({ email: 'neu@example.com' });

    expect(res._status).toBe(200);
    expect(res._body.already).toBe(false);
    expect(aufrufe.post).toHaveLength(1);
  });

  it('faengt auch den Wettlauf zweier paralleler Anmeldungen ab', async () => {
    mockBrevo({ postStatus: 400, postBody: { code: 'duplicate_parameter', message: 'Contact already exist' } });

    const res = await callHandler({ email: 'gleichzeitig@example.com' });

    expect(res._status).toBe(200);
    expect(res._body.already).toBe(true);
  });
});

describe('Honeypot und Eingabepruefung', () => {
  it('meldet still Erfolg und ruft Brevo nicht auf', async () => {
    const aufrufe = mockBrevo();

    const res = await callHandler({ _company: 'Bot GmbH' });

    expect(res._status).toBe(200);
    expect(aufrufe.post).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['ohne @', 'keine-adresse'],
    ['leer', ''],
    ['ohne Punkt', 'a@b'],
  ])('weist eine Adresse %s ab', async (_label, email) => {
    mockBrevo();
    const res = await callHandler({ email });
    expect(res._status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('Fehler von Brevo bleiben im Log', () => {
  it('gibt weder Code noch Originaltext an den Browser', async () => {
    mockBrevo({ postStatus: 500, postBody: { code: 'internal_list_9999', message: 'list 5 quota exceeded' } });

    const res = await callHandler({ email: 'neu@example.com' });

    expect(res._status).toBe(502);
    const antwort = JSON.stringify(res._body);
    expect(antwort).not.toContain('internal_list_9999');
    expect(antwort).not.toContain('quota');
  });
});

describe('Kurzzeit-Bremse', () => {
  it('weist einen Schwall von derselben IP ab', async () => {
    mockBrevo();
    const kopf = { 'x-forwarded-for': '203.0.113.42' };

    // Der Handler wird pro Aufruf frisch importiert; damit der Zaehler
    // erhalten bleibt, wird hier EINMAL importiert und mehrfach gerufen.
    vi.resetModules();
    const { default: handler } = await import('../api/subscribe.js');

    const status = [];
    for (let i = 0; i < 7; i += 1) {
      const res = makeRes();
      await handler({ method: 'POST', headers: kopf, body: { email: `n${i}@example.com` } }, res);
      status.push(res._status);
    }

    expect(status.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(status.at(-1)).toBe(429);
  });
});
