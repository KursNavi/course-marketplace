/**
 * Datenadapter: DB-Format â†’ Legacy-Komponentenformat
 *
 * Ãœbersetzt Daten aus der neuen Themenwelten-Datenbank in das Format,
 * das die bestehenden Komponenten BereichLandingPage und SzenarioArtikelView
 * erwarten. Dadurch mÃ¼ssen diese Komponenten beim Pilot-Start minimal geÃ¤ndert werden.
 *
 * In Phase 4: Nur getestet, nicht aktiv genutzt (Feature-Flag ist aus).
 * In Phase 5: Wird aktiviert wenn der Pilot-Flag fÃ¼r eine Themenwelt gesetzt ist.
 *
 * Segmentnormalisierung:
 *   DB:  db_segment = 'professionell' | 'privat' | 'kinder'
 *   URL: url_segment = 'beruflich' | 'privat-hobby' | 'kinder-jugend'
 *   Config key (typeKey): 'beruflich' | 'privat_hobby' | 'kinder_jugend'
 */

import { normalizeDeliveryTypeKey } from './courseMetadata';
import { toDisplaySources } from './scenarioSources';
import { pickLatestReviewDate } from './editorialReviewDate';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Mapping DB-Segment â†’ URL-Segment */
const DB_TO_URL_SEGMENT = {
  professionell: 'beruflich',
  privat: 'privat-hobby',
  kinder: 'kinder-jugend',
};

/** Mapping DB-Segment â†’ interner Config-Key (typeKey) */
const DB_TO_TYPE_KEY = {
  professionell: 'beruflich',
  privat: 'privat_hobby',
  kinder: 'kinder_jugend',
};

/** Mapping URL-Segment â†’ DB-Segment */
const URL_TO_DB_SEGMENT = {
  beruflich: 'professionell',
  'privat-hobby': 'privat',
  'kinder-jugend': 'kinder',
};

/**
 * Fallback-Hero-Bilder je Segment â€” werden verwendet wenn keine hero_image_url in DB gesetzt ist.
 * Dieselben Bilder wie in LandingView.jsx.
 */
