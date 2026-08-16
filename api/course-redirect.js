/**
 * Permanenter Redirect von einer Kurs-URL mit numerischem Themensegment auf die
 * kanonische Kurs-URL.
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
 * Routing (vercel.json): Nur Pfade, deren Themensegment rein numerisch ist,
 * werden hierher umgeschrieben. Kanonische Kurs-URLs haben nie ein numerisches
 * Themensegment (siehe getCanonicalCourseTopicSlug) und lösen deshalb weder
 * einen Funktionsaufruf noch eine Redirect-Schleife aus.
 *
 * Fällt die Auflösung aus (Kurs unbekannt, DB nicht erreichbar), wird die
 * SPA-Shell mit HTTP 200 ausgeliefert — also exakt das bisherige Verhalten.
 * Ein Ausfall der Datenbank darf keine Kurs-URL in einen Fehler verwandeln.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildCanonicalCoursePath } from '../src/lib/courseUrl.js';
import { attachPrimaryCategories, fetchCourseCategoryRows } from './_lib/course-categories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Von der Rewrite-Regel injizierte Parameter — nie Teil der echten Query. */
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
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[course-redirect] Supabase nicht konfiguriert — keine Kanonisierung möglich.');
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

  const categories = await fetchCourseCategoryRows(supabase, [course.id]);
  return attachPrimaryCategories([course], categories)[0];
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
