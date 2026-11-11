/**
 * Kursorte für die Umkreissuche und die Kartenansicht.
 *
 * Grundregeln (bewusst eng gefasst, damit kein Kurs an einem falschen Ort
 * auftaucht):
 *
 *   • Mass­geblich ist der VERANSTALTUNGSORT, nicht der Firmensitz des
 *     Anbieters. Die Reihenfolge der Quellen spiegelt darum dieselbe
 *     Rangfolge wie die Ortsanzeige auf der Kursdetailseite: konkrete
 *     Präsenz-Termine zuerst, dann hinterlegte Kursorte, erst zuletzt die
 *     flachen Felder am Kurs. Ein Kurs, der früher ein Lead-Kurs in Bern war
 *     und heute Termine in Braunwald hat, zählt in Braunwald — die alte
 *     Bern-Adresse am Kurs bleibt unbeachtet (siehe
 *     tests/course-location-display.test.js zum gleichen Fehlerbild).
 *
 *   • Reine Onlinekurse sind keine räumlichen Treffer und bekommen keinen
 *     Kartenmarker. Bei Hybridkursen zählt der physische Ort.
 *
 *   • Was sich nicht eindeutig auflösen lässt, bleibt ohne Koordinate. Es
 *     werden keine Koordinaten geschätzt und kein Kantonsmittelpunkt
 *     eingesetzt — bei 5 km Umkreis wäre das grob falsch.
 *
 *   • Alle Koordinaten stammen aus Ortsmittelpunkten (PLZ-Kreis bzw.
 *     Ortschaft) und sind darum «ungefähr». Die Oberfläche sagt das.
 *
 * Die Entfernung dient AUSSCHLIESSLICH der Filterung. Dieses Modul sortiert
 * nichts und gibt keine Rangfolge zurück: filterCoursesByRadius() lässt die
 * Reihenfolge der Eingabeliste unverändert und entfernt nur Einträge.
 */

import { isWithinRadius } from './geoDistance';
import { lookupByLocalityName, lookupByPlz } from './swissPlaces';

/** Auswählbare Umkreise in Kilometern. */
export const RADIUS_OPTIONS = [5, 10, 25, 50];

/** Vorbelegung, sobald ein Ausgangsort gewählt wurde. */
export const DEFAULT_RADIUS_KM = 25;

const ONLINE_TOKEN = 'online';
const AUSLAND_TOKEN = 'ausland';