export const SEGMENT_FALLBACK_HERO_IMAGES = {
  beruflich: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=2000',
  'privat-hobby': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000',
  'kinder-jugend': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2000',
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Normalisiert ein URL-Segment (Bindestriche oder Unterstriche â†’ Bindestriche).
 *
 * @param {string} segment
 * @returns {string}
 */
export function normalizeUrlSegment(segment) {
  if (!segment) return '';
  return segment.toLowerCase().replace(/_/g, '-').trim();
}

/**
 * Gibt den internen Config-Key (typeKey) fÃ¼r ein URL-Segment zurÃ¼ck.
 *
 * @param {string} urlSegment - 'beruflich' | 'privat-hobby' | 'kinder-jugend'
 * @returns {string} typeKey mit Unterstrichen
 */
export function urlSegmentToTypeKey(urlSegment) {
  const normalized = normalizeUrlSegment(urlSegment);
  return normalized.replace(/-/g, '_');
}

/**
 * Gibt den URL-Segment fÃ¼r ein DB-Segment zurÃ¼ck.
 *
 * @param {string} dbSegment - 'professionell' | 'privat' | 'kinder'
 * @returns {string}
 */
export function dbSegmentToUrlSegment(dbSegment) {
  return DB_TO_URL_SEGMENT[dbSegment] || dbSegment;
}

/**
 * Gibt den DB-Segment fÃ¼r ein URL-Segment zurÃ¼ck.
 *
 * @param {string} urlSegment - 'beruflich' | 'privat-hobby' | 'kinder-jugend'
 * @returns {string}
 */
export function urlSegmentToDbSegment(urlSegment) {
  const normalized = normalizeUrlSegment(urlSegment);
  return URL_TO_DB_SEGMENT[normalized] || normalized;
}

// ---------------------------------------------------------------------------
// Haupt-Adapter: ThemeWorld â†’ BereichLandingPage-Format
// ---------------------------------------------------------------------------

/**
 * Adaptiert einen vollstÃ¤ndigen Themenwelt-Datensatz (inkl. Untertabellen)
 * in das Format, das BereichLandingPage und verwandte Komponenten erwarten.
 *
 * @param {object} params
 * @param {object} params.themeWorld - Hauptdatensatz aus theme_worlds
 * @param {Array}  params.scenarios - Aus fetchPublishedScenarios()
 * @param {Array}  params.faqs - Aus fetchFaqs()
 * @param {Array}  params.editorialSections - Aus fetchEditorialSections()
 * @param {Array}  params.specialties - Aus fetchSpecialties()
 * @param {Array}  params.regions - Aus fetchRegions()
 * @param {Array}  params.trustItems - Aus fetchTrustItems()
 * @returns {object} Adaptiertes Konfigurationsobjekt im Legacy-Format
 */
export function adaptThemeWorldToConfig({
  themeWorld,
  scenarios = [],
  faqs = [],
  editorialSections = [],
  specialties = [],
  regions = [],
  trustItems = [],
}) {
  if (!themeWorld) return null;

  const urlSegment = themeWorld.url_segment || dbSegmentToUrlSegment(themeWorld.db_segment);
  const typeKey = urlSegmentToTypeKey(urlSegment);
  const searchConfig = themeWorld.search_config || {};
  const sectionTitles = themeWorld.section_titles || {};

  return {
    // IdentitÃ¤t
    key: themeWorld.key,
    slug: themeWorld.slug,
    segment: urlSegment,
    typeKey,
    dbSegment: themeWorld.db_segment,
    id: themeWorld.id,

    // Inhalte
    title: themeWorld.title_de,
    subtitle: themeWorld.subtitle_de,
    intro: themeWorld.intro_de,

    // Bilder (Fallback auf Segment-Bild wenn kein Custom-Bild hochgeladen)
    heroImageUrl: themeWorld.hero_image_url || SEGMENT_FALLBACK_HERO_IMAGES[urlSegment] || null,
    heroImageAlt: themeWorld.hero_image_alt_de || '',
    ogImageUrl: themeWorld.og_image_url || null,
    ogImageAlt: themeWorld.og_image_alt_de || '',

    // SEO
    metaTitle: themeWorld.meta_title || null,
    metaDescription: themeWorld.meta_description || null,

    // Suche
    searchConfig: {
      areaSlug: searchConfig.area_slug ?? themeWorld.area_slug ?? null,
      typeKey: searchConfig.type_key || typeKey,
      kursart: searchConfig.kursart || null,
      defaultSpec: searchConfig.default_spec || null,
      defaultFocus: searchConfig.default_focus || null,
    },

    // AbschnittsÃ¼berschriften-Overrides
    sectionTitles: {
      scenarios: sectionTitles.scenarios_heading || null,
      specialties: sectionTitles.specialties_heading || null,
      regions: sectionTitles.regions_heading || null,
      editorial: sectionTitles.editorial_heading || null,
      faqs: sectionTitles.faqs_heading || null,
      trust: sectionTitles.trust_heading || null,
    },

    // Vordefinierte Suchen
    predefinedSearches: (themeWorld.predefined_searches || []).map(adaptPredefinedSearch),

    // CTA-Links
    ctaLinks: (themeWorld.cta_links || []).map(adaptCtaLink),

    // Szenario-Artikel
    scenarios: scenarios.map(adaptScenarioCard),

    // Specialties (Kursbereiche)
    specialties: specialties.map(adaptSpecialty),

    // Regionen
    regions: regions.map(adaptRegion),

    // Editorial Sections
    editorialSections: editorialSections.map(adaptEditorialSection),

    // FAQs
    faqs: faqs.map(adaptFaq),

    // Trust Items
    trustItems: trustItems.map(adaptTrustItem),

    // Metadaten
    publishedAt: themeWorld.published_at,
    updatedAt: themeWorld.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Adapter fÃ¼r Szenario-Karten (Listeneintrag)
// ---------------------------------------------------------------------------

/**
 * Adaptiert einen Szenario-Artikel fÃ¼r die Karten-Anzeige auf der Landingpage.
 *
 * @param {object} scenario - Zeile aus theme_world_scenarios
 * @returns {object} Scenario-Karte im Legacy-Format
 */
export function adaptScenarioCard(scenario) {
  return {
    id: scenario.id,
    slug: scenario.slug,
    icon: scenario.icon || null,
    label: scenario.label_de,
    teaser: scenario.teaser_de || null,
    cardImageUrl: scenario.card_image_url || null,
    cardImageAlt: scenario.card_image_alt || '',
    sortOrder: scenario.sort_order,
    publishedAt: scenario.published_at,
  };
}

// ---------------------------------------------------------------------------
// Adapter fÃ¼r Szenario-Artikel (Vollansicht)
// ---------------------------------------------------------------------------

/**
 * Adaptiert einen vollstÃ¤ndigen Szenario-Artikel fÃ¼r SzenarioArtikelView.
 *
 * @param {object} scenario - VollstÃ¤ndige Zeile aus theme_world_scenarios
 * @param {object} themeWorld - Eltern-Themenwelt fÃ¼r Kontext
 * @returns {object} Artikel im Legacy-Format
 */
export function adaptScenarioArticle(scenario, themeWorld) {
  const urlSegment = themeWorld?.url_segment || '';
  const twSlug = themeWorld?.slug || '';
  const canonicalPath = `/bereich/${urlSegment}/${twSlug}/${scenario.slug}`;

  const ctaConfig = scenario.cta_config || {};
  const twSearchConfig = themeWorld?.search_config || {};

  return {
    id: scenario.id,
    slug: scenario.slug,
    themeWorldId: scenario.theme_world_id,
    canonicalPath,

    // Szenario-Kontext
    themeWorldTitle: themeWorld?.title_de || null,
    themeWorldSlug: twSlug,
    themeWorldSegment: urlSegment,

    // Inhalte
    icon: scenario.icon || null,
    title: scenario.label_de,
    teaser: scenario.teaser_de || null,
    contentHtml: scenario.content_html || '',

    // Bilder
    cardImageUrl: scenario.card_image_url || null,
    cardImageAlt: scenario.card_image_alt || '',
    ogImageUrl: scenario.og_image_url || null,

    // SEO
    metaTitle: scenario.meta_title || null,
    metaDescription: scenario.meta_description || null,

    // CTA
    ctaLabel: scenario.cta_label_de || null,
    ctaConfig: {
      spec: ctaConfig.spec || twSearchConfig.default_spec || null,
      focus: ctaConfig.focus || null,
      loc: ctaConfig.loc || null,
      delivery: ctaConfig.delivery || null,
      kursart: ctaConfig.kursart || twSearchConfig.kursart || null,
      areaSlug: twSearchConfig.area_slug ?? themeWorld?.area_slug ?? null,
      typeKey: urlSegmentToTypeKey(urlSegment),
    },

    // Quellenangaben im Anzeigeformat [{title, publisher, url}]
    sources: toDisplaySources(scenario.sources),

    // Metadaten
    sortOrder: scenario.sort_order,
    publishedAt: scenario.published_at,
    updatedAt: scenario.updated_at,
    lastReviewedAt: scenario.last_reviewed_at,
  };
}

// ---------------------------------------------------------------------------
// Adapter fÃ¼r Untertabellen
// ---------------------------------------------------------------------------

function adaptPredefinedSearch(search) {
  return {
    label: search.label_de,
    spec: search.spec || null,
    focus: search.focus || null,
    loc: search.loc || null,
    delivery: search.delivery || null,
    kursart: search.kursart || null,
  };
}

/**
 * Ein CTA-Link ist fachlich eine hervorgehobene vordefinierte Suche und trÃ¤gt
 * deshalb dieselben vier Suchparameter. spec und focus waren frÃ¼her nicht
 * abgebildet â€” ein Link mit Fachrichtung landete dadurch auf einer ungefilterten
 * Ergebnisliste, obwohl der Wert gespeichert war.
 */
function adaptCtaLink(link) {
  return {
    label: link.label_de,
    spec: link.spec || null,
    focus: link.focus || null,
    loc: link.loc || null,
    delivery: link.delivery || null,
    kursart: link.kursart || null,
  };
}

function adaptSpecialty(specialty) {
  return {
    id: specialty.id,
    label: specialty.specialty_label,
    description: specialty.description_de || null,
    icon: specialty.icon || null,
    sortOrder: specialty.sort_order,
  };
}

function adaptRegion(region) {
  return {
    id: region.id,
    label: region.label_de,
    anchorText: region.anchor_text_de || region.label_de,
    locParam: region.loc_param || null,
    deliveryParam: region.delivery_param || null,
    sortOrder: region.sort_order,
  };
}

function adaptEditorialSection(section) {
  return {
    id: section.id,
    heading: section.heading_de,
    intro: section.intro_de || null,
    items: section.items_de || [],
    isOrdered: section.is_ordered,
    closing: section.closing_de || null,
    sortOrder: section.sort_order,
  };
}

function adaptFaq(faq) {
  return {
    id: faq.id,
    question: faq.question_de,
    answer: faq.answer_de,
    sortOrder: faq.sort_order,
  };
}

function adaptTrustItem(item) {
  return {
    id: item.id,
    type: item.item_type,
    name: item.name,
    description: item.description_de || null,
    logoUrl: item.logo_url || null,
    logoAlt: item.logo_alt || null,
    externalUrl: item.external_url || null,
    rightsNote: item.rights_note || null,
    sortOrder: item.sort_order,
  };
}

// ---------------------------------------------------------------------------
// Bridge-Adapter: Raw-DB-Daten â†’ Legacy-Komponentenformat
// ---------------------------------------------------------------------------

/**
 * Konvertiert rohe DB-Daten (aus fetchThemeWorldPage) direkt in das Format,
 * das BereichLandingPage.jsx erwartet (Multilingual-Objekte, spezifische Keys).
 *
 * Dies ist der bevorzugte Adapter fÃ¼r die Pilot-Integration in Phase 5.
 *
 * @param {object} params
 * @param {object} params.themeWorld - Rohdaten aus theme_worlds
 * @param {Array}  params.scenarios - Aus fetchPublishedScenarios
 * @param {Array}  params.faqs - Aus fetchFaqs
 * @param {Array}  params.editorialSections - Aus fetchEditorialSections
 * @param {Array}  params.specialties - Aus fetchSpecialties
 * @param {Array}  params.regions - Aus fetchRegions
 * @param {Array}  params.trustItems - Aus fetchTrustItems
 * @returns {object} Konfigurationsobjekt im Legacy-BereichLandingPage-Format
 */
export function adaptToLegacyBereichConfig({
  themeWorld,
  scenarios = [],
  faqs = [],
  editorialSections = [],
  specialties = [],
  regions = [],
  trustItems = [],
}) {
  if (!themeWorld) return null;

  const urlSegment = themeWorld.url_segment || dbSegmentToUrlSegment(themeWorld.db_segment);
  const typeKey = urlSegmentToTypeKey(urlSegment);
  const searchConfig = themeWorld.search_config || {};
  const st = themeWorld.section_titles || {};

  return {
    // IdentitÃ¤t
    key: themeWorld.key,
    slug: themeWorld.slug,
    segment: urlSegment,
    typeKey,
    areaSlug: searchConfig.area_slug ?? themeWorld.area_slug ?? null,
    kursart: searchConfig.kursart || null,

    // Titel / Subtitel als Multilingual-Objekte (Legacy-Format: { de: '...' })
    title: { de: themeWorld.title_de || '' },
    subtitle: { de: themeWorld.subtitle_de || '' },

    // Hero-Bild (Fallback auf Segment-Bild wenn kein Custom-Bild hochgeladen)
    heroImage: themeWorld.hero_image_url || SEGMENT_FALLBACK_HERO_IMAGES[urlSegment] || null,
    heroImageAlt: themeWorld.hero_image_alt_de || '',

    // OG-Bild
    ogImageUrl: themeWorld.og_image_url || null,
    ogImageAlt: themeWorld.og_image_alt_de || '',

    // SEO
    metaTitle: themeWorld.meta_title || null,
    metaDescription: themeWorld.meta_description || null,

    // Redaktionelles PrÃ¼fdatum der Landingpage.
    // theme_worlds hat keine eigene Spalte last_reviewed_at â€” die Landingpage
    // Ã¼bernimmt deshalb das jÃ¼ngste PrÃ¼fdatum ihrer publizierten Artikel, statt
    // ein eigenes Datum zu behaupten. Ohne geprÃ¼fte Artikel bleibt es null und
    // buildEditorialReviewNotice() lÃ¤sst den PrÃ¼fsatz weg.
    lastReviewedAt: pickLatestReviewDate(scenarios.map((s) => s.last_reviewed_at)),

    // Szenario-Karten im Legacy-Format
    scenarios: scenarios.map((s, i) => ({
      slug: s.slug,
      icon: s.icon || null,
      label: { de: s.label_de || '' },
      text: { de: s.teaser_de || '' },
      cardImageUrl: s.card_image_url || null,
      cardImageAlt: s.card_image_alt || '',
      ctaLabel: { de: s.cta_label_de || 'Kurse entdecken' },
      searchParams: _extractSearchParams(s.cta_config, searchConfig),
      sortOrder: s.sort_order || i + 1,
      lastReviewedAt: s.last_reviewed_at || null,
    })),

    // Specialties: Array â†’ gekeyertes Objekt { label: { de, icon } }
    specialtyDescriptions: Object.fromEntries(
      (specialties || []).map((s) => [
        s.specialty_label,
        { de: s.description_de || '', icon: s.icon || '' },
      ]),
    ),

    // Regional Discovery
    regionalDiscovery: (regions && regions.length > 0)
      ? {
          title: st.regions_heading ? { de: st.regions_heading } : { de: '' },
          subtitle: st.regions_subheading ? { de: st.regions_subheading } : { de: '' },
          regions: regions.map((r) => ({
            label: r.label_de,
            anchorText: r.anchor_text_de || r.label_de,
            params: {
              ...(r.loc_param ? { loc: r.loc_param } : {}),
              ...(r.delivery_param ? { delivery: normalizeDeliveryTypeKey(r.delivery_param) || r.delivery_param } : {}),
              ...(searchConfig.kursart ? { kursart: searchConfig.kursart } : {}),
            },
          })),
        }
      : null,

    // Vordefinierte Suchen
    predefinedSearches: (themeWorld.predefined_searches || []).map((s) => ({
      label: { de: s.label_de || '' },
      params: {
        ...(s.spec ? { spec: s.spec } : {}),
        ...(s.focus ? { focus: s.focus } : {}),
        ...(s.kursart ? { kursart: s.kursart } : {}),
      },
      extraParams: {
        ...(s.loc ? { loc: s.loc } : {}),
        ...(s.delivery ? { delivery: normalizeDeliveryTypeKey(s.delivery) || s.delivery } : {}),
      },
    })),

    // Editorial Sections
    editorialSections: (editorialSections || []).map((s) => ({
      heading: { de: s.heading_de || '' },
      intro: s.intro_de ? { de: s.intro_de } : null,
      items: s.items_de ? { de: s.items_de } : null,
      isOrdered: s.is_ordered || false,
      closing: s.closing_de ? { de: s.closing_de } : null,
    })),

    // FAQs
    faqs: (faqs || []).map((f) => ({
      q: { de: f.question_de || '' },
      a: { de: f.answer_de || '' },
    })),

    // AbschnittsÃ¼berschriften
    sectionTitles: {
      scenarioTitle: st.scenarios_heading ? { de: st.scenarios_heading } : { de: 'Wo stehst du?' },
      scenarioSubtitle: st.scenarios_subheading ? { de: st.scenarios_subheading } : { de: 'Finde den passenden Einstieg' },
      specialtiesTitle: st.specialties_heading ? { de: st.specialties_heading } : { de: 'Ausbildungsbereiche' },
      specialtiesSubtitle: st.specialties_subheading ? { de: st.specialties_subheading } : { de: 'Alle Schwerpunkte auf einen Blick' },
      searchesTitle: st.searches_heading ? { de: st.searches_heading } : null,
      searchesSubtitle: st.searches_subheading ? { de: st.searches_subheading } : null,
      faqTitle: st.faqs_heading ? { de: st.faqs_heading } : { de: 'HÃ¤ufige Fragen' },
      trustTitle: st.trust_heading ? { de: st.trust_heading } : { de: 'QualitÃ¤t & Anerkennung' },
      ctaTitle: st.cta_heading ? { de: st.cta_heading } : null,
      ctaButton: st.cta_button ? { de: st.cta_button } : { de: 'Alle Kurse anzeigen' },
    },

    // CTA-Links
    // Dieselben vier Suchparameter wie predefined_searches â€” sonst ginge die
    // gespeicherte Fachrichtung (spec/focus) beim Aufbau der Ã¶ffentlichen
    // CTA-URL verloren.
    ctaLinks: (themeWorld.cta_links || []).map((l) => ({
      label: { de: l.label_de || '' },
      params: {
        ...(l.spec ? { spec: l.spec } : {}),
        ...(l.focus ? { focus: l.focus } : {}),
        ...(l.loc ? { loc: l.loc } : {}),
        ...(l.delivery ? { delivery: normalizeDeliveryTypeKey(l.delivery) || l.delivery } : {}),
        ...(l.kursart ? { kursart: l.kursart } : {}),
      },
    })),

    // Trust Logos
    trustLogos: (trustItems || []).map((t) => ({
      name: t.name,
      description: { de: t.description_de || '' },
    })),
  };
}

/**
 * Konvertiert einen vollstÃ¤ndigen Szenario-DB-Datensatz in das Format,
 * das SzenarioArtikelView.jsx als scenario-Objekt erwartet.
 *
 * @param {object} scenario - VollstÃ¤ndiger Datensatz aus theme_world_scenarios
 * @param {object} themeWorldSearchConfig - search_config der Eltern-Themenwelt
 * @returns {object} Szenario im Legacy-Format
 */
export function adaptToLegacySzenarioConfig(scenario, themeWorldSearchConfig = {}) {
  if (!scenario) return null;
  return {
    slug: scenario.slug,
    icon: scenario.icon || null,
    label: { de: scenario.label_de || '' },
    text: { de: scenario.teaser_de || '' },
    ctaLabel: { de: scenario.cta_label_de || 'Kurse entdecken' },
    searchParams: _extractSearchParams(scenario.cta_config, themeWorldSearchConfig),
    // Content fÃ¼r den Artikel (wird separat in der Komponente als articleContent behandelt)
    contentHtml: scenario.content_html || '',
    // card_image_url ist das redaktionelle Artikelbild. Bisher wurde es nur auf
    // der Szenario-Karte durchgereicht; die Artikelseite hatte deshalb gar kein
    // sichtbares Bild zur VerfÃ¼gung. og_image_url bleibt daneben unverÃ¤ndert die
    // reine Social-Vorschau.
    cardImageUrl: scenario.card_image_url || null,
    cardImageAlt: scenario.card_image_alt || '',
    ogImageUrl: scenario.og_image_url || null,
    ogImageAlt: scenario.og_image_alt || '',
    metaTitle: scenario.meta_title || null,
    metaDescription: scenario.meta_description || null,

    // Datumsquellen fÃ¼r das Article-Schema (siehe SzenarioArtikelView).
    //   published_at     â€” beim ersten Publish gesetzt, nie zurÃ¼ckgesetzt.
    //   last_reviewed_at â€” redaktionelles Datum der letzten inhaltlichen PrÃ¼fung.
    // updated_at wird BEWUSST nicht durchgereicht: der Trigger set_updated_at()
    // hebt es bei jedem UPDATE an, also auch bei reinen Status- oder
    // SortierungsÃ¤nderungen. Als dateModified wÃ¤re es eine Behauptung Ã¼ber eine
    // inhaltliche Ã„nderung, die nie stattgefunden hat.
    publishedAt: scenario.published_at || null,
    lastReviewedAt: scenario.last_reviewed_at || null,

    // Quellenangaben im Anzeigeformat [{title, publisher, url}].
    // Dieselbe Funktion normalisiert auch Legacy-Szenarien in
    // SzenarioArtikelView â€” DB und Legacy landen dadurch im identischen Format
    // und teilen sich einen einzigen Renderpfad. Fehlt die Spalte (etwa bevor
    // die Migration angewendet wurde), ergibt das ein leeres Array und der
    // Quellenblock entfÃ¤llt, statt dass die Seite bricht.
    sources: toDisplaySources(scenario.sources),
  };
}

/**
 * Extrahiert searchParams aus cta_config fÃ¼r die Legacy-Komponentenform.
 * @private
 */
function _extractSearchParams(ctaConfig, searchConfig = {}) {
  const c = ctaConfig || {};
  return {
    ...(c.spec ? { spec: c.spec } : {}),
    ...(c.focus ? { focus: c.focus } : {}),
    ...(c.loc ? { loc: c.loc } : {}),
    ...(c.delivery ? { delivery: normalizeDeliveryTypeKey(c.delivery) || c.delivery } : {}),
    ...(c.kursart || searchConfig.kursart ? { kursart: c.kursart || searchConfig.kursart } : {}),
  };
}
