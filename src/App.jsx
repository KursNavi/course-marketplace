import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, CheckCircle, ArrowLeft, LogIn, LayoutDashboard, Settings, Trash2, DollarSign, Lock, Calendar, ExternalLink, ChevronDown, ChevronRight, Mail, Phone, Loader, Heart, Shield, X, BookOpen, Star, Zap, Users, Briefcase, Smile, Music, ArrowRight, Save, Filter, PenTool, Info, Eye, HelpCircle, Plus, Minus } from 'lucide-react';

// --- IMPORTS ---
import { BRAND, CATEGORY_HIERARCHY, CATEGORY_LABELS, SWISS_CANTONS, SWISS_CITIES, TRANSLATIONS } from './lib/constants';
import { Navbar, Footer, KursNaviLogo } from './components/Layout';
import { Home } from './components/Home';
import LegalPage from './components/LegalPage';
import { CategoryDropdown, LocationDropdown } from './components/Filters';

// --- Supabase Setup ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- ARCHITECT COMPONENT: Landing View (Category Pages) ---
const LandingView = ({ title, subtitle, variant, searchQuery, setSearchQuery, handleSearchSubmit, setSelectedCatPath, setView, t, getCatLabel }) => {
    let categories = {};
    let rootCategory = "";
    let bgImage = "";
      
    // Select data and images based on the variant
    if (variant === 'private') {
        categories = CATEGORY_HIERARCHY["Private & Hobby"];
        rootCategory = "Private & Hobby";
        // Art/Painting Image
        bgImage = "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000"; 
    } else if (variant === 'prof') {
        categories = CATEGORY_HIERARCHY["Professional"];
        rootCategory = "Professional";
        // Modern office image
        bgImage = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=2000"; 
    } else if (variant === 'kids') {
        categories = CATEGORY_HIERARCHY["Children"];
        rootCategory = "Children";
        // Kids playing image
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

// --- ARCHITECT COMPONENT: Search Page View ---
const SearchPageView = ({ selectedCatPath, setSelectedCatPath, searchQuery, setSearchQuery, catMenuOpen, setCatMenuOpen, catMenuRef, t, getCatLabel, locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, loading, filteredCourses, setSelectedCourse, setView, filterDate, setFilterDate, filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel, filterPro, setFilterPro }) => {
    const activeSection = selectedCatPath.length > 0 ? selectedCatPath[0] : null;

    return (
        <div className="min-h-screen bg-beige">
            <div className="bg-white border-b pt-8 pb-4 sticky top-20 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input type="text" placeholder={t.search_refine} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-beige border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                        </div>
                        <CategoryDropdown rootCategory={activeSection} selectedCatPath={selectedCatPath} setSelectedCatPath={setSelectedCatPath} catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} t={t} getCatLabel={getCatLabel} catMenuRef={catMenuRef} /> 
                        <LocationDropdown locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} />
                        {(selectedCatPath.length > 0 || selectedLocations.length > 0 || filterDate || filterPriceMax || filterLevel !== 'All' || filterPro) && (<button onClick={() => { setSelectedCatPath([]); setSelectedLocations([]); setSearchQuery(""); setFilterDate(""); setFilterPriceMax(""); setFilterLevel("All"); setFilterPro(false); }} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100" title="Reset all filters"><X className="w-5 h-5" /></button>)}
                    </div>
                    {/* NEW FILTERS ROW */}
                    <div className="flex gap-4 overflow-x-auto pb-2 items-center">
                        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <input type="date" placeholder="dd/mm/yyyy" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600 placeholder-gray-400" />
                        </div>
                        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <span className="text-sm text-gray-500">{t.lbl_max_price}</span>
                            <input type="number" placeholder="Any" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-16 bg-transparent text-sm outline-none text-gray-600" />
                        </div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm outline-none text-gray-600">
                            <option value="All">{t.opt_all_levels}</option>
                            <option value="Beginner">{t.opt_beginner}</option><option value="Advanced">{t.opt_advanced}</option>
                        </select>
                         <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterPro ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`} title={t.tooltip_pro_verified}>
                            <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span className={`text-sm font-medium ${filterPro ? 'text-blue-700' : 'text-gray-600'}`}>{t.lbl_professional_filter}</span>
                            <Info className="w-3 h-3 text-gray-400" />
                        </label>
                    </div>
                </div>
                 {(selectedCatPath.length > 0 || selectedLocations.length > 0) && (
                    <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2 flex-wrap">
                        {selectedCatPath.map((part, i) => (
                            <span key={i} onClick={() => setSelectedCatPath(selectedCatPath.slice(0, i))} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-orange-200 flex items-center">
                                {getCatLabel(part)} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        ))}
                        {selectedLocations.map((loc, i) => (
                            <span key={i} onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">
                                {loc} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        ))}
                    </div>
                 )}
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                 {loading ? <div className="text-center py-20"><Loader className="animate-spin w-10 h-10 text-primary mx-auto" /></div> : filteredCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {filteredCourses.map(course => (
                      <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                        <div className="relative h-48 overflow-hidden">
                            <img src={course.image_url} alt={course.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                                <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm flex items-center"><MapPin className="w-3 h-3 mr-1 text-primary" />{course.canton}</div>
                                {course.is_pro && <div className="bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-bold shadow-sm flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Pro</div>}
                            </div>
                        </div>
                        <div className="p-5">
                            <h3 className="font-bold text-lg text-dark leading-tight line-clamp-2 h-12 mb-2 font-heading">{course.title}</h3>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                               <div className="flex items-center space-x-3 text-sm text-gray-500"><div className="flex items-center bg-beige px-2 py-1 rounded"><User className="w-3 h-3 text-gray-500 mr-1" />{course.instructor_name}</div></div>
                               <span className="font-bold text-primary text-lg font-heading">{t.currency} {course.price}</span>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300"><p className="text-gray-500 text-lg font-medium">{t.no_results}</p></div>}
            </main>
        </div>
    );
};

// --- Standard Views ---
const DetailView = ({ course, setView, t, handleBookCourse, setSelectedTeacher }) => {
    // Prepare events logic
    let displayEvents = [];
    if (course.course_events && course.course_events.length > 0) {
        displayEvents = course.course_events.map(ev => {
            const bookedCount = ev.bookings && ev.bookings[0] ? ev.bookings[0].count : 0;
            const max = ev.max_participants || 0; // 0 is unlimited
            const spotsLeft = max === 0 ? 999 : max - bookedCount;
            return { ...ev, spotsLeft, isFull: max > 0 && spotsLeft <= 0 };
        }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    } else {
        // Fallback for legacy courses or simple mode
        displayEvents = [{ 
            id: null, 
            start_date: course.start_date, 
            location: course.address, 
            spotsLeft: 999, 
            isFull: false 
        }];
    }

    return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
        <button onClick={() => setView('search')} className="flex items-center text-gray-500 hover:text-primary mb-6"><ArrowLeft className="w-4 h-4 mr-2"/> Back to Search</button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <img src={course.image_url} className="w-full h-80 object-cover rounded-2xl shadow-lg" alt={course.title} />
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold font-heading text-dark">{course.title}</h1>
                        {course.is_pro && (
                            <div className="flex flex-col items-start gap-1">
                                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-sm">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Professional
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
                        <button 
                            onClick={async () => {
                                const { data } = await supabase.from('profiles').select('*').eq('id', course.user_id).single();
                                if (data) { setSelectedTeacher(data); setView('teacher-profile'); window.scrollTo(0,0); }
                            }}
                            className="flex items-center bg-gray-50 px-3 py-1 rounded-full hover:bg-orange-50 hover:text-primary transition-colors cursor-pointer"
                        >
                            <User className="w-4 h-4 mr-2"/> {course.instructor_name} (Profil ansehen)
                        </button>
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><MapPin className="w-4 h-4 mr-2"/> {course.canton}</span>
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><Clock className="w-4 h-4 mr-2"/> {course.session_count} x {course.session_length}</span>
                    </div>
                    <div className="prose max-w-none text-gray-600">
                        <h3 className="text-xl font-bold text-dark mb-2">{t.lbl_description}</h3>
                        <p className="whitespace-pre-wrap mb-6">{course.description}</p>
                        <h3 className="text-xl font-bold text-dark mb-2">{t.lbl_learn_goals}</h3>
                        <ul className="list-disc pl-5 space-y-1 mb-6">
                            {course.objectives && course.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
                    <div className="text-3xl font-bold text-primary font-heading mb-2">CHF {course.price}</div>
                    <p className="text-gray-500 text-sm mb-6">per person</p>
                    
                    <h3 className="font-bold text-dark mb-3">Available Sessions</h3>
                    <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-1">
                        {displayEvents.map((ev, i) => (
                            <div key={i} className={`p-4 rounded-xl border transition ${ev.isFull ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-blue-100 hover:border-blue-300 hover:shadow-md'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center text-dark font-bold">
                                        <Calendar className="w-4 h-4 mr-2 text-primary"/>
                                        {ev.start_date ? new Date(ev.start_date).toLocaleDateString() : 'Flexible'}
                                    </div>
                                    {ev.isFull ? (
                                        <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded">SOLD OUT</span>
                                    ) : (
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">{ev.spotsLeft > 50 ? 'Available' : `${ev.spotsLeft} spots left`}</span>
                                    )}
                                </div>
                                <div className="flex items-center text-gray-500 text-sm mb-3">
                                    <MapPin className="w-4 h-4 mr-2"/> {ev.location || course.address}
                                </div>
                                <button 
                                    onClick={() => !ev.isFull && handleBookCourse(course, ev.id)} 
                                    disabled={ev.isFull}
                                    className={`w-full py-2 rounded-lg font-bold text-sm transition ${ev.isFull ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-orange-600 shadow-sm'}`}
                                >
                                    {ev.isFull ? 'Ausgebucht' : t.btn_book}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 space-y-4 text-sm text-gray-600 border-t pt-4">
                        <div className="flex items-center"><Shield className="w-5 h-5 mr-3 text-green-500"/> Secure Payment</div>
                        <div className="flex items-center"><CheckCircle className="w-5 h-5 mr-3 text-blue-500"/> Instant Confirmation</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};

const HowItWorksPage = ({ t, setView }) => {
    // Accordion State inside the component
    const [openFaq, setOpenFaq] = useState(null);
    const toggleFaq = (index) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    const faqs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    return (
        <div className="font-sans bg-beige min-h-screen">
            {/* HERO */}
            <div className="bg-dark text-white py-20 px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6">{t.how_it_works}</h1>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">Einfach, sicher und transparent. So findest du deinen nächsten Kurs oder startest als Anbieter durch.</p>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-16">
                
                {/* DUAL PROCESS SECTION */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
                    {/* STUDENTS */}
                    <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition duration-300">
                        <div className="absolute top-0 right-0 bg-orange-100 w-32 h-32 rounded-bl-full -mr-8 -mt-8 z-0"></div>
                        <h2 className="text-2xl font-bold text-primary mb-10 flex items-center relative z-10">
                            <Smile className="mr-3 w-8 h-8"/> {t.for_students}
                        </h2>
                        <div className="space-y-10 relative z-10">
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-primaryLight text-primary rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">1</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.student_step_1}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.student_desc_1}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-primaryLight text-primary rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">2</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.student_step_2}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.student_desc_2}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-primaryLight text-primary rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">3</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.student_step_3}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.student_desc_3}</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-10 text-center">
                            <button onClick={() => setView('search')} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md w-full sm:w-auto">
                                {t.btn_explore}
                            </button>
                        </div>
                    </div>

                    {/* TUTORS */}
                    <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition duration-300">
                        <div className="absolute top-0 right-0 bg-blue-100 w-32 h-32 rounded-bl-full -mr-8 -mt-8 z-0"></div>
                        <h2 className="text-2xl font-bold text-blue-600 mb-10 flex items-center relative z-10">
                            <Briefcase className="mr-3 w-8 h-8"/> {t.for_tutors}
                        </h2>
                        <div className="space-y-10 relative z-10">
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">1</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.tutor_step_1}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.tutor_desc_1}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">2</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.tutor_step_2}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.tutor_desc_2}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 mr-6">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">3</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2 text-dark">{t.tutor_step_3}</h3>
                                    <p className="text-gray-600 leading-relaxed">{t.tutor_desc_3}</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-10 text-center">
                            <button onClick={() => setView('login')} className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition shadow-md w-full sm:w-auto">
                                {t.cta_btn}
                            </button>
                        </div>
                    </div>
                </div>

                {/* FAQ SECTION */}
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HelpCircle className="w-8 h-8 text-gray-600"/>
                        </div>
                        <h2 className="text-3xl font-bold text-dark font-heading">{t.faq_title}</h2>
                    </div>

                    <div className="space-y-4">
                        {faqs.map((i) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
                                <button 
                                    onClick={() => toggleFaq(i)}
                                    className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                                >
                                    <span className="font-bold text-dark text-lg pr-4">{t[`faq_q${i}`]}</span>
                                    {openFaq === i ? <Minus className="w-5 h-5 text-primary flex-shrink-0" /> : <Plus className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                                </button>
                                <div 
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                                >
                                    <div className="p-5 pt-0 text-gray-600 leading-relaxed border-t border-gray-100 mt-2">
                                        {t[`faq_a${i}`]}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BOTTOM CTA */}
                <div className="mt-24 text-center bg-dark p-12 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold text-white mb-6 font-heading">{t.cta_title}</h2>
                        <p className="text-gray-300 mb-8 max-w-2xl mx-auto text-lg">{t.cta_subtitle}</p>
                        <button onClick={() => setView('login')} className="bg-primary text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition shadow-lg hover:scale-105">
                            {t.cta_btn}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

const ContactPage = ({ t, handleContactSubmit }) => (
    <div className="max-w-3xl mx-auto px-4 py-16 font-sans">
        <h1 className="text-4xl font-bold text-center text-dark font-heading mb-8">{t.contact_title}</h1>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <form onSubmit={handleContactSubmit} className="space-y-6">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_name}</label><input type="text" name="name" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_email}</label><input type="email" name="email" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_subject}</label><input type="text" name="subject" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_msg}</label><textarea name="message" rows="5" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"></textarea></div>
                <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition">{t.btn_send}</button>
            </form>
        </div>
    </div>
);

// --- NEW ABOUT PAGE COMPONENT (FIXED IMAGES & REDESIGNED BOXES) ---
const AboutPage = ({ t, setView }) => (
    <div className="font-sans">
        {/* HERO SECTION */}
        <div className="relative py-24 px-4 text-center text-white overflow-hidden" style={{ backgroundColor: '#2d2d2d' }}>
            <div className="absolute inset-0 z-0">
                <img src="https://images.unsplash.com/photo-1544928147-79a2dbc1f389?auto=format&fit=crop&q=80&w=2000" alt="Learning together" className="w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-black/60"></div>
            </div>
            <div className="relative z-10 max-w-4xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6 drop-shadow-md">{t.about_hero_title}</h1>
                <p className="text-lg md:text-xl text-gray-100 max-w-2xl mx-auto drop-shadow-sm font-light leading-relaxed mb-8">{t.about_hero_teaser}</p>
            </div>
        </div>

        {/* STORY SECTION */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_story_title}</h2>
                <div className="space-y-4 text-gray-600 text-lg leading-relaxed">
                    <p>{t.about_story_text_1}</p>
                    <p>{t.about_story_text_2}</p>
                    <p>{t.about_story_text_3}</p>
                </div>
            </div>
            <div>
                <img src="https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&q=80&w=1200" alt="Team KursNavi" className="rounded-2xl shadow-xl w-full h-auto object-cover transform hover:scale-105 transition-transform duration-500" />
            </div>
        </div>

        {/* WHAT WE DO (ICONS) - REDESIGNED */}
        <div className="bg-gray-50 py-20">
            <div className="max-w-7xl mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-dark font-heading mb-4">{t.about_what_title}</h2>
                <p className="text-gray-600 max-w-2xl mx-auto mb-16 text-lg">{t.about_what_intro}</p>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 relative">
                    {/* BOX 1 */}
                    <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex-1 flex flex-col items-center text-center z-10 relative">
                        <div className="w-20 h-20 bg-primaryLight text-primary rounded-2xl flex items-center justify-center mb-6 transform rotate-3 group-hover:rotate-6 transition-transform">
                            <Search className="w-10 h-10"/>
                        </div>
                        <h3 className="font-bold text-xl mb-2">{t.about_micro_1}</h3>
                        <p className="text-gray-500">{t.about_benefit_1}</p>
                    </div>

                    {/* CONNECTOR 1 */}
                    <div className="hidden md:block text-primary/30 z-0">
                        <ArrowRight className="w-12 h-12" />
                    </div>

                    {/* BOX 2 */}
                    <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex-1 flex flex-col items-center text-center z-10 relative">
                        <div className="w-20 h-20 bg-primaryLight text-primary rounded-2xl flex items-center justify-center mb-6 transform -rotate-3 group-hover:-rotate-6 transition-transform">
                            <Calendar className="w-10 h-10"/>
                        </div>
                        <h3 className="font-bold text-xl mb-2">{t.about_micro_2}</h3>
                        <p className="text-gray-500">{t.about_benefit_2}</p>
                    </div>

                    {/* CONNECTOR 2 */}
                    <div className="hidden md:block text-primary/30 z-0">
                        <ArrowRight className="w-12 h-12" />
                    </div>

                    {/* BOX 3 */}
                    <div className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex-1 flex flex-col items-center text-center z-10 relative">
                        <div className="w-20 h-20 bg-primaryLight text-primary rounded-2xl flex items-center justify-center mb-6 transform rotate-3 group-hover:rotate-6 transition-transform">
                            <Smile className="w-10 h-10"/>
                        </div>
                        <h3 className="font-bold text-xl mb-2">{t.about_micro_3}</h3>
                        <p className="text-gray-500">{t.about_benefit_4}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* FOR YOU - FIXED IMAGE */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
                <img src="https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&q=80&w=1200" alt="Hands on learning" className="rounded-2xl shadow-xl w-full h-auto object-cover" />
            </div>
            <div className="order-1 md:order-2">
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_you_title}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">{t.about_you_text}</p>
            </div>
        </div>

        {/* FOR KIDS - FIXED IMAGE */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center bg-white">
            <div>
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_kids_title}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">{t.about_kids_text}</p>
                <div className="bg-primaryLight/30 p-4 rounded-lg border border-primary/20">
                     <p className="text-primary font-medium">{t.about_kids_sub}</p>
                </div>
            </div>
            <div>
                <img src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&q=80&w=1200" alt="Kids learning" className="rounded-2xl shadow-xl w-full h-auto object-cover" />
            </div>
        </div>

        {/* FOR PROVIDERS */}
        <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
                <img src="https://images.unsplash.com/photo-1544531586-fde5298cdd40?auto=format&fit=crop&q=80&w=1200" alt="Teacher instructing" className="rounded-2xl shadow-xl w-full h-auto object-cover" />
            </div>
            <div className="order-1 md:order-2">
                <h2 className="text-3xl font-bold text-dark font-heading mb-6">{t.about_prov_title}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">{t.about_prov_text}</p>
            </div>
        </div>

        {/* CTA SECTION */}
        <div className="bg-dark text-white py-20 text-center">
            <div className="max-w-3xl mx-auto px-4">
                <h2 className="text-3xl font-bold font-heading mb-6">{t.about_promise_title}</h2>
                <p className="text-xl text-gray-300 mb-10">{t.about_promise_text}</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => setView('search')} className="bg-primary text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition shadow-lg hover:scale-105">{t.about_cta_primary}</button>
                    <button onClick={() => setView('login')} className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-dark transition shadow-lg">{t.about_cta_secondary}</button>
                </div>
            </div>
            <div className="mt-12 max-w-4xl mx-auto px-4">
                 <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=1200" alt="Happy group" className="rounded-2xl shadow-2xl w-full h-64 object-cover opacity-80" />
            </div>
        </div>
    </div>
);

