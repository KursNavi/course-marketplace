/**
 * Kursorte, Umkreisfilter und Kartenmarker.
 *
 * Verifiziert:
 *   1  Der Veranstaltungsort schlägt die veraltete Adresse am Kurs
 *   2  Mehrere Standorte: ein Treffer genügt, der Kurs erscheint trotzdem nur einmal
 *   3  Datumsfilter: nur die dazu passenden Termine und deren Orte zählen
 *   4  Online, Hybrid und Ausland werden richtig behandelt
 *   5  Fehlende oder unklare Ortsdaten erzeugen keine erfundenen Koordinaten
 *   6  Der Filter entfernt nur — er sortiert nichts um
 *   7  Liste und Karte beruhen auf derselben Treffermenge
 */

import { describe, expect, it } from 'vitest';
import { buildPlacesIndex } from '../src/lib/swissPlaces.js';
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS,
  buildMapMarkers,
  countGeoStatuses,
  courseWithinRadius,
  createGeoResolver,
  filterCoursesByRadius,
  getCourseGeoInfo,
  resolveLocationPoint,
} from '../src/lib/courseGeo.js';

const index = buildPlacesIndex({
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
    ['8400', 'Winterthur', 'ZH', 47.5, 8.7241, 0],
    ['3000', 'Bern', 'BE', 46.948, 7.4474, 0],
    ['8784', 'Braunwald', 'GL', 46.9394, 8.9972, 0],
    ['1200', 'Genève', 'GE', 46.2044, 6.1432, 0],
    ['9470', 'Buchs SG', 'SG', 47.1667, 9.4667, 0],
    ['5033', 'Buchs AG', 'AG', 47.3833, 8.0667, 0],
  ],
});

const ZUERICH = { lat: 47.3721, lng: 8.5417 };

const kurs = (over = {}) => ({ id: 'k', title: 'Kurs', ...over });

describe('Grundeinstellungen', () => {
  it('bietet genau die vorgesehenen Umkreise an', () => {
    expect(RADIUS_OPTIONS).toEqual([5, 10, 25, 50]);
  });

  it('nutzt 25 km als Vorbelegung', () => {
    expect(DEFAULT_RADIUS_KM).toBe(25);
    expect(RADIUS_OPTIONS).toContain(DEFAULT_RADIUS_KM);
  });
});

describe('getCourseGeoInfo — Herkunft des Ortes', () => {
  it('löst eine Adresse mit Postleitzahl auf', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [{ start_date: '2026-12-01', canton: 'Zürich', location: 'Bahnhofstrasse 1, 8001 Zürich' }],
    }), index);
    expect(info.status).toBe('located');
    expect(info.points).toHaveLength(1);
    expect(info.points[0].lat).toBeCloseTo(47.3721, 3);
    // Ortsmittelpunkt, keine Hausnummer — das muss als «ungefähr» markiert sein.
    expect(info.points[0].approximate).toBe(true);
  });

  it('löst einen Ort über das Stadtfeld auf', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [{ start_date: '2026-12-01', canton: 'Zürich', city: 'Winterthur' }],
    }), index);
    expect(info.points[0].lat).toBeCloseTo(47.5, 3);
  });

  it('nimmt den letzten Abschnitt eines Freitext-Standorts als Ort', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [{ start_date: '2026-12-01', canton: 'Glarus', location: 'Stöckarkerstrasse 93, Braunwald' }],
    }), index);
    expect(info.points[0].lat).toBeCloseTo(46.9394, 3);
  });

  /**
   * Dasselbe Fehlerbild wie in tests/course-location-display.test.js: Der Kurs
   * trägt noch eine alte Berner Adresse, die Termine liegen in Braunwald.
   * Ein Umkreis um Bern darf diesen Kurs NICHT treffen.
   */
  it('REGRESSION: der Veranstaltungsort schlägt die veraltete Kursadresse', () => {
    const sprachcamp = kurs({
      id: 'braunwald',
      address: '3000 Bern',
      canton: 'Bern',
      course_events: [{ start_date: '2027-07-05', canton: 'Glarus', location: 'Stöckarkerstrasse 93, Braunwald' }],
    });
    const info = getCourseGeoInfo(sprachcamp, index);
    expect(info.points).toHaveLength(1);
    expect(info.points[0].label).toContain('Braunwald');
    expect(courseWithinRadius(info, { lat: 46.948, lng: 7.4474 }, 25)).toBe(false);
    expect(courseWithinRadius(info, { lat: 46.9394, lng: 8.9972 }, 25)).toBe(true);
  });

  it('nutzt course_locations, wenn es keine Termine gibt', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [],
      course_locations: [{ location_type: 'presence', street: 'Musterweg 2', city: 'Bern', canton: 'Bern', sort_order: 0 }],
    }), index);
    expect(info.points[0].lat).toBeCloseTo(46.948, 3);
  });

  it('nutzt die flachen Kursfelder nur als letzte Rückfallebene', () => {
    const info = getCourseGeoInfo(kurs({ city: 'Winterthur', canton: 'Zürich' }), index);
    expect(info.status).toBe('located');
    expect(info.points[0].lat).toBeCloseTo(47.5, 3);
  });
});

