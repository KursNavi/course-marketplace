import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const { mockGetBereichBySlug } = vi.hoisted(() => ({
  mockGetBereichBySlug: vi.fn(),
}));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  BEREICH_LANDING_CONFIG: {},
  findSzenario: (config, scenarioSlug) => config?.scenarios?.find((scenario) => scenario.slug === scenarioSlug) || null,
  getBereichBySlug: mockGetBereichBySlug,
  getBereichUrl: () => '/bereich/beruflich/test-bereich',
}));
vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({ areas: [] }),
}));
vi.mock('../src/lib/constants', () => ({
  SEGMENT_CONFIG: {
    beruflich: {
      label: { de: 'Beruflich' }, bgLight: 'bg-orange-50', text: 'text-orange-700',
      borderLight: 'border-orange-200', gradient: 'from-orange-600 to-orange-700',
    },
  },
}));
vi.mock('../src/lib/segmentLandingConfig', () => ({ SEGMENT_LANDING_CONFIG: {} }));
vi.mock('../src/lib/siteConfig', () => ({ BASE_URL: 'https://test.kursnavi.ch' }));
vi.mock('../src/lib/seoUtils', () => ({
  buildFaqPageJsonLd: () => ({}),
  buildArticleJsonLd: () => ({}),
  buildBreadcrumbJsonLd: () => ({}),
  enhanceImages: (html) => html,
  wrapTables: (html) => html,
  estimateReadingTime: () => 1,
}));
vi.mock('../src/lib/navigation', () => ({ shouldHandleClientNavigation: () => false }));
vi.mock('../src/lib/themeWorldFeatureFlag', () => ({
  isThemeWorldDbEnabled: () => false,
  isThemeWorldPilotActive: () => false,
  loadThemeWorldWithFallback: vi.fn(),
}));
vi.mock('../src/lib/themeWorldService', () => ({
  fetchThemeWorld: vi.fn(), fetchPublishedScenario: vi.fn(), fetchThemeWorldPage: vi.fn(),
}));
vi.mock('../src/lib/themeWorldAdapter', () => ({
  adaptToLegacyBereichConfig: vi.fn(), adaptToLegacySzenarioConfig: vi.fn(),
}));
vi.mock('../src/lib/courseMetadata', () => ({ normalizeDeliveryTypeKey: (value) => value }));
vi.mock('../src/components/RegionalDiscoverySection', () => ({ default: () => null }));

import BereichLandingPage from '../src/components/BereichLandingPage.jsx';
import SzenarioArtikelView from '../src/components/SzenarioArtikelView.jsx';

const scenario = {
  slug: 'berufseinstieg',
  icon: '🎓',
  label: { de: 'Berufseinstieg als Trainer' },
  text: { de: 'Starte deine Laufbahn.' },
  ctaLabel: { de: 'Kurse entdecken' },
  searchParams: {},
};

function buildConfig(scenarioOverrides = {}) {
  return {
    key: 'test_bereich', slug: 'test-bereich', segment: 'beruflich', typeKey: 'beruflich', areaSlug: 'test_bereich',
    title: { de: 'Testbereich' }, subtitle: { de: 'Testangebote' }, heroImage: null, heroImageAlt: '',
    scenarios: [{ ...scenario, ...scenarioOverrides }], specialtyDescriptions: {}, predefinedSearches: [],
    editorialSections: [], faqs: [], trustLogos: [], regionalDiscovery: null, ctaLinks: [],
    sectionTitles: {},
  };
}

beforeEach(() => {
  document.head.innerHTML = '';
  mockGetBereichBySlug.mockImplementation((_segment, slug) => {
    if (slug !== 'test-bereich') return null;
    return buildConfig();
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('öffentliche Szenario-Medien', () => {
  it('zeigt ein vorhandenes Kartenbild mit dem redaktionellen Alt-Text', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      cardImageUrl: 'https://cdn.example.com/card.jpg',
      cardImageAlt: 'Trainerin erklärt eine Übung',
    }));

    render(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);

    const image = screen.getByTestId('scenario-card-image-berufseinstieg');
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/card.jpg');
    expect(image).toHaveAttribute('alt', 'Trainerin erklärt eine Übung');
  });

  it('nutzt den Szenario-Titel als Alt-Text-Fallback und behält ohne Bild den Icon-Fallback', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      cardImageUrl: 'https://cdn.example.com/card.jpg', cardImageAlt: '',
    }));
    const { rerender } = render(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);
    expect(screen.getByTestId('scenario-card-image-berufseinstieg')).toHaveAttribute('alt', 'Berufseinstieg als Trainer');

    mockGetBereichBySlug.mockReturnValue(buildConfig());
    rerender(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);
    expect(screen.queryByTestId('scenario-card-image-berufseinstieg')).toBeNull();
    expect(screen.getAllByText('🎓').length).toBeGreaterThan(0);
  });

  it('setzt das Szenario-OG-Bild und dessen Alt-Text', async () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      ogImageUrl: 'https://cdn.example.com/scenario-og.jpg',
      ogImageAlt: 'Trainer im modernen Fitnessstudio',
    }));

    render(<SzenarioArtikelView segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]} />);

    await waitFor(() => {
      expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'https://cdn.example.com/scenario-og.jpg');
      expect(document.querySelector('meta[property="og:image:alt"]')).toHaveAttribute('content', 'Trainer im modernen Fitnessstudio');
    });
  });

  it('behält og-default.png, wenn kein Szenario-OG-Bild vorhanden ist', async () => {
    render(<SzenarioArtikelView segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]} />);

    await waitFor(() => {
      expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'https://test.kursnavi.ch/og-default.png');
      expect(document.querySelector('meta[property="og:image:alt"]')).toBeNull();
    });
  });
});
