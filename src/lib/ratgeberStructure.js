/**
 * Ratgeber Content Structure
 *
 * Struktur basierend auf der KursNavi Content-Strategie:
 * - 3 Hauptkategorien (Beruflich, Privat & Hobby, Kinder)
 * - 4 Themen-Cluster pro Kategorie
 * - 6 Artikel pro Cluster
 * = 72 Artikel insgesamt
 */

import { Briefcase, Palette, Smile, Wallet, TrendingUp, Cpu, GraduationCap, Lightbulb, ShieldCheck, Heart, PiggyBank, Calendar, Shield, Target, HandCoins, Clock } from 'lucide-react';

export const RATGEBER_STRUCTURE = {
  beruflich: {
    slug: 'beruflich',
    label: {
      de: 'Beruflich',
      en: 'Professional',
      fr: 'Professionnel',
      it: 'Professionale'
    },
    icon: Briefcase,
    color: 'blue',
    bgLight: 'bg-blue-50',
    bgSolid: 'bg-blue-500',
    text: 'text-blue-600',
    border: 'border-blue-500',
    clusters: {
      finanzierung: {
        slug: 'finanzierung',
        label: {
          de: 'Finanzierung & Förderung',
          en: 'Financing & Funding',
          fr: 'Financement & Subventions',
          it: 'Finanziamento & Sovvenzioni'
        },
        description: {
          de: 'Alles rund um Kosten, Förderungen und Finanzierungsmöglichkeiten für deine Weiterbildung.',
          en: 'Everything about costs, subsidies and financing options for your professional development.',
          fr: 'Tout sur les coûts, subventions et options de financement pour votre formation.',
          it: 'Tutto su costi, sovvenzioni e opzioni di finanziamento per la tua formazione.'
        },
        icon: Wallet,
        articles: [
          {
            slug: 'vollkostenrechnung-weiterbildung',
            title: { de: 'Vollkostenrechnung Weiterbildung: So planst Du Dein Budget', en: 'Full Cost Calculation: How to Plan Your Budget' },
            teaser: { de: 'Eine Anleitung zur Erfassung aller Kostenfaktoren einschliesslich Material, Reisekosten und potenziellen Verdienstausfällen.', en: 'A guide to capturing all cost factors including materials, travel and potential loss of income.' },
            content: null // Wird später befüllt
          },
          {
            slug: 'bundesbeitraege-50-prozent',
            title: { de: 'Bundesbeiträge für eidgenössische Prüfungen: Die 50%-Regel', en: 'Federal Contributions for Swiss Exams: The 50% Rule' },
            teaser: { de: 'Detaillierter Leitfaden zur Subjektfinanzierung durch den Bund (Erstattung von bis zu CHF 9\'500 für Fachausweise).', en: 'Detailed guide to federal subject financing (reimbursement up to CHF 9,500 for professional certificates).' },
            content: null
          },
          {
            slug: 'kantonale-stipendien-vergleich',
            title: { de: 'Kantonale Stipendien im Vergleich: ZH, BE, BS', en: 'Cantonal Scholarships Compared: ZH, BE, BS' },
            teaser: { de: 'Analyse der regionalen Unterschiede bei Bildungsbeiträgen für Erwachsene ab 45 Jahren.', en: 'Analysis of regional differences in education grants for adults over 45.' },
            content: null
          },
          {
            slug: 'weiterbildungsvereinbarungen',
            title: { de: 'Weiterbildungsvereinbarungen: Was im Vertrag mit dem Chef stehen muss', en: 'Training Agreements: What Must Be in Your Contract' },
            teaser: { de: 'Rechtliche Beratung zu Rückzahlungsklauseln und Bindungsfristen.', en: 'Legal advice on repayment clauses and commitment periods.' },
            content: null
          },
          {
            slug: 'steuer-hack-weiterbildung',
            title: { de: 'Steuer-Hack Weiterbildung: Maximale Abzüge in der Steuererklärung', en: 'Tax Hack: Maximum Deductions for Training' },
            teaser: { de: 'Interaktive Tabelle über kantonale Maximalabzüge (z. B. Basel-Stadt bis CHF 19\'100).', en: 'Interactive table of cantonal maximum deductions (e.g. Basel-Stadt up to CHF 19,100).' },
            content: null
          },
          {
            slug: 'alternative-finanzierungswege',
            title: { de: 'Alternative Finanzierungswege: EDUCA SWISS & Stiftungen', en: 'Alternative Financing: EDUCA SWISS & Foundations' },
            teaser: { de: 'Vorstellung von zinslosen Darlehen und privaten Bildungsfonds.', en: 'Introduction to interest-free loans and private education funds.' },
            content: null
          }
        ]
      },
      karriere: {
        slug: 'karriere',
        label: {
          de: 'Karriere-Strategie & Sichtbarkeit',
          en: 'Career Strategy & Visibility',
          fr: 'Stratégie de Carrière',
          it: 'Strategia di Carriera'
        },
        description: {
          de: 'Positionierung im Arbeitsmarkt und Verwertung des erworbenen Wissens.',
          en: 'Positioning in the job market and leveraging acquired knowledge.',
          fr: 'Positionnement sur le marché du travail et valorisation des connaissances acquises.',
          it: 'Posizionamento nel mercato del lavoro e valorizzazione delle conoscenze acquisite.'
        },
        icon: TrendingUp,
        articles: [
          {
            slug: 'berufliche-standortbestimmung',
            title: { de: 'Berufliche Standortbestimmung: Methoden zur Selbstanalyse', en: 'Career Assessment: Self-Analysis Methods' },
            teaser: { de: 'Nutzung von Programmen wie "viamia" zur Klärung der eigenen Marktfähigkeit.', en: 'Using programs like "viamia" to assess your marketability.' },
            content: null
          },
          {
            slug: 'spezialisierung-vs-generalisierung',
            title: { de: 'Spezialisierung vs. Generalisierung: Welche Strategie passt zu Dir?', en: 'Specialization vs. Generalization: Which Strategy Suits You?' },
            teaser: { de: 'Abwägung zwischen Expertenstatus und breiter Einsetzbarkeit im Kontext der Digitalisierung.', en: 'Balancing expert status and broad applicability in the context of digitalization.' },
            content: null
          },
          {
            slug: 'linkedin-optimierung',
            title: { de: 'LinkedIn-Optimierung: Weiterbildung ohne Buzzwords präsentieren', en: 'LinkedIn Optimization: Present Training Without Buzzwords' },
            teaser: { de: 'Strategien zur Erhöhung der Sichtbarkeit für Recruiter.', en: 'Strategies to increase visibility for recruiters.' },
            content: null
          },
          {
            slug: 'gehaltsverhandlung-nach-kurs',
            title: { de: 'Gehaltsverhandlung nach dem Kurs: So argumentierst Du richtig', en: 'Salary Negotiation After Training: How to Argue Correctly' },
            teaser: { de: 'Argumentationslogik für Lohnanpassungen basierend auf dem Kompetenzzuwachs.', en: 'Argumentation logic for salary adjustments based on skill gains.' },
            content: null
          },
          {
            slug: 'quereinstieg-40-plus',
            title: { de: 'Quereinstieg mit 40+: Strategien für die Neuerfindung', en: 'Career Change at 40+: Reinvention Strategies' },
            teaser: { de: 'Motivations-Guide für Fachkräfte in verschwindenden Branchen.', en: 'Motivation guide for professionals in declining industries.' },
            content: null
          },
          {
            slug: 'soft-skills-karriere-turbo',
            title: { de: 'Soft Skills als Karriere-Turbo: Kommunikation und Resilienz', en: 'Soft Skills as Career Booster: Communication and Resilience' },
            teaser: { de: 'Warum emotionale Intelligenz im KI-Zeitalter zur Hard Skill wird.', en: 'Why emotional intelligence becomes a hard skill in the AI age.' },
            content: null
          }
        ]
      },
      'future-skills': {
        slug: 'future-skills',
        label: {
          de: 'Skills der Zukunft & KI',
          en: 'Future Skills & AI',
          fr: 'Compétences du Futur & IA',
          it: 'Competenze del Futuro & IA'
        },
        description: {
          de: 'Technologische Disruption verstehen und die richtigen Kompetenzen für morgen aufbauen.',
          en: 'Understanding technological disruption and building the right skills for tomorrow.',
          fr: 'Comprendre la disruption technologique et développer les bonnes compétences pour demain.',
          it: 'Comprendere la disruption tecnologica e sviluppare le giuste competenze per domani.'
        },
        icon: Cpu,
        articles: [
          {
            slug: 'ai-literacy-arbeitsplatz',
            title: { de: 'AI Literacy am Arbeitsplatz: Welche Tools Du beherrschen musst', en: 'AI Literacy at Work: Tools You Must Master' },
            teaser: { de: 'Einführung in Prompt Engineering und KI-gestützte Workflows.', en: 'Introduction to prompt engineering and AI-powered workflows.' },
            content: null
          },
          {
            slug: 'green-skills',
            title: { de: 'Green Skills: Weiterbildung für die nachhaltige Wirtschaft', en: 'Green Skills: Training for the Sustainable Economy' },
            teaser: { de: 'Der wachsende Bedarf an Fachkräften für die ökologische Transformation.', en: 'The growing demand for professionals in ecological transformation.' },
            content: null
          },
          {
            slug: 'new-work-hybride-fuehrung',
            title: { de: 'New Work & Hybride Führung: Kompetenzen für moderne Leader', en: 'New Work & Hybrid Leadership: Skills for Modern Leaders' },
            teaser: { de: 'Anforderungen an die Zusammenarbeit in agilen und dezentralen Teams.', en: 'Requirements for collaboration in agile and decentralized teams.' },
            content: null
          },
          {
            slug: 'micro-credentials',
            title: { de: 'Micro-Credentials: Wie kleine Zertifikate Deinen CV aufwerten', en: 'Micro-Credentials: How Small Certificates Enhance Your CV' },
            teaser: { de: 'Der Trend zu fokussierten Lerneinheiten statt langjährigen Studiengängen.', en: 'The trend toward focused learning units instead of long-term programs.' },
            content: null
          },
          {
            slug: 'digital-literacy-generationen',
            title: { de: 'Digital Literacy für alle Generationen: Anschluss finden', en: 'Digital Literacy for All Generations: Finding Connection' },
            teaser: { de: 'Überwindung der digitalen Kluft im Berufsalltag.', en: 'Bridging the digital divide in professional life.' },
            content: null
          },
          {
            slug: 'adaptive-skills',
            title: { de: 'Adaptive Skills: Warum Anpassungsfähigkeit die wichtigste Kompetenz 2026 ist', en: 'Adaptive Skills: Why Adaptability Is the Most Important Skill in 2026' },
            teaser: { de: 'Strategien zur kontinuierlichen Selbstentwicklung.', en: 'Strategies for continuous self-development.' },
            content: null
          }
        ]
      },
      bildungssystem: {
        slug: 'bildungssystem',
        label: {
          de: 'Bildungssystem Schweiz verstehen',
          en: 'Understanding the Swiss Education System',
          fr: 'Comprendre le Système Éducatif Suisse',
          it: 'Capire il Sistema Educativo Svizzero'
        },
        description: {
          de: 'Transparenz über Abschlüsse und das Schweizer Bildungssystem.',
          en: 'Transparency about degrees and the Swiss education system.',
          fr: 'Transparence sur les diplômes et le système éducatif suisse.',
          it: 'Trasparenza sui diplomi e sul sistema educativo svizzero.'
        },
        icon: GraduationCap,
        articles: [
          {
            slug: 'schweizer-bildungssystem-ueberblick',
            title: { de: 'Das Schweizer Bildungssystem auf einen Blick', en: 'The Swiss Education System at a Glance' },
            teaser: { de: 'Visuelle Aufbereitung der Durchlässigkeit von der Lehre bis zum Professional Master.', en: 'Visual overview of pathways from apprenticeship to Professional Master.' },
            content: null
          },
          {
            slug: 'hoehere-berufsbildung-vs-hochschule',
            title: { de: 'Höhere Berufsbildung vs. Hochschule: Ein fairer Vergleich', en: 'Higher Vocational Education vs. University: A Fair Comparison' },
            teaser: { de: 'Praxisnähe (HF/BP) gegen Theorieorientierung (Uni/ETH).', en: 'Practical orientation (HF/BP) vs. theoretical focus (Uni/ETH).' },
            content: null
          },
          {
            slug: 'professional-bachelor-master',
            title: { de: 'Professional Bachelor & Master: Die Aufwertung der Berufsbildung', en: 'Professional Bachelor & Master: Upgrading Vocational Training' },
            teaser: { de: 'Erklärung der neuen Titel und ihrer internationalen Vergleichbarkeit.', en: 'Explanation of new titles and their international comparability.' },
            content: null
          },
          {
            slug: 'qualitaetslabels-eduqua',
            title: { de: 'Qualitätslabels erkennen: Was eduQua wirklich aussagt', en: 'Recognizing Quality Labels: What eduQua Really Means' },
            teaser: { de: 'Orientierungshilfe zur Beurteilung der Seriosität von Bildungsanbietern.', en: 'Guidance for assessing the credibility of education providers.' },
            content: null
          },
          {
            slug: 'ects-punkte-cas-das-mas',
            title: { de: 'ECTS-Punkte in der Weiterbildung: CAS, DAS und MAS erklärt', en: 'ECTS Credits in Continuing Education: CAS, DAS and MAS Explained' },
            teaser: { de: 'Aufklärung über das Kreditpunkte-System in Nachdiplomstudien.', en: 'Clarification of the credit point system in postgraduate studies.' },
            content: null
          },
          {
            slug: 'anerkennung-auslaendischer-diplome',
            title: { de: 'Anerkennung ausländischer Diplome: Der Prozess beim SBFI', en: 'Recognition of Foreign Diplomas: The SBFI Process' },
            teaser: { de: 'Wichtige Informationen für Fachkräfte aus dem Ausland.', en: 'Important information for professionals from abroad.' },
            content: null
          }
        ]
      }
    }
  },

  privat_hobby: {
    slug: 'privat-hobby',
    label: {
      de: 'Privat & Hobby',
      en: 'Private & Hobby',
      fr: 'Privé & Loisirs',
      it: 'Privato & Hobby'
    },
    icon: Palette,
    color: 'orange',
    bgLight: 'bg-orange-50',
    bgSolid: 'bg-primary',
    text: 'text-primary',
    border: 'border-primary',
    clusters: {
      inspiration: {
        slug: 'inspiration',
        label: {
          de: 'Inspiration & Einstieg',
          en: 'Inspiration & Getting Started',
          fr: 'Inspiration & Débuter',
          it: 'Ispirazione & Iniziare'
        },
        description: {
          de: 'Überwindung von Anfangshürden und Matching zwischen Person und Format.',
          en: 'Overcoming initial barriers and matching person to format.',
          fr: 'Surmonter les obstacles initiaux et trouver le bon format.',
          it: 'Superare le barriere iniziali e trovare il formato giusto.'
        },
        icon: Lightbulb,
        articles: [
          {
            slug: 'hobby-finden-selbstanalyse',
            title: { de: 'Hobby finden leicht gemacht: Der Selbstanalyse-Check', en: 'Finding a Hobby Made Easy: The Self-Analysis Check' },
            teaser: { de: 'Framework basierend auf Zeit, Energie, sozialen Vorlieben und Budget.', en: 'Framework based on time, energy, social preferences and budget.' },
            content: null
          },
          {
            slug: 'workshop-vs-kurs',
            title: { de: 'Workshop vs. Kurs: Was passt zu Deinem Lernstil?', en: 'Workshop vs. Course: What Suits Your Learning Style?' },
            teaser: { de: 'Abwägung zwischen einmaligen Impulsen und langfristigem Gewohnheitsaufbau.', en: 'Weighing one-time impulses against long-term habit building.' },
            content: null
          },
          {
            slug: 'micro-hobbies',
            title: { de: 'Micro-Hobbies: Kleine Aktivitäten mit grosser Wirkung', en: 'Micro-Hobbies: Small Activities with Big Impact' },
            teaser: { de: 'Low-Commitment-Optionen für Menschen mit wenig Freizeit.', en: 'Low-commitment options for people with little free time.' },
            content: null
          },
          {
            slug: 'zurueck-zum-kindheitstraum',
            title: { de: 'Zurück zum Kindheitstraum: Warum wir tun sollten, was wir als Kind liebten', en: 'Back to Childhood Dreams: Why We Should Do What We Loved as Kids' },
            teaser: { de: 'Psychologische Relevanz früher Leidenschaften für das Erwachsenenalter.', en: 'Psychological relevance of early passions for adulthood.' },
            content: null
          },
          {
            slug: 'hobby-hopping',
            title: { de: 'Hobby-Hopping: Warum es okay ist, regelmässig Neues zu probieren', en: 'Hobby-Hopping: Why It\'s Okay to Try New Things Regularly' },
            teaser: { de: 'Reframing des Wechsels als exploratives Lernen ohne Schuldgefühle.', en: 'Reframing switching as explorative learning without guilt.' },
            content: null
          },
          {
            slug: 'flow-zustand-stressabbau',
            title: { de: 'Flow-Zustand erreichen: Wie Hobbys beim Stressabbau helfen', en: 'Achieving Flow State: How Hobbies Help Reduce Stress' },
            teaser: { de: 'Die Wissenschaft hinter der vertieften Konzentration.', en: 'The science behind deep concentration.' },
            content: null
          }
        ]
      },
      qualitaet: {
        slug: 'qualitaet',
        label: {
          de: 'Qualität, Vertrauen & Organisation',
          en: 'Quality, Trust & Organization',
          fr: 'Qualité, Confiance & Organisation',
          it: 'Qualità, Fiducia & Organizzazione'
        },
        description: {
          de: 'Objektive Qualitätssicherung als zentraler Trust-Faktor.',
          en: 'Objective quality assurance as a central trust factor.',
          fr: 'Assurance qualité objective comme facteur de confiance central.',
          it: 'Garanzia di qualità oggettiva come fattore di fiducia centrale.'
        },
        icon: ShieldCheck,
        articles: [
          {
            slug: 'qualitaetscheck-kursanbieter',
            title: { de: 'Qualitätscheck für Kursanbieter: Worauf Du achten musst', en: 'Quality Check for Course Providers: What to Look For' },
            teaser: { de: 'Kriterien wie Erfahrung, Methodik und Transparenz der Beschreibung.', en: 'Criteria like experience, methodology and description transparency.' },
            content: null
          },
          {
            slug: 'red-flags-hobbykurse',
            title: { de: 'Die 10 häufigsten Red Flags bei Hobbykursen', en: 'The 10 Most Common Red Flags in Hobby Courses' },
            teaser: { de: 'Warnsignale vor vagen Inhalten oder versteckten Materialkosten.', en: 'Warning signs about vague content or hidden material costs.' },
            content: null
          },
          {
            slug: 'kursbeschreibungen-richtig-lesen',
            title: { de: 'Kursbeschreibungen richtig lesen: Voraussetzungen & Ziele', en: 'Reading Course Descriptions Correctly: Prerequisites & Goals' },
            teaser: { de: 'Interpretation von Level-Angaben und "Material inklusive"-Klauseln.', en: 'Interpreting level specifications and "materials included" clauses.' },
            content: null
          },
          {
            slug: 'offline-vs-online',
            title: { de: 'Offline vs. Online: Warum Präsenzunterricht oft effektiver ist', en: 'Offline vs. Online: Why In-Person Teaching Is Often More Effective' },
            teaser: { de: 'Vorteile der unmittelbaren Korrektur und des sozialen Drucks.', en: 'Benefits of immediate correction and social pressure.' },
            content: null
          },
          {
            slug: 'storno-ruecktritt-rechte',
            title: { de: 'Storno und Rücktritt: Deine Rechte als Kursteilnehmer', en: 'Cancellation and Withdrawal: Your Rights as a Participant' },
            teaser: { de: 'Rechtliche Grundlagen bei Krankheit oder Kursausfall in der Schweiz.', en: 'Legal basics for illness or course cancellation in Switzerland.' },
            content: null
          },
          {
            slug: 'bewertungen-kontext',
            title: { de: 'Warum Bewertungen wichtig sind, aber Kontext brauchen', en: 'Why Reviews Matter But Need Context' },
            teaser: { de: 'Anleitung zur kritischen Lektüre von Nutzer-Ratings.', en: 'Guide to critically reading user ratings.' },
            content: null
          }
        ]
      },
      lebensphasen: {
        slug: 'lebensphasen',
        label: {
          de: 'Lebensphasen & Soziales',
          en: 'Life Stages & Social',
          fr: 'Phases de Vie & Social',
          it: 'Fasi della Vita & Sociale'
        },
        description: {
          de: 'Hobbys als Instrumente zur sozialen Integration und Bewältigung von Übergängen.',
          en: 'Hobbies as tools for social integration and managing transitions.',
          fr: 'Les loisirs comme outils d\'intégration sociale et de gestion des transitions.',
          it: 'Gli hobby come strumenti di integrazione sociale e gestione delle transizioni.'
        },
        icon: Heart,
        articles: [
          {
            slug: 'hobbys-senioren',
            title: { de: 'Hobbys für Seniorinnen und Senioren: Fit im Ruhestand', en: 'Hobbies for Seniors: Staying Fit in Retirement' },
            teaser: { de: 'Fokus auf Ergonomie, Lerntempo und kognitive Vitalität.', en: 'Focus on ergonomics, learning pace and cognitive vitality.' },
            content: null
          },
          {
            slug: 'neu-in-der-stadt',
            title: { de: 'Neu in der Stadt? Anschluss finden über lokale Kurse', en: 'New in Town? Finding Connection Through Local Courses' },
            teaser: { de: 'Hobbys als Integrationsmotor in einem neuen Kanton.', en: 'Hobbies as an integration driver in a new canton.' },
            content: null
          },
          {
            slug: 'hobbykurse-date-idee',
            title: { de: 'Hobbykurse als Date-Idee: Gemeinsam wachsen ohne Stress', en: 'Hobby Courses as Date Idea: Growing Together Without Stress' },
            teaser: { de: 'Auswahl geeigneter Formate für Paare zur Beziehungsstärkung.', en: 'Selecting suitable formats for couples to strengthen relationships.' },
            content: null
          },
          {
            slug: 'kurse-alleine-besuchen',
            title: { de: 'Kurse alleine besuchen: Tipps gegen soziale Angst', en: 'Attending Courses Alone: Tips Against Social Anxiety' },
            teaser: { de: 'Strategien für den Start in eine bestehende Gruppe als Einzelperson.', en: 'Strategies for joining an existing group as an individual.' },
            content: null
          },
          {
            slug: 'hobbys-studierende',
            title: { de: 'Hobbys für Studierende: Günstige Angebote im Uni-Alltag', en: 'Hobbies for Students: Affordable Options in University Life' },
            teaser: { de: 'Ausgleich zum Lernstress mit kleinem Budget.', en: 'Balance to study stress on a small budget.' },
            content: null
          },
          {
            slug: 'introvertiert-hobbys-alleine',
            title: { de: 'Introvertiert? Hobbys, die Du wunderbar allein ausüben kannst', en: 'Introverted? Hobbies You Can Wonderfully Do Alone' },
            teaser: { de: 'Fokus auf Einzelsettings und ruhige Umgebungen.', en: 'Focus on individual settings and quiet environments.' },
            content: null
          }
        ]
      },
      'kosten-nutzen': {
        slug: 'kosten-nutzen',
        label: {
          de: 'Kosten-Nutzen & Budgetierung',
          en: 'Cost-Benefit & Budgeting',
          fr: 'Coûts-Bénéfices & Budget',
          it: 'Costi-Benefici & Budget'
        },
        description: {
          de: 'Adressierung der finanziellen Realität in der Schweiz.',
          en: 'Addressing the financial reality in Switzerland.',
          fr: 'Aborder la réalité financière en Suisse.',
          it: 'Affrontare la realtà finanziaria in Svizzera.'
        },
        icon: PiggyBank,
        articles: [
          {
            slug: 'hobby-vollkosten-modell',
            title: { de: 'Was kostet ein Hobby wirklich? Das Vollkosten-Modell', en: 'What Does a Hobby Really Cost? The Full Cost Model' },
            teaser: { de: 'Kalkulation inklusive Ausrüstung, Anfahrt und Übungszeit.', en: 'Calculation including equipment, travel and practice time.' },
            content: null
          },
          {
            slug: 'ausruestung-mieten-statt-kaufen',
            title: { de: 'Ausrüstung mieten statt kaufen: Tipps für Einsteiger', en: 'Rent Equipment Instead of Buying: Tips for Beginners' },
            teaser: { de: 'Kosteneffizienter Start ohne hohe Vorabinvestitionen.', en: 'Cost-efficient start without high upfront investments.' },
            content: null
          },
          {
            slug: 'krankenkassenbeitraege-kurse',
            title: { de: 'Krankenkassenbeiträge: Welche Kurse übernommen werden', en: 'Health Insurance Contributions: Which Courses Are Covered' },
            teaser: { de: 'Zusatzversicherungen für Prävention und Bewegung.', en: 'Supplementary insurance for prevention and exercise.' },
            content: null
          },
          {
            slug: '50-30-20-freizeitplanung',
            title: { de: 'Das 50/30/20-Modell für Deine Freizeitplanung', en: 'The 50/30/20 Model for Your Leisure Planning' },
            teaser: { de: 'Budgetierung des Nettoeinkommens für Hobbys in der Schweiz.', en: 'Budgeting net income for hobbies in Switzerland.' },
            content: null
          },
          {
            slug: 'minimum-viable-gear',
            title: { de: 'Fehlkäufe vermeiden: Die "Minimum Viable Gear"-Strategie', en: 'Avoiding Bad Purchases: The "Minimum Viable Gear" Strategy' },
            teaser: { de: 'Erstes Equipment nach dem Schnupperkurs sinnvoll wählen.', en: 'Choosing first equipment wisely after trial courses.' },
            content: null
          },
          {
            slug: 'guenstige-alternativen',
            title: { de: 'Günstige Alternativen: Hobbys mit kleinem Portemonnaie', en: 'Affordable Alternatives: Hobbies on a Small Budget' },
            teaser: { de: 'Wo man in der Schweiz preiswerte Nischenangebote findet.', en: 'Where to find affordable niche offerings in Switzerland.' },
            content: null
          }
        ]
      }
    }
  },

  kinder_jugend: {
    slug: 'kinder',
    label: {
      de: 'Kinder & Jugendliche',
      en: 'Kids & Teens',
      fr: 'Enfants & Ados',
      it: 'Bambini & Adolescenti'
    },
    icon: Smile,
    color: 'emerald',
    bgLight: 'bg-emerald-50',
    bgSolid: 'bg-emerald-500',
    text: 'text-emerald-600',
    border: 'border-emerald-500',
    clusters: {
      sicherheit: {
        slug: 'sicherheit',
        label: {
          de: 'Sicherheit & Recht (Safeguarding)',
          en: 'Safety & Legal (Safeguarding)',
          fr: 'Sécurité & Droit',
          it: 'Sicurezza & Diritto'
        },
        description: {
          de: 'Der wichtigste Trust-Cluster für Eltern im Kindersegment.',
          en: 'The most important trust cluster for parents in the children\'s segment.',
          fr: 'Le cluster de confiance le plus important pour les parents.',
          it: 'Il cluster di fiducia più importante per i genitori.'
        },
        icon: Shield,
        articles: [
          {
            slug: 'aufsichtspflicht-schweiz',
            title: { de: 'Aufsichtspflicht in Schweizer Kursen: Wer haftet wann?', en: 'Duty of Supervision in Swiss Courses: Who Is Liable When?' },
            teaser: { de: 'Rechtliche Klärung für Eltern und Kursleitende (ZGB/OR).', en: 'Legal clarification for parents and course leaders (ZGB/OR).' },
            content: null
          },
          {
            slug: 'kinderschutz-safeguarding',
            title: { de: 'Kinderschutz (Safeguarding): Worauf Eltern achten sollten', en: 'Child Protection (Safeguarding): What Parents Should Watch For' },
            teaser: { de: 'Erkennungsmerkmale für einen professionellen Umgang mit Grenzen.', en: 'Recognition features for professional boundary management.' },
            content: null
          },
          {
            slug: 'erste-hilfe-notfallplaene',
            title: { de: 'Erste Hilfe & Notfallpläne: Was Anbieter transparent machen müssen', en: 'First Aid & Emergency Plans: What Providers Must Disclose' },
            teaser: { de: 'Checkliste für Kontaktketten und medizinische Notfälle.', en: 'Checklist for contact chains and medical emergencies.' },
            content: null
          },
          {
            slug: 'sicherheit-kursraum-checkliste',
            title: { de: 'Sicherheit im Kursraum: Die ultimative Checkliste', en: 'Course Room Safety: The Ultimate Checklist' },
            teaser: { de: 'Prüfung von Brandschutz, Hygiene und altersgerechter Umgebung.', en: 'Checking fire safety, hygiene and age-appropriate environment.' },
            content: null
          },
          {
            slug: 'datenschutz-fotos-videos',
            title: { de: 'Datenschutz für Eltern: Fotos und Videos in Kursen', en: 'Data Protection for Parents: Photos and Videos in Courses' },
            teaser: { de: 'Einwilligung und Privatsphäre im digitalen Zeitalter.', en: 'Consent and privacy in the digital age.' },
            content: null
          },
          {
            slug: 'versicherungsschutz-kindersport',
            title: { de: 'Versicherungsschutz beim Kindersport: Haftpflicht & Unfall', en: 'Insurance Coverage for Children\'s Sports: Liability & Accident' },
            teaser: { de: 'Wer zahlt, wenn beim Fussball oder Turnen etwas passiert?', en: 'Who pays when something happens in football or gymnastics?' },
            content: null
          }
        ]
      },
      interessen: {
        slug: 'interessen',
        label: {
          de: 'Interessen finden & Motivation',
          en: 'Finding Interests & Motivation',
          fr: 'Trouver des Intérêts & Motivation',
          it: 'Trovare Interessi & Motivazione'
        },
        description: {
          de: 'Identifikation von Neigungen ohne Leistungsdruck.',
          en: 'Identifying interests without performance pressure.',
          fr: 'Identifier les intérêts sans pression de performance.',
          it: 'Identificare gli interessi senza pressione sulle prestazioni.'
        },
        icon: Target,
        articles: [
          {
            slug: 'interessen-check-kind',
            title: { de: 'Interessen-Check: So findest Du heraus, was Dein Kind begeistert', en: 'Interest Check: How to Find Out What Excites Your Child' },
            teaser: { de: 'Beobachtungsmethoden statt Erwartungsdruck.', en: 'Observation methods instead of expectation pressure.' },
            content: null
          },
          {
            slug: 'motivation-ohne-zwang',
            title: { de: 'Motivation ohne Zwang: Dranbleiben unterstützen', en: 'Motivation Without Force: Supporting Persistence' },
            teaser: { de: 'Strategien für die kritische Phase nach den ersten Wochen.', en: 'Strategies for the critical phase after the first weeks.' },
            content: null
          },
          {
            slug: 'hobby-wechsel-aufgeben',
            title: { de: 'Hobby-Wechsel leicht gemacht: Wann Aufgeben sinnvoll ist', en: 'Hobby Change Made Easy: When Quitting Makes Sense' },
            teaser: { de: 'Kriterien für einen gesunden Abschluss statt eines Abbruchs.', en: 'Criteria for a healthy conclusion rather than abandonment.' },
            content: null
          },
          {
            slug: 'peer-group-einfluss',
            title: { de: 'Peer-Group-Einfluss: Nur zum Kurs, weil Freunde gehen?', en: 'Peer Group Influence: Only Going Because Friends Are?' },
            teaser: { de: 'Chancen und Risiken sozialer Motive bei der Kurswahl.', en: 'Opportunities and risks of social motives in course selection.' },
            content: null
          },
          {
            slug: 'schnupperstunden-probieren',
            title: { de: 'Probieren statt festlegen: Die Macht der Schnupperstunden', en: 'Try Before Committing: The Power of Trial Lessons' },
            teaser: { de: 'Strategische Nutzung von Kurzformaten zum Testen.', en: 'Strategic use of short formats for testing.' },
            content: null
          },
          {
            slug: 'intrinsische-motivation',
            title: { de: 'Vom "Müssen" zum "Wollen": Intrinsische Motivation fördern', en: 'From "Must" to "Want": Fostering Intrinsic Motivation' },
            teaser: { de: 'Psychologische Wirkung von Erfolgserlebnissen.', en: 'Psychological impact of success experiences.' },
            content: null
          }
        ]
      },
      'finanzen-kinder': {
        slug: 'finanzen-kinder',
        label: {
          de: 'Finanzen & Förderung',
          en: 'Finances & Support',
          fr: 'Finances & Soutien',
          it: 'Finanze & Supporto'
        },
        description: {
          de: 'Adressierung der logistischen und monetären Belastung von Familien.',
          en: 'Addressing the logistical and monetary burden on families.',
          fr: 'Aborder la charge logistique et financière des familles.',
          it: 'Affrontare il carico logistico e finanziario delle famiglie.'
        },
        icon: HandCoins,
        articles: [
          {
            slug: 'kulturlegi-schweiz',
            title: { de: 'KulturLegi in der Schweiz: Bis zu 70% Rabatt auf Kurse', en: 'KulturLegi in Switzerland: Up to 70% Discount on Courses' },
            teaser: { de: 'Wegweiser zur Beantragung und Nutzung für Familien.', en: 'Guide to applying and using for families.' },
            content: null
          },
          {
            slug: 'steuertipp-kinderbetreuungskosten',
            title: { de: 'Steuertipp: Kinderbetreuungskosten korrekt abziehen', en: 'Tax Tip: Correctly Deducting Childcare Costs' },
            teaser: { de: 'Detaillierte Anleitung für kantonale Steuererklärungen.', en: 'Detailed instructions for cantonal tax returns.' },
            content: null
          },
          {
            slug: 'budgetplanung-kinderkurse',
            title: { de: 'Budgetplanung für Hobbys: Was kosten Kinderkurse wirklich?', en: 'Budget Planning for Hobbies: What Do Kids\' Courses Really Cost?' },
            teaser: { de: 'Aufstellung von Gebühren, Material und Verpflegung.', en: 'Breakdown of fees, materials and catering.' },
            content: null
          },
          {
            slug: 'geschwisterrabatte-paketpreise',
            title: { de: 'Geschwisterrabatte und Paketpreise: Clevere Wege zum Sparen', en: 'Sibling Discounts and Package Prices: Smart Ways to Save' },
            teaser: { de: 'Verhandlungstipps und Plattform-Vorteile.', en: 'Negotiation tips and platform benefits.' },
            content: null
          },
          {
            slug: 'stiftungen-kantonale-programme',
            title: { de: 'Hobbys finanzieren: Stiftungen und kantonale Programme', en: 'Financing Hobbies: Foundations and Cantonal Programs' },
            teaser: { de: 'Suche nach finanzieller Unterstützung für begabte Kinder.', en: 'Finding financial support for talented children.' },
            content: null
          },
          {
            slug: 'ausruestung-mieten-kinder',
            title: { de: 'Ausrüstung mieten statt kaufen: Tipps für den günstigen Einstieg', en: 'Rent Instead of Buy: Tips for Affordable Entry' },
            teaser: { de: 'Sharing-Economy-Ansätze für Instrumente und Sportgeräte.', en: 'Sharing economy approaches for instruments and sports equipment.' },
            content: null
          }
        ]
      },
      familienalltag: {
        slug: 'familienalltag',
        label: {
          de: 'Herausforderungen im Familienalltag',
          en: 'Family Life Challenges',
          fr: 'Défis du Quotidien Familial',
          it: 'Sfide della Vita Familiare'
        },
        description: {
          de: 'Logistik und Zeitmanagement als Schmerzpunkte der Eltern.',
          en: 'Logistics and time management as parental pain points.',
          fr: 'Logistique et gestion du temps comme points de douleur des parents.',
          it: 'Logistica e gestione del tempo come punti dolenti dei genitori.'
        },
        icon: Clock,
        articles: [
          {
            slug: 'zeitmanagement-eltern',
            title: { de: 'Zeitmanagement für Eltern: Hobbys und Beruf vereinbaren', en: 'Time Management for Parents: Balancing Hobbies and Work' },
            teaser: { de: 'Tipps zur Organisation von Fahrdiensten und Pausen.', en: 'Tips for organizing transportation and breaks.' },
            content: null
          },
          {
            slug: 'mental-load-buchungssysteme',
            title: { de: 'Mental Load reduzieren: Digitale Buchungssysteme nutzen', en: 'Reducing Mental Load: Using Digital Booking Systems' },
            teaser: { de: 'Psychologische Entlastung durch einfache Organisation.', en: 'Psychological relief through simple organization.' },
            content: null
          },
          {
            slug: 'angst-vor-neuem',
            title: { de: 'Angst vor Neuem: So nimmst Du Deinem Kind die Scheu', en: 'Fear of New Things: How to Help Your Child Overcome Shyness' },
            teaser: { de: 'Vorbereitung auf die erste Kursstunde.', en: 'Preparing for the first course session.' },
            content: null
          },
          {
            slug: 'hausaufgaben-vs-hobby',
            title: { de: 'Hausaufgaben vs. Hobby: Konflikte vermeiden', en: 'Homework vs. Hobby: Avoiding Conflicts' },
            teaser: { de: 'Tipps für eine ausgewogene Tagesstruktur.', en: 'Tips for a balanced daily structure.' },
            content: null
          },
          {
            slug: 'mobbingpraevention-kurse',
            title: { de: 'Mobbingprävention in Kursen: Ein sicheres Umfeld erkennen', en: 'Bullying Prevention in Courses: Recognizing a Safe Environment' },
            teaser: { de: 'Merkmale für kompetente Konfliktlösung durch Anbieter.', en: 'Features of competent conflict resolution by providers.' },
            content: null
          },
          {
            slug: 'ferienplanung-betreuungsluecken',
            title: { de: 'Ferienplanung für Berufstätige: Betreuungslücken schliessen', en: 'Holiday Planning for Working Parents: Closing Childcare Gaps' },
            teaser: { de: 'Organisation von Feriencamps in der schulfreien Zeit.', en: 'Organizing holiday camps during school breaks.' },
            content: null
          }
        ]
      }
    }
  }
};

