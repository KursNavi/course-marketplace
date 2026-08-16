/**
 * Permanenter Redirect von einer übernommenen /thema/-Landingpage auf die
 * Themenwelt /bereich/{segment}/{slug}.
 *
 * Routing-Kontext (Vercel):
 *   1. `redirects` aus vercel.json
 *   2. Dateisystem — statische Dateien aus dist/ (inkl. Prerender)
 *   3. `rewrites` aus vercel.json
 *
 * Weil das Dateisystem VOR den Rewrites greift, erreicht ein Request diese
 * Funktion nur dann, wenn für /thema/{segment}/{slug} KEINE prerenderte Datei
 * existiert. scripts/prerender-static.mjs überspringt beim Build genau die
 * Themen, die von einer öffentlich aktiven Themenwelt übernommen wurden.
 * Alle nicht übernommenen /thema/-Seiten werden weiterhin unverändert als
 * statische Datei ausgeliefert und kosten keinen Funktionsaufruf.
 *
 * Die Entscheidung wird hier trotzdem noch einmal LIVE gegen die Datenbank
 * geprüft — der Build-Stand ist nur ein Hinweis, die Datenbank ist die
 * Wahrheit. Dadurch ist das Verhalten reversibel:
 *   - Themenwelt öffentlich aktiv  → 308 auf /bereich/…
 *   - Themenwelt nicht (mehr) aktiv → einfache /thema/-Seite wird ausgeliefert
 *
 * 308 (statt 301) ist bewusst gewählt: Es ist Vercels eigene Semantik für
 * `"permanent": true` in vercel.json und wird von Suchmaschinen wie 301
 * behandelt, ohne die HTTP-Methode zu verändern.
 *
 * Zweite, kleinere Aufgabe derselben Funktion: historische Themen-Slugs
 * (TOPIC_SLUG_ALIASES in src/lib/segmentLandingConfig.js) dauerhaft auf ihren
 * kanonischen Slug führen. Ein Alias hat keinen eigenen Inhalt, steht deshalb
 * weder in der Sitemap noch im Prerender und landet aus demselben Grund immer
 * hier.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SIMPLE_TOPIC_CONTENT, resolveTopicAlias } from '../src/lib/segmentLandingConfig.js';
import {
  bereichPath,
  themaPath,
  topicKey,
  buildActiveThemeWorldTopicKeys,
} from '../src/lib/themeWorldTakeover.js';
import {
  isThemeWorldDbEnabledServer,
  fetchPublishedThemeWorldRefs,
} from './_lib/theme-world-takeover.js';
import { injectHeadMeta, escapeHtmlAttr } from './_lib/html-head.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Cache für die SPA-Shell — pro Lambda-Instanz nur einmal von der Platte lesen. */
let shellCache;

/**
 * Liest dist/index.html (die gebaute SPA-Shell).
 * Gibt null zurück, wenn die Datei im Funktions-Bundle nicht verfügbar ist —
 * der Aufrufer liefert dann eine minimale HTML-Seite aus.
 */
function readSpaShell() {
  if (shellCache !== undefined) return shellCache;

  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(__dirname, '..', 'dist', 'index.html'),
  ];

  for (const candidate of candidates) {
    try {
      shellCache = readFileSync(candidate, 'utf-8');
      return shellCache;
    } catch {
      // nächster Kandidat
    }
  }

  shellCache = null;
  return shellCache;
}

/** Minimale HTML-Seite, falls die SPA-Shell nicht gelesen werden kann. */
function minimalHtml({ canonical, title, description }) {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtmlAttr(title)}</title>
    <meta name="description" content="${escapeHtmlAttr(description)}" />
    <link rel="canonical" href="${canonical}" />
  </head>
  <body>
    <h1>${escapeHtmlAttr(title)}</h1>
    <p>${escapeHtmlAttr(description)}</p>
    <p><a href="/search">Alle Kurse durchsuchen</a></p>
  </body>
