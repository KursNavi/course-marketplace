import React from 'react';
import { Search, ChevronRight, User, X, Calendar, Shield, MapPin, CheckCircle, Loader } from 'lucide-react';
import { LocationDropdown } from './Filters';
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
    t, filterDate, setFilterDate, filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel, filterPro, setFilterPro 
}) => {

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

    const resetFilters = () => {
        setSearchType(""); setSearchArea(""); setSearchSpecialty(""); setSearchAge("");
        setSelectedLocations([]); setSearchQuery(""); setFilterDate(""); setFilterPriceMax(""); setFilterLevel("All"); setFilterPro(false);
    };

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
                        <button onClick={resetFilters} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition" title="Reset Filters"><X className="w-6 h-6" /></button>
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
                 {(searchType || searchArea || selectedLocations.length > 0 || searchAge) && (
                    <div className="max-w-7xl mx-auto px-4 pt-2 flex gap-2 flex-wrap">
                        {searchType && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold flex items-center">{getLabel(searchType, 'type')}</span>}
                        {searchArea && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-md flex items-center"><ChevronRight className="w-3 h-3 mr-1"/> {getLabel(searchArea, 'area')}</span>}
                        {searchAge && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md flex items-center"><User className="w-3 h-3 mr-1"/> {getLabel(searchAge, 'age')}</span>}
                        {selectedLocations.map((loc, i) => (<span key={i} onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">{loc} <X className="w-3 h-3 ml-1 opacity-50" /></span>))}
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

export default SearchPageView;