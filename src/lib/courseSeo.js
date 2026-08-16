/**
 * Die EINZIGE Quelle der Wahrheit für die SEO-Daten einer Kursdetailseite.
 *
 * Vor diesem Modul lag die komplette Berechnung (Title, Meta Description,
 * Open Graph, Course-/EducationEvent-/BreadcrumbList-JSON-LD) inline im
 * useEffect von DetailView.jsx. Sie war damit ausschliesslich nach der
 * React-Hydration verfügbar — der erste HTTP-Response enthielt nur die
 * generische SPA-Shell (SEO-Blocker 2 des technischen Audits).
 *
 * Die Funktionen hier sind bewusst rein und abhängigkeitsfrei (kein React,
 * kein `import.meta.env`, kein DOM, kein lucide-react). Dadurch laufen sie
 * unverändert im Browser-Bundle UND im Node-Build (scripts/prerender-static.mjs).
 * Die Basis-URL wird deshalb immer hereingereicht — niemals aus
 * `window.location.origin` abgeleitet (siehe courseUrl.js).
 *
 * Kategorie-Helfer kommen aus ./courseCategory.js (abhängigkeitsfrei), NICHT
 * aus ./courseMetadata.js — letzteres zieht über ./constants lucide-react nach
 * und ist im Node-Kontext nicht ladbar.
 */

import { buildCanonicalCourseUrl, getCanonicalCourseTopicSlug, slugify } from './courseUrl.js';
import { getPrimaryCategoryLabel } from './courseCategory.js';

/** Standard-OG-Bild (relativ zur Site-Basis-URL). */
export const DEFAULT_OG_IMAGE_PATH = '/og-default.png';

/** Maximale Länge der Meta Description (identisch zur bisherigen DetailView-Logik). */
const META_DESCRIPTION_MAX = 160;

function normalizeBase(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '');
}

/** Ortsbezeichnung für Title/Description/Schema — `canton` mit Schweiz-Fallback. */
export function getCourseLocationLabel(course) {
  return course?.canton || 'Schweiz';
}

/**
 * Meta Description eines Kurses (max. 160 Zeichen inkl. Auslassungspunkten).
 *
 * @param {object} course
 * @returns {string}
 */
export function buildCourseMetaDescription(course) {
  if (!course) return '';
  const locationLabel = getCourseLocationLabel(course);
  const raw = `${course.title} in ${locationLabel} – ${(course.description || '').replace(/\s+/g, ' ').trim()}`;
  return raw.length > META_DESCRIPTION_MAX
    ? `${raw.substring(0, META_DESCRIPTION_MAX - 3)}...`
    : raw;
}

/**
 * Alle head-Metadaten einer Kursdetailseite.
 *
 * Wird sowohl von DetailView.jsx (Hydration) als auch vom Build-Prerender
 * genutzt — beide sehen damit garantiert dieselben Werte.
 *
 * @param {object} course
 * @param {string} baseUrl - Absolute Basis-URL (zentrale Konfiguration)
 * @returns {{
 *   locationLabel: string, canonicalUrl: string, title: string,
 *   description: string, ogTitle: string, ogDescription: string,
 *   ogUrl: string, ogImage: string, ogType: string
 * }}
 */
export function buildCourseSeo(course, baseUrl) {
  const base = normalizeBase(baseUrl);
  const locationLabel = getCourseLocationLabel(course);
  const canonicalUrl = buildCanonicalCourseUrl(course, base);
  const description = buildCourseMetaDescription(course);

  return {
    locationLabel,
    canonicalUrl,
    title: `${course?.title} in ${locationLabel} | KursNavi`,
    description,
    // Bewusst OHNE «| KursNavi»: og:site_name trägt die Marke bereits.
    ogTitle: `${course?.title} in ${locationLabel}`,
    ogDescription: description,
    ogUrl: canonicalUrl,
    ogImage: course?.image_url || `${base}${DEFAULT_OG_IMAGE_PATH}`,
    ogType: 'website',
  };
}

/**
 * Normalisiert die Terminliste eines Kurses auf die Form, die die Schemas
 * benötigen. Ein Kurs ohne `course_events` fällt auf sein `start_date` zurück.
 */
function collectRawEvents(course) {
  if (Array.isArray(course?.course_events) && course.course_events.length > 0) {
    return course.course_events;
  }
  if (course?.start_date) {
    return [{ start_date: course.start_date, max_participants: 0, bookings: [] }];
  }
  return [];
}

/** Gebuchte Plätze eines Termins — tolerant gegenüber allen Embed-Formen. */
function bookedCount(event) {
  if (Array.isArray(event?.bookings)) {
    return event.bookings[0]?.count ?? event.bookings.length;
  }
  return event?.bookings?.count || 0;
}

/**
 * Verfügbarkeit für schema.org/Offer.
 *
 * SoldOut nur, wenn ALLE nicht stornierten Termine mit Teilnehmerlimit voll
 * sind. Anonyme Leser (Besucher wie Build-Prerender) sehen wegen RLS keine
 * Buchungen — für sie ist das Ergebnis immer InStock, exakt wie bisher.
 */
function resolveAvailability(rawEvents) {
  const activeEvents = rawEvents.filter((ev) => !ev.cancelled_at);
  const allFull = activeEvents.length > 0 && activeEvents.every((ev) => {
    const max = ev.max_participants || 0;
    if (max === 0) return false; // Unbegrenzt
    return bookedCount(ev) >= max;
  });
  return allFull ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
}

