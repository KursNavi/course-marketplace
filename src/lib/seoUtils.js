/**
 * SEO Utilities for KursNavi
 * Centralized helpers for meta tags, structured data, and robots policy
 */

/**
 * Determine robots policy based on environment
 */
export function getRobotsPolicy() {
  if (import.meta.env.PROD) {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'kursnavi.ch' || host === 'www.kursnavi.ch') {
        return 'index,follow';
      }
    }
    const siteUrl = import.meta.env.VITE_SITE_URL || '';
    if (siteUrl.includes('kursnavi.ch')) {
      return 'index,follow';
    }
  }
  return 'noindex,nofollow';
}

/**
 * Build canonical URL from path
 */
export function buildCanonical(path) {
  const base = (import.meta.env.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Extract first image URL from HTML content string
 */
export function extractFirstImage(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Estimate reading time from HTML content
 * @returns {number} minutes (min 2, max 12)
 */
export function estimateReadingTime(html) {
  if (!html) return 5;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).length;
  const minutes = Math.round(wordCount / 220);
  return Math.max(2, Math.min(12, minutes));
}

/**
 * Build Article JSON-LD structured data
 */
export function buildArticleJsonLd({ title, description, url, image, datePublished, dateModified }) {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'KursNavi Redaktion' },
    publisher: {
      '@type': 'Organization',
      name: 'KursNavi',
      url: 'https://kursnavi.ch',
      logo: { '@type': 'ImageObject', url: 'https://kursnavi.ch/favicon.png' }
    },
    inLanguage: 'de-CH',
    datePublished: datePublished || new Date().toISOString().split('T')[0],
    dateModified: dateModified || new Date().toISOString().split('T')[0]
  };
  if (image) article.image = image;
  return article;
}

/**
 * Build BreadcrumbList JSON-LD
 * @param {Array<{name: string, url: string}>} items
 */
export function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

/**
 * Inject lazy loading and async decoding into HTML img tags
 */
export function enhanceImages(html) {
  if (!html) return html;
  return html.replace(/<img(\s)/g, '<img loading="lazy" decoding="async"$1');
}

/**
 * High-risk article slugs that need disclaimers
 */
export const HIGH_RISK_SLUGS = new Set([
  'steuer-hack-weiterbildung',
  'steuertipp-kinderbetreuungskosten',
  'aufsichtspflicht-schweiz',
  'datenschutz-fotos-videos',
  'versicherungsschutz-kindersport',
  'bundesbeitraege-50-prozent',
  'kantonale-stipendien-vergleich',
  'weiterbildungsvereinbarungen',
  'alternative-finanzierungswege',
  'storno-ruecktritt-rechte',
  'krankenkassenbeitraege-kurse',
  'kinderschutz-safeguarding'
]);

/**
 * Get disclaimer text for high-risk article
 */
export function getDisclaimerText(slug) {
  if (!HIGH_RISK_SLUGS.has(slug)) return null;

  const taxSlugs = ['steuer-hack-weiterbildung', 'steuertipp-kinderbetreuungskosten'];
  const legalSlugs = ['aufsichtspflicht-schweiz', 'weiterbildungsvereinbarungen', 'storno-ruecktritt-rechte', 'kinderschutz-safeguarding'];
  const insuranceSlugs = ['versicherungsschutz-kindersport', 'krankenkassenbeitraege-kurse'];
  const privacySlugs = ['datenschutz-fotos-videos'];

  if (taxSlugs.includes(slug))
    return 'Dieser Artikel dient der allgemeinen Information und stellt keine Steuerberatung dar. Steuerliche Regelungen können sich ändern und kantonal unterschiedlich sein. Bitte konsultiere eine Fachperson oder Dein kantonales Steueramt für verbindliche Auskünfte.';
  if (legalSlugs.includes(slug))
    return 'Dieser Artikel dient der allgemeinen Information und stellt keine Rechtsberatung dar. Für verbindliche Auskünfte wende Dich bitte an eine Fachperson oder die zuständige Behörde.';
  if (insuranceSlugs.includes(slug))
    return 'Dieser Artikel dient der allgemeinen Information und stellt keine Versicherungsberatung dar. Versicherungsbedingungen variieren je nach Anbieter und Kanton. Bitte prüfe die Details bei Deiner Versicherung.';
  if (privacySlugs.includes(slug))
    return 'Dieser Artikel dient der allgemeinen Information und stellt keine Rechtsberatung zum Datenschutz dar. Für verbindliche Auskünfte wende Dich an den EDÖB oder eine Fachperson.';
  return 'Dieser Artikel dient der allgemeinen Information. Förderbedingungen und Beträge können sich ändern. Prüfe aktuelle Konditionen direkt bei den genannten Stellen.';
}

export const DEFAULT_OG_IMAGE = '/og-default.svg';
