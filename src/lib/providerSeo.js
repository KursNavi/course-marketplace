/**
 * Die EINZIGE Quelle der Wahrheit für die SEO-Daten eines Anbieterprofils.
 *
 * Vor diesem Modul lag die Berechnung (Title, Meta Description, Open Graph,
 * EducationalOrganization/LocalBusiness- und BreadcrumbList-JSON-LD) inline im
 * useEffect von ProviderProfilePage.jsx und war damit erst nach der
 * React-Hydration vorhanden — der erste HTTP-Response enthielt nur die
 * generische SPA-Shell.
 *
 * Die Funktionen sind rein und abhängigkeitsfrei (kein React, kein DOM, kein
 * `import.meta.env`), damit Browser-Bundle und Build-Prerender identisch
 * rechnen. Die Basis-URL wird immer hereingereicht und stammt aus der zentralen
 * Site-Konfiguration — niemals aus `window.location.origin`.
 *
 * Eingabeform ist das öffentliche Profil, wie es `api/provider.js`
 * (`action=profile`) ausliefert. `mapProfileRowToPublicProvider()` bildet eine
 * rohe `profiles`-Zeile auf genau diese Form ab, damit der Prerender dieselbe
 * Datenform sieht wie die hydratisierte Seite.
 */

/** Standard-OG-Bild (relativ zur Site-Basis-URL) — identisch zu ProviderProfilePage. */
export const DEFAULT_OG_IMAGE_PATH = '/og-default.png';

/** Maximale Länge der Meta Description (identisch zur bisherigen Laufzeitlogik). */
const META_DESCRIPTION_MAX = 155;

/** Pakete, die überhaupt ein öffentliches Profil erhalten (siehe api/provider.js). */
export const PUBLIC_PROFILE_TIERS = ['pro', 'premium', 'enterprise'];

function normalizeBase(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '');
}

/**
 * Relativer Pfad eines Anbieterprofils.
 *
 * Bewusst eigener Name statt `buildProviderPath` aus siteConfig.js: dieses
 * Modul muss abhängigkeitsfrei bleiben (siteConfig.js liest `import.meta.env`
 * und ist im Node-Build nicht ladbar).
 */
export function buildProviderProfilePath(slug) {
  return `/anbieter/${slug}`;
}

/**
 * Bildet eine rohe `profiles`-Zeile auf die öffentliche Profilform ab, die
 * api/provider.js ausliefert und ProviderProfilePage konsumiert.
 *
 * Bewusst NUR die für SEO/JSON-LD benötigten Felder: alles andere (Kurse,
 * Entitlements, Kontakt-E-Mail) spielt für den <head> keine Rolle.
 *
 * @param {object} row - Zeile aus `profiles`
 * @returns {object} Öffentliches Profil (Teilmenge)
 */
export function mapProfileRowToPublicProvider(row) {
  return {
    id: row?.id,
    name: row?.full_name,
    slug: row?.slug,
    description: row?.bio_text,
    logoUrl: row?.logo_url || null,
    websiteUrl: row?.website_url || null,
    phone: row?.phone || null,
    location: {
      street: row?.street || null,
      city: row?.city,
      canton: row?.canton,
    },
    socialLinkedin: row?.social_linkedin || null,
    socialInstagram: row?.social_instagram || null,
    socialFacebook: row?.social_facebook || null,
    socialYoutube: row?.social_youtube || null,
    publishedAt: row?.profile_published_at || null,
  };
}

/**
 * Meta Description eines Anbieterprofils (max. 155 Zeichen inkl. Auslassung).
 * Leere Profile bekommen den bestehenden Fallbacksatz.
 */
export function buildProviderMetaDescription(provider) {
  const raw = provider?.description || '';
  if (raw.length > META_DESCRIPTION_MAX) {
    return `${raw.substring(0, META_DESCRIPTION_MAX - 3)}...`;
  }
  return raw || `${provider?.name} – Kursanbieter auf KursNavi.`;
}

/**
 * Alle head-Metadaten eines Anbieterprofils.
 *
 * @param {object} provider - Öffentliches Profil (siehe mapProfileRowToPublicProvider)
 * @param {string} baseUrl - Absolute Basis-URL (zentrale Konfiguration)
 * @returns {{
 *   path: string, canonicalUrl: string, title: string, description: string,
 *   ogTitle: string, ogDescription: string, ogUrl: string, ogImage: string,
 *   ogType: string
 * }}
 */
export function buildProviderSeo(provider, baseUrl) {
  const base = normalizeBase(baseUrl);
  const path = buildProviderProfilePath(provider?.slug);
  const canonicalUrl = `${base}${path}`;
  const description = buildProviderMetaDescription(provider);
  const title = `${provider?.name} | KursNavi`;

  return {
    path,
    canonicalUrl,
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonicalUrl,
    ogImage: provider?.logoUrl || `${base}${DEFAULT_OG_IMAGE_PATH}`,
    ogType: 'website',
  };
}

/**
 * Strukturierte Daten eines Anbieterprofils.
 *
 * Zwei getrennte Schemas — exakt wie bisher zur Laufzeit:
 *   - EducationalOrganization + LocalBusiness (ein Knoten mit @type-Array)
 *   - BreadcrumbList
 *
 * Optionale Felder werden nur ausgegeben, wenn sie tatsächlich vorhanden sind.
 * Es werden keine Werte erfunden.
 *
 * @param {object} provider
 * @param {string} baseUrl
 * @returns {{organization: object, breadcrumb: object}}
 */
export function buildProviderStructuredData(provider, baseUrl) {
  const base = normalizeBase(baseUrl);
  const canonicalUrl = `${base}${buildProviderProfilePath(provider?.slug)}`;

  const organization = {
    '@context': 'https://schema.org',
    '@type': ['EducationalOrganization', 'LocalBusiness'],
    name: provider?.name,
    url: canonicalUrl,
    description: provider?.description,
    address: {
      '@type': 'PostalAddress',
      ...(provider?.location?.street ? { streetAddress: provider.location.street } : {}),
      addressLocality: provider?.location?.city,
      addressRegion: provider?.location?.canton,
      addressCountry: 'CH',
    },
  };

  if (provider?.logoUrl) organization.logo = provider.logoUrl;
  if (provider?.phone) organization.telephone = provider.phone;
  if (provider?.email) organization.email = provider.email;

  const sameAs = [
    provider?.websiteUrl,
    provider?.socialLinkedin,
    provider?.socialInstagram,
    provider?.socialFacebook,
    provider?.socialYoutube,
  ].filter(Boolean);
  if (sameAs.length > 0) organization.sameAs = sameAs;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: base },
      { '@type': 'ListItem', position: 2, name: 'Anbieter', item: `${base}/anbieter` },
      { '@type': 'ListItem', position: 3, name: provider?.name, item: canonicalUrl },
    ],
  };

  return { organization, breadcrumb };
}

/** Dieselben Schemas als flache Liste, in der Reihenfolge der Laufzeitausgabe. */
export function buildProviderJsonLdList(provider, baseUrl) {
  const { organization, breadcrumb } = buildProviderStructuredData(provider, baseUrl);
  return [organization, breadcrumb];
}
