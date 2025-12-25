import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, CheckCircle, ArrowLeft, LogIn, LayoutDashboard, Settings, Trash2, DollarSign, Lock, Calendar, ExternalLink, ChevronDown, ChevronRight, Mail, Phone, Loader, Heart, Shield, X, BookOpen, Star, Zap, Users, Briefcase, Smile, Music, ArrowRight, Save, Filter, BadgeCheck, Pencil } from 'lucide-react';

// --- IMPORTS ---
import { BRAND, CATEGORY_HIERARCHY, CATEGORY_LABELS, SWISS_CANTONS, SWISS_CITIES, TRANSLATIONS } from './lib/constants';
import { Navbar, Footer, KursNaviLogo } from './components/Layout';
// BRANDING: Import the new visual Home component
import { Home } from './components/Home';
import LegalPage from './components/LegalPage';

// --- Supabase Setup ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// -----------------------------------------------------------------------------
// --- SUB-COMPONENTS ---
// -----------------------------------------------------------------------------

const CategoryDropdown = ({ rootCategory, selectedCatPath, setSelectedCatPath, catMenuOpen, setCatMenuOpen, t, getCatLabel, catMenuRef }) => {
    const [lvl1, setLvl1] = useState(rootCategory); 
    const [lvl2, setLvl2] = useState(null);
    
    useEffect(() => { if (rootCategory) setLvl1(rootCategory); }, [rootCategory]);
    const availableLvl1 = rootCategory ? [rootCategory] : Object.keys(CATEGORY_HIERARCHY);

    return (
        <div ref={catMenuRef} className="static"> 
            <button onClick={() => setCatMenuOpen(!catMenuOpen)} className={`px-4 py-3 border rounded-full flex items-center space-x-2 text-sm font-medium transition ${selectedCatPath.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                <span>{selectedCatPath.length > 0 ? getCatLabel(selectedCatPath[selectedCatPath.length-1]) : t.filter_label_cat}</span><ChevronDown className="w-4 h-4" />
            </button>
            {catMenuOpen && (
                <div className="absolute top-20 left-0 right-0 mx-auto w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-50 flex h-[350px]">
                    <div className="w-1/3 border-r overflow-y-auto">
                        {availableLvl1.map(cat => (<div key={cat} onClick={() => { setLvl1(cat); setLvl2(null); }} className={`p-3 cursor-pointer text-sm flex justify-between items-center hover:bg-gray-50 ${lvl1 === cat ? 'font-bold text-primary bg-primaryLight' : 'text-gray-700'}`}>{getCatLabel(cat)}<ChevronRight className="w-4 h-4 text-gray-400" /></div>))}
                        {!rootCategory && <div onClick={() => { setSelectedCatPath([]); setCatMenuOpen(false); }} className="p-3 text-xs text-gray-400 cursor-pointer hover:text-primary border-t mt-2">Clear Selection</div>}
                    </div>
                    <div className="w-1/3 border-r overflow-y-auto bg-gray-50/50">
                        {lvl1 ? Object.keys(CATEGORY_HIERARCHY[lvl1]).map(sub => (<div key={sub} onClick={() => setLvl2(sub)} className={`p-3 cursor-pointer text-sm flex justify-between items-center hover:bg-gray-100 ${lvl2 === sub ? 'font-bold text-primary' : 'text-gray-700'}`}>{getCatLabel(sub)}<ChevronRight className="w-4 h-4 text-gray-400" /></div>)) : <div className="p-4 text-xs text-gray-400">Select a category...</div>}
                    </div>
                    <div className="w-1/3 overflow-y-auto bg-gray-50">
                        {lvl1 && lvl2 ? CATEGORY_HIERARCHY[lvl1][lvl2].map(item => (<div key={item} onClick={() => { setSelectedCatPath([lvl1, lvl2, item]); setCatMenuOpen(false); }} className="p-3 cursor-pointer text-sm text-gray-700 hover:text-primary hover:bg-white transition">{getCatLabel(item)}</div>)) : <div className="p-4 text-xs text-gray-400">Select a sub-category...</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

const LocationDropdown = ({ locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, t }) => {
    const toggleLoc = (loc) => { if (selectedLocations.includes(loc)) setSelectedLocations(selectedLocations.filter(l => l !== loc)); else setSelectedLocations([...selectedLocations, loc]); };
    const displayList = locMode === 'canton' ? SWISS_CANTONS : SWISS_CITIES;
    return (
        <div ref={locMenuRef} className="static">
            <button onClick={() => setLocMenuOpen(!locMenuOpen)} className={`px-4 py-3 border rounded-full flex items-center space-x-2 text-sm font-medium transition ${selectedLocations.length > 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                 <MapPin className="w-4 h-4" /><span>{selectedLocations.length > 0 ? `${selectedLocations.length} selected` : t.filter_label_loc}</span><ChevronDown className="w-4 h-4" />
            </button>
            {locMenuOpen && (
                <div className="absolute top-20 left-0 right-0 mx-auto bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 w-full max-w-sm">
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                        <button onClick={() => { setLocMode('canton'); setSelectedLocations([]); }} className={`flex-1 py-1 text-sm font-medium rounded-md transition ${locMode === 'canton' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>Cantons</button>
                        <button onClick={() => { setLocMode('city'); setSelectedLocations([]); }} className={`flex-1 py-1 text-sm font-medium rounded-md transition ${locMode === 'city' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>Cities</button>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto space-y-1">
                        {displayList.map(loc => (<label key={loc} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLoc(loc)} className="rounded border-gray-300 text-primary focus:ring-primary" /><span className="text-sm text-gray-700">{loc}</span></label>))}
                    </div>
                    <div className="pt-3 mt-3 border-t flex justify-between items-center"><button onClick={() => setSelectedLocations([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button><button onClick={() => setLocMenuOpen(false)} className="text-xs font-bold text-primary">Done</button></div>
                </div>
            )}
        </div>
    );
};

const UserProfileSection = ({ user, showNotification, setLang, t }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        city: '', canton: '', bio: '', preferred_language: 'de', email: user.email, password: '', confirmPassword: ''
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.id) return;
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) { setFormData(prev => ({ ...prev, city: data.city || '', canton: data.canton || '', bio: data.bio || '', preferred_language: data.preferred_language || 'de' })); }
            setLoading(false);
        };
        fetchProfile();
    }, [user]);

    const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        const { error } = await supabase.from('profiles').update({ city: formData.city, canton: formData.canton, bio: formData.bio, preferred_language: formData.preferred_language }).eq('id', user.id);
        if (error) { showNotification("Error saving profile"); setSaving(false); return; }
        if (formData.email !== user.email || formData.password) {
            if (formData.password && formData.password !== formData.confirmPassword) { showNotification("Passwords do not match!"); setSaving(false); return; }
            const updates = {}; if (formData.email !== user.email) updates.email = formData.email; if (formData.password) updates.password = formData.password;
            const { error: authError } = await supabase.auth.updateUser(updates);
            if (authError) { showNotification("Error updating account: " + authError.message); } else { showNotification(t.msg_auth_success); }
        } else { showNotification("Profile saved successfully!"); }
        setLang(formData.preferred_language); setSaving(false);
    };

    if (loading) return <div className="p-8 text-center"><Loader className="animate-spin w-8 h-8 text-primary mx-auto"/></div>;
    return (
        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-sm animate-in fade-in">
            <h2 className="text-xl font-bold mb-6 text-dark flex items-center"><Settings className="w-5 h-5 mr-2 text-gray-500" /> {t.profile_settings}</h2>
            <form onSubmit={handleSave} className="space-y-6 max-w-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_city}</label><input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Adligenswil" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_canton}</label><div className="relative"><select name="canton" value={formData.canton} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="">Select Canton</option>{SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_language}</label><div className="relative"><select name="preferred_language" value={formData.preferred_language} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="de">Deutsch (German)</option><option value="en">English</option><option value="fr">Français (French)</option><option value="it">Italiano (Italian)</option></select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_bio}</label><textarea name="bio" rows="4" value={formData.bio} onChange={handleChange} placeholder="..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"></textarea></div>
                <div className="border-t pt-6 mt-6"><h3 className="text-lg font-bold mb-4 text-dark flex items-center"><Lock className="w-4 h-4 mr-2" /> {t.lbl_account_security}</h3><div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_new_password}</label><input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_confirm_password}</label><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="******" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div></div></div>
                <div className="pt-2"><button type="submit" disabled={saving} className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 transition flex items-center shadow-md disabled:opacity-50">{saving ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}{t.btn_save}</button></div>
            </form>
        </div>
    );
};

