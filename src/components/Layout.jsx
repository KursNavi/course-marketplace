import React, { useState } from 'react';
import { Menu, X, Globe, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';

export const KursNaviLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const Navbar = ({ t, user, lang, setLang, setView, handleLogout, setShowResults, setSelectedCatPath }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // UPDATED: Using text codes instead of emojis to ensure Windows displays DE/EN correctly
  const languages = [
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'it', label: 'Italiano', short: 'IT' },
    { code: 'en', label: 'English', short: 'EN' },
  ];

  // Helper to handle navigation to specific categories
  const navTo = (viewName, catPath = []) => {
    setView(viewName);
    if (setSelectedCatPath) setSelectedCatPath(catPath);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          
          {/* LOGO & MAIN LINKS */}
          <div className="flex items-center">
            <div onClick={() => navTo('home')} className="flex-shrink-0 flex items-center cursor-pointer group">
              <KursNaviLogo className="h-8 w-8 text-[#FA6E28] group-hover:scale-110 transition-transform" />
              <span className="ml-2 text-2xl font-bold tracking-tighter text-[#333333]">Kurs<span className="text-[#FA6E28]">Navi</span></span>
            </div>
            
            {/* DESKTOP NAV LINKS (TRANSLATED) */}
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              <button onClick={() => navTo('landing-private', ['Private & Hobby'])} className="text-gray-500 hover:text-[#FA6E28] px-3 py-2 rounded-md text-sm font-medium transition-colors">{t.nav_private}</button>
              <button onClick={() => navTo('landing-prof', ['Professional'])} className="text-gray-500 hover:text-[#FA6E28] px-3 py-2 rounded-md text-sm font-medium transition-colors">{t.nav_professional}</button>
              <button onClick={() => navTo('landing-kids', ['Children'])} className="text-gray-500 hover:text-[#FA6E28] px-3 py-2 rounded-md text-sm font-medium transition-colors">{t.nav_kids}</button>
              <button onClick={() => navTo('how-it-works')} className="text-gray-500 hover:text-[#FA6E28] px-3 py-2 rounded-md text-sm font-medium transition-colors">{t.nav_howitworks}</button>
            </div>
          </div>

          {/* RIGHT SIDE (User & Lang) */}
          <div className="hidden md:flex items-center space-x-4">
            
            {/* LANGUAGE DROPDOWN */}
            <div className="relative">
                <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="flex items-center space-x-1 text-gray-500 hover:text-[#FA6E28] p-2 rounded-full transition hover:bg-gray-50">
                    <Globe className="w-5 h-5" />
                    <span className="font-bold text-xs uppercase">{lang}</span>
                    <ChevronDown className="w-3 h-3" />
                </button>
                
                {langMenuOpen && (
                    <>
                    <div className="fixed inset-0 z-10" onClick={() => setLangMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                        {languages.map((l) => (
                            <button
                                key={l.code}
                                onClick={() => { setLang(l.code); setLangMenuOpen(false); }}
                                className={`block w-full text-left px-4 py-3 text-sm hover:bg-orange-50 hover:text-[#FA6E28] transition flex items-center ${lang === l.code ? 'font-bold text-[#FA6E28] bg-orange-50/50' : 'text-gray-700'}`}
                            >
                                <span className={`mr-3 font-bold w-6 ${lang === l.code ? 'text-[#FA6E28]' : 'text-gray-400'}`}>{l.short}</span>
                                {l.label}
                            </button>
                        ))}
                    </div>
                    </>
                )}
            </div>

            {user ? (
              <div className="flex items-center space-x-4">
                <button onClick={() => navTo('dashboard')} className="flex items-center text-gray-700 hover:text-[#FA6E28] font-medium"><LayoutDashboard className="w-4 h-4 mr-2" />{user.role === 'teacher' ? t.nav_dashboard : t.student_dash}</button>
                <button onClick={handleLogout} className="flex items-center text-gray-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
              </div>
            ) : (
              <button onClick={() => navTo('login')} className="bg-[#333333] text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-black transition shadow-lg hover:-translate-y-0.5">{t.nav_login}</button>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <div className="flex items-center md:hidden">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-500 hover:text-[#FA6E28] p-2">
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 absolute w-full left-0 shadow-xl h-screen overflow-y-auto pb-20">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <button onClick={() => navTo('landing-private', ['Private & Hobby'])} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-[#FA6E28]">{t.nav_private}</button>
            <button onClick={() => navTo('landing-prof', ['Professional'])} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-[#FA6E28]">{t.nav_professional}</button>
            <button onClick={() => navTo('landing-kids', ['Children'])} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-[#FA6E28]">{t.nav_kids}</button>
            <button onClick={() => navTo('how-it-works')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-orange-50 hover:text-[#FA6E28]">{t.nav_howitworks}</button>
            
            {/* MOBILE LANGUAGES */}
            <div className="border-t border-gray-100 my-2 pt-2">
                <p className="px-3 text-xs font-bold text-gray-400 uppercase mb-2">Language</p>
                <div className="grid grid-cols-2 gap-2 px-3">
                    {languages.map((l) => (
                        <button key={l.code} onClick={() => { setLang(l.code); setMobileMenuOpen(false); }} className={`flex items-center justify-center py-2 rounded-lg border text-sm ${lang === l.code ? 'border-[#FA6E28] text-[#FA6E28] bg-orange-50 font-bold' : 'border-gray-200 text-gray-600'}`}>
                            <span className="mr-2 font-bold">{l.short}</span>{l.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-t border-gray-100 my-2 pt-2">
                {user ? (
                    <>
                        <button onClick={() => navTo('dashboard')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">{t.nav_dashboard}</button>
                        <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-500 hover:bg-red-50">{t.nav_logout}</button>
                    </>
                ) : (
                    <button onClick={() => navTo('login')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-[#FA6E28] font-bold">{t.nav_login}</button>
                )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export const Footer = ({ t, setView }) => (
  <footer className="bg-white border-t border-gray-200 py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center mb-4 text-[#333333] font-bold text-xl"><KursNaviLogo className="h-6 w-6 text-[#FA6E28] mr-2" /> KursNavi</div>
          <p className="text-gray-500 text-sm">{t.footer_madein}</p>
        </div>
        <div>
          <h4 className="font-bold text-[#333333] mb-4">Discover</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li onClick={() => setView('landing-private')} className="hover:text-[#FA6E28] cursor-pointer">{t.nav_private}</li>
            <li onClick={() => setView('landing-prof')} className="hover:text-[#FA6E28] cursor-pointer">{t.nav_professional}</li>
            <li onClick={() => setView('landing-kids')} className="hover:text-[#FA6E28] cursor-pointer">{t.nav_kids}</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-[#333333] mb-4">Support</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li onClick={() => setView('how-it-works')} className="hover:text-[#FA6E28] cursor-pointer">{t.nav_howitworks}</li>
            <li onClick={() => setView('contact')} className="hover:text-[#FA6E28] cursor-pointer">{t.nav_contact}</li>
            <li onClick={() => setView('about')} className="hover:text-[#FA6E28] cursor-pointer">{t.nav_about}</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-[#333333] mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li><a href="/agb" className="hover:text-[#FA6E28]">AGB</a></li>
            <li><a href="/datenschutz" className="hover:text-[#FA6E28]">Datenschutz</a></li>
            <li><a href="/impressum" className="hover:text-[#FA6E28]">Impressum</a></li>
            <li><a href="/widerruf-storno" className="hover:text-[#FA6E28]">Widerruf & Stornierung</a></li>
            <li><a href="/vertrauen-sicherheit" className="hover:text-[#FA6E28]">Vertrauen & Sicherheit</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center">
        <p className="text-gray-400 text-sm">&copy; {new Date().getFullYear()} KursNavi AG. {t.footer_rights}</p>
        <div className="flex items-center text-gray-400 text-sm mt-4 md:mt-0"><Globe className="w-4 h-4 mr-2" /> Zürich, CH</div>
      </div>
    </div>
  </footer>
);