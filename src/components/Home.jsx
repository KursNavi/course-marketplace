import React from 'react';
import { Search, ArrowRight, Star, Shield, Users } from 'lucide-react';

export const Home = ({ t, setView, setSelectedCatPath }) => {
  
  // Helper to handle search (placeholder function)
  const handleSearch = (e) => {
    e.preventDefault();
    setView('landing-prof'); // For now, redirect to professional listing
  };

  return (
    <div className="flex flex-col w-full">
      
      {/* 1. HERO SECTION [Matches Style Guide Page 32] */}
      {/* We use an overlay (bg-black/40) to ensure text contrast per Source 76 */}
      <div className="relative h-[600px] w-full flex items-center justify-center">
        {/* Background Image: A clean, creative workspace mood [Source: 84] */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2671&auto=format&fit=crop")' }}
        ></div>
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 z-10"></div>

        {/* Content */}
        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6 tracking-tight">
            {/* Exact text from Source 283-284 */}
            Navigate Your Future with <span className="text-primary">KursNavi</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-100 mb-8 font-sans max-w-2xl mx-auto leading-relaxed">
            {/* Exact text from Source 286 */}
            Discover courses, gain new skills, and unlock your potential with expert-led learning tailored to your goals.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto relative flex items-center">
            <input 
              type="text" 
              placeholder={t.search_placeholder || "What do you want to learn?"}
              className="w-full px-6 py-4 rounded-full text-dark font-sans shadow-xl focus:outline-none focus:ring-4 focus:ring-primary/30 text-lg placeholder-gray-400"
            />
            <button type="submit" className="absolute right-2 bg-primary hover:bg-orange-600 text-white p-3 rounded-full transition-colors duration-300">
              <Search className="w-6 h-6" />
            </button>
          </form>

          {/* Trust Badges */}
          <div className="mt-10 flex justify-center space-x-8 text-white/80 text-sm font-sans font-medium">
            <div className="flex items-center"><Shield className="w-4 h-4 mr-2 text-primary" /> Verified Tutors</div>
            <div className="flex items-center"><Users className="w-4 h-4 mr-2 text-primary" /> 10k+ Students</div>
            <div className="flex items-center"><Star className="w-4 h-4 mr-2 text-primary" /> 4.9/5 Rating</div>
          </div>
        </div>
      </div>

      {/* 2. CATEGORY PREVIEW */}
      <div className="py-20 bg-beige max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h2 className="text-3xl font-heading font-bold text-dark mb-2 text-center">Choose Your Path</h2>
        <p className="text-gray-500 text-center mb-12 font-sans">Explore our most popular learning directions</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1: Professional */}
          <div 
            onClick={() => setView('landing-prof')}
            className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2670&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_professional}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">Advance your career with certified skills.</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                Explore <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

          {/* Card 2: Private & Hobby */}
          <div 
            onClick={() => setView('landing-private')}
            className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=2669&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_private}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">Cooking, Photography, Sports & more.</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                Explore <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

          {/* Card 3: Kids */}
          <div 
            onClick={() => setView('landing-kids')}
            className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2622&auto=format&fit=crop")' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="text-2xl font-bold text-white font-heading mb-1">{t.nav_kids}</h3>
              <p className="text-gray-300 text-sm font-sans mb-4">Fun and engaging courses for children.</p>
              <span className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wider group-hover:text-white transition-colors">
                Explore <ArrowRight className="w-4 h-4 ml-2" />
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};