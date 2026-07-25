/**
 * Phase 8.5 — Optionaler Bildupload für Themenwelten
 *
 * Stellt sicher, dass:
 *  1. Das Hero-Bild optional ist — Speichern funktioniert ohne hochgeladenes Bild
 *  2. Bei fehlendem Bild das Segment-Fallback-Bild im Adapter zurückgegeben wird
 *  3. Der Fallback für alle drei Segmente korrekt gemappt ist
 *  4. Kein Fallback zurückgegeben wird wenn ein echtes Bild gesetzt ist
 */

import { describe, it, expect } from 'vitest';
import {
  SEGMENT_FALLBACK_HERO_IMAGES,
  adaptToLegacyBereichConfig,
  adaptThemeWorldToConfig,
} from '../src/lib/themeWorldAdapter';

// ---------------------------------------------------------------------------
// SEGMENT_FALLBACK_HERO_IMAGES
// ---------------------------------------------------------------------------

describe('SEGMENT_FALLBACK_HERO_IMAGES', () => {
  it('enthält einen Eintrag für jedes Segment', () => {
    expect(SEGMENT_FALLBACK_HERO_IMAGES).toHaveProperty('beruflich');
    expect(SEGMENT_FALLBACK_HERO_IMAGES).toHaveProperty('privat-hobby');
    expect(SEGMENT_FALLBACK_HERO_IMAGES).toHaveProperty('kinder-jugend');
  });

  it('alle Einträge sind https:// URLs', () => {
    for (const url of Object.values(SEGMENT_FALLBACK_HERO_IMAGES)) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

// ---------------------------------------------------------------------------
// adaptToLegacyBereichConfig — Fallback-Bild Logik
// ---------------------------------------------------------------------------

const makeThemeWorld = (overrides = {}) => ({
  id: 'tw-1',
  key: 'test_key',
  title_de: 'Testtitel',
  subtitle_de: null,
  intro_de: null,
  url_segment: 'beruflich',
  db_segment: 'professionell',
  slug: 'test-slug',
  status: 'draft',
  published_at: null,
  hero_image_url: null,
  hero_image_alt_de: null,
  og_image_url: null,
  og_image_alt_de: null,
  meta_title: null,
  meta_description: null,
  area_slug: 'test_area',
  search_config: {},
  section_titles: {},
  ...overrides,
});

describe('adaptToLegacyBereichConfig — Hero-Bild Fallback', () => {
  it('gibt Fallback-Bild zurück wenn hero_image_url null ist', () => {
    const result = adaptToLegacyBereichConfig({
      themeWorld: makeThemeWorld({ hero_image_url: null, url_segment: 'beruflich' }),
    });
    expect(result.heroImage).toBe(SEGMENT_FALLBACK_HERO_IMAGES['beruflich']);
  });

  it('gibt Fallback-Bild für privat-hobby zurück', () => {
    const result = adaptToLegacyBereichConfig({
      themeWorld: makeThemeWorld({ url_segment: 'privat-hobby', db_segment: 'privat', hero_image_url: null }),
    });
    expect(result.heroImage).toBe(SEGMENT_FALLBACK_HERO_IMAGES['privat-hobby']);
  });

  it('gibt Fallback-Bild für kinder-jugend zurück', () => {
    const result = adaptToLegacyBereichConfig({
      themeWorld: makeThemeWorld({ url_segment: 'kinder-jugend', db_segment: 'kinder', hero_image_url: null }),
    });
    expect(result.heroImage).toBe(SEGMENT_FALLBACK_HERO_IMAGES['kinder-jugend']);
  });

  it('gibt echtes Bild zurück wenn hero_image_url gesetzt ist', () => {
    const customUrl = 'https://example.com/mein-bild.jpg';
    const result = adaptToLegacyBereichConfig({
      themeWorld: makeThemeWorld({ hero_image_url: customUrl }),
    });
    expect(result.heroImage).toBe(customUrl);
  });

  it('überschreibt Fallback NICHT mit echtem Bild wenn Bild gesetzt ist', () => {
    const customUrl = 'https://example.com/mein-bild.jpg';
    const result = adaptToLegacyBereichConfig({
      themeWorld: makeThemeWorld({ hero_image_url: customUrl }),
    });
    expect(result.heroImage).not.toBe(SEGMENT_FALLBACK_HERO_IMAGES['beruflich']);
  });
});

// ---------------------------------------------------------------------------
// adaptThemeWorldToConfig — heroImageUrl Fallback
// ---------------------------------------------------------------------------

describe('adaptThemeWorldToConfig — heroImageUrl Fallback', () => {
  it('gibt Fallback-URL zurück wenn kein Custom-Bild gesetzt ist', () => {
    const result = adaptThemeWorldToConfig({
      themeWorld: makeThemeWorld({ hero_image_url: null, url_segment: 'beruflich' }),
    });
    expect(result.heroImageUrl).toBe(SEGMENT_FALLBACK_HERO_IMAGES['beruflich']);
  });

  it('gibt echte URL zurück wenn Custom-Bild gesetzt ist', () => {
    const customUrl = 'https://example.com/hero.jpg';
    const result = adaptThemeWorldToConfig({
      themeWorld: makeThemeWorld({ hero_image_url: customUrl }),
    });
    expect(result.heroImageUrl).toBe(customUrl);
  });
});
