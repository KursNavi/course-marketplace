import React, { useEffect, useMemo } from 'react';
import { Search, ChevronRight, User, X, Calendar, Shield, MapPin, CheckCircle, Loader, Bell, ArrowDown, Bookmark, BookmarkCheck } from 'lucide-react';
import { LocationDropdown, LanguageDropdown } from './Filters';
import { Globe } from 'lucide-react';
import { CATEGORY_TYPES, NEW_TAXONOMY, AGE_GROUPS, COURSE_LEVELS } from '../lib/constants';

const SearchPageView = ({ 
    courses, 
    searchQuery, setSearchQuery, 
    searchType, setSearchType,
    searchArea, setSearchArea,
    searchSpecialty, setSearchSpecialty,
    searchAge, setSearchAge,
    locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, 
    loading, filteredCourses, setSelectedCourse, setView, 
    t, filterDate, setFilterDate, filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel, filterPro, setFilterPro,
    selectedLanguage, setSelectedLanguage, langMenuOpen, setLangMenuOpen, langMenuRef,
    savedCourseIds, onToggleSaveCourse
}) => {

    // --- SEO LOGIC: Zero-Result Rule ---
    useEffect(() => {
        if (loading) return; // Wait for data

        // Check or create meta robots tag
        let robotsMeta = document.querySelector('meta[name="robots"]');
        if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.name = "robots";
            document.head.appendChild(robotsMeta);
        }

        if (filteredCourses.length === 0) {
            // 3.1 Empty Category/Search -> NOINDEX
            robotsMeta.content = "noindex,follow";
        } else {
            // Has Results -> INDEX
            robotsMeta.content = "index,follow";
        }

        // Cleanup: Reset to index on unmount to avoid polluting other pages
        return () => {
            if (robotsMeta) robotsMeta.content = "index,follow";
        };
    }, [filteredCourses.length, loading]);

    // --- DYNAMIC FILTER LOGIC (Hide empty categories) ---
    const availableTypes = [...new Set(courses.map(c => c.category_type).filter(Boolean))];

    const availableAreas = [...new Set(
        courses
        .filter(c => !searchType || c.category_type === searchType)
        .map(c => c.category_area)
        .filter(Boolean)
    )];

    const availableSpecialties = [...new Set(
        courses
        .filter(c => (!searchType || c.category_type === searchType) && (!searchArea || c.category_area === searchArea))
        .map(c => c.category_specialty)
        .filter(Boolean)
    )];

    const availableAgeGroups = [...new Set(
        courses.flatMap(c => c.target_age_groups || [])
    )];

    // Helper to get Label
    const getLabel = (key, scope) => {
        if (scope === 'type' && CATEGORY_TYPES[key]) return CATEGORY_TYPES[key].de;
        if (scope === 'age' && AGE_GROUPS[key]) return AGE_GROUPS[key].de;
        if (scope === 'area' || scope === 'specialty') {
             for (const typeKey in NEW_TAXONOMY) {
                 const typeObj = NEW_TAXONOMY[typeKey];
                 if (typeObj[key]) return typeObj[key].label.de;
                 if (scope === 'specialty') return key; 
             }
        }
        return key; 
    };

    // --- HELPER: Consistent Price Labeling (match DetailView logic) ---
    const getPriceLabel = (c) => {
        if (!c) return '';
        const type = c.booking_type || 'platform';
        const price = Number(c.price) || 0;

        if (type === 'lead' && price === 0) return 'Preis auf Anfrage';
        if (type === 'external' && price === 0) return 'Siehe Webseite';
        if (price === 0) return 'Kostenlos';
        return `${t.currency} ${price}`;
    };

    const resetFilters = () => {
        setSearchType(""); setSearchArea(""); setSearchSpecialty(""); setSearchAge("");
        setSelectedLocations([]); setSearchQuery(""); setFilterDate(""); setFilterPriceMax(""); setFilterLevel("All"); setFilterPro(false);
    };

    // --- RANKING LOGIC (v3.0) ---
    // Formula: Score = Plan * Booking * (0.6 + 0.4*Freshness) * (1 + RandomEpsilon)
    const sortedCourses = useMemo(() => {
        return [...filteredCourses].sort((a, b) => {
            const getScore = (c) => {
                // 1. Plan Factor (Fallback logic for legacy data)
                // If plan_factor exists, use it. Else: Pro=1.2, Basic=1.0
                const planF = c.plan_factor || (c.is_pro ? 1.2 : 1.0);
                
                // 2. Booking Factor (Placeholder until booking system is live)
                // If booking_active exists use it, else default 1.0
                const bookF = c.booking_factor || 1.0;

                // 3. Freshness Score (0-1)
                // If created_at missing, assume 0.5. Else decay over 90 days.
                let freshScore = 0.5;
                if (c.created_at) {
                    const daysOld = (new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24);
                    freshScore = Math.max(0, 1 - (daysOld / 90));
                }
                const timeFactor = 0.6 + (0.4 * freshScore);

                // 4. Stable Random Epsilon (-0.03 to +0.03)
                // We use the ID char codes to create a stable seed per course so it doesn't jitter on re-render
                const seed = (c.id || "0").toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                // Simple pseudo-random sine wave based on seed
                const randomJitter = Math.sin(seed) * 0.03; 

                // Final Multiplication
                return planF * bookF * timeFactor * (1 + randomJitter);
            };

            return getScore(b) - getScore(a); // Sort Descending
        });
    }, [filteredCourses]);

    return (
        <div className="min-h-screen bg-beige">
            <div className="bg-white border-b pt-8 pb-4 sticky top-20 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input type="text" placeholder={t.search_refine} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-beige border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                        </div>
                        <LocationDropdown locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} />
                        <LanguageDropdown selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} langMenuOpen={langMenuOpen} setLangMenuOpen={setLangMenuOpen} langMenuRef={langMenuRef} t={t} />
                        <button onClick={() => { resetFilters(); setSelectedLanguage(null); }} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition" title="Reset Filters"><X className="w-6 h-6" /></button>
                    </div>

                    {/* NEW TAXONOMY FILTERS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <select value={searchType} onChange={(e) => { setSearchType(e.target.value); setSearchArea(""); setSearchSpecialty(""); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Alle Kategorien</option>
                            {availableTypes.map(type => (<option key={type} value={type}>{getLabel(type, 'type')}</option>))}
                        </select>
                        <select value={searchArea} onChange={(e) => { setSearchArea(e.target.value); setSearchSpecialty(""); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" disabled={!searchType}>
                            <option value="">Alle Bereiche</option>
                            {availableAreas.map(area => (<option key={area} value={area}>{getLabel(area, 'area')}</option>))}
                        </select>
                        <select value={searchSpecialty} onChange={(e) => setSearchSpecialty(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" disabled={!searchArea}>
                            <option value="">Alle Themen</option>
                            {availableSpecialties.map(spec => (<option key={spec} value={spec}>{spec}</option>))}
                        </select>
                         <select value={searchAge} onChange={(e) => setSearchAge(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">Zielgruppe (Alle)</option>
                            {availableAgeGroups.map(age => (<option key={age} value={age}>{getLabel(age, 'age')}</option>))}
                        </select>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2 items-center border-t pt-3 border-gray-100">
                        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200"><Calendar className="w-4 h-4 text-gray-500" /><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600" /></div>
                        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200"><span className="text-sm text-gray-500">{t.lbl_max_price}</span><input type="number" placeholder="Any" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-16 bg-transparent text-sm outline-none text-gray-600" /></div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none text-gray-600"><option value="All">{t.opt_all_levels}</option>{Object.keys(COURSE_LEVELS).map(k => <option key={k} value={k}>{COURSE_LEVELS[k].de}</option>)}</select>
                         <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterPro ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`} title={t.tooltip_pro_verified}><input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary" /><span className={`text-sm font-medium ${filterPro ? 'text-blue-700' : 'text-gray-600'}`}>{t.lbl_professional_filter}</span><Shield className="w-3 h-3 text-blue-500" /></label>
                    </div>
                </div>
                 {(searchType || searchArea || selectedLocations.length > 0 || searchAge || selectedLanguage) && (
                    <div className="max-w-7xl mx-auto px-4 pt-2 flex gap-2 flex-wrap">
                        {searchType && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold flex items-center">{getLabel(searchType, 'type')}</span>}
                        {searchArea && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-md flex items-center"><ChevronRight className="w-3 h-3 mr-1"/> {getLabel(searchArea, 'area')}</span>}
                        {searchAge && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md flex items-center"><User className="w-3 h-3 mr-1"/> {getLabel(searchAge, 'age')}</span>}
                        {selectedLanguage && <span onClick={() => setSelectedLanguage(null)} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-purple-200 flex items-center"><Globe className="w-3 h-3 mr-1"/> {selectedLanguage} <X className="w-3 h-3 ml-1 opacity-50" /></span>}
                        {selectedLocations.map((loc, i) => (<span key={i} onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">{loc} <X className="w-3 h-3 ml-1 opacity-50" /></span>))}
                    </div>
                 )}
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                 {loading ? <div className="text-center py-20"><Loader className="animate-spin w-10 h-10 text-primary mx-auto" /></div> : filteredCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {sortedCourses.map(course => (
                      <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                        <div className="relative h-48 overflow-hidden">
                            <img src={course.image_url} alt={course.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                                <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm flex items-center"><MapPin className="w-3 h-3 mr-1 text-primary" />{course.canton}</div>
                                {course.is_pro && <div className="bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-bold shadow-sm flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Pro</div>}
                            </div>

                            <button
                                type="button"
                                title={(savedCourseIds || []).includes(course.id) ? "Aus Merkliste entfernen" : "Kurs merken"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSaveCourse && onToggleSaveCourse(course);
                                }}
                                className={`absolute top-3 right-3 w-10 h-10 rounded-full shadow-sm border flex items-center justify-center transition
                                    ${(savedCourseIds || []).includes(course.id)
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white/95 text-gray-700 border-white/70 hover:bg-white'}`}
                            >
                                {(savedCourseIds || []).includes(course.id)
                                    ? <BookmarkCheck className="w-5 h-5" />
                                    : <Bookmark className="w-5 h-5" />
                                }
                            </button>
                        </div>

                        <div className="p-5">
                            <h3 className="font-bold text-lg text-dark leading-tight line-clamp-2 h-12 mb-2 font-heading">
                                {course.title}
                            </h3>

                            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
                                {/* Anbieter-Badge */}
                                <div className="min-w-0">
                                    <div className="inline-flex items-center bg-beige px-2 py-1 rounded text-xs text-gray-500">
                                        <User className="w-3 h-3 text-gray-500 mr-1 shrink-0" />
                                        <span className="truncate">{course.instructor_name}</span>
                                    </div>
                                </div>

                                {/* Preis */}
                                <span className="ml-3 font-heading font-bold text-primary text-xs leading-tight text-right">
                                    {getPriceLabel(course)}
                                </span>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 px-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 font-heading">
                        Kursangebot im Aufbau
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-6">
                        In deiner Region bauen wir das Angebot gerade auf. <br />
                        Melde dich unten im Footer für unseren Newsletter an, um informiert zu bleiben.
                    </p>
                    <button 
                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        className="text-primary font-bold hover:text-orange-700 transition flex items-center justify-center mx-auto gap-2 border border-orange-200 px-4 py-2 rounded-lg bg-orange-50 hover:bg-orange-100"
                    >
                        Zum Newsletter scrollen <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
            </main>
        </div>
    );
};

export default SearchPageView;