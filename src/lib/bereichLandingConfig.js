/**
 * Bereichs-Landingpage Configuration
 *
 * Konfiguration fuer Level-2-Landingpages (Bereiche/Themenwelten).
 * Jeder Eintrag definiert Content, Szenarien, Suchlinks und FAQs
 * fuer einen spezifischen Bereich.
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
      de: 'Sport & Fitness - Finde deine Ausbildung',
      en: 'Sports & Fitness - Find Your Training',
      fr: 'Sport & Fitness - Trouve ta formation',
      it: 'Sport & Fitness - Trova la tua formazione'
    },
    subtitle: {
      de: 'Fitnesstrainer, Personal Training, Group Fitness und mehr',
      en: 'Fitness Trainer, Personal Training, Group Fitness and more',
      fr: 'Coach fitness, entrainement personnel, fitness en groupe et plus',
      it: 'Istruttore fitness, personal training, fitness di gruppo e altro'
    },
    heroImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=2000',

    scenarios: [
      { slug: 'berufseinstieg', icon: '🎓', label: { de: 'Berufseinstieg' }, text: { de: 'Du willst Fitnesstrainer werden? Starte mit der Basis-Ausbildung.' }, searchParams: { spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' }, ctaLabel: { de: 'Einstiegskurse entdecken' } },
      { slug: 'quereinstieg', icon: '🔄', label: { de: 'Quereinstieg' }, text: { de: 'Quereinstieg in die Fitnessbranche? Wir zeigen dir den Weg.' }, searchParams: { spec: 'Fitness-Trainer-Ausbildung' }, ctaLabel: { de: 'Quereinsteiger-Kurse entdecken' } },
      { slug: 'weiterbildung', icon: '📈', label: { de: 'Weiterbildung' }, text: { de: 'Schon Trainer? Spezialisiere dich in Functional Training, Ernährung oder Personal Training.' }, searchParams: { spec: 'Trainingsmethoden & Spezialisierungen' }, ctaLabel: { de: 'Weiterbildungskurse entdecken' } },
      { slug: 'diplom-aufstieg', icon: '🏆', label: { de: 'Diplom & Aufstieg' }, text: { de: 'Bereit für den nächsten Schritt? Diplom-Lehrgang und eidg. Fachausweis.' }, searchParams: { spec: 'Zertifikate & Pruefungsvorbereitung' }, ctaLabel: { de: 'Diplom-Kurse entdecken' } },
      { slug: 'nebenerwerb', icon: '⚡', label: { de: 'Nebenerwerb' }, text: { de: 'Deine Leidenschaft zum Beruf machen - auch nebenberuflich.' }, searchParams: { spec: 'Group-Fitness / Kursleitung' }, ctaLabel: { de: 'Kurse für Nebenerwerb entdecken' } },
      { slug: 'selbststaendigkeit', icon: '🏢', label: { de: 'Selbstständigkeit' }, text: { de: 'Eigenes Studio? Lerne alles über Business, Recht und Versicherung.' }, searchParams: { spec: 'Business & Selbststaendigkeit' }, ctaLabel: { de: 'Business-Kurse entdecken' } },
      { slug: 'spezialisierung', icon: '🎯', label: { de: 'Spezialisierung' }, text: { de: 'Rückentraining, Antara, Kampfsport - finde deine Nische.' }, searchParams: { spec: 'Trainingsmethoden & Spezialisierungen' }, ctaLabel: { de: 'Spezialisierungskurse entdecken' } },
      { slug: 'zertifizierung', icon: '✅', label: { de: 'Zertifizierung' }, text: { de: 'Qualitop, QualiCert, eidg. FA - welches Zertifikat passt zu dir?' }, searchParams: { spec: 'Zertifikate & Pruefungsvorbereitung' }, ctaLabel: { de: 'Zertifizierungskurse entdecken' } },
    ],

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
        de: 'Kraft & Ausdauer, Rücken & Core, Functional Training, Kampfsport-Formate.',
        icon: '🔥'
      },
      'Mind-Body (Yoga & Pilates)': {
        de: 'Yoga- und Pilates-Ausbildungen für ganzheitliches Training. Achtsamkeit und Körperbewusstsein.',
        icon: '🧘'
      },
      'Ernaehrung & Coaching': {
        de: 'Sporternährung, Ernährungsberatung und Coaching-Kompetenzen. CAS und Seminare.',
        icon: '🥗'
      },
      'Zertifikate & Pruefungsvorbereitung': {
        de: 'Vorbereitung auf eidg. Prüfungen, Fitness-Lizenzen und Branchenzertifikate.',
        icon: '📋'
      },
      'Business & Selbststaendigkeit': {
        de: 'Unternehmer-Workshops, Recht, Versicherung, Datenschutz und Vertriebs-Know-how.',
        icon: '💼'
      }
    },

    predefinedSearches: [
      { label: { de: 'Fitnesstrainer Basiskurs' }, params: { spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' } },
      { label: { de: 'Personal Trainer Lehrgang' }, params: { spec: 'Personal-Trainer-Ausbildung' } },
      { label: { de: 'Group-Fitness Kursformate' }, params: { spec: 'Group-Fitness / Kursleitung' } },
      { label: { de: 'Rücken & Core Training' }, params: { spec: 'Trainingsmethoden & Spezialisierungen' } },
      { label: { de: 'Yoga & Pilates' }, params: { spec: 'Mind-Body (Yoga & Pilates)' } },
      { label: { de: 'Diplom & eidg. Prüfung' }, params: { spec: 'Zertifikate & Pruefungsvorbereitung' } },
      { label: { de: 'Ernährung & Coaching' }, params: { spec: 'Ernaehrung & Coaching' } },
      { label: { de: 'Online Kurse' }, params: {}, extraParams: { delivery: 'online_live,self_study' } },
    ],

    faqs: [
      {
        q: { de: 'Brauche ich eine Grundausbildung vor der Spezialisierung?' },
        a: { de: 'In der Regel ja. Die meisten Anbieter empfehlen die Fitness-Trainer Basis-Ausbildung (B-Lizenz) als Einstieg. Darauf aufbauend kannst du dich in Bereichen wie Personal Training, Group Fitness oder Ernährung spezialisieren.' }
      },
      {
        q: { de: 'Kann ich als Quereinsteiger direkt in die Fitnessbranche?' },
        a: { de: 'Absolut. Viele Basis-Ausbildungen setzen keine Vorkenntnisse voraus - nur Freude an Bewegung und Gesundheit. Die B-Lizenz ist ideal für den Einstieg, unabhängig von deinem bisherigen Beruf.' }
      },
      {
        q: { de: 'Welche Qualitätssiegel sind relevant?' },
        a: { de: 'In der Schweiz sind Qualitop, QualiCert und Fitness-Guide wichtige Zertifizierungen. Sie stehen für hohe Ausbildungsstandards und werden von Versicherungen und Arbeitgebern anerkannt.' }
      },
      {
        q: { de: 'Wie läuft die eidg. Prüfungsvorbereitung ab?' },
        a: { de: 'Die Vorbereitung auf den eidgenössischen Fachausweis umfasst mehrere Module und dauert in der Regel 1 bis 2 Jahre berufsbegleitend. Du kannst Bundesbeiträge von bis zu 50% der Kurskosten beantragen.' }
      },
      {
        q: { de: 'Welche Ausbildung passt als Nebenerwerb?' },
        a: { de: 'Group-Fitness-Instruktor oder Yoga/Pilates-Lehrer eignen sich besonders gut als Nebenerwerb. Die Ausbildungen sind kompakt und du kannst flexibel Kurse an Abenden oder Wochenenden geben.' }
      },
    ],

    sectionTitles: {
      scenarioTitle: { de: 'Wo stehst du?' },
      scenarioSubtitle: { de: 'Finde den passenden Einstieg - egal ob Anfänger oder Profi' },
      specialtiesTitle: { de: 'Ausbildungsbereiche' },
      specialtiesSubtitle: { de: 'Alle Schwerpunkte auf einen Blick' },
      searchesSubtitle: { de: 'Schnelleinstieg zu den gefragtesten Ausbildungen' },
      ctaTitle: { de: 'Bereit für den nächsten Schritt?' },
      ctaButton: { de: 'Alle Kurse anzeigen' }
    },

    trustLogos: [
      { name: 'Qualitop', description: { de: 'Qualitätszertifikat für Fitnesscenter und Ausbildungen in der Schweiz' } },
      { name: 'QualiCert', description: { de: 'Zertifizierung für Bewegungs- und Gesundheitsangebote' } },
      { name: 'Fitness-Guide', description: { de: 'Schweizer Ausbildungsstandard für Fitness-Professionals' } },
    ]
  },

  yoga_achtsamkeit: {
    slug: 'yoga-achtsamkeit',
    segment: 'privat_hobby',
    areaSlug: 'yoga_achtsamkeit',
    typeKey: 'privat_hobby',
    title: {
      de: 'Yoga & Achtsamkeit - Finde den Kurs, der zu dir passt',
      en: 'Yoga & Mindfulness - Find the Course That Fits You',
      fr: 'Yoga & Pleine conscience - Trouve le cours qui te convient',
      it: 'Yoga & Consapevolezza - Trova il corso giusto per te'
    },
    subtitle: {
      de: 'Finde Yoga-, Meditations- und Achtsamkeitskurse, die zu deinem Ziel, Level und Alltag passen',
      en: 'Yoga, meditation, breathwork, sound and body awareness for beginners and advanced',
      fr: 'Yoga, meditation, respiration, son et conscience corporelle pour debutants et avances',
      it: 'Yoga, meditazione, respirazione, suono e consapevolezza corporea per principianti e avanzati'
    },
    heroImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=2000',

    scenarios: [
      { slug: 'yoga-fuer-anfaenger', icon: '🧘', label: { de: 'Yoga für Anfänger' }, text: { de: 'Sicher starten ohne Vorkenntnisse: klare Stilempfehlungen, typische Stolpersteine und ein realistischer Einstieg.' }, searchParams: { spec: 'Yoga', focus: 'Hatha & Grundlagen' }, ctaLabel: { de: 'Anfängerkurse anzeigen' } },
      { slug: 'yoga-stile-finden', icon: '🧭', label: { de: 'Welcher Yogastil passt zu dir?' }, text: { de: 'Hatha, Vinyasa, Yin, Power oder Kundalini: finde den Stil, der zu deinem Ziel und Energielevel passt.' }, searchParams: { spec: 'Yoga' }, ctaLabel: { de: 'Yogastile vergleichen' } },
      { slug: 'stress-abbauen-entspannen', icon: '🌿', label: { de: 'Stress abbauen & entspannen' }, text: { de: 'Ruhige Formate für Entlastung, Regeneration und bessere Selbstregulation im Alltag.' }, searchParams: { spec: 'Meditation & Achtsamkeit' }, ctaLabel: { de: 'Entspannungskurse anzeigen' } },
      { slug: 'besser-schlafen-yoga-nidra', icon: '🌙', label: { de: 'Besser schlafen mit Yoga Nidra' }, text: { de: 'Tiefenentspannung sinnvoll nutzen: für wen Yoga Nidra passt und wie der Einstieg gelingt.' }, searchParams: { spec: 'Meditation & Achtsamkeit', focus: 'Yoga Nidra' }, ctaLabel: { de: 'Yoga Nidra Kurse finden' } },
      { slug: 'atemarbeit-breathwork', icon: '🫁', label: { de: 'Atemarbeit & Breathwork' }, text: { de: 'Pranayama, Breathwork, Atemreise: Unterschiede verstehen und sicher das passende Format wählen.' }, searchParams: { spec: 'Atemarbeit' }, ctaLabel: { de: 'Atemarbeit-Kurse anzeigen' } },
      { slug: 'klangmeditation-mantra', icon: '🔔', label: { de: 'Klangmeditation & Mantra' }, text: { de: 'Sound Bath, Gong, Kirtan und Klangreise: achtsame Formate für Ruhe, Fokus und Ausrichtung.' }, searchParams: { spec: 'Klang & Mantra' }, ctaLabel: { de: 'Klang-Kurse anzeigen' } },
      { slug: 'energiearbeit-reiki', icon: '✨', label: { de: 'Energiearbeit & Reiki' }, text: { de: 'Einordnen statt idealisieren: was dich in Reiki- und Energiearbeit-Kursen konkret erwartet.' }, searchParams: { spec: 'Energiearbeit' }, ctaLabel: { de: 'Reiki-Kurse anzeigen' } },
      { slug: 'bodywork-thai-yoga-massage', icon: '🤲', label: { de: 'Bodywork & Thai Yoga Massage' }, text: { de: 'Körperorientierte Methoden für Beweglichkeit, Entspannung und bewusste Berührung.' }, searchParams: { spec: 'Bodywork & Massage' }, ctaLabel: { de: 'Bodywork-Kurse anzeigen' } },
    ],

    specialtyDescriptions: {
      'Yoga': {
        de: 'Von Hatha bis Vinyasa, von Yin bis Power: finde deinen Stil mit passender Intensität und klarer Progression.',
        icon: '🧘'
      },
      'Meditation & Achtsamkeit': {
        de: 'Geführte und stille Meditation, MBSR-nahe Formate und Yoga Nidra für mentale Ruhe und Selbstregulation.',
        icon: '🕯️'
      },
      'Atemarbeit': {
        de: 'Pranayama, Breathwork und Atemreise: Atem als Werkzeug für Fokus, Regulation und Energie.',
        icon: '🫁'
      },
      'Klang & Mantra': {
        de: 'Klangmeditation, Sound Bath, Gong und Mantra-Praxis für Entschleunigung und innere Sammlung.',
        icon: '🔔'
      },
      'Somatics & Körperbewusstsein': {
        de: 'Feldenkrais, Embodiment, Mobility und entspannungsorientierte Körperarbeit für nachhaltige Wahrnehmung.',
        icon: '🧠'
      },
      'Energiearbeit': {
        de: 'Reiki, Chakra-Fokus und Healing-orientierte Angebote mit transparenter Kursbeschreibung.',
        icon: '✨'
      },
      'Bodywork & Massage': {
        de: 'Thai Yoga Massage, Massage und Körpertherapie als Ergänzung zu Yoga und achtsamem Training.',
        icon: '🤲'
      }
    },

    predefinedSearches: [
      { label: { de: 'Yoga für Anfänger (Hatha)' }, params: { spec: 'Yoga', focus: 'Hatha & Grundlagen' } },
      { label: { de: 'Vinyasa & Flow' }, params: { spec: 'Yoga', focus: 'Vinyasa & Flow' } },
      { label: { de: 'Yin & Restorative' }, params: { spec: 'Yoga', focus: 'Yin & Restorative' } },
      { label: { de: 'Yoga Nidra' }, params: { spec: 'Meditation & Achtsamkeit', focus: 'Yoga Nidra' } },
      { label: { de: 'Achtsamkeitstraining (MBSR/Alltag)' }, params: { spec: 'Meditation & Achtsamkeit', focus: 'Achtsamkeitstraining (MBSR/Alltag)' } },
      { label: { de: 'Pranayama & Breathwork' }, params: { spec: 'Atemarbeit' } },
      { label: { de: 'Klangmeditation / Sound Bath' }, params: { spec: 'Klang & Mantra', focus: 'Klangmeditation / Sound Bath' } },
      { label: { de: 'Reiki' }, params: { spec: 'Energiearbeit', focus: 'Reiki' } },
      { label: { de: 'Thai Yoga Massage' }, params: { spec: 'Bodywork & Massage', focus: 'Thai Yoga Massage' } },
      { label: { de: 'Online Kurse' }, params: {}, extraParams: { delivery: 'online_live,self_study' } },
    ],

    faqs: [
      {
        q: { de: 'Brauche ich Vorkenntnisse für Yoga oder Meditation?' },
        a: { de: 'Nein. Viele Angebote sind explizit für Einsteiger konzipiert. Achte auf Level-Angaben wie "Einsteiger", "All Levels" oder "sanft". Wenn du unsicher bist, starte mit Hatha-Grundlagen, Yin oder geführter Meditation und frage die Lehrperson vorab nach Anpassungen.' }
      },
      {
        q: { de: 'Welcher Stil passt zu meinem Ziel?' },
        a: { de: 'Für Entspannung und Regeneration sind häufig Yin, Restorative, Yoga Nidra oder achtsamkeitsbasierte Formate passend. Für mehr Dynamik und Fitness eignen sich Vinyasa, Power oder Ashtanga-orientierte Kurse. Bei Rückenfokus oder sensiblen Themen sind langsame, ausrichtungsorientierte Kurse oft sinnvoll.' }
      },
      {
        q: { de: 'Was ist der Unterschied zwischen Pranayama und Breathwork?' },
        a: { de: 'Pranayama bezeichnet klassische Yogaatmung mit klaren Techniken und Struktur. Breathwork ist ein breiter Sammelbegriff für moderne Atemmethoden, die je nach Kurs sehr ruhig oder intensiv sein können. Lies die Kursbeschreibung genau und starte bei Unsicherheit mit sanften Formaten.' }
      },
      {
        q: { de: 'Online oder vor Ort: was ist besser?' },
        a: { de: 'Vor Ort ist oft besser für direkte Korrekturen und Gruppenerlebnis. Online ist flexibel, zeitsparend und gut in den Alltag integrierbar. Für Einsteiger ist ein Start vor Ort oft hilfreich, danach kann Online eine starke Ergänzung sein.' }
      },
      {
        q: { de: 'Wie oft pro Woche sollte ich teilnehmen?' },
        a: { de: 'Für die meisten Personen sind 1 bis 2 Einheiten pro Woche ein realistischer und wirksamer Einstieg. Kontinuität wirkt stärker als Intensität. Bereits kurze, regelmässige Praxis verbessert oft Wohlbefinden, Beweglichkeit und mentale Ruhe.' }
      },
      {
        q: { de: 'Worauf sollte ich bei der Kursqualität achten?' },
        a: { de: 'Achte auf klare Kursziele, nachvollziehbare Level-Angaben, transparente Kommunikation und die Bereitschaft der Lehrperson, auf individuelle Grenzen einzugehen. Gute Kurse benennen ausserdem Kontraindikationen bei intensiveren Atem- oder Körperformaten.' }
      },
      {
        q: { de: 'Kann ich trotz Verspannungen oder geringer Beweglichkeit starten?' },
        a: { de: 'Ja, in der Regel schon. Wähle einsteigerfreundliche oder therapeutisch ausgerichtete Angebote und teile Beschwerden früh mit. Gute Lehrpersonen bieten Varianten an und setzen keinen Leistungsdruck.' }
      },
      {
        q: { de: 'Was brauche ich für den ersten Kurs?' },
        a: { de: 'Bequeme Kleidung, Wasser und Offenheit reichen oft aus. Vor Ort werden Matten teilweise gestellt, online brauchst du in der Regel selbst eine Matte und einen ruhigen Platz. Details stehen meist in der Kursbeschreibung.' }
      }
    ],

    sectionTitles: {
      scenarioTitle: { de: 'Welche Richtung passt zu dir?' },
      scenarioSubtitle: { de: 'Finde den passenden Einstieg für Entspannung, Schlaf, Fokus oder körperliche Praxis' },
      specialtiesTitle: { de: 'Kursbereiche' },
      specialtiesSubtitle: { de: 'Alle Schwerpunkte auf einen Blick' },
      searchesTitle: { de: 'Beliebte Suchen' },
      searchesSubtitle: { de: 'Schnelleinstieg zu gefragten Yoga- und Achtsamkeitsformaten' },
      faqTitle: { de: 'Häufige Fragen' },
      trustTitle: { de: 'Qualität & Orientierung' },
      ctaTitle: { de: 'Bereit für deine Praxis?' },
      ctaButton: { de: 'Alle Yoga-Kurse anzeigen' }
    },

    trustLogos: [
      { name: 'Klare Level-Angaben', description: { de: 'Einsteiger, Mittelstufe oder Fortgeschritten: verständliche Einstufung für bessere Kurswahl.' } },
      { name: 'Transparente Kursinfos', description: { de: 'Ziele, Ablauf, Intensität und Format sollten vor der Buchung klar beschrieben sein.' } },
      { name: 'Sicherer Einstieg', description: { de: 'Gute Kurse arbeiten mit Varianten, Rücksicht auf Grenzen und respektvoller Lernatmosphäre.' } },
    ]
  },
};

/** Config anhand URL-Slug finden */
export const getBereichBySlug = (segment, slug) => {
  return Object.values(BEREICH_LANDING_CONFIG).find(
    b => b.segment === segment && b.slug === slug
  );
};

/** Alle Bereiche eines Segments (fuer MegaMenu / Home) */
export const getBereicheForSegment = (segment) => {
  return Object.values(BEREICH_LANDING_CONFIG).filter(b => b.segment === segment);
};

/** Config anhand DB area slug finden */
export const getBereichByAreaSlug = (areaSlug) => {
  return BEREICH_LANDING_CONFIG[areaSlug] || null;
};

/** URL fuer eine Bereichs-Landingpage */
export const getBereichUrl = (config) => {
  return `/bereich/${config.segment}/${config.slug}`;
};

/** Szenario anhand Bereich-Config + Szenario-Slug finden */
export const findSzenario = (bereichConfig, szenarioSlug) => {
  if (!bereichConfig?.scenarios) return null;
  return bereichConfig.scenarios.find(s => s.slug === szenarioSlug) || null;
};


