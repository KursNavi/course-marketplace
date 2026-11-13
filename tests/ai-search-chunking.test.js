/**
 * Chunking der Suchprojektion: vollständige Abdeckung ohne Längenannahme.
 *
 * Die zentralen Abnahmefälle aus 04 (§Maschinenprüfbare Abnahme, Punkt 1/3):
 * relevanter Begriff am Ende eines langen Texts bleibt auffindbar, kein
 * stilles Abschneiden, Überlappung vorhanden, deterministisch.
 */

import { describe, it, expect } from 'vitest';
import {
  cleanText,
  chunkText,
  buildCourseChunks,
  coversFullText,
  CHUNKABLE_SECTIONS,
} from '../src/lib/aiSearch/chunking.js';

describe('cleanText', () => {
  it('entfernt HTML und normalisiert Whitespace, Inhalt bleibt erhalten', () => {
    expect(cleanText('<p>Yoga  für <b>Anfänger</b></p>')).toBe('Yoga für Anfänger');
  });

  it('behält Umlaute und Zeilenstruktur', () => {
    expect(cleanText('Kursziele:\n\n\n\nFlexibilität & Kraft')).toBe('Kursziele:\n\nFlexibilität & Kraft');
  });

  it('leere und fehlende Werte ergeben leeren Text', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText('   ')).toBe('');
  });
});

describe('chunkText', () => {
  it('kurzer Text ergibt genau einen Chunk mit voller Abdeckung', () => {
    const chunks = chunkText('Kurzer Text.', 'description');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].charStart).toBe(0);
    expect(chunks[0].charEnd).toBe('Kurzer Text.'.length);
  });

  it('sehr langer Text (weit über Formularlimit) wird vollständig abgedeckt', () => {
    // 60'000 Zeichen — bewusst weit über den 2000 Zeichen des Formulars:
    // Importquellen dürfen länger sein, nichts wird abgeschnitten.
    const sentence = 'Dieser Abschnitt beschreibt den Kurs sehr ausführlich. ';
    const longText = sentence.repeat(1071) + 'SCHLUSSBEGRIFF_QUALITOP';
    const cleaned = cleanText(longText);
    const chunks = chunkText(cleaned, 'description');

    expect(chunks.length).toBeGreaterThan(10);
    expect(coversFullText(chunks, cleaned.length)).toBe(true);
    // Der Begriff ganz am Ende steht in mindestens einem Chunk:
    expect(chunks.some((c) => c.text.includes('SCHLUSSBEGRIFF_QUALITOP'))).toBe(true);
    // Letzter Chunk endet exakt am Textende (kein stilles Abschneiden):
    const maxEnd = Math.max(...chunks.map((c) => c.charEnd));
    expect(maxEnd).toBe(cleaned.length);
  });

  it('Nachbarchunks überlappen', () => {
    const text = 'Wort '.repeat(1000).trim();
    const chunks = chunkText(text, 'description', { chunkSize: 400, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(2);
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i].charStart).toBeLessThan(chunks[i - 1].charEnd);
    }
  });

  it('ist deterministisch (gleicher Text, gleiche Chunks)', () => {
    const text = 'Satz eins. '.repeat(500);
    const a = chunkText(cleanText(text), 'description');
    const b = chunkText(cleanText(text), 'description');
    expect(a).toEqual(b);
  });

  it('coversFullText erkennt eine Lücke', () => {
    const gappy = [
      { charStart: 0, charEnd: 100 },
      { charStart: 150, charEnd: 300 }, // Lücke 100-150
    ];
    expect(coversFullText(gappy, 300)).toBe(false);
  });
});

describe('buildCourseChunks', () => {
  it('erfasst alle zulässigen Textfelder mit section-Angabe', () => {
    const course = {
      description: 'Beschreibung des Kurses.',
      objectives: 'Ziel A und Ziel B.',
      prerequisites: 'Keine Vorkenntnisse.',
      keywords: ['yoga', 'anfänger'],
      free_reason: '',
      contact_email: 'nie@indexieren.ch', // kein zulässiges Feld
    };
    const chunks = buildCourseChunks(course);
    const sections = new Set(chunks.map((c) => c.section));
    expect(sections).toEqual(new Set(['description', 'objectives', 'prerequisites', 'keywords']));
    // Ausgeschlossene Felder tauchen in keinem Chunktext auf:
    expect(chunks.some((c) => c.text.includes('nie@indexieren.ch'))).toBe(false);
  });

  it('die Liste der zulässigen Felder ist explizit und eingefroren', () => {
    expect(CHUNKABLE_SECTIONS).toEqual([
      'description', 'objectives', 'prerequisites', 'keywords', 'free_reason',
    ]);
    expect(Object.isFrozen(CHUNKABLE_SECTIONS)).toBe(true);
  });
});
