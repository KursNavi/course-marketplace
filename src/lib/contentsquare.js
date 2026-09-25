const CONTENTSQUARE_NEWSLETTER_SUCCESS_PATH = '/contentsquare/newsletter-success';

function hasStatisticsConsent() {
  return typeof window !== 'undefined'
    && window.Cookiebot?.consent?.statistics === true;
}

function isInternalRoute(pathname) {
  let path = pathname || '/';
  if (path.startsWith('/app/')) path = `/${path.slice('/app/'.length)}`;
  return path === '/dashboard'
    || path === '/create-course'
    || path === '/admin-blog'
    || path.startsWith('/control-room-2025');
}

function getSafePath(pathname) {
  if (typeof window !== 'undefined' && typeof window.__kursnaviContentsquareSafePath === 'function') {
    return window.__kursnaviContentsquareSafePath(pathname);
  }
  return '/other';
}

function queuePageEvent(eventName) {
  if (!hasStatisticsConsent() || isInternalRoute(window.location.pathname)) return;
  window._uxa = window._uxa || [];
  window._uxa.push(['trackPageEvent', eventName]);
}

/** Track only actual pathname changes; filter query-string updates stay on one page. */
export function trackContentsquareRouteChange() {
  if (typeof window === 'undefined') return;

  const pathname = window.location.pathname || '/';
  const previousPathname = window.__kursnaviContentsquareObservedPath;
  window.__kursnaviContentsquareObservedPath = pathname;
  if (previousPathname === pathname || !hasStatisticsConsent() || isInternalRoute(pathname)) return;

  window._uxa = window._uxa || [];
  window._uxa.push(['trackPageview', getSafePath(pathname)]);
}

/** Mark a new newsletter signup with a URL-like funnel step containing no PII. */
export function trackContentsquareNewsletterSuccess() {
  if (typeof window === 'undefined' || !hasStatisticsConsent() || isInternalRoute(window.location.pathname)) return;
  window._uxa = window._uxa || [];
  window._uxa.push(['trackPageview', CONTENTSQUARE_NEWSLETTER_SUCCESS_PATH]);
}

/** Mark a filter change without sending its selected values or search text. */
export function trackContentsquareSearchFilterApplied() {
  queuePageEvent('Search Filters Applied');
}
