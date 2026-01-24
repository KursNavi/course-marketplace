import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, ChevronRight, ChevronDown } from 'lucide-react';
import { LocationDropdown } from './Filters'; 
import { NEW_TAXONOMY, CATEGORY_TYPES } from '../lib/constants';

export const Home = ({ 
  lang, t, setView, courses, // Jetzt haben wir Zugriff auf die Kurse!
  setSearchType, setSearchArea, setSearchSpecialty, 
  searchQuery, setSearchQuery, 
  catMenuOpen, setCatMenuOpen, catMenuRef, 
  locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef 
}) => {
  
  // State für das Mega-Menü
  const [activeType, setActiveType] = useState('privat_hobby'); // Spalte 1 Auswahl
  const [activeArea, setActiveArea] = useState(null);           // Spalte 2 Auswahl

  // --- LOGIK: Nur Kategorien mit Kursen anzeigen ---
  
  // 1. Welche Typen haben überhaupt Kurse?
  const availableTypes = activeType ? [activeType] : []; // Wir zeigen links immer alle an (statisch), aber filtern rechts dynamisch

  // 2. Welche Bereiche (Level 1) im aktiven Typ haben Kurse?
  const getActiveAreas = () => {
    if (!courses || courses.length === 0) return [];
    
    // Filtere Kurse nach dem aktiven Typ
    const relevantCourses = courses.filter(c => c.category_type === activeType);
    
    // Hole alle Areas, die vorkommen
    const areaKeys = [...new Set(relevantCourses.map(c => c.category_area).filter(Boolean))];
    return areaKeys;
  };

  // 3. Welche Spezialgebiete (Level 2) im aktiven Bereich haben Kurse?
  const getActiveSpecialties = () => {
    if (!courses || courses.length === 0 || !activeArea) return [];

    // Filtere Kurse nach Typ UND Bereich
    const relevantCourses = courses.filter(c => c.category_type === activeType && c.category_area === activeArea);

    // Hole alle Specialties
    const specKeys = [...new Set(relevantCourses.map(c => c.category_specialty).filter(Boolean))];
    return specKeys;
  };

  const visibleAreas = getActiveAreas();
  const visibleSpecialties = getActiveSpecialties();

  // --- ACTIONS ---

  const handleSearch = (e) => {
    e.preventDefault();
    setView('search'); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategorySelect = (typeKey, areaKey, specialtyKey) => {
    setSearchType(typeKey);
    setSearchArea(areaKey || "");
    setSearchSpecialty(specialtyKey || ""); 
    
    setCatMenuOpen(false);
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper für Labels
  const getTypeLabel = (key) => CATEGORY_TYPES[key]?.[lang] || CATEGORY_TYPES[key]?.de || key;
  const getAreaLabel = (type, areaKey) => NEW_TAXONOMY[type]?.[areaKey]?.label?.[lang] || NEW_TAXONOMY[type]?.[areaKey]?.label?.de || areaKey;

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
    const canonicalUrl = 'https://kursnavi.ch/';
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
        canonicalTag = document.createElement('link');
        canonicalTag.rel = 'canonical';
        document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonicalUrl;

    // hreflang Tags
    const languages = ['de', 'fr', 'it', 'en'];
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(tag => tag.remove());

    languages.forEach(langCode => {
        const hreflangTag = document.createElement('link');
        hreflangTag.rel = 'alternate';
        hreflangTag.hreflang = langCode;
        hreflangTag.href = langCode === 'de'
            ? 'https://kursnavi.ch/'
            : `https://kursnavi.ch/${langCode}/`;
        document.head.appendChild(hreflangTag);
    });

    const xDefaultTag = document.createElement('link');
    xDefaultTag.rel = 'alternate';
    xDefaultTag.hreflang = 'x-default';
    xDefaultTag.href = 'https://kursnavi.ch/';
    document.head.appendChild(xDefaultTag);

    // OG Tags
    const ogTags = {
        'og:title': 'KursNavi - Der Schweizer Kursmarktplatz',
        'og:description': metaDescription,
        'og:url': canonicalUrl,
        'og:image': 'https://kursnavi.ch/og-default.svg',
        'og:type': 'website',
        'og:site_name': 'KursNavi',
        'twitter:card': 'summary_large_image',
        'twitter:title': 'KursNavi - Der Schweizer Kursmarktplatz',
        'twitter:description': metaDescription,
        'twitter:image': 'https://kursnavi.ch/og-default.svg'
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
        "url": "https://kursnavi.ch",
        "logo": "https://kursnavi.ch/og-default.svg",
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
  }, []);

  // Auto-Select first area when type changes (optional, improves UX)
  useEffect(() => {
    const areas = getActiveAreas();
    if (areas.length > 0 && !areas.includes(activeArea)) {
        setActiveArea(areas[0]);
    }
  }, [activeType, courses]);

  return (
    <div className="flex flex-col w-full font-sans">
      
      {/* 1. HERO SECTION */}
      <div className="relative h-[600px] w-full flex items-center justify-center">
        {/* Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2671&auto=format&fit=crop")' }}
        ></div>
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
            <form onSubmit={handleSearch} className="relative flex items-center mb-4">
                <Search className="absolute left-4 text-gray-400 w-5 h-5 z-10" />
                <input 
                type="text" 
                placeholder={t.search_placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl text-dark font-sans shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-lg placeholder-gray-500 bg-white"
                />
                <button type="submit" className="absolute right-2 bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition-colors duration-300">
                {t.btn_search}
                </button>
            </form>

            {/* Row 2: Filters */}
            <div className="flex flex-col md:flex-row gap-3 relative z-50">
                
                {/* NEW 3-LEVEL CATEGORY DROPDOWN */}
                <div className="flex-1 bg-white rounded-xl relative" ref={catMenuRef}>
                    <button 
                        type="button"
                        onClick={() => setCatMenuOpen(!catMenuOpen)}
                        className="w-full px-4 py-3 flex items-center justify-between text-gray-700 font-medium hover:bg-gray-50 rounded-xl transition-colors"
                    >
                        <span className="flex items-center">
                            {catMenuOpen ? t.lbl_select_cat : t.filter_label_cat || 'Kategorie'}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${catMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* MEGA MENU (3 SPALTEN) */}
                    {catMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-[800px] -ml-0 md:-ml-0 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex z-50 text-left h-[450px]">
                            
                            {/* SPALTE 1: TYP (Immer sichtbar) */}
                            <div className="w-1/4 bg-gray-50 border-r border-gray-100 py-2">
                                <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t.lbl_type}</div>
                                {Object.keys(CATEGORY_TYPES).map(typeKey => (
                                    <div 
                                        key={typeKey}
                                        onMouseEnter={() => setActiveType(typeKey)}
                                        onClick={() => handleCategorySelect(typeKey)} // Klick auf Typ filtert nur Typ
                                        className={`px-4 py-3 cursor-pointer text-sm font-bold flex justify-between items-center transition-colors ${activeType === typeKey ? 'bg-white text-primary border-l-4 border-primary shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {getTypeLabel(typeKey)}
                                        {activeType === typeKey && <ChevronRight className="w-3 h-3" />}
                                    </div>
                                ))}
                            </div>

                            {/* SPALTE 2: BEREICH (Gefiltert nach Existenz) */}
                            <div className="w-1/3 border-r border-gray-100 py-2 overflow-y-auto">
                                <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t.lbl_area}</div>
                                {visibleAreas.length > 0 ? (
                                    visibleAreas.map(areaKey => (
                                        <div
                                            key={areaKey}
                                            onMouseEnter={() => setActiveArea(areaKey)}
                                            onClick={() => handleCategorySelect(activeType, areaKey)}
                                            className={`px-4 py-2 cursor-pointer text-sm flex justify-between items-center transition-colors ${activeArea === areaKey ? 'text-primary font-bold bg-orange-50' : 'text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            {getAreaLabel(activeType, areaKey)}
                                            {activeArea === areaKey && <ChevronRight className="w-3 h-3" />}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-xs text-gray-400 italic">{t.msg_no_courses}</div>
                                )}
                            </div>

                            {/* SPALTE 3: SPEZIALGEBIET (Gefiltert nach Existenz) */}
                            <div className="flex-1 py-2 overflow-y-auto bg-gray-50/50">
                                <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t.lbl_specialty}</div>
                                {visibleSpecialties.length > 0 ? (
                                    visibleSpecialties.map(specKey => (
                                        <button
                                            key={specKey}
                                            onClick={() => handleCategorySelect(activeType, activeArea, specKey)}
                                            className="w-full text-left px-4 py-2 hover:bg-orange-100 text-sm text-gray-600 hover:text-primary transition-colors flex items-center group"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-primary mr-2 transition-colors"></span>
                                            {specKey}
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-xs text-gray-400 italic">
                                        {activeArea ? t.msg_all_topics : t.msg_select_area}
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>

                {/* LOCATION DROPDOWN */}
                <div className="flex-1 bg-white rounded-xl">
                    <LocationDropdown 
                        locMode={locMode} 
                        setLocMode={setLocMode} 
                        selectedLocations={selectedLocations} 
                        setSelectedLocations={setSelectedLocations} 
                        locMenuOpen={locMenuOpen} 
                        setLocMenuOpen={setLocMenuOpen} 
                        locMenuRef={locMenuRef} 
                        t={t} 
                    />
                </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. CATEGORY PREVIEW (Static fallback filters) */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h2 className="text-3xl font-heading font-bold text-dark mb-2 text-center">{t.home_path_title}</h2>
        <p className="text-gray-500 text-center mb-12 font-sans">{t.home_path_sub}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div onClick={() => { setSearchType('privat_hobby'); setView('search'); window.scrollTo(0,0); }} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_private}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">{t.home_card_priv_sub}</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

          <div onClick={() => { setSearchType('beruflich'); setView('search'); window.scrollTo(0,0); }} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2670&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_professional}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">{t.home_card_prof_sub}</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

          <div onClick={() => { setSearchType('kinder_jugend'); setView('search'); window.scrollTo(0,0); }} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2622&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_kids}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">{t.home_card_kids_sub}</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};