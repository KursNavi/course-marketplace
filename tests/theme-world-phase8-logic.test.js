/**
 * Phase 8 — Logiktests für rein dynamische Themenwelten (DB-only)
 *
 * Reine Logiktests ohne React-Rendering:
 *   1. Adapter — variable Anzahlen (3 Szenarien, 5 FAQs, 4 Bereiche, 3 Regionen, 2 Editorial, 3 Trust)
 *   2. Feature-Flag — DB-only-Modus
 *   3. Lifecycle — Status-Validierung
 *   4. Publish-Gates — Validierungslogik
 *   5. Generisches Routing — kein hardcodierter Test-Key
 *   6. Sport-/Yoga-Regression — Pilot-Modus unverändert
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock (themeWorldAdapter importiert supabase via themeWorldService)
// ---------------------------------------------------------------------------

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

import { adaptToLegacyBereichConfig } from '../src/lib/themeWorldAdapter.js';
import {
  isThemeWorldDbEnabled,
  isThemeWorldPilotActive,
} from '../src/lib/themeWorldFeatureFlag.js';

// ---------------------------------------------------------------------------
// Test-Daten: Test-Themenwelt Kreativ & Gestalten
// Bewusst ANDERE Anzahlen als Sport (8) und Yoga (8).
// ---------------------------------------------------------------------------

const TEST_TW_KEY = 'test_kreativ_gestalten';
const TEST_TW_SLUG = 'test-kreativ-gestalten';
const TEST_TW_SEGMENT = 'privat-hobby';

const buildTestThemeWorld = () => ({
  id: 'aaaabbbb-cccc-dddd-eeee-111122223333',
  key: TEST_TW_KEY,
  url_segment: TEST_TW_SEGMENT,
  slug: TEST_TW_SLUG,
  db_segment: 'privat',
  area_slug: 'kreativ_gestalten',
  title_de: 'Kreativ & Gestalten',
  subtitle_de: 'Kurse für kreative Menschen in der Schweiz',
  intro_de: 'Entdecke die Welt der kreativen Kurse.',
  meta_title: 'Kreativkurse Schweiz — Kurse & Ausbildungen 2026',
  meta_description: 'Finde Kreativkurse in der Schweiz.',
  hero_image_url: 'https://test.supabase.co/storage/v1/object/public/theme-world-images/hero.jpg',
  hero_image_alt_de: 'Kreative Menschen beim Malen',
  og_image_url: 'https://test.supabase.co/storage/v1/object/public/theme-world-images/og.jpg',
  search_config: { area_slug: 'kreativ_gestalten', type_key: 'privat_hobby' },
  predefined_searches: [
    { label_de: 'Malkurse Zürich', spec: 'malerei', loc: 'zürich' },
    { label_de: 'Keramik Online', spec: 'keramik', delivery: 'online' },
  ],
  cta_links: [],
  section_titles: null,
  status: 'published',
  published_at: '2026-07-21T10:00:00Z',
  created_at: '2026-07-20T08:00:00Z',
  updated_at: '2026-07-21T10:00:00Z',
});

// 3 Szenarien (bewusst abweichend von Sport/Yoga mit 8)
const buildTestScenarios = () => [
  {
    id: 'sc1', slug: 'kreativen-workshop-auswaehlen', icon: '🎨',
    label_de: 'Kreativen Workshop auswählen', teaser_de: 'Wie du den richtigen Workshop findest.',
    card_image_url: 'https://test.supabase.co/storage/v1/object/public/theme-world-images/sc1.jpg',
    card_image_alt: 'Workshop-Teilnehmer', sort_order: 1, status: 'published',
    published_at: '2026-07-21T10:00:00Z', content_html: '<p>Workshop-Inhalte.</p>',
    meta_title: 'Kreativen Workshop auswählen — Tipps 2026',
    meta_description: 'So findest du den richtigen Kreativworkshop.',
    cta_config: { label_de: 'Workshops anzeigen', spec: 'workshop' },
  },
  {
    id: 'sc2', slug: 'neues-hobby-ausprobieren', icon: '✨',
    label_de: 'Neues Hobby ausprobieren', teaser_de: 'Kreative Hobbys für Einsteiger.',
    card_image_url: null, card_image_alt: 'Hobbykurs', sort_order: 2, status: 'published',
    published_at: '2026-07-21T10:00:00Z', content_html: '<p>Hobby-Inhalte.</p>',
    meta_title: 'Neues Hobby ausprobieren — Kreativkurse 2026',
    meta_description: 'Entdecke kreative Hobbys.', cta_config: null,
  },
  {
    id: 'sc3', slug: 'kreativkurse-fuer-einsteiger', icon: '🖌️',
    label_de: 'Kreativkurse für Einsteiger', teaser_de: 'Perfekt für Kreativ-Neulinge.',
    card_image_url: null, card_image_alt: 'Einsteiger-Workshop', sort_order: 3, status: 'published',
    published_at: '2026-07-21T10:00:00Z', content_html: '<p>Einsteiger-Inhalte.</p>',
    meta_title: 'Kreativkurse für Einsteiger — Schweiz 2026',
    meta_description: 'Die besten Kreativkurse für Anfänger.',
    cta_config: { label_de: 'Kurse finden' },
  },
];

// 5 FAQs
const buildTestFaqs = () => [
  { id: 'faq1', question_de: 'Was kostet ein Kreativkurs?', answer_de: 'Zwischen CHF 50 und CHF 500.', sort_order: 1 },
  { id: 'faq2', question_de: 'Brauche ich Vorkenntnisse?', answer_de: 'Nein, Kurse für alle Levels.', sort_order: 2 },
  { id: 'faq3', question_de: 'Online oder Präsenz?', answer_de: 'Beides möglich.', sort_order: 3 },
  { id: 'faq4', question_de: 'Wo finde ich Kurse in Zürich?', answer_de: 'Über die Suche auf KursNavi.', sort_order: 4 },
  { id: 'faq5', question_de: 'Wie lange dauert ein Workshop?', answer_de: 'Typisch 2–4 Stunden.', sort_order: 5 },
];

// 4 Kursbereiche / Specialties
const buildTestSpecialties = () => [
  { id: 'sp1', specialty_label: 'Malerei & Zeichnen', description_de: 'Pinsel und Farbe.', icon: '🎨', sort_order: 1, is_active: true },
  { id: 'sp2', specialty_label: 'Keramik & Töpfern', description_de: 'Ton und Glasur.', icon: '🏺', sort_order: 2, is_active: true },
  { id: 'sp3', specialty_label: 'Fotografie', description_de: 'Bildgestaltung.', icon: '📸', sort_order: 3, is_active: true },
  { id: 'sp4', specialty_label: 'Textil & Nähen', description_de: 'Stoff und Nadel.', icon: '🧵', sort_order: 4, is_active: true },
];

// 3 Regionen
const buildTestRegions = () => [
  { id: 'reg1', label_de: 'Zürich', anchor_text_de: 'Kreativkurse Zürich', loc_param: 'zürich', delivery_param: null, sort_order: 1, is_active: true },
  { id: 'reg2', label_de: 'Bern', anchor_text_de: 'Kreativkurse Bern', loc_param: 'bern', delivery_param: null, sort_order: 2, is_active: true },
  { id: 'reg3', label_de: 'Online', anchor_text_de: 'Online-Kreativkurse', loc_param: null, delivery_param: 'online', sort_order: 3, is_active: true },
];

// 2 Editorial Sections
const buildTestEditorial = () => [
  {
    id: 'ed1', heading_de: 'Warum Kreativkurse?', intro_de: 'Kreativität fördert Wohlbefinden.',
    items_de: JSON.stringify(['Stressabbau', 'Neues lernen', 'Soziale Kontakte']),
    is_ordered: false, closing_de: 'Starte noch heute.', sort_order: 1, is_active: true,
  },
  {
    id: 'ed2', heading_de: 'So wählst du den richtigen Kurs', intro_de: 'Drei Schritte zur richtigen Wahl.',
    items_de: JSON.stringify(['Niveau bestimmen', 'Format wählen', 'Anbieter vergleichen']),
    is_ordered: true, closing_de: null, sort_order: 2, is_active: true,
  },
];

// 3 Trust Items
const buildTestTrustItems = () => [
  { id: 'tr1', item_type: 'info', name: null, description_de: 'Über 200 Kreativkurse', logo_url: null, logo_alt: null, external_url: null, rights_note: null, sort_order: 1, is_active: true },
  { id: 'tr2', item_type: 'info', name: null, description_de: 'Kurse in allen Kantonen', logo_url: null, logo_alt: null, external_url: null, rights_note: null, sort_order: 2, is_active: true },
  { id: 'tr3', item_type: 'info', name: null, description_de: 'Täglich aktualisiert', logo_url: null, logo_alt: null, external_url: null, rights_note: null, sort_order: 3, is_active: true },
];

const buildFullTestPageData = () => ({
  themeWorld: buildTestThemeWorld(),
  scenarios: buildTestScenarios(),
  faqs: buildTestFaqs(),
  specialties: buildTestSpecialties(),
  regions: buildTestRegions(),
  editorialSections: buildTestEditorial(),
  trustItems: buildTestTrustItems(),
});

// ---------------------------------------------------------------------------
// 1. Adapter — variable Anzahlen
// ---------------------------------------------------------------------------

describe('Phase 8: Adapter — variable Anzahlen für rein dynamische Themenwelt', () => {
  it('gibt genau 3 Szenarien zurück (nicht 8 wie Sport/Yoga)', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result).not.toBeNull();
    expect(result.scenarios).toHaveLength(3);
  });

  it('gibt genau 5 FAQs zurück', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.faqs).toHaveLength(5);
  });

  it('gibt genau 4 Kursbereiche (specialtyDescriptions) zurück', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(Object.keys(result.specialtyDescriptions)).toHaveLength(4);
  });

  it('gibt genau 3 Regionen in regionalDiscovery zurück', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.regionalDiscovery).not.toBeNull();
    expect(result.regionalDiscovery.regions).toHaveLength(3);
  });

  it('gibt genau 2 Editorial Sections zurück', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.editorialSections).toHaveLength(2);
  });

  it('gibt genau 3 Trust Items (trustLogos) zurück', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.trustLogos).toHaveLength(3);
  });

  it('gibt genau 2 vordefinierte Suchen zurück', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.predefinedSearches).toHaveLength(2);
  });

  it('Szenario-Slugs sind korrekt gesetzt', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    const slugs = result.scenarios.map(s => s.slug);
    expect(slugs).toContain('kreativen-workshop-auswaehlen');
    expect(slugs).toContain('neues-hobby-ausprobieren');
    expect(slugs).toContain('kreativkurse-fuer-einsteiger');
  });

  it('FAQ-Inhalte sind korrekt als Multilingual-Objekte übernommen', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    const firstFaq = result.faqs[0];
    expect(firstFaq.q.de).toBe('Was kostet ein Kreativkurs?');
    expect(firstFaq.a.de).toBe('Zwischen CHF 50 und CHF 500.');
  });

  it('Segment wird korrekt auf privat_hobby gemappt', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.typeKey).toBe('privat_hobby');
  });

  it('Specialties sind als gekeyertes Objekt (label → description) strukturiert', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.specialtyDescriptions['Malerei & Zeichnen']).toBeDefined();
    expect(result.specialtyDescriptions['Keramik & Töpfern']).toBeDefined();
    expect(result.specialtyDescriptions['Fotografie']).toBeDefined();
    expect(result.specialtyDescriptions['Textil & Nähen']).toBeDefined();
  });

  it('kein leerer Platzhalter bei 3 Szenarien', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.scenarios).toHaveLength(3);
    result.scenarios.forEach(s => {
      expect(s).not.toBeNull();
      expect(s.slug).toBeTruthy();
    });
  });

  it('Editorial Sections werden korrekt gemappt', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.editorialSections[0].heading.de).toBe('Warum Kreativkurse?');
    expect(result.editorialSections[1].heading.de).toBe('So wählst du den richtigen Kurs');
    expect(result.editorialSections[1].isOrdered).toBe(true);
  });

  it('Trust Items werden korrekt gemappt', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.trustLogos[0].description.de).toBe('Über 200 Kreativkurse');
    expect(result.trustLogos[2].description.de).toBe('Täglich aktualisiert');
  });

  it('Regionen haben korrekte Params-Struktur', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    const zürich = result.regionalDiscovery.regions[0];
    expect(zürich.label).toBe('Zürich');
    expect(zürich.params.loc).toBe('zürich');
    const online = result.regionalDiscovery.regions[2];
    expect(online.params.delivery).toBe('online');
    expect(online.params.loc).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Feature-Flag — DB-only-Modus
// ---------------------------------------------------------------------------

describe('Phase 8: Feature-Flag — DB-only-Modus für neue Themenwelten', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('isThemeWorldDbEnabled gibt true zurück wenn Flag gesetzt', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    expect(isThemeWorldDbEnabled()).toBe(true);
  });

  it('isThemeWorldDbEnabled gibt false zurück wenn Flag nicht gesetzt', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', '');
    expect(isThemeWorldDbEnabled()).toBe(false);
  });

  it('neue DB-only Themenwelt ist NICHT in Pilot-Keys → isThemeWorldPilotActive false', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,yoga_achtsamkeit');
    expect(isThemeWorldPilotActive(TEST_TW_KEY)).toBe(false);
  });

  it('DB-only-Modus: kein Pilot-Key nötig wenn kein Legacy-Eintrag', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,yoga_achtsamkeit');
    // Für DB-only TW: flag enabled + no legacy → DB-only mode aktiv
    const hasLegacy = false;
    const dbEnabled = isThemeWorldDbEnabled();
    const isDbOnlyMode = !hasLegacy && dbEnabled;
    expect(isDbOnlyMode).toBe(true);
  });

  it('DB-only-Modus ist inaktiv wenn DB-Flag nicht gesetzt', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'false');
    const hasLegacy = false;
    const dbEnabled = isThemeWorldDbEnabled();
    const isDbOnlyMode = !hasLegacy && dbEnabled;
    expect(isDbOnlyMode).toBe(false);
  });

  it('Legacy-Themenwelt mit Legacy-Eintrag nutzt nicht DB-only-Modus', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    const hasLegacy = true; // Legacy-Eintrag vorhanden (z.B. sport_fitness_beruf)
    const dbEnabled = isThemeWorldDbEnabled();
    const isDbOnlyMode = !hasLegacy && dbEnabled;
    expect(isDbOnlyMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Lifecycle — Status-Validierungslogik
// ---------------------------------------------------------------------------

describe('Phase 8: Lifecycle — Status-Validierungslogik', () => {
  it('Draft-Themenwelt hat kein published_at', () => {
    const draftTw = { ...buildTestThemeWorld(), status: 'draft', published_at: null };
    expect(draftTw.status).toBe('draft');
    expect(draftTw.published_at).toBeNull();
  });

  it('Published-Themenwelt hat published_at gesetzt', () => {
    const tw = buildTestThemeWorld();
    expect(tw.status).toBe('published');
    expect(tw.published_at).not.toBeNull();
    expect(new Date(tw.published_at).getTime()).toBeGreaterThan(0);
  });

  it('Archived-Themenwelt hat Status archived', () => {
    const archivedTw = { ...buildTestThemeWorld(), status: 'archived' };
    expect(archivedTw.status).toBe('archived');
    expect(archivedTw.status).not.toBe('draft');
    expect(archivedTw.status).not.toBe('published');
  });

  it('Draft-Szenario hat kein published_at', () => {
    const draftSc = { ...buildTestScenarios()[0], status: 'draft', published_at: null };
    expect(draftSc.status).toBe('draft');
    expect(draftSc.published_at).toBeNull();
  });

  it('Published-Szenario hat korrekten Slug und published_at', () => {
    const sc = buildTestScenarios()[0];
    expect(sc.status).toBe('published');
    expect(sc.published_at).not.toBeNull();
    expect(sc.slug).toBe('kreativen-workshop-auswaehlen');
  });

  it('Unpublish-Aktion setzt Status zurück auf draft', () => {
    // Simuliert die Unpublish-Logik
    const tw = buildTestThemeWorld();
    const unpublished = { ...tw, status: 'draft', deploy_status: 'not_requested' };
    expect(unpublished.status).toBe('draft');
    expect(unpublished.deploy_status).toBe('not_requested');
  });

  it('Archive-Aktion setzt Status auf archived', () => {
    const tw = buildTestThemeWorld();
    const archived = { ...tw, status: 'archived' };
    expect(archived.status).toBe('archived');
  });

  it('Archivierte Themenwelt kann nicht erneut publiziert werden', () => {
    const archivedTw = { ...buildTestThemeWorld(), status: 'archived' };
    // API blockiert publish wenn archived
    const canPublish = archivedTw.status !== 'archived';
    expect(canPublish).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Publish-Gates — Validierungslogik (serverseitig simuliert)
// ---------------------------------------------------------------------------

describe('Phase 8: Publish-Gates — Validierung fehlender Pflichtfelder', () => {
  // Simuliert die serverseitige Validierungslogik aus api/admin-theme-worlds.js
  const validatePublishThemeWorld = (tw, publishedScenarioCount) => {
    const errors = [];
    if (!tw.title_de) errors.push('title_de fehlt');
    if (!tw.slug) errors.push('slug fehlt');
    if (!tw.url_segment) errors.push('url_segment fehlt');
    if (!tw.db_segment) errors.push('db_segment fehlt');
    if (!tw.area_slug) errors.push('area_slug fehlt');
    if (!tw.meta_title) errors.push('meta_title fehlt');
    if (!tw.meta_description) errors.push('meta_description fehlt');
    if (tw.meta_title && tw.meta_title.length > 60) errors.push(`meta_title zu lang: ${tw.meta_title.length} Zeichen`);
    if (publishedScenarioCount === 0) errors.push('mindestens 1 publiziertes Szenario erforderlich');
    return errors;
  };

  it('vollständige Themenwelt hat keine Validierungsfehler', () => {
    const tw = buildTestThemeWorld();
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors).toHaveLength(0);
  });

  it('fehlender meta_title führt zu Validierungsfehler', () => {
    const tw = { ...buildTestThemeWorld(), meta_title: null };
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors).toContain('meta_title fehlt');
  });

  it('fehlende meta_description führt zu Validierungsfehler', () => {
    const tw = { ...buildTestThemeWorld(), meta_description: null };
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors).toContain('meta_description fehlt');
  });

  it('meta_title über 60 Zeichen führt zu Validierungsfehler', () => {
    const tw = { ...buildTestThemeWorld(), meta_title: 'A'.repeat(61) };
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors.some(e => e.includes('meta_title zu lang'))).toBe(true);
  });

  it('meta_title mit genau 60 Zeichen ist gültig', () => {
    const tw = { ...buildTestThemeWorld(), meta_title: 'A'.repeat(60) };
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors.some(e => e.includes('meta_title zu lang'))).toBe(false);
  });

  it('kein publiziertes Szenario führt zu Validierungsfehler', () => {
    const tw = buildTestThemeWorld();
    const errors = validatePublishThemeWorld(tw, 0);
    expect(errors).toContain('mindestens 1 publiziertes Szenario erforderlich');
  });

  it('3 publizierte Szenarien bestehen die Validierung', () => {
    const tw = buildTestThemeWorld();
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors).toHaveLength(0);
  });

  it('fehlender Slug führt zu Validierungsfehler', () => {
    const tw = { ...buildTestThemeWorld(), slug: '' };
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors).toContain('slug fehlt');
  });

  it('fehlende area_slug führt zu Validierungsfehler', () => {
    const tw = { ...buildTestThemeWorld(), area_slug: '' };
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors).toContain('area_slug fehlt');
  });

  it('fehlende db_segment führt zu Validierungsfehler', () => {
    const tw = { ...buildTestThemeWorld(), db_segment: '' };
    const errors = validatePublishThemeWorld(tw, 3);
    expect(errors).toContain('db_segment fehlt');
  });
});

// ---------------------------------------------------------------------------
// 5. Generisches Routing — kein hardcodierter Test-Key
// ---------------------------------------------------------------------------

describe('Phase 8: Generisches Routing — kein hardcodierter Test-Key im produktiven Code', () => {
  it('bereichLandingConfig enthält KEINEN test_kreativ_gestalten Eintrag', async () => {
    const { BEREICH_LANDING_CONFIG } = await import('../src/lib/bereichLandingConfig.js');
    expect(BEREICH_LANDING_CONFIG).not.toHaveProperty('test_kreativ_gestalten');
  });

  it('szenarioContent enthält KEINE test_kreativ_gestalten Einträge', async () => {
    const { SZENARIO_CONTENT } = await import('../src/lib/szenarioContent.js');
    const kreativKeys = Object.keys(SZENARIO_CONTENT).filter(k => k.startsWith('test_kreativ'));
    expect(kreativKeys).toHaveLength(0);
  });

  it('/bereich/privat-hobby/test-kreativ-gestalten wird als bereich-landing aufgelöst', () => {
    const path = '/bereich/privat-hobby/test-kreativ-gestalten';
    const parts = path.split('/').filter(Boolean);
    expect(parts).toHaveLength(3);
    const view = parts.length >= 4 ? 'bereich-szenario' : parts.length >= 3 ? 'bereich-landing' : 'search';
    expect(view).toBe('bereich-landing');
  });

  it('/bereich/privat-hobby/test-kreativ-gestalten/szenario-slug wird als bereich-szenario aufgelöst', () => {
    const path = '/bereich/privat-hobby/test-kreativ-gestalten/kreativen-workshop-auswaehlen';
    const parts = path.split('/').filter(Boolean);
    expect(parts).toHaveLength(4);
    const view = parts.length >= 4 ? 'bereich-szenario' : parts.length >= 3 ? 'bereich-landing' : 'search';
    expect(view).toBe('bereich-szenario');
  });

  it('URL-Segmente werden korrekt extrahiert', () => {
    const path = '/bereich/privat-hobby/test-kreativ-gestalten';
    const parts = path.split('/').filter(Boolean);
    const segment = parts[1]; // privat-hobby
    const slug = parts[2];    // test-kreativ-gestalten
    expect(segment).toBe('privat-hobby');
    expect(slug).toBe('test-kreativ-gestalten');
  });

  it('Adapter verarbeitet neue TW ohne Annahmen über bekannte Keys', () => {
    // Adapter-Ausgabe für Test-TW soll gültig sein
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result).not.toBeNull();
    expect(result.key).toBe(TEST_TW_KEY);
    expect(result.slug).toBe(TEST_TW_SLUG);
    expect(result.typeKey).toBe('privat_hobby');
  });
});

// ---------------------------------------------------------------------------
// 6. Variable Anzahlen — Bestätigung
// ---------------------------------------------------------------------------

describe('Phase 8: Variable Anzahlen — Bestätigung der Test-Themenwelt', () => {
  it('Test-Themenwelt hat 3 Szenarien (nicht 8 wie Sport/Yoga)', () => {
    expect(buildTestScenarios()).toHaveLength(3);
  });

  it('Test-Themenwelt hat 5 FAQs', () => {
    expect(buildTestFaqs()).toHaveLength(5);
  });

  it('Test-Themenwelt hat 4 Kursbereiche', () => {
    expect(buildTestSpecialties()).toHaveLength(4);
  });

  it('Test-Themenwelt hat 3 Regionen', () => {
    expect(buildTestRegions()).toHaveLength(3);
  });

  it('Test-Themenwelt hat 2 Editorial Sections', () => {
    expect(buildTestEditorial()).toHaveLength(2);
  });

  it('Test-Themenwelt hat 3 Trust Items', () => {
    expect(buildTestTrustItems()).toHaveLength(3);
  });

  it('Test-Themenwelt hat 2 vordefinierte Suchen', () => {
    expect(buildTestThemeWorld().predefined_searches).toHaveLength(2);
  });

  it('Adapter gibt alle variable Anzahlen korrekt weiter', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    expect(result.scenarios).toHaveLength(3);
    expect(result.faqs).toHaveLength(5);
    expect(Object.keys(result.specialtyDescriptions)).toHaveLength(4);
    expect(result.editorialSections).toHaveLength(2);
    expect(result.trustLogos).toHaveLength(3);
    expect(result.predefinedSearches).toHaveLength(2);
    expect(result.regionalDiscovery.regions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 7. Sport-/Yoga-Regression — Adapter gibt korrekten typeKey zurück
// ---------------------------------------------------------------------------

describe('Phase 8: Sport-/Yoga-Regression — Pilot-Modus und Adapter unverändert', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sport_fitness_beruf bleibt in Pilot-Keys aktiv', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,yoga_achtsamkeit');
    expect(isThemeWorldPilotActive('sport_fitness_beruf')).toBe(true);
  });

  it('yoga_achtsamkeit bleibt in Pilot-Keys aktiv', () => {
    vi.stubEnv('VITE_THEME_WORLD_DB_ENABLED', 'true');
    vi.stubEnv('VITE_THEME_WORLD_PILOT_KEYS', 'sport_fitness_beruf,yoga_achtsamkeit');
    expect(isThemeWorldPilotActive('yoga_achtsamkeit')).toBe(true);
  });

  it('Adapter gibt für Sport (db_segment=professionell) typeKey beruflich zurück', () => {
    const sportPageData = {
      themeWorld: {
        id: 'sport-id',
        key: 'sport_fitness_beruf',
        url_segment: 'beruflich',
        slug: 'sport-fitness-berufsausbildung',
        db_segment: 'professionell',
        area_slug: 'sport_fitness_beruf',
        title_de: 'Sport & Fitness Berufsausbildung',
        subtitle_de: 'Deine Karriere im Sport',
        intro_de: null,
        meta_title: 'Sport Fitness Ausbildung Schweiz',
        meta_description: 'Test',
        hero_image_url: null, hero_image_alt_de: null, og_image_url: null,
        search_config: { area_slug: 'sport_fitness_beruf', type_key: 'beruflich' },
        predefined_searches: [], cta_links: [], section_titles: null,
        status: 'published', published_at: '2026-07-01T00:00:00Z',
        created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
      },
      scenarios: [], faqs: [], specialties: [], regions: [], editorialSections: [], trustItems: [],
    };
    const result = adaptToLegacyBereichConfig(sportPageData);
    expect(result).not.toBeNull();
    expect(result.typeKey).toBe('beruflich');
  });

  it('Adapter gibt für Yoga (db_segment=privat) typeKey privat_hobby zurück', () => {
    const yogaPageData = {
      themeWorld: {
        id: 'yoga-id',
        key: 'yoga_achtsamkeit',
        url_segment: 'privat-hobby',
        slug: 'yoga-achtsamkeit',
        db_segment: 'privat',
        area_slug: 'yoga_achtsamkeit',
        title_de: 'Yoga & Achtsamkeit',
        subtitle_de: 'Deine Yoga-Reise',
        intro_de: null,
        meta_title: 'Yoga Kurse Schweiz',
        meta_description: 'Yoga in der Schweiz',
        hero_image_url: null, hero_image_alt_de: null, og_image_url: null,
        search_config: { area_slug: 'yoga_achtsamkeit', type_key: 'privat_hobby' },
        predefined_searches: [], cta_links: [], section_titles: null,
        status: 'published', published_at: '2026-07-01T00:00:00Z',
        created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
      },
      scenarios: [], faqs: [], specialties: [], regions: [], editorialSections: [], trustItems: [],
    };
    const result = adaptToLegacyBereichConfig(yogaPageData);
    expect(result).not.toBeNull();
    expect(result.typeKey).toBe('privat_hobby');
  });

  it('Test-Themenwelt erscheint NICHT in Sport-Daten', () => {
    const result = adaptToLegacyBereichConfig(buildFullTestPageData());
    // Test-Schlüssel ist test_kreativ_gestalten, nicht sport_fitness_beruf
    expect(result.key).toBe(TEST_TW_KEY);
    expect(result.key).not.toBe('sport_fitness_beruf');
    expect(result.key).not.toBe('yoga_achtsamkeit');
  });

  it('Keine Test-Testdaten erscheinen in BEREICH_LANDING_CONFIG (Sport/Yoga unverändert)', async () => {
    const { BEREICH_LANDING_CONFIG } = await import('../src/lib/bereichLandingConfig.js');
    // Sport und Yoga sind vorhanden
    expect(BEREICH_LANDING_CONFIG).toHaveProperty('sport_fitness_beruf');
    expect(BEREICH_LANDING_CONFIG).toHaveProperty('yoga_achtsamkeit');
    // Test-Key ist nicht vorhanden
    expect(BEREICH_LANDING_CONFIG).not.toHaveProperty('test_kreativ_gestalten');
  });
});
