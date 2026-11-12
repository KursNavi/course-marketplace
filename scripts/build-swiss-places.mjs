/**
 * Erzeugt den Ortsdatensatz fuer die Umkreissuche: src/data/swissPlaces.json
 *
 * Warum ein eigener Datensatz statt eines Geocoding-Dienstes?
 *   Die Umkreissuche muss jede PLZ- oder Ortseingabe in Koordinaten umrechnen.
 *   Ueber einen Online-Dienst waere das pro Suchaufruf eine kostenpflichtige
 *   Abfrage mit Nutzungsgrenzen. Die Schweiz hat aber nur rund 4500 Postleit-
 *   zahlen — die passen als statische Tabelle in die Anwendung und werden erst
 *   dann geladen, wenn jemand die Umkreissuche tatsaechlich benutzt.
 *
 * Quelle: GeoNames Postleitzahlen Schweiz (CC BY 4.0)
 *   https://download.geonames.org/export/zip/CH.zip
 *   Spalten (Tab-getrennt): Land, PLZ, Ortsname, Kanton, Kantonskuerzel,
 *   Bezirk, Bezirksnummer, Gemeinde, Gemeindenummer, Breite, Laenge, Genauigkeit
 *
 * Die Koordinaten sind Ortsmittelpunkte, keine Hausadressen. Genau deshalb
 * kennzeichnet die Oberflaeche daraus abgeleitete Kursorte als «ungefaehr».
 *
 * Erneut ausfuehren (wiederholbar, Ergebnis ist stabil sortiert):
 *   1. https://download.geonames.org/export/zip/CH.zip herunterladen, entpacken
 *   2. node scripts/build-swiss-places.mjs <pfad-zu-CH.txt>
 *
 * Es werden keine Koordinaten erfunden: Zeilen ohne verwertbare Breite/Laenge
 * werden verworfen, nicht geschaetzt.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const QUELLE = 'GeoNames postal codes CH (CC BY 4.0), https://download.geonames.org/export/zip/CH.zip';
const ZIEL = resolve('src/data/swissPlaces.json');

const eingabe = process.argv[2];
if (!eingabe) {
  console.error('Aufruf: node scripts/build-swiss-places.mjs <pfad-zu-CH.txt>');
  process.exit(1);
}

const zeilen = readFileSync(resolve(eingabe), 'utf8').split(/\r?\n/);

const eintraege = [];
const gesehen = new Set();
let verworfen = 0;

for (const zeile of zeilen) {
  if (!zeile.trim()) continue;
  const spalten = zeile.split('\t');
  const plz = (spalten[1] || '').trim();
  const ort = (spalten[2] || '').trim();
  const kanton = (spalten[4] || '').trim();
  const breite = Number.parseFloat(spalten[9]);
  const laenge = Number.parseFloat(spalten[10]);

  if (!/^\d{4}$/.test(plz) || !ort || !Number.isFinite(breite) || !Number.isFinite(laenge)) {
    verworfen += 1;
    continue;
  }

  // Postfach-Varianten («Aarau 1», «Zuerich 1») sind keine eigenen Ortschaften.
  // Ueber die PLZ bleiben sie auffindbar, in der Ortsnamen-Liste wuerden sie
  // nur Dubletten erzeugen.
  const nurPostfach = / \d+$/.test(ort);

  const schluessel = `${plz}|${ort}`;
  if (gesehen.has(schluessel)) continue;
  gesehen.add(schluessel);

  eintraege.push([
    plz,
    ort,
    kanton,
    Math.round(breite * 10000) / 10000,
    Math.round(laenge * 10000) / 10000,
    nurPostfach ? 1 : 0,
  ]);
}

eintraege.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1], 'de-CH') : a[0].localeCompare(b[0])));

const ausgabe = {
  quelle: QUELLE,
  lizenz: 'CC BY 4.0',
  erstellt: new Date().toISOString().slice(0, 10),
  felder: ['plz', 'ort', 'kanton', 'lat', 'lng', 'nurPostfach'],
  orte: eintraege,
};

mkdirSync(dirname(ZIEL), { recursive: true });
writeFileSync(ZIEL, `${JSON.stringify(ausgabe)}\n`, 'utf8');

console.log(`${eintraege.length} Ortseintraege geschrieben nach ${ZIEL} (${verworfen} Zeilen ohne Koordinaten verworfen).`);
