/**
 * Serverseitige Validierungsschemas für das Themenwelten-System.
 *
 * Alle Validierungsfunktionen sind pure Funktionen ohne Seiteneffekte.
 * Rückgabe: { valid: boolean, errors: string[] }
 *
 * Keine externen Bibliotheken — konsistent mit dem bestehenden Projekt-Pattern.
 */

// Quellenangaben teilen sich ein Regelwerk mit dem Frontend (Anzeige) — deshalb
// liegt die Logik in src/lib, genau wie seoUtils.js, das der Prerender mitnutzt.
import { validateScenarioSources } from '../../src/lib/scenarioSources.js';

export { MAX_SOURCES_PER_SCENARIO } from '../../src/lib/scenarioSources.js';

// ============================================================
// Konstanten
// ============================================================

export const VALID_DB_SEGMENTS = ['professionell', 'privat', 'kinder'];
export const VALID_URL_SEGMENTS = ['beruflich', 'privat-hobby', 'kinder-jugend'];

// Verbindliches Zeichenlimit für meta_title (stimmt mit AdminSeoFields.jsx überein).
// Google kürzt Titel ab ca. 60 Zeichen. UI zeigt dieses Limit als Zeichenzähler.
export const META_TITLE_MAX = 60;
export const VALID_STATUSES = ['draft', 'published', 'archived'];
export const VALID_DELIVERY_TYPES = ['online_live', 'self_study', 'presence'];

// Regionslinks speichern den DB-Wert, nicht den Such-URL-Wert.
// theme_world_regions.delivery_param unterliegt der Constraint
// regions_delivery_param_check (20260714_create_theme_worlds.sql:404),
// die 'in_person' erlaubt — nicht 'presence'.
// Der Adapter kanonisiert beim Aufbau des Suchlinks via
// normalizeDeliveryTypeKey: in_person → presence (themeWorldAdapter.js:464).
export const VALID_REGION_DELIVERY_PARAMS = ['online_live', 'self_study', 'in_person'];

export const VALID_TRUST_ITEM_TYPES = ['label', 'editorial', 'info'];

// Erlaubte Keys in search_config JSONB
const SEARCH_CONFIG_ALLOWED_KEYS = new Set(['area_slug', 'type_key', 'kursart', 'default_spec', 'default_focus', 'area_label_de']);

// Erlaubte Abschnitts-Keys in section_titles JSONB.
//
// KANONISCHER DB-VERTRAG: snake_case-Keys mit FLACHEN STRING-Werten.
//   { "trust_heading": "Worauf du achten solltest", "cta_button": "Alle Kurse anzeigen" }
//
// Dieser Vertrag ist verbindlich, weil ihn alle tatsächlichen Datenpfade nutzen:
//   - Importdaten:   data/theme-worlds/*.json (theme_world.section_titles)
//   - Import-RPC:    20260715_import_theme_world_atomic.sql schreibt das JSONB unverändert
//   - Leseseite:     themeWorldAdapter.js liest st.trust_heading / st.cta_heading / …
//
// Der Adapter mappt diese DB-Keys erst für den Renderer auf camelCase-Multilang-
// Objekte (trustTitle: { de }). Diese camelCase-Form ist ADAPTER-AUSGABE, kein
// DB-Format — sie darf hier nicht validiert werden.
//
// Kein camelCase-Fallback: die frühere camelCase-Liste war ein toter Vertragsrest.
// Sie wurde nie von einem Schreibpfad erreicht (der Admin sendete section_titles
// bisher überhaupt nicht, der Import umgeht den JS-Validator via SQL-RPC), sodass
// keine Bestandsdaten im alten Format existieren, die Kompatibilität erfordern.
// Aus demselben Grund fehlt 'editorial_heading': kein Importdatensatz führt den
// Key, kein Schreibpfad erzeugt ihn, und redaktionelle Abschnitte rendern ihre
// eigene heading_de (BereichLandingPage.jsx:641). Ein Key ohne Datenpfad wäre
// ein Vertrag ohne Verwendung.
const SECTION_TITLES_ALLOWED_KEYS = new Set([
  'scenarios_heading', 'scenarios_subheading',
  'specialties_heading', 'specialties_subheading',
  'searches_heading', 'searches_subheading',
  'regions_heading', 'regions_subheading',
  'faqs_heading',
  'trust_heading',
  'cta_heading', 'cta_button',
]);

