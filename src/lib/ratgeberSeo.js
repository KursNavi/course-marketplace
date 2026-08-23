/**
 * Gemeinsame SEO-Wahrheit für den Ratgeber-Hub.
 *
 * Betrifft genau vier Seiten:
 *   /ratgeber
 *   /ratgeber/beruflich
 *   /ratgeber/privat-hobby
 *   /ratgeber/kinder
 *
 * Vorher pflegten zwei Stellen dieselben Metadaten unabhängig voneinander:
 *   - scripts/prerender-static.mjs schrieb sie beim Build ins erste HTML
 *   - src/components/RatgeberHubView.jsx setzte nach der Hydration andere Werte
 * Ergebnis waren widersprüchliche Titles, Descriptions, Canonicals und
 * OG-Tags — je nachdem, ob ein Crawler das Server-HTML oder die gerenderte
 * Seite auswertete. Diese Datei ist jetzt die einzige Quelle für beide.
 *
 * Bewusst OHNE Abhängigkeiten (kein React, kein lucide-react, kein
 * import.meta.env), damit sowohl das Vite-Bundle als auch das Node-Build-Skript
 * sie importieren können. Die Basis-URL kommt deshalb immer vom Aufrufer:
 *   - Build:  BASE_URL aus scripts/prerender-static.mjs
 *   - Client: CANONICAL_BASE_URL aus src/lib/siteConfig.js
 * Beide lesen dieselbe Env-Variable VITE_SITE_URL.
 *
 * NICHT enthalten sind Cluster- und Artikelseiten (/ratgeber/{kat}/{cluster}…).
 * Deren Metadaten stammen weiterhin aus ratgeberStructure.js bzw. den
 * Artikeldaten im Prerender-Skript und bleiben unverändert.
 */

/** Pfad des Standard-Sharing-Bilds (relativ zur Basis-URL). */
export const RATGEBER_SEO_OG_IMAGE_PATH = '/og-default.png';

/** og:type aller Hub-Seiten — Übersichtsseiten, keine Artikel. */
export const RATGEBER_SEO_OG_TYPE = 'website';

const ROOT_ENTRY = {
  path: '/ratgeber',
  title: 'Ratgeber: Weiterbildung, Hobbys & Kinderkurse Schweiz | KursNavi',
  description:
    'Der KursNavi Ratgeber: Praxiswissen zu Weiterbildung, Hobbys und Kinderkursen in der Schweiz – von der Finanzierung bis zur Wahl des passenden Kurses.',
};

/**
 * Kategorie-Metadaten.
 *
 * Die Descriptions nennen bewusst die vier Cluster der jeweiligen Kategorie in
 * eigener Formulierung statt sie zur Laufzeit aus ratgeberStructure.js
 * zusammenzusetzen. Eine zusammengesetzte Description wäre im Node-Build nur
 * über einen zweiten, dependency-freien Datenabzug der Cluster-Labels zu haben —
 * also erneut zwei gepflegte Quellen. Ein fester, redaktionell lesbarer Satz
 * pro Kategorie ist die kleinere und ehrlichere Lösung.
 */
const CATEGORY_ENTRIES = {
  beruflich: {
    path: '/ratgeber/beruflich',
    title: 'Ratgeber Beruflich: Weiterbildung & Karriere Schweiz | KursNavi',
    description:
      'Ratgeber für die berufliche Weiterbildung in der Schweiz: Finanzierung und Förderung, Karriereschritte, Future Skills und das Schweizer Bildungssystem.',
  },
  'privat-hobby': {
    path: '/ratgeber/privat-hobby',
    title: 'Ratgeber Privat & Hobby: Freizeitkurse Schweiz | KursNavi',
    description:
      'Ratgeber für Hobby- und Freizeitkurse in der Schweiz: Hobby finden, Anbieterqualität prüfen, Angebote je Lebensphase und Kosten realistisch einschätzen.',
  },
  kinder: {
    path: '/ratgeber/kinder',
    title: 'Ratgeber Kinder: Kinderkurse & Freizeit Schweiz | KursNavi',
    description:
      'Ratgeber für Kinderkurse in der Schweiz: Sicherheit und Recht, Interessen und Motivation, Kosten und Förderung sowie Organisation im Familienalltag.',
  },
};

/** Kategorie-Slugs in Reihenfolge der Hub-Darstellung. */
export const RATGEBER_SEO_CATEGORY_SLUGS = Object.freeze(Object.keys(CATEGORY_ENTRIES));

/** Hängt einen Pfad an eine Basis-URL — ohne doppelte oder fehlende Slashes. */
function toAbsoluteUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Baut den vollständigen Metadatensatz einer Hub-Seite.
 *
 * og:title/og:description sind bewusst identisch mit title/description: für
 * eine Übersichtsseite gibt es keinen redaktionellen Grund für zwei Varianten,
 * und jede Abweichung wäre wieder eine Stelle, an der Build und Client
 * auseinanderlaufen können.
 */
function buildHubSeo(entry, baseUrl) {
  const canonical = toAbsoluteUrl(baseUrl, entry.path);
  return Object.freeze({
    path: entry.path,
    title: entry.title,
    description: entry.description,
    canonical,
    ogTitle: entry.title,
    ogDescription: entry.description,
    ogUrl: canonical,
    ogImage: toAbsoluteUrl(baseUrl, RATGEBER_SEO_OG_IMAGE_PATH),
    ogType: RATGEBER_SEO_OG_TYPE,
  });
}

/**
 * Metadaten der Ratgeber-Startseite /ratgeber.
 *
 * @param {string} baseUrl - absolute Basis-URL ohne abschliessenden Slash
 * @returns {{path: string, title: string, description: string, canonical: string,
 *            ogTitle: string, ogDescription: string, ogUrl: string,
 *            ogImage: string, ogType: string}}
 */
export function getRatgeberRootSeo(baseUrl) {
  return buildHubSeo(ROOT_ENTRY, baseUrl);
}

/**
 * Metadaten einer Ratgeber-Kategorieseite.
 *
 * @param {string} categorySlug - 'beruflich' | 'privat-hobby' | 'kinder'
 * @param {string} baseUrl - absolute Basis-URL ohne abschliessenden Slash
 * @returns {object|null} null bei unbekanntem Slug — der Aufrufer entscheidet,
 *          was dann gilt (die App zeigt weiterhin den Root-Hub).
 */
export function getRatgeberCategorySeo(categorySlug, baseUrl) {
  const entry = CATEGORY_ENTRIES[categorySlug];
  return entry ? buildHubSeo(entry, baseUrl) : null;
}
