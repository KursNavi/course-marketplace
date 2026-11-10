/**
 * REGRESSION: Die Umkreissuche darf die Priorisierung nicht anfassen.
 *
 * Verbindliche Vorgabe der Aufgabe: Die Entfernung dient AUSSCHLIESSLICH der
 * räumlichen Filterung. Es gibt keine Entfernungssortierung, keinen Schalter
 * dafür und keine Veränderung der Priorisierung. Dieser Test hält genau das
 * fest — auch und besonders dann, wenn ein niedriger priorisierter Kurs näher
 * liegt.
 *
 * Verifiziert:
 *   1  Ein hervorgehobener Kurs weiter weg steht VOR einem nicht
 *      hervorgehobenen Kurs direkt um die Ecke
 *   2  Die Sortierung ist gegenüber der Entfernung blind: dieselbe
 *      Kursmenge in unterschiedlicher Entfernung ergibt dieselbe Reihenfolge
 *   3  Der Umkreisfilter entfernt nur und sortiert nie um (Teilfolge)
 *   4  Die relative Reihenfolge der verbleibenden Kurse entspricht der
 *      Reihenfolge ohne Umkreisfilter
 *   5  Relevanz zur Sucheingabe bleibt vor der Hervorhebung — der Umkreis
 *      verschiebt diese Rangfolge nicht
 *   6  Das Entfernen des Umkreisfilters stellt das bisherige Verhalten her
 *
 * Hinweis zur Streuung: sortCoursesByRelevance streut gleichrangige Kurse um
 * bis zu 0.15 anhand ihrer Position in der Eingabeliste. Zwischen
 * hervorgehoben (1.2) und nicht hervorgehoben (1.0) liegen 0.2 — die Streuung
 * kann diese Grenze also nie überspringen. Die Tests hier arbeiten darum mit
 * eindeutig unterschiedlichen Rangstufen; bei exakt gleichrangigen Kursen
 * entscheidet wie bisher die Streuung, nicht die Entfernung.
 */

import { describe, expect, it } from 'vitest';
import { sortCoursesByRelevance, stableSeed } from '../src/lib/searchRelevance.js';
import { buildPlacesIndex } from '../src/lib/swissPlaces.js';
import { createGeoResolver, filterCoursesByRadius } from '../src/lib/courseGeo.js';

const index = buildPlacesIndex({
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],   // Ausgangsort
    ['8003', 'Wiedikon', 'ZH', 47.3700, 8.5200, 0], // ~2 km
    ['8600', 'Dübendorf', 'ZH', 47.3975, 8.6186, 0],// ~7 km
    ['8400', 'Winterthur', 'ZH', 47.5000, 8.7241, 0],// ~20 km
    ['5000', 'Aarau', 'AG', 47.3887, 8.0483, 0],    // ~37 km
    ['3000', 'Bern', 'BE', 46.9480, 7.4474, 0],     // ~95 km, aussserhalb
  ],
});

const ZUERICH = { lat: 47.3721, lng: 8.5417 };

/** Kurs mit Titel, Rangstufe und einem Veranstaltungsort. */
const kurs = ({ id, title = 'Yoga Kurs', prio = false, booking = 1.0, ort, kanton = 'Zürich' }) => ({
  id,
  title,
  keywords: [],
  category_specialty: '',
  category_focus: '',
  instructor_name: '',
  canton: kanton,
  address: '',
  is_prio: prio,
  booking_factor: booking,
  course_events: [{ start_date: '2027-01-15', canton: kanton, city: ort }],
});

/** Sortiert genau so, wie SearchPageView es tut. */
const sortiere = (courses, query = '') => sortCoursesByRelevance(courses, {
  query,
  seed: query ? stableSeed(query) : 0.42,
  preferDated: false,
});

// Bewusst ein FRISCHER Resolver pro Aufruf: der Zwischenspeicher ist an die
// Kurs-ID gebunden, und verschiedene Testfaelle verwenden dieselben IDs mit
// unterschiedlichen Orten.
const filtere = (courses, radiusKm) => filterCoursesByRadius(courses, {
  center: ZUERICH, radiusKm, placesIndex: index, resolveGeo: createGeoResolver(index),
});
const orteVon = (course) => createGeoResolver(index)(course).points;

// ---------------------------------------------------------------------------