// Zeichenlimit für einen einzelnen Abschnittstitel.
// Längster Bestandswert (yoga regions_subheading) liegt bei ~108 Zeichen.
export const SECTION_TITLE_MAX = 200;

// Zeichenlimit für theme_world_regions.anchor_text_de — den SEO-Linktext eines
// Regionenlinks. Die DB-Spalte ist `text` und damit unbegrenzt; die Grenze ist
// eine fachliche, keine technische.
//
// Der Wert ist die ausformulierte Variante von label_de (max 100) und darf
// deshalb länger sein. Längster Bestandswert ist 54 Zeichen ("Online-live Yoga-
// und Achtsamkeitskurse in der Schweiz"), das vorbereitete Kreativkurse-Paket
// bleibt unter 30. 200 lässt reichlich Luft und hält zugleich fest, dass hier
// ein Linktext steht und kein Fliesstext.
export const ANCHOR_TEXT_MAX = 200;

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

/**
 * Erkennt vollständig maskiertes HTML (escaped HTML statt echter Markup-Struktur).
 *
 * Gibt true zurück wenn:
 *   - der Text typische strukturelle Tags in escaped Form enthält (&lt;p, &lt;h2, …)
 *   - dabei keine echte HTML-Struktur (öffnende <-Tags) vorhanden ist
 *   - die Escaped-Tags häufig genug sind, um ein vollständig maskiertes Dokument zu signalisieren
 *
 * Gibt false zurück bei normalen Texten wie "2 < 3" (kein strukturiertes escaped HTML).
 *
 * @param {string} html - Zu prüfender Inhalt
 * @returns {boolean}
 */
export function detectEscapedHtmlDocument(html) {
  if (!html || typeof html !== 'string') return false;

  // Match &lt;<tagname> followed by whitespace, >, /, or & (e.g. &lt;p&gt; → after 'p' comes '&')
  const ESCAPED_TAG_PATTERNS = [
    /&lt;p(?:[\s>/]|&)/gi,
    /&lt;h[23456](?:[\s>/]|&)/gi,
    /&lt;ul(?:[\s>/]|&)/gi,
    /&lt;ol(?:[\s>/]|&)/gi,
    /&lt;li(?:[\s>/]|&)/gi,
    /&lt;strong(?:[\s>/]|&)/gi,
    /&lt;em(?:[\s>/]|&)/gi,
  ];

  const escapedCount = ESCAPED_TAG_PATTERNS.reduce((count, rx) => {
    const matches = html.match(rx);
    return count + (matches ? matches.length : 0);
  }, 0);

  // Threshold: mindestens 3 escaped strukturelle Tags
  if (escapedCount < 3) return false;

  // Prüfen ob echte HTML-Struktur vorhanden ist
  const REAL_HTML_PATTERN = /<(?:p|h[23456]|ul|ol|li|strong|em)[\s>/]/i;
  const hasRealHtml = REAL_HTML_PATTERN.test(html);

  // Escaped Dokument erkannt, wenn viele escaped Tags und kein echtes HTML
  return !hasRealHtml;
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
 * Ein Suchraum braucht mindestens einen der beiden Filter: area_slug oder
 * kursart. Damit können Themenwelten auch eine Kursart über mehrere Bereiche
 * hinweg abbilden, ohne einen fachlich falschen Bereich zu erfinden.
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

  const hasAreaSlug = typeof config.area_slug === 'string' && config.area_slug.trim();
  const hasKursart = typeof config.kursart === 'string' && config.kursart.trim();
  if (!hasAreaSlug && !hasKursart) {
    errors.push('search_config: area_slug oder kursart muss gesetzt sein.');
  }

  if (config.area_slug !== undefined && config.area_slug !== null && typeof config.area_slug !== 'string') {
    errors.push('search_config.area_slug: Muss ein String oder null sein.');
  }

  if (config.kursart !== undefined && config.kursart !== null) {
    if (typeof config.kursart !== 'string' || !config.kursart.trim()) {
      errors.push('search_config.kursart: Muss ein nicht leerer String oder null sein.');
    } else if (config.kursart.length > 100) {
      errors.push('search_config.kursart: Zu lang (max 100 Zeichen).');
    }
  }

  if (config.type_key !== undefined) {
    if (!['beruflich', 'privat_hobby', 'kinder_jugend'].includes(config.type_key)) {
      errors.push('search_config.type_key: Ungültiger Wert. Erlaubt: beruflich, privat_hobby, kinder_jugend.');
    }
  }

  if (config.area_label_de !== undefined) {
    const lbl = config.area_label_de;
    if (typeof lbl !== 'string') {
      errors.push('search_config.area_label_de: Muss ein String sein.');
    } else if (lbl.trim().length > 80) {
      errors.push('search_config.area_label_de: Zu lang (max 80 Zeichen).');
    }
  }

  return errors;
}

