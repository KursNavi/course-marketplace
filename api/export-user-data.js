import { createClient } from '@supabase/supabase-js';

/**
 * Export User Data API
 * Returns a JSON file with all user data (profile, bookings, saved courses, leads).
 *
 * GET /api/export-user-data
 * Headers: Authorization: Bearer <jwt>
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user identity
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = user.id;

    // Fetch all user data in parallel
    const [profileRes, bookingsRes, savedCoursesRes, leadsRes] = await Promise.all([
      // Profile (exclude sensitive/internal fields)
      supabase
        .from('profiles')
        .select('full_name, email, role, city, canton, bio_text, certificates, additional_locations, website_url, preferred_language, slug, verification_status, created_at')
        .eq('id', userId)
        .single(),

      // Bookings with course/event info
      supabase
        .from('bookings')
        .select('id, course_id, event_id, status, booking_type, is_paid, paid_at, refunded_at, auto_refund_until, payout_eligible_at, created_at, courses(id, title), course_events(id, start_date, location, city)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Saved courses (Merkliste)
      supabase
        .from('saved_courses')
        .select('course_id, created_at, courses(id, title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Leads (only for providers)
      supabase
        .from('leads')
        .select('id, course_id, status, created_at, courses(id, title)')
        .eq('provider_id', userId)
        .order('created_at', { ascending: false })
    ]);

    // Build export object
    const exportData = {
      export_info: {
        exported_at: new Date().toISOString(),
        platform: 'KursNavi',
        user_id: userId
      },
      profile: profileRes.data || null,
      bookings: bookingsRes.data || [],
      saved_courses: savedCoursesRes.data || [],
      leads: leadsRes.data || []
    };

    // Set headers for JSON file download
    const filename = `kursnavi-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).json(exportData);
  } catch (error) {
    console.error('Export user data error:', error);
    return res.status(500).json({ error: 'Fehler beim Exportieren der Daten' });
  }
}
