import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, Menu, CheckCircle, ArrowLeft, Globe, LogIn, LayoutDashboard, Settings, Trash2, DollarSign, Lock, Calendar, ExternalLink, ChevronDown, Mail, Phone, Loader, Heart, Shield, Filter, X } from 'lucide-react';

// --- 1. Supabase Setup ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 2. Brand Assets & Styles ---
const BRAND = {
  orange: '#FA6E28', 
  black: '#333333',  
  lightOrange: '#FFF0EB', 
  blue: '#78B3CE',   
  lightBeige: '#FAF5F0', 
};

const KursNaviLogo = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 40 L48 55 L48 85 L10 70 Z" fill={BRAND.orange} />
    <path d="M52 55 L90 40 L90 70 L52 85 Z" fill={BRAND.orange} />
    <path d="M50 10 L55 30 L75 35 L55 40 L50 60 L45 40 L25 35 L45 30 Z" fill={BRAND.orange} />
  </svg>
);

// --- 3. Data & Translations ---
const TRANSLATIONS = {
  en: {
    nav_explore: "Explore", nav_about: "About Us", nav_contact: "Contact", nav_login: "Login", nav_logout: "Logout", nav_dashboard: "Dashboard",
    hero_title: "Discover courses near you.", hero_subtitle: "From yodeling in Appenzell to coding in Zürich. Learn locally.",
    search_placeholder: "What do you want to learn?", 
    no_results: "No courses found matching criteria.", btn_book: "Book Course", btn_pay: "Pay & Book", btn_publish: "Publish Course", btn_send: "Send Message",
    form_title: "List a Course", success_msg: "Grüezi! Action successful.", currency: "CHF", admin_panel: "Admin Control Center",
    teacher_dash: "Teacher Dashboard", student_dash: "My Learning", login_title: "Welcome Back", my_bookings: "My Bookings",
    lbl_objectives: "What you will learn", lbl_prerequisites: "Prerequisites", lbl_description: "About this course", lbl_address: "Location",
    lbl_duration: "Duration", lbl_sessions: "sessions", lbl_upcoming: "Upcoming Editions", lbl_provider: "Provider",
    footer_terms: "Terms & Conditions", footer_privacy: "Data Protection", footer_legal: "Legal Notice", footer_madein: "Made in Switzerland", footer_rights: "All rights reserved.",
  },
  de: {
    nav_explore: "Entdecken", nav_login: "Anmelden", nav_logout: "Abmelden", nav_dashboard: "Dashboard",
    hero_title: "Finde Kurse in deiner Nähe.", hero_subtitle: "Vom Jodeln bis zum Programmieren.",
    search_placeholder: "Was möchtest du lernen?",
    no_results: "Keine Kurse gefunden.", btn_book: "Kurs buchen", btn_pay: "Bezahlen & Buchen", btn_publish: "Veröffentlichen",
    form_title: "Kurs anbieten", success_msg: "Erfolgreich!", currency: "CHF",
    teacher_dash: "Lehrer Dashboard", student_dash: "Meine Kurse",
    login_title: "Willkommen", my_bookings: "Meine Buchungen",
    lbl_description: "Beschreibung", lbl_address: "Standort", lbl_duration: "Dauer", lbl_provider: "Anbieter",
    btn_send: "Nachricht senden",
    footer_terms: "AGB", footer_privacy: "Datenschutz", footer_legal: "Impressum", footer_madein: "Made in Switzerland", footer_rights: "Alle Rechte vorbehalten.",
  },
  fr: {
    nav_explore: "Explorer", nav_login: "Connexion", nav_logout: "Déconnexion", nav_dashboard: "Tableau de bord",
    hero_title: "Découvrez des cours.", hero_subtitle: "Apprenez localement.",
    search_placeholder: "Que voulez-vous apprendre?", 
    no_results: "Aucun cours trouvé.", btn_book: "Réserver", btn_pay: "Payer et réserver", btn_publish: "Publier",
    form_title: "Proposer un cours", success_msg: "Succès!", currency: "CHF",
    teacher_dash: "Tableau de bord", student_dash: "Mes apprentissages",
    login_title: "Bienvenue", my_bookings: "Mes réservations",
    lbl_description: "Description", lbl_address: "Lieu", lbl_duration: "Durée", lbl_provider: "Fournisseur",
    btn_send: "Envoyer",
    footer_terms: "CGV", footer_privacy: "Confidentialité", footer_legal: "Mentions légales", footer_madein: "Fabriqué en Suisse", footer_rights: "Droits réservés.",
  }
};