const Dashboard = ({ user, t, setView, courses, teacherEarnings, myBookings, handleDeleteCourse, handleEditCourse, showNotification, changeLanguage, setSelectedCourse }) => {
    const [dashView, setDashView] = useState('overview'); 
    const totalPaidOut = user.role === 'teacher' ? teacherEarnings.filter(e => e.isPaidOut).reduce((sum, e) => sum + e.payout, 0) : 0;
    const myCourses = user.role === 'teacher' ? courses.filter(c => c.user_id === user.id) : [];

    const handleNavigateToCourse = (course) => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); };
    const handleCancelBooking = async (courseId, courseTitle) => { if (!confirm(`Are you sure you want to cancel your spot in "${courseTitle}"?`)) return; alert("Please contact support to cancel this booking."); };
    const calculateDeadline = (startDateString) => { if (!startDateString) return null; const start = new Date(startDateString); const deadline = new Date(start); deadline.setMonth(deadline.getMonth() - 1); return deadline; };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                 <div><h1 className="text-3xl font-bold text-dark font-heading">{user.role === 'teacher' ? t.teacher_dash : t.student_dash}</h1><p className="text-gray-500">Welcome back, {user.name}</p></div>
                 <div className="bg-white rounded-full p-1 border flex shadow-sm h-fit"><button onClick={() => setDashView('overview')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'overview' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_overview}</button><button onClick={() => setDashView('profile')} className={`px-4 py-2 rounded-full text-sm font-bold transition ${dashView === 'profile' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>{t.dash_settings}</button></div>
                {user.role === 'teacher' && dashView === 'overview' && <button onClick={() => handleEditCourse(null)} className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 flex items-center shadow-lg hover:-translate-y-0.5 transition font-heading"><KursNaviLogo className="mr-2 w-5 h-5 text-white" /> {t.dash_new_course}</button>}
            </div>
            {dashView === 'profile' ? ( <UserProfileSection user={user} showNotification={showNotification} setLang={changeLanguage} t={t} /> ) : (
                <>
                {user.role === 'teacher' ? (
                    <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4"><DollarSign className="text-green-600" /></div><div><p className="text-sm text-gray-500">Total Payouts Received</p><p className="text-2xl font-bold text-dark">CHF {totalPaidOut.toFixed(2)}</p></div></div>
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4"><User className="text-blue-600" /></div><div><p className="text-sm text-gray-500">Total Students</p><p className="text-2xl font-bold text-dark">{teacherEarnings.length}</p></div></div>
                        </div>
                        <h2 className="text-xl font-bold mb-4 font-heading text-dark">Student & Earnings History</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                             {teacherEarnings.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Date</th><th className="px-6 py-4 font-semibold text-gray-600">Course</th><th className="px-6 py-4 font-semibold text-gray-600">Student</th><th className="px-6 py-4 font-semibold text-gray-600">Your Payout (85%)</th><th className="px-6 py-4 font-semibold text-gray-600">Status</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">{teacherEarnings.map(earning => (<tr key={earning.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm text-gray-500">{earning.date}</td><td className="px-6 py-4 font-medium text-dark">{earning.courseTitle}</td><td className="px-6 py-4 text-gray-700">{earning.studentName}</td><td className="px-6 py-4 font-bold text-dark">CHF {earning.payout.toFixed(2)}</td><td className="px-6 py-4">{earning.isPaidOut ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid Out</span> : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>}</td></tr>))}</tbody>
                                    </table>
                                </div>
                             ) : <div className="p-8 text-center text-gray-500">No student bookings yet.</div>}
                        </div>
                        <h2 className="text-xl font-bold mb-4 font-heading text-dark">My Active Courses</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {myCourses.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-beige border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Course</th><th className="px-6 py-4 font-semibold text-gray-600">Price</th><th className="px-6 py-4 font-semibold text-gray-600">Actions</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">{myCourses.map(course => (
                                            <tr key={course.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4"><div className="font-bold text-dark">{course.title}</div><div className="text-xs text-gray-400">{course.category}</div></td>
                                                <td className="px-6 py-4 font-medium">CHF {course.price}</td>
                                                <td className="px-6 py-4 flex gap-2">
                                                    <button onClick={() => handleEditCourse(course)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full"><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            ) : <div className="p-8 text-center text-gray-500">You haven't posted any courses yet.</div>}
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
        </div>
    );
};

const TeacherForm = ({ t, setView, user, handlePublishCourse, getCatLabel, initialData }) => {
    const [lvl1, setLvl1] = useState(Object.keys(CATEGORY_HIERARCHY)[0]); 
    const [lvl2, setLvl2] = useState(Object.keys(CATEGORY_HIERARCHY[lvl1])[0]);

    useEffect(() => {
        if (initialData && initialData.category) {
            const parts = initialData.category.split(' | ');
            if (parts.length >= 2) { setLvl1(parts[0]); setLvl2(parts[1]); }
        }
    }, [initialData]);

    const handleLvl1Change = (e) => { const val = e.target.value; setLvl1(val); setLvl2(Object.keys(CATEGORY_HIERARCHY[val])[0]); };
    
    return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
        <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> {t.btn_back_dash}</button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4"><h1 className="text-3xl font-bold text-dark font-heading">{initialData ? t.edit_course : t.create_course}</h1><p className="text-gray-500 mt-2">{initialData ? t.edit_course_sub : t.create_course_sub}</p></div>
            <form onSubmit={handlePublishCourse} className="space-y-6">
                {initialData && <input type="hidden" name="course_id" value={initialData.id} />}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_title}</label><input required type="text" name="title" defaultValue={initialData?.title} placeholder="e.g. Traditional Swiss Cooking" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none transition-shadow" /></div>
                    
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_skill_level}</label><select name="level" defaultValue={initialData?.level || "All Levels"} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm outline-none"><option value="All Levels">{t.opt_all_levels}</option><option value="Beginner">{t.opt_beginner}</option><option value="Advanced">{t.opt_advanced}</option></select></div>
                         <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_target_group}</label><select name="target_group" defaultValue={initialData?.target_group || "Adults"} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm outline-none"><option value="Adults">{t.opt_adults}</option><option value="Teens">{t.opt_teens}</option><option value="Kids">{t.opt_kids}</option></select></div>
                         <div className="flex items-center p-3 border rounded-lg bg-gray-50"><input type="checkbox" name="is_pro" id="is_pro" defaultChecked={initialData?.is_pro} className="w-5 h-5 text-primary focus:ring-primary rounded border-gray-300 mr-3" /><label htmlFor="is_pro" className="text-sm font-bold text-gray-700 cursor-pointer flex items-center">{t.lbl_pro_checkbox} <BadgeCheck className="w-4 h-4 ml-1 text-blue-500" /></label></div>
                    </div>

                    <div className="md:col-span-2 bg-beige p-4 rounded-xl border border-orange-100">
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t.lbl_cat_class}</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><span className="text-xs text-gray-500 block mb-1">{t.lbl_type}</span><select name="catLvl1" value={lvl1} onChange={handleLvl1Change} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">{Object.keys(CATEGORY_HIERARCHY).map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                            <div><span className="text-xs text-gray-500 block mb-1">{t.lbl_area}</span><select name="catLvl2" value={lvl2} onChange={(e) => setLvl2(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">{Object.keys(CATEGORY_HIERARCHY[lvl1]).map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                            <div><span className="text-xs text-gray-500 block mb-1">{t.lbl_specialty}</span><select name="catLvl3" defaultValue={initialData ? initialData.category.split(' | ')[2] : ''} className="w-full px-3 py-2 border rounded-lg focus:ring-primary bg-white text-sm">{CATEGORY_HIERARCHY[lvl1][lvl2].map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                        </div>
                    </div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_price}</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500 font-bold">CHF</span><input required type="number" name="price" defaultValue={initialData?.price} className="w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_canton}</label><div className="relative"><select name="canton" defaultValue={initialData?.canton} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white">{SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_specific_address}</label><input required type="text" name="address" defaultValue={initialData?.address} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_session_count}</label><input required type="number" name="sessionCount" defaultValue={initialData?.session_count || 1} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_session_length}</label><input required type="text" name="sessionLength" defaultValue={initialData?.session_length} placeholder="e.g. 2 hours" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_start_date}</label><div className="relative"><Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input required type="date" name="startDate" defaultValue={initialData?.start_date} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_website}</label><div className="relative"><ExternalLink className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input type="url" name="providerUrl" defaultValue={initialData?.provider_url} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div></div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_description}</label><textarea required name="description" defaultValue={initialData?.description} rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"></textarea></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_learn_goals}</label><textarea required name="objectives" defaultValue={initialData?.objectives?.join('\n')} rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Enter each objective on a new line..."></textarea></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_prereq}</label><input type="text" name="prerequisites" defaultValue={initialData?.prerequisites} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                <div className="pt-4 border-t border-gray-100 flex justify-end"><button type="submit" className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 shadow-lg hover:-translate-y-0.5 transition flex items-center font-heading"><KursNaviLogo className="w-5 h-5 mr-2 text-white" />{initialData ? t.btn_update : t.btn_publish}</button></div>
            </form>
        </div>
    </div>
    );
};

const SuccessView = ({ setView }) => (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
            <h2 className="text-3xl font-bold text-dark mb-4 font-heading">Payment Successful!</h2>
            <p className="text-gray-600 mb-8 font-sans">Thank you for your booking. You will receive a confirmation email shortly.</p>
            <button onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); setView('dashboard'); }} className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition font-heading">Go to My Courses</button>
        </div>
    </div>
);

const AuthView = ({ setView, showNotification, lang }) => {
    const [isSignUp, setIsSignUp] = useState(false); const [loading, setLoading] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [fullName, setFullName] = useState(''); const [role, setRole] = useState('student');
    const [agbAccepted, setAgbAccepted] = useState(false);
    const t = TRANSLATIONS[lang] || TRANSLATIONS['de']; 

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            if (isSignUp) {
                if (!agbAccepted) { throw new Error(t.legal_agree + " " + t.legal_agb); } 
                const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role: role } } });
                if (authError) throw authError;
                if (authData?.user) { await supabase.from('profiles').insert([{ id: authData.user.id, full_name: fullName, email: email, preferred_language: lang }]); }
                showNotification("Account created! Check your email.");
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                const userRole = data.user?.user_metadata?.role;
                if (userRole === 'teacher') setView('dashboard'); else setView('home');
                showNotification("Welcome back!");
            }
        } catch (error) { showNotification(error.message); } finally { setLoading(false); }
    };
    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-beige">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-center font-heading text-dark">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                <form onSubmit={handleAuth} className="space-y-4 font-sans">
                    {isSignUp && (<><div><label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label><input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" value={fullName} onChange={e => setFullName(e.target.value)} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">I am a...</label><div className="flex gap-4"><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'student' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}><input type="radio" className="hidden" checked={role === 'student'} onChange={() => setRole('student')} />Student</label><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'teacher' ? 'bg-primaryLight border-primary text-primary font-bold' : 'hover:bg-gray-50'}`}><input type="radio" className="hidden" checked={role === 'teacher'} onChange={() => setRole('teacher')} />Teacher</label></div></div></>)}
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

