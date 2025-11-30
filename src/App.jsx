import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, User, Clock, MapPin, Menu, PlusCircle, CheckCircle, ArrowLeft, Globe, LogIn, LayoutDashboard, Settings, Trash2, DollarSign, BarChart, Lock, Calendar, ExternalLink, ChevronDown, ChevronUp, Info, X, Heart, Shield, Mail, Phone } from 'lucide-react';

// --- 1. Supabase Setup ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Localization Data ---
const TRANSLATIONS = {
  en: {
    nav_explore: "Explore",
    nav_about: "About Us",
    nav_contact: "Contact",
    nav_login: "Login",
    nav_logout: "Logout",
    nav_dashboard: "Dashboard",
    hero_title: "Discover courses near you.",
    hero_subtitle: "From yodeling in Appenzell to coding in Zürich. Learn locally.",
    search_placeholder: "What do you want to learn?",
    filter_all_cantons: "All Switzerland",
    filter_all_categories: "All Categories",
    no_results: "No courses found matching criteria.",
    btn_book: "Book Course",
    btn_publish: "Publish Course",
    btn_send: "Send Message",
    form_title: "List a Course",
    success_msg: "Grüezi! Action successful.",
    currency: "CHF",
    admin_panel: "Admin Control Center",
    teacher_dash: "Teacher Dashboard",
    student_dash: "My Learning",
    login_title: "Welcome Back",
    my_bookings: "My Bookings",
    login_as_student: "Login as Student",
    login_as_teacher: "Login as Teacher",
    admin_login_title: "Admin Access",
    footer_terms: "Terms & Conditions",
    footer_privacy: "Data Protection",
    footer_legal: "Legal Notice",
    footer_madein: "Made in Switzerland",
    footer_rights: "All rights reserved.",
    lbl_objectives: "What you will learn",
    lbl_prerequisites: "Prerequisites",
    lbl_description: "About this course",
    lbl_address: "Location",
    lbl_duration: "Duration",
    lbl_sessions: "sessions",
    lbl_upcoming: "Upcoming Editions",
    lbl_provider: "Provider",
    lbl_show_more: "Show more dates",
    lbl_show_less: "Show less",
    about_title: "About KursNavi",
    about_subtitle: "Connecting Switzerland through knowledge and skills.",
    about_text: "KursNavi was born from a simple idea: everyone has something to teach, and everyone has something to learn. In a country as diverse as Switzerland, with its rich tapestry of languages and cultures, we wanted to build a bridge between local experts and eager students.",
    about_community_title: "Community First",
    about_community_text: "We prioritize local connections. Your yoga teacher might be your neighbor, and your coding instructor might live just a canton away.",
    about_quality_title: "Swiss Quality",
    about_quality_text: "We verify our hosts and ensure that listings meet a high standard of clarity and transparency.",
    contact_title: "Contact Us",
    contact_get_in_touch: "Get in Touch",
    contact_office_hours: "Office Hours",
    contact_mon_fri: "Monday - Friday: 09:00 - 17:00",
    contact_weekend: "Weekends: Closed",
    contact_lbl_name: "Name",
    contact_lbl_email: "Email",
    contact_lbl_msg: "Message",
    terms_title: "Terms & Conditions",
    terms_last_updated: "Last Updated: October 2024",
    terms_1_title: "1. Scope of Application",
    terms_1_text: "These General Terms and Conditions (GTC) apply to the use of the KursNavi platform. By using the platform, you agree to these terms.",
    terms_2_title: "2. Service Description",
    terms_2_text: "KursNavi operates as an intermediary platform connecting independent course providers ('Teachers') with learners ('Students'). KursNavi is not the contracting party for the courses offered; contracts are formed directly between the Teacher and the Student.",
    terms_3_title: "3. User Obligations",
    terms_3_text: "Users are obliged to provide truthful information. Teachers are responsible for ensuring they have the necessary rights and qualifications to offer their courses.",
    terms_4_title: "4. Cancellations and Refunds",
    terms_4_text: "Cancellation policies are set by individual Teachers. However, KursNavi guarantees a full refund if a course is cancelled by the Teacher. Student cancellations made less than 24 hours before the course start may not be eligible for a refund.",
    terms_5_title: "5. Liability",
    terms_5_text: "KursNavi accepts no liability for the content or quality of the courses conducted. Liability for slight negligence is excluded.",
    privacy_title: "Data Protection Guidelines",
    privacy_compliant: "Compliant with the Swiss Federal Act on Data Protection (FADP) and GDPR.",
    privacy_1_title: "1. Data Controller",
    privacy_1_text: "KursNavi AG, Bahnhofstrasse 100, 8001 Zürich is responsible for data processing on this website.",
    privacy_2_title: "2. Data Collection",
    privacy_2_text: "We collect personal data that you provide to us (e.g., when registering, booking a course, or contacting us). This includes name, email address, payment information, and course preferences.",
    privacy_3_title: "3. Purpose of Processing",
    privacy_3_text: "Your data is processed to facilitate course bookings, manage user accounts, improving our platform, and for legal compliance.",
    privacy_4_title: "4. Data Sharing",
    privacy_4_text: "We only share necessary data with Teachers (e.g., student name for attendance) or payment processors. We do not sell your data to third parties.",
    privacy_5_title: "5. Your Rights",
    privacy_5_text: "You have the right to access, correct, or delete your personal data. Please contact privacy@kursnavi.ch for any requests.",
  },
  de: {
    nav_explore: "Entdecken",
    nav_about: "Über uns",
    nav_contact: "Kontakt",
    nav_login: "Anmelden",
    nav_logout: "Abmelden",
    nav_dashboard: "Dashboard",
    hero_title: "Finde Kurse in deiner Nähe.",
    hero_subtitle: "Vom Jodeln im Appenzell bis zum Programmieren in Zürich.",
    search_placeholder: "Was möchtest du lernen?",
    filter_all_cantons: "Ganze Schweiz",
    filter_all_categories: "Alle Kategorien",
    no_results: "Keine Kurse gefunden.",
    btn_book: "Kurs buchen",
    btn_publish: "Veröffentlichen",
    btn_send: "Nachricht senden",
    form_title: "Kurs anbieten",
    success_msg: "Grüezi! Aktion erfolgreich.",
    currency: "CHF",
    admin_panel: "Admin Konsole",
    teacher_dash: "Lehrer Dashboard",
    student_dash: "Meine Kurse",
    login_title: "Willkommen zurück",
    my_bookings: "Meine Buchungen",
    login_as_student: "Als Schüler anmelden",
    login_as_teacher: "Als Lehrer anmelden",
    admin_login_title: "Admin Zugang",
    footer_terms: "AGB",
    footer_privacy: "Datenschutz",
    footer_legal: "Impressum",
    footer_madein: "Hergestellt in der Schweiz",
    footer_rights: "Alle Rechte vorbehalten.",
    lbl_objectives: "Was du lernen wirst",
    lbl_prerequisites: "Voraussetzungen",
    lbl_description: "Über diesen Kurs",
    lbl_address: "Standort",
    lbl_duration: "Dauer",
    lbl_sessions: "Sitzungen",
    lbl_upcoming: "Nächste Termine",
    lbl_provider: "Anbieter",
    lbl_show_more: "Mehr Termine",
    lbl_show_less: "Weniger anzeigen",
    about_title: "Über KursNavi",
    about_subtitle: "Die Schweiz durch Wissen und Fähigkeiten verbinden.",
    about_text: "KursNavi entstand aus einer einfachen Idee: Jeder hat etwas zu lehren, und jeder hat etwas zu lernen. In einem Land, das so vielfältig ist wie die Schweiz, mit ihrem Reichtum an Sprachen und Kulturen, wollten wir eine Brücke zwischen lokalen Experten und wissbegierigen Schülern bauen.",
    about_community_title: "Gemeinschaft zuerst",
    about_community_text: "Wir priorisieren lokale Verbindungen. Dein Yogalehrer könnte dein Nachbar sein, und dein Programmierlehrer wohnt vielleicht nur einen Kanton weiter.",
    about_quality_title: "Schweizer Qualität",
    about_quality_text: "Wir überprüfen unsere Gastgeber und stellen sicher, dass die Angebote einem hohen Standard an Klarheit und Transparenz entsprechen.",
    contact_title: "Kontakt",
    contact_get_in_touch: "Schreib uns",
    contact_office_hours: "Öffnungszeiten",
    contact_mon_fri: "Montag - Freitag: 09:00 - 17:00",
    contact_weekend: "Wochenende: Geschlossen",
    contact_lbl_name: "Name",
    contact_lbl_email: "E-Mail",
    contact_lbl_msg: "Nachricht",
    terms_title: "Allgemeine Geschäftsbedingungen",
    terms_last_updated: "Stand: Oktober 2024",
    terms_1_title: "1. Geltungsbereich",
    terms_1_text: "Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Plattform KursNavi. Durch die Nutzung der Plattform stimmen Sie diesen Bedingungen zu.",
    terms_2_title: "2. Leistungsbeschreibung",
    terms_2_text: "KursNavi betreibt eine Vermittlungsplattform, die unabhängige Kursanbieter ('Lehrer') mit Lernenden ('Schülern') verbindet. KursNavi ist nicht Vertragspartner für die angebotenen Kurse; Verträge kommen direkt zwischen Lehrer und Schüler zustande.",
    terms_3_title: "3. Pflichten der Nutzer",
    terms_3_text: "Nutzer sind verpflichtet, wahrheitsgemäße Angaben zu machen. Lehrer sind dafür verantwortlich, dass sie über die notwendigen Rechte und Qualifikationen verfügen, um ihre Kurse anzubieten.",
    terms_4_title: "4. Stornierungen und Rückerstattungen",
    terms_4_text: "Stornierungsbedingungen werden von den einzelnen Lehrern festgelegt. KursNavi garantiert jedoch eine volle Rückerstattung, wenn ein Kurs vom Lehrer abgesagt wird. Stornierungen durch Schüler weniger als 24 Stunden vor Kursbeginn sind möglicherweise nicht erstattungsfähig.",
    terms_5_title: "5. Haftung",
    terms_5_text: "KursNavi übernimmt keine Haftung für den Inhalt oder die Qualität der durchgeführten Kurse. Die Haftung für leichte Fahrlässigkeit wird ausgeschlossen.",
    privacy_title: "Datenschutzrichtlinien",
    privacy_compliant: "Konform mit dem Schweizer Bundesgesetz über den Datenschutz (DSG) und der DSGVO.",
    privacy_1_title: "1. Datenverantwortlicher",
    privacy_1_text: "KursNavi AG, Bahnhofstrasse 100, 8001 Zürich ist verantwortlich für die Datenverarbeitung auf dieser Website.",
    privacy_2_title: "2. Datenerfassung",
    privacy_2_text: "Wir erfassen personenbezogene Daten, die Sie uns zur Verfügung stellen (z. B. bei der Registrierung, Kursbuchung oder Kontaktaufnahme). Dazu gehören Name, E-Mail-Adresse, Zahlungsinformationen und Kurspräferenzen.",
    privacy_3_title: "3. Zweck der Verarbeitung",
    privacy_3_text: "Ihre Daten werden verarbeitet, um Kursbuchungen zu ermöglichen, Benutzerkonten zu verwalten, unsere Plattform zu verbessern und gesetzliche Vorgaben zu erfüllen.",
    privacy_4_title: "4. Datenweitergabe",
    privacy_4_text: "Wir geben nur notwendige Daten an Lehrer (z. B. Schülername für Anwesenheit) oder Zahlungsabwickler weiter. Wir verkaufen Ihre Daten nicht an Dritte.",
    privacy_5_title: "5. Ihre Rechte",
    privacy_5_text: "Sie haben das Recht auf Auskunft, Berichtigung oder Löschung Ihrer personenbezogenen Daten. Bitte kontaktieren Sie privacy@kursnavi.ch für Anfragen.",
  },
  fr: {
    nav_explore: "Explorer",
    nav_about: "À propos",
    nav_contact: "Contact",
    nav_login: "Connexion",
    nav_logout: "Déconnexion",
    nav_dashboard: "Tableau de bord",
    hero_title: "Découvrez des cours près de chez vous.",
    hero_subtitle: "Apprenez localement, du yodel au codage.",
    search_placeholder: "Que voulez-vous apprendre ?",
    filter_all_cantons: "Toute la Suisse",
    filter_all_categories: "Toutes catégories",
    no_results: "Aucun cours trouvé.",
    btn_book: "Réserver",
    btn_publish: "Publier",
    btn_send: "Envoyer le message",
    form_title: "Proposer un cours",
    success_msg: "Bonjour! Action réussie.",
    currency: "CHF",
    admin_panel: "Panneau Admin",
    teacher_dash: "Tableau de bord",
    student_dash: "Mes apprentissages",
    login_title: "Bienvenue",
    my_bookings: "Mes réservations",
    login_as_student: "Connexion Étudiant",
    login_as_teacher: "Connexion Enseignant",
    admin_login_title: "Accès Admin",
    footer_terms: "CGV",
    footer_privacy: "Protection des données",
    footer_legal: "Mentions légales",
    footer_madein: "Fabriqué en Suisse",
    footer_rights: "Tous droits réservés.",
    lbl_objectives: "Ce que vous apprendrez",
    lbl_prerequisites: "Prérequis",
    lbl_description: "À propos de ce cours",
    lbl_address: "Lieu",
    lbl_duration: "Durée",
    lbl_sessions: "séances",
    lbl_upcoming: "Prochaines sessions",
    lbl_provider: "Fournisseur",
    lbl_show_more: "Voir plus de dates",
    lbl_show_less: "Voir moins",
    about_title: "À propos de KursNavi",
    about_subtitle: "Relier la Suisse par le savoir et les compétences.",
    about_text: "KursNavi est né d'une idée simple : tout le monde a quelque chose à enseigner et tout le monde a quelque chose à apprendre. Dans un pays aussi diversifié que la Suisse, riche de ses langues et de ses cultures, nous voulions jeter un pont entre les experts locaux et les étudiants avides de savoir.",
    about_community_title: "La communauté d'abord",
    about_community_text: "Nous privilégions les liens locaux. Votre professeur de yoga pourrait être votre voisin, et votre instructeur de codage pourrait vivre juste dans le canton d'à côté.",
    about_quality_title: "Qualité Suisse",
    about_quality_text: "Nous vérifions nos hôtes et nous assurons que les annonces répondent à un standard élevé de clarté et de transparence.",
    contact_title: "Contactez-nous",
    contact_get_in_touch: "Prendre contact",
    contact_office_hours: "Heures d'ouverture",
    contact_mon_fri: "Lundi - Vendredi : 09:00 - 17:00",
    contact_weekend: "Week-end : Fermé",
    contact_lbl_name: "Nom",
    contact_lbl_email: "E-mail",
    contact_lbl_msg: "Message",
    terms_title: "Conditions Générales de Vente",
    terms_last_updated: "Dernière mise à jour : Octobre 2024",
    terms_1_title: "1. Champ d'application",
    terms_1_text: "Les présentes Conditions Générales (CG) s'appliquent à l'utilisation de la plateforme KursNavi. En utilisant la plateforme, vous acceptez ces conditions.",
    terms_2_title: "2. Description du service",
    terms_2_text: "KursNavi fonctionne comme une plateforme intermédiaire reliant des prestataires de cours indépendants ('Enseignants') à des apprenants ('Étudiants'). KursNavi n'est pas la partie contractante pour les cours proposés ; les contrats sont conclus directement entre l'Enseignant et l'Étudiant.",
    terms_3_title: "3. Obligations des utilisateurs",
    terms_3_text: "Les utilisateurs sont tenus de fournir des informations véridiques. Les enseignants sont responsables de s'assurer qu'ils disposent des droits et qualifications nécessaires pour proposer leurs cours.",
    terms_4_title: "4. Annulations et remboursements",
    terms_4_text: "Les politiques d'annulation sont définies par chaque Enseignant. Toutefois, KursNavi garantit un remboursement intégral si un cours est annulé par l'Enseignant. Les annulations par les étudiants effectuées moins de 24 heures avant le début du cours peuvent ne pas être remboursables.",
    terms_5_title: "5. Responsabilité",
    terms_5_text: "KursNavi décline toute responsabilité quant au contenu ou à la qualité des cours dispensés. La responsabilité pour négligence légère est exclue.",
    privacy_title: "Politique de confidentialité",
    privacy_compliant: "Conforme à la Loi fédérale sur la protection des données (LPD) et au RGPD.",
    privacy_1_title: "1. Responsable du traitement",
    privacy_1_text: "KursNavi AG, Bahnhofstrasse 100, 8001 Zurich est responsable du traitement des données sur ce site web.",
    privacy_2_title: "2. Collecte de données",
    privacy_2_text: "Nous collectons les données personnelles que vous nous fournissez (par exemple, lors de l'inscription, de la réservation d'un cours ou d'une prise de contact). Cela inclut le nom, l'adresse e-mail, les informations de paiement et les préférences de cours.",
    privacy_3_title: "3. Finalité du traitement",
    privacy_3_text: "Vos données sont traitées pour faciliter les réservations de cours, gérer les comptes utilisateurs, améliorer notre plateforme et respecter les obligations légales.",
    privacy_4_title: "4. Partage des données",
    privacy_4_text: "Nous ne partageons que les données nécessaires avec les Enseignants (par exemple, le nom de l'étudiant pour la présence) ou les processeurs de paiement. Nous ne vendons pas vos données à des tiers.",
    privacy_5_title: "5. Vos droits",
    privacy_5_text: "Vous avez le droit d'accéder, de corriger ou de supprimer vos données personnelles. Veuillez contacter privacy@kursnavi.ch pour toute demande.",
  }
};

