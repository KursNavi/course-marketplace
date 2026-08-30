/**
 * Relevanz-Sortierung der öffentlichen Kurssuche.
 *
 * Gemeldeter Fehler:
 *   Eine Suche nach «Yoga» lieferte auch Pilates-, Reiki- und Thai-Yoga-
 *   Angebote — teils noch vor den direkten Yoga-Kursen. Ursache: Die
 *   Trefferprüfung wirft alle Felder in einen Textblock, und sortiert wurde
 *   allein nach Prio × Buchungsfaktor + Zufall, also ohne jede Relevanz.
 *
 * Verifiziert:
 *   1  Stufenmodell: Titel > Schlagwort > Kategorie > Sonstiges
 *   2  Titel-Feinabstufung: exakt > Beginn > eigenes Wort > Wortteil
 *   3  Der gemeldete Fall Yoga/Pilates/Reiki/Thai-Yoga
 *   4  Fehlertoleranz: Synonyme, zusammengesetzte Begriffe, AND/OR
 *   5  Determinismus und Reproduzierbarkeit
 *   6  Keine Kurse werden ausgeblendet
 */

import { describe, expect, it } from 'vitest';
import {
  RELEVANCE,
  containsWholeWord,
  getRelevanceScore,
  parseQueryGroups,
  sortCoursesByRelevance,
  stableSeed,
} from '../src/lib/searchRelevance.js';

/** Kursdatensatz mit nur den für die Suche relevanten Feldern. */
const kurs = (over = {}) => ({
  id: over.id || 'k1',
  title: '',
  keywords: [],
  category_specialty: '',
  category_focus: '',
  instructor_name: '',
  canton: '',
  address: '',
  course_events: [],
  ...over,
});

// Der gemeldete Fall, nachgebaut wie in der Themenwelt «Yoga & Achtsamkeit».
const DIREKT = kurs({
  id: 'direkt', title: 'Yoga für Anfänger',
  category_specialty: 'Yoga & Achtsamkeit',
});
const HATHA = kurs({
  id: 'hatha', title: 'Hatha Yoga in Zürich',
  category_specialty: 'Yoga & Achtsamkeit',
});
const THAI = kurs({
  id: 'thai', title: 'Thai-Yoga-Massage',
  category_specialty: 'Yoga & Achtsamkeit',
});
const PILATES = kurs({
  id: 'pilates', title: 'Pilates Basics',
  category_specialty: 'Yoga & Achtsamkeit',
});
const REIKI = kurs({
  id: 'reiki', title: 'Reiki Grundkurs',
  keywords: ['entspannung', 'energiearbeit'],
  category_specialty: 'Yoga & Achtsamkeit',
});

/** Sortiert wie die Suchansicht: Relevanz absteigend, dann stabil nach id. */
function nachRelevanz(kurse, query) {
  return [...kurse]
    .sort((a, b) => {
      const diff = getRelevanceScore(b, query) - getRelevanceScore(a, query);
      if (diff !== 0) return diff;
      return String(a.id).localeCompare(String(b.id));
    })
    .map((k) => k.id);
}

describe('1. Stufenmodell Titel > Schlagwort > Kategorie > Sonstiges', () => {
  it('bewertet einen Titeltreffer höher als einen Schlagworttreffer', () => {
    const titel = getRelevanceScore(kurs({ title: 'Yoga Basics' }), 'yoga');
    const schlagwort = getRelevanceScore(kurs({ title: 'Pilates', keywords: ['yoga'] }), 'yoga');
    expect(titel).toBeGreaterThan(schlagwort);
  });

  it('bewertet einen Schlagworttreffer höher als einen Kategorietreffer', () => {
    const schlagwort = getRelevanceScore(kurs({ title: 'Pilates', keywords: ['yoga'] }), 'yoga');
    const kategorie = getRelevanceScore(kurs({ title: 'Pilates', category_specialty: 'Yoga & Achtsamkeit' }), 'yoga');
    expect(schlagwort).toBeGreaterThan(kategorie);
  });

  it('bewertet einen Kategorietreffer höher als einen reinen Anbieter- oder Ortstreffer', () => {
    const kategorie = getRelevanceScore(kurs({ title: 'Pilates', category_focus: 'Yoga' }), 'yoga');
    const sonstiges = getRelevanceScore(kurs({ title: 'Pilates', instructor_name: 'Yoga Studio AG' }), 'yoga');
    expect(kategorie).toBeGreaterThan(sonstiges);
    expect(sonstiges).toBe(RELEVANCE.OTHER);
  });

  it('gibt ohne Sucheingabe für jeden Kurs 0 zurück', () => {
    for (const query of ['', '   ', null, undefined]) {
      expect(getRelevanceScore(DIREKT, query)).toBe(RELEVANCE.NONE);
    }
  });
});

