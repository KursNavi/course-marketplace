import React from 'react';
import { ArrowLeft, ChevronRight, BookOpen, Clock, Share2 } from 'lucide-react';
import { findArticle, RATGEBER_STRUCTURE } from '../lib/ratgeberStructure';
import { SEGMENT_CONFIG } from '../lib/constants';
import { RATGEBER_CONTENT } from '../lib/ratgeberContent';

/**
 * RatgeberArtikelView
 *
 * Displays a single article page.
 * URL pattern: /ratgeber/{category}/{cluster}/{article}
 */
const RatgeberArtikelView = ({ lang = 'de' }) => {
  // Parse URL to get slugs
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const categorySlug = parts[1];
  const clusterSlug = parts[2];
  const articleSlug = parts[3];

  // Find article data
  const articleData = findArticle(categorySlug, clusterSlug, articleSlug);

  if (!articleData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Artikel nicht gefunden</h1>
          <button
            onClick={() => {
              window.scrollTo(0, 0);
              window.history.pushState({ view: 'home' }, '', '/');
            }}
            className="text-primary hover:underline"
          >
            Zurück zur Startseite
          </button>
        </div>
      </div>
    );
  }

  const { cluster, category } = articleData;

  // Get segment config for styling
  const segmentKey = category.slug === 'beruflich' ? 'beruflich' :
                     category.slug === 'privat-hobby' ? 'privat_hobby' :
                     'kinder_jugend';
  const config = SEGMENT_CONFIG[segmentKey] || SEGMENT_CONFIG.beruflich;
  const ClusterIcon = cluster.icon;

  // Navigation
  const goToCluster = () => {
    window.scrollTo(0, 0);
    window.history.pushState(
      { view: 'ratgeber-cluster' },
      '',
      `/ratgeber/${categorySlug}/${clusterSlug}`
    );
  };

  const goToSearch = () => {
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'search' }, '', `/search?type=${segmentKey}`);
  };

  // Find current article index and siblings
  const currentIndex = cluster.articles.findIndex(a => a.slug === articleSlug);
  const prevArticle = currentIndex > 0 ? cluster.articles[currentIndex - 1] : null;
  const nextArticle = currentIndex < cluster.articles.length - 1 ? cluster.articles[currentIndex + 1] : null;

  const goToArticle = (slug) => {
    window.scrollTo(0, 0);
    window.history.pushState(
      { view: 'ratgeber-artikel' },
      '',
      `/ratgeber/${categorySlug}/${clusterSlug}/${slug}`
    );
  };

  // Translations
  const t = {
    backTo: {
      de: 'Zurück zu',
      en: 'Back to',
      fr: 'Retour à',
      it: 'Torna a'
    },
    readingTime: {
      de: 'Lesezeit',
      en: 'Reading time',
      fr: 'Temps de lecture',
      it: 'Tempo di lettura'
    },
    minutes: {
      de: 'Min.',
      en: 'min',
      fr: 'min',
      it: 'min'
    },
    comingSoon: {
      de: 'Dieser Artikel wird in Kürze verfügbar sein.',
      en: 'This article will be available soon.',
      fr: 'Cet article sera bientôt disponible.',
      it: 'Questo articolo sarà presto disponibile.'
    },
    moreInCluster: {
      de: 'Weitere Artikel in diesem Bereich',
      en: 'More articles in this section',
      fr: 'Plus d\'articles dans cette section',
      it: 'Altri articoli in questa sezione'
    },
    findCourses: {
      de: 'Passende Kurse finden',
      en: 'Find matching courses',
      fr: 'Trouver des cours correspondants',
      it: 'Trova corsi corrispondenti'
    },
    prevArticle: {
      de: 'Vorheriger Artikel',
      en: 'Previous article',
      fr: 'Article précédent',
      it: 'Articolo precedente'
    },
    nextArticle: {
      de: 'Nächster Artikel',
      en: 'Next article',
      fr: 'Article suivant',
      it: 'Articolo successivo'
    }
  };

  // Get article content from ratgeberContent.js
  const contentKey = `${categorySlug}/${clusterSlug}/${articleSlug}`;
  const articleContent = RATGEBER_CONTENT[contentKey] || null;

  // Check if article has content
  const hasContent = articleContent !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className={`bg-gradient-to-br ${config.gradient} py-12`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-2 text-white/70 text-sm mb-6">
            <button onClick={goToSearch} className="hover:text-white transition-colors">
              {category.label[lang] || category.label.de}
            </button>
            <ChevronRight className="w-4 h-4" />
            <button onClick={goToCluster} className="hover:text-white transition-colors">
              {cluster.label[lang] || cluster.label.de}
            </button>
          </div>

          {/* Article Title */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white font-heading mb-4">
            {articleData.title[lang] || articleData.title.de}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
            <div className="flex items-center gap-1.5">
              <ClusterIcon className="w-4 h-4" />
              <span>{cluster.label[lang] || cluster.label.de}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>5-7 {t.minutes[lang] || t.minutes.de} {t.readingTime[lang] || t.readingTime.de}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          {hasContent ? (
            // Render actual content (HTML from ratgeberContent.js)
            <div
              className="prose prose-lg max-w-none prose-headings:font-heading prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-primary prose-table:border-collapse prose-th:bg-gray-100 prose-th:p-3 prose-th:text-left prose-td:p-3 prose-td:border prose-td:border-gray-200"
              dangerouslySetInnerHTML={{ __html: articleContent }}
            />
          ) : (
            // Placeholder for articles without content
            <div className="text-center py-12">
              <div className={`w-16 h-16 ${config.bgLight} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <BookOpen className={`w-8 h-8 ${config.text}`} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {articleData.title[lang] || articleData.title.de}
              </h2>
              <p className="text-gray-500 mb-2 max-w-lg mx-auto">
                {articleData.teaser[lang] || articleData.teaser.de}
              </p>
              <p className={`${config.text} font-medium mt-6`}>
                {t.comingSoon[lang] || t.comingSoon.de}
              </p>
            </div>
          )}
        </div>

        {/* Article Navigation */}
        <div className="grid md:grid-cols-2 gap-4 mt-8">
          {prevArticle ? (
            <button
              onClick={() => goToArticle(prevArticle.slug)}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all text-left group border border-gray-100"
            >
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {t.prevArticle[lang] || t.prevArticle.de}
              </span>
              <p className="font-medium text-gray-700 group-hover:text-primary transition-colors mt-1 line-clamp-1">
                {prevArticle.title[lang] || prevArticle.title.de}
              </p>
            </button>
          ) : (
            <div />
          )}

          {nextArticle && (
            <button
              onClick={() => goToArticle(nextArticle.slug)}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all text-right group border border-gray-100"
            >
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {t.nextArticle[lang] || t.nextArticle.de}
              </span>
              <p className="font-medium text-gray-700 group-hover:text-primary transition-colors mt-1 line-clamp-1">
                {nextArticle.title[lang] || nextArticle.title.de}
              </p>
            </button>
          )}
        </div>
      </div>

      {/* Related Articles & CTA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Back to Cluster */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-700">
            {t.moreInCluster[lang] || t.moreInCluster.de}
          </h3>
          <button
            onClick={goToCluster}
            className={`${config.text} text-sm font-medium flex items-center gap-1 hover:underline`}
          >
            Alle anzeigen
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Related Articles (exclude current) */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {cluster.articles
            .filter(a => a.slug !== articleSlug)
            .slice(0, 3)
            .map((article) => (
              <button
                key={article.slug}
                onClick={() => goToArticle(article.slug)}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all text-left group border border-gray-100"
              >
                <h4 className="font-medium text-gray-700 group-hover:text-primary transition-colors line-clamp-2 text-sm">
                  {article.title[lang] || article.title.de}
                </h4>
              </button>
            ))}
        </div>

        {/* CTA */}
        <div className={`${config.bgLight} rounded-2xl p-8 text-center`}>
          <h3 className={`text-xl font-bold ${config.text} mb-2`}>
            {t.findCourses[lang] || t.findCourses.de}
          </h3>
          <p className="text-gray-600 mb-6">
            Entdecke Kurse, die zu diesem Thema passen.
          </p>
          <button
            onClick={goToSearch}
            className={`${config.bgSolid} text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2`}
          >
            Kurse entdecken
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatgeberArtikelView;
