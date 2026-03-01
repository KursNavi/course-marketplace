import React, { useEffect, useMemo } from 'react';
import { Search, ChevronRight, User, X, Shield, MapPin, CheckCircle, Loader, Bell, ArrowDown, Bookmark, BookmarkCheck, CreditCard, Info, EyeOff, Briefcase, Palette, Smile, BookOpen, Compass } from 'lucide-react';
import { LocationDropdown, LanguageDropdown, DeliveryTypeFilter } from './Filters';
import { Globe } from 'lucide-react';
import { CATEGORY_TYPES, AGE_GROUPS, COURSE_LEVELS, DELIVERY_TYPES, SEGMENT_CONFIG } from '../lib/constants';
import { formatPriceCHF } from '../lib/formatPrice';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { supabase } from '../lib/supabase';
import { BASE_URL } from '../lib/siteConfig';
import { getBereichByAreaSlug, getBereichUrl } from '../lib/bereichLandingConfig';

const fallbackImage = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600";

// Map URL slugs to database slugs (URL uses legacy slugs, DB uses new consolidated slugs)
const URL_TO_DB_TYPE = {
    'beruflich': 'professionell',
    'privat_hobby': 'privat',
    'kinder_jugend': 'kinder',
    // Also support direct mapping if already using new slugs
    'professionell': 'professionell',
    'privat': 'privat',
    'kinder': 'kinder'
};

