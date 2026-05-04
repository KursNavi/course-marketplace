import { createClient } from '@supabase/supabase-js';

/**
 * Unified Admin API
 * Handles admin profile operations via action parameter
 *
 * Actions:
 * - GET ?action=profiles           → Get all profiles
 * - GET ?action=user-data          → Get dashboard data for a user (impersonation)
 * - POST action=set-tier           → Set user package tier
 * - POST action=set-verify         → Set user verification status
 * - POST action=save-course        → Create/update a course (impersonation)
 * - POST action=delete-course      → Delete a course (impersonation)
 * - POST action=set-course-status  → Update course status (impersonation)
 * - POST action=save-profile       → Save provider profile (impersonation)
 * - POST action=upload-profile-image → Upload provider logo/cover (impersonation)
 * - POST action=set-course-prio    → Toggle course prio flag (impersonation)
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function getOwnedCourse(supabaseAdmin, courseId) {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('id, user_id, image_url')
    .eq('id', courseId)
    .single();

  if (error || !data) {
    return { course: null, error: error || new Error('Kurs nicht gefunden') };
  }

  return { course: data, error: null };
}

export default async function handler(req, res) {
  // Check environment
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

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
      const sortBy = (req.query.sortBy || 'created_at').trim();
      const sortAsc = req.query.sortDir === 'asc';

      // Helper: fetch auth users and return a map { userId -> last_sign_in_at }
      const getAuthMap = async () => {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const map = {};
        for (const u of (authData?.users || [])) {
          map[u.id] = u.last_sign_in_at || null;
        }
        return map;
      };

      let baseQuery = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' });

      if (role === 'teacher') {
        baseQuery = baseQuery.eq('role', 'teacher');
      } else if (role === 'student') {
        baseQuery = baseQuery.eq('role', 'student');
      }

      if (search) {
        baseQuery = baseQuery.or(
          `full_name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      // Sort by last_sign_in_at: fetch all matching rows, merge auth data, sort in memory
      if (sortBy === 'last_sign_in_at') {
        const { data: allData, error: allError, count } = await baseQuery;
        if (allError) return res.status(500).json({ error: allError.message });

        const authMap = await getAuthMap();
        const merged = (allData || []).map(p => ({ ...p, last_sign_in_at: authMap[p.id] || null }));

        merged.sort((a, b) => {
          const aT = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
          const bT = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
          return sortAsc ? aT - bT : bT - aT;
        });

        return res.status(200).json({
          data: merged.slice(offset, offset + limit),
          pagination: {
            total: count || 0,
            limit,
            offset,
            hasMore: (offset + limit) < (count || 0)
          }
        });
      }

      // Sort by profile column (created_at, full_name, email)
      const validSortFields = ['created_at', 'full_name', 'email'];
      const dbSortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      baseQuery = baseQuery.order(dbSortField, { ascending: sortAsc });
      baseQuery = baseQuery.range(offset, offset + limit - 1);

      const { data, error, count } = await baseQuery;
      if (error) return res.status(500).json({ error: error.message });

      // Enrich page with last_sign_in_at from auth
      const authMap = await getAuthMap();
      const enriched = (data || []).map(p => ({ ...p, last_sign_in_at: authMap[p.id] || null }));

      return res.status(200).json({
        data: enriched,
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
    // ACTION: save-course - Create/update a course incl. events/categories
    // ============================================
    if (action === 'save-course') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const {
        userId,
        courseId = null,
        course,
        validEvents = [],
        categories = []
      } = parseBody(req);

      if (!userId || !isValidUUID(userId)) {
        return res.status(400).json({ error: 'Missing or invalid userId' });
      }

      if (!course || typeof course !== 'object' || Array.isArray(course)) {
        return res.status(400).json({ error: 'Missing or invalid course payload' });
      }

      let activeCourseId = courseId;

      if (activeCourseId) {
        const { course: existingCourse, error: existingCourseError } = await getOwnedCourse(supabaseAdmin, activeCourseId);
        if (existingCourseError || !existingCourse) {
          return res.status(404).json({ error: 'Kurs nicht gefunden' });
        }
        if (existingCourse.user_id !== userId) {
          return res.status(403).json({ error: 'Kurs gehört nicht zum impersonierten Anbieter' });
        }
      }

      const coursePayload = {
        ...course,
        user_id: userId
      };

      if (activeCourseId) {
        const { error } = await supabaseAdmin
          .from('courses')
          .update(coursePayload)
          .eq('id', activeCourseId);

        if (error) return res.status(500).json({ error: error.message });
      } else {
        const { data, error } = await supabaseAdmin
          .from('courses')
          .insert([coursePayload])
          .select('id')
          .single();

        if (error) return res.status(500).json({ error: error.message });
        activeCourseId = data?.id;
      }

      if (!activeCourseId) {
        return res.status(500).json({ error: 'Kurs konnte nicht gespeichert werden' });
      }

      const sanitizedEvents = Array.isArray(validEvents) ? validEvents : [];
      const eventKeys = sanitizedEvents.map((ev) => (
        `${ev?.start_date || ''}|${ev?.location || ''}|${ev?.canton || ''}`
      ));
      const duplicateEventIndex = eventKeys.findIndex((key, index) => eventKeys.indexOf(key) !== index);
      if (duplicateEventIndex !== -1) {
        return res.status(400).json({
          error: 'Zwei Termine dürfen nicht dasselbe Startdatum, denselben Ort und Kanton haben'
        });
      }

      const existingEventIds = sanitizedEvents.map(ev => ev?.id).filter(Boolean);

      const { data: existingEvents, error: existingEventsError } = await supabaseAdmin
        .from('course_events')
        .select('id')
        .eq('course_id', activeCourseId);

      if (existingEventsError) {
        return res.status(500).json({ error: existingEventsError.message });
      }

      const eventIdsToDelete = (existingEvents || [])
        .map(ev => ev.id)
        .filter(id => !existingEventIds.includes(id));

      if (eventIdsToDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('course_events')
          .delete()
          .in('id', eventIdsToDelete);

        if (deleteError) return res.status(500).json({ error: deleteError.message });
      }

      for (const ev of sanitizedEvents) {
        const eventPayload = {
          course_id: activeCourseId,
          start_date: ev.start_date,
          location: ev.location,
          canton: ev.canton || null,
          schedule_description: ev.schedule_description,
          max_participants: parseInt(ev.max_participants, 10) || 0
        };

        if (ev.id) {
          const { error: updateEventError } = await supabaseAdmin
            .from('course_events')
            .update(eventPayload)
            .eq('id', ev.id)
            .eq('course_id', activeCourseId);

          if (updateEventError) return res.status(500).json({ error: updateEventError.message });
        } else {
          const { error: insertEventError } = await supabaseAdmin
            .from('course_events')
            .insert(eventPayload);

          if (insertEventError) return res.status(500).json({ error: insertEventError.message });
        }
      }

      const { error: deleteAssignmentsError } = await supabaseAdmin
        .from('course_category_assignments')
        .delete()
        .eq('course_id', activeCourseId);

      if (deleteAssignmentsError) {
        return res.status(500).json({ error: deleteAssignmentsError.message });
      }

      const sanitizedCategories = Array.isArray(categories)
        ? categories
            .filter(cat => cat && cat.level3_id != null)
            .map((cat, index) => ({
              course_id: activeCourseId,
              level3_id: cat.level3_id,
              level4_id: cat.level4_id || null,
              is_primary: typeof cat.is_primary === 'boolean' ? cat.is_primary : index === 0
            }))
        : [];

      if (sanitizedCategories.length > 0) {
        const { error: insertAssignmentsError } = await supabaseAdmin
          .from('course_category_assignments')
          .insert(sanitizedCategories);

        if (insertAssignmentsError) {
          return res.status(500).json({ error: insertAssignmentsError.message });
        }
      }

      return res.status(200).json({ ok: true, courseId: activeCourseId });
    }

    // ============================================
    // ACTION: delete-course - Delete a course as admin
    // ============================================
    if (action === 'delete-course') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { userId, courseId } = parseBody(req);

      if (!userId || !isValidUUID(userId) || !courseId) {
        return res.status(400).json({ error: 'Missing userId or courseId' });
      }

      const { course: existingCourse, error: existingCourseError } = await getOwnedCourse(supabaseAdmin, courseId);
      if (existingCourseError || !existingCourse) {
        return res.status(404).json({ error: 'Kurs nicht gefunden' });
      }
      if (existingCourse.user_id !== userId) {
        return res.status(403).json({ error: 'Kurs gehört nicht zum impersonierten Anbieter' });
      }

      const imageUrl = existingCourse.image_url;

      const { error } = await supabaseAdmin
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) return res.status(500).json({ error: error.message });

      // Clean up orphaned image from storage (best-effort)
      if (imageUrl && imageUrl.includes('course-images') && !imageUrl.includes('unsplash.com')) {
        try {
          const { data: otherCourses } = await supabaseAdmin
            .from('courses')
            .select('id')
            .eq('image_url', imageUrl)
            .limit(1);

          if (!otherCourses || otherCourses.length === 0) {
            const match = imageUrl.match(/course-images\/([^?]+)/);
            if (match) {
              await supabaseAdmin.storage.from('course-images').remove([match[1]]);
            }
          }
        } catch (imgErr) {
          console.warn('Image cleanup failed (non-critical):', imgErr.message);
        }
      }

      return res.status(200).json({ ok: true });
    }

    // ============================================
    // ACTION: set-course-status - Update course status as admin
    // ============================================
    if (action === 'set-course-status') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { userId, courseId, newStatus } = parseBody(req);

      if (!userId || !isValidUUID(userId) || !courseId || !newStatus) {
        return res.status(400).json({ error: 'Missing userId, courseId or newStatus' });
      }

      const validStatuses = ['draft', 'published'];
      if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ error: 'Invalid newStatus' });
      }

      const { course: existingCourse, error: existingCourseError } = await getOwnedCourse(supabaseAdmin, courseId);
      if (existingCourseError || !existingCourse) {
        return res.status(404).json({ error: 'Kurs nicht gefunden' });
      }
      if (existingCourse.user_id !== userId) {
        return res.status(403).json({ error: 'Kurs gehört nicht zum impersonierten Anbieter' });
      }

      const { error } = await supabaseAdmin
        .from('courses')
        .update({ status: newStatus })
        .eq('id', courseId);

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ ok: true });
    }

    // ============================================
    // ACTION: save-profile - Save provider profile fields (impersonation)
    // ============================================
    if (action === 'save-profile') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const body = parseBody(req);
      const { userId, profileUpdates, syncInstructorName } = body;

      if (!userId || !isValidUUID(userId)) {
        return res.status(400).json({ error: 'Missing or invalid userId' });
      }

      if (!profileUpdates || typeof profileUpdates !== 'object') {
        return res.status(400).json({ error: 'Missing profileUpdates' });
      }

      // Whitelist allowed fields
      const allowedFields = [
        'full_name', 'city', 'canton', 'bio_text', 'certificates',
        'preferred_language', 'website_url', 'additional_locations',
        'logo_url', 'cover_image_url', 'show_email_publicly', 'email', 'slug'
      ];

      const filtered = {};
      for (const key of allowedFields) {
        if (key in profileUpdates) filtered[key] = profileUpdates[key];
      }

      if (Object.keys(filtered).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(filtered)
        .eq('id', userId);

      if (error) return res.status(500).json({ error: error.message });

      // Sync instructor_name on all courses if requested
      if (syncInstructorName && filtered.full_name) {
        await supabaseAdmin
          .from('courses')
          .update({ instructor_name: filtered.full_name })
          .eq('user_id', userId);
      }

      return res.status(200).json({ ok: true });
    }

    // ============================================
    // ACTION: upload-profile-image - Upload provider logo or cover image (impersonation)
    // ============================================
    if (action === 'upload-profile-image') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const body = parseBody(req);
      const { userId, imageBase64, fileName, type } = body;

      if (!userId || !isValidUUID(userId)) {
        return res.status(400).json({ error: 'Missing or invalid userId' });
      }

      if (!imageBase64 || !fileName) {
        return res.status(400).json({ error: 'Missing imageBase64 or fileName' });
      }

      if (!['logo', 'cover'].includes(type)) {
        return res.status(400).json({ error: 'type must be logo or cover' });
      }

      const buffer = Buffer.from(imageBase64, 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Bild darf maximal 2MB gross sein' });
      }

      const ext = fileName.split('.').pop() || 'jpg';
      const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      const contentType = mimeMap[ext.toLowerCase()] || 'image/jpeg';
      const storagePath = `providers/${userId}/${type}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('course-images')
        .upload(storagePath, buffer, { upsert: true, contentType });

      if (uploadError) {
        console.error('upload-profile-image storage error:', uploadError);
        return res.status(500).json({ error: 'Upload fehlgeschlagen' });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('course-images')
        .getPublicUrl(storagePath);

      const fieldName = type === 'logo' ? 'logo_url' : 'cover_image_url';
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .update({ [fieldName]: publicUrl })
        .eq('id', userId);

      if (dbError) {
        console.error('upload-profile-image db error:', dbError);
        return res.status(500).json({ error: 'Profil-Update fehlgeschlagen' });
      }

      return res.status(200).json({ ok: true, publicUrl });
    }

    // ============================================
    // ACTION: set-course-prio - Toggle course prio flag (impersonation)
    // ============================================
    if (action === 'set-course-prio') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const body = parseBody(req);
      const { userId, courseId, isPrio } = body;

      if (!userId || !isValidUUID(userId) || !courseId) {
        return res.status(400).json({ error: 'Missing userId or courseId' });
      }

      const { course, error: courseError } = await getOwnedCourse(supabaseAdmin, courseId);
      if (courseError || !course) {
        return res.status(404).json({ error: 'Kurs nicht gefunden' });
      }
      if (course.user_id !== userId) {
        return res.status(403).json({ error: 'Kurs gehört nicht zum impersonierten Anbieter' });
      }

      const { error } = await supabaseAdmin
        .from('courses')
        .update({ is_prio: !!isPrio })
        .eq('id', courseId);

      if (error) return res.status(500).json({ error: error.message });

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

    // ============================================
    // ACTION: set-expiry - Set user package expiry date
    // ============================================
    if (action === 'set-expiry') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { userId, package_expires_at } = parseBody(req);

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      if (!isValidUUID(userId)) {
        return res.status(400).json({ error: 'Invalid userId format' });
      }

      // Validate and normalise date if provided
      let expiresAt = null;
      if (package_expires_at) {
        const parsed = new Date(package_expires_at);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'Ungültiges Datumsformat für package_expires_at' });
        }
        expiresAt = parsed.toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ package_expires_at: expiresAt })
        .eq('id', userId)
        .select('package_expires_at')
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ data });
    }

    // Unknown action
    return res.status(400).json({ error: 'Unknown action. Use: profiles, set-tier, set-verify, set-expiry, save-course, delete-course, set-course-status, or user-data' });

  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
