import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle } from 'lucide-react';

// --- IMPORTS ---
import { CATEGORY_LABELS, TRANSLATIONS, NEW_TAXONOMY, CATEGORY_TYPES } from './lib/constants';
import { supabase } from './lib/supabase';

// Components
import { Navbar, Footer } from './components/Layout';
import { Home } from './components/Home';
import LegalPage from './components/LegalPage';

// Full Page Components
import LandingView from './components/LandingView';
import SearchPageView from './components/SearchPageView';
import DetailView from './components/DetailView';
import TeacherHub from './components/TeacherHub';
import TeacherProfileView from './components/TeacherProfileView';
import Dashboard from './components/Dashboard';
import TeacherForm from './components/TeacherForm';
import AdminPanel from './components/AdminPanel';
import AuthView from './components/AuthView';
import ContactPage from './components/ContactPage';
import AboutPage from './components/AboutPage';
import HowItWorksPage from './components/HowItWorksPage';
import SuccessView from './components/SuccessView';
import BlogList from './components/BlogList';
import BlogDetail from './components/BlogDetail';
import AdminBlogManager from './components/AdminBlogManager';
import CategoryLocationPage from './components/CategoryLocationPage';

// --- DEBUG: ERROR BOUNDARY (Fängt Abstürze ab) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Wichtig: in der Konsole sieht man oft Datei + Zeile noch klarer
    console.error("💥 APP CRASH:", error);
    console.error("📌 COMPONENT STACK:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-white min-h-screen text-red-600 pt-32 text-center">
          <h1 className="text-3xl font-bold mb-4">💥 APP ABGESTÜRZT</h1>

          <div className="max-w-4xl mx-auto text-left">
            <p className="font-mono bg-gray-100 p-4 rounded border border-red-200 whitespace-pre-wrap">
              {this.state.error?.toString()}
              {"\n\n"}
              {this.state.error?.stack ? this.state.error.stack : ""}
              {"\n\n"}
              {this.state.errorInfo?.componentStack ? this.state.errorInfo.componentStack : ""}
            </p>

            <p className="text-gray-600 mt-4">
              Tipp: Öffne auch “Untersuchen → Console” und kopiere den obersten roten Fehler inkl. Datei/Zeile.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


// --- MAIN APP COMPONENT ---
export default function KursNaviPro() {  // 1. Initial State Logic
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
          '/admin-blog': 'admin-blog',
          '/teacher-hub': 'teacher-hub',
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

      // BLOG ROUTING
      if (path === '/blog') return 'blog';
      if (path.startsWith('/blog/')) return 'blog-detail';

      // SEO Routing: Check for new structure /courses/topic/location/id
      if (path.startsWith('/courses/')) {
          const parts = path.split('/').filter(Boolean); // remove empty strings
          // Pattern: courses (0) -> topic (1) -> location (2) -> id (3)
          if (parts.length >= 4) return 'detail'; 
          // Pattern: courses (0) -> topic (1) -> location (2) (Programmatic Landing Page)
          if (parts.length === 3) return 'category-location';
          // Pattern: courses (0) -> topic (1) (fallback to search)
          if (parts.length >= 2) return 'search';
      }
      // Legacy Redirect Support
      if (path.startsWith('/course/')) return 'detail';
      
      return 'home';
  };

  const [lang, setLang] = useState('de');
  const [view, setView] = useState(getInitialView);
  const [user, setUser] = useState(null); 
  const [, setSession] = useState(null);
  
  // App Data State
  const [courses, setCourses] = useState([]);
    const coursesRef = useRef([]);
    const coursesLoadedRef = useRef(false);

  useEffect(() => {
    coursesRef.current = courses;
    if (courses.length > 0) coursesLoadedRef.current = true;
  }, [courses]);
  const [myBookings, setMyBookings] = useState([]); 
  const [savedCourses, setSavedCourses] = useState([]);
  const [savedCourseIds, setSavedCourseIds] = useState([]);
  const [teacherEarnings, setTeacherEarnings] = useState([]);
  const [articles, setArticles] = useState([]); // Blog State
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [notification, setNotification] = useState(null);

// --- FINAL FIX: Read params LIVE on every render (No useState) ---
  // Das garantiert, dass beim Navigieren die neuen Daten sofort da sind.
  let currentLocParams = { topicSlug: '', locationSlug: '' };
  
  if (window.location.pathname.startsWith('/courses/')) {
     const parts = window.location.pathname.split('/').filter(Boolean);
     // Pattern: /courses/topic/location (Länge 3)
     if (parts.length === 3) {
        currentLocParams = { topicSlug: parts[1], locationSlug: parts[2] };
     }
  }

  // Filter States
  const [locMode, setLocMode] = useState('canton');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef(null);
  const [searchType, setSearchType] = useState("");
  const [searchArea, setSearchArea] = useState("");
  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [searchFocus, setSearchFocus] = useState("");
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [selectedCatPath, setSelectedCatPath] = useState([]);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterLevel, setFilterLevel] = useState("All");
  const [filterPro, setFilterPro] = useState(false);
  const [filterDirectBooking, setFilterDirectBooking] = useState(false);

  const catMenuRef = useRef(null);
  const locMenuRef = useRef(null);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['de'];

  // --- SEO HELPERS (v3.1) ---
  const BASE_URL = 'https://kursnavi.ch';
  const slugify = (input) => {
    return (input || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/&/g, ' und ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const buildCoursePath = (c) => {
    if (!c) return '/search';
    const topic = slugify(c.primary_category || c.category_area || 'kurs');
    const loc = slugify(c.canton || 'schweiz');
    const title = slugify(c.title || 'detail');
    return `/courses/${topic}/${loc}/${c.id}-${title}`;
  };


  // --- ACTIONS & HANDLERS ---
  const changeLanguage = async (newLang) => {
    setLang(newLang);
    if (user && user.id) {
        await supabase.from('profiles').update({ preferred_language: newLang }).eq('id', user.id);
    }
  };

  // --- SEO: Dynamic lang attribute ---
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

    const getCatLabel = (key) => {
      if (!key) return '';

      // 1. Priorität: Legacy Labels (Flache Liste) prüfen
      const legacyTranslation = (CATEGORY_LABELS || {})[key];
      if (legacyTranslation && legacyTranslation[lang]) return legacyTranslation[lang];

      // 2. Priorität: Kategorie-Typen prüfen (z.B. "beruflich")
      if (CATEGORY_TYPES && CATEGORY_TYPES[key]) {
          return CATEGORY_TYPES[key][lang] || CATEGORY_TYPES[key]['de'];
      }

      // 3. Priorität: Neue Taxonomie durchsuchen (z.B. "sport_fitness_beruf")
      if (NEW_TAXONOMY) {
          for (const typeKey in NEW_TAXONOMY) {
              const areas = NEW_TAXONOMY[typeKey];
              // Prüfen, ob der Key in diesem Bereich existiert
              if (areas && areas[key] && areas[key].label) {
                  return areas[key].label[lang] || areas[key].label['de'];
              }
          }
      }

      // Fallback: Einfach den Key anzeigen (besser als nichts)
      return key;
    };

  const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const handleLogout = async () => { await supabase.auth.signOut(); showNotification("Logged out successfully"); setView('home'); };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;

    setCourses(prev => prev.filter(c => c.id !== courseId));

    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) showNotification("Error deleting: " + error.message);
    else showNotification("Course deleted.");
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
  // --- DATA FETCHING & FILTER LOGIC ---
  const normalizeCourse = (c) => {
    // Bereits neues Schema?
    if (c.category_type) {
      const primary = c.primary_category || c.category_area || 'kurs';
      const categories =
        Array.isArray(c.categories) && c.categories.length > 0 ? c.categories : [primary];

      return { ...c, primary_category: primary, categories };
    }

    // Migration Logic for legacy courses
    let type = 'privat_hobby';
    let area = 'alltag_leben';
    let specialty = 'Sonstiges';
    let age = ['age_26_59'];
    let level = 'all_levels';
    const oldCat = (c.category || "").toLowerCase();

    if (
      oldCat.includes('professional') ||
      oldCat.includes('beruflich') ||
      oldCat.includes('business')
    ) {
      type = 'beruflich';
      area = 'soft_skills';
      if (oldCat.includes('business')) area = 'business_mgmt';
      if (oldCat.includes('tech') || oldCat.includes('it') || oldCat.includes('data')) area = 'it_digital';
      if (oldCat.includes('marketing')) area = 'marketing';
    } else if (oldCat.includes('children') || oldCat.includes('kinder') || oldCat.includes('kids')) {
      type = 'kinder_jugend';
      area = 'freizeit_hobbys';
      age = ['age_7_9', 'age_10_12'];
      if (oldCat.includes('school') || oldCat.includes('math')) area = 'schule_lernen';
    } else {
      if (oldCat.includes('music') || oldCat.includes('musik') || oldCat.includes('guitar')) area = 'musik';
      else if (oldCat.includes('sport') || oldCat.includes('yoga') || oldCat.includes('fitness')) area = 'sport_fitness';
      else if (oldCat.includes('cook') || oldCat.includes('kochen')) area = 'kochen_genuss';
      else if (oldCat.includes('art') || oldCat.includes('kunst')) area = 'kunst_kreativ';
      else if (oldCat.includes('language') || oldCat.includes('sprache')) area = 'sprachen_privat';
    }

    // Default für Multi-Kategorien
    const primary_category = area;
    const categories = [primary_category];

    return {
      ...c,
      category_type: type,
      category_area: area,
      category_specialty: specialty,
      target_age_groups: age,
      level,
      primary_category,
      categories
    };
  };


  const fetchCourses = async () => {
    try {
            setLoading(true);

      // V3.0 Data Sync (robust): Lade Kurse + Events zuerst, Profile danach separat (kein fragiler Join)
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(`*, course_events(*, bookings(count))`)
        .order('created_at', { ascending: false });

      if (courseError) throw courseError;

      // Instructor-Profile in einer zweiten Query holen
      const userIds = [...new Set((courseData || []).map(c => c.user_id).filter(Boolean))];

      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, bio_text, certificates, additional_locations, city, canton, verification_status')
          .in('id', userIds);

        if (!profileError && profileData) {
          profileMap = Object.fromEntries(profileData.map(p => [p.id, p]));
        }
      }

      // Load all course categories for multi-category search support
      const courseIds = (courseData || []).map(c => c.id).filter(Boolean);
      let categoriesMap = {};

      if (courseIds.length > 0) {
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('course_categories')
          .select('*')
          .in('course_id', courseIds);

        if (!categoriesError && categoriesData) {
          // Group categories by course_id
          categoriesMap = categoriesData.reduce((acc, cat) => {
            if (!acc[cat.course_id]) {
              acc[cat.course_id] = [];
            }
            acc[cat.course_id].push(cat);
            return acc;
          }, {});
        }
      }

      const migratedData = (courseData || []).map(c => {
        const normalized = normalizeCourse(c);
        const prof = profileMap[c.user_id];

        return {
          ...normalized,
          instructor_bio: prof?.bio_text,
          instructor_certificates: prof?.certificates,
          additional_locations: prof?.additional_locations,
          instructor_verified: prof?.verification_status === 'verified',
          all_categories: categoriesMap[c.id] || [], // Add all categories including Zweitkategorien
        };
      });

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
          } else if (parts.length === 3) {
             // Programmatic Landing Page: /courses/topic/location/
             setView('category-location');
          } else if (parts.length >= 2) {
             // Pre-fill filters for category pages (Topic/Location)
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

              // --- SEO TRAFFIC COP (v3.1) ---
              // Bestimmt die einzig wahre URL (ASCII-safe Slugs, konsistent mit Sitemap & DetailView)
              const canonicalPath = buildCoursePath(found);

              // Silent Fix: Wenn die aktuelle URL nicht der Canonical entspricht (falsche Kategorie oder Legacy), korrigieren.
              if (window.location.pathname !== canonicalPath) {
                window.history.replaceState({ view: 'detail', courseId: found.id }, '', canonicalPath);
              }
          } else {
              // --- SEO: 301 Redirect for expired/missing courses ---
              // Course not found - redirect to parent category to preserve SEO value
              if (path.startsWith('/courses/')) {
                  const parts = path.split('/').filter(Boolean);
                  if (parts.length >= 3) {
                      // Redirect to category-location page: /courses/topic/location/
                      const redirectPath = `/${parts[0]}/${parts[1]}/${parts[2]}/`;
                      window.history.replaceState({ view: 'category-location' }, '', redirectPath);
                      setView('category-location');
                  } else {
                      // Fallback to search
                      setView('search');
                  }
              } else {
                  // Legacy URL without category info - redirect to search
                  window.history.replaceState({ view: 'search' }, '', '/search');
                  setView('search');
              }
          }
      }
    } catch (error) { console.error('Error:', error.message); showNotification("Error loading courses"); } finally { setLoading(false); }
  };

  const fetchArticles = async () => {
      const { data } = await supabase.from('articles').select('*');
      if (data) setArticles(data);
      
      // Check URL for direct blog access
      const path = window.location.pathname;
      if (path.startsWith('/blog/') && path.length > 6) {
          const slug = path.split('/')[2];
          const found = data?.find(a => a.slug === slug);
          if (found) {
              setSelectedArticle(found);
              setView('blog-detail');
          }
      }
  };

  const fetchBookings = async (userId) => {
    const { data } = await supabase.from('bookings').select('*, courses(*)').eq('user_id', userId);
    setMyBookings(data ? data.map(booking => booking.courses).filter(Boolean) : []);
  };

  const fetchSavedCourses = async (userId) => {
    if (!userId) { setSavedCourses([]); setSavedCourseIds([]); return; }

    // Try join first (works if FK relationship is available in PostgREST)
    let { data, error } = await supabase
      .from('saved_courses')
      .select('course_id, created_at, courses(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const isRelationshipError =
      error &&
      (
        error.code === 'PGRST200' ||
        (error.message || '').includes("Could not find a relationship between") ||
        (error.message || '').includes("relationship between")
      );

    // Fallback if join is not available yet
    if (isRelationshipError) {
      const fallback = await supabase
        .from('saved_courses')
        .select('course_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      data = fallback.data;
      error = fallback.error;

      if (!error) {
        const ids = (data || []).map(r => r.course_id).filter(Boolean);
        if (ids.length === 0) {
          setSavedCourses([]);
          setSavedCourseIds([]);
          return;
        }

        const coursesRes = await supabase
          .from('courses')
          .select('*')
          .in('id', ids);

        if (!coursesRes.error) {
          const courseMap = new Map((coursesRes.data || []).map(c => [c.id, c]));
          const ordered = ids.map(id => courseMap.get(id)).filter(Boolean);
          setSavedCourses(ordered);
          setSavedCourseIds(ids);
          return;
        }
      }
    }

    if (error) {
      console.error('Error loading saved courses:', error.message);
      setSavedCourses([]);
      setSavedCourseIds([]);
      return;
    }

    const ids = (data || []).map(r => r.course_id).filter(Boolean);
    const list = (data || []).map(r => r.courses).filter(Boolean);
    setSavedCourses(list);
    setSavedCourseIds(ids);
  };

  const syncPendingSavedCourse = async (userId) => {
    const pending = localStorage.getItem('pendingSavedCourseId');
    if (!pending || !userId) return;

    const courseId = Number(pending);
    localStorage.removeItem('pendingSavedCourseId');

    if (!courseId) return;

    const { error } = await supabase
      .from('saved_courses')
      .upsert({ user_id: userId, course_id: courseId }, { onConflict: 'user_id,course_id' });

    if (!error) {
      fetchSavedCourses(userId);
      showNotification("Kurs zur Merkliste hinzugefügt.");
    }
  };

  const toggleSaveCourse = async (course) => {
    if (!course?.id) return;

    if (!user) {
      localStorage.setItem('pendingSavedCourseId', String(course.id));
      showNotification("Bitte anmelden, um Kurse zu merken.");
      setView('login');
      return;
    }

    const courseId = Number(course.id);
    const isSaved = savedCourseIds.includes(courseId);

    if (isSaved) {
      const { error } = await supabase
        .from('saved_courses')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (error) {
        showNotification("Fehler beim Entfernen: " + error.message);
        return;
      }
      showNotification("Aus Merkliste entfernt.");
    } else {
      const { error } = await supabase
        .from('saved_courses')
        .upsert({ user_id: user.id, course_id: courseId }, { onConflict: 'user_id,course_id' });

      if (error) {
        showNotification("Fehler beim Merken: " + error.message);
        return;
      }
      showNotification("Kurs gemerkt.");
    }

    fetchSavedCourses(user.id);
  };


    const fetchTeacherEarnings = async (userId) => {
      const { data: myCourses, error: myCoursesError } = await supabase
        .from('courses')
        .select('id, title, price')
        .eq('user_id', userId);

      if (myCoursesError) {
        console.error('Error loading teacher courses:', myCoursesError.message);
        return;
      }

      if (!myCourses || myCourses.length === 0) return;

      const courseIds = myCourses.map(c => c.id);

      // Try join to profiles first (requires DB relationship bookings.user_id -> profiles.id)
      let { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, profiles!user_id(full_name, email)')
        .in('course_id', courseIds);

      const isRelationshipError =
        bookingsError &&
        (
          bookingsError.code === 'PGRST200' ||
          (bookingsError.message || '').includes("Could not find a relationship between") ||
          (bookingsError.message || '').includes("relationship between 'bookings' and 'profiles'")
        );

      if (isRelationshipError) {
        // Fallback: load bookings without join
        const fallback = await supabase
          .from('bookings')
          .select('*')
          .in('course_id', courseIds);

        bookings = fallback.data;
        bookingsError = fallback.error;

        // If we got bookings, enrich with profiles in a second query
        if (!bookingsError && bookings && bookings.length > 0) {
          const studentIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))];

          if (studentIds.length > 0) {
            const { data: studentProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', studentIds);

            if (!profilesError) {
              const profileMap = new Map((studentProfiles || []).map(p => [p.id, p]));
              bookings = bookings.map(b => ({
                ...b,
                profiles: profileMap.get(b.user_id) || null
              }));
            } else {
              // Still return bookings, but without profile enrichment
              bookings = bookings.map(b => ({ ...b, profiles: null }));
            }
          } else {
            bookings = bookings.map(b => ({ ...b, profiles: null }));
          }
        }
      }

      if (bookingsError) {
        console.error('Error loading bookings:', bookingsError.message);
        return;
      }

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

    // Check category filters against ALL categories (primary + Zweitkategorien)
    let matchesType = true;
    if (searchType) {
      matchesType = course.category_type === searchType ||
        (Array.isArray(course.all_categories) &&
         course.all_categories.some(cat => cat && cat.category_type === searchType));
    }

    let matchesArea = true;
    if (searchArea) {
      matchesArea = course.category_area === searchArea ||
        (Array.isArray(course.categories) && course.categories.includes(searchArea)) ||
        (Array.isArray(course.all_categories) &&
         course.all_categories.some(cat => cat && cat.category_area === searchArea));
    }

    let matchesSpecialty = true;
    if (searchSpecialty) {
      matchesSpecialty = course.category_specialty === searchSpecialty ||
        (Array.isArray(course.all_categories) &&
         course.all_categories.some(cat => cat && cat.category_specialty === searchSpecialty));
    }

    let matchesFocus = true;
    if (searchFocus) {
      matchesFocus = course.category_focus === searchFocus ||
        (Array.isArray(course.all_categories) &&
         course.all_categories.some(cat => cat && cat.category_focus === searchFocus));
    }

    let matchesCategory = true;
    if (!searchType && !searchArea && Array.isArray(selectedCatPath) && selectedCatPath.length > 0) {
        const courseCatStr = (course.category || "").toString().toLowerCase();
        matchesCategory = selectedCatPath.every(part => part && courseCatStr.includes(part.toString().toLowerCase()));
    }
    
    let matchesLocation = true;
    if (selectedLocations.length > 0) {
        const courseLocations = [];
        if (course.canton) courseLocations.push(course.canton);
        if (Array.isArray(course.course_events)) {
            course.course_events.forEach(ev => {
                if (ev.canton) courseLocations.push(ev.canton);
                if (ev.location) courseLocations.push(ev.location);
            });
        }
        
        if (locMode === 'canton') {
            // Online courses are available everywhere - show them when any canton is selected
            const isOnlineCourse = courseLocations.includes('Online');
            matchesLocation = isOnlineCourse || selectedLocations.some(selLoc => courseLocations.includes(selLoc));
        } else {
            const address = (course.address || "").toString().toLowerCase();
            const canton = (course.canton || "").toString().toLowerCase();
            const eventAddresses = Array.isArray(course.course_events) 
                ? course.course_events.map(ev => (ev.location || "").toString().toLowerCase()).join(" ") 
                : "";
            
            matchesLocation = selectedLocations.some(city => 
                address.includes(city.toLowerCase()) || 
                canton.includes(city.toLowerCase()) || 
                eventAddresses.includes(city.toLowerCase())
            );
        }
    }

    const q = (searchQuery || "").toLowerCase();
    const safeTitle = (course.title || "").toString().toLowerCase(); 
    const safeInstructor = (course.instructor_name || "").toString().toLowerCase(); 
    const safeSpecialty = (course.category_specialty || "").toString().toLowerCase();
    
    // SAFETY FIX: Handle Arrays safely for search string generation
    const safeCategories = Array.isArray(course.categories) ? course.categories.join(" ") : (course.categories || "");
    const safeArea = ((course.category_area || "") + " " + safeCategories).toString().toLowerCase();
    
    // SAFETY FIX: Handle keywords if they come as an array from Supabase
    const safeKeywords = Array.isArray(course.keywords) 
        ? course.keywords.join(" ").toLowerCase() 
        : (course.keywords || "").toString().toLowerCase();
    
    const matchesSearch = safeTitle.includes(q) || 
                          safeInstructor.includes(q) || 
                          safeSpecialty.includes(q) || 
                          safeArea.includes(q) ||
                          safeKeywords.includes(q);
    
    // Date filter: Von-Bis Bereich
    // Kurse MIT Datum im Zeitraum werden angezeigt
    // Kurse OHNE Datum werden auch angezeigt (könnten im Zeitraum liegen)
    let matchesDate = true;
    if (filterDateFrom || filterDateTo) {
        const fromTime = filterDateFrom ? new Date(filterDateFrom).getTime() : 0;
        const toTime = filterDateTo ? new Date(filterDateTo).getTime() : Infinity;

        // Hole alle relevanten Daten des Kurses
        const courseDates = [];
        if (course.start_date) courseDates.push(new Date(course.start_date).getTime());
        if (Array.isArray(course.course_events)) {
            course.course_events.forEach(ev => {
                if (ev.start_date) courseDates.push(new Date(ev.start_date).getTime());
            });
        }

        // Kurs hat keine Daten -> wird angezeigt (könnte im Zeitraum sein)
        if (courseDates.length === 0) {
            matchesDate = true;
        } else {
            // Kurs hat mindestens ein Datum im Zeitraum
            matchesDate = courseDates.some(d => d >= fromTime && d <= toTime);
        }
    }

    let matchesPrice = true; if (filterPriceMax) matchesPrice = (course.price || 0) <= Number(filterPriceMax);
    let matchesLevel = true; if (filterLevel !== 'All') matchesLevel = course.level === filterLevel;
    let matchesPro = true; if (filterPro) matchesPro = course.is_pro === true;
    let matchesLanguage = true; if (selectedLanguage) matchesLanguage = course.language === selectedLanguage;
    let matchesDirectBooking = true; if (filterDirectBooking) matchesDirectBooking = course.booking_type === 'platform';

    return matchesType && matchesArea && matchesSpecialty && matchesFocus && matchesCategory && matchesLocation && matchesSearch && matchesDate && matchesPrice && matchesLevel && matchesPro && matchesLanguage && matchesDirectBooking;
  });
  
