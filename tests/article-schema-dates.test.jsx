/**
 * Article-Datumswahrheit (technisches SEO-Audit, MITTEL-Finding).
 *
 * buildArticleJsonLd() setzte für datePublished/dateModified einen
 * `new Date()`-Fallback. Jede Seite ohne echte Datumsquelle behauptete damit,
 * genau heute veröffentlicht und heute geändert worden zu sein — ein Wert, der
 * sich täglich änderte (72 Ratgeberartikel, 16 publizierte Szenarien).
 *
 * Verifiziert:
 *   1–5   buildArticleJsonLd gibt Datumsfelder nur bei echten Werten aus
 *   6     DB-Timestamps werden stabil normalisiert
 *   7–8   identische Ausgabe bei unterschiedlichem Systemdatum (keine Clock)
 *   9     Ratgeberartikel erzeugen kein erfundenes Datum
 *   10–12 DB-Szenario: published_at → datePublished, last_reviewed_at → dateModified
 *   13    Legacy-Szenario ohne Datumsdaten → keine Datumsfelder
 *   14    Prerender und Hydration erzeugen dieselben Datumsfelder
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const { mockGetBereichBySlug, mockFetchThemeWorld, mockFetchPublishedScenario, dbEnabled } =
  vi.hoisted(() => ({
    mockGetBereichBySlug: vi.fn(),
    mockFetchThemeWorld: vi.fn(),
    mockFetchPublishedScenario: vi.fn(),
    dbEnabled: { value: false },
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

// seoUtils und themeWorldAdapter bleiben bewusst echt — sie sind der Prüfling.
import { buildArticleJsonLd, normalizeSchemaDate } from '../src/lib/seoUtils.js';
import { buildThemeWorldPrerenderRoutes } from '../api/_lib/theme-world-prerender.js';
import RatgeberArtikelView from '../src/components/RatgeberArtikelView.jsx';
import SzenarioArtikelView from '../src/components/SzenarioArtikelView.jsx';

const BASE = 'https://kursnavi.ch';

const ARTICLE_INPUT = {
  title: 'Testartikel',
  description: 'Beschreibung',
  url: `${BASE}/bereich/beruflich/test-bereich/berufseinstieg`,
};

/** Liest ein injiziertes JSON-LD-Objekt anhand seines data-schema-Markers. */
function readSchema(marker) {
  const script = document.head.querySelector(`script[data-schema="${marker}"]`);
  return script ? JSON.parse(script.textContent) : null;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
  dbEnabled.value = false;
  mockGetBereichBySlug.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('buildArticleJsonLd: Datumsfelder', () => {
  it('1. lässt ohne Datumswerte beide Felder komplett weg', () => {
    const article = buildArticleJsonLd(ARTICLE_INPUT);

    expect(article).not.toHaveProperty('datePublished');
    expect(article).not.toHaveProperty('dateModified');
    // Der Rest des Schemas bleibt unverändert.
    expect(article['@type']).toBe('Article');
    expect(article.headline).toBe('Testartikel');
    expect(article.inLanguage).toBe('de-CH');
  });

  it('2. gibt nur datePublished aus, wenn nur dieses echt vorhanden ist', () => {
    const article = buildArticleJsonLd({ ...ARTICLE_INPUT, datePublished: '2026-03-14' });

    expect(article.datePublished).toBe('2026-03-14');
    expect(article).not.toHaveProperty('dateModified');
  });

  it('3. gibt nur dateModified aus, wenn nur dieses echt vorhanden ist', () => {
    const article = buildArticleJsonLd({ ...ARTICLE_INPUT, dateModified: '2026-05-02' });

    expect(article.dateModified).toBe('2026-05-02');
    expect(article).not.toHaveProperty('datePublished');
  });

  it('4. gibt beide echten Werte korrekt aus', () => {
    const article = buildArticleJsonLd({
      ...ARTICLE_INPUT,
      datePublished: '2026-03-14',
      dateModified: '2026-05-02',
    });

    expect(article.datePublished).toBe('2026-03-14');
    expect(article.dateModified).toBe('2026-05-02');
  });

  it('5. ersetzt ungültige oder leere Werte niemals durch heute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00Z'));

    const invalidValues = [
      null, undefined, '', '   ', 'März 2026', '2026-03', '14.03.2026',
      '2026-13-01', '2026-02-31', 'gestern', 0, 1755302400000, {}, [], NaN,
      new Date('nicht-datum'),
    ];

    for (const value of invalidValues) {
      const article = buildArticleJsonLd({
        ...ARTICLE_INPUT,
        datePublished: value,
        dateModified: value,
      });
      expect(article, `Wert: ${String(value)}`).not.toHaveProperty('datePublished');
      expect(article, `Wert: ${String(value)}`).not.toHaveProperty('dateModified');
      expect(JSON.stringify(article)).not.toContain('2026-08-16');
    }
  });

  it('6. normalisiert echte DB-Timestamps stabil', () => {
    expect(normalizeSchemaDate('2026-08-14T16:08:00.61638+00')).toBe('2026-08-14');
    expect(normalizeSchemaDate('2026-08-14 16:08:00+00')).toBe('2026-08-14');
    expect(normalizeSchemaDate('2026-08-14T16:08:00.61638+00:00')).toBe('2026-08-14');
    expect(normalizeSchemaDate('2026-08-14T16:08:00Z')).toBe('2026-08-14');
    // last_reviewed_at ist eine date-Spalte — reines Kalenderdatum.
    expect(normalizeSchemaDate('2026-03-14')).toBe('2026-03-14');

    const article = buildArticleJsonLd({
      ...ARTICLE_INPUT,
      datePublished: '2026-08-14T16:08:00.61638+00',
    });
    expect(article.datePublished).toBe('2026-08-14');
  });

  it('7./8. liefert bei unterschiedlichem Systemdatum identische Ausgabe', () => {
    const input = {
      ...ARTICLE_INPUT,
      datePublished: '2026-08-14T16:08:00.61638+00',
      dateModified: null,
    };

    vi.useFakeTimers();

    // Tag A
    vi.setSystemTime(new Date('2026-08-16T09:00:00Z'));
    const dayA = buildArticleJsonLd(input);
    const emptyDayA = buildArticleJsonLd(ARTICLE_INPUT);

    // Tag B — mehrere Monate später
    vi.setSystemTime(new Date('2027-01-31T23:59:59Z'));
    const dayB = buildArticleJsonLd(input);
    const emptyDayB = buildArticleJsonLd(ARTICLE_INPUT);

    expect(JSON.stringify(dayB)).toBe(JSON.stringify(dayA));
    expect(JSON.stringify(emptyDayB)).toBe(JSON.stringify(emptyDayA));
    expect(dayA.datePublished).toBe('2026-08-14');
    expect(emptyDayA).not.toHaveProperty('datePublished');
    expect(emptyDayA).not.toHaveProperty('dateModified');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Ratgeberartikel: keine erfundenen Daten', () => {
  it('9. injiziert Article-JSON-LD ohne datePublished/dateModified', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00Z'));

    window.history.pushState(
      {}, '', '/ratgeber/beruflich/finanzierung/vollkostenrechnung-weiterbildung'
    );

    render(<RatgeberArtikelView lang="de" />);

    await vi.waitFor(() => {
      expect(readSchema('ratgeber-article')).not.toBeNull();
    });

    const article = readSchema('ratgeber-article');
    expect(article['@type']).toBe('Article');
    expect(article).not.toHaveProperty('datePublished');
    expect(article).not.toHaveProperty('dateModified');
    expect(JSON.stringify(article)).not.toContain('2026-08-16');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

const THEME_WORLD_ROW = {
  id: 'tw-1',
  key: 'yoga',
  url_segment: 'privat-hobby',
  slug: 'yoga',
  status: 'published',
  title_de: 'Yoga',
  subtitle_de: 'Yoga-Kurse in der Schweiz',
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  og_image_alt_de: null,
  hero_image_alt_de: null,
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
    content_html: '<p>Inhalt</p>',
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
    ...overrides,
  };
}

/** Rendert SzenarioArtikelView im DB-only-Modus und gibt das Article-JSON-LD zurück. */
async function renderDbScenario(row) {
  dbEnabled.value = true;
  mockGetBereichBySlug.mockReturnValue(null);
  mockFetchThemeWorld.mockResolvedValue(THEME_WORLD_ROW);
  mockFetchPublishedScenario.mockResolvedValue(row);

  render(
    <SzenarioArtikelView
      segment="privat-hobby" slug="yoga" szenarioSlug={row.slug} courses={[]}
    />
  );

  await waitFor(() => {
    expect(readSchema('szenario-article')).not.toBeNull();
  });
  return readSchema('szenario-article');
}

describe('DB-Szenario: echte Datumsquellen', () => {
  it('10. übernimmt published_at als datePublished', async () => {
    const article = await renderDbScenario(scenarioRow());

    expect(article.datePublished).toBe('2026-08-14');
  });

  it('11. lässt dateModified weg, wenn kein verlässliches Änderungsdatum existiert', async () => {
    // updated_at ist gesetzt, last_reviewed_at nicht. updated_at wird vom
    // Trigger set_updated_at() auch bei reinen Status-/Sortierungsänderungen
    // angehoben und ist deshalb keine Quelle für dateModified.
    const article = await renderDbScenario(scenarioRow({ last_reviewed_at: null }));

    expect(article).not.toHaveProperty('dateModified');
    expect(JSON.stringify(article)).not.toContain('2026-08-16');
  });

  it('12. übernimmt last_reviewed_at exakt als dateModified', async () => {
    const article = await renderDbScenario(scenarioRow({ last_reviewed_at: '2026-03-14' }));

    expect(article.dateModified).toBe('2026-03-14');
    expect(article.datePublished).toBe('2026-08-14');
  });
});

describe('Legacy-Szenario: keine Datumsquelle', () => {
  it('13. erzeugt kein datePublished/dateModified', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00Z'));

    mockGetBereichBySlug.mockReturnValue({
      key: 'test_bereich', slug: 'test-bereich', segment: 'beruflich', typeKey: 'beruflich',
      areaSlug: 'test_bereich', title: { de: 'Testbereich' }, subtitle: { de: 'Testangebote' },
      heroImage: null, heroImageAlt: '',
      scenarios: [{
        slug: 'berufseinstieg', icon: '🎓', label: { de: 'Berufseinstieg als Trainer' },
        text: { de: 'Starte deine Laufbahn.' }, ctaLabel: { de: 'Kurse entdecken' },
        searchParams: {},
      }],
      specialtyDescriptions: {}, predefinedSearches: [], editorialSections: [],
      faqs: [], trustLogos: [], regionalDiscovery: null, ctaLinks: [], sectionTitles: {},
    });

    render(
      <SzenarioArtikelView
        segment="beruflich" slug="test-bereich" szenarioSlug="berufseinstieg" courses={[]}
      />
    );

    await vi.waitFor(() => {
      expect(readSchema('szenario-article')).not.toBeNull();
    });

    const article = readSchema('szenario-article');
    expect(article).not.toHaveProperty('datePublished');
    expect(article).not.toHaveProperty('dateModified');
    expect(JSON.stringify(article)).not.toContain('2026-08-16');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Parität Prerender ↔ Hydration', () => {
  /** Article-JSON-LD, das der Build für ein Szenario in das erste HTML schreibt. */
  function prerenderArticle(row) {
    const routes = buildThemeWorldPrerenderRoutes({
      worlds: [THEME_WORLD_ROW],
      scenarios: [row],
      baseUrl: BASE,
      logger: { warn: () => {} },
    });
    const scenarioRoute = routes.find((route) => route.kind === 'scenario');
    return scenarioRoute.jsonLd.find((schema) => schema['@type'] === 'Article');
  }

  it('14a. Szenario mit published_at: Prerender und Hydration setzen dieselben Felder', async () => {
    const row = scenarioRow({ last_reviewed_at: '2026-03-14' });

    const prerendered = prerenderArticle(row);
    const hydrated = await renderDbScenario(row);

    expect(prerendered.datePublished).toBe('2026-08-14');
    expect(prerendered.dateModified).toBe('2026-03-14');
    expect(hydrated.datePublished).toBe(prerendered.datePublished);
    expect(hydrated.dateModified).toBe(prerendered.dateModified);
    expect(prerendered.mainEntityOfPage['@id'])
      .toBe(`${BASE}/bereich/privat-hobby/yoga/yoga-einstieg`);
    expect(hydrated.mainEntityOfPage['@id']).toBe(prerendered.mainEntityOfPage['@id']);
  });

  it('14b. Szenario ohne Datumsquelle: beide Seiten lassen die Felder weg', async () => {
    const row = scenarioRow({ published_at: null, last_reviewed_at: null });

    const prerendered = prerenderArticle(row);
    const hydrated = await renderDbScenario(row);

    for (const article of [prerendered, hydrated]) {
      expect(article).not.toHaveProperty('datePublished');
      expect(article).not.toHaveProperty('dateModified');
    }
  });

  it('14c. Hydration dupliziert den prerenderten JSON-LD-Block nicht', async () => {
    const row = scenarioRow();
    const prerendered = prerenderArticle(row);

    // Erstes HTTP-HTML nachstellen: Build-Block liegt bereits im <head>.
    const buildScript = document.createElement('script');
    buildScript.type = 'application/ld+json';
    buildScript.setAttribute('data-prerender-jsonld', '0');
    buildScript.textContent = JSON.stringify(prerendered);
    document.head.appendChild(buildScript);

    await renderDbScenario(row);

    expect(document.head.querySelectorAll('script[data-prerender-jsonld]')).toHaveLength(0);
    const articles = [...document.head.querySelectorAll('script[type="application/ld+json"]')]
      .map((tag) => JSON.parse(tag.textContent))
      .filter((schema) => schema['@type'] === 'Article');
    expect(articles).toHaveLength(1);
    expect(articles[0].datePublished).toBe(prerendered.datePublished);
  });
});
