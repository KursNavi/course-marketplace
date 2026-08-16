/**
 * Hydration-SEO: meta_title / meta_description als erste Quelle.
 *
 * Der statische Prerender (api/_lib/theme-world-prerender.js) schreibt die
 * redaktionellen SEO-Felder aus der Datenbank in das erste Server-HTML. Die
 * React-Komponenten müssen nach der Hydration exakt dieselben Werte setzen —
 * sonst überschreibt der Client das, was Google zuerst gesehen hat.
 *
 * Verifiziert:
 *   1. BereichLandingPage nutzt metaTitle/metaDescription, wenn vorhanden
 *   2. BereichLandingPage fällt ohne diese Felder auf Titel/Subtitle zurück
 *      (Legacy-Konfigurationen haben keine SEO-Felder)
 *   3. SzenarioArtikelView nutzt metaTitle/metaDescription, wenn vorhanden
 *   4. SzenarioArtikelView fällt ohne diese Felder auf Label/Teaser zurück
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const { mockGetBereichBySlug } = vi.hoisted(() => ({
  mockGetBereichBySlug: vi.fn(),
}));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  BEREICH_LANDING_CONFIG: {},
  findSzenario: (config, scenarioSlug) =>
    config?.scenarios?.find((scenario) => scenario.slug === scenarioSlug) || null,
  getBereichBySlug: mockGetBereichBySlug,
  getBereichUrl: () => '/bereich/beruflich/test-bereich',
}));
vi.mock('../src/hooks/useTaxonomy', () => ({ useTaxonomy: () => ({ areas: [] }) }));
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

const DB_META_TITLE = 'Fotografie & Kreativkurse Schweiz | KursNavi';
const DB_META_DESCRIPTION = 'Redaktionelle Beschreibung aus der Datenbank.';
const SCENARIO_META_TITLE = 'Erste Kamera kaufen: Ratgeber | KursNavi';
const SCENARIO_META_DESCRIPTION = 'Redaktionelle Szenario-Beschreibung aus der Datenbank.';

const baseScenario = {
  slug: 'berufseinstieg',
  icon: '🎓',
  label: { de: 'Berufseinstieg als Trainer' },
  text: { de: 'Starte deine Laufbahn.' },
  ctaLabel: { de: 'Kurse entdecken' },
  searchParams: {},
};

function buildConfig({ configOverrides = {}, scenarioOverrides = {} } = {}) {
  return {
    key: 'test_bereich', slug: 'test-bereich', segment: 'beruflich', typeKey: 'beruflich',
    areaSlug: 'test_bereich',
    title: { de: 'Testbereich' }, subtitle: { de: 'Testangebote' },
    heroImage: null, heroImageAlt: '',
    scenarios: [{ ...baseScenario, ...scenarioOverrides }],
    specialtyDescriptions: {}, predefinedSearches: [], editorialSections: [],
    faqs: [], trustLogos: [], regionalDiscovery: null, ctaLinks: [], sectionTitles: {},
    ...configOverrides,
  };
}

function metaDescription() {
  return document.querySelector('meta[name="description"]')?.getAttribute('content');
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BereichLandingPage: SEO-Quelle', () => {
  it('1. nutzt metaTitle und metaDescription aus der Datenbank', async () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      configOverrides: { metaTitle: DB_META_TITLE, metaDescription: DB_META_DESCRIPTION },
    }));

    render(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);

    await waitFor(() => {
      expect(document.title).toBe(DB_META_TITLE);
      expect(metaDescription()).toBe(DB_META_DESCRIPTION);
      expect(document.querySelector('meta[property="og:title"]'))
        .toHaveAttribute('content', DB_META_TITLE);
      expect(document.querySelector('meta[property="og:description"]'))
        .toHaveAttribute('content', DB_META_DESCRIPTION);
    });
  });

  it('2. fällt ohne SEO-Felder auf sichtbaren Titel und Subtitle zurück (Legacy)', async () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig());

    render(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);

    await waitFor(() => {
      expect(document.title).toBe('Testbereich | KursNavi');
      expect(metaDescription()).toBe('Testangebote');
    });
  });
});

describe('SzenarioArtikelView: SEO-Quelle', () => {
  it('3. nutzt metaTitle und metaDescription des Szenarios', async () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      scenarioOverrides: {
        metaTitle: SCENARIO_META_TITLE,
        metaDescription: SCENARIO_META_DESCRIPTION,
      },
    }));

    render(
      <SzenarioArtikelView
        segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]}
      />
    );

    await waitFor(() => {
      expect(document.title).toBe(SCENARIO_META_TITLE);
      expect(metaDescription()).toBe(SCENARIO_META_DESCRIPTION);
      expect(document.querySelector('meta[property="og:title"]'))
        .toHaveAttribute('content', SCENARIO_META_TITLE);
    });
  });

  it('4. fällt ohne SEO-Felder auf Label und Teaser zurück (Legacy)', async () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig());

    render(
      <SzenarioArtikelView
        segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]}
      />
    );

    await waitFor(() => {
      expect(document.title).toBe('Berufseinstieg als Trainer — Testbereich | KursNavi');
      expect(metaDescription()).toBe('Starte deine Laufbahn.');
    });
  });
});
