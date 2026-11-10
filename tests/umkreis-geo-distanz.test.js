/**
 * Luftlinien-Entfernung und Radiusgrenze.
 *
 * Verifiziert:
 *   1  Bekannte Entfernungen zwischen Schweizer Städten mit realistischer Toleranz
 *   2  Innerhalb, aussserhalb und GENAU AUF der Radiusgrenze
 *   3  Fehlende oder unsinnige Koordinaten führen nie zu einem Treffer
 */

import { describe, expect, it } from 'vitest';
import { haversineKm, isValidCoordinate, isWithinRadius } from '../src/lib/geoDistance.js';

const ZUERICH = { lat: 47.3769, lng: 8.5417 };
const BERN = { lat: 46.948, lng: 7.4474 };
const WINTERTHUR = { lat: 47.5, lng: 8.7241 };
const GENF = { lat: 46.2044, lng: 6.1432 };

describe('haversineKm — bekannte Entfernungen', () => {
  it.each([
    ['Zürich → Bern', ZUERICH, BERN, 95],
    ['Zürich → Winterthur', ZUERICH, WINTERTHUR, 20],
    ['Zürich → Genf', ZUERICH, GENF, 224],
  ])('%s liegt bei rund %#4 km', (_label, a, b, erwartet) => {
    // Toleranz 5 %: die Referenzwerte sind selbst gerundete Luftlinien.
    expect(haversineKm(a, b)).toBeGreaterThan(erwartet * 0.95);
    expect(haversineKm(a, b)).toBeLessThan(erwartet * 1.05);
  });

  it('ist symmetrisch', () => {
    expect(haversineKm(ZUERICH, BERN)).toBeCloseTo(haversineKm(BERN, ZUERICH), 6);
  });

  it('ist für denselben Punkt null', () => {
    expect(haversineKm(ZUERICH, { ...ZUERICH })).toBeCloseTo(0, 6);
  });

  it('liefert NaN statt einer erfundenen Zahl, wenn eine Koordinate fehlt', () => {
    expect(haversineKm(ZUERICH, null)).toBeNaN();
    expect(haversineKm(ZUERICH, { lat: 47, lng: undefined })).toBeNaN();
  });
});

describe('isValidCoordinate', () => {
  it.each([
    [{ lat: 47, lng: 8 }, true],
    [{ lat: 0, lng: 0 }, true],
    [{ lat: 91, lng: 8 }, false],
    [{ lat: 47, lng: 181 }, false],
    [{ lat: 'siebenundvierzig', lng: 8 }, false],
    [null, false],
    [undefined, false],
  ])('%o → %s', (punkt, erwartet) => {
    expect(isValidCoordinate(punkt)).toBe(erwartet);
  });
});

describe('isWithinRadius — innerhalb, aussserhalb, auf der Grenze', () => {
  it('zählt einen Punkt innerhalb des Radius', () => {
    // Winterthur liegt rund 20 km von Zürich entfernt.
    expect(isWithinRadius(ZUERICH, WINTERTHUR, 25)).toBe(true);
  });

  it('zählt einen Punkt aussserhalb des Radius nicht', () => {
    expect(isWithinRadius(ZUERICH, WINTERTHUR, 10)).toBe(false);
  });

  it('zählt einen Punkt GENAU auf der Grenze als Treffer', () => {
    const entfernung = haversineKm(ZUERICH, WINTERTHUR);
    // Der Radius ist exakt die Entfernung — ein Ausschluss wäre für Besucher
    // nicht nachvollziehbar («25 km» soll 25 km einschliessen).
    expect(isWithinRadius(ZUERICH, WINTERTHUR, entfernung)).toBe(true);
  });

  it('zählt einen Punkt knapp hinter der Grenze nicht', () => {
    const entfernung = haversineKm(ZUERICH, WINTERTHUR);
    expect(isWithinRadius(ZUERICH, WINTERTHUR, entfernung - 0.5)).toBe(false);
  });

  it('ist ohne Radius immer falsch — kein Radius heisst nicht «alles»', () => {
    expect(isWithinRadius(ZUERICH, WINTERTHUR, 0)).toBe(false);
    expect(isWithinRadius(ZUERICH, WINTERTHUR, -5)).toBe(false);
    expect(isWithinRadius(ZUERICH, WINTERTHUR, Number.NaN)).toBe(false);
  });

  it('ist ohne gültige Koordinaten immer falsch', () => {
    expect(isWithinRadius(ZUERICH, null, 50)).toBe(false);
    expect(isWithinRadius(null, WINTERTHUR, 50)).toBe(false);
  });
});
