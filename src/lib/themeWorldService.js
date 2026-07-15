/**
 * Öffentlicher Frontend-Datenservice für das dynamische Themenwelten-System.
 *
 * Dieser Service liefert Daten für die öffentlichen Seiten (BereichLandingPage,
 * SzenarioArtikelView). Er greift ausschliesslich auf publizierte Inhalte zu
 * und ist für anonyme Nutzer gedacht.
 *
 * Regeln:
 *   - Nur publizierte Inhalte werden zurückgegeben (RLS enforced)
 *   - Entwürfe und archivierte Inhalte sind nicht sichtbar
 *   - Keine Admin-Daten oder Secrets im Client
 *   - Beim App-Start werden keine Themenwelten vorgeladen
 *   - Not-found und DB-Fehler werden klar unterschieden
 *
 * Abhängigkeiten:
 *   - supabase: Anon-Client (nur publizierte Daten via RLS)
 *
 * WICHTIG: Dieser Service ist in Phase 4 NICHT aktiv eingebunden.
 * Er wird erst in Phase 5 (Pilot-Aktivierung) genutzt.
 * In Phase 4 wird er nur getestet.
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Fehlerklassen
// ---------------------------------------------------------------------------

/** Wird geworfen wenn ein Eintrag nicht existiert oder nicht publiziert ist */
export class ThemeWorldNotFoundError extends Error {
  constructor(message = 'Themenwelt nicht gefunden.') {
    super(message);
    this.name = 'ThemeWorldNotFoundError';
  }
}

