import React, { useEffect, useState } from 'react';
import { Search, ArrowRight, ChevronDown, ChevronRight, BookOpen, Award, HelpCircle } from 'lucide-react';
import { getBereichBySlug, getBereichUrl } from '../lib/bereichLandingConfig';
import { SEGMENT_CONFIG } from '../lib/constants';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { BASE_URL } from '../lib/siteConfig';

export default function BereichLandingPage({ segment, slug, courses, lang = 'de', t }) {
  const config = getBereichBySlug(segment, slug);
  const { areas: dbAreas } = useTaxonomy();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  // Segment theme
  const theme = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.beruflich;

  // SEO Meta Tags
  useEffect(() => {
    if (!config) return;

    const title = `${config.title[lang] || config.title.de} | KursNavi`;
    document.title = title;

    const metaDesc = config.subtitle[lang] || config.subtitle.de;
    let metaTag = document.querySelector('meta[name="description"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'description';
      document.head.appendChild(metaTag);
    }
    metaTag.content = metaDesc;

    // Canonical
    const canonicalUrl = `${BASE_URL}/bereich/${segment}/${slug}`;
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.rel = 'canonical';
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonicalUrl;

    // BreadcrumbList Schema
    const segmentLabel = theme.label?.[lang] || theme.label?.de || segment;
    const areaLabel = config.title[lang] || config.title.de;

    const breadcrumbData = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
        { "@type": "ListItem", "position": 2, "name": segmentLabel, "item": `${BASE_URL}/search?type=${config.typeKey}` },
        { "@type": "ListItem", "position": 3, "name": areaLabel, "item": canonicalUrl }
      ]
    };

    let breadcrumbScript = document.querySelector('script[data-schema="bereich-breadcrumb"]');
    if (!breadcrumbScript) {
      breadcrumbScript = document.createElement('script');
      breadcrumbScript.type = 'application/ld+json';
      breadcrumbScript.setAttribute('data-schema', 'bereich-breadcrumb');
      document.head.appendChild(breadcrumbScript);
    }
    breadcrumbScript.text = JSON.stringify(breadcrumbData);

    return () => {
      const script = document.querySelector('script[data-schema="bereich-breadcrumb"]');
      if (script) script.remove();
    };
  }, [config, segment, slug, lang]);

  // 404 guard
  if (!config) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-dark mb-4">Bereich nicht gefunden</h1>
          <a href="/" className="text-primary hover:underline">Zur Startseite</a>
        </div>
      </div>
    );
  }

  // DB type mapping
  const TYPE_TO_DB = {
    beruflich: 'professionell', privat_hobby: 'privat', kinder_jugend: 'kinder'
  };
  const dbType = TYPE_TO_DB[config.typeKey] || config.typeKey;

  // Count courses per specialty (L3)
  const getSpecialtyCounts = () => {
    const counts = {};
    if (!courses) return counts;
    courses.forEach(c => {
      if (c.status !== 'published' && c.status) return;
      (c.all_categories || []).forEach(cat => {
        if (cat.category_type === dbType && cat.category_area === config.areaSlug) {
          const specLabel = cat.category_specialty_label || cat.category_specialty;
          if (specLabel) {
            counts[specLabel] = (counts[specLabel] || 0) + 1;
          }
        }
      });
    });
    return counts;
  };

  // Get L4 focuses for a given specialty
  const getFocusesForSpecialty = (specLabel) => {
    const focuses = new Set();
    if (!courses) return [];
    courses.forEach(c => {
      if (c.status !== 'published' && c.status) return;
      (c.all_categories || []).forEach(cat => {
        if (cat.category_type === dbType && cat.category_area === config.areaSlug &&
            (cat.category_specialty_label === specLabel || cat.category_specialty === specLabel) &&
            cat.category_focus_label) {
          focuses.add(cat.category_focus_label);
        }
      });
    });
    return [...focuses].sort((a, b) => a.localeCompare(b, 'de'));
  };

  const specialtyCounts = getSpecialtyCounts();
  const totalCourses = Object.values(specialtyCounts).reduce((sum, n) => sum + n, 0);

  // Navigation helpers
  const navigateToSearch = (extraParams = {}) => {
    const params = new URLSearchParams();
    params.set('type', config.typeKey);
    params.set('area', config.areaSlug);
    if (searchQuery) params.set('q', searchQuery);
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    window.history.pushState({ view: 'search' }, '', '/search?' + params.toString());
    window.scrollTo(0, 0);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    navigateToSearch();
  };

  const handleSpecialtyClick = (specLabel) => {
    navigateToSearch({ spec: specLabel });
  };

  const handlePredefinedSearch = (search) => {
    const allParams = { ...search.params, ...(search.extraParams || {}) };
    navigateToSearch(allParams);
  };

  const segmentLabel = theme.label?.[lang] || theme.label?.de || segment;

  return (
    <div className="min-h-screen bg-beige font-sans">

      {/* HERO SECTION */}
      <div className="relative py-20 md:py-28 px-4 text-white overflow-hidden" style={{ backgroundColor: '#2d2d2d' }}>
        <div className="absolute inset-0 z-0">
          <img
            src={config.heroImage}
            alt={config.title[lang] || config.title.de}
            className="w-full h-full object-cover"
            onError={(e) => e.target.style.display = 'none'}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-white/60 mb-8">
            <a href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); window.scrollTo(0,0); }} className="hover:text-white transition-colors">Home</a>
            <ChevronRight className="w-3 h-3" />
            <a
              href={`/search?type=${config.typeKey}`}
              onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', `/search?type=${config.typeKey}`); window.scrollTo(0,0); }}
              className="hover:text-white transition-colors"
            >
              {segmentLabel}
            </a>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/90">{config.title[lang] || config.title.de}</span>
          </nav>

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4 drop-shadow-md">
            {config.title[lang] || config.title.de}
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-3xl font-light">
            {config.subtitle[lang] || config.subtitle.de}
          </p>

          {/* Scenario Tags */}
          {config.scenarios && (
            <div className="flex flex-wrap gap-2 mb-10">
              {config.scenarios.map((scenario, i) => (
                <a
                  key={scenario.slug || i}
                  href={`/bereich/${segment}/${slug}/${scenario.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo(0, 0);
                    window.history.pushState({ view: 'bereich-szenario' }, '', `/bereich/${segment}/${slug}/${scenario.slug}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-white/90 hover:bg-white/25 hover:border-white/40 transition-colors"
                  title={scenario.text[lang] || scenario.text.de}
                >
                  <span>{scenario.icon}</span>
                  <span>{scenario.label[lang] || scenario.label.de}</span>
                </a>
              ))}
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl relative">
            <div className="relative flex items-center">
              <Search className="absolute left-4 text-gray-400 w-5 h-5 z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t?.search_placeholder || 'Kurs suchen...'}
                className="w-full pl-12 pr-32 py-4 rounded-xl text-dark font-sans shadow-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg bg-white"
              />
              <button
                type="submit"
                className="absolute right-2 bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition-colors"
              >
                {t?.btn_search || 'Suchen'}
              </button>
            </div>
            {totalCourses > 0 && (
              <p className="text-sm text-white/60 mt-2 ml-1">{totalCourses} Kurse in diesem Bereich</p>
            )}
          </form>
        </div>
      </div>

      {/* SCENARIO DETAIL SECTION */}
      {config.scenarios && (
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-heading font-bold text-dark mb-2 text-center">Wo stehst du?</h2>
          <p className="text-gray-500 text-center mb-10">Finde den passenden Einstieg — egal ob Anfänger oder Profi</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {config.scenarios.map((scenario, i) => (
              <a
                key={scenario.slug || i}
                href={`/bereich/${segment}/${slug}/${scenario.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo(0, 0);
                  window.history.pushState({ view: 'bereich-szenario' }, '', `/bereich/${segment}/${slug}/${scenario.slug}`);
                }}
                className="relative p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group block"
              >
                {/* Icon */}
                <div className={`w-14 h-14 ${theme.bgLight} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300`}>
                  <span className="text-3xl">{scenario.icon}</span>
                </div>

                {/* Title */}
                <h3 className={`font-bold text-base ${theme.text} mb-2 leading-snug`}>
                  {scenario.label[lang] || scenario.label.de}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-4">
                  {scenario.text[lang] || scenario.text.de}
                </p>

                {/* Always-visible CTA */}
                <div className={`flex items-center gap-1 text-xs font-semibold ${theme.text} group-hover:gap-2 transition-all duration-200`}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Ratgeber lesen</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* PFADFINDER-BUTTONS (Specialty Cards) */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-heading font-bold text-dark mb-2 text-center">Ausbildungsbereiche</h2>
          <p className="text-gray-500 text-center mb-10">Wähle deinen Schwerpunkt</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(config.specialtyDescriptions).map(([specLabel, specConfig]) => {
              const count = specialtyCounts[specLabel] || 0;
              const focuses = getFocusesForSpecialty(specLabel);

              return (
                <div
                  key={specLabel}
                  onClick={() => handleSpecialtyClick(specLabel)}
                  className="bg-beige p-6 rounded-xl border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{specConfig.icon}</span>
                    {count > 0 && (
                      <span className={`text-xs font-bold ${theme.text} ${theme.bgLight} px-2 py-1 rounded-full`}>
                        {count} {count === 1 ? 'Kurs' : 'Kurse'}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-dark group-hover:text-primary transition-colors mb-2 text-sm leading-tight">
                    {specLabel}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    {specConfig[lang] || specConfig.de}
                  </p>
                  {/* L4 Focus Tags */}
                  {focuses.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {focuses.slice(0, 3).map(f => (
                        <span key={f} className="text-[10px] bg-white text-gray-500 px-2 py-0.5 rounded border border-gray-100">
                          {f}
                        </span>
                      ))}
                      {focuses.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{focuses.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Kurse anzeigen <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CLUSTER-BESCHREIBUNGEN */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-heading font-bold text-dark mb-10 text-center">Im Detail</h2>
        <div className="space-y-8">
          {Object.entries(config.specialtyDescriptions).map(([specLabel, specConfig]) => {
            const count = specialtyCounts[specLabel] || 0;
            return (
              <div key={specLabel} className="flex flex-col md:flex-row md:items-center gap-4 p-6 bg-white rounded-xl border border-gray-100">
                <span className="text-4xl flex-shrink-0">{specConfig.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-dark text-lg mb-1">{specLabel}</h3>
                  <p className="text-gray-600 text-sm">{specConfig[lang] || specConfig.de}</p>
                </div>
                <button
                  onClick={() => handleSpecialtyClick(specLabel)}
                  className={`flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${theme.bgSolid} text-white hover:opacity-90`}
                >
                  {count > 0 ? `${count} Kurse` : 'Kurse anzeigen'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* VORDEFINIERTE SUCHLINKS */}
      {config.predefinedSearches && (
        <div className="bg-white py-16">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-heading font-bold text-dark mb-2 text-center">Beliebte Suchen</h2>
            <p className="text-gray-500 text-center mb-8">Schnelleinstieg zu den gefragtesten Ausbildungen</p>
            <div className="flex flex-wrap justify-center gap-3">
              {config.predefinedSearches.map((search, i) => (
                <button
                  key={i}
                  onClick={() => handlePredefinedSearch(search)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 ${theme.borderLight} ${theme.bgLight} ${theme.text} font-medium text-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
                >
                  <Search className="w-3.5 h-3.5" />
                  {search.label[lang] || search.label.de}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAQ SECTION */}
      {config.faqs && config.faqs.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="flex items-center justify-center gap-2 mb-8">
            <HelpCircle className={`w-6 h-6 ${theme.text}`} />
            <h2 className="text-2xl font-heading font-bold text-dark">Häufige Fragen</h2>
          </div>
          <div className="space-y-3">
            {config.faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-dark text-sm pr-4">{faq.q[lang] || faq.q.de}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                    {faq.a[lang] || faq.a.de}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRUST SECTION */}
      {config.trustLogos && config.trustLogos.length > 0 && (
        <div className="bg-white py-16">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-center gap-2 mb-8">
              <Award className={`w-6 h-6 ${theme.text}`} />
              <h2 className="text-2xl font-heading font-bold text-dark">Qualität & Anerkennung</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {config.trustLogos.map((logo, i) => (
                <div key={i} className={`text-center p-6 rounded-xl ${theme.bgLight} border ${theme.borderLight}`}>
                  <div className={`w-12 h-12 rounded-full ${theme.bgSolid} text-white flex items-center justify-center mx-auto mb-3`}>
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-dark mb-2">{logo.name}</h3>
                  <p className="text-sm text-gray-600">{logo.description[lang] || logo.description.de}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CTA FOOTER */}
      <div className={`py-12 ${theme.bgLight}`}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-xl font-heading font-bold text-dark mb-3">Bereit für den nächsten Schritt?</h2>
          <p className="text-gray-600 mb-6">Entdecke alle {totalCourses} Kurse in diesem Bereich.</p>
          <button
            onClick={() => navigateToSearch()}
            className={`inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold text-white ${theme.bgSolid} hover:opacity-90 transition-opacity shadow-lg`}
          >
            Alle Kurse anzeigen
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
