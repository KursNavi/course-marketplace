/**
 * Redaktionelles Prüfdatum — Landingpage und Artikel dürfen sich nicht widersprechen.
 *
 * Gemeldeter Fehler:
 *   Die Themenwelt-Landingpages zeigten «Zuletzt redaktionell geprüft: März 2026»,
 *   ihre Artikel dagegen «August 2026». Das März-Datum stand fest im JSX, stammte
 *   also aus keiner Datenquelle.
 *
 * Warum dieser Test und nicht nur die Preview:
 *   Die Vercel-Preview läuft gegen die Test-Datenbank, deren Szenarien kein
 *   last_reviewed_at führen — dort zeigen Landingpage UND Artikel gar kein
 *   Datum. Der eigentliche Produktionsfall (Artikel mit echten Prüfdaten) lässt
 *   sich dort nicht nachstellen. Dieser Test spielt ihn mit produktionsnahen
 *   Daten durch: acht Artikel wie in «Yoga & Achtsamkeit» bzw.
 *   «Sport & Fitness», mit gemischten Prüfdaten.
 *
 * Verifiziert:
 *   1  Landingpage zeigt den Monat des jüngsten Artikel-Prüfdatums
 *   2  Landingpage behauptet ohne Prüfdaten gar kein Datum
 *   3  Beide Themenwelten nutzen dieselbe Darstellungslogik
 *   4  Schweizer Schreibweise «massgeblich», nirgends «maßgeblich»
 *   5  Die Datenabfrage lädt last_reviewed_at überhaupt mit
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const { mockFetchThemeWorldPage } = vi.hoisted(() => ({
  mockFetchThemeWorldPage: vi.fn(),
}));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  BEREICH_LANDING_CONFIG: {},
  findSzenario: () => null,
  getBereichBySlug: () => null, // kein Legacy-Eintrag → DB-only-Pfad
  getBereichUrl: () => '/bereich/privat-hobby/yoga-achtsamkeit',
}));
vi.mock('../src/hooks/useTaxonomy', () => ({ useTaxonomy: () => ({ areas: [] }) }));
vi.mock('../src/lib/constants', () => ({
  SEGMENT_CONFIG: {
    'privat-hobby': {
      label: { de: 'Privat & Hobby' }, bgLight: 'bg-purple-50', text: 'text-purple-700',
      borderLight: 'border-purple-200', gradient: 'from-purple-600 to-purple-700',
    },
    beruflich: {
      label: { de: 'Beruflich' }, bgLight: 'bg-orange-50', text: 'text-orange-700',
      borderLight: 'border-orange-200', gradient: 'from-orange-600 to-orange-700',
    },
  },
}));
vi.mock('../src/lib/segmentLandingConfig', () => ({ SEGMENT_LANDING_CONFIG: {} }));
vi.mock('../src/lib/siteConfig', () => ({ BASE_URL: 'https://kursnavi.ch', CANONICAL_BASE_URL: 'https://kursnavi.ch' }));
vi.mock('../src/lib/navigation', () => ({ shouldHandleClientNavigation: () => false }));
vi.mock('../src/lib/themeWorldFeatureFlag', () => ({
  isThemeWorldDbEnabled: () => true,
  isThemeWorldPilotActive: () => false,
  loadThemeWorldWithFallback: vi.fn(),
}));
vi.mock('../src/lib/themeWorldService', () => ({
  fetchThemeWorld: vi.fn(),
  fetchPublishedScenario: vi.fn(),
  fetchThemeWorldPage: mockFetchThemeWorldPage,
}));
vi.mock('../src/components/RegionalDiscoverySection', () => ({ default: () => null }));

const BereichLandingPage = (await import('../src/components/BereichLandingPage')).default;

/** Baut eine produktionsnahe DB-Antwort für eine Themenwelt. */
function buildThemeWorldPage({ slug, urlSegment, titel, reviewDates }) {
  return {
    themeWorld: {
      id: `tw-${slug}`,
      key: slug.replace(/-/g, '_'),
      url_segment: urlSegment,
      slug,
      db_segment: urlSegment === 'beruflich' ? 'professionell' : 'privat',
      area_slug: slug.replace(/-/g, '_'),
      title_de: titel,
      subtitle_de: 'Untertitel',
      status: 'published',
      search_config: { area_slug: slug.replace(/-/g, '_'), type_key: urlSegment.replace('-', '_') },
      section_titles: {},
      predefined_searches: [],
    },
    scenarios: reviewDates.map((datum, i) => ({
      id: `sc-${i}`,
      slug: `artikel-${i + 1}`,
      label_de: `Artikel ${i + 1}`,
      teaser_de: 'Teaser',
      sort_order: i + 1,
      last_reviewed_at: datum,
    })),
  };
}

