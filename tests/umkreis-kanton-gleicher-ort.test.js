/**
 * REGRESSION: Kantonsfilter und Umkreis müssen von DEMSELBEN
 * Veranstaltungsort erfüllt werden.
 *
 * Gemeldetes Fehlerbild:
 *   Bei «50 km um Zürich» plus Kantonsfilter «Bern» zeigte die Karte einen
 *   Marker «Polysportcamp» in Aarburg (AG). Der Kurs erfüllte den
 *   Kantonsfilter über einen Berner Termin und den Umkreis über Aarburg —
 *   zwei verschiedene Orte, zusammen ein Treffer, den niemand erwartet.
 *
 * Behebung:
 *   Der Kanton hängt jetzt an jedem aufgelösten Punkt (src/lib/courseGeo.js).
 *   Bei aktivem Umkreis muss ein einzelner Punkt beide Bedingungen erfüllen —
 *   und weil die Punkte bei aktivem Datumsfilter nur aus den passenden
 *   Terminen stammen, gehören Datum, Kanton und Umkreis zwingend zum selben
 *   Termin.
 *
 * Verifiziert:
 *   1  Zwei verschiedene Orte erfüllen die Kombination NICHT
 *   2  Ein tatsächlich passender Ort erfüllt sie
 *   3  Zusammenspiel mit dem Datumsfilter
 *   4  Die Karte zeigt nur Orte, die beide Bedingungen erfüllen
 *   5  Kurse erscheinen weiterhin nur einmal
 *   6  Ohne Kantonsfilter, bei Online/Ausland und ohne Umkreis ändert sich nichts
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPlacesIndex } from '../src/lib/swissPlaces.js';
import {
  buildMapMarkers,
  courseWithinRadius,
  createGeoResolver,
  filterCoursesByRadius,
  getCourseGeoInfo,
  isCantonListText,
  pointMatchesCantons,
  realCantonSelections,
} from '../src/lib/courseGeo.js';

const index = buildPlacesIndex({
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
    ['4663', 'Aarburg', 'AG', 47.3203, 7.8994, 0],   // ~50 km von Zürich
    ['3000', 'Bern', 'BE', 46.9480, 7.4474, 0],      // ~95 km von Zürich
    ['3600', 'Thun', 'BE', 46.7580, 7.6280, 0],      // Kanton Bern, weit weg
    ['8820', 'Wädenswil', 'ZH', 47.2290, 8.6740, 0], // Kanton Zürich, nah
    ['8810', 'Horgen', 'ZH', 47.2597, 8.5986, 0],
  ],
});

const ZUERICH = { lat: 47.3721, lng: 8.5417 };
const resolver = () => createGeoResolver(index);

/** Der Polysportcamp-Fall: Termine in Bern UND in Aarburg. */
const polysportcamp = {
  id: 'polysportcamp',
  title: 'Polysportcamp',
  course_events: [
    { start_date: '2027-07-05', end_date: '2027-07-09', canton: 'Bern', city: 'Thun' },
    { start_date: '2027-08-02', end_date: '2027-08-06', canton: 'Aargau', city: 'Aarburg' },
  ],
};

/** Ein Kurs, der wirklich passt: Termin im Kanton Zürich und nah. */
const passend = {
  id: 'passend',
  title: 'Kurs in Wädenswil',
  course_events: [
    { start_date: '2027-07-05', canton: 'Zürich', city: 'Wädenswil' },
    { start_date: '2027-08-02', canton: 'Bern', city: 'Bern' },
  ],
};

