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
    themen: [
      {
        slug: 'sport-fitness',
        label: 'Sport & Fitness',
        icon: '💪',
        desc: 'Trainerausbildungen, Diplome & Spezialisierungen',
        isThemenwelt: true,
        href: '/bereich/beruflich/sport-fitness-berufsausbildung',
        image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'it-digital',
        label: 'IT & Digital',
        icon: '💻',
        desc: 'Programmierung, Daten & digitale Transformation',
        isThemenwelt: false,
        href: '/thema/beruflich/it-digital',
        image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'fuehrung-management',
        label: 'Führung & Management',
        icon: '🏢',
        desc: 'Leadership, Projektmanagement & Unternehmensführung',
        isThemenwelt: false,
        href: '/thema/beruflich/fuehrung-management',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'kommunikation-sprachen',
        label: 'Kommunikation & Sprachen',
        icon: '🌐',
        desc: 'Rhetorik, Präsentation, Sprachkurse & interkulturelle Kompetenz',
        isThemenwelt: false,
        href: '/thema/beruflich/kommunikation-sprachen',
        image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=800',
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
    themen: [
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
        label: 'Musik',
        icon: '🎵',
        desc: 'Gitarre, Klavier, Gesang & mehr',
        isThemenwelt: false,
        href: '/thema/privat-hobby/musik',
        image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'kochen-genuss',
        label: 'Kochen & Genuss',
        icon: '🍳',
        desc: 'Kochtechniken, Backen, Wein & kulinarische Erlebnisse',
        isThemenwelt: false,
        href: '/thema/privat-hobby/kochen-genuss',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'kunst-kreativitaet',
        label: 'Kunst & Kreativität',
        icon: '🎨',
        desc: 'Malen, Zeichnen, Töpfern, Fotografie & kreatives Gestalten',
        isThemenwelt: false,
        href: '/thema/privat-hobby/kunst-kreativitaet',
        image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=800',
      },
    ],
  },

  kinder_jugend: {
    kursarten: [
      {
        slug: 'nachhilfe-pruefungsvorbereitung',
        icon: '📚',
        label: 'Nachhilfe & Prüfungsvorbereitung',
        desc: 'Gezielt fördern, Lücken schliessen und sicher in Prüfungen gehen.',
        image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80&w=800',
        href: '/thema/kinder-jugend/nachhilfe-pruefungsvorbereitung',
      },
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
    themen: [
      {
        slug: 'nachhilfe',
        label: 'Nachhilfe',
        icon: '📖',
        desc: 'Mathematik, Sprachen, Naturwissenschaften',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/nachhilfe',
        image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'musik-kinder',
        label: 'Musik für Kinder',
        icon: '🎸',
        desc: 'Instrumente lernen, Rhythmus & musikalische Früherziehung',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/musik-kinder',
        image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'sport-bewegung',
        label: 'Sport & Bewegung',
        icon: '⚽',
        desc: 'Fussball, Turnen, Schwimmen, Kampfsport & mehr',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/sport-bewegung',
        image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&q=80&w=800',
      },
      {
        slug: 'mint-technik',
        label: 'MINT & Technik',
        icon: '🔬',
        desc: 'Coding, Robotik, Naturwissenschaften & Technik',
        isThemenwelt: false,
        href: '/thema/kinder-jugend/mint-technik',
        image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800',
      },
    ],
  },
};

// ------------------------------------------------------------
// SIMPLE TOPIC CONTENT (for topics without a full Themenwelt)
// Key: "{segment}/{slug}" (where segment uses dashes for URL, underscore for key)
// ------------------------------------------------------------

