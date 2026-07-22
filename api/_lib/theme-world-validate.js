/**
 * Serverseitige Validierungsschemas für das Themenwelten-System.
 *
 * Alle Validierungsfunktionen sind pure Funktionen ohne Seiteneffekte.
 * Rückgabe: { valid: boolean, errors: string[] }
 *
 * Keine externen Bibliotheken — konsistent mit dem bestehenden Projekt-Pattern.
 */

// ============================================================
// Konstanten
// ============================================================

export const VALID_DB_SEGMENTS = ['professionell', 'privat', 'kinder'];
export const VALID_URL_SEGMENTS = ['beruflich', 'privat-hobby', 'kinder-jugend'];

// Verbindliches Zeichenlimit für meta_title (stimmt mit AdminSeoFields.jsx überein).
// Google kürzt Titel ab ca. 60 Zeichen. UI zeigt dieses Limit als Zeichenzähler.
export const META_TITLE_MAX = 60;
export const VALID_STATUSES = ['draft', 'published', 'archived'];
export const VALID_DELIVERY_TYPES = ['online_live', 'self_study', 'in_person'];
export const VALID_TRUST_ITEM_TYPES = ['label', 'editorial', 'info'];

// Erlaubte Keys in search_config JSONB
const SEARCH_CONFIG_ALLOWED_KEYS = new Set(['area_slug', 'type_key', 'default_spec', 'default_focus']);

// Erlaubte Abschnitts-Keys in section_titles JSONB
const SECTION_TITLES_ALLOWED_KEYS = new Set([
  'scenarioTitle', 'scenarioSubtitle', 'specialtiesTitle', 'specialtiesSubtitle',
  'searchesTitle', 'searchesSubtitle', 'faqTitle', 'trustTitle', 'ctaTitle', 'ctaButton',
]);

// Erlaubte Sprachen in multilang-Objekten
const MULTILANG_KEYS = new Set(['de', 'en', 'fr', 'it']);

// ============================================================
// Hilfsfunktionen
// ============================================================

/**
 * Validiert Slug-Format: nur a-z, 0-9, Bindestriche;
 * kein Führungs-/Abschluss-Bindestrich.
 */
export function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Validiert eine externe URL (muss https:// sein).
 * Ausnahmen: Supabase-Storage-URLs und relative URLs werden nicht erlaubt.
 */
export function isValidExternalUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validiert eine Bild-URL (https oder Supabase Storage-Pfad).
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('/')) return false; // keine relativen Pfade
  return isValidExternalUrl(url);
}

function collect(errors, field, message) {
  errors.push(`${field}: ${message}`);
}

function requireText(errors, obj, field, maxLength) {
  const val = obj[field];
  if (!val || typeof val !== 'string' || !val.trim()) {
    collect(errors, field, 'Pflichtfeld fehlt oder leer.');
  } else if (maxLength && val.length > maxLength) {
    collect(errors, field, `Zu lang (max ${maxLength} Zeichen).`);
  }
}

function optionalText(errors, obj, field, maxLength) {
  const val = obj[field];
  if (val !== undefined && val !== null) {
    if (typeof val !== 'string') {
      collect(errors, field, 'Muss ein String sein.');
    } else if (maxLength && val.length > maxLength) {
      collect(errors, field, `Zu lang (max ${maxLength} Zeichen).`);
    }
  }
}

// ============================================================
// JSONB-Schema-Validierungen
// ============================================================

/**
 * Validiert search_config JSONB.
 * Pflicht: area_slug. Optional: type_key, default_spec, default_focus.
 */
