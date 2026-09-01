/**
 * Google Analytics 4 — Zentrale Event-Tracking-Funktionen für KursNavi.
 *
 * gtag wird via index.html geladen und von Cookiebot blockiert bis
 * der User "Statistik"-Consent gibt. Alle Funktionen hier prüfen
 * zuerst ob window.gtag verfügbar ist (safe no-op ohne Consent).
 */

function gtagSafe(...args) {
  if (typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

// Funnel events are statistics and must work with both the legacy manual
// Cookiebot blocking setup and the consent-aware gtag wrapper used by newer
// deployments. If Cookiebot has already exposed a consent object, require an
// explicit statistics consent; without Cookiebot, gtag itself is the gate.
function funnelEventSafe(name, params) {
  if (typeof window === 'undefined') return;
  if (window.Cookiebot?.consent && window.Cookiebot.consent.statistics !== true) return;
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

/**
 * Returns true when the current URL carries a paid Google campaign marker.
 * This prevents the campaign funnel from being inflated by organic traffic.
 */
export function hasGoogleAdsAttribution(location = typeof window !== 'undefined' ? window.location : null) {
  if (!location) return false;
  const params = new URLSearchParams(location.search || '');
  if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) return true;
  return params.get('utm_source') === 'google'
    && ['cpc', 'ppc', 'paidsearch', 'paid_search'].includes(params.get('utm_medium'));
}

/** SPA Pageview — wird bei jedem Routenwechsel aufgerufen */
export function trackPageView(path, title) {
  gtagSafe('event', 'page_view', {
    page_path: path,
    page_title: title,
  });
}

/**
 * Google-Ads-Landingpage angesehen. Der Slug ist eine redaktionelle
 * Kennung, niemals eine URL mit Query-Parametern oder Nutzerdaten.
 */
export function trackCampaignView(slug) {
  if (!slug) return;
  funnelEventSafe('campaign_landing_view', {
    campaign_slug: String(slug),
  });
}

/** CTA auf einer Kampagnen-/Themenlandingpage angeklickt. */
export function trackCampaignCta(slug, destination = 'search') {
  if (!slug) return;
  funnelEventSafe('campaign_landing_cta', {
    campaign_slug: String(slug),
    destination: String(destination || 'unknown'),
  });
}

/** Lead-Formular geöffnet (Intent-Signal, noch kein Lead). */
export function trackLeadModalOpen(courseId) {
  funnelEventSafe('lead_modal_open', {
    course_id: courseId == null ? undefined : String(courseId),
  });
}

/** Anfrage-CTA auf der Kursdetailseite angeklickt. */
export function trackLeadCtaClick(courseId) {
  funnelEventSafe('lead_cta_click', {
    course_id: courseId == null ? undefined : String(courseId),
  });
}

/** Erstes Interagieren mit dem Lead-Formular (kein Feldwert wird erfasst). */
export function trackLeadFormStart(courseId) {
  funnelEventSafe('lead_form_start', {
    course_id: courseId == null ? undefined : String(courseId),
  });
}

/** Browser-/Formularvalidierung verhindert das Absenden. */
export function trackLeadValidationError(courseId, fieldName) {
  const safeField = String(fieldName || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'unknown';
  funnelEventSafe('lead_form_validation_error', {
    course_id: courseId == null ? undefined : String(courseId),
    field: safeField,
  });
}

/** Technischer Fehler beim Lead-Submit, ohne Fehlermeldung oder Formulardaten. */
export function trackLeadSubmitError(courseId, errorType = 'unknown') {
  const safeType = ['network', 'http', 'invalid_response', 'unknown'].includes(errorType)
    ? errorType
    : 'unknown';
  funnelEventSafe('lead_submit_error', {
    course_id: courseId == null ? undefined : String(courseId),
    error_type: safeType,
  });
}

/** Kursdetail angesehen (E-Commerce: view_item) */
export function trackCourseView(course) {
  gtagSafe('event', 'view_item', {
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
  gtagSafe('event', 'search', {
    search_term: query || '',
    result_count: resultCount,
  });
}

/** Buchung abgeschlossen (E-Commerce: purchase) */
export function trackPurchase(course, bookingId, amountCents) {
  gtagSafe('event', 'purchase', {
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
  gtagSafe('event', 'sign_up', { method });
}

/** Login */
export function trackLogin(method) {
  gtagSafe('event', 'login', { method });
}

/** Blog-Artikel gelesen */
export function trackArticleView(article) {
  gtagSafe('event', 'view_item', {
    items: [{
      item_id: article.id || article.slug,
      item_name: article.title,
      item_category: 'blog',
    }],
  });
}

/** Newsletter-Anmeldung */
export function trackNewsletter() {
  gtagSafe('event', 'generate_lead', {
    event_category: 'newsletter',
  });
}

/** Kontaktanfrage / Lead */
export function trackContactLead(courseId) {
  funnelEventSafe('generate_lead', {
    event_category: 'contact',
    item_id: courseId,
  });
}
