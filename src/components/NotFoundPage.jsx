import React, { useEffect } from 'react';
import { Search, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage({ setView }) {
  useEffect(() => {
    document.title = 'Seite nicht gefunden | KursNavi';
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex,nofollow';

    return () => {
      meta.content = '';
    };
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-8xl font-bold text-primary/20 mb-2">404</p>
        <h1 className="text-2xl font-bold text-dark mb-3">Seite nicht gefunden</h1>
        <p className="text-gray-600 mb-8">
          Die gesuchte Seite existiert nicht oder wurde verschoben.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); setView('home'); }}
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-full hover:opacity-90 transition font-medium"
          >
            <Home className="w-4 h-4" />
            Zur Startseite
          </a>
          <a
            href="/search"
            onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/search'); setView('search'); }}
            className="inline-flex items-center justify-center gap-2 border border-gray-300 text-dark px-6 py-3 rounded-full hover:bg-gray-50 transition font-medium"
          >
            <Search className="w-4 h-4" />
            Kurs suchen
          </a>
        </div>
      </div>
    </div>
  );
}
