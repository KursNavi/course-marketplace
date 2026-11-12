/**
 * REGRESSION: Alle Kurse an einem Kartenpunkt sind aus der Karte erreichbar.
 *
 * Gemeldetes Fehlerbild:
 *   Bei «8000 Zürich, 50 km, Kanton Aargau» zeigte das Fenster am Punkt
 *   5072 Oeschgen fünf Kurslinks und dazu nur den Hinweis «und 5 weitere an
 *   diesem Ort». Diese weiteren Kurse liessen sich aus der Karte nicht
 *   auswählen.
 *
 * Behebung:
 *   Das Fenster zeigt jetzt ALLE Kurse des Punktes als Links. Statt
 *   abzuschneiden scrollt die Liste innerhalb des Fensters (feste
 *   Maximalhöhe), damit das Fenster auch bei vielen Kursen nicht über den
 *   Kartenrand hinauswächst. Die Reihenfolge ist weiterhin die der
 *   Ergebnisliste — also die bestehende Priorisierung, keine Entfernung.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildPopupHtml } from '../src/lib/mapPopup.js';
import { buildPlacesIndex } from '../src/lib/swissPlaces.js';
import { buildMapMarkers, createGeoResolver, filterCoursesByRadius } from '../src/lib/courseGeo.js';
import { sortCoursesByRelevance } from '../src/lib/searchRelevance.js';

const buildPath = (course) => `/courses/test/${course.id}`;

/** Marker mit n Kursen am selben Punkt, in gegebener Reihenfolge. */
function markerMit(titelListe, label = '5072 Oeschgen (AG)') {
  return {
    key: '47.4567,7.9500',
    lat: 47.4567,
    lng: 7.95,
    courses: titelListe.map((title, i) => ({
      course: { id: `kurs-${i + 1}`, title },
      label,
      approximate: true,
    })),
  };
}

/** Links in Dokumentreihenfolge aus dem erzeugten HTML. */
function linksAus(html) {
  const treffer = [...html.matchAll(/<a [^>]*data-course-id="([^"]+)"[^>]*>([^<]*)<\/a>/g)];
  return treffer.map(([, id, text]) => ({ id, text }));
}

