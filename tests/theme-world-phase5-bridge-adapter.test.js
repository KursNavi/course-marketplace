/**
 * Phase 5 Tests: Bridge-Adapter (adaptToLegacyBereichConfig, adaptToLegacySzenarioConfig)
 *
 * Prüft die Konvertierung von rohen DB-Daten in das Legacy-Komponentenformat.
 */

import { describe, it, expect } from 'vitest';
import {
  adaptToLegacyBereichConfig,
  adaptToLegacySzenarioConfig,
} from '../src/lib/themeWorldAdapter.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TW = {
  id: 'tw-sport-01',
  key: 'sport_fitness_beruf',
  slug: 'sport-fitness-berufsausbildung',
  url_segment: 'beruflich',
  db_segment: 'professionell',
  area_slug: 'sport_fitness_beruf',
  title_de: 'Sport & Fitness Berufsausbildung',
  subtitle_de: 'Fitnesstrainer, Personal Training und mehr',
  intro_de: null,
  hero_image_url: 'https://images.unsplash.com/photo-test',
  hero_image_alt_de: 'Fitness-Trainer beim Training',
  meta_title: 'Sport & Fitness Ausbildung Schweiz | KursNavi',
  meta_description: 'Fitnesstrainer werden in der Schweiz',
  status: 'draft',
  search_config: {
    area_slug: 'sport_fitness_beruf',
    type_key: 'beruflich',
    default_spec: null,
  },
  section_titles: {
    scenarios_heading: 'Wo stehst du?',
    scenarios_subheading: 'Finde den passenden Einstieg',
    specialties_heading: 'Ausbildungsbereiche',
    specialties_subheading: 'Alle Schwerpunkte auf einen Blick',
    trust_heading: 'Qualitätssiegel',
    cta_heading: 'Bereit für den nächsten Schritt?',
    cta_button: 'Alle Kurse anzeigen',
  },
  predefined_searches: [
    { label_de: 'Fitnesstrainer Basiskurs', spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung', loc: null, delivery: null, sort_order: 1 },
    { label_de: 'Kurse in Zürich', spec: null, focus: null, loc: 'Zürich', delivery: null, sort_order: 2 },
  ],
  cta_links: [
    { label_de: 'In Zürich entdecken', loc: 'Zürich', delivery: null, sort_order: 1 },
  ],
};