/** Wird geworfen bei einem Datenbankfehler (unabhängig von Not-found) */
export class ThemeWorldDbError extends Error {
  constructor(message = 'Datenbankfehler beim Laden der Themenwelt.', cause) {
    super(message);
    this.name = 'ThemeWorldDbError';
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Normalisiert einen URL-Segment-String.
 * Akzeptiert Bindestriche (URL-Format) und gibt Bindestriche zurück.
 *
 * @param {string} segment - z.B. 'beruflich', 'privat-hobby'
 * @returns {string}
 */
function normalizeSegment(segment) {
  return (segment || '').toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Öffentliche Abfragen
// ---------------------------------------------------------------------------

/**
 * Lädt eine publizierte Themenwelt anhand von URL-Segment und Slug.
 *
 * @param {string} urlSegment - URL-Segment: 'beruflich' | 'privat-hobby' | 'kinder-jugend'
 * @param {string} slug - URL-Slug: z.B. 'sport-fitness-berufsausbildung'
 * @returns {Promise<object>} Themenwelt-Datensatz
 * @throws {ThemeWorldNotFoundError} wenn nicht gefunden oder nicht publiziert
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchThemeWorld(urlSegment, slug) {
  const { data, error } = await supabase
    .from('theme_worlds')
    .select('*')
    .eq('url_segment', normalizeSegment(urlSegment))
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // PostgREST "keine Zeile gefunden" — Not-found, kein technischer Fehler
      throw new ThemeWorldNotFoundError();
    }
    console.error('[themeWorldService] fetchThemeWorld error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  if (!data) throw new ThemeWorldNotFoundError();
  return data;
}

/**
 * Lädt alle publizierten Szenario-Artikel einer Themenwelt.
 * Voraussetzung: Die Themenwelt muss publiziert sein (RLS enforced).
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<Array>} Liste der publizierten Szenario-Artikel (sortiert)
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchPublishedScenarios(themeWorldId) {
  const { data, error } = await supabase
    .from('theme_world_scenarios')
    .select('id, slug, icon, label_de, teaser_de, card_image_url, card_image_alt, sort_order, published_at')
    .eq('theme_world_id', themeWorldId)
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[themeWorldService] fetchPublishedScenarios error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  return data || [];
}

/**
 * Lädt einen einzelnen publizierten Szenario-Artikel anhand seines Slugs.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @param {string} scenarioSlug - URL-Slug des Szenarios
 * @returns {Promise<object>} Vollständiger Szenario-Datensatz
 * @throws {ThemeWorldNotFoundError} wenn nicht gefunden oder nicht publiziert
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchPublishedScenario(themeWorldId, scenarioSlug) {
  const { data, error } = await supabase
    .from('theme_world_scenarios')
    .select('*')
    .eq('theme_world_id', themeWorldId)
    .eq('slug', scenarioSlug)
    .eq('status', 'published')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ThemeWorldNotFoundError(`Szenario '${scenarioSlug}' nicht gefunden.`);
    }
    console.error('[themeWorldService] fetchPublishedScenario error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  if (!data) throw new ThemeWorldNotFoundError();
  return data;
}

/**
 * Lädt aktive FAQs einer Themenwelt (RLS: nur wenn TW published).
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<Array>} FAQ-Liste sortiert nach sort_order
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchFaqs(themeWorldId) {
  const { data, error } = await supabase
    .from('theme_world_faqs')
    .select('id, question_de, answer_de, sort_order')
    .eq('theme_world_id', themeWorldId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[themeWorldService] fetchFaqs error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  return data || [];
}

/**
 * Lädt aktive Editorial Sections einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<Array>} Editorial Sections sortiert nach sort_order
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchEditorialSections(themeWorldId) {
  const { data, error } = await supabase
    .from('theme_world_editorial_sections')
    .select('id, heading_de, intro_de, items_de, is_ordered, closing_de, sort_order')
    .eq('theme_world_id', themeWorldId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[themeWorldService] fetchEditorialSections error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  return data || [];
}

/**
 * Lädt aktive Specialties (Kursbereiche) einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<Array>} Specialties sortiert nach sort_order
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchSpecialties(themeWorldId) {
  const { data, error } = await supabase
    .from('theme_world_specialties')
    .select('id, specialty_label, description_de, icon, sort_order')
    .eq('theme_world_id', themeWorldId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[themeWorldService] fetchSpecialties error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  return data || [];
}

/**
 * Lädt aktive Regionen einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<Array>} Regionen sortiert nach sort_order
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchRegions(themeWorldId) {
  const { data, error } = await supabase
    .from('theme_world_regions')
    .select('id, label_de, anchor_text_de, loc_param, delivery_param, sort_order')
    .eq('theme_world_id', themeWorldId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[themeWorldService] fetchRegions error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  return data || [];
}

/**
 * Lädt aktive Trust Items einer Themenwelt.
 *
 * @param {string} themeWorldId - UUID der Themenwelt
 * @returns {Promise<Array>} Trust Items sortiert nach sort_order
 * @throws {ThemeWorldDbError} bei Datenbankfehler
 */
export async function fetchTrustItems(themeWorldId) {
  const { data, error } = await supabase
    .from('theme_world_trust_items')
    .select('id, item_type, name, description_de, logo_url, logo_alt, external_url, rights_note, sort_order')
    .eq('theme_world_id', themeWorldId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[themeWorldService] fetchTrustItems error:', error.message);
    throw new ThemeWorldDbError(error.message, error);
  }

  return data || [];
}

/**
 * Lädt alle für eine Themenwelt-Seite benötigten Daten in einem Aufruf.
 * Fehler in Untertabellen werden geloggt, aber nicht als kritisch betrachtet
 * (Fallback: leere Arrays).
 *
 * @param {string} urlSegment - URL-Segment
 * @param {string} slug - Slug der Themenwelt
 * @returns {Promise<{
 *   themeWorld: object,
 *   scenarios: Array,
 *   faqs: Array,
 *   editorialSections: Array,
 *   specialties: Array,
 *   regions: Array,
 *   trustItems: Array
 * }>}
 * @throws {ThemeWorldNotFoundError} wenn Themenwelt nicht gefunden
 * @throws {ThemeWorldDbError} bei kritischem DB-Fehler
 */
export async function fetchThemeWorldPage(urlSegment, slug) {
  // Haupttabelle laden (kritisch — wirft bei Fehler)
  const themeWorld = await fetchThemeWorld(urlSegment, slug);
  const id = themeWorld.id;

  // Parallele Abfragen aller Untertabellen (unkritisch — Fallback auf [])
  const [scenarios, faqs, editorialSections, specialties, regions, trustItems] =
    await Promise.all([
      fetchPublishedScenarios(id).catch((e) => {
        console.error('[themeWorldService] Szenarien konnten nicht geladen werden:', e.message);
        return [];
      }),
      fetchFaqs(id).catch((e) => {
        console.error('[themeWorldService] FAQs konnten nicht geladen werden:', e.message);
        return [];
      }),
      fetchEditorialSections(id).catch((e) => {
        console.error('[themeWorldService] Editorial Sections konnten nicht geladen werden:', e.message);
        return [];
      }),
      fetchSpecialties(id).catch((e) => {
        console.error('[themeWorldService] Specialties konnten nicht geladen werden:', e.message);
        return [];
      }),
      fetchRegions(id).catch((e) => {
        console.error('[themeWorldService] Regionen konnten nicht geladen werden:', e.message);
        return [];
      }),
      fetchTrustItems(id).catch((e) => {
        console.error('[themeWorldService] Trust Items konnten nicht geladen werden:', e.message);
        return [];
      }),
    ]);

  return { themeWorld, scenarios, faqs, editorialSections, specialties, regions, trustItems };
}
