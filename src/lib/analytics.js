/**
 * Google Analytics 4 / Google Ads — zentrale Event-Tracking-Funktionen.
 *
 * Der Google-Tag wird in index.html nur geladen, wenn Cookiebot eine passende
 * Einwilligung meldet. Statistik-Ereignisse benötigen Statistik-Consent;
 * Ads-Conversions benötigen Marketing-Consent.
 */

function hasConsent(category) {
  if (typeof window === 'undefined') return false;
  return window.Cookiebot?.consent?.[category] === true;
}

/**
 * Private provider/admin routes are excluded from public UX analytics.
 * This keeps internal work in dashboards and the control room from inflating
 * the public funnel while leaving all public routes measurable.
 */
function isInternalAnalyticsRoute() {
  if (typeof window === 'undefined') return false;
  let pathname = window.location.pathname || '/';
  if (pathname.startsWith('/app/')) pathname = `/${pathname.slice('/app/'.length)}`;
  return pathname === '/dashboard'
    || pathname === '/create-course'
    || pathname === '/admin-blog'
    || pathname.startsWith('/control-room-2025');
}

function gtagSafe(category, ...args) {
  if (!hasConsent(category)) return;
  if (typeof window.gtag === 'function') {
    // GA4 otherwise attaches the browser's full location and referrer to events.
    window.gtag('set', {
      page_location: `${window.location.origin}${analyticsPath(window.location.pathname)}`,
      page_referrer: '',
    });
    window.gtag(...args);
  }
}

/**
 * Datensparsame Contentsquare Page Events.
 *
 * Die Queue funktioniert auch dann, wenn das Contentsquare-Skript nach der
 * Einwilligung noch nicht fertig geladen ist. Ereignisnamen bleiben bewusst
 * konstant und enthalten weder Suchbegriffe noch Kurs- oder Nutzerkennungen.
 */
function contentsquareSafe(eventName) {
  if (!hasConsent('statistics') || isInternalAnalyticsRoute()) return;
  window._uxa = window._uxa || [];
  window._uxa.push(['trackPageEvent', eventName]);
}

// v2 deliberately drops the previously stored full landing URL and referrer.
const ATTRIBUTION_STORAGE_KEY = 'kn_attribution_v2';
const CONVERSION_DEDUPE_PREFIX = 'kn_conversion_event_';

export function createAnalyticsEventId(prefix = 'evt') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function conversionAlreadyTracked(eventName, eventId) {
  if (typeof window === 'undefined' || !eventId) return false;
  const key = `${CONVERSION_DEDUPE_PREFIX}${eventName}_${eventId}`;
  try {
    if (window.sessionStorage.getItem(key)) return true;
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Tracking must never block the product flow when storage is unavailable.
  }
  return false;
}

function cleanAttributionValue(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const cleaned = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanCampaignValue(value, maxLength) {
  const cleaned = cleanAttributionValue(value, maxLength);
  if (!cleaned) return null;
  // Campaign labels are allowed only when they do not look like contact data.
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(cleaned)) return null;
  if (/^\+?[\d\s()./-]{8,}$/.test(cleaned) && cleaned.replace(/\D/g, '').length >= 8) return null;
  return cleaned;
}

function analyticsPath(path) {
  if (typeof window === 'undefined') return '/';
  try {
    return new URL(path || window.location.pathname, window.location.origin).pathname || '/';
  } catch {
    return window.location.pathname || '/';
  }
}

