#!/usr/bin/env node
/**
 * geo-coverage.mjs — wiederholbar ausfuehrbarer Ablauf fuer die Kursorte.
 *
 * Zwei Betriebsarten:
 *
 *   1. Bericht (Standard, nur lesend)
 *      Prueft fuer jeden veroeffentlichten Kurs, ob sein Veranstaltungsort mit
 *      derselben Logik wie die Umkreissuche (src/lib/courseGeo.js) auf
 *      Koordinaten aufgeloest werden kann. Ergebnis: eine Liste der Kurse, die
 *      bei aktivem Umkreis NICHT als raeumlicher Treffer zaehlen koennen — plus
 *      der Grund. Damit ist sichtbar, wo Ortsdaten nachgetragen werden muessen.
 *
 *   2. Ergaenzen (--fill, schreibend)
 *      Traegt die aufgeloesten Ortsmittelpunkte in die Spalten latitude /
 *      longitude / geo_precision / geo_source ein. Setzt voraus, dass die
 *      Migration supabase/migrations/20261110120000_add_geo_coordinates_to_course_places.sql
 *      eingespielt ist. Ist sie es nicht, bricht das Skript ab, ohne etwas zu
 *      aendern. Bereits von Hand gesetzte Werte (geo_source = 'manual') werden
 *      nie ueberschrieben.
 *
 * Wiederholbar: Der Lauf ist idempotent. Ein zweiter Lauf schreibt nichts
 * Neues, solange sich die Ortsdaten nicht geaendert haben.
 *
 * Es werden keine Koordinaten erfunden. Was sich nicht eindeutig aufloesen
 * laesst, bleibt leer und erscheint im Bericht.
 *
 * Aufruf:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/geo-coverage.mjs
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/geo-coverage.mjs --fill
 *
 * Zielumgebung bewusst ueber die Umgebungsvariablen steuern — das Skript waehlt
 * NIE selbst ein Projekt aus.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { buildPlacesIndex } from '../src/lib/swissPlaces.js';
import { getCourseGeoInfo, resolveLocationPoint } from '../src/lib/courseGeo.js';

const FILL = process.argv.includes('--fill');
const LIMIT_AUSGABE = 40;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein.');
  console.error('Das Skript waehlt bewusst kein Projekt selbst aus.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const placesIndex = buildPlacesIndex(
  JSON.parse(readFileSync(resolve('src/data/swissPlaces.json'), 'utf8')),
);

console.log(`Ortstabelle: ${placesIndex.rows.length} Postleitzahlen, ${placesIndex.localities.length} Ortschaften`);
console.log(`Ziel: ${url}`);
console.log(FILL ? 'Modus: ERGAENZEN (schreibend)\n' : 'Modus: BERICHT (nur lesend)\n');

const { data: courses, error } = await supabase
  .from('courses')
  .select('id, title, status, city, canton, address, course_events(*), course_locations(*)')
  .eq('status', 'published');

if (error) {
  console.error('ERROR beim Lesen der Kurse:', error.message);
  process.exit(1);
}

const gruppen = { located: [], online: [], ausland: [], unknown: [] };

for (const course of courses || []) {
  const info = getCourseGeoInfo(course, placesIndex);
  gruppen[info.status].push({ course, info });
}

const gesamt = (courses || []).length;
console.log('--- Abdeckung der Veranstaltungsorte ---');
console.log(`veroeffentlichte Kurse insgesamt : ${gesamt}`);
console.log(`mit Koordinaten (Umkreis moeglich): ${gruppen.located.length}`);
console.log(`reine Onlinekurse (kein Umkreis)  : ${gruppen.online.length}`);
console.log(`Ausland (kein Schweizer Umkreis)  : ${gruppen.ausland.length}`);
console.log(`ohne zuordenbaren Ort             : ${gruppen.unknown.length}`);

if (gruppen.unknown.length > 0) {
  console.log(`\n--- Nacharbeit noetig (erste ${Math.min(LIMIT_AUSGABE, gruppen.unknown.length)}) ---`);
  console.log('Diese Kurse erscheinen weiterhin in der normalen Suche, koennen bei');
  console.log('aktivem Umkreis aber nicht als raeumlicher Treffer gewertet werden.');
  for (const { course } of gruppen.unknown.slice(0, LIMIT_AUSGABE)) {
    const orte = [
      ...(course.course_events || []).map((ev) => ev.location || ev.city || ev.canton),
      ...(course.course_locations || []).map((lo) => [lo.street, lo.city, lo.canton].filter(Boolean).join(' ')),
      course.address || course.city || course.canton,
    ].filter(Boolean);
    console.log(`  #${course.id} ${String(course.title || '').slice(0, 60)} → ${orte.slice(0, 2).join(' | ') || '(keine Ortsangabe)'}`);
  }
  if (gruppen.unknown.length > LIMIT_AUSGABE) {
    console.log(`  … und ${gruppen.unknown.length - LIMIT_AUSGABE} weitere`);
  }
}

if (!FILL) {
  console.log('\nFertig (nichts geaendert). Mit --fill werden die Koordinaten eingetragen.');
  process.exit(0);
}

// --- Ergaenzen ---------------------------------------------------------------
// Erst pruefen, ob die Spalten da sind. Ohne diese Pruefung wuerde jeder
// Schreibversuch einzeln scheitern und die Fehlermeldung waere nicht erklaerend.
const { error: spaltenFehler } = await supabase
  .from('course_events')
  .select('id, latitude, longitude, geo_precision, geo_source')
  .limit(1);

if (spaltenFehler) {
  console.error('\nERROR: Die Geo-Spalten fehlen in course_events.');
  console.error('Bitte zuerst die Migration einspielen:');
  console.error('  supabase/migrations/20261110120000_add_geo_coordinates_to_course_places.sql');
  console.error(`Antwort der Datenbank: ${spaltenFehler.message}`);
  process.exit(1);
}

let geschrieben = 0;
let uebersprungen = 0;

/** Traegt einen aufgeloesten Punkt in eine Zeile ein, ohne Handarbeit zu ueberschreiben. */
async function schreibe(tabelle, zeile, entry) {
  if (zeile.geo_source === 'manual') { uebersprungen += 1; return; }
  const punkt = resolveLocationPoint(entry, placesIndex);
  if (!punkt) return;

  const unveraendert = zeile.latitude === punkt.lat
    && zeile.longitude === punkt.lng
    && zeile.geo_precision === 'locality';
  if (unveraendert) { uebersprungen += 1; return; }

  const { error: schreibFehler } = await supabase
    .from(tabelle)
    .update({
      latitude: punkt.lat,
      longitude: punkt.lng,
      geo_precision: 'locality',
      geo_source: 'swissPlaces',
      geo_updated_at: new Date().toISOString(),
    })
    .eq('id', zeile.id);

  if (schreibFehler) {
    console.error(`  Fehler bei ${tabelle} #${zeile.id}: ${schreibFehler.message}`);
    return;
  }
  geschrieben += 1;
}

for (const { course } of gruppen.located) {
  for (const event of course.course_events || []) {
    await schreibe('course_events', event, event);
  }
  for (const location of course.course_locations || []) {
    await schreibe('course_locations', location, location);
  }
}

console.log(`\nFertig. ${geschrieben} Zeilen ergaenzt, ${uebersprungen} unveraendert oder von Hand gesetzt.`);
