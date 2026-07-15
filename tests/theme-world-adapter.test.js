/**
 * Tests für den Themenwelt-Datenadapter.
 * Prüft Transformation von DB-Daten in Legacy-Komponentenformat.
 */

import { describe, it, expect } from 'vitest';
import {
  adaptThemeWorldToConfig,
  adaptScenarioCard,
  adaptScenarioArticle,
  normalizeUrlSegment,
  urlSegmentToTypeKey,
  dbSegmentToUrlSegment,
  urlSegmentToDbSegment,
} from '../src/lib/themeWorldAdapter.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPORT_FITNESS_TW = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001',
  key: 'sport_fitness_beruf',
  url_segment: 'beruflich',
  slug: 'sport-fitness-berufsausbildung',
  db_segment: 'professionell',
  area_slug: 'sport_fitness_beruf',
  title_de: 'Sport & Fitness Berufsausbildung',
  subtitle_de: 'Dein Weg in die Fitness-Branche',
  intro_de: 'Entdecke Ausbildungswege im Sport- und Fitness-Bereich.',
  hero_image_url: 'https://example.com/hero.jpg',
  hero_image_alt_de: 'Fitness-Trainer bei der Arbeit',
  og_image_url: null,
  meta_title: null,
  meta_description: null,
  search_config: {
    area_slug: 'sport_fitness_beruf',
    type_key: 'beruflich',
    default_spec: 'Fitness Trainer',
  },
  section_titles: {
    scenarios_heading: 'Deine Berufswege',
  },
  predefined_searches: [
    { label_de: 'Fitness Trainer Ausbildung', spec: 'Fitness Trainer', loc: 'Zürich' },
  ],
  cta_links: [
    { label_de: 'Alle Kurse anzeigen', loc: null },
  ],
  status: 'published',
  published_at: '2026-07-14T10:00:00Z',
  updated_at: '2026-07-14T12:00:00Z',
};

const YOGA_TW = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002',
  key: 'yoga_achtsamkeit',
  url_segment: 'privat-hobby',
  slug: 'yoga-achtsamkeit',
  db_segment: 'privat',
  area_slug: 'yoga_achtsamkeit',
  title_de: 'Yoga & Achtsamkeit',
  subtitle_de: 'Innere Ruhe und Beweglichkeit',
  intro_de: null,
  hero_image_url: null,
  hero_image_alt_de: null,
  og_image_url: null,
  meta_title: 'Yoga Kurse Schweiz',
  meta_description: 'Finde Yoga-Kurse in deiner Nähe.',
  search_config: { area_slug: 'yoga_achtsamkeit' },
  section_titles: null,
  predefined_searches: null,
  cta_links: null,
  status: 'published',
  published_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-14T08:00:00Z',
};

const SPORT_SCENARIOS = [
  {
    id: 'sc-001',
    slug: 'berufseinstieg',
    icon: '🎓',
    label_de: 'Berufseinstieg als Trainer',
    teaser_de: 'Starte deine Karriere im Fitnessbereich.',
    card_image_url: 'https://example.com/card1.jpg',
    card_image_alt: 'Trainer erklärt Übung',
    sort_order: 0,
    published_at: '2026-07-10T10:00:00Z',
  },
  {
    id: 'sc-002',
    slug: 'weiterbildung',
    icon: '📚',
    label_de: 'Weiterbildung und Zertifikate',
    teaser_de: null,
    card_image_url: null,
    card_image_alt: null,
    sort_order: 1,
    published_at: '2026-07-10T10:00:00Z',
  },
];

const SPORT_FAQS = [
  { id: 'faq-001', question_de: 'Welche Ausbildungen gibt es?', answer_de: 'Zahlreiche.', sort_order: 0 },
  { id: 'faq-002', question_de: 'Wie lange dauert die Ausbildung?', answer_de: '1-3 Jahre.', sort_order: 1 },
  { id: 'faq-003', question_de: 'Was kostet eine Ausbildung?', answer_de: 'Variiert.', sort_order: 2 },
];