export function validateSearchConfig(config) {
  const errors = [];
  if (config === null || config === undefined) return errors; // optional

  if (typeof config !== 'object' || Array.isArray(config)) {
    errors.push('search_config: Muss ein Objekt sein.');
    return errors;
  }

  // Unbekannte Keys ablehnen
  for (const key of Object.keys(config)) {
    if (!SEARCH_CONFIG_ALLOWED_KEYS.has(key)) {
      errors.push(`search_config.${key}: Unbekannter Key nicht erlaubt.`);
    }
  }

  if (!config.area_slug || typeof config.area_slug !== 'string') {
    errors.push('search_config.area_slug: Pflichtfeld fehlt.');
  }

  if (config.type_key !== undefined) {
    if (!['beruflich', 'privat_hobby', 'kinder_jugend'].includes(config.type_key)) {
      errors.push('search_config.type_key: Ungültiger Wert. Erlaubt: beruflich, privat_hobby, kinder_jugend.');
    }
  }

  return errors;
}

/**
 * Validiert section_titles JSONB.
 * Nur bekannte Abschnitts-Keys erlaubt; Werte müssen multilang-Objekte sein.
 */
export function validateSectionTitles(titles) {
  const errors = [];
  if (titles === null || titles === undefined) return errors;

  if (typeof titles !== 'object' || Array.isArray(titles)) {
    errors.push('section_titles: Muss ein Objekt sein.');
    return errors;
  }

  for (const [key, val] of Object.entries(titles)) {
    if (!SECTION_TITLES_ALLOWED_KEYS.has(key)) {
      errors.push(`section_titles.${key}: Unbekannter Key nicht erlaubt.`);
      continue;
    }
    if (typeof val !== 'object' || Array.isArray(val) || val === null) {
      errors.push(`section_titles.${key}: Muss ein {de?, en?, fr?, it?}-Objekt sein.`);
      continue;
    }
    for (const [lang, text] of Object.entries(val)) {
      if (!MULTILANG_KEYS.has(lang)) {
        errors.push(`section_titles.${key}.${lang}: Unbekannte Sprache. Erlaubt: de, en, fr, it.`);
      } else if (typeof text !== 'string') {
        errors.push(`section_titles.${key}.${lang}: Muss ein String sein.`);
      } else if (text.length > 200) {
        errors.push(`section_titles.${key}.${lang}: Zu lang (max 200 Zeichen).`);
      }
    }
  }

  return errors;
}

/**
 * Validiert predefined_searches JSONB-Array.
 */
export function validatePredefinedSearches(searches) {
  const errors = [];
  if (searches === null || searches === undefined) return errors;

  if (!Array.isArray(searches)) {
    errors.push('predefined_searches: Muss ein Array sein.');
    return errors;
  }

  if (searches.length > 20) {
    errors.push('predefined_searches: Maximal 20 Einträge erlaubt.');
  }

  const ALLOWED_KEYS = new Set(['label_de', 'spec', 'focus', 'loc', 'delivery']);

  for (let i = 0; i < searches.length; i++) {
    const item = searches[i];
    if (typeof item !== 'object' || Array.isArray(item) || item === null) {
      errors.push(`predefined_searches[${i}]: Muss ein Objekt sein.`);
      continue;
    }

    // Unbekannte Keys ablehnen
    for (const key of Object.keys(item)) {
      if (!ALLOWED_KEYS.has(key)) {
        errors.push(`predefined_searches[${i}].${key}: Unbekannter Key nicht erlaubt.`);
      }
    }

    if (!item.label_de || typeof item.label_de !== 'string') {
      errors.push(`predefined_searches[${i}].label_de: Pflichtfeld fehlt.`);
    } else if (item.label_de.length > 80) {
      errors.push(`predefined_searches[${i}].label_de: Zu lang (max 80 Zeichen).`);
    }

    if (item.delivery !== undefined && !VALID_DELIVERY_TYPES.includes(item.delivery)) {
      errors.push(`predefined_searches[${i}].delivery: Ungültiger Wert. Erlaubt: ${VALID_DELIVERY_TYPES.join(', ')}.`);
    }
  }

  return errors;
}

/**
 * Validiert cta_links JSONB-Array.
 */
