import React, { useState, useEffect, useLayoutEffect, useRef, Suspense, useCallback } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

// Build: 2026-02-22 - Use DB taxonomy instead of constants
// --- IMPORTS ---
import { CATEGORY_LABELS, TRANSLATIONS, CATEGORY_TYPES } from './lib/constants';
import { supabase } from './lib/supabase';
import { isImageUsedByOtherCourses, deleteImageFromStorage } from './lib/imageUtils';
import { BASE_URL, slugify as siteSlugify, buildCoursePath as siteBuildCoursePath } from './lib/siteConfig';
import { useTaxonomy } from './hooks/useTaxonomy';

const CHUNK_RELOAD_KEY = 'chunk_reload';
const CHUNK_RELOAD_COOLDOWN_MS = 10000;

function isChunkLoadError(error) {
  const message = (error?.message || '').toLowerCase();
  const name = (error?.name || '').toLowerCase();
  return (
    name.includes('chunkloaderror') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('loading chunk')
  );
}

function triggerChunkReload() {
  const lastReload = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > CHUNK_RELOAD_COOLDOWN_MS) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  }
  return false;
}

// Eagerly loaded components (always needed)
import { Navbar, Footer } from './components/Layout';
import { Home } from './components/Home';

// Lazy-loaded page components (code-splitting)
// After a deploy, old chunk hashes no longer exist. The server returns index.html
// (text/html) instead of the JS file, which causes a dynamic import failure.
// This helper catches that and reloads the page once to fetch updated chunks.
function lazyWithRetry(importFn) {
  return React.lazy(async () => {
    try {
      return await importFn();
    } catch (firstError) {
      if (!isChunkLoadError(firstError)) throw firstError;
      try {
        // One quick retry for transient network/cache race conditions.
        return await importFn();
      } catch (retryError) {
        if (!isChunkLoadError(retryError)) throw retryError;
        const didReload = triggerChunkReload();
        if (didReload) {
          // Keep Suspense fallback visible while reload starts; avoid crash flash.
          return await new Promise(() => {});
        }
        throw retryError;
      }
    }
  });
}

