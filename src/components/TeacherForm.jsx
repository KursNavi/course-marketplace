import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowLeft, Loader, Calendar, Plus, Trash2, ExternalLink, Globe, Bold, Italic, Underline, Heading2, Heading3, List, Mail, MapPin, Lightbulb, X, Send, ChevronDown, Images, Check } from 'lucide-react';
import { KursNaviLogo } from './Layout';
import { SWISS_CANTONS, NEW_TAXONOMY, CATEGORY_TYPES, COURSE_LEVELS, DELIVERY_TYPES } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { computeImageHash, getExistingImageByHash, uploadImageWithHash, getUserCourseImages, deleteImageFromLibrary } from '../lib/imageUtils';
import imageCompression from 'browser-image-compression';

// --- Image Compression Helper ---
const compressImage = async (file) => {
    // Nur Bilder komprimieren, die grösser als 500KB sind
    if (file.size <= 500 * 1024) {
        return file;
    }

    const options = {
        maxSizeMB: 0.5,           // Max 500KB
        maxWidthOrHeight: 1200,   // Max 1200px Breite/Höhe
        useWebWorker: true,
        fileType: 'image/jpeg'    // Konvertiert zu JPEG für bessere Komprimierung
    };

    try {
        return await imageCompression(file, options);
    } catch (error) {
        console.warn('Bildkomprimierung fehlgeschlagen, Original wird verwendet:', error);
        return file;
    }
};

