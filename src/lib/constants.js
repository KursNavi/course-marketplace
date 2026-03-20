import { Guitar, Piano, Mic, Music, Globe, Dumbbell, Utensils, Palette, Hammer, Briefcase, Code, Users, HardHat, GraduationCap, Smile } from 'lucide-react';

// --- BRAND ASSETS ---
export const BRAND = {
  orange: '#FA6E28', 
  black: '#333333',  
  lightOrange: '#FFF0EB', 
  blue: '#78B3CE',   
  lightBeige: '#FAF5F0', 
};

// --- DATA LISTS ---
export const SWISS_CANTONS = ["Online", "Aargau", "Appenzell AI", "Appenzell AR", "Basel-Landschaft", "Basel-Stadt", "Bern", "Fribourg", "Genève", "Glarus", "Graubünden", "Jura", "Liechtenstein", "Luzern", "Neuchâtel", "Nidwalden", "Obwalden", "Schaffhausen", "Schwyz", "Solothurn", "St. Gallen", "Thurgau", "Ticino", "Uri", "Valais", "Vaud", "Zug", "Zürich", "Ausland"];
export const SWISS_CITIES = ["Basel", "Bern", "Biel/Bienne", "Genève", "Lausanne", "Lugano", "Luzern", "St. Gallen", "Winterthur", "Zürich"];

// --- DELIVERY TYPES ---
export const DELIVERY_TYPES = {
  presence: { de: "Präsenz (vor Ort)", en: "In-Person", fr: "En présentiel", it: "In presenza" },
  online_live: { de: "Online Live (Zoom, etc.)", en: "Online Live", fr: "En ligne en direct", it: "Online dal vivo" },
  self_study: { de: "Selbststudium (asynchron)", en: "Self-Study (async)", fr: "Auto-apprentissage", it: "Autostudio" }
};

// --- COURSE LANGUAGES ---
export const COURSE_LANGUAGES = {
  Deutsch: { de: "Deutsch", en: "German", fr: "Allemand", it: "Tedesco" },
  Französisch: { de: "Französisch", en: "French", fr: "Français", it: "Francese" },
  Italienisch: { de: "Italienisch", en: "Italian", fr: "Italien", it: "Italiano" },
  Englisch: { de: "Englisch", en: "English", fr: "Anglais", it: "Inglese" },
  Andere: { de: "Andere", en: "Other", fr: "Autre", it: "Altro" }
};

// --- BUSINESS LOGIC (v2.1 SaaS Model) ---
export const TIER_CONFIG = {
  basic: {
    label: "Basic",
    price_year: 0,
    course_limit: 3,
    commission_percent: 15,
    features: ["Standard Ranking", "External & Platform Booking", "Basic Support", "Basic Analytics"],
    description: "Ideal für Einsteiger & kleine Anbieter."
  },
  pro: {
    label: "Pro",
    price_year: 290,
    course_limit: 10,
    commission_percent: 12,
    features: ["Besseres Ranking", "Lead-Formular", "Rich Media Profil", "Mehr Rubriken", "Medium Analytics"],
    description: "Für ernsthafte Anbieter, die wachsen wollen."
  },
  premium: {
    label: "Premium",
    price_year: 590,
    course_limit: 30,
    commission_percent: 10,
    features: ["Top Ranking & Badges", "Newsletter Features", "Reporting Dashboard", "Priorisierter Support", "Advanced Analytics"],
    description: "Maximale Sichtbarkeit für etablierte Schulen."
  },
  enterprise: {
    label: "Enterprise",
    price_year: 1190, // Startpreis
    course_limit: 9999, // Unlimitiert
    commission_percent: 8,
    features: ["Unlimitiert Kurse", "Eigene Landingpage", "Account Manager", "Custom Reporting", "Advanced Analytics"],
    description: "Individuelle Lösungen für Grossanbieter."
  }
};

export const SERVICE_PRICING = {
  base_price: 75, // CHF pro Kurs (für die ersten 3)
  discount_price: 50, // CHF pro Kurs (ab dem 4.)
  threshold: 3 // Ab hier gilt der Rabatt
};

// --- NEW TAXONOMY CONSTANTS ---

export const COURSE_LEVELS = {
  beginner: { de: "Einsteiger / keine Vorkenntnisse", en: "Beginner / No prior knowledge", fr: "Débutant / Aucune connaissance", it: "Principiante / Nessuna conoscenza" },
  intermediate: { de: "Mit Vorkenntnissen / Mittelstufe", en: "Intermediate", fr: "Intermédiaire", it: "Intermedio" },
  advanced: { de: "Fortgeschritten / Profi", en: "Advanced / Professional", fr: "Avancé / Professionnel", it: "Avanzato / Professionale" },
  all_levels: { de: "Alle Niveaus / gemischtes Niveau", en: "All Levels / Mixed", fr: "Tous niveaux", it: "Tutti i livelli" }
};

// --- 3-SÄULEN (Berufliche Kurs-Klassifikation) ---
// Orthogonal zur Fach-Taxonomie, nur für professionelle/berufliche Kurse
export const BERUF_SAEULEN = {
  diplome: {
    de: "Diplome & Höhere Abschlüsse",
    shortDe: "Diplome",
    subtitle: "Karrieresprung",
    description: "Eidg. Abschlüsse (BP/HFP/HF), CAS/DAS/MAS"
  },
  fachkurse: {
    de: "Fachkurse & Praxis-Zertifikate",
    shortDe: "Fachkurse",
    subtitle: "Skill-Update",
    description: "Zertifikatskurse, Seminare, Branchen-Zertifikate"
  },
  quereinstieg: {
    de: "Quereinstieg & Berufsbildung",
    shortDe: "Quereinstieg",
    subtitle: "Neuorientierung",
    description: "Berufliche Grundbildung (EFZ/EBA), Bootcamps"
  }
};

export const AGE_GROUPS = {
  age_0_3: { de: "0–3 Jahre", en: "0–3 Years", fr: "0–3 ans", it: "0–3 anni" },
  age_4_6: { de: "4–6 Jahre", en: "4–6 Years", fr: "4–6 ans", it: "4–6 anni" },
  age_7_9: { de: "7–9 Jahre", en: "7–9 Years", fr: "7–9 ans", it: "7–9 anni" },
  age_10_12: { de: "10–12 Jahre", en: "10–12 Years", fr: "10–12 ans", it: "10–12 anni" },
  age_13_15: { de: "13–15 Jahre", en: "13–15 Years", fr: "13–15 ans", it: "13–15 anni" },
  age_16_18: { de: "16–18 Jahre", en: "16–18 Years", fr: "16–18 ans", it: "16–18 anni" },
  age_18_25: { de: "18–25 Jahre", en: "18–25 Years", fr: "18–25 ans", it: "18–25 anni" },
  age_26_59: { de: "26–59 Jahre", en: "26–59 Years", fr: "26–59 ans", it: "26–59 anni" },
  age_60_plus: { de: "60+ Jahre", en: "60+ Years", fr: "60+ ans", it: "60+ anni" },
  parents_caregivers: { de: "Eltern & Bezugspersonen", en: "Parents & Caregivers", fr: "Parents & Soignants", it: "Genitori & Tutori" },
  age_mixed: { de: "Altersgemischt / offen", en: "Mixed Age / Open", fr: "Âge mixte / Ouvert", it: "Età mista / Aperto" }
};

export const CATEGORY_TYPES = {
  // New consolidated schema slugs — labels match header/navigation
  professionell: { de: "Beruflich", en: "Professional", fr: "Professionnel", it: "Professionale" },
  privat: { de: "Privat & Hobby", en: "Private & Hobby", fr: "Privé & Loisirs", it: "Privato & Hobby" },
  kinder: { de: "Kinder", en: "Children", fr: "Enfants", it: "Bambini" },
  // Legacy slugs (for backward compatibility during transition)
  beruflich: { de: "Beruflich", en: "Professional", fr: "Professionnel", it: "Professionale" },
  privat_hobby: { de: "Privat & Hobby", en: "Private & Hobby", fr: "Privé & Loisirs", it: "Privato & Hobby" },
  kinder_jugend: { de: "Kinder", en: "Children", fr: "Enfants", it: "Bambini" }
};

// Display-Label Override für DB taxonomy_level1.label_de → konsistent mit Header/Navigation
export const TYPE_DISPLAY_LABELS = {
  professionell: 'Beruflich',
  privat: 'Privat & Hobby',
  kinder: 'Kinder',
};

// --- SEGMENT VISUAL CONFIG ---
// Visual styling for the three main category segments
export const SEGMENT_CONFIG = {
  // Professionell / Beruflich - Blue theme
  professionell: {
    icon: Briefcase,
    label: { de: "Beruflich", en: "Professional", fr: "Professionnel", it: "Professionale" },
    color: 'blue',
    bgLight: 'bg-blue-50',
    bgSolid: 'bg-blue-500',
    text: 'text-blue-600',
    textDark: 'text-blue-700',
    border: 'border-blue-500',
    borderLight: 'border-blue-200',
    ring: 'ring-blue-500',
    gradient: 'from-blue-600/70 to-blue-900/90',
    hoverBg: 'hover:bg-blue-50'
  },
  beruflich: {
    icon: Briefcase,
    label: { de: "Berufliche Weiterbildung", en: "Professional Development", fr: "Formation professionnelle", it: "Formazione professionale" },
    heroTitle: { de: "Investiere in deine Karriere", en: "Invest in your career" },
    heroSubtitle: { de: "Weiterbildungen und Fachkurse von erfahrenen Anbietern", en: "Training courses from experienced providers" },
    heroBg: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=2000",
    color: 'blue',
    bgLight: 'bg-blue-50',
    bgSolid: 'bg-blue-500',
    text: 'text-blue-600',
    textDark: 'text-blue-700',
    border: 'border-blue-500',
    borderLight: 'border-blue-200',
    ring: 'ring-blue-500',
    gradient: 'from-blue-600/70 to-blue-900/90',
    hoverBg: 'hover:bg-blue-50'
  },
  // Privat / Privat & Hobby - Orange theme (brand color)
  privat: {
    icon: Palette,
    label: { de: "Privat & Hobby", en: "Private & Hobby", fr: "Privé & Loisirs", it: "Privato & Hobby" },
    color: 'primary',
    bgLight: 'bg-primaryLight',
    bgSolid: 'bg-primary',
    text: 'text-primary',
    textDark: 'text-orange-700',
    border: 'border-primary',
    borderLight: 'border-orange-200',
    ring: 'ring-primary',
    gradient: 'from-orange-500/70 to-orange-800/90',
    hoverBg: 'hover:bg-primaryLight'
  },
  privat_hobby: {
    icon: Palette,
    label: { de: "Privat & Hobby", en: "Private & Hobby", fr: "Privé & Loisirs", it: "Privato & Hobby" },
    heroTitle: { de: "Entdecke neue Leidenschaften", en: "Discover new passions" },
    heroSubtitle: { de: "Kurse für Hobbys, Kreativität und persönliches Wachstum", en: "Courses for hobbies, creativity and personal growth" },
    heroBg: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=2000",
    color: 'primary',
    bgLight: 'bg-primaryLight',
    bgSolid: 'bg-primary',
    text: 'text-primary',
    textDark: 'text-orange-700',
    border: 'border-primary',
    borderLight: 'border-orange-200',
    ring: 'ring-primary',
    gradient: 'from-orange-500/70 to-orange-800/90',
    hoverBg: 'hover:bg-primaryLight'
  },
  // Kinder / Kinder & Jugend - Green theme
  kinder: {
    icon: Smile,
    label: { de: "Kinder & Jugend", en: "Kids & Teens", fr: "Enfants & Ados", it: "Bambini & Adolescenti" },
    color: 'emerald',
    bgLight: 'bg-emerald-50',
    bgSolid: 'bg-emerald-500',
    text: 'text-emerald-600',
    textDark: 'text-emerald-700',
    border: 'border-emerald-500',
    borderLight: 'border-emerald-200',
    ring: 'ring-emerald-500',
    gradient: 'from-emerald-500/70 to-emerald-800/90',
    hoverBg: 'hover:bg-emerald-50'
  },
  kinder_jugend: {
    icon: Smile,
    label: { de: "Kinder & Jugend", en: "Kids & Teens", fr: "Enfants & Ados", it: "Bambini & Adolescenti" },
    heroTitle: { de: "Fördern & Begeistern", en: "Nurture & Inspire" },
    heroSubtitle: { de: "Altersgerechte Kurse für Kinder und Jugendliche", en: "Age-appropriate courses for children and teens" },
    heroBg: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2000",
    color: 'emerald',
    bgLight: 'bg-emerald-50',
    bgSolid: 'bg-emerald-500',
    text: 'text-emerald-600',
    textDark: 'text-emerald-700',
    border: 'border-emerald-500',
    borderLight: 'border-emerald-200',
    ring: 'ring-emerald-500',
    gradient: 'from-emerald-500/70 to-emerald-800/90',
    hoverBg: 'hover:bg-emerald-50'
  }
};

