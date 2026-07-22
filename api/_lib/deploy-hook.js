/**
 * Sichere Deploy-Hook-Hilfsfunktion für das Themenwelten-System.
 *
 * Löst einen Vercel Deploy Hook aus, um nach Publish/Unpublish einen
 * neuen Build und Prerender anzustossen.
 *
 * Sicherheitsregeln (verbindlich):
 *   - Hook-URL kommt ausschliesslich aus VERCEL_DEPLOY_HOOK_URL
 *   - URL wird NIEMALS an den Browser gesendet
 *   - URL wird NIEMALS in Logs ausgegeben
 *   - Secrets erscheinen NIEMALS in Fehlerantworten
 *   - «requested» bedeutet nur: HTTP-Request akzeptiert — kein Nachweis
 *     für fertigen Build oder erfolgreichen Deploy
 *
 * Phase-3-Einschränkung:
 *   - Diese Funktion ist implementiert, aber wird in Phase 3 NICHT
 *     automatisch aufgerufen. Der Aufruf in API-Endpunkten ist hinter
 *     der Umgebungsvariable THEME_WORLD_DEPLOY_ENABLED=true gesperrt.
 *   - Echte Deploy-Requests werden erst nach vollständiger Phase-4-Abnahme
 *     aktiviert.
 */

/** Rückgabe-Statuskonstanten */
export const DEPLOY_STATUS = {
  NOT_CONFIGURED: 'not_configured',
  REQUESTED: 'requested',
  FAILED: 'failed',
};

/**
 * Löst den Vercel Deploy Hook aus.
 *
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=5000] - Request-Timeout in Millisekunden
 * @returns {Promise<{status: string, httpStatus?: number, reason?: string}>}
 *   status: 'not_configured' | 'requested' | 'failed'
 *   httpStatus: HTTP-Statuscode des Hook-Response (nur bei status='failed')
 *   reason: 'timeout' | 'network_error' (nur bei status='failed')
 */
export async function triggerDeployHook(opts = {}) {
  const url = process.env.VERCEL_DEPLOY_HOOK_URL;

  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    // Fehlende oder ungültige URL ist in Entwicklung erlaubt.
    // Produktion sollte VERCEL_DEPLOY_HOOK_URL konfiguriert haben.
    if (process.env.NODE_ENV === 'production') {
      console.warn('[deploy-hook] WARNUNG: VERCEL_DEPLOY_HOOK_URL ist nicht konfiguriert.');
    }
    return { status: DEPLOY_STATUS.NOT_CONFIGURED };
  }

  const timeoutMs = opts.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      // Kein Body nötig — Vercel Deploy Hooks reagieren auf leere POST-Requests
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // HTTP-Fehler: URL nie loggen, nur Statuscode
      console.warn(`[deploy-hook] Hook-Request fehlgeschlagen. HTTP ${response.status}`);
      return { status: DEPLOY_STATUS.FAILED, httpStatus: response.status };
    }

    // Erfolgreicher Request: bedeutet «Deploy angefordert», nicht «Deploy abgeschlossen»
    return { status: DEPLOY_STATUS.REQUESTED };

  } catch (err) {
    clearTimeout(timeoutId);

    const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';

    // URL nie in Logs ausgeben
    console.warn(`[deploy-hook] Hook-Request konnte nicht gesendet werden: ${reason}`);

    return { status: DEPLOY_STATUS.FAILED, reason };
  }
}

/**
 * Prüft, ob Deploy-Hooks für Phase 3 aktiviert sind.
 * In Phase 3 NICHT gesetzt, damit kein echter Deploy ausgelöst wird.
 *
 * @returns {boolean}
 */
export function isDeployEnabled() {
  return process.env.THEME_WORLD_DEPLOY_ENABLED === 'true';
}
