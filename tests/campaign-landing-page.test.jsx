import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignLandingPage from '../src/components/CampaignLandingPage';
import { getCampaignLanding } from '../src/lib/campaignLandingConfig';
import { CANONICAL_BASE_URL } from '../src/lib/siteConfig';

const makeCourse = (id, title) => ({
  id,
  title,
  instructor_name: 'BTB',
  status: 'published',
  category_type: 'professionell',
  image_url: null,
});

describe('CampaignLandingPage', () => {
  beforeEach(() => {
    window.Cookiebot = { consent: { statistics: false, marketing: false } };
    window.gtag = vi.fn();
  });

  afterEach(() => {
    cleanup();
    delete window.Cookiebot;
    delete window.gtag;
  });

  it('shows matching offers only when the configured offer floor is met', () => {
    render(
      <CampaignLandingPage
        slug="fitnesstrainer-ausbildung"
        courses={[
          makeCourse(1, 'Ausbildung Fitnesstrainer/in B-Lizenz'),
          makeCourse(2, 'Ausbildung Fitnesstrainer/in A-Lizenz'),
          makeCourse(3, 'Ausbildung Ernährungsberater/in'),
        ]}
        setView={vi.fn()}
        setSelectedCourse={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Fitnesstrainer-Ausbildung finden' })).toBeInTheDocument();
    expect(screen.getByText('Ausbildung Fitnesstrainer/in B-Lizenz')).toBeInTheDocument();
    expect(screen.queryByText('Ausbildung Ernährungsberater/in')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /angebote ansehen/i })).toHaveAttribute(
      'href',
      '/search?type=beruflich&q=Fitnesstrainer+Ausbildung'
    );
  });

  it('suppresses the Ads CTA when the offer floor is not met', () => {
    render(<CampaignLandingPage slug="fitnesstrainer-ausbildung" courses={[makeCourse(1, 'Ausbildung Fitnesstrainer/in B-Lizenz')]} />);
    expect(screen.getByText('Diese Kampagnenseite ist noch nicht startbereit.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /angebote ansehen/i })).not.toBeInTheDocument();
  });

  it('never renders drafts or expired offers', () => {
    render(
      <CampaignLandingPage
        slug="fitnesstrainer-ausbildung"
        courses={[
          { ...makeCourse(1, 'Entwurf Fitnesstrainer'), status: 'draft' },
          { ...makeCourse(2, 'Abgelaufene Fitnesstrainer-Ausbildung'), start_date: '2020-01-01' },
        ]}
      />
    );
    expect(screen.queryByText('Entwurf Fitnesstrainer')).not.toBeInTheDocument();
    expect(screen.queryByText('Abgelaufene Fitnesstrainer-Ausbildung')).not.toBeInTheDocument();
    expect(screen.getByText('Diese Kampagnenseite ist noch nicht startbereit.')).toBeInTheDocument();
  });

  it('sets canonical and noindex metadata for direct SPA navigation', () => {
    render(<CampaignLandingPage slug="fitnesstrainer-ausbildung" courses={[]} />);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${CANONICAL_BASE_URL}/kampagne/fitnesstrainer-ausbildung`
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  });

  it('keeps the football CTA independent from mutable taxonomy area IDs', () => {
    const config = getCampaignLanding('fussballcamps');
    expect(config.searchParams).toEqual({ type: 'kinder_jugend', q: 'Fussballcamp' });
    expect(config.searchParams.area).toBeUndefined();
  });

  it('sends one campaign view after statistics consent arrives late', () => {
    render(<CampaignLandingPage slug="fitnesstrainer-ausbildung" courses={[]} />);
    expect(window.gtag).not.toHaveBeenCalled();

    window.Cookiebot.consent.statistics = true;
    window.dispatchEvent(new Event('CookiebotOnAccept'));

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag.mock.calls[0]).toEqual([
      'event',
      'campaign_landing_view',
      { campaign_slug: 'fitnesstrainer-ausbildung' },
    ]);
  });
});
