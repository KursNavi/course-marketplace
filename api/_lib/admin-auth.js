/**
 * Admin-Authentifizierung für serverseitige Endpunkte.
 *
 * Spiegelt exakt das Verfahren aus api/admin.js:
 *   1. Bearer-Token aus dem Authorization-Header,
 *   2. Token gegen Supabase Auth prüfen,
 *   3. profiles.role === 'admin' verlangen.
 *
 * Bewusst als Helfer und nicht als Kopie im Endpunkt, damit ein künftiger
 * Ausbau der Admin-Prüfung nicht an einer Stelle vergessen wird. api/admin.js
 * bleibt unverändert — dessen Prüfung ist identisch und wird hier nicht
 * angefasst, um den bestehenden Endpunkt nicht zu berühren.
 */

/**
 * @returns {Promise<{ ok: true, user: object } | { ok: false, status: number, error: string }>}
 */
export async function requireAdmin(req, supabaseAdmin) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.slice('Bearer '.length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, user: authData.user };
}

/** UUID-v4-Prüfung, gleiches Muster wie in api/admin.js. */
export function isValidUUID(value) {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Begrenzt eine Zahl aus einer Query auf einen erlaubten Bereich. */
export function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
