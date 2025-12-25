import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { CATEGORY_HIERARCHY, SWISS_CANTONS, SWISS_CITIES } from '../lib/constants';

export const CategoryDropdown = ({ rootCategory, selectedCatPath, setSelectedCatPath, catMenuOpen, setCatMenuOpen, t, getCatLabel, catMenuRef }) => {
    const [lvl1, setLvl1] = useState(rootCategory); 
    const [lvl2, setLvl2] = useState(null);
    
    useEffect(() => { if (rootCategory) setLvl1(rootCategory); }, [rootCategory]);
    const availableLvl1 = rootCategory ? [rootCategory] : Object.keys(CATEGORY_HIERARCHY);

    return (
        <div ref={catMenuRef} className="static relative z-50 text-left"> 
            <button type="button" onClick={() => setCatMenuOpen(!catMenuOpen)} className={`w-full md:w-auto px-4 py-3 border rounded-full flex items-center justify-between space-x-2 text-sm font-medium transition shadow-sm ${selectedCatPath.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                <span className="truncate max-w-[150px]">{selectedCatPath.length > 0 ? getCatLabel(selectedCatPath[selectedCatPath.length-1]) : t.filter_label_cat}</span><ChevronDown className="w-4 h-4 flex-shrink-0" />
            </button>
            {catMenuOpen && (
                <div className="absolute top-14 left-0 w-[300px] md:w-[600px] bg-white rounded-xl shadow-2xl border border-gray-100 p-2 flex flex-col md:flex-row h-[350px] overflow-hidden">
                    <div className="w-full md:w-1/3 border-r overflow-y-auto">
                        {availableLvl1.map(cat => (<div key={cat} onClick={() => { setLvl1(cat); setLvl2(null); }} className={`p-3 cursor-pointer text-sm flex justify-between items-center hover:bg-gray-50 ${lvl1 === cat ? 'font-bold text-primary bg-primaryLight' : 'text-gray-700'}`}>{getCatLabel(cat)}<ChevronRight className="w-4 h-4 text-gray-400" /></div>))}
                        {!rootCategory && <div onClick={() => { setSelectedCatPath([]); setCatMenuOpen(false); }} className="p-3 text-xs text-gray-400 cursor-pointer hover:text-primary border-t mt-2">Clear Selection</div>}
                    </div>
                    <div className="w-full md:w-1/3 border-r overflow-y-auto bg-gray-50/50">
                        {lvl1 ? Object.keys(CATEGORY_HIERARCHY[lvl1]).map(sub => (<div key={sub} onClick={() => setLvl2(sub)} className={`p-3 cursor-pointer text-sm flex justify-between items-center hover:bg-gray-100 ${lvl2 === sub ? 'font-bold text-primary' : 'text-gray-700'}`}>{getCatLabel(sub)}<ChevronRight className="w-4 h-4 text-gray-400" /></div>)) : <div className="p-4 text-xs text-gray-400">Select a category...</div>}
                    </div>
                    <div className="w-full md:w-1/3 overflow-y-auto bg-gray-50">
                        {lvl1 && lvl2 ? CATEGORY_HIERARCHY[lvl1][lvl2].map(item => (<div key={item} onClick={() => { setSelectedCatPath([lvl1, lvl2, item]); setCatMenuOpen(false); }} className="p-3 cursor-pointer text-sm text-gray-700 hover:text-primary hover:bg-white transition">{getCatLabel(item)}</div>)) : <div className="p-4 text-xs text-gray-400">Select a sub-category...</div>}
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