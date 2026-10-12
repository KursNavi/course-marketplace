import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, ChevronRight, ChevronLeft, ChevronDown, CreditCard, Info, Shield, Briefcase, Palette, Smile, BookOpen, LayoutGrid, Compass, Filter, X } from 'lucide-react';
import { LocationDropdown, DeliveryTypeFilter, LanguageDropdown } from './Filters';
import { CATEGORY_TYPES, SEGMENT_CONFIG, DELIVERY_TYPES } from '../lib/constants';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { BASE_URL } from '../lib/siteConfig';
import { RATGEBER_STRUCTURE } from '../lib/ratgeberStructure';
import { getBereicheForSegment, getBereichUrl } from '../lib/bereichLandingConfig';
import { NewsletterSignup } from './Layout';

// Pro Segment: Anzeigefarbe (Beruflich=blau, Privat & Hobby=orange, Kinder & Jugend=gruen) und Icon.
// Rein praesentational — wird fuer Wegweiser-Kacheln, Suchbereich-Pills und Wegkarten verwendet.
const SEGMENT_VISUALS = {
  beruflich: { icon: Briefcase, bg: 'bg-segBeruflich', text: 'text-segBeruflich', border: 'border-segBeruflich' },
  privat_hobby: { icon: Palette, bg: 'bg-primary', text: 'text-primary', border: 'border-primary' },
  kinder_jugend: { icon: Smile, bg: 'bg-segKinder', text: 'text-segKinder', border: 'border-segKinder' },
};

