import React, { useMemo } from 'react';
import { ArrowRight, ArrowLeft, Search, MapPin, Clock } from 'lucide-react';
import { SIMPLE_TOPIC_CONTENT } from '../lib/segmentLandingConfig';
import { buildCoursePath } from '../lib/siteConfig';

// ---------------------------------------------------------------------------
// Course filter — uses only exact DB field aliases, never keyword search
// Conditions (all must match):
//   1. status === 'published'
//   2. category_type in typeAliases
//   3. category_area in areaAliases  (if areaAliases is set)
//   4. category_specialty in specialtyAliases  (if specialtyAliases is set)
// ---------------------------------------------------------------------------
function filterTopicCourses(courses, config) {
  if (!courses?.length || !config?.typeAliases?.length) return [];
  return courses.filter((c) => {
    if (c.status && c.status !== 'published') return false;
    if (!config.typeAliases.includes(c.category_type)) return false;
    if (config.areaAliases?.length && !config.areaAliases.includes(c.category_area)) return false;
    if (config.specialtyAliases?.length && !config.specialtyAliases.includes(c.category_specialty)) return false;
    return true;
  });
}

function formatChf(price) {
  if (!price && price !== 0) return null;
  if (price === 0) return 'Kostenlos';
  return `CHF ${Number(price).toLocaleString('de-CH')}`;
}

// Segment URL → display label + back href
const SEGMENT_META = {
  beruflich:     { label: 'Beruflich',      href: '/professional' },
  'privat-hobby': { label: 'Privat & Hobby', href: '/private' },
  'kinder-jugend': { label: 'Kinder & Jugend', href: '/children' },
};

// Segment URL → search type key used for CTA
const SEGMENT_TO_SEARCH_TYPE = {
  beruflich:      'beruflich',
  'privat-hobby': 'privat_hobby',
  'kinder-jugend': 'kinder_jugend',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CourseCard({ course, onClickCourse }) {
  const price = formatChf(course.price);
  const location = course.location || course.canton || '';
  const duration = course.duration_label || '';

  return (
    <button
      onClick={() => onClickCourse(course)}
      className="group text-left bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer w-full"
    >
      <div className="relative h-36 bg-gray-100 overflow-hidden">
        {course.image_url ? (
          <img
            src={course.image_url}
            alt={course.title || ''}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-200">📚</div>
        )}
        {price && (
          <span className="absolute top-2 right-2 bg-white/95 text-dark text-xs font-bold px-2 py-0.5 rounded-full shadow">
            {price}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold text-dark text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
          {location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{location}</span>
          )}
          {duration && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{duration}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function NoCoursesFallback({ segment, setView, setSearchType }) {
  const searchType = SEGMENT_TO_SEARCH_TYPE[segment] || 'privat_hobby';

  const handleSearch = () => {
    if (setSearchType) setSearchType(searchType);
    window.history.pushState({}, '', `/search?type=${searchType}`);
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
      <div className="text-4xl mb-3">🔍</div>
      <p className="text-gray-600 mb-5 max-w-md mx-auto">
        Aktuell sind in diesem Thema noch keine passenden Kurse veröffentlicht.
        Wir erweitern das Angebot laufend.
      </p>
      <button
        onClick={handleSearch}
        className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition shadow"
      >
        Alle Kurse durchsuchen <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SimpleTopicLandingPage({
  segment,
  slug,
  courses,
  setView,
  setSearchType,
  setSelectedCourse,
}) {
  const configKey = `${segment}/${slug}`;
  const config = SIMPLE_TOPIC_CONTENT[configKey];

  const matchedCourses = useMemo(
    () => (config?.showCourseList ? filterTopicCourses(courses, config) : []),
    [courses, config]
  );

  const segmentMeta = SEGMENT_META[segment] || { label: 'Übersicht', href: '/' };
  const searchType = SEGMENT_TO_SEARCH_TYPE[segment] || 'privat_hobby';

  const handleCourseClick = (course) => {
    const path = buildCoursePath(course);
    window.history.pushState({}, '', path);
    if (setSelectedCourse) setSelectedCourse(course);
    setView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSegment = () => {
    window.history.pushState({}, '', segmentMeta.href);
    // Map segment href back to view name
    const viewMap = {
      '/professional': 'landing-prof',
      '/private': 'landing-private',
      '/children': 'landing-kids',
    };
    setView(viewMap[segmentMeta.href] || 'home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToSearch = () => {
    if (setSearchType) setSearchType(searchType);
    window.history.pushState({}, '', `/search?type=${searchType}`);
    setView('search');
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

      {/* ── Course list or fallback ─────────────────────────────────────────── */}
      {config.showCourseList && (
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-bold text-dark">Passende Kurse</h2>
            {matchedCourses.length > 0 && (
              <button
                onClick={handleGoToSearch}
                className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline"
              >
                Alle anzeigen <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {matchedCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {matchedCourses.slice(0, 6).map((course) => (
                <CourseCard key={course.id} course={course} onClickCourse={handleCourseClick} />
              ))}
            </div>
          ) : (
            <NoCoursesFallback segment={segment} setView={setView} setSearchType={setSearchType} />
          )}
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
