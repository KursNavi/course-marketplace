import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MapPin, Globe } from 'lucide-react';
import { NEW_TAXONOMY, CATEGORY_TYPES, SWISS_CANTONS, SWISS_CITIES } from '../lib/constants';
import { useTaxonomy } from '../hooks/useTaxonomy';

export const CategoryDropdown = ({ rootCategory, selectedCatPath, setSelectedCatPath, catMenuOpen, setCatMenuOpen, t, catMenuRef }) => {
    // Load taxonomy from DB (with fallback to constants.js)
    const { taxonomy, types } = useTaxonomy();

    const [lvl1, setLvl1] = useState(rootCategory || null);
    const [lvl2, setLvl2] = useState(null);

    // Reset internal state when menu closes or root changes
    useEffect(() => {
        if (!catMenuOpen) { setLvl1(rootCategory || null); setLvl2(null); }
    }, [catMenuOpen, rootCategory]);

    // Use taxonomy from DB or fallback to constants
    const activeTaxonomy = taxonomy || NEW_TAXONOMY;
    const activeTypes = types.length > 0
        ? Object.fromEntries(types.map(t => [t.id, { de: t.label_de, en: t.label_en, fr: t.label_fr, it: t.label_it }]))
        : CATEGORY_TYPES;

    // Helper to get labels from the new structure (Defaulting to DE for now)
    const getLabel = (key, level, parentKey = null) => {
        if (!key) return "";
        if (level === 1) return activeTypes[key]?.de || key;
        if (level === 2 && parentKey) return activeTaxonomy[parentKey]?.[key]?.label?.de || key;
        return key; // Level 3 are plain strings
    };

    const availableLvl1 = rootCategory ? [rootCategory] : Object.keys(activeTaxonomy);

    // Display text for the main button
    const getButtonLabel = () => {
        if (selectedCatPath.length === 0) return t?.filter_label_cat || "Kategorie";
        const lastItem = selectedCatPath[selectedCatPath.length - 1];
        // Try to find label if it's a key, otherwise return item itself (for L3)
        if (activeTaxonomy[lastItem]) return activeTypes[lastItem]?.de || lastItem;
        // Note: L2 keys are harder to reverse lookup without parent, displaying raw or lastItem is fine for now
        return lastItem;
    };

    return (
        <div ref={catMenuRef} className="static relative z-50 text-left"> 
            <button type="button" onClick={() => setCatMenuOpen(!catMenuOpen)} className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedCatPath.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                <span className="truncate max-w-[150px]">{getButtonLabel()}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
            </button>
            {catMenuOpen && (
                <div className="absolute top-14 left-0 w-[300px] md:w-[700px] bg-white rounded-xl shadow-2xl border border-gray-100 p-0 flex flex-col md:flex-row h-[400px] overflow-hidden">
                    
                    {/* Level 1: TYPES (Beruflich, Privat, Kinder) */}
                    <div className="w-full md:w-1/3 border-r overflow-y-auto bg-gray-50">
                        {availableLvl1.map(cat => (
                            <div key={cat} onClick={() => { setLvl1(cat); setLvl2(null); }} className={`p-4 cursor-pointer text-sm flex justify-between items-center transition ${lvl1 === cat ? 'bg-white font-bold text-primary shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}>
                                {getLabel(cat, 1)}
                                <ChevronRight className={`w-4 h-4 ${lvl1 === cat ? 'text-primary' : 'text-gray-300'}`} />
                            </div>
                        ))}
                        {!rootCategory && <div onClick={() => { setSelectedCatPath([]); setCatMenuOpen(false); }} className="p-4 text-xs text-gray-400 cursor-pointer hover:text-primary border-t mt-2">Auswahl löschen</div>}
                    </div>

                    {/* Level 2: AREAS (e.g. Business, Sport) */}
                    <div className="w-full md:w-1/3 border-r overflow-y-auto bg-white">
                        {lvl1 ? (
                            Object.keys(activeTaxonomy[lvl1] || {}).map(sub => (
                                <div key={sub} onClick={() => setLvl2(sub)} className={`p-3 mx-2 my-1 rounded-lg cursor-pointer text-sm flex justify-between items-center transition ${lvl2 === sub ? 'bg-primaryLight font-bold text-primary' : 'text-gray-700 hover:bg-gray-50'}`}>
                                    {getLabel(sub, 2, lvl1)}
                                    <ChevronRight className={`w-4 h-4 ${lvl2 === sub ? 'text-primary' : 'text-gray-300'}`} />
                                </div>
                            ))
                        ) : <div className="p-6 text-sm text-gray-400 italic">Wähle zuerst eine Hauptkategorie...</div>}
                    </div>

                    {/* Level 3: SPECIALTIES (e.g. Marketing, Yoga) */}
                    <div className="w-full md:w-1/3 overflow-y-auto bg-white">
                        {lvl1 && lvl2 ? (
                            (activeTaxonomy[lvl1]?.[lvl2]?.specialties || []).map(item => (
                                <div key={item} onClick={() => { setSelectedCatPath([lvl1, lvl2, item]); setCatMenuOpen(false); }} className="p-3 mx-2 cursor-pointer text-sm text-gray-600 hover:text-primary hover:bg-gray-50 rounded transition">
                                    {item}
                                </div>
                            ))
                        ) : <div className="p-6 text-sm text-gray-400 italic">{lvl1 ? "Wähle einen Bereich..." : ""}</div>}
                    </div>

                </div>
            )}
        </div>
    );
};

export const LocationDropdown = ({ locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, t }) => {
    const toggleLoc = (loc) => { if (selectedLocations.includes(loc)) setSelectedLocations(selectedLocations.filter(l => l !== loc)); else setSelectedLocations([...selectedLocations, loc]); };
    const displayList = locMode === 'canton' ? SWISS_CANTONS : SWISS_CITIES;
    return (
        <div ref={locMenuRef} className="static relative z-50 text-left">
            <button type="button" onClick={() => setLocMenuOpen(!locMenuOpen)} className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedLocations.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                 <div className="flex items-center"><MapPin className="w-4 h-4 mr-2" /><span>{selectedLocations.length > 0 ? `${selectedLocations.length} selected` : t.filter_label_loc}</span></div><ChevronDown className="w-4 h-4" />
            </button>
            {locMenuOpen && (
                <div className="absolute top-14 left-0 w-[300px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                        <button onClick={() => { setLocMode('canton'); setSelectedLocations([]); }} className={`flex-1 py-1 text-sm font-medium rounded-md transition ${locMode === 'canton' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>Cantons</button>
                        <button onClick={() => { setLocMode('city'); setSelectedLocations([]); }} className={`flex-1 py-1 text-sm font-medium rounded-md transition ${locMode === 'city' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>Cities</button>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto space-y-1">
                        {displayList.map(loc => (<label key={loc} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLoc(loc)} className="rounded border-gray-300 text-primary focus:ring-primary" /><span className="text-sm text-gray-700">{loc}</span></label>))}
                    </div>
                    <div className="pt-3 mt-3 border-t flex justify-between items-center"><button onClick={() => setSelectedLocations([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button><button onClick={() => setLocMenuOpen(false)} className="text-xs font-bold text-primary">Done</button></div>
                </div>
            )}
        </div>
    );
};

export const LanguageDropdown = ({ selectedLanguage, setSelectedLanguage, langMenuOpen, setLangMenuOpen, langMenuRef, t }) => {
    const languages = ['Deutsch', 'Französisch', 'Italienisch', 'Englisch', 'Andere'];

    return (
        <div ref={langMenuRef} className="static relative z-50 text-left">
            <button type="button" onClick={() => setLangMenuOpen(!langMenuOpen)} className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedLanguage ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                <div className="flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    <span>{selectedLanguage || (t?.filter_label_lang || "Sprache")}</span>
                </div>
                <ChevronDown className="w-4 h-4" />
            </button>
            {langMenuOpen && (
                <div className="absolute top-14 left-0 w-[200px] bg-white rounded-xl shadow-2xl border border-gray-100 p-2 overflow-hidden">
                    {languages.map(lang => (
                        <div key={lang} onClick={() => { setSelectedLanguage(lang === selectedLanguage ? null : lang); setLangMenuOpen(false); }} className={`p-3 cursor-pointer text-sm flex justify-between items-center hover:bg-gray-50 rounded ${selectedLanguage === lang ? 'font-bold text-primary bg-primaryLight' : 'text-gray-700'}`}>
                            {lang}
                            {selectedLanguage === lang && <ChevronRight className="w-4 h-4 text-primary" />}
                        </div>
                    ))}
                    {selectedLanguage && (
                        <div onClick={() => { setSelectedLanguage(null); setLangMenuOpen(false); }} className="p-3 text-xs text-gray-400 cursor-pointer hover:text-primary border-t mt-2">
                            Auswahl löschen
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};