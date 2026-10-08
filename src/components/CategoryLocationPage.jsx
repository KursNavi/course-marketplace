import React, { useEffect } from 'react';
import { MapPin, TrendingUp, Clock, Award, ChevronRight, Bookmark, BookmarkCheck } from 'lucide-react';
import { formatPriceCHF, getPriceLabel } from '../lib/formatPrice';
import { BASE_URL, buildCoursePath } from '../lib/siteConfig';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { DEFAULT_COURSE_IMAGE } from '../lib/imageUtils';
import {
    buildCategoryLocationSeo,
    filterCoursesForCategoryLocation,
    getCourseTopicEntries,
    MIN_INDEXABLE_CATEGORY_LOCATION_COURSES,
    resolveSwissCanton,
} from '../lib/categoryLocation';

const BOOKABLE_BOOKING_TYPES = new Set(['platform', 'platform_flex']);

/**
 * Programmatic SEO Landing Page for Topic/Location combinations
 * Example URLs: /courses/yoga/zurich, /courses/business-mgmt/bern
 *
 * Generates unique content to avoid "Doorway Page" penalties:
 * - Statistics (course count, avg price, etc.)
 * - Location-specific description
 * - Course listing for this category/location
 */
export default function CategoryLocationPage({
    topicSlug,
    locationSlug,
    courses,
    setSelectedCourse,
    setView,
    savedCourseIds,
    onToggleSaveCourse,
    t
}) {
    // Load taxonomy from DB
    const { areas: dbAreas } = useTaxonomy();

    // Scroll to top when category/location changes
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [topicSlug, locationSlug]);

    const resolvedLocation = resolveSwissCanton(locationSlug);
    const location = resolvedLocation?.label || (locationSlug || '').replace(/-/g, ' ');
    const filteredCourses = filterCoursesForCategoryLocation(courses, topicSlug, locationSlug);

    // Calculate unique statistics (for pSEO)
    const stats = {
        totalCourses: filteredCourses.length,
        avgPrice: filteredCourses.length > 0
            ? Math.round(filteredCourses.reduce((sum, c) => sum + (Number(c.price) || 0), 0) / filteredCourses.length)
            : 0,
        providers: [...new Set(filteredCourses.map(c => c.instructor_name).filter(Boolean))].length,
        bookableCourses: filteredCourses.filter(c => BOOKABLE_BOOKING_TYPES.has(c.booking_type)).length
    };

    // Get human-readable labels from DB taxonomy
    let topicLabel = filteredCourses
        .flatMap((course) => getCourseTopicEntries(course))
        .find((entry) => entry.slug === topicSlug)?.label || topicSlug;
    try {
        // Convert URL slug (e.g. "wirtschaft-management") to DB slug format (e.g. "wirtschaft_management")
        const dbSlug = topicSlug.replace(/-/g, '_');
        // Find area by slug (exact or partial match)
        const area = dbAreas.find(a => a.slug === dbSlug);
        if (area?.label_de) {
            topicLabel = area.label_de;
        }
    } catch (err) {
        console.error("Taxonomy lookup error:", err);
    }

    // SEO Meta Tags
    useEffect(() => {
        const seo = buildCategoryLocationSeo({
            topicLabel,
            locationLabel: location,
            stats,
        });

        document.title = seo.title;

        // Meta Description
        let metaDescTag = document.querySelector('meta[name="description"]');
        if (!metaDescTag) {
            metaDescTag = document.createElement('meta');
            metaDescTag.name = 'description';
            document.head.appendChild(metaDescTag);
        }
        metaDescTag.content = seo.description;

        // Canonical URL
        // Vercel normalisiert wegen trailingSlash=false auf die Variante ohne
        // abschliessenden Slash. Canonical und tatsächliche Route müssen
        // dieselbe URL-Form verwenden.
        const canonicalLocationSlug = resolvedLocation?.slug || locationSlug;
        const canonicalUrl = `${BASE_URL}/courses/${topicSlug}/${canonicalLocationSlug}`;
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
            'og:title': seo.title,
            'og:description': seo.description,
            'og:url': canonicalUrl,
            'og:type': 'website',
            'og:site_name': 'KursNavi',
            'twitter:card': 'summary',
            'twitter:title': seo.title,
            'twitter:description': seo.description
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

        // Dünne Einzeltrefferseiten bleiben ebenso noindex wie Nulltreffer.
        let robotsMeta = document.querySelector('meta[name="robots"]');
        if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.name = "robots";
            document.head.appendChild(robotsMeta);
        }
        robotsMeta.content = stats.totalCourses >= MIN_INDEXABLE_CATEGORY_LOCATION_COURSES
            ? "index,follow"
            : "noindex,follow";

        // BreadcrumbList Schema
        const breadcrumbData = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": BASE_URL
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Kurse",
                    "item": `${BASE_URL}/search`
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": `${topicLabel} in ${location}`
                }
            ]
        };

        let breadcrumbScript = document.querySelector('script[data-schema="breadcrumb"]');
        if (!breadcrumbScript) {
            breadcrumbScript = document.createElement('script');
            breadcrumbScript.type = 'application/ld+json';
            breadcrumbScript.setAttribute('data-schema', 'breadcrumb');
            document.head.appendChild(breadcrumbScript);
        }
        breadcrumbScript.text = JSON.stringify(breadcrumbData);

    }, [topicSlug, locationSlug, stats.totalCourses, stats.bookableCourses, stats.avgPrice, topicLabel, location]);

    // getPriceLabel imported from '../lib/formatPrice'

    const fallbackImage = DEFAULT_COURSE_IMAGE;

    // --- GUARD: Prevent crash on initial load (empty slugs) ---
    if (!topicSlug || !locationSlug) {
        return (
            <div className="min-h-screen bg-beige flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-beige">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-primary/10 via-white to-orange-50 py-16 px-4 border-b border-gray-100">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center text-sm text-gray-500 mb-4">
                        <span className="hover:text-primary cursor-pointer" onClick={() => {
                            window.history.pushState({ view: 'home' }, '', '/');
                        }}>Home</span>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <span className="hover:text-primary cursor-pointer" onClick={() => {
                            window.history.pushState({ view: 'search' }, '', '/search');
                        }}>Kurse</span>
                        <ChevronRight className="w-4 h-4 mx-2" />
                        <span className="text-dark font-medium">{topicLabel} in {location}</span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-heading font-bold text-dark mb-4">
                        {topicLabel} in {location}
                    </h1>

                    <p className="text-xl text-gray-600 mb-8 max-w-3xl">
                        {stats.totalCourses < MIN_INDEXABLE_CATEGORY_LOCATION_COURSES
                            ? `Aktuell sind keine ausreichend vielfältigen ${topicLabel}-Kurse in ${location} verfügbar. Erweitere deine Suche oder schaue später wieder vorbei.`
                            : `Entdecke ${stats.totalCourses} ${topicLabel}-Kurse von ${stats.providers || 'regionalen'} Anbietern in ${location}. Vergleiche Preise und Termine und frage unverbindlich beim passenden Anbieter an.`}
                    </p>

                    {/* Stats Cards (Unique Content for pSEO) */}
                    {stats.totalCourses > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center mb-2">
                                    <TrendingUp className="w-5 h-5 text-primary mr-2" />
                                    <span className="text-gray-500 text-sm">Kurse</span>
                                </div>
                                <div className="text-3xl font-bold text-dark">{stats.totalCourses}</div>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center mb-2">
                                    <Award className="w-5 h-5 text-primary mr-2" />
                                    <span className="text-gray-500 text-sm">Anbieter</span>
                                </div>
                                <div className="text-3xl font-bold text-dark">{stats.providers}</div>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center mb-2">
                                    <Clock className="w-5 h-5 text-primary mr-2" />
                                    <span className="text-gray-500 text-sm">Ø Preis</span>
                                </div>
                                <div className="text-3xl font-bold text-dark">CHF {formatPriceCHF(stats.avgPrice)}</div>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center mb-2">
                                    <MapPin className="w-5 h-5 text-primary mr-2" />
                                    <span className="text-gray-500 text-sm">Region</span>
                                </div>
                                <div className="text-2xl font-bold text-dark">{location}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Course Listing */}
            <div className="max-w-6xl mx-auto px-4 py-12">
                {stats.totalCourses > 0 ? (
                    <>
                        <h2 className="text-2xl font-heading font-bold text-dark mb-6">
                            Alle {topicLabel}-Kurse in {location}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredCourses.map(course => {
                                const isSaved = (savedCourseIds || []).includes(course.id);
                                const slugify = (input) => (input || '').toString().trim().toLowerCase()
                                    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
                                    .replace(/&/g, ' und ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                                const coursePath = buildCoursePath(course) || slugify(course.title || 'detail');
                                return (
                                    <a
                                        key={course.id}
                                        href={coursePath}
                                        onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) return;
                                            e.preventDefault();
                                            window.history.pushState({ view: 'detail', courseId: course.id }, '', coursePath);
                                        }}
                                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                                        style={{textDecoration: 'none', color: 'inherit'}}
                                    >
                                        <div className="aspect-video overflow-hidden relative">
                                            <img
                                                src={course.image_url || fallbackImage}
                                                alt={`${course.title} - ${topicLabel} Kurs in ${location}`}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <span className="absolute top-3 left-3 bg-white/90 px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-sm">
                                                <MapPin className="w-3 h-3 mr-1 text-primary"/> {course.canton}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleSaveCourse && onToggleSaveCourse(course);
                                                }}
                                                className="absolute top-3 right-3 bg-white/90 hover:bg-white p-2 rounded-full shadow-sm transition-all"
                                            >
                                                {isSaved ? <BookmarkCheck className="w-4 h-4 text-green-600" /> : <Bookmark className="w-4 h-4 text-gray-600" />}
                                            </button>
                                        </div>
                                        <div className="p-5">
                                            <h3 className="font-bold text-dark text-lg mb-2 line-clamp-2 font-heading group-hover:text-primary transition-colors">
                                                {course.title}
                                            </h3>
                                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                                {course.description || 'Keine Beschreibung verfügbar'}
                                            </p>
                                            <div className="flex justify-between items-center text-sm gap-4">
                                                <span className="text-gray-500 truncate min-w-0" title={course.instructor_name}>{course.instructor_name}</span>
                                                <span className="font-bold text-primary text-lg text-right w-[90px] shrink-0 leading-tight">{getPriceLabel(course)}</span>
                                            </div>
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-20">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-2xl mx-auto">
                            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h2 className="text-2xl font-heading font-bold text-dark mb-3">
                                Keine Kurse gefunden
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Aktuell sind keine {topicLabel}-Kurse in {location} verfügbar.
                            </p>
                            <button
                                onClick={() => setView('search')}
                                className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors"
                            >
                                Alle Kurse durchsuchen
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
