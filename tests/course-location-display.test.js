/**
 * Regression tests for course location display logic in DetailView.
 *
 * Reproduces the bug where a course with concrete events (events mode)
 * showed a stale course_location (e.g. old Bern address) instead of
 * the actual event location (e.g. Braunwald).
 *
 * The logic under test mirrors the IIFE in DetailView.jsx around the
 * MapPin location block, and the locationLabel logic in the lead events list.
 */
import { describe, it, expect } from 'vitest';

/** Mirrors CANTON_ABBR from constants.js */
const CANTON_ABBR = {
  "Aargau": "AG", "Appenzell AI": "AI", "Appenzell AR": "AR",
  "Basel-Landschaft": "BL", "Basel-Stadt": "BS", "Bern": "BE",
  "Fribourg": "FR", "Genève": "GE", "Glarus": "GL", "Graubünden": "GR",
  "Jura": "JU", "Liechtenstein": "FL", "Luzern": "LU", "Neuchâtel": "NE",
  "Nidwalden": "NW", "Obwalden": "OW", "Schaffhausen": "SH", "Schwyz": "SZ",
  "Solothurn": "SO", "St. Gallen": "SG", "Thurgau": "TG", "Ticino": "TI",
  "Uri": "UR", "Valais": "VS", "Vaud": "VD", "Zug": "ZG", "Zürich": "ZH",
};

/** Mirrors formatLocationWithCanton from constants.js */
function formatLocationWithCanton({ street, city, canton } = {}) {
  const abbr = canton ? CANTON_ABBR[canton] : undefined;
  const parts = [street, city].filter(Boolean);
  if (parts.length === 0) return abbr || canton || '';
  const base = parts.join(', ');
  return abbr ? `${base} (${abbr})` : (canton ? `${base}, ${canton}` : base);
}

/** Mirrors extractCity helper from DetailView.jsx */
function extractCity(loc) {
    if (!loc) return '';
    const idx = loc.lastIndexOf(',');
    return idx !== -1 ? loc.substring(idx + 1).trim() : loc.trim();
}

/**
 * Mirrors the location display logic from DetailView.jsx (MapPin block).
 * Kept in sync manually — update when the component logic changes.
 */
function getCourseLocationText(course) {
    const presenceEvents = Array.isArray(course.course_events)
        ? course.course_events.filter(ev =>
            ev.start_date && ev.canton &&
            ev.canton !== 'Online' && ev.canton !== 'Ausland')
        : [];

    let locationText;
    if (presenceEvents.length > 0) {
        // Events mode: derive from course_events (authoritative)
        const uniqueCantons = [...new Set(presenceEvents.map(ev => ev.canton).filter(Boolean))];
        if (uniqueCantons.length === 1) {
            const city = extractCity(presenceEvents[0].location);
            const abbr = CANTON_ABBR[uniqueCantons[0]];
            locationText = city
                ? (abbr ? `${city} (${abbr})` : city)
                : (abbr || uniqueCantons[0]);
        } else {
            locationText = uniqueCantons.map(c => CANTON_ABBR[c] || c).join(', ');
        }
    } else if (!Array.isArray(course.course_events) || course.course_events.length === 0) {
        // Locations mode: use course_locations as authoritative source
        const presenceLocs = Array.isArray(course.course_locations)
            ? course.course_locations
                .filter(l => l.location_type === 'presence')
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            : [];
        if (presenceLocs.length > 1) {
            const cantons = [...new Set(presenceLocs.map(l => l.canton).filter(Boolean))];
            locationText = cantons.map(c => CANTON_ABBR[c] || c).join(', ');
        } else if (presenceLocs.length === 1) {
            const loc = presenceLocs[0];
            locationText = formatLocationWithCanton({ street: loc.street, city: loc.city, canton: loc.canton });
        }
    }
    // Final fallback
    if (!locationText) locationText = course.address || course.city || (course.canton ? (CANTON_ABBR[course.canton] || course.canton) : '') || '';
    return locationText || '';
}

/**
 * Mirrors the locationLabel logic in the lead events list (DetailView.jsx).
 */
function getEventLocationLabel(ev) {
    const rawLoc = ev.location || '';
    const commaIdx = rawLoc.lastIndexOf(',');
    const evCity = commaIdx !== -1
        ? rawLoc.substring(commaIdx + 1).trim()
        : rawLoc.trim();
    const evAbbr = ev.canton && ev.canton !== 'Online' && ev.canton !== 'Ausland'
        ? CANTON_ABBR[ev.canton] : undefined;
    return evCity
        ? (evAbbr ? `${evCity} (${evAbbr})` : evCity)
        : (evAbbr || ev.canton || '');
}

