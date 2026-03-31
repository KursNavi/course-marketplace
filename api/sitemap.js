import { createClient } from '@supabase/supabase-js';

// Inlined to avoid importing React-dependent modules (constants.js imports lucide-react)
function slugify(input) {
  return (input || '')
    .toString().trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildCoursePath(course) {
  if (!course) return '/search';
  const topic = slugify(course.category_area || 'kurs');
  const loc = slugify(course.canton || 'schweiz');
  const title = slugify(course.title || 'detail');
  return `/courses/${topic}/${loc}/${course.id}-${title}`;
}

export default async function handler(req, res) {
  // 1. Supabase Init (Robust Environment Check)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Environment Variables' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 2. Fetch all published courses (exclude drafts)
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
      const path = buildCoursePath(course);

      return `
      <url>
          <loc>${baseUrl}${path}</loc>
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

    // 8. Generate Ratgeber URLs (Static content structure)
    const ratgeberCategories = ['beruflich', 'privat-hobby', 'kinder'];
    const ratgeberClusters = {
      'beruflich': ['finanzierung', 'karriere', 'future-skills', 'bildungssystem'],
      'privat-hobby': ['inspiration', 'qualitaet', 'lebensphasen', 'kosten-nutzen'],
      'kinder': ['sicherheit', 'interessen', 'finanzen-kinder', 'familienalltag']
    };
    const ratgeberArticles = {
      'beruflich/finanzierung': ['vollkostenrechnung-weiterbildung', 'bundesbeitraege-50-prozent', 'kantonale-stipendien-vergleich', 'weiterbildungsvereinbarungen', 'steuer-hack-weiterbildung', 'alternative-finanzierungswege'],
      'beruflich/karriere': ['berufliche-standortbestimmung', 'spezialisierung-vs-generalisierung', 'linkedin-optimierung', 'gehaltsverhandlung-nach-kurs', 'quereinstieg-40-plus', 'soft-skills-karriere-turbo'],
      'beruflich/future-skills': ['ai-literacy-arbeitsplatz', 'green-skills', 'new-work-hybride-fuehrung', 'micro-credentials', 'digital-literacy-generationen', 'adaptive-skills'],
      'beruflich/bildungssystem': ['schweizer-bildungssystem-ueberblick', 'hoehere-berufsbildung-vs-hochschule', 'professional-bachelor-master', 'qualitaetslabels-eduqua', 'ects-punkte-cas-das-mas', 'anerkennung-auslaendischer-diplome'],
      'privat-hobby/inspiration': ['hobby-finden-selbstanalyse', 'workshop-vs-kurs', 'micro-hobbies', 'zurueck-zum-kindheitstraum', 'hobby-hopping', 'flow-zustand-stressabbau'],
      'privat-hobby/qualitaet': ['qualitaetscheck-kursanbieter', 'red-flags-hobbykurse', 'kursbeschreibungen-richtig-lesen', 'offline-vs-online', 'storno-ruecktritt-rechte', 'bewertungen-kontext'],
      'privat-hobby/lebensphasen': ['hobbys-senioren', 'neu-in-der-stadt', 'hobbykurse-date-idee', 'kurse-alleine-besuchen', 'hobbys-studierende', 'introvertiert-hobbys-alleine'],
      'privat-hobby/kosten-nutzen': ['hobby-vollkosten-modell', 'ausruestung-mieten-statt-kaufen', 'krankenkassenbeitraege-kurse', '50-30-20-freizeitplanung', 'minimum-viable-gear', 'guenstige-alternativen'],
      'kinder/sicherheit': ['aufsichtspflicht-schweiz', 'kinderschutz-safeguarding', 'erste-hilfe-notfallplaene', 'sicherheit-kursraum-checkliste', 'datenschutz-fotos-videos', 'versicherungsschutz-kindersport'],
      'kinder/interessen': ['interessen-check-kind', 'motivation-ohne-zwang', 'hobby-wechsel-aufgeben', 'peer-group-einfluss', 'schnupperstunden-probieren', 'intrinsische-motivation'],
      'kinder/finanzen-kinder': ['kulturlegi-schweiz', 'steuertipp-kinderbetreuungskosten', 'budgetplanung-kinderkurse', 'geschwisterrabatte-paketpreise', 'stiftungen-kantonale-programme', 'ausruestung-mieten-kinder'],
      'kinder/familienalltag': ['zeitmanagement-eltern', 'mental-load-buchungssysteme', 'angst-vor-neuem', 'hausaufgaben-vs-hobby', 'mobbingpraevention-kurse', 'ferienplanung-betreuungsluecken']
    };

    let ratgeberUrls = `
      <url>
          <loc>${baseUrl}/ratgeber</loc>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
      </url>`;

    for (const cat of ratgeberCategories) {
      ratgeberUrls += `
      <url>
          <loc>${baseUrl}/ratgeber/${cat}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
      </url>`;
      for (const cluster of (ratgeberClusters[cat] || [])) {
        ratgeberUrls += `
      <url>
          <loc>${baseUrl}/ratgeber/${cat}/${cluster}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
      </url>`;
        for (const article of (ratgeberArticles[`${cat}/${cluster}`] || [])) {
          ratgeberUrls += `
      <url>
          <loc>${baseUrl}/ratgeber/${cat}/${cluster}/${article}</loc>
          <changefreq>monthly</changefreq>
          <priority>0.6</priority>
      </url>`;
        }
      }
    }

    // 9. Construct Final XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${staticPages}
      ${courseUrls}
      ${blogUrls}
      ${providerUrls}
      ${ratgeberUrls}
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
