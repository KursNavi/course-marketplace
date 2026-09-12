import { beforeEach, describe, expect, it } from 'vitest';
import { trackContactLead, trackPageView, trackNewsletter, trackSignup } from '../src/lib/analytics.js';

describe('Google tracking consent boundaries', () => {
  let calls;

  beforeEach(() => {
    calls = [];
    window.gtag = (...args) => calls.push(args);
    window._uxa = [];
    window.Cookiebot = { consent: { statistics: false, marketing: false } };
  });

  it('does not send analytics or Ads events without consent', () => {
    trackPageView('/kampagne/test', 'Test');
    trackContactLead('course-1');
    trackNewsletter();
    trackSignup('email');

    expect(calls).toEqual([]);
    expect(window._uxa).toEqual([]);
  });

  it('sends the GA4 lead event only with statistics consent', () => {
    window.Cookiebot.consent.statistics = true;
    trackContactLead('course-1');

    expect(calls).toContainEqual([
      'event',
      'generate_lead',
      { event_category: 'contact', item_id: 'course-1' },
    ]);
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
});
