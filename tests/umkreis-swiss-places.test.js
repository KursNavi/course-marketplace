/**
 * Ortsauflösung: Postleitzahl und Ortsname → Koordinaten.
 *
 * Verifiziert:
 *   1  Vorschläge zu PLZ, Ortsname und gemischter Eingabe
 *   2  Umlaute und Akzente in allen Schreibweisen («Zürich», «Zurich», «Zuerich»)
 *   3  Mehrdeutige Orte werden ALLE angeboten statt stillschweigend geraten
 *   4  Kennungen aus der Adresszeile werden wieder korrekt aufgelöst
 *   5  Die Kantonstabelle deckt sich mit CANTON_ABBR der Anwendung
 *   6  Der mitgelieferte Datensatz ist plausibel (Umfang, Lage, Umlaute)
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CANTON_NAME_BY_CODE,
  buildPlacesIndex,
  cantonCodeFromName,
  findPlaceSuggestions,
  formatPlaceLabel,
  lookupByLocalityName,
  lookupByPlz,
  normalizePlaceName,
  placeKeys,
  resolvePlaceId,
} from '../src/lib/swissPlaces.js';
import { CANTON_ABBR } from '../src/lib/constants.js';

// Kleiner Testdatensatz im Format der echten Tabelle:
// [plz, ort, kantonCode, lat, lng, nurPostfach]
const TEST_DATEN = {
  quelle: 'Test',
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
    ['8002', 'Zürich', 'ZH', 47.3601, 8.5327, 0],
    ['8021', 'Zürich 1', 'ZH', 47.3744, 8.5411, 1],
    ['8400', 'Winterthur', 'ZH', 47.5, 8.7241, 0],
    ['3000', 'Bern', 'BE', 46.948, 7.4474, 0],
    ['9470', 'Buchs SG', 'SG', 47.1667, 9.4667, 0],
    ['5033', 'Buchs AG', 'AG', 47.3833, 8.0667, 0],
    ['1200', 'Genève', 'GE', 46.2044, 6.1432, 0],
    ['9000', 'St. Gallen', 'SG', 47.4245, 9.3767, 0],
  ],
};

const index = buildPlacesIndex(TEST_DATEN);

describe('normalizePlaceName und placeKeys', () => {
  it.each([
    ['Zürich', 'zurich'],
    ['St. Gallen', 'stgallen'],
    ['Genève', 'geneve'],
    ['Biel/Bienne', 'bielbienne'],
  ])('%s → %s', (eingabe, erwartet) => {
    expect(normalizePlaceName(eingabe)).toBe(erwartet);
  });

  it('liefert für Umlaute beide Schreibweisen', () => {
    expect(placeKeys('Zürich')).toEqual(['zurich', 'zuerich']);
  });

  it('liefert für Namen ohne Umlaut nur eine Form', () => {
    expect(placeKeys('Bern')).toEqual(['bern']);
  });
});

describe('cantonCodeFromName', () => {
  it.each([
    ['Zürich', 'ZH'],
    ['St. Gallen', 'SG'],
    ['Basel-Landschaft', 'BL'],
    ['ZH', 'ZH'],
    ['Online', ''],
    ['Ausland', ''],
    ['', ''],
    [null, ''],
  ])('%s → %s', (eingabe, erwartet) => {
    expect(cantonCodeFromName(eingabe)).toBe(erwartet);
  });
});

describe('Kantonstabelle bleibt mit der Anwendung deckungsgleich', () => {
  it('jedes Kürzel aus CANTON_ABBR ist hier mit demselben Namen hinterlegt', () => {
    Object.entries(CANTON_ABBR).forEach(([name, code]) => {
      expect(CANTON_NAME_BY_CODE[code]).toBe(name);
    });
  });

  it('enthält keine Kürzel, die die Anwendung nicht kennt', () => {
    const bekannt = new Set(Object.values(CANTON_ABBR));
    Object.keys(CANTON_NAME_BY_CODE).forEach((code) => {
      expect(bekannt.has(code)).toBe(true);
    });
  });
});

describe('findPlaceSuggestions', () => {
  it('ignoriert zu kurze Eingaben', () => {
    expect(findPlaceSuggestions(index, '')).toEqual([]);
    expect(findPlaceSuggestions(index, '8')).toEqual([]);
  });

  it('findet eine vollständige Postleitzahl', () => {
    const treffer = findPlaceSuggestions(index, '8001');
    expect(treffer[0].plz).toBe('8001');
    expect(treffer[0].ort).toBe('Zürich');
    expect(treffer[0].label).toBe('8001 Zürich (ZH)');
  });

  it('findet Postleitzahlen auch nach Teileingabe', () => {
    const treffer = findPlaceSuggestions(index, '80');
    expect(treffer.map((t) => t.plz)).toEqual(expect.arrayContaining(['8001', '8002']));
  });

  it.each(['Zürich', 'Zurich', 'zuerich', 'ZÜRICH'])('findet Zürich bei Eingabe «%s»', (eingabe) => {
    const treffer = findPlaceSuggestions(index, eingabe);
    expect(treffer.length).toBeGreaterThan(0);
    expect(treffer[0].ort).toBe('Zürich');
  });

  it('fasst mehrere Postleitzahlen desselben Ortes zu einem Vorschlag zusammen', () => {
    const treffer = findPlaceSuggestions(index, 'Zürich');
    const zuerich = treffer.filter((t) => t.ort === 'Zürich' && t.kind === 'ort');
    expect(zuerich).toHaveLength(1);
    // Mittelpunkt der PLZ-Kreise 8001 und 8002, nicht einer der beiden.
    expect(zuerich[0].lat).toBeCloseTo((47.3721 + 47.3601) / 2, 3);
  });

  it('zeigt Postfach-Varianten nicht als eigene Ortschaft', () => {
    const treffer = findPlaceSuggestions(index, 'Zürich');
    expect(treffer.some((t) => t.kind === 'ort' && t.ort === 'Zürich 1')).toBe(false);
  });

  it('bietet bei mehrdeutigem Namen ALLE Treffer an, statt zu raten', () => {
    const treffer = findPlaceSuggestions(index, 'Buchs');
    const kantone = treffer.map((t) => t.kantonCode).sort();
    expect(kantone).toEqual(['AG', 'SG']);
  });

  it('nutzt bei gemischter Eingabe die Ziffern führend und den Text einschränkend', () => {
    const treffer = findPlaceSuggestions(index, '8001 Zürich');
    expect(treffer[0].plz).toBe('8001');
  });

  it('liefert für eine unbekannte Eingabe nichts statt etwas Falsches', () => {
    expect(findPlaceSuggestions(index, 'Hogwarts')).toEqual([]);
  });

  it('arbeitet ohne Index ohne Absturz', () => {
    expect(findPlaceSuggestions(null, 'Zürich')).toEqual([]);
  });
});

describe('resolvePlaceId — Kennung aus der Adresszeile', () => {
  it('löst eine PLZ-Kennung wieder auf', () => {
    const place = resolvePlaceId(index, 'plz:8001:Zürich');
    expect(place.lat).toBeCloseTo(47.3721, 4);
    expect(place.label).toBe('8001 Zürich (ZH)');
  });

  it('löst eine Ortschafts-Kennung wieder auf', () => {
    const place = resolvePlaceId(index, 'ort:ZH:Winterthur');
    expect(place.lat).toBeCloseTo(47.5, 4);
    expect(place.label).toBe('Winterthur (ZH)');
  });

  it('gibt bei unbekannter Kennung null zurück statt eines geratenen Ortes', () => {
    expect(resolvePlaceId(index, 'plz:9999:Nirgendwo')).toBeNull();
    expect(resolvePlaceId(index, 'ort:XX:Nirgendwo')).toBeNull();
    expect(resolvePlaceId(index, 'unsinn')).toBeNull();
    expect(resolvePlaceId(index, '')).toBeNull();
  });

  it('liefert für jeden Vorschlag eine Kennung, die wieder zum selben Punkt führt', () => {
    ['8001', 'Winterthur', 'Buchs'].forEach((eingabe) => {
      findPlaceSuggestions(index, eingabe).forEach((vorschlag) => {
        const zurueck = resolvePlaceId(index, vorschlag.id);
        expect(zurueck).not.toBeNull();
        expect(zurueck.lat).toBeCloseTo(vorschlag.lat, 4);
        expect(zurueck.lng).toBeCloseTo(vorschlag.lng, 4);
      });
    });
  });
});

describe('lookupByPlz / lookupByLocalityName — für Kursorte', () => {
  it('findet eine PLZ', () => {
    expect(lookupByPlz(index, '3000').ort).toBe('Bern');
  });

  it('entscheidet bei mehreren Namen zur selben PLZ über den Ortshinweis', () => {
    const daten = buildPlacesIndex({
      orte: [
        ['1234', 'Musterdorf', 'BE', 46.9, 7.4, 0],
        ['1234', 'Musterdorf Postfach', 'BE', 46.91, 7.41, 1],
      ],
    });
    expect(lookupByPlz(daten, '1234', { ortHinweis: 'Musterdorf' }).ort).toBe('Musterdorf');
    // Ohne Hinweis wird die echte Ortschaft bevorzugt, nicht die Postfach-Zeile.
    expect(lookupByPlz(daten, '1234').nurPostfach).toBe(false);
  });

  it('findet einen eindeutigen Ortsnamen', () => {
    expect(lookupByLocalityName(index, 'Winterthur').kantonCode).toBe('ZH');
  });

  it('rät bei mehrdeutigem Ortsnamen NICHT', () => {
    expect(lookupByLocalityName(index, 'Buchs')).toBeNull();
  });

  /**
   * Gleichnamige Orte heissen im Datensatz «Buchs SG» / «Buchs AG», in den
   * Kursdaten steht aber meist nur «Buchs» plus ein eigenes Kantonsfeld.
   * Die Grundform ohne Kuerzel muss deshalb mitgefunden werden.
   */
  it('löst einen mehrdeutigen Ortsnamen mit Kantonshinweis auf', () => {
    expect(lookupByLocalityName(index, 'Buchs', { kantonHinweis: 'St. Gallen' }).plzListe).toContain('9470');
    expect(lookupByLocalityName(index, 'Buchs', { kantonHinweis: 'Aargau' }).plzListe).toContain('5033');
  });

  it('findet einen Ort auch mit amtlichem Kantonskuerzel im Namen', () => {
    expect(lookupByLocalityName(index, 'Buchs SG').plzListe).toContain('9470');
  });

  it('gibt für unbekannte Angaben null zurück', () => {
    expect(lookupByPlz(index, '0000')).toBeNull();
    expect(lookupByLocalityName(index, 'Nirgendwo')).toBeNull();
    expect(lookupByLocalityName(index, '')).toBeNull();
  });
});

