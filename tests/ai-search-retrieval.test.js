/**
 * Kandidatenzusammenführung (Prüfbefund 4): Chunktreffer werden VOR dem
 * Limit auf Kursebene zusammengeführt. Ein einzelner langer Kurs mit vielen
 * Treffer-Chunks darf anderen passenden Kursen keine Kandidatenplätze
 * wegnehmen; Textlänge allein verschafft keinen Vorteil.
 *
 * Dieses JS-Modul ist die deterministische Referenz des Vertrags, den die
 * SQL-Funktionen ai_search_lexical/ai_search_semantic (DISTINCT ON vor dem
 * LIMIT) erfüllen; der Nachweis auf der Datenbank folgt mit dem DB-Testskript
 * nach Freigabe E5.
 */

import { describe, it, expect } from 'vitest';
import { dedupeChunkHitsByCourse, fuseRankedLists } from '../src/lib/aiSearch/retrieval.js';

describe('dedupeChunkHitsByCourse', () => {
  it('ein langer Kurs mit vielen Chunks verdrängt keine anderen Kurse aus dem Limit', () => {
    // Kurs "long" hat 50 Treffer-Chunks mit hohen Scores, daneben 5 weitere
    // Kurse mit je einem Treffer. Limit 5 KURSE: alle 5 anderen bleiben drin.
    const hits = [];
    for (let i = 0; i < 50; i += 1) {
      hits.push({ courseId: 'long', score: 0.9 - i * 0.001, section: 'description', chunkIndex: i });
    }
    for (let i = 1; i <= 5; i += 1) {
      hits.push({ courseId: `other-${i}`, score: 0.5 - i * 0.01, section: 'description', chunkIndex: 0 });
    }
    const result = dedupeChunkHitsByCourse(hits, 5);
    const ids = result.map((c) => String(c.courseId));
    expect(result).toHaveLength(5);
    expect(ids).toContain('long');
    // Mindestens 4 der 5 anderen Kurse haben Plätze — nicht 1 Kurs × 5 Chunks:
    expect(ids.filter((id) => id.startsWith('other-'))).toHaveLength(4);
    // Ohne Dedupe hätten die 50 long-Chunks alle 5 Plätze belegt.
  });

  it('pro Kurs zählt nur der beste Chunk; weitere Treffer erhöhen den Score nicht', () => {
    const result = dedupeChunkHitsByCourse([
      { courseId: 'a', score: 0.4, section: 'description', chunkIndex: 0 },
      { courseId: 'a', score: 0.7, section: 'objectives', chunkIndex: 2 },
      { courseId: 'a', score: 0.6, section: 'description', chunkIndex: 5 },
      { courseId: 'b', score: 0.65, section: 'description', chunkIndex: 0 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ courseId: 'a', score: 0.7, section: 'objectives', chunkMatches: 3 });
    expect(result[1]).toMatchObject({ courseId: 'b', score: 0.65 });
  });

  it('Tie-Break über stabile Kurs-ID, deterministisch', () => {
    const hits = [
      { courseId: 'z', score: 0.5 },
      { courseId: 'a', score: 0.5 },
    ];
    expect(dedupeChunkHitsByCourse(hits).map((c) => c.courseId)).toEqual(['a', 'z']);
    expect(dedupeChunkHitsByCourse([...hits].reverse()).map((c) => c.courseId)).toEqual(['a', 'z']);
  });

  it('ungültige Einträge werden übersprungen, leere Eingabe ergibt leere Liste', () => {
    expect(dedupeChunkHitsByCourse(undefined)).toEqual([]);
    expect(dedupeChunkHitsByCourse([
      null,
      { courseId: null, score: 1 },
      { courseId: 'ok', score: Number.NaN },
      { courseId: 'ok', score: 0.3 },
    ])).toHaveLength(1);
  });
});

describe('fuseRankedLists (RRF)', () => {
  it('vereinigt lexikalische und semantische Liste; in beiden vertretene Kurse steigen', () => {
    const lexical = [{ courseId: 'a' }, { courseId: 'b' }, { courseId: 'c' }];
    const semantic = [{ courseId: 'b' }, { courseId: 'd' }];
    const fused = fuseRankedLists([lexical, semantic]);
    expect(fused[0].courseId).toBe('b'); // in beiden Kanälen vorn
    expect(fused.map((c) => c.courseId)).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']));
  });

  it('Limit begrenzt Kurse nach der Fusion, nicht vorher je Kanal', () => {
    const lexical = [{ courseId: 'a' }, { courseId: 'b' }];
    const semantic = [{ courseId: 'c' }, { courseId: 'a' }];
    const fused = fuseRankedLists([lexical, semantic], { limit: 2 });
    expect(fused).toHaveLength(2);
    expect(fused[0].courseId).toBe('a');
  });
});
