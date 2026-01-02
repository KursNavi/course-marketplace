import React, { useEffect } from 'react';
import { Calendar, User, ArrowLeft, ArrowRight, MapPin, Search } from 'lucide-react';

export default function BlogDetail({ article, setView, courses }) {
  useEffect(() => {
    if(article) {
        document.title = `${article.title} | KursNavi Magazin`;
    }
  }, [article]);

  if (!article) return <div className="p-20 text-center">Artikel nicht gefunden.</div>;

  // Resolve Related Data
  const config = article.related_config || {};
  
  // 1. Find linked course if ID exists
  const linkedCourse = config.course_id && courses 
    ? courses.find(c => c.id.toString() === config.course_id.toString()) 
    : null;

  // 2. Build Search URL if params exist
  const hasSearch = config.search_label && (config.search_q || config.search_loc);
  const searchUrl = hasSearch 
    ? `/search?q=${encodeURIComponent(config.search_q || '')}&loc=${encodeURIComponent(config.search_loc || '')}` 
    : null;

  const handleDeepLink = (url) => {
      // Manually push state to trigger App.jsx detection
      window.history.pushState({}, '', url);
      // Force a reload of the view state logic by triggering a popstate event essentially or relies on App.jsx to pick it up on re-render if we change view prop? 
      // Actually, since we are in App.jsx control, we should just update URL and let user click or reload. 
      // BETTER: Just use href and let App.jsx handle it via standard navigation if we built a link handler.
      // But since we are inside React, let's use the native setView if possible, BUT we need to pass params.
      // Easiest way compliant with our "Traffic Cop":
      window.location.href = url; 
  };

  return (
    <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <div className="bg-stone-900 text-white py-20 px-4 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30">
                {article.image_url && <img src={article.image_url} alt={article.title} className="w-full h-full object-cover blur-sm" />}
            </div>
            <div className="relative max-w-3xl mx-auto text-center z-10">
                <button onClick={() => setView('blog')} className="mb-6 inline-flex items-center text-stone-300 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zum Magazin
                </button>
                <h1 className="text-3xl md:text-5xl font-heading font-bold mb-6 leading-tight">{article.title}</h1>
                <div className="flex items-center justify-center space-x-6 text-stone-300 text-sm">
                    <span className="flex items-center"><Calendar className="w-4 h-4 mr-2" /> {new Date(article.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center"><User className="w-4 h-4 mr-2" /> Redaktion</span>
                </div>
            </div>
        </div>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
            <div className="prose prose-lg prose-orange max-w-none 
                prose-headings:font-heading prose-headings:font-bold prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6
                prose-p:text-gray-600 prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-img:rounded-xl prose-img:shadow-lg prose-li:marker:text-primary">
                <div dangerouslySetInnerHTML={{ __html: article.content }} />
            </div>

            {/* DYNAMIC CTA SECTION */}
            {(linkedCourse || hasSearch) && (
                <div className="mt-16 border-t border-gray-100 pt-12">
                    <h3 className="text-2xl font-heading font-bold mb-8 text-center">Das könnte dich interessieren</h3>
                    
                    <div className="grid md:grid-cols-1 gap-6 max-w-2xl mx-auto">
                        
                        {/* Featured Course Card */}
                        {linkedCourse && (
                            <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all group">
                                <div className="p-6 flex flex-col sm:flex-row gap-6 items-center">
                                    <div className="w-full sm:w-32 h-32 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                                         {/* Fallback image logic same as SearchCard */}
                                        <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                                            {linkedCourse.title.charAt(0)}
                                        </div>
                                    </div>
                                    <div className="flex-grow text-center sm:text-left">
                                        <div className="text-xs font-bold text-primary uppercase mb-1">Empfohlener Kurs</div>
                                        <h4 className="text-xl font-bold text-dark mb-2">{linkedCourse.title}</h4>
                                        <div className="flex items-center justify-center sm:justify-start text-gray-500 text-sm mb-4">
                                            <MapPin className="w-4 h-4 mr-1" /> {linkedCourse.canton} | CHF {linkedCourse.price}
                                        </div>
                                        <button 
                                            onClick={() => window.location.href = `/courses/topic/loc/${linkedCourse.id}`} // Simple redirect handled by App init
                                            className="bg-dark text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-primary transition-colors inline-flex items-center"
                                        >
                                            Kurs ansehen <ArrowRight className="w-4 h-4 ml-2"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Search Button Link */}
                        {hasSearch && (
                            <div className="text-center mt-4">
                                <p className="text-gray-500 mb-4">Möchtest du mehr Auswahl zu diesem Thema?</p>
                                <a 
                                    href={searchUrl}
                                    className="inline-flex items-center justify-center border-2 border-primary text-primary px-8 py-3 rounded-full font-bold hover:bg-primary hover:text-white transition-all shadow-sm hover:shadow-md"
                                >
                                    <Search className="w-4 h-4 mr-2" />
                                    {config.search_label}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </article>
    </div>
  );
}