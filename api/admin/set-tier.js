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

  const { userId, package_tier } = parseBody(req);

  if (!userId || !package_tier) {
    return res.status(400).json({ error: 'Missing userId or package_tier' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ package_tier, courses_allowed: null })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data });
}