function captureCurrentAttribution() {
  if (typeof window === 'undefined') return null;
  try {
    // Purge the old value, which could contain the entire query and referrer.
    window.sessionStorage.removeItem('kn_attribution_v1');
  } catch {
    // Tracking must not block the product flow when storage is unavailable.
  }
  const statisticsConsent = hasConsent('statistics');
  const marketingConsent = hasConsent('marketing');
  if (!statisticsConsent && !marketingConsent) return null;

  const params = new URLSearchParams(window.location.search);
  const current = {
    source: cleanCampaignValue(params.get('utm_source'), 120),
    medium: cleanCampaignValue(params.get('utm_medium'), 120),
    campaign: cleanCampaignValue(params.get('utm_campaign'), 180),
    content: cleanCampaignValue(params.get('utm_content'), 180),
    landingPage: cleanAttributionValue(window.location.pathname, 500),
    referrer: null,
    device: window.matchMedia?.('(max-width: 767px)')?.matches ? 'mobile' : 'desktop',
    gclid: marketingConsent ? cleanCampaignValue(params.get('gclid'), 200) : null,
    gbraid: marketingConsent ? cleanCampaignValue(params.get('gbraid'), 200) : null,
    wbraid: marketingConsent ? cleanCampaignValue(params.get('wbraid'), 200) : null,
  };
  const hasCampaignData = Object.entries(current).some(([key, value]) =>
    !['landingPage', 'referrer', 'device'].includes(key) && Boolean(value)
  );

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) || 'null');
    if (stored && !hasCampaignData) return stored;
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Fall back to the current page without persistence.
  }
  return current;
}

export function getLeadAttribution() {
  const consentGranted = hasConsent('statistics') || hasConsent('marketing');
  return {
    analyticsConsent: consentGranted,
    attribution: consentGranted ? captureCurrentAttribution() : null,
  };
}

// Conversion-Aktionen werden ausschliesslich aus der Google-Ads-Konfiguration
// übernommen. Die GA4-Measurement-ID darf hier nicht wiederverwendet werden.
// Ohne Label bleibt die Ads-Ausleitung bewusst deaktiviert.
// This is a public Google Ads destination (not a secret). Keep the
// production fallback here so tracking remains active even when a deployment
// was created before the corresponding Vercel environment variable existed.
// The environment variable still takes precedence if it is configured.
const GOOGLE_ADS_LEAD_CONVERSION = import.meta.env.MODE === 'production'
  ? String(import.meta.env.VITE_GOOGLE_ADS_LEAD_CONVERSION || 'AW-18411030300/3ZgACPLJiekcEJyOiMtE').trim()
  : '';

const GOOGLE_ADS_NEWSLETTER_CONVERSION = import.meta.env.MODE === 'production'
  ? String(import.meta.env.VITE_GOOGLE_ADS_NEWSLETTER_CONVERSION || '').trim()
  : '';

const GOOGLE_ADS_SIGNUP_CONVERSION = import.meta.env.MODE === 'production'
  ? String(import.meta.env.VITE_GOOGLE_ADS_SIGNUP_CONVERSION || '').trim()
  : '';