describe('1 — hervorgehoben weit weg schlägt nicht hervorgehoben um die Ecke', () => {
  const nahOhnePrio = kurs({ id: 'nah-ohne-prio', ort: 'Wiedikon', prio: false });
  const fernMitPrio = kurs({ id: 'fern-mit-prio', ort: 'Winterthur', prio: true });

  it('der nahe Kurs liegt tatsächlich näher', () => {
    const [nah] = orteVon(nahOhnePrio);
    const [fern] = orteVon(fernMitPrio);
    expect(nah.lat).toBeCloseTo(47.37, 1);
    expect(fern.lat).toBeCloseTo(47.5, 1);
  });

  it('beide liegen im 25-km-Umkreis', () => {
    expect(filtere([nahOhnePrio, fernMitPrio], 25).map((c) => c.id))
      .toEqual(['nah-ohne-prio', 'fern-mit-prio']);
  });

  it('der hervorgehobene Kurs steht trotz grösserer Entfernung VORNE', () => {
    const treffer = filtere([nahOhnePrio, fernMitPrio], 25);
    expect(sortiere(treffer).map((c) => c.id)).toEqual(['fern-mit-prio', 'nah-ohne-prio']);
  });

  it('und zwar unabhängig von der Eingabereihenfolge', () => {
    const treffer = filtere([fernMitPrio, nahOhnePrio], 25);
    expect(sortiere(treffer).map((c) => c.id)).toEqual(['fern-mit-prio', 'nah-ohne-prio']);
  });

  it('auch ein stärkerer Buchungsfaktor weiter weg schlägt den nahen Kurs', () => {
    const nah = kurs({ id: 'nah-schwach', ort: 'Wiedikon', booking: 1.0 });
    const fern = kurs({ id: 'fern-stark', ort: 'Winterthur', booking: 1.5 });
    const treffer = filtere([nah, fern], 25);
    expect(sortiere(treffer).map((c) => c.id)).toEqual(['fern-stark', 'nah-schwach']);
  });
});

describe('2 — die Sortierung ist gegenüber der Entfernung blind', () => {
  it('dieselben Kurse in getauschter Entfernung ergeben dieselbe Reihenfolge', () => {
    // Variante A: der hervorgehobene Kurs ist der weiter entfernte.
    const aPrio = kurs({ id: 'prio', ort: 'Winterthur', prio: true });
    const aNormal = kurs({ id: 'normal', ort: 'Wiedikon', prio: false });
    // Variante B: genau umgekehrt — gleiche Kurse, getauschte Orte.
    const bPrio = kurs({ id: 'prio', ort: 'Wiedikon', prio: true });
    const bNormal = kurs({ id: 'normal', ort: 'Winterthur', prio: false });

    const a = sortiere(filtere([aPrio, aNormal], 25)).map((c) => c.id);
    const b = sortiere(filtere([bPrio, bNormal], 25)).map((c) => c.id);

    expect(a).toEqual(['prio', 'normal']);
    expect(b).toEqual(a);
  });

  it('eine Änderung des Radius verschiebt die Reihenfolge der gemeinsamen Kurse nicht', () => {
    const kurse = [
      kurs({ id: 'g2-wiedikon', ort: 'Wiedikon', booking: 1.0 }),
      kurs({ id: 'g2-duebendorf', ort: 'Dübendorf', booking: 1.6 }),
      kurs({ id: 'g2-winterthur', ort: 'Winterthur', booking: 1.3 }),
      kurs({ id: 'g2-aarau', ort: 'Aarau', booking: 1.9 }),
    ];
    const bei10 = sortiere(filtere(kurse, 10)).map((c) => c.id);
    const bei50 = sortiere(filtere(kurse, 50)).map((c) => c.id);

    // Die bei 10 km verbleibenden Kurse stehen bei 50 km in derselben
    // relativen Reihenfolge — der grössere Radius fügt nur hinzu.
    const gemeinsam = bei50.filter((id) => bei10.includes(id));
    expect(gemeinsam).toEqual(bei10);
  });
});

describe('3 — der Umkreisfilter entfernt nur, er sortiert nie um', () => {
  const kurse = [
    kurs({ id: 'zuerich', ort: 'Zürich' }),
    kurs({ id: 'duebendorf', ort: 'Dübendorf' }),
    kurs({ id: 'winterthur', ort: 'Winterthur' }),
    kurs({ id: 'aarau', ort: 'Aarau' }),
    kurs({ id: 'bern', ort: 'Bern', kanton: 'Bern' }),
  ];

  it.each([5, 10, 25, 50])('bei %i km bleibt die Eingabereihenfolge erhalten', (km) => {
    const treffer = filtere(kurse, km);
    const positionen = treffer.map((c) => kurse.indexOf(c));
    expect(positionen).toEqual([...positionen].sort((x, y) => x - y));
  });

  it('die Reihenfolge der sortierten Liste ist identisch zur Sortierung ohne Entfernungswissen', () => {
    const treffer = filtere(kurse, 25);
    // Dieselbe Liste, aber mit entfernten Ortsangaben: die Sortierung kann
    // hier unmöglich eine Entfernung kennen. Kommt dasselbe heraus, geht die
    // Entfernung nachweislich nicht in die Sortierung ein.
    const ohneOrt = treffer.map(({ course_events, canton, ...rest }) => ({ ...rest, canton: '', course_events: [] }));
    expect(sortiere(treffer).map((c) => c.id)).toEqual(sortiere(ohneOrt).map((c) => c.id));
  });
});