/**
 * Validiert section_titles JSONB gegen den kanonischen DB-Vertrag.
 *
 * Erlaubt: flaches Objekt mit bekannten snake_case-Keys und String-Werten.
 * Siehe SECTION_TITLES_ALLOWED_KEYS für die Begründung des Vertrags.
 *
 * null als Einzelwert wird als "nicht gesetzt" akzeptiert: JSONB kann diesen
 * Zustand halten und der Adapter behandelt ihn identisch zu einem fehlenden Key
 * (st.trust_heading || null). Das hält den Merge-Pfad im Admin verlustfrei —
 * ein bestehender null-Wert kann unverändert zurückgeschrieben werden.
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
    if (val === null) continue; // "nicht gesetzt" — erlaubt
    if (typeof val !== 'string') {
      errors.push(`section_titles.${key}: Muss ein String sein.`);
      continue;
    }
    if (val.length > SECTION_TITLE_MAX) {
      errors.push(`section_titles.${key}: Zu lang (max ${SECTION_TITLE_MAX} Zeichen).`);
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

  const ALLOWED_KEYS = new Set(['label_de', 'spec', 'focus', 'loc', 'delivery', 'kursart']);

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

/** Maximale Anzahl CTA-Links pro Themenwelt. */
export const MAX_CTA_LINKS = 5;

/**
 * Erlaubte Keys eines cta_links-Eintrags.
 *
 * label_de ist Pflicht, alles andere optional:
 *   spec / focus / loc  Suchparameter des Ziel-Links (Fachrichtung, Schwerpunkt,
 *                       Ort). Sie entsprechen exakt den Parametern, die
 *                       predefined_searches führt — ein CTA-Link ist fachlich
 *                       nichts anderes als eine hervorgehobene vordefinierte
 *                       Suche, und der Adapter baut aus beiden dieselbe URL.
 *   delivery            Durchführungsform (VALID_DELIVERY_TYPES).
 *   sort_order          Redaktionelle Position. Die Array-Reihenfolge bleibt die
 *                       Wahrheit für die Anzeige; sort_order ist der stabile,
 *                       im Importpaket mitgelieferte Ordnungswert und wird
 *                       deshalb nicht verworfen.
 *   status              Redaktioneller Zustand des einzelnen Links aus dem
 *                       Importpaket. Er steuert keine Sichtbarkeit — die hängt
 *                       am Status der Themenwelt — wird aber verlustfrei
 *                       durchgereicht, damit ein Import→Admin→Speichern-Zyklus
 *                       das Paket nicht stillschweigend beschneidet.
 */
const CTA_LINK_ALLOWED_KEYS = new Set([
  'label_de', 'spec', 'focus', 'loc', 'delivery', 'kursart', 'sort_order', 'status',
]);

/**
 * Validiert cta_links JSONB-Array.
 *
 * Der Vertrag ist identisch mit dem, den AdminThemeWorldForm clientseitig prüft.
 *
 * null als Wert eines optionalen Felds ist ausdrücklich erlaubt und bedeutet
 * «nicht gesetzt» — genauso wie ein fehlender Key. Importpakete schreiben diese
 * Felder explizit als null aus; würde der Validator das ablehnen, könnte ein
 * importierter Link im Admin nie wieder gespeichert werden.
 *
 * Diese Funktion validiert nur — sie trimmt und mutiert nicht. Die Normalisierung
 * (trimmen, leere optionale Felder entfernen) passiert im Admin vor dem Speichern.
 */
