/**
 * Basic-Ranking-Penalty: Staffelgrenzen und Wirkung in beiden öffentlichen
 * Rankingpfaden.
 *
 * Die Grenzen 3/4, 6/7 und 10/11 werden bewusst einzeln geprüft — an genau
 * diesen Stellen entscheidet sich, ob ein Anbieter abgestuft wird.
 */

import { describe, it, expect } from 'vitest';
import {
  basicLeadFactorFor,
  getBasicLeadFactor,
  applyBasicLeadFactor,
  BASIC_LEAD_FACTOR_STEPS,
  NEUTRAL_FACTOR,
} from '../src/lib/basicLeadPenalty';
import { sortCoursesByRelevance } from '../src/lib/searchRelevance';
import { getRecommendationScore } from '../src/lib/courseRecommendations';

describe('Staffel — Grenzen', () => {
  it('0 bis 3 qualifizierte Leads ergeben 1.00', () => {
    for (const count of [0, 1, 2, 3]) expect(basicLeadFactorFor(count)).toBe(1.0);
  });

  it('Grenze 3/4: der vierte Lead stuft ab', () => {
    expect(basicLeadFactorFor(3)).toBe(1.0);
    expect(basicLeadFactorFor(4)).toBe(0.9);
  });

  it('4 bis 6 ergeben 0.90', () => {
    for (const count of [4, 5, 6]) expect(basicLeadFactorFor(count)).toBe(0.9);
  });

  it('Grenze 6/7: der siebte Lead stuft weiter ab', () => {
    expect(basicLeadFactorFor(6)).toBe(0.9);
    expect(basicLeadFactorFor(7)).toBe(0.8);
  });

  it('7 bis 10 ergeben 0.80', () => {
    for (const count of [7, 8, 9, 10]) expect(basicLeadFactorFor(count)).toBe(0.8);
  });

  it('Grenze 10/11: ab dem elften Lead gilt 0.70', () => {
    expect(basicLeadFactorFor(10)).toBe(0.8);
    expect(basicLeadFactorFor(11)).toBe(0.7);
  });

  it('bleibt ab 11 bei 0.70', () => {
    for (const count of [11, 25, 500]) expect(basicLeadFactorFor(count)).toBe(0.7);
  });

  it('behandelt unsinnige Eingaben als neutral', () => {
    for (const value of [-1, NaN, null, undefined, 'viele']) {
      expect(basicLeadFactorFor(value)).toBe(NEUTRAL_FACTOR);
    }
  });

  it('hält die Staffel absteigend sortiert (Reihenfolge ist Teil der Logik)', () => {
    const mins = BASIC_LEAD_FACTOR_STEPS.map(s => s.minLeads);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
  });
});

describe('getBasicLeadFactor — Lesen vom Kurs', () => {
  it('liest einen Zahlenwert', () => {
    expect(getBasicLeadFactor({ basic_lead_ranking_factor: 0.8 })).toBe(0.8);
  });

  it('liest den String, den PostgREST für NUMERIC liefert', () => {
    expect(getBasicLeadFactor({ basic_lead_ranking_factor: '0.70' })).toBe(0.7);
  });

  it('fällt bei fehlendem oder unsinnigem Wert auf 1.00 zurück', () => {
    for (const raw of [null, undefined, 'abc', 0, -1, 1.5, NaN]) {
      expect(getBasicLeadFactor({ basic_lead_ranking_factor: raw })).toBe(NEUTRAL_FACTOR);
    }
    expect(getBasicLeadFactor({})).toBe(NEUTRAL_FACTOR);
    expect(getBasicLeadFactor(null)).toBe(NEUTRAL_FACTOR);
  });
});

