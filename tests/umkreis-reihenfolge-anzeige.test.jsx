/**
 * REGRESSION: Der Umkreisfilter darf die relative Reihenfolge der
 * verbleibenden Kurse nicht verändern — geprüft am VOLLSTÄNDIGEN
 * Anzeigeablauf.
 *
 * Gemeldetes Fehlerbild:
 *   Im selben Seitenaufruf stand «Sachbearbeiter/-in Sozialversicherungen»
 *   ohne Umkreis vor «Trash TV and Painting», mit Umkreis «8000 Zürich,
 *   25 km» war es umgekehrt. Nach Entfernung wurde nicht sortiert.
 *
 * Ursache:
 *   Die Streuung gleichrangiger Kurse in sortCoursesByRelevance stammte aus
 *   der POSITION eines Kurses in der jeweils übergebenen Liste
 *   (`Math.sin(seed * 10000 + i + 1)`). Entfernte der Umkreisfilter einen
 *   Kurs, rutschten alle folgenden eine Position vor und bekamen damit einen
 *   anderen Streuwert — genug, um zwei fast gleichrangige Kurse zu tauschen.
 *   Das galt nicht nur für den Umkreis, sondern für jeden Filter.
 *
 * Behebung:
 *   Der Streuwert kommt jetzt aus Seed UND Kurs-ID, nicht mehr aus der
 *   Position. Gleichrangige Kurse werden weiterhin gestreut, der Seed wechselt
 *   weiterhin pro Seitenaufruf — aber der Wert eines Kurses hängt nicht mehr
 *   davon ab, welche anderen Kurse danebenstehen.
 *
 * Dieser Test prüft bewusst die echte Komponente SearchPageView und liest die
 * tatsächlich gerenderte Reihenfolge aus dem DOM. Ein Test gegen die
 * Sortierfunktion allein hätte den Fehler ebenfalls gezeigt, aber nicht
 * belegt, dass die ANGEZEIGTE Liste stimmt.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../src/hooks/useTaxonomy', () => ({
  useTaxonomy: () => ({ areas: [], types: [], specialties: [], focuses: [], courseCounts: { level1: {}, level2: {}, level3: {}, level4: {} } }),
}));
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));
vi.mock('../src/lib/siteConfig', () => ({
  BASE_URL: 'https://kursnavi.ch',
  buildCoursePath: (course) => `/courses/test/${course?.id ?? 'unknown'}`,
}));
vi.mock('../src/lib/themeWorldService', () => ({
  fetchPublishedThemeWorldAreaLabels: () => Promise.resolve(new Map()),
}));
vi.mock('../src/lib/analytics', () => ({
  trackCourseCardCta: vi.fn(),
  trackSearch: vi.fn(),
}));
vi.mock('../src/lib/contentsquare', () => ({
  trackContentsquareSearchFilterApplied: vi.fn(),
}));

import SearchPageView from '../src/components/SearchPageView';
import { buildPlacesIndex } from '../src/lib/swissPlaces';
import { createGeoResolver, filterCoursesByRadius } from '../src/lib/courseGeo';

const index = buildPlacesIndex({
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
    ['8003', 'Wiedikon', 'ZH', 47.3700, 8.5200, 0],
    ['8600', 'Dübendorf', 'ZH', 47.3975, 8.6186, 0],
    ['8400', 'Winterthur', 'ZH', 47.5000, 8.7241, 0],
    ['5000', 'Aarau', 'AG', 47.3887, 8.0483, 0],
    ['3000', 'Bern', 'BE', 46.9480, 7.4474, 0],
    ['1200', 'Genève', 'GE', 46.2044, 6.1432, 0],
  ],
});
const ZUERICH = { id: 'plz:8001:Zürich', label: '8001 Zürich (ZH)', lat: 47.3721, lng: 8.5417, source: 'place' };

function kurs(id, title, { ort, kanton = 'Zürich', prio = false, booking = 1.0 } = {}) {
  return {
    id,
    title,
    status: 'published',
    image_url: null,
    canton: kanton,
    instructor_name: 'Test Trainer',
    booking_type: 'platform',
    price: 100,
    is_prio: prio,
    booking_factor: booking,
    delivery_types: ['presence'],
    keywords: [],
    category_specialty: '',
    category_focus: '',
    all_categories: [{ category_type: 'professionell', category_area: 'it_digital' }],
    course_events: ort ? [{ start_date: '2027-05-10', canton: kanton, city: ort }] : [],
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function makeProps(overrides = {}) {
  const noop = () => {};
  return {
    courses: [], filteredCoursesPreCategory: [], coursesBeforeRadius: [],
    searchQuery: '', setSearchQuery: vi.fn(),
    searchType: '', setSearchType: vi.fn(),
    searchArea: '', setSearchArea: vi.fn(),
    searchSpecialty: '', setSearchSpecialty: vi.fn(),
    searchFocus: '', setSearchFocus: vi.fn(),
    selectedLocations: [], setSelectedLocations: vi.fn(),
    locMenuOpen: false, setLocMenuOpen: noop, locMenuRef: { current: null },
    loading: false, filteredCourses: [],
    setSelectedCourse: noop, setView: noop,
    t: { search_refine: '…', currency: 'CHF', lbl_max_price: 'Max', opt_all_levels: 'Alle', lbl_professional_filter: 'Verifiziert', lbl_direct_booking_filter: 'Direkt' },
    filterDateFrom: '', setFilterDateFrom: vi.fn(),
    filterDateTo: '', setFilterDateTo: vi.fn(),
    filterPriceMax: '', setFilterPriceMax: vi.fn(),
    filterLevel: 'All', setFilterLevel: vi.fn(),
    filterPro: false, setFilterPro: vi.fn(),
    filterDirectBooking: false, setFilterDirectBooking: vi.fn(),
    selectedLanguages: [], setSelectedLanguages: vi.fn(),
    langMenuOpen: false, setLangMenuOpen: noop, langMenuRef: { current: null },
    selectedDeliveryTypes: [], setSelectedDeliveryTypes: vi.fn(),
    deliveryMenuOpen: false, setDeliveryMenuOpen: noop, deliveryMenuRef: { current: null },
    savedCourseIds: [], onToggleSaveCourse: noop,
    user: null,
    selectedSaule: '', setSelectedSaule: vi.fn(),
    selectedKursart: '', setSelectedKursart: vi.fn(),
    fetchError: false, onRetry: vi.fn(),
    setSelectedCatPath: vi.fn(),
    autoType: false, setAutoType: vi.fn(),
    radiusOrigin: null, setRadiusOrigin: vi.fn(),
    radiusKm: 0, setRadiusKm: vi.fn(),
    radiusActive: false, radiusCantons: [], onResetRadius: vi.fn(),
    placesIndex: index, placesLoading: false, placesError: false, placesReady: true,
    onEnsurePlaces: noop,
    resolveCourseGeo: createGeoResolver(index),
    mapView: false, setMapView: vi.fn(),
    ...overrides,
  };
}

/** Rendert die echte Suchseite und liest die angezeigte Reihenfolge aus dem DOM. */
function angezeigteReihenfolge(props) {
  const { unmount } = render(<SearchPageView {...makeProps(props)} />);
  const titel = screen.getByTestId('course-grid').querySelectorAll('article h3');
  const liste = [...titel].map((el) => el.textContent.trim());
  unmount();
  return liste;
}

