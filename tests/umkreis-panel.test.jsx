/**
 * Bedienfeld der Umkreissuche.
 *
 * Verifiziert:
 *   1  Ort/PLZ eingeben, aus mehreren Treffern auswählen, Radius setzen
 *   2  25 km werden erst beim Wählen eines Ausgangsorts vorbelegt
 *   3  Standortfreigabe: zugelassen, abgelehnt, Zeitüberschreitung, nicht unterstützt
 *   4  Es wird NIE ohne Klick nach dem Standort gefragt
 *   5  Die manuelle Eingabe bleibt in jedem Fehlerfall nutzbar
 *   6  Zurücksetzen und der erklärende Hinweis zu Online/ohne Ort
 */

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import RadiusSearchPanel from '../src/components/RadiusSearchPanel.jsx';
import { buildPlacesIndex } from '../src/lib/swissPlaces.js';
import { DEFAULT_RADIUS_KM } from '../src/lib/courseGeo.js';

const index = buildPlacesIndex({
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
    ['8400', 'Winterthur', 'ZH', 47.5, 8.7241, 0],
    ['9470', 'Buchs SG', 'SG', 47.1667, 9.4667, 0],
    ['5033', 'Buchs AG', 'AG', 47.3833, 8.0667, 0],
  ],
});

const basis = {
  origin: null,
  onOriginChange: () => {},
  radiusKm: 0,
  onRadiusChange: () => {},
  onReset: () => {},
  placesIndex: index,
  placesLoading: false,
  placesError: false,
  onEnsurePlaces: () => {},
  geoStats: null,
};

const zeichne = (over = {}) => render(<RadiusSearchPanel {...basis} {...over} />);

/** Ersetzt navigator.geolocation für die Dauer eines Tests. */
function setzeGeolocation(impl) {
  const original = navigator.geolocation;
  Object.defineProperty(navigator, 'geolocation', { value: impl, configurable: true, writable: true });
  return () => Object.defineProperty(navigator, 'geolocation', { value: original, configurable: true, writable: true });
}

let geolocationZuruecksetzen = null;

beforeEach(() => { geolocationZuruecksetzen = null; });
afterEach(() => {
  if (geolocationZuruecksetzen) geolocationZuruecksetzen();
  cleanup();
});

describe('1 — Ort oder Postleitzahl wählen', () => {
  it('zeigt erst ab zwei Zeichen Vorschläge', () => {
    zeichne();
    const feld = screen.getByTestId('radius-place-input');
    fireEvent.change(feld, { target: { value: '8' } });
    expect(screen.queryByTestId('radius-place-suggestions')).toBeNull();
    fireEvent.change(feld, { target: { value: '80' } });
    expect(screen.getByTestId('radius-place-suggestions')).toBeInTheDocument();
  });

  it('findet einen Ort über die Postleitzahl', () => {
    zeichne();
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: '8001' } });
    expect(screen.getByText('8001 Zürich (ZH)')).toBeInTheDocument();
  });

  it('findet einen Ort über den Namen, auch ohne Umlaut', () => {
    zeichne();
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: 'zuerich' } });
    expect(screen.getByText('Zürich (ZH)')).toBeInTheDocument();
  });

  it('lässt bei mehreren gleichnamigen Orten eindeutig auswählen', () => {
    zeichne();
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: 'Buchs' } });
    const optionen = screen.getAllByTestId('radius-place-option').map((b) => b.textContent);
    expect(optionen.some((o) => o.includes('(SG)'))).toBe(true);
    expect(optionen.some((o) => o.includes('(AG)'))).toBe(true);
  });

  it('meldet verständlich, wenn kein Ort passt', () => {
    zeichne();
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: 'Hogwarts' } });
    expect(screen.getByText('Kein passender Ort gefunden.')).toBeInTheDocument();
  });

  it('lädt die Ortstabelle erst bei der ersten Eingabe', () => {
    const onEnsurePlaces = vi.fn();
    zeichne({ onEnsurePlaces, placesIndex: null });
    expect(onEnsurePlaces).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: 'Zür' } });
    expect(onEnsurePlaces).toHaveBeenCalled();
  });

  it('gibt den gewählten Ort mit Koordinaten weiter', () => {
    const onOriginChange = vi.fn();
    zeichne({ onOriginChange });
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: '8001' } });
    fireEvent.click(screen.getByText('8001 Zürich (ZH)'));
    expect(onOriginChange).toHaveBeenCalledWith(expect.objectContaining({
      label: '8001 Zürich (ZH)',
      lat: 47.3721,
      lng: 8.5417,
      source: 'place',
    }));
  });

  it('lässt sich mit der Tastatur bedienen', () => {
    const onOriginChange = vi.fn();
    zeichne({ onOriginChange });
    const feld = screen.getByTestId('radius-place-input');
    fireEvent.change(feld, { target: { value: 'Buchs' } });
    fireEvent.keyDown(feld, { key: 'ArrowDown' });
    fireEvent.keyDown(feld, { key: 'Enter' });
    expect(onOriginChange).toHaveBeenCalled();
  });

  it('schliesst die Liste mit Escape', () => {
    zeichne();
    const feld = screen.getByTestId('radius-place-input');
    fireEvent.change(feld, { target: { value: '8001' } });
    fireEvent.keyDown(feld, { key: 'Escape' });
    expect(screen.queryByTestId('radius-place-suggestions')).toBeNull();
  });
});

