import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminSecret = process.env.ADMIN_CONSOLE_SECRET;

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  if (adminSecret) {
    const incoming = req.headers['x-admin-secret'];
    if (incoming !== adminSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { userId, newStatus } = parseBody(req);

  if (!userId || typeof newStatus !== 'boolean') {
    return res.status(400).json({ error: 'Missing userId or newStatus(boolean)' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // 1) Profil
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      is_professional: newStatus,
      verification_status: newStatus ? 'verified' : 'pending'
    })
    .eq('id', userId);

  if (profileError) return res.status(500).json({ error: profileError.message });

  // 2) Alle Kurse des Lehrers
  const { error: coursesError } = await supabaseAdmin
    .from('courses')
    .update({ is_pro: newStatus })
    .eq('user_id', userId);

  if (coursesError) return res.status(500).json({ error: coursesError.message });

  return res.status(200).json({ ok: true });
}
