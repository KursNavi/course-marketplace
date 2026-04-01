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
  selectedDeliveryTypes, setSelectedDeliveryTypes, deliveryMenuOpen, setDeliveryMenuOpen, deliveryMenuRef
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

  // --- ACTIONS ---

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedLocations?.length) params.set('loc', selectedLocations.join(','));
    if (selectedDeliveryTypes?.length) params.set('delivery', selectedDeliveryTypes.join(','));
    if (filterPro) params.set('pro', '1');
    if (filterDirectBooking) params.set('booking', '1');
    const qs = params.toString();
    window.history.pushState({ view: 'search' }, '', '/search' + (qs ? '?' + qs : ''));
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

    const metaDescription = 'Entdecke tausende Kurse in der Schweiz: Weiterbildung, Hobbys, Kinderkurse. Vergleiche Anbieter, buche direkt online. Dein Kursmarktplatz für alle Kantone.';

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
        'og:image': `${BASE_URL}/og-default.svg`,
        'og:type': 'website',
        'og:locale': 'de_CH',
        'og:site_name': 'KursNavi',
        'twitter:card': 'summary_large_image',
        'twitter:title': 'KursNavi - Der Schweizer Kursmarktplatz',
        'twitter:description': metaDescription,
        'twitter:image': `${BASE_URL}/og-default.svg`
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
        "logo": `${BASE_URL}/og-default.svg`,
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
    <div className="flex flex-col w-full font-sans">
      
      {/* 1. HERO SECTION */}
      <div className="relative h-[720px] md:h-[600px] w-full flex items-center justify-center">
        {/* Background */}
        <img
          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop"
          srcSet="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800&auto=format&fit=crop 800w, https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop 1200w, https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1920&auto=format&fit=crop 1920w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center z-0"
        />
        <div className="absolute inset-0 bg-black/50 z-10"></div>

        {/* Content */}
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto w-full">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6 tracking-tight">
            {t.home_headline}
          </h1>
          <p className="text-lg md:text-xl text-gray-100 mb-8 font-sans max-w-2xl mx-auto leading-relaxed">
            {t.home_subhead}
          </p>

          {/* SEARCH & FILTERS CONTAINER */}
          <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-2xl relative">
            
            {/* Row 1: Search Bar */}
            <form onSubmit={handleSearch} className="relative flex flex-col mb-4">
                <div className="relative flex items-center">
                    <Search className="absolute left-4 text-gray-400 w-5 h-5 z-10" />
                    <input
                    type="text"
                    placeholder={t.search_placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-32 py-4 rounded-xl text-dark font-sans shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-lg placeholder-transparent md:placeholder-gray-500 bg-white"
                    />
                    <button type="submit" className="absolute right-2 bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition-colors duration-300">
                    {t.btn_search}
                    </button>
                </div>
                <p className="text-xs text-white/70 mt-1.5 ml-1">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe mit AND oder OR (z.B. "Yoga AND Zürich")'}</p>
            </form>

            {/* Row 2: Filters */}
            <div className="flex flex-col md:flex-row gap-3 relative z-50">
                
                {/* NEW 3-LEVEL CATEGORY DROPDOWN */}
                <div className="flex-1 bg-white rounded-xl" ref={catMenuRef}>
                    <button
                        type="button"
                        onClick={() => setCatMenuOpen(!catMenuOpen)}
                        className={`w-full px-4 py-3 flex items-center justify-between font-medium rounded-xl transition-colors ${catMenuOpen ? 'bg-primary/10 text-primary ring-2 ring-primary/30' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <span className="flex items-center">
                            <LayoutGrid className="w-4 h-4 mr-2" aria-hidden="true" />
                            {catMenuOpen ? t.lbl_select_cat : t.filter_label_cat || 'Kategorie'}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${catMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* MEGA MENU (3-4 SPALTEN) */}
                    {catMenuOpen && (() => {
                        // Mobile step: which column to show on small screens
                        const mobileStep = activeSpecialty && visibleFocuses.length > 0 ? 'fokus'
                            : activeArea ? 'specialty'
                            : 'area';
                        return (
                        <div className="absolute top-full left-0 right-0 mt-2 w-[calc(100vw-2rem)] md:w-auto bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 text-left">

                            {/* TOP ROW: SEGMENT ICON TABS */}
                            <div className="flex border-b border-gray-200 bg-gray-50">
                                {[
                                  { key: 'beruflich', label: t.nav_professional || 'Beruflich', Icon: Briefcase, config: SEGMENT_CONFIG.beruflich },
                                  { key: 'privat_hobby', label: t.nav_private || 'Privat & Hobby', Icon: Palette, config: SEGMENT_CONFIG.privat_hobby },
                                  { key: 'kinder_jugend', label: t.nav_kids || 'Kinder & Jugend', Icon: Smile, config: SEGMENT_CONFIG.kinder_jugend },
                                ].map(({ key, label, Icon, config }) => {
                                    const isActive = activeType === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => { setActiveType(key); setActiveArea(null); setActiveSpecialty(null); }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all ${
                                                isActive
                                                    ? `${config.bgLight} ${config.text} border-b-3 ${config.border}`
                                                    : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                        >
                                            <Icon className={`w-5 h-5 ${isActive ? config.text : 'text-gray-400'}`} />
                                            <span className="hidden sm:inline">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* MOBILE: Back button */}
                            {mobileStep !== 'area' && (
                                <button
                                    className="md:hidden flex items-center gap-1 px-4 py-2 text-sm text-primary font-medium border-b border-gray-100 w-full bg-gray-50"
                                    onClick={() => {
                                        if (mobileStep === 'fokus') setActiveSpecialty(null);
                                        else if (mobileStep === 'specialty') setActiveArea(null);
                                    }}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    {t.btn_back || 'Zurück'}
                                </button>
                            )}

                            {/* CONTENT ROWS */}
                            <div className="flex h-[400px]">

                            {/* SPALTE 1: BEREICH / Themenwelt */}
                            <div className={`${mobileStep === 'area' ? '' : 'hidden md:block'} w-full md:w-1/3 border-r border-gray-100 py-2 overflow-y-auto bg-gray-50`}>
                                <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t.lbl_area}</div>
                                {visibleAreas.length > 0 ? (
                                    visibleAreas.map(areaKey => (
                                        <div
                                            key={areaKey}
                                            onMouseEnter={() => { setActiveArea(areaKey); setActiveSpecialty(null); }}
                                            onClick={() => {
                                                if (window.innerWidth < 768) {
                                                    setActiveArea(areaKey); setActiveSpecialty(null);
                                                } else {
                                                    handleCategorySelect(activeType, areaKey);
                                                }
                                            }}
                                            className={`px-4 py-2 cursor-pointer text-sm flex justify-between items-center transition-colors ${activeArea === areaKey ? 'text-primary font-bold bg-orange-50' : 'text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            {getAreaLabel(activeType, areaKey)}
                                            <ChevronRight className={`w-3 h-3 ${activeArea === areaKey ? 'text-primary' : 'text-gray-300'}`} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-xs text-gray-400 italic">{t.msg_no_courses}</div>
                                )}
                            </div>

                            {/* SPALTE 2: SPEZIALGEBIET / Fachgebiet */}
                            <div className={`${mobileStep === 'specialty' ? '' : 'hidden md:block'} w-full md:w-1/3 border-r border-gray-100 py-2 overflow-y-auto bg-gray-50/50`}>
                                <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t.lbl_specialty}</div>
                                {visibleSpecialties.length > 0 ? (
                                    visibleSpecialties.map(spec => (
                                            <button
                                                key={spec.label}
                                                onMouseEnter={() => setActiveSpecialty(spec.label)}
                                                onClick={() => {
                                                    if (window.innerWidth < 768 && spec.hasFocuses) {
                                                        setActiveSpecialty(spec.label);
                                                    } else {
                                                        handleCategorySelect(activeType, activeArea, spec.label);
                                                    }
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group ${activeSpecialty === spec.label ? 'bg-orange-100 text-primary font-bold' : 'text-gray-600 hover:bg-orange-100 hover:text-primary'}`}
                                            >
                                                <span className="flex items-center">
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-2 transition-colors ${activeSpecialty === spec.label ? 'bg-primary' : 'bg-gray-300 group-hover:bg-primary'}`}></span>
                                                    {spec.label}
                                                </span>
                                                {spec.hasFocuses && <ChevronRight className={`w-3 h-3 ${activeSpecialty === spec.label ? 'text-primary' : 'text-gray-300'}`} />}
                                            </button>
                                        ))
                                ) : (
                                    <div className="p-4 text-xs text-gray-400 italic">
                                        {activeArea ? t.msg_all_topics : t.msg_select_area}
                                    </div>
                                )}
                            </div>

                            {/* SPALTE 3: FOKUS */}
                            <div className={`${mobileStep === 'fokus' ? '' : 'hidden md:block'} w-full md:w-1/3 py-2 overflow-y-auto`}>
                                {visibleFocuses.length > 0 ? (
                                    <>
                                        <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t.lbl_focus || 'Fokus'}</div>
                                        {visibleFocuses.map(focusKey => (
                                            <button
                                                key={focusKey}
                                                onClick={() => handleCategorySelect(activeType, activeArea, activeSpecialty, focusKey)}
                                                className="w-full text-left px-4 py-2 hover:bg-orange-100 text-sm text-gray-600 hover:text-primary transition-colors flex items-center group"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-primary mr-2 transition-colors"></span>
                                                {focusKey}
                                            </button>
                                        ))}
                                    </>
                                ) : null}
                            </div>

                            </div>{/* End CONTENT ROWS flex */}
                        </div>
                        );
                    })()}
                </div>

                {/* LOCATION DROPDOWN */}
                <div className="flex-1 bg-white rounded-xl">
                    <LocationDropdown
                        selectedLocations={selectedLocations}
                        setSelectedLocations={setSelectedLocations}
                        locMenuOpen={locMenuOpen}
                        setLocMenuOpen={setLocMenuOpen}
                        locMenuRef={locMenuRef}
                        t={t}
                        buttonClassName={`w-full px-4 py-3 flex items-center justify-between font-medium rounded-xl transition-colors ${locMenuOpen ? 'bg-primary/10 text-primary ring-2 ring-primary/30' : 'text-gray-700 hover:bg-gray-50'}`}
                    />
                </div>

                {/* DELIVERY TYPE FILTER */}
                <div className="flex-1 bg-white rounded-xl">
                    <DeliveryTypeFilter
                        selectedDeliveryTypes={selectedDeliveryTypes}
                        setSelectedDeliveryTypes={setSelectedDeliveryTypes}
                        deliveryMenuOpen={deliveryMenuOpen}
                        setDeliveryMenuOpen={setDeliveryMenuOpen}
                        deliveryMenuRef={deliveryMenuRef}
                        t={t}
                        buttonClassName={`w-full px-4 py-3 flex items-center justify-between font-medium rounded-xl transition-colors ${deliveryMenuOpen ? 'bg-primary/10 text-primary ring-2 ring-primary/30' : 'text-gray-700 hover:bg-gray-50'}`}
                    />
                </div>
            </div>

            {/* Row 3: Filter Checkboxes */}
            <div className="flex justify-center gap-3 mt-3 flex-wrap">
                <label className={`flex items-center space-x-2 px-4 py-2 rounded-xl cursor-pointer transition select-none ${filterPro ? 'bg-blue-500/90 border-blue-400' : 'bg-white/20 border-white/30'} border backdrop-blur-sm`} title={t.tooltip_pro_verified_long || t.tooltip_pro_verified}>
                    <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-blue-500 focus:ring-blue-400 bg-white/80" />
                    <span className={`text-sm font-medium ${filterPro ? 'text-white' : 'text-white/90'}`}>{t.lbl_professional_filter}</span>
                    <Shield className={`w-4 h-4 ${filterPro ? 'text-white' : 'text-white/80'}`} />
                    <Info className={`w-4 h-4 ${filterPro ? 'text-white/70' : 'text-white/60'} hover:text-white transition-colors`} />
                </label>
                <label className={`flex items-center space-x-2 px-4 py-2 rounded-xl cursor-pointer transition select-none ${filterDirectBooking ? 'bg-green-500/90 border-green-400' : 'bg-white/20 border-white/30'} border backdrop-blur-sm`} title={t.tooltip_direct_booking_long || t.tooltip_direct_booking}>
                    <input type="checkbox" checked={filterDirectBooking} onChange={(e) => setFilterDirectBooking(e.target.checked)} className="rounded text-green-500 focus:ring-green-400 bg-white/80" />
                    <span className={`text-sm font-medium ${filterDirectBooking ? 'text-white' : 'text-white/90'}`}>{t.lbl_direct_booking_filter}</span>
                    <CreditCard className={`w-4 h-4 ${filterDirectBooking ? 'text-white' : 'text-white/80'}`} />
                    <Info className={`w-4 h-4 ${filterDirectBooking ? 'text-white/70' : 'text-white/60'} hover:text-white transition-colors`} />
                </label>
            </div>
          </div>

        </div>
      </div>

      {/* 2. CATEGORY PREVIEW (Static fallback filters) */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h2 className="text-3xl font-heading font-bold text-dark mb-2 text-center">{t.home_path_title}</h2>
        <p className="text-gray-500 text-center mb-12 font-sans">{t.home_path_sub}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* BERUFLICH - Blue */}
          <div className="flex flex-col">
            <a href="/search?type=beruflich" onClick={(e) => { e.preventDefault(); setSearchType('beruflich'); window.history.pushState({ view: 'search' }, '', '/search?type=beruflich'); window.scrollTo(0,0); }} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 block">
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
                      className="group/card flex items-start gap-2 p-3 rounded-xl bg-white border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover/card:bg-blue-200 transition-colors">
                        <ClusterIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover/card:text-blue-700 leading-tight flex items-center min-h-[2rem]">
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
                      className="group/card flex items-start gap-2 p-3 rounded-xl bg-white border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover/card:bg-blue-200 transition-colors">
                        <Compass className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover/card:text-blue-700 leading-tight flex items-center min-h-[2rem]">
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
            <a href="/search?type=privat_hobby" onClick={(e) => { e.preventDefault(); setSearchType('privat_hobby'); window.history.pushState({ view: 'search' }, '', '/search?type=privat_hobby'); window.scrollTo(0,0); }} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 block">
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
                      className="group/card flex items-start gap-2 p-3 rounded-xl bg-white border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center group-hover/card:bg-orange-200 transition-colors">
                        <ClusterIcon className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover/card:text-orange-700 leading-tight flex items-center min-h-[2rem]">
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
                      className="group/card flex items-start gap-2 p-3 rounded-xl bg-white border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center group-hover/card:bg-orange-200 transition-colors">
                        <Compass className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover/card:text-orange-700 leading-tight flex items-center min-h-[2rem]">
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
            <a href="/search?type=kinder_jugend" onClick={(e) => { e.preventDefault(); setSearchType('kinder_jugend'); window.history.pushState({ view: 'search' }, '', '/search?type=kinder_jugend'); window.scrollTo(0,0); }} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 block">
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
                      className="group/card flex items-start gap-2 p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover/card:bg-emerald-200 transition-colors">
                        <ClusterIcon className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover/card:text-emerald-700 leading-tight flex items-center min-h-[2rem]">
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
                      className="group/card flex items-start gap-2 p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover/card:bg-emerald-200 transition-colors">
                        <Compass className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover/card:text-emerald-700 leading-tight flex items-center min-h-[2rem]">
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
