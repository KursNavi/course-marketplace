import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowLeft, Loader, Calendar, Plus, Trash2, Globe, MapPin, Lightbulb, X, Send, ChevronDown, ChevronUp, Images, Check, Clock, BookOpen, Award, GraduationCap, Upload } from 'lucide-react';
import { KursNaviLogo } from './Layout';
import { SWISS_CANTONS, NEW_TAXONOMY, CATEGORY_TYPES, COURSE_LEVELS, DELIVERY_TYPES, COURSE_LANGUAGES, TYPE_DISPLAY_LABELS, BERUF_SAEULEN, PRIVAT_KURSARTEN, KINDER_KURSARTEN } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useTaxonomy } from '../hooks/useTaxonomy';
import { computeImageHash, getExistingImageByHash, uploadImageWithHash, getUserCourseImages, deleteImageFromLibrary, isUnsplashUrl, importUnsplashImage, DEFAULT_COURSE_IMAGE } from '../lib/imageUtils';
import imageCompression from 'browser-image-compression';
import { refreshCoursesAfterMutation } from '../lib/courseRefresh';
import { getNormalizedDeliveryTypes, normalizeCategoryType } from '../lib/courseMetadata';

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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Nicht eingeloggt');
            }

            const response = await fetch("/api/contact", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    type: 'category-suggestion',
                    subject: `Kategorie-Vorschlag: ${newArea || newSpecialty || newFocus}`,
                    message: message,
                    email: userEmail || ''
                })
            });

            if (response.ok) {
                showNotification('Vielen Dank! Dein Kategorie-Vorschlag wurde gesendet.');
                resetForm();
                onClose();
            } else {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Senden fehlgeschlagen');
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
                                {(types.length > 0 ? types : Object.keys(CATEGORY_TYPES).map(id => ({ id, slug: id, label_de: CATEGORY_TYPES[id].de }))).map(type => (
                                    <option key={type.id} value={type.id}>{TYPE_DISPLAY_LABELS[type.slug] || type.label_de}</option>
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

// === Zeichenlimits für die Kurseingabe ===
const COURSE_FIELD_LIMITS = {
    title: 80,
    description: 2000,
    keywords: 200,
    priceInfo: 100,
    freeReason: 300,
    sessionLength: 120,
    objectives: 1500,
    prerequisites: 500,
    scheduleDescription: 100,
};

// Kleiner Zeichenzähler, der unter Felder angezeigt wird
const CharCount = ({ value, max }) => {
    const len = (value || '').length;
    const over = len > max;
    const warn = !over && len > max * 0.85;
    return (
        <span className={`text-xs ${over ? 'text-red-500 font-semibold' : warn ? 'text-amber-500' : 'text-gray-400'}`}>
            {len}/{max}
        </span>
    );
};

const TeacherForm = ({ t, setView, user, initialData, fetchCourses, showNotification, setEditingCourse, isAdminImpersonating = false }) => {
    // Stripe Connect: Auszahlung eingerichtet?
    const payoutReady = user?.stripe_connect_onboarding_complete === true;

    // --- LIMITS REMOVED: Unbegrenzte Kurse für alle ---

    // Load taxonomy from DB (with fallback to constants.js)
    const { taxonomy, types, areas, specialties, focuses, getFocuses, isV2, getSpecialtyObjects } = useTaxonomy();

    // Draft persistence key - unique per course and user
    // Include user.id to prevent drafts from being shared between different providers
    const draftKey = `teacherForm_draft_${user?.id || 'unknown'}_${initialData?.id || 'new'}`;

    // Helper to load draft from sessionStorage
    const loadDraft = () => {
        // Only load drafts for existing courses being edited
        // For new courses (initialData === null), always start with a fresh form
        // This prevents old drafts from interfering when creating new courses
        if (!initialData?.id) {
            // Clear any stale 'new' draft to ensure clean state
            try {
                sessionStorage.removeItem(draftKey);
            } catch (e) {
                console.warn('Failed to clear stale draft:', e);
            }
            return null;
        }

        try {
            const saved = sessionStorage.getItem(draftKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only use draft if it's for the same course
                if (parsed.courseId === initialData.id) {
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

    // Track unsaved changes - start with false, only set true when user actually makes changes
    const [isDirty, setIsDirty] = useState(false);

    // Modal for unsaved changes warning
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);

    // Booking & Link State
    // Neue Kurse starten standardmässig mit "Anfrage" — sicherste Option, kein Stripe nötig.
    // Bestehende Kurse laden ihre bookingType über den initialData-useEffect.
    const [bookingType, setBookingType] = useState(draft?.bookingType || 'lead'); // 'platform', 'platform_flex', or 'lead'
    const [ticketLimit30d, setTicketLimit30d] = useState(draft?.ticketLimit30d || '');

    // Form Field State (controlled inputs to preserve data on validation errors / tab switches)
    const [title, setTitle] = useState(draft?.title || '');
    const [description, setDescription] = useState(draft?.description || '');
    const [objectives, setObjectives] = useState(draft?.objectives || '');
    const [keywords, setKeywords] = useState(draft?.keywords || '');
    const [prerequisites, setPrerequisites] = useState(draft?.prerequisites || '');
    const [price, setPrice] = useState(draft?.price || '');
    const [priceInfo, setPriceInfo] = useState(draft?.priceInfo || '');
    const [freeReason, setFreeReason] = useState(draft?.freeReason || '');
    const [sessionCount, setSessionCount] = useState(draft?.sessionCount || '');
    const [sessionLength, setSessionLength] = useState(draft?.sessionLength || '');
    const [providerUrl, setProviderUrl] = useState(draft?.providerUrl || '');

    // Taxonomy State (Mehrfach-Kategorien)
    const CATEGORY_ROW_LIMITS = { basic: 1, pro: 3, premium: 3, enterprise: 5, free: 1 };

    const [categories, setCategories] = useState(draft?.categories || [{ type: 'privat', area: '', specialty: '', focus: '' }]);
    const [maxCategories, setMaxCategories] = useState(1);


    // Metadata State
    const [selectedLevel, setSelectedLevel] = useState(draft?.selectedLevel || 'all_levels');
    const [courseLanguages, setCourseLanguages] = useState(draft?.courseLanguages || ['Deutsch']);
    const [deliveryTypes, setDeliveryTypes] = useState(draft?.deliveryTypes || ['presence']);
    const [berufSaeulen, setBerufSaeulen] = useState(draft?.berufSaeulen || []);
    const [privatKursart, setPrivatKursart] = useState(draft?.privatKursart || '');
    const [kinderKursart, setKinderKursart] = useState(draft?.kinderKursart || '');
    const [minAge, setMinAge] = useState(draft?.minAge || '');
    const [requiresGuardianBooking, setRequiresGuardianBooking] = useState(draft?.requiresGuardianBooking || false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Course Status (draft/published)
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
    const [events, setEvents] = useState(draft?.events || [{ id: null, bookingCount: 0, type: 'presence', start_date: '', end_date: '', street: '', city: '', max_participants: 0, canton: '', schedule_description: '', location_abroad: '' }]);

    // Fallback Regions
    const [fallbackCantons, setFallbackCantons] = useState(draft?.fallbackCantons || []);

    // Locations for lead/flex courses (array: multiple locations per course)
    const [locations, setLocations] = useState(draft?.locations || [{ type: 'presence', street: '', city: '', canton: '', location_abroad: '' }]);

    // Category Suggestion Modal State
    const [showCategorySuggestionModal, setShowCategorySuggestionModal] = useState(false);

    // UX section states
    // locationMode: 'locations' = Feste Standort(e), 'events' = Konkrete Termine
    const [locationMode, setLocationMode] = useState(draft?.locationMode || 'locations');
    const [showOptionalDetails, setShowOptionalDetails] = useState(false);

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
    const hasInitializedRef = useRef(false);

    // Track which course ID was initialized
    const initializedCourseIdRef = useRef(null);

    // Scroll to top when editing a different course
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [initialData?.id]);

    // Ref to hold current form data for cleanup
    const formDataRef = useRef(null);

    // Track if initial data loading is complete (to avoid saving draft during initialization)
    const initCompleteRef = useRef(false);

    // Store profile Hauptstandort for pre-filling new events
    const profileLocationRef = useRef(null);

    // Refs for two-button submit (draft / publish)
    const pendingStatusRef = useRef(null);
    const formRef = useRef(null);

    // Use useLayoutEffect to update ref SYNCHRONOUSLY after render (before unmount cleanup runs)
    // This ensures formDataRef always has the latest values when the component unmounts
    useLayoutEffect(() => {
        const draftData = {
            courseId: initialData?.id || 'new',
            bookingType,
            ticketLimit30d,
            title,
            description,
            objectives,
            keywords,
            prerequisites,
            price,
            freeReason,
            sessionCount,
            sessionLength,
            providerUrl,
            categories,
            selectedLevel,
            courseLanguages,
            deliveryTypes,
            courseStatus,
            events,
            fallbackCantons,
            locations,
            berufSaeulen,
            privatKursart,
            kinderKursart,
            locationMode
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
    }, [isDirty, draftKey, bookingType, ticketLimit30d, title, description, objectives, keywords, prerequisites, price, freeReason, sessionCount, sessionLength, providerUrl, categories, selectedLevel, courseLanguages, deliveryTypes, courseStatus, events, fallbackCantons, locations, berufSaeulen, privatKursart, kinderKursart, locationMode, initialData?.id]);

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

        const currentCourseId = initialData?.id || 'new';
        console.log('[TeacherForm] useEffect triggered:', {
            hasInitialized: hasInitializedRef.current,
            initializedCourseId: initializedCourseIdRef.current,
            currentCourseId: currentCourseId,
            initialDataId: initialData?.id,
            category_paths: initialData?.category_paths
        });

        // Skip loading initialData if form has already been initialized FOR THIS COURSE
        // Reset if we're editing a different course
        if (hasInitializedRef.current && initializedCourseIdRef.current === currentCourseId) {
            // Already initialized for this course, skip loading
            console.log('[TeacherForm] Skipping - already initialized for course', currentCourseId);
            initCompleteRef.current = true;
            return;
        }

        // Reset for new course
        if (initializedCourseIdRef.current !== currentCourseId) {
            console.log('[TeacherForm] New course detected, resetting initialization');
            hasInitializedRef.current = false;
        }

        // 1. Load Initial Data if editing
        if (initialData) {
            if (initialData.booking_type) setBookingType(initialData.booking_type);
            if (initialData.ticket_limit_30d !== undefined && initialData.ticket_limit_30d !== null) setTicketLimit30d(String(initialData.ticket_limit_30d));

            // Initialize controlled form fields from existing course data
            if (initialData.title) setTitle(initialData.title);
            if (initialData.description) setDescription(initialData.description);
            if (initialData.objectives) setObjectives(initialData.objectives.join('\n'));
            if (initialData.keywords) setKeywords(initialData.keywords);
            if (initialData.prerequisites) setPrerequisites(initialData.prerequisites);
            if (initialData.price !== undefined && initialData.price !== null) setPrice(String(initialData.price));
            if (initialData.free_reason) setFreeReason(initialData.free_reason);
            // Merge session_count + session_length into one display field (sessionLength)
            if (initialData.session_count || initialData.session_length) {
                const parts = [initialData.session_count, initialData.session_length].filter(Boolean);
                setSessionLength(parts.length === 2 ? `${parts[0]} à ${parts[1]}` : parts[0]);
            }
            if (initialData.price_info) setPriceInfo(initialData.price_info);
            if (initialData.provider_url) setProviderUrl(initialData.provider_url);

            // Kategorie(n) wiederherstellen (primary + optional)
            console.log('[TeacherForm] Loading categories from initialData:', {
                category_paths: initialData.category_paths,
                category_type: initialData.category_type,
                category_area: initialData.category_area,
                all_categories: initialData.all_categories
            });
            if (Array.isArray(initialData.category_paths) && initialData.category_paths.length > 0) {
                console.log('[TeacherForm] Using category_paths:', initialData.category_paths);
                setCategories(initialData.category_paths.map(c => ({
                    type: normalizeCategoryType(c?.type) || 'privat',
                    area: c?.area || '',
                    specialty: c?.specialty || '',
                    focus: c?.focus || ''
                })));
            } else {
                setCategories([{
                    type: normalizeCategoryType(initialData.category_type) || 'privat',
                    area: initialData.category_area || '',
                    specialty: initialData.category_specialty || '',
                    focus: initialData.category_focus || ''
                }]);
            }

            if (initialData.level) setSelectedLevel(initialData.level);
            if (Array.isArray(initialData.beruf_saeulen)) setBerufSaeulen(initialData.beruf_saeulen);
            if (initialData.privat_kursart) setPrivatKursart(initialData.privat_kursart);
            if (initialData.kinder_kursart) setKinderKursart(initialData.kinder_kursart);
            if (initialData.min_age != null) setMinAge(String(initialData.min_age));
            if (initialData.requires_guardian_booking) setRequiresGuardianBooking(true);
            // Support both old 'language' (string) and new 'languages' (array) field
            if (initialData.languages && Array.isArray(initialData.languages) && initialData.languages.length > 0) {
                setCourseLanguages(initialData.languages);
            } else if (initialData.language) {
                setCourseLanguages([initialData.language]);
            }
            // Support both old 'delivery_type' (string) and new 'delivery_types' (array) field
            if (initialData.delivery_types && Array.isArray(initialData.delivery_types) && initialData.delivery_types.length > 0) {
                setDeliveryTypes(initialData.delivery_types);
            } else if (initialData.delivery_type) {
                setDeliveryTypes([initialData.delivery_type]);
            }
            // Load course status (default to 'published' for existing courses without status)
            setCourseStatus(initialData.status || 'published');


            // Load course_locations for lead/flex courses
            if (initialData.booking_type !== 'platform') {
                if (initialData.course_locations && initialData.course_locations.length > 0) {
                    const sorted = [...initialData.course_locations].sort((a, b) => a.sort_order - b.sort_order);
                    setLocations(sorted.map(loc => ({
                        id: loc.id,
                        type: loc.location_type || 'presence',
                        street: loc.location_type === 'presence' ? (loc.street || '') : '',
                        city: loc.city || '',
                        canton: loc.location_type === 'presence' ? (loc.canton || '') : '',
                        location_abroad: loc.location_type === 'ausland' ? (loc.street || '') : ''
                    })));
                } else if (initialData.canton) {
                    // Legacy: old course with just a canton field
                    setLocations([{ type: 'presence', street: '', city: '', canton: initialData.canton }]);
                }
            }

            // Legacy fallback: if no course_events but has address, use address for fallback cantons
            if ((!initialData.course_events || initialData.course_events.length === 0)) {
                if (initialData.address) {
                    const parts = initialData.address.split(',').map(s => s.trim()).filter(Boolean);
                    const allAreCantons = parts.length > 0 && parts.every(p => SWISS_CANTONS.includes(p));
                    if (allAreCantons) setFallbackCantons(parts);
                    else if (initialData.canton) setFallbackCantons([initialData.canton]);
                } else if (initialData.canton) {
                    setFallbackCantons([initialData.canton]);
                }
            }

            
            // Reconstruct Events & Address Split
            if (initialData.course_events && initialData.course_events.length > 0) {
                setEvents(initialData.course_events.map(e => {
                    // Detect location type from legacy data
                    let type = 'presence';
                    let location_abroad = '';
                    if (e.canton === 'Online' || e.location === 'Online') {
                        type = 'online';
                    } else if (e.canton === 'Ausland') {
                        type = 'ausland';
                        location_abroad = e.location || '';
                    }

                    const loc = type === 'presence' ? (e.location || '') : '';
                    const lastComma = loc.lastIndexOf(',');
                    let street = '', city = loc;
                    if (lastComma !== -1) {
                        street = loc.substring(0, lastComma).trim();
                        city = loc.substring(lastComma + 1).trim();
                    }
                    const canton = type === 'presence' ? (e.canton || initialData.canton || '') : '';
                    return {
                        id: e.id || null,
                        bookingCount: Array.isArray(e.bookings) ? (e.bookings[0]?.count || 0) : (e.bookings?.count || 0),
                        type,
                        start_date: e.start_date ? e.start_date.split('T')[0] : '',
                        end_date: e.end_date ? e.end_date.split('T')[0] : '',
                        street,
                        city,
                        max_participants: e.max_participants,
                        canton,
                        schedule_description: e.schedule_description || '',
                        location_abroad,
                        showLoc: !!(canton || city)
                    };
                }));
            }

            // Set locationMode based on existing data (backward compat)
            // If course_events exist → events mode; otherwise → locations mode
            const hasEvents = Array.isArray(initialData.course_events) && initialData.course_events.some(ev => ev.start_date);
            if (initialData.booking_type === 'platform') {
                setLocationMode('events'); // platform always uses events
            } else {
                setLocationMode(hasEvents ? 'events' : 'locations');
            }

            // Open optional section automatically if any optional field has a value
            const hasOptionalValues = (
                (Array.isArray(initialData.objectives) && initialData.objectives.length > 0) ||
                !!initialData.prerequisites ||
                !!initialData.provider_url ||
                (initialData.min_age != null) ||
                (initialData.level && initialData.level !== 'all_levels') ||
                (Array.isArray(initialData.languages) && initialData.languages.join(',') !== 'Deutsch') ||
                !!initialData.session_count || !!initialData.session_length
            );
            if (hasOptionalValues) setShowOptionalDetails(true);

        } else if (user && user.id) {
             supabase.from('profiles').select('preferred_language, street, city, canton').eq('id', user.id).single()
             .then(({ data }) => {
                 if (!isMounted || formDataRef.current?.isDirty) return;
                 // Pre-fill course language from profile preference
                 if (data?.preferred_language) {
                    const map = { de: 'Deutsch', fr: 'Französisch', it: 'Italienisch', en: 'Englisch' };
                    if (map[data.preferred_language]) setCourseLanguages([map[data.preferred_language]]);
                 }
                 // Store profile location so addEvent can use it for pre-filling
                 if (data?.canton) {
                    profileLocationRef.current = {
                        street: data.street || '',
                        city: data.city || '',
                        canton: data.canton || ''
                    };
                 }
                 // Pre-fill first location (lead/flex) and first event (platform) from profile Hauptstandort
                 if (!draft && data?.canton) {
                    const profileLoc = { type: 'presence', street: data.street || '', city: data.city || '', canton: data.canton || '', location_abroad: '' };
                    setLocations([profileLoc]);
                    setEvents([{ id: null, bookingCount: 0, ...profileLoc, start_date: '', max_participants: 0, schedule_description: '', showLoc: true }]);
                 }
             });
             // Set default Kursart for new courses based on default segment (privat → Wochenkurs)
             if (!draft) {
                 setPrivatKursart(curr => curr || 'wochenkurs');
             }
        }

        // Mark form as initialized to prevent re-loading initialData on prop changes
        hasInitializedRef.current = true;
        initializedCourseIdRef.current = initialData?.id || 'new';

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

                // Falls jemand downgradet hat: überzählige Reihen abschneiden
                setCategories(prev => prev.slice(0, limit));
            });

        return () => { isMounted = false; };
    }, [user?.id]);

    // Auto-set Kursart defaults when segment type changes (only if kursart not yet set)
    useEffect(() => {
        if (!hasInitializedRef.current) return; // skip during initialization
        const type = categories[0]?.type;
        if (!type) return;
        if ((type === 'kinder' || type === 'kinder_jugend') && !kinderKursart) {
            setKinderKursart('freizeitkurs');
        } else if ((type === 'privat' || type === 'privat_hobby') && !privatKursart) {
            setPrivatKursart('wochenkurs');
        } else if ((type === 'professionell' || type === 'beruflich') && berufSaeulen.length === 0) {
            setBerufSaeulen(['fachkurs']);
        }
    }, [categories[0]?.type]); // eslint-disable-line react-hooks/exhaustive-deps

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
            setShowUnsavedChangesModal(true);
            return;
        }
        setEditingCourse(null);
        sessionStorage.setItem('dashOpenTab', 'kursangebot');
        setView('dashboard');
    };

    // Confirm discard changes and navigate back
    const confirmDiscardChanges = () => {
        try {
            sessionStorage.removeItem(draftKey);
        } catch (e) {
            console.warn('Failed to clear draft:', e);
        }
        setShowUnsavedChangesModal(false);
        setEditingCourse(null);
        sessionStorage.setItem('dashOpenTab', 'kursangebot');
        setView('dashboard');
    };

    // Mark form as dirty when any field changes
    const markDirty = () => {
        if (!isDirty) setIsDirty(true);
    };

    // Helpers - use taxonomy from DB (via hook) with fallback to constants
    const getAreasLocal = (type) => {
        if (!taxonomy || !type || !taxonomy[type]) {
            return type && NEW_TAXONOMY[type] ? Object.keys(NEW_TAXONOMY[type]) : [];
        }

        const typeData = taxonomy[type];

        // Use pre-sorted _areaIds if available (no duplicates, already sorted)
        if (typeData._areaIds) {
            return typeData._areaIds;
        }

        // Fallback: filter out special keys, avoid duplicates, sort alphabetically
        const seen = new Set();
        const areaKeys = Object.keys(typeData).filter(k => {
            if (k === '_meta' || k === 'label' || k === '_areaIds') return false;
            // Get the canonical ID to avoid duplicates (slug vs numeric ID)
            const meta = typeData[k]?._meta;
            const canonicalId = meta?.id ?? k;
            if (seen.has(canonicalId)) return false;
            seen.add(canonicalId);
            return true;
        });

        // Sort by label alphabetically
        return areaKeys.sort((a, b) => {
            const labelA = typeData[a]?.label?.de || '';
            const labelB = typeData[b]?.label?.de || '';
            return labelA.localeCompare(labelB, 'de');
        });
    };
    const getSpecialtiesLocal = (type, area) => {
        if (taxonomy && type && area && taxonomy[type]?.[area]) {
            return taxonomy[type][area].specialties || [];
        }
        return type && area && NEW_TAXONOMY[type]?.[area] ? NEW_TAXONOMY[type][area].specialties : [];
    };
    const getFocusOptions = (type, area, specialty) => {
        return getFocuses(type, area, specialty);
    };

    // Helper: Get numeric IDs for a category (v2/consolidated schema)
    const getCategoryIds = (typeKey, areaKey, specialtyLabel, focusLabel) => {
        if (!isV2) return { type_id: null, area_id: null, specialty_id: null, focus_id: null, level3_id: null, level4_id: null };

        // Type ID - typeKey may be numeric ID (number or string) or slug
        // Dropdown values are always strings, so also compare with Number() conversion
        const typeId = typeof typeKey === 'number' ? typeKey :
            types.find(t => t.id === typeKey || t.id === Number(typeKey) || t.slug === typeKey)?.id || null;

        // Area ID - areaKey may be numeric ID (number or string) or slug
        const areaId = typeof areaKey === 'number' ? areaKey :
            areas.find(a => a.id === areaKey || a.id === Number(areaKey) || a.slug === areaKey)?.id || null;

        // Specialty ID (Level 3) - find by label in the area
        let specialtyId = null;
        if (areaId && specialtyLabel) {
            // Check both area_id and level2_id for compatibility
            const spec = specialties.find(s =>
                (s.area_id === areaId || s.level2_id === areaId) &&
                (s.label_de === specialtyLabel || s.name === specialtyLabel)
            );
            specialtyId = spec?.id || null;
        }

        // Focus ID (Level 4) - find by label in the specialty
        let focusId = null;
        if (specialtyId && focusLabel) {
            // Check both specialty_id and level3_id for compatibility
            const focus = focuses.find(f =>
                (f.specialty_id === specialtyId || f.level3_id === specialtyId) &&
                (f.label_de === focusLabel || f.name === focusLabel)
            );
            focusId = focus?.id || null;
        }

        return {
            type_id: typeId,
            area_id: areaId,
            specialty_id: specialtyId,
            focus_id: focusId,
            // Consolidated schema aliases
            level3_id: specialtyId,
            level4_id: focusId
        };
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
                // Reset beruf_saeulen when primary category type changes away from professionell
                if (index === 0 && value !== 'professionell' && value !== 'beruflich') {
                    setBerufSaeulen([]);
                }
                if (index === 0 && value !== 'privat') setPrivatKursart('');
                if (index === 0 && value !== 'kinder') setKinderKursart('');
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

    const addEvent = () => {
        const loc = profileLocationRef.current;
        // For Direktbuchung (platform) the street is required and meaningful,
        // so pre-fill from profile. For lead/flex events the profile street must
        // NOT be pre-filled: the event location is a town/venue, not the office address.
        const prefillStreet = bookingType === 'platform' ? (loc?.street || '') : '';
        setEvents([...events, { id: null, bookingCount: 0, type: 'presence', start_date: '', end_date: '', street: prefillStreet, city: loc?.city || '', max_participants: 0, canton: loc?.canton || '', schedule_description: '', location_abroad: '', showLoc: !!(loc?.canton) }]);
        markDirty();
    };
    const removeEvent = (index) => {
        const target = events[index];
        if ((target?.bookingCount || 0) > 0) return;
        setEvents(events.filter((_, i) => i !== index));
        markDirty();
    };
    const updateEvent = (index, field, value) => {
        if ((events[index]?.bookingCount || 0) > 0) return;
        const newEvents = [...events];
        newEvents[index][field] = value;
        setEvents(newEvents);
        markDirty();
    };

    const addLocation = () => { setLocations([...locations, { type: 'presence', street: '', city: '', canton: '', location_abroad: '' }]); markDirty(); };
    const removeLocation = (index) => { if (locations.length > 1) { setLocations(locations.filter((_, i) => i !== index)); markDirty(); } };
    const updateLocation = (index, field, value) => {
        const updated = [...locations];
        updated[index] = { ...updated[index], [field]: value };
        setLocations(updated);
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
    const getEventCutoffDate = (value) => {
        if (!value) return null;
        const normalizedValue = String(value).trim();
        if (!normalizedValue) return null;

        const parsed = normalizedValue.includes('T')
            ? new Date(normalizedValue)
            : new Date(`${normalizedValue}T23:59:59`);

        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const isEventPast = (value) => {
        const cutoff = getEventCutoffDate(value);
        return cutoff ? cutoff < new Date() : false;
    };
    const archivedBookedEvents = events.filter(ev => (ev.bookingCount || 0) > 0 && isEventPast(ev.start_date));
    const visibleEvents = events.filter(ev => !((ev.bookingCount || 0) > 0 && isEventPast(ev.start_date)));

    const saveCourseViaAdmin = async ({ coursePayload, courseId, validEvents, categories }) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Nicht eingeloggt');
        }

        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                action: 'save-course',
                userId: user?.id,
                courseId,
                course: coursePayload,
                validEvents,
                categories
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Admin-Kursspeicherung fehlgeschlagen');
        }

        return data;
    };

    const handlePublishCourse = async (e) => {
        e.preventDefault();

        // 0. Safety Check for Lost Session
        if (!initialData && !user?.id) {
            showNotification("Fehler: Bitte einloggen, um fortzufahren.");
            setIsSubmitting(false);
            return;
        }

        const formData = new FormData(e.target);

        // Resolve submit intent from pending ref (set by action buttons) or fall back to state
        const finalStatus = pendingStatusRef.current ?? courseStatus;
        pendingStatusRef.current = null;

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
                type: normalizeCategoryType((c.type || '').toString()),
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

        const level = selectedLevel; // use state directly (select may be in collapsible section)

        if (isSubmitting) return;

        // 1. Core Validation
        if (!titleVal || !descriptionVal) { window.alert("Titel und Beschreibung sind erforderlich."); return; }
        if (!keywordsVal.trim()) { window.alert("Bitte gib Suchbegriffe ein. Diese helfen, dass dein Kurs gefunden wird."); return; }
        if (!catType || !catArea || !catSpec) { window.alert("Bitte wählen Sie eine vollständige Kategorie aus."); return; }

        // 1a. Feldlängen prüfen (auch bei bestehenden Kursen beim nächsten Speichern)
        if (titleVal.length > COURSE_FIELD_LIMITS.title) { window.alert(`Der Titel darf maximal ${COURSE_FIELD_LIMITS.title} Zeichen lang sein (aktuell: ${titleVal.length} Zeichen). Bitte kürze den Titel.`); return; }
        if (descriptionVal.length > COURSE_FIELD_LIMITS.description) { window.alert(`Die Beschreibung darf maximal ${COURSE_FIELD_LIMITS.description} Zeichen lang sein (aktuell: ${descriptionVal.length} Zeichen).`); return; }
        if (keywordsVal.length > COURSE_FIELD_LIMITS.keywords) { window.alert(`Die Suchbegriffe dürfen maximal ${COURSE_FIELD_LIMITS.keywords} Zeichen lang sein (aktuell: ${keywordsVal.length} Zeichen).`); return; }
        if (priceInfo.length > COURSE_FIELD_LIMITS.priceInfo) { window.alert(`Die Preis-Beschreibung darf maximal ${COURSE_FIELD_LIMITS.priceInfo} Zeichen lang sein (aktuell: ${priceInfo.length} Zeichen).`); return; }
        if (freeReason.length > COURSE_FIELD_LIMITS.freeReason) { window.alert(`Die Begründung für den kostenlosen Kurs darf maximal ${COURSE_FIELD_LIMITS.freeReason} Zeichen lang sein (aktuell: ${freeReason.length} Zeichen).`); return; }
        if (sessionLength.length > COURSE_FIELD_LIMITS.sessionLength) { window.alert(`«Dauer & Umfang» darf maximal ${COURSE_FIELD_LIMITS.sessionLength} Zeichen lang sein (aktuell: ${sessionLength.length} Zeichen).`); return; }
        if (objectives.length > COURSE_FIELD_LIMITS.objectives) { window.alert(`Die Lernziele dürfen maximal ${COURSE_FIELD_LIMITS.objectives} Zeichen lang sein (aktuell: ${objectives.length} Zeichen).`); return; }
        if (prerequisites.length > COURSE_FIELD_LIMITS.prerequisites) { window.alert(`Die Voraussetzungen dürfen maximal ${COURSE_FIELD_LIMITS.prerequisites} Zeichen lang sein (aktuell: ${prerequisites.length} Zeichen).`); return; }
        const tooLongEvent = events.find(ev => (ev.schedule_description || '').length > COURSE_FIELD_LIMITS.scheduleDescription);
        if (tooLongEvent) { window.alert(`«Zeit / Details» eines Termins darf maximal ${COURSE_FIELD_LIMITS.scheduleDescription} Zeichen lang sein.`); return; }

        // 1b. Payout Validation — Direkt-/Flex-Buchung nur mit Stripe Connect
        if (!payoutReady && bookingType !== 'lead') {
            window.alert("Direktbuchungen und flexible Buchungen sind erst möglich, wenn Sie Ihre Auszahlung eingerichtet haben. Bitte wählen Sie «Anfrage (Lead)» oder richten Sie zuerst Ihre Auszahlung ein.");
            return;
        }

        // 2. Booking Specific Validation
        let potentialEvents = events.map(ev => ({
            ...ev,
            location: ev.type === 'online' ? 'Online'
                    : ev.type === 'ausland' ? (ev.location_abroad?.trim() || 'Ausland')
                    : (ev.street && ev.city) ? `${ev.street}, ${ev.city}` : (ev.city || ev.street || '')
        }));

        let validEvents = potentialEvents.filter(ev => {
            if (!ev.start_date) return false;
            if (bookingType === 'platform' && (!ev.type || ev.type === 'presence')) return ev.city && ev.street && ev.canton;
            return true;
        });

        if (bookingType === 'platform') {
            if (validEvents.length === 0) { window.alert("Für Direktbuchungen benötigen wir mindestens einen Termin mit Datum. Präsenz-Termine benötigen zusätzlich Strasse, Ort und Kanton."); return; }
        }

        if ((bookingType === 'platform_flex' || bookingType === 'lead') && locationMode === 'locations') {
            if (locations.length === 0) {
                window.alert("Bitte gib mindestens einen Standort an.");
                return;
            }
            for (const loc of locations) {
                if (loc.type === 'presence' && !loc.canton) {
                    window.alert("Bitte wähle für jeden Präsenz-Standort einen Kanton aus.");
                    return;
                }
            }
        }

        if ((bookingType === 'platform_flex' || bookingType === 'lead') && locationMode === 'events') {
            if (validEvents.length === 0) {
                window.alert("Bitte gib mindestens einen Termin mit Datum an.");
                return;
            }
        }

        // Preis: bei Direktbuchung/Flex ist ein Preis erforderlich
        if ((bookingType === 'platform' || bookingType === 'platform_flex') && !price) {
            window.alert("Bitte gib einen Preis ein. Für kostenlose Kurse trage 0 ein und begründe dies.");
            setIsSubmitting(false);
            return;
        }
        // Kostenloser Kurs: free_reason ist Pflicht
        if ((bookingType === 'platform' || bookingType === 'platform_flex') && Number(price) === 0 && !freeReason.trim()) {
            window.alert("Bitte gib an, warum dieser Kurs kostenlos ist.");
            setIsSubmitting(false);
            return;
        }

        // Kinder-Kurs: Mindestalter ist Pflicht
        const primaryType = cleanedCategories[0]?.type;
        if ((primaryType === 'kinder' || primaryType === 'kinder_jugend') && !minAge) {
            window.alert("Für Kinder-Kurse ist das Mindestalter erforderlich.");
            return;
        }

        setIsSubmitting(true);

        // 3. Image Upload (mit automatischer Komprimierung) oder bestehendes Bild verwenden
        let imageUrl = initialData?.image_url || DEFAULT_COURSE_IMAGE;

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

        // Unsplash-Bild in eigenen Storage importieren (Datenschutz)
        if (isUnsplashUrl(imageUrl)) {
            try {
                imageUrl = await importUnsplashImage(imageUrl);
            } catch (importErr) {
                console.warn('Unsplash-Import fehlgeschlagen:', importErr);
            }
        }

        // 4. Determine Main Location/Date (public label)
let publicLocationLabel = "";
let mainCanton = "";
let mainDate = null;

if (bookingType === 'platform' || locationMode === 'events') {
    const sortedEvents = [...validEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const firstEvent = sortedEvents[0];
    if (firstEvent) {
        mainDate = firstEvent.start_date;
        mainCanton = firstEvent.canton || (fallbackCantons.length > 0 ? fallbackCantons[0] : '');
        publicLocationLabel = firstEvent.city || mainCanton || "";
    }
    if (!publicLocationLabel && fallbackCantons.length > 0) {
        mainCanton = mainCanton || fallbackCantons[0];
        publicLocationLabel = fallbackCantons.join(', ');
    }
} else {
    // lead/flex in locations mode: derive public label from first presence location
    const firstPresence = locations.find(l => l.type === 'presence');
    const firstLoc = firstPresence || locations[0];
    if (firstLoc?.type === 'presence') {
        mainCanton = firstLoc.canton || '';
        publicLocationLabel = firstLoc.city || firstLoc.canton || '';
    } else if (firstLoc?.type === 'online') {
        mainCanton = '';
        publicLocationLabel = 'Online';
    } else if (firstLoc?.type === 'ausland') {
        mainCanton = 'Ausland';
        publicLocationLabel = 'Ausland';
    }
    mainDate = null;
}


        // 5. Build Object - Safe access guards
        // Get numeric IDs for v2 schema
        const primaryIds = getCategoryIds(catType, catArea, catSpec, catFocus);
        if (isV2 && !primaryIds.level3_id) {
            window.alert("Die Kategorie konnte nicht eindeutig der aktuellen Taxonomie zugeordnet werden. Bitte wähle die Kategorie erneut aus und warte, bis die Taxonomie geladen ist.");
            setIsSubmitting(false);
            return;
        }

        const normalizedDeliveryTypes = getNormalizedDeliveryTypes({
            delivery_types: deliveryTypes,
            canton: mainCanton,
            address: publicLocationLabel,
            course_events: validEvents
        });

        const newCourse = {
            title: titleVal,
            instructor_name: user?.name || initialData?.instructor_name || '',
            price: Number(price) || 0,
            languages: courseLanguages, // Array of languages
            rating: initialData?.rating || 0,
            category: `${catType} | ${catArea}`,
            // Legacy text fields (keep for backward compatibility)
            category_type: normalizeCategoryType(catType),
            category_area: catArea,
            category_specialty: catSpec,
            category_focus: catFocus || null,
            // V2 numeric ID fields (legacy v2 schema)
            category_type_id: primaryIds.type_id,
            category_area_id: primaryIds.area_id,
            category_specialty_id: primaryIds.specialty_id,
            category_focus_id: primaryIds.focus_id,
            // Consolidated schema fields (new)
            category_level3_id: primaryIds.level3_id,
            category_level4_id: primaryIds.level4_id,
            category_paths: cleanedCategories,
            booking_type: bookingType,
            ticket_limit_30d: ticketLimit30d ? Number(ticketLimit30d) : null,
            external_link: null,
            level: level,
            delivery_types: normalizedDeliveryTypes,
            target_age_groups: [],
            canton: mainCanton,
            address: publicLocationLabel, // öffentliche "Label"-Location (ohne Strasse)
            start_date: mainDate,
            image_url: imageUrl,
            description: descriptionVal,
            keywords: keywordsVal,
            objectives: objectivesList,
            prerequisites: prerequisitesVal,
            session_count: null, // merged into session_length
            session_length: sessionLength || null,
            price_info: priceInfo || null,
            provider_url: providerUrl,
            user_id: user?.id || initialData?.user_id,
            is_pro: user?.is_professional ?? initialData?.is_pro ?? false,
            status: finalStatus,
            beruf_saeulen: (catType === 'professionell' || catType === 'beruflich') && berufSaeulen.length > 0 ? berufSaeulen : null,
            ...(catType === 'privat' && privatKursart ? { privat_kursart: privatKursart } : {}),
            ...(catType === 'kinder' && kinderKursart ? { kinder_kursart: kinderKursart } : {}),
            min_age: minAge ? Number(minAge) : null,
            requires_guardian_booking: requiresGuardianBooking,
            free_reason: (Number(price) === 0 || !price) && (bookingType === 'platform' || bookingType === 'platform_flex') ? freeReason.trim() : null
        };

        const consolidatedCategories = cleanedCategories
            .map((cat, idx) => {
                const catIds = getCategoryIds(cat.type, cat.area, cat.specialty, cat.focus);
                return {
                    level3_id: catIds.level3_id,
                    level4_id: catIds.level4_id || null,
                    is_primary: idx === 0
                };
            })
            .filter(cat => cat.level3_id != null);

        // 6. DB Operations
        let activeCourseId = initialData?.id;
        let error;

        if (isAdminImpersonating) {
            try {
                const result = await saveCourseViaAdmin({
                    coursePayload: newCourse,
                    courseId: activeCourseId,
                    validEvents,
                    categories: consolidatedCategories,
                    locations,
                    bookingType
                });
                activeCourseId = result.courseId;
                showNotification(activeCourseId && initialData?.id ? "Kurs aktualisiert!" : t.success_msg);
            } catch (adminError) {
                error = adminError;
            }
        } else if (activeCourseId) {
            const { error: err } = await supabase.from('courses').update(newCourse).eq('id', activeCourseId);
            error = err;
        } else {
            const { data: inserted, error: err } = await supabase.from('courses').insert([newCourse]).select();
            if (inserted && inserted[0]) activeCourseId = inserted[0].id;
            error = err;
        }

        if (error) { 
            console.error(error); 
            showNotification("Fehler: " + error.message); 
            setIsSubmitting(false);
            return; 
        } 



        // 7. Update Events Table (platform always; lead/flex when in events mode)
        if (!isAdminImpersonating && activeCourseId && (bookingType === 'platform' || locationMode === 'events')) {
            // Dedupe check: no two events may share (start_date, location, canton)
            const eventKeys = validEvents.map(ev =>
                `${ev.start_date}|${ev.location || ''}|${ev.canton || (fallbackCantons.length > 0 ? fallbackCantons[0] : '')}`
            );
            const dupeIdx = eventKeys.findIndex((k, i) => eventKeys.indexOf(k) !== i);
            if (dupeIdx !== -1) {
                showNotification("Zwei Termine haben dasselbe Startdatum, denselben Ort und Kanton. Bitte passe einen der Termine an.");
                setIsSubmitting(false);
                return;
            }

            const existingEventIds = validEvents.map(ev => ev.id).filter(Boolean);

            const { data: existingEvents, error: existingEventsError } = await supabase
                .from('course_events')
                .select('id')
                .eq('course_id', activeCourseId);

            if (existingEventsError) {
                console.error(existingEventsError);
                showNotification("Fehler beim Laden der Termine: " + existingEventsError.message);
                setIsSubmitting(false);
                return;
            }

            const eventIdsToDelete = (existingEvents || [])
                .map(ev => ev.id)
                .filter(id => !existingEventIds.includes(id));

            if (eventIdsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from('course_events')
                    .delete()
                    .in('id', eventIdsToDelete);

                if (deleteError) {
                    console.error(deleteError);
                    showNotification("Termine mit bestehenden Buchungen können nicht gelöscht werden. Bitte passe den Termin an, statt ihn zu entfernen.");
                    setIsSubmitting(false);
                    return;
                }
            }

            for (const ev of validEvents) {
                const eventPayload = {
                    course_id: activeCourseId,
                    start_date: ev.start_date,
                    end_date: ev.end_date || null,
                    location: ev.location,
                    canton: ev.type === 'online' ? null : ev.type === 'ausland' ? 'Ausland' : (ev.canton || null),
                    schedule_description: ev.schedule_description,
                    max_participants: parseInt(ev.max_participants) || 0
                };

                if (ev.id) {
                    const { error: updateEventError } = await supabase
                        .from('course_events')
                        .update(eventPayload)
                        .eq('id', ev.id);

                    if (updateEventError) {
                        console.error(updateEventError);
                        const msg = updateEventError.message?.includes('course_events_dedupe_uq')
                            ? "Zwei Termine dürfen nicht dasselbe Startdatum, denselben Ort und Kanton haben."
                            : "Fehler beim Aktualisieren eines Termins: " + updateEventError.message;
                        showNotification(msg);
                        setIsSubmitting(false);
                        return;
                    }
                } else {
                    const { error: insertEventError } = await supabase
                        .from('course_events')
                        .insert(eventPayload);

                    if (insertEventError) {
                        console.error(insertEventError);
                        const msg = insertEventError.message?.includes('course_events_dedupe_uq')
                            ? "Zwei Termine dürfen nicht dasselbe Startdatum, denselben Ort und Kanton haben."
                            : "Fehler beim Erstellen eines Termins: " + insertEventError.message;
                        showNotification(msg);
                        setIsSubmitting(false);
                        return;
                    }
                }
            }
        } else if (!isAdminImpersonating && activeCourseId && bookingType !== 'platform' && locationMode === 'locations') {
            // Lead/flex switched to "Feste Standorte": delete any lingering events so the course
            // reloads in locations mode next time (mode is inferred from whether events exist in DB).
            const { error: deleteStaleEventsError } = await supabase
                .from('course_events')
                .delete()
                .eq('course_id', activeCourseId);
            if (deleteStaleEventsError) {
                console.error(deleteStaleEventsError);
                showNotification("Fehler beim Bereinigen der Termine: " + deleteStaleEventsError.message);
                setIsSubmitting(false);
                return;
            }
        }

        // 7b. Save course_locations (all booking types)
        // In 'locations' mode (lead/flex only): save from locations state
        // In 'events' mode (platform + lead/flex): mirror unique cantons from events for search filters
        // Note: platform courses previously skipped this block, leaving stale locations in DB.
        if (!isAdminImpersonating && activeCourseId) {
            // Delete all existing locations for this course, then re-insert
            await supabase.from('course_locations').delete().eq('course_id', activeCourseId);

            let locationPayloads = [];

            if (locationMode === 'locations' && bookingType !== 'platform') {
                // Feste Standorte (lead/flex only): save full address from locations state
                locationPayloads = locations.map((loc, i) => ({
                    course_id: activeCourseId,
                    location_type: loc.type,
                    street: loc.type === 'presence' ? (loc.street?.trim() || null)
                          : loc.type === 'ausland' ? (loc.location_abroad?.trim() || null) : null,
                    city: loc.type === 'presence' ? (loc.city?.trim() || null) : null,
                    canton: loc.type === 'presence' ? (loc.canton || null) : (loc.type === 'ausland' ? 'Ausland' : null),
                    sort_order: i
                }));
            } else {
                // Events mode (platform + lead/flex): mirror unique presence cantons from events.
                // Do NOT copy street — events are the authoritative source for the full address;
                // course_locations in this mode serve only as a canton-based filter index.
                const seen = new Set();
                locationPayloads = validEvents
                    .filter(ev => ev.type === 'presence' && ev.canton && !seen.has(ev.canton) && seen.add(ev.canton))
                    .map((ev, i) => ({
                        course_id: activeCourseId,
                        location_type: 'presence',
                        street: null,
                        city: ev.city?.trim() || null,
                        canton: ev.canton,
                        sort_order: i
                    }));
            }

            if (locationPayloads.length > 0) {
                const { error: locError } = await supabase.from('course_locations').insert(locationPayloads);
                if (locError) {
                    console.error(locError);
                    showNotification("Fehler beim Speichern der Standorte: " + locError.message);
                    setIsSubmitting(false);
                    return;
                }
            }
        }

        // 8. Update course_category_assignments junction table (for Zweitkategorien support)
        if (!isAdminImpersonating && activeCourseId && cleanedCategories && cleanedCategories.length > 0) {
            console.log('[CAT-DEBUG] cleanedCategories:', JSON.stringify(cleanedCategories));
            console.log('[CAT-DEBUG] types available:', types.map(t => ({ id: t.id, slug: t.slug, idType: typeof t.id })));
            console.log('[CAT-DEBUG] areas available:', areas.map(a => ({ id: a.id, slug: a.slug, idType: typeof a.id })));
            console.log('[CAT-DEBUG] specialties available:', specialties.map(s => ({ id: s.id, area_id: s.area_id, level2_id: s.level2_id, label_de: s.label_de })));

            await supabase.from('course_category_assignments').delete().eq('course_id', activeCourseId);

            // Filter categories that have valid level3_id
            const dbCategories = consolidatedCategories.map(cat => ({
                course_id: activeCourseId,
                level3_id: cat.level3_id,
                level4_id: cat.level4_id,
                is_primary: cat.is_primary
            }));

            console.log('[CAT-DEBUG] consolidatedCategories to insert:', JSON.stringify(dbCategories));

            if (dbCategories.length > 0) {
                const { error: catErr } = await supabase
                    .from('course_category_assignments')
                    .insert(dbCategories);

                if (catErr) {
                    console.error('[CAT-DEBUG] INSERT ERROR:', catErr);
                } else {
                    console.log('[CAT-DEBUG] INSERT SUCCESS');
                }
            } else {
                console.warn('[CAT-DEBUG] No valid categories to insert! All level3_id were null.');
            }
        }

        // Clear draft after successful save
        try {
            sessionStorage.removeItem(draftKey);
        } catch (e) {
            console.warn('Failed to clear draft:', e);
        }
        setIsDirty(false);

        showNotification(initialData?.id ? "Kurs aktualisiert!" : t.success_msg);
        await refreshCoursesAfterMutation(fetchCourses, { followupDelayMs: courseStatus === 'published' ? 600 : 0 });
        setEditingCourse(null);
        sessionStorage.setItem('dashOpenTab', 'kursangebot');
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

    // Compute missing required fields for the Section 6 indicator
    const isKinder = categories[0]?.type === 'kinder' || categories[0]?.type === 'kinder_jugend';
    const missingRequiredFields = [];
    if (!title.trim()) missingRequiredFields.push('Kurstitel');
    if (!description.trim()) missingRequiredFields.push('Beschreibung');
    if (!keywords.trim()) missingRequiredFields.push('Suchbegriffe');
    if (!categories[0]?.area) missingRequiredFields.push('Bereich (Kategorie)');
    else if (!categories[0]?.specialty) missingRequiredFields.push('Spezialgebiet (Kategorie)');
    if (!imagePreview && !selectedExistingImage && !initialData?.image_url) missingRequiredFields.push('Kursbild');
    // Ort/Termine je nach Modus
    if (bookingType === 'platform' || locationMode === 'events') {
        if (visibleEvents.filter(ev => ev.start_date).length === 0 && events.filter(ev => ev.start_date).length === 0) {
            missingRequiredFields.push('Mindestens ein Termin mit Datum');
        }
    } else if (locationMode === 'locations' && bookingType !== 'platform') {
        const hasValidLoc = locations.some(l => l.type !== 'presence' || l.canton);
        if (!hasValidLoc) missingRequiredFields.push('Standort');
    }
    if (isKinder && !minAge) missingRequiredFields.push('Mindestalter (Kinderkurs)');

    return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
        <button onClick={handleBack} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> {t.btn_back_dash}</button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4"><h1 className="text-3xl font-bold text-dark font-heading">{initialData ? t.edit_course : t.create_course}</h1></div>
            
            <form ref={formRef} onSubmit={handlePublishCourse} className="space-y-8">
                {initialData && <input type="hidden" name="course_id" value={initialData.id} />}
                
                {/* === ABSCHNITT 1: GRUNDANGABEN === */}
                <div className="border-t border-gray-100 pt-2">
                    <h2 className="text-lg font-bold text-dark">1. Grundangaben <span className="text-red-500">*</span></h2>
                    <p className="text-sm text-gray-500 mt-0.5">Titel und Beschreibung deines Kurses.</p>
                </div>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                            <label className="text-sm font-bold text-gray-700">{t.lbl_title} <span className="text-red-500">*</span></label>
                            <CharCount value={title} max={COURSE_FIELD_LIMITS.title} />
                        </div>
                        <input required type="text" name="title" value={title} maxLength={COURSE_FIELD_LIMITS.title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} className="w-full px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                    </div>
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                            <label className="text-sm font-bold text-gray-700">{t.lbl_description} <span className="text-red-500">*</span></label>
                            <CharCount value={description} max={COURSE_FIELD_LIMITS.description} />
                        </div>
                        <textarea required name="description" value={description} maxLength={COURSE_FIELD_LIMITS.description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} rows="6" placeholder="Beschreibe deinen Kurs..." className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y block"></textarea>
                    </div>
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                            <label className="text-sm font-bold text-gray-700">Suchbegriffe für die Suche <span className="text-red-500">*</span></label>
                            <CharCount value={keywords} max={COURSE_FIELD_LIMITS.keywords} />
                        </div>
                        <input type="text" name="keywords" value={keywords} maxLength={COURSE_FIELD_LIMITS.keywords} onChange={(e) => { setKeywords(e.target.value); markDirty(); }} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="z.B. Klavier, Musik, Anfänger, Kinder, Zürich" />
                        <p className="text-xs text-gray-500 mt-1">Diese Begriffe helfen, dass dein Kurs über die Suche gefunden wird. Trenne mehrere Begriffe mit Komma.</p>
                    </div>
                    {/* Kursbild */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Kursbild <span className="text-red-500">*</span></label>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-dashed border-gray-300">
                            {(imagePreview || selectedExistingImage || initialData?.image_url) && (
                                <div className="relative shrink-0">
                                    <img
                                        src={imagePreview || selectedExistingImage || initialData.image_url}
                                        className="w-20 h-20 rounded-lg object-cover shadow-sm"
                                        alt="Kursbildvorschau"
                                    />
                                    {imagePreview && (
                                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">Neu</span>
                                    )}
                                    {selectedExistingImage && !imagePreview && (
                                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">Bibliothek</span>
                                    )}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-3">
                                <input type="file" id="courseImageInput" name="courseImage" accept="image/*" onChange={handleImageChange} className="hidden" />
                                <label htmlFor="courseImageInput" className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 cursor-pointer transition">
                                    <Upload className="w-4 h-4" />
                                    Bild hochladen
                                </label>
                                <button
                                    type="button"
                                    onClick={openImageLibrary}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition"
                                >
                                    <Images className="w-4 h-4" />
                                    Aus Bibliothek wählen
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Erforderlich für Veröffentlichung. Lade ein neues Bild hoch oder wähle eines aus deiner Bibliothek.</p>
                    </div>
                </div>

                {/* === ABSCHNITT 2: KATEGORIE & KURSART === */}
                <div className="border-t border-gray-100 pt-2">
                    <h2 className="text-lg font-bold text-dark">2. Kategorie &amp; Kursart <span className="text-red-500">*</span></h2>
                    <p className="text-sm text-gray-500 mt-0.5">Hilf Interessierten, deinen Kurs zu finden.</p>
                </div>
                <div className="bg-beige p-6 rounded-xl border border-orange-100 space-y-4">
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
                                            {(types.length > 0 ? types : Object.keys(CATEGORY_TYPES).map(id => ({ id, slug: id, label_de: CATEGORY_TYPES[id].de }))).map(type => (
                                                <option key={type.slug || type.id} value={type.slug || type.id}>{TYPE_DISPLAY_LABELS[type.slug] || type.label_de}</option>
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
                                            {row.type && getAreasLocal(row.type).map(key => {
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
                                            {row.type && row.area && getSpecialtiesLocal(row.type, row.area).map(spec => (
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

                    {/* Kursart: berufliche Kurse */}
                    {(categories[0]?.type === 'professionell' || categories[0]?.type === 'beruflich') && (
                        <div className="bg-white/60 p-4 rounded-lg border border-blue-200/60 mt-4">
                            <span className="text-sm font-bold text-blue-900 block mb-1">Kursart / Art der Weiterbildung</span>
                            <span className="text-xs text-gray-500 block mb-3">Welchem Format entspricht dieser Kurs? Mehrfachauswahl möglich.</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {Object.entries(BERUF_SAEULEN).map(([key, config]) => {
                                    const Icon = { workshop: Clock, fachkurs: BookOpen, zertifikatslehrgang: Award, ausbildung: GraduationCap }[key];
                                    const isSelected = berufSaeulen.includes(key);
                                    return (
                                        <label key={key} className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${isSelected ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : 'bg-white border-gray-200 hover:border-blue-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" value={key} checked={isSelected}
                                                    onChange={() => { setBerufSaeulen(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]); markDirty(); }}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <Icon className="w-4 h-4 text-blue-600" />
                                                <span className="text-sm font-medium text-gray-800">{config.shortDe}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 ml-6">{config.subtitle}</span>
                                            <span className="text-xs text-gray-500 mt-1 ml-6">{config.description}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Kursart: Privat & Hobby */}
                    {categories[0]?.type === 'privat' && (
                        <div className="bg-white/60 p-4 rounded-lg border border-orange-200/60 mt-4">
                            <span className="text-sm font-bold text-orange-900 block mb-1">Kursart</span>
                            <span className="text-xs text-gray-500 block mb-3">Welchem Format entspricht dieser Kurs? (Einfachauswahl)</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {Object.entries(PRIVAT_KURSARTEN).map(([key, config]) => {
                                    const isSelected = privatKursart === key;
                                    return (
                                        <label key={key} className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${isSelected ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' : 'bg-white border-gray-200 hover:border-orange-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="radio" name="privat_kursart" value={key} checked={isSelected}
                                                    onChange={() => { setPrivatKursart(key); markDirty(); }}
                                                    className="text-orange-500 focus:ring-orange-400"
                                                />
                                                <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{config.shortDe}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 ml-5">{config.subtitle}</span>
                                            <span className="text-xs text-gray-500 mt-1 ml-5">{config.description}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Kursart: Kinder & Jugend */}
                    {categories[0]?.type === 'kinder' && (
                        <div className="bg-white/60 p-4 rounded-lg border border-green-200/60 mt-4">
                            <span className="text-sm font-bold text-green-900 block mb-1">Kursart</span>
                            <span className="text-xs text-gray-500 block mb-3">Welchem Format entspricht dieser Kurs? (Einfachauswahl)</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                {Object.entries(KINDER_KURSARTEN).map(([key, config]) => {
                                    const isSelected = kinderKursart === key;
                                    return (
                                        <label key={key} className={`flex flex-col p-3 rounded-lg border cursor-pointer transition ${isSelected ? 'bg-green-50 border-green-400 ring-2 ring-green-200' : 'bg-white border-gray-200 hover:border-green-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="radio" name="kinder_kursart" value={key} checked={isSelected}
                                                    onChange={() => { setKinderKursart(key); markDirty(); }}
                                                    className="text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{config.shortDe}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 ml-5">{config.subtitle}</span>
                                            <span className="text-xs text-gray-500 mt-1 ml-5">{config.description}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* === ABSCHNITT 3: BUCHUNG & PREIS === */}
                <div className="border-t border-gray-100 pt-2">
                    <h2 className="text-lg font-bold text-dark">3. Buchung &amp; Preis</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Wie können Interessierte buchen und was kostet der Kurs?</p>
                </div>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className={`border p-4 rounded-xl transition relative overflow-hidden ${!payoutReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${bookingType === 'platform' ? 'border-primary bg-orange-50 ring-1 ring-primary' : !payoutReady ? '' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="platform" checked={bookingType === 'platform'} disabled={!payoutReady} onChange={() => { setBookingType('platform'); markDirty(); }} className="mr-2 accent-primary"/> <span className="font-bold">Direktbuchung</span></div>
                            <p className="text-xs text-gray-500">Mit festem Termin. Zahlung via KursNavi.</p>
                        </label>
                        <label className={`border p-4 rounded-xl transition relative overflow-hidden ${!payoutReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${bookingType === 'platform_flex' ? 'border-primary bg-orange-50 ring-1 ring-primary' : !payoutReady ? '' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="platform_flex" checked={bookingType === 'platform_flex'} disabled={!payoutReady} onChange={() => { setBookingType('platform_flex'); markDirty(); }} className="mr-2 accent-primary"/> <span className="font-bold">Flexibel</span></div>
                            <p className="text-xs text-gray-500">Termin wird nach Buchung vereinbart. Zahlung via KursNavi.</p>
                        </label>
                        <label className={`cursor-pointer border p-4 rounded-xl transition ${bookingType === 'lead' ? 'border-primary bg-orange-50 ring-1 ring-primary' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-center mb-2"><input type="radio" name="bookingType" value="lead" checked={bookingType === 'lead'} onChange={() => { setBookingType('lead'); markDirty(); }} className="mr-2 accent-primary"/> <span className="font-bold">Anfrage</span></div>
                            <p className="text-xs text-gray-500">Interessierte senden dir eine Nachricht. Keine Zahlung über KursNavi.</p>
                        </label>
                    </div>
                    {!payoutReady && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800">
                                Für Direktbuchungen und flexible Buchungen musst du zuerst deine <button type="button" onClick={() => { sessionStorage.setItem('dashOpenTab', 'profile'); sessionStorage.setItem('dashScrollTo', 'auszahlungen'); setView('dashboard'); }} className="underline font-semibold hover:text-amber-900">Auszahlung einrichten</button>. Für Anfrage-Kurse ist keine Einrichtung nötig.
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                Preis (CHF) {(bookingType === 'platform' || bookingType === 'platform_flex') ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
                            </label>
                            <input type="number" min="0" name="price" value={price} onChange={(e) => { setPrice(e.target.value); markDirty(); }} placeholder="z.B. 150" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            {(bookingType === 'platform' || bookingType === 'platform_flex') && price !== '' && Number(price) === 0 && (
                                <p className="text-xs text-amber-600 mt-1">Kostenloser Kurs – bitte Grund angeben</p>
                            )}
                        </div>
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <label className="text-sm font-bold text-gray-700">Preis-Beschreibung <span className="text-gray-400 font-normal">(optional)</span></label>
                                <CharCount value={priceInfo} max={COURSE_FIELD_LIMITS.priceInfo} />
                            </div>
                            <input type="text" value={priceInfo} maxLength={COURSE_FIELD_LIMITS.priceInfo} onChange={(e) => { setPriceInfo(e.target.value); markDirty(); }} placeholder="z.B. CHF 150 pro Person, ab CHF 80, auf Anfrage" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            <p className="text-xs text-gray-500 mt-1">Ergänzt oder ersetzt den numerischen Preis auf der Kursseite.</p>
                        </div>
                        {(bookingType === 'platform' || bookingType === 'platform_flex') && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Max. Buchungen pro 30 Tage</label>
                                <input type="number" min="1" name="ticketLimit30d" value={ticketLimit30d} onChange={(e) => { setTicketLimit30d(e.target.value); markDirty(); }} placeholder="Leer = unbegrenzt" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                                <p className="text-xs text-gray-500 mt-1">Begrenzt die Anzahl Buchungen in 30 Tagen.</p>
                            </div>
                        )}
                        {(bookingType === 'platform' || bookingType === 'platform_flex') && price !== '' && Number(price) === 0 && (
                            <div className="md:col-span-2">
                                <div className="flex justify-between items-baseline mb-1">
                                    <label className="text-sm font-bold text-gray-700">Warum ist dieser Kurs kostenlos? *</label>
                                    <CharCount value={freeReason} max={COURSE_FIELD_LIMITS.freeReason} />
                                </div>
                                <textarea name="freeReason" value={freeReason} maxLength={COURSE_FIELD_LIMITS.freeReason} onChange={(e) => { setFreeReason(e.target.value); markDirty(); }} placeholder="z.B. Schnupperkurs, Probetraining, ehrenamtliches Angebot…" rows={2} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none" />
                            </div>
                        )}
                    </div>
                </div>

                {/* === ABSCHNITT 4: ORT & TERMINE === */}
                <div className="border-t border-gray-100 pt-2">
                    <h2 className="text-lg font-bold text-dark">4. Ort &amp; Termine <span className="text-red-500">*</span></h2>
                    <p className="text-sm text-gray-500 mt-0.5">Wo und wie findet dein Kurs statt?</p>
                </div>
                <div className="space-y-4">
                    {/* Durchführung (Delivery Types) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Durchführung</label>
                        <p className="text-xs text-gray-500 mb-3">Wie wird der Kurs durchgeführt? Mehrfachauswahl möglich.</p>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(DELIVERY_TYPES).map(([key, val]) => (
                                <label key={key} className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer text-sm transition ${deliveryTypes.includes(key) ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}>
                                    <input
                                        type="checkbox"
                                        value={key}
                                        checked={deliveryTypes.includes(key)}
                                        onChange={() => { setDeliveryTypes(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]); markDirty(); }}
                                        className="hidden"
                                    />
                                    {val.de}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Ort & Termine Modus-Auswahl */}
                    {(bookingType === 'lead' || bookingType === 'platform_flex') ? (
                        <div>
                            <p className="text-sm font-bold text-gray-700 mb-2">Wie möchtest du Ort und Termine erfassen?</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setLocationMode('locations'); markDirty(); }}
                                    className={`text-left p-4 rounded-xl border-2 transition ${locationMode === 'locations' ? 'border-gray-700 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <MapPin className={`w-4 h-4 shrink-0 ${locationMode === 'locations' ? 'text-gray-800' : 'text-gray-400'}`} />
                                        <span className={`font-bold text-sm ${locationMode === 'locations' ? 'text-gray-900' : 'text-gray-600'}`}>Feste Standorte</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">Für laufende Kurse, regelmässige Angebote oder Anfragen ohne fixes Datum.</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setLocationMode('events'); markDirty(); }}
                                    className={`text-left p-4 rounded-xl border-2 transition ${locationMode === 'events' ? 'border-gray-700 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Calendar className={`w-4 h-4 shrink-0 ${locationMode === 'events' ? 'text-gray-800' : 'text-gray-400'}`} />
                                        <span className={`font-bold text-sm ${locationMode === 'events' ? 'text-gray-900' : 'text-gray-600'}`}>Konkrete Termine</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">Für Kurse mit festen Daten, z.B. Workshops, Camps oder Events.</p>
                                </button>
                            </div>
                        </div>
                    ) : bookingType === 'platform' ? (
                        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                            Bei Direktbuchung braucht dein Kurs mindestens einen konkreten Termin. Interessierte buchen direkt einen Platz für diesen Termin.
                        </p>
                    ) : null}

                    {/* Lead + Flex in locations mode: Standorte */}
                    {(bookingType === 'lead' || bookingType === 'platform_flex') && locationMode === 'locations' && (
                        <div className="border border-gray-200 rounded-xl p-4">
                            <h3 className="text-base font-bold text-gray-800 flex items-center mb-1">
                                <MapPin className="w-4 h-4 mr-2 text-gray-500" /> Hauptstandort *
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                                {bookingType === 'platform_flex'
                                    ? 'Der genaue Termin wird nach der Buchung vereinbart. Gib hier an, wo du tätig bist.'
                                    : 'Wo bietest du diesen Kurs an? Der Kanton ist für die regionale Suche wichtig.'}
                            </p>
                            <div className="space-y-3">
                                {locations.map((loc, i) => (
                                    <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="flex gap-2 mb-3">
                                            {[
                                                { value: 'presence', label: 'Präsenz' },
                                                { value: 'online',   label: 'Online'  },
                                                { value: 'ausland',  label: 'Ausland' }
                                            ].map(({ value, label }) => (
                                                <button key={value} type="button"
                                                    onClick={() => updateLocation(i, 'type', value)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${loc.type === value ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        {loc.type === 'presence' && (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                <div className="md:col-span-5">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Strasse / Nr.</label>
                                                    <input type="text" value={loc.street} onChange={e => updateLocation(i, 'street', e.target.value)} placeholder="Musterstrasse 12" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">PLZ / Ort</label>
                                                    <input type="text" value={loc.city} onChange={e => updateLocation(i, 'city', e.target.value)} placeholder="8000 Zürich" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Kanton *</label>
                                                    <select value={loc.canton} data-testid={`location-canton-${i}`} onChange={e => updateLocation(i, 'canton', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none">
                                                        <option value="">Bitte wählen…</option>
                                                        {SWISS_CANTONS.filter(c => c !== "Ausland" && c !== "Online").map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <p className="text-xs text-gray-400 mt-1">Bestimmt die Region in der Suche.</p>
                                                </div>
                                            </div>
                                        )}
                                        {loc.type === 'online' && (
                                            <p className="text-sm text-gray-500">Kurs findet online statt — keine Adresse erforderlich.</p>
                                        )}
                                        {loc.type === 'ausland' && (
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Adresse im Ausland (Optional)</label>
                                                <input type="text" value={loc.location_abroad || ''} onChange={e => updateLocation(i, 'location_abroad', e.target.value)} placeholder="z.B. München, Deutschland" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                            </div>
                                        )}
                                        {locations.length > 1 && (
                                            <button type="button" onClick={() => removeLocation(i)} className="text-red-500 text-xs hover:underline flex items-center mt-2">
                                                <Trash2 className="w-3 h-3 mr-1" /> Entfernen
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addLocation} className="mt-3 flex items-center text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-50 transition">
                                <Plus className="w-4 h-4 mr-1"/> Weiteren Standort hinzufügen
                            </button>
                        </div>
                    )}

                    {/* Lead/Flex in events mode OR platform: Termine */}
                    {((bookingType === 'lead' || bookingType === 'platform_flex') && locationMode === 'events') && (
                        <div className="border border-gray-200 rounded-xl p-4">
                            <h3 className="text-base font-bold text-gray-800 flex items-center mb-1"><Calendar className="w-4 h-4 mr-2 text-gray-500" /> Termine</h3>
                            <p className="text-xs text-gray-500 mt-1 mb-4">Leere Termine werden nicht gespeichert. Wähle das Datum über das Kalenderfeld.</p>
                            <div className="space-y-4">
                                {events.map((ev, i) => {
                                    const evType = ev.type || 'presence';
                                    return (
                                        <div key={ev.id || i} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col gap-3">
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Startdatum</label>
                                                    <input type="date" value={ev.start_date} onChange={e => updateEvent(i, 'start_date', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Enddatum (optional)</label>
                                                    <input type="date" value={ev.end_date || ''} min={ev.start_date || undefined} onChange={e => updateEvent(i, 'end_date', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <div className="flex justify-between items-baseline">
                                                        <label className="text-xs font-bold text-gray-500 uppercase">Zeit / Details (Optional)</label>
                                                        <CharCount value={ev.schedule_description} max={COURSE_FIELD_LIMITS.scheduleDescription} />
                                                    </div>
                                                    <input type="text" value={ev.schedule_description} maxLength={COURSE_FIELD_LIMITS.scheduleDescription} onChange={e => updateEvent(i, 'schedule_description', e.target.value)} placeholder="z.B. Sa & So, 09:00 – 17:00" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                                </div>
                                            </div>
                                            {/* Toggle für abweichenden Ort */}
                                            <button
                                                type="button"
                                                onClick={() => updateEvent(i, 'showLoc', !ev.showLoc)}
                                                className="self-start text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition"
                                            >
                                                {ev.showLoc ? 'Ort ausblenden' : 'Abweichenden Ort angeben'}
                                            </button>
                                            {ev.showLoc && (
                                                <div>
                                                    <div className="flex gap-2 mb-2">
                                                        {[
                                                            { value: 'presence', label: 'Präsenz' },
                                                            { value: 'online',   label: 'Online'  },
                                                            { value: 'ausland',  label: 'Ausland' }
                                                        ].map(({ value, label }) => (
                                                            <button key={value} type="button"
                                                                onClick={() => updateEvent(i, 'type', value)}
                                                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${evType === value ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {evType === 'presence' && (
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                            <div className="md:col-span-7">
                                                                <label className="text-xs font-bold text-gray-500 uppercase">PLZ / Ort</label>
                                                                <input type="text" value={ev.city} onChange={e => updateEvent(i, 'city', e.target.value)} placeholder="8000 Zürich" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                                            </div>
                                                            <div className="md:col-span-5">
                                                                <label className="text-xs font-bold text-gray-500 uppercase">Kanton (für Filter)</label>
                                                                <select value={ev.canton} onChange={e => updateEvent(i, 'canton', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none">
                                                                    <option value="">Bitte wählen…</option>
                                                                    {SWISS_CANTONS.filter(c => c !== "Ausland" && c !== "Online").map(c => <option key={c} value={c}>{c}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {evType === 'ausland' && (
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Adresse im Ausland (Optional)</label>
                                                            <input type="text" value={ev.location_abroad || ''} onChange={e => updateEvent(i, 'location_abroad', e.target.value)} placeholder="z.B. München, Deutschland" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <button type="button" onClick={() => removeEvent(i)} className="text-red-500 text-xs hover:underline flex items-center self-end"><Trash2 className="w-3 h-3 mr-1" /> Entfernen</button>
                                        </div>
                                    );
                                })}
                            </div>
                            <button type="button" onClick={addEvent} className="mt-3 flex items-center text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-50 transition"><Plus className="w-4 h-4 mr-1"/> Termin hinzufügen</button>
                        </div>
                    )}

                    {/* Platform: Termine mit Buchungsschutz */}
                    {bookingType === 'platform' && (
                        <div className="border border-gray-200 rounded-xl p-4">
                            <h3 className="text-base font-bold text-gray-800 flex items-center mb-1"><Calendar className="w-4 h-4 mr-2 text-gray-500" /> Termine &amp; Standorte</h3>
                            <p className="text-xs text-gray-500 mb-1">Datum und Ort sind für Direktbuchungen erforderlich. Wähle das Datum über das Kalenderfeld.</p>
                            <p className="text-xs text-amber-600 mb-4">Termine mit bestehenden Buchungen sind gesperrt. Vergangene gebuchte Termine werden automatisch archiviert.</p>
                            <div className="space-y-4">
                                {archivedBookedEvents.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                        {archivedBookedEvents.length} vergangene(r) Termin(e) mit Buchungen wurden archiviert und bleiben im Hintergrund erhalten.
                                    </div>
                                )}
                                {visibleEvents.map((ev, i) => {
                                    const originalIndex = events.indexOf(ev);
                                    const isLockedEvent = (ev.bookingCount || 0) > 0;
                                    const evType = ev.type || 'presence';
                                    return (
                                    <div key={ev.id || i} className={`bg-gray-50 p-4 rounded-lg border flex flex-col gap-3 ${isLockedEvent ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}>
                                        {isLockedEvent && (
                                            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                Dieser Termin hat bereits {ev.bookingCount} Buchung{ev.bookingCount === 1 ? '' : 'en'} und ist deshalb nicht mehr veränderbar.
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Datum *</label>
                                                <input type="date" disabled={isLockedEvent} required value={ev.start_date} onChange={e => updateEvent(originalIndex, 'start_date', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <div className="flex justify-between items-baseline">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Zeit / Details (Optional)</label>
                                                    <CharCount value={ev.schedule_description} max={COURSE_FIELD_LIMITS.scheduleDescription} />
                                                </div>
                                                <input type="text" disabled={isLockedEvent} value={ev.schedule_description} maxLength={COURSE_FIELD_LIMITS.scheduleDescription} onChange={e => updateEvent(originalIndex, 'schedule_description', e.target.value)} placeholder="z.B. Sa & So, 09:00 - 17:00" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" />
                                            </div>
                                        </div>
                                        {/* Toggle für Ort */}
                                        {!isLockedEvent && (
                                            <button
                                                type="button"
                                                onClick={() => updateEvent(originalIndex, 'showLoc', !ev.showLoc)}
                                                className="self-start text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition"
                                            >
                                                {ev.showLoc ? 'Ort ausblenden' : 'Ort angeben / ändern'}
                                            </button>
                                        )}
                                        {/* Adressfelder */}
                                        {(ev.showLoc || isLockedEvent) && (
                                            <div className="space-y-3">
                                                <div className="flex gap-2">
                                                    {[
                                                        { value: 'presence', label: 'Präsenz' },
                                                        { value: 'online',   label: 'Online'  },
                                                        { value: 'ausland',  label: 'Ausland' }
                                                    ].map(({ value, label }) => (
                                                        <button key={value} type="button" disabled={isLockedEvent}
                                                            onClick={() => !isLockedEvent && updateEvent(originalIndex, 'type', value)}
                                                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${evType === value ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'} ${isLockedEvent ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {evType === 'presence' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                        <div className="md:col-span-5">
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Strasse / Nr. *</label>
                                                            <input type="text" disabled={isLockedEvent} required value={ev.street} onChange={e => updateEvent(originalIndex, 'street', e.target.value)} placeholder="Musterstrasse 12" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" />
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            <label className="text-xs font-bold text-gray-500 uppercase">PLZ / Ort *</label>
                                                            <input type="text" disabled={isLockedEvent} required value={ev.city} onChange={e => updateEvent(originalIndex, 'city', e.target.value)} placeholder="8000 Zürich" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" />
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Kanton *</label>
                                                            <select disabled={isLockedEvent} required value={ev.canton} onChange={e => updateEvent(originalIndex, 'canton', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500">
                                                                <option value="">Bitte wählen…</option>
                                                                {SWISS_CANTONS.filter(c => c !== "Ausland" && c !== "Online").map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Plätze</label>
                                                            <input type="number" disabled={isLockedEvent} min="0" value={ev.max_participants} onChange={e => updateEvent(originalIndex, 'max_participants', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" title="0 = Unbegrenzt" />
                                                        </div>
                                                    </div>
                                                )}
                                                {evType === 'online' && (
                                                    <div className="flex items-center gap-4">
                                                        <p className="text-sm text-gray-500 flex-1">Kurs findet online statt — keine Adresse erforderlich.</p>
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Plätze</label>
                                                            <input type="number" disabled={isLockedEvent} min="0" value={ev.max_participants} onChange={e => updateEvent(originalIndex, 'max_participants', e.target.value)} className="w-32 px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" title="0 = Unbegrenzt" />
                                                        </div>
                                                    </div>
                                                )}
                                                {evType === 'ausland' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                        <div className="md:col-span-10">
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Adresse im Ausland (Optional)</label>
                                                            <input type="text" disabled={isLockedEvent} value={ev.location_abroad || ''} onChange={e => updateEvent(originalIndex, 'location_abroad', e.target.value)} placeholder="z.B. München, Deutschland" className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" />
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Plätze</label>
                                                            <input type="number" disabled={isLockedEvent} min="0" value={ev.max_participants} onChange={e => updateEvent(originalIndex, 'max_participants', e.target.value)} className="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-gray-500" title="0 = Unbegrenzt" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!ev.showLoc && !isLockedEvent && (
                                            <p className="text-xs text-gray-400 italic">Kein spezifischer Ort angegeben — du kannst einen Ort über den Link oben angeben.</p>
                                        )}
                                        <button type="button" disabled={isLockedEvent} onClick={() => removeEvent(originalIndex)} className="text-red-500 text-xs hover:underline flex items-center self-end disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 className="w-3 h-3 mr-1" /> Entfernen</button>
                                    </div>
                                    );
                                })}
                            </div>
                            <button type="button" onClick={addEvent} className="mt-3 flex items-center text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-50 transition"><Plus className="w-4 h-4 mr-1"/> Termin hinzufügen</button>
                        </div>
                    )}
                </div>


                {/* === ABSCHNITT 5: WEITERE DETAILS (collapsible) === */}
                <div className="border-t border-gray-100 pt-2">
                    <button
                        type="button"
                        onClick={() => setShowOptionalDetails(v => !v)}
                        className="flex items-center justify-between w-full text-left"
                    >
                        <div>
                            <h2 className="text-lg font-bold text-dark">5. Weitere Details <span className="text-gray-400 text-sm font-normal ml-1">(optional)</span></h2>
                            <p className="text-sm text-gray-500 mt-0.5">Dauer, Niveau, Sprachen, Lernziele, Voraussetzungen, Mindestalter, Webseite.</p>
                        </div>
                        {showOptionalDetails ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0 ml-4" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 ml-4" />}
                    </button>
                </div>
                {showOptionalDetails && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <label className="text-sm font-bold text-gray-700">Dauer &amp; Umfang</label>
                                <CharCount value={sessionLength} max={COURSE_FIELD_LIMITS.sessionLength} />
                            </div>
                            <input type="text" name="sessionLength" value={sessionLength} maxLength={COURSE_FIELD_LIMITS.sessionLength} onChange={(e) => { setSessionLength(e.target.value); markDirty(); }} placeholder="z.B. 10 Lektionen à 1 Stunde, 1 Wochenende oder 4 Abende à 2 Stunden" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Niveau</label>
                            <select
                                value={selectedLevel}
                                onChange={(e) => { setSelectedLevel(e.target.value); markDirty(); }}
                                className="w-full md:w-1/2 px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary outline-none"
                            >
                                {Object.entries(COURSE_LEVELS).map(([key, val]) => (
                                    <option key={key} value={key}>{val.de}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Kurssprache</label>
                            <div className="flex flex-wrap gap-3">
                                {Object.keys(COURSE_LANGUAGES).map(lang => (
                                    <label key={lang} className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer text-sm transition ${courseLanguages.includes(lang) ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}>
                                        <input
                                            type="checkbox"
                                            value={lang}
                                            checked={courseLanguages.includes(lang)}
                                            onChange={() => { setCourseLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]); markDirty(); }}
                                            className="hidden"
                                        />
                                        {lang}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <label className="text-sm font-bold text-gray-700">Lernziele</label>
                                <CharCount value={objectives} max={COURSE_FIELD_LIMITS.objectives} />
                            </div>
                            <p className="text-xs text-gray-500 mb-2">Was lernen Teilnehmende in diesem Kurs? Ein Lernziel pro Zeile.</p>
                            <textarea
                                name="objectives"
                                value={objectives}
                                maxLength={COURSE_FIELD_LIMITS.objectives}
                                onChange={(e) => { setObjectives(e.target.value); markDirty(); }}
                                rows={3}
                                placeholder={"z.B. Du kannst nach dem Kurs sicher auf dem Snowboard fahren\nDu kennst die grundlegenden Techniken"}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <label className="text-sm font-bold text-gray-700">Voraussetzungen</label>
                                <CharCount value={prerequisites} max={COURSE_FIELD_LIMITS.prerequisites} />
                            </div>
                            <textarea
                                name="prerequisites"
                                value={prerequisites}
                                maxLength={COURSE_FIELD_LIMITS.prerequisites}
                                onChange={(e) => { setPrerequisites(e.target.value); markDirty(); }}
                                rows={2}
                                placeholder="z.B. Grundkenntnisse in Excel, keine Vorkenntnisse nötig"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
                            />
                        </div>
                        {!isKinder && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Mindestalter <span className="text-gray-400 font-normal">(optional)</span></label>
                                <input
                                    type="number" min="0"
                                    value={minAge}
                                    onChange={(e) => { setMinAge(e.target.value); markDirty(); }}
                                    placeholder="Leer = kein Mindestalter"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Webseite</label>
                            <input type="url" name="providerUrl" value={providerUrl} onChange={(e) => { setProviderUrl(e.target.value); markDirty(); }} placeholder="https://..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                    </div>
                )}

                {/* === KINDERKURS-EINSTELLUNGEN (nur wenn isKinder) === */}
                {isKinder && (
                    <div className="border-t border-gray-100 pt-4">
                        <h2 className="text-lg font-bold text-dark mb-2">Kinderkurs-Einstellungen</h2>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Mindestalter <span className="text-red-500">*</span></label>
                            <input
                                type="number" min="0" max="18"
                                value={minAge}
                                onChange={(e) => { setMinAge(e.target.value); markDirty(); }}
                                placeholder="z.B. 6"
                                className="w-full md:w-1/3 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">Ab welchem Alter ist der Kurs geeignet?</p>
                        </div>
                    </div>
                )}

                {/* === ABSCHNITT 6: VERÖFFENTLICHUNG === */}
                <div className="border-t border-gray-100 pt-2">
                    <h2 className="text-lg font-bold text-dark">6. Veröffentlichung</h2>
                </div>
                {missingRequiredFields.length > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-amber-800 mb-2">Veröffentlichen ist noch nicht möglich. Es fehlen:</p>
                        <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                            {missingRequiredFields.map(f => <li key={f}>{f}</li>)}
                        </ul>
                    </div>
                ) : (
                    <p className="text-sm text-green-700 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Alle Pflichtfelder sind ausgefüllt.
                    </p>
                )}
                <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-end flex-wrap">
                    {/* Save button: "Als Entwurf speichern" for new courses, "Änderungen speichern" when editing */}
                    <button
                        type="button"
                        data-testid="save-course"
                        disabled={isSubmitting}
                        onClick={() => { pendingStatusRef.current = initialData?.id ? null : 'draft'; formRef.current?.requestSubmit(); }}
                        className="px-8 py-3 rounded-xl font-bold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition flex items-center justify-center font-heading disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {initialData?.id ? 'Änderungen speichern' : 'Als Entwurf speichern'}
                    </button>
                    {/* Preview button: only active when course already exists (has ID) */}
                    {/* Publish button: disabled when fields missing; only for new courses or drafts */}
                    {(!initialData?.id || courseStatus === 'draft') && (
                        <button
                            type="button"
                            disabled={isSubmitting || missingRequiredFields.length > 0}
                            onClick={() => { pendingStatusRef.current = 'published'; formRef.current?.requestSubmit(); }}
                            className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 shadow-lg hover:-translate-y-0.5 transition flex items-center justify-center font-heading disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader className="animate-spin w-5 h-5 mr-2 text-white" /> : <KursNaviLogo className="w-5 h-5 mr-2 text-white" />}
                            Jetzt veröffentlichen
                        </button>
                    )}
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

        {/* Unsaved Changes Confirmation Modal */}
        {showUnsavedChangesModal && (
            <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                    <h3 id="unsaved-changes-title" className="text-lg font-bold mb-3">Ungespeicherte Änderungen</h3>
                    <p className="text-gray-600 mb-6">
                        Du hast ungespeicherte Änderungen. Möchtest du wirklich zurückgehen? Deine Änderungen gehen verloren.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowUnsavedChangesModal(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="button"
                            onClick={confirmDiscardChanges}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition"
                        >
                            Änderungen verwerfen
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
};

export default TeacherForm;
