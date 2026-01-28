import React, { useState, useEffect } from 'react';
import { Lock, Loader, Shield, CheckCircle, Eye, ExternalLink, FileText, FolderTree } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PLANS } from '../lib/plans';
import { formatPriceCHF } from '../lib/formatPrice';
import AdminCategoryManager from './AdminCategoryManager';

const AdminPanel = ({ t, courses, showNotification, fetchCourses, setView }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [activeTab, setActiveTab] = useState("teachers");
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);

    // SECURITY: The secret password (MVP Version)
    const ADMIN_PW = "KursNavi2025!";

    useEffect(() => {
        if (isAuthenticated) {
            fetchProfiles();
        }
    }, [isAuthenticated]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_PW) {
            setIsAuthenticated(true);
        } else {
            showNotification("Access Denied");
            setPassword("");
        }
    };

        const fetchProfiles = async () => {
        setLoading(true);

        // 1) Try Admin API (Service Role, bypasses RLS)
        try {
            const res = await fetch('/api/admin/profiles', {
                headers: { 'x-admin-secret': ADMIN_PW }
            });

            if (res.ok) {
                const json = await res.json();
                setProfiles(json.data || []);
                setLoading(false);
                return;
            } else {
                const txt = await res.text();
                console.warn('Admin profiles API failed:', res.status, txt);
            }
        } catch (e) {
            console.warn('Admin profiles API unreachable:', e);
        }

        // 2) Fallback: direct client query (may be empty due to RLS)
        const { data, error } = await supabase.from('profiles').select('*');

        if (error) {
            console.error('Error loading users:', error);
            showNotification("Error loading users: " + error.message);
            setProfiles([]);
        } else {
            setProfiles(data || []);
            if (!data || data.length === 0) {
                showNotification("Keine Profile sichtbar (wahrscheinlich RLS). Admin API aktivieren.");
            }
        }

        setLoading(false);
    };


    const toggleVerify = async (userId, currentStatus, userEmail) => {
        const newStatus = !currentStatus;
        
        // 1. Profil aktualisieren & Status setzen
                // 1) Admin API (bypasses RLS)
        let apiOk = false;
        try {
            const res = await fetch('/api/admin/set-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': ADMIN_PW
                },
                body: JSON.stringify({ userId, newStatus })
            });

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `HTTP ${res.status}`);
            }
            apiOk = true;
        } catch (e) {
            console.warn('Admin set-verify API failed, falling back:', e);
        }

        if (!apiOk) {
            // Fallback: client updates (may fail due to RLS)
            const { error: profileError } = await supabase.from('profiles').update({ 
                is_professional: newStatus,
                verification_status: newStatus ? 'verified' : 'pending' 
            }).eq('id', userId);

            if (profileError) {
                showNotification("Error updating profile: " + profileError.message);
                return;
            }

            const { error: courseError } = await supabase.from('courses').update({ is_pro: newStatus }).eq('user_id', userId);

            if (courseError) {
                showNotification("Profile updated, but courses failed: " + courseError.message);
                return;
            }
        }

        setProfiles(prev => prev.map(p => p.id === userId ? { 
            ...p, 
            is_professional: newStatus, 
            verification_status: newStatus ? 'verified' : 'pending' 
        } : p));

        showNotification(newStatus ? "User verifiziert!" : "Verifizierung entfernt.");

        if (newStatus && userEmail) {
            const subject = "Glückwunsch: Dein Profil ist verifiziert!";
            const body = "Hallo,\n\nwir haben deine Unterlagen geprüft und dein Profil erfolgreich verifiziert. Du hast jetzt den 'Professional' Status und das blaue Häkchen.\n\nViel Erfolg!\nDein KursNavi Team";
            window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }

        if (typeof fetchCourses === 'function') fetchCourses();
    };

    // --- NEU: PAKET MANUELL ÄNDERN ---
    const changeTier = async (userId, newTier) => {
        // 1) Admin API (bypasses RLS)
        let apiOk = false;
        try {
            const res = await fetch('/api/admin/set-tier', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': ADMIN_PW
                },
                body: JSON.stringify({ userId, package_tier: newTier })
            });

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `HTTP ${res.status}`);
            }
            apiOk = true;
        } catch (e) {
            console.warn('Admin set-tier API failed, falling back:', e);
        }

        if (!apiOk) {
            // Fallback: client update (may fail due to RLS)
            const { error } = await supabase
                .from('profiles')
                .update({ package_tier: newTier, courses_allowed: null })
                .eq('id', userId);

            if (error) {
                showNotification("Fehler beim Ändern des Pakets: " + error.message);
                return;
            }
        }

        showNotification(`Paket auf ${newTier.toUpperCase()} geändert`);
        setProfiles(prev => prev.map(p =>
            p.id === userId ? { ...p, package_tier: newTier, courses_allowed: null } : p
        ));
    };


        // Filter Logic (robust, falls "role" nicht (mehr) verwendet wird)
    const getRoleValue = (p) =>
        (p.role ?? p.user_type ?? p.account_type ?? p.user_role ?? p.profile_type ?? '').toString().toLowerCase();

    const isTeacher = (p) => {
        const r = getRoleValue(p);

        // Klar definierte Lehrer-Rollen
        if (['teacher', 'lehrer', 'instructor', 'anbieter', 'provider'].includes(r)) return true;

        // Alternative Flags (falls vorhanden)
        if (p.is_teacher === true || p.is_instructor === true || p.is_provider === true) return true;

        // Fallback: Wenn keine Rolle vorhanden ist, zeigen wir das Profil bei Lehrern,
        // damit Du Pakete/Limit auf jeden Fall einstellen kannst.
        if (!r) return true;

        return false;
    };

    const isStudent = (p) => {
        const r = getRoleValue(p);
        if (['student', 'schueler', 'schüler', 'learner'].includes(r)) return true;
        if (p.is_student === true) return true;
        return false;
    };

    const teachers = profiles.filter(isTeacher);
    const students = profiles.filter(isStudent);


    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-gray-700" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">{t.admin_login_title || "Admin Access"}</h1>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder={t.admin_pass_placeholder || "Passwort"}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 outline-none transition"
                        />
                        <button type="submit" className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-black transition">
                            {t.admin_btn_access || "Login"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 font-heading">{t.admin_panel || "Control Room"}</h1>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('admin-blog')} className="flex items-center bg-orange-100 text-orange-800 px-4 py-2 rounded-lg hover:bg-orange-200 font-bold transition border border-orange-200 shadow-sm">
                            <FileText className="w-4 h-4 mr-2"/> Blog Manager
                        </button>
                        <button onClick={() => setIsAuthenticated(false)} className="text-red-500 hover:underline font-medium">Exit</button>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex space-x-4 mb-8">
                    <button onClick={() => setActiveTab('teachers')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'teachers' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_teachers || "Lehrer"}</button>
                    <button onClick={() => setActiveTab('students')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_students || "Studenten"}</button>
                    <button onClick={() => setActiveTab('courses')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'courses' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_courses || "Kurse"}</button>
                    <button onClick={() => setActiveTab('categories')} className={`px-6 py-2 rounded-full font-bold transition flex items-center gap-2 ${activeTab === 'categories' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
                        <FolderTree className="w-4 h-4" /> Kategorien
                    </button>
                </div>

                                {/* Categories Tab - separate rendering */}
                {activeTab === 'categories' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <AdminCategoryManager showNotification={showNotification} />
                    </div>
                )}

                {/* Other Tabs - Table View */}
                {activeTab !== 'categories' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center"><Loader className="animate-spin mx-auto w-8 h-8 text-blue-600" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_name || "Name"}</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_email || "Email"}</th>
                                        {activeTab === 'teachers' && <th className="px-6 py-4 font-semibold text-gray-600">Paket / Kategorien</th>}
                                        {activeTab !== 'courses' && <th className="px-6 py-4 font-semibold text-gray-600">Ort</th>}
                                        {activeTab === 'courses' && <th className="px-6 py-4 font-semibold text-gray-600">Preis</th>}
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_status || "Verifiziert"}</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600 text-right">{t.admin_col_actions || "Aktionen"}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {activeTab === 'teachers' && teachers.map(user => {
                                        const planId = user.package_tier || 'basic';
                                        const plan = PLANS.find(p => p.id === planId) || PLANS[0];

                                        return (
                                            <tr key={user.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold">{user.full_name}</div>
                                                    {user.certificates && user.certificates.length > 0 && (
                                                        <div className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full w-fit mt-1 flex items-center font-medium">
                                                            <Shield className="w-3 h-3 mr-1" /> {user.certificates.length} Zertifikate
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-gray-500">{user.email}</td>

                                                {/* PAKET STEUERUNG */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <select 
                                                            className={`text-xs font-bold py-1 px-2 rounded border cursor-pointer outline-none ${
                                                                user.package_tier === 'enterprise' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                                user.package_tier === 'premium' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                                                user.package_tier === 'pro' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                                'bg-gray-100 text-gray-600 border-gray-200'
                                                            }`}
                                                            value={user.package_tier || 'basic'}
                                                            onChange={(e) => changeTier(user.id, e.target.value)}
                                                        >
                                                            <option value="basic">Basic (Free)</option>
                                                            <option value="pro">Pro</option>
                                                            <option value="premium">Premium</option>
                                                            <option value="enterprise">Enterprise</option>
                                                        </select>

                                                        <span className="text-[10px] text-gray-400">
                                                            Kurse: unbegrenzt · Kategorien/Kurs: {plan.maxCategoriesPerCourse}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">{user.city}, {user.canton}</td>

                                                <td className="px-6 py-4">
                                                    {user.is_professional ? (
                                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold flex w-fit items-center">
                                                            <CheckCircle className="w-3 h-3 mr-1"/> Verified
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">Standard</span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => alert(`--- LEHRER PROFIL ---\n\nBIOGRAFIE:\n${user.bio_text || 'Keine Biografie vorhanden.'}\n\nZERTIFIKATE:\n${user.certificates && user.certificates.length > 0 ? user.certificates.map(c => '- ' + c).join('\n') : 'Keine Zertifikate hochgeladen.'}`)}
                                                        className="text-gray-500 hover:text-primary p-2 rounded-md hover:bg-gray-100 transition"
                                                        title="Details ansehen"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {/* DOCUMENT LINK BUTTON */}
                                                    {user.verification_docs && user.verification_docs.length > 0 && (
                                                        <a 
                                                            href={user.verification_docs[0]} 
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="text-blue-500 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition"
                                                            title="Verifizierungs-Dokument ansehen"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    )}

                                                    <button
                                                        onClick={() => toggleVerify(user.id, user.is_professional, user.email)}
                                                        className={`text-xs font-bold px-3 py-1.5 rounded transition ${
                                                            user.is_professional ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                                                        }`}
                                                    >
                                                        {user.is_professional ? (t.admin_btn_unverify || "Unverify") : (t.admin_btn_verify || "Verify")}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {activeTab === 'students' && students.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold">{user.full_name}</td>
                                            <td className="px-6 py-4 text-gray-500">{user.email}</td>
                                            <td className="px-6 py-4">{user.city}, {user.canton}</td>
                                            <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Student</span></td>
                                            <td className="px-6 py-4 text-right"><span className="text-gray-400 text-xs">-</span></td>
                                        </tr>
                                    ))}
                                    {activeTab === 'courses' && courses.map(course => (
                                        <tr key={course.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold">{course.title}</td>
                                            <td className="px-6 py-4 text-gray-500">{course.instructor_name}</td>
                                            <td className="px-6 py-4">CHF {formatPriceCHF(course.price)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{new Date(course.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-blue-500 hover:underline text-sm mr-3">Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;