describe('2. Feinabstufung innerhalb des Titels', () => {
  it('setzt exakten Titel vor Titelbeginn vor Wort vor Wortteil', () => {
    const exakt = getRelevanceScore(kurs({ title: 'Yoga' }), 'yoga');
    const beginn = getRelevanceScore(kurs({ title: 'Yoga für Anfänger' }), 'yoga');
    const wort = getRelevanceScore(kurs({ title: 'Hatha Yoga in Zürich' }), 'yoga');
    const wortteil = getRelevanceScore(kurs({ title: 'Yogalehrerin werden' }), 'yoga');

    expect(exakt).toBe(RELEVANCE.TITLE_EXACT);
    expect(beginn).toBe(RELEVANCE.TITLE_PREFIX);
    expect(wort).toBe(RELEVANCE.TITLE_ALL_WORDS);
    expect(exakt).toBeGreaterThan(beginn);
    expect(beginn).toBeGreaterThan(wort);
    expect(wort).toBeGreaterThan(wortteil);
  });

  it('erkennt den Bindestrich als Wortgrenze, den Wortanfang aber nicht', () => {
    expect(containsWholeWord('thai-yoga-massage', 'yoga')).toBe(true);
    expect(containsWholeWord('yogalehrerin werden', 'yoga')).toBe(false);
    expect(containsWholeWord('hatha yoga', 'yoga')).toBe(true);
  });
});

describe('3. Der gemeldete Fall: Suche nach «Yoga»', () => {
  const alle = [PILATES, REIKI, THAI, HATHA, DIREKT];

  it('stellt direkte Yoga-Kurse vor rein verwandte Treffer', () => {
    const reihenfolge = nachRelevanz(alle, 'Yoga');

    // Titeltreffer zuerst …
    expect(reihenfolge.slice(0, 3)).toEqual(['direkt', 'hatha', 'thai']);
    // … verwandte Treffer danach, aber weiterhin vorhanden.
    expect(reihenfolge.slice(3)).toEqual(['pilates', 'reiki']);
  });

  it('blendet keinen einzigen Kurs aus', () => {
    expect(nachRelevanz(alle, 'Yoga')).toHaveLength(alle.length);
  });

  it('bewertet Pilates und Reiki nachrangig, aber nicht mit null', () => {
    // Sie bleiben gültige Treffer — nur eben hinten. Bei einem einzelnen
    // Suchbegriff fallen «alle Begriffe» und «mindestens einer» zusammen,
    // die Kategoriestufe ist deshalb CATEGORY_ALL.
    expect(getRelevanceScore(PILATES, 'Yoga')).toBe(RELEVANCE.CATEGORY_ALL);
    expect(getRelevanceScore(REIKI, 'Yoga')).toBe(RELEVANCE.CATEGORY_ALL);
    expect(getRelevanceScore(PILATES, 'Yoga')).toBeGreaterThan(RELEVANCE.NONE);
    // Entscheidend bleibt: klar unterhalb jedes Titeltreffers.
    expect(getRelevanceScore(PILATES, 'Yoga')).toBeLessThan(getRelevanceScore(THAI, 'Yoga'));
  });

  it('setzt «Yoga für Anfänger» vor «Thai-Yoga-Massage»', () => {
    expect(getRelevanceScore(DIREKT, 'Yoga')).toBeGreaterThan(getRelevanceScore(THAI, 'Yoga'));
  });
});

