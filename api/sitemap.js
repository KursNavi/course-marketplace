import { createClient } from '@supabase/supabase-js';
import { BEREICH_LANDING_CONFIG } from '../src/lib/bereichLandingConfig.js';
import { SIMPLE_TOPIC_CONTENT } from '../src/lib/segmentLandingConfig.js';
import { fetchThemeWorldSitemapEntries, escapeXml } from './_lib/sitemap-theme-worlds.js';
import {
  buildActiveThemeWorldTopicKeys,
  topicKeyFromBereichPath,
} from '../src/lib/themeWorldTakeover.js';
import { isThemeWorldDbEnabledServer } from './_lib/theme-world-takeover.js';
// Gemeinsame Quelle der Wahrheit für Kurs-URLs — identisch mit internen Links,
// Canonical, og:url, JSON-LD und der App-Normalisierung. courseUrl.js ist
// bewusst abhängigkeitsfrei und darf deshalb hier importiert werden.
import { buildCanonicalCoursePath, hasStableCanonicalTopic } from '../src/lib/courseUrl.js';
import { attachPrimaryCategories, fetchCourseCategoryRows } from './_lib/course-categories.js';

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
      .select('id, title, category_type, category_area, category_specialty, category_focus, canton, created_at')
      .or('status.eq.published,status.is.null') // Include published + legacy courses without status
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 2b. Semantische Kategorien nachladen — courses.category_area enthält bei
    // neueren Kursen nur die numerische Taxonomie-ID. Ohne diesen Schritt
    // erzeugte die Sitemap /courses/12/... statt /courses/kunst/...
    const { byCourseId, unresolvedIds } = await fetchCourseCategoryRows(
      supabase,
      (courses || []).map((course) => course.id)
    );
    const coursesWithCategories = attachPrimaryCategories(courses, byCourseId);

    // 2c. Kurse auslassen, deren kanonische Kategorie wir gerade NICHT kennen.
    // Eine geratene URL wäre schlimmer als eine fehlende: sobald die Kategorien
    // wieder auflösbar sind, entstünde eine zweite indexierte Variante. Kurse,
    // deren eigene Felder bereits ein semantisches Thema ergeben, sind davon
    // nicht betroffen und bleiben in der Sitemap.
    const publishableCourses = coursesWithCategories.filter((course) => {
      if (!unresolvedIds.has(course.id) || hasStableCanonicalTopic(course)) return true;
      console.warn(
        `[sitemap] Kurs ${course.id} ausgelassen: Kategorie nicht auflösbar, kanonische URL wäre geraten.`
      );
      return false;
    });

    // 3. Fetch all published blog posts
    // FIX (2026-07-14): Tabelle heisst 'articles', nicht 'blog'.
    // Die Abfrage auf 'blog' schlug seit jeher still fehl und hinterliess
    // Blog-Post-URLs vollständig aus der Sitemap. Quelle: phase-2-architecture.md.
    const { data: blogPosts, error: blogError } = await supabase
      .from('articles')
      .select('id, slug, title, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (blogError) {
      // Sichtbares Log — nicht still ignorieren (Correction C in phase-2-architecture.md)
      console.error('[sitemap] Blog-Artikel konnten nicht geladen werden:', blogError.message);
      // Sitemap wird ohne Blog-URLs ausgeliefert — kein 500-Fehler wegen fehlender Blog-Daten
    }

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
      '/impressum',
      '/vertrauen-sicherheit',
      '/widerruf-storno'
    ].map((page) => {
      const isLegal = ['/vertrauen-sicherheit', '/widerruf-storno'].includes(page);
      return `
      <url>
          <loc>${baseUrl}${page}</loc>
          <changefreq>${isLegal ? 'yearly' : 'weekly'}</changefreq>
          <priority>${page === '' ? '1.0' : isLegal ? '0.5' : '0.8'}</priority>
      </url>`;
    }).join('');

    // 6. Generate Course URLs (Dynamic)
    const courseUrls = publishableCourses.map((course) => {
      const path = buildCanonicalCoursePath(course);

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

    // 9. Generate Bereich Landing + Szenario URLs
    //    Zwei Quellen:
    //      A) Legacy: BEREICH_LANDING_CONFIG (statische Konfiguration)
    //      B) DB: publizierte theme_worlds + publizierte theme_world_scenarios
    //    Die Pfad-Menge wird dedupliziert — eine URL, die in beiden Quellen
    //    existiert (z.B. Yoga während der Migrationsphase), erscheint genau einmal.
    //    Legacy wird zuerst eingefügt und gewinnt bei Kollisionen.
    const bereichEntries = new Map(); // path -> { path, lastmod, changefreq, priority }

    const addBereichEntry = (path, meta) => {
      const existing = bereichEntries.get(path);
      if (existing) {
        // Duplikat: kein zweiter <url>-Eintrag. Nur ein fehlendes lastmod wird ergänzt.
        if (!existing.lastmod && meta.lastmod) existing.lastmod = meta.lastmod;
        return;
      }
      bereichEntries.set(path, { path, lastmod: null, ...meta });
    };

    // A) Legacy-Konfiguration (auto-updates as config grows)
    for (const bereich of Object.values(BEREICH_LANDING_CONFIG)) {
      const bereichPath = `/bereich/${bereich.segment}/${bereich.slug}`;
      addBereichEntry(bereichPath, { changefreq: 'weekly', priority: '0.8' });
      for (const szenario of (bereich.scenarios || [])) {
        addBereichEntry(`${bereichPath}/${szenario.slug}`, { changefreq: 'monthly', priority: '0.7' });
      }
    }

    // B) Datenbank-Themenwelten (publiziert). Ein Fehler hier darf die restliche
    //    Sitemap nicht zerstören — fetchThemeWorldSitemapEntries wirft nie.
    //    Ohne VITE_THEME_WORLD_DB_ENABLED='true' liefert eine reine
    //    DB-Themenwelt öffentlich nichts aus (BereichLandingPage rendert
    //    «Bereich nicht gefunden») und wird auch nicht prerendert — dann darf
    //    sie auch nicht als indexierbare URL in der Sitemap stehen. Gleiche
    //    Semantik wie Takeover und Prerender.
    const themeWorldDbEnabled = isThemeWorldDbEnabledServer();
    const { entries: themeWorldEntries, error: themeWorldError } = themeWorldDbEnabled
      ? await fetchThemeWorldSitemapEntries(supabase)
      : { entries: [], error: null };

    if (themeWorldError) {
      console.error(
        '[sitemap] Themenwelten aus der Datenbank unvollständig geladen — Sitemap wird ohne die fehlenden Themenwelten-URLs ausgeliefert:',
        themeWorldError.message || themeWorldError
      );
    }

    for (const entry of themeWorldEntries) {
      addBereichEntry(entry.path, {
        lastmod: entry.lastmod,
        changefreq: entry.kind === 'scenario' ? 'monthly' : 'weekly',
        priority: entry.kind === 'scenario' ? '0.7' : '0.8',
      });
    }

    const bereichUrls = Array.from(bereichEntries.values()).map((entry) => `
      <url>
          <loc>${escapeXml(`${baseUrl}${entry.path}`)}</loc>${entry.lastmod ? `
          <lastmod>${entry.lastmod}</lastmod>` : ''}
          <changefreq>${entry.changefreq}</changefreq>
          <priority>${entry.priority}</priority>
      </url>`).join('');

    // 10. Generate Thema URLs (Simple Topic Landing Pages — auto-updates as config grows)
    //     Themen, die inzwischen von einer öffentlich aktiven Themenwelt
    //     übernommen wurden, erscheinen NICHT: /thema/{key} leitet dann
    //     dauerhaft auf /bereich/{key} weiter (api/thema-redirect.js) und darf
    //     keine eigene indexierbare URL mehr in der Sitemap haben.
    //     Wird eine Themenwelt wieder deaktiviert, taucht /thema/{key}
    //     automatisch wieder auf — der Fallback-Content bleibt erhalten.
    //     Bei einem DB-Fehler enthält themeWorldEntries keine DB-Themenwelten;
    //     dann bleiben die betroffenen /thema/-URLs bestehen (sicherer Fallback).
    const activeTopicKeys = buildActiveThemeWorldTopicKeys({
      dbEnabled: themeWorldDbEnabled,
      publishedDbWorlds: themeWorldEntries
        .filter((entry) => entry.kind === 'theme-world')
        .map((entry) => {
          const key = topicKeyFromBereichPath(entry.path);
          if (!key) return null;
          const [url_segment, slug] = key.split('/');
          return { url_segment, slug, status: 'published' };
        })
        .filter(Boolean),
    });

    let themaUrls = '';
    for (const key of Object.keys(SIMPLE_TOPIC_CONTENT)) {
      if (activeTopicKeys.has(key)) continue;
      themaUrls += `
      <url>
          <loc>${escapeXml(`${baseUrl}/thema/${key}`)}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
      </url>`;
    }

    // 11. Construct Final XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${staticPages}
      ${courseUrls}
      ${blogUrls}
      ${providerUrls}
      ${ratgeberUrls}
      ${bereichUrls}
      ${themaUrls}
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
