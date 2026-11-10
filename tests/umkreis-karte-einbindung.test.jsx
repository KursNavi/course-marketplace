/**
 * Einbindung der Karte — die Punkte aus der Rückmeldung zur ersten Preview.
 *
 * Verifiziert:
 *   1  REGRESSION: Die Ortstabelle wird auch ohne aktiven Umkreis geladen.
 *      Vorher lud sie nur die Umkreissuche — wer direkt auf «Karte» wechselte,
 *      sah deshalb eine leere Karte mit dem Hinweis, es gebe keine Kursorte.
 *   2  Die Karte unterscheidet «lädt noch» von «es gibt keine Kursorte».
 *   3  Mausrad-Zoom lässt sich per Klick in die Karte freischalten, ohne das
 *      Scrollen der Seite zu verschlucken.
 *   4  Das Umkreis-Feld steht in der Seitenleiste NACH «Gezielt suchen» und
 *      «Verfeinern».
 *   5  Die Standortkarte auf der Kursdetailseite zeigt den Veranstaltungsort —
 *      und erscheint bei Onlinekursen oder ohne zuordenbaren Ort gar nicht.
 */

import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildPlacesIndex } from '../src/lib/swissPlaces.js';

const appSource = readFileSync(resolve('src/App.jsx'), 'utf8');
const mapSource = readFileSync(resolve('src/components/CourseMap.jsx'), 'utf8');
const searchSource = readFileSync(resolve('src/components/SearchPageView.jsx'), 'utf8');

const TEST_INDEX = buildPlacesIndex({
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
    ['6003', 'Luzern', 'LU', 47.0502, 8.3093, 0],
  ],
});

// Die echte Karte zieht Leaflet nach — in der Testumgebung gibt es kein
// Layout, darum hier ein Platzhalter, der nur die Übergabe sichtbar macht.
vi.mock('../src/components/CourseMap', () => ({
  default: ({ markers, heightClass, popupMode, footnote }) => (
    <div
      data-testid="course-map-stub"
      data-marker={markers.length}
      data-height={heightClass}
      data-popupmode={popupMode}
      data-footnote={String(footnote)}
    />
  ),
}));

vi.mock('../src/lib/swissPlaces', async (importOriginal) => {
  const echt = await importOriginal();
  return { ...echt, loadSwissPlaces: () => Promise.resolve(TEST_INDEX) };
});

afterEach(cleanup);

describe('1 — REGRESSION: Ortstabelle auch für die Kartenansicht laden', () => {
  it('der Ladeauslöser prüft Umkreis UND Kartenansicht', () => {
    // Vorher stand hier nur `radiusOrigin`. Ohne searchMapView blieb die
    // Ortstabelle aus und die Karte hatte nichts anzuzeigen.
    expect(appSource).toMatch(/if \(\(radiusOrigin \|\| searchMapView\) && !placesIndex\) ensurePlacesIndex\(\)/);
  });

  it('der Effekt hört auch auf Änderungen der Kartenansicht', () => {
    expect(appSource).toMatch(/\[radiusOrigin, searchMapView, placesIndex, ensurePlacesIndex\]/);
  });

  it('die Karte erfährt, ob die Ortstabelle schon da ist', () => {
    expect(appSource).toMatch(/placesReady=\{Boolean\(placesIndex\)\}/);
    expect(searchSource).toMatch(/placesReady=\{Boolean\(placesReady \?\? placesIndex\)\}/);
  });
});

describe('2 — «lädt noch» ist nicht dasselbe wie «keine Kursorte»', () => {
  it('die Karte zeigt während des Ladens einen eigenen Text', () => {
    expect(mapSource).toMatch(/Kursorte werden geladen/);
  });

  it('die Meldung «keine Kursorte» kommt erst, wenn die Tabelle da ist', () => {
    expect(mapSource).toMatch(/!placesReady[\s\S]{0,120}Kursorte werden geladen/);
  });
});

