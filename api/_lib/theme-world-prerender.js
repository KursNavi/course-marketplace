/**
 * Prerender-Quelle für das dynamische Themenwelten-System.
 *
 * Hintergrund:
 *   scripts/prerender-static.mjs erzeugte /bereich/-HTML-Dateien bisher
 *   ausschliesslich aus BEREICH_LANDING_CONFIG. Eine Themenwelt, die nur in der
 *   Datenbank existiert (kein Legacy-Eintrag), bekam damit keine statische Datei
 *   — Vercel lieferte beim ersten HTTP-Response die generische SPA-index.html
 *   aus. Für Suchmaschinen war die Seite damit ohne eigene Metadaten.
 *
 * Regeln:
 *   - Nur status='published' Themenwelten und nur status='published' Szenarien
 *     publizierter Themenwelten werden zu statischen Seiten.
 *   - Ohne VITE_THEME_WORLD_DB_ENABLED='true' entstehen KEINE DB-Routen. Eine
 *     reine DB-Themenwelt liefert dann öffentlich nichts aus (BereichLandingPage
 *     rendert «Bereich nicht gefunden») — sie darf also auch keine indexierbare
 *     statische Seite bekommen. Gleiche Semantik wie in Sitemap und Takeover.
 *   - Segmente und Slugs werden gegen das DB-CHECK-Format validiert, bevor sie
 *     in einen Dateipfad oder eine URL geschrieben werden (Defense in Depth).
 *   - Anders als Sitemap und Takeover ist diese Funktion NICHT fehlertolerant:
 *     bei einem DB-Fehler wirft sie. Ein Build, der stillschweigend ohne die
 *     DB-Seiten durchläuft, würde einen funktionierenden Production-Deploy durch
 *     einen ohne statische DB-Seiten ersetzen — genau der SEO-Schaden, der hier
 *     verhindert werden soll.
 *
 * Die SEO-Fallbacks spiegeln exakt die Laufzeitlogik von BereichLandingPage.jsx
 * und SzenarioArtikelView.jsx, damit Server-HTML und React-Hydration dieselben
 * Werte ergeben.
 */

import { isSafePathSegment } from './sitemap-theme-worlds.js';
import { isThemeWorldDbEnabledServer } from './theme-world-takeover.js';

/** Standard-OG-Bild (relativ zur Site-Basis-URL). */
export const DEFAULT_OG_IMAGE_PATH = '/og-default.png';

/** Fehler, der einen Build kontrolliert scheitern lässt. */
export class ThemeWorldPrerenderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ThemeWorldPrerenderError';
    this.cause = cause;
  }
}

/** Normalisiert einen DB-Textwert auf einen getrimmten String oder ''. */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Lädt publizierte Themenwelten und deren publizierte Szenarien inklusive der
 * SEO-Felder.
 *
 * Es werden nur öffentlich lesbare Spalten selektiert — Service-Role-Rechte sind
 * nicht nötig. RLS gibt anonym ohnehin nur publizierte Themenwelten und deren
 * publizierte Szenarien frei; der Statusfilter steht trotzdem explizit in der
 * Query, falls der Build mit einem privilegierten Key läuft.
 *
 * @param {object} supabase - Supabase-Client (anon reicht)
 * @returns {Promise<{worlds: Array, scenarios: Array}>}
 * @throws {ThemeWorldPrerenderError} bei jedem DB-Fehler
 */
export async function fetchThemeWorldPrerenderRecords(supabase) {
  if (!supabase) {
    throw new ThemeWorldPrerenderError(
      'Kein Supabase-Client für den Themenwelten-Prerender verfügbar.'
    );
  }

  let worlds;
  try {
    const { data, error } = await supabase
      .from('theme_worlds')
      .select(
        'id, key, url_segment, slug, status, title_de, subtitle_de, meta_title, meta_description, og_image_url, og_image_alt_de, hero_image_alt_de'
      )
      .eq('status', 'published');

    if (error) {
      throw new ThemeWorldPrerenderError(
        `Publizierte Themenwelten konnten nicht geladen werden: ${error.message || error}`,
        error
      );
    }
    worlds = data || [];
  } catch (e) {
    if (e instanceof ThemeWorldPrerenderError) throw e;
    throw new ThemeWorldPrerenderError(
      `Themenwelten-Abfrage fehlgeschlagen: ${e?.message || e}`,
      e
    );
  }

  if (worlds.length === 0) return { worlds, scenarios: [] };

  let scenarios;
  try {
    const { data, error } = await supabase
      .from('theme_world_scenarios')
      .select(
        'theme_world_id, slug, status, label_de, teaser_de, meta_title, meta_description, og_image_url, og_image_alt'
      )
      .eq('status', 'published')
      .in('theme_world_id', worlds.map((world) => world.id));

    if (error) {
      throw new ThemeWorldPrerenderError(
        `Publizierte Szenario-Artikel konnten nicht geladen werden: ${error.message || error}`,
        error
      );
    }
    scenarios = data || [];
  } catch (e) {
    if (e instanceof ThemeWorldPrerenderError) throw e;
    throw new ThemeWorldPrerenderError(
      `Szenario-Abfrage fehlgeschlagen: ${e?.message || e}`,
      e
    );
  }

  return { worlds, scenarios };
}

