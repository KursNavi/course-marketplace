#!/usr/bin/env node
/**
 * prerender-static.mjs
 *
 * Generates static HTML files for all known static routes at build time.
 * Each file is a copy of dist/index.html with route-specific <head> metadata:
 *   - <title>
 *   - <meta name="description">
 *   - <link rel="canonical">
 *   - og:title, og:description, og:url
 *
 * Vercel serves static files before applying the catch-all SPA rewrite, so
 * Google gets correct metadata on first fetch without needing JS rendering.
 *
 * Dynamic routes (courses, blog posts, providers) are NOT prerendered here —
 * they still fall through to dist/index.html (the SPA).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BEREICH_LANDING_CONFIG } from '../src/lib/bereichLandingConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const BASE_URL = (process.env.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');

// ─── Template ────────────────────────────────────────────────────────────────

let template;
try {
  template = readFileSync(join(distDir, 'index.html'), 'utf-8');
} catch {
  console.error('ERROR: dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generateHtml(path, title, description) {
  const canonical = `${BASE_URL}${path}`;
  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${esc(description)}$2`
  );
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${esc(title)}$2`
  );
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${esc(description)}$2`
  );
  html = html.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    `$1${canonical}$2`
  );
  // Insert canonical before closing </head>
  html = html.replace('</head>', `  <link rel="canonical" href="${canonical}" />\n  </head>`);

  return html;
}

let count = 0;

function writeRoute(path, title, description) {
  const html = generateHtml(path, title, description);
  // e.g. /ratgeber/beruflich/finanzierung → dist/ratgeber/beruflich/finanzierung/index.html
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);
  const outDir = join(distDir, ...segments);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
  count++;
  console.log(`  ✓ ${path}`);
}

// ─── Static pages ─────────────────────────────────────────────────────────────

const STATIC_PAGES = [
  {
    path: '/about',
    title: 'Über uns | KursNavi',
    description: 'Erfahre mehr über KursNavi, die schweizweite Plattform für Kurse und Weiterbildungen. Unsere Mission, Werte und das Team dahinter.',
  },
  {
    path: '/how-it-works',
    title: 'So funktioniert KursNavi',
    description: 'Schritt-für-Schritt erklärt: So findest und buchst du Kurse auf KursNavi – oder stellst deine Kurse als Anbieter ein.',
  },
  {
    path: '/contact',
    title: 'Kontakt | KursNavi',
    description: 'Schreib uns – wir helfen dir bei Fragen zu Kursen, Buchungen oder deinem Anbieter-Account auf KursNavi.',
  },
  {
    path: '/search',
    title: 'Kurssuche Schweiz | KursNavi',
    description: 'Finde deinen Kurs in der Schweiz: Weiterbildung, Hobbykurse, Kinderkurse und mehr. Vergleiche Angebote und buche direkt.',
  },
  {
    path: '/blog',
    title: 'KursNavi Magazin – Tipps & Inspiration für Weiterbildung',
    description: 'Ratgeber, Trends und Praxiswissen rund um Kurse und Weiterbildungen in der Schweiz.',
  },
  {
    path: '/anbieter',
    title: 'Kursanbieter in der Schweiz | KursNavi',
    description: 'Entdecke geprüfte Kursanbieter und Bildungsinstitutionen in der Schweiz. Finde den passenden Anbieter für deine Weiterbildung.',
  },
  {
    path: '/teacher-hub',
    title: 'Kurse anbieten auf KursNavi | Für Kursanbieter',
    description: 'Mehr Teilnehmer für Ihre Kurse: kostenlos starten, Anfragen ohne Provision erhalten und Direktbuchung optional aktivieren.',
  },
  {
    path: '/private',
    title: 'Privatkurse & Hobbykurse Schweiz | KursNavi',
    description: 'Entdecke Kurse für deine Freizeit, Hobbys und persönliche Entwicklung in der Schweiz.',
  },
  {
    path: '/professional',
    title: 'Berufliche Weiterbildung Schweiz | KursNavi',
    description: 'Finde Weiterbildungen, Ausbildungen und Zertifikatskurse für deine Karriere in der Schweiz.',
  },
  {
    path: '/children',
    title: 'Kinderkurse Schweiz | KursNavi',
    description: 'Entdecke Kurse und Freizeitangebote für Kinder und Jugendliche in der Schweiz.',
  },
  {
    path: '/agb',
    title: 'Allgemeine Geschäftsbedingungen | KursNavi',
    description: 'Allgemeine Geschäftsbedingungen der KursNavi GmbH.',
  },
  {
    path: '/datenschutz',
    title: 'Datenschutzerklärung | KursNavi',
    description: 'Informationen zum Datenschutz und zur Datenverarbeitung bei KursNavi.',
  },
  {
    path: '/impressum',
    title: 'Impressum | KursNavi',
    description: 'Impressum und rechtliche Informationen zu KursNavi.',
  },
];

// ─── Ratgeber data ───────────────────────────────────────────────────────────
// Hardcoded here (mirrors api/sitemap.js + ratgeberStructure.js) to avoid
// importing lucide-react in a Node.js context.

const RATGEBER_CATEGORIES = [
  { slug: 'beruflich', label: 'Beruflich' },
  { slug: 'privat-hobby', label: 'Privat & Hobby' },
  { slug: 'kinder', label: 'Kinder' },
];

const RATGEBER_CLUSTERS = {
  beruflich: [
    { slug: 'finanzierung', label: 'Finanzierung & Förderung', description: 'Alles rund um Kosten, Förderungen und Finanzierungsmöglichkeiten für deine Weiterbildung.' },
    { slug: 'karriere', label: 'Karriere & Orientierung', description: 'Standortbestimmung, Spezialisierung und Karriereschritte für Berufsleute in der Schweiz.' },
    { slug: 'future-skills', label: 'Future Skills & Digitalisierung', description: 'AI-Literacy, Green Skills, New Work: Kompetenzen für die Arbeitswelt von morgen.' },
    { slug: 'bildungssystem', label: 'Schweizer Bildungssystem', description: 'Überblick über das Schweizer Bildungssystem, höhere Berufsbildung, CAS/DAS/MAS und mehr.' },
  ],
  'privat-hobby': [
    { slug: 'inspiration', label: 'Inspiration & Ideenfindung', description: 'Hobby finden, Workshop vs. Kurs, Micro-Hobbies: Entdecke neue Leidenschaften.' },
    { slug: 'qualitaet', label: 'Qualität & Sicherheit', description: 'Wie du gute Kursanbieter erkennst, Red Flags vermeidest und deine Rechte kennst.' },
    { slug: 'lebensphasen', label: 'Kurse in jeder Lebensphase', description: 'Hobbykurse für Senioren, Studierende, Neu-in-der-Stadt und mehr.' },
    { slug: 'kosten-nutzen', label: 'Kosten & Nutzen', description: 'Hobby-Vollkosten, Ausrüstung mieten vs. kaufen, günstige Alternativen für dein Freizeitbudget.' },
  ],
  kinder: [
    { slug: 'sicherheit', label: 'Sicherheit & Recht', description: 'Aufsichtspflicht, Kinderschutz, Datenschutz und Versicherung bei Kinderkursen in der Schweiz.' },
    { slug: 'interessen', label: 'Interessen & Motivation', description: 'Wie du die Interessen deines Kindes findest und intrinsische Motivation förderst.' },
    { slug: 'finanzen-kinder', label: 'Kosten & Förderung', description: 'Kulturlegi, Steuertipps, Geschwisterrabatte und Förderprogramme für Kinderkurse.' },
    { slug: 'familienalltag', label: 'Familienalltag & Organisation', description: 'Zeitmanagement, Mental Load, Ferienplanung und Kursorganisation für Eltern.' },
  ],
};

const RATGEBER_ARTICLES = {
  'beruflich/finanzierung': [
    { slug: 'vollkostenrechnung-weiterbildung', title: 'Vollkostenrechnung Weiterbildung: So planst Du Dein Budget', teaser: 'Eine Anleitung zur Erfassung aller Kostenfaktoren einschliesslich Material, Reisekosten und potenziellen Verdienstausfällen.' },
    { slug: 'bundesbeitraege-50-prozent', title: 'Bundesbeiträge für Weiterbildung: bis zu 50% Förderung', teaser: 'Übersicht zu eidgenössischen Fördergeldern für Weiterbildungen – wer anspruchsberechtigt ist und wie man sich bewirbt.' },
    { slug: 'kantonale-stipendien-vergleich', title: 'Kantonale Stipendien in der Schweiz: Schweizweiter Vergleich', teaser: 'Ein Überblick über kantonale Stipendien und Studiendarlehen für Weiterbildungen in der Schweiz.' },
    { slug: 'weiterbildungsvereinbarungen', title: 'Weiterbildungsvereinbarungen mit dem Arbeitgeber', teaser: 'Was du bei Weiterbildungsvereinbarungen mit deinem Arbeitgeber beachten solltest – und wann sie bindend sind.' },
    { slug: 'steuer-hack-weiterbildung', title: 'Weiterbildungskosten von der Steuer abziehen', teaser: 'Welche Weiterbildungskosten in der Schweiz steuerlich absetzbar sind – und worauf du achten musst.' },
    { slug: 'alternative-finanzierungswege', title: 'Alternative Finanzierungswege für Weiterbildung', teaser: 'Crowdfunding, Stipendien von Stiftungen, Bildungskredite: Alle Alternativen zur klassischen Weiterbildungsfinanzierung.' },
  ],
  'beruflich/karriere': [
    { slug: 'berufliche-standortbestimmung', title: 'Berufliche Standortbestimmung: Wo stehst Du?', teaser: 'Eine Anleitung zur persönlichen Standortbestimmung für Berufsleute – Stärken, Werte und Karriereziele definieren.' },
    { slug: 'spezialisierung-vs-generalisierung', title: 'Spezialisierung vs. Generalisierung: Was zahlt sich aus?', teaser: 'Wann es sich lohnt, sich zu spezialisieren, und wann ein breites Profil mehr Chancen bietet.' },
    { slug: 'linkedin-optimierung', title: 'LinkedIn-Profil optimieren für Weiterbildungsabsolventen', teaser: 'Wie du dein LinkedIn-Profil nach einer Weiterbildung optimal aufwertest und neue Chancen nutzt.' },
    { slug: 'gehaltsverhandlung-nach-kurs', title: 'Gehaltsverhandlung nach einer Weiterbildung', teaser: 'Tipps und Strategien für erfolgreiche Gehaltsverhandlungen nach dem Abschluss einer Weiterbildung.' },
    { slug: 'quereinstieg-40-plus', title: 'Quereinstieg mit 40+: Neue Karriere im besten Alter', teaser: 'Wie du auch nach dem 40. Lebensjahr erfolgreich in einen neuen Beruf wechselst.' },
    { slug: 'soft-skills-karriere-turbo', title: 'Soft Skills als Karriere-Turbo', teaser: 'Welche Soft Skills in der Schweizer Arbeitswelt besonders gefragt sind und wie du sie gezielt entwickelst.' },
  ],
  'beruflich/future-skills': [
    { slug: 'ai-literacy-arbeitsplatz', title: 'AI-Literacy am Arbeitsplatz: Was du wissen musst', teaser: 'Grundlagenwissen zu künstlicher Intelligenz für Berufsleute – keine Programmierkenntnisse erforderlich.' },
    { slug: 'green-skills', title: 'Green Skills: Zukunftskompetenzen für die Energiewende', teaser: 'Welche Nachhaltigkeitskompetenzen in der Arbeitswelt zunehmend gefragt sind.' },
    { slug: 'new-work-hybride-fuehrung', title: 'New Work & hybride Führung: Führen auf Distanz', teaser: 'Wie Führungskräfte hybride Teams erfolgreich leiten und motivieren.' },
    { slug: 'micro-credentials', title: 'Micro-Credentials: Kleine Zertifikate, grosse Wirkung', teaser: 'Was Micro-Credentials sind, welche anerkannt werden und wie sie deine Karriere voranbringen.' },
    { slug: 'digital-literacy-generationen', title: 'Digital Literacy für alle Generationen', teaser: 'Digitale Grundkompetenzen für Berufsleute verschiedener Altersgruppen – praxisorientiert erklärt.' },
    { slug: 'adaptive-skills', title: 'Adaptive Skills: Flexibilität als Kernkompetenz', teaser: 'Warum Anpassungsfähigkeit zur wichtigsten beruflichen Kompetenz wird und wie du sie entwickelst.' },
  ],
  'beruflich/bildungssystem': [
    { slug: 'schweizer-bildungssystem-ueberblick', title: 'Das Schweizer Bildungssystem: Ein Überblick', teaser: 'Vom Grundschule bis zur Hochschule: Wie das Schweizer Bildungssystem aufgebaut ist.' },
    { slug: 'hoehere-berufsbildung-vs-hochschule', title: 'Höhere Berufsbildung vs. Hochschule: Was passt zu dir?', teaser: 'Die Unterschiede zwischen höherer Berufsbildung (HF, eidg. FA/BP) und Hochschulstudium in der Schweiz.' },
    { slug: 'professional-bachelor-master', title: 'Professional Bachelor und Master in der Schweiz', teaser: 'Was Professional Bachelor- und Master-Titel bedeuten und wie sie sich von klassischen Hochschultiteln unterscheiden.' },
    { slug: 'qualitaetslabels-eduqua', title: 'Qualitätslabels: eduQua und weitere Zertifizierungen', teaser: 'Welche Qualitätslabels für Bildungsanbieter in der Schweiz relevant sind und was sie bedeuten.' },
    { slug: 'ects-punkte-cas-das-mas', title: 'ECTS-Punkte, CAS, DAS, MAS: Alles erklärt', teaser: 'Was ECTS-Punkte sind und was sich hinter den Abkürzungen CAS, DAS und MAS verbirgt.' },
    { slug: 'anerkennung-auslaendischer-diplome', title: 'Anerkennung ausländischer Diplome in der Schweiz', teaser: 'Wie ausländische Bildungsabschlüsse in der Schweiz anerkannt werden – Ablauf und zuständige Stellen.' },
  ],
  'privat-hobby/inspiration': [
    { slug: 'hobby-finden-selbstanalyse', title: 'Hobby finden: Eine Anleitung zur Selbstanalyse', teaser: 'Wie du durch gezielte Selbstreflexion das richtige Hobby für dich findest.' },
    { slug: 'workshop-vs-kurs', title: 'Workshop vs. Kurs: Was ist der Unterschied?', teaser: 'Wann ein Workshop und wann ein Kurs die bessere Wahl ist – ein klarer Vergleich.' },
    { slug: 'micro-hobbies', title: 'Micro-Hobbies: Grosse Freude auf kleinstem Raum', teaser: 'Hobbys, die wenig Zeit, Platz und Budget brauchen – aber viel Freude machen.' },
    { slug: 'zurueck-zum-kindheitstraum', title: 'Zurück zum Kindheitstraum: Alte Hobbys neu entdecken', teaser: 'Warum es sich lohnt, vergessene Kindheitsleidenschaften neu zu entfachen.' },
    { slug: 'hobby-hopping', title: 'Hobby-Hopping: Fluch oder Segen?', teaser: 'Was es bedeutet, häufig das Hobby zu wechseln – und wann das völlig okay ist.' },
    { slug: 'flow-zustand-stressabbau', title: 'Flow-Zustand und Stressabbau durch Hobbys', teaser: 'Wie Hobbys helfen, in den Flow-Zustand zu kommen und Stress effektiv abzubauen.' },
  ],
  'privat-hobby/qualitaet': [
    { slug: 'qualitaetscheck-kursanbieter', title: 'Qualitätscheck: So erkennst du gute Kursanbieter', teaser: 'Kriterien und Checkliste für die Beurteilung von Kursanbietern und Bildungsinstitutionen.' },
    { slug: 'red-flags-hobbykurse', title: 'Red Flags bei Hobbykursen: Worauf du achten solltest', teaser: 'Warnzeichen, die auf unseriöse Kursanbieter oder schlechte Kursqualität hindeuten.' },
    { slug: 'kursbeschreibungen-richtig-lesen', title: 'Kursbeschreibungen richtig lesen und verstehen', teaser: 'Was du bei Kursbeschreibungen beachten musst – und wie du zwischen Werbetext und echtem Inhalt unterscheidest.' },
    { slug: 'offline-vs-online', title: 'Offline vs. Online-Kurse: Was passt zu dir?', teaser: 'Die Vor- und Nachteile von Online- und Präsenzkursen – und wie du die richtige Wahl triffst.' },
    { slug: 'storno-ruecktritt-rechte', title: 'Storno & Rücktritt: Deine Rechte bei Kursbuchungen', teaser: 'Was bei Stornierungen und Rücktritten von Kursbuchungen in der Schweiz gilt.' },
    { slug: 'bewertungen-kontext', title: 'Kursbewertungen richtig einschätzen', teaser: 'Wie du Online-Bewertungen von Kursen und Anbietern kritisch liest und im Kontext bewertest.' },
  ],
  'privat-hobby/lebensphasen': [
    { slug: 'hobbys-senioren', title: 'Hobbys und Kurse für Senioren in der Schweiz', teaser: 'Aktive Freizeitgestaltung im Alter: Kursangebote und Hobbys speziell für Seniorinnen und Senioren.' },
    { slug: 'neu-in-der-stadt', title: 'Neu in der Stadt: Mit Kursen Anschluss finden', teaser: 'Wie Hobbykurse helfen, nach einem Umzug schnell neue Kontakte zu knüpfen.' },
    { slug: 'hobbykurse-date-idee', title: 'Hobbykurs als Date-Idee: Zusammen Neues entdecken', teaser: 'Warum gemeinsame Kurse die perfekte Alternative zum klassischen Restaurantdate sind.' },
    { slug: 'kurse-alleine-besuchen', title: 'Kurse alleine besuchen: So klappt es entspannt', teaser: 'Tipps für Kursbesuche ohne Begleitung – warum das viel angenehmer ist als gedacht.' },
    { slug: 'hobbys-studierende', title: 'Hobbys für Studierende: Ausgleich neben dem Studium', teaser: 'Wie Studierende trotz knappem Budget und wenig Zeit sinnvolle Hobbys pflegen können.' },
    { slug: 'introvertiert-hobbys-alleine', title: 'Hobbys für Introvertierte: Genuss ohne Trubel', teaser: 'Kurs- und Hobbyempfehlungen für Menschen, die Ruhe und kleine Gruppen bevorzugen.' },
  ],
  'privat-hobby/kosten-nutzen': [
    { slug: 'hobby-vollkosten-modell', title: 'Das Hobby-Vollkosten-Modell: Was dein Hobby wirklich kostet', teaser: 'Wie du alle versteckten Kosten eines Hobbys realistisch berechnest.' },
    { slug: 'ausruestung-mieten-statt-kaufen', title: 'Ausrüstung mieten statt kaufen: Wann es sich lohnt', teaser: 'Wann es günstiger ist, Kursausrüstung zu mieten – und wann du besser kaufst.' },
    { slug: 'krankenkassenbeitraege-kurse', title: 'Krankenkasse zahlt für Kurse: Was wirklich gilt', teaser: 'Welche Kurs- und Bewegungsangebote Krankenkassen in der Schweiz tatsächlich bezuschussen.' },
    { slug: '50-30-20-freizeitplanung', title: '50-30-20 für die Freizeitplanung', teaser: 'Die 50-30-20-Budgetregel auf Hobbys und Freizeitaktivitäten angewendet.' },
    { slug: 'minimum-viable-gear', title: 'Minimum Viable Gear: Mit wenig Equipment starten', teaser: 'Wie du mit minimalem Equipment in ein neues Hobby einsteigst – ohne teure Fehlinvestitionen.' },
    { slug: 'guenstige-alternativen', title: 'Günstige Alternativen für teure Hobbys', teaser: 'Kreative Wege, kostspielige Hobbys günstiger zu gestalten oder gleichwertige Alternativen zu finden.' },
  ],
  'kinder/sicherheit': [
    { slug: 'aufsichtspflicht-schweiz', title: 'Aufsichtspflicht bei Kinderkursen: Was Eltern wissen müssen', teaser: 'Rechtliche Grundlagen zur Aufsichtspflicht bei Kursen und Aktivitäten für Kinder in der Schweiz.' },
    { slug: 'kinderschutz-safeguarding', title: 'Kinderschutz im Kursbereich: Safeguarding erklärt', teaser: 'Was Kinderschutz (Safeguarding) bei Sportvereinen und Kursen bedeutet und was du als Elternteil prüfen solltest.' },
    { slug: 'erste-hilfe-notfallplaene', title: 'Erste Hilfe und Notfallpläne bei Kinderkursen', teaser: 'Welche Erste-Hilfe-Standards und Notfallpläne du von Kursanbietern für Kinder erwarten kannst.' },
    { slug: 'sicherheit-kursraum-checkliste', title: 'Checkliste: Ist der Kursraum kindersicher?', teaser: 'Worauf du bei der Besichtigung von Kursräumen für Kinder achten solltest.' },
    { slug: 'datenschutz-fotos-videos', title: 'Datenschutz: Fotos und Videos von Kindern im Kurs', teaser: 'Was bei der Verwendung von Fotos und Videos von Kindern in Kursen aus datenschutzrechtlicher Sicht gilt.' },
    { slug: 'versicherungsschutz-kindersport', title: 'Versicherungsschutz beim Kindersport', teaser: 'Welche Versicherungen beim Kindersport und bei Kinderkursen wichtig sind.' },
  ],
  'kinder/interessen': [
    { slug: 'interessen-check-kind', title: 'Interessen-Check: Was interessiert mein Kind wirklich?', teaser: 'Methoden und Fragen, um die echten Interessen deines Kindes zu entdecken.' },
    { slug: 'motivation-ohne-zwang', title: 'Kinder für Kurse begeistern ohne Druck', teaser: 'Wie du Kinder für Aktivitäten motivierst, ohne Druck und Zwang auszuüben.' },
    { slug: 'hobby-wechsel-aufgeben', title: 'Wenn Kinder das Hobby wechseln wollen: Wie reagieren?', teaser: 'Wann es sinnvoll ist, ein Kind zum Weitermachen zu ermutigen – und wann Aufhören okay ist.' },
    { slug: 'peer-group-einfluss', title: 'Peer-Group-Einfluss auf Hobbywahl von Kindern', teaser: 'Wie Gleichaltrige die Hobbyentscheidungen von Kindern beeinflussen und wie Eltern damit umgehen.' },
    { slug: 'schnupperstunden-probieren', title: 'Schnupperstunden: Zuerst ausprobieren, dann entscheiden', teaser: 'Warum Schnupperstunden vor der Kursanmeldung so wichtig sind und wie du sie nutzt.' },
    { slug: 'intrinsische-motivation', title: 'Intrinsische Motivation bei Kindern fördern', teaser: 'Wie Eltern intrinsische Motivation bei Kindern im Freizeitbereich stärken können.' },
  ],
  'kinder/finanzen-kinder': [
    { slug: 'kulturlegi-schweiz', title: 'Kulturlegi Schweiz: Vergünstigungen für Familien', teaser: 'Was die Kulturlegi ist, wer sie beantragen kann und welche Vergünstigungen sie bietet.' },
    { slug: 'steuertipp-kinderbetreuungskosten', title: 'Kinderbetreuungskosten von der Steuer abziehen', teaser: 'Welche Kinderbetreuungskosten in der Schweiz steuerlich absetzbar sind.' },
    { slug: 'budgetplanung-kinderkurse', title: 'Budget für Kinderkurse planen', teaser: 'Wie Familien das Kursbudget für Kinder realistisch planen und unnötige Kosten vermeiden.' },
    { slug: 'geschwisterrabatte-paketpreise', title: 'Geschwisterrabatte und Paketpreise bei Kinderkursen', teaser: 'Wie du bei mehreren Kindern von Geschwisterrabatten und Paketangeboten profitierst.' },
    { slug: 'stiftungen-kantonale-programme', title: 'Stiftungen und kantonale Förderprogramme für Kinder', teaser: 'Finanzielle Unterstützung für Kinderkurse: Stiftungen, kantonale Programme und Sozialtarife.' },
    { slug: 'ausruestung-mieten-kinder', title: 'Kinderausrüstung mieten statt kaufen', teaser: 'Warum es bei Kindern oft sinnvoll ist, Kursausrüstung zu mieten statt zu kaufen.' },
  ],
  'kinder/familienalltag': [
    { slug: 'zeitmanagement-eltern', title: 'Zeitmanagement für Eltern: Kinderkurse ohne Stress', teaser: 'Praktische Tipps für Eltern, um Kinderkurse und Freizeitaktivitäten stressfrei zu organisieren.' },
    { slug: 'mental-load-buchungssysteme', title: 'Mental Load und Buchungssysteme: Wer bucht die Kurse?', teaser: 'Wie Familien die Organisation von Kinderkursen gerechter aufteilen können.' },
    { slug: 'angst-vor-neuem', title: 'Wenn Kinder Angst vor neuen Kursen haben', teaser: 'Wie du dein Kind bei Trennungsangst und Schüchternheit vor neuen Aktivitäten begleitest.' },
    { slug: 'hausaufgaben-vs-hobby', title: 'Hausaufgaben vs. Hobby: Die richtige Balance finden', teaser: 'Wie Familien die Balance zwischen schulischen Pflichten und Freizeitaktivitäten finden.' },
    { slug: 'mobbingpraevention-kurse', title: 'Mobbing-Prävention durch Kurs-Aktivitäten', teaser: 'Wie Sportkurse und Gemeinschaftsaktivitäten zur Mobbingprävention bei Kindern beitragen.' },
    { slug: 'ferienplanung-betreuungsluecken', title: 'Ferienplanung: Betreuungslücken mit Kursen schliessen', teaser: 'Wie Eltern die Ferienbetreuung ihrer Kinder mit Ferienkursen und -lagern sinnvoll organisieren.' },
  ],
};

// ─── Main ────────────────────────────────────────────────────────────────────

console.log(`\nPrerendering static routes → ${distDir}\n`);

// Static pages
for (const { path, title, description } of STATIC_PAGES) {
  writeRoute(path, title, description);
}

// Ratgeber hub
writeRoute(
  '/ratgeber',
  'KursNavi Ratgeber – Praxiswissen zu Weiterbildung, Hobbys und Kinderkursen',
  'Der KursNavi Ratgeber: Praxiswissen zu Weiterbildung, Hobbys und Kinderkursen in der Schweiz.'
);

// Ratgeber categories → clusters → articles
for (const cat of RATGEBER_CATEGORIES) {
  writeRoute(
    `/ratgeber/${cat.slug}`,
    `${cat.label} – Ratgeber | KursNavi`,
    `Ratgeber-Artikel rund um ${cat.label}: Weiterbildung, Karriere und mehr in der Schweiz.`
  );

  for (const cluster of (RATGEBER_CLUSTERS[cat.slug] || [])) {
    writeRoute(
      `/ratgeber/${cat.slug}/${cluster.slug}`,
      `${cluster.label} – Ratgeber | KursNavi`,
      cluster.description
    );

    for (const article of (RATGEBER_ARTICLES[`${cat.slug}/${cluster.slug}`] || [])) {
      writeRoute(
        `/ratgeber/${cat.slug}/${cluster.slug}/${article.slug}`,
        `${article.title} | KursNavi Ratgeber`,
        article.teaser
      );
    }
  }
}

// Bereich landing pages + szenario articles (from config)
for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
  const bereichPath = `/bereich/${bereich.segment}/${bereich.slug}`;
  writeRoute(bereichPath, `${bereich.title.de} | KursNavi`, bereich.subtitle.de);

  for (const szenario of (bereich.scenarios || [])) {
    writeRoute(
      `${bereichPath}/${szenario.slug}`,
      `${szenario.label.de} – ${bereich.title.de} | KursNavi`,
      szenario.text.de
    );
  }
}

console.log(`\n✓ ${count} static HTML files generated.\n`);
