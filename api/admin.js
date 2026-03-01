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

// UUID v4 validation helper
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default async function handler(req, res) {
  // Check environment
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  // Auth check - REQUIRED
  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_CONSOLE_SECRET not configured' });
  }
  const incoming = req.headers['x-admin-secret'];
  if (!incoming || incoming !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
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

      const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 500);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const search = (req.query.q || '').trim();
      const role = (req.query.role || '').trim().toLowerCase();

      let query = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' });

      if (role === 'teacher') {
        query = query.eq('role', 'teacher');
      } else if (role === 'student') {
        query = query.eq('role', 'student');
      }

      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        data: data || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      });
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

      if (!isValidUUID(userId)) {
        return res.status(400).json({ error: 'Invalid userId format' });
      }

      const validTiers = ['basic', 'pro', 'premium', 'enterprise'];
      if (!validTiers.includes(package_tier.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid package_tier' });
      }

      // Build update data with expiry logic
      const updateData = { package_tier, courses_allowed: null };

      const tierLower = package_tier.toLowerCase();
      if (['pro', 'premium', 'enterprise'].includes(tierLower)) {
        // Paid tier: set expiry to 1 year from now
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        updateData.package_expires_at = expiresAt.toISOString();
      } else if (tierLower === 'basic') {
        // Basic: clear expiry
        updateData.package_expires_at = null;
        updateData.package_stripe_session_id = null;
      }

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
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

      if (!isValidUUID(userId)) {
        return res.status(400).json({ error: 'Invalid userId format' });
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

    // ============================================
    // ACTION: user-data - Get dashboard data for a specific user (impersonation)
    // ============================================
    if (action === 'user-data') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const userId = req.query.userId;
      if (!userId || !isValidUUID(userId)) {
        return res.status(400).json({ error: 'Missing or invalid userId' });
      }

      // Fetch bookings
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('*, courses(*), course_events(*)')
        .eq('user_id', userId)
        .eq('status', 'confirmed');

      // Fetch saved courses
      const { data: savedRaw } = await supabaseAdmin
        .from('saved_courses')
        .select('course_id')
        .eq('user_id', userId);

      let savedCourses = [];
      if (savedRaw && savedRaw.length > 0) {
        const courseIds = savedRaw.map(s => s.course_id);
        const { data: courses } = await supabaseAdmin
          .from('courses')
          .select('*')
          .in('id', courseIds);
        savedCourses = courses || [];
      }

      // Fetch teacher earnings (individual bookings, same format as fetchTeacherEarnings in App.jsx)
      const { data: userCourses } = await supabaseAdmin
        .from('courses')
        .select('id, title, price')
        .eq('user_id', userId);

      let earnings = [];
      if (userCourses && userCourses.length > 0) {
        const courseIds = userCourses.map(c => c.id);
        const { data: courseBookings } = await supabaseAdmin
          .from('bookings')
          .select('*, profiles!user_id(full_name, email)')
          .in('course_id', courseIds);

        // If the join fails, try without it
        let bookingsList = courseBookings;
        if (!bookingsList) {
          const { data: fallback } = await supabaseAdmin
            .from('bookings')
            .select('*')
            .in('course_id', courseIds);
          bookingsList = fallback || [];
        }

        earnings = (bookingsList || []).map(booking => {
          const course = userCourses.find(c => c.id === booking.course_id);
          return {
            id: booking.id,
            courseTitle: course?.title || 'Unknown',
            studentName: booking.profiles?.full_name || 'Guest Student',
            price: course?.price || 0,
            payout: (course?.price || 0) * 0.85,
            isPaidOut: booking.is_paid || false,
            date: new Date(booking.created_at).toLocaleDateString()
          };
        });
      }

      return res.status(200).json({
        bookings: (bookings || []).map(b => ({
          id: b.id,
          course_id: b.course_id,
          course: b.courses,
          event_id: b.event_id,
          event: b.course_events
        })).filter(b => b.course),
        savedCourses,
        earnings
      });
    }

    // Unknown action
    return res.status(400).json({ error: 'Unknown action. Use: profiles, set-tier, set-verify, or user-data' });

  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
