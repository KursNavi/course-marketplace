/**
 * Deterministische Muss-Prüfung der KI-Suche (Datenvertrag §4/§5).
 *
 * Kerninvariante: Alle EVENTBEZOGENEN Muss-Kriterien (Ort, Zeitraum,
 * nicht abgesagt, nicht vergangen) muss EIN UND DERSELBE Event erfüllen.
 * Ort aus Event A plus Datum aus Event B ist kein Treffer ("Zürich teuer
 * plus Bern günstig ist kein günstiger Zürcher Treffer").
 *
 * Der Preis liegt am Kurs (Events haben kein Preisfeld, am Schema verifiziert)
 * und wird kursweit geprüft. Unbekannte Werte erfüllen kein Muss; sie führen
 * zum Ergebnis 'incomplete' (Bereich "Angaben unvollständig"), nicht zu einem
 * bestätigten Treffer und nicht zu einem belegten Verstoss.
 *
 * Ergebnisse je Kurs:
 *   'confirmed'  - alle Muss belegt erfüllt (inkl. genau ein passender Event)
 *   'incomplete' - kein Muss belegt verletzt, aber mindestens eines unbekannt
 *   'failed'     - mindestens ein Muss belegt verletzt
 */

import { derivePriceStatus, checkBudgetMust } from './priceStatus.js';

export const MUST_RESULT = Object.freeze({
  CONFIRMED: 'confirmed',
  INCOMPLETE: 'incomplete',
  FAILED: 'failed',
});

const ZURICH_TZ = 'Europe/Zurich';

/** Kalendertag (YYYY-MM-DD) eines Zeitpunkts in der Zürich-Zeitzone. */
export function zurichDayString(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Überlappung zweier Tagesbereiche (inklusive), null = offen. */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const startA = aStart ?? '0000-01-01';
  const endA = aEnd ?? '9999-12-31';
  const startB = bStart ?? '0000-01-01';
  const endB = bEnd ?? '9999-12-31';
  return startA <= endB && endA >= startB;
}

function isCancelled(event) {
  return Boolean(event?.cancelled_at);
}

function isPast(event, todayDay) {
  const end = event?.end_date || event?.start_date;
  const endDay = end ? zurichDayString(end) : null;
  if (!endDay) return false;
  return endDay < todayDay;
}

/**
 * Prüft, ob EIN Event sämtliche eventbezogenen Muss-Kriterien erfüllt.
 * @returns {'confirmed'|'incomplete'|'failed'} für diesen einen Event
 */
function checkEventAgainstMusts(event, musts, todayDay) {
  if (isCancelled(event) || isPast(event, todayDay)) return MUST_RESULT.FAILED;

  let hasUnknown = false;

  if (musts.location) {
    const wanted = String(musts.location).toLowerCase();
    const eventCanton = (event.canton || '').toLowerCase();
    const eventLocation = (event.location || '').toLowerCase();
    const isOnlineEvent = !event.canton && eventLocation === 'online';
    if (isOnlineEvent) {
      if (!musts.onlineAllowed) return MUST_RESULT.FAILED;
    } else if (!eventCanton && !eventLocation) {
      hasUnknown = true;
    } else if (eventCanton !== wanted && !eventLocation.includes(wanted)) {
      return MUST_RESULT.FAILED;
    }
  }

  if (musts.dateFrom || musts.dateTo) {
    const startDay = event.start_date ? zurichDayString(event.start_date) : null;
    if (!startDay) {
      hasUnknown = true;
    } else {
      const endDay = event.end_date ? zurichDayString(event.end_date) : startDay;
      if (!rangesOverlap(startDay, endDay, musts.dateFrom ?? null, musts.dateTo ?? null)) {
        return MUST_RESULT.FAILED;
      }
    }
  }

  return hasUnknown ? MUST_RESULT.INCOMPLETE : MUST_RESULT.CONFIRMED;
}

// Kantonsnamen wie im Suchformular (plus Liechtenstein). Andere Werte im
// Kursfeld canton (z. B. „Online“) sind keine Ortsangabe.
const CANTON_NAMES = new Set(['aargau', 'appenzell ai', 'appenzell ar', 'basel-landschaft', 'basel-stadt',
  'bern', 'fribourg', 'genève', 'glarus', 'graubünden', 'jura', 'liechtenstein', 'luzern', 'neuchâtel',
  'nidwalden', 'obwalden', 'schaffhausen', 'schwyz', 'solothurn', 'st. gallen', 'thurgau', 'ticino', 'uri',
  'valais', 'vaud', 'zug', 'zürich']);

/**
 * Bekannte Orte eines Kurses ohne Termin (K2, 22.11.2026): Kursfeld canton
 * und Präsenz-Kursorte (course_locations) sowie die Lernform. Nur echte
 * Kantonsnamen zählen; widersprüchliche Angaben (z. B. canton „Online“ bei
 * Präsenz) bleiben unbekannt.
 */
