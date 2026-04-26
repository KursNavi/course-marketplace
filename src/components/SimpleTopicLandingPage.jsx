import React, { useEffect } from 'react';
import { ArrowRight, Clock, MapPin, Info } from 'lucide-react';
import {
  SIMPLE_TOPIC_CONTENT,
  SEGMENT_LANDING_CONFIG,
  resolveSegmentKey,
  segmentToTypeKey,
  segmentToDbType,
} from '../lib/segmentLandingConfig';
import { SEGMENT_CONFIG } from '../lib/constants';
import { BASE_URL } from '../lib/siteConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter publishedCourses to those belonging to this segment's DB type */
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

/** Format price CHF */
function formatChf(price) {
  if (!price && price !== 0) return null;
  if (price === 0) return 'Kostenlos';
  return `CHF ${Number(price).toLocaleString('de-CH')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TopicHero({ title, subtitle, bgGradient, segCfg }) {
  const gradient = segCfg?.gradient || 'from-blue-600/70 to-blue-900/90';

  return (
    <div className={`relative bg-gradient-to-br ${gradient} overflow-hidden`} style={{ minHeight: '360px' }}>
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 text-white flex flex-col justify-center" style={{ minHeight: '360px' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-4 opacity-70">
          KursNavi · Thema
        </p>
        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-lg text-white/80 max-w-xl font-light leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function IntroSection({ intro, segCfg }) {
  const borderColor = segCfg?.borderLight || 'border-blue-200';
  const bgLight = segCfg?.bgLight || 'bg-blue-50';

  return (
    <section className="max-w-4xl mx-auto px-4 py-10">
      <p className="text-gray-600 text-lg leading-relaxed">{intro}</p>
    </section>
  );
}

function OrientationPoints({ points, segCfg }) {
  const bgLight = segCfg?.bgLight || 'bg-blue-50';
  const text = segCfg?.text || 'text-blue-600';
  const borderLight = segCfg?.borderLight || 'border-blue-200';

  return (
    <section className="max-w-7xl mx-auto px-4 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {points.map((p, i) => (
          <div
            key={i}
            className={`${bgLight} border ${borderLight} rounded-2xl p-6`}
          >
            <div className="text-3xl mb-3">{p.icon}</div>
            <h3 className={`font-bold text-dark text-base mb-2`}>{p.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>
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
      className="group text-left bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer"
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-100 overflow-hidden">
        {course.image_url ? (
          <img
            src={course.image_url}
            alt={course.title || ''}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-200">
            📚
          </div>
        )}
        {price && (
          <span className="absolute top-3 right-3 bg-white/95 text-dark text-xs font-bold px-2 py-1 rounded-full shadow">
            {price}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-dark text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {location}
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {duration}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function CoursesPreviewSection({ courses, onClickCourse, segCfg }) {
  const accentText = segCfg?.text || 'text-blue-600';

  if (!courses?.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold tracking-widest uppercase ${accentText}`}>Kursangebote</span>
      </div>
      <h2 className="text-2xl font-heading font-bold text-dark mb-6">Passende Kurse in diesem Bereich</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {courses.slice(0, 6).map((course) => (
          <CourseCard key={course.id} course={course} onClickCourse={onClickCourse} />
        ))}
      </div>
    </section>
  );
}

function ComingSoonHint({ hintText }) {
  return (
    <section className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 leading-relaxed">
          {hintText || 'Weitere Inhalte und Ratgeber zu diesem Thema folgen in Kürze.'}
        </p>
      </div>
    </section>
  );
}

function CTASection({ setView, setSearchType, dbType }) {
  const handleGoToSearch = () => {
    if (setSearchType) setSearchType(dbType === 'professionell' ? 'beruflich' : dbType);
    window.history.pushState({}, '', '/search');
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold text-dark mb-1">Noch mehr entdecken?</h3>
          <p className="text-gray-500 text-sm">Nutze die vollständige Kurssuche mit allen Filteroptionen.</p>
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

function BackButton({ segment, setView }) {
  // Map URL segment to view key and path
  const segmentMap = {
    'beruflich': { view: 'landing-prof', path: '/professional', label: 'Beruflich' },
    'privat-hobby': { view: 'landing-private', path: '/private', label: 'Privat & Hobby' },
    'kinder-jugend': { view: 'landing-kids', path: '/children', label: 'Kinder & Jugend' },
  };
  const target = segmentMap[segment] || segmentMap['beruflich'];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6">
      <button
        onClick={() => {
          window.history.pushState({}, '', target.path);
          setView(target.view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
        Zurück zu {target.label}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SimpleTopicLandingPage({
  segment,       // URL segment: 'beruflich' | 'privat-hobby' | 'kinder-jugend'
  slug,          // URL slug: e.g. 'it-digital'
  courses,       // all publishedCourses from App
  lang = 'de',
  setView,
  setSearchType,
}) {
  // Build lookup key - normalise dashes in segment for key lookup
  const contentKey = `${segment}/${slug}`;
  const content = SIMPLE_TOPIC_CONTENT[contentKey];

  const segCfgKey = segmentToTypeKey(segment);
  const segCfg = SEGMENT_CONFIG[segCfgKey];
  const dbType = segmentToDbType(segment);

  // Filter courses for this segment
  const segmentCourses = filterCoursesBySegment(courses, dbType);

  // SEO
  useEffect(() => {
    if (!content) return;
    document.title = `${content.title} | KursNavi`;

    let metaTag = document.querySelector('meta[name="description"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'description';
      document.head.appendChild(metaTag);
    }
    metaTag.content = content.intro?.substring(0, 155) || content.subtitle;

    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.rel = 'canonical';
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = `${BASE_URL}/thema/${segment}/${slug}`;
  }, [content, segment, slug]);

  // Click a course card → navigate to detail
  const handleCourseClick = (course) => {
    if (course?.slug && course.topic_slug && course.location_slug) {
      window.history.pushState({}, '', `/courses/${course.topic_slug}/${course.location_slug}/${course.slug}`);
    }
    // App listens to popstate/locationchange to update selectedCourse — we fire locationchange
    window.dispatchEvent(new Event('locationchange'));
  };

  if (!content) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-24">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold text-dark mb-3">Seite nicht gefunden</h1>
        <p className="text-gray-500 mb-6">Dieses Thema existiert noch nicht oder wurde verschoben.</p>
        <button
          onClick={() => { window.history.pushState({}, '', '/search'); setView('search'); window.scrollTo(0, 0); }}
          className="bg-primary text-white px-5 py-3 rounded-full hover:opacity-90"
        >
          Zur Kurssuche
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-beige font-sans">
      <BackButton segment={segment} setView={setView} />

      <TopicHero
        title={content.title}
        subtitle={content.subtitle}
        segCfg={segCfg}
      />

      <IntroSection intro={content.intro} segCfg={segCfg} />

      {content.points?.length > 0 && (
        <OrientationPoints points={content.points} segCfg={segCfg} />
      )}

      <CoursesPreviewSection
        courses={segmentCourses}
        onClickCourse={handleCourseClick}
        segCfg={segCfg}
      />

      <ComingSoonHint hintText={content.hintText} />

      <CTASection
        setView={setView}
        setSearchType={setSearchType}
        dbType={dbType}
      />
    </div>
  );
}
