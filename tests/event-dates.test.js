/**
 * Termin-Cutoff: der Kern von src/lib/eventDates.js.
 *
 * Anlass: Die Regel "ist dieser Termin noch aktuell?" lag in sieben Kopien im
 * Code. Zwei davon (courseSeo.js und courseRecommendations.js) verglichen einen
 * reinen Datums-String direkt mit `new Date()`. JavaScript liest '2026-09-29'
 * als 00:00 UTC — in der Schweiz ist das 01:00 (Winter) bzw. 02:00 (Sommer).
 * Ab diesem Zeitpunkt galt ein Termin, der an diesem Tag stattfindet, bereits
 * als vergangen: er verschwand aus dem JSON-LD und aus den Empfehlungen,
 * waehrend die Kursdetailseite ihn noch anzeigte.
 *
 * Diese Tests halten fest, dass ein reiner Datums-String bis zum Ende des
 * Tages in lokaler Zeit zaehlt.
 */

import { describe, it, expect } from 'vitest';
import {
  getEventCutoffDate,
  isEventUpcoming,
  isEventPast,
  isRelevantEvent,
} from '../src/lib/eventDates';

const HEUTE = '2026-09-29';
const GESTERN = '2026-09-28';
const MORGEN = '2026-09-30';

/** Zeitpunkt am 29.09.2026 in lokaler Zeit des Testlaeufers. */
const amTag = (stunde, minute = 0) => new Date(2026, 8, 29, stunde, minute, 0);

describe('getEventCutoffDate', () => {
  it('setzt einen reinen Datums-String auf das Ende des Tages in lokaler Zeit', () => {
    const cutoff = getEventCutoffDate(HEUTE);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(8); // September
    expect(cutoff.getDate()).toBe(29);
    expect(cutoff.getHours()).toBe(23);
    expect(cutoff.getMinutes()).toBe(59);
  });

  it('laesst einen vollstaendigen Zeitstempel unveraendert', () => {
    const cutoff = getEventCutoffDate('2026-09-29T10:30:00Z');
    expect(cutoff.toISOString()).toBe('2026-09-29T10:30:00.000Z');
  });

  it('reicht ein Date-Objekt durch', () => {
    const input = new Date(2026, 8, 29, 8, 0, 0);
    expect(getEventCutoffDate(input)).toBe(input);
  });

  it('gibt null zurueck bei leerem, leerzeichen-only oder unlesbarem Wert', () => {
    expect(getEventCutoffDate(null)).toBeNull();
    expect(getEventCutoffDate(undefined)).toBeNull();
    expect(getEventCutoffDate('')).toBeNull();
    expect(getEventCutoffDate('   ')).toBeNull();
    expect(getEventCutoffDate('kein-datum')).toBeNull();
    expect(getEventCutoffDate(new Date('kaputt'))).toBeNull();
  });
});

describe('isEventUpcoming — der eigentliche Fehlerfall', () => {
  // 01:00 und 03:00 liegen hinter 00:00 UTC. Genau hier kippte die alte,
  // nicht normalisierte Variante faelschlich auf "vergangen".
  it.each([
    ['00:30', amTag(0, 30)],
    ['01:00', amTag(1)],
    ['03:00', amTag(3)],
    ['12:00', amTag(12)],
    ['23:00', amTag(23)],
  ])('ein Termin heute gilt um %s noch als aktuell', (_label, jetzt) => {
    expect(isEventUpcoming(HEUTE, jetzt)).toBe(true);
  });

  it('ein Termin von gestern gilt nicht mehr als aktuell', () => {
    expect(isEventUpcoming(GESTERN, amTag(3))).toBe(false);
  });

  it('ein Termin von morgen gilt als aktuell', () => {
    expect(isEventUpcoming(MORGEN, amTag(23, 59))).toBe(true);
  });

  it('ohne Datum niemals aktuell', () => {
    expect(isEventUpcoming(null, amTag(12))).toBe(false);
    expect(isEventUpcoming('', amTag(12))).toBe(false);
  });

  it('isEventPast ist das Gegenstueck — ausser beim fehlenden Datum', () => {
    expect(isEventPast(GESTERN, amTag(3))).toBe(true);
    expect(isEventPast(HEUTE, amTag(3))).toBe(false);
    // Kein Datum heisst "unbekannt", nicht "vorbei".
    expect(isEventPast(null, amTag(3))).toBe(false);
  });
});

describe('isRelevantEvent', () => {
  it('nutzt end_date, solange es in der Zukunft liegt', () => {
    const event = { start_date: GESTERN, end_date: MORGEN };
    expect(isRelevantEvent(event, amTag(12))).toBe(true);
  });

  it('ein mehrtaegiger Kurs bleibt am letzten Tag sichtbar', () => {
    const event = { start_date: GESTERN, end_date: HEUTE };
    expect(isRelevantEvent(event, amTag(3))).toBe(true);
    expect(isRelevantEvent(event, amTag(23, 30))).toBe(true);
  });

  it('faellt auf start_date zurueck, wenn end_date fehlt', () => {
    expect(isRelevantEvent({ start_date: HEUTE }, amTag(3))).toBe(true);
    expect(isRelevantEvent({ start_date: GESTERN }, amTag(3))).toBe(false);
  });

  it('faellt auf start_date zurueck, wenn end_date unlesbar ist', () => {
    const event = { start_date: HEUTE, end_date: 'kaputt' };
    expect(isRelevantEvent(event, amTag(3))).toBe(true);
  });

  it('abgesagte Termine zaehlen nie', () => {
    const event = { start_date: MORGEN, cancelled_at: '2026-01-01T00:00:00Z' };
    expect(isRelevantEvent(event, amTag(12))).toBe(false);
  });

  it('kommt mit fehlendem Event klar', () => {
    expect(isRelevantEvent(null, amTag(12))).toBe(false);
    expect(isRelevantEvent({}, amTag(12))).toBe(false);
  });
});
