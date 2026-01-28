import React, { useEffect, useMemo } from 'react';
import { Search, ChevronRight, User, X, Calendar, Shield, MapPin, CheckCircle, Loader, Bell, ArrowDown, Bookmark, BookmarkCheck, CreditCard, Info } from 'lucide-react';
import { LocationDropdown, LanguageDropdown } from './Filters';
import { Globe } from 'lucide-react';
import { CATEGORY_TYPES, NEW_TAXONOMY, AGE_GROUPS, COURSE_LEVELS } from '../lib/constants';
import { formatPriceCHF } from '../lib/formatPrice';

const SearchPageView = ({
    courses,
    searchQuery, setSearchQuery,
    searchType, setSearchType,
    searchArea, setSearchArea,
    searchSpecialty, setSearchSpecialty,
    searchFocus, setSearchFocus,
    locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef,
    loading, filteredCourses, setSelectedCourse, setView,
    t, filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo, filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel, filterPro, setFilterPro, filterDirectBooking, setFilterDirectBooking,
    selectedLanguage, setSelectedLanguage, langMenuOpen, setLangMenuOpen, langMenuRef,
    savedCourseIds, onToggleSaveCourse
}) => {

    // --- SEO LOGIC: Zero-Result Rule + Dynamic Meta Tags ---
    useEffect(() => {
        if (loading) return; // Wait for data

        // Build dynamic title and description
        const typeLabel = searchType ? (CATEGORY_TYPES?.[searchType]?.de || searchType) : 'Alle Kurse';

        // ✅ Crash-sicher: label ist ein Objekt (de/en/...)
        const areaLabel = searchArea
            ? (NEW_TAXONOMY?.[searchType]?.[searchArea]?.label?.de || searchArea)
            : '';

        const locationLabel = selectedLocations.length > 0 ? selectedLocations[0] : 'Schweiz';

        const pageTitle = searchQuery
            ? `${searchQuery} - Kurssuche | KursNavi`
            : areaLabel
                ? `${areaLabel} in ${locationLabel} | KursNavi`
                : `${typeLabel} in ${locationLabel} | KursNavi`;

        const pageDescription = filteredCourses.length > 0
            ? `${filteredCourses.length} ${areaLabel || typeLabel} in ${locationLabel} finden. Jetzt vergleichen und buchen auf KursNavi.`
            : `Finde Kurse in ${locationLabel} - Der Schweizer Kursmarktplatz für Weiterbildung, Freizeit und Kinderkurse.`;

        document.title = pageTitle;

        // Meta Description
        let metaDescTag = document.querySelector('meta[name="description"]');
        if (!metaDescTag) {
            metaDescTag = document.createElement('meta');
            metaDescTag.name = 'description';
            document.head.appendChild(metaDescTag);
        }
        metaDescTag.content = pageDescription;

        // OG Tags
        const ogTags = {
            'og:title': pageTitle,
            'og:description': pageDescription,
            'og:url': window.location.href,
            'og:type': 'website',
            'og:site_name': 'KursNavi',
            'twitter:card': 'summary',
            'twitter:title': pageTitle,
            'twitter:description': pageDescription
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

        // Robots meta tag (Zero-Result Rule)
        let robotsMeta = document.querySelector('meta[name="robots"]');
        if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.name = "robots";
            document.head.appendChild(robotsMeta);
        }

        if (filteredCourses.length === 0) {
            // 3.1 Empty Category/Search -> NOINDEX
            robotsMeta.content = "noindex,follow";
        } else {
            // Has Results -> INDEX
            robotsMeta.content = "index,follow";
        }

        // Cleanup: Reset to index on unmount to avoid polluting other pages
        return () => {
            if (robotsMeta) robotsMeta.content = "index,follow";
        };
    }, [filteredCourses.length, loading, searchQuery, searchType, searchArea, selectedLocations]);

    // --- DYNAMIC FILTER LOGIC (Hide empty categories) ---
    // Include ALL categories (primary + Zweitkategorien) from course_categories junction table
    const availableTypes = [...new Set(
        courses.flatMap(c => {
            const types = [c.category_type];
            if (Array.isArray(c.all_categories)) {
                types.push(...c.all_categories.map(cat => cat.category_type));
            }
            return types.filter(Boolean);
        })
    )];

    const availableAreas = [...new Set(
        courses.flatMap(c => {
            const areas = [];
            // Include primary area if type matches or no type filter
            if (!searchType || c.category_type === searchType) {
                if (c.category_area) areas.push(c.category_area);
            }
            // Include areas from all_categories if type matches
            if (Array.isArray(c.all_categories)) {
                c.all_categories.forEach(cat => {
                    if ((!searchType || cat.category_type === searchType) && cat.category_area) {
                        areas.push(cat.category_area);
                    }
                });
            }
            return areas;
        })
    )];

    const availableSpecialties = [...new Set(
        courses.flatMap(c => {
            const specialties = [];
            // Include primary specialty if filters match or no filters
            const primaryTypeMatch = !searchType || c.category_type === searchType;
            const primaryAreaMatch = !searchArea || c.category_area === searchArea;
            if (primaryTypeMatch && primaryAreaMatch && c.category_specialty) {
                specialties.push(c.category_specialty);
            }
            // Include specialties from all_categories if filters match
            if (Array.isArray(c.all_categories)) {
                c.all_categories.forEach(cat => {
                    const typeMatch = !searchType || cat.category_type === searchType;
                    const areaMatch = !searchArea || cat.category_area === searchArea;
                    if (typeMatch && areaMatch && cat.category_specialty) {
                        specialties.push(cat.category_specialty);
                    }
                });
            }
            return specialties;
        })
    )];

    const availableFocuses = [...new Set(
        courses.flatMap(c => {
            const focuses = [];
            const primaryTypeMatch = !searchType || c.category_type === searchType;
            const primaryAreaMatch = !searchArea || c.category_area === searchArea;
            const primarySpecMatch = !searchSpecialty || c.category_specialty === searchSpecialty;
            if (primaryTypeMatch && primaryAreaMatch && primarySpecMatch && c.category_focus) {
                focuses.push(c.category_focus);
            }
            if (Array.isArray(c.all_categories)) {
                c.all_categories.forEach(cat => {
                    const typeMatch = !searchType || cat.category_type === searchType;
                    const areaMatch = !searchArea || cat.category_area === searchArea;
                    const specMatch = !searchSpecialty || cat.category_specialty === searchSpecialty;
                    if (typeMatch && areaMatch && specMatch && cat.category_focus) {
                        focuses.push(cat.category_focus);
                    }
                });
            }
            return focuses;
        })
    )];

        // Helper to get Label (crash-sicher)
    const getLabel = (key, scope) => {
        if (!key) return '';

        if (scope === 'type') return CATEGORY_TYPES?.[key]?.de || key;
        if (scope === 'age') return AGE_GROUPS?.[key]?.de || key;

        if (scope === 'area') {
            // 1) Wenn ein Typ gewählt ist: dort zuerst suchen
            const direct = NEW_TAXONOMY?.[searchType]?.[key]?.label?.de;
            if (direct) return direct;

            // 2) Sonst: in allen Typen suchen
            for (const typeKey of Object.keys(NEW_TAXONOMY || {})) {
                const lbl = NEW_TAXONOMY?.[typeKey]?.[key]?.label?.de;
                if (lbl) return lbl;
            }
            return key;
        }

        // specialties sind aktuell Plain Strings aus DB -> direkt zurückgeben
        if (scope === 'specialty') return key;

        // focuses sind Plain Strings aus DB -> direkt zurückgeben
        if (scope === 'focus') return key;

        return key;
    };


    // --- HELPER: Consistent Price Labeling (match DetailView logic) ---
    const getPriceLabel = (c) => {
        if (!c) return '';
        const type = c.booking_type || 'platform';
        const price = Number(c.price) || 0;

        if (type === 'lead' && price === 0) return 'Preis auf Anfrage';
        if (type === 'external' && price === 0) return 'Siehe Webseite';
        if (price === 0) return 'Kostenlos';
        return `${t.currency} ${formatPriceCHF(price)}`;
    };

    // --- HELPER: Check if course is sold out (all events full) ---
    const isSoldOut = (course) => {
        if (course.booking_type !== 'platform') return false;

        let events = [];
        if (course.course_events && course.course_events.length > 0) {
            events = course.course_events;
        } else if (course.start_date) {
            events = [{
                max_participants: course.max_participants || 0,
                bookings: course.bookings || []
            }];
        }

        if (events.length === 0) return false;

        return events.every(ev => {
            const max = ev.max_participants || 0;
            if (max === 0) return false; // Unlimited capacity
            const bookedCount = Array.isArray(ev.bookings)
                ? (ev.bookings[0]?.count || ev.bookings.length)
                : (ev.bookings?.count || 0);
            return bookedCount >= max;
        });
    };

    const resetFilters = () => {
        setSearchType(""); setSearchArea(""); setSearchSpecialty(""); setSearchFocus("");
        setSelectedLocations([]); setSearchQuery(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterPriceMax(""); setFilterLevel("All"); setFilterPro(false); setFilterDirectBooking(false);
    };

    // --- RANKING LOGIC (v3.1) ---
    // Formula: Score = Plan * Booking * (0.6 + 0.4*Freshness) * (1 + RandomEpsilon)
    // Bei aktivem Datumsfilter: Kurse MIT Datum zuerst, dann Kurse OHNE Datum
    const sortedCourses = useMemo(() => {
        // Helper: Prüft ob Kurs ein Datum hat
        const hasDate = (c) => {
            if (c.start_date) return true;
            if (Array.isArray(c.course_events) && c.course_events.some(ev => ev.start_date)) return true;
            return false;
        };

        const getScore = (c) => {
            // 1. Plan Factor (Fallback logic for legacy data)
            const planF = c.plan_factor || (c.is_pro ? 1.2 : 1.0);

            // 2. Booking Factor (Placeholder until booking system is live)
            const bookF = c.booking_factor || 1.0;

            // 3. Freshness Score (0-1)
            let freshScore = 0.5;
            if (c.created_at) {
                const daysOld = (new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24);
                freshScore = Math.max(0, 1 - (daysOld / 90));
            }
            const timeFactor = 0.6 + (0.4 * freshScore);

            // 4. Stable Random Epsilon (-0.03 to +0.03)
            const seed = (c.id || "0").toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const randomJitter = Math.sin(seed) * 0.03;

            return planF * bookF * timeFactor * (1 + randomJitter);
        };

        return [...filteredCourses].sort((a, b) => {
            // Bei aktivem Datumsfilter: Kurse mit Datum zuerst
            if (filterDateFrom || filterDateTo) {
                const aHasDate = hasDate(a);
                const bHasDate = hasDate(b);

                // Kurse mit Datum vor Kursen ohne Datum
                if (aHasDate && !bHasDate) return -1;
                if (!aHasDate && bHasDate) return 1;
            }

            // Innerhalb der Gruppe: nach Score sortieren
            return getScore(b) - getScore(a);
        });
    }, [filteredCourses, filterDateFrom, filterDateTo]);

    return (
        <div className="min-h-screen bg-beige">
            <div className="bg-white border-b pt-8 pb-4 sticky top-20 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input type="text" placeholder={t.search_refine} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-beige border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                        </div>
                        <LocationDropdown locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} />
                        <LanguageDropdown selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} langMenuOpen={langMenuOpen} setLangMenuOpen={setLangMenuOpen} langMenuRef={langMenuRef} t={t} />
                        <button onClick={() => { resetFilters(); setSelectedLanguage(null); }} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition" title="Reset Filters"><X className="w-6 h-6" /></button>
                    </div>

                    {/* NEW TAXONOMY FILTERS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <select value={searchType} onChange={(e) => { setSearchType(e.target.value); setSearchArea(""); setSearchSpecialty(""); setSearchFocus(""); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Alle Kategorien</option>
                            {availableTypes.map(type => (<option key={type} value={type}>{getLabel(type, 'type')}</option>))}
                        </select>
                        <select value={searchArea} onChange={(e) => { setSearchArea(e.target.value); setSearchSpecialty(""); setSearchFocus(""); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" disabled={!searchType}>
                            <option value="">Alle Bereiche</option>
                            {availableAreas.map(area => (<option key={area} value={area}>{getLabel(area, 'area')}</option>))}
                        </select>
                        <select value={searchSpecialty} onChange={(e) => { setSearchSpecialty(e.target.value); setSearchFocus(""); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" disabled={!searchArea}>
                            <option value="">Alle Themen</option>
                            {availableSpecialties.map(spec => (<option key={spec} value={spec}>{spec}</option>))}
                        </select>
                        <select value={searchFocus || ""} onChange={(e) => setSearchFocus(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" disabled={!searchSpecialty || availableFocuses.length === 0}>
                            <option value="">Alle Fokus</option>
                            {availableFocuses.map(f => (<option key={f} value={f}>{f}</option>))}
                        </select>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2 items-center border-t pt-3 border-gray-100">
                        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-400">Von</span>
                            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600" />
                            <span className="text-xs text-gray-400">Bis</span>
                            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600" />
                        </div>
                        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200"><span className="text-sm text-gray-500">{t.lbl_max_price}</span><input type="number" placeholder="Any" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-16 bg-transparent text-sm outline-none text-gray-600" /></div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none text-gray-600"><option value="All">{t.opt_all_levels}</option>{Object.keys(COURSE_LEVELS).map(k => <option key={k} value={k}>{COURSE_LEVELS[k].de}</option>)}</select>
                         <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterPro ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`} title={t.tooltip_pro_verified}><input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary" /><span className={`text-sm font-medium ${filterPro ? 'text-blue-700' : 'text-gray-600'}`}>{t.lbl_professional_filter}</span><Shield className="w-3 h-3 text-blue-500" /></label>
                         <div className="relative group">
                            <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterDirectBooking ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                                <input type="checkbox" checked={filterDirectBooking} onChange={(e) => setFilterDirectBooking(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                <span className={`text-sm font-medium ${filterDirectBooking ? 'text-green-700' : 'text-gray-600'}`}>{t.lbl_direct_booking_filter}</span>
                                <CreditCard className="w-3 h-3 text-green-500" />
                                <Info className="w-3 h-3 text-gray-400 group-hover:text-green-500 transition-colors" />
                            </label>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-72 text-center z-[100] shadow-lg">
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                                <div className="font-semibold mb-1">{t.lbl_direct_booking_filter}</div>
                                <div className="text-gray-300">{t.tooltip_direct_booking_long || t.tooltip_direct_booking}</div>
                            </div>
                         </div>
                    </div>
                </div>
                 {(selectedLocations.length > 0 || selectedLanguage) && (
                    <div className="max-w-7xl mx-auto px-4 pt-2 flex gap-2 flex-wrap">
                        {selectedLanguage && <span onClick={() => setSelectedLanguage(null)} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-purple-200 flex items-center"><Globe className="w-3 h-3 mr-1"/> {selectedLanguage} <X className="w-3 h-3 ml-1 opacity-50" /></span>}
                        {selectedLocations.map((loc, i) => (<span key={i} onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">{loc} <X className="w-3 h-3 ml-1 opacity-50" /></span>))}
                    </div>
                 )}
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                 {loading ? <div className="text-center py-20"><Loader className="animate-spin w-10 h-10 text-primary mx-auto" /></div> : filteredCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {sortedCourses.map(course => {
                      const slugify = (input) => (input || '').toString().trim().toLowerCase()
                          .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
                          .replace(/&/g, ' und ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                      const coursePath = `/courses/${slugify(course.primary_category || course.category_area || 'kurs')}/${slugify(course.canton || 'schweiz')}/${course.id}-${slugify(course.title || 'detail')}`;
                      return (
                      <a key={course.id} href={coursePath} onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) return;
                          e.preventDefault();
                          window.history.pushState({ view: 'detail', courseId: course.id }, '', coursePath);
                      }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group" style={{textDecoration: 'none', color: 'inherit'}}>
                        <div className="relative h-48 overflow-hidden">
                            <img
                                src={course.image_url}
                                alt={`${course.title} - Kurs in ${course.canton}`}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                                <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm flex items-center"><MapPin className="w-3 h-3 mr-1 text-primary" />{course.canton}</div>
                                {course.is_pro && <div className="bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-bold shadow-sm flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Pro</div>}
                                {isSoldOut(course) && <div className="bg-red-500/90 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Ausgebucht</div>}
                            </div>

                            <button
                                type="button"
                                title={(savedCourseIds || []).includes(course.id) ? "Aus Merkliste entfernen" : "Kurs merken"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSaveCourse && onToggleSaveCourse(course);
                                }}
                                className={`absolute top-3 right-3 w-10 h-10 rounded-full shadow-sm border flex items-center justify-center transition
                                    ${(savedCourseIds || []).includes(course.id)
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white/95 text-gray-700 border-white/70 hover:bg-white'}`}
                            >
                                {(savedCourseIds || []).includes(course.id)
                                    ? <BookmarkCheck className="w-5 h-5" />
                                    : <Bookmark className="w-5 h-5" />
                                }
                            </button>
                        </div>

                        <div className="p-5">
                            <h3 className="font-bold text-lg text-dark leading-tight line-clamp-2 h-12 mb-2 font-heading">
                                {course.title}
                            </h3>

                            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
                                {/* Anbieter-Badge */}
                                <div className="min-w-0">
                                    <div className="inline-flex items-center bg-beige px-2 py-1 rounded text-xs text-gray-500">
                                        <User className="w-3 h-3 text-gray-500 mr-1 shrink-0" />
                                        <span className="truncate">{course.instructor_name}</span>
                                    </div>
                                </div>

                                {/* Preis */}
                                <span className="ml-3 font-heading font-bold text-primary text-xs leading-tight text-right">
                                    {getPriceLabel(course)}
                                </span>
                            </div>
                        </div>
                      </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 px-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 font-heading">
                        Kursangebot im Aufbau
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-6">
                        In deiner Region bauen wir das Angebot gerade auf. <br />
                        Melde dich unten im Footer für unseren Newsletter an, um informiert zu bleiben.
                    </p>
                    <button 
                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        className="text-primary font-bold hover:text-orange-700 transition flex items-center justify-center mx-auto gap-2 border border-orange-200 px-4 py-2 rounded-lg bg-orange-50 hover:bg-orange-100"
                    >
                        Zum Newsletter scrollen <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
            </main>
        </div>
    );
};

export default SearchPageView;