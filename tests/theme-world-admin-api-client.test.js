/**
 * Tests für den Admin-API-Client (themeWorldAdminApi.js).
 *
 * Geprüft wird:
 *   - Auth-Token wird gesetzt (Authorization: Bearer <token>)
 *   - 401 Fehler (keine Session / abgelaufen)
 *   - 403 Fehler (kein Admin-Zugriff)
 *   - 409 Konflikt (z.B. Slug doppelt)
 *   - 422 Publish-Gate (Pflichtfelder fehlen)
 *   - Netzwerkfehler (fetch wirft)
 *   - Timeout (AbortError)
 *   - Keine Secrets in Fehlermeldungen
 *   - getErrorMessage — alle Pfade
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase-Modul mocken (muss VOR dem Import von themeWorldAdminApi geschehen)
// vi.hoisted() stellt sicher, dass mockGetSession vor dem gehosteten vi.mock verfügbar ist.
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

import {
  ApiError,
  getErrorMessage,
  listThemeWorlds,
  getThemeWorld,
  createThemeWorld,
  updateThemeWorld,
  archiveThemeWorld,
  publishThemeWorld,
  listScenarios,
  getScenario,
  createScenario,
} from '../src/lib/themeWorldAdminApi.js';

// ---------------------------------------------------------------------------
// Hilfsfunktionen für Test-Setup
// ---------------------------------------------------------------------------

const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
const FAKE_ID = '11111111-2222-3333-4444-555555555555';

/** Simuliert eine gültige Supabase-Session */
function mockValidSession(token = FAKE_TOKEN) {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: token } },
  });
}

/** Simuliert eine fehlende Session (nicht angemeldet) */
function mockNoSession() {
  mockGetSession.mockResolvedValue({
    data: { session: null },
  });
}

/** Erstellt eine Mock-fetch-Response */
function mockFetchResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  });
}

/** Erstellt eine Mock-fetch-Response mit Nicht-JSON-Body */
function mockFetchTextResponse(status, text) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'text/plain' },
    text: () => Promise.resolve(text),
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let fetchSpy;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = vi.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// ApiError Klasse
// ---------------------------------------------------------------------------

describe('ApiError — Konstruktor und Getter', () => {
  it('hat korrekte Status-Getter', () => {
    expect(new ApiError('msg', 401).isUnauthorized).toBe(true);
    expect(new ApiError('msg', 403).isForbidden).toBe(true);
    expect(new ApiError('msg', 409).isConflict).toBe(true);
    expect(new ApiError('msg', 422).isUnprocessable).toBe(true);
    expect(new ApiError('msg', 500).isServerError).toBe(true);
    expect(new ApiError('msg', 503).isServerError).toBe(true);
  });

  it('hat korrekte Reason-Getter', () => {
    const timeout = new ApiError('msg', 0, null, 'timeout');
    const network = new ApiError('msg', 0, null, 'network_error');
    expect(timeout.isTimeout).toBe(true);
    expect(timeout.isNetworkError).toBe(false);
    expect(network.isNetworkError).toBe(true);
    expect(network.isTimeout).toBe(false);
  });

  it('speichert details-Array', () => {
    const err = new ApiError('msg', 422, ['Feld A fehlt', 'Feld B fehlt']);
    expect(err.details).toEqual(['Feld A fehlt', 'Feld B fehlt']);
  });

  it('hat name ApiError', () => {
    expect(new ApiError('msg', 400).name).toBe('ApiError');
  });

  it('enthält keine Server-Secrets im message-Feld', () => {
    // Secrets wären z.B. SERVICE_ROLE_KEY oder DB-Passwörter
    const err = new ApiError('HTTP 500', 500);
    expect(err.message).not.toContain('service_role');
    expect(err.message).not.toContain('postgres://');
    expect(err.message).not.toContain('password');
  });
});

// ---------------------------------------------------------------------------
// Auth-Token wird gesetzt
// ---------------------------------------------------------------------------

