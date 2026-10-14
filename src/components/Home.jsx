import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, ChevronRight, ChevronLeft, ChevronDown, CreditCard, Shield } from 'lucide-react';
import { LocationDropdown, DeliveryTypeFilter, LanguageDropdown, SaeulenFilter, KursartFilter } from './Filters';
import { SEGMENT_CONFIG, CATEGORY_TYPES, COURSE_LEVELS, PRIVAT_KURSARTEN, KINDER_KURSARTEN } from '../lib/constants';
import { PRIVAT_KURSART_ICONS, KINDER_KURSART_ICONS } from '../lib/kursartIcons';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { BASE_URL } from '../lib/siteConfig';
import { RATGEBER_STRUCTURE } from '../lib/ratgeberStructure';
import { getBereicheForSegment, getBereichUrl } from '../lib/bereichLandingConfig';
import { NewsletterSignup } from './Layout';
import { CareerIcon, PrivateHobbyIcon, ChildrenYouthIcon } from '../lib/segmentIcons';

// Pro Segment: Anzeigefarbe (Beruflich=blau, Privat & Hobby=orange, Kinder & Jugend=gruen) und Icon.
// Rein praesentational — wird fuer Bereichs-Links, Wegkarten und Ratgeber-Panels verwendet.
const SEGMENT_VISUALS = {
  beruflich: { icon: CareerIcon, bg: 'bg-segBeruflich', text: 'text-segBeruflich', border: 'border-segBeruflich' },
  privat_hobby: { icon: PrivateHobbyIcon, bg: 'bg-primary', text: 'text-primary', border: 'border-primary' },
  kinder_jugend: { icon: ChildrenYouthIcon, bg: 'bg-segKinder', text: 'text-segKinder', border: 'border-segKinder' },
};

// Vorgeschriebene Klassen-Kombinationen (nicht per Template-String aus SEGMENT_VISUALS
// zusammengesetzt!) fuer die "Alle Kurse in X anzeigen"-Buttons im Kategorie-Browser.
// Tailwind generiert Opacity-Varianten (z.B. /15, /40) nur fuer Klassen, die irgendwo im
// Quelltext woertlich vorkommen — ${segAccent.bg}/15 wuerde vom Scanner nicht erkannt.
const SEG_SHOW_ALL_STYLES = {
  beruflich: { card: 'bg-segBeruflich/15 border-segBeruflich/40 hover:bg-segBeruflich/25', arrow: 'text-segBeruflich' },
  privat_hobby: { card: 'bg-primary/15 border-primary/40 hover:bg-primary/25', arrow: 'text-primary' },
  kinder_jugend: { card: 'bg-segKinder/15 border-segKinder/40 hover:bg-segKinder/25', arrow: 'text-segKinder' },
};

// Dieselbe Einschraenkung gilt fuer die 30%-Rahmenfarbe im Ratgeber-Panel (renderRatgeberPanel) —
// ${visuals.border}/30 wuerde von Tailwind nicht erkannt, deshalb hier als Literal hinterlegt.
const SEG_BORDER_30 = {
  beruflich: 'border-segBeruflich/30',
  privat_hobby: 'border-primary/30',
  kinder_jugend: 'border-segKinder/30',
};

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

