import { createClient } from '@supabase/supabase-js';

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

      const fullQuery = await supabase
        .from('profiles')
        .select(`
          id, full_name, slug, logo_url, cover_image_url,
          show_email_publicly, profile_published_at, website_url, city, canton,
          additional_locations, verification_status, package_tier, bio_text, certificates
        `)
        .eq('slug', slug)
        .single();

      if (fullQuery.error) {
        // Fallback query without show_email_publicly
        const fallbackQuery = await supabase
          .from('profiles')
          .select(`
            id, full_name, slug, logo_url, cover_image_url,
            profile_published_at, website_url, city, canton,
            additional_locations, verification_status, package_tier, bio_text, certificates
          `)
          .eq('slug', slug)
          .single();

        provider = fallbackQuery.data ? { ...fallbackQuery.data, show_email_publicly: false } : null;
        providerError = fallbackQuery.error;
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

      // Fetch courses
      const { data: courses } = await supabase
        .from('courses')
        .select(`id, title, description, price, category_type, category_area,
          category_specialty, canton, city, booking_type, image_url, created_at`)
        .eq('user_id', provider.id)
        .or('status.eq.published,status.is.null')
        .order('created_at', { ascending: false });

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
      const defaultCoverImage = "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=1200&h=400";

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
        location: { city: provider.city, canton: provider.canton },
        additionalLocations: additionalLocations,
        isVerified: provider.verification_status === 'verified',
        certificates: provider.certificates || [],
        publishedAt: provider.profile_published_at,
        courseCount: courses?.length || 0
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
        ...(provider.website_url && { sameAs: [provider.website_url] })
      };

      return res.status(200).json({
        provider: publicProfile,
        entitlements,
        courses: courses || [],
        seo: seoMeta,
        schema: schemaOrg
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
        category_type, category_area,
        q: searchQuery,
        limit: limitParam, offset: offsetParam
      } = req.query;
      const limit = Math.min(parseInt(limitParam) || 50, 100);
      const offset = parseInt(offsetParam) || 0;

      // Step 1: If category or search filter is active, find matching provider IDs via courses first
      let filteredProviderIds = null;

      if (category_type || category_area || searchQuery) {
        let courseQuery = supabase
          .from('courses')
          .select('user_id')
          .or('status.eq.published,status.is.null');

        // Category filters
        if (category_type) {
          courseQuery = courseQuery.eq('category_type', category_type);
        }
        if (category_area) {
          courseQuery = courseQuery.eq('category_area', category_area);
        }

        // Text search in course title and description
        if (searchQuery) {
          const searchTerm = `%${searchQuery}%`;
          courseQuery = courseQuery.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
        }

        const { data: matchingCourses, error: courseError } = await courseQuery;
        if (courseError) throw courseError;

        // Extract unique provider IDs
        filteredProviderIds = [...new Set((matchingCourses || []).map(c => c.user_id))];

        // If no courses match, return empty result
        if (filteredProviderIds.length === 0) {
          return res.status(200).json({
            providers: [],
            pagination: { total: 0, limit, offset, hasMore: false },
            filters: {
              canton: canton || null,
              city: city || null,
              verified: verified === 'true',
              category_type: category_type || null,
              category_area: category_area || null,
              q: searchQuery || null
            }
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

      if (providerIds.length > 0) {
        const { data: courseData } = await supabase
          .from('courses')
          .select('user_id, category_type, category_area')
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
          courseCount: courseCounts[p.id] || 0,
          categories: {
            types: providerCategories[p.id] ? Array.from(providerCategories[p.id].types) : [],
            areas: providerCategories[p.id] ? Array.from(providerCategories[p.id].areas) : []
          },
          publishedAt: p.profile_published_at
        }))
        .sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          if (b.courseCount !== a.courseCount) return b.courseCount - a.courseCount;
          return a.name.localeCompare(b.name, 'de');
        })
        .filter(p => p.courseCount > 0);

      return res.status(200).json({
        providers: results,
        pagination: { total: count || 0, limit, offset, hasMore: offset + limit < (count || 0) },
        filters: {
          canton: canton || null,
          city: city || null,
          verified: verified === 'true',
          category_type: category_type || null,
          category_area: category_area || null,
          q: searchQuery || null
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

      const { slug, providerId } = req.body;

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

    // Unknown action
    return res.status(400).json({ error: 'Unknown action. Use: profile, directory, or validate-slug' });

  } catch (error) {
    console.error('Provider API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
