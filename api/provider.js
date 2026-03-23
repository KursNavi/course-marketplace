import { createClient } from '@supabase/supabase-js';

const LEGACY_CATEGORY_TYPE_MAP = {
  beruflich: 'professionell',
  privat_hobby: 'privat',
  kinder_jugend: 'kinder'
};

function normalizeCategoryType(value) {
  if (!value) return value ?? null;
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_CATEGORY_TYPE_MAP[normalized] || normalized;
}

function buildSyntheticCategories(course) {
  if (!course || Array.isArray(course.all_categories) && course.all_categories.length > 0) {
    return Array.isArray(course?.all_categories) ? course.all_categories : [];
  }

  if (!course.category_type && !course.category_area && !course.category_specialty && !course.category_focus) {
    return [];
  }

  return [{
    category_type: normalizeCategoryType(course.category_type) || null,
    category_type_label: course.category_type_label || null,
    category_area: course.category_area || course.primary_category || null,
    category_area_label: course.category_area_label || null,
    category_specialty: course.category_specialty || null,
    category_specialty_label: course.category_specialty_label || course.category_specialty || null,
    category_focus: course.category_focus || null,
    category_focus_label: course.category_focus_label || course.category_focus || null,
    is_primary: true
  }];
}

function mapCourseCategories(categoriesData = []) {
  return (categoriesData || []).map((cat) => ({
    course_id: cat.course_id,
    category_type: cat.level1_slug,
    category_type_label: cat.level1_label_de,
    category_area: cat.level2_slug,
    category_area_label: cat.level2_label_de,
    category_specialty: cat.level3_slug,
    category_specialty_label: cat.level3_label_de,
    category_focus: cat.level4_slug || null,
    category_focus_label: cat.level4_label_de || null,
    type_id: cat.level1_id,
    area_id: cat.level2_id,
    specialty_id: cat.level3_id,
    focus_id: cat.level4_id,
    is_primary: cat.is_primary
  }));
}