describe('4. Fehlertoleranz für Synonyme und zusammengesetzte Begriffe', () => {
  it('findet zusammengesetzte Wörter weiterhin, nur nachrangig', () => {
    const score = getRelevanceScore(kurs({ title: 'Yogalehrerin werden' }), 'yoga');
    expect(score).toBe(RELEVANCE.TITLE_ALL_PARTS);
    expect(score).toBeGreaterThan(RELEVANCE.KEYWORDS_ALL);
  });

  it('behandelt Gross- und Kleinschreibung gleich', () => {
    for (const q of ['YOGA', 'yoga', 'YoGa']) {
      expect(getRelevanceScore(DIREKT, q)).toBe(RELEVANCE.TITLE_PREFIX);
    }
  });

  it('bewertet mehrteilige Eingaben über alle Begriffe', () => {
    const beide = getRelevanceScore(kurs({ title: 'Hatha Yoga in Zürich' }), 'yoga zürich');
    const einer = getRelevanceScore(kurs({ title: 'Hatha Yoga in Bern' }), 'yoga zürich');
    expect(beide).toBeGreaterThan(einer);
    expect(einer).toBe(RELEVANCE.TITLE_SOME);
  });

  it('versteht AND genau wie die Trefferprüfung', () => {
    expect(parseQueryGroups('Yoga AND Zürich')).toEqual([['yoga', 'zürich']]);
    const score = getRelevanceScore(kurs({ title: 'Hatha Yoga in Zürich' }), 'Yoga AND Zürich');
    expect(score).toBe(RELEVANCE.TITLE_ALL_WORDS);
  });

  it('bewertet bei OR die jeweils beste Gruppe', () => {
    expect(parseQueryGroups('Yoga OR Pilates')).toEqual([['yoga'], ['pilates']]);
    // Der Pilates-Kurs wird über «pilates» bewertet, nicht über das schwächere «yoga».
    expect(getRelevanceScore(PILATES, 'Yoga OR Pilates')).toBe(RELEVANCE.TITLE_PREFIX);
    expect(getRelevanceScore(DIREKT, 'Yoga OR Pilates')).toBe(RELEVANCE.TITLE_PREFIX);
  });

  it('kommt mit leeren und unsinnigen Eingaben klar, ohne zu werfen', () => {
    for (const q of ['', '   ', 'AND', 'OR', '   OR   ', 42, {}, null]) {
      expect(() => getRelevanceScore(DIREKT, q)).not.toThrow();
    }
  });

  it('kommt mit unvollständigen Kursdatensätzen klar', () => {
    for (const c of [null, undefined, {}, { title: null }, { keywords: null }]) {
      expect(() => getRelevanceScore(c, 'yoga')).not.toThrow();
    }
  });
});

