import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 1. Supabase Init (Robust Environment Check)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Environment Variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 2. Fetch all published courses (exclude drafts and paused)
    // FIX: Removed 'updated_at' because it does not exist in the DB schema
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title, category_area, canton, created_at')
      .or('status.eq.published,status.is.null') // Include published + legacy courses without status
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 3. Fetch all published blog posts
    const { data: blogPosts, error: blogError } = await supabase
      .from('blog')
      .select('id, slug, title, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (blogError) console.warn('Blog fetch error:', blogError);

    const baseUrl = (process.env.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');

    // 4. Fetch eligible providers (Pro+ with published profile and courses)
    const { data: providers, error: providerError } = await supabase
      .from('profiles')
      .select('id, slug, profile_published_at')
      .not('profile_published_at', 'is', null)
      .not('slug', 'is', null)
      .in('package_tier', ['pro', 'premium', 'enterprise']);

    if (providerError) console.warn('Provider fetch error:', providerError);

    // Filter providers: only include those with at least 1 published course
    let eligibleProviders = [];
    if (providers && providers.length > 0) {
      const providerIds = providers.map(p => p.id);
      const { data: providerCourses } = await supabase
        .from('courses')
        .select('user_id')
        .in('user_id', providerIds)
        .or('status.eq.published,status.is.null');

      const providersWithCourses = new Set((providerCourses || []).map(c => c.user_id));
      eligibleProviders = providers.filter(p => providersWithCourses.has(p.id));
    }

    // 5. Generate Static Pages XML
    const staticPages = [
      '',
      '/search',
      '/about',
      '/how-it-works',
      '/contact',
      '/private',
      '/professional',
      '/children',
      '/teacher-hub',
      '/blog',
      '/anbieter',
      '/agb',
      '/datenschutz',
      '/impressum'
    ].map((page) => {
      return `
      <url>
          <loc>${baseUrl}${page}</loc>
          <changefreq>weekly</changefreq>
          <priority>${page === '' ? '1.0' : '0.8'}</priority>
      </url>`;
    }).join('');

    // 6. Generate Course URLs (Dynamic)
    const courseUrls = (courses || []).map((course) => {
      const topicSlug = (course.category_area || 'kurs').toLowerCase().replace(/_/g, '-');
      const locSlug = (course.canton || 'schweiz').toLowerCase();
      const titleSlug = (course.title || 'detail')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      return `
      <url>
          <loc>${baseUrl}/courses/${topicSlug}/${locSlug}/${course.id}-${titleSlug}</loc>
          <lastmod>${new Date(course.created_at).toISOString()}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.7</priority>
      </url>`;
    }).join('');

    // 6. Generate Blog Post URLs (Dynamic)
    const blogUrls = (blogPosts || []).map((post) => {
      const slug = post.slug || post.id;
      return `
      <url>
          <loc>${baseUrl}/blog/${slug}</loc>
          <lastmod>${new Date(post.created_at).toISOString()}</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.6</priority>
      </url>`;
    }).join('');

    // 7. Generate Provider URLs (Dynamic)
    const providerUrls = (eligibleProviders || []).map((provider) => {
      return `
      <url>
          <loc>${baseUrl}/anbieter/${provider.slug}</loc>
          <lastmod>${new Date(provider.profile_published_at).toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.6</priority>
      </url>`;
    }).join('');

    // 9. Construct Final XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${staticPages}
      ${courseUrls}
      ${blogUrls}
      ${providerUrls}
    </urlset>`;

    // 6. Send Response
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(sitemap);

  } catch (e) {
    console.error("SITEMAP ERROR:", e);
    res.status(500).json({ 
      error: 'Error generating sitemap', 
      details: e.message 
    });
  }
}