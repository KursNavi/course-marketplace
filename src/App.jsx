import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, CheckCircle, ArrowLeft, ArrowRight, Shield, X, Smile } from 'lucide-react';

// --- IMPORTS (Deine neuen Komponenten) ---
import { BRAND, CATEGORY_HIERARCHY, CATEGORY_LABELS, SWISS_CANTONS, TRANSLATIONS, NEW_TAXONOMY, CATEGORY_TYPES, COURSE_LEVELS, AGE_GROUPS } from './lib/constants';
import { Navbar, Footer, KursNaviLogo } from './components/Layout';
import { Home } from './components/Home';
import LegalPage from './components/LegalPage';
import { CategoryDropdown, LocationDropdown } from './components/Filters';

// Ausgelagerte Komponenten
import HowItWorksPage from './components/HowItWorksPage';
import AdminPanel from './components/AdminPanel';
import Dashboard from './components/Dashboard';
import TeacherForm from './components/TeacherForm';
import SearchPageView from './components/SearchPageView';
import DetailView from './components/DetailView';
import AuthView from './components/AuthView';
import ContactPage from './components/ContactPage';
import AboutPage from './components/AboutPage';
import { supabase } from './lib/supabase';

// --- LOKALE KOMPONENTEN (Diese lassen wir vorerst hier, da sie kleiner sind) ---

