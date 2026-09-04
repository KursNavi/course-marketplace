/**
 * Google-Ads-Landingpages
 *
 * Diese Seiten sind bewusst klein und kursnah: Jede Konfiguration beschreibt
 * einen klaren Suchintent und die Kurse, die direkt auf der Seite erscheinen.
 * Sie sind keine redaktionellen Themenwelten und werden deshalb nicht in die
 * Hauptnavigation oder Sitemap aufgenommen.
 */

export const CAMPAIGN_LANDING_CONFIG = {
  'fitnesstrainer-ausbildung': {
    title: 'Fitnesstrainer-Ausbildung finden',
    subtitle: 'Vergleiche aktuelle Ausbildungswege und frage direkt beim passenden Anbieter an.',
    intro: 'Hier findest du die aktuell auf KursNavi verfügbaren Fitnesstrainer-Ausbildungen. Prüfe vor deiner Anfrage insbesondere Inhalte, Lernformat, Voraussetzungen und Abschlussziel.',
    searchParams: { type: 'beruflich', q: 'Fitnesstrainer Ausbildung' },
    typeAliases: ['beruflich', 'professionell'],
    matchTerms: ['fitnesstrainer'],
    minCourses: 2,
    focusProvider: 'BTB',
    notice: 'Prüfe die Angaben zum Abschluss, Lernformat und möglichen Tätigkeitsfeld direkt beim Anbieter.',
  },
  'businesscoach-ausbildung': {
    title: 'Businesscoach-Ausbildung finden',
    subtitle: 'Entdecke aktuelle Ausbildungen für Coaching im beruflichen Kontext.',
    intro: 'Vergleiche die verfügbaren Ausbildungen anhand von Inhalt, Fachrichtung, Lernformat und Voraussetzungen. Eine Anfrage geht direkt an den jeweiligen Anbieter.',
    searchParams: { type: 'beruflich', q: 'Businesscoach Ausbildung' },
    typeAliases: ['beruflich', 'professionell'],
    matchTerms: ['businesscoach', 'business coach'],
    minCourses: 2,
    focusProvider: 'BTB',
    notice: 'Angaben zu Abschluss und Zertifikat stammen vom jeweiligen Anbieter.',
  },
  'ernaehrungsberater-ausbildung': {
    title: 'Ernährung & Coaching-Kurse finden',
    subtitle: 'Vergleiche aktuelle Ausbildungen und Weiterbildungen rund um Ernährung, Beratung und Coaching.',
    intro: 'Vergleiche Ernährungsberatung, Sporternährung, Gewichtsmanagement und weitere Fachrichtungen anhand von Inhalt, Lernformat und Voraussetzungen. Die konkreten Abschlussangaben stammen vom jeweiligen Anbieter.',
    searchParams: { type: 'beruflich', q: 'Ernährung' },
    typeAliases: ['beruflich', 'professionell'],
    matchTerms: ['ernährung', 'ernaehrung', 'ernährungsberater', 'ernährungsberatung', 'sporternährung', 'gewichtsmanagement'],
    minCourses: 3,
    focusProvider: 'BTB',
    notice: 'Bitte kläre vor einer geplanten Tätigkeit in der Schweiz die Anforderungen deines vorgesehenen Arbeitsfelds und die Einordnung des konkreten Abschlusses.',
  },
  'gesundheit-praevention': {
    title: 'Gesundheits- & Präventionskurse finden',
    subtitle: 'Vergleiche aktuelle Ausbildungen und Weiterbildungen für Gesundheit, Prävention und Resilienz.',
    intro: 'Finde passende Angebote von Gesundheitsförderung und Prävention bis Entspannung, Burnout-Prävention und komplementären Fachrichtungen. Prüfe Inhalte, Abschlussziel, Lernformat und Voraussetzungen direkt beim Anbieter.',
    searchParams: { type: 'beruflich', q: 'Gesundheit' },
    typeAliases: ['beruflich', 'professionell'],
    matchTerms: ['gesundheit', 'prävention', 'praevention', 'resilienz', 'burnout', 'entspannung', 'heilpraktiker'],
    minCourses: 3,
    focusProvider: 'BTB',
    notice: 'Gesundheitsbezogene Tätigkeitsfelder können besonderen gesetzlichen oder fachlichen Anforderungen unterliegen. Kläre diese vor einer Anmeldung.',
  },
  'fitness-sportausbildungen': {
    title: 'Fitness- & Sportausbildungen finden',
    subtitle: 'Vergleiche aktuelle Ausbildungen für Fitness, Personal Training und Sport.',
    intro: 'Entdecke Fitness-Trainer-, Personal-Trainer- und weitere Sportausbildungen. Vergleiche Abschlussziel, Praxisbezug, Lernformat und Voraussetzungen direkt beim passenden Anbieter.',
    searchParams: { type: 'beruflich', q: 'Fitness' },
    typeAliases: ['beruflich', 'professionell'],
    matchTerms: ['fitness', 'fitnesstrainer', 'personal trainer', 'group fitness', 'sport'],
    minCourses: 3,
    focusProvider: 'BTB',
    notice: 'Prüfe vor deiner Anfrage, welche Qualifikation für dein geplantes Tätigkeitsfeld und den gewünschten Einsatzbereich passt.',
  },
  fussballcamps: {
    title: 'Fussballcamps für Kinder finden',
    subtitle: 'Entdecke aktuelle Fussballcamps in verschiedenen Regionen der Schweiz.',
    intro: 'Vergleiche Termin, Altersempfehlung, Ort und Ablauf der verfügbaren Angebote. Für Details und offene Fragen kannst du den Anbieter direkt kontaktieren.',
    // Use the same free-text intent as the card matcher. Taxonomy area IDs
    // can change; a stale area slug would make the CTA silently return zero
    // results even while this page has valid offers.
    searchParams: { type: 'kinder_jugend', q: 'Fussballcamp' },
    typeAliases: ['kinder'],
    matchTerms: ['fussball'],
    minCourses: 3,
    notice: 'Durchführung und Betreuung liegen beim jeweiligen Veranstalter. Bitte prüfe die Angebotsdetails und Teilnahmebedingungen.',
  },
  'kreative-teamevents': {
    title: 'Kreative Teamevents finden',
    subtitle: 'Entdecke Workshops für Teams, Firmen und Gruppen in der Schweiz.',
    intro: 'Vergleiche Format, Ort, Gruppengrösse und mögliche Gestaltung des Anlasses. Für ein konkretes Angebot oder freie Termine fragst du direkt beim passenden Anbieter an.',
    searchParams: { type: 'beruflich', q: 'Teamevent' },
    typeAliases: ['beruflich', 'professionell'],
    matchTerms: ['teamevent', 'team event', 'teambuilding', 'firmenanlass', 'firmen event', 'gruppenanlass'],
    minCourses: 3,
    notice: 'Gruppengrösse, Leistungen, Termine und Konditionen klärst du direkt mit dem jeweiligen Veranstalter.',
  },
};

export function getCampaignLanding(slug) {
  return CAMPAIGN_LANDING_CONFIG[slug] || null;
}
