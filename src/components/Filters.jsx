import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, MapPin, Globe, Monitor } from 'lucide-react';
import { SWISS_CANTONS, DELIVERY_TYPES, COURSE_LANGUAGES, TYPE_DISPLAY_LABELS, BERUF_SAEULEN, PRIVAT_KURSARTEN, KINDER_KURSARTEN } from '../lib/constants';
import { Clock, BookOpen, Award, GraduationCap } from 'lucide-react';
import { useTaxonomy } from '../hooks/useTaxonomy';

export const CategoryDropdown = ({ rootCategory, selectedCatPath, setSelectedCatPath, catMenuOpen, setCatMenuOpen, t, catMenuRef }) => {
    // Load taxonomy from DB
    const { types, areas, specialties, focuses, courseCounts } = useTaxonomy();

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

    // Helper to get type label (Level 1) – use display labels matching header/navigation
    const getTypeLabel = (typeId) => {
        const slug = types.find(t => t.id === typeId)?.slug || typeId;
        return TYPE_DISPLAY_LABELS[slug] || activeTypes[typeId]?.de || formatSlugToLabel(String(typeId));
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
                aria-controls="category-dropdown-menu"
                className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedCatPath.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}
            >
                <span className="truncate max-w-[150px]">{getButtonLabel()}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            </button>
            {catMenuOpen && (() => {
                // Mobile step: which column to show on small screens
                const mobileStep = lvl3 && currentFocuses.length > 0 ? 4
                    : lvl2 ? 3
                    : lvl1 ? 2
                    : 1;
                return (
                <div id="category-dropdown-menu" className="absolute top-14 left-0 w-[calc(100vw-2rem)] md:w-[900px] bg-white rounded-xl shadow-2xl border border-gray-100 p-0 flex flex-col md:flex-row h-[400px] overflow-hidden" role="listbox">

                    {/* Mobile back button */}
                    {mobileStep > 1 && (
                        <button
                            className="md:hidden flex items-center gap-1 px-4 py-2 text-sm text-primary font-medium border-b border-gray-100 w-full bg-gray-50 shrink-0"
                            onClick={() => {
                                if (mobileStep === 4) setLvl3(null);
                                else if (mobileStep === 3) setLvl2(null);
                                else if (mobileStep === 2 && !rootCategory) setLvl1(null);
                            }}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Zurück
                        </button>
                    )}

                    {/* Level 1: TYPES – fixed width */}
                    <div className={`${mobileStep === 1 ? '' : 'hidden md:block'} w-full md:w-[180px] md:shrink-0 border-r overflow-y-auto bg-gray-50`}>
                        {availableLvl1.map(cat => (
                            <button type="button" key={cat} onClick={() => { setLvl1(cat); setLvl2(null); setLvl3(null); }} className={`w-full text-left p-4 cursor-pointer text-sm flex justify-between items-center transition ${lvl1 === cat ? 'bg-white font-bold text-primary shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}>
                                {getTypeLabel(cat)}
                                <ChevronRight className={`w-4 h-4 ${lvl1 === cat ? 'text-primary' : 'text-gray-300'}`} aria-hidden="true" />
                            </button>
                        ))}
                        {!rootCategory && <button type="button" onClick={() => { setSelectedCatPath([]); setCatMenuOpen(false); }} className="w-full text-left p-4 text-xs text-gray-500 cursor-pointer hover:text-primary border-t mt-2">Auswahl löschen</button>}
                    </div>

                    {/* Level 2: AREAS – fixed width */}
                    <div className={`${mobileStep === 2 ? '' : 'hidden md:block'} w-full md:w-[230px] md:shrink-0 border-r overflow-y-auto bg-white`}>
                        {lvl1 ? (
                            areas
                                .filter(area => area.level1_id === lvl1 || area.type_id === lvl1)
                                .filter(area => (courseCounts.level2[area.id] || 0) > 0)
                                .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'))
                                .map(area => (
                                <button type="button" key={area.id} onClick={() => { setLvl2(area.id); setLvl3(null); }} className={`w-full text-left p-3 mx-2 my-1 rounded-lg cursor-pointer text-sm flex justify-between items-center transition ${lvl2 === area.id ? 'bg-primaryLight font-bold text-primary' : 'text-gray-700 hover:bg-gray-50'}`}>
                                    {area.label_de}
                                    <ChevronRight className={`w-4 h-4 ${lvl2 === area.id ? 'text-primary' : 'text-gray-300'}`} aria-hidden="true" />
                                </button>
                            ))
                        ) : <div className="p-6 text-sm text-gray-400 italic">Wähle zuerst eine Hauptkategorie...</div>}
                    </div>

                    {/* Level 3: SPECIALTIES – fixed width */}
                    <div className={`${mobileStep === 3 ? '' : 'hidden md:block'} w-full md:w-[240px] md:shrink-0 border-r overflow-y-auto bg-white`}>
                        {lvl1 && lvl2 ? (
                            specialties
                                .filter(spec => spec.level2_id === lvl2 || spec.area_id === lvl2)
                                .filter(spec => (courseCounts.level3[spec.id] || 0) > 0)
                                .sort((a, b) => (a.label_de || '').localeCompare(b.label_de || '', 'de'))
                                .map(spec => {
                                    const hasFocuses = focuses.some(f => f.level3_id === spec.id || f.specialty_id === spec.id);
                                    return (
                                        <button type="button" key={spec.id} onClick={() => handleSpecialtyClick(spec.label_de)} className={`w-full text-left p-3 mx-2 cursor-pointer text-sm flex justify-between items-center rounded transition ${lvl3 === spec.label_de ? 'bg-primaryLight font-bold text-primary' : 'text-gray-600 hover:text-primary hover:bg-gray-50'}`}>
                                            {spec.label_de}
                                            {hasFocuses && <ChevronRight className={`w-4 h-4 ${lvl3 === spec.label_de ? 'text-primary' : 'text-gray-300'}`} aria-hidden="true" />}
                                        </button>
                                    );
                                })
                        ) : <div className="p-6 text-sm text-gray-400 italic">{lvl1 ? "Wähle einen Bereich..." : ""}</div>}
                    </div>

                    {/* Level 4: FOCUSES – fills remaining space */}
                    <div className={`${mobileStep === 4 ? '' : 'hidden md:block'} w-full md:flex-1 overflow-y-auto bg-white`}>
                        {currentFocuses.length > 0 ? (
                            <>
                                <button type="button" onClick={() => { setSelectedCatPath([lvl1, lvl2, lvl3]); setCatMenuOpen(false); }} className="w-full text-left p-3 mx-2 cursor-pointer text-sm text-gray-500 hover:text-primary hover:bg-gray-50 rounded transition italic">
                                    Alle {lvl3}
                                </button>
                                {currentFocuses.map(focus => (
                                    <button type="button" key={focus} onClick={() => { setSelectedCatPath([lvl1, lvl2, lvl3, focus]); setCatMenuOpen(false); }} className="w-full text-left p-3 mx-2 cursor-pointer text-sm text-gray-600 hover:text-primary hover:bg-gray-50 rounded transition">
                                        {focus}
                                    </button>
                                ))}
                            </>
                        ) : null}
                    </div>

                </div>
                );
            })()}
        </div>
    );
};

export const LocationDropdown = ({ selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, t, buttonClassName }) => {
    const toggleLoc = (loc) => { if (selectedLocations.includes(loc)) setSelectedLocations(selectedLocations.filter(l => l !== loc)); else setSelectedLocations([...selectedLocations, loc]); };
    const displayList = SWISS_CANTONS.filter(c => c !== "Ausland");
    const defaultBtnClass = `w-full md:w-auto px-3 py-1.5 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedLocations.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`;
    return (
        <div ref={locMenuRef} className="static relative z-50 text-left">
            <button
                type="button"
                onClick={() => setLocMenuOpen(!locMenuOpen)}
                aria-label="Standort auswählen"
                aria-expanded={locMenuOpen}
                aria-haspopup="listbox"
                className={buttonClassName || defaultBtnClass}
            >
                 <div className="flex items-center"><MapPin className="w-4 h-4 mr-2" aria-hidden="true" /><span>{selectedLocations.length > 0 ? `${selectedLocations.length} ausgewählt` : t.filter_label_loc}</span></div><ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {locMenuOpen && (
                <div className="absolute top-10 left-0 w-[calc(100vw-2rem)] md:w-[560px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
                    {/* Online – special item */}
                    <label className="flex items-center space-x-2 p-2 mb-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-100 pb-3">
                        <input type="checkbox" checked={selectedLocations.includes('Online')} onChange={() => toggleLoc('Online')} className="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-sm font-medium text-gray-700">Online</span>
                        <Globe className="w-4 h-4 text-gray-400" />
                    </label>
                    {/* Cantons in 3-column grid, Liechtenstein last with FL tag */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2">
                        {[...displayList.filter(l => l !== 'Online' && l !== 'Liechtenstein'), 'Liechtenstein'].map(loc => (
                            <label key={loc} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                <input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLoc(loc)} className="rounded border-gray-300 text-primary focus:ring-primary shrink-0" />
                                <span className="text-sm text-gray-700 truncate">{loc}</span>
                                {loc === 'Liechtenstein' && <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded shrink-0">FL</span>}
                            </label>
                        ))}
                    </div>
                    <div className="pt-3 mt-3 border-t flex justify-between items-center"><button onClick={() => setSelectedLocations([])} className="text-xs text-gray-400 hover:text-red-500">Löschen</button><button onClick={() => setLocMenuOpen(false)} className="text-xs font-bold text-primary">Fertig</button></div>
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
                className={`w-full md:w-auto px-3 py-1.5 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedLanguages.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}
            >
                <div className="flex items-center">
                    <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
                    <span>{selectedLanguages.length > 0 ? `${selectedLanguages.length} ${t?.filter_lang_selected || "ausgewählt"}` : (t?.filter_label_lang || "Kurssprache")}</span>
                </div>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {langMenuOpen && (
                <div className="absolute top-10 left-0 w-[250px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
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
                        <button onClick={() => setSelectedLanguages([])} className="text-xs text-gray-400 hover:text-red-500">Löschen</button>
                        <button onClick={() => setLangMenuOpen(false)} className="text-xs font-bold text-primary">Fertig</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const DeliveryTypeFilter = ({ selectedDeliveryTypes, setSelectedDeliveryTypes, deliveryMenuOpen, setDeliveryMenuOpen, deliveryMenuRef, t, buttonClassName }) => {
    const toggleDeliveryType = (type) => {
        if (selectedDeliveryTypes.includes(type)) {
            setSelectedDeliveryTypes(selectedDeliveryTypes.filter(t => t !== type));
        } else {
            setSelectedDeliveryTypes([...selectedDeliveryTypes, type]);
        }
    };

    const defaultBtnClass = `w-full md:w-auto px-3 py-1.5 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedDeliveryTypes.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`;

    return (
        <div ref={deliveryMenuRef} className="static relative z-50 text-left">
            <button
                type="button"
                onClick={() => setDeliveryMenuOpen(!deliveryMenuOpen)}
                aria-label="Kursformat auswählen"
                aria-expanded={deliveryMenuOpen}
                aria-haspopup="listbox"
                className={buttonClassName || defaultBtnClass}
            >
                <div className="flex items-center">
                    <Monitor className="w-4 h-4 mr-2" aria-hidden="true" />
                    <span>{selectedDeliveryTypes.length > 0 ? `${selectedDeliveryTypes.length} ausgewählt` : "Kursformat"}</span>
                </div>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {deliveryMenuOpen && (
                <div className="absolute top-10 left-0 w-[250px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
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
                        <button onClick={() => setSelectedDeliveryTypes([])} className="text-xs text-gray-400 hover:text-red-500">Löschen</button>
                        <button onClick={() => setDeliveryMenuOpen(false)} className="text-xs font-bold text-primary">Fertig</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SAEULEN_ICONS = { workshop: Clock, fachkurs: BookOpen, zertifikatslehrgang: Award, ausbildung: GraduationCap };

export const SaeulenFilter = ({ selectedSaule, setSelectedSaule }) => {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1 hidden md:inline">Kursformat:</span>
            {Object.entries(BERUF_SAEULEN).map(([key, config]) => {
                const Icon = SAEULEN_ICONS[key];
                const active = selectedSaule === key;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedSaule(active ? '' : key)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                            active
                                ? 'bg-blue-100 border-blue-300 text-blue-800 shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50'
                        }`}
                        title={config.description}
                        aria-pressed={active}
                    >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{config.shortDe}</span>
                        <span className={`text-[10px] hidden sm:inline ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                            ({config.subtitle})
                        </span>
                    </button>
                );
            })}
            {selectedSaule && (
                <button
                    type="button"
                    onClick={() => setSelectedSaule('')}
                    className="text-xs text-gray-400 hover:text-red-500 ml-1"
                    aria-label="Säulen-Filter zurücksetzen"
                >
                    ✕
                </button>
            )}
        </div>
    );
};

// Generischer Kursart-Filter für Privat & Hobby und Kinder & Jugend
export const KursartFilter = ({ kursarten, icons, selectedKursart, setSelectedKursart, colorScheme = 'orange' }) => {
    const activeStyle = colorScheme === 'green'
        ? 'bg-green-100 border-green-300 text-green-800 shadow-sm'
        : 'bg-orange-100 border-orange-300 text-orange-800 shadow-sm';
    const hoverStyle = colorScheme === 'green'
        ? 'hover:border-green-200 hover:bg-green-50'
        : 'hover:border-orange-200 hover:bg-orange-50';
    const subtitleStyle = colorScheme === 'green' ? 'text-green-600' : 'text-orange-600';

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1 hidden md:inline">Kursart:</span>
            {Object.entries(kursarten).map(([key, config]) => {
                const Icon = icons[key];
                const active = selectedKursart === key;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKursart(active ? '' : key)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                            active
                                ? activeStyle
                                : `bg-white border-gray-200 text-gray-600 ${hoverStyle}`
                        }`}
                        title={config.description}
                        aria-pressed={active}
                    >
                        {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{config.shortDe}</span>
                        <span className={`text-[10px] hidden sm:inline ${active ? subtitleStyle : 'text-gray-400'}`}>
                            ({config.subtitle})
                        </span>
                    </button>
                );
            })}
            {selectedKursart && (
                <button
                    type="button"
                    onClick={() => setSelectedKursart('')}
                    className="text-xs text-gray-400 hover:text-red-500 ml-1"
                    aria-label="Kursart-Filter zurücksetzen"
                >
                    ✕
                </button>
            )}
        </div>
    );
};

