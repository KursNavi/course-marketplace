/**
 * Permanenter Redirect von einer nicht-kanonischen Kurs-URL auf die kanonische
 * Kurs-URL.
 *
 * Hintergrund: `courses.category_area` enthält bei neueren Kursen eine
 * numerische Taxonomie-ID. Die Sitemap hat daraus URLs wie
 *   /courses/12/zuerich/779-...
 * erzeugt, während Browser und Canonical
 *   /courses/kunst/zuerich/779-...
 * verwendeten. Beide Varianten lieferten HTTP 200 — klassisches Duplicate
 * Content. Der Client korrigierte das bisher nur per history.replaceState,
 * was für Suchmaschinen wirkungslos ist.
 *
 * Routing (vercel.json): Alle dreiteiligen /courses/-Pfade werden hierher
 * umgeschrieben. Das ist nötig, weil ältere URLs nicht nur numerische
 * Themen-IDs, sondern auch überholte Text-Slugs enthalten können (z. B.
 * `alltag-leben` statt `freizeit-natur`). Statische kanonische Kursseiten
 * werden von Vercel vor Rewrites ausgeliefert. Falls ausnahmsweise keine
 * statische Datei vorliegt, verhindert der Gleichheitscheck unten trotzdem
 * eine Redirect-Schleife.
 *
 * Fällt die Auflösung aus (Kurs unbekannt, DB nicht erreichbar), wird die
 * SPA-Shell mit HTTP 200 ausgeliefert — also exakt das bisherige Verhalten.
 * Ein Ausfall der Datenbank darf keine Kurs-URL in einen Fehler verwandeln.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildCanonicalCoursePath, hasStableCanonicalTopic } from '../src/lib/courseUrl.js';
import { attachPrimaryCategories, fetchCourseCategoryRows } from './_lib/course-categories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Von der Rewrite-Regel injizierte Parameter — nie Teil der echten Query.
 *
 * Diese Namen müssen exakt den benannten Captures der Rewrite-Source in
 * vercel.json entsprechen: Vercel hängt jeden Source-Capture automatisch an die
 * Destination-Query an. Heisst ein Capture anders als der hier gelistete Name,
 * hält ihn diese Funktion für Besucherquery und schreibt ihn in den
 * 308-Location-Header.
 */
const INJECTED_PARAMS = ['__topic', '__loc', '__cseg'];

/** Cache für die SPA-Shell — pro Lambda-Instanz nur einmal von der Platte lesen. */
let shellCache;

function readSpaShell() {
  if (shellCache !== undefined) return shellCache;

  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(__dirname, '..', 'dist', 'index.html'),
  ];

  for (const candidate of candidates) {
    try {
      shellCache = readFileSync(candidate, 'utf-8');
      return shellCache;
    } catch {
      // nächster Kandidat
    }
  }

  shellCache = null;
  return shellCache;
}

/**
 * Liest die von der Rewrite-Regel übergebenen Segmente sowie die vom Besucher
 * mitgeschickte Query (ohne die injizierten Parameter).
 */
export function parseCourseRedirectRequest(req) {
  const query = req?.query || {};
  const topic = query.__topic || '';
  const location = query.__loc || '';
  const courseSegment = query.__cseg || '';

  const passthrough = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (INJECTED_PARAMS.includes(key)) continue;
    for (const single of Array.isArray(value) ? value : [value]) {
      passthrough.append(key, single);
    }
  }

  return {
    topic,
    location,
    courseSegment,
    courseId: String(courseSegment).split('-')[0] || null,
    originalPath: topic && location && courseSegment
      ? `/courses/${topic}/${location}/${courseSegment}`
      : null,
    search: passthrough.toString(),
  };
}

/** Lädt genau einen veröffentlichten Kurs inklusive semantischer Kategorien. */
async function loadCourse(courseId) {
  // Genau das öffentliche Paar, das auch der Browser nutzt (src/lib/supabase.js)
  // und das der Themenwelt-Prerender verwendet. Bewusst KEINE Fallback-Kette:
  // URL und Key müssen aus derselben Konfigurationsfamilie stammen, sonst
  // entsteht ein «Invalid API key». Service-Role-Rechte sind nicht nötig — der
  // Redirect soll exakt die öffentlichen Kursdaten sehen, die RLS auch einem
  // normalen Besucher freigibt.
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const missing = [
      supabaseUrl ? null : 'VITE_SUPABASE_URL',
      supabaseKey ? null : 'VITE_SUPABASE_KEY',
    ].filter(Boolean).join(' und ');
    // Nur die Namen der fehlenden Variablen, nie deren Werte.
    console.warn(`[course-redirect] Öffentliche Supabase-Konfiguration fehlt: ${missing}.`);
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('courses')
    .select('id, title, category_type, category_area, category_specialty, category_focus, canton')
    .eq('id', courseId)
    .or('status.eq.published,status.is.null')
    .limit(1);

  if (error) {
    console.warn('[course-redirect] Kurs konnte nicht geladen werden:', error.message);
    return null;
  }

  const course = (data || [])[0];
  if (!course) return null;

  const { byCourseId, unresolvedIds } = await fetchCourseCategoryRows(supabase, [course.id]);
  const resolved = attachPrimaryCategories([course], byCourseId)[0];

  // Ein 308 ist dauerhaft — auf ein geratenes Themensegment darf er nie
  // zeigen. Sind die Kategorien gerade nicht abfragbar und ergeben die
  // eigenen Felder des Kurses kein semantisches Thema, lieber nicht
  // weiterleiten (der Client normalisiert die URL weiterhin selbst).
  if (unresolvedIds.has(course.id) && !hasStableCanonicalTopic(resolved)) {
    console.warn(`[course-redirect] Kurs ${course.id}: Kategorie nicht auflösbar — kein Redirect.`);
    return null;
  }

  return resolved;
}

function sendSpaShell(res) {
  const shell = readSpaShell();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  if (!shell) {
    // Ohne Shell nichts Sinnvolles auslieferbar — 404 ist ehrlicher als eine
    // leere 200-Seite.
    return res.status(404).send('Not found');
  }
  return res.status(200).send(shell);
}

export default async function handler(req, res) {
  const { courseId, originalPath, search } = parseCourseRedirectRequest(req);

  if (!courseId || !originalPath) return sendSpaShell(res);

  let course = null;
  try {
    course = await loadCourse(courseId);
  } catch (err) {
    console.warn('[course-redirect] Unerwarteter Fehler:', err?.message);
  }

  if (!course) return sendSpaShell(res);

  const canonicalPath = buildCanonicalCoursePath(course);

  // Schleifenschutz: Wäre das Ziel identisch mit der aufgerufenen URL, wird
  // regulär ausgeliefert statt weitergeleitet.
  if (canonicalPath === originalPath) return sendSpaShell(res);

  const target = search ? `${canonicalPath}?${search}` : canonicalPath;

  res.setHeader('Location', target);
  // Kurze CDN-Cachezeit: Eine Titel-/Kategorieänderung am Kurs verschiebt das
  // Redirect-Ziel, das darf nicht unbefristet zwischengespeichert werden.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return res.status(308).send(`Redirecting to ${target}`);
}
