/**
 * Unit-Tests für die Theme-World-Validierungsschemas.
 * Diese Tests laufen rein in-process ohne Netzwerk- oder DB-Zugriff.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSlug,
  isValidExternalUrl,
  isValidImageUrl,
  validateSearchConfig,
  validateSectionTitles,
  validatePredefinedSearches,
  validateCtaLinks,
  validateCtaConfig,
  validateThemeWorldBase,
  validateScenario,
  validateFaq,
  validateEditorialSection,
  validateSpecialty,
  validateRegion,
  validateTrustItem,
  validateSortReorder,
  validatePublishThemeWorld,
  validatePublishScenario,
  VALID_DB_SEGMENTS,
  VALID_URL_SEGMENTS,
} from '../api/_lib/theme-world-validate.js';

// ============================================================
// Hilfsfunktionen
// ============================================================

function validThemeWorldBase() {
  return {
    key: 'sport_fitness_beruf',
    url_segment: 'beruflich',
    slug: 'sport-fitness-berufsausbildung',
    db_segment: 'professionell',
    area_slug: 'sport_fitness_beruf',
    title_de: 'Sport & Fitness Berufsausbildung',
    subtitle_de: 'Alles über Berufsausbildungen im Bereich Sport und Fitness.',
    search_config: { area_slug: 'sport_fitness_beruf' },
  };
}

function validScenario() {
  return {
    slug: 'berufseinstieg',
    label_de: 'Berufseinstieg',
    teaser_de: 'So startest du in die Fitnessbranche.',
    content_html: '<p>Artikel-Inhalt hier.</p>',
  };
}

function validPublishedThemeWorld() {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    title_de: 'Sport & Fitness Berufsausbildung',
    url_segment: 'beruflich',
    slug: 'sport-fitness-berufsausbildung',
    db_segment: 'professionell',
    subtitle_de: 'Lead-Text.',
    search_config: { area_slug: 'sport_fitness_beruf' },
    status: 'published',
  };
}

// ============================================================
// isValidSlug
// ============================================================

describe('isValidSlug', () => {
  it('akzeptiert gültige Slugs', () => {
    expect(isValidSlug('berufseinstieg')).toBe(true);
    expect(isValidSlug('sport-fitness-beruf')).toBe(true);
    expect(isValidSlug('yoga123')).toBe(true);
    expect(isValidSlug('a')).toBe(true);
  });

  it('lehnt ungültige Slugs ab', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('-anfang')).toBe(false);
    expect(isValidSlug('ende-')).toBe(false);
    expect(isValidSlug('Gross')).toBe(false);
    expect(isValidSlug('mit leerzeichen')).toBe(false);
    expect(isValidSlug('mit_unterstrich')).toBe(false);
    expect(isValidSlug(null)).toBe(false);
    expect(isValidSlug(undefined)).toBe(false);
    expect(isValidSlug(42)).toBe(false);
  });
});

// ============================================================
// isValidExternalUrl
// ============================================================

describe('isValidExternalUrl', () => {
  it('akzeptiert https-URLs', () => {
    expect(isValidExternalUrl('https://example.com')).toBe(true);
    expect(isValidExternalUrl('https://kursnavi.ch/path?q=1')).toBe(true);
  });

  it('lehnt unsichere Protokolle ab', () => {
    expect(isValidExternalUrl('http://example.com')).toBe(false);
    expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isValidExternalUrl('data:text/html,<h1>XSS</h1>')).toBe(false);
    expect(isValidExternalUrl('/relative/pfad')).toBe(false);
    expect(isValidExternalUrl('')).toBe(false);
    expect(isValidExternalUrl(null)).toBe(false);
  });
});

// ============================================================
// validateSearchConfig
// ============================================================

describe('validateSearchConfig', () => {
  it('akzeptiert null (optional)', () => {
    expect(validateSearchConfig(null)).toEqual([]);
  });

  it('akzeptiert gültige search_config', () => {
    expect(validateSearchConfig({ area_slug: 'sport_fitness_beruf' })).toEqual([]);
    expect(validateSearchConfig({
      area_slug: 'sport_fitness_beruf',
      type_key: 'beruflich',
      default_spec: 'Fitness-Trainer',
    })).toEqual([]);
  });

  it('lehnt fehlenden area_slug ab', () => {
    const errors = validateSearchConfig({ type_key: 'beruflich' });
    expect(errors.some(e => e.includes('area_slug'))).toBe(true);
  });

  it('lehnt unbekannte Keys ab', () => {
    const errors = validateSearchConfig({ area_slug: 'test', unknown_key: 'wert' });
    expect(errors.some(e => e.includes('unknown_key'))).toBe(true);
  });

  it('lehnt ungültigen type_key ab', () => {
    const errors = validateSearchConfig({ area_slug: 'test', type_key: 'invalid' });
    expect(errors.some(e => e.includes('type_key'))).toBe(true);
  });

  it('lehnt Nicht-Objekt ab', () => {
    expect(validateSearchConfig('string')).toEqual(
      expect.arrayContaining([expect.stringContaining('Muss ein Objekt sein')])
    );
    expect(validateSearchConfig([1, 2, 3])).toEqual(
      expect.arrayContaining([expect.stringContaining('Muss ein Objekt sein')])
    );
  });
});

// ============================================================
// validateSectionTitles
// ============================================================

describe('validateSectionTitles', () => {
  it('akzeptiert null', () => {
    expect(validateSectionTitles(null)).toEqual([]);
  });

  it('akzeptiert gültige section_titles', () => {
    expect(validateSectionTitles({
      faqTitle: { de: 'Häufige Fragen', en: 'FAQ' },
      ctaButton: { de: 'Jetzt suchen' },
    })).toEqual([]);
  });

  it('lehnt unbekannte Keys ab', () => {
    const errors = validateSectionTitles({ unknownSection: { de: 'Test' } });
    expect(errors.some(e => e.includes('unknownSection'))).toBe(true);
  });

  it('lehnt unbekannte Sprachen ab', () => {
    const errors = validateSectionTitles({ faqTitle: { de: 'OK', xx: 'Ungültig' } });
    expect(errors.some(e => e.includes('.xx'))).toBe(true);
  });

  it('lehnt zu langen Text ab', () => {
    const errors = validateSectionTitles({ faqTitle: { de: 'x'.repeat(201) } });
    expect(errors.some(e => e.includes('Zu lang'))).toBe(true);
  });
});

// ============================================================
// validatePredefinedSearches
// ============================================================

describe('validatePredefinedSearches', () => {
  it('akzeptiert null', () => {
    expect(validatePredefinedSearches(null)).toEqual([]);
  });

  it('akzeptiert gültige Suchliste', () => {
    expect(validatePredefinedSearches([
      { label_de: 'Fitness Trainer Zürich', loc: 'Zürich', delivery: 'in_person' },
      { label_de: 'Online Yoga' },
    ])).toEqual([]);
  });

  it('lehnt fehlenden label_de ab', () => {
    const errors = validatePredefinedSearches([{ loc: 'Zürich' }]);
    expect(errors.some(e => e.includes('label_de'))).toBe(true);
  });

  it('lehnt ungültigen delivery-Wert ab', () => {
    const errors = validatePredefinedSearches([{ label_de: 'Test', delivery: 'at_home' }]);
    expect(errors.some(e => e.includes('delivery'))).toBe(true);
  });

  it('lehnt mehr als 20 Einträge ab', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ label_de: `Item ${i}` }));
    const errors = validatePredefinedSearches(items);
    expect(errors.some(e => e.includes('Maximal 20'))).toBe(true);
  });

  it('lehnt unbekannte Keys ab', () => {
    const errors = validatePredefinedSearches([{ label_de: 'Test', hidden_field: 'wert' }]);
    expect(errors.some(e => e.includes('hidden_field'))).toBe(true);
  });
});

// ============================================================
// validateCtaLinks
// ============================================================

describe('validateCtaLinks', () => {
  it('akzeptiert gültige cta_links', () => {
    expect(validateCtaLinks([
      { label_de: 'Alle Kurse' },
      { label_de: 'Zürich', loc: 'Zürich', delivery: 'in_person' },
    ])).toEqual([]);
  });

  it('lehnt mehr als 5 Einträge ab', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ label_de: `Link ${i}` }));
    const errors = validateCtaLinks(items);
    expect(errors.some(e => e.includes('Maximal 5'))).toBe(true);
  });

  it('lehnt unbekannte Keys ab', () => {
    const errors = validateCtaLinks([{ label_de: 'Test', url: 'https://example.com' }]);
    expect(errors.some(e => e.includes('url'))).toBe(true);
  });
});

// ============================================================
// validateThemeWorldBase
// ============================================================

describe('validateThemeWorldBase', () => {
  it('akzeptiert gültige Themenwelt', () => {
    const result = validateThemeWorldBase(validThemeWorldBase());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('lehnt fehlendes title_de ab', () => {
    const data = { ...validThemeWorldBase(), title_de: '' };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('title_de'))).toBe(true);
  });

  it('lehnt ungültiges Segment ab', () => {
    const data = { ...validThemeWorldBase(), db_segment: 'ungültig' };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('db_segment'))).toBe(true);
  });

  it('lehnt ungültigen Slug ab', () => {
    const data = { ...validThemeWorldBase(), slug: 'mit leerzeichen' };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('slug'))).toBe(true);
  });

  it('lehnt inkonsistentes Segment-Paar ab', () => {
    const data = { ...validThemeWorldBase(), db_segment: 'privat', url_segment: 'beruflich' };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Inkonsistentes'))).toBe(true);
  });

  it('lehnt hero_image_url ohne Alt-Text ab', () => {
    const data = { ...validThemeWorldBase(), hero_image_url: 'https://example.com/hero.jpg' };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('hero_image_alt_de'))).toBe(true);
  });

  it('akzeptiert hero_image_url mit Alt-Text', () => {
    const data = {
      ...validThemeWorldBase(),
      hero_image_url: 'https://example.com/hero.jpg',
      hero_image_alt_de: 'Sportler beim Training',
    };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(true);
  });

  it('lehnt ungültige og_image_url ab', () => {
    const data = { ...validThemeWorldBase(), og_image_url: 'javascript:alert(1)' };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('og_image_url'))).toBe(true);
  });

  it('lehnt null-Body ab', () => {
    const result = validateThemeWorldBase(null);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// validateScenario
// ============================================================

describe('validateScenario', () => {
  it('akzeptiert gültiges Szenario', () => {
    const result = validateScenario(validScenario());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('lehnt fehlendes label_de ab', () => {
    const data = { ...validScenario(), label_de: '' };
    expect(validateScenario(data).valid).toBe(false);
  });

  it('lehnt ungültigen Slug ab', () => {
    const data = { ...validScenario(), slug: '-invalid-' };
    expect(validateScenario(data).valid).toBe(false);
  });

  it('lehnt card_image_url ohne Alt-Text ab', () => {
    const data = { ...validScenario(), card_image_url: 'https://example.com/card.jpg' };
    const result = validateScenario(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('card_image_alt'))).toBe(true);
  });

  it('lehnt ungültigen cta_config delivery-Wert ab', () => {
    const data = { ...validScenario(), cta_config: { delivery: 'train' } };
    const result = validateScenario(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('delivery'))).toBe(true);
  });
});

// ============================================================
// validateFaq
// ============================================================

describe('validateFaq', () => {
  it('akzeptiert gültige FAQ', () => {
    const result = validateFaq({ question_de: 'Frage?', answer_de: 'Antwort.' });
    expect(result.valid).toBe(true);
  });

  it('lehnt fehlende question_de ab', () => {
    expect(validateFaq({ answer_de: 'Antwort.' }).valid).toBe(false);
  });

  it('lehnt fehlende answer_de ab', () => {
    expect(validateFaq({ question_de: 'Frage?' }).valid).toBe(false);
  });
});

// ============================================================
// validateRegion
// ============================================================

describe('validateRegion', () => {
  it('akzeptiert Region mit loc_param', () => {
    expect(validateRegion({ label_de: 'Zürich', loc_param: 'Zürich' }).valid).toBe(true);
  });

  it('akzeptiert Region mit delivery_param', () => {
    expect(validateRegion({ label_de: 'Online', delivery_param: 'online_live' }).valid).toBe(true);
  });

  it('lehnt Region ohne loc_param und delivery_param ab', () => {
    const result = validateRegion({ label_de: 'Ohne Parameter' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('loc_param/delivery_param'))).toBe(true);
  });

  it('lehnt ungültigen delivery_param ab', () => {
    const result = validateRegion({ label_de: 'Test', delivery_param: 'at_home' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('delivery_param'))).toBe(true);
  });
});

// ============================================================
// validateTrustItem
// ============================================================

describe('validateTrustItem', () => {
  it('akzeptiert gültiges Trust-Item (editorial)', () => {
    expect(validateTrustItem({ item_type: 'editorial', name: 'Yoga-Hinweis' }).valid).toBe(true);
  });

  it('akzeptiert label mit logo_url und logo_alt', () => {
    expect(validateTrustItem({
      item_type: 'label',
      name: 'Qualitop',
      logo_url: 'https://example.com/qualitop.png',
      logo_alt: 'Qualitop-Siegel',
      external_url: 'https://qualitop.ch',
    }).valid).toBe(true);
  });

  it('lehnt ungültigen item_type ab', () => {
    const result = validateTrustItem({ item_type: 'badge', name: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('item_type'))).toBe(true);
  });

  it('lehnt logo_url ohne logo_alt ab', () => {
    const result = validateTrustItem({
      item_type: 'label',
      name: 'Test',
      logo_url: 'https://example.com/logo.png',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('logo_alt'))).toBe(true);
  });

  it('lehnt ungültige external_url ab', () => {
    const result = validateTrustItem({
      item_type: 'info',
      name: 'Test',
      external_url: 'javascript:void(0)',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('external_url'))).toBe(true);
  });
});

// ============================================================
// validateSortReorder
// ============================================================

describe('validateSortReorder', () => {
  it('akzeptiert gültige Reorder-Liste', () => {
    const result = validateSortReorder([
      { id: 'abc', sort_order: 0 },
      { id: 'def', sort_order: 1 },
    ]);
    expect(result.valid).toBe(true);
  });

  it('lehnt fehlende id ab', () => {
    const result = validateSortReorder([{ sort_order: 0 }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('lehnt negative sort_order ab', () => {
    const result = validateSortReorder([{ id: 'abc', sort_order: -1 }]);
    expect(result.valid).toBe(false);
  });

  it('lehnt Nicht-Array ab', () => {
    expect(validateSortReorder({ id: 'abc', sort_order: 0 }).valid).toBe(false);
  });
});

// ============================================================
// validatePublishThemeWorld
// ============================================================

describe('validatePublishThemeWorld', () => {
  it('akzeptiert vollständige publizierbare Themenwelt', () => {
    const result = validatePublishThemeWorld(validPublishedThemeWorld());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('lehnt fehlenden title_de ab', () => {
    const data = { ...validPublishedThemeWorld(), title_de: '' };
    const result = validatePublishThemeWorld(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('title_de'))).toBe(true);
  });

  it('lehnt fehlenden Lead-Text ab (weder subtitle_de noch intro_de)', () => {
    const data = { ...validPublishedThemeWorld(), subtitle_de: null, intro_de: null };
    const result = validatePublishThemeWorld(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('subtitle_de'))).toBe(true);
  });

  it('akzeptiert Themenwelt mit nur intro_de (kein subtitle_de)', () => {
    const data = { ...validPublishedThemeWorld(), subtitle_de: null, intro_de: 'Einleitung.' };
    const result = validatePublishThemeWorld(data);
    expect(result.valid).toBe(true);
  });

  it('lehnt fehlende search_config.area_slug ab', () => {
    const data = { ...validPublishedThemeWorld(), search_config: {} };
    const result = validatePublishThemeWorld(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('area_slug'))).toBe(true);
  });

  it('lehnt null-Themenwelt ab', () => {
    expect(validatePublishThemeWorld(null).valid).toBe(false);
  });
});

// ============================================================
// validatePublishScenario
// ============================================================

describe('validatePublishScenario', () => {
  it('akzeptiert vollständiges publizierbares Szenario', () => {
    const scenario = {
      ...validScenario(),
      label_de: 'Berufseinstieg',
      teaser_de: 'Teaser.',
      content_html: '<p>Content</p>',
    };
    const result = validatePublishScenario(scenario, validPublishedThemeWorld());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('lehnt Szenario ohne publizierten Parent ab', () => {
    const scenario = { ...validScenario() };
    const draftParent = { ...validPublishedThemeWorld(), status: 'draft' };
    const result = validatePublishScenario(scenario, draftParent);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('theme_world'))).toBe(true);
  });

  it('lehnt Szenario ohne content_html ab', () => {
    const scenario = { ...validScenario(), content_html: '' };
    const result = validatePublishScenario(scenario, validPublishedThemeWorld());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('content_html'))).toBe(true);
  });

  it('lehnt Szenario ohne teaser_de ab', () => {
    const scenario = { ...validScenario(), teaser_de: null };
    const result = validatePublishScenario(scenario, validPublishedThemeWorld());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('teaser_de'))).toBe(true);
  });
});
