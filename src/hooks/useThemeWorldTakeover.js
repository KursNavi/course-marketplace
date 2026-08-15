import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isThemeWorldDbEnabled } from '../lib/themeWorldFeatureFlag';
import {
  buildActiveThemeWorldTopicKeys,
  getLegacyThemeWorldTopicKeys,
} from '../lib/themeWorldTakeover';

/**
 * Liefert die Menge aller Themen, deren /bereich/-Themenwelt öffentlich aktiv
 * ist — als Set von «{segment}/{slug}».
 *
 * Verwendung: Segmentübersichten (/private, /professional, /children) lösen
 * damit auf, ob eine Themenkachel auf /bereich/… oder /thema/… zeigt.
 *
 * Design:
 *   - Genau EINE Abfrage pro Seitenaufruf (nicht pro Kachel), Ergebnis wird
 *     modulweit gecacht.
 *   - Legacy-Themenwelten stehen synchron ab dem ersten Render zur Verfügung —
 *     die Kacheln für z.B. Sport/Yoga «springen» nicht.
 *   - Ist das DB-System nicht aktiviert, wird gar nicht abgefragt.
 *   - Bei DB-Fehlern bleibt es beim Legacy-Set: alle übrigen Themen behalten
 *     ihre /thema/-Links (sicherer Fallback, keine toten Links).
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedKeys = null;
let cachedAt = 0;
let inFlight = null;

/** Nur für Tests: verwirft den modulweiten Cache. */
export function resetThemeWorldTakeoverCache() {
  cachedKeys = null;
  cachedAt = 0;
  inFlight = null;
}

async function loadActiveTopicKeys() {
  if (cachedKeys && Date.now() - cachedAt < CACHE_TTL_MS) return cachedKeys;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let publishedDbWorlds = [];
    try {
      const { data, error } = await supabase
        .from('theme_worlds')
        .select('url_segment, slug, status')
        .eq('status', 'published');

      if (error) throw error;
      publishedDbWorlds = data || [];
    } catch (e) {
      // Sicherer Fallback: nur Legacy-Themenwelten übernehmen, alle anderen
      // Themen behalten ihre bestehende /thema/-Landingpage.
      console.error(
        '[themeWorldTakeover] Publizierte Themenwelten konnten nicht geladen werden — /thema/-Fallback bleibt aktiv:',
        e?.message || e,
      );
      publishedDbWorlds = [];
    }

    const keys = buildActiveThemeWorldTopicKeys({
      dbEnabled: true,
      publishedDbWorlds,
    });

    cachedKeys = keys;
    cachedAt = Date.now();
    inFlight = null;
    return keys;
  })();

  return inFlight;
}

/**
 * @returns {Set<string>} Menge von «{segment}/{slug}» mit öffentlich aktiver Themenwelt
 */
export function useThemeWorldTakeover() {
  // Startwert: Legacy-Themenwelten sind statisch bekannt und immer öffentlich.
  const [topicKeys, setTopicKeys] = useState(() =>
    cachedKeys || getLegacyThemeWorldTopicKeys(),
  );

  useEffect(() => {
    if (!isThemeWorldDbEnabled()) return;

    let cancelled = false;
    loadActiveTopicKeys().then((keys) => {
      if (!cancelled) setTopicKeys(keys);
    });

    return () => { cancelled = true; };
  }, []);

  return topicKeys;
}