describe('Hilfsfunktionen', () => {
  it('erkennt echte Kantone und lässt Online/Ausland aussen vor', () => {
    expect(realCantonSelections(['Bern', 'Online', 'Ausland', 'Zürich'])).toEqual(['Bern', 'Zürich']);
    expect(realCantonSelections(['Online'])).toEqual([]);
    expect(realCantonSelections([])).toEqual([]);
    expect(realCantonSelections(undefined)).toEqual([]);
  });

  it('vergleicht den Kanton eines Punktes gegen die Auswahl', () => {
    expect(pointMatchesCantons({ canton: 'Bern' }, ['Bern'])).toBe(true);
    expect(pointMatchesCantons({ canton: 'bern' }, ['Bern'])).toBe(true);
    expect(pointMatchesCantons({ canton: 'Aargau' }, ['Bern'])).toBe(false);
    expect(pointMatchesCantons({ canton: '' }, ['Bern'])).toBe(false);
    // Ohne Auswahl entscheidet der Kanton nichts.
    expect(pointMatchesCantons({ canton: 'Aargau' }, [])).toBe(true);
  });

  it('hängt den Kanton an jeden aufgelösten Punkt', () => {
    const info = getCourseGeoInfo(polysportcamp, index);
    expect(info.points.map((p) => p.canton).sort()).toEqual(['Aargau', 'Bern']);
  });
});

describe('1 — zwei verschiedene Orte erfüllen die Kombination nicht', () => {
  it('der gemeldete Fall: Kanton Bern + 50 km um Zürich ergibt keinen Treffer', () => {
    const info = resolver()(polysportcamp);
    expect(courseWithinRadius(info, ZUERICH, 50, { cantons: ['Bern'] })).toBe(false);
  });

  it('Aarburg liegt tatsächlich im 50-km-Umkreis — der Umkreis allein würde greifen', () => {
    const info = resolver()(polysportcamp);
    expect(courseWithinRadius(info, ZUERICH, 50)).toBe(true);
  });

  it('der Berner Termin liegt tatsächlich im Kanton Bern — der Kanton allein würde greifen', () => {
    const info = resolver()(polysportcamp);
    expect(info.points.some((p) => p.canton === 'Bern')).toBe(true);
  });

  it('der Kurs fällt damit aus der Ergebnisliste', () => {
    const treffer = filterCoursesByRadius([polysportcamp], {
      center: ZUERICH, radiusKm: 50, placesIndex: index, cantons: ['Bern'],
    });
    expect(treffer).toEqual([]);
  });
});

describe('2 — ein tatsächlich passender Ort erfüllt die Kombination', () => {
  it('Kanton Zürich + 50 km um Zürich trifft über den Wädenswiler Termin', () => {
    const treffer = filterCoursesByRadius([passend, polysportcamp], {
      center: ZUERICH, radiusKm: 50, placesIndex: index, cantons: ['Zürich'],
    });
    expect(treffer.map((c) => c.id)).toEqual(['passend']);
  });

  it('mehrere ausgewählte Kantone: einer davon muss am selben Ort passen', () => {
    // Aargau ist ausgewählt UND Aarburg liegt im Umkreis → Treffer.
    const treffer = filterCoursesByRadius([polysportcamp], {
      center: ZUERICH, radiusKm: 50, placesIndex: index, cantons: ['Bern', 'Aargau'],
    });
    expect(treffer.map((c) => c.id)).toEqual(['polysportcamp']);
  });

  it('ein zu kleiner Umkreis schliesst denselben Kurs wieder aus', () => {
    const treffer = filterCoursesByRadius([polysportcamp], {
      center: ZUERICH, radiusKm: 25, placesIndex: index, cantons: ['Aargau'],
    });
    expect(treffer).toEqual([]);
  });
});

