/**
 * Formatprüfung des Goldstandard-Startsets (S01).
 *
 * Das Startset trägt Status initial_unrated und ist ausdrücklich noch kein
 * fertiger Goldstandard (>=150 Aufgaben, zwei unabhängige Bewertungen folgen
 * nach Katalogsnapshot). Dieser Test friert das Austauschformat ein, damit
 * Bewertung und Auswertung später nicht am Schema scheitern.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, 'fixtures', 'ai-search-goldstandard', 'tasks-initial.json'), 'utf-8'),
);

const LANGUAGES = new Set(['de', 'fr', 'it']);
const SEGMENTS = new Set(['beruf', 'privat', 'kinder']);
const SPLITS = new Set(['calibration', 'holdout']);
const STATUSES = new Set(['initial_unrated', 'rated', 'conflict_resolved']);

describe('Goldstandard-Startset', () => {
  it('hat Version, Hinweis und Aufgabenliste', () => {
    expect(fixture.version).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(typeof fixture.note).toBe('string');
    expect(Array.isArray(fixture.tasks)).toBe(true);
    expect(fixture.tasks.length).toBeGreaterThanOrEqual(20);
  });

  it('jede Aufgabe erfüllt das Schema', () => {
    const seen = new Set();
    for (const task of fixture.tasks) {
      expect(task.id, 'id fehlt').toBeTruthy();
      expect(seen.has(task.id), `doppelte id ${task.id}`).toBe(false);
      seen.add(task.id);
      expect(LANGUAGES.has(task.language), `${task.id}: language`).toBe(true);
      expect(SEGMENTS.has(task.segment), `${task.id}: segment`).toBe(true);
      expect(typeof task.query).toBe('string');
      expect(task.query.length).toBeGreaterThan(10);
      expect(task.expected && typeof task.expected.musts).toBe('object');
      expect(task.expected && typeof task.expected.wishes).toBe('object');
      expect(Array.isArray(task.traps)).toBe(true);
      expect(STATUSES.has(task.judgments.status), `${task.id}: status`).toBe(true);
      expect(SPLITS.has(task.split), `${task.id}: split`).toBe(true);
    }
  });

  it('deckt alle drei Sprachen und alle drei Segmente ab', () => {
    const langs = new Set(fixture.tasks.map((t) => t.language));
    const segments = new Set(fixture.tasks.map((t) => t.segment));
    expect(langs).toEqual(LANGUAGES);
    expect(segments).toEqual(SEGMENTS);
  });

  it('enthält Aufgaben für die kritischen Fallen (unbekannter Preis, Negation, Preisbasis)', () => {
    const traps = new Set(fixture.tasks.flatMap((t) => t.traps));
    expect(traps.has('unknown_price')).toBe(true);
    expect(traps.has('negation_online')).toBe(true);
    expect(traps.has('price_per_unit')).toBe(true);
    expect(traps.has('same_event')).toBe(true);
  });

  it('unbewertete Aufgaben behaupten keine Urteile und keinen Snapshot', () => {
    for (const task of fixture.tasks) {
      if (task.judgments.status === 'initial_unrated') {
        expect(task.judgments.raterA).toBeNull();
        expect(task.judgments.raterB).toBeNull();
        expect(task.judgments.snapshotId).toBeNull();
      }
    }
  });

  it('beide Splits sind vorhanden (Holdout wird nie zur Kalibrierung verwendet)', () => {
    const splits = new Set(fixture.tasks.map((t) => t.split));
    expect(splits).toEqual(SPLITS);
  });
});
