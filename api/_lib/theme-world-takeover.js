/**
 * Server-seitige Adapter für die zentrale Übernahme-Regel
 * (siehe src/lib/themeWorldTakeover.js für die Regel selbst).
 *
 * Hier steht ausschliesslich das, was im Browser nicht funktioniert:
 * Lesen von process.env und die Supabase-Abfrage. Die Entscheidungslogik
 * bleibt in einem einzigen Modul, damit Segmentübersicht, /thema/-Redirect
 * und Sitemap nicht auseinanderlaufen.
 */

import { buildActiveThemeWorldTopicKeys } from '../../src/lib/themeWorldTakeover.js';

/**
 * Ist das dynamische Themenwelten-System öffentlich aktiviert?
 *
 * Serverseitiges Gegenstück zu isThemeWorldDbEnabled() aus
 * src/lib/themeWorldFeatureFlag.js. Die Variable ist VITE_-prefixed, weil sie
 * denselben Rollout-Schalter beschreibt wie im Client; sie enthält keinen
 * Secret-Wert (nur 'true'/'false').
 *
 * @param {object} [env=process.env]
 * @returns {boolean}
 */
export function isThemeWorldDbEnabledServer(env = process.env) {
  return env?.VITE_THEME_WORLD_DB_ENABLED === 'true';
}

/**
 * Lädt die publizierten Themenwelten (nur die für die URL nötigen Spalten).
 *
 * Wirft nie: bei einem DB-Fehler wird { worlds: [], error } zurückgegeben.
 * Aufrufer behandeln das als «keine DB-Themenwelt aktiv» — die bestehenden
 * /thema/-Seiten bleiben dann als sicherer Fallback bestehen.
 *
 * @param {object} supabase
 * @param {object} [options]
 * @param {object} [options.logger=console]
 * @returns {Promise<{worlds: Array, error: any}>}
 */
export async function fetchPublishedThemeWorldRefs(supabase, { logger = console } = {}) {
  try {
    const { data, error } = await supabase
      .from('theme_worlds')
      .select('url_segment, slug, status')
      .eq('status', 'published');

    if (error) {
      logger.error?.(
        '[theme-world-takeover] Publizierte Themenwelten konnten nicht geladen werden:',
        error.message || error
      );
      return { worlds: [], error };
    }

    return { worlds: data || [], error: null };
  } catch (e) {
    logger.error?.(
      '[theme-world-takeover] Themenwelten-Abfrage fehlgeschlagen:',
      e?.message || e
    );
    return { worlds: [], error: e };
  }
}

/**
 * Ermittelt serverseitig die Menge aller Themen mit öffentlich aktiver
 * Themenwelt («{segment}/{slug}»).
 *
 * @param {object} supabase
 * @param {object} [options]
 * @param {object} [options.env=process.env]
 * @param {object} [options.logger=console]
 * @returns {Promise<{topicKeys: Set<string>, error: any}>}
 */
export async function loadActiveThemeWorldTopicKeys(supabase, { env = process.env, logger = console } = {}) {
  const dbEnabled = isThemeWorldDbEnabledServer(env);

  if (!dbEnabled) {
    // Keine Abfrage nötig: ohne Flag ist keine DB-Themenwelt öffentlich aktiv.
    return { topicKeys: buildActiveThemeWorldTopicKeys({ dbEnabled: false }), error: null };
  }

  const { worlds, error } = await fetchPublishedThemeWorldRefs(supabase, { logger });

  return {
    topicKeys: buildActiveThemeWorldTopicKeys({ dbEnabled: true, publishedDbWorlds: worlds }),
    error,
  };
}