describe('getCourseGeoInfo — mehrere Standorte', () => {
  const mehrort = kurs({
    id: 'mehrort',
    course_events: [
      { start_date: '2026-12-01', canton: 'Zürich', city: 'Zürich' },
      { start_date: '2026-12-02', canton: 'Genève', city: 'Genève' },
    ],
  });

  it('kennt beide Punkte', () => {
    expect(getCourseGeoInfo(mehrort, index).points).toHaveLength(2);
  });

  it('ist ein Treffer, sobald EIN Standort im Umkreis liegt', () => {
    expect(courseWithinRadius(getCourseGeoInfo(mehrort, index), ZUERICH, 10)).toBe(true);
  });

  it('erscheint in der Liste trotzdem nur einmal', () => {
    const treffer = filterCoursesByRadius([mehrort], {
      center: ZUERICH, radiusKm: 50, placesIndex: index,
    });
    expect(treffer).toHaveLength(1);
  });

  it('fasst dieselbe Koordinate nicht doppelt auf', () => {
    const doppelt = kurs({
      course_events: [
        { start_date: '2026-12-01', canton: 'Zürich', city: 'Zürich' },
        { start_date: '2026-12-08', canton: 'Zürich', location: 'Anderer Saal, 8001 Zürich' },
      ],
    });
    expect(getCourseGeoInfo(doppelt, index).points).toHaveLength(1);
  });
});

describe('getCourseGeoInfo — Datumsfilter', () => {
  const zweiTermine = kurs({
    id: 'zwei',
    course_events: [
      { start_date: '2026-12-10', end_date: '2026-12-12', canton: 'Zürich', city: 'Zürich' },
      { start_date: '2027-03-05', end_date: '2027-03-07', canton: 'Genève', city: 'Genève' },
    ],
  });

  it('berücksichtigt ohne Datumsfilter beide Orte', () => {
    expect(getCourseGeoInfo(zweiTermine, index).points).toHaveLength(2);
  });

  it('berücksichtigt bei gesetztem Zeitraum nur die dazu passenden Orte', () => {
    const info = getCourseGeoInfo(zweiTermine, index, { dateFrom: '2027-03-01', dateTo: '2027-03-31' });
    expect(info.points).toHaveLength(1);
    expect(info.points[0].label).toContain('Genève');
  });

  it('macht einen Ort aussserhalb des Zeitraums nicht zum räumlichen Treffer', () => {
    const info = getCourseGeoInfo(zweiTermine, index, { dateFrom: '2027-03-01', dateTo: '2027-03-31' });
    expect(courseWithinRadius(info, ZUERICH, 25)).toBe(false);
  });

  it('wertet einen Kurs ohne passenden Termin im Zeitraum als nicht zuordenbar', () => {
    const info = getCourseGeoInfo(zweiTermine, index, { dateFrom: '2028-01-01', dateTo: '2028-01-31' });
    expect(info.status).toBe('unknown');
    expect(info.points).toEqual([]);
  });

  it('behandelt Termine ohne Datum als nicht datumsgebunden', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [{ canton: 'Zürich', city: 'Zürich' }],
    }), index, { dateFrom: '2027-01-01' });
    expect(info.status).toBe('located');
  });
});