const SPORT_SPECIALTIES = [
  { id: 'sp-001', specialty_label: 'Fitness Trainer', description_de: 'Personal Training', icon: '💪', sort_order: 0 },
  { id: 'sp-002', specialty_label: 'Yoga Lehrer', description_de: null, icon: '🧘', sort_order: 1 },
];

const SPORT_REGIONS = [
  { id: 'rg-001', label_de: 'Zürich', anchor_text_de: null, loc_param: 'Zürich', delivery_param: null, sort_order: 0 },
  { id: 'rg-002', label_de: 'Online', anchor_text_de: 'Online-Kurse', loc_param: null, delivery_param: 'online_live', sort_order: 1 },
];

const SPORT_EDITORIAL = [
  {
    id: 'ed-001',
    heading_de: 'Karrierewege im Sport',
    intro_de: 'Die Schweizer Fitness-Branche wächst.',
    items_de: ['Trainer', 'Coach', 'Instruktor'],
    is_ordered: false,
    closing_de: 'Starte jetzt.',
    sort_order: 0,
  },
];

const SPORT_TRUST = [
  {
    id: 'tr-001',
    item_type: 'label',
    name: 'Qualitop',
    description_de: 'Anerkanntes Qualitätslabel.',
    logo_url: 'https://qualitop.ch/logo.png',
    logo_alt: 'Qualitop Logo',
    external_url: 'https://qualitop.ch',
    rights_note: null,
    sort_order: 0,
  },
  {
    id: 'tr-002',
    item_type: 'editorial',
    name: 'Redaktionelle Einschätzung',
    description_de: 'Unser Team empfiehlt.',
    logo_url: null,
    logo_alt: null,
    external_url: null,
    rights_note: null,
    sort_order: 1,
  },
];

// ---------------------------------------------------------------------------
// Segmentnormalisierung
// ---------------------------------------------------------------------------

describe('Segmentnormalisierung', () => {
  it('normalizeUrlSegment: Unterstriche zu Bindestrichen', () => {
    expect(normalizeUrlSegment('privat_hobby')).toBe('privat-hobby');
  });

  it('normalizeUrlSegment: Bindestriche bleiben', () => {
    expect(normalizeUrlSegment('privat-hobby')).toBe('privat-hobby');
  });

  it('urlSegmentToTypeKey: beruflich', () => {
    expect(urlSegmentToTypeKey('beruflich')).toBe('beruflich');
  });

  it('urlSegmentToTypeKey: privat-hobby → privat_hobby', () => {
    expect(urlSegmentToTypeKey('privat-hobby')).toBe('privat_hobby');
  });

  it('urlSegmentToTypeKey: kinder-jugend → kinder_jugend', () => {
    expect(urlSegmentToTypeKey('kinder-jugend')).toBe('kinder_jugend');
  });

  it('dbSegmentToUrlSegment: professionell → beruflich', () => {
    expect(dbSegmentToUrlSegment('professionell')).toBe('beruflich');
  });

  it('dbSegmentToUrlSegment: privat → privat-hobby', () => {
    expect(dbSegmentToUrlSegment('privat')).toBe('privat-hobby');
  });

  it('dbSegmentToUrlSegment: kinder → kinder-jugend', () => {
    expect(dbSegmentToUrlSegment('kinder')).toBe('kinder-jugend');
  });

  it('urlSegmentToDbSegment: beruflich → professionell', () => {
    expect(urlSegmentToDbSegment('beruflich')).toBe('professionell');
  });

  it('urlSegmentToDbSegment: privat-hobby → privat', () => {
    expect(urlSegmentToDbSegment('privat-hobby')).toBe('privat');
  });
});

// ---------------------------------------------------------------------------
// Sport & Fitness Fixture
// ---------------------------------------------------------------------------

