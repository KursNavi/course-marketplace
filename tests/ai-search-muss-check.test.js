/**
 * Eventgebundene Muss-Prüfung: die harten Abnahmefälle aus 02/04.
 *
 * Kernfall "Zürich teuer / Bern günstig": Ort aus einem Event und Preis-/
 * Datumspassung aus einem anderen dürfen nie zu einem bestätigten Treffer
 * kombiniert werden.
 */

import { describe, it, expect } from 'vitest';
import { checkCourseMusts, MUST_RESULT, zurichDayString } from '../src/lib/aiSearch/mussCheck.js';

const TODAY = new Date('2026-11-13T12:00:00+01:00');

const zurichEvent = (overrides = {}) => ({
  id: 1,
  canton: 'ZH',
  location: 'Zürich',
  start_date: '2027-03-10',
  end_date: null,
  cancelled_at: null,
  ...overrides,
});

describe('checkCourseMusts – derselbe Event muss alles erfüllen', () => {
  it('Zürich-teuer/Bern-günstig: kein bestätigter günstiger Zürcher Treffer', () => {
    // Preis liegt am Kurs; der Kurs hat zwei Events. Der Zürcher Termin
    // existiert, aber der Kurspreis (450) verletzt das Budget-Muss 120.
    const course = {
      booking_type: 'lead',
      price: 450,
      course_events: [
        zurichEvent(),
        zurichEvent({ id: 2, canton: 'BE', location: 'Bern' }),
      ],
    };
    const { result, failures } = checkCourseMusts(
      course,
      { location: 'ZH', maxBudget: 120, dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.FAILED);
    expect(failures).toContain('budget');
  });

  it('Ort aus Event A plus Datum aus Event B ist kein Treffer', () => {
    const course = {
      booking_type: 'lead',
      price: 100,
      course_events: [
        // Event A: Zürich, aber im Mai
        zurichEvent({ start_date: '2027-05-10' }),
        // Event B: Bern, im März
        zurichEvent({ id: 2, canton: 'BE', location: 'Bern', start_date: '2027-03-10' }),
      ],
    };
    const { result } = checkCourseMusts(
      course,
      { location: 'ZH', dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.FAILED);
  });

  it('ein einziger Event, der Ort UND Datum erfüllt, bestätigt den Treffer', () => {
    const course = {
      booking_type: 'lead',
      price: 100,
      price_basis: 'total', // bestätigte Gesamtpreisbasis (P02-Feld)
      course_events: [zurichEvent({ start_date: '2027-03-15' })],
    };
    const { result, matchingEvent } = checkCourseMusts(
      course,
      { location: 'ZH', maxBudget: 120, dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.CONFIRMED);
    expect(matchingEvent.id).toBe(1);
  });

  it('Prüfbefund 2: Preis im Budget, aber ohne bestätigte Gesamtpreisbasis → unvollständig, nie bestätigt', () => {
    const course = {
      booking_type: 'lead',
      price: 100, // könnte Einzellektion sein — Basis unbestätigt
      course_events: [zurichEvent({ start_date: '2027-03-15' })],
    };
    const { result, unknowns } = checkCourseMusts(
      course,
      { location: 'ZH', maxBudget: 120, dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.INCOMPLETE);
    expect(unknowns).toContain('budget');
  });
});

describe('checkCourseMusts – unbekannt ist nie bestätigt', () => {
  it('unbekannter Preis (lead, 0) erfüllt ein Budget-Muss nicht, verletzt es aber auch nicht belegt', () => {
    const course = {
      booking_type: 'lead',
      price: 0,
      course_events: [zurichEvent({ start_date: '2027-03-15' })],
    };
    const { result, unknowns } = checkCourseMusts(
      course,
      { location: 'ZH', maxBudget: 120, dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.INCOMPLETE);
    expect(unknowns).toContain('budget');
  });

  it('Kurs ohne Events kann eventbezogene Muss nicht bestätigen (Angaben unvollständig)', () => {
    const course = { booking_type: 'lead', price: 100, course_events: [] };
    const { result, unknowns } = checkCourseMusts(
      course,
      { location: 'ZH', dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.INCOMPLETE);
    expect(unknowns).toContain('event');
  });
});

describe('checkCourseMusts – abgesagt, vergangen, online, Sprache', () => {
  it('abgesagter Event erfüllt nichts', () => {
    const course = {
      booking_type: 'lead',
      price: 100,
      course_events: [zurichEvent({ start_date: '2027-03-15', cancelled_at: '2026-11-01T10:00:00Z' })],
    };
    const { result } = checkCourseMusts(
      course,
      { location: 'ZH', dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.FAILED);
  });

  it('vergangener Event erfüllt nichts', () => {
    const course = {
      booking_type: 'lead',
      price: 100,
      course_events: [zurichEvent({ start_date: '2026-01-10' })],
    };
    const { result } = checkCourseMusts(
      course,
      { location: 'ZH', dateFrom: '2026-01-01', dateTo: '2026-12-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.FAILED);
  });

  it('mehrtägiger Event zählt mit Überlappungsregel', () => {
    const course = {
      booking_type: 'lead',
      price: 100,
      course_events: [zurichEvent({ start_date: '2027-02-20', end_date: '2027-03-05' })],
    };
    const { result } = checkCourseMusts(
      course,
      { location: 'ZH', dateFrom: '2027-03-01', dateTo: '2027-03-31' },
      { today: TODAY },
    );
    expect(result).toBe(MUST_RESULT.CONFIRMED);
  });

  it('Online-Event zählt nur als Ortstreffer, wenn Online erlaubt ist', () => {
    const online = { booking_type: 'lead', price: 100, course_events: [zurichEvent({ canton: null, location: 'Online', start_date: '2027-03-15' })] };
    const notAllowed = checkCourseMusts(online, { location: 'ZH', onlineAllowed: false, dateFrom: '2027-03-01', dateTo: '2027-03-31' }, { today: TODAY });
    expect(notAllowed.result).toBe(MUST_RESULT.FAILED);
    const allowed = checkCourseMusts(online, { location: 'ZH', onlineAllowed: true, dateFrom: '2027-03-01', dateTo: '2027-03-31' }, { today: TODAY });
    expect(allowed.result).toBe(MUST_RESULT.CONFIRMED);
  });

  it('Sprach-Muss: fehlende Sprachangabe ist unbekannt, falsche Sprache ist Verstoss', () => {
    const base = { booking_type: 'lead', price: 100, course_events: [zurichEvent({ start_date: '2027-03-15' })] };
    const missing = checkCourseMusts({ ...base }, { languages: ['FR'] }, { today: TODAY });
    expect(missing.result).toBe(MUST_RESULT.INCOMPLETE);
    const wrong = checkCourseMusts({ ...base, languages: ['DE'] }, { languages: ['FR'] }, { today: TODAY });
    expect(wrong.result).toBe(MUST_RESULT.FAILED);
    const right = checkCourseMusts({ ...base, languages: ['DE', 'FR'] }, { languages: ['FR'] }, { today: TODAY });
    expect(right.result).toBe(MUST_RESULT.CONFIRMED);
  });
});

describe('zurichDayString', () => {
  it('rechnet UTC-Zeitpunkte in Zürcher Kalendertage um', () => {
    // 23:30 UTC am 1.3. ist in Zürich bereits der 2.3.
    expect(zurichDayString('2027-03-01T23:30:00Z')).toBe('2027-03-02');
    expect(zurichDayString('ungültig')).toBeNull();
  });
});
