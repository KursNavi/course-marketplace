/**
 * Phase 5 Tests: Import-Daten für Sport & Fitness Pilot
 *
 * Prüft:
 * - Importdatei erfüllt Schema
 * - Genau eine Themenwelt
 * - Genau 8 Szenarioartikel
 * - 9 korrekte Pilot-URLs
 * - Richtige Anzahl FAQs, Specialties, Regionen, Trust Items
 * - Alle Pflichtbilder
 * - Alle Pflicht-Alt-Texte
 * - Alle SEO-Pflichtfelder
 * - Kein Secret in der Importdatei
 * - Doppelte kanonische Pfade werden erkannt
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

describe('Sport & Fitness Importdatei — Grundstruktur', () => {
  it('Datei existiert', () => {
    expect(existsSync(IMPORT_FILE)).toBe(true);
  });

  it('Gültiges JSON mit schema-Feld', () => {
    expect(importData).toBeDefined();
    expect(importData.schema).toMatch(/^theme-world-import\//);
  });

  it('Genau eine Themenwelt', () => {
    expect(importData.theme_world).toBeDefined();
    expect(typeof importData.theme_world).toBe('object');
  });

  it('Genau 8 Szenarioartikel', () => {
    expect(Array.isArray(importData.scenarios)).toBe(true);
    expect(importData.scenarios).toHaveLength(8);
  });

  it('Richtige Szenario-Slugs in korrekter Reihenfolge', () => {
    const expectedSlugs = [
      'berufseinstieg',
      'quereinstieg',
      'weiterbildung',
      'diplom-aufstieg',
      'nebenerwerb',
      'selbststaendigkeit',
      'spezialisierung',
      'zertifizierung',
    ];
    const actualSlugs = importData.scenarios.map((s) => s.slug);
    expect(actualSlugs).toEqual(expectedSlugs);
  });

  it('7 FAQs', () => {
    expect(Array.isArray(importData.faqs)).toBe(true);
    expect(importData.faqs).toHaveLength(7);
  });

  it('6 Editorial Sections', () => {
    expect(Array.isArray(importData.editorial_sections)).toBe(true);
    expect(importData.editorial_sections).toHaveLength(6);
  });

  it('8 Specialties', () => {
    expect(Array.isArray(importData.specialties)).toBe(true);
    expect(importData.specialties).toHaveLength(8);
  });

  it('8 Regionen', () => {
    expect(Array.isArray(importData.regions)).toBe(true);
    expect(importData.regions).toHaveLength(8);
  });

  it('3 Trust Items', () => {
    expect(Array.isArray(importData.trust_items)).toBe(true);
    expect(importData.trust_items).toHaveLength(3);
  });
});

describe('Sport & Fitness Importdatei — Themenwelt-Pflichtfelder', () => {
  it('key ist sport_fitness_beruf', () => {
    expect(importData.theme_world.key).toBe('sport_fitness_beruf');
  });

  it('slug ist sport-fitness-berufsausbildung', () => {
    expect(importData.theme_world.slug).toBe('sport-fitness-berufsausbildung');
  });

  it('url_segment ist beruflich', () => {
    expect(importData.theme_world.url_segment).toBe('beruflich');
  });

  it('db_segment ist professionell', () => {
    expect(importData.theme_world.db_segment).toBe('professionell');
  });

  it('title_de ist vorhanden', () => {
    expect(importData.theme_world.title_de).toBeTruthy();
  });

  it('meta_title ist vorhanden', () => {
    expect(importData.theme_world.meta_title).toBeTruthy();
  });

  it('meta_description ist vorhanden', () => {
    expect(importData.theme_world.meta_description).toBeTruthy();
  });

  it('hero_image_url ist vorhanden', () => {
    expect(importData.theme_world.hero_image_url).toBeTruthy();
    expect(importData.theme_world.hero_image_url).toMatch(/^https?:\/\//);
  });

  it('hero_image_alt_de ist vorhanden', () => {
    expect(importData.theme_world.hero_image_alt_de).toBeTruthy();
  });

  it('predefined_searches enthält mindestens 1 Eintrag', () => {
    expect(Array.isArray(importData.theme_world.predefined_searches)).toBe(true);
    expect(importData.theme_world.predefined_searches.length).toBeGreaterThan(0);
  });

  it('section_titles vorhanden', () => {
    expect(importData.theme_world.section_titles).toBeDefined();
  });
});

describe('Sport & Fitness Importdatei — Szenario-Pflichtfelder', () => {
  it('Jedes Szenario hat slug, label_de, content_html', () => {
    for (const s of importData.scenarios) {
      expect(s.slug).toBeTruthy();
      expect(s.label_de).toBeTruthy();
      expect(s.content_html).toBeTruthy();
    }
  });

  it('Jedes Szenario hat meta_title', () => {
    for (const s of importData.scenarios) {
      expect(s.meta_title).toBeTruthy();
    }
  });

  it('Jedes Szenario hat meta_description', () => {
    for (const s of importData.scenarios) {
      expect(s.meta_description).toBeTruthy();
    }
  });

  it('Keine doppelten Slugs', () => {
    const slugs = importData.scenarios.map((s) => s.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('HTML-Inhalt aller Szenarien ist substanziell (>1000 Zeichen)', () => {
    for (const s of importData.scenarios) {
      expect(s.content_html.length).toBeGreaterThan(1000);
    }
  });

  it('HTML-Inhalt enthält keine script-Tags', () => {
    for (const s of importData.scenarios) {
      expect(s.content_html.toLowerCase()).not.toContain('<script');
    }
  });
});

describe('Sport & Fitness Importdatei — 9 Pilot-URLs', () => {
  const BASE = '/bereich/beruflich/sport-fitness-berufsausbildung';

  it('Landingpage-URL ist korrekt', () => {
    const tw = importData.theme_world;
    const url = `/bereich/${tw.url_segment}/${tw.slug}`;
    expect(url).toBe(BASE);
  });

  it('Alle 8 Szenario-URLs sind korrekt', () => {
    const expectedSlugs = [
      'berufseinstieg', 'quereinstieg', 'weiterbildung', 'diplom-aufstieg',
      'nebenerwerb', 'selbststaendigkeit', 'spezialisierung', 'zertifizierung',
    ];
    const actualSlugs = importData.scenarios.map((s) => s.slug);
    expect(actualSlugs).toEqual(expectedSlugs);

    for (const slug of actualSlugs) {
      const url = `${BASE}/${slug}`;
      expect(url).toMatch(/^\/bereich\/beruflich\/sport-fitness-berufsausbildung\//);
    }
  });

  it('Keine doppelten kanonischen Pfade', () => {
    const paths = new Set();
    const tw = importData.theme_world;
    const base = `/bereich/${tw.url_segment}/${tw.slug}`;
    paths.add(base);
    for (const s of importData.scenarios) {
      const p = `${base}/${s.slug}`;
      expect(paths.has(p)).toBe(false);
      paths.add(p);
    }
    expect(paths.size).toBe(9);
  });
});

describe('Sport & Fitness Importdatei — Keine Secrets', () => {
  const RAW_CONTENT = readFileSync(IMPORT_FILE, 'utf-8');

  it('Enthält keine Supabase-Service-Role-Keys', () => {
    // Service-role-keys sind typischerweise sehr lange JWT-Tokens
    expect(RAW_CONTENT).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.\S{300,}/);
  });

  it('Enthält keine SUPABASE_URL mit supabase.co', () => {
    // Echte Supabase-URLs nicht im Importdatei
    expect(RAW_CONTENT).not.toMatch(/https:\/\/[a-z]{20}\.supabase\.co/);
  });

  it('Enthält keine Stripe-Keys', () => {
    expect(RAW_CONTENT).not.toMatch(/sk_live_\w+/);
    expect(RAW_CONTENT).not.toMatch(/sk_test_\w+/);
  });
});

describe('Sport & Fitness Importdatei — FAQ Pflichtfelder', () => {
  it('Jedes FAQ hat question_de und answer_de', () => {
    for (const f of importData.faqs) {
      expect(f.question_de).toBeTruthy();
      expect(f.answer_de).toBeTruthy();
    }
  });
});

describe('Sport & Fitness Importdatei — Specialty Pflichtfelder', () => {
  it('Jede Specialty hat specialty_label', () => {
    for (const s of importData.specialties) {
      expect(s.specialty_label).toBeTruthy();
    }
  });

  it('Keine doppelten Specialty-Labels', () => {
    const labels = importData.specialties.map((s) => s.specialty_label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

describe('Sport & Fitness Importdatei — Regionen', () => {
  it('Jede Region hat label_de', () => {
    for (const r of importData.regions) {
      expect(r.label_de).toBeTruthy();
    }
  });

  it('Mindestens eine Region mit Ort-Parameter', () => {
    const withLoc = importData.regions.filter((r) => r.loc_param);
    expect(withLoc.length).toBeGreaterThan(0);
  });
});
