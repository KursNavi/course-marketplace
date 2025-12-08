import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, CheckCircle, ArrowLeft, LogIn, LayoutDashboard, Settings, Trash2, DollarSign, Lock, Calendar, ExternalLink, ChevronDown, ChevronRight, Mail, Phone, Loader, Heart, Shield, X, BookOpen, Star, Zap, Users } from 'lucide-react';

// --- NEW IMPORTS ---
import { BRAND, CATEGORY_HIERARCHY, CATEGORY_LABELS, SWISS_CANTONS, SWISS_CITIES, TRANSLATIONS } from './lib/constants';
import { Navbar, Footer, KursNaviLogo } from './components/Layout';

// --- Supabase Setup ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function KursNaviPro() {
  const [lang, setLang] = useState('en');
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
  const [showResults, setShowResults] = useState(false);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [selectedCatPath, setSelectedCatPath] = useState([]); 
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const [locMode, setLocMode] = useState('canton'); 
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [notification, setNotification] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Close menus on click outside
  const catMenuRef = useRef(null);
  const locMenuRef = useRef(null);

  // --- URL ROUTING LOGIC ---
  useEffect(() => {
    let path = '/';
    if (view === 'about') path = '/about';
    else if (view === 'contact') path = '/contact';
    else if (view === 'login') path = '/login';
    else if (view === 'dashboard') path = '/dashboard';
    else if (view === 'terms') path = '/terms';
    else if (view === 'privacy') path = '/privacy';
    else if (view === 'create') path = '/create-course';
    else if (view === 'detail' && selectedCourse) path = `/course/${selectedCourse.id}`;
    
    if (window.location.pathname !== path) {
        window.history.pushState({ view, courseId: selectedCourse?.id }, '', path);
    }
  }, [view, selectedCourse]);

  useEffect(() => {
    const handlePopState = () => {
        const path = window.location.pathname;
        if (path === '/about') setView('about');
        else if (path === '/contact') setView('contact');
        else if (path === '/login') setView('login');
        else if (path === '/dashboard') setView('dashboard');
        else if (path === '/terms') setView('terms');
        else if (path === '/privacy') setView('privacy');
        else if (path === '/create-course') setView('create');
        else if (path.startsWith('/course/')) { /* Logic in fetchCourses */ }
        else setView('home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (catMenuRef.current && !catMenuRef.current.contains(event.target)) setCatMenuOpen(false);
      if (locMenuRef.current && !locMenuRef.current.contains(event.target)) setLocMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];

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
      } else {
        setUser(null);
        setMyBookings([]);
        setTeacherEarnings([]);
        setView('home');
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
        } else {
             setView('dashboard');
        }
    }
  }, [user]);

  // --- Fetch Data ---
  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCourses(data || []);

      // Deep Linking Check
      const path = window.location.pathname;
      if (path === '/about') setView('about');
      else if (path === '/contact') setView('contact');
      else if (path === '/login') setView('login');
      else if (path === '/terms') setView('terms');
      else if (path === '/privacy') setView('privacy');
      else if (path === '/dashboard') setView('dashboard');
      else if (path.startsWith('/course/')) {
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
    setCourses(courses.filter(c => c.id !== courseId));
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) showNotification("Error deleting course"); else showNotification("Course deleted.");
  };

  const handlePublishCourse = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');
    const fullCategoryString = `${formData.get('catLvl1')} | ${formData.get('catLvl2')} | ${formData.get('catLvl3')}`;
    const newCourse = {
      title: formData.get('title'), instructor_name: user.name, price: Number(formData.get('price')), rating: 0, category: fullCategoryString, canton: formData.get('canton'), address: formData.get('address'),
      image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600",
      description: formData.get('description'), objectives: objectivesList, prerequisites: formData.get('prerequisites'), session_count: Number(formData.get('sessionCount')), session_length: formData.get('sessionLength'), provider_url: formData.get('providerUrl'), user_id: user.id, start_date: formData.get('startDate') 
    };
    const { data, error } = await supabase.from('courses').insert([newCourse]).select();
    if (error) { console.error(error); showNotification("Error publishing course"); } 
    else { if (data && data.length > 0) setCourses([data[0], ...courses]); else fetchCourses(); setView('dashboard'); showNotification(t.success_msg); }
  };

  const handleCancelBooking = async (courseId, courseTitle) => {
      if (!confirm(`Are you sure you want to cancel your spot in "${courseTitle}"?`)) return;
      showNotification("Processing cancellation...");
      try {
          await fetch('/api/cancel-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, userId: user.id, courseTitle, studentEmail: user.email }) });
          setMyBookings(myBookings.filter(c => c.id !== courseId));
          showNotification("Booking cancelled successfully.");
      } catch (error) { alert("Error cancelling: " + error.message); }
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

  const handleContactSubmit = (e) => { e.preventDefault(); showNotification("Message sent!"); setView('home'); };
  const handleSearchSubmit = () => { setShowResults(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const filteredCourses = courses.filter(course => {
    let matchesCategory = true;
    if (selectedCatPath.length > 0) { const courseCatStr = (course.category || "").toLowerCase(); matchesCategory = selectedCatPath.every(part => courseCatStr.includes(part.toLowerCase())); }
    let matchesLocation = true;
    if (selectedLocations.length > 0) {
        if (locMode === 'canton') { matchesLocation = selectedLocations.includes(course.canton); } 
        else { const address = (course.address || "").toLowerCase(); const canton = (course.canton || "").toLowerCase(); matchesLocation = selectedLocations.some(city => address.includes(city.toLowerCase()) || canton.includes(city.toLowerCase())); }
    }
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || (course.instructor_name && course.instructor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesLocation && matchesSearch;
  });

  const calculateDeadline = (startDateString) => {
      if (!startDateString) return null;
      const start = new Date(startDateString);
      const deadline = new Date(start);
      deadline.setMonth(deadline.getMonth() - 1);
      return deadline;
  };

  // --- SUB-COMPONENTS (Keep logic heavy ones here for now) ---
  const CategoryDropdown = () => {
    const [lvl1, setLvl1] = useState(null); const [lvl2, setLvl2] = useState(null);
    return (
        <div ref={catMenuRef} className="static"> 
            <button onClick={() => setCatMenuOpen(!catMenuOpen)} className={`px-4 py-3 border rounded-full flex items-center space-x-2 text-sm font-medium transition ${selectedCatPath.length > 0 ? 'bg-[#FA6E28] text-white border-[#FA6E28]' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                <span>{selectedCatPath.length > 0 ? getCatLabel(selectedCatPath[selectedCatPath.length-1]) : t.filter_label_cat}</span><ChevronDown className="w-4 h-4" />
            </button>
            {catMenuOpen && (
                <div className="absolute top-20 left-0 right-0 mx-auto w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-50 flex h-[350px]">
                    <div className="w-1/3 border-r overflow-y-auto">
                        {Object.keys(CATEGORY_HIERARCHY).map(cat => (<div key={cat} onClick={() => { setLvl1(cat); setLvl2(null); }} className={`p-3 cursor-pointer text-sm flex justify-between items-center hover:bg-gray-50 ${lvl1 === cat ? 'font-bold text-[#FA6E28] bg-orange-50' : 'text-gray-700'}`}>{getCatLabel(cat)}<ChevronRight className="w-4 h-4 text-gray-400" /></div>))}
                        <div onClick={() => { setSelectedCatPath([]); setCatMenuOpen(false); }} className="p-3 text-xs text-gray-400 cursor-pointer hover:text-[#FA6E28] border-t mt-2">Clear Selection</div>
                    </div>
                    <div className="w-1/3 border-r overflow-y-auto bg-gray-50/50">
                        {lvl1 ? Object.keys(CATEGORY_HIERARCHY[lvl1]).map(sub => (<div key={sub} onClick={() => setLvl2(sub)} className={`p-3 cursor-pointer text-sm flex justify-between items-center hover:bg-gray-100 ${lvl2 === sub ? 'font-bold text-[#FA6E28]' : 'text-gray-700'}`}>{getCatLabel(sub)}<ChevronRight className="w-4 h-4 text-gray-400" /></div>)) : <div className="p-4 text-xs text-gray-400">Select a category...</div>}
                    </div>
                    <div className="w-1/3 overflow-y-auto bg-gray-50">
                        {lvl1 && lvl2 ? CATEGORY_HIERARCHY[lvl1][lvl2].map(item => (<div key={item} onClick={() => { setSelectedCatPath([lvl1, lvl2, item]); setCatMenuOpen(false); }} className="p-3 cursor-pointer text-sm text-gray-700 hover:text-[#FA6E28] hover:bg-white transition">{getCatLabel(item)}</div>)) : <div className="p-4 text-xs text-gray-400">Select a sub-category...</div>}
                    </div>
                </div>
            )}
        </div>
    );
  };

  const LocationDropdown = () => {
    const toggleLoc = (loc) => { if (selectedLocations.includes(loc)) setSelectedLocations(selectedLocations.filter(l => l !== loc)); else setSelectedLocations([...selectedLocations, loc]); };
    const displayList = locMode === 'canton' ? SWISS_CANTONS : SWISS_CITIES;
    return (
        <div ref={locMenuRef} className="static">
            <button onClick={() => setLocMenuOpen(!locMenuOpen)} className={`px-4 py-3 border rounded-full flex items-center space-x-2 text-sm font-medium transition ${selectedLocations.length > 0 ? 'bg-[#FA6E28] text-white border-[#FA6E28]' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                 <MapPin className="w-4 h-4" /><span>{selectedLocations.length > 0 ? `${selectedLocations.length} selected` : t.filter_label_loc}</span><ChevronDown className="w-4 h-4" />
            </button>
            {locMenuOpen && (
                <div className="absolute top-20 left-0 right-0 mx-auto bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 w-full max-w-sm">
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                        <button onClick={() => { setLocMode('canton'); setSelectedLocations([]); }} className={`flex-1 py-1 text-sm font-medium rounded-md transition ${locMode === 'canton' ? 'bg-white shadow text-[#FA6E28]' : 'text-gray-500'}`}>Cantons</button>
                        <button onClick={() => { setLocMode('city'); setSelectedLocations([]); }} className={`flex-1 py-1 text-sm font-medium rounded-md transition ${locMode === 'city' ? 'bg-white shadow text-[#FA6E28]' : 'text-gray-500'}`}>Cities</button>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto space-y-1">
                        {displayList.map(loc => (<label key={loc} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLoc(loc)} className="rounded border-gray-300 text-[#FA6E28] focus:ring-[#FA6E28]" /><span className="text-sm text-gray-700">{loc}</span></label>))}
                    </div>
                    <div className="pt-3 mt-3 border-t flex justify-between items-center"><button onClick={() => setSelectedLocations([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button><button onClick={() => setLocMenuOpen(false)} className="text-xs font-bold text-[#FA6E28]">Done</button></div>
                </div>
            )}
        </div>
    );
  };
  
  const LandingPageContent = () => (
      <div className="space-y-24 py-12 animate-in fade-in duration-700">
          <div className="max-w-7xl mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-16 text-[#333333] font-['Open_Sans']">{t.how_it_works}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                  <div className="space-y-8">
                      <div className="flex items-center space-x-4 mb-8"><div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-[#FA6E28]"><Users className="w-6 h-6" /></div><h3 className="text-2xl font-bold text-[#333333]">{t.for_students}</h3></div>
                      <div className="space-y-8 pl-4 border-l-2 border-orange-100">
                          <div><h4 className="font-bold text-lg mb-1 flex items-center"><Search className="w-4 h-4 mr-2 text-[#FA6E28]" /> {t.student_step_1}</h4><p className="text-gray-600">{t.student_desc_1}</p></div>
                          <div><h4 className="font-bold text-lg mb-1 flex items-center"><Calendar className="w-4 h-4 mr-2 text-[#FA6E28]" /> {t.student_step_2}</h4><p className="text-gray-600">{t.student_desc_2}</p></div>
                          <div><h4 className="font-bold text-lg mb-1 flex items-center"><Star className="w-4 h-4 mr-2 text-[#FA6E28]" /> {t.student_step_3}</h4><p className="text-gray-600">{t.student_desc_3}</p></div>
                      </div>
                  </div>
                  <div className="space-y-8">
                        <div className="flex items-center space-x-4 mb-8"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><Zap className="w-6 h-6" /></div><h3 className="text-2xl font-bold text-[#333333]">{t.for_tutors}</h3></div>
                      <div className="space-y-8 pl-4 border-l-2 border-blue-100">
                           <div><h4 className="font-bold text-lg mb-1 flex items-center"><BookOpen className="w-4 h-4 mr-2 text-blue-500" /> {t.tutor_step_1}</h4><p className="text-gray-600">{t.tutor_desc_1}</p></div>
                          <div><h4 className="font-bold text-lg mb-1 flex items-center"><Clock className="w-4 h-4 mr-2 text-blue-500" /> {t.tutor_step_2}</h4><p className="text-gray-600">{t.tutor_desc_2}</p></div>
                          <div><h4 className="font-bold text-lg mb-1 flex items-center"><DollarSign className="w-4 h-4 mr-2 text-blue-500" /> {t.tutor_step_3}</h4><p className="text-gray-600">{t.tutor_desc_3}</p></div>
                      </div>
                  </div>
              </div>
          </div>
          <div className="bg-[#333333] py-20">
              <div className="max-w-4xl mx-auto px-4 text-center">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 font-['Open_Sans']">{t.cta_title}</h2><p className="text-xl text-gray-300 mb-10 leading-relaxed">{t.cta_subtitle}</p>
                  <button onClick={() => setView('login')} className="bg-[#FA6E28] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#E55D1F] transition transform hover:-translate-y-1 shadow-xl">{t.cta_btn}</button>
              </div>
          </div>
      </div>
  );

  const TeacherForm = () => {
    const [lvl1, setLvl1] = useState(Object.keys(CATEGORY_HIERARCHY)[0]); const [lvl2, setLvl2] = useState(Object.keys(CATEGORY_HIERARCHY[lvl1])[0]);
    const handleLvl1Change = (e) => { const val = e.target.value; setLvl1(val); setLvl2(Object.keys(CATEGORY_HIERARCHY[val])[0]); };
    return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Hind_Madurai']">
        <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4"><h1 className="text-3xl font-bold text-[#333333] font-['Open_Sans']">{t.form_title}</h1><p className="text-gray-500 mt-2">Share your skills with the community.</p></div>
            <form onSubmit={handlePublishCourse} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">Course Title</label><input required type="text" name="title" placeholder="e.g. Traditional Swiss Cooking" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none transition-shadow" /></div>
                    <div className="md:col-span-2 bg-[#FAF5F0] p-4 rounded-xl border border-orange-100">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Category Classification</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><span className="text-xs text-gray-500 block mb-1">Type</span><select name="catLvl1" value={lvl1} onChange={handleLvl1Change} className="w-full px-3 py-2 border rounded-lg focus:ring-[#FA6E28] bg-white text-sm">{Object.keys(CATEGORY_HIERARCHY).map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                            <div><span className="text-xs text-gray-500 block mb-1">Area</span><select name="catLvl2" value={lvl2} onChange={(e) => setLvl2(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-[#FA6E28] bg-white text-sm">{Object.keys(CATEGORY_HIERARCHY[lvl1]).map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                            <div><span className="text-xs text-gray-500 block mb-1">Specialty</span><select name="catLvl3" className="w-full px-3 py-2 border rounded-lg focus:ring-[#FA6E28] bg-white text-sm">{CATEGORY_HIERARCHY[lvl1][lvl2].map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}</select></div>
                        </div>
                    </div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Price (CHF)</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500 font-bold">CHF</span><input required type="number" name="price" placeholder="50" className="w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" /></div></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Canton</label><div className="relative"><select name="canton" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none appearance-none bg-white">{SWISS_CANTONS.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" /></div></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Specific Address</label><input required type="text" name="address" placeholder="Street, City, Zip" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Session Count</label><input required type="number" name="sessionCount" defaultValue="1" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Session Length</label><input required type="text" name="sessionLength" placeholder="e.g. 2 hours" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label><div className="relative"><Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input required type="date" name="startDate" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" /></div></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Provider Website (Optional)</label><div className="relative"><ExternalLink className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input type="url" name="providerUrl" placeholder="https://..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" /></div></div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Description</label><textarea required name="description" rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" placeholder="Describe your course..."></textarea></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">What will students learn?</label><textarea required name="objectives" rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" placeholder="Enter each objective on a new line..."></textarea></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Prerequisites</label><input type="text" name="prerequisites" placeholder="e.g. Beginners welcome, bring a laptop" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" /></div>
                <div className="pt-4 border-t border-gray-100 flex justify-end"><button type="submit" className="bg-[#FA6E28] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#E55D1F] shadow-lg hover:-translate-y-0.5 transition flex items-center font-['Open_Sans']"><KursNaviLogo className="w-5 h-5 mr-2 text-white" />{t.btn_publish}</button></div>
            </form>
        </div>
    </div>
    );
  };

  const SuccessView = () => (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-600" /></div>
              <h2 className="text-3xl font-bold text-[#333333] mb-4 font-['Open_Sans']">Payment Successful!</h2>
              <p className="text-gray-600 mb-8 font-['Hind_Madurai']">Thank you for your booking. You will receive a confirmation email shortly.</p>
              <button onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); setView('dashboard'); }} className="w-full bg-[#FA6E28] text-white py-3 rounded-lg font-bold hover:bg-[#E55D1F] transition font-['Open_Sans']">Go to My Courses</button>
          </div>
      </div>
  );

  const AuthView = () => {
    const [isSignUp, setIsSignUp] = useState(false); const [loading, setLoading] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [fullName, setFullName] = useState(''); const [role, setRole] = useState('student');
    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            if (isSignUp) {
                const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role: role } } });
                if (authError) throw authError;
                if (authData?.user) { await supabase.from('profiles').insert([{ id: authData.user.id, full_name: fullName, email: email }]); }
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
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-[#FAF5F0]">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-center font-['Open_Sans'] text-[#333333]">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                <form onSubmit={handleAuth} className="space-y-4 font-['Hind_Madurai']">
                    {isSignUp && (<><div><label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label><input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" value={fullName} onChange={e => setFullName(e.target.value)} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">I am a...</label><div className="flex gap-4"><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'student' ? 'bg-[#FFF0EB] border-[#FA6E28] text-[#FA6E28] font-bold' : 'hover:bg-gray-50'}`}><input type="radio" className="hidden" checked={role === 'student'} onChange={() => setRole('student')} />Student</label><label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'teacher' ? 'bg-[#FFF0EB] border-[#FA6E28] text-[#FA6E28] font-bold' : 'hover:bg-gray-50'}`}><input type="radio" className="hidden" checked={role === 'teacher'} onChange={() => setRole('teacher')} />Teacher</label></div></div></>)}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" value={email} onChange={e => setEmail(e.target.value)} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Password</label><input required type="password" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" value={password} onChange={e => setPassword(e.target.value)} /></div>
                    <button disabled={loading} type="submit" className="w-full bg-[#FA6E28] text-white py-3 rounded-lg font-bold hover:bg-[#E55D1F] transition disabled:opacity-50 font-['Open_Sans']">{loading ? <Loader className="animate-spin mx-auto" /> : (isSignUp ? "Sign Up" : "Login")}</button>
                </form>
                <p className="text-center text-sm text-gray-600 mt-6 font-['Hind_Madurai']">{isSignUp ? "Already have an account?" : "Don't have an account?"}<button onClick={() => setIsSignUp(!isSignUp)} className="text-[#FA6E28] font-bold ml-2 hover:underline">{isSignUp ? "Login" : "Sign Up"}</button></p>
            </div>
        </div>
    );
  };

  const DetailView = ({ course }) => (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in duration-500 font-['Hind_Madurai']">
      <button onClick={() => setView('home')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"><ArrowLeft className="w-4 h-4 mr-2" /> Back to courses</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <div className="relative rounded-2xl overflow-hidden shadow-lg h-80">
                <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-bold text-gray-800 flex items-center shadow-sm"><MapPin className="w-4 h-4 mr-1 text-[#FA6E28]" /> {course.canton}</div>
            </div>
            <div>
                <h1 className="text-3xl font-extrabold text-[#333333] mb-3 font-['Open_Sans']">{course.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500"><span className="flex items-center"><User className="w-4 h-4 mr-1" /> {course.instructor_name}</span></div>
                <div className="mt-2 text-sm text-[#FA6E28] font-medium bg-orange-50 inline-block px-2 py-1 rounded">{course.category}</div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div><h3 className="text-xl font-bold mb-3 text-[#333333] font-['Open_Sans']">{t.lbl_description}</h3><p className="text-gray-600 leading-relaxed text-lg">{course.description}</p></div>
                {course.objectives && (<div><h3 className="text-xl font-bold mb-3 text-[#333333] font-['Open_Sans']">{t.lbl_objectives}</h3><ul className="space-y-2">{course.objectives.map((obj, i) => (<li key={i} className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" /><span className="text-gray-700">{obj}</span></li>))}</ul></div>)}
            </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 sticky top-24">
            <div className="mb-6 border-b pb-6">
                <span className="text-4xl font-extrabold text-[#333333] block mb-1 font-['Open_Sans']">{t.currency} {course.price}</span><span className="text-sm text-gray-500 block mb-4">per person</span>
                <button onClick={() => handleBookCourse(course)} className="w-full bg-[#FA6E28] text-white py-4 rounded-xl font-bold hover:bg-[#E55D1F] transition shadow-md active:scale-95 font-['Open_Sans']">{t.btn_pay}</button>
            </div>
             {course.start_date && (<div className="mb-6 pb-6 border-b border-gray-100"><div className="flex items-center text-[#FA6E28] font-bold mb-1"><Calendar className="w-5 h-5 mr-2" /><span>Start Date</span></div><div className="text-xl font-bold text-[#333333] ml-7">{new Date(course.start_date).toLocaleDateString('en-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>)}
            <div className="space-y-4">
                <div className="flex items-start"><div className="w-8 flex-shrink-0"><MapPin className="w-5 h-5 text-gray-400" /></div><div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_address}</span><span className="text-gray-700 font-medium">{course.address || course.canton}</span></div></div>
                {course.session_count && (<div className="flex items-start"><div className="w-8 flex-shrink-0"><Clock className="w-5 h-5 text-gray-400" /></div><div><span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_duration}</span><span className="text-gray-700 font-medium">{course.session_count} sessions × {course.session_length}</span></div></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const AboutPage = () => (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500 font-['Hind_Madurai']">
        <div className="text-center mb-12"><h1 className="text-4xl font-extrabold text-[#333333] mb-4 font-['Open_Sans']">{t.about_title}</h1><p className="text-xl text-gray-500">{t.about_subtitle}</p></div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-12">
            <img src="https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?auto=format&fit=crop&q=80&w=1200" alt="Swiss Landscape" className="w-full h-64 object-cover" />
            <div className="p-8 space-y-6">
                <p className="text-lg text-gray-700 leading-relaxed">{t.about_text}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <div className="flex items-start"><Heart className="w-8 h-8 text-[#FA6E28] mr-4 flex-shrink-0" /><div><h3 className="font-bold text-[#333333] mb-1 font-['Open_Sans']">{t.about_community_title}</h3><p className="text-gray-600">{t.about_community_text}</p></div></div>
                    <div className="flex items-start"><Shield className="w-8 h-8 text-[#FA6E28] mr-4 flex-shrink-0" /><div><h3 className="font-bold text-[#333333] mb-1 font-['Open_Sans']">{t.about_quality_title}</h3><p className="text-gray-600">{t.about_quality_text}</p></div></div>
                </div>
            </div>
        </div>
    </div>
  );

  const ContactPage = () => (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500 font-['Hind_Madurai']">
        <h1 className="text-4xl font-extrabold text-[#333333] mb-8 text-center font-['Open_Sans']">{t.contact_title}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
                <div className="bg-[#FFF0EB] p-6 rounded-2xl border border-orange-100">
                    <h3 className="font-bold text-lg mb-4 text-[#FA6E28] font-['Open_Sans']">{t.contact_get_in_touch}</h3>
                    <div className="space-y-4">
                        <div className="flex items-center text-gray-700"><Mail className="w-5 h-5 mr-3 text-[#FA6E28]" /><span>support@kursnavi.ch</span></div>
                        <div className="flex items-center text-gray-700"><Phone className="w-5 h-5 mr-3 text-[#FA6E28]" /><span>+41 44 123 45 67</span></div>
                        <div className="flex items-start text-gray-700"><MapPin className="w-5 h-5 mr-3 text-[#FA6E28] mt-1" /><span>KursNavi AG<br/>Bahnhofstrasse 100<br/>8001 Zürich<br/>Switzerland</span></div>
                    </div>
                </div>
                <div><h3 className="font-bold text-lg mb-2 font-['Open_Sans']">{t.contact_office_hours}</h3><p className="text-gray-600">{t.contact_mon_fri}</p><p className="text-gray-600">{t.contact_weekend}</p></div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_name}</label><input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" placeholder={t.contact_lbl_name} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_email}</label><input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" placeholder="you@example.com" /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_msg}</label><textarea required rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" placeholder="..."></textarea></div>
                    <button type="submit" className="w-full bg-[#FA6E28] text-white py-3 rounded-lg font-bold hover:bg-[#E55D1F] transition font-['Open_Sans']">{t.btn_send}</button>
                </form>
            </div>
        </div>
    </div>
  );

  const TermsPage = () => (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in duration-500 font-['Hind_Madurai']">
          <div className="prose prose-orange max-w-none"><h1 className="text-3xl font-bold mb-6 font-['Open_Sans'] text-[#333333]">{t.terms_title}</h1><p className="text-sm text-gray-500 mb-8">{t.terms_last_updated}</p><h3 className="text-xl font-bold mt-6 mb-3 text-[#333333]">{t.terms_1_title}</h3><p className="text-gray-700 mb-4">{t.terms_1_text}</p></div>
      </div>
  );

  const PrivacyPage = () => (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in duration-500 font-['Hind_Madurai']">
          <div className="prose prose-orange max-w-none"><h1 className="text-3xl font-bold mb-6 font-['Open_Sans'] text-[#333333]">{t.privacy_title}</h1><div className="bg-[#FFF0EB] border-l-4 border-[#FA6E28] p-4 mb-8"><p className="text-[#FA6E28] font-bold text-sm">{t.privacy_compliant}</p></div><h3 className="text-xl font-bold mt-6 mb-3 text-[#333333]">{t.privacy_1_title}</h3><p className="text-gray-700 mb-4">{t.privacy_1_text}</p></div>
      </div>
  );

  const AdminPanel = () => (
    <div className="max-w-6xl mx-auto px-4 py-8 font-['Hind_Madurai']">
        <div className="flex items-center justify-between mb-8"><h1 className="text-3xl font-bold text-[#333333] flex items-center font-['Open_Sans']"><Settings className="mr-3 w-8 h-8 text-gray-700" />{t.admin_panel}</h1><span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">Logged in as Admin</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="font-bold text-xl mb-4 text-[#333333]">Platform Stats</h3><div className="space-y-4"><div className="flex justify-between border-b pb-2"><span>Total Courses</span><span className="font-bold">{courses.length}</span></div><div className="flex justify-between border-b pb-2"><span>Total Bookings</span><span className="font-bold">--</span></div></div></div></div>
    </div>
  );

  const Dashboard = () => {
    // TEACHER DASHBOARD
    if (user.role === 'teacher') {
        const myCourses = courses.filter(c => c.user_id === user.id); 
        const totalPaidOut = teacherEarnings.filter(e => e.isPaidOut).reduce((sum, e) => sum + e.payout, 0);

        return (
            <div className="max-w-6xl mx-auto px-4 py-8 font-['Hind_Madurai']">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div><h1 className="text-3xl font-bold text-[#333333] font-['Open_Sans']">{t.teacher_dash}</h1><p className="text-gray-500">Welcome back, {user.name}</p></div>
                    <button onClick={() => setView('create')} className="bg-[#FA6E28] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#E55D1F] flex items-center shadow-lg hover:-translate-y-0.5 transition font-['Open_Sans']"><KursNaviLogo className="mr-2 w-5 h-5 text-white" /> New Course</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4"><DollarSign className="text-green-600" /></div><div><p className="text-sm text-gray-500">Total Payouts Received</p><p className="text-2xl font-bold text-[#333333]">CHF {totalPaidOut.toFixed(2)}</p></div></div>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4"><User className="text-blue-600" /></div><div><p className="text-sm text-gray-500">Total Students</p><p className="text-2xl font-bold text-[#333333]">{teacherEarnings.length}</p></div></div>
                </div>
                <h2 className="text-xl font-bold mb-4 font-['Open_Sans'] text-[#333333]">Student & Earnings History</h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                      {teacherEarnings.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#FAF5F0] border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Date</th><th className="px-6 py-4 font-semibold text-gray-600">Course</th><th className="px-6 py-4 font-semibold text-gray-600">Student</th><th className="px-6 py-4 font-semibold text-gray-600">Your Payout (85%)</th><th className="px-6 py-4 font-semibold text-gray-600">Status</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {teacherEarnings.map(earning => (
                                        <tr key={earning.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm text-gray-500">{earning.date}</td>
                                            <td className="px-6 py-4 font-medium text-[#333333]">{earning.courseTitle}</td>
                                            <td className="px-6 py-4 text-gray-700">{earning.studentName}</td>
                                            <td className="px-6 py-4 font-bold text-[#333333]">CHF {earning.payout.toFixed(2)}</td>
                                            <td className="px-6 py-4">{earning.isPaidOut ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Paid Out</span> : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                      ) : <div className="p-8 text-center text-gray-500">No student bookings yet.</div>}
                </div>
                <h2 className="text-xl font-bold mb-4 font-['Open_Sans'] text-[#333333]">My Active Courses</h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {myCourses.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#FAF5F0] border-b border-gray-200"><tr><th className="px-6 py-4 font-semibold text-gray-600">Course</th><th className="px-6 py-4 font-semibold text-gray-600">Price</th><th className="px-6 py-4 font-semibold text-gray-600">Actions</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {myCourses.map(course => (
                                        <tr key={course.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4"><div className="font-bold text-[#333333]">{course.title}</div><div className="text-xs text-gray-400">{course.category}</div></td>
                                            <td className="px-6 py-4 font-medium">CHF {course.price}</td>
                                            <td className="px-6 py-4"><button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5" /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <div className="p-8 text-center text-gray-500">You haven't posted any courses yet.</div>}
                </div>
            </div>
        );
    } 
    // STUDENT DASHBOARD
    return (
        <div className="max-w-6xl mx-auto px-4 py-8 font-['Hind_Madurai']">
            <h1 className="text-3xl font-bold text-[#333333] mb-8 font-['Open_Sans']">{t.student_dash}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-bold mb-4 text-[#333333]">{t.my_bookings}</h2>
                    <div className="space-y-4">
                        {myBookings.length > 0 ? myBookings.map(course => {
                            let canCancel = true; let deadlineText = "";
                            if (course.start_date) {
                                const deadline = calculateDeadline(course.start_date);
                                const now = new Date();
                                if (now > deadline) { canCancel = false; deadlineText = `Cancellation period ended on ${deadline.toLocaleDateString()}`; } 
                                else { deadlineText = `Cancel until ${deadline.toLocaleDateString()}`; }
                            }
                            return (
                                <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                                    <img src={course.image_url} className="w-20 h-20 rounded-lg object-cover" />
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-[#333333]">{course.title}</h3><p className="text-sm text-gray-500">{course.instructor_name} • {course.canton}</p>
                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="text-green-600 text-sm font-medium flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Confirmed</div>
                                            {canCancel ? (
                                                <div className="flex flex-col items-end"><button onClick={() => handleCancelBooking(course.id, course.title)} className="text-red-500 text-sm hover:text-red-700 hover:underline font-medium">Cancel Booking</button><span className="text-xs text-gray-400 mt-1">{deadlineText}</span></div>
                                            ) : (<div className="flex items-center text-gray-400 text-sm bg-gray-50 px-2 py-1 rounded"><Lock className="w-3 h-3 mr-1" /><span>Non-refundable</span></div>)}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : <p className="text-gray-500 italic">You haven't booked any courses yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF5F0] font-sans text-[#333333] selection:bg-orange-100 selection:text-[#FA6E28] flex flex-col font-['Hind_Madurai']">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@300;400;500;600&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');`}</style>
      {notification && (<div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-[#333333] text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce font-['Open_Sans']"><CheckCircle className="w-5 h-5 mr-2 text-[#FA6E28]" />{notification}</div>)}
      <Navbar t={t} user={user} lang={lang} setLang={setLang} setView={setView} handleLogout={handleLogout} setShowResults={setShowResults} />

      <div className="flex-grow">
      {view === 'home' && (
        <>
          <div className="bg-white text-[#333333] py-20 px-4">
              <div className="max-w-4xl mx-auto text-center space-y-6">
                 <div className="flex justify-center mb-6"><KursNaviLogo className="w-24 h-24" /></div>
                 <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-['Open_Sans'] text-[#FA6E28]">{t.hero_title}</h1>
                 <p className="text-xl text-gray-500 max-w-2xl mx-auto">{t.hero_subtitle}</p>
              </div>
          </div>
           {/* --- FILTER BAR --- */}
           <div className="bg-white border-b sticky top-20 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-grow w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" placeholder={t.search_placeholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()} className="w-full pl-10 pr-4 py-3 bg-[#FAF5F0] border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FA6E28] focus:bg-white transition-colors" />
                </div>
                <CategoryDropdown /> <LocationDropdown />
                <button onClick={handleSearchSubmit} className="bg-[#FA6E28] text-white px-8 py-3 rounded-full font-bold hover:bg-[#E55D1F] transition shadow-md">{t.btn_search}</button>
                {(selectedCatPath.length > 0 || selectedLocations.length > 0) && (<button onClick={() => { setSelectedCatPath([]); setSelectedLocations([]); setSearchQuery(""); setShowResults(false); }} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>)}
            </div>
            {(selectedCatPath.length > 0 || selectedLocations.length > 0) && (<div className="max-w-7xl mx-auto px-4 pb-4 flex gap-2 flex-wrap">{selectedCatPath.map((part, i) => (<span key={i} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-md font-bold">{getCatLabel(part)}</span>))}{selectedLocations.map((loc, i) => (<span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold">{loc}</span>))}</div>)}
          </div>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {!showResults ? (<LandingPageContent />) : (
                loading ? <div className="text-center py-20"><Loader className="animate-spin w-10 h-10 text-[#FA6E28] mx-auto" /></div> : filteredCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {filteredCourses.map(course => (
                      <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                        <div className="relative h-48 overflow-hidden">
                            <img src={course.image_url} alt={course.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm flex items-center"><MapPin className="w-3 h-3 mr-1 text-[#FA6E28]" />{course.canton}</div>
                        </div>
                        <div className="p-5">
                            <h3 className="font-bold text-lg text-[#333333] leading-tight line-clamp-2 h-12 mb-2 font-['Open_Sans']">{course.title}</h3>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                               <div className="flex items-center space-x-3 text-sm text-gray-500"><div className="flex items-center bg-[#FAF5F0] px-2 py-1 rounded"><User className="w-3 h-3 text-gray-500 mr-1" />{course.instructor_name}</div></div>
                               <span className="font-bold text-[#FA6E28] text-lg font-['Open_Sans']">{t.currency} {course.price}</span>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300"><p className="text-gray-500 text-lg font-medium">{t.no_results}</p></div>
            )}
          </main>
        </>
      )}

      {view === 'success' && <SuccessView />}
      {view === 'detail' && selectedCourse && <DetailView course={selectedCourse} />}
      {view === 'login' && <AuthView />}
      {view === 'about' && <AboutPage />}
      {view === 'contact' && <ContactPage />}
      {view === 'terms' && <TermsPage />}
      {view === 'privacy' && <PrivacyPage />}
      {view === 'admin' && user?.role === 'admin' && <AdminPanel />}
      {view === 'dashboard' && user && <Dashboard />}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm />}
      </div>
    
      <Footer t={t} setView={setView} />
    </div>
  );
}