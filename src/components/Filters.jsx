import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MapPin, Globe, Monitor } from 'lucide-react';
import { SWISS_CANTONS, DELIVERY_TYPES, COURSE_LANGUAGES } from '../lib/constants';
import { useTaxonomy } from '../hooks/useTaxonomy';

export const CategoryDropdown = ({ rootCategory, selectedCatPath, setSelectedCatPath, catMenuOpen, setCatMenuOpen, t, catMenuRef }) => {
    // Load taxonomy from DB
    const { types, areas, specialties, focuses, courseCounts, schemaVersion } = useTaxonomy();

    // Debug: Log the loaded taxonomy data
    console.log('[Filters] schemaVersion:', schemaVersion);
    console.log('[Filters] types:', types.length, types.map(t => t.label_de));
    console.log('[Filters] areas sample:', areas.slice(0, 5).map(a => ({ id: a.id, label_de: a.label_de })));

    const [lvl1, setLvl1] = useState(rootCategory || null);
    const [lvl2, setLvl2] = useState(null);
    const [lvl3, setLvl3] = useState(null);

    // Reset internal state when menu closes or root changes
    useEffect(() => {
        if (!catMenuOpen) { setLvl1(rootCategory || null); setLvl2(null); setLvl3(null); }
    }, [catMenuOpen, rootCategory]);

    const activeTypes = types.length > 0
        ? Object.fromEntries(types.map(t => [t.id, { de: t.label_de, en: t.label_en, fr: t.label_fr, it: t.label_it }]))
        : {};

    // Helper to format slug to readable label (e.g. "bildung_soziales" -> "Bildung & Soziales")
    const formatSlugToLabel = (slug) => {
        if (!slug || typeof slug !== 'string') return slug;
        return slug
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .replace(/ Und /g, ' & ');
    };

    // Helper to get type label (Level 1)
    const getTypeLabel = (typeId) => {
        return activeTypes[typeId]?.de || formatSlugToLabel(String(typeId));
    };

    // Get Level 1 types from DB, filtered by course count
    const availableLvl1 = rootCategory
        ? [rootCategory]
        : types.map(t => t.id).filter(id => (courseCounts.level1[id] || courseCounts.level1[String(id)] || 0) > 0);

    // Get focuses for the selected specialty (lvl3 is the specialty label)
    const selectedSpecialty = lvl3 ? specialties.find(s => s.label_de === lvl3) : null;
    const currentFocuses = selectedSpecialty
        ? focuses.filter(f => f.level3_id === selectedSpecialty.id || f.specialty_id === selectedSpecialty.id).map(f => f.label_de)
        : [];

    // Display text for the main button
    const getButtonLabel = () => {
        if (selectedCatPath.length === 0) return t?.filter_label_cat || "Kategorie";
        const lastItem = selectedCatPath[selectedCatPath.length - 1];
        // Try to find the label for the last item
        const typeLabel = activeTypes[lastItem]?.de;
        if (typeLabel) return typeLabel;
        return lastItem;
    };

    // Handle specialty click: if focuses exist, show them; otherwise select directly
    const handleSpecialtyClick = (specialtyLabel) => {
        const specialty = specialties.find(s => s.label_de === specialtyLabel);
        const hasFocuses = specialty && focuses.some(f => f.level3_id === specialty.id || f.specialty_id === specialty.id);
        if (hasFocuses) {
            setLvl3(specialtyLabel);
        } else {
            setSelectedCatPath([lvl1, lvl2, specialtyLabel]);
            setCatMenuOpen(false);
        }
    };

    return (
        <div ref={catMenuRef} className="static relative z-50 text-left">
            <button
                type="button"
                onClick={() => setCatMenuOpen(!catMenuOpen)}
                aria-label="Kategorie auswählen"
                aria-expanded={catMenuOpen}
                aria-haspopup="listbox"
                className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedCatPath.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}
            >
                <span className="truncate max-w-[150px]">{getButtonLabel()}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            </button>
            {catMenuOpen && (
                <div className={`absolute top-14 left-0 w-[300px] ${currentFocuses.length > 0 ? 'md:w-[900px]' : 'md:w-[700px]'} bg-white rounded-xl shadow-2xl border border-gray-100 p-0 flex flex-col md:flex-row h-[400px] overflow-hidden`}>

                    {/* Level 1: TYPES (Beruflich, Privat, Kinder) */}
                    <div className={`w-full ${currentFocuses.length > 0 ? 'md:w-1/4' : 'md:w-1/3'} border-r overflow-y-auto bg-gray-50`}>
                        {availableLvl1.map(cat => (
                            <div key={cat} onClick={() => { setLvl1(cat); setLvl2(null); setLvl3(null); }} className={`p-4 cursor-pointer text-sm flex justify-between items-center transition ${lvl1 === cat ? 'bg-white font-bold text-primary shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}>
                                {getTypeLabel(cat)}
                                <ChevronRight className={`w-4 h-4 ${lvl1 === cat ? 'text-primary' : 'text-gray-300'}`} />
                            </div>
                        ))}
                        {!rootCategory && <div onClick={() => { setSelectedCatPath([]); setCatMenuOpen(false); }} className="p-4 text-xs text-gray-400 cursor-pointer hover:text-primary border-t mt-2">Auswahl löschen</div>}
                    </div>

                    {/* Level 2: AREAS (e.g. Business, Sport) */}
                    <div className={`w-full ${currentFocuses.length > 0 ? 'md:w-1/4' : 'md:w-1/3'} border-r overflow-y-auto bg-white`}>
                        {lvl1 ? (
                            // Filter areas by level1 and course count, then render
                            areas
                                .filter(area => area.level1_id === lvl1 || area.type_id === lvl1)
                                .filter(area => (courseCounts.level2[area.id] || 0) > 0)
                                .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'))
                                .map(area => (
                                <div key={area.id} onClick={() => { setLvl2(area.id); setLvl3(null); }} className={`p-3 mx-2 my-1 rounded-lg cursor-pointer text-sm flex justify-between items-center transition ${lvl2 === area.id ? 'bg-primaryLight font-bold text-primary' : 'text-gray-700 hover:bg-gray-50'}`}>
                                    {area.label_de}
                                    <ChevronRight className={`w-4 h-4 ${lvl2 === area.id ? 'text-primary' : 'text-gray-300'}`} />
                                </div>
                            ))
                        ) : <div className="p-6 text-sm text-gray-400 italic">Wähle zuerst eine Hauptkategorie...</div>}
                    </div>

                    {/* Level 3: SPECIALTIES (e.g. Marketing, Yoga) */}
                    <div className={`w-full ${currentFocuses.length > 0 ? 'md:w-1/4' : 'md:w-1/3'} ${currentFocuses.length > 0 ? 'border-r' : ''} overflow-y-auto bg-white`}>
                        {lvl1 && lvl2 ? (
                            // Filter specialties by level2 and course count, then render
                            specialties
                                .filter(spec => spec.level2_id === lvl2 || spec.area_id === lvl2)
                                .filter(spec => (courseCounts.level3[spec.id] || 0) > 0)
                                .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'))
                                .map(spec => {
                                    const hasFocuses = focuses.some(f => f.level3_id === spec.id || f.specialty_id === spec.id);
                                    return (
                                        <div key={spec.id} onClick={() => handleSpecialtyClick(spec.label_de)} className={`p-3 mx-2 cursor-pointer text-sm flex justify-between items-center rounded transition ${lvl3 === spec.label_de ? 'bg-primaryLight font-bold text-primary' : 'text-gray-600 hover:text-primary hover:bg-gray-50'}`}>
                                            {spec.label_de}
                                            {hasFocuses && <ChevronRight className={`w-4 h-4 ${lvl3 === spec.label_de ? 'text-primary' : 'text-gray-300'}`} />}
                                        </div>
                                    );
                                })
                        ) : <div className="p-6 text-sm text-gray-400 italic">{lvl1 ? "Wähle einen Bereich..." : ""}</div>}
                    </div>

                    {/* Level 4: FOCUSES (e.g. Akustikgitarre, E-Gitarre) */}
                    {currentFocuses.length > 0 && (
                        <div className="w-full md:w-1/4 overflow-y-auto bg-white">
                            {/* Option to select just the specialty without a specific focus */}
                            <div onClick={() => { setSelectedCatPath([lvl1, lvl2, lvl3]); setCatMenuOpen(false); }} className="p-3 mx-2 cursor-pointer text-sm text-gray-400 hover:text-primary hover:bg-gray-50 rounded transition italic">
                                Alle {lvl3}
                            </div>
                            {currentFocuses.map(focus => (
                                <div key={focus} onClick={() => { setSelectedCatPath([lvl1, lvl2, lvl3, focus]); setCatMenuOpen(false); }} className="p-3 mx-2 cursor-pointer text-sm text-gray-600 hover:text-primary hover:bg-gray-50 rounded transition">
                                    {focus}
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};

export const LocationDropdown = ({ selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, t }) => {
    const toggleLoc = (loc) => { if (selectedLocations.includes(loc)) setSelectedLocations(selectedLocations.filter(l => l !== loc)); else setSelectedLocations([...selectedLocations, loc]); };
    const displayList = SWISS_CANTONS.filter(c => c !== "Ausland");
    return (
        <div ref={locMenuRef} className="static relative z-50 text-left">
            <button
                type="button"
                onClick={() => setLocMenuOpen(!locMenuOpen)}
                aria-label="Standort auswählen"
                aria-expanded={locMenuOpen}
                aria-haspopup="listbox"
                className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedLocations.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}
            >
                 <div className="flex items-center"><MapPin className="w-4 h-4 mr-2" aria-hidden="true" /><span>{selectedLocations.length > 0 ? `${selectedLocations.length} selected` : t.filter_label_loc}</span></div><ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {locMenuOpen && (
                <div className="absolute top-14 left-0 w-[300px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
                    <div className="max-h-[250px] overflow-y-auto space-y-1">
                        {displayList.map(loc => (<label key={loc} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLoc(loc)} className="rounded border-gray-300 text-primary focus:ring-primary" /><span className="text-sm text-gray-700">{loc}</span></label>))}
                    </div>
                    <div className="pt-3 mt-3 border-t flex justify-between items-center"><button onClick={() => setSelectedLocations([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button><button onClick={() => setLocMenuOpen(false)} className="text-xs font-bold text-primary">Done</button></div>
                </div>
            )}
        </div>
    );
};

export const LanguageDropdown = ({ selectedLanguages, setSelectedLanguages, langMenuOpen, setLangMenuOpen, langMenuRef, t }) => {
    const toggleLanguage = (lang) => {
        if (selectedLanguages.includes(lang)) {
            setSelectedLanguages(selectedLanguages.filter(l => l !== lang));
        } else {
            setSelectedLanguages([...selectedLanguages, lang]);
        }
    };

    return (
        <div ref={langMenuRef} className="static relative z-50 text-left">
            <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                aria-label="Kurssprache auswählen"
                aria-expanded={langMenuOpen}
                aria-haspopup="listbox"
                className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedLanguages.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}
            >
                <div className="flex items-center">
                    <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
                    <span>{selectedLanguages.length > 0 ? `${selectedLanguages.length} ${t?.filter_lang_selected || "ausgewählt"}` : (t?.filter_label_lang || "Kurssprache")}</span>
                </div>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {langMenuOpen && (
                <div className="absolute top-14 left-0 w-[250px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
                    <div className="space-y-1">
                        {Object.keys(COURSE_LANGUAGES).map(lang => (
                            <label key={lang} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedLanguages.includes(lang)}
                                    onChange={() => toggleLanguage(lang)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">{COURSE_LANGUAGES[lang].de}</span>
                            </label>
                        ))}
                    </div>
                    <div className="pt-3 mt-3 border-t flex justify-between items-center">
                        <button onClick={() => setSelectedLanguages([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                        <button onClick={() => setLangMenuOpen(false)} className="text-xs font-bold text-primary">Done</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const DeliveryTypeFilter = ({ selectedDeliveryTypes, setSelectedDeliveryTypes, deliveryMenuOpen, setDeliveryMenuOpen, deliveryMenuRef, t }) => {
    const toggleDeliveryType = (type) => {
        if (selectedDeliveryTypes.includes(type)) {
            setSelectedDeliveryTypes(selectedDeliveryTypes.filter(t => t !== type));
        } else {
            setSelectedDeliveryTypes([...selectedDeliveryTypes, type]);
        }
    };

    return (
        <div ref={deliveryMenuRef} className="static relative z-50 text-left">
            <button
                type="button"
                onClick={() => setDeliveryMenuOpen(!deliveryMenuOpen)}
                aria-label="Kursformat auswählen"
                aria-expanded={deliveryMenuOpen}
                aria-haspopup="listbox"
                className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedDeliveryTypes.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}
            >
                <div className="flex items-center">
                    <Monitor className="w-4 h-4 mr-2" aria-hidden="true" />
                    <span>{selectedDeliveryTypes.length > 0 ? `${selectedDeliveryTypes.length} selected` : "Kursformat"}</span>
                </div>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {deliveryMenuOpen && (
                <div className="absolute top-14 left-0 w-[250px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
                    <div className="space-y-1">
                        {Object.keys(DELIVERY_TYPES).map(key => (
                            <label key={key} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedDeliveryTypes.includes(key)}
                                    onChange={() => toggleDeliveryType(key)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">{DELIVERY_TYPES[key].de}</span>
                            </label>
                        ))}
                    </div>
                    <div className="pt-3 mt-3 border-t flex justify-between items-center">
                        <button onClick={() => setSelectedDeliveryTypes([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                        <button onClick={() => setDeliveryMenuOpen(false)} className="text-xs font-bold text-primary">Done</button>
                    </div>
                </div>
            )}
        </div>
    );
};