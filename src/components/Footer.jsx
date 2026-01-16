import React, { useState } from 'react';
import { Mail, ArrowRight, Check, Loader2 } from 'lucide-react';

// Das Logo als lokale Komponente für den Footer
const KursNaviLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2L13.5 7L18.5 8.5L13.5 10L12 15L10.5 10L5.5 8.5L10.5 7L12 2Z" />
    <path d="M3 12L11 15V20L3 17V12Z" opacity="0.9" />
    <path d="M13 15L21 12V17L13 20V15Z" opacity="0.9" />
  </svg>
);

export const Footer = ({ setView }) => {
  // Hilfsfunktion für Navigation
  const navTo = (view, e) => {
    e.preventDefault();
    if (setView) setView(view);
  };
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');

    try {
      console.log("Start Newsletter-Anmeldung für:", email);
      const res = await fetch('/api/newsletter', { // Pfad angepasst auf newsletter.js
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.warn("Server-Antwort war kein JSON:", text);
      }

      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        console.error("Newsletter Server-Fehler:", res.status, data);
        setStatus('error');
      }
    } catch (err) {
      console.error("Newsletter Netzwerk-Fehler:", err);
      setStatus('error');
    }
  };

  return (
    <footer className="bg-white border-t border-gray-200 py-12 font-sans text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* NEWSLETTER SECTION */}
        <div className="bg-[#1A1A1A] rounded-2xl p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl relative overflow-hidden">
          {/* Deko Hintergrund */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          
          <div className="relative z-10 max-w-lg">
            <h3 className="text-2xl font-bold text-white mb-2">Verpasse keine neuen Kurse!</h3>
            <p className="text-gray-400 text-sm">Erhalten Sie regelmässig Updates über die Entwicklung der Plattform und neue Partner-Angebote.</p>
          </div>
          
          <div className="relative z-10 w-full max-w-md">
            {status === 'success' ? (
               <div className="bg-green-500/20 border border-green-500/50 text-green-400 px-4 py-3 rounded-xl flex items-center justify-center">
                  <Check className="w-5 h-5 mr-2" />
                  <span className="font-bold">Erfolgreich angemeldet!</span>
               </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <div className="relative flex-grow">
                  <Mail className="absolute left-3 top-3.5 text-gray-500 w-5 h-5" />
                  <input 
                    type="email" 
                    required
                    placeholder="E-Mail Adresse eingeben" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/20 transition"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={status === 'loading'}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                </button>
              </form>
            )}
            {status === 'error' && <p className="text-red-400 text-xs mt-2 ml-1">Ein Fehler ist aufgetreten. Bitte später versuchen.</p>}
          </div>
        </div>

        {/* FOOTER LINKS (Statisch für Landing Page) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center mb-4 text-gray-900 font-bold text-xl">
              <KursNaviLogo className="h-6 w-6 text-blue-600 mr-2" /> KursNavi
            </div>
            <p className="text-gray-500 text-sm">Made with ❤️ in Switzerland.</p>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4">Plattform</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#contact" className="hover:text-blue-600 transition-colors">Für Bildungsanbieter</a></li>
              <li><span className="text-gray-400 cursor-not-allowed">Kurse suchen (Coming Soon)</span></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#contact" className="hover:text-blue-600 transition-colors">Kontakt aufnehmen</a></li>
            </ul>
          </div>
          
          <div>
  <h4 className="font-bold text-gray-900 mb-4">Rechtliches</h4>
  <ul className="space-y-2 text-sm text-gray-500">
    <li>
      <button onClick={(e) => navTo('impressum', e)} className="hover:text-blue-600 transition-colors text-left">
        Impressum
      </button>
    </li>
    <li>
      <button onClick={(e) => navTo('datenschutz', e)} className="hover:text-blue-600 transition-colors text-left">
        Datenschutz
      </button>
    </li>
    <li>
      <button onClick={(e) => navTo('agb', e)} className="hover:text-blue-600 transition-colors text-left">
        AGB
      </button>
    </li>
  </ul>
</div>
        </div>

        <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">&copy; {new Date().getFullYear()} KursNavi Schweiz. Alle Rechte vorbehalten.</p>
        </div>
      </div>
    </footer>
  );
};