const LandingView = ({ title, subtitle, variant, searchQuery, setSearchQuery, handleSearchSubmit, setSelectedCatPath, setView, t, getCatLabel }) => {
    let categories = {};
    let rootCategory = "";
    let bgImage = "";
      
    if (variant === 'private') {
        categories = CATEGORY_HIERARCHY["Private & Hobby"];
        rootCategory = "Private & Hobby";
        bgImage = "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000"; 
    } else if (variant === 'prof') {
        categories = CATEGORY_HIERARCHY["Professional"];
        rootCategory = "Professional";
        bgImage = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=2000"; 
    } else if (variant === 'kids') {
        categories = CATEGORY_HIERARCHY["Children"];
        rootCategory = "Children";
        bgImage = "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&q=80&w=2000"; 
    }

    const handleCategoryClick = (subCat) => {
        setSelectedCatPath([rootCategory, subCat]);
        setView('search');
        window.scrollTo(0, 0);
    };

    return (
        <div className="min-h-screen bg-beige font-sans">
            <div className="relative py-24 px-4 text-center text-white overflow-hidden" style={{ backgroundColor: '#2d2d2d' }}>
                <div className="absolute inset-0 z-0">
                    <img src={bgImage} alt={title} className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                    <div className="absolute inset-0 bg-black/60"></div>
                </div>
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

const TeacherProfileView = ({ teacher, courses, setView, setSelectedCourse, t, getCatLabel }) => {
    const teacherCourses = courses.filter(c => c.user_id === teacher.id);

    return (
        <div className="max-w-5xl mx-auto px-4 py-12 font-sans">
            <button onClick={() => window.history.back()} className="flex items-center text-gray-500 hover:text-primary mb-8">
                <ArrowLeft className="w-4 h-4 mr-2"/> {t.btn_back}
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-primary text-4xl font-bold">
                            {teacher.full_name?.charAt(0)}
                        </div>
                        <h1 className="text-2xl font-bold text-dark">{teacher.full_name}</h1>
                        <p className="text-gray-500 text-sm mb-4">{teacher.city}, {teacher.canton}</p>
                        {teacher.is_professional && (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" /> Professional
                            </span>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-8">
                    <section>
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t.lbl_bio || "Über mich"}</h2>
                        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {teacher.bio_text || "Dieser Lehrer hat noch keine Biografie hinterlegt."}
                        </p>
                    </section>

                    {teacher.certificates && teacher.certificates.length > 0 && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Zertifizierungen</h2>
                            <ul className="space-y-2">
                                {teacher.certificates.map((cert, i) => (
                                    <li key={i} className="flex items-center text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <Shield className="w-4 h-4 mr-3 text-green-500" /> {cert}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section>
                        <h2 className="text-xl font-bold mb-6 border-b pb-2">Kurse von {teacher.full_name}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {teacherCourses.map(course => (
                                <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md cursor-pointer transition">
                                    <img src={course.image_url} className="w-full h-32 object-cover" />
                                    <div className="p-4">
                                        <h3 className="font-bold text-sm line-clamp-1">{course.title}</h3>
                                        <p className="text-primary font-bold text-sm mt-2">CHF {course.price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
export default function KursNaviPro() {
  const getInitialView = () => {
      const path = window.location.pathname;
      if (path.startsWith('/control-room-2025')) return 'admin';
      
      if (path === '/search') return 'search';
      if (path === '/dashboard') return 'dashboard';
      if (path === '/how-it-works') return 'how-it-works';
      if (path === '/about') return 'about';
      if (path === '/contact') return 'contact';
      if (path === '/login') return 'login';
      if (path === '/create-course') return 'create';
      if (path === '/private') return 'landing-private';
      if (path === '/professional') return 'landing-prof';
      if (path === '/children') return 'landing-kids';
      if (path.startsWith('/course/')) return 'detail';
      if (path === '/agb') return 'agb';
      if (path === '/datenschutz') return 'datenschutz';
      if (path === '/impressum') return 'impressum';
      if (path === '/widerruf-storno') return 'widerruf';
      if (path === '/vertrauen-sicherheit') return 'trust';
      
      return 'home';
  };

  const [lang, setLang] = useState('de');
  const [view, setView] = useState(getInitialView);
  const [user, setUser] = useState(null); 
  const [session, setSession] = useState(null);
  
  // App State
  const [courses, setCourses] = useState([]); 
  const [myBookings, setMyBookings] = useState([]); 
  const [teacherEarnings, setTeacherEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [notification, setNotification] = useState(null);

  // Location States
  const [locMode, setLocMode] = useState('canton');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [locMenuOpen, setLocMenuOpen] = useState(false);

  // New Taxonomy Filters
  const [searchType, setSearchType] = useState("");
  const [searchArea, setSearchArea] = useState("");
  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [searchAge, setSearchAge] = useState("");

  // Other Filters
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [selectedCatPath, setSelectedCatPath] = useState([]);

  // Secondary Filters
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

  // URL Synchronization
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
    else if (view === 'agb') path = '/agb';
    else if (view === 'datenschutz') path = '/datenschutz';
    else if (view === 'impressum') path = '/impressum';
    else if (view === 'widerruf') path = '/widerruf-storno';
    else if (view === 'trust') path = '/vertrauen-sicherheit';
    else if (view === 'admin') path = '/control-room-2025';
    else if (view === 'create') path = '/create-course';
    else if (view === 'detail' && selectedCourse) path = `/course/${selectedCourse.id}`;
    
    if (window.location.pathname !== path) {
        window.history.pushState({ view, courseId: selectedCourse?.id }, '', path);
    }
  }, [view, selectedCourse]);

  // Popstate Handler
  useEffect(() => {
    const handleUrlChange = () => {
        const path = window.location.pathname;
        if (path === '/agb') setView('agb');
        else if (path === '/datenschutz') setView('datenschutz');
        else if (path === '/impressum') setView('impressum');
        else if (path === '/widerruf-storno') setView('widerruf');
        else if (path === '/vertrauen-sicherheit') setView('trust');
        else if (path.startsWith('/control-room-2025')) setView('admin');
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

        supabase.from('profiles').select('preferred_language, is_professional').eq('id', session.user.id).single()
            .then(({ data }) => {
                if (data) {
                    if (data.preferred_language) setLang(data.preferred_language);
                    setUser(prev => prev ? { ...prev, is_professional: data.is_professional } : prev);
                }
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

        supabase.from('profiles').select('preferred_language, is_professional').eq('id', session.user.id).single()
            .then(({ data }) => {
                if (data) {
                    if (data.preferred_language) setLang(data.preferred_language);
                    setUser(prev => prev ? { ...prev, is_professional: data.is_professional } : prev);
                }
            });
        } else {
        setUser(null);
        setMyBookings([]);
        setTeacherEarnings([]);
        const protectedPaths = ['/dashboard', '/create-course'];
        if (protectedPaths.includes(window.location.pathname)) {
            setView('home');
        }
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
                const pendingEventId = localStorage.getItem('pendingEventId');
                const payload = { user_id: user.id, course_id: pendingCourseId, is_paid: false, status: 'confirmed' };
                if (pendingEventId) payload.event_id = pendingEventId;
                
                const { error } = await supabase.from('bookings').insert([payload]);
                if (!error) {
                    localStorage.removeItem('pendingCourseId');
                    localStorage.removeItem('pendingEventId');
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

  // --- HELPER: Live-Migration für alte Daten ---
  const normalizeCourse = (c) => {
    if (c.category_type) return c;
    let type = 'privat_hobby';
    let area = 'alltag_leben';
    let specialty = 'Sonstiges';
    let age = ['age_26_59']; 
    let level = 'all_levels';

    const oldCat = (c.category || "").toLowerCase();

    if (oldCat.includes('professional') || oldCat.includes('beruflich') || oldCat.includes('business')) {
       type = 'beruflich';
       area = 'soft_skills'; 
       if (oldCat.includes('business')) area = 'business_mgmt';
       if (oldCat.includes('tech') || oldCat.includes('it') || oldCat.includes('data')) area = 'it_digital';
       if (oldCat.includes('marketing')) area = 'marketing';
    } 
    else if (oldCat.includes('children') || oldCat.includes('kinder') || oldCat.includes('kids')) {
       type = 'kinder_jugend';
       area = 'freizeit_hobbys';
       age = ['age_7_9', 'age_10_12'];
       if (oldCat.includes('school') || oldCat.includes('math')) area = 'schule_lernen';
    }
    else {
       if (oldCat.includes('music') || oldCat.includes('musik') || oldCat.includes('guitar') || oldCat.includes('piano')) area = 'musik'; 
       else if (oldCat.includes('sport') || oldCat.includes('yoga') || oldCat.includes('fitness')) area = 'sport_fitness'; 
       else if (oldCat.includes('cook') || oldCat.includes('kochen')) area = 'kochen_genuss'; 
       else if (oldCat.includes('art') || oldCat.includes('kunst')) area = 'kunst_kreativ'; 
       else if (oldCat.includes('language') || oldCat.includes('sprache')) area = 'sprachen_privat'; 
    }

    return { ...c, category_type: type, category_area: area, category_specialty: specialty, target_age_groups: age, level: level };
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('courses').select('*, course_events(*, bookings(count))').order('created_at', { ascending: false });
      if (error) throw error;
      const migratedData = (data || []).map(normalizeCourse);
      setCourses(migratedData);
      const path = window.location.pathname;
      if (path.startsWith('/course/')) {
          const urlId = path.split('/')[2];
          if (migratedData && urlId) {
              const found = migratedData.find(c => c.id == urlId);
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
  
  const handleSearchSubmit = () => { 
      setView('search');
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const filteredCourses = courses.filter(course => {
    if (!course) return false;
    let matchesType = true; if (searchType) matchesType = course.category_type === searchType;
    let matchesArea = true; if (searchArea) matchesArea = course.category_area === searchArea;
    let matchesSpecialty = true; if (searchSpecialty) matchesSpecialty = course.category_specialty === searchSpecialty;
    let matchesAge = true; if (searchAge) { matchesAge = course.target_age_groups && course.target_age_groups.includes(searchAge); }
    let matchesCategory = true; if (!searchType && !searchArea && selectedCatPath.length > 0) { const courseCatStr = (course.category || "").toLowerCase(); matchesCategory = selectedCatPath.every(part => courseCatStr.includes(part.toLowerCase())); }
    let matchesLocation = true;
    if (selectedLocations.length > 0) {
        const courseLocations = [];
        if (course.canton) courseLocations.push(course.canton);
        if (course.course_events) { course.course_events.forEach(ev => { if (ev.canton) courseLocations.push(ev.canton); if (ev.location) courseLocations.push(ev.location); }); }
        if (locMode === 'canton') { matchesLocation = selectedLocations.some(selLoc => courseLocations.includes(selLoc)); } 
        else { const address = (course.address || "").toLowerCase(); const canton = (course.canton || "").toLowerCase(); const eventAddresses = course.course_events ? course.course_events.map(ev => (ev.location || "").toLowerCase()).join(" ") : ""; matchesLocation = selectedLocations.some(city => address.includes(city.toLowerCase()) || canton.includes(city.toLowerCase()) || eventAddresses.includes(city.toLowerCase())); }
    }
    const safeTitle = (course.title || "").toLowerCase(); const safeInstructor = (course.instructor_name || "").toLowerCase(); const matchesSearch = safeTitle.includes(searchQuery.toLowerCase()) || safeInstructor.includes(searchQuery.toLowerCase());
    let matchesDate = true; 
    if (filterDate) {
        const filterTime = new Date(filterDate).getTime();
        const mainDate = course.start_date ? new Date(course.start_date).getTime() : 0;
        let hasEventAfter = mainDate >= filterTime;
        if (course.course_events && course.course_events.length > 0) { hasEventAfter = course.course_events.some(ev => new Date(ev.start_date).getTime() >= filterTime); }
        matchesDate = hasEventAfter;
    }
    let matchesPrice = true; if (filterPriceMax) matchesPrice = (course.price || 0) <= Number(filterPriceMax);
    let matchesLevel = true; if (filterLevel !== 'All') matchesLevel = course.level === filterLevel;
    let matchesPro = true; if (filterPro) matchesPro = course.is_pro === true;
    return matchesType && matchesArea && matchesSpecialty && matchesAge && matchesCategory && matchesLocation && matchesSearch && matchesDate && matchesPrice && matchesLevel && matchesPro;
  });

  return (
    <div className="min-h-screen bg-beige font-sans text-dark selection:bg-orange-100 selection:text-primary flex flex-col font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@300;400;500;600&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');`}</style>
      {notification && (<div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-dark text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce font-heading"><CheckCircle className="w-5 h-5 mr-2 text-primary" />{notification}</div>)}
      <Navbar t={t} user={user} lang={lang} setLang={changeLanguage} setView={setView} handleLogout={handleLogout} setShowResults={() => setView('search')} setSelectedCatPath={setSelectedCatPath} />

      <div className="flex-grow">
      {view === 'home' && (
            <Home t={t} courses={courses} setView={setView} setSearchType={setSearchType} setSearchArea={setSearchArea} setSearchSpecialty={setSearchSpecialty} setSelectedCatPath={setSelectedCatPath} searchQuery={searchQuery} setSearchQuery={setSearchQuery} catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} catMenuRef={catMenuRef} locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} getCatLabel={getCatLabel} />
        )}
        
      {view === 'landing-private' && ( <LandingView title="Unleash your passion." subtitle="Hobby Courses" variant="private" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-prof' && ( <LandingView title="Boost your career." subtitle="Professional Courses" variant="prof" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-kids' && ( <LandingView title="Fun learning for kids." subtitle="Children's Courses" variant="kids" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}

      {view === 'search' && (
          <SearchPageView courses={courses} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchType={searchType} setSearchType={setSearchType} searchArea={searchArea} setSearchArea={setSearchArea} searchSpecialty={searchSpecialty} setSearchSpecialty={setSearchSpecialty} searchAge={searchAge} setSearchAge={setSearchAge} locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} loading={loading} filteredCourses={filteredCourses} setSelectedCourse={setSelectedCourse} setView={setView} t={t} getCatLabel={getCatLabel} filterDate={filterDate} setFilterDate={setFilterDate} filterPriceMax={filterPriceMax} setFilterPriceMax={setFilterPriceMax} filterLevel={filterLevel} setFilterLevel={setFilterLevel} filterPro={filterPro} setFilterPro={setFilterPro} />
      )}

      {view === 'success' && <SuccessView setView={setView} />}
      {view === 'detail' && selectedCourse && ( <DetailView course={selectedCourse} setView={setView} t={t} setSelectedTeacher={setSelectedTeacher} user={user} /> )}
      {view === 'teacher-profile' && selectedTeacher && ( <TeacherProfileView teacher={selectedTeacher} courses={courses} setView={setView} setSelectedCourse={setSelectedCourse} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'how-it-works' && <HowItWorksPage t={t} setView={setView} />}
      {view === 'login' && <AuthView setView={setView} setUser={setUser} showNotification={showNotification} lang={lang} />}
      {view === 'about' && <AboutPage t={t} setView={setView} />}
      {view === 'contact' && <ContactPage t={t} setView={setView} showNotification={showNotification} />}
      
      {/* --- LEGAL PAGES --- */}
      {view === 'agb' && <LegalPage pageKey="agb" lang={lang} setView={setView} />}
      {view === 'datenschutz' && <LegalPage pageKey="datenschutz" lang={lang} setView={setView} />}
      {view === 'impressum' && <LegalPage pageKey="impressum" lang={lang} setView={setView} />}
      {view === 'widerruf' && <LegalPage pageKey="widerruf" lang={lang} setView={setView} />}
      {view === 'trust' && <LegalPage pageKey="trust" lang={lang} setView={setView} />}

      {view === 'admin' && <AdminPanel t={t} courses={courses} setCourses={setCourses} showNotification={showNotification} fetchCourses={fetchCourses} />}
      {view === 'dashboard' && user && <Dashboard user={user} t={t} setView={setView} courses={courses} teacherEarnings={teacherEarnings} myBookings={myBookings} handleDeleteCourse={handleDeleteCourse} handleEditCourse={handleEditCourse} showNotification={showNotification} changeLanguage={changeLanguage} setSelectedCourse={setSelectedCourse} />}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm t={t} setView={setView} user={user} fetchCourses={fetchCourses} showNotification={showNotification} setEditingCourse={setEditingCourse} initialData={editingCourse} />}
      </div>
      
      <Footer t={t} setView={setView} />
    </div>
  );
}