describe('getCourseGeoInfo — Online, Hybrid, Ausland', () => {
  it('wertet einen reinen Onlinekurs nicht als räumlichen Treffer', () => {
    const online = kurs({
      delivery_types: ['online_live'],
      course_events: [{ start_date: '2026-12-01', canton: null, location: 'Online' }],
    });
    const info = getCourseGeoInfo(online, index);
    expect(info.status).toBe('online');
    expect(info.points).toEqual([]);
    expect(courseWithinRadius(info, ZUERICH, 50)).toBe(false);
  });

  it('erkennt einen Onlinekurs auch an den flachen Feldern', () => {
    expect(getCourseGeoInfo(kurs({ canton: 'Online' }), index).status).toBe('online');
  });

  it('nutzt beim Hybridkurs den physischen Veranstaltungsort', () => {
    const hybrid = kurs({
      delivery_types: ['presence', 'online_live'],
      course_events: [
        { start_date: '2026-12-01', canton: null, location: 'Online' },
        { start_date: '2026-12-08', canton: 'Zürich', city: 'Zürich' },
      ],
    });
    const info = getCourseGeoInfo(hybrid, index);
    expect(info.status).toBe('located');
    expect(info.points).toHaveLength(1);
    expect(courseWithinRadius(info, ZUERICH, 5)).toBe(true);
  });

  it('wertet Ausland nicht als Schweizer Umkreistreffer', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [{ start_date: '2026-12-01', canton: 'Ausland', location: 'Mallorca' }],
    }), index);
    expect(info.status).toBe('ausland');
    expect(courseWithinRadius(info, ZUERICH, 50)).toBe(false);
  });
});

describe('getCourseGeoInfo — fehlende oder unklare Ortsdaten', () => {
  it('erfindet für einen Kurs ohne Ortsangabe keine Koordinaten', () => {
    const info = getCourseGeoInfo(kurs({}), index);
    expect(info.status).toBe('unknown');
    expect(info.points).toEqual([]);
  });

  it('setzt für einen Kurs mit nur Kantonsangabe keinen Kantonsmittelpunkt ein', () => {
    const info = getCourseGeoInfo(kurs({ canton: 'Zürich' }), index);
    expect(info.status).toBe('unknown');
  });

  it('rät bei mehrdeutigem Ortsnamen ohne Kanton nicht', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [{ start_date: '2026-12-01', canton: '', city: 'Buchs' }],
    }), index);
    expect(info.status).toBe('unknown');
  });

  it('löst denselben mehrdeutigen Ortsnamen mit Kanton auf', () => {
    const info = getCourseGeoInfo(kurs({
      course_events: [{ start_date: '2026-12-01', canton: 'St. Gallen', city: 'Buchs' }],
    }), index);
    expect(info.status).toBe('located');
    expect(info.points[0].lat).toBeCloseTo(47.1667, 3);
  });

  it('bleibt ohne Ortstabelle ohne Koordinaten statt zu scheitern', () => {
    const info = getCourseGeoInfo(kurs({ city: 'Zürich', canton: 'Zürich' }), null);
    expect(info.status).toBe('unknown');
  });
});

describe('filterCoursesByRadius', () => {
  const nah = kurs({ id: 'nah', course_events: [{ start_date: '2026-12-01', canton: 'Zürich', city: 'Zürich' }] });
  const mittel = kurs({ id: 'mittel', course_events: [{ start_date: '2026-12-01', canton: 'Zürich', city: 'Winterthur' }] });
  const fern = kurs({ id: 'fern', course_events: [{ start_date: '2026-12-01', canton: 'Genève', city: 'Genève' }] });
  const ohneOrt = kurs({ id: 'ohneOrt' });
  const online = kurs({ id: 'online', canton: 'Online' });
  const alle = [nah, mittel, fern, ohneOrt, online];

  it('behält bei 5 km nur den nahen Kurs', () => {
    const treffer = filterCoursesByRadius(alle, { center: ZUERICH, radiusKm: 5, placesIndex: index });
    expect(treffer.map((c) => c.id)).toEqual(['nah']);
  });

  it('nimmt bei 25 km Winterthur dazu', () => {
    const treffer = filterCoursesByRadius(alle, { center: ZUERICH, radiusKm: 25, placesIndex: index });
    expect(treffer.map((c) => c.id)).toEqual(['nah', 'mittel']);
  });

  it('erreicht Genf auch bei 50 km nicht', () => {
    const treffer = filterCoursesByRadius(alle, { center: ZUERICH, radiusKm: 50, placesIndex: index });
    expect(treffer.map((c) => c.id)).not.toContain('fern');
  });

  it('ist ohne Ausgangsort, Radius oder Ortstabelle ausgeschaltet', () => {
    expect(filterCoursesByRadius(alle, { center: null, radiusKm: 25, placesIndex: index })).toBe(alle);
    expect(filterCoursesByRadius(alle, { center: ZUERICH, radiusKm: 0, placesIndex: index })).toBe(alle);
    expect(filterCoursesByRadius(alle, { center: ZUERICH, radiusKm: 25, placesIndex: null })).toBe(alle);
  });

  it('gibt immer eine Teilfolge der Eingabe zurück — es wird nie umsortiert', () => {
    RADIUS_OPTIONS.forEach((km) => {
      const treffer = filterCoursesByRadius(alle, { center: ZUERICH, radiusKm: km, placesIndex: index });
      const positionen = treffer.map((c) => alle.indexOf(c));
      expect(positionen).toEqual([...positionen].sort((a, b) => a - b));
    });
  });

  it('zählt die räumlich nicht bewertbaren Kurse für den Hinweistext', () => {
    const resolver = createGeoResolver(index);
    expect(countGeoStatuses(alle, resolver)).toEqual({ located: 3, online: 1, ausland: 0, unknown: 1 });
  });
});

