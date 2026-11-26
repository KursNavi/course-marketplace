/**
 * Vollständigkeitsmetrik der Luna-Vergleichsprobe (Nachtrag 14, Korrektur
 * 20.11.2026): gesendete IDs gegen gültig zurückgegebene Bewertungen;
 * abgerufene, aber nicht gesendete Kandidaten getrennt.
 */
import { describe, it, expect } from 'vitest';
import { ratingCompleteness } from '../scripts/ai-search-luna-probe.mjs';

const ids = (n, from = 1) => Array.from({ length: n }, (_, i) => String(from + i));

describe('ratingCompleteness', () => {
  it('alle 30 gesendeten bewertet, 12 abgerufene nicht gesendet → vollständig trotz notRated > 0', () => {
    const stats = { candidates: 45, rated: 30, notRated: 12 }; // 3 per Muss ausgeschlossen
    const result = ratingCompleteness(ids(30), ids(30), stats);
    expect(result).toEqual({
      alleGesendetenBewertet: true,
      abgerufen: 45,
      nachMussAusschluss: 42,
      gesendet: 30,
      gueltigBewertet: 30,
      gesendetOhneBewertung: 0,
      nichtGesendet: 12,
    });
  });

  it('ein gesendeter Kandidat ohne gültige Bewertung → nicht vollständig', () => {
    const result = ratingCompleteness(ids(30), ids(29), { candidates: 30, rated: 29, notRated: 1 });
    expect(result.alleGesendetenBewertet).toBe(false);
    expect(result.gesendetOhneBewertung).toBe(1);
    expect(result.nichtGesendet).toBe(0);
  });

  it('Bewertung für nicht gesendete ID → nicht vollständig', () => {
    const result = ratingCompleteness(ids(3), [...ids(3), '99'], { candidates: 3, rated: 3, notRated: 0 });
    expect(result.alleGesendetenBewertet).toBe(false);
  });

  it('nichts gesendet (z. B. Fehler) → nicht vollständig', () => {
    expect(ratingCompleteness(null, null, { candidates: 0, rated: 0, notRated: 0 }).alleGesendetenBewertet).toBe(false);
  });
});
