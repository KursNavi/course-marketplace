import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, CheckCircle, ArrowLeft, LogIn, LayoutDashboard, Settings, Trash2, DollarSign, Lock, Calendar, ExternalLink, ChevronDown, ChevronRight, Mail, Phone, Loader, Heart, Shield, X, BookOpen, Star, Zap, Users, Briefcase, Smile, Music, ArrowRight, Save, Filter, BadgeCheck, Pencil, HelpCircle } from 'lucide-react';

// --- IMPORTS ---
import { BRAND, CATEGORY_HIERARCHY, CATEGORY_LABELS, SWISS_CANTONS, SWISS_CITIES, TRANSLATIONS } from './lib/constants';
import { Navbar, Footer, KursNaviLogo } from './components/Layout';
import { Home } from './components/Home';
import LegalPage from './components/LegalPage';
import { CategoryDropdown, LocationDropdown } from './components/Filters';

// --- Supabase Setup ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- ARCHITECT UPDATE: Fixed Background Image for Private/Hobby ---

const LandingView = ({ title, subtitle, variant, searchQuery, setSearchQuery, handleSearchSubmit, setSelectedCatPath, setView, t, getCatLabel }) => {
    let categories = {};
    let rootCategory = "";
    let bgImage = "";
    
    // Select data and images based on the variant
    if (variant === 'private') {
        categories = CATEGORY_HIERARCHY["Private & Hobby"];
        rootCategory = "Private & Hobby";
        // NEW STABLE IMAGE: Cooking / Hobby Scene
        bgImage = "https://images.unsplash.com/photo-1507048331197-7d4defea8700?q=80&w=2000&auto=format&fit=crop"; 
    } else if (variant === 'prof') {
        categories = CATEGORY_HIERARCHY["Professional"];
        rootCategory = "Professional";
        // Modern office meeting image
        bgImage = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=2000"; 
    } else if (variant === 'kids') {
        categories = CATEGORY_HIERARCHY["Children"];
        rootCategory = "Children";
        // Kids playing/learning image
        bgImage = "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&q=80&w=2000"; 
    }

    const handleCategoryClick = (subCat) => {
        setSelectedCatPath([rootCategory, subCat]);
        setView('search');
        window.scrollTo(0, 0);
    };

    return (
        <div className="min-h-screen bg-beige font-sans">
            {/* HERO SECTION WITH BACKGROUND IMAGE */}
            <div className="relative py-24 px-4 text-center text-white overflow-hidden">
                {/* Background Image Layer */}
                <div className="absolute inset-0 z-0">
                    <img src={bgImage} alt={title} className="w-full h-full object-cover" />
                    {/* Dark Overlay to make text readable */}
                    <div className="absolute inset-0 bg-black/60"></div>
                </div>

                {/* Content Layer */}
                <div className="relative z-10 max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-heading font-bold mb-4 drop-shadow-md animate-in fade-in slide-in-from-bottom-4 duration-700">{title}</h1>
                    <p className="text-xl md:text-2xl text-gray-100 mb-10 max-w-2xl mx-auto drop-shadow-sm font-light">{subtitle}</p>
                    
                    <div className="max-w-xl mx-auto relative group">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.search_placeholder}
                            className="w-full px-6 py-4 rounded-full text-dark focus:outline-none focus:ring-4 focus:ring-primary/50 text-lg shadow-xl transition-all"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                        />
                        <button onClick={handleSearchSubmit} className="absolute right-2 top-2 bg-primary text-white p-2.5 rounded-full hover:bg-orange-600 transition shadow-md group-hover:scale-105">
                            <Search className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* CATEGORY GRID */}
            <div className="max-w-7xl mx-auto px-4 py-16">
                <h2 className="text-2xl font-bold text-dark mb-8 font-heading text-center border-b border-gray-200 pb-4">Explore Categories</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {Object.keys(categories).map((catName) => (
                        <div key={catName} onClick={() => handleCategoryClick(catName)} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-gray-100 group">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-dark group-hover:text-primary transition-colors">{getCatLabel(catName)}</h3>
                                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors group-hover:translate-x-1" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {categories[catName].slice(0, 4).map(sub => (
                                    <span key={sub} className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded border border-gray-100">{getCatLabel(sub)}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DetailView = ({ course, setView, t, handleBookCourse }) => (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
        <button onClick={() => setView('search')} className="flex items-center text-gray-500 hover:text-primary mb-6"><ArrowLeft className="w-4 h-4 mr-2"/> Back to Search</button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <img src={course.image_url} className="w-full h-80 object-cover rounded-2xl shadow-lg" alt={course.title} />
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h1 className="text-3xl font-bold font-heading text-dark mb-4">{course.title}</h1>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><User className="w-4 h-4 mr-2"/> {course.instructor_name}</span>
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><MapPin className="w-4 h-4 mr-2"/> {course.canton}</span>
                        <span className="flex items-center bg-gray-50 px-3 py-1 rounded-full"><Clock className="w-4 h-4 mr-2"/> {course.session_count} x {course.session_length}</span>
                    </div>
                    <div className="prose max-w-none text-gray-600">
                        <h3 className="text-xl font-bold text-dark mb-2">{t.lbl_description}</h3>
                        <p className="whitespace-pre-wrap mb-6">{course.description}</p>
                        <h3 className="text-xl font-bold text-dark mb-2">{t.lbl_learn_goals}</h3>
                        <ul className="list-disc pl-5 space-y-1 mb-6">
                            {course.objectives && course.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
                    <div className="text-3xl font-bold text-primary font-heading mb-2">CHF {course.price}</div>
                    <p className="text-gray-500 text-sm mb-6">per person</p>
                    <button onClick={() => handleBookCourse(course)} className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition shadow-lg hover:-translate-y-1">{t.btn_book}</button>
                    <div className="mt-6 space-y-4 text-sm text-gray-600">
                        <div className="flex items-center"><Calendar className="w-5 h-5 mr-3 text-gray-400"/> {course.start_date ? new Date(course.start_date).toLocaleDateString() : 'Flexible'}</div>
                        <div className="flex items-center"><MapPin className="w-5 h-5 mr-3 text-gray-400"/> {course.address}</div>
                        <div className="flex items-center"><Shield className="w-5 h-5 mr-3 text-green-500"/> Secure Payment</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const HowItWorksPage = ({ t, setView }) => (
    <div className="max-w-7xl mx-auto px-4 py-16 font-sans">
        <h1 className="text-4xl font-bold text-center text-dark font-heading mb-16">{t.how_it_works}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
                <h2 className="text-2xl font-bold text-primary mb-8 flex items-center"><Smile className="mr-2"/> {t.for_students}</h2>
                <div className="space-y-8">
                    <div className="flex"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-primary mr-4 flex-shrink-0">1</div><div><h3 className="font-bold text-lg">{t.student_step_1}</h3><p className="text-gray-600">{t.student_desc_1}</p></div></div>
                    <div className="flex"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-primary mr-4 flex-shrink-0">2</div><div><h3 className="font-bold text-lg">{t.student_step_2}</h3><p className="text-gray-600">{t.student_desc_2}</p></div></div>
                    <div className="flex"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-primary mr-4 flex-shrink-0">3</div><div><h3 className="font-bold text-lg">{t.student_step_3}</h3><p className="text-gray-600">{t.student_desc_3}</p></div></div>
                </div>
            </div>
            <div>
                <h2 className="text-2xl font-bold text-blue-600 mb-8 flex items-center"><Briefcase className="mr-2"/> {t.for_tutors}</h2>
                <div className="space-y-8">
                    <div className="flex"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 mr-4 flex-shrink-0">1</div><div><h3 className="font-bold text-lg">{t.tutor_step_1}</h3><p className="text-gray-600">{t.tutor_desc_1}</p></div></div>
                    <div className="flex"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 mr-4 flex-shrink-0">2</div><div><h3 className="font-bold text-lg">{t.tutor_step_2}</h3><p className="text-gray-600">{t.tutor_desc_2}</p></div></div>
                    <div className="flex"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 mr-4 flex-shrink-0">3</div><div><h3 className="font-bold text-lg">{t.tutor_step_3}</h3><p className="text-gray-600">{t.tutor_desc_3}</p></div></div>
                </div>
            </div>
        </div>
        <div className="mt-16 text-center bg-primaryLight p-8 rounded-2xl">
            <h2 className="text-2xl font-bold text-dark mb-4">{t.cta_title}</h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">{t.cta_subtitle}</p>
            <button onClick={() => setView('login')} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-lg">{t.cta_btn}</button>
        </div>
    </div>
);

const ContactPage = ({ t, handleContactSubmit }) => (
    <div className="max-w-3xl mx-auto px-4 py-16 font-sans">
        <h1 className="text-4xl font-bold text-center text-dark font-heading mb-8">{t.contact_title}</h1>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <form onSubmit={handleContactSubmit} className="space-y-6">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_name}</label><input type="text" name="name" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_email}</label><input type="email" name="email" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_subject}</label><input type="text" name="subject" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"/></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_msg}</label><textarea name="message" rows="5" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"></textarea></div>
                <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition">{t.btn_send}</button>
            </form>
        </div>
    </div>
);

const AboutPage = ({ t }) => (
    <div className="max-w-4xl mx-auto px-4 py-16 font-sans text-center">
        <h1 className="text-4xl font-bold text-dark font-heading mb-6">{t.about_title}</h1>
        <p className="text-xl text-gray-600 mb-12">{t.about_subtitle}</p>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left space-y-6">
            <p>{t.about_text}</p>
            <h3 className="text-xl font-bold text-dark">{t.about_community_title}</h3>
            <p>{t.about_community_text}</p>
            <h3 className="text-xl font-bold text-dark">{t.about_quality_title}</h3>
            <p>{t.about_quality_text}</p>
        </div>
    </div>
);

const AdminPanel = ({ t, courses }) => (
    <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
        <div className="bg-white p-6 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-left">
                <thead><tr className="border-b"><th className="p-3">Title</th><th className="p-3">User</th><th className="p-3">Created</th></tr></thead>
                <tbody>
                    {courses.map(c => <tr key={c.id} className="hover:bg-gray-50"><td className="p-3">{c.title}</td><td className="p-3">{c.instructor_name}</td><td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td></tr>)}
                </tbody>
            </table>
        </div>
    </div>
);

// --- END MISSING COMPONENTS ---

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
                          {/* REMOVED: Professional Checkbox (now Admin only) */}
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

const SearchPageView = ({ selectedCatPath, setSelectedCatPath, searchQuery, setSearchQuery, catMenuOpen, setCatMenuOpen, catMenuRef, t, getCatLabel, locMode, setLocMode, selectedLocations, setSelectedLocations, locMenuOpen, setLocMenuOpen, locMenuRef, loading, filteredCourses, setSelectedCourse, setView, filterDate, setFilterDate, filterPriceMax, setFilterPriceMax, filterLevel, setFilterLevel, filterPro, setFilterPro }) => {
    const activeSection = selectedCatPath.length > 0 ? selectedCatPath[0] : null;

    return (
        <div className="min-h-screen bg-beige">
            <div className="bg-white border-b pt-8 pb-4 sticky top-20 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input type="text" placeholder={t.search_refine} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-beige border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors" />
                        </div>
                        <CategoryDropdown rootCategory={activeSection} selectedCatPath={selectedCatPath} setSelectedCatPath={setSelectedCatPath} catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} t={t} getCatLabel={getCatLabel} catMenuRef={catMenuRef} /> 
                        <LocationDropdown locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} t={t} />
                        {(selectedCatPath.length > 0 || selectedLocations.length > 0 || filterDate || filterPriceMax || filterLevel !== 'All' || filterPro) && (<button onClick={() => { setSelectedCatPath([]); setSelectedLocations([]); setSearchQuery(""); setFilterDate(""); setFilterPriceMax(""); setFilterLevel("All"); setFilterPro(false); }} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100" title="Reset all filters"><X className="w-5 h-5" /></button>)}
                    </div>
                    {/* NEW FILTERS ROW */}
                    <div className="flex gap-4 overflow-x-auto pb-2 items-center">
                        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <input type="date" placeholder="dd/mm/yyyy" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent text-sm outline-none text-gray-600 placeholder-gray-400" />
                        </div>
                        <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border">
                            <span className="text-sm text-gray-500">{t.lbl_max_price}</span>
                            <input type="number" placeholder="Any" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} className="w-16 bg-transparent text-sm outline-none text-gray-600" />
                        </div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm outline-none text-gray-600">
                            <option value="All">{t.opt_all_levels}</option>
                            <option value="Beginner">{t.opt_beginner}</option><option value="Advanced">{t.opt_advanced}</option>
                        </select>
                         <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition select-none ${filterPro ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`} title={t.tooltip_pro_verified}>
                            <input type="checkbox" checked={filterPro} onChange={(e) => setFilterPro(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <span className={`text-sm font-medium ${filterPro ? 'text-blue-700' : 'text-gray-600'}`}>{t.lbl_professional_filter}</span>
                            <HelpCircle className="w-3 h-3 text-gray-400" />
                        </label>
                    </div>
                </div>
                 {(selectedCatPath.length > 0 || selectedLocations.length > 0) && (
                    <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2 flex-wrap">
                        {/* Categories: Click to remove specific level */}
                        {selectedCatPath.map((part, i) => (
                            <span key={i} onClick={() => setSelectedCatPath(selectedCatPath.slice(0, i))} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-orange-200 flex items-center">
                                {getCatLabel(part)} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        ))}
                        {/* Locations: Click to remove */}
                        {selectedLocations.map((loc, i) => (
                            <span key={i} onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== loc))} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-blue-200 flex items-center">
                                {loc} <X className="w-3 h-3 ml-1 opacity-50" />
                            </span>
                        ))}
                    </div>
                 )}
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

  const getCatLabel = (key) => {
    if (lang === 'en') return key;
    const translation = CATEGORY_LABELS[key];
    return translation && translation[lang] ? translation[lang] : key;
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
        if (path === '/agb') setView('agb');
        else if (path === '/datenschutz') setView('datenschutz');
        else if (path === '/impressum') setView('impressum');
        else if (path === '/widerruf-storno') setView('widerruf');
        else if (path === '/vertrauen-sicherheit') setView('trust');
        
        else if (path === '/search') setView('search');
        else if (path === '/dashboard') setView('dashboard');
        else if (path === '/how-it-works') setView('how-it-works');
        else if (path === '/about') setView('about');
        else if (path === '/contact') setView('contact');
        else if (path === '/login') setView('login');
        else if (path === '/create-course') setView('create');
        
        else if (path === '/private') { setSelectedCatPath(['Private & Hobby']); setView('landing-private'); }
        else if (path === '/professional') { setSelectedCatPath(['Professional']); setView('landing-prof'); }
        else if (path === '/children') { setSelectedCatPath(['Children']); setView('landing-kids'); }
        
        else if (path !== '/' && !path.startsWith('/course/')) setView('home');
    };

    handleUrlChange();
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
    const courseId = formData.get('course_id');
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
        const { error: err } = await supabase.from('courses').update(newCourse).eq('id', courseId);
        error = err;
        showNotification("Course updated successfully!");
    } else {
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
    fetch("https://formsubmit.co/ajax/995007a94ce934b7d8c8e7776670f9c4", {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
    })
    .then(response => response.json())
    .then(data => {
          showNotification(t.success_msg || "Message sent!"); 
          setView('home');
    })
    .catch(error => {
        console.error("Error:", error);
        showNotification("Error sending message. Please email us directly.");
    });
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
    
    let matchesDate = true; if (filterDate && course.start_date) matchesDate = new Date(course.start_date) >= new Date(filterDate);
    let matchesPrice = true; if (filterPriceMax) matchesPrice = course.price <= Number(filterPriceMax);
    let matchesLevel = true; if (filterLevel !== 'All') matchesLevel = course.level === filterLevel;
    let matchesPro = true; if (filterPro) matchesPro = course.is_pro === true;

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
         <Home 
            t={t} 
            setView={setView} 
            setSelectedCatPath={setSelectedCatPath}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} catMenuRef={catMenuRef}
            locMode={locMode} setLocMode={setLocMode}
            selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations}
            locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef}
            getCatLabel={getCatLabel}
         />
      )}
        
      {view === 'landing-private' && ( <LandingView title="Unleash your passion." subtitle="Hobby Courses" variant="private" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-prof' && ( <LandingView title="Boost your career." subtitle="Professional Courses" variant="prof" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-kids' && ( <LandingView title="Fun learning for kids." subtitle="Children's Courses" variant="kids" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}

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

      {view === 'admin' && user?.role === 'admin' && <AdminPanel t={t} courses={courses} />}
      {view === 'dashboard' && user && <Dashboard user={user} t={t} setView={setView} courses={courses} teacherEarnings={teacherEarnings} myBookings={myBookings} handleDeleteCourse={handleDeleteCourse} handleEditCourse={handleEditCourse} showNotification={showNotification} changeLanguage={changeLanguage} setSelectedCourse={setSelectedCourse} />}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm t={t} setView={setView} user={user} handlePublishCourse={handlePublishCourse} getCatLabel={getCatLabel} initialData={editingCourse} />}
      </div>
      
      <Footer t={t} setView={setView} />
    </div>
  );
}