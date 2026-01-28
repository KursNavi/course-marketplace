import React, { useEffect } from 'react';
import { Calendar, User, ArrowLeft, ArrowRight, MapPin, Search } from 'lucide-react';
import { formatPriceCHF } from '../lib/formatPrice';

export default function BlogDetail({ article, setView, courses }) {
  useEffect(() => {
    if(!article) return;

    // Page Title
    document.title = `${article.title} | KursNavi Magazin`;

    // Meta Description (extract from content or use excerpt)
    const strippedContent = article.content.replace(/<[^>]+>/g, '').substring(0, 155);
    const metaDescription = `${strippedContent}...`;

    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
        metaDescTag = document.createElement('meta');
        metaDescTag.name = 'description';
        document.head.appendChild(metaDescTag);
    }
    metaDescTag.content = metaDescription;

    // Canonical URL
    const canonicalUrl = `https://kursnavi.ch/blog/${article.slug || article.id}`;
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
        canonicalTag = document.createElement('link');
        canonicalTag.rel = 'canonical';
        document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonicalUrl;

    // OG Tags
    const ogTags = {
        'og:title': article.title,
        'og:description': metaDescription,
        'og:url': canonicalUrl,
        'og:image': article.image_url || 'https://kursnavi.ch/og-default.jpg',
        'og:type': 'article',
        'og:site_name': 'KursNavi',
        'article:published_time': article.created_at,
        'twitter:card': 'summary_large_image',
        'twitter:title': article.title,
        'twitter:description': metaDescription,
        'twitter:image': article.image_url || 'https://kursnavi.ch/og-default.jpg'
    };

    Object.entries(ogTags).forEach(([property, content]) => {
        let tag = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            if (property.startsWith('twitter:')) {
                tag.name = property;
            } else {
                tag.setAttribute('property', property);
            }
            document.head.appendChild(tag);
        }
        tag.content = content;
    });

    // BreadcrumbList Schema
    const breadcrumbData = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://kursnavi.ch"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Magazin",
                "item": "https://kursnavi.ch/blog"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": article.title
            }
        ]
    };

    let breadcrumbScript = document.querySelector('script[data-schema="breadcrumb"]');
    if (!breadcrumbScript) {
        breadcrumbScript = document.createElement('script');
        breadcrumbScript.type = 'application/ld+json';
        breadcrumbScript.setAttribute('data-schema', 'breadcrumb');
        document.head.appendChild(breadcrumbScript);
    }
    breadcrumbScript.text = JSON.stringify(breadcrumbData);
  }, [article]);

  if (!article) return <div className="p-20 text-center">Artikel nicht gefunden.</div>;

  // Resolve Related Data
  const config = article.related_config || {};
  
  // 1. Find linked course if ID exists
  const linkedCourse = config.course_id && courses 
    ? courses.find(c => c.id.toString() === config.course_id.toString()) 
    : null;

  // 2. Build Complex Search URL
  // We check if we have a label + at least one filter parameter
  const hasParams = config.search_q || config.search_loc || config.search_type || config.search_level || config.search_age || config.search_spec;
  const hasSearch = config.search_label && hasParams;
  
  let searchUrl = null;
  if (hasSearch) {
      const params = new URLSearchParams();
      if (config.search_q) params.append('q', config.search_q);
      if (config.search_loc) params.append('loc', config.search_loc);
      if (config.search_type) params.append('type', config.search_type);
      if (config.search_level) params.append('level', config.search_level);
      if (config.search_age) params.append('age', config.search_age);
      if (config.search_spec) params.append('spec', config.search_spec);
      searchUrl = `/search?${params.toString()}`;
  }

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
                                        {/* Fallback image logic */}
                                        <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                                            {linkedCourse.title.charAt(0)}
                                        </div>
                                    </div>
                                    <div className="flex-grow text-center sm:text-left">
                                        <div className="text-xs font-bold text-primary uppercase mb-1">Empfohlener Kurs</div>
                                        <h4 className="text-xl font-bold text-dark mb-2">{linkedCourse.title}</h4>
                                        <div className="flex items-center justify-center sm:justify-start text-gray-500 text-sm mb-4">
                                            <MapPin className="w-4 h-4 mr-1" /> {linkedCourse.canton} | CHF {formatPriceCHF(linkedCourse.price)}
                                        </div>
                                        <button 
                                            onClick={() => window.location.href = `/courses/topic/loc/${linkedCourse.id}`} 
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