describe('4 — relative Reihenfolge entspricht der Reihenfolge ohne Umkreisfilter', () => {
  const kurse = [
    kurs({ id: 'nah-normal', ort: 'Wiedikon', booking: 1.0 }),
    kurs({ id: 'fern-prio', ort: 'Winterthur', prio: true, booking: 1.0 }),
    kurs({ id: 'mittel-stark', ort: 'Dübendorf', booking: 1.5 }),
    kurs({ id: 'weg-prio', ort: 'Bern', kanton: 'Bern', prio: true, booking: 2.0 }),
  ];

  it('die Treffer im Umkreis stehen untereinander wie in der vollen Liste', () => {
    const ohneUmkreis = sortiere(kurse).map((c) => c.id);
    const mitUmkreis = sortiere(filtere(kurse, 25)).map((c) => c.id);
    expect(mitUmkreis).toEqual(ohneUmkreis.filter((id) => mitUmkreis.includes(id)));
  });

  /**
   * Der Sichtbarkeits-Score ist Hervorhebung MAL Buchungsfaktor:
   *   mittel-stark 1.0 x 1.5 = 1.50
   *   fern-prio    1.2 x 1.0 = 1.20
   *   nah-normal   1.0 x 1.0 = 1.00
   * Genau diese bestehende Rangfolge muss der Umkreis unangetastet lassen —
   * obwohl nah-normal der naechste und weg-prio der am weitesten entfernte
   * Kurs ist.
   */
  it('nur Bern fällt weg — der Rest bleibt in seiner Rangfolge', () => {
    expect(sortiere(filtere(kurse, 25)).map((c) => c.id))
      .toEqual(['mittel-stark', 'fern-prio', 'nah-normal']);
  });
});

describe('5 — Relevanz bleibt vor der Hervorhebung, auch mit Umkreis', () => {
  const titelTreffer = kurs({ id: 'titel', title: 'Yoga für Anfänger', ort: 'Winterthur', prio: false });
  const nurKategorie = {
    ...kurs({ id: 'kategorie', title: 'Pilates Basics', ort: 'Wiedikon', prio: true }),
    category_specialty: 'Yoga & Achtsamkeit',
  };

  it('der direkte Titeltreffer steht vorne — näher und hervorgehoben hilft dem anderen nicht', () => {
    const treffer = filtere([nurKategorie, titelTreffer], 25);
    expect(sortiere(treffer, 'Yoga').map((c) => c.id)).toEqual(['titel', 'kategorie']);
  });

  it('ohne Umkreis ist die Reihenfolge dieselbe', () => {
    expect(sortiere([nurKategorie, titelTreffer], 'Yoga').map((c) => c.id)).toEqual(['titel', 'kategorie']);
  });
});

describe('6 — Zurücksetzen stellt das bisherige Verhalten her', () => {
  const kurse = [
    kurs({ id: 'r-nah', ort: 'Wiedikon' }),
    kurs({ id: 'r-prio', ort: 'Winterthur', prio: true }),
    kurs({ id: 'r-bern', ort: 'Bern', kanton: 'Bern', booking: 1.4 }),
    { ...kurs({ id: 'r-online', ort: 'Zürich' }), canton: 'Online', course_events: [{ start_date: '2027-01-15', canton: null, location: 'Online' }] },
  ];

  it('ohne Ausgangsort und ohne Radius ist die Liste unverändert — dieselbe Referenz', () => {
    expect(filterCoursesByRadius(kurse, { center: null, radiusKm: 0, placesIndex: index })).toBe(kurse);
  });

  it('die sortierte Liste entspricht nach dem Zurücksetzen genau der ohne Umkreis', () => {
    const vorher = sortiere(kurse).map((c) => c.id);
    // Umkreis an …
    expect(sortiere(filtere(kurse, 10)).map((c) => c.id).length).toBeLessThan(vorher.length);
    // … und wieder aus.
    const nachher = sortiere(filterCoursesByRadius(kurse, { center: null, radiusKm: 0, placesIndex: index }));
    expect(nachher.map((c) => c.id)).toEqual(vorher);
  });

  it('ein Onlinekurs ist nach dem Zurücksetzen wieder dabei', () => {
    expect(filtere(kurse, 50).map((c) => c.id)).not.toContain('r-online');
    expect(sortiere(kurse).map((c) => c.id)).toContain('r-online');
  });
});
