import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader, Calendar, Plus, Trash2, ExternalLink, Globe, Bold, Italic, Underline, Heading2, Heading3, List, Lock, Mail, MapPin } from 'lucide-react';
import { KursNaviLogo } from './Layout';
import { SWISS_CANTONS, NEW_TAXONOMY, CATEGORY_TYPES, COURSE_LEVELS } from '../lib/constants';
import { supabase } from '../lib/supabase';

const TeacherForm = ({ t, setView, user, initialData, fetchCourses, showNotification, setEditingCourse }) => {
    // --- GATEKEEPER LOGIC (LIMITS) ---
    const TIER_LIMITS = { basic: 3, pro: 10, premium: 30, enterprise: 9999 };
    const [isCheckingLimit, setIsCheckingLimit] = useState(true);
    const [limitReached, setLimitReached] = useState(false);
    const [currentTier, setCurrentTier] = useState('basic');
    const [currentCount, setCurrentCount] = useState(0);

    // Booking & Link State
    const [bookingType, setBookingType] = useState('platform'); // 'platform', 'external', 'lead'
    const [contactEmail, setContactEmail] = useState(''); 

    // Taxonomy State
    const [selectedType, setSelectedType] = useState('privat_hobby');
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState('');
    
    // Metadata State
    const [selectedLevel, setSelectedLevel] = useState('all_levels');
    const [courseLanguage, setCourseLanguage] = useState('Deutsch');

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Schedule State
    const [events, setEvents] = useState([{ start_date: '', street: '', city: '', max_participants: 0, canton: '', schedule_description: '' }]);
    
    // Fallback Regions
    const [fallbackCantons, setFallbackCantons] = useState([]);

    useEffect(() => {
        let isMounted = true; // Prevent state updates on unmounted component

        const checkLimits = async () => {
            // 1. State Reset (Clean slate)
            if (isMounted) {
                setLimitReached(false);
                setCurrentCount(0);
                // Keep tier basic until fetched
            }

            try {
                // Edit Mode: No limit check needed
                if (initialData) {
                    if (isMounted) setIsCheckingLimit(false);
                    return;
                } 
                
                // No User: Stop check immediately (handled by render guard)
                if (!user?.id) {
                    if (isMounted) setIsCheckingLimit(false);
                    return;
                }

                const tier = user?.plan_tier || 'basic';
                setCurrentTier(tier);


                const { count, error } = await supabase
                    .from('courses')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                if (!isMounted) return; // Stop if unmounted

                if (!error) {
                    setCurrentCount(count);
                    const limit = TIER_LIMITS[tier] || 3;
                    if (count >= limit) setLimitReached(true);
                }
            } catch (err) {
                console.error("Limit check failed:", err);
            } finally {
                if (isMounted) setIsCheckingLimit(false);
            }
        };

        checkLimits();

        // 1. Load Initial Data if editing
        if (initialData) {
            if (initialData.booking_type) setBookingType(initialData.booking_type);
            if (initialData.category_type) setSelectedType(initialData.category_type);
            if (initialData.category_area) setSelectedArea(initialData.category_area);
            if (initialData.category_specialty) setSelectedSpecialty(initialData.category_specialty);
            if (initialData.level) setSelectedLevel(initialData.level);
            if (initialData.language) setCourseLanguage(initialData.language);
            
            // Restore Contact Email
            if (initialData.contact_email) {
                setContactEmail(initialData.contact_email);
            } else if (user && user.email) {
                setContactEmail(user.email);
            }
            
            // Reconstruct Events & Address Split
            if (initialData.course_events && initialData.course_events.length > 0) {
                setEvents(initialData.course_events.map(e => {
                    const loc = e.location || '';
                    const lastComma = loc.lastIndexOf(',');
                    let street = '', city = loc;
                    if (lastComma !== -1) {
                        street = loc.substring(0, lastComma).trim();
                        city = loc.substring(lastComma + 1).trim();
                    }
                    return {
                        start_date: e.start_date ? e.start_date.split('T')[0] : '', 
                        street: street,
                        city: city,
                        max_participants: e.max_participants,
                        canton: e.canton || initialData.canton || '',
                        schedule_description: e.schedule_description || ''
                    };
                }));
            } else if (initialData.start_date) {
                 // Legacy fallback
                 const loc = initialData.address || '';
                 const lastComma = loc.lastIndexOf(',');
                 let street = '', city = loc;
                 if (lastComma !== -1) {
                     street = loc.substring(0, lastComma).trim();
                     city = loc.substring(lastComma + 1).trim();
                 }
                setEvents([{ start_date: initialData.start_date, street, city, max_participants: 0, canton: initialData.canton || '', schedule_description: '' }]);
            }

            // Strict Parsing for Fallback Cantons
             if (!initialData.course_events || initialData.course_events.length === 0) {
                 if (initialData.address) {
                     const parts = initialData.address.split(',').map(s => s.trim()).filter(Boolean);
                     const allAreCantons = parts.length > 0 && parts.every(p => SWISS_CANTONS.includes(p));
                     
                     if (allAreCantons) {
                         setFallbackCantons(parts);
                     } else if (initialData.canton) {
                         setFallbackCantons([initialData.canton]);
                     }
                 } else if (initialData.canton) {
                     setFallbackCantons([initialData.canton]);
                 }
             }

        } else if (user && user.id) {
             if (user.email) setContactEmail(user.email);
             supabase.from('profiles').select('preferred_language').eq('id', user.id).single()
             .then(({ data }) => {
                 if (data?.preferred_language && isMounted) {
                    const map = { de: 'Deutsch', fr: 'Französisch', it: 'Italienisch', en: 'Englisch' };
                    if (map[data.preferred_language]) setCourseLanguage(map[data.preferred_language]);
                 }
             });
        }

        return () => { isMounted = false; }; // CLEANUP
    }, [initialData, user]);

    // Helpers
    const getAreas = (type) => type && NEW_TAXONOMY[type] ? Object.keys(NEW_TAXONOMY[type]) : [];
    const getSpecialties = (type, area) => type && area && NEW_TAXONOMY[type][area] ? NEW_TAXONOMY[type][area].specialties : [];
    
    const handleTypeChange = (e) => {
        setSelectedType(e.target.value);
        setSelectedArea(''); setSelectedSpecialty(''); 
    };

    const addEvent = () => setEvents([...events, { start_date: '', street: '', city: '', max_participants: 0, canton: '', schedule_description: '' }]);
    const removeEvent = (index) => setEvents(events.filter((_, i) => i !== index));
    const updateEvent = (index, field, value) => {
        const newEvents = [...events];
        newEvents[index][field] = value;
        setEvents(newEvents);
    };

    const toggleFallbackCanton = (c) => {
        if (fallbackCantons.includes(c)) setFallbackCantons(fallbackCantons.filter(x => x !== c));
        else setFallbackCantons([...fallbackCantons, c]);
    }

    // UX Logic: Has the user entered a Valid Date?
    const hasDatedEvents = events.some(ev => !!ev.start_date);

    const handlePublishCourse = async (e) => {
        e.preventDefault();

        // 0. Safety Check for Lost Session
        if (!initialData && !user?.id) {
            showNotification("Fehler: Bitte einloggen, um fortzufahren.");
            setIsSubmitting(false);
            return;
        }

        const formData = new FormData(e.target);
        
        // Metadata
        const title = formData.get('title');
        const description = formData.get('description');
        const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');
        const prerequisites = formData.get('prerequisites');
        const keywords = formData.get('keywords');
        
        // Taxonomy
        const catType = formData.get('category_type');
        const catArea = formData.get('category_area');
        const catSpec = formData.get('category_specialty');
        const level = formData.get('level');

        if (isSubmitting) return;

        // 1. Core Validation
        if (!title || !description) { window.alert("Titel und Beschreibung sind erforderlich."); return; }
        if (!catType || !catArea || !catSpec) { window.alert("Bitte wählen Sie eine vollständige Kategorie aus."); return; }

        // 2. Booking Specific Validation
        let potentialEvents = events.map(ev => ({
            ...ev,
            location: (ev.street && ev.city) ? `${ev.street}, ${ev.city}` : (ev.city || ev.street || '') 
        }));

        let validEvents = potentialEvents.filter(ev => {
            if (!ev.start_date) return false; 
            if (bookingType === 'platform') return ev.city && ev.street && ev.canton; 
            return true; 
        });

        if (bookingType === 'platform') {
            if (validEvents.length === 0) { window.alert("Für Direktbuchungen benötigen wir mindestens einen Termin mit Datum, Strasse, Ort und Kanton."); return; }
            if (!formData.get('price')) { window.alert("Ein Preis ist für Direktbuchungen erforderlich."); return; }
        } 
        
        if (bookingType === 'lead' || bookingType === 'external') {
            const hasRegions = fallbackCantons.length > 0;
            if (validEvents.length === 0 && !hasRegions) {
                window.alert("Bitte geben Sie entweder einen konkreten Termin (mit Datum) ODER mindestens einen Kanton/Region an.");
                return;
            }

            if (bookingType === 'external' && !formData.get('external_link')) {
                window.alert("Bitte geben Sie einen externen Link an."); return;
            }
            if (bookingType === 'lead' && !contactEmail) {
                window.alert("Bitte geben Sie eine Kontakt-Email an."); return;
            }
        }

        setIsSubmitting(true);

        // 3. Image Upload
        let imageUrl = initialData?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600";
        const imageFile = formData.get('courseImage');
        if (imageFile && imageFile.size > 0) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('course-images').upload(fileName, imageFile);
            
            if (uploadError) {
                showNotification("Bild-Upload fehlgeschlagen: " + uploadError.message);
                setIsSubmitting(false);
                return;
            }
            
            const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(fileName);
            imageUrl = publicUrl;
        }

        // 4. Determine Main Location/Date for Card View
        let mainLocation = "";
        let mainCanton = "";
        let mainDate = null;
        
        const sortedEvents = [...validEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
        const firstEvent = sortedEvents[0];

        if (firstEvent) {
            mainDate = firstEvent.start_date;
            mainLocation = firstEvent.location || fallbackCantons.join(', ');
            mainCanton = firstEvent.canton || (fallbackCantons.length > 0 ? fallbackCantons[0] : '');
        } else if (fallbackCantons.length > 0) {
            mainCanton = fallbackCantons[0];
            mainLocation = fallbackCantons.join(', ');
        }

        // 5. Build Object - Safe access guards
        const newCourse = {
            title: title, 
            instructor_name: user?.name || initialData?.instructor_name || '', 
            price: Number(formData.get('price')) || 0,
            language: formData.get('language'),
            rating: initialData?.rating || 0, 
            category: `${catType} | ${catArea}`,
            category_type: catType,
            category_area: catArea,
            category_specialty: catSpec,
            booking_type: bookingType,
            external_link: bookingType === 'external' ? formData.get('external_link') : null,
            contact_email: bookingType === 'lead' ? contactEmail : null,
            level: level,
            target_age_groups: [], 
            canton: mainCanton, 
            address: mainLocation, 
            start_date: mainDate,
            image_url: imageUrl, 
            description: description, 
            keywords: keywords,
            objectives: objectivesList, 
            prerequisites: prerequisites,
            session_count: Number(formData.get('sessionCount')) || 1, 
            session_length: formData.get('sessionLength') || '', 
            provider_url: formData.get('providerUrl'), 
            user_id: user?.id || initialData?.user_id,
            is_pro: user?.is_professional ?? initialData?.is_pro ?? false
        };

        // 6. DB Operations
        let activeCourseId = initialData?.id;
        let error;

        if (activeCourseId) {
            const { error: err } = await supabase.from('courses').update(newCourse).eq('id', activeCourseId);
            error = err;
            if (!error) showNotification("Kurs aktualisiert!");
        } else {
            const { data: inserted, error: err } = await supabase.from('courses').insert([newCourse]).select();
            if (inserted && inserted[0]) activeCourseId = inserted[0].id;
            error = err;
            if (!error) showNotification(t.success_msg);
        }

        if (error) { 
            console.error(error); 
            showNotification("Fehler: " + error.message); 
            setIsSubmitting(false);
            return; 
        } 

        // 7. Update Events Table
        if (activeCourseId) {
            await supabase.from('course_events').delete().eq('course_id', activeCourseId);
            
            const eventsToInsert = validEvents.map(ev => ({
                course_id: activeCourseId,
                start_date: ev.start_date,
                location: ev.location,
                canton: ev.canton || (fallbackCantons.length > 0 ? fallbackCantons[0] : null), 
                schedule_description: ev.schedule_description,
                max_participants: parseInt(ev.max_participants) || 0
            }));
            
            if (eventsToInsert.length > 0) {
                await supabase.from('course_events').insert(eventsToInsert);
            }
        }

        fetchCourses(); 
        setEditingCourse(null);
        setView('dashboard'); 
        setIsSubmitting(false);
    };

    if (isCheckingLimit) return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-primary w-8 h-8"/></div>;

    // Safety Render if User Missing
    if (!user?.id && !initialData) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-gray-300">
                    <p className="text-gray-600 text-lg">Bitte einloggen, um einen Kurs zu erstellen.</p>
                </div>
            </div>
        );
    }

    if (limitReached && !initialData) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-orange-500">
                    <Lock className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold mb-4">Paket-Limit erreicht</h1>
                    <p className="mb-6">Du hast dein Limit von {TIER_LIMITS[currentTier]} Kursen erreicht.</p>
                    <button onClick={() => setView('teacher-hub')} className="bg-primary text-white px-6 py-2 rounded-full font-bold">Upgrade</button>
                    <button onClick={() => setView('dashboard')} className="block mt-4 text-gray-500 mx-auto">Zurück</button>
                </div>
            </div>
        );
    }
    
    return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
        <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> {t.btn_back_dash}</button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4"><h1 className="text-3xl font-bold text-dark font-heading">{initialData ? t.edit_course : t.create_course}</h1></div>
            
            <form onSubmit={handlePublishCourse} className="space-y-8">
                {initialData && <input type="hidden" name="course_id" value={initialData.id} />}
                
                {/* --- 1. TITLE & DESCRIPTION --- */}
                <div className="space-y-6">
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_title} *</label>
                        <input required type="text" name="title" defaultValue={initialData?.title} className="w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_description} *</label>
                        <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b select-none">
                                {[
                                    { icon: <Bold className="w-4 h-4" />, tag: '**', label: 'Bold' },
                                    { icon: <Italic className="w-4 h-4" />, tag: '*', label: 'Italic' },
                                    { icon: <Underline className="w-4 h-4" />, tag: '__', label: 'Underline' },
                                    { icon: <Heading2 className="w-4 h-4" />, tag: '## ', label: 'H2', isPrefix: true },
                                    { icon: <Heading3 className="w-4 h-4" />, tag: '### ', label: 'H3', isPrefix: true },
                                    { icon: <List className="w-4 h-4" />, tag: '- ', label: 'List', isPrefix: true }
                                ].map((btn, idx) => (
                                    <button key={idx} type="button" onClick={() => {
                                            const textarea = document.getElementsByName('description')[0];
                                            const start = textarea.selectionStart; const end = textarea.selectionEnd; const text = textarea.value;
                                            const selected = text.substring(start, end);
                                            let replacement = btn.isPrefix ? `${btn.tag}${selected}` : `${btn.tag}${selected}${btn.tag}`;
                                            textarea.value = text.substring(0, start) + replacement + text.substring(end);
                                            textarea.focus();
                                        }} className="p-1.5 hover:bg-white hover:text-primary rounded text-gray-600">
                                        {btn.icon}
                                    </button>
                                ))}
                            </div>
                            <textarea required name="description" defaultValue={initialData?.description} rows="6" placeholder="Beschreibe deinen Kurs..." className="w-full px-4 py-3 outline-none resize-y block"></textarea>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_learn_goals}</label>
                        <textarea required name="objectives" defaultValue={initialData?.objectives?.join('\n')} rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Ein Ziel pro Zeile..."></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_prereq} (Voraussetzungen)</label>
                        <textarea name="prerequisites" defaultValue={initialData?.prerequisites} rows="3" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="z.B. Eigener Laptop, Grundkenntnisse in..." />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Keywords / Suchbegriffe (Optional)</label>
                        <input type="text" name="keywords" defaultValue={initialData?.keywords} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                    </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* --- 2. IMAGES & CATEGORIES & LEVEL --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Kursbild</label>
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                            {initialData?.image_url && <img src={initialData.image_url} className="w-20 h-20 rounded-lg object-cover shadow-sm" alt="Current" />}
                            <input type="file" name="courseImage" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-orange-600 cursor-pointer" />
                        </div>
                    </div>

                    {/* Taxonomy Box */}
                    <div className="md:col-span-2 bg-beige p-6 rounded-xl border border-orange-100 space-y-4">
                        <h3 className="font-bold text-orange-900 mb-2">Kategorie & Einordnung</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 block mb-1">Typ *</span>
                                <select name="category_type" value={selectedType} onChange={handleTypeChange} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">
                                    {Object.keys(CATEGORY_TYPES).map(key => <option key={key} value={key}>{CATEGORY_TYPES[key].de}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block mb-1">Bereich *</span>
                                <select name="category_area" value={selectedArea} onChange={(e) => {setSelectedArea(e.target.value); setSelectedSpecialty('');}} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm" disabled={!selectedType}>
                                    <option value="">Bitte wählen...</option>
                                    {getAreas(selectedType).map(key => <option key={key} value={key}>{NEW_TAXONOMY[selectedType][key].label.de}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block mb-1">Spezialgebiet *</span>
                                <select name="category_specialty" value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm" disabled={!selectedArea}>
                                    <option value="">Bitte wählen...</option>
                                    {getSpecialties(selectedType, selectedArea).map(spec => <option key={spec} value={spec}>{spec}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-orange-200/50">
                             <div>
                                <span className="text-xs text-gray-500 block mb-1">Niveau</span>
                                <select name="level" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">
                                    {Object.keys(COURSE_LEVELS).map(key => <option key={key} value={key}>{COURSE_LEVELS[key].de}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block mb-1">Sprache</span>
                                <div className="relative">
                                    <Globe className="absolute left-2.5 top-2 text-gray-400 w-4 h-4" />
                                    <select name="language" value={courseLanguage} onChange={(e) => setCourseLanguage(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">
                                        <option value="Deutsch">Deutsch</option>
                                        <option value="Französisch">Französisch</option>
                                        <option value="Italienisch">Italienisch</option>
                                        <option value="Englisch">Englisch</option>
                                        <option value="Andere">Andere</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* --- 3. BOOKING OPTIONS --- */}
                <div className="bg-white rounded-xl space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-dark mb-4">Buchungs-Optionen</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className={`cursor-pointer border p-4 rounded-xl transition relative overflow-hidden ${bookingType === 'platform' ? 'border-primary bg-orange-50 ring-1 ring-primary' : 'hover:bg-gray-50'}`}>
                                {bookingType === 'platform' && <div className="absolute top-0 right-0 bg-primary text-white text-[10px] px-2 py-0.5 rounded-bl">Empfohlen</div>}
                                <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="platform" checked={bookingType === 'platform'} onChange={() => setBookingType('platform')} className="mr-2 accent-primary"/> <span className="font-bold">Direktbuchung</span></div>
                                <p className="text-xs text-gray-500">Zahlung via KursNavi.</p>
                            </label>
                            <label className={`cursor-pointer border p-4 rounded-xl transition ${bookingType === 'lead' ? 'border-primary bg-orange-50 ring-1 ring-primary' : 'hover:bg-gray-50'}`}>
                                <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="lead" checked={bookingType === 'lead'} onChange={() => setBookingType('lead')} className="mr-2 accent-primary"/> <span className="font-bold">Anfrage (Lead)</span></div>
                                <p className="text-xs text-gray-500">Kontaktformular.</p>
                            </label>
                            <label className={`cursor-pointer border p-4 rounded-xl transition ${bookingType === 'external' ? 'border-primary bg-orange-50 ring-1 ring-primary' : 'hover:bg-gray-50'}`}>
                                <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="external" checked={bookingType === 'external'} onChange={() => setBookingType('external')} className="mr-2 accent-primary"/> <span className="font-bold">Externer Link</span></div>
                                <p className="text-xs text-gray-500">Eigene Webseite.</p>
                            </label>
                        </div>
                    </div>

                    {/* DYNAMIC FIELDS */}
                    <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                        
                        {/* A: CONTACT / LINK FIELDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {bookingType === 'lead' && (
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Email für Anfragen *</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                        <input required type="email" name="contact_email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ihre@email.ch" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">An diese Adresse werden Kundenanfragen gesendet.</p>
                                </div>
                            )}
                            {bookingType === 'external' && (
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Link zur Buchungsseite *</label>
                                    <div className="relative">
                                        <ExternalLink className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                        <input required type="url" name="external_link" defaultValue={initialData?.external_link} placeholder="https://meine-seite.ch/kurs-buchen" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Preis (CHF) {bookingType === 'platform' && '*'}</label>
                                <input required={bookingType === 'platform'} type="number" name="price" defaultValue={initialData?.price} placeholder={bookingType !== 'platform' ? "Optional" : "0.00"} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Anzahl Lektionen {bookingType === 'platform' && '*'}</label>
                                <input required={bookingType === 'platform'} type="number" name="sessionCount" defaultValue={initialData?.session_count || 1} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Lektionsdauer {bookingType === 'platform' && '*'}</label>
                                <input required={bookingType === 'platform'} type="text" name="sessionLength" defaultValue={initialData?.session_length} placeholder="z.B. 2 Stunden" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Webseite (Optional)</label>
                                <input type="url" name="providerUrl" defaultValue={initialData?.provider_url} placeholder="https://..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                        </div>

                        {/* B: DATES & LOCATIONS */}
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                             <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-blue-900 flex items-center"><Calendar className="w-5 h-5 mr-2" /> Termine & Standorte</h3>
                                    {bookingType !== 'platform' && <p className="text-xs text-blue-700">Datum optional. Wenn keine fixen Termine, bitte Region wählen.</p>}
                                    {bookingType === 'platform' && <p className="text-xs text-blue-700">Datum, Ort und Zeit sind für Direktbuchungen erforderlich.</p>}
                                </div>
                                <button type="button" onClick={addEvent} className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold hover:bg-blue-700 flex items-center"><Plus className="w-4 h-4 mr-1"/> Termin hinzufügen</button>
                            </div>

                            {/* Fallback Region Selector */}
                            {bookingType !== 'platform' && !hasDatedEvents && (
                                <div className="mb-6 bg-white p-5 rounded-lg border-2 border-orange-200 shadow-sm animate-in fade-in">
                                    <h4 className="font-bold text-orange-900 flex items-center gap-2 mb-3">
                                        <MapPin className="w-4 h-4"/> Keine fixen Termine? Wähle deine Region(en):
                                    </h4>
                                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                        {SWISS_CANTONS.map(c => (
                                            <button key={c} type="button" onClick={() => toggleFallbackCanton(c)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${fallbackCantons.includes(c) ? 'bg-orange-500 text-white border-orange-600 shadow-md transform scale-105' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">Diese Regionen werden in der Suche verwendet.</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                {events.map((ev, i) => (
                                    <div key={i} className="bg-white p-4 rounded-lg shadow-sm flex flex-col gap-4 border border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Datum {bookingType === 'platform' && '*'}</label>
                                                <input type="date" required={bookingType === 'platform'} value={ev.start_date} onChange={e => updateEvent(i, 'start_date', e.target.value)} className={`w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white ${bookingType !== 'platform' && !ev.start_date ? 'border-orange-300' : ''}`} />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Zeit / Details (Optional)</label>
                                                <input type="text" value={ev.schedule_description} onChange={e => updateEvent(i, 'schedule_description', e.target.value)} placeholder="z.B. Sa & So, 09:00 - 17:00" className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            <div className="md:col-span-5">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Strasse / Nr. {bookingType === 'platform' && '*'}</label>
                                                <input type="text" required={bookingType === 'platform'} value={ev.street} onChange={e => updateEvent(i, 'street', e.target.value)} placeholder="Musterstrasse 12" className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase">PLZ / Ort {bookingType === 'platform' && '*'}</label>
                                                <input type="text" required={bookingType === 'platform'} value={ev.city} onChange={e => updateEvent(i, 'city', e.target.value)} placeholder="8000 Zürich" className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" />
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Kanton {bookingType === 'platform' && '*'}</label>
                                                <select required={bookingType === 'platform'} value={ev.canton} onChange={e => updateEvent(i, 'canton', e.target.value)} className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white">
                                                    <option value="">Wählen...</option>
                                                    {SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Plätze</label>
                                                <input type="number" min="0" value={ev.max_participants} onChange={e => updateEvent(i, 'max_participants', e.target.value)} className="w-full px-3 py-2 border rounded bg-gray-50 focus:bg-white" title="0 = Unbegrenzt" />
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeEvent(i)} className="text-red-500 text-xs hover:underline flex items-center self-end"><Trash2 className="w-3 h-3 mr-1" /> Entfernen</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                <div className="pt-6 flex justify-end">
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