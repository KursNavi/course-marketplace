import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SEGMENT_LANDING_CONFIG } from '../lib/segmentLandingConfig';
import { SEGMENT_CONFIG } from '../lib/constants';

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

function navigateTo(href, setView, viewKey) {
  window.history.pushState({}, '', href);
  setView(viewKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SegmentHero({ title, subtitle, bgImage, onExploreAll }) {
  return (
    <div className="relative overflow-hidden" style={{ minHeight: '460px' }}>
      <div className="absolute inset-0 z-0">
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/65" />
      </div>
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center text-white px-4 pt-20 pb-16 max-w-4xl mx-auto"
        style={{ minHeight: '460px' }}
      >
        <p className="text-xs font-bold tracking-widest uppercase mb-4 opacity-70">
          KursNavi · Kursguide Schweiz
        </p>
        <h1 className="text-4xl md:text-6xl font-heading font-bold mb-5 leading-tight drop-shadow-md">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-white/85 mb-8 max-w-2xl font-light leading-relaxed">
          {subtitle}
        </p>
        <button
          onClick={onExploreAll}
          className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 font-semibold px-6 py-3 rounded-full transition backdrop-blur-sm"
        >
          Alle Kurse entdecken <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TileGrid({ tiles, setView }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((tile) => {
        const targetView = tile.isThemenwelt ? 'bereich-landing' : 'thema-landing';
        return (
          <button
            key={tile.slug}
            onClick={() => navigateTo(tile.href, setView, targetView)}
            className="group relative overflow-hidden rounded-2xl cursor-pointer text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ aspectRatio: '4/3' }}
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
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/90 text-primary text-xs font-bold px-2.5 py-1 rounded-full shadow">
                <Sparkles className="w-3 h-3" /> Themenwelt
              </span>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-2xl mb-1">{tile.icon}</div>
              <h3 className="text-white font-bold text-sm leading-snug mb-0.5">{tile.label}</h3>
              <p className="text-white/70 text-xs leading-relaxed hidden sm:block">{tile.desc}</p>
              <span className="mt-1 inline-flex items-center gap-1 text-white/85 text-xs font-semibold">
                Mehr erfahren <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TopicsAndTypesSection({ kursarten, themen, setView, segCfg }) {
  const accentText = segCfg?.text || 'text-blue-600';
  const accentBorder = segCfg?.borderLight || 'border-blue-200';

  return (
    <>
      {/* Themen — zuerst */}
      <section className="max-w-7xl mx-auto px-4 pt-14 pb-6">
        <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${accentText}`}>Themenwelten</p>
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">Themen entdecken</h2>
        <p className="text-gray-500 mb-8 max-w-xl text-sm">
          Tauche tiefer in ein Thema ein – mit kuratierten Übersichten und Ratgebern.
        </p>
        <TileGrid tiles={themen} setView={setView} />
      </section>

      {/* Kursarten — danach */}
      {kursarten?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pt-4 pb-14">
          <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${accentText}`}>Kursarten</p>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">Wonach suchst du?</h2>
          <p className="text-gray-500 mb-8 max-w-xl text-sm">
            Wähle eine Kursart für eine eigene Übersichtsseite – oder scroll einfach nach unten für alle Kurse.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {kursarten.map((k) => (
              <button
                key={k.slug}
                onClick={() => navigateTo(k.href, setView, 'thema-landing')}
                className={`group text-left bg-white border ${accentBorder} rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
              >
                <div className="text-4xl mb-4">{k.icon}</div>
                <h3 className="text-lg font-bold text-dark mb-2 group-hover:text-primary transition-colors">{k.label}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{k.desc}</p>
                <span className={`inline-flex items-center gap-1 text-sm font-semibold ${accentText}`}>
                  Entdecken <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function AllCoursesSection({ setView, setSearchType, searchTypeKey }) {
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
          <h3 className="text-xl font-bold text-dark mb-1">Alle Kurse im Überblick</h3>
          <p className="text-gray-500 text-sm">Nutze die vollständige Kurssuche mit allen Filtern.</p>
        </div>
        <button
          onClick={handleGoToSearch}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition shadow"
        >
          Alle Kurse anzeigen <ArrowRight className="w-4 h-4" />
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
  setView,
  setSearchType,
}) => {
  const segmentKey = VARIANT_TO_KEY[variant] || 'privat_hobby';
  const segCfg = SEGMENT_CONFIG[segmentKey];
  const landingCfg = SEGMENT_LANDING_CONFIG[segmentKey];
  const searchTypeKey = VARIANT_TO_SEARCH_TYPE[variant] || 'privat_hobby';

  const heroImages = {
    prof: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=2000',
    private: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000',
    kids: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2000',
  };
  const bgImage = segCfg?.heroBg || heroImages[variant] || heroImages.prof;

  const handleExploreAll = () => {
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
        onExploreAll={handleExploreAll}
      />

      <TopicsAndTypesSection
        kursarten={landingCfg.kursarten}
        themen={landingCfg.themen}
        setView={setView}
        segCfg={segCfg}
      />

      <AllCoursesSection
        setView={setView}
        setSearchType={setSearchType}
        searchTypeKey={searchTypeKey}
      />
    </div>
  );
};

export default LandingView;
