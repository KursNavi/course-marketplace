/**
 * Phase 8.11 — Tests:
 *   1. Dynamisches Suchbereichslabel (area_label_de)
 *   2. Delivery-Kanonisierung
 *   3. Escaped-HTML-Validierung
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// 1. Escaped-HTML-Erkennung (detectEscapedHtmlDocument)
// ============================================================

import {
  detectEscapedHtmlDocument,
  validateScenario,
  validateSearchConfig,
  VALID_DELIVERY_TYPES,
} from '../api/_lib/theme-world-validate.js';

describe('detectEscapedHtmlDocument', () => {
  it('rejects fully escaped HTML with many structural tags', () => {
    const escaped =
      '&lt;p&gt;Hallo Welt&lt;/p&gt;&lt;h2&gt;Titel&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Punkt 1&lt;/li&gt;&lt;/ul&gt;';
    expect(detectEscapedHtmlDocument(escaped)).toBe(true);
  });

  it('rejects escaped &lt;p&gt;…&lt;/p&gt; repeated three or more times', () => {
    const escaped = '&lt;p&gt;Text A&lt;/p&gt; &lt;p&gt;Text B&lt;/p&gt; &lt;p&gt;Text C&lt;/p&gt;';
    expect(detectEscapedHtmlDocument(escaped)).toBe(true);
  });

  it('accepts normal text containing a comparison like "2 < 3"', () => {
    // Raw < is not &lt; — no escaped structural tags
    expect(detectEscapedHtmlDocument('Der Kurs kostet 2 < 3 CHF')).toBe(false);
  });

  it('accepts real HTML markup (not escaped)', () => {
    const html = '<p>Hallo Welt</p><h2>Titel</h2><ul><li>Punkt 1</li></ul>';
    expect(detectEscapedHtmlDocument(html)).toBe(false);
  });

  it('accepts plain text with no HTML at all', () => {
    expect(detectEscapedHtmlDocument('Einfacher Text ohne HTML')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(detectEscapedHtmlDocument('')).toBe(false);
  });

  it('returns false for null / undefined', () => {
    expect(detectEscapedHtmlDocument(null)).toBe(false);
    expect(detectEscapedHtmlDocument(undefined)).toBe(false);
  });

  it('accepts a single isolated escaped tag (below threshold)', () => {
    // Only 1 escaped structural tag → below threshold of 3
    expect(detectEscapedHtmlDocument('Beispiel: &lt;p&gt;Absatz&lt;/p&gt;')).toBe(false);
  });

  it('does not reject mixed content with both escaped tags and real HTML', () => {
    // Has real HTML → not treated as fully masked document
    const mixed = '<p>Echter Absatz</p> &lt;h2&gt;Escaped Titel&lt;/h2&gt; &lt;p&gt;Text&lt;/p&gt; &lt;p&gt;Text2&lt;/p&gt;';
    expect(detectEscapedHtmlDocument(mixed)).toBe(false);
  });

  it('rejects escaped heading tags as part of a document', () => {
    const escaped = '&lt;h2&gt;Kapitel 1&lt;/h2&gt;&lt;h3&gt;Abschnitt&lt;/h3&gt;&lt;p&gt;Text&lt;/p&gt;&lt;strong&gt;Fett&lt;/strong&gt;';
    expect(detectEscapedHtmlDocument(escaped)).toBe(true);
  });

  it('rejects escaped list structure', () => {
    const escaped = '&lt;ul&gt;&lt;li&gt;A&lt;/li&gt;&lt;li&gt;B&lt;/li&gt;&lt;li&gt;C&lt;/li&gt;&lt;/ul&gt;';
    expect(detectEscapedHtmlDocument(escaped)).toBe(true);
  });
});

// ============================================================
// 2. validateScenario — Escaped-HTML-Schutz
// ============================================================

describe('validateScenario — escaped HTML protection', () => {
  const minimalValid = {
    label_de: 'Test Szenario',
    slug: 'test-szenario',
  };

  it('rejects fully escaped HTML in content_html', () => {
    const result = validateScenario({
      ...minimalValid,
      content_html: '&lt;p&gt;Text A&lt;/p&gt;&lt;h2&gt;Titel&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Punkt&lt;/li&gt;&lt;/ul&gt;',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('maskiertes HTML'))).toBe(true);
  });

  it('accepts real HTML in content_html', () => {
    const result = validateScenario({
      ...minimalValid,
      content_html: '<p>Echter Inhalt</p><h2>Titel</h2><ul><li>Punkt 1</li></ul>',
    });
    // Should not have an escaped-HTML error
    expect(result.errors.some(e => e.includes('maskiertes HTML'))).toBe(false);
  });

  it('accepts content_html with "2 < 3" comparison', () => {
    const result = validateScenario({
      ...minimalValid,
      content_html: '<p>Der Preis ist 2 &lt; 3 CHF.</p>',
    });
    expect(result.errors.some(e => e.includes('maskiertes HTML'))).toBe(false);
  });

  it('accepts content_html that is absent (no error)', () => {
    const result = validateScenario(minimalValid);
    expect(result.errors.some(e => e.includes('maskiertes HTML'))).toBe(false);
  });
});

// ============================================================
// 3. validateSearchConfig — area_label_de
// ============================================================

describe('validateSearchConfig — area_label_de', () => {
  const base = { area_slug: 'kreativ_gestalten' };

  it('accepts search_config without area_label_de (optional)', () => {
    const errors = validateSearchConfig(base);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid area_label_de string', () => {
    const errors = validateSearchConfig({ ...base, area_label_de: 'Kreativ & Gestalten' });
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty area_label_de string (cleared value)', () => {
    const errors = validateSearchConfig({ ...base, area_label_de: '' });
    expect(errors).toHaveLength(0);
  });

  it('rejects area_label_de that is not a string', () => {
    const errors = validateSearchConfig({ ...base, area_label_de: 123 });
    expect(errors.some(e => e.includes('area_label_de'))).toBe(true);
  });

  it('rejects area_label_de longer than 80 characters', () => {
    const longLabel = 'A'.repeat(81);
    const errors = validateSearchConfig({ ...base, area_label_de: longLabel });
    expect(errors.some(e => e.includes('area_label_de'))).toBe(true);
  });

  it('accepts area_label_de of exactly 80 characters', () => {
    const label80 = 'A'.repeat(80);
    const errors = validateSearchConfig({ ...base, area_label_de: label80 });
    expect(errors).toHaveLength(0);
  });

  it('rejects unknown keys in search_config', () => {
    const errors = validateSearchConfig({ ...base, unknown_key: 'val' });
    expect(errors.some(e => e.includes('unknown_key'))).toBe(true);
  });

  it('area_label_de is now a known key (not rejected)', () => {
    // Ensure area_label_de does not trigger "Unbekannter Key"
    const errors = validateSearchConfig({ ...base, area_label_de: 'OK' });
    expect(errors.some(e => e.includes('Unbekannter Key'))).toBe(false);
  });
});

// ============================================================
// 4. VALID_DELIVERY_TYPES — kanonische Werte
// ============================================================

describe('VALID_DELIVERY_TYPES', () => {
  it('contains presence (canonical) not in_person (alias)', () => {
    expect(VALID_DELIVERY_TYPES).toContain('presence');
    expect(VALID_DELIVERY_TYPES).not.toContain('in_person');
  });

  it('contains online_live and self_study', () => {
    expect(VALID_DELIVERY_TYPES).toContain('online_live');
    expect(VALID_DELIVERY_TYPES).toContain('self_study');
  });
});

// ============================================================
// 5. normalizeDeliveryTypeKey — alle Fälle
// ============================================================

import { normalizeDeliveryTypeKey } from '../src/lib/courseMetadata.js';

describe('normalizeDeliveryTypeKey (exported)', () => {
  it('normalizes in_person → presence', () => {
    expect(normalizeDeliveryTypeKey('in_person')).toBe('presence');
  });

  it('normalizes onsite → presence', () => {
    expect(normalizeDeliveryTypeKey('onsite')).toBe('presence');
  });

  it('normalizes online → online_live', () => {
    expect(normalizeDeliveryTypeKey('online')).toBe('online_live');
  });

  it('keeps presence unchanged', () => {
    expect(normalizeDeliveryTypeKey('presence')).toBe('presence');
  });

  it('keeps online_live unchanged', () => {
    expect(normalizeDeliveryTypeKey('online_live')).toBe('online_live');
  });

  it('keeps self_study unchanged', () => {
    expect(normalizeDeliveryTypeKey('self_study')).toBe('self_study');
  });

  it('returns null for unknown values', () => {
    expect(normalizeDeliveryTypeKey('invalid_type')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(normalizeDeliveryTypeKey('')).toBe(null);
  });

  it('returns null for null', () => {
    expect(normalizeDeliveryTypeKey(null)).toBe(null);
  });

  it('is case-insensitive', () => {
    expect(normalizeDeliveryTypeKey('IN_PERSON')).toBe('presence');
    expect(normalizeDeliveryTypeKey('Online')).toBe('online_live');
  });
});

// ============================================================
// 6. themeWorldAdapter — Delivery-Kanonisierung
// ============================================================

import {
  adaptToLegacyBereichConfig,
} from '../src/lib/themeWorldAdapter.js';

describe('themeWorldAdapter — delivery canonicalization', () => {
  const baseTW = {
    id: 'tw-1',
    key: 'kreativ_gestalten',
    url_segment: 'privat-hobby',
    slug: 'kreativ-gestalten',
    db_segment: 'privat',
    area_slug: 'kreativ_gestalten',
    title_de: 'Kreativ & Gestalten',
    subtitle_de: 'Kreativ sein',
    status: 'published',
    search_config: { area_slug: 'kreativ_gestalten', type_key: 'privat_hobby' },
    section_titles: {},
    predefined_searches: [],
    cta_links: [],
  };

  it('normalizes in_person → presence in predefined_searches', () => {
    const tw = {
      ...baseTW,
      predefined_searches: [
        { label_de: 'Vor-Ort Kurs', delivery: 'in_person' },
      ],
    };
    const config = adaptToLegacyBereichConfig({ themeWorld: tw });
    expect(config.predefinedSearches[0].extraParams.delivery).toBe('presence');
  });

  it('normalizes onsite → presence in predefined_searches', () => {
    const tw = {
      ...baseTW,
      predefined_searches: [
        { label_de: 'Vor Ort', delivery: 'onsite' },
      ],
    };
    const config = adaptToLegacyBereichConfig({ themeWorld: tw });
    expect(config.predefinedSearches[0].extraParams.delivery).toBe('presence');
  });

  it('normalizes online → online_live in predefined_searches', () => {
    const tw = {
      ...baseTW,
      predefined_searches: [
        { label_de: 'Online Kurs', delivery: 'online' },
      ],
    };
    const config = adaptToLegacyBereichConfig({ themeWorld: tw });
    expect(config.predefinedSearches[0].extraParams.delivery).toBe('online_live');
  });

  it('keeps presence unchanged in predefined_searches', () => {
    const tw = {
      ...baseTW,
      predefined_searches: [
        { label_de: 'Präsenz', delivery: 'presence' },
      ],
    };
    const config = adaptToLegacyBereichConfig({ themeWorld: tw });
    expect(config.predefinedSearches[0].extraParams.delivery).toBe('presence');
  });

  it('normalizes in_person → presence in cta_links', () => {
    const tw = {
      ...baseTW,
      cta_links: [
        { label_de: 'Vor Ort Buchen', delivery: 'in_person' },
      ],
    };
    const config = adaptToLegacyBereichConfig({ themeWorld: tw });
    expect(config.ctaLinks[0].params.delivery).toBe('presence');
  });

  it('normalizes delivery in regions (delivery_param)', () => {
    const regions = [
      { label_de: 'Zürich vor Ort', loc_param: 'Zürich', delivery_param: 'in_person' },
    ];
    const config = adaptToLegacyBereichConfig({ themeWorld: baseTW, regions });
    expect(config.regionalDiscovery.regions[0].params.delivery).toBe('presence');
  });
});

// ============================================================
// 7. fetchPublishedThemeWorldAreaLabels — Label-Fallback-Logik
// ============================================================

// Test the pure mapping logic (without actual DB calls)
describe('fetchPublishedThemeWorldAreaLabels — label resolution logic', () => {
  // Simulate the mapping logic used inside fetchPublishedThemeWorldAreaLabels
  function buildLabelMap(rows) {
    const map = new Map();
    for (const row of rows || []) {
      if (!row.area_slug) continue;
      const sc = row.search_config || {};
      const label = (sc.area_label_de || '').trim() || (row.title_de || '').trim();
      if (label) map.set(row.area_slug, label);
    }
    return map;
  }

  it('uses area_label_de when set (fallback 4)', () => {
    const rows = [
      {
        area_slug: 'kreativ_gestalten',
        title_de: 'Test-Themenwelt Kreativ & Gestalten',
        search_config: { area_slug: 'kreativ_gestalten', area_label_de: 'Kreativ & Gestalten' },
      },
    ];
    const map = buildLabelMap(rows);
    expect(map.get('kreativ_gestalten')).toBe('Kreativ & Gestalten');
  });

  it('falls back to title_de when area_label_de is absent (fallback 5)', () => {
    const rows = [
      {
        area_slug: 'kreativ_gestalten',
        title_de: 'Test-Themenwelt Kreativ & Gestalten',
        search_config: { area_slug: 'kreativ_gestalten' },
      },
    ];
    const map = buildLabelMap(rows);
    expect(map.get('kreativ_gestalten')).toBe('Test-Themenwelt Kreativ & Gestalten');
  });

  it('falls back to title_de when area_label_de is empty string', () => {
    const rows = [
      {
        area_slug: 'kreativ_gestalten',
        title_de: 'Kreativ & Gestalten',
        search_config: { area_slug: 'kreativ_gestalten', area_label_de: '  ' },
      },
    ];
    const map = buildLabelMap(rows);
    expect(map.get('kreativ_gestalten')).toBe('Kreativ & Gestalten');
  });

  it('does not include rows without area_slug', () => {
    const rows = [
      { area_slug: '', title_de: 'Ohne Slug', search_config: {} },
      { title_de: 'Kein Slug', search_config: {} },
    ];
    const map = buildLabelMap(rows);
    expect(map.size).toBe(0);
  });

  it('handles multiple theme worlds', () => {
    const rows = [
      {
        area_slug: 'kreativ_gestalten',
        title_de: 'Test-Themenwelt Kreativ',
        search_config: { area_slug: 'kreativ_gestalten', area_label_de: 'Kreativ & Gestalten' },
      },
      {
        area_slug: 'musik_bewegung',
        title_de: 'Musik & Bewegung',
        search_config: { area_slug: 'musik_bewegung' },
      },
    ];
    const map = buildLabelMap(rows);
    expect(map.get('kreativ_gestalten')).toBe('Kreativ & Gestalten');
    expect(map.get('musik_bewegung')).toBe('Musik & Bewegung');
  });

  it('area_label_de takes precedence over title_de', () => {
    const rows = [
      {
        area_slug: 'sport',
        title_de: 'Sport & Fitness Berufsausbildung',
        search_config: { area_slug: 'sport', area_label_de: 'Sport & Fitness' },
      },
    ];
    const map = buildLabelMap(rows);
    expect(map.get('sport')).toBe('Sport & Fitness');
    expect(map.get('sport')).not.toBe('Sport & Fitness Berufsausbildung');
  });
});

// ============================================================
// 8. Delivery: validatePredefinedSearches rejects in_person
// ============================================================

import { validatePredefinedSearches } from '../api/_lib/theme-world-validate.js';

describe('validatePredefinedSearches — canonical delivery values', () => {
  it('accepts presence (canonical)', () => {
    const errors = validatePredefinedSearches([
      { label_de: 'Vor-Ort Kurs', delivery: 'presence' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('rejects in_person (alias, not canonical)', () => {
    const errors = validatePredefinedSearches([
      { label_de: 'Vor-Ort Kurs', delivery: 'in_person' },
    ]);
    expect(errors.some(e => e.includes('delivery'))).toBe(true);
  });

  it('accepts online_live', () => {
    const errors = validatePredefinedSearches([
      { label_de: 'Online Kurs', delivery: 'online_live' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('accepts self_study', () => {
    const errors = validatePredefinedSearches([
      { label_de: 'Selbststudium', delivery: 'self_study' },
    ]);
    expect(errors).toHaveLength(0);
  });
});
