import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, ChevronRight, User, X, Shield, MapPin, CheckCircle, Loader, Bell, ArrowDown, Bookmark, BookmarkCheck, CreditCard, Info, EyeOff, Briefcase, Palette, Smile, BookOpen, Compass, SearchX, AlertTriangle, RotateCcw } from 'lucide-react';
import { LocationDropdown, LanguageDropdown, DeliveryTypeFilter, SaeulenFilter } from './Filters';
import { Globe } from 'lucide-react';
import { CATEGORY_TYPES, AGE_GROUPS, COURSE_LEVELS, DELIVERY_TYPES, SEGMENT_CONFIG, TYPE_DISPLAY_LABELS, BERUF_SAEULEN } from '../lib/constants';
import { formatPriceCHF, getPriceLabel } from '../lib/formatPrice';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { supabase } from '../lib/supabase';
import { BASE_URL, buildCoursePath } from '../lib/siteConfig';
import { getBereichByAreaSlug, getBereichUrl } from '../lib/bereichLandingConfig';
import { SEARCH_STRINGS } from '../lib/searchStrings';
import { getNormalizedDeliveryTypes } from '../lib/courseMetadata';
import { trackSearch } from '../lib/analytics';

import { DEFAULT_COURSE_IMAGE } from '../lib/imageUtils';
const fallbackImage = DEFAULT_COURSE_IMAGE;

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
    user,
    selectedSaule, setSelectedSaule,
    fetchError, onRetry,
    setSelectedCatPath
}) => {

    // Ref for scroll-to-results behavior
    const resultsRef = useRef(null);
    // Track whether initial mount has happened (skip scroll on first render)
    const hasMountedRef = useRef(false);
    // Price validation error state
    const [priceError, setPriceError] = React.useState(false);

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

    // GA4: Track search when results are loaded
    useEffect(() => {
        if (loading) return;
        trackSearch(searchQuery, filteredCourses.length);
    }, [filteredCourses.length, loading, searchQuery]);

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
            // Use consistent display labels matching header/navigation
            if (TYPE_DISPLAY_LABELS[key]) return TYPE_DISPLAY_LABELS[key];
            // Fallback to labelMap or CATEGORY_TYPES constant
            if (labelMap.types[key]) return labelMap.types[key];
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


    // getPriceLabel imported from '../lib/formatPrice'

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

    const resetFilters = useCallback(() => {
        setSearchType(""); setSearchArea(""); setSearchSpecialty(""); setSearchFocus("");
        setSelectedLocations([]); setSearchQuery(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterPriceMax(""); setFilterLevel("All"); setFilterPro(false); setFilterDirectBooking(false);
        if (setSelectedSaule) setSelectedSaule("");
        if (setSelectedLanguages) setSelectedLanguages([]);
        if (setSelectedDeliveryTypes) setSelectedDeliveryTypes([]);
        if (setSelectedCatPath) setSelectedCatPath([]);
    }, [setSearchType, setSearchArea, setSearchSpecialty, setSearchFocus, setSelectedLocations, setSearchQuery, setFilterDateFrom, setFilterDateTo, setFilterPriceMax, setFilterLevel, setFilterPro, setFilterDirectBooking, setSelectedSaule, setSelectedLanguages, setSelectedDeliveryTypes, setSelectedCatPath]);

    const clearSearchText = useCallback(() => {
        setSearchQuery("");
    }, [setSearchQuery]);

    // --- EMPTY STATE DETECTION ---
    // Determine if the catalog is genuinely empty for the selected type/segment
    // vs. just the current filters producing 0 results
    const publishedCourses = useMemo(() => courses.filter(c => c.status === 'published'), [courses]);

    const catalogHasCoursesInSlice = useMemo(() => {
        if (!dbSearchType) return publishedCourses.length > 0;
        return publishedCourses.some(c =>
            Array.isArray(c.all_categories) &&
            c.all_categories.some(cat => cat.category_type === dbSearchType)
        );
    }, [publishedCourses, dbSearchType]);

    // true = catalog empty for this type, false = filters are just too restrictive
    const isCatalogEmpty = !catalogHasCoursesInSlice;

    // --- RESULTS COUNTER ---
    const resultsCountText = useMemo(() => {
        if (loading) return SEARCH_STRINGS.results_loading;
        const n = filteredCourses.length;
        if (searchQuery.trim()) return SEARCH_STRINGS.results_for(n, searchQuery.trim());
        if (n === 0) return SEARCH_STRINGS.results_zero;
        if (n === 1) return SEARCH_STRINGS.results_one;
        return SEARCH_STRINGS.results_many(n);
    }, [loading, filteredCourses.length, searchQuery]);

    // --- SCROLL TO RESULTS on filter/search change ---
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }
        if (loading) return;
        // Scroll results area into view after filter change
        if (resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [filteredCourses, loading]);

    // --- RANKING LOGIC (v4.1) ---
    // Formula: Score = Plan * Booking + Random(0..0.15)
    // Prio-Kurse immer vor Standard-Kursen, innerhalb jeder Stufe echt zufällig
    // Bei aktivem Datumsfilter: Kurse MIT Datum zuerst, dann Kurse OHNE Datum
    // WICHTIG: Scores werden einmalig pro Kurs berechnet (nicht bei jedem Vergleich),
    // damit sort() konsistente Vergleiche bekommt.
    const sortedCourses = useMemo(() => {
        const hasDate = (c) => {
            if (c.start_date) return true;
            if (Array.isArray(c.course_events) && c.course_events.some(ev => ev.start_date)) return true;
            return false;
        };

        // Pre-compute one stable random score per course
        const scoreMap = new Map();
        for (const c of filteredCourses) {
            const planF = c.plan_factor || (c.is_prio ? 1.2 : (c.is_pro ? 1.2 : 1.0));
            const bookF = c.booking_factor || 1.0;
            const randomJitter = Math.random() * 0.15;
            scoreMap.set(c.id, planF * bookF + randomJitter);
        }

        return [...filteredCourses].sort((a, b) => {
            if (filterDateFrom || filterDateTo) {
                const aHasDate = hasDate(a);
                const bHasDate = hasDate(b);
                if (aHasDate && !bHasDate) return -1;
                if (!aHasDate && bHasDate) return 1;
            }
            return scoreMap.get(b.id) - scoreMap.get(a.id);
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
            <div className="bg-white border-b pt-3 pb-2 sticky top-20 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 space-y-2">
                    {/* Search row */}
                    <div className="flex flex-col md:flex-row gap-2 items-stretch">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input type="text" placeholder={t.search_refine} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-[36px] pl-9 pr-4 bg-beige border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                        </div>
                        <div className="flex items-center gap-2">
                            <LocationDropdown selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} />
                            <LanguageDropdown selectedLanguages={selectedLanguages} setSelectedLanguages={setSelectedLanguages} langMenuOpen={langMenuOpen} setLangMenuOpen={setLangMenuOpen} langMenuRef={langMenuRef} t={t} />
                            <DeliveryTypeFilter selectedDeliveryTypes={selectedDeliveryTypes} setSelectedDeliveryTypes={setSelectedDeliveryTypes} deliveryMenuOpen={deliveryMenuOpen} setDeliveryMenuOpen={setDeliveryMenuOpen} deliveryMenuRef={deliveryMenuRef} t={t} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 -mt-1 ml-3">{t.search_hint_boolean || 'Tipp: Kombiniere Begriffe mit AND oder OR'}</p>

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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <select value={searchArea} onChange={(e) => { setSearchArea(e.target.value); setSearchSpecialty(""); setSearchFocus(""); }} className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${searchType ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} ${!searchArea ? 'text-gray-400' : 'text-gray-900'}`} disabled={!searchType}>
                            <option value="" className="text-gray-400">— {t.lbl_area || 'Themenwelt'} —</option>
                            {availableAreas.map(area => (<option key={area} value={area} className="text-gray-900">{getLabel(area, 'area')}</option>))}
                        </select>
                        <select value={searchSpecialty} onChange={(e) => { setSearchSpecialty(e.target.value); setSearchFocus(""); }} className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${searchArea ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} ${!searchSpecialty ? 'text-gray-400' : 'text-gray-900'}`} disabled={!searchArea}>
                            <option value="" className="text-gray-400">— {t.lbl_specialty || 'Fachgebiet'} —</option>
                            {availableSpecialties.map(spec => (<option key={spec} value={spec} className="text-gray-900">{spec}</option>))}
                        </select>
                        <select value={searchFocus || ""} onChange={(e) => setSearchFocus(e.target.value)} className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${searchSpecialty && availableFocuses.length > 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'} ${!searchFocus ? 'text-gray-400' : 'text-gray-900'}`} disabled={!searchSpecialty || availableFocuses.length === 0}>
                            <option value="" className="text-gray-400">— {t.lbl_focus || 'Fokus'} —</option>
                            {availableFocuses.map(f => (<option key={f} value={f} className="text-gray-900">{f}</option>))}
                        </select>
                    </div>

                    {/* 3-SÄULEN FILTER — nur für berufliche Kurse */}
                    {(searchType === 'beruflich' || searchType === 'professionell') && (
                        <SaeulenFilter selectedSaule={selectedSaule} setSelectedSaule={setSelectedSaule} />
                    )}

                    <div className="flex gap-3 overflow-x-auto pb-1 items-center border-t pt-2 border-gray-100">
                        <label className="flex items-center bg-white px-2.5 py-1 rounded-lg border border-gray-200 cursor-pointer">
                            <span className="text-xs text-gray-400 mr-1.5 whitespace-nowrap">Von</span>
                            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="bg-transparent text-xs outline-none text-gray-600 cursor-pointer" />
                        </label>
                        <label className="flex items-center bg-white px-2.5 py-1 rounded-lg border border-gray-200 cursor-pointer">
                            <span className="text-xs text-gray-400 mr-1.5 whitespace-nowrap">Bis</span>
                            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="bg-transparent text-xs outline-none text-gray-600 cursor-pointer" />
                        </label>
                        <div className={`flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border ${priceError ? 'border-red-400' : 'border-gray-200'}`}>
                            <span className="text-xs text-gray-500">{t.lbl_max_price}</span>
                            <input type="number" min="0" step="1" placeholder="Beliebig" value={filterPriceMax}
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
                                className={`w-16 bg-transparent text-xs outline-none ${priceError ? 'text-red-600' : 'text-gray-600'}`} />
                            {priceError && <span className="text-[10px] text-red-500 whitespace-nowrap">Nur positive Zahlen</span>}
                        </div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs outline-none text-gray-600"><option value="All">{t.opt_all_levels}</option>{Object.keys(COURSE_LEVELS).map(k => <option key={k} value={k}>{COURSE_LEVELS[k].de}</option>)}</select>
                         <label className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition select-none ${filterPro ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`} title={t.tooltip_pro_verified_long || t.tooltip_pro_verified}>
                            <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                            <span className={`text-xs font-medium ${filterPro ? 'text-blue-700' : 'text-gray-600'}`}>{t.lbl_professional_filter}</span>
                            <Shield className="w-3 h-3 text-blue-500" />
                            <Info className="w-3 h-3 text-gray-400 hover:text-blue-500 transition-colors" />
                         </label>
                         <label className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition select-none ${filterDirectBooking ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`} title={t.tooltip_direct_booking_long || t.tooltip_direct_booking}>
                            <input type="checkbox" checked={filterDirectBooking} onChange={(e) => setFilterDirectBooking(e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                            <span className={`text-xs font-medium ${filterDirectBooking ? 'text-green-700' : 'text-gray-600'}`}>{t.lbl_direct_booking_filter}</span>
                            <CreditCard className="w-3 h-3 text-green-500" />
                            <Info className="w-3 h-3 text-gray-400 hover:text-green-500 transition-colors" />
                         </label>
                    </div>
                </div>
                 {/* --- ACTIVE FILTER CHIPS --- */}
                 {(selectedLanguages.length > 0 || selectedLocations.length > 0 ||
                   selectedDeliveryTypes.length > 0 || (filterPriceMax && filterPriceMax !== '') ||
                   (filterLevel && filterLevel !== 'All') || filterDateFrom || filterDateTo ||
                   filterPro || filterDirectBooking || selectedSaule ||
                   searchType || searchArea || searchSpecialty || searchFocus) && (
                    <div className="max-w-7xl mx-auto px-4 pt-2 flex gap-2 flex-wrap" data-testid="filter-chips">
                        {selectedLanguages.map((lang, i) => (
                            <span key={`lang-${i}`} onClick={() => setSelectedLanguages(selectedLanguages.filter(l => l !== lang))} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-purple-200 flex items-center">
                                <Globe className="w-3 h-3 mr-1"/> {lang} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        ))}
                        {selectedLocations.map((loc, i) => (
                            <span key={`loc-${i}`} onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">
                                <MapPin className="w-3 h-3 mr-1"/> {loc} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        ))}
                        {selectedDeliveryTypes.map((dt, i) => (
                            <span key={`dt-${i}`} onClick={() => setSelectedDeliveryTypes(selectedDeliveryTypes.filter(d => d !== dt))} className="text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-cyan-200 flex items-center">
                                {DELIVERY_TYPES[dt]?.de || dt} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        ))}
                        {filterPriceMax && filterPriceMax !== '' && (
                            <span onClick={() => setFilterPriceMax('')} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-amber-200 flex items-center">
                                Max CHF {formatPriceCHF(Number(filterPriceMax))} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {filterLevel && filterLevel !== 'All' && (
                            <span onClick={() => setFilterLevel('All')} className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-indigo-200 flex items-center">
                                {COURSE_LEVELS[filterLevel]?.de || filterLevel} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {filterDateFrom && (
                            <span onClick={() => setFilterDateFrom('')} className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-teal-200 flex items-center">
                                Ab {filterDateFrom} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {filterDateTo && (
                            <span onClick={() => setFilterDateTo('')} className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-teal-200 flex items-center">
                                Bis {filterDateTo} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {filterPro && (
                            <span onClick={() => setFilterPro(false)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-100 flex items-center">
                                <Shield className="w-3 h-3 mr-1"/> {t.lbl_professional_filter} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {filterDirectBooking && (
                            <span onClick={() => setFilterDirectBooking(false)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-green-100 flex items-center">
                                <CreditCard className="w-3 h-3 mr-1"/> {t.lbl_direct_booking_filter} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {selectedSaule && (
                            <span onClick={() => setSelectedSaule('')} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">
                                {BERUF_SAEULEN[selectedSaule]?.shortDe || selectedSaule} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {searchType && (
                            <span onClick={() => { setSearchType(''); setSearchArea(''); setSearchSpecialty(''); setSearchFocus(''); }} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-orange-200 flex items-center">
                                {TYPE_DISPLAY_LABELS[searchType] || CATEGORY_TYPES[searchType]?.de || searchType} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {searchArea && (
                            <span onClick={() => { setSearchArea(''); setSearchSpecialty(''); setSearchFocus(''); }} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-orange-200 flex items-center">
                                {dbAreas.find(a => a.slug === searchArea)?.label_de || searchArea} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {searchSpecialty && (
                            <span onClick={() => { setSearchSpecialty(''); setSearchFocus(''); }} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-orange-200 flex items-center">
                                {searchSpecialty} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                        {searchFocus && (
                            <span onClick={() => setSearchFocus('')} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-orange-200 flex items-center">
                                {searchFocus} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        )}
                    </div>
                 )}
            </div>

            <main ref={resultsRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ scrollMarginTop: '180px' }}>
                {/* --- RESULTS HEADER (counter + aria-live) --- */}
                <div
                    className="mb-6"
                    aria-live="polite"
                    aria-atomic="true"
                    role="status"
                    data-testid="results-counter"
                >
                    <p className="text-sm text-gray-500 font-medium">
                        {resultsCountText}
                    </p>
                </div>

                {/* --- STATE D: LOADING --- */}
                {loading && (
                    <div className="text-center py-20" data-testid="loading-state">
                        <Loader className="animate-spin w-10 h-10 text-primary mx-auto mb-4" />
                        <p className="text-sm text-gray-500">{SEARCH_STRINGS.loading_text}</p>
                    </div>
                )}

                {/* --- STATE C: FETCH ERROR --- */}
                {!loading && fetchError && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-red-200 px-6" data-testid="error-state">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 font-heading">
                            {SEARCH_STRINGS.error_title}
                        </h3>
                        <p className="text-gray-600 max-w-md mx-auto mb-6">
                            {SEARCH_STRINGS.error_text}
                        </p>
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="inline-flex items-center gap-2 text-primary font-bold hover:text-orange-700 transition border border-orange-200 px-4 py-2 rounded-lg bg-orange-50 hover:bg-orange-100"
                            >
                                <RotateCcw className="w-4 h-4" />
                                {SEARCH_STRINGS.btn_retry}
                            </button>
                        )}
                    </div>
                )}

                {/* --- RESULTS GRID --- */}
                {!loading && !fetchError && filteredCourses.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8" data-testid="course-grid">
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
                            className={`relative rounded-xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-center items-center text-center p-8 bg-gradient-to-br ${segTheme.gradient}`}
                            style={{textDecoration: 'none', color: 'inherit'}}
                          >
                            {/* Decorative circles */}
                            <div className="absolute top-[-20px] right-[-20px] w-28 h-28 rounded-full bg-white/10" />
                            <div className="absolute bottom-[-30px] left-[-15px] w-36 h-36 rounded-full bg-white/5" />
                            <div className="absolute top-1/2 left-[-10px] w-16 h-16 rounded-full bg-white/10" />

                            <div className="relative z-10 flex flex-col items-center">
                              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Compass className="w-6 h-6 text-white" />
                              </div>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-2">Themenwelt</span>
                              <h3 className="font-bold text-white text-base mb-2 font-heading">{bereichConfig.typeKey === 'beruflich' ? 'Welche Ausbildung passt zu dir?' : 'Welcher Kurs passt zu dir?'}</h3>
                              <p className="text-sm text-white/80 mb-5 leading-relaxed">Unser Ratgeber hilft dir, den passenden Kurs zu finden.</p>
                              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-white/20 backdrop-blur-sm rounded-full px-5 py-2 group-hover:bg-white/30 transition-colors duration-300">
                                Ratgeber entdecken <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </a>
                        );
                      }

                      const slugify = (input) => (input || '').toString().trim().toLowerCase()
                          .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
                          .replace(/&/g, ' und ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                      const coursePath = buildCoursePath(course) || slugify(course.title || 'detail');

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
                                {user?.id && String(course.user_id) === String(user.id) && course.status === 'draft' && (
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
                                const types = getNormalizedDeliveryTypes(course);
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
                )}

                {/* --- STATE A: NO MATCHES (filters too restrictive) --- */}
                {!loading && !fetchError && filteredCourses.length === 0 && !isCatalogEmpty && (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 px-6" data-testid="empty-no-matches">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <SearchX className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 font-heading">
                        {SEARCH_STRINGS.no_matches_title}
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-6">
                        {searchQuery.trim()
                            ? SEARCH_STRINGS.no_matches_for(searchQuery.trim())
                            : SEARCH_STRINGS.no_matches_text}
                    </p>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        {searchQuery.trim() && (
                            <button
                                onClick={clearSearchText}
                                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition border border-gray-200 px-4 py-2 rounded-lg bg-gray-50 hover:bg-gray-100"
                                data-testid="btn-clear-search"
                            >
                                <X className="w-4 h-4" />
                                {SEARCH_STRINGS.btn_clear_search}
                            </button>
                        )}
                        <button
                            onClick={resetFilters}
                            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-orange-700 transition border border-orange-200 px-4 py-2 rounded-lg bg-orange-50 hover:bg-orange-100"
                            data-testid="btn-reset-filters"
                        >
                            <RotateCcw className="w-4 h-4" />
                            {SEARCH_STRINGS.btn_reset_filters}
                        </button>
                    </div>
                  </div>
                )}

                {/* --- STATE B: CATALOG GENUINELY EMPTY --- */}
                {!loading && !fetchError && filteredCourses.length === 0 && isCatalogEmpty && (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 px-6" data-testid="empty-catalog">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 font-heading">
                        {SEARCH_STRINGS.catalog_empty_title}
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-6 whitespace-pre-line">
                        {SEARCH_STRINGS.catalog_empty_text}
                    </p>
                    <button
                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        className="text-primary font-bold hover:text-orange-700 transition flex items-center justify-center mx-auto gap-2 border border-orange-200 px-4 py-2 rounded-lg bg-orange-50 hover:bg-orange-100"
                    >
                        {SEARCH_STRINGS.btn_scroll_newsletter} <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
            </main>
        </div>
    );
};

export default SearchPageView;
