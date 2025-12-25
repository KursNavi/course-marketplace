import React from 'react';
import { Search, ArrowRight } from 'lucide-react';
// IMPORT THE FILTERS WE CREATED
import { CategoryDropdown, LocationDropdown } from './Filters';

export const Home = ({ t, setView, setSelectedCatPath, searchQuery, setSearchQuery, catMenuOpen, setCatMenuOpen, catMenuRef, locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, getCatLabel }) => {
  
  // 1. Handle text search -> Redirect to search page
  const handleSearch = (e) => {
    e.preventDefault();
    setView('search'); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 2. NEW: Handle Category Selection -> Redirect immediately to search page
  const handleCategorySelect = (path) => {
    setSelectedCatPath(path); // Save the selection
    setView('search');        // Switch to search view
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
  };

  return (
    <div className="flex flex-col w-full">
      
      {/* 1. HERO SECTION */}
      <div className="relative h-[600px] w-full flex items-center justify-center">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2671&auto=format&fit=crop")' }}
        ></div>
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 z-10"></div>

        {/* Content */}
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto w-full">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6 tracking-tight">
            {t.home_headline}
          </h1>
          <p className="text-lg md:text-xl text-gray-100 mb-8 font-sans max-w-2xl mx-auto leading-relaxed">
            {t.home_subhead}
          </p>

          {/* SEARCH & FILTERS CONTAINER */}
          <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-2xl">
            {/* Row 1: Search Bar */}
            <form onSubmit={handleSearch} className="relative flex items-center mb-4">
                <Search className="absolute left-4 text-gray-400 w-5 h-5 z-10" />
                <input 
                type="text" 
                placeholder={t.search_placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl text-dark font-sans shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-lg placeholder-gray-500 bg-white"
                />
                <button type="submit" className="absolute right-2 bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition-colors duration-300">
                {t.btn_search}
                </button>
            </form>

            {/* Row 2: Filters (Category & Location) */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 bg-white rounded-xl">
                    <CategoryDropdown 
                        rootCategory={null} 
                        selectedCatPath={[]} 
                        // HERE IS THE FIX: Use our new wrapper function
                        setSelectedCatPath={handleCategorySelect} 
                        catMenuOpen={catMenuOpen} 
                        setCatMenuOpen={setCatMenuOpen} 
                        t={t} 
                        getCatLabel={getCatLabel} 
                        catMenuRef={catMenuRef} 
                    />
                </div>
                <div className="flex-1 bg-white rounded-xl">
                    <LocationDropdown 
                        locMode={locMode} 
                        setLocMode={setLocMode} 
                        selectedLocations={selectedLocations} 
                        setSelectedLocations={setSelectedLocations} 
                        locMenuOpen={locMenuOpen} 
                        setLocMenuOpen={setLocMenuOpen} 
                        locMenuRef={locMenuRef} 
                        t={t} 
                    />
                </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. CATEGORY PREVIEW */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h2 className="text-3xl font-heading font-bold text-dark mb-2 text-center">{t.home_path_title}</h2>
        <p className="text-gray-500 text-center mb-12 font-sans">{t.home_path_sub}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div onClick={() => setView('landing-prof')} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2670&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_professional}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">{t.home_card_prof_sub}</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

          <div onClick={() => setView('landing-private')} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=2669&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_private}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">{t.home_card_priv_sub}</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

          <div onClick={() => setView('landing-kids')} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2622&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_kids}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">{t.home_card_kids_sub}</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                {t.btn_explore} <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};