/**
 * JSON-LD: der Termin von heute muss im EducationEvent stehen.
 *
 * Die Kursdetailseite normalisierte einen reinen Datums-String immer auf das
 * Tagesende in lokaler Zeit, die SEO-Daten nicht. `new Date('2026-09-29')` ist
 * 00:00 UTC — ab 01:00/02:00 Schweizer Zeit galt der Termin im JSON-LD damit
 * als vergangen. Google sah den Kurs am Kurstag selbst als terminlos, obwohl
 * die Seite den Termin noch anzeigte und er noch buchbar war.
 *
 * Diese Tests fixieren den Gleichlauf zwischen Seite und strukturierten Daten.
 */

import { describe, it, expect } from 'vitest';
import { buildCourseStructuredData, buildCourseJsonLdList } from '../src/lib/courseSeo';

const BASE = 'https://kursnavi.ch';

/** 29.09.2026, 03:00 lokal — hinter 00:00 UTC, vor dem Tagesende. */
const FRUEH_AM_KURSTAG = new Date(2026, 8, 29, 3, 0, 0);

const makeCourse = (events) => ({
  id: 42,
  title: 'Toepferkurs fuer Anfaenger',
  description: 'Ein Kurs zum Ausprobieren.',
  instructor_name: 'Atelier Ton',
  user_id: 'anbieter-1',
  canton: 'Zuerich',
  city: 'Zuerich',
  price: 180,
  booking_type: 'lead',
  category_type: 'privat',
  category_area: 'kreativ_privat',
  course_events: events,
});

describe('EducationEvent am Kurstag', () => {
  it('nimmt einen Termin auf, der heute stattfindet', () => {
    const { educationEvent } = buildCourseStructuredData(
      makeCourse([{ id: 1, start_date: '2026-09-29' }]),
      BASE,
      { now: FRUEH_AM_KURSTAG },
    );

    expect(educationEvent).not.toBeNull();
    expect(educationEvent.startDate).toBe('2026-09-29');
  });

  it('nimmt einen mehrtaegigen Kurs auf, der heute endet', () => {
    const { educationEvent } = buildCourseStructuredData(
      makeCourse([{ id: 1, start_date: '2026-09-27', end_date: '2026-09-29' }]),
      BASE,
      { now: FRUEH_AM_KURSTAG },
    );

    expect(educationEvent).not.toBeNull();
    expect(educationEvent.endDate).toBe('2026-09-29');
  });

  it('laesst einen Termin von gestern weg', () => {
    const { educationEvent } = buildCourseStructuredData(
      makeCourse([{ id: 1, start_date: '2026-09-28' }]),
      BASE,
      { now: FRUEH_AM_KURSTAG },
    );

    expect(educationEvent).toBeNull();
  });

  it('laesst abgesagte Termine weg', () => {
    const { educationEvent } = buildCourseStructuredData(
      makeCourse([{ id: 1, start_date: '2026-09-29', cancelled_at: '2026-09-01T00:00:00Z' }]),
      BASE,
      { now: FRUEH_AM_KURSTAG },
    );

    expect(educationEvent).toBeNull();
  });

  it('fuehrt den heutigen Termin auch im eventSchedule mit', () => {
    const { educationEvent } = buildCourseStructuredData(
      makeCourse([
        { id: 1, start_date: '2026-09-29' },
        { id: 2, start_date: '2026-10-15' },
      ]),
      BASE,
      { now: FRUEH_AM_KURSTAG },
    );

    expect(educationEvent.eventSchedule).toHaveLength(2);
    expect(educationEvent.eventSchedule[0].startDate).toBe('2026-09-29');
  });

  it('der JSON-LD-Block der Seite enthaelt das EducationEvent', () => {
    const list = buildCourseJsonLdList(
      makeCourse([{ id: 1, start_date: '2026-09-29' }]),
      BASE,
      { now: FRUEH_AM_KURSTAG },
    );

    expect(list.map((entry) => entry['@type'])).toContain('EducationEvent');
  });
});