export const SIMPLE_TOPIC_CONTENT = {
  // ---- BERUFLICH ----
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
    searchType: 'beruflich',
    searchKeywords: ['diplom', 'lehrgang', 'fachausweis', 'abschluss', 'zertifikat', 'eidg', 'ifa', 'höhere fachschule'],
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
    searchType: 'beruflich',
    searchKeywords: ['fachkurs', 'seminar', 'weiterbildung', 'skill', 'update', 'kompetenz', 'praxiskurs'],
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
    searchType: 'beruflich',
    searchKeywords: ['quereinstieg', 'neuorientierung', 'umschulung', 'berufswechsel', 'einstieg', 'neustart'],
    hintText: 'Ausführliche Ratgeber zum Thema Quereinstieg und Berufswechsel folgen in Kürze.',
  },
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
    searchType: 'beruflich',
    searchKeywords: ['it', 'digital', 'coding', 'python', 'java', 'web', 'cloud', 'software', 'daten', 'informatik', 'computer', 'programmier', 'cybersecurity', 'ki', 'künstliche intelligenz'],
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
    searchType: 'beruflich',
    searchKeywords: ['führung', 'management', 'leadership', 'projekt', 'chef', 'kader', 'hr', 'personal', 'strategie', 'agile', 'scrum', 'cas'],
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
    searchType: 'beruflich',
    searchKeywords: ['kommunikation', 'sprache', 'englisch', 'französisch', 'rhetorik', 'präsentation', 'sprachkurs', 'interkulturell', 'schreiben', 'vortrag'],
    hintText: 'Mehr Inhalte zu Sprachkursen und Kommunikationstraining folgen in Kürze.',
  },

  // ---- PRIVAT & HOBBY ----
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
    searchType: 'privat',
    searchKeywords: ['workshop', 'halbtag', 'tagesworkshop', 'schnuppern', 'erleben', 'einmalig'],
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
    searchType: 'privat',
    searchKeywords: ['einsteiger', 'anfänger', 'beginner', 'grundkurs', 'erstmals', 'keine vorkenntnisse'],
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
    searchType: 'privat',
    searchKeywords: ['regelmässig', 'wöchentlich', 'monatlich', 'kursgruppe', 'dauerkurs', 'semester'],
    hintText: 'Mehr Tipps zur Auswahl regelmässiger Kurse folgen in Kürze.',
  },
  'privat-hobby/yoga-achtsamkeit': {
    title: 'Yoga & Achtsamkeit',
    subtitle: 'Innere Balance, Entspannung und Körperbewusstsein',
    intro:
      'Yoga und Achtsamkeitspraktiken helfen, den Alltag bewusster zu erleben, Stress zu reduzieren und in Verbindung mit dem eigenen Körper zu bleiben. In der Schweiz gibt es zahlreiche Angebote – von klassischem Hatha-Yoga bis zu modernen Achtsamkeitsprogrammen.',
    points: [
      { icon: '🧘', title: 'Verschiedene Yoga-Stile', text: 'Hatha, Vinyasa, Yin, Restorative – entdecke, welcher Stil zu dir passt.' },
      { icon: '🧠', title: 'Meditation & MBSR', text: 'Achtsamkeitsbasierte Kurse helfen, den Geist zu beruhigen und klarer zu denken.' },
      { icon: '🌿', title: 'Online & Präsenz', text: 'Viele Angebote gibt es sowohl vor Ort als auch bequem von zu Hause aus.' },
      { icon: '💆', title: 'Für alle Level', text: 'Ob Anfänger oder Fortgeschrittener – es gibt passende Kurse für jede Stufe.' },
    ],
    searchType: 'privat',
    searchKeywords: ['yoga', 'achtsamkeit', 'meditation', 'hatha', 'vinyasa', 'yin', 'mbsr', 'entspannung', 'pilates', 'mindfulness'],
    hintText: 'Ausführliche Yoga-Ratgeber und Kursvergleiche folgen in Kürze.',
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
    searchType: 'privat',
    searchKeywords: ['musik', 'gitarre', 'klavier', 'gesang', 'geige', 'schlagzeug', 'instrument', 'chor', 'piano', 'flöte', 'singen'],
    hintText: 'Mehr Musik-Ratgeber und Instrumentenguides folgen in Kürze.',
  },
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
    searchType: 'privat',
    searchKeywords: ['kochen', 'backen', 'küche', 'kochkurs', 'patisserie', 'wein', 'kulinar', 'gastro', 'rezept'],
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
    searchType: 'privat',
    searchKeywords: ['malen', 'zeichnen', 'kunst', 'kreativ', 'töpfern', 'keramik', 'fotografie', 'nähen', 'stricken', 'aquarell', 'acryl'],
    hintText: 'Ausführliche Kreativ-Ratgeber und Kursempfehlungen folgen in Kürze.',
  },

  // ---- KINDER & JUGEND ----
  'kinder-jugend/nachhilfe-pruefungsvorbereitung': {
    title: 'Nachhilfe & Prüfungsvorbereitung',
    subtitle: 'Gezielt fördern, Sicherheit gewinnen',
    intro:
      'Ob Aufnahmeprüfung, Maturaprüfung oder einfach die nächste Schularbeit – gezielte Nachhilfe und Prüfungsvorbereitung helfen Kindern und Jugendlichen, sich sicher und gut vorbereitet zu fühlen.',
    points: [
      { icon: '📚', title: 'Lücken schliessen', text: 'Gezielte Aufarbeitung von Schwächen in Mathe, Deutsch, Englisch oder anderen Fächern.' },
      { icon: '🎯', title: 'Prüfungsstrategie', text: 'Lernen, wie man sich optimal auf Prüfungen vorbereitet – Zeitmanagement, Methodik, Stressabbau.' },
      { icon: '👩‍🏫', title: 'Einzel oder Gruppe', text: 'Einzelnachhilfe oder kleine Gruppen – je nach Lerntyp und Budget.' },
      { icon: '💻', title: 'Online möglich', text: 'Online-Nachhilfe ist flexibel und wird von vielen Anbietern angeboten.' },
    ],
    searchType: 'kinder',
    searchKeywords: ['nachhilfe', 'prüfung', 'matura', 'mathe', 'mathematik', 'deutsch', 'englisch', 'schule', 'lernen', 'aufnahmeprüfung'],
    hintText: 'Mehr Ratgeber zur Schulförderung und Prüfungsvorbereitung folgen in Kürze.',
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
    searchType: 'kinder',
    searchKeywords: ['ferien', 'camp', 'ferienkurs', 'schulferien', 'sommercamp', 'abenteuer', 'ferienbetreuung'],
    hintText: 'Empfehlungen für Ferienkurse und Camps in der Schweiz folgen in Kürze.',
  },
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
    searchType: 'kinder',
    searchKeywords: ['freizeit', 'kinder', 'jugend', 'nachmittag', 'hobby', 'aktivität', 'freizeitkurs'],
    hintText: 'Mehr Tipps für Freizeitkurse und Aktivitäten für Kinder folgen in Kürze.',
  },
  'kinder-jugend/nachhilfe': {
    title: 'Nachhilfe',
    subtitle: 'Fördern, wo es zählt',
    intro:
      'Nachhilfe hilft Kindern und Jugendlichen, schulische Herausforderungen zu überwinden und ihr volles Potential zu entfalten. Mit dem richtigen Angebot werden Lücken geschlossen und Selbstvertrauen aufgebaut.',
    points: [
      { icon: '📐', title: 'Mathematik', text: 'Das häufigste Nachhilfefach – von der Primarschule bis zur Matura.' },
      { icon: '📖', title: 'Deutsch & Fremdsprachen', text: 'Lesen, Schreiben, Grammatik – in Deutsch und anderen Sprachen.' },
      { icon: '🔭', title: 'Naturwissenschaften', text: 'Biologie, Chemie, Physik – Nachhilfe macht abstrakte Inhalte verständlich.' },
      { icon: '👩‍🏫', title: 'Qualifizierte Lehrende', text: 'Ausgebildete Lehrerinnen und Lehrer oder erfahrene Studierende als Tutoren.' },
    ],
    searchType: 'kinder',
    searchKeywords: ['nachhilfe', 'mathe', 'mathematik', 'deutsch', 'naturwissenschaft', 'biologie', 'chemie', 'physik', 'lernen', 'tutor'],
    hintText: 'Ratgeber zur Auswahl des richtigen Nachhilfeangebots folgen in Kürze.',
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
    searchType: 'kinder',
    searchKeywords: ['musik', 'instrument', 'klavier', 'gitarre', 'flöte', 'schlagzeug', 'rhythmik', 'singen', 'chor', 'früherziehung', 'musikschule'],
    hintText: 'Musikschul-Vergleiche und Tipps zur Instrumentenwahl folgen in Kürze.',
  },
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
    searchType: 'kinder',
    searchKeywords: ['sport', 'fussball', 'turnen', 'schwimmen', 'kampfsport', 'judo', 'karate', 'basketball', 'volleyball', 'akrobatik', 'bewegung'],
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
    searchType: 'kinder',
    searchKeywords: ['mint', 'coding', 'robotik', 'informatik', 'programmieren', 'roboter', 'naturwissenschaft', 'technik', 'scratch', 'python', 'lego'],
    hintText: 'Mehr MINT-Kurs-Empfehlungen und Ratgeber für Eltern folgen in Kürze.',
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