/**
 * Unified Provider API
 * Handles all provider-related endpoints via action parameter
 *
 * Actions:
 * - GET ?action=profile&slug=xxx  → Get provider profile
 * - GET ?action=directory         → Get provider directory listing
 * - POST action=validate-slug     → Validate a proposed slug
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const baseUrl = (process.env.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');

  // Determine action
  const action = req.query.action || req.body?.action;

  try {
    // ============================================
    // ACTION: profile - Get provider by slug
    // ============================================
    if (action === 'profile') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { slug } = req.query;

      if (!slug) {
        return res.status(400).json({ error: 'Missing slug parameter' });
      }

      // Check for alias (old slug)
      const { data: aliasData } = await supabase
        .from('provider_slug_aliases')
        .select('new_slug, provider_id')
        .eq('old_slug', slug)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (aliasData) {
        return res.status(200).json({
          redirect: true,
          newSlug: aliasData.new_slug,
          canonicalUrl: `${baseUrl}/anbieter/${aliasData.new_slug}`
        });
      }

      // Fetch provider by slug
      // Try with show_email_publicly first, fallback without it if column doesn't exist yet
      let provider;
      let providerError;

      // Try extended query with new fields, fallback gracefully
      const fullQuery = await supabase
        .from('profiles')
        .select(`
          id, full_name, slug, logo_url, cover_image_url,
          show_email_publicly, profile_published_at, website_url, city, canton,
          additional_locations, verification_status, package_tier, bio_text, certificates,
          phone, social_linkedin, social_instagram, social_facebook, social_youtube
        `)
        .eq('slug', slug)
        .single();

      if (fullQuery.error) {
        // Fallback query without new columns (pre-migration)
        const fallbackQuery = await supabase
          .from('profiles')
          .select(`
            id, full_name, slug, logo_url, cover_image_url,
            show_email_publicly, profile_published_at, website_url, city, canton,
            additional_locations, verification_status, package_tier, bio_text, certificates
          `)
          .eq('slug', slug)
          .single();

        if (fallbackQuery.error) {
          // Last resort: without show_email_publicly
          const minimalQuery = await supabase
            .from('profiles')
            .select(`
              id, full_name, slug, logo_url, cover_image_url,
              profile_published_at, website_url, city, canton,
              additional_locations, verification_status, package_tier, bio_text, certificates
            `)
            .eq('slug', slug)
            .single();

          provider = minimalQuery.data ? { ...minimalQuery.data, show_email_publicly: false } : null;
          providerError = minimalQuery.error;
        } else {
          provider = fallbackQuery.data ? { ...fallbackQuery.data } : null;
          providerError = fallbackQuery.error;
        }
      } else {
        provider = fullQuery.data;
        providerError = null;
      }

      if (providerError || !provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      // Check eligibility
      const tier = (provider.package_tier || 'basic').toLowerCase();
      const isEligible = ['pro', 'premium', 'enterprise'].includes(tier);

      if (!isEligible || !provider.profile_published_at) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      // Entitlements
      const entitlements = {
        tier,
        hasPublicProfile: true,
        isDirectoryListed: true,
        hasReviews: tier === 'enterprise',
        isFeatured: tier === 'enterprise',
        hasCoverImage: tier === 'enterprise',
        homepageLinkRel: tier === 'enterprise' ? 'sponsored noopener' : 'nofollow noopener'
      };

      // Fetch all courses for this provider
      const providerId = provider.id;

      const { data: allCoursesRaw } = await supabase
        .from('courses')
        .select('id, title, status, user_id')
        .eq('user_id', providerId);

      // Now fetch full course details for display
      let courses = [];
      if (allCoursesRaw && allCoursesRaw.length > 0) {
        const courseIdList = allCoursesRaw.map(c => c.id);
        const { data: fullCourses, error: fullError } = await supabase
          .from('courses')
          .select(`id, title, description, price, category_type, category_area,
            category_specialty, category_focus, canton, booking_type, image_url, created_at, status, delivery_types, delivery_type`)
          .in('id', courseIdList)
          .order('created_at', { ascending: false });

        if (fullError) {
          console.error('Error loading full courses:', fullError.message);
        }
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('v_course_full_categories')
          .select('*')
          .in('course_id', courseIdList);

        if (categoriesError) {
          console.error('Error loading provider course categories:', categoriesError.message);
        }

        const categoriesByCourseId = (categoriesData || []).reduce((acc, cat) => {
          if (!acc[cat.course_id]) acc[cat.course_id] = [];
          acc[cat.course_id].push(cat);
          return acc;
        }, {});

        courses = (fullCourses || []).map((course) => ({
          ...course,
          category_type: normalizeCategoryType(course.category_type),
          all_categories: (categoriesByCourseId[course.id] || []).length > 0
            ? mapCourseCategories(categoriesByCourseId[course.id] || [])
            : buildSyntheticCategories({ ...course, category_type: normalizeCategoryType(course.category_type) })
        }));
      }

      // Filter for published courses (status = 'published' OR status is null/undefined for legacy)
      const publishedCourses = (courses || []).filter(c => {
        const isPublished = c.status === 'published' || c.status === null || c.status === undefined;
        return isPublished;
      });

      // Get user's account email for public display (if enabled)
      let contactEmail = null;
      if (provider.show_email_publicly) {
        // Fetch email from auth.users using service role
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(provider.id);
        if (!userError && userData?.user?.email) {
          contactEmail = userData.user.email;
        }
      }

      // Default cover image for non-Enterprise or if not set
      const defaultCoverImage = "https://nplxmpfasgpumpiddjfl.supabase.co/storage/v1/object/public/course-images/ca3c9cbb76c1d0b4b0bf300cdbd3bf39.jpg";

      // Parse additional_locations (stored as JSON string in DB)
      let additionalLocations = [];
      if (provider.additional_locations) {
        try {
          const parsed = JSON.parse(provider.additional_locations);
          if (Array.isArray(parsed)) {
            additionalLocations = parsed;
          }
        } catch {
          // If not valid JSON, try comma-separated format
          const items = provider.additional_locations.split(',').map(s => s.trim()).filter(Boolean);
          additionalLocations = items.map(city => ({ city, canton: '' }));
        }
      }

      // Build response
      const publicProfile = {
        id: provider.id,
        name: provider.full_name,
        slug: provider.slug,
        description: provider.bio_text,
        logoUrl: provider.logo_url,
        coverImageUrl: entitlements.hasCoverImage ? (provider.cover_image_url || defaultCoverImage) : defaultCoverImage,
        websiteUrl: provider.website_url,
        showEmailPublicly: provider.show_email_publicly || false,
        contactEmail: contactEmail,
        phone: provider.phone || null,
        location: { city: provider.city, canton: provider.canton },
        additionalLocations: additionalLocations,
        isVerified: provider.verification_status === 'verified',
        certificates: provider.certificates || [],
        publishedAt: provider.profile_published_at,
        courseCount: publishedCourses?.length || 0,
        socialLinkedin: provider.social_linkedin || null,
        socialInstagram: provider.social_instagram || null,
        socialFacebook: provider.social_facebook || null,
        socialYoutube: provider.social_youtube || null
      };

      const seoMeta = {
        title: `${provider.full_name} - Kursanbieter | KursNavi`,
        description: (provider.bio_text || '').substring(0, 155) + '...',
        canonicalUrl: `${baseUrl}/anbieter/${provider.slug}`,
        ogImage: provider.logo_url || `${baseUrl}/og-default.jpg`
      };

      const schemaOrg = {
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: provider.full_name,
        url: `${baseUrl}/anbieter/${provider.slug}`,
        logo: provider.logo_url,
        description: provider.bio_text,
        address: {
          '@type': 'PostalAddress',
          addressLocality: provider.city,
          addressRegion: provider.canton,
          addressCountry: 'CH'
        },
        ...(() => {
          const links = [provider.website_url, provider.social_linkedin, provider.social_instagram, provider.social_facebook, provider.social_youtube].filter(Boolean);
          return links.length > 0 ? { sameAs: links } : {};
        })()
      };

      return res.status(200).json({
        provider: publicProfile,
        entitlements,
        courses: publishedCourses || [],
        seo: seoMeta,
        schema: schemaOrg,
        _debug: {
          totalCoursesFound: courses?.length || 0,
          publishedCoursesCount: publishedCourses?.length || 0,
          providerId: provider.id
        }
      });
    }

    // ============================================
    // ACTION: directory - List providers
    // ============================================
    if (action === 'directory') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const {
        canton, city, verified,
        level1_id, level2_id, level3_id, level4_id,
        q: searchQuery,
        limit: limitParam, offset: offsetParam
      } = req.query;
      const limit = Math.min(parseInt(limitParam) || 50, 100);
      const offset = parseInt(offsetParam) || 0;

      // Step 1: If category or search filter is active, find matching provider IDs
      let filteredProviderIds = null;

      if (level1_id || level2_id || level3_id || level4_id || searchQuery) {
        let matchingCourseIds = null;

        // --- Category filtering via course_category_assignments (new taxonomy schema) ---
        // Resolves the taxonomy hierarchy (level1→level2→level3) and then filters
        // assignments by the resolved level3 IDs. Uses is_active filters and a
        // post-query verification step to prevent cross-type leakage.
        if (level1_id || level2_id || level3_id || level4_id) {
          let targetLevel3Ids = null;

          if (level3_id) {
            targetLevel3Ids = [level3_id];
          } else if (level2_id) {
            const { data: lvl3s } = await supabase
              .from('taxonomy_level3')
              .select('id')
              .eq('level2_id', level2_id)
              .eq('is_active', true);
            targetLevel3Ids = (lvl3s || []).map(s => s.id);
          } else if (level1_id) {
            const { data: lvl2s } = await supabase
              .from('taxonomy_level2')
              .select('id')
              .eq('level1_id', level1_id)
              .eq('is_active', true);
            const lvl2Ids = (lvl2s || []).map(a => a.id);
            if (lvl2Ids.length > 0) {
              const { data: lvl3s } = await supabase
                .from('taxonomy_level3')
                .select('id')
                .in('level2_id', lvl2Ids)
                .eq('is_active', true);
              targetLevel3Ids = (lvl3s || []).map(s => s.id);
            } else {
              targetLevel3Ids = [];
            }
          }

          if (targetLevel3Ids !== null && targetLevel3Ids.length === 0) {
            return res.status(200).json({
              providers: [],
              pagination: { total: 0, limit, offset, hasMore: false },
              filters: { canton: canton || null, verified: verified === 'true', q: searchQuery || null }
            });
          }

          let assignmentQuery = supabase
            .from('course_category_assignments')
            .select('course_id');
          if (targetLevel3Ids !== null) {
            assignmentQuery = assignmentQuery.in('level3_id', targetLevel3Ids);
          }
          if (level4_id) {
            assignmentQuery = assignmentQuery.eq('level4_id', level4_id);
          }

          const { data: assignments, error: assignErr } = await assignmentQuery;
          if (assignErr) throw assignErr;

          matchingCourseIds = [...new Set((assignments || []).map(a => a.course_id))];

          if (matchingCourseIds.length === 0) {
            return res.status(200).json({
              providers: [],
              pagination: { total: 0, limit, offset, hasMore: false },
              filters: { canton: canton || null, verified: verified === 'true', q: searchQuery || null }
            });
          }
        }

        // Build course query (optionally restricted to matched course IDs)
        let courseQuery = supabase
          .from('courses')
          .select('user_id')
          .or('status.eq.published,status.is.null');

        if (matchingCourseIds !== null) {
          courseQuery = courseQuery.in('id', matchingCourseIds);
        }

        if (searchQuery) {
          const searchTerm = `%${searchQuery}%`;
          courseQuery = courseQuery.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
        }

        const { data: matchingCourses, error: courseError } = await courseQuery;
        if (courseError) throw courseError;

        filteredProviderIds = [...new Set((matchingCourses || []).map(c => c.user_id))];

        if (filteredProviderIds.length === 0) {
          return res.status(200).json({
            providers: [],
            pagination: { total: 0, limit, offset, hasMore: false },
            filters: { canton: canton || null, verified: verified === 'true', q: searchQuery || null }
          });
        }
      }

      // Step 2: Query providers
      let query = supabase
        .from('profiles')
        .select(`id, full_name, slug, provider_description, logo_url, city, canton,
          verification_status, package_tier, profile_published_at, bio_text`, { count: 'exact' })
        .not('profile_published_at', 'is', null)
        .in('package_tier', ['pro', 'premium', 'enterprise'])
        .not('slug', 'is', null);

      // If we have filtered provider IDs from course search, apply them
      if (filteredProviderIds !== null) {
        query = query.in('id', filteredProviderIds);
      }

      // Location filters
      if (canton) query = query.eq('canton', canton);
      if (city) query = query.ilike('city', `%${city}%`);
      if (verified === 'true') query = query.eq('verification_status', 'verified');

      query = query.order('profile_published_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data: providers, error, count } = await query;
      if (error) throw error;

      // Step 3: Get course counts and categories for each provider
      const providerIds = (providers || []).map(p => p.id);
      let courseCounts = {};
      let providerCategories = {};
      let hasBookable = {};

      if (providerIds.length > 0) {
        const { data: courseData } = await supabase
          .from('courses')
          .select('user_id, category_type, category_area, booking_type')
          .in('user_id', providerIds)
          .or('status.eq.published,status.is.null');

        (courseData || []).forEach(c => {
          courseCounts[c.user_id] = (courseCounts[c.user_id] || 0) + 1;

          // Collect unique categories per provider
          if (!providerCategories[c.user_id]) {
            providerCategories[c.user_id] = { types: new Set(), areas: new Set() };
          }
          if (c.category_type) providerCategories[c.user_id].types.add(c.category_type);
          if (c.category_area) providerCategories[c.user_id].areas.add(c.category_area);

          // Track if provider has at least one course bookable through the platform
          if (c.booking_type === 'platform' || c.booking_type === 'platform_flex') {
            hasBookable[c.user_id] = true;
          }
        });
      }

      const results = (providers || [])
        .map(p => ({
          id: p.id,
          name: p.full_name,
          slug: p.slug,
          description: (p.provider_description || p.bio_text || '').substring(0, 150),
          logoUrl: p.logo_url,
          location: { city: p.city, canton: p.canton },
          isVerified: p.verification_status === 'verified',
          tier: p.package_tier,
          isFeatured: p.package_tier === 'enterprise',
          tierScore: p.package_tier === 'enterprise' ? 2 : 1,
          hasBookableCourse: !!hasBookable[p.id],
          courseCount: courseCounts[p.id] || 0,
          categories: {
            types: providerCategories[p.id] ? Array.from(providerCategories[p.id].types) : [],
            areas: providerCategories[p.id] ? Array.from(providerCategories[p.id].areas) : []
          },
          publishedAt: p.profile_published_at
        }))
        .sort((a, b) => {
          // Ranking-Score: enterprise=+2, pro/premium=+1, buchbar über Plattform=+1
          const scoreA = a.tierScore + (a.hasBookableCourse ? 1 : 0);
          const scoreB = b.tierScore + (b.hasBookableCourse ? 1 : 0);
          if (scoreB !== scoreA) return scoreB - scoreA;
          // Deterministic tiebreaker for stable SEO/indexing
          const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return String(a.id).localeCompare(String(b.id));
        })
        .filter(p => p.courseCount > 0);

      return res.status(200).json({
        providers: results,
        pagination: { total: count || 0, limit, offset, hasMore: offset + limit < (count || 0) },
        filters: {
          canton: canton || null,
          city: city || null,
          verified: verified === 'true',
          level1_id: level1_id || null,
          level2_id: level2_id || null,
          level3_id: level3_id || null,
          level4_id: level4_id || null,
          q: searchQuery || null
        }
      });
    }

    // ============================================
    // ACTION: debug-provider - Show a provider's course assignments & taxonomy mapping
    // Usage: GET ?action=debug-provider&slug=xxx
    // ============================================
    if (action === 'debug-provider') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      const adminSecret = process.env.ADMIN_CONSOLE_SECRET;
      if (!adminSecret) {
        return res.status(500).json({ error: 'Debug endpoint not configured' });
      }
      const incoming = req.headers['x-admin-secret'];
      if (!incoming || incoming !== adminSecret) {
        return res.status(401).json({ error: 'Unauthorized - admin access required' });
      }
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: 'slug required' });

      // Find provider
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, slug')
        .eq('slug', slug)
        .single();
      if (!profile) return res.status(404).json({ error: 'Provider not found' });

      // Get all courses
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, status, category_type, category_area, category_level3_id, category_level4_id')
        .eq('user_id', profile.id)
        .or('status.eq.published,status.is.null');

      // Get all assignments for those courses
      const courseIds = (courses || []).map(c => c.id);
      let assignments = [];
      if (courseIds.length > 0) {
        const { data: a } = await supabase
          .from('course_category_assignments')
          .select('course_id, level3_id, level4_id, is_primary')
          .in('course_id', courseIds);
        assignments = a || [];
      }

      // Resolve each level3_id → level2 → level1 path
      const level3Ids = [...new Set(assignments.map(a => a.level3_id).filter(Boolean))];
      let pathMap = {};
      if (level3Ids.length > 0) {
        const { data: l3data } = await supabase
          .from('taxonomy_level3')
          .select('id, slug, label_de, level2_id, is_active')
          .in('id', level3Ids);

        const l2ids = [...new Set((l3data || []).map(l => l.level2_id))];
        const { data: l2data } = await supabase
          .from('taxonomy_level2')
          .select('id, slug, label_de, level1_id, is_active')
          .in('id', l2ids);

        const l1ids = [...new Set((l2data || []).map(l => l.level1_id))];
        const { data: l1data } = await supabase
          .from('taxonomy_level1')
          .select('id, slug, label_de')
          .in('id', l1ids);

        const l2map = Object.fromEntries((l2data || []).map(l => [l.id, l]));
        const l1map = Object.fromEntries((l1data || []).map(l => [l.id, l]));

        (l3data || []).forEach(l3 => {
          const l2 = l2map[l3.level2_id];
          const l1 = l2 ? l1map[l2.level1_id] : null;
          pathMap[l3.id] = {
            level3: { id: l3.id, slug: l3.slug, label: l3.label_de, is_active: l3.is_active },
            level2: l2 ? { id: l2.id, slug: l2.slug, label: l2.label_de, is_active: l2.is_active } : null,
            level1: l1 ? { id: l1.id, slug: l1.slug, label: l1.label_de } : null
          };
        });
      }

      // Enrich assignments with resolved paths
      const enrichedAssignments = assignments.map(a => ({
        ...a,
        path: pathMap[a.level3_id] || null
      }));

      return res.status(200).json({
        provider: { id: profile.id, name: profile.full_name, slug: profile.slug },
        courses: courses || [],
        assignments: enrichedAssignments,
        summary: {
          totalCourses: (courses || []).length,
          totalAssignments: assignments.length,
          primaryAssignments: assignments.filter(a => a.is_primary).length,
          typesViaAssignments: [...new Set(enrichedAssignments
            .filter(a => a.is_primary && a.path?.level1)
            .map(a => a.path.level1.slug))]
        }
      });
    }

    // ============================================
    // ACTION: validate-slug - Validate proposed slug
    // ============================================
    if (action === 'validate-slug') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { slug, providerId, authToken } = req.body;

      // Verify user is authenticated and owns this provider ID
      if (!providerId || !authToken) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify the auth token matches the provider
      const { data: authUser, error: authError } = await supabase.auth.getUser(authToken);
      if (authError || !authUser?.user || authUser.user.id !== providerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!slug) {
        return res.status(400).json({ valid: false, error: 'Slug is required' });
      }

      // Validate format
      const formatRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!formatRegex.test(slug)) {
        return res.status(200).json({
          valid: false, available: false, canChange: true,
          error: 'Slug muss Kleinbuchstaben, Zahlen und Bindestriche enthalten'
        });
      }

      if (slug.length < 3) {
        return res.status(200).json({
          valid: false, available: false, canChange: true,
          error: 'Slug muss mindestens 3 Zeichen lang sein'
        });
      }

      if (slug.length > 50) {
        return res.status(200).json({
          valid: false, available: false, canChange: true,
          error: 'Slug darf maximal 50 Zeichen lang sein'
        });
      }

      const reservedSlugs = ['admin', 'api', 'login', 'dashboard', 'search', 'new', 'edit', 'delete', 'kursnavi', 'support', 'help'];
      if (reservedSlugs.includes(slug)) {
        return res.status(200).json({
          valid: false, available: false, canChange: true,
          error: 'Dieser Slug ist reserviert'
        });
      }

      // Check availability
      const { data: existingProvider } = await supabase
        .from('profiles')
        .select('id, slug')
        .eq('slug', slug)
        .single();

      const isTakenByOther = existingProvider && existingProvider.id !== providerId;

      // Generate suggestions
      let suggestions = [];
      if (isTakenByOther) {
        for (let i = 2; i <= 5; i++) {
          const suggestion = `${slug}-${i}`;
          const { data: check } = await supabase.from('profiles').select('id').eq('slug', suggestion).single();
          if (!check) {
            suggestions.push(suggestion);
            if (suggestions.length >= 3) break;
          }
        }
      }

      // Check cooldown
      let canChange = true;
      let cooldownEnds = null;

      if (providerId && existingProvider?.id !== providerId) {
        const { data: provider } = await supabase
          .from('profiles')
          .select('last_slug_change_at')
          .eq('id', providerId)
          .single();

        if (provider?.last_slug_change_at) {
          const lastChange = new Date(provider.last_slug_change_at);
          const daysSinceChange = (new Date() - lastChange) / (1000 * 60 * 60 * 24);
          if (daysSinceChange < 30) {
            canChange = false;
            cooldownEnds = new Date(lastChange.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }
        }
      }

      return res.status(200).json({
        valid: formatRegex.test(slug) && slug.length >= 3 && !reservedSlugs.includes(slug),
        available: !isTakenByOther,
        canChange,
        cooldownEnds,
        suggestions: isTakenByOther ? suggestions : []
      });
    }

    // ============================================
    // ACTION: toggle-publish - Publish or unpublish provider profile
    // ============================================
    if (action === 'toggle-publish') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { providerId, authToken, publish } = req.body;

      if (!providerId || !authToken) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify the auth token matches the provider
      const { data: authUser, error: authError } = await supabase.auth.getUser(authToken);
      if (authError || !authUser?.user || authUser.user.id !== providerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check tier eligibility
      const { data: profile } = await supabase
        .from('profiles')
        .select('package_tier, slug, full_name')
        .eq('id', providerId)
        .single();

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const tier = (profile.package_tier || 'basic').toLowerCase();
      if (!['pro', 'premium', 'enterprise'].includes(tier)) {
        return res.status(403).json({ error: 'Pro-Paket oder höher erforderlich' });
      }

      const updateData = {
        profile_published_at: publish ? new Date().toISOString() : null
      };

      // Auto-generate slug on first publish if not set
      if (publish && !profile.slug && profile.full_name) {
        const slugBase = profile.full_name.toLowerCase()
          .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        updateData.slug = slugBase || `anbieter-${providerId.slice(0, 8)}`;
      }

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', providerId)
        .select('profile_published_at, slug')
        .single();

      if (updateError) {
        console.error('toggle-publish update error:', updateError);
        return res.status(500).json({ error: 'Update fehlgeschlagen' });
      }

      return res.status(200).json({
        profile_published_at: updated.profile_published_at,
        slug: updated.slug
      });
    }

    // ============================================
    // ACTION: debug - Debug course matching (admin only)
    // ============================================
    if (action === 'debug') {
      // Require admin secret for debug endpoint
      const adminSecret = process.env.ADMIN_CONSOLE_SECRET;
      if (!adminSecret) {
        return res.status(500).json({ error: 'Debug endpoint not configured' });
      }
      const incoming = req.headers['x-admin-secret'];
      if (!incoming || incoming !== adminSecret) {
        return res.status(401).json({ error: 'Unauthorized - admin access required' });
      }

      const { slug: debugSlug } = req.query;

      if (!debugSlug) {
        return res.status(400).json({ error: 'Missing slug parameter' });
      }

      // Get provider
      const { data: debugProvider } = await supabase
        .from('profiles')
        .select('id, full_name, slug, package_tier')
        .eq('slug', debugSlug)
        .single();

      if (!debugProvider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      // Get ALL courses with user_id match (no limit)
      const { data: allCourses, error: courseError } = await supabase
        .from('courses')
        .select('id, title, status, user_id')
        .eq('user_id', debugProvider.id);

      // Filter published courses
      const publishedCourses = (allCourses || []).filter(c =>
        c.status === 'published' || c.status === null || c.status === undefined
      );

      // Status distribution
      const statusDist = (allCourses || []).reduce((acc, c) => {
        const key = c.status || 'null';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return res.status(200).json({
        provider: {
          id: debugProvider.id,
          full_name: debugProvider.full_name,
          slug: debugProvider.slug,
          package_tier: debugProvider.package_tier
        },
        courseError: courseError?.message || null,
        totalCourses: allCourses?.length || 0,
        publishedCourses: publishedCourses.length,
        statusDistribution: statusDist,
        allCourses: (allCourses || []).map(c => ({
          id: c.id,
          title: c.title.substring(0, 50),
          status: c.status,
          isPublished: c.status === 'published' || c.status === null || c.status === undefined
        }))
      });
    }

    // Unknown action
    return res.status(400).json({ error: 'Unknown action. Use: profile, directory, validate-slug, or debug' });

  } catch (error) {
    console.error('Provider API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
