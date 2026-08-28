/**
 * Unit-Tests fÃ¼r die Theme-World-Validierungsschemas.
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
  VALID_DELIVERY_TYPES,
  VALID_REGION_DELIVERY_PARAMS,
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
    subtitle_de: 'Alles Ã¼ber Berufsausbildungen im Bereich Sport und Fitness.',
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
  it('akzeptiert gÃ¼ltige Slugs', () => {
    expect(isValidSlug('berufseinstieg')).toBe(true);
    expect(isValidSlug('sport-fitness-beruf')).toBe(true);
    expect(isValidSlug('yoga123')).toBe(true);
    expect(isValidSlug('a')).toBe(true);
  });

  it('lehnt ungÃ¼ltige Slugs ab', () => {
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

  it('akzeptiert gÃ¼ltige search_config', () => {
    expect(validateSearchConfig({ area_slug: 'sport_fitness_beruf' })).toEqual([]);
    expect(validateSearchConfig({
      area_slug: 'sport_fitness_beruf',
      type_key: 'beruflich',
      default_spec: 'Fitness-Trainer',
    })).toEqual([]);
  });

  it('akzeptiert einen Kursart-Filter ohne area_slug', () => {
    expect(validateSearchConfig({ kursart: 'feriencamp' })).toEqual([]);
  });

  it('lehnt eine leere Filterkonfiguration ab', () => {
    expect(validateSearchConfig({ type_key: 'kinder_jugend' }).some(e => e.includes('area_slug') || e.includes('kursart'))).toBe(true);
  });

  it('lehnt einen nur aus Leerzeichen bestehenden area_slug ab', () => {
    expect(validateSearchConfig({ area_slug: '   ', kursart: 'feriencamp' }).some(e => e.includes('area_slug'))).toBe(true);
  });

  it('lehnt fehlenden area_slug ab', () => {
    const errors = validateSearchConfig({ type_key: 'beruflich' });
    expect(errors.some(e => e.includes('area_slug'))).toBe(true);
  });

  it('lehnt unbekannte Keys ab', () => {
    const errors = validateSearchConfig({ area_slug: 'test', unknown_key: 'wert' });
    expect(errors.some(e => e.includes('unknown_key'))).toBe(true);
  });

  it('lehnt ungÃ¼ltigen type_key ab', () => {
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

// Kanonischer DB-Vertrag: flache snake_case-Keys mit String-Werten.
// Die frÃ¼here camelCase-Multilang-Erwartung (faqTitle: { de }) war ein toter
// Vertragsrest und beschrieb die Adapter-AUSGABE, nicht das DB-Format.
describe('validateSectionTitles', () => {
  it('akzeptiert null', () => {
    expect(validateSectionTitles(null)).toEqual([]);
  });

  it('akzeptiert gÃ¼ltige section_titles (snake_case, String-Werte)', () => {
    expect(validateSectionTitles({
      faqs_heading: 'HÃ¤ufige Fragen',
      cta_button: 'Jetzt suchen',
    })).toEqual([]);
  });

  it('akzeptiert null als Einzelwert (nicht gesetzt)', () => {
    expect(validateSectionTitles({ trust_heading: null })).toEqual([]);
  });

  it('lehnt unbekannte Keys ab', () => {
    const errors = validateSectionTitles({ unknownSection: 'Test' });
    expect(errors.some(e => e.includes('unknownSection'))).toBe(true);
  });

  it('lehnt das alte camelCase-Format ab (kein paralleler Vertrag)', () => {
    const errors = validateSectionTitles({ faqTitle: { de: 'HÃ¤ufige Fragen' } });
    expect(errors.some(e => e.includes('faqTitle'))).toBe(true);
  });

  it('lehnt Nicht-String-Werte ab', () => {
    const errors = validateSectionTitles({ faqs_heading: { de: 'HÃ¤ufige Fragen' } });
    expect(errors.some(e => e.includes('Muss ein String sein'))).toBe(true);
  });

  it('lehnt zu langen Text ab', () => {
    const errors = validateSectionTitles({ faqs_heading: 'x'.repeat(201) });
    expect(errors.some(e => e.includes('Zu lang'))).toBe(true);
  });

  // editorial_heading hat keinen Datenpfad: nicht in den Importdaten, von keinem
  // Schreibpfad erzeugt, vom Renderer nicht gelesen. Er bleibt daher unbekannt.
  it('lehnt editorial_heading ab (kein Key ohne Datenpfad in der Allowlist)', () => {
    const errors = validateSectionTitles({ editorial_heading: 'Redaktionelles' });
    expect(errors.some(e => e.includes('editorial_heading'))).toBe(true);
    expect(errors.some(e => e.includes('Unbekannter Key'))).toBe(true);
  });

  it('erlaubt weiterhin alle real genutzten Abschnitts-Keys', () => {
    const REAL_KEYS = [
      'scenarios_heading', 'scenarios_subheading',
      'specialties_heading', 'specialties_subheading',
      'searches_heading', 'searches_subheading',
      'regions_heading', 'regions_subheading',
      'faqs_heading', 'trust_heading',
      'cta_heading', 'cta_button',
    ];
    for (const key of REAL_KEYS) {
      expect(validateSectionTitles({ [key]: 'Testwert' })).toEqual([]);
    }
  });
});

// ============================================================
// validatePredefinedSearches
// ============================================================

describe('validatePredefinedSearches', () => {
  it('akzeptiert null', () => {
    expect(validatePredefinedSearches(null)).toEqual([]);
  });

  it('akzeptiert gÃ¼ltige Suchliste', () => {
    expect(validatePredefinedSearches([
      { label_de: 'Fitness Trainer ZÃ¼rich', loc: 'ZÃ¼rich', delivery: 'presence' },
      { label_de: 'Online Yoga' },
    ])).toEqual([]);
  });

  it('akzeptiert kursart in vordefinierten Suchen', () => {
    expect(validatePredefinedSearches([{ label_de: 'Feriencamps', kursart: 'feriencamp' }])).toEqual([]);
  });

  it('lehnt fehlenden label_de ab', () => {
    const errors = validatePredefinedSearches([{ loc: 'ZÃ¼rich' }]);
    expect(errors.some(e => e.includes('label_de'))).toBe(true);
  });

  it('lehnt ungÃ¼ltigen delivery-Wert ab', () => {
    const errors = validatePredefinedSearches([{ label_de: 'Test', delivery: 'at_home' }]);
    expect(errors.some(e => e.includes('delivery'))).toBe(true);
  });

  it('lehnt mehr als 20 EintrÃ¤ge ab', () => {
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
  it('akzeptiert gÃ¼ltige cta_links', () => {
    expect(validateCtaLinks([
      { label_de: 'Alle Kurse' },
      { label_de: 'ZÃ¼rich', loc: 'ZÃ¼rich', delivery: 'presence' },
    ])).toEqual([]);
  });

  it('lehnt mehr als 5 EintrÃ¤ge ab', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ label_de: `Link ${i}` }));
    const errors = validateCtaLinks(items);
    expect(errors.some(e => e.includes('Maximal 5'))).toBe(true);
  });

  it('lehnt unbekannte Keys ab', () => {
    const errors = validateCtaLinks([{ label_de: 'Test', url: 'https://example.com' }]);
    expect(errors.some(e => e.includes('url'))).toBe(true);
  });

  // label_de: identischer Vertrag wie im Admin â€” getrimmt nicht leer, max 60.
  describe('label_de', () => {
    it('akzeptiert ein regulÃ¤res Label', () => {
      expect(validateCtaLinks([{ label_de: 'Kurse in ZÃ¼rich' }])).toEqual([]);
    });

    it.each([
      ['leerer String', ''],
      ['ein Leerzeichen', ' '],
      ['mehrere Leerzeichen', '     '],
      ['Tab und Zeilenumbruch', '\t\n '],
    ])('lehnt %s ab', (_name, label_de) => {
      const errors = validateCtaLinks([{ label_de }]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('cta_links[0].label_de: Pflichtfeld fehlt oder leer.');
    });

    it('lehnt fehlendes label_de ab', () => {
      const errors = validateCtaLinks([{ loc: 'ZÃ¼rich' }]);
      expect(errors.some(e => e.includes('label_de'))).toBe(true);
    });

    it('lehnt Nicht-Strings ab', () => {
      for (const label_de of [42, {}, [], true, null]) {
        expect(validateCtaLinks([{ label_de }]).some(e => e.includes('label_de'))).toBe(true);
      }
    });

    it('akzeptiert exakt 60 Zeichen und lehnt 61 ab', () => {
      expect(validateCtaLinks([{ label_de: 'x'.repeat(60) }])).toEqual([]);
      expect(validateCtaLinks([{ label_de: 'x'.repeat(61) }]).some(e => e.includes('Zu lang'))).toBe(true);
    });

    it('trimmt oder mutiert die Eingabe nicht', () => {
      const item = { label_de: '  Kurse in ZÃ¼rich  ' };
      validateCtaLinks([item]);
      expect(item.label_de).toBe('  Kurse in ZÃ¼rich  ');
    });
  });

  // spec / focus / loc: optional, aber typsicher. Bewusst keine Fach- oder
  // Orts-Taxonomie â€” identisch zu predefined_searches.
  describe.each(['spec', 'focus', 'loc'])('%s', (field) => {
    it('akzeptiert ein fehlendes Feld', () => {
      expect(validateCtaLinks([{ label_de: 'Alle Kurse' }])).toEqual([]);
    });

    it.each(['ZÃ¼rich', 'Basel-Stadt'])('akzeptiert den String %s', (value) => {
      expect(validateCtaLinks([{ label_de: 'Alle Kurse', [field]: value }])).toEqual([]);
    });

    it.each([
      ['Zahl', 123],
      ['Objekt', {}],
      ['Array', []],
      ['Boolean', true],
    ])('lehnt %s ab', (_name, value) => {
      const errors = validateCtaLinks([{ label_de: 'Alle Kurse', [field]: value }]);
      expect(errors).toEqual([`cta_links[0].${field}: Muss ein String oder null sein.`]);
    });

    // null bedeutet Â«nicht gesetztÂ», genau wie ein fehlender Key. Importpakete
    // schreiben die optionalen Suchparameter explizit als null aus; wÃ¼rde der
    // Validator das ablehnen, liesse sich ein importierter CTA-Link im Admin
    // nie wieder speichern.
    it('akzeptiert null als Â«nicht gesetztÂ»', () => {
      expect(validateCtaLinks([{ label_de: 'Alle Kurse', [field]: null }])).toEqual([]);
    });

    it('validiert keine Taxonomie (beliebiger String bleibt gÃ¼ltig)', () => {
      expect(validateCtaLinks([{ label_de: 'Alle Kurse', [field]: 'Irgendwas' }])).toEqual([]);
    });
  });

  // sort_order und status stammen aus dem Importpaket. Sie sind im Admin nicht
  // bearbeitbar, mÃ¼ssen den Speicherpfad aber unbeschadet passieren.
  describe('sort_order', () => {
    it('akzeptiert eine ganze Zahl >= 0 sowie null und ein fehlendes Feld', () => {
      expect(validateCtaLinks([{ label_de: 'A', sort_order: 0 }])).toEqual([]);
      expect(validateCtaLinks([{ label_de: 'A', sort_order: 3 }])).toEqual([]);
      expect(validateCtaLinks([{ label_de: 'A', sort_order: null }])).toEqual([]);
      expect(validateCtaLinks([{ label_de: 'A' }])).toEqual([]);
    });

    it.each([
      ['negative Zahl', -1],
      ['Kommazahl', 1.5],
      ['String', '1'],
    ])('lehnt %s ab', (_name, sort_order) => {
      const errors = validateCtaLinks([{ label_de: 'A', sort_order }]);
      expect(errors).toEqual(['cta_links[0].sort_order: Muss eine ganze Zahl >= 0 sein.']);
    });
  });

  describe('status', () => {
    it.each(['draft', 'published', 'archived'])('akzeptiert %s', (status) => {
      expect(validateCtaLinks([{ label_de: 'A', status }])).toEqual([]);
    });

    it('akzeptiert null und ein fehlendes Feld', () => {
      expect(validateCtaLinks([{ label_de: 'A', status: null }])).toEqual([]);
      expect(validateCtaLinks([{ label_de: 'A' }])).toEqual([]);
    });

    it('lehnt einen unbekannten Status ab', () => {
      const errors = validateCtaLinks([{ label_de: 'A', status: 'live' }]);
      expect(errors.some((e) => e.includes('status'))).toBe(true);
    });
  });

  // Der Vertrag muss genau das Format des eingefrorenen Kreativkurse-Pakets
  // tragen â€” sonst blockiert der Importâ†’Adminâ†’Speichern-Zyklus.
  it('akzeptiert das vollstÃ¤ndige Importformat mit allen sieben Keys', () => {
    const errors = validateCtaLinks([
      {
        sort_order: 1,
        label_de: 'Alle Kreativkurse vor Ort anzeigen',
        spec: null,
        focus: null,
        loc: null,
        delivery: 'presence',
        status: 'draft',
      },
    ]);
    expect(errors).toEqual([]);
  });
});

// ============================================================
// validateThemeWorldBase
// ============================================================

describe('validateThemeWorldBase', () => {
  it('akzeptiert gÃ¼ltige Themenwelt', () => {
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

  it('lehnt ungÃ¼ltiges Segment ab', () => {
    const data = { ...validThemeWorldBase(), db_segment: 'ungÃ¼ltig' };
    const result = validateThemeWorldBase(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('db_segment'))).toBe(true);
  });

  it('lehnt ungÃ¼ltigen Slug ab', () => {
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

  it('lehnt ungÃ¼ltige og_image_url ab', () => {
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
  it('akzeptiert gÃ¼ltiges Szenario', () => {
    const result = validateScenario(validScenario());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('lehnt fehlendes label_de ab', () => {
    const data = { ...validScenario(), label_de: '' };
    expect(validateScenario(data).valid).toBe(false);
  });

  it('lehnt ungÃ¼ltigen Slug ab', () => {
    const data = { ...validScenario(), slug: '-invalid-' };
    expect(validateScenario(data).valid).toBe(false);
  });

  it('lehnt card_image_url ohne Alt-Text ab', () => {
    const data = { ...validScenario(), card_image_url: 'https://example.com/card.jpg' };
    const result = validateScenario(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('card_image_alt'))).toBe(true);
  });

  it('lehnt ungÃ¼ltigen cta_config delivery-Wert ab', () => {
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
  it('akzeptiert gÃ¼ltige FAQ', () => {
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
  // Fall 1: nur loc_param
  it('akzeptiert Region mit loc_param', () => {
    expect(validateRegion({ label_de: 'ZÃ¼rich', loc_param: 'ZÃ¼rich' }).valid).toBe(true);
  });

  // Fall 2: nur delivery_param
  it('akzeptiert Region mit delivery_param', () => {
    expect(validateRegion({ label_de: 'Online', delivery_param: 'online_live' }).valid).toBe(true);
  });

  // Fall 3: beide gesetzt
  it('akzeptiert Region mit loc_param UND delivery_param', () => {
    const result = validateRegion({
      label_de: 'ZÃ¼rich online',
      loc_param: 'ZÃ¼rich',
      delivery_param: 'online_live',
    });
    expect(result.valid).toBe(true);
  });

  // ------------------------------------------------------------------
  // Release-Blocker 2: Regionen-Validierung widersprach dem DB-Modell.
  //
  // Die Constraint regions_params_check wurde in
  // supabase/migrations/20260718_relax_regions_params_constraint.sql
  // ersatzlos entfernt: loc_param = NULL UND delivery_param = NULL ist
  // ein gÃ¼ltiger Zustand ("Ganze Schweiz" â€” Link ohne Standort-/
  // Lieferungsfilter). Bestehende Sport-/Yoga-Daten nutzen ihn.
  //
  // validateRegion darf diesen Fall deshalb NICHT mehr ablehnen.
  // ------------------------------------------------------------------
  describe('Fall 4: beide Parameter leer ("Ganze Schweiz")', () => {
    it('akzeptiert "Ganze Schweiz" mit loc_param=null und delivery_param=null', () => {
      const result = validateRegion({
        label_de: 'Ganze Schweiz',
        loc_param: null,
        delivery_param: null,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('akzeptiert Region ganz ohne loc_param/delivery_param-SchlÃ¼ssel', () => {
      const result = validateRegion({ label_de: 'Ganze Schweiz' });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('akzeptiert leere Strings fÃ¼r beide Parameter (API normalisiert sie zu null)', () => {
      const result = validateRegion({
        label_de: 'Ganze Schweiz',
        loc_param: '',
        delivery_param: '',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('meldet keinen loc_param/delivery_param-Fehler mehr', () => {
      const result = validateRegion({ label_de: 'Ohne Parameter' });
      expect(result.errors.some(e => e.includes('loc_param/delivery_param'))).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // Release-Blocker 3: delivery_param wurde gegen das Such-Vokabular
  // geprÃ¼ft statt gegen das DB-Vokabular.
  //
  // Der Vertrag ist zweistufig:
  //   - theme_world_regions.delivery_param speichert den DB-Wert.
  //     Constraint regions_delivery_param_check
  //     (20260714_create_theme_worlds.sql:404) erlaubt 'in_person'.
  //   - Der Such-/URL-Layer nutzt 'presence' (VALID_DELIVERY_TYPES).
  //   - themeWorldAdapter.js:464 kanonisiert in_person â†’ presence.
  //
  // validateRegion muss deshalb gegen VALID_REGION_DELIVERY_PARAMS
  // prÃ¼fen, nicht gegen VALID_DELIVERY_TYPES.
  // ------------------------------------------------------------------
  describe('Fall 5: delivery_param folgt dem DB-Vokabular', () => {
    it('akzeptiert delivery_param "in_person" (DB-Wert fÃ¼r Vor Ort)', () => {
      const result = validateRegion({ label_de: 'Vor Ort', delivery_param: 'in_person' });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('akzeptiert "in_person" zusammen mit loc_param', () => {
      const result = validateRegion({
        label_de: 'ZÃ¼rich vor Ort',
        loc_param: 'ZÃ¼rich',
        delivery_param: 'in_person',
      });
      expect(result.valid).toBe(true);
    });

    it('lehnt delivery_param "presence" ab (Such-Wert, verletzt DB-Constraint)', () => {
      const result = validateRegion({ label_de: 'Vor Ort', delivery_param: 'presence' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('delivery_param'))).toBe(true);
    });

    it('akzeptiert weiterhin online_live und self_study', () => {
      expect(validateRegion({ label_de: 'Online', delivery_param: 'online_live' }).valid).toBe(true);
      expect(validateRegion({ label_de: 'Selbststudium', delivery_param: 'self_study' }).valid).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Fall 6: anchor_text_de â€” SEO-Linktext des Regionenlinks.
  //
  // Der Admin zeigt und speichert das Feld seit jeher, geprÃ¼ft wurde es
  // serverseitig aber nicht. Ein Nicht-String oder ein ungebremst langer
  // Wert erreichte damit die Datenbank, obwohl die Spalte den Linktext
  // Ã¶ffentlich ausgibt.
  //
  // Optional bleibt es: fehlt der Wert oder ist er leer/null, fÃ¤llt die
  // Anzeige auf label_de zurÃ¼ck (themeWorldAdapter.js:343 und der
  // Import-RPC via COALESCE). Diese Fallback-Logik darf die Validierung
  // nicht aushebeln, indem sie das Feld zur Pflicht macht.
  // ------------------------------------------------------------------
  describe('Fall 6: anchor_text_de', () => {
    it('akzeptiert einen gÃ¼ltigen Linktext', () => {
      const result = validateRegion({
        label_de: 'ZÃ¼rich',
        anchor_text_de: 'Kreativkurse in ZÃ¼rich',
        loc_param: 'ZÃ¼rich',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('akzeptiert die Bestandswerte der Sport- und Yoga-Themenwelten', () => {
      for (const anchor of [
        'Online-live Yoga- und Achtsamkeitskurse in der Schweiz',
        'Alle Sport- und Fitness-Ausbildungen in der Schweiz',
      ]) {
        const result = validateRegion({ label_de: 'Bestand', anchor_text_de: anchor });
        expect(result.valid).toBe(true);
      }
    });

    it.each([
      ['null', null],
      ['leerer String', ''],
      ['undefined', undefined],
    ])('akzeptiert %s â€” die Anzeige fÃ¤llt dann auf label_de zurÃ¼ck', (_name, anchor_text_de) => {
      const result = validateRegion({ label_de: 'Ganze Schweiz', anchor_text_de });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('akzeptiert eine Region ganz ohne anchor_text_de-SchlÃ¼ssel', () => {
      const result = validateRegion({ label_de: 'Ganze Schweiz' });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it.each([
      ['Zahl', 42],
      ['Objekt', {}],
      ['Array', []],
      ['Boolean', true],
    ])('lehnt %s ab', (_name, anchor_text_de) => {
      const result = validateRegion({ label_de: 'ZÃ¼rich', anchor_text_de });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('anchor_text_de: Muss ein String sein.');
    });

    it('akzeptiert exakt 200 Zeichen und lehnt 201 ab', () => {
      expect(validateRegion({ label_de: 'ZÃ¼rich', anchor_text_de: 'x'.repeat(200) }).valid).toBe(true);

      const tooLong = validateRegion({ label_de: 'ZÃ¼rich', anchor_text_de: 'x'.repeat(201) });
      expect(tooLong.valid).toBe(false);
      expect(tooLong.errors).toContain('anchor_text_de: Zu lang (max 200 Zeichen).');
    });

    it('lÃ¤sst label_de unberÃ¼hrt â€” ein Fehler am Linktext betrifft nur ihn', () => {
      const result = validateRegion({ label_de: 'ZÃ¼rich', anchor_text_de: 42 });
      expect(result.errors.some((e) => e.startsWith('label_de'))).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // Weiterhin ungÃ¼ltig
  // ------------------------------------------------------------------
  it('lehnt ungÃ¼ltigen delivery_param ab', () => {
    const result = validateRegion({ label_de: 'Test', delivery_param: 'at_home' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('delivery_param'))).toBe(true);
  });

  it('lehnt ungÃ¼ltigen delivery_param auch ohne loc_param ab', () => {
    const result = validateRegion({
      label_de: 'Ganze Schweiz',
      loc_param: null,
      delivery_param: 'irgendwas',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('delivery_param'))).toBe(true);
  });

  it('lehnt fehlendes label_de ab', () => {
    const result = validateRegion({ loc_param: 'Bern' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('label_de'))).toBe(true);
  });

  it('lehnt leeres label_de auch bei sonst gÃ¼ltiger Region ab', () => {
    const result = validateRegion({ label_de: '   ', loc_param: null, delivery_param: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('label_de'))).toBe(true);
  });
});

// ============================================================
// validateTrustItem
// ============================================================

describe('validateTrustItem', () => {
  it('akzeptiert gÃ¼ltiges Trust-Item (editorial)', () => {
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

  it('lehnt ungÃ¼ltigen item_type ab', () => {
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

  it('lehnt ungÃ¼ltige external_url ab', () => {
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
  it('akzeptiert gÃ¼ltige Reorder-Liste', () => {
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
  it('akzeptiert vollstÃ¤ndige publizierbare Themenwelt', () => {
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
  it('akzeptiert vollstÃ¤ndiges publizierbares Szenario', () => {
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

// ============================================================
// Delivery-Vertrag: zwei Vokabulare, klar getrennt
// ============================================================
//
// Such-/URL-Layer  â†’ 'presence'    (VALID_DELIVERY_TYPES)
// Regions-DB-Layer â†’ 'in_person'   (VALID_REGION_DELIVERY_PARAMS)
// BrÃ¼cke           â†’ themeWorldAdapter.js:464 normalisiert in_person â†’ presence
//
// Diese Trennung ist beabsichtigt und wird hier festgeschrieben, damit die
// beiden Listen nicht versehentlich wieder zusammengefÃ¼hrt werden.

describe('Delivery-Vertrag â€” Trennung der Vokabulare', () => {
  it('Such-Vokabular enthÃ¤lt presence, nicht in_person', () => {
    expect(VALID_DELIVERY_TYPES).toContain('presence');
    expect(VALID_DELIVERY_TYPES).not.toContain('in_person');
  });

  it('Regions-Vokabular enthÃ¤lt in_person, nicht presence', () => {
    expect(VALID_REGION_DELIVERY_PARAMS).toContain('in_person');
    expect(VALID_REGION_DELIVERY_PARAMS).not.toContain('presence');
  });

  it('beide Vokabulare teilen online_live und self_study', () => {
    for (const shared of ['online_live', 'self_study']) {
      expect(VALID_DELIVERY_TYPES).toContain(shared);
      expect(VALID_REGION_DELIVERY_PARAMS).toContain(shared);
    }
  });

  it('Regions-Vokabular deckt sich mit regions_delivery_param_check', () => {
    // 20260714_create_theme_worlds.sql:404
    expect([...VALID_REGION_DELIVERY_PARAMS].sort()).toEqual(
      ['in_person', 'online_live', 'self_study'],
    );
  });
});

describe('Delivery-Vertrag â€” Such-/CTA-Layer bleibt unverÃ¤ndert', () => {
  it('predefined_searches akzeptiert presence', () => {
    expect(validatePredefinedSearches([{ label_de: 'Vor Ort', delivery: 'presence' }])).toHaveLength(0);
  });

  it('predefined_searches lehnt in_person ab (Alias, nicht kanonisch)', () => {
    const errors = validatePredefinedSearches([{ label_de: 'Vor Ort', delivery: 'in_person' }]);
    expect(errors.some(e => e.includes('delivery'))).toBe(true);
  });

  it('cta_links akzeptiert presence', () => {
    expect(validateCtaLinks([{ label_de: 'Jetzt buchen', delivery: 'presence' }])).toHaveLength(0);
  });

  it('cta_links lehnt in_person ab', () => {
    const errors = validateCtaLinks([{ label_de: 'Jetzt buchen', delivery: 'in_person' }]);
    expect(errors.some(e => e.includes('delivery'))).toBe(true);
  });

  it('cta_config (Szenario-CTA) akzeptiert presence', () => {
    expect(validateCtaConfig({ delivery: 'presence' })).toHaveLength(0);
  });

  it('cta_config lehnt in_person ab', () => {
    const errors = validateCtaConfig({ delivery: 'in_person' });
    expect(errors.some(e => e.includes('delivery'))).toBe(true);
  });

  it('beide Layer lehnen einen beliebigen Fantasiewert ab', () => {
    expect(validateRegion({ label_de: 'X', delivery_param: 'at_home' }).valid).toBe(false);
    expect(validatePredefinedSearches([{ label_de: 'X', delivery: 'at_home' }]).length).toBeGreaterThan(0);
    expect(validateCtaLinks([{ label_de: 'X', delivery: 'at_home' }]).length).toBeGreaterThan(0);
    expect(validateCtaConfig({ delivery: 'at_home' }).length).toBeGreaterThan(0);
  });
});

// ============================================================
// replace-regions: gemischter Regionssatz
// ============================================================

describe('replace-regions â€” gemischter Regionssatz passiert die Validierung', () => {
  const items = [
    { label_de: 'Ganze Schweiz', loc_param: null, delivery_param: null },
    { label_de: 'ZÃ¼rich', loc_param: 'ZÃ¼rich', delivery_param: null },
    { label_de: 'Online', loc_param: null, delivery_param: 'online_live' },
    { label_de: 'Vor Ort', loc_param: null, delivery_param: 'in_person' },
  ];

  it('alle vier Regionstypen sind einzeln gÃ¼ltig', () => {
    for (const item of items) {
      const result = validateRegion(item);
      expect(result.valid, `${item.label_de}: ${result.errors.join('; ')}`).toBe(true);
    }
  });

  it('der komplette Satz ist fehlerfrei', () => {
    const allErrors = items.flatMap(item => validateRegion(item).errors);
    expect(allErrors).toEqual([]);
  });
});
