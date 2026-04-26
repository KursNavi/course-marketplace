import React from 'react';
import { ArrowRight, Search, Sparkles, MapPin, Clock } from 'lucide-react';
import { SEGMENT_LANDING_CONFIG } from '../lib/segmentLandingConfig';
import { SEGMENT_CONFIG } from '../lib/constants';
import { buildCoursePath } from '../lib/siteConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VARIANT_TO_KEY = {
  prof: 'beruflich',
  private: 'privat_hobby',
  kids: 'kinder_jugend',
};

const VARIANT_TO_SEARCH_TYPE = {
  prof: 'beruflich',
  private: 'privat_hobby',
  kids: 'kinder_jugend',
};

const VARIANT_TO_DB_TYPE = {
  prof: 'professionell',
  private: 'privat',
  kids: 'kinder',
};

function navigateTo(href, setView, viewKey) {
  window.history.pushState({}, '', href);
  setView(viewKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterCoursesBySegment(courses, dbType) {
  if (!courses?.length || !dbType) return [];
  return courses.filter((c) => {
    if (c.category_type === dbType) return true;
    if (Array.isArray(c.all_categories)) {
      return c.all_categories.some((cat) => cat && cat.category_type === dbType);
    }
    return false;
  });
}

function formatChf(price) {
  if (!price && price !== 0) return null;
  if (price === 0) return 'Kostenlos';
  return `CHF ${Number(price).toLocaleString('de-CH')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SegmentHero({ title, subtitle, bgImage, searchQuery, setSearchQuery, handleSearchSubmit, t }) {
  return (
    <div className="relative overflow-hidden" style={{ minHeight: '520px' }}>
      <div className="absolute inset-0 z-0">
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/65" />
      </div>
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center text-white px-4 pt-20 pb-16 max-w-4xl mx-auto"
        style={{ minHeight: '520px' }}
      >
        <p className="text-sm font-semibold tracking-widest uppercase mb-4 opacity-80">
          KursNavi · Kursguide Schweiz
        </p>
        <h1 className="text-4xl md:text-6xl font-heading font-bold mb-5 leading-tight drop-shadow-md">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-white/85 mb-10 max-w-2xl font-light leading-relaxed">
          {subtitle}
        </p>
        <div className="w-full max-w-xl relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder || 'Kurs suchen…'}
            className="w-full px-6 py-4 rounded-full text-dark focus:outline-none focus:ring-4 focus:ring-white/40 text-base shadow-xl"
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
          />
          <button
            onClick={handleSearchSubmit}
            className="absolute right-2 top-2 bg-primary text-white p-2.5 rounded-full hover:bg-orange-600 transition shadow-md"
            aria-label="Suchen"
          >
            <Search className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TileGrid({ tiles, setView }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {tiles.map((tile) => {
        const targetView = tile.isThemenwelt ? 'bereich-landing' : 'thema-landing';
        return (
          <button
            key={tile.slug}
            onClick={() => navigateTo(tile.href, setView, targetView)}
            className="group relative overflow-hidden rounded-2xl aspect-[4/3] cursor-pointer text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={tile.label}
          >
            <img
              src={tile.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {tile.isThemenwelt && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-white/90 text-primary text-xs font-bold px-2 py-0.5 rounded-full shadow">
                <Sparkles className="w-3 h-3" /> Themenwelt
              </span>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="text-xl mb-0.5">{tile.icon}</div>
              <h3 className="text-white font-bold text-sm leading-snug">{tile.label}</h3>
              <p className="text-white/70 text-xs leading-relaxed line-clamp-2 mt-0.5">{tile.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ThemenSection({ themen, setView, segCfg }) {
  const accentText = segCfg?.text || 'text-blue-600';
  return (
    <section className="max-w-7xl mx-auto px-4 pt-16 pb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold tracking-widest uppercase ${accentText}`}>Themenwelten</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">Themen entdecken</h2>
      <p className="text-gray-500 mb-8 max-w-xl">Tauche tiefer ein – mit kuratierten Themenwelten und Orientierungsseiten.</p>
      <TileGrid tiles={themen} setView={setView} />
    </section>
  );
}