const SCENARIOS = [
  {
    id: 's-01',
    theme_world_id: 'tw-sport-01',
    slug: 'berufseinstieg',
    icon: '🎓',
    label_de: 'Berufseinstieg',
    teaser_de: 'Du willst Fitnesstrainer werden?',
    card_image_url: null,
    card_image_alt: null,
    cta_label_de: 'Einstiegskurse entdecken',
    cta_config: { spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' },
    sort_order: 1,
    status: 'published',
    published_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 's-02',
    theme_world_id: 'tw-sport-01',
    slug: 'quereinstieg',
    icon: '🔄',
    label_de: 'Quereinstieg',
    teaser_de: 'Aus einem anderen Beruf in die Fitnessbranche.',
    card_image_url: null,
    card_image_alt: null,
    cta_label_de: 'Quereinsteiger-Kurse entdecken',
    cta_config: {},
    sort_order: 2,
    status: 'published',
    published_at: '2026-07-15T00:00:00Z',
  },
];

const FAQS = [
  { id: 'f-01', theme_world_id: 'tw-sport-01', question_de: 'Was kostet die Ausbildung?', answer_de: 'Ca. CHF 12\'600.', sort_order: 1, is_active: true },
  { id: 'f-02', theme_world_id: 'tw-sport-01', question_de: 'Gibt es Bundesbeiträge?', answer_de: 'Ja, bis 50%.', sort_order: 2, is_active: true },
];

const EDITORIAL_SECTIONS = [
  {
    id: 'es-01',
    theme_world_id: 'tw-sport-01',
    heading_de: 'Woran du einen Lehrgang erkennst',
    intro_de: 'Nicht jede Ausbildung ist gleich.',
    items_de: ['Anerkannte Ausbildung', 'Praktische Erfahrung'],
    is_ordered: false,
    closing_de: 'Frag vor der Buchung.',
    sort_order: 1,
    is_active: true,
  },
];

const SPECIALTIES = [
  { id: 'sp-01', theme_world_id: 'tw-sport-01', specialty_label: 'Fitness-Trainer-Ausbildung', description_de: 'Grundausbildung für Trainer', icon: '💪', sort_order: 1, is_active: true },
  { id: 'sp-02', theme_world_id: 'tw-sport-01', specialty_label: 'Personal Training', description_de: '1:1 Coaching', icon: '🏃', sort_order: 2, is_active: true },
];

const REGIONS = [
  { id: 'r-01', theme_world_id: 'tw-sport-01', label_de: 'Zürich', anchor_text_de: 'Ausbildungen in Zürich', loc_param: 'Zürich', delivery_param: null, sort_order: 1, is_active: true },
  { id: 'r-02', theme_world_id: 'tw-sport-01', label_de: 'Ganze Schweiz (Online)', anchor_text_de: 'Online Ausbildungen', loc_param: null, delivery_param: 'online', sort_order: 2, is_active: true },
];

const TRUST_ITEMS = [
  { id: 'ti-01', theme_world_id: 'tw-sport-01', item_type: 'label', name: 'Qualitop', description_de: 'Qualitätslabel', logo_url: null, logo_alt: null, external_url: null, rights_note: null, sort_order: 1, is_active: true },
];

// ---------------------------------------------------------------------------
// adaptToLegacyBereichConfig Tests
// ---------------------------------------------------------------------------

describe('adaptToLegacyBereichConfig — Grundstruktur', () => {
  const adapted = adaptToLegacyBereichConfig({
    themeWorld: TW,
    scenarios: SCENARIOS,
    faqs: FAQS,
    editorialSections: EDITORIAL_SECTIONS,
    specialties: SPECIALTIES,
    regions: REGIONS,
    trustItems: TRUST_ITEMS,
  });

  it('Gibt null zurück wenn themeWorld null', () => {
    const result = adaptToLegacyBereichConfig({ themeWorld: null });
    expect(result).toBeNull();
  });

  it('Gibt ein Objekt zurück', () => {
    expect(adapted).toBeDefined();
    expect(typeof adapted).toBe('object');
  });

  it('key korrekt', () => {
    expect(adapted.key).toBe('sport_fitness_beruf');
  });

  it('slug korrekt', () => {
    expect(adapted.slug).toBe('sport-fitness-berufsausbildung');
  });

  it('typeKey korrekt (beruflich)', () => {
    expect(adapted.typeKey).toBe('beruflich');
  });

  it('areaSlug korrekt', () => {
    expect(adapted.areaSlug).toBe('sport_fitness_beruf');
  });
});

describe('adaptToLegacyBereichConfig — Multilingual-Format', () => {
  const adapted = adaptToLegacyBereichConfig({ themeWorld: TW });

  it('title ist Multilingual-Objekt { de: ... }', () => {
    expect(adapted.title).toHaveProperty('de');
    expect(adapted.title.de).toBe('Sport & Fitness Berufsausbildung');
  });

  it('subtitle ist Multilingual-Objekt { de: ... }', () => {
    expect(adapted.subtitle).toHaveProperty('de');
    expect(adapted.subtitle.de).toBe('Fitnesstrainer, Personal Training und mehr');
  });
});

describe('adaptToLegacyBereichConfig — Hero-Bild', () => {
  const adapted = adaptToLegacyBereichConfig({ themeWorld: TW });

  it('heroImage als direkter String (nicht heroImageUrl)', () => {
    expect(adapted.heroImage).toBe('https://images.unsplash.com/photo-test');
  });
});

describe('adaptToLegacyBereichConfig — Szenarien', () => {
  const adapted = adaptToLegacyBereichConfig({
    themeWorld: TW,
    scenarios: SCENARIOS,
  });

  it('scenarios-Array vorhanden mit korrekter Länge', () => {
    expect(Array.isArray(adapted.scenarios)).toBe(true);
    expect(adapted.scenarios).toHaveLength(2);
  });

  it('Szenario-Labels als Multilingual-Objekt', () => {
    expect(adapted.scenarios[0].label).toHaveProperty('de');
    expect(adapted.scenarios[0].label.de).toBe('Berufseinstieg');
  });

  it('Szenario-Teaser als Multilingual-Objekt (text)', () => {
    expect(adapted.scenarios[0].text).toHaveProperty('de');
    expect(adapted.scenarios[0].text.de).toBe('Du willst Fitnesstrainer werden?');
  });

  it('Szenario hat icon', () => {
    expect(adapted.scenarios[0].icon).toBe('🎓');
  });

  it('Szenario hat slug', () => {
    expect(adapted.scenarios[0].slug).toBe('berufseinstieg');
  });

  it('Szenario hat ctaLabel als Multilingual-Objekt', () => {
    expect(adapted.scenarios[0].ctaLabel).toHaveProperty('de');
  });

  it('Szenario hat searchParams aus cta_config', () => {
    expect(adapted.scenarios[0].searchParams).toBeDefined();
    expect(adapted.scenarios[0].searchParams.spec).toBe('Fitness-Trainer-Ausbildung');
  });
});

describe('adaptToLegacyBereichConfig — Specialties', () => {
  const adapted = adaptToLegacyBereichConfig({
    themeWorld: TW,
    specialties: SPECIALTIES,
  });

  it('specialtyDescriptions ist ein Objekt (keyed by label)', () => {
    expect(typeof adapted.specialtyDescriptions).toBe('object');
    expect(adapted.specialtyDescriptions).not.toBeNull();
  });

  it('Specialty-Beschreibung im korrekten Format { de, icon }', () => {
    const sp = adapted.specialtyDescriptions['Fitness-Trainer-Ausbildung'];
    expect(sp).toBeDefined();
    expect(sp.de).toBe('Grundausbildung für Trainer');
    expect(sp.icon).toBe('💪');
  });

  it('Personal Training ebenfalls vorhanden', () => {
    expect(adapted.specialtyDescriptions['Personal Training']).toBeDefined();
  });
});

describe('adaptToLegacyBereichConfig — Regionen', () => {
  const adapted = adaptToLegacyBereichConfig({
    themeWorld: TW,
    regions: REGIONS,
  });

  it('regionalDiscovery ist vorhanden wenn Regionen existieren', () => {
    expect(adapted.regionalDiscovery).not.toBeNull();
  });

  it('Regionen haben label und params', () => {
    const r = adapted.regionalDiscovery.regions[0];
    expect(r.label).toBe('Zürich');
    expect(r.params).toBeDefined();
    expect(r.params.loc).toBe('Zürich');
  });

  it('Online-Region hat delivery-Param', () => {
    const r = adapted.regionalDiscovery.regions[1];
    expect(r.params.delivery).toBe('online');
  });

  it('regionalDiscovery ist null wenn keine Regionen', () => {
    const res = adaptToLegacyBereichConfig({ themeWorld: TW, regions: [] });
    expect(res.regionalDiscovery).toBeNull();
  });
});

describe('adaptToLegacyBereichConfig — FAQs', () => {
  const adapted = adaptToLegacyBereichConfig({ themeWorld: TW, faqs: FAQS });

  it('FAQs sind vorhanden', () => {
    expect(Array.isArray(adapted.faqs)).toBe(true);
    expect(adapted.faqs).toHaveLength(2);
  });

  it('FAQ-Frage als { q: { de } }', () => {
    expect(adapted.faqs[0].q).toHaveProperty('de');
    expect(adapted.faqs[0].q.de).toBe('Was kostet die Ausbildung?');
  });

  it('FAQ-Antwort als { a: { de } }', () => {
    expect(adapted.faqs[0].a).toHaveProperty('de');
  });
});

describe('adaptToLegacyBereichConfig — Editorial Sections', () => {
  const adapted = adaptToLegacyBereichConfig({ themeWorld: TW, editorialSections: EDITORIAL_SECTIONS });

  it('editorialSections vorhanden', () => {
    expect(Array.isArray(adapted.editorialSections)).toBe(true);
    expect(adapted.editorialSections).toHaveLength(1);
  });

  it('Überschrift als { de }', () => {
    expect(adapted.editorialSections[0].heading).toHaveProperty('de');
    expect(adapted.editorialSections[0].heading.de).toBe('Woran du einen Lehrgang erkennst');
  });

  it('items als { de: [...] }', () => {
    expect(adapted.editorialSections[0].items).toHaveProperty('de');
    expect(Array.isArray(adapted.editorialSections[0].items.de)).toBe(true);
  });

  it('isOrdered korrekt', () => {
    expect(adapted.editorialSections[0].isOrdered).toBe(false);
  });
});

describe('adaptToLegacyBereichConfig — Section Titles', () => {
  const adapted = adaptToLegacyBereichConfig({ themeWorld: TW });

  it('sectionTitles vorhanden', () => {
    expect(adapted.sectionTitles).toBeDefined();
  });

  it('scenarioTitle aus DB-Daten', () => {
    expect(adapted.sectionTitles.scenarioTitle).toHaveProperty('de');
    expect(adapted.sectionTitles.scenarioTitle.de).toBe('Wo stehst du?');
  });

  it('ctaButton aus DB-Daten', () => {
    expect(adapted.sectionTitles.ctaButton).toHaveProperty('de');
    expect(adapted.sectionTitles.ctaButton.de).toBe('Alle Kurse anzeigen');
  });

  it('Fallback für fehlende section_titles', () => {
    const res = adaptToLegacyBereichConfig({ themeWorld: { ...TW, section_titles: {} } });
    expect(res.sectionTitles.scenarioTitle.de).toBe('Wo stehst du?');
    expect(res.sectionTitles.ctaButton.de).toBe('Alle Kurse anzeigen');
  });
});

describe('adaptToLegacyBereichConfig — Trust Logos', () => {
  const adapted = adaptToLegacyBereichConfig({ themeWorld: TW, trustItems: TRUST_ITEMS });

  it('trustLogos-Array vorhanden', () => {
    expect(Array.isArray(adapted.trustLogos)).toBe(true);
    expect(adapted.trustLogos).toHaveLength(1);
  });

  it('Trust-Logo hat name und description.de', () => {
    expect(adapted.trustLogos[0].name).toBe('Qualitop');
    expect(adapted.trustLogos[0].description).toHaveProperty('de');
  });
});

describe('adaptToLegacyBereichConfig — Predefined Searches', () => {
  const adapted = adaptToLegacyBereichConfig({ themeWorld: TW });

  it('predefinedSearches vorhanden', () => {
    expect(Array.isArray(adapted.predefinedSearches)).toBe(true);
    expect(adapted.predefinedSearches).toHaveLength(2);
  });

  it('label als { de }', () => {
    expect(adapted.predefinedSearches[0].label).toHaveProperty('de');
    expect(adapted.predefinedSearches[0].label.de).toBe('Fitnesstrainer Basiskurs');
  });

  it('params enthält spec und focus', () => {
    expect(adapted.predefinedSearches[0].params.spec).toBe('Fitness-Trainer-Ausbildung');
    expect(adapted.predefinedSearches[0].params.focus).toBe('Basis-Ausbildung');
  });

  it('extraParams enthält loc', () => {
    expect(adapted.predefinedSearches[1].extraParams.loc).toBe('Zürich');
  });
});

// ---------------------------------------------------------------------------
// adaptToLegacySzenarioConfig Tests
// ---------------------------------------------------------------------------

const FULL_SCENARIO = {
  id: 's-01',
  slug: 'berufseinstieg',
  icon: '🎓',
  label_de: 'Berufseinstieg',
  teaser_de: 'Du willst Fitnesstrainer werden?',
  content_html: '<p>Artikel-Inhalt...</p>',
  card_image_url: null,
  card_image_alt: null,
  cta_label_de: 'Einstiegskurse entdecken',
  cta_config: { spec: 'Fitness-Trainer-Ausbildung', loc: 'Zürich' },
  meta_title: 'Berufseinstieg Fitness | KursNavi',
  meta_description: 'Du willst Fitnesstrainer werden?',
  sort_order: 1,
  status: 'published',
};

describe('adaptToLegacySzenarioConfig — Grundstruktur', () => {
  const adapted = adaptToLegacySzenarioConfig(FULL_SCENARIO, { area_slug: 'sport_fitness_beruf' });

  it('Gibt null zurück wenn scenario null', () => {
    expect(adaptToLegacySzenarioConfig(null)).toBeNull();
  });

  it('slug korrekt', () => {
    expect(adapted.slug).toBe('berufseinstieg');
  });

  it('icon korrekt', () => {
    expect(adapted.icon).toBe('🎓');
  });

  it('label als { de }', () => {
    expect(adapted.label).toHaveProperty('de');
    expect(adapted.label.de).toBe('Berufseinstieg');
  });

  it('text als { de } (teaser)', () => {
    expect(adapted.text).toHaveProperty('de');
    expect(adapted.text.de).toBe('Du willst Fitnesstrainer werden?');
  });

  it('ctaLabel als { de }', () => {
    expect(adapted.ctaLabel).toHaveProperty('de');
    expect(adapted.ctaLabel.de).toBe('Einstiegskurse entdecken');
  });

  it('searchParams aus cta_config', () => {
    expect(adapted.searchParams.spec).toBe('Fitness-Trainer-Ausbildung');
    expect(adapted.searchParams.loc).toBe('Zürich');
  });

  it('contentHtml vorhanden', () => {
    expect(adapted.contentHtml).toBe('<p>Artikel-Inhalt...</p>');
  });

  it('metaTitle vorhanden', () => {
    expect(adapted.metaTitle).toBe('Berufseinstieg Fitness | KursNavi');
  });
});

describe('adaptToLegacySzenarioConfig — Segmentnormalisierung', () => {
  it('Korrekte Typen für alle Felder', () => {
    const adapted = adaptToLegacySzenarioConfig(FULL_SCENARIO);
    expect(typeof adapted.slug).toBe('string');
    expect(typeof adapted.label).toBe('object');
    expect(typeof adapted.text).toBe('object');
    expect(typeof adapted.searchParams).toBe('object');
  });
});
