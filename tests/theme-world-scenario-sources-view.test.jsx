/**
 * Quellenangaben und redaktioneller Prüfhinweis in SzenarioArtikelView.
 *
 * Prüft die öffentliche Ausgabe für BEIDE Datenherkünfte über denselben
 * Renderpfad: DB-Szenarien (über themeWorldAdapter) und Legacy-Szenarien
 * (direkt aus bereichLandingConfig).
 *
 * Abgedeckt (Nummern = Auftragsliste):
 *   1  sources fehlt              → kein Quellenblock
 *   2  sources = []               → kein Quellenblock
 *   3  eine gültige Quelle        → Publisher, Titel und Link sichtbar
 *   4  mehrere Quellen            → Reihenfolge bleibt erhalten
 *   5  Link öffnet extern sicher  → target=_blank + rel gegen opener-Risiken
 *   12 DB-Adapter reicht sources korrekt durch
 *   13 Legacy ohne sources        → bestehendes Verhalten intakt
 *   14 Legacy mit sources         → derselbe Quellenblock wie bei DB
 *   19 echtes last_reviewed_at    → echter Prüfhinweis
 *   20 fehlendes last_reviewed_at → kein erfundenes «März 2026»
 *   21 Article-JSON-LD bleibt unverändert korrekt
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';

const { mockGetBereichBySlug, mockFetchThemeWorld, mockFetchPublishedScenario, dbEnabled } =
  vi.hoisted(() => ({
    mockGetBereichBySlug: vi.fn(),
    mockFetchThemeWorld: vi.fn(),
    mockFetchPublishedScenario: vi.fn(),
    dbEnabled: { value: false },
  }));

vi.mock('../src/lib/bereichLandingConfig', () => ({
  BEREICH_LANDING_CONFIG: { test_bereich: { slug: 'test-bereich' } },
  findSzenario: (config, scenarioSlug) =>
    config?.scenarios?.find((scenario) => scenario.slug === scenarioSlug) || null,
  getBereichBySlug: mockGetBereichBySlug,
  getBereichUrl: () => '/bereich/beruflich/test-bereich',
}));
vi.mock('../src/lib/szenarioContent', () => ({
  SZENARIO_CONTENT: { 'test_bereich/legacy-szenario': '<p>Legacy-Artikeltext</p>' },
}));
vi.mock('../src/hooks/useTaxonomy', () => ({ useTaxonomy: () => ({ areas: [] }) }));
vi.mock('../src/lib/constants', () => ({
  SEGMENT_CONFIG: {
    beruflich: {
      label: { de: 'Beruflich' }, bgLight: 'bg-orange-50', text: 'text-orange-700',
      borderLight: 'border-orange-200', gradient: 'from-orange-600 to-orange-700',
    },
    privat_hobby: {
      label: { de: 'Privat & Hobby' }, bgLight: 'bg-green-50', text: 'text-green-700',
      borderLight: 'border-green-200', gradient: 'from-green-600 to-green-700',
    },
  },
}));
vi.mock('../src/lib/segmentLandingConfig', () => ({ SEGMENT_LANDING_CONFIG: {} }));
vi.mock('../src/lib/siteConfig', () => ({ BASE_URL: 'https://kursnavi.ch' }));
vi.mock('../src/lib/navigation', () => ({ shouldHandleClientNavigation: () => false }));
vi.mock('../src/lib/themeWorldFeatureFlag', () => ({
  isThemeWorldDbEnabled: () => dbEnabled.value,
  isThemeWorldPilotActive: () => false,
  loadThemeWorldWithFallback: vi.fn(),
}));
vi.mock('../src/lib/themeWorldService', () => ({
  fetchThemeWorld: mockFetchThemeWorld,
  fetchPublishedScenario: mockFetchPublishedScenario,
  fetchThemeWorldPage: vi.fn(),
}));
vi.mock('../src/lib/courseMetadata', () => ({ normalizeDeliveryTypeKey: (value) => value }));
vi.mock('../src/components/RegionalDiscoverySection', () => ({ default: () => null }));

// scenarioSources, editorialReviewDate und themeWorldAdapter bleiben echt —
// sie sind zusammen mit der Komponente der Prüfling.
import SzenarioArtikelView from '../src/components/SzenarioArtikelView.jsx';

// ---------------------------------------------------------------------------
// Testdaten
// ---------------------------------------------------------------------------

const SOURCE_A = {
  title: 'Subjektfinanzierung für vorbereitende Kurse',
  publisher: 'Staatssekretariat für Bildung, Forschung und Innovation SBFI',
  url: 'https://www.sbfi.admin.ch/subjektfinanzierung',
};

const SOURCE_B = {
  title: 'Berufsprüfung Spezialist Bewegungs- und Gesundheitsförderung',
  publisher: 'OdA Bewegung und Gesundheit',
  url: 'https://www.oda-bg.ch/berufspruefung',
};

const SOURCE_C = {
  title: 'Bildungssystem Schweiz im Überblick',
  publisher: 'Bundesamt für Statistik',
  url: 'https://www.bfs.admin.ch/bildung',
};

const THEME_WORLD_ROW = {
  id: 'tw-1',
  key: 'yoga',
  url_segment: 'privat-hobby',
  slug: 'yoga',
  status: 'published',
  title_de: 'Yoga',
  subtitle_de: 'Yoga-Kurse in der Schweiz',
  search_config: {},
};

function scenarioRow(overrides = {}) {
  return {
    id: 'sc-1',
    theme_world_id: 'tw-1',
    slug: 'yoga-einstieg',
    status: 'published',
    label_de: 'Yoga für Einsteigerinnen',
    teaser_de: 'Der ruhige Einstieg.',
    content_html: '<p>DB-Artikeltext</p>',
    meta_title: null,
    meta_description: null,
    og_image_url: null,
    og_image_alt: null,
    card_image_url: null,
    card_image_alt: null,
    cta_label_de: null,
    cta_config: null,
    sort_order: 0,
    published_at: '2026-08-14T16:08:00.61638+00',
    updated_at: '2026-08-16T07:00:00.123456+00',
    last_reviewed_at: null,
    sources: [],
    ...overrides,
  };
}

/** Legacy-Szenario im Format aus bereichLandingConfig.js. */
function legacyBereich(scenarioOverrides = {}) {
  return {
    slug: 'test-bereich',
    segment: 'beruflich',
    typeKey: 'beruflich',
    areaSlug: 'test-area',
    title: { de: 'Testbereich' },
    scenarios: [
      {
        slug: 'legacy-szenario',
        icon: '🎓',
        label: { de: 'Legacy-Szenario' },
        text: { de: 'Ein Szenario ohne Datenbank.' },
        searchParams: {},
        ctaLabel: { de: 'Kurse entdecken' },
        ...scenarioOverrides,
      },
    ],
  };
}