// --- Category Suggestion Modal Component ---
const CategorySuggestionModal = ({ isOpen, onClose, taxonomy, types, showNotification, userEmail }) => {
    const [suggestionType, setSuggestionType] = useState('single'); // 'single' = neues Level unter bestehender Kategorie, 'path' = kompletter Pfad
    const [selectedType, setSelectedType] = useState('');
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState('');

    // Neue Kategorie-Eingaben
    const [newArea, setNewArea] = useState('');
    const [newSpecialty, setNewSpecialty] = useState('');
    const [newFocus, setNewFocus] = useState('');
    const [additionalNotes, setAdditionalNotes] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const getAreas = (type) => {
        if (taxonomy && type && taxonomy[type]) {
            return Object.keys(taxonomy[type]);
        }
        return type && NEW_TAXONOMY[type] ? Object.keys(NEW_TAXONOMY[type]) : [];
    };

    const getSpecialties = (type, area) => {
        if (taxonomy && type && area && taxonomy[type]?.[area]) {
            return taxonomy[type][area].specialties || [];
        }
        return type && area && NEW_TAXONOMY[type]?.[area] ? NEW_TAXONOMY[type][area].specialties : [];
    };

    const resetForm = () => {
        setSuggestionType('single');
        setSelectedType('');
        setSelectedArea('');
        setSelectedSpecialty('');
        setNewArea('');
        setNewSpecialty('');
        setNewFocus('');
        setAdditionalNotes('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validierung
        if (!selectedType) {
            alert('Bitte wähle einen Kategorietyp aus.');
            return;
        }

        if (suggestionType === 'single') {
            // Mindestens ein neues Feld muss ausgefüllt sein
            if (!newArea && !newSpecialty && !newFocus) {
                alert('Bitte fülle mindestens ein neues Kategorie-Feld aus.');
                return;
            }
            // Wenn newFocus, dann muss specialty existieren
            if (newFocus && !selectedSpecialty && !newSpecialty) {
                alert('Für einen neuen Fokus (Level 4) benötigst du ein Spezialgebiet (Level 3).');
                return;
            }
            // Wenn newSpecialty, dann muss area existieren
            if (newSpecialty && !selectedArea && !newArea) {
                alert('Für ein neues Spezialgebiet (Level 3) benötigst du einen Bereich (Level 2).');
                return;
            }
        } else {
            // Kompletter Pfad: mindestens Level 2 muss ausgefüllt sein
            if (!newArea) {
                alert('Bitte gib mindestens einen neuen Bereich (Level 2) an.');
                return;
            }
        }

        setIsSubmitting(true);

        // Build message
        const typeLabel = (types.find(t => t.id === selectedType)?.label_de) || selectedType;

        let messageLines = [
            '=== Neuer Kategorie-Vorschlag ===',
            '',
            `Vorschlagstyp: ${suggestionType === 'path' ? 'Kompletter neuer Pfad' : 'Neue Unterkategorie'}`,
            '',
            `Kategorietyp (Level 1): ${typeLabel}`,
            ''
        ];

        if (suggestionType === 'single') {
            if (selectedArea) messageLines.push(`Bestehender Bereich (Level 2): ${selectedArea}`);
            if (newArea) messageLines.push(`NEUER Bereich (Level 2): ${newArea}`);
            if (selectedSpecialty) messageLines.push(`Bestehendes Spezialgebiet (Level 3): ${selectedSpecialty}`);
            if (newSpecialty) messageLines.push(`NEUES Spezialgebiet (Level 3): ${newSpecialty}`);
            if (newFocus) messageLines.push(`NEUER Fokus (Level 4): ${newFocus}`);
        } else {
            messageLines.push(`NEUER Bereich (Level 2): ${newArea}`);
            if (newSpecialty) messageLines.push(`NEUES Spezialgebiet (Level 3): ${newSpecialty}`);
            if (newFocus) messageLines.push(`NEUER Fokus (Level 4): ${newFocus}`);
        }

        if (additionalNotes) {
            messageLines.push('');
            messageLines.push(`Zusätzliche Anmerkungen: ${additionalNotes}`);
        }

        messageLines.push('');
        messageLines.push(`Eingesendet von: ${userEmail || 'Unbekannt'}`);

        const message = messageLines.join('\n');

        try {
            const response = await fetch("https://formsubmit.co/ajax/info@kursnavi.ch", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    _subject: `Kategorie-Vorschlag: ${newArea || newSpecialty || newFocus}`,
                    message: message,
                    email: userEmail || ''
                })
            });

            if (response.ok) {
                showNotification('Vielen Dank! Dein Kategorie-Vorschlag wurde gesendet.');
                resetForm();
                onClose();
            } else {
                throw new Error('Senden fehlgeschlagen');
            }
        } catch (err) {
            console.error('Category suggestion error:', err);
            showNotification('Fehler beim Senden. Bitte versuche es später erneut.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-100 to-indigo-50 p-6 border-b sticky top-0">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-full shadow-sm">
                                <Lightbulb className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-dark font-heading">Kategorie vorschlagen</h2>
                                <p className="text-gray-600 text-sm mt-1">Fehlt eine passende Kategorie? Schlage sie uns vor!</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Suggestion Type */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Was möchtest du vorschlagen?</label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={`cursor-pointer border-2 p-4 rounded-xl transition ${suggestionType === 'single' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <div className="flex items-center mb-1">
                                    <input type="radio" name="suggestionType" value="single" checked={suggestionType === 'single'} onChange={() => setSuggestionType('single')} className="mr-2 accent-purple-600"/>
                                    <span className="font-bold text-sm">Neue Unterkategorie</span>
                                </div>
                                <p className="text-xs text-gray-500">z.B. neuer Fokus unter bestehendem Spezialgebiet</p>
                            </label>
                            <label className={`cursor-pointer border-2 p-4 rounded-xl transition ${suggestionType === 'path' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <div className="flex items-center mb-1">
                                    <input type="radio" name="suggestionType" value="path" checked={suggestionType === 'path'} onChange={() => setSuggestionType('path')} className="mr-2 accent-purple-600"/>
                                    <span className="font-bold text-sm">Kompletter Pfad</span>
                                </div>
                                <p className="text-xs text-gray-500">Neuer Bereich mit Spezialgebiet und Fokus</p>
                            </label>
                        </div>
                    </div>

                    {/* Level 1: Category Type (always required) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Kategorietyp (Level 1) *</label>
                        <div className="relative">
                            <select
                                value={selectedType}
                                onChange={(e) => { setSelectedType(e.target.value); setSelectedArea(''); setSelectedSpecialty(''); }}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none appearance-none bg-white"
                                required
                            >
                                <option value="">Bitte wählen...</option>
                                {(types.length > 0 ? types : Object.keys(CATEGORY_TYPES).map(id => ({ id, label_de: CATEGORY_TYPES[id].de }))).map(type => (
                                    <option key={type.id} value={type.id}>{type.label_de}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 text-gray-400 w-5 h-5 pointer-events-none" />
                        </div>
                    </div>

                    {suggestionType === 'single' && selectedType && (
                        <>
                            {/* Level 2: Existing Area Selection */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Bestehender Bereich (Level 2)</label>
                                <p className="text-xs text-gray-500 mb-2">Optional - wähle einen bestehenden Bereich, wenn du darunter etwas hinzufügen möchtest.</p>
                                <div className="relative">
                                    <select
                                        value={selectedArea}
                                        onChange={(e) => { setSelectedArea(e.target.value); setSelectedSpecialty(''); }}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none appearance-none bg-white"
                                    >
                                        <option value="">-- Keinen auswählen (neuen Bereich vorschlagen) --</option>
                                        {getAreas(selectedType).map(key => {
                                            const label = taxonomy?.[selectedType]?.[key]?.label?.de || NEW_TAXONOMY[selectedType]?.[key]?.label?.de || key;
                                            return <option key={key} value={key}>{label}</option>;
                                        })}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-2.5 text-gray-400 w-5 h-5 pointer-events-none" />
                                </div>
                            </div>

                            {/* Level 3: Existing Specialty Selection (only if area selected) */}
                            {selectedArea && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Bestehendes Spezialgebiet (Level 3)</label>
                                    <p className="text-xs text-gray-500 mb-2">Optional - wähle ein bestehendes Spezialgebiet, wenn du einen Fokus hinzufügen möchtest.</p>
                                    <div className="relative">
                                        <select
                                            value={selectedSpecialty}
                                            onChange={(e) => setSelectedSpecialty(e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none appearance-none bg-white"
                                        >
                                            <option value="">-- Keines auswählen (neues Spezialgebiet vorschlagen) --</option>
                                            {getSpecialties(selectedType, selectedArea).map(spec => (
                                                <option key={spec} value={spec}>{spec}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-2.5 text-gray-400 w-5 h-5 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* New Category Inputs */}
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-4">
                        <h4 className="font-bold text-purple-900 text-sm">Dein Vorschlag</h4>

                        {/* New Area (Level 2) - show if no existing area selected OR if path mode */}
                        {(suggestionType === 'path' || !selectedArea) && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    Neuer Bereich (Level 2) {suggestionType === 'path' && '*'}
                                </label>
                                <input
                                    type="text"
                                    value={newArea}
                                    onChange={(e) => setNewArea(e.target.value)}
                                    placeholder="z.B. Digitale Kunst"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    required={suggestionType === 'path'}
                                />
                            </div>
                        )}

                        {/* New Specialty (Level 3) - show if area exists (selected or new) and no specialty selected */}
                        {(selectedArea || newArea || suggestionType === 'path') && !selectedSpecialty && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Neues Spezialgebiet (Level 3)</label>
                                <input
                                    type="text"
                                    value={newSpecialty}
                                    onChange={(e) => setNewSpecialty(e.target.value)}
                                    placeholder="z.B. 3D-Modellierung"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        )}

                        {/* New Focus (Level 4) - show if specialty exists (selected or new) */}
                        {(selectedSpecialty || newSpecialty) && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Neuer Fokus (Level 4)</label>
                                <input
                                    type="text"
                                    value={newFocus}
                                    onChange={(e) => setNewFocus(e.target.value)}
                                    placeholder="z.B. Blender, ZBrush"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* Additional Notes */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Zusätzliche Anmerkungen (optional)</label>
                        <textarea
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                            rows={3}
                            placeholder="z.B. Warum diese Kategorie gebraucht wird, ähnliche Kategorien..."
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => { resetForm(); onClose(); }}
                            className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition flex items-center justify-center disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Vorschlag senden
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TeacherForm = ({ t, setView, user, initialData, fetchCourses, showNotification, setEditingCourse }) => {
    // --- LIMITS REMOVED: Unbegrenzte Kurse fuer alle ---

    // Load taxonomy from DB (with fallback to constants.js)
    const { taxonomy, types, getFocuses } = useTaxonomy();

    // Draft persistence key - unique per course and user
    // Include user.id to prevent drafts from being shared between different providers
    const draftKey = `teacherForm_draft_${user?.id || 'unknown'}_${initialData?.id || 'new'}`;

    // Helper to load draft from sessionStorage
    const loadDraft = () => {
        try {
            const saved = sessionStorage.getItem(draftKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only use draft if it's for the same course
                if (parsed.courseId === (initialData?.id || 'new')) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to load draft:', e);
        }
        return null;
    };

    // Load draft on initial render
    const draft = loadDraft();

    // Track unsaved changes
    const [isDirty, setIsDirty] = useState(!!draft);

    // Booking & Link State
    const [bookingType, setBookingType] = useState(draft?.bookingType || 'platform'); // 'platform' or 'lead'
    const [contactEmail, setContactEmail] = useState(draft?.contactEmail || '');

    // Form Field State (controlled inputs to preserve data on validation errors / tab switches)
    const [title, setTitle] = useState(draft?.title || '');
    const [description, setDescription] = useState(draft?.description || '');
    const [objectives, setObjectives] = useState(draft?.objectives || '');
    const [keywords, setKeywords] = useState(draft?.keywords || '');
    const [prerequisites, setPrerequisites] = useState(draft?.prerequisites || '');
    const [price, setPrice] = useState(draft?.price || '');
    const [sessionCount, setSessionCount] = useState(draft?.sessionCount || '');
    const [sessionLength, setSessionLength] = useState(draft?.sessionLength || '');
    const [providerUrl, setProviderUrl] = useState(draft?.providerUrl || '');

    // Taxonomy State (Mehrfach-Kategorien)
    const CATEGORY_ROW_LIMITS = { basic: 1, pro: 3, premium: 3, enterprise: 5, free: 1 };

    const [categories, setCategories] = useState(draft?.categories || [{ type: 'privat_hobby', area: '', specialty: '', focus: '' }]);
    const [maxCategories, setMaxCategories] = useState(1);


    // Metadata State
    const [selectedLevel, setSelectedLevel] = useState(draft?.selectedLevel || 'all_levels');
    const [courseLanguage, setCourseLanguage] = useState(draft?.courseLanguage || 'Deutsch');
    const [deliveryType, setDeliveryType] = useState(draft?.deliveryType || 'presence');

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Course Status (draft/published/paused)
    const [courseStatus, setCourseStatus] = useState(draft?.courseStatus || 'draft'); // Default: new courses start as draft

    // Image Preview State (for showing newly selected image before save)
    const [imagePreview, setImagePreview] = useState(null);

    // Cleanup image preview URL on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    // Schedule State
    const [events, setEvents] = useState(draft?.events || [{ start_date: '', street: '', city: '', max_participants: 0, canton: '', schedule_description: '' }]);

    // Fallback Regions
    const [fallbackCantons, setFallbackCantons] = useState(draft?.fallbackCantons || []);

    // Category Suggestion Modal State
    const [showCategorySuggestionModal, setShowCategorySuggestionModal] = useState(false);

    // Image Library State (for reusing existing images)
    const [showImageLibrary, setShowImageLibrary] = useState(false);
    const [existingImages, setExistingImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [selectedExistingImage, setSelectedExistingImage] = useState(null);
    const [imageToDelete, setImageToDelete] = useState(null);
    const [isDeletingImage, setIsDeletingImage] = useState(false);

    // Flag to track if form has been initialized (to prevent initialData from overwriting user changes)
    // Using useRef so the flag persists across re-renders without triggering updates
    // This is set to true after draft is loaded OR after initialData is loaded
    const hasInitializedRef = useRef(!!draft);

    // Scroll to top when editing a different course
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [initialData?.id]);

    // Ref to hold current form data for cleanup
    const formDataRef = useRef(null);

    // Track if initial data loading is complete (to avoid saving draft during initialization)
    const initCompleteRef = useRef(false);

    // Use useLayoutEffect to update ref SYNCHRONOUSLY after render (before unmount cleanup runs)
    // This ensures formDataRef always has the latest values when the component unmounts
    useLayoutEffect(() => {
        const draftData = {
            courseId: initialData?.id || 'new',
            bookingType,
            contactEmail,
            title,
            description,
            objectives,
            keywords,
            prerequisites,
            price,
            sessionCount,
            sessionLength,
            providerUrl,
            categories,
            selectedLevel,
            courseLanguage,
            deliveryType,
            courseStatus,
            events,
            fallbackCantons
        };

        // Always update the ref synchronously so cleanup can use it
        formDataRef.current = { draftKey, draftData, isDirty };

        // Save draft immediately when dirty AND initialization is complete
        // This prevents saving during the initial data loading phase
        if (isDirty && initCompleteRef.current) {
            try {
                sessionStorage.setItem(draftKey, JSON.stringify(draftData));
            } catch (e) {
                console.warn('Failed to save draft:', e);
            }
        }
    }, [isDirty, draftKey, bookingType, contactEmail, title, description, objectives, keywords, prerequisites, price, sessionCount, sessionLength, providerUrl, categories, selectedLevel, courseLanguage, deliveryType, courseStatus, events, fallbackCantons, initialData?.id]);

    // Save draft on unmount (safety net for fast tab switches)
    useEffect(() => {
        return () => {
            if (formDataRef.current?.isDirty) {
                try {
                    sessionStorage.setItem(formDataRef.current.draftKey, JSON.stringify(formDataRef.current.draftData));
                } catch (e) {
                    console.warn('Failed to save draft on unmount:', e);
                }
            }
        };
    }, []);

    useEffect(() => {
        let isMounted = true; // Prevent state updates on unmounted component

        // Limits entfernt: kein Gatekeeping mehr noetig

        // Skip loading initialData if form has already been initialized
        // (either from draft or from previous initialData load)
        // The ref persists across re-renders, so this prevents initialData from
        // overwriting user changes when dependencies change
        if (hasInitializedRef.current) {
            // Already initialized, skip loading
            initCompleteRef.current = true;
            return;
        }

        // 1. Load Initial Data if editing
        if (initialData) {
            if (initialData.booking_type) setBookingType(initialData.booking_type);

            // Initialize controlled form fields from existing course data
            if (initialData.title) setTitle(initialData.title);
            if (initialData.description) setDescription(initialData.description);
            if (initialData.objectives) setObjectives(initialData.objectives.join('\n'));
            if (initialData.keywords) setKeywords(initialData.keywords);
            if (initialData.prerequisites) setPrerequisites(initialData.prerequisites);
            if (initialData.price !== undefined && initialData.price !== null) setPrice(String(initialData.price));
            if (initialData.session_count) setSessionCount(String(initialData.session_count));
            if (initialData.session_length) setSessionLength(initialData.session_length);
            if (initialData.provider_url) setProviderUrl(initialData.provider_url);

            // Kategorie(n) wiederherstellen (primary + optional)
            if (Array.isArray(initialData.category_paths) && initialData.category_paths.length > 0) {
                setCategories(initialData.category_paths.map(c => ({
                    type: c?.type || 'privat_hobby',
                    area: c?.area || '',
                    specialty: c?.specialty || '',
                    focus: c?.focus || ''
                })));
            } else {
                setCategories([{
                    type: initialData.category_type || 'privat_hobby',
                    area: initialData.category_area || '',
                    specialty: initialData.category_specialty || '',
                    focus: initialData.category_focus || ''
                }]);
            }

            if (initialData.level) setSelectedLevel(initialData.level);
            if (initialData.language) setCourseLanguage(initialData.language);
            if (initialData.delivery_type) setDeliveryType(initialData.delivery_type);
            // Load course status (default to 'published' for existing courses without status)
            setCourseStatus(initialData.status || 'published');

            
            // Restore Contact Email (now stored in course_private)
            // IMPORTANT: Check isMounted AND that user hasn't made changes before any state updates
            (async () => {
                try {
                    const { data: priv, error: privErr } = await supabase
                        .from('course_private')
                        .select('contact_email, address')
                        .eq('course_id', initialData.id)
                        .maybeSingle();

                    // Check if component is still mounted AND user hasn't made changes yet
                    // If user has edited (isDirty), don't overwrite their changes with async data
                    if (!isMounted || formDataRef.current?.isDirty) return;

                    if (privErr) console.warn("course_private load failed:", privErr.message);

                    if (priv?.contact_email) {
                        setContactEmail(priv.contact_email);
                    } else if (user?.email) {
                        setContactEmail(user.email);
                    }

                    // Re-check isDirty after each async operation in case user edited while we were processing
                    if (formDataRef.current?.isDirty) return;

                    // Legacy fallback (falls es keinen course_events-Block gibt, aber private address existiert)
                    if ((!initialData.course_events || initialData.course_events.length === 0) && initialData.start_date && priv?.address) {
                        const loc = priv.address || '';
                        const lastComma = loc.lastIndexOf(',');
                        let street = '', city = loc;
                        if (lastComma !== -1) {
                            street = loc.substring(0, lastComma).trim();
                            city = loc.substring(lastComma + 1).trim();
                        }
                        if (isMounted && !formDataRef.current?.isDirty) {
                            setEvents([{ start_date: initialData.start_date, street, city, max_participants: 0, canton: initialData.canton || '', schedule_description: '' }]);
                        }
                    }

                    // Fallback Cantons (nur falls kein course_events vorhanden)
                    if (isMounted && !formDataRef.current?.isDirty && (!initialData.course_events || initialData.course_events.length === 0)) {
                        if (priv?.address) {
                            const parts = priv.address.split(',').map(s => s.trim()).filter(Boolean);
                            const allAreCantons = parts.length > 0 && parts.every(p => SWISS_CANTONS.includes(p));
                            if (allAreCantons) setFallbackCantons(parts);
                            else if (initialData.canton) setFallbackCantons([initialData.canton]);
                        } else if (initialData.canton) {
                            // Kein course_private vorhanden, aber canton in courses gesetzt
                            setFallbackCantons([initialData.canton]);
                        }
                    }
                } catch (err) {
                    console.warn("course_private load error:", err);
                    if (isMounted && !formDataRef.current?.isDirty && user?.email) setContactEmail(user.email);
                }
            })();

            
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
            }

        } else if (user && user.id) {
             if (user.email) setContactEmail(user.email);
             supabase.from('profiles').select('preferred_language').eq('id', user.id).single()
             .then(({ data }) => {
                 // Only update if component is mounted AND user hasn't made changes
                 if (data?.preferred_language && isMounted && !formDataRef.current?.isDirty) {
                    const map = { de: 'Deutsch', fr: 'Französisch', it: 'Italienisch', en: 'Englisch' };
                    if (map[data.preferred_language]) setCourseLanguage(map[data.preferred_language]);
                 }
             });
        }

        // Mark form as initialized to prevent re-loading initialData on prop changes
        hasInitializedRef.current = true;

        // Mark initialization as complete after initial data loading
        // This is set synchronously at the end of the effect, after all state updates have been queued
        // The useLayoutEffect that saves drafts runs AFTER the re-render, so this is safe
        initCompleteRef.current = true;

        return () => {
            isMounted = false;
        }; // CLEANUP
    }, [initialData, user]);

    // Paket -> wie viele Kategorien sind erlaubt?
    useEffect(() => {
        let isMounted = true;
        if (!user?.id) return;

        supabase
            .from('profiles')
            .select('package_tier')
            .eq('id', user.id)
            .single()
            .then(({ data, error }) => {
                if (!isMounted) return;

                if (error) {
                    setMaxCategories(1);
                    return;
                }

                const parseTier = (s) => {
                    const v = (s || '').toString().toLowerCase().trim();
                    if (!v) return 'basic';
                    if (v.includes('enterprise')) return 'enterprise';
                    if (v.includes('premium')) return 'premium';
                    if (v === 'pro' || v.startsWith('pro')) return 'pro';
                    return 'basic';
                };

                const resolvedTier = parseTier(data?.package_tier);
                const limit = CATEGORY_ROW_LIMITS[resolvedTier] ?? 1;
                setMaxCategories(limit);

                // Falls jemand downgradet hat: ueberzaehlige Reihen abschneiden
                setCategories(prev => prev.slice(0, limit));
            });

        return () => { isMounted = false; };
    }, [user?.id]);

    // Warn user when leaving with unsaved changes (browser back/close)
    // Also attempt to save draft before unload
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (formDataRef.current?.isDirty) {
                // Attempt to save draft before page unload
                try {
                    sessionStorage.setItem(formDataRef.current.draftKey, JSON.stringify(formDataRef.current.draftData));
                } catch (err) {
                    // Ignore errors during unload
                }
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Handle back navigation with unsaved changes warning
    const handleBack = () => {
        if (isDirty) {
            const confirmed = window.confirm('Du hast ungespeicherte Änderungen. Möchtest du wirklich zurückgehen? Deine Änderungen gehen verloren.');
            if (!confirmed) return;
            // User chose to discard changes - clear draft
            try {
                sessionStorage.removeItem(draftKey);
            } catch (e) {
                console.warn('Failed to clear draft:', e);
            }
        }
        setView('dashboard');
    };

    // Mark form as dirty when any field changes
    const markDirty = () => {
        if (!isDirty) setIsDirty(true);
    };

    // Helpers - use taxonomy from DB (via hook) with fallback to constants
    const getAreas = (type) => {
        if (taxonomy && type && taxonomy[type]) {
            return Object.keys(taxonomy[type]);
        }
        return type && NEW_TAXONOMY[type] ? Object.keys(NEW_TAXONOMY[type]) : [];
    };
    const getSpecialties = (type, area) => {
        if (taxonomy && type && area && taxonomy[type]?.[area]) {
            return taxonomy[type][area].specialties || [];
        }
        return type && area && NEW_TAXONOMY[type]?.[area] ? NEW_TAXONOMY[type][area].specialties : [];
    };
    const getFocusOptions = (type, area, specialty) => {
        return getFocuses(type, area, specialty);
    };

    const addCategoryRow = () => {
        if (categories.length >= maxCategories) return;
        setCategories([...categories, { type: '', area: '', specialty: '', focus: '' }]);
        markDirty();
    };

    const removeCategoryRow = (index) => {
        if (index === 0) return; // erste Kategorie ist Pflicht
        setCategories(categories.filter((_, i) => i !== index));
        markDirty();
    };

    const updateCategoryRow = (index, field, value) => {
        setCategories(prev => {
            const next = [...prev];
            const row = { ...next[index] };

            if (field === 'type') {
                row.type = value;
                row.area = '';
                row.specialty = '';
                row.focus = '';
            } else if (field === 'area') {
                row.area = value;
                row.specialty = '';
                row.focus = '';
            } else if (field === 'specialty') {
                row.specialty = value;
                row.focus = '';
            } else {
                row[field] = value;
            }

            next[index] = row;
            return next;
        });
        markDirty();
    };

    const addEvent = () => { setEvents([...events, { start_date: '', street: '', city: '', max_participants: 0, canton: '', schedule_description: '' }]); markDirty(); };
    const removeEvent = (index) => { setEvents(events.filter((_, i) => i !== index)); markDirty(); };
    const updateEvent = (index, field, value) => {
        const newEvents = [...events];
        newEvents[index][field] = value;
        setEvents(newEvents);
        markDirty();
    };

    const toggleFallbackCanton = (c) => {
        if (fallbackCantons.includes(c)) setFallbackCantons(fallbackCantons.filter(x => x !== c));
        else setFallbackCantons([...fallbackCantons, c]);
        markDirty();
    }

    // Handle image file selection - show preview immediately
    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Revoke previous preview URL to avoid memory leaks
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
            setSelectedExistingImage(null); // Clear any selected existing image
            markDirty();
        }
    };

    // Load existing images from user's courses for reuse
    const loadExistingImages = async () => {
        setLoadingImages(true);
        try {
            const currentUserId = user?.id || initialData?.user_id;

            // Hole alle Bilder die in Kursen des Users verwendet werden
            const userImages = await getUserCourseImages(currentUserId);

            const imagesWithUrls = userImages.map(img => ({
                name: img.url.split('/').pop(), // Extrahiere Dateiname aus URL
                url: img.url,
                usedBy: img.usedBy // Anzahl Kurse die dieses Bild verwenden
            }));

            setExistingImages(imagesWithUrls);
        } catch (err) {
            console.error('Fehler:', err);
            showNotification('Fehler beim Laden der Bilder');
        } finally {
            setLoadingImages(false);
        }
    };

    // Open image library modal
    const openImageLibrary = () => {
        setShowImageLibrary(true);
        loadExistingImages();
    };

    // Select an existing image
    const selectExistingImage = (image) => {
        setSelectedExistingImage(image.url);
        setImagePreview(null); // Clear any new image preview
        setShowImageLibrary(false);
        markDirty();
    };

    // Confirm image deletion
    const confirmDeleteImage = async () => {
        if (!imageToDelete) return;

        setIsDeletingImage(true);
        try {
            const result = await deleteImageFromLibrary(imageToDelete.url, imageToDelete.courseIds || []);

            if (result.success) {
                // Remove from local state
                setExistingImages(prev => prev.filter(img => img.url !== imageToDelete.url));

                // If the deleted image was selected, clear the selection
                if (selectedExistingImage === imageToDelete.url) {
                    setSelectedExistingImage(null);
                }

                if (result.updatedCourses > 0) {
                    showNotification(`Bild gelöscht. ${result.updatedCourses} Kurs${result.updatedCourses > 1 ? 'e verwenden' : ' verwendet'} jetzt das Standardbild.`);
                } else {
                    showNotification('Bild erfolgreich gelöscht.');
                }
            } else {
                showNotification('Fehler beim Löschen: ' + (result.error || 'Unbekannter Fehler'));
            }
        } catch (error) {
            console.error('Error deleting image:', error);
            showNotification('Fehler beim Löschen des Bildes.');
        } finally {
            setIsDeletingImage(false);
            setImageToDelete(null);
        }
    };

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

        // Metadata (use controlled state values)
        const titleVal = title;
        const descriptionVal = description;
        const objectivesList = objectives.split('\n').filter(line => line.trim() !== '');
        const prerequisitesVal = prerequisites;
        const keywordsVal = keywords;
        
        // Taxonomy (Mehrfach-Kategorien)
        const partialExtraCategory = categories.slice(1).some(c =>
            (c.type || c.area || c.specialty) && !(c.type && c.area && c.specialty)
        );
        if (partialExtraCategory) {
            window.alert("Bitte fuelle Zusatz-Kategorien vollständig aus oder entferne die Zeile.");
            return;
        }

        const cleanedCategories = categories
            .map(c => ({
                type: (c.type || '').toString(),
                area: (c.area || '').toString(),
                specialty: (c.specialty || '').toString(),
                focus: (c.focus || '').toString()
            }))
            // erste Kategorie ist Pflicht; weitere nur, wenn komplett
            .filter((c, idx) => idx === 0 || (c.type && c.area && c.specialty));

        const primaryCategory = cleanedCategories[0] || { type: '', area: '', specialty: '', focus: '' };
        const catType = primaryCategory.type;
        const catArea = primaryCategory.area;
        const catSpec = primaryCategory.specialty;
        const catFocus = primaryCategory.focus;

        const level = formData.get('level');

        if (isSubmitting) return;

        // 1. Core Validation
        if (!titleVal || !descriptionVal) { window.alert("Titel und Beschreibung sind erforderlich."); return; }
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
        
        if (bookingType === 'lead') {
            const hasRegions = fallbackCantons.length > 0;
            if (validEvents.length === 0 && !hasRegions) {
                window.alert("Bitte geben Sie entweder einen konkreten Termin (mit Datum) ODER mindestens einen Kanton/Region an.");
                return;
            }

            if (!contactEmail) {
                window.alert("Bitte geben Sie eine Kontakt-Email an."); return;
            }
        }

        setIsSubmitting(true);

        // 3. Image Upload (mit automatischer Komprimierung) oder bestehendes Bild verwenden
        let imageUrl = initialData?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600";

        // Priorität: 1. Neues hochgeladenes Bild, 2. Aus Bibliothek gewähltes Bild, 3. Bestehendes Bild
        if (selectedExistingImage) {
            // Bestehendes Bild aus Bibliothek verwenden (spart Speicherplatz!)
            imageUrl = selectedExistingImage;
        } else {
            const imageFile = formData.get('courseImage');
            if (imageFile && imageFile.size > 0) {
                // Neues Bild komprimieren
                const compressedFile = await compressImage(imageFile);

                // Hash berechnen für Deduplizierung
                const imageHash = await computeImageHash(compressedFile);

                // Prüfen ob Bild mit diesem Hash bereits existiert
                const existingUrl = await getExistingImageByHash(imageHash);
                if (existingUrl) {
                    // Bild existiert bereits - wiederverwenden
                    imageUrl = existingUrl;
                } else {
                    // Neues Bild mit Hash als Dateiname hochladen
                    try {
                        imageUrl = await uploadImageWithHash(compressedFile, imageHash);
                    } catch (uploadError) {
                        showNotification("Bild-Upload fehlgeschlagen: " + uploadError.message);
                        setIsSubmitting(false);
                        return;
                    }
                }
            }
        }

        // 4. Determine Main Location/Date (public label) + private address
let publicLocationLabel = "";
let privateAddress = "";
let mainCanton = "";
let mainDate = null;

const sortedEvents = [...validEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
const firstEvent = sortedEvents[0];

if (firstEvent) {
    mainDate = firstEvent.start_date;
    mainCanton = firstEvent.canton || (fallbackCantons.length > 0 ? fallbackCantons[0] : '');

    // privateAddress: full location string (street + city), if available
    privateAddress = firstEvent.location || "";

    // publicLocationLabel: show only city (no street) for platform bookings
    if (bookingType === 'platform') {
        publicLocationLabel = firstEvent.city || mainCanton || "";
    } else {
        publicLocationLabel = mainCanton || "";
    }
}

if (!publicLocationLabel && fallbackCantons.length > 0) {
    mainCanton = mainCanton || fallbackCantons[0];
    publicLocationLabel = fallbackCantons.join(', ');
    if (!privateAddress) privateAddress = fallbackCantons.join(', ');
}


        // 5. Build Object - Safe access guards
        const newCourse = {
            title: titleVal,
            instructor_name: user?.name || initialData?.instructor_name || '',
            price: Number(price) || 0,
            language: formData.get('language'),
            rating: initialData?.rating || 0,
            category: `${catType} | ${catArea}`,
            category_type: catType,
            category_area: catArea,
            category_specialty: catSpec,
            category_focus: catFocus || null,
            category_paths: cleanedCategories,
            booking_type: bookingType,
            external_link: null,
            level: level,
            delivery_type: deliveryType,
            target_age_groups: [],
            canton: mainCanton,
            address: publicLocationLabel, // öffentliche "Label"-Location (ohne Strasse)
            start_date: mainDate,
            image_url: imageUrl,
            description: descriptionVal,
            keywords: keywordsVal,
            objectives: objectivesList,
            prerequisites: prerequisitesVal,
            session_count: sessionCount ? Number(sessionCount) : null,
            session_length: sessionLength || '',
            provider_url: providerUrl,
            user_id: user?.id || initialData?.user_id,
            is_pro: user?.is_professional ?? initialData?.is_pro ?? false,
            status: courseStatus
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

        // 6b. Save private fields to course_private
        if (activeCourseId) {
            const privatePayload = {
                course_id: activeCourseId,
                address: privateAddress || null,
                contact_email: (bookingType === 'lead') ? (contactEmail || null) : null
            };

            const { error: privErr } = await supabase
                .from('course_private')
                .upsert(privatePayload);

            if (privErr) {
                console.error(privErr);
                showNotification("Fehler (private Daten): " + privErr.message);
                setIsSubmitting(false);
                return;
            }
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

        // 8. Update course_categories junction table (for Zweitkategorien support)
        if (activeCourseId && cleanedCategories && cleanedCategories.length > 0) {
            // Delete existing category entries
            await supabase.from('course_categories').delete().eq('course_id', activeCourseId);

            // Insert all categories (primary + secondary)
            const categoriesToInsert = cleanedCategories.map((cat, idx) => ({
                course_id: activeCourseId,
                category_type: cat.type,
                category_area: cat.area,
                category_specialty: cat.specialty,
                category_focus: cat.focus || null,
                is_primary: idx === 0 // First category is primary
            }));

            const { error: catErr } = await supabase
                .from('course_categories')
                .insert(categoriesToInsert);

            if (catErr) {
                console.error('Error saving course categories:', catErr);
                // Don't fail the whole operation, just log the error
            }
        }

        // Clear draft after successful save
        try {
            sessionStorage.removeItem(draftKey);
        } catch (e) {
            console.warn('Failed to clear draft:', e);
        }
        setIsDirty(false);

        fetchCourses();
        setEditingCourse(null);
        setView('dashboard');
        setIsSubmitting(false);
    };

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

    return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
        <button onClick={handleBack} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> {t.btn_back_dash}</button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4"><h1 className="text-3xl font-bold text-dark font-heading">{initialData ? t.edit_course : t.create_course}</h1></div>
            
            <form onSubmit={handlePublishCourse} className="space-y-8">
                {initialData && <input type="hidden" name="course_id" value={initialData.id} />}
                
                {/* --- 1. TITLE & DESCRIPTION --- */}
                <div className="space-y-6">
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_title} *</label>
                        <input required type="text" name="title" value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} className="w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
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
                                            const start = textarea.selectionStart; const end = textarea.selectionEnd; const text = description;
                                            const selected = text.substring(start, end);
                                            let replacement = btn.isPrefix ? `${btn.tag}${selected}` : `${btn.tag}${selected}${btn.tag}`;
                                            const newValue = text.substring(0, start) + replacement + text.substring(end);
                                            setDescription(newValue);
                                            markDirty();
                                            setTimeout(() => textarea.focus(), 0);
                                        }} className="p-1.5 hover:bg-white hover:text-primary rounded text-gray-600">
                                        {btn.icon}
                                    </button>
                                ))}
                            </div>
                            <textarea required name="description" value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} rows="6" placeholder="Beschreibe deinen Kurs..." className="w-full px-4 py-3 outline-none resize-y block"></textarea>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_learn_goals}</label>
                        <textarea required name="objectives" value={objectives} onChange={(e) => { setObjectives(e.target.value); markDirty(); }} rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Ein Ziel pro Zeile..."></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Keywords / Suchbegriffe (Optional)</label>
                        <input type="text" name="keywords" value={keywords} onChange={(e) => { setKeywords(e.target.value); markDirty(); }} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                    </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* --- 2. IMAGES & CATEGORIES & LEVEL --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Kursbild</label>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                            {(imagePreview || selectedExistingImage || initialData?.image_url) && (
                                <div className="relative shrink-0">
                                    <img
                                        src={imagePreview || selectedExistingImage || initialData.image_url}
                                        className="w-20 h-20 rounded-lg object-cover shadow-sm"
                                        alt="Kursbildvorschau"
                                    />
                                    {imagePreview && (
                                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                            Neu
                                        </span>
                                    )}
                                    {selectedExistingImage && !imagePreview && (
                                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                            Bibliothek
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <input type="file" name="courseImage" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-orange-600 cursor-pointer" />
                                <button
                                    type="button"
                                    onClick={openImageLibrary}
                                    className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition"
                                >
                                    <Images className="w-4 h-4" />
                                    Aus Bibliothek
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Lade ein neues Bild hoch oder wähle ein bereits hochgeladenes aus der Bibliothek.</p>
                    </div>

                    {/* Taxonomy Box */}
                    <div className="md:col-span-2 bg-beige p-6 rounded-xl border border-orange-100 space-y-4">
                        <h3 className="font-bold text-orange-900 mb-2">Kategorie & Einordnung</h3>
                        <div className="space-y-4">
                            {categories.map((row, idx) => (
                                <div key={idx} className="bg-white/60 p-4 rounded-lg border border-orange-200/60">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-bold text-orange-900">
                                            Kategorie {idx + 1} {idx === 0 ? '(Pflicht)' : '(Optional)'}
                                        </span>

                                        {idx > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => removeCategoryRow(idx)}
                                                className="text-red-600 text-xs hover:underline flex items-center"
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" /> Entfernen
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <span className="text-xs text-gray-500 block mb-1">Typ {idx === 0 ? '*' : ''}</span>
                                            <select
                                                name={`category_type_${idx}`}
                                                value={row.type}
                                                onChange={(e) => updateCategoryRow(idx, 'type', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm"
                                                required={idx === 0}
                                            >
                                                {idx > 0 && <option value="">Bitte wählen...</option>}
                                                {(types.length > 0 ? types : Object.keys(CATEGORY_TYPES).map(id => ({ id, label_de: CATEGORY_TYPES[id].de }))).map(type => (
                                                    <option key={type.id} value={type.id}>{type.label_de}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <span className="text-xs text-gray-500 block mb-1">Bereich {idx === 0 ? '*' : ''}</span>
                                            <select
                                                name={`category_area_${idx}`}
                                                value={row.area}
                                                onChange={(e) => updateCategoryRow(idx, 'area', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm"
                                                disabled={!row.type}
                                                required={idx === 0}
                                            >
                                                <option value="">Bitte wählen...</option>
                                                {row.type && getAreas(row.type).map(key => {
                                                    const label = taxonomy?.[row.type]?.[key]?.label?.de
                                                        || NEW_TAXONOMY[row.type]?.[key]?.label?.de
                                                        || key;
                                                    return <option key={key} value={key}>{label}</option>;
                                                })}
                                            </select>
                                        </div>

                                        <div>
                                            <span className="text-xs text-gray-500 block mb-1">Spezialgebiet {idx === 0 ? '*' : ''}</span>
                                            <select
                                                name={`category_specialty_${idx}`}
                                                value={row.specialty}
                                                onChange={(e) => updateCategoryRow(idx, 'specialty', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm"
                                                disabled={!row.area}
                                                required={idx === 0}
                                            >
                                                <option value="">Bitte wählen...</option>
                                                {row.type && row.area && getSpecialties(row.type, row.area).map(spec => (
                                                    <option key={spec} value={spec}>{spec}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <span className="text-xs text-gray-500 block mb-1">Fokus</span>
                                            <select
                                                name={`category_focus_${idx}`}
                                                value={row.focus}
                                                onChange={(e) => updateCategoryRow(idx, 'focus', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm"
                                                disabled={!row.specialty || getFocusOptions(row.type, row.area, row.specialty).length === 0}
                                            >
                                                <option value="">Optional...</option>
                                                {row.type && row.area && row.specialty && getFocusOptions(row.type, row.area, row.specialty).map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-gray-500">
                                    Dein Paket erlaubt bis zu <span className="font-bold">{maxCategories}</span> Kategorien.
                                </p>

                                <button
                                    type="button"
                                    onClick={addCategoryRow}
                                    disabled={categories.length >= maxCategories}
                                    className="bg-white text-orange-700 border border-orange-200 px-3 py-1 rounded-full text-sm font-bold hover:bg-orange-50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Kategorie hinzufügen
                                </button>
                            </div>

                            {/* Category Suggestion Button */}
                            <div className="pt-3 border-t border-orange-200/50 mt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCategorySuggestionModal(true)}
                                    className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1.5 hover:underline transition"
                                >
                                    <Lightbulb className="w-4 h-4" />
                                    Kategorie fehlt? Neue vorschlagen
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-orange-200/50">
                             <div>
                                <span className="text-xs text-gray-500 block mb-1">Niveau</span>
                                <select name="level" value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); markDirty(); }} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">
                                    {Object.keys(COURSE_LEVELS).map(key => <option key={key} value={key}>{COURSE_LEVELS[key].de}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block mb-1">Sprache</span>
                                <div className="relative">
                                    <Globe className="absolute left-2.5 top-2 text-gray-400 w-4 h-4" />
                                    <select name="language" value={courseLanguage} onChange={(e) => { setCourseLanguage(e.target.value); markDirty(); }} className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">
                                        <option value="Deutsch">Deutsch</option>
                                        <option value="Französisch">Französisch</option>
                                        <option value="Italienisch">Italienisch</option>
                                        <option value="Englisch">Englisch</option>
                                        <option value="Andere">Andere</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block mb-1">Kursformat</span>
                                <select name="delivery_type" value={deliveryType} onChange={(e) => { setDeliveryType(e.target.value); markDirty(); }} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">
                                    {Object.keys(DELIVERY_TYPES).map(key => <option key={key} value={key}>{DELIVERY_TYPES[key].de}</option>)}
                                </select>
                            </div>
                        </div>

                        {selectedLevel !== 'beginner' && selectedLevel !== 'all_levels' && (
                            <div className="mt-4 pt-4 border-t border-orange-200/50">
                                <span className="text-xs text-gray-500 block mb-1">Voraussetzungen</span>
                                <textarea name="prerequisites" value={prerequisites} onChange={(e) => { setPrerequisites(e.target.value); markDirty(); }} rows="2" className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm" placeholder="z.B. Eigener Laptop, Grundkenntnisse in..." />
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* --- 3. BOOKING OPTIONS --- */}
                <div className="bg-white rounded-xl space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-dark mb-4">Buchungs-Optionen</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className={`cursor-pointer border p-4 rounded-xl transition relative overflow-hidden ${bookingType === 'platform' ? 'border-primary bg-orange-50 ring-1 ring-primary' : 'hover:bg-gray-50'}`}>
                                {bookingType === 'platform' && <div className="absolute top-0 right-0 bg-primary text-white text-[10px] px-2 py-0.5 rounded-bl">Empfohlen</div>}
                                <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="platform" checked={bookingType === 'platform'} onChange={() => { setBookingType('platform'); markDirty(); }} className="mr-2 accent-primary"/> <span className="font-bold">Direktbuchung</span></div>
                                <p className="text-xs text-gray-500">Zahlung via KursNavi.</p>
                            </label>
                            <label className={`cursor-pointer border p-4 rounded-xl transition ${bookingType === 'lead' ? 'border-primary bg-orange-50 ring-1 ring-primary' : 'hover:bg-gray-50'}`}>
                                <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="lead" checked={bookingType === 'lead'} onChange={() => { setBookingType('lead'); markDirty(); }} className="mr-2 accent-primary"/> <span className="font-bold">Anfrage (Lead)</span></div>
                                <p className="text-xs text-gray-500">Kontaktformular.</p>
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
    
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Preis (CHF) {bookingType === 'platform' && '*'}</label>
                                <input required={bookingType === 'platform'} type="number" name="price" value={price} onChange={(e) => { setPrice(e.target.value); markDirty(); }} placeholder={bookingType !== 'platform' ? "Optional" : "0.00"} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Anzahl Lektionen</label>
                                <input type="number" name="sessionCount" value={sessionCount} onChange={(e) => { setSessionCount(e.target.value); markDirty(); }} placeholder="z.B. 5" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Lektionsdauer {bookingType === 'platform' && '*'}</label>
                                <input required={bookingType === 'platform'} type="text" name="sessionLength" value={sessionLength} onChange={(e) => { setSessionLength(e.target.value); markDirty(); }} placeholder="z.B. 2 Stunden" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Webseite (Optional)</label>
                                <input type="url" name="providerUrl" value={providerUrl} onChange={(e) => { setProviderUrl(e.target.value); markDirty(); }} placeholder="https://..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
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

                {/* --- STATUS SECTION --- */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <h3 className="text-lg font-bold text-dark mb-4">Veröffentlichungs-Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className={`cursor-pointer border-2 p-4 rounded-xl transition relative ${courseStatus === 'draft' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center mb-2">
                                <input type="radio" name="courseStatus" value="draft" checked={courseStatus === 'draft'} onChange={() => { setCourseStatus('draft'); setIsDirty(true); }} className="mr-2 accent-yellow-500"/>
                                <span className="font-bold">Entwurf</span>
                            </div>
                            <p className="text-xs text-gray-500">Kurs ist nur für dich sichtbar. Kann jederzeit veröffentlicht werden.</p>
                        </label>
                        <label className={`cursor-pointer border-2 p-4 rounded-xl transition relative ${courseStatus === 'published' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center mb-2">
                                <input type="radio" name="courseStatus" value="published" checked={courseStatus === 'published'} onChange={() => { setCourseStatus('published'); setIsDirty(true); }} className="mr-2 accent-green-500"/>
                                <span className="font-bold">Veröffentlicht</span>
                            </div>
                            <p className="text-xs text-gray-500">Kurs ist öffentlich sichtbar und kann gebucht werden.</p>
                        </label>
                        <label className={`cursor-pointer border-2 p-4 rounded-xl transition relative ${courseStatus === 'paused' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center mb-2">
                                <input type="radio" name="courseStatus" value="paused" checked={courseStatus === 'paused'} onChange={() => { setCourseStatus('paused'); setIsDirty(true); }} className="mr-2 accent-orange-500"/>
                                <span className="font-bold">Pausiert</span>
                            </div>
                            <p className="text-xs text-gray-500">Vorübergehend versteckt. Kann schnell wieder aktiviert werden.</p>
                        </label>
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

        {/* Category Suggestion Modal */}
        <CategorySuggestionModal
            isOpen={showCategorySuggestionModal}
            onClose={() => setShowCategorySuggestionModal(false)}
            taxonomy={taxonomy}
            types={types}
            showNotification={showNotification}
            userEmail={user?.email}
        />

        {/* Image Library Modal */}
        {showImageLibrary && (
            <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] flex flex-col relative shadow-2xl">
                    <button
                        onClick={() => setShowImageLibrary(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-dark transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <h3 className="text-xl font-bold mb-2">Deine Bilder</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Wähle ein Bild aus, das du bereits hochgeladen hast.
                    </p>

                    <div className="flex-1 overflow-y-auto">
                        {loadingImages ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        ) : existingImages.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Images className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Du hast noch keine Bilder hochgeladen.</p>
                                <p className="text-sm mt-1">Lade dein erstes Kursbild hoch!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {existingImages.map((image) => (
                                    <div key={image.name} className="relative group">
                                        <button
                                            type="button"
                                            onClick={() => selectExistingImage(image)}
                                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition hover:opacity-90 w-full ${
                                                selectedExistingImage === image.url
                                                    ? 'border-primary ring-2 ring-primary/30'
                                                    : 'border-transparent hover:border-gray-300'
                                            }`}
                                        >
                                            <img
                                                src={image.url}
                                                alt={image.name}
                                                className="w-full h-full object-cover"
                                            />
                                            {selectedExistingImage === image.url && (
                                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                    <Check className="w-8 h-8 text-primary" />
                                                </div>
                                            )}
                                            {image.usedBy > 0 && (
                                                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {image.usedBy}x
                                                </div>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setImageToDelete(image);
                                            }}
                                            className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                            title="Bild löschen"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => setShowImageLibrary(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        >
                            Abbrechen
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Image Delete Confirmation Dialog */}
        {imageToDelete && (
            <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                    <h3 className="text-lg font-bold mb-3">Bild löschen?</h3>

                    <div className="flex gap-4 mb-4">
                        <img
                            src={imageToDelete.url}
                            alt="Zu löschendes Bild"
                            className="w-20 h-20 rounded-lg object-cover shrink-0"
                        />
                        <div className="text-sm text-gray-600">
                            {imageToDelete.usedBy > 0 ? (
                                <>
                                    <p className="text-amber-600 font-medium mb-2">
                                        ⚠️ Dieses Bild wird von {imageToDelete.usedBy} Kurs{imageToDelete.usedBy > 1 ? 'en' : ''} verwendet.
                                    </p>
                                    <p>
                                        Nach dem Löschen {imageToDelete.usedBy > 1 ? 'werden diese Kurse' : 'wird dieser Kurs'} das Standardbild anzeigen.
                                    </p>
                                </>
                            ) : (
                                <p>Dieses Bild wird von keinem Kurs verwendet und kann sicher gelöscht werden.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setImageToDelete(null)}
                            disabled={isDeletingImage}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="button"
                            onClick={confirmDeleteImage}
                            disabled={isDeletingImage}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {isDeletingImage ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            Löschen
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
};

export default TeacherForm;