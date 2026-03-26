import React, { useState } from 'react';
import { Loader, Mail, Eye, EyeOff, KeyRound, AlertTriangle } from 'lucide-react';
import { TRANSLATIONS } from '../lib/constants';
import { supabase } from '../lib/supabase';

const SetPasswordView = ({ setView, showNotification, lang, mode, linkExpired, onLinkExpiredDismiss }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const t = TRANSLATIONS[lang] || TRANSLATIONS['de'];

    const handleRequestReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/set-password`
            });
            if (error) throw error;
            setEmailSent(true);
            if (onLinkExpiredDismiss) onLinkExpiredDismiss();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            showNotification(t.err_passwords_mismatch, 'error');
            return;
        }
        if (password.length < 6) {
            showNotification(t.setpw_err_min_length, 'error');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            showNotification(t.setpw_success_changed);
            window.history.pushState({}, '', '/dashboard');
            setView('dashboard');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const goToLogin = () => {
        window.history.pushState({}, '', '/login');
        setView('login');
    };

    // Email sent success screen
    if (emailSent) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
                <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 text-center">
                    <div className="flex justify-center mb-6">
                        <div className="bg-green-100 p-4 rounded-full">
                            <Mail className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 font-heading text-dark">{t.setpw_email_sent_title}</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed font-sans">{t.setpw_email_sent_text}</p>
                    <button
                        onClick={goToLogin}
                        className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition font-heading"
                    >
                        {t.btn_go_to_login}
                    </button>
                </div>
            </div>
        );
    }

    // Set new password form (recovery mode)
    if (mode === 'reset') {
        return (
            <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                    <div className="flex justify-center mb-6">
                        <div className="bg-primaryLight p-4 rounded-full">
                            <KeyRound className="w-10 h-10 text-primary" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-6 text-center font-heading text-dark">{t.setpw_new_title}</h2>
                    <form onSubmit={handleSetPassword} className="space-y-4 font-sans">
                        <div>
                            <label htmlFor="new-password" className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_new_password}</label>
                            <div className="relative">
                                <input id="new-password" required type={showPassword ? "text" : "password"} className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                                    {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_confirm_password}</label>
                            <div className="relative">
                                <input id="confirm-password" required type={showConfirmPassword ? "text" : "password"} className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                                </button>
                            </div>
                        </div>
                        <button disabled={loading} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed font-heading">
                            {loading ? <Loader className="animate-spin mx-auto" /> : t.setpw_btn_save}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Request password reset form (default)
    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <div className="flex justify-center mb-6">
                    <div className="bg-primaryLight p-4 rounded-full">
                        <KeyRound className="w-10 h-10 text-primary" />
                    </div>
                </div>
                {linkExpired && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-5 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-orange-800 font-heading">{t.setpw_link_expired_title}</p>
                            <p className="text-sm text-orange-700 mt-1 font-sans">{t.setpw_link_expired_text}</p>
                        </div>
                    </div>
                )}
                <h2 className="text-2xl font-bold mb-2 text-center font-heading text-dark">{t.setpw_forgot_title}</h2>
                <p className="text-gray-600 mb-6 text-center text-sm font-sans">{t.setpw_forgot_text}</p>
                <form onSubmit={handleRequestReset} className="space-y-4 font-sans">
                    <div>
                        <label htmlFor="reset-email" className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_email}</label>
                        <input id="reset-email" required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <button disabled={loading} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed font-heading">
                        {loading ? <Loader className="animate-spin mx-auto" /> : t.setpw_btn_send_link}
                    </button>
                </form>
                <p className="text-center text-sm text-gray-600 mt-6 font-sans">
                    <button onClick={goToLogin} className="text-primary font-bold hover:underline">{t.setpw_back_to_login}</button>
                </p>
            </div>
        </div>
    );
};

export default SetPasswordView;
