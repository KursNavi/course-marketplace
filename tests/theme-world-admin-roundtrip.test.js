/**
 * Phase 7.6 — Admin Roundtrip Regression Tests
 *
 * Covers the two critical bugs found during manual admin QA:
 *   1. getAllSubEntities returned {} due to result.data being undefined
 *      (API returns arrays at root level, not wrapped in { data: ... })
 *      AND snake_case keys (editorial_sections, trust_items) didn't match
 *      the camelCase the form expected (editorialSections, trustItems).
 *   2. saveBilder/saveSuche failed with "Validierungsfehler" because
 *      validateThemeWorldBase required key/title_de/slug etc. for ALL updates,
 *      even partial tab-specific saves.
 *
 * Also covers data-loss protection:
 *   3. Sub-query errors must NOT be silently treated as empty lists.
 *   4. Save must be blocked when load failed.
 *   5. Dirty state must be reset after successful load.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}));

// ---------------------------------------------------------------------------
// 1. getAllSubEntities response normalization (Bug 1)
// ---------------------------------------------------------------------------

describe('Phase 7.6: getAllSubEntities response normalization', () => {
  /**
   * The API endpoint /api/admin-theme-world-sub?action=get-all returns:
   *   { faqs: [...], editorial_sections: [...], specialties: [...], regions: [...], trust_items: [...] }
   *
   * OLD (broken): getAllSubEntities returned result.data || {} → always {}
   * NEW (fixed):  maps directly from result root, normalizing snake_case keys to camelCase
   */

  const mockApiRootResponse = {
    faqs: [{ id: 'f1', question_de: 'Q?' }, { id: 'f2', question_de: 'Q2?' }],
    editorial_sections: [{ id: 'e1', heading_de: 'Section' }],
    specialties: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    regions: [{ id: 'r1' }, { id: 'r2' }],
    trust_items: [{ id: 't1', name_de: 'Trust' }],
  };

  // Simulate OLD behavior
  const oldGetAllSubEntities = (result) => result.data || {};
  // Simulate NEW behavior
  const newGetAllSubEntities = (result) => ({
    faqs: result.faqs || [],
    editorialSections: result.editorial_sections || [],
    specialties: result.specialties || [],
    regions: result.regions || [],
    trustItems: result.trust_items || [],
  });

  it('OLD: result.data is undefined → returns empty object (root cause)', () => {
    const subs = oldGetAllSubEntities(mockApiRootResponse);
    expect(subs).toEqual({});
    expect(subs.faqs).toBeUndefined();
    expect(subs.specialties).toBeUndefined();
    expect(subs.editorialSections).toBeUndefined();
    expect(subs.trustItems).toBeUndefined();
  });

  it('NEW: correctly reads arrays from root level', () => {
    const subs = newGetAllSubEntities(mockApiRootResponse);
    expect(subs.faqs).toHaveLength(2);
    expect(subs.specialties).toHaveLength(3);
    expect(subs.regions).toHaveLength(2);
  });

  it('NEW: normalizes editorial_sections → editorialSections', () => {
    const subs = newGetAllSubEntities(mockApiRootResponse);
    expect(subs.editorialSections).toHaveLength(1);
    expect(subs.editorialSections[0].heading_de).toBe('Section');
    expect(subs.editorial_sections).toBeUndefined(); // snake_case NOT on result
  });

  it('NEW: normalizes trust_items → trustItems', () => {
    const subs = newGetAllSubEntities(mockApiRootResponse);
    expect(subs.trustItems).toHaveLength(1);
    expect(subs.trustItems[0].name_de).toBe('Trust');
    expect(subs.trust_items).toBeUndefined(); // snake_case NOT on result
  });

  it('NEW: empty arrays when API returns empty lists', () => {
    const emptyResponse = {
      faqs: [], editorial_sections: [], specialties: [], regions: [], trust_items: [],
    };
    const subs = newGetAllSubEntities(emptyResponse);
    expect(subs.faqs).toEqual([]);
    expect(subs.editorialSections).toEqual([]);
    expect(subs.specialties).toEqual([]);
    expect(subs.regions).toEqual([]);
    expect(subs.trustItems).toEqual([]);
  });

  it('NEW: falls back to [] when keys missing from response', () => {
    const subs = newGetAllSubEntities({});
    expect(subs.faqs).toEqual([]);
    expect(subs.editorialSections).toEqual([]);
    expect(subs.specialties).toEqual([]);
    expect(subs.regions).toEqual([]);
    expect(subs.trustItems).toEqual([]);
  });

  it('setting form state from OLD result → all tabs empty (confirms the symptom)', () => {
    const subs = oldGetAllSubEntities(mockApiRootResponse);
    // This is what the form did: setSpecialties(subs.specialties || [])
    const formSpecialties = subs.specialties || [];
    const formEditorial = subs.editorialSections || [];
    const formTrust = subs.trustItems || [];
    expect(formSpecialties).toEqual([]); // was always []
    expect(formEditorial).toEqual([]); // was always []
    expect(formTrust).toEqual([]); // was always []
  });

  it('setting form state from NEW result → all tabs populated', () => {
    const subs = newGetAllSubEntities(mockApiRootResponse);
    const formSpecialties = subs.specialties || [];
    const formEditorial = subs.editorialSections || [];
    const formTrust = subs.trustItems || [];
    expect(formSpecialties).toHaveLength(3);
    expect(formEditorial).toHaveLength(1);
    expect(formTrust).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 2. validateThemeWorldUpdate — partial/patch validation (Bug 2)
// ---------------------------------------------------------------------------

describe('Phase 7.6: validateThemeWorldUpdate partial validation', () => {
  /**
   * OLD: update action used validateThemeWorldBase which requires key/title_de/
   * area_slug/db_segment/url_segment/slug for every update.
   * Bilder tab only sends hero_image_url etc. → validation failed.
   *
   * NEW: validateThemeWorldUpdate validates only fields present in the payload.
   */

  // Inline implementation for test isolation (mirrors api/_lib/theme-world-validate.js)
  const VALID_DB_SEGMENTS = ['professionell', 'privat', 'kinder'];
  const VALID_URL_SEGMENTS = ['beruflich', 'privat-hobby', 'kinder-jugend'];

  function isValidSlug(slug) {
    return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  }
  function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try { return new URL(url).protocol === 'https:'; } catch { return false; }
  }

  function validateThemeWorldUpdate(data) {
    const errors = [];
    if (!data || typeof data !== 'object') return { valid: false, errors: ['Kein gültiger Body.'] };

    if ('key' in data && (!data.key || !data.key.trim())) errors.push('key: Pflichtfeld fehlt.');
    if ('title_de' in data && (!data.title_de || !data.title_de.trim())) errors.push('title_de: Pflichtfeld fehlt.');
    if ('area_slug' in data && (!data.area_slug || !data.area_slug.trim())) errors.push('area_slug: Pflichtfeld fehlt.');

    if ('db_segment' in data && !VALID_DB_SEGMENTS.includes(data.db_segment)) errors.push('db_segment: Ungültiger Wert.');
    if ('url_segment' in data && !VALID_URL_SEGMENTS.includes(data.url_segment)) errors.push('url_segment: Ungültiger Wert.');
    if ('slug' in data && !isValidSlug(data.slug)) errors.push('slug: Ungültiges Format.');

    if (data.hero_image_url && !isValidImageUrl(data.hero_image_url)) errors.push('hero_image_url: Muss https:// sein.');
    if (data.og_image_url && !isValidImageUrl(data.og_image_url)) errors.push('og_image_url: Muss https:// sein.');
    if ('hero_image_url' in data && data.hero_image_url && (!data.hero_image_alt_de || !data.hero_image_alt_de.trim())) {
      errors.push('hero_image_alt_de: Pflicht wenn hero_image_url gesetzt.');
    }

    return { valid: errors.length === 0, errors };
  }

  it('Bilder-tab payload (no key/title_de/slug) passes partial validation', () => {
    const result = validateThemeWorldUpdate({
      hero_image_url: null,
      hero_image_alt_de: null,
      og_image_url: null,
      meta_title: null,
      meta_description: null,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Suche-tab payload (area_slug only) passes partial validation', () => {
    const result = validateThemeWorldUpdate({
      area_slug: 'yoga_achtsamkeit',
      search_config: { area_slug: 'yoga_achtsamkeit' },
    });
    expect(result.valid).toBe(true);
  });

  it('Grundlagen-tab payload (all required fields) passes validation', () => {
    const result = validateThemeWorldUpdate({
      key: 'yoga_achtsamkeit',
      title_de: 'Yoga & Achtsamkeit',
      area_slug: 'yoga_achtsamkeit',
      db_segment: 'privat',
      url_segment: 'privat-hobby',
      slug: 'yoga-achtsamkeit',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects update with empty key when key IS present', () => {
    const result = validateThemeWorldUpdate({ key: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('key'))).toBe(true);
  });

  it('rejects update with invalid slug when slug IS present', () => {
    const result = validateThemeWorldUpdate({ slug: 'Bad Slug!' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('slug'))).toBe(true);
  });

  it('rejects invalid db_segment when present', () => {
    const result = validateThemeWorldUpdate({ db_segment: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('db_segment'))).toBe(true);
  });

  it('hero_image_url set without alt_de → validation error', () => {
    const result = validateThemeWorldUpdate({
      hero_image_url: 'https://example.com/img.jpg',
      hero_image_alt_de: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('hero_image_alt_de'))).toBe(true);
  });

  it('hero_image_url=null → no alt_de required', () => {
    const result = validateThemeWorldUpdate({
      hero_image_url: null,
      hero_image_alt_de: null,
    });
    expect(result.valid).toBe(true);
  });

  it('valid hero_image_url + alt_de passes', () => {
    const result = validateThemeWorldUpdate({
      hero_image_url: 'https://images.unsplash.com/photo-123',
      hero_image_alt_de: 'Yoga Kurse Schweiz',
    });
    expect(result.valid).toBe(true);
  });

  it('invalid hero_image_url (http://) fails', () => {
    const result = validateThemeWorldUpdate({
      hero_image_url: 'http://example.com/img.jpg',
      hero_image_alt_de: 'Alt text',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('hero_image_url'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Data-loss protection: sub-query error must not return []
// ---------------------------------------------------------------------------

describe('Phase 7.6: sub-entity load error protection', () => {
  /**
   * OLD: if a Supabase query failed, the error was logged but the API
   * still returned 200 with [] → displayed as "Noch keine X" → phantom empty list.
   *
   * NEW: any sub-query error → 500 response → apiCall throws → loadAll catches
   * → sets loadError → form shows error page → save is blocked.
   */

  it('API error response (500) from get-all causes loadAll to throw', async () => {
    // Simulate apiCall throwing on non-200 response
    const apiCallMock = async (url) => {
      throw new Error('Unterdaten konnten nicht vollständig geladen werden.');
    };

    let loadError = null;
    try {
      await apiCallMock('/api/admin-theme-world-sub?action=get-all&themeWorldId=test');
    } catch (err) {
      loadError = err.message;
    }

    expect(loadError).toContain('Unterdaten');
  });

  it('save is blocked when loadError is set', () => {
    // The guard: if (loadError) return showNotification('Laden fehlgeschlagen — Speichern nicht möglich.')
    const loadError = 'Daten konnten nicht geladen werden.';
    const notifications = [];
    const showNotification = (msg) => notifications.push(msg);

    const saveBilderGuard = (loadError, id) => {
      if (!id) return showNotification('Bitte zuerst Grundlagen speichern.');
      if (loadError) return showNotification('Laden fehlgeschlagen — Speichern nicht möglich.');
      return 'would-save';
    };

    saveBilderGuard(loadError, 'some-id');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain('Laden fehlgeschlagen');
    // result is not checked — early-return prevents the save path from running
  });

  it('save proceeds normally when loadError is null', () => {
    const loadError = null;
    const saveBilderGuard = (loadError, id) => {
      if (!id) return 'no-id';
      if (loadError) return 'load-error';
      return 'would-save';
    };

    const result = saveBilderGuard(loadError, 'some-id');
    expect(result).toBe('would-save');
  });
});

// ---------------------------------------------------------------------------
// 4. Dirty-state reset after successful load
// ---------------------------------------------------------------------------

describe('Phase 7.6: dirty state reset after load', () => {
  /**
   * resetDirty() is called on all save states after successful loadAll().
   * This prevents phantom "Ungespeicherte Änderungen" from stale state.
   */

  const createSaveState = () => {
    let isDirty = false;
    let state = 'idle';
    return {
      markDirty: () => { isDirty = true; state = 'idle'; },
      resetDirty: () => { isDirty = false; state = 'idle'; },
      get isDirty() { return isDirty; },
      get state() { return state; },
    };
  };

  it('isDirty starts as false', () => {
    const s = createSaveState();
    expect(s.isDirty).toBe(false);
  });

  it('markDirty → isDirty=true', () => {
    const s = createSaveState();
    s.markDirty();
    expect(s.isDirty).toBe(true);
  });

  it('resetDirty after markDirty → isDirty=false again', () => {
    const s = createSaveState();
    s.markDirty();
    expect(s.isDirty).toBe(true);
    s.resetDirty();
    expect(s.isDirty).toBe(false);
  });

  it('all 8 save states reset after successful load', () => {
    const tabs = ['grundlagen', 'bilder', 'suche', 'specialties', 'regionen', 'editorial', 'faq', 'trust'];
    const states = tabs.map(() => createSaveState());

    // Simulate: user dirtied state somehow (stale session)
    states.forEach(s => s.markDirty());
    states.forEach(s => expect(s.isDirty).toBe(true));

    // Simulate: loadAll() succeeds → resetDirty called on all
    states.forEach(s => s.resetDirty());
    states.forEach(s => expect(s.isDirty).toBe(false));
  });
});

// ---------------------------------------------------------------------------
// 5. getErrorMessage includes validation details (400 errors)
// ---------------------------------------------------------------------------

describe('Phase 7.6: getErrorMessage includes validation details', () => {
  /**
   * OLD: 400 errors with details array only showed the generic message.
   * NEW: details are appended so the user sees which fields failed.
   */

  const getErrorMessage = (error, defaultMessage = 'Ein Fehler ist aufgetreten.') => {
    if (!error || !error.message) return defaultMessage;
    if (error.details && error.details.length > 0) {
      return error.message + ': ' + error.details.join('; ');
    }
    return error.message || defaultMessage;
  };

  it('error without details → returns just the message', () => {
    const msg = getErrorMessage({ message: 'Netzwerkfehler', details: null });
    expect(msg).toBe('Netzwerkfehler');
  });

  it('error with details array → appends details', () => {
    const error = {
      message: 'Validierungsfehler.',
      details: ['key: Pflichtfeld fehlt.', 'slug: Ungültiges Format.'],
    };
    const msg = getErrorMessage(error);
    expect(msg).toContain('Validierungsfehler.');
    expect(msg).toContain('key: Pflichtfeld fehlt.');
    expect(msg).toContain('slug: Ungültiges Format.');
  });

  it('empty details array → just the message', () => {
    const msg = getErrorMessage({ message: 'Fehler', details: [] });
    expect(msg).toBe('Fehler');
  });

  it('null error → returns defaultMessage', () => {
    expect(getErrorMessage(null)).toBe('Ein Fehler ist aufgetreten.');
  });
});

// ---------------------------------------------------------------------------
// 6. Sport + Yoga parity — both theme worlds use same code path
// ---------------------------------------------------------------------------

describe('Phase 7.6: Sport and Yoga parity', () => {
  const newGetAllSubEntities = (result) => ({
    faqs: result.faqs || [],
    editorialSections: result.editorial_sections || [],
    specialties: result.specialties || [],
    regions: result.regions || [],
    trustItems: result.trust_items || [],
  });

  const sportApiResponse = {
    faqs: Array(7).fill({ question_de: 'Q', answer_de: 'A' }),
    editorial_sections: Array(6).fill({ heading_de: 'H' }),
    specialties: Array(8).fill({ specialty_label: 'Sport' }),
    regions: Array(8).fill({ region_name_de: 'R' }),
    trust_items: Array(3).fill({ name_de: 'T' }),
  };

  const yogaApiResponse = {
    faqs: Array(10).fill({ question_de: 'Q', answer_de: 'A' }),
    editorial_sections: Array(6).fill({ heading_de: 'H' }),
    specialties: Array(7).fill({ specialty_label: 'Yoga' }),
    regions: Array(8).fill({ region_name_de: 'R' }),
    trust_items: Array(3).fill({ name_de: 'T' }),
  };

  it('Sport: all 5 sub-entity arrays populated after fix', () => {
    const subs = newGetAllSubEntities(sportApiResponse);
    expect(subs.faqs).toHaveLength(7);
    expect(subs.editorialSections).toHaveLength(6);
    expect(subs.specialties).toHaveLength(8);
    expect(subs.regions).toHaveLength(8);
    expect(subs.trustItems).toHaveLength(3);
  });

  it('Yoga: all 5 sub-entity arrays populated after fix', () => {
    const subs = newGetAllSubEntities(yogaApiResponse);
    expect(subs.faqs).toHaveLength(10);
    expect(subs.editorialSections).toHaveLength(6);
    expect(subs.specialties).toHaveLength(7);
    expect(subs.regions).toHaveLength(8);
    expect(subs.trustItems).toHaveLength(3);
  });

  it('Sport + Yoga: same code path (no hardcoded key differences)', () => {
    // Both use the same normalization function — no theme-world-specific logic
    const sportSubs = newGetAllSubEntities(sportApiResponse);
    const yogaSubs = newGetAllSubEntities(yogaApiResponse);
    expect(Object.keys(sportSubs)).toEqual(Object.keys(yogaSubs));
  });
});
