/**
 * Gemeinsamer Deploy-Lifecycle des Themenwelten-Systems.
 *
 * Produktinvariante:
 *   Jede Änderung der öffentlichen EXISTENZ einer Themenwelt oder eines
 *   Szenarios muss einen neuen Vercel-Build anfordern. Der Build ist die
 *   einzige Stelle, an der
 *     - /thema/-Prerendering und /thema/ → /bereich/-Redirects,
 *     - die statischen /bereich/-HTML-Dateien und
 *     - damit die 404-Entscheidung aus api/resource-not-found.js
 *   synchronisiert werden. Ohne Build zeigt eine zurückgezogene Ressource
 *   weiterhin ihr altes indexierbares HTML, und eine frisch publizierte
 *   Ressource antwortet weiterhin mit 404.
 *
 * Diese Logik lag ursprünglich nur in api/admin-theme-worlds.js. Sie ist hier
 * unverändert extrahiert, damit api/admin-theme-world-scenarios.js exakt
 * denselben Lifecycle nutzt statt einer zweiten Kopie.
 *
 * Der Deploy-Status wird immer auf der Themenwelt (`theme_worlds`) gespeichert
 * — nur diese Tabelle besitzt deploy_status / deploy_requested_at. Für ein
 * Szenario ist das die Parent-Themenwelt aus scenario.theme_world_id.
 *
 * Sicherheitsregeln aus deploy-hook.js gelten unverändert: die Hook-URL
 * erscheint niemals in Antworten oder Logs.
 */

import { triggerDeployHook, isDeployEnabled, DEPLOY_STATUS } from './deploy-hook.js';

export { isDeployEnabled, DEPLOY_STATUS };

/**
 * Die Spalte deploy_status kennt laut CHECK-Constraint nur diese drei Werte.
 * 'not_configured' ist ein reiner API-Antwortwert und darf nie geschrieben werden.
 */
export const DB_DEPLOY_STATUS = {
  NOT_REQUESTED: 'not_requested',
  REQUESTED: 'requested',
  FAILED: 'failed',
};

export function toDbDeployStatus(hookStatus) {
  if (hookStatus === DEPLOY_STATUS.REQUESTED) return DB_DEPLOY_STATUS.REQUESTED;
  if (hookStatus === DEPLOY_STATUS.FAILED) return DB_DEPLOY_STATUS.FAILED;
  return DB_DEPLOY_STATUS.NOT_REQUESTED;
}

/**
 * Fordert nach einer Änderung der öffentlichen Sichtbarkeit einen neuen Build an
 * und schreibt das Ergebnis nach deploy_status / deploy_requested_at.
 *
 * Verwendet von:
 *   - Themenwelt: publish, unpublish, archive (nur wenn vorher publiziert)
 *   - Szenario:   publish (draft → published), unpublish, archive (nur wenn
 *                 vorher publiziert) — der Status landet auf der Parent-Welt
 *
 * Wichtig: Ein fehlgeschlagener Hook macht die fachliche Statusänderung NICHT
 * rückgängig — die Ressource bleibt im neuen Status, lediglich deploy_status
 * wird auf 'failed' gesetzt.
 *
 * @param {object} supabaseAdmin - Service-Role-Client
 * @param {string} themeWorldId  - UUID der Themenwelt (bei Szenarien: der Parent)
 * @param {string} action        - Aktionsname für Logausgaben (nie Secrets)
 * @param {string} [logPrefix]   - Quelle für Logausgaben
 * @returns {Promise<{deploy: {status: string}, deployStatus: string|null}>}
 *   deploy       — Ergebnis für die API-Antwort ('not_configured' | 'requested' | 'failed')
 *   deployStatus — persistierter DB-Wert, oder null wenn nichts geschrieben wurde
 */
export async function requestDeployForVisibilityChange(
  supabaseAdmin,
  themeWorldId,
  action,
  logPrefix = 'admin-theme-worlds'
) {
  // Deploy-Hooks sind hinter THEME_WORLD_DEPLOY_ENABLED=true gesperrt.
  if (!isDeployEnabled()) {
    return { deploy: { status: DEPLOY_STATUS.NOT_CONFIGURED }, deployStatus: null };
  }

  const deploy = await triggerDeployHook();
  const deployStatus = toDbDeployStatus(deploy.status);

  // Ohne Parent-ID gibt es keine Zeile, auf die der Status gehören würde. Der
  // Build ist trotzdem angefordert — er ist das, worauf es fachlich ankommt.
  // Ein `.eq('id', undefined)` würde dagegen eine unbestimmte Menge treffen.
  if (!themeWorldId) {
    console.error(`[${logPrefix}] ${action}: deploy_status ohne Themenwelt-ID nicht speicherbar.`);
    return { deploy, deployStatus: null };
  }

  const deployUpdatePayload = { deploy_status: deployStatus };
  if (deployStatus === DB_DEPLOY_STATUS.REQUESTED) {
    deployUpdatePayload.deploy_requested_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from('theme_worlds')
    .update(deployUpdatePayload)
    .eq('id', themeWorldId);

  if (error) {
    // Nur Protokollnotiz — der fachliche Status bleibt bestehen.
    console.error(`[${logPrefix}] ${action}: deploy_status konnte nicht gespeichert werden:`, error.message);
  }

  return { deploy, deployStatus };
}
