import React, { useEffect } from 'react';
import { Calendar, User, ArrowLeft } from 'lucide-react';

export default function BlogDetail({ article, setView }) {
  useEffect(() => {
    if(article) {
        document.title = `${article.title} | KursNavi Magazin`;
        // Optional: Hier könnte man Meta-Description injecten
    }
  }, [article]);

  if (!article) return <div className="p-20 text-center">Artikel nicht gefunden.</div>;

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
                
                {/* SAFE HTML INJECTION */}
                <div dangerouslySetInnerHTML={{ __html: article.content }} />
            </div>

            {/* CTA Box */}
            <div className="mt-16 bg-beige p-8 rounded-2xl text-center border border-orange-100">
                <h3 className="text-2xl font-heading font-bold mb-3">Hat dir dieser Artikel gefallen?</h3>
                <p className="text-gray-600 mb-6">Finde jetzt den passenden Kurs zu diesem Thema auf KursNavi.</p>
                <button onClick={() => setView('search')} className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-orange-600 shadow-lg hover:shadow-xl transition-all">
                    Kurse entdecken
                </button>
            </div>
        </article>
    </div>
  );
}