/**
 * Bereichs-Landingpage Configuration
 *
 * Konfiguration für Level-2-Landingpages (Bereiche/Themenwelten).
 * Jeder Eintrag definiert Content, Szenarien, Suchlinks und FAQs
 * für einen spezifischen Bereich.
 *
 * URL-Struktur: /bereich/{segment}/{slug}
 */

export const BEREICH_LANDING_CONFIG = {
  sport_fitness_beruf: {
    slug: 'sport-fitness-berufsausbildung',
    segment: 'beruflich',
    areaSlug: 'sport_fitness_beruf',
    typeKey: 'beruflich',
    title: {
      de: 'Sport & Fitness — Finde deine Ausbildung',
      en: 'Sports & Fitness — Find Your Training',
      fr: 'Sport & Fitness — Trouve ta formation',
      it: 'Sport & Fitness — Trova la tua formazione'
    },
    subtitle: {
      de: 'Fitnesstrainer, Personal Training, Group Fitness und mehr',
      en: 'Fitness Trainer, Personal Training, Group Fitness and more',
      fr: 'Coach fitness, entraînement personnel, fitness en groupe et plus',
      it: 'Istruttore fitness, personal training, fitness di gruppo e altro'
    },
    heroImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=2000',

    // Szenario-Ansprachen für die Hero-Section
    scenarios: [
      { slug: 'berufseinstieg', icon: '🎓', label: { de: 'Berufseinstieg' }, text: { de: 'Du willst Fitnesstrainer werden? Starte mit der Basis-Ausbildung.' }, searchParams: { spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' } },
      { slug: 'quereinstieg', icon: '🔄', label: { de: 'Quereinstieg' }, text: { de: 'Quereinstieg in die Fitnessbranche? Wir zeigen dir den Weg.' }, searchParams: { spec: 'Fitness-Trainer-Ausbildung' } },
      { slug: 'weiterbildung', icon: '📈', label: { de: 'Weiterbildung' }, text: { de: 'Schon Trainer? Spezialisiere dich in Functional Training, Ernährung oder Personal Training.' }, searchParams: { spec: 'Trainingsmethoden & Spezialisierungen' } },
      { slug: 'diplom-aufstieg', icon: '🏆', label: { de: 'Diplom & Aufstieg' }, text: { de: 'Bereit für den nächsten Schritt? Diplom-Lehrgang und eidg. Fachausweis.' }, searchParams: { spec: 'Zertifikate & Prüfungsvorbereitung' } },
      { slug: 'nebenerwerb', icon: '⚡', label: { de: 'Nebenerwerb' }, text: { de: 'Deine Leidenschaft zum Beruf machen — auch nebenberuflich.' }, searchParams: { spec: 'Group-Fitness / Kursleitung' } },
      { slug: 'selbststaendigkeit', icon: '🏢', label: { de: 'Selbstständigkeit' }, text: { de: 'Eigenes Studio? Lerne alles über Business, Recht und Versicherung.' }, searchParams: { spec: 'Business & Selbstständigkeit' } },
      { slug: 'spezialisierung', icon: '🎯', label: { de: 'Spezialisierung' }, text: { de: 'Rückentraining, Antara®, Kampfsport — finde deine Nische.' }, searchParams: { spec: 'Trainingsmethoden & Spezialisierungen' } },
      { slug: 'zertifizierung', icon: '✅', label: { de: 'Zertifizierung' }, text: { de: 'Qualitop, QualiCert, eidg. FA — welches Zertifikat passt zu dir?' }, searchParams: { spec: 'Zertifikate & Prüfungsvorbereitung' } },
    ],

    // L3 Specialty descriptions
    specialtyDescriptions: {
      'Fitness-Trainer-Ausbildung': {
        de: 'Basiskurse mit Anatomie, Trainingslehre, Kraft- und Ausdauertraining. Von der B-Lizenz bis zum Diplom.',
        icon: '💪'
      },
      'Personal-Trainer-Ausbildung': {
        de: 'Gesprächsführung, Anamnese, individuelle Trainingsplanung. Werde zum 1:1-Experten.',
        icon: '🤝'
      },
      'Group-Fitness / Kursleitung': {
        de: 'Aerobic, Step, Toning, Cardio-Dance und moderne Kursformate unterrichten. Gruppendynamik meistern.',
        icon: '👥'
      },
      'Trainingsmethoden & Spezialisierungen': {
        de: 'Kraft & Ausdauer, Rücken & Core (inkl. Antara®), Functional Training, Kampfsport-Formate.',
        icon: '🔥'
      },
      'Mind-Body (Yoga & Pilates)': {
        de: 'Yoga- und Pilates-Ausbildungen für ganzheitliches Training. Achtsamkeit und Körperbewusstsein.',
        icon: '🧘'
      },
      'Ernährung & Coaching': {
        de: 'Sporternährung, Ernährungsberatung und Coaching-Kompetenzen. CAS und Seminare.',
        icon: '🥗'
      },
      'Zertifikate & Prüfungsvorbereitung': {
        de: 'Vorbereitung auf eidg. Prüfungen, Fitness-Lizenzen und Branchenzertifikate.',
        icon: '📋'
      },
      'Business & Selbstständigkeit': {
        de: 'Unternehmer-Workshops, Recht, Versicherung, Datenschutz und Vertriebs-Know-how.',
        icon: '💼'
      }
    },

    // Vordefinierte Suchlinks
    predefinedSearches: [
      { label: { de: 'Fitnesstrainer Basiskurs' }, params: { spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' } },
      { label: { de: 'Personal Trainer Lehrgang' }, params: { spec: 'Personal-Trainer-Ausbildung' } },
      { label: { de: 'Group-Fitness Kursformate' }, params: { spec: 'Group-Fitness / Kursleitung' } },
      { label: { de: 'Rücken & Core Training' }, params: { spec: 'Trainingsmethoden & Spezialisierungen' } },
      { label: { de: 'Yoga & Pilates' }, params: { spec: 'Mind-Body (Yoga & Pilates)' } },
      { label: { de: 'Diplom & eidg. Prüfung' }, params: { spec: 'Zertifikate & Prüfungsvorbereitung' } },
      { label: { de: 'Ernährung & Coaching' }, params: { spec: 'Ernährung & Coaching' } },
      { label: { de: 'Online Kurse' }, params: {}, extraParams: { delivery: 'online_live,self_study' } },
    ],

    // FAQ
    faqs: [
      {
        q: { de: 'Brauche ich eine Grundausbildung vor der Spezialisierung?' },
        a: { de: 'In der Regel ja. Die meisten Anbieter empfehlen die Fitness-Trainer Basis-Ausbildung (B-Lizenz) als Einstieg. Darauf aufbauend kannst du dich in Bereichen wie Personal Training, Group Fitness oder Ernährung spezialisieren.' }
      },
      {
        q: { de: 'Kann ich als Quereinsteiger direkt in die Fitnessbranche?' },
        a: { de: 'Absolut! Viele Basis-Ausbildungen setzen keine Vorkenntnisse voraus — nur Freude an Bewegung und Gesundheit. Die B-Lizenz ist ideal für den Einstieg, unabhängig von deinem bisherigen Beruf.' }
      },
      {
        q: { de: 'Welche Qualitätssiegel sind relevant?' },
        a: { de: 'In der Schweiz sind Qualitop, QualiCert und Fitness-Guide die wichtigsten Zertifizierungen. Sie garantieren hohe Ausbildungsstandards und werden von Versicherungen und Arbeitgebern anerkannt.' }
      },
      {
        q: { de: 'Wie läuft die eidg. Prüfungsvorbereitung ab?' },
        a: { de: 'Die Vorbereitung auf den eidgenössischen Fachausweis (FA) umfasst mehrere Module und dauert in der Regel 1–2 Jahre berufsbegleitend. Du kannst Bundesbeiträge von bis zu 50% der Kurskosten beantragen.' }
      },
      {
        q: { de: 'Welche Ausbildung passt als Nebenerwerb?' },
        a: { de: 'Group-Fitness-Instruktor oder Yoga/Pilates-Lehrer eignen sich besonders gut als Nebenerwerb. Die Ausbildungen sind kompakt und du kannst flexibel Kurse an Abenden oder Wochenenden geben.' }
      },
    ],

    // Trust
    trustLogos: [
      { name: 'Qualitop', description: { de: 'Qualitätszertifikat für Fitnesscenter und Ausbildungen in der Schweiz' } },
      { name: 'QualiCert', description: { de: 'Zertifizierung für Bewegungs- und Gesundheitsangebote' } },
      { name: 'Fitness-Guide', description: { de: 'Schweizer Ausbildungsstandard für Fitness-Professionals' } },
    ]
  },
  // Weitere Bereiche werden hier ergänzt...
};

/** Config anhand URL-Slug finden */
export const getBereichBySlug = (segment, slug) => {
  return Object.values(BEREICH_LANDING_CONFIG).find(
    b => b.segment === segment && b.slug === slug
  );
};

/** Alle Bereiche eines Segments (für MegaMenu / Home) */
export const getBereicheForSegment = (segment) => {
  return Object.values(BEREICH_LANDING_CONFIG).filter(b => b.segment === segment);
};

/** Config anhand DB area slug finden */
export const getBereichByAreaSlug = (areaSlug) => {
  return BEREICH_LANDING_CONFIG[areaSlug] || null;
};

/** URL für eine Bereichs-Landingpage */
export const getBereichUrl = (config) => {
  return `/bereich/${config.segment}/${config.slug}`;
};

/** Szenario anhand Bereich-Config + Szenario-Slug finden */
export const findSzenario = (bereichConfig, szenarioSlug) => {
  if (!bereichConfig?.scenarios) return null;
  return bereichConfig.scenarios.find(s => s.slug === szenarioSlug) || null;
};