function KursartenSection({ kursarten, setView, segCfg }) {
  const accentText = segCfg?.text || 'text-blue-600';
  return (
    <section className="max-w-7xl mx-auto px-4 pb-12">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold tracking-widest uppercase ${accentText}`}>Kursarten</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">Wonach suchst du?</h2>
      <p className="text-gray-500 mb-8 max-w-xl">Wähle eine Kursart – wir zeigen dir passende Angebote.</p>
      <TileGrid tiles={kursarten} setView={setView} />
    </section>
  );
}

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
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {location}</span>
          )}
          {duration && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {duration}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function CoursesPreviewSection({ courses, onClickCourse, onShowAll, segCfg }) {
  const accentText = segCfg?.text || 'text-blue-600';

  if (!courses?.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 pb-12">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold tracking-widest uppercase ${accentText}`}>Kursangebote</span>
        <button
          onClick={onShowAll}
          className={`text-sm font-semibold ${accentText} flex items-center gap-1 hover:underline`}
        >
          Alle anzeigen <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <h2 className="text-2xl font-heading font-bold text-dark mb-6">Aktuelle Kurse</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {courses.slice(0, 6).map((course) => (
          <CourseCard key={course.id} course={course} onClickCourse={onClickCourse} />
        ))}
      </div>
    </section>
  );
}

function SearchCTASection({ setView, setSearchType, searchTypeKey }) {
  const handleGoToSearch = () => {
    if (setSearchType) setSearchType(searchTypeKey);
    window.history.pushState({}, '', `/search?type=${searchTypeKey}`);
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold text-dark mb-1">Direkt suchen?</h3>
          <p className="text-gray-500 text-sm">Nutze die vollständige Kurssuche mit allen Filtern.</p>
        </div>
        <button
          onClick={handleGoToSearch}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition shadow"
        >
          Alle Kurse durchsuchen <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const LandingView = ({
  title,
  subtitle,
  variant,
  searchQuery,
  setSearchQuery,
  handleSearchSubmit,
  setView,
  setSearchType,
  setSelectedCourse,
  publishedCourses,
  t,
}) => {
  const segmentKey = VARIANT_TO_KEY[variant] || 'privat_hobby';
  const segCfg = SEGMENT_CONFIG[segmentKey];
  const landingCfg = SEGMENT_LANDING_CONFIG[segmentKey];
  const searchTypeKey = VARIANT_TO_SEARCH_TYPE[variant] || 'privat_hobby';
  const dbType = VARIANT_TO_DB_TYPE[variant] || 'privat';

  const heroImages = {
    prof: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=2000',
    private: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000',
    kids: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2000',
  };
  const bgImage = segCfg?.heroBg || heroImages[variant] || heroImages.prof;

  const segmentCourses = filterCoursesBySegment(publishedCourses, dbType);

  const handleCourseClick = (course) => {
    const path = buildCoursePath(course);
    window.history.pushState({}, '', path);
    if (setSelectedCourse) setSelectedCourse(course);
    setView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShowAll = () => {
    if (setSearchType) setSearchType(searchTypeKey);
    window.history.pushState({}, '', `/search?type=${searchTypeKey}`);
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!landingCfg) {
    return <div className="p-8 text-center text-gray-400">Konfiguration fehlt.</div>;
  }

  return (
    <div className="min-h-screen bg-beige font-sans">
      <SegmentHero
        title={title}
        subtitle={subtitle}
        bgImage={bgImage}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearchSubmit={handleSearchSubmit}
        t={t}
      />

      <ThemenSection
        themen={landingCfg.themen}
        setView={setView}
        segCfg={segCfg}
      />

      <KursartenSection
        kursarten={landingCfg.kursarten}
        setView={setView}
        segCfg={segCfg}
      />

      <CoursesPreviewSection
        courses={segmentCourses}
        onClickCourse={handleCourseClick}
        onShowAll={handleShowAll}
        segCfg={segCfg}
      />

      <SearchCTASection
        setView={setView}
        setSearchType={setSearchType}
        searchTypeKey={searchTypeKey}
      />
    </div>
  );
};

export default LandingView;