describe('Adapter: Sport & Fitness Fixture', () => {
  const result = adaptThemeWorldToConfig({
    themeWorld: SPORT_FITNESS_TW,
    scenarios: SPORT_SCENARIOS,
    faqs: SPORT_FAQS,
    specialties: SPORT_SPECIALTIES,
    regions: SPORT_REGIONS,
    editorialSections: SPORT_EDITORIAL,
    trustItems: SPORT_TRUST,
  });

  it('gibt eine gültige Konfiguration zurück', () => {
    expect(result).not.toBeNull();
    expect(result).toBeDefined();
  });

  it('übernimmt key und slug korrekt', () => {
    expect(result.key).toBe('sport_fitness_beruf');
    expect(result.slug).toBe('sport-fitness-berufsausbildung');
  });

  it('normalisiert Segment korrekt', () => {
    expect(result.segment).toBe('beruflich');
    expect(result.typeKey).toBe('beruflich');
    expect(result.dbSegment).toBe('professionell');
  });

  it('adaptiert searchConfig korrekt', () => {
    expect(result.searchConfig.areaSlug).toBe('sport_fitness_beruf');
    expect(result.searchConfig.defaultSpec).toBe('Fitness Trainer');
  });

  it('adaptiert Abschnittsüberschriften korrekt', () => {
    expect(result.sectionTitles.scenarios).toBe('Deine Berufswege');
    expect(result.sectionTitles.faqs).toBeNull();
  });

  it('adaptiert Szenario-Karten korrekt', () => {
    expect(result.scenarios).toHaveLength(2);
    const s1 = result.scenarios[0];
    expect(s1.slug).toBe('berufseinstieg');
    expect(s1.icon).toBe('🎓');
    expect(s1.label).toBe('Berufseinstieg als Trainer');
    expect(s1.cardImageUrl).toBe('https://example.com/card1.jpg');
  });

  it('adaptiert Szenario ohne Bild korrekt', () => {
    const s2 = result.scenarios[1];
    expect(s2.cardImageUrl).toBeNull();
    expect(s2.teaser).toBeNull();
  });

  it('adaptiert Specialties korrekt', () => {
    expect(result.specialties).toHaveLength(2);
    expect(result.specialties[0].label).toBe('Fitness Trainer');
    expect(result.specialties[1].icon).toBe('🧘');
  });

  it('adaptiert Regionen korrekt', () => {
    expect(result.regions).toHaveLength(2);
    expect(result.regions[0].locParam).toBe('Zürich');
    expect(result.regions[1].deliveryParam).toBe('online_live');
    expect(result.regions[1].anchorText).toBe('Online-Kurse');
  });

  it('adaptiert Editorial Sections korrekt', () => {
    expect(result.editorialSections).toHaveLength(1);
    const es = result.editorialSections[0];
    expect(es.heading).toBe('Karrierewege im Sport');
    expect(es.items).toEqual(['Trainer', 'Coach', 'Instruktor']);
    expect(es.isOrdered).toBe(false);
  });

  it('adaptiert FAQs korrekt (3 FAQs)', () => {
    expect(result.faqs).toHaveLength(3);
    expect(result.faqs[0].question).toBe('Welche Ausbildungen gibt es?');
    expect(result.faqs[2].question).toBe('Was kostet eine Ausbildung?');
  });

  it('adaptiert Trust Items korrekt', () => {
    expect(result.trustItems).toHaveLength(2);
    const label = result.trustItems[0];
    const editorial = result.trustItems[1];
    expect(label.type).toBe('label');
    expect(label.logoUrl).toBe('https://qualitop.ch/logo.png');
    expect(editorial.type).toBe('editorial');
    expect(editorial.logoUrl).toBeNull();
  });

  it('adaptiert Bilder korrekt', () => {
    expect(result.heroImageUrl).toBe('https://example.com/hero.jpg');
    expect(result.heroImageAlt).toBe('Fitness-Trainer bei der Arbeit');
    expect(result.ogImageUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Yoga & Achtsamkeit Fixture
// ---------------------------------------------------------------------------

describe('Adapter: Yoga & Achtsamkeit Fixture', () => {
  const result = adaptThemeWorldToConfig({
    themeWorld: YOGA_TW,
    scenarios: [],
    faqs: [{ id: 'faq-y1', question_de: 'Was ist Yoga?', answer_de: 'Eine Praxis.', sort_order: 0 }],
    specialties: [],
    regions: [],
    editorialSections: [],
    trustItems: [],
  });

  it('normalisiert Segment privat-hobby korrekt', () => {
    expect(result.segment).toBe('privat-hobby');
    expect(result.typeKey).toBe('privat_hobby');
    expect(result.dbSegment).toBe('privat');
  });

  it('gibt leere Arrays für fehlende Sub-Entitäten zurück', () => {
    expect(result.scenarios).toHaveLength(0);
    expect(result.specialties).toHaveLength(0);
    expect(result.regions).toHaveLength(0);
  });

  it('adaptiert eine FAQ korrekt', () => {
    expect(result.faqs).toHaveLength(1);
    expect(result.faqs[0].question).toBe('Was ist Yoga?');
  });

  it('übernimmt SEO-Felder korrekt', () => {
    expect(result.metaTitle).toBe('Yoga Kurse Schweiz');
    expect(result.metaDescription).toBe('Finde Yoga-Kurse in deiner Nähe.');
  });

  it('kein Hero-Bild → heroImageUrl ist null', () => {
    expect(result.heroImageUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// adaptScenarioCard
// ---------------------------------------------------------------------------

describe('adaptScenarioCard', () => {
  it('adaptiert Karte korrekt', () => {
    const card = adaptScenarioCard(SPORT_SCENARIOS[0]);
    expect(card.slug).toBe('berufseinstieg');
    expect(card.icon).toBe('🎓');
    expect(card.label).toBe('Berufseinstieg als Trainer');
    expect(card.cardImageUrl).toBe('https://example.com/card1.jpg');
    expect(card.cardImageAlt).toBe('Trainer erklärt Übung');
  });

  it('setzt cardImageUrl auf null wenn leer', () => {
    const card = adaptScenarioCard(SPORT_SCENARIOS[1]);
    expect(card.cardImageUrl).toBeNull();
    expect(card.teaser).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// adaptScenarioArticle
// ---------------------------------------------------------------------------

describe('adaptScenarioArticle', () => {
  const fullScenario = {
    id: 'sc-001',
    slug: 'berufseinstieg',
    theme_world_id: SPORT_FITNESS_TW.id,
    icon: '🎓',
    label_de: 'Berufseinstieg als Trainer',
    teaser_de: 'Start deine Karriere.',
    content_html: '<p>Vollständiger Inhalt</p>',
    card_image_url: null,
    card_image_alt: null,
    og_image_url: null,
    meta_title: null,
    meta_description: null,
    cta_label_de: 'Jetzt Kurse finden',
    cta_config: { spec: 'Fitness Trainer', loc: 'Zürich' },
    sort_order: 0,
    status: 'published',
    published_at: '2026-07-10T10:00:00Z',
    updated_at: '2026-07-10T10:00:00Z',
    last_reviewed_at: null,
  };

  const article = adaptScenarioArticle(fullScenario, SPORT_FITNESS_TW);

  it('generiert kanonischen Pfad korrekt', () => {
    expect(article.canonicalPath).toBe('/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg');
  });

  it('übernimmt CTA-Config korrekt', () => {
    expect(article.ctaConfig.spec).toBe('Fitness Trainer');
    expect(article.ctaConfig.loc).toBe('Zürich');
    expect(article.ctaConfig.areaSlug).toBe('sport_fitness_beruf');
    expect(article.ctaConfig.typeKey).toBe('beruflich');
  });

  it('übernimmt Artikelinhalt', () => {
    expect(article.contentHtml).toBe('<p>Vollständiger Inhalt</p>');
  });

  it('gibt Themenwelt-Titel weiter', () => {
    expect(article.themeWorldTitle).toBe('Sport & Fitness Berufsausbildung');
  });
});

// ---------------------------------------------------------------------------
// Null-Eingabe
// ---------------------------------------------------------------------------

describe('Adapter: Null-Eingabe', () => {
  it('gibt null zurück wenn themeWorld null ist', () => {
    expect(adaptThemeWorldToConfig({ themeWorld: null })).toBeNull();
  });

  it('akzeptiert leere Arrays', () => {
    const result = adaptThemeWorldToConfig({
      themeWorld: SPORT_FITNESS_TW,
      scenarios: [],
      faqs: [],
      specialties: [],
      regions: [],
      editorialSections: [],
      trustItems: [],
    });
    expect(result).not.toBeNull();
    expect(result.faqs).toHaveLength(0);
    expect(result.specialties).toHaveLength(0);
  });
});
