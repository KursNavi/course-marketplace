import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle } from 'lucide-react';

// --- IMPORTS ---
import { CATEGORY_LABELS, TRANSLATIONS, NEW_TAXONOMY, CATEGORY_TYPES, COURSE_LEVELS, AGE_GROUPS } from './lib/constants';
import { supabase } from './lib/supabase';

// Components
import { Navbar, Footer } from './components/Layout';
import { Home } from './components/Home';
import { CategoryDropdown, LocationDropdown } from './components/Filters';
import LegalPage from './components/LegalPage';

// Full Page Components
import LandingView from './components/LandingView';
import SearchPageView from './components/SearchPageView';
import DetailView from './components/DetailView';
import TeacherProfileView from './components/TeacherProfileView';
import Dashboard from './components/Dashboard';
import TeacherForm from './components/TeacherForm';
import AdminPanel from './components/AdminPanel';
import AuthView from './components/AuthView';
import ContactPage from './components/ContactPage';
import AboutPage from './components/AboutPage';
import HowItWorksPage from './components/HowItWorksPage';
import SuccessView from './components/SuccessView';

// --- MAIN APP COMPONENT ---
export default function KursNaviPro() {
  // 1. Initial State Logic
  const getInitialView = () => {
      const path = window.location.pathname;
      if (path.startsWith('/control-room-2025')) return 'admin';
      
      const routes = {
          '/search': 'search',
          '/dashboard': 'dashboard',
          '/how-it-works': 'how-it-works',
          '/about': 'about',
          '/contact': 'contact',
          '/login': 'login',
          '/create-course': 'create',
          '/private': 'landing-private',
          '/professional': 'landing-prof',
          '/children': 'landing-kids',
          '/agb': 'agb',
          '/datenschutz': 'datenschutz',
          '/impressum': 'impressum',
          '/widerruf-storno': 'widerruf',
          '/vertrauen-sicherheit': 'trust'
      };
      
      if (routes[path]) return routes[path];
      // SEO Routing: Check for new structure /courses/topic/location/id
      if (path.startsWith('/courses/')) {
          const parts = path.split('/').filter(Boolean); // remove empty strings
          // Pattern: courses (0) -> topic (1) -> location (2) -> id (3)
          if (parts.length >= 4) return 'detail'; 
          // Pattern: courses (0) -> topic (1) -> location (2) (Category Page)
          if (parts.length >= 2) return 'search';
      }
      // Legacy Redirect Support
      if (path.startsWith('/course/')) return 'detail';
      
      return 'home';
  };

  const [lang, setLang] = useState('de');
  const [view, setView] = useState(getInitialView);
  const [user, setUser] = useState(null); 
  const [session, setSession] = useState(null);
  
  // App Data State
  const [courses, setCourses] = useState([]); 
  const [myBookings, setMyBookings] = useState([]); 
  const [teacherEarnings, setTeacherEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [notification, setNotification] = useState(null);

  // Filter States
  const [locMode, setLocMode] = useState('canton');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const [searchType, setSearchType] = useState("");
  const [searchArea, setSearchArea] = useState("");
  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [searchAge, setSearchAge] = useState("");
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [selectedCatPath, setSelectedCatPath] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterLevel, setFilterLevel] = useState("All");
  const [filterPro, setFilterPro] = useState(false);

  const catMenuRef = useRef(null);
  const locMenuRef = useRef(null);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['de'];

  // --- ACTIONS & HANDLERS ---
  const changeLanguage = async (newLang) => {
    setLang(newLang);
    if (user && user.id) {
        await supabase.from('profiles').update({ preferred_language: newLang }).eq('id', user.id);
    }
  };

  const getCatLabel = (key) => {
    if (lang === 'en') return key;
    const translation = CATEGORY_LABELS[key];
    return translation && translation[lang] ? translation[lang] : key;
  };

  const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const handleLogout = async () => { await supabase.auth.signOut(); showNotification("Logged out successfully"); setView('home'); };

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

  // --- DATA FETCHING & FILTER LOGIC ---
  const normalizeCourse = (c) => {
    if (c.category_type) return c;
    // Migration Logic for legacy courses
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
       type = 'kinder_jugend'; area = 'freizeit_hobbys'; age = ['age_7_9', 'age_10_12'];
       if (oldCat.includes('school') || oldCat.includes('math')) area = 'schule_lernen';
    }
    else {
       if (oldCat.includes('music') || oldCat.includes('musik') || oldCat.includes('guitar')) area = 'musik'; 
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
      
      // Deep Link Logic (SEO Enhanced)
      const path = window.location.pathname;
      let urlId = null;

      if (path.startsWith('/courses/')) {
          const parts = path.split('/').filter(Boolean);
          // Expecting: courses/topic/location/ID or courses/topic/location/ID-slug
          if (parts.length >= 4) {
              const lastPart = parts[3]; 
              // Extract ID if it contains a slug (e.g. "123-yoga-course" -> "123")
              urlId = lastPart.split('-')[0];
          } else if (parts.length >= 2) {
             // Pre-fill filters for category pages (Topic/Location)
             // This would need logic to map 'pottery' to searchArea, but kept simple for now:
             setView('search');
          }
      } else if (path.startsWith('/course/')) {
          // Legacy support
          urlId = path.split('/')[2];
      }

      if (migratedData && urlId) {
          const found = migratedData.find(c => c.id == urlId);
          if (found) { 
              setSelectedCourse(found); 
              setView('detail'); 
              
              // 301-Style Client Redirect: Update URL to new structure if it's the old one
              if (path.startsWith('/course/')) {
                 // The useEffect hook below will handle the URL replacement automatically
              }
          }
      }
    } catch (error) { console.error('Error:', error.message); showNotification("Error loading courses"); } finally { setLoading(false); }
  };

  const fetchBookings = async (userId) => {
    const { data } = await supabase.from('bookings').select('*, courses(*)').eq('user_id', userId);
    setMyBookings(data ? data.map(booking => booking.courses).filter(Boolean) : []);
  };

  const fetchTeacherEarnings = async (userId) => {
      const { data: myCourses } = await supabase.from('courses').select('id, title, price').eq('user_id', userId);
      if (!myCourses || myCourses.length === 0) return;
      const courseIds = myCourses.map(c => c.id);
      const { data: bookings } = await supabase.from('bookings').select('*, profiles:user_id(full_name, email)').in('course_id', courseIds);
      if (bookings) {
          setTeacherEarnings(bookings.map(booking => {
              const course = myCourses.find(c => c.id === booking.course_id);
              return { 
                  id: booking.id, 
                  courseTitle: course?.title || 'Unknown', 
                  studentName: booking.profiles?.full_name || 'Guest Student', 
                  price: course?.price || 0, 
                  payout: (course?.price || 0) * 0.85, 
                  isPaidOut: booking.is_paid, 
                  date: new Date(booking.created_at).toLocaleDateString() 
              };
          }));
      }
  };

  // Filter Logic
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

    const safeTitle = (course.title || "").toLowerCase(); 
    const safeInstructor = (course.instructor_name || "").toLowerCase(); 
    const matchesSearch = safeTitle.includes(searchQuery.toLowerCase()) || safeInstructor.includes(searchQuery.toLowerCase());
    
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

