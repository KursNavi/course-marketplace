import { buildCanonicalCoursePath, slugify } from './courseUrl';

/**
 * Site Configuration
 * Centralized configuration for base URLs and site metadata
 * Used for canonical URLs, sitemaps, and SEO
 */

// Base URL: Use current origin in browser, fallback to env variable or production URL
// This ensures Vercel preview deployments show correct URLs
const getBaseUrl = () => {
  // In browser context, use current origin (works for Vercel previews)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // In server/build context, use env variable or production fallback
  return (import.meta.env?.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');
};

export const SITE_URL = getBaseUrl();

// Remove trailing slash if present
export const BASE_URL = SITE_URL.replace(/\/$/, '');

/**
 * Basis-URL für kanonische Auszeichnungen (canonical, og:url, JSON-LD).
 *
 * Bewusst UNABHÄNGIG von window.location.origin: sonst kanonisiert ein Aufruf
 * über www.kursnavi.ch auf www und der Host bleibt dupliziert. Quelle ist
 * ausschliesslich die zentrale Env-Konfiguration — genau wie in
 * seoUtils.buildCanonical(), api/sitemap.js und scripts/prerender-static.mjs.
 * Ein Preview-Deployment mit eigener VITE_SITE_URL kanonisiert dadurch weiter
 * auf sich selbst und nicht versehentlich auf Production.
 */
export const CANONICAL_BASE_URL = (import.meta.env?.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');

export { slugify };

/**
 * Build absolute URL from relative path
 * @param {string} path - Relative path (e.g., '/courses/...')
 * @returns {string} Absolute URL
 */
export function buildAbsoluteUrl(path) {
  if (!path) return BASE_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
}

/**
 * Build SEO-friendly course path.
 *
 * Dünner Alias auf den gemeinsamen Builder in ./courseUrl.js — dort liegt die
 * einzige Quelle der Wahrheit für Kurs-URLs (Sitemap, interne Links, Canonical,
 * og:url, JSON-LD, App-Normalisierung, serverseitiger Redirect).
 *
 * @param {object} course - Course object with id, categories, canton, title
 * @returns {string} Course path (relative)
 */
export function buildCoursePath(course) {
  return buildCanonicalCoursePath(course);
}

/**
 * Build provider profile path
 * @param {string} slug - Provider slug
 * @returns {string} Provider path (relative)
 */
export function buildProviderPath(slug) {
  if (!slug) return '/anbieter';
  return `/anbieter/${slug}`;
}

/**
 * Generate provider slug from name
 * Handles collisions by appending suffix
 * @param {string} name - Provider full name
 * @param {string[]} existingSlugs - Array of existing slugs for collision check
 * @returns {string} Unique slug
 */
export function generateProviderSlug(name, existingSlugs = []) {
  let baseSlug = slugify(name);

  // Ensure minimum length
  if (baseSlug.length < 3) {
    baseSlug = 'anbieter';
  }

  // Check for collision and add suffix if needed
  let slug = baseSlug;
  let counter = 2;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
