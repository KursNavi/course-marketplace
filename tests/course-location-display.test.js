/**
 * Regression tests for course location display logic in DetailView.
 *
 * Reproduces the bug where a course with concrete events (events mode)
 * showed a stale course_location (e.g. old Bern address) instead of
 * the actual event location (e.g. Braunwald).
 *
 * The logic under test mirrors the IIFE in DetailView.jsx around the
 * MapPin location block.
 */
import { describe, it, expect } from 'vitest';

/**
 * Mirrors the location display logic from DetailView.jsx (MapPin block).
 * Kept in sync manually — update when the component logic changes.
 */
function getCourseLocationText(course) {
    const hasConcreteEvents = Array.isArray(course.course_events) &&
        course.course_events.some(ev => ev.start_date);
    let locationText;
    if (!hasConcreteEvents) {
        // Locations mode: use course_locations as authoritative source
        const presenceLocs = Array.isArray(course.course_locations)
            ? course.course_locations
                .filter(l => l.location_type === 'presence')
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            : [];
        if (presenceLocs.length > 1) {
            const cantons = [...new Set(presenceLocs.map(l => l.canton).filter(Boolean))];
            locationText = cantons.join(', ');
        } else if (presenceLocs.length === 1) {
            const loc = presenceLocs[0];
            locationText = [loc.street, loc.city].filter(Boolean).join(', ') || loc.canton || '';
        }
    }
    // Fall back to courses-table fields (set correctly from events during save)
    if (!locationText) locationText = course.address || course.city || course.canton || '';
    return locationText || '';
}

describe('course location display logic (DetailView)', () => {

    it('REGRESSION: shows event city for events-mode course, ignoring stale course_locations', () => {
        // Sprachcamp Braunwald scenario:
        // - course was previously a Bern lead course → old course_location exists
        // - teacher switched to platform + concrete events in Braunwald
        // - course_locations was NOT cleared (old bug) → stale Bern entry remains
        const course = {
            booking_type: 'platform',
            address: 'Braunwald',
            city: null,
            canton: 'Glarus',
            course_events: [
                { id: 1, start_date: '2026-06-28T00:00:00+00', location: 'Braunwald', canton: 'Glarus' },
                { id: 2, start_date: '2026-09-27T00:00:00+00', location: 'Braunwald', canton: 'Glarus' },
            ],
            // Stale location from before the events-mode switch
            course_locations: [
                { location_type: 'presence', street: 'Stöckackerstrasse 93', city: 'Bern', canton: 'Bern', sort_order: 0 }
            ]
        };

        const result = getCourseLocationText(course);

        expect(result).toBe('Braunwald');
        expect(result).not.toContain('Stöckackerstrasse');
        expect(result).not.toContain('Bern');
    });

    it('REGRESSION: does not produce mixed address (street from old location + city from event)', () => {
        // Scenario: stale location had street "Stöckackerstrasse 93"
        // event has city "Braunwald" — must NOT combine to "Stöckackerstrasse 93 Braunwald"
        const course = {
            booking_type: 'lead',
            address: 'Braunwald',
            city: null,
            canton: 'Glarus',
            course_events: [
                { id: 1, start_date: '2026-09-28T00:00:00+00', location: 'Braunwald', canton: 'Glarus' }
            ],
            course_locations: [
                // Stale mirror with street (the old bug before Fix C in TeacherForm)
                { location_type: 'presence', street: 'Stöckackerstrasse 93', city: 'Braunwald', canton: 'Glarus', sort_order: 0 }
            ]
        };

        const result = getCourseLocationText(course);

        expect(result).not.toContain('Stöckackerstrasse');
        expect(result).not.toContain('93');
        // Should show either Braunwald (from course.address) since events are present
        expect(result).toBe('Braunwald');
    });

    it('shows full address for locations-mode course (no events)', () => {
        const course = {
            booking_type: 'lead',
            address: 'Zürich',
            city: 'Zürich',
            canton: 'Zürich',
            course_events: [],
            course_locations: [
                { location_type: 'presence', street: 'Bahnhofstrasse 1', city: 'Zürich', canton: 'Zürich', sort_order: 0 }
            ]
        };

        expect(getCourseLocationText(course)).toBe('Bahnhofstrasse 1, Zürich');
    });

    it('shows cantons joined for multi-location course (no events)', () => {
        const course = {
            booking_type: 'lead',
            address: 'Bern',
            city: 'Bern',
            canton: 'Bern',
            course_events: [],
            course_locations: [
                { location_type: 'presence', street: null, city: 'Bern', canton: 'Bern', sort_order: 0 },
                { location_type: 'presence', street: null, city: 'Zürich', canton: 'Zürich', sort_order: 1 }
            ]
        };

        expect(getCourseLocationText(course)).toBe('Bern, Zürich');
    });

    it('falls back to course.canton when no locations and no events', () => {
        const course = {
            booking_type: 'lead',
            address: null,
            city: null,
            canton: 'Aargau',
            course_events: null,
            course_locations: []
        };

        expect(getCourseLocationText(course)).toBe('Aargau');
    });

    it('correctly shows city for events-mode lead course after fix (no stale data)', () => {
        // After the fix: course_locations mirrored from events, no street
        const course = {
            booking_type: 'lead',
            address: 'Braunwald',
            city: null,
            canton: 'Glarus',
            course_events: [
                { id: 1, start_date: '2026-06-28T00:00:00+00', location: 'Braunwald', canton: 'Glarus' }
            ],
            course_locations: [
                // Correctly mirrored (no street) after the TeacherForm fix
                { location_type: 'presence', street: null, city: 'Braunwald', canton: 'Glarus', sort_order: 0 }
            ]
        };

        const result = getCourseLocationText(course);
        expect(result).toBe('Braunwald');
    });

    it('ignores online course_locations for main location display (events mode)', () => {
        const course = {
            booking_type: 'lead',
            address: 'Online',
            city: null,
            canton: null,
            course_events: [
                { id: 1, start_date: '2026-07-01T00:00:00+00', location: 'Online', canton: 'Online' }
            ],
            course_locations: []
        };

        const result = getCourseLocationText(course);
        expect(result).toBe('Online');
    });
});
