import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLeadAttribution,
  trackContactLead,
  trackLeadDelivered,
  trackNewsletterSignup,
  trackPageView,
  trackPurchase,
  trackSearch,
  trackSignup,
} from '../src/lib/analytics.js';

describe('Google tracking consent boundaries', () => {
  let calls;

  beforeEach(() => {
    calls = [];
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    window.gtag = (...args) => calls.push(args);
    window._uxa = [];
    window.Cookiebot = { consent: { statistics: false, marketing: false } };
    delete window.__kursnaviEnsureGoogleTag;
  });

  it('does not send analytics or Ads events without consent', () => {
    trackPageView('/kampagne/test', 'Test');
    trackContactLead('course-1');
    trackNewsletterSignup();
    trackSignup('email');

    expect(calls).toEqual([]);
    expect(window._uxa).toEqual([]);
  });

  it('sends newsletter signups as their own event, never as generate_lead', () => {
    window.Cookiebot.consent.statistics = true;
    trackNewsletterSignup();

    expect(calls.some(([command, event]) => command === 'event' && event === 'newsletter_signup')).toBe(true);
    expect(calls.some(([command, event]) => command === 'event' && event === 'generate_lead')).toBe(false);
    expect(window._uxa).toContainEqual(['trackPageEvent', 'Newsletter Signup']);
  });

  it('asks index.html to configure the Google tag before queuing a GA4 event (race-condition guard)', () => {
    // Simuliert genau die Produktionsbeobachtung: Cookiebot meldet bereits
    // statistics: true, aber das CookiebotOnConsentReady-Event in index.html
    // hat die gtag-"config"-Befehle noch nicht ausgelöst. window.gtag ist
    // zwar schon eine Funktion (der Stub aus index.html), ohne diese
    // Absicherung würde das Event trotzdem vor "config" im dataLayer landen.
    window.Cookiebot.consent.statistics = true;
    let configuredBeforeEvent = null;
    window.__kursnaviEnsureGoogleTag = () => {
      configuredBeforeEvent = calls.length === 0;
      calls.push(['config', 'G-F0TZT2L4YY']);
    };

    trackPageView(
      '/courses/sport-fitness/st-gallen/394-ganzkoerpertraining-bodyforming',
      'Ganzkörpertraining / Bodyforming in St. Gallen | KursNavi'
    );

    expect(configuredBeforeEvent).toBe(true);
    const configIndex = calls.findIndex(([command]) => command === 'config');
    const pageViewIndex = calls.findIndex(([, event]) => event === 'page_view');
    expect(configIndex).toBeGreaterThanOrEqual(0);
    expect(configIndex).toBeLessThan(pageViewIndex);
    // Genau ein page_view - die Absicherung darf keinen zweiten erzeugen.
    expect(calls.filter(([, event]) => event === 'page_view')).toHaveLength(1);
  });

  it('sends the GA4 lead event only with statistics consent', () => {
    window.Cookiebot.consent.statistics = true;
    trackContactLead('course-1');

    expect(calls.some(([command, event]) => command === 'event' && event === 'lead_submitted')).toBe(true);
    expect(calls.some(([command, event]) => command === 'event' && event === 'lead_delivered')).toBe(false);
    expect(calls.some(([command, event]) => command === 'event' && event === 'generate_lead')).toBe(true);
    expect(calls.some(([, event]) => event === 'conversion')).toBe(false);
    expect(window._uxa).toContainEqual(['trackPageEvent', 'Course Inquiry Submitted']);
  });

  it('queues only constant, non-identifying Contentsquare events with statistics consent', () => {
    window.Cookiebot.consent.statistics = true;

    trackPageView('/search?q=private', 'Private title');
    trackContactLead('private-course-id');

    expect(window._uxa).toEqual([
      ['trackPageEvent', 'Page Viewed'],
      ['trackPageEvent', 'Course Inquiry Submitted'],
    ]);
  });

  it('removes query strings and referrers from GA4 page context', () => {
    window.Cookiebot.consent.statistics = true;
    window.history.replaceState({}, '', '/search?q=private@example.com');

    trackPageView('/search?q=private@example.com', 'Private search');

    const pageView = calls.find(([command, event]) => command === 'event' && event === 'page_view');
    expect(pageView[2]).toMatchObject({
      page_path: '/search',
      page_location: `${window.location.origin}/search`,
      page_referrer: '',
    });
    expect(JSON.stringify(calls)).not.toContain('private@example.com');
  });

  it('does not queue public UX events on private dashboard routes', () => {
    window.Cookiebot.consent.statistics = true;
    window.history.replaceState({}, '', '/dashboard');

    trackPageView('/dashboard', 'Dashboard');
    trackContactLead('course-1');

    expect(window._uxa).toEqual([]);
  });

  it('queues a generic booking completion event with statistics consent', () => {
    window.Cookiebot.consent.statistics = true;
    trackPurchase({ id: 'course-1', title: 'Testkurs', category_area: 'gesundheit' }, 'booking-1', 12000);

    expect(window._uxa).toEqual([
      ['trackPageEvent', 'Course Booking Completed'],
    ]);
  });

  it('never sends a freely entered search phrase to analytics', () => {
    window.Cookiebot.consent.statistics = true;
    trackSearch('sara@example.com persönlicher Kurs', 4);

    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain('sara@example.com');
    expect(serialized).not.toContain('persönlicher Kurs');
    expect(calls).toContainEqual([
      'event',
      'search_view',
      expect.objectContaining({ has_search_term: true, result_count: 4 }),
    ]);
  });

  it('deduplicates a delivered lead event by event id', () => {
    window.Cookiebot.consent.statistics = true;
    trackLeadDelivered('course-1', 'event-123');
    trackLeadDelivered('course-1', 'event-123');

    expect(calls.filter(([, event]) => event === 'lead_delivered')).toHaveLength(1);
  });

  it('records a paid booking exactly once for a Stripe session', () => {
    window.Cookiebot.consent.statistics = true;
    const course = { id: 42, title: 'Keramikkurs', category_area: 'Kunst', booking_type: 'platform' };

    trackPurchase(course, 7001, 12500, 'cs_test_once');
    trackPurchase(course, 7001, 12500, 'cs_test_once');

    expect(calls.filter(([, event]) => event === 'booking_completed')).toHaveLength(1);
    expect(calls.filter(([, event]) => event === 'purchase')).toHaveLength(1);
    expect(calls).toContainEqual([
      'event',
      'purchase',
      expect.objectContaining({ transaction_id: 7001, currency: 'CHF', value: 125 }),
    ]);
  });

  it('returns attribution only when consent was granted', () => {
    window.history.replaceState({}, '', '/courses/yoga/zuerich?utm_source=google&utm_medium=cpc&gclid=abc');
    expect(getLeadAttribution()).toEqual({ analyticsConsent: false, attribution: null });

    window.Cookiebot.consent.statistics = true;
    const statisticsOnly = getLeadAttribution();
    expect(statisticsOnly.analyticsConsent).toBe(true);
    expect(statisticsOnly.attribution.source).toBe('google');
    expect(statisticsOnly.attribution.gclid).toBeNull();

    window.Cookiebot.consent.marketing = true;
    window.sessionStorage.removeItem('kn_attribution_v1');
    expect(getLeadAttribution().attribution.gclid).toBe('abc');
  });
});