describe('3 — Mausrad-Zoom', () => {
  it('startet gesperrt, damit die Karte das Seiten-Scrollen nicht verschluckt', () => {
    expect(mapSource).toMatch(/scrollWheelZoom: false/);
  });

  it('wird durch einen Klick in die Karte freigeschaltet', () => {
    expect(mapSource).toMatch(/map\.on\('click'[\s\S]{0,120}scrollWheelZoom\.enable\(\)/);
  });

  it('wird beim Verlassen der Karte wieder gesperrt', () => {
    expect(mapSource).toMatch(/map\.on\('mouseout'[\s\S]{0,120}scrollWheelZoom\.disable\(\)/);
  });

  it('erklärt beim Scrollen über der gesperrten Karte, wie es geht', () => {
    expect(mapSource).toMatch(/map-wheel-hint/);
    expect(mapSource).toMatch(/in die Karte klicken/);
  });

  it('hört passiv auf das Mausrad und blockiert das Scrollen nicht', () => {
    expect(mapSource).toMatch(/addEventListener\('wheel'[\s\S]{0,400}\{ passive: true \}/);
  });
});

describe('4 — Reihenfolge in der Seitenleiste', () => {
  const pos = (muster) => searchSource.indexOf(muster);

  it('Umkreis steht nach «Gezielt suchen» und «Verfeinern»', () => {
    const gezielt = pos('SCHRITT 2: GEZIELT SUCHEN');
    const verfeinern = pos('SCHRITT 3: VERFEINERN');
    const umkreis = pos('SCHRITT 4: UMKREIS');
    expect(gezielt).toBeGreaterThan(0);
    expect(verfeinern).toBeGreaterThan(gezielt);
    expect(umkreis).toBeGreaterThan(verfeinern);
  });

  it('das Umkreis-Feld selbst steht hinter dem Verfeinern-Abschnitt', () => {
    expect(pos('<RadiusSearchPanel')).toBeGreaterThan(pos('SCHRITT 3: VERFEINERN'));
  });
});

describe('5 — Standortkarte auf der Kursdetailseite', () => {
  const kurs = (over = {}) => ({ id: 'k1', title: 'Testkurs', ...over });

  async function zeichne(course) {
    const { default: CourseLocationMap } = await import('../src/components/CourseLocationMap.jsx');
    return render(<CourseLocationMap course={course} />);
  }

  it('zeigt den Veranstaltungsort eines Präsenzkurses', async () => {
    await zeichne(kurs({
      course_events: [{ start_date: '2027-03-01', canton: 'Zürich', city: 'Zürich' }],
    }));
    await waitFor(() => expect(screen.getByTestId('course-map-stub')).toBeInTheDocument());
    expect(screen.getByTestId('course-map-stub').dataset.marker).toBe('1');
    expect(screen.getByText('Wo der Kurs stattfindet')).toBeInTheDocument();
  });

  it('nutzt eine kleine Kartenhöhe und das Ortsfenster statt der Kursliste', async () => {
    await zeichne(kurs({ city: 'Luzern', canton: 'Luzern' }));
    await waitFor(() => expect(screen.getByTestId('course-map-stub')).toBeInTheDocument());
    const stub = screen.getByTestId('course-map-stub');
    expect(stub.dataset.height).toBe('h-56');
    expect(stub.dataset.popupmode).toBe('place');
    expect(stub.dataset.footnote).toBe('false');
  });

  it('kennzeichnet die Position ausdrücklich als ungefähr', async () => {
    await zeichne(kurs({ city: 'Zürich', canton: 'Zürich' }));
    await waitFor(() => expect(screen.getByTestId('course-map-stub')).toBeInTheDocument());
    expect(screen.getByText(/ungefähr/)).toBeInTheDocument();
  });

  it('zeigt mehrere Standorte und benennt sie', async () => {
    await zeichne(kurs({
      course_locations: [
        { location_type: 'presence', city: 'Zürich', canton: 'Zürich', sort_order: 0 },
        { location_type: 'presence', city: 'Luzern', canton: 'Luzern', sort_order: 1 },
      ],
    }));
    await waitFor(() => expect(screen.getByTestId('course-map-stub')).toBeInTheDocument());
    expect(screen.getByTestId('course-map-stub').dataset.marker).toBe('2');
    expect(screen.getByText(/an 2 Orten statt/)).toBeInTheDocument();
  });

  it('erscheint bei einem reinen Onlinekurs gar nicht', async () => {
    await zeichne(kurs({ canton: 'Online' }));
    await waitFor(() => expect(screen.queryByTestId('course-map-stub')).toBeNull());
    expect(screen.queryByTestId('course-location-map')).toBeNull();
  });

  it('erscheint ohne zuordenbaren Ort gar nicht — statt einen Punkt zu raten', async () => {
    await zeichne(kurs({ canton: 'Zürich' })); // nur Kanton, keine Ortschaft
    await waitFor(() => expect(screen.queryByTestId('course-map-stub')).toBeNull());
    expect(screen.queryByTestId('course-location-map')).toBeNull();
  });

  it('zeigt beim Hybridkurs den physischen Ort', async () => {
    await zeichne(kurs({
      delivery_types: ['presence', 'online_live'],
      course_events: [
        { start_date: '2027-03-01', canton: null, location: 'Online' },
        { start_date: '2027-03-08', canton: 'Luzern', city: 'Luzern' },
      ],
    }));
    await waitFor(() => expect(screen.getByTestId('course-map-stub')).toBeInTheDocument());
    expect(screen.getByTestId('course-map-stub').dataset.marker).toBe('1');
  });
});
