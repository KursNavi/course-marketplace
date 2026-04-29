/**
 * Segment Landing Page Configuration
 *
 * Defines the editorial content for the three main segment landing pages:
 * - Beruflich (/professional)
 * - Privat & Hobby (/private)
 * - Kinder & Jugend (/children)
 *
 * Each segment has:
 * - kursarten: Course-type tiles (3 per segment)
 * - themen: Topic tiles (4 per segment) — can link to existing Themenwelt or simple topic pages
 * - simpleTopics: Content config for topics without a full Themenwelt
 */

// ------------------------------------------------------------
// KURSARTEN + THEMEN PER SEGMENT
// ------------------------------------------------------------

export const SEGMENT_LANDING_CONFIG = {
  beruflich: {
    kursarten: [
      {
        slug: 'diplome-lehrgaenge',
        icon: '🎓',
        label: 'Diplome & Lehrgänge',
        desc: 'Staatlich anerkannte Abschlüsse und eidgenössische Diplome für nachhaltige Karriereschritte.',
        image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800',
        href: '/thema/beruflich/diplome-lehrgaenge',
      },
      {
        slug: 'fachkurse-skill-updates',
        icon: '⚡',
        label: 'Fachkurse & Skill-Updates',
        desc: 'Praxisnahe Weiterbildungen, die dich schnell fit für neue Anforderungen machen.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
        href: '/thema/beruflich/fachkurse-skill-updates',
      },
      {
        slug: 'quereinstieg-neuorientierung',
        icon: '🔄',
        label: 'Quereinstieg & Neuorientierung',
        desc: 'Wechsel die Branche oder finde eine neue Richtung – strukturiert und begleitet.',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800',
        href: '/thema/beruflich/quereinstieg-neuorientierung',
      },
    ],
    // Themen = exakt die Kategorien aus dem Suchfilter-Dropdown
    themen: [
      {
        slug: 'sport-fitness-berufsausbildung',
        label: 'Sport & Fitness (Berufsausbildung)',
        icon: '🏋️',
        desc: 'Trainerausbildungen, Diplome & Spezialisierungen',
        isThemenwelt: true,
        href: '/bereich/beruflich/sport-fitness-berufsausbildung',
        image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'wirtschaft-management',
        label: 'Wirtschaft & Management',
        icon: '🏢',
        desc: 'Leadership, Projektmanagement & Unternehmensführung',
        isThemenwelt: false,
        href: '/thema/beruflich/wirtschaft-management',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'it-digital',
        label: 'IT & Digitales',
        icon: '💻',
        desc: 'Programmierung, Daten & digitale Transformation',
        isThemenwelt: false,
        href: '/thema/beruflich/it-digital',
        image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'finanzen-recht',
        label: 'Finanzen & Recht',
        icon: '💰',
        desc: 'Buchhaltung, Controlling, Steuern & Finanzplanung',
        isThemenwelt: false,
        href: '/thema/beruflich/finanzen-recht',
        image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'soft-skills',
        label: 'Soft Skills',
        icon: '💬',
        desc: 'Kommunikation, Rhetorik & Persönlichkeitsentwicklung',
        isThemenwelt: false,
        href: '/thema/beruflich/soft-skills',
        image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'marketing',
        label: 'Marketing',
        icon: '📣',
        desc: 'Online-Marketing, Verkauf & Kommunikation',
        isThemenwelt: false,
        href: '/thema/beruflich/marketing',
        image: 'https://images.unsplash.com/photo-1432888622747-4eb9a8f5e907?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'gesundheit-resilienz',
        label: 'Gesundheit & Resilienz',
        icon: '🌿',
        desc: 'Gesundheitsförderung, Prävention & medizinische Grundlagen',
        isThemenwelt: false,
        href: '/thema/beruflich/gesundheit-resilienz',
        image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'berufssprachen',
        label: 'Berufssprachen',
        icon: '🌐',
        desc: 'Business-Englisch, Französisch & Fachsprachen',
        isThemenwelt: false,
        href: '/thema/beruflich/berufssprachen',
        image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'bildung-soziales',
        label: 'Bildung & Soziales',
        icon: '📋',
        desc: 'Eidg. Prüfungsvorbereitung, Ausbilder & Soziales',
        isThemenwelt: false,
        href: '/thema/beruflich/bildung-soziales',
        image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=800',
      },
    ],
  },

  privat_hobby: {
    kursarten: [
      {
        slug: 'workshops',
        icon: '🎨',
        label: 'Workshops',
        desc: 'Kompakte Tages- und Halbtagesworkshops zum Ausprobieren und Vertiefen.',
        image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80&w=800',
        href: '/thema/privat-hobby/workshops',
      },
      {
        slug: 'einsteigerkurse',
        icon: '🌱',
        label: 'Kurse für Einsteiger',
        desc: 'Kein Vorwissen nötig – starte neu und entdecke deine nächste Leidenschaft.',
        image: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&q=80&w=800',
        href: '/thema/privat-hobby/einsteigerkurse',
      },
      {
        slug: 'regelmaessige-kurse',
        icon: '🗓️',
        label: 'Regelmässige Kurse',
        desc: 'Feste Kursgruppen für kontinuierliches Lernen und soziale Verbindung.',
        image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800',
        href: '/thema/privat-hobby/regelmaessige-kurse',
      },
    ],
    // Themen = exakt die Kategorien aus dem Suchfilter-Dropdown
    themen: [
      {
        slug: 'sport-fitness',
        label: 'Sport & Fitness',
        icon: '🏃',
        desc: 'Fitness, Kraft, Ausdauer, Teamsport & Outdoor',
        isThemenwelt: false,
        href: '/thema/privat-hobby/sport-fitness',
        image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'yoga-achtsamkeit',
        label: 'Yoga & Achtsamkeit',
        icon: '🧘',
        desc: 'Entspannung, Meditation & innere Balance',
        isThemenwelt: false,
        href: '/thema/privat-hobby/yoga-achtsamkeit',
        image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'musik',
        label: 'Musik & Bühne',
        icon: '🎵',
        desc: 'Gitarre, Klavier, Gesang, Theater & Tanz',
        isThemenwelt: false,
        href: '/thema/privat-hobby/musik',
        image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'kunst-kreativ',
        label: 'Kunst & Kreativität',
        icon: '🎨',
        desc: 'Malen, Fotografie, Keramik, Nähen & Design',
        isThemenwelt: false,
        href: '/thema/privat-hobby/kunst-kreativ',
        image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'kochen-genuss',
        label: 'Kochen & Genuss',
        icon: '🍳',
        desc: 'Kochkurse, Backen, Wein & internationale Küchen',
        isThemenwelt: false,
        href: '/thema/privat-hobby/kochen-genuss',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'sprachen',
        label: 'Sprachen',
        icon: '🗣️',
        desc: 'Englisch, Französisch, Italienisch & weitere Sprachen',
        isThemenwelt: false,
        href: '/thema/privat-hobby/sprachen',
        image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'heim-natur',
        label: 'Heim & Natur',
        icon: '🏡',
        desc: 'Heimwerken, Garten, Tiere & Handwerk',
        isThemenwelt: false,
        href: '/thema/privat-hobby/heim-natur',
        image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'alltag-persoenlichkeit',
        label: 'Alltag & Persönlichkeit',
        icon: '✨',
        desc: 'Persönlichkeitsentwicklung, Kommunikation & Alltag',
        isThemenwelt: false,
        href: '/thema/privat-hobby/alltag-persoenlichkeit',
        image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800',
      },
    ],
  },

  kinder_jugend: {
    kursarten: [
      {
        slug: 'ferienkurse-camps',
        icon: '☀️',
        label: 'Ferienkurse & Camps',
        desc: 'Sinnvolle und spannende Freizeitgestaltung in den Schulferien.',
        image: 'https://images.unsplash.com/photo-1471922694854-ff1b63b20054?auto=format&fit=crop&q=80&w=800',
        href: '/thema/kinder-jugend/ferienkurse-camps',
      },
      {
        slug: 'freizeitkurse',
        icon: '🎯',
        label: 'Freizeitkurse',
        desc: 'Regelmässige Aktivitäten, die Kinder begeistern und weiterentwickeln.',
        image: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&q=80&w=800',
        href: '/thema/kinder-jugend/freizeitkurse',
      },
    ],
    // Themen = exakt die Kategorien aus dem Suchfilter-Dropdown
    themen: [
      {
        slug: 'frühkindliche-bildung',
        label: 'Frühkindliche Bildung',
        icon: '👶',
        desc: 'Eltern-Kind-Turnen, Musikgarten & Spielgruppen (0–5)',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/fruehkindliche-bildung',
        image: 'https://images.unsplash.com/photo-1544776193-352d25ca82cd?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'schule-lernen',
        label: 'Schule & Lernen',
        icon: '📚',
        desc: 'Nachhilfe, Lerncoaching & Prüfungsvorbereitung',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/schule-lernen',
        image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'hobbys-sport',
        label: 'Hobbys, Sport & Kreatives',
        icon: '⚽',
        desc: 'Turnen, Kampfsport, Musik, Basteln & Theater',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/hobbys-sport',
        image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'coding-technik',
        label: 'Coding & Technik',
        icon: '🤖',
        desc: 'Programmieren, Robotik & Medienkompetenz',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/coding-technik',
        image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'feriencamps',
        label: 'Feriencamps & Betreuung',
        icon: '☀️',
        desc: 'Sportcamps, Kreativcamps & Outdoorlager',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/feriencamps',
        image: 'https://images.unsplash.com/photo-1471922694854-ff1b63b20054?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'elternbildung',
        label: 'Elternbildung',
        icon: '👨‍👩‍👧',
        desc: 'Geburtsvorbereitung, Erziehung & Erste Hilfe am Kind',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/elternbildung',
        image: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?auto=format&fit=crop&q=80&w=800',
      },
    ],
  },
};

