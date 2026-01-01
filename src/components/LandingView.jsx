import React from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { CATEGORY_HIERARCHY } from '../lib/constants';

const LandingView = ({ title, subtitle, variant, searchQuery, setSearchQuery, handleSearchSubmit, setSelectedCatPath, setView, t, getCatLabel }) => {
    let categories = {};
    let rootCategory = "";
    let bgImage = "";
      
    if (variant === 'private') {
        categories = CATEGORY_HIERARCHY["Private & Hobby"];
        rootCategory = "Private & Hobby";
        bgImage = "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000"; 
    } else if (variant === 'prof') {
        categories = CATEGORY_HIERARCHY["Professional"];
        rootCategory = "Professional";
        bgImage = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=2000"; 
    } else if (variant === 'kids') {
        categories = CATEGORY_HIERARCHY["Children"];
        rootCategory = "Children";
        bgImage = "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&q=80&w=2000"; 
    }

    const handleCategoryClick = (subCat) => {
        setSelectedCatPath([rootCategory, subCat]);
        setView('search');
        window.scrollTo(0, 0);
    };

    return (
        <div className="min-h-screen bg-beige font-sans">
            <div className="relative py-24 px-4 text-center text-white overflow-hidden" style={{ backgroundColor: '#2d2d2d' }}>
                <div className="absolute inset-0 z-0">
                    <img src={bgImage} alt={title} className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                    <div className="absolute inset-0 bg-black/60"></div>
                </div>
                <div className="relative z-10 max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-heading font-bold mb-4 drop-shadow-md animate-in fade-in slide-in-from-bottom-4 duration-700">{title}</h1>
                    <p className="text-xl md:text-2xl text-gray-100 mb-10 max-w-2xl mx-auto drop-shadow-sm font-light">{subtitle}</p>
                    <div className="max-w-xl mx-auto relative group">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.search_placeholder}
                            className="w-full px-6 py-4 rounded-full text-dark focus:outline-none focus:ring-4 focus:ring-primary/50 text-lg shadow-xl transition-all"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                        />
                        <button onClick={handleSearchSubmit} className="absolute right-2 top-2 bg-primary text-white p-2.5 rounded-full hover:bg-orange-600 transition shadow-md group-hover:scale-105">
                            <Search className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 py-16">
                <h2 className="text-2xl font-bold text-dark mb-8 font-heading text-center border-b border-gray-200 pb-4">Explore Categories</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {Object.keys(categories).map((catName) => (
                        <div key={catName} onClick={() => handleCategoryClick(catName)} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-gray-100 group">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-dark group-hover:text-primary transition-colors">{getCatLabel(catName)}</h3>
                                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors group-hover:translate-x-1" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {categories[catName].slice(0, 4).map(sub => (
                                    <span key={sub} className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded border border-gray-100">{getCatLabel(sub)}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LandingView;