import { describe, it, expect } from 'vitest';
import {
    getRelatedCourses,
    getRecommendationScore,
    isHardSegmentMismatch,
    isCourseOnline,
    hasFutureEvent,
} from '../src/lib/courseRecommendations';

// Hilfsfunktion: Datum X Tage in der Zukunft / Vergangenheit
const daysFromNow = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

const makeCourse = (overrides = {}) => ({
    id: 'default-id',
    title: 'Testkurs',
    booking_type: 'lead',
    canton: 'Zürich',
    is_prio: false,
    all_categories: [],
    category_type: 'privat',
    category_area: 'sprachen_privat',
    category_specialty: null,
    course_events: [],
    ...overrides,
});

const withCategory = (type, area = null, specialty = null) => ({
    all_categories: [
        {
            category_type: type,
            category_area: area,
            category_specialty: specialty,
            is_primary: true,
        },
    ],
});

// --- isHardSegmentMismatch ---
describe('isHardSegmentMismatch', () => {
    it('returns true for kinder + professionell', () => {
        expect(isHardSegmentMismatch('professionell', 'kinder')).toBe(true);
    });

    it('returns true for professionell + kinder', () => {
        expect(isHardSegmentMismatch('kinder', 'professionell')).toBe(true);
    });

    it('returns false for privat + professionell', () => {
        expect(isHardSegmentMismatch('privat', 'professionell')).toBe(false);
    });

    it('returns false for privat + kinder', () => {
        expect(isHardSegmentMismatch('privat', 'kinder')).toBe(false);
    });

    it('returns false when one type is null', () => {
        expect(isHardSegmentMismatch(null, 'kinder')).toBe(false);
        expect(isHardSegmentMismatch('kinder', null)).toBe(false);
    });
});

// --- isCourseOnline ---
describe('isCourseOnline', () => {
    it('detects canton=Online as online course', () => {
        expect(isCourseOnline(makeCourse({ canton: 'Online' }))).toBe(true);
    });

    it('returns false for Zürich canton', () => {
        expect(isCourseOnline(makeCourse({ canton: 'Zürich' }))).toBe(false);
    });
});

// --- hasFutureEvent ---
describe('hasFutureEvent', () => {
    it('returns true when a future event exists', () => {
        const course = makeCourse({
            course_events: [{ start_date: daysFromNow(10), cancelled_at: null }],
        });
        expect(hasFutureEvent(course)).toBe(true);
    });

    it('returns false when all events are in the past', () => {
        const course = makeCourse({
            course_events: [{ start_date: daysFromNow(-10), end_date: daysFromNow(-5), cancelled_at: null }],
        });
        expect(hasFutureEvent(course)).toBe(false);
    });

    it('returns false for empty events', () => {
        expect(hasFutureEvent(makeCourse({ course_events: [] }))).toBe(false);
    });

    it('ignores cancelled events', () => {
        const course = makeCourse({
            course_events: [{ start_date: daysFromNow(5), cancelled_at: '2024-01-01' }],
        });
        expect(hasFutureEvent(course)).toBe(false);
    });
});

// --- getRecommendationScore ---
describe('getRecommendationScore', () => {
    const current = makeCourse({
        id: 'current',
        ...withCategory('privat', 'sprachen_privat', 'englisch'),
        canton: 'Bern',
    });

    it('scores same type + same area highest', () => {
        const candidate = makeCourse({
            id: 'a',
            ...withCategory('privat', 'sprachen_privat', null),
        });
        const score = getRecommendationScore(candidate, current);
        expect(score).toBeGreaterThanOrEqual(70); // 40 (type) + 30 (area)
    });

    it('same type only scores less than same type + area', () => {
        const sameTypeOnly = makeCourse({ id: 'b', ...withCategory('privat', 'musik_privat') });
        const sameTypeAndArea = makeCourse({ id: 'c', ...withCategory('privat', 'sprachen_privat') });
        expect(getRecommendationScore(sameTypeAndArea, current)).toBeGreaterThan(
            getRecommendationScore(sameTypeOnly, current)
        );
    });

    it('same specialty adds extra score', () => {
        const withSpecialty = makeCourse({ id: 'd', ...withCategory('privat', 'sprachen_privat', 'englisch') });
        const withoutSpecialty = makeCourse({ id: 'e', ...withCategory('privat', 'sprachen_privat', null) });
        expect(getRecommendationScore(withSpecialty, current)).toBeGreaterThan(
            getRecommendationScore(withoutSpecialty, current)
        );
    });

    it('is_prio adds only a small bonus', () => {
        const base = makeCourse({ id: 'f', ...withCategory('privat', 'sprachen_privat'), is_prio: false });
        const prio = makeCourse({ id: 'g', ...withCategory('privat', 'sprachen_privat'), is_prio: true });
        const diff = getRecommendationScore(prio, current) - getRecommendationScore(base, current);
        // is_prio adds exactly 3 points
        expect(diff).toBe(3);
    });

    it('is_prio alone (different type) does not outscore a same-segment match', () => {
        const prioWrongType = makeCourse({ id: 'h', ...withCategory('professionell', 'xyz'), is_prio: true });
        const normalSameType = makeCourse({ id: 'i', ...withCategory('privat', 'musik_privat'), is_prio: false });
        expect(getRecommendationScore(normalSameType, current)).toBeGreaterThan(
            getRecommendationScore(prioWrongType, current)
        );
    });

    it('future event adds a small bonus', () => {
        const withEvent = makeCourse({
            id: 'j',
            ...withCategory('privat', 'sprachen_privat'),
            booking_type: 'platform',
            course_events: [{ start_date: daysFromNow(10), cancelled_at: null }],
        });
        const withoutEvent = makeCourse({
            id: 'k',
            ...withCategory('privat', 'sprachen_privat'),
            booking_type: 'platform',
            course_events: [],
        });
        expect(getRecommendationScore(withEvent, current)).toBeGreaterThan(
            getRecommendationScore(withoutEvent, current)
        );
    });
});

