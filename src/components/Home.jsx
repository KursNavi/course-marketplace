import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, ChevronRight, ChevronLeft, ChevronDown, CreditCard, Info, Shield, Briefcase, Palette, Smile, BookOpen, LayoutGrid, Compass } from 'lucide-react';
import { LocationDropdown, DeliveryTypeFilter } from './Filters';
import { CATEGORY_TYPES, SEGMENT_CONFIG } from '../lib/constants';
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

  // Auto-Select first area when type changes (optional, improves UX)
  useEffect(() => {
    const areas = getActiveAreas();
    if (areas.length > 0 && !areas.includes(activeArea)) {
        setActiveArea(areas[0]);
        setActiveSpecialty(null);
    }
  }, [activeType, courses]);

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

      
      {/* 1. HERO SECTION — petrolfarbener Hintergrund statt Vollbild-Foto */}
      <div className="relative w-full bg-petrol text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 lg:items-center">

            {/* LINKS: Headline, Subhead, Wegweiser */}
            <div className="lg:col-span-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-5 tracking-tight">
                {t.home_headline}
              </h1>
              <p className="text-lg text-white/80 mb-8 font-sans max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {t.home_subhead}
              </p>

              {/* WEGWEISER: drei gleichwertige, parallele Richtungen - bewusst ohne
                  Nummerierung und ohne verbindende Linie, da Beruflich / Privat & Hobby /
                  Kinder & Jugend keine Abfolge sind, sondern unabhaengige Einstiege. */}
              <div className="grid grid-cols-3 gap-2.5 md:gap-3" data-testid="home-wegweiser">
                {[
                  { key: 'beruflich', label: t.nav_professional || 'Beruflich' },
                  { key: 'privat_hobby', label: t.nav_private || 'Privat & Hobby' },
                  { key: 'kinder_jugend', label: t.nav_kids || 'Kinder & Jugend' },
                ].map(({ key, label }) => {
                  const { icon: Icon, bg } = SEGMENT_VISUALS[key];
                  return (
                    <div key={key} className="flex flex-col items-center gap-2 text-center bg-white/5 border border-white/15 rounded-xl py-4 px-2">
                      <span className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                        <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" aria-hidden="true" />
                      </span>
                      <span className="text-xs md:text-sm text-white font-medium leading-tight">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RECHTS: Suchkarte */}
            <div className="lg:col-span-6">
              <div className="max-w-xl mx-auto lg:mx-0 lg:ml-auto bg-beige text-dark p-6 md:p-8 rounded-xl border border-grey shadow-xl relative">

                {/* Suchbereich: zuerst Bereich waehlen, dann Suchbegriff eingeben */}
                <div className="mb-5 pb-5 border-b border-grey">
                    <p className="text-xs text-gray-500 mb-2 text-left uppercase tracking-wide font-semibold">Suchbereich</p>
                    <div className="flex gap-2 flex-wrap" data-testid="home-segment-selector">
                        {[
                            { key: 'alle', label: 'Alle Bereiche', Icon: null, active: 'bg-petrol text-white border-petrol', inactive: 'bg-white text-gray-700 border-grey hover:border-petrol/40' },
                            { key: 'beruflich', label: t.nav_professional || 'Beruflich', Icon: SEGMENT_VISUALS.beruflich.icon, active: `${SEGMENT_VISUALS.beruflich.bg} text-white ${SEGMENT_VISUALS.beruflich.border}`, inactive: `bg-white ${SEGMENT_VISUALS.beruflich.text} ${SEGMENT_VISUALS.beruflich.border}/40 hover:bg-segBeruflich/10` },
                            { key: 'privat_hobby', label: t.nav_private || 'Privat & Hobby', Icon: SEGMENT_VISUALS.privat_hobby.icon, active: `${SEGMENT_VISUALS.privat_hobby.bg} text-white ${SEGMENT_VISUALS.privat_hobby.border}`, inactive: `bg-white ${SEGMENT_VISUALS.privat_hobby.text} ${SEGMENT_VISUALS.privat_hobby.border}/40 hover:bg-primary/10` },
                            { key: 'kinder_jugend', label: t.nav_kids || 'Kinder & Jugend', Icon: SEGMENT_VISUALS.kinder_jugend.icon, active: `${SEGMENT_VISUALS.kinder_jugend.bg} text-white ${SEGMENT_VISUALS.kinder_jugend.border}`, inactive: `bg-white ${SEGMENT_VISUALS.kinder_jugend.text} ${SEGMENT_VISUALS.kinder_jugend.border}/40 hover:bg-segKinder/10` },
                        ].map(({ key, label, Icon, active, inactive }) => {
                            const isActive = homeSegment === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    data-testid={`home-segment-${key}`}
                                    onClick={() => setHomeSegment(key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${isActive ? active : inactive}`}
                                >
                                    {Icon && <Icon className="w-3.5 h-3.5" />}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Suchfeld, Ort/PLZ, Kursformat — jeweils mit sichtbarem Label, dann separater Suchen-Button */}
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5 text-left">
                        <label
                            htmlFor="home-search-input"
                            className="text-xs font-semibold text-dark uppercase tracking-wide"
                        >
                            {t.search_placeholder}
                        </label>
                        <div className="relative flex items-center">
                            <Search className="absolute left-4 text-gray-400 w-4 h-4" aria-hidden="true" />
                            <input
                            id="home-search-input"
                            type="text"
                            placeholder={t.search_placeholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 rounded-md text-dark font-sans border border-grey focus:outline-none focus:ring-1 focus:ring-petrol focus:border-petrol text-sm bg-white placeholder:text-gray-400"
                            />
                        </div>
                        <details className="mt-0.5">
                            <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-gray-500 underline underline-offset-2">
                                {t.search_help_label || 'Such-Tipp'}
                            </summary>
                            <p className="pb-1 text-xs text-gray-500">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe mit AND oder OR (z.B. "Yoga AND Zürich")'}</p>
                        </details>
                    </div>

                    {/* Ort oder PLZ (bestehender Standort-Filter) */}
                    <div className="flex flex-col gap-1.5 text-left">
                        <label className="text-xs font-semibold text-dark uppercase tracking-wide">{t.filter_label_loc || 'Ort oder PLZ'}</label>
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

                    {/* Kursformat (bestehender Kursformat-Filter: Praesenz / Online Live / Selbststudium) */}
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

                    <button type="submit" className="mt-1 w-full bg-petrol hover:bg-petrolDark text-white font-label-md text-sm font-semibold px-6 py-3 rounded-md transition-all shadow-sm flex items-center justify-center gap-2">
                        <span>{t.btn_search}</span>
                        <Search className="w-4 h-4" aria-hidden="true" />
                    </button>
                </form>
              </div>
            </div>

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