describe('getCourseLocationText — main location block (DetailView MapPin)', () => {

    it('REGRESSION: Sprachcamp Braunwald — zeigt Braunwald (GL), nicht alten Berner Hauptstandort', () => {
        // Kurs war früher ein Lead-Kurs in Bern → alte course_location + stale courses.address = "3018 Bern"
        // Dann wurden Events in Braunwald/Glarus gespeichert (location = "Stöckarkerstrasse 93, Braunwald")
        const course = {
            booking_type: 'lead',
            address: '3018 Bern',    // stale — nie aktualisiert
            city: null,
            canton: 'Bern',          // stale
            course_events: [
                { id: 1, start_date: '2026-06-28T00:00:00+00', location: 'Stöckarkerstrasse 93, Braunwald', canton: 'Glarus' },
                { id: 2, start_date: '2026-09-27T00:00:00+00', location: 'Stöckarkerstrasse 93, Braunwald', canton: 'Glarus' },
            ],
            course_locations: [
                { location_type: 'presence', street: 'Stöckarkerstrasse 93', city: 'Bern', canton: 'Bern', sort_order: 0 }
            ]
        };

        const result = getCourseLocationText(course);

        expect(result).toBe('Braunwald (GL)');   // City + canton abbreviation
        expect(result).not.toContain('Stöckarker');
        expect(result).not.toContain('Bern');
        expect(result).not.toContain('3018');
    });

    it('REGRESSION: gemischte Adresse wird nicht angezeigt (Strasse aus altem Standort + Ort aus Termin)', () => {
        const course = {
            booking_type: 'lead',
            address: '3018 Bern',
            city: null,
            canton: 'Bern',
            course_events: [
                { id: 1, start_date: '2026-09-28T00:00:00+00', location: 'Stöckarkerstrasse 93, Braunwald', canton: 'Glarus' }
            ],
            course_locations: [
                { location_type: 'presence', street: 'Stöckarkerstrasse 93', city: 'Bern', canton: 'Bern', sort_order: 0 }
            ]
        };

        const result = getCourseLocationText(course);

        expect(result).not.toContain('Stöckarker');
        expect(result).not.toContain('93');
        expect(result).toBe('Braunwald (GL)');
    });

    it('zeigt den Ort mit Kantonskürzel direkt aus Events', () => {
        const course = {
            booking_type: 'lead',
            address: 'Braunwald',
            city: null,
            canton: 'Glarus',
            course_events: [
                { id: 1, start_date: '2026-06-28T00:00:00+00', location: 'Braunwald', canton: 'Glarus' }
            ],
            course_locations: [
                { location_type: 'presence', street: null, city: 'Braunwald', canton: 'Glarus', sort_order: 0 }
            ]
        };
        expect(getCourseLocationText(course)).toBe('Braunwald (GL)');
    });

    it('zeigt volle Adresse mit Kantonskürzel für Locations-Modus-Kurs (keine Events)', () => {
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
        expect(getCourseLocationText(course)).toBe('Bahnhofstrasse 1, Zürich (ZH)');
    });

    it('zeigt Kantonskürzel für Kurs mit mehreren Standorten (keine Events)', () => {
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
        expect(getCourseLocationText(course)).toBe('BE, ZH');
    });

    it('zeigt mehrere Kantonskürzel für Multi-Ort-Event-Kurs', () => {
        const course = {
            booking_type: 'lead',
            address: 'Belp',
            city: null,
            canton: 'Bern',
            course_events: [
                { id: 1, start_date: '2026-07-06T00:00:00+00', location: 'Belp', canton: 'Bern' },
                { id: 2, start_date: '2026-07-06T00:00:00+00', location: 'Schaffhausen', canton: 'Schaffhausen' },
                { id: 3, start_date: '2026-07-06T00:00:00+00', location: 'Zürich', canton: 'Zürich' },
            ],
            course_locations: []
        };
        const result = getCourseLocationText(course);
        expect(result).toContain('BE');
        expect(result).toContain('ZH');
    });

    it('Fallback auf Kantonskürzel wenn keine Locations und keine Events', () => {
        const course = {
            booking_type: 'lead',
            address: null,
            city: null,
            canton: 'Aargau',
            course_events: null,
            course_locations: []
        };
        expect(getCourseLocationText(course)).toBe('AG');
    });

    it('Online-Kurs: Fallback auf courses.address = Online', () => {
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
        // Online events have canton = 'Online' → filtered out from presenceEvents
        // Falls through to course.address = 'Online'
        const result = getCourseLocationText(course);
        expect(result).toBe('Online');
    });
});

describe('getEventLocationLabel — Termine-Liste (Lead-Kurse)', () => {

    it('REGRESSION: zeigt Ort mit Kürzel, nicht Strasse aus falsch gespeichertem Termin', () => {
        const ev = { location: 'Stöckarkerstrasse 93, Braunwald', canton: 'Glarus' };
        expect(getEventLocationLabel(ev)).toBe('Braunwald (GL)');
    });

    it('zeigt Ort mit Kürzel wenn kein Komma', () => {
        const ev = { location: 'Braunwald', canton: 'Glarus' };
        expect(getEventLocationLabel(ev)).toBe('Braunwald (GL)');
    });

    it('Fallback auf Kantonskürzel wenn location leer', () => {
        const ev = { location: '', canton: 'Glarus' };
        expect(getEventLocationLabel(ev)).toBe('GL');
    });

    it('Fallback auf Kantonskürzel wenn location null', () => {
        const ev = { location: null, canton: 'Bern' };
        expect(getEventLocationLabel(ev)).toBe('BE');
    });
});

describe('formatLocationWithCanton — Hilfsfunktion', () => {
    it('zeigt Strasse, Ort und Kürzel', () => {
        expect(formatLocationWithCanton({ street: 'Schönenwerderstrasse 75', city: '5742 Kölliken', canton: 'Aargau' }))
            .toBe('Schönenwerderstrasse 75, 5742 Kölliken (AG)');
    });

    it('zeigt Ort mit Kürzel (ohne Strasse)', () => {
        expect(formatLocationWithCanton({ city: 'Luzern', canton: 'Luzern' }))
            .toBe('Luzern (LU)');
    });

    it('zeigt nur Kürzel wenn nur Kanton vorhanden', () => {
        expect(formatLocationWithCanton({ canton: 'Zürich' })).toBe('ZH');
    });

    it('zeigt Online unverändert (kein Kürzel)', () => {
        expect(formatLocationWithCanton({ canton: 'Online' })).toBe('Online');
    });

    it('zeigt Ausland unverändert', () => {
        expect(formatLocationWithCanton({ canton: 'Ausland' })).toBe('Ausland');
    });
});