</html>`;
}

/**
 * Ermittelt Segment und Slug aus der Rewrite-Query oder — als Rückfallebene —
 * aus dem Original-Pfad.
 */
export function parseThemaRequest(req) {
  const fromQuery = {
    segment: req?.query?.segment,
    slug: req?.query?.slug,
  };
  if (fromQuery.segment && fromQuery.slug) return fromQuery;

  const url = req?.url || '';
  const pathname = url.split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('thema');
  if (idx !== -1 && parts.length >= idx + 3) {
    return { segment: parts[idx + 1], slug: parts[idx + 2] };
  }
  return { segment: null, slug: null };
}

export default async function handler(req, res) {
  const { segment, slug } = parseThemaRequest(req);
  const key = topicKey(segment, slug);

  // Ungültiges URL-Format → nichts, worauf sinnvoll weitergeleitet werden könnte.
  if (!key) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(
      minimalHtml({
        canonical: `${siteBaseUrl()}/search`,
        title: 'Seite nicht gefunden | KursNavi',
        description: 'Diese Themenseite existiert nicht (mehr).',
      })
    );
  }

  const activeTopicKeys = await resolveActiveTopicKeys();

  // 0. Historischer Slug (TOPIC_SLUG_ALIASES) → dauerhafter Redirect auf den
  //    kanonischen Slug. Das Ziel wird sofort mitaufgelöst: Ist das kanonische
  //    Thema seinerseits von einer Themenwelt übernommen, zeigt der Redirect
  //    direkt auf /bereich/… — nie Alias → /thema/ → /bereich/ (keine Kette).
  const canonicalKey = resolveTopicAlias(key);
  if (canonicalKey !== key) {
    const [canonicalSegment, canonicalSlug] = canonicalKey.split('/');
    const target = activeTopicKeys.has(canonicalKey)
      ? bereichPath(canonicalSegment, canonicalSlug)
      : themaPath(canonicalSegment, canonicalSlug);
    res.setHeader('Location', target);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    return res.status(308).send(`Redirecting to ${target}`);
  }

  // 1. Übernommen → dauerhafter Redirect auf die Themenwelt.
  if (activeTopicKeys.has(key)) {
    const target = bereichPath(segment, slug);
    res.setHeader('Location', target);
    // Kurze CDN-Cachezeit statt unbefristet: ein Rollback (Themenwelt wieder
    // deaktiviert) wird dadurch zeitnah wirksam.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    return res.status(308).send(`Redirecting to ${target}`);
  }

  // 2. Nicht übernommen → einfache /thema/-Seite ausliefern.
  //    Regulär existiert dafür eine prerenderte Datei; hierher kommt nur ein
  //    Übergangszustand (Themenwelt seit dem letzten Build deaktiviert) oder
  //    eine unbekannte URL.
  const content = SIMPLE_TOPIC_CONTENT[key];
  const canonical = `${siteBaseUrl()}${themaPath(segment, slug)}`;

  if (!content) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return res.status(404).send(
      minimalHtml({
        canonical,
        title: 'Seite nicht gefunden | KursNavi',
        description: 'Diese Themenseite existiert nicht (mehr).',
      })
    );
  }

  const title = `${content.title} | KursNavi`;
  const description = content.subtitle || '';
  const shell = readSpaShell();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  return res.status(200).send(
    shell
      ? injectHeadMeta(shell, {
          canonical,
          title,
          description,
          ogImage: `${siteBaseUrl()}/og-default.png`,
        })
      : minimalHtml({ canonical, title, description })
  );
}

function siteBaseUrl() {
  return (process.env.VITE_SITE_URL || 'https://kursnavi.ch').replace(/\/$/, '');
}

/**
 * Live-Ermittlung der öffentlich aktiven Themenwelten.
 * Fehler beim DB-Zugriff → nur Legacy-Themenwelten gelten als aktiv, die
 * übrigen /thema/-Seiten bleiben erreichbar (sicherer Fallback).
 */
async function resolveActiveTopicKeys() {
  if (!isThemeWorldDbEnabledServer()) {
    return buildActiveThemeWorldTopicKeys({ dbEnabled: false });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[thema-redirect] Supabase nicht konfiguriert — nur Legacy-Themenwelten aktiv.');
    return buildActiveThemeWorldTopicKeys({ dbEnabled: false });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { worlds } = await fetchPublishedThemeWorldRefs(supabase);

  return buildActiveThemeWorldTopicKeys({ dbEnabled: true, publishedDbWorlds: worlds });
}
