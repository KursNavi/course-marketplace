/**
 * Publikationsregel der KI-Suche (Datenvertrag §1).
 *
 * Entwürfe dürfen nie in Index/Modellkontext; die Regel ist strenger als die
 * klassische Anzeige (Legacy status=null zählt dort als veröffentlicht, hier
 * erst nach dokumentiertem Nachweis per Option).
 */

import { describe, it, expect } from 'vitest';
import { isPubliclySearchable, filterByFreshStatus } from '../src/lib/aiSearch/publication.js';

describe('isPubliclySearchable', () => {
  it('nur published ist durchsuchbar', () => {
    expect(isPubliclySearchable({ status: 'published' })).toBe(true);
    expect(isPubliclySearchable({ status: 'draft' })).toBe(false);
  });

  it('Legacy status=null ist standardmässig NICHT durchsuchbar', () => {
    expect(isPubliclySearchable({ status: null })).toBe(false);
    expect(isPubliclySearchable({})).toBe(false);
  });

  it('Legacy status=null nur mit expliziter, nachgewiesener Option', () => {
    expect(isPubliclySearchable({ status: null }, { allowLegacyNullStatus: true })).toBe(true);
    // Die Option darf Entwürfe trotzdem nie freischalten:
    expect(isPubliclySearchable({ status: 'draft' }, { allowLegacyNullStatus: true })).toBe(false);
  });

  it('Eigentümerschaft spielt keine Rolle: eigene Entwürfe sind nicht suchbar', () => {
    expect(isPubliclySearchable({ status: 'draft', user_id: 'owner-1' })).toBe(false);
  });
});

describe('filterByFreshStatus (Prüfung unmittelbar vor Ausgabe)', () => {
  const candidates = [
    { course_id: 1, score: 92 },
    { course_id: 2, score: 88 },
    { course_id: 3, score: 85 },
  ];

  it('entfernt Kurse, die zwischenzeitlich zurückgezogen wurden', () => {
    const fresh = new Map([
      ['1', { status: 'published' }],
      ['2', { status: 'draft' }],      // published -> draft während der Suche
      ['3', { status: 'published' }],
    ]);
    const result = filterByFreshStatus(candidates, fresh);
    expect(result.map((c) => c.course_id)).toEqual([1, 3]);
  });

  it('entfernt Kurse ohne frische Quellzeile (gelöscht) — Rücknahme-Vorrang', () => {
    const fresh = new Map([['1', { status: 'published' }]]);
    const result = filterByFreshStatus(candidates, fresh);
    expect(result.map((c) => c.course_id)).toEqual([1]);
  });

  it('ein veralteter Index-/Cacheeintrag allein führt nie zur Ausgabe', () => {
    expect(filterByFreshStatus(candidates, new Map())).toEqual([]);
    expect(filterByFreshStatus(candidates, undefined)).toEqual([]);
  });
});