// --- getRelatedCourses ---
describe('getRelatedCourses', () => {
    const beruflichCourse = makeCourse({
        id: 'current-beruflich',
        title: 'Excel Kurs für Profis',
        ...withCategory('professionell', 'it_business'),
        canton: 'Zürich',
    });

    const kinderCourse = makeCourse({
        id: 'kinder-1',
        title: 'Kindertanzen',
        ...withCategory('kinder', 'tanz_kinder'),
    });

    const beruflichCandidate1 = makeCourse({
        id: 'beruflich-1',
        title: 'PowerPoint Workshop',
        ...withCategory('professionell', 'it_business'),
    });

    const beruflichCandidate2 = makeCourse({
        id: 'beruflich-2',
        title: 'Word Grundlagen',
        ...withCategory('professionell', 'it_business'),
        is_prio: true,
    });

    const privatCandidate = makeCourse({
        id: 'privat-1',
        title: 'Malkurs',
        ...withCategory('privat', 'kunst_privat'),
    });

    const allCourses = [beruflichCourse, kinderCourse, beruflichCandidate1, beruflichCandidate2, privatCandidate];

    it('excludes the current course from recommendations', () => {
        const results = getRelatedCourses(beruflichCourse, allCourses);
        const ids = results.map(c => c.id);
        expect(ids).not.toContain('current-beruflich');
    });

    it('does not recommend kinder courses for a beruflich course', () => {
        const results = getRelatedCourses(beruflichCourse, allCourses);
        const ids = results.map(c => c.id);
        expect(ids).not.toContain('kinder-1');
    });

    it('does not recommend beruflich courses for a kinder course', () => {
        const allWithKinder = [...allCourses];
        const results = getRelatedCourses(kinderCourse, allWithKinder);
        const ids = results.map(c => c.id);
        expect(ids).not.toContain('current-beruflich');
        expect(ids).not.toContain('beruflich-1');
        expect(ids).not.toContain('beruflich-2');
    });

    it('same-segment courses appear before cross-segment courses', () => {
        const results = getRelatedCourses(beruflichCourse, allCourses);
        const beruflichIdx = results.findIndex(c => c.id === 'beruflich-1' || c.id === 'beruflich-2');
        const privatIdx = results.findIndex(c => c.id === 'privat-1');
        if (beruflichIdx !== -1 && privatIdx !== -1) {
            expect(beruflichIdx).toBeLessThan(privatIdx);
        }
    });

    it('is_prio only boosts within same-segment candidates', () => {
        const results = getRelatedCourses(beruflichCourse, allCourses);
        const beruflichIds = results
            .filter(c => c.id === 'beruflich-1' || c.id === 'beruflich-2')
            .map(c => c.id);
        if (beruflichIds.length >= 2) {
            // beruflich-2 (is_prio=true) should appear before beruflich-1
            expect(results.findIndex(c => c.id === 'beruflich-2')).toBeLessThan(
                results.findIndex(c => c.id === 'beruflich-1')
            );
        }
    });

    it('returns empty array when no courses available', () => {
        expect(getRelatedCourses(beruflichCourse, [])).toEqual([]);
    });

    it('returns empty array when currentCourse is null', () => {
        expect(getRelatedCourses(null, allCourses)).toEqual([]);
    });

    it('does not crash when course has no categories', () => {
        const noCatCourse = makeCourse({
            id: 'no-cat',
            title: 'Kurs ohne Kategorie',
            all_categories: [],
            category_type: null,
            category_area: null,
        });
        expect(() => getRelatedCourses(noCatCourse, allCourses)).not.toThrow();
    });

    it('respects maxResults option', () => {
        const manyCourses = Array.from({ length: 20 }, (_, i) => makeCourse({
            id: `c-${i}`,
            title: `Kurs ${i}`,
            ...withCategory('privat', 'sprachen_privat'),
        }));
        const current = makeCourse({ id: 'cur', ...withCategory('privat', 'sprachen_privat') });
        const results = getRelatedCourses(current, [current, ...manyCourses], { maxResults: 3 });
        expect(results.length).toBeLessThanOrEqual(3);
    });
});