const SearchPageView = lazyWithRetry(() => import('./components/SearchPageView'));
const LegalPage = lazyWithRetry(() => import('./components/LegalPage'));
const LandingView = lazyWithRetry(() => import('./components/LandingView'));
const DetailView = lazyWithRetry(() => import('./components/DetailView'));
const TeacherHub = lazyWithRetry(() => import('./components/TeacherHub'));
const TeacherProfileView = lazyWithRetry(() => import('./components/TeacherProfileView'));
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'));
const TeacherForm = lazyWithRetry(() => import('./components/TeacherForm'));
const AdminPanel = lazyWithRetry(() => import('./components/AdminPanel'));
const AuthView = lazyWithRetry(() => import('./components/AuthView'));
const ContactPage = lazyWithRetry(() => import('./components/ContactPage'));
const AboutPage = lazyWithRetry(() => import('./components/AboutPage'));
const HowItWorksPage = lazyWithRetry(() => import('./components/HowItWorksPage'));
const SuccessView = lazyWithRetry(() => import('./components/SuccessView'));
const BlogList = lazyWithRetry(() => import('./components/BlogList'));
const BlogDetail = lazyWithRetry(() => import('./components/BlogDetail'));
const AdminBlogManager = lazyWithRetry(() => import('./components/AdminBlogManager'));
const CategoryLocationPage = lazyWithRetry(() => import('./components/CategoryLocationPage'));
const ProviderDirectory = lazyWithRetry(() => import('./components/ProviderDirectory'));
const ProviderProfilePage = lazyWithRetry(() => import('./components/ProviderProfilePage'));
const RatgeberClusterView = lazyWithRetry(() => import('./components/RatgeberClusterView'));
const RatgeberArtikelView = lazyWithRetry(() => import('./components/RatgeberArtikelView'));
const RatgeberHubView = lazyWithRetry(() => import('./components/RatgeberHubView'));
const BereichLandingPage = lazyWithRetry(() => import('./components/BereichLandingPage'));
const SzenarioArtikelView = lazyWithRetry(() => import('./components/SzenarioArtikelView'));
const NotFoundPage = lazyWithRetry(() => import('./components/NotFoundPage'));

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
    console.error("💥 APP CRASH:", error);
    console.error("📌 COMPONENT STACK:", errorInfo);

    // Auto-reload on chunk load failures (stale deploy)
    if (isChunkLoadError(error)) {
      if (triggerChunkReload()) return;
    }

    // Report to Sentry
    import('@sentry/react').then(Sentry => {
      Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo?.componentStack } } });
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      if (isChunkLoadError(this.state.error)) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          </div>
        );
      }
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

      // PROVIDER DIRECTORY & PROFILE ROUTING
      if (path === '/anbieter') return 'provider-directory';
      if (path.startsWith('/anbieter/')) return 'provider-profile';

      // BEREICH LANDING PAGE ROUTING
      if (path.startsWith('/bereich/')) {
          const parts = path.split('/').filter(Boolean);
          if (parts.length >= 4) return 'bereich-szenario';
          if (parts.length >= 3) return 'bereich-landing';
          // /bereich/beruflich/ → segment overview (future phase)
          if (parts.length === 2) return 'search';
      }

      // RATGEBER ROUTING
      if (path === '/ratgeber' || path.startsWith('/ratgeber/')) {
          const parts = path.split('/').filter(Boolean);
          if (parts.length >= 4) return 'ratgeber-artikel';
          if (parts.length === 3) return 'ratgeber-cluster';
          return 'ratgeber-hub';
      }

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

      // Only root path goes to home; everything else is 404
      if (path === '/' || path === '') return 'home';
      return 'not-found';
  };

  const [lang, setLang] = useState('de');
  const [view, setView] = useState(getInitialView);
  const [routePath, setRoutePath] = useState(() => `${window.location.pathname}${window.location.search}`);
  const [user, setUser] = useState(null);
  const [, setSession] = useState(null);

  // Admin Impersonation State
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const effectiveUser = impersonatedUser || user;

  // App Data State
  const [courses, setCourses] = useState([]);
    const coursesRef = useRef([]);
    const coursesLoadedRef = useRef(false);
    const scrollRestoreRef = useRef(null);

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
   const [fetchError, setFetchError] = useState(false);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [notification, setNotification] = useState(null); // { msg, type }
  const [notificationType, setNotificationType] = useState('success');

  // Load taxonomy from DB for label lookups
  const { areas: dbAreas } = useTaxonomy();

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

  // Bereich Landing Page params (read live from URL)
  let bereichParams = { segment: '', slug: '', szenarioSlug: '' };
  if (window.location.pathname.startsWith('/bereich/')) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 4) {
      bereichParams = { segment: parts[1], slug: parts[2], szenarioSlug: parts[3] };
    } else if (parts.length >= 3) {
      bereichParams = { segment: parts[1], slug: parts[2], szenarioSlug: '' };
    }
  }

  // Filter States
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef(null);
  const [selectedDeliveryTypes, setSelectedDeliveryTypes] = useState([]);
  const [deliveryMenuOpen, setDeliveryMenuOpen] = useState(false);
  const deliveryMenuRef = useRef(null);
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
  const [selectedSaule, setSelectedSaule] = useState("");

  const catMenuRef = useRef(null);
  const locMenuRef = useRef(null);
  // Guard: prevent syncFromUrl from re-applying state during programmatic URL updates
  const isUrlSyncingRef = useRef(false);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['de'];

  // --- SEO HELPERS (v3.1) - Now imported from siteConfig ---
  // BASE_URL, siteSlugify, siteBuildCoursePath imported at top
  // Local aliases for backwards compatibility within this file
  const slugify = siteSlugify;
  const buildCoursePath = siteBuildCoursePath;


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

  // --- Scroll restoration on view change (back/forward) or scroll-to-top ---
  useLayoutEffect(() => {
    if (scrollRestoreRef.current != null) {
      const y = scrollRestoreRef.current;
      scrollRestoreRef.current = null;
      window.scrollTo(0, y);
    } else {
      window.scrollTo(0, 0);
    }
  }, [view]);

    const getCatLabel = (key) => {
      if (!key) return '';

      // 1. Priorität: Legacy Labels (Flache Liste) prüfen
      const legacyTranslation = (CATEGORY_LABELS || {})[key];
      if (legacyTranslation && legacyTranslation[lang]) return legacyTranslation[lang];

      // 2. Priorität: Kategorie-Typen prüfen (z.B. "beruflich")
      if (CATEGORY_TYPES && CATEGORY_TYPES[key]) {
          return CATEGORY_TYPES[key][lang] || CATEGORY_TYPES[key]['de'];
      }

      // 3. Priorität: DB-Taxonomie durchsuchen
      if (dbAreas && dbAreas.length > 0) {
          // Exakter Match
          let area = dbAreas.find(a => a.slug === key);
          // Partieller Match (z.B. it_digital -> it_digitales)
          if (!area) {
              area = dbAreas.find(a => a.slug.startsWith(key) || key.startsWith(a.slug));
          }
          if (area) {
              return area[`label_${lang}`] || area.label_de || key;
          }
      }

      // Fallback: Einfach den Key anzeigen (besser als nichts)
      return key;
    };

  const showNotification = (msg, type = 'success') => { setNotification(msg); setNotificationType(type); setTimeout(() => setNotification(null), 5000); };

  const handleLogout = async () => { await supabase.auth.signOut(); showNotification("Logged out successfully"); setView('home'); };

  const runAdminAction = useCallback(async (payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Nicht eingeloggt');
    }

    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Admin-Aktion fehlgeschlagen');
    }

    return data;
  }, []);

  const loadImpersonatedData = useCallback(async (targetUserId) => {
    if (!targetUserId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const params = new URLSearchParams({
        action: 'user-data',
        userId: targetUserId
      });
      const res = await fetch(`/api/admin?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setMyBookings(json.bookings || []);
        setSavedCourses(json.savedCourses || []);
        setSavedCourseIds((json.savedCourses || []).map(c => c.id));
        setTeacherEarnings(json.earnings || []);
      }
    } catch (e) {
      console.warn('Failed to load impersonated user data:', e);
    }
  }, []);

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;

    // Hole Kurs-Daten vor dem Löschen um die image_url zu bekommen
    const courseToDelete = courses.find(c => c.id === courseId);
    const imageUrl = courseToDelete?.image_url;
    const previousCourses = courses;

    setCourses(prev => prev.filter(c => c.id !== courseId));

    try {
      if (impersonatedUser?.id) {
        await runAdminAction({
          action: 'delete-course',
          userId: impersonatedUser.id,
          courseId
        });
      } else {
        const { error } = await supabase.from('courses').delete().eq('id', courseId);
        if (error) throw error;
      }
    } catch (error) {
      setCourses(previousCourses);
      showNotification("Error deleting: " + error.message);
      return;
    }

    // Prüfe ob das Bild noch von anderen Kursen verwendet wird
    // Bei Impersonation überspringen — Admin-API macht das serverseitig
    if (imageUrl && !impersonatedUser?.id) {
      const isUsed = await isImageUsedByOtherCourses(imageUrl, courseId);
      if (!isUsed) {
        // Bild wird nicht mehr verwendet - aus Storage löschen
        await deleteImageFromStorage(imageUrl);
      }
    }

    showNotification("Course deleted.");
  };

  const handleUpdateCourseStatus = async (courseId, newStatus) => {
    const previousCourses = courses;
    // Update local state immediately for responsive UI
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, status: newStatus } : c));

    try {
      let error;
      if (impersonatedUser?.id) {
        await runAdminAction({
          action: 'set-course-status',
          userId: impersonatedUser.id,
          courseId,
          newStatus
        });
      } else {
        ({ error } = await supabase.from('courses').update({ status: newStatus }).eq('id', courseId));
      }
      if (error) {
        throw error;
      }
      const statusLabels = { draft: 'Entwurf', published: 'Veröffentlicht' };
      showNotification(`Kurs-Status: ${statusLabels[newStatus] || newStatus}`);
    } catch (error) {
      showNotification("Fehler: " + error.message);
      setCourses(previousCourses);
    }
  };

  const handleCancelEvent = async (eventId, reason) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Nicht eingeloggt');

      const response = await fetch('/api/cancel-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ eventId, reason, impersonatedUserId: impersonatedUser?.id || null })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Absagen');
      showNotification(`Termin abgesagt. ${data.refundedBookings || 0} Buchung(en) erstattet.`);
      // Refresh courses to update cancelled_at in course_events
      await fetchCourses();
      // Refresh bookings if student view is also affected
      if (impersonatedUser?.id) {
        await loadImpersonatedData(impersonatedUser.id);
      } else if (user?.id) {
        await fetchBookings(user.id);
      }
    } catch (err) {
      showNotification('Fehler: ' + err.message);
    }
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
            setFetchError(false);

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
          .from('v_course_full_categories')
          .select('*')
          .in('course_id', courseIds);

        if (!categoriesError && categoriesData) {
          categoriesMap = categoriesData.reduce((acc, cat) => {
            if (!acc[cat.course_id]) {
              acc[cat.course_id] = [];
            }
            acc[cat.course_id].push({
              course_id: cat.course_id,
              category_type: cat.level1_slug,
              category_type_label: cat.level1_label_de,
              category_area: cat.level2_slug,
              category_area_label: cat.level2_label_de,
              category_specialty: cat.level3_slug,
              category_specialty_label: cat.level3_label_de,
              category_focus: cat.level4_slug || null,
              category_focus_label: cat.level4_label_de || null,
              type_id: cat.level1_id,
              area_id: cat.level2_id,
              specialty_id: cat.level3_id,
              focus_id: cat.level4_id,
              is_primary: cat.is_primary
            });
            return acc;
          }, {});
        }
      }

      const migratedData = (courseData || []).map(c => {
        const normalized = normalizeCourse(c);
        const prof = profileMap[c.user_id];
        const courseCategories = categoriesMap[c.id] || [];

        // Build category_paths for TeacherForm compatibility
        // NOTE: type uses SLUG, area uses NUMERIC ID (because getAreasLocal returns _areaIds),
        // specialty and focus use LABELS (because dropdowns display labels)
        // Build: 2026-02-21-v3 - Added debug logging
        const categoryPaths = courseCategories.map(cat => {
          return {
            type: cat.category_type,           // slug (e.g., "professionell")
            area: cat.area_id,                 // numeric ID (e.g., 22) - getAreasLocal returns IDs
            specialty: cat.category_specialty_label || cat.category_specialty || '', // label (e.g., "Hauswirtschaft")
            focus: cat.category_focus_label || cat.category_focus || '',             // label (e.g., "Bäuerliche Hauswirtschaft")
            is_primary: cat.is_primary
          };
        });

        return {
          ...normalized,
          instructor_bio: prof?.bio_text,
          instructor_certificates: prof?.certificates,
          additional_locations: prof?.additional_locations,
          instructor_verified: prof?.verification_status === 'verified',
          all_categories: courseCategories, // Add all categories including Zweitkategorien
          category_paths: categoryPaths, // Add category_paths for TeacherForm
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
    } catch (error) { console.error('Error:', error.message); showNotification("Error loading courses"); setFetchError(true); } finally { setLoading(false); }
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('bookings')
      .select('*, courses(*), course_events(*)')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'refunded'])
      .or(`status.eq.confirmed,refunded_at.gt.${thirtyDaysAgo}`);
    // Merge booking data with course data so Dashboard can show booking-specific info
    setMyBookings(data ? data.map(booking => ({
      ...booking.courses,
      booking_id: booking.id,
      booking_type: booking.booking_type,
      booking_status: booking.status,
      paid_at: booking.paid_at,
      delivered_at: booking.delivered_at,
      auto_refund_until: booking.auto_refund_until,
      is_paid: booking.is_paid,
      disputed_at: booking.disputed_at,
      refunded_at: booking.refunded_at,
      goodwill_status: booking.goodwill_status,
      goodwill_requested_at: booking.goodwill_requested_at,
      goodwill_request_message: booking.goodwill_request_message,
      goodwill_decided_at: booking.goodwill_decided_at,
      goodwill_decision_message: booking.goodwill_decision_message,
      goodwill_refund_percent: booking.goodwill_refund_percent,
      goodwill_refund_amount_cents: booking.goodwill_refund_amount_cents,
      payout_eligible_at: booking.payout_eligible_at,
      event_id: booking.event_id,
      event: booking.course_events
    })).filter(Boolean) : []);
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
              const price = course?.price || 0;
              const refundedAmount = booking.goodwill_status === 'approved'
                ? ((booking.goodwill_refund_amount_cents || 0) / 100)
                : 0;
              const retainedRevenue = booking.refunded_at && !(booking.goodwill_status === 'approved' && booking.goodwill_refund_percent > 0 && booking.goodwill_refund_percent < 100)
                ? 0
                : Math.max(price - refundedAmount, 0);
              return {
                  id: booking.id,
                  courseTitle: course?.title || 'Unknown',
                  studentName: booking.profiles?.full_name || 'Guest Student',
                  price,
                  payout: retainedRevenue * 0.85,
                  isPaidOut: booking.is_paid,
                  date: new Date(booking.created_at).toLocaleDateString(),
                  bookingType: booking.booking_type,
                  deliveredAt: booking.delivered_at,
                  paidAt: booking.paid_at,
                  disputedAt: booking.disputed_at,
                  refundedAt: booking.refunded_at,
                  goodwillStatus: booking.goodwill_status,
                  goodwillRequestedAt: booking.goodwill_requested_at,
                  goodwillRequestMessage: booking.goodwill_request_message,
                  goodwillDecidedAt: booking.goodwill_decided_at,
                  goodwillDecisionMessage: booking.goodwill_decision_message,
                  goodwillRefundPercent: booking.goodwill_refund_percent,
                  goodwillRefundAmountCents: booking.goodwill_refund_amount_cents
              };
          }));
      }
  };

  // Filter Logic – split into two stages:
  // 1) Pre-category: text search, location, date, price, level, language, etc.
  // 2) Category: type, area, specialty, focus
  // Stage 1 is passed to SearchPageView for computing available category options.

  const URL_TO_DB_TYPE_FILTER = {
    'beruflich': 'professionell',
    'privat_hobby': 'privat',
    'kinder_jugend': 'kinder',
    'professionell': 'professionell',
    'privat': 'privat',
    'kinder': 'kinder'
  };

  // Stage 1: All filters EXCEPT category (type/area/specialty/focus)
  const filteredCoursesPreCategory = courses.filter(course => {
    if (!course) return false;

    // Status filter: Only show published courses OR user's own courses
    const isOwner = user?.id && String(course.user_id) === String(user.id);
    const isPublished = course.status === 'published' || !course.status;
    if (!isPublished && !isOwner) return false;

    let matchesLocation = true;
    if (selectedLocations.length > 0) {
        const courseLocations = [];
        if (course.canton) courseLocations.push(course.canton);
        if (Array.isArray(course.course_events)) {
            course.course_events.forEach(ev => {
                if (ev.canton) courseLocations.push(ev.canton);
            });
        }
        if (course.address) {
            course.address.split(',').forEach(part => {
                const trimmed = part.trim();
                if (trimmed) courseLocations.push(trimmed);
            });
        }
        if (course.additional_locations) {
            try {
                const locs = typeof course.additional_locations === 'string'
                    ? JSON.parse(course.additional_locations)
                    : course.additional_locations;
                if (Array.isArray(locs)) {
                    locs.forEach(loc => {
                        if (loc.canton) courseLocations.push(loc.canton);
                    });
                }
            } catch (e) { /* ignore parse errors */ }
        }
        const isOnlineCourse = courseLocations.includes('Online');
        matchesLocation = isOnlineCourse || selectedLocations.some(selLoc => courseLocations.includes(selLoc));
    }

    // Boolean search with AND/OR operators
    const rawQuery = (searchQuery || "").trim();
    const safeTitle = (course.title || "").toString().toLowerCase();
    const safeInstructor = (course.instructor_name || "").toString().toLowerCase();
    const safeKeywords = Array.isArray(course.keywords)
        ? course.keywords.join(" ").toLowerCase()
        : (course.keywords || "").toString().toLowerCase();
    const safeCanton = (course.canton || "").toString().toLowerCase();
    const safeAddress = (course.address || "").toString().toLowerCase();
    const eventLocations = Array.isArray(course.course_events)
        ? course.course_events.map(ev => `${ev.canton || ""} ${ev.location || ""}`).join(" ").toLowerCase()
        : "";
    const safeSpecialty = (course.category_specialty || "").toString().toLowerCase();
    const safeFocus = (course.category_focus || "").toString().toLowerCase();
    const searchableText = `${safeTitle} ${safeInstructor} ${safeKeywords} ${safeCanton} ${safeAddress} ${eventLocations} ${safeSpecialty} ${safeFocus}`;

    let matchesSearch = true;
    if (rawQuery) {
        const orClauses = rawQuery.split(/\s+OR\s+/i);
        matchesSearch = orClauses.some(orClause => {
            const andTerms = orClause.split(/\s+AND\s+/i)
                .flatMap(part => part.trim().split(/\s+/))
                .filter(term => term.length > 0);
            return andTerms.every(term => searchableText.includes(term.toLowerCase()));
        });
    }

    let matchesDate = true;
    if (filterDateFrom || filterDateTo) {
        const fromTime = filterDateFrom ? new Date(filterDateFrom).getTime() : 0;
        const toTime = filterDateTo ? new Date(filterDateTo).getTime() : Infinity;
        const courseDates = [];
        if (course.start_date) courseDates.push(new Date(course.start_date).getTime());
        if (Array.isArray(course.course_events)) {
            course.course_events.forEach(ev => {
                if (ev.start_date) courseDates.push(new Date(ev.start_date).getTime());
            });
        }
        if (courseDates.length === 0) {
            matchesDate = true;
        } else {
            matchesDate = courseDates.some(d => d >= fromTime && d <= toTime);
        }
    }

    // "Preis auf Anfrage" (price=null/0) → als 0 behandelt, passiert immer den Max-Filter
    let matchesPrice = true; if (filterPriceMax) matchesPrice = (course.price || 0) <= Number(filterPriceMax);
    let matchesLevel = true; if (filterLevel !== 'All') matchesLevel = course.level === filterLevel;
    let matchesPro = true; if (filterPro) matchesPro = course.is_pro === true;
    let matchesLanguage = true;
    if (selectedLanguages.length > 0) {
        const courseLanguages = course.languages || (course.language ? [course.language] : []);
        matchesLanguage = selectedLanguages.some(filterLang => courseLanguages.includes(filterLang));
    }
    let matchesDirectBooking = true; if (filterDirectBooking) matchesDirectBooking = course.booking_type === 'platform' || course.booking_type === 'platform_flex';
    let matchesDeliveryType = true;
    if (selectedDeliveryTypes.length > 0) {
        const courseDeliveryTypes = course.delivery_types || (course.delivery_type ? [course.delivery_type] : ['presence']);
        matchesDeliveryType = selectedDeliveryTypes.some(filterType => courseDeliveryTypes.includes(filterType));
    }

    return matchesLocation && matchesSearch && matchesDate && matchesPrice && matchesLevel && matchesPro && matchesLanguage && matchesDirectBooking && matchesDeliveryType;
  });

  // Stage 2: Apply category filters on top of pre-category results
  const dbSearchType = searchType ? (URL_TO_DB_TYPE_FILTER[searchType] || searchType) : '';

  const filteredCourses = filteredCoursesPreCategory.filter(course => {
    let matchesType = true;
    if (dbSearchType) {
      matchesType = course.category_type === dbSearchType ||
        (Array.isArray(course.all_categories) &&
         course.all_categories.some(cat => cat && cat.category_type === dbSearchType));
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
         course.all_categories.some(cat => cat && (
           cat.category_specialty === searchSpecialty ||
           cat.category_specialty_label === searchSpecialty
         )));
    }

    let matchesFocus = true;
    if (searchFocus) {
      matchesFocus = course.category_focus === searchFocus ||
        (Array.isArray(course.all_categories) &&
         course.all_categories.some(cat => cat && (
           cat.category_focus === searchFocus ||
           cat.category_focus_label === searchFocus
         )));
    }

    let matchesCategory = true;
    if (!searchType && !searchArea && Array.isArray(selectedCatPath) && selectedCatPath.length > 0) {
        const courseCatStr = (course.category || "").toString().toLowerCase();
        matchesCategory = selectedCatPath.every(part => part && courseCatStr.includes(part.toString().toLowerCase()));
    }

    let matchesSaule = true;
    if (selectedSaule) {
        matchesSaule = Array.isArray(course.beruf_saeulen) && course.beruf_saeulen.includes(selectedSaule);
    }

    return matchesType && matchesArea && matchesSpecialty && matchesFocus && matchesCategory && matchesSaule;
  });
  
// --- EFFECT HOOKS ---
    useEffect(() => {
    window.history.scrollRestoration = 'manual';
    fetchCourses();
    fetchArticles();

    // Hält view + selectedCourse immer synchron zur URL (auch bei pushState/replaceState)
    const syncFromUrl = () => {
      // Skip if triggered by our own URL-sync useEffect (not user navigation)
      if (isUrlSyncingRef.current) return;
      setRoutePath(`${window.location.pathname}${window.location.search}`);
      const nextView = getInitialView();
      const path = window.location.pathname;

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

      // 2) Wenn Detail: passenden Kurs aus bereits geladenen courses suchen
      if (urlId) {
        const found = (coursesRef.current || []).find(c => c && c.id == urlId);
        if (found) {
          setSelectedCourse(found);
          setView('detail');
          return;
        }

        // Kurs nicht gefunden - aber nur redirect wenn Kurse bereits geladen wurden
        // (sonst Race Condition bei Ctrl+Click / neuem Tab)
        if (!coursesLoadedRef.current) {
          setView('detail'); // Temporär detail setzen, wird nach Laden korrigiert
          return;
        }

        // Kurs nicht gefunden -> 301 Redirect zur parent category-location page
        if (path.startsWith('/courses/')) {
          const parts = path.split('/').filter(Boolean);
          if (parts.length >= 4) {
            // Redirect to /courses/topic/location/
            const redirectPath = `/${parts[0]}/${parts[1]}/${parts[2]}/`;
            window.history.replaceState({ view: 'category-location' }, '', redirectPath);
            setSelectedCourse(null);
            setView('category-location');
            return;
          }
        }

        // Fallback: Kurs nicht gefunden und keine category -> zur Suche
        setSelectedCourse(null);
        setView('search');
        window.history.replaceState({ view: 'search' }, '', '/search');
        return;
      }

      // 3) Nicht-Detail: Kurs zurücksetzen und View normal setzen
      if (nextView !== 'detail') setSelectedCourse(null);
      // When navigating directly to /create-course, ensure editingCourse is null for a fresh form
      if (nextView === 'create') setEditingCourse(null);
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
      const langParam = query.get('lang');
      const deliveryParam = query.get('delivery');
      const fromParam = query.get('from');
      const toParam = query.get('to');
      const priceParam = query.get('price');
      const proParam = query.get('pro');
      const bookingParam = query.get('booking');
      const sauleParam = query.get('saule');

      // Reset filters first when navigating to search, then apply URL params
      if (nextView === 'search') {
        const hasAnyParam = typeParam || areaParam || specParam || focusParam || qParam || locParam || levelParam
          || langParam || deliveryParam || fromParam || toParam || priceParam || proParam || bookingParam || sauleParam;
        // Only reset if no params are provided (clean /search navigation)
        if (!hasAnyParam) {
          setSearchType("");
          setSearchArea("");
          setSearchSpecialty("");
          setSearchFocus("");
          setSearchQuery("");
          setSelectedLocations([]);
          setFilterLevel("All");
          setSelectedLanguages([]);
          setSelectedDeliveryTypes([]);
          setFilterDateFrom("");
          setFilterDateTo("");
          setFilterPriceMax("");
          setFilterPro(false);
          setFilterDirectBooking(false);
          setSelectedSaule("");
        } else {
          // Apply URL params — restore present ones, reset missing ones
          if (typeParam) setSearchType(typeParam); else setSearchType("");
          if (areaParam) setSearchArea(areaParam); else setSearchArea("");
          if (specParam) setSearchSpecialty(specParam); else setSearchSpecialty("");
          if (focusParam) setSearchFocus(focusParam); else setSearchFocus("");
          if (qParam) setSearchQuery(qParam); else setSearchQuery("");
          if (locParam) setSelectedLocations(locParam.split(',')); else setSelectedLocations([]);
          if (levelParam) setFilterLevel(levelParam); else setFilterLevel("All");
          if (langParam) setSelectedLanguages(langParam.split(',')); else setSelectedLanguages([]);
          if (deliveryParam) setSelectedDeliveryTypes(deliveryParam.split(',')); else setSelectedDeliveryTypes([]);
          if (fromParam) setFilterDateFrom(fromParam); else setFilterDateFrom("");
          if (toParam) setFilterDateTo(toParam); else setFilterDateTo("");
          if (priceParam) setFilterPriceMax(priceParam); else setFilterPriceMax("");
          setFilterPro(proParam === '1');
          setFilterDirectBooking(bookingParam === '1');
          if (sauleParam) setSelectedSaule(sauleParam); else setSelectedSaule("");
        }
      }
    };

    // --- History patch: auch pushState/replaceState sollen Routing triggern ---
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      // Save current scroll position in the outgoing history entry
      const currentState = window.history.state || {};
      originalReplaceState.call(window.history, { ...currentState, scrollY: window.scrollY }, '', window.location.href);
      const ret = originalPushState.apply(this, args);
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };

    window.history.replaceState = function (...args) {
      const ret = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };

    const handlePopState = () => {
      const savedY = window.history.state?.scrollY;
      scrollRestoreRef.current = savedY != null ? savedY : null;
      window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('locationchange', syncFromUrl);

    // Initial einmal synchronisieren
    syncFromUrl();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('locationchange', syncFromUrl);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync with current filter state (replaceState, no new history entry)
  // This ensures that browser back navigation restores the correct filters.
  useEffect(() => {
    if (view !== 'search') return;

    const params = new URLSearchParams();
    if (searchType) params.set('type', searchType);
    if (searchArea) params.set('area', searchArea);
    if (searchSpecialty) params.set('spec', searchSpecialty);
    if (searchFocus) params.set('focus', searchFocus);
    if (searchQuery) params.set('q', searchQuery);
    if (selectedLocations.length) params.set('loc', selectedLocations.join(','));
    if (filterLevel && filterLevel !== 'All') params.set('level', filterLevel);
    if (selectedLanguages.length) params.set('lang', selectedLanguages.join(','));
    if (selectedDeliveryTypes.length) params.set('delivery', selectedDeliveryTypes.join(','));
    if (filterDateFrom) params.set('from', filterDateFrom);
    if (filterDateTo) params.set('to', filterDateTo);
    if (filterPriceMax) params.set('price', filterPriceMax);
    if (filterPro) params.set('pro', '1');
    if (filterDirectBooking) params.set('booking', '1');
    if (selectedSaule) params.set('saule', selectedSaule);

    const newUrl = '/search' + (params.toString() ? '?' + params.toString() : '');
    const currentUrl = window.location.pathname + window.location.search;
    if (currentUrl !== newUrl) {
      isUrlSyncingRef.current = true;
      window.history.replaceState({ ...(window.history.state || {}), view: 'search' }, '', newUrl);
      isUrlSyncingRef.current = false;
    }
  }, [view, searchType, searchArea, searchSpecialty, searchFocus, searchQuery,
      selectedLocations, filterLevel, selectedLanguages, selectedDeliveryTypes,
      filterDateFrom, filterDateTo, filterPriceMax, filterPro, filterDirectBooking, selectedSaule]);

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

        // Profil-Extras laden (oder erstellen falls fehlend)
        let { data } = await supabase
          .from('profiles')
          .select('preferred_language, is_professional, package_tier, role, full_name, credit_balance_cents')
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;

        // Safety net: Profil erstellen falls es nicht existiert
        if (!data) {
          const meta = session.user.user_metadata || {};
          const { data: created } = await supabase
            .from('profiles')
            .upsert({
              id: session.user.id,
              full_name: meta.full_name || session.user.email.split('@')[0],
              email: session.user.email,
              role: meta.role || 'student',
              package_tier: meta.package_tier || 'basic',
              preferred_language: 'de'
            }, { onConflict: 'id' })
            .select('preferred_language, is_professional, package_tier, role, full_name, credit_balance_cents')
            .single();
          if (!cancelled) data = created;
        }

        if (data) {
          if (data.preferred_language) setLang(data.preferred_language);

          // Paket normalisieren
          const parseTier = (s) => {
            const v = (s || '').toString().toLowerCase().trim();
            if (!v) return 'basic';
            if (v.includes('enterprise')) return 'enterprise';
            if (v.includes('premium')) return 'premium';
            if (v === 'pro' || v.startsWith('pro')) return 'pro';
            return 'basic';
          };

          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  role: data.role || prev.role,
                  is_professional: data.is_professional,
                  plan_tier: parseTier(data.package_tier),
                  name: data.full_name || prev.name,
                  credit_balance_cents: data.credit_balance_cents || 0
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

  // Load data for impersonated user via Admin API (bypasses RLS)
  useEffect(() => {
    if (!impersonatedUser) return;
    loadImpersonatedData(impersonatedUser.id);
  }, [impersonatedUser?.id, loadImpersonatedData]);

  // Restore own data when stopping impersonation
  useEffect(() => {
    if (!impersonatedUser && user) {
      fetchBookings(user.id);
      fetchSavedCourses(user.id);
      if (user.role === 'teacher') fetchTeacherEarnings(user.id);
    }
  }, [!impersonatedUser]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (catMenuRef.current && !catMenuRef.current.contains(event.target)) setCatMenuOpen(false);
      if (locMenuRef.current && !locMenuRef.current.contains(event.target)) setLocMenuOpen(false);
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) setLangMenuOpen(false);
      if (deliveryMenuRef.current && !deliveryMenuRef.current.contains(event.target)) setDeliveryMenuOpen(false);
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
  const langParam = query.get('lang');
  const deliveryParam = query.get('delivery');
  const fromParam = query.get('from');
  const toParam = query.get('to');
  const priceParam = query.get('price');
  const proParam = query.get('pro');
  const bookingParam = query.get('booking');

  if (qParam || locParam || typeParam || areaParam || specParam || focusParam || levelParam
      || langParam || deliveryParam || fromParam || toParam || priceParam || proParam || bookingParam) {
    if (qParam) setSearchQuery(qParam);
    if (locParam) setSelectedLocations(locParam.split(','));
    if (typeParam) setSearchType(typeParam);
    if (areaParam) setSearchArea(areaParam);
    if (specParam) setSearchSpecialty(specParam);
    if (focusParam) setSearchFocus(focusParam);
    if (levelParam) setFilterLevel(levelParam);
    if (langParam) setSelectedLanguages(langParam.split(','));
    if (deliveryParam) setSelectedDeliveryTypes(deliveryParam.split(','));
    if (fromParam) setFilterDateFrom(fromParam);
    if (toParam) setFilterDateTo(toParam);
    if (priceParam) setFilterPriceMax(priceParam);
    if (proParam === '1') setFilterPro(true);
    if (bookingParam === '1') setFilterDirectBooking(true);

    // Only switch view if not already on a specific detail/landing page
    setView(prev => (prev !== 'detail' ? 'search' : prev));
  }

  const sessionId = query.get('session_id');
  const isPackageUpgradeReturn = query.get('package_upgrade') === 'success';
  if (sessionId && user && !isPackageUpgradeReturn) {
    let stopped = false;
    const finalizeStripeReturn = async () => {
      const successShownAt = Date.now();
      setView('success');

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          try {
            await fetch('/api/confirm-checkout-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ sessionId })
            });
          } catch (error) {
            console.warn('Checkout confirmation fallback failed:', error);
          }
        }

        const { data } = await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', user.id)
          .eq('stripe_checkout_session_id', sessionId)
          .maybeSingle();

        if (stopped) return;

        if (data) {
          localStorage.removeItem('pendingCourseId');
          localStorage.removeItem('pendingEventId');
          await fetchBookings(user.id);

          const remainingMs = Math.max(0, 3000 - (Date.now() - successShownAt));
          if (remainingMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
          }

          window.history.replaceState({}, document.title, '/dashboard');
          setView('dashboard');
          return;
        }

        if (attempt < 5) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }

      await fetchBookings(user.id);
    };

    finalizeStripeReturn();
    return () => {
      stopped = true;
    };

    /*
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
    */
  }
}, [user]);


  // --- RENDER ---
    return (
    <ErrorBoundary>
      <div className="min-h-screen bg-beige font-sans text-dark selection:bg-orange-100 selection:text-primary flex flex-col font-sans">
      {notification && (<div className={`fixed top-24 left-1/2 transform -translate-x-1/2 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce font-heading ${notificationType === 'error' ? 'bg-red-700' : 'bg-dark'}`}>{notificationType === 'error' ? <XCircle className="w-5 h-5 mr-2 text-red-200" /> : <CheckCircle className="w-5 h-5 mr-2 text-primary" />}{notification}</div>)}

      <Navbar t={t} user={user} lang={lang} setLang={changeLanguage} setView={setView} handleLogout={handleLogout} setShowResults={() => setView('search')} setSelectedCatPath={setSelectedCatPath} />

      {/* Admin Impersonation Banner - fixed above navbar */}
      {impersonatedUser && (
        <div className="fixed top-0 left-0 right-0 bg-purple-600 text-white px-4 py-3 z-[60] flex items-center justify-center gap-4 text-sm font-bold shadow-lg">
          <span>Du siehst das Dashboard von: {impersonatedUser.name}{impersonatedUser.email ? ` (${impersonatedUser.email})` : ''} — Rolle: {impersonatedUser.role}</span>
          <button
            onClick={() => { setImpersonatedUser(null); setView('admin'); }}
            className="bg-white text-purple-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-purple-50 transition"
          >
            Beenden
          </button>
        </div>
      )}

      <main id="main-content" className="flex-grow">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        </div>
      }>

      {/* GLOBAL LOADING STATE - Prevents White Screen / Redirects */}
      {loading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-500 font-sans animate-pulse">Lade Kurse...</p>
          </div>
      )}

      {!loading && view === 'home' && (
                     <Home lang={lang} t={t} courses={courses} setView={setView} setSearchType={setSearchType} setSearchArea={setSearchArea} setSearchSpecialty={setSearchSpecialty} setSearchFocus={setSearchFocus} setSelectedCatPath={setSelectedCatPath} searchQuery={searchQuery} setSearchQuery={setSearchQuery} catMenuOpen={catMenuOpen} setCatMenuOpen={setCatMenuOpen} catMenuRef={catMenuRef} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} getCatLabel={getCatLabel} filterPro={filterPro} setFilterPro={setFilterPro} filterDirectBooking={filterDirectBooking} setFilterDirectBooking={setFilterDirectBooking} selectedDeliveryTypes={selectedDeliveryTypes} setSelectedDeliveryTypes={setSelectedDeliveryTypes} deliveryMenuOpen={deliveryMenuOpen} setDeliveryMenuOpen={setDeliveryMenuOpen} deliveryMenuRef={deliveryMenuRef} />
            )}
            
         {view === 'landing-private' && ( <LandingView title={t.landing_priv_title} subtitle={t.landing_priv_sub} variant="private" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
         {view === 'landing-prof' && ( <LandingView title={t.landing_prof_title} subtitle={t.landing_prof_sub} variant="prof" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}
         {view === 'landing-kids' && ( <LandingView title={t.landing_kids_title} subtitle={t.landing_kids_sub} variant="kids" searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearchSubmit={handleSearchSubmit} setSelectedCatPath={setSelectedCatPath} setView={setView} t={t} getCatLabel={getCatLabel} /> )}

      {view === 'search' && (
          <SearchPageView courses={courses} filteredCoursesPreCategory={filteredCoursesPreCategory} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchType={searchType} setSearchType={setSearchType} searchArea={searchArea} setSearchArea={setSearchArea} searchSpecialty={searchSpecialty} setSearchSpecialty={setSearchSpecialty} searchFocus={searchFocus} setSearchFocus={setSearchFocus} selectedLocations={selectedLocations} setSelectedLocations={setSelectedLocations} locMenuOpen={locMenuOpen} setLocMenuOpen={setLocMenuOpen} locMenuRef={locMenuRef} loading={loading} filteredCourses={filteredCourses} setSelectedCourse={setSelectedCourse} setView={setView} t={t} getCatLabel={getCatLabel} filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom} filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo} filterPriceMax={filterPriceMax} setFilterPriceMax={setFilterPriceMax} filterLevel={filterLevel} setFilterLevel={setFilterLevel} filterPro={filterPro} setFilterPro={setFilterPro} filterDirectBooking={filterDirectBooking} setFilterDirectBooking={setFilterDirectBooking} selectedLanguages={selectedLanguages} setSelectedLanguages={setSelectedLanguages} langMenuOpen={langMenuOpen} setLangMenuOpen={setLangMenuOpen} langMenuRef={langMenuRef} selectedDeliveryTypes={selectedDeliveryTypes} setSelectedDeliveryTypes={setSelectedDeliveryTypes} deliveryMenuOpen={deliveryMenuOpen} setDeliveryMenuOpen={setDeliveryMenuOpen} deliveryMenuRef={deliveryMenuRef} savedCourseIds={savedCourseIds} onToggleSaveCourse={toggleSaveCourse} user={user} selectedSaule={selectedSaule} setSelectedSaule={setSelectedSaule} fetchError={fetchError} onRetry={fetchCourses} setSelectedCatPath={setSelectedCatPath} />
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


            {view === 'success' && <SuccessView setView={setView} t={t} />}

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

      {view === 'admin' && <AdminPanel t={t} courses={courses} showNotification={showNotification} fetchCourses={fetchCourses} setView={setView} user={user} onImpersonate={setImpersonatedUser} handleEditCourse={handleEditCourse} />}
      {view === 'admin-blog' && <AdminBlogManager showNotification={showNotification} setView={setView} courses={courses} />}
      {view === 'blog' && <BlogList articles={articles} setView={setView} setSelectedArticle={setSelectedArticle} />}
      {view === 'blog-detail' && <BlogDetail article={selectedArticle} setView={setView} courses={courses} />}
      {view === 'provider-directory' && <ProviderDirectory t={t} setView={setView} />}
      {view === 'provider-profile' && <ProviderProfilePage t={t} setView={setView} setSelectedCourse={setSelectedCourse} />}
      {view === 'bereich-landing' && (
        <BereichLandingPage
          key={routePath}
          segment={bereichParams.segment}
          slug={bereichParams.slug}
          courses={courses}
          lang={lang}
          t={t}
        />
      )}
      {view === 'bereich-szenario' && (
        <SzenarioArtikelView
          key={routePath}
          segment={bereichParams.segment}
          slug={bereichParams.slug}
          szenarioSlug={bereichParams.szenarioSlug}
          courses={courses}
          lang={lang}
          t={t}
        />
      )}
      {view === 'ratgeber-hub' && <RatgeberHubView key={routePath} lang={lang} />}
      {view === 'ratgeber-cluster' && <RatgeberClusterView key={routePath} lang={lang} />}
      {view === 'ratgeber-artikel' && <RatgeberArtikelView key={routePath} lang={lang} />}
      {view === 'not-found' && <NotFoundPage setView={setView} />}
      {view === 'dashboard' && effectiveUser && <Dashboard user={effectiveUser} setUser={impersonatedUser ? () => {} : setUser} t={t} setView={setView} courses={courses} teacherEarnings={teacherEarnings} myBookings={myBookings} savedCourses={savedCourses} savedCourseIds={savedCourseIds} onToggleSaveCourse={toggleSaveCourse} handleDeleteCourse={handleDeleteCourse} handleEditCourse={handleEditCourse} handleUpdateCourseStatus={handleUpdateCourseStatus} handleCancelEvent={handleCancelEvent} showNotification={showNotification} changeLanguage={changeLanguage} setSelectedCourse={setSelectedCourse} refreshBookings={fetchBookings} refreshTeacherEarnings={fetchTeacherEarnings} isImpersonating={!!impersonatedUser} />}
      {view === 'create' && effectiveUser?.role === 'teacher' && <TeacherForm key={editingCourse?.id || 'new'} t={t} setView={setView} user={effectiveUser} fetchCourses={fetchCourses} showNotification={showNotification} setEditingCourse={setEditingCourse} initialData={editingCourse} isAdminImpersonating={!!impersonatedUser} />}
      </Suspense>
      </main>

      <Footer t={t} setView={setView} />
      </div>
    </ErrorBoundary>
  );
}