// Wiederkehrendes Leitelement "Linie mit Punkt" (siehe public/images/brand/kursnavi/marker-hero.svg)
// vor Abschnittslabels. Auf hellem Grund wird das Original-Asset verwendet (Petrol-Linie,
// orangener Punkt); auf dem dunklen Hero-Petrol ist die feste Petrol-Strichfarbe des Assets
// nicht lesbar, deshalb dort dieselbe Form/Proportion inline nachgebaut, nur die Linie heller.
const SectionMarker = ({ children, dark = false }) => (
  <div className="flex items-center gap-2.5">
    {dark ? (
      <svg width="34" height="8" viewBox="0 0 34 8" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M1 4H24" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="30" cy="4" r="3" fill="#E17A3B" />
      </svg>
    ) : (
      <img src="/images/brand/kursnavi/marker-hero.svg" alt="" aria-hidden="true" className="h-2 w-auto shrink-0" />
    )}
    <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-white/75' : 'text-petrol'}`}>{children}</span>
  </div>
);

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

  // Load taxonomy from DB (with fallback to constants.js)
  const { areas, getTypeLabel: dbGetTypeLabel, getAreaLabel: dbGetAreaLabel } = useTaxonomy();

  // --- KATEGORIEN-BROWSING STATE ("Durchsuche alle Bildungsthemen") ---
  // null = noch nichts ausgewaehlt -> zeigt nur die 3 Einstiege, keine lange Liste.
  const [activeType, setActiveType] = useState(null);           // Ebene 1 Auswahl
  const [activeArea, setActiveArea] = useState(null);           // Ebene 2 Auswahl
  const [activeSpecialty, setActiveSpecialty] = useState(null); // Ebene 3 Auswahl

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

  // Helper fuer Labels - nutzt DB-Taxonomie zuerst, dann Fallback auf constants.js
  const getTypeLabel = (key) => {
    const dbLabel = dbGetTypeLabel(key, lang);
    if (dbLabel && dbLabel !== key) return dbLabel;
    return CATEGORY_TYPES[key]?.[lang] || CATEGORY_TYPES[key]?.de || key;
  };

  const getAreaLabel = (type, areaKey) => {
    let areaBySlug = areas.find(a => a.slug === areaKey);
    if (!areaBySlug) {
      areaBySlug = areas.find(a => a.slug.startsWith(areaKey) || areaKey.startsWith(a.slug));
    }
    if (areaBySlug) {
      return areaBySlug[`label_${lang}`] || areaBySlug.label_de || areaKey;
    }
    const dbLabel = dbGetAreaLabel(type, areaKey, lang);
    if (dbLabel && dbLabel !== areaKey) return dbLabel;
    return areaKey;
  };

  // Label der aktuell tiefsten gewaehlten Browsing-Ebene, fuer den Satz "Du stoeberst in X."
  const currentBrowseLabel = activeSpecialty || (activeArea ? getAreaLabel(activeType, activeArea) : (activeType ? getTypeLabel(activeType) : null));

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

    if (activeType) {
      // Nutzer hat im "Bereiche entdecken"-Pfad zusaetzlich einen Bereich gewaehlt, bevor
      // "Kurse finden" gedrueckt wurde — Bereich und Suchtext sind kombinierbar, aber keines
      // ist Pflicht. Der gewaehlte Bereich hat Vorrang vor der Text-Vermutung unten; ein
      // eingegebener Suchtext bleibt als zusaetzlicher Filter (q) erhalten.
      setSearchType(activeType);
      setSearchArea(activeArea || "");
      setSearchSpecialty(activeSpecialty || "");
      setSearchFocus("");
      params.set('type', activeType);
      if (activeArea) params.set('area', activeArea);
      if (activeSpecialty) params.set('spec', activeSpecialty);
    } else {
      // Kein Bereich gewaehlt: Zieltyp wird wie bisher aus dem Suchtext geraten.
      const guessedType = searchQuery ? guessTypeFromQuery(searchQuery) : 'privat_hobby';
      params.set('type', guessedType);
      params.set('autoType', '1');
    }

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

  // --- Klick-Handler fuer "Durchsuche alle Bildungsthemen" ---
  // Jede Ebene zeigt zusaetzlich zu den Unterkategorien eine "Alle Kurse in X"-Option, damit
  // man nicht erst bis zum Ende durchklicken muss, um zu einer gefilterten Suche zu kommen.
  const selectType = (typeKey) => {
    setActiveType(typeKey);
    setActiveArea(null);
    setActiveSpecialty(null);
  };

  const selectArea = (areaSlug) => {
    setActiveArea(areaSlug);
    setActiveSpecialty(null);
  };

  const selectSpecialty = (specialtyLabel) => {
    setActiveSpecialty(specialtyLabel);
  };

  const selectFocus = (focusLabel) => handleCategorySelect(activeType, activeArea, activeSpecialty, focusLabel);

  const showAllInType = () => handleCategorySelect(activeType, null, null, null);
  const showAllInArea = () => handleCategorySelect(activeType, activeArea, null, null);
  const showAllInSpecialty = () => handleCategorySelect(activeType, activeArea, activeSpecialty, null);

  const resetToAllCategories = () => {
    setActiveType(null);
    setActiveArea(null);
    setActiveSpecialty(null);
  };

  // --- GEMEINSAME FILTER (gelten fuer Bereichs-Links UND Freitextsuche, siehe Kommentar bei
  // handleCategorySelect: App.jsx synchronisiert diesen Zustand automatisch in die Such-URL) ---
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

  // Akzentfarbe des aktuell gewaehlten Bereichs fuer die "Alle Kurse in X anzeigen"-Buttons
  // im Kategorie-Browser (Blau/Orange/Gruen statt immer Orange) — faellt auf Orange zurueck,
  // solange noch kein Bereich gewaehlt ist.
  const segShowAll = SEG_SHOW_ALL_STYLES[activeType] || SEG_SHOW_ALL_STYLES.privat_hobby;

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


      {/* 1. HERO SECTION — Ueberschrift ueber volle Breite, darunter zwei gleichwertige
          Einstiege: links Browsing durch die Kategorien, rechts die Textsuche. Darunter ein
          gemeinsamer Filterblock, der fuer beide Einstiege gilt. Kein Kompass-/Weggabelungs-
          Symbol, keine Nummerierung — die drei Bereiche sind gleichwertig. */}
      <section className="relative w-full bg-[#14313B] text-white">
        {/* Hintergrund-Ebene: Foto + Petrol-Verlauf + dezente Lichtflaechen. Bewusst in einem
            eigenen "overflow-hidden"-Wrapper statt auf der Section selbst — sonst wuerden die
            Ort-/Kursformat-Dropdowns im Filterbereich weiter unten am Section-Rand abgeschnitten,
            sobald ihr aufklappendes Menue ueber die Section-Kante hinausragt. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <img
            src={SEGMENT_CONFIG.beruflich.heroBg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {/* Durchgehend dunkle, halbtransparente Petrol-Flaeche ueber dem Foto (wie eine dunkle
              transparente Rechteck-Ebene in einer Praesentation) — das Foto bleibt als Atmosphaere
              erkennbar, aber der weisse Text ist ueberall zuverlaessig lesbar. Vorherige Version
              liess in der Bildmitte zu viel Helligkeit durch (dort sass u.a. die Ueberschrift). */}
          <div className="absolute inset-0 bg-petrolDark/80"></div>
          <div className="absolute -top-32 right-1/4 w-[550px] h-[550px] bg-segBeruflich/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/[0.06] rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 relative z-10">

          {/* Abschnittsmarker + Ueberschrift + Intro ueber die gesamte verfuegbare Breite */}
          <div className="mb-6 md:mb-7">
            <div className="mb-3">
              <SectionMarker dark>Dein Bildungswegweiser für die Schweiz</SectionMarker>
            </div>
            <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight text-beige mb-3 leading-tight">
              {t.home_headline}
            </h1>
            <p className="text-base md:text-lg text-white/80 leading-relaxed">
              {t.home_subhead}
            </p>
          </div>

          {/* Gemeinsames Panel UND gemeinsames Formular: Browsing links und Suche rechts gehoeren
              sichtbar zusammen, beide sind kombinierbar (Bereich und/oder Suchtext), die Filter
              darunter gelten fuer beides, und "Kurse finden" am Ende fasst alles zusammen.
              bg-Deckkraft bewusst hoch (wenig transparent), damit das Hintergrundfoto hier nicht
              von der Bedienung ablenkt. */}
          <form onSubmit={handleSearch} className="relative rounded-2xl border border-white/10 bg-[#14313B]/90 backdrop-blur-sm p-5 sm:p-7 lg:p-8">
          <div className="mb-6 md:mb-7">
            <h2 className="text-xl md:text-2xl font-heading font-bold text-beige mb-1.5">Wie möchtest du starten?</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Durchstöbere die Bildungsbereiche oder suche direkt nach einem Thema. Verfeinere deine Auswahl anschliessend optional mit Ort, Kursformat und weiteren Filtern.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

            {/* LINKS (Desktop) / 2. Block (Mobile): mehrstufiger Kategorie-Browser */}
            <div className="order-2 lg:order-1 lg:col-span-5 flex flex-col">
              <div className="mb-6">
                <SectionMarker dark>Bereiche entdecken</SectionMarker>
              </div>

              {/* Breadcrumb: erscheint erst, sobald ein Bereich gewaehlt ist — im Ausgangszustand
                  wuerde "Alle Bereiche" hier nur die Ueberschrift "Bereiche entdecken" wiederholen. */}
              {activeType && (
              <nav aria-label="Kategorie-Navigation" className="mb-4">
                <ol className="flex flex-wrap items-center gap-1.5 text-xs">
                  <li>
                    <button type="button" onClick={resetToAllCategories} className="text-white/60 hover:text-white underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
                      Alle Bereiche
                    </button>
                  </li>
                  {activeType && (
                    <li className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-white/40" aria-hidden="true" />
                      {activeArea ? (
                        <button type="button" onClick={() => selectType(activeType)} className="text-white/60 hover:text-white underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
                          {getTypeLabel(activeType)}
                        </button>
                      ) : (
                        <span aria-current="page" className="text-white font-semibold">{getTypeLabel(activeType)}</span>
                      )}
                    </li>
                  )}
                  {activeArea && (
                    <li className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-white/40" aria-hidden="true" />
                      {activeSpecialty ? (
                        <button type="button" onClick={() => selectArea(activeArea)} className="text-white/60 hover:text-white underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
                          {getAreaLabel(activeType, activeArea)}
                        </button>
                      ) : (
                        <span aria-current="page" className="text-white font-semibold">{getAreaLabel(activeType, activeArea)}</span>
                      )}
                    </li>
                  )}
                  {activeSpecialty && (
                    <li className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-white/40" aria-hidden="true" />
                      <span aria-current="page" className="text-white font-semibold">{activeSpecialty}</span>
                    </li>
                  )}
                </ol>
              </nav>
              )}

              {activeType && (
                <p className="text-xs text-white/55 mb-3 leading-relaxed">
                  Du stöberst in <span className="font-semibold text-white/80">{currentBrowseLabel}</span>. Wähle ein Unterthema oder zeige direkt alle passenden Kurse.
                </p>
              )}

              <div className="space-y-2.5">
                {/* Ebene 1: die drei gleichwertigen Bereiche — als eigenstaendige Entdeckungs-
                    Einstiege, nicht als identische Formularzeilen: je ein Icon, ein dezenter
                    linker Farbakzent, Name, kurze Beschreibung und ein Pfeil. */}
                {!activeType && [
                  { key: 'beruflich', icon: CareerIcon, label: t.nav_professional || 'Beruflich', desc: t.home_card_prof_sub, accentBorder: 'border-segBeruflich/60', dot: 'bg-segBeruflich' },
                  { key: 'privat_hobby', icon: PrivateHobbyIcon, label: t.nav_private || 'Privat & Hobby', desc: t.home_card_priv_sub, accentBorder: 'border-primary/60', dot: 'bg-primary' },
                  { key: 'kinder_jugend', icon: ChildrenYouthIcon, label: t.nav_kids || 'Kinder & Jugend', desc: t.home_card_kids_sub, accentBorder: 'border-segKinder/60', dot: 'bg-segKinder' },
                ].map(({ key, icon: Icon, label, desc, accentBorder, dot }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectType(key)}
                    className={`w-full group flex items-center gap-3.5 rounded-lg border-l-[3px] ${accentBorder} bg-white/5 pl-4 pr-3.5 py-3.5 hover:bg-white/10 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}
                  >
                    <span className="w-9 h-9 rounded-full flex items-center justify-center bg-beige shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true"></span>
                        <span className="text-base font-bold text-beige group-hover:text-white transition-colors">{label}</span>
                      </span>
                      <p className="text-xs text-white/60 mt-0.5 leading-snug">{desc}</p>
                    </span>
                    <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" aria-hidden="true" />
                  </button>
                ))}

                {/* Ebene 2: Bereiche innerhalb des gewaehlten Typs, plus "alle anzeigen" in Segmentfarbe */}
                {activeType && !activeArea && (
                  <>
                    <button type="button" onClick={showAllInType} className={`w-full flex items-center justify-between p-3.5 rounded-lg border ${segShowAll.card} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}>
                      <span className="text-sm font-bold text-beige">Alle Kurse in {getTypeLabel(activeType)} anzeigen</span>
                      <ArrowRight className={`w-4 h-4 ${segShowAll.arrow} shrink-0`} aria-hidden="true" />
                    </button>
                    {visibleAreas.length > 0 && (
                      <p className="text-xs text-white/50 pt-1 pb-0.5 px-1">Oder weiter stöbern:</p>
                    )}
                    {visibleAreas.map(areaSlug => (
                      <button key={areaSlug} type="button" onClick={() => selectArea(areaSlug)} className="w-full flex items-center justify-between p-3.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <span className="text-sm font-medium text-beige">{getAreaLabel(activeType, areaSlug)}</span>
                        <ChevronRight className="w-4 h-4 text-white/50 shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                    <button type="button" onClick={() => setActiveType(null)} className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white pt-2 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Zurück
                    </button>
                  </>
                )}

                {/* Ebene 3: Spezialgebiete innerhalb des gewaehlten Bereichs, plus "alle anzeigen" */}
                {activeArea && !activeSpecialty && (
                  <>
                    <button type="button" onClick={showAllInArea} className={`w-full flex items-center justify-between p-3.5 rounded-lg border ${segShowAll.card} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}>
                      <span className="text-sm font-bold text-beige">Alle Kurse in {getAreaLabel(activeType, activeArea)} anzeigen</span>
                      <ArrowRight className={`w-4 h-4 ${segShowAll.arrow} shrink-0`} aria-hidden="true" />
                    </button>
                    {visibleSpecialties.length > 0 && (
                      <p className="text-xs text-white/50 pt-1 pb-0.5 px-1">Oder weiter stöbern:</p>
                    )}
                    {visibleSpecialties.map(spec => (
                      <button key={spec.label} type="button" onClick={() => selectSpecialty(spec.label)} className="w-full flex items-center justify-between p-3.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <span className="text-sm font-medium text-beige">{spec.label}</span>
                        <ChevronRight className="w-4 h-4 text-white/50 shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                    <button type="button" onClick={() => selectType(activeType)} className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white pt-2 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Zurück
                    </button>
                  </>
                )}

                {/* Ebene 4: Schwerpunkte innerhalb des gewaehlten Spezialgebiets, plus "alle anzeigen" */}
                {activeSpecialty && (
                  <>
                    <button type="button" onClick={showAllInSpecialty} className={`w-full flex items-center justify-between p-3.5 rounded-lg border ${segShowAll.card} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}>
                      <span className="text-sm font-bold text-beige">Alle Kurse in {activeSpecialty} anzeigen</span>
                      <ArrowRight className={`w-4 h-4 ${segShowAll.arrow} shrink-0`} aria-hidden="true" />
                    </button>
                    {visibleFocuses.length > 0 && (
                      <p className="text-xs text-white/50 pt-1 pb-0.5 px-1">Oder weiter stöbern:</p>
                    )}
                    {visibleFocuses.map(focus => (
                      <button key={focus} type="button" onClick={() => selectFocus(focus)} className="w-full flex items-center justify-between p-3.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <span className="text-sm font-medium text-beige">{focus}</span>
                        <ArrowRight className="w-4 h-4 text-white/50 shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                    <button type="button" onClick={() => selectArea(activeArea)} className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white pt-2 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Zurück
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* RECHTS (Desktop) / 1. Block (Mobile): Textsuche. Ueberschrift sitzt wie bei
                "Bereiche entdecken" auf der Petrol-Flaeche (nicht in der hellen Box), mit
                demselben Linie-mit-Punkt-Marker, damit beide Einstiege erkennbar auf gleicher
                Ebene stehen; die helle Box enthaelt nur noch das eigentliche Eingabefeld-Modul. */}
            <div className="order-1 lg:order-2 lg:col-span-7 w-full flex flex-col">
              <div className="mb-6">
                <SectionMarker dark>Gezielt suchen</SectionMarker>
              </div>

              <div className="bg-beige text-dark rounded-xl p-6 md:p-8 shadow-lg shadow-black/20">
                <div>
                  <label htmlFor="home-search-input" className="block text-sm font-medium text-dark mb-2">
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
                  <details className="mt-2">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-gray-500 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol rounded">
                      {t.search_help_label || 'Such-Tipp'}
                    </summary>
                    <p className="pb-1 text-xs text-gray-500">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe mit AND oder OR (z.B. "Yoga AND Zürich")'}</p>
                  </details>
                </div>
              </div>
            </div>

          </div>

          {/* GEMEINSAME FILTER — gelten gleichermassen fuer den Kategorie-Browser links und die
              Textsuche rechts. Bewusst kein zweites schweres Beige-Panel: der Filterbereich
              bleibt leicht/transparent und damit optisch mit dem Hero verbunden, nur per
              Trennlinie vom Zwei-Spalten-Bereich abgesetzt. Ort/Kursformat immer sichtbar,
              Rest hinter "Weitere Filter". */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="mb-5">
              <SectionMarker dark>Verfeinern (optional)</SectionMarker>
              <p className="text-xs text-white/55 mt-1.5">Verfeinere deine Auswahl – unabhängig davon, wie du gestartet bist.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">{t.filter_label_loc || 'Ort'}</label>
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
                <label className="block text-sm font-medium text-white/70 mb-1.5">Kursformat</label>
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

            <div className="pt-3 mt-3">
              <button
                type="button"
                onClick={() => setShowMoreFilters(v => !v)}
                aria-expanded={showMoreFilters}
                aria-controls="home-more-filters"
                className="text-sm font-medium text-white/70 hover:text-primary inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
              >
                <span>Weitere Filter{secondaryFilterCount > 0 ? ` (${secondaryFilterCount})` : ''}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </div>

            {showMoreFilters && (
              <div id="home-more-filters" className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeType === 'beruflich' && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <SaeulenFilter selectedSaule={selectedSaule} setSelectedSaule={setSelectedSaule} />
                  </div>
                )}
                {activeType === 'privat_hobby' && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <KursartFilter kursarten={PRIVAT_KURSARTEN} icons={PRIVAT_KURSART_ICONS} selectedKursart={selectedKursart} setSelectedKursart={setSelectedKursart} colorScheme="orange" />
                  </div>
                )}
                {activeType === 'kinder_jugend' && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <KursartFilter kursarten={KINDER_KURSARTEN} icons={KINDER_KURSART_ICONS} selectedKursart={selectedKursart} setSelectedKursart={setSelectedKursart} colorScheme="green" />
                  </div>
                )}

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
          </div>

          {/* Gemeinsame Hauptaktion — steht bewusst ganz am Ende, nach Bereich/Suche UND Filtern,
              damit eine logische Reihenfolge entsteht: Bereich entdecken oder gezielt suchen,
              optional verfeinern, dann Kurse finden. Fasst Bereichsauswahl (falls getroffen),
              Suchtext (falls eingegeben) und alle Filter in einer Aktion zusammen. Abstand bewusst
              knapp, da ohne die "Aktive Filter"-Zusammenfassung auf der Startseite kein grosser
              Leerraum vor dem Button mehr noetig ist. */}
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-center sm:justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-10 py-3.5 bg-primary hover:bg-orange-600 text-white font-label-md text-base font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14313B]"
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
                <PrivateHobbyIcon className="w-5 h-5" />
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
                <ChildrenYouthIcon className="w-5 h-5" />
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