describe('apiCall — Auth-Token in Anfrage-Header', () => {
  it('setzt Authorization: Bearer <token> aus der Supabase-Session', async () => {
    mockValidSession('my-test-token-abc123');
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: [] }));

    await listThemeWorlds();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer my-test-token-abc123');
  });

  it('setzt Content-Type: application/json', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: [] }));

    await listThemeWorlds();

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('serialisiert body als JSON bei POST-Requests', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: { id: FAKE_ID } }));

    await createThemeWorld({ key: 'test', title_de: 'Test' });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ key: 'test', title_de: 'Test' }));
  });
});

// ---------------------------------------------------------------------------
// 401 — Keine Session
// ---------------------------------------------------------------------------

describe('apiCall — 401 Unauthorized', () => {
  it('wirft ApiError(401) wenn keine Session vorhanden', async () => {
    mockNoSession();

    await expect(listThemeWorlds()).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.isUnauthorized;
    });
    // fetch soll nicht aufgerufen werden — Token-Check scheitert vorher
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('wirft ApiError(401) wenn Server 401 zurückgibt', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(401, { error: 'Session abgelaufen.' }));

    await expect(listThemeWorlds()).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.status === 401 && err.isUnauthorized;
    });
  });

  it('isUnauthorized gibt false zurück für 403', () => {
    expect(new ApiError('msg', 403).isUnauthorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 403 — Kein Admin-Zugriff
// ---------------------------------------------------------------------------

describe('apiCall — 403 Forbidden', () => {
  it('wirft ApiError(403) bei Server-Response 403', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchResponse(403, { error: 'Kein Admin-Zugriff.' }));

    await expect(getThemeWorld(FAKE_ID)).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.isForbidden && err.status === 403;
    });
  });

  it('isForbidden gibt false zurück für 401', () => {
    expect(new ApiError('msg', 401).isForbidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 409 — Konflikt
// ---------------------------------------------------------------------------

describe('apiCall — 409 Conflict', () => {
  it('wirft ApiError(409) bei Slug-Konflikt', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(
      mockFetchResponse(409, { error: 'Slug bereits vergeben.' }),
    );

    await expect(createThemeWorld({ key: 'test' })).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.isConflict && err.status === 409;
    });
  });

  it('ApiError(409) enthält die Fehlermeldung vom Server', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(
      mockFetchResponse(409, { error: 'Dieser Slug ist bereits vergeben.' }),
    );

    const err = await listThemeWorlds().catch((e) => e);
    // 200 würde passen, aber wir wollen 409
    const err409 = await createThemeWorld({}).catch((e) => e);
    expect(err409.message).toContain('Slug');
  });
});

// ---------------------------------------------------------------------------
// 422 — Publish-Gate / Validierungsfehler
// ---------------------------------------------------------------------------

describe('apiCall — 422 Unprocessable', () => {
  it('wirft ApiError(422) bei fehlenden Pflichtfeldern', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(
      mockFetchResponse(422, {
        error: 'Pflichtfelder fehlen.',
        details: ['title_de', 'slug'],
      }),
    );

    await expect(publishThemeWorld(FAKE_ID)).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.isUnprocessable && err.status === 422;
    });
  });

  it('ApiError(422) speichert details-Array', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(
      mockFetchResponse(422, {
        error: 'Pflichtfelder fehlen.',
        details: ['title_de', 'slug', 'hero_image_url'],
      }),
    );

    const err = await publishThemeWorld(FAKE_ID).catch((e) => e);
    expect(err.details).toEqual(['title_de', 'slug', 'hero_image_url']);
  });
});

// ---------------------------------------------------------------------------
// 500 — Serverfehler
// ---------------------------------------------------------------------------

