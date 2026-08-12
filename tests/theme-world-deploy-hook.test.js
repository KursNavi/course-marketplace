/**
 * Unit-Tests für den Deploy-Hook-Helfer.
 * Alle Tests verwenden gemocktes fetch — kein echter HTTP-Request.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerDeployHook, isDeployEnabled, DEPLOY_STATUS } from '../api/_lib/deploy-hook.js';

describe('triggerDeployHook', () => {
  const VALID_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/abc123';

  beforeEach(() => {
    // Umgebungsvariablen vor jedem Test zurücksetzen
    delete process.env.VERCEL_DEPLOY_HOOK_URL;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // Nicht konfiguriert
  // ============================================================

  it('gibt not_configured zurück wenn VERCEL_DEPLOY_HOOK_URL fehlt', async () => {
    const result = await triggerDeployHook();
    expect(result.status).toBe(DEPLOY_STATUS.NOT_CONFIGURED);
  });

  it('gibt not_configured zurück wenn URL leer ist', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = '';
    const result = await triggerDeployHook();
    expect(result.status).toBe(DEPLOY_STATUS.NOT_CONFIGURED);
  });

  it('gibt not_configured zurück wenn URL kein https ist', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'http://insecure.example.com/hook';
    const result = await triggerDeployHook();
    expect(result.status).toBe(DEPLOY_STATUS.NOT_CONFIGURED);
  });

  // ============================================================
  // Erfolgreicher Request
  // ============================================================

  it('gibt requested zurück bei erfolgreichem HTTP 200', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const result = await triggerDeployHook();

    expect(result.status).toBe(DEPLOY_STATUS.REQUESTED);
  });

  it('verwendet POST-Methode', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    let capturedOptions;
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (url, opts) => {
      capturedOptions = opts;
      return { ok: true, status: 200 };
    });

    await triggerDeployHook();

    expect(capturedOptions.method).toBe('POST');
  });

  it('sendet die Hook-URL korrekt', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    let capturedUrl;
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200 };
    });

    await triggerDeployHook();

    expect(capturedUrl).toBe(VALID_HOOK_URL);
  });

  // ============================================================
  // HTTP-Fehler
  // ============================================================

  it('gibt failed zurück bei HTTP 4xx', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await triggerDeployHook();

    expect(result.status).toBe(DEPLOY_STATUS.FAILED);
    expect(result.httpStatus).toBe(404);
  });

  it('gibt failed zurück bei HTTP 5xx', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const result = await triggerDeployHook();

    expect(result.status).toBe(DEPLOY_STATUS.FAILED);
    expect(result.httpStatus).toBe(503);
  });

  // ============================================================
  // Timeout
  // ============================================================

  it('gibt failed mit reason=timeout zurück bei Timeout', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockImplementationOnce(() => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    const result = await triggerDeployHook({ timeoutMs: 10 });

    expect(result.status).toBe(DEPLOY_STATUS.FAILED);
    expect(result.reason).toBe('timeout');
  });

  // ============================================================
  // Netzwerkfehler
  // ============================================================

  it('gibt failed mit reason=network_error zurück bei Netzwerkfehler', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await triggerDeployHook();

    expect(result.status).toBe(DEPLOY_STATUS.FAILED);
    expect(result.reason).toBe('network_error');
  });

  // ============================================================
  // Sicherheit: Secret darf nicht in Ergebnissen erscheinen
  // ============================================================

  it('enthält die Hook-URL nicht im Rückgabewert (failed)', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    const result = await triggerDeployHook();
    const resultStr = JSON.stringify(result);

    expect(resultStr).not.toContain(VALID_HOOK_URL);
    expect(resultStr).not.toContain('vercel.com');
    expect(resultStr).not.toContain('abc123');
  });

  it('enthält die Hook-URL nicht im Rückgabewert (network_error)', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network fail'));

    const result = await triggerDeployHook();
    const resultStr = JSON.stringify(result);

    expect(resultStr).not.toContain(VALID_HOOK_URL);
  });

  it('enthält die Hook-URL nicht im Rückgabewert (requested)', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = VALID_HOOK_URL;

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await triggerDeployHook();
    const resultStr = JSON.stringify(result);

    expect(resultStr).not.toContain(VALID_HOOK_URL);
  });
});

// ============================================================
// isDeployEnabled
// ============================================================

describe('isDeployEnabled', () => {
  afterEach(() => {
    delete process.env.THEME_WORLD_DEPLOY_ENABLED;
  });

  it('gibt false zurück wenn THEME_WORLD_DEPLOY_ENABLED nicht gesetzt', () => {
    expect(isDeployEnabled()).toBe(false);
  });

  it('gibt false zurück wenn THEME_WORLD_DEPLOY_ENABLED=false', () => {
    process.env.THEME_WORLD_DEPLOY_ENABLED = 'false';
    expect(isDeployEnabled()).toBe(false);
  });

  it('gibt true zurück wenn THEME_WORLD_DEPLOY_ENABLED=true', () => {
    process.env.THEME_WORLD_DEPLOY_ENABLED = 'true';
    expect(isDeployEnabled()).toBe(true);
  });
});

// ============================================================
// DEPLOY_STATUS Konstanten
// ============================================================

describe('DEPLOY_STATUS Konstanten', () => {
  it('enthält die drei erwarteten Status', () => {
    expect(DEPLOY_STATUS.NOT_CONFIGURED).toBe('not_configured');
    expect(DEPLOY_STATUS.REQUESTED).toBe('requested');
    expect(DEPLOY_STATUS.FAILED).toBe('failed');
  });
});
