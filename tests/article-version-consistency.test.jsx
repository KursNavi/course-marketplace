/**
 * Konsistenz der ausgelieferten Artikelfassung.
 *
 * Gemeldete Beobachtung:
 *   Beim Artikel «Berufseinstieg» erschien zunächst eine ältere Version mit
 *   anderer Inhaltsstruktur, nach erneutem Laden die aktuelle, quellenbasierte.
 *   Vermutet wurde Caching oder CDN-Verhalten.
 *
 * Untersuchungsergebnis (auf Produktion gemessen):
 *   Weder noch. Die vorgerenderte Datei enthält gar keinen Artikeltext, nur
 *   Meta-Tags — sie kann keine alte Fassung zeigen. Ursache war die
 *   Render-Reihenfolge im Browser:
 *
 *     100–800 ms  Legacy-Fassung aus dem JS-Bundle (3527 Zeichen, keine Quellen)
 *     ab  900 ms  DB-Fassung (7122 Zeichen, mit Quellen)
 *
 *   Der Artikel zeigte also erst die mitgelieferte Altfassung und tauschte sie
 *   aus, sobald die Datenbankantwort eintraf.
 *
 * Verhalten, das dieser Test festhält:
 *   Solange eine DB-Fassung erwartet wird und noch nicht vorliegt, wird KEINE
 *   Fassung gezeigt. Fällt der Ladevorgang aus, bleibt die Legacy-Fassung als
 *   Rückfallebene erhalten — die Seite darf nie leer bleiben.
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const {
  mockFetchThemeWorld, mockFetchPublishedScenario, mockLoadWithFallback, pilotAktiv,
} = vi.hoisted(() => ({
  mockFetchThemeWorld: vi.fn(),
  mockFetchPublishedScenario: vi.fn(),
  mockLoadWithFallback: vi.fn(),
  pilotAktiv: { value: true },
}));

const LEGACY_HTML = '<h2>Der klassische Ausbildungsweg: EFZ</h2><p>Ältere Fassung.</p>';
const DB_HTML = '<h2>Der eidgenössische Einstieg: EFZ</h2><p>Aktuelle, quellenbasierte Fassung.</p>';

vi.mock('../src/lib/bereichLandingConfig', () => ({
  BEREICH_LANDING_CONFIG: { sport_fitness_beruf: { slug: 'sport-fitness-berufsausbildung' } },
  findSzenario: () => ({
    slug: 'berufseinstieg',
    label: { de: 'Berufseinstieg' },
    text: { de: 'Einstieg in den Fitnessberuf.' },
    ctaLabel: { de: 'Kurse entdecken' },
    searchParams: {},
  }),
  getBereichBySlug: () => ({
    slug: 'sport-fitness-berufsausbildung', segment: 'beruflich', typeKey: 'beruflich',
    areaSlug: 'sport_fitness', title: { de: 'Sport & Fitness' }, scenarios: [],
  }),
  getBereichUrl: () => '/bereich/beruflich/sport-fitness-berufsausbildung',
}));
vi.mock('../src/lib/szenarioContent', () => ({
  SZENARIO_CONTENT: { 'sport_fitness_beruf/berufseinstieg': LEGACY_HTML },
}));
vi.mock('../src/lib/constants', () => ({
  SEGMENT_CONFIG: {
    beruflich: {
      label: { de: 'Beruflich' }, bgLight: 'bg-orange-50', text: 'text-orange-700',
      borderLight: 'border-orange-200', gradient: 'from-orange-600 to-orange-700',
    },
  },
}));
vi.mock('../src/lib/siteConfig', () => ({ BASE_URL: 'https://kursnavi.ch' }));
vi.mock('../src/lib/navigation', () => ({ shouldHandleClientNavigation: () => false }));
vi.mock('../src/lib/themeWorldFeatureFlag', () => ({
  isThemeWorldDbEnabled: () => true,
  isThemeWorldPilotActive: () => pilotAktiv.value,
  loadThemeWorldWithFallback: mockLoadWithFallback,
}));
vi.mock('../src/lib/themeWorldService', () => ({
  fetchThemeWorld: mockFetchThemeWorld,
  fetchPublishedScenario: mockFetchPublishedScenario,
}));
vi.mock('../src/lib/courseMetadata', () => ({ normalizeDeliveryTypeKey: (v) => v }));

const SzenarioArtikelView = (await import('../src/components/SzenarioArtikelView')).default;

const THEME_WORLD = {
  id: 'tw-sport', slug: 'sport-fitness-berufsausbildung', url_segment: 'beruflich',
  title_de: 'Sport & Fitness', search_config: { area_slug: 'sport_fitness' },
};

function renderArtikel() {
  return render(
    <SzenarioArtikelView
      segment="beruflich"
      slug="sport-fitness-berufsausbildung"
      szenarioSlug="berufseinstieg"
      courses={[]}
      t={{}}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  pilotAktiv.value = true;
});

describe('Keine veraltete Fassung vor der aktuellen', () => {
  it('zeigt während des Ladens KEINE der beiden Fassungen', async () => {
    // Antwort bewusst offen lassen — der Ladezustand bleibt bestehen.
    mockLoadWithFallback.mockReturnValue(new Promise(() => {}));

    renderArtikel();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Der klassische Ausbildungsweg');
    expect(document.body.textContent).not.toContain('Der eidgenössische Einstieg');
  });

  it('zeigt danach ausschliesslich die aktuelle DB-Fassung', async () => {
    mockLoadWithFallback.mockResolvedValue({ source: 'db', data: THEME_WORLD, notFound: false });
    mockFetchPublishedScenario.mockResolvedValue({
      slug: 'berufseinstieg', label_de: 'Berufseinstieg', teaser_de: 'Einstieg in den Fitnessberuf.',
      content_html: DB_HTML, cta_config: {}, sources: [], cta_label_de: 'Kurse entdecken',
    });

    renderArtikel();

    await waitFor(() => {
      expect(document.body.textContent).toContain('Der eidgenössische Einstieg');
    });
    // Die Altfassung darf zu keinem Zeitpunkt danach erscheinen.
    expect(document.body.textContent).not.toContain('Der klassische Ausbildungsweg');
  });

  it('fällt bei fehlgeschlagenem Laden auf die Legacy-Fassung zurück, statt leer zu bleiben', async () => {
    mockLoadWithFallback.mockRejectedValue(new Error('DB nicht erreichbar'));

    renderArtikel();

    await waitFor(() => {
      expect(document.body.textContent).toContain('Der klassische Ausbildungsweg');
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('fällt zurück, wenn die Themenwelt keine DB-Fassung des Artikels hat', async () => {
    mockLoadWithFallback.mockResolvedValue({ source: 'db', data: THEME_WORLD, notFound: false });
    mockFetchPublishedScenario.mockRejectedValue(
      Object.assign(new Error('nicht gefunden'), { name: 'ThemeWorldDbError' }),
    );

    renderArtikel();

    await waitFor(() => {
      expect(document.body.textContent).toContain('Der klassische Ausbildungsweg');
    });
  });

  it('zeigt ohne aktiven Pilot sofort die Legacy-Fassung, ohne Ladezustand', async () => {
    // Kein DB-Ladevorgang zu erwarten → kein Grund, den Inhalt zurückzuhalten.
    pilotAktiv.value = false;

    renderArtikel();

    expect(document.body.textContent).toContain('Der klassische Ausbildungsweg');
    expect(screen.queryByRole('status')).toBeNull();
    expect(mockLoadWithFallback).not.toHaveBeenCalled();
  });

  it('kündigt den Ladezustand für Screenreader an', async () => {
    mockLoadWithFallback.mockReturnValue(new Promise(() => {}));

    renderArtikel();

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('wird geladen');
  });
});
