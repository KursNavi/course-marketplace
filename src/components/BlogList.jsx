import React from 'react';

export default function BlogList({ articles, setView, setSelectedArticle }) {
  // Nur veröffentlichte Artikel anzeigen
  const published = articles.filter(a => a.is_published);

  const handleRead = (article) => {
    setSelectedArticle(article);
    setView('blog-detail');
    window.scrollTo(0,0);
  };

  return (
    <div className="min-h-screen bg-beige py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-dark mb-4 text-center">KursNavi Magazin</h1>
        <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
          Tipps, Trends und Inspiration rund um Weiterbildung, Hobbys und Freizeit in der Schweiz.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {published.map(article => (
            <div key={article.id} onClick={() => handleRead(article)} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group border border-stone-100">
              <div className="h-48 bg-gray-200 overflow-hidden relative">
                {article.image_url ? (
                    <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300 font-heading text-4xl font-bold">KN</div>
                )}
              </div>
              <div className="p-6">
                <div className="text-xs font-bold text-primary mb-2 uppercase tracking-wide">Artikel</div>
                <h2 className="text-xl font-heading font-bold text-dark mb-3 group-hover:text-primary transition-colors">{article.title}</h2>
                <p className="text-gray-600 line-clamp-3 text-sm leading-relaxed mb-4">
                  {article.excerpt}
                </p>
                <span className="text-primary font-bold text-sm underline decoration-2 underline-offset-4">Weiterlesen</span>
              </div>
            </div>
          ))}
        </div>
        
        {published.length === 0 && (
            <div className="text-center py-20 text-gray-500">
                <p>Noch keine Artikel veröffentlicht.</p>
            </div>
        )}
      </div>
    </div>
  );
}