export function validateCtaLinks(links) {
  const errors = [];
  if (links === null || links === undefined) return errors;

  if (!Array.isArray(links)) {
    errors.push('cta_links: Muss ein Array sein.');
    return errors;
  }

  if (links.length > 5) {
    errors.push('cta_links: Maximal 5 Einträge erlaubt.');
  }

  const ALLOWED_KEYS = new Set(['label_de', 'loc', 'delivery']);

  for (let i = 0; i < links.length; i++) {
    const item = links[i];
    if (typeof item !== 'object' || Array.isArray(item) || item === null) {
      errors.push(`cta_links[${i}]: Muss ein Objekt sein.`);
      continue;
    }

    for (const key of Object.keys(item)) {
      if (!ALLOWED_KEYS.has(key)) {
        errors.push(`cta_links[${i}].${key}: Unbekannter Key nicht erlaubt.`);
      }
    }

    if (!item.label_de || typeof item.label_de !== 'string') {
      errors.push(`cta_links[${i}].label_de: Pflichtfeld fehlt.`);
    } else if (item.label_de.length > 60) {
      errors.push(`cta_links[${i}].label_de: Zu lang (max 60 Zeichen).`);
    }

    if (item.delivery !== undefined && !VALID_DELIVERY_TYPES.includes(item.delivery)) {
      errors.push(`cta_links[${i}].delivery: Ungültiger Wert. Erlaubt: ${VALID_DELIVERY_TYPES.join(', ')}.`);
    }
  }

  return errors;
}

/**
 * Validiert cta_config JSONB eines Szenario-Artikels.
 */
export function validateCtaConfig(config) {
  const errors = [];
  if (config === null || config === undefined) return errors;

  if (typeof config !== 'object' || Array.isArray(config)) {
    errors.push('cta_config: Muss ein Objekt sein.');
    return errors;
  }

  const ALLOWED_KEYS = new Set(['spec', 'focus', 'loc', 'delivery']);
  for (const key of Object.keys(config)) {
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(`cta_config.${key}: Unbekannter Key nicht erlaubt.`);
    }
  }

  if (config.delivery !== undefined && !VALID_DELIVERY_TYPES.includes(config.delivery)) {
    errors.push(`cta_config.delivery: Ungültiger Wert. Erlaubt: ${VALID_DELIVERY_TYPES.join(', ')}.`);
  }

  return errors;
}

// ============================================================
// Entitäts-Validierungen
// ============================================================

/**
 * Validiert die Grundfelder einer Themenwelt (CREATE/UPDATE).
 */
