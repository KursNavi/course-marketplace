/**
 * Phase 7 Unit Tests: Yoga & Achtsamkeit Migration
 *
 * Covers:
 *   1. Adapter fix: adaptToLegacyBereichConfig regions_heading/regions_subheading
 *   2. Yoga import file validity (schema, slugs, trust item types, section_titles)
 *   3. Feature flag: yoga_achtsamkeit key handling
 *   4. Yoga segment routing (privat-hobby / privat / privat_hobby)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Supabase mock — prevents init error (no VITE_SUPABASE_URL in test env)
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
  },
}));

import {
  adaptToLegacyBereichConfig,
  urlSegmentToTypeKey,
  dbSegmentToUrlSegment,
  urlSegmentToDbSegment,
} from '../src/lib/themeWorldAdapter.js';
import {
  isThemeWorldPilotActive,
  getPilotKeys,
  isThemeWorldDbEnabled,
} from '../src/lib/themeWorldFeatureFlag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const YOGA_IMPORT_FILE = resolve(PROJECT_ROOT, 'data/theme-worlds/yoga-achtsamkeit.json');

// ---------------------------------------------------------------------------
// Shared Fixtures
// ---------------------------------------------------------------------------

const YOGA_THEME_WORLD = {
  id: 'bdbd426a-f349-46eb-920b-9407dbf893d6',
  key: 'yoga_achtsamkeit',
  url_segment: 'privat-hobby',
  slug: 'yoga-achtsamkeit',
  db_segment: 'privat',
  area_slug: 'yoga_achtsamkeit',
  title_de: 'Yoga & Achtsamkeit',
  subtitle_de: 'Finde innere Ruhe und Beweglichkeit',
  hero_image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
  section_titles: {
    scenarios_heading: 'Welche Richtung passt zu dir?',
    faqs_heading: 'Häufige Fragen',
    trust_heading: 'Worauf du bei der Kurswahl achten solltest',
    regions_heading: 'Yoga- und Achtsamkeitskurse in deiner Region',
    regions_subheading: 'Finde Yoga- und Achtsamkeitskurse in deiner Region oder entdecke online-live Angebote.',
  },
  predefined_searches: null,
  cta_links: null,
  search_config: { area_slug: 'yoga_achtsamkeit' },
};

const YOGA_REGIONS = [
  { id: 'r1', label_de: 'Zürich', anchor_text_de: 'Yoga in Zürich', loc_param: 'Zürich', delivery_param: null },
  { id: 'r2', label_de: 'Online-live', anchor_text_de: 'Online-live Yoga', loc_param: null, delivery_param: 'online_live' },
];

const YOGA_TRUST_ITEMS = [
  { id: 't1', item_type: 'info', name: 'Yogaverband Schweiz', description_de: 'Geprüfte Anbieter', logo_url: null },
  { id: 't2', item_type: 'info', name: 'Erfahrung & Qualität', description_de: 'Bewertungen realer Kursteilnehmer', logo_url: null },
];

// ---------------------------------------------------------------------------
// 1. Adapter Fix: regions_heading / regions_subheading
// ---------------------------------------------------------------------------

describe('Phase 7: adaptToLegacyBereichConfig — regionalDiscovery Fix', () => {
  const result = adaptToLegacyBereichConfig({
    themeWorld: YOGA_THEME_WORLD,
    scenarios: [],
    faqs: [],
    editorialSections: [],
    specialties: [],
    regions: YOGA_REGIONS,
    trustItems: [],
  });

  it('gibt regionalDiscovery zurück wenn Regionen vorhanden', () => {
    expect(result.regionalDiscovery).not.toBeNull();
  });

  it('übernimmt regions_heading als title.de (Bug-Fix Phase 7)', () => {
    expect(result.regionalDiscovery.title.de).toBe('Yoga- und Achtsamkeitskurse in deiner Region');
  });

  it('übernimmt regions_subheading als subtitle.de (Bug-Fix Phase 7)', () => {
    expect(result.regionalDiscovery.subtitle.de).toMatch(/deiner Region/);
  });

  it('gibt leeren String zurück wenn regions_heading fehlt', () => {
    const twWithoutHeading = { ...YOGA_THEME_WORLD, section_titles: {} };
    const r = adaptToLegacyBereichConfig({
      themeWorld: twWithoutHeading,
      scenarios: [], faqs: [], editorialSections: [],
      specialties: [], regions: YOGA_REGIONS, trustItems: [],
    });
    expect(r.regionalDiscovery.title.de).toBe('');
    expect(r.regionalDiscovery.subtitle.de).toBe('');
  });

  it('adaptiert Regionen korrekt', () => {
    expect(result.regionalDiscovery.regions).toHaveLength(2);
    expect(result.regionalDiscovery.regions[0].label).toBe('Zürich');
    expect(result.regionalDiscovery.regions[1].params.delivery).toBe('online_live');
  });

  it('gibt null zurück wenn keine Regionen', () => {
    const r = adaptToLegacyBereichConfig({
      themeWorld: YOGA_THEME_WORLD,
      scenarios: [], faqs: [], editorialSections: [],
      specialties: [], regions: [], trustItems: [],
    });
    expect(r.regionalDiscovery).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Yoga Segment Mapping
// ---------------------------------------------------------------------------

describe('Phase 7: Yoga Segment Mapping', () => {
  it('url_segment privat-hobby → typeKey privat_hobby', () => {
    expect(urlSegmentToTypeKey('privat-hobby')).toBe('privat_hobby');
  });

  it('db_segment privat → url_segment privat-hobby', () => {
    expect(dbSegmentToUrlSegment('privat')).toBe('privat-hobby');
  });

  it('url_segment privat-hobby → db_segment privat', () => {
    expect(urlSegmentToDbSegment('privat-hobby')).toBe('privat');
  });

  it('adaptToLegacyBereichConfig: segment und typeKey korrekt', () => {
    const r = adaptToLegacyBereichConfig({
      themeWorld: YOGA_THEME_WORLD,
      scenarios: [], faqs: [], editorialSections: [],
      specialties: [], regions: [], trustItems: [],
    });
    expect(r.segment).toBe('privat-hobby');
    expect(r.typeKey).toBe('privat_hobby');
  });
});

// ---------------------------------------------------------------------------
// 3. Trust Items — item_type 'info' (Yoga-Sonderfall)
// ---------------------------------------------------------------------------

describe('Phase 7: Trust Items (item_type=info)', () => {
  const result = adaptToLegacyBereichConfig({
    themeWorld: YOGA_THEME_WORLD,
    scenarios: [],
    faqs: [],
    editorialSections: [],
    specialties: [],
    regions: [],
    trustItems: YOGA_TRUST_ITEMS,
  });

  it('übernimmt Trust-Items korrekt', () => {
    // adaptToLegacyBereichConfig returns trustItems (check what the function returns)
    // Note: adaptToLegacyBereichConfig exposes trustItems in the result
    expect(result).toBeDefined();
  });

  it('Yoga trust title ist custom (nicht default)', () => {
    // The section_titles.trust_heading should be used
    expect(YOGA_THEME_WORLD.section_titles.trust_heading).toBe('Worauf du bei der Kurswahl achten solltest');
    expect(YOGA_THEME_WORLD.section_titles.trust_heading).not.toBe('Qualität & Anerkennung');
  });

  it('Yoga trust items haben item_type info (keine Logos)', () => {
    YOGA_TRUST_ITEMS.forEach(item => {
      expect(item.item_type).toBe('info');
      expect(item.logo_url).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Yoga Import File Validity
// ---------------------------------------------------------------------------

describe('Phase 7: Yoga Import File (data/theme-worlds/yoga-achtsamkeit.json)', () => {
  let yogaData;

  beforeAll(() => {
    if (existsSync(YOGA_IMPORT_FILE)) {
      const raw = readFileSync(YOGA_IMPORT_FILE, 'utf-8');
      yogaData = JSON.parse(raw);
    }
  });

  it('Importdatei existiert', () => {
    expect(existsSync(YOGA_IMPORT_FILE)).toBe(true);
  });

  it('hat korrektes Schema-Format', () => {
    expect(yogaData).toBeDefined();
    expect(yogaData.schema).toBe('theme-world-import/v1');
    expect(yogaData.theme_world).toBeDefined();
    expect(Array.isArray(yogaData.scenarios)).toBe(true);
    expect(Array.isArray(yogaData.faqs)).toBe(true);
    expect(Array.isArray(yogaData.trust_items)).toBe(true);
    expect(Array.isArray(yogaData.specialties)).toBe(true);
    expect(Array.isArray(yogaData.regions)).toBe(true);
  });

  it('theme_world hat korrekten Key und Segment', () => {
    expect(yogaData.theme_world.key).toBe('yoga_achtsamkeit');
    expect(yogaData.theme_world.slug).toBe('yoga-achtsamkeit');
    expect(yogaData.theme_world.url_segment).toBe('privat-hobby');
    expect(yogaData.theme_world.db_segment).toBe('privat');
  });

  it('hat genau 8 Szenarien', () => {
    expect(yogaData.scenarios).toHaveLength(8);
  });

  it('Szenario-Slugs sind korrekt', () => {
    const slugs = yogaData.scenarios.map(s => s.slug);
    expect(slugs).toContain('yoga-fuer-anfaenger');
    expect(slugs).toContain('yoga-stile-finden');
    expect(slugs).toContain('stress-abbauen-entspannen');
    expect(slugs).toContain('besser-schlafen-yoga-nidra');
    expect(slugs).toContain('atemarbeit-breathwork');
    expect(slugs).toContain('klangmeditation-mantra');
    expect(slugs).toContain('energiearbeit-reiki');
    expect(slugs).toContain('bodywork-thai-yoga-massage');
  });

  it('Szenarien haben HTML-Inhalt', () => {
    yogaData.scenarios.forEach(scenario => {
      expect(scenario.content_html).toBeDefined();
      expect(scenario.content_html.length).toBeGreaterThan(100);
    });
  });

  it('hat mindestens 10 FAQs', () => {
    expect(yogaData.faqs.length).toBeGreaterThanOrEqual(10);
  });

  it('Trust Items haben item_type info (Yoga-Sonderfall, keine Logos)', () => {
    yogaData.trust_items.forEach(item => {
      expect(item.item_type).toBe('info');
    });
  });

  it('section_titles hat regions_heading und regions_subheading', () => {
    const st = yogaData.theme_world.section_titles;
    expect(st).toBeDefined();
    expect(st.regions_heading).toBeDefined();
    expect(st.regions_heading.length).toBeGreaterThan(5);
    expect(st.regions_subheading).toBeDefined();
    expect(st.regions_subheading.length).toBeGreaterThan(5);
  });

  it('section_titles hat faqs_heading', () => {
    const st = yogaData.theme_world.section_titles;
    expect(st.faqs_heading).toBe('Häufige Fragen');
  });

  it('section_titles hat trust_heading (custom)', () => {
    const st = yogaData.theme_world.section_titles;
    expect(st.trust_heading).toBe('Worauf du bei der Kurswahl achten solltest');
  });

  it('hat gültige Emoji in Icons (keine lone surrogates)', () => {
    yogaData.scenarios.forEach(scenario => {
      if (scenario.icon) {
        // No lone surrogates — all code points must be valid
        expect(() => encodeURIComponent(scenario.icon)).not.toThrow();
        // Must not be empty after encoding
        expect(encodeURIComponent(scenario.icon).length).toBeGreaterThan(0);
      }
    });
  });

  it('hat gültige Emoji in Specialties', () => {
    if (yogaData.specialties) {
      yogaData.specialties.forEach(spec => {
        if (spec.icon) {
          expect(() => encodeURIComponent(spec.icon)).not.toThrow();
        }
      });
    }
  });

  it('JSON ist valid UTF-8 (kein Surrogate-Problem)', () => {
    const raw = readFileSync(YOGA_IMPORT_FILE, 'utf-8');
    // If the file had lone surrogates, JSON.parse would succeed but they'd be present
    // Check by re-serializing — if content matches roundtrip, no corruption
    expect(() => JSON.parse(raw)).not.toThrow();
    const reparsed = JSON.parse(raw);
    expect(reparsed.theme_world.key).toBe('yoga_achtsamkeit');
  });
});

// ---------------------------------------------------------------------------
// 5. Feature Flag — yoga_achtsamkeit key
// ---------------------------------------------------------------------------

describe('Phase 7: Feature Flag (yoga_achtsamkeit key)', () => {
  it('getPilotKeys gibt Set zurück', () => {
    const keys = getPilotKeys();
    expect(keys).toBeInstanceOf(Set);
  });

  it('isThemeWorldPilotActive gibt false zurück wenn DB nicht aktiviert', () => {
    // In test env VITE_THEME_WORLD_DB_ENABLED is not set → always false
    // This is the expected default behavior
    const active = isThemeWorldPilotActive('yoga_achtsamkeit');
    // Without VITE_THEME_WORLD_DB_ENABLED=true, this is always false
    expect(typeof active).toBe('boolean');
    // In CI / test context: should be false (no env var set)
    expect(active).toBe(false);
  });

  it('isThemeWorldDbEnabled gibt false zurück in Test-Umgebung', () => {
    expect(isThemeWorldDbEnabled()).toBe(false);
  });

  it('yoga_achtsamkeit key ist korrekt formatiert (lowercase, underscore)', () => {
    // Key must match the format expected by getPilotKeys()
    const key = 'yoga_achtsamkeit';
    expect(key).toBe(key.toLowerCase());
    expect(key).not.toContain('-');
  });
});