// ------------------------------------------------------------
// SIMPLE TOPIC CONTENT (for topics without a full Themenwelt)
// Key: "{segment}/{slug}" (where segment uses dashes for URL)
//
// showCourseList: true  → filter and show courses (or fallback if empty)
// showCourseList: false → editorial-only page, no course cards
//
// Course filter logic (all conditions must match):
//   1. status === 'published'
//   2. category_type in typeAliases
//   3. category_area in areaAliases (if set)
//   4. category_specialty in specialtyAliases (if set)
// ------------------------------------------------------------

export const SIMPLE_TOPIC_CONTENT = {
  // ---- BERUFLICH THEMEN ----
  'beruflich/it-digital': {
    title: 'IT & Digital',
    subtitle: 'Digitale Kompetenz für die Arbeitswelt von morgen',
    intro:
      'Ob Programmierung, Datenanalyse, Cloud oder digitale Geschäftsprozesse – IT-Kenntnisse sind heute in fast jedem Beruf gefragt. In der Schweiz gibt es ein breites Angebot an IT-Weiterbildungen für alle Stufen.',
    points: [
      { icon: '💻', title: 'Programmierung & Entwicklung', text: 'Von Python-Basics bis zu modernen Webframeworks – lerne praxisnah und direkt anwendbar.' },
      { icon: '📊', title: 'Daten & KI', text: 'Datenanalyse, Machine Learning und KI-Tools werden in immer mehr Berufen unverzichtbar.' },
      { icon: '☁️', title: 'Cloud & Infrastruktur', text: 'Cloud-Zertifizierungen von AWS, Azure oder Google sind stark nachgefragt.' },
      { icon: '🔐', title: 'Cybersecurity', text: 'IT-Sicherheit ist eines der am stärksten wachsenden Berufsfelder der Schweiz.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['it_digital', '4'],
    hintText: 'Detaillierte Ratgeber und Vergleiche zu IT-Ausbildungen folgen in Kürze.',
  },
  'beruflich/fuehrung-management': {
    title: 'Führung & Management',
    subtitle: 'Menschen führen, Projekte steuern, Unternehmen gestalten',
    intro:
      'Gute Führung ist keine Selbstverständlichkeit – sie lässt sich lernen. Von der ersten Kaderstufe bis zur Geschäftsführung bietet die Schweizer Weiterbildungslandschaft passende Kurse und Lehrgänge.',
    points: [
      { icon: '👥', title: 'Teamführung', text: 'Mitarbeitende motivieren, Konflikte lösen, eine positive Teamkultur aufbauen.' },
      { icon: '📋', title: 'Projektmanagement', text: 'Von klassischen PM-Methoden bis Agile & Scrum – strukturiert Projekte zum Erfolg bringen.' },
      { icon: '🏢', title: 'Strategisches Management', text: 'Unternehmensstrategien entwickeln, Veränderungsprozesse steuern, nachhaltig wachsen.' },
      { icon: '📣', title: 'Kommunikation & Verhandlung', text: 'Wirkungsvoll kommunizieren, überzeugend präsentieren und erfolgreich verhandeln.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['business_mgmt', '1'],
    hintText: 'Ratgeber zu Führungsausbildungen und Management-Zertifizierungen folgen in Kürze.',
  },
  'beruflich/kommunikation-sprachen': {
    title: 'Kommunikation & Sprachen',
    subtitle: 'Klar kommunizieren, überzeugend auftreten, neue Sprachen sprechen',
    intro:
      'Ob Deutsch, Englisch, Französisch oder interkulturelle Kommunikation – Sprachkompetenz und rhetorisches Geschick sind Schlüsselqualifikationen in vielen Berufsfeldern.',
    points: [
      { icon: '🌐', title: 'Sprachkurse', text: 'Englisch, Französisch, Italienisch und weitere Sprachen für den Berufsalltag.' },
      { icon: '🎤', title: 'Rhetorik & Präsentation', text: 'Sicher auftreten, strukturiert reden und Zuhörer begeistern.' },
      { icon: '✍️', title: 'Schreibkompetenz', text: 'E-Mails, Berichte, Offerten – professionell und klar schreiben.' },
      { icon: '🌏', title: 'Interkulturelle Kompetenz', text: 'Erfolgreich mit Menschen aus verschiedenen Kulturen zusammenarbeiten.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['soft_skills', 'sprachen_beruf', '5'],
    hintText: 'Mehr Inhalte zu Sprachkursen und Kommunikationstraining folgen in Kürze.',
  },
  'beruflich/bildung-pruefung': {
    title: 'Bildung & Prüfung',
    subtitle: 'Eidgenössische Prüfungen, Zulassungen & Bildungsabschlüsse',
    intro:
      'Von der Berufsmatura bis zur eidgenössischen Höheren Prüfung – das Schweizer Bildungssystem bietet vielfältige Möglichkeiten, formale Abschlüsse zu erlangen und Berufsqualifikationen zu sichern.',
    points: [
      { icon: '📋', title: 'Eidgenössische Prüfungen', text: 'Berufsfeld- und fachspezifische Qualifikationsprüfungen mit staatlicher Anerkennung.' },
      { icon: '🎓', title: 'Berufsmatura', text: 'Der Weg zur Fachhochschule – kombiniert Berufspraxis mit allgemeiner Bildung.' },
      { icon: '📚', title: 'Vorbereitungskurse', text: 'Gezielte Kurse für die Aufnahme in Bildungsgänge oder staatliche Prüfungen.' },
      { icon: '✅', title: 'Anerkannte Zertifikate', text: 'Branchenanerkannte Zertifizierungen, die deinen Lebenslauf stärken.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['bildung_pruefung'],
    hintText: 'Ratgeber zu Bildungsabschlüssen und Prüfungsvorbereitungen folgen in Kürze.',
  },
  'beruflich/finanzen-rechnungswesen': {
    title: 'Finanzen & Rechnungswesen',
    subtitle: 'Buchhaltung, Controlling, Steuern & Finanzplanung',
    intro:
      'Finanzkenntnisse sind in nahezu jedem Unternehmen gefragt. Ob Buchhaltung für KMU, Controlling in grossen Firmen oder persönliche Finanzplanung – die Schweiz bietet ein starkes Weiterbildungsangebot.',
    points: [
      { icon: '📊', title: 'Rechnungswesen & Buchhaltung', text: 'Von der einfachen Buchführung bis zum doppelten Hauptbuch – praxisnah und anerkannt.' },
      { icon: '📈', title: 'Controlling & Reporting', text: 'Kennzahlen verstehen, Budgets erstellen, Entscheidungen fundiert treffen.' },
      { icon: '🏦', title: 'Finanzplanung & Steuern', text: 'Unternehmens- und Privatsteuern, Finanzplanung und Vermögensstrukturierung.' },
      { icon: '🏠', title: 'Immobilien', text: 'Immobilienbewertung, Vermietung, Kauf und Verwaltung – fundiertes Fachwissen.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['finanzen', '2'],
    hintText: 'Mehr Ratgeber zu Finanz- und Rechnungswesenausbildungen folgen in Kürze.',
  },

  // ---- BERUFLICH THEMEN (new slugs matching dropdown exactly) ----
  'beruflich/wirtschaft-management': {
    title: 'Wirtschaft & Management',
    subtitle: 'Leadership, Projektmanagement & Unternehmensführung',
    intro:
      'Gute Führung ist keine Selbstverständlichkeit – sie lässt sich lernen. Von der ersten Kaderstufe bis zur Geschäftsführung bietet die Schweizer Weiterbildungslandschaft passende Kurse und Lehrgänge.',
    points: [
      { icon: '👥', title: 'Teamführung', text: 'Mitarbeitende motivieren, Konflikte lösen, eine positive Teamkultur aufbauen.' },
      { icon: '📋', title: 'Projektmanagement', text: 'Von klassischen PM-Methoden bis Agile & Scrum – strukturiert Projekte zum Erfolg bringen.' },
      { icon: '🏢', title: 'Strategisches Management', text: 'Unternehmensstrategien entwickeln, Veränderungsprozesse steuern, nachhaltig wachsen.' },
      { icon: '📣', title: 'Kommunikation & Verhandlung', text: 'Wirkungsvoll kommunizieren, überzeugend präsentieren und erfolgreich verhandeln.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['business_mgmt'],
    hintText: 'Ratgeber zu Führungsausbildungen und Management-Zertifizierungen folgen in Kürze.',
  },
  'beruflich/finanzen-recht': {
    title: 'Finanzen & Recht',
    subtitle: 'Buchhaltung, Controlling, Steuern & Finanzplanung',
    intro:
      'Finanzkenntnisse sind in nahezu jedem Unternehmen gefragt. Ob Buchhaltung für KMU, Controlling in grossen Firmen oder persönliche Finanzplanung – die Schweiz bietet ein starkes Weiterbildungsangebot.',
    points: [
      { icon: '📊', title: 'Rechnungswesen & Buchhaltung', text: 'Von der einfachen Buchführung bis zum doppelten Hauptbuch – praxisnah und anerkannt.' },
      { icon: '📈', title: 'Controlling & Reporting', text: 'Kennzahlen verstehen, Budgets erstellen, Entscheidungen fundiert treffen.' },
      { icon: '🏦', title: 'Finanzplanung & Steuern', text: 'Unternehmens- und Privatsteuern, Finanzplanung und Vermögensstrukturierung.' },
      { icon: '⚖️', title: 'Recht & Compliance', text: 'Arbeitsrecht, Vertragsrecht und regulatorische Anforderungen – fundiertes Fachwissen.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['finanzen', 'hr_recht'],
    hintText: 'Mehr Ratgeber zu Finanz- und Rechtsausbildungen folgen in Kürze.',
  },
  'beruflich/soft-skills': {
    title: 'Soft Skills',
    subtitle: 'Kommunikation, Rhetorik & Persönlichkeitsentwicklung',
    intro:
      'Soft Skills entscheiden oft mehr über Karriere und Arbeitszufriedenheit als fachliche Qualifikationen. Ob Kommunikation, Führung, Stressmanagement oder Kreativität – diese Fähigkeiten lassen sich trainieren.',
    points: [
      { icon: '🎤', title: 'Rhetorik & Auftreten', text: 'Überzeugend reden, sicher präsentieren, souverän auftreten.' },
      { icon: '💬', title: 'Gesprächsführung', text: 'Feedback geben, Konflikte lösen, schwierige Gespräche meistern.' },
      { icon: '🧘', title: 'Stressmanagement', text: 'Resilienz aufbauen, Belastungen besser verarbeiten, Energie gezielt einsetzen.' },
      { icon: '🤝', title: 'Teamarbeit & Kooperation', text: 'Produktiv zusammenarbeiten, unterschiedliche Charaktere integrieren.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['soft_skills'],
    hintText: 'Ausführliche Ratgeber zu Soft-Skill-Trainings folgen in Kürze.',
  },
  'beruflich/marketing': {
    title: 'Marketing',
    subtitle: 'Online-Marketing, Verkauf & Kommunikation',
    intro:
      'Marketing verändert sich rasant – und Schweizer Unternehmen brauchen Fachleute, die sowohl klassische als auch digitale Marketingmethoden beherrschen. Die Weiterbildungslandschaft bietet Kurse für alle Niveaus.',
    points: [
      { icon: '📱', title: 'Digitales Marketing', text: 'Social Media, SEO, Google Ads, E-Mail-Marketing – die wichtigsten Online-Kanäle im Griff.' },
      { icon: '🎯', title: 'Verkauf & Vertrieb', text: 'Verkaufspsychologie, Kundenakquise und Beziehungsaufbau für langfristigen Erfolg.' },
      { icon: '✍️', title: 'Content & Copywriting', text: 'Texte, die überzeugen – für Website, Social Media und Werbemittel.' },
      { icon: '📊', title: 'Marktforschung & Analytics', text: 'Daten verstehen, Zielgruppen kennen, fundierte Entscheidungen treffen.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['marketing'],
    hintText: 'Ausführliche Ratgeber zu Marketing-Ausbildungen folgen in Kürze.',
  },
  'beruflich/gesundheit-resilienz': {
    title: 'Gesundheit & Resilienz',
    subtitle: 'Gesundheitsförderung, Prävention & medizinische Grundlagen',
    intro:
      'Das Berufsfeld Gesundheit wächst – und mit ihm der Bedarf an qualifizierten Fachkräften. Von der betrieblichen Gesundheitsförderung bis zu medizinischen Grundkenntnissen: Die Schweiz bietet fundierte Weiterbildungen.',
    points: [
      { icon: '🏥', title: 'Medizinische Grundlagen', text: 'Anatomie, Erste Hilfe, medizinische Fachkenntnisse für Berufe im Gesundheitssektor.' },
      { icon: '🌿', title: 'Betriebliche Gesundheit', text: 'Gesundheitsmanagement, ergonomische Massnahmen und Burnout-Prävention im Unternehmen.' },
      { icon: '💪', title: 'Prävention & Rehabilitation', text: 'Krankheiten vorbeugen, Genesungsprozesse begleiten, langfristige Gesundheit fördern.' },
      { icon: '🧠', title: 'Psychische Gesundheit', text: 'Stress erkennen, Resilienz aufbauen, Wohlbefinden am Arbeitsplatz fördern.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['gesundheit_beruf'],
    hintText: 'Mehr Ratgeber zu Gesundheitsberufen und Prävention folgen in Kürze.',
  },
  'beruflich/berufssprachen': {
    title: 'Berufssprachen',
    subtitle: 'Business-Englisch, Französisch & Fachsprachen',
    intro:
      'In der mehrsprachigen Schweiz sind Sprachkenntnisse ein klarer Wettbewerbsvorteil. Business-Englisch, Französisch für den Kontakt mit Westschweizer Kolleginnen oder Fachsprachen für bestimmte Branchen – hier findest du passende Kurse.',
    points: [
      { icon: '🇬🇧', title: 'Business English', text: 'Von E-Mails und Präsentationen bis hin zu Verhandlungen auf internationalem Niveau.' },
      { icon: '🇫🇷', title: 'Français professionnel', text: 'Für die Zusammenarbeit mit der Romandie – schriftlich und mündlich sicher.' },
      { icon: '🌐', title: 'Fachsprachen', text: 'Medizin, Recht, Technik – je nach Branche gibt es spezialisierte Sprachkurse.' },
      { icon: '📜', title: 'Anerkannte Abschlüsse', text: 'Cambridge, DELF, Telc und weitere Zertifikate für den internationalen Lebenslauf.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['sprachen_beruf'],
    hintText: 'Mehr Empfehlungen zu Berufssprachen-Kursen folgen in Kürze.',
  },
  'beruflich/bildung-soziales': {
    title: 'Bildung & Soziales',
    subtitle: 'Eidg. Prüfungsvorbereitung, Ausbilder & Soziales',
    intro:
      'Von der eidgenössischen Berufsprüfung bis zum Berufsbildner-Kurs: Der Bereich Bildung & Soziales umfasst Weiterbildungen für alle, die im Bildungs-, Betreuungs- oder Sozialbereich tätig sind oder werden möchten.',
    points: [
      { icon: '📋', title: 'Eidgenössische Prüfungen', text: 'Berufsprüfungen und Höhere Fachprüfungen mit staatlicher Anerkennung.' },
      { icon: '🎓', title: 'Ausbilder & Berufsbildner', text: 'Berufsbildner-Kurse für Betriebe, die Lernende ausbilden.' },
      { icon: '🤝', title: 'Soziale Arbeit', text: 'Grundlagen der Sozialarbeit, Sozialpädagogik und Community Work.' },
      { icon: '👶', title: 'Betreuung & Pädagogik', text: 'Kurse für Kita-Mitarbeitende, Tagesmütter und Betreuungsfachleute.' },
    ],
    showCourseList: true,
    typeAliases: ['beruflich', 'professionell'],
    areaAliases: ['bildung_pruefung'],
    hintText: 'Ratgeber zu Bildungsabschlüssen und Sozialberufen folgen in Kürze.',
  },

  // ---- BERUFLICH KURSARTEN (editorial only, no specific DB category) ----
  'beruflich/diplome-lehrgaenge': {
    title: 'Diplome & Lehrgänge',
    subtitle: 'Staatlich anerkannte Abschlüsse für deine Karriere',
    intro:
      'Ob eidgenössisches Diplom, Lehrgang mit Zertifikat oder branchenanerkannter Abschluss – in der Schweiz gibt es vielfältige Möglichkeiten, deine Qualifikationen offiziell zu dokumentieren und deinen Marktwert zu steigern.',
    points: [
      { icon: '🎓', title: 'Eidgenössische Abschlüsse', text: 'Eidg. Fachausweis und Diplom sind staatlich anerkannt und schweizweit geschätzt.' },
      { icon: '📋', title: 'Branchenzertifikate', text: 'Viele Branchen haben eigene anerkannte Zertifikate – von Fitness bis Finanzen.' },
      { icon: '🗓️', title: 'Berufsbegleitend möglich', text: 'Die meisten Lehrgänge sind so gestaltet, dass du sie neben dem Job absolvieren kannst.' },
      { icon: '📈', title: 'Lohn- und Karriereschub', text: 'Ein anerkannter Abschluss öffnet Türen für bessere Positionen und höhere Löhne.' },
    ],
    showCourseList: false,
    hintText: 'Weitere Ratgeber und Vergleiche zu Diplomen und Lehrgängen folgen in Kürze.',
  },
  'beruflich/fachkurse-skill-updates': {
    title: 'Fachkurse & Skill-Updates',
    subtitle: 'Bleib aktuell – praxisnah und effizient',
    intro:
      'Der Arbeitsmarkt verändert sich schnell. Mit gezielten Fachkursen und Skill-Updates hältst du dein Wissen frisch, kannst neue Aufgaben übernehmen und bist für deinen Arbeitgeber noch wertvoller.',
    points: [
      { icon: '⚡', title: 'Kurze Formate', text: 'Viele Fachkurse dauern nur 1–3 Tage – ideal für Berufstätige mit wenig Zeit.' },
      { icon: '🎯', title: 'Gezielt auf Bedarf', text: 'Wähle genau das Thema, das du gerade brauchst – kein Ballast, nur Relevanz.' },
      { icon: '💡', title: 'Praxistransfer', text: 'Gute Fachkurse vermitteln Wissen, das du am nächsten Tag direkt einsetzen kannst.' },
      { icon: '🌐', title: 'Online & Präsenz', text: 'Viele Angebote gibt es auch online – flexibel und ortsunabhängig.' },
    ],
    showCourseList: false,
    hintText: 'Mehr Tipps zur Auswahl des richtigen Fachkurses folgen in Kürze.',
  },
  'beruflich/quereinstieg-neuorientierung': {
    title: 'Quereinstieg & Neuorientierung',
    subtitle: 'Einen neuen Weg einschlagen – strukturiert und sicher',
    intro:
      'Ein Quereinstieg ist eine mutige Entscheidung. Mit der richtigen Ausbildung oder Umschulung gelingt der Wechsel in eine neue Branche oft einfacher als gedacht. Wir zeigen dir, welche Wege es gibt.',
    points: [
      { icon: '🔄', title: 'Branchenwechsel', text: 'Viele Branchen suchen aktiv nach Quereinsteigern mit frischer Perspektive.' },
      { icon: '🗺️', title: 'Orientierungskurse', text: 'Teste eine neue Richtung mit kurzen Einstiegskursen, bevor du eine grosse Entscheidung triffst.' },
      { icon: '🤝', title: 'Anerkannte Abschlüsse nachholen', text: 'Verkürzte Ausbildungswege machen es möglich, schneller zur Qualifikation zu kommen.' },
      { icon: '💬', title: 'Beratung nutzen', text: 'Gute Kursanbieter beraten dich, welcher Weg für deine Situation am besten passt.' },
    ],
    showCourseList: false,
    hintText: 'Ausführliche Ratgeber zum Thema Quereinstieg und Berufswechsel folgen in Kürze.',
  },

  // ---- PRIVAT & HOBBY THEMEN ----
  'privat-hobby/yoga-achtsamkeit': {
    title: 'Yoga & Achtsamkeit',
    subtitle: 'Innere Balance, Entspannung und Körperbewusstsein',
    intro:
      'Yoga und Achtsamkeit helfen nicht nur beim Abschalten. Sie können auch dabei helfen, den passenden Zugang zu Bewegung, Regeneration, Fokus und Selbstwahrnehmung zu finden. Damit der Einstieg gelingt, reicht es nicht, nur den Stilnamen zu kennen. Entscheidend sind Ziel, Intensität, Alltagspassung und ein Format, in dem du dich sicher fühlst.',
    points: [
      { icon: '🧘', title: 'Stil und Format passend wählen', text: 'Von Hatha bis Yin, von Online-live bis vor Ort – der Stil ist erst die halbe Entscheidung. Das Format bestimmt, wie gut Yoga wirklich zu deinem Alltag passt.' },
      { icon: '💬', title: 'Vertrauenscheck vor der Buchung', text: 'Gute Angebote nennen Level, Intensität und Ziel klar. Bei sensiblen Formaten wie Breathwork oder Reiki ist transparente Beschreibung besonders wichtig.' },
      { icon: '💰', title: 'Klein einsteigen, dann vertiefen', text: 'Probelektion, Einzeleintritt oder kurzer Testzeitraum sind oft sinnvoller als ein grosses Paket. Wer 4 bis 8 Wochen sauber testet, entscheidet besser.' },
      { icon: '🔄', title: 'Konstant statt ambitioniert', text: 'Eine gute Einheit pro Woche bringt mehr als unregelmässige Intensivblöcke. Routineaufbau schlägt Ambition fast immer.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat', '2'],
    areaAliases: ['yoga_mental', '7'],
    hintText: 'Alle Themen rund um Yoga & Achtsamkeit – von Anfänger-Tipps über Stilvergleich bis zu Breathwork und Energiearbeit – findest du in der Yoga-Themenwelt.',
  },
  'privat-hobby/musik': {
    title: 'Musik',
    subtitle: 'Gitarre, Klavier, Gesang und vieles mehr',
    intro:
      'Musik ist eine universelle Sprache – und sie zu lernen bereichert das Leben. Ob du ein Instrument lernen oder deine Singstimme entwickeln möchtest: In der Schweiz findest du Kurse für alle Altersstufen und Niveaus.',
    points: [
      { icon: '🎸', title: 'Instrumente lernen', text: 'Gitarre, Klavier, Schlagzeug, Geige – finde Lehrende in deiner Region oder online.' },
      { icon: '🎤', title: 'Gesang & Chor', text: 'Stimme ausbauen, Technik verbessern oder einfach gemeinsam singen.' },
      { icon: '🎵', title: 'Musikalische Grundlagen', text: 'Rhythmus, Noten, Musiktheorie – wer die Basics kennt, lernt schneller.' },
      { icon: '🎹', title: 'Für Erwachsene', text: 'Es ist nie zu spät, ein Instrument zu lernen – speziell für Erwachsene gestaltete Kurse machen es möglich.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat', '2'],
    areaAliases: ['musik', '11'],
    hintText: 'Mehr Musik-Ratgeber und Instrumentenguides folgen in Kürze.',
  },
  'privat-hobby/sprachen': {
    title: 'Sprachen',
    subtitle: 'Englisch, Französisch, Italienisch & weitere Sprachen privat lernen',
    intro:
      'Sprachen lernen bereichert das Leben – beruflich wie privat. Ob du eine neue Sprache von Grund auf lernst oder dein Niveau verbessern möchtest: In der Schweiz findest du ein breites Angebot für alle Sprachen und Stufen.',
    points: [
      { icon: '🇬🇧', title: 'Englisch', text: 'Die weltweit meistgelernte Sprache – ob für Reise, Beruf oder persönliches Interesse.' },
      { icon: '🇫🇷', title: 'Französisch', text: 'Landessprache und Kulturgut – ideal für Schweizer und Franko-Neugierige.' },
      { icon: '🇮🇹', title: 'Italienisch', text: 'Beliebt für Urlaub, Kultur und die Verbindung mit der italophonen Schweiz.' },
      { icon: '🌍', title: 'Weitere Sprachen', text: 'Spanisch, Portugiesisch, Japanisch, Arabisch und viele mehr – für alle Interessen.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat', '2'],
    areaAliases: ['sprachen_privat'],
    hintText: 'Mehr Sprachtipps und Kursempfehlungen folgen in Kürze.',
  },
  'privat-hobby/tiere-hundeschule': {
    title: 'Tiere & Hundeschule',
    subtitle: 'Hundeschule, Tierverhalten & Training',
    intro:
      'Hunde brauchen Erziehung, Struktur und ein gutes Zusammenspiel mit ihren Halterinnen und Haltern. Hundeschulen und Tierkurse bieten fundiertes Wissen und praxisnahes Training für ein harmonisches Miteinander.',
    points: [
      { icon: '🐕', title: 'Grundgehorsamkeit', text: 'Sitz, Platz, Fuss – die Basics als Fundament für einen entspannten Alltag.' },
      { icon: '🧠', title: 'Verhaltensverständnis', text: 'Verstehe, warum dein Hund so handelt, wie er es tut – und wie du sinnvoll reagierst.' },
      { icon: '🎯', title: 'Problemverhalten angehen', text: 'Leinenaggressivität, Angst oder Bellen – mit der richtigen Begleitung lösbar.' },
      { icon: '🤝', title: 'Mensch-Hund-Beziehung', text: 'Vertrauen und klare Kommunikation sind die Basis eines guten Miteinanders.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat', '2'],
    areaAliases: ['heim_garten', '8'],
    specialtyAliases: ['Tiere & Hundeschule', 'Hunde'],
    hintText: 'Tipps zur Hundeschulen-Auswahl in deiner Region folgen in Kürze.',
  },
  // Kochen & Kunst: URLs bleiben erreichbar, aber keine passenden Kurse → Fallback
  'privat-hobby/kochen-genuss': {
    title: 'Kochen & Genuss',
    subtitle: 'Kulinarische Erlebnisse und neue Kochtechniken',
    intro:
      'Gemeinsam kochen, neue Techniken lernen, Weine kennenlernen oder einfach geniessen – Kochkurse sind eine der beliebtesten Weiterbildungsformen in der Freizeit. Und das zu Recht.',
    points: [
      { icon: '🍳', title: 'Kochtechniken', text: 'Von der Messerführung bis zu komplexen Saucen – lerne, was dich wirklich besser macht.' },
      { icon: '🥐', title: 'Backen & Patisserie', text: 'Brot, Kuchen, Torten – der Duft von selbst Gebackenem ist unschlagbar.' },
      { icon: '🍷', title: 'Wein & Pairing', text: 'Weinverkostungen und Pairing-Kurse machen den Genuss noch bewusster.' },
      { icon: '🌍', title: 'Internationale Küchen', text: 'Japanisch, Indisch, Mexikanisch – entdecke die Welt auf dem Teller.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat', '2'],
    areaAliases: ['kochen_genuss'],
    hintText: 'Kochkurs-Empfehlungen und Rezept-Tipps folgen in Kürze.',
  },
  'privat-hobby/kunst-kreativitaet': {
    title: 'Kunst & Kreativität',
    subtitle: 'Malen, Zeichnen, Gestalten – kreativ sein macht glücklich',
    intro:
      'Kreativkurse sind weit mehr als Hobby – sie fördern Konzentration, Selbstausdruck und innere Ruhe. In der Schweiz findest du ein breites Angebot an Kursen für alle Kreativbereiche.',
    points: [
      { icon: '🖌️', title: 'Malen & Zeichnen', text: 'Aquarell, Acryl, Bleistift – lerne Techniken und finde deinen eigenen Stil.' },
      { icon: '🏺', title: 'Töpfern & Keramik', text: 'Mit den Händen arbeiten und etwas erschaffen, das bleibt – sehr beliebt und therapeutisch.' },
      { icon: '📷', title: 'Fotografie', text: 'Kameraführung, Bildkomposition, Lightroom-Nachbearbeitung – für alle Stufen.' },
      { icon: '✂️', title: 'Nähen, Stricken & mehr', text: 'Textile Kreativität verbindet Handwerk, Ästhetik und Entspannung.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat', '2'],
    areaAliases: ['kunst_kreativitaet'],
    hintText: 'Ausführliche Kreativ-Ratgeber und Kursempfehlungen folgen in Kürze.',
  },

  // ---- PRIVAT & HOBBY THEMEN (new slugs matching dropdown exactly) ----
  'privat-hobby/sport-fitness': {
    title: 'Sport & Fitness',
    subtitle: 'Fitness, Kraft, Ausdauer, Teamsport & Outdoor',
    intro:
      'Sport und Bewegung sind das Fundament eines gesunden Lebens. In der Schweiz gibt es ein riesiges Angebot an Fitnesskursen, Teamsport, Outdoor-Aktivitäten und mehr – für alle Fitness-Level und Altersgruppen.',
    points: [
      { icon: '💪', title: 'Fitness & Kraft', text: 'Von Functional Training bis Gewichtheben – praxisnahe Kurse für alle Level.' },
      { icon: '🏃', title: 'Ausdauer & Cardio', text: 'Laufen, Cycling, HIIT – effektiv trainieren und die Kondition verbessern.' },
      { icon: '⚽', title: 'Teamsport', text: 'Fussball, Volleyball, Basket – Spass und Gemeinschaft im Sport.' },
      { icon: '🥾', title: 'Outdoor & Abenteuer', text: 'Wandern, Klettern, Wassersport – die Natur als Trainingsort.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat'],
    areaAliases: ['sport_fitness'],
    hintText: 'Fitnesskurs-Empfehlungen und Sportarten-Vergleiche folgen in Kürze.',
  },
  'privat-hobby/kunst-kreativ': {
    title: 'Kunst & Kreativität',
    subtitle: 'Malen, Zeichnen, Gestalten – kreativ sein macht glücklich',
    intro:
      'Kreativkurse sind weit mehr als Hobby – sie fördern Konzentration, Selbstausdruck und innere Ruhe. In der Schweiz findest du ein breites Angebot an Kursen für alle Kreativbereiche.',
    points: [
      { icon: '🖌️', title: 'Malen & Zeichnen', text: 'Aquarell, Acryl, Bleistift – lerne Techniken und finde deinen eigenen Stil.' },
      { icon: '🏺', title: 'Töpfern & Keramik', text: 'Mit den Händen arbeiten und etwas erschaffen, das bleibt – sehr beliebt und therapeutisch.' },
      { icon: '📷', title: 'Fotografie', text: 'Kameraführung, Bildkomposition, Lightroom-Nachbearbeitung – für alle Stufen.' },
      { icon: '✂️', title: 'Nähen, Stricken & mehr', text: 'Textile Kreativität verbindet Handwerk, Ästhetik und Entspannung.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat'],
    areaAliases: ['kunst_kreativ'],
    hintText: 'Ausführliche Kreativ-Ratgeber und Kursempfehlungen folgen in Kürze.',
  },
  'privat-hobby/heim-natur': {
    title: 'Heim & Natur',
    subtitle: 'Heimwerken, Garten, Tiere & Handwerk',
    intro:
      'Ob Heimwerken, Gärtnern, Tierpflege oder nachhaltiges Leben – Kurse rund um Heim und Natur verbinden praktisches Wissen mit Freude am Gestalten und Erschaffen. Eine wachsende Community in der Schweiz.',
    points: [
      { icon: '🔨', title: 'Heimwerken & Handwerk', text: 'Reparieren, Renovieren, Gestalten – mit den richtigen Kursen gelingt es leichter.' },
      { icon: '🌱', title: 'Garten & Pflanzen', text: 'Gemüseanbau, Permakultur, Balkon begrünen – Natur selbst gestalten.' },
      { icon: '🐕', title: 'Tiere & Tierpflege', text: 'Hundeschule, Tierverhaltensberatung, artgerechte Haltung und Pflege.' },
      { icon: '♻️', title: 'Nachhaltigkeit', text: 'Zero Waste, Upcycling, Kompostierung – bewusst und ressourcenschonend leben.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat'],
    areaAliases: ['heim_garten'],
    hintText: 'Mehr Tipps rund um Heim, Garten und Tiere folgen in Kürze.',
  },
  'privat-hobby/alltag-persoenlichkeit': {
    title: 'Alltag & Persönlichkeit',
    subtitle: 'Persönlichkeitsentwicklung, Kommunikation & Alltag',
    intro:
      'Persönlichkeitsentwicklung, Kommunikation, Selbstorganisation und Achtsamkeit im Alltag – Kurse in diesem Bereich helfen dir, bewusster zu leben, bessere Entscheidungen zu treffen und dich kontinuierlich weiterzuentwickeln.',
    points: [
      { icon: '🌟', title: 'Persönlichkeitsentwicklung', text: 'Stärken kennen, Blockaden überwinden, das eigene Potenzial entfalten.' },
      { icon: '🗣️', title: 'Kommunikation & Beziehungen', text: 'Klar kommunizieren, Konflikte konstruktiv lösen, Beziehungen stärken.' },
      { icon: '🗂️', title: 'Selbstorganisation', text: 'Zeitmanagement, Produktivität, Aufräumen nach Methode – den Alltag besser meistern.' },
      { icon: '💡', title: 'Lebensqualität steigern', text: 'Gesunde Routinen, Stressbewältigung, Achtsamkeit – für mehr Zufriedenheit im Alltag.' },
    ],
    showCourseList: true,
    typeAliases: ['privat_hobby', 'privat'],
    areaAliases: ['alltag_leben'],
    hintText: 'Weitere Empfehlungen zur Persönlichkeitsentwicklung folgen in Kürze.',
  },

  // ---- PRIVAT & HOBBY KURSARTEN (editorial only) ----
  'privat-hobby/workshops': {
    title: 'Workshops',
    subtitle: 'Ausprobieren, Erleben, Begeistern – in kompaktem Format',
    intro:
      'Workshops sind die ideale Art, in kurzer Zeit etwas Neues zu lernen oder auszuprobieren. Ob kreativ, kulinarisch oder aktiv – in der Schweiz gibt es eine riesige Auswahl an Angeboten.',
    points: [
      { icon: '🎨', title: 'Kompaktes Format', text: 'Halbtags- oder Tagesworkshops – perfekt für Neugierige mit wenig Zeit.' },
      { icon: '👫', title: 'Geselliges Erlebnis', text: 'Workshops bringen Gleichgesinnte zusammen und machen als Gruppe besonders viel Spass.' },
      { icon: '🎁', title: 'Erlebnisgeschenk', text: 'Ein Workshop-Gutschein ist ein persönliches und unvergessliches Geschenk.' },
      { icon: '🌟', title: 'Einfach anfangen', text: 'Kein Vorwissen nötig – Workshops sind offen für alle Stufen.' },
    ],
    showCourseList: false,
    hintText: 'Mehr Workshop-Empfehlungen und Ratgeber folgen in Kürze.',
  },
  'privat-hobby/einsteigerkurse': {
    title: 'Kurse für Einsteiger',
    subtitle: 'Neu anfangen – mit der richtigen Begleitung',
    intro:
      'Jeder fängt mal an. Einsteigerkurse sind so gestaltet, dass du ohne Vorkenntnisse sicher starten kannst – in einem geschützten Rahmen, in deinem eigenen Tempo.',
    points: [
      { icon: '🌱', title: 'Kein Vorwissen nötig', text: 'Einsteigerkurse erklären alles von Grund auf – du musst nichts mitbringen ausser Neugier.' },
      { icon: '🤝', title: 'Auf Augenhöhe', text: 'Alle in der Gruppe sind Anfänger – das nimmt den Druck und macht Lernen leichter.' },
      { icon: '🗓️', title: 'Schritt für Schritt', text: 'Gut strukturierte Kurse bauen aufeinander auf, sodass du sicher Fortschritte machst.' },
      { icon: '💡', title: 'Einfach ausprobieren', text: 'Kurse für Einsteiger sind oft kurzfristig buchbar – ideal zum Kennenlernen.' },
    ],
    showCourseList: false,
    hintText: 'Weitere Empfehlungen für Einsteigerkurse folgen in Kürze.',
  },
  'privat-hobby/regelmaessige-kurse': {
    title: 'Regelmässige Kurse',
    subtitle: 'Kontinuierlich lernen, in Gemeinschaft wachsen',
    intro:
      'Regelmässige Kurse bieten die Möglichkeit, nicht nur Fertigkeiten zu entwickeln, sondern auch echte Verbindungen zu knüpfen. Woche für Woche dabei sein – das macht den Unterschied.',
    points: [
      { icon: '🗓️', title: 'Feste Kursgruppe', text: 'Immer die gleichen Gesichter – das fördert Motivation und soziale Verbindung.' },
      { icon: '📈', title: 'Nachhaltiger Fortschritt', text: 'Wer regelmässig übt, macht deutlich mehr Fortschritte als bei Einzelveranstaltungen.' },
      { icon: '🏡', title: 'Teil einer Gemeinschaft', text: 'Regelmässige Kurse schaffen Zugehörigkeit und sind oft ein wichtiger sozialer Anker.' },
      { icon: '💪', title: 'Routine aufbauen', text: 'Ein fester Kurs im Wochenplan hilft, gesunde Gewohnheiten zu etablieren.' },
    ],
    showCourseList: false,
    hintText: 'Mehr Tipps zur Auswahl regelmässiger Kurse folgen in Kürze.',
  },

  // ---- KINDER & JUGEND THEMEN ----
  'kinder-jugend/sport-bewegung': {
    title: 'Sport & Bewegung',
    subtitle: 'Aktiv, gesund und mit Freude dabei',
    intro:
      'Bewegung ist essentiell für die gesunde Entwicklung von Kindern und Jugendlichen. In der Schweiz gibt es ein reiches Angebot an Sportkursen für alle Altersgruppen und Interessen.',
    points: [
      { icon: '⚽', title: 'Mannschaftssport', text: 'Fussball, Basketball, Volleyball – Teamgeist und Spass am Spiel.' },
      { icon: '🤸', title: 'Turnen & Akrobatik', text: 'Koordination, Kraft und Beweglichkeit spielerisch aufbauen.' },
      { icon: '🥋', title: 'Kampfsport', text: 'Judo, Karate, Kung Fu – Disziplin und Respekt als Basis.' },
      { icon: '🏊', title: 'Schwimmen', text: 'Schwimmkurse sind für alle Kinder eine wichtige und sicherheitsrelevante Grundlage.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['freizeit_hobbys', '15'],
    hintText: 'Sportkurs-Empfehlungen nach Altersgruppe folgen in Kürze.',
  },
  'kinder-jugend/mint-technik': {
    title: 'MINT & Technik',
    subtitle: 'Neugier wecken, Zukunft gestalten',
    intro:
      'MINT-Fächer (Mathematik, Informatik, Naturwissenschaft, Technik) sind die Schlüsselkompetenzen der Zukunft. Spielerische MINT-Kurse wecken früh Begeisterung und bauen ein starkes Fundament.',
    points: [
      { icon: '🤖', title: 'Robotik & Coding', text: 'Lego Mindstorms, Scratch, Python – Kinder lernen spielerisch, wie Technologie funktioniert.' },
      { icon: '🔬', title: 'Experimente & Wissenschaft', text: 'Experimente aus der Natur- und Chemiewissenschaft, die wirklich begeistern.' },
      { icon: '🧩', title: 'Logik & Problemlösung', text: 'Algorithmisches Denken und kreative Problemlösung als Lebenskompetenz.' },
      { icon: '🌱', title: 'Für alle Geschlechter', text: 'Gute MINT-Kurse sind explizit inklusiv und fördern alle Kinder gleichermassen.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['technik_medien'],
    hintText: 'Mehr MINT-Kurs-Empfehlungen und Ratgeber für Eltern folgen in Kürze.',
  },
  'kinder-jugend/ferienkurse-camps': {
    title: 'Ferienkurse & Camps',
    subtitle: 'Sinnvoll, aktiv und unvergesslich in den Ferien',
    intro:
      'Ferienkurse und Camps bieten Kindern und Jugendlichen die Möglichkeit, neue Fähigkeiten zu entdecken, Freundschaften zu schliessen und die Ferienzeit mit echten Erlebnissen zu füllen.',
    points: [
      { icon: '☀️', title: 'Thematische Camps', text: 'Sport, Musik, Coding, Kreativität – es gibt Camps für fast jedes Interesse.' },
      { icon: '🏕️', title: 'Natur & Abenteuer', text: 'Draussen sein, die Natur entdecken und zusammen Herausforderungen meistern.' },
      { icon: '👫', title: 'Neue Freundschaften', text: 'Ferienkurse sind eine grosse Chance, Gleichaltrige mit ähnlichen Interessen kennenzulernen.' },
      { icon: '🗓️', title: 'Flexibel buchbar', text: 'Viele Angebote lassen sich kurzfristig und für verschiedene Ferienwochen buchen.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['ferien'],
    hintText: 'Empfehlungen für Ferienkurse und Camps in der Schweiz folgen in Kürze.',
  },
  'kinder-jugend/musik-kinder': {
    title: 'Musik für Kinder',
    subtitle: 'Rhythmus, Instrumente und Freude am Klingen',
    intro:
      'Musik lernen als Kind ist eine der wertvollsten Investitionen. Es fördert Konzentration, Kreativität und soziale Fähigkeiten – und macht dabei eine Menge Spass.',
    points: [
      { icon: '🎹', title: 'Frühinstrumentalisierung', text: 'Kinder können ab ca. 5 Jahren mit ersten Instrumenten beginnen – spielerisch und angepasst.' },
      { icon: '🥁', title: 'Breite Auswahl', text: 'Klavier, Gitarre, Schlagzeug, Flöte – die Wahl hängt von Kind und Familie ab.' },
      { icon: '🎶', title: 'Musikalische Früherziehung', text: 'Für Kleinkinder: Rhythmik, Singen und spielerisches Bewegen zur Musik.' },
      { icon: '🎤', title: 'Chor & Ensemble', text: 'Gemeinsam musizieren macht Spass und fördert Teamgeist und Zusammenhalt.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['18'],
    hintText: 'Musikschul-Vergleiche und Tipps zur Instrumentenwahl folgen in Kürze.',
  },
  'kinder-jugend/sprachen-lernen': {
    title: 'Sprachen & Lernen',
    subtitle: 'Sprachkurse und schulische Förderung für Kinder & Jugendliche',
    intro:
      'Sprachen früh lernen ist eine der wertvollsten Investitionen in die Zukunft eines Kindes. Ob Englisch-Kurs, spielerisches Fremdsprachenlernen oder gezielte schulische Unterstützung – in der Schweiz gibt es passende Angebote für jedes Alter.',
    points: [
      { icon: '🇬🇧', title: 'Englisch für Kinder', text: 'Spielerisch und altersgerecht – der Einstieg in die Weltsprache Nr. 1.' },
      { icon: '🗣️', title: 'Weitere Fremdsprachen', text: 'Französisch, Spanisch, Italienisch und mehr – für neugierige Kinder und Jugendliche.' },
      { icon: '📖', title: 'Schulbegleitung', text: 'Gezielte Unterstützung in Schulfächern, die mehr Übung brauchen.' },
      { icon: '🌟', title: 'Lernfreude fördern', text: 'Mit den richtigen Methoden macht Lernen Spass und baut Selbstvertrauen auf.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['schule_lernen'],
    hintText: 'Weitere Empfehlungen für Sprach- und Lernkurse für Kinder folgen in Kürze.',
  },

  // ---- KINDER & JUGEND THEMEN (new slugs matching dropdown exactly) ----
  'kinder-jugend/fruehkindliche-bildung': {
    title: 'Frühkindliche Bildung',
    subtitle: 'Eltern-Kind-Turnen, Musikgarten & Spielgruppen (0–5)',
    intro:
      'Die ersten Lebensjahre sind prägend. Frühkindliche Bildungsangebote unterstützen Kleinkinder in ihrer motorischen, sprachlichen und sozialen Entwicklung – und helfen Eltern, diese wichtige Phase aktiv zu begleiten.',
    points: [
      { icon: '🎵', title: 'Musikgarten & Rhythmik', text: 'Musik und Bewegung fördern Sprachentwicklung, Koordination und Kreativität schon ab Geburt.' },
      { icon: '🤸', title: 'Eltern-Kind-Turnen', text: 'Gemeinsame Bewegung stärkt die Bindung und unterstützt die motorische Entwicklung.' },
      { icon: '👶', title: 'Spielgruppen', text: 'Soziale Kontakte knüpfen, spielerisch lernen – ideal für Kinder ab ca. 2 Jahren.' },
      { icon: '🌱', title: 'Sprachförderung', text: 'Frühzeitige Sprachförderung legt den Grundstein für Schulerfolg und Kommunikation.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['fruehkind'],
    hintText: 'Mehr Tipps zu frühkindlicher Bildung und Angeboten in deiner Region folgen in Kürze.',
  },
  'kinder-jugend/schule-lernen': {
    title: 'Schule & Lernen',
    subtitle: 'Nachhilfe, Lerncoaching & Prüfungsvorbereitung',
    intro:
      'Schulische Förderung, Nachhilfe und gezielte Prüfungsvorbereitung helfen Kindern und Jugendlichen, ihr volles Potenzial zu entfalten. In der Schweiz gibt es ein vielfältiges Angebot für alle Schulstufen und Fächer.',
    points: [
      { icon: '📖', title: 'Nachhilfe', text: 'Individuelle Unterstützung in Mathematik, Deutsch, Englisch und weiteren Fächern.' },
      { icon: '🎓', title: 'Prüfungsvorbereitung', text: 'Gezielt für Aufnahmeprüfungen, Abschlussprüfungen oder Einstufungstests lernen.' },
      { icon: '🧠', title: 'Lerncoaching', text: 'Lernstrategien entwickeln, Selbstorganisation verbessern, Motivation aufbauen.' },
      { icon: '🇬🇧', title: 'Sprachkurse', text: 'Englisch, Französisch, Deutsch – altersgerechte Sprachkurse für Kinder und Jugendliche.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['schule_lernen'],
    hintText: 'Weitere Empfehlungen für Lernkurse und Nachhilfe folgen in Kürze.',
  },
  'kinder-jugend/hobbys-sport': {
    title: 'Hobbys, Sport & Kreatives',
    subtitle: 'Turnen, Kampfsport, Musik, Basteln & Theater',
    intro:
      'Freizeitgestaltung ist mehr als Zeitvertreib – sie formt Charakter, Sozialkompetenz und Talente. Von Sportkursen bis zu Kreativwerkstätten: Für jedes Kind gibt es das passende Angebot.',
    points: [
      { icon: '⚽', title: 'Sport & Bewegung', text: 'Fussball, Turnen, Kampfsport, Schwimmen – aktiv sein macht Spass und hält gesund.' },
      { icon: '🎨', title: 'Kreativität & Kunst', text: 'Malen, Basteln, Theater – Kinder entdecken spielerisch ihre kreativen Talente.' },
      { icon: '🎵', title: 'Musik & Tanz', text: 'Instrument lernen, Tanzen, Singen – musische Bildung fördert viele Kompetenzen.' },
      { icon: '🤸', title: 'Zirkus & Akrobatik', text: 'Koordination, Mut und Spass – Zirkusprojekte begeistern Kinder aller Altersgruppen.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['freizeit_hobbys'],
    hintText: 'Weitere Freizeitkurs-Empfehlungen für Kinder folgen in Kürze.',
  },
  'kinder-jugend/coding-technik': {
    title: 'Coding & Technik',
    subtitle: 'Programmieren, Robotik & Medienkompetenz',
    intro:
      'Digitale Kompetenz ist die Schlüsselqualifikation des 21. Jahrhunderts. Mit spielerischem Coding, Robotikprojekten und Medienbildung legst du den Grundstein für die Zukunft deines Kindes.',
    points: [
      { icon: '🤖', title: 'Robotik', text: 'Lego Mindstorms, Arduino, Raspberry Pi – Kinder bauen und programmieren eigene Roboter.' },
      { icon: '💻', title: 'Programmieren', text: 'Scratch, Python, App-Entwicklung – spielerisch die Grundlagen der Informatik lernen.' },
      { icon: '📱', title: 'Medienkompetenz', text: 'Sicherer Umgang mit Internet, Social Media und digitalen Werkzeugen.' },
      { icon: '🔬', title: 'MINT-Projekte', text: 'Experimente, Erfindungen und Kreativprojekte aus Mathematik, Informatik und Technik.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['technik_medien'],
    hintText: 'Mehr MINT-Kurs-Empfehlungen für Kinder und Jugendliche folgen in Kürze.',
  },
  'kinder-jugend/feriencamps': {
    title: 'Feriencamps & Betreuung',
    subtitle: 'Sportcamps, Kreativcamps & Outdoorlager',
    intro:
      'Feriencamps bieten Kindern und Jugendlichen die Möglichkeit, neue Freundschaften zu schliessen, Neues auszuprobieren und die Ferienzeit sinnvoll und unvergesslich zu gestalten.',
    points: [
      { icon: '☀️', title: 'Thematische Camps', text: 'Sport, Musik, Coding, Kunst – für fast jedes Interesse gibt es spezialisierte Camps.' },
      { icon: '🏕️', title: 'Outdoorlager', text: 'Natur erleben, Abenteuer bestehen, zusammen als Gruppe wachsen.' },
      { icon: '👫', title: 'Neue Freundschaften', text: 'Feriencamps sind ideale Orte, um Gleichaltrige mit ähnlichen Interessen kennenzulernen.' },
      { icon: '🗓️', title: 'Flexibel buchbar', text: 'Viele Camps lassen sich kurzfristig und für verschiedene Ferienwochen buchen.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['ferien'],
    hintText: 'Empfehlungen für Feriencamps und Lager in der Schweiz folgen in Kürze.',
  },
  'kinder-jugend/elternbildung': {
    title: 'Elternbildung',
    subtitle: 'Geburtsvorbereitung, Erziehung & Erste Hilfe am Kind',
    intro:
      'Eltern sein ist die grösste Aufgabe – und gleichzeitig eine, für die es kaum formale Ausbildung gibt. Elternbildungskurse geben praktisches Wissen, stärken das Vertrauen und schaffen Raum für Austausch.',
    points: [
      { icon: '🤰', title: 'Geburtsvorbereitung', text: 'Geburtsvorbereitungskurse für werdende Eltern – Wissen, Übungen und emotionale Begleitung.' },
      { icon: '👶', title: 'Baby-Kurse', text: 'Erste Hilfe am Kind, Babymassage, Babyschwimmen – für die ersten Lebensmonate.' },
      { icon: '🤝', title: 'Erziehung & Entwicklung', text: 'Elternkurse zu Trotzphasen, Grenzen setzen, Kommunikation mit Kindern.' },
      { icon: '💙', title: 'Beziehung & Bindung', text: 'Sichere Bindung aufbauen, Beziehung stärken – gut für Eltern und Kind.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['eltern'],
    hintText: 'Weitere Empfehlungen für Elternbildung und Familienkurse folgen in Kürze.',
  },

  // ---- KINDER & JUGEND KURSARTEN (editorial only) ----
  'kinder-jugend/freizeitkurse': {
    title: 'Freizeitkurse für Kinder',
    subtitle: 'Regelmässige Aktivitäten, die begeistern',
    intro:
      'Regelmässige Freizeitkurse geben Kindern und Jugendlichen Struktur, soziale Kontakte und die Möglichkeit, etwas aufzubauen, das ihnen Freude macht.',
    points: [
      { icon: '🎯', title: 'Breites Angebot', text: 'Sport, Musik, Kunst, Theater – für jede Persönlichkeit gibt es das passende Angebot.' },
      { icon: '🌱', title: 'Kontinuierlich entwickeln', text: 'Regelmässige Kurse fördern Ausdauer, Konzentration und Selbstvertrauen.' },
      { icon: '👫', title: 'Soziale Kompetenz', text: 'In Kursen lernen Kinder Teamarbeit, Rücksichtnahme und Konfliktlösung.' },
      { icon: '🏡', title: 'In der Nähe', text: 'Viele Anbieter sind lokal tätig – ideal für Kurse nach der Schule.' },
    ],
    showCourseList: false,
    hintText: 'Mehr Tipps für Freizeitkurse und Aktivitäten für Kinder folgen in Kürze.',
  },

  // ---- URLs die erreichbar bleiben, aber keine prominenten Kurse zeigen ----
  'kinder-jugend/nachhilfe': {
    title: 'Sprachen & Lernen',
    subtitle: 'Sprachkurse und Unterstützung für Kinder & Jugendliche',
    intro:
      'Sprachkurse, Lernförderung und schulische Unterstützung – in der Schweiz gibt es passende Angebote für jedes Alter und Bedürfnis.',
    points: [
      { icon: '🇬🇧', title: 'Englisch für Kinder', text: 'Spielerisch und altersgerecht – der Einstieg in die Weltsprache Nr. 1.' },
      { icon: '📖', title: 'Schulbegleitung', text: 'Gezielte Unterstützung in Schulfächern, die mehr Übung brauchen.' },
      { icon: '🗣️', title: 'Weitere Fremdsprachen', text: 'Französisch, Spanisch, Italienisch und mehr.' },
      { icon: '🌟', title: 'Lernfreude fördern', text: 'Mit den richtigen Methoden macht Lernen Spass und baut Selbstvertrauen auf.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['schule_lernen'],
    hintText: 'Weitere Empfehlungen für Sprach- und Lernkurse für Kinder folgen in Kürze.',
  },
  'kinder-jugend/nachhilfe-pruefungsvorbereitung': {
    title: 'Sprachen & Lernen',
    subtitle: 'Sprachkurse und schulische Förderung für Kinder & Jugendliche',
    intro:
      'Sprachkurse, Lernförderung und schulische Unterstützung – in der Schweiz gibt es passende Angebote für jedes Alter.',
    points: [
      { icon: '🇬🇧', title: 'Englisch für Kinder', text: 'Spielerisch und altersgerecht – der Einstieg in die Weltsprache Nr. 1.' },
      { icon: '📖', title: 'Schulbegleitung', text: 'Gezielte Unterstützung in Schulfächern, die mehr Übung brauchen.' },
      { icon: '🗣️', title: 'Weitere Fremdsprachen', text: 'Französisch, Spanisch, Italienisch und mehr.' },
      { icon: '🌟', title: 'Lernfreude fördern', text: 'Mit den richtigen Methoden macht Lernen Spass und baut Selbstvertrauen auf.' },
    ],
    showCourseList: true,
    typeAliases: ['kinder_jugend', 'kinder'],
    areaAliases: ['schule_lernen'],
    hintText: 'Weitere Empfehlungen für Sprach- und Lernkurse für Kinder folgen in Kürze.',
  },
};

/**
 * Resolve segment key from URL segment string
 * URL uses dashes, config uses underscore for keys
 */
export const resolveSegmentKey = (urlSegment) => {
  const map = {
    'beruflich': 'beruflich',
    'privat-hobby': 'privat_hobby',
    'kinder-jugend': 'kinder_jugend',
  };
  return map[urlSegment] || urlSegment;
};

/**
 * Map segment key to SEGMENT_CONFIG type key
 */
export const segmentToTypeKey = (urlSegment) => {
  const map = {
    'beruflich': 'beruflich',
    'privat-hobby': 'privat_hobby',
    'kinder-jugend': 'kinder_jugend',
  };
  return map[urlSegment] || 'privat_hobby';
};

/**
 * Map segment key to DB type
 */
export const segmentToDbType = (urlSegment) => {
  const map = {
    'beruflich': 'professionell',
    'privat-hobby': 'privat',
    'kinder-jugend': 'kinder',
  };
  return map[urlSegment] || 'privat';
};
