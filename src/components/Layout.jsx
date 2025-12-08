// src/components/Layout.jsx
import React, { useState } from 'react';
import { Menu, LogIn, LayoutDashboard, Lock, Globe } from 'lucide-react';
import { BRAND } from '../lib/constants';

// The Logo Component
export const KursNaviLogo = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 40 L48 55 L48 85 L10 70 Z" fill={BRAND.orange} />
    <path d="M52 55 L90 40 L90 70 L52 85 Z" fill={BRAND.orange} />
    <path d="M50 10 L55 30 L75 35 L55 40 L50 60 L45 40 L25 35 L45 30 Z" fill={BRAND.orange} />
  </svg>
);

// The Navbar Component
export const Navbar = ({ t, user, lang, setLang, setView, handleLogout, setShowResults }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center cursor-pointer" onClick={() => { setView('home'); setShowResults(false); }}>
             <KursNaviLogo className="w-10 h-10 mr-3" />
            <span className="font-['Open_Sans'] font-bold text-2xl text-[#333333] tracking-tight">KursNavi</span>
          </div>
          <div className="hidden md:flex items-center space-x-6 font-['Open_Sans']">
            <button onClick={() => { setView('home'); setShowResults(false); }} className="text-gray-600 hover:text-[#FA6E28] font-semibold">{t.nav_explore}</button>
            <button onClick={() => setView('about')} className="text-gray-600 hover:text-[#FA6E28] font-semibold">{t.nav_about}</button>
            {!user ? (
                <button onClick={() => setView('login')} className="text-gray-600 hover:text-[#FA6E28] font-semibold flex items-center"><LogIn className="w-4 h-4 mr-1" /> {t.nav_login}</button>
            ) : (
                <>
                    <button onClick={() => setView('dashboard')} className="text-gray-600 hover:text-[#FA6E28] font-semibold flex items-center"><LayoutDashboard className="w-4 h-4 mr-1" /> {t.nav_dashboard}</button>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 font-semibold text-sm">{t.nav_logout}</button>
                </>
            )}
            <div className="border-l pl-4 ml-4 flex space-x-2 text-sm font-semibold">
                {['en', 'de', 'fr'].map(l => (
                    <button key={l} onClick={() => setLang(l)} className={`${lang === l ? 'text-[#FA6E28] font-bold' : 'text-gray-400'}`}>{l.toUpperCase()}</button>
                ))}
            </div>
          </div>
           <div className="md:hidden flex items-center"><button onClick={() => setIsMenuOpen(!isMenuOpen)}><Menu /></button></div>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t p-4 space-y-4 shadow-lg font-['Open_Sans']">
             <button onClick={() => {setView('home'); setIsMenuOpen(false); setShowResults(false);}} className="block w-full text-left py-2 font-medium">{t.nav_explore}</button>
             <button onClick={() => {setView('about'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_about}</button>
             <button onClick={() => {setView('login'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_login}</button>
        </div>
      )}
    </nav>
  );
};

// The Footer Component
export const Footer = ({ t, setView }) => (
    <footer className="bg-white border-t border-gray-200 py-12 mt-auto font-['Hind_Madurai']">
        <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div><div className="flex items-center mb-4"><KursNaviLogo className="w-8 h-8 mr-2" /><span className="font-bold text-xl text-[#333333] font-['Open_Sans']">KursNavi</span></div><p className="text-sm text-gray-500">{t.about_subtitle}</p></div>
                <div><h4 className="font-bold text-[#333333] mb-4 font-['Open_Sans']">Platform</h4><ul className="space-y-2 text-sm text-gray-500"><li><button onClick={() => setView('home')} className="hover:text-[#FA6E28]">Home</button></li><li><button onClick={() => setView('about')} className="hover:text-[#FA6E28]">{t.nav_about}</button></li><li><button onClick={() => setView('contact')} className="hover:text-[#FA6E28]">{t.nav_contact}</button></li></ul></div>
                <div><h4 className="font-bold text-[#333333] mb-4 font-['Open_Sans']">Legal</h4><ul className="space-y-2 text-sm text-gray-500"><li><button onClick={() => setView('terms')} className="hover:text-[#FA6E28]">{t.footer_terms}</button></li><li><button onClick={() => setView('privacy')} className="hover:text-[#FA6E28]">{t.footer_privacy}</button></li><li><button onClick={() => setView('contact')} className="hover:text-[#FA6E28]">{t.footer_legal}</button></li></ul></div>
                <div><h4 className="font-bold text-[#333333] mb-4 font-['Open_Sans']">Admin</h4><button onClick={() => setView('admin_login')} className="text-sm text-gray-500 hover:text-[#FA6E28] flex items-center"><Lock className="w-3 h-3 mr-1" /> Admin Access</button></div>
            </div>
            <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
                <div>© 2024 KursNavi Schweiz AG. All rights reserved.</div>
                <div className="flex items-center space-x-2 mt-4 md:mt-0"><Globe className="w-4 h-4" /><span>{t.footer_madein}</span></div>
            </div>
        </div>
    </footer>
);