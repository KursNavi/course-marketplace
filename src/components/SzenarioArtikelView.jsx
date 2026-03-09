import React, { useCallback, useEffect, useRef } from 'react';
import { ChevronRight, Clock, ArrowRight, BookOpen } from 'lucide-react';
import { BEREICH_LANDING_CONFIG, getBereichBySlug, getBereichUrl, findSzenario } from '../lib/bereichLandingConfig';
import { SZENARIO_CONTENT } from '../lib/szenarioContent';
import { SEGMENT_CONFIG } from '../lib/constants';
import { enhanceImages, estimateReadingTime } from '../lib/seoUtils';
import { BASE_URL } from '../lib/siteConfig';
import { shouldHandleClientNavigation } from '../lib/navigation';

/**
 * SzenarioArtikelView
 *
 * Renders a single scenario article page.
 * URL pattern: /bereich/{segment}/{bereich-slug}/{szenario-slug}
 */
export default function SzenarioArtikelView({ segment, slug, szenarioSlug, courses, lang = 'de', t }) {
  const bereichConfig = getBereichBySlug(segment, slug);
  const scenario = bereichConfig ? findSzenario(bereichConfig, szenarioSlug) : null;
  const theme = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.beruflich;

  // Find the bereich config key (e.g. 'sport_fitness_beruf') for content lookup
  const bereichKey = bereichConfig
    ? Object.entries(BEREICH_LANDING_CONFIG).find(([, v]) => v.slug === slug)?.[0]
    : null;

  const contentKey = bereichKey && szenarioSlug ? `${bereichKey}/${szenarioSlug}` : null;
  const articleContent = contentKey ? SZENARIO_CONTENT[contentKey] || null : null;
  const readingTime = estimateReadingTime(articleContent);
  const articleRef = useRef(null);

  const goToSearch = useCallback((extraParams = {}) => {
    if (!bereichConfig) return;
    const params = new URLSearchParams();
    params.set('type', bereichConfig.typeKey);
    params.set('area', bereichConfig.areaSlug);
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'search' }, '', '/search?' + params.toString());
  }, [bereichConfig]);

  // SEO
  useEffect(() => {
    if (!scenario || !bereichConfig) return;

    const title = `${scenario.label[lang] || scenario.label.de} — ${bereichConfig.title[lang] || bereichConfig.title.de} | KursNavi`;
    document.title = title;

    const metaDesc = scenario.text[lang] || scenario.text.de;
    let metaTag = document.querySelector('meta[name="description"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'description';
      document.head.appendChild(metaTag);
    }
    metaTag.content = metaDesc;

    const canonicalUrl = `${BASE_URL}/bereich/${segment}/${slug}/${szenarioSlug}`;
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.rel = 'canonical';
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonicalUrl;
  }, [scenario, bereichConfig, segment, slug, szenarioSlug, lang]);

  // Inject clickable buttons into .cta-box elements
  useEffect(() => {
    if (!articleRef.current || !scenario) return;
    const boxes = articleRef.current.querySelectorAll('.cta-box');
    const btns = [];
    const ctaText = scenario.ctaLabel?.[lang] || scenario.ctaLabel?.de || 'Kurse entdecken';
    boxes.forEach(box => {
      const btn = document.createElement('button');
      btn.className = 'cta-box-button';
      btn.textContent = ctaText + ' \u2192';
      btn.addEventListener('click', () => {
        sessionStorage.setItem('cv_source', `szenario-${scenario.slug}`);
        goToSearch(scenario.searchParams || {});
      });
      box.appendChild(btn);
      btns.push(btn);
    });
    return () => btns.forEach(b => b.remove());
  }, [articleContent, scenario, lang, goToSearch]);

  // 404
  if (!bereichConfig || !scenario) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-dark mb-4">Artikel nicht gefunden</h1>
          <a href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); window.scrollTo(0, 0); }} className="text-primary hover:underline">
            Zur Startseite
          </a>
        </div>
      </div>
    );
  }

  // Navigation helpers
  const goToBereich = () => {
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'bereich-landing' }, '', getBereichUrl(bereichConfig));
  };

  const goToSzenario = (scenarioSlug) => {
    window.scrollTo(0, 0);
    window.history.pushState(
      { view: 'bereich-szenario' },
      '',
      `/bereich/${segment}/${slug}/${scenarioSlug}`
    );
  };

  const segmentLabel = theme.label?.[lang] || theme.label?.de || segment;
  const bereichTitle = (bereichConfig.title[lang] || bereichConfig.title.de).split('—')[0].trim();
  const otherScenarios = (bereichConfig.scenarios || []).filter(s => s.slug !== szenarioSlug);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className={`bg-gradient-to-br ${theme.gradient} py-12`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-2 text-white/90 text-sm mb-6" aria-label="Breadcrumb">
            <a href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); window.scrollTo(0, 0); }} className="hover:text-white transition-colors">
              Home
            </a>
            <ChevronRight className="w-3 h-3" />
            <a
              href={`/search?type=${bereichConfig.typeKey}`}
              onClick={(e) => { e.preventDefault(); goToSearch(); }}
              className="hover:text-white transition-colors"
            >
              {segmentLabel}
            </a>
            <ChevronRight className="w-3 h-3" />
            <a
              href={getBereichUrl(bereichConfig)}
              onClick={(e) => { e.preventDefault(); goToBereich(); }}
              className="hover:text-white transition-colors"
            >
              {bereichTitle}
            </a>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/90">{scenario.label[lang] || scenario.label.de}</span>
          </nav>

          {/* Title */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl">{scenario.icon}</span>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white font-heading">
              {scenario.label[lang] || scenario.label.de}
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-lg text-white/90 max-w-3xl">
            {scenario.text[lang] || scenario.text.de}
          </p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm mt-4">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>Ratgeber</span>
            </div>
            {articleContent && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{readingTime} Min. Lesezeit</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          {articleContent ? (
            <div
              ref={articleRef}
              className="prose-ratgeber"
              dangerouslySetInnerHTML={{ __html: enhanceImages(articleContent) }}
            />
          ) : (
            <div className="text-center py-12">
              <div className={`w-16 h-16 ${theme.bgLight} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <BookOpen className={`w-8 h-8 ${theme.text}`} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {scenario.label[lang] || scenario.label.de}
              </h2>
              <p className="text-gray-500 mb-2 max-w-lg mx-auto">
                {scenario.text[lang] || scenario.text.de}
              </p>
              <p className={`${theme.text} font-medium mt-6`}>
                Dieser Artikel wird in Kürze verfügbar sein.
              </p>
            </div>
          )}
        </div>

        {/* Fehler-Hinweis */}
        <p className="text-center text-sm text-gray-400 mt-4 mb-2">
          Fehler gefunden? Schreibe uns unter{' '}
          <a href="mailto:info@kursnavi.ch" className="underline hover:text-gray-600 transition-colors">
            info@kursnavi.ch
          </a>{' '}
          — wir freuen uns über dein Feedback.
        </p>

        {/* CTA: Passende Kurse */}
        <div className={`${theme.bgLight} rounded-2xl p-8 text-center mt-8`}>
          <h3 className={`text-xl font-bold ${theme.text} mb-2`}>
            {scenario.ctaLabel?.[lang] || scenario.ctaLabel?.de || 'Passende Kurse finden'}
          </h3>
          <p className="text-gray-600 mb-6">
            Entdecke Kurse, die zu deiner Situation passen.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {/* Primary CTA with scenario-specific search params */}
            <button
              onClick={() => {
                sessionStorage.setItem('cv_source', `szenario-${scenario.slug}`);
                goToSearch(scenario.searchParams || {});
              }}
              className={`${theme.bgSolid} text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2`}
            >
              {scenario.ctaLabel?.[lang] || scenario.ctaLabel?.de || 'Kurse entdecken'}
              <ArrowRight className="w-5 h-5" />
            </button>
            {/* Secondary: Back to Bereich overview */}
            <button
              onClick={goToBereich}
              className={`border-2 ${theme.borderLight} ${theme.text} px-6 py-3 rounded-xl font-bold hover:shadow-md transition-all inline-flex items-center gap-2`}
            >
              Alle Bereiche ansehen
            </button>
          </div>
        </div>
      </div>

      {/* Other Scenarios */}
      {otherScenarios.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <h3 className="text-lg font-bold text-gray-700 mb-4">
            Das könnte dich auch interessieren
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherScenarios.slice(0, 6).map((s) => (
              <a
                key={s.slug}
                href={`/bereich/${segment}/${slug}/${s.slug}`}
                onClick={(e) => {
                  if (!shouldHandleClientNavigation(e)) return;
                  e.preventDefault();
                  goToSzenario(s.slug);
                }}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all group border border-gray-100 block"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{s.icon}</span>
                  <h4 className="font-bold text-gray-700 group-hover:text-primary transition-colors text-sm">
                    {s.label[lang] || s.label.de}
                  </h4>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {s.text[lang] || s.text.de}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
