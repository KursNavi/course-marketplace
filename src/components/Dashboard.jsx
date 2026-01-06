import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
    Loader, Settings, Save, Lock, CheckCircle, Clock, 
    ChevronDown, User, DollarSign, PenTool, Trash2, ArrowRight,
    Crown, BarChart3, AlertTriangle, Bold, Italic, Underline, Heading2, Heading3, List,
    CreditCard, Check, Shield
} from 'lucide-react';
import { SWISS_CANTONS, TIER_CONFIG } from '../lib/constants';
import { KursNaviLogo } from './Layout';
import { supabase } from '../lib/supabase';

// --- HELPER COMPONENT: User Profile Settings ---
const UserProfileSection = ({ user, showNotification, setLang, t }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState('none'); // none, pending, verified
    
    const [formData, setFormData] = useState({
        city: '', canton: '', bio_text: '', certificates: '', preferred_language: 'de', email: user.email, password: '', confirmPassword: ''
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.id) return;
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) { 
                setFormData(prev => ({ 
                    ...prev, 
                    city: data.city || '', 
                    canton: data.canton || '', 
                    additional_locations: data.additional_locations || '',
                    website_url: data.website_url || '',
                    contact_email: data.contact_email || '',
                    // MAP DB TO FORM: Use bio_text to match public profile
                    bio_text: data.bio_text || '', 
                    // MAP DB ARRAY TO STRING: Join with newlines for textarea
                    certificates: data.certificates ? data.certificates.join('\n') : '',
                    preferred_language: data.preferred_language || 'de' 
                }));
                if (data.verification_status) setVerificationStatus(data.verification_status);
            }
            setLoading(false);
        };
        fetchProfile();
    }, [user]);

    const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        
        // LOGIC: Convert textarea string back to array for DB
        const certArray = formData.certificates.split('\n').filter(line => line.trim() !== '');

        // UPDATE: Saving to bio_text, certificates, locations and contact fields
        const { error } = await supabase.from('profiles').update({ 
            city: formData.city, 
            canton: formData.canton, 
            additional_locations: formData.additional_locations,
            website_url: formData.website_url,
            contact_email: formData.contact_email,
            bio_text: formData.bio_text, 
            certificates: certArray,
            preferred_language: formData.preferred_language 
        }).eq('id', user.id);

        if (error) { showNotification("Error saving profile"); setSaving(false); return; }

        if (formData.email !== user.email || formData.password) {
            if (formData.password && formData.password !== formData.confirmPassword) { showNotification("Passwords do not match!"); setSaving(false); return; }
            const updates = {}; if (formData.email !== user.email) updates.email = formData.email; if (formData.password) updates.password = formData.password;
            const { error: authError } = await supabase.auth.updateUser(updates);
            if (authError) { showNotification("Error updating account: " + authError.message); } else { showNotification(t.msg_auth_success); }
        } else { showNotification("Profile saved successfully!"); }
        
        setLang(formData.preferred_language); setSaving(false);
    };

    const handleDocUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setUploadingDoc(true);

        const newDocUrls = [];

        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;
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
            const { data: currentProfile } = await supabase.from('profiles').select('verification_docs').eq('id', user.id).single();
            const existingDocs = currentProfile?.verification_docs || [];
            const updatedDocs = [...existingDocs, ...newDocUrls];

            const { error: dbError } = await supabase.from('profiles').update({
                verification_docs: updatedDocs,
                verification_status: 'pending'
            }).eq('id', user.id);

            if (!dbError) {
                // Notify Admin
                fetch("https://formsubmit.co/ajax/995007a94ce934b7d8c8e7776670f9c4", {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        _subject: "Neue Verifizierung (Mehrere Dateien): " + user.email,
                        message: `User: ${user.email}\nAnzahl Dateien: ${newDocUrls.length}\nBitte im Admin Panel prüfen.`
                    })
                }).catch(err => console.error("Email failed", err));

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t?.lbl_main_location || "Hauptstandort"}</label><input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_canton}</label><div className="relative"><select name="canton" value={formData.canton} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="">Kanton wählen</option>{SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t?.lbl_additional_locations || "Weitere Standorte"}</label><input type="text" name="additional_locations" value={formData.additional_locations || ''} onChange={handleChange} placeholder="z.B. Zürich, Bern, Luzern" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /><p className="text-xs text-gray-400 mt-1 italic">Tipp: Falls du Kurse an verschiedenen Orten anbietest, liste diese hier auf.</p></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Unternehmens-Website</label>
                        <div className="relative">
                            <input type="url" name="website_url" value={formData.website_url || ''} onChange={handleChange} placeholder="https://deine-seite.ch" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            <ExternalLink className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Kontakt-Email für Anfragen</label>
                        <div className="relative">
                            <input type="email" name="contact_email" value={formData.contact_email || ''} onChange={handleChange} placeholder="info@deine-firma.ch" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                            <Mail className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                        </div>
                    </div>
                </div>

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

                {/* NEW FIELDS: Biography & Certificates */}
                <div className="border-t pt-6 mt-6">
                    <h3 className="text-lg font-bold mb-4 text-dark flex items-center"><User className="w-5 h-5 mr-2 text-primary" /> {t?.lbl_bio || "Über mich / uns (Bio / Anbietervorstellung)"}</h3>
                    <div className="space-y-6">
                        <div>
                            <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                                {/* Rich Text Toolbar for Profile Bio */}
                                <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b select-none">
                                    {[
                                        { icon: <Bold className="w-4 h-4" />, tag: '**', label: 'Bold' },
                                        { icon: <Italic className="w-4 h-4" />, tag: '*', label: 'Italic' },
                                        { icon: <Underline className="w-4 h-4" />, tag: '__', label: 'Underline' },
                                        { icon: <Heading2 className="w-4 h-4" />, tag: '## ', label: 'H2', isPrefix: true },
                                        { icon: <Heading3 className="w-4 h-4" />, tag: '### ', label: 'H3', isPrefix: true },
                                        { icon: <List className="w-4 h-4" />, tag: '- ', label: 'List', isPrefix: true }
                                    ].map((btn, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            title={btn.label}
                                            onClick={() => {
                                                const textarea = document.getElementsByName('bio_text')[0];
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = textarea.value;
                                                const selected = text.substring(start, end);
                                                
                                                let replacement = btn.isPrefix 
                                                    ? `${btn.tag}${selected}`
                                                    : `${btn.tag}${selected}${btn.tag}`;
                                                
                                                const newValue = text.substring(0, start) + replacement + text.substring(end);
                                                // Update local state since Dashboard uses controlled inputs
                                                setFormData({ ...formData, bio_text: newValue });
                                                textarea.focus();
                                            }}
                                            className="p-1.5 hover:bg-white hover:text-primary rounded border border-transparent hover:border-gray-200 transition-all flex items-center justify-center bg-gray-100/50"
                                        >
                                            {btn.icon}
                                        </button>
                                    ))}
                                </div>
                                <textarea 
                                    name="bio_text" 
                                    rows="5" 
                                    value={formData.bio_text} 
                                    onChange={handleChange} 
                                    placeholder="Tell students about your experience... Use the tools above for formatting." 
                                    className="w-full px-4 py-3 outline-none resize-y block bg-gray-50 focus:bg-white transition-colors"
                                ></textarea>
                            </div>
                        </div>
                        <div className="pt-4">
                            <h3 className="text-lg font-bold mb-4 text-dark flex items-center"><PenTool className="w-5 h-5 mr-2 text-primary" /> {t?.lbl_qualifications || "Zertifikate & Qualifikationen"}</h3>
                            <textarea name="certificates" rows="3" value={formData.certificates} onChange={handleChange} placeholder="z.B. Master in Pädagogik&#10;Dipl. Yoga Instruktor..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50 focus:bg-white transition-colors"></textarea>
                        </div>
                    </div>
                </div>

                {/* VERIFICATION SECTION */}
                {user.role === 'teacher' && (
                    <div className="border-t pt-6 mt-6">
                        <h3 className="text-lg font-bold mb-4 text-blue-600 flex items-center"><Shield className="w-4 h-4 mr-2" /> Verification & Blue Check</h3>
                        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="bg-white p-2 rounded-full shadow-sm"><CheckCircle className="w-6 h-6 text-blue-500" /></div>
                                <div>
                                    <h4 className="font-bold text-dark">Get Verified (CHF 75.00)</h4>
                                    <p className="text-sm text-gray-600 mt-1">Upload your diplomas/certificates to receive the "Professional" badge and boost your bookings.</p>
                                </div>
                            </div>

                            {verificationStatus === 'verified' ? (
                            <div className="bg-green-100 text-green-800 px-4 py-6 rounded-xl flex flex-col items-center justify-center font-bold text-center">
                                <CheckCircle className="w-12 h-12 mb-2 text-green-600" /> 
                                <span className="text-lg">Dein Account ist verifiziert!</span>
                                <p className="text-sm font-normal text-green-700 mt-1">Du hast das blaue Häkchen und den "Professional" Status erhalten.</p>
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
                                                <a href="https://buy.stripe.com/test_3cIcN5dBF9ux4AoeoSbQY00" target="_blank" rel="noreferrer" className="bg-dark text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition text-center">
                                                    Zahlung öffnen (falls noch offen)
                                                </a>
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

                <div className="border-t pt-6 mt-6"><h3 className="text-lg font-bold mb-4 text-dark flex items-center"><Lock className="w-4 h-4 mr-2" /> {t.lbl_account_security}</h3><div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_new_password}</label><input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_confirm_password}</label><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div></div></div>
                <div className="pt-2"><button type="submit" disabled={saving} className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 transition flex items-center shadow-md disabled:opacity-50">{saving ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}{t.btn_save}</button></div>
            </form>
        </div>
    );
};

