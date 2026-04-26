import React, { useEffect } from 'react';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import {
  SIMPLE_TOPIC_CONTENT,
  SEGMENT_LANDING_CONFIG,
  resolveSegmentKey,
  segmentToTypeKey,
  segmentToDbType,
} from '../lib/segmentLandingConfig';
import { SEGMENT_CONFIG } from '../lib/constants';
import { BASE_URL, buildCoursePath } from '../lib/siteConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Filter courses by segment DB type AND topic keywords.
 * A course must match the segment AND have at least one keyword in its title.
 * If no keywords are defined, all segment courses are returned.
 */
function filterCoursesByTopic(courses, dbType, keywords) {
  if (!courses?.length || !dbType) return [];

  const filtered = courses.filter((c) => {
    const matchesSegment =
      c.category_type === dbType ||
      (Array.isArray(c.all_categories) &&
        c.all_categories.some((cat) => cat && cat.category_type === dbType));
    if (!matchesSegment) return false;

    if (!keywords?.length) return true;

    const title = (c.title || '').toLowerCase();
    return keywords.some((kw) => title.includes(kw.toLowerCase()));
  });

  return filtered;
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

function TopicHero({ title, subtitle, heroImage, segCfg }) {
  const gradient = segCfg?.gradient || 'from-blue-600/70 to-blue-900/90';

  return (
    <div className="relative overflow-hidden" style={{ minHeight: '360px' }}>
      {heroImage && (
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      <div
        className={`absolute inset-0 ${heroImage
          ? 'bg-gradient-to-b from-black/55 via-black/40 to-black/65'
          : `bg-gradient-to-br ${gradient}`}`}
      />
      <div
        className="relative z-10 max-w-4xl mx-auto px-4 py-20 text-white flex flex-col justify-center"
        style={{ minHeight: '360px' }}
      >
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

function IntroSection({ intro }) {
  return (
    <section className="max-w-4xl mx-auto px-4 py-10">
      <p className="text-gray-600 text-lg leading-relaxed">{intro}</p>
    </section>
  );
}

function OrientationPoints({ points, segCfg }) {
  const bgLight = segCfg?.bgLight || 'bg-blue-50';
  const borderLight = segCfg?.borderLight || 'border-blue-200';

  return (
    <section className="max-w-7xl mx-auto px-4 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {points.map((p, i) => (
          <div key={i} className={`${bgLight} border ${borderLight} rounded-2xl p-6`}>
            <div className="text-3xl mb-3">{p.icon}</div>
            <h3 className="font-bold text-dark text-base mb-2">{p.title}</h3>
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
      className="group text-left bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer w-full"
    >
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

function CTASection({ setView, setSearchType, dbType }) {
  const handleGoToSearch = () => {
    const searchTypeParam = dbType === 'professionell' ? 'beruflich' : dbType;
    if (setSearchType) setSearchType(searchTypeParam);
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

function BackButton({ segment, setView, setSearchType }) {
  const segmentMap = {
    'beruflich': { searchType: 'beruflich', path: '/search?type=beruflich', label: 'Beruflich' },
    'privat-hobby': { searchType: 'privat_hobby', path: '/search?type=privat_hobby', label: 'Privat & Hobby' },
    'kinder-jugend': { searchType: 'kinder_jugend', path: '/search?type=kinder_jugend', label: 'Kinder & Jugend' },
  };
  const target = segmentMap[segment] || segmentMap['beruflich'];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6">
      <button
        onClick={() => {
          if (setSearchType) setSearchType(target.searchType);
          window.history.pushState({}, '', target.path);
          setView('search');
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
  segment,          // URL segment: 'beruflich' | 'privat-hobby' | 'kinder-jugend'
  slug,             // URL slug: e.g. 'it-digital'
  courses,          // all publishedCourses from App
  lang = 'de',
  setView,
  setSearchType,
  setSelectedCourse,
}) {
  const contentKey = `${segment}/${slug}`;
  const content = SIMPLE_TOPIC_CONTENT[contentKey];

  const segCfgKey = segmentToTypeKey(segment);
  const segCfg = SEGMENT_CONFIG[segCfgKey];
  const dbType = segmentToDbType(segment);

  // Find the matching thema image from SEGMENT_LANDING_CONFIG
  const segLandingKey = resolveSegmentKey(segment);
  const segLanding = SEGMENT_LANDING_CONFIG[segLandingKey];
  const themaConfig =
    segLanding?.themen?.find((t) => t.slug === slug) ||
    segLanding?.kursarten?.find((k) => k.slug === slug);
  const heroImage = themaConfig?.image || null;

  // Filter courses for this specific topic using keywords
  const topicCourses = filterCoursesByTopic(courses, dbType, content?.searchKeywords);

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

  // Click a course card → navigate to detail view
  const handleCourseClick = (course) => {
    const path = buildCoursePath(course);
    window.history.pushState({}, '', path);
    if (setSelectedCourse) setSelectedCourse(course);
    setView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <BackButton segment={segment} setView={setView} setSearchType={setSearchType} />

      <TopicHero
        title={content.title}
        subtitle={content.subtitle}
        heroImage={heroImage}
        segCfg={segCfg}
      />

      <IntroSection intro={content.intro} />

      {content.points?.length > 0 && (
        <OrientationPoints points={content.points} segCfg={segCfg} />
      )}

      <CoursesPreviewSection
        courses={topicCourses}
        onClickCourse={handleCourseClick}
        segCfg={segCfg}
      />

      {content.hintText && (
        <section className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-700 leading-relaxed">{content.hintText}</p>
          </div>
        </section>
      )}

      <CTASection setView={setView} setSearchType={setSearchType} dbType={dbType} />
    </div>
  );
}
