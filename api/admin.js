import { createClient } from '@supabase/supabase-js';

/**
 * Unified Admin API
 * Handles admin profile operations via action parameter
 *
 * Actions:
 * - GET ?action=profiles           → Get all profiles
 * - POST action=set-tier           → Set user package tier
 * - POST action=set-verify         → Set user verification status
 */

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
  // Check environment
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  // Auth check
  if (adminSecret) {
    const incoming = req.headers['x-admin-secret'];
    if (incoming !== adminSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const action = req.query.action || parseBody(req).action;

  try {
    // ============================================
    // ACTION: profiles - Get all profiles
    // ============================================
    if (action === 'profiles') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*');

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ data: data || [] });
    }

    // ============================================
    // ACTION: set-tier - Set user package tier
    // ============================================
    if (action === 'set-tier') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { userId, package_tier } = parseBody(req);

      if (!userId || !package_tier) {
        return res.status(400).json({ error: 'Missing userId or package_tier' });
      }

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ package_tier, courses_allowed: null })
        .eq('id', userId)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ data });
    }

    // ============================================
    // ACTION: set-verify - Set verification status
    // ============================================
    if (action === 'set-verify') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { userId, newStatus } = parseBody(req);

      if (!userId || typeof newStatus !== 'boolean') {
        return res.status(400).json({ error: 'Missing userId or newStatus(boolean)' });
      }

      // 1) Update profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          is_professional: newStatus,
          verification_status: newStatus ? 'verified' : 'pending'
        })
        .eq('id', userId);

      if (profileError) return res.status(500).json({ error: profileError.message });

      // 2) Update all courses for this user
      const { error: coursesError } = await supabaseAdmin
        .from('courses')
        .update({ is_pro: newStatus })
        .eq('user_id', userId);

      if (coursesError) return res.status(500).json({ error: coursesError.message });

      return res.status(200).json({ ok: true });
    }

    // Unknown action
    return res.status(400).json({ error: 'Unknown action. Use: profiles, set-tier, or set-verify' });

  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