// Helper to get segment config with fallback
export const getSegmentConfig = (typeKey) => {
  return SEGMENT_CONFIG[typeKey] || SEGMENT_CONFIG.privat;
};

// The Structure: Type -> Area (Level 1) -> Specialties (Level 2)
// Note: Labels currently DE only for deep levels, EN/FR/IT default to DE key or generic. 
// In a real app, we would fill all translations.
export const NEW_TAXONOMY = {
  beruflich: {
    sport_fitness_beruf: {
      label: { de: "Sport & Fitness (Berufsausbildung)", en: "Sports & Fitness (Pro)", fr: "Sport & Fitness (Pro)", it: "Sport & Fitness (Pro)" },
      specialties: [
        "Fitness-Trainer-Ausbildung", "Personal-Trainer-Ausbildung", "Group-Fitness / Kursleitung",
        "Trainingsmethoden & Spezialisierungen", "Mind-Body (Yoga & Pilates)", "Ernährung & Coaching",
        "Zertifikate & Prüfungsvorbereitung", "Business & Selbstständigkeit"
      ],
      specialtyFocuses: {
        "Fitness-Trainer-Ausbildung": ["Basis-Ausbildung", "Advanced / Spezialisierung", "Diplom-Lehrgang"],
        "Personal-Trainer-Ausbildung": ["Grundausbildung", "Spezialisierung (Athletik, Ernährung)"],
        "Group-Fitness / Kursleitung": ["Gruppenfitness-Grundlagen", "Kursformate (Step, Aerobic, Toning, Cardio-Dance)"],
        "Trainingsmethoden & Spezialisierungen": ["Kraft- & Ausdauertraining", "Rücken- & Core-Training (inkl. Antara)", "Functional Training", "Kampfsport- & Cardio-Formate"],
        "Ernährung & Coaching": ["Ausbildung (Basiskurse)", "Workshop", "Sporternährung (CAS, Seminare)"]
      }
    },
    gesundheit_beruf: {
      label: { de: "Gesundheit, Pflege & Prävention", en: "Health, Care & Prevention", fr: "Santé, Soins & Prévention", it: "Salute, Cura & Prevenzione" },
      specialties: [
        "Gesundheitsförderung & Prävention", "Spezialist Bewegungsförderung", "Medical Fitness", 
        "Pflege & Betreuung", "Medizinische Grundlagen", "Notfallmedizin & Erste Hilfe", 
        "Praxisorganisation", "Soziale Arbeit", "Komplementärmethoden", "Sonstiges Gesundheit"
      ]
    },
    bildung_pruefung: {
      label: { de: "Bildung & Prüfungsvorbereitung", en: "Education & Exam Prep", fr: "Éducation & Prép. Examens", it: "Istruzione & Prep. Esami" },
      specialties: [
        "Vorbereitung Berufsprüfung (BP)", "Eidg. Fachausweis Vorbereitung", "Ausbilder / SVEB", 
        "Lerncoaching (Beruflich)", "Erwachsenenbildung", "Sonstige Prüfungsvorbereitung"
      ]
    },
    business_mgmt: {
      label: { de: "Business, Management & Leadership", en: "Business & Management", fr: "Affaires & Gestion", it: "Affari & Gestione" },
      specialties: [
        "Unternehmensstrategie & Geschäftsmodelle", "Projektmanagement klassisch", "Agiles Projekt- & Produktmanagement", 
        "Prozessmanagement & Lean", "Leadership & Teamführung", "Verkauf & Administration (Fitness/Gewerbe)",
        "Change- & Transformationsmanagement", "Organisationsentwicklung", "Innovation & Entrepreneurship", 
        "Nachhaltigkeit & CSR", "Unternehmensgründung", "Governance & Compliance", "Sonstiges Business"
      ]
    },
    hr_recht: {
      label: { de: "HR, Recht & Administration", en: "HR, Law & Admin", fr: "RH, Droit & Admin", it: "HR, Diritto & Ammin." },
      specialties: [
        "Recruiting & Personalmarketing", "Personaladministration & Lohn", "Arbeitsrecht", 
        "Personalentwicklung", "HR-Strategie", "Diversity & Inclusion", "Office-Management", "Sonstiges HR/Recht"
      ]
    },
    finanzen: {
      label: { de: "Finanzen, Controlling & Treuhand", en: "Finance & Accounting", fr: "Finance & Comptabilité", it: "Finanza & Contabilità" },
      specialties: [
        "Buchhaltung & Abschluss", "Controlling & Reporting", "Finanzplanung & Budget", 
        "Steuern für Unternehmen", "Treuhand", "Rechnungslegung (OR/Swiss GAAP)", "Sonstiges Finanzen"
      ]
    },
    marketing: {
      label: { de: "Verkauf, Marketing & Kommunikation", en: "Sales & Marketing", fr: "Ventes & Marketing", it: "Vendite & Marketing" },
      specialties: [
        "Verkauf & Vertrieb", "Verhandlungstechnik", "Marketingstrategie", "Online-Marketing & Social Media", 
        "Content & Storytelling", "SEO/SEA", "CRM & Automation", "Eventmarketing", "Sonstiges Marketing"
      ]
    },
    it_digital: {
      label: { de: "IT, Digital & Data", en: "IT, Digital & Data", fr: "IT, Numérique & Données", it: "IT, Digitale & Dati" },
      specialties: [
        "Softwareentwicklung", "Webdesign & Webdev", "Datenbanken & SQL", "Data Science & BI", 
        "AI & Machine Learning", "Cybersecurity", "Cloud & Infrastruktur", "Office-Tools (Excel etc.)", "Sonstiges IT"
      ]
    },
    industrie_bau: {
      label: { de: "Industrie, Bau & Immobilien", en: "Industry & Construction", fr: "Industrie & Construction", it: "Industria & Edilizia" },
      specialties: [
        "Bauleitung & Planung", "CAD & BIM", "Energie & Gebäudetechnik", "Facility Management", 
        "Logistik & Supply Chain", "Arbeitssicherheit", "Immobilienbewirtschaftung", "Sonstiges Industrie/Bau"
      ]
    },
    sprachen_beruf: {
      label: { de: "Sprachen für den Beruf", en: "Business Languages", fr: "Langues des affaires", it: "Lingue commerciali" },
      specialties: [
        "Business Deutsch", "Business Englisch", "Business Französisch", "Fachsprache (Medizin/Recht)", 
        "Präsentieren in Fremdsprache", "Sonstige Berufssprachen"
      ]
    },
    soft_skills: {
      label: { de: "Soft Skills & Persönlichkeit", en: "Soft Skills", fr: "Compétences douces", it: "Soft Skills" },
      specialties: [
        "Kommunikation", "Präsentation & Auftritt", "Zeitmanagement", "Konfliktmanagement", 
        "Resilienz & Stress", "Interkulturelle Kompetenz", "Sonstige Soft Skills"
      ]
    }
  },
  privat_hobby: {
    sport_fitness: {
      label: { de: "Sport, Fitness & Bewegung", en: "Sports & Fitness", fr: "Sport & Fitness", it: "Sport & Fitness" },
      specialties: [
        "Fitness & Kraft", "Ausdauer & Lauf", "Kampfsport", "Tanz-Fitness (Zumba etc.)", 
        "Teamsport", "Wintersport", "Wassersport", "Outdoor & Wandern", "Sonstiges Sport"
      ]
    },
    yoga_mental: {
      label: { de: "Yoga, Entspannung & Mental", en: "Yoga & Mental Health", fr: "Yoga & Santé mentale", it: "Yoga & Salute mentale" },
      specialties: [
        "Hatha Yoga", "Vinyasa/Power Yoga", "Pilates", "Meditation & Achtsamkeit", 
        "Atemtraining", "Energiearbeit", "Stressbewältigung", "Sonstiges Yoga/Mental"
      ]
    },
    musik: {
      label: { de: "Musik & Bühne", en: "Music & Stage", fr: "Musique & Scène", it: "Musica & Palcoscenico" },
      specialties: [
        "Gitarre/Bass", "Klavier/Tasten", "Gesang", "Schlagzeug", "Blasinstrumente", "Streichinstrumente", 
        "Chor/Ensemble", "Musikproduktion & DJ", "Theater & Schauspiel", "Tanz (Standard/Salsa)", "Sonstiges Musik"
      ]
    },
    kunst_kreativ: {
      label: { de: "Kunst, Design & Kreatives", en: "Art & Creative", fr: "Art & Créatif", it: "Arte & Creativo" },
      specialties: [
        "Zeichnen & Malen", "Fotografie", "Bildbearbeitung", "Grafikdesign", "Keramik & Töpfern", 
        "Nähen & Textil", "Schmuck & DIY", "Calligraphy & Lettering", "Sonstiges Kreativ"
      ]
    },
    kochen_genuss: {
      label: { de: "Kochen, Backen & Genuss", en: "Cooking & Nutrition", fr: "Cuisine & Nutrition", it: "Cucina & Nutrizione" },
      specialties: [
        "Kochkurse Basics", "Länderküchen", "Vegetarisch/Vegan", "Backen & Patisserie", 
        "Barista & Kaffee", "Wein & Degustation", "Ernährungswissen", "Sonstiges Kochen"
      ]
    },
    sprachen_privat: {
      label: { de: "Sprachen & Reisen", en: "Languages & Travel", fr: "Langues & Voyage", it: "Lingue & Viaggi" },
      specialties: [
        "Deutsch (Alltag)", "Englisch (Alltag)", "Französisch (Alltag)", "Italienisch (Alltag)", 
        "Spanisch (Alltag)", "Schweizerdeutsch", "Reisevorbereitung", "Sonstige Sprachen"
      ]
    },
    heim_garten: {
      label: { de: "Heim, Handwerk & Natur", en: "Home & Nature", fr: "Maison & Nature", it: "Casa & Natura" },
      specialties: [
        "Heimwerken & Reparatur", "Garten & Pflanzen", "Tiere & Hundeschule", "Floristik", 
        "Technik zuhause", "Sonstiges Heim/Natur"
      ]
    },
    alltag_leben: {
      label: { de: "Alltag & Persönlichkeit", en: "Life & Personality", fr: "Vie & Personnalité", it: "Vita & Personalità" },
      specialties: [
        "Persönlichkeitsentwicklung", "Beziehung & Kommunikation", "Finanzen (Privat)", 
        "Ordnung & Haushalt", "Spiele & Kultur", "Sonstiges Alltag"
      ]
    }
  },
  kinder_jugend: {
    fruehkind: {
      label: { de: "Frühkind & Eltern-Kind (0-5)", en: "Early Childhood (0-5)", fr: "Petite enfance (0-5)", it: "Prima infanzia (0-5)" },
      specialties: [
        "Babyschwimmen", "Eltern-Kind-Turnen (Muki/Vaki)", "Musikgarten & Rhythmik", 
        "Spielgruppen", "Kreatives für Kleinkinder", "Sonstiges Frühkind"
      ]
    },
    schule_lernen: {
      label: { de: "Schule, Nachhilfe & Lernen", en: "School & Tutoring", fr: "École & Soutien", it: "Scuola & Tutoraggio" },
      specialties: [
        "Nachhilfe Mathe", "Nachhilfe Sprachen", "Nachhilfe Naturwissenschaften", 
        "Hausaufgabenbetreuung", "Lerncoaching & Prüfungsvorbereitung", "Vorbereitung Gymi/Lehre", "Sonstiges Schule"
      ]
    },
    freizeit_hobbys: {
      label: { de: "Hobbys, Sport & Kreatives", en: "Hobbies & Sports", fr: "Loisirs & Sports", it: "Hobby & Sport" },
      specialties: [
        "Kinderturnen & Sport", "Kampfsport Kinder", "Tanzen Kinder", "Musik & Instrumente", 
        "Malen & Basteln", "Theater & Zirkus", "Pfadi & Outdoor", "Sonstiges Hobbys"
      ]
    },
    technik_medien: {
      label: { de: "Technik, Coding & Medien", en: "Tech & Coding", fr: "Tech & Codage", it: "Tech & Coding" },
      specialties: [
        "Programmieren & Games", "Robotik & Lego", "Medienkompetenz", "Foto & Video für Kids", "Sonstiges Technik"
      ]
    },
    ferien: {
      label: { de: "Feriencamps & Betreuung", en: "Camps", fr: "Camps", it: "Campi" },
      specialties: [
        "Sportcamps", "Kreativcamps", "Sprachcamps", "Outdoorlager", "Tagesbetreuung", "Sonstiges Ferien"
      ]
    },
    eltern: {
      label: { de: "Elternbildung & Familie", en: "Parenting", fr: "Parentalité", it: "Genitorialità" },
      specialties: [
        "Geburtsvorbereitung", "Erziehung & Entwicklung", "Erste Hilfe am Kind", "Familienleben", "Sonstiges Eltern"
      ]
    }
  }
};