describe('applyBasicLeadFactor', () => {
  it('multipliziert den Score', () => {
    expect(applyBasicLeadFactor(10, { basic_lead_ranking_factor: 0.7 })).toBeCloseTo(7);
  });

  it('lässt einen Kurs ohne Faktor unverändert', () => {
    expect(applyBasicLeadFactor(10, {})).toBe(10);
  });

  it('gibt bei unsinnigem Score 0 zurück', () => {
    expect(applyBasicLeadFactor(NaN, {})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Wirkung in der Kurssuche
// ---------------------------------------------------------------------------

const ids = (list) => list.map(c => c.id);

function kurs(overrides) {
  return { id: 'x', title: 'Yoga in Zürich', keywords: [], ...overrides };
}

describe('Rankingpfad 1: Kurssuche', () => {
  it('stuft einen abgestuften Kurs hinter einen gleichwertigen ohne Abschlag', () => {
    const abgestuft = kurs({ id: 'penalised', basic_lead_ranking_factor: 0.7 });
    const normal = kurs({ id: 'neutral' });

    const sortiert = ids(sortCoursesByRelevance([abgestuft, normal], { query: 'Yoga', seed: 0 }));
    expect(sortiert[0]).toBe('neutral');
  });

  it('ändert die Reihenfolge nicht, wenn beide denselben Faktor haben', () => {
    const a = kurs({ id: 'a', basic_lead_ranking_factor: 0.7 });
    const b = kurs({ id: 'b', basic_lead_ranking_factor: 0.7 });
    const mitPenalty = ids(sortCoursesByRelevance([a, b], { query: 'Yoga', seed: 0.3 }));
    const ohnePenalty = ids(sortCoursesByRelevance(
      [kurs({ id: 'a' }), kurs({ id: 'b' })],
      { query: 'Yoga', seed: 0.3 }
    ));
    expect(mitPenalty).toEqual(ohnePenalty);
  });

  it('entfernt keinen Kurs aus der Ergebnismenge', () => {
    const eingabe = [
      kurs({ id: 'a', basic_lead_ranking_factor: 0.7 }),
      kurs({ id: 'b', basic_lead_ranking_factor: 0.8 }),
      kurs({ id: 'c' }),
    ];
    const sortiert = sortCoursesByRelevance(eingabe, { query: 'Yoga', seed: 0.5 });
    expect(sortiert).toHaveLength(3);
    expect(ids(sortiert).sort()).toEqual(['a', 'b', 'c']);
  });

  it('schlägt die Relevanz nicht — ein Titeltreffer bleibt vor einem Kategorietreffer', () => {
    // Der Titeltreffer ist maximal abgestuft, der andere Kurs gar nicht.
    const titeltreffer = kurs({ id: 'titel', title: 'Yoga für Anfänger', basic_lead_ranking_factor: 0.7 });
    const kategorietreffer = kurs({
      id: 'kategorie',
      title: 'Pilates am Morgen',
      category_specialty: 'yoga',
      basic_lead_ranking_factor: 1.0,
    });

    const sortiert = ids(sortCoursesByRelevance([kategorietreffer, titeltreffer], { query: 'Yoga', seed: 0.1 }));
    expect(sortiert[0]).toBe('titel');
  });

  it('lässt einen fehlenden Faktor die Sortierung nicht verändern', () => {
    const mitFeld = [kurs({ id: 'a', basic_lead_ranking_factor: 1 }), kurs({ id: 'b', basic_lead_ranking_factor: 1 })];
    const ohneFeld = [kurs({ id: 'a' }), kurs({ id: 'b' })];
    expect(ids(sortCoursesByRelevance(mitFeld, { query: 'Yoga', seed: 0.9 })))
      .toEqual(ids(sortCoursesByRelevance(ohneFeld, { query: 'Yoga', seed: 0.9 })));
  });
});

// ---------------------------------------------------------------------------
// Wirkung bei ähnlichen Kursen
// ---------------------------------------------------------------------------

describe('Rankingpfad 2: ähnliche Kurse', () => {
  const aktuell = {
    id: 1,
    title: 'Yoga Basis',
    category_type: 'privat',
    category_area: 'sport_fitness',
    category_specialty: 'yoga',
    canton: 'Zürich',
  };

  const kandidat = (overrides = {}) => ({
    id: 2,
    title: 'Yoga Vertiefung',
    category_type: 'privat',
    category_area: 'sport_fitness',
    category_specialty: 'yoga',
    canton: 'Zürich',
    ...overrides,
  });

  it('senkt den Score eines abgestuften Kurses', () => {
    const ohne = getRecommendationScore(kandidat(), aktuell);
    const mit = getRecommendationScore(kandidat({ basic_lead_ranking_factor: 0.7 }), aktuell);
    expect(mit).toBeLessThan(ohne);
    expect(mit).toBeCloseTo(ohne * 0.7);
  });

  it('lässt einen Kurs ohne Faktor unverändert', () => {
    const referenz = getRecommendationScore(kandidat(), aktuell);
    expect(getRecommendationScore(kandidat({ basic_lead_ranking_factor: 1 }), aktuell)).toBe(referenz);
  });

  it('verbessert einen negativen Score nicht', () => {
    // Kein passender Kontext und kein zukünftiger Termin → negativer Score.
    const schlecht = {
      id: 3,
      title: 'Etwas ganz anderes',
      booking_type: 'platform',
      course_events: [],
    };
    const ohne = getRecommendationScore(schlecht, aktuell);
    const mit = getRecommendationScore({ ...schlecht, basic_lead_ranking_factor: 0.7 }, aktuell);
    expect(ohne).toBeLessThan(0);
    // Ohne die Schutzbedingung wäre mit > ohne — der Abschlag würde belohnen.
    expect(mit).toBe(ohne);
  });
});
