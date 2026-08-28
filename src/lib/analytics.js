/**
 * Google Analytics 4 — Zentrale Event-Tracking-Funktionen für KursNavi.
 *
 * gtag wird via index.html erst nach einer passenden Cookiebot-Einwilligung
 * geladen. Alle Funktionen hier prüfen zusätzlich die für den jeweiligen
 * Zweck nötige Kategorie (safe no-op ohne Consent).
 */

function hasConsent(category) {
  if (typeof window === 'undefined') return false;
  return window.Cookiebot?.consent?.[category] === true;
}

function gtagSafe(category, ...args) {
  if (!hasConsent(category)) return;
  if (typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

// Die Conversion-Aktion bleibt absichtlich konfigurierbar. Eine Ads-ID oder ein
// Label darf nie im Frontend erfunden bzw. aus einer Analytics-ID abgeleitet
// werden. Ohne diese Variable wird weiterhin nur das consent-gesteuerte GA4-
// Ereignis gesendet.
const GOOGLE_ADS_LEAD_CONVERSION = import.meta.env.MODE === 'production'
  ? String(import.meta.env.VITE_GOOGLE_ADS_LEAD_CONVERSION || '').trim()
  : '';

const GOOGLE_ADS_NEWSLETTER_CONVERSION = import.meta.env.MODE === 'production'
  ? String(import.meta.env.VITE_GOOGLE_ADS_NEWSLETTER_CONVERSION || '').trim()
  : '';

/**
 * Optionales Google-Ads-Lead-Event. Erwartet den vollständigen Wert aus
 * Google Ads, z.B. `AW-123456789/AbCdEfGhIjK`.
 */
export function trackAdsLeadConversion(courseId) {
  if (!GOOGLE_ADS_LEAD_CONVERSION) return;
  // Google-Ads-Conversion ist Marketing und darf nicht bereits mit einem
  // reinen Statistik-Consent ausgelöst werden.
  gtagSafe('marketing', 'event', 'conversion', {
    send_to: GOOGLE_ADS_LEAD_CONVERSION,
    currency: 'CHF',
    value: 0,
    ...(courseId != null ? { item_id: String(courseId) } : {}),
  });
}

/** Optionales Google-Ads-Conversion-Event für Newsletter-Anmeldungen. */
export function trackAdsNewsletterConversion() {
  if (!GOOGLE_ADS_NEWSLETTER_CONVERSION) return;
  gtagSafe('marketing', 'event', 'conversion', {
    send_to: GOOGLE_ADS_NEWSLETTER_CONVERSION,
    currency: 'CHF',
    value: 0,
  });
}

/** SPA Pageview — wird bei jedem Routenwechsel aufgerufen */
export function trackPageView(path, title) {
  gtagSafe('statistics', 'event', 'page_view', {
    page_path: path,
    page_title: title,
  });
}

/** Google-Ads-Landingpage angesehen (GA4, kein personenbeziehbarer Wert). */
export function trackCampaignView(slug) {
  if (!slug) return;
  gtagSafe('statistics', 'event', 'campaign_landing_view', { campaign_slug: slug });
}

/** CTA auf einer Google-Ads-Landingpage angeklickt (GA4). */
export function trackCampaignCta(slug, destination = 'search') {
  if (!slug) return;
  gtagSafe('statistics', 'event', 'campaign_landing_cta', {
    campaign_slug: slug,
    destination,
  });
}

/** Kursdetail angesehen (E-Commerce: view_item) */
export function trackCourseView(course) {
  gtagSafe('statistics', 'event', 'view_item', {
    currency: 'CHF',
    value: (course.base_price || 0) / 100,
    items: [{
      item_id: course.id,
      item_name: course.title,
      item_category: course.category_area || '',
      price: (course.base_price || 0) / 100,
    }],
  });
}

/** Suche ausgeführt */
export function trackSearch(query, resultCount) {
  gtagSafe('statistics', 'event', 'search', {
    search_term: query || '',
    result_count: resultCount,
  });
}

/** Buchung abgeschlossen (E-Commerce: purchase) */
export function trackPurchase(course, bookingId, amountCents) {
  gtagSafe('statistics', 'event', 'purchase', {
    transaction_id: bookingId,
    currency: 'CHF',
    value: amountCents / 100,
    items: [{
      item_id: course.id,
      item_name: course.title,
      item_category: course.category_area || '',
      price: amountCents / 100,
      quantity: 1,
    }],
  });
}

/** Registrierung */
export function trackSignup(method) {
  gtagSafe('statistics', 'event', 'sign_up', { method });
}

/** Login */
export function trackLogin(method) {
  gtagSafe('statistics', 'event', 'login', { method });
}

/** Blog-Artikel gelesen */
export function trackArticleView(article) {
  gtagSafe('statistics', 'event', 'view_item', {
    items: [{
      item_id: article.id || article.slug,
      item_name: article.title,
      item_category: 'blog',
    }],
  });
}

/** Newsletter-Anmeldung */
export function trackNewsletter() {
  gtagSafe('statistics', 'event', 'generate_lead', {
    event_category: 'newsletter',
  });
  trackAdsNewsletterConversion();
}

/** Kontaktanfrage / Lead */
export function trackContactLead(courseId) {
  gtagSafe('statistics', 'event', 'generate_lead', {
    event_category: 'contact',
    item_id: courseId,
  });
  trackAdsLeadConversion(courseId);
}
