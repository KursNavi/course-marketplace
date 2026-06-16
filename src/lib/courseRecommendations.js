/**
 * courseRecommendations.js
 *
 * Klare, segmentbasierte Relevanzlogik für ähnliche Kurse auf der Kursdetailseite.
 *
 * Prioritäten:
 * 1. Aktuellen Kurs ausschliessen
 * 2. Nur veröffentlichte Kurse (Filterung erfolgt vor Übergabe via publishedCourses)
 * 3. Hartes Segment-Ausschluss: kinder ↔ professionell werden nie gemischt
 * 4. Gleicher Segmenttyp bevorzugen
 * 5. Gleicher Bereich stark gewichten
 * 6. Gleiches Spezialgebiet zusätzlich gewichten
 * 7. Online-Präferenz bei Online-Kursen
 * 8. Gleicher Kanton bei Präsenzkursen
 * 9. Zukünftige Termine bevorzugen
 * 10. is_prio nur als leichter Bonus bei bereits passenden Kursen
 */

import { getPrimaryCategory, getNormalizedDeliveryTypes, normalizeCategoryType } from './courseMetadata';

// Segmente, die niemals zusammen empfohlen werden sollen
const SEGMENT_HARD_EXCLUSIONS = {
    kinder: ['professionell'],
    professionell: ['kinder'],
};

function getCourseType(course) {
    const primary = getPrimaryCategory(course);
    return normalizeCategoryType(primary?.category_type || course?.category_type) || null;
}

function getCourseArea(course) {
    const primary = getPrimaryCategory(course);
    return primary?.category_area || course?.category_area || null;
}

function getCourseSpecialty(course) {
    const primary = getPrimaryCategory(course);
    return primary?.category_specialty || course?.category_specialty || null;
}

/**
 * Gibt true zurück, wenn Kandidat-Typ und aktueller Typ inkompatibel sind
 * (z.B. kinder und professionell sollen nie gemischt werden).
 */
export function isHardSegmentMismatch(candidateType, currentType) {
    if (!candidateType || !currentType) return false;
    const excluded = SEGMENT_HARD_EXCLUSIONS[currentType];
    return excluded ? excluded.includes(candidateType) : false;
}

/**
 * Gibt true zurück, wenn ein Kurs als Online-Kurs erkennbar ist.
 */
export function isCourseOnline(course) {
    if (!course) return false;
    const types = getNormalizedDeliveryTypes(course);
    if (types.includes('online_live') || types.includes('online')) return true;
    if (String(course.canton || '').toLowerCase() === 'online') return true;
    // Events prüfen: online-Event hat kein canton oder location='Online'
    if (Array.isArray(course.course_events)) {
        const hasOnlineEvent = course.course_events.some(
            e => !e.canton || String(e.location || '').toLowerCase() === 'online'
        );
        const hasPresenceEvent = course.course_events.some(
            e => e.canton && String(e.location || '').toLowerCase() !== 'online'
        );
        if (hasOnlineEvent && !hasPresenceEvent) return true;
    }
    return false;
}

/**
 * Gibt true zurück, wenn ein Kurs mindestens einen zukünftigen Termin hat.
 */
export function hasFutureEvent(course) {
    if (!Array.isArray(course?.course_events)) return false;
    const now = new Date();
    return course.course_events.some(e => {
        if (e.cancelled_at) return false;
        // Laufende Mehrtages-Events: end_date in der Zukunft zählt
        if (e.end_date && new Date(e.end_date) > now) return true;
        if (e.start_date && new Date(e.start_date) > now) return true;
        return false;
    });
}

/**
 * Berechnet einen Relevanz-Score für einen Kandidaten-Kurs relativ zum aktuellen Kurs.
 *
 * Scoring:
 * +40  Gleicher Segmenttyp (kinder / privat / professionell)
 * +30  Gleicher Bereich (category_area)
 * +15  Gleiches Spezialgebiet (category_specialty)
 * +10  Titel-Wort-Überschneidung (max, bei ≥5 gemeinsamen Wörtern)
 * +5   Zukünftiger Termin vorhanden
 * -3   Kein zukünftiger Termin UND kein flexibles Buchungsformat
 * +5   Beide Online-Kurse
 * +5   Gleicher Kanton (nur bei Präsenzkursen)
 * +3   is_prio (leichter Bonus, nur bei sonst passenden Kursen relevant)
 */
