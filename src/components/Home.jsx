import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, ChevronDown, CreditCard, Shield } from 'lucide-react';
import { LocationDropdown, DeliveryTypeFilter, LanguageDropdown } from './Filters';
import { SEGMENT_CONFIG, COURSE_LEVELS } from '../lib/constants';
import { BASE_URL } from '../lib/siteConfig';
import { RATGEBER_STRUCTURE } from '../lib/ratgeberStructure';
import { getBereicheForSegment, getBereichUrl } from '../lib/bereichLandingConfig';
import { NewsletterSignup } from './Layout';
import { CareerIcon, PrivateHobbyIcon, ChildrenYouthIcon } from '../lib/segmentIcons';
import { SEGMENT_VISUALS, SEG_BORDER_30 } from '../lib/segmentVisuals';
import { SectionMarker } from './SectionMarker';

// Nur fuer die Startseiten-Suchbox: bewusst berufsnahe Beispiele statt Freizeit-/Kinder-
// Beispielen, damit KursNavi hier nicht primaer wie eine Hobby-/Kinderplattform wirkt
// (die bestehenden i18n-Keys search_placeholder/btn_search bleiben unveraendert, da sie auch
// auf BereichLandingPage.jsx verwendet werden).
const HOME_SEARCH_EXAMPLES = {
  de: 'z. B. Projektmanagement, Klavier, Marketing, Design-Workshop …',
  en: 'e.g. project management, piano, marketing, design workshop …',
  fr: 'p. ex. gestion de projet, piano, marketing, atelier design …',
  it: 'es. project management, pianoforte, marketing, workshop di design …',
};
const HOME_SEARCH_BTN_LABEL = {
  de: 'Kurse finden', en: 'Find courses', fr: 'Trouver des cours', it: 'Trova corsi',
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
  filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
  filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel,
  selectedSaule, setSelectedSaule, selectedKursart, setSelectedKursart,
  isLoading = false
}) => {

  // --- ACTIONS ---

  // Freitextsuche im Hero: kein Bereich wird hier vorausgewaehlt, daher laeuft die Suche
  // bewusst ueber alle drei Bereiche (Beruf & Karriere / Privat & Hobby / Kinder & Jugend) —
  // kein Keyword-Raten mehr, das z.B. "Yoga" fest einem einzigen Bereich zuordnen wuerde.
  // Die Suchuebersicht (SearchPageView/App.jsx) nutzt exakt dieselbe URL-Parameter-Konvention,
  // nur ohne "type", solange keiner gesetzt ist.
  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedLocations?.length) params.set('loc', selectedLocations.join(','));
    if (selectedDeliveryTypes?.length) params.set('delivery', selectedDeliveryTypes.join(','));
    window.history.pushState({ view: 'search' }, '', '/search?' + params.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- GEMEINSAME FILTER (gelten fuer die Freitextsuche im Hero) ---
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [priceError, setPriceError] = useState(false);

  // Zeigt nur noch als kleine Zahl auf dem "Weitere Filter"-Button an, wie viele erweiterte
  // Filter aktiv sind — die Startseite zeigt (anders als die Suchseite) keine eigene
  // "Aktive Filter"-Zusammenfassung mit Tags mehr.
  const secondaryFilterCount = [
    selectedLanguages?.length > 0, filterPro, filterDirectBooking,
    Boolean(selectedSaule), Boolean(selectedKursart),
    Boolean(filterDateFrom), Boolean(filterDateTo), Boolean(filterPriceMax),
    Boolean(filterLevel && filterLevel !== 'All'),
  ].filter(Boolean).length;

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
          <span className={`w-8 h-8 rounded-full bg-beige border ${visuals.border}/40 flex items-center justify-center shrink-0`}>
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
                    <span className={`shrink-0 w-7 h-7 rounded-lg bg-white border ${SEG_BORDER_30[segmentKey]} flex items-center justify-center`}>
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
                      className={`p-4 rounded-lg border-2 ${SEG_BORDER_30[segmentKey]} bg-beige hover:bg-grey/60 transition-colors flex items-center justify-between text-dark`}
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


      {/* 1. HERO SECTION — hell und freundlich: ein Foto im Hintergrund, darueber ein warmer,
          halbtransparenter Off-White-Schleier (links staerker, damit die Ueberschrift sicher
          lesbar ist). Dunkler Text statt weisser Schrift. Die zentrale Aktion ist die Textsuche;
          die Bereichsauswahl lebt ausschliesslich weiter unten bei "Wähle deinen Weg" — hier im
          Hero gibt es bewusst keine zweite, parallele Bereichsauswahl mehr. */}
      <section className="relative w-full">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <img
            src={SEGMENT_CONFIG.beruflich.heroBg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {/* Warmer Off-White-Schleier: links fast deckend (Lesbarkeit der Ueberschrift), nach
              rechts hin durchscheinender, damit das Foto als Atmosphaere erkennbar bleibt. */}
          <div className="absolute inset-0 bg-gradient-to-r from-beige/95 via-beige/90 to-beige/70"></div>
          <div className="absolute inset-0 bg-beige/30"></div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 relative z-10">

          <div className="max-w-2xl mb-8">
            <div className="mb-3">
              <SectionMarker>Dein Bildungswegweiser für die Schweiz</SectionMarker>
            </div>
            <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight text-dark mb-3 leading-tight">
              {t.home_headline}
            </h1>
            <p className="text-base md:text-lg text-gray-600 leading-relaxed">
              {t.home_subhead}
            </p>
          </div>

          {/* Zentrale, helle Suchkarte — die wichtigste Aktion der Startseite. Nutzt dieselbe
              Suchlogik/URL-Parameter wie die Suchuebersicht (siehe handleSearch oben): kein
              Bereich wird hier vorausgewaehlt, die Suche laeuft ueber alle drei Bereiche. */}
          <form onSubmit={handleSearch} className="relative max-w-2xl rounded-2xl border border-grey bg-white/95 shadow-lg shadow-black/5 backdrop-blur-sm p-5 sm:p-7 lg:p-8">
            <label htmlFor="home-search-input" className="block text-sm font-semibold text-dark mb-2">
              {t.search_placeholder}
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 pointer-events-none" aria-hidden="true" />
              <input
                id="home-search-input"
                type="text"
                placeholder={HOME_SEARCH_EXAMPLES[lang] || HOME_SEARCH_EXAMPLES.de}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-grey rounded-lg text-lg text-dark placeholder:text-gray-400 placeholder:text-base focus:outline-none focus:border-petrol focus:ring-1 focus:ring-petrol transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">{t.filter_label_loc || 'Ort oder Online'}</label>
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
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Kursformat</label>
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

            <div className="pt-3 mt-1">
              <button
                type="button"
                onClick={() => setShowMoreFilters(v => !v)}
                aria-expanded={showMoreFilters}
                aria-controls="home-more-filters"
                className="text-sm font-medium text-gray-500 hover:text-primary inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded"
              >
                <span>Weitere Filter{secondaryFilterCount > 0 ? ` (${secondaryFilterCount})` : ''}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </div>

            {showMoreFilters && (
              <div id="home-more-filters" className="mt-4 pt-4 border-t border-grey grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="flex items-center bg-white px-2.5 py-2 rounded border border-grey cursor-pointer">
                  <span className="text-xs text-gray-500 mr-1.5 whitespace-nowrap">Von</span>
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="bg-transparent text-xs outline-none text-gray-700 cursor-pointer w-full" />
                </label>
                <label className="flex items-center bg-white px-2.5 py-2 rounded border border-grey cursor-pointer">
                  <span className="text-xs text-gray-500 mr-1.5 whitespace-nowrap">Bis</span>
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="bg-transparent text-xs outline-none text-gray-700 cursor-pointer w-full" />
                </label>
                <div className={`flex items-center gap-1.5 bg-white px-2.5 py-2 rounded border ${priceError ? 'border-red-400' : 'border-grey'}`}>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{t.lbl_max_price}</span>
                  <input
                    type="number" min="0" step="1" placeholder="Beliebig" value={filterPriceMax}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (Number(val) >= 0 && !isNaN(Number(val)))) {
                        setFilterPriceMax(val);
                        setPriceError(false);
                      } else {
                        setPriceError(true);
                      }
                    }}
                    onBlur={() => { if (filterPriceMax && Number(filterPriceMax) < 0) { setFilterPriceMax(''); setPriceError(false); } }}
                    className={`w-full bg-transparent text-xs outline-none ${priceError ? 'text-red-600' : 'text-gray-700'}`}
                  />
                  {priceError && <span className="text-[10px] text-red-500 whitespace-nowrap">Nur positive Zahlen</span>}
                </div>

                <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-white border border-grey rounded px-2.5 py-2 text-xs outline-none text-gray-700">
                  <option value="All">{t.opt_all_levels}</option>
                  {Object.keys(COURSE_LEVELS).map(k => <option key={k} value={k}>{COURSE_LEVELS[k][lang] || COURSE_LEVELS[k].de}</option>)}
                </select>

                <LanguageDropdown
                  selectedLanguages={selectedLanguages}
                  setSelectedLanguages={setSelectedLanguages}
                  langMenuOpen={langMenuOpen}
                  setLangMenuOpen={setLangMenuOpen}
                  langMenuRef={langMenuRef}
                  t={t}
                />

                <label className={`flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-medium cursor-pointer transition-colors ${filterPro ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white border-grey text-gray-600'}`}>
                  <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  <span>{t.lbl_professional_filter || 'Verifiziert'}</span>
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                </label>
                <label className={`flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-medium cursor-pointer transition-colors ${filterDirectBooking ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white border-grey text-gray-600'}`}>
                  <input type="checkbox" checked={filterDirectBooking} onChange={(e) => setFilterDirectBooking(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  <span>{t.lbl_direct_booking_filter || 'Direktbuchung'}</span>
                  <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                </label>
              </div>
            )}

            <div className="mt-5 flex justify-center sm:justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-10 py-3.5 bg-primary hover:bg-orange-600 text-white font-label-md text-base font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol focus-visible:ring-offset-2"
              >
                <span>{HOME_SEARCH_BTN_LABEL[lang] || HOME_SEARCH_BTN_LABEL.de}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 2. WAEHLE DEINEN WEG — drei gleichwertige Kurswelten, Segmentfarben Blau/Orange/Gruen.
          Bewusst ohne Nummerierung ("Bereich 01/02/03") an den Karten, aus demselben Grund
          wie beim Wegweiser oben: die drei Bereiche sind gleichwertig, keine Rangfolge. */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 pb-4 border-b border-grey gap-3">
          <div>
            <div className="mb-2">
              <SectionMarker>Direkt zu den Kursen</SectionMarker>
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
                <CareerIcon className="w-5 h-5" />
              </div>
              <div className="h-44 w-full rounded overflow-hidden mb-5 bg-beige">
                <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="font-heading text-xl font-bold text-dark mb-2">{t.nav_professional}</h3>
              <p className="font-sans text-gray-500 text-sm mb-6 min-h-[2.5rem]">{t.home_card_prof_sub}</p>
            </div>
            <span className="inline-flex items-center justify-between pt-4 border-t border-grey font-semibold text-sm text-segBeruflich group-hover:translate-x-1 transition-transform">
              {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </span>
          </a>

          {/* PRIVAT & HOBBY - Orange */}
          <a href="/search?type=privat_hobby" onClick={(e) => { e.preventDefault(); setSearchType('privat_hobby'); window.history.pushState({ view: 'search' }, '', '/search?type=privat_hobby'); window.scrollTo(0,0); }} className="group bg-white border-t-4 border-primary border-x border-b border-grey rounded-b-lg p-6 md:p-8 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-end mb-4">
                <PrivateHobbyIcon className="w-5 h-5" />
              </div>
              <div className="h-44 w-full rounded overflow-hidden mb-5 bg-beige">
                <img src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="font-heading text-xl font-bold text-dark mb-2">{t.nav_private}</h3>
              <p className="font-sans text-gray-500 text-sm mb-6 min-h-[2.5rem]">{t.home_card_priv_sub}</p>
            </div>
            <span className="inline-flex items-center justify-between pt-4 border-t border-grey font-semibold text-sm text-primary group-hover:translate-x-1 transition-transform">
              {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </span>
          </a>

          {/* KINDER & JUGEND - Gruen */}
          <a href="/search?type=kinder_jugend" onClick={(e) => { e.preventDefault(); setSearchType('kinder_jugend'); window.history.pushState({ view: 'search' }, '', '/search?type=kinder_jugend'); window.scrollTo(0,0); }} className="group bg-white border-t-4 border-segKinder border-x border-b border-grey rounded-b-lg p-6 md:p-8 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-end mb-4">
                <ChildrenYouthIcon className="w-5 h-5" />
              </div>
              <div className="h-44 w-full rounded overflow-hidden mb-5 bg-beige">
                <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop" srcSet="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=400&auto=format&fit=crop 400w, https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop 800w" sizes="(max-width: 768px) 100vw, 33vw" alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
              </div>
              <h3 className="font-heading text-xl font-bold text-dark mb-2">{t.nav_kids}</h3>
              <p className="font-sans text-gray-500 text-sm mb-6 min-h-[2.5rem]">{t.home_card_kids_sub}</p>
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
            <div className="mb-2">
              <SectionMarker>Orientierung &amp; Vertiefung</SectionMarker>
            </div>
            <div className="flex items-center gap-2.5">
              <img src="/images/brand/kursnavi/guide.svg" alt="" aria-hidden="true" className="w-5 h-5" />
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-dark">{t.home_ratgeber_title || 'Ratgeber & Themenwelten'}</h2>
            </div>
            <p className="font-sans text-gray-500 max-w-2xl mt-1">{t.home_ratgeber_sub || ''}</p>
          </div>

          <div className="flex flex-col gap-8">
            {renderRatgeberPanel('beruflich', t.nav_professional || 'Beruf & Karriere')}
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
