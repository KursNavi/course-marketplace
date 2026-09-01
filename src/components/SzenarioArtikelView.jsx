import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Clock, ArrowRight, BookOpen } from 'lucide-react';
import { BEREICH_LANDING_CONFIG, getBereichBySlug, getBereichUrl, findSzenario } from '../lib/bereichLandingConfig';
import { SZENARIO_CONTENT } from '../lib/szenarioContent';
import { SEGMENT_CONFIG } from '../lib/constants';
import { enhanceImages, wrapTables, estimateReadingTime, buildArticleJsonLd, buildBreadcrumbJsonLd } from '../lib/seoUtils';
import { BASE_URL } from '../lib/siteConfig';
import { shouldHandleClientNavigation } from '../lib/navigation';
import { loadThemeWorldWithFallback, isThemeWorldPilotActive, isThemeWorldDbEnabled } from '../lib/themeWorldFeatureFlag';
import { fetchThemeWorld, fetchPublishedScenario } from '../lib/themeWorldService';
import { adaptToLegacyBereichConfig, adaptToLegacySzenarioConfig } from '../lib/themeWorldAdapter';
import { normalizeDeliveryTypeKey } from '../lib/courseMetadata';
import { toDisplaySources } from '../lib/scenarioSources';
import { buildEditorialReviewNotice } from '../lib/editorialReviewDate';

/**
 * SzenarioArtikelView
 *
 * Renders a single scenario article page.
 * URL pattern: /bereich/{segment}/{bereich-slug}/{szenario-slug}
 *
 * Phase 5: Pilot-Integration hinter Feature-Flag.
 * Wenn VITE_THEME_WORLD_DB_ENABLED=true und der Key in VITE_THEME_WORLD_PILOT_KEYS,
 * werden Daten aus der DB geladen; sonst unverändert Legacy-Betrieb.
 */