// --- NEW DATA STRUCTURES ---

const CANTONS = [
  "Zürich", "Bern", "Luzern", "Uri", "Schwyz", "Obwalden", "Nidwalden", "Glarus", "Zug", "Fribourg", "Solothurn", "Basel-Stadt", "Basel-Landschaft", "Schaffhausen", "Appenzell AR", "Appenzell AI", "St. Gallen", "Graubünden", "Aargau", "Thurgau", "Ticino", "Vaud", "Valais", "Neuchâtel", "Genève", "Jura"
];

const CITIES = [
  "Zürich", "Genève", "Basel", "Lausanne", "Bern", "Winterthur", "Luzern", "St. Gallen", "Lugano", "Biel/Bienne"
];

// 3-Level Category Hierarchy
const CATEGORY_HIERARCHY = {
  "Professional": {
    "Business": ["Management", "Marketing", "Finance", "Entrepreneurship", "Other Business"],
    "Technology": ["Programming", "Data Science", "Design", "Cybersecurity", "Other Tech"],
    "Languages": ["German", "French", "English", "Italian", "Spanish", "Other Languages"],
    "Soft Skills": ["Communication", "Leadership", "Public Speaking", "Other Soft Skills"]
  },
  "Private & Hobby": {
    "Music": ["Guitar", "Piano", "Vocals", "Drums", "Music Theory", "Other Instruments"],
    "Sports & Fitness": ["Yoga", "Pilates", "Personal Training", "Team Sports", "Other Sports"],
    "Arts & Crafts": ["Painting", "Photography", "Pottery", "Drawing", "Other Arts"],
    "Cooking & Nutrition": ["Swiss Cuisine", "International", "Baking", "Vegan/Vegetarian", "Other Cooking"],
    "Lifestyle": ["Meditation", "Gardening", "DIY", "Other Lifestyle"]
  },
  "Children": {
    "Academic Support": ["Math Tutoring", "Language Tutoring", "Science", "Other Tutoring"],
    "Arts for Kids": ["Music", "Painting", "Theater", "Other Arts"],
    "Sports for Kids": ["Swimming", "Football", "Dance", "Gymnastics", "Other Sports"]
  }
};

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
  
  // --- NEW FILTER STATES ---
  const [locationType, setLocationType] = useState('canton'); // 'canton' or 'city'
  const [selectedLocations, setSelectedLocations] = useState([]); // Array of strings
  const [selectedCategory, setSelectedCategory] = useState(null); // String (Subcategory)
  
  const [selectedCourse, setSelectedCourse] = useState(null);
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
                        is_paid: false, 
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

  const fetchTeacherEarnings = async (userId) => {
      try {
          const { data: myCourses } = await supabase
              .from('courses')
              .select('id, title, price')
              .eq('user_id', userId);

          if (!myCourses || myCourses.length === 0) return;
          const courseIds = myCourses.map(c => c.id);

          const { data: bookings } = await supabase
              .from('bookings')
              .select('*, profiles:user_id(full_name, email)')
              .in('course_id', courseIds);

          if (!bookings) return;

          const earningsData = bookings.map(booking => {
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

  // --- NEW: Handle Publish with Hierarchy ---
  const handlePublishCourse = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');

    // We store the most specific category (Subcategory) as the main 'category' field
    // ideally you would add columns for level1 and level2, but for MVP we use the subcategory
    const subCategory = formData.get('subCategory');
    const canton = formData.get('canton');

    const newCourse = {
      title: formData.get('title'),
      instructor_name: user.name,
      price: Number(formData.get('price')),
      rating: 0,
      category: subCategory, 
      canton: canton,
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

  // --- NEW: Complex Filtering Logic ---
  const toggleLocation = (loc) => {
    if (selectedLocations.includes(loc)) {
        setSelectedLocations(selectedLocations.filter(l => l !== loc));
    } else {
        setSelectedLocations([...selectedLocations, loc]);
    }
  };

  const filteredCourses = courses.filter(course => {
    // 1. Text Search
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (course.instructor_name && course.instructor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // 2. Location Filter (If locations are selected, course MUST match one of them)
    // Note: Our DB stores 'canton'. If we search by City, we are doing a text match on address or we need to add a city column.
    // For MVP: We assume the 'canton' field might store "Zürich" which is both a city and canton.
    // Ideally, we'd check both canton field and address field.
    let matchesLocation = true;
    if (selectedLocations.length > 0) {
        // Check if the course's canton is in the selected list OR if the address contains the city name
        matchesLocation = selectedLocations.includes(course.canton) || 
                          selectedLocations.some(loc => course.address && course.address.includes(loc));
    }

    // 3. Category Filter
    // Because we store the Subcategory in the DB, we match against that.
    // If the user selects a top-level category in the filter, we'd need to match all children.
    // For MVP simplified: We will match exact subcategory string.
    let matchesCategory = true;
    if (selectedCategory) {
        matchesCategory = course.category === selectedCategory;
    }

    return matchesSearch && matchesLocation && matchesCategory;
  });

  const calculateDeadline = (startDateString) => {
      if (!startDateString) return null;
      const start = new Date(startDateString);
      const deadline = new Date(start);
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
              <h2 className="text-3xl font-bold text-[#333333] mb-4 font-['Open_Sans']">Payment Successful!</h2>
              <p className="text-gray-600 mb-8 font-['Hind_Madurai']">Thank you for your booking. You will receive a confirmation email shortly.</p>
              <button 
                  onClick={() => {
                      window.history.replaceState({}, document.title, window.location.pathname);
                      setView('dashboard');
                  }} 
                  className="w-full bg-[#FA6E28] text-white py-3 rounded-lg font-bold hover:bg-[#E55D1F] transition font-['Open_Sans']"
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
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: fullName, role: role } }
                });
                
                if (authError) throw authError;

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
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                const userRole = data.user?.user_metadata?.role;
                if (userRole === 'teacher') setView('dashboard');
                else setView('home');
                showNotification("Welcome back!");
            }
        } catch (error) {
            showNotification(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 bg-[#FAF5F0]">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-center font-['Open_Sans'] text-[#333333]">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                <form onSubmit={handleAuth} className="space-y-4 font-['Hind_Madurai']">
                    {isSignUp && (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                                <input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" value={fullName} onChange={e => setFullName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">I am a...</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'student' ? 'bg-[#FFF0EB] border-[#FA6E28] text-[#FA6E28] font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'student'} onChange={() => setRole('student')} />
                                        Student
                                    </label>
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${role === 'teacher' ? 'bg-[#FFF0EB] border-[#FA6E28] text-[#FA6E28] font-bold' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={role === 'teacher'} onChange={() => setRole('teacher')} />
                                        Teacher
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                        <input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                        <input required type="password" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button disabled={loading} type="submit" className="w-full bg-[#FA6E28] text-white py-3 rounded-lg font-bold hover:bg-[#E55D1F] transition disabled:opacity-50 font-['Open_Sans']">
                        {loading ? <Loader className="animate-spin mx-auto" /> : (isSignUp ? "Sign Up" : "Login")}
                    </button>
                </form>
                <p className="text-center text-sm text-gray-600 mt-6 font-['Hind_Madurai']">
                    {isSignUp ? "Already have an account?" : "Don't have an account?"}
                    <button onClick={() => setIsSignUp(!isSignUp)} className="text-[#FA6E28] font-bold ml-2 hover:underline">
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
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
             <KursNaviLogo className="w-10 h-10 mr-3" />
            <span className="font-['Open_Sans'] font-bold text-2xl text-[#333333] tracking-tight">KursNavi</span>
          </div>
          <div className="hidden md:flex items-center space-x-6 font-['Open_Sans']">
            <button onClick={() => setView('home')} className="text-gray-600 hover:text-[#FA6E28] font-semibold">{t.nav_explore}</button>
            <button onClick={() => setView('about')} className="text-gray-600 hover:text-[#FA6E28] font-semibold">{t.nav_about}</button>
            {!user ? (
                <button onClick={() => setView('login')} className="text-gray-600 hover:text-[#FA6E28] font-semibold flex items-center">
                    <LogIn className="w-4 h-4 mr-1" /> {t.nav_login}
                </button>
            ) : (
                <>
                    <button onClick={() => setView('dashboard')} className="text-gray-600 hover:text-[#FA6E28] font-semibold flex items-center">
                        <LayoutDashboard className="w-4 h-4 mr-1" /> {t.nav_dashboard}
                    </button>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 font-semibold text-sm">
                        {t.nav_logout}
                    </button>
                </>
            )}
            <div className="border-l pl-4 ml-4 flex space-x-2 text-sm font-semibold">
                {['en', 'de', 'fr'].map(l => (
                    <button key={l} onClick={() => setLang(l)} className={`${lang === l ? 'text-[#FA6E28] font-bold' : 'text-gray-400'}`}>{l.toUpperCase()}</button>
                ))}
            </div>
          </div>
           <div className="md:hidden flex items-center">
             <button onClick={() => setIsMenuOpen(!isMenuOpen)}><Menu /></button>
          </div>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t p-4 space-y-4 shadow-lg font-['Open_Sans']">
              <button onClick={() => {setView('home'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_explore}</button>
              <button onClick={() => {setView('about'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_about}</button>
              <button onClick={() => {setView('login'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_login}</button>
        </div>
      )}
    </nav>
  );

  const TeacherForm = () => {
    // Local state for the cascading dropdowns
    const [selectedTopLevel, setSelectedTopLevel] = useState("");
    const [selectedOverCategory, setSelectedOverCategory] = useState("");

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Hind_Madurai']">
            <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </button>
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
                <div className="mb-8 border-b pb-4">
                    <h1 className="text-3xl font-bold text-[#333333] font-['Open_Sans']">{t.form_title}</h1>
                    <p className="text-gray-500 mt-2">Share your skills with the community.</p>
                </div>
                
                <form onSubmit={handlePublishCourse} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Course Title</label>
                            <input required type="text" name="title" placeholder="e.g. Traditional Swiss Cooking" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none transition-shadow" />
                        </div>

                        {/* --- NEW CASCADING CATEGORY SELECT --- */}
                        <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Category Classification</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Level 1 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">1. Audience</label>
                                    <select 
                                        required 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none bg-white text-sm"
                                        value={selectedTopLevel}
                                        onChange={(e) => {
                                            setSelectedTopLevel(e.target.value);
                                            setSelectedOverCategory(""); // Reset next levels
                                        }}
                                    >
                                        <option value="">Select...</option>
                                        {Object.keys(CATEGORY_HIERARCHY).map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>

                                {/* Level 2 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">2. Topic</label>
                                    <select 
                                        required 
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none bg-white text-sm"
                                        value={selectedOverCategory}
                                        onChange={(e) => setSelectedOverCategory(e.target.value)}
                                        disabled={!selectedTopLevel}
                                    >
                                        <option value="">Select...</option>
                                        {selectedTopLevel && Object.keys(CATEGORY_HIERARCHY[selectedTopLevel]).map(k => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Level 3 - The one we save */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">3. Specific</label>
                                    <select 
                                        required 
                                        name="subCategory"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none bg-white text-sm"
                                        disabled={!selectedOverCategory}
                                    >
                                        <option value="">Select...</option>
                                        {selectedTopLevel && selectedOverCategory && CATEGORY_HIERARCHY[selectedTopLevel][selectedOverCategory].map(k => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Price (CHF)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500 font-bold">CHF</span>
                                <input required type="number" name="price" placeholder="50" className="w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Canton</label>
                            <div className="relative">
                                <select name="canton" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none appearance-none bg-white">
                                    {CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-3 text-gray-400 w-4 h-4 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Specific Address</label>
                            <input required type="text" name="address" placeholder="Street, City, Zip" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Session Count</label>
                            <input required type="number" name="sessionCount" defaultValue="1" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Session Length</label>
                            <input required type="text" name="sessionLength" placeholder="e.g. 2 hours" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                <input required type="date" name="startDate" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">When does the first session begin?</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Provider Website (Optional)</label>
                            <div className="relative">
                                <ExternalLink className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                <input type="url" name="providerUrl" placeholder="https://..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                        <textarea required name="description" rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" placeholder="Describe your course..."></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">What will students learn?</label>
                        <textarea required name="objectives" rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" placeholder="Enter each objective on a new line..."></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Prerequisites</label>
                        <input type="text" name="prerequisites" placeholder="e.g. Beginners welcome, bring a laptop" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FA6E28] outline-none" />
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                        <button type="submit" className="bg-[#FA6E28] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#E55D1F] shadow-lg hover:-translate-y-0.5 transition flex items-center font-['Open_Sans']">
                            <KursNaviLogo className="w-5 h-5 mr-2 text-white" />
                            {t.btn_publish}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF5F0] font-sans text-[#333333] selection:bg-orange-100 selection:text-[#FA6E28] flex flex-col font-['Hind_Madurai']">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hind+Madurai:wght@300;400;500;600&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {notification && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-[#333333] text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-bounce font-['Open_Sans']">
          <CheckCircle className="w-5 h-5 mr-2 text-[#FA6E28]" />
          {notification}
        </div>
      )}

      <Navbar />

      <div className="flex-grow">
      {view === 'home' && (
        <>
          <div className="bg-white text-[#333333] py-16 px-4">
              <div className="max-w-4xl mx-auto text-center space-y-6">
                 <div className="flex justify-center mb-6">
                    <KursNaviLogo className="w-24 h-24" />
                 </div>
                 <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-['Open_Sans'] text-[#FA6E28]">{t.hero_title}</h1>
                 <p className="text-xl text-gray-500 max-w-2xl mx-auto">{t.hero_subtitle}</p>
              </div>
          </div>

           {/* --- NEW FILTER BAR --- */}
           <div className="bg-white border-b sticky top-20 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
                {/* Row 1: Search & Toggle */}
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-grow w-full md:w-auto max-w-lg">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input type="text" placeholder={t.search_placeholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#FAF5F0] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FA6E28] focus:bg-white transition-colors" />
                    </div>
                    
                    {/* Location Toggle */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button 
                            onClick={() => { setLocationType('canton'); setSelectedLocations([]); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${locationType === 'canton' ? 'bg-white text-[#FA6E28] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Cantons
                        </button>
                        <button 
                            onClick={() => { setLocationType('city'); setSelectedLocations([]); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${locationType === 'city' ? 'bg-white text-[#FA6E28] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Cities
                        </button>
                    </div>

                    {/* Category Reset */}
                    {selectedCategory && (
                        <button onClick={() => setSelectedCategory(null)} className="flex items-center text-sm text-[#FA6E28] hover:underline font-bold">
                            <X className="w-4 h-4 mr-1" /> Clear Category
                        </button>
                    )}
                </div>

                {/* Row 2: Location Pills (Horizontal Scroll) */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    <span className="flex-shrink-0 flex items-center text-sm font-bold text-gray-500 mr-2">
                        <MapPin className="w-4 h-4 mr-1" />
                        {locationType === 'canton' ? 'Select Cantons:' : 'Select Cities:'}
                    </span>
                    {(locationType === 'canton' ? CANTONS : CITIES).map(loc => (
                        <button 
                            key={loc} 
                            onClick={() => toggleLocation(loc)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors border ${selectedLocations.includes(loc) ? 'bg-[#333333] text-white border-[#333333]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#FA6E28]'}`}
                        >
                            {loc}
                        </button>
                    ))}
                </div>

                {/* Row 3: Category Hierachy Pills */}
                <div className="border-t border-gray-100 pt-3">
                   <div className="flex items-center gap-2 mb-2">
                        <Filter className="w-4 h-4 text-[#FA6E28]" />
                        <span className="text-sm font-bold text-gray-500">Browse Categories:</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(CATEGORY_HIERARCHY).map(([topLevel, midLevels]) => (
                            <div key={topLevel}>
                                <h4 className="font-bold text-[#333333] text-xs uppercase mb-2">{topLevel}</h4>
                                <div className="space-y-3">
                                    {Object.entries(midLevels).map(([mid, subCats]) => (
                                        <div key={mid} className="group">
                                            <span className="text-sm font-semibold text-gray-700 block mb-1">{mid}</span>
                                            <div className="flex flex-wrap gap-1">
                                                {subCats.map(sub => (
                                                    <button 
                                                        key={sub}
                                                        onClick={() => setSelectedCategory(selectedCategory === sub ? null : sub)}
                                                        className={`text-xs px-2 py-1 rounded transition-colors ${selectedCategory === sub ? 'bg-[#FA6E28] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                                    >
                                                        {sub}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
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
                        <MapPin className="w-3 h-3 mr-1 text-[#FA6E28]" />
                        {course.canton}
                        </div>
                    </div>
                    <div className="p-5">
                        <h3 className="font-bold text-lg text-[#333333] leading-tight line-clamp-2 h-12 mb-2 font-['Open_Sans']">{course.title}</h3>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                           <div className="flex items-center space-x-3 text-sm text-gray-500">
                                <div className="flex items-center bg-[#FAF5F0] px-2 py-1 rounded">
                                    <User className="w-3 h-3 text-gray-500 mr-1" />
                                    {course.instructor_name}
                                </div>
                           </div>
                           <span className="font-bold text-[#FA6E28] text-lg font-['Open_Sans']">{t.currency} {course.price}</span>
                        </div>
                         {/* Display Category Tag */}
                         <div className="mt-2 text-xs text-gray-400 bg-gray-50 inline-block px-2 py-0.5 rounded">
                             {course.category}
                         </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300"><p className="text-gray-500 text-lg font-medium">{t.no_results}</p></div>}
          </main>
        </>
      )}

      {/* OTHER VIEWS REMAIN UNCHANGED IN STRUCTURE BUT INCLUDED HERE */}
      {view === 'success' && <SuccessView />}
      {view === 'detail' && selectedCourse && (
         <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in duration-500 font-['Hind_Madurai']">
            <button onClick={() => setView('home')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to courses
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="relative rounded-2xl overflow-hidden shadow-lg h-80">
                    <img src={selectedCourse.image_url} alt={selectedCourse.title} className="w-full h-full object-cover" />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-bold text-gray-800 flex items-center shadow-sm">
                        <MapPin className="w-4 h-4 mr-1 text-[#FA6E28]" /> {selectedCourse.canton}
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold text-[#333333] mb-3 font-['Open_Sans']">{selectedCourse.title}</h1>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center"><User className="w-4 h-4 mr-1" /> {selectedCourse.instructor_name}</span>
                        <span className="flex items-center text-[#FA6E28] bg-[#FFF0EB] px-2 py-0.5 rounded-full font-bold">{selectedCourse.category}</span>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <div>
                        <h3 className="text-xl font-bold mb-3 text-[#333333] font-['Open_Sans']">{t.lbl_description}</h3>
                        <p className="text-gray-600 leading-relaxed text-lg">{selectedCourse.description}</p>
                    </div>
                    {selectedCourse.objectives && (
                        <div>
                            <h3 className="text-xl font-bold mb-3 text-[#333333] font-['Open_Sans']">{t.lbl_objectives}</h3>
                            <ul className="space-y-2">
                                {selectedCourse.objectives.map((obj, i) => (
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
                    <span className="text-4xl font-extrabold text-[#333333] block mb-1 font-['Open_Sans']">{t.currency} {selectedCourse.price}</span>
                    <span className="text-sm text-gray-500 block mb-4">per person</span>
                    <button onClick={() => handleBookCourse(selectedCourse)} className="w-full bg-[#FA6E28] text-white py-4 rounded-xl font-bold hover:bg-[#E55D1F] transition shadow-md active:scale-95 font-['Open_Sans']">
                        {t.btn_pay}
                    </button>
                </div>
                {selectedCourse.start_date && (
                    <div className="mb-6 pb-6 border-b border-gray-100">
                        <div className="flex items-center text-[#FA6E28] font-bold mb-1">
                            <Calendar className="w-5 h-5 mr-2" />
                            <span>Start Date</span>
                        </div>
                        <div className="text-xl font-bold text-[#333333] ml-7">
                        {new Date(selectedCourse.start_date).toLocaleDateString('en-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                            <span className="text-gray-700 font-medium">{selectedCourse.address || selectedCourse.canton}</span>
                        </div>
                    </div>
                    {selectedCourse.session_count && (
                        <div className="flex items-start">
                            <div className="w-8 flex-shrink-0">
                                <Clock className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_duration}</span>
                                <span className="text-gray-700 font-medium">{selectedCourse.session_count} {t.lbl_sessions} × {selectedCourse.session_length}</span>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </div>
            </div>
        </div>
      )}
      {view === 'login' && <AuthView />}
      {view === 'about' && (
          // Re-inserting simple About Page component content here to keep file self-contained
          <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500 font-['Hind_Madurai']">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-extrabold text-[#333333] mb-4 font-['Open_Sans']">{t.about_title}</h1>
                <p className="text-xl text-gray-500">{t.about_subtitle}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-12">
                <img src="https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?auto=format&fit=crop&q=80&w=1200" alt="Swiss Landscape" className="w-full h-64 object-cover" />
                <div className="p-8 space-y-6">
                    <p className="text-lg text-gray-700 leading-relaxed">{t.about_text}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                        <div className="flex items-start">
                            <Heart className="w-8 h-8 text-[#FA6E28] mr-4 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-[#333333] mb-1 font-['Open_Sans']">{t.about_community_title}</h3>
                                <p className="text-gray-600">{t.about_community_text}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Shield className="w-8 h-8 text-[#FA6E28] mr-4 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-[#333333] mb-1 font-['Open_Sans']">{t.about_quality_title}</h3>
                                <p className="text-gray-600">{t.about_quality_text}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
      {view === 'contact' && (
          // Re-inserting simple Contact Page component content here to keep file self-contained
          <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500 font-['Hind_Madurai']">
            <h1 className="text-4xl font-extrabold text-[#333333] mb-8 text-center font-['Open_Sans']">{t.contact_title}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <div className="bg-[#FFF0EB] p-6 rounded-2xl border border-orange-100">
                        <h3 className="font-bold text-lg mb-4 text-[#FA6E28] font-['Open_Sans']">{t.contact_get_in_touch}</h3>
                        <div className="space-y-4">
                            <div className="flex items-center text-gray-700"><Mail className="w-5 h-5 mr-3 text-[#FA6E28]" /><span>support@kursnavi.ch</span></div>
                            <div className="flex items-center text-gray-700"><Phone className="w-5 h-5 mr-3 text-[#FA6E28]" /><span>+41 44 123 45 67</span></div>
                            <div className="flex items-start text-gray-700"><MapPin className="w-5 h-5 mr-3 text-[#FA6E28] mt-1" /><span>KursNavi AG<br/>Bahnhofstrasse 100<br/>8001 Zürich</span></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                        <div><input required type="text" className="w-full px-4 py-2 border rounded-lg" placeholder={t.contact_lbl_name} /></div>
                        <div><input required type="email" className="w-full px-4 py-2 border rounded-lg" placeholder="you@example.com" /></div>
                        <div><textarea required rows="4" className="w-full px-4 py-2 border rounded-lg" placeholder="..."></textarea></div>
                        <button type="submit" className="w-full bg-[#FA6E28] text-white py-3 rounded-lg font-bold">{t.btn_send}</button>
                    </form>
                </div>
            </div>
        </div>
      )}
      {view === 'dashboard' && user && (
        // DASHBOARD COMPONENT LOGIC INLINE
        <div className="max-w-6xl mx-auto px-4 py-8 font-['Hind_Madurai']">
            <h1 className="text-3xl font-bold text-[#333333] mb-8 font-['Open_Sans']">{user.role === 'teacher' ? t.teacher_dash : t.student_dash}</h1>
            
            {user.role === 'teacher' ? (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                     <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center">
                         <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4"><DollarSign className="text-green-600" /></div>
                         <div><p className="text-sm text-gray-500">Payouts</p><p className="text-2xl font-bold text-[#333333]">CHF {teacherEarnings.filter(e => e.isPaidOut).reduce((sum, e) => sum + e.payout, 0).toFixed(2)}</p></div>
                     </div>
                     <div className="col-span-3">
                        <button onClick={() => setView('create')} className="bg-[#FA6E28] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#E55D1F] flex items-center shadow-lg"><KursNaviLogo className="mr-2 w-5 h-5 text-white" /> New Course</button>
                        <div className="mt-8">
                             <h2 className="text-xl font-bold mb-4">My Courses</h2>
                             {courses.filter(c => c.user_id === user.id).map(course => (
                                 <div key={course.id} className="bg-white p-4 rounded-xl border mb-2 flex justify-between items-center">
                                     <span className="font-bold">{course.title}</span>
                                     <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500"><Trash2 /></button>
                                 </div>
                             ))}
                        </div>
                     </div>
                 </div>
            ) : (
                <div className="space-y-4">
                    {myBookings.map(course => {
                        const canCancel = course.start_date ? new Date() < calculateDeadline(course.start_date) : true;
                        return (
                            <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                                <img src={course.image_url} className="w-20 h-20 rounded-lg object-cover" />
                                <div className="flex-grow">
                                    <h3 className="font-bold text-[#333333]">{course.title}</h3>
                                    <p className="text-sm text-gray-500">{course.instructor_name} • {course.canton}</p>
                                    {canCancel ? (
                                        <button onClick={() => handleCancelBooking(course.id, course.title)} className="text-red-500 text-sm mt-2 font-bold hover:underline">Cancel Booking</button>
                                    ) : <span className="text-xs text-gray-400 mt-2 block"><Lock className="inline w-3 h-3"/> Non-refundable</span>}
                                </div>
                            </div>
                        );
                    })}
                    {myBookings.length === 0 && <p className="text-gray-500">No bookings yet.</p>}
                </div>
            )}
        </div>
      )}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm />}
      {view === 'terms' && <div className="max-w-4xl mx-auto p-12"><h1 className="text-2xl font-bold">Terms & Conditions</h1><p>Placeholder for legal text.</p></div>}
      {view === 'privacy' && <div className="max-w-4xl mx-auto p-12"><h1 className="text-2xl font-bold">Privacy Policy</h1><p>Placeholder for legal text.</p></div>}
      {view === 'admin' && <div className="max-w-4xl mx-auto p-12"><h1 className="text-2xl font-bold">Admin Panel</h1><p>Placeholder.</p></div>}
      </div>
    
      <footer className="bg-white border-t border-gray-200 py-12 mt-auto font-['Hind_Madurai']">
        <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div>
                    <div className="flex items-center mb-4">
                        <KursNaviLogo className="w-8 h-8 mr-2" />
                        <span className="font-bold text-xl text-[#333333] font-['Open_Sans']">KursNavi</span>
                    </div>
                    <p className="text-sm text-gray-500">{t.about_subtitle}</p>
                </div>
                <div>
                    <h4 className="font-bold text-[#333333] mb-4 font-['Open_Sans']">Platform</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li><button onClick={() => setView('home')} className="hover:text-[#FA6E28]">Home</button></li>
                        <li><button onClick={() => setView('about')} className="hover:text-[#FA6E28]">{t.nav_about}</button></li>
                        <li><button onClick={() => setView('contact')} className="hover:text-[#FA6E28]">{t.nav_contact}</button></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-[#333333] mb-4 font-['Open_Sans']">Legal</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li><button onClick={() => setView('terms')} className="hover:text-[#FA6E28]">{t.footer_terms}</button></li>
                        <li><button onClick={() => setView('privacy')} className="hover:text-[#FA6E28]">{t.footer_privacy}</button></li>
                        <li><button onClick={() => setView('contact')} className="hover:text-[#FA6E28]">{t.footer_legal}</button></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-[#333333] mb-4 font-['Open_Sans']">Admin</h4>
                      <button onClick={() => setView('admin')} className="text-sm text-gray-500 hover:text-[#FA6E28] flex items-center">
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