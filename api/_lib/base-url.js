/**
 * Basis-URL fuer Links, die der Server erzeugt.
 *
 * Bisher wurde `x-forwarded-host` bzw. `host` ungeprueft uebernommen. Diese
 * URL landet in E-Mail-Links (Anfragebestaetigung, Buchungsmails) und in den
 * Stripe-Rueckkehr-Adressen. Wer den Host-Header setzen kann, bestimmte damit,
 * wohin diese Links zeigen.
 *
 * Jetzt wird der Host gegen eine Allowlist geprueft. Faellt er durch, gilt die
 * konfigurierte Standard-Adresse. Vercel-Preview-Deployments bleiben
 * ausdruecklich erlaubt, damit Previews weiterhin auf sich selbst verlinken.
 */

/** Ohne Schema, klein geschrieben, ohne Port. */
function normalizeHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function configuredSiteUrl() {
  const raw = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://kursnavi.ch';
  return raw.trim().replace(/\/+$/, '');
}

/** Hosts, denen wir Links anvertrauen. */
export function isAllowedHost(host) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;

  // Die konfigurierte Produktionsdomain — und deren www-Variante.
  let configuredHost = '';
  try {
    configuredHost = normalizeHost(new URL(configuredSiteUrl()).host);
  } catch {
    configuredHost = 'kursnavi.ch';
  }
  if (normalized === configuredHost) return true;
  if (normalized === `www.${configuredHost}`) return true;

  // Vercel-Deployments (Preview und Produktion) verlinken auf sich selbst.
  if (normalized === 'vercel.app') return false;
  if (normalized.endsWith('.vercel.app')) return true;

  // Lokale Entwicklung.
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]') return true;

  return false;
}

export function getBaseUrl(req) {
  const forwardedHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;

  if (isAllowedHost(forwardedHost)) {
    const forwardedProto = req?.headers?.['x-forwarded-proto'];
    const host = String(forwardedHost).trim();
    // Lokal laeuft der Dev-Server ohne TLS; ueberall sonst gilt https.
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
    const proto = forwardedProto === 'https' ? 'https' : (isLocal ? 'http' : 'https');
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return configuredSiteUrl();
}

export function getDashboardUrl(req) {
  return `${getBaseUrl(req)}/dashboard`;
}
