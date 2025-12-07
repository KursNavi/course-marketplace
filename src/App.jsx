import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, Menu, PlusCircle, CheckCircle, ArrowLeft, Globe, LogIn, LayoutDashboard, Settings, Trash2, DollarSign, BarChart, Lock, Calendar, ExternalLink, ChevronDown, ChevronUp, Info, X, Heart, Shield, Mail, Phone, Loader, AlertCircle } from 'lucide-react';

// --- 1. Supabase Setup ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Localization Data ---
const TRANSLATIONS = {
  en: {
    nav_explore: "Explore", nav_about: "About Us", nav_contact: "Contact", nav_login: "Login", nav_logout: "Logout", nav_dashboard: "Dashboard",
    hero_title: "Discover courses near you.", hero_subtitle: "From yodeling in Appenzell to coding in Zürich. Learn locally.",
    search_placeholder: "What do you want to learn?", filter_all_cantons: "All Switzerland", filter_all_categories: "All Categories",
    no_results: "No courses found matching criteria.", btn_book: "Book Course", btn_pay: "Pay & Book", btn_publish: "Publish Course", btn_send: "Send Message",
    form_title: "List a Course", success_msg: "Grüezi! Action successful.", currency: "CHF", admin_panel: "Admin Control Center",
    teacher_dash: "Teacher Dashboard", student_dash: "My Learning", login_title: "Welcome Back", my_bookings: "My Bookings",
    login_as_student: "Login as Student", login_as_teacher: "Login as Teacher", admin_login_title: "Admin Access",
    footer_terms: "Terms & Conditions", footer_privacy: "Data Protection", footer_legal: "Legal Notice", footer_madein: "Made in Switzerland", footer_rights: "All rights reserved.",
    lbl_objectives: "What you will learn", lbl_prerequisites: "Prerequisites", lbl_description: "About this course", lbl_address: "Location",
    lbl_duration: "Duration", lbl_sessions: "sessions", lbl_upcoming: "Upcoming Editions", lbl_provider: "Provider",
    lbl_show_more: "Show more dates", lbl_show_less: "Show less", about_title: "About KursNavi",
    about_subtitle: "Connecting Switzerland through knowledge and skills.",
    about_text: "KursNavi was born from a simple idea: everyone has something to teach, and everyone has something to learn.",
    about_community_title: "Community First", about_community_text: "We prioritize local connections.",
    about_quality_title: "Swiss Quality", about_quality_text: "We verify our hosts.", contact_title: "Contact Us",
    contact_get_in_touch: "Get in Touch", contact_office_hours: "Office Hours", contact_mon_fri: "Monday - Friday: 09:00 - 17:00",
    contact_weekend: "Weekends: Closed", contact_lbl_name: "Name", contact_lbl_email: "Email", contact_lbl_msg: "Message",
    terms_title: "Terms & Conditions", terms_last_updated: "Last Updated: October 2024",
    terms_1_title: "1. Scope of Application", terms_1_text: "These General Terms and Conditions (GTC) apply to the use of the KursNavi platform.",
    terms_2_title: "2. Service Description", terms_2_text: "KursNavi operates as an intermediary platform.",
    terms_3_title: "3. User Obligations", terms_3_text: "Users are obliged to provide truthful information.",
    terms_4_title: "4. Cancellations and Refunds", terms_4_text: "Cancellation policies are set by individual Teachers.",
    terms_5_title: "5. Liability", terms_5_text: "KursNavi accepts no liability for the content or quality of the courses conducted.",
    privacy_title: "Data Protection Guidelines", privacy_compliant: "Compliant with the Swiss Federal Act on Data Protection (FADP).",
    privacy_1_title: "1. Data Controller", privacy_1_text: "KursNavi AG, Bahnhofstrasse 100, 8001 Zürich.",
    privacy_2_title: "2. Data Collection", privacy_2_text: "We collect personal data that you provide to us.",
    privacy_3_title: "3. Purpose of Processing", privacy_3_text: "Your data is processed to facilitate course bookings.",
    privacy_4_title: "4. Data Sharing", privacy_4_text: "We only share necessary data with Teachers.",
    privacy_5_title: "5. Your Rights", privacy_5_text: "You have the right to access, correct, or delete your personal data.",
  },
  de: {
    nav_explore: "Entdecken", nav_login: "Anmelden", nav_logout: "Abmelden", nav_dashboard: "Dashboard",
    hero_title: "Finde Kurse in deiner Nähe.", hero_subtitle: "Vom Jodeln bis zum Programmieren.",
    search_placeholder: "Was möchtest du lernen?", filter_all_cantons: "Ganze Schweiz", filter_all_categories: "Alle Kategorien",
    no_results: "Keine Kurse gefunden.", btn_book: "Kurs buchen", btn_pay: "Bezahlen & Buchen", btn_publish: "Veröffentlichen",
    form_title: "Kurs anbieten", success_msg: "Erfolgreich!", currency: "CHF",
    teacher_dash: "Lehrer Dashboard", student_dash: "Meine Kurse",
    login_title: "Willkommen", my_bookings: "Meine Buchungen",
    lbl_description: "Beschreibung", lbl_address: "Standort", lbl_duration: "Dauer", lbl_provider: "Anbieter",
    btn_send: "Nachricht senden", contact_title: "Kontakt", contact_get_in_touch: "Schreib uns",
    contact_office_hours: "Öffnungszeiten", contact_mon_fri: "Mo-Fr: 09:00 - 17:00", contact_weekend: "Wochenende: Geschlossen",
    contact_lbl_name: "Name", contact_lbl_email: "E-Mail", contact_lbl_msg: "Nachricht",
    about_title: "Über uns", about_subtitle: "Die Schweiz verbinden.", about_text: "Wir verbinden lokale Experten mit Schülern.",
    about_community_title: "Gemeinschaft", about_community_text: "Lokale Verbindungen sind uns wichtig.",
    about_quality_title: "Qualität", about_quality_text: "Geprüfte Gastgeber.",
    footer_terms: "AGB", footer_privacy: "Datenschutz", footer_legal: "Impressum", footer_madein: "Made in Switzerland", footer_rights: "Alle Rechte vorbehalten.",
    terms_title: "AGB", terms_last_updated: "Stand: 2024", terms_1_title: "1. Geltungsbereich", terms_1_text: "Es gelten unsere AGB.",
    terms_2_title: "2. Service", terms_2_text: "Wir sind nur Vermittler.", terms_3_title: "3. Pflichten", terms_3_text: "Wahre Angaben machen.",
    terms_4_title: "4. Storno", terms_4_text: "Lehrer entscheiden.", terms_5_title: "5. Haftung", terms_5_text: "Keine Haftung für Kurse.",
    privacy_title: "Datenschutz", privacy_compliant: "DSGVO konform.", privacy_1_title: "1. Verantwortlicher", privacy_1_text: "KursNavi AG.",
    privacy_2_title: "2. Daten", privacy_2_text: "Wir speichern Ihre Eingaben.", privacy_3_title: "3. Zweck", privacy_3_text: "Vermittlung.",
    privacy_4_title: "4. Weitergabe", privacy_4_text: "Nur an Lehrer.", privacy_5_title: "5. Rechte", privacy_5_text: "Auskunft jederzeit."
  },
  fr: {
    nav_explore: "Explorer", nav_login: "Connexion", nav_logout: "Déconnexion", nav_dashboard: "Tableau de bord",
    hero_title: "Découvrez des cours.", hero_subtitle: "Apprenez localement.",
    search_placeholder: "Que voulez-vous apprendre?", filter_all_cantons: "Toute la Suisse", filter_all_categories: "Toutes catégories",
    no_results: "Aucun cours trouvé.", btn_book: "Réserver", btn_pay: "Payer et réserver", btn_publish: "Publier",
    form_title: "Proposer un cours", success_msg: "Succès!", currency: "CHF",
    teacher_dash: "Tableau de bord", student_dash: "Mes apprentissages",
    login_title: "Bienvenue", my_bookings: "Mes réservations",
    lbl_description: "Description", lbl_address: "Lieu", lbl_duration: "Durée", lbl_provider: "Fournisseur",
    btn_send: "Envoyer", contact_title: "Contact", contact_get_in_touch: "Contactez-nous",
    contact_office_hours: "Heures", contact_mon_fri: "Lun-Ven: 09:00 - 17:00", contact_weekend: "Fermé",
    contact_lbl_name: "Nom", contact_lbl_email: "Email", contact_lbl_msg: "Message",
    about_title: "À propos", about_subtitle: "Relier la Suisse.", about_text: "Nous connectons experts et étudiants.",
    about_community_title: "Communauté", about_community_text: "Priorité au local.",
    about_quality_title: "Qualité", about_quality_text: "Hôtes vérifiés.",
    footer_terms: "CGV", footer_privacy: "Confidentialité", footer_legal: "Mentions légales", footer_madein: "Fabriqué en Suisse", footer_rights: "Droits réservés.",
    terms_title: "CGV", terms_last_updated: "2024", terms_1_title: "1. Portée", terms_1_text: "Nos CGV s'appliquent.",
    terms_2_title: "2. Service", terms_2_text: "Intermédiaire uniquement.", terms_3_title: "3. Obligations", terms_3_text: "Informations véridiques.",
    terms_4_title: "4. Annulation", terms_4_text: "Selon l'enseignant.", terms_5_title: "5. Responsabilité", terms_5_text: "Aucune responsabilité sur les cours.",
    privacy_title: "Confidentialité", privacy_compliant: "Conforme LPD/RGPD.", privacy_1_title: "1. Responsable", privacy_1_text: "KursNavi AG.",
    privacy_2_title: "2. Données", privacy_2_text: "Nous collectons vos saisies.", privacy_3_title: "3. But", privacy_3_text: "Facilitation.",
    privacy_4_title: "4. Partage", privacy_4_text: "Aux profs uniquement.", privacy_5_title: "5. Droits", privacy_5_text: "Accès sur demande."
  }
};