export function getRecommendationScore(candidate, currentCourse) {
    if (!candidate || !currentCourse) return 0;

    const currentType = getCourseType(currentCourse);
    const currentArea = getCourseArea(currentCourse);
    const currentSpecialty = getCourseSpecialty(currentCourse);

    const candType = getCourseType(candidate);
    const candArea = getCourseArea(candidate);
    const candSpecialty = getCourseSpecialty(candidate);

    let score = 0;

    // Gleicher Segmenttyp
    if (currentType && candType && candType === currentType) score += 40;

    // Gleicher Bereich
    if (currentArea && candArea && candArea === currentArea) score += 30;

    // Gleiches Spezialgebiet
    if (currentSpecialty && candSpecialty && candSpecialty === currentSpecialty) score += 15;

    // Titel-Wort-Überschneidung (nur Wörter mit mehr als 3 Zeichen)
    const currentWords = (currentCourse.title || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3);
    const candidateWords = (candidate.title || '').toLowerCase().split(/\s+/);
    const overlap = candidateWords.filter(w => currentWords.includes(w)).length;
    score += Math.min(10, overlap * 2);

    // Zukünftige Termine
    const isFlexible = candidate.booking_type === 'lead' || candidate.booking_type === 'platform_flex';
    if (hasFutureEvent(candidate)) {
        score += 5;
    } else if (!isFlexible) {
        score -= 3; // Kurs ohne zukünftige Termine und ohne flexibles Format: leichte Strafe
    }

    // Online-Übereinstimmung
    const currentIsOnline = isCourseOnline(currentCourse);
    const candIsOnline = isCourseOnline(candidate);
    if (currentIsOnline && candIsOnline) score += 5;

    // Gleicher Kanton (nur bei Präsenzkursen)
    if (!currentIsOnline && !candIsOnline && currentCourse.canton && candidate.canton === currentCourse.canton) {
        score += 5;
    }

    // is_prio: leichter Bonus (kein primärer Filter)
    if (candidate.is_prio) score += 3;

    return score;
}

/**
 * Gibt eine priorisierte Liste ähnlicher Kurse zurück.
 *
 * @param {object} currentCourse  - Der aktuell angezeigte Kurs
 * @param {Array}  allCourses     - Alle verfügbaren (veröffentlichten) Kurse
 * @param {object} options
 * @param {number} options.maxResults - Max. Anzahl Empfehlungen (Default: 4)
 * @returns {Array} Sortierte Liste relevanter Kurse (ohne den aktuellen Kurs)
 */
export function getRelatedCourses(currentCourse, allCourses, { maxResults = 4 } = {}) {
    if (!currentCourse || !Array.isArray(allCourses)) return [];

    const currentType = getCourseType(currentCourse);

    // 1. Aktuellen Kurs und harte Segment-Mismatches ausschliessen
    const candidates = allCourses
        .filter(c => c.id !== currentCourse.id)
        .filter(c => !isHardSegmentMismatch(getCourseType(c), currentType));

    // 2. Alle Kandidaten mit Relevanz-Score versehen und sortieren
    const scored = candidates
        .map(c => ({ course: c, score: getRecommendationScore(c, currentCourse) }))
        .sort((a, b) => b.score - a.score);

    // 3. Gleiche Segment-Kurse haben immer Vorrang vor anderen (auch bei niedrigerem Score)
    const sameSegment = scored.filter(
        ({ course: c }) => currentType && getCourseType(c) === currentType
    );
    const crossSegment = scored.filter(
        ({ course: c, score }) => !(currentType && getCourseType(c) === currentType) && score > 0
    );

    // 4. Merge: gleicher Typ zuerst, dann Cross-Segment als Fallback, max. maxResults
    const merged = [...sameSegment, ...crossSegment].slice(0, maxResults);

    return merged.map(({ course }) => course);
}
