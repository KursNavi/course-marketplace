import React from 'react';
import { ArrowRight, ArrowLeft, Search } from 'lucide-react';
import { SIMPLE_TOPIC_CONTENT } from '../lib/segmentLandingConfig';

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
// Main component
// ---------------------------------------------------------------------------

export default function SimpleTopicLandingPage({
  segment,
  slug,
  setView,
  setSearchType,
  setSearchArea,
}) {
  const configKey = `${segment}/${slug}`;
  const config = SIMPLE_TOPIC_CONTENT[configKey];

  const segmentMeta = SEGMENT_META[segment] || { label: 'Übersicht', href: '/' };
  const searchType = SEGMENT_TO_SEARCH_TYPE[segment] || 'privat_hobby';
  const areaSlug = config?.areaAliases?.[0] ?? null;

  const handleGoToSearch = () => {
    if (setSearchType) setSearchType(searchType);
    if (setSearchArea && areaSlug) setSearchArea(areaSlug);
    const params = new URLSearchParams({ type: searchType });
    if (areaSlug) params.set('area', areaSlug);
    window.history.pushState({}, '', `/search?${params.toString()}`);
    setView('search');
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

      {/* ── Course search CTA ───────────────────────────────────────────────── */}
      {config.showCourseList && areaSlug && (
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