const SearchPageView = ({
    courses,
    filteredCoursesPreCategory,
    searchQuery, setSearchQuery,
    searchType, setSearchType,
    searchArea, setSearchArea,
    searchSpecialty, setSearchSpecialty,
    searchFocus, setSearchFocus,
    selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef,
    loading, filteredCourses, setSelectedCourse, setView,
    t, filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo, filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel, filterPro, setFilterPro, filterDirectBooking, setFilterDirectBooking,
    selectedLanguages, setSelectedLanguages, langMenuOpen, setLangMenuOpen, langMenuRef,
    selectedDeliveryTypes, setSelectedDeliveryTypes, deliveryMenuOpen, setDeliveryMenuOpen, deliveryMenuRef,
    savedCourseIds, onToggleSaveCourse,
    user
}) => {

    // Load taxonomy from DB
    const { areas: dbAreas } = useTaxonomy();

    // Helper to get area label from DB taxonomy
    const getAreaLabelFromDB = (areaSlug) => {
        if (!areaSlug) return '';
        // Try exact match first
        let area = dbAreas.find(a => a.slug === areaSlug);
        // Try partial match (e.g. it_digital -> it_digitales)
        if (!area) {
            area = dbAreas.find(a => a.slug.startsWith(areaSlug) || areaSlug.startsWith(a.slug));
        }
        return area?.label_de || areaSlug;
    };

    // --- SEO LOGIC: Zero-Result Rule + Dynamic Meta Tags ---
    useEffect(() => {
        if (loading) return; // Wait for data

        // Build dynamic title and description
        const typeLabel = searchType ? (CATEGORY_TYPES?.[searchType]?.de || searchType) : 'Alle Kurse';

        // Use DB taxonomy for area label
        const areaLabel = searchArea ? getAreaLabelFromDB(searchArea) : '';

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

        const createdTags = [];
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
                createdTags.push(tag);
            }
            tag.content = content;
        });

        // Robots meta tag (Zero-Result Rule)
        let robotsMeta = document.querySelector('meta[name="robots"]');
        let createdRobotsMeta = false;
        if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.name = "robots";
            document.head.appendChild(robotsMeta);
            createdRobotsMeta = true;
        }

        if (filteredCourses.length === 0) {
            // 3.1 Empty Category/Search -> NOINDEX
            robotsMeta.content = "noindex,follow";
        } else {
            // Has Results -> INDEX
            robotsMeta.content = "index,follow";
        }

        // Canonical URL (strip filter params to avoid duplicate content)
        let canonicalTag = document.querySelector('link[rel="canonical"]');
        let createdCanonical = false;
        if (!canonicalTag) {
            canonicalTag = document.createElement('link');
            canonicalTag.rel = 'canonical';
            document.head.appendChild(canonicalTag);
            createdCanonical = true;
        }
        canonicalTag.href = `${BASE_URL}/search`;

        // Clean up stale hreflang tags
        document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(tag => tag.remove());

        // Cleanup: Remove created tags and reset robots on unmount
        return () => {
            createdTags.forEach(tag => tag.remove());
            if (createdCanonical && canonicalTag) canonicalTag.remove();
            if (createdRobotsMeta && robotsMeta) {
                robotsMeta.remove();
            } else if (robotsMeta) {
                robotsMeta.content = "index,follow";
            }
        };
    }, [filteredCourses.length, loading, searchQuery, searchType, searchArea, selectedLocations]);

    // Track impressions for rendered course cards (session-deduplicated, batch insert)
    useEffect(() => {
        if (loading || !filteredCourses.length) return;

        const untracked = filteredCourses.filter(c => !sessionStorage.getItem(`imp_${c.id}`));
        if (untracked.length === 0) return;

        untracked.forEach(c => sessionStorage.setItem(`imp_${c.id}`, '1'));

        const cvSource = sessionStorage.getItem('cv_source') || 'search';
        const rows = untracked.map(c => ({
            course_id: c.id,
            view_type: 'impression',
            viewer_id: user?.id || null,
            source: cvSource
        }));

        supabase.from('course_views').insert(rows).then(({ error }) => {
            if (error) console.warn('Impression tracking failed:', error.message);
        });
    }, [filteredCourses, loading]);

    // Helper: Build label lookup map from all_categories (before filter logic)
    const labelMap = React.useMemo(() => {
        const map = { types: {}, areas: {} };
        courses.forEach(c => {
            if (Array.isArray(c.all_categories)) {
                c.all_categories.forEach(cat => {
                    if (cat.category_type && cat.category_type_label) {
                        map.types[cat.category_type] = cat.category_type_label;
                    }
                    if (cat.category_area && cat.category_area_label) {
                        map.areas[cat.category_area] = cat.category_area_label;
                    }
                });
            }
        });
        return map;
    }, [courses]);

    // --- DYNAMIC FILTER LOGIC (Hide empty categories) ---
    // Use filteredCoursesPreCategory (text search + non-category filters already applied)
    // so that category dropdowns only show options that exist in the current search results.
    // Fallback to published courses if prop not available (e.g. other pages).
    const baseCourses = filteredCoursesPreCategory || courses.filter(c => c.status === 'published');

    // Fixed order for Level 1 (Types): Professionell, Privat, Kinder
    const typeOrder = ['professionell', 'privat', 'kinder'];
    const availableTypes = [...new Set(
        baseCourses.flatMap(c => {
            if (Array.isArray(c.all_categories) && c.all_categories.length > 0) {
                return c.all_categories.map(cat => cat.category_type).filter(Boolean);
            }
            return [];
        })
    )].sort((a, b) => {
        const aIdx = typeOrder.indexOf(a);
        const bIdx = typeOrder.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.localeCompare(b, 'de');
    });

    // Map URL slug to DB slug for filtering
    const dbSearchType = searchType ? (URL_TO_DB_TYPE[searchType] || searchType) : '';

    // Level 2-4: Alphabetically sorted by label
    const availableAreas = [...new Set(
        baseCourses.flatMap(c => {
            const areas = [];
            if (Array.isArray(c.all_categories) && c.all_categories.length > 0) {
                c.all_categories.forEach(cat => {
                    if ((!dbSearchType || cat.category_type === dbSearchType) && cat.category_area) {
                        areas.push(cat.category_area);
                    }
                });
            }
            return areas;
        })
    )].sort((a, b) => {
        // Sort by label (German alphabetical)
        const labelA = labelMap.areas[a] || a;
        const labelB = labelMap.areas[b] || b;
        return labelA.localeCompare(labelB, 'de');
    });

    const availableSpecialties = [...new Set(
        baseCourses.flatMap(c => {
            const specialties = [];
            if (Array.isArray(c.all_categories) && c.all_categories.length > 0) {
                c.all_categories.forEach(cat => {
                    const typeMatch = !dbSearchType || cat.category_type === dbSearchType;
                    const areaMatch = !searchArea || cat.category_area === searchArea;
                    if (typeMatch && areaMatch && (cat.category_specialty || cat.category_specialty_label)) {
                        specialties.push(cat.category_specialty_label || cat.category_specialty);
                    }
                });
            }
            return specialties;
        })
    )].sort((a, b) => a.localeCompare(b, 'de'));

    const availableFocuses = [...new Set(
        baseCourses.flatMap(c => {
            const focuses = [];
            if (Array.isArray(c.all_categories) && c.all_categories.length > 0) {
                c.all_categories.forEach(cat => {
                    const typeMatch = !dbSearchType || cat.category_type === dbSearchType;
                    const areaMatch = !searchArea || cat.category_area === searchArea;
                    const specMatch = !searchSpecialty ||
                        cat.category_specialty_label === searchSpecialty ||
                        cat.category_specialty === searchSpecialty;
                    if (typeMatch && areaMatch && specMatch && (cat.category_focus || cat.category_focus_label)) {
                        focuses.push(cat.category_focus_label || cat.category_focus);
                    }
                });
            }
            return focuses;
        })
    )].sort((a, b) => a.localeCompare(b, 'de'));

    const getLabel = (key, scope) => {
        if (!key) return '';

        if (scope === 'type') {
            // First check labelMap from all_categories (new schema)
            if (labelMap.types[key]) return labelMap.types[key];
            // Fallback to CATEGORY_TYPES constant
            return CATEGORY_TYPES?.[key]?.de || key;
        }
        if (scope === 'age') return AGE_GROUPS?.[key]?.de || key;

        if (scope === 'area') {
            // First check labelMap from all_categories (new schema)
            if (labelMap.areas[key]) return labelMap.areas[key];

            // Use DB taxonomy
            return getAreaLabelFromDB(key);
        }

        // specialties und focuses sind bereits Labels aus DB
        if (scope === 'specialty') return key;
        if (scope === 'focus') return key;

        return key;
    };


    // --- HELPER: Consistent Price Labeling (match DetailView logic) ---
    const getPriceLabel = (c) => {
        if (!c) return '';
        const type = c.booking_type || 'platform';
        const price = Number(c.price) || 0;

        if (type === 'lead' && price === 0) return 'Preis auf Anfrage';
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
            // is_prio: Kurs hat Prio-Status vom Nutzer erhalten (begrenzt durch Plan)
            // is_pro: Legacy/Admin-Flag für Pro-Status
            const planF = c.plan_factor || (c.is_prio ? 1.2 : (c.is_pro ? 1.2 : 1.0));

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

    // Get segment config for banner
    const getActiveSegmentConfig = () => {
        if (!searchType) return null;
        return SEGMENT_CONFIG[searchType] || null;
    };
    const activeSegmentConfig = getActiveSegmentConfig();

    return (
        <div className="min-h-screen bg-beige">
            {/* SEGMENT HERO - shows active segment with background image, title and subtitle */}
            {activeSegmentConfig && (
                <div className="relative overflow-hidden">
                    {/* Background Image - very subtle */}
                    {activeSegmentConfig.heroBg && (
                        <div
                            className="absolute inset-0 bg-cover bg-center opacity-[0.06]"
                            style={{ backgroundImage: `url("${activeSegmentConfig.heroBg}")` }}
                        />
                    )}
                    {/* Colored overlay */}
                    <div className={`absolute inset-0 ${activeSegmentConfig.bgLight} opacity-80`} />

                    {/* Content */}
                    <div className="relative py-8 md:py-10">
                        <div className="max-w-7xl mx-auto px-4">
                            {/* Breadcrumb row */}
                            <div className="flex items-center mb-4">
                                <div className="flex items-center text-sm">
                                    <activeSegmentConfig.icon className={`w-4 h-4 mr-2 ${activeSegmentConfig.text}`} />
                                    <span className={`font-medium ${activeSegmentConfig.text}`}>{getLabel(searchType, 'type')}</span>
                                    {searchArea && (
                                        <>
                                            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                                            <span className="text-gray-600">{getLabel(searchArea, 'area')}</span>
                                        </>
                                    )}
                                    {searchSpecialty && (
                                        <>
                                            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                                            <span className="text-gray-600">{searchSpecialty}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Hero text */}
                            <div className="flex items-center gap-6">
                                <div className={`hidden md:flex items-center justify-center w-16 h-16 rounded-2xl ${activeSegmentConfig.bgSolid} shadow-lg`}>
                                    <activeSegmentConfig.icon className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h1 className={`text-2xl md:text-3xl font-bold font-heading ${activeSegmentConfig.textDark}`}>
                                        {activeSegmentConfig.heroTitle?.de || getLabel(searchType, 'type')}
                                    </h1>
                                    <p className="text-gray-600 mt-1">
                                        {activeSegmentConfig.heroSubtitle?.de || ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-white border-b pt-6 pb-4 sticky top-20 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 space-y-4">
                    {/* Search row */}
                    <div className="flex flex-col md:flex-row gap-3 items-stretch">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input type="text" placeholder={t.search_refine} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-[42px] pl-10 pr-4 bg-beige border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                        </div>
                        <div className="flex items-center gap-2">
                            <LocationDropdown selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} />
                            <LanguageDropdown selectedLanguages={selectedLanguages} setSelectedLanguages={setSelectedLanguages} langMenuOpen={langMenuOpen} setLangMenuOpen={setLangMenuOpen} langMenuRef={langMenuRef} t={t} />
                            <DeliveryTypeFilter selectedDeliveryTypes={selectedDeliveryTypes} setSelectedDeliveryTypes={setSelectedDeliveryTypes} deliveryMenuOpen={deliveryMenuOpen} setDeliveryMenuOpen={setDeliveryMenuOpen} deliveryMenuRef={deliveryMenuRef} t={t} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 -mt-2 ml-3">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe mit AND oder OR'}</p>

                    {/* SEGMENT PICKER - shown when no segment is selected */}
                    {!searchType && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 mr-1">Kategorie wählen:</span>
                            {[
                                { key: 'beruflich', dbKey: 'professionell' },
                                { key: 'privat_hobby', dbKey: 'privat' },
                                { key: 'kinder_jugend', dbKey: 'kinder' }
                            ].filter(({ dbKey }) => availableTypes.includes(dbKey)).map(({ key, dbKey }) => {
                                const cfg = SEGMENT_CONFIG[key] || SEGMENT_CONFIG[dbKey];
                                const Icon = cfg?.icon || Briefcase;
                                return (
                                    <button key={key} onClick={() => { setSearchType(key); setSearchArea(""); setSearchSpecialty(""); setSearchFocus(""); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all hover:shadow-sm ${cfg?.bgLight || 'bg-gray-50'} ${cfg?.borderLight || 'border-gray-200'} ${cfg?.text || 'text-gray-600'} hover:opacity-80`}>
                                        <Icon className="w-4 h-4" />
                                        {cfg?.label?.de || key}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* TAXONOMY FILTERS (Level 2-4) - Level 1 is selected via Navbar or segment picker */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select value={searchArea} onChange={(e) => { setSearchArea(e.target.value); setSearchSpecialty(""); setSearchFocus(""); }} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${searchType ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} ${!searchArea ? 'text-gray-400' : 'text-gray-900'}`} disabled={!searchType}>
                            <option value="" className="text-gray-400">— {t.lbl_area || 'Themenwelt'} —</option>
                            {availableAreas.map(area => (<option key={area} value={area} className="text-gray-900">{getLabel(area, 'area')}</option>))}
                        </select>
                        <select value={searchSpecialty} onChange={(e) => { setSearchSpecialty(e.target.value); setSearchFocus(""); }} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${searchArea ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} ${!searchSpecialty ? 'text-gray-400' : 'text-gray-900'}`} disabled={!searchArea}>
                            <option value="" className="text-gray-400">— {t.lbl_specialty || 'Fachgebiet'} —</option>
                            {availableSpecialties.map(spec => (<option key={spec} value={spec} className="text-gray-900">{spec}</option>))}
                        </select>
                        <select value={searchFocus || ""} onChange={(e) => setSearchFocus(e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${searchSpecialty && availableFocuses.length > 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} ${!searchFocus ? 'text-gray-400' : 'text-gray-900'}`} disabled={!searchSpecialty || availableFocuses.length === 0}>
                            <option value="" className="text-gray-400">— {t.lbl_focus || 'Fokus'} —</option>
                            {availableFocuses.map(f => (<option key={f} value={f} className="text-gray-900">{f}</option>))}
                        </select>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2 items-center border-t pt-3 border-gray-100">
                        <label className="flex items-center bg-white px-3 py-1.5 rounded-lg border border-gray-200 cursor-pointer">
                            <span className="text-xs text-gray-400 mr-2 whitespace-nowrap">Von</span>
                            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600 cursor-pointer" />
                        </label>
                        <label className="flex items-center bg-white px-3 py-1.5 rounded-lg border border-gray-200 cursor-pointer">
                            <span className="text-xs text-gray-400 mr-2 whitespace-nowrap">Bis</span>
                            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600 cursor-pointer" />
                        </label>
                        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200"><span className="text-sm text-gray-500">{t.lbl_max_price}</span><input type="number" placeholder="Any" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-16 bg-transparent text-sm outline-none text-gray-600" /></div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none text-gray-600"><option value="All">{t.opt_all_levels}</option>{Object.keys(COURSE_LEVELS).map(k => <option key={k} value={k}>{COURSE_LEVELS[k].de}</option>)}</select>
                         <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterPro ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`} title={t.tooltip_pro_verified_long || t.tooltip_pro_verified}>
                            <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span className={`text-sm font-medium ${filterPro ? 'text-blue-700' : 'text-gray-600'}`}>{t.lbl_professional_filter}</span>
                            <Shield className="w-3 h-3 text-blue-500" />
                            <Info className="w-3 h-3 text-gray-400 hover:text-blue-500 transition-colors" />
                         </label>
                         <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterDirectBooking ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`} title={t.tooltip_direct_booking_long || t.tooltip_direct_booking}>
                            <input type="checkbox" checked={filterDirectBooking} onChange={(e) => setFilterDirectBooking(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span className={`text-sm font-medium ${filterDirectBooking ? 'text-green-700' : 'text-gray-600'}`}>{t.lbl_direct_booking_filter}</span>
                            <CreditCard className="w-3 h-3 text-green-500" />
                            <Info className="w-3 h-3 text-gray-400 hover:text-green-500 transition-colors" />
                         </label>
                    </div>
                </div>
                 {(selectedLocations.length > 0 || selectedLanguages.length > 0) && (
                    <div className="max-w-7xl mx-auto px-4 pt-2 flex gap-2 flex-wrap">
                        {selectedLanguages.map((lang, i) => (<span key={`lang-${i}`} onClick={() => setSelectedLanguages(selectedLanguages.filter(l => l !== lang))} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-purple-200 flex items-center"><Globe className="w-3 h-3 mr-1"/> {lang} <X className="w-3 h-3 ml-1 opacity-50" /></span>))}
                        {selectedLocations.map((loc, i) => (<span key={i} onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">{loc} <X className="w-3 h-3 ml-1 opacity-50" /></span>))}
                    </div>
                 )}
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                 {loading ? <div className="text-center py-20"><Loader className="animate-spin w-10 h-10 text-primary mx-auto" /></div> : filteredCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {sortedCourses.flatMap((course, courseIndex) => {
                      const bereichConfig = searchArea ? getBereichByAreaSlug(searchArea) : null;
                      const showRatgeberHere = bereichConfig && courseIndex === 6 && sortedCourses.length > 3;
                      const segTheme = bereichConfig ? (SEGMENT_CONFIG[bereichConfig.typeKey] || SEGMENT_CONFIG.beruflich) : null;

                      const items = [];

                      if (showRatgeberHere) {
                        items.push(
                          <a
                            key="ratgeber-card"
                            href={getBereichUrl(bereichConfig)}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey) return;
                              e.preventDefault();
                              window.history.pushState({ view: 'bereich-landing' }, '', getBereichUrl(bereichConfig));
                            }}
                            className={`${segTheme.bgLight} rounded-xl border-2 ${segTheme.borderLight} overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-center items-center text-center p-8`}
                            style={{textDecoration: 'none', color: 'inherit'}}
                          >
                            <div className={`w-14 h-14 rounded-full ${segTheme.bgSolid} text-white flex items-center justify-center mb-4`}>
                              <Compass className="w-7 h-7" />
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${segTheme.text} mb-2`}>Themenwelt</span>
                            <h3 className="font-bold text-dark text-base mb-2 font-heading">Noch unsicher?</h3>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">Unser Ratgeber hilft dir bei der Orientierung in diesem Bereich.</p>
                            <span className={`inline-flex items-center gap-1 text-sm font-bold ${segTheme.text} group-hover:underline`}>
                              Zum Ratgeber <ChevronRight className="w-4 h-4" />
                            </span>
                          </a>
                        );
                      }

                      const slugify = (input) => (input || '').toString().trim().toLowerCase()
                          .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
                          .replace(/&/g, ' und ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                      const coursePath = `/courses/${slugify(course.primary_category || course.category_area || 'kurs')}/${slugify(course.canton || 'schweiz')}/${course.id}-${slugify(course.title || 'detail')}`;

                      items.push(
                      <a key={course.id} href={coursePath} onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) return;
                          e.preventDefault();
                          window.history.pushState({ view: 'detail', courseId: course.id }, '', coursePath);
                      }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group" style={{textDecoration: 'none', color: 'inherit'}}>
                        <div className="relative aspect-video overflow-hidden">
                            <img
                                src={course.image_url || fallbackImage}
                                alt={`${course.title} - Kurs in ${course.canton}`}
                                loading="lazy"
                                decoding="async"
                                width="600"
                                height="338"
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                                {/* Draft badge - only visible to course owner */}
                                {user?.id && String(course.user_id) === String(user.id) && (course.status === 'draft' || course.status === 'paused') && (
                                    <div className="bg-yellow-500/95 text-white px-2 py-1 rounded text-xs font-bold shadow-sm flex items-center"><EyeOff className="w-3 h-3 mr-1" /> Entwurf</div>
                                )}
                                {course.instructor_verified && <div className="bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-bold shadow-sm flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Pro</div>}
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

                            {/* Kursformat-Badges */}
                            {(() => {
                                const types = course.delivery_types || (course.delivery_type ? [course.delivery_type] : []);
                                if (types.length === 0) return null;
                                return (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {types.map(type => (
                                            <span key={type} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                {DELIVERY_TYPES[type]?.de?.split(' ')[0] || type}
                                            </span>
                                        ))}
                                    </div>
                                );
                            })()}

                            <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100">
                                {/* Anbieter-Badge */}
                                <div className="min-w-0 flex-1">
                                    <div className="inline-flex items-center bg-beige px-2 py-1 rounded text-xs text-gray-500 max-w-full">
                                        <User className="w-3 h-3 text-gray-500 mr-1 shrink-0" />
                                        <span className="truncate" title={course.instructor_name}>{course.instructor_name}</span>
                                    </div>
                                </div>

                                {/* Preis */}
                                <span className="font-heading font-bold text-primary text-xs leading-tight text-right whitespace-nowrap shrink-0">
                                    {getPriceLabel(course)}
                                </span>
                            </div>
                        </div>
                      </a>
                      );

                      return items;
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