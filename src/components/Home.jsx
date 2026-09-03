import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, ChevronRight, ChevronLeft, ChevronDown, CreditCard, Info, Shield, Briefcase, Palette, Smile, BookOpen, LayoutGrid, Compass } from 'lucide-react';
import { LocationDropdown, DeliveryTypeFilter } from './Filters';
import { CATEGORY_TYPES, SEGMENT_CONFIG } from '../lib/constants';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { BASE_URL } from '../lib/siteConfig';
import { RATGEBER_STRUCTURE } from '../lib/ratgeberStructure';
import { getBereicheForSegment, getBereichUrl } from '../lib/bereichLandingConfig';

export const Home = ({
  lang, t, setView, courses, // Jetzt haben wir Zugriff auf die Kurse!
  setSearchType, setSearchArea, setSearchSpecialty, setSearchFocus,
  searchQuery, setSearchQuery,
  catMenuOpen, setCatMenuOpen, catMenuRef,
  selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef,
  filterPro, setFilterPro, filterDirectBooking, setFilterDirectBooking,
  selectedDeliveryTypes, setSelectedDeliveryTypes, deliveryMenuOpen, setDeliveryMenuOpen, deliveryMenuRef,
  isLoading = false
}) => {

  // Load taxonomy from DB (with fallback to constants.js)
  const { taxonomy, types, areas, getTypeLabel: dbGetTypeLabel, getAreaLabel: dbGetAreaLabel } = useTaxonomy();


  // State für das Mega-Menü
  const [activeType, setActiveType] = useState('beruflich'); // Spalte 1 Auswahl
  const [activeArea, setActiveArea] = useState(null);           // Spalte 2 Auswahl
  const [activeSpecialty, setActiveSpecialty] = useState(null);  // Spalte 3 Auswahl

  // --- LOGIK: Nur Kategorien mit Kursen anzeigen ---
  // Map frontend type keys to DB type slugs (same as SearchPageView)
  const TYPE_TO_DB = {
    beruflich: 'professionell', privat_hobby: 'privat', kinder_jugend: 'kinder',
    professionell: 'professionell', privat: 'privat', kinder: 'kinder'
  };

  // 2. Welche Bereiche (Level 2) im aktiven Typ haben Kurse?
  const getActiveAreas = () => {
    if (!courses || courses.length === 0 || areas.length === 0) return [];
    const dbType = TYPE_TO_DB[activeType] || activeType;
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

  // 3. Welche Spezialgebiete (Level 3) im aktiven Bereich haben Kurse?
  const getActiveSpecialties = () => {
    if (!courses || courses.length === 0 || !activeArea) return [];
    const dbType = TYPE_TO_DB[activeType] || activeType;
    const specs = new Map();
    courses.forEach(c => {
      (c.all_categories || []).forEach(cat => {
        if (cat.category_type === dbType && cat.category_area === activeArea && (cat.category_specialty || cat.category_specialty_label)) {
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

  // 4. Welche Focuses (Level 4) im aktiven Spezialgebiet haben Kurse?
  const getActiveFocuses = () => {
    if (!courses || courses.length === 0 || !activeArea || !activeSpecialty) return [];
    const dbType = TYPE_TO_DB[activeType] || activeType;
    const focuses = new Set();
    courses.forEach(c => {
      (c.all_categories || []).forEach(cat => {
        if (cat.category_type === dbType && cat.category_area === activeArea &&
            (cat.category_specialty_label === activeSpecialty || cat.category_specialty === activeSpecialty) &&
            cat.category_focus) {
          focuses.add(cat.category_focus_label || cat.category_focus);
        }
      });
    });
    return [...focuses].sort((a, b) => a.localeCompare(b, 'de'));
  };

  const visibleAreas = getActiveAreas();
  const visibleSpecialties = getActiveSpecialties();
  const visibleFocuses = getActiveFocuses();

  // --- SUCHBEREICH STATE ---
  // 'alle' = no explicit segment (auto-detect on search)
  const [homeSegment, setHomeSegment] = useState('alle');

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

    if (homeSegment && homeSegment !== 'alle') {
      // Explicit segment chosen by user — no auto-type hint needed
      params.set('type', homeSegment);
    } else {
      // Auto-detect segment from query, mark with autoType flag for search page hint
      const guessedType = searchQuery ? guessTypeFromQuery(searchQuery) : 'privat_hobby';
      params.set('type', guessedType);
      params.set('autoType', '1');
    }

    window.history.pushState({ view: 'search' }, '', '/search?' + params.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    document.title = 'KursNavi - Der Schweizer Kursmarktplatz für Weiterbildung & Freizeit';

    const metaDescription = 'Entdecke Kurse in der Schweiz: Weiterbildung, Hobbys sowie Kinder- und Jugendkurse. Vergleiche Anbieter und finde ein Angebot, das zu dir passt.';

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
        'og:title': 'KursNavi - Der Schweizer Kursmarktplatz',
        'og:description': metaDescription,
        'og:url': canonicalUrl,
        'og:image': `${BASE_URL}/og-default.png`,
        'og:type': 'website',
        'og:locale': 'de_CH',
        'og:site_name': 'KursNavi',
        'twitter:card': 'summary_large_image',
        'twitter:title': 'KursNavi - Der Schweizer Kursmarktplatz',
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
        "logo": `${BASE_URL}/images/brand/kursnavi-symbol-original.jpg`,
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

  // Auto-Select first area when type changes (optional, improves UX)
  useEffect(() => {
    const areas = getActiveAreas();
    if (areas.length > 0 && !areas.includes(activeArea)) {
        setActiveArea(areas[0]);
        setActiveSpecialty(null);
    }
  }, [activeType, courses]);

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

      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-visible bg-beige border-b border-[#eadfd8]">
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-primaryLight/80 blur-3xl" />
          <div className="absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-secondaryLight/45 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 lg:py-24 grid lg:grid-cols-[1.05fr_.95fr] gap-12 lg:gap-16 items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary mb-5">
              <span className="h-2 w-2 rounded-full bg-primary" /> KursNavi · Kurse in der Schweiz
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-dark tracking-[-0.045em] leading-[1.06] mb-5">
              {t.home_headline}
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl leading-relaxed">
              {t.home_subhead}
            </p>

            {/* SEARCH & FILTERS CONTAINER */}
            <div className="max-w-2xl bg-white p-3 sm:p-4 rounded-[1.75rem] border border-[#eadfd8] shadow-[0_18px_50px_rgba(93,64,48,0.12)] relative z-50">
              <form onSubmit={handleSearch} className="relative flex flex-col gap-3">
                <label htmlFor="home-search-input" className="sr-only">{t.search_placeholder}</label>
                <div className="relative flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" aria-hidden="true" />
                    <input
                      id="home-search-input"
                      type="text"
                      placeholder={t.search_placeholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl text-dark font-sans focus:outline-none focus:ring-2 focus:ring-primary/40 text-base placeholder-gray-400 bg-beige/70 border border-transparent focus:bg-white"
                    />
                  </div>
                  <button type="submit" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-orange-600 text-white px-6 py-3.5 rounded-2xl font-bold transition-colors duration-300 shrink-0">
                    {t.btn_search} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 px-1">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe, z.B. «Yoga Zürich» oder «Excel online».'}</p>
              </form>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-2.5">Suchbereich</p>
                <div className="flex gap-2 flex-wrap" data-testid="home-segment-selector">
                  {[
                    { key: 'alle', label: 'Alle Bereiche', Icon: null },
                    { key: 'beruflich', label: t.nav_professional || 'Beruflich', Icon: Briefcase },
                    { key: 'privat_hobby', label: t.nav_private || 'Privat & Hobby', Icon: Palette },
                    { key: 'kinder_jugend', label: t.nav_kids || 'Kinder & Jugend', Icon: Smile },
                  ].map(({ key, label, Icon }) => {
                    const isActive = homeSegment === key;
                    const colorStyle = key === 'beruflich'
                      ? (isActive ? 'bg-blue-100 text-blue-800 border-blue-200' : 'text-blue-700 border-blue-100 hover:bg-blue-50')
                      : key === 'privat_hobby'
                        ? (isActive ? 'bg-orange-100 text-orange-800 border-orange-200' : 'text-orange-700 border-orange-100 hover:bg-orange-50')
                        : key === 'kinder_jugend'
                          ? (isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'text-emerald-700 border-emerald-100 hover:bg-emerald-50')
                          : (isActive ? 'bg-dark text-white border-dark' : 'text-gray-600 border-gray-200 hover:bg-gray-50');
                    return (
                      <button
                        key={key}
                        type="button"
                        data-testid={`home-segment-${key}`}
                        onClick={() => setHomeSegment(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all border ${colorStyle}`}
                      >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 relative z-50">
                <LocationDropdown
                  selectedLocations={selectedLocations}
                  setSelectedLocations={setSelectedLocations}
                  locMenuOpen={locMenuOpen}
                  setLocMenuOpen={setLocMenuOpen}
                  locMenuRef={locMenuRef}
                  t={t}
                  buttonClassName={`w-full px-4 py-3 flex items-center justify-between font-medium rounded-2xl transition-colors border ${locMenuOpen ? 'bg-primaryLight text-primary border-primary/30' : 'bg-beige/60 text-gray-700 border-transparent hover:bg-gray-100'}`}
                />
                <DeliveryTypeFilter
                  selectedDeliveryTypes={selectedDeliveryTypes}
                  setSelectedDeliveryTypes={setSelectedDeliveryTypes}
                  deliveryMenuOpen={deliveryMenuOpen}
                  setDeliveryMenuOpen={setDeliveryMenuOpen}
                  deliveryMenuRef={deliveryMenuRef}
                  t={t}
                  buttonClassName={`w-full px-4 py-3 flex items-center justify-between font-medium rounded-2xl transition-colors border ${deliveryMenuOpen ? 'bg-primaryLight text-primary border-primary/30' : 'bg-beige/60 text-gray-700 border-transparent hover:bg-gray-100'}`}
                />
              </div>
            </div>
          </div>

          <div className="relative min-h-[330px] sm:min-h-[420px]" aria-label="Kurswelten entdecken">
            <div className="absolute right-0 top-4 w-[72%] sm:w-[66%] aspect-[4/3] rounded-[2rem] overflow-hidden border-8 border-white shadow-[0_20px_55px_rgba(93,64,48,0.16)] rotate-2">
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop" alt="Menschen lernen gemeinsam" loading="eager" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/55 via-transparent to-transparent" />
              <span className="absolute bottom-4 left-4 text-white text-sm font-bold">Gemeinsam Neues entdecken</span>
            </div>
            <div className="absolute left-0 bottom-5 w-[47%] sm:w-[43%] aspect-[4/3] rounded-[1.5rem] overflow-hidden border-8 border-white shadow-[0_18px_40px_rgba(93,64,48,0.14)] -rotate-3">
              <img src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=700&auto=format&fit=crop" alt="Kreativer Kurs" loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="absolute left-[10%] top-0 sm:top-4 rounded-2xl bg-blue-800 text-white px-4 py-3 shadow-lg">
              <Briefcase className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold">Beruflich</span>
            </div>
            <div className="absolute right-[4%] bottom-0 rounded-2xl bg-white border border-[#eadfd8] px-4 py-3 shadow-lg">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-xs font-bold text-dark">Kinder & Jugend</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY PREVIEW (Static fallback filters) */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h2 className="text-3xl font-heading font-bold text-dark mb-2 text-center">{t.home_path_title}</h2>
        <p className="text-gray-500 text-center mb-12 font-sans">{t.home_path_sub}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* BERUFLICH - Blue */}
          <div className="flex flex-col">
            <a href="/search?type=beruflich" onClick={(e) => { e.preventDefault(); setSearchType('beruflich'); window.history.pushState({ view: 'search' }, '', '/search?type=beruflich'); window.scrollTo(0,0); }} className="group relative h-[280px] sm:h-[300px] rounded-3xl overflow-hidden cursor-pointer shadow-[0_12px_28px_rgba(93,64,48,0.12)] hover:shadow-[0_18px_38px_rgba(93,64,48,0.18)] transition-all duration-300 hover:-translate-y-1 block">
              <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-800/90 via-blue-600/40 to-blue-500/20"></div>
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full p-3">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_professional}</h3>
                <p className="text-blue-100 text-sm font-sans mb-4">{t.home_card_prof_sub}</p>
                <span className="inline-flex items-center text-white font-bold text-sm uppercase tracking-wider group-hover:text-blue-200 transition-colors">
                  {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
                </span>
              </div>
            </a>
            {/* Ratgeber Links - Beruflich */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">{t.ratgeber_title || 'Ratgeber'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(RATGEBER_STRUCTURE.beruflich.clusters).map(cluster => {
                  const ClusterIcon = cluster.icon;
                  return (
                    <a
                      key={cluster.slug}
                      href={`/ratgeber/${RATGEBER_STRUCTURE.beruflich.slug}/${cluster.slug}`}
                      onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', `/ratgeber/${RATGEBER_STRUCTURE.beruflich.slug}/${cluster.slug}`); window.scrollTo(0,0); window.dispatchEvent(new PopStateEvent('popstate')); }}
                      className="group/card min-w-0 flex items-start gap-2 p-3 rounded-xl bg-white border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover/card:bg-blue-200 transition-colors">
                        <ClusterIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="min-w-0 flex-1 text-xs font-medium text-gray-700 group-hover/card:text-blue-700 leading-tight flex items-center min-h-[2rem]">
                        {cluster.label[lang] || cluster.label.de}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
            {/* Themenwelten - Beruflich */}
            {getBereicheForSegment('beruflich').length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Themenwelten</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {getBereicheForSegment('beruflich').map(bereich => (
                    <a
                      key={bereich.slug}
                      href={getBereichUrl(bereich)}
                      onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', getBereichUrl(bereich)); window.scrollTo(0,0); }}
                      className="group/card min-w-0 flex items-start gap-2 p-3 rounded-xl bg-white border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover/card:bg-blue-200 transition-colors">
                        <Compass className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="min-w-0 flex-1 text-xs font-medium text-gray-700 group-hover/card:text-blue-700 leading-tight flex items-center min-h-[2rem]">
                        {bereich.title[lang] || bereich.title.de}
                      </span>
                    </a>
                  ))}
                </div>
                <p className="mt-2 text-xs text-blue-700/80">
                  Weitere Themenwelten sind in Arbeit und folgen demnächst.
                </p>
              </div>
            )}
          </div>

          {/* PRIVAT & HOBBY - Orange */}
          <div className="flex flex-col">
            <a href="/search?type=privat_hobby" onClick={(e) => { e.preventDefault(); setSearchType('privat_hobby'); window.history.pushState({ view: 'search' }, '', '/search?type=privat_hobby'); window.scrollTo(0,0); }} className="group relative h-[280px] sm:h-[300px] rounded-3xl overflow-hidden cursor-pointer shadow-[0_12px_28px_rgba(93,64,48,0.12)] hover:shadow-[0_18px_38px_rgba(93,64,48,0.18)] transition-all duration-300 hover:-translate-y-1 block">
              <img src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-orange-700/90 via-orange-600/40 to-orange-500/20"></div>
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full p-3">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_private}</h3>
                <p className="text-orange-100 text-sm font-sans mb-4">{t.home_card_priv_sub}</p>
                <span className="inline-flex items-center text-white font-bold text-sm uppercase tracking-wider group-hover:text-orange-200 transition-colors">
                  {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
                </span>
              </div>
            </a>
            {/* Ratgeber Links - Privat & Hobby */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-gray-700">{t.ratgeber_title || 'Ratgeber'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(RATGEBER_STRUCTURE.privat_hobby.clusters).map(cluster => {
                  const ClusterIcon = cluster.icon;
                  return (
                    <a
                      key={cluster.slug}
                      href={`/ratgeber/${RATGEBER_STRUCTURE.privat_hobby.slug}/${cluster.slug}`}
                      onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', `/ratgeber/${RATGEBER_STRUCTURE.privat_hobby.slug}/${cluster.slug}`); window.scrollTo(0,0); window.dispatchEvent(new PopStateEvent('popstate')); }}
                      className="group/card min-w-0 flex items-start gap-2 p-3 rounded-xl bg-white border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center group-hover/card:bg-orange-200 transition-colors">
                        <ClusterIcon className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="min-w-0 flex-1 text-xs font-medium text-gray-700 group-hover/card:text-orange-700 leading-tight flex items-center min-h-[2rem]">
                        {cluster.label[lang] || cluster.label.de}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
            {/* Themenwelten - Privat & Hobby */}
            {getBereicheForSegment('privat_hobby').length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-semibold text-gray-700">Themenwelten</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {getBereicheForSegment('privat_hobby').map(bereich => (
                    <a
                      key={bereich.slug}
                      href={getBereichUrl(bereich)}
                      onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', getBereichUrl(bereich)); window.scrollTo(0,0); }}
                      className="group/card min-w-0 flex items-start gap-2 p-3 rounded-xl bg-white border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center group-hover/card:bg-orange-200 transition-colors">
                        <Compass className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="min-w-0 flex-1 text-xs font-medium text-gray-700 group-hover/card:text-orange-700 leading-tight flex items-center min-h-[2rem]">
                        {bereich.title[lang] || bereich.title.de}
                      </span>
                    </a>
                  ))}
                </div>
                <p className="mt-2 text-xs text-orange-700/80">
                  Weitere Themenwelten sind in Arbeit und folgen demnächst.
                </p>
              </div>
            )}
          </div>

          {/* KINDER & JUGEND - Green */}
          <div className="flex flex-col">
            <a href="/search?type=kinder_jugend" onClick={(e) => { e.preventDefault(); setSearchType('kinder_jugend'); window.history.pushState({ view: 'search' }, '', '/search?type=kinder_jugend'); window.scrollTo(0,0); }} className="group relative h-[280px] sm:h-[300px] rounded-3xl overflow-hidden cursor-pointer shadow-[0_12px_28px_rgba(93,64,48,0.12)] hover:shadow-[0_18px_38px_rgba(93,64,48,0.18)] transition-all duration-300 hover:-translate-y-1 block">
              <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-800/90 via-emerald-600/40 to-emerald-500/20"></div>
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full p-3">
                <Smile className="w-6 h-6 text-white" />
              </div>
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_kids}</h3>
                <p className="text-emerald-100 text-sm font-sans mb-4">{t.home_card_kids_sub}</p>
                <span className="inline-flex items-center text-white font-bold text-sm uppercase tracking-wider group-hover:text-emerald-200 transition-colors">
                  {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
                </span>
              </div>
            </a>
            {/* Ratgeber Links - Kinder & Jugend */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-700">{t.ratgeber_title || 'Ratgeber'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(RATGEBER_STRUCTURE.kinder_jugend.clusters).map(cluster => {
                  const ClusterIcon = cluster.icon;
                  return (
                    <a
                      key={cluster.slug}
                      href={`/ratgeber/${RATGEBER_STRUCTURE.kinder_jugend.slug}/${cluster.slug}`}
                      onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', `/ratgeber/${RATGEBER_STRUCTURE.kinder_jugend.slug}/${cluster.slug}`); window.scrollTo(0,0); window.dispatchEvent(new PopStateEvent('popstate')); }}
                      className="group/card min-w-0 flex items-start gap-2 p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover/card:bg-emerald-200 transition-colors">
                        <ClusterIcon className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="min-w-0 flex-1 text-xs font-medium text-gray-700 group-hover/card:text-emerald-700 leading-tight flex items-center min-h-[2rem]">
                        {cluster.label[lang] || cluster.label.de}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
            {/* Themenwelten - Kinder & Jugend */}
            {getBereicheForSegment('kinder_jugend').length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-gray-700">Themenwelten</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {getBereicheForSegment('kinder_jugend').map(bereich => (
                    <a
                      key={bereich.slug}
                      href={getBereichUrl(bereich)}
                      onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', getBereichUrl(bereich)); window.scrollTo(0,0); }}
                      className="group/card min-w-0 flex items-start gap-2 p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover/card:bg-emerald-200 transition-colors">
                        <Compass className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="min-w-0 flex-1 text-xs font-medium text-gray-700 group-hover/card:text-emerald-700 leading-tight flex items-center min-h-[2rem]">
                        {bereich.title[lang] || bereich.title.de}
                      </span>
                    </a>
                  ))}
                </div>
                <p className="mt-2 text-xs text-emerald-700/80">
                  Weitere Themenwelten sind in Arbeit und folgen demnächst.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
