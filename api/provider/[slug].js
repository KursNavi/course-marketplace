import { createClient } from '@supabase/supabase-js';

/**
 * Provider Profile API
 * GET /api/provider/:slug
 *
 * Returns public provider profile data for Pro+ providers with published profiles.
 * Includes: profile data, entitlements, published courses, SEO meta, schema.org data
 *
 * Returns 404 for:
 * - Basic tier providers
 * - Providers without profile_published_at
 * - Non-existent slugs
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get slug from URL
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const baseUrl = (process.env.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');

  try {
    // First, check if this is an alias (old slug)
    const { data: aliasData } = await supabase
      .from('provider_slug_aliases')
      .select('new_slug, provider_id')
      .eq('old_slug', slug)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If alias found, return redirect info
    if (aliasData) {
      return res.status(200).json({
        redirect: true,
        newSlug: aliasData.new_slug,
        canonicalUrl: `${baseUrl}/anbieter/${aliasData.new_slug}`
      });
    }

    // Fetch provider by slug
    const { data: provider, error: providerError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        slug,
        provider_description,
        logo_url,
        cover_image_url,
        public_contact_email,
        profile_published_at,
        website_url,
        city,
        canton,
        additional_locations,
        verification_status,
        package_tier,
        bio_text,
        certificates
      `)
      .eq('slug', slug)
      .single();

    if (providerError || !provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Check eligibility: must be Pro+ and published
    const tier = (provider.package_tier || 'basic').toLowerCase();
    const isEligible = ['pro', 'premium', 'enterprise'].includes(tier);

    if (!isEligible) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    if (!provider.profile_published_at) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Calculate entitlements
    const entitlements = {
      tier,
      hasPublicProfile: true,
      isDirectoryListed: true,
      hasReviews: tier === 'enterprise',
      isFeatured: tier === 'enterprise',
      hasCoverImage: tier === 'enterprise',
      homepageLinkRel: tier === 'enterprise' ? 'sponsored noopener' : 'nofollow noopener'
    };

    // Fetch published courses for this provider
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        description,
        price,
        category_type,
        category_area,
        category_specialty,
        canton,
        city,
        booking_type,
        image_url,
        created_at
      `)
      .eq('user_id', provider.id)
      .or('status.eq.published,status.is.null')
      .order('created_at', { ascending: false });

    if (coursesError) {
      console.error('Error fetching courses:', coursesError);
    }

    // Build public profile data (whitelist fields)
    const publicProfile = {
      id: provider.id,
      name: provider.full_name,
      slug: provider.slug,
      description: provider.provider_description || provider.bio_text,
      logoUrl: provider.logo_url,
      coverImageUrl: entitlements.hasCoverImage ? provider.cover_image_url : null,
      websiteUrl: provider.website_url,
      contactEmail: provider.public_contact_email, // Only if explicitly set
      location: {
        city: provider.city,
        canton: provider.canton
      },
      additionalLocations: provider.additional_locations || [],
      isVerified: provider.verification_status === 'verified',
      certificates: provider.certificates || [],
      publishedAt: provider.profile_published_at,
      courseCount: courses?.length || 0
    };

    // Build SEO meta data
    const seoMeta = {
      title: `${provider.full_name} - Kursanbieter | KursNavi`,
      description: (provider.provider_description || provider.bio_text || '')
        .substring(0, 155) + '...',
      canonicalUrl: `${baseUrl}/anbieter/${provider.slug}`,
      ogImage: provider.logo_url || `${baseUrl}/og-default.jpg`
    };

    // Build Schema.org structured data
    const schemaOrg = {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: provider.full_name,
      url: `${baseUrl}/anbieter/${provider.slug}`,
      logo: provider.logo_url,
      description: provider.provider_description || provider.bio_text,
      address: {
        '@type': 'PostalAddress',
        addressLocality: provider.city,
        addressRegion: provider.canton,
        addressCountry: 'CH'
      }
    };

    // Add website to sameAs if available
    if (provider.website_url) {
      schemaOrg.sameAs = [provider.website_url];
    }

    return res.status(200).json({
      provider: publicProfile,
      entitlements,
      courses: courses || [],
      seo: seoMeta,
      schema: schemaOrg
    });

  } catch (error) {
    console.error('Provider API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
