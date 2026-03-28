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
 * Build FAQPage JSON-LD structured data
 * @param {Array<{q: {de: string}, a: {de: string}}>} faqs
 * @param {string} lang - Active language code (e.g. 'de')
 */
export function buildFaqPageJsonLd(faqs, lang = 'de') {
  if (!faqs || faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q[lang] || faq.q.de,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a[lang] || faq.a.de
      }
    }))
  };
}

/**
 * Inject lazy loading and async decoding into HTML img tags
 */
export function enhanceImages(html) {
  if (!html) return html;
  return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    let result = imgTag;
    const srcMatch = imgTag.match(/\bsrc=(["'])(.*?)\1/i);
    const altMatch = imgTag.match(/\balt=(["'])(.*?)\1/i);

    if (srcMatch) {
      const source = srcMatch[2] || '';
      if (shouldReplaceEditorialImage(source)) {
        const thematicImage = normalizeEditorialImageUrl(source, altMatch?.[2] || '');
        result = result.replace(srcMatch[0], `src="${thematicImage}"`);
      }
    }

    if (!/\bloading\s*=/i.test(result)) {
      result = result.replace('<img', '<img loading="lazy"');
    }
    if (!/\bdecoding\s*=/i.test(result)) {
      result = result.replace('<img', '<img decoding="async"');
    }
    return result;
  });
}

export function normalizeEditorialImageUrl(url, altText = '') {
  if (!url) return getReplacementPhotoByAlt(altText);
  if (shouldReplaceEditorialImage(url)) {
    return getReplacementPhotoByAlt(altText);
  }
  return url;
}

function shouldReplaceEditorialImage(url) {
  if (!url) return true;
  if (!/unsplash\.com/i.test(url)) return false;
  return BLOCKED_UNSPLASH_PATTERNS.some((pattern) => pattern.test(url));
}

const BLOCKED_UNSPLASH_PATTERNS = [
  /1488521787991-ed7bbaae773c/i,
  /1485546246426-74dc88dec4d9/i
];

function getReplacementPhotoByAlt(altText) {
  const alt = (altText || '').toLowerCase();

  if (/(steuer|budget|kosten|stipend|beitrag|finanz|geld|foerder|förder|kulturlegi|rechnung)/i.test(alt)) {
    return 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1200';
  }

  if (/(recht|vertrag|storno|ruecktritt|rücktritt|datenschutz|safeguarding|aufsicht|versicherung|pflicht|warnsignal)/i.test(alt)) {
    return 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=1200';
  }

  if (/(kind|kinder|jugend|famil|eltern|geschwister|schul|hausaufgaben|ferienbetreuung)/i.test(alt)) {
    return 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1200';
  }

  if (/(beruf|karriere|weiterbildung|linkedin|gehalt|quereinstieg|kompetenz|diplom|zertifikat|arbeitsplatz|leadership)/i.test(alt)) {
    return 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1200';
  }

  if (/(hobby|yoga|achtsam|meditation|flow|schnupper|kreativ|sport|solo|date|senior|workshop|kurs)/i.test(alt)) {
    return 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=1200';
  }

  return 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?auto=format&fit=crop&q=80&w=1200';
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
