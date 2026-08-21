import React, { useEffect, useMemo } from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { RATGEBER_STRUCTURE, findCategoryBySlug } from '../lib/ratgeberStructure';
import { SEGMENT_CONFIG } from '../lib/constants';
import { getRobotsPolicy } from '../lib/seoUtils';
import { CANONICAL_BASE_URL } from '../lib/siteConfig';
import { getRatgeberCategorySeo, getRatgeberRootSeo } from '../lib/ratgeberSeo';
import { shouldHandleClientNavigation } from '../lib/navigation';
import { buildEditorialReviewNotice } from '../lib/editorialReviewDate';

/**
 * Schreibt den Head genau einer Hub-Seite — und zwar durch Aktualisieren der
 * bereits vorhandenen Tags.
 *
 * Warum kein react-helmet-async mehr: dessen Client-Update greift
 * ausschliesslich auf Tags mit dem Ownership-Marker `data-rh`
 * (node_modules/react-helmet-async/lib/index.js, `updateTags`). Die vom Build
 * geschriebenen Tags tragen diesen Marker nicht, also legte Helmet nach der
 * Hydration einen ZWEITEN Satz Title/Description/Canonical/Robots/OG an — mit
 * teils abweichenden Werten. Den Prerender-Output stattdessen mit `data-rh` zu
 * markieren wäre schlimmer: Helmet entfernt beim Unmount jeden markierten Tag,
 * und beim clientseitigen Wechsel auf eine Cluster- oder Artikelseite (die
 * ihren Head selbst per DOM setzen) verschwänden Canonical und Description
 * ersatzlos.
 *
 * Dieses Upsert-Verfahren ist dasselbe, das RatgeberClusterView,
 * RatgeberArtikelView, DetailView und ProviderProfilePage bereits nutzen: ein
 * vorhandener Tag wird beschrieben, nie dupliziert. Entfernt wird beim Unmount
 * nur, was diese Seite selbst angelegt hat.
 */
function useRatgeberHubHead(seo) {
  const robots = getRobotsPolicy();

  useEffect(() => {
    const createdTags = [];

    const upsert = (selector, createTag, attribute, value) => {
      let tag = document.head.querySelector(selector);
      if (!tag) {
        tag = createTag();
        document.head.appendChild(tag);
        createdTags.push(tag);
      }
      tag.setAttribute(attribute, value);
    };

    document.title = seo.title;

    upsert(
      'meta[name="description"]',
      () => {
        const tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        return tag;
      },
      'content',
      seo.description
    );

    // Robots ist umgebungs- und nicht seitenabhängig (Preview: noindex) —
    // identisch zu DetailView/ProviderProfilePage/LandingView.
    upsert(
      'meta[name="robots"]',
      () => {
        const tag = document.createElement('meta');
        tag.setAttribute('name', 'robots');
        return tag;
      },
      'content',
      robots
    );

    upsert(
      'link[rel="canonical"]',
      () => {
        const tag = document.createElement('link');
        tag.setAttribute('rel', 'canonical');
        return tag;
      },
      'href',
      seo.canonical
    );

    const ogTags = {
      'og:title': seo.ogTitle,
      'og:description': seo.ogDescription,
      'og:url': seo.ogUrl,
      'og:image': seo.ogImage,
      'og:type': seo.ogType,
    };
    for (const [property, content] of Object.entries(ogTags)) {
      upsert(
        `meta[property="${property}"]`,
        () => {
          const tag = document.createElement('meta');
          tag.setAttribute('property', property);
          return tag;
        },
        'content',
        content
      );
    }

    return () => {
      for (const tag of createdTags) tag.remove();
    };
  }, [seo, robots]);
}