describe('3 — Zusammenspiel mit dem Datumsfilter', () => {
  it('Datum, Kanton und Umkreis müssen zum selben Termin gehören', () => {
    // Im Juli findet nur der Berner Termin statt — der liegt nicht im
    // Umkreis von Zürich.
    const juli = createGeoResolver(index, { dateFrom: '2027-07-01', dateTo: '2027-07-31' });
    expect(courseWithinRadius(juli(polysportcamp), ZUERICH, 50, { cantons: ['Aargau'] })).toBe(false);
    expect(courseWithinRadius(juli(polysportcamp), ZUERICH, 50, { cantons: ['Bern'] })).toBe(false);

    // Im August findet der Aarburger Termin statt — Kanton Aargau passt.
    const august = createGeoResolver(index, { dateFrom: '2027-08-01', dateTo: '2027-08-31' });
    expect(courseWithinRadius(august(polysportcamp), ZUERICH, 50, { cantons: ['Aargau'] })).toBe(true);
    expect(courseWithinRadius(august(polysportcamp), ZUERICH, 50, { cantons: ['Bern'] })).toBe(false);
  });

  it('der passende Kurs trifft nur im Zeitraum seines Zürcher Termins', () => {
    const juli = createGeoResolver(index, { dateFrom: '2027-07-01', dateTo: '2027-07-31' });
    const august = createGeoResolver(index, { dateFrom: '2027-08-01', dateTo: '2027-08-31' });
    expect(courseWithinRadius(juli(passend), ZUERICH, 50, { cantons: ['Zürich'] })).toBe(true);
    expect(courseWithinRadius(august(passend), ZUERICH, 50, { cantons: ['Zürich'] })).toBe(false);
  });

  it('ausserhalb aller Termine gibt es keinen räumlichen Treffer', () => {
    const nie = createGeoResolver(index, { dateFrom: '2028-01-01', dateTo: '2028-01-31' });
    expect(courseWithinRadius(nie(polysportcamp), ZUERICH, 50, { cantons: ['Aargau'] })).toBe(false);
  });
});

describe('4 — die Karte zeigt nur Orte, die beide Bedingungen erfüllen', () => {
  it('kein Aarburg-Marker, wenn Kanton Bern gewählt ist', () => {
    const marker = buildMapMarkers([polysportcamp], resolver(), {
      center: ZUERICH, radiusKm: 50, cantons: ['Bern'],
    });
    expect(marker).toEqual([]);
  });

  it('mit Kanton Aargau erscheint genau der Aarburger Marker', () => {
    const marker = buildMapMarkers([polysportcamp], resolver(), {
      center: ZUERICH, radiusKm: 50, cantons: ['Aargau'],
    });
    expect(marker).toHaveLength(1);
    expect(marker[0].courses[0].label).toContain('Aarburg');
  });

  it('ohne Kantonsfilter bleibt es beim reinen Umkreis', () => {
    const marker = buildMapMarkers([polysportcamp], resolver(), {
      center: ZUERICH, radiusKm: 50, cantons: [],
    });
    expect(marker).toHaveLength(1);
    expect(marker[0].courses[0].label).toContain('Aarburg');
  });

  it('Liste und Karte zeigen dieselbe Kursmenge', () => {
    const alle = [polysportcamp, passend];
    const geo = resolver();
    const liste = filterCoursesByRadius(alle, {
      center: ZUERICH, radiusKm: 50, placesIndex: index, resolveGeo: geo, cantons: ['Zürich'],
    });
    const marker = buildMapMarkers(liste, geo, { center: ZUERICH, radiusKm: 50, cantons: ['Zürich'] });
    const aufDerKarte = [...new Set(marker.flatMap((m) => m.courses.map((c) => c.course.id)))];
    expect(aufDerKarte.sort()).toEqual(liste.map((c) => c.id).sort());
  });
});

describe('5 — Kurse erscheinen weiterhin nur einmal', () => {
  const zweiPassende = {
    id: 'zwei-passende',
    title: 'Kurs an zwei passenden Orten',
    course_events: [
      { start_date: '2027-07-05', canton: 'Zürich', city: 'Wädenswil' },
      { start_date: '2027-07-12', canton: 'Zürich', city: 'Horgen' },
    ],
  };

  it('in der Liste steht der Kurs einmal, obwohl zwei Orte passen', () => {
    const treffer = filterCoursesByRadius([zweiPassende], {
      center: ZUERICH, radiusKm: 50, placesIndex: index, cantons: ['Zürich'],
    });
    expect(treffer).toHaveLength(1);
  });

  it('auf der Karte bekommt er beide Marker', () => {
    const marker = buildMapMarkers([zweiPassende], resolver(), {
      center: ZUERICH, radiusKm: 50, cantons: ['Zürich'],
    });
    expect(marker).toHaveLength(2);
  });
});