describe('Fenster mit mehr als fünf Kursen — der gemeldete Fall', () => {
  const zehnTitel = Array.from({ length: 10 }, (_, i) => `Kurs Nr. ${i + 1}`);
  const html = buildPopupHtml(markerMit(zehnTitel), buildPath, 'courses');

  it('ALLE zehn Kurse sind als Link enthalten', () => {
    const links = linksAus(html);
    expect(links).toHaveLength(10);
    expect(links.map((l) => l.text)).toEqual(zehnTitel);
  });

  it('es gibt keinen abgeschnittenen Rest mehr («und N weitere»)', () => {
    expect(html).not.toMatch(/und \d+ weitere/);
  });

  it('die Reihenfolge entspricht exakt der Eingabe — also der Priorisierung', () => {
    expect(linksAus(html).map((l) => l.id)).toEqual(zehnTitel.map((_, i) => `kurs-${i + 1}`));
  });

  it('jeder Link trägt den Pfad seines Kurses', () => {
    zehnTitel.forEach((_, i) => {
      expect(html).toContain(`href="/courses/test/kurs-${i + 1}"`);
    });
  });

  it('die Liste scrollt in sich selbst statt das Fenster wachsen zu lassen', () => {
    expect(html).toMatch(/max-height:\s*\d+px/);
    expect(html).toMatch(/overflow-y:\s*auto/);
    // Am Listenende darf nicht die Karte weiterscrollen/zoomen.
    expect(html).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('die Kopfzeile nennt Ort und Kursanzahl', () => {
    expect(html).toContain('5072 Oeschgen (AG)');
    expect(html).toContain('10 Kurse');
  });

  it('jeder Eintrag ist mindestens 40 px hoch — auf dem Smartphone treffbar', () => {
    const vorkommen = html.match(/min-height:\s*40px/g) || [];
    expect(vorkommen.length).toBe(10);
  });
});

describe('Fenster mit wenigen Kursen', () => {
  it('ein einzelner Kurs: Link da, keine Kursanzahl in der Kopfzeile', () => {
    const html = buildPopupHtml(markerMit(['Einzelkurs']), buildPath, 'courses');
    expect(linksAus(html)).toHaveLength(1);
    expect(html).not.toMatch(/\d+ Kurse/);
  });

  it('Sonderzeichen im Kurstitel werden entschärft', () => {
    const html = buildPopupHtml(markerMit(['<script>alert(1)</script> & Co.']), buildPath, 'courses');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; Co.');
  });

  it('der Orts-Modus der Kursdetailseite bleibt unverändert', () => {
    const html = buildPopupHtml(markerMit(['Egal']), buildPath, 'place');
    expect(html).toContain('ungefähre Lage (Ortsmittelpunkt)');
    expect(linksAus(html)).toHaveLength(0);
  });
});

/**
 * Durchstich mit der echten Kette: zehn Kurse am selben Ort, gefiltert nach
 * Kanton + Umkreis, priorisiert sortiert — das Fenster muss alle zehn in
 * genau dieser Reihenfolge führen.
 */
describe('vollständige Kette: Filter → Priorisierung → Marker → Fenster', () => {
  const index = buildPlacesIndex({
    orte: [
      ['8001', 'Zürich', 'ZH', 47.3721, 8.5417, 0],
      ['5072', 'Oeschgen', 'AG', 47.512, 7.974, 0],
    ],
  });
  const ZUERICH = { lat: 47.3721, lng: 8.5417 };

  // Zehn Kurse in Oeschgen mit gestaffelten Rangfaktoren: drei hervorgehoben,
  // unterschiedliche Buchungsfaktoren — die Priorisierung hat also eine klar
  // pruefbare Rangfolge zu bilden.
  const kurse = Array.from({ length: 10 }, (_, i) => ({
    id: `oe-${i + 1}`,
    title: `Oeschgen Kurs ${i + 1}`,
    keywords: [],
    category_specialty: '',
    category_focus: '',
    instructor_name: '',
    canton: 'Aargau',
    address: '',
    is_prio: i % 3 === 0,
    booking_factor: 1 + (i % 4) * 0.2,
    course_events: [{ start_date: '2027-06-01', canton: 'Aargau', city: 'Oeschgen' }],
  }));

  const resolver = createGeoResolver(index);
  const gefiltert = filterCoursesByRadius(kurse, {
    center: ZUERICH, radiusKm: 50, placesIndex: index, resolveGeo: resolver, cantons: ['Aargau'],
  });
  const sortiert = sortCoursesByRelevance(gefiltert, { query: '', seed: 0.42 });
  const marker = buildMapMarkers(sortiert, resolver, { center: ZUERICH, radiusKm: 50, cantons: ['Aargau'] });

  it('alle zehn Kurse passieren den Kanton+Umkreis-Filter', () => {
    expect(gefiltert).toHaveLength(10);
  });

  it('alle zehn landen in EINEM Marker, in priorisierter Reihenfolge', () => {
    expect(marker).toHaveLength(1);
    expect(marker[0].courses.map((c) => c.course.id)).toEqual(sortiert.map((c) => c.id));
  });

  it('das Fenster führt alle zehn als Link, in derselben Reihenfolge', () => {
    const html = buildPopupHtml(marker[0], buildPath, 'courses');
    expect(linksAus(html).map((l) => l.id)).toEqual(sortiert.map((c) => c.id));
  });

  it('die Priorisierung ist echt geprüft: Reihenfolge folgt dem Sichtbarkeits-Score', () => {
    // Score = Hervorhebung (1.2|1.0) × Buchungsfaktor + Streuung (≤ 0.15).
    // Wo mehr als 0.15 zwischen zwei Scores liegt, ist die Rangfolge
    // zwingend — genau das prüfen wir, statt eine Pauschalregel
    // («hervorgehoben immer zuerst») anzunehmen, die der Algorithmus so
    // nicht hat: ein Normalkurs mit Buchungsfaktor 1.6 steht zu Recht vor
    // einem hervorgehobenen mit 1.0.
    const score = (c) => (c.is_prio ? 1.2 : 1.0) * c.booking_factor;
    const ids = sortiert.map((c) => c.id);
    kurse.forEach((a) => {
      kurse.forEach((b) => {
        if (score(a) > score(b) + 0.15) {
          expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
        }
      });
    });
    // Und bei gleichem Buchungsfaktor gewinnt die Hervorhebung:
    // oe-1 (prio, 1.0) steht vor oe-2 (normal, 1.2)? Nein — oe-2 hat 1.2.
    // Vergleichbar sind oe-1 (prio, Faktor 1.0 → 1.2) und oe-5 (normal,
    // Faktor 1.0 → 1.0): mehr als 0.15 Abstand, oe-1 muss vorne stehen.
    expect(ids.indexOf('oe-1')).toBeLessThan(ids.indexOf('oe-5'));
  });
});

describe('Klick-Verdrahtung des Fensters', () => {
  const quelle = readFileSync(resolve('src/components/CourseMap.jsx'), 'utf8');

  it('Klicks werden direkt am Fenster abgefangen (Leaflet stoppt die Weitergabe)', () => {
    // Ohne diesen Listener folgt der Browser dem Link als ganze
    // Seitenneuladung, statt die Kursseite in der Anwendung zu öffnen.
    expect(quelle).toMatch(/map\.on\('popupopen'/);
    expect(quelle).toMatch(/knLinksBound/);
  });

  it('Strg/Cmd-Klick bleibt dem Browser überlassen (neuer Tab)', () => {
    expect(quelle).toMatch(/event\.ctrlKey \|\| event\.metaKey/);
  });
});
