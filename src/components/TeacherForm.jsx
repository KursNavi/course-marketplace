import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Loader, Calendar, Plus, Trash2, Info, ExternalLink, Globe } from 'lucide-react';
import { KursNaviLogo } from './Layout';
import { SWISS_CANTONS, NEW_TAXONOMY, CATEGORY_TYPES, COURSE_LEVELS, AGE_GROUPS } from '../lib/constants';
import { supabase } from '../lib/supabase';

const TeacherForm = ({ t, setView, user, initialData, fetchCourses, showNotification, setEditingCourse }) => {
    // New Taxonomy State
    const [selectedType, setSelectedType] = useState('privat_hobby');
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState('');
    
    // New Metadata State
    const [selectedLevel, setSelectedLevel] = useState('all_levels');
    const [selectedAgeGroups, setSelectedAgeGroups] = useState([]);
    const [courseLanguage, setCourseLanguage] = useState('Deutsch');

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Schedule State
    const [events, setEvents] = useState([{ start_date: '', location: '', max_participants: 0, canton: '', schedule_description: '' }]);

    useEffect(() => {
        // 1. Load Initial Data if editing
        if (initialData) {
            if (initialData.category_type) setSelectedType(initialData.category_type);
            if (initialData.category_area) setSelectedArea(initialData.category_area);
            if (initialData.category_specialty) setSelectedSpecialty(initialData.category_specialty);
            if (initialData.level) setSelectedLevel(initialData.level);
            if (initialData.target_age_groups) setSelectedAgeGroups(initialData.target_age_groups);
            if (initialData.language) setCourseLanguage(initialData.language); // Load saved language

            if (!initialData.category_type && initialData.category) setSelectedType('privat_hobby');
            
            if (initialData.course_events && initialData.course_events.length > 0) {
                setEvents(initialData.course_events.map(e => ({
                    start_date: e.start_date ? e.start_date.split('T')[0] : '', 
                    location: e.location,
                    max_participants: e.max_participants,
                    canton: e.canton || initialData.canton || '',
                    schedule_description: e.schedule_description || ''
                })));
            } else if (initialData.start_date) {
                setEvents([{ start_date: initialData.start_date, location: initialData.address || '', max_participants: 0, canton: initialData.canton || '', schedule_description: '' }]);
            }
        } 
        // 2. If Creating NEW: Fetch User Profile Language preference
        else if (user && user.id) {
             supabase.from('profiles').select('preferred_language').eq('id', user.id).single()
             .then(({ data }) => {
                 if (data?.preferred_language) {
                    const map = { de: 'Deutsch', fr: 'Französisch', it: 'Italienisch', en: 'Englisch' };
                    if (map[data.preferred_language]) setCourseLanguage(map[data.preferred_language]);
                 }
             });
        }
    }, [initialData, user]);

    // Taxonomy Helpers
    const getAreas = (type) => type && NEW_TAXONOMY[type] ? Object.keys(NEW_TAXONOMY[type]) : [];
    const getSpecialties = (type, area) => type && area && NEW_TAXONOMY[type][area] ? NEW_TAXONOMY[type][area].specialties : [];
    
    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setSelectedType(newType);
        setSelectedArea(''); 
        setSelectedSpecialty(''); 
    };

    const handleAreaChange = (e) => {
        setSelectedArea(e.target.value);
        setSelectedSpecialty('');
    };

    const toggleAgeGroup = (key) => {
        if (selectedAgeGroups.includes(key)) {
            setSelectedAgeGroups(selectedAgeGroups.filter(k => k !== key));
        } else {
            setSelectedAgeGroups([...selectedAgeGroups, key]);
        }
    };

    const addEvent = () => setEvents([...events, { start_date: '', location: '', max_participants: 0, canton: '', schedule_description: '' }]);
    const removeEvent = (index) => setEvents(events.filter((_, i) => i !== index));
    const updateEvent = (index, field, value) => {
        const newEvents = [...events];
        newEvents[index][field] = value;
        setEvents(newEvents);
    };

    // --- LOGIC MOVED FROM APP.JSX ---
    const handlePublishCourse = async (e) => {
        e.preventDefault();
        const eventsList = events; // Use local state
        const formData = new FormData(e.target);
        const courseId = formData.get('course_id');
        const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');
        
        const catType = formData.get('category_type');
        const catArea = formData.get('category_area');
        const catSpec = formData.get('category_specialty');
        const level = formData.get('level');
        const ageGroups = JSON.parse(formData.get('target_age_groups_json') || '[]');

        if (isSubmitting) return;

        // Validation
        const validEvents = eventsList.filter(ev => ev.start_date && ev.location && ev.canton);
        if (validEvents.length === 0) { alert("Please add at least one valid date, location and canton."); return; }
        if (!catType || !catArea || !catSpec) { alert("Bitte wählen Sie eine vollständige Kategorie aus."); return; }
        if (ageGroups.length === 0) { alert("Bitte wählen Sie mindestens eine Altersgruppe aus."); return; }

        setIsSubmitting(true);

        // 1. Image Upload Logic
        let imageUrl = initialData?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600";
        const imageFile = formData.get('courseImage');

        if (imageFile && imageFile.size > 0) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('course-images').upload(fileName, imageFile);
            if (uploadError) { 
                showNotification("Error uploading image: " + uploadError.message); 
                setIsSubmitting(false);
                return; 
            }
            const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(fileName);
            imageUrl = publicUrl;
        }

        // 2. Prepare Base Course Data
        const mainLocation = validEvents[0].location;
        const mainDate = validEvents[0].start_date;

        const newCourse = {
            title: formData.get('title'), 
            instructor_name: user.name, 
            price: Number(formData.get('price')), 
            language: formData.get('language'),
            rating: 0, 
            category: `${catType} | ${catArea}`, // Legacy
            category_type: catType,
            category_area: catArea,
            category_specialty: catSpec,
            level: level,
            target_age_groups: ageGroups,
            canton: formData.get('canton'), 
            address: mainLocation, 
            start_date: mainDate,
            image_url: imageUrl, 
            description: formData.get('description'), 
            keywords: formData.get('keywords'),
            objectives: objectivesList, 
            prerequisites: formData.get('prerequisites'),
            session_count: Number(formData.get('sessionCount')), 
            session_length: formData.get('sessionLength'), 
            provider_url: formData.get('providerUrl'), 
            user_id: user.id, 
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

        if (error) { 
            console.error(error); 
            showNotification("Error saving course: " + error.message); 
            setIsSubmitting(false);
            return; 
        } 

        // 3. HANDLE EVENTS
        if (activeCourseId && validEvents.length > 0) {
            await supabase.from('course_events').delete().eq('course_id', activeCourseId);
            const eventsToInsert = validEvents.map(ev => ({
                course_id: activeCourseId,
                start_date: ev.start_date,
                location: ev.location,
                canton: ev.canton,
                schedule_description: ev.schedule_description,
                max_participants: parseInt(ev.max_participants) || 0
            }));
            await supabase.from('course_events').insert(eventsToInsert);
        }

        // Cleanup and Redirect
        fetchCourses(); 
        setEditingCourse(null);
        setView('dashboard'); 
        setIsSubmitting(false);
    };

    return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
        <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> {t.btn_back_dash}</button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4"><h1 className="text-3xl font-bold text-dark font-heading">{initialData ? t.edit_course : t.create_course}</h1><p className="text-gray-500 mt-2">{initialData ? t.edit_course_sub : t.create_course_sub}</p></div>
            
            <form onSubmit={handlePublishCourse} className="space-y-8">
                {initialData && <input type="hidden" name="course_id" value={initialData.id} />}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                         <label className="block text-sm font-bold text-gray-700 mb-1">Course Image</label>
                         <div className="flex items-center gap-4">
                            {initialData?.image_url && <img src={initialData.image_url} className="w-16 h-16 rounded object-cover border" alt="Current" />}
                           <input type="file" name="courseImage" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-primary hover:file:bg-orange-100 cursor-pointer border rounded-lg p-1" />
                         </div>
                    </div>
                    
                    <div className="md:col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Kurssprache</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                            <select name="language" value={courseLanguage} onChange={(e) => setCourseLanguage(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary bg-white outline-none">
                                <option value="Deutsch">Deutsch</option>
                                <option value="Französisch">Französisch</option>
                                <option value="Italienisch">Italienisch</option>
                                <option value="Englisch">Englisch</option>
                                <option value="Andere">Andere</option>
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_title}</label>
                    
                    {/* NEW TAXONOMY & METADATA SECTION */}
                    <div className="md:col-span-2 bg-beige p-5 rounded-xl border border-orange-100 space-y-6">
                        
                        {/* 1. Category Classification */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t.lbl_cat_class}</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Type */}
                                <div>
                                    <span className="text-xs text-gray-500 block mb-1">Typ (Hauptkategorie)</span>
                                    <select name="category_type" value={selectedType} onChange={handleTypeChange} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">
                                        {Object.keys(CATEGORY_TYPES).map(key => (
                                            <option key={key} value={key}>{CATEGORY_TYPES[key].de}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Area */}
                                <div>
                                    <span className="text-xs text-gray-500 block mb-1">Bereich</span>
                                    <select name="category_area" value={selectedArea} onChange={handleAreaChange} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm" disabled={!selectedType}>
                                        <option value="">Bitte wählen...</option>
                                        {getAreas(selectedType).map(key => (
                                            <option key={key} value={key}>{NEW_TAXONOMY[selectedType][key].label.de}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Specialty */}
                                <div>
                                    <span className="text-xs text-gray-500 block mb-1">Spezialgebiet</span>
                                    <select name="category_specialty" value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm" disabled={!selectedArea}>
                                        <option value="">Bitte wählen...</option>
                                        {getSpecialties(selectedType, selectedArea).map(spec => (
                                            <option key={spec} value={spec}>{spec}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-orange-200/50 my-2"></div>

                        {/* 2. Metadata: Level & Age */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Level */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_skill_level}</label>
                                <select name="level" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm outline-none">
                                    {Object.keys(COURSE_LEVELS).map(key => (
                                        <option key={key} value={key}>{COURSE_LEVELS[key].de}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Age Groups (Multi-Select) */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Altersgruppe(n)</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-white">
                                    {Object.keys(AGE_GROUPS).map(key => (
                                        <label key={key} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 rounded p-1">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedAgeGroups.includes(key)} 
                                                onChange={() => toggleAgeGroup(key)}
                                                className="rounded text-primary focus:ring-primary"
                                            />
                                            <span className="text-gray-700 text-xs">{AGE_GROUPS[key].de}</span>
                                        </label>
                                    ))}
                                </div>
                                <input type="hidden" name="target_age_groups_json" value={JSON.stringify(selectedAgeGroups)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- DATES & LOCATIONS (UPDATED WITH SCHEDULE INFO) --- */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-blue-900 flex items-center"><Calendar className="w-5 h-5 mr-2" /> Dates & Locations</h3>
                        <button type="button" onClick={addEvent} className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold hover:bg-blue-700 flex items-center"><Plus className="w-4 h-4 mr-1"/> Add Date</button>
                    </div>
                    <div className="space-y-4">
                        {events.map((ev, i) => (
                            <div key={i} className="bg-white p-4 rounded-lg shadow-sm flex flex-col gap-4 border border-gray-200">
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                                        <input type="date" required value={ev.start_date} onChange={e => updateEvent(i, 'start_date', e.target.value)} className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Schedule / Duration (Optional)</label>
                                        <input type="text" value={ev.schedule_description} onChange={e => updateEvent(i, 'schedule_description', e.target.value)} placeholder="e.g. Sat & Sun, 09:00 - 17:00" className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Canton</label>
                                        <select required value={ev.canton} onChange={e => updateEvent(i, 'canton', e.target.value)} className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white">
                                            <option value="">Select Canton</option>
                                            {SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Specific Address</label>
                                        <input type="text" required value={ev.location} onChange={e => updateEvent(i, 'location', e.target.value)} placeholder="Strasse 1, 8000 Zürich" className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Capacity</label>
                                        <div className="relative">
                                            <input type="number" min="0" max="99" value={ev.max_participants} onChange={e => updateEvent(i, 'max_participants', e.target.value)} className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" title="0 = Unlimited" />
                                            <span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none">Pers.</span>
                                        </div>
                                    </div>
                                </div>
                                {events.length > 1 && (
                                    <button type="button" onClick={() => removeEvent(i)} className="text-red-500 text-xs hover:underline flex items-center justify-end"><Trash2 className="w-3 h-3 mr-1" /> Remove this date</button>
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
                
                {/* NEW KEYWORD FIELD */}
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Keywords / Suchbegriffe (Optional)</label>
                    <input type="text" name="keywords" defaultValue={initialData?.keywords} placeholder="z.B. Stressabbau, Rücken, Abendkurs, Anfänger (Kommagetrennt)" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                    <p className="text-xs text-gray-500 mt-1">Diese Begriffe helfen der Suche, Ihren Kurs zu finden, auch wenn die Wörter nicht im Titel stehen.</p>
                </div>

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

export default TeacherForm;