// --- LEGACY CATEGORIES (Required for Landing Page & Filters) ---
export const CATEGORY_HIERARCHY = {
  "Private & Hobby": {
    "Music & Audio": ["Guitar", "Piano", "Vocals", "Drums", "Production", "Other Instruments"],
    "Languages": ["German", "French", "English", "Italian", "Spanish", "Swiss German", "Other Languages"],
    "Sports & Fitness": ["Yoga", "Pilates", "Personal Training", "Team Sports", "Dancing", "Other Sports"],
    "Cooking & Nutrition": ["Swiss Cuisine", "Italian Cuisine", "Asian Cuisine", "Baking", "Vegan/Vegetarian", "Other Cooking"],
    "Art & Craft": ["Painting", "Photography", "Pottery", "Sewing", "Digital Art", "Other Art"],
    "Lifestyle": ["Gardening", "Meditation", "DIY", "Other Lifestyle"]
  },
  "Professional": {
    "Business": ["Management", "Finance", "Marketing", "Entrepreneurship", "Sales"],
    "Tech & Data": ["Web Development", "Data Science", "Design Tools", "Office Skills", "Cybersecurity"],
    "Soft Skills": ["Communication", "Leadership", "Public Speaking", "Negotiation"],
    "Industry Specific": ["Healthcare", "Construction", "Hospitality", "Other Industry"]
  },
  "Children": {
    "Academic Support": ["Math", "Languages", "Science", "Homework Help"],
    "Creative & Fun": ["Music for Kids", "Art for Kids", "Dance", "Coding for Kids", "Camps"]
  }
};