describe('2 — Umkreis setzen', () => {
  it('bietet genau 5, 10, 25 und 50 km an', () => {
    zeichne();
    [5, 10, 25, 50].forEach((km) => {
      expect(screen.getByTestId(`btn-radius-${km}`)).toBeInTheDocument();
    });
  });

  it('sperrt die Umkreiswahl, solange kein Ausgangsort gewählt ist', () => {
    zeichne();
    expect(screen.getByTestId('btn-radius-25')).toBeDisabled();
    expect(screen.getByText('Wähle zuerst einen Ort oder verwende deinen Standort.')).toBeInTheDocument();
  });

  it('belegt nach Wahl eines Ortes 25 km vor', () => {
    const onRadiusChange = vi.fn();
    zeichne({ onRadiusChange, radiusKm: 0 });
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: '8001' } });
    fireEvent.click(screen.getByText('8001 Zürich (ZH)'));
    expect(onRadiusChange).toHaveBeenCalledWith(DEFAULT_RADIUS_KM);
  });

  it('überschreibt einen bereits gewählten Umkreis nicht', () => {
    const onRadiusChange = vi.fn();
    zeichne({ onRadiusChange, radiusKm: 5 });
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: '8001' } });
    fireEvent.click(screen.getByText('8001 Zürich (ZH)'));
    expect(onRadiusChange).not.toHaveBeenCalled();
  });

  it('meldet eine Änderung des Umkreises', () => {
    const onRadiusChange = vi.fn();
    zeichne({ onRadiusChange, origin: { label: 'Zürich (ZH)', lat: 47.37, lng: 8.54, source: 'place' } });
    fireEvent.click(screen.getByTestId('btn-radius-10'));
    expect(onRadiusChange).toHaveBeenCalledWith(10);
  });

  it('zeigt Ausgangsort und Umkreis in Klartext, inklusive Hinweis auf Luftlinie', () => {
    zeichne({
      origin: { label: '8001 Zürich (ZH)', lat: 47.37, lng: 8.54, source: 'place' },
      radiusKm: 25,
      resultCount: 7,
    });
    const box = screen.getByTestId('radius-active-summary');
    expect(box).toHaveTextContent('25 km');
    expect(box).toHaveTextContent('8001 Zürich (ZH)');
    expect(box).toHaveTextContent('Luftlinie');
    expect(box).toHaveTextContent('7 Kurse im Umkreis');
  });
});