describe('buildMapMarkers — Liste und Karte zeigen dasselbe', () => {
  const nah = kurs({ id: 'nah', title: 'Nah', course_events: [{ start_date: '2026-12-01', canton: 'Zürich', city: 'Zürich' }] });
  const auchNah = kurs({ id: 'auchNah', title: 'Auch nah', course_events: [{ start_date: '2026-12-01', canton: 'Zürich', city: 'Zürich' }] });
  const mittel = kurs({ id: 'mittel', title: 'Mittel', course_events: [{ start_date: '2026-12-01', canton: 'Zürich', city: 'Winterthur' }] });

  it('fasst mehrere Kurse am selben Punkt zu EINEM Marker zusammen', () => {
    const marker = buildMapMarkers([nah, auchNah, mittel], createGeoResolver(index));
    expect(marker).toHaveLength(2);
    const zuerichMarker = marker.find((m) => m.courses.length === 2);
    expect(zuerichMarker.courses.map((c) => c.course.id)).toEqual(['nah', 'auchNah']);
  });

  it('behält innerhalb eines Markers die Reihenfolge der Ergebnisliste', () => {
    const marker = buildMapMarkers([auchNah, nah], createGeoResolver(index));
    expect(marker[0].courses.map((c) => c.course.id)).toEqual(['auchNah', 'nah']);
  });

  it('zeigt genau die Kurse der gefilterten Liste — nicht mehr und nicht weniger', () => {
    const alle = [nah, auchNah, mittel];
    const resolver = createGeoResolver(index);
    const liste = filterCoursesByRadius(alle, { center: ZUERICH, radiusKm: 5, placesIndex: index, resolveGeo: resolver });
    const marker = buildMapMarkers(liste, resolver, { center: ZUERICH, radiusKm: 5 });
    const aufDerKarte = new Set(marker.flatMap((m) => m.courses.map((c) => c.course.id)));
    expect([...aufDerKarte].sort()).toEqual(liste.map((c) => c.id).sort());
  });

  it('setzt für Onlinekurse und Kurse ohne Ort keine Marker', () => {
    const marker = buildMapMarkers(
      [kurs({ id: 'online', canton: 'Online' }), kurs({ id: 'leer' })],
      createGeoResolver(index),
    );
    expect(marker).toEqual([]);
  });
});

describe('createGeoResolver', () => {
  it('liefert für denselben Kurs dasselbe Ergebnis zurück', () => {
    const resolver = createGeoResolver(index);
    const k = kurs({ id: 'stabil', city: 'Zürich', canton: 'Zürich' });
    expect(resolver(k)).toBe(resolver(k));
  });
});

describe('resolveLocationPoint — für das Ergänzungs-Skript', () => {
  it('löst einen einzelnen Eintrag auf', () => {
    const punkt = resolveLocationPoint({ canton: 'Zürich', city: 'Winterthur' }, index);
    expect(punkt.lat).toBeCloseTo(47.5, 3);
    expect(punkt.approximate).toBe(true);
  });

  it('gibt für Online und Leeres null zurück', () => {
    expect(resolveLocationPoint({ location: 'Online' }, index)).toBeNull();
    expect(resolveLocationPoint({}, index)).toBeNull();
  });
});