describe('6 — bestehende Fälle bleiben unverändert', () => {
  it('ohne Kantonsfilter zählt nur der Umkreis', () => {
    expect(filterCoursesByRadius([polysportcamp], {
      center: ZUERICH, radiusKm: 50, placesIndex: index, cantons: [],
    }).map((c) => c.id)).toEqual(['polysportcamp']);
  });

  it('ohne Umkreis greift die kombinierte Prüfung gar nicht', () => {
    const alle = [polysportcamp, passend];
    expect(filterCoursesByRadius(alle, {
      center: null, radiusKm: 0, placesIndex: index, cantons: ['Bern'],
    })).toBe(alle);
  });

  it('ein reiner Onlinekurs bleibt ohne räumlichen Treffer', () => {
    const online = { id: 'online', canton: 'Online' };
    expect(courseWithinRadius(resolver()(online), ZUERICH, 50, { cantons: ['Zürich'] })).toBe(false);
    expect(courseWithinRadius(resolver()(online), ZUERICH, 50)).toBe(false);
  });

  it('beim Hybridkurs zählt der physische Ort — mit seinem Kanton', () => {
    const hybrid = {
      id: 'hybrid',
      delivery_types: ['presence', 'online_live'],
      course_events: [
        { start_date: '2027-07-05', canton: null, location: 'Online' },
        { start_date: '2027-07-12', canton: 'Zürich', city: 'Horgen' },
      ],
    };
    expect(courseWithinRadius(resolver()(hybrid), ZUERICH, 50, { cantons: ['Zürich'] })).toBe(true);
    expect(courseWithinRadius(resolver()(hybrid), ZUERICH, 50, { cantons: ['Bern'] })).toBe(false);
  });

  it('ein Punkt ohne Kantonsangabe zählt bei gesetztem Kantonsfilter nicht mit', () => {
    // Lieber kein Treffer als ein Treffer über einen Ort, dessen Kanton wir
    // nicht kennen.
    const ohneKanton = {
      id: 'ohne-kanton',
      course_events: [{ start_date: '2027-07-05', canton: '', location: '8820 Wädenswil' }],
    };
    const info = resolver()(ohneKanton);
    expect(info.status).toBe('located');
    // Der Kanton kommt aus der Ortstabelle, wenn am Eintrag keiner steht.
    expect(info.points[0].canton).toBe('Zürich');
    expect(courseWithinRadius(info, ZUERICH, 50, { cantons: ['Zürich'] })).toBe(true);
    expect(courseWithinRadius(info, ZUERICH, 50, { cantons: ['Bern'] })).toBe(false);
  });
});

/**
 * Die Bibliothek allein nuetzt nichts, wenn die Anwendung die ausgewaehlten
 * Kantone nicht weiterreicht. Genau diese Verdrahtung war der Fehler.
 */
describe('7 — die Anwendung reicht die Kantonsauswahl durch', () => {
  const appSource = readFileSync(resolve('src/App.jsx'), 'utf8');
  const searchSource = readFileSync(resolve('src/components/SearchPageView.jsx'), 'utf8');

  it('App.jsx leitet die echten Kantone aus der Standortauswahl ab', () => {
    expect(appSource).toMatch(/realCantonSelections\(selectedLocations\)/);
  });

  it('der Umkreisfilter in App.jsx bekommt die Kantone mit', () => {
    expect(appSource).toMatch(/courseWithinRadius\(resolveCourseGeo\(course\), radiusOrigin, radiusKm, \{ cantons: radiusCantons \}\)/);
  });

  it('die Kartenmarker bekommen die Kantone ebenfalls', () => {
    expect(searchSource).toMatch(/cantons: radiusActive \? \(radiusCantons \|\| \[\]\) : \[\]/);
  });
});