const INITIAL_CANTONS = ["Zürich", "Bern", "Luzern", "Genève", "Basel-Stadt", "Vaud", "Zug", "Ticino", "St. Gallen"];
const INITIAL_CATEGORIES = ["Cooking", "Photography", "Languages", "Lifestyle", "Sports", "Tech", "Art"];

export default function KursNaviPro() {
  const [lang, setLang] = useState('en');
  const [view, setView] = useState('home'); 
  const [user, setUser] = useState(null); 
  const [session, setSession] = useState(null);
  
  // App State
  const [courses, setCourses] = useState([]); 
  const [myBookings, setMyBookings] = useState([]); 
  const [teacherEarnings, setTeacherEarnings] = useState([]); // NEW: Store Teacher Earnings
  const [loading, setLoading] = useState(true);
  const [cantons, setCantons] = useState(INITIAL_CANTONS);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeCanton, setActiveCanton] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];

  // --- Real Auth Listener ---
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

  // --- Payment Success Handler ---
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');
    
    if (sessionId && user) {
        const pendingCourseId = localStorage.getItem('pendingCourseId');

        if (pendingCourseId) {
            const saveBooking = async () => {
                const { error } = await supabase
                    .from('bookings')
                    .insert([{ 
                        user_id: user.id, 
                        course_id: pendingCourseId,
                        is_paid: false, // Default to false until robot pays
                        status: 'confirmed'
                    }]);

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
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error.message);
      showNotification("Error loading courses");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, courses(*)')
        .eq('user_id', userId);

      if (error) throw error;
      const bookedCourses = data.map(booking => booking.courses).filter(c => c !== null);
      setMyBookings(bookedCourses);
    } catch (error) {
      console.error('Error fetching bookings:', error.message);
    }
  };

  // --- NEW: Fetch Teacher Earnings ---
  const fetchTeacherEarnings = async (userId) => {
      try {
          // 1. Get all courses by this teacher
          const { data: myCourses } = await supabase
              .from('courses')
              .select('id, title, price')
              .eq('user_id', userId);

          if (!myCourses || myCourses.length === 0) return;

          const courseIds = myCourses.map(c => c.id);

          // 2. Get all bookings for these courses
          const { data: bookings } = await supabase
              .from('bookings')
              .select('*, profiles:user_id(full_name, email)')
              .in('course_id', courseIds);

          if (!bookings) return;

          // 3. Merge data for display
          const earningsData = bookings.map(booking => {
              const course = myCourses.find(c => c.id === booking.course_id);
              return {
                  id: booking.id,
                  courseTitle: course?.title || 'Unknown',
                  studentName: booking.profiles?.full_name || 'Guest Student',
                  price: course?.price || 0,
                  payout: (course?.price || 0) * 0.85,
                  isPaidOut: booking.is_paid, // The robot's checkbox
                  date: new Date(booking.created_at).toLocaleDateString()
              };
          });

          setTeacherEarnings(earningsData);

      } catch (error) {
          console.error("Error fetching earnings:", error);
      }
  };

  // --- Actions ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    showNotification("Logged out successfully");
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteCourse = async (courseId) => {
    setCourses(courses.filter(c => c.id !== courseId));
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) {
        showNotification("Error deleting course");
        fetchCourses(); 
    } else {
        showNotification("Course deleted.");
    }
  };

  const handlePublishCourse = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');

    const newCourse = {
      title: formData.get('title'),
      instructor_name: user.name,
      price: Number(formData.get('price')),
      rating: 0,
      category: formData.get('category'),
      canton: formData.get('canton'),
      address: formData.get('address'),
      image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600",
      description: formData.get('description'),
      objectives: objectivesList,
      prerequisites: formData.get('prerequisites'),
      session_count: Number(formData.get('sessionCount')),
      session_length: formData.get('sessionLength'),
      provider_url: formData.get('providerUrl'),
      user_id: user.id,
      start_date: formData.get('startDate') 
    };
    
    const { data, error } = await supabase.from('courses').insert([newCourse]).select();

    if (error) {
        console.error(error);
        showNotification("Error publishing course");
    } else {
        if (data && data.length > 0) setCourses([data[0], ...courses]);
        else fetchCourses();
        
        setView('dashboard');
        showNotification(t.success_msg);
    }
  };

  const handleCancelBooking = async (courseId, courseTitle) => {
      if (!confirm(`Are you sure you want to cancel your spot in "${courseTitle}"?`)) return;

      showNotification("Processing cancellation...");

      try {
          const response = await fetch('/api/cancel-booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  courseId: courseId,
                  userId: user.id,
                  courseTitle: courseTitle,
                  studentEmail: user.email 
              }),
          });

          const data = await response.json();

          if (data.error) throw new Error(data.error);

          setMyBookings(myBookings.filter(c => c.id !== courseId));
          showNotification("Booking cancelled successfully.");

      } catch (error) {
          console.error("Cancellation error:", error);
          alert("Error cancelling: " + error.message);
      }
  };

  const handleBookCourse = async (course) => {
      if (!user) {
          setView('login');
          return;
      }
      
      try {
          localStorage.setItem('pendingCourseId', course.id);
          const response = await fetch('/api/create-checkout-session', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  courseId: course.id,
                  courseTitle: course.title,
                  coursePrice: course.price,
                  courseImage: course.image_url,
                  userId: user.id,
              }),
          });

          const data = await response.json();
          if (data.error) throw new Error(data.error);
          window.location.href = data.url; 

      } catch (error) {
          console.error("Booking error:", error);
          alert("SYSTEM ERROR: " + error.message);
      }
  };

  const handleContactSubmit = (e) => {
      e.preventDefault();
      showNotification("Message sent!");
      setView('home');
  };

  // --- Filtering ---
  const filteredCourses = courses.filter(course => {
    const matchesCategory = activeCategory === "All" || course.category === activeCategory;
    const matchesCanton = activeCanton === "All" || course.canton === activeCanton;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (course.instructor_name && course.instructor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch && matchesCanton;
  });

  // --- Helpers ---
  const calculateDeadline = (startDateString) => {
      if (!startDateString) return null;
      const start = new Date(startDateString);
      const deadline = new Date(start);
      // Deadline is 1 month before start
      deadline.setMonth(deadline.getMonth() - 1);
      return deadline;
  };

  // --- Components ---
  const SuccessView = () => (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Payment Successful!</h2>
              <p className="text-gray-600 mb-8">Thank you for your booking. You will receive a confirmation email shortly.</p>
              <button 
                  onClick={() => {
                      window.history.replaceState({}, document.title, window.location.pathname);
                      setView('dashboard');
                  }} 
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition"
              >
                  Go to My Courses
              </button>
          </div>
      </div>
  );

  const AuthView = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('student');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isSignUp) {
                // 1. Sign up the user in Supabase Auth
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: fullName, role: role } }
                });
                
                if (authError) throw authError;

                // 2. IMPORTANT: Create a profile in the 'profiles' table
                // The robot needs this to find names later!
                if (authData?.user) {
                    await supabase.from('profiles').insert([
                        { 
                            id: authData.user.id, 
                            full_name: fullName, 
                            email: email 
                        }
                    ]);
                }

                showNotification("Account created! Check your email.");
            } else {
                // LOGIN LOGIC - MODIFIED FOR REDIRECTION
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                // TRAFFIC DIRECTOR: Check role and redirect
                const userRole = data.user?.user_metadata?.role;
                if (userRole === 'teacher') {
                    setView('dashboard');
                } else {
                    setView('home');
                }
                
                showNotification("Welcome back!");
            }
        } catch (error) {
            showNotification(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-gray-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-center">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                                <input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500" value={fullName} onChange={e => setFullName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">I am a...</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'student' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'student'} onChange={() => setRole('student')} />
                                        Student
                                    </label>
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'teacher' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'teacher'} onChange={() => setRole('teacher')} />
                                        Teacher
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                        <input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                        <input required type="password" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button disabled={loading} type="submit" className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50">
                        {loading ? <Loader className="animate-spin mx-auto" /> : (isSignUp ? "Sign Up" : "Login")}
                    </button>
                </form>
                <p className="text-center text-sm text-gray-600 mt-6">
                    {isSignUp ? "Already have an account?" : "Don't have an account?"}
                    <button onClick={() => setIsSignUp(!isSignUp)} className="text-red-600 font-bold ml-2 hover:underline">
                        {isSignUp ? "Login" : "Sign Up"}
                    </button>
                </p>
            </div>
        </div>
    );
  };

  const Navbar = () => (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center mr-2">
               <PlusCircle className="text-white w-5 h-5 font-bold" strokeWidth={3} />
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">KursNavi</span>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <button onClick={() => setView('home')} className="text-gray-600 hover:text-red-600 font-medium">{t.nav_explore}</button>
            <button onClick={() => setView('about')} className="text-gray-600 hover:text-red-600 font-medium">{t.nav_about}</button>
            {!user ? (
                <button onClick={() => setView('login')} className="text-gray-600 hover:text-red-600 font-medium flex items-center">
                    <LogIn className="w-4 h-4 mr-1" /> {t.nav_login}
                </button>
            ) : (
                <>
                    <button onClick={() => setView('dashboard')} className="text-gray-600 hover:text-red-600 font-medium flex items-center">
                        <LayoutDashboard className="w-4 h-4 mr-1" /> {t.nav_dashboard}
                    </button>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 font-medium text-sm">
                        {t.nav_logout}
                    </button>
                </>
            )}
            <div className="border-l pl-4 ml-4 flex space-x-2 text-sm font-medium">
                {['en', 'de', 'fr'].map(l => (
                    <button key={l} onClick={() => setLang(l)} className={`${lang === l ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{l.toUpperCase()}</button>
                ))}
            </div>
          </div>
           <div className="md:hidden flex items-center">
             <button onClick={() => setIsMenuOpen(!isMenuOpen)}><Menu /></button>
          </div>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t p-4 space-y-4 shadow-lg">
             <button onClick={() => {setView('home'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_explore}</button>
             <button onClick={() => {setView('about'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_about}</button>
             <button onClick={() => {setView('login'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_login}</button>
        </div>
      )}
    </nav>
  );

  const DetailView = ({ course }) => (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <button onClick={() => setView('home')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to courses
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <div className="relative rounded-2xl overflow-hidden shadow-lg h-80">
                <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-bold text-gray-800 flex items-center shadow-sm">
                    <MapPin className="w-4 h-4 mr-1 text-red-600" /> {course.canton}
                </div>
            </div>
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 mb-3">{course.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center"><User className="w-4 h-4 mr-1" /> {course.instructor_name}</span>
                </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900">{t.lbl_description}</h3>
                    <p className="text-gray-600 leading-relaxed text-lg">{course.description}</p>
                </div>
                {course.objectives && (
                    <div>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t.lbl_objectives}</h3>
                        <ul className="space-y-2">
                            {course.objectives.map((obj, i) => (
                                <li key={i} className="flex items-start">
                                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                                    <span className="text-gray-700">{obj}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 sticky top-24">
            <div className="mb-6 border-b pb-6">
                <span className="text-4xl font-extrabold text-gray-900 block mb-1">{t.currency} {course.price}</span>
                <span className="text-sm text-gray-500 block mb-4">per person</span>
                <button onClick={() => handleBookCourse(course)} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition shadow-md active:scale-95">
                    {t.btn_pay}
                </button>
            </div>
            
             {/* DATE DISPLAY BLOCK */}
             {course.start_date && (
                <div className="mb-6 pb-6 border-b border-gray-100">
                    <div className="flex items-center text-red-600 font-bold mb-1">
                        <Calendar className="w-5 h-5 mr-2" />
                        <span>Start Date</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900 ml-7">
                      {new Date(course.start_date).toLocaleDateString('en-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </div>
             )}

            <div className="space-y-4">
                <div className="flex items-start">
                    <div className="w-8 flex-shrink-0">
                        <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_address}</span>
                        <span className="text-gray-700 font-medium">{course.address || course.canton}</span>
                    </div>
                </div>
                {course.session_count && (
                  <div className="flex items-start">
                      <div className="w-8 flex-shrink-0">
                          <Clock className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_duration}</span>
                          <span className="text-gray-700 font-medium">{course.session_count} {t.lbl_sessions} × {course.session_length}</span>
                      </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const TeacherForm = () => (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </button>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-gray-900">{t.form_title}</h1>
                <p className="text-gray-500 mt-2">Share your skills with the community.</p>
            </div>
            
            <form onSubmit={handlePublishCourse} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Course Title</label>
                        <input required type="text" name="title" placeholder="e.g. Traditional Swiss Cooking" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-shadow" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                        <div className="relative">
                            <select name="category" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none appearance-none bg-white">
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Price (CHF)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500 font-bold">CHF</span>
                            <input required type="number" name="price" placeholder="50" className="w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Canton</label>
                        <div className="relative">
                            <select name="canton" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none appearance-none bg-white">
                                {cantons.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Specific Address</label>
                        <input required type="text" name="address" placeholder="Street, City, Zip" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Session Count</label>
                        <input required type="number" name="sessionCount" defaultValue="1" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Session Length</label>
                        <input required type="text" name="sessionLength" placeholder="e.g. 2 hours" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>

                    {/* NEW START DATE FIELD */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                            <input required type="date" name="startDate" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">When does the first session begin?</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Provider Website (Optional)</label>
                        <div className="relative">
                            <ExternalLink className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                            <input type="url" name="providerUrl" placeholder="https://..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                    <textarea required name="description" rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="Describe your course..."></textarea>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">What will students learn?</label>
                    <textarea required name="objectives" rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="Enter each objective on a new line..."></textarea>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Prerequisites</label>
                    <input type="text" name="prerequisites" placeholder="e.g. Beginners welcome, bring a laptop" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button type="submit" className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg hover:-translate-y-0.5 transition flex items-center">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        {t.btn_publish}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );

  const AboutPage = () => (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t.about_title}</h1>
            <p className="text-xl text-gray-500">{t.about_subtitle}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-12">
            <img src="https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?auto=format&fit=crop&q=80&w=1200" alt="Swiss Landscape" className="w-full h-64 object-cover" />
            <div className="p-8 space-y-6">
                <p className="text-lg text-gray-700 leading-relaxed">{t.about_text}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <div className="flex items-start">
                        <Heart className="w-8 h-8 text-red-600 mr-4 flex-shrink-0" />
                        <div>
                            <h3 className="font-bold text-gray-900 mb-1">{t.about_community_title}</h3>
                            <p className="text-gray-600">{t.about_community_text}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <Shield className="w-8 h-8 text-red-600 mr-4 flex-shrink-0" />
                        <div>
                            <h3 className="font-bold text-gray-900 mb-1">{t.about_quality_title}</h3>
                            <p className="text-gray-600">{t.about_quality_text}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const ContactPage = () => (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">{t.contact_title}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <h3 className="font-bold text-lg mb-4 text-red-900">{t.contact_get_in_touch}</h3>
                    <div className="space-y-4">
                        <div className="flex items-center text-gray-700">
                            <Mail className="w-5 h-5 mr-3 text-red-600" />
                            <span>support@kursnavi.ch</span>
                        </div>
                        <div className="flex items-center text-gray-700">
                            <Phone className="w-5 h-5 mr-3 text-red-600" />
                            <span>+41 44 123 45 67</span>
                        </div>
                        <div className="flex items-start text-gray-700">
                            <MapPin className="w-5 h-5 mr-3 text-red-600 mt-1" />
                            <span>KursNavi AG<br/>Bahnhofstrasse 100<br/>8001 Zürich<br/>Switzerland</span>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-2">{t.contact_office_hours}</h3>
                    <p className="text-gray-600">{t.contact_mon_fri}</p>
                    <p className="text-gray-600">{t.contact_weekend}</p>
                </div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_name}</label>
                        <input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder={t.contact_lbl_name} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_email}</label>
                        <input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="you@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.contact_lbl_msg}</label>
                        <textarea required rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="..."></textarea>
                    </div>
                    <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition">
                        {t.btn_send}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );

  const TermsPage = () => (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in duration-500">
          <div className="prose prose-red max-w-none">
              <h1 className="text-3xl font-bold mb-6">{t.terms_title}</h1>
              <p className="text-sm text-gray-500 mb-8">{t.terms_last_updated}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.terms_1_title}</h3>
              <p className="text-gray-700 mb-4">{t.terms_1_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.terms_2_title}</h3>
              <p className="text-gray-700 mb-4">{t.terms_2_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.terms_3_title}</h3>
              <p className="text-gray-700 mb-4">{t.terms_3_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.terms_4_title}</h3>
              <p className="text-gray-700 mb-4">{t.terms_4_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.terms_5_title}</h3>
              <p className="text-gray-700 mb-4">{t.terms_5_text}</p>
          </div>
      </div>
  );

  const PrivacyPage = () => (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-in fade-in duration-500">
          <div className="prose prose-red max-w-none">
              <h1 className="text-3xl font-bold mb-6">{t.privacy_title}</h1>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
                  <p className="text-blue-800 text-sm">{t.privacy_compliant}</p>
              </div>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.privacy_1_title}</h3>
              <p className="text-gray-700 mb-4">{t.privacy_1_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.privacy_2_title}</h3>
              <p className="text-gray-700 mb-4">{t.privacy_2_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.privacy_3_title}</h3>
              <p className="text-gray-700 mb-4">{t.privacy_3_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.privacy_4_title}</h3>
              <p className="text-gray-700 mb-4">{t.privacy_4_text}</p>
              <h3 className="text-xl font-bold mt-6 mb-3">{t.privacy_5_title}</h3>
              <p className="text-gray-700 mb-4">{t.privacy_5_text}</p>
          </div>
      </div>
  );

  const AdminPanel = () => (
    <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Settings className="mr-3 w-8 h-8 text-gray-700" />
                {t.admin_panel}
            </h1>
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">Logged in as Admin</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-xl mb-4 text-gray-800">Manage Cantons</h3>
                <div className="flex flex-wrap gap-2">
                    {cantons.map(c => (
                        <span key={c} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm flex items-center">
                            {c}
                        </span>
                    ))}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-xl mb-4 text-gray-800">Manage Categories</h3>
                <div className="flex flex-wrap gap-2">
                    {categories.map(c => (
                        <span key={c} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center">
                            {c}
                        </span>
                    ))}
                </div>
            </div>
        </div>
        <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <h3 className="font-bold text-xl mb-4 text-gray-800">Platform Overview</h3>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 text-sm">Total Courses</div>
                    <div className="text-2xl font-bold">{courses.length}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 text-sm">Active Cantons</div>
                    <div className="text-2xl font-bold">{cantons.length}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 text-sm">Platform Fees (Est.)</div>
                    <div className="text-2xl font-bold">CHF 1,250</div>
                </div>
             </div>
        </div>
    </div>
  );

  const Dashboard = () => {
    // TEACHER DASHBOARD
    if (user.role === 'teacher') {
        const myCourses = courses.filter(c => c.user_id === user.id); 
        
        // Calculate Total Paid Earnings
        const totalPaidOut = teacherEarnings
            .filter(e => e.isPaidOut)
            .reduce((sum, e) => sum + e.payout, 0);

        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t.teacher_dash}</h1>
                        <p className="text-gray-500">Welcome back, {user.name}</p>
                    </div>
                    <button onClick={() => setView('create')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 flex items-center shadow-lg hover:-translate-y-0.5 transition">
                        <PlusCircle className="mr-2 w-5 h-5" /> New Course
                    </button>
                </div>

                {/* EARNINGS SUMMARY */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                            <DollarSign className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Payouts Received</p>
                            <p className="text-2xl font-bold text-gray-900">CHF {totalPaidOut.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center">
                         <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                            <User className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Students</p>
                            <p className="text-2xl font-bold text-gray-900">{teacherEarnings.length}</p>
                        </div>
                    </div>
                </div>

                {/* EARNINGS TABLE */}
                <h2 className="text-xl font-bold mb-4">Student & Earnings History</h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                      {teacherEarnings.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Date</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Course</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Student</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Your Payout (85%)</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {teacherEarnings.map(earning => (
                                        <tr key={earning.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm text-gray-500">{earning.date}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{earning.courseTitle}</td>
                                            <td className="px-6 py-4 text-gray-700">{earning.studentName}</td>
                                            <td className="px-6 py-4 font-bold text-gray-900">CHF {earning.payout.toFixed(2)}</td>
                                            <td className="px-6 py-4">
                                                {earning.isPaidOut ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Paid Out
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                      ) : <div className="p-8 text-center text-gray-500">No student bookings yet.</div>}
                </div>

                <h2 className="text-xl font-bold mb-4">My Active Courses</h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {myCourses.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Course</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Price</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {myCourses.map(course => (
                                        <tr key={course.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4"><div className="font-bold text-gray-900">{course.title}</div></td>
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
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">{t.student_dash}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-bold mb-4">{t.my_bookings}</h2>
                    <div className="space-y-4">
                        {myBookings.length > 0 ? myBookings.map(course => {
                            // --- SMART CANCELLATION LOGIC ---
                            let canCancel = true;
                            let deadlineText = "";
                            
                            if (course.start_date) {
                                const deadline = calculateDeadline(course.start_date);
                                const now = new Date();
                                
                                if (now > deadline) {
                                    canCancel = false;
                                    deadlineText = `Cancellation period ended on ${deadline.toLocaleDateString()}`;
                                } else {
                                    deadlineText = `Cancel until ${deadline.toLocaleDateString()}`;
                                }
                            }
                            // --------------------------------

                            return (
                                <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                                    <img src={course.image_url} className="w-20 h-20 rounded-lg object-cover" />
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-gray-900">{course.title}</h3>
                                        <p className="text-sm text-gray-500">{course.instructor_name} • {course.canton}</p>
                                        
                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="text-green-600 text-sm font-medium flex items-center">
                                                <CheckCircle className="w-4 h-4 mr-1" /> Confirmed
                                            </div>

                                            {/* CONDITIONAL BUTTON */}
                                            {canCancel ? (
                                                <div className="flex flex-col items-end">
                                                    <button 
                                                        onClick={() => handleCancelBooking(course.id, course.title)}
                                                        className="text-red-500 text-sm hover:text-red-700 hover:underline font-medium"
                                                    >
                                                        Cancel Booking
                                                    </button>
                                                    <span className="text-xs text-gray-400 mt-1">{deadlineText}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center text-gray-400 text-sm bg-gray-50 px-2 py-1 rounded">
                                                    <Lock className="w-3 h-3 mr-1" />
                                                    <span>Non-refundable</span>
                                                </div>
                                            )}
                                            
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-gray-500 italic">You haven't booked any courses yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-red-100 selection:text-red-900 flex flex-col">
      {notification && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce">
          <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
          {notification}
        </div>
      )}

      <Navbar />

      <div className="flex-grow">
      {view === 'home' && (
        <>
          <div className="bg-gradient-to-r from-red-700 to-red-900 text-white py-20 px-4">
              <div className="max-w-4xl mx-auto text-center space-y-6">
                 <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{t.hero_title}</h1>
                 <p className="text-xl text-red-100 max-w-2xl mx-auto">{t.hero_subtitle}</p>
              </div>
          </div>

           {/* Filter Bar */}
           <div className="bg-white border-b sticky top-16 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
                <div className="relative flex-grow max-w-lg">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" placeholder={t.search_placeholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-colors" />
                </div>
                <div className="flex-shrink-0">
                    <select className="w-full md:w-auto px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer" value={activeCanton} onChange={(e) => setActiveCanton(e.target.value)}>
                        <option value="All">{t.filter_all_cantons}</option>
                        {cantons.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex-grow overflow-x-auto no-scrollbar md:flex md:justify-end">
                    <div className="flex space-x-2">
                        <button onClick={() => setActiveCategory("All")} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === "All" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{t.filter_all_categories}</button>
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{cat}</button>
                        ))}
                    </div>
                </div>
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {loading ? <div className="text-center py-20">Loading courses...</div> : filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredCourses.map(course => (
                  <div key={course.id} onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                    <div className="relative h-48 overflow-hidden">
                        <img src={course.image_url} alt={course.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-red-600" />
                        {course.canton}
                        </div>
                    </div>
                    <div className="p-5">
                        <h3 className="font-bold text-lg text-gray-900 leading-tight line-clamp-2 h-12 mb-2">{course.title}</h3>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                           <div className="flex items-center space-x-3 text-sm text-gray-500">
                                <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                                    <User className="w-3 h-3 text-gray-500 mr-1" />
                                    {course.instructor_name}
                                </div>
                           </div>
                           <span className="font-bold text-gray-900 text-lg">{t.currency} {course.price}</span>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300"><p className="text-gray-500 text-lg font-medium">{t.no_results}</p></div>}
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
    
      <footer className="bg-white border-t border-gray-200 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div>
                    <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center mr-2">
                           <PlusCircle className="text-white w-5 h-5 font-bold" strokeWidth={3} />
                        </div>
                        <span className="font-bold text-xl text-gray-900">KursNavi</span>
                    </div>
                    <p className="text-sm text-gray-500">
                        {t.about_subtitle}
                    </p>
                </div>
                <div>
                    <h4 className="font-bold text-gray-900 mb-4">Platform</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li><button onClick={() => setView('home')} className="hover:text-red-600">Home</button></li>
                        <li><button onClick={() => setView('about')} className="hover:text-red-600">{t.nav_about}</button></li>
                        <li><button onClick={() => setView('contact')} className="hover:text-red-600">{t.nav_contact}</button></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-gray-900 mb-4">Legal</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li><button onClick={() => setView('terms')} className="hover:text-red-600">{t.footer_terms}</button></li>
                        <li><button onClick={() => setView('privacy')} className="hover:text-red-600">{t.footer_privacy}</button></li>
                        <li><button onClick={() => setView('contact')} className="hover:text-red-600">{t.footer_legal}</button></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-gray-900 mb-4">Admin</h4>
                      <button onClick={() => setView('admin_login')} className="text-sm text-gray-500 hover:text-red-600 flex items-center">
                        <Lock className="w-3 h-3 mr-1" /> Admin Access
                    </button>
                </div>
            </div>
            <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
                <div>© 2024 KursNavi Schweiz AG. {t.footer_rights}</div>
                <div className="flex items-center space-x-2 mt-4 md:mt-0">
                    <Globe className="w-4 h-4" />
                    <span>{t.footer_madein}</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}