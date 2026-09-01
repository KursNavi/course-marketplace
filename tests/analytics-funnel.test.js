import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  trackCampaignView,
  trackCampaignCta,
  trackLeadModalOpen,
  trackLeadCtaClick,
  trackLeadFormStart,
  trackLeadValidationError,
  trackLeadSubmitError,
  hasGoogleAdsAttribution,
} from '../src/lib/analytics';

describe('Google-Ads-Funnel-Tracking', () => {
  beforeEach(() => {
    window.gtag = vi.fn();
    delete window.Cookiebot;
  });

  it('tracks campaign landing page and CTA without personal data', () => {
    trackCampaignView('fitness-sportausbildungen');
    trackCampaignCta('fitness-sportausbildungen', 'search');

    expect(window.gtag).toHaveBeenNthCalledWith(
      1,
      'event',
      'campaign_landing_view',
      { campaign_slug: 'fitness-sportausbildungen' },
    );
    expect(window.gtag).toHaveBeenNthCalledWith(
      2,
      'event',
      'campaign_landing_cta',
      { campaign_slug: 'fitness-sportausbildungen', destination: 'search' },
    );
  });

  it('tracks lead intent and categorizes errors without error messages or field values', () => {
    trackLeadModalOpen('course-123');
    trackLeadCtaClick('course-123');
    trackLeadFormStart('course-123');
    trackLeadValidationError('course-123', 'email');
    trackLeadSubmitError('course-123', 'http');

    expect(window.gtag).toHaveBeenNthCalledWith(1, 'event', 'lead_modal_open', { course_id: 'course-123' });
    expect(window.gtag).toHaveBeenNthCalledWith(2, 'event', 'lead_cta_click', { course_id: 'course-123' });
    expect(window.gtag).toHaveBeenNthCalledWith(3, 'event', 'lead_form_start', { course_id: 'course-123' });
    expect(window.gtag).toHaveBeenNthCalledWith(4, 'event', 'lead_form_validation_error', {
      course_id: 'course-123',
      field: 'email',
    });
    expect(window.gtag).toHaveBeenNthCalledWith(5, 'event', 'lead_submit_error', {
      course_id: 'course-123',
      error_type: 'http',
    });
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain('test@example.com');
  });

  it('ignores empty campaign slugs and normalizes unknown error types', () => {
    trackCampaignView('');
    trackCampaignCta(null);
    trackLeadSubmitError('course-123', 'server-stack-trace');

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'lead_submit_error', {
      course_id: 'course-123',
      error_type: 'unknown',
    });
  });

  it('does not emit funnel events without statistics consent when Cookiebot is present', () => {
    window.Cookiebot = { consent: { statistics: false } };

    trackCampaignView('fitness-sportausbildungen');
    trackLeadModalOpen('course-123');

    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('recognizes Google Ads attribution markers without accepting arbitrary query data', () => {
    expect(hasGoogleAdsAttribution({ search: '?gclid=abc123' })).toBe(true);
    expect(hasGoogleAdsAttribution({ search: '?utm_source=google&utm_medium=cpc' })).toBe(true);
    expect(hasGoogleAdsAttribution({ search: '?utm_source=google&utm_medium=organic' })).toBe(false);
    expect(hasGoogleAdsAttribution({ search: '?utm_source=bing&utm_medium=cpc' })).toBe(false);
  });
});