/** Rendert ein DB-Szenario im DB-only-Modus. */
async function renderDbScenario(row) {
  dbEnabled.value = true;
  mockGetBereichBySlug.mockReturnValue(null);
  mockFetchThemeWorld.mockResolvedValue(THEME_WORLD_ROW);
  mockFetchPublishedScenario.mockResolvedValue(row);

  render(
    <SzenarioArtikelView
      segment="privat-hobby" slug="yoga" szenarioSlug={row.slug} courses={[]}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('DB-Artikeltext')).toBeInTheDocument();
  });
}

/** Rendert ein Legacy-Szenario (keine DB im Spiel). */
function renderLegacyScenario(scenarioOverrides = {}) {
  dbEnabled.value = false;
  mockGetBereichBySlug.mockReturnValue(legacyBereich(scenarioOverrides));

  render(
    <SzenarioArtikelView
      segment="beruflich" slug="test-bereich" szenarioSlug="legacy-szenario" courses={[]}
    />,
  );
}

/** Der Quellenbereich, oder null wenn er nicht gerendert wurde. */
function sourcesSection() {
  return document.querySelector('section[aria-labelledby="szenario-quellen-heading"]');
}

const HEADING = 'Quellen & weiterführende Informationen';

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
  dbEnabled.value = false;
  mockGetBereichBySlug.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe('DB-Szenario: Quellenblock', () => {
  it('1. rendert keinen Quellenblock, wenn sources komplett fehlt', async () => {
    const row = scenarioRow();
    delete row.sources;
    await renderDbScenario(row);

    expect(sourcesSection()).toBeNull();
    expect(screen.queryByText(HEADING)).toBeNull();
    // Der Artikel selbst bleibt unverändert sichtbar.
    expect(screen.getByText('DB-Artikeltext')).toBeInTheDocument();
  });

  it('2. rendert keinen Quellenblock bei sources = []', async () => {
    await renderDbScenario(scenarioRow({ sources: [] }));

    expect(sourcesSection()).toBeNull();
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it('rendert keinen Quellenblock, wenn ALLE Einträge ungültig sind', async () => {
    await renderDbScenario(scenarioRow({
      sources: [
        { title: '', publisher: 'X', url: 'https://a.ch' },
        { title: 'Y', publisher: 'Z', url: 'javascript:alert(1)' },
      ],
    }));

    expect(sourcesSection()).toBeNull();
  });

  it('3. zeigt Publisher, Titel und Link einer einzelnen Quelle', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A] }));

    const section = sourcesSection();
    expect(section).not.toBeNull();

    expect(within(section).getByText(HEADING)).toBeInTheDocument();
    expect(within(section).getByText(SOURCE_A.publisher)).toBeInTheDocument();

    const link = within(section).getByRole('link', { name: new RegExp(SOURCE_A.title) });
    expect(link).toHaveAttribute('href', SOURCE_A.url);
    // Der sichtbare Linktext ist der Quellentitel, nicht die rohe URL.
    expect(link.textContent).toContain(SOURCE_A.title);
    expect(within(section).queryByText(SOURCE_A.url)).toBeNull();
  });

  it('4. behält die Reihenfolge mehrerer Quellen bei', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A, SOURCE_B, SOURCE_C] }));

    const links = within(sourcesSection()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href')))
      .toEqual([SOURCE_A.url, SOURCE_B.url, SOURCE_C.url]);
  });

  it('4. behält die Reihenfolge auch bei umgekehrter Eingabe bei', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_C, SOURCE_A, SOURCE_B] }));

    const links = within(sourcesSection()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href')))
      .toEqual([SOURCE_C.url, SOURCE_A.url, SOURCE_B.url]);
  });

  it('4. überspringt ungültige Einträge, ohne die Reihenfolge der gültigen zu stören', async () => {
    await renderDbScenario(scenarioRow({
      sources: [SOURCE_A, { title: 'Kaputt', publisher: 'X', url: 'nicht-eine-url' }, SOURCE_B],
    }));

    const links = within(sourcesSection()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([SOURCE_A.url, SOURCE_B.url]);
  });

  it('5. öffnet jeden Quellenlink sicher in einem neuen Tab', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A, SOURCE_B] }));

    for (const link of within(sourcesSection()).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      const rel = link.getAttribute('rel') || '';
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    }
  });

  it('5. kündigt das neue Tab für Screenreader an', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A] }));

    const link = within(sourcesSection()).getByRole('link');
    expect(link.textContent).toContain('öffnet in neuem Tab');
  });

  it('nutzt eine zugängliche Struktur: benannter Bereich mit Überschrift und Liste', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A, SOURCE_B] }));

    const section = sourcesSection();
    const heading = within(section).getByRole('heading', { name: HEADING });
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(section.querySelector('ol')).not.toBeNull();
    expect(section.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('steht NACH dem Artikelinhalt und VOR dem redaktionellen Hinweis', async () => {
    await renderDbScenario(scenarioRow({
      sources: [SOURCE_A],
      last_reviewed_at: '2026-08-15',
    }));

    const article = screen.getByText('DB-Artikeltext');
    const section = sourcesSection();
    const notice = screen.getByText(/Zuletzt redaktionell geprüft/);

    // Node.compareDocumentPosition: 4 = "kommt danach im Dokument"
    expect(article.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('12. reicht die Quellen durch den DB-Adapter unverändert bis in die Anzeige', async () => {
    // Rohdaten wie aus Supabase — inklusive Whitespace, den der Adapter normalisiert.
    await renderDbScenario(scenarioRow({
      sources: [{ title: '  Titel   A ', publisher: ' Herausgeber  A ', url: 'https://a.example.ch/x ' }],
    }));

    const section = sourcesSection();
    expect(within(section).getByText('Herausgeber A')).toBeInTheDocument();
    expect(within(section).getByRole('link')).toHaveAttribute('href', 'https://a.example.ch/x');
  });
});

// ---------------------------------------------------------------------------

describe('Legacy-Szenario: identischer Quellenblock', () => {
  it('13. rendert ohne sources unverändert und ohne Quellenblock', () => {
    renderLegacyScenario();

    expect(screen.getByText('Legacy-Artikeltext')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Legacy-Szenario' })).toBeInTheDocument();
    expect(sourcesSection()).toBeNull();
  });

  it('13. rendert auch bei sources = [] ohne Quellenblock', () => {
    renderLegacyScenario({ sources: [] });
    expect(sourcesSection()).toBeNull();
  });

  it('14. rendert mit sources denselben Block wie ein DB-Szenario', () => {
    renderLegacyScenario({ sources: [SOURCE_A, SOURCE_B] });

    const section = sourcesSection();
    expect(section).not.toBeNull();
    expect(within(section).getByText(HEADING)).toBeInTheDocument();
    expect(within(section).getByText(SOURCE_A.publisher)).toBeInTheDocument();
    expect(within(section).getByText(SOURCE_B.publisher)).toBeInTheDocument();

    const links = within(section).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([SOURCE_A.url, SOURCE_B.url]);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('14. wendet dieselbe Validierung an wie beim DB-Pfad', () => {
    renderLegacyScenario({
      sources: [SOURCE_A, { title: 'Böse', publisher: 'X', url: 'javascript:alert(1)' }],
    });

    const links = within(sourcesSection()).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', SOURCE_A.url);
  });
});

// ---------------------------------------------------------------------------

describe('Redaktioneller Prüfhinweis', () => {
  const ORIENTATION = /Die Inhalte dienen der Orientierung/;

  it('19. zeigt bei echtem last_reviewed_at das echte Datum als Monat und Jahr', async () => {
    await renderDbScenario(scenarioRow({ last_reviewed_at: '2026-08-15' }));

    expect(screen.getByText(/Zuletzt redaktionell geprüft: August 2026\./)).toBeInTheDocument();
  });

  it('19. bildet weitere echte Daten korrekt ab', async () => {
    await renderDbScenario(scenarioRow({ last_reviewed_at: '2026-01-02' }));
    expect(screen.getByText(/Zuletzt redaktionell geprüft: Januar 2026\./)).toBeInTheDocument();
  });

  it('20. behauptet ohne last_reviewed_at kein Prüfdatum', async () => {
    await renderDbScenario(scenarioRow({ last_reviewed_at: null }));

    expect(screen.queryByText(/Zuletzt redaktionell geprüft/)).toBeNull();
    expect(screen.queryByText(/März 2026/)).toBeNull();
    // Der allgemeine Orientierungshinweis bleibt bestehen.
    expect(screen.getByText(ORIENTATION)).toBeInTheDocument();
  });

  it('20. erfindet auch bei Legacy-Szenarien kein Prüfdatum', () => {
    renderLegacyScenario();

    expect(screen.queryByText(/Zuletzt redaktionell geprüft/)).toBeNull();
    expect(screen.queryByText(/März 2026/)).toBeNull();
    expect(screen.getByText(ORIENTATION)).toBeInTheDocument();
  });

  it('20. leitet kein Datum aus updated_at ab', async () => {
    // updated_at ist gesetzt, last_reviewed_at nicht — es darf nichts erscheinen.
    await renderDbScenario(scenarioRow({
      last_reviewed_at: null,
      updated_at: '2026-08-16T07:00:00Z',
    }));

    expect(screen.queryByText(/Zuletzt redaktionell geprüft/)).toBeNull();
  });

  it('nutzt die Schweizer Schreibweise «massgeblich»', async () => {
    await renderDbScenario(scenarioRow());

    const notice = screen.getByText(ORIENTATION);
    expect(notice.textContent).toContain('massgeblich');
    expect(notice.textContent).not.toContain('maßgeblich');
  });

  it('behält den Hinweis auf das Kontaktformular bei', async () => {
    await renderDbScenario(scenarioRow());
    expect(screen.getByRole('link', { name: 'Zum Kontaktformular' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('21. Article-JSON-LD bleibt unverändert korrekt', () => {
  function readSchema(marker) {
    const script = document.head.querySelector(`script[data-schema="${marker}"]`);
    return script ? JSON.parse(script.textContent) : null;
  }

  it('bleibt bei einem Szenario mit Quellen unverändert', async () => {
    await renderDbScenario(scenarioRow({
      sources: [SOURCE_A, SOURCE_B],
      last_reviewed_at: '2026-08-15',
    }));

    await waitFor(() => expect(readSchema('szenario-article')).not.toBeNull());
    const article = readSchema('szenario-article');

    expect(article['@type']).toBe('Article');
    expect(article.datePublished).toBe('2026-08-14');
    expect(article.dateModified).toBe('2026-08-15');
  });

  it('erfindet keine citation-/sameAs-Felder, nur weil Quellen vorhanden sind', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A, SOURCE_B] }));

    await waitFor(() => expect(readSchema('szenario-article')).not.toBeNull());
    const article = readSchema('szenario-article');

    expect(article).not.toHaveProperty('citation');
    expect(article).not.toHaveProperty('sameAs');
    expect(article).not.toHaveProperty('isBasedOn');
    // Die Quellen-URLs tauchen im Schema überhaupt nicht auf.
    expect(JSON.stringify(article)).not.toContain('sbfi.admin.ch');
  });

  it('gibt genau einen Article- und einen Breadcrumb-Block aus (kein doppeltes JSON-LD)', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A] }));

    await waitFor(() => expect(readSchema('szenario-article')).not.toBeNull());
    expect(document.head.querySelectorAll('script[data-schema="szenario-article"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('script[data-schema="szenario-breadcrumb"]')).toHaveLength(1);
  });

  it('lässt den Canonical unverändert', async () => {
    await renderDbScenario(scenarioRow({ sources: [SOURCE_A] }));

    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')?.href)
        .toBe('https://kursnavi.ch/bereich/privat-hobby/yoga/yoga-einstieg');
    });
  });
});