/** Rendert die Landingpage und gibt den redaktionellen Hinweistext zurück. */
async function renderNotice(page, { segment, slug }) {
  mockFetchThemeWorldPage.mockResolvedValue(page);
  render(<BereichLandingPage segment={segment} slug={slug} courses={[]} t={{}} />);
  const hinweis = await screen.findByText(/Die Inhalte dienen der Orientierung/, {}, { timeout: 5000 });
  await waitFor(() => expect(hinweis).toBeTruthy());
  return hinweis.textContent;
}

const YOGA = {
  segment: 'privat-hobby', slug: 'yoga-achtsamkeit', urlSegment: 'privat-hobby',
  titel: 'Yoga & Achtsamkeit',
};
const SPORT = {
  segment: 'beruflich', slug: 'sport-fitness-berufsausbildung', urlSegment: 'beruflich',
  titel: 'Sport & Fitness (Berufsausbildung)',
};

// Produktionsnah: acht Artikel, überwiegend im August geprüft, einer im März.
const ACHT_ARTIKEL = [
  '2026-08-15', '2026-08-02', '2026-03-14', '2026-07-30',
  '2026-08-11', '2026-06-01', '2026-08-09', '2026-05-20',
];

afterEach(() => {
  cleanup();
  mockFetchThemeWorldPage.mockReset();
});

describe('Landingpage-Prüfdatum stammt aus den Artikeln', () => {
  it('1. zeigt den Monat des jüngsten Artikel-Prüfdatums statt eines festen Datums', async () => {
    const text = await renderNotice(
      buildThemeWorldPage({ ...YOGA, reviewDates: ACHT_ARTIKEL }), YOGA,
    );

    expect(text).toContain('Zuletzt redaktionell geprüft: August 2026.');
    // Der gemeldete Widerspruch darf nicht zurückkehren.
    expect(text).not.toContain('März 2026');
  });

  it('2. behauptet ohne Prüfdaten gar kein Datum', async () => {
    const text = await renderNotice(
      buildThemeWorldPage({ ...YOGA, reviewDates: [null, null, null] }), YOGA,
    );

    expect(text).not.toContain('geprüft');
    expect(text).toMatch(/^Die Inhalte dienen der Orientierung/);
  });

  it('3. Yoga und Sport erzeugen bei gleichen Daten denselben Hinweistext', async () => {
    const yogaText = await renderNotice(
      buildThemeWorldPage({ ...YOGA, reviewDates: ACHT_ARTIKEL }), YOGA,
    );
    cleanup();
    mockFetchThemeWorldPage.mockReset();
    const sportText = await renderNotice(
      buildThemeWorldPage({ ...SPORT, reviewDates: ACHT_ARTIKEL }), SPORT,
    );

    expect(sportText).toBe(yogaText);
  });

  it('4. nutzt die Schweizer Schreibweise «massgeblich»', async () => {
    const text = await renderNotice(
      buildThemeWorldPage({ ...YOGA, reviewDates: ACHT_ARTIKEL }), YOGA,
    );

    expect(text).toContain('massgeblich');
    expect(text).not.toContain('maßgeblich');
  });
});

describe('Datenabfrage liefert die Grundlage dafür', () => {
  it('5. fetchPublishedScenarios lädt last_reviewed_at mit', () => {
    // Ohne diese Spalte im select bliebe config.lastReviewedAt still null und
    // die Landingpage verlöre ihr Datum, ohne dass ein Test anschlägt.
    const quelle = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/themeWorldService.js'), 'utf8',
    );
    const select = quelle
      .split('fetchPublishedScenarios')[1]
      .split('.eq(')[0];

    expect(select).toContain('last_reviewed_at');
  });
});