// Helper function to get all articles for a category
export function getArticlesForCategory(categoryKey) {
  const category = RATGEBER_STRUCTURE[categoryKey];
  if (!category) return [];

  const articles = [];
  Object.values(category.clusters).forEach(cluster => {
    cluster.articles.forEach(article => {
      articles.push({
        ...article,
        clusterSlug: cluster.slug,
        clusterLabel: cluster.label,
        categorySlug: category.slug,
        categoryLabel: category.label
      });
    });
  });
  return articles;
}

// Helper function to find article by slug
export function findArticle(categorySlug, clusterSlug, articleSlug) {
  // Find category by slug
  const category = Object.values(RATGEBER_STRUCTURE).find(c => c.slug === categorySlug);
  if (!category) return null;

  // Find cluster
  const cluster = Object.values(category.clusters).find(c => c.slug === clusterSlug);
  if (!cluster) return null;

  // Find article
  const article = cluster.articles.find(a => a.slug === articleSlug);
  if (!article) return null;

  return {
    ...article,
    cluster,
    category
  };
}

// Helper to get cluster by slugs
export function findCluster(categorySlug, clusterSlug) {
  const category = Object.values(RATGEBER_STRUCTURE).find(c => c.slug === categorySlug);
  if (!category) return null;

  const cluster = Object.values(category.clusters).find(c => c.slug === clusterSlug);
  if (!cluster) return null;

  return {
    ...cluster,
    category
  };
}

// Get category by its slug (e.g., 'beruflich', 'privat-hobby', 'kinder')
export function findCategoryBySlug(slug) {
  return Object.values(RATGEBER_STRUCTURE).find(c => c.slug === slug);
}