// --- ARCHITECT COMPONENT: Admin Panel with Secret Login ---
const AdminPanel = ({ t, courses, setCourses, showNotification }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [activeTab, setActiveTab] = useState("teachers");
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);

    // SECURITY: The secret password (MVP Version)
    const ADMIN_PW = "KursNavi2025!";

    useEffect(() => {
        if (isAuthenticated) {
            fetchProfiles();
        }
    }, [isAuthenticated]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_PW) {
            setIsAuthenticated(true);
        } else {
            showNotification("Access Denied");
            setPassword("");
        }
    };

    const fetchProfiles = async () => {
        setLoading(true);
        // In a real app we'd use pagination. Here we grab all.
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) {
            showNotification("Error loading users");
        } else {
            setProfiles(data || []);
        }
        setLoading(false);
    };

    const toggleVerify = async (userId, currentStatus, userEmail) => {
        const newStatus = !currentStatus;
        
        // 1. Profil aktualisieren & Status setzen
        const { error: profileError } = await supabase.from('profiles').update({ 
            is_professional: newStatus,
            verification_status: newStatus ? 'verified' : 'pending' 
        }).eq('id', userId);
        
        if (profileError) {
            showNotification("Error updating profile.");
            return;
        }

        // 2. ALLE Kurse dieses Lehrers gleichzeitig aktualisieren
        const { error: courseError } = await supabase.from('courses').update({ is_pro: newStatus }).eq('user_id', userId);
        
        if (courseError) {
            showNotification("Profile updated, but courses failed.");
        } else {
            setProfiles(profiles.map(p => p.id === userId ? { ...p, is_professional: newStatus, verification_status: newStatus ? 'verified' : 'pending' } : p));
            showNotification(newStatus ? "User verifiziert!" : "Verifizierung entfernt.");
            
            // AUTOMATIC EMAIL TRIGGER (Mailto)
            if (newStatus && userEmail) {
                const subject = "Glückwunsch: Dein Profil ist verifiziert!";
                const body = "Hallo,\n\nwir haben deine Unterlagen geprüft und dein Profil erfolgreich verifiziert. Du hast jetzt den 'Professional' Status und das blaue Häkchen.\n\nViel Erfolg!\nDein KursNavi Team";
                window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }

            if (typeof fetchCourses === 'function') fetchCourses();
        }
    };

    // Filter Logic
    const teachers = profiles.filter(p => p.role === 'teacher');
    const students = profiles.filter(p => p.role === 'student' || !p.role);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-gray-700" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">{t.admin_login_title}</h1>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder={t.admin_pass_placeholder}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 outline-none transition"
                        />
                        <button type="submit" className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-black transition">
                            {t.admin_btn_access}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 font-heading">{t.admin_panel}</h1>
                    <button onClick={() => setIsAuthenticated(false)} className="text-red-500 hover:underline">Exit</button>
                </div>

                {/* TABS */}
                <div className="flex space-x-4 mb-8">
                    <button onClick={() => setActiveTab('teachers')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'teachers' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_teachers}</button>
                    <button onClick={() => setActiveTab('students')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_students}</button>
                    <button onClick={() => setActiveTab('courses')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'courses' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_courses}</button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center"><Loader className="animate-spin mx-auto w-8 h-8 text-blue-600" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_name}</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_email}</th>
                                        {activeTab !== 'courses' && <th className="px-6 py-4 font-semibold text-gray-600">Location</th>}
                                        {activeTab === 'courses' && <th className="px-6 py-4 font-semibold text-gray-600">Price</th>}
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_status}</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600 text-right">{t.admin_col_actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {activeTab === 'teachers' && teachers.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold">{user.full_name}</div>
                                                {user.certificates && user.certificates.length > 0 && (
                                                    <div className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full w-fit mt-1 flex items-center font-medium">
                                                        <Shield className="w-3 h-3 mr-1" /> {user.certificates.length} Zertifikate
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">{user.email}</td>
                                            <td className="px-6 py-4">{user.city}, {user.canton}</td>
                                            <td className="px-6 py-4">
                                                {user.is_professional ? (
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold flex w-fit items-center"><CheckCircle className="w-3 h-3 mr-1"/> {t.admin_verified}</span>
                                                ) : <span className="text-gray-400 text-sm">Standard</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => alert(`--- LEHRER PROFIL ---\n\nBIOGRAFIE:\n${user.bio_text || 'Keine Biografie vorhanden.'}\n\nZERTIFIKATE:\n${user.certificates && user.certificates.length > 0 ? user.certificates.map(c => '- ' + c).join('\n') : 'Keine Zertifikate hochgeladen.'}`)}
                                                    className="text-gray-500 hover:text-primary p-2 rounded-md hover:bg-gray-100 transition"
                                                    title="Details ansehen"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>

                                            {/* DOCUMENT LINK BUTTON */}
                                            {user.verification_docs && user.verification_docs.length > 0 && (
                                                <a 
                                                    href={user.verification_docs[0]} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="text-blue-500 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                                                    title="Verifizierungs-Dokument ansehen"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}

                                            <button onClick={() => toggleVerify(user.id, user.is_professional, user.email)}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded transition ${user.is_professional ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                                >
                                                    {user.is_professional ? t.admin_btn_unverify : t.admin_btn_verify}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {activeTab === 'students' && students.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold">{user.full_name}</td>
                                            <td className="px-6 py-4 text-gray-500">{user.email}</td>
                                            <td className="px-6 py-4">{user.city}, {user.canton}</td>
                                            <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Student</span></td>
                                            <td className="px-6 py-4 text-right"><span className="text-gray-400 text-xs">-</span></td>
                                        </tr>
                                    ))}
                                    {activeTab === 'courses' && courses.map(course => (
                                        <tr key={course.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold">{course.title}</td>
                                            <td className="px-6 py-4 text-gray-500">{course.instructor_name}</td>
                                            <td className="px-6 py-4">CHF {course.price}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{new Date(course.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-blue-500 hover:underline text-sm mr-3">Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const UserProfileSection = ({ user, showNotification, setLang, t }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState('none'); // none, pending, verified
    
    const [formData, setFormData] = useState({
        city: '', canton: '', bio_text: '', certificates: '', preferred_language: 'de', email: user.email, password: '', confirmPassword: ''
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.id) return;
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) { 
                setFormData(prev => ({ 
                    ...prev, 
                    city: data.city || '', 
                    canton: data.canton || '', 
                    // MAP DB TO FORM: Use bio_text to match public profile
                    bio_text: data.bio_text || '', 
                    // MAP DB ARRAY TO STRING: Join with newlines for textarea
                    certificates: data.certificates ? data.certificates.join('\n') : '',
                    preferred_language: data.preferred_language || 'de' 
                }));
                if (data.verification_status) setVerificationStatus(data.verification_status);
            }
            setLoading(false);
        };
        fetchProfile();
    }, [user]);

    const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        
        // LOGIC: Convert textarea string back to array for DB
        const certArray = formData.certificates.split('\n').filter(line => line.trim() !== '');

        // UPDATE: Saving to bio_text and certificates column
        const { error } = await supabase.from('profiles').update({ 
            city: formData.city, 
            canton: formData.canton, 
            bio_text: formData.bio_text, 
            certificates: certArray,
            preferred_language: formData.preferred_language 
        }).eq('id', user.id);

        if (error) { showNotification("Error saving profile"); setSaving(false); return; }

        if (formData.email !== user.email || formData.password) {
            if (formData.password && formData.password !== formData.confirmPassword) { showNotification("Passwords do not match!"); setSaving(false); return; }
            const updates = {}; if (formData.email !== user.email) updates.email = formData.email; if (formData.password) updates.password = formData.password;
            const { error: authError } = await supabase.auth.updateUser(updates);
            if (authError) { showNotification("Error updating account: " + authError.message); } else { showNotification(t.msg_auth_success); }
        } else { showNotification("Profile saved successfully!"); }
        
        setLang(formData.preferred_language); setSaving(false);
    };

    const handleDocUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setUploadingDoc(true);

        const newDocUrls = [];

        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.error("Upload failed", uploadError);
                continue; 
            }

            const { data: { signedUrl } } = await supabase.storage.from('certificates').createSignedUrl(fileName, 315360000);
            newDocUrls.push(signedUrl);
        }

        if (newDocUrls.length > 0) {
            // Get existing docs to append
            const { data: currentProfile } = await supabase.from('profiles').select('verification_docs').eq('id', user.id).single();
            const existingDocs = currentProfile?.verification_docs || [];
            const updatedDocs = [...existingDocs, ...newDocUrls];

            const { error: dbError } = await supabase.from('profiles').update({
                verification_docs: updatedDocs,
                verification_status: 'pending'
            }).eq('id', user.id);

            if (!dbError) {
                // Notify Admin
                fetch("https://formsubmit.co/ajax/995007a94ce934b7d8c8e7776670f9c4", {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        _subject: "Neue Verifizierung (Mehrere Dateien): " + user.email,
                        message: `User: ${user.email}\nAnzahl Dateien: ${newDocUrls.length}\nBitte im Admin Panel prüfen.`
                    })
                }).catch(err => console.error("Email failed", err));

                setVerificationStatus('pending');
                showNotification(`${newDocUrls.length} Datei(en) erfolgreich hochgeladen.`);
            }
        }
        setUploadingDoc(false);
    };

    if (loading) return <div className="p-8 text-center"><Loader className="animate-spin w-8 h-8 text-primary mx-auto"/></div>;
    
    return (
        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm animate-in fade-in">
            <h2 className="text-xl font-bold mb-6 text-dark flex items-center"><Settings className="w-5 h-5 mr-2 text-gray-500" /> {t.profile_settings}</h2>
            <form onSubmit={handleSave} className="space-y-6 max-w-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_city}</label><input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Adligenswil" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_canton}</label><div className="relative"><select name="canton" value={formData.canton} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="">Select Canton</option>{SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_language}</label><div className="relative"><select name="preferred_language" value={formData.preferred_language} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="de">Deutsch (German)</option><option value="en">English</option><option value="fr">Français (French)</option><option value="it">Italiano (Italian)</option></select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                
                {/* NEW FIELDS: Biography & Certificates */}
                <div className="border-t pt-6 mt-6">
                    <h3 className="text-lg font-bold mb-4 text-dark flex items-center"><User className="w-4 h-4 mr-2" /> {t.lbl_bio || "Public Profile (Teacher Only)"}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Biography (About Me)</label>
                            <textarea name="bio_text" rows="5" value={formData.bio_text} onChange={handleChange} placeholder="Tell students about your experience..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50 focus:bg-white transition-colors"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Certificates & Qualifications</label>
                            <div className="text-xs text-gray-500 mb-2">Enter one certificate per line. We will format them as a list.</div>
                            <textarea name="certificates" rows="3" value={formData.certificates} onChange={handleChange} placeholder="Master in Pedagogy&#10;Certified Yoga Instructor&#10;..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50 focus:bg-white transition-colors"></textarea>
                        </div>
                    </div>
                </div>

                {/* VERIFICATION SECTION */}
                {user.role === 'teacher' && (
                    <div className="border-t pt-6 mt-6">
                        <h3 className="text-lg font-bold mb-4 text-blue-600 flex items-center"><Shield className="w-4 h-4 mr-2" /> Verification & Blue Check</h3>
                        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="bg-white p-2 rounded-full shadow-sm"><CheckCircle className="w-6 h-6 text-blue-500" /></div>
                                <div>
                                    <h4 className="font-bold text-dark">Get Verified (CHF 75.00)</h4>
                                    <p className="text-sm text-gray-600 mt-1">Upload your diplomas/certificates to receive the "Professional" badge and boost your bookings.</p>
                                </div>
                            </div>

                            {verificationStatus === 'verified' ? (
                            <div className="bg-green-100 text-green-800 px-4 py-6 rounded-xl flex flex-col items-center justify-center font-bold text-center">
                                <CheckCircle className="w-12 h-12 mb-2 text-green-600" /> 
                                <span className="text-lg">Dein Account ist verifiziert!</span>
                                <p className="text-sm font-normal text-green-700 mt-1">Du hast das blaue Häkchen und den "Professional" Status erhalten.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {verificationStatus === 'pending' ? (
                                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl animate-in fade-in">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Clock className="w-5 h-5 text-yellow-600" />
                                            <h4 className="font-bold text-yellow-800">Verifizierung in Bearbeitung</h4>
                                        </div>
                                        <p className="text-sm text-yellow-700 mb-4">Wir haben deine Dokumente erhalten. Bitte stelle sicher, dass du die Gebühr beglichen hast, damit wir die Prüfung abschliessen können.</p>
                                        
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <a href="https://buy.stripe.com/test_3cIcN5dBF9ux4AoeoSbQY00" target="_blank" rel="noreferrer" className="bg-dark text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition text-center">
                                                Zahlung öffnen (falls noch offen)
                                            </a>
                                            <label className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition text-center cursor-pointer">
                                                Weitere Dateien hochladen
                                                <input type="file" multiple onChange={handleDocUpload} disabled={uploadingDoc} className="hidden" />
                                            </label>
                                        </div>
                                        {uploadingDoc && <p className="text-xs text-blue-500 mt-2 text-center">Lade hoch...</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Schritt 1: Nachweis hochladen</label>
                                            <div className="relative">
                                                <input type="file" multiple onChange={handleDocUpload} disabled={uploadingDoc} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer bg-white border rounded-lg p-1" />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">Du kannst mehrere Dateien auswählen (Zertifikate, Diplome, Ausweis).</p>
                                            {uploadingDoc && <p className="text-xs text-blue-500 mt-1">Upload läuft...</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                )}

                <div className="border-t pt-6 mt-6"><h3 className="text-lg font-bold mb-4 text-dark flex items-center"><Lock className="w-4 h-4 mr-2" /> {t.lbl_account_security}</h3><div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_new_password}</label><input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_confirm_password}</label><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div></div></div>
                <div className="pt-2"><button type="submit" disabled={saving} className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 transition flex items-center shadow-md disabled:opacity-50">{saving ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}{t.btn_save}</button></div>
            </form>
        </div>
    );
};

const Dashboard = ({ user, t, setView, courses, teacherEarnings, myBookings, handleDeleteCourse, handleEditCourse, showNotification, changeLanguage, setSelectedCourse }) => {
    const [dashView, setDashView] = useState('overview'); 
    const totalPaidOut = user.role === 'teacher' ? teacherEarnings.filter(e => e.isPaidOut).reduce((sum, e) => sum + e.payout, 0) : 0;
    const myCourses = user.role === 'teacher' ? courses.filter(c => c.user_id === user.id) : [];

    const handleNavigateToCourse = (course) => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); };
    const handleCancelBooking = async (courseId, courseTitle) => { if (!confirm(`Are you sure you want to cancel your spot in "${courseTitle}"?`)) return; alert("Please contact support to cancel this booking."); };
    const calculateDeadline = (startDateString) => { if (!startDateString) return null; const start = new Date(startDateString); const deadline = new Date(start); deadline.setMonth(deadline.getMonth() - 1); return deadline; };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                 <div><h1 className="text-3xl font-bold text-dark font-heading">{user.role === 'teacher' ? t.teacher_dash : t.student_dash}</h1><p className="text-gray-500">Welcome back, {user.name}</p></div>
                 <div className="bg-white rounded-full p-1 border flex shadow-sm h-fit"><button onClick={() => setDashView('overview')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'overview' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_overview}</button><button onClick={() => setDashView('profile')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'profile' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_settings}</button></div>
                {user.role === 'teacher' && dashView === 'overview' && <button onClick={() => handleEditCourse(null)} className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 flex items-center shadow-lg hover:-translate-y-0.5 transition font-heading"><KursNaviLogo className="mr-2 w-5 h-5 text-white" /> {t.dash_new_course}</button>}
            </div>
            {dashView === 'profile' ? ( <UserProfileSection user={user} showNotification={showNotification} setLang={changeLanguage} t={t} /> ) : (
                <>
                {user.role === 'teacher' ? (
                    <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4"><DollarSign className="text-green-600" /></div><div><p className="text-sm text-gray-500">Total Payouts Received</p><p className="text-2xl font-bold text-dark">CHF {totalPaidOut.toFixed(2)}</p></div></div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4"><User className="text-blue-600" /></div><div><p className="text-sm text-gray-500">Total Students</p><p className="text-2xl font-bold text-dark">{teacherEarnings.length}</p></div></div>
                        </div>
                        <h2 className="text-xl font-bold mb-4 font-heading text-dark">Student & Earnings History</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                             {teacherEarnings.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Date</th><th className="px-6 py-4 font-semibold text-gray-600">Course</th><th className="px-6 py-4 font-semibold text-gray-600">Student</th><th className="px-6 py-4 font-semibold text-gray-600">Your Payout (85%)</th><th className="px-6 py-4 font-semibold text-gray-600">Status</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">{teacherEarnings.map(earning => (<tr key={earning.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm text-gray-500">{earning.date}</td><td className="px-6 py-4 font-medium text-dark">{earning.courseTitle}</td><td className="px-6 py-4 text-gray-700">{earning.studentName}</td><td className="px-6 py-4 font-bold text-dark">CHF {earning.payout.toFixed(2)}</td><td className="px-6 py-4">{earning.isPaidOut ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid Out</span> : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>}</td></tr>))}</tbody>
                                    </table>
                                </div>
                             ) : <div className="p-8 text-center text-gray-500">No student bookings yet.</div>}
                        </div>
                        <h2 className="text-xl font-bold mb-4 font-heading text-dark">My Active Courses</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {myCourses.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Course</th><th className="px-6 py-4 font-semibold text-gray-600">Price</th><th className="px-6 py-4 font-semibold text-gray-600">Actions</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">{myCourses.map(course => (
                                            <tr key={course.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4"><div className="font-bold text-dark">{course.title}</div><div className="text-xs text-gray-400">{course.category}</div></td>
                                                <td className="px-6 py-4 font-medium">CHF {course.price}</td>
                                                <td className="px-6 py-4 flex gap-2">
                                                    <button onClick={() => handleEditCourse(course)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full"><PenTool className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            ) : <div className="p-8 text-center text-gray-500">You haven't posted any courses yet.</div>}
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-dark">{t.my_bookings}</h2>
                        <div className="space-y-4">
                            {myBookings.length > 0 ? myBookings.map(course => {
                                let canCancel = true; let deadlineText = "";
                                if (course.start_date) { const deadline = calculateDeadline(course.start_date); const now = new Date(); if (now > deadline) { canCancel = false; deadlineText = `Cancellation period ended on ${deadline.toLocaleDateString()}`; } else { deadlineText = `Cancel until ${deadline.toLocaleDateString()}`; } }
                                return (
                                    <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 transition hover:shadow-md">
                                        <img src={course.image_url} className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-90 transition" onClick={() => handleNavigateToCourse(course)} />
                                        <div className="flex-grow">
                                            <h3 className="font-bold text-dark cursor-pointer hover:text-primary transition" onClick={() => handleNavigateToCourse(course)}>{course.title}</h3>
                                            <p className="text-sm text-gray-500">{course.instructor_name} • {course.canton}</p>
                                            <div className="mt-4 flex items-center justify-between">
                                                <div className="text-green-600 text-sm font-medium flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Confirmed</div>
                                                {canCancel ? ( <div className="flex flex-col items-end"><button className="text-red-500 text-sm hover:text-red-700 hover:underline font-medium" onClick={() => handleCancelBooking(course.id, course.title)}>Cancel Booking</button><span className="text-xs text-gray-400 mt-1">{deadlineText}</span></div> ) : (<div className="flex items-center text-gray-400 text-sm bg-gray-50 px-2 py-1 rounded"><Lock className="w-3 h-3 mr-1" /><span>Non-refundable</span></div>)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-gray-500 italic">You haven't booked any courses yet.</p>}
                        </div>
                    </div>
                </div>
                )}
                </>
            )}
        </div>
    );
};

const TeacherForm = ({ t, setView, user, handlePublishCourse, getCatLabel, initialData }) => {
    const [lvl1, setLvl1] = useState(Object.keys(CATEGORY_HIERARCHY)[0]);
    const [lvl2, setLvl2] = useState(Object.keys(CATEGORY_HIERARCHY[lvl1])[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // NEW: Event Management State
    const [events, setEvents] = useState([{ start_date: '', location: '', max_participants: 0 }]);

    useEffect(() => {
        if (initialData) {
            if (initialData.category) {
                const parts = initialData.category.split(' | ');
                if (parts.length >= 2) { setLvl1(parts[0]); setLvl2(parts[1]); }
            }
            // Load events if they exist, otherwise fallback to legacy single fields
            if (initialData.course_events && initialData.course_events.length > 0) {
                setEvents(initialData.course_events.map(e => ({
                    start_date: e.start_date ? e.start_date.split('T')[0] : '', // Format for input type=date
                    location: e.location,
                    max_participants: e.max_participants
                })));
            } else if (initialData.start_date) {
                setEvents([{ start_date: initialData.start_date, location: initialData.address || '', max_participants: 0 }]);
            }
        }
    }, [initialData]);

    const handleLvl1Change = (e) => { const val = e.target.value; setLvl1(val); setLvl2(Object.keys(CATEGORY_HIERARCHY[val])[0]); };

    // Event Management Handlers
    const addEvent = () => setEvents([...events, { start_date: '', location: '', max_participants: 0 }]);
    const removeEvent = (index) => setEvents(events.filter((_, i) => i !== index));
    const updateEvent = (index, field, value) => {
        const newEvents = [...events];
        newEvents[index][field] = value;
        setEvents(newEvents);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        // Validate Events
        const validEvents = events.filter(ev => ev.start_date && ev.location);
        if (validEvents.length === 0) { alert("Please add at least one valid date and location."); return; }

        setIsSubmitting(true);
        await handlePublishCourse(e, validEvents); // Pass events explicitly
        setIsSubmitting(false);
    };

    return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
        <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> {t.btn_back_dash}</button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4"><h1 className="text-3xl font-bold text-dark font-heading">{initialData ? t.edit_course : t.create_course}</h1><p className="text-gray-500 mt-2">{initialData ? t.edit_course_sub : t.create_course_sub}</p></div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {initialData && <input type="hidden" name="course_id" value={initialData.id} />}

                {/* --- GENERAL INFO SECTION --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                         <label className="block text-sm font-bold text-gray-700 mb-1">Course Image</label>
                         <div className="flex items-center gap-4">
                            {initialData?.image_url && <img src={initialData.image_url} className="w-16 h-16 rounded object-cover border" alt="Current" />}
                            <input type="file" name="courseImage" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-primary hover:file:bg-orange-100 cursor-pointer border rounded-lg p-1" />
                         </div>
                    </div>

                    <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_title}</label><input required type="text" name="title" defaultValue={initialData?.title} placeholder="e.g. Traditional Swiss Cooking" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none transition-shadow" /></div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_skill_level}</label><select name="level" defaultValue={initialData?.level || "All Levels"} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm outline-none"><option value="All Levels">{t.opt_all_levels}</option><option value="Beginner">{t.opt_beginner}</option><option value="Advanced">{t.opt_advanced}</option></select></div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_target_group}</label><select name="target_group" defaultValue={initialData?.target_group || "Adults"} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm outline-none"><option value="Adults">{t.opt_adults}</option><option value="Teens">{t.opt_teens}</option><option value="Kids">{t.opt_kids}</option></select></div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_canton}</label><div className="relative"><select name="canton" defaultValue={initialData?.canton} className="w-full px-3 py-2 border rounded-lg focus:ring-primary outline-none appearance-none bg-white text-sm">{SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                    </div>

                    <div className="md:col-span-2 bg-beige p-4 rounded-xl border border-orange-100">
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t.lbl_cat_class}</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><span className="text-xs text-gray-500 block mb-1">{t.lbl_type}</span><select name="catLvl1" value={lvl1} onChange={handleLvl1Change} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">{Object.keys(CATEGORY_HIERARCHY).map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                            <div><span className="text-xs text-gray-500 block mb-1">{t.lbl_area}</span><select name="catLvl2" value={lvl2} onChange={(e) => setLvl2(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">{Object.keys(CATEGORY_HIERARCHY[lvl1]).map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                            <div><span className="text-xs text-gray-500 block mb-1">{t.lbl_specialty}</span><select name="catLvl3" defaultValue={initialData ? initialData.category.split(' | ')[2] : ''} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">{CATEGORY_HIERARCHY[lvl1][lvl2].map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                        </div>
                    </div>
                </div>

                {/* --- DATES & LOCATIONS (NEW SECTION) --- */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-blue-900 flex items-center"><Calendar className="w-5 h-5 mr-2" /> Dates & Locations</h3>
                        <button type="button" onClick={addEvent} className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold hover:bg-blue-700 flex items-center"><Plus className="w-4 h-4 mr-1"/> Add Date</button>
                    </div>
                    <div className="space-y-3">
                        {events.map((ev, i) => (
                            <div key={i} className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row gap-4 items-end border border-gray-200">
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                                    <input type="date" required value={ev.start_date} onChange={e => updateEvent(i, 'start_date', e.target.value)} className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                </div>
                                <div className="flex-[2] w-full">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Specific Address</label>
                                    <input type="text" required value={ev.location} onChange={e => updateEvent(i, 'location', e.target.value)} placeholder="Strasse 1, 8000 Zürich" className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                </div>
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Capacity</label>
                                    <div className="relative">
                                        <input type="number" min="0" max="99" value={ev.max_participants} onChange={e => updateEvent(i, 'max_participants', e.target.value)} className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" title="0 = Unlimited" />
                                        <span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none">Pers.</span>
                                    </div>
                                </div>
                                {events.length > 1 && (
                                    <button type="button" onClick={() => removeEvent(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"><Trash2 className="w-5 h-5" /></button>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-blue-600 mt-3 flex items-center"><Info className="w-3 h-3 mr-1"/> Set Capacity to "0" for unlimited spots.</p>
                </div>

                {/* --- DETAILS SECTION --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_price}</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500 font-bold">CHF</span><input required type="number" name="price" defaultValue={initialData?.price} className="w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_session_count}</label><input required type="number" name="sessionCount" defaultValue={initialData?.session_count || 1} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_session_length}</label><input required type="text" name="sessionLength" defaultValue={initialData?.session_length} placeholder="e.g. 2 hours" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_website}</label><div className="relative"><ExternalLink className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input type="url" name="providerUrl" defaultValue={initialData?.provider_url} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div>
                </div>

                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_description}</label><textarea required name="description" defaultValue={initialData?.description} rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"></textarea></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_learn_goals}</label><textarea required name="objectives" defaultValue={initialData?.objectives?.join('\n')} rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Enter each objective on a new line..."></textarea></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_prereq}</label><input type="text" name="prerequisites" defaultValue={initialData?.prerequisites} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 shadow-lg hover:-translate-y-0.5 transition flex items-center font-heading disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? <Loader className="animate-spin w-5 h-5 mr-2 text-white" /> : <KursNaviLogo className="w-5 h-5 mr-2 text-white" />}
                        {initialData ? t.btn_update : t.btn_publish}
                    </button>
                </div>
            </form>
        </div>
    </div>
    );
};

const SuccessView = ({ setView }) => (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
            <h2 className="text-3xl font-bold text-dark mb-4 font-heading">Payment Successful!</h2>
            <p className="text-gray-600 mb-8 font-sans">Thank you for your booking. You will receive a confirmation email shortly.</p>
            <button onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); setView('dashboard'); }} className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition font-heading">Go to My Courses</button>
        </div>
    </div>
);

const AuthView = ({ setView, setUser, showNotification, lang }) => {
    const [isSignUp, setIsSignUp] = useState(false); const [loading, setLoading] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [fullName, setFullName] = useState(''); const [role, setRole] = useState('student');
    const [agbAccepted, setAgbAccepted] = useState(false);
    const t = TRANSLATIONS[lang] || TRANSLATIONS['de']; 

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            if (isSignUp) {
                if (!agbAccepted) { throw new Error(t.legal_agree + " " + t.legal_agb); } 
                const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role: role } } });
                if (authError) throw authError;
                // Add role to the profile row for easier Admin Panel sorting
                if (authData?.user) { await supabase.from('profiles').insert([{ id: authData.user.id, full_name: fullName, email: email, preferred_language: lang, role: role }]); }
                showNotification("Account created! Check your email.");
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                const userMetadata = data.user?.user_metadata;
                const loggedInUser = {
                    id: data.user.id,
                    email: data.user.email,
                    role: userMetadata?.role || 'student',
                    name: userMetadata?.full_name || data.user.email.split('@')[0]
                };
                // Sofortiges Update für die Navbar
                setUser(loggedInUser); 
                
                if (loggedInUser.role === 'teacher') setView('dashboard'); else setView('home');
                showNotification("Welcome back!");
            }
        } catch (error) { showNotification(error.message); } finally { setLoading(false); }
    };
    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-center font-heading text-dark">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                <form onSubmit={handleAuth} className="space-y-4 font-sans">
                    {isSignUp && (<><div><label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label><input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={fullName} onChange={e => setFullName(e.target.value)} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">I am a...</label><div className="flex gap-4"><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'student' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}><input type="radio" className="hidden" checked={role === 'student'} onChange={() => setRole('student')} />Student</label><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'teacher' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}><input type="radio" className="hidden" checked={role === 'teacher'} onChange={() => setRole('teacher')} />Teacher</label></div></div></>)}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Password</label><input required type="password" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={password} onChange={e => setPassword(e.target.value)} /></div>
                    
                    {isSignUp && (
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <input
                                id="agb"
                                type="checkbox"
                                checked={agbAccepted}
                                onChange={(e) => setAgbAccepted(e.target.checked)}
                                className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                            />
                            <label htmlFor="agb" className="text-sm text-gray-600 cursor-pointer">
                                <span>{t.legal_agree} <a href="/agb" onClick={(e) => { e.preventDefault(); setView('agb'); }} className="text-primary hover:underline font-bold">{t.legal_agb}</a> {role === 'teacher' ? t.legal_provider_suffix : ''} {t.legal_and} <a href="/datenschutz" onClick={(e) => { e.preventDefault(); setView('datenschutz'); }} className="text-primary hover:underline font-bold">{t.legal_privacy}</a>{t.legal_read ? t.legal_read : '.'}</span>
                            </label>
                        </div>
                    )}

                    <button disabled={loading} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50 font-heading">{loading ? <Loader className="animate-spin mx-auto" /> : (isSignUp ? "Sign Up" : "Login")}</button>
                </form>
                <p className="text-center text-sm text-gray-600 mt-6 font-sans">{isSignUp ? "Already have an account?" : "Don't have an account?"}<button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-bold ml-2 hover:underline">{isSignUp ? "Login" : "Sign Up"}</button></p>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// --- MAIN APP COMPONENT ---
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// --- MAIN APP COMPONENT ---
// -----------------------------------------------------------------------------
const TeacherProfileView = ({ teacher, courses, setView, setSelectedCourse, t, getCatLabel }) => {
    const teacherCourses = courses.filter(c => c.user_id === teacher.id);

    return (
        <div className="max-w-5xl mx-auto px-4 py-12 font-sans">
            <button onClick={() => window.history.back()} className="flex items-center text-gray-500 hover:text-primary mb-8">
                <ArrowLeft className="w-4 h-4 mr-2"/> {t.btn_back}
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-primary text-4xl font-bold">
                            {teacher.full_name?.charAt(0)}
                        </div>
                        <h1 className="text-2xl font-bold text-dark">{teacher.full_name}</h1>
                        <p className="text-gray-500 text-sm mb-4">{teacher.city}, {teacher.canton}</p>
                        {teacher.is_professional && (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" /> Professional
                            </span>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-8">
                    <section>
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t.lbl_bio || "Über mich"}</h2>
                        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {teacher.bio_text || "Dieser Lehrer hat noch keine Biografie hinterlegt."}
                        </p>
                    </section>

                    {teacher.certificates && teacher.certificates.length > 0 && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Zertifizierungen</h2>
                            <ul className="space-y-2">
                                {teacher.certificates.map((cert, i) => (
                                    <li key={i} className="flex items-center text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <Shield className="w-4 h-4 mr-3 text-green-500" /> {cert}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section>
                        <h2 className="text-xl font-bold mb-6 border-b pb-2">Kurse von {teacher.full_name}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {teacherCourses.map(course => (
                                <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md cursor-pointer transition">
                                    <img src={course.image_url} className="w-full h-32 object-cover" />
                                    <div className="p-4">
                                        <h3 className="font-bold text-sm line-clamp-1">{course.title}</h3>
                                        <p className="text-primary font-bold text-sm mt-2">CHF {course.price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default function KursNaviPro() {
  // --- ARCHITECT FIX: Smart Initialization to prevent Redirect Loop ---
  const getInitialView = () => {
      const path = window.location.pathname;
      // Critical: Check Admin Route first
      if (path.startsWith('/control-room-2025')) return 'admin';
      
      // Check other routes so they don't get overwritten to Home
      if (path === '/search') return 'search';
      if (path === '/dashboard') return 'dashboard';
      if (path === '/how-it-works') return 'how-it-works';
      if (path === '/about') return 'about';
      if (path === '/contact') return 'contact';
      if (path === '/login') return 'login';
      if (path === '/create-course') return 'create';
      if (path === '/private') return 'landing-private';
      if (path === '/professional') return 'landing-prof';
      if (path === '/children') return 'landing-kids';
      if (path.startsWith('/course/')) return 'detail';
      if (path === '/agb') return 'agb';
      if (path === '/datenschutz') return 'datenschutz';
      if (path === '/impressum') return 'impressum';
      if (path === '/widerruf-storno') return 'widerruf';
      if (path === '/vertrauen-sicherheit') return 'trust';
      
      return 'home';
  };

  const [lang, setLang] = useState('de');
  const [view, setView] = useState(getInitialView); // <--- Sets correct view instantly
  const [user, setUser] = useState(null); 
  const [session, setSession] = useState(null);
  
  // App State
  const [courses, setCourses] = useState([]); 
  const [myBookings, setMyBookings] = useState([]); 
  const [teacherEarnings, setTeacherEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [selectedCatPath, setSelectedCatPath] = useState([]); 
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const [locMode, setLocMode] = useState('canton'); 
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [notification, setNotification] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null); // State for Edit Mode

  // NEW FILTER STATE
  const [filterDate, setFilterDate] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterLevel, setFilterLevel] = useState("All");
  const [filterPro, setFilterPro] = useState(false);

  const catMenuRef = useRef(null);
  const locMenuRef = useRef(null);

  const changeLanguage = async (newLang) => {
    setLang(newLang);
    if (user && user.id) {
        const { error } = await supabase.from('profiles').update({ preferred_language: newLang }).eq('id', user.id);
        if (error) console.error("Failed to save language preference:", error);
    }
  };

  const getCatLabel = (key) => {
    if (lang === 'en') return key;
    const translation = CATEGORY_LABELS[key];
    return translation && translation[lang] ? translation[lang] : key;
  };

  // --- URL SYNCHRONIZATION ---
  useEffect(() => {
    let path = '/';
    if (view === 'landing-private') path = '/private';
    else if (view === 'landing-prof') path = '/professional';
    else if (view === 'landing-kids') path = '/children';
    else if (view === 'search') path = '/search';
    else if (view === 'how-it-works') path = '/how-it-works';
    else if (view === 'about') path = '/about';
    else if (view === 'contact') path = '/contact';
    else if (view === 'login') path = '/login';
    else if (view === 'dashboard') path = '/dashboard';
    
    // --- LEGAL PATHS ---
    else if (view === 'agb') path = '/agb';
    else if (view === 'datenschutz') path = '/datenschutz';
    else if (view === 'impressum') path = '/impressum';
    else if (view === 'widerruf') path = '/widerruf-storno';
    else if (view === 'trust') path = '/vertrauen-sicherheit';
    
    // --- SECRET ADMIN PATH ---
    else if (view === 'admin') path = '/control-room-2025';

    else if (view === 'create') path = '/create-course';
    else if (view === 'detail' && selectedCourse) path = `/course/${selectedCourse.id}`;
    
    if (window.location.pathname !== path) {
        window.history.pushState({ view, courseId: selectedCourse?.id }, '', path);
    }
  }, [view, selectedCourse]);

  // --- POPSTATE HANDLER & INITIAL LOAD FIX ---
  useEffect(() => {
    const handleUrlChange = () => {
        const path = window.location.pathname;
        if (path === '/agb') setView('agb');
        else if (path === '/datenschutz') setView('datenschutz');
        else if (path === '/impressum') setView('impressum');
        else if (path === '/widerruf-storno') setView('widerruf');
        else if (path === '/vertrauen-sicherheit') setView('trust');
        
        // --- ROBUST CHECK for Trailing Slashes ---
        else if (path.startsWith('/control-room-2025')) setView('admin');

        else if (path === '/search') setView('search');
        else if (path === '/dashboard') setView('dashboard');
        else if (path === '/how-it-works') setView('how-it-works');
        else if (path === '/about') setView('about');
        else if (path === '/contact') setView('contact');
        else if (path === '/login') setView('login');
        else if (path === '/create-course') setView('create');
        
        else if (path === '/private') { setSelectedCatPath(['Private & Hobby']); setView('landing-private'); }
        else if (path === '/professional') { setSelectedCatPath(['Professional']); setView('landing-prof'); }
        else if (path === '/children') { setSelectedCatPath(['Children']); setView('landing-kids'); }
        
        else if (path !== '/' && !path.startsWith('/course/')) setView('home');
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (catMenuRef.current && !catMenuRef.current.contains(event.target)) setCatMenuOpen(false);
      if (locMenuRef.current && !locMenuRef.current.contains(event.target)) setLocMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['de'];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const role = session.user.user_metadata?.role || 'student';
        const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        setUser({ id: session.user.id, email: session.user.email, role: role, name: name });
        fetchBookings(session.user.id);
        if (role === 'teacher') fetchTeacherEarnings(session.user.id);

        supabase.from('profiles').select('preferred_language, is_professional').eq('id', session.user.id).single()
            .then(({ data }) => {
                if (data) {
                    if (data.preferred_language) setLang(data.preferred_language);
                    // Hier wird der Pro-Status in den User-Speicher geladen
                    setUser(prev => prev ? { ...prev, is_professional: data.is_professional } : prev);
                }
            });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        const role = session.user.user_metadata?.role || 'student';
        const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        setUser({ id: session.user.id, email: session.user.email, role: role, name: name });
        fetchBookings(session.user.id);
        if (role === 'teacher') fetchTeacherEarnings(session.user.id);

        supabase.from('profiles').select('preferred_language, is_professional').eq('id', session.user.id).single()
            .then(({ data }) => {
                if (data) {
                    if (data.preferred_language) setLang(data.preferred_language);
                    // Hier wird der Pro-Status in den User-Speicher geladen
                    setUser(prev => prev ? { ...prev, is_professional: data.is_professional } : prev);
                }
            });
        } else {
        setUser(null);
        setMyBookings([]);
        setTeacherEarnings([]);
        
        // ARCHITECT FIX: Nur nach Home leiten, wenn wir auf einer geschützten Seite (Dashboard/Create) sind
        const protectedPaths = ['/dashboard', '/create-course'];
        if (protectedPaths.includes(window.location.pathname)) {
            setView('home');
        }
        setLang('de'); 
      }
    }); // <--- Diese Klammer hat gefehlt!

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');
    if (sessionId && user) {
        const pendingCourseId = localStorage.getItem('pendingCourseId');
        if (pendingCourseId) {
            const saveBooking = async () => {
                const pendingEventId = localStorage.getItem('pendingEventId');
                const payload = { user_id: user.id, course_id: pendingCourseId, is_paid: false, status: 'confirmed' };
                if (pendingEventId) payload.event_id = pendingEventId;
                
                const { error } = await supabase.from('bookings').insert([payload]);
                if (!error) {
                    localStorage.removeItem('pendingCourseId');
                    localStorage.removeItem('pendingEventId');
                    showNotification("Course booked successfully!");
                    fetchBookings(user.id);
                    window.history.replaceState({}, document.title, "/dashboard");
                    setView('dashboard');
                }
            };
            saveBooking();
        } else { setView('dashboard'); }
    }
  }, [user]);

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      // ARCHITECT CHANGE: Load events and booking counts
      const { data, error } = await supabase
        .from('courses')
        .select('*, course_events(*, bookings(count))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCourses(data || []);
      const path = window.location.pathname;
      if (path.startsWith('/course/')) {
          const urlId = path.split('/')[2];
          if (data && urlId) {
              const found = data.find(c => c.id == urlId);
              if (found) { setSelectedCourse(found); setView('detail'); }
          }
      }
    } catch (error) { console.error('Error fetching courses:', error.message); showNotification("Error loading courses"); } finally { setLoading(false); }
  };

  const fetchBookings = async (userId) => {
    try {
      const { data, error } = await supabase.from('bookings').select('*, courses(*)').eq('user_id', userId);
      if (error) throw error;
      setMyBookings(data.map(booking => booking.courses).filter(c => c !== null));
    } catch (error) { console.error('Error fetching bookings:', error.message); }
  };

  const fetchTeacherEarnings = async (userId) => {
      try {
          const { data: myCourses } = await supabase.from('courses').select('id, title, price').eq('user_id', userId);
          if (!myCourses || myCourses.length === 0) return;
          const courseIds = myCourses.map(c => c.id);
          const { data: bookings } = await supabase.from('bookings').select('*, profiles:user_id(full_name, email)').in('course_id', courseIds);
          if (!bookings) return;
          setTeacherEarnings(bookings.map(booking => {
              const course = myCourses.find(c => c.id === booking.course_id);
              return { id: booking.id, courseTitle: course?.title || 'Unknown', studentName: booking.profiles?.full_name || 'Guest Student', price: course?.price || 0, payout: (course?.price || 0) * 0.85, isPaidOut: booking.is_paid, date: new Date(booking.created_at).toLocaleDateString() };
          }));
      } catch (error) { console.error("Error fetching earnings:", error); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); showNotification("Logged out successfully"); setView('home'); };
  const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const handleDeleteCourse = async (courseId) => {
    if(!confirm("Are you sure you want to delete this course?")) return;
    setCourses(courses.filter(c => c.id !== courseId));
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) showNotification("Error deleting: " + error.message); else showNotification("Course deleted.");
  };

  const handleEditCourse = (course) => {
      setEditingCourse(course);
      setView('create');
  };

  const handlePublishCourse = async (e, eventsList) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const courseId = formData.get('course_id');
    const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');
    const fullCategoryString = `${formData.get('catLvl1')} | ${formData.get('catLvl2')} | ${formData.get('catLvl3')}`;

    // 1. Image Upload Logic
    let imageUrl = editingCourse?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600";
    const imageFile = formData.get('courseImage');

    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('course-images').upload(fileName, imageFile);
        if (uploadError) { showNotification("Error uploading image: " + uploadError.message); return; }
        const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
    }

    // 2. Prepare Base Course Data (Legacy start_date/address are kept for safety but UI uses events)
    const mainLocation = eventsList.length > 0 ? eventsList[0].location : formData.get('address');
    const mainDate = eventsList.length > 0 ? eventsList[0].start_date : formData.get('startDate');

    const newCourse = {
      title: formData.get('title'), instructor_name: user.name, price: Number(formData.get('price')), rating: 0, category: fullCategoryString, 
      canton: formData.get('canton'), address: mainLocation, start_date: mainDate, // Fallback values
      image_url: imageUrl, description: formData.get('description'), objectives: objectivesList, prerequisites: formData.get('prerequisites'), 
      session_count: Number(formData.get('sessionCount')), session_length: formData.get('sessionLength'), provider_url: formData.get('providerUrl'), 
      user_id: user.id, level: formData.get('level'), target_group: formData.get('target_group'),
      is_pro: user.is_professional || false
    };

    let activeCourseId = courseId;
    let error;

    if (courseId) {
        const { error: err } = await supabase.from('courses').update(newCourse).eq('id', courseId);
        error = err;
        showNotification("Course updated!");
    } else {
        const { data: inserted, error: err } = await supabase.from('courses').insert([newCourse]).select();
        if (inserted && inserted[0]) activeCourseId = inserted[0].id;
        error = err;
        showNotification(t.success_msg);
    }

    if (error) { console.error(error); showNotification("Error saving course: " + error.message); return; } 

    // 3. HANDLE EVENTS (Delete all and re-insert for simplicity)
    if (activeCourseId && eventsList.length > 0) {
         // Delete old
         await supabase.from('course_events').delete().eq('course_id', activeCourseId);
         // Insert new
         const eventsToInsert = eventsList.map(ev => ({
             course_id: activeCourseId,
             start_date: ev.start_date,
             location: ev.location,
             max_participants: parseInt(ev.max_participants) || 0
         }));
         const { error: eventError } = await supabase.from('course_events').insert(eventsToInsert);
         if (eventError) console.error("Event error", eventError);
    }

    fetchCourses(); setView('dashboard'); setEditingCourse(null);
  };

  const handleBookCourse = async (course, eventId = null) => {
      if (!user) { setView('login'); return; }
      try {
          localStorage.setItem('pendingCourseId', course.id);
          if (eventId) localStorage.setItem('pendingEventId', eventId); // Save Event ID for later

          // For MVP, we simulate payment and redirect directly since we don't have a real backend in this file context
          // In real prod, this goes to Stripe. Here we go to 'success' via redirect simulation or direct state.
          // NOTE: For now, we assume the simulated checkout URL or just mock it.
          // Since the original code used a fetch to /api/..., I will keep it but add eventId to body if needed.
          // If the user uses a mock checkout, we might need to adjust logic in the success handler too.

          const response = await fetch('/api/create-checkout-session', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ 
                  courseId: course.id, 
                  courseTitle: course.title, 
                  coursePrice: course.price, 
                  courseImage: course.image_url, 
                  userId: user.id,
                  eventId: eventId // Pass event ID
              }) 
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          window.location.href = data.url; 
      } catch (error) { 
          // Fallback for demo without backend
          console.warn("Backend error (expected in demo):", error);
          // alert("Demo Booking: Redirecting to success...");
          // Manually trigger success logic for demo if API fails
          // window.location.href = "/dashboard?session_id=demo";
      }
  };

  const handleContactSubmit = (e) => { 
    e.preventDefault(); 
    fetch("https://formsubmit.co/ajax/995007a94ce934b7d8c8e7776670f9c4", {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
    })
    .then(response => response.json())
    .then(data => {
          showNotification(t.success_msg || "Message sent!"); 
          setView('home');
    })
    .catch(error => {
        console.error("Error:", error);
        showNotification("Error sending message. Please email us directly.");
    });
  };
  
  const handleSearchSubmit = () => { 
      setView('search');
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const filteredCourses = courses.filter(course => {
    // --- SAFETY CHECKS ---
    if (!course) return false;
    let matchesCategory = true;
    if (selectedCatPath.length > 0) { 
        const courseCatStr = (course.category || "").toLowerCase(); 
        matchesCategory = selectedCatPath.every(part => courseCatStr.includes(part.toLowerCase())); 
    }
    let matchesLocation = true;
    if (selectedLocations.length > 0) {
        if (locMode === 'canton') { matchesLocation = selectedLocations.includes(course.canton); } 
        else { const address = (course.address || "").toLowerCase(); const canton = (course.canton || "").toLowerCase(); matchesLocation = selectedLocations.some(city => address.includes(city.toLowerCase()) || canton.includes(city.toLowerCase())); }
    }
    const safeTitle = (course.title || "").toLowerCase();
    const safeInstructor = (course.instructor_name || "").toLowerCase();
    const matchesSearch = safeTitle.includes(searchQuery.toLowerCase()) || safeInstructor.includes(searchQuery.toLowerCase());
    
    let matchesDate = true; if (filterDate && course.start_date) matchesDate = new Date(course.start_date) >= new Date(filterDate);
    let matchesPrice = true; if (filterPriceMax) matchesPrice = (course.price || 0) <= Number(filterPriceMax);
    let matchesLevel = true; if (filterLevel !== 'All') matchesLevel = course.level === filterLevel;
    let matchesPro = true; if (filterPro) matchesPro = course.is_pro === true;

    return matchesCategory && matchesLocation && matchesSearch && matchesDate && matchesPrice && matchesLevel && matchesPro;
  });

  return (
    <div className="min-h-screen bg-beige font-sans text-dark selection:bg-orange-100 selection:text-primary flex flex-col font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@300;400;500;600&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');`}</style>
      {notification && (<div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-dark text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce font-heading"><CheckCircle className="w-5 h-5 mr-2 text-primary" />{notification}</div>)}
      <Navbar t={t} user={user} lang={lang} setLang={changeLanguage} setView={setView} handleLogout={handleLogout} setShowResults={() => setView('search')} setSelectedCatPath={setSelectedCatPath} />

      <div className="flex-grow">
      {/* --- ROUTING --- */}
      {view === 'home' && (
         <Home 
            t={t} 
            setView={setView} 
            setSelectedCatPath={setSelectedCatPath}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} catMenuRef={catMenuRef}
            locMode={locMode} setLocMode={setLocMode}
            selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations}
            locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef}
            getCatLabel={getCatLabel}
         />
      )}
        
      {view === 'landing-private' && ( <LandingView title="Unleash your passion." subtitle="Hobby Courses" variant="private" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-prof' && ( <LandingView title="Boost your career." subtitle="Professional Courses" variant="prof" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-kids' && ( <LandingView title="Fun learning for kids." subtitle="Children's Courses" variant="kids" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}

      {view === 'search' && (
          <SearchPageView 
            selectedCatPath={selectedCatPath} setSelectedCatPath={setSelectedCatPath}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} catMenuRef={catMenuRef}
            locMode={locMode} setLocMode={setLocMode}
            selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations}
            locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef}
            loading={loading} filteredCourses={filteredCourses}
            setSelectedCourse={setSelectedCourse} setView={setView}
            t={t} getCatLabel={getCatLabel}
            filterDate={filterDate} setFilterDate={setFilterDate}
            filterPriceMax={filterPriceMax} setFilterPriceMax={setFilterPriceMax}
            filterLevel={filterLevel} setFilterLevel={setFilterLevel}
            filterPro={filterPro} setFilterPro={setFilterPro}
          />
      )}

      {/* --- STANDARD VIEWS --- */}
      {view === 'success' && <SuccessView setView={setView} />}
      {view === 'detail' && selectedCourse && (
            <DetailView 
                course={selectedCourse} 
                setView={setView} 
                t={t} 
                handleBookCourse={handleBookCourse} 
                setSelectedTeacher={setSelectedTeacher} 
            />
        )}
      {view === 'teacher-profile' && selectedTeacher && (
        <TeacherProfileView 
            teacher={selectedTeacher} 
            courses={courses} 
            setView={setView} 
            setSelectedCourse={setSelectedCourse} 
            t={t} 
            getCatLabel={getCatLabel} 
        />
    )}
{view === 'how-it-works' && <HowItWorksPage t={t} setView={setView} />}
      {view === 'login' && <AuthView setView={setView} setUser={setUser} showNotification={showNotification} lang={lang} />}
      {view === 'about' && <AboutPage t={t} setView={setView} />}
      {view === 'contact' && <ContactPage t={t} handleContactSubmit={handleContactSubmit} setView={setView} />}
      
      {/* --- LEGAL PAGES --- */}
      {view === 'agb' && <LegalPage pageKey="agb" lang={lang} setView={setView} />}
      {view === 'datenschutz' && <LegalPage pageKey="datenschutz" lang={lang} setView={setView} />}
      {view === 'impressum' && <LegalPage pageKey="impressum" lang={lang} setView={setView} />}
      {view === 'widerruf' && <LegalPage pageKey="widerruf" lang={lang} setView={setView} />}
      {view === 'trust' && <LegalPage pageKey="trust" lang={lang} setView={setView} />}

      {view === 'admin' && <AdminPanel t={t} courses={courses} setCourses={setCourses} showNotification={showNotification} />}
      {view === 'dashboard' && user && <Dashboard user={user} t={t} setView={setView} courses={courses} teacherEarnings={teacherEarnings} myBookings={myBookings} handleDeleteCourse={handleDeleteCourse} handleEditCourse={handleEditCourse} showNotification={showNotification} changeLanguage={changeLanguage} setSelectedCourse={setSelectedCourse} />}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm t={t} setView={setView} user={user} handlePublishCourse={handlePublishCourse} getCatLabel={getCatLabel} initialData={editingCourse} />}
      </div>
      
      <Footer t={t} setView={setView} />
    </div>
  );
}