/**
 * Zweiter Teil desselben Fehlerbilds, in der Preview aufgefallen:
 *
 * Bei «Kanton Bern + 50 km um Zürich» erschienen Marker in Zug und Zürich.
 * Ursache waren Kurse, deren Adressfeld gar keine Adresse enthält, sondern
 * die Liste der Kantone, in denen der Kurs angeboten wird
 * («Bern, Basel-Stadt, Luzern, Solothurn, Zürich»). Daraus wurde der zufällig
 * letzte Eintrag als Veranstaltungsort gelesen.
 */
describe('8 — eine Kantonsaufzählung ist keine Adresse', () => {
  it.each([
    ['Bern, Basel-Stadt, Luzern, Solothurn, Zürich', true],
    ['Bern, Aargau, Zug', true],
    ['Zürich, Online', true],
    ['Bahnhofstrasse 1, 8001 Zürich', false],
    ['8820 Wädenswil', false],
    ['Zürich', false],          // einzelner Name: im Zweifel die Stadt
    ['Stöckarkerstrasse 93, Braunwald', false],
    ['', false],
  ])('%s → Kantonsliste: %s', (text, erwartet) => {
    expect(isCantonListText(text)).toBe(erwartet);
  });

  const kantonsliste = {
    id: 'kantonsliste',
    title: 'Kurs in vielen Kantonen',
    canton: 'Bern',
    address: 'Bern, Basel-Stadt, Luzern, Solothurn, Zürich',
    course_events: [],
    course_locations: [],
  };

  it('ein solcher Kurs bekommt KEINEN Ort — statt des letzten Listeneintrags', () => {
    const info = getCourseGeoInfo(kantonsliste, index);
    expect(info.status).toBe('unknown');
    expect(info.points).toEqual([]);
  });

  it('er ist damit kein räumlicher Treffer und bekommt keinen Marker', () => {
    expect(filterCoursesByRadius([kantonsliste], {
      center: ZUERICH, radiusKm: 50, placesIndex: index, cantons: ['Bern'],
    })).toEqual([]);
    expect(buildMapMarkers([kantonsliste], resolver(), {
      center: ZUERICH, radiusKm: 50, cantons: ['Bern'],
    })).toEqual([]);
  });

  it('eine echte Adresse im selben Feld bleibt verwertbar', () => {
    const echteAdresse = { id: 'echt', canton: 'Zürich', address: '8820 Wädenswil', course_events: [], course_locations: [] };
    const info = getCourseGeoInfo(echteAdresse, index);
    expect(info.status).toBe('located');
    expect(info.points[0].canton).toBe('Zürich');
  });
});

describe('9 — der Kanton beschreibt den tatsächlich aufgelösten Ort', () => {
  it('widerspricht der hinterlegte Kanton dem Ort, zählt der Ort', () => {
    // Es gibt Kursdaten mit Kanton «Bern» und Ort «Zug». Ein Marker in Zug,
    // während nach Bern gefiltert wird, waere nicht erklaerbar.
    const widerspruch = {
      id: 'widerspruch',
      course_events: [{ start_date: '2027-07-05', canton: 'Bern', city: 'Horgen' }],
    };
    const info = resolver()(widerspruch);
    expect(info.points[0].canton).toBe('Zürich');
    expect(courseWithinRadius(info, ZUERICH, 50, { cantons: ['Bern'] })).toBe(false);
    expect(courseWithinRadius(info, ZUERICH, 50, { cantons: ['Zürich'] })).toBe(true);
  });

  it('stimmen beide überein, ändert sich nichts', () => {
    const info = resolver()({ id: 'stimmig', course_events: [{ start_date: '2027-07-05', canton: 'Aargau', city: 'Aarburg' }] });
    expect(info.points[0].canton).toBe('Aargau');
    expect(courseWithinRadius(info, ZUERICH, 50, { cantons: ['Aargau'] })).toBe(true);
  });
});
