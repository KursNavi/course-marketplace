import React, { useState } from 'react';
import { Menu, X, Globe, LogOut, LayoutDashboard, ChevronDown, Mail, ArrowRight, Check, Loader2 } from 'lucide-react';

// BRANDING: The "Compass & Book" Logo [Source: 9]
// Recreated as SVG: A 4-point star (compass) floating above an abstract open book.
export const KursNaviLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* The 4-Point Star (Compass) */}
    <path d="M12 2L13.5 7L18.5 8.5L13.5 10L12 15L10.5 10L5.5 8.5L10.5 7L12 2Z" />
    {/* The Book (Left Page) */}
    <path d="M3 12L11 15V20L3 17V12Z" opacity="0.9" />
    {/* The Book (Right Page) */}
    <path d="M13 15L21 12V17L13 20V15Z" opacity="0.9" />
  </svg>
);

export const Navbar = ({ t, user, lang, setLang, setView, handleLogout, setShowResults, setSelectedCatPath }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // Using text codes instead of flags for Windows compatibility
  const languages = [
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'it', label: 'Italiano', short: 'IT' },
    { code: 'en', label: 'English', short: 'EN' },
  ];

  const navTo = (viewName, catPath = []) => {
    setView(viewName);
    if (setSelectedCatPath) setSelectedCatPath(catPath);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          
          {/* LOGO & MAIN LINKS */}
          <div className="flex items-center">
            <div onClick={() => navTo('home')} className="flex-shrink-0 flex items-center cursor-pointer group">
              <KursNaviLogo className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
              <span className="ml-2 text-2xl font-heading font-bold tracking-tighter text-dark">
                Kurs<span className="text-primary">Navi</span>
              </span>
            </div>
            
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              <button onClick={() => navTo('landing-private', ['Private & Hobby'])} className="text-gray-500 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans">{t.nav_private}</button>
              <button onClick={() => navTo('landing-prof', ['Professional'])} className="text-gray-500 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans">{t.nav_professional}</button>
              <button onClick={() => navTo('landing-kids', ['Children'])} className="text-gray-500 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans">{t.nav_kids}</button>
              <button onClick={() => navTo('how-it-works')} className="text-gray-500 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans">{t.nav_howitworks}</button>
              <button onClick={() => navTo('blog')} className="text-gray-500 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans">{t.nav_news}</button>
              <button onClick={() => navTo('teacher-hub')} className="text-orange-600 hover:text-primary px-3 py-2 rounded-md text-sm font-bold transition-colors font-sans">{t.nav_for_providers}</button>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="relative">
                <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="flex items-center space-x-1 text-gray-500 hover:text-primary p-2 rounded-full transition hover:bg-primaryLight">
                    <Globe className="w-5 h-5" />
                    <span className="font-bold text-xs uppercase font-sans">{lang}</span>
                    <ChevronDown className="w-3 h-3" />
                </button>
                
                {langMenuOpen && (
                    <>
                    <div className="fixed inset-0 z-10" onClick={() => setLangMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                        {languages.map((l) => (
                            <button key={l.code} onClick={() => { setLang(l.code); setLangMenuOpen(false); }} className={`block w-full text-left px-4 py-3 text-sm hover:bg-primaryLight hover:text-primary transition flex items-center ${lang === l.code ? 'font-bold text-primary bg-primaryLight' : 'text-gray-700'}`}>
                                <span className={`mr-3 font-bold w-6 ${lang === l.code ? 'text-primary' : 'text-gray-400'}`}>{l.short}</span>{l.label}
                            </button>
                        ))}
                    </div>
                    </>
                )}
            </div>

            {user ? (
              <div className="flex items-center space-x-4">
                <button onClick={() => navTo('dashboard')} className="flex items-center text-gray-700 hover:text-primary font-medium font-sans"><LayoutDashboard className="w-4 h-4 mr-2" />{t.nav_dashboard}</button>
                <button onClick={handleLogout} className="flex items-center text-gray-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
              </div>
            ) : (
              <button onClick={() => navTo('login')} className="bg-dark text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-primary transition-all duration-300 shadow-lg hover:-translate-y-0.5 font-heading">{t.nav_login}</button>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <div className="flex items-center md:hidden">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-500 hover:text-primary p-2">
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 absolute w-full left-0 shadow-xl h-screen overflow-y-auto pb-20">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <button onClick={() => navTo('landing-private', ['Private & Hobby'])} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans">{t.nav_private}</button>
            <button onClick={() => navTo('landing-prof', ['Professional'])} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans">{t.nav_professional}</button>
            <button onClick={() => navTo('landing-kids', ['Children'])} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans">{t.nav_kids}</button>
            <button onClick={() => navTo('how-it-works')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans">{t.nav_howitworks}</button>
            <button onClick={() => navTo('blog')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans">{t.nav_news}</button>
            <button onClick={() => navTo('teacher-hub')} className="block w-full text-left px-3 py-2 rounded-md text-base font-bold text-orange-600 hover:bg-orange-50 font-sans">{t.nav_for_providers}</button>
            
            <div className="border-t border-gray-100 my-2 pt-2">
                <p className="px-3 text-xs font-bold text-gray-400 uppercase mb-2 font-heading">Language</p>
                <div className="grid grid-cols-2 gap-2 px-3">
                    {languages.map((l) => (
                        <button key={l.code} onClick={() => { setLang(l.code); setMobileMenuOpen(false); }} className={`flex items-center justify-center py-2 rounded-lg border text-sm ${lang === l.code ? 'border-primary text-primary bg-primaryLight font-bold' : 'border-gray-200 text-gray-600'}`}>
                            <span className="mr-2 font-bold">{l.short}</span>{l.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-t border-gray-100 my-2 pt-2">
                {user ? (
                    <>
                        <button onClick={() => navTo('dashboard')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 font-sans">{t.nav_dashboard}</button>
                        <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-500 hover:bg-red-50 font-sans">{t.nav_logout}</button>
                    </>
                ) : (
                    <button onClick={() => navTo('login')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-primary font-bold font-sans">{t.nav_login}</button>
                )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export const Footer = ({ t, setView }) => {
    const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, already, error

  const isAlreadySubscribed = (statusCode, payload) => {
    // Häufige Fälle:
    // - 409 Conflict (klassisch für "exists")
    // - Postgres Unique Violation: 23505
    // - Anbieter-Messages wie "member exists", "already subscribed", "duplicate"
    if (statusCode === 409) return true;

    const code = (payload?.code || payload?.error?.code || '').toString().toLowerCase();

    const raw = (
      payload?.message ||
      payload?.error ||
      payload?.detail ||
      payload?.hint ||
      payload?.error?.message ||
      ''
    )
      .toString()
      .toLowerCase();

    return (
      code === '23505' ||
      raw.includes('duplicate') ||
      raw.includes('member exists') ||
      raw.includes('already subscribed') ||
      raw.includes('already exist') ||
      raw.includes('contact already exist') ||
      (raw.includes('already') && (raw.includes('subscrib') || raw.includes('exist')))
    );

  };

    const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');

    try {
      console.log("Start Newsletter-Anmeldung für:", email);

      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      // Wir lesen die Antwort vorsichtig, falls es kein JSON ist (z.B. 404 HTML Seite)
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.warn("Server-Antwort war kein JSON:", text.substring(0, 50) + "...");
      }

      const already = isAlreadySubscribed(res.status, data);

      if (res.ok) {
        setStatus(already ? 'already' : 'success');
        setEmail('');
        console.log("Erfolg:", data);
      } else if (already) {
        setStatus('already');
        setEmail('');
        console.warn("Bereits angemeldet:", res.status, data);
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
  <footer className="bg-white border-t border-gray-200 py-12 font-sans">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* NEWSLETTER SECTION */}
      <div className="bg-dark rounded-2xl p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-lg">
          <h3 className="text-2xl font-bold text-white font-heading mb-2">Verpasse keine neuen Kurse!</h3>
          <p className="text-gray-400 text-sm">Erhalte regelmässig handverlesene Kurs-Empfehlungen, exklusive Angebote und interessante Informationen direkt in dein Postfach.</p>
        </div>
        
        <div className="relative z-10 w-full max-w-md">
                    {(status === 'success' || status === 'already') ? (
             <div
               className={`px-4 py-3 rounded-xl flex items-center justify-center animate-in fade-in border ${
                 status === 'success'
                   ? 'bg-green-500/20 border-green-500/50 text-green-400'
                   : 'bg-blue-500/20 border-blue-500/50 text-blue-200'
               }`}
             >
                <Check className="w-5 h-5 mr-2" />
                <span className="font-bold">
                  {status === 'success'
                    ? (t?.msg_newsletter_success || 'Erfolgreich angemeldet!')
                    : (t?.msg_newsletter_already || 'Du bist bereits angemeldet.')}
                </span>
             </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <div className="relative flex-grow">
                <Mail className="absolute left-3 top-3.5 text-gray-500 w-5 h-5" />
                <input 
                  type="email" 
                  required
                  placeholder="Deine E-Mail Adresse" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white/20 transition"
                />
              </div>
              <button 
                type="submit" 
                disabled={status === 'loading'}
                className="bg-primary hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-xs mt-2 ml-1">
              {t?.msg_newsletter_error || 'Hoppla, das hat nicht geklappt. Versuch es später noch einmal.'}
            </p>
          )}

        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center mb-4 text-dark font-heading font-bold text-xl">
            <KursNaviLogo className="h-6 w-6 text-primary mr-2" /> KursNavi
          </div>
          <p className="text-gray-500 text-sm font-sans">{t.footer_madein}</p>
        </div>
        <div>
          <h4 className="font-heading font-bold text-dark mb-4">{t.footer_discover}</h4>
          <ul className="space-y-2 text-sm text-gray-500 font-sans">
            <li onClick={() => { setView('landing-private'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.nav_private}</li>
            <li onClick={() => { setView('landing-prof'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.nav_professional}</li>
            <li onClick={() => { setView('landing-kids'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.nav_kids}</li>
            <li onClick={() => { setView('blog'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.nav_news}</li>
<li onClick={() => { setView('teacher-hub'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors font-bold text-orange-600">{t.nav_for_providers}</li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold text-dark mb-4">{t.footer_support}</h4>
          <ul className="space-y-2 text-sm text-gray-500 font-sans">
            <li onClick={() => { setView('how-it-works'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.nav_howitworks}</li>
            <li onClick={() => { setView('contact'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.nav_contact}</li>
            <li onClick={() => { setView('about'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.nav_about}</li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold text-dark mb-4">{t.footer_legal_header}</h4>
          <ul className="space-y-2 text-sm text-gray-500 font-sans">
            <li onClick={() => { setView('agb'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.legal_agb}</li>
            <li onClick={() => { setView('datenschutz'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.footer_privacy}</li>
            <li onClick={() => { setView('impressum'); window.scrollTo(0,0); }} className="hover:text-primary cursor-pointer transition-colors">{t.footer_legal}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center">
        <p className="text-gray-400 text-sm font-sans">&copy; {new Date().getFullYear()} LifeSkills360 GmbH. {t.footer_rights}</p>
      </div>
    </div>
  </footer>
  );
};