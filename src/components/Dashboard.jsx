import React, { useState, useEffect } from 'react';
import { formatPriceCHF } from '../lib/formatPrice';
import {
    Loader, Settings, Save, Lock, CheckCircle, XCircle, Clock,
    ChevronDown, User, DollarSign, PenTool, Trash2, ArrowRight, Plus, MapPin,
    Crown, BarChart3,
    CreditCard, Check, Shield, ExternalLink, Play, Pause, FileEdit, Info, Star, AlertCircle,
    Eye, EyeOff, Calendar, ChevronRight, Ban, Download
} from 'lucide-react';
import { SWISS_CANTONS, CATEGORY_TYPES, NEW_TAXONOMY, CATEGORY_LABELS } from "../lib/constants";
import { PLANS } from "../constants/plans";

import { DEFAULT_COURSE_IMAGE } from '../lib/imageUtils';
const fallbackImage = DEFAULT_COURSE_IMAGE;
import { KursNaviLogo } from './Layout';
import { supabase } from '../lib/supabase';
import { useTaxonomy } from '../hooks/useTaxonomy';
import ProviderProfileEditor from './ProviderProfileEditor';
import AnalyticsDashboard from './AnalyticsDashboard';
import PlanCardGrid from './PlanCardGrid';

// --- HELPER COMPONENT: User Profile Settings ---
const UserProfileSection = ({ user, setUser, showNotification, setLang, t, isImpersonating }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState('none'); // none, pending, verified
    const isTeacher = user?.role === 'teacher';
    const [authUid, setAuthUid] = useState(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const { data } = await supabase.auth.getUser();
            if (!cancelled) setAuthUid(data?.user?.id || null);
        })();

        return () => { cancelled = true; };
    }, []);

    const uid = isImpersonating ? user?.id : (authUid || user?.id);

    
    const [formData, setFormData] = useState({
        full_name: '', city: '', canton: '', bio_text: '', certificates: '', preferred_language: 'de', email: user.email, password: '', confirmPassword: '',
        website_url: ''
    });
    const [additionalLocations, setAdditionalLocations] = useState([]);
    const [stripeCustomerId, setStripeCustomerId] = useState(null);
    const [stripeConnectAccountId, setStripeConnectAccountId] = useState(null);
    const [stripeConnectOnboardingComplete, setStripeConnectOnboardingComplete] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Data export state
    const [exporting, setExporting] = useState(false);

    // Check for Stripe Connect return and update status
    useEffect(() => {
        if (!uid) return;
        const urlParams = new URLSearchParams(window.location.search);
        const connectStatus = urlParams.get('connect');

        if (connectStatus === 'success') {
            // User returned from Stripe onboarding - check and update status
            (async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) return;
                    const response = await fetch('/api/stripe-management', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            action: 'check_connect_status'
                        })
                    });
                    const data = await response.json();
                    if (data.onboardingComplete) {
                        setStripeConnectOnboardingComplete(true);
                        showNotification("Auszahlungskonto erfolgreich eingerichtet!", "success");
                    }
                } catch (error) {
                    console.error('Error checking connect status:', error);
                }
                // Clean up URL
                window.history.replaceState({}, '', window.location.pathname);
            })();
        }
    }, [uid]);

    // Load existing profile data on mount
    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        setLoading(true);

        (async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, city, canton, bio_text, certificates, preferred_language, additional_locations, website_url, verification_status, stripe_customer_id, stripe_connect_account_id, stripe_connect_onboarding_complete')
                .eq('id', uid)
                .single();

            if (cancelled) return;
            setLoading(false);

            if (error) {
                console.warn('Failed to load profile:', error.message);
                return;
            }

            if (data) {
                setFormData(prev => ({
                    ...prev,
                    full_name: data.full_name || '',
                    city: data.city || '',
                    canton: data.canton || '',
                    bio_text: data.bio_text || '',
                    certificates: Array.isArray(data.certificates) ? data.certificates.join('\n') : '',
                    preferred_language: data.preferred_language || 'de',
                    website_url: data.website_url || ''
                }));
                // Parse additional_locations (JSON array or legacy comma string)
                if (data.additional_locations) {
                    try {
                        const parsed = JSON.parse(data.additional_locations);
                        if (Array.isArray(parsed)) setAdditionalLocations(parsed);
                    } catch {
                        // Legacy: comma-separated string -> convert to structured format
                        const items = data.additional_locations.split(',').map(s => s.trim()).filter(Boolean);
                        setAdditionalLocations(items.map(city => ({ city, canton: '' })));
                    }
                }
                setVerificationStatus(data.verification_status || 'none');
                setStripeCustomerId(data.stripe_customer_id || null);
                setStripeConnectAccountId(data.stripe_connect_account_id || null);
                setStripeConnectOnboardingComplete(data.stripe_connect_onboarding_complete || false);
            }
        })();

        return () => { cancelled = true; };
    }, [uid]);

    const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

    const handleDeleteAccount = async () => {
        if (!deletePassword) return;

        try {
            setDeleting(true);
            setDeleteError('');

            // Step 1: Verify password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: deletePassword
            });

            if (signInError) {
                setDeleteError('Falsches Passwort. Bitte versuchen Sie es erneut.');
                setDeleting(false);
                return;
            }

            // Step 2: Delete learner data
            // Delete saved courses (Merkliste)
            await supabase
                .from('saved_courses')
                .delete()
                .eq('user_id', user.id);

            // Delete bookings
            await supabase
                .from('bookings')
                .delete()
                .eq('user_id', user.id);

            // Delete profile
            await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

            // Step 3: Delete auth user via server-side API
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                const response = await fetch('/api/delete-account', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!response.ok) {
                    const result = await response.json();
                    console.error('Failed to delete auth user:', result.error);
                }
            }

            // Step 4: Sign out and redirect
            await supabase.auth.signOut();
            showNotification?.('Ihr Konto wurde erfolgreich gelöscht', 'success');
            window.location.href = '/';
        } catch (err) {
            console.error('Error deleting account:', err);
            showNotification?.('Fehler beim Löschen des Kontos: ' + (err.message || 'Unbekannter Fehler'), 'error');
            setDeleting(false);
        }
    };

    const handleExportData = async () => {
        try {
            setExporting(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                showNotification?.('Nicht authentifiziert. Bitte erneut anmelden.', 'error');
                return;
            }

            const response = await fetch('/api/export-user-data', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Export fehlgeschlagen');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kursnavi-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification?.('Daten erfolgreich exportiert', 'success');
        } catch (err) {
            console.error('Export error:', err);
            showNotification?.('Fehler beim Exportieren: ' + (err.message || 'Unbekannter Fehler'), 'error');
        } finally {
            setExporting(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        
          // UPDATE: Profile fields (Students vs. Teacher)
        const profileUpdates = {
            full_name: formData.full_name,
            city: formData.city,
            canton: formData.canton,
            preferred_language: formData.preferred_language
        };

        if (isTeacher) {
            // Convert textarea string back to array for DB
            const certArray = (formData.certificates || '')
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean);

            // Ensure Website URL starts with https:// if provided
            let formattedUrl = formData.website_url?.trim() || '';
            if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                formattedUrl = `https://${formattedUrl}`;
            }

            const validLocations = additionalLocations.filter(loc => loc.city.trim());
            profileUpdates.additional_locations = validLocations.length > 0 ? JSON.stringify(validLocations) : '';
            profileUpdates.website_url = formattedUrl;
            profileUpdates.bio_text = formData.bio_text;
            profileUpdates.certificates = certArray;
        }

        const { error } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', uid);


        
        if (error) { showNotification("Error saving profile"); setSaving(false); return; }

        // Update auth metadata with new name
        if (formData.full_name) {
            await supabase.auth.updateUser({
                data: { full_name: formData.full_name }
            });
        }

        // For teachers: update instructor_name on all their courses
        if (isTeacher && formData.full_name) {
            await supabase
                .from('courses')
                .update({ instructor_name: formData.full_name })
                .eq('user_id', uid);
        }

        if (formData.email !== user.email || formData.password) {
            if (formData.password && formData.password !== formData.confirmPassword) { showNotification("Passwords do not match!"); setSaving(false); return; }
            const updates = {}; if (formData.email !== user.email) updates.email = formData.email; if (formData.password) updates.password = formData.password;
            const { error: authError } = await supabase.auth.updateUser(updates);
            if (authError) { showNotification("Error updating account: " + authError.message); } else { showNotification(t.msg_auth_success); }
        } else { showNotification("Profile saved successfully!"); }

        // Update local user state with new name
        if (formData.full_name && setUser) {
            setUser(prev => prev ? { ...prev, name: formData.full_name } : prev);
        }

        setLang(formData.preferred_language); setSaving(false);
    };

    const handleDocUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setUploadingDoc(true);

        const newDocUrls = [];

        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${uid}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.error("Upload failed", uploadError);
                continue; 
            }

            const { data: { signedUrl } } = await supabase.storage.from('certificates').createSignedUrl(fileName, 315360000);
            newDocUrls.push(signedUrl);
        }

        if (newDocUrls.length > 0) {
            // Get existing docs to append
            const { data: currentProfile } = await supabase
                .from('profiles')
                .select('verification_docs')
                .eq('id', uid)
                .single();
            const existingDocs = currentProfile?.verification_docs || [];
            const updatedDocs = [...existingDocs, ...newDocUrls];

            const { error: dbError } = await supabase.from('profiles').update({
                verification_docs: updatedDocs,
                verification_status: 'pending'
            }).eq('id', uid);


            if (!dbError) {
                // Notify Admin via /api/contact
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session?.access_token) {
                        fetch("/api/contact", {
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({
                                type: 'verification',
                                subject: "Neue Verifizierung (Mehrere Dateien): " + user.email,
                                message: `User: ${user.email}\nAnzahl Dateien: ${newDocUrls.length}\nBitte im Admin Panel prüfen.`
                            })
                        }).catch(err => console.error("Contact API failed", err));
                    }
                }).catch(err => console.error("Session check failed", err));

                setVerificationStatus('pending');
                showNotification(`${newDocUrls.length} Datei(en) erfolgreich hochgeladen.`);
            }
        }
        setUploadingDoc(false);
    };

    if (loading) return <div className="p-8 text-center"><Loader className="animate-spin w-8 h-8 text-primary mx-auto"/></div>;
    
    return (
    <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm animate-in fade-in">
        <h2 className="text-xl font-bold mb-6 text-dark flex items-center"><Settings className="w-5 h-5 mr-2 text-gray-500" /> {t?.profile_settings || "Profil-Einstellungen"}</h2>
            <form onSubmit={handleSave} className="space-y-6 w-full max-w-none">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{isTeacher ? "Anbieter- / Anzeigename" : "Name"}</label>
                    <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="z.B. Max Mustermann oder Firma GmbH" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                    {isTeacher && <p className="text-xs text-gray-400 mt-1 italic">Dieser Name wird auf deinem Profil und bei deinen Kursen angezeigt.</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{isTeacher ? (t?.lbl_main_location || "Hauptstandort") : "Standort"}</label><input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_canton}</label><div className="relative"><select name="canton" value={formData.canton} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="">Kanton wählen</option>{SWISS_CANTONS.filter(c => c !== "Online").map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                </div>
                {isTeacher && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                                <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                                {t?.lbl_additional_locations || "Weitere Standorte"}
                            </label>
                            <div className="space-y-2">
                                {additionalLocations.map((loc, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={loc.city}
                                            onChange={(e) => {
                                                const updated = [...additionalLocations];
                                                updated[idx] = { ...updated[idx], city: e.target.value };
                                                setAdditionalLocations(updated);
                                            }}
                                            placeholder="Stadt / Ort"
                                            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                        />
                                        <div className="relative">
                                            <select
                                                value={loc.canton}
                                                onChange={(e) => {
                                                    const updated = [...additionalLocations];
                                                    updated[idx] = { ...updated[idx], canton: e.target.value };
                                                    setAdditionalLocations(updated);
                                                }}
                                                className="w-40 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"
                                            >
                                                <option value="">Kanton</option>
                                                {SWISS_CANTONS.filter(c => c !== "Online").map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAdditionalLocations(additionalLocations.filter((_, i) => i !== idx))}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="Standort entfernen"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setAdditionalLocations([...additionalLocations, { city: '', canton: '' }])}
                                className="mt-2 text-sm font-bold text-primary hover:text-orange-600 flex items-center gap-1 transition"
                            >
                                <Plus className="w-4 h-4" /> Standort hinzufügen
                            </button>
                            <p className="text-xs text-gray-400 mt-1 italic">Tipp: Falls du Kurse an verschiedenen Orten anbietest, liste diese hier auf.</p>
                        </div>

                        <div className="pt-2">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Unternehmens-Website</label>
                                <div className="relative">
                                    <input type="text" name="website_url" value={formData.website_url || ''} onChange={handleChange} placeholder="z.B. www.deine-seite.ch" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                                    <ExternalLink className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </>
                )}


                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_language}</label>
                    <div className="relative">
                        <select name="preferred_language" value={formData.preferred_language} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white">
                            <option value="de">Deutsch (German)</option>
                            <option value="en">English</option>
                            <option value="fr">Français (French)</option>
                            <option value="it">Italiano (Italian)</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                </div>

                {isTeacher && (
                    <>
                        {/* NEW FIELDS: Biography & Certificates */}

                <div className="border-t pt-6 mt-6">
                    <h3 className="text-lg font-bold mb-4 text-dark flex items-center"><User className="w-5 h-5 mr-2 text-primary" /> {t?.lbl_bio || "Über mich / uns (Bio / Anbietervorstellung)"}</h3>
                    <div className="space-y-6">
                        <div>
                            <textarea
                                name="bio_text"
                                rows="5"
                                value={formData.bio_text}
                                onChange={handleChange}
                                placeholder="Erzähle etwas über deine Erfahrung..."
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y block bg-gray-50 focus:bg-white transition-colors"
                            ></textarea>
                        </div>
                        <div className="pt-4">
                            <h3 className="text-lg font-bold mb-4 text-dark flex items-center"><PenTool className="w-5 h-5 mr-2 text-primary" /> {t?.lbl_qualifications || "Zertifikate & Qualifikationen"}</h3>
                            <textarea name="certificates" rows="3" value={formData.certificates} onChange={handleChange} placeholder="z.B. Master in Pädagogik&#10;Dipl. Yoga Instruktor..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50 focus:bg-white transition-colors"></textarea>
                        </div>
                    </div>
                </div>

                    </>
                )}

                {/* VERIFICATION SECTION */}

                {user.role === 'teacher' && (
                    <div className="border-t pt-6 mt-6">
                        <h3 className="text-lg font-bold mb-4 text-blue-600 flex items-center"><Shield className="w-4 h-4 mr-2" /> Verification</h3>
                        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="bg-white p-2 rounded-full shadow-sm"><CheckCircle className="w-6 h-6 text-blue-500" /></div>
                                <div>
                                    <h4 className="font-bold text-dark">Get Verified (CHF 75.00)</h4>
                                    <p className="text-sm text-gray-600 mt-1">Upload your diplomas/certificates to receive the "Verified" badge and boost your bookings.</p>
                                </div>
                            </div>

                            {verificationStatus === 'verified' ? (
                            <div className="bg-green-100 text-green-800 px-4 py-6 rounded-xl flex flex-col items-center justify-center font-bold text-center">
                                <CheckCircle className="w-12 h-12 mb-2 text-green-600" /> 
                                <span className="text-lg">Dein Account ist verifiziert!</span>
                                <p className="text-sm font-normal text-green-700 mt-1">Dein Profil trägt jetzt den Status "Verifiziert".</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {verificationStatus === 'pending' ? (
                                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl animate-in fade-in">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Clock className="w-5 h-5 text-yellow-600" />
                                                <h4 className="font-bold text-yellow-800">Verifizierung in Bearbeitung</h4>
                                            </div>
                                            <p className="text-sm text-yellow-700 mb-4">Wir haben deine Dokumente erhalten. Bitte stelle sicher, dass du die Gebühr beglichen hast, damit wir die Prüfung abschliessen können.</p>
                                            
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const to = "info@kursnavi.ch";
                                                        const subject = "Verifizierung: Zahlung";
                                                        const body = [
                                                            "Hallo KursNavi Team",
                                                            "",
                                                            "ich möchte die Verifizierung abschliessen. Bitte sendet mir die Zahlungsinfos/Rechnung.",
                                                            "",
                                                            `Account E-Mail: ${user?.email || ""}`,
                                                            "",
                                                            "Danke & Gruss"
                                                        ].join("\n");

                                                        const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

                                                        if (navigator?.clipboard?.writeText) {
                                                            navigator.clipboard.writeText(to).catch(() => {});
                                                        }

                                                        window.location.href = mailto;
                                                    }}
                                                    className="bg-dark text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition text-center"
                                                >
                                                    Zahlung per E-Mail anfragen
                                                </button>

                                                <label className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition text-center cursor-pointer">
                                                    Weitere Dateien hochladen
                                                    <input type="file" multiple onChange={handleDocUpload} disabled={uploadingDoc} className="hidden" />
                                                </label>
                                            </div>
                                            {uploadingDoc && <p className="text-xs text-blue-500 mt-2 text-center">Lade hoch...</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Schritt 1: Nachweis hochladen</label>
                                                <div className="relative">
                                                    <input type="file" multiple onChange={handleDocUpload} disabled={uploadingDoc} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer bg-white border rounded-lg p-1" />
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">Du kannst mehrere Dateien auswählen (Zertifikate, Diplome, Ausweis).</p>
                                                {uploadingDoc && <p className="text-xs text-blue-500 mt-1">Upload läuft...</p>}
                                            </div>
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {/* STRIPE CONNECT - Auszahlungen für Anbieter */}
                {isTeacher && (
                    <div className="border-t pt-6 mt-6">
                        <h3 className="text-lg font-bold mb-4 text-dark flex items-center">
                            <CreditCard className="w-4 h-4 mr-2" /> Auszahlungen einrichten
                        </h3>

                        {stripeConnectOnboardingComplete ? (
                            <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                                <div className="flex items-start gap-4">
                                    <CheckCircle className="w-6 h-6 text-green-600 mt-1 shrink-0"/>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-green-900 mb-2">Auszahlungen aktiviert</h4>
                                        <p className="text-sm text-green-800 mb-4">
                                            Dein Auszahlungskonto ist eingerichtet. Du kannst jetzt Zahlungen von Kursbuchungen empfangen.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch('/api/stripe-management', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            action: 'connect_dashboard_link',
                                                            accountId: stripeConnectAccountId
                                                        })
                                                    });
                                                    const data = await response.json();

                                                    if (data.url) {
                                                        window.open(data.url, '_blank');
                                                    } else {
                                                        showNotification("Fehler beim Öffnen des Dashboards");
                                                    }
                                                } catch (error) {
                                                    console.error('Error opening connect dashboard:', error);
                                                    showNotification("Fehler beim Öffnen des Dashboards");
                                                }
                                            }}
                                            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition shadow-md text-sm"
                                        >
                                            Auszahlungs-Dashboard öffnen
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                                <div className="flex items-start gap-4">
                                    <AlertCircle className="w-6 h-6 text-orange-600 mt-1 shrink-0"/>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-orange-900 mb-2">Bankverbindung hinterlegen</h4>
                                        <p className="text-sm text-orange-800 mb-4">
                                            Um Zahlungen von Kursbuchungen zu empfangen, musst du deine Bankdaten bei Stripe hinterlegen.
                                            Dies ist einmalig und dauert nur wenige Minuten.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!uid || !user?.email) {
                                                    showNotification("Bitte melde dich erneut an und versuche es nochmal.");
                                                    return;
                                                }
                                                try {
                                                    const response = await fetch('/api/stripe-management', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            action: 'create_connect_account',
                                                            userId: uid,
                                                            userEmail: user.email
                                                        })
                                                    });
                                                    const data = await response.json();

                                                    if (data.url) {
                                                        window.location.href = data.url;
                                                    } else {
                                                        console.error('Stripe connect error:', data);
                                                        showNotification(data.error || "Fehler beim Erstellen des Onboarding-Links");
                                                    }
                                                } catch (error) {
                                                    console.error('Error creating connect account:', error);
                                                    showNotification("Fehler beim Erstellen des Kontos");
                                                }
                                            }}
                                            className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition shadow-md text-sm"
                                        >
                                            Jetzt einrichten
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* BILLING MANAGEMENT - Only for teachers with customer ID */}
                {isTeacher && stripeCustomerId && (
                    <div className="border-t pt-6 mt-6">
                        <h3 className="text-lg font-bold mb-4 text-dark flex items-center">
                            <CreditCard className="w-4 h-4 mr-2" /> Rechnungen & Zahlungsdaten
                        </h3>
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                            <div className="flex items-start gap-4">
                                <CreditCard className="w-6 h-6 text-blue-600 mt-1 shrink-0"/>
                                <div className="flex-1">
                                    <h4 className="font-bold text-blue-900 mb-2">Rechnungen & Verwaltung</h4>
                                    <p className="text-sm text-blue-800 mb-4">
                                        Verwalte deine Zahlungsdaten und lade Rechnungen herunter.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                if (!stripeCustomerId) {
                                                    showNotification("Du hast noch keine Zahlungen getätigt. Der Zugang zum Kundenportal ist nach der ersten Zahlung verfügbar.");
                                                    return;
                                                }

                                                const response = await fetch('/api/stripe-management', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        action: 'create_customer_portal',
                                                        customerId: stripeCustomerId
                                                    })
                                                });
                                                const data = await response.json();

                                                if (data.error) {
                                                    showNotification("Fehler: " + data.error);
                                                    return;
                                                }

                                                if (data.url) {
                                                    window.location.href = data.url;
                                                } else {
                                                    showNotification("Fehler beim Öffnen des Kundenportals");
                                                }
                                            } catch (error) {
                                                console.error('Error opening customer portal:', error);
                                                showNotification("Fehler beim Öffnen des Kundenportals");
                                            }
                                        }}
                                        className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition shadow-md text-sm"
                                    >
                                        Zahlungsdaten verwalten
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isImpersonating && (
                <div className="border-t pt-6 mt-6"><h3 className="text-lg font-bold mb-4 text-dark flex items-center"><Lock className="w-4 h-4 mr-2" /> {t.lbl_account_security}</h3><div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_new_password}</label><div className="relative"><input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_confirm_password}</label><div className="relative"><input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div></div></div></div></div>
                )}
                <div className="pt-2"><button type="submit" disabled={saving || isImpersonating} title={isImpersonating ? 'Profil-Änderungen sind bei Impersonation nicht möglich' : ''} className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 transition flex items-center shadow-md disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">{saving ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}{t.btn_save}</button></div>
            </form>

            {/* Data Export Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mt-8">
                <h3 className="text-lg font-bold text-dark mb-4 flex items-center">
                    <Download className="w-5 h-5 mr-2" />
                    Daten exportieren
                </h3>
                <p className="text-gray-600 mb-4">
                    Laden Sie eine Kopie Ihrer gespeicherten Daten als JSON-Datei herunter. Der Export enthält:
                </p>
                <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1 text-sm">
                    <li>Ihr Profil und Einstellungen</li>
                    <li>Buchungen und Kurshistorie</li>
                    <li>Merkliste (gespeicherte Kurse)</li>
                    {user?.role === 'teacher' && <li>Lead-Anfragen (als Anbieter)</li>}
                </ul>
                <button
                    type="button"
                    onClick={handleExportData}
                    disabled={exporting}
                    className="px-4 py-2 bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                    {exporting ? (
                        <>
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                            Wird exportiert...
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 mr-2" />
                            Daten herunterladen
                        </>
                    )}
                </button>
            </div>

            {/* Delete Account Section — hidden during impersonation */}
            {!isImpersonating && (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 md:p-8 mt-8">
                <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
                    <Trash2 className="w-5 h-5 mr-2" />
                    Konto löschen
                </h3>
                <p className="text-gray-600 mb-4">
                    Wenn Sie Ihr Konto löschen, werden alle Ihre Daten unwiderruflich entfernt. Dies umfasst:
                </p>
                <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1 text-sm">
                    <li>Ihr Profil und alle Einstellungen</li>
                    <li>Ihre Merkliste und gespeicherte Kurse</li>
                    <li>Buchungsdaten und Kurshistorie</li>
                    {user?.credit_balance_cents > 0 && (
                        <li className="text-red-600 font-medium">Ihr Guthaben von CHF {(user.credit_balance_cents / 100).toFixed(2)} verfällt unwiderruflich</li>
                    )}
                </ul>
                <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Konto unwiderruflich löschen
                </button>
            </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle className="w-6 h-6 text-red-600" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 id="delete-modal-title" className="text-lg font-bold text-gray-900">Konto löschen?</h3>
                                <p className="text-sm text-gray-500">Diese Aktion kann nicht rückgängig gemacht werden</p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-red-700">
                                <strong>Achtung:</strong> Alle Ihre Daten werden permanent gelöscht, einschliesslich Ihrer Merkliste, Buchungen und Ihres Profils.
                            </p>
                            {user?.credit_balance_cents > 0 && (
                                <p className="text-sm text-red-700 mt-2 font-semibold">
                                    Ihr Guthaben von CHF {(user.credit_balance_cents / 100).toFixed(2)} verfällt bei Kontolöschung unwiderruflich.
                                </p>
                            )}
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Geben Sie Ihr Passwort ein, um zu bestätigen:
                            </label>
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => {
                                    setDeletePassword(e.target.value);
                                    setDeleteError('');
                                }}
                                placeholder="Ihr Passwort"
                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none ${
                                    deleteError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                }`}
                                autoComplete="current-password"
                            />
                            {deleteError && (
                                <p className="text-sm text-red-600 mt-2">{deleteError}</p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeletePassword('');
                                    setDeleteError('');
                                }}
                                disabled={deleting}
                                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={!deletePassword || deleting}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {deleting ? (
                                    <>
                                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                                        Wird gelöscht...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Endgültig löschen
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- HELPER COMPONENT: Subscription Management ---
const SubscriptionSection = ({ user, currentTier, packageExpiresAt, checkoutLoading, setCheckoutLoading, showNotification }) => {
    // Stripe Checkout für alle bezahlten Pakete (Pro/Premium/Enterprise)
    const handleCheckout = async (tierId) => {
        setCheckoutLoading(tierId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Bitte melde dich erneut an.');
            }

            const res = await fetch('/api/create-package-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    targetTier: tierId,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Checkout fehlgeschlagen');
            }

            window.location.href = data.url;
        } catch (err) {
            console.error('Package checkout error:', err);
            showNotification(err.message || 'Fehler beim Checkout. Bitte versuche es erneut.', 'error');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const tierOrder = ['basic', 'pro', 'premium', 'enterprise'];

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-2xl font-bold mb-2 flex items-center"><Crown className="w-6 h-6 mr-2 text-primary"/> Dein Abo-Status</h2>
                <p className="text-gray-600 mb-6">
                    Du nutzt aktuell das <span className="font-bold text-dark">{(PLANS.find(p => p.id === currentTier) || PLANS[0]).title}</span> Paket.
                    {packageExpiresAt && currentTier !== 'basic' && (
                        <span className="text-sm text-gray-400 ml-2">
                            (gültig bis {new Date(packageExpiresAt).toLocaleDateString('de-CH')})
                        </span>
                    )}
                </p>

                <PlanCardGrid
                    currentTier={currentTier}
                    renderAction={({ plan, colors, isCurrent }) => {
                        const isUpgrade = tierOrder.indexOf(plan.id) > tierOrder.indexOf(currentTier);
                        const isPaidCurrent = isCurrent && plan.id !== 'basic' && packageExpiresAt;

                        if (isPaidCurrent) {
                            return (
                                <div>
                                    <div className="mb-2 text-center text-xs text-gray-500">
                                        Gültig bis: {new Date(packageExpiresAt).toLocaleDateString('de-CH')}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCheckout(plan.id)}
                                        disabled={!!checkoutLoading}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 font-bold text-white shadow-md transition hover:bg-green-700"
                                    >
                                        {checkoutLoading === plan.id ? (
                                            <><Loader className="w-4 h-4 animate-spin" /> Laden...</>
                                        ) : (
                                            'Verlängern'
                                        )}
                                    </button>
                                </div>
                            );
                        }

                        if (isCurrent) {
                            return (
                                <button
                                    type="button"
                                    disabled
                                    className="w-full cursor-default rounded-lg bg-gray-200 py-2 font-bold text-gray-500"
                                >
                                    Aktueller Plan
                                </button>
                            );
                        }

                        if (isUpgrade) {
                            return (
                                <button
                                    type="button"
                                    onClick={() => handleCheckout(plan.id)}
                                    disabled={!!checkoutLoading}
                                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 font-bold shadow-md transition ${colors.btnSolid}`}
                                >
                                    {checkoutLoading === plan.id ? (
                                        <><Loader className="w-4 h-4 animate-spin" /> Laden...</>
                                    ) : (
                                        'Upgrade kaufen'
                                    )}
                                </button>
                            );
                        }

                        return (
                            <button
                                type="button"
                                disabled
                                className="w-full rounded-lg border border-gray-200 py-2 text-gray-400"
                            >
                                Nicht verfügbar
                            </button>
                        );
                    }}
                />
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT ---
// --- CAPTURE SERVICE BOOKING MODAL ---
const CaptureServiceModal = ({ isOpen, onClose, user, includedServices, usedServices, showNotification }) => {
    const [courses, setCourses] = useState([{ url: '', notes: '' }]);
    const [isLoading, setIsLoading] = useState(false);

    // Preisberechnung: 75 CHF für die ersten 3, dann 50 CHF
    // Abzüglich der noch verfügbaren inkludierten Services (von vorne angerechnet)
    const calculatePrice = () => {
        const totalCourses = courses.length;
        const availableServices = Math.max(0, includedServices - usedServices);

        // Preise für alle Kurse berechnen (ohne Rabatt)
        const prices = [];
        for (let i = 0; i < totalCourses; i++) {
            prices.push(i < 3 ? 75 : 50);
        }

        // Die ersten "availableServices" werden abgezogen (sind kostenlos)
        const paidPrices = prices.slice(availableServices);
        const total = paidPrices.reduce((sum, p) => sum + p, 0);

        return {
            total,
            freeCount: Math.min(availableServices, totalCourses),
            paidCount: Math.max(0, totalCourses - availableServices),
            breakdown: prices,
            paidBreakdown: paidPrices
        };
    };

    const pricing = calculatePrice();

    const addCourse = () => {
        setCourses([...courses, { url: '', notes: '' }]);
    };

    const removeCourse = (index) => {
        if (courses.length > 1) {
            setCourses(courses.filter((_, i) => i !== index));
        }
    };

    const updateCourse = (index, field, value) => {
        const updated = [...courses];
        updated[index][field] = value;
        setCourses(updated);
    };

    const handleSubmit = async () => {
        // Validierung: Alle URLs müssen ausgefüllt sein
        const invalidCourses = courses.filter(c => !c.url.trim());
        if (invalidCourses.length > 0) {
            showNotification('Bitte fülle alle URL-Felder aus.', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/create-capture-service-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.id,
                    userEmail: user?.email,
                    courses: courses,
                    totalAmount: pricing.total,
                    freeCount: pricing.freeCount,
                    paidCount: pricing.paidCount
                })
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else if (data.success && pricing.total === 0) {
                // Komplett kostenlos - direkt bestätigen
                showNotification('Erfassungsservice erfolgreich gebucht!', 'success');
                onClose();
            } else {
                throw new Error(data.error || 'Checkout konnte nicht erstellt werden');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            showNotification('Fehler beim Erstellen des Checkouts: ' + error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-100 to-amber-50 p-6 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-dark font-heading">Kurserfassungs-Service buchen</h2>
                            <p className="text-gray-600 mt-1">Wir erfassen deine Kurse professionell mit SEO-Optimierung</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                    </div>
                </div>

                {/* Info Banner */}
                {includedServices > 0 && (
                    <div className="bg-green-50 border-b border-green-100 px-6 py-3">
                        <p className="text-green-800 text-sm flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>
                                <strong>{Math.max(0, includedServices - usedServices)}</strong> von {includedServices} inkludierten Services noch verfügbar
                                {usedServices > 0 && <span className="text-green-600"> ({usedServices} bereits genutzt)</span>}
                            </span>
                        </p>
                    </div>
                )}

                {/* Course Form */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500 mb-4">
                        Gib für jeden Kurs die URL an (z.B. Link zu deiner Website oder einem PDF).
                        Im Notizfeld kannst du zusätzliche Informationen angeben.
                    </p>

                    {courses.map((course, index) => (
                        <div key={index} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-semibold text-dark">
                                    Kurs {index + 1}
                                    {index < pricing.freeCount ? (
                                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Inklusive</span>
                                    ) : (
                                        <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                            CHF {pricing.breakdown[index]}
                                        </span>
                                    )}
                                </span>
                                {courses.length > 1 && (
                                    <button
                                        onClick={() => removeCourse(index)}
                                        className="text-red-400 hover:text-red-600 text-sm flex items-center"
                                    >
                                        <Trash2 className="w-4 h-4 mr-1" /> Entfernen
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        URL zum Kurs <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="url"
                                        value={course.url}
                                        onChange={(e) => updateCourse(index, 'url', e.target.value)}
                                        placeholder="https://deine-website.ch/kurs oder PDF-Link"
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Notizen (optional)
                                    </label>
                                    <textarea
                                        value={course.notes}
                                        onChange={(e) => updateCourse(index, 'notes', e.target.value)}
                                        placeholder="Zusätzliche Informationen zum Kurs..."
                                        rows={2}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={addCourse}
                        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-500 hover:border-primary hover:text-primary transition flex items-center justify-center"
                    >
                        <Plus className="w-5 h-5 mr-2" /> Weiteren Kurs hinzufügen
                    </button>
                </div>

                {/* Pricing Summary */}
                <div className="bg-gray-50 border-t px-6 py-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Anzahl Kurse:</span>
                            <span>{courses.length}</span>
                        </div>
                        {pricing.freeCount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Davon inklusive:</span>
                                <span>-{pricing.freeCount} Kurse (CHF 0.-)</span>
                            </div>
                        )}
                        {pricing.paidCount > 0 && (
                            <div className="flex justify-between text-gray-600">
                                <span>Kostenpflichtig ({pricing.paidCount} Kurse):</span>
                                <span>{pricing.paidBreakdown.map(p => `CHF ${p}`).join(' + ')}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t">
                            <span>Total:</span>
                            <span className="text-primary">CHF {pricing.total}.-</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Preise: CHF 75.- pro Kurs (1-3), CHF 50.- ab dem 4. Kurs
                    </p>
                </div>

                {/* Actions */}
                <div className="p-6 border-t flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition flex items-center justify-center disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader className="w-5 h-5 animate-spin" />
                        ) : pricing.total === 0 ? (
                            <>Kostenlos buchen</>
                        ) : (
                            <>
                                <CreditCard className="w-5 h-5 mr-2" />
                                Zur Zahlung (CHF {pricing.total}.-)
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const BookingActionModal = ({
    dialog,
    onClose,
    onConfirm,
    submitting,
    reasonValue,
    setReason
}) => {
    if (!dialog) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                    <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center ${dialog.tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-dark">{dialog.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{dialog.message}</p>
                        </div>
                    </div>
                </div>

                {dialog.needsReason && (
                    <div className="px-6 py-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {dialog.reasonLabel}
                        </label>
                        <textarea
                            value={reasonValue}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                            placeholder={dialog.reasonPlaceholder || ''}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        />
                    </div>
                )}

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        className={`flex-1 px-4 py-3 rounded-xl text-white font-semibold flex items-center justify-center ${dialog.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-orange-600'} disabled:opacity-60`}
                    >
                        {submitting ? <Loader className="w-4 h-4 animate-spin" /> : dialog.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

const GoodwillDecisionModal = ({
    dialog,
    refundPercent,
    setRefundPercent,
    message,
    setMessage,
    onClose,
    onConfirm,
    submitting
}) => {
    if (!dialog) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-dark">Kulanzentscheidung treffen</h3>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{dialog.message}</p>
                </div>

                <div className="px-6 py-5 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Rückerstattung</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[0, 25, 50, 100].map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setRefundPercent(value)}
                                    className={`px-3 py-3 rounded-xl border text-sm font-bold transition ${refundPercent === value ? 'border-primary bg-orange-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                                >
                                    {value}%
                                </button>
                            ))}
                        </div>
                        {refundPercent < 100 && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                                Kulante Entscheidungen wirken sich in der Regel positiv auf das Kundenerlebnis aus. Bei weniger als 100 % kannst du optional eine kurze Erklärung mitschicken.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nachricht an den Lernenden (optional)</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            placeholder="Optional: kurze Erklärung oder Hinweis zur Entscheidung"
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center"
                    >
                        {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Entscheidung senden'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Helper: Get human-readable category label ---
// Now accepts optional dbTaxonomy parameter to look up labels from DB first
const getCategoryLabel = (key, lang = 'de', dbTaxonomy = null) => {
    if (!key) return '';

    // 0. Check DB taxonomy first (if provided)
    if (dbTaxonomy) {
        // Check types (level 1)
        for (const typeKey in dbTaxonomy) {
            if (typeKey === key) {
                // This is a type key - we need the types array for this
                // Types are handled separately via getTypeLabel
            }
            // Check areas (level 2)
            const areas = dbTaxonomy[typeKey];
            if (areas && areas[key] && areas[key].label) {
                return areas[key].label[lang] || areas[key].label['de'];
            }
            // Check specialties (level 3)
            for (const areaKey in areas) {
                const specialties = areas[areaKey]?.specialties || [];
                if (specialties.includes(key)) {
                    return key; // Specialties are stored by name
                }
            }
        }
    }

    // 1. Check legacy labels
    const legacyTranslation = (CATEGORY_LABELS || {})[key];
    if (legacyTranslation && legacyTranslation[lang]) return legacyTranslation[lang];

    // 2. Check category types (e.g. "beruflich")
    if (CATEGORY_TYPES && CATEGORY_TYPES[key]) {
        return CATEGORY_TYPES[key][lang] || CATEGORY_TYPES[key]['de'];
    }

    // 3. Search in NEW_TAXONOMY (e.g. "sport_fitness_beruf")
    if (NEW_TAXONOMY) {
        for (const typeKey in NEW_TAXONOMY) {
            const areas = NEW_TAXONOMY[typeKey];
            if (areas && areas[key] && areas[key].label) {
                return areas[key].label[lang] || areas[key].label['de'];
            }
            // Also check specialties
            for (const areaKey in areas) {
                const specialties = areas[areaKey]?.specialties || [];
                if (specialties.includes(key)) {
                    return key; // Specialties don't have labels, use key
                }
            }
        }
    }

    return key;
};

// --- MAIN DASHBOARD COMPONENT ---
const Dashboard = ({ user, setUser, t, setView, courses, teacherEarnings, myBookings, savedCourses, savedCourseIds, onToggleSaveCourse, handleDeleteCourse, handleEditCourse, handleUpdateCourseStatus, handleCancelEvent, showNotification, changeLanguage, setSelectedCourse, refreshBookings, refreshTeacherEarnings, isImpersonating }) => {
    const [dashView, setDashView] = useState('overview');
    const [userTier, setUserTier] = useState('basic'); // basic, pro, premium, enterprise
    const [showSuccessModal, setShowSuccessModal] = useState(false); // NEW: Success Modal State
    const [showCaptureServiceModal, setShowCaptureServiceModal] = useState(false); // Capture Service Modal
    const [showCaptureSuccessModal, setShowCaptureSuccessModal] = useState(false); // Capture Service Success Modal
    const [showPackageSuccessModal, setShowPackageSuccessModal] = useState(false); // Package Upgrade Success Modal
    const [packageExpiresAt, setPackageExpiresAt] = useState(null); // Ablaufdatum des Pakets
    const [checkoutLoading, setCheckoutLoading] = useState(null); // Tier-ID being processed
    const [usedCaptureServices, setUsedCaptureServices] = useState(0); // Genutzte Erfassungsservices
    const [authUid, setAuthUid] = useState(null);
    const [prioCourseIds, setPrioCourseIds] = useState(new Set()); // Prio-Kurse IDs
    const [showPrioInfo, setShowPrioInfo] = useState(false); // Info-Tooltip anzeigen
    const [refundingBookingId, setRefundingBookingId] = useState(null); // Track which booking is being refunded
    const [disputingBookingId, setDisputingBookingId] = useState(null); // Track which booking is being disputed
    const [deliveringBookingId, setDeliveringBookingId] = useState(null); // Track which booking is being marked as delivered
    const [expandedCourseEvents, setExpandedCourseEvents] = useState(null); // courseId of expanded events row
    const [cancellingEventId, setCancellingEventId] = useState(null); // Track which event is being cancelled
    const [actionDialog, setActionDialog] = useState(null);
    const [actionReason, setActionReason] = useState('');
    const [dialogSubmitting, setDialogSubmitting] = useState(false);
    const [goodwillDialog, setGoodwillDialog] = useState(null);
    const [goodwillDecisionPercent, setGoodwillDecisionPercent] = useState(100);
    const [goodwillDecisionMessage, setGoodwillDecisionMessage] = useState('');
    const [goodwillSubmittingId, setGoodwillSubmittingId] = useState(null);

    // Load taxonomy from DB for category labels
    const { taxonomy: dbTaxonomy, types: dbTypes, getTypeLabel: dbGetTypeLabel } = useTaxonomy();

    // Handle booking refund
    const executeRefundBooking = async (bookingId, userId) => {
        if (!bookingId || !userId) return;
        if (refundingBookingId) return; // Prevent double-clicks

        setRefundingBookingId(bookingId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Bitte melde dich erneut an.');
            }

            const response = await fetch('/api/refund-booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ bookingId })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Refund fehlgeschlagen');
            }

            showNotification(`Buchung storniert. CHF ${data.credit_amount_chf || ''} als Guthaben gutgeschrieben.`);

            // Update credit balance in user state
            if (data.new_balance_chf && setUser) {
                setUser(prev => prev ? { ...prev, credit_balance_cents: Math.round(parseFloat(data.new_balance_chf) * 100) } : prev);
            }

            // Refresh bookings list
            if (refreshBookings) {
                await refreshBookings(userId);
            }
        } catch (error) {
            console.error('Refund error:', error);
            showNotification(error.message || 'Stornierung fehlgeschlagen. Bitte versuche es später erneut.', 'error');
        } finally {
            setRefundingBookingId(null);
        }
    };

    // Handle booking dispute
    const executeDisputeBooking = async (bookingId, userId, reason) => {
        if (!bookingId || !userId) return;
        if (disputingBookingId) return;

        setDisputingBookingId(bookingId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Bitte melde dich erneut an.');
            }

            const response = await fetch('/api/dispute-booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ bookingId, reason })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Einspruch fehlgeschlagen');
            }

            showNotification('Einspruch eingereicht. Unser Team wird den Fall prüfen und sich bei dir melden.');

            if (refreshBookings) {
                await refreshBookings(userId);
            }
        } catch (error) {
            console.error('Dispute error:', error);
            showNotification(error.message || 'Einspruch fehlgeschlagen. Bitte versuche es später erneut.');
        } finally {
            setDisputingBookingId(null);
        }
    };

    const executeGoodwillRequest = async (bookingId, userId, reason) => {
        if (!bookingId || !userId) return;
        if (goodwillSubmittingId) return;

        setGoodwillSubmittingId(bookingId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Bitte melde dich erneut an.');
            }

            const response = await fetch('/api/request-goodwill-refund', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ bookingId, message: reason || null })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Kulanzanfrage fehlgeschlagen');
            }

            showNotification('Kulanzanfrage gesendet. Der Anbieter wurde informiert.');
            if (refreshBookings) {
                await refreshBookings(userId);
            }
        } catch (error) {
            console.error('Goodwill request error:', error);
            showNotification(error.message || 'Kulanzanfrage fehlgeschlagen. Bitte versuche es später erneut.');
        } finally {
            setGoodwillSubmittingId(null);
        }
    };

    const executeGoodwillDecision = async (bookingId, refundPercent, message) => {
        if (!bookingId) return;
        if (goodwillSubmittingId) return;

        setGoodwillSubmittingId(bookingId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Bitte melde dich erneut an.');
            }

            const response = await fetch('/api/respond-goodwill-refund', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ bookingId, refundPercent, message: message || null })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Kulanzentscheidung fehlgeschlagen');
            }

            showNotification(refundPercent === 0 ? 'Kulanzanfrage abgelehnt.' : `Kulanz-Rückerstattung (${refundPercent} %) wurde ausgeführt.`);
            if (refreshTeacherEarnings) {
                await refreshTeacherEarnings(user.id);
            }
            if (refreshBookings) {
                await refreshBookings(user.id);
            }
        } catch (error) {
            console.error('Goodwill decision error:', error);
            showNotification(error.message || 'Kulanzentscheidung fehlgeschlagen.');
        } finally {
            setGoodwillSubmittingId(null);
        }
    };

    // Handle marking a platform_flex booking as delivered (provider)
    const executeMarkDelivered = async (bookingId) => {
        if (!bookingId) return;
        if (deliveringBookingId) return;

        setDeliveringBookingId(bookingId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Nicht eingeloggt');
            }

            const response = await fetch('/api/mark-booking-delivered', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ bookingId })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Fehler beim Markieren');
            }

            showNotification('Buchung als durchgeführt markiert. Auszahlung wird in 2 Tagen freigegeben.', 'success');

            if (refreshTeacherEarnings) {
                await refreshTeacherEarnings(user.id);
            }
        } catch (error) {
            console.error('Mark delivered error:', error);
            showNotification(error.message || 'Markierung fehlgeschlagen. Bitte versuche es später erneut.');
        } finally {
            setDeliveringBookingId(null);
        }
    };

    // Handle event cancellation (provider)
    const executeCancelEvent = async (eventId, reason) => {
        if (cancellingEventId) return;

        setCancellingEventId(eventId);
        try {
            await handleCancelEvent(eventId, reason || undefined);
        } finally {
            setCancellingEventId(null);
            setExpandedCourseEvents(null);
        }
    };

    const openRefundDialog = (bookingId) => {
        setActionReason('');
        setActionDialog({
            type: 'refund',
            targetId: bookingId,
            title: 'Buchung stornieren?',
            message: 'Die Buchung wird storniert und der Betrag als Guthaben auf deinem KursNavi-Konto gutgeschrieben. Das Guthaben wird automatisch bei deiner nächsten Buchung verrechnet.',
            confirmLabel: 'Stornierung bestätigen',
            tone: 'danger'
        });
    };

    const openDisputeDialog = (bookingId) => {
        setActionReason('');
        setActionDialog({
            type: 'dispute',
            targetId: bookingId,
            title: 'Einspruch einreichen',
            message: 'Beschreibe kurz, weshalb du Einspruch einlegen möchtest. Die Auszahlung an den Anbieter bleibt bis zur Klärung blockiert.',
            confirmLabel: 'Einspruch senden',
            tone: 'warning',
            needsReason: true,
            reasonLabel: 'Grund für den Einspruch',
            reasonPlaceholder: 'z.B. Kurs nicht stattgefunden oder Leistung nicht wie beschrieben'
        });
    };

    const openGoodwillRequestDialog = (bookingId) => {
        setActionReason('');
        setActionDialog({
            type: 'goodwillRequest',
            targetId: bookingId,
            title: 'Kulanzanfrage senden',
            message: 'Deine Anfrage wird an den Anbieter weitergeleitet. Der Anbieter kann 0 %, 25 %, 50 % oder 100 % Rückerstattung bewilligen.',
            confirmLabel: 'Kulanzanfrage senden',
            tone: 'warning',
            needsReason: true,
            reasonLabel: 'Nachricht an den Anbieter (optional)',
            reasonPlaceholder: 'Optional: kurze Erklärung, weshalb du um Kulanz bittest'
        });
    };

    const openDeliveredDialog = (bookingId) => {
        setActionReason('');
        setActionDialog({
            type: 'deliver',
            targetId: bookingId,
            title: 'Buchung als durchgeführt markieren?',
            message: 'Damit bestätigst du die Leistungserbringung. Die Auszahlung wird 2 Tage später freigegeben.',
            confirmLabel: 'Durchführung bestätigen',
            tone: 'warning'
        });
    };

    const openCancelEventDialog = (eventId) => {
        setActionReason('');
        setActionDialog({
            type: 'cancelEvent',
            targetId: eventId,
            title: 'Termin absagen?',
            message: 'Alle bestätigten Buchungen für diesen Termin werden automatisch erstattet.',
            confirmLabel: 'Termin absagen',
            tone: 'danger',
            needsReason: true,
            reasonLabel: 'Grund für die Absage (optional)',
            reasonPlaceholder: 'Optionaler Hinweis für Teilnehmer und Support'
        });
    };

    const openGoodwillDecisionDialog = (bookingId, studentName, requestMessage) => {
        setGoodwillDecisionPercent(100);
        setGoodwillDecisionMessage('');
        setGoodwillDialog({
            bookingId,
            message: `${studentName || 'Der Lernende'} hat eine Kulanzanfrage gestellt. Du kannst 0 %, 25 %, 50 % oder 100 % Rückerstattung gewähren.${requestMessage ? `\n\nNachricht: ${requestMessage}` : ''}`
        });
    };

    const closeActionDialog = () => {
        if (dialogSubmitting) return;
        setActionDialog(null);
        setActionReason('');
    };

    const confirmActionDialog = async () => {
        if (!actionDialog || dialogSubmitting) return;

        setDialogSubmitting(true);
        try {
            if (actionDialog.type === 'refund') {
                await executeRefundBooking(actionDialog.targetId, user.id);
            } else if (actionDialog.type === 'goodwillRequest') {
                await executeGoodwillRequest(actionDialog.targetId, user.id, actionReason.trim());
            } else if (actionDialog.type === 'dispute') {
                await executeDisputeBooking(actionDialog.targetId, user.id, actionReason.trim());
            } else if (actionDialog.type === 'deliver') {
                await executeMarkDelivered(actionDialog.targetId);
            } else if (actionDialog.type === 'cancelEvent') {
                await executeCancelEvent(actionDialog.targetId, actionReason.trim());
            }
            setActionDialog(null);
            setActionReason('');
        } finally {
            setDialogSubmitting(false);
        }
    };

    const closeGoodwillDecisionDialog = () => {
        if (goodwillSubmittingId) return;
        setGoodwillDialog(null);
        setGoodwillDecisionPercent(100);
        setGoodwillDecisionMessage('');
    };

    const confirmGoodwillDecisionDialog = async () => {
        if (!goodwillDialog) return;
        await executeGoodwillDecision(goodwillDialog.bookingId, goodwillDecisionPercent, goodwillDecisionMessage.trim());
        setGoodwillDialog(null);
        setGoodwillDecisionPercent(100);
        setGoodwillDecisionMessage('');
    };

    // NEW: Check for Payment Success in URL
    useEffect(() => {
        let stopped = false;
        const query = new URLSearchParams(window.location.search);

        if (query.get('payment') === 'success') {
            setShowSuccessModal(true);
            window.history.replaceState(null, '', window.location.pathname);
        }

        if (query.get('capture_service') === 'success') {
            setShowCaptureSuccessModal(true);
            window.history.replaceState(null, '', window.location.pathname);
        }

        if (query.get('package_upgrade') === 'success') {
            const sessionId = query.get('session_id');

            const finalizePackageReturn = async () => {
                if (sessionId) {
                    const { data: { session } } = await supabase.auth.getSession();

                    if (session?.access_token) {
                        try {
                            await fetch('/api/confirm-package-checkout', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({ sessionId }),
                            });
                        } catch (error) {
                            console.warn('Package checkout confirmation failed:', error);
                        }
                    }
                }

                if (stopped) return;

                const { data, error } = await supabase
                    .from('profiles')
                    .select('package_tier, package_expires_at')
                    .eq('id', user?.id)
                    .maybeSingle();

                if (!stopped && !error && data) {
                    const value = (data.package_tier || '').toString().toLowerCase().trim();
                    const resolvedTier = value.includes('enterprise')
                        ? 'enterprise'
                        : value.includes('premium')
                            ? 'premium'
                            : value === 'pro' || value.startsWith('pro')
                                ? 'pro'
                                : 'basic';

                    if (data.package_expires_at && new Date(data.package_expires_at) < new Date() && resolvedTier !== 'enterprise') {
                        setUserTier('basic');
                        setPackageExpiresAt(null);
                    } else {
                        setUserTier(resolvedTier);
                        setPackageExpiresAt(data.package_expires_at || null);
                    }
                }

                if (!stopped) {
                    setShowPackageSuccessModal(true);
                    window.history.replaceState(null, '', window.location.pathname);
                }
            };

            finalizePackageReturn();
        }

        return () => {
            stopped = true;
        };
    }, [user?.id]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const { data, error } = await supabase.auth.getUser();
            if (error) console.warn("auth.getUser error:", error.message);

            if (!cancelled) setAuthUid(data?.user?.id || null);
        })();

        return () => { cancelled = true; };
    }, []);

    const uid = isImpersonating ? user?.id : (authUid || user?.id);

    // 1. Fetch User Tier (AUTH UID + maybeSingle)
    useEffect(() => {
        if (user?.role !== 'teacher') return;
        if (!uid) return;

        let cancelled = false;

        (async () => {
            const { data, error, status } = await supabase
                .from('profiles')
                .select('package_tier, package_expires_at')
                .eq('id', uid)
                .maybeSingle();

            if (cancelled) return;

            if (error) {
                console.warn("Tier fetch error:", status, error.message, error.code, error.details);
                return;
            }
            if (!data) {
                console.warn("Tier fetch: no profile row visible for uid", uid);
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

            const resolved = parseTier(data.package_tier);

            // Check if paid package has expired (client-side display only)
            if (data.package_expires_at && new Date(data.package_expires_at) < new Date() && resolved !== 'enterprise') {
                setUserTier('basic');
                setPackageExpiresAt(null);
            } else {
                setUserTier(resolved);
                setPackageExpiresAt(data.package_expires_at || null);
            }
        })();

        return () => { cancelled = true; };
    }, [uid, user?.role]);

    // 2. Fetch Prio-Kurse Status aus der DB und setze Default-Auswahl
    useEffect(() => {
        if (user?.role !== 'teacher') return;
        if (!uid) return;

        let cancelled = false;

        (async () => {
            const { data, error } = await supabase
                .from('courses')
                .select('id, is_prio, created_at, title')
                .eq('user_id', uid);

            if (cancelled) return;

            if (error) {
                console.warn("Prio courses fetch error:", error.message);
                return;
            }

            if (data) {
                const prioIds = new Set(data.filter(c => c.is_prio).map(c => c.id));
                const allCourseIds = data.map(c => c.id);

                // Alphabetisch sortierte Kurse (für Auswahl bei Limit)
                const sortedByTitle = [...data].sort((a, b) =>
                    (a.title || '').localeCompare(b.title || '', 'de')
                );

                const plan = PLANS.find(p => p.id === userTier) || PLANS[0];
                const maxPrio = plan?.maxPrioCourses || 0;

                // Enterprise: Alle Kurse sind automatisch Prio
                if (maxPrio === Infinity) {
                    // Alle Kurse die noch nicht Prio sind, auf Prio setzen
                    const nonPrioIds = allCourseIds.filter(id => !prioIds.has(id));
                    if (nonPrioIds.length > 0) {
                        for (const courseId of nonPrioIds) {
                            await supabase
                                .from('courses')
                                .update({ is_prio: true })
                                .eq('id', courseId);
                        }
                    }
                    setPrioCourseIds(new Set(allCourseIds));
                }
                // Downgrade: Mehr Prio-Kurse als erlaubt -> nur die ersten X (alphabetisch) behalten
                else if (prioIds.size > maxPrio && maxPrio > 0) {
                    // Die ersten maxPrio Kurse (alphabetisch) als Prio behalten
                    const allowedPrioIds = new Set(sortedByTitle.slice(0, maxPrio).map(c => c.id));

                    // Kurse die jetzt nicht mehr Prio sein dürfen
                    const toRemovePrio = [...prioIds].filter(id => !allowedPrioIds.has(id));
                    // Kurse die Prio werden müssen (falls sie es noch nicht sind)
                    const toAddPrio = [...allowedPrioIds].filter(id => !prioIds.has(id));

                    // Prio entfernen
                    for (const courseId of toRemovePrio) {
                        await supabase
                            .from('courses')
                            .update({ is_prio: false })
                            .eq('id', courseId);
                    }
                    // Prio hinzufügen
                    for (const courseId of toAddPrio) {
                        await supabase
                            .from('courses')
                            .update({ is_prio: true })
                            .eq('id', courseId);
                    }

                    setPrioCourseIds(allowedPrioIds);
                }
                // Default-Auswahl: Wenn noch keine Prio-Kurse markiert sind,
                // die ersten Kurse (alphabetisch, bis maxPrioCourses) automatisch als Prio setzen
                else if (prioIds.size === 0 && data.length > maxPrio && maxPrio > 0) {
                    // Alphabetisch sortiert - die ersten X auswählen
                    const selectedCourseIds = sortedByTitle.slice(0, maxPrio).map(c => c.id);

                    // Update in DB (RLS Policy stellt sicher, dass nur eigene Kurse aktualisiert werden)
                    for (const courseId of selectedCourseIds) {
                        await supabase
                            .from('courses')
                            .update({ is_prio: true })
                            .eq('id', courseId);
                    }

                    setPrioCourseIds(new Set(selectedCourseIds));
                } else {
                    setPrioCourseIds(prioIds);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [uid, user?.role, userTier]);

    // Handler: Toggle Prio-Status eines Kurses
    const handleTogglePrio = async (courseId, isCurrentlyPrio) => {
        // Frische UID holen, um sicherzustellen dass wir die aktuelle Auth-UID haben
        const { data: authData } = await supabase.auth.getUser();
        const currentUid = authData?.user?.id || uid;

        if (!currentUid) {
            console.error("handleTogglePrio: No user ID available");
            showNotification("Bitte melde dich erneut an");
            return;
        }

        const maxPrio = currentPlan?.maxPrioCourses || 0;
        const currentPrioCount = prioCourseIds.size;

        // Wenn wir hinzufügen wollen und das Limit erreicht ist
        if (!isCurrentlyPrio && currentPrioCount >= maxPrio && maxPrio !== Infinity) {
            showNotification(`Du hast bereits ${maxPrio} Prio-Kurse ausgewählt (Maximum für ${currentPlan?.title}).`);
            return;
        }

        // Optimistic Update
        const newPrioIds = new Set(prioCourseIds);
        if (isCurrentlyPrio) {
            newPrioIds.delete(courseId);
        } else {
            newPrioIds.add(courseId);
        }
        setPrioCourseIds(newPrioIds);

        // DB Update - direkt mit user_id Filter für Sicherheit
        const { error } = await supabase
            .from('courses')
            .update({ is_prio: !isCurrentlyPrio })
            .eq('id', courseId)
            .eq('user_id', currentUid);

        if (error) {
            console.error("Failed to update prio status:", error);
            // Zeige den genauen Fehler an
            showNotification(`Fehler: ${error.message || error.code || 'Unbekannter Fehler'}`);
            // Rollback
            setPrioCourseIds(prioCourseIds);
        }
    };

    // 3. Plan & Daten (Business Logic)
    const currentPlan = PLANS.find(p => p.id === userTier) || PLANS[0];
    const isEnterprisePlan = userTier === 'enterprise' || currentPlan?.maxPrioCourses === Infinity;

    const totalPaidOut = user.role === 'teacher' ? teacherEarnings.filter(e => e.isPaidOut).reduce((sum, e) => sum + e.payout, 0) : 0;
    const myCourses = user.role === 'teacher'
        ? (courses || []).filter(c => String(c.user_id) === String(uid)).sort((a, b) => a.title.localeCompare(b.title, 'de'))
        : [];

    const courseCount = myCourses.length;

    const handleNavigateToCourse = (course) => {
        const full = (courses || []).find(c => String(c.id) === String(course?.id)) || course;
        setSelectedCourse(full);
        setView('detail');
        window.scrollTo(0, 0);
    };


    return (
        <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                 <div><h1 className="text-3xl font-bold text-dark font-heading">{user.role === 'teacher' ? t.teacher_dash : t.student_dash}</h1><p className="text-gray-500">Welcome back, {user.name}</p></div>
                 <div className="bg-white rounded-full p-1 border flex shadow-sm h-fit">
                    <button onClick={() => setDashView('overview')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'overview' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_overview}</button>
                    <button onClick={() => setDashView('profile')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'profile' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_settings}</button>
                    {user.role === 'teacher' && (
                        <>
                            <button onClick={() => setDashView('analytics')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'analytics' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>Analytics</button>
                            <button onClick={() => setDashView('merkliste')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'merkliste' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>Merkliste</button>
                            <button onClick={() => setDashView('subscription')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'subscription' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>Abo</button>
                        </>
                    )}
                </div>
                
            </div>

            {dashView === 'profile' || dashView === 'settings' ? (
                user.role === 'teacher' ? (
                    <ProviderProfileEditor user={user} setUser={setUser} showNotification={showNotification} setLang={changeLanguage} t={t} />
                ) : (
                    <UserProfileSection user={user} setUser={setUser} showNotification={showNotification} setLang={changeLanguage} t={t} isImpersonating={isImpersonating} />
                )
             ) :
             dashView === 'subscription' ? ( <SubscriptionSection user={user} currentTier={userTier} packageExpiresAt={packageExpiresAt} checkoutLoading={checkoutLoading} setCheckoutLoading={setCheckoutLoading} showNotification={showNotification} /> ) :
             dashView === 'analytics' ? (
                <AnalyticsDashboard user={user} userTier={userTier} courses={courses} teacherEarnings={teacherEarnings} setDashView={setDashView} />
             ) :
             dashView === 'merkliste' ? (
                <div>
                    <h2 className="text-2xl font-bold mb-6 text-dark">Merkliste</h2>
                    <p className="text-gray-500 mb-6">Beobachte Kurse anderer Anbieter — praktisch für die Wettbewerbsanalyse.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(savedCourses || []).length > 0 ? (savedCourses || []).map(course => (
                            <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col transition hover:shadow-md">
                                <img
                                    src={course.image_url || fallbackImage}
                                    alt={course.title}
                                    className="w-full h-40 rounded-lg object-cover cursor-pointer hover:opacity-90 transition mb-3"
                                    onClick={() => handleNavigateToCourse(course)}
                                />
                                <h3 className="font-bold text-dark cursor-pointer hover:text-primary transition" onClick={() => handleNavigateToCourse(course)}>
                                    {course.title}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">{course.instructor_name} • {course.canton}</p>
                                {course.price != null && (
                                    <p className="text-sm font-bold text-dark mt-2">CHF {formatPriceCHF(course.price)}</p>
                                )}
                                <div className="mt-auto pt-4 flex items-center justify-between">
                                    <button type="button" onClick={() => handleNavigateToCourse(course)} className="text-sm font-bold text-primary hover:text-orange-700 hover:underline">Ansehen</button>
                                    <button type="button" onClick={() => onToggleSaveCourse && onToggleSaveCourse(course)} className="text-sm font-bold text-red-500 hover:text-red-700 hover:underline">Entfernen</button>
                                </div>
                            </div>
                        )) : (
                            <p className="text-gray-500 italic col-span-full">Du hast noch keine Kurse gemerkt.</p>
                        )}
                    </div>
                </div>
             ) : (
                <>
                {user.role === 'teacher' ? (
                    <>
                        {/* BUSINESS LOGIC: Usage Stats & Limits Card */}
                        <div className="bg-dark text-white rounded-xl p-6 mb-8 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 className="w-32 h-32" /></div>
                            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                                <div>
                                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Dein Plan</h3>
                                    <div className="flex items-center gap-2">
                                        {userTier === 'basic' ? <User className="w-6 h-6 text-gray-300" /> : <Crown className="w-6 h-6 text-yellow-400" />}
                                        <span className="text-2xl font-bold capitalize">{currentPlan.title}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {isEnterprisePlan ? 'Unbegrenzte Prio-Kurse' : `${currentPlan.maxPrioCourses} Prio-Kurse`} • bis {currentPlan.maxCategoriesPerCourse} Kategorien/Kurs • {currentPlan.includedCaptureServices > 0 ? `${currentPlan.includedCaptureServices} Erfassungsservices inkl.` : 'keine Erfassungsservices inklusive'}
                                    </p>
                                    {packageExpiresAt && userTier !== 'basic' && (
                                        <p className="text-xs text-yellow-400 mt-1">
                                            Gültig bis: {new Date(packageExpiresAt).toLocaleDateString('de-CH')}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-300">Aktive Kurse</span>
                                        <span className="text-green-400 font-bold">{courseCount}</span>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        Kursanzahl ist in allen Paketen unbegrenzt.
                                    </div>
                                </div>
                                <div className="text-right">
                                    {userTier !== 'enterprise' && (
                                        <button
                                            type="button"
                                            onClick={() => setDashView('subscription')}
                                            className="bg-white text-dark px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition shadow-lg"
                                        >
                                            Abo upgraden / verwalten
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SERVICE UPSELL CARD (New Revenue Stream) */}
                        <div className="bg-gradient-to-r from-orange-50 to-white p-6 rounded-xl border border-orange-100 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="bg-white p-3 rounded-full shadow-sm border border-orange-100 text-primary hidden md:block">
                                    <PenTool className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-dark font-heading">Keine Zeit, Kurse zu erfassen?</h3>
                                    <p className="text-sm text-gray-600 mt-1 max-w-lg">Wir übernehmen das für dich! Sende uns einfach deine Unterlagen (PDF/Link). Wir optimieren Texte & Bilder.</p>
                                    <div className="flex flex-wrap gap-4 mt-3 text-xs font-medium text-gray-500">
                                        <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-green-500"/> SEO-Optimierung</span>
                                        <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-green-500"/> Bild-Bearbeitung</span>
                                        <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-green-500"/> Qualitäts-Check</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-xs text-gray-400 mb-1 bg-white px-2 py-0.5 rounded border">ab 4. Kurs günstiger</span>
                                <button
                                    type="button"
                                    onClick={() => setShowCaptureServiceModal(true)}
                                    className="bg-white border-2 border-primary text-primary px-5 py-2 rounded-lg font-bold shadow-sm hover:bg-primary hover:text-white transition whitespace-nowrap flex items-center"
                                >
                                    Service buchen (ab CHF 50.-) <ArrowRight className="w-4 h-4 ml-2"/>
                                </button>
                            </div>
                        </div>

                        {/* STATS & LISTS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4"><DollarSign className="text-green-600" /></div><div><p className="text-sm text-gray-500">Einnahmen (Platform)</p><p className="text-2xl font-bold text-dark">CHF {formatPriceCHF(totalPaidOut.toFixed(2))}</p></div></div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4"><User className="text-blue-600" /></div><div><p className="text-sm text-gray-500">Buchungen Total</p><p className="text-2xl font-bold text-dark">{teacherEarnings.length}</p></div></div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4"><Clock className="text-purple-600" /></div><div><p className="text-sm text-gray-500">Aktive Kurse</p><p className="text-2xl font-bold text-dark">{courseCount}</p></div></div>
                        </div>

                        <h2 className="text-xl font-bold mb-4 font-heading text-dark">Buchungs-Historie (Schüler)</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                             {teacherEarnings.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                            <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Datum</th><th className="px-6 py-4 font-semibold text-gray-600">Kurs</th><th className="px-6 py-4 font-semibold text-gray-600">Schüler</th><th className="px-6 py-4 font-semibold text-gray-600">Auszahlung (Netto)</th><th className="px-6 py-4 font-semibold text-gray-600">Status</th><th className="px-6 py-4 font-semibold text-gray-600">Aktion</th></tr></thead>
                                            <tbody className="divide-y divide-gray-100">{teacherEarnings.map(earning => {
                                                const isFlex = earning.bookingType === 'platform_flex';
                                                const isPartialGoodwillRefund = earning.goodwillStatus === 'approved' && earning.goodwillRefundPercent > 0 && earning.goodwillRefundPercent < 100;
                                                const canDeliver = isFlex && !earning.isPaidOut && !earning.deliveredAt && !earning.disputedAt && !earning.refundedAt && earning.goodwillStatus !== 'pending';
                                                const hasPendingGoodwill = earning.goodwillStatus === 'pending';
                                                const tooEarly = canDeliver && earning.paidAt && new Date() < new Date(new Date(earning.paidAt).getTime() + 48 * 60 * 60 * 1000);
                                                return (
                                                <tr key={earning.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm text-gray-500">{earning.date}</td>
                                                    <td className="px-6 py-4 font-medium text-dark">{earning.courseTitle}{isFlex && <span className="ml-2 text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Flex</span>}</td>
                                                    <td className="px-6 py-4 text-gray-700">{earning.studentName}</td>
                                                    <td className="px-6 py-4 font-bold text-dark">CHF {formatPriceCHF(earning.payout.toFixed(2))}</td>
                                                    <td className="px-6 py-4">{earning.isPaidOut
                                                        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Bezahlt</span>
                                                        : isPartialGoodwillRefund
                                                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Teilweise erstattet</span>
                                                        : earning.refundedAt
                                                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Erstattet</span>
                                                        : hasPendingGoodwill
                                                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Kulanzanfrage offen</span>
                                                        : earning.disputedAt
                                                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Einspruch</span>
                                                            : isFlex && !earning.deliveredAt
                                                                ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Warte auf Bestätigung</span>
                                                                : isFlex && earning.deliveredAt
                                                                    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Auszahlung geplant</span>
                                                                    : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Offen</span>
                                                    }</td>
                                                    <td className="px-6 py-4">
                                                        {hasPendingGoodwill && (
                                                            <button
                                                                type="button"
                                                                disabled={goodwillSubmittingId === earning.id}
                                                                onClick={() => openGoodwillDecisionDialog(earning.id, earning.studentName, earning.goodwillRequestMessage)}
                                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                                            >
                                                                {goodwillSubmittingId === earning.id ? <Loader className="w-3 h-3 mr-1 animate-spin" /> : <Info className="w-3 h-3 mr-1" />}
                                                                Kulanz entscheiden
                                                            </button>
                                                        )}
                                                        {!hasPendingGoodwill && canDeliver && (
                                                            <button
                                                                type="button"
                                                                disabled={tooEarly || deliveringBookingId === earning.id}
                                                                onClick={() => openDeliveredDialog(earning.id)}
                                                                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${tooEarly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
                                                                title={tooEarly ? 'Frühestens 48h nach Zahlung möglich' : 'Buchung als durchgeführt markieren'}
                                                            >
                                                                {deliveringBookingId === earning.id ? <Loader className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                                                                {tooEarly ? '48h-Sperre' : 'Durchgeführt'}
                                                            </button>
                                                        )}
                                                        {!hasPendingGoodwill && isFlex && earning.deliveredAt && !earning.isPaidOut && (
                                                            <span className="inline-flex items-center text-xs text-green-600"><Check className="w-3 h-3 mr-1" />Bestätigt</span>
                                                        )}
                                                    </td>
                                                </tr>);
                                            })}</tbody>
                                    </table>
                                </div>
                             ) : <div className="p-8 text-center text-gray-500">Noch keine Buchungen über die Plattform.</div>}
                        </div>

                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold font-heading text-dark">Meine Kurse verwalten</h2>
                            <button
                                onClick={() => handleEditCourse(null)}
                                className="px-5 py-2.5 rounded-xl font-bold flex items-center shadow-lg transition font-heading bg-primary text-white hover:bg-orange-600 hover:-translate-y-0.5"
                            >
                                <KursNaviLogo className="mr-2 w-5 h-5 text-white" />
                                {t.dash_new_course}
                            </button>
                        </div>

                        {/* Prio-Kurse Management Section */}
                        {currentPlan?.maxPrioCourses > 0 && myCourses.length > 0 && (
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-yellow-100 p-2 rounded-full">
                                            <Star className="w-5 h-5 text-yellow-600" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-dark flex items-center gap-2">
                                                Prio-Kurse
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onMouseEnter={() => setShowPrioInfo(true)}
                                                        onMouseLeave={() => setShowPrioInfo(false)}
                                                        onClick={() => setShowPrioInfo(!showPrioInfo)}
                                                        className="text-gray-400 hover:text-gray-600 transition"
                                                    >
                                                        <Info className="w-4 h-4" />
                                                    </button>
                                                    {showPrioInfo && (
                                                        <div className="absolute left-0 top-6 z-50 w-72 bg-dark text-white text-xs p-3 rounded-lg shadow-xl">
                                                            <p className="font-bold mb-1">Was sind Prio-Kurse?</p>
                                                            <p>Prio-Kurse erhalten einen Ranking-Bonus und werden in den Suchergebnissen höher angezeigt. Die Anzahl der verfügbaren Prio-Slots hängt von deinem Abo ab.</p>
                                                            {myCourses.length > (currentPlan?.maxPrioCourses || 0) && (
                                                                <p className="mt-2 text-yellow-300">Wähle unten aus, welche deiner Kurse priorisiert werden sollen.</p>
                                                            )}
                                                            <div className="absolute -top-1.5 left-2 w-3 h-3 bg-dark transform rotate-45"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                {isEnterprisePlan ? (
                                                    <span className="text-green-600 font-medium">Unbegrenzte Prio-Kurse (Enterprise)</span>
                                                ) : myCourses.length <= currentPlan?.maxPrioCourses ? (
                                                    <span className="text-green-600">Alle deine Kurse sind automatisch Prio-Kurse</span>
                                                ) : (
                                                    <span>Wähle aus, welche Kurse priorisiert werden sollen</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Zähler nur für nicht-Enterprise-User anzeigen */}
                                    {!isEnterprisePlan && (
                                        <div className="flex items-center gap-2">
                                            <div className={`px-4 py-2 rounded-lg font-bold text-sm ${
                                                prioCourseIds.size >= (currentPlan?.maxPrioCourses || 0)
                                                    ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                                    : 'bg-green-100 text-green-700 border border-green-200'
                                            }`}>
                                                <span>{prioCourseIds.size} / {currentPlan?.maxPrioCourses} Prio-Slots verwendet</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {myCourses.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                            <thead className="bg-beige border-b border-gray-200">
                                                <tr>
                                                    {/* Prio-Spalte nur anzeigen wenn: Plan hat Prio-Slots UND mehr Kurse als Slots */}
                                                    {currentPlan?.maxPrioCourses > 0 && myCourses.length > (currentPlan?.maxPrioCourses || 0) && !isEnterprisePlan && (
                                                        <th className="px-4 py-4 font-semibold text-gray-600 text-center w-16">Prio</th>
                                                    )}
                                                    <th className="px-6 py-4 font-semibold text-gray-600">Kurs</th>
                                                    <th className="px-6 py-4 font-semibold text-gray-600">Standorte</th>
                                                    <th className="px-6 py-4 font-semibold text-gray-600">Status</th>
                                                    <th className="px-6 py-4 font-semibold text-gray-600">Typ</th>
                                                    <th className="px-6 py-4 font-semibold text-gray-600">Preis</th>
                                                    <th className="px-6 py-4 font-semibold text-gray-600">Aktionen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">{myCourses.map(course => {
                                                const isPrio = prioCourseIds.has(course.id);
                                                const showPrioCheckbox = currentPlan?.maxPrioCourses > 0 && myCourses.length > (currentPlan?.maxPrioCourses || 0) && !isEnterprisePlan;
                                                const canEnablePrio = isPrio || prioCourseIds.size < (currentPlan?.maxPrioCourses || 0);

                                                return (
                                                <React.Fragment key={course.id}>
                                                <tr className={`hover:bg-gray-50 ${isPrio && showPrioCheckbox ? 'bg-yellow-50/50' : ''}`}>
                                                    {/* Prio Checkbox */}
                                                    {showPrioCheckbox && (
                                                        <td className="px-4 py-4 text-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isPrio}
                                                                    onChange={() => handleTogglePrio(course.id, isPrio)}
                                                                    disabled={!canEnablePrio && !isPrio}
                                                                    className="sr-only peer"
                                                                />
                                                                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all
                                                                    ${isPrio
                                                                        ? 'bg-yellow-400 border-yellow-500'
                                                                        : canEnablePrio
                                                                            ? 'bg-white border-gray-300 hover:border-yellow-400'
                                                                            : 'bg-gray-100 border-gray-200 cursor-not-allowed'
                                                                    }`}
                                                                >
                                                                    {isPrio && <Star className="w-4 h-4 text-white fill-white" />}
                                                                </div>
                                                            </label>
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold text-dark">{course.title}</div>
                                                            {/* Prio-Badge wenn alle Kurse automatisch Prio sind ODER wenn Kurs als Prio markiert ist */}
                                                            {((currentPlan?.maxPrioCourses > 0 && myCourses.length <= (currentPlan?.maxPrioCourses || 0)) ||
                                                              isEnterprisePlan ||
                                                              (showPrioCheckbox && isPrio)) && (
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-0.5">
                                                                    <Star className="w-3 h-3 fill-yellow-500" /> Prio
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {(() => {
                                                            // Collect all unique locations from:
                                                            // 1. course_events cantons
                                                            // 2. address field (comma-separated, e.g. "Online, Thurgau")
                                                            // 3. canton field (fallback)
                                                            const eventCantons = course.course_events?.map(e => e.canton).filter(Boolean) || [];
                                                            const addressLocations = course.address?.split(',').map(s => s.trim()).filter(Boolean) || [];
                                                            const allLocations = [...new Set([...eventCantons, ...addressLocations, course.canton].filter(Boolean))];
                                                            return allLocations.length > 0 ? (
                                                                <span className="text-sm text-gray-700 flex items-center gap-1.5">
                                                                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                                    {allLocations.join(', ')}
                                                                </span>
                                                            ) : <span className="text-gray-400 text-sm italic">–</span>;
                                                        })()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {course.status === 'draft' && (
                                                            <span className="text-xs px-2 py-1 rounded font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">Entwurf</span>
                                                        )}
                                                        {(course.status === 'published' || !course.status) && (
                                                            <span className="text-xs px-2 py-1 rounded font-bold bg-green-100 text-green-700 border border-green-200">Veröffentlicht</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${
                                                            course.booking_type === 'platform' ? 'bg-green-100 text-green-700' :
                                                            course.booking_type === 'platform_flex' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {course.booking_type === 'lead' ? 'Anfrage' :
                                                             course.booking_type === 'platform_flex' ? 'Flex' :
                                                             course.booking_type === 'platform' ? 'Termin' : 'Termin'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium">{course.price ? `CHF ${formatPriceCHF(course.price)}` : <span className="text-gray-400 italic">Kein Preis angegeben</span>}</td>
                                                    <td className="px-6 py-4 flex gap-2">
                                                        {/* Quick Publish/Pause Toggle */}
                                                        {course.status === 'draft' && (
                                                            <button onClick={() => handleUpdateCourseStatus(course.id, 'published')} className="text-green-600 hover:text-green-700 bg-green-50 p-2 rounded-full" title="Veröffentlichen">
                                                                <Play className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {(course.status === 'published' || !course.status) && (
                                                            <button onClick={() => handleUpdateCourseStatus(course.id, 'draft')} className="text-yellow-600 hover:text-yellow-700 bg-yellow-50 p-2 rounded-full" title="Als Entwurf speichern">
                                                                <Pause className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleEditCourse(course)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full" title="Bearbeiten"><PenTool className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                                                        {/* Termine expand button – only for platform courses with events */}
                                                        {course.booking_type === 'platform' && course.course_events?.length > 0 && (
                                                            <button
                                                                onClick={() => setExpandedCourseEvents(expandedCourseEvents === course.id ? null : course.id)}
                                                                className={`text-gray-500 hover:text-gray-700 p-2 rounded-full ${expandedCourseEvents === course.id ? 'bg-gray-200' : 'bg-gray-50'}`}
                                                                title="Termine anzeigen"
                                                            >
                                                                <Calendar className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {/* Expandable event rows */}
                                                {expandedCourseEvents === course.id && course.course_events?.length > 0 && (
                                                    <tr>
                                                        <td colSpan="99" className="px-6 py-3 bg-gray-50">
                                                            <div className="text-sm font-bold text-gray-600 mb-2">Termine für «{course.title}»</div>
                                                            <div className="space-y-2">
                                                                {course.course_events
                                                                    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                                                                    .map(ev => {
                                                                    const isCancelled = !!ev.cancelled_at;
                                                                    const bookingCount = ev.bookings?.[0]?.count || 0;
                                                                    return (
                                                                        <div key={ev.id} className={`flex items-center justify-between p-3 rounded-lg border ${isCancelled ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                                                            <div className="flex items-center gap-3">
                                                                                <Calendar className={`w-4 h-4 flex-shrink-0 ${isCancelled ? 'text-red-400' : 'text-gray-400'}`} />
                                                                                <div>
                                                                                    <span className={`font-medium ${isCancelled ? 'text-red-600 line-through' : 'text-dark'}`}>
                                                                                        {ev.start_date ? new Date(ev.start_date).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'}
                                                                                    </span>
                                                                                    {ev.location && <span className="text-gray-500 text-xs ml-2">{ev.location}</span>}
                                                                                    {bookingCount > 0 && <span className="text-xs text-blue-600 ml-2">({bookingCount} Buchung{bookingCount !== 1 ? 'en' : ''})</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                {isCancelled ? (
                                                                                    <span className="text-xs px-2 py-1 rounded font-bold bg-red-100 text-red-700 border border-red-200">Abgesagt</span>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => openCancelEventDialog(ev.id)}
                                                                                        disabled={cancellingEventId === ev.id}
                                                                                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-red-600 hover:text-red-700 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
                                                                                    >
                                                                                        {cancellingEventId === ev.id ? 'Wird abgesagt...' : 'Termin absagen'}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
                                            )})}</tbody>
                                    </table>
                                </div>
                            ) : <div className="p-8 text-center text-gray-500">Du hast noch keine Kurse erstellt.</div>}
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* LEFT: Bookings */}
                        <div>
                            {user?.credit_balance_cents > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                    <p className="text-sm font-medium text-green-800">Dein Guthaben</p>
                                    <p className="text-2xl font-bold text-green-700">CHF {((user.credit_balance_cents / 100).toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}</p>
                                    <p className="text-xs text-green-600 mt-1">Wird automatisch bei deiner nächsten Buchung verrechnet.</p>
                                </div>
                            )}
                            <h2 className="text-xl font-bold mb-4 text-dark">{t.my_bookings}</h2>
                            <div className="space-y-4">
                                {myBookings.length > 0 ? myBookings.map(booking => {
                                    const isRefunded = booking.booking_status === 'refunded' || !!booking.refunded_at;
                                    const canRefund = booking.booking_status === 'confirmed' && booking.auto_refund_until && new Date() < new Date(booking.auto_refund_until);
                                    const isFlexBooking = booking.booking_type === 'platform_flex';
                                    const isEventCancelled = booking.event?.cancelled_at;
                                    const eventDisplayDate = booking.event?.start_date ? new Date(`${booking.event.start_date}T23:59:59`) : null;
                                    const isPartialGoodwillRefund = booking.goodwill_status === 'approved'
                                        && booking.goodwill_refund_percent > 0
                                        && booking.goodwill_refund_percent < 100;
                                    const showFlexBookingMessage = !isRefunded && (isFlexBooking || !eventDisplayDate);
                                    const canGoodwillRequest = booking.booking_status === 'confirmed' && !canRefund && !booking.disputed_at && !booking.is_paid && !booking.goodwill_requested_at;
                                    const canDispute = booking.booking_status === 'confirmed'
                                        && !booking.disputed_at
                                        && !booking.is_paid
                                        && !canRefund
                                        && !canGoodwillRequest
                                        && (
                                            (isFlexBooking && booking.delivered_at)
                                            || (!isFlexBooking && eventDisplayDate && eventDisplayDate < new Date())
                                        );

                                    return (
                                        <div key={booking.booking_id || booking.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 transition hover:shadow-md">
                                            <img
                                                src={booking.image_url}
                                                alt={booking.title || 'Kursbild'}
                                                className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-90 transition"
                                                onClick={() => handleNavigateToCourse(booking)}
                                            />
                                            <div className="flex-grow">
                                                <div className="flex items-start justify-between">
                                                    <h3 className="font-bold text-dark cursor-pointer hover:text-primary transition" onClick={() => handleNavigateToCourse(booking)}>
                                                        {booking.title}
                                                    </h3>
                                                    {isFlexBooking && (
                                                        <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Flexibel</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500">{booking.instructor_name} • {booking.canton}</p>

                                                {/* Event info for platform bookings, or flex message */}
                                                {showFlexBookingMessage ? (
                                                    <p className="text-xs text-purple-600 mt-2">Bitte vereinbare den Termin direkt mit dem Anbieter</p>
                                                ) : booking.event ? (
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        {booking.event.start_date && new Date(booking.event.start_date).toLocaleDateString('de-CH')}
                                                        {booking.event.location && ` • ${booking.event.location}`}
                                                    </p>
                                                ) : null}

                                                <div className="mt-3 flex items-center justify-between">
                                                    {isRefunded ? (
                                                        <div className="text-gray-600 text-sm font-medium flex items-center">
                                                            <Ban className="w-4 h-4 mr-1" /> Storniert oder erstattet
                                                        </div>
                                                    ) : isEventCancelled ? (
                                                        <div className="text-red-600 text-sm font-medium flex items-center">
                                                            <XCircle className="w-4 h-4 mr-1" /> Termin abgesagt – Rückerstattung folgt
                                                        </div>
                                                    ) : (
                                                        <div className="text-green-600 text-sm font-medium flex items-center">
                                                            <CheckCircle className="w-4 h-4 mr-1" /> {t.booking_confirmed || 'Bestätigt'}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Refund section */}
                                                {isRefunded ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <p className="text-xs text-gray-500 font-medium">
                                                            {isPartialGoodwillRefund
                                                                ? `Diese Buchung wurde storniert. Rueckerstattet wurden ${booking.goodwill_refund_percent} % (CHF ${((booking.goodwill_refund_amount_cents || 0) / 100).toFixed(2)}).`
                                                                : 'Diese Buchung wurde storniert. Der Betrag wurde als Guthaben gutgeschrieben.'}
                                                        </p>
                                                        {booking.refunded_at && (
                                                            <p className="text-[10px] text-gray-400 mt-1">
                                                                Aktualisiert am {new Date(booking.refunded_at).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : canRefund ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <button
                                                            onClick={() => openRefundDialog(booking.booking_id)}
                                                            className="text-xs text-red-600 hover:text-red-700 hover:underline font-medium"
                                                        >
                                                            Buchung stornieren
                                                        </button>
                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                            Kostenlose Stornierung bis {new Date(booking.auto_refund_until).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                ) : booking.disputed_at ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <p className="text-xs text-amber-600 font-medium">Einspruch eingereicht - wird geprueft</p>
                                                    </div>
                                                ) : booking.goodwill_status === 'pending' ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <p className="text-xs text-amber-600 font-medium">Kulanzanfrage gesendet - Entscheidung des Anbieters ausstehend</p>
                                                        {booking.goodwill_request_message && (
                                                            <p className="text-[10px] text-gray-400 mt-1">{booking.goodwill_request_message}</p>
                                                        )}
                                                    </div>
                                                ) : booking.goodwill_status === 'declined' ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <p className="text-xs text-gray-500 font-medium">Kulanzanfrage wurde abgelehnt.</p>
                                                        {booking.goodwill_decision_message && (
                                                            <p className="text-[10px] text-gray-400 mt-1">{booking.goodwill_decision_message}</p>
                                                        )}
                                                        {canDispute && (
                                                            <button
                                                                onClick={() => openDisputeDialog(booking.booking_id)}
                                                                disabled={disputingBookingId === booking.booking_id}
                                                                className="mt-2 text-xs text-amber-600 hover:text-amber-700 hover:underline font-medium"
                                                            >
                                                                {disputingBookingId === booking.booking_id ? 'Wird eingereicht...' : 'Einspruch einlegen'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : canGoodwillRequest ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <button
                                                            onClick={() => openGoodwillRequestDialog(booking.booking_id)}
                                                            disabled={goodwillSubmittingId === booking.booking_id}
                                                            className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-medium"
                                                        >
                                                            {goodwillSubmittingId === booking.booking_id ? 'Wird gesendet...' : 'Kulanzanfrage senden'}
                                                        </button>
                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                            Nach Ablauf der automatischen Stornofrist kann der Anbieter freiwillig 0 %, 25 %, 50 % oder 100 % rückerstatten.
                                                        </p>
                                                    </div>
                                                ) : canDispute ? (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <button
                                                            onClick={() => openDisputeDialog(booking.booking_id)}
                                                            disabled={disputingBookingId === booking.booking_id}
                                                            className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-medium"
                                                        >
                                                            {disputingBookingId === booking.booking_id ? 'Wird eingereicht...' : 'Einspruch einlegen'}
                                                        </button>
                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                            Leistung nicht erbracht? Melde dich vor der Auszahlung.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                                        {t.no_cancellation_hint || 'Stornierung, Rückerstattung oder Umbuchung nach Absprache mit dem Anbieter.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <p className="text-gray-500 italic">{t.no_bookings_yet || "Du hast noch keine Kurse gebucht."}</p>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Saved / Merkliste */}
                        <div>
                            <h2 className="text-xl font-bold mb-4 text-dark">Merkliste</h2>
                            <div className="space-y-4">
                                {(savedCourses || []).length > 0 ? (savedCourses || []).map(course => (
                                    <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 transition hover:shadow-md">
                                        <img
                                            src={course.image_url || fallbackImage}
                                            alt={course.title}
                                            className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-90 transition"
                                            onClick={() => handleNavigateToCourse(course)}
                                        />
                                        <div className="flex-grow">
                                            <h3 className="font-bold text-dark cursor-pointer hover:text-primary transition" onClick={() => handleNavigateToCourse(course)}>
                                                {course.title}
                                            </h3>
                                            <p className="text-sm text-gray-500">{course.instructor_name} • {course.canton}</p>

                                            <div className="mt-4 flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => handleNavigateToCourse(course)}
                                                    className="text-sm font-bold text-primary hover:text-orange-700 hover:underline"
                                                >
                                                    Ansehen
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => onToggleSaveCourse && onToggleSaveCourse(course)}
                                                    className="text-sm font-bold text-red-500 hover:text-red-700 hover:underline"
                                                >
                                                    Entfernen
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-500 italic">Du hast noch keine Kurse gemerkt.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                </>
            )}
            <BookingActionModal
                dialog={actionDialog}
                onClose={closeActionDialog}
                onConfirm={confirmActionDialog}
                submitting={dialogSubmitting}
                reasonValue={actionReason}
                setReason={setActionReason}
            />

            <GoodwillDecisionModal
                dialog={goodwillDialog}
                refundPercent={goodwillDecisionPercent}
                setRefundPercent={setGoodwillDecisionPercent}
                message={goodwillDecisionMessage}
                setMessage={setGoodwillDecisionMessage}
                onClose={closeGoodwillDecisionDialog}
                onConfirm={confirmGoodwillDecisionDialog}
                submitting={!!goodwillSubmittingId}
            />

        {/* SUCCESS MODAL OVERLAY */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-primary/20 transform animate-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Crown className="w-12 h-12 text-green-600 animate-bounce" aria-hidden="true" />
                        </div>
                        <h2 id="success-modal-title" className="text-3xl font-bold font-heading text-dark mb-4">Herzlichen Glückwunsch!</h2>
                        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                            Dein Upgrade war erfolgreich! <br/>
                            Du hast jetzt Zugriff auf alle <strong>{currentPlan?.title || userTier}</strong> Features. <br/>
                            <span className="text-sm text-gray-400 mt-2 block">Viel Erfolg mit deinen Kursen!</span>
                        </p>
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            className="bg-primary text-white px-10 py-4 rounded-full font-bold hover:bg-orange-600 transition w-full shadow-lg hover:shadow-orange-500/30 text-lg"
                        >
                            Los geht's! ðŸš€
                        </button>
                    </div>
                </div>
            )}

            {/* CAPTURE SERVICE BOOKING MODAL */}
            <CaptureServiceModal
                isOpen={showCaptureServiceModal}
                onClose={() => setShowCaptureServiceModal(false)}
                user={user}
                includedServices={currentPlan?.includedCaptureServices || 0}
                usedServices={usedCaptureServices}
                showNotification={showNotification}
            />

            {/* PACKAGE UPGRADE SUCCESS MODAL */}
            {showPackageSuccessModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-primary/20 transform animate-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Crown className="w-12 h-12 text-green-600 animate-bounce" />
                        </div>
                        <h2 className="text-3xl font-bold font-heading text-dark mb-4">Herzlichen Glückwunsch!</h2>
                        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                            Dein Paket-Upgrade war erfolgreich!<br/>
                            Du hast jetzt Zugriff auf alle <strong>{currentPlan?.title || userTier}</strong> Features.<br/>
                            <span className="text-sm text-gray-400 mt-2 block">Viel Erfolg mit deinen Kursen!</span>
                        </p>
                        <button
                            onClick={() => setShowPackageSuccessModal(false)}
                            className="bg-primary text-white px-10 py-4 rounded-full font-bold hover:bg-orange-600 transition w-full shadow-lg hover:shadow-orange-500/30 text-lg"
                        >
                            Los geht's!
                        </button>
                    </div>
                </div>
            )}

            {/* CAPTURE SERVICE SUCCESS MODAL */}
            {showCaptureSuccessModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-green-200 transform animate-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-3xl font-bold font-heading text-dark mb-4">Erfolgreich gebucht!</h2>
                        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                            Dein Kurserfassungs-Service wurde erfolgreich gebucht.<br/>
                            <span className="text-sm text-gray-400 mt-2 block">
                                Unser Team wird sich innerhalb von 2-3 Werktagen bei dir melden.
                            </span>
                        </p>
                        <button
                            onClick={() => setShowCaptureSuccessModal(false)}
                            className="bg-green-600 text-white px-10 py-4 rounded-full font-bold hover:bg-green-700 transition w-full shadow-lg text-lg"
                        >
                            Verstanden
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