// --- HELPER COMPONENT: Subscription Management ---
const SubscriptionSection = ({ user, currentTier }) => {
    // WICHTIG: Ersetze diese Links mit deinen echten Stripe Payment Links!
    const STRIPE_LINKS = {
        pro: "https://buy.stripe.com/test_PRO_LINK_HERE?prefilled_email=" + user.email,
        premium: "https://buy.stripe.com/test_PREMIUM_LINK_HERE?prefilled_email=" + user.email
    };

    const tiers = [
        { id: 'basic', name: 'Basic', price: '0 CHF', features: ['3 Kurse', 'Standard Support', '15% Komm.'] },
        { id: 'pro', name: 'Pro', price: '290 CHF/Jahr', features: ['10 Kurse', 'Besseres Ranking', '12% Komm.', 'Kontaktformular'] },
        { id: 'premium', name: 'Premium', price: '590 CHF/Jahr', features: ['30 Kurse', 'Top Ranking', '10% Komm.', 'Newsletter'] }
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-2xl font-bold mb-2 flex items-center"><Crown className="w-6 h-6 mr-2 text-primary"/> Dein Abo-Status</h2>
                <p className="text-gray-600 mb-6">Du nutzt aktuell das <span className="font-bold uppercase text-dark">{currentTier}</span> Paket.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {tiers.map(tier => {
                        const isCurrent = currentTier === tier.id;
                        // Logik: Upgrade ist möglich, wenn das Tier höher ist als das aktuelle
                        const isUpgrade = (currentTier === 'basic' && tier.id !== 'basic') || (currentTier === 'pro' && tier.id === 'premium');
                        
                        return (
                            <div key={tier.id} className={`p-6 rounded-xl border-2 flex flex-col ${isCurrent ? 'border-primary bg-orange-50' : 'border-gray-100 bg-white'}`}>
                                <div className="mb-4">
                                    <h3 className="font-bold text-lg">{tier.name}</h3>
                                    <div className="text-2xl font-bold text-dark">{tier.price}</div>
                                </div>
                                <ul className="mb-6 flex-1 space-y-2">
                                    {tier.features.map((f, i) => (
                                        <li key={i} className="text-sm text-gray-600 flex items-center"><Check className="w-4 h-4 mr-2 text-green-500"/> {f}</li>
                                    ))}
                                </ul>
                                {isCurrent ? (
                                    <button disabled className="w-full py-2 bg-gray-200 text-gray-500 rounded-lg font-bold cursor-default">Aktueller Plan</button>
                                ) : isUpgrade ? (
                                    <a href={STRIPE_LINKS[tier.id]} target="_blank" rel="noreferrer" className="block w-full text-center py-2 bg-primary text-white rounded-lg font-bold hover:bg-orange-600 transition shadow-md">
                                        Upgrade
                                    </a>
                                ) : (
                                    <button disabled className="w-full py-2 border border-gray-200 text-gray-400 rounded-lg">Nicht verfügbar</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-start gap-4">
                <CreditCard className="w-6 h-6 text-blue-600 mt-1"/>
                <div>
                    <h3 className="font-bold text-blue-900">Rechnungen & Verwaltung</h3>
                    <p className="text-sm text-blue-800 mt-1">
                        Möchtest du deine Zahlungsdaten ändern oder Rechnungen herunterladen? 
                        <br/>
                        <span className="text-xs text-gray-500">(Link zum Stripe Kundenportal hier einfügen)</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT ---
const Dashboard = ({ user, t, setView, courses, teacherEarnings, myBookings, handleDeleteCourse, handleEditCourse, showNotification, changeLanguage, setSelectedCourse }) => {
    const [dashView, setDashView] = useState('overview'); 
    const [userTier, setUserTier] = useState('basic'); // basic, pro, premium
    const [showSuccessModal, setShowSuccessModal] = useState(false); // NEW: Success Modal State

    // NEW: Check for Payment Success in URL
    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get('payment') === 'success') {
            setShowSuccessModal(true);
            // URL bereinigen (damit es beim Refresh nicht nochmal kommt)
            window.history.replaceState(null, '', window.location.pathname);
            // Optional: Konfetti hier zünden, falls library vorhanden
        }
    }, []);

    // 1. Fetch User Tier
    useEffect(() => {
        if (user.role === 'teacher') {
            supabase.from('profiles').select('plan_tier').eq('id', user.id).single()
            .then(({ data }) => { if (data?.plan_tier) setUserTier(data.plan_tier); });
        }
    }, [user]);

    // 2. Calculate Limits (Business Logic)
    const currentTierConfig = TIER_CONFIG[userTier] || TIER_CONFIG['basic'];
    const maxCourses = currentTierConfig.course_limit;
    
    const totalPaidOut = user.role === 'teacher' ? teacherEarnings.filter(e => e.isPaidOut).reduce((sum, e) => sum + e.payout, 0) : 0;
    const myCourses = user.role === 'teacher' ? courses.filter(c => c.user_id === user.id) : [];
    
    const courseCount = myCourses.length;
    const canCreate = courseCount < maxCourses;
    const usagePercent = Math.min(100, (courseCount / maxCourses) * 100);

    const handleNavigateToCourse = (course) => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); };
    const handleCancelBooking = async (courseId, courseTitle) => { if (!confirm(`Are you sure you want to cancel your spot in "${courseTitle}"?`)) return; alert("Please contact support to cancel this booking."); };
    const calculateDeadline = (startDateString) => { if (!startDateString) return null; const start = new Date(startDateString); const deadline = new Date(start); deadline.setMonth(deadline.getMonth() - 1); return deadline; };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                 <div><h1 className="text-3xl font-bold text-dark font-heading">{user.role === 'teacher' ? t.teacher_dash : t.student_dash}</h1><p className="text-gray-500">Welcome back, {user.name}</p></div>
                 <div className="bg-white rounded-full p-1 border flex shadow-sm h-fit">
                    <button onClick={() => setDashView('overview')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'overview' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_overview}</button>
                    <button onClick={() => setDashView('profile')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'profile' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_settings}</button>
                    {user.role === 'teacher' && (
                        <button onClick={() => setDashView('subscription')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'subscription' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>Abo</button>
                    )}
                </div>
                
                {/* LOGIC: Create Button with Limit Check */}
                {user.role === 'teacher' && dashView === 'overview' && (
                    <div className="relative group">
                        <button 
                            onClick={() => canCreate ? handleEditCourse(null) : alert(`Limit erreicht! Ihr Paket (${userTier}) erlaubt maximal ${maxCourses} Kurse. Bitte upgraden.`)} 
                            disabled={!canCreate}
                            className={`px-6 py-3 rounded-xl font-bold flex items-center shadow-lg transition font-heading 
                                ${canCreate 
                                    ? 'bg-primary text-white hover:bg-orange-600 hover:-translate-y-0.5' 
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                            <KursNaviLogo className={`mr-2 w-5 h-5 ${canCreate ? 'text-white' : 'text-gray-400'}`} /> 
                            {t.dash_new_course}
                            {!canCreate && <Lock className="ml-2 w-4 h-4" />}
                        </button>
                    </div>
                )}
            </div>

            {dashView === 'profile' || dashView === 'settings' ? ( <UserProfileSection user={user} showNotification={showNotification} setLang={changeLanguage} t={t} /> ) : 
             dashView === 'subscription' ? ( <SubscriptionSection user={user} currentTier={userTier} /> ) : (
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
                                        {userTier === 'premium' ? <Crown className="w-6 h-6 text-yellow-400" /> : <User className="w-6 h-6 text-gray-300" />}
                                        <span className="text-2xl font-bold capitalize">{currentTierConfig.label} Mitglied</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{currentTierConfig.description}</p>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-300">Kurs-Limit ({courseCount}/{userTier === 'enterprise' ? '∞' : maxCourses})</span>
                                        <span className={`${canCreate ? 'text-green-400' : 'text-red-400'} font-bold`}>{canCreate ? 'Aktiv' : 'Limit erreicht'}</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-3 border border-gray-600">
                                        <div className={`h-full rounded-full transition-all duration-500 ${canCreate ? 'bg-primary' : 'bg-red-500'}`} style={{ width: `${usagePercent}%` }}></div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {userTier === 'basic' && (
                                        <button onClick={() => window.open('mailto:info@kursnavi.ch?subject=Upgrade Anfrage Pro', '_blank')} className="bg-white text-dark px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition shadow-lg">
                                            Auf Pro upgraden ⭐
                                        </button>
                                    )}
                                    {userTier === 'pro' && (
                                        <button onClick={() => window.open('mailto:info@kursnavi.ch?subject=Upgrade Anfrage Premium', '_blank')} className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:shadow-lg transition">
                                            Auf Premium upgraden 🚀
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
                                <button onClick={() => window.open('mailto:info@kursnavi.ch?subject=Kurserfassungs-Service Anfrage', '_blank')} className="bg-white border-2 border-primary text-primary px-5 py-2 rounded-lg font-bold shadow-sm hover:bg-primary hover:text-white transition whitespace-nowrap flex items-center">
                                    Service buchen (ab CHF 50.-) <ArrowRight className="w-4 h-4 ml-2"/>
                                </button>
                            </div>
                        </div>

                        {/* STATS & LISTS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4"><DollarSign className="text-green-600" /></div><div><p className="text-sm text-gray-500">Einnahmen (Platform)</p><p className="text-2xl font-bold text-dark">CHF {totalPaidOut.toFixed(2)}</p></div></div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4"><User className="text-blue-600" /></div><div><p className="text-sm text-gray-500">Buchungen Total</p><p className="text-2xl font-bold text-dark">{teacherEarnings.length}</p></div></div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4"><Clock className="text-purple-600" /></div><div><p className="text-sm text-gray-500">Aktive Kurse</p><p className="text-2xl font-bold text-dark">{courseCount}</p></div></div>
                        </div>

                        <h2 className="text-xl font-bold mb-4 font-heading text-dark">Buchungs-Historie (Schüler)</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                             {teacherEarnings.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                            <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Datum</th><th className="px-6 py-4 font-semibold text-gray-600">Kurs</th><th className="px-6 py-4 font-semibold text-gray-600">Schüler</th><th className="px-6 py-4 font-semibold text-gray-600">Auszahlung (Netto)</th><th className="px-6 py-4 font-semibold text-gray-600">Status</th></tr></thead>
                                            <tbody className="divide-y divide-gray-100">{teacherEarnings.map(earning => (<tr key={earning.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm text-gray-500">{earning.date}</td><td className="px-6 py-4 font-medium text-dark">{earning.courseTitle}</td><td className="px-6 py-4 text-gray-700">{earning.studentName}</td><td className="px-6 py-4 font-bold text-dark">CHF {earning.payout.toFixed(2)}</td><td className="px-6 py-4">{earning.isPaidOut ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Bezahlt</span> : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Offen</span>}</td></tr>))}</tbody>
                                    </table>
                                </div>
                             ) : <div className="p-8 text-center text-gray-500">Noch keine Buchungen über die Plattform.</div>}
                        </div>

                        <h2 className="text-xl font-bold mb-4 font-heading text-dark">Meine Kurse verwalten</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {myCourses.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                            <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Kurs</th><th className="px-6 py-4 font-semibold text-gray-600">Typ</th><th className="px-6 py-4 font-semibold text-gray-600">Preis</th><th className="px-6 py-4 font-semibold text-gray-600">Aktionen</th></tr></thead>
                                            <tbody className="divide-y divide-gray-100">{myCourses.map(course => (
                                                <tr key={course.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4"><div className="font-bold text-dark">{course.title}</div><div className="text-xs text-gray-400">{course.canton}</div></td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${course.booking_type === 'platform' ? 'bg-green-100 text-green-700' : (course.booking_type === 'external' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700')}`}>
                                                            {course.booking_type || 'platform'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium">CHF {course.price}</td>
                                                    <td className="px-6 py-4 flex gap-2">
                                                        <button onClick={() => handleEditCourse(course)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full"><PenTool className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full"><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}</tbody>
                                    </table>
                                </div>
                            ) : <div className="p-8 text-center text-gray-500">Du hast noch keine Kurse erstellt.</div>}
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-dark">{t.my_bookings}</h2>
                        <div className="space-y-4">
                            {myBookings.length > 0 ? myBookings.map(course => {
                                let canCancel = true; let deadlineText = "";
                                if (course.start_date) { const deadline = calculateDeadline(course.start_date); const now = new Date(); if (now > deadline) { canCancel = false; deadlineText = `Cancellation period ended on ${deadline.toLocaleDateString()}`; } else { deadlineText = `Cancel until ${deadline.toLocaleDateString()}`; } }
                                return (
                                    <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 transition hover:shadow-md">
                                            <img src={course.image_url} className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-90 transition" onClick={() => handleNavigateToCourse(course)} />
                                            <div className="flex-grow">
                                                <h3 className="font-bold text-dark cursor-pointer hover:text-primary transition" onClick={() => handleNavigateToCourse(course)}>{course.title}</h3>
                                                <p className="text-sm text-gray-500">{course.instructor_name} • {course.canton}</p>
                                                <div className="mt-4 flex items-center justify-between">
                                                    <div className="text-green-600 text-sm font-medium flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Confirmed</div>
                                                    {canCancel ? ( <div className="flex flex-col items-end"><button className="text-red-500 text-sm hover:text-red-700 hover:underline font-medium" onClick={() => handleCancelBooking(course.id, course.title)}>Cancel Booking</button><span className="text-xs text-gray-400 mt-1">{deadlineText}</span></div> ) : (<div className="flex items-center text-gray-400 text-sm bg-gray-50 px-2 py-1 rounded"><Lock className="w-3 h-3 mr-1" /><span>Non-refundable</span></div>)}
                                                </div>
                                            </div>
                                    </div>
                                );
                            }) : <p className="text-gray-500 italic">You haven't booked any courses yet.</p>}
                        </div>
                    </div>
                </div>
                )}
                </>
            )}
        {/* SUCCESS MODAL OVERLAY */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-primary/20 transform animate-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Crown className="w-12 h-12 text-green-600 animate-bounce" />
                        </div>
                        <h2 className="text-3xl font-bold font-heading text-dark mb-4">Herzlichen Glückwunsch!</h2>
                        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                            Dein Upgrade war erfolgreich! <br/>
                            Du hast jetzt Zugriff auf alle <strong>{userTier === 'premium' ? 'Premium' : 'Pro'}</strong> Features. <br/>
                            <span className="text-sm text-gray-400 mt-2 block">Viel Erfolg mit deinen Kursen!</span>
                        </p>
                        <button 
                            onClick={() => setShowSuccessModal(false)}
                            className="bg-primary text-white px-10 py-4 rounded-full font-bold hover:bg-orange-600 transition w-full shadow-lg hover:shadow-orange-500/30 text-lg"
                        >
                            Los geht's! 🚀
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;