const RatgeberHubView = ({ lang = 'de' }) => {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const categorySlug = parts.length >= 2 ? parts[1] : null;
  const category = categorySlug ? findCategoryBySlug(categorySlug) : null;

  // Unbekannte Kategorie fällt weiterhin auf den Root-Hub zurück — echte
  // Server-URLs beantwortet Vercel bereits vor dem SPA mit 404 (vercel.json).
  const seo = useMemo(
    () =>
      (category && getRatgeberCategorySeo(category.slug, CANONICAL_BASE_URL)) ||
      getRatgeberRootSeo(CANONICAL_BASE_URL),
    [category]
  );
  useRatgeberHubHead(seo);

  if (!category) return <RootHub lang={lang} />;
  return <CategoryHub category={category} categorySlug={categorySlug} lang={lang} />;
};

function RootHub({ lang }) {
  const categories = Object.values(RATGEBER_STRUCTURE);
  const goToContact = () => {
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'contact' }, '', '/contact');
    window.dispatchEvent(new Event('locationchange'));
  };
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-gray-700 to-gray-900 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/60 mb-4">
            <a href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); window.scrollTo(0, 0); }} className="hover:text-white transition-colors">Home</a>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/90">Ratgeber</span>
          </nav>
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-white/80" />
            <h1 className="text-3xl md:text-4xl font-bold text-white font-heading">Ratgeber</h1>
          </div>
          <p className="text-white/80 text-lg max-w-2xl">Praxiswissen rund um Weiterbildung, Hobbys und Kinderkurse in der Schweiz.</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8">
          {categories.map((cat) => {
            const segKey = cat.slug === 'beruflich' ? 'beruflich' : cat.slug === 'privat-hobby' ? 'privat_hobby' : 'kinder_jugend';
            const config = SEGMENT_CONFIG[segKey] || SEGMENT_CONFIG.beruflich;
            const CatIcon = cat.icon;
            const clusters = Object.values(cat.clusters);
            return (
              <div key={cat.slug} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <a
                  href={`/ratgeber/${cat.slug}`}
                  onClick={(e) => {
                    if (!shouldHandleClientNavigation(e)) return;
                    e.preventDefault();
                    window.scrollTo(0, 0);
                    window.history.pushState({ view: 'ratgeber-hub' }, '', `/ratgeber/${cat.slug}`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className={`block bg-gradient-to-r ${config.gradient} p-6 group`}
                >
                  <div className="flex items-center gap-3">
                    <CatIcon className="w-7 h-7 text-white" />
                    <h2 className="text-2xl font-bold text-white font-heading">{cat.label[lang] || cat.label.de}</h2>
                    <ChevronRight className="w-5 h-5 text-white/60 ml-auto group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>
                <div className="p-6 grid sm:grid-cols-2 gap-4">
                  {clusters.map((cluster) => {
                    const ClIcon = cluster.icon;
                    return (
                      <a
                        key={cluster.slug}
                        href={`/ratgeber/${cat.slug}/${cluster.slug}`}
                        onClick={(e) => {
                          if (!shouldHandleClientNavigation(e)) return;
                          e.preventDefault();
                          window.scrollTo(0, 0);
                          window.history.pushState({ view: 'ratgeber-cluster' }, '', `/ratgeber/${cat.slug}/${cluster.slug}`);
                          window.dispatchEvent(new PopStateEvent('popstate'));
                        }}
                        className="group/card rounded-xl border border-gray-100 hover:border-gray-200 p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`${config.bgLight} w-9 h-9 rounded-lg flex items-center justify-center`}><ClIcon className={`${config.text} w-5 h-5`} /></div>
                          <h3 className="font-bold text-gray-900 group-hover/card:text-primary transition-colors">{cluster.label[lang] || cluster.label.de}</h3>
                        </div>
                        <p className="text-gray-500 text-sm line-clamp-2 ml-12">{cluster.description[lang] || cluster.description.de}</p>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-center text-sm text-gray-500 mt-8">
          <p>{buildEditorialReviewNotice(null)}</p>
          <p className="mt-2">
            Ist dir in einem Ratgeber ein Fehler oder eine veraltete Information aufgefallen? Gib uns gern kurz Bescheid.{' '}
            <a
              href="/contact"
              onClick={(e) => {
                if (!shouldHandleClientNavigation(e)) return;
                e.preventDefault();
                goToContact();
              }}
              className="text-primary font-medium underline underline-offset-2 hover:opacity-80"
            >
              Zum Kontaktformular
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function CategoryHub({ category, categorySlug, lang }) {
  const segKey = category.slug === 'beruflich' ? 'beruflich' : category.slug === 'privat-hobby' ? 'privat_hobby' : 'kinder_jugend';
  const config = SEGMENT_CONFIG[segKey] || SEGMENT_CONFIG.beruflich;
  const CatIcon = category.icon;
  const clusters = Object.values(category.clusters);
  const catLabel = category.label[lang] || category.label.de;
  const nav = (view, p) => { window.scrollTo(0,0); window.history.pushState({view},'',p); window.dispatchEvent(new PopStateEvent('popstate')); };
  const goToContact = () => {
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'contact' }, '', '/contact');
    window.dispatchEvent(new Event('locationchange'));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`bg-gradient-to-br ${config.gradient} py-16`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/60 mb-6">
            <a href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); window.scrollTo(0, 0); }} className="hover:text-white transition-colors">Home</a>
            <ChevronRight className="w-3 h-3" />
            <a href="/ratgeber" onClick={(e) => { e.preventDefault(); nav('ratgeber-hub', '/ratgeber'); }} className="hover:text-white transition-colors">Ratgeber</a>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/90">{catLabel}</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl"><CatIcon className="w-8 h-8 text-white" /></div>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-heading">Ratgeber {catLabel}</h1>
          </div>
          <p className="text-white/80 text-lg max-w-2xl">{clusters.length} Themenbereiche mit je 6 Fachartikeln.</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {clusters.map((cluster) => {
          const ClIcon = cluster.icon;
          return (
            <div key={cluster.slug} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <a
                href={`/ratgeber/${categorySlug}/${cluster.slug}`}
                onClick={(e) => {
                  if (!shouldHandleClientNavigation(e)) return;
                  e.preventDefault();
                  nav('ratgeber-cluster', `/ratgeber/${categorySlug}/${cluster.slug}`);
                }}
                className="w-full text-left p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors group"
              >
                <div className={`${config.bgLight} w-12 h-12 rounded-xl flex items-center justify-center`}><ClIcon className={`${config.text} w-6 h-6`} /></div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{cluster.label[lang] || cluster.label.de}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">{cluster.description[lang] || cluster.description.de}</p>
                </div>
                <ChevronRight className={`${config.text} w-5 h-5 flex-shrink-0`} />
              </a>
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {cluster.articles.map((article, idx) => (
                  <a
                    key={article.slug}
                    href={`/ratgeber/${categorySlug}/${cluster.slug}/${article.slug}`}
                    onClick={(e) => {
                      if (!shouldHandleClientNavigation(e)) return;
                      e.preventDefault();
                      nav('ratgeber-artikel', `/ratgeber/${categorySlug}/${cluster.slug}/${article.slug}`);
                    }}
                    className="w-full text-left px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group/item"
                  >
                    <span className={`${config.bgLight} ${config.text} w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0`}>{idx + 1}</span>
                    <span className="text-gray-700 group-hover/item:text-primary transition-colors text-sm font-medium truncate">{article.title[lang] || article.title.de}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          );
        })}
        <div className="text-center text-sm text-gray-500">
          <p>{buildEditorialReviewNotice(null)}</p>
          <p className="mt-2">
            Ist dir in einem Ratgeber ein Fehler oder eine veraltete Information aufgefallen? Gib uns gern kurz Bescheid.{' '}
            <a
              href="/contact"
              onClick={(e) => {
                if (!shouldHandleClientNavigation(e)) return;
                e.preventDefault();
                goToContact();
              }}
              className={`${config.text} font-medium underline underline-offset-2 hover:opacity-80`}
            >
              Zum Kontaktformular
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RatgeberHubView;
