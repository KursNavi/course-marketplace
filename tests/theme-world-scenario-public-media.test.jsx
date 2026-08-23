import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const { mockGetBereichBySlug, mockSzenarioContent } = vi.hoisted(() => ({
  mockGetBereichBySlug: vi.fn(),
  // Veränderbare Artikeltext-Ablage: einzelne Tests legen hier HTML ab, um den
  // Doppelbild-Schutz der Detailseite zu prüfen.
  mockSzenarioContent: {},
}));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  // Der Key wird gebraucht, damit die Detailseite überhaupt einen Artikeltext
  // aus SZENARIO_CONTENT nachschlagen kann.
  BEREICH_LANDING_CONFIG: { test_bereich: { slug: 'test-bereich' } },
  findSzenario: (config, scenarioSlug) => config?.scenarios?.find((scenario) => scenario.slug === scenarioSlug) || null,
  getBereichBySlug: mockGetBereichBySlug,
  getBereichUrl: () => '/bereich/beruflich/test-bereich',
}));
vi.mock('../src/lib/szenarioContent', () => ({ SZENARIO_CONTENT: mockSzenarioContent }));
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
  Object.keys(mockSzenarioContent).forEach((key) => delete mockSzenarioContent[key]);
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

  it('rendert das Kartenbild als breites Titelbild oben in der Kachel', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      cardImageUrl: 'https://cdn.example.com/card.jpg',
      cardImageAlt: 'Trainerin erklärt eine Übung',
    }));

    render(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);

    const media = screen.getByTestId('scenario-card-media-berufseinstieg');
    const image = screen.getByTestId('scenario-card-image-berufseinstieg');

    // Das Bild sitzt im Bildband, nicht in einer 56px-Icon-Box.
    expect(media).toContainElement(image);
    // Einheitliches Seitenverhältnis, beschnitten statt verzerrt.
    expect(media.className).toContain('aspect-video');
    expect(image.className).toContain('object-cover');
    // Volle Kartenbreite statt fixer Kachelgröße.
    expect(image.className).toContain('w-full');
  });

  it('hält Icon und Titel getrennt unterhalb des Bildes', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      cardImageUrl: 'https://cdn.example.com/card.jpg',
      cardImageAlt: 'Trainerin erklärt eine Übung',
    }));

    render(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);

    const media = screen.getByTestId('scenario-card-media-berufseinstieg');
    const icon = screen.getByTestId('scenario-card-icon-berufseinstieg');
    const title = screen.getByTestId('scenario-card-title-berufseinstieg');

    // Weder Icon noch Titel liegen im Bildbereich — keine Kollision mit dem Bild.
    expect(media).not.toContainElement(icon);
    expect(media).not.toContainElement(title);
    // Icon und Titel sind Geschwister in einer Zeile: keiner liegt über dem anderen.
    expect(icon.parentElement).toBe(title.parentElement);
    expect(icon.parentElement.className).toContain('flex');
    expect(icon.className).not.toContain('absolute');
    expect(title.className).not.toContain('absolute');
    // Das Bildband steht im DOM vor dem Inhaltsblock.
    expect(media.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('zeigt ohne Kartenbild einen einheitlichen Platzhalter statt einer leeren Fläche', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig());

    render(<BereichLandingPage segment="beruflich" slug="test-bereich" courses={[]} />);

    expect(screen.queryByTestId('scenario-card-image-berufseinstieg')).toBeNull();
    const media = screen.getByTestId('scenario-card-media-berufseinstieg');
    // Gleiches Seitenverhältnis wie bei Karten mit Bild → gleich hohe Kacheln.
    expect(media.className).toContain('aspect-video');
    expect(media).toContainElement(screen.getByTestId('scenario-card-media-fallback-berufseinstieg'));
    // Das Icon bleibt sichtbar — im Inhaltsblock neben dem Titel.
    expect(screen.getByTestId('scenario-card-icon-berufseinstieg')).toHaveTextContent('🎓');
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

describe('Artikelbild auf der Szenario-Detailseite', () => {
  it('zeigt das Kartenbild sichtbar im Artikel mit redaktionellem Alt-Text', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      cardImageUrl: 'https://cdn.example.com/card.jpg',
      cardImageAlt: 'Trainerin erklärt eine Übung',
    }));

    render(<SzenarioArtikelView segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]} />);

    const figure = screen.getByTestId('szenario-artikelbild');
    const image = figure.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/card.jpg');
    expect(image).toHaveAttribute('alt', 'Trainerin erklärt eine Übung');
    // Responsiv und beschnitten statt verzerrt.
    expect(image.className).toContain('w-full');
    expect(image.className).toContain('object-cover');
    expect(image.className).toContain('aspect-video');
  });

  it('nutzt das OG-Bild als Zweitquelle und den Artikeltitel als Alt-Text-Fallback', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      ogImageUrl: 'https://cdn.example.com/scenario-og.jpg',
    }));

    render(<SzenarioArtikelView segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]} />);

    const image = screen.getByTestId('szenario-artikelbild').querySelector('img');
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/scenario-og.jpg');
    expect(image).toHaveAttribute('alt', 'Berufseinstieg als Trainer');
  });

  it('rendert ohne Artikelbild keinen leeren Platzhalter', () => {
    mockGetBereichBySlug.mockReturnValue(buildConfig());

    render(<SzenarioArtikelView segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]} />);

    expect(screen.queryByTestId('szenario-artikelbild')).toBeNull();
  });

  it('zeigt das Bild nicht doppelt, wenn der Artikeltext es bereits enthält', () => {
    mockSzenarioContent['test_bereich/berufseinstieg'] =
      '<p>Einstieg</p><img src="https://cdn.example.com/card.jpg" alt="Trainerin erklärt eine Übung">';
    mockGetBereichBySlug.mockReturnValue(buildConfig({
      cardImageUrl: 'https://cdn.example.com/card.jpg',
      cardImageAlt: 'Trainerin erklärt eine Übung',
    }));

    render(<SzenarioArtikelView segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]} />);

    expect(screen.queryByTestId('szenario-artikelbild')).toBeNull();
    expect(document.querySelectorAll('img[src="https://cdn.example.com/card.jpg"]')).toHaveLength(1);
  });
});
