/**
 * Schweizer Schreibweise in sichtbaren Texten.
 *
 * Hintergrund:
 *   In Schweizer Inhalten stand teilweise «maßgeblich» mit ß, während andere
 *   Stellen korrekt «massgeblich» schrieben. Die Schweizer Rechtschreibung kennt
 *   kein ß — in sichtbarem Text ist es immer ein Fehler.
 *
 * Warum nicht einfach global ersetzen:
 *   Sieben Stellen enthalten ß absichtlich, nämlich in der Slug-Normalisierung
 *   `.replace(/ß/g, 'ss')`. Dort ist das ß der Suchwert: Es wandelt eine
 *   Nutzereingabe wie «Strauß» in eine URL-taugliche Form um. Würde man es
 *   entfernen, entstünden fehlerhafte URLs. Genau diese Stellen nimmt der Test
 *   deshalb bewusst aus — und nur diese.
 *
 * Der Test schlägt an, sobald irgendwo sonst ein ß auftaucht.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const WURZELN = ['src', 'api'];
const ENDUNGEN = ['.js', '.jsx'];

/** Einzig zulässiger Kontext: ß als Suchwert der Slug-Normalisierung. */
const ERLAUBT = /\.replace\(\s*\/ß\/g\s*,\s*['"]ss['"]\s*\)/g;

function sammleDateien(wurzel) {
  const treffer = [];
  const lauf = (dir) => {
    for (const eintrag of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, eintrag.name);
      if (eintrag.isDirectory()) {
        if (eintrag.name === 'node_modules' || eintrag.name === 'dist') continue;
        lauf(p);
      } else if (ENDUNGEN.some((e) => eintrag.name.endsWith(e))) {
        treffer.push(p);
      }
    }
  };
  lauf(path.resolve(process.cwd(), wurzel));
  return treffer;
}

describe('Schweizer Schreibweise — kein ß ausserhalb der Slug-Normalisierung', () => {
  const dateien = WURZELN.flatMap(sammleDateien);

  it('findet überhaupt Dateien zum Prüfen', () => {
    expect(dateien.length).toBeGreaterThan(50);
  });

  it('enthält nirgends ein ß in sichtbarem Text', () => {
    const funde = [];

    for (const datei of dateien) {
      const inhalt = fs.readFileSync(datei, 'utf8');
      if (!inhalt.includes('ß')) continue;

      // Erlaubte Vorkommen entfernen, danach darf kein ß übrig bleiben.
      const rest = inhalt.replace(ERLAUBT, '');
      if (!rest.includes('ß')) continue;

      rest.split('\n').forEach((zeile, i) => {
        if (zeile.includes('ß')) {
          funde.push(`${path.relative(process.cwd(), datei)}:${i + 1}: ${zeile.trim()}`);
        }
      });
    }

    expect(funde, `ß gefunden:\n${funde.join('\n')}`).toEqual([]);
  });

  it('lässt die Slug-Normalisierung unangetastet', () => {
    // Gegenprobe: Die erlaubten Stellen existieren noch. Verschwänden sie,
    // wäre der Test oben trivial erfüllt — und Umlaut-Slugs wären kaputt.
    const anzahl = dateien
      .map((d) => (fs.readFileSync(d, 'utf8').match(ERLAUBT) || []).length)
      .reduce((a, b) => a + b, 0);

    expect(anzahl).toBeGreaterThanOrEqual(7);
  });
});
