/**
 * Datenadapter: DB-Format → Legacy-Komponentenformat
 *
 * Übersetzt Daten aus der neuen Themenwelten-Datenbank in das Format,
 * das die bestehenden Komponenten BereichLandingPage und SzenarioArtikelView
 * erwarten. Dadurch müssen diese Komponenten beim Pilot-Start minimal geändert werden.
 *
 * In Phase 4: Nur getestet, nicht aktiv genutzt (Feature-Flag ist aus).
 * In Phase 5: Wird aktiviert wenn der Pilot-Flag für eine Themenwelt gesetzt ist.
 *
 * Segmentnormalisierung:
 *   DB:  db_segment = 'professionell' | 'privat' | 'kinder'
 *   URL: url_segment = 'beruflich' | 'privat-hobby' | 'kinder-jugend'
 *   Config key (typeKey): 'beruflich' | 'privat_hobby' | 'kinder_jugend'
 */

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Mapping DB-Segment → URL-Segment */
const DB_TO_URL_SEGMENT = {
  professionell: 'beruflich',
  privat: 'privat-hobby',
  kinder: 'kinder-jugend',
};

/** Mapping DB-Segment → interner Config-Key (typeKey) */
const DB_TO_TYPE_KEY = {
  professionell: 'beruflich',
  privat: 'privat_hobby',
  kinder: 'kinder_jugend',
};

/** Mapping URL-Segment → DB-Segment */
const URL_TO_DB_SEGMENT = {
  beruflich: 'professionell',
  'privat-hobby': 'privat',
  'kinder-jugend': 'kinder',
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Normalisiert ein URL-Segment (Bindestriche oder Unterstriche → Bindestriche).
 *
 * @param {string} segment
 * @returns {string}
 */
export function normalizeUrlSegment(segment) {
  if (!segment) return '';
  return segment.toLowerCase().replace(/_/g, '-').trim();
}

/**
 * Gibt den internen Config-Key (typeKey) für ein URL-Segment zurück.
 *
 * @param {string} urlSegment - 'beruflich' | 'privat-hobby' | 'kinder-jugend'
 * @returns {string} typeKey mit Unterstrichen
 */
export function urlSegmentToTypeKey(urlSegment) {
  const normalized = normalizeUrlSegment(urlSegment);
  return normalized.replace(/-/g, '_');
}

/**
 * Gibt den URL-Segment für ein DB-Segment zurück.
 *
 * @param {string} dbSegment - 'professionell' | 'privat' | 'kinder'
 * @returns {string}
 */
export function dbSegmentToUrlSegment(dbSegment) {
  return DB_TO_URL_SEGMENT[dbSegment] || dbSegment;
}

/**
 * Gibt den DB-Segment für ein URL-Segment zurück.
 *
 * @param {string} urlSegment - 'beruflich' | 'privat-hobby' | 'kinder-jugend'
 * @returns {string}
 */
export function urlSegmentToDbSegment(urlSegment) {
  const normalized = normalizeUrlSegment(urlSegment);
  return URL_TO_DB_SEGMENT[normalized] || normalized;
}

// ---------------------------------------------------------------------------
// Haupt-Adapter: ThemeWorld → BereichLandingPage-Format
// ---------------------------------------------------------------------------

/**
 * Adaptiert einen vollständigen Themenwelt-Datensatz (inkl. Untertabellen)
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
    // Identität
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

    // Bilder
    heroImageUrl: themeWorld.hero_image_url || null,
    heroImageAlt: themeWorld.hero_image_alt_de || '',
    ogImageUrl: themeWorld.og_image_url || null,

    // SEO
    metaTitle: themeWorld.meta_title || null,
    metaDescription: themeWorld.meta_description || null,

    // Suche
    searchConfig: {
      areaSlug: searchConfig.area_slug || themeWorld.area_slug,
      typeKey: searchConfig.type_key || typeKey,
      defaultSpec: searchConfig.default_spec || null,
      defaultFocus: searchConfig.default_focus || null,
    },

    // Abschnittsüberschriften-Overrides
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
// Adapter für Szenario-Karten (Listeneintrag)
// ---------------------------------------------------------------------------

/**
 * Adaptiert einen Szenario-Artikel für die Karten-Anzeige auf der Landingpage.
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
// Adapter für Szenario-Artikel (Vollansicht)
// ---------------------------------------------------------------------------

/**
 * Adaptiert einen vollständigen Szenario-Artikel für SzenarioArtikelView.
 *
 * @param {object} scenario - Vollständige Zeile aus theme_world_scenarios
 * @param {object} themeWorld - Eltern-Themenwelt für Kontext
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
      areaSlug: twSearchConfig.area_slug || themeWorld?.area_slug || null,
      typeKey: urlSegmentToTypeKey(urlSegment),
    },

    // Metadaten
    sortOrder: scenario.sort_order,
    publishedAt: scenario.published_at,
    updatedAt: scenario.updated_at,
    lastReviewedAt: scenario.last_reviewed_at,
  };
}

// ---------------------------------------------------------------------------
// Adapter für Untertabellen
// ---------------------------------------------------------------------------

function adaptPredefinedSearch(search) {
  return {
    label: search.label_de,
    spec: search.spec || null,
    focus: search.focus || null,
    loc: search.loc || null,
    delivery: search.delivery || null,
  };
}

function adaptCtaLink(link) {
  return {
    label: link.label_de,
    loc: link.loc || null,
    delivery: link.delivery || null,
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
