/**
 * POST /api/record-legal-acceptance
 *
 * Speichert einen Consent-Nachweis in der Tabelle legal_acceptances.
 * Verwendet die Service Role, damit kein direkter Client-Zugriff nötig ist.
 *
 * Body:
 *   context        string  — z.B. "registration", "package_purchase", "package_upgrade"
 *   terms_version  string  — AGB-Version (ISO-Datum)
 *   privacy_version string — Datenschutz-Version (optional)
 *   metadata       object  — optionale Zusatzinformationen (z.B. package_tier)
 *
 * Authorization: Bearer <supabase-access-token>
 */

import { createClient } from '@supabase/supabase-js';

const ALLOWED_CONTEXTS = [
  'registration',
  'provider_onboarding',
  'course_publish',
  'package_purchase',
  'package_upgrade',
  'course_creation_service',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Bearer-Token aus Authorization-Header lesen
  const authHeader = req.headers['authorization'] || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return res.status(401).json({ error: 'Nicht autorisiert.' });
  }

  // Nutzer über normalen Supabase-Client verifizieren (JWT validieren)
  const supabaseAnon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(accessToken);
  if (authError || !user) {
    return res.status(401).json({ error: 'Ungültige Sitzung.' });
  }

  // Body parsen
  const { context, terms_version, privacy_version, metadata } = req.body || {};

  if (!context || !ALLOWED_CONTEXTS.includes(context)) {
    return res.status(400).json({ error: `Ungültiger Kontext: ${context}` });
  }
  if (!terms_version || typeof terms_version !== 'string') {
    return res.status(400).json({ error: 'terms_version fehlt.' });
  }

  // Schreiben mit Service Role (umgeht RLS)
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const ip = (
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null
  );
  const ua = req.headers['user-agent'] || null;

  const { error: insertError } = await supabaseAdmin
    .from('legal_acceptances')
    .insert({
      user_id: user.id,
      context,
      terms_version,
      privacy_version: privacy_version || null,
      ip_address: ip ? String(ip).split(',')[0].trim() : null,
      user_agent: ua,
      metadata: metadata || null,
    });

  if (insertError) {
    console.error('[record-legal-acceptance] DB-Fehler:', insertError.message);
    return res.status(500).json({ error: 'Consent konnte nicht gespeichert werden.' });
  }

  return res.status(200).json({ ok: true });
}
