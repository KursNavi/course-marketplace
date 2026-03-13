import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader, Mail, Eye, EyeOff } from 'lucide-react';
import { TRANSLATIONS } from '../lib/constants';
import { supabase } from '../lib/supabase';

const AuthView = ({ setView, setUser, showNotification, lang }) => {
    const [isSignUp, setIsSignUp] = useState(false); 
    const [showSuccess, setShowSuccess] = useState(false); // NEW: Success Page State
    const [loading, setLoading] = useState(false); 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [fullName, setFullName] = useState(''); 
    const [role, setRole] = useState('student');
    const [agbAccepted, setAgbAccepted] = useState(false);
    
    const t = TRANSLATIONS[lang] || TRANSLATIONS['de']; 

    const restorePendingBookingFlow = () => {
        const redirectPath = localStorage.getItem('postLoginRedirectPath');
        if (!redirectPath) return false;

        localStorage.removeItem('pendingCourseId');
        localStorage.removeItem('pendingEventId');
        localStorage.removeItem('postLoginRedirectPath');
        window.history.replaceState({ view: 'detail' }, document.title, redirectPath);
        setView('detail');
        showNotification('Bitte bestätige die Buchung noch einmal, um fortzufahren.');
        return true;
    };

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            if (isSignUp) {
                if (password !== confirmPassword) { throw new Error(t.err_passwords_mismatch); }
                if (!agbAccepted) { throw new Error(t.err_accept_terms); }
                
                // LOGIC: Retrieve selected package from previous step (TeacherHub)
            const selectedPackage = role === 'teacher'
                ? (localStorage.getItem('selectedPackage') || 'basic')
                : 'basic';

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role,
                        package_tier: selectedPackage
                    }
                }
            });

                if (authError) throw authError;
                if (authData?.user) {
                    const { error: profileError } = await supabase.from('profiles').upsert([{
                        id: authData.user.id,
                        full_name: fullName,
                        email: email,
                        preferred_language: lang,
                        role: role,
                        package_tier: selectedPackage
                    }], { onConflict: 'id' });
                    if (profileError) console.warn('Profile insert failed (will retry on login):', profileError.message);
                }
                localStorage.removeItem('selectedPackage');
                setShowSuccess(true); // Switch to success page
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                const userMetadata = data.user?.user_metadata;
                const loggedInUser = {
                    id: data.user.id,
                    email: data.user.email,
                    role: userMetadata?.role || 'student',
                    name: userMetadata?.full_name || data.user.email.split('@')[0]
                };
                setUser(loggedInUser); 

                if (!restorePendingBookingFlow()) {
                    if (loggedInUser.role === 'teacher' || loggedInUser.role === 'admin') setView('dashboard'); else setView('home');
                }
                showNotification(t.msg_welcome_back_toast);
            }
        } catch (error) { showNotification(error.message); } finally { setLoading(false); }
    };
    
    // RENDER: Success Page (After Registration)
    if (showSuccess) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
                <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 text-center">
                    <div className="flex justify-center mb-6">
                        <div className="bg-green-100 p-4 rounded-full">
                            <Mail className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 font-heading text-dark">{t.auth_success_title}</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed font-sans">{t.auth_success_text}</p>
                    <button 
                        onClick={() => { setShowSuccess(false); setIsSignUp(false); }} 
                        className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition font-heading"
                    >
                        {t.btn_go_to_login}
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-center font-heading text-dark">{isSignUp ? t.auth_create_account : t.auth_welcome_back}</h2>
                <form onSubmit={handleAuth} className="space-y-4 font-sans">
                    {isSignUp && (
                        <>
                            <div>
                                <label htmlFor="auth-name" className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_name_company}</label>
                                <input id="auth-name" required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={fullName} onChange={e => setFullName(e.target.value)} />
                                {fullName.length > 25 && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        Wir empfehlen max. 25 Zeichen ({fullName.length}/25) – bei längeren Namen wird der Anzeigename auf der Plattform je nach Darstellung mit „..." abgekürzt.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t.auth_i_am_a}</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'student' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'student'} onChange={() => setRole('student')} />{t.auth_student}
                                    </label>
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'teacher' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'teacher'} onChange={() => setRole('teacher')} />{t.auth_teacher}
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                    <div><label htmlFor="auth-email" className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_email}</label><input id="auth-email" required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <div>
                        <label htmlFor="auth-password" className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_password}</label>
                        <div className="relative">
                            <input id="auth-password" required type={showPassword ? "text" : "password"} className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                                {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                            </button>
                        </div>
                    </div>
                    {isSignUp && (
                        <div>
                            <label htmlFor="auth-confirm-password" className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_confirm_password}</label>
                            <div className="relative">
                                <input id="auth-confirm-password" required type={showConfirmPassword ? "text" : "password"} className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {isSignUp && (
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <input
                                id="agb"
                                type="checkbox"
                                checked={agbAccepted}
                                onChange={(e) => setAgbAccepted(e.target.checked)}
                                className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                            />
                            <label htmlFor="agb" className="text-sm text-gray-600 cursor-pointer">
                                <span>{t.legal_agree} <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">{t.legal_agb}</a> {role === 'teacher' ? t.legal_provider_suffix : ''} {t.legal_and} <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">{t.legal_privacy}</a> {t.legal_read ? t.legal_read : '.'}</span>
                            </label>
                        </div>
                    )}

                    <button disabled={loading} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed font-heading">{loading ? <Loader className="animate-spin mx-auto" /> : (isSignUp ? t.btn_signup : t.btn_login)}</button>
                </form>
                <p className="text-center text-sm text-gray-600 mt-6 font-sans">{isSignUp ? t.auth_already_have : t.auth_dont_have}<button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-bold ml-2 hover:underline">{isSignUp ? t.link_login : t.link_signup}</button></p>
            </div>
        </div>
    );
};

export default AuthView;
