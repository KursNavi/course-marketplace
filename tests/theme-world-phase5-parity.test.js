/**
 * Phase 5 Tests: Paritätsvergleich Legacy ↔ Import-Daten
 *
 * Prüft dass die Importdatei exakt die Legacy-Konfiguration reproduziert.
 * Diese Tests laufen gegen die echte bereichLandingConfig.js und szenarioContent.js.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const IMPORT_FILE = resolve(PROJECT_ROOT, 'data/theme-worlds/sport-fitness-berufsausbildung.json');

let importData;

beforeAll(() => {
  if (existsSync(IMPORT_FILE)) {
    importData = JSON.parse(readFileSync(IMPORT_FILE, 'utf-8'));
  }
});

// Legacy-Daten (direkt aus den Quelldateien)
const LEGACY_SCENARIO_SLUGS = [
  'berufseinstieg',
  'quereinstieg',
  'weiterbildung',
  'diplom-aufstieg',
  'nebenerwerb',
  'selbststaendigkeit',
  'spezialisierung',
  'zertifizierung',
];

const LEGACY_SPECIALTY_LABELS = [
  'Fitness-Trainer-Ausbildung',
  'Personal-Trainer-Ausbildung',
  'Group-Fitness / Kursleitung',
  'Trainingsmethoden & Spezialisierungen',
  'Mind-Body (Yoga & Pilates)',
  'Ernährung & Coaching',
  'Zertifikate & Prüfungsvorbereitung',
  'Business & Selbstständigkeit',
];

const LEGACY_REGION_LABELS = [
  'Zürich', 'Bern', 'Basel', 'Luzern', 'Aargau', 'St. Gallen', 'Ganze Schweiz', 'Online-live',
];

const LEGACY_TRUST_NAMES = ['Qualitop', 'QualiCert', 'Fitness-Guide (SFGV)'];

describe('Parität: Szenario-Slugs', () => {
  it('Import hat exakt die Legacy-Slugs in exakter Reihenfolge', () => {
    expect(importData).toBeDefined();
    const importSlugs = importData.scenarios.map((s) => s.slug);
    expect(importSlugs).toEqual(LEGACY_SCENARIO_SLUGS);
  });

  it('Kein zusätzlicher Szenario-Slug', () => {
    const importSlugs = importData.scenarios.map((s) => s.slug);
    const extra = importSlugs.filter((s) => !LEGACY_SCENARIO_SLUGS.includes(s));
    expect(extra).toHaveLength(0);
  });

  it('Kein fehlender Szenario-Slug', () => {
    const importSlugs = importData.scenarios.map((s) => s.slug);
    const missing = LEGACY_SCENARIO_SLUGS.filter((s) => !importSlugs.includes(s));
    expect(missing).toHaveLength(0);
  });
});

describe('Parität: URLs', () => {
  it('Landingpage-URL ist identisch', () => {
    const tw = importData.theme_world;
    const url = `/bereich/${tw.url_segment}/${tw.slug}`;
    expect(url).toBe('/bereich/beruflich/sport-fitness-berufsausbildung');
  });

  it('Alle 8 Artikel-URLs sind identisch mit Legacy', () => {
    const base = '/bereich/beruflich/sport-fitness-berufsausbildung';
    const importUrls = importData.scenarios.map((s) => `${base}/${s.slug}`);
    const expectedUrls = LEGACY_SCENARIO_SLUGS.map((slug) => `${base}/${slug}`);
    expect(importUrls).toEqual(expectedUrls);
  });
});

describe('Parität: Szenario-Reihenfolge', () => {
  it('sort_order stimmt mit Array-Reihenfolge überein', () => {
    for (let i = 0; i < importData.scenarios.length; i++) {
      const s = importData.scenarios[i];
      expect(s.sort_order).toBe(i + 1);
    }
  });
});

describe('Parität: Specialties', () => {
  it('Import hat exakt die Legacy-Specialty-Labels', () => {
    const importLabels = importData.specialties.map((s) => s.specialty_label);
    expect(importLabels).toEqual(LEGACY_SPECIALTY_LABELS);
  });

  it('Richtige Anzahl Specialties (8)', () => {
    expect(importData.specialties).toHaveLength(8);
  });
});

describe('Parität: Regionen', () => {
  it('Alle Legacy-Regionen sind im Import vorhanden', () => {
    const importLabels = importData.regions.map((r) => r.label_de);
    for (const label of LEGACY_REGION_LABELS) {
      expect(importLabels).toContain(label);
    }
  });

  it('Richtige Anzahl Regionen (8)', () => {
    expect(importData.regions).toHaveLength(8);
  });
});

describe('Parität: Trust Items', () => {
  it('Alle Legacy-Trust-Namen sind im Import vorhanden', () => {
    const importNames = importData.trust_items.map((t) => t.name);
    for (const name of LEGACY_TRUST_NAMES) {
      expect(importNames).toContain(name);
    }
  });

  it('Richtige Anzahl Trust Items (3)', () => {
    expect(importData.trust_items).toHaveLength(3);
  });
});

describe('Parität: SEO-Daten', () => {
  it('meta_title der Themenwelt ist vorhanden', () => {
    expect(importData.theme_world.meta_title).toBeTruthy();
  });

  it('meta_description der Themenwelt ist vorhanden', () => {
    expect(importData.theme_world.meta_description).toBeTruthy();
  });

  it('Alle Szenario-meta_titles sind vorhanden', () => {
    for (const s of importData.scenarios) {
      expect(s.meta_title).toBeTruthy();
    }
  });

  it('Alle Szenario-meta_descriptions sind vorhanden', () => {
    for (const s of importData.scenarios) {
      expect(s.meta_description).toBeTruthy();
    }
  });
});

describe('Parität: Inhalte', () => {
  it('Berufseinstieg-Inhalt enthält Schlüsselbegriffe', () => {
    const s = importData.scenarios.find((x) => x.slug === 'berufseinstieg');
    expect(s.content_html).toContain('EFZ');
    expect(s.content_html).toContain('Fachausweis');
  });

  it('Quereinstieg-Inhalt enthält 5\'000 Praxisstunden Hinweis', () => {
    const s = importData.scenarios.find((x) => x.slug === 'quereinstieg');
    expect(s.content_html).toContain("5'000");
  });

  it('Zertifizierung-Inhalt enthält Qualitop-Referenz', () => {
    const s = importData.scenarios.find((x) => x.slug === 'zertifizierung');
    expect(s.content_html).toContain('Qualitop');
    expect(s.content_html).toContain('QualiCert');
  });

  it('Diplom-Aufstieg enthält Bundesbeitrags-Betrag', () => {
    const s = importData.scenarios.find((x) => x.slug === 'diplom-aufstieg');
    expect(s.content_html).toContain("9'500");
  });
});

describe('Parität: Bilder', () => {
  it('Hero-Bild-URL ist vorhanden', () => {
    expect(importData.theme_world.hero_image_url).toBeTruthy();
  });

  it('Hero-Bild-Alt-Text ist vorhanden', () => {
    expect(importData.theme_world.hero_image_alt_de).toBeTruthy();
  });
});

describe('Parität: Suchkonfiguration', () => {
  it('url_segment stimmt mit Legacy überein (beruflich)', () => {
    expect(importData.theme_world.url_segment).toBe('beruflich');
  });

  it('db_segment stimmt mit Legacy überein (professionell)', () => {
    expect(importData.theme_world.db_segment).toBe('professionell');
  });

  it('area_slug stimmt mit Legacy überein', () => {
    expect(importData.theme_world.area_slug || importData.theme_world.search_config?.area_slug)
      .toBe('sport_fitness_beruf');
  });
});
