import { isAiSearchPreviewHost } from './aiSearch/previewGuard.js';

export const PRODUCTION_SITE_URL = 'https://kursnavi.ch';

/**
 * Ziel des Bestätigungslinks nach einer Registrierung.
 *
 * Auf Vorschau-/Entwicklungsadressen (Testdatenbank) bleibt die Bestätigung
 * auf derselben Vorschau — eine Testregistrierung leitet nie auf kursnavi.ch
 * weiter. Auf kursnavi.ch bleibt das bisherige Verhalten unverändert.
 * Supabase übernimmt das Ziel nur, wenn es in der Redirect-Liste des
 * jeweiligen Projekts erlaubt ist (Testprojekt: Vorschauadressen eintragen).
 */
export function getSignupEmailRedirect(location = (typeof window !== 'undefined' ? window.location : null)) {
  if (location && isAiSearchPreviewHost(location.hostname)) {
    return `${location.origin}/ki-suche`;
  }
  return PRODUCTION_SITE_URL;
}