describe('formatPlaceLabel', () => {
  it.each([
    [{ kind: 'plz', plz: '8001', ort: 'Zürich', kantonCode: 'ZH' }, '8001 Zürich (ZH)'],
    [{ kind: 'ort', ort: 'Bern', kantonCode: 'BE' }, 'Bern (BE)'],
    [{ kind: 'ort', ort: 'Vaduz', kantonCode: '' }, 'Vaduz'],
  ])('%o → %s', (place, erwartet) => {
    expect(formatPlaceLabel(place)).toBe(erwartet);
  });
});

/**
 * Der echte Datensatz. Hier geht es nicht um Vollständigkeit, sondern darum,
 * dass die mitgelieferte Datei wirklich brauchbar ist — und dass die Umlaute
 * beim Erzeugen nicht zerschossen wurden.
 */
describe('mitgelieferter Ortsdatensatz', () => {
  const daten = JSON.parse(readFileSync(resolve('src/data/swissPlaces.json'), 'utf8'));
  const echt = buildPlacesIndex(daten);

  it('enthält den Grossteil der Schweizer Postleitzahlen', () => {
    expect(daten.orte.length).toBeGreaterThan(4000);
  });

  it('nennt Quelle und Lizenz — die Namensnennung ist Lizenzbedingung', () => {
    expect(daten.quelle).toMatch(/geonames/i);
    expect(daten.lizenz).toMatch(/CC BY/i);
  });

  it('liegt vollständig im Bereich der Schweiz', () => {
    echt.rows.forEach((row) => {
      expect(row.lat).toBeGreaterThan(45.7);
      expect(row.lat).toBeLessThan(47.9);
      expect(row.lng).toBeGreaterThan(5.8);
      expect(row.lng).toBeLessThan(10.6);
    });
  });

  it('hat unversehrte Umlaute (kein Mojibake)', () => {
    const zuerich = echt.byPlz.get('8001');
    expect(zuerich.some((row) => row.ort === 'Zürich')).toBe(true);
    const alleNamen = echt.rows.map((row) => row.ort).join(' ');
    expect(alleNamen).not.toMatch(/Ã/);
  });

  it.each([
    ['8001', 'Zürich', 47.37, 8.54],
    ['3000', 'Bern', 46.94, 7.44],
    ['9000', 'St. Gallen', 47.42, 9.37],
    ['6900', 'Lugano', 46.0, 8.95],
  ])('%s %s liegt am erwarteten Ort', (plz, ort, lat, lng) => {
    const row = lookupByPlz(echt, plz, { ortHinweis: ort });
    expect(row).not.toBeNull();
    expect(row.lat).toBeCloseTo(lat, 1);
    expect(row.lng).toBeCloseTo(lng, 1);
  });

  it('ordnet jedem Eintrag einen bekannten Kanton zu', () => {
    echt.rows.forEach((row) => {
      expect(CANTON_NAME_BY_CODE[row.kantonCode]).toBeTruthy();
    });
  });
});