export function validateThemeWorldBase(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Kein gültiger Request-Body.'] };
  }

  // Pflichtfelder
  requireText(errors, data, 'key', 100);
  requireText(errors, data, 'title_de', 200);
  requireText(errors, data, 'area_slug', 100);

  // Segment
  if (!VALID_DB_SEGMENTS.includes(data.db_segment)) {
    collect(errors, 'db_segment', `Ungültiger Wert. Erlaubt: ${VALID_DB_SEGMENTS.join(', ')}.`);
  }
  if (!VALID_URL_SEGMENTS.includes(data.url_segment)) {
    collect(errors, 'url_segment', `Ungültiger Wert. Erlaubt: ${VALID_URL_SEGMENTS.join(', ')}.`);
  }

  // Konsistenz db_segment ↔ url_segment
  const SEGMENT_MAP = { professionell: 'beruflich', privat: 'privat-hobby', kinder: 'kinder-jugend' };
  if (data.db_segment && data.url_segment && SEGMENT_MAP[data.db_segment] !== data.url_segment) {
    collect(errors, 'db_segment/url_segment', `Inkonsistentes Segment-Paar: ${data.db_segment} → ${data.url_segment} erwartet, nicht ${data.url_segment}.`);
  }

  // Slug
  if (!isValidSlug(data.slug)) {
    collect(errors, 'slug', 'Ungültiges Slug-Format. Nur a-z, 0-9, Bindestriche erlaubt (kein Führungs-/Abschluss-Bindestrich).');
  }

  // Optionale Text-Felder
  optionalText(errors, data, 'subtitle_de', 400);
  optionalText(errors, data, 'intro_de', 5000);
  optionalText(errors, data, 'meta_title', META_TITLE_MAX);
  optionalText(errors, data, 'meta_description', 160);
  optionalText(errors, data, 'hero_image_alt_de', 200);
  optionalText(errors, data, 'og_image_alt_de', 200);

  // Bild-URLs
  if (data.hero_image_url && !isValidImageUrl(data.hero_image_url)) {
    collect(errors, 'hero_image_url', 'Muss eine gültige https://-URL sein.');
  }
  if (data.og_image_url && !isValidImageUrl(data.og_image_url)) {
    collect(errors, 'og_image_url', 'Muss eine gültige https://-URL sein.');
  }

  // Hero Alt-Text ist Pflicht wenn Hero-Bild gesetzt
  if (data.hero_image_url && (!data.hero_image_alt_de || !data.hero_image_alt_de.trim())) {
    collect(errors, 'hero_image_alt_de', 'Pflicht wenn hero_image_url gesetzt ist.');
  }

  // JSONB-Felder
  errors.push(...validateSearchConfig(data.search_config));
  errors.push(...validateSectionTitles(data.section_titles));
  errors.push(...validatePredefinedSearches(data.predefined_searches));
  errors.push(...validateCtaLinks(data.cta_links));

  // Sort-Order
  if (data.sort_order !== undefined && (!Number.isInteger(data.sort_order) || data.sort_order < 0)) {
    collect(errors, 'sort_order', 'Muss eine nicht-negative ganze Zahl sein.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Partial-Validator für UPDATE-Requests (Patch-Semantik).
 *
 * Pflichtfelder (key, title_de, area_slug, db_segment, url_segment, slug) werden
 * NUR geprüft, wenn sie im Payload vorhanden sind. Tabs können dadurch ihren
 * jeweiligen Feldbereich separat speichern, ohne alle Grundfelder mitsenden zu müssen.
 *
 * Optionale Felder und JSONB-Blöcke werden wie in validateThemeWorldBase geprüft,
 * aber ebenfalls nur wenn sie im Payload vorhanden sind.
 */
export function validateThemeWorldUpdate(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Kein gültiger Request-Body.'] };
  }

  // Pflichtfelder — nur validieren wenn im Payload enthalten
  if ('key' in data) requireText(errors, data, 'key', 100);
  if ('title_de' in data) requireText(errors, data, 'title_de', 200);
  if ('area_slug' in data) requireText(errors, data, 'area_slug', 100);

  // Segment-Werte — nur validieren wenn vorhanden
  if ('db_segment' in data && !VALID_DB_SEGMENTS.includes(data.db_segment)) {
    collect(errors, 'db_segment', `Ungültiger Wert. Erlaubt: ${VALID_DB_SEGMENTS.join(', ')}.`);
  }
  if ('url_segment' in data && !VALID_URL_SEGMENTS.includes(data.url_segment)) {
    collect(errors, 'url_segment', `Ungültiger Wert. Erlaubt: ${VALID_URL_SEGMENTS.join(', ')}.`);
  }

  // Segment-Konsistenz — nur wenn BEIDE Felder im Payload sind
  const SEGMENT_MAP = { professionell: 'beruflich', privat: 'privat-hobby', kinder: 'kinder-jugend' };
  if (data.db_segment && data.url_segment && SEGMENT_MAP[data.db_segment] !== data.url_segment) {
    collect(errors, 'db_segment/url_segment', `Inkonsistentes Segment-Paar: ${data.db_segment} erwartet ${SEGMENT_MAP[data.db_segment]}, nicht ${data.url_segment}.`);
  }

  // Slug — nur validieren wenn vorhanden
  if ('slug' in data && !isValidSlug(data.slug)) {
    collect(errors, 'slug', 'Ungültiges Slug-Format. Nur a-z, 0-9, Bindestriche erlaubt (kein Führungs-/Abschluss-Bindestrich).');
  }

  // Optionale Text-Felder
  optionalText(errors, data, 'subtitle_de', 400);
  optionalText(errors, data, 'intro_de', 5000);
  optionalText(errors, data, 'meta_title', META_TITLE_MAX);
  optionalText(errors, data, 'meta_description', 160);
  optionalText(errors, data, 'hero_image_alt_de', 200);
  optionalText(errors, data, 'og_image_alt_de', 200);

  // Bild-URLs
  if (data.hero_image_url && !isValidImageUrl(data.hero_image_url)) {
    collect(errors, 'hero_image_url', 'Muss eine gültige https://-URL sein.');
  }
  if (data.og_image_url && !isValidImageUrl(data.og_image_url)) {
    collect(errors, 'og_image_url', 'Muss eine gültige https://-URL sein.');
  }

  // Hero Alt-Text ist Pflicht wenn hero_image_url in diesem Payload neu gesetzt wird
  if ('hero_image_url' in data && data.hero_image_url && (!data.hero_image_alt_de || !data.hero_image_alt_de.trim())) {
    collect(errors, 'hero_image_alt_de', 'Pflicht wenn hero_image_url gesetzt ist.');
  }

  // JSONB-Felder — nur validieren wenn vorhanden
  if ('search_config' in data) errors.push(...validateSearchConfig(data.search_config));
  if ('section_titles' in data) errors.push(...validateSectionTitles(data.section_titles));
  if ('predefined_searches' in data) errors.push(...validatePredefinedSearches(data.predefined_searches));
  if ('cta_links' in data) errors.push(...validateCtaLinks(data.cta_links));

  // Sort-Order
  if (data.sort_order !== undefined && (!Number.isInteger(data.sort_order) || data.sort_order < 0)) {
    collect(errors, 'sort_order', 'Muss eine nicht-negative ganze Zahl sein.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validiert die Felder eines Szenario-Artikels (CREATE/UPDATE).
 */
export function validateScenario(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Kein gültiger Request-Body.'] };
  }

  requireText(errors, data, 'label_de', 200);

  if (!isValidSlug(data.slug)) {
    collect(errors, 'slug', 'Ungültiges Slug-Format. Nur a-z, 0-9, Bindestriche erlaubt.');
  }

  optionalText(errors, data, 'teaser_de', 300);
  optionalText(errors, data, 'cta_label_de', 100);
  optionalText(errors, data, 'meta_title', META_TITLE_MAX);
  optionalText(errors, data, 'meta_description', 160);
  optionalText(errors, data, 'card_image_alt', 200);

  // Bild-URLs
  if (data.card_image_url && !isValidImageUrl(data.card_image_url)) {
    collect(errors, 'card_image_url', 'Muss eine gültige https://-URL sein.');
  }
  if (data.og_image_url && !isValidImageUrl(data.og_image_url)) {
    collect(errors, 'og_image_url', 'Muss eine gültige https://-URL sein.');
  }

  // Alt-Text ist Pflicht wenn Karten-Bild gesetzt
  if (data.card_image_url && (!data.card_image_alt || !data.card_image_alt.trim())) {
    collect(errors, 'card_image_alt', 'Pflicht wenn card_image_url gesetzt ist.');
  }

  // sort_order
  if (data.sort_order !== undefined && (!Number.isInteger(data.sort_order) || data.sort_order < 0)) {
    collect(errors, 'sort_order', 'Muss eine nicht-negative ganze Zahl sein.');
  }

  // JSONB
  errors.push(...validateCtaConfig(data.cta_config));

  return { valid: errors.length === 0, errors };
}

/**
 * Validiert einen FAQ-Eintrag.
 */
export function validateFaq(data) {
  const errors = [];
  requireText(errors, data, 'question_de', 500);
  requireText(errors, data, 'answer_de', 5000);
  if (data.sort_order !== undefined && (!Number.isInteger(data.sort_order) || data.sort_order < 0)) {
    collect(errors, 'sort_order', 'Muss eine nicht-negative ganze Zahl sein.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validiert eine redaktionelle Sektion.
 */
export function validateEditorialSection(data) {
  const errors = [];
  requireText(errors, data, 'heading_de', 200);
  optionalText(errors, data, 'intro_de', 2000);
  optionalText(errors, data, 'closing_de', 2000);

  if (data.items_de !== undefined && data.items_de !== null) {
    if (!Array.isArray(data.items_de)) {
      collect(errors, 'items_de', 'Muss ein Array von Strings sein.');
    } else {
      for (let i = 0; i < data.items_de.length; i++) {
        if (typeof data.items_de[i] !== 'string') {
          collect(errors, `items_de[${i}]`, 'Muss ein String sein.');
        } else if (data.items_de[i].length > 500) {
          collect(errors, `items_de[${i}]`, 'Zu lang (max 500 Zeichen).');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validiert eine Specialty-Zuweisung.
 */
export function validateSpecialty(data) {
  const errors = [];
  requireText(errors, data, 'specialty_label', 300);
  optionalText(errors, data, 'description_de', 500);
  return { valid: errors.length === 0, errors };
}

/**
 * Validiert einen Regionslink.
 */
export function validateRegion(data) {
  const errors = [];
  requireText(errors, data, 'label_de', 100);

  // Mindestens loc_param oder delivery_param muss gesetzt sein
  const hasLoc = data.loc_param && typeof data.loc_param === 'string' && data.loc_param.trim();
  const hasDelivery = data.delivery_param && VALID_DELIVERY_TYPES.includes(data.delivery_param);

  if (!hasLoc && !hasDelivery) {
    collect(errors, 'loc_param/delivery_param', 'Mindestens loc_param oder delivery_param muss gesetzt sein.');
  }

  if (data.delivery_param && !VALID_DELIVERY_TYPES.includes(data.delivery_param)) {
    collect(errors, 'delivery_param', `Ungültiger Wert. Erlaubt: ${VALID_DELIVERY_TYPES.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validiert ein Trust-Item.
 */
export function validateTrustItem(data) {
  const errors = [];
  requireText(errors, data, 'name', 200);
  optionalText(errors, data, 'description_de', 1000);

  if (!VALID_TRUST_ITEM_TYPES.includes(data.item_type)) {
    collect(errors, 'item_type', `Ungültiger Wert. Erlaubt: ${VALID_TRUST_ITEM_TYPES.join(', ')}.`);
  }

  if (data.logo_url && !isValidImageUrl(data.logo_url)) {
    collect(errors, 'logo_url', 'Muss eine gültige https://-URL sein.');
  }

  // logo_alt ist Pflicht wenn logo_url gesetzt
  if (data.logo_url && (!data.logo_alt || !data.logo_alt.trim())) {
    collect(errors, 'logo_alt', 'Pflicht wenn logo_url gesetzt ist.');
  }

  if (data.external_url && !isValidExternalUrl(data.external_url)) {
    collect(errors, 'external_url', 'Muss eine gültige https://-URL sein.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validiert ein Sortier-Reorder-Array: [{id, sort_order}].
 */
export function validateSortReorder(items) {
  const errors = [];
  if (!Array.isArray(items)) {
    return { valid: false, errors: ['Muss ein Array sein.'] };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      errors.push(`items[${i}]: Muss ein Objekt sein.`);
      continue;
    }
    if (!item.id || typeof item.id !== 'string') {
      errors.push(`items[${i}].id: Pflichtfeld fehlt oder kein String.`);
    }
    if (!Number.isInteger(item.sort_order) || item.sort_order < 0) {
      errors.push(`items[${i}].sort_order: Muss eine nicht-negative ganze Zahl sein.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Publish-Gate-Validierungen
// ============================================================

/**
 * Prüft ob eine Themenwelt publiziert werden darf.
 * Wird vor der Statusänderung auf 'published' ausgeführt.
 *
 * @param {object} themeWorld - Vollständiger Datensatz aus der DB
 * @param {object} [opts]
 * @param {boolean} [opts.requireSearchConfig=true] - ob search_config Pflicht ist
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePublishThemeWorld(themeWorld, opts = {}) {
  const errors = [];
  const requireSearchConfig = opts.requireSearchConfig !== false;

  if (!themeWorld) {
    return { valid: false, errors: ['Themenwelt nicht gefunden.'] };
  }

  // Pflichtfelder für Publikation
  if (!themeWorld.title_de?.trim()) {
    errors.push('title_de: Pflichtfeld fehlt. Kein Publish ohne deutschen Titel.');
  }

  if (!isValidSlug(themeWorld.slug)) {
    errors.push('slug: Ungültiges Format. Kanonischer Pfad muss gültig sein.');
  }

  if (!themeWorld.url_segment || !VALID_URL_SEGMENTS.includes(themeWorld.url_segment)) {
    errors.push('url_segment: Ungültiger oder fehlender Wert.');
  }

  if (!themeWorld.db_segment || !VALID_DB_SEGMENTS.includes(themeWorld.db_segment)) {
    errors.push('db_segment: Ungültiger oder fehlender Wert.');
  }

  // Mindestens Subtitle oder Intro-Text
  const hasLeadText = (themeWorld.subtitle_de?.trim()) || (themeWorld.intro_de?.trim());
  if (!hasLeadText) {
    errors.push('subtitle_de / intro_de: Mindestens eines der beiden Pflichtfelder muss einen Text enthalten.');
  }

  // Suchkonfiguration (wenn gefordert)
  if (requireSearchConfig) {
    if (!themeWorld.search_config || !themeWorld.search_config.area_slug) {
      errors.push('search_config.area_slug: Pflichtfeld fehlt. Suchkonfiguration ist für Publikation erforderlich.');
    }
  }

  // Hero-Bild: wenn gesetzt, muss Alt-Text vorhanden sein
  if (themeWorld.hero_image_url && !themeWorld.hero_image_alt_de?.trim()) {
    errors.push('hero_image_alt_de: Pflicht wenn hero_image_url gesetzt ist.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Prüft ob ein Szenario-Artikel publiziert werden darf.
 *
 * @param {object} scenario - Vollständiger Datensatz aus der DB
 * @param {object} parentThemeWorld - Zugehörige Themenwelt aus der DB
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePublishScenario(scenario, parentThemeWorld) {
  const errors = [];

  if (!scenario) {
    return { valid: false, errors: ['Szenario nicht gefunden.'] };
  }

  // Eltern-Themenwelt muss publiziert sein
  if (!parentThemeWorld || parentThemeWorld.status !== 'published') {
    errors.push('theme_world: Die zugehörige Themenwelt muss publiziert sein, bevor ein Szenario veröffentlicht werden kann.');
  }

  // Pflichtfelder
  if (!scenario.label_de?.trim()) {
    errors.push('label_de: Pflichtfeld fehlt.');
  }

  if (!isValidSlug(scenario.slug)) {
    errors.push('slug: Ungültiges Slug-Format.');
  }

  if (!scenario.teaser_de?.trim()) {
    errors.push('teaser_de: Pflichtfeld fehlt. Kurztext ist für Publikation erforderlich.');
  }

  if (!scenario.content_html?.trim()) {
    errors.push('content_html: Pflichtfeld fehlt. Artikel-Inhalt ist für Publikation erforderlich.');
  }

  // Alt-Text bei Karten-Bild
  if (scenario.card_image_url && !scenario.card_image_alt?.trim()) {
    errors.push('card_image_alt: Pflicht wenn card_image_url gesetzt ist.');
  }

  return { valid: errors.length === 0, errors };
}
