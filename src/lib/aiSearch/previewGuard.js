/**
 * Umgebungsschutz der KI-Suche in der Preview-Phase.
 *
 * Verbindlich (Auftrag 17.11.2026): Die Preview bezieht Daten und
 * Schreibzugriffe AUSSCHLIESSLICH aus der TESTumgebung KursNavi
 * (omoapbvfligjfznzivyu). Das wird serverseitig bei jeder Anfrage geprüft:
 *  - In der Vercel-Produktionsumgebung ist die KI-Suche abgeschaltet
 *    (auch falls der Code versehentlich nach main gelangt).
 *  - Server- (SUPABASE_URL) und Browser-Ziel (VITE_SUPABASE_URL) müssen
 *    beide exakt auf das Testprojekt zeigen; jede andere Adresse,
 *    insbesondere Produktion, führt zur Ablehnung ohne Datenzugriff.
 */

export const AI_SEARCH_TEST_REF = 'omoapbvfligjfznzivyu';
export const PRODUCTION_REF = 'nplxmpfasgpumpiddjfl';

export function supabaseRefOf(rawUrl) {
  try {
    const url = new URL(String(rawUrl ?? '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{ok: true, ref: string} | {ok: false, code: string, reason: string}}
 */
export function checkAiSearchEnvironment(env) {
  if (env?.VERCEL_ENV === 'production') {
    return { ok: false, code: 'not_available', reason: 'KI-Suche ist in der Produktionsumgebung nicht freigeschaltet.' };
  }
  const serverRef = supabaseRefOf(env?.SUPABASE_URL);
  if (serverRef !== AI_SEARCH_TEST_REF) {
    return {
      ok: false,
      code: 'wrong_environment',
      reason: serverRef === PRODUCTION_REF
        ? 'Serverziel ist die Produktionsdatenbank — abgelehnt.'
        : 'Serverziel ist nicht die TESTumgebung KursNavi — abgelehnt.',
    };
  }
  // Das Browser-Ziel bestimmt, wo sich Nutzer anmelden; es muss dasselbe
  // Testprojekt sein, sonst passen Sitzung und Daten nicht zusammen.
  // Pflicht (nicht nur falls gesetzt): fehlt die Angabe, ist die Zuordnung
  // nicht belegt und wird abgelehnt.
  if (supabaseRefOf(env?.VITE_SUPABASE_URL) !== AI_SEARCH_TEST_REF) {
    return { ok: false, code: 'wrong_environment', reason: 'Browserziel ist nicht die TESTumgebung KursNavi — abgelehnt.' };
  }
  return { ok: true, ref: serverRef };
}

/**
 * Sichtbarkeit des Einstiegs im Browser: nur auf Vorschau-/Entwicklungs-
 * adressen, nie auf kursnavi.ch. Reine Anzeigeentscheidung — die
 * verbindliche Prüfung macht der Server (checkAiSearchEnvironment).
 */
export function isAiSearchPreviewHost(hostname) {
  const host = String(hostname ?? '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return host.endsWith('.vercel.app');
}
