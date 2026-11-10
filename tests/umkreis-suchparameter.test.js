/**
 * Zusammenspiel mit den bestehenden Filtern — und der Umgang mit dem
 * Gerätestandort.
 *
 * Verifiziert:
 *   1  Der Umkreis wirkt ZUSÄTZLICH zu den anderen Filtern; die Reihenfolge
 *      der Filterschritte ändert das Ergebnis nicht
 *   2  Der Umkreis läuft auf dem gesamten Kursbestand, nicht auf einem
 *      Ausschnitt der Anzeige
 *   3  Präzise Gerätekoordinaten landen weder in der Adresszeile noch in
 *      einem Speicher, einer Messung oder einem Protokoll
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildPlacesIndex } from '../src/lib/swissPlaces.js';
import { createGeoResolver, filterCoursesByRadius } from '../src/lib/courseGeo.js';

const index = buildPlacesIndex({
  orte: [
    ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
    ['8400', 'Winterthur', 'ZH', 47.5, 8.7241, 0],
    ['3000', 'Bern', 'BE', 46.948, 7.4474, 0],
  ],
});
const ZUERICH = { lat: 47.3721, lng: 8.5417 };

const kurs = (id, ort, kanton, over = {}) => ({
  id,
  title: `Kurs ${id}`,
  canton: kanton,
  level: 'Beginner',
  languages: ['Deutsch'],
  course_events: [{ start_date: '2027-02-10', canton: kanton, city: ort }],
  ...over,
});

const bestand = [
  kurs('zh-de', 'Zürich', 'Zürich'),
  kurs('zh-fr', 'Zürich', 'Zürich', { languages: ['Französisch'] }),
  kurs('wi-de', 'Winterthur', 'Zürich'),
  kurs('be-de', 'Bern', 'Bern'),
];

const nurDeutsch = (liste) => liste.filter((c) => c.languages.includes('Deutsch'));
const nurKantonZuerich = (liste) => liste.filter((c) => c.canton === 'Zürich');
const imUmkreis = (liste, km = 25) => filterCoursesByRadius(liste, {
  center: ZUERICH, radiusKm: km, placesIndex: index, resolveGeo: createGeoResolver(index),
});

describe('1 — der Umkreis wirkt zusätzlich zu den bestehenden Filtern', () => {
  it('Umkreis und Sprachfilter zusammen ergeben den Schnitt beider', () => {
    expect(imUmkreis(nurDeutsch(bestand)).map((c) => c.id)).toEqual(['zh-de', 'wi-de']);
  });

  it('die Reihenfolge der Filterschritte ändert das Ergebnis nicht', () => {
    const a = imUmkreis(nurDeutsch(bestand)).map((c) => c.id);
    const b = nurDeutsch(imUmkreis(bestand)).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('ein Kantonsfilter wirkt weiter und kann sich mit dem Umkreis überschneiden', () => {
    // Beides aktiv: Kanton Zürich UND 25 km um Zürich.
    expect(imUmkreis(nurKantonZuerich(bestand)).map((c) => c.id)).toEqual(['zh-de', 'zh-fr', 'wi-de']);
  });

  it('ein Kantonsfilter, der dem Umkreis widerspricht, führt zu keinem Treffer', () => {
    // Kanton Bern, Umkreis um Zürich — die Kombination ist leer. Genau darum
    // ist der Umkreis in der Oberfläche als eigener Chip einzeln entfernbar.
    const nurBern = bestand.filter((c) => c.canton === 'Bern');
    expect(imUmkreis(nurBern)).toEqual([]);
  });

  it('behält in jeder Kombination die Eingabereihenfolge', () => {
    const treffer = imUmkreis(nurDeutsch(bestand), 50);
    const positionen = treffer.map((c) => bestand.indexOf(c));
    expect(positionen).toEqual([...positionen].sort((x, y) => x - y));
  });
});

describe('2 — der Umkreis läuft auf dem gesamten Bestand', () => {
  it('ein Treffer am Ende einer langen Liste wird genauso gefunden wie einer am Anfang', () => {
    const viele = [
      ...Array.from({ length: 60 }, (_, i) => kurs(`fern-${i}`, 'Bern', 'Bern')),
      kurs('letzter-treffer', 'Winterthur', 'Zürich'),
    ];
    expect(imUmkreis(viele).map((c) => c.id)).toEqual(['letzter-treffer']);
  });
});

/**
 * 3 — Datenschutz beim Gerätestandort.
 *
 * Diese Prüfungen lesen den Quelltext, weil die Regel nicht «funktioniert
 * irgendwie», sondern «kommt an bestimmten Stellen nachweislich nicht vor»
 * lautet. Ein Verhaltenstest kann das Fehlen einer Weitergabe nicht belegen.
 */
describe('3 — präzise Gerätekoordinaten verlassen die Seite nicht', () => {
  const appSource = readFileSync(resolve('src/App.jsx'), 'utf8');
  const deviceSource = readFileSync(resolve('src/lib/deviceLocation.js'), 'utf8');
  const panelSource = readFileSync(resolve('src/components/RadiusSearchPanel.jsx'), 'utf8');

  it('in die Adresszeile kommt nur die Kennung eines manuell gewählten Ortes', () => {
    // Der near-Parameter wird ausschliesslich aus einem Ort mit
    // source === 'place' gebildet.
    expect(appSource).toMatch(/radiusOrigin\?\.source === 'place' \? radiusOrigin\.id/);
  });

  it('es gibt keinen Suchparameter für Breite oder Länge', () => {
    expect(appSource).not.toMatch(/params\.set\(\s*['"](lat|lng|latitude|longitude|coords)['"]/);
  });

  it('der Standort wird nicht dauerhaft gespeichert', () => {
    [deviceSource, panelSource].forEach((source) => {
      expect(source).not.toMatch(/localStorage|sessionStorage|safeStorage|document\.cookie/);
    });
  });

  it('der Standort wird nicht gemeldet oder protokolliert', () => {
    [deviceSource, panelSource].forEach((source) => {
      expect(source).not.toMatch(/fetch\(|supabase|analytics|track[A-Z]|console\.(log|info|warn|error)/);
    });
  });

  it('die Standortabfrage steckt in einer Funktion, die nur auf Klick läuft', () => {
    // Kein Aufruf im Modulkörper und keiner in einem Effekt: der einzige
    // Aufruf von requestDeviceLocation steht in der Klick-Behandlung.
    expect(panelSource).toMatch(/const useDeviceLocation = async \(\) => \{/);
    const aufrufe = panelSource.match(/requestDeviceLocation\(/g) || [];
    expect(aufrufe).toHaveLength(1);
    expect(panelSource).not.toMatch(/useEffect\([^)]*requestDeviceLocation/);
  });

  it('fragt auch nicht über eine Berechtigungsabfrage vorab nach', () => {
    [deviceSource, panelSource, appSource].forEach((source) => {
      expect(source).not.toMatch(/navigator\.permissions/);
      expect(source).not.toMatch(/watchPosition/);
    });
  });
});