/** Optionales Google-Ads-Conversion-Event für erfolgreich gesendete Leads. */
export function trackAdsLeadConversion(courseId, eventId) {
  if (!GOOGLE_ADS_LEAD_CONVERSION) return;
  gtagSafe('marketing', 'event', 'conversion', {
    send_to: GOOGLE_ADS_LEAD_CONVERSION,
    currency: 'CHF',
    value: 0,
    ...(eventId ? { transaction_id: eventId } : {}),
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

/** Optionales Google-Ads-Conversion-Event für eine erfolgreiche Registrierung. */
export function trackAdsSignupConversion() {
  if (!GOOGLE_ADS_SIGNUP_CONVERSION) return;
  gtagSafe('marketing', 'event', 'conversion', {
    send_to: GOOGLE_ADS_SIGNUP_CONVERSION,
    currency: 'CHF',
    value: 0,
  });
}

/** SPA Pageview — wird bei jedem Routenwechsel aufgerufen */
export function trackPageView(path, title) {
  captureCurrentAttribution();
  gtagSafe('statistics', 'event', 'page_view', {
    page_path: analyticsPath(path),
    page_title: title,
  });
  contentsquareSafe('Page Viewed');
}

/** Google-Ads-Landingpage angesehen (GA4, kein personenbeziehbarer Wert). */
export function trackCampaignView(slug) {
  if (!slug) return;
  gtagSafe('statistics', 'event', 'campaign_landing_view', { campaign_slug: slug });
  gtagSafe('statistics', 'event', 'landing_view', { landing_type: 'campaign', campaign_slug: slug });
  contentsquareSafe('Campaign Landing Viewed');
}

/** CTA auf einer Google-Ads-Landingpage angeklickt (GA4). */
export function trackCampaignCta(slug, destination = 'search') {
  if (!slug) return;
  gtagSafe('statistics', 'event', 'campaign_landing_cta', {
    campaign_slug: slug,
    destination,
  });
  contentsquareSafe('Campaign CTA Clicked');
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
  gtagSafe('statistics', 'event', 'course_detail_view', {
    item_id: String(course.id),
    booking_type: course.booking_type || 'lead',
  });
  contentsquareSafe('Course Detail Viewed');
}

/** Suche ausgeführt */
export function trackSearch(query, resultCount) {
  gtagSafe('statistics', 'event', 'search', {
    has_search_term: Boolean(String(query || '').trim()),
    result_count: resultCount,
  });
  gtagSafe('statistics', 'event', 'search_view', {
    has_search_term: Boolean(String(query || '').trim()),
    result_count: resultCount,
  });
  contentsquareSafe('Search Results Viewed');
}

export function trackCourseCardCta(course, placement = 'search_card') {
  gtagSafe('statistics', 'event', 'course_card_cta_click', {
    item_id: String(course.id),
    booking_type: course.booking_type || 'lead',
    placement,
  });
  contentsquareSafe('Course Card CTA Clicked');
}

export function trackLeadFormStart(courseId, eventId) {
  gtagSafe('statistics', 'event', 'lead_form_start', {
    item_id: String(courseId),
    ...(eventId ? { event_id: eventId } : {}),
  });
  contentsquareSafe('Course Inquiry Form Started');
}

export function trackLeadSubmitted(courseId, eventId) {
  if (conversionAlreadyTracked('generate_lead_course_inquiry', eventId)) return;
  const params = {
    lead_type: 'course_inquiry',
    item_id: String(courseId),
    ...(eventId ? { event_id: eventId } : {}),
  };
  // Keep the operational event for existing reports; only generate_lead is a
  // GA4 key event, so this does not count a second conversion.
  gtagSafe('statistics', 'event', 'lead_submitted', params);
  gtagSafe('statistics', 'event', 'generate_lead', params);
  contentsquareSafe('Course Inquiry Submitted');
  trackAdsLeadConversion(courseId, eventId);
}

export function trackLeadDelivered(courseId, eventId) {
  if (conversionAlreadyTracked('lead_delivered', eventId)) return;
  gtagSafe('statistics', 'event', 'lead_delivered', {
    item_id: String(courseId),
    ...(eventId ? { event_id: eventId } : {}),
  });
  contentsquareSafe('Course Inquiry Delivered');
}

export function trackBookingStart(course, eventId) {
  gtagSafe('statistics', 'event', 'booking_start', {
    item_id: String(course.id),
    booking_type: course.booking_type || 'platform',
    ...(eventId ? { event_id: eventId } : {}),
  });
}

/** Buchung abgeschlossen (E-Commerce: purchase) */
export function trackPurchase(course, bookingId, amountCents, eventId = bookingId) {
  if (conversionAlreadyTracked('booking_completed', eventId)) return;
  gtagSafe('statistics', 'event', 'booking_completed', {
    transaction_id: bookingId,
    event_id: eventId,
    currency: 'CHF',
    value: amountCents / 100,
    item_id: String(course.id),
  });
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
  contentsquareSafe('Course Booking Completed');
}

/** Registrierung */
export function trackSignup(method) {
  gtagSafe('statistics', 'event', 'sign_up', { method });
  contentsquareSafe('User Signup');
  trackAdsSignupConversion();
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
export function trackNewsletter(eventId = createAnalyticsEventId('newsletter')) {
  if (conversionAlreadyTracked('generate_lead_newsletter', eventId)) return;
  gtagSafe('statistics', 'event', 'generate_lead', {
    lead_type: 'newsletter',
    event_id: eventId,
  });
  contentsquareSafe('Newsletter Signup');
  trackAdsNewsletterConversion();
}

/** Kontaktanfrage / Lead */
export function trackContactLead(courseId) {
  const eventId = createAnalyticsEventId('lead');
  trackLeadSubmitted(courseId, eventId);
}
