/**
 * Die EINZIGE Quelle der Wahrheit für Kurs-URLs.
 *
 * Vor diesem Modul erzeugten drei Stellen unterschiedliche URLs für denselben
 * Kurs (Sitemap: rohes numerisches `category_area`; DetailView: eigener,
 * umlaut-unsicherer Slug-Algorithmus; siteConfig: semantische Kategorie).
 * Das führte zu drei indexierbaren Varianten pro Kurs.
 *
 * Dieses Modul ist bewusst abhängigkeitsfrei (kein React, kein
 * `import.meta.env`), damit es sowohl im Browser-Bundle als auch in
 * Vercel-Serverless-Funktionen (api/sitemap.js, api/course-redirect.js)
 * unverändert läuft. Die Basis-URL wird deshalb immer hereingereicht.
 */

import { getPrimaryCategory, getPrimaryCategorySlug, normalizeCategoryType } from './courseCategory.js';

const NUMERIC_ONLY = /^\d+$/;

/** Kombinierende diakritische Zeichen (Unicode-Block "Combining Diacritical Marks"). */
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g');

/**
 * Slugify string for URL-safe usage.
 *
 * Reihenfolge ist bewusst gewählt:
 *   1. NFC — eine bereits zerlegte Eingabe ("u" + Kombinationszeichen) wird
 *      zusammengesetzt, damit die Umlaut-Regeln unten überhaupt greifen.
 *   2. Deutsche Umlaute expandieren (ue statt u), NICHT nur entkoppeln.
 *   3. NFD + Kombinationszeichen entfernen — übrige Diakritika (e-accent,
 *      a-circumflex …) werden auf den Basisbuchstaben gefaltet, statt zu
 *      Bindestrichen zu zerfallen ("Genève" -> "geneve", nicht "gen-ve").
 *
 * @param {string} input - String to slugify
 * @returns {string} URL-safe slug (nur [a-z0-9-])
 */
export function slugify(input) {
  return (input ?? '')
    .toString()
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' und ')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Erster Kandidat, der zu einem nicht-leeren, nicht rein numerischen Slug wird. */
function firstSemanticSlug(candidates) {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const slug = slugify(candidate);
    if (slug && !NUMERIC_ONLY.test(slug)) return slug;
  }
  return null;
}

/**
 * Themen-Segment der kanonischen Kurs-URL.
 *
 * Grundlage ist die bestehende Semantik von `getPrimaryCategorySlug()`. Ist
 * deren Ergebnis rein numerisch (Kurse, bei denen `courses.category_area` eine
 * Taxonomie-ID statt eines Slugs enthält), wird auf den nächsten semantischen
 * Kandidaten ausgewichen — eine ID ist kein sinnvolles URL-Segment und war die
 * Ursache der numerischen Sitemap-URLs.
 *
 * @param {object} course
 * @returns {string} Nicht-leeres, nicht rein numerisches Slug-Segment
 */
export function getCanonicalCourseTopicSlug(course) {
  if (!course) return 'kurs';

  const preferred = slugify(getPrimaryCategorySlug(course));
  if (preferred && !NUMERIC_ONLY.test(preferred)) return preferred;

  const primary = getPrimaryCategory(course);
  return firstSemanticSlug([
    primary?.category_focus_label,
    primary?.category_focus,
    primary?.category_specialty_label,
    primary?.category_specialty,
    primary?.category_area_label,
    primary?.category_area,
    course.primary_category,
    course.category_area_label,
    course.category_area,
    course.category_specialty,
    course.category_focus,
    normalizeCategoryType(course.category_type)
  ]) || 'kurs';
}

/**
 * Liefert der Kurs schon aus seinen eigenen Feldern ein eindeutig semantisches
 * Themensegment — also ohne die Rückfallebene in getCanonicalCourseTopicSlug()?
 *
 * Nur dann ist die kanonische URL stabil, wenn keine Kategoriedaten aus
 * v_course_full_categories vorliegen. Ist das Ergebnis dagegen rein numerisch,
 * würde das Themensegment aus Ersatzfeldern geraten — und könnte sich ändern,
 * sobald die Kategorien wieder auflösbar sind. Aufrufer, die eine dauerhafte
 * URL veröffentlichen (Sitemap) oder festschreiben (308-Redirect), müssen
 * solche Kurse in diesem Durchlauf auslassen statt zu raten.
 *
 * @param {object} course
 * @returns {boolean}
 */
export function hasStableCanonicalTopic(course) {
  if (!course) return false;
  const preferred = slugify(getPrimaryCategorySlug(course));
  return Boolean(preferred) && !NUMERIC_ONLY.test(preferred);
}

/**
 * Kanonischer, relativer Kurs-Pfad.
 * Struktur: /courses/{theme-slug}/{location-slug}/{id}-{title-slug}
 *
 * @param {object} course - Kurs mit id, Kategorien, canton, title
 * @returns {string} Kanonischer Pfad (relativ, ohne Query/Hash)
 */
export function buildCanonicalCoursePath(course) {
  if (!course) return '/search';
  const topic = getCanonicalCourseTopicSlug(course);
  const location = slugify(course.canton) || 'schweiz';
  const title = slugify(course.title) || 'detail';
  return `/courses/${topic}/${location}/${course.id}-${title}`;
}

/**
 * Kanonische, absolute Kurs-URL.
 *
 * `baseUrl` muss explizit übergeben werden und darf NICHT aus
 * `window.location.origin` stammen — sonst kanonisiert ein Aufruf über
 * www.kursnavi.ch auf sich selbst. Aufrufer nutzen die zentrale
 * Site-Konfiguration (CANONICAL_BASE_URL bzw. process.env.VITE_SITE_URL).
 *
 * @param {object} course
 * @param {string} baseUrl - Absolute Basis-URL ohne Slash am Ende
 * @returns {string} Absolute kanonische URL
 */
export function buildCanonicalCourseUrl(course, baseUrl) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  return `${base}${buildCanonicalCoursePath(course)}`;
}

/**
 * Extrahiert die Kurs-ID aus einem /courses/-Pfad.
 * Die ID ist die stabile Ressourcenkennung — Themen-, Orts- und Titel-Slug
 * sind reine SEO-Dekoration und dürfen keine zweite selbst-kanonische Variante
 * begründen.
 *
 * @param {string} pathname - z.B. "/courses/12/zuerich/779-titel"
 * @returns {string|null} ID-Teil oder null
 */
export function extractCourseIdFromPath(pathname) {
  if (!pathname) return null;
  const parts = String(pathname).split('?')[0].split('#')[0].split('/').filter(Boolean);
  if (parts[0] !== 'courses' || parts.length < 4) return null;
  const id = parts[3].split('-')[0];
  return id || null;
}
