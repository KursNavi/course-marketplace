import { createClient } from '@supabase/supabase-js';

/**
 * Provider Directory API
 * GET /api/providers/directory
 *
 * Returns list of eligible providers for the public directory.
 * Only includes Pro+ providers with published profiles.
 *
 * Query Parameters:
 * - canton: Filter by canton (e.g., "Zürich")
 * - city: Filter by city
 * - verified: Filter by verification status ("true" or "false")
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse query parameters
  const {
    canton,
    city,
    verified,
    limit: limitParam,
    offset: offsetParam
  } = req.query;

  const limit = Math.min(parseInt(limitParam) || 50, 100);
  const offset = parseInt(offsetParam) || 0;

  try {
    // Build query for eligible providers
    let query = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        slug,
        provider_description,
        logo_url,
        city,
        canton,
        verification_status,
        package_tier,
        profile_published_at,
        bio_text
      `, { count: 'exact' })
      // Must have published profile
      .not('profile_published_at', 'is', null)
      // Must be Pro+ tier
      .in('package_tier', ['pro', 'premium', 'enterprise'])
      // Must have a slug
      .not('slug', 'is', null);

    // Apply filters
    if (canton) {
      query = query.eq('canton', canton);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (verified === 'true') {
      query = query.eq('verification_status', 'verified');
    }

    // Order: Enterprise first (featured), then by name
    // We do this in post-processing since Supabase doesn't support complex ordering
    query = query
      .order('profile_published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: providers, error, count } = await query;

    if (error) {
      throw error;
    }

    // Get course counts for each provider
    const providerIds = (providers || []).map(p => p.id);

    let courseCounts = {};
    if (providerIds.length > 0) {
      const { data: courseData } = await supabase
        .from('courses')
        .select('user_id')
        .in('user_id', providerIds)
        .or('status.eq.published,status.is.null');

      // Count courses per provider
      (courseData || []).forEach(course => {
        courseCounts[course.user_id] = (courseCounts[course.user_id] || 0) + 1;
      });
    }

    // Transform and sort results
    const results = (providers || [])
      .map(provider => ({
        id: provider.id,
        name: provider.full_name,
        slug: provider.slug,
        description: (provider.provider_description || provider.bio_text || '').substring(0, 150),
        logoUrl: provider.logo_url,
        location: {
          city: provider.city,
          canton: provider.canton
        },
        isVerified: provider.verification_status === 'verified',
        tier: provider.package_tier,
        isFeatured: provider.package_tier === 'enterprise',
        courseCount: courseCounts[provider.id] || 0,
        publishedAt: provider.profile_published_at
      }))
      // Sort: Enterprise first, then by course count, then by name
      .sort((a, b) => {
        // Featured (Enterprise) first
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;

        // Then by course count
        if (b.courseCount !== a.courseCount) {
          return b.courseCount - a.courseCount;
        }

        // Then by name
        return a.name.localeCompare(b.name, 'de');
      });

    // Filter out providers with 0 courses (quality gate)
    const filteredResults = results.filter(p => p.courseCount > 0);

    return res.status(200).json({
      providers: filteredResults,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0)
      },
      filters: {
        canton: canton || null,
        city: city || null,
        verified: verified === 'true'
      }
    });

  } catch (error) {
    console.error('Directory API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
