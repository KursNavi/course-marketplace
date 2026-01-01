import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 1. Supabase Init (Robust Environment Check)
  // Wir prüfen auf deine Vercel-Variablen (ohne VITE_) und Fallbacks
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  
  // Wir nutzen bevorzugt den Service Role Key (Backend) oder den Anon Key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Environment Variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 2. Fetch all active courses
    // Wir holen nur ID, Titel, Area, Canton und Updated_at für die URL-Generierung
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title, category_area, canton, updated_at, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const baseUrl = 'https://kursnavi.ch';

    // 3. Generate Static Pages XML
    const staticPages = [
      '',
      '/search',
      '/about',
      '/how-it-works',
      '/contact',
      '/private',
      '/professional',
      '/children'
    ].map((page) => {
      return `
      <url>
          <loc>${baseUrl}${page}</loc>
          <changefreq>weekly</changefreq>
          <priority>${page === '' ? '1.0' : '0.8'}</priority>
      </url>`;
    }).join('');

    // 4. Generate Course URLs (Dynamic)
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
          <lastmod>${new Date(course.updated_at || course.created_at).toISOString()}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.7</priority>
      </url>`;
    }).join('');

    // 5. Construct Final XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${staticPages}
      ${courseUrls}
    </urlset>`;

    // 6. Send Response
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(sitemap);

  } catch (e) {
    console.error(e);
    res.status(500).send('Error generating sitemap');
  }
}