function tokenOf(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isOnlineLocation(entry) {
  return tokenOf(entry?.location_type) === ONLINE_TOKEN
    || tokenOf(entry?.canton) === ONLINE_TOKEN
    || tokenOf(entry?.location) === ONLINE_TOKEN
    || tokenOf(entry?.city) === ONLINE_TOKEN;
}

function isAuslandLocation(entry) {
  return tokenOf(entry?.location_type) === AUSLAND_TOKEN
    || tokenOf(entry?.canton) === AUSLAND_TOKEN
    || tokenOf(entry?.location) === AUSLAND_TOKEN;
}

function isPhysicalLocation(entry) {
  if (!entry) return false;
  if (isOnlineLocation(entry) || isAuslandLocation(entry)) return false;
  return Boolean(entry.canton || entry.city || entry.street || entry.location || entry.address);
}

/**
 * Überschneidet sich ein Termin mit dem aktiven Datumsfilter?
 * Spiegelt die Prüfung in App.jsx — weicht sie ab, würde die Karte andere
 * Termine berücksichtigen als die Ergebnisliste.
 */
function eventMatchesDateRange(event, fromTime, toTime) {
  if (!event?.start_date) return true; // Termin ohne Datum ist nicht datumsgebunden
  const start = new Date(event.start_date).getTime();
  const end = event.end_date ? new Date(event.end_date).getTime() : start;
  if (!Number.isFinite(start)) return true;
  return start <= toTime && end >= fromTime;
}

/**
 * Welche Orts-Einträge eines Kurses sind für die aktuellen Filter relevant?
 *
 * @returns {{entries: Array<object>, kind: 'event'|'location'|'course'|'none'}}
 */
function collectLocationEntries(course, { dateFrom = '', dateTo = '' } = {}) {
  const events = Array.isArray(course?.course_events) ? course.course_events.filter(Boolean) : [];
  const physicalEvents = events.filter(isPhysicalLocation);

  if (physicalEvents.length > 0) {
    const dateActive = Boolean(dateFrom || dateTo);
    if (!dateActive) return { entries: physicalEvents, kind: 'event' };

    const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTime = dateTo ? new Date(dateTo).getTime() : Number.POSITIVE_INFINITY;
    const passend = physicalEvents.filter((event) => eventMatchesDateRange(event, fromTime, toTime));
    // Keine passenden Präsenz-Termine im gewählten Zeitraum: dann gibt es für
    // diesen Zeitraum auch keinen Veranstaltungsort, der als räumlicher
    // Treffer zählen darf.
    return { entries: passend, kind: 'event' };
  }

  if (events.length > 0) {
    // Es gibt Termine, aber keinen physischen darunter.
    if (events.some(isOnlineLocation)) return { entries: [], kind: 'online' };
    if (events.some(isAuslandLocation)) return { entries: [], kind: 'ausland' };
  }

  const locations = Array.isArray(course?.course_locations) ? course.course_locations.filter(Boolean) : [];
  const physicalLocations = locations
    .filter(isPhysicalLocation)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (physicalLocations.length > 0) return { entries: physicalLocations, kind: 'location' };
  if (locations.length > 0) {
    if (locations.some(isOnlineLocation)) return { entries: [], kind: 'online' };
    if (locations.some(isAuslandLocation)) return { entries: [], kind: 'ausland' };
  }

  const flach = { city: course?.city, canton: course?.canton, location: course?.address };
  if (isOnlineLocation(flach)) return { entries: [], kind: 'online' };
  if (isAuslandLocation(flach)) return { entries: [], kind: 'ausland' };
  if (isPhysicalLocation(flach)) return { entries: [flach], kind: 'course' };

  return { entries: [], kind: 'none' };
}

/**
 * Löst einen einzelnen Orts-Eintrag zu Koordinaten auf.
 *
 * Weg: Postleitzahl (genauester verfügbarer Anker) → Ortsname → Ortsname aus
 * dem letzten Abschnitt eines Freitext-Standorts. Reicht keiner davon, gibt es
 * kein Koordinatenpaar.
 */
function resolveEntry(entry, placesIndex) {
  if (!placesIndex || !entry) return null;

  const street = String(entry.street ?? '').trim();
  const city = String(entry.city ?? '').trim();
  const freitext = String(entry.location ?? entry.address ?? '').trim();
  const kantonHinweis = String(entry.canton ?? '').trim();
  const kombiniert = [street, city, freitext].filter(Boolean).join(', ');

  // Der Kanton WANDERT MIT dem Punkt. Nur so lässt sich später prüfen, ob
  // Kantonsfilter und Umkreis von demselben Veranstaltungsort erfüllt werden
  // — und nicht von zwei verschiedenen Orten desselben Kurses.
  const kantonVonEintrag = kantonHinweis;

  const plzTreffer = kombiniert.match(/\b(\d{4})\b/);
  if (plzTreffer) {
    const plz = plzTreffer[1];
    // Was direkt hinter der PLZ steht, ist in Schweizer Adressen der Ortsname.
    const hinterPlz = kombiniert.slice(kombiniert.indexOf(plz) + 4).replace(/^[\s,]+/, '').split(',')[0].trim();
    const row = lookupByPlz(placesIndex, plz, { ortHinweis: city || hinterPlz, kantonHinweis });
    if (row) {
      return {
        lat: row.lat,
        lng: row.lng,
        label: `${row.plz} ${row.ort}${row.kantonCode ? ` (${row.kantonCode})` : ''}`,
        approximate: true,
        // Der am Datensatz hinterlegte Kanton zaehlt; nur wenn er fehlt,
        // springt der Kanton aus der Ortstabelle ein.
        canton: kantonVonEintrag || row.kanton || '',
      };
    }
  }

  const ortKandidaten = [];
  if (city) ortKandidaten.push(city);
  if (freitext) {
    const letzterAbschnitt = freitext.includes(',')
      ? freitext.slice(freitext.lastIndexOf(',') + 1).trim()
      : freitext;
    if (letzterAbschnitt) ortKandidaten.push(letzterAbschnitt.replace(/\b\d{4}\b/g, '').trim());
  }

  for (const kandidat of ortKandidaten) {
    if (!kandidat) continue;
    const locality = lookupByLocalityName(placesIndex, kandidat, { kantonHinweis });
    if (locality) {
      return {
        lat: locality.lat,
        lng: locality.lng,
        label: `${locality.ort}${locality.kantonCode ? ` (${locality.kantonCode})` : ''}`,
        approximate: true,
        canton: kantonVonEintrag || locality.kanton || '',
      };
    }
  }

  // Nur ein Kanton (oder gar nichts) — ein Kantonsmittelpunkt wäre für einen
  // 5-km-Umkreis irreführend. Lieber kein Punkt.
  return null;
}

/**
 * Löst einen einzelnen Orts-Eintrag auf (Termin, Kursort oder flaches Feld).
 * Von scripts/geo-coverage.mjs genutzt, um bestehende Ortsdaten zu ergänzen —
 * mit genau derselben Logik wie die Suche im Browser.
 */
export function resolveLocationPoint(entry, placesIndex) {
  if (!isPhysicalLocation(entry)) return null;
  return resolveEntry(entry, placesIndex);
}

/**
 * Ortsinformationen eines Kurses für Umkreis und Karte.
 *
 * @param {object} course
 * @param {object|null} placesIndex - Index aus swissPlaces.js
 * @param {{dateFrom?: string, dateTo?: string}} [options]
 * @returns {{status: 'located'|'online'|'ausland'|'unknown', points: Array<{lat:number,lng:number,label:string,approximate:boolean}>}}
 */
export function getCourseGeoInfo(course, placesIndex, options = {}) {
  const { entries, kind } = collectLocationEntries(course, options);

  if (kind === 'online') return { status: 'online', points: [] };
  if (kind === 'ausland') return { status: 'ausland', points: [] };
  if (entries.length === 0) return { status: 'unknown', points: [] };

  const points = [];
  const gesehen = new Set();
  entries.forEach((entry) => {
    const point = resolveEntry(entry, placesIndex);
    if (!point) return;
    const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}|${point.canton || ''}`;
    if (gesehen.has(key)) return;
    gesehen.add(key);
    points.push(point);
  });

  return points.length > 0
    ? { status: 'located', points }
    : { status: 'unknown', points: [] };
}

/**
 * Erzeugt eine Auflösefunktion mit Zwischenspeicher pro Kurs.
 *
 * Ohne Zwischenspeicher würde jeder Kurs bei jedem Tastendruck in der
 * Suchzeile neu aufgelöst. Der Speicher gilt für genau eine Kombination aus
 * Ortstabelle und Datumsfilter; ändert sich etwas davon, wird ein neuer
 * Resolver erzeugt (siehe useMemo in App.jsx).
 */
export function createGeoResolver(placesIndex, options = {}) {
  const cache = new Map();
  return (course) => {
    const key = course?.id ?? course;
    if (cache.has(key)) return cache.get(key);
    const info = getCourseGeoInfo(course, placesIndex, options);
    cache.set(key, info);
    return info;
  };
}

/**
 * Welche der ausgewählten Standort-Filter sind echte Kantone?
 *
 * «Online» und «Ausland» sind im Standortfilter keine Kantone, sondern
 * Formatangaben. Sie bleiben von der kombinierten Prüfung unberührt.
 */
export function realCantonSelections(selectedLocations) {
  if (!Array.isArray(selectedLocations)) return [];
  return selectedLocations.filter((value) => {
    const token = tokenOf(value);
    return token && token !== ONLINE_TOKEN && token !== AUSLAND_TOKEN;
  });
}

/** Gehört ein Punkt zu einem der ausgewählten Kantone? */
export function pointMatchesCantons(point, cantons) {
  if (!Array.isArray(cantons) || cantons.length === 0) return true;
  const punktKanton = tokenOf(point?.canton);
  if (!punktKanton) return false;
  return cantons.some((canton) => tokenOf(canton) === punktKanton);
}

/**
 * Liegt mindestens ein relevanter Veranstaltungsort im Umkreis?
 *
 * Mit `cantons` muss EIN UND DERSELBE Ort beide Bedingungen erfüllen.
 *
 * Hintergrund: Ein Kurs mit Terminen in Bern und in Aarburg erfüllte vorher
 * den Kantonsfilter «Bern» über den Berner Termin und den Umkreis «50 km um
 * Zürich» über Aarburg — zwei verschiedene Orte, zusammen ein Treffer, den
 * niemand erwartet. Weil der Kanton am Punkt hängt, lässt sich das jetzt
 * punktweise prüfen.
 *
 * Der Datumsfilter ist bereits eingearbeitet: Die Punkte stammen aus den
 * Terminen, die zum gewählten Zeitraum passen (siehe collectLocationEntries).
 * Damit gehören Datum, Kanton und Umkreis zwingend zum selben Termin.
 */
export function courseWithinRadius(geoInfo, center, radiusKm, { cantons = [] } = {}) {
  if (!geoInfo || geoInfo.status !== 'located') return false;
  return geoInfo.points.some((point) => isWithinRadius(center, point, radiusKm)
    && pointMatchesCantons(point, cantons));
}

/**
 * Filtert Kurse auf den Umkreis — und NUR das.
 *
 * Die zurückgegebene Liste ist eine Teilfolge der Eingabe: gleiche relative
 * Reihenfolge, nur ohne die Kurse ausserhalb des Radius. Die Priorisierung
 * sortiert anschliessend unverändert weiter; die Entfernung geht in die
 * Sortierung nicht ein.
 *
 * Ist kein Ausgangsort, kein Radius oder noch keine Ortstabelle vorhanden,
 * wird die Eingabeliste unverändert zurückgegeben — der Filter ist dann aus.
 */
export function filterCoursesByRadius(courses, {
  center = null,
  radiusKm = 0,
  placesIndex = null,
  resolveGeo = null,
  dateFrom = '',
  dateTo = '',
  cantons = [],
} = {}) {
  if (!Array.isArray(courses)) return [];
  if (!center || !Number.isFinite(radiusKm) || radiusKm <= 0) return courses;
  if (!placesIndex && !resolveGeo) return courses;

  const resolve = resolveGeo || createGeoResolver(placesIndex, { dateFrom, dateTo });
  return courses.filter((course) => courseWithinRadius(resolve(course), center, radiusKm, { cantons }));
}

/**
 * Zählt, wie viele Kurse einer Liste gar nicht räumlich bewertbar sind.
 * Grundlage für den erklärenden Hinweis in der Oberfläche.
 */
export function countGeoStatuses(courses, resolveGeo) {
  const zaehler = { located: 0, online: 0, ausland: 0, unknown: 0 };
  if (!Array.isArray(courses) || !resolveGeo) return zaehler;
  courses.forEach((course) => {
    const status = resolveGeo(course)?.status || 'unknown';
    zaehler[status] = (zaehler[status] || 0) + 1;
  });
  return zaehler;
}

/**
 * Bündelt Kurse zu Kartenmarkern.
 *
 * Mehrere Kurse am gleichen Punkt werden zu EINEM Marker zusammengefasst. Die
 * Reihenfolge innerhalb eines Markers entspricht der Reihenfolge der
 * Eingabeliste — und die kommt bereits priorisiert aus der Ergebnisliste.
 *
 * @param {Array<object>} courses - bereits priorisierte Trefferliste
 * @param {Function} resolveGeo
 * @param {{center?: object, radiusKm?: number}} [options] - optional: nur Punkte im Umkreis
 */
export function buildMapMarkers(courses, resolveGeo, { center = null, radiusKm = 0, cantons = [] } = {}) {
  const marker = new Map();
  if (!Array.isArray(courses) || !resolveGeo) return [];

  const radiusAktiv = Boolean(center) && Number.isFinite(radiusKm) && radiusKm > 0;

  courses.forEach((course) => {
    const info = resolveGeo(course);
    if (!info || info.status !== 'located') return;
    info.points.forEach((point) => {
      // Bei aktivem Umkreis zeigt die Karte nur Orte, die ALLE aktiven
      // Bedingungen erfüllen — sonst erschiene ein Marker an einem Ort, über
      // den der Kurs gar nicht in die Liste gekommen ist.
      if (radiusAktiv && !isWithinRadius(center, point, radiusKm)) return;
      if (radiusAktiv && !pointMatchesCantons(point, cantons)) return;
      const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
      const vorhanden = marker.get(key);
      if (vorhanden) {
        if (!vorhanden.courses.some((c) => c.course.id === course.id)) {
          vorhanden.courses.push({ course, label: point.label, approximate: point.approximate });
        }
        return;
      }
      marker.set(key, {
        key,
        lat: point.lat,
        lng: point.lng,
        courses: [{ course, label: point.label, approximate: point.approximate }],
      });
    });
  });

  return [...marker.values()];
}
