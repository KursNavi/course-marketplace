import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, ChevronDown, CreditCard, Shield, Briefcase, Palette, Smile, X } from 'lucide-react';
import { LocationDropdown, DeliveryTypeFilter, LanguageDropdown } from './Filters';
import { SEGMENT_CONFIG, DELIVERY_TYPES } from '../lib/constants';
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

  // --- FREITEXTSUCHE: Zieltyp wird aus dem Suchbegriff geraten. ---
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

  // Navigiert direkt zu einem Bereich (Beruflich/Privat & Hobby/Kinder & Jugend), z.B. von den
  // drei gleichwertigen Bereichs-Links im Hero. Gemeinsame Filter (Ort, Kursformat, Sprache,
  // Verifiziert, Direktbuchung) werden NICHT hier in die URL geschrieben: App.jsx synchronisiert
  // sie automatisch in die URL, sobald `view` auf 'search' wechselt (siehe App.jsx, useEffect ueber
  // searchType/.../filterDirectBooking). Dadurch gelten dieselben Filter unabhaengig vom Einstieg.
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

  // --- GEMEINSAME FILTER (gelten fuer Bereichs-Links UND Freitextsuche) ---
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

      
      {/* 1. HERO SECTION — Ueberschrift ueber volle Breite, darunter zwei gleichwertige
          Bereiche: links die drei Bildungswelten, rechts die Kurssuche. Kein Kompass-/
          Weggabelungs-Symbol, keine Nummerierung — die drei Bereiche sind gleichwertig. */}
      <section className="relative w-full bg-[#14313B] text-white overflow-hidden">
        {/* Dezenter Schimmer im Hintergrund, rein dekorativ */}
        <div className="absolute -top-32 right-1/4 w-[650px] h-[650px] bg-segBeruflich/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>
        <div className="absolute top-1/2 left-0 w-[450px] h-[450px] bg-primary/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">

          {/* Abschnittsmarker + Ueberschrift + Intro ueber die gesamte Breite */}
          <div className="max-w-2xl mb-8 md:mb-10">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden="true"></span>
              <span className="w-7 h-[1.5px] bg-white/40 shrink-0" aria-hidden="true"></span>
              <span className="text-xs font-semibold tracking-wider uppercase text-white/70">KursNavi Wegweiser Schweiz</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight text-beige mb-4 leading-tight">
              {t.home_headline}
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl leading-relaxed">
              {t.home_subhead}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

            {/* LINKS (Desktop) / 2. Block (Mobile): drei gleichwertige Bereiche */}
            <div className="order-2 lg:order-1 lg:col-span-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-white/15 mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Bereiche im Überblick</span>
                <span className="text-xs text-white/50 hidden sm:inline">Gleichwertige Bildungswelten</span>
              </div>
              <div className="space-y-3.5">
                {[
                  { key: 'beruflich', icon: '/images/brand/kursnavi/career.svg', label: t.nav_professional || 'Beruflich', desc: t.home_card_prof_sub, dot: 'bg-segBeruflich', hoverBorder: 'hover:border-segBeruflich' },
                  { key: 'privat_hobby', icon: '/images/brand/kursnavi/private-hobby.svg', label: t.nav_private || 'Privat & Hobby', desc: t.home_card_priv_sub, dot: 'bg-primary', hoverBorder: 'hover:border-primary' },
                  { key: 'kinder_jugend', icon: '/images/brand/kursnavi/children-youth.svg', label: t.nav_kids || 'Kinder & Jugend', desc: t.home_card_kids_sub, dot: 'bg-segKinder', hoverBorder: 'hover:border-segKinder' },
                ].map(({ key, icon, label, desc, dot, hoverBorder }) => (
                  <a
                    key={key}
                    href={`/search?type=${key}`}
                    onClick={(e) => { e.preventDefault(); handleCategorySelect(key, null, null, null); }}
                    className={`group flex items-center justify-between p-3.5 rounded-lg bg-white/5 border border-white/10 ${hoverBorder} hover:bg-white/10 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-beige shrink-0">
                        <img src={icon} alt="" aria-hidden="true" className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true"></span>
                          <span className="text-base font-bold text-beige group-hover:text-white transition-colors">{label}</span>
                        </div>
                        <p className="text-xs text-white/70 mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            {/* RECHTS (Desktop) / 1. Block (Mobile): Kurssuche, etwas tiefer angesetzt */}
            <div className="order-1 lg:order-2 lg:col-span-7 w-full lg:mt-9">
              <div className="bg-beige text-dark rounded-lg p-6 md:p-8 border border-grey">
                <div className="flex items-center gap-2.5 pb-4 border-b border-grey mb-6">
                  <img src="/images/brand/kursnavi/search.svg" alt="" aria-hidden="true" className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-petrol">Kurssuche Schweiz</span>
                </div>

                <form onSubmit={handleSearch} className="space-y-5">
                  <div>
                    <label htmlFor="home-search-input" className="block text-xs font-semibold uppercase tracking-wider text-dark mb-2">
                      {t.search_placeholder}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" aria-hidden="true" />
                      <input
                        id="home-search-input"
                        type="text"
                        placeholder={t.search_placeholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-grey rounded text-base text-dark placeholder:text-gray-400 focus:outline-none focus:border-petrol focus:ring-1 focus:ring-petrol transition-colors"
                      />
                    </div>
                    <details className="mt-1.5">
                      <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-gray-500 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                        {t.search_help_label || 'Such-Tipp'}
                      </summary>
                      <p className="pb-1 text-xs text-gray-500">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe mit AND oder OR (z.B. "Yoga AND Zürich")'}</p>
                    </details>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-dark mb-1.5">{t.filter_label_loc || 'Ort'}</label>
                      <div className="bg-white rounded border border-grey">
                        <LocationDropdown
                          selectedLocations={selectedLocations}
                          setSelectedLocations={setSelectedLocations}
                          locMenuOpen={locMenuOpen}
                          setLocMenuOpen={setLocMenuOpen}
                          locMenuRef={locMenuRef}
                          t={t}
                          buttonClassName={`w-full px-3 py-2.5 flex items-center justify-between font-medium rounded text-sm transition-colors ${locMenuOpen ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-gray-700 hover:bg-gray-50'}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-dark mb-1.5">Kursformat</label>
                      <div className="bg-white rounded border border-grey">
                        <DeliveryTypeFilter
                          selectedDeliveryTypes={selectedDeliveryTypes}
                          setSelectedDeliveryTypes={setSelectedDeliveryTypes}
                          deliveryMenuOpen={deliveryMenuOpen}
                          setDeliveryMenuOpen={setDeliveryMenuOpen}
                          deliveryMenuRef={deliveryMenuRef}
                          t={t}
                          buttonClassName={`w-full px-3 py-2.5 flex items-center justify-between font-medium rounded text-sm transition-colors ${deliveryMenuOpen ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-gray-700 hover:bg-gray-50'}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setShowMoreFilters(v => !v)}
                      aria-expanded={showMoreFilters}
                      aria-controls="home-more-filters"
                      className="order-2 sm:order-1 text-xs font-medium text-petrol hover:text-primary inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded"
                    >
                      <img src="/images/brand/kursnavi/filter.svg" alt="" aria-hidden="true" className="w-3.5 h-3.5" />
                      <span>Weitere Filter{secondaryFilterCount > 0 ? ` (${secondaryFilterCount})` : ''}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    <button
                      type="submit"
                      className="order-1 sm:order-2 w-full sm:w-auto px-8 py-3 bg-primary hover:bg-orange-600 text-white font-label-md text-sm font-semibold rounded shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol focus-visible:ring-offset-2"
                    >
                      <span>{t.btn_search}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </form>

                {showMoreFilters && (
                  <div id="home-more-filters" className="mt-4 pt-4 border-t border-grey flex flex-wrap gap-3 items-center">
                    <LanguageDropdown
                      selectedLanguages={selectedLanguages}
                      setSelectedLanguages={setSelectedLanguages}
                      langMenuOpen={langMenuOpen}
                      setLangMenuOpen={setLangMenuOpen}
                      langMenuRef={langMenuRef}
                      t={t}
                    />
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${filterPro ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white border-grey text-gray-600'}`}>
                      <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                      <span>{t.lbl_professional_filter || 'Verifiziert'}</span>
                      <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                    </label>
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${filterDirectBooking ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white border-grey text-gray-600'}`}>
                      <input type="checkbox" checked={filterDirectBooking} onChange={(e) => setFilterDirectBooking(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                      <span>{t.lbl_direct_booking_filter || 'Direktbuchung'}</span>
                      <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                    </label>
                  </div>
                )}

                {hasActiveHomeFilters && (
                  <div className="mt-4 pt-4 border-t border-grey flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500 mr-1">Aktive Filter:</span>
                    {selectedLocations?.map(loc => (
                      <span key={loc} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded bg-grey/60 text-xs text-dark">
                        {loc}
                        <button type="button" onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} aria-label={`Ort ${loc} entfernen`} className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {selectedDeliveryTypes?.map(dtKey => (
                      <span key={dtKey} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded bg-grey/60 text-xs text-dark">
                        {DELIVERY_TYPES[dtKey]?.[lang] || DELIVERY_TYPES[dtKey]?.de || dtKey}
                        <button type="button" onClick={() => setSelectedDeliveryTypes(selectedDeliveryTypes.filter(d => d !== dtKey))} aria-label="Kursformat entfernen" className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {selectedLanguages?.map(langKey => (
                      <span key={langKey} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded bg-grey/60 text-xs text-dark">
                        {langKey}
                        <button type="button" onClick={() => setSelectedLanguages(selectedLanguages.filter(l => l !== langKey))} aria-label={`Sprache ${langKey} entfernen`} className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {filterPro && (
                      <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded bg-grey/60 text-xs text-dark">
                        {t.lbl_professional_filter || 'Verifiziert'}
                        <button type="button" onClick={() => setFilterPro(false)} aria-label="Verifiziert-Filter entfernen" className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    )}
                    {filterDirectBooking && (
                      <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded bg-grey/60 text-xs text-dark">
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
        </div>
      </section>

      {/* 2. WAEHLE DEINEN WEG — drei gleichwertige Kurswelten, Segmentfarben Blau/Orange/Gruen.
          Bewusst ohne Nummerierung ("Bereich 01/02/03") an den Karten, aus demselben Grund
          wie beim Wegweiser oben: die drei Bereiche sind gleichwertig, keine Rangfolge. */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 pb-4 border-b border-grey gap-3">
          <div>
            <div className="flex items-center gap-2.5 text-xs font-bold text-petrol uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden="true"></span>
              <span className="w-7 h-[1.5px] bg-petrol/30 shrink-0" aria-hidden="true"></span>
              <span>Drei gleichwertige Bereiche</span>
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
