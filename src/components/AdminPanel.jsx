import React, { useState, useEffect } from 'react';
import { Lock, Loader, Shield, CheckCircle, Eye, ExternalLink, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AdminPanel = ({ t, courses, setCourses, showNotification, fetchCourses, setView }) => {
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
        // In a real app we'd use pagination. Here we grab all.
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) {
            showNotification("Error loading users");
        } else {
            setProfiles(data || []);
        }
        setLoading(false);
    };

    const toggleVerify = async (userId, currentStatus, userEmail) => {
        const newStatus = !currentStatus;
        
        // 1. Profil aktualisieren & Status setzen
        const { error: profileError } = await supabase.from('profiles').update({ 
            is_professional: newStatus,
            verification_status: newStatus ? 'verified' : 'pending' 
        }).eq('id', userId);
        
        if (profileError) {
            showNotification("Error updating profile.");
            return;
        }

        // 2. ALLE Kurse dieses Lehrers gleichzeitig aktualisieren
        const { error: courseError } = await supabase.from('courses').update({ is_pro: newStatus }).eq('user_id', userId);
        
        if (courseError) {
            showNotification("Profile updated, but courses failed.");
        } else {
            setProfiles(profiles.map(p => p.id === userId ? { ...p, is_professional: newStatus, verification_status: newStatus ? 'verified' : 'pending' } : p));
            showNotification(newStatus ? "User verifiziert!" : "Verifizierung entfernt.");
            
            // AUTOMATIC EMAIL TRIGGER (Mailto)
            if (newStatus && userEmail) {
                const subject = "Glückwunsch: Dein Profil ist verifiziert!";
                const body = "Hallo,\n\nwir haben deine Unterlagen geprüft und dein Profil erfolgreich verifiziert. Du hast jetzt den 'Professional' Status und das blaue Häkchen.\n\nViel Erfolg!\nDein KursNavi Team";
                window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }

            if (typeof fetchCourses === 'function') fetchCourses();
        }
    };

    // Filter Logic
    const teachers = profiles.filter(p => p.role === 'teacher');
    const students = profiles.filter(p => p.role === 'student' || !p.role);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-gray-700" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">{t.admin_login_title}</h1>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder={t.admin_pass_placeholder}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 outline-none transition"
                        />
                        <button type="submit" className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-black transition">
                            {t.admin_btn_access}
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
                    <h1 className="text-3xl font-bold text-gray-900 font-heading">{t.admin_panel}</h1>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('admin-blog')} className="flex items-center bg-orange-100 text-orange-800 px-4 py-2 rounded-lg hover:bg-orange-200 font-bold transition border border-orange-200 shadow-sm">
                            <FileText className="w-4 h-4 mr-2"/> Blog Manager
                        </button>
                        <button onClick={() => setIsAuthenticated(false)} className="text-red-500 hover:underline font-medium">Exit</button>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex space-x-4 mb-8">
                    <button onClick={() => setActiveTab('teachers')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'teachers' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_teachers}</button>
                    <button onClick={() => setActiveTab('students')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_students}</button>
                    <button onClick={() => setActiveTab('courses')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'courses' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>{t.admin_tab_courses}</button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center"><Loader className="animate-spin mx-auto w-8 h-8 text-blue-600" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_name}</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_email}</th>
                                        {activeTab !== 'courses' && <th className="px-6 py-4 font-semibold text-gray-600">Location</th>}
                                        {activeTab === 'courses' && <th className="px-6 py-4 font-semibold text-gray-600">Price</th>}
                                        <th className="px-6 py-4 font-semibold text-gray-600">{t.admin_col_status}</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600 text-right">{t.admin_col_actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {activeTab === 'teachers' && teachers.map(user => (
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
                                            <td className="px-6 py-4">{user.city}, {user.canton}</td>
                                            <td className="px-6 py-4">
                                                {user.is_professional ? (
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold flex w-fit items-center"><CheckCircle className="w-3 h-3 mr-1"/> {t.admin_verified}</span>
                                                ) : <span className="text-gray-400 text-sm">Standard</span>}
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

                                                <button onClick={() => toggleVerify(user.id, user.is_professional, user.email)}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded transition ${user.is_professional ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                                >
                                                    {user.is_professional ? t.admin_btn_unverify : t.admin_btn_verify}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
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
                                            <td className="px-6 py-4">CHF {course.price}</td>
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
            </div>
        </div>
    );
};

export default AdminPanel;