export function validateCtaLinks(links) {
  const errors = [];
  if (links === null || links === undefined) return errors;

  if (!Array.isArray(links)) {
    errors.push('cta_links: Muss ein Array sein.');
    return errors;
  }

  if (links.length > MAX_CTA_LINKS) {
    errors.push(`cta_links: Maximal ${MAX_CTA_LINKS} Einträge erlaubt.`);
  }

  for (let i = 0; i < links.length; i++) {
    const item = links[i];
    if (typeof item !== 'object' || Array.isArray(item) || item === null) {
      errors.push(`cta_links[${i}]: Muss ein Objekt sein.`);
      continue;
    }

    for (const key of Object.keys(item)) {
      if (!CTA_LINK_ALLOWED_KEYS.has(key)) {
        errors.push(`cta_links[${i}].${key}: Unbekannter Key nicht erlaubt.`);
      }
    }

    // label_de: Pflicht. Ein reiner Whitespace-Wert ist fachlich leer und wurde
    // clientseitig bereits abgelehnt — der Server muss denselben Vertrag halten.
    if (typeof item.label_de !== 'string' || !item.label_de.trim()) {
      errors.push(`cta_links[${i}].label_de: Pflichtfeld fehlt oder leer.`);
    } else if (item.label_de.length > 60) {
      errors.push(`cta_links[${i}].label_de: Zu lang (max 60 Zeichen).`);
    }

    // spec / focus / loc: optional, wenn gesetzt ein String. Reine Typsicherheit —
    // bewusst keine Fach- oder Orts-Taxonomie an dieser Stelle, identisch zu
    // predefined_searches.
    for (const key of ['spec', 'focus', 'loc', 'kursart']) {
      const value = item[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string') {
        errors.push(`cta_links[${i}].${key}: Muss ein String oder null sein.`);
      }
    }

    if (item.delivery !== undefined && item.delivery !== null
        && !VALID_DELIVERY_TYPES.includes(item.delivery)) {
      errors.push(`cta_links[${i}].delivery: Ungültiger Wert. Erlaubt: ${VALID_DELIVERY_TYPES.join(', ')}.`);
    }

    if (item.sort_order !== undefined && item.sort_order !== null
        && (!Number.isInteger(item.sort_order) || item.sort_order < 0)) {
      errors.push(`cta_links[${i}].sort_order: Muss eine ganze Zahl >= 0 sein.`);
    }

    if (item.status !== undefined && item.status !== null
        && !VALID_STATUSES.includes(item.status)) {
      errors.push(`cta_links[${i}].status: Ungültiger Wert. Erlaubt: ${VALID_STATUSES.join(', ')}.`);
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

  const ALLOWED_KEYS = new Set(['spec', 'focus', 'loc', 'delivery', 'kursart']);
  for (const key of Object.keys(config)) {
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(`cta_config.${key}: Unbekannter Key nicht erlaubt.`);
    }
  }

  if (config.kursart !== undefined && config.kursart !== null
      && (typeof config.kursart !== 'string' || !config.kursart.trim() || config.kursart.length > 100)) {
    errors.push('cta_config.kursart: Muss ein nicht leerer String mit maximal 100 Zeichen oder null sein.');
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
  if (data.area_slug === null) {
    // Ein neuer Draft kann vor dem Speichern des Such-Tabs noch keinen
    // Suchraum haben. Der Veröffentlichungs-Gate prüft ihn vollständig.
  } else {
    requireText(errors, data, 'area_slug', 100);
  }

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
  if ('area_slug' in data && data.area_slug !== null) requireText(errors, data, 'area_slug', 100);

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
  optionalText(errors, data, 'og_image_alt', 200);

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

  // last_reviewed_at: reines Kalenderdatum (DB-Spalte ist `date`).
  // Nur prüfen wenn im Payload — ein fehlendes Feld lässt die Spalte unberührt.
  if ('last_reviewed_at' in data && data.last_reviewed_at !== null && data.last_reviewed_at !== '') {
    if (!isValidReviewDate(data.last_reviewed_at)) {
      collect(errors, 'last_reviewed_at', 'Muss ein gültiges Datum im Format JJJJ-MM-TT sein.');
    }
  }

  // Escaped-HTML-Schutz
  if (data.content_html && detectEscapedHtmlDocument(data.content_html)) {
    collect(errors, 'content_html', 'Der Artikelinhalt enthält maskiertes HTML statt formatierter Inhalte. Bitte den Editorinhalt prüfen.');
  }

  // JSONB
  errors.push(...validateCtaConfig(data.cta_config));

  // Quellenangaben — nur prüfen wenn im Payload enthalten. Fehlt `sources`,
  // bleibt die bestehende Spalte unverändert (Patch-Semantik wie bei den
  // übrigen Feldern, die filterWriteFields() nicht in den Payload aufnimmt).
  if ('sources' in data) {
    errors.push(...validateScenarioSources(data.sources).errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Prüft ein redaktionelles Prüfdatum: reines Kalenderdatum JJJJ-MM-TT.
 *
 * Kein Timestamp und kein Freitext — der Wert landet in einer `date`-Spalte und
 * wird öffentlich als Vertrauensangabe ausgegeben (siehe
 * src/lib/editorialReviewDate.js).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidReviewDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day
  );
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
 *
 * loc_param und delivery_param sind BEIDE optional und dürfen gleichzeitig
 * null/leer sein. Ein solcher Eintrag repräsentiert einen Link ohne
 * Standort- und Lieferungsfilter (z.B. "Ganze Schweiz"), der auf alle
 * passenden Kurse der Themenwelt zeigt.
 *
 * Das entspricht dem DB-Vertrag: die ursprüngliche Constraint
 * regions_params_check wurde in
 * supabase/migrations/20260718_relax_regions_params_constraint.sql
 * ersatzlos entfernt. Bestehende Sport-/Yoga-Daten nutzen diesen Zustand.
 *
 * Ein TATSÄCHLICH GESETZTER, ungültiger delivery_param bleibt ein Fehler.
 */
export function validateRegion(data) {
  const errors = [];
  requireText(errors, data, 'label_de', 100);

  // anchor_text_de bleibt optional: fehlt der Wert oder ist er null bzw. leer,
  // fällt die Anzeige auf label_de zurück (themeWorldAdapter.js, Import-RPC und
  // api/admin-theme-world-sub.js tun das übereinstimmend). Genau deshalb darf
  // hier kein Pflichtfeld daraus werden — geprüft wird nur, dass ein gesetzter
  // Wert ein String in vertretbarer Länge ist.
  optionalText(errors, data, 'anchor_text_de', ANCHOR_TEXT_MAX);

  if (data.delivery_param && !VALID_REGION_DELIVERY_PARAMS.includes(data.delivery_param)) {
    collect(errors, 'delivery_param', `Ungültiger Wert. Erlaubt: ${VALID_REGION_DELIVERY_PARAMS.join(', ')}.`);
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
    if (!themeWorld.search_config) {
      errors.push('search_config: Pflichtfeld fehlt (area_slug oder kursart erforderlich). Suchkonfiguration ist für Publikation erforderlich.');
    } else {
      errors.push(...validateSearchConfig(themeWorld.search_config));
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
 * Quellenangaben (opts.requireSources):
 *   Die Prüfung existiert bereits vollständig, ist aber standardmässig AUS.
 *   Grund: Sport und Yoga sind live und haben noch keine Quellen — eine harte
 *   Pflicht würde jedes Re-Publish dieser Artikel blockieren. Sobald der
 *   Bestand nachgepflegt ist, genügt es, den Aufruf in
 *   api/admin-theme-world-scenarios.js auf { requireSources: true } zu setzen;
 *   es ist keine weitere Codeänderung nötig.
 *
 * @param {object} scenario - Vollständiger Datensatz aus der DB
 * @param {object} parentThemeWorld - Zugehörige Themenwelt aus der DB
 * @param {object} [opts]
 * @param {boolean} [opts.requireSources=false] - mindestens eine Quelle verlangen
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePublishScenario(scenario, parentThemeWorld, opts = {}) {
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

  // Quellenangaben
  const sources = scenario.sources;
  const hasSources = Array.isArray(sources) && sources.length > 0;

  if (opts.requireSources === true && !hasSources) {
    errors.push(
      'sources: Mindestens eine Quellenangabe ist für die Publikation erforderlich.',
    );
  }

  // Vorhandene Quellen müssen strukturell gültig sein — unabhängig davon, ob
  // sie Pflicht sind. Ein leeres Array (der Normalfall im Bestand) erzeugt hier
  // niemals einen Fehler.
  if (hasSources) {
    errors.push(...validateScenarioSources(sources).errors);
  }

  return { valid: errors.length === 0, errors };
}
