/**
 * Umgebungsschutz der KI-Suche.
 *
 * Preview/Entwicklung (Auftrag 17.11.2026, unverändert): Daten und
 * Schreibzugriffe AUSSCHLIESSLICH aus der TESTumgebung KursNavi
 * (omoapbvfligjfznzivyu). Server- (SUPABASE_URL) und Browser-Ziel
 * (VITE_SUPABASE_URL) müssen beide exakt auf das Testprojekt zeigen.
 *
 * Produktion (Produktionsfreischaltung, 25.11.2026): STANDARDMÄSSIG AUS.
 * In der Vercel-Produktionsumgebung ist die KI-Suche nur aktiv, wenn
 * ALLE Bedingungen zugleich erfüllt sind:
 *  - AI_SEARCH_PRODUCTION_ENABLED ist exakt die Produktions-Projektkennung
 *    (kein „1“/„true“: ein versehentlich gesetzter Wert schaltet nichts frei);
 *  - Server- und Browser-Ziel zeigen beide exakt auf das Produktionsprojekt.
 * Ein Merge allein aktiviert nichts. Der Schalter wirkt erst nach einem
 * Deployment mit gesetzter Variable (Vercel liest Variablen beim Deployment).
 */

export const AI_SEARCH_TEST_REF = 'omoapbvfligjfznzivyu';
export const PRODUCTION_REF = 'nplxmpfasgpumpiddjfl';
/** Öffentliche Produktionsadressen, auf denen der Einstieg erscheinen darf. */
export const AI_SEARCH_PRODUCTION_HOSTS = Object.freeze(['kursnavi.ch', 'www.kursnavi.ch']);

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

/** true nur bei exakt gesetzter Produktionsfreischaltung (Wert = Projektkennung). */
export function isProductionSwitchOn(value) {
  return String(value ?? '').trim() === PRODUCTION_REF;
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{ok: true, ref: string, mode: 'test'|'production'} | {ok: false, code: string, reason: string}}
 */
export function checkAiSearchEnvironment(env) {
  if (env?.VERCEL_ENV === 'production') {
    if (!isProductionSwitchOn(env?.AI_SEARCH_PRODUCTION_ENABLED)) {
      return { ok: false, code: 'not_available', reason: 'KI-Suche ist in der Produktionsumgebung nicht freigeschaltet.' };
    }
    if (supabaseRefOf(env?.SUPABASE_URL) !== PRODUCTION_REF) {
      return { ok: false, code: 'wrong_environment', reason: 'Produktionsfreischaltung: Serverziel ist nicht das Produktionsprojekt — abgelehnt.' };
    }
    if (supabaseRefOf(env?.VITE_SUPABASE_URL) !== PRODUCTION_REF) {
      return { ok: false, code: 'wrong_environment', reason: 'Produktionsfreischaltung: Browserziel ist nicht das Produktionsprojekt — abgelehnt.' };
    }
    return { ok: true, ref: PRODUCTION_REF, mode: 'production' };
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
  return { ok: true, ref: serverRef, mode: 'test' };
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

/**
 * Betriebsart im Browser (reine Anzeige; verbindlich prüft der Server):
 *  - 'test': Vorschauadresse mit Testdatenbank;
 *  - 'blocked': Vorschauadresse mit anderer Datenbank (Einstieg sichtbar, Suche gesperrt);
 *  - 'production': kursnavi.ch, Build mit VITE_AI_SEARCH_PRODUCTION = Projektkennung
 *    und Produktionsdatenbank;
 *  - 'off': sonst (kein Einstieg).
 */
export function aiSearchClientMode({ hostname, viteSupabaseUrl, productionFlag } = {}) {
  const ref = supabaseRefOf(viteSupabaseUrl);
  if (isAiSearchPreviewHost(hostname)) return ref === AI_SEARCH_TEST_REF ? 'test' : 'blocked';
  const host = String(hostname ?? '').toLowerCase();
  if (AI_SEARCH_PRODUCTION_HOSTS.includes(host) && isProductionSwitchOn(productionFlag) && ref === PRODUCTION_REF) return 'production';
  return 'off';
}

/** Betriebsart dieses Browsers aus Adresse und Build-Variablen. */
export function currentAiSearchClientMode() {
  if (typeof window === 'undefined') return 'off';
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  return aiSearchClientMode({ hostname: window.location.hostname, viteSupabaseUrl: env.VITE_SUPABASE_URL, productionFlag: env.VITE_AI_SEARCH_PRODUCTION });
}

/** Einstieg anzeigen (Navigation, Startseite, Route /ki-suche). */
export function isAiSearchEntryVisible() {
  return currentAiSearchClientMode() !== 'off';
}