describe('apiCall — 500 Server Error', () => {
  it('wirft ApiError(500) bei internem Serverfehler', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(
      mockFetchResponse(500, { error: 'Interner Fehler.' }),
    );

    await expect(listThemeWorlds()).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.isServerError && err.status === 500;
    });
  });

  it('isServerError gilt ab Status 500', () => {
    expect(new ApiError('msg', 500).isServerError).toBe(true);
    expect(new ApiError('msg', 502).isServerError).toBe(true);
    expect(new ApiError('msg', 503).isServerError).toBe(true);
    expect(new ApiError('msg', 499).isServerError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Netzwerkfehler
// ---------------------------------------------------------------------------

describe('apiCall — Netzwerkfehler', () => {
  it('wirft ApiError mit reason=network_error wenn fetch wirft', async () => {
    mockValidSession();
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(listThemeWorlds()).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.isNetworkError && err.status === 0;
    });
  });

  it('Netzwerkfehler enthält keine internen Details', async () => {
    mockValidSession();
    fetchSpy.mockRejectedValue(new TypeError('Network connection refused at 192.168.1.1:5432'));

    const err = await listThemeWorlds().catch((e) => e);
    // Die Fehlermeldung soll benutzerfreundlich sein, nicht den internen Fehler durchreichen
    expect(err.message).not.toContain('192.168.1.1');
    expect(err.message).not.toContain('5432');
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('apiCall — Timeout', () => {
  it('wirft ApiError mit reason=timeout bei AbortError', async () => {
    mockValidSession();
    // fetch wirft AbortError (wie bei AbortController.abort())
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchSpy.mockRejectedValue(abortError);

    await expect(listThemeWorlds()).rejects.toSatisfy((err) => {
      return err instanceof ApiError && err.isTimeout && err.status === 0;
    });
  });

  it('Timeout enthält keine internen Details', async () => {
    mockValidSession();
    const abortError = new Error('AbortError with internal path /var/task/api/admin.js:42');
    abortError.name = 'AbortError';
    fetchSpy.mockRejectedValue(abortError);

    const err = await listThemeWorlds().catch((e) => e);
    expect(err.message).not.toContain('/var/task');
  });
});

// ---------------------------------------------------------------------------
// Keine Secrets in Fehlermeldungen
// ---------------------------------------------------------------------------

describe('Keine Secrets in ApiError-Meldungen', () => {
  const SECRET_PATTERNS = [
    'service_role',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // JWT-Präfix
    'postgres://',
    'password',
    'DATABASE_URL',
    'SUPABASE_SERVICE_ROLE',
  ];

  it('enthält keine bekannten Secret-Patterns in normalen Fehlern', () => {
    const errors = [
      new ApiError('HTTP 401', 401),
      new ApiError('HTTP 403', 403),
      new ApiError('Netzwerkfehler.', 0, null, 'network_error'),
      new ApiError('Timeout.', 0, null, 'timeout'),
      new ApiError('HTTP 500', 500),
    ];

    for (const err of errors) {
      for (const pattern of SECRET_PATTERNS) {
        expect(err.message).not.toContain(pattern);
        if (err.details) expect(err.details).not.toContain(pattern);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getErrorMessage — alle Pfade
// ---------------------------------------------------------------------------

describe('getErrorMessage — Benutzerfreundliche Fehlertexte', () => {
  it('401 → Session abgelaufen', () => {
    const msg = getErrorMessage(new ApiError('Nicht angemeldet.', 401));
    expect(msg).toContain('Sitzung');
  });

  it('403 → Admin-Zugriff erforderlich', () => {
    const msg = getErrorMessage(new ApiError('Forbidden', 403));
    expect(msg).toContain('Admin');
  });

  it('409 → Konflikt-Nachricht vom Server durchreichen', () => {
    const msg = getErrorMessage(new ApiError('Slug bereits vergeben.', 409));
    expect(msg).toContain('Slug');
  });

  it('422 ohne details → Pflichtfelder-Hinweis', () => {
    const msg = getErrorMessage(new ApiError('Pflichtfelder fehlen.', 422));
    expect(msg).toContain('Pflichtfelder');
  });

  it('422 mit details → Feldnamen in Meldung', () => {
    const msg = getErrorMessage(new ApiError('Fehler', 422, ['title_de', 'slug']));
    expect(msg).toContain('title_de');
    expect(msg).toContain('slug');
  });

  it('timeout → Zeitlimit-Hinweis', () => {
    const msg = getErrorMessage(new ApiError('Timeout.', 0, null, 'timeout'));
    expect(msg).toContain('Zeitlimit');
  });

  it('network_error → Verbindungshinweis', () => {
    const msg = getErrorMessage(new ApiError('Netzwerkfehler.', 0, null, 'network_error'));
    expect(msg).toContain('Verbindung');
  });

  it('500 → Server-Fehler-Hinweis', () => {
    const msg = getErrorMessage(new ApiError('Internal Server Error', 500));
    expect(msg).toContain('Server');
  });

  it('unbekannter Error → defaultMessage', () => {
    const msg = getErrorMessage(new Error('Unbekannt'), 'Standardfehler');
    expect(msg).toBe('Unbekannt');
  });

  it('null/undefined → defaultMessage', () => {
    expect(getErrorMessage(null)).toBe('Ein Fehler ist aufgetreten.');
    expect(getErrorMessage(undefined, 'Fallback')).toBe('Fallback');
  });
});

// ---------------------------------------------------------------------------
// Erfolgreiche API-Calls
// ---------------------------------------------------------------------------

describe('API-Funktionen — Erfolgreiche Aufrufe', () => {
  beforeEach(() => {
    mockValidSession();
  });

  it('listThemeWorlds gibt data-Array zurück', async () => {
    fetchSpy.mockReturnValue(
      mockFetchResponse(200, { data: [{ id: FAKE_ID, status: 'draft' }] }),
    );

    const result = await listThemeWorlds();
    expect(result).toEqual([{ id: FAKE_ID, status: 'draft' }]);
  });

  it('listThemeWorlds gibt leeres Array zurück wenn data null', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: null }));
    const result = await listThemeWorlds();
    expect(result).toEqual([]);
  });

  it('getThemeWorld gibt data-Objekt zurück', async () => {
    const tw = { id: FAKE_ID, key: 'test', status: 'draft' };
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: tw }));

    const result = await getThemeWorld(FAKE_ID);
    expect(result).toEqual(tw);
  });

  it('getThemeWorld kodiert die ID in der URL', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse(200, { data: {} }));
    await getThemeWorld(FAKE_ID);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain(encodeURIComponent(FAKE_ID));
  });

  it('createThemeWorld gibt data mit id zurück', async () => {
    fetchSpy.mockReturnValue(
      mockFetchResponse(200, { data: { id: FAKE_ID, status: 'draft' } }),
    );

    const result = await createThemeWorld({ key: 'neue-welt', title_de: 'Neue Welt' });
    expect(result.id).toBe(FAKE_ID);
    expect(result.status).toBe('draft');
  });

  it('listScenarios gibt data-Array zurück', async () => {
    fetchSpy.mockReturnValue(
      mockFetchResponse(200, { data: [{ id: '1', label_de: 'Szenario 1' }] }),
    );

    const result = await listScenarios(FAKE_ID);
    expect(result).toHaveLength(1);
    expect(result[0].label_de).toBe('Szenario 1');
  });

  it('createScenario übergibt themeWorldId korrekt', async () => {
    fetchSpy.mockReturnValue(
      mockFetchResponse(200, { data: { id: 'new-scenario-id', status: 'draft' } }),
    );

    await createScenario(FAKE_ID, { label_de: 'Test', slug: 'test' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain(encodeURIComponent(FAKE_ID));
  });
});

// ---------------------------------------------------------------------------
// Non-JSON Response
// ---------------------------------------------------------------------------

describe('apiCall — Non-JSON Response', () => {
  it('behandelt Text-Response als { message: text }', async () => {
    mockValidSession();
    fetchSpy.mockReturnValue(mockFetchTextResponse(200, 'OK'));

    // listThemeWorlds greift auf result.data zu → bei {message:'OK'} ist result.data undefined → []
    const result = await listThemeWorlds();
    expect(result).toEqual([]);
  });
});
