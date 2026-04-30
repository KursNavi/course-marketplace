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
      { slug: 'quereinstieg', icon: '🔄', label: { de: 'Quereinstieg' }, text: { de: 'Du willst als Quereinsteiger in die Fitnessbranche einsteigen? Wir zeigen dir den Weg.' }, searchParams: { spec: 'Fitness-Trainer-Ausbildung' }, ctaLabel: { de: 'Quereinsteiger-Kurse entdecken' } },
      { slug: 'weiterbildung', icon: '📈', label: { de: 'Weiterbildung' }, text: { de: 'Schon Trainer? Spezialisiere dich in Functional Training, Ernährung oder Personal Training.' }, searchParams: { spec: 'Trainingsmethoden & Spezialisierungen' }, ctaLabel: { de: 'Weiterbildungskurse entdecken' } },
      { slug: 'diplom-aufstieg', icon: '🏆', label: { de: 'Diplom & Aufstieg' }, text: { de: 'Bereit für den nächsten Schritt? Diplom-Lehrgang und eidg. Fachausweis.' }, searchParams: { spec: 'Zertifikate & Prüfungsvorbereitung' }, ctaLabel: { de: 'Diplom-Kurse entdecken' } },
      { slug: 'nebenerwerb', icon: '⚡', label: { de: 'Nebenerwerb' }, text: { de: 'Deine Leidenschaft zum Beruf machen - auch nebenberuflich.' }, searchParams: { spec: 'Group-Fitness / Kursleitung' }, ctaLabel: { de: 'Kurse für den Nebenerwerb entdecken' } },
      { slug: 'selbststaendigkeit', icon: '🏢', label: { de: 'Selbstständigkeit' }, text: { de: 'Eigenes Studio? Lerne alles über Business, Recht und Versicherung.' }, searchParams: { spec: 'Business & Selbstständigkeit' }, ctaLabel: { de: 'Business-Kurse entdecken' } },
      { slug: 'spezialisierung', icon: '🎯', label: { de: 'Spezialisierung' }, text: { de: 'Rückentraining, Antara, Kampfsport - finde deine Nische.' }, searchParams: { spec: 'Trainingsmethoden & Spezialisierungen' }, ctaLabel: { de: 'Spezialisierungskurse entdecken' } },
      { slug: 'zertifizierung', icon: '✅', label: { de: 'Zertifizierung' }, text: { de: 'Qualitop, QualiCert, eidg. FA - welches Zertifikat passt zu dir?' }, searchParams: { spec: 'Zertifikate & Prüfungsvorbereitung' }, ctaLabel: { de: 'Zertifizierungskurse entdecken' } },
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
        de: 'Aerobic, Step, Toning, Cardio-Dance und moderne Kursformate unterrichten und Gruppendynamik meistern.',
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
      'Ernährung & Coaching': {
        de: 'Sporternährung, Ernährungsberatung und Coaching-Kompetenzen. CAS, Lehrgänge und Seminare.',
        icon: '🥗'
      },
      'Zertifikate & Prüfungsvorbereitung': {
        de: 'Vorbereitung auf eidg. Prüfungen, Fitness-Lizenzen und Branchenzertifikate.',
        icon: '📋'
      },
      'Business & Selbstständigkeit': {
        de: 'Unternehmer-Workshops für Selbstständigkeit, Recht, Versicherung, Datenschutz und Vertriebs-Know-how.',
        icon: '💼'
      }
    },

    regionalDiscovery: {
      title: { de: 'Sport- und Fitness-Angebote in deiner Region' },
      subtitle: { de: 'Entdecke Ausbildungen und Kurse im Bereich Sport und Fitness in deiner Nähe – von Zürich bis Basel oder online-live in der ganzen Schweiz.' },
      regions: [
        { label: 'Zürich', params: { loc: 'Zürich' }, anchorText: 'Sport- und Fitness-Ausbildungen in Zürich' },
        { label: 'Bern', params: { loc: 'Bern' }, anchorText: 'Sport- und Fitness-Ausbildungen in Bern' },
        { label: 'Basel', params: { loc: 'Basel-Stadt' }, anchorText: 'Sport- und Fitness-Ausbildungen in Basel' },
        { label: 'Luzern', params: { loc: 'Luzern' }, anchorText: 'Sport- und Fitness-Ausbildungen in Luzern' },
        { label: 'Aargau', params: { loc: 'Aargau' }, anchorText: 'Sport- und Fitness-Ausbildungen im Aargau' },
        { label: 'St. Gallen', params: { loc: 'St. Gallen' }, anchorText: 'Sport- und Fitness-Ausbildungen in St. Gallen' },
        { label: 'Ganze Schweiz', params: {}, anchorText: 'Alle Sport- und Fitness-Ausbildungen in der Schweiz' },
        { label: 'Online-live', params: { delivery: 'online_live' }, anchorText: 'Online-live Sport- und Fitness-Ausbildungen' },
      ],
    },

    predefinedSearches: [
      { label: { de: 'Fitnesstrainer Basiskurs' }, params: { spec: 'Fitness-Trainer-Ausbildung', focus: 'Basis-Ausbildung' } },
      { label: { de: 'Personal Trainer Lehrgang' }, params: { spec: 'Personal-Trainer-Ausbildung' } },
      { label: { de: 'Group-Fitness Kursformate' }, params: { spec: 'Group-Fitness / Kursleitung' } },
      { label: { de: 'Fitness Trainer Ausbildung Zürich' }, params: { spec: 'Fitness-Trainer-Ausbildung' }, extraParams: { loc: 'Zürich' } },
      { label: { de: 'Personal Trainer Ausbildung Bern' }, params: { spec: 'Personal-Trainer-Ausbildung' }, extraParams: { loc: 'Bern' } },
      { label: { de: 'Group Fitness Ausbildung Basel' }, params: { spec: 'Group-Fitness / Kursleitung' }, extraParams: { loc: 'Basel-Stadt' } },
      { label: { de: 'Sporternährung Kurs Zürich' }, params: { spec: 'Ernährung & Coaching' }, extraParams: { loc: 'Zürich' } },
      { label: { de: 'Yoga Ausbildung Luzern' }, params: { spec: 'Mind-Body (Yoga & Pilates)' }, extraParams: { loc: 'Luzern' } },
      { label: { de: 'Diplom & eidg. Prüfung' }, params: { spec: 'Zertifikate & Prüfungsvorbereitung' } },
      { label: { de: 'Online Fitness Ausbildung Schweiz' }, params: {}, extraParams: { delivery: 'online_live,self_study' } },
    ],

    editorialSections: [
      {
        heading: { de: 'Woran du einen passenden Lehrgang erkennst' },
        intro: { de: 'Nicht der werblichste Anbieter ist automatisch der beste. Für eine gute Entscheidung helfen vor allem diese sechs Fragen:' },
        items: { de: [
          'Welches Abschlussziel verfolge ich genau?',
          'Wie viel Praxis ist vorgesehen und wie realistisch ist der Praxiserwerb?',
          'Wie transparent sind Kosten, Zeitmodell und Voraussetzungen beschrieben?',
          'Ist der Lehrgang förderfähig oder klar an ein anerkanntes Prüfungsziel angebunden?',
          'Welche Qualitätssignale bringt der Anbieter mit?',
          'Passt das Format zu meinem Berufsalltag oder nur auf dem Papier?',
        ]},
        closing: { de: 'Ein gutes Angebot erklärt nicht nur Inhalte, sondern auch Weg, Aufwand und Grenzen.' },
      },
      {
        heading: { de: 'Qualität vergleichen statt nur Titel sammeln' },
        intro: { de: 'Bei Sport- und Fitnessausbildungen lohnt sich ein Blick auf mehrere Ebenen gleichzeitig:' },
        items: { de: [
          'Abschlusslogik: Führt der Lehrgang zu einer klar einordenbaren Qualifikation oder bleibt unklar, wie anschlussfähig sie später ist?',
          'Praxisbezug: Ist nachvollziehbar, wie du Trainingspraxis, Kundenkontakt oder branchentypische Erfahrung aufbaust?',
          'Anbietertransparenz: Sind Dozierende, Curriculum, Zeitmodell, Prüfungslogik und Kosten sauber beschrieben?',
          'Qualitätssignale: Gibt es erkennbare Standards oder Labels, die für Weiterbildung oder Gesundheitsförderung relevant sind?',
          'Anschluss: Hilft dir der Weg nur für den Einstieg oder auch für spätere Spezialisierung, Kaderrollen oder Selbstständigkeit?',
        ]},
        closing: { de: 'Gerade Labels wie eduQua, Qualitop oder QualiCert können hilfreiche Signale sein. Sie ersetzen aber nicht die Prüfung, ob ein konkreter Lehrgang zu deinem Ziel, deinem Einsatzbereich und deinem Alltag passt.' },
      },
      {
        heading: { de: 'Kosten realistisch einordnen' },
        intro: { de: 'Bei beruflicher Weiterbildung scheitert die Entscheidung oft nicht an der Motivation, sondern an einer zu knappen Rechnung. Prüfe deshalb nicht nur die Kursgebühr, sondern das Gesamtbild:' },
        items: { de: [
          'Kurskosten',
          'Prüfungsgebühren',
          'Lernmaterial und Pflichtunterlagen',
          'Reise- und Unterkunftskosten',
          'mögliche Ausfallzeiten oder reduzierte Erwerbszeit',
          'Reserve für Verschiebungen oder Zusatzmodule',
        ]},
        closing: { de: 'Bei vorbereitenden Kursen auf eidgenössische Prüfungen kann der Bund unter bestimmten Voraussetzungen einen Teil der Kurskosten mitfinanzieren. Entscheidend ist aber, dass der Kurs auf der Meldeliste steht und dass du zwischen förderfähigen Kurskosten und nicht gedeckten Nebenkosten sauber unterscheidest.' },
      },
      {
        heading: { de: 'Vereinbarkeit ehrlich prüfen' },
        intro: { de: 'Ein Lehrgang kann fachlich stark und trotzdem für deine aktuelle Lebenssituation unpassend sein. Achte deshalb auf:' },
        items: { de: [
          'Wochenend- oder Abendmodell',
          'Blocktage und Verdichtung vor Prüfungen',
          'Praxisstunden oder Praxiseinsätze',
          'Lernzeit zwischen den Modulen',
          'Pendelaufwand',
          'Vereinbarkeit mit Hauptjob, Familie und Erholung',
        ]},
        closing: { de: 'Besonders bei Quereinstieg oder Nebenerwerb ist die Frage nicht nur, ob du es «schaffst», sondern ob du es über Monate stabil tragen kannst.' },
      },
      {
        heading: { de: 'Förderung und Finanzierung sauber unterscheiden' },
        intro: { de: 'Förderung entlastet, ersetzt aber keine Vollkostenrechnung. Für vorbereitende Kurse auf eidgenössische Prüfungen ist die Meldeliste zentral. Daneben können je nach Situation Arbeitgeberbeiträge, Ratenzahlungen oder andere Finanzierungswege helfen. Gute Anbieter sprechen diese Punkte klar an, statt nur mit dem maximal möglichen Bundesbeitrag zu werben.' },
      },
      {
        heading: { de: 'So entscheidest du realistischer' },
        intro: { de: 'Wenn du mehrere Wege vergleichst, hilft diese Reihenfolge:' },
        items: { de: [
          'Berufsbild und Ziel festlegen',
          'nur Lehrgänge vergleichen, die fachlich wirklich zum Ziel passen',
          'Praxis- und Abschlusslogik prüfen',
          'Vollkosten und Alltagstauglichkeit gegenrechnen',
          'erst dann Qualitätssignale, Tempo und Zusatznutzen vergleichen',
        ]},
        isOrdered: true,
        closing: { de: 'So vermeidest du typische Fehlentscheidungen: zu teure Wege ohne Anschluss, schöne Titel ohne Praxiswert oder Ausbildungen, die sich im Alltag nicht durchhalten lassen.' },
      },
    ],

    faqs: [
      {
        q: { de: 'Brauche ich eine Grundausbildung vor der Spezialisierung?' },
        a: { de: 'In der Regel ja. Die meisten Anbieter empfehlen die Fitness-Trainer Basis-Ausbildung (B-Lizenz) als Einstieg. Darauf aufbauend kannst du dich in Bereichen wie Personal Training, Group Fitness oder Ernährung spezialisieren.' }
      },
      {
        q: { de: 'Kann ich als Quereinsteiger direkt in die Fitnessbranche einsteigen?' },
        a: { de: 'Absolut. Viele Basis-Ausbildungen setzen keine Vorkenntnisse voraus - nur Freude an Bewegung und Gesundheit. Die B-Lizenz ist ideal für den Einstieg, unabhängig von deinem bisherigen Beruf.' }
      },
      {
        q: { de: 'Welche Qualitätssiegel sind relevant?' },
        a: { de: 'In der Schweiz signalisieren verschiedene Labels unterschiedliche Dinge: Qualitop steht für Qualität in Bewegungs- und Gesundheitsförderung, vor allem bei Fitnesscentern und Anbietern. QualiCert ist als Anerkennung für Kursanbieter und Kursleitung relevant – wobei die Zertifizierung der Kursleitung allein nicht automatisch für Krankenkassenbeiträge ausreicht; auch die Anbieterzertifizierung zählt. eduQua ist ein schweizerisches Qualitätslabel für Weiterbildungsanbieter generell. Ein Label allein beantwortet aber nicht, ob ein konkreter Lehrgang zu deinem Ziel und deinem Alltag passt.' }
      },
      {
        q: { de: 'Wie läuft die eidg. Prüfungsvorbereitung ab?' },
        a: { de: 'Die Vorbereitung auf den eidgenössischen Fachausweis umfasst mehrere Module und dauert in der Regel 1 bis 2 Jahre berufsbegleitend. Für die Bundesbeiträge (SBFI) ist entscheidend, dass der Kurs auf der Meldeliste steht. Für die Berufsprüfung sind maximal CHF 9\'500 anrechenbar (auf maximal CHF 19\'000 anrechenbare Kursgebühren), für die höhere Fachprüfung maximal CHF 10\'500 (auf maximal CHF 21\'000 anrechenbare Kursgebühren). Nebenkosten wie Prüfungsgebühren, Unterlagen oder Reisekosten sind in der Regel nicht anrechenbar.' }
      },
      {
        q: { de: 'Welche Ausbildung passt als Nebenerwerb?' },
        a: { de: 'Group-Fitness-Instruktor oder Yoga/Pilates-Lehrer eignen sich besonders gut als Nebenerwerb. Die Ausbildungen sind kompakt und du kannst flexibel Kurse an Abenden oder Wochenenden geben.' }
      },
      {
        q: { de: 'Woran erkenne ich, ob ein Lehrgang wirklich zu mir passt?' },
        a: { de: 'Nicht der werblichste Anbieter ist automatisch der beste. Prüfe konkret: Welches Abschlussziel verfolge ich? Wie viel Praxis ist vorgesehen und wie realistisch ist der Praxiserwerb? Sind Kosten, Zeitmodell und Voraussetzungen transparent beschrieben? Ist der Lehrgang förderfähig oder klar an ein anerkanntes Prüfungsziel angebunden? Passt das Format wirklich zu meinem Berufsalltag – nicht nur auf dem Papier? Ein gutes Angebot erklärt nicht nur Inhalte, sondern auch Weg, Aufwand und Grenzen.' }
      },
      {
        q: { de: 'Was gehört alles zur realistischen Kostenkalkulation bei einer Ausbildung?' },
        a: { de: 'Die Kursgebühr ist nur ein Teil der Gesamtkosten. Rechne auch Prüfungsgebühren, Lernmaterial, Reise- und Unterkunftskosten bei Blocktagen, mögliche Ausfallzeiten oder reduziertes Erwerbseinkommen sowie eine Reserve für Verschiebungen oder Zusatzmodule mit ein. Bei vorbereitenden Kursen auf eidgenössische Prüfungen kann der Bund unter bestimmten Voraussetzungen einen Teil der anrechenbaren Kurskosten mitfinanzieren. Entscheidend ist, zwischen förderfähigen Kurskosten und nicht gedeckten Nebenkosten sauber zu unterscheiden.' }
      },
    ],

    sectionTitles: {
      scenarioTitle: { de: 'Wo stehst du?' },
      scenarioSubtitle: { de: 'Finde den passenden Einstieg - egal ob Anfänger oder Profi' },
      specialtiesTitle: { de: 'Ausbildungsbereiche' },
      specialtiesSubtitle: { de: 'Alle Schwerpunkte auf einen Blick' },
      searchesSubtitle: { de: 'Schnelleinstieg zu den gefragtesten Ausbildungen' },
      trustTitle: { de: 'Qualitätssiegel in der Schweizer Fitnessbranche' },
      ctaTitle: { de: 'Bereit für den nächsten Schritt?' },
      ctaButton: { de: 'Alle Kurse anzeigen' }
    },

    ctaLinks: [
      { label: { de: 'In Zürich entdecken' }, params: { loc: 'Zürich' } },
      { label: { de: 'In Bern entdecken' }, params: { loc: 'Bern' } },
      { label: { de: 'Online-live entdecken' }, params: { delivery: 'online_live' } },
    ],

    trustLogos: [
      { name: 'Qualitop', description: { de: 'Qualitop ist ein Schweizer Qualitätslabel für Fitnesscenter und Gesundheitsanbieter im Bereich Bewegungs- und Gesundheitsförderung. Anbieter mit diesem Label werden von einer unabhängigen Stelle geprüft. Das Zertifikat ist bei mehreren Krankenkassen als Qualitätsmerkmal für Zusatzversicherungsleistungen anerkannt.' } },
      { name: 'QualiCert', description: { de: 'QualiCert ist eine unabhängige Schweizer Zertifizierungsstelle für Angebote im Bereich Bewegung, Sport und Gesundheitsförderung. Sie zertifiziert sowohl Anbieter als auch einzelne Kursleiter. Wichtig: Die Zertifizierung der Kursleitung allein reicht nicht automatisch für Krankenkassenbeiträge – auch die Anbieterzertifizierung ist entscheidend.' } },
      { name: 'Fitness-Guide (SFGV)', description: { de: 'Der Fitness-Guide des SFGV beschreibt ein anerkanntes Ausbildungsrahmenwerk für die Schweizer Fitnessbranche. Er definiert Ausbildungsstufen und Kompetenzprofile und hilft dabei, Kursangebote einzuordnen.' } },
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
      { slug: 'atemarbeit-breathwork', icon: '🫁', label: { de: 'Atemarbeit & Breathwork' }, text: { de: 'Pranayama, Breathwork (moderne Atemmethoden) und Atemreise: Unterschiede verstehen und sicher das passende Format wählen.' }, searchParams: { spec: 'Atemarbeit' }, ctaLabel: { de: 'Atemarbeit-Kurse anzeigen' } },
      { slug: 'klangmeditation-mantra', icon: '🔔', label: { de: 'Klangmeditation & Mantra' }, text: { de: 'Sound Bath, Gong, Kirtan und Klangreise: achtsame Formate für Ruhe, Fokus und Ausrichtung.' }, searchParams: { spec: 'Klang & Mantra' }, ctaLabel: { de: 'Klang-Kurse anzeigen' } },
      { slug: 'energiearbeit-reiki', icon: '✨', label: { de: 'Energiearbeit & Reiki' }, text: { de: 'Einordnen statt idealisieren: was dich in Reiki- und Energiearbeit-Kursen konkret erwartet.' }, searchParams: { spec: 'Energiearbeit' }, ctaLabel: { de: 'Reiki-Kurse anzeigen' } },
      { slug: 'bodywork-thai-yoga-massage', icon: '🤲', label: { de: 'Bodywork & Thai Yoga Massage' }, text: { de: 'Bodywork, also körperorientierte Methoden, unterstützt Beweglichkeit, Entspannung und bewusste Berührung.' }, searchParams: { spec: 'Bodywork & Massage' }, ctaLabel: { de: 'Bodywork-Kurse anzeigen' } },
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
        de: 'Pranayama, Breathwork und Atemreise: Atem als Werkzeug für Fokus, Regulation und Energie. Breathwork ist dabei ein Sammelbegriff für moderne Atemmethoden.',
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
        de: 'Thai Yoga Massage, Massage und weitere Bodywork-Methoden als Ergänzung zu Yoga und achtsamem Training.',
        icon: '🤲'
      }
    },

    regionalDiscovery: {
      title: { de: 'Yoga- und Achtsamkeitskurse in deiner Region' },
      subtitle: { de: 'Finde Yoga- und Achtsamkeitskurse in deiner Region oder entdecke online-live Angebote für die ganze Schweiz.' },
      regions: [
        { label: 'Zürich', params: { loc: 'Zürich' }, anchorText: 'Yoga- und Achtsamkeitskurse in Zürich' },
        { label: 'Bern', params: { loc: 'Bern' }, anchorText: 'Yoga- und Achtsamkeitskurse in Bern' },
        { label: 'Basel', params: { loc: 'Basel-Stadt' }, anchorText: 'Yoga- und Achtsamkeitskurse in Basel' },
        { label: 'Luzern', params: { loc: 'Luzern' }, anchorText: 'Yoga- und Achtsamkeitskurse in Luzern' },
        { label: 'Aargau', params: { loc: 'Aargau' }, anchorText: 'Yoga- und Achtsamkeitskurse im Aargau' },
        { label: 'St. Gallen', params: { loc: 'St. Gallen' }, anchorText: 'Yoga- und Achtsamkeitskurse in St. Gallen' },
        { label: 'Ganze Schweiz', params: {}, anchorText: 'Alle Yoga- und Achtsamkeitskurse in der Schweiz' },
        { label: 'Online-live', params: { delivery: 'online_live' }, anchorText: 'Online-live Yoga- und Achtsamkeitskurse in der Schweiz' },
      ],
    },

    predefinedSearches: [
      { label: { de: 'Yoga für Anfänger (Hatha)' }, params: { spec: 'Yoga', focus: 'Hatha & Grundlagen' } },
      { label: { de: 'Vinyasa & Flow' }, params: { spec: 'Yoga', focus: 'Vinyasa & Flow' } },
      { label: { de: 'Yin & Restorative' }, params: { spec: 'Yoga', focus: 'Yin & Restorative' } },
      { label: { de: 'Yogakurs Zürich' }, params: { spec: 'Yoga' }, extraParams: { loc: 'Zürich' } },
      { label: { de: 'Yoga Kurs Bern' }, params: { spec: 'Yoga' }, extraParams: { loc: 'Bern' } },
      { label: { de: 'Meditationskurs Basel' }, params: { spec: 'Meditation & Achtsamkeit' }, extraParams: { loc: 'Basel-Stadt' } },
      { label: { de: 'Achtsamkeitskurs Luzern' }, params: { spec: 'Meditation & Achtsamkeit' }, extraParams: { loc: 'Luzern' } },
      { label: { de: 'Yin Yoga Zürich' }, params: { spec: 'Yoga', focus: 'Yin & Restorative' }, extraParams: { loc: 'Zürich' } },
      { label: { de: 'Pranayama & Breathwork' }, params: { spec: 'Atemarbeit' } },
      { label: { de: 'Online-live Yoga Schweiz' }, params: { spec: 'Yoga' }, extraParams: { delivery: 'online_live' } },
    ],

    editorialSections: [
      {
        heading: { de: 'Womit du am besten startest' },
        intro: { de: 'Wenn du neu einsteigst, ist nicht die fortgeschrittenste Klasse die beste Wahl, sondern die klarste. Ein guter Start ist für viele Menschen ein Format, das:' },
        items: { de: [
          'das Level klar ausweist',
          'genug Erklärung statt nur Tempo bietet',
          'Varianten für unterschiedliche Körper mitdenkt',
          'zum eigenen Wochenrhythmus passt',
          'ohne Druck ausprobiert werden kann',
        ]},
        closing: { de: 'Wenn du vor allem Entspannung suchst, sind ruhige Formate wie Yin, Restorative, Yoga Nidra oder sanfte Meditation oft sinnvoller als dynamische Flows. Wenn du über Bewegung in die Praxis finden willst, sind Hatha oder ein sanftes Vinyasa meist besser als sehr intensive Klassen.' },
      },
      {
        heading: { de: 'Was ein realistischer Einstieg kostet' },
        intro: { de: 'Die Einstiegshürde liegt oft weniger bei der Beweglichkeit als bei der Unsicherheit rund um Aufwand und Kosten. Für den Start helfen einfache Fragen:' },
        items: { de: [
          'Gibt es eine Probelektion oder einen unkomplizierten Einzeleinstieg?',
          'Buchst du einen laufenden Kurs, einen Workshop oder ein Abo?',
          'Fallen Zusatzkosten für Material, Studio oder Onlineplattform an?',
          'Passt die Kursfrequenz zu deinem Alltag, oder kaufst du mehr Verbindlichkeit als du realistisch halten kannst?',
        ]},
        closing: { de: 'Gerade am Anfang ist ein kleiner, klarer Einstieg meist sinnvoller als ein grosses Paket. Wer zuerst 4 bis 8 Wochen sauber testet, merkt schneller, ob Stil, Lehrperson und Rhythmus wirklich passen.' },
      },
      {
        heading: { de: 'Welches Format senkt die Einstiegshürde?' },
        intro: { de: 'Nicht nur der Stil, auch das Format entscheidet über die Passung:' },
        items: { de: [
          'Vor Ort: gut, wenn du direktes Feedback, klare Anleitung und Verbindlichkeit brauchst',
          'Online live: gut, wenn du flexible Wege brauchst, aber trotzdem eine feste Kurszeit möchtest',
          'Aufzeichnung: gut als Ergänzung, aber für den allerersten Einstieg oft schwieriger, weil Korrektur und Rückfragen fehlen',
          'Workshop: gut zum Kennenlernen eines Themas, aber nicht immer ideal für eine nachhaltige Routine',
          'Laufender Kurs: oft besser, wenn du Schritt für Schritt dranbleiben willst',
        ]},
        closing: { de: 'Wenn du dich leicht überforderst oder schnell abbrichst, ist ein ruhiger laufender Kurs mit klarer Einstufung oft die stabilere Wahl als ein intensives Einzelerlebnis.' },
      },
      {
        heading: { de: 'Vertrauenscheck: Woran du seriöse Angebote erkennst' },
        intro: { de: 'Gerade bei sensibleren Formaten wie Breathwork, Reiki oder Bodywork sollte die Beschreibung nicht nur schön klingen, sondern konkret sein. Gute Angebote zeigen:' },
        items: { de: [
          'was im Kurs tatsächlich gemacht wird',
          'wie intensiv das Format ist',
          'für wen es gut passt und für wen eher nicht',
          'ob Berührung vorkommt und wie Einverständnis geregelt ist',
          'ob du jederzeit pausieren oder aussetzen kannst',
          'wer den Kurs leitet und wie die Person ausgebildet ist',
        ]},
        closing: { de: 'Ein Stilname allein reicht nicht als Vertrauenssignal. Wichtiger sind nachvollziehbare Beschreibung, respektvolle Kommunikation und ein Rahmen ohne Druck.' },
      },
      {
        heading: { de: 'Besondere Vorsicht bei sensiblen Formaten' },
        intro: { de: 'Ruhige Atemarbeit, Meditation oder sanfte Körperarbeit können für viele Menschen ein guter Zugang sein. Bei intensiveren Settings lohnt aber eine genauere Prüfung. Das gilt besonders dann, wenn:' },
        items: { de: [
          'sehr starke Erfahrungen versprochen werden',
          'Grenzen oder Kontraindikationen gar nicht erwähnt werden',
          'unklar bleibt, wer das Format anleitet',
          'Heilsversprechen oder absolute Wirkungsbehauptungen gemacht werden',
        ]},
        closing: { de: 'Bei Breathwork, Reiki und Bodywork ist eine neutrale Einordnung wichtig: Diese Formate können als achtsame oder komplementäre Praxis interessant sein, sollten aber transparent beschrieben und nicht als Ersatz für medizinische oder psychotherapeutische Versorgung dargestellt werden.' },
      },
      {
        heading: { de: 'So wählst du ohne dich zu verzetteln' },
        intro: { de: 'Für die ersten Wochen reicht meist eine einfache Entscheidung:' },
        items: { de: [
          'Ziel für 4 bis 8 Wochen festlegen',
          'maximal zwei passende Formate prüfen',
          'lieber konstant als zu ambitioniert starten',
          'nach jeder Einheit auf Körpergefühl, Schlaf, Energie und Motivation achten',
        ]},
        isOrdered: true,
        closing: { de: 'Wenn du danach klarer siehst, kannst du gezielt vertiefen, einen Stil ergänzen oder ein sensibleres Spezialformat bewusst ausprobieren.' },
      },
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
        q: { de: 'Online oder vor Ort - was ist besser?' },
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
      },
      {
        q: { de: 'Was kostet ein realistischer Einstieg in Yoga oder Achtsamkeit?' },
        a: { de: 'Die Einstiegshürde liegt oft weniger bei der Beweglichkeit als bei der Unsicherheit rund um Aufwand und Kosten. Klär vor der Buchung: Gibt es eine Probelektion oder einen unkomplizierten Einzeleintritt? Buchst du einen laufenden Kurs, einen Workshop oder ein Abo? Fallen Zusatzkosten für Material oder eine Onlineplattform an? Gerade am Anfang ist ein kleiner, klarer Einstieg meist sinnvoller als ein grosses Paket. Wer zuerst 4 bis 8 Wochen sauber testet, merkt schneller, ob Stil, Lehrperson und Rhythmus wirklich passen.' }
      },
      {
        q: { de: 'Welches Format passt für den Einstieg – Vor Ort, Online oder Workshop?' },
        a: { de: 'Das Format bestimmt, wie gut Yoga in deinen Alltag passt. Vor Ort ist gut, wenn du direktes Feedback und Verbindlichkeit brauchst. Online live ist flexibel und eignet sich gut, wenn du feste Kurszeiten ohne Anfahrt bevorzugst. Aufzeichnungen eignen sich als Ergänzung, aber für den allerersten Einstieg weniger, weil Korrektur und Rückfragen fehlen. Workshops helfen zum Kennenlernen, bauen aber keine nachhaltige Routine auf. Laufende Kurse sind oft besser, wenn du Schritt für Schritt dranbleiben willst. Wenn du dich leicht überforderst oder schnell abbrichst, ist ein ruhiger laufender Kurs mit klarer Einstufung oft die stabilere Wahl.' }
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
      trustTitle: { de: 'Worauf du bei der Kurswahl achten solltest' },
      ctaTitle: { de: 'Bereit für deine Praxis?' },
      ctaButton: { de: 'Alle Yoga-Kurse anzeigen' }
    },

    ctaLinks: [
      { label: { de: 'Kurse in Zürich' }, params: { loc: 'Zürich' } },
      { label: { de: 'Kurse in Basel' }, params: { loc: 'Basel-Stadt' } },
      { label: { de: 'Online-live entdecken' }, params: { delivery: 'online_live' } },
    ],

    trustLogos: [
      { name: 'Level-Angaben prüfen', description: { de: 'Achte auf klare Einstufungen wie „Einsteiger", „All Levels" oder „Mittelstufe". Ein guter Einstieg bietet ausreichend Erklärung statt nur Tempo, Varianten für unterschiedliche Körper und die Möglichkeit, ohne Druck auszuprobieren. Das Level ist das erste, wichtigste Qualitätssignal.' } },
      { name: 'Kursinfos vor der Buchung lesen', description: { de: 'Gute Angebote zeigen klar, was im Kurs tatsächlich gemacht wird, wie intensiv das Format ist und für wen es passt – und für wen eher nicht. Bei sensibleren Formaten wie Breathwork, Reiki oder Bodywork sollte ausserdem beschrieben sein, ob Berührung vorkommt und wie Einverständnis geregelt ist. Fehlen diese Infos, lohnt eine Nachfrage.' } },
      { name: 'Auf individuelle Anpassung achten', description: { de: 'Gute Lehrpersonen bieten Varianten an und gehen auf persönliche Grenzen ein. Bei intensiveren Formaten ist es ein Warnsignal, wenn Kontraindikationen nicht erwähnt werden, Grenzen nicht respektiert werden oder mit absoluten Heilsversprechen gearbeitet wird.' } },
    ]
  },
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