// --- EFFECT HOOKS ---
  // 1. Initial Data Load
  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    let path = '/';
    const routes = {
        'landing-private': '/private', 'landing-prof': '/professional', 'landing-kids': '/children',
        'search': '/search', 'how-it-works': '/how-it-works', 'about': '/about', 'contact': '/contact',
        'login': '/login', 'dashboard': '/dashboard', 'agb': '/agb', 'datenschutz': '/datenschutz',
        'impressum': '/impressum', 'widerruf': '/widerruf-storno', 'trust': '/vertrauen-sicherheit',
        'admin': '/control-room-2025', 'create': '/create-course'
    };
    if (routes[view]) path = routes[view];
    else if (view === 'detail' && selectedCourse) {
        // SEO Friendly URL Construction: /courses/{topic}/{location}/{id}-{slug}
        const topicSlug = (selectedCourse.category_area || 'kurs').toLowerCase().replace(/_/g, '-');
        const locSlug = (selectedCourse.canton || 'schweiz').toLowerCase();
        const titleSlug = (selectedCourse.title || 'detail').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        path = `/courses/${topicSlug}/${locSlug}/${selectedCourse.id}-${titleSlug}`;
    }

    if (window.location.pathname !== path) {
        // Use replaceState if correcting a legacy URL, otherwise pushState
        const method = window.location.pathname.startsWith('/course/') ? 'replaceState' : 'pushState';
        window.history[method]({ view, courseId: selectedCourse?.id }, '', path);
    }
  }, [view, selectedCourse]);

  useEffect(() => {
    const handleUrlChange = () => setView(getInitialView());
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
        setUser(null); setMyBookings([]); setTeacherEarnings([]);
        if (['/dashboard', '/create-course'].includes(window.location.pathname)) setView('home');
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
                    localStorage.removeItem('pendingCourseId'); localStorage.removeItem('pendingEventId');
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

  // --- RENDER ---
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