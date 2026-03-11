import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Loader, Shield, CheckCircle, Eye, ExternalLink, FileText, FolderTree, Search, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PLANS } from '../lib/plans';
import { formatPriceCHF } from '../lib/formatPrice';
import AdminCategoryManager from './AdminCategoryManager';

const AdminPanel = ({ t, courses, showNotification, fetchCourses, setView, user, onImpersonate }) => {
    const isAuthenticated = user?.role === 'admin';
    const [activeTab, setActiveTab] = useState("teachers");
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [debouncedSearch, setDebouncedSearch] = useState('');

    const getAuthHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Nicht eingeloggt');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        };
    };

    // Reset search and pagination on tab change
    useEffect(() => {
        setSearchQuery('');
        setDebouncedSearch('');
        setCurrentPage(1);
    }, [activeTab]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        const offset = (currentPage - 1) * pageSize;
        const roleFilter = activeTab === 'teachers' ? 'teacher' : activeTab === 'students' ? 'student' : '';

        // 1) Try Admin API (Service Role, bypasses RLS)
        try {
            const params = new URLSearchParams({ action: 'profiles', limit: String(pageSize), offset: String(offset) });
            if (roleFilter) params.set('role', roleFilter);
            if (debouncedSearch) params.set('q', debouncedSearch);
            const headers = await getAuthHeaders();

            const res = await fetch(`/api/admin?${params}`, {
                headers
            });

            if (res.ok) {
                const json = await res.json();
                setProfiles(json.data || []);
                if (json.pagination) {
                    setTotalCount(json.pagination.total);
                }
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
            setTotalCount(data?.length || 0);
            if (!data || data.length === 0) {
                showNotification("Keine Profile sichtbar (wahrscheinlich RLS). Admin API aktivieren.");
            }
        }

        setLoading(false);
    }, [currentPage, pageSize, debouncedSearch, activeTab]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchProfiles();
        }
    }, [isAuthenticated, fetchProfiles]);

    const handleImpersonate = (profile, fromTab) => {
        if (onImpersonate) {
            // Determine role: use profile.role if set, otherwise infer from which tab the admin clicked
            const role = profile.role || (fromTab === 'teachers' ? 'teacher' : 'student');
            onImpersonate({
                id: profile.id,
                email: profile.email,
                role,
                name: profile.full_name || profile.email,
                is_professional: profile.is_professional,
                plan_tier: profile.package_tier || 'basic'
            });
            setView('dashboard');
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));


    const toggleVerify = async (userId, currentStatus, userEmail) => {
        const newStatus = !currentStatus;
        
        // 1. Profil aktualisieren & Status setzen
                // 1) Admin API (bypasses RLS)
        let apiOk = false;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers,
                body: JSON.stringify({ action: 'set-verify', userId, newStatus })
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
            const body = "Hallo,\n\nwir haben deine Unterlagen geprüft und dein Profil erfolgreich verifiziert. Dein Profil trägt jetzt den Status 'Verifiziert'.\n\nViel Erfolg!\nDein KursNavi Team";
            window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }

        if (typeof fetchCourses === 'function') fetchCourses();
    };

    // --- NEU: PAKET MANUELL ÄNDERN ---
    const changeTier = async (userId, newTier) => {
        // 1) Admin API (bypasses RLS)
        let apiOk = false;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers,
                body: JSON.stringify({ action: 'set-tier', userId, package_tier: newTier })
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


    // Profiles are now server-side filtered by role via API ?role= parameter.
    // No client-side filtering needed.


    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Access</h1>
                    <p className="text-gray-500 mb-6">Bitte melde dich mit einem Admin-Account an, um auf das Control Room zuzugreifen.</p>
                    <button
                        onClick={() => setView('login')}
                        className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-black transition"
                    >
                        Zum Login
                    </button>
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
                        <button onClick={() => setView('home')} className="text-red-500 hover:underline font-medium">Schliessen</button>
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

                {/* Search & Page Size Controls (for teachers and students tabs) */}
                {(activeTab === 'teachers' || activeTab === 'students') && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={activeTab === 'teachers' ? "Anbieter suchen (Name, Email, Ort...)" : "Lernende suchen (Name, Email...)"}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>Einträge:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                {[25, 50, 100, 250, 500].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                            <span className="text-gray-400 ml-2">Total: {totalCount}</span>
                        </div>
                    </div>
                )}

                {/* Other Tabs - Table View */}
                {activeTab !== 'categories' && (<>
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
                                    {activeTab === 'teachers' && profiles.map(user => {
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
                                                            Prio-Kurse: {plan.maxPrioCourses === Infinity ? 'unbegrenzt' : plan.maxPrioCourses} · Kategorien/Kurs: {plan.maxCategoriesPerCourse}
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
                                                        onClick={() => handleImpersonate(user, 'teachers')}
                                                        className="text-purple-600 hover:text-purple-800 p-2 rounded-md hover:bg-purple-50 transition"
                                                        title="Als User anschauen"
                                                    >
                                                        <UserCheck className="w-4 h-4" />
                                                    </button>
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

                                    {activeTab === 'students' && profiles.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold">{user.full_name}</td>
                                            <td className="px-6 py-4 text-gray-500">{user.email}</td>
                                            <td className="px-6 py-4">{user.city}, {user.canton}</td>
                                            <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Student</span></td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleImpersonate(user, 'students')}
                                                    className="text-purple-600 hover:text-purple-800 p-2 rounded-md hover:bg-purple-50 transition"
                                                    title="Als User anschauen"
                                                >
                                                    <UserCheck className="w-4 h-4" />
                                                </button>
                                            </td>
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

                {/* Pagination Controls (for teachers and students tabs) */}
                {(activeTab === 'teachers' || activeTab === 'students') && totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                        <div className="text-sm text-gray-500">
                            Seite {currentPage} von {totalPages} ({totalCount} Einträge)
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Erste
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            {/* Page number buttons */}
                            {(() => {
                                const pages = [];
                                let start = Math.max(1, currentPage - 2);
                                let end = Math.min(totalPages, start + 4);
                                if (end - start < 4) start = Math.max(1, end - 4);

                                for (let i = start; i <= end; i++) {
                                    pages.push(
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i)}
                                            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                                                i === currentPage
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            {i}
                                        </button>
                                    );
                                }
                                return pages;
                            })()}

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Letzte
                            </button>
                        </div>
                    </div>
                )}
                </>)}
            </div>
        </div>
    );
};

export default AdminPanel;