/** Der Umkreisfilter genau so, wie App.jsx ihn anwendet. */
function imUmkreis(courses, radiusKm, cantons = []) {
  return filterCoursesByRadius(courses, {
    center: ZUERICH, radiusKm, placesIndex: index,
    resolveGeo: createGeoResolver(index), cantons,
  });
}

// Math.random liefert den Seed pro Seitenaufruf. Fest verdrahtet, damit beide
// Durchläufe denselben Seitenaufruf nachstellen — genau wie in der Beobachtung.
let randomSpy;
const setzeSeitenaufruf = (seed) => randomSpy.mockReturnValue(seed);
beforeEach(() => { randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.4242); });
afterEach(() => { randomSpy.mockRestore(); cleanup(); });

/**
 * Mehrere Seitenaufrufe. Mit der alten, positionsabhängigen Streuung drehte
 * sich die Reihenfolge der beiden gemeldeten Kurse bei rund zwei Dritteln
 * aller Seeds — ein einzelner fester Seed hätte den Fehler darum nur mit
 * Glück gezeigt.
 */
const SEITENAUFRUFE = [0.0005, 0.123, 0.4242, 0.5, 0.777, 0.9991];

// ---------------------------------------------------------------------------

describe('REGRESSION: gemeldeter Fall «Sachbearbeiter» vs. «Trash TV and Painting»', () => {
  // Nachgebaut mit denselben Titeln: zwei gleichrangige Kurse, zwischen denen
  // allein die Streuung entscheidet, plus Kurse, die der Umkreis entfernt.
  const sachbearbeiter = kurs('sb', 'Sachbearbeiter/-in Sozialversicherungen', { ort: 'Zürich' });
  const trashTv = kurs('tv', 'Trash TV and Painting', { ort: 'Wiedikon' });
  const weitWeg1 = kurs('bern', 'Kurs in Bern', { ort: 'Bern', kanton: 'Bern' });
  const weitWeg2 = kurs('genf', 'Kurs in Genf', { ort: 'Genève', kanton: 'Genève' });
  const alle = [weitWeg1, sachbearbeiter, weitWeg2, trashTv];

  it('der Umkreis entfernt genau die entfernten Kurse', () => {
    expect(imUmkreis(alle, 25).map((c) => c.id)).toEqual(['sb', 'tv']);
  });

  it.each(SEITENAUFRUFE)('Seitenaufruf %f: die relative Reihenfolge der gemeinsamen Treffer bleibt gleich', (seed) => {
    setzeSeitenaufruf(seed);
    const ohne = angezeigteReihenfolge({ courses: alle, filteredCourses: alle, filteredCoursesPreCategory: alle, coursesBeforeRadius: alle });
    const treffer = imUmkreis(alle, 25);
    const mit = angezeigteReihenfolge({
      courses: alle, filteredCourses: treffer, filteredCoursesPreCategory: treffer, coursesBeforeRadius: alle,
      radiusOrigin: ZUERICH, radiusKm: 25, radiusActive: true,
    });

    expect(mit).toEqual(ohne.filter((titel) => mit.includes(titel)));
  });

  it.each(SEITENAUFRUFE)('Seitenaufruf %f: die beiden gemeldeten Kurse stehen weiterhin gleich zueinander', (seed) => {
    setzeSeitenaufruf(seed);
    const nurBeide = (liste) => liste.filter((t) => t === sachbearbeiter.title || t === trashTv.title);
    const ohne = nurBeide(angezeigteReihenfolge({ courses: alle, filteredCourses: alle, filteredCoursesPreCategory: alle, coursesBeforeRadius: alle }));
    const treffer = imUmkreis(alle, 25);
    const mit = nurBeide(angezeigteReihenfolge({
      courses: alle, filteredCourses: treffer, filteredCoursesPreCategory: treffer, coursesBeforeRadius: alle,
      radiusOrigin: ZUERICH, radiusKm: 25, radiusActive: true,
    }));
    expect(mit).toEqual(ohne);
  });
});

