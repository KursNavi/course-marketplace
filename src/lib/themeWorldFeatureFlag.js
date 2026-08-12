/**
 * Feature-Flag und Legacy-Fallback für das dynamische Themenwelten-System.
 *
 * Architektur:
 *   - VITE_THEME_WORLD_DB_ENABLED: Globaler Schalter (Default: false/unset)
 *   - VITE_THEME_WORLD_PILOT_KEYS: Kommaseparierte Liste aktivierter Theme-World-Keys
 *     (Default: leer → kein Key ist aktiviert)
 *
 * In Phase 4: Beide Flags sind NICHT gesetzt → immer Legacy-Fallback.
 *
 * Fallback-Verhalten:
 *   - Flag aus → Legacy-Config sofort, keine DB-Abfrage
 *   - Flag an, Key nicht in Pilot-Liste → Legacy-Config
 *   - Flag an, Key in Pilot-Liste, DB erfolgreich → neue DB-Daten
 *   - Flag an, Key in Pilot-Liste, DB-Fehler → Legacy-Fallback + Logging
 *   - Flag an, Key in Pilot-Liste, Not-found → korrektes Not-found (kein Fallback!)
 *
 * Unterschied DB-Fehler vs Not-found:
 *   - ThemeWorldNotFoundError → Seite existiert wirklich nicht (kein Fallback auf Legacy)
 *   - ThemeWorldDbError → Technisches Problem, Legacy-Fallback greift
 *
 * Keine Secrets im Client: Alle Env-Vars sind VITE_-prefixed und nur booleans/strings.
 */

import { ThemeWorldNotFoundError, ThemeWorldDbError } from './themeWorldService';

// ---------------------------------------------------------------------------
// Flag-Auswertung
// ---------------------------------------------------------------------------

/**
 * Prüft ob das dynamische Themenwelten-System global aktiviert ist.
 * Gibt false zurück wenn VITE_THEME_WORLD_DB_ENABLED nicht auf 'true' gesetzt ist.
 *
 * @returns {boolean}
 */
export function isThemeWorldDbEnabled() {
  return import.meta.env.VITE_THEME_WORLD_DB_ENABLED === 'true';
}

/**
 * Gibt die Liste der für den Pilot aktivierten Theme-World-Keys zurück.
 * Liest VITE_THEME_WORLD_PILOT_KEYS (kommasepariert).
 *
 * Beispiel: 'sport_fitness_beruf,yoga_achtsamkeit'
 *
 * @returns {Set<string>} Set der aktivierten Keys (trimmed, lowercase)
 */
export function getPilotKeys() {
  const raw = import.meta.env.VITE_THEME_WORLD_PILOT_KEYS || '';
  if (!raw.trim()) return new Set();
  return new Set(
    raw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
  );
}

/**
 * Prüft ob eine spezifische Themenwelt für den Pilot aktiviert ist.
 *
 * Bedingungen für true:
 *   1. VITE_THEME_WORLD_DB_ENABLED = 'true'
 *   2. Key ist in VITE_THEME_WORLD_PILOT_KEYS enthalten
 *
 * @param {string} themeWorldKey - Interner Key (z.B. 'sport_fitness_beruf')
 * @returns {boolean}
 */
export function isThemeWorldPilotActive(themeWorldKey) {
  if (!isThemeWorldDbEnabled()) return false;
  if (!themeWorldKey) return false;
  return getPilotKeys().has(themeWorldKey.toLowerCase());
}

// ---------------------------------------------------------------------------
// Haupt-Hook: Daten laden mit Fallback
// ---------------------------------------------------------------------------

/**
 * Versucht Themenwelt-Daten aus der DB zu laden, fällt bei Fehlern auf Legacy zurück.
 *
 * @param {object} params
 * @param {string} params.themeWorldKey - Interner Config-Key der Themenwelt
 * @param {Function} params.dbLoader - Async-Funktion die DB-Daten lädt
 * @param {Function} params.legacyLoader - Sync-Funktion die Legacy-Config lädt
 * @returns {Promise<{
 *   data: any,
 *   source: 'db' | 'legacy',
 *   notFound: boolean,
 *   error: Error | null
 * }>}
 */
export async function loadThemeWorldWithFallback({
  themeWorldKey,
  dbLoader,
  legacyLoader,
}) {
  // 1. Feature-Flag prüfen (keine DB-Abfrage wenn deaktiviert)
  if (!isThemeWorldPilotActive(themeWorldKey)) {
    if (import.meta.env.DEV) {
      console.debug(
        `[ThemeWorldFlag] Legacy-Fallback für '${themeWorldKey}': Pilot-Flag nicht aktiv.`,
      );
    }
    const legacy = await safeLegacyLoad(legacyLoader, themeWorldKey);
    return { data: legacy, source: 'legacy', notFound: legacy === null, error: null };
  }

  // 2. DB-Daten laden (Pilot aktiv)
  try {
    const data = await dbLoader();

    if (import.meta.env.DEV) {
      console.debug(`[ThemeWorldFlag] DB-Daten geladen für '${themeWorldKey}'.`);
    }

    return { data, source: 'db', notFound: false, error: null };

  } catch (err) {
    // Not-found: Kein Fallback — Seite existiert wirklich nicht
    if (err instanceof ThemeWorldNotFoundError) {
      if (import.meta.env.DEV) {
        console.debug(
          `[ThemeWorldFlag] Not-found für '${themeWorldKey}': Seite existiert nicht.`,
        );
      }
      return { data: null, source: 'db', notFound: true, error: err };
    }

    // Technischer DB-Fehler: Legacy-Fallback aktivieren + Logging
    if (err instanceof ThemeWorldDbError) {
      console.error(
        `[ThemeWorldFlag] DB-Fehler für '${themeWorldKey}', Legacy-Fallback aktiv:`,
        err.message,
      );

      if (import.meta.env.DEV) {
        console.warn(
          '[ThemeWorldFlag] DB-Fehler-Details (nur in DEV sichtbar):',
          err.cause,
        );
      }

      const legacy = await safeLegacyLoad(legacyLoader, themeWorldKey);
      return { data: legacy, source: 'legacy', notFound: legacy === null, error: err };
    }

    // Unbekannter Fehler: auch Legacy-Fallback
    console.error(
      `[ThemeWorldFlag] Unbekannter Fehler für '${themeWorldKey}':`,
      err.message,
    );
    const legacy = await safeLegacyLoad(legacyLoader, themeWorldKey);
    return { data: legacy, source: 'legacy', notFound: legacy === null, error: err };
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Führt die Legacy-Loader-Funktion sicher aus.
 * Gibt null zurück wenn der Loader null/undefined zurückgibt oder wirft.
 *
 * @param {Function} legacyLoader - Sync oder async Funktion
 * @param {string} key - Theme-World-Key (für Logging)
 * @returns {Promise<any>}
 */
async function safeLegacyLoad(legacyLoader, key) {
  try {
    const result = await legacyLoader();
    return result ?? null;
  } catch (e) {
    console.error(`[ThemeWorldFlag] Legacy-Loader für '${key}' fehlgeschlagen:`, e.message);
    return null;
  }
}