export default function SzenarioArtikelView({ segment, slug, szenarioSlug, courses, lang = 'de', t }) {
  // Legacy-Config (immer geladen als Basiswert + Fallback)
  const legacyBereichConfig = getBereichBySlug(segment, slug);
  const legacyScenario = legacyBereichConfig ? findSzenario(legacyBereichConfig, szenarioSlug) : null;

  // Dynamic state
  const [dynamicBereichConfig, setDynamicBereichConfig] = useState(null);
  const [dynamicScenario, setDynamicScenario] = useState(null);
  const [dynamicArticleContent, setDynamicArticleContent] = useState(null);
  const [dynamicNotFound, setDynamicNotFound] = useState(false);
  // DB-only mode: kein Legacy-Eintrag vorhanden, aber DB global aktiv → Ladeindikator bis Antwort
  const [dbOnlyLoading, setDbOnlyLoading] = useState(() => !legacyBereichConfig && isThemeWorldDbEnabled());

  // Effective values: DB wenn geladen, sonst Legacy
  const bereichConfig = dynamicBereichConfig || legacyBereichConfig;
  const scenario = dynamicScenario || legacyScenario;

  // Normalize URL segment (privat-hobby → privat_hobby) for SEGMENT_CONFIG lookup
  const segmentKey = segment?.replace(/-/g, '_') || segment;
  const theme = SEGMENT_CONFIG[segmentKey] || SEGMENT_CONFIG.beruflich;

  // Legacy content lookup
  const bereichKey = legacyBereichConfig
    ? Object.entries(BEREICH_LANDING_CONFIG).find(([, v]) => v.slug === slug)?.[0]
    : null;
  const contentKey = bereichKey && szenarioSlug ? `${bereichKey}/${szenarioSlug}` : null;
  const legacyArticleContent = contentKey ? SZENARIO_CONTENT[contentKey] || null : null;

  // Effective article content
  const articleContent = dynamicArticleContent !== null ? dynamicArticleContent : legacyArticleContent;

  const readingTime = estimateReadingTime(articleContent);
  const articleRef = useRef(null);

  // Pilot-Integration: DB-Daten laden wenn Feature-Flag aktiv
  useEffect(() => {
    let cancelled = false;

    // DB-only-Modus: Themenwelt existiert nur in der DB, kein Legacy-Eintrag
    // → direkt laden ohne Pilot-Key-Prüfung (keine Legacy-Einschränkung nötig)
    if (!legacyBereichConfig && isThemeWorldDbEnabled()) {
      (async () => {
        try {
          const tw = await fetchThemeWorld(segment, slug);
          if (cancelled) return;

          const sc = tw.search_config || {};
          setDynamicBereichConfig({
            slug: tw.slug,
            segment: tw.url_segment,
            typeKey: tw.url_segment?.replace(/-/g, '_') || 'beruflich',
            areaSlug: sc.area_slug ?? tw.area_slug ?? null,
            kursart: sc.kursart || null,
            title: { de: tw.title_de || '' },
            scenarios: [],
          });

          try {
            const scenarioData = await fetchPublishedScenario(tw.id, szenarioSlug);
            if (!cancelled && scenarioData) {
              setDynamicScenario(adaptToLegacySzenarioConfig(scenarioData, sc));
              setDynamicArticleContent(scenarioData.content_html || '');
            }
          } catch (sErr) {
            if (!cancelled) {
              setDynamicNotFound(true);
            }
          }
        } catch (err) {
          if (!cancelled) {
            setDynamicNotFound(true);
          }
        } finally {
          if (!cancelled) setDbOnlyLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }

    // Pilot-Modus: Legacy-Eintrag vorhanden, Pilot-Flag steuert DB-Upgrade
    if (!bereichKey) return;
    if (!isThemeWorldPilotActive(bereichKey)) return;

    (async () => {
      try {
        // Themenwelt-Hauptdaten laden (für Kontext + bereichConfig)
        const twResult = await loadThemeWorldWithFallback({
          themeWorldKey: bereichKey,
          dbLoader: async () => {
            const tw = await fetchThemeWorld(segment, slug);
            return tw;
          },
          legacyLoader: () => legacyBereichConfig,
        });

        if (cancelled) return;

        if (twResult.notFound) {
          setDynamicNotFound(true);
          return;
        }

        if (twResult.source === 'db' && twResult.data) {
          // Minimalform für bereichConfig — nur die Felder die SzenarioArtikelView braucht
          const tw = twResult.data;
          const sc = tw.search_config || {};
          setDynamicBereichConfig({
            slug: tw.slug,
            segment: tw.url_segment,
            typeKey: tw.url_segment?.replace(/-/g, '_') || 'beruflich',
            areaSlug: sc.area_slug ?? tw.area_slug ?? null,
            kursart: sc.kursart || null,
            title: { de: tw.title_de || '' },
            scenarios: [], // Vollständige Szenario-Liste nicht nötig für Artikelansicht
          });

          // Szenario-Artikel laden
          try {
            const scenarioData = await fetchPublishedScenario(tw.id, szenarioSlug);
            if (!cancelled && scenarioData) {
              setDynamicScenario(adaptToLegacySzenarioConfig(scenarioData, sc));
              setDynamicArticleContent(scenarioData.content_html || '');
            }
          } catch (sErr) {
            if (!cancelled) {
              // Szenario nicht gefunden oder DB-Fehler → Legacy-Fallback
              if (sErr.name === 'ThemeWorldNotFoundError') {
                setDynamicNotFound(true);
              }
              // Bei DB-Fehler: Legacy-Szenario bleibt aktiv (dynamicScenario bleibt null)
            }
          }
        }
      } catch (err) {
        // Unerwarteter Fehler → Legacy bleibt aktiv (kein setState nötig)
        if (import.meta.env.DEV) {
          console.warn(
            '[SzenarioArtikelView] Pilot-Ladevorgang fehlgeschlagen, Legacy-Fallback aktiv:',
            err?.message,
          );
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bereichKey, segment, slug, szenarioSlug]);

  const goToSearch = useCallback((extraParams = {}) => {
    if (!bereichConfig) return;
    const params = new URLSearchParams();
    params.set('type', bereichConfig.typeKey);
    if (bereichConfig.areaSlug) params.set('area', bereichConfig.areaSlug);
    if (bereichConfig.kursart) params.set('kursart', bereichConfig.kursart);
    Object.entries(extraParams).forEach(([k, v]) => {
      if (!v) return;
      // Kanonisiere Delivery-Werte beim URL-Aufbau
      if (k === 'delivery') {
        const canonical = normalizeDeliveryTypeKey(v);
        if (canonical) params.set(k, canonical);
      } else {
        params.set(k, v);
      }
    });
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'search' }, '', '/search?' + params.toString());
  }, [bereichConfig]);

  // SEO
  useEffect(() => {
    if (!scenario || !bereichConfig) return;

    // Redaktionelle SEO-Felder (meta_title/meta_description) sind die erste
    // Quelle — identisch zum Server-Prerender (api/_lib/theme-world-prerender.js).
    // Legacy-Szenarien haben diese Felder nicht: dort greifen wie bisher Label
    // und Teaser.
    const pageTitle = scenario.metaTitle
      || `${scenario.label[lang] || scenario.label.de} — ${bereichConfig.title[lang] || bereichConfig.title.de} | KursNavi`;
    document.title = pageTitle;

    const metaDesc = scenario.metaDescription || scenario.text[lang] || scenario.text.de;
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

    // OG Tags
    const ogTags = {
      'og:title': pageTitle,
      'og:description': metaDesc,
      'og:url': canonicalUrl,
      'og:image': scenario.ogImageUrl || `${BASE_URL}/og-default.png`,
      'og:type': 'article',
      'og:locale': 'de_CH',
      'og:site_name': 'KursNavi'
    };
    const createdOgTags = [];
    Object.entries(ogTags).forEach(([property, content]) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
        createdOgTags.push(tag);
      }
      tag.content = content;
    });

    // og:image:alt nur ausgeben, wenn ein redaktioneller Alt-Text vorhanden ist.
    const ogAltProperty = 'og:image:alt';
    let ogAltTag = document.querySelector(`meta[property="${ogAltProperty}"]`);
    if (scenario.ogImageAlt) {
      if (!ogAltTag) {
        ogAltTag = document.createElement('meta');
        ogAltTag.setAttribute('property', ogAltProperty);
        document.head.appendChild(ogAltTag);
        createdOgTags.push(ogAltTag);
      }
      ogAltTag.content = scenario.ogImageAlt;
    } else if (ogAltTag) {
      ogAltTag.remove();
    }

    // Article JSON-LD
    const segmentLabel = SEGMENT_CONFIG[segmentKey]?.label?.[lang] || SEGMENT_CONFIG[segmentKey]?.label?.de || segment;
    const bereichTitle = bereichConfig.title[lang] || bereichConfig.title.de;
    // Datumsfelder ausschliesslich aus echten DB-Werten — identisch zum
    // Prerender (api/_lib/theme-world-prerender.js). Legacy-Szenarien haben
    // diese Felder nicht; dann entfällt datePublished/dateModified komplett,
    // statt das heutige Datum zu erfinden.
    const articleData = buildArticleJsonLd({
      title: scenario.label[lang] || scenario.label.de,
      description: metaDesc,
      url: canonicalUrl,
      datePublished: scenario.publishedAt,
      dateModified: scenario.lastReviewedAt
    });
    // Vom Build injizierte JSON-LD-Blöcke entfernen — sie werden gleich durch
    // die identisch berechneten Laufzeit-Blöcke ersetzt statt dupliziert.
    document
      .querySelectorAll('script[type="application/ld+json"][data-prerender-jsonld]')
      .forEach((tag) => tag.remove());
    const articleScript = document.createElement('script');
    articleScript.type = 'application/ld+json';
    articleScript.setAttribute('data-schema', 'szenario-article');
    articleScript.text = JSON.stringify(articleData);
    document.head.appendChild(articleScript);

    // BreadcrumbList JSON-LD
    const bereichUrl = `${BASE_URL}/bereich/${segment}/${slug}`;
    const breadcrumbData = buildBreadcrumbJsonLd([
      { name: 'Home', url: BASE_URL },
      { name: segmentLabel, url: `${BASE_URL}/search?type=${bereichConfig.typeKey}` },
      { name: bereichTitle, url: bereichUrl },
      { name: scenario.label[lang] || scenario.label.de, url: canonicalUrl }
    ]);
    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.setAttribute('data-schema', 'szenario-breadcrumb');
    breadcrumbScript.text = JSON.stringify(breadcrumbData);
    document.head.appendChild(breadcrumbScript);

    return () => {
      createdOgTags.forEach(tag => tag.remove());
      if (articleScript.parentNode) articleScript.remove();
      if (breadcrumbScript.parentNode) breadcrumbScript.remove();
    };
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

  // DB-only Ladeindikator — verhindert vorzeitigen 404 während DB-Abfrage läuft
  if (dbOnlyLoading) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center">
        <div className="text-center text-muted">Wird geladen…</div>
      </div>
    );
  }

  // 404 — auch für DB-Not-found
  if (!bereichConfig || !scenario || dynamicNotFound) {
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

  const goToContact = () => {
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'contact' }, '', '/contact');
    window.dispatchEvent(new Event('locationchange'));
  };

  // Quellenangaben — EIN Pfad für DB und Legacy.
  //
  // DB-Szenarien haben ihre Quellen bereits im Adapter normalisiert; Legacy-
  // Szenarien tragen sie (falls überhaupt) roh im Config-Objekt. Beide laufen
  // hier durch dieselbe Funktion, damit der Renderblock unten keine Ahnung
  // davon haben muss, woher der Artikel stammt. Doppeltes Normalisieren ist
  // gefahrlos — die Funktion ist idempotent.
  //
  // Deploy-Lifecycle: `sources` sind reiner Client-Content. Sie werden bei
  // jedem Seitenaufruf frisch aus der DB geladen (fetchPublishedScenario), sind
  // also unmittelbar nach dem Speichern im Admin öffentlich sichtbar. Der
  // statische Prerender enthält sie nicht und kann durch eine Quellenänderung
  // deshalb auch nicht veralten.
  const displaySources = toDisplaySources(scenario.sources);

  // Redaktioneller Prüfhinweis: nur aus echtem last_reviewed_at, nie aus
  // Build-, System- oder Git-Zeit. Ohne Wert entfällt der Prüfsatz komplett.
  const editorialNotice = buildEditorialReviewNotice(scenario.lastReviewedAt);

  const segmentLabel = theme.label?.[lang] || theme.label?.de || segment;
  const bereichTitle = (bereichConfig.title[lang] || bereichConfig.title.de).split('—')[0].trim();
  // Für "Andere Szenarien"-Navigation: Legacy-Config nutzen (immer vollständig)
  const scenariosForNav = legacyBereichConfig?.scenarios || bereichConfig.scenarios || [];
  const otherScenarios = scenariosForNav.filter(s => s.slug !== szenarioSlug);

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
              dangerouslySetInnerHTML={{ __html: wrapTables(enhanceImages(articleContent)) }}
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

        {/* Quellen & weiterführende Informationen — nur bei echten Quellen */}
        <SourcesSection sources={displaySources} />

        <div className="text-center text-sm text-gray-500 mt-4 mb-2">
          <p>{editorialNotice}</p>
          <p className="mt-2">
            Wenn dir in dieser Themenwelt ein Fehler oder eine veraltete Information auffällt, gib uns gern kurz Bescheid.{' '}
            <a
              href="/contact"
              onClick={(e) => {
                if (!shouldHandleClientNavigation(e)) return;
                e.preventDefault();
                goToContact();
              }}
              className={`${theme.text} font-medium underline underline-offset-2 hover:opacity-80`}
            >
              Zum Kontaktformular
            </a>
          </p>
        </div>

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

/**
 * «Quellen & weiterführende Informationen»
 *
 * Ohne gültige Quelle wird NICHTS gerendert — keine leere Überschrift, kein
 * leerer Rahmen. Die Prüfung passiert hier und nicht beim Aufrufer, damit es
 * nur eine Stelle gibt, die über die Sichtbarkeit des Blocks entscheidet.
 *
 * Gestaltung bewusst ruhig: eine nummerierte Liste in derselben Kartenoptik wie
 * der Artikel, kein zusätzlicher CTA, keine Signalfarben. Quellen sind ein
 * Vertrauensbeleg, kein Handlungsaufruf.
 *
 * @param {object} props
 * @param {Array<{title: string, publisher: string, url: string}>} props.sources
 *        Bereits normalisiert (toDisplaySources) — hier findet keine
 *        Validierung mehr statt.
 */
function SourcesSection({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <section
      aria-labelledby="szenario-quellen-heading"
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mt-6"
    >
      <h2
        id="szenario-quellen-heading"
        className="text-base font-bold text-gray-800 mb-4"
      >
        Quellen &amp; weiterführende Informationen
      </h2>
      <ol className="space-y-4 list-decimal list-outside pl-5 marker:text-gray-400 marker:text-sm">
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`} className="text-sm leading-relaxed pl-1">
            {/* Herausgeber zuerst und optisch zurückgenommen: er ordnet die
                Quelle ein, der anklickbare Titel bleibt das Hauptelement. */}
            <span className="block text-gray-500 break-words">{source.publisher}</span>
            <a
              href={source.url}
              target="_blank"
              // noopener schliesst den window.opener-Zugriff der Zielseite aus,
              // noreferrer verhindert zusätzlich die Referrer-Weitergabe.
              //
              // Bewusst OHNE nofollow: das ist kein Werbe-, User-Generated- oder
              // ungeprüfter Fremdlink, sondern eine von der Redaktion
              // ausgewählte Quelle, die den Artikel fachlich stützt. Solche
              // Belege sollen normale crawlbare externe Links sein.
              rel="noopener noreferrer"
              className="text-primary font-medium underline underline-offset-2 hover:opacity-80 break-words"
            >
              {source.title}
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
