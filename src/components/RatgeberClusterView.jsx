import React from 'react';
import { ArrowLeft, ChevronRight, BookOpen } from 'lucide-react';
import { RATGEBER_STRUCTURE, findCluster } from '../lib/ratgeberStructure';
import { SEGMENT_CONFIG } from '../lib/constants';

/**
 * RatgeberClusterView
 *
 * Displays a cluster overview page with 6 article cards.
 * URL pattern: /ratgeber/{category}/{cluster}
 */
const RatgeberClusterView = ({ lang = 'de' }) => {
  // Parse URL to get category and cluster slugs
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const categorySlug = parts[1]; // e.g., 'beruflich'
  const clusterSlug = parts[2];  // e.g., 'finanzierung'

  // Find cluster data
  const clusterData = findCluster(categorySlug, clusterSlug);

  if (!clusterData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Cluster nicht gefunden</h1>
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

  const { category } = clusterData;

  // Get segment config for styling
  const segmentKey = category.slug === 'beruflich' ? 'beruflich' :
                     category.slug === 'privat-hobby' ? 'privat_hobby' :
                     'kinder_jugend';
  const config = SEGMENT_CONFIG[segmentKey] || SEGMENT_CONFIG.beruflich;
  const ClusterIcon = clusterData.icon;

  // Navigate to article
  const goToArticle = (articleSlug) => {
    window.scrollTo(0, 0);
    window.history.pushState(
      { view: 'ratgeber-artikel' },
      '',
      `/ratgeber/${categorySlug}/${clusterSlug}/${articleSlug}`
    );
  };

  // Navigate back to search
  const goBack = () => {
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'search' }, '', `/search?type=${segmentKey}`);
  };

  // Translations
  const t = {
    backTo: {
      de: 'Zurück zu',
      en: 'Back to',
      fr: 'Retour à',
      it: 'Torna a'
    },
    articles: {
      de: 'Artikel',
      en: 'Articles',
      fr: 'Articles',
      it: 'Articoli'
    },
    readMore: {
      de: 'Artikel lesen',
      en: 'Read article',
      fr: 'Lire l\'article',
      it: 'Leggi l\'articolo'
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className={`bg-gradient-to-br ${config.gradient} py-16`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <button
            onClick={goBack}
            className="flex items-center text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.backTo[lang] || t.backTo.de} {category.label[lang] || category.label.de}
          </button>

          {/* Cluster Title */}
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <ClusterIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium uppercase tracking-wide">
                {category.label[lang] || category.label.de}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white font-heading">
                {clusterData.label[lang] || clusterData.label.de}
              </h1>
            </div>
          </div>

          {/* Description */}
          <p className="text-white/90 text-lg max-w-2xl">
            {clusterData.description[lang] || clusterData.description.de}
          </p>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-2 mb-8">
          <BookOpen className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-bold text-gray-700">
            {clusterData.articles.length} {t.articles[lang] || t.articles.de}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {clusterData.articles.map((article, index) => (
            <button
              key={article.slug}
              onClick={() => goToArticle(article.slug)}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 text-left group border border-gray-100 hover:border-gray-200"
            >
              {/* Article Number */}
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg ${config.bgLight} ${config.text} flex items-center justify-center font-bold text-lg flex-shrink-0`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors mb-2 text-lg">
                    {article.title[lang] || article.title.de}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2">
                    {article.teaser[lang] || article.teaser.de}
                  </p>
                </div>
              </div>

              {/* Read More */}
              <div className="flex items-center justify-end mt-4 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                {t.readMore[lang] || t.readMore.de}
                <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className={`${config.bgLight} rounded-2xl p-8 text-center`}>
          <h3 className={`text-xl font-bold ${config.text} mb-2`}>
            Passende Kurse finden
          </h3>
          <p className="text-gray-600 mb-6">
            Entdecke Kurse, die zu diesem Thema passen.
          </p>
          <button
            onClick={goBack}
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

export default RatgeberClusterView;
