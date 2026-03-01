import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Globe, LogOut, LayoutDashboard, ChevronDown, Mail, ArrowRight, Check, Loader2, Briefcase, Palette, Smile, Shield } from 'lucide-react';
import { SEGMENT_CONFIG } from '../lib/constants';
import { MegaMenu, MobileMenuCategory } from './MegaMenu';

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

export const Navbar = ({ t, user, lang = 'de', setLang, setView, handleLogout, setShowResults, setSelectedCatPath }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState(null);
  const [activePath, setActivePath] = useState(window.location.pathname);
  const [anbieterMenuOpen, setAnbieterMenuOpen] = useState(false);
  const [mobileAnbieterOpen, setMobileAnbieterOpen] = useState(false);
  const anbieterTimeoutRef = useRef(null);

  // Detect active segment from URL
  useEffect(() => {
    const updateActiveSegment = () => {
      const params = new URLSearchParams(window.location.search);
      const type = params.get('type');
      const path = window.location.pathname;

      setActivePath(path);

      // Only show active segment on search page
      if (path === '/search' && type) {
        setActiveSegment(type);
      } else {
        setActiveSegment(null);
      }
    };

    updateActiveSegment();
    window.addEventListener('popstate', updateActiveSegment);

    // Also listen for pushState (custom event approach)
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      updateActiveSegment();
    };

    return () => {
      window.removeEventListener('popstate', updateActiveSegment);
      window.history.pushState = originalPushState;
    };
  }, []);

  // Segment navigation buttons config
  const segmentButtons = [
    { key: 'beruflich', label: t.nav_professional, Icon: Briefcase, config: SEGMENT_CONFIG.beruflich },
    { key: 'privat_hobby', label: t.nav_private, Icon: Palette, config: SEGMENT_CONFIG.privat_hobby },
    { key: 'kinder_jugend', label: t.nav_kids, Icon: Smile, config: SEGMENT_CONFIG.kinder_jugend },
  ];

  // Using text codes instead of flags for Windows compatibility
  const languages = [
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'it', label: 'Italiano', short: 'IT' },
    { code: 'en', label: 'English', short: 'EN' },
  ];

  // Helper: Convert view name to URL path
  const getUrlForView = (viewName) => {
    const urlMap = {
      'home': '/',
      'search': '/search',
      'landing-private': '/private',
      'landing-prof': '/professional',
      'landing-kids': '/children',
      'how-it-works': '/how-it-works',
      'blog': '/blog',
      'teacher-hub': '/teacher-hub',
      'contact': '/contact',
      'about': '/about',
      'agb': '/agb',
      'datenschutz': '/datenschutz',
      'impressum': '/impressum',
      'widerruf': '/widerruf-storno',
      'trust': '/vertrauen-sicherheit',
      'login': '/login',
      'dashboard': '/dashboard',
      'create': '/create-course',
      'admin': '/control-room-2025',
      'admin-blog': '/admin-blog',
      'provider-directory': '/anbieter',
      'bereich-landing': '/bereich'
    };
    return urlMap[viewName] || '/';
  };

  const navTo = (viewName, catPath = []) => {
    const url = getUrlForView(viewName);
    if (setSelectedCatPath) setSelectedCatPath(catPath);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
    // Use pushState - syncFromUrl in App.jsx will handle setView
    window.history.pushState({ view: viewName }, '', url);
  };

  // Navigate to Anbietersuche with a pre-selected category
  const navToAnbieter = (segmentKey) => {
    const slugMap = { beruflich: 'professionell', privat_hobby: 'privat', kinder_jugend: 'kinder' };
    const dbSlug = slugMap[segmentKey] || segmentKey;
    setAnbieterMenuOpen(false);
    setMobileMenuOpen(false);
    setMobileAnbieterOpen(false);
    window.scrollTo(0, 0);
    window.history.pushState({ view: 'provider-directory' }, '', `/anbieter?type=${dbSlug}`);
    window.dispatchEvent(new Event('anbieter-type-change'));
  };

  return (
    <>
    <a href="#main-content" className="skip-to-content">Zum Inhalt springen</a>
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50" aria-label="Hauptnavigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">

          {/* LOGO & MAIN LINKS */}
          <div className="flex items-center">
            <button type="button" onClick={() => navTo('home')} className="flex-shrink-0 flex items-center cursor-pointer group bg-transparent border-none p-0" aria-label="KursNavi — Zur Startseite">
              <KursNaviLogo className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
              <span className="ml-2 text-2xl font-heading font-bold tracking-tighter text-dark">
                Kurs<span className="text-primary">Navi</span>
              </span>
            </button>

            <div className="hidden md:ml-10 md:flex md:space-x-6 md:items-center">
              {segmentButtons.map(({ key, label, Icon, config }) => {
                const isActive = activeSegment === key;
                return (
                  <MegaMenu
                    key={key}
                    categoryKey={key}
                    label={label}
                    Icon={Icon}
                    config={config}
                    isActive={isActive}
                    lang={lang}
                  />
                );
              })}
              <button onClick={() => navTo('how-it-works')} className="text-gray-500 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans">{t.nav_howitworks}</button>
              <button onClick={() => navTo('blog')} className="text-gray-500 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors font-sans">{t.nav_news}</button>
              {/* Anbietersuche Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => { if (anbieterTimeoutRef.current) clearTimeout(anbieterTimeoutRef.current); setAnbieterMenuOpen(true); }}
                onMouseLeave={() => { anbieterTimeoutRef.current = setTimeout(() => setAnbieterMenuOpen(false), 150); }}
              >
                <span className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-primary transition-colors font-sans cursor-default select-none">
                  {t.nav_providers || 'Anbietersuche'}
                  <ChevronDown className={`w-3 h-3 ml-1 transition-transform duration-200 ${anbieterMenuOpen ? 'rotate-180' : ''}`} />
                </span>
                {anbieterMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {segmentButtons.map(({ key, label, Icon, config }) => (
                      <button
                        key={key}
                        onClick={() => navToAnbieter(key)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 ${config.hoverBg} transition-colors`}
                      >
                        <div className={`p-1.5 rounded-lg ${config.bgLight}`}>
                          <Icon className={`w-4 h-4 ${config.text}`} />
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => navTo('teacher-hub')} className={`${activePath === "/teacher-hub" ? "text-orange-600 font-bold" : "text-gray-500 font-medium hover:text-primary"} px-3 py-2 rounded-md text-sm transition-colors font-sans`}>{t.nav_for_providers}</button>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="hidden md:flex items-center">
            {/* Language switcher temporarily hidden for launch (German only)
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
            */}

            {/* Divider between nav and user area */}
            <div className="h-8 w-px bg-gray-200 mx-3"></div>

            {user ? (
              <div className="flex items-center space-x-3">
                <button onClick={() => navTo('dashboard')} className="flex items-center gap-2 bg-gray-50 hover:bg-primaryLight text-gray-700 hover:text-primary pl-3 pr-4 py-2 rounded-full text-sm font-semibold transition-colors border border-gray-200 hover:border-primary/30 font-sans">
                  <LayoutDashboard className="w-4 h-4" />{t.nav_dashboard}
                </button>
                {user.role === 'admin' && (
                  <button onClick={() => navTo('admin')} className="flex items-center text-purple-600 hover:text-purple-700 font-bold font-sans"><Shield className="w-4 h-4 mr-1" /> Admin</button>
                )}
                <button onClick={handleLogout} className="flex items-center text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"><LogOut className="w-4 h-4" /></button>
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
          <div className="pt-2 pb-3">
            {segmentButtons.map(({ key, label, Icon, config }) => {
              const isActive = activeSegment === key;
              return (
                <MobileMenuCategory
                  key={key}
                  categoryKey={key}
                  label={label}
                  Icon={Icon}
                  config={config}
                  isActive={isActive}
                  lang={lang}
                  onClose={() => setMobileMenuOpen(false)}
                />
              );
            })}
            <div className="px-2 space-y-1 mt-2">
            <button onClick={() => navTo('how-it-works')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans">{t.nav_howitworks}</button>
            <button onClick={() => navTo('blog')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans">{t.nav_news}</button>
            {/* Anbietersuche expandable */}
            <div>
              <button
                onClick={() => setMobileAnbieterOpen(!mobileAnbieterOpen)}
                className="flex items-center justify-between w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-primaryLight hover:text-primary font-sans"
              >
                {t.nav_providers || 'Anbietersuche'}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${mobileAnbieterOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileAnbieterOpen && (
                <div className="pl-4 py-1 space-y-1">
                  {segmentButtons.map(({ key, label, Icon, config }) => (
                    <button
                      key={key}
                      onClick={() => navToAnbieter(key)}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm ${config.text} font-medium ${config.hoverBg}`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => navTo('teacher-hub')} className={`block w-full text-left px-3 py-2 rounded-md text-base font-sans ${activePath === "/teacher-hub" ? "font-bold text-orange-600" : "font-medium text-gray-700 hover:bg-primaryLight hover:text-primary"}`}>{t.nav_for_providers}</button>
            </div>

            {/* Language switcher temporarily hidden for launch (German only)
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
            */}

            <div className="border-t border-gray-100 my-2 pt-2">
                {user ? (
                    <>
                        <button onClick={() => navTo('dashboard')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 font-sans">{t.nav_dashboard}</button>
                        {user.role === 'admin' && (
                        <button onClick={() => navTo('admin')} className="block w-full text-left px-3 py-2 rounded-md text-base font-bold text-purple-600 hover:bg-purple-50 font-sans">Admin Panel</button>
                    )}
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
    </>
  );
};

export const Footer = ({ t, setView }) => {
    const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, already, error

  // Helper: Convert view name to URL path (same as in Navbar)
  const getUrlForView = (viewName) => {
    const urlMap = {
      'home': '/',
      'search': '/search',
      'landing-private': '/private',
      'landing-prof': '/professional',
      'landing-kids': '/children',
      'how-it-works': '/how-it-works',
      'blog': '/blog',
      'teacher-hub': '/teacher-hub',
      'contact': '/contact',
      'about': '/about',
      'agb': '/agb',
      'datenschutz': '/datenschutz',
      'impressum': '/impressum',
      'widerruf': '/widerruf-storno',
      'trust': '/vertrauen-sicherheit',
      'login': '/login',
      'dashboard': '/dashboard',
      'provider-directory': '/anbieter',
      'bereich-landing': '/bereich'
    };
    return urlMap[viewName] || '/';
  };

  const navTo = (viewName) => {
    const url = getUrlForView(viewName);
    window.scrollTo(0, 0);
    // Use pushState - syncFromUrl in App.jsx will handle setView
    window.history.pushState({ view: viewName }, '', url);
  };

    const isAlreadySubscribed = (statusCode, payload) => {
    // Backend-Flag (unser neuer, sicherster Weg)
    if (payload?.already === true) return true;

    // Klassische Fälle
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

    // Deutsch + Englisch, aber ohne "subscribed" als generischen Treffer
    return (
      code === '23505' ||
      code === 'duplicate_parameter' ||
      (raw.includes('bereits') && raw.includes('angemeldet')) ||
      raw.includes('already exist') ||
      raw.includes('member exists') ||
      raw.includes('already subscribed') ||
      raw.includes('duplicate')
    );
  };

    const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');

    try {
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
  <footer className="bg-white border-t border-gray-200 py-12 font-sans" role="contentinfo">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* NEWSLETTER SECTION */}
      <div className="bg-dark rounded-2xl p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-lg">
          <h3 className="text-2xl font-bold text-white font-heading mb-2">Verpasse keine neuen Kurse!</h3>
          <p className="text-gray-300 text-sm">Erhalte regelmässig handverlesene Kurs-Empfehlungen, exklusive Angebote und interessante Informationen direkt in dein Postfach.</p>
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
                className="bg-primary hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition flex items-center disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
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
            <li><a href="/search?type=beruflich" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0); window.history.pushState({ view: 'search' }, '', '/search?type=beruflich'); }} className="hover:text-primary transition-colors">{t.nav_professional}</a></li>
            <li><a href="/search?type=privat_hobby" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0); window.history.pushState({ view: 'search' }, '', '/search?type=privat_hobby'); }} className="hover:text-primary transition-colors">{t.nav_private}</a></li>
            <li><a href="/search?type=kinder_jugend" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0); window.history.pushState({ view: 'search' }, '', '/search?type=kinder_jugend'); }} className="hover:text-primary transition-colors">{t.nav_kids}</a></li>
            <li><a href="/blog" onClick={(e) => { e.preventDefault(); navTo('blog'); }} className="hover:text-primary transition-colors">{t.nav_news}</a></li>
            <li><a href="/anbieter" onClick={(e) => { e.preventDefault(); navTo('provider-directory'); }} className="hover:text-primary transition-colors">{t.nav_providers || 'Anbieter-Verzeichnis'}</a></li>
            <li><a href="/teacher-hub" onClick={(e) => { e.preventDefault(); navTo('teacher-hub'); }} className="hover:text-primary transition-colors">{t.nav_for_providers}</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold text-dark mb-4">{t.footer_support}</h4>
          <ul className="space-y-2 text-sm text-gray-500 font-sans">
            <li><a href="/how-it-works" onClick={(e) => { e.preventDefault(); navTo('how-it-works'); }} className="hover:text-primary transition-colors">{t.nav_howitworks}</a></li>
            <li><a href="/contact" onClick={(e) => { e.preventDefault(); navTo('contact'); }} className="hover:text-primary transition-colors">{t.nav_contact}</a></li>
            <li><a href="/about" onClick={(e) => { e.preventDefault(); navTo('about'); }} className="hover:text-primary transition-colors">{t.nav_about}</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold text-dark mb-4">{t.footer_legal_header}</h4>
          <ul className="space-y-2 text-sm text-gray-500 font-sans">
            <li><a href="/agb" onClick={(e) => { e.preventDefault(); navTo('agb'); }} className="hover:text-primary transition-colors">{t.legal_agb}</a></li>
            <li><a href="/datenschutz" onClick={(e) => { e.preventDefault(); navTo('datenschutz'); }} className="hover:text-primary transition-colors">{t.footer_privacy}</a></li>
            <li><a href="/impressum" onClick={(e) => { e.preventDefault(); navTo('impressum'); }} className="hover:text-primary transition-colors">{t.footer_legal}</a></li>
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