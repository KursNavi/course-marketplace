/**
 * REGRESSION: Der Kartenausschnitt muss zum gewählten Umkreis passen.
 *
 * Gemeldetes Fehlerbild:
 *   Mit aktivem Umkreis startete die Karte mit einem Ausschnitt über die halbe
 *   Schweiz statt über den gewählten Umkreis — besonders auffällig auf dem
 *   Handy.
 *
 * Ursache:
 *   Der Ausschnitt wurde über `L.circle(...).getBounds()` berechnet. Ein
 *   Leaflet-Kreis kennt seine Eckpunkte aber erst, wenn er auf einer Karte
 *   liegt; ohne Karte wirft der Aufruf. Der Fehler lief in die
 *   Rückfallebene — und die zeigt die Landesmitte bei Zoomstufe 7.
 *
 * Behebung:
 *   `L.latLng(...).toBounds(durchmesserInMetern)` rechnet ohne Karte.
 *
 * Dieser Test hält beides fest: das Verhalten von Leaflet (damit die
 * Begründung überprüfbar bleibt) und dass der fehleranfällige Aufruf nicht
 * zurückkehrt.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import L from 'leaflet';

import { haversineKm } from '../src/lib/geoDistance.js';

const ZUERICH = { lat: 47.3721, lng: 8.5417 };
const quelle = readFileSync(resolve('src/components/CourseMap.jsx'), 'utf8');

describe('Leaflet-Verhalten, auf dem die Behebung beruht', () => {
  it('ein Kreis ohne Karte kann seine Eckpunkte NICHT liefern', () => {
    expect(() => L.circle(L.latLng(ZUERICH.lat, ZUERICH.lng), { radius: 25000 }).getBounds())
      .toThrow();
  });

  it('latLng().toBounds() rechnet ohne Karte', () => {
    const bounds = L.latLng(ZUERICH.lat, ZUERICH.lng).toBounds(50000);
    expect(bounds.getNorthEast().lat).toBeGreaterThan(bounds.getSouthWest().lat);
    expect(bounds.getNorthEast().lng).toBeGreaterThan(bounds.getSouthWest().lng);
  });

  it.each([5, 10, 25, 50])('der Ausschnitt für %i km umschliesst den Umkreis', (km) => {
    const bounds = L.latLng(ZUERICH.lat, ZUERICH.lng).toBounds(km * 2000);
    const norden = { lat: bounds.getNorth(), lng: ZUERICH.lng };
    const osten = { lat: ZUERICH.lat, lng: bounds.getEast() };

    // Der Rand liegt mindestens so weit weg wie der Radius — sonst wäre ein
    // Teil des Umkreises aussserhalb des sichtbaren Ausschnitts.
    expect(haversineKm(ZUERICH, norden)).toBeGreaterThanOrEqual(km - 0.5);
    expect(haversineKm(ZUERICH, osten)).toBeGreaterThanOrEqual(km - 0.5);
    // Und nicht unnötig weit: sonst wäre der Umkreis ein Fleck in der Ecke.
    expect(haversineKm(ZUERICH, norden)).toBeLessThan(km * 1.6);
  });
});

describe('CourseMap verwendet den kartenunabhängigen Weg', () => {
  it('setzt den Ausschnitt über toBounds', () => {
    expect(quelle).toMatch(/\.toBounds\(radiusKm \* 2000\)/);
  });

  it('ruft getBounds() nicht auf einem nicht gezeichneten Kreis auf', () => {
    expect(quelle).not.toMatch(/L\.circle\([^)]*\)[\s\S]{0,80}?\.getBounds\(\)/);
  });

  it('misst die Containergrösse nach dem Layout neu', () => {
    // Ohne invalidateSize rechnet Leaflet mit einer veralteten Grösse und der
    // eingepasste Ausschnitt fällt zu weit heraus.
    expect(quelle).toMatch(/invalidateSize\(\)/);
    expect(quelle).toMatch(/ResizeObserver/);
  });

  it('fällt im Fehlerfall auf den gewählten Ort zurück, nicht auf die Landesmitte', () => {
    expect(quelle).toMatch(/ZOOM_FOR_RADIUS/);
  });

  it('passt den Ausschnitt ohne Animation an, damit die Ereignisse synchron bleiben', () => {
    // Sonst meldet Leaflet den programmatischen Zoom verzögert und er würde
    // als Nutzerbewegung gewertet — danach würde nie mehr neu eingepasst.
    const treffer = quelle.match(/animate: false/g) || [];
    expect(treffer.length).toBeGreaterThanOrEqual(3);
  });

  it('verschiebt oder zoomt die Karte nicht in eine neue Suche hinein', () => {
    // Keine Suchauslösung an Kartenbewegungen: 'moveend' und 'zoomend' werden
    // bewusst nicht abonniert.
    expect(quelle).not.toMatch(/on\(['"](moveend|zoomend)/);
  });
});
