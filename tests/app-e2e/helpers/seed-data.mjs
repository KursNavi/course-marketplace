/**
 * Helpers to fetch seed data from the Supabase test project.
 *
 * All helpers return `null` when env vars are missing, so tests can
 * call `test.skip()` gracefully.
 */

function cfg() {
  const url = process.env.SUPABASE_URL_TEST;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY_TEST;
  return { url, key, ok: !!(url && key) };
}

async function query(table, filter, select = 'id') {
  const { url, key, ok } = cfg();
  if (!ok) return null;

  const resp = await fetch(
    `${url}/rest/v1/${table}?${filter}&select=${select}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const rows = await resp.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Fetch any published course (optionally filtered). */
export function fetchCourse(extraFilter = '') {
  const filter = `status=eq.published${extraFilter ? '&' + extraFilter : ''}`;
  return query('courses', filter, 'id,title,booking_type');
}

/** Fetch a published lead-type course. */
export function fetchLeadCourse() {
  return fetchCourse('booking_type=eq.lead');
}

/** Fetch a published platform-type course. */
export function fetchPlatformCourse() {
  return fetchCourse('booking_type=eq.platform');
}

/** Fetch a published blog article. */
export function fetchArticle() {
  return query('articles', 'is_published=eq.true', 'id,title,slug');
}

/** Fetch a provider with a published public profile. */
export function fetchProvider() {
  return query(
    'profiles',
    'slug=not.is.null&profile_published_at=not.is.null',
    'id,full_name,slug'
  );
}

/** Check whether Supabase test env vars are set. */
export function isSupabaseAvailable() {
  return cfg().ok;
}
