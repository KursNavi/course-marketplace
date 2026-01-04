import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader } from 'lucide-react';
import { TRANSLATIONS } from '../lib/constants';
import { supabase } from '../lib/supabase';

const AuthView = ({ setView, setUser, showNotification, lang }) => {
    const [isSignUp, setIsSignUp] = useState(false); 
    const [loading, setLoading] = useState(false); 
    const [email, setEmail] = useState(''); 
    const [password, setPassword] = useState(''); 
    const [fullName, setFullName] = useState(''); 
    const [role, setRole] = useState('student');
    const [inviteCode, setInviteCode] = useState(''); // NEW: Coupon State
    const [agbAccepted, setAgbAccepted] = useState(false);
    
    const t = TRANSLATIONS[lang] || TRANSLATIONS['de']; 

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            if (isSignUp) {
                if (!agbAccepted) { throw new Error(t.legal_agree + " " + t.legal_agb); } 
                
                // VALIDATION: Check Coupon Code for Teachers
                if (role === 'teacher') {
                    const validCode = 'PILOT2026'; // Hier definieren wir den gültigen Code
                    if (!inviteCode || inviteCode.trim().toUpperCase() !== validCode) {
                        throw new Error("Invalid Coupon Code. Access denied.");
                    }
                }

                // LOGIC: Retrieve selected package from previous step (TeacherHub)
            const selectedPackage = localStorage.getItem('selectedPackage') || 'basic';

            // NEW: Save invite_code AND package_tier to user metadata
            const { data: authData, error: authError } = await supabase.auth.signUp({ 
                email, 
                password, 
                options: { 
                    data: { 
                        full_name: fullName, 
                        role: role,
                        invite_code: inviteCode,
                        package_tier: selectedPackage // <--- Hier speichern wir das Paket!
                    } 
                } 
            });

                if (authError) throw authError;
                if (authData?.user) { await supabase.from('profiles').insert([{ id: authData.user.id, full_name: fullName, email: email, preferred_language: lang, role: role }]); }
                showNotification("Account created! Check your email.");
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
                
                if (loggedInUser.role === 'teacher') setView('dashboard'); else setView('home');
                showNotification("Welcome back!");
            }
        } catch (error) { showNotification(error.message); } finally { setLoading(false); }
    };
    
    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-center font-heading text-dark">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                <form onSubmit={handleAuth} className="space-y-4 font-sans">
                    {isSignUp && (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                                <input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={fullName} onChange={e => setFullName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">I am a...</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'student' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'student'} onChange={() => setRole('student')} />Student
                                    </label>
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'teacher' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'teacher'} onChange={() => setRole('teacher')} />Teacher
                                    </label>
                                </div>
                            </div>
                            {/* NEW: Invite / Coupon Code Field - TEACHER ONLY */}
                            {role === 'teacher' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Invite / Coupon Code <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none uppercase tracking-widest font-mono" 
                                        value={inviteCode} 
                                        onChange={e => setInviteCode(e.target.value)} 
                                    />
                                </div>
                            )}
                        </>
                    )}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Password</label><input required type="password" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={password} onChange={e => setPassword(e.target.value)} /></div>
                    
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
                                <span>{t.legal_agree} <a href="/agb" onClick={(e) => { e.preventDefault(); setView('agb'); }} className="text-primary hover:underline font-bold">{t.legal_agb}</a> {role === 'teacher' ? t.legal_provider_suffix : ''} {t.legal_and} <a href="/datenschutz" onClick={(e) => { e.preventDefault(); setView('datenschutz'); }} className="text-primary hover:underline font-bold">{t.legal_privacy}</a>{t.legal_read ? t.legal_read : '.'}</span>
                            </label>
                        </div>
                    )}

                    <button disabled={loading} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50 font-heading">{loading ? <Loader className="animate-spin mx-auto" /> : (isSignUp ? "Sign Up" : "Login")}</button>
                </form>
                <p className="text-center text-sm text-gray-600 mt-6 font-sans">{isSignUp ? "Already have an account?" : "Don't have an account?"}<button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-bold ml-2 hover:underline">{isSignUp ? "Login" : "Sign Up"}</button></p>
            </div>
        </div>
    );
};

export default AuthView;