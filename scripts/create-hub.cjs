const fs = require('fs');
const path = require('path');

const hubContent = `import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, BookOpen, ArrowLeft } from 'lucide-react';
import { RATGEBER_STRUCTURE, findCategoryBySlug } from '../lib/ratgeberStructure';
import { SEGMENT_CONFIG } from '../lib/constants';
import { getRobotsPolicy, buildCanonical, DEFAULT_OG_IMAGE } from '../lib/seoUtils';

const RatgeberHubView = ({ lang = 'de' }) => {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const categorySlug = parts.length >= 2 ? parts[1] : null;
  const isRoot = !categorySlug;
  const category = categorySlug ? findCategoryBySlug(categorySlug) : null;
  if (categorySlug && !category) return <RootHub lang={lang} />;
  return isRoot ? <RootHub lang={lang} /> : <CategoryHub category={category} categorySlug={categorySlug} lang={lang} />;
};

function RootHub({ lang }) {
  const robots = getRobotsPolicy();
  const canonical = buildCanonical('/ratgeber');
  const categories = Object.values(RATGEBER_STRUCTURE);
  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Ratgeber | KursNavi</title>
        <meta name="description" content="Der KursNavi Ratgeber: Praxiswissen zu Weiterbildung, Hobbys und Kinderkursen in der Schweiz." />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content={robots} />
        <meta property="og:title" content="Ratgeber | KursNavi" />
        <meta property="og:description" content="Praxiswissen zu Weiterbildung, Hobbys und Kinderkursen in der Schweiz." />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={buildCanonical(DEFAULT_OG_IMAGE)} />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="bg-gradient-to-br from-gray-700 to-gray-900 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <a href={\`/ratgeber/\${cat.slug}\`} onClick={(e) => { e.preventDefault(); window.scrollTo(0,0); window.history.pushState({view:'ratgeber-hub'},'',\`/ratgeber/\${cat.slug}\`); window.dispatchEvent(new PopStateEvent('popstate')); }} className={\`block bg-gradient-to-r \${config.gradient} p-6 group\`}>
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
                      <a key={cluster.slug} href={\`/ratgeber/\${cat.slug}/\${cluster.slug}\`} onClick={(e) => { e.preventDefault(); window.scrollTo(0,0); window.history.pushState({view:'ratgeber-cluster'},'',\`/ratgeber/\${cat.slug}/\${cluster.slug}\`); window.dispatchEvent(new PopStateEvent('popstate')); }} className="group/card rounded-xl border border-gray-100 hover:border-gray-200 p-4 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={\`\${config.bgLight} w-9 h-9 rounded-lg flex items-center justify-center\`}><ClIcon className={\`\${config.text} w-5 h-5\`} /></div>
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
  const pageTitle = \`Ratgeber \${catLabel} | KursNavi\`;
  const pageDesc = \`Ratgeber-Artikel rund um \${catLabel}: \${clusters.map(c => c.label[lang] || c.label.de).join(', ')}.\`;
  const robots = getRobotsPolicy();
  const canonical = buildCanonical(\`/ratgeber/\${categorySlug}\`);
  const nav = (view, p) => { window.scrollTo(0,0); window.history.pushState({view},'',p); window.dispatchEvent(new PopStateEvent('popstate')); };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content={robots} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={buildCanonical(DEFAULT_OG_IMAGE)} />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className={\`bg-gradient-to-br \${config.gradient} py-16\`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => nav('ratgeber-hub', '/ratgeber')} className="flex items-center text-white/80 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Alle Ratgeber
          </button>
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
              <button onClick={() => nav('ratgeber-cluster', \`/ratgeber/\${categorySlug}/\${cluster.slug}\`)} className="w-full text-left p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors group">
                <div className={\`\${config.bgLight} w-12 h-12 rounded-xl flex items-center justify-center\`}><ClIcon className={\`\${config.text} w-6 h-6\`} /></div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{cluster.label[lang] || cluster.label.de}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">{cluster.description[lang] || cluster.description.de}</p>
                </div>
                <ChevronRight className={\`\${config.text} w-5 h-5 flex-shrink-0\`} />
              </button>
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {cluster.articles.map((article, idx) => (
                  <button key={article.slug} onClick={() => nav('ratgeber-artikel', \`/ratgeber/\${categorySlug}/\${cluster.slug}/\${article.slug}\`)} className="w-full text-left px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group/item">
                    <span className={\`\${config.bgLight} \${config.text} w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0\`}>{idx + 1}</span>
                    <span className="text-gray-700 group-hover/item:text-primary transition-colors text-sm font-medium truncate">{article.title[lang] || article.title.de}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RatgeberHubView;
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'components', 'RatgeberHubView.jsx'), hubContent);
console.log('Created RatgeberHubView.jsx');