const DetailView = ({ course, setView, t, handleBookCourse }) => (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in duration-500 font-sans">
      <button onClick={() => setView('home')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> Back to courses</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <div className="relative rounded-2xl overflow-hidden shadow-lg h-80">
                <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 flex gap-2">
                    <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-bold text-gray-800 flex items-center shadow-sm"><MapPin className="w-4 h-4 mr-1 text-primary" /> {course.canton}</div>
                    {course.is_pro && <div className="bg-blue-600/90 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-bold text-white flex items-center shadow-sm"><BadgeCheck className="w-4 h-4 mr-1" /> Pro</div>}
                </div>
            </div>
            <div>
                <h1 className="text-3xl font-extrabold text-dark mb-3 font-heading">{course.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500"><span className="flex items-center"><User className="w-4 h-4 mr-1" /> {course.instructor_name}</span></div>
                <div className="mt-3 flex gap-2">
                      <span className="text-xs font-bold text-primary bg-primaryLight px-2 py-1 rounded border border-orange-100">{course.category}</span>
                      {course.level && <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">{course.level}</span>}
                      {course.target_group && <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">{course.target_group}</span>}
                </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div><h3 className="text-xl font-bold mb-3 text-dark font-heading">{t.lbl_description}</h3><p className="text-gray-600 leading-relaxed text-lg">{course.description}</p></div>
                {course.objectives && (<div><h3 className="text-xl font-bold mb-3 text-dark font-heading">{t.lbl_objectives}</h3><ul className="space-y-2">{course.objectives.map((obj, i) => (<li key={i} className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" /><span className="text-gray-700">{obj}</span></li>))}</ul></div>)}
            </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 sticky top-24">
            <div className="mb-6 border-b pb-6">
                <span className="text-4xl font-extrabold text-dark block mb-1 font-heading">{t.currency} {course.price}</span><span className="text-sm text-gray-500 block mb-4">per person</span>
                <button onClick={() => handleBookCourse(course)} className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-orange-600 transition shadow-md active:scale-95 font-heading">{t.btn_pay}</button>
            </div>
             {course.start_date && (<div className="mb-6 pb-6 border-b border-gray-100"><div className="flex items-center text-primary font-bold mb-1"><Calendar className="w-5 h-5 mr-2" /><span>Start Date</span></div><div className="text-xl font-bold text-dark ml-7">{new Date(course.start_date).toLocaleDateString('en-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>)}
            <div className="space-y-4">
                <div className="flex items-start"><div className="w-8 flex-shrink-0"><MapPin className="w-5 h-5 text-gray-400" /></div><div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_address}</span><span className="text-gray-700 font-medium">{course.address || course.canton}</span></div></div>
                {course.session_count && (<div className="flex items-start"><div className="w-8 flex-shrink-0"><Clock className="w-5 h-5 text-gray-400" /></div><div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_duration}</span><span className="text-gray-700 font-medium">{course.session_count} sessions × {course.session_length}</span></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
);

const AboutPage = ({ t }) => (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500 font-sans">
        <div className="text-center mb-12"><h1 className="text-4xl font-extrabold text-dark mb-4 font-heading">{t.about_title}</h1><p className="text-xl text-gray-500">{t.about_subtitle}</p></div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-12">
            <img src="https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?auto=format&fit=crop&q=80&w=1200" alt="Swiss Landscape" className="w-full h-64 object-cover" />
            <div className="p-8 space-y-6">
                <p className="text-lg text-gray-700 leading-relaxed">{t.about_text}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <div className="flex items-start"><Heart className="w-8 h-8 text-primary mr-4 flex-shrink-0" /><div><h3 className="font-bold text-dark mb-1 font-heading">{t.about_community_title}</h3><p className="text-gray-600">{t.about_community_text}</p></div></div>
                    <div className="flex items-start"><Shield className="w-8 h-8 text-primary mr-4 flex-shrink-0" /><div><h3 className="font-bold text-dark mb-1 font-heading">{t.about_quality_title}</h3><p className="text-gray-600">{t.about_quality_text}</p></div></div>
                </div>
            </div>
        </div>
    </div>
);

const ContactPage = ({ t, handleContactSubmit, setView }) => (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500 font-sans">
        <h1 className="text-4xl font-extrabold text-dark mb-8 text-center font-heading">{t.contact_title}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
                <div className="bg-primaryLight p-6 rounded-2xl border border-orange-100">
                    <h3 className="font-bold text-lg mb-4 text-primary font-heading">{t.contact_get_in_touch}</h3>
                    <div className="space-y-4">
                        <div className="flex items-center text-gray-700"><Mail className="w-5 h-5 mr-3 text-primary" /><span>info@kursnavi.ch</span></div>
                        <div className="flex items-start text-gray-700"><MapPin className="w-5 h-5 mr-3 text-primary mt-1" /><span>LifeSkills360 GmbH<br/>Talrain 25<br/>6043 Adligenswil</span></div>
                    </div>
                </div>
                <div><h3 className="font-bold text-lg mb-2 font-heading">{t.contact_office_hours}</h3><p className="text-gray-600">{t.contact_mon_fri}</p><p className="text-gray-600">{t.contact_weekend}</p></div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                    {/* EMAIL (First) */}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input required type="email" name="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="you@example.com" /></div>
                    
                    {/* NAME (Optional but standard) */}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Name</label><input required type="text" name="name" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Your Name" /></div>

                    {/* SUBJECT (Added) */}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Betreff / Subject</label><input required type="text" name="subject" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="..." /></div>

                    {/* MESSAGE */}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_msg || "Message"}</label><textarea required name="message" rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="..."></textarea></div>
                    
                    <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition font-heading">{t.btn_send}</button>
                </form>
            </div>
        </div>
    </div>
);

const AdminPanel = ({ t, courses }) => (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
        <div className="flex items-center justify-between mb-8"><h1 className="text-3xl font-bold text-dark flex items-center font-heading"><Settings className="mr-3 w-8 h-8 text-gray-700" />{t.admin_panel}</h1><span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">Logged in as Admin</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="font-bold text-xl mb-4 text-dark">Platform Stats</h3><div className="space-y-4"><div className="flex justify-between border-b pb-2"><span>Total Courses</span><span className="font-bold">{courses.length}</span></div><div className="flex justify-between border-b pb-2"><span>Total Bookings</span><span className="font-bold">--</span></div></div></div></div>
    </div>
);

const LandingPageContent = ({ t, setView }) => (
    <div className="space-y-24 py-12 animate-in fade-in duration-700">
        <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-16 text-dark font-heading">{t.how_it_works}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-8">
                    <div className="flex items-center space-x-4 mb-8"><div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-primary"><Users className="w-6 h-6" /></div><h3 className="text-2xl font-bold text-dark">{t.for_students}</h3></div>
                    <div className="space-y-8 pl-4 border-l-2 border-orange-100">
                        <div><h4 className="font-bold text-lg mb-1 flex items-center"><Search className="w-4 h-4 mr-2 text-primary" /> {t.student_step_1}</h4><p className="text-gray-600">{t.student_desc_1}</p></div>
                        <div><h4 className="font-bold text-lg mb-1 flex items-center"><Calendar className="w-4 h-4 mr-2 text-primary" /> {t.student_step_2}</h4><p className="text-gray-600">{t.student_desc_2}</p></div>
                        <div><h4 className="font-bold text-lg mb-1 flex items-center"><Star className="w-4 h-4 mr-2 text-primary" /> {t.student_step_3}</h4><p className="text-gray-600">{t.student_desc_3}</p></div>
                    </div>
                </div>
                <div className="space-y-8">
                      <div className="flex items-center space-x-4 mb-8"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><Zap className="w-6 h-6" /></div><h3 className="text-2xl font-bold text-dark">{t.for_tutors}</h3></div>
                    <div className="space-y-8 pl-4 border-l-2 border-blue-100">
                          <div><h4 className="font-bold text-lg mb-1 flex items-center"><BookOpen className="w-4 h-4 mr-2 text-blue-500" /> {t.tutor_step_1}</h4><p className="text-gray-600">{t.tutor_desc_1}</p></div>
                        <div><h4 className="font-bold text-lg mb-1 flex items-center"><Clock className="w-4 h-4 mr-2 text-blue-500" /> {t.tutor_step_2}</h4><p className="text-gray-600">{t.tutor_desc_2}</p></div>
                        <div><h4 className="font-bold text-lg mb-1 flex items-center"><DollarSign className="w-4 h-4 mr-2 text-blue-500" /> {t.tutor_step_3}</h4><p className="text-gray-600">{t.tutor_desc_3}</p></div>
                    </div>
                </div>
            </div>
        </div>
        <div className="bg-dark py-20">
            <div className="max-w-4xl mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 font-heading">{t.cta_title}</h2><p className="text-xl text-gray-300 mb-10 leading-relaxed">{t.cta_subtitle}</p>
                <button onClick={() => setView('how-it-works')} className="bg-primary text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition transform hover:-translate-y-1 shadow-xl">{t.cta_btn}</button>
            </div>
        </div>
    </div>
);

const HowItWorksPage = ({ t, setView }) => (
    <div className="pt-8">
        <button onClick={() => setView('home')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors px-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back</button>
        <LandingPageContent t={t} setView={setView} />
    </div>
);

const LandingView = ({ title, subtitle, variant = 'main', searchQuery, setSearchQuery, handleSearchSubmit, setSelectedCatPath, setView, t }) => {
    return (
      <>
          <div className={`py-24 px-4 ${variant === 'main' ? 'bg-white' : variant === 'private' ? 'bg-primaryLight' : variant === 'prof' ? 'bg-slate-900 text-white' : 'bg-yellow-50'}`}>
              <div className="max-w-4xl mx-auto text-center space-y-6">
                  <div className="flex justify-center mb-6">
                      {variant === 'main' && <KursNaviLogo className="w-24 h-24" />}
                      {variant === 'private' && <Music className="w-24 h-24 text-primary" />}
                      {variant === 'prof' && <Briefcase className="w-24 h-24 text-blue-400" />}
                      {variant === 'kids' && <Smile className="w-24 h-24 text-yellow-500" />}
                  </div>
                  <h1 className={`text-4xl md:text-6xl font-extrabold tracking-tight font-heading ${variant === 'prof' ? 'text-white' : 'text-primary'}`}>{title}</h1>
                  <p className={`text-xl max-w-2xl mx-auto ${variant === 'prof' ? 'text-gray-300' : 'text-gray-500'}`}>{subtitle}</p>
              </div>
          </div>

          <div className={`border-b sticky top-20 z-40 shadow-sm ${variant === 'prof' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
              <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative flex-grow w-full md:w-auto">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input type="text" placeholder={t.search_placeholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()} className="w-full pl-10 pr-4 py-3 bg-beige border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                  </div>
                  <button onClick={handleSearchSubmit} className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-orange-600 transition shadow-md">{t.btn_search}</button>
              </div>
          </div>

          {variant === 'main' && (
              <div className="max-w-7xl mx-auto px-4 py-12">
                  <h3 className="text-2xl font-bold text-center mb-8 text-dark">Find the right course for you</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div onClick={() => { setSelectedCatPath(['Private & Hobby']); setView('landing-private'); window.scrollTo(0,0); }} className="bg-white p-8 rounded-2xl shadow-lg hover:-translate-y-2 transition cursor-pointer border-t-4 border-primary text-center group">
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition"><Music className="w-8 h-8 text-primary group-hover:text-white" /></div>
                          <h2 className="text-xl font-bold mb-2">{t.nav_private}</h2>
                          <p className="text-gray-500">Music, Art, Cooking, Sports. Pursue your passion.</p>
                      </div>
                      <div onClick={() => { setSelectedCatPath(['Professional']); setView('landing-prof'); window.scrollTo(0,0); }} className="bg-white p-8 rounded-2xl shadow-lg hover:-translate-y-2 transition cursor-pointer border-t-4 border-blue-600 text-center group">
                          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-600 transition"><Briefcase className="w-8 h-8 text-blue-600 group-hover:text-white" /></div>
                          <h2 className="text-xl font-bold mb-2">{t.nav_professional}</h2>
                          <p className="text-gray-500">Business, Tech, Soft Skills. Advance your career.</p>
                      </div>
                      <div onClick={() => { setSelectedCatPath(['Children']); setView('landing-kids'); window.scrollTo(0,0); }} className="bg-white p-8 rounded-2xl shadow-lg hover:-translate-y-2 transition cursor-pointer border-t-4 border-yellow-500 text-center group">
                          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-yellow-500 transition"><Smile className="w-8 h-8 text-yellow-500 group-hover:text-white" /></div>
                          <h2 className="text-xl font-bold mb-2">{t.nav_kids}</h2>
                          <p className="text-gray-500">Tutoring, Creative Arts, Camps. Fun for kids.</p>
                      </div>
                  </div>
              </div>
          )}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <LandingPageContent t={t} setView={setView} />
          </div>
      </>
    );
};

const SearchPageView = ({ selectedCatPath, setSelectedCatPath, searchQuery, setSearchQuery, catMenuOpen, setCatMenuOpen, catMenuRef, t, getCatLabel, locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, loading, filteredCourses, setSelectedCourse, setView, filterDate, setFilterDate, filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel, filterPro, setFilterPro }) => {
    const activeSection = selectedCatPath.length > 0 ? selectedCatPath[0] : null;

    return (
        <div className="min-h-screen bg-beige">
            <div className="bg-white border-b pt-8 pb-4 sticky top-20 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input type="text" placeholder="Refine search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-beige border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                        </div>
                        <CategoryDropdown rootCategory={activeSection} selectedCatPath={selectedCatPath} setSelectedCatPath={setSelectedCatPath} catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} t={t} getCatLabel={getCatLabel} catMenuRef={catMenuRef} /> 
                        <LocationDropdown locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} />
                        {(selectedCatPath.length > 0 || selectedLocations.length > 0 || filterDate || filterPriceMax || filterLevel !== 'All' || filterPro) && (<button onClick={() => { setSelectedCatPath([]); setSelectedLocations([]); setSearchQuery(""); setFilterDate(""); setFilterPriceMax(""); setFilterLevel("All"); setFilterPro(false); }} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100" title="Reset all filters"><X className="w-5 h-5" /></button>)}
                    </div>
                    {/* NEW FILTERS ROW */}
                    <div className="flex gap-4 overflow-x-auto pb-2 items-center">
                        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600" />
                        </div>
                        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <span className="text-sm text-gray-500">Max CHF</span>
                            <input type="number" placeholder="Any" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-16 bg-transparent text-sm outline-none text-gray-600" />
                        </div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm outline-none text-gray-600">
                            <option value="All">All Levels</option>
                            <option value="Beginner">Beginner</option><option value="Advanced">Advanced</option>
                        </select>
                         <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterPro ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                            <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span className={`text-sm font-medium ${filterPro ? 'text-blue-700' : 'text-gray-600'}`}>Professional</span>
                        </label>
                    </div>
                </div>
                 {(selectedCatPath.length > 0 || selectedLocations.length > 0) && (<div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2 flex-wrap">{selectedCatPath.map((part, i) => (<span key={i} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold">{getCatLabel(part)}</span>))}{selectedLocations.map((loc, i) => (<span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold">{loc}</span>))}</div>)}
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                 {loading ? <div className="text-center py-20"><Loader className="animate-spin w-10 h-10 text-primary mx-auto" /></div> : filteredCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {filteredCourses.map(course => (
                      <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                        <div className="relative h-48 overflow-hidden">
                            <img src={course.image_url} alt={course.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                                <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm flex items-center"><MapPin className="w-3 h-3 mr-1 text-primary" />{course.canton}</div>
                                {course.is_pro && <div className="bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-bold shadow-sm flex items-center"><BadgeCheck className="w-3 h-3 mr-1" /> Pro</div>}
                            </div>
                        </div>
                        <div className="p-5">
                            <h3 className="font-bold text-lg text-dark leading-tight line-clamp-2 h-12 mb-2 font-heading">{course.title}</h3>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                               <div className="flex items-center space-x-3 text-sm text-gray-500"><div className="flex items-center bg-beige px-2 py-1 rounded"><User className="w-3 h-3 text-gray-500 mr-1" />{course.instructor_name}</div></div>
                               <span className="font-bold text-primary text-lg font-heading">{t.currency} {course.price}</span>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300"><p className="text-gray-500 text-lg font-medium">{t.no_results}</p></div>}
            </main>
        </div>
    );
};

// -----------------------------------------------------------------------------
// --- MAIN APP COMPONENT ---
// -----------------------------------------------------------------------------

export default function KursNaviPro() {
  const [lang, setLang] = useState('de');
  const [view, setView] = useState('home'); 
  const [user, setUser] = useState(null); 
  const [session, setSession] = useState(null);
  
  // App State
  const [courses, setCourses] = useState([]); 
  const [myBookings, setMyBookings] = useState([]); 
  const [teacherEarnings, setTeacherEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [selectedCatPath, setSelectedCatPath] = useState([]); 
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const [locMode, setLocMode] = useState('canton'); 
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [notification, setNotification] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null); // State for Edit Mode

  // NEW FILTER STATE
  const [filterDate, setFilterDate] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterLevel, setFilterLevel] = useState("All");
  const [filterPro, setFilterPro] = useState(false);

  const catMenuRef = useRef(null);
  const locMenuRef = useRef(null);

  const changeLanguage = async (newLang) => {
    setLang(newLang);
    if (user && user.id) {
        const { error } = await supabase.from('profiles').update({ preferred_language: newLang }).eq('id', user.id);
        if (error) console.error("Failed to save language preference:", error);
    }
  };

  // --- URL SYNCHRONIZATION ---
  useEffect(() => {
    let path = '/';
    if (view === 'landing-private') path = '/private';
    else if (view === 'landing-prof') path = '/professional';
    else if (view === 'landing-kids') path = '/children';
    else if (view === 'search') path = '/search';
    else if (view === 'how-it-works') path = '/how-it-works';
    else if (view === 'about') path = '/about';
    else if (view === 'contact') path = '/contact';
    else if (view === 'login') path = '/login';
    else if (view === 'dashboard') path = '/dashboard';
    
    // --- LEGAL PATHS ---
    else if (view === 'agb') path = '/agb';
    else if (view === 'datenschutz') path = '/datenschutz';
    else if (view === 'impressum') path = '/impressum';
    else if (view === 'widerruf') path = '/widerruf-storno';
    else if (view === 'trust') path = '/vertrauen-sicherheit';

    else if (view === 'create') path = '/create-course';
    else if (view === 'detail' && selectedCourse) path = `/course/${selectedCourse.id}`;
    
    if (window.location.pathname !== path) {
        window.history.pushState({ view, courseId: selectedCourse?.id }, '', path);
    }
  }, [view, selectedCourse]);

  // --- POPSTATE HANDLER & INITIAL LOAD FIX ---
  useEffect(() => {
    const handleUrlChange = () => {
        const path = window.location.pathname;
        // Legal Pages
        if (path === '/agb') setView('agb');
        else if (path === '/datenschutz') setView('datenschutz');
        else if (path === '/impressum') setView('impressum');
        else if (path === '/widerruf-storno') setView('widerruf');
        else if (path === '/vertrauen-sicherheit') setView('trust');
        
        // Standard Pages
        else if (path === '/search') setView('search');
        else if (path === '/dashboard') setView('dashboard');
        else if (path === '/how-it-works') setView('how-it-works');
        else if (path === '/about') setView('about');
        else if (path === '/contact') setView('contact');
        else if (path === '/login') setView('login');
        else if (path === '/create-course') setView('create');
        
        // Category Landings
        else if (path === '/private') { setSelectedCatPath(['Private & Hobby']); setView('landing-private'); }
        else if (path === '/professional') { setSelectedCatPath(['Professional']); setView('landing-prof'); }
        else if (path === '/children') { setSelectedCatPath(['Children']); setView('landing-kids'); }
        
        else if (path !== '/' && !path.startsWith('/course/')) setView('home');
    };

    // 1. Run ONCE on mount to handle reloads
    handleUrlChange();

    // 2. Listen for back/forward buttons
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (catMenuRef.current && !catMenuRef.current.contains(event.target)) setCatMenuOpen(false);
      if (locMenuRef.current && !locMenuRef.current.contains(event.target)) setLocMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['de'];

  const getCatLabel = (key) => {
    if (lang === 'en') return key;
    const translation = CATEGORY_LABELS[key];
    return translation && translation[lang] ? translation[lang] : key;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const role = session.user.user_metadata?.role || 'student';
        const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        setUser({ id: session.user.id, email: session.user.email, role: role, name: name });
        fetchBookings(session.user.id);
        if (role === 'teacher') fetchTeacherEarnings(session.user.id);

        supabase.from('profiles').select('preferred_language').eq('id', session.user.id).single()
            .then(({ data }) => {
                if (data && data.preferred_language) setLang(data.preferred_language);
            });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        const role = session.user.user_metadata?.role || 'student';
        const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        setUser({ id: session.user.id, email: session.user.email, role: role, name: name });
        fetchBookings(session.user.id);
        if (role === 'teacher') fetchTeacherEarnings(session.user.id);

        supabase.from('profiles').select('preferred_language').eq('id', session.user.id).single()
            .then(({ data }) => {
                if (data && data.preferred_language) setLang(data.preferred_language);
            });
      } else {
        setUser(null);
        setMyBookings([]);
        setTeacherEarnings([]);
        setView('home');
        setLang('de'); 
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');
    if (sessionId && user) {
        const pendingCourseId = localStorage.getItem('pendingCourseId');
        if (pendingCourseId) {
            const saveBooking = async () => {
                const { error } = await supabase.from('bookings').insert([{ user_id: user.id, course_id: pendingCourseId, is_paid: false, status: 'confirmed' }]);
                if (!error) {
                    localStorage.removeItem('pendingCourseId');
                    showNotification("Course booked successfully!");
                    fetchBookings(user.id);
                    window.history.replaceState({}, document.title, "/dashboard");
                    setView('dashboard');
                }
            };
            saveBooking();
        } else { setView('dashboard'); }
    }
  }, [user]);

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCourses(data || []);
      const path = window.location.pathname;
      if (path.startsWith('/course/')) {
          const urlId = path.split('/')[2];
          if (data && urlId) {
              const found = data.find(c => c.id == urlId);
              if (found) { setSelectedCourse(found); setView('detail'); }
          }
      }
    } catch (error) { console.error('Error fetching courses:', error.message); showNotification("Error loading courses"); } finally { setLoading(false); }
  };

  const fetchBookings = async (userId) => {
    try {
      const { data, error } = await supabase.from('bookings').select('*, courses(*)').eq('user_id', userId);
      if (error) throw error;
      setMyBookings(data.map(booking => booking.courses).filter(c => c !== null));
    } catch (error) { console.error('Error fetching bookings:', error.message); }
  };

  const fetchTeacherEarnings = async (userId) => {
      try {
          const { data: myCourses } = await supabase.from('courses').select('id, title, price').eq('user_id', userId);
          if (!myCourses || myCourses.length === 0) return;
          const courseIds = myCourses.map(c => c.id);
          const { data: bookings } = await supabase.from('bookings').select('*, profiles:user_id(full_name, email)').in('course_id', courseIds);
          if (!bookings) return;
          setTeacherEarnings(bookings.map(booking => {
              const course = myCourses.find(c => c.id === booking.course_id);
              return { id: booking.id, courseTitle: course?.title || 'Unknown', studentName: booking.profiles?.full_name || 'Guest Student', price: course?.price || 0, payout: (course?.price || 0) * 0.85, isPaidOut: booking.is_paid, date: new Date(booking.created_at).toLocaleDateString() };
          }));
      } catch (error) { console.error("Error fetching earnings:", error); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); showNotification("Logged out successfully"); setView('home'); };
  const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const handleDeleteCourse = async (courseId) => {
    if(!confirm("Are you sure you want to delete this course?")) return;
    setCourses(courses.filter(c => c.id !== courseId));
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) showNotification("Error deleting: " + error.message); else showNotification("Course deleted.");
  };

  const handleEditCourse = (course) => {
      setEditingCourse(course);
      setView('create');
  };

  const handlePublishCourse = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const courseId = formData.get('course_id'); // If this exists, it's an UPDATE
    const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');
    const fullCategoryString = `${formData.get('catLvl1')} | ${formData.get('catLvl2')} | ${formData.get('catLvl3')}`;
    const newCourse = {
      title: formData.get('title'), instructor_name: user.name, price: Number(formData.get('price')), rating: 0, category: fullCategoryString, canton: formData.get('canton'), address: formData.get('address'),
      image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600",
      description: formData.get('description'), objectives: objectivesList, prerequisites: formData.get('prerequisites'), session_count: Number(formData.get('sessionCount')), session_length: formData.get('sessionLength'), provider_url: formData.get('providerUrl'), user_id: user.id, start_date: formData.get('startDate'),
      level: formData.get('level'), target_group: formData.get('target_group'), is_pro: formData.get('is_pro') === 'on' 
    };

    let error;
    if (courseId) {
        // UPDATE
        const { error: err } = await supabase.from('courses').update(newCourse).eq('id', courseId);
        error = err;
        showNotification("Course updated successfully!");
    } else {
        // INSERT
        const { error: err } = await supabase.from('courses').insert([newCourse]).select();
        error = err;
        showNotification(t.success_msg);
    }

    if (error) { console.error(error); showNotification("Error saving course: " + error.message); } 
    else { fetchCourses(); setView('dashboard'); setEditingCourse(null); }
  };

  const handleBookCourse = async (course) => {
      if (!user) { setView('login'); return; }
      try {
          localStorage.setItem('pendingCourseId', course.id);
          const response = await fetch('/api/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: course.id, courseTitle: course.title, coursePrice: course.price, courseImage: course.image_url, userId: user.id }) });
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          window.location.href = data.url; 
      } catch (error) { alert("SYSTEM ERROR: " + error.message); }
  };

  const handleContactSubmit = (e) => { 
    e.preventDefault(); 
    // In a real app, we would send this data to the backend
    // For now, we simulate success
    const formData = new FormData(e.target);
    console.log("Sending email to info@kursnavi.ch", Object.fromEntries(formData));
    showNotification("Message sent! We will get back to you shortly."); 
    setView('home'); 
  };
  
  const handleSearchSubmit = () => { 
      setView('search');
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const filteredCourses = courses.filter(course => {
    let matchesCategory = true;
    if (selectedCatPath.length > 0) { 
        const courseCatStr = (course.category || "").toLowerCase(); 
        matchesCategory = selectedCatPath.every(part => courseCatStr.includes(part.toLowerCase())); 
    }
    let matchesLocation = true;
    if (selectedLocations.length > 0) {
        if (locMode === 'canton') { matchesLocation = selectedLocations.includes(course.canton); } 
        else { const address = (course.address || "").toLowerCase(); const canton = (course.canton || "").toLowerCase(); matchesLocation = selectedLocations.some(city => address.includes(city.toLowerCase()) || canton.includes(city.toLowerCase())); }
    }
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || (course.instructor_name && course.instructor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // NEW FILTER LOGIC
    let matchesDate = true;
    if (filterDate && course.start_date) {
        matchesDate = new Date(course.start_date) >= new Date(filterDate);
    }
    let matchesPrice = true;
    if (filterPriceMax) {
        matchesPrice = course.price <= Number(filterPriceMax);
    }
    let matchesLevel = true;
    if (filterLevel !== 'All') {
        matchesLevel = course.level === filterLevel;
    }
    let matchesPro = true;
    if (filterPro) {
        matchesPro = course.is_pro === true;
    }

    return matchesCategory && matchesLocation && matchesSearch && matchesDate && matchesPrice && matchesLevel && matchesPro;
  });

  return (
    <div className="min-h-screen bg-beige font-sans text-dark selection:bg-orange-100 selection:text-primary flex flex-col font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@300;400;500;600&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');`}</style>
      {notification && (<div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-dark text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce font-heading"><CheckCircle className="w-5 h-5 mr-2 text-primary" />{notification}</div>)}
      <Navbar t={t} user={user} lang={lang} setLang={changeLanguage} setView={setView} handleLogout={handleLogout} setShowResults={() => setView('search')} setSelectedCatPath={setSelectedCatPath} />

      <div className="flex-grow">
        
      {/* --- ROUTING --- */}
      {view === 'home' && (
         <Home t={t} setView={setView} setSelectedCatPath={setSelectedCatPath} />
      )}
        
      {view === 'landing-private' && (
          <LandingView title="Unleash your passion." subtitle="Hobby Courses" variant="private" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} />
      )}

      {view === 'landing-prof' && (
          <LandingView title="Boost your career." subtitle="Professional Courses" variant="prof" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} />
      )}

      {view === 'landing-kids' && (
          <LandingView title="Fun learning for kids." subtitle="Children's Courses" variant="kids" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} />
      )}

      {view === 'search' && (
          <SearchPageView 
            selectedCatPath={selectedCatPath} setSelectedCatPath={setSelectedCatPath}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} catMenuRef={catMenuRef}
            locMode={locMode} setLocMode={setLocMode}
            selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations}
            locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef}
            loading={loading} filteredCourses={filteredCourses}
            setSelectedCourse={setSelectedCourse} setView={setView}
            t={t} getCatLabel={getCatLabel}
            filterDate={filterDate} setFilterDate={setFilterDate}
            filterPriceMax={filterPriceMax} setFilterPriceMax={setFilterPriceMax}
            filterLevel={filterLevel} setFilterLevel={setFilterLevel}
            filterPro={filterPro} setFilterPro={setFilterPro}
          />
      )}

      {/* --- STANDARD VIEWS --- */}
      {view === 'success' && <SuccessView setView={setView} />}
      {view === 'detail' && selectedCourse && <DetailView course={selectedCourse} setView={setView} t={t} handleBookCourse={handleBookCourse} />}
      {view === 'how-it-works' && <HowItWorksPage t={t} setView={setView} />}
      {view === 'login' && <AuthView setView={setView} showNotification={showNotification} lang={lang} />}
      {view === 'about' && <AboutPage t={t} />}
      {view === 'contact' && <ContactPage t={t} handleContactSubmit={handleContactSubmit} setView={setView} />}
      
      {/* --- LEGAL PAGES --- */}
      {view === 'agb' && <LegalPage pageKey="agb" lang={lang} setView={setView} />}
      {view === 'datenschutz' && <LegalPage pageKey="datenschutz" lang={lang} setView={setView} />}
      {view === 'impressum' && <LegalPage pageKey="impressum" lang={lang} setView={setView} />}
      {view === 'widerruf' && <LegalPage pageKey="widerruf" lang={lang} setView={setView} />}
      {view === 'trust' && <LegalPage pageKey="trust" lang={lang} setView={setView} />}
      {/* ----------------- */}

      {view === 'admin' && user?.role === 'admin' && <AdminPanel t={t} courses={courses} />}
      {view === 'dashboard' && user && <Dashboard user={user} t={t} setView={setView} courses={courses} teacherEarnings={teacherEarnings} myBookings={myBookings} handleDeleteCourse={handleDeleteCourse} handleEditCourse={handleEditCourse} showNotification={showNotification} changeLanguage={changeLanguage} setSelectedCourse={setSelectedCourse} />}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm t={t} setView={setView} user={user} handlePublishCourse={handlePublishCourse} getCatLabel={getCatLabel} initialData={editingCourse} />}
      </div>
      
      <Footer t={t} setView={setView} />
    </div>
  );
}