describe('5. Determinismus und Reproduzierbarkeit', () => {
  it('liefert für dieselbe Eingabe immer dieselbe Reihenfolge', () => {
    const alle = [PILATES, REIKI, THAI, HATHA, DIREKT];
    const erste = nachRelevanz(alle, 'Yoga');
    for (let i = 0; i < 5; i += 1) {
      expect(nachRelevanz(alle, 'Yoga')).toEqual(erste);
    }
  });

  it('hängt nicht von der Eingangsreihenfolge ab', () => {
    const a = nachRelevanz([PILATES, REIKI, THAI, HATHA, DIREKT], 'Yoga');
    const b = nachRelevanz([DIREKT, THAI, PILATES, HATHA, REIKI], 'Yoga');
    expect(a).toEqual(b);
  });

  it('erzeugt aus derselben Eingabe denselben Seed', () => {
    expect(stableSeed('Yoga')).toBe(stableSeed('Yoga'));
    expect(stableSeed('Yoga')).not.toBe(stableSeed('Pilates'));
    for (const q of ['Yoga', 'Pilates', '', 'a b c']) {
      const s = stableSeed(q);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------

describe('6. Gesamtsortierung der Ergebnisliste', () => {
  const alle = [PILATES, REIKI, THAI, HATHA, DIREKT];
  const ids = (liste) => liste.map((k) => k.id);

  it('stellt bei «Yoga» die Titeltreffer nach vorne', () => {
    const sortiert = ids(sortCoursesByRelevance(alle, { query: 'Yoga', seed: 0.42 }));
    expect(sortiert.slice(0, 3).sort()).toEqual(['direkt', 'hatha', 'thai']);
    expect(sortiert.slice(3).sort()).toEqual(['pilates', 'reiki']);
    expect(sortiert[0]).toBe('direkt');
  });

  it('lässt Relevanz die Hervorhebung schlagen — der gemeldete Fehler', () => {
    // Ein hervorgehobener Pilates-Kurs mit hohem Buchungsfaktor gegen einen
    // gewöhnlichen Yoga-Kurs. Vor der Änderung gewann Pilates.
    const beworbenesPilates = { ...PILATES, is_prio: true, booking_factor: 5 };
    const sortiert = ids(sortCoursesByRelevance(
      [beworbenesPilates, DIREKT], { query: 'Yoga', seed: 0.1 },
    ));
    expect(sortiert).toEqual(['direkt', 'pilates']);
  });

  it('lässt die Hervorhebung innerhalb derselben Relevanzstufe weiterhin wirken', () => {
    const a = kurs({ id: 'a', title: 'Hatha Yoga in Zürich' });
    const b = kurs({ id: 'b', title: 'Vinyasa Yoga in Bern', is_prio: true, booking_factor: 3 });
    // Beide sind Wort-Titeltreffer — hier entscheidet der Sichtbarkeits-Score.
    expect(getRelevanceScore(a, 'Yoga')).toBe(getRelevanceScore(b, 'Yoga'));
    expect(ids(sortCoursesByRelevance([a, b], { query: 'Yoga', seed: 0.3 }))[0]).toBe('b');
  });

  it('gibt ohne Sucheingabe exakt dieselbe Kursmenge zurück', () => {
    const sortiert = sortCoursesByRelevance(alle, { query: '', seed: 0.7 });
    expect(sortiert).toHaveLength(alle.length);
    expect(ids(sortiert).sort()).toEqual(ids(alle).sort());
  });

  it('blendet nie einen Kurs aus und erzeugt keine Duplikate', () => {
    for (const query of ['', 'Yoga', 'Yoga AND Zürich', 'Yoga OR Pilates', 'xyz']) {
      const sortiert = sortCoursesByRelevance(alle, { query, seed: 0.5 });
      expect(sortiert, query).toHaveLength(alle.length);
      expect(new Set(ids(sortiert)).size, query).toBe(alle.length);
    }
  });

  it('verändert die Eingabeliste nicht', () => {
    const eingabe = [...alle];
    sortCoursesByRelevance(eingabe, { query: 'Yoga', seed: 0.5 });
    expect(ids(eingabe)).toEqual(ids(alle));
  });

  it('ist bei gleichen Parametern vollständig reproduzierbar', () => {
    const lauf = () => ids(sortCoursesByRelevance(alle, { query: 'Yoga', seed: stableSeed('Yoga') }));
    const erste = lauf();
    for (let i = 0; i < 5; i += 1) expect(lauf()).toEqual(erste);
  });

  it('stellt bei aktivem Datumsfilter Kurse mit Termin voran', () => {
    const mitTermin = kurs({ id: 'mit', title: 'Pilates', course_events: [{ start_date: '2026-09-01' }] });
    const ohneTermin = kurs({ id: 'ohne', title: 'Yoga für Anfänger' });

    const ohneFilter = ids(sortCoursesByRelevance([mitTermin, ohneTermin], { query: 'Yoga', seed: 0.2 }));
    expect(ohneFilter[0]).toBe('ohne'); // Relevanz entscheidet

    const mitFilter = ids(sortCoursesByRelevance(
      [mitTermin, ohneTermin], { query: 'Yoga', seed: 0.2, preferDated: true },
    ));
    expect(mitFilter[0]).toBe('mit'); // Datumsfilter bleibt vorrangig
  });

  it('kommt mit leeren und ungültigen Eingaben klar', () => {
    expect(sortCoursesByRelevance([], { query: 'Yoga' })).toEqual([]);
    expect(sortCoursesByRelevance(null, { query: 'Yoga' })).toEqual([]);
    expect(() => sortCoursesByRelevance(alle)).not.toThrow();
  });
});
