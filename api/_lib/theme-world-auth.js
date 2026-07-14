/**
 * Gemeinsame Admin-Authentifizierungsprüfung für Theme-World-API-Endpunkte.
 *
 * Authentifizierungsreihenfolge (verbindlich):
 *   1. Bearer Token aus Authorization-Header auslesen
 *   2. Supabase-User via supabaseAdmin.auth.getUser(token) verifizieren
 *   3. profiles.role = 'admin' prüfen
 *   4. Erst danach Service-Role-Operationen ausführen
 *
 * Sicherheitsregeln:
 *   - Service-Role-Key niemals an den Browser senden
 *   - Keine internen Supabase-Details in Fehlerantworten
 *   - Auth-Token niemals vollständig loggen
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Erstellt einen Supabase-Admin-Client mit Service Role Key.
 * Wirft einen Fehler wenn Umgebungsvariablen fehlen.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 * @throws {Error} wenn SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen
 */
export function createServiceClient() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Prüft Admin-Berechtigung für einen eingehenden Request.
 *
 * @param {import('http').IncomingMessage} req - Vercel/Node HTTP Request
 * @param {import('http').ServerResponse} res - Vercel/Node HTTP Response
 * @returns {Promise<{supabaseAdmin: import('@supabase/supabase-js').SupabaseClient, userId: string} | null>}
 *   Gibt null zurück wenn die Auth fehlgeschlagen ist (res wurde bereits geschrieben).
 *   Gibt { supabaseAdmin, userId } zurück bei Erfolg.
 */
export async function requireAdmin(req, res) {
  // 1. Umgebungsvariablen prüfen
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Server configuration error.' });
    return null;
  }

  // 2. Bearer Token auslesen
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header.' });
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Empty bearer token.' });
    return null;
  }

  // 3. Supabase-Admin-Client erstellen (Service Role)
  const supabaseAdmin = createServiceClient();

  // 4. Supabase-User verifizieren (JWT validieren)
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    res.status(401).json({ error: 'Ungültige oder abgelaufene Sitzung.' });
    return null;
  }

  const userId = authData.user.id;

  // 5. Admin-Rolle im Profil prüfen
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError || profile?.role !== 'admin') {
    res.status(403).json({ error: 'Zugriff verweigert. Admin-Berechtigung erforderlich.' });
    return null;
  }

  return { supabaseAdmin, userId };
}

/**
 * Hilfsfunktion: Method-Check mit frühem Return.
 *
 * @param {string} allowed - Erlaubte HTTP-Methode (z.B. 'POST')
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true wenn Methode erlaubt, false wenn res bereits geschrieben
 */
export function requireMethod(allowed, req, res) {
  if (req.method !== allowed) {
    res.status(405).json({ error: `Method not allowed. Expected ${allowed}.` });
    return false;
  }
  return true;
}

/**
 * Hilfsfunktion: JSON-Body sicher parsen.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {object}
 */
export function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

/**
 * UUID v4 Format validieren.
 *
 * @param {string|any} str
 * @returns {boolean}
 */
export function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}