export const CATEGORY_LABELS = {
  "Private & Hobby": { de: "Privat & Hobby", fr: "Privé & Loisirs", it: "Privato & Hobby" },
  "Professional": { de: "Beruflich", fr: "Professionnel", it: "Professionale" },
  "Children": { de: "Kinder", fr: "Enfants", it: "Bambini" },
  "Music & Audio": { de: "Musik & Audio", fr: "Musique & Audio", it: "Musica & Audio" },
  "Languages": { de: "Sprachen", fr: "Langues", it: "Lingue" },
  "Sports & Fitness": { de: "Sport & Fitness", fr: "Sport & Forme", it: "Sport & Fitness" },
  "Cooking & Nutrition": { de: "Kochen & Ernährung", fr: "Cuisine & Nutrition", it: "Cucina & Nutrizione" },
  "Art & Craft": { de: "Kunst & Handwerk", fr: "Art & Artisanat", it: "Arte & Artigianato" },
  "Lifestyle": { de: "Lifestyle", fr: "Art de vivre", it: "Lifestyle" },
  "Business": { de: "Wirtschaft", fr: "Affaires", it: "Affari" },
  "Tech & Data": { de: "Technik & Daten", fr: "Tech & Données", it: "Tech & Dati" },
  "Soft Skills": { de: "Soft Skills", fr: "Compétences Douces", it: "Soft Skills" },
  "Industry Specific": { de: "Branchenspezifisch", fr: "Spécifique à l'industrie", it: "Settore Specifico" },
  "Academic Support": { de: "Nachhilfe", fr: "Soutien scolaire", it: "Supporto Accademico" },
  "Creative & Fun": { de: "Kreativ & Spass", fr: "Créatif & Ludique", it: "Creativo & Divertimento" },
  "Guitar": { de: "Gitarre", fr: "Guitare", it: "Chitarra" },
  "Piano": { de: "Klavier", fr: "Piano", it: "Pianoforte" },
  "Vocals": { de: "Gesang", fr: "Chant", it: "Canto" },
  "Other Instruments": { de: "Andere Instrumente", fr: "Autres Instruments", it: "Altri Strumenti" },
  "German": { de: "Deutsch", fr: "Allemand", it: "Tedesco" },
  "French": { de: "Französisch", fr: "Français", it: "Francese" },
  "English": { de: "Englisch", fr: "Anglais", it: "Inglese" },
  "Swiss Cuisine": { de: "Schweizer Küche", fr: "Cuisine Suisse", it: "Cucina Svizzera" },
  "Web Development": { de: "Webentwicklung", fr: "Développement Web", it: "Sviluppo Web" },
  "Homework Help": { de: "Hausaufgabenhilfe", fr: "Aide aux devoirs", it: "Aiuto Compiti" }
};
export const TRANSLATIONS = {
  en: {
    nav_explore: "Explore", nav_about: "About Us", nav_contact: "Contact", nav_login: "Login", nav_logout: "Logout", nav_dashboard: "Dashboard",
    nav_private: "Private & Hobby", nav_professional: "Professional", nav_kids: "Children", nav_howitworks: "How it Works",
    nav_dashboard: "My Area", 
    nav_news: "News", nav_providers: "Provider Search", 
    nav_for_providers: "For Providers",hero_title: "Discover courses near you.", hero_subtitle: "From yodeling in Appenzell to coding in Zürich. Learn locally.",
    search_placeholder: "What do you want to learn?", filter_label_cat: "Category", filter_label_loc: "Location", btn_search: "Search", search_hint_boolean: "Tip: Combine terms with AND or OR (e.g. \"Yoga AND Zurich\")",
    no_results: "No courses found matching criteria.", btn_book: "Book Course", btn_pay: "Pay & Book", btn_publish: "Publish Course", btn_send: "Send Message",
    
    // ADMIN
    admin_login_title: "KursNavi Control Room", admin_pass_placeholder: "Enter Access Code", admin_btn_access: "Access System",
    admin_tab_teachers: "Course Providers", admin_tab_students: "Learners", admin_tab_courses: "Courses",
    admin_col_name: "Name", admin_col_email: "Email", admin_col_status: "Status", admin_col_actions: "Actions",
    admin_btn_verify: "Verify Pro", admin_btn_unverify: "Remove Pro", admin_verified: "Verified Pro",
    
    // HOME PAGE
    home_headline: "Navigate Your Future with KursNavi",
    home_subhead: "Discover courses, gain new skills, and unlock your potential with expert-led learning tailored to your goals.",
    home_verified_tutors: "Verified Providers",
    home_students: "Learners",
    home_rating: "Rating",
    home_path_title: "Choose Your Path",
    home_path_sub: "Explore our most popular learning directions",
    home_card_prof_sub: "Advance your career with certified skills.",
    home_card_priv_sub: "Cooking, Photography, Sports & more.",
    home_card_kids_sub: "Fun and engaging courses for children.",
    btn_explore: "EXPLORE",

    // LANDING TITLES
    landing_priv_title: "Unleash your passion.", landing_priv_sub: "Hobby Courses",
    landing_prof_title: "Boost your career.", landing_prof_sub: "Professional Courses",
    landing_kids_title: "Fun learning for kids.", landing_kids_sub: "Children's Courses",

    // SEARCH FILTERS
    search_refine: "Refine search...",
    lbl_max_price: "Max CHF",
    lbl_type: "Type", lbl_area: "Area", lbl_specialty: "Specialty", 
    msg_no_courses: "No courses available.", msg_all_topics: "All topics in this area.", 
    msg_select_area: "Select an area.", lbl_select_cat: "Select Category",
    lbl_professional_filter: "Verified",
    tooltip_pro_verified: "Course provider verified by KursNavi.",
    tooltip_pro_verified_long: "Courses from providers whose qualifications have been verified by KursNavi.",
    lbl_direct_booking_filter: "Direct Booking",
    tooltip_direct_booking: "Book and pay directly on KursNavi.",
    tooltip_direct_booking_long: "These courses can be booked and paid directly on our platform - no external website or contact form needed.",

    // Form Labels
    edit_course: "Edit Course", edit_course_sub: "Update your course details.",
    create_course: "List a Course", create_course_sub: "Share your skills with the community.",
    lbl_title: "Course Title", lbl_skill_level: "Skill Level", lbl_target_group: "Target Group", lbl_pro_checkbox: "Verified Provider",
    lbl_cat_class: "Category Classification", lbl_type: "Type", lbl_area: "Area", lbl_specialty: "Specialty",
    lbl_price: "Price (CHF)", lbl_canton: "Canton", lbl_specific_address: "Specific Address",
    lbl_session_count: "Session Count", lbl_session_length: "Session Length", lbl_start_date: "Start Date",
    lbl_website: "Provider Website (Optional)", lbl_learn_goals: "What will learners learn?", lbl_prereq: "Prerequisites",
    btn_update: "Update Course", btn_back_dash: "Back to Dashboard",
    opt_all_levels: "All Levels", opt_beginner: "Beginner", opt_advanced: "Advanced",
    opt_adults: "Adults", opt_teens: "Teens", opt_kids: "Kids",

    form_title: "List a Course", success_msg: "Grüezi! Action successful.", currency: "CHF", admin_panel: "Admin Control Center",
    teacher_dash: "Provider Dashboard", student_dash: "My Learning", login_title: "Welcome Back", my_bookings: "My Bookings",
    booking_confirmed: "Confirmed",
    no_bookings_yet: "You haven't booked any courses yet.",
    no_cancellation_hint: "After the automatic cancellation window, you can submit a goodwill request to the provider via your dashboard. The provider may approve 0%, 25%, 50% or 100% refund.",
    booking_success_note: "For fixed-date courses, free cancellation is possible up to 14 days before the course. For flex bookings, free cancellation is possible within 7 days after payment. Afterwards you can submit a goodwill request to the provider via your dashboard.",
    lbl_objectives: "What you will learn", lbl_prerequisites: "Prerequisites", lbl_description: "About this course", lbl_address: "Location",
    lbl_duration: "Duration", lbl_sessions: "sessions",
    how_it_works: "How it Works", for_students: "For Learners", for_tutors: "For Course Providers",
    student_step_1: "Discover", student_desc_1: "Browse hundreds of unique local courses.",
    student_step_2: "Book", student_desc_2: "Secure your spot instantly with our payment protection.",
    student_step_3: "Learn", student_desc_3: "Meet your local expert and start learning.",
    tutor_step_1: "List", tutor_desc_1: "Create a profile and list your skills for free.",
    tutor_step_2: "Schedule", tutor_desc_2: "Set your own dates, location, and class size.",
    tutor_step_3: "Earn", tutor_desc_3: "Get paid automatically 24h after the course starts.",
    cta_title: "Become a Course Provider", cta_subtitle: "Share your skills and knowledge with learners across Switzerland. Set your own schedule and prices.", cta_btn: "Get Started",
    
    // FOOTER
    footer_terms: "Terms & Conditions", footer_privacy: "Data Protection", footer_legal: "Legal Notice", footer_madein: "Made in Switzerland", footer_rights: "All rights reserved.",
    footer_discover: "Discover", footer_support: "Support", footer_legal_header: "Legal",

    contact_title: "Contact Us", contact_get_in_touch: "Get in Touch", contact_office_hours: "Office Hours",
    contact_mon_fri: "Mon-Fri: 09:00 - 17:00", contact_weekend: "Weekends: Closed",
    contact_lbl_name: "Name", contact_lbl_email: "Email", contact_lbl_msg: "Message", contact_lbl_subject: "Subject",

    // --- NEW ABOUT PAGE (EN) ---
    about_hero_title: "Learning doesn't just happen online. It happens in real life.",
    about_hero_teaser: "KursNavi brings you and course providers together – for face-to-face courses in Switzerland that create skills, confidence, and new perspectives. Simple to find. Simple to book. Simple to attend.",
    about_mission_1_title: "Clarity", about_mission_1_text: "Clear course overviews instead of endless searching",
    about_mission_2_title: "Simplicity", about_mission_2_text: "Book in a few clicks, without email ping-pong",
    about_mission_3_title: "Trust", about_mission_3_text: "Verified providers and transparent information",
    about_story_title: "Our Story",
    about_timeline_1_title: "The Observation", about_timeline_1_text: "Anyone looking for a suitable course often finds too much – or the right one too late. Offers are scattered across websites, social media, and PDFs.",
    about_timeline_2_title: "The Challenge", about_timeline_2_text: "Course providers invest enormous energy in organization and visibility – instead of focusing on strong learning moments on site.",
    about_timeline_3_title: "The Solution", about_timeline_3_text: "That's why we're building KursNavi: a platform that creates clarity, builds trust, and makes booking easy.",
    about_what_title: "What we do (and why it feels good)",
    about_what_intro: "KursNavi is a platform for face-to-face courses in Switzerland – from professional development to creative and practical skills for life.",
    about_benefit_1: "Clear overviews instead of endless searching",
    about_benefit_2: "Simple booking instead of back-and-forth emails",
    about_benefit_3: "Professional course profiles instead of messy info",
    about_benefit_4: "A user experience that builds trust",
    about_micro_1: "Find", about_micro_2: "Book", about_micro_3: "Go",
    about_you_title: "For You: Your next Aha-moment awaits",
    about_you_text: "Whether you want to develop professionally, learn something practical, or just want something new: We believe in learning that arrives in everyday life. Face-to-face courses bring people together – and create experiences that stay.",
    about_kids_title: "For Kids & Families: Offers that bring joy",
    about_kids_text: "Sometimes the most important things start very early: curiosity, courage, creativity, movement, social skills. That's why we want to make children's offers more visible – from playful courses to creative workshops.",
    about_kids_sub: "Holiday courses, music, sports, crafts, or technology: Find what your child needs quickly.",
    about_prov_title: "For Providers: More focus on your courses",
    about_prov_text: "Course providers are the heart of KursNavi. We build tools with which you present your offer professionally, manage bookings more easily, and inform your participants well – without your everyday life feeling like administration.",
    about_promise_title: "Our Promise",
    about_promise_text: "We want good courses not to get lost – and for you to find offers that truly fit your goals. KursNavi stands for quality, clarity, and a likeable experience.",
    about_cta_primary: "Discover Courses",
    about_cta_secondary: "Publish a Course",

    profile_settings: "Profile Settings", lbl_city: "My City / Town", lbl_bio: "About Me (Bio)", lbl_language: "Preferred Language",
    profile_lang_note: "We will use this for emails and website content.", btn_save: "Save Changes",
    dash_overview: "Courses", dash_profile: "My Profile", dash_settings: "Profile", dash_new_course: "New Course",
    lbl_account_security: "Account Security", lbl_new_password: "New Password", lbl_confirm_password: "Confirm Password",
    lbl_update_auth: "Update Login Details", msg_auth_success: "Account details updated!",
    
    // LEGAL MICRO-COPY
    legal_agree: "I accept the", legal_agb: "GTC", legal_and: "and have read the", legal_privacy: "Privacy Policy",
    legal_provider_suffix: "incl. Provider Terms", legal_mediator_note: "KursNavi is the intermediary. Contract is with the provider.",
    legal_provider_verified_tooltip: "Verified manually by LifeSkills360 (Identity & Basic Info).",

    // FAQ
    faq_title: "Frequently Asked Questions",
    faq_q1: "What exactly is KursNavi?", faq_a1: "KursNavi is Switzerland's course marketplace. We connect people who want to learn with local experts and course providers – for in-person courses, live online classes or self-study formats.",
    faq_q2: "Is the course search free for me?", faq_a2: "Yes! searching and contacting course providers is 100% free for learners. You only pay the course fee when you book.",
    faq_q3: "How do I book a course?", faq_a3: "Choose a course and click 'Book Now' to pay securely online – you will receive an instant confirmation. For some courses you can send a contact request instead, and the provider will get back to you.",
    faq_q4: "Do I need to register to book?", faq_a4: "Yes, you need a free account so that the course provider can contact you and we can send you the booking confirmation.",
    faq_q5: "How do I pay for the course?", faq_a5: "We accept all major credit cards and TWINT (via Stripe). Your payment is held securely until the course starts.",
    faq_q6: "Are the course providers verified?", faq_a6: "Yes. We check the identity of all providers. Providers marked as 'Verified' have also submitted diplomas/certificates, which we have manually verified.",
    faq_q7: "Can I cancel a booking?", faq_a7: "Yes. Fixed-date bookings can be cancelled free of charge via the dashboard up to 14 days before the course date. Flex bookings can be cancelled free of charge within 7 days after payment. The amount is credited to your KursNavi account as platform credit, which is automatically applied to your next booking. After the automatic cancellation window, you can send a goodwill request to the provider, who may approve a 0%, 25%, 50% or 100% refund.",
    faq_q8: "Are there courses for companies or groups?", faq_a8: "Yes. Many of our course providers offer private group courses. Simply use the 'Contact' button on the course profile to ask.",
    faq_q9: "I can't find the course I want – what now?", faq_a9: "We are growing daily! Write to us at info@kursnavi.ch with your course wish – we'll check if we can find a suitable provider for you.",
    faq_q10: "I am a provider myself. How can I list courses?", faq_a10: "Create a free profile, verify your email, and click on 'New Course' in the dashboard. It takes less than 5 minutes.",
    faq_q11: "What does the 'Verified' badge mean?", faq_a11: "The 'Verified' badge means that this provider has submitted certificates or diplomas to KursNavi, and we have manually reviewed them. It does not mean that providers without the badge are unqualified – many excellent providers simply haven't gone through our verification process (yet).",

    // AUTH NEW
    lbl_name_company: "Full Name / Company",
    err_accept_terms: "Please accept the Terms and Privacy Policy.",
    
    // AUTH LABELS
    auth_create_account: "Create Account", auth_welcome_back: "Welcome Back",
    auth_i_am_a: "I am a...", auth_student: "Learner", auth_teacher: "Course Provider",
    lbl_email: "Email", lbl_password: "Password", lbl_confirm_password: "Confirm Password",
    err_passwords_mismatch: "Passwords do not match.",
    btn_signup: "Sign Up", btn_login: "Login",
    auth_already_have: "Already have an account?", auth_dont_have: "Don't have an account?",
    link_login: "Login", link_signup: "Sign Up",
    msg_welcome_back_toast: "Welcome back!",
    // SUCCESS PAGE
    auth_success_title: "Thank you for registering!",
    auth_success_text: "We have sent a confirmation link to your email. Please check your inbox to activate your account.",
    btn_go_to_login: "Go to Login",
    // PASSWORD RESET
    setpw_forgot_link: "Forgot password?",
    setpw_forgot_title: "Forgot Password?",
    setpw_forgot_text: "Enter your email address and we'll send you a link to reset your password.",
    setpw_btn_send_link: "Send Reset Link",
    setpw_email_sent_title: "Email Sent",
    setpw_email_sent_text: "We've sent you a password reset link. Please check your inbox and spam folder.",
    setpw_new_title: "Set New Password",
    setpw_btn_save: "Save Password",
    setpw_err_min_length: "Password must be at least 6 characters.",
    setpw_success_changed: "Password successfully updated!",
    setpw_back_to_login: "Back to Login",
  },
  de: {
    nav_explore: "Entdecken", nav_about: "Über uns", nav_contact: "Kontakt", nav_login: "Anmelden", nav_logout: "Abmelden", nav_dashboard: "Dashboard",
    nav_private: "Privat & Hobby", nav_professional: "Beruflich", nav_kids: "Kinder", nav_howitworks: "So funktioniert's",
    nav_dashboard: "Mein Bereich", 
    nav_news: "Neuigkeiten", nav_providers: "Anbietersuche", 
    nav_for_providers: "Für Anbieter",hero_title: "Finde Kurse in deiner Nähe.", hero_subtitle: "Vom Jodeln bis zum Programmieren.",
    search_placeholder: "Was möchtest du lernen?", filter_label_cat: "Kategorie", filter_label_loc: "Ort", btn_search: "Suchen", search_hint_boolean: "Tipp: Kombiniere Begriffe mit AND oder OR (z.B. \"Yoga AND Zürich\")",
    no_results: "Keine Kurse gefunden.", btn_book: "Kurs buchen", btn_pay: "Bezahlen & Buchen", btn_publish: "Veröffentlichen", btn_send: "Senden",
    
    // ADMIN
    admin_login_title: "KursNavi Kommandozentrale", admin_pass_placeholder: "Zugangscode eingeben", admin_btn_access: "System öffnen",
    admin_tab_teachers: "Kursanbieter", admin_tab_students: "Lernende", admin_tab_courses: "Kurse",
    admin_col_name: "Name", admin_col_email: "E-Mail", admin_col_status: "Status", admin_col_actions: "Aktionen",
    admin_btn_verify: "Verifizieren (Pro)", admin_btn_unverify: "Pro entfernen", admin_verified: "Verifizierter Pro",

    // HOME PAGE
    home_headline: "Gestalte deine Zukunft mit KursNavi",
    home_subhead: "Entdecke Kurse, lerne neue Fähigkeiten und entfalte dein Potenzial mit Experten, die dich weiterbringen.",
    home_verified_tutors: "Geprüfte Kursanbieter",
    home_students: "Lernende",
    home_rating: "Bewertung",
    home_path_title: "Wähle deinen Weg",
    home_path_sub: "Entdecke unsere beliebtesten Lernbereiche",
    home_card_prof_sub: "Karriere fördern mit zertifizierten Skills.",
    home_card_priv_sub: "Kochen, Fotografie, Sport & mehr.",
    home_card_kids_sub: "Spassige und spannende Kurse für Kinder.",
    btn_explore: "ENTDECKEN",

    // LANDING TITLES
    landing_priv_title: "Entfessle deine Leidenschaft.", landing_priv_sub: "Hobby-Kurse",
    landing_prof_title: "Karriere-Boost.", landing_prof_sub: "Berufliche Weiterbildung",
    landing_kids_title: "Spielerisch lernen.", landing_kids_sub: "Kinderkurse",

    // SEARCH FILTERS
    search_refine: "Suche verfeinern...",
    lbl_max_price: "Max CHF",
    lbl_type: "Typ", lbl_area: "Bereich", lbl_specialty: "Spezialgebiet", 
    msg_no_courses: "Keine Kurse verfügbar.", msg_all_topics: "Alle Themen in diesem Bereich.", 
    msg_select_area: "Wähle einen Bereich.", lbl_select_cat: "Kategorie wählen",
    lbl_professional_filter: "Verifiziert",
    tooltip_pro_verified: "Kursanbieter von KursNavi geprüft.",
    tooltip_pro_verified_long: "Kurse von Anbietern, deren Qualifikationen von KursNavi geprüft wurden.",
    lbl_direct_booking_filter: "Direktbuchung",
    tooltip_direct_booking: "Direkt auf KursNavi buchen und bezahlen.",
    tooltip_direct_booking_long: "Diese Kurse können direkt auf unserer Plattform gebucht und bezahlt werden - ohne externe Webseite oder Kontaktformular.",

    edit_course: "Kurs bearbeiten", edit_course_sub: "Details aktualisieren.",
    create_course: "Kurs erstellen", create_course_sub: "Teile dein Wissen.",
    lbl_title: "Kurstitel", lbl_skill_level: "Niveau", lbl_target_group: "Zielgruppe", lbl_pro_checkbox: "Verifizierter Anbieter",
    lbl_cat_class: "Kategorie-Einteilung", lbl_type: "Typ", lbl_area: "Bereich", lbl_specialty: "Spezialgebiet",
    lbl_price: "Preis (CHF)", lbl_canton: "Kanton", lbl_specific_address: "Genaue Adresse",
    lbl_session_count: "Anzahl Lektionen", lbl_session_length: "Lektionsdauer", lbl_start_date: "Startdatum",
    lbl_website: "Webseite (Optional)", lbl_learn_goals: "Lernziele", lbl_prereq: "Voraussetzungen",
    btn_update: "Kurs aktualisieren", btn_back_dash: "Zurück zum Dashboard",
    opt_all_levels: "Alle Niveaus", opt_beginner: "Anfänger", opt_advanced: "Fortgeschritten",
    opt_adults: "Erwachsene", opt_teens: "Jugendliche", opt_kids: "Kinder",

    form_title: "Kurs anbieten", success_msg: "Erfolgreich!", currency: "CHF", admin_panel: "Admin Konsole",
    teacher_dash: "Kursanbieter Dashboard", student_dash: "Meine Kurse",
    login_title: "Willkommen", my_bookings: "Meine Buchungen",
    booking_confirmed: "Bestätigt",
    no_bookings_yet: "Du hast noch keine Kurse gebucht.",
    no_cancellation_hint: "Nach Ablauf der automatischen Stornofrist kannst du über dein Dashboard eine Kulanzanfrage an den Anbieter senden. Der Anbieter kann 0 %, 25 %, 50 % oder 100 % Rückerstattung bewilligen.",
    booking_success_note: "Terminbuchungen können bis 14 Tage vor dem Termin kostenlos storniert werden. Flexible Buchungen können innerhalb von 7 Tagen nach Zahlung kostenlos storniert werden. Danach kannst du eine Kulanzanfrage an den Anbieter senden.",
    lbl_description: "Beschreibung", lbl_address: "Standort", lbl_duration: "Dauer", lbl_sessions: "Lektionen",
    lbl_objectives: "Was du lernst", lbl_prerequisites: "Voraussetzungen",
    how_it_works: "So funktioniert's", for_students: "Für Lernende", for_tutors: "Für Kursanbieter",
    student_step_1: "Entdecken", student_desc_1: "Durchsuche hunderte lokale Kurse.",
    student_step_2: "Buchen", student_desc_2: "Sichere deinen Platz sofort.",
    student_step_3: "Lernen", student_desc_3: "Triff Experten und lerne Neues.",
    tutor_step_1: "Erstellen", tutor_desc_1: "Erstelle dein Profil kostenlos.",
    tutor_step_2: "Planen", tutor_desc_2: "Bestimme Datum, Ort und Preis.",
    tutor_step_3: "Verdienen", tutor_desc_3: "Automatische Auszahlung nach Kursbeginn.",
    cta_title: "Werde Kursanbieter", cta_subtitle: "Teile dein Wissen in der ganzen Schweiz. Bestimme deinen eigenen Zeitplan.", cta_btn: "Loslegen",
    
    // FOOTER
    footer_terms: "AGB", footer_privacy: "Datenschutz", footer_legal: "Impressum", footer_madein: "Made in Switzerland", footer_rights: "Alle Rechte vorbehalten.",
    footer_discover: "Entdecken", footer_support: "Support", footer_legal_header: "Rechtliches",

    contact_title: "Kontakt", contact_get_in_touch: "Schreib uns", 
    contact_lbl_name: "Name", contact_lbl_email: "E-Mail", contact_lbl_msg: "Nachricht", contact_lbl_subject: "Betreff",

    // --- NEW ABOUT PAGE (DE) ---
    about_hero_title: "Lernen passiert nicht nur online. Es passiert im echten Leben.",
    about_hero_teaser: "KursNavi bringt Dich und Kursanbieter zusammen – für Präsenzkurse in der Schweiz, die Können, Selbstvertrauen und neue Perspektiven schaffen. Einfach finden. Einfach buchen. Einfach teilnehmen.",
    about_mission_1_title: "Klarheit", about_mission_1_text: "Übersichtliche Kursangebote statt endloser Suche",
    about_mission_2_title: "Einfachheit", about_mission_2_text: "Buchen in wenigen Klicks, ohne E-Mail-Pingpong",
    about_mission_3_title: "Vertrauen", about_mission_3_text: "Geprüfte Anbieter und transparente Informationen",
    about_story_title: "Unsere Geschichte",
    about_timeline_1_title: "Die Beobachtung", about_timeline_1_text: "Wer einen passenden Kurs sucht, findet oft zu viel – oder das Richtige zu spät. Angebote sind verstreut über Websites, Social Media und PDFs.",
    about_timeline_2_title: "Die Herausforderung", about_timeline_2_text: "Kursanbieter investieren enorm viel Energie in Organisation und Sichtbarkeit – statt sich auf starke Lernmomente vor Ort zu konzentrieren.",
    about_timeline_3_title: "Die Lösung", about_timeline_3_text: "Darum bauen wir KursNavi: eine Plattform, die Übersicht schafft, Vertrauen aufbaut und Buchen leicht macht.",
    about_what_title: "Was wir tun (und warum es sich gut anfühlt)",
    about_what_intro: "KursNavi ist eine Plattform für Präsenzkurse in der Schweiz – von beruflicher Weiterbildung bis zu kreativen und praktischen Skills fürs Leben.",
    about_benefit_1: "Klare Kursübersichten statt endloser Suche",
    about_benefit_2: "Einfache Buchung statt Hin-und-her per E-Mail",
    about_benefit_3: "Professionelle Kursprofile statt unübersichtlicher Infos",
    about_benefit_4: "Ein Nutzererlebnis, das Vertrauen schafft – vom ersten Klick bis zur Teilnahme",
    about_micro_1: "Finden", about_micro_2: "Buchen", about_micro_3: "Loslegen",
    about_you_title: "Für Dich: Dein nächster Aha-Moment wartet",
    about_you_text: "Ob Du Dich beruflich weiterentwickeln möchtest, etwas Praktisches lernen willst oder einfach Lust auf Neues hast: Wir glauben an Lernen, das im Alltag ankommt. Präsenzkurse bringen Menschen zusammen – und schaffen Erlebnisse, die bleiben.",
    about_kids_title: "Für Kinder & Familien: Angebote, die Freude machen",
    about_kids_text: "Manchmal beginnt das Wichtigste ganz früh: Neugier, Mut, Kreativität, Bewegung, soziale Skills. Darum möchten wir auch Kinderangebote sichtbarer machen – von spielerischen Kursen bis zu kreativen Workshops.",
    about_kids_sub: "Ob Ferienkurs, Musik, Sport, Basteln oder Theater: Du sollst Kinderangebote schnell finden können.",
    about_prov_title: "Für Anbieter: Mehr Fokus auf Deine Kurse",
    about_prov_text: "Kursanbieter sind das Herz von KursNavi. Wir bauen Tools, mit denen Du Dein Angebot professionell präsentierst, Buchungen einfacher verwaltest und Deine Teilnehmenden gut informierst – ohne dass sich Dein Alltag nur noch nach Administration anfühlt.",
    about_promise_title: "Unser Versprechen",
    about_promise_text: "Wir wollen, dass gute Kurse nicht untergehen – und dass Du Angebote findest, die wirklich zu Deinen Zielen passen. KursNavi steht für Qualität, Klarheit und ein sympathisches Erlebnis – für Lernende, Familien und Anbieter.",
    about_cta_primary: "Kurse entdecken",
    about_cta_secondary: "Als Anbieter starten",

    profile_settings: "Profileinstellungen", lbl_city: "Meine Stadt / Ort", lbl_bio: "Über mich (Bio)", lbl_language: "Bevorzugte Sprache",
    profile_lang_note: "Wir verwenden dies für E-Mails und Webseiteninhalte.", btn_save: "Speichern",
    dash_overview: "Kursangebot", dash_profile: "Mein Profil", dash_settings: "Profil", dash_new_course: "Neuer Kurs",
    lbl_account_security: "Konto & Sicherheit", lbl_new_password: "Neues Passwort", lbl_confirm_password: "Passwort bestätigen",
    lbl_update_auth: "Zugangsdaten aktualisieren", msg_auth_success: "Konto aktualisiert!",

    // LEGAL MICRO-COPY
    legal_agree: "Ich akzeptiere die", legal_agb: "AGB", legal_and: "und habe die", legal_privacy: "Datenschutzerklärung", legal_read: "gelesen.",
    legal_provider_suffix: "inkl. Anbieterbedingungen", legal_mediator_note: "KursNavi ist Vermittlerin. Vertragspartner ist der Anbieter; bei Direktbuchungen bleibt die buchende Person zahlungspflichtig.",
    legal_provider_verified_tooltip: "Manuell geprüft von LifeSkills360 (Identität & Basisdaten).",

    // FAQ
    faq_title: "Häufige Fragen (FAQ)",
    faq_q1: "Was genau ist KursNavi?", faq_a1: "KursNavi ist der Schweizer Marktplatz für Kurse. Wir verbinden Menschen, die lernen wollen, mit Experten und Kursanbietern – für Präsenzkurse, Live-Online-Kurse oder Selbststudium.",
    faq_q2: "Ist die Kurssuche für mich kostenlos?", faq_a2: "Ja! Die Suche ist zu 100% kostenlos. Du zahlst nur den Kurspreis bei einer Buchung.",
    faq_q3: "Wie buche ich einen Kurs?", faq_a3: "Wähle einen Kurs und klicke auf 'Jetzt Buchen', um sicher online zu bezahlen – du erhältst sofort eine Bestätigung. Bei manchen Kursen kannst du stattdessen eine Kontaktanfrage senden, und der Anbieter meldet sich bei dir.",
    faq_q4: "Muss ich mich für eine Buchung registrieren?", faq_a4: "Ja, du benötigst einen kostenlosen Account, damit der Kursanbieter dich kontaktieren kann und wir dir die Buchungsbestätigung senden können.",
    faq_q5: "Wie bezahle ich den Kurs?", faq_a5: "Wir akzeptieren alle gängigen Kreditkarten und TWINT (via Stripe). Deine Zahlung wird sicher verwahrt.",
    faq_q6: "Sind die Kursanbieter auf KursNavi geprüft?", faq_a6: "Ja. Wir prüfen die Identität aller Anbieter. Anbieter mit dem Kennzeichen 'Verifiziert' haben zudem Diplome oder Zertifikate eingereicht, die wir manuell geprüft haben.",
    faq_q7: "Kann ich eine Buchung stornieren?", faq_a7: "Ja. Terminbuchungen kannst du bis 14 Tage vor dem Termin kostenlos im Dashboard stornieren. Flexible Buchungen kannst du innerhalb von 7 Tagen nach der Zahlung kostenlos stornieren. Der Betrag wird als Guthaben auf deinem KursNavi-Konto gutgeschrieben und automatisch bei der nächsten Buchung verrechnet. Nach Ablauf der automatischen Frist kannst du eine Kulanzanfrage an den Anbieter senden, der 0 %, 25 %, 50 % oder 100 % Rückerstattung bewilligen kann.",
    faq_q8: "Gibt es auch Kurse für Firmen oder Gruppen?", faq_a8: "Ja. Viele unserer Kursanbieter bieten private Gruppenkurse an. Nutze einfach den 'Kontakt'-Button auf dem Kursprofil.",
    faq_q9: "Ich finde meinen gewünschten Kurs nicht – was tun?", faq_a9: "Wir wachsen täglich! Schreib uns an info@kursnavi.ch mit deinem Kurswunsch – wir prüfen, ob wir einen passenden Anbieter finden können.",
    faq_q10: "Ich bin selbst Kursanbieter. Wie kann ich meine Kurse listen?", faq_a10: "Erstelle ein kostenloses Profil, bestätige deine E-Mail und klicke im Dashboard auf 'Neuer Kurs'. Es dauert keine 5 Minuten.",
    faq_q11: "Was bedeutet das 'Verifiziert'-Kennzeichen?", faq_a11: "Das 'Verifiziert'-Kennzeichen bedeutet, dass dieser Anbieter Zertifikate oder Diplome bei KursNavi eingereicht hat und wir diese manuell geprüft haben. Anbieter ohne dieses Kennzeichen sind nicht automatisch weniger qualifiziert – viele ausgezeichnete Anbieter haben den Verifizierungsprozess einfach (noch) nicht durchlaufen.",

    // AUTH NEW
    lbl_name_company: "Vollständiger Name / Firma",
    err_accept_terms: "Bitte akzeptieren Sie die AGB und die Datenschutzerklärung.",

    // AUTH LABELS
    auth_create_account: "Konto erstellen", auth_welcome_back: "Willkommen zurück",
    auth_i_am_a: "Ich bin...", auth_student: "Lernende/r", auth_teacher: "Kursanbieter",
    lbl_email: "E-Mail", lbl_password: "Passwort", lbl_confirm_password: "Passwort bestätigen",
    err_passwords_mismatch: "Passwörter stimmen nicht überein.",
    btn_signup: "Registrieren", btn_login: "Anmelden",
    auth_already_have: "Bereits ein Konto?", auth_dont_have: "Noch kein Konto?",
    link_login: "Anmelden", link_signup: "Registrieren",
    msg_welcome_back_toast: "Willkommen zurück!",
    // SUCCESS PAGE
    auth_success_title: "Vielen Dank für deine Anmeldung!",
    auth_success_text: "Wir haben dir einen Bestätigungslink per E-Mail gesendet. Bitte prüfe dein Postfach, um dein Konto zu aktivieren.",
    btn_go_to_login: "Zum Login",
    // PASSWORD RESET
    setpw_forgot_link: "Passwort vergessen?",
    setpw_forgot_title: "Passwort vergessen?",
    setpw_forgot_text: "Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.",
    setpw_btn_send_link: "Link senden",
    setpw_email_sent_title: "E-Mail gesendet",
    setpw_email_sent_text: "Wir haben dir einen Link zum Zurücksetzen gesendet. Bitte prüfe dein Postfach und den Spam-Ordner.",
    setpw_new_title: "Neues Passwort setzen",
    setpw_btn_save: "Passwort speichern",
    setpw_err_min_length: "Das Passwort muss mindestens 6 Zeichen lang sein.",
    setpw_success_changed: "Passwort erfolgreich aktualisiert!",
    setpw_back_to_login: "Zurück zum Login",
  },
  fr: {
    nav_explore: "Explorer", nav_about: "À propos", nav_contact: "Contact", nav_login: "Connexion", nav_logout: "Déconnexion", nav_dashboard: "Tableau de bord",
    nav_private: "Privé & Loisirs", nav_professional: "Professionnel", nav_kids: "Enfants", nav_howitworks: "Comment ça marche",
    nav_dashboard: "Mon Espace", 
    nav_news: "Actualités", nav_providers: "Recherche prestataires", 
    nav_for_providers: "Pour Prestataires",hero_title: "Découvrez des cours.", hero_subtitle: "Apprenez localement.",
    search_placeholder: "Que voulez-vous apprendre?", filter_label_cat: "Catégorie", filter_label_loc: "Lieu", btn_search: "Rechercher", search_hint_boolean: "Astuce: Combinez les termes avec AND ou OR (ex. \"Yoga AND Zurich\")",
    no_results: "Aucun cours trouvé.", btn_book: "Réserver", btn_pay: "Payer et réserver", btn_publish: "Publier", btn_send: "Envoyer",
    
    // ADMIN
    admin_login_title: "Centre de Contrôle KursNavi", admin_pass_placeholder: "Entrer le code", admin_btn_access: "Accéder au système",
    admin_tab_teachers: "Prestataires", admin_tab_students: "Apprenants", admin_tab_courses: "Cours",
    admin_col_name: "Nom", admin_col_email: "E-mail", admin_col_status: "Statut", admin_col_actions: "Actions",
    admin_btn_verify: "Vérifier Pro", admin_btn_unverify: "Retirer Pro", admin_verified: "Pro Vérifié",

    // HOME PAGE
    home_headline: "Naviguez vers votre avenir avec KursNavi",
    home_subhead: "Découvrez des cours, acquérez de nouvelles compétences et libérez votre potentiel avec des experts.",
    home_verified_tutors: "Prestataires vérifiés",
    home_students: "Apprenants",
    home_rating: "Évaluation",
    home_path_title: "Choisissez votre voie",
    home_path_sub: "Explorez nos domaines d'apprentissage les plus populaires",
    home_card_prof_sub: "Avancez votre carrière avec des compétences certifiées.",
    home_card_priv_sub: "Cuisine, Photographie, Sport & plus.",
    home_card_kids_sub: "Cours amusants et stimulants pour les enfants.",
    btn_explore: "EXPLORER",

    // LANDING TITLES
    landing_priv_title: "Libérez votre passion.", landing_priv_sub: "Cours de loisirs",
    landing_prof_title: "Boostez votre carrière.", landing_prof_sub: "Formation professionnelle",
    landing_kids_title: "Apprendre en s'amusant.", landing_kids_sub: "Cours pour enfants",

    // SEARCH FILTERS
    search_refine: "Affiner la recherche...",
    lbl_max_price: "Max CHF",
    lbl_type: "Type", lbl_area: "Domaine", lbl_specialty: "Spécialité", 
    msg_no_courses: "Aucun cours disponible.", msg_all_topics: "Tous les sujets.", 
    msg_select_area: "Choisissez un domaine.", lbl_select_cat: "Choisir catégorie",
    lbl_professional_filter: "Vérifié",
    tooltip_pro_verified: "Prestataire de cours vérifié par KursNavi.",
    tooltip_pro_verified_long: "Cours de prestataires dont les qualifications ont été vérifiées par KursNavi.",
    lbl_direct_booking_filter: "Réservation directe",
    tooltip_direct_booking: "Réserver et payer directement sur KursNavi.",
    tooltip_direct_booking_long: "Ces cours peuvent être réservés et payés directement sur notre plateforme - sans site externe ni formulaire de contact.",

    edit_course: "Modifier le cours", edit_course_sub: "Mettre à jour les détails.",
    create_course: "Créer un cours", create_course_sub: "Partagez vos compétences.",
    lbl_title: "Titre du cours", lbl_skill_level: "Niveau", lbl_target_group: "Groupe cible", lbl_pro_checkbox: "Prestataire vérifié",
    lbl_cat_class: "Classification", lbl_type: "Type", lbl_area: "Domaine", lbl_specialty: "Spécialité",
    lbl_price: "Prix (CHF)", lbl_canton: "Canton", lbl_specific_address: "Adresse précise",
    lbl_session_count: "Nombre de sessions", lbl_session_length: "Durée session", lbl_start_date: "Date de début",
    lbl_website: "Site web (Optionnel)", lbl_learn_goals: "Objectifs d'apprentissage", lbl_prereq: "Prérequis",
    btn_update: "Mettre à jour", btn_back_dash: "Retour au tableau de bord",
    opt_all_levels: "Tous niveaux", opt_beginner: "Débutant", opt_advanced: "Avancé",
    opt_adults: "Adultes", opt_teens: "Ados", opt_kids: "Enfants",

    form_title: "Proposer un cours", success_msg: "Succès!", currency: "CHF", admin_panel: "Panneau d'administration",
    teacher_dash: "Tableau de bord Prestataire", student_dash: "Mes apprentissages",
    login_title: "Bienvenue", my_bookings: "Mes réservations",
    booking_confirmed: "Confirmé",
    no_bookings_yet: "Vous n'avez pas encore réservé de cours.",
    no_cancellation_hint: "Après le délai d'annulation automatique, vous pouvez envoyer une demande de geste commercial au prestataire via votre tableau de bord. Le prestataire peut accorder 0 %, 25 %, 50 % ou 100 % de remboursement.",
    booking_success_note: "Les réservations avec date fixe peuvent être annulées gratuitement jusqu'à 14 jours avant le cours. Les réservations flexibles peuvent être annulées gratuitement dans les 7 jours suivant le paiement. Ensuite, vous pouvez envoyer une demande de geste commercial au prestataire.",
    lbl_description: "Description", lbl_address: "Lieu", lbl_duration: "Durée", lbl_sessions: "sessions",
    lbl_objectives: "Ce que vous apprendrez", lbl_prerequisites: "Prérequis",
    how_it_works: "Comment ça marche", for_students: "Pour Apprenants", for_tutors: "Pour Prestataires",
    student_step_1: "Découvrir", student_desc_1: "Parcourez des centaines de cours.",
    student_step_2: "Réserver", student_desc_2: "Réservez votre place instantanément.",
    student_step_3: "Apprendre", student_desc_3: "Rencontrez des experts locaux.",
    tutor_step_1: "Créer", tutor_desc_1: "Créez votre profil gratuitement.",
    tutor_step_2: "Planifier", tutor_desc_2: "Définissez dates, lieux et prix.",
    tutor_step_3: "Gagner", tutor_desc_3: "Paiement automatique après le cours.",
    cta_title: "Devenez Prestataire", cta_subtitle: "Partagez vos compétences à travers la Suisse.", cta_btn: "Commencer",
    
    // FOOTER
    footer_terms: "CGV", footer_privacy: "Confidentialité", footer_legal: "Mentions légales", footer_madein: "Fabriqué en Suisse", footer_rights: "Droits réservés.",
    footer_discover: "Découvrir", footer_support: "Support", footer_legal_header: "Juridique",

    contact_title: "Contact", contact_get_in_touch: "Contactez-nous", 
    contact_lbl_name: "Nom", contact_lbl_email: "E-mail", contact_lbl_msg: "Message", contact_lbl_subject: "Objet",

    // --- NEW ABOUT PAGE (FR) ---
    about_hero_title: "L'apprentissage ne se fait pas seulement en ligne. Il se vit.",
    about_hero_teaser: "KursNavi vous rapproche des prestataires de cours – pour des cours en présentiel en Suisse qui créent des compétences, de la confiance et de nouvelles perspectives.",
    about_mission_1_title: "Clarté", about_mission_1_text: "Des aperçus de cours clairs au lieu d'une recherche sans fin",
    about_mission_2_title: "Simplicité", about_mission_2_text: "Réservez en quelques clics, sans échanges d'e-mails",
    about_mission_3_title: "Confiance", about_mission_3_text: "Prestataires vérifiés et informations transparentes",
    about_story_title: "Notre Histoire",
    about_timeline_1_title: "L'observation", about_timeline_1_text: "Celui qui cherche un cours adapté trouve souvent trop – ou le bon trop tard. Les offres sont dispersées sur des sites, réseaux sociaux et PDF.",
    about_timeline_2_title: "Le défi", about_timeline_2_text: "Les prestataires investissent énormément d'énergie dans l'organisation et la visibilité – au lieu de se concentrer sur les moments d'apprentissage.",
    about_timeline_3_title: "La solution", about_timeline_3_text: "C'est pourquoi nous construisons KursNavi : une plateforme qui crée de la clarté, établit la confiance et facilite la réservation.",
    about_what_title: "Ce que nous faisons",
    about_what_intro: "KursNavi est une plateforme pour les cours en présentiel en Suisse – de la formation professionnelle aux compétences créatives et pratiques pour la vie.",
    about_benefit_1: "Des aperçus clairs au lieu d'une recherche sans fin",
    about_benefit_2: "Réservation simple au lieu d'échanges d'e-mails",
    about_benefit_3: "Profils de cours professionnels",
    about_benefit_4: "Une expérience utilisateur qui crée la confiance",
    about_micro_1: "Trouver", about_micro_2: "Réserver", about_micro_3: "Commencer",
    about_you_title: "Pour Vous : Votre prochain déclic vous attend",
    about_you_text: "Que vous souhaitiez vous développer professionnellement ou apprendre quelque chose de pratique : Nous croyons en l'apprentissage qui s'ancre dans le quotidien.",
    about_kids_title: "Pour Enfants & Familles",
    about_kids_text: "Parfois, le plus important commence très tôt : curiosité, courage, créativité. C'est pourquoi nous voulons rendre les offres pour enfants plus visibles.",
    about_kids_sub: "Cours de vacances, musique, sport, bricolage ou théâtre : trouvez rapidement ce qui convient à votre enfant.",
    about_prov_title: "Pour Prestataires : Plus de focus sur vos cours",
    about_prov_text: "Les prestataires sont le cœur de KursNavi. Nous construisons des outils avec lesquels vous présentez votre offre professionnellement et gérez les réservations plus facilement.",
    about_promise_title: "Notre Promesse",
    about_promise_text: "Nous voulons que les bons cours ne se perdent pas. KursNavi est synonyme de qualité, de clarté et d'une expérience sympathique.",
    about_cta_primary: "Découvrir les cours",
    about_cta_secondary: "Publier un cours",

    profile_settings: "Paramètres du profil", lbl_city: "Ma Ville / Localité", lbl_bio: "À propos de moi", lbl_language: "Langue préférée",
    profile_lang_note: "Nous utiliserons ceci pour les e-mails.", btn_save: "Enregistrer",
    dash_overview: "Offre de cours", dash_profile: "Mon Profil", dash_settings: "Profil", dash_new_course: "Nouveau Cours",
    lbl_account_security: "Compte et Sécurité", lbl_new_password: "Nouveau mot de passe", lbl_confirm_password: "Confirmer",
    lbl_update_auth: "Mettre à jour", msg_auth_success: "Compte mis à jour !",

    // LEGAL MICRO-COPY
    legal_agree: "J'accepte les", legal_agb: "CG", legal_and: "et j'ai lu la", legal_privacy: "Déclaration de confidentialité", legal_read: ".",
    legal_provider_suffix: "y compris les conditions du prestataire", legal_mediator_note: "KursNavi est intermédiaire. Contrat avec le prestataire.",
    legal_provider_verified_tooltip: "Vérifié manuellement par LifeSkills360.",

    // FAQ
    faq_title: "Questions Fréquentes (FAQ)",
    faq_q1: "Qu'est-ce que KursNavi exactement?", faq_a1: "KursNavi est la place de marché suisse pour les cours. Nous connectons les apprenants aux experts et prestataires – pour des cours en présentiel, des cours en ligne en direct ou de l'auto-apprentissage.",
    faq_q2: "La recherche de cours est-elle gratuite?", faq_a2: "Oui ! La recherche est 100% gratuite. Vous ne payez que le prix du cours lors de la réservation.",
    faq_q3: "Comment réserver un cours?", faq_a3: "Choisissez un cours et cliquez sur 'Réserver' pour payer en toute sécurité en ligne – vous recevrez une confirmation instantanée. Pour certains cours, vous pouvez envoyer une demande de contact et le prestataire vous répondra.",
    faq_q4: "Dois-je m'inscrire pour réserver?", faq_a4: "Oui, vous avez besoin d'un compte gratuit pour que le prestataire puisse vous contacter.",
    faq_q5: "Comment payer le cours?", faq_a5: "Nous acceptons les cartes de crédit et TWINT. Votre paiement est sécurisé.",
    faq_q6: "Les prestataires sont-ils vérifiés?", faq_a6: "Oui. Nous vérifions l'identité de tous les prestataires. Ceux marqués comme 'Vérifié' ont aussi soumis des diplômes ou certificats que nous avons vérifiés manuellement.",
    faq_q7: "Puis-je annuler une réservation?", faq_a7: "Oui. Les réservations à date fixe peuvent être annulées gratuitement depuis le tableau de bord jusqu'à 14 jours avant le cours. Les réservations flexibles peuvent être annulées gratuitement dans les 7 jours suivant le paiement. Le montant est crédité sur votre compte KursNavi et automatiquement déduit lors de votre prochaine réservation. Après ce délai, vous pouvez envoyer une demande de geste commercial au prestataire, qui peut accorder un remboursement de 0 %, 25 %, 50 % ou 100 %.",
    faq_q8: "Y a-t-il des cours pour entreprises?", faq_a8: "Oui. Beaucoup de nos prestataires proposent des cours privés. Utilisez le bouton 'Contact'.",
    faq_q9: "Je ne trouve pas mon cours?", faq_a9: "Nous grandissons chaque jour ! Écrivez-nous à info@kursnavi.ch avec votre souhait de cours – nous vérifierons si nous pouvons trouver un prestataire adapté.",
    faq_q10: "Je suis prestataire. Comment lister des cours?", faq_a10: "Créez un profil gratuit et cliquez sur 'Nouveau Cours' dans le tableau de bord.",
    faq_q11: "Que signifie le badge 'Vérifié'?", faq_a11: "Le badge 'Vérifié' signifie que ce prestataire a soumis des certificats ou diplômes à KursNavi et que nous les avons vérifiés manuellement. Les prestataires sans ce badge ne sont pas automatiquement moins qualifiés – beaucoup d'excellents prestataires n'ont simplement pas (encore) effectué notre processus de vérification.",

    // AUTH NEW
    lbl_name_company: "Nom complet / Entreprise",
    err_accept_terms: "Veuillez accepter les conditions et la politique de confidentialité.",

    // AUTH LABELS
    auth_create_account: "Créer un compte", auth_welcome_back: "Bon retour",
    auth_i_am_a: "Je suis...", auth_student: "Apprenant", auth_teacher: "Prestataire de cours",
    lbl_email: "E-mail", lbl_password: "Mot de passe", lbl_confirm_password: "Confirmer le mot de passe",
    err_passwords_mismatch: "Les mots de passe ne correspondent pas.",
    btn_signup: "S'inscrire", btn_login: "Se connecter",
    auth_already_have: "Déjà un compte ?", auth_dont_have: "Pas encore de compte ?",
    link_login: "Se connecter", link_signup: "S'inscrire",
    msg_welcome_back_toast: "Bon retour !",
    // SUCCESS PAGE
    auth_success_title: "Merci pour votre inscription !",
    auth_success_text: "Nous avons envoyé un lien de confirmation à votre e-mail. Veuillez vérifier votre boîte de réception pour activer votre compte.",
    btn_go_to_login: "Aller à la connexion",
    // PASSWORD RESET
    setpw_forgot_link: "Mot de passe oublié ?",
    setpw_forgot_title: "Mot de passe oublié ?",
    setpw_forgot_text: "Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.",
    setpw_btn_send_link: "Envoyer le lien",
    setpw_email_sent_title: "E-mail envoyé",
    setpw_email_sent_text: "Nous vous avons envoyé un lien de réinitialisation. Veuillez vérifier votre boîte de réception et votre dossier spam.",
    setpw_new_title: "Définir un nouveau mot de passe",
    setpw_btn_save: "Enregistrer le mot de passe",
    setpw_err_min_length: "Le mot de passe doit contenir au moins 6 caractères.",
    setpw_success_changed: "Mot de passe mis à jour avec succès !",
    setpw_back_to_login: "Retour à la connexion",
  },
  it: {
    nav_explore: "Esplora", nav_about: "Chi siamo", nav_contact: "Contatto", nav_login: "Accedi", nav_logout: "Esci", nav_dashboard: "Dashboard",
    nav_private: "Privato & Hobby", nav_professional: "Professionale", nav_kids: "Bambini", nav_howitworks: "Come funziona",
    nav_dashboard: "Mia Area", 
    nav_news: "Novità", nav_providers: "Ricerca fornitori", 
    nav_for_providers: "Per Fornitori",hero_title: "Scopri corsi vicino a te.", hero_subtitle: "Dallo jodel a Appenzello alla programmazione a Zurigo.",
    search_placeholder: "Cosa vuoi imparare?", filter_label_cat: "Categoria", filter_label_loc: "Luogo", btn_search: "Cerca", search_hint_boolean: "Suggerimento: Combina i termini con AND o OR (es. \"Yoga AND Zurigo\")",
    no_results: "Nessun corso trovato.", btn_book: "Prenota", btn_pay: "Paga & Prenota", btn_publish: "Pubblica", btn_send: "Invia",
    
    // ADMIN
    admin_login_title: "Centro di Controllo KursNavi", admin_pass_placeholder: "Inserisci codice", admin_btn_access: "Accedi al sistema",
    admin_tab_teachers: "Fornitori", admin_tab_students: "Apprendenti", admin_tab_courses: "Corsi",
    admin_col_name: "Nome", admin_col_email: "E-mail", admin_col_status: "Stato", admin_col_actions: "Azioni",
    admin_btn_verify: "Verifica Pro", admin_btn_unverify: "Rimuovi Pro", admin_verified: "Pro Verificato",

    // HOME PAGE
    home_headline: "Naviga il tuo futuro con KursNavi",
    home_subhead: "Scopri corsi, acquisisci nuove competenze e sblocca il tuo potenziale con esperti.",
    home_verified_tutors: "Fornitori verificati",
    home_students: "Apprendenti",
    home_rating: "Valutazione",
    home_path_title: "Scegli il tuo percorso",
    home_path_sub: "Esplora i nostri percorsi di apprendimento più popolari",
    home_card_prof_sub: "Avanza nella tua carriera con competenze certificate.",
    home_card_priv_sub: "Cucina, Fotografia, Sport & altro.",
    home_card_kids_sub: "Corsi divertenti e coinvolgenti per bambini.",
    btn_explore: "ESPLORA",

    // LANDING TITLES
    landing_priv_title: "Scatena la tua passione.", landing_priv_sub: "Corsi per il tempo libero",
    landing_prof_title: "Spingi la tua carriera.", landing_prof_sub: "Formazione professionale",
    landing_kids_title: "Imparare giocando.", landing_kids_sub: "Corsi per bambini",

    // SEARCH FILTERS
    search_refine: "Affina la ricerca...",
    lbl_max_price: "Max CHF",
    lbl_type: "Tipo", lbl_area: "Area", lbl_specialty: "Specialità", 
    msg_no_courses: "Nessun corso disponibile.", msg_all_topics: "Tutti gli argomenti.", 
    msg_select_area: "Scegli un'area.", lbl_select_cat: "Scegli categoria",
    lbl_professional_filter: "Verificato",
    tooltip_pro_verified: "Fornitore di corsi verificato da KursNavi.",
    tooltip_pro_verified_long: "Corsi di fornitori le cui qualifiche sono state verificate da KursNavi.",
    lbl_direct_booking_filter: "Prenotazione diretta",
    tooltip_direct_booking: "Prenota e paga direttamente su KursNavi.",
    tooltip_direct_booking_long: "Questi corsi possono essere prenotati e pagati direttamente sulla nostra piattaforma - senza sito esterno o modulo di contatto.",

    edit_course: "Modifica corso", edit_course_sub: "Aggiorna i dettagli.",
    create_course: "Crea corso", create_course_sub: "Condividi le tue abilità.",
    lbl_title: "Titolo del corso", lbl_skill_level: "Livello", lbl_target_group: "Gruppo target", lbl_pro_checkbox: "Fornitore verificato",
    lbl_cat_class: "Classificazione", lbl_type: "Tipo", lbl_area: "Area", lbl_specialty: "Specialità",
    lbl_price: "Prezzo (CHF)", lbl_canton: "Cantone", lbl_specific_address: "Indirizzo specifico",
    lbl_session_count: "Numero di sessioni", lbl_session_length: "Durata sessione", lbl_start_date: "Data di inizio",
    lbl_website: "Sito web (Opzionale)", lbl_learn_goals: "Obiettivi di apprendimento", lbl_prereq: "Prerequisiti",
    btn_update: "Aggiorna corso", btn_back_dash: "Torna alla dashboard",
    opt_all_levels: "Tutti i livelli", opt_beginner: "Principiante", opt_advanced: "Avanzato",
    opt_adults: "Adulti", opt_teens: "Adolescenti", opt_kids: "Bambini",

    form_title: "Offri un corso", success_msg: "Fatto!", currency: "CHF", admin_panel: "Pannello di Amministrazione",
    teacher_dash: "Dashboard Fornitore", student_dash: "I miei corsi",
    login_title: "Benvenuto", my_bookings: "Le mie prenotazioni",
    booking_confirmed: "Confermato",
    no_bookings_yet: "Non hai ancora prenotato nessun corso.",
    no_cancellation_hint: "Dopo la finestra automatica di cancellazione puoi inviare una richiesta di cortesia al fornitore tramite la dashboard. Il fornitore può concedere uno rimborso del 0 %, 25 %, 50 % o 100 %.",
    booking_success_note: "Le prenotazioni con data fissa possono essere annullate gratuitamente fino a 14 giorni prima del corso. Le prenotazioni flessibili possono essere annullate gratuitamente entro 7 giorni dal pagamento. Successivamente puoi inviare una richiesta di cortesia al fornitore.",
    lbl_description: "Descrizione", lbl_address: "Luogo", lbl_duration: "Durata", lbl_sessions: "sessioni",
    lbl_objectives: "Cosa imparerai", lbl_prerequisites: "Prerequisiti",
    how_it_works: "Come funziona", for_students: "Per Apprendenti", for_tutors: "Per Fornitori di Corsi",
    student_step_1: "Scopri", student_desc_1: "Sfoglia centinaia di corsi locali unici.",
    student_step_2: "Prenota", student_desc_2: "Assicura il tuo posto istantaneamente.",
    student_step_3: "Impara", student_desc_3: "Incontra esperti locali e impara.",
    tutor_step_1: "Crea", tutor_desc_1: "Crea il tuo profilo gratuitamente.",
    tutor_step_2: "Pianifica", tutor_desc_2: "Imposta date, luogo e prezzo.",
    tutor_step_3: "Guadagna", tutor_desc_3: "Pagamento automatico dopo il corso.",
    cta_title: "Diventa Fornitore di Corsi", cta_subtitle: "Condividi le tue competenze in tutta la Svizzera.", cta_btn: "Inizia",
    
    // FOOTER
    footer_terms: "Termini", footer_privacy: "Privacy", footer_legal: "Note legali", footer_madein: "Made in Switzerland", footer_rights: "Tutti i diritti riservati.",
    footer_discover: "Scopri", footer_support: "Supporto", footer_legal_header: "Legale",

    contact_title: "Contatto", contact_get_in_touch: "Scrivici", 
    contact_lbl_name: "Nome", contact_lbl_email: "E-mail", contact_lbl_msg: "Messaggio", contact_lbl_subject: "Oggetto",

    // --- NEW ABOUT PAGE (IT) ---
    about_hero_title: "L'apprendimento non avviene solo online. Succede nella vita reale.",
    about_hero_teaser: "KursNavi unisce te e i fornitori di corsi – per corsi in presenza in Svizzera che creano abilità, fiducia e nuove prospettive.",
    about_mission_1_title: "Chiarezza", about_mission_1_text: "Panoramiche dei corsi chiare invece di ricerche infinite",
    about_mission_2_title: "Semplicità", about_mission_2_text: "Prenota in pochi clic, senza scambi di e-mail",
    about_mission_3_title: "Fiducia", about_mission_3_text: "Fornitori verificati e informazioni trasparenti",
    about_story_title: "La nostra storia",
    about_timeline_1_title: "L'osservazione", about_timeline_1_text: "Chi cerca un corso adatto trova spesso troppo – o quello giusto troppo tardi. Le offerte sono sparse tra siti web, social media e PDF.",
    about_timeline_2_title: "La sfida", about_timeline_2_text: "I fornitori investono enormi energie nell'organizzazione e nella visibilità – invece di concentrarsi su forti momenti di apprendimento.",
    about_timeline_3_title: "La soluzione", about_timeline_3_text: "Ecco perché costruiamo KursNavi: una piattaforma che crea chiarezza, costruisce fiducia e rende facile la prenotazione.",
    about_what_title: "Cosa facciamo",
    about_what_intro: "KursNavi è una piattaforma per corsi in presenza in Svizzera – dalla formazione professionale alle abilità creative e pratiche per la vita.",
    about_benefit_1: "Panoramiche chiare invece di ricerche infinite",
    about_benefit_2: "Prenotazione semplice invece di scambi di e-mail",
    about_benefit_3: "Profili dei corsi professionali",
    about_benefit_4: "Un'esperienza utente che crea fiducia",
    about_micro_1: "Trova", about_micro_2: "Prenota", about_micro_3: "Inizia",
    about_you_title: "Per Te: Il tuo prossimo momento Aha ti aspetta",
    about_you_text: "Che tu voglia svilupparti professionalmente o imparare qualcosa di pratico: Crediamo nell'apprendimento che arriva nella vita di tutti i giorni.",
    about_kids_title: "Per Bambini & Famiglie",
    about_kids_text: "A volte la cosa più importante inizia molto presto: curiosità, coraggio, creatività. Ecco perché vogliamo rendere più visibili le offerte per bambini.",
    about_kids_sub: "Corsi estivi, musica, sport, lavoretti o teatro: trova rapidamente ciò di cui il tuo bambino ha bisogno.",
    about_prov_title: "Per Fornitori: Più focus sui tuoi corsi",
    about_prov_text: "I fornitori sono il cuore di KursNavi. Costruiamo strumenti con cui presenti la tua offerta in modo professionale e gestisci le prenotazioni più facilmente.",
    about_promise_title: "La nostra promessa",
    about_promise_text: "Vogliamo che i buoni corsi non vadano persi. KursNavi è sinonimo di qualità, chiarezza e un'esperienza piacevole.",
    about_cta_primary: "Scopri i corsi",
    about_cta_secondary: "Pubblica un corso",

    profile_settings: "Impostazioni Profilo", lbl_city: "La mia Città", lbl_bio: "Su di me (Bio)", lbl_language: "Lingua preferita",
    profile_lang_note: "Useremo questa lingua per email e sito web.", btn_save: "Salva modifiche",
    dash_overview: "Offerta corsi", dash_profile: "Il mio Profilo", dash_settings: "Profilo", dash_new_course: "Nuovo Corso",
    lbl_account_security: "Sicurezza Account", lbl_new_password: "Nuova Password", lbl_confirm_password: "Conferma",
    lbl_update_auth: "Aggiorna Account", msg_auth_success: "Account aggiornato!",

    // LEGAL MICRO-COPY
    legal_agree: "Accetto i", legal_agb: "CGC", legal_and: "e ho letto la", legal_privacy: "Privacy Policy", legal_read: ".",
    legal_provider_suffix: "incl. condizioni del fornitore", legal_mediator_note: "KursNavi è intermediario. Il contratto è con il fornitore.",
    legal_provider_verified_tooltip: "Verificato manualmente da LifeSkills360.",

    // FAQ
    faq_title: "Domande Frequenti (FAQ)",
    faq_q1: "Cos'è esattamente KursNavi?", faq_a1: "KursNavi è il mercato svizzero per i corsi. Mettiamo in contatto chi vuole imparare con esperti e fornitori di corsi – per corsi in presenza, corsi online dal vivo o studio autonomo.",
    faq_q2: "La ricerca dei corsi è gratuita?", faq_a2: "Sì! La ricerca è gratuita al 100%. Paghi solo il costo del corso al momento della prenotazione.",
    faq_q3: "Come prenotare un corso?", faq_a3: "Scegli un corso e clicca su 'Prenota ora' per pagare in modo sicuro online – riceverai una conferma immediata. Per alcuni corsi puoi inviare una richiesta di contatto e il fornitore ti risponderà.",
    faq_q4: "Devo registrarmi per prenotare?", faq_a4: "Sì, hai bisogno di un account gratuito in modo che il fornitore del corso possa contattarti.",
    faq_q5: "Come pago il corso?", faq_a5: "Accettiamo carte di credito e TWINT. Il tuo pagamento è al sicuro.",
    faq_q6: "I fornitori sono verificati?", faq_a6: "Sì. Verifichiamo l'identità di tutti i fornitori. Quelli contrassegnati come 'Verificato' hanno anche inviato diplomi o certificati che abbiamo verificato manualmente.",
    faq_q7: "Posso cancellare una prenotazione?", faq_a7: "Sì. Le prenotazioni con data fissa possono essere annullate gratuitamente dalla dashboard fino a 14 giorni prima del corso. Le prenotazioni flessibili possono essere annullate gratuitamente entro 7 giorni dal pagamento. L'importo viene accreditato sul tuo conto KursNavi e detratto automaticamente dalla prossima prenotazione. Dopo tale termine puoi inviare una richiesta di cortesia al fornitore, che può approvare un rimborso del 0 %, 25 %, 50 % o 100 %.",
    faq_q8: "Ci sono corsi per aziende?", faq_a8: "Sì. Molti dei nostri fornitori offrono corsi privati. Usa il pulsante 'Contatto'.",
    faq_q9: "Non trovo il corso che cerco?", faq_a9: "Cresciamo ogni giorno! Scrivici a info@kursnavi.ch con il tuo desiderio di corso – verificheremo se possiamo trovare un fornitore adatto.",
    faq_q10: "Sono un fornitore di corsi. Come inserisco i corsi?", faq_a10: "Crea un profilo gratuito e clicca su 'Nuovo Corso' nella dashboard.",
    faq_q11: "Cosa significa il badge 'Verificato'?", faq_a11: "Il badge 'Verificato' significa che questo fornitore ha inviato certificati o diplomi a KursNavi e che li abbiamo verificati manualmente. I fornitori senza questo badge non sono automaticamente meno qualificati – molti eccellenti fornitori semplicemente non hanno (ancora) completato il nostro processo di verifica.",

    // AUTH NEW
    lbl_name_company: "Nome completo / Azienda",
    err_accept_terms: "Si prega di accettare i termini e la politica sulla privacy.",

    // AUTH LABELS
    auth_create_account: "Crea account", auth_welcome_back: "Bentornato",
    auth_i_am_a: "Sono un...", auth_student: "Apprendente", auth_teacher: "Fornitore di corsi",
    lbl_email: "E-mail", lbl_password: "Password", lbl_confirm_password: "Conferma password",
    err_passwords_mismatch: "Le password non corrispondono.",
    btn_signup: "Registrati", btn_login: "Accedi",
    auth_already_have: "Hai già un account?", auth_dont_have: "Non hai un account?",
    link_login: "Accedi", link_signup: "Registrati",
    msg_welcome_back_toast: "Bentornato!",
    // SUCCESS PAGE
    auth_success_title: "Grazie per la registrazione!",
    auth_success_text: "Abbiamo inviato un link di conferma alla tua email. Controlla la tua casella di posta per attivare il tuo account.",
    btn_go_to_login: "Vai al login",
    // PASSWORD RESET
    setpw_forgot_link: "Password dimenticata?",
    setpw_forgot_title: "Password dimenticata?",
    setpw_forgot_text: "Inserisci il tuo indirizzo e-mail e ti invieremo un link per reimpostare la tua password.",
    setpw_btn_send_link: "Invia il link",
    setpw_email_sent_title: "E-mail inviata",
    setpw_email_sent_text: "Ti abbiamo inviato un link per reimpostare la password. Controlla la tua casella di posta e la cartella spam.",
    setpw_new_title: "Imposta nuova password",
    setpw_btn_save: "Salva password",
    setpw_err_min_length: "La password deve contenere almeno 6 caratteri.",
    setpw_success_changed: "Password aggiornata con successo!",
    setpw_back_to_login: "Torna al login",
  }
};