describe('relative Reihenfolge über alle Radiusstufen', () => {
  const alle = [
    kurs('a', 'A nah', { ort: 'Wiedikon' }),
    kurs('b', 'B mittel', { ort: 'Dübendorf' }),
    kurs('c', 'C weiter', { ort: 'Winterthur' }),
    kurs('d', 'D fern', { ort: 'Aarau', kanton: 'Aargau' }),
    kurs('e', 'E sehr fern', { ort: 'Bern', kanton: 'Bern' }),
    kurs('f', 'F ohne Ort'),
    kurs('g', 'G nah zwei', { ort: 'Zürich' }),
  ];

  const ohne = () => angezeigteReihenfolge({ courses: alle, filteredCourses: alle, filteredCoursesPreCategory: alle, coursesBeforeRadius: alle });

  it.each(SEITENAUFRUFE.flatMap((seed) => [5, 10, 25, 50].map((km) => [seed, km])))(
    'Seitenaufruf %f, %i km: die Treffer behalten ihre Reihenfolge aus der vollen Liste', (seed, km) => {
    setzeSeitenaufruf(seed);
    const basis = ohne();
    const treffer = imUmkreis(alle, km);
    const mit = angezeigteReihenfolge({
      courses: alle, filteredCourses: treffer, filteredCoursesPreCategory: treffer, coursesBeforeRadius: alle,
      radiusOrigin: ZUERICH, radiusKm: km, radiusActive: true,
    });
    expect(mit).toEqual(basis.filter((titel) => mit.includes(titel)));
  });

  it('beim Wechsel zwischen zwei Radiusstufen bleibt die Reihenfolge der gemeinsamen Treffer gleich', () => {
    const bei10 = angezeigteReihenfolge({
      courses: alle, filteredCourses: imUmkreis(alle, 10), filteredCoursesPreCategory: imUmkreis(alle, 10), coursesBeforeRadius: alle,
      radiusOrigin: ZUERICH, radiusKm: 10, radiusActive: true,
    });
    const bei50 = angezeigteReihenfolge({
      courses: alle, filteredCourses: imUmkreis(alle, 50), filteredCoursesPreCategory: imUmkreis(alle, 50), coursesBeforeRadius: alle,
      radiusOrigin: ZUERICH, radiusKm: 50, radiusActive: true,
    });
    expect(bei50.filter((t) => bei10.includes(t))).toEqual(bei10);
  });

  it('nach dem Zurücksetzen steht wieder die ursprüngliche Liste da', () => {
    const vorher = ohne();
    angezeigteReihenfolge({
      courses: alle, filteredCourses: imUmkreis(alle, 5), filteredCoursesPreCategory: imUmkreis(alle, 5), coursesBeforeRadius: alle,
      radiusOrigin: ZUERICH, radiusKm: 5, radiusActive: true,
    });
    expect(ohne()).toEqual(vorher);
  });
});

