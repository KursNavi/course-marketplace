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

/** SPA Pageview — wird bei jedem Routenwechsel aufgerufen */
export function trackPageView(path, title) {
  gtagSafe('event', 'page_view', {
    page_path: path,
    page_title: title,
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
  gtagSafe('event', 'generate_lead', {
    event_category: 'contact',
    item_id: courseId,
  });
}
