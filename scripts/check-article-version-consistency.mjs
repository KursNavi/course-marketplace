/**
 * Reproduzierbare Prüfung: Wird eine öffentliche Artikel-URL konsistent in
 * derselben Fassung ausgeliefert?
 *
 * Hintergrund
 * -----------
 * Gemeldet wurde, beim Artikel «Berufseinstieg» erscheine zunächst eine ältere
 * Version mit anderer Inhaltsstruktur und erst nach erneutem Laden die
 * aktuelle. Vermutet wurde Caching oder CDN-Verhalten.
 *
 * Die Untersuchung ergab etwas anderes. Dieses Skript macht beides messbar:
 *
 *   1. Auslieferungsebene (HTTP)
 *      Mehrfache Abrufe derselben URL. Verglichen werden ETag, Last-Modified
 *      und die Länge des ausgelieferten HTML. Weichen sie ab, liefert die
 *      Auslieferung selbst unterschiedliche Fassungen — dann wäre Caching
 *      oder CDN tatsächlich die Ursache.
 *
 *   2. Darstellungsebene (Browser)
 *      Der Artikelinhalt wird nach dem Laden im Abstand von 100 ms abgetastet.
 *      Wechselt der Inhalt, wird der Wechsel mit Zeitpunkt ausgegeben. Genau
 *      hier lag die Ursache: Die Seite zeigte zuerst die im JS-Bundle
 *      mitgelieferte Legacy-Fassung und tauschte sie gegen die Datenbank-
 *      Fassung, sobald deren Antwort eintraf.
 *
 * Verwendung
 * ----------
 *   node scripts/check-article-version-consistency.mjs <basis-url> [pfad ...]
 *
 *   node scripts/check-article-version-consistency.mjs https://kursnavi.ch
 *   node scripts/check-article-version-consistency.mjs http://localhost:5173 \
 *     /bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg
 *
 * Das Skript verändert nichts. Es liest ausschliesslich öffentliche Seiten.
 * Exit-Code 1, sobald eine Inkonsistenz gefunden wird.
 */

import { chromium } from 'playwright';

const DEFAULT_PATHS = [
  '/bereich/beruflich/sport-fitness-berufsausbildung/berufseinstieg',
  '/bereich/beruflich/sport-fitness-berufsausbildung/diplom-aufstieg',
  '/bereich/privat-hobby/yoga-achtsamkeit/atemarbeit-breathwork',
];

const ABTASTUNGEN = 40;   // 40 x 100 ms = 4 Sekunden
const INTERVALL_MS = 100;

const base = process.argv[2];
const paths = process.argv.length > 3 ? process.argv.slice(3) : DEFAULT_PATHS;

if (!base) {
  console.error('Basis-URL fehlt.\n  node scripts/check-article-version-consistency.mjs <basis-url> [pfad ...]');
  process.exit(2);
}

/** Ebene 1: Liefert HTTP dreimal dasselbe Dokument? */
async function pruefeAuslieferung(url) {
  const abrufe = [];
  for (let i = 0; i < 3; i += 1) {
    const res = await fetch(url, { redirect: 'follow' });
    const body = await res.text();
    abrufe.push({
      status: res.status,
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      cacheControl: res.headers.get('cache-control'),
      cdn: res.headers.get('x-vercel-cache'),
      laenge: body.length,
    });
  }

  const ersteId = `${abrufe[0].etag}|${abrufe[0].laenge}`;
  const konsistent = abrufe.every((a) => `${a.etag}|${a.laenge}` === ersteId);

  return { abrufe, konsistent };
}

/** Ebene 2: Wechselt der sichtbare Artikelinhalt nach dem Laden? */
async function pruefeDarstellung(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const zustaende = [];
  for (let i = 0; i < ABTASTUNGEN; i += 1) {
    const zustand = await page.evaluate(() => {
      const el = document.querySelector('.prose-ratgeber');
      const laden = document.querySelector('[role="status"][aria-busy="true"]');
      if (laden) return { art: 'laden' };
      if (!el) return { art: 'leer' };
      const text = el.innerText;
      return {
        art: 'inhalt',
        laenge: text.length,
        // Erste Überschrift als gut lesbarer Fingerabdruck der Gliederung.
        erste: el.querySelector('h2')?.textContent?.trim() || '',
      };
    });
    zustaende.push({ ms: i * INTERVALL_MS, ...zustand });
    await page.waitForTimeout(INTERVALL_MS);
  }

  // Aufeinanderfolgende gleiche Zustände zusammenfassen.
  const phasen = [];
  for (const z of zustaende) {
    const key = z.art === 'inhalt' ? `inhalt:${z.erste}` : z.art;
    if (phasen.length === 0 || phasen[phasen.length - 1].key !== key) {
      phasen.push({ key, abMs: z.ms, ...z });
    }
  }

  const inhaltsPhasen = phasen.filter((p) => p.art === 'inhalt');
  return { phasen, wechselt: inhaltsPhasen.length > 1, inhaltsPhasen };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let probleme = 0;

for (const pfad of paths) {
  const url = base.replace(/\/$/, '') + pfad;
  console.log(`\n===== ${pfad}`);

  const a = await pruefeAuslieferung(url);
  const h = a.abrufe[0];
  console.log('  [1] Auslieferung (HTTP)');
  console.log(`      Status ${h.status} | Cache-Control: ${h.cacheControl || '—'} | CDN: ${h.cdn || '—'}`);
  console.log(`      ETag: ${h.etag || '—'} | Last-Modified: ${h.lastModified || '—'}`);
  if (a.konsistent) {
    console.log('      OK    drei Abrufe liefern dasselbe Dokument');
  } else {
    probleme += 1;
    console.log('      FEHLER unterschiedliche Dokumente bei gleicher URL:');
    a.abrufe.forEach((x, i) => console.log(`        Abruf ${i + 1}: etag=${x.etag} laenge=${x.laenge}`));
  }

  const d = await pruefeDarstellung(page, url);
  console.log('  [2] Darstellung (Browser)');
  d.phasen.forEach((p) => {
    const label = p.art === 'inhalt' ? `Inhalt (${p.laenge} Zeichen) — «${p.erste}»` : p.art;
    console.log(`      ab ${String(p.abMs).padStart(4)}ms  ${label}`);
  });
  if (d.wechselt) {
    probleme += 1;
    console.log('      FEHLER der sichtbare Artikel wechselt nach dem Laden die Fassung');
  } else {
    console.log('      OK    durchgehend dieselbe Fassung');
  }
}

await browser.close();

console.log(probleme === 0
  ? '\nERGEBNIS: konsistent — keine abweichenden Fassungen gefunden.'
  : `\nERGEBNIS: ${probleme} Inkonsistenz(en) gefunden.`);
process.exit(probleme === 0 ? 0 : 1);