describe('ein näher liegender Kurs zieht nicht an einem höher priorisierten vorbei', () => {
  const nahOhnePrio = kurs('nah', 'Nah ohne Hervorhebung', { ort: 'Wiedikon', prio: false });
  const fernMitPrio = kurs('fern', 'Weiter weg mit Hervorhebung', { ort: 'Winterthur', prio: true });
  const alle = [nahOhnePrio, fernMitPrio];

  it('der hervorgehobene Kurs steht in der Anzeige vorne — mit und ohne Umkreis', () => {
    const ohne = angezeigteReihenfolge({ courses: alle, filteredCourses: alle, filteredCoursesPreCategory: alle, coursesBeforeRadius: alle });
    expect(ohne).toEqual(['Weiter weg mit Hervorhebung', 'Nah ohne Hervorhebung']);

    const treffer = imUmkreis(alle, 25);
    expect(treffer).toHaveLength(2);
    const mit = angezeigteReihenfolge({
      courses: alle, filteredCourses: treffer, filteredCoursesPreCategory: treffer, coursesBeforeRadius: alle,
      radiusOrigin: ZUERICH, radiusKm: 25, radiusActive: true,
    });
    expect(mit).toEqual(ohne);
  });

  it('auch wenn der nähere Kurs in der Eingabeliste zuerst steht', () => {
    const treffer = imUmkreis([nahOhnePrio, fernMitPrio], 25);
    const mit = angezeigteReihenfolge({
      courses: treffer, filteredCourses: treffer, filteredCoursesPreCategory: treffer, coursesBeforeRadius: treffer,
      radiusOrigin: ZUERICH, radiusKm: 25, radiusActive: true,
    });
    expect(mit[0]).toBe('Weiter weg mit Hervorhebung');
  });
});

describe('die Streuung hängt am Kurs, nicht an seiner Position', () => {
  const basis = [
    kurs('x1', 'X1', { ort: 'Zürich' }),
    kurs('x2', 'X2', { ort: 'Zürich' }),
    kurs('x3', 'X3', { ort: 'Zürich' }),
    kurs('x4', 'X4', { ort: 'Zürich' }),
    kurs('x5', 'X5', { ort: 'Zürich' }),
  ];

  it.each(SEITENAUFRUFE)('Seitenaufruf %f: das Entfernen eines beliebigen Kurses verschiebt die übrigen nicht', (seed) => {
    setzeSeitenaufruf(seed);
    const voll = angezeigteReihenfolge({ courses: basis, filteredCourses: basis, filteredCoursesPreCategory: basis, coursesBeforeRadius: basis });

    basis.forEach((weg) => {
      const rest = basis.filter((c) => c.id !== weg.id);
      const gekuerzt = angezeigteReihenfolge({ courses: basis, filteredCourses: rest, filteredCoursesPreCategory: rest, coursesBeforeRadius: basis });
      expect(gekuerzt).toEqual(voll.filter((t) => t !== weg.title));
    });
  });

  it('auch die Eingabereihenfolge ändert nichts an der Anzeige', () => {
    const vorwaerts = angezeigteReihenfolge({ courses: basis, filteredCourses: basis, filteredCoursesPreCategory: basis, coursesBeforeRadius: basis });
    const rueckwaerts = [...basis].reverse();
    const anders = angezeigteReihenfolge({ courses: rueckwaerts, filteredCourses: rueckwaerts, filteredCoursesPreCategory: rueckwaerts, coursesBeforeRadius: rueckwaerts });
    expect(anders).toEqual(vorwaerts);
  });
});
