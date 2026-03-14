import { getPrimaryCategorySlug } from './courseMetadata';

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
  return (import.meta.env.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');
};

export const SITE_URL = getBaseUrl();

// Remove trailing slash if present
export const BASE_URL = SITE_URL.replace(/\/$/, '');

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
 * Slugify string for URL-safe usage
 * Handles German umlauts and special characters
 * @param {string} input - String to slugify
 * @returns {string} URL-safe slug
 */
export function slugify(input) {
  return (input || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build SEO-friendly course path
 * @param {object} course - Course object with id, category_area, canton, title
 * @returns {string} Course path (relative)
 */
export function buildCoursePath(course) {
  if (!course) return '/search';
  const topic = slugify(getPrimaryCategorySlug(course));
  const loc = slugify(course.canton || 'schweiz');
  const title = slugify(course.title || 'detail');
  return `/courses/${topic}/${loc}/${course.id}-${title}`;
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