export const Home = ({
  lang, t, setView, courses, // Jetzt haben wir Zugriff auf die Kurse!
  setSearchType, setSearchArea, setSearchSpecialty, setSearchFocus,
  searchQuery, setSearchQuery,
  catMenuOpen, setCatMenuOpen, catMenuRef,
  selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef,
  filterPro, setFilterPro, filterDirectBooking, setFilterDirectBooking,
  selectedDeliveryTypes, setSelectedDeliveryTypes, deliveryMenuOpen, setDeliveryMenuOpen, deliveryMenuRef,
  selectedLanguages, setSelectedLanguages, langMenuOpen, setLangMenuOpen, langMenuRef,
  isLoading = false
}) => {

  // Load taxonomy from DB (with fallback to constants.js)
  const { taxonomy, types, areas, getTypeLabel: dbGetTypeLabel, getAreaLabel: dbGetAreaLabel } = useTaxonomy();

  // --- KATEGORIEN-BROWSING STATE ("Nach Kategorien stöbern") ---
  // null = noch nichts ausgewaehlt -> zeigt nur die 3 Einstiege, keine lange Liste.
  const [activeType, setActiveType] = useState(null);           // Ebene 1 Auswahl
  const [activeArea, setActiveArea] = useState(null);           // Ebene 2 Auswahl
  const [activeSpecialty, setActiveSpecialty] = useState(null); // Ebene 3 Auswahl

  // --- LOGIK: Nur Kategorien mit Kursen anzeigen ---
  // Map frontend type keys to DB type slugs (same as SearchPageView)
  const TYPE_TO_DB = {
    beruflich: 'professionell', privat_hobby: 'privat', kinder_jugend: 'kinder',
    professionell: 'professionell', privat: 'privat', kinder: 'kinder'
  };

  // Ebene 2: welche Bereiche hat ein Typ, mit Kursen dahinter?
  const getAreasFor = (typeKey) => {
    if (!courses || courses.length === 0 || areas.length === 0 || !typeKey) return [];
    const dbType = TYPE_TO_DB[typeKey] || typeKey;
    const areaSlugs = new Set();
    courses.forEach(c => {
      (c.all_categories || []).forEach(cat => {
        if (cat.category_type === dbType && cat.category_area) {
          areaSlugs.add(cat.category_area);
        }
      });
    });
    // Return only DB-known area slugs, sorted alphabetically by label
    return areas
      .filter(a => areaSlugs.has(a.slug))
      .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'))
      .map(a => a.slug);
  };

  // Ebene 3: welche Spezialgebiete hat ein Bereich, mit Kursen dahinter?
  const getSpecialtiesFor = (typeKey, areaSlug) => {
    if (!courses || courses.length === 0 || !areaSlug) return [];
    const dbType = TYPE_TO_DB[typeKey] || typeKey;
    const specs = new Map();
    courses.forEach(c => {
      (c.all_categories || []).forEach(cat => {
        if (cat.category_type === dbType && cat.category_area === areaSlug && (cat.category_specialty || cat.category_specialty_label)) {
          const label = cat.category_specialty_label || cat.category_specialty;
          if (!specs.has(label)) {
            specs.set(label, { label, slug: cat.category_specialty, hasFocuses: !!cat.category_focus });
          } else if (cat.category_focus) {
            specs.get(label).hasFocuses = true;
          }
        }
      });
    });
    return [...specs.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
  };

  // Ebene 4: welche Schwerpunkte hat ein Spezialgebiet, mit Kursen dahinter?
  const getFocusesFor = (typeKey, areaSlug, specialtyLabel) => {
    if (!courses || courses.length === 0 || !areaSlug || !specialtyLabel) return [];
    const dbType = TYPE_TO_DB[typeKey] || typeKey;
    const focuses = new Set();
    courses.forEach(c => {
      (c.all_categories || []).forEach(cat => {
        if (cat.category_type === dbType && cat.category_area === areaSlug &&
            (cat.category_specialty_label === specialtyLabel || cat.category_specialty === specialtyLabel) &&
            cat.category_focus) {
          focuses.add(cat.category_focus_label || cat.category_focus);
        }
      });
    });
    return [...focuses].sort((a, b) => a.localeCompare(b, 'de'));
  };

  const visibleAreas = getAreasFor(activeType);
  const visibleSpecialties = getSpecialtiesFor(activeType, activeArea);
  const visibleFocuses = getFocusesFor(activeType, activeArea, activeSpecialty);

  // --- FREITEXTSUCHE: Zieltyp wird aus dem Suchbegriff geraten (kein manueller
  // Bereichs-Umschalter mehr in der Suchkarte — das uebernimmt die Kategorien-Navigation links). ---
  // Keyword-based auto-detection (Option B: no DB query)
  const guessTypeFromQuery = (q) => {
    const lower = q.toLowerCase();
    const kinderKeywords = ['kinder', 'jugend', 'camp', 'feriencamp', 'geburtstag', 'kid', 'schüler'];
    const beruflichKeywords = ['excel', 'zertifikat', 'zertifizierung', 'ausbildung', 'diplom',
      'fachausweis', 'mba', 'cas', 'das', 'eidg', 'fachkraft', 'weiterbildung',
      'berufs', 'karriere', 'lehrgang', 'seminar', 'brevet'];
    if (kinderKeywords.some(kw => lower.includes(kw))) return 'kinder_jugend';
    if (beruflichKeywords.some(kw => lower.includes(kw))) return 'beruflich';
    return 'privat_hobby';
  };

  // --- ACTIONS ---

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedLocations?.length) params.set('loc', selectedLocations.join(','));
    if (selectedDeliveryTypes?.length) params.set('delivery', selectedDeliveryTypes.join(','));

    // Auto-detect segment from query, mark with autoType flag for search page hint
    const guessedType = searchQuery ? guessTypeFromQuery(searchQuery) : 'privat_hobby';
    params.set('type', guessedType);
    params.set('autoType', '1');

    window.history.pushState({ view: 'search' }, '', '/search?' + params.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Gemeinsame Filter (Ort, Kursformat, Sprache, Verifiziert, Direktbuchung) werden NICHT hier in
  // die URL geschrieben: App.jsx synchronisiert sie automatisch in die URL, sobald `view` auf
  // 'search' wechselt (siehe App.jsx, useEffect ueber searchType/.../filterDirectBooking). Dadurch
  // gelten dieselben Filter gleichermassen fuer die Kategorien-Navigation und die Freitextsuche.
  const handleCategorySelect = (typeKey, areaKey, specialtyKey, focusKey) => {
    setSearchType(typeKey);
    setSearchArea(areaKey || "");
    setSearchSpecialty(specialtyKey || "");
    setSearchFocus(focusKey || "");

    setCatMenuOpen(false);
    const params = new URLSearchParams();
    if (typeKey) params.set('type', typeKey);
    if (areaKey) params.set('area', areaKey);
    if (specialtyKey) params.set('spec', specialtyKey);
    if (focusKey) params.set('focus', focusKey);
    const qs = params.toString();
    window.history.pushState({ view: 'search' }, '', '/search' + (qs ? '?' + qs : ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Klick-Handler fuer "Nach Kategorien stöbern" ---
  // Springt automatisch zur Suche, sobald eine ausgewaehlte Ebene keine weitere
  // Unterebene mit Kursen mehr hat (= Blatt der Kategorie erreicht).
  const selectType = (typeKey) => {
    setActiveType(typeKey);
    setActiveArea(null);
    setActiveSpecialty(null);
    if (getAreasFor(typeKey).length === 0) {
      handleCategorySelect(typeKey, null, null, null);
    }
  };

  const selectArea = (areaSlug) => {
    setActiveArea(areaSlug);
    setActiveSpecialty(null);
    if (getSpecialtiesFor(activeType, areaSlug).length === 0) {
      handleCategorySelect(activeType, areaSlug, null, null);
    }
  };

  const selectSpecialty = (specialtyLabel, hasFocuses) => {
    if (!hasFocuses) {
      handleCategorySelect(activeType, activeArea, specialtyLabel, null);
      return;
    }
    setActiveSpecialty(specialtyLabel);
  };

  const selectFocus = (focusLabel) => {
    handleCategorySelect(activeType, activeArea, activeSpecialty, focusLabel);
  };

  const showAllInArea = () => handleCategorySelect(activeType, activeArea, null, null);
  const showAllInSpecialty = () => handleCategorySelect(activeType, activeArea, activeSpecialty, null);

  const resetToAllCategories = () => {
    setActiveType(null);
    setActiveArea(null);
    setActiveSpecialty(null);
  };

  // --- GEMEINSAME FILTER (gelten fuer Kategorien-Navigation UND Freitextsuche) ---
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const secondaryFilterCount = [selectedLanguages?.length > 0, filterPro, filterDirectBooking].filter(Boolean).length;
  const hasActiveHomeFilters = selectedLocations?.length > 0 || selectedDeliveryTypes?.length > 0 || secondaryFilterCount > 0;

  const resetAllHomeFilters = () => {
    setSelectedLocations([]);
    setSelectedDeliveryTypes([]);
    setSelectedLanguages([]);
    setFilterPro(false);
    setFilterDirectBooking(false);
  };

  // Helper für Labels - use DB taxonomy first, then fallback to constants
  const getTypeLabel = (key) => {
    // Try DB taxonomy first
    const dbLabel = dbGetTypeLabel(key, lang);
    if (dbLabel && dbLabel !== key) return dbLabel;
    // Fallback to constants
    return CATEGORY_TYPES[key]?.[lang] || CATEGORY_TYPES[key]?.de || key;
  };

  const getAreaLabel = (type, areaKey) => {
    // First, try to find area by exact slug match
    let areaBySlug = areas.find(a => a.slug === areaKey);
    // If not found, try partial match (e.g. it_digital -> it_digitales)
    if (!areaBySlug) {
      areaBySlug = areas.find(a => a.slug.startsWith(areaKey) || areaKey.startsWith(a.slug));
    }
    if (areaBySlug) {
      return areaBySlug[`label_${lang}`] || areaBySlug.label_de || areaKey;
    }
    // Try DB taxonomy lookup
    const dbLabel = dbGetAreaLabel(type, areaKey, lang);
    if (dbLabel && dbLabel !== areaKey) return dbLabel;
    // Fallback: return the key itself
    return areaKey;
  };

  // SEO Meta Tags for Home Page
  useEffect(() => {
    document.title = 'Kurse in der Schweiz finden – Weiterbildung, Hobby & Kinder | KursNavi';

    const metaDescription = 'Finde Kurse in der Schweiz: berufliche Weiterbildungen, Hobbykurse und Angebote für Kinder und Jugendliche. Vergleiche Anbieter und entdecke passende Kurse.';

    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
        metaDescTag = document.createElement('meta');
        metaDescTag.name = 'description';
        document.head.appendChild(metaDescTag);
    }
    metaDescTag.content = metaDescription;

    // Canonical URL
    const canonicalUrl = `${BASE_URL}/`;
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
        canonicalTag = document.createElement('link');
        canonicalTag.rel = 'canonical';
        document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonicalUrl;

    // Clean up stale hreflang tags from other pages
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(tag => tag.remove());

    // OG Tags
    const ogTags = {
        'og:title': 'Kurse in der Schweiz finden – KursNavi',
        'og:description': metaDescription,
        'og:url': canonicalUrl,
        'og:image': `${BASE_URL}/og-default.png`,
        'og:type': 'website',
        'og:locale': 'de_CH',
        'og:site_name': 'KursNavi',
        'twitter:card': 'summary_large_image',
        'twitter:title': 'Kurse in der Schweiz finden – KursNavi',
        'twitter:description': metaDescription,
        'twitter:image': `${BASE_URL}/og-default.png`
    };

    Object.entries(ogTags).forEach(([property, content]) => {
        let tag = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            if (property.startsWith('twitter:')) {
                tag.name = property;
            } else {
                tag.setAttribute('property', property);
            }
            document.head.appendChild(tag);
        }
        tag.content = content;
    });

    // Organization Schema
    const organizationData = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "KursNavi",
        "url": BASE_URL,
        "logo": `${BASE_URL}/og-default.png`,
        "description": "Der Schweizer Kursmarktplatz für Weiterbildung, Freizeit und Kinderkurse",
        "address": {
            "@type": "PostalAddress",
            "addressCountry": "CH"
        },
        "sameAs": [
            "https://www.linkedin.com/company/kursnavi"
        ]
    };

    let orgScript = document.querySelector('script[data-schema="organization"]');
    if (!orgScript) {
        orgScript = document.createElement('script');
        orgScript.type = 'application/ld+json';
        orgScript.setAttribute('data-schema', 'organization');
        document.head.appendChild(orgScript);
    }
    orgScript.text = JSON.stringify(organizationData);

    // SearchAction Schema (enables Google Sitelinks Search Box)
    const searchActionData = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "KursNavi",
        "url": BASE_URL,
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${BASE_URL}/search?q={search_term_string}`
            },
            "query-input": "required name=search_term_string"
        }
    };

    let searchScript = document.querySelector('script[data-schema="searchaction"]');
    if (!searchScript) {
        searchScript = document.createElement('script');
        searchScript.type = 'application/ld+json';
        searchScript.setAttribute('data-schema', 'searchaction');
        document.head.appendChild(searchScript);
    }
    searchScript.text = JSON.stringify(searchActionData);
  }, []);

  // Rendert ein Ratgeber-/Themenwelten-Panel fuer ein Segment. Nutzt dieselben
  // Datenquellen wie zuvor (RATGEBER_STRUCTURE, getBereicheForSegment, getBereichUrl) —
  // nur die Darstellung wandert aus den Wegkarten in einen eigenen Abschnitt.
  const renderRatgeberPanel = (segmentKey, label) => {
    const visuals = SEGMENT_VISUALS[segmentKey];
    const SegmentIcon = visuals.icon;
    const clusters = Object.values(RATGEBER_STRUCTURE[segmentKey].clusters);
    const bereiche = getBereicheForSegment(segmentKey);

    return (
      <div key={segmentKey} className={`bg-white border-l-4 ${visuals.border} border-t border-r border-b border-grey rounded-r-xl p-6 md:p-8 shadow-sm`}>
        <div className="flex items-center gap-3 pb-4 border-b border-grey mb-6">
          <span className={`w-8 h-8 rounded-full ${visuals.bg} text-white flex items-center justify-center shrink-0`}>
            <SegmentIcon className="w-4 h-4" />
          </span>
          <h3 className="font-heading text-xl font-bold text-dark">{label}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-label-md text-xs font-bold text-dark uppercase tracking-wider mb-4">{t.ratgeber_title || 'Ratgeber'}</h4>
            <div className="grid grid-cols-1 gap-2.5">
              {clusters.map(cluster => {
                const ClusterIcon = cluster.icon;
                return (
                  <a
                    key={cluster.slug}
                    href={`/ratgeber/${RATGEBER_STRUCTURE[segmentKey].slug}/${cluster.slug}`}
                    onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', `/ratgeber/${RATGEBER_STRUCTURE[segmentKey].slug}/${cluster.slug}`); window.scrollTo(0,0); window.dispatchEvent(new PopStateEvent('popstate')); }}
                    className="flex items-center gap-2.5 p-3 rounded-lg bg-beige hover:bg-grey/60 transition-colors border border-grey/60"
                  >
                    <span className={`shrink-0 w-7 h-7 rounded-lg bg-white border ${visuals.border}/30 flex items-center justify-center`}>
                      <ClusterIcon className={`w-3.5 h-3.5 ${visuals.text}`} />
                    </span>
                    <span className="text-sm font-medium text-dark leading-tight">{cluster.label[lang] || cluster.label.de}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {bereiche.length > 0 && (
            <div className="flex flex-col justify-between">
              <div>
                <h4 className="font-label-md text-xs font-bold text-dark uppercase tracking-wider mb-4">Themenwelten</h4>
                <div className="grid grid-cols-1 gap-2.5">
                  {bereiche.map(bereich => (
                    <a
                      key={bereich.slug}
                      href={getBereichUrl(bereich)}
                      onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', getBereichUrl(bereich)); window.scrollTo(0,0); }}
                      className={`p-4 rounded-lg border-2 ${visuals.border}/30 bg-beige hover:bg-grey/60 transition-colors flex items-center justify-between text-dark`}
                    >
                      <span className="text-sm font-bold">{bereich.title[lang] || bereich.title.de}</span>
                      <ArrowRight className={`w-4 h-4 shrink-0 ${visuals.text}`} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">Weitere Themenwelten sind in Arbeit und folgen demnächst.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col w-full font-sans">
      {isLoading && (
        <div className="absolute inset-x-0 top-0 z-40 flex h-[60vh] items-center justify-center pointer-events-none">
          <div
            className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
            role="status"
            aria-label="Laden"
          ></div>
        </div>
      )}

      
      {/* 1. HERO SECTION — zwei gleichwertige Einstiege: Kategorien stoebern (links) und
          gezielte Suche (rechts), darunter gemeinsame Filter fuer beide Wege. */}
      <div className="relative w-full bg-petrol text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">

          {/* Ueberschrift ueber die gesamte Hero-Breite — gemeinsame Einleitung fuer beide Spalten */}
          <div className="text-center lg:text-left mb-10">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-5 tracking-tight">
              {t.home_headline}
            </h1>
            <p className="text-lg text-white/80 font-sans max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {t.home_subhead}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

            {/* LINKS (Desktop) / 2. Block (Mobile): Nach Kategorien stöbern */}
            <div className="order-2 lg:order-1 bg-beige text-dark p-6 md:p-8 rounded-xl border border-grey shadow-xl flex flex-col">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-dark mb-1">
                <Compass className="w-5 h-5 text-petrol" aria-hidden="true" />
                Nach Kategorien stöbern
              </h2>
              <p className="text-xs text-gray-500 mb-4">Entdecke das Kursangebot Schritt für Schritt nach Thema.</p>

              {/* Breadcrumb: immer sichtbar, "Alle Kategorien" fuehrt zurueck zum Start */}
              <nav aria-label="Kategorie-Pfad" className="flex flex-wrap items-center gap-1 text-xs mb-4 pb-4 border-b border-grey">
                <button
                  type="button"
                  onClick={resetToAllCategories}
                  aria-current={!activeType ? 'page' : undefined}
                  className={`rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol hover:underline ${!activeType ? 'font-semibold text-dark' : 'text-gray-500'}`}
                >
                  Alle Kategorien
                </button>
                {activeType && (
                  <>
                    <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => { setActiveArea(null); setActiveSpecialty(null); }}
                      aria-current={!activeArea ? 'page' : undefined}
                      className={`rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol hover:underline ${!activeArea ? 'font-semibold text-dark' : 'text-gray-500'}`}
                    >
                      {getTypeLabel(activeType)}
                    </button>
                  </>
                )}
                {activeArea && (
                  <>
                    <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setActiveSpecialty(null)}
                      aria-current={!activeSpecialty ? 'page' : undefined}
                      className={`rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol hover:underline ${!activeSpecialty ? 'font-semibold text-dark' : 'text-gray-500'}`}
                    >
                      {getAreaLabel(activeType, activeArea)}
                    </button>
                  </>
                )}
                {activeSpecialty && (
                  <>
                    <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" aria-hidden="true" />
                    <span aria-current="page" className="font-semibold text-dark">{activeSpecialty}</span>
                  </>
                )}
              </nav>

              {/* Ebene 1: Beruflich / Privat & Hobby / Kinder & Jugend */}
              {!activeType && (
                <div className="flex flex-col gap-2">
                  {[
                    { key: 'beruflich', label: t.nav_professional || 'Beruflich' },
                    { key: 'privat_hobby', label: t.nav_private || 'Privat & Hobby' },
                    { key: 'kinder_jugend', label: t.nav_kids || 'Kinder & Jugend' },
                  ].map(({ key, label }) => {
                    const { icon: Icon, bg, border } = SEGMENT_VISUALS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectType(key)}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-md border border-grey bg-white hover:${border}/50 hover:bg-beige transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol`}
                      >
                        <span className={`w-8 h-8 rounded-full ${bg} text-white flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="flex-1 text-sm font-semibold text-dark">{label}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Ebene 2: Bereiche im gewaehlten Typ */}
              {activeType && !activeArea && (
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {visibleAreas.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">Keine weiteren Unterkategorien verfügbar.</p>
                  ) : visibleAreas.map(areaSlug => (
                    <button
                      key={areaSlug}
                      type="button"
                      onClick={() => selectArea(areaSlug)}
                      className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-md border border-grey bg-white hover:border-petrol/40 hover:bg-beige transition-colors text-left text-sm text-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol"
                    >
                      <span>{getAreaLabel(activeType, areaSlug)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              {/* Ebene 3: Spezialgebiete im gewaehlten Bereich */}
              {activeType && activeArea && !activeSpecialty && (
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={showAllInArea}
                    className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-md border border-petrol/30 bg-petrol/5 hover:bg-petrol/10 transition-colors text-left text-sm font-medium text-petrol focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol"
                  >
                    <span>Alle Kurse in {getAreaLabel(activeType, activeArea)}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                  {visibleSpecialties.map(spec => (
                    <button
                      key={spec.label}
                      type="button"
                      onClick={() => selectSpecialty(spec.label, spec.hasFocuses)}
                      className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-md border border-grey bg-white hover:border-petrol/40 hover:bg-beige transition-colors text-left text-sm text-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol"
                    >
                      <span>{spec.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              {/* Ebene 4: Schwerpunkte im gewaehlten Spezialgebiet */}
              {activeType && activeArea && activeSpecialty && visibleFocuses.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={showAllInSpecialty}
                    className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-md border border-petrol/30 bg-petrol/5 hover:bg-petrol/10 transition-colors text-left text-sm font-medium text-petrol focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol"
                  >
                    <span>Alle Kurse in {activeSpecialty}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                  {visibleFocuses.map(focus => (
                    <button
                      key={focus}
                      type="button"
                      onClick={() => selectFocus(focus)}
                      className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-md border border-grey bg-white hover:border-petrol/40 hover:bg-beige transition-colors text-left text-sm text-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol"
                    >
                      <span>{focus}</span>
                      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RECHTS (Desktop) / 1. Block (Mobile): Gezielt suchen */}
            <div className="order-1 lg:order-2 bg-beige text-dark p-6 md:p-8 rounded-xl border border-grey shadow-xl flex flex-col">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-dark mb-1">
                <Search className="w-5 h-5 text-petrol" aria-hidden="true" />
                Gezielt suchen
              </h2>
              <p className="text-xs text-gray-500 mb-4">Du weisst schon, wonach du suchst? Dann direkt eintippen.</p>

              <form onSubmit={handleSearch} className="flex flex-col gap-4 flex-1">
                <div className="flex flex-col gap-1.5 text-left">
                  <label
                    htmlFor="home-search-input"
                    className="text-xs font-semibold text-dark uppercase tracking-wide"
                  >
                    {t.search_placeholder}
                  </label>
                  <div className="relative flex items-center">
                    <Search className="absolute left-4 text-gray-400 w-5 h-5" aria-hidden="true" />
                    <input
                      id="home-search-input"
                      type="text"
                      placeholder={t.search_placeholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-md text-dark font-sans border border-grey focus:outline-none focus:ring-2 focus:ring-petrol focus:border-petrol text-base bg-white placeholder:text-gray-400"
                    />
                  </div>
                  <details className="mt-0.5">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-gray-500 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                      {t.search_help_label || 'Such-Tipp'}
                    </summary>
                    <p className="pb-1 text-xs text-gray-500">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe mit AND oder OR (z.B. "Yoga AND Zürich")'}</p>
                  </details>
                </div>

                <button
                  type="submit"
                  className="mt-auto w-full bg-petrol hover:bg-petrolDark text-white font-label-md text-sm font-semibold px-6 py-3.5 rounded-md transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-petrol"
                >
                  <span>{t.btn_search}</span>
                  <Search className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            </div>

          </div>

          {/* GEMEINSAME FILTER — wirken identisch auf Kategorien-Navigation und Freitextsuche,
              da beide ueber dieselben App-weiten Filter-Zustaende (Ort, Kursformat, Sprache,
              Verifiziert, Direktbuchung) in die Suche gehen (siehe App.jsx URL-Sync-Effekt). */}
          <div className="mt-6 bg-beige text-dark p-6 md:p-8 rounded-xl border border-grey shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-dark uppercase tracking-wide">{t.filter_label_loc || 'Ort'}</label>
                <div className="bg-white rounded-md border border-grey">
                  <LocationDropdown
                    selectedLocations={selectedLocations}
                    setSelectedLocations={setSelectedLocations}
                    locMenuOpen={locMenuOpen}
                    setLocMenuOpen={setLocMenuOpen}
                    locMenuRef={locMenuRef}
                    t={t}
                    buttonClassName={`w-full px-4 py-3 flex items-center justify-between font-medium rounded-md text-sm transition-colors ${locMenuOpen ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-gray-700 hover:bg-gray-50'}`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-dark uppercase tracking-wide">Kursformat</label>
                <div className="bg-white rounded-md border border-grey">
                  <DeliveryTypeFilter
                    selectedDeliveryTypes={selectedDeliveryTypes}
                    setSelectedDeliveryTypes={setSelectedDeliveryTypes}
                    deliveryMenuOpen={deliveryMenuOpen}
                    setDeliveryMenuOpen={setDeliveryMenuOpen}
                    deliveryMenuRef={deliveryMenuRef}
                    t={t}
                    buttonClassName={`w-full px-4 py-3 flex items-center justify-between font-medium rounded-md text-sm transition-colors ${deliveryMenuOpen ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-gray-700 hover:bg-gray-50'}`}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMoreFilters(v => !v)}
              aria-expanded={showMoreFilters}
              aria-controls="home-more-filters"
              className={`mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol ${showMoreFilters ? 'bg-grey/60 border-grey text-dark' : 'bg-white border-grey text-gray-500 hover:text-dark hover:border-petrol/30'}`}
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              Weitere Filter{secondaryFilterCount > 0 ? ` (${secondaryFilterCount})` : ''}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {showMoreFilters && (
              <div id="home-more-filters" className="mt-3 pt-3 border-t border-grey flex flex-wrap gap-3 items-center">
                <LanguageDropdown
                  selectedLanguages={selectedLanguages}
                  setSelectedLanguages={setSelectedLanguages}
                  langMenuOpen={langMenuOpen}
                  setLangMenuOpen={setLangMenuOpen}
                  langMenuRef={langMenuRef}
                  t={t}
                />
                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${filterPro ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white border-grey text-gray-600'}`}>
                  <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  <span>{t.lbl_professional_filter || 'Verifiziert'}</span>
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                </label>
                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${filterDirectBooking ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white border-grey text-gray-600'}`}>
                  <input type="checkbox" checked={filterDirectBooking} onChange={(e) => setFilterDirectBooking(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  <span>{t.lbl_direct_booking_filter || 'Direktbuchung'}</span>
                  <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                </label>
              </div>
            )}

            {/* Aktive Filter zusammengefasst + Zuruecksetzen */}
            {hasActiveHomeFilters && (
              <div className="mt-4 pt-3 border-t border-grey flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">Aktive Filter:</span>
                {selectedLocations?.map(loc => (
                  <span key={loc} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md bg-grey/60 text-xs text-dark">
                    {loc}
                    <button type="button" onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} aria-label={`Ort ${loc} entfernen`} className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {selectedDeliveryTypes?.map(dtKey => (
                  <span key={dtKey} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md bg-grey/60 text-xs text-dark">
                    {DELIVERY_TYPES[dtKey]?.[lang] || DELIVERY_TYPES[dtKey]?.de || dtKey}
                    <button type="button" onClick={() => setSelectedDeliveryTypes(selectedDeliveryTypes.filter(d => d !== dtKey))} aria-label="Kursformat entfernen" className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {selectedLanguages?.map(langKey => (
                  <span key={langKey} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md bg-grey/60 text-xs text-dark">
                    {langKey}
                    <button type="button" onClick={() => setSelectedLanguages(selectedLanguages.filter(l => l !== langKey))} aria-label={`Sprache ${langKey} entfernen`} className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {filterPro && (
                  <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md bg-grey/60 text-xs text-dark">
                    {t.lbl_professional_filter || 'Verifiziert'}
                    <button type="button" onClick={() => setFilterPro(false)} aria-label="Verifiziert-Filter entfernen" className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                {filterDirectBooking && (
                  <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md bg-grey/60 text-xs text-dark">
                    {t.lbl_direct_booking_filter || 'Direktbuchung'}
                    <button type="button" onClick={() => setFilterDirectBooking(false)} aria-label="Direktbuchung-Filter entfernen" className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={resetAllHomeFilters}
                  className="ml-auto text-xs font-semibold text-petrol hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded"
                >
                  Alle zurücksetzen
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 2. WAEHLE DEINEN WEG — drei gleichwertige Kurswelten, Segmentfarben Blau/Orange/Gruen.
          Bewusst ohne Nummerierung ("Bereich 01/02/03") an den Karten, aus demselben Grund
          wie beim Wegweiser oben: die drei Bereiche sind gleichwertig, keine Rangfolge. */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 pb-4 border-b border-grey gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-petrol uppercase tracking-wider mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-petrol"></span>
              <span>Drei klare Richtungen</span>
            </div>
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-dark">{t.home_path_title}</h2>
            <p className="font-sans text-gray-500 mt-1">{t.home_path_sub}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* BERUFLICH - Blau */}
          <a href="/search?type=beruflich" onClick={(e) => { e.preventDefault(); setSearchType('beruflich'); window.history.pushState({ view: 'search' }, '', '/search?type=beruflich'); window.scrollTo(0,0); }} className="group bg-white border-t-4 border-segBeruflich border-x border-b border-grey rounded-b-lg p-6 md:p-8 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-end mb-4">
                <Briefcase className="w-5 h-5 text-segBeruflich" aria-hidden="true" />
              </div>
              <div className="h-44 w-full rounded overflow-hidden mb-5 bg-beige">
                <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="font-heading text-xl font-bold text-dark mb-2">{t.nav_professional}</h3>
              <p className="font-sans text-gray-500 text-sm mb-6">{t.home_card_prof_sub}</p>
            </div>
            <span className="inline-flex items-center justify-between pt-4 border-t border-grey font-semibold text-sm text-segBeruflich group-hover:translate-x-1 transition-transform">
              {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </span>
          </a>

          {/* PRIVAT & HOBBY - Orange */}
          <a href="/search?type=privat_hobby" onClick={(e) => { e.preventDefault(); setSearchType('privat_hobby'); window.history.pushState({ view: 'search' }, '', '/search?type=privat_hobby'); window.scrollTo(0,0); }} className="group bg-white border-t-4 border-primary border-x border-b border-grey rounded-b-lg p-6 md:p-8 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-end mb-4">
                <Palette className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div className="h-44 w-full rounded overflow-hidden mb-5 bg-beige">
                <img src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="font-heading text-xl font-bold text-dark mb-2">{t.nav_private}</h3>
              <p className="font-sans text-gray-500 text-sm mb-6">{t.home_card_priv_sub}</p>
            </div>
            <span className="inline-flex items-center justify-between pt-4 border-t border-grey font-semibold text-sm text-primary group-hover:translate-x-1 transition-transform">
              {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </span>
          </a>

          {/* KINDER & JUGEND - Gruen */}
          <a href="/search?type=kinder_jugend" onClick={(e) => { e.preventDefault(); setSearchType('kinder_jugend'); window.history.pushState({ view: 'search' }, '', '/search?type=kinder_jugend'); window.scrollTo(0,0); }} className="group bg-white border-t-4 border-segKinder border-x border-b border-grey rounded-b-lg p-6 md:p-8 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-end mb-4">
                <Smile className="w-5 h-5 text-segKinder" aria-hidden="true" />
              </div>
              <div className="h-44 w-full rounded overflow-hidden mb-5 bg-beige">
                <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="font-heading text-xl font-bold text-dark mb-2">{t.nav_kids}</h3>
              <p className="font-sans text-gray-500 text-sm mb-6">{t.home_card_kids_sub}</p>
            </div>
            <span className="inline-flex items-center justify-between pt-4 border-t border-grey font-semibold text-sm text-segKinder group-hover:translate-x-1 transition-transform">
              {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </span>
          </a>

        </div>
      </div>

      {/* 3. RATGEBER & THEMENWELTEN — eigener Abschnitt, gleiche Datenquellen wie zuvor in den Wegkarten */}
      <div className="bg-[#F6F3F2] border-y border-grey py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-dark mb-2">{t.home_ratgeber_title || 'Ratgeber & Themenwelten'}</h2>
            <p className="font-sans text-gray-500 max-w-2xl">{t.home_ratgeber_sub || ''}</p>
          </div>

          <div className="flex flex-col gap-8">
            {renderRatgeberPanel('beruflich', t.nav_professional || 'Beruflich')}
            {renderRatgeberPanel('privat_hobby', t.nav_private || 'Privat & Hobby')}
            {renderRatgeberPanel('kinder_jugend', t.nav_kids || 'Kinder & Jugend')}
          </div>
        </div>
      </div>

      {/* 4. NEWSLETTER — eigener Bereich auf der Startseite (der Footer blendet seine eigene Karte hier aus, siehe App.jsx) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full" data-testid="home-newsletter-section">
        <NewsletterSignup t={t} />
      </div>
    </div>
  );
};
