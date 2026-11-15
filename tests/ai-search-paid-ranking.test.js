/**
 * Paid-Pilotregel: die verbindlichen Fixture-Fälle aus 00/02/04.
 *
 * Unverletzliche Invarianten: Mindestpassung 70, keine Bandüberschreitung,
 * Bonusdeckel +5, kein doppelter Basic-Lead-Abschlag, stabiler Tie-Break.
 */

import { describe, it, expect } from 'vitest';
import {
  rankWithPaidPriority,
  paidBonus,
  bandOf,
  MIN_SCORE,
  MAX_TOTAL_BONUS,
} from '../src/lib/aiSearch/paidRanking.js';

describe('paidBonus', () => {
  it('Staffel Basic +0, Pro +2, Premium/Enterprise +3, Prio +2, Deckel +5', () => {
    expect(paidBonus('basic', false)).toBe(0);
    expect(paidBonus('pro', false)).toBe(2);
    expect(paidBonus('premium', false)).toBe(3);
    expect(paidBonus('enterprise', false)).toBe(3);
    expect(paidBonus('premium', true)).toBe(5);
    expect(paidBonus('enterprise', true)).toBe(5);
    // Deckel: keine Kombination überschreitet +5.
    expect(paidBonus('premium', true)).toBeLessThanOrEqual(MAX_TOTAL_BONUS);
  });

  it('unbekannte oder abgelaufene Pakete (als basic aufgelöst) erhalten keinen Bonus', () => {
    expect(paidBonus(undefined, false)).toBe(0);
    expect(paidBonus('abgelaufen', true)).toBe(2); // nur Prio-Anteil, kein Tier-Bonus
    expect(paidBonus('basic', false)).toBe(0);
  });
});

describe('rankWithPaidPriority – Pflichtfälle', () => {
  it('Basic 86 vs. Premium-Prio 83: bezahlter Treffer überholt innerhalb des Bands (86 vs 88)', () => {
    const ranked = rankWithPaidPriority([
      { courseId: 'basic-86', score: 86, tier: 'basic' },
      { courseId: 'premium-83', score: 83, tier: 'premium', prioEligible: true },
    ]);
    expect(ranked.map((c) => c.courseId)).toEqual(['premium-83', 'basic-86']);
    expect(ranked[0].paidInfluence).toBe(true);
    expect(ranked[1].paidInfluence).toBe(false);
  });

  it('Basic 91 bleibt vor Premium 89: kein kommerzieller Sprung über die Bandgrenze', () => {
    const ranked = rankWithPaidPriority([
      { courseId: 'premium-89', score: 89, tier: 'premium', prioEligible: true },
      { courseId: 'basic-91', score: 91, tier: 'basic' },
    ]);
    expect(ranked.map((c) => c.courseId)).toEqual(['basic-91', 'premium-89']);
  });

  it('Score 69 fällt auch bezahlt aus den bestätigten Empfehlungen', () => {
    const ranked = rankWithPaidPriority([
      { courseId: 'enterprise-69', score: 69, tier: 'enterprise', prioEligible: true },
      { courseId: 'basic-71', score: 71, tier: 'basic' },
    ]);
    expect(ranked.map((c) => c.courseId)).toEqual(['basic-71']);
    expect(MIN_SCORE).toBe(70);
  });

  it('abgelaufenes Paket (serverseitig als basic aufgelöst) verliert den Bonus sofort', () => {
    const active = rankWithPaidPriority([
      { courseId: 'a', score: 83, tier: 'premium', prioEligible: true },
      { courseId: 'b', score: 86, tier: 'basic' },
    ]);
    expect(active[0].courseId).toBe('a');
    const expired = rankWithPaidPriority([
      { courseId: 'a', score: 83, tier: 'basic', prioEligible: false }, // nach Ablauf/Downgrade
      { courseId: 'b', score: 86, tier: 'basic' },
    ]);
    expect(expired[0].courseId).toBe('b');
  });

  it('kein doppelter Basic-Lead-Abschlag: Felder der klassischen Suche sind wirkungslos', () => {
    const withLegacyFields = rankWithPaidPriority([
      { courseId: 'x', score: 80, tier: 'basic', basic_lead_ranking_factor: 0.7, booking_factor: 1.3, is_prio: true },
      { courseId: 'y', score: 80, tier: 'basic', basic_lead_ranking_factor: 1.0, booking_factor: 1.0, is_prio: false },
    ]);
    // Gleicher Score, gleiche Stufe: Reihenfolge rein über stabile Kurs-ID,
    // die Legacy-Felder verschieben nichts.
    expect(withLegacyFields.map((c) => c.courseId)).toEqual(['x', 'y']);
    expect(withLegacyFields[0].visibility).toBe(withLegacyFields[1].visibility);
  });

  it('Tie-Break ist deterministisch: fachlicher Score, dann stabile Kurs-ID', () => {
    const a = rankWithPaidPriority([
      { courseId: 'kurs-b', score: 75, tier: 'pro' },        // 77
      { courseId: 'kurs-a', score: 77, tier: 'basic' },      // 77, höherer Rohscore
    ]);
    expect(a.map((c) => c.courseId)).toEqual(['kurs-a', 'kurs-b']);

    const b = rankWithPaidPriority([
      { courseId: 'kurs-z', score: 75, tier: 'basic' },
      { courseId: 'kurs-a', score: 75, tier: 'basic' },
    ]);
    expect(b.map((c) => c.courseId)).toEqual(['kurs-a', 'kurs-z']);
    // Wiederholter Aufruf liefert identische Reihenfolge (stabiler Cursor):
    expect(rankWithPaidPriority([
      { courseId: 'kurs-z', score: 75, tier: 'basic' },
      { courseId: 'kurs-a', score: 75, tier: 'basic' },
    ]).map((c) => c.courseId)).toEqual(['kurs-a', 'kurs-z']);
  });

  it('bandOf ordnet exakt: 90-100 / 80-89 / 70-79 / darunter keine Empfehlung', () => {
    expect(bandOf(100)).toBe(0);
    expect(bandOf(90)).toBe(0);
    expect(bandOf(89)).toBe(1);
    expect(bandOf(80)).toBe(1);
    expect(bandOf(79)).toBe(2);
    expect(bandOf(70)).toBe(2);
    expect(bandOf(69)).toBe(-1);
  });
});