// --- EFFECT HOOKS ---
    useEffect(() => {
    fetchCourses();
    fetchArticles();

    // Hält view + selectedCourse immer synchron zur URL (auch bei pushState/replaceState)
    const syncFromUrl = () => {
      console.log('🔄 syncFromUrl CALLED');
      const nextView = getInitialView();
      const path = window.location.pathname;
      console.log('📍 Current path:', path);
      console.log('📍 Next view from getInitialView:', nextView);

      // 1) Detail-URL -> ID extrahieren
      let urlId = null;

      if (path.startsWith('/courses/')) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 4) {
          const lastPart = parts[3];
          urlId = (lastPart || '').split('-')[0];
        }
      } else if (path.startsWith('/course/')) {
        urlId = path.split('/')[2];
      }

      console.log('🔍 Extracted urlId:', urlId);
      console.log('📦 Courses in ref:', coursesRef.current?.length || 0);

      // 2) Wenn Detail: passenden Kurs aus bereits geladenen courses suchen
      if (urlId) {
        const found = (coursesRef.current || []).find(c => c && c.id == urlId);
        console.log('🔍 Course found:', found ? `Yes (ID: ${found.id})` : 'No');
        if (found) {
          console.log('✅ Setting selectedCourse and view=detail');
          setSelectedCourse(found);
          setView('detail');
          return;
        }

        // Kurs nicht gefunden - aber nur redirect wenn Kurse bereits geladen wurden
        // (sonst Race Condition bei Ctrl+Click / neuem Tab)
        if (!coursesLoadedRef.current) {
          console.log('⏳ Courses not loaded yet, waiting...');
          setView('detail'); // Temporär detail setzen, wird nach Laden korrigiert
          return;
        }

        // Kurs nicht gefunden -> 301 Redirect zur parent category-location page
        if (path.startsWith('/courses/')) {
          const parts = path.split('/').filter(Boolean);
          if (parts.length >= 4) {
            // Redirect to /courses/topic/location/
            const redirectPath = `/${parts[0]}/${parts[1]}/${parts[2]}/`;
            console.log('⚠️ Course not found, redirecting to:', redirectPath);
            window.history.replaceState({ view: 'category-location' }, '', redirectPath);
            setSelectedCourse(null);
            setView('category-location');
            return;
          }
        }

        // Fallback: Kurs nicht gefunden und keine category -> zur Suche
        console.log('⚠️ Course not found, fallback to search');
        setSelectedCourse(null);
        setView('search');
        window.history.replaceState({ view: 'search' }, '', '/search');
        return;
      }

      // 3) Nicht-Detail: Kurs zurücksetzen und View normal setzen
      console.log('✅ Non-detail view, clearing selectedCourse');
      if (nextView !== 'detail') setSelectedCourse(null);
      console.log('✅ Setting view to:', nextView);
      setView(nextView);

      // 4) Parse URL query parameters for search filters
      const query = new URLSearchParams(window.location.search);
      const typeParam = query.get('type');
      const areaParam = query.get('area');
      const specParam = query.get('spec');
      const focusParam = query.get('focus');
      const qParam = query.get('q');
      const locParam = query.get('loc');
      const levelParam = query.get('level');

      // Reset filters first when navigating to search, then apply URL params
      if (nextView === 'search') {
        // Only reset if no params are provided (clean /search navigation)
        if (!typeParam && !areaParam && !specParam && !focusParam && !qParam && !locParam && !levelParam) {
          setSearchType("");
          setSearchArea("");
          setSearchSpecialty("");
          setSearchFocus("");
        } else {
          // Apply URL params
          if (typeParam) setSearchType(typeParam);
          else setSearchType("");
          if (areaParam) setSearchArea(areaParam);
          else setSearchArea("");
          if (specParam) setSearchSpecialty(specParam);
          else setSearchSpecialty("");
          if (focusParam) setSearchFocus(focusParam);
          else setSearchFocus("");
          if (qParam) setSearchQuery(qParam);
          if (locParam) setSelectedLocations([locParam]);
          if (levelParam) setFilterLevel(levelParam);
        }
      }
    };

    // --- History patch: auch pushState/replaceState sollen Routing triggern ---
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      console.log('🚀 pushState called with:', args[2]); // Log the URL
      const ret = originalPushState.apply(this, args);
      console.log('📢 Dispatching locationchange event');
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };

    window.history.replaceState = function (...args) {
      console.log('🔄 replaceState called with:', args[2]); // Log the URL
      const ret = originalReplaceState.apply(this, args);
      console.log('📢 Dispatching locationchange event');
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };

    const handlePopState = () => {
      console.log('⬅️ popstate event (back/forward button)');
      window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('locationchange', () => {
      console.log('🎯 locationchange event received');
      syncFromUrl();
    });

    // Initial einmal synchronisieren
    console.log('🏁 Initial sync on mount');
    syncFromUrl();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('locationchange', syncFromUrl);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: Log state changes
  useEffect(() => {
    console.log('🎨 STATE CHANGED - view:', view, '| selectedCourse:', selectedCourse ? `ID ${selectedCourse.id}` : 'null');
  }, [view, selectedCourse]);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (session) => {
      if (cancelled) return;

      setSession(session);

      if (session?.user) {
        const role = session.user.user_metadata?.role || 'student';
        const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];

        // Basis-User setzen
        setUser({
          id: session.user.id,
          email: session.user.email,
          role: role,
          name: name
        });

        // Daten laden
        fetchBookings(session.user.id);
        fetchSavedCourses(session.user.id);
        syncPendingSavedCourse(session.user.id);
        if (role === 'teacher') fetchTeacherEarnings(session.user.id);

        // Profil-Extras laden (preferred_language, is_professional, plan_tier, role, full_name)
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language, is_professional, plan_tier, role, full_name')
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;

        if (data) {
          if (data.preferred_language) setLang(data.preferred_language);

          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  role: data.role || prev.role, // Update role from profiles table
                  is_professional: data.is_professional,
                  plan_tier: data.plan_tier || 'basic',
                  name: data.full_name || prev.name // Use profile name if available
                }
              : prev
          );
        }
      } else {
        // Logout / kein User
        setUser(null);
        setMyBookings([]);
        setSavedCourses([]);
        setSavedCourseIds([]);
        setTeacherEarnings([]);

        if (['/dashboard', '/create-course'].includes(window.location.pathname)) setView('home');
        setLang('de');
      }
    };

    // Initiale Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    // Änderungen an Auth-Status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (catMenuRef.current && !catMenuRef.current.contains(event.target)) setCatMenuOpen(false);
      if (locMenuRef.current && !locMenuRef.current.contains(event.target)) setLocMenuOpen(false);
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) setLangMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

