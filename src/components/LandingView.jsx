import React from 'react';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
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

function TopicsAndTypesSection({ themen, setView, segCfg }) {
  const accentText = segCfg?.text || 'text-blue-600';

  return (
    <section className="max-w-7xl mx-auto px-4 pt-16 pb-12">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold tracking-widest uppercase ${accentText}`}>Kursthemen</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-heading font-bold text-dark mb-2">Themen entdecken</h2>
      <p className="text-gray-500 mb-6 max-w-xl">Tauche tiefer ein – mit kuratierten Themenwelten und Orientierungsseiten.</p>
      <TileGrid tiles={themen} setView={setView} />
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
  t,
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

      <TopicsAndTypesSection
        themen={landingCfg.themen}
        setView={setView}
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
