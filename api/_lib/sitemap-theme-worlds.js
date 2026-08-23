/**
 * Sitemap-Quelle für das dynamische Themenwelten-System.
 *
 * Hintergrund:
 *   Die Sitemap erzeugte Bereichs-Landingpages bisher ausschliesslich aus der
 *   statischen Legacy-Konfiguration BEREICH_LANDING_CONFIG. Themenwelten, die
 *   nur noch in der Datenbank existieren (theme_worlds / theme_world_scenarios),
 *   wären dadurch nie in der Sitemap gelandet.
 *
 * Regeln:
 *   - Nur status='published' Themenwelten (draft/archived nie).
 *   - Nur status='published' Szenarien UND nur von publizierten Themenwelten.
 *   - Die Sitemap läuft ggf. mit Service-Role-Key (RLS wird dann umgangen),
 *     deshalb wird der Status IMMER explizit in der Query gefiltert.
 *   - Segmente und Slugs werden gegen das DB-CHECK-Format erneut validiert,
 *     bevor sie in eine URL geschrieben werden (Defense in Depth).
 *   - Diese Funktion wirft nie: DB-Fehler werden als { error } zurückgegeben,
 *     damit ein Themenwelten-Ausfall nicht die gesamte Sitemap (Kurse, Anbieter,
 *     Blog, Ratgeber) mit HTTP 500 zerstört.
 */

/**
 * Erlaubtes Format für URL-Segmente und Slugs.
 * Entspricht den CHECK-Constraints theme_worlds_slug_format_check /
 * theme_worlds_url_segment_format_check / scenarios_slug_format_check.
 */
const SAFE_PATH_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Prüft, ob ein Wert als URL-Pfadsegment verwendet werden darf. */
export function isSafePathSegment(value) {
  return typeof value === 'string' && SAFE_PATH_SEGMENT.test(value);
}

/** Escaped XML-Sonderzeichen in einem <loc>-Wert (Defense in Depth). */
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wählt den besten lastmod-Wert und gibt ihn als ISO-String zurück.
 * Ungültige/fehlende Werte ergeben null (dann wird kein <lastmod> ausgegeben).
 */
export function toLastmod(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

/**
 * Lädt publizierte Themenwelten und deren publizierte Szenario-Artikel und
 * bildet sie auf Sitemap-Pfade ab.
 *
 * @param {object} supabase - Supabase-Client (Service-Role oder Anon)
 * @param {object} [options]
 * @param {object} [options.logger=console] - Logger für Fehlerausgaben
 * @returns {Promise<{entries: Array<{path: string, lastmod: string|null, kind: 'theme-world'|'scenario'}>, error: Error|object|null}>}
 *          entries ist immer ein Array — auch im Fehlerfall (dann ggf. leer/teilweise).
 */
export async function fetchThemeWorldSitemapEntries(supabase, { logger = console } = {}) {
  const entries = [];

  try {
    const { data: worlds, error: worldsError } = await supabase
      .from('theme_worlds')
      .select('id, url_segment, slug, status, updated_at, published_at')
      .eq('status', 'published');

    if (worldsError) {
      logger.error?.(
        '[sitemap] Publizierte Themenwelten konnten nicht geladen werden:',
        worldsError.message || worldsError
      );
      return { entries, error: worldsError };
    }

    // Nur Datensätze mit gültigem Status UND gültigen URL-Bestandteilen.
    // Der Status wird erneut geprüft, falls ein Backend die Query-Filter ignoriert.
    const publishedWorlds = (worlds || []).filter((world) => {
      if (!world || world.status !== 'published') return false;
      if (!isSafePathSegment(world.url_segment) || !isSafePathSegment(world.slug)) {
        logger.warn?.(
          `[sitemap] Themenwelt übersprungen — unerwartetes URL-Format: segment=${world.url_segment} slug=${world.slug}`
        );
        return false;
      }
      return true;
    });

    const pathById = new Map();
    for (const world of publishedWorlds) {
      const path = `/bereich/${world.url_segment}/${world.slug}`;
      pathById.set(world.id, path);
      entries.push({
        path,
        lastmod: toLastmod(world.updated_at, world.published_at),
        kind: 'theme-world',
      });
    }

    if (pathById.size === 0) {
      return { entries, error: null };
    }

    const { data: scenarios, error: scenariosError } = await supabase
      .from('theme_world_scenarios')
      .select('theme_world_id, slug, status, updated_at, published_at')
      .eq('status', 'published')
      .in('theme_world_id', Array.from(pathById.keys()));

    if (scenariosError) {
      logger.error?.(
        '[sitemap] Publizierte Szenario-Artikel konnten nicht geladen werden:',
        scenariosError.message || scenariosError
      );
      // Themenwelten-URLs bleiben erhalten — nur die Szenarien fehlen.
      return { entries, error: scenariosError };
    }

    for (const scenario of scenarios || []) {
      if (!scenario || scenario.status !== 'published') continue;
      // Szenarien ohne publizierte Eltern-Themenwelt haben keinen Pfad → werden verworfen.
      const worldPath = pathById.get(scenario.theme_world_id);
      if (!worldPath) continue;
      if (!isSafePathSegment(scenario.slug)) {
        logger.warn?.(
          `[sitemap] Szenario übersprungen — unerwartetes Slug-Format: ${scenario.slug}`
        );
        continue;
      }
      entries.push({
        path: `${worldPath}/${scenario.slug}`,
        lastmod: toLastmod(scenario.updated_at, scenario.published_at),
        kind: 'scenario',
      });
    }

    return { entries, error: null };
  } catch (e) {
    logger.error?.('[sitemap] Themenwelten-Abfrage fehlgeschlagen:', e?.message || e);
    return { entries, error: e };
  }
}
