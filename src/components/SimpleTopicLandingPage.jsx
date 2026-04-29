import React, { useMemo } from 'react';
import { ArrowRight, ArrowLeft, Search } from 'lucide-react';
import { SIMPLE_TOPIC_CONTENT, SEGMENT_LANDING_CONFIG } from '../lib/segmentLandingConfig';
import { buildCoursePath } from '../lib/siteConfig';

// Segment URL → display label + back href
const SEGMENT_META = {
  beruflich:     { label: 'Beruflich',      href: '/professional' },
  'privat-hobby': { label: 'Privat & Hobby', href: '/private' },
  'kinder-jugend': { label: 'Kinder & Jugend', href: '/children' },
};

// Segment URL → search type key (also the SEGMENT_LANDING_CONFIG key)
const SEGMENT_TO_SEARCH_TYPE = {
  beruflich:      'beruflich',
  'privat-hobby': 'privat_hobby',
  'kinder-jugend': 'kinder_jugend',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SimpleTopicLandingPage({
  segment,
  slug,
  setView,
  setSearchType,
  setSearchArea,
  publishedCourses,
  setSelectedCourse,
}) {
  const configKey = `${segment}/${slug}`;
  const config = SIMPLE_TOPIC_CONTENT[configKey];

  const segmentMeta = SEGMENT_META[segment] || { label: 'Übersicht', href: '/' };
  const searchType = SEGMENT_TO_SEARCH_TYPE[segment] || 'privat_hobby';
  const areaSlug = config?.areaAliases?.[0] ?? null;

  // Kursarten from segment config
  const kursarten = SEGMENT_LANDING_CONFIG[searchType]?.kursarten || [];

  // Filter published courses by area (up to 6) — only on themen pages with areaAliases
  const topicCourses = useMemo(() => {
    if (!publishedCourses?.length || !config?.areaAliases?.length) return [];
    return publishedCourses
      .filter(c => config.areaAliases.some(a => c.category_area === a))
      .slice(0, 6);
  }, [publishedCourses, config?.areaAliases]);

  // Navigate to search pre-filtered with this topic's area + segment type
  const handleGoToSearch = () => {
    if (setSearchType) setSearchType(searchType);
    if (setSearchArea && areaSlug) setSearchArea(areaSlug);
    const params = new URLSearchParams({ type: searchType });
    if (areaSlug) params.set('area', areaSlug);
    window.history.pushState({}, '', `/search?${params.toString()}`);
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCourseClick = (course) => {
    const path = buildCoursePath(course);
    window.history.pushState({}, '', path);
    if (setSelectedCourse) setSelectedCourse(course);
    setView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSegment = () => {
    window.history.pushState({}, '', segmentMeta.href);
    const viewMap = {
      '/professional': 'landing-prof',
      '/private': 'landing-private',
      '/children': 'landing-kids',
    };
    setView(viewMap[segmentMeta.href] || 'home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Unknown page → simple fallback
  if (!config) {
    return (
      <div className="min-h-screen bg-beige flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-dark mb-2">Seite nicht gefunden</h1>
        <p className="text-gray-500 mb-6">Diese Themenseite existiert nicht (mehr).</p>
        <button
          onClick={handleGoToSearch}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition"
        >
          Alle Kurse durchsuchen <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Only show kursarten on themen pages (those with areaAliases), not on editorial kursart pages
  const showKursarten = kursarten.length > 0 && config.areaAliases?.length > 0;

  return (
    <div className="min-h-screen bg-beige font-sans">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-10">
          {/* Breadcrumb */}
          <button
            onClick={handleBackToSegment}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary transition mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            {segmentMeta.label}
          </button>

          <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-3 leading-tight">
            {config.title}
          </h1>
          <p className="text-lg text-primary font-medium mb-4">{config.subtitle}</p>
          <p className="text-gray-600 max-w-2xl leading-relaxed">{config.intro}</p>
        </div>
      </div>

      {/* ── Editorial points ────────────────────────────────────────────────── */}
      {config.points?.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {config.points.map((point, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-4"
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{point.icon}</span>
                <div>
                  <h3 className="font-bold text-dark mb-1">{point.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{point.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Kursarten ──────────────────────────────────────────────────────── */}
      {showKursarten && (
        <section className="max-w-5xl mx-auto px-4 pb-10">
          <h2 className="text-lg font-heading font-bold text-dark mb-1">Wie möchtest du lernen?</h2>
          <p className="text-sm text-gray-500 mb-4">
            Wähle eine Kursart – die Suche öffnet sich mit diesem Thema vorausgewählt.
          </p>
          <div className="flex flex-col gap-3">
            {kursarten.map((k) => (
              <button
                key={k.slug}
                onClick={handleGoToSearch}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-primary/20 transition group text-left"
              >
                <span className="text-2xl flex-shrink-0">{k.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-dark text-sm">{k.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{k.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Aktuelle Kurse ─────────────────────────────────────────────────── */}
      {config.showCourseList && areaSlug && topicCourses.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-dark">Aktuelle Kurse</h2>
            <button
              onClick={handleGoToSearch}
              className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Alle anzeigen <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {topicCourses.map((course) => (
              <button
                key={course.id}
                onClick={() => handleCourseClick(course)}
                className="text-left bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden w-full"
              >
                <div className="relative h-32 bg-gray-100 overflow-hidden">
                  {course.image_url ? (
                    <img
                      src={course.image_url}
                      alt={course.title || ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-gray-200">📚</div>
                  )}
                  {course.price > 0 && (
                    <span className="absolute top-2 right-2 bg-white/95 text-dark text-xs font-bold px-2 py-0.5 rounded-full shadow">
                      CHF {Number(course.price).toLocaleString('de-CH')}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-dark text-sm leading-snug mb-1 line-clamp-2">
                    {course.title}
                  </h3>
                  <div className="flex gap-2 text-xs text-gray-400 flex-wrap">
                    {course.location && <span>📍 {course.location}</span>}
                    {course.duration_label && <span>🕐 {course.duration_label}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Course search CTA (fallback when no courses found or not loaded) ── */}
      {config.showCourseList && areaSlug && topicCourses.length === 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <h2 className="text-xl font-heading font-bold text-dark mb-2">Passende Kurse entdecken</h2>
            <p className="text-gray-500 mb-5 max-w-md mx-auto">
              Alle Kurse zu diesem Thema – mit allen Filtern und tagesaktuellen Angeboten.
            </p>
            <button
              onClick={handleGoToSearch}
              className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition shadow"
            >
              <Search className="w-4 h-4" />
              Kurse anzeigen
            </button>
          </div>
        </section>
      )}

      {/* ── Hint text ──────────────────────────────────────────────────────── */}
      {config.hintText && (
        <div className="max-w-5xl mx-auto px-4 pb-8">
          <p className="text-xs text-gray-400 italic">{config.hintText}</p>
        </div>
      )}

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-dark mb-1">Direkt suchen?</h3>
            <p className="text-gray-500 text-sm">
              Nutze die vollständige Kurssuche mit allen Filtern.
            </p>
          </div>
          <button
            onClick={handleGoToSearch}
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition shadow"
          >
            <Search className="w-4 h-4" />
            Alle Kurse durchsuchen
          </button>
        </div>
      </section>

    </div>
  );
}