export function knownCoursePlaces(course) {
  const cantons = new Set();
  const add = (value) => {
    const name = String(value ?? '').trim().toLowerCase();
    if (CANTON_NAMES.has(name)) cantons.add(name);
  };
  add(course?.canton);
  const locations = Array.isArray(course?.course_locations) ? course.course_locations : [];
  for (const location of locations) {
    if ((location?.location_type ?? 'presence') === 'presence') add(location?.canton);
  }
  const types = (Array.isArray(course?.delivery_types) && course.delivery_types.length > 0
    ? course.delivery_types : (course?.delivery_type ? [course.delivery_type] : []))
    .map((t) => String(t).toLowerCase());
  const online = types.some((t) => t === 'online' || t === 'online_live')
    || locations.some((l) => l?.location_type === 'online');
  const presence = types.some((t) => t === 'presence' || t === 'vor_ort') || cantons.size > 0;
  return { cantons, online, presence };
}

/**
 * Ortsvorgabe ohne passenden Termin aus den bekannten Kursorten.
 * Bestätigt, wenn ein bekannter Präsenzort im gewünschten Kanton liegt oder
 * Online erlaubt und angeboten ist. Verstoss, wenn die bekannten Angaben der
 * Vorgabe widersprechen (alle Präsenzorte anderswo bzw. nur online bei
 * „nicht online“). Sonst unbekannt.
 */
export function checkCourseLocationMust(course, musts) {
  const wanted = String(musts?.location ?? '').trim().toLowerCase();
  const { cantons, online, presence } = knownCoursePlaces(course);
  if (wanted && cantons.has(wanted)) return MUST_RESULT.CONFIRMED;
  if (musts?.onlineAllowed && online) return MUST_RESULT.CONFIRMED;
  if (cantons.size > 0) return MUST_RESULT.FAILED;
  if (online && !presence) return MUST_RESULT.FAILED; // nur online, Online nicht erlaubt
  return MUST_RESULT.INCOMPLETE;
}

/**
 * Vollständige Muss-Prüfung eines Kurses gegen die Suchkriterien.
 *
 * @param {object} course - Kurs inkl. course_events (Quellzeilen)
 * @param {object} musts - { location, onlineAllowed, dateFrom, dateTo (YYYY-MM-DD,
 *   Zürich-Tage), maxBudget, languages: string[] }
 * @param {{today?: Date}} [options] - injizierbare Uhr für Tests
 * @returns {{result: string, matchingEvent: object|null,
 *            failures: string[], unknowns: string[]}}
 */
export function checkCourseMusts(course, musts = {}, options = {}) {
  const todayDay = zurichDayString(options.today ?? new Date());
  const failures = [];
  const unknowns = [];

  // --- Kursweite Kriterien -------------------------------------------------
  if (Number.isFinite(musts.maxBudget)) {
    const budget = checkBudgetMust(derivePriceStatus(course), musts.maxBudget);
    if (budget === 'failed') failures.push('budget');
    if (budget === 'unknown') unknowns.push('budget');
  }

  if (Array.isArray(musts.languages) && musts.languages.length > 0) {
    const courseLanguages = Array.isArray(course?.languages) && course.languages.length > 0
      ? course.languages
      : (course?.language ? [course.language] : []);
    if (courseLanguages.length === 0) {
      unknowns.push('language');
    } else if (!musts.languages.some((lang) => courseLanguages.includes(lang))) {
      failures.push('language');
    }
  }

  // --- Eventbezogene Kriterien: derselbe Event muss alles erfüllen ---------
  const needsEvent = Boolean(musts.location || musts.dateFrom || musts.dateTo);
  const needsDate = Boolean(musts.dateFrom || musts.dateTo);
  let matchingEvent = null;
  if (needsEvent) {
    const events = Array.isArray(course?.course_events) ? course.course_events : [];
    if (events.length === 0) {
      // K2: ohne Termin entscheiden die bekannten Kursorte über die
      // Ortsvorgabe; „unvollständig“ nur, wenn der Ort wirklich unbekannt ist.
      const location = musts.location ? checkCourseLocationMust(course, musts) : MUST_RESULT.CONFIRMED;
      if (location === MUST_RESULT.FAILED) failures.push('location');
      else if (location === MUST_RESULT.INCOMPLETE) unknowns.push('location');
      if (needsDate && location !== MUST_RESULT.FAILED) unknowns.push('event');
    } else {
      let bestResult = MUST_RESULT.FAILED;
      for (const event of events) {
        const result = checkEventAgainstMusts(event, musts, todayDay);
        if (result === MUST_RESULT.CONFIRMED) {
          bestResult = result;
          matchingEvent = event;
          break;
        }
        if (result === MUST_RESULT.INCOMPLETE) bestResult = MUST_RESULT.INCOMPLETE;
      }
      if (bestResult === MUST_RESULT.FAILED) failures.push('event');
      if (bestResult === MUST_RESULT.INCOMPLETE) {
        // Termine ohne Ortsangabe: bekannte Kursorte entscheiden über einen
        // belegten Widerspruch (nur Ort; ein Datum bleibt offen).
        const location = musts.location && !needsDate ? checkCourseLocationMust(course, musts) : MUST_RESULT.INCOMPLETE;
        if (location === MUST_RESULT.FAILED) failures.push('location');
        else if (location === MUST_RESULT.INCOMPLETE) unknowns.push('event');
      }
    }
  }

  const result = failures.length > 0
    ? MUST_RESULT.FAILED
    : (unknowns.length > 0 ? MUST_RESULT.INCOMPLETE : MUST_RESULT.CONFIRMED);

  return { result, matchingEvent, failures, unknowns };
}