describe('3/4 — Standortfreigabe', () => {
  it('fragt OHNE Klick nie nach dem Standort', () => {
    const getCurrentPosition = vi.fn();
    geolocationZuruecksetzen = setzeGeolocation({ getCurrentPosition });
    zeichne();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    // Auch das Tippen im Ortsfeld löst keine Standortabfrage aus.
    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: '8001' } });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('übernimmt den Standort nach erlaubter Freigabe', async () => {
    geolocationZuruecksetzen = setzeGeolocation({
      getCurrentPosition: (ok) => ok({ coords: { latitude: 47.37, longitude: 8.54 } }),
    });
    const onOriginChange = vi.fn();
    const onRadiusChange = vi.fn();
    zeichne({ onOriginChange, onRadiusChange });

    fireEvent.click(screen.getByTestId('btn-use-device-location'));

    await waitFor(() => expect(onOriginChange).toHaveBeenCalled());
    expect(onOriginChange).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Mein Standort',
      lat: 47.37,
      lng: 8.54,
      source: 'device',
      id: '',
    }));
    expect(onRadiusChange).toHaveBeenCalledWith(DEFAULT_RADIUS_KM);
  });

  it.each([
    [1, /nicht erlaubt/i],
    [2, /liess sich nicht bestimmen/i],
    [3, /zu lange gedauert/i],
  ])('erklärt Fehlercode %i verständlich', async (code, muster) => {
    geolocationZuruecksetzen = setzeGeolocation({
      getCurrentPosition: (_ok, fail) => fail({ code }),
    });
    const onOriginChange = vi.fn();
    zeichne({ onOriginChange });

    fireEvent.click(screen.getByTestId('btn-use-device-location'));

    await waitFor(() => expect(screen.getByTestId('radius-location-error')).toBeInTheDocument());
    expect(screen.getByTestId('radius-location-error').textContent).toMatch(muster);
    expect(onOriginChange).not.toHaveBeenCalled();
  });

  it('erklärt einen Browser ohne Standortbestimmung', async () => {
    geolocationZuruecksetzen = setzeGeolocation(undefined);
    zeichne();
    fireEvent.click(screen.getByTestId('btn-use-device-location'));
    await waitFor(() => expect(screen.getByTestId('radius-location-error')).toBeInTheDocument());
    expect(screen.getByTestId('radius-location-error').textContent).toMatch(/unterstützt/i);
  });

  it('5 — die manuelle Eingabe bleibt nach einem Fehler bedienbar', async () => {
    geolocationZuruecksetzen = setzeGeolocation({
      getCurrentPosition: (_ok, fail) => fail({ code: 1 }),
    });
    const onOriginChange = vi.fn();
    zeichne({ onOriginChange });

    fireEvent.click(screen.getByTestId('btn-use-device-location'));
    await waitFor(() => expect(screen.getByTestId('radius-location-error')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('radius-place-input'), { target: { value: '8400' } });
    fireEvent.click(screen.getByText('8400 Winterthur (ZH)'));
    expect(onOriginChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'place' }));
  });
});

describe('6 — Zurücksetzen und erklärender Hinweis', () => {
  it('zeigt Zurücksetzen erst bei aktivem Umkreis', () => {
    const { rerender } = zeichne();
    expect(screen.queryByTestId('btn-radius-reset')).toBeNull();
    rerender(<RadiusSearchPanel
      {...basis}
      origin={{ label: 'Zürich (ZH)', lat: 47.37, lng: 8.54, source: 'place' }}
      radiusKm={25}
    />);
    expect(screen.getByTestId('btn-radius-reset')).toBeInTheDocument();
  });

  it('meldet das Zurücksetzen nach oben', () => {
    const onReset = vi.fn();
    zeichne({ onReset, origin: { label: 'Zürich (ZH)', lat: 47.37, lng: 8.54, source: 'place' }, radiusKm: 25 });
    fireEvent.click(screen.getByTestId('btn-radius-reset'));
    expect(onReset).toHaveBeenCalled();
  });

  it('erklärt, dass Onlinekurse und Kurse ohne Ort nicht räumlich zählen', () => {
    zeichne({
      origin: { label: 'Zürich (ZH)', lat: 47.37, lng: 8.54, source: 'place' },
      radiusKm: 25,
      geoStats: { located: 10, online: 3, ausland: 1, unknown: 2 },
    });
    const hinweis = screen.getByTestId('radius-exclusion-hint');
    expect(hinweis).toHaveTextContent(/Onlinekurse/);
    expect(hinweis).toHaveTextContent(/ohne eindeutig zuordenbaren Veranstaltungsort/);
  });

  it('zeigt den Hinweis nicht, wenn es nichts zu erklären gibt', () => {
    zeichne({
      origin: { label: 'Zürich (ZH)', lat: 47.37, lng: 8.54, source: 'place' },
      radiusKm: 25,
      geoStats: { located: 10, online: 0, ausland: 0, unknown: 0 },
    });
    expect(screen.queryByTestId('radius-exclusion-hint')).toBeNull();
  });
});