/**
 * Bildet DB-Datensätze auf Prerender-Routen ab.
 *
 * @param {object} params
 * @param {Array} params.worlds - Zeilen aus theme_worlds
 * @param {Array} [params.scenarios] - Zeilen aus theme_world_scenarios
 * @param {string} params.baseUrl - z.B. 'https://kursnavi.ch' (ohne Slash am Ende)
 * @param {object} [params.logger=console]
 * @returns {Array<{path: string, title: string, description: string, ogImage: string, ogImageAlt: string, kind: 'theme-world'|'scenario'}>}
 */
export function buildThemeWorldPrerenderRoutes({
  worlds = [],
  scenarios = [],
  baseUrl,
  logger = console,
}) {
  const defaultOgImage = `${baseUrl}${DEFAULT_OG_IMAGE_PATH}`;
  const routes = [];
  const worldById = new Map();

  for (const world of worlds) {
    // Status erneut prüfen: Drafts/archivierte Datensätze dürfen niemals eine
    // statische Seite erzeugen, auch wenn ein Aufrufer den Filter vergisst.
    if (!world || world.status !== 'published') continue;
    if (!isSafePathSegment(world.url_segment) || !isSafePathSegment(world.slug)) {
      logger?.warn?.(
        `[prerender] Themenwelt übersprungen — unerwartetes URL-Format: segment=${world.url_segment} slug=${world.slug}`
      );
      continue;
    }

    const path = `/bereich/${world.url_segment}/${world.slug}`;
    const visibleTitle = text(world.title_de);
    // Fallbacks identisch zu BereichLandingPage.jsx
    const title = text(world.meta_title) || `${visibleTitle} | KursNavi`;
    const description = text(world.meta_description) || text(world.subtitle_de);

    const themeWorldKey = text(world.key);
    worldById.set(world.id, { path, title: visibleTitle, themeWorldKey });
    routes.push({
      path,
      title,
      description,
      ogImage: text(world.og_image_url) || defaultOgImage,
      ogImageAlt: text(world.og_image_alt_de) || text(world.hero_image_alt_de),
      kind: 'theme-world',
      themeWorldKey,
    });
  }

  for (const scenario of scenarios) {
    if (!scenario || scenario.status !== 'published') continue;
    // Szenarien ohne publizierte Eltern-Themenwelt haben keinen Pfad.
    const parent = worldById.get(scenario.theme_world_id);
    if (!parent) continue;
    if (!isSafePathSegment(scenario.slug)) {
      logger?.warn?.(
        `[prerender] Szenario übersprungen — unerwartetes Slug-Format: ${scenario.slug}`
      );
      continue;
    }

    // Fallbacks identisch zu SzenarioArtikelView.jsx (inkl. OG-Bild: kein
    // Parent-Bild, sondern direkt das Standardbild).
    const label = text(scenario.label_de);
    const title =
      text(scenario.meta_title) || `${label} — ${parent.title} | KursNavi`;

    routes.push({
      path: `${parent.path}/${scenario.slug}`,
      title,
      description: text(scenario.meta_description) || text(scenario.teaser_de),
      ogImage: text(scenario.og_image_url) || defaultOgImage,
      ogImageAlt: text(scenario.og_image_alt),
      kind: 'scenario',
      themeWorldKey: parent.themeWorldKey,
    });
  }

  return routes;
}

/**
 * Ermittelt alle statisch zu erzeugenden DB-Themenwelt-Routen.
 *
 * @param {object} params
 * @param {object} [params.supabase] - Supabase-Client (anon reicht)
 * @param {string} params.baseUrl
 * @param {object} [params.env=process.env]
 * @param {object} [params.logger=console]
 * @returns {Promise<{enabled: boolean, routes: Array, worlds: Array}>}
 * @throws {ThemeWorldPrerenderError} wenn das DB-System aktiv ist und die
 *         Abfrage fehlschlägt oder kein Client verfügbar ist
 */
export async function loadThemeWorldPrerenderRoutes({
  supabase,
  baseUrl,
  env = process.env,
  logger = console,
}) {
  if (!isThemeWorldDbEnabledServer(env)) {
    return { enabled: false, routes: [], worlds: [] };
  }

  const { worlds, scenarios } = await fetchThemeWorldPrerenderRecords(supabase);
  return {
    enabled: true,
    worlds,
    routes: buildThemeWorldPrerenderRoutes({ worlds, scenarios, baseUrl, logger }),
  };
}