/**
 * Strukturierte Daten einer Kursdetailseite.
 *
 * Bewusst DREI getrennte Schemas — der frühere Course/EducationEvent-Hybrid
 * wurde bereits behoben und darf nicht wieder zusammengeführt werden:
 *   - Course           — immer
 *   - EducationEvent   — nur bei einem laufenden/zukünftigen, nicht stornierten
 *                        Termin mit konkretem startDate
 *   - BreadcrumbList   — immer
 *
 * @param {object} course
 * @param {string} baseUrl
 * @param {object} [options]
 * @param {Date} [options.now=new Date()] - Referenzzeitpunkt (injizierbar für Tests)
 * @returns {{course: object, educationEvent: object|null, breadcrumb: object}}
 */
export function buildCourseStructuredData(course, baseUrl, { now = new Date() } = {}) {
  const base = normalizeBase(baseUrl);
  const seo = buildCourseSeo(course, base);
  const canonicalUrl = seo.canonicalUrl;
  const locationLabel = seo.locationLabel;

  const priceVal = Number(course?.price);
  const isPlatform = course?.booking_type === 'platform';
  const hasValidPrice = !Number.isNaN(priceVal) && (priceVal > 0 || isPlatform);

  const rawEvents = collectRawEvents(course);
  const availability = resolveAvailability(rawEvents);
  const areaLabel = getPrimaryCategoryLabel(course) || null;

  // --- Course ---------------------------------------------------------------
  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course?.title,
    description: course?.description,
    provider: {
      '@type': 'Organization',
      name: course?.instructor_name,
      sameAs: `${base}/teacher/${course?.user_id}`,
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CHF',
      availability,
      url: canonicalUrl,
    },
  };

  if (hasValidPrice) courseSchema.offers.price = priceVal;

  if (course?.session_length) {
    courseSchema.timeRequired = course.session_count
      ? `${course.session_count}x ${course.session_length}`
      : course.session_length;
  }

  if (areaLabel) courseSchema.educationalLevel = areaLabel;

  // --- EducationEvent -------------------------------------------------------
  // Ein Termin gilt als aktuell, solange er nicht beendet ist:
  // end_date >= now, oder (ohne end_date) start_date >= now.
  const activeSchemaEvents = rawEvents.filter((ev) => !ev.cancelled_at && ev.start_date);
  const nextSchemaEvent = activeSchemaEvents.find((ev) => {
    if (ev.end_date) {
      const end = new Date(ev.end_date);
      return !Number.isNaN(end.getTime()) && end >= now;
    }
    const start = new Date(ev.start_date);
    return !Number.isNaN(start.getTime()) && start >= now;
  });

  let educationEvent = null;
  if (nextSchemaEvent) {
    educationEvent = {
      '@context': 'https://schema.org',
      '@type': 'EducationEvent',
      name: course?.title,
      description: course?.description,
      startDate: nextSchemaEvent.start_date,
      organizer: {
        '@type': 'Organization',
        name: course?.instructor_name,
        sameAs: `${base}/teacher/${course?.user_id}`,
      },
      location: {
        '@type': 'Place',
        name: course?.address || course?.city || locationLabel,
        address: {
          '@type': 'PostalAddress',
          addressRegion: locationLabel,
          addressCountry: 'CH',
        },
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'CHF',
        availability,
        url: canonicalUrl,
      },
    };

    if (nextSchemaEvent.end_date) educationEvent.endDate = nextSchemaEvent.end_date;
    if (hasValidPrice) educationEvent.offers.price = priceVal;

    const futureSchemaEvents = activeSchemaEvents.filter((ev) => {
      const start = new Date(ev.start_date);
      return !Number.isNaN(start.getTime()) && start >= now;
    });
    if (futureSchemaEvents.length > 1) {
      educationEvent.eventSchedule = futureSchemaEvents.map((ev) => {
        const entry = {
          '@type': 'Schedule',
          startDate: ev.start_date,
          scheduleTimezone: 'Europe/Zurich',
        };
        if (ev.end_date) entry.endDate = ev.end_date;
        return entry;
      });
    }
  }

  // --- BreadcrumbList -------------------------------------------------------
  const topicSlug = getCanonicalCourseTopicSlug(course);
  const locSlug = slugify(course?.canton) || 'schweiz';

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: base },
      {
        '@type': 'ListItem',
        position: 2,
        name: areaLabel || 'Kurse',
        item: `${base}/courses/${topicSlug}/${locSlug}/`,
      },
      { '@type': 'ListItem', position: 3, name: course?.title },
    ],
  };

  return { course: courseSchema, educationEvent, breadcrumb };
}

/**
 * Dieselben Schemas als flache Liste — in genau der Reihenfolge, in der
 * DetailView.jsx sie in den <head> hängt (Course, EducationEvent, Breadcrumb).
 *
 * @param {object} course
 * @param {string} baseUrl
 * @param {object} [options]
 * @returns {object[]}
 */
export function buildCourseJsonLdList(course, baseUrl, options) {
  const { course: courseSchema, educationEvent, breadcrumb } =
    buildCourseStructuredData(course, baseUrl, options);
  return educationEvent
    ? [courseSchema, educationEvent, breadcrumb]
    : [courseSchema, breadcrumb];
}