// --- Initial Data (Filters only) ---
const INITIAL_CANTONS = ["Zürich", "Bern", "Luzern", "Genève", "Basel-Stadt", "Vaud", "Zug", "Ticino", "St. Gallen"];
const INITIAL_CATEGORIES = ["Cooking", "Photography", "Languages", "Lifestyle", "Sports", "Tech", "Art"];

export default function KursNaviPro() {
  const [lang, setLang] = useState('en');
  const [view, setView] = useState('home'); 
  const [user, setUser] = useState(null); 
  const [adminPassword, setAdminPassword] = useState("");
  
  // App State
  const [courses, setCourses] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [cantons, setCantons] = useState(INITIAL_CANTONS);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeCanton, setActiveCanton] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const t = TRANSLATIONS[lang];

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

  // --- Actions ---
  const login = (role) => {
    if (role === 'teacher') setUser({ id: 'teacher', name: 'Martha S.', role: 'teacher' });
    if (role === 'student') setUser({ id: 'student', name: 'Alex M.', role: 'student' });
    setView('dashboard');
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === 'admin') {
      setUser({ id: 'admin1', name: 'Admin User', role: 'admin' });
      setView('admin');
      setAdminPassword("");
    } else {
      showNotification("Incorrect Password");
    }
  };

  const logout = () => {
    setUser(null);
    setView('home');
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
    
    // Convert newlines to array
    const objectivesList = formData.get('objectives').split('\n').filter(line => line.trim() !== '');

    const newCourse = {
      title: formData.get('title'),
      instructor_name: user.name,
      price: Number(formData.get('price')),
      rating: 0, // Default to 0, but not shown in UI
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
      user_id: user.id
    };
    
    const { data, error } = await supabase.from('courses').insert([newCourse]).select();

    if (error) {
        console.error(error);
        showNotification("Error publishing course");
    } else {
        if (data && data.length > 0) {
            setCourses([data[0], ...courses]);
        } else {
            fetchCourses();
        }
        setView('dashboard');
        showNotification(t.success_msg);
    }
  };

  const handleBookCourse = (course) => {
      if (!user) {
          setView('login');
          return;
      }
      showNotification(`Booked ${course.title}!`);
  };

  const handleContactSubmit = (e) => {
      e.preventDefault();
      showNotification("Message sent! We'll get back to you soon.");
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

  // --- Helper Components ---
  const EditionList = ({ editions }) => {
    // Mock editions if none exist in DB yet
    const displayEditions = editions || [
        { start: "2024-12-01", end: "2024-12-08" },
        { start: "2025-01-10", end: "2025-01-17" }
    ];
    
    const [expanded, setExpanded] = useState(false);
    const visibleEditions = expanded ? displayEditions : displayEditions.slice(0, 3);

    return (
        <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2 text-sm">{t.lbl_upcoming}</h4>
            <div className="space-y-2">
                {visibleEditions.map((ed, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded border border-gray-100">
                        <span className="font-medium text-gray-700">{ed.start}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-600">{ed.end}</span>
                    </div>
                ))}
            </div>
            {displayEditions.length > 3 && (
                <button 
                    onClick={() => setExpanded(!expanded)} 
                    className="flex items-center text-red-600 text-xs font-bold mt-2 hover:underline"
                >
                    {expanded ? t.lbl_show_less : t.lbl_show_more}
                    {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </button>
            )}
        </div>
    );
  };

  // --- Main Layout Components ---
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
            <button onClick={() => setView('contact')} className="text-gray-600 hover:text-red-600 font-medium">{t.nav_contact}</button>
            
            {!user ? (
                <button onClick={() => setView('login')} className="text-gray-600 hover:text-red-600 font-medium flex items-center">
                    <LogIn className="w-4 h-4 mr-1" /> {t.nav_login}
                </button>
            ) : (
                <>
                    <button onClick={() => setView(user.role === 'admin' ? 'admin' : 'dashboard')} className="text-gray-600 hover:text-red-600 font-medium flex items-center">
                        <LayoutDashboard className="w-4 h-4 mr-1" /> {t.nav_dashboard}
                    </button>
                    <button onClick={logout} className="text-gray-400 hover:text-gray-600 font-medium text-sm">
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
             <button onClick={() => {setView('contact'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_contact}</button>
             <button onClick={() => {setView('login'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">{t.nav_login}</button>
        </div>
      )}
    </nav>
  );

  // --- Pages ---
  const AboutPage = () => (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in duration-500">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t.about_title}</h1>
            <p className="text-xl text-gray-500">{t.about_subtitle}</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-12">
            <img src="https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?auto=format&fit=crop&q=80&w=1200" alt="Swiss Landscape" className="w-full h-64 object-cover" />
            <div className="p-8 space-y-6">
                <p className="text-lg text-gray-700 leading-relaxed">
                    {t.about_text}
                </p>
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

  const TeacherForm = () => (
    <div className="max-w-3xl mx-auto py-12 px-4 animate-in slide-in-from-bottom-4 duration-500">
      <button onClick={() => setView('dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </button>
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlusCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">{t.form_title}</h2>
        </div>

        <form onSubmit={handlePublishCourse} className="space-y-8">
          
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Basic Information</h3>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Course Title</label>
                <input required name="title" type="text" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                  <select name="category" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all bg-white">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Price (CHF)</label>
                  <input required name="price" type="number" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" />
                </div>
              </div>
          </div>

          {/* Section 2: Location */}
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Location & Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">Canton</label>
                     <select name="canton" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all bg-white">
                         {cantons.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Exact Address</label>
                    <input required name="address" type="text" placeholder="e.g. Langstrasse 15, 8004 Zürich" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" />
                  </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Number of Sessions</label>
                   <input required name="sessionCount" type="number" min="1" defaultValue="1" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Session Length</label>
                   <input required name="sessionLength" type="text" placeholder="e.g. 2 hours" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">First Start Date</label>
                   <input required name="startDate" type="date" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Provider Website (Optional)</label>
                <input name="providerUrl" type="url" placeholder="https://your-site.com" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <textarea required name="description" rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" placeholder="General overview..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Objectives (One per line)</label>
                <textarea required name="objectives" rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" placeholder="- Learn X&#10;- Master Y&#10;- Understand Z"></textarea>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Prerequisites</label>
                <textarea required name="prerequisites" rows="2" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all" placeholder="Any specific skills or gear needed?"></textarea>
              </div>
          </div>

          <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
            {t.btn_publish}
          </button>
        </form>
      </div>
    </div>
  );

  const DetailView = ({ course }) => (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <button onClick={() => setView('home')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to courses
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Main Information */}
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
                    {/* Star Rating Removed from Detail View */}
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

                {course.prerequisites && (
                    <div>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t.lbl_prerequisites}</h3>
                        <div className="flex items-start bg-yellow-50 p-4 rounded-lg">
                            <Info className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                            <p className="text-gray-700">{course.prerequisites}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Sticky) */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 sticky top-24">
            
            {/* Price & Book */}
            <div className="mb-6 border-b pb-6">
                <span className="text-4xl font-extrabold text-gray-900 block mb-1">{t.currency} {course.price}</span>
                <span className="text-sm text-gray-500 block mb-4">per person</span>
                <button onClick={() => handleBookCourse(course)} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition shadow-md active:scale-95">
                    {t.btn_book}
                </button>
            </div>

            {/* Meta Details */}
            <div className="space-y-4">
                
                {/* Location */}
                <div className="flex items-start">
                    <div className="w-8 flex-shrink-0">
                        <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_address}</span>
                        <span className="text-gray-700 font-medium">{course.address || course.canton}</span>
                    </div>
                </div>

                {/* Duration */}
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

                {/* Dates */}
                <div className="flex items-start">
                    <div className="w-8 flex-shrink-0">
                        <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="w-full">
                        <EditionList editions={course.editions} />
                    </div>
                </div>

                 {/* Provider Link */}
                 {course.provider_url && (
                    <div className="flex items-start pt-4 mt-2 border-t">
                        <div className="w-8 flex-shrink-0">
                            <Globe className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide">{t.lbl_provider}</span>
                            <a href={course.provider_url} target="_blank" rel="noreferrer" className="text-red-600 font-bold hover:underline flex items-center">
                                Visit Website <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                        </div>
                    </div>
                )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const LoginView = () => (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-center">{t.login_title}</h2>
            <div className="space-y-4">
                <button onClick={() => login('student')} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center shadow-lg hover:-translate-y-0.5">
                    <User className="mr-2" /> {t.login_as_student}
                </button>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">or</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                </div>
                <button onClick={() => login('teacher')} className="w-full bg-white border-2 border-red-100 text-red-600 p-4 rounded-xl font-bold hover:bg-red-50 transition flex items-center justify-center">
                    <PlusCircle className="mr-2" /> {t.login_as_teacher}
                </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-6">
                (Simulation: No password required for prototype)
            </p>
        </div>
    </div>
  );

  const AdminLoginView = () => (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-gray-100">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-200">
              <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="text-white w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{t.admin_login_title}</h2>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                  <input 
                    type="password" 
                    placeholder="Enter Admin Password" 
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                  <button type="submit" className="w-full bg-gray-900 text-white p-3 rounded-lg font-bold hover:bg-gray-800 transition">
                      Access Panel
                  </button>
              </form>
               <p className="text-center text-xs text-gray-400 mt-4">
                (Hint: Password is 'admin')
            </p>
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
            {/* Canton Manager */}
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

            {/* Category Manager */}
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
    // If Teacher
    if (user.role === 'teacher') {
        const myCourses = courses.filter(c => c.instructor_name === user.name); 
        
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                            <DollarSign className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Earnings</p>
                            <p className="text-2xl font-bold">CHF 0</p>
                        </div>
                    </div>
                </div>

                <h2 className="text-xl font-bold mb-4">My Active Courses</h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {myCourses.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Course</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Category</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Price</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {myCourses.map(course => (
                                        <tr key={course.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{course.title}</div>
                                                <div className="text-xs text-gray-500">{course.canton}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{course.category}</td>
                                            <td className="px-6 py-4 font-medium">CHF {course.price}</td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => handleDeleteCourse(course.id)}
                                                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition"
                                                    title="Delete Course"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">You haven't posted any courses yet.</div>
                    )}
                </div>
            </div>
        );
    } 
    return null;
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
                    <input 
                        type="text" 
                        placeholder={t.search_placeholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-colors"
                    />
                </div>
                <div className="flex-shrink-0">
                    <select 
                        className="w-full md:w-auto px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                        value={activeCanton}
                        onChange={(e) => setActiveCanton(e.target.value)}
                    >
                        <option value="All">{t.filter_all_cantons}</option>
                        {cantons.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex-grow overflow-x-auto no-scrollbar md:flex md:justify-end">
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => setActiveCategory("All")}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                activeCategory === "All" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            {t.filter_all_categories}
                        </button>
                        {categories.map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                    activeCategory === cat ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {loading ? (
                <div className="text-center py-20">Loading courses...</div>
            ) : filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredCourses.map(course => (
                  <div 
                    key={course.id}
                    onClick={() => { setSelectedCourse(course); setView('detail'); window.scrollTo(0,0); }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="relative h-48 overflow-hidden">
                        <img 
                        src={course.image_url} 
                        alt={course.title} 
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                        />
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
            ) : (
              <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">{t.no_results}</p>
              </div>
            )}
          </main>
        </>
      )}

      {view === 'detail' && selectedCourse && <DetailView course={selectedCourse} />}
      {view === 'login' && <LoginView />}
      {view === 'admin_login' && <AdminLoginView />}
      {view === 'about' && <AboutPage />}
      {view === 'contact' && <ContactPage />}
      {view === 'terms' && <TermsPage />}
      {view === 'privacy' && <PrivacyPage />}
      {view === 'admin' && user?.role === 'admin' && <AdminPanel />}
      {view === 'dashboard' && (user?.role === 'teacher' || user?.role === 'student') && <Dashboard />}
      {view === 'create' && user?.role === 'teacher' && <TeacherForm />}
      </div>
    
      {/* Footer */}
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