useEffect(() => {
  const query = new URLSearchParams(window.location.search);

  // SEO Deep Linking: Allow complex filters /search?q=Yoga&loc=Zurich&type=kinder...
  const qParam = query.get('q');
  const locParam = query.get('loc');
  const typeParam = query.get('type');
  const areaParam = query.get('area');
  const specParam = query.get('spec');
  const focusParam = query.get('focus');
  const levelParam = query.get('level');

  if (qParam || locParam || typeParam || areaParam || specParam || focusParam || levelParam) {
    if (qParam) setSearchQuery(qParam);
    if (locParam) setSelectedLocations([locParam]);
    if (typeParam) setSearchType(typeParam);
    if (areaParam) setSearchArea(areaParam);
    if (specParam) setSearchSpecialty(specParam);
    if (focusParam) setSearchFocus(focusParam);
    if (levelParam) setFilterLevel(levelParam);

    // Only switch view if not already on a specific detail/landing page
    setView(prev => (prev !== 'detail' ? 'search' : prev));
  }

  const sessionId = query.get('session_id');
  if (sessionId && user) {
    const pendingCourseId = localStorage.getItem('pendingCourseId');

    if (pendingCourseId) {
      const saveBooking = async () => {
        const pendingEventId = localStorage.getItem('pendingEventId');

        // ✅ WICHTIG: localStorage liefert Strings -> wir casten sicher auf Number
        const courseId = Number(pendingCourseId);
        const eventId = pendingEventId ? Number(pendingEventId) : null;

        // Wenn courseId nicht sauber ist, aufräumen damit es nicht “hängen bleibt”
        if (!Number.isFinite(courseId) || courseId <= 0) {
          localStorage.removeItem('pendingCourseId');
          localStorage.removeItem('pendingEventId');
          showNotification("Fehler: Ungültige Kurs-ID (pendingCourseId).");
          return;
        }

        const payload = {
          user_id: user.id,
          course_id: courseId,
          is_paid: false,
          status: 'confirmed'
        };

        if (eventId) payload.event_id = eventId;

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
    } else {
      setView('dashboard');
    }
  }
}, [user]);


  // --- RENDER ---
    return (
    <ErrorBoundary>
      <div className="min-h-screen bg-beige font-sans text-dark selection:bg-orange-100 selection:text-primary flex flex-col font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@300;400;500;600&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');`}</style>
      {notification && (<div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-dark text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce font-heading"><CheckCircle className="w-5 h-5 mr-2 text-primary" />{notification}</div>)}
      <Navbar t={t} user={user} lang={lang} setLang={changeLanguage} setView={setView} handleLogout={handleLogout} setShowResults={() => setView('search')} setSelectedCatPath={setSelectedCatPath} />

      <div className="flex-grow">
            
      {/* GLOBAL LOADING STATE - Prevents White Screen / Redirects */}
      {loading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-500 font-sans animate-pulse">Lade Kurse...</p>
          </div>
      )}

      {!loading && view === 'home' && (
              <Home lang={lang} t={t} courses={courses} setView={setView} setSearchType={setSearchType} setSearchArea={setSearchArea} setSearchSpecialty={setSearchSpecialty} setSearchFocus={setSearchFocus} setSelectedCatPath={setSelectedCatPath} searchQuery={searchQuery} setSearchQuery={setSearchQuery} catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} catMenuRef={catMenuRef} locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} getCatLabel={getCatLabel} filterPro={filterPro} setFilterPro={setFilterPro} filterDirectBooking={filterDirectBooking} setFilterDirectBooking={setFilterDirectBooking} />
        )}
        
      {view === 'landing-private' && ( <LandingView title={t.landing_priv_title} subtitle={t.landing_priv_sub} variant="private" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-prof' && ( <LandingView title={t.landing_prof_title} subtitle={t.landing_prof_sub} variant="prof" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
      {view === 'landing-kids' && ( <LandingView title={t.landing_kids_title} subtitle={t.landing_kids_sub} variant="kids" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}

      {view === 'search' && (
          <SearchPageView courses={courses} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchType={searchType} setSearchType={setSearchType} searchArea={searchArea} setSearchArea={setSearchArea} searchSpecialty={searchSpecialty} setSearchSpecialty={setSearchSpecialty} searchFocus={searchFocus} setSearchFocus={setSearchFocus} locMode={locMode} setLocMode={setLocMode} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} loading={loading} filteredCourses={filteredCourses} setSelectedCourse={setSelectedCourse} setView={setView} t={t} getCatLabel={getCatLabel} filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom} filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo} filterPriceMax={filterPriceMax} setFilterPriceMax={setFilterPriceMax} filterLevel={filterLevel} setFilterLevel={setFilterLevel} filterPro={filterPro} setFilterPro={setFilterPro} filterDirectBooking={filterDirectBooking} setFilterDirectBooking={setFilterDirectBooking} selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} langMenuOpen={langMenuOpen} setLangMenuOpen={setLangMenuOpen} langMenuRef={langMenuRef} savedCourseIds={savedCourseIds} onToggleSaveCourse={toggleSaveCourse} />
      )}

            {view === 'category-location' && (
        <ErrorBoundary>
          <CategoryLocationPage
              topicSlug={currentLocParams.topicSlug}
              locationSlug={currentLocParams.locationSlug}
              courses={courses}
              setSelectedCourse={setSelectedCourse}
              setView={setView}
              savedCourseIds={savedCourseIds}
              onToggleSaveCourse={toggleSaveCourse}
              t={t}
              getCatLabel={getCatLabel}
          />
        </ErrorBoundary>
      )}


            {view === 'success' && <SuccessView setView={setView} />}

      {!loading && view === 'detail' && selectedCourse && (
        <DetailView
          course={selectedCourse}
          courses={courses}
          setView={setView}
          t={t}
          setSelectedTeacher={setSelectedTeacher}
          user={user}
          savedCourseIds={savedCourseIds}
          onToggleSaveCourse={toggleSaveCourse}
          showNotification={showNotification}
        />
      )}

      {!loading && view === 'detail' && !selectedCourse && (
        <div className="px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold mb-3">Dieser Kurs ist nicht verfügbar.</h1>
          <p className="text-gray-600 mb-6">Bitte gehe zurück zur Suche und wähle einen anderen Kurs.</p>
          <button
            className="bg-primary text-white px-5 py-3 rounded-full hover:opacity-90"
            onClick={() => {
              window.history.pushState({}, '', '/search');
              setView('search');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Zur Suche
          </button>
        </div>
      )}

      {view === 'teacher-hub' && <TeacherHub setView={setView} t={t} user={user} />}
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

      {view === 'admin' && <AdminPanel t={t} courses={courses} showNotification={showNotification} fetchCourses={fetchCourses} setView={setView} />}
      {view === 'admin-blog' && <AdminBlogManager showNotification={showNotification} setView={setView} courses={courses} />}
      {view === 'blog' && <BlogList articles={articles} setView={setView} setSelectedArticle={setSelectedArticle} />}
      {view === 'blog-detail' && <BlogDetail article={selectedArticle} setView={setView} courses={courses} />}
      {view === 'dashboard' && user && <Dashboard user={user} setUser={setUser} t={t} setView={setView} courses={courses} teacherEarnings={teacherEarnings} myBookings={myBookings} savedCourses={savedCourses} savedCourseIds={savedCourseIds} onToggleSaveCourse={toggleSaveCourse} handleDeleteCourse={handleDeleteCourse} handleEditCourse={handleEditCourse} showNotification={showNotification} changeLanguage={changeLanguage} setSelectedCourse={setSelectedCourse} />}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm t={t} setView={setView} user={user} fetchCourses={fetchCourses} showNotification={showNotification} setEditingCourse={setEditingCourse} initialData={editingCourse} />}
      </div>
      
      <Footer t={t} setView={setView} />
      </div>
    </ErrorBoundary>
  );
}
