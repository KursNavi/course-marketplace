import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
    Loader, Settings, Save, Lock, CheckCircle, Clock, 
    ChevronDown, User, DollarSign, PenTool, Trash2, ArrowRight 
} from 'lucide-react';
import { SWISS_CANTONS } from '../lib/constants';
import { KursNaviLogo } from './Layout';

// Initialize Supabase locally
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

        // UPDATE: Saving to bio_text and certificates column
        const { error } = await supabase.from('profiles').update({ 
            city: formData.city, 
            canton: formData.canton, 
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
            <h2 className="text-xl font-bold mb-6 text-dark flex items-center"><Settings className="w-5 h-5 mr-2 text-gray-500" /> {t.profile_settings}</h2>
            <form onSubmit={handleSave} className="space-y-6 max-w-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_city}</label><input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Adligenswil" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_canton}</label><div className="relative"><select name="canton" value={formData.canton} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="">Select Canton</option>{SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.lbl_language}</label><div className="relative"><select name="preferred_language" value={formData.preferred_language} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none bg-white"><option value="de">Deutsch (German)</option><option value="en">English</option><option value="fr">Français (French)</option><option value="it">Italiano (Italian)</option></select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                
                {/* NEW FIELDS: Biography & Certificates */}
                <div className="border-t pt-6 mt-6">
                    <h3 className="text-lg font-bold mb-4 text-dark flex items-center"><User className="w-4 h-4 mr-2" /> {t.lbl_bio || "Public Profile (Teacher Only)"}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Biography (About Me)</label>
                            <textarea name="bio_text" rows="5" value={formData.bio_text} onChange={handleChange} placeholder="Tell students about your experience..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50 focus:bg-white transition-colors"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Certificates & Qualifications</label>
                            <div className="text-xs text-gray-500 mb-2">Enter one certificate per line. We will format them as a list.</div>
                            <textarea name="certificates" rows="3" value={formData.certificates} onChange={handleChange} placeholder="Master in Pedagogy&#10;Certified Yoga Instructor&#10;..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-gray-50 focus:bg-white transition-colors"></textarea>
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

// --- MAIN DASHBOARD COMPONENT ---
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
                                                        <button onClick={() => handleEditCourse(course)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full"><PenTool className="w-4 h-4" /></button>
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

export default Dashboard;