/**
 * Phase 8 — Komponententests für DB-only-Modus (BereichLandingPage)
 *
 * Testet das generische Routing einer neuen Themenwelt ohne Legacy-Eintrag:
 *   - Ladeindikator wenn kein Legacy-Eintrag und DB aktiv
 *   - Inhalt nach erfolgreichem DB-Ladevorgang
 *   - Not-found nach ThemeWorldNotFoundError
 *   - Not-found nach generellem DB-Fehler (kein Legacy-Fallback)
 *   - Kein DB-Aufruf wenn Flag deaktiviert
 *   - Legacy-Themenwelten nutzen weiterhin den Pilot-Pfad
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// useTaxonomy mock
// ---------------------------------------------------------------------------

vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({ areas: [], specialties: [], focusAreas: [] }),
}));

// ---------------------------------------------------------------------------
// bereichLandingConfig mock
// ---------------------------------------------------------------------------

const { mockGetBereichBySlug } = vi.hoisted(() => ({
  mockGetBereichBySlug: vi.fn(),
}));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  getBereichBySlug: mockGetBereichBySlug,
  getBereichUrl: vi.fn().mockReturnValue('/bereich/privat-hobby/test-kreativ-gestalten'),
  BEREICH_LANDING_CONFIG: {},
  findSzenario: vi.fn(),
}));

// ---------------------------------------------------------------------------
// themeWorldService mock
// ---------------------------------------------------------------------------

const { mockFetchThemeWorldPage, ThemeWorldNotFoundError } = vi.hoisted(() => {
  class ThemeWorldNotFoundError extends Error {
    constructor(msg) { super(msg); this.name = 'ThemeWorldNotFoundError'; }
  }
  return { mockFetchThemeWorldPage: vi.fn(), ThemeWorldNotFoundError };
});

vi.mock('../src/lib/themeWorldService', () => ({
  fetchThemeWorldPage: mockFetchThemeWorldPage,
  fetchThemeWorld: vi.fn(),
  fetchPublishedScenarios: vi.fn().mockResolvedValue([]),
  fetchPublishedScenario: vi.fn(),
  ThemeWorldNotFoundError,
  ThemeWorldDbError: class ThemeWorldDbError extends Error {
    constructor(msg) { super(msg); this.name = 'ThemeWorldDbError'; }
  },
}));

// ---------------------------------------------------------------------------
// themeWorldAdapter mock
// ---------------------------------------------------------------------------

const { mockAdaptToLegacyBereichConfig } = vi.hoisted(() => ({
  mockAdaptToLegacyBereichConfig: vi.fn(),
}));

vi.mock('../src/lib/themeWorldAdapter', () => ({
  adaptToLegacyBereichConfig: mockAdaptToLegacyBereichConfig,
  adaptToLegacySzenarioConfig: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Minimal mocks für Component-Dependencies
// ---------------------------------------------------------------------------

vi.mock('../src/lib/segmentLandingConfig', () => ({ SEGMENT_LANDING_CONFIG: {} }));
vi.mock('../src/lib/siteConfig', () => ({ BASE_URL: 'https://test.kursnavi.ch' }));
vi.mock('../src/lib/seoUtils', () => ({
  buildFaqPageJsonLd: vi.fn().mockReturnValue({}),
  buildArticleJsonLd: vi.fn().mockReturnValue({}),
  buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
  enhanceImages: vi.fn(),
  wrapTables: vi.fn(),
  estimateReadingTime: vi.fn().mockReturnValue(5),
}));
vi.mock('../src/lib/navigation', () => ({
  shouldHandleClientNavigation: vi.fn().mockReturnValue(false),
}));
vi.mock('../src/components/RegionalDiscoverySection', () => ({
  default: () => <div data-testid="regional-discovery" />,
}));

// ---------------------------------------------------------------------------
// Import BereichLandingPage nach allen Mocks
// ---------------------------------------------------------------------------

import BereichLandingPage from '../src/components/BereichLandingPage.jsx';

// ---------------------------------------------------------------------------
// Test-Konstanten
// ---------------------------------------------------------------------------

const TEST_TW_SEGMENT = 'privat-hobby';
const TEST_TW_SLUG = 'test-kreativ-gestalten';

// Minimaler adapted config — genug damit der Component rendern kann
const buildMinimalAdaptedConfig = () => ({
  key: 'test_kreativ_gestalten',
  title: { de: 'Kreativ & Gestalten' },
  subtitle: { de: 'Kurse für kreative Menschen' },
  intro: { de: 'Entdecke kreative Kurse.' },
  typeKey: 'privat_hobby',
  areaSlug: 'kreativ_gestalten',
  slug: TEST_TW_SLUG,
  segment: TEST_TW_SEGMENT,
  scenarios: [],
  specialtyDescriptions: {},
  regionalDiscovery: null,
  predefinedSearches: [],
  editorialSections: [],
  faqs: [],
  sectionTitles: {
    scenarioTitle: { de: 'Wo stehst du?' },
    scenarioSubtitle: { de: 'Finde den passenden Einstieg' },
    specialtiesTitle: { de: 'Ausbildungsbereiche' },
    specialtiesSubtitle: { de: 'Alle Schwerpunkte' },
    searchesSubtitle: null,
    faqTitle: { de: 'Häufige Fragen' },
    trustTitle: { de: 'Qualität & Anerkennung' },
    ctaTitle: null,
    ctaButton: { de: 'Alle Kurse anzeigen' },
  },
  ctaLinks: [],
  trustLogos: [],
  heroImage: null,
  heroImageAlt: '',
  metaTitle: 'Kreativkurse Schweiz',
  metaDescription: 'Finde Kreativkurse in der Schweiz.',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 8: BereichLandingPage — DB-only-Modus (kein Legacy-Eintrag)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,yoga_achtsamkeit');
    // Kein Legacy-Eintrag für neue Themenwelt
    mockGetBereichBySlug.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('zeigt Ladeindikator wenn kein Legacy-Eintrag und DB aktiv', () => {
    // DB antwortet nie → bleibt im Ladezustand
    mockFetchThemeWorldPage.mockReturnValue(new Promise(() => {}));

    render(
      <BereichLandingPage
        segment={TEST_TW_SEGMENT}
        slug={TEST_TW_SLUG}
        courses={[]}
        lang="de"
      />
    );

    expect(screen.getByText('Wird geladen…')).toBeDefined();
  });

  it('zeigt Inhalt nach erfolgreichem DB-Ladevorgang', async () => {
    const adaptedConfig = buildMinimalAdaptedConfig();
    mockFetchThemeWorldPage.mockResolvedValue({ themeWorld: { id: 'test-id' } });
    mockAdaptToLegacyBereichConfig.mockReturnValue(adaptedConfig);

    render(
      <BereichLandingPage
        segment={TEST_TW_SEGMENT}
        slug={TEST_TW_SLUG}
        courses={[]}
        lang="de"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Kreativ & Gestalten').length).toBeGreaterThan(0);
    });
    expect(mockFetchThemeWorldPage).toHaveBeenCalledWith(TEST_TW_SEGMENT, TEST_TW_SLUG);
  });

  it('zeigt Not-found wenn DB ThemeWorldNotFoundError wirft', async () => {
    mockFetchThemeWorldPage.mockRejectedValue(new ThemeWorldNotFoundError('Not found'));

    render(
      <BereichLandingPage
        segment={TEST_TW_SEGMENT}
        slug={TEST_TW_SLUG}
        courses={[]}
        lang="de"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bereich nicht gefunden')).toBeDefined();
    });
  });

  it('zeigt Not-found bei generellem DB-Fehler (kein Legacy-Fallback für DB-only)', async () => {
    mockFetchThemeWorldPage.mockRejectedValue(new Error('DB connection failed'));

    render(
      <BereichLandingPage
        segment={TEST_TW_SEGMENT}
        slug={TEST_TW_SLUG}
        courses={[]}
        lang="de"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bereich nicht gefunden')).toBeDefined();
    });
  });

  it('ruft fetchThemeWorldPage NICHT auf wenn DB-Flag deaktiviert', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', '');
    mockFetchThemeWorldPage.mockResolvedValue({});

    render(
      <BereichLandingPage
        segment={TEST_TW_SEGMENT}
        slug={TEST_TW_SLUG}
        courses={[]}
        lang="de"
      />
    );

    // Ohne Legacy UND ohne DB → sofort 404 (kein API-Aufruf)
    expect(screen.getByText('Bereich nicht gefunden')).toBeDefined();
    expect(mockFetchThemeWorldPage).not.toHaveBeenCalled();
  });

  it('Legacy-Themenwelt zeigt Inhalt ohne DB-Aufruf', () => {
    const sportLegacyConfig = {
      ...buildMinimalAdaptedConfig(),
      key: 'sport_fitness_beruf',
      title: { de: 'Sport & Fitness Berufsausbildung' },
      typeKey: 'beruflich',
    };
    mockGetBereichBySlug.mockReturnValue(sportLegacyConfig);

    render(
      <BereichLandingPage
        segment="beruflich"
        slug="sport-fitness-berufsausbildung"
        courses={[]}
        lang="de"
      />
    );

    // Legacy-Config vorhanden → kein dbOnlyLoading → kein Ladeindikator
    expect(screen.queryByText('Wird geladen…')).toBeNull();
    // Legacy-Config direkt angezeigt (kann in mehreren Elementen vorkommen)
    expect(screen.getAllByText('Sport & Fitness Berufsausbildung').length).toBeGreaterThan(0);
    // DB-only path NOT taken → fetchThemeWorldPage nicht für legacy aufgerufen
    expect(mockFetchThemeWorldPage).not.toHaveBeenCalled();
  });
});
