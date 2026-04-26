import React from 'react';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { SEGMENT_LANDING_CONFIG, resolveSegmentKey } from '../lib/segmentLandingConfig';
import { SEGMENT_CONFIG } from '../lib/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map LandingView variant → segment key used in config & SEGMENT_CONFIG */
const VARIANT_TO_KEY = {
  prof: 'beruflich',
  private: 'privat_hobby',
  kids: 'kinder_jugend',
};

/** URL segment strings used in /thema/ paths */
const VARIANT_TO_URL_SEGMENT = {
  prof: 'beruflich',
  private: 'privat-hobby',
  kids: 'kinder-jugend',
};

/** Navigate using the custom SPA router */
function navigateTo(href, setView, viewKey) {
  window.history.pushState({}, '', href);
  setView(viewKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SegmentHero({ title, subtitle, bgImage, accentClass, searchQuery, setSearchQuery, handleSearchSubmit, t }) {
  return (
    <div className="relative overflow-hidden" style={{ minHeight: '520px' }}>
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/65" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center text-white px-4 pt-20 pb-16 max-w-4xl mx-auto" style={{ minHeight: '520px' }}>
        <p className={`text-sm font-semibold tracking-widest uppercase mb-4 opacity-80`}>
          KursNavi · Kursguide Schweiz
        </p>
        <h1 className="text-4xl md:text-6xl font-heading font-bold mb-5 leading-tight drop-shadow-md">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-white/85 mb-10 max-w-2xl font-light leading-relaxed">
          {subtitle}
        </p>

        {/* Search bar */}
        <div className="w-full max-w-xl relative group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder || 'Kurs suchen…'}
            className="w-full px-6 py-4 rounded-full text-dark focus:outline-none focus:ring-4 focus:ring-white/40 text-base shadow-xl transition-all"
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

function KursartenSection({ kursarten, urlSegment, setView, segCfg }) {
  // color accent per segment
  const accentBg = segCfg?.bgLight || 'bg-blue-50';
  const accentText = segCfg?.text || 'text-blue-600';
  const accentBorder = segCfg?.borderLight || 'border-blue-200';

  return (
    <section className="max-w-7xl mx-auto px-4 pt-16 pb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold tracking-widest uppercase ${accentText}`}>Angebote</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">Wonach suchst du?</h2>
      <p className="text-gray-500 mb-8 max-w-xl">Wähle eine Kursart – wir zeigen dir passende Angebote auf einer eigenen Übersichtsseite.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {kursarten.map((k) => {
          const href = `/thema/${urlSegment}/${k.slug}`;
          return (
            <button
              key={k.slug}
              onClick={() => navigateTo(href, setView, 'thema-landing')}
              className={`group text-left bg-white border ${accentBorder} rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
            >
              <div className="text-4xl mb-4">{k.icon}</div>
              <h3 className="text-lg font-bold text-dark mb-2 group-hover:text-primary transition-colors">{k.label}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{k.desc}</p>
              <span className={`inline-flex items-center gap-1 text-sm font-semibold ${accentText}`}>
                Entdecken <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ThemenSection({ themen, setView, segCfg }) {
  const accentText = segCfg?.text || 'text-blue-600';

  return (
    <section className="max-w-7xl mx-auto px-4 pt-8 pb-16">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold tracking-widest uppercase ${accentText}`}>Themenwelten</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">Themen entdecken</h2>
      <p className="text-gray-500 mb-8 max-w-xl">Tauche tiefer ein – mit kuratierten Themenwelten und Orientierungsseiten.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {themen.map((t) => (
          <ThemaCard key={t.slug} thema={t} setView={setView} />
        ))}
      </div>
    </section>
  );
}

function ThemaCard({ thema, setView }) {
  const targetView = thema.isThemenwelt ? 'bereich-landing' : 'thema-landing';

  return (
    <button
      onClick={() => navigateTo(thema.href, setView, targetView)}
      className="group relative overflow-hidden rounded-2xl aspect-[4/3] cursor-pointer text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={thema.label}
    >
      {/* Background image */}
      <img
        src={thema.image}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Themenwelt badge */}
      {thema.isThemenwelt && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/90 text-primary text-xs font-bold px-2.5 py-1 rounded-full shadow">
          <Sparkles className="w-3 h-3" /> Themenwelt
        </span>
      )}

      {/* Text content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="text-2xl mb-1">{thema.icon}</div>
        <h3 className="text-white font-bold text-base leading-snug mb-0.5">{thema.label}</h3>
        <p className="text-white/75 text-xs leading-relaxed">{thema.desc}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-white/90 text-xs font-semibold group-hover:text-white transition-colors">
          Mehr erfahren <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}

function SearchCTASection({ handleSearchSubmit, setView, t, segCfg }) {
  const accentBg = segCfg?.bgLight || 'bg-blue-50';
  const accentBorder = segCfg?.borderLight || 'border-blue-200';
  const accentText = segCfg?.text || 'text-blue-600';

  return (
    <section className={`${accentBg} border-t ${accentBorder}`}>
      <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold text-dark mb-1">Direkt suchen?</h3>
          <p className="text-gray-500 text-sm">Nutze die vollständige Kurssuche mit allen Filtern.</p>
        </div>
        <button
          onClick={() => {
            window.history.pushState({}, '', '/search');
            setView('search');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition shadow`}
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
  t,
}) => {
  const segmentKey = VARIANT_TO_KEY[variant] || 'privat_hobby';
  const urlSegment = VARIANT_TO_URL_SEGMENT[variant] || 'privat-hobby';
  const segCfg = SEGMENT_CONFIG[segmentKey];
  const landingCfg = SEGMENT_LANDING_CONFIG[segmentKey];

  // Fallback hero images per variant
  const heroImages = {
    prof: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=2000',
    private: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000',
    kids: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2000',
  };
  const bgImage = segCfg?.heroBg || heroImages[variant] || heroImages.prof;

  if (!landingCfg) {
    return <div className="p-8 text-center text-gray-400">Konfiguration fehlt.</div>;
  }

  return (
    <div className="min-h-screen bg-beige font-sans">
      <SegmentHero
        title={title}
        subtitle={subtitle}
        bgImage={bgImage}
        accentClass={segCfg?.text}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearchSubmit={handleSearchSubmit}
        t={t}
      />

      <KursartenSection
        kursarten={landingCfg.kursarten}
        urlSegment={urlSegment}
        setView={setView}
        segCfg={segCfg}
      />

      <ThemenSection
        themen={landingCfg.themen}
        setView={setView}
        segCfg={segCfg}
      />

      <SearchCTASection
        handleSearchSubmit={handleSearchSubmit}
        setView={setView}
        t={t}
        segCfg={segCfg}
      />
    </div>
  );
};

export default LandingView;
