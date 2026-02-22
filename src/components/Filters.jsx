import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MapPin, Globe, Monitor } from 'lucide-react';
import { NEW_TAXONOMY, CATEGORY_TYPES, SWISS_CANTONS, DELIVERY_TYPES, COURSE_LANGUAGES } from '../lib/constants';
import { useTaxonomy } from '../hooks/useTaxonomy';

export const CategoryDropdown = ({ rootCategory, selectedCatPath, setSelectedCatPath, catMenuOpen, setCatMenuOpen, t, catMenuRef }) => {
    // Load taxonomy from DB (with fallback to constants.js)
    const { taxonomy, types, areas, courseCounts } = useTaxonomy();

    const [lvl1, setLvl1] = useState(rootCategory || null);
    const [lvl2, setLvl2] = useState(null);
    const [lvl3, setLvl3] = useState(null);

    // Reset internal state when menu closes or root changes
    useEffect(() => {
        if (!catMenuOpen) { setLvl1(rootCategory || null); setLvl2(null); setLvl3(null); }
    }, [catMenuOpen, rootCategory]);

    // Use taxonomy from DB or fallback to constants
    const activeTaxonomy = taxonomy || NEW_TAXONOMY;
    const activeTypes = types.length > 0
        ? Object.fromEntries(types.map(t => [t.id, { de: t.label_de, en: t.label_en, fr: t.label_fr, it: t.label_it }]))
        : CATEGORY_TYPES;

    // Helper to format slug to readable label (e.g. "bildung_soziales" -> "Bildung & Soziales")
    const formatSlugToLabel = (slug) => {
        if (!slug || typeof slug !== 'string') return slug;
        return slug
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .replace(/ Und /g, ' & ');
    };

    // Check if a string looks like a slug (contains underscores or is all lowercase with no spaces)
    const isSlug = (str) => {
        if (!str || typeof str !== 'string') return false;
        return str.includes('_') || (str === str.toLowerCase() && !str.includes(' '));
    };

    // Helper to get labels from the new structure (Defaulting to DE for now)
    const getLabel = (key, level, parentKey = null) => {
        if (!key) return "";
        if (level === 1) return activeTypes[key]?.de || formatSlugToLabel(String(key));
        if (level === 2) {
            // First try to find the area in the areas array (from DB)
            // Compare with both string and number versions of key
            const keyNum = typeof key === 'string' ? parseInt(key, 10) : key;
            const keyStr = String(key);
            const area = areas.find(a =>
                a.id === key ||
                a.id === keyNum ||
                a.id === keyStr ||
                a.slug === key ||
                a.slug === keyStr
            );
            // Only use label_de if it's not a slug
            if (area?.label_de && !isSlug(area.label_de)) return area.label_de;
            // If area has a slug, format that
            if (area?.slug) return formatSlugToLabel(area.slug);
            // Fallback to taxonomy structure - check both key formats
            if (parentKey) {
                const taxonomyLabel = activeTaxonomy[parentKey]?.[key]?.label?.de
                    || activeTaxonomy[parentKey]?.[keyNum]?.label?.de
                    || activeTaxonomy[parentKey]?.[keyStr]?.label?.de;
                if (taxonomyLabel && !isSlug(taxonomyLabel)) return taxonomyLabel;
            }
            // Last resort: format slug to readable label (key might be slug or ID)
            return isSlug(keyStr) ? formatSlugToLabel(keyStr) : keyStr;
        }
        return key; // Level 3+4 are plain strings
    };

    // Get Level 1 types - use types array if available (from DB), otherwise filter object keys
    // Only show types that have at least one course
    // Check both numeric and string keys for courseCounts lookup
    const availableLvl1 = rootCategory
        ? [rootCategory]
        : (types.length > 0
            ? types.map(t => t.id).filter(id => (courseCounts.level1[id] || courseCounts.level1[String(id)] || 0) > 0)
            : Object.keys(activeTaxonomy).filter(k => !isNaN(Number(k)) && (courseCounts.level1[k] || courseCounts.level1[Number(k)] || 0) > 0));

    // Get focuses for the selected specialty
    const currentFocuses = (lvl1 && lvl2 && lvl3)
        ? (activeTaxonomy[lvl1]?.[lvl2]?.specialtyFocuses?.[lvl3] || [])
        : [];

    // Display text for the main button
    const getButtonLabel = () => {
        if (selectedCatPath.length === 0) return t?.filter_label_cat || "Kategorie";
        const lastItem = selectedCatPath[selectedCatPath.length - 1];
        if (activeTaxonomy[lastItem]) return activeTypes[lastItem]?.de || lastItem;
        return lastItem;
    };

    // Handle specialty click: if focuses exist, show them; otherwise select directly
    const handleSpecialtyClick = (item) => {
        const focuses = activeTaxonomy[lvl1]?.[lvl2]?.specialtyFocuses?.[item] || [];
        if (focuses.length > 0) {
            setLvl3(item);
        } else {
            setSelectedCatPath([lvl1, lvl2, item]);
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
                                {getLabel(cat, 1)}
                                <ChevronRight className={`w-4 h-4 ${lvl1 === cat ? 'text-primary' : 'text-gray-300'}`} />
                            </div>
                        ))}
                        {!rootCategory && <div onClick={() => { setSelectedCatPath([]); setCatMenuOpen(false); }} className="p-4 text-xs text-gray-400 cursor-pointer hover:text-primary border-t mt-2">Auswahl löschen</div>}
                    </div>

                    {/* Level 2: AREAS (e.g. Business, Sport) */}
                    <div className={`w-full ${currentFocuses.length > 0 ? 'md:w-1/4' : 'md:w-1/3'} border-r overflow-y-auto bg-white`}>
                        {lvl1 ? (
                            // Use _areaIds for ordered numeric IDs, filter out internal keys
                            // Only show areas that have at least one course
                            // Check both numeric and string keys for courseCounts lookup
                            (activeTaxonomy[lvl1]?._areaIds || Object.keys(activeTaxonomy[lvl1] || {}).filter(k => !k.startsWith('_') && !isNaN(Number(k))))
                                .filter(areaId => (courseCounts.level2[areaId] || courseCounts.level2[String(areaId)] || 0) > 0)
                                .map(areaId => (
                                <div key={areaId} onClick={() => { setLvl2(areaId); setLvl3(null); }} className={`p-3 mx-2 my-1 rounded-lg cursor-pointer text-sm flex justify-between items-center transition ${lvl2 === areaId ? 'bg-primaryLight font-bold text-primary' : 'text-gray-700 hover:bg-gray-50'}`}>
                                    {getLabel(areaId, 2, lvl1)}
                                    <ChevronRight className={`w-4 h-4 ${lvl2 === areaId ? 'text-primary' : 'text-gray-300'}`} />
                                </div>
                            ))
                        ) : <div className="p-6 text-sm text-gray-400 italic">Wähle zuerst eine Hauptkategorie...</div>}
                    </div>

                    {/* Level 3: SPECIALTIES (e.g. Marketing, Yoga) */}
                    <div className={`w-full ${currentFocuses.length > 0 ? 'md:w-1/4' : 'md:w-1/3'} ${currentFocuses.length > 0 ? 'border-r' : ''} overflow-y-auto bg-white`}>
                        {lvl1 && lvl2 ? (
                            // Use specialtyObjects if available (has IDs for filtering), otherwise fall back to specialties (no filtering)
                            // Check both numeric and string keys for courseCounts lookup
                            activeTaxonomy[lvl1]?.[lvl2]?.specialtyObjects?.length > 0
                                ? activeTaxonomy[lvl1][lvl2].specialtyObjects
                                    .filter(spec => (courseCounts.level3[spec.id] || courseCounts.level3[String(spec.id)] || 0) > 0)
                                    .map(spec => {
                                        const item = spec.label_de;
                                        const hasFocuses = (activeTaxonomy[lvl1]?.[lvl2]?.specialtyFocuses?.[item] || []).length > 0;
                                        return (
                                            <div key={spec.id} onClick={() => handleSpecialtyClick(item)} className={`p-3 mx-2 cursor-pointer text-sm flex justify-between items-center rounded transition ${lvl3 === item ? 'bg-primaryLight font-bold text-primary' : 'text-gray-600 hover:text-primary hover:bg-gray-50'}`}>
                                                {item}
                                                {hasFocuses && <ChevronRight className={`w-4 h-4 ${lvl3 === item ? 'text-primary' : 'text-gray-300'}`} />}
                                            </div>
                                        );
                                    })
                                : (activeTaxonomy[lvl1]?.[lvl2]?.specialties || []).map(item => {
                                    const hasFocuses = (activeTaxonomy[lvl1]?.[lvl2]?.specialtyFocuses?.[item] || []).length > 0;
                                    return (
                                        <div key={item} onClick={() => handleSpecialtyClick(item)} className={`p-3 mx-2 cursor-pointer text-sm flex justify-between items-center rounded transition ${lvl3 === item ? 'bg-primaryLight font-bold text-primary' : 'text-gray-600 hover:text-primary hover:bg-gray-50'}`}>
                                            {item}
                                            {hasFocuses && <ChevronRight className={`w-4 h-4 ${lvl3 === item ? 'text-primary' : 'text-